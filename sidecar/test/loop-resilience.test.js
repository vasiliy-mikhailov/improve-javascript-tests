'use strict';
// UNIT TESTS for what the loop does when the machinery — not the mutant — fails.
//
// The distinction these pin down: "this mutant resisted a test written for it" is
// EVIDENCE, and it costs the mutant its one shot. "the model returned nothing" or
// "Stryker crashed" is an INFRASTRUCTURE failure, and it is evidence of nothing at
// all. Conflating them retires killable mutants that were never attacked and burns
// a failure budget meant to stop waste, not to stop work.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withSandbox, S } = require('./helpers/env');   // FIRST, always
const { installFakes } = require('./helpers/fakes');

const FILE = 'src/a.ts';

async function killReady(sb, spec = {}, cfg = {}) {
  const w = installFakes(sb);
  await sb.start(cfg);
  w.addFile({ path: FILE, existingTest: 'test/a.test.ts', coverageWithTests: 80, ...spec });
  await sb.post('/api/coverage/run', { phase: 'baseline', stage: 'measuring_baseline' });
  await sb.post('/api/iteration/start', { file: FILE });
  await sb.post('/api/stryker/run', { file: FILE, phase: 'baseline', stage: 'improving_mutation' });
  return w;
}

const mutantsAt = (n) => Array.from({ length: n }, (_, i) => ({ line: i + 1 }));

// ═══════════════════════════════════════════════════════════════════════════
//  the model produced nothing
// ═══════════════════════════════════════════════════════════════════════════

test('a mutant is NOT retired when the model returned no test at all', () => withSandbox(async (sb) => {
  await killReady(sb, { mutants: mutantsAt(6) });
  const target = (await sb.get('/api/mutant/next', { path: FILE })).mutant;

  await sb.post('/api/mutant/verify', { file: FILE, mutant: target, testPaths: [] });

  const f = sb.file(FILE);
  assert.deepEqual(f.mutantAttempts || {}, {},
    'no test was ever written for this mutant, so nothing was learned about it');
  assert.equal(f.mutantFailures || 0, 0,
    'a generation failure must not spend the budget that exists to stop wasted TESTS');

  const again = (await sb.get('/api/mutant/next', { path: FILE })).mutant;
  assert.equal(again.line, target.line, 'the same target must still be offered');
  assert.equal(again.mutator, target.mutator);
}));

test('repeated empty answers still stop the loop rather than spinning forever', () => withSandbox(async (sb) => {
  await killReady(sb, { mutants: mutantsAt(6) }, { maxMutantsPerFile: 3 });

  let stops = null;
  for (let i = 0; i < 40; i++) {
    const r = await sb.get('/api/mutant/next', { path: FILE });
    if (!r.mutant) { stops = r; break; }
    await sb.post('/api/mutant/verify', { file: FILE, mutant: r.mutant, testPaths: [] });
  }
  assert.ok(stops, 'the loop must terminate when the model never produces anything');
  assert.match(String(stops.reason), /usable|generat|unhealthy/i,
    'and it must say the generator is broken, not that the mutants resisted');
}));

test('one unwritable mutant does not pin the loop to itself', () => withSandbox(async (sb) => {
  await killReady(sb, { mutants: mutantsAt(6) }, { maxMutantsPerFile: 20 });
  const first = (await sb.get('/api/mutant/next', { path: FILE })).mutant;

  const seen = new Set();
  for (let i = 0; i < 8; i++) {
    const r = await sb.get('/api/mutant/next', { path: FILE });
    if (!r.mutant) break;
    seen.add(r.mutant.line + '|' + r.mutant.mutator);
    await sb.post('/api/mutant/verify', { file: FILE, mutant: r.mutant, testPaths: [] });
  }
  assert.ok(seen.size > 1,
    `the loop must move on after a few misses on ${first.mutator}:${first.line}, not retry it forever`);
}));

// ═══════════════════════════════════════════════════════════════════════════
//  no verdict: the verification run itself failed
// ═══════════════════════════════════════════════════════════════════════════

test('a crashed verification run deletes the test but does not retire the mutant', () => withSandbox(async (sb) => {
  const w = await killReady(sb, { mutants: mutantsAt(6) });
  const target = (await sb.get('/api/mutant/next', { path: FILE })).mutant;
  const testPath = 'test/a-kill.test.ts';
  w.writeTest(testPath, { target: FILE, kills: [target.line] });
  w.failNext('stryker', new Error('stryker produced no report (exit 1)'));

  const r = await sb.post('/api/mutant/verify', { file: FILE, mutant: target, testPaths: [testPath] });

  assert.equal(r.killed, false);
  assert.equal(w.exists(testPath), false, 'nothing unverified may stay on disk');
  const f = sb.file(FILE);
  assert.deepEqual(f.mutantAttempts || {}, {}, 'an infrastructure failure is not evidence about the mutant');
  assert.equal(f.mutantFailures || 0, 0, 'and it must not spend the failure budget');
}));

// ═══════════════════════════════════════════════════════════════════════════
//  a crashed baseline measurement
// ═══════════════════════════════════════════════════════════════════════════

test('one crashed baseline does not blacklist the file for every future batch', () => withSandbox(async (sb) => {
  const w = installFakes(sb);
  await sb.start();
  w.addFile({ path: FILE, mutants: mutantsAt(4) });
  await sb.post('/api/iteration/start', { file: FILE });
  w.failNext('stryker', new Error('stryker produced no report (exit 1)'));

  const r = await sb.post('/api/stryker/run', { file: FILE, phase: 'baseline', stage: 'improving_mutation' });

  assert.equal(r.failed, true);
  const slug = require('../util').slugify(sb.repoUrl);
  assert.equal(S.state.improvedLedger[slug]?.[FILE], undefined,
    'a transient crash must not settle the file permanently — the ledger is replayed in every later batch');
  assert.ok(S.state.measureLedger[slug]?.[FILE],
    'but the attempt must be remembered, or the retry counter can never reach its limit');
}));

test('a file that crashes every time still settles, so a batch run terminates', () => withSandbox(async (sb) => {
  const w = installFakes(sb);
  await sb.start({ maxAttemptsPerFile: 3 });
  w.addFile({ path: FILE, mutants: mutantsAt(4) });
  w.failAlways('stryker', new Error('stryker produced no report (exit 1)'));

  for (let i = 0; i < 3; i++) {
    await sb.post('/api/iteration/start', { file: FILE });
    await sb.post('/api/stryker/run', { file: FILE, phase: 'baseline', stage: 'improving_mutation' });
  }

  const slug = require('../util').slugify(sb.repoUrl);
  assert.equal(S.state.improvedLedger[slug]?.[FILE]?.state, 'failed',
    'a deterministically broken file must stop being retried');
}));

test('a measurement crash does not consume the scope quota meant for real work', () => withSandbox(async (sb) => {
  const w = installFakes(sb);
  await sb.start({ scopeLimit: 1 });
  w.addFile({ path: FILE, mutants: mutantsAt(4) });
  w.addFile({ path: 'src/b.ts', mutants: mutantsAt(4) });
  await sb.post('/api/iteration/start', { file: FILE });
  w.failNext('stryker', new Error('stryker produced no report (exit 1)'));
  await sb.post('/api/stryker/run', { file: FILE, phase: 'baseline', stage: 'improving_mutation' });

  const c = await sb.get('/api/files/candidates');
  assert.equal(c.done, false,
    'SCOPE_LIMIT=1 must buy one improvement ATTEMPT, not one crash');
}));

// ═══════════════════════════════════════════════════════════════════════════
//  cleanup must not quietly undo the improvement it is tidying
// ═══════════════════════════════════════════════════════════════════════════

test('cleanup is reverted when it costs COVERAGE, even though the score is unchanged', () => withSandbox(async (sb) => {
  const w = installFakes(sb);
  await sb.start();
  // Nothing kills anything here: this generated test exists to make the file
  // EXECUTE at all. That is exactly the shape cleanup is told to call "vacuous".
  w.addFile({ path: FILE, mutants: mutantsAt(4), coverageWithTests: 90, coverageWithout: 0 });
  await sb.post('/api/coverage/run', { phase: 'baseline' });
  await sb.post('/api/iteration/start', { file: FILE });
  const covTest = 'test/a.mac-cov.test.ts';
  w.writeTest(covTest, { target: FILE, kills: [], cases: 6 });
  await sb.post('/api/verify', { file: FILE });
  await sb.post('/api/round/accept', { file: FILE });
  assert.equal(sb.file(FILE).coverage, 90, 'precondition: this test is what covers the file');

  // The "cleaned" file no longer exercises the module. Deleting a test moves its
  // mutants from `survived` to `nocoverage`, and BOTH sit in the score's
  // denominator — so the mutation score does not move at all while coverage goes.
  w.llm.replyText(w.testSource({ target: 'src/unrelated.ts', kills: [], cases: 6 }));

  const r = await sb.post('/api/test/cleanup', { file: FILE });

  assert.equal(r.reverted, true, 'a cleanup that drops coverage must be undone');
  assert.equal(r.cleaned, 0);
  assert.match(w.read(covTest) || '', /TARGET: src\/a\.ts/, 'the original test must be back on disk');
  assert.equal(sb.file(FILE).coverage, 90,
    'and the recorded coverage must not be left describing the file cleanup deleted');
}));
