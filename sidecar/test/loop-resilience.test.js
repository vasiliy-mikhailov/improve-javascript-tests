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
const { withSandbox, S, mutants } = require('./helpers/env');   // FIRST, always
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
  assert.match(String(stops.reason), /could not be written|budget/i,
    'and it must distinguish "nothing was written" from "the mutants resisted"');
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
  // persistent, not transient: the window check and the whole-file fallback are two
  // separate runs, and a single failure is now survivable by design
  w.failAlways('stryker', new Error('stryker produced no report (exit 1)'));
  sb.onCleanup(() => w.stopFailing('stryker'));

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
  w.noTestsNext(2);  // both the window check and the whole-file fallback measure nothing

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

test('the pick prompt names a failed mutant by its full identity, not just line and mutator',
  () => withSandbox(async (sb) => {
    // Two halves have to agree about what "this mutant" means: mutants.rank filters the
    // candidate list on mutator|line|column|replacement, and the prompt's failed block
    // is built by the caller. When the caller dropped column and replacement, a sibling
    // Stryker emitted at the same position — still on the list, still killable — was
    // described to the model as the thing it must not pick.
    const w = await killReady(sb, {
      mutants: [
        { line: 25, column: 16, mutator: 'EqualityOperator', replacement: '>' },
        { line: 25, column: 16, mutator: 'EqualityOperator', replacement: '<' },
        { line: 40, column: 2, mutator: 'BooleanLiteral', replacement: 'false' },
      ],
    });
    const first = (await sb.get('/api/mutant/next', { path: FILE })).mutant;
    const testPath = 'test/a-kill.test.ts';
    w.writeTest(testPath, { target: FILE, kills: [] });
    await sb.post('/api/mutant/verify', { file: FILE, mutant: first, testPaths: [testPath], phase: 'thinking' });

    w.llm.calls.length = 0;
    await sb.get('/api/mutant/next', { path: FILE });

    const prompt = w.llm.calls.map((c) => c.prompt || '').join('\n');
    const banLines = prompt.split('\n').filter((l) => /failed attempt/.test(l));
    assert.ok(banLines.length, 'precondition: the failed block is rendered');
    // the assertion has to look at the BAN LINE itself: the replacement appears all
    // over the candidate rows, so searching the whole prompt would pass either way
    assert.ok(banLines.some((l) => l.includes(String(first.replacement))),
      `the ban must say WHICH replacement failed, or it bans the sibling too — got: ${JSON.stringify(banLines)}`);
  }));

// ═══════════════════════════════════════════════════════════════════════════
//  the two reasons a file looks stuck
// ═══════════════════════════════════════════════════════════════════════════
//
// Measured on a live file after 144 minutes: 55 attempts, 16 kills, 6 failures and
// NINETEEN generation misses — every one of them "the generated test failed against
// the unmutated code". Meanwhile the dashboard showed mutation 56% and MAC 0, because
// coverage was still the baseline 0 it was measured at before any test existed.

test('a bootstrapped file gets its coverage re-measured, so MAC stops reading zero',
  () => withSandbox(async (sb) => {
    // Coverage is measured at baseline and at verify, nowhere else. A file that had no
    // tests therefore carries coverage 0 for the whole round — hours — while mutation
    // climbs, and MAC (coverage x mutation / 100) is pinned at 0 the entire time. The
    // moment the survivor list is refreshed after the bootstrap is exactly the moment
    // coverage is known to have changed, so it is measured there, once.
    const w = installFakes(sb);
    await sb.start();
    w.addFile({ path: FILE, mutants: mutantsAt(6), coverageWithTests: 90, coverageWithout: 0 });
    await sb.post('/api/coverage/run', { phase: 'baseline' });
    await sb.post('/api/iteration/start', { file: FILE });
    await sb.post('/api/stryker/run', { file: FILE, phase: 'baseline' });
    assert.equal(sb.file(FILE).coverage, 0, 'precondition: nothing covers it yet');

    // one incidental kill, which is what a bootstrap test normally does: it executes
    // the module, and something dies as a side effect. With a score of 0 MAC is
    // legitimately 0 however good the coverage is, so the fixture has to clear that.
    w.writeTest('test/a.mac-cov.test.ts', { target: FILE, kills: [1] });
    await sb.post('/api/test/write-many', { stage: 'improving_coverage', tests: [] , paths: []});
    S.upsertFile(FILE, { survivorsStale: true });
    await sb.get('/api/mutant/next', { path: FILE });

    const f = sb.file(FILE);
    assert.equal(f.coverage, 90, 'the file is executed now, and the record says so');
    assert.ok((f.mac ?? 0) > 0, `MAC must stop reading 0 once coverage is real — got ${f.mac}`);
  }));

test('an escalation after a RED test is told what the failure was', () => withSandbox(async (sb) => {
  // All nineteen misses on the live file were red tests. The escalation already runs
  // for them, but it was told only "a previous attempt failed" — never the compiler or
  // runner output that would let it fix an import or a mock shape. So it rebuilt the
  // same eighty lines of scaffolding and made the same class of mistake.
  const w = await killReady(sb, { mutants: mutantsAt(4) });
  const target = (await sb.get('/api/mutant/next', { path: FILE })).mutant;
  const testPath = 'test/a-kill.test.ts';
  w.writeTest(testPath, { target: FILE, kills: [target.line], red: true });

  const r = await sb.post('/api/mutant/verify', { file: FILE, mutant: target, testPaths: [testPath], phase: 'cheap' });

  assert.equal(r.retryable, true);
  assert.ok(r.summary && r.summary.length > 0,
    'the runner output must reach the caller, or the escalated prompt cannot use it');
  assert.match(r.summary, /FAIL|failed/i);
}));

test('a test that will not even run still spends the loop budget', () => withSandbox(async (sb) => {
  // The regression this session introduced, and the reason a live file sat on one
  // target for two and a half hours instead of settling and moving on.
  //
  // A red test is not evidence about the MUTANT — that reasoning stands, and the target
  // still keeps its shot. But the failure budget is not about mutants; it bounds WASTE,
  // and a test that cannot run is waste whoever is at fault. Making those free removed
  // the only brake that ended a round: 19 red tests cost 0 of 15, leaving the 90-attempt
  // hard ceiling as the sole stop — about eight hours per file at the observed cycle.
  const w = await killReady(sb, { mutants: mutantsAt(30) }, { maxMutantsPerFile: 4 });

  for (let i = 0; i < 12; i++) {
    const r = await sb.get('/api/mutant/next', { path: FILE });
    if (!r.mutant) {
      assert.match(String(r.reason), /budget/i, 'the loop must stop on wasted attempts, not only on judged ones');
      const f = sb.file(FILE);
      assert.ok((f.mutantFailures || 0) + (f.mutantGenFailures || 0) >= 4,
        'and it must count both kinds of waste against the same budget');
      return;
    }
    const p = `test/a-kill-${i}.test.ts`;
    w.writeTest(p, { target: FILE, kills: [], red: true });      // red every time
    await sb.post('/api/mutant/verify', { file: FILE, mutant: r.mutant, testPaths: [p], phase: 'thinking' });
  }
  assert.fail('twelve unusable attempts against a budget of four and the loop never stopped');
}));

test('each round gets its own waste budget, or round two is a no-op', () => withSandbox(async (sb) => {
  // Observed immediately after the brake landed: round 1 ended on the budget with
  // MAC 0 → 58.73, the round was accepted, and round 2 came back STALE 168 seconds
  // later having done nothing at all. The counters are reset per ITERATION, not per
  // round, so a budget spent in round 1 is still spent in round 2 — the loop exits
  // before its first pick and every later round is a verify that measures no change.
  //
  // The budget bounds waste WITHIN a round. Rounds are already bounded by their own
  // rule: they continue only while a metric improves and none degrades.
  const w = await killReady(sb, { mutants: mutantsAt(20) }, { maxMutantsPerFile: 3 });
  S.upsertFile(FILE, { mutantFailures: 2, mutantGenFailures: 1 });
  const spent = await sb.get('/api/mutant/next', { path: FILE });
  assert.equal(spent.mutant, null, 'precondition: the budget is spent');

  await sb.post('/api/round/accept', { file: FILE });

  const next = await sb.get('/api/mutant/next', { path: FILE });
  assert.ok(next.mutant, 'an accepted round starts with a fresh budget, or it can do no work');
  const f = sb.file(FILE);
  assert.equal(f.mutantFailures, 0);
  assert.equal(f.mutantGenFailures, 0);
  assert.ok((f.mutantsKilled ?? 0) >= 0, 'kills are cumulative for the file, not reset');
}));

// ═══════════════════════════════════════════════════════════════════════════
//  verifying a kill on a RANGE instead of the whole file
// ═══════════════════════════════════════════════════════════════════════════
//
// Measured over a 5-hour run: the whole-file mutation re-run after every attempt is
// 178 of 305 minutes — 58% of the entire pipeline, at a 194s median across 55 runs.
// It answers one question ("did this mutant die?") by re-testing 126 mutants.
//
// A range run answers the same question over the lines around the target. What it
// CANNOT answer is the file's score or its full survivor list, so those still come
// from the whole-file run at the end of the round. The rule that keeps this honest:
// a partial result may never be written as the file's mutation score.

test('a kill is verified on a range, not by re-testing the whole file', () => withSandbox(async (sb) => {
  const w = await killReady(sb, { mutants: mutantsAt(40) });
  const target = (await sb.get('/api/mutant/next', { path: FILE })).mutant;
  const testPath = 'test/a-kill.test.ts';
  w.writeTest(testPath, { target: FILE, kills: [target.line] });

  const r = await sb.post('/api/mutant/verify', { file: FILE, mutant: target, testPaths: [testPath], phase: 'thinking' });

  assert.equal(r.killed, true);
  const ranges = w.calls.stryker.filter((c) => c && c.range);
  assert.ok(ranges.length >= 1, `the verification must be scoped: ${JSON.stringify(w.calls.stryker)}`);
  const [from, to] = [ranges[0].range.from, ranges[0].range.to];
  assert.ok(from <= target.line && to >= target.line, 'the range must contain the target');
  assert.ok(to - from < 40, 'and be narrower than the file, or it saves nothing');
}));

test('a partial run never becomes the file\'s mutation score', () => withSandbox(async (sb) => {
  // A range scores only the lines it mutated. Writing that as the file's score would
  // report a number computed from a handful of mutants as if it described all 126.
  const w = await killReady(sb, { mutants: mutantsAt(40) });
  const before = sb.file(FILE).mutation;
  const target = (await sb.get('/api/mutant/next', { path: FILE })).mutant;
  const testPath = 'test/a-kill.test.ts';
  w.writeTest(testPath, { target: FILE, kills: [target.line] });

  await sb.post('/api/mutant/verify', { file: FILE, mutant: target, testPaths: [testPath], phase: 'thinking' });

  assert.equal(sb.file(FILE).mutation, before,
    'the score is a whole-file measurement and only /api/verify may set it');
}));

test('a mutant killed inside the range leaves the queue', () => withSandbox(async (sb) => {
  // The whole-file run used to refresh the survivor list as a side effect. A range run
  // cannot, so the mutants it proved dead must be removed explicitly — otherwise the
  // next pick attacks something already dead and wastes a full attempt.
  const w = await killReady(sb, { mutants: mutantsAt(40) });
  const target = (await sb.get('/api/mutant/next', { path: FILE })).mutant;
  const testPath = 'test/a-kill.test.ts';
  w.writeTest(testPath, { target: FILE, kills: [target.line] });

  await sb.post('/api/mutant/verify', { file: FILE, mutant: target, testPaths: [testPath], phase: 'thinking' });

  const survivors = sb.file(FILE).lastSurvived || [];
  assert.ok(!survivors.some((s) => s.line === target.line && s.mutator === target.mutator),
    'the dead target is still being offered as a candidate');
}));

test('a transient failure in the window check is covered by the whole-file fallback',
  () => withSandbox(async (sb) => {
    // The window is a fast path, not a single point of failure: if it errors, the
    // verification falls through to the run that was happening every time before.
    const w = await killReady(sb, { mutants: mutantsAt(6) });
    const target = (await sb.get('/api/mutant/next', { path: FILE })).mutant;
    const testPath = 'test/a-kill.test.ts';
    w.writeTest(testPath, { target: FILE, kills: [target.line] });
    w.failNext('stryker', new Error('transient stryker hiccup'));   // window only

    const r = await sb.post('/api/mutant/verify', { file: FILE, mutant: target, testPaths: [testPath], phase: 'thinking' });

    assert.equal(r.killed, true, 'the kill is real and the fallback proved it');
    assert.equal(w.exists(testPath), true);
  }));

// ═══════════════════════════════════════════════════════════════════════════
//  many mutants per attempt
// ═══════════════════════════════════════════════════════════════════════════
//
// Measured against the real model on a fixture with eight survivors: one file aimed at
// all eight kills 6.0 on average, where the single-target prompt kills 3.0 (its target
// plus collateral). The pipeline gap is wider still, because a single-target attempt
// also pays a scoped test run and a mutation verification for that one mutant.

test('mutant/next offers a batch of targets, best-first, alongside the single pick',
  () => withSandbox(async (sb) => {
    await killReady(sb, { mutants: mutantsAt(20) });

    const r = await sb.get('/api/mutant/next', { path: FILE });

    assert.ok(Array.isArray(r.targets), 'the batch prompt needs a list');
    assert.ok(r.targets.length >= 2 && r.targets.length <= 8, `got ${r.targets.length}`);
    assert.deepEqual(r.targets[0], r.mutant, 'the single-target fallback aims at the best one');
    const keys = r.targets.map((m) => `${m.mutator}|${m.line}|${m.column}`);
    assert.equal(new Set(keys).size, keys.length, 'no duplicates — each slot must be a different mutant');
  }));

test('a batch verification counts every target that died', () => withSandbox(async (sb) => {
  const w = await killReady(sb, { mutants: mutantsAt(20) });
  const { targets } = await sb.get('/api/mutant/next', { path: FILE });
  const batch = targets.slice(0, 4);
  const testPath = 'test/a-batch.test.ts';
  w.writeTest(testPath, { target: FILE, kills: batch.slice(0, 3).map((m) => m.line) });

  const r = await sb.post('/api/mutant/verify', { file: FILE, mutants: batch, testPaths: [testPath], phase: 'thinking' });

  assert.equal(r.killed, true);
  assert.equal(r.killedTargets, 3, 'three of the four aimed-at mutants died');
  assert.equal(w.exists(testPath), true, 'a file that killed three earns its place');
  assert.equal(sb.file(FILE).mutantsKilled, 3);
}));

test('every target in a batch spends its one shot, whether it died or not', () => withSandbox(async (sb) => {
  // Otherwise the survivors of a batch come straight back as candidates and the next
  // batch re-attacks them — the loop would circle the same mutants for ever.
  const w = await killReady(sb, { mutants: mutantsAt(20) });
  const { targets } = await sb.get('/api/mutant/next', { path: FILE });
  const batch = targets.slice(0, 4);
  const testPath = 'test/a-batch.test.ts';
  w.writeTest(testPath, { target: FILE, kills: [batch[0].line] });

  await sb.post('/api/mutant/verify', { file: FILE, mutants: batch, testPaths: [testPath], phase: 'thinking' });

  const attempts = sb.file(FILE).mutantAttempts || {};
  const spent = batch.slice(1).filter((m) => attempts[mutants.mutantKey(m)] > 0).length;
  assert.equal(spent, 3, 'the three that survived the batch are retired, the one that died needs no record');
}));

test('a batch that kills nothing falls back to a single-target attempt', () => withSandbox(async (sb) => {
  const w = await killReady(sb, { mutants: mutantsAt(20) });
  const { targets } = await sb.get('/api/mutant/next', { path: FILE });
  const batch = targets.slice(0, 4);
  const testPath = 'test/a-batch.test.ts';
  w.writeTest(testPath, { target: FILE, kills: [] });

  const r = await sb.post('/api/mutant/verify', { file: FILE, mutants: batch, testPaths: [testPath], phase: 'batch' });

  assert.equal(r.killed, false);
  assert.equal(r.retryable, true, 'the caller is told a single-target attempt is still worth making');
  assert.equal(w.exists(testPath), false, 'the useless batch file goes');
  assert.deepEqual(sb.file(FILE).mutantAttempts || {}, {},
    'and a failed BATCH spends nobody\'s shot — the single attempt has not happened yet');
}));

test('the kill prompt is shown OUR green test for THIS file, not a stranger\'s', () => withSandbox(async (sb) => {
  // Root cause of the schema-file failures. The bootstrap writes a test that is proven
  // green against this exact module — right import path, right helpers — and then the
  // kill prompt was shown a test from an unrelated file instead, because guessTestPath
  // looks for `<name>.test.ts` and the bootstrap wrote `<name>.mac-cov.test.ts`.
  //
  // Live consequence on lib/api-schemas/models/analytics.ts: every kill test reached
  // for `AnalyticsEmployeesResponse._def.openapi?.title`, which does not exist, and
  // died before it could kill anything — while the bootstrap's own safeParse example
  // sat on disk unused.
  //
  // This is the one case where our own generated output IS the best example: same
  // file, proven green. findStyleReference still refuses generated tests from OTHER
  // files, where feeding our output back would compound whatever it got wrong.
  const w = await killReady(sb, { mutants: mutantsAt(6) });
  const bootstrapTest = 'test/a.mac-cov.test.ts';
  w.writeTest(bootstrapTest, { target: FILE, kills: [], cases: 4, note: 'PROVEN-GREEN-FOR-THIS-FILE' });

  const r = await sb.get('/api/mutant/next', { path: FILE });

  assert.ok(r.existingTest, 'the prompt must carry an example at all');
  assert.match(r.existingTest, /PROVEN-GREEN-FOR-THIS-FILE/,
    `the example should be our bootstrap test for this file, got: ${String(r.existingTest).slice(0, 120)}`);
}));
