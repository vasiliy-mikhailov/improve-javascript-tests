// UNIT TESTS — uiGuidance, the "is this file a UI component?" decision.
//
// This helper is inlined into BOTH prompt-building Code nodes ("Cov: Build Prompt"
// and "Kill: Build Prompt"), so its verdict decides what kind of test the model is
// asked for. Get it wrong in one direction and a component is tested by poking at
// its internals; wrong in the other and a plain module is handed component rules and
// the model tries to render something that cannot render.
//
// The two node test files own the "does the guidance ride into the prompt" question.
// This file owns the DETECTION: what counts as evidence that a file builds UI.
//
// No n8n, no HTTP: uiGuidance is a pure function of (path, { ui, source }), where
// `ui` is repo.detectUi()'s package.json verdict and `source` is the file's text as
// the sidecar read it (repo.readFileSafe(p, 24000)).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uiGuidance } from '../nodes/ui-guidance.js';

// ── fixtures ────────────────────────────────────────────────────────────────

const reactUi = { framework: 'react', testingLibrary: '@testing-library/react', userEvent: true, jestDom: true, domEnv: true };
const ui = (framework) => ({ framework, testingLibrary: null, userEvent: false, jestDom: false, domEnv: true });

// The only two questions worth asking of the return value: did it fire, and did it
// name the framework the repo actually uses.
const isComponent = (file, source, u = reactUi) => uiGuidance(file, { ui: u, source }).includes('UI COMPONENT');
const guidance = (file, source, u = reactUi) => uiGuidance(file, { ui: u, source });

// A plain logic module: no framework anywhere. Used as the "and this is what a
// non-component looks like" control in the same assertions.
const PLAIN = 'export function total(items) { return items.length; }\n';

// ── signal 1: the extension ─────────────────────────────────────────────────

test('a .jsx/.tsx extension is a component on its own — that is what the extension means', () => {
  // JSX does not compile anywhere else, so the path alone settles it and the source
  // is never consulted. This signal is unchanged and deliberately not widened.
  for (const f of ['src/Cart.jsx', 'src/Cart.tsx', 'app/routes/checkout.jsx']) {
    assert.ok(isComponent(f, PLAIN), f + ' is a component regardless of its source');
  }
  for (const f of ['src/cart.ts', 'src/cart.js', 'src/cart.mjs', 'src/cart.cts']) {
    assert.ok(!isComponent(f, PLAIN), f + ' is not a component on its extension');
  }
});

test('no UI framework in the repo means no component guidance, whatever the file is', () => {
  // repo.detectUi() returns null when package.json has none of the four frameworks.
  // A .tsx file there is a type-annotated module or dead code; either way we have no
  // testing library to name and no framework to render with.
  // called directly: `undefined` would trip the helper's default fixture.
  assert.equal(uiGuidance('src/Cart.tsx', { ui: null, source: "import React from 'react';\n" }), '');
  assert.equal(uiGuidance('src/Cart.tsx', { ui: undefined, source: PLAIN }), '');
  assert.equal(uiGuidance('src/Cart.tsx', { ui: null, source: "const React = require('react');\n" }), '');
});

// ── signal 2: a value import of the framework ───────────────────────────────

test('every way a module can VALUE-import the framework counts as evidence', () => {
  const forms = [
    ["import { useState } from 'react';\n", 'named import'],
    ['import React from "react";\n', 'default import, double quotes'],
    ['import * as React from "react";\n', 'namespace import'],
    ["import {\n  useState,\n  useEffect,\n} from 'react';\n", 'multi-line named import — the specifier is on the closing line'],
    ["import 'react';\n", 'side-effect import'],
    ['import React from"react";\n', 'no space before the specifier'],
    // BUG FIXED: CommonJS was invisible, so a .js component in a CJS repo was handed
    // logic-test guidance and the model asserted on internals instead of the DOM.
    ["const React = require('react');\n", 'require, default'],
    ['const { useState } = require("react");\n', 'require, destructured'],
    ["require('react');\n", 'bare require'],
    ["const React = await import('react');\n", 'dynamic import'],
  ];
  for (const [source, why] of forms) {
    assert.ok(isComponent('src/widget.ts', source), why);
  }
});

test('each of the four frameworks is recognised in the repo that uses it', () => {
  for (const fw of ['react', 'vue', 'svelte', 'preact']) {
    assert.ok(isComponent('src/widget.ts', `import x from '${fw}';\n`, ui(fw)), fw + ', esm');
    assert.ok(isComponent('src/widget.js', `const x = require('${fw}');\n`, ui(fw)), fw + ', cjs');
  }
});

test('the framework import is found anywhere in the file, not only in the first 2000 characters', () => {
  // BUG FIXED: the scan used to stop at character 2000. A licence header, a big block
  // of types or a long JSDoc preamble pushed the import out of the window and a real
  // component was tested as if it were plain logic — the most common shape of the
  // miss, because the files with long headers are the ones a company actually ships.
  const licence = '/*\n' + ' * Copyright (c) 2019 ACME. All rights reserved.\n'.repeat(80) + ' */\n';
  assert.ok(licence.length > 2000, 'fixture must actually clear the old window');
  assert.ok(isComponent('src/Widget.ts', licence + "import { useState } from 'react';\n"), 'past a licence header');

  const bigTypes = 'export type Row = { a: string };\n'.repeat(400);
  assert.ok(isComponent('src/Widget.ts', bigTypes + "const React = require('react');\n"), 'past a wall of type declarations');
});

test('a long multi-line import list does not hide the import that follows it', () => {
  // The `import … from` matcher bounds its clause at 2000 characters, which is what
  // stops it from rescanning the rest of the file from every `import` it sees (that
  // was measured at 1.2 s on a 200 000-character file). The bound has to sit well
  // clear of anything real: 300 specifiers is already far past react's whole API.
  const barrel = 'import {\n' + '  a,\n'.repeat(300) + "} from 'lodash';\n";
  assert.ok(isComponent('src/Widget.ts', barrel + "import { useState } from 'react';\n"), 'a 1500-character clause is stepped over');
  // …and here is where the bound bites, stated so the number is discoverable.
  assert.ok(!isComponent('src/Widget.ts', 'import {\n' + '  a,\n'.repeat(600) + "} from 'react';\n"), 'a clause past 2000 characters is not matched');
});

test('the scan is bounded, far beyond anything the sidecar can send', () => {
  // The sidecar reads at most 24 000 characters (repo.readFileSafe(p, 24000)) into
  // `source`, so this ceiling can never bite in production — it exists only so a
  // caller handing the node a whole bundle cannot make it chew through megabytes.
  const near = 'x'.repeat(150000) + "\nimport { useState } from 'react';\n";
  assert.ok(isComponent('src/Widget.ts', near), '150 000 characters in, still found');
  const past = 'x'.repeat(200001) + "\nimport { useState } from 'react';\n";
  assert.ok(!isComponent('src/Widget.ts', past), 'past 200 000 characters the scan has stopped');
});

// ── what is NOT evidence ────────────────────────────────────────────────────

test('a framework named in a COMMENT is not an import', () => {
  // Widening the detector must not widen it into nonsense: the whole point of reading
  // the source is to find out what the file DOES, and a comment does nothing.
  const notComponents = [
    ["// this module is deliberately framework-free, do not import react here\n" + PLAIN, 'a note about react'],
    ["// import { useState } from 'react';\n" + PLAIN, 'a commented-out import'],
    ["/* import React from 'react'; */\n" + PLAIN, 'a commented-out import, block form'],
    ["/**\n * Ported from our old component: import { useState } from 'react'\n */\n" + PLAIN, 'a JSDoc block'],
    ["/**\n * @type {import('react').FC}\n */\n" + PLAIN, 'a JSDoc type-import annotation'],
    ["const n = 1; // superseded by import React from 'react'\n", 'a trailing comment'],
    ["/*\n" + "filler\n".repeat(50) + "const React = require('react');\n*/\n" + PLAIN, 'a require inside a long block comment'],
  ];
  for (const [source, why] of notComponents) {
    assert.ok(!isComponent('src/cart.ts', source), why);
  }
});

test('a URL in a comment does not truncate the line it lives on', () => {
  // `//` inside `https://` is not a comment. Cutting there would be harmless on its
  // own line but is the kind of shortcut that quietly eats real code, so it is pinned.
  const source = "import { useState } from 'react'; // see https://react.dev/reference/react/useState\n";
  assert.ok(isComponent('src/widget.ts', source));
});

test('a framework named in a STRING is not an import', () => {
  const notComponents = [
    ['const snippet = "import React from \'react\';";\n' + PLAIN, 'a code sample held in a string'],
    ["throw new Error('this plugin requires react');\n" + PLAIN, 'an error message'],
    ["export const PEER = 'react';\n" + PLAIN, 'a package name as data'],
  ];
  for (const [source, why] of notComponents) {
    assert.ok(!isComponent('src/cart.ts', source), why);
  }
});

test('a TYPE-only import does not make a module a component', () => {
  // A .ts module that imports react purely to type a prop or a ReactNode parameter
  // has no rendered output to assert on. Erased at compile time, it is evidence about
  // the module's SIGNATURES, not its behaviour.
  assert.ok(!isComponent('src/props.ts', "import type { FC } from 'react';\n" + PLAIN), 'import type { … }');
  assert.ok(!isComponent('src/props.ts', "import type React from 'react';\n" + PLAIN), 'import type Default');
  assert.ok(!isComponent('src/props.ts', "import { type FC, type ReactNode } from 'react';\n" + PLAIN), 'every specifier marked type');
  assert.ok(!isComponent('src/props.ts', "import type {\n  FC,\n  ReactNode,\n} from 'react';\n" + PLAIN), 'multi-line type import');

  // …but one value specifier is enough, and a type import must not mask a real one.
  assert.ok(isComponent('src/widget.ts', "import { type FC, useState } from 'react';\n"), 'mixed specifiers');
  assert.ok(isComponent('src/widget.ts', "import React, { type FC } from 'react';\n"), 'default binding is a value');
  assert.ok(isComponent('src/widget.ts', "import type { FC } from 'react';\nimport { useState } from 'react';\n"),
    'a type-only import earlier in the file does not stop the scan');
});

test('a re-export is not an import', () => {
  // `export … from 'react'` is a barrel file forwarding someone else's API. There is
  // nothing in it to render.
  assert.ok(!isComponent('src/index.ts', "export * from 'react';\n"));
  assert.ok(!isComponent('src/index.ts', "export { useState } from 'react';\n"));
});

test('a subpath of the framework is deliberately not evidence', () => {
  // The rule is "the framework package itself, not its subpaths", and svelte is why:
  // `svelte/store` is plain observable state, and a store dressed up as a component
  // gets a render-and-query test that cannot work. The price is `preact/hooks`, which
  // IS component code — a narrow miss, since a preact file that only reaches for
  // hooks and never for `preact` itself is almost always .jsx/.tsx and caught above.
  assert.ok(!isComponent('src/store.ts', "import { writable } from 'svelte/store';\n", ui('svelte')));
  assert.ok(!isComponent('src/useThing.ts', "import { useState } from 'preact/hooks';\n", ui('preact')));
  // and the near-miss that must never match: someone else's package ending in the name
  assert.ok(!isComponent('src/cart.ts', "import { render } from '@testing-library/react';\n"));
  assert.ok(!isComponent('src/cart.ts', "import { renderToString } from 'react-dom/server';\n"));
});

// ── the guidance must describe the framework the repo actually has ──────────

test('the file must import the repo\'s OWN framework, because the guidance names it', () => {
  // Everything the guidance says downstream — the framework name, the testing library
  // — comes from repo.detectUi(). Firing on some OTHER framework's import would tell
  // the model to render a Vue file with @testing-library/react.
  assert.ok(!isComponent('src/widget.ts', "import { ref } from 'vue';\n", reactUi), 'a vue import in a react repo');
  assert.ok(!isComponent('src/widget.ts', "import { useState } from 'react';\n", ui('svelte')), 'a react import in a svelte repo');
  assert.match(guidance('src/widget.ts', "import { ref } from 'vue';\n", ui('vue')), /UI COMPONENT \(vue\)/);
});

test('react and preact answer for each other, because preact/compat aliases the name', () => {
  // A preact repo that ships preact/compat has its components literally `import React
  // from "react"` — the bundler rewrites it. Reading that as "not our framework"
  // would miss every component in the repo.
  assert.ok(isComponent('src/widget.ts', "import { useState } from 'react';\n", ui('preact')), 'react import, preact repo');
  assert.ok(isComponent('src/widget.ts', "import { h } from 'preact';\n", reactUi), 'preact import, react repo');
  // The alias is between those two only — vue and svelte are nobody's compat target.
  assert.ok(!isComponent('src/widget.ts', "import { ref } from 'vue';\n", ui('svelte')));
});

// ── shape of the returned guidance ─────────────────────────────────────────

test('the guidance is empty string, not undefined, when the file is not a component', () => {
  // Both callers concatenate this straight into a system prompt.
  const out = uiGuidance('src/cart.ts', { ui: reactUi, source: PLAIN });
  assert.equal(out, '');
});

test('a missing or unusable source is a non-component, never a throw', () => {
  // /api/files/gaps returns source: null for an unreadable file, and the mutant loop
  // builds its `gaps` by hand. A throw here fails the whole n8n node.
  for (const source of [undefined, null, '', 0, false, { not: 'a string' }, ['x']]) {
    assert.equal(uiGuidance('src/cart.ts', { ui: reactUi, source }), '', String(source));
    // …and the extension still decides on its own, with no source to read.
    assert.ok(uiGuidance('src/Cart.tsx', { ui: reactUi, source }).includes('UI COMPONENT'), String(source));
  }
  assert.equal(uiGuidance('src/cart.ts', {}), '', 'no ui and no source at all');
});
