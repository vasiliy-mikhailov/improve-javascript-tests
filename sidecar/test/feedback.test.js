'use strict';
// UNIT TESTS for the feedback store.
//
// GEPA needs the whole triple to reflect on: the PROMPT that was sent, the TEST that
// came back, the measured OUTCOME, and what a human thought of it. Storing only the
// verdict ("too many mocks") is useless — the point is to tie that judgement to the
// exact prompt that produced the thing being judged, so a prompt can be evolved against
// it. The file lives in the TARGET repo's root, not our data dir, so it is versioned
// with the code it describes, reviewable in a PR, and still there on a fresh clone.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withSandbox, feedback, repo } = require('./helpers/env');
const fs = require('node:fs');
const path = require('node:path');

const gen = (over = {}) => ({
  file: 'lib/foo.ts',
  testPath: 'tests/unit/foo.mac.test.ts',
  generator: 'kill-batch',
  prompt: { system: 'You are an expert test engineer...', user: 'kill these mutants...', model: 'qwen', thinking: false },
  source: 'export const f = (a) => a > 1;\n',
  test: "import { it, expect } from 'vitest';\nit('f', () => { expect(f(2)).toBe(true); });\n",
  outcome: { suiteGreen: true, mutantsKilled: 3, aimedAt: 5, macBefore: 0, macAfter: 42.5, kept: true },
  ...over,
});

test('a generation record keeps the prompt, the code, the test and the outcome together',
  () => withSandbox(async (sb) => {
    await sb.start();
    const id = feedback.recordGeneration(gen());
    assert.ok(id, 'a record must be addressable, or feedback has nothing to attach to');

    const stored = JSON.parse(fs.readFileSync(path.join(sb.repoDir, 'improve-tests.json'), 'utf8'));
    assert.equal(stored.version, 1);
    const r = stored.records.find((x) => x.id === id);
    assert.equal(r.file, 'lib/foo.ts');
    assert.match(r.prompt.system, /expert test engineer/, 'the prompt is the thing GEPA evolves');
    assert.match(r.source, /a > 1/, 'the code the prompt was shown');
    assert.match(r.test, /expect\(f\(2\)\)/, 'and what came back');
    assert.equal(r.outcome.mutantsKilled, 3, 'with the reward signal attached');
    assert.deepEqual(r.feedback, [], 'human feedback arrives later');
  }));

test('feedback attaches to the record it is about', () => withSandbox(async (sb) => {
  await sb.start();
  const id = feedback.recordGeneration(gen());

  feedback.addFeedback({ id, text: "i don't like too many mocks in these tests", author: 'vasiliy' });

  const r = feedback.load().records.find((x) => x.id === id);
  assert.equal(r.feedback.length, 1);
  assert.match(r.feedback[0].text, /too many mocks/);
  assert.equal(r.feedback[0].author, 'vasiliy');
  assert.ok(r.feedback[0].ts, 'when it was said matters when prompts change under it');
}));

test('feedback can be given by test path, because that is what a human is looking at',
  () => withSandbox(async (sb) => {
    await sb.start();
    feedback.recordGeneration(gen());
    const n = feedback.addFeedback({ testPath: 'tests/unit/foo.mac.test.ts', text: 'too many mocks' });
    assert.equal(n, 1);
    assert.equal(feedback.load().records[0].feedback[0].text, 'too many mocks');
  }));

test('mock-versus-real assertion counts are measured, not left to the reader',
  () => withSandbox(async (sb) => {
    // "too many mocks" should be checkable against a number, or a prompt cannot be
    // scored against the complaint
    await sb.start();
    const id = feedback.recordGeneration(gen({
      test: "import { vi, it, expect } from 'vitest';\n"
        + "const save = vi.fn();\nvi.mock('../db');\n"
        + "it('calls save', () => { f(); expect(save).toHaveBeenCalledWith(1); });\n"
        + "it('returns', () => { expect(f(2)).toBe(true); });\n",
    }));
    const r = feedback.load().records.find((x) => x.id === id);
    assert.ok(r.signals.mockSetup >= 2, `mock setup lines: ${r.signals.mockSetup}`);
    assert.equal(r.signals.mockAssertions, 1);
    assert.equal(r.signals.realAssertions, 1);
  }));

test('records with human feedback are never evicted by the size cap', () => withSandbox(async (sb) => {
  // the cap keeps the file reviewable, but a judged example is the scarce thing here
  await sb.start();
  const keep = feedback.recordGeneration(gen({ file: 'lib/keep.ts' }));
  feedback.addFeedback({ id: keep, text: 'this one is good' });
  for (let i = 0; i < feedback.MAX_UNJUDGED + 5; i++) feedback.recordGeneration(gen({ file: `lib/f${i}.ts` }));

  const all = feedback.load().records;
  assert.ok(all.some((r) => r.id === keep), 'a judged record was thrown away');
  assert.ok(all.length <= feedback.MAX_UNJUDGED + 1);
}));

test('a corrupt or hand-edited file never crashes a run', () => withSandbox(async (sb) => {
  await sb.start();
  fs.mkdirSync(sb.repoDir, { recursive: true });
  fs.writeFileSync(path.join(sb.repoDir, 'improve-tests.json'), '{ this is not json');
  assert.deepEqual(feedback.load().records, [], 'a team may edit this file by hand');
  assert.ok(feedback.recordGeneration(gen()), 'and the run continues either way');
}));

// ── capture happens automatically, or the corpus is always empty ─────────────
// Nobody will paste a prompt into a file by hand. The sidecar sees every model call and
// every verification, so it can pair them itself: the prompt that was sent for the file
// currently being improved, the test that came back, and how that test then scored.
const { sandbox } = require('./helpers/env');
const { routes } = require('./helpers/env').sidecar || {};

test('a kept test is recorded with the prompt that produced it', () => withSandbox(async (sb) => {
  const w = require('./helpers/fakes').installFakes(sb);
  await sb.start();
  w.addFile({ path: 'src/a.ts', existingTest: 'test/a.test.ts', coverageWithTests: 80,
    mutants: [{ line: 10 }, { line: 20 }] });
  await sb.post('/api/coverage/run', { phase: 'baseline' });
  await sb.post('/api/iteration/start', { file: 'src/a.ts' });
  await sb.post('/api/stryker/run', { file: 'src/a.ts', phase: 'baseline' });
  const target = (await sb.get('/api/mutant/next', { path: 'src/a.ts' })).mutant;

  // the model call the graph makes before writing anything
  w.llm.replyJson({ tests: [{ content: 'x' }] });
  await sb.post('/api/llm/chat', {
    system: 'You are an expert test engineer', prompt: 'kill this mutant', json: true,
    stage: 'improving_mutation',
  });
  w.writeTest('test/a-kill.test.ts', { target: 'src/a.ts', kills: [target.line] });
  await sb.post('/api/mutant/verify', { file: 'src/a.ts', mutant: target, testPaths: ['test/a-kill.test.ts'], phase: 'batch' });

  const recs = feedback.load().records;
  assert.equal(recs.length, 1, `expected one generation record, got ${recs.length}`);
  assert.equal(recs[0].file, 'src/a.ts');
  assert.equal(recs[0].testPath, 'test/a-kill.test.ts');
  assert.match(recs[0].prompt.system, /expert test engineer/, 'the prompt must travel with the test');
  assert.match(recs[0].test, /describe|it\(/, 'and the test content itself');
  assert.equal(recs[0].outcome.kept, true);
  assert.ok(recs[0].outcome.mutantsKilled >= 1);
}));

// ── rules belong to the repo, not to the container's environment ─────────────
// The team rules ARE prompts: "don't use introspection", "never mock the database".
// They were only settable in .env, which means they live with whoever runs the
// container rather than with the code they describe — a second team pointing a second
// container at the same repo gets different tests, and nobody reviewing the repo can
// see what rules produced them. They belong in the repo root, next to the corpus, with
// .env supplying DEFAULTS for a repo that has not said anything.
test('rules in the repo override the container defaults, stage by stage', () => withSandbox(async (sb) => {
  await sb.start();
  fs.mkdirSync(sb.repoDir, { recursive: true });
  fs.writeFileSync(path.join(sb.repoDir, 'improve-tests.json'), JSON.stringify({
    version: 1,
    rules: { write_test: 'never mock the database; use the in-memory adapter' },
    records: [],
  }));

  const r = feedback.rulesFor({ write_test: 'env default', pick_file: 'env picks' });

  assert.match(r.write_test, /in-memory adapter/, 'the repo has the final say on its own tests');
  assert.equal(r.pick_file, 'env picks', 'and stages it says nothing about keep the default');
}));

test('writing the corpus never destroys hand-written rules', () => withSandbox(async (sb) => {
  // the same file holds a machine-appended corpus and human-edited rules, so a write
  // that clobbered the rules would silently undo a team's configuration
  await sb.start();
  fs.mkdirSync(sb.repoDir, { recursive: true });
  fs.writeFileSync(path.join(sb.repoDir, 'improve-tests.json'), JSON.stringify({
    version: 1, rules: { write_test: 'no snapshots' }, notes: 'ours, keep it', records: [],
  }));

  feedback.recordGeneration({ file: 'a.ts', testPath: 't.test.ts', prompt: {}, source: 's', test: 't', outcome: {} });

  const doc = feedback.load();
  assert.equal(doc.rules.write_test, 'no snapshots');
  assert.equal(doc.notes, 'ours, keep it', 'unknown keys are the team\'s, not ours to drop');
  assert.equal(doc.records.length, 1);
}));
