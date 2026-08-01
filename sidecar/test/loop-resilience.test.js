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
const store = require('../mutant-store');

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
  // A test that fails on the REAL code is a broken test rather than proof that the
  // mutant resists testing, so it is still counted as a generation miss — but it
  // retires the target too. An identical prompt cannot produce a different answer, and
  // the second look only ever made sense while the escalation supplied the runner's
  // output to go with it.
  const f = sb.file(FILE);
  assert.equal(Object.keys(f.mutantAttempts || {}).length, 1, 'the target had its shot');
  assert.equal(f.mutantFailures || 0, 0, 'charged once — miss() already counted it');
  assert.equal(f.mutantGenFailures, 1, 'it is counted as a generation miss as well');
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
//  one attempt per mutant, and what each kind of failure costs
// ═══════════════════════════════════════════════════════════════════════════
//
// Measured on the same prompt from the run's own dialog log: without reasoning the
// model answers in 21-28s, with it in 112-186s. On everything measurable so far the
// cheap answer was no worse. So the loop asks cheaply first and escalates only for
// the mutants that survive that — which is where the reasoning is worth 6x.
//
// One shot per mutant. 'batch' is the only phase whose failure condemns nobody — a
// sweep writes one test per SITE, so a batch that kills nothing says nothing about any
// individual mutant. Every other phase is that mutant's verdict, and must spend its
// shot: there is no second attempt to leave anything for, and a mutant that is never
// charged is offered again for ever.

test('a failed SINGLE attempt spends the mutant\'s one shot', () => withSandbox(async (sb) => {
  const w = await killReady(sb, { mutants: mutantsAt(6) });
  const target = (await sb.get('/api/mutant/next', { path: FILE })).mutant;
  const testPath = 'test/a-kill.test.ts';
  w.writeTest(testPath, { target: FILE, kills: [] });          // green, kills nothing

  const r = await sb.post('/api/mutant/verify', { file: FILE, mutant: target, testPaths: [testPath], phase: 'single' });

  assert.equal(r.killed, false);
  assert.equal(r.retryable, false, 'there is nothing left to try on this mutant');
  assert.equal(w.exists(testPath), false, 'the useless test still goes');
  const f = sb.file(FILE);
  assert.equal(Object.keys(f.mutantAttempts || {}).length, 1, 'the mutant is retired, or it comes back for ever');
  assert.equal(f.mutantFailures, 1, 'and the failure budget moves, or the round never ends');
}));

test('an unrecognised phase is treated as a verdict, not as a free attempt', () => withSandbox(async (sb) => {
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

test('a SINGLE attempt that kills is kept exactly like any other', () => withSandbox(async (sb) => {
  const w = await killReady(sb, { mutants: mutantsAt(6) });
  const target = (await sb.get('/api/mutant/next', { path: FILE })).mutant;
  const testPath = 'test/a-kill.test.ts';
  w.writeTest(testPath, { target: FILE, kills: [target.line] });

  const r = await sb.post('/api/mutant/verify', { file: FILE, mutant: target, testPaths: [testPath], phase: 'single' });

  assert.equal(r.killed, true);
  assert.equal(r.retryable, false, 'it worked — there is nothing to retry');
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
  assert.match(sb.events().join('\n'), /merge chunk rejected/i);
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

test('a RED test says what the runner said, where someone can read it', () => withSandbox(async (sb) => {
  // Red tests are the dominant failure on schema-heavy files. The runner's output used
  // to be carried into the escalated prompt; that prompt is gone, so the only thing
  // that makes a red test diagnosable is the event log.
  const w = await killReady(sb, { mutants: mutantsAt(4) });
  const target = (await sb.get('/api/mutant/next', { path: FILE })).mutant;
  const testPath = 'test/a-kill.test.ts';
  w.writeTest(testPath, { target: FILE, kills: [target.line], red: true });

  const r = await sb.post('/api/mutant/verify', { file: FILE, mutant: target, testPaths: [testPath], phase: 'single' });

  assert.equal(r.retryable, false, 'one shot, spent');
  assert.match(r.summary || '', /FAIL|failed/i);
  assert.match(sb.events().join('\n'), /runner said: .*(FAIL|failed)/i,
    'a red test whose reason appears nowhere is a red test nobody can fix');
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
  S.upsertFile(FILE, { mutantFailures: 2, mutantGenFailures: 1, mutantsKilled: 7 });
  const spent = await sb.get('/api/mutant/next', { path: FILE });
  assert.equal(spent.mutant, null, 'precondition: the budget is spent');

  await sb.post('/api/round/accept', { file: FILE });

  const next = await sb.get('/api/mutant/next', { path: FILE });
  assert.ok(next.mutant, 'an accepted round starts with a fresh budget, or it can do no work');
  const f = sb.file(FILE);
  assert.equal(f.mutantFailures, 0);
  assert.equal(f.mutantGenFailures, 0);
  // seeded above, because `>= 0` held for undefined, 0 and every real count alike — an
  // accepted round that wiped the counter passed the whole suite
  assert.equal(f.mutantsKilled, 7, 'kills are cumulative for the file, not reset with the budget');
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

// ═══════════════════════════════════════════════════════════════════════════
//  the sweep: write per site, verify once
// ═══════════════════════════════════════════════════════════════════════════

test('mutant/next serves SITES from the durable queue, busiest first', () => withSandbox(async (sb) => {
  await killReady(sb, { mutants: [
    { line: 9, column: 2 }, { line: 9, column: 2 }, { line: 9, column: 2 },
    { line: 7, column: 3 }, { line: 7, column: 3 },
    { line: 5, column: 1 },
  ] });

  const r = await sb.get('/api/mutant/next', { path: FILE });

  assert.ok(Array.isArray(r.groups), 'the sweep prompt needs sites, not a flat list');
  assert.deepEqual(r.groups.map((g) => g.mutants.length), [3, 2, 1]);
  assert.equal(r.groups[0].name, 'kills 9:2', 'the name is the contract with the skip filter');
}));

test('a site with a test already written is never offered again', () => withSandbox(async (sb) => {
  await killReady(sb, { mutants: [{ line: 9, column: 2 }, { line: 7, column: 3 }] });
  const first = await sb.get('/api/mutant/next', { path: FILE });
  await sb.post('/api/mutant/written', { file: FILE, names: [first.groups[0].name] });

  const second = await sb.get('/api/mutant/next', { path: FILE });

  assert.ok(!second.groups.some((g) => g.name === first.groups[0].name),
    'that site had its shot — offering it again is the retry the design forbids');
}));

test('the round-end run drops test files that killed nothing', () => withSandbox(async (sb) => {
  // The whole point of a sweep: write broadly, verify ONCE, and let the single mutation
  // run say which files earned their place. Stryker's killedBy makes that answerable
  // without a run per file.
  const w = await killReady(sb, { mutants: [{ line: 10 }, { line: 20 }] });
  // generated names, because the prune only ever deletes files WE wrote
  w.writeTest('test/a.kill-batch-earned.test.ts', { target: FILE, kills: [10] });
  w.writeTest('test/a.kill-batch-nothing.test.ts', { target: FILE, kills: [] });
  w.writeTest('test/a.handwritten.test.ts', { target: FILE, kills: [] });

  await sb.post('/api/verify', { file: FILE });

  assert.equal(w.exists('test/a.kill-batch-earned.test.ts'), true, 'it killed something');
  assert.equal(w.exists('test/a.kill-batch-nothing.test.ts'), false,
    'it killed nothing and the run already knew that — D12 without a second measurement');
  assert.equal(w.exists('test/a.handwritten.test.ts'), true,
    'and a file we did not generate is never ours to delete, whatever it killed');
}));


test('the queue is filled by whatever measured the survivors, not only the baseline',
  () => withSandbox(async (sb) => {
    // Live: the queue file existed and held nothing. It was written only by
    // /api/stryker/run, and on a file with no tests that run reports "no tests executed"
    // with an empty survivor list — so the queue was initialised to []. The measurement
    // that actually finds the survivors is the post-bootstrap re-measure inside
    // mutant/next, and it never touched the queue. Everything downstream then quietly
    // fell back to the old behaviour: the same eight sites offered again and again,
    // the same batch file written twice with the same hash.
    const w = installFakes(sb);
    await sb.start();
    w.addFile({ path: FILE, mutants: mutantsAt(9), coverageWithTests: 90, coverageWithout: 0 });
    await sb.post('/api/coverage/run', { phase: 'baseline' });
    await sb.post('/api/iteration/start', { file: FILE });
    w.noTestsNext();                                   // the baseline measures nothing
    await sb.post('/api/stryker/run', { file: FILE, phase: 'baseline' });
    assert.equal(store.all(FILE).length, 0, 'precondition: nothing measured yet');

    w.writeTest('test/a.mac-cov.test.ts', { target: FILE, kills: [1] });
    S.upsertFile(FILE, { survivorsStale: true });
    await sb.get('/api/mutant/next', { path: FILE });   // the re-measure

    assert.ok(store.all(FILE).length >= 8,
      `the re-measure must fill the queue — it holds ${store.all(FILE).length}`);
  }));

test('a verified round refreshes the queue too, so the next round sees what is left',
  () => withSandbox(async (sb) => {
    const w = await killReady(sb, { mutants: mutantsAt(9) });
    w.writeTest('test/a.kill-batch-x.test.ts', { target: FILE, kills: [1, 2, 3] });

    await sb.post('/api/verify', { file: FILE });

    const left = store.all(FILE).map((r) => r.line);
    assert.ok(!left.includes(1) && !left.includes(2) && !left.includes(3),
      `the three that died must leave the queue — still holding ${JSON.stringify(left)}`);
  }));

test('a window that covers most of the file is not a window — run the whole thing',
  () => withSandbox(async (sb) => {
    // Eight sites spread over a file produce a union spanning three quarters of it:
    // measured 143 of 190 mutants in "range", at 120-260s a check. That is a whole-file
    // run wearing a window's name, and it gives up the score and the full survivor list
    // for nothing.
    const w = await killReady(sb, { mutants: mutantsAt(40) });
    const { groups } = await sb.get('/api/mutant/next', { path: FILE });
    const spread = [groups[0], ...groups.slice(-1)].filter(Boolean);
    w.writeTest('test/a.kill-batch-y.test.ts', { target: FILE, kills: [spread[0].line] });

    await sb.post('/api/mutant/verify', {
      file: FILE, mutants: spread.flatMap((g) => g.mutants), testPaths: ['test/a.kill-batch-y.test.ts'], phase: 'batch',
    });

    // it must go STRAIGHT to the whole file: a wide window costs a full run and then
    // the fallback costs another, so the pointless one is pure waste
    const ranged = w.calls.stryker.filter((c) => c && c.range).length;
    const whole = w.calls.stryker.filter((c) => c && !c.range).length;
    assert.equal(ranged, 0, `a union spanning the file must not be run as a window (${ranged} ranged runs)`);
    assert.ok(whole >= 1, 'and the whole-file run must happen instead');
  }));

test('a window is judged by the MUTANTS it re-tests, not the lines it spans', () => withSandbox(async (sb) => {
  // Live on a dense file: the union spanned 65 lines — comfortably under a line-based
  // threshold — and held 131 of the file's 190 mutants. Eleven such "windows" re-tested
  // 70-93% of the file each, and seven whole-file runs happened on top when they found
  // nothing. Lines are not the cost; mutants are.
  const w = await killReady(sb, { sourceLines: 400, mutants: mutantsAt(40, 10) });   // all packed into 40 lines
  const { groups } = await sb.get('/api/mutant/next', { path: FILE });
  const spread = groups.slice(0, 6).flatMap((g) => g.mutants);
  w.writeTest('test/a.kill-batch-dense.test.ts', { target: FILE, kills: [spread[0].line] });

  await sb.post('/api/mutant/verify', {
    file: FILE, mutants: spread, testPaths: ['test/a.kill-batch-dense.test.ts'], phase: 'batch',
  });

  const ranged = w.calls.stryker.filter((c) => c && c.range).length;
  assert.equal(ranged, 0,
    `a window holding most of the file's mutants is a whole-file run with extra steps (${ranged} ranged)`);
}));

// A red test used to be forgiven because the escalation would try again — with the
// runner's output in the prompt, so the second attempt knew something the first did
// not. With one attempt per mutant that forgiveness re-prompts the SAME target with a
// byte-identical prompt, up to the miss ceiling of three, and a deterministic model
// makes the same class of mistake each time. The other misses are different: an empty
// answer or a crashed verification really can come good on a retry.
test('a mutant whose test would not run is not re-prompted with the same prompt',
  () => withSandbox(async (sb) => {
    const w = await killReady(sb, { mutants: mutantsAt(6, 12) });
    const target = (await sb.get('/api/mutant/next', { path: FILE })).mutant;
    const testPath = 'test/a-kill.test.ts';
    w.writeTest(testPath, { target: FILE, kills: [target.line], red: true });

    await sb.post('/api/mutant/verify', { file: FILE, mutant: target, testPaths: [testPath], phase: 'single' });

    const again = (await sb.get('/api/mutant/next', { path: FILE })).mutant;
    assert.ok(!again || again.line !== target.line,
      'the same mutant came back for an identical second try');
    const f = sb.file(FILE);
    assert.equal(Object.keys(f.mutantAttempts || {}).length, 1, 'the shot is spent');
  }));

test('an empty answer or a crash is still forgiven — those can come good', () => withSandbox(async (sb) => {
  const w = await killReady(sb, { mutants: mutantsAt(6, 12) });
  const target = (await sb.get('/api/mutant/next', { path: FILE })).mutant;

  await sb.post('/api/mutant/verify', { file: FILE, mutant: target, testPaths: [], phase: 'single' });

  const again = (await sb.get('/api/mutant/next', { path: FILE })).mutant;
  assert.equal(again.line, target.line, 'nothing was written, so nothing was learned about this mutant');
  assert.deepEqual(sb.file(FILE).mutantAttempts || {}, {});
}));

// ── a file its own repo excludes from coverage ───────────────────────────────
// Live on the target repo, lib/db.ts ended a run at mutation 68.18% and coverage 0%,
// which is arithmetically impossible: mutants only die when tests execute the code.
// The repo's vitest.config.ts says `coverage: { exclude: ['lib/db.ts'] }`, so the file
// is absent from every coverage summary and we recorded 0. MAC is coverage × mutation,
// so it stayed pinned at 0, the round was judged "no improvement", and tests that
// killed 68% of the file's mutants were discarded — 25.9k/27.6k tokens for nothing.
//
// Mutation above zero is proof the tests run. When coverage contradicts that, coverage
// is the unmeasurable one, and the round is judged on the number we can trust.
test('tests that kill mutants are kept even when the repo hides the file from coverage',
  () => withSandbox(async (sb) => {
    const w = installFakes(sb);
    await sb.start();
    w.addFile({ path: 'lib/db.ts', existingTest: 'test/db.test.ts',
      // the signature of an excluded file: tests exist and run, coverage never moves
      coverageWithTests: 0, coverageWithout: 0,
      mutants: [{ line: 10 }, { line: 20 }, { line: 30 }, { line: 40 }] });
    await sb.post('/api/coverage/run', { phase: 'baseline' });
    await sb.post('/api/iteration/start', { file: 'lib/db.ts' });
    await sb.post('/api/stryker/run', { file: 'lib/db.ts', phase: 'baseline' });
    const target = (await sb.get('/api/mutant/next', { path: 'lib/db.ts' })).mutant;
    w.writeTest('test/db-kill.test.ts', { target: 'lib/db.ts', kills: [target.line] });
    await sb.post('/api/mutant/verify', { file: 'lib/db.ts', mutant: target, testPaths: ['test/db-kill.test.ts'], phase: 'batch' });

    const v = await sb.post('/api/verify', { file: 'lib/db.ts' });

    assert.equal(v.coverageAfter, 0, 'the repo still reports no coverage for it');
    assert.ok((v.mutationAfter ?? 0) > 0, 'but mutants died, so the tests certainly run');
    assert.equal(v.coverageBlind, true, 'and the contradiction is recorded, not averaged away');
    assert.equal(v.improvedAny, true, 'a round that raised the only measurable number is progress');

    await sb.post('/api/round/accept', { file: 'lib/db.ts' });
    const d = await sb.post('/api/round/drop', { file: 'lib/db.ts' });
    assert.equal(d.improved, true,
      'and it reaches the PR: judging it on MAC alone throws away tests that kill 68% of a file');
  }));

// ── one take per file, and a crash is not a take ─────────────────────────────
// Observed on ts-debounce: a file's first sweep gained nothing, the file went back on
// the candidate list and was picked again, and the second sweep gained +6.35 MAC. That
// is the file-level retry, and it is separate from the mutant loop. The default is now
// one take — a file that gained nothing usually gains nothing next time either, and the
// durable queue keeps its untried sites for a later run. Teams who want a repo hardened
// rather than surveyed raise MAX_ATTEMPTS_PER_FILE.
test('a file that gained nothing is not offered again under the default', () => withSandbox(async (sb) => {
  await sb.start();
  assert.equal(S.state.run.config.maxAttemptsPerFile, 1, 'one take is the default');
  const w = installFakes(sb);
  w.addFile({ path: FILE, mutants: mutantsAt(4, 8) });
  await sb.post('/api/coverage/run', { phase: 'baseline' });
  await sb.post('/api/iteration/start', { file: FILE });
  await sb.post('/api/stryker/run', { file: FILE, phase: 'baseline' });
  await sb.post('/api/iteration/discard', { file: FILE, reason: 'nothing improved' });

  const again = await sb.get('/api/files/candidates');
  const offered = (again.files || again.candidates || again || []).map((f) => f.path || f);
  assert.ok(!offered.includes(FILE), `${FILE} was offered a second take`);
}));

test('a crashed baseline still gets another go, because no take was spent', () => withSandbox(async (sb) => {
  // the distinction that matters: a crash means we never wrote a test or called a
  // model, so charging it against the file's single take would blacklist a file for
  // one bad moment on a loaded machine
  const w = installFakes(sb);
  await sb.start();
  w.addFile({ path: FILE, mutants: mutantsAt(4) });
  await sb.post('/api/iteration/start', { file: FILE });
  w.failNext('stryker', new Error('stryker produced no report (exit 1)'));
  await sb.post('/api/stryker/run', { file: FILE, phase: 'baseline' });

  const slug = require('../util').slugify(sb.repoUrl);
  assert.equal(S.state.improvedLedger[slug]?.[FILE], undefined, 'not settled after one crash');
}));

// ── one repo's permissions must not end the run ──────────────────────────────
// createPr throws when the push is rejected or `gh pr create` fails, /api/pr/create did
// not catch it, and the generic handler turns a throw into a 500 that marks the run
// failed. The Create PR node has no onError, so the n8n execution ends there: every
// remaining candidate file is abandoned and the improved file keeps status 'picked'
// with a local commit and no ledger entry. One protected branch, or a token without
// write access, and hours of work on other files is thrown away.
async function readyForPr(sb) {
  const w = await killReady(sb, { mutants: [{ line: 10 }, { line: 20 }] });
  w.writeTest('test/a.kill-batch-pr.test.ts', { target: FILE, kills: [10], cases: 4 });
  await sb.post('/api/verify', { file: FILE });
  await sb.post('/api/round/accept', { file: FILE });
  await sb.post('/api/round/drop', { file: FILE });
  return w;
}

test('a rejected push costs that file, not the run', () => withSandbox(async (sb) => {
  const w = await readyForPr(sb);
  w.failNext('createPr', new Error('git push failed: remote: Permission to org/repo.git denied'));

  const r = await sb.post('/api/pr/create', { file: FILE, title: 'test: improve', body: '' });

  assert.equal(r.ok, true, 'the route must answer, or the graph stops at this node');
  assert.equal(r.pr, null);
  assert.match(r.error || '', /Permission/);
  assert.notEqual(S.state.run.status, 'failed', 'the run continues to the next file');
  assert.equal(sb.file(FILE).status, 'failed');
  assert.match(sb.events().join('\n'), /Permission/, 'and the operator is told why');
}));

test('the work is kept on disk when the PR cannot be opened', () => withSandbox(async (sb) => {
  // the tests are committed locally on the file's branch; losing the PR must not lose
  // them, or the run's whole output for that file is gone
  const w = await readyForPr(sb);
  w.failNext('createPr', new Error('gh: rate limit exceeded'));
  const r = await sb.post('/api/pr/create', { file: FILE, title: 't', body: '' });
  assert.equal(r.ok, true);
  // not `patchPath || branch`: branch is set by iteration/start and always truthy, so
  // that disjunction stayed green with the work deleted and no patch written
  assert.equal(w.exists('test/a.kill-batch-pr.test.ts'), true,
    'the committed test must survive a PR that could not be opened');
}));
