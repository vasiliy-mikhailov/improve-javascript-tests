// Claims a UNIT test can only approximate.
//
// Several unit tests assert that a phrase reaches the prompt: UI guidance is present
// for a .tsx file, team constraints are rendered, the failure text is quoted. Those are
// worth keeping — they are fast and they catch a prompt edit. But none of them is the
// claim we actually care about, which is what the MODEL does with the phrase. A
// constraint that is present and ignored buys nothing; the unit test stays green either
// way. These are the same claims, asked of the real model, with mechanical verdicts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ask, samples, skipUnlessLive } from './helpers/ask.mjs';
import { killBuildPrompt } from '../n8n/nodes/kill-build-prompt.js';
import { killParseTest } from '../n8n/nodes/kill-parse-test.js';

const COMPONENT = `import { useState } from 'react';

export function Counter({ label, step = 1, onChange }) {
  const [n, setN] = useState(0);
  const bump = () => { const next = n + step; setN(next); onChange?.(next); };
  return (
    <div>
      <span data-testid="label">{label}</span>
      <output aria-label="count">{n}</output>
      <button onClick={bump} disabled={step === 0}>add {step}</button>
    </div>
  );
}
`;

const MODULE = `export function slugify(title, max = 40) {
  const base = String(title).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return base.length > max ? base.slice(0, max).replace(/-+$/, '') : base;
}
`;

function plan(over = {}, opts = {}) {
  const t = {
    ok: true, runner: 'vitest', packageJson: 'fixture (type=module)',
    path: 'src/slug.js', source: MODULE, testPath: 'test/slug.test.js',
    testExists: false, existingTest: null, constraints: [], ui: null, killIdea: '',
    mutant: { mutator: 'EqualityOperator', line: 3, column: 15, status: 'survived', replacement: 'base.length >= max' },
    ...over,
  };
  return killBuildPrompt(t, opts);
}

async function generate(p) {
  const r = await ask({ system: p.system, prompt: p.prompt, json: true, thinking: false,
    maxTokens: p.maxTokens, temperature: p.temperature });
  let json = null;
  try { json = JSON.parse(r.content || '{}'); } catch { }
  const parsed = killParseTest({ ok: true, json }, p);
  return { r, json, content: parsed.tests[0]?.content || '' };
}

test('a team constraint is OBEYED, not merely included in the prompt',
  { skip: skipUnlessLive, timeout: 900000 }, async () => {
    // The unit test asserts the constraint text is in the system prompt. This asserts
    // the generated code honours it — the difference between D7 being implemented and
    // D7 being advertised.
    const { passed, total, out } = await samples(3, async () => {
      const { content } = await generate(plan({
        constraints: ['Never call .toString() on a function or inspect source code',
          'Never use snapshot assertions (toMatchSnapshot)'],
      }));
      const violations = [];
      if (/\.toString\s*\(\s*\)/.test(content)) violations.push('fn.toString()');
      if (/toMatchSnapshot|toMatchInlineSnapshot/.test(content)) violations.push('snapshot');
      return { ok: content.length > 0 && violations.length === 0,
        note: `${content.length}ch, violations ${JSON.stringify(violations)}` };
    });
    assert.equal(passed, total, `team constraints were violated in ${total - passed}/${total} generated files`);
  });

test('a UI component gets a rendered test, not one that pokes at internals',
  { skip: skipUnlessLive, timeout: 900000 }, async () => {
    // The unit test checks the guidance paragraph appears for a .tsx file. The claim it
    // stands in for is that the model then writes a COMPONENT test — renders, queries
    // by role or label, asserts on what a user can see.
    const { passed, total, out } = await samples(3, async () => {
      const { content } = await generate(plan({
        path: 'src/Counter.tsx', source: COMPONENT, testPath: 'src/Counter.test.tsx',
        ui: { framework: 'react', testingLibrary: '@testing-library/react', userEvent: true, jestDom: true, domEnv: true },
        mutant: { mutator: 'ConditionalExpression', line: 12, column: 32, status: 'survived', replacement: 'false' },
      }));
      const renders = /\brender\s*\(/.test(content);
      const queries = /getBy(Role|LabelText|Text)|screen\./.test(content);
      const internals = /\.state\b|\binstance\(\)|__reactProps|\.props\b\s*=/.test(content);
      return { ok: renders && queries && !internals,
        note: `render=${renders} accessible-query=${queries} internals=${internals} ${content.length}ch` };
    });
    assert.ok(passed >= 2, `component guidance did not produce component tests: ${passed}/${total}`);
  });

test('EXACTLY ONE file comes back, because the parser keeps only one',
  { skip: skipUnlessLive, timeout: 900000 }, async () => {
    // killParseTest slices to one, so a model that returns three has had two thrown
    // away after we paid for them. The unit test can only check the slicing.
    const { passed, total } = await samples(3, async () => {
      const { json } = await generate(plan());
      const n = Array.isArray(json?.tests) ? json.tests.length : 0;
      return { ok: n === 1, note: `model returned ${n} file(s)` };
    });
    assert.ok(passed >= 2, `the prompt is not holding the model to one file: ${passed}/${total}`);
  });

test('shown the runner error, the escalation fixes the import instead of repeating it',
  { skip: skipUnlessLive, timeout: 900000 }, async () => {
    // Today's fix, asked of the model directly. A live round wrote 13 red tests in a
    // row because the escalation was never told WHY the previous one failed; the unit
    // test asserts the text reaches the prompt, this asserts it changes the answer.
    const failure = "FAIL  test/slug.kill-L3.test.js\n"
      + "  Error: Failed to resolve import \"@/lib/slug\" from \"test/slug.kill-L3.test.js\".\n"
      + "  Does the file exist?\n";
    const { passed, total, out } = await samples(3, async () => {
      const { content } = await generate(plan({
        existingTest: "import { describe, it, expect } from 'vitest';\n"
          + "import { slugify } from '../src/slug.js';\n\n"
          + "describe('slugify', () => { it('lowercases', () => { expect(slugify('Ab')).toBe('ab'); }); });\n",
      }, { thinking: true, escalated: true, failure }));
      const repeatsBadImport = /@\/lib\/slug/.test(content);
      const usesShownImport = /from\s+['"][^'"]*src\/slug(\.js)?['"]/.test(content);
      return { ok: content.length > 0 && !repeatsBadImport && usesShownImport,
        note: `repeats-bad-import=${repeatsBadImport} uses-shown-import=${usesShownImport}` };
    });
    assert.ok(passed >= 2,
      `the escalation ignored the runner output in ${total - passed}/${total} samples: `
      + JSON.stringify(out.filter((s) => !s.ok).map((s) => s.note)));
  });
