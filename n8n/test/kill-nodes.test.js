// UNIT TESTS for the two Code nodes of the mutant loop: "Kill: Build Prompt" and
// "Kill: Parse Test". Every test a PR ships from the mutation phase came out of these
// two functions, so their contract is worth pinning down precisely:
//
//   Kill: Build Prompt  names ONE victim and the ONE file the test must land in
//   Kill: Parse Test    lets exactly ONE file through, and never a path we did not plan
//
// No network, no LLM, no n8n: the node functions are plain modules and are called
// directly with the shapes the graph really feeds them —
//   `t`    = the /api/mutant/next response (sidecar/server.js)
//   `resp` = the /api/llm/chat response
//   `plan` = whatever Kill: Build Prompt returned for this round
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { killBuildPrompt } from '../nodes/kill-build-prompt.js';
import { killParseTest } from '../nodes/kill-parse-test.js';

// ── fixtures ────────────────────────────────────────────────────────────────
// Shaped after the real 'GET /api/mutant/next' payload, not invented.
const mutant = (over = {}) => ({
  id: '42',
  mutator: 'EqualityOperator',
  line: 118,
  column: 27,
  status: 'survived',
  replacement: '<=',
  context: '116| function price(n) {\n117|   if (n === 0) return 0;\n118|   return n * 2;',
  ...over,
});

// `over.mutant` is a PARTIAL mutant merged onto the default one, which is why the
// mutant key is rebuilt after the spread rather than before it.
const target = (over = {}) => ({
  ok: true,
  done: false,
  path: 'src/pricing.ts',
  pickedBy: 'llm',
  killIdea: 'call price(0) and assert it returns 0, not 1',
  source: "export function price(n: number) { return n === 0 ? 0 : n * 2; }",
  testPath: 'test/pricing.test.ts',
  testExists: true,
  existingTest: "import { price } from '../src/pricing';\ntest('doubles', () => {});",
  runner: 'vitest',
  ui: null,
  constraints: ['no snapshot tests'],
  packageJson: 'acme-web (type=module)',
  ...over,
  mutant: mutant(over.mutant),
});

const reactUi = { framework: 'react', testingLibrary: '@testing-library/react', userEvent: true, jestDom: true, domEnv: true };

// how many times `sub` occurs — used to prove the prompt names ONE mutant, not a batch
const occurrences = (s, sub) => s.split(sub).length - 1;

// ── Kill: Build Prompt ──────────────────────────────────────────────────────

test('the prompt names exactly ONE target mutant, with mutator, line:column, replacement and context', () => {
  const p = killBuildPrompt(target()).prompt;
  assert.equal(occurrences(p, 'TARGET MUTANT'), 1, 'one victim per round — never a batch');
  assert.equal(occurrences(p, '  mutator: '), 1);
  assert.equal(occurrences(p, 'the mutation replaces that code with: '), 1);
  assert.match(p, /TARGET MUTANT — kill this one:/);
  assert.match(p, /mutator: EqualityOperator/);
  assert.match(p, /line: 118:27/, 'line AND column, so the model can find it in a long line');
  assert.match(p, /the mutation replaces that code with: "<="/, 'quoted, so whitespace-only replacements stay visible');
  assert.match(p, /SOURCE AROUND THE TARGET:/);
  assert.ok(p.includes('117|   if (n === 0) return 0;'), 'the surrounding source travels with the mutant');
  assert.ok(p.includes('SOURCE FILE: src/pricing.ts'), 'and the file it lives in');
});

test('a replacement that is empty or whitespace is still visible to the model', () => {
  // Stryker deletes code as often as it rewrites it; an unquoted '' would read as
  // "replaces that code with: " and tell the model nothing.
  const p = killBuildPrompt(target({ mutant: { replacement: '' } })).prompt;
  assert.match(p, /the mutation replaces that code with: ""/);
  const q = killBuildPrompt(target({ mutant: { replacement: '\n  ' } })).prompt;
  assert.match(q, /the mutation replaces that code with: "\\n  "/);
});

test('a column is printed when present — including column 0 — and omitted when absent', () => {
  // Absent and zero are different facts. Stryker's columns are 1-based today, so a 0
  // does not occur in practice, but "no column" must be decided by ABSENCE: the day a
  // 0-based producer appears, a falsiness test would silently drop the only piece of
  // information that separates two mutants sharing a line.
  for (const absent of [undefined, null]) {
    const p = killBuildPrompt(target({ mutant: { column: absent } })).prompt;
    assert.match(p, /line: 118\n/);
    assert.ok(!p.includes('line: 118:'), 'no "line: 118:" with nothing after it');
    assert.ok(!/line: 118:(undefined|null)/.test(p), 'and no placeholder word either');
  }
  for (const column of [0, 1, 27]) {
    const p = killBuildPrompt(target({ mutant: { column } })).prompt;
    assert.ok(p.includes('line: 118:' + column + '\n'), `column ${column} is a real position and must be shown`);
  }
});

test('the context section disappears when Stryker gave us no source context', () => {
  const p = killBuildPrompt(target({ mutant: { context: undefined } })).prompt;
  assert.ok(!p.includes('SOURCE AROUND THE TARGET'));
  assert.ok(!p.includes('undefined'), 'an absent section must not become the word "undefined"');
  assert.match(p, /TARGET MUTANT/, 'the rest of the brief is unaffected');
});

test("'survived' and 'nocoverage' get materially different instructions", () => {
  // The two statuses need opposite work: a survivor is already executed and only
  // needs a sharper assertion; a nocoverage mutant is not reached at all.
  const survived = killBuildPrompt(target({ mutant: { status: 'survived' } })).prompt;
  const nocov = killBuildPrompt(target({ mutant: { status: 'nocoverage' } })).prompt;

  assert.match(survived, /status: covered by existing tests, but nothing asserts the difference/);
  assert.match(nocov, /status: not covered at all — your test must reach this code/);

  assert.ok(!survived.includes('not covered at all'), 'a survivor must never be called uncovered');
  assert.ok(!nocov.includes('covered by existing tests'), 'and vice versa');
  assert.notEqual(survived, nocov);
});

// the one "  status: ..." line of the brief, so the mapping can be asserted whole
const statusLine = (status) =>
  killBuildPrompt(target({ mutant: { status } })).prompt.split('\n').find((l) => l.startsWith('  status: '));

test('the status sentence is a lookup keyed by status, not a two-way ternary', () => {
  // sidecar/stryker.js lower-cases Stryker's own PascalCase enum, so both spellings
  // must land on the same sentence — the prompt must not depend on that normalisation
  // happening upstream.
  for (const s of ['survived', 'Survived'])
    assert.equal(statusLine(s), '  status: covered by existing tests, but nothing asserts the difference');
  for (const s of ['nocoverage', 'NoCoverage'])
    assert.equal(statusLine(s), '  status: not covered at all — your test must reach this code');
});

test('any other status is described honestly instead of being called uncovered', () => {
  // The survivor list is filtered to survived+nocoverage TODAY (sidecar/stryker.js).
  // The moment that filter widens — or a mutant arrives from anywhere else — an
  // "everything else means nocoverage" ternary starts telling the model a falsehood
  // about its target, and a model told "not covered at all" writes a reach-the-code
  // test instead of a discriminating assertion. Every status Stryker can emit:
  for (const status of ['timeout', 'runtimeerror', 'compileerror', 'ignored', 'pending', 'killed']) {
    const line = statusLine(status);
    assert.ok(line, `a status line is still printed for ${status}`);
    assert.ok(line.includes(status), `the raw status travels with it: ${line}`);
    assert.ok(!line.includes('not covered at all'), `${status} is not known to be uncovered`);
    assert.ok(!line.includes('covered by existing tests'), `${status} is not known to be covered`);
  }
});

test('a status that names an Object.prototype member gets the fallback, not a prototype member', () => {
  // The status string comes from a JSON report; looking it up in a plain object hands
  // 'constructor' back a function and '__proto__' back Object.prototype, either of
  // which would be concatenated into the prompt as text.
  for (const status of ['constructor', '__proto__', 'hasOwnProperty']) {
    const line = statusLine(status);
    assert.ok(line.includes('unknown'), `${status} must fall through to the honest fallback: ${line}`);
    assert.ok(!line.includes('function') && !line.includes('[object'), `no prototype member leaked: ${line}`);
  }
});

test('a missing status yields a usable sentence, never "undefined"', () => {
  for (const status of [undefined, null, '']) {
    const line = statusLine(status);
    assert.ok(line, `a status line is still printed for ${JSON.stringify(status)}`);
    assert.ok(!/undefined|null/.test(line), `no placeholder word in: ${line}`);
    assert.ok(!line.includes('not covered at all'), 'an unknown status is not a coverage claim');
    assert.ok(!line.includes('covered by existing tests'));
    assert.ok(killBuildPrompt(target({ mutant: { status } })).prompt.includes('TARGET MUTANT'),
      'and the rest of the brief is unaffected');
  }
});

test('the kill idea from the mutant pick is handed to the test writer', () => {
  const p = killBuildPrompt(target({ killIdea: 'assert price(0) === 0' })).prompt;
  assert.match(p, /HOW TO KILL IT \(from the analysis that selected this mutant\):/);
  assert.ok(p.includes('assert price(0) === 0'));
});

test('the prompt is still complete when no kill idea was recorded', () => {
  // A heuristic pick (single candidate, or an unusable LLM answer) sends killIdea: ''.
  for (const killIdea of ['', undefined]) {
    const p = killBuildPrompt(target({ killIdea })).prompt;
    assert.ok(!p.includes('HOW TO KILL IT'), 'no empty section header');
    assert.ok(!p.includes('undefined'));
    assert.match(p, /TARGET MUTANT/);
    assert.match(p, /status: covered by existing tests/);
    assert.match(p, /Write the single test file that kills this mutant\. JSON only\.$/);
  }
});

test('the existing test file rides along as a style reference, marked do-not-rewrite', () => {
  const p = killBuildPrompt(target()).prompt;
  assert.match(p, /EXISTING TEST FILE \(test\/pricing\.test\.ts, style reference — do not rewrite it\):/);
  assert.ok(p.includes("import { price } from '../src/pricing';"));
});

test('a file with no existing test says so instead of pasting "null"', () => {
  const p = killBuildPrompt(target({ existingTest: null, testExists: false })).prompt;
  assert.ok(p.includes('(none)'));
  assert.ok(!p.includes('null'));
});

test('the target test path encodes the victim, so two attempts land in different files', () => {
  const first = killBuildPrompt(target({ mutant: { line: 42, mutator: 'EqualityOperator' } }));
  const second = killBuildPrompt(target({ mutant: { line: 88, mutator: 'BooleanLiteral' } }));

  assert.match(first.targetPath, /^test\/pricing\.kill-L42-equalityoperator-[a-z0-9]+\.test\.ts$/);
  assert.match(second.targetPath, /^test\/pricing\.kill-L88-booleanliteral-[a-z0-9]+\.test\.ts$/);
  assert.notEqual(first.targetPath, second.targetPath, 'a failed attempt must be droppable on its own');
  assert.match(first.targetPath, /kill-L42-[a-z-]+-/, 'mutator lower-cased — paths are compared literally downstream');
  // the trailing discriminator is a hash of the mutant identity, so it must be stable:
  // the same mutant asked for twice has to land in the same file, or the repair turn
  // and the drop() that follows a failure would be aiming at different paths
  assert.equal(first.targetPath, killBuildPrompt(target({ mutant: { line: 42, mutator: 'EqualityOperator' } })).targetPath);
});

test('the target path is never the repo\'s own test file', () => {
  // Kill: Verify deletes every path Kill: Parse Test returned when the attempt fails,
  // so planning to write into the repo's existing test file would delete it.
  const plan = killBuildPrompt(target());
  assert.notEqual(plan.targetPath, 'test/pricing.test.ts');
  assert.ok(plan.targetPath.startsWith('test/pricing.kill-L'));
});

test('the target path keeps the source file extension and the existing test folder', () => {
  const cases = [
    // [source path, existing test path, expected target path]
    // [source path, existing test path, expected prefix, expected extension]
    ['src/pricing.ts', 'test/pricing.test.ts', 'test/pricing.kill-L118-equalityoperator-', '.test.ts'],
    ['src/Widget.tsx', 'src/__tests__/Widget.test.tsx', 'src/__tests__/Widget.kill-L118-equalityoperator-', '.test.tsx'],
    ['src/util.mjs', 'tests/util.spec.mjs', 'tests/util.kill-L118-equalityoperator-', '.test.mjs'],
    ['lib/legacy.cjs', 'tests/unit/legacy.test.cjs', 'tests/unit/legacy.kill-L118-equalityoperator-', '.test.cjs'],
    ['src/thing.js', 'src/thing.test.js', 'src/thing.kill-L118-equalityoperator-', '.test.js'],
  ];
  for (const [path, testPath, prefix, ext] of cases) {
    const got = killBuildPrompt(target({ path, testPath })).targetPath;
    assert.ok(got.startsWith(prefix), `${path}: ${got} should start with ${prefix}`);
    assert.ok(got.endsWith(ext), `${path}: ${got} should end with ${ext}`);
  }
});

test('an extension we do not recognise falls back to .ts rather than producing a broken name', () => {
  const plan = killBuildPrompt(target({ path: 'src/Widget.vue', testPath: 'test/Widget.test.ts' }));
  assert.match(plan.targetPath, /^test\/Widget\.kill-L118-equalityoperator-[a-z0-9]+\.test\.ts$/);
});

test('the system prompt fixes the target path the model must use', () => {
  const plan = killBuildPrompt(target());
  assert.ok(plan.system.includes('{"tests":[{"path":"' + plan.targetPath + '","content":"full test file content"}]}'),
    'the plan and the reply template must agree, or every reply gets rewritten');
  assert.match(plan.system, /Write EXACTLY ONE vitest test file/, 'the runner comes from the repo, not a guess');
  assert.match(plan.system, /killed when a test FAILS on the mutated code while PASSING on the real code/,
    'the definition of a kill is the whole job — it must be stated');
});

test('the plan carries the routing metadata the rest of the graph reads', () => {
  const plan = killBuildPrompt(target({ mutant: { mutator: 'BooleanLiteral', line: 7 } }));
  assert.equal(plan.json, true);
  // this is a thinking call, so the reasoning channel and the test file share the
  // budget — 4000 truncated real test files mid-JSON
  assert.equal(plan.maxTokens, 9000);
  assert.equal(plan.temperature, 0.2);
  assert.equal(plan.stage, 'improving_mutation');
  assert.equal(plan.stageDetail, 'writing a test to kill BooleanLiteral at line 7');
  assert.deepEqual(Object.keys(plan).sort(),
    ['existingTestExists', 'existingTestPath', 'json', 'maxTokens', 'prompt', 'stage', 'stageDetail',
      'system', 'targetPath', 'temperature', 'thinking'].sort());
});

test('team constraints are listed, and their section vanishes when there are none', () => {
  const withRules = killBuildPrompt(target({ constraints: ['no network in tests', 'no fake timers'] })).system;
  assert.match(withRules, /\nTeam constraints:\n- no network in tests\n- no fake timers$/);

  for (const constraints of [[], undefined]) {
    assert.ok(!killBuildPrompt(target({ constraints })).system.includes('Team constraints'));
  }
});

test('a component file gets component-testing guidance in the system prompt', () => {
  const s = killBuildPrompt(target({ path: 'src/Widget.tsx', testPath: 'src/Widget.test.tsx', ui: reactUi })).system;
  assert.match(s, /This file is a UI COMPONENT \(react\)\./);
  assert.match(s, /Render it with @testing-library\/react/);
  assert.match(s, /Prefer accessible queries \(getByRole, getByLabelText, getByText\)/);
  assert.match(s, /@testing-library\/user-event/);
  assert.match(s, /jest-dom matchers/);
  assert.match(s, /Do not snapshot; do not shallow-render/);
});

test('a non-component file in a UI repo gets no component guidance', () => {
  // A React repo is full of plain modules; component rules there are noise that
  // pushes the model towards rendering things that cannot be rendered.
  const s = killBuildPrompt(target({ ui: reactUi })).system;
  assert.ok(!s.includes('UI COMPONENT'));
});

test('a non-.tsx module that imports react is still treated as a component', () => {
  const s = killBuildPrompt(target({
    path: 'src/useThing.ts', testPath: 'test/useThing.test.ts', ui: reactUi,
    source: "import { useState } from 'react';\nexport function useThing() {}",
  })).system;
  assert.match(s, /This file is a UI COMPONENT \(react\)/);

  // The mutant loop hand-builds the { ui, source } shape the detector reads, so the
  // less obvious import forms are worth proving through THIS node and not only
  // through uiGuidance directly (n8n/test/ui-guidance.test.js owns the full set).
  const cjs = killBuildPrompt(target({
    path: 'src/widget.js', testPath: 'test/widget.test.js', ui: reactUi,
    source: '/* ' + 'licence '.repeat(300) + " */\nconst { useState } = require('react');\n",
  })).system;
  assert.match(cjs, /This file is a UI COMPONENT \(react\)/, 'CommonJS, behind a long licence header');

  const mentionOnly = killBuildPrompt(target({
    path: 'src/pricing.ts', testPath: 'test/pricing.test.ts', ui: reactUi,
    source: "// the react version of this lived in src/Price.tsx\nexport const x = 1;\n",
  })).system;
  assert.ok(!mentionOnly.includes('UI COMPONENT'), 'a comment that names react is not a component');
});

test('component guidance degrades gracefully when the repo has no testing library', () => {
  const s = killBuildPrompt(target({
    path: 'src/Widget.tsx', testPath: 'src/Widget.test.tsx',
    ui: { framework: 'svelte', testingLibrary: null, userEvent: false, jestDom: false },
  })).system;
  assert.match(s, /Render it with the repo's established component-testing approach/);
  assert.ok(!s.includes('user-event'), 'never advertise a dependency the repo does not have');
  assert.ok(!s.includes('jest-dom'));
});

test('a very large source file is truncated at 12000 chars, leaving the brief intact', () => {
  // The mutant brief lives AFTER the source in the prompt: if truncation ever moved,
  // a big file would push the target mutant out of the request entirely.
  const source = 'K'.repeat(11990) + 'INSIDE' + 'D'.repeat(4) + 'OUTSIDE_THE_LIMIT';
  const p = killBuildPrompt(target({ source })).prompt;
  assert.ok(p.includes('INSIDE'), 'everything up to the limit is kept');
  assert.ok(!p.includes('OUTSIDE_THE_LIMIT'), 'and nothing past it');
  assert.match(p, /TARGET MUTANT/, 'the mutant brief survives truncation');
  assert.match(p, /Write the single test file that kills this mutant\. JSON only\.$/);
});

test('a huge existing test file is truncated at 4000 chars', () => {
  const existingTest = 'E'.repeat(3985) + 'INSIDE_TEST' + 'F'.repeat(4) + 'OUTSIDE_TEST_LIMIT';
  const p = killBuildPrompt(target({ existingTest })).prompt;
  assert.ok(p.includes('INSIDE_TEST'));
  assert.ok(!p.includes('OUTSIDE_TEST_LIMIT'));
});

test('a missing source does not blow up the prompt', () => {
  // readFileSafe returns null for an unreadable file; the brief still has to go out.
  const p = killBuildPrompt(target({ source: null })).prompt;
  assert.match(p, /SOURCE FILE: src\/pricing\.ts/);
  assert.match(p, /TARGET MUTANT/);
  assert.ok(!p.includes('null'));
});

// ── Kill: Parse Test ────────────────────────────────────────────────────────

const plan = killBuildPrompt(target());              // targetPath test/pricing.kill-L118-equalityoperator.test.ts
const reply = (tests) => ({ ok: true, json: { tests } });
const content = (n) => `import { price } from '../src/pricing';\n// attempt ${n}\n`;

test('exactly one test file survives, even when the model returns three', () => {
  const out = killParseTest(reply([
    { path: plan.targetPath, content: content(1) },
    { path: 'test/extra-a.test.ts', content: content(2) },
    { path: 'test/extra-b.test.ts', content: content(3) },
  ]), plan);

  assert.equal(out.count, 1, 'one mutant, one file — a second could never be attributed');
  assert.deepEqual(out.paths, [plan.targetPath]);
  assert.equal(out.tests[0].content, content(1), 'the first usable file wins');
});

test('a path the sidecar would refuse is rewritten to the planned target', () => {
  for (const bad of ['src/pricing.ts', 'README.md', 'src/notes.txt', '']) {
    const out = killParseTest(reply([{ path: bad, content: content(1) }]), plan);
    assert.deepEqual(out.paths, [plan.targetPath], `rewrote ${JSON.stringify(bad)}`);
  }
});

test('a missing path falls back to the planned target instead of dropping the test', () => {
  const out = killParseTest(reply([{ content: content(1) }]), plan);
  assert.equal(out.count, 1, 'a good test must not be thrown away over a missing field');
  assert.deepEqual(out.paths, [plan.targetPath]);
});

test("a path containing '..' is rejected however it is dressed up", () => {
  for (const bad of ['../../etc/evil.test.ts', 'test/../../evil.test.ts', 'tests/a/../../../x.test.ts', './test/../evil.test.ts']) {
    const out = killParseTest(reply([{ path: bad, content: content(1) }]), plan);
    assert.deepEqual(out.paths, [plan.targetPath], `rejected ${bad}`);
  }
});

test('a path the model proposes is recorded nowhere — the plan decides', () => {
  // This once asserted the opposite: that a model path which looked like a test file
  // was honoured, with a leading ./ stripped. A live run showed why that is wrong —
  // see the planned-path test below. Kept as its inverse rather than deleted, because
  // the behaviour it describes is the one a future change is most likely to restore.
  const out = killParseTest(reply([{ path: './tests/unit/quote.spec.ts', content: content(1) }]), plan);
  assert.deepEqual(out.paths, [plan.targetPath]);
  assert.equal(out.count, 1, 'the CONTENT is still used — only the path is ours');
  assert.equal(out.tests[0].content, content(1), 'passed through byte for byte');
});

test('empty, blank or stub content is dropped', () => {
  for (const bad of ['', '   ', '\n\n', 'too short', 42, null, undefined]) {
    const out = killParseTest(reply([{ path: plan.targetPath, content: bad }]), plan);
    assert.equal(out.count, 0, `dropped ${JSON.stringify(bad)}`);
    assert.deepEqual(out.paths, []);
  }
});

test('an empty first entry does not consume the single slot', () => {
  // Filtering before slicing is what makes this work: a model that opens with a
  // placeholder must not cost us the round.
  const out = killParseTest(reply([
    { path: plan.targetPath, content: '' },
    { path: plan.targetPath, content: content(2) },
  ]), plan);
  assert.equal(out.count, 1);
  assert.equal(out.tests[0].content, content(2));
});

test('a malformed response yields count 0 and paths [], never a throw', () => {
  const malformed = [
    { ok: false, error: 'rate limited' },
    { ok: true, json: null },
    { ok: true },
    { ok: true, json: {} },
    { ok: true, json: { tests: 'a test file, honest' } },
    { ok: true, json: { tests: null } },
    { ok: true, json: { tests: [] } },
    { ok: true, json: { tests: [null, undefined, 'nope', 7] } },
    { ok: false, json: { tests: [{ path: plan.targetPath, content: content(1) }] } },  // ok:false wins
    {},
  ];
  for (const resp of malformed) {
    const out = killParseTest(resp, plan);
    assert.deepEqual(out, { tests: [], paths: [], count: 0 }, JSON.stringify(resp));
  }
});

test('content is passed through byte for byte', () => {
  // Kill: Write Test writes exactly what comes out of here; any normalisation would
  // silently change the test the model reasoned about.
  const raw = "  import x from 'y';\r\n\tconst s = '\\u00e9';\n\n";
  const out = killParseTest(reply([{ path: plan.targetPath, content: raw }]), plan);
  assert.equal(out.tests[0].content, raw);
});

test('paths always mirrors tests, since Kill: Verify deletes by path', () => {
  const out = killParseTest(reply([{ path: 'test/somewhere.test.ts', content: content(1) }]), plan);
  assert.equal(out.count, out.tests.length);
  assert.deepEqual(out.paths, out.tests.map((t) => t.path));
});

// ── production bugs: these FAIL on purpose. Do not "fix" the tests. ──────────

test('BUG (unfixed): two different mutants on one line share a target path', () => {
  // Stryker routinely emits several distinct mutants at the same line and mutator —
  // ConditionalExpression alone produces a `true` and a `false` variant in the same
  // place, and `a === 1 && b === 2` gives two EqualityOperator mutants. mutantKey()
  // in sidecar/mutants.js separates them by column AND replacement, so the loop will
  // attack both, in different rounds. killBuildPrompt names the file from line +
  // mutator only, so round two plans the SAME path as round one: Kill: Write Test
  // overwrites the test that killed the first mutant, and if round two fails,
  // Kill: Verify's drop() deletes it. A verified kill is lost with no diagnostic.
  const twin = (over) => killBuildPrompt(target({
    mutant: { line: 42, mutator: 'ConditionalExpression', status: 'survived', ...over },
  })).targetPath;

  assert.notEqual(
    twin({ column: 9, replacement: 'true' }),
    twin({ column: 9, replacement: 'false' }),
    'distinct mutants must not plan the same test file — include column/replacement in the name',
  );
  assert.notEqual(
    twin({ column: 5, replacement: '<=' }),
    twin({ column: 20, replacement: '<=' }),
    'same line and mutator, different column: still two different mutants',
  );
});

test("BUG (unfixed): the model can overwrite the repo's own test file", () => {
  // killParseTest's safety check only asks "does this look like a test path?" — and
  // the repo's existing test file passes. A model that echoes the testPath printed in
  // the prompt ("EXISTING TEST FILE (test/pricing.test.ts ...)") instead of the
  // target path gets its content written over the repo's real tests, and those tests
  // are DELETED outright by Kill: Verify's drop() if the kill attempt fails.
  // The coverage-phase twin (covParseTests) guards this with plan.existingTestPath;
  // the kill plan does not even carry that field, so the parser cannot defend itself.
  const out = killParseTest(reply([{ path: 'test/pricing.test.ts', content: content(1) }]), plan);
  assert.deepEqual(out.paths, [plan.targetPath],
    "a reply aimed at the repo's existing test file must be redirected to the target path");
});

test('BUG (unfixed): the kill system prompt authorises a second test file it will discard', () => {
  // The prompt says "Write EXACTLY ONE test file" and shows a one-entry JSON template,
  // then the shared rule block ends with "Output at most 2 test files". killParseTest
  // slices to 1, so a model that follows the second instruction pays for a file that
  // is silently thrown away — and, worse, the file it kept may be the throwaway.
  const s = killBuildPrompt(target()).system;
  assert.match(s, /EXACTLY ONE/);
  assert.ok(!/at most 2 test files/.test(s),
    'the kill prompt must not also tell the model it may return two files');
});

test('a path the sidecar would refuse to write is rewritten to the planned target', () => {
  // The node's allowlist and repo.writeTestFile's must agree. writeTestFile requires
  // BOTH a test-shaped path (sidecar/repo.js TEST_PATH_RE) and a js/ts extension;
  // the node only checked the first, so `tests/fixtures/data.json` was reported as a
  // written test and refused on disk. The coverage twin already applies both halves.
  for (const bad of ['tests/fixtures/data.json', 'test/__snapshots__/cart.snap', 'spec/README.md', 'tests/cart']) {
    const out = killParseTest(reply([{ path: bad, content: content(1) }]), plan);
    assert.deepEqual(out.paths, [plan.targetPath], `${bad} must not be reported as written`);
  }
});

// ── two-phase kill ──────────────────────────────────────────────────────────
// The same prompt, asked cheaply first. Measured on a prompt taken from the run's own
// dialog log: 21-28s without reasoning, 112-186s with it, and on everything that could
// be checked mechanically the cheap answer was no worse. So reasoning is spent only on
// the mutants that survive the cheap attempt.

test('the cheap attempt asks the endpoint not to think, and says so in the stage detail', () => {
  const plan = killBuildPrompt(target(), { thinking: false });
  assert.equal(plan.thinking, false);
  assert.match(plan.stageDetail, /without reasoning|cheap|fast/i,
    'the dashboard should show which of the two attempts is running');
});

test('the thinking attempt is the default, and is what an escalation asks for', () => {
  assert.equal(killBuildPrompt(target()).thinking, undefined, 'unspecified means the endpoint default');
  assert.equal(killBuildPrompt(target(), { thinking: true }).thinking, true);
});

test('both attempts plan the SAME file — the cheap one was deleted when it failed', () => {
  assert.equal(killBuildPrompt(target(), { thinking: false }).targetPath,
    killBuildPrompt(target(), { thinking: true }).targetPath);
});

test('the escalated prompt tells the model the cheap attempt already failed', () => {
  const plan = killBuildPrompt(target(), { thinking: true, escalated: true });
  assert.match(plan.prompt, /already failed|previous attempt|did not kill/i,
    'otherwise it is likely to write the same test again');
});

test('the kill test always lands on the planned path, never one the model chose', () => {
  // Live evidence: a run produced `admin-page-data.kill-L82-booleanliteral.test.ts`
  // among nine siblings that all carry a mutant-identity hash. The model proposed that
  // path itself and the parser accepted it, because it is test-shaped and js/ts — which
  // walks straight back into the collision this naming exists to prevent. Two mutants
  // on one line proposing the same name would overwrite each other's verified kill, and
  // the repo-owned guard does not help: it protects tests that existed before the run,
  // not the ones this run just wrote.
  //
  // There is nothing the model knows about placement that we do not: the planned path
  // is derived from the repo's own convention and the mutant's full identity.
  const cases = [
    'tests/unit/a.kill-L82-booleanliteral.test.ts',   // plausible, and exactly the hazard
    'test/somewhere-else.test.ts',
    './test/relative.test.ts',
    'src/__tests__/nested.test.tsx',
  ];
  for (const p of cases) {
    const out = killParseTest(reply([{ path: p, content: content(1) }]), plan);
    assert.deepEqual(out.paths, [plan.targetPath], `${p} must be redirected to the planned path`);
  }
});

// ── the escalation is told WHY the cheap attempt failed ─────────────────────
//
// Live evidence from lib/api-schemas/models/allocation.ts: 14 tests written in one
// round, 13 of them red against the UNMUTATED code, 0 kills, 25 minutes. Every
// escalation was told only "a previous attempt already failed" — never the runner
// output — so it rebuilt the same mocks and made the same mistake. The error text was
// sitting in the verify response the whole time, unused.

// The MODEL-side claim — that being shown the error actually changes the answer — is
// prompt-tests/generated-test-quality.prompt.test.mjs. This one only proves the text
// reaches the prompt, which is what a fast offline test can honestly assert.
test('an escalation carries the runner output that killed the previous attempt', () => {
  const failure = "FAIL tests/unit/a.kill-L4.test.ts\n  Error: Cannot find module '@/lib/db'\n    at <anonymous>";
  const plan = killBuildPrompt(target(), { thinking: true, escalated: true, failure });

  assert.match(plan.prompt, /Cannot find module/, 'the model cannot fix what it is not shown');
  assert.match(plan.prompt, /did not run|failed against|error/i, 'and it must be labelled as the failure, not as context');
});

test('an escalation after a test that RAN but killed nothing says so instead', () => {
  // Two different failures need two different instructions: a test that would not run
  // is a mocking problem, a test that ran and killed nothing is an assertion problem.
  const plan = killBuildPrompt(target(), { thinking: true, escalated: true });

  assert.doesNotMatch(plan.prompt, /Cannot find module/);
  assert.match(plan.prompt, /already failed|did not kill|survived/i);
});

test('a long failure summary is truncated, not pasted whole', () => {
  const failure = 'FAIL something\n'.repeat(500);
  const plan = killBuildPrompt(target(), { thinking: true, escalated: true, failure });

  const section = plan.prompt.slice(plan.prompt.indexOf('FAIL something'));
  assert.ok(section.length < 3000, `a 7KB stack trace crowds out the source: ${section.length}ch`);
});
