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

// ═══════════════════════════════════════════════════════════════════════════
//  verify: measure once, and only when there is something to measure
// ═══════════════════════════════════════════════════════════════════════════
//
// Observed in a live run: the coverage bootstrap produced no parseable answer, so
// the round wrote nothing at all — and the pipeline still spent a full suite run, a
// coverage run and a Stryker run (about three minutes on this repo) to discover that
// nothing had changed. In the same trace the suite ran twice back to back with no
// edit in between, because verify runs the suite AND then a coverage pass that runs
// the whole suite again.

test('verify measures the suite ONCE — the coverage pass already runs it', () => withSandbox(async (sb) => {
  const w = await killReady(sb, { mutants: mutantsAt(4) });
  w.writeTest('test/a-kill.test.ts', { target: FILE, kills: [1] });
  const suiteRuns = w.calls.tests.length;
  const covRuns = w.calls.coverage.length;

  await sb.post('/api/verify', { file: FILE });

  assert.equal(w.calls.coverage.length, covRuns + 1, 'one coverage pass');
  assert.equal(w.calls.tests.length, suiteRuns,
    'and no separate suite run — the coverage pass reports pass/fail too');
}));

test('verify still refuses to measure anything when the suite is red', () => withSandbox(async (sb) => {
  const w = await killReady(sb, { mutants: mutantsAt(4) });
  w.writeTest('test/a-kill.test.ts', { target: FILE, kills: [1], red: true });
  const strykerRuns = w.calls.stryker.length;

  const r = await sb.post('/api/verify', { file: FILE });

  assert.equal(r.improved, false);
  assert.equal(r.testsGreen, false);
  assert.equal(w.calls.stryker.length, strykerRuns, 'a red suite makes the measurement meaningless');
}));

test('verify short-circuits a round that changed nothing', () => withSandbox(async (sb) => {
  // the bootstrap produced no parseable answer and the mutant loop kept nothing:
  // there is no artifact to measure, and measuring it costs three minutes
  const w = await killReady(sb, { mutants: mutantsAt(4) });
  const before = { tests: w.calls.tests.length, cov: w.calls.coverage.length, stryker: w.calls.stryker.length };

  const r = await sb.post('/api/verify', { file: FILE });

  assert.equal(r.improved, false);
  assert.equal(r.improvedAny, false, 'nothing changed, so nothing improved');
  assert.equal(w.calls.tests.length, before.tests, 'no suite run');
  assert.equal(w.calls.coverage.length, before.cov, 'no coverage run');
  assert.equal(w.calls.stryker.length, before.stryker, 'no mutation run');
  assert.match(sb.events().join('\n'), /nothing to verify|no changes/i,
    'and it says why, so an empty round is visible rather than silent');
}));

// ═══════════════════════════════════════════════════════════════════════════
//  the per-attempt suite check
// ═══════════════════════════════════════════════════════════════════════════
//
// Measured on the live repo: the full suite takes 52-59s, and running only the
// generated test file takes 1s (459ms of work plus startup). The mutant loop pays
// that 50s on EVERY attempt — fifteen times per file — to answer "does this new test
// pass?". The whole-suite question is still asked, once per round, by /api/verify,
// and nothing reaches a PR without it: a round whose full suite is red is dropped
// entirely, while already-committed rounds were each full-suite verified when they
// were accepted.

test('a kill attempt checks its own test file, not the whole suite', () => withSandbox(async (sb) => {
  const w = await killReady(sb, { mutants: mutantsAt(4) });
  const target = (await sb.get('/api/mutant/next', { path: FILE })).mutant;
  const testPath = 'test/a-kill.test.ts';
  w.writeTest(testPath, { target: FILE, kills: [target.line] });

  await sb.post('/api/mutant/verify', { file: FILE, mutant: target, testPaths: [testPath] });

  const scopes = w.calls.tests;
  assert.ok(scopes.length >= 1, 'the test is still run');
  assert.ok(scopes.every((s) => s !== null),
    `the attempt must not run the full suite — scopes seen: ${JSON.stringify(scopes)}`);
  assert.ok(JSON.stringify(scopes[scopes.length - 1]).includes(testPath),
    'and the scope is the file just written');
}));

test('a generated test that fails is still deleted, and its scope is what was checked', () => withSandbox(async (sb) => {
  const w = await killReady(sb, { mutants: mutantsAt(4) });
  const target = (await sb.get('/api/mutant/next', { path: FILE })).mutant;
  const testPath = 'test/a-kill.test.ts';
  w.writeTest(testPath, { target: FILE, kills: [target.line], red: true });

  const r = await sb.post('/api/mutant/verify', { file: FILE, mutant: target, testPaths: [testPath] });

  assert.equal(r.killed, false);
  assert.equal(r.reason, 'suite red');
  assert.equal(w.exists(testPath), false, 'a red test never survives its own attempt');
  // A test that fails on the REAL code is a broken test, not proof that the mutant
  // resists testing — the same distinction as an empty answer. It is capped by the
  // per-target miss limit instead of spending the mutant's one shot.
  const f = sb.file(FILE);
  assert.deepEqual(f.mutantAttempts || {}, {}, 'the target keeps its shot');
  assert.equal(f.mutantFailures || 0, 0, 'and the failure budget is untouched');
  assert.equal(f.mutantGenFailures, 1, 'it is counted as a generation miss');
}));

// ═══════════════════════════════════════════════════════════════════════════
//  "no tests executed" is not a verdict
// ═══════════════════════════════════════════════════════════════════════════
//
// Straight from the live run:
//   stryker | lib/admin-page-data.ts: no tests executed — mutation score 0
//   improving_mutation | KILLED 112 mutant(s) — target died, 111 collateral (0 left)
// Stryker's "No tests were executed" answer carries survived: [] and no
// survivedTotal. Read as data it says every mutant is dead; read honestly it says
// nothing was measured at all. The kill check is absence from the survivor list, so
// an empty list from a run that never happened looked like total victory — and the
// test that "killed" 112 mutants was kept on that basis.

test('a mutation run that executed no tests is not read as 112 kills', () => withSandbox(async (sb) => {
  const w = await killReady(sb, { mutants: mutantsAt(6) });
  const target = (await sb.get('/api/mutant/next', { path: FILE })).mutant;
  const before = sb.file(FILE).survivedTotal;
  const testPath = 'test/a-kill.test.ts';
  w.writeTest(testPath, { target: FILE, kills: [target.line] });
  w.noTestsNext();   // the verification run finds no related tests and measures nothing

  const r = await sb.post('/api/mutant/verify', { file: FILE, mutant: target, testPaths: [testPath] });

  assert.equal(r.killed, false, 'nothing was measured, so nothing died');
  assert.equal(r.killedCount ?? 0, 0);
  assert.equal(w.exists(testPath), false, 'and an unverified test is not kept');
  const f = sb.file(FILE);
  assert.equal(f.mutantsKilled || 0, 0);
  assert.equal(f.survivedTotal, before, 'the survivor queue is left as it was');
  assert.deepEqual(f.mutantAttempts || {}, {}, 'the target is not retired on a non-measurement');
}));


// ═══════════════════════════════════════════════════════════════════════════
//  two-phase kill: cheap first, reasoning only when the cheap one failed
// ═══════════════════════════════════════════════════════════════════════════
//
// Measured on the same prompt from the run's own dialog log: without reasoning the
// model answers in 21-28s, with it in 112-186s. On everything measurable so far the
// cheap answer was no worse. So the loop asks cheaply first and escalates only for
// the mutants that survive that — which is where the reasoning is worth 6x.
//
// The escalation only works if the cheap failure does NOT spend the mutant's one
// shot; otherwise the second attempt has nothing left to aim at.

test('a failed CHEAP attempt leaves the mutant available for the thinking attempt', () => withSandbox(async (sb) => {
  const w = await killReady(sb, { mutants: mutantsAt(6) });
  const target = (await sb.get('/api/mutant/next', { path: FILE })).mutant;
  const testPath = 'test/a-kill.test.ts';
  w.writeTest(testPath, { target: FILE, kills: [] });          // green, kills nothing

  const r = await sb.post('/api/mutant/verify', { file: FILE, mutant: target, testPaths: [testPath], phase: 'cheap' });

  assert.equal(r.killed, false);
  assert.equal(r.retryable, true, 'the caller is told a thinking attempt is worth making');
  assert.equal(w.exists(testPath), false, 'the useless test still goes');
  const f = sb.file(FILE);
  assert.deepEqual(f.mutantAttempts || {}, {}, 'the one shot is not spent on the cheap try');
  assert.equal(f.mutantFailures || 0, 0, 'nor is the failure budget');
}));

test('a failed THINKING attempt does spend the shot — there is nothing further to try', () => withSandbox(async (sb) => {
  const w = await killReady(sb, { mutants: mutantsAt(6) });
  const target = (await sb.get('/api/mutant/next', { path: FILE })).mutant;
  const testPath = 'test/a-kill.test.ts';
  w.writeTest(testPath, { target: FILE, kills: [] });

  const r = await sb.post('/api/mutant/verify', { file: FILE, mutant: target, testPaths: [testPath], phase: 'thinking' });

  assert.equal(r.killed, false);
  assert.equal(r.retryable, false);
  const f = sb.file(FILE);
  assert.equal(Object.keys(f.mutantAttempts || {}).length, 1, 'now the mutant is retired');
  assert.equal(f.mutantFailures, 1);
}));

test('a CHEAP attempt that kills is kept exactly like any other', () => withSandbox(async (sb) => {
  const w = await killReady(sb, { mutants: mutantsAt(6) });
  const target = (await sb.get('/api/mutant/next', { path: FILE })).mutant;
  const testPath = 'test/a-kill.test.ts';
  w.writeTest(testPath, { target: FILE, kills: [target.line] });

  const r = await sb.post('/api/mutant/verify', { file: FILE, mutant: target, testPaths: [testPath], phase: 'cheap' });

  assert.equal(r.killed, true);
  assert.equal(r.retryable, false, 'nothing to escalate — it worked');
  assert.equal(w.exists(testPath), true);
  assert.equal(sb.file(FILE).mutantsKilled, 1);
}));
// ═══════════════════════════════════════════════════════════════════════════
//  one file per source, not one per mutant
// ═══════════════════════════════════════════════════════════════════════════
//
// The loop writes one test file per mutant on purpose: a failed attempt is then
// trivially droppable, and two mutants can never overwrite each other. That is right
// for the loop and wrong for the PR. Live, after three attempts on one source file:
//   registry.kill-L164-objectliteral-1fgc2lh.test.ts   (one `it`)
//   registry.kill-L165-objectliteral-1eug1z8.test.ts   (one `it`)
//   registry.kill-L166-objectliteral-1e8e2g7.test.ts   (one `it`)
//   registry.mac-cov.test.ts
// A reviewer should get one file with four tests, not four files with one each.

const KILL_A = 'test/a.kill-L10-equalityoperator-aaa.test.ts';
const KILL_B = 'test/a.kill-L20-booleanliteral-bbb.test.ts';

/** A file with two accepted kill rounds on disk, ready for the PR stage. */
async function twoKillFiles(sb) {
  const w = await killReady(sb, { mutants: [{ line: 10 }, { line: 20 }, { line: 30 }] });
  w.writeTest(KILL_A, { target: FILE, kills: [10], cases: 4 });
  w.writeTest(KILL_B, { target: FILE, kills: [20], cases: 4 });
  await sb.post('/api/verify', { file: FILE });
  await sb.post('/api/round/accept', { file: FILE });
  return w;
}

test('cleanup consolidates the per-mutant files into one file for the source', () => withSandbox(async (sb) => {
  const w = await twoKillFiles(sb);
  // the tidy pass declines to change either file, then the merge is asked for
  // route by system prompt rather than by call order: the tidy pass runs once per
  // changed file, and counting those would make the test fragile. The merged text is
  // built from the originals, because a real merge KEEPS every test title — the guard
  // rejects anything that would drop one.
  w.llm.onCall((o) => {
    if (!/You merge several generated test files/.test(o.system)) return { text: '' };
    const bodies = [w.read(KILL_A), w.read(KILL_B)].join('\n');
    return { text: "import { describe, it, expect } from 'vitest';\n" + bodies };
  });

  const r = await sb.post('/api/test/cleanup', { file: FILE });

  const left = w.testFiles().map((t) => t.path).filter((p) => p !== 'test/a.test.ts');
  assert.equal(left.length, 1, `one generated test file should remain, found: ${JSON.stringify(left)}`);
  assert.equal(r.merged, 2, 'and it reports how many it folded together');
  assert.equal(w.exists(KILL_A), false);
  assert.equal(w.exists(KILL_B), false);
}));

test('a merge that loses a kill is reverted, files and all', () => withSandbox(async (sb) => {
  const w = await twoKillFiles(sb);
  // Every test title survives — so the cheap structural guard passes — but the
  // KILLS marker for line 20 is gone, so the merged file no longer kills what the
  // originals killed. Only re-measuring can catch that.
  w.llm.onCall((o) => {
    if (!/You merge several generated test files/.test(o.system)) return { text: '' };
    const bodies = [w.read(KILL_A), w.read(KILL_B)].join('\n').replace(/^\s*\/\/\s*KILLS:\s*20\s*$/gm, '');
    return { text: "import { describe, it, expect } from 'vitest';\n" + bodies };
  });

  const r = await sb.post('/api/test/cleanup', { file: FILE });

  assert.equal(r.merged, 0);
  assert.equal(w.exists(KILL_A), true, 'both originals come back');
  assert.equal(w.exists(KILL_B), true);
  assert.match(sb.events().join('\n'), /merge reverted/i);
}));

test('a merge that would drop a test is rejected before anything is re-measured', () => withSandbox(async (sb) => {
  // The structural check is cheap and the measurement is not: a mutation run on a real
  // file is minutes. A merge that silently loses a test is also the one failure the
  // metrics might not notice, since a dropped test can leave the score untouched.
  const w = await twoKillFiles(sb);
  const before = { cov: w.calls.coverage.length, stryker: w.calls.stryker.length };
  w.llm.onCall((o) => {
    if (!/You merge several generated test files/.test(o.system)) return { text: '' };
    return { text: "import { describe, it, expect } from 'vitest';\n" + w.read(KILL_A) };   // B is gone
  });

  const r = await sb.post('/api/test/cleanup', { file: FILE });

  assert.equal(r.merged, 0);
  assert.equal(w.exists(KILL_A), true, 'nothing was touched');
  assert.equal(w.exists(KILL_B), true);
  assert.equal(w.calls.coverage.length, before.cov, 'and no measurement was spent proving it');
  assert.equal(w.calls.stryker.length, before.stryker);
  assert.match(sb.events().join('\n'), /merge rejected/i);
}));
