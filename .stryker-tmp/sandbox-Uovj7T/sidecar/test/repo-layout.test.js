// @ts-nocheck
'use strict';
// UNIT TESTS for where generated tests LAND and which existing test the model is
// shown as a style reference. Both are pure filesystem logic, both were uncovered,
// and both decide whether generated work is usable at all: a test written outside the
// runner's include patterns is never executed — it raises nothing, kills nothing, and
// still looks like a delivered file in the diff.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withSandbox, repo } = require('./helpers/env');   // FIRST, always
const { installFakes } = require('./helpers/fakes');
const fs = require('node:fs');
const path = require('node:path');

/** Lay down a repo tree; values are file contents. */
async function tree(sb, files) {
  installFakes(sb);
  await sb.start();
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(sb.repoDir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
}

const A_TEST = "import { it } from 'vitest';\nit('a', () => {});\n";

// ── an existing test always wins ───────────────────────────────────────────

test('an existing sibling test is found before any convention is guessed', () => withSandbox(async (sb) => {
  await tree(sb, { 'src/cart.ts': 'export const x = 1;', 'src/cart.test.ts': A_TEST });
  const g = repo.guessTestPath('src/cart.ts');
  assert.deepEqual(g, { path: 'src/cart.test.ts', exists: true });
}));

test('every shape of existing test is recognised, in priority order', () => withSandbox(async (sb) => {
  const cases = [
    ['src/__tests__/cart.test.ts', { 'src/cart.ts': '', 'src/__tests__/cart.test.ts': A_TEST }],
    ['test/cart.test.ts', { 'src/cart.ts': '', 'test/cart.test.ts': A_TEST }],
    ['tests/cart.test.ts', { 'src/cart.ts': '', 'tests/cart.test.ts': A_TEST }],
    ['tests/unit/cart.test.ts', { 'src/cart.ts': '', 'tests/unit/cart.test.ts': A_TEST }],
  ];
  for (const [expected, files] of cases) {
    await withSandbox(async (s2) => {
      await tree(s2, files);
      assert.deepEqual(repo.guessTestPath('src/cart.ts'), { path: expected, exists: true }, expected);
    });
  }
}));

// ── with no existing test, mirror what the repo already does ───────────────

test('a repo that keeps tests in tests/unit gets its new test in tests/unit', () => withSandbox(async (sb) => {
  await tree(sb, {
    'src/orders/cart.ts': 'export const x = 1;',
    'tests/unit/a.test.ts': A_TEST, 'tests/unit/b.test.ts': A_TEST, 'tests/unit/c.test.ts': A_TEST,
  });

  const g = repo.guessTestPath('src/orders/cart.ts');

  assert.equal(g.exists, false);
  assert.equal(g.path, 'tests/unit/orders/cart.test.ts',
    'the source tree under src/ is mirrored, so a vitest include of tests/unit/** picks it up');
}));

test('a repo that colocates in __tests__ gets a __tests__ sibling', () => withSandbox(async (sb) => {
  await tree(sb, {
    'src/orders/cart.ts': '',
    'src/a/__tests__/a.test.ts': A_TEST, 'src/b/__tests__/b.test.ts': A_TEST,
  });

  assert.equal(repo.guessTestPath('src/orders/cart.ts').path, 'src/orders/__tests__/cart.test.ts');
}));

test('a repo that colocates plainly gets a plain sibling', () => withSandbox(async (sb) => {
  await tree(sb, {
    'src/orders/cart.ts': '',
    'src/a/a.test.ts': A_TEST, 'src/b/b.test.ts': A_TEST,
  });

  assert.equal(repo.guessTestPath('src/orders/cart.ts').path, 'src/orders/cart.test.ts');
}));

test('the DOMINANT convention wins, not the first one found', () => withSandbox(async (sb) => {
  await tree(sb, {
    'src/orders/cart.ts': '',
    'src/legacy/old.test.ts': A_TEST,                       // one colocated straggler
    'tests/unit/a.test.ts': A_TEST, 'tests/unit/b.test.ts': A_TEST, 'tests/unit/c.test.ts': A_TEST,
  });

  assert.match(repo.guessTestPath('src/orders/cart.ts').path, /^tests\/unit\//);
}));

test('a repo with no tests at all falls back to a sibling', () => withSandbox(async (sb) => {
  await tree(sb, { 'src/cart.ts': '' });
  assert.deepEqual(repo.guessTestPath('src/cart.ts'), { path: 'src/cart.test.ts', exists: false });
}));

test('the extension follows the source, and an unknown one becomes .ts', () => withSandbox(async (sb) => {
  await tree(sb, { 'src/a.tsx': '', 'src/b.mjs': '', 'src/c.vue': '' });
  assert.match(repo.guessTestPath('src/a.tsx').path, /\.test\.tsx$/);
  assert.match(repo.guessTestPath('src/b.mjs').path, /\.test\.mjs$/);
  assert.match(repo.guessTestPath('src/c.vue').path, /\.test\.ts$/);
}));

// ── the style reference the model imitates ─────────────────────────────────

test('a style reference is drawn from the repo, never from our own generated tests',
  () => withSandbox(async (sb) => {
    // Feeding a generated test back as the example compounds whatever it got wrong.
    const pad = (label) => "import { describe, it, expect } from 'vitest';\n"
      + `describe('${label}', () => {\n` + "  it('does a thing', () => { expect(1).toBe(1); });\n".repeat(6) + '});\n';
    await tree(sb, {
      'src/cart.ts': '',
      // the generated ones are SMALLER, which is exactly why they used to win
      'tests/unit/human.test.ts': pad('human-written') + '// '.padEnd(400, 'x') + '\n',
      'tests/unit/other.mac-cov.test.ts': pad('generated-bootstrap'),
      'tests/unit/other.kill-L4-booleanliteral-abc.test.ts': pad('generated-kill'),
    });

    const ref = repo.findStyleReference('src/cart.ts');

    assert.ok(ref, 'a repo with tests must yield an example');
    assert.match(ref.content, /human-written/);
    assert.doesNotMatch(ref.path, /mac-cov|kill-L/);
  }));

test('no tests in the repo means no style reference rather than a wrong one', () => withSandbox(async (sb) => {
  await tree(sb, { 'src/cart.ts': '' });
  assert.equal(repo.findStyleReference('src/cart.ts'), null);
}));

// ── directory census ───────────────────────────────────────────────────────

// ── what the pipeline detects about the repo ───────────────────────────────

test('the runner is detected from dependencies or the test script', () => withSandbox(async (sb) => {
  await withSandbox(async (s2) => {
    await tree(s2, { 'package.json': JSON.stringify({ devDependencies: { vitest: '^3.0.0' } }) });
    assert.equal(repo.detectRunner().testRunner, 'vitest');
  });
  await withSandbox(async (s2) => {
    await tree(s2, { 'package.json': JSON.stringify({ scripts: { test: 'jest --ci' } }) });
    assert.equal(repo.detectRunner().testRunner, 'jest');
  });
  await withSandbox(async (s2) => {
    await tree(s2, { 'package.json': JSON.stringify({ scripts: { test: 'mocha' } }) });
    assert.equal(repo.detectRunner().testRunner, null, 'an unsupported runner must be reported, not guessed');
  });
}));

test('the package manager is read from the lockfile, not assumed', () => withSandbox(async (sb) => {
  await withSandbox(async (s2) => {
    await tree(s2, { 'package.json': '{}', 'pnpm-lock.yaml': '' });
    assert.equal(repo.detectRunner().pm, 'pnpm', 'npm would corrupt a pnpm-managed node_modules');
  });
  await withSandbox(async (s2) => {
    await tree(s2, { 'package.json': '{}', 'yarn.lock': '' });
    assert.equal(repo.detectRunner().pm, 'yarn');
  });
  await withSandbox(async (s2) => {
    await tree(s2, { 'package.json': '{}' });
    assert.equal(repo.detectRunner().pm, 'npm');
  });
}));

test('the UI stack decides whether components get component-testing guidance', () => withSandbox(async (sb) => {
  await withSandbox(async (s2) => {
    await tree(s2, { 'package.json': JSON.stringify({
      dependencies: { react: '^18' },
      devDependencies: { '@testing-library/react': '^14', '@testing-library/user-event': '^14', jsdom: '^24' },
    }) });
    const ui = repo.detectUi();
    assert.equal(ui.framework, 'react');
    assert.equal(ui.testingLibrary, '@testing-library/react');
    assert.equal(ui.userEvent, true);
    assert.equal(ui.jestDom, false);
    assert.equal(ui.domEnv, true);
  });
  await withSandbox(async (s2) => {
    await tree(s2, { 'package.json': JSON.stringify({ dependencies: { express: '^4' } }) });
    assert.equal(repo.detectUi(), null, 'a server package must not be given component advice');
  });
}));
