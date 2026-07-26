// UNIT TESTS — the coverage-bootstrap Code nodes.
//
// These four functions ARE the JS that n8n runs inside "Cov: Build Prompt",
// "Cov: Parse Tests", "Cov: Build Repair" and "Cov: Parse Repair"; the generator
// inlines their source verbatim. Testing them here is testing the node.
//
// No n8n, no HTTP, no LLM: every input is a literal of the shape the graph feeds the
// node — the /api/files/gaps response, an /api/llm/chat response, the previous Code
// node's output.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { covBuildPrompt } from '../nodes/cov-build-prompt.js';
import { covParseTests } from '../nodes/cov-parse-tests.js';
import { covBuildRepair } from '../nodes/cov-build-repair.js';
import { covParseRepair } from '../nodes/cov-parse-repair.js';
import { CONDITIONS, COMPARISONS } from '../nodes/conditions.js';

// ── fixtures ───────────────────────────────────────────────────────────────

// The /api/files/gaps payload (sidecar/server.js 'GET /api/files/gaps'), narrowed to
// the fields the node reads. Defaults describe a partially covered plain-TS file.
const gaps = (over = {}) => ({
  ok: true,
  path: 'src/cart.ts',
  source: 'export function total(items) { return items.length; }\n',
  uncovered: { lines: [3, 4, 5], functions: ['total'], branches: ['3:1'] },
  rounds: 0,
  needsBootstrap: true,
  ui: null,
  testPath: 'test/cart.test.ts',
  testExists: true,
  existingTest: 'import { total } from "../src/cart";\n',
  runner: 'vitest',
  constraints: [],
  packageJson: 'demo (type=module)',
  ...over,
});

// An /api/llm/chat response carrying parsed JSON.
const llm = (tests, over = {}) => ({ ok: true, json: { tests }, ...over });

const content = (marker = 'assert.equal(1, 1);') => `import { total } from "../src/cart";\n${marker}\n`;

// The IF nodes are expression STRINGS n8n evaluates — running the same characters the
// workflow ships is the only way a unit test can speak for a branch. `$json` is the
// only binding these two conditions use.
function ifBranch(name, $json) {
  const expr = CONDITIONS[name].replace(/^=\{\{/, '').replace(/\}\}$/, '');
  const value = new Function('$json', `return (${expr});`)($json);
  const cmp = COMPARISONS[name];
  return cmp.operation === 'larger' ? value > cmp.value2 : value === cmp.value2;
}

// The allowlist the sidecar enforces before it will write a generated test
// (sidecar/repo.js: TEST_PATH_RE and the js/ts extension check). A path this node
// emits that the sidecar refuses is a test file the pipeline counts but never has.
const SIDECAR_TEST_PATH_RE = /((^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$)/;
const SIDECAR_EXT_RE = /\.[cm]?[jt]sx?$/;

// ── Cov: Build Prompt — the skip path ──────────────────────────────────────

test('Build Prompt: an already-executed file is handed to the mutant loop, not to the LLM', () => {
  const out = covBuildPrompt(gaps({ needsBootstrap: false }), 'src/cart.ts');

  assert.equal(out.skip, true);
  assert.match(out.reason, /mutant loop takes it from here/, 'the reason names who continues');
  // The whole point of the skip: no chat request is built, so "Cov: LLM Write Tests"
  // is never reached and no tokens are spent on bulk coverage tests.
  assert.equal(out.system, undefined);
  assert.equal(out.prompt, undefined);
  assert.equal(out.maxTokens, undefined);
  assert.equal(ifBranch('Cov: Has Work?', out), false, 'Has Work? routes a skip straight to Done');
});

test('Build Prompt: bootstrap wanted but nothing uncovered is a different skip reason', () => {
  const empty = covBuildPrompt(gaps({ uncovered: { lines: [], functions: [], branches: [] } }), 'src/cart.ts');
  assert.equal(empty.skip, true);
  assert.equal(empty.reason, 'file fully covered');

  // /api/files/gaps can omit the arrays entirely; that must not throw or ask for tests.
  const missing = covBuildPrompt(gaps({ uncovered: {} }), 'src/cart.ts');
  assert.equal(missing.skip, true);
  assert.equal(missing.reason, 'file fully covered');

  const noKey = covBuildPrompt(gaps({ uncovered: undefined }), 'src/cart.ts');
  assert.equal(noKey.skip, true);
});

test('Build Prompt: a skip still carries the plan the Done branch reports on', () => {
  const out = covBuildPrompt(gaps({ needsBootstrap: false }), 'src/cart.ts');
  assert.equal(out.targetPath, 'test/cart.mac-cov.test.ts');
  assert.equal(out.existingTestPath, 'test/cart.test.ts');
  assert.equal(out.existingTestExists, true);
});

test('Build Prompt: a fully uncovered file is work, not a skip', () => {
  // needsBootstrap AND lines === 'all' is the canonical never-imported file.
  const out = covBuildPrompt(gaps({ uncovered: { lines: 'all' } }), 'src/cart.ts');
  assert.equal(out.skip, undefined);
  assert.equal(ifBranch('Cov: Has Work?', out), true);
});

// ── Cov: Build Prompt — the request ────────────────────────────────────────

test('Build Prompt: a file with gaps produces a complete chat request', () => {
  const out = covBuildPrompt(gaps(), 'src/cart.ts');

  assert.equal(out.json, true, 'the sidecar must parse the reply as JSON');
  assert.equal(out.maxTokens, 6000);
  assert.equal(out.temperature, 0.3);
  assert.equal(out.stage, 'improving_coverage');
  assert.match(out.stageDetail, /uncovered/);
  assert.match(out.system, /vitest tests/, 'the detected runner steers the dialect');
  assert.match(out.system, /Reply ONLY with JSON/);
  assert.match(out.system, /Create NEW test files only/);
  assert.ok(out.system.includes(out.targetPath), 'the model is told the path we planned');
  assert.ok(out.prompt.includes('src/cart.ts (package: demo (type=module))'));
  assert.ok(out.prompt.includes('export function total'), 'the source is in the prompt');
});

test('Build Prompt: fully-uncovered and partially-uncovered files get different UNCOVERED sections', () => {
  const whole = covBuildPrompt(gaps({ uncovered: { lines: 'all' } }), 'src/cart.ts');
  assert.ok(whole.prompt.includes('UNCOVERED: ENTIRE FILE (never imported by any test)'));
  assert.ok(!whole.prompt.includes('lines ['), 'no line list when the file is untouched');

  const partial = covBuildPrompt(gaps({ uncovered: { lines: [3, 4], functions: ['total'], branches: ['3:1'] } }), 'src/cart.ts');
  assert.ok(partial.prompt.includes('UNCOVERED: lines [3,4]; functions ["total"]; branches ["3:1"]'));
  assert.ok(!partial.prompt.includes('ENTIRE FILE'));
});

test('Build Prompt: partial UNCOVERED lists are capped so one bad file cannot flood the prompt', () => {
  const lines = Array.from({ length: 300 }, (_, i) => i + 1);
  const functions = Array.from({ length: 50 }, (_, i) => 'fn' + i);
  const branches = Array.from({ length: 90 }, (_, i) => 'br' + i);
  const out = covBuildPrompt(gaps({ uncovered: { lines, functions, branches } }), 'src/cart.ts');

  assert.ok(out.prompt.includes('lines ' + JSON.stringify(lines.slice(0, 120))), '120 lines');
  assert.ok(out.prompt.includes('functions ' + JSON.stringify(functions.slice(0, 30))), '30 functions');
  assert.ok(out.prompt.includes('branches ' + JSON.stringify(branches.slice(0, 40))), '40 branches');
  assert.ok(!out.prompt.includes('"fn30"'), 'function 31 is dropped');
  assert.ok(!out.prompt.includes('"br40"'), 'branch 41 is dropped');
});

test('Build Prompt: source and existing test are truncated to their documented limits', () => {
  const source = 'a'.repeat(13_990) + 'SRC_KEEP' + 'a'.repeat(500) + 'SRC_DROP';
  const existingTest = 'b'.repeat(5_990) + 'TEST_KEEP' + 'b'.repeat(500) + 'TEST_DROP';
  const out = covBuildPrompt(gaps({ source, existingTest }), 'src/cart.ts');

  assert.ok(out.prompt.includes('SRC_KEEP'), 'source keeps its first 14000 chars');
  assert.ok(!out.prompt.includes('SRC_DROP'), 'source is cut at 14000');
  assert.ok(out.prompt.includes('TEST_KEEP'), 'existing test keeps its first 6000 chars');
  assert.ok(!out.prompt.includes('TEST_DROP'), 'existing test is cut at 6000');
});

test('Build Prompt: a missing existing test becomes "(none)" rather than "null"', () => {
  const out = covBuildPrompt(gaps({ existingTest: null }), 'src/cart.ts');
  assert.ok(out.prompt.includes('(none)'));
  assert.ok(!out.prompt.includes('null'));
});

test('Build Prompt: null-ish gaps fields never throw', () => {
  const out = covBuildPrompt(gaps({ source: null, existingTest: undefined, constraints: null }), 'src/cart.ts');
  assert.equal(typeof out.prompt, 'string');
  assert.ok(!out.system.includes('Team constraints'));
});

// ── Cov: Build Prompt — the target path ────────────────────────────────────

test('Build Prompt: the target path preserves the SOURCE file extension', () => {
  // The extension comes from the source, not from the existing test: a .tsx source
  // needs a .tsx test even when the repo's other tests are .ts.
  const cases = [
    ['src/cart.ts', 'test/cart.mac-cov.test.ts'],
    ['src/Cart.tsx', 'test/cart.mac-cov.test.tsx'],
    ['src/Cart.jsx', 'test/cart.mac-cov.test.jsx'],
    ['src/cart.js', 'test/cart.mac-cov.test.js'],
    ['src/cart.mjs', 'test/cart.mac-cov.test.mjs'],
    ['src/cart.cjs', 'test/cart.mac-cov.test.cjs'],
    ['src/cart.mts', 'test/cart.mac-cov.test.mts'],
    ['src/cart.vue', 'test/cart.mac-cov.test.ts'], // unknown extension falls back to .ts
  ];
  for (const [file, expected] of cases) {
    assert.equal(covBuildPrompt(gaps(), file).targetPath, expected, file);
  }
});

test('Build Prompt: later rounds write to their own file', () => {
  assert.equal(covBuildPrompt(gaps({ rounds: 0 }), 'src/cart.ts').targetPath, 'test/cart.mac-cov.test.ts');
  assert.equal(covBuildPrompt(gaps({ rounds: 1 }), 'src/cart.ts').targetPath, 'test/cart.mac-cov-r2.test.ts');
  assert.equal(covBuildPrompt(gaps({ rounds: 4 }), 'src/cart.ts').targetPath, 'test/cart.mac-cov-r5.test.ts');
});

test('Build Prompt: the target path never collides with the existing test file', () => {
  const testPaths = [
    'test/cart.test.ts',
    'src/cart.spec.tsx',
    'src/__tests__/cart.test.js',
    'tests/unit/cart.test.mjs',
    'test/cart.mac-cov.test.ts',      // round 1's own output, if it became the guess
    'tests/cart.ts',                  // no .test./.spec. segment at all
  ];
  for (const testPath of testPaths) {
    for (const rounds of [0, 1, 3]) {
      const out = covBuildPrompt(gaps({ testPath, rounds }), 'src/cart.ts');
      assert.notEqual(out.targetPath, testPath, `${testPath} @ round ${rounds}`);
      assert.notEqual(out.targetPath, out.existingTestPath);
    }
  }
});

test('Build Prompt: every target path we plan is one the sidecar will accept', () => {
  for (const file of ['src/cart.ts', 'src/Cart.tsx', 'src/cart.mjs', 'src/cart.vue']) {
    for (const testPath of ['test/cart.test.ts', 'src/cart.spec.tsx', 'src/__tests__/cart.test.js']) {
      for (const rounds of [0, 2]) {
        const { targetPath } = covBuildPrompt(gaps({ testPath, rounds }), file);
        assert.match(targetPath, SIDECAR_TEST_PATH_RE, targetPath);
        assert.match(targetPath, SIDECAR_EXT_RE, targetPath);
      }
    }
  }
});

// ── Cov: Build Prompt — UI guidance and constraints ────────────────────────

const reactUi = { framework: 'react', testingLibrary: '@testing-library/react', userEvent: true, jestDom: true, domEnv: true };

test('Build Prompt: UI guidance appears only for components in a repo that has a UI framework', () => {
  const jsxInUiRepo = covBuildPrompt(gaps({ ui: reactUi }), 'src/Cart.tsx');
  assert.match(jsxInUiRepo.system, /UI COMPONENT \(react\)/, '.tsx in a react repo is a component');

  const importInUiRepo = covBuildPrompt(gaps({ ui: reactUi, source: 'import { useState } from "react";\n' }), 'src/useCart.ts');
  assert.match(importInUiRepo.system, /UI COMPONENT \(react\)/, 'a react import makes a .ts file a component');

  const plainInUiRepo = covBuildPrompt(gaps({ ui: reactUi }), 'src/cart.ts');
  assert.ok(!plainInUiRepo.system.includes('UI COMPONENT'), 'plain logic gets no component rules even in a UI repo');

  // detectUi() returns null when the repo has no react/vue/svelte/preact dependency.
  const jsxInPlainRepo = covBuildPrompt(gaps({ ui: null }), 'src/Cart.tsx');
  assert.ok(!jsxInPlainRepo.system.includes('UI COMPONENT'), 'no framework in the repo, no component rules');
});

test('Build Prompt: every UI framework import form the regex covers is recognised', () => {
  for (const fw of ['react', 'vue', 'svelte', 'preact']) {
    const out = covBuildPrompt(gaps({ ui: { framework: fw }, source: `import x from '${fw}';\n` }), 'src/widget.ts');
    assert.match(out.system, new RegExp(`UI COMPONENT \\(${fw}\\)`), fw);
  }
  // Documented limit of the detector (see the report): only the `from '…'` form is
  // matched, and only inside the first 2000 characters of the source.
  const cjs = covBuildPrompt(gaps({ ui: reactUi, source: "const React = require('react');\n" }), 'src/widget.ts');
  assert.ok(!cjs.system.includes('UI COMPONENT'), 'require() imports are NOT detected today');
  const late = covBuildPrompt(gaps({ ui: reactUi, source: '/*' + 'x'.repeat(2100) + "*/\nimport React from 'react';\n" }), 'src/widget.ts');
  assert.ok(!late.system.includes('UI COMPONENT'), 'an import past char 2000 is NOT detected today');
});

test('Build Prompt: component guidance adapts to the libraries the repo actually has', () => {
  const full = covBuildPrompt(gaps({ ui: reactUi }), 'src/Cart.tsx').system;
  assert.ok(full.includes('Render it with @testing-library/react'));
  assert.match(full, /user-event/);
  assert.match(full, /jest-dom matchers/);
  assert.match(full, /Do not snapshot; do not shallow-render/);

  const bare = covBuildPrompt(gaps({ ui: { framework: 'vue' } }), 'src/Cart.tsx').system;
  assert.ok(bare.includes("the repo's established component-testing approach"), 'no testing library, no name invented');
  assert.ok(!bare.includes('user-event'));
  assert.ok(!bare.includes('jest-dom matchers'));
});

test('Build Prompt: team constraints from the rules engine are rendered into the system prompt', () => {
  const out = covBuildPrompt(gaps({ constraints: ['never touch tests/legacy/**', 'use vi.mock, not jest.mock'] }), 'src/cart.ts');
  assert.ok(out.system.includes('\nTeam constraints:\n- never touch tests/legacy/**\n- use vi.mock, not jest.mock'));

  const none = covBuildPrompt(gaps({ constraints: [] }), 'src/cart.ts');
  assert.ok(!none.system.includes('Team constraints'), 'no empty heading when there are no constraints');
});

test('Build Prompt: the shared test rules ride along in every request', () => {
  const out = covBuildPrompt(gaps(), 'src/cart.ts');
  assert.match(out.system, /Tests must be deterministic/);
  assert.match(out.system, /MUST pass against the CURRENT implementation/);
  assert.match(out.system, /Output at most 2 test files/, 'the cap the parser enforces is also stated to the model');
});

// ── Cov: Parse Tests ───────────────────────────────────────────────────────

const plan = (over = {}) => ({
  targetPath: 'test/cart.mac-cov.test.ts',
  existingTestPath: 'test/cart.test.ts',
  existingTestExists: true,
  ...over,
});

test('Parse Tests: a well-formed reply keeps the paths the model chose', () => {
  const out = covParseTests(llm([
    { path: 'test/cart.mac-cov.test.ts', content: content('a') },
    { path: 'tests/unit/cart.spec.tsx', content: content('b') },
  ]), plan());
  assert.deepEqual(out.paths, ['test/cart.mac-cov.test.ts', 'tests/unit/cart.spec.tsx']);
  assert.equal(out.count, 2);
  assert.equal(out.tests[0].content, content('a'), 'content is passed through untouched');
});

test('Parse Tests: at most 2 files survive', () => {
  const out = covParseTests(llm([
    { path: 'test/one.test.ts', content: content('1') },
    { path: 'test/two.test.ts', content: content('2') },
    { path: 'test/three.test.ts', content: content('3') },
    { path: 'test/four.test.ts', content: content('4') },
  ]), plan());
  assert.equal(out.count, 2);
  assert.deepEqual(out.paths, ['test/one.test.ts', 'test/two.test.ts']);
});

test('Parse Tests: a path outside the allowlist is rewritten to the planned target', () => {
  const out = covParseTests(llm([
    { path: 'src/cart.ts', content: content('overwrite the source!') },
    { path: 'README.md', content: content('overwrite the readme!') },
  ]), plan());
  assert.deepEqual(out.paths, ['test/cart.mac-cov.test.ts', 'test/cart.mac-cov-1.test.ts'],
    'the second rewrite gets its own slot so it cannot clobber the first');
});

test('Parse Tests: traversal is rejected, however it is spelled', () => {
  for (const path of ['../evil.test.ts', 'tests/../src/cart.ts', './../../etc/passwd.test.js', 'test/../../x.test.ts']) {
    const out = covParseTests(llm([{ path, content: content() }]), plan());
    assert.equal(out.paths[0], 'test/cart.mac-cov.test.ts', path);
    assert.ok(!out.paths[0].includes('..'));
  }
});

test('Parse Tests: a path the sidecar would refuse to write is rewritten to the planned target', () => {
  // The location half of the allowlist is not enough. repo.writeTestFile ALSO demands
  // /\.[cm]?[jt]sx?$/, so a path like this used to be reported by the node and refused by
  // the sidecar — count said 1, the disk had 0, and "Cov: Run Tests" then ran against a
  // file that was never created.
  const out = covParseTests(llm([{ path: 'tests/fixtures/data.json', content: '{"fixture": true, "n": 1}' }]), plan());
  assert.equal(out.paths[0], 'test/cart.mac-cov.test.ts', 'redirected to a path the sidecar accepts');
});

test('Parse Tests: every path the node emits is one the sidecar will actually write', () => {
  // The node's notion of "test path" must be the sidecar's, not a looser one: anything
  // the node reports and repo.writeTestFile rejects is a file the pipeline counts but
  // never has.
  const hostile = [
    'tests/fixtures/data.json',       // right place, wrong extension
    'test/__snapshots__/cart.snap',
    'spec/README.md',
    '__tests__/cases.yaml',
    'tests/cart',                     // no extension at all
    'test/cart.test.',                // trailing dot, no extension
    'src/cart.ts',                    // not a test location either
  ];
  for (const path of hostile) {
    const out = covParseTests(llm([{ path, content: content() }]), plan());
    assert.match(out.paths[0], SIDECAR_TEST_PATH_RE, path);
    assert.match(out.paths[0], SIDECAR_EXT_RE, path);
  }

  // …and a legitimate path still passes through untouched.
  const good = covParseTests(llm([{ path: 'tests/unit/cart.spec.tsx', content: content() }]), plan());
  assert.equal(good.paths[0], 'tests/unit/cart.spec.tsx');
});

test('Parse Tests: a reply with no path lands on the planned target instead of being wasted', () => {
  // The coverage phase plans a target path exactly like the mutant phase does, and its
  // twin (killParseTest) has always fallen back to it. Dropping the entry threw away a
  // whole generation over a missing field the graph can supply.
  const out = covParseTests(llm([{ content: content('no path at all') }]), plan());
  assert.deepEqual(out.paths, ['test/cart.mac-cov.test.ts']);
  assert.equal(out.count, 1);
  assert.equal(out.tests[0].content, content('no path at all'), 'the content is still the model\'s');

  // A null, blank or non-string path is the same situation as a missing one.
  for (const path of [null, undefined, '', '   ', 42, {}]) {
    const one = covParseTests(llm([{ path, content: content() }]), plan());
    assert.deepEqual(one.paths, ['test/cart.mac-cov.test.ts'], JSON.stringify(path));
  }

  // Two path-less entries still get one slot each, so the second cannot clobber the first.
  const two = covParseTests(llm([{ content: content('a') }, { content: content('b') }]), plan());
  assert.deepEqual(two.paths, ['test/cart.mac-cov.test.ts', 'test/cart.mac-cov-1.test.ts']);
  assert.equal(two.tests[1].content, content('b'));
});

test('Parse Tests: a leading ./ or / is stripped so the path stays repo-relative', () => {
  const out = covParseTests(llm([
    { path: './tests/cart.test.ts', content: content('a') },
    { path: '/tests/other.test.ts', content: content('b') },
  ]), plan());
  assert.deepEqual(out.paths, ['tests/cart.test.ts', 'tests/other.test.ts']);
});

test('Parse Tests: the repo\'s own test file is never overwritten', () => {
  const out = covParseTests(llm([{ path: 'test/cart.test.ts', content: content('rewrite of yours') }]), plan());
  assert.equal(out.paths[0], 'test/cart.mac-cov.test.ts', 'redirected away from the existing test');

  // If the guessed test path does NOT exist yet there is nothing to destroy, so the
  // model is allowed to create it.
  const fresh = covParseTests(llm([{ path: 'test/cart.test.ts', content: content() }]), plan({ existingTestExists: false }));
  assert.equal(fresh.paths[0], 'test/cart.test.ts');
});

test('Parse Tests: empty, whitespace and stub content is dropped', () => {
  const out = covParseTests(llm([
    { path: 'test/a.test.ts', content: '' },
    { path: 'test/b.test.ts', content: '   \n\t  ' },
    { path: 'test/c.test.ts', content: '// todo' },          // 7 chars — below the floor
    { path: 'test/d.test.ts', content: content('real') },
  ]), plan());
  assert.equal(out.count, 1, 'only the real file survives');
  assert.equal(out.paths[0], 'test/d.test.ts');
});

test('Parse Tests: a malformed or failed LLM response yields count 0 instead of throwing', () => {
  const empties = [
    { ok: false, error: 'timeout' },
    { ok: true, json: null, text: 'Sure! Here are your tests: ```js ...' },
    { ok: true, json: { tests: 'not-an-array' } },
    { ok: true, json: { tests: null } },
    { ok: true, json: {} },
    { ok: true },
    {},
    // Entries with no CONTENT are junk however they are spelled. An entry with content
    // but no path is not junk any more — it is work, and it goes to the planned target
    // (see "a reply with no path lands on the planned target").
    { ok: true, json: { tests: [null, 42, 'nope', { path: 'test/a.test.ts' }, { path: 'test/b.test.ts', content: null }] } },
  ];
  for (const resp of empties) {
    const out = covParseTests(resp, plan());
    assert.deepEqual(out, { tests: [], paths: [], count: 0 }, JSON.stringify(resp).slice(0, 60));
  }
});

test('BUG Parse Tests: two files with the same path are both reported, so one is silently lost', () => {
  // Both entries pass the allowlist, so both are kept verbatim. /api/test/write-many
  // writes them in order — the second silently overwrites the first — and the pipeline
  // reports count 2 for the single file that exists. "Cov: Parse Repair" then inherits
  // the duplicate as its allowlist and repairs the same path twice.
  const out = covParseTests(llm([
    { path: 'tests/cart.test.ts', content: content('first half') },
    { path: 'tests/cart.test.ts', content: content('second half') },
  ]), plan());
  assert.equal(new Set(out.paths).size, out.paths.length, 'reported paths must be distinct');
  assert.equal(out.count, new Set(out.paths).size, 'count must match the files that will exist');
});

// ── Cov: Build Repair ──────────────────────────────────────────────────────

const parsed = (over = {}) => ({
  tests: [
    { path: 'test/cart.mac-cov.test.ts', content: content('expect(total([])).toBe(1)') },
    { path: 'test/cart.mac-cov-1.test.ts', content: content('expect(total([1])).toBe(9)') },
  ],
  paths: ['test/cart.mac-cov.test.ts', 'test/cart.mac-cov-1.test.ts'],
  count: 2,
  ...over,
});

test('Build Repair: the prompt carries the failure output, our files and the source', () => {
  const fail = { passed: false, summary: 'FAIL test/cart.mac-cov.test.ts\n  expected 1, received 0' };
  const out = covBuildRepair(fail, parsed(), gaps(), 'improving_coverage');

  assert.ok(out.prompt.includes('expected 1, received 0'), 'the runner output is what makes repair possible');
  assert.ok(out.prompt.includes('PATH: test/cart.mac-cov.test.ts'));
  assert.ok(out.prompt.includes('PATH: test/cart.mac-cov-1.test.ts'));
  assert.ok(out.prompt.includes('expect(total([])).toBe(1)'), 'the model gets its own file back');
  assert.ok(out.prompt.includes('SOURCE FILE src/cart.ts'));
  assert.ok(out.prompt.includes('export function total'));
  assert.match(out.system, /Keep the SAME file paths/, 'a repair may not rename anything');
  assert.equal(out.json, true);
  assert.equal(out.maxTokens, 6000);
  assert.equal(out.temperature, 0.2, 'lower than the write pass — this is a correction, not an idea');
  assert.match(out.stageDetail, /repairing/);
});

test('Build Repair: the model is asked for EVERY file back — the graph cannot honour a drop', () => {
  // Follow the sub-graph in generate-workflows.mjs: "Cov: Write Repair" writes only what
  // came back, so a file the model omits is not removed — it stays on disk with its
  // ORIGINAL FAILING content. "Cov: Re-run Tests" is then red by construction and
  // "Cov: Delete Broken Tests" deletes Parse Tests' paths AND Parse Repair's, so the file
  // that WAS repaired dies with the one that was dropped. Dropping is never the better
  // move, so the prompt must not offer it.
  const out = covBuildRepair({ summary: 'FAIL' }, parsed(), gaps(), 'improving_coverage');

  assert.doesNotMatch(out.system, /drop it from the output/i, 'the graph has no way to act on a dropped file');
  assert.match(out.system, /return every file/i, 'the reply must cover every path we wrote');
  assert.match(out.system, /omitting a file does not delete it/i, 'the model is told what a drop really costs');
  assert.match(out.system, /delete that case/i, 'an unfixable assertion is dropped as a CASE, not as a FILE');
  assert.match(out.system, /never an empty file/i, 'a file with no runnable test is red too');

  // The requirement is restated as a checklist the model can count against.
  assert.ok(
    out.prompt.trimEnd().endsWith('all 2 files, on these exact paths: test/cart.mac-cov.test.ts, test/cart.mac-cov-1.test.ts'),
    out.prompt.slice(-160),
  );
  const one = covBuildRepair({ summary: 'FAIL' }, parsed({
    tests: [{ path: 'test/cart.mac-cov.test.ts', content: content() }],
    paths: ['test/cart.mac-cov.test.ts'],
    count: 1,
  }), gaps(), 'improving_coverage');
  assert.ok(one.prompt.trimEnd().endsWith('all 1 file, on these exact paths: test/cart.mac-cov.test.ts'), one.prompt.slice(-160));
});

test('Build Repair: the stage is passed through so the mutant phase can reuse the node', () => {
  assert.equal(covBuildRepair({ summary: '' }, parsed(), gaps(), 'improving_coverage').stage, 'improving_coverage');
  assert.equal(covBuildRepair({ summary: '' }, parsed(), gaps(), 'improving_mutation').stage, 'improving_mutation');
});

test('Build Repair: runner output, test bodies and source are each truncated', () => {
  const summary = 'f'.repeat(3_490) + 'FAIL_KEEP' + 'f'.repeat(200) + 'FAIL_DROP';
  const body = 'c'.repeat(5_990) + 'BODY_KEEP' + 'c'.repeat(200) + 'BODY_DROP';
  const source = 's'.repeat(9_990) + 'SRC_KEEP' + 's'.repeat(200) + 'SRC_DROP';
  const out = covBuildRepair(
    { summary },
    parsed({ tests: [{ path: 'test/cart.mac-cov.test.ts', content: body }], paths: ['test/cart.mac-cov.test.ts'], count: 1 }),
    gaps({ source }),
    'improving_coverage',
  );

  assert.ok(out.prompt.includes('FAIL_KEEP') && !out.prompt.includes('FAIL_DROP'), 'summary cut at 3500');
  assert.ok(out.prompt.includes('BODY_KEEP') && !out.prompt.includes('BODY_DROP'), 'each test file cut at 6000');
  assert.ok(out.prompt.includes('SRC_KEEP') && !out.prompt.includes('SRC_DROP'), 'source cut at 10000');
});

test('Build Repair: a missing summary does not produce the string "undefined"', () => {
  const out = covBuildRepair({ passed: false }, parsed(), gaps(), 'improving_coverage');
  assert.ok(!out.prompt.includes('undefined'));
});

// ── Cov: Parse Repair ──────────────────────────────────────────────────────

const prev = (paths = ['test/cart.mac-cov.test.ts', 'test/cart.mac-cov-1.test.ts']) => ({ paths, count: paths.length });

test('Parse Repair: corrected files come back on the paths they were written to', () => {
  const out = covParseRepair(llm([
    { path: 'test/cart.mac-cov.test.ts', content: content('fixed a') },
    { path: 'test/cart.mac-cov-1.test.ts', content: content('fixed b') },
  ]), prev());
  assert.deepEqual(out.paths, ['test/cart.mac-cov.test.ts', 'test/cart.mac-cov-1.test.ts']);
  assert.equal(out.count, 2);
  assert.ok(out.tests[0].content.includes('fixed a'));
});

test('Parse Repair: the model returning nothing is a normal outcome, not an error', () => {
  const nothings = [
    { ok: false, error: 'model refused' },
    { ok: true, json: { tests: [] } },
    { ok: true, json: null },
    { ok: true, json: { tests: [{ path: 'test/cart.mac-cov.test.ts', content: '   ' }] } },
    {},
  ];
  for (const resp of nothings) {
    const out = covParseRepair(resp, prev());
    assert.deepEqual(out, { tests: [], paths: [], count: 0 }, JSON.stringify(resp).slice(0, 60));
  }
});

test('Parse Repair: a repair may not introduce a new path', () => {
  const out = covParseRepair(llm([
    { path: 'test/somewhere-else.test.ts', content: content('sneaky') },
  ]), prev(['test/cart.mac-cov.test.ts']));
  assert.deepEqual(out.paths, ['test/cart.mac-cov.test.ts'], 'snapped back to the file at the same index');
});

test('Parse Repair: the repair cannot grow past the number of files we wrote', () => {
  // Every entry names a path the first attempt produced, so only the length cap can
  // stop the third one — the "unknown path" guard would let them all through.
  const out = covParseRepair(llm([
    { path: 'test/cart.mac-cov.test.ts', content: content('1') },
    { path: 'test/cart.mac-cov-1.test.ts', content: content('2') },
    { path: 'test/cart.mac-cov.test.ts', content: content('3') },
  ]), prev());
  assert.equal(out.count, 2);

  // A model that invents extra files gets them dropped, not renamed onto a real path.
  const invented = covParseRepair(llm([
    { path: 'test/cart.mac-cov.test.ts', content: content('1') },
    { path: 'test/extra-a.test.ts', content: content('2') },
    { path: 'test/extra-b.test.ts', content: content('3') },
  ]), prev(['test/cart.mac-cov.test.ts']));
  assert.equal(invented.count, 1);
  assert.deepEqual(invented.paths, ['test/cart.mac-cov.test.ts']);
});

test('BUG Parse Repair: a reordered reply writes one file\'s content over another', () => {
  // The model answers with the SECOND file first and invents a name for the other.
  // The known path is kept, the unknown one is snapped to prev.paths[1] — which is the
  // path already taken by entry 0. Both entries now point at the same file: the
  // content meant for "renamed" lands on cart.mac-cov-1.test.ts, and
  // cart.mac-cov.test.ts is never repaired yet is reported as repaired.
  const out = covParseRepair(llm([
    { path: 'test/cart.mac-cov-1.test.ts', content: content('fixed b') },
    { path: 'test/renamed.test.ts', content: content('fixed a') },
  ]), prev());
  assert.equal(new Set(out.paths).size, out.paths.length, 'a repair must not target the same file twice');
});
