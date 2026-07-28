'use strict';
// UNIT TESTS for the sidecar routes — the code the workflow's HTTP Request nodes
// call. The route table is real; only the OS-touching layer underneath it is faked
// (see helpers/fakes.js). Every bug this pipeline has shipped was a STATE bug that
// the HTTP response hid, so these assert on state.files / the ledgers / the disk
// first and on the response second.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withSandbox, S, mutants, util } = require('./helpers/env');   // FIRST, always
const { installFakes } = require('./helpers/fakes');

const { mac } = util;
const FILE = 'src/a.ts';
const KILL_TEST = 'test/a-kill.test.ts';

/** All event messages of a sandbox as one searchable blob. */
const log = (sb) => sb.events().join('\n');

/** A run started with one universe file registered. */
async function started(sb, spec = {}, cfg = {}) {
  const w = installFakes(sb);
  await sb.start(cfg);
  w.addFile({ path: FILE, ...spec });
  return w;
}

/**
 * The state the mutant loop actually starts from: file picked, coverage measured,
 * baseline mutation run done. Mirrors the workflow's node order.
 */
async function killReady(sb, spec = {}, cfg = {}) {
  const w = await started(sb, { existingTest: 'test/a.test.ts', coverageWithTests: 80, ...spec }, cfg);
  await sb.post('/api/coverage/run', { phase: 'baseline', stage: 'measuring_baseline' });
  await sb.post('/api/iteration/start', { file: FILE });
  await sb.post('/api/stryker/run', { file: FILE, phase: 'baseline', stage: 'improving_mutation' });
  return w;
}

const manyMutants = (n) => Array.from({ length: n }, (_, i) => ({ line: i + 1 }));

// ═══════════════════════════════════════════════════════════════════════════
//  run/start
// ═══════════════════════════════════════════════════════════════════════════

test('run/start opens a fresh run and wipes everything the previous one left', () => withSandbox(async (sb) => {
  installFakes(sb);
  S.upsertFile('stale.ts', { status: 'improved' });
  S.state.decisions.pick_file = { rule: 'old' };
  S.state.prs.push({ url: 'old-pr' });
  S.state.pickFailures = 2;

  const r = await sb.call('POST /api/run/start', { repoUrl: sb.repoUrl, repoBranch: 'main', maxMutantsPerFile: 4 });

  assert.equal(r.ok, true);
  assert.equal(S.state.run.status, 'running');
  assert.equal(S.state.run.iteration, 0);
  assert.equal(S.state.run.config.repoUrl, sb.repoUrl);
  assert.equal(S.state.run.config.maxMutantsPerFile, 4);
  assert.equal(S.state.run.config.prBase, 'main', 'prBase defaults to the branch');
  assert.deepEqual(S.state.files, {});
  assert.deepEqual(S.state.decisions, {});
  assert.deepEqual(S.state.prs, []);
  assert.equal(S.state.pickFailures, 0);
  assert.equal(S.state.stage.name, 'starting');
}));

test('run/start refuses a second, concurrent run with 409 and leaves the live one alone', () => withSandbox(async (sb) => {
  installFakes(sb);
  await sb.call('POST /api/run/start', { repoUrl: sb.repoUrl });
  S.upsertFile(FILE, { status: 'picked' });

  await assert.rejects(
    () => sb.call('POST /api/run/start', { repoUrl: sb.repoUrl }),
    (e) => {
      assert.equal(e.statusCode, 409, 'a rejected concurrent start is a guard, not a run failure');
      assert.match(e.message, /a run is already active/);
      return true;
    });

  assert.equal(S.state.run.status, 'running');
  assert.equal(sb.file(FILE).status, 'picked', 'the active run keeps its work');
}));

test('run/start with force takes the run over and says so', () => withSandbox(async (sb) => {
  installFakes(sb);
  await sb.call('POST /api/run/start', { repoUrl: sb.repoUrl });
  S.upsertFile(FILE, { status: 'picked' });

  const r = await sb.call('POST /api/run/start', { repoUrl: sb.repoUrl, force: true });

  assert.equal(r.ok, true);
  assert.deepEqual(S.state.files, {}, 'the taken-over run leaves nothing behind');
  assert.match(log(sb), /taking over stale\/forced run/);
}));

test('run/start takes over a run that has been idle past the staleness window', () => withSandbox(async (sb) => {
  installFakes(sb);
  await sb.call('POST /api/run/start', { repoUrl: sb.repoUrl });
  S.state.stage.since = Math.floor(Date.now() / 1000) - 1000;   // window is 900 s

  const r = await sb.call('POST /api/run/start', { repoUrl: sb.repoUrl });

  assert.equal(r.ok, true, 'a genuinely dead run must not block the box forever');
  assert.match(log(sb), /taking over stale\/forced run/);
}));

test('run/start silently replaces an explicit per-file cap of 0 with the default', () => withSandbox(async (sb) => {
  // REPORTED, NOT FIXED: freshRun() ends with `parseInt(x, 10) || 5`, so an
  // operator asking for maxMutantsPerFile: 0 ("skip the mutant loop") gets 5 and
  // is never told. Same for maxRoundsPerFile (0 → 5) and maxAttemptsPerFile
  // (0 → 3). scopeLimit and maxIterations document 0 as "unlimited" and handle
  // it; these three do not document 0 at all. This test pins today's behaviour
  // so a change to it has to be deliberate.
  installFakes(sb);
  await sb.call('POST /api/run/start', {
    repoUrl: sb.repoUrl, maxMutantsPerFile: 0, maxRoundsPerFile: 0, maxAttemptsPerFile: 0,
  });

  assert.equal(S.state.run.config.maxMutantsPerFile, 5);
  assert.equal(S.state.run.config.maxRoundsPerFile, 5);
  assert.equal(S.state.run.config.maxAttemptsPerFile, 3);
}));

test('run/start keeps the per-repo ledger unless clearLedger is asked for', () => withSandbox(async (sb) => {
  installFakes(sb);
  S.state.improvedLedger[sb.repoSlug] = { 'src/old.ts': { state: 'improved', ts: 1 } };

  await sb.call('POST /api/run/start', { repoUrl: sb.repoUrl });
  assert.ok(S.state.improvedLedger[sb.repoSlug]['src/old.ts'], 'settled files survive a new batch');

  await sb.call('POST /api/run/start', { repoUrl: sb.repoUrl, force: true, clearLedger: true });
  assert.equal(S.state.improvedLedger[sb.repoSlug], undefined);
}));

// ═══════════════════════════════════════════════════════════════════════════
//  coverage/run
// ═══════════════════════════════════════════════════════════════════════════

test('coverage/run at baseline records the baseline, per-file coverage and per-file MAC', () => withSandbox(async (sb) => {
  const w = await started(sb, { coverageWithTests: 80, existingTest: 'test/a.test.ts' });
  w.addFile({ path: 'src/b.ts', coverageWithout: 0 });
  S.upsertFile(FILE, { mutation: 50 });

  const r = await sb.post('/api/coverage/run', { phase: 'baseline', stage: 'measuring_baseline' });

  assert.equal(r.ok, true);
  assert.equal(r.totalPct, 40);                       // (80 + 0) / 2
  assert.equal(S.state.run.baseline.coveragePct, 40);
  assert.equal(S.state.run.result.coveragePct, 40);
  assert.equal(sb.file(FILE).coverage, 80);
  assert.equal(sb.file('src/b.ts').coverage, 0, 'a file the suite never loaded is 0 %, not null');
  assert.equal(sb.file(FILE).mac, 40, 'MAC is recomputed from the fresh coverage');
  assert.equal(sb.file('src/b.ts').mac, null, 'no mutation score yet → no MAC');
  assert.equal(S.state.stage.name, 'measuring_baseline');
}));

test('coverage/run outside the baseline phase moves only the current result', () => withSandbox(async (sb) => {
  const w = await started(sb, { coverageWithTests: 90, existingTest: 'test/a.test.ts' });
  await sb.post('/api/coverage/run', { phase: 'baseline' });
  assert.equal(S.state.run.baseline.coveragePct, 90);

  w.totalCoverage = 95;
  const r = await sb.post('/api/coverage/run', {});

  assert.equal(r.totalPct, 95);
  assert.equal(S.state.run.result.coveragePct, 95);
  assert.equal(S.state.run.baseline.coveragePct, 90, 'the baseline is measured once');
}));

// ═══════════════════════════════════════════════════════════════════════════
//  stryker/run
// ═══════════════════════════════════════════════════════════════════════════

test('stryker/run at baseline writes the before-numbers, the measure ledger and the survivor list', () => withSandbox(async (sb) => {
  await started(sb, {
    coverageWithTests: 80, existingTest: 'test/a.test.ts', existingTestKills: [10],
    mutants: [{ line: 10 }, { line: 20 }, { line: 30, status: 'nocoverage' }, { line: 40 }],
  });
  await sb.post('/api/coverage/run', { phase: 'baseline' });

  const r = await sb.post('/api/stryker/run', { file: FILE, phase: 'baseline', stage: 'improving_mutation' });

  assert.equal(r.ok, true);
  assert.equal(r.totalMutants, 4);
  assert.equal(r.killed, 1);
  assert.equal(r.score, 25);
  assert.equal(r.survivedTotal, 3);
  assert.equal(Object.prototype.hasOwnProperty.call(r, 'survivedAll'), false,
    'the identity-only survivor list is internal — it must not reach n8n execution data');
  assert.equal(r.survived[0].status, 'survived', 'covered survivors come first');
  assert.equal(r.survived[2].status, 'nocoverage');

  const f = sb.file(FILE);
  assert.equal(f.mutation, 25);
  assert.equal(f.mutationBefore, 25);
  assert.equal(f.coverageBefore, 80);
  assert.equal(f.macBefore, mac(80, 25));
  assert.equal(f.mac, mac(80, 25));
  assert.equal(f.totalMutants, 4);
  assert.equal(f.survivedTotal, 3);
  assert.equal(f.lastSurvived.length, 3);
  assert.equal(S.state.run.baseline.mutationPct, 25);
  assert.equal(S.state.run.baseline.mac, mac(80, 25));

  const m = S.state.measureLedger[sb.repoSlug][FILE];
  assert.equal(m.coverageBefore, 80);
  assert.equal(m.mutationBefore, 25);
  assert.equal(m.macBefore, mac(80, 25));
}));

test('stryker/run fails one file softly at baseline instead of sinking the run', () => withSandbox(async (sb) => {
  const w = await started(sb, { coverageWithTests: 80, existingTest: 'test/a.test.ts', mutants: [{ line: 10 }] });
  await sb.post('/api/coverage/run', { phase: 'baseline' });
  w.failNext('stryker', new Error('stryker produced no report (exit 1): out of memory'));

  const r = await sb.post('/api/stryker/run', { file: FILE, phase: 'baseline' });

  assert.equal(r.ok, false);
  assert.equal(r.failed, true);
  assert.equal(r.score, 0);
  assert.deepEqual(r.survived, []);
  assert.equal(sb.file(FILE).status, 'failed');
  assert.match(sb.file(FILE).failure, /no report/);
  assert.equal(sb.file(FILE).coverageBefore, 80, 'the coverage we did measure is kept');
  assert.equal(S.state.improvedLedger[sb.repoSlug]?.[FILE], undefined,
    'ONE crash must not settle the file — the ledger is replayed in every later batch, '
    + 'so a timeout would blacklist it forever');
  assert.equal(S.state.measureLedger[sb.repoSlug][FILE].baselineCrashes, 1,
    'but the crash is counted, so a file that always crashes still settles');
  assert.match(S.state.measureLedger[sb.repoSlug][FILE].failure, /no report/);
  assert.equal(S.state.run.status, 'running', 'one broken file must not end the run');
}));

test('a soft baseline failure un-picks the file, so the workflow must route around it', () => withSandbox(async (sb) => {
  // The soft fail marks the file `failed`, which also means pickedFile() finds
  // nobody. Everything downstream keys off the picked file — recordTokens,
  // recordDialog, the stale-survivors flag — so continuing into the coverage and
  // mutant phases would spend model time on work attributed to no file at all and
  // evaluated against no baseline. "Baseline OK?" is the IF that routes around it;
  // this test pins the state that condition reads.
  const w = await started(sb, { coverageWithTests: 80, existingTest: 'test/a.test.ts', mutants: [{ line: 10 }] });
  await sb.post('/api/coverage/run', { phase: 'baseline' });
  await sb.post('/api/iteration/start', { file: FILE });
  w.failNext('stryker', new Error('stryker produced no report (exit 1)'));

  const r = await sb.post('/api/stryker/run', { file: FILE, phase: 'baseline' });

  assert.equal(r.failed, true, 'the flag the Baseline OK? condition branches on');
  assert.equal(sb.file(FILE).status, 'failed');
  assert.equal(sb.file(FILE).failedKind, 'measurement',
    'a measurement crash is tagged, so it does not spend the scope quota meant for improvements');
}));

test('stryker/run outside the baseline phase lets the error through', () => withSandbox(async (sb) => {
  const w = await killReady(sb, { mutants: [{ line: 10 }] });
  w.failNext('stryker', new Error('stryker exploded mid-round'));

  await assert.rejects(() => sb.post('/api/stryker/run', { file: FILE }), /stryker exploded mid-round/);
  assert.notEqual(sb.file(FILE).status, 'failed', 'only the baseline phase settles a file on failure');
}));

// ═══════════════════════════════════════════════════════════════════════════
//  files/gaps
// ═══════════════════════════════════════════════════════════════════════════

test('files/gaps asks for a bootstrap when the file is not executed at all', () => withSandbox(async (sb) => {
  await started(sb, { coverageWithout: 0, mutants: [{ line: 10 }] });
  await sb.post('/api/coverage/run', { phase: 'baseline' });

  const r = await sb.get('/api/files/gaps', { path: FILE });

  assert.equal(r.ok, true);
  assert.equal(r.needsBootstrap, true);
  assert.equal(r.uncovered.lines, 'all');
  assert.equal(r.testExists, false);
  assert.equal(r.existingTest, null, 'no test anywhere in the repo → no style reference either');
  assert.equal(r.testPath, 'src/a.test.ts');
  assert.equal(r.runner, 'vitest');
  assert.ok(r.source.startsWith('// src/a.ts'));
  assert.equal(r.sourceLines, 60);
  assert.equal(S.state.stage.name, 'improving_coverage');
}));

test('files/gaps stops asking for a bootstrap once the file is covered', () => withSandbox(async (sb) => {
  await started(sb, {
    coverageWithTests: 70, existingTest: 'test/a.test.ts', uncovered: [12, 13],
    mutants: [{ line: 10 }],
  });
  await sb.post('/api/coverage/run', { phase: 'baseline' });
  S.upsertFile(FILE, { rounds: 2, lastSurvived: [{ mutator: 'EqualityOperator', line: 10 }] });

  const r = await sb.get('/api/files/gaps', { path: FILE });

  assert.equal(r.needsBootstrap, false, 'coverage exists — killing mutants raises coverage from here');
  assert.deepEqual(r.uncovered.lines, [12, 13]);
  assert.equal(r.testExists, true);
  assert.equal(r.testPath, 'test/a.test.ts');
  assert.match(r.existingTest, /TARGET: src\/a\.ts/, 'the real test is handed over, not a style reference');
  assert.equal(r.rounds, 2);
  assert.equal(r.survived.length, 1);
}));

test('files/gaps hands over a sibling test as a style reference when the file has none', () => withSandbox(async (sb) => {
  const w = await started(sb, { coverageWithout: 0, mutants: [{ line: 10 }] });
  // another file in the repo does have a test — that is the convention to imitate
  w.addFile({ path: 'src/b.ts', existingTest: { path: 'test/b.test.ts', content: w.testSource({ target: 'src/b.ts', cases: 6 }) } });
  await sb.post('/api/coverage/run', { phase: 'baseline' });

  const r = await sb.get('/api/files/gaps', { path: FILE });

  assert.equal(r.needsBootstrap, true);
  assert.equal(r.testExists, false);
  assert.match(r.existingTest, /^\/\/ STYLE REFERENCE/);
  assert.match(r.existingTest, /test\/b\.test\.ts/);
  assert.equal(r.testPath, 'test/a.test.ts', 'the dominant convention wins over colocation');
}));

// ═══════════════════════════════════════════════════════════════════════════
//  test/write-many
// ═══════════════════════════════════════════════════════════════════════════

test('test/write-many marks the survivor list stale after a coverage bootstrap', () => withSandbox(async (sb) => {
  const w = await started(sb, { mutants: [{ line: 10 }] });
  await sb.post('/api/iteration/start', { file: FILE });

  const r = await sb.post('/api/test/write-many', {
    stage: 'improving_coverage',
    tests: [{ path: 'test/a.test.ts', content: w.testSource({ target: FILE }) }],
  });

  assert.deepEqual(r.written, ['test/a.test.ts']);
  assert.deepEqual(r.errors, []);
  assert.ok(w.exists('test/a.test.ts'));
  assert.equal(sb.file(FILE).survivorsStale, true,
    'the survivor list came from a run when this file had no tests — it is now worthless');
}));

test('test/write-many does not stale the list for kill-phase tests (mutant/verify re-measures anyway)', () => withSandbox(async (sb) => {
  const w = await killReady(sb, { mutants: [{ line: 10 }] });

  await sb.post('/api/test/write-many', {
    stage: 'improving_mutation',
    tests: [{ path: KILL_TEST, content: w.testSource({ target: FILE, kills: [10] }) }],
  });

  assert.equal(sb.file(FILE).survivorsStale, undefined);
}));

test('test/write-many reports a refused path instead of throwing, and never stales on zero writes', () => withSandbox(async (sb) => {
  await started(sb, { mutants: [{ line: 10 }] });
  await sb.post('/api/iteration/start', { file: FILE });

  const r = await sb.post('/api/test/write-many', {
    stage: 'improving_coverage',
    tests: [{ path: 'src/sneaky.ts', content: 'export const x = 1;' }],
  });

  assert.deepEqual(r.written, []);
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0].error, /refusing to write outside test locations/);
  assert.equal(sb.file(FILE).survivorsStale, undefined, 'nothing was written, so nothing became stale');
}));

test('test/write-many writes at most five files', () => withSandbox(async (sb) => {
  const w = await started(sb, { mutants: [{ line: 10 }] });
  await sb.post('/api/iteration/start', { file: FILE });
  const tests = Array.from({ length: 7 }, (_, i) => ({
    path: `test/gen-${i}.test.ts`, content: w.testSource({ target: FILE }),
  }));

  const r = await sb.post('/api/test/write-many', { stage: 'improving_coverage', tests });

  assert.equal(r.written.length, 5);
  assert.equal(w.exists('test/gen-5.test.ts'), false);
}));

// ═══════════════════════════════════════════════════════════════════════════
//  mutant/next
// ═══════════════════════════════════════════════════════════════════════════

test('mutant/next skips the model when the heuristic left only one candidate', () => withSandbox(async (sb) => {
  const w = await killReady(sb, { mutants: [{ line: 10 }] });

  const r = await sb.get('/api/mutant/next', { path: FILE });

  assert.equal(r.done, false);
  assert.equal(r.mutant.line, 10);
  assert.equal(r.pickedBy, 'heuristic (only one candidate)');
  assert.equal(r.candidatesConsidered, 1);
  assert.equal(w.llm.calls.length, 0, 'no model call is worth making with nothing to choose between');
  assert.deepEqual(r.verifyRange, { from: 1, to: 22 });
  assert.equal(r.budget, 5);
  assert.equal(r.attemptsSpent, 0);
  assert.equal(r.failures, 0);
  assert.equal(r.testPath, 'test/a.test.ts');
  assert.equal(r.testExists, true);
  assert.equal(r.sourceLines, 60);
}));

test('mutant/next lets the model overrule the ranking and records the decision', () => withSandbox(async (sb) => {
  const w = await killReady(sb, {
    mutants: [{ line: 10, mutator: 'EqualityOperator' }, { line: 40, mutator: 'StringLiteral' }],
  });
  w.llm.replyJson({ pick: 2, reason: 'the string is compared, so it is observable', killIdea: 'assert the returned message' });

  const r = await sb.get('/api/mutant/next', { path: FILE });

  assert.equal(r.pickedBy, 'llm');
  assert.equal(r.mutant.line, 40, 'the heuristic ranked line 10 first; the model chose otherwise');
  assert.equal(r.killIdea, 'assert the returned message');
  assert.equal(r.candidatesConsidered, 2);
  assert.equal(w.llm.calls.length, 1);
  assert.equal(w.llm.calls[0].decision, true);
  assert.equal(w.llm.calls[0].json, true);
  const d = S.state.decisions.pick_mutant;
  assert.equal(d.result.file, FILE);
  assert.equal(d.result.line, 40);
  assert.equal(d.result.consideredCandidates, 2);
  assert.match(d.result.reason, /observable/);
  assert.match(log(sb), /LLM picked StringLiteral at line 40/);
}));

test('mutant/next falls back to the ranking when the model answer is unusable', () => withSandbox(async (sb) => {
  const w = await killReady(sb, {
    mutants: [{ line: 10, mutator: 'EqualityOperator' }, { line: 40, mutator: 'StringLiteral' }],
  });
  w.llm.replyJson({ pick: 99, reason: 'off the end of the list' });

  const r = await sb.get('/api/mutant/next', { path: FILE });

  assert.equal(r.pickedBy, 'heuristic (LLM answer unusable)');
  assert.equal(r.mutant.line, 10);
  assert.equal(S.state.decisions.pick_mutant, undefined, 'an unusable answer is not a decision');
  assert.match(log(sb), /LLM answer unusable/);
}));

test('mutant/next falls back to the ranking when the model call throws', () => withSandbox(async (sb) => {
  const w = await killReady(sb, {
    mutants: [{ line: 10, mutator: 'EqualityOperator' }, { line: 40, mutator: 'StringLiteral' }],
  });
  w.llm.fail('LLM HTTP 502: bad gateway');

  const r = await sb.get('/api/mutant/next', { path: FILE });

  assert.equal(r.pickedBy, 'heuristic (LLM error)');
  assert.equal(r.mutant.line, 10);
  assert.match(log(sb), /mutant choice: LLM error/);
}));

test('BUG-2 REGRESSION: mutant/next re-measures a stale survivor list instead of quitting', () => withSandbox(async (sb) => {
  // A 0-coverage file: at baseline nothing executes it, so Stryker reports
  // "no tests were executed" and the survivor list is empty. The coverage
  // bootstrap then makes the whole file mutable — and the loop used to look at
  // that stale empty list and conclude there was nothing left to kill.
  const w = await started(sb, { coverageWithout: 0, coverageWithTests: 70, mutants: [{ line: 10 }] });
  await sb.post('/api/coverage/run', { phase: 'baseline' });
  await sb.post('/api/iteration/start', { file: FILE });

  const base = await sb.post('/api/stryker/run', { file: FILE, phase: 'baseline' });
  assert.equal(base.noTests, true);
  assert.deepEqual(sb.file(FILE).lastSurvived, [], 'nothing to work from yet');

  await sb.post('/api/test/write-many', {
    stage: 'improving_coverage',
    tests: [{ path: 'test/a.test.ts', content: w.testSource({ target: FILE }) }],
  });
  assert.equal(sb.file(FILE).survivorsStale, true);

  const strykerRuns = w.calls.stryker.length;
  const r = await sb.get('/api/mutant/next', { path: FILE });

  assert.equal(w.calls.stryker.length, strykerRuns + 1, 'a stale list is re-measured, not believed');
  assert.equal(r.done, false);
  assert.equal(r.mutant.line, 10);
  const f = sb.file(FILE);
  assert.equal(f.survivorsStale, false, 'the flag is cleared so the next round does not re-measure for free');
  assert.equal(f.survivedTotal, 1);
  assert.equal(f.mutation, 0);
}));

test('a fresh-but-empty survivor list ends the mutant loop without re-measuring', () => withSandbox(async (sb) => {
  const w = await killReady(sb, { mutants: [{ line: 10, killedAtBaseline: true }] });
  const strykerRuns = w.calls.stryker.length;

  const r = await sb.get('/api/mutant/next', { path: FILE });

  assert.equal(r.done, true);
  assert.match(r.reason, /no viable surviving mutants left/);
  assert.equal(w.calls.stryker.length, strykerRuns, 'a list that is known-current is believed');
}));

test('mutant/next survives a failed re-measure by clearing the flag and reporting done', () => withSandbox(async (sb) => {
  const w = await started(sb, { coverageWithout: 0, mutants: [{ line: 10 }] });
  await sb.post('/api/coverage/run', { phase: 'baseline' });
  await sb.post('/api/iteration/start', { file: FILE });
  await sb.post('/api/stryker/run', { file: FILE, phase: 'baseline' });
  await sb.post('/api/test/write-many', {
    stage: 'improving_coverage',
    tests: [{ path: 'test/a.test.ts', content: w.testSource({ target: FILE }) }],
  });
  w.failNext('stryker', new Error('stryker produced no report (exit 1)'));

  const r = await sb.get('/api/mutant/next', { path: FILE });

  assert.equal(r.done, true);
  assert.equal(sb.file(FILE).survivorsStale, false, 'a failed re-measure must not loop forever');
  assert.match(log(sb), /mutation re-measure failed on src\/a\.ts/);
}));

test('mutant/next stops on wasted attempts, counting waste and not kills', () => withSandbox(async (sb) => {
  await killReady(sb, { mutants: [{ line: 10 }] }, { maxMutantsPerFile: 2 });

  // plenty of successful work done, one failure — the loop must keep going
  S.upsertFile(FILE, { mutantFailures: 1, mutantsKilled: 9, mutantAttemptCount: 10 });
  const keepGoing = await sb.get('/api/mutant/next', { path: FILE });
  assert.equal(keepGoing.done, false, 'successful kills must not exhaust the budget');
  assert.equal(keepGoing.failures, 1);

  S.upsertFile(FILE, { mutantFailures: 2 });
  const r = await sb.get('/api/mutant/next', { path: FILE });
  assert.equal(r.done, true);
  assert.equal(r.mutant, null);
  assert.match(r.reason, /attempt budget spent \(2 test\(s\) killed nothing, 0 could not be written or run; 9 killed\)/);
}));

test('mutant/next stops at the hard attempt ceiling even with budget left', () => withSandbox(async (sb) => {
  await killReady(sb, { mutants: [{ line: 10 }] }, { maxMutantsPerFile: 2 });
  S.upsertFile(FILE, { mutantFailures: 0, mutantAttemptCount: 12 });   // ceiling = budget * 6

  const r = await sb.get('/api/mutant/next', { path: FILE });

  assert.equal(r.done, true);
  assert.match(r.reason, /hard attempt ceiling 12 reached/);
}));

test('mutant/next tells the picker what already resisted a targeted test', () => withSandbox(async (sb) => {
  const w = await killReady(sb, {
    mutants: [{ line: 10, mutator: 'EqualityOperator' }, { line: 40, mutator: 'StringLiteral' }],
  });
  const resisted = { mutator: 'EqualityOperator', line: 10, column: 5, replacement: '<=' };
  S.upsertFile(FILE, { mutantAttempts: { [mutants.mutantKey(resisted)]: 1 } });
  w.llm.replyJson({ pick: 1, reason: 'only one left', killIdea: 'k' });

  const r = await sb.get('/api/mutant/next', { path: FILE });

  assert.equal(r.mutant.line, 40, 'a mutant that already had its one shot is off the shortlist');
  assert.equal(r.candidatesConsidered, 1, 'and the shortlist shrank accordingly');
}));

// ═══════════════════════════════════════════════════════════════════════════
//  mutant/verify
// ═══════════════════════════════════════════════════════════════════════════

test('mutant/verify deletes a test that fails, without spending the mutant\'s one shot', () => withSandbox(async (sb) => {
  const w = await killReady(sb, { mutants: [{ line: 10 }] });
  const next = await sb.get('/api/mutant/next', { path: FILE });
  w.writeTest(KILL_TEST, { target: FILE, kills: [10], red: true });
  const strykerRuns = w.calls.stryker.length;

  const r = await sb.post('/api/mutant/verify', { file: FILE, mutant: next.mutant, testPaths: [KILL_TEST] });

  assert.equal(r.killed, false);
  assert.equal(r.reason, 'suite red');
  assert.match(r.summary, /FAIL/);
  assert.equal(w.exists(KILL_TEST), false, 'a test that breaks the build is never worth keeping');
  assert.equal(w.calls.stryker.length, strykerRuns, 'no point measuring mutants against a red suite');

  const f = sb.file(FILE);
  // A test that fails against the UNMUTATED code is a broken test. That says nothing
  // about whether the mutant can be killed, so it is counted as a generation miss —
  // capped per target and by its own ceiling — rather than retiring the target and
  // charging the budget that exists to stop wasted tests.
  assert.equal(f.mutantAttempts[mutants.mutantKey(next.mutant)], undefined, 'the target keeps its shot');
  assert.equal(f.mutantAttemptCount, 1);
  assert.equal(f.mutantFailures || 0, 0);
  assert.equal(f.mutantGenFailures, 1);
  assert.equal(f.mutantsKilled, 0);
}));

test('mutant/verify keeps the test and retires nothing when the target dies', () => withSandbox(async (sb) => {
  const w = await killReady(sb, { mutants: [{ line: 10 }, { line: 40, killedAtBaseline: true }] });
  const next = await sb.get('/api/mutant/next', { path: FILE });
  w.writeTest(KILL_TEST, { target: FILE, kills: [10] });

  const r = await sb.post('/api/mutant/verify', { file: FILE, mutant: next.mutant, testPaths: [KILL_TEST] });

  assert.equal(r.killed, true);
  assert.equal(r.killedTarget, true);
  assert.equal(r.killedCount, 1);
  assert.equal(r.collateral, 0);
  assert.equal(r.killedSoFar, 1);
  assert.ok(w.exists(KILL_TEST));

  const f = sb.file(FILE);
  assert.deepEqual(f.mutantAttempts, {}, 'a mutant that died was never a failed attempt');
  assert.equal(f.mutantAttemptCount, 1);
  assert.equal(f.mutantFailures, 0);
  assert.equal(f.mutantsKilled, 1);
  // The window that verified this kill scored only the lines around it, so it may not
  // set the file's score — /api/verify owns that, from a whole-file run. The queue and
  // the per-attempt estimate are what the fast path maintains.
  assert.equal(f.survivedTotal, 0, 'the queue loses what the window proved dead');
  assert.equal(f.attemptMutation, 100, '1 of 1 mutant dead');
  assert.deepEqual(f.lastSurvived, []);
  assert.equal(S.state.measureLedger[sb.repoSlug][FILE].attemptMutation, 100);
}));

test('mutant/verify keeps a test that killed only neighbours, and still retires the target', () => withSandbox(async (sb) => {
  // line 10 is EQUIVALENT: no test can ever kill it. The test aimed at it happens
  // to kill line 20, which takes line 24 with it as declared collateral.
  const w = await killReady(sb, {
    mutants: [{ line: 10, equivalent: true }, { line: 20, collateral: [24] }, { line: 24 }],
  });
  // resolvePick tolerates a LINE number when it is not a valid 1-based index
  w.llm.replyJson({ pick: 10, reason: 'aiming at line 10', killIdea: 'k' });
  const next = await sb.get('/api/mutant/next', { path: FILE });
  assert.equal(next.mutant.line, 10);
  w.writeTest(KILL_TEST, { target: FILE, kills: [10, 20] });

  const r = await sb.post('/api/mutant/verify', { file: FILE, mutant: next.mutant, testPaths: [KILL_TEST] });

  assert.equal(r.killed, true, 'collateral kills are real improvement');
  assert.equal(r.killedTarget, false);
  assert.equal(r.killedCount, 2);
  assert.equal(r.collateral, 2);
  assert.ok(w.exists(KILL_TEST));

  const f = sb.file(FILE);
  assert.equal(f.mutantAttempts[mutants.mutantKey(next.mutant)], 1,
    'the target survived, so it is retired — one shot per mutant whatever else the test achieved');
  assert.equal(f.mutantFailures, 0, 'but the failure budget is only charged when nothing at all died');
  assert.equal(f.mutantsKilled, 0);
  assert.equal(f.survivedTotal, 1);
}));

test('mutant/verify drops the test and charges a failure when nothing dies', () => withSandbox(async (sb) => {
  const w = await killReady(sb, { mutants: [{ line: 10, equivalent: true }, { line: 40, killedAtBaseline: true }] });
  const next = await sb.get('/api/mutant/next', { path: FILE });
  w.writeTest(KILL_TEST, { target: FILE, kills: [10] });

  const r = await sb.post('/api/mutant/verify', { file: FILE, mutant: next.mutant, testPaths: [KILL_TEST] });

  assert.equal(r.killed, false);
  assert.equal(r.killedCount, 0);
  assert.equal(r.reason, 'no mutant died');
  assert.equal(w.exists(KILL_TEST), false);

  const f = sb.file(FILE);
  assert.equal(f.mutantAttempts[mutants.mutantKey(next.mutant)], 1);
  assert.equal(f.mutantFailures, 1);
  assert.equal(f.mutantsKilled, 0);
}));

test('mutant/verify treats an unverifiable kill as no kill', () => withSandbox(async (sb) => {
  const w = await killReady(sb, { mutants: [{ line: 10 }] });
  const next = await sb.get('/api/mutant/next', { path: FILE });
  w.writeTest(KILL_TEST, { target: FILE, kills: [10] });
  // both runs: the window check and the whole-file fallback
  w.failAlways('stryker', new Error('stryker produced no report (exit 137): killed'));
  sb.onCleanup(() => w.stopFailing('stryker'));

  const r = await sb.post('/api/mutant/verify', { file: FILE, mutant: next.mutant, testPaths: [KILL_TEST] });

  assert.equal(r.killed, false);
  assert.match(r.reason, /mutation re-run failed/);
  assert.equal(w.exists(KILL_TEST), false, 'an unverified test is discarded, not committed on faith');
  // the test goes, but the MUTANT is not judged: Stryker crashing says nothing
  // about whether that mutant is killable, so it keeps its one shot
  assert.equal(sb.file(FILE).mutantFailures || 0, 0, 'an infrastructure failure spends no budget');
  assert.deepEqual(sb.file(FILE).mutantAttempts || {}, {}, 'and retires nothing');
  assert.equal(sb.file(FILE).mutation, 0, 'the last known-good measurement is left alone');
}));

test('mutant/verify does NOT charge an attempt when the model produced no test at all', () => withSandbox(async (sb) => {
  const w = await killReady(sb, { mutants: [{ line: 10 }] });
  const next = await sb.get('/api/mutant/next', { path: FILE });
  const suiteRuns = w.calls.tests.length;

  const r = await sb.post('/api/mutant/verify', { file: FILE, mutant: next.mutant, testPaths: [] });

  assert.equal(r.killed, false);
  assert.equal(r.reason, 'no test was written');
  assert.equal(w.calls.tests.length, suiteRuns, 'nothing changed, so nothing is run');
  const f = sb.file(FILE);
  // A mutant's one shot is spent by EVIDENCE — a test was written and it survived.
  // An empty answer is evidence of nothing, and the failure budget exists to stop
  // wasted tests, not to let a truncated reply end the loop.
  assert.equal(f.mutantAttempts[mutants.mutantKey(next.mutant)], undefined);
  assert.equal(f.mutantFailures || 0, 0);
  assert.equal(f.mutantGenFailures, 1, 'it is counted separately, with its own ceiling');
}));

test('BUG-3 REGRESSION: a target past the 100-survivor cap is not reported as killed', () => withSandbox(async (sb) => {
  // 130 survivors. lastSurvived (and Stryker's `survived`) hold the first 100;
  // asking "is my mutant still in there?" against that capped array reports a
  // false kill for every mutant past the cap — exactly the weakly-tested files
  // where the cap bites. The question must be asked of survivedAll.
  const w = await killReady(sb, { sourceLines: 160, mutants: manyMutants(130) });
  assert.equal(sb.file(FILE).survivedTotal, 130);
  assert.equal(sb.file(FILE).lastSurvived.length, 100);

  const target = { mutator: 'EqualityOperator', line: 125, column: 5, replacement: '<=' };
  assert.ok(!sb.file(FILE).lastSurvived.some((s) => s.line === 125), 'the target is past the cap');
  w.writeTest(KILL_TEST, { target: FILE, kills: [3] });   // kills a different mutant

  const r = await sb.post('/api/mutant/verify', { file: FILE, mutant: target, testPaths: [KILL_TEST] });

  assert.equal(r.killed, true, 'the collateral kill earns the test its place');
  assert.equal(r.killedTarget, false, 'the target at line 125 is alive and must be reported as alive');
  assert.equal(r.killedCount, 1);
  const f = sb.file(FILE);
  assert.equal(f.mutantsKilled, 0, 'a false kill would have inflated this');
  assert.equal(f.mutantAttempts[mutants.mutantKey(target)], 1, 'and would have left the target pickable again');
  assert.equal(f.survivedTotal, 129);
  assert.equal(f.lastSurvived.length, 100);
}));

test('two verified kills in a row keep the counters and the survivor queue exact', () => withSandbox(async (sb) => {
  const w = await killReady(sb, { mutants: [{ line: 10 }, { line: 20 }, { line: 40, killedAtBaseline: true }] });
  w.llm.onCall(() => ({ text: '{"pick":1}', json: { pick: 1, reason: 'top of the ranking', killIdea: 'k' } }));

  const first = await sb.get('/api/mutant/next', { path: FILE });
  assert.equal(first.mutant.line, 10);
  w.writeTest(KILL_TEST, { target: FILE, kills: [10] });
  await sb.post('/api/mutant/verify', { file: FILE, mutant: first.mutant, testPaths: [KILL_TEST] });
  assert.equal(sb.file(FILE).survivedTotal, 1, 'the killed mutant is pruned from the queue');

  const second = await sb.get('/api/mutant/next', { path: FILE });
  assert.equal(second.mutant.line, 20, 'and the next round attacks what is actually left');
  assert.equal(second.candidatesConsidered, 1);
  w.writeTest('test/a-kill2.test.ts', { target: FILE, kills: [20] });
  await sb.post('/api/mutant/verify', { file: FILE, mutant: second.mutant, testPaths: ['test/a-kill2.test.ts'] });

  const f = sb.file(FILE);
  assert.equal(f.mutantsKilled, 2);
  assert.equal(f.mutantAttemptCount, 2);
  assert.equal(f.mutantFailures, 0);
  assert.deepEqual(f.mutantAttempts, {});
  assert.equal(f.survivedTotal, 0, 'the queue is empty because both mutants are proven dead');
  // The window fast path does not write the file's SCORE — that is a whole-file
  // measurement and /api/verify owns it. What it does maintain is the survivor count,
  // from which the dashboard's per-attempt estimate is derived.
  assert.equal(f.attemptMutation, 100, '2 of 2 mutants dead');

  const done = await sb.get('/api/mutant/next', { path: FILE });
  assert.equal(done.done, true);
  assert.match(done.reason, /no viable surviving mutants left/);
}));

test('the loop retires equivalent mutants one shot each and ends before the budget does', () => withSandbox(async (sb) => {
  // The case a real Stryker fixture cannot express: mutants no test can ever kill.
  // One shot per mutant is what stops the pipeline burning a full generation on
  // each of them forever.
  const w = await killReady(sb, {
    mutants: [{ line: 10, equivalent: true }, { line: 20, equivalent: true }, { line: 30, equivalent: true }],
  }, { maxMutantsPerFile: 5 });
  w.llm.onCall(() => ({ text: '{"pick":1}', json: { pick: 1, reason: 'least equivalent-looking', killIdea: 'k' } }));

  const attacked = [];
  for (let i = 0; i < 4; i++) {
    const next = await sb.get('/api/mutant/next', { path: FILE });
    if (next.done) { assert.equal(i, 3, 'exactly three attempts, one per mutant'); break; }
    attacked.push(next.mutant.line);
    w.writeTest(KILL_TEST, { target: FILE, kills: [next.mutant.line] });
    const v = await sb.post('/api/mutant/verify', { file: FILE, mutant: next.mutant, testPaths: [KILL_TEST] });
    assert.equal(v.killed, false);
    assert.equal(w.exists(KILL_TEST), false, 'a test that killed nothing is not committed');
  }

  assert.deepEqual(attacked, [10, 20, 30]);
  const f = sb.file(FILE);
  assert.equal(f.mutantFailures, 3, 'the loop ended on "nothing viable left", not on the budget');
  assert.ok(f.mutantFailures < 5);
  assert.equal(f.mutantAttemptCount, 3);
  assert.equal(f.mutantsKilled, 0);
  assert.equal(f.survivedTotal, 3, 'equivalent mutants stay in the score forever — that is honest');
}));

// ═══════════════════════════════════════════════════════════════════════════
//  verify
// ═══════════════════════════════════════════════════════════════════════════

test('verify records the round result and calls it progress', () => withSandbox(async (sb) => {
  const w = await killReady(sb, { mutants: [{ line: 10 }, { line: 20 }] });
  w.writeTest(KILL_TEST, { target: FILE, kills: [10] });

  const r = await sb.post('/api/verify', { file: FILE });

  assert.equal(r.testsGreen, true);
  assert.equal(r.coverageBefore, 80);
  assert.equal(r.coverageAfter, 80);
  assert.equal(r.mutationBefore, 0);
  assert.equal(r.mutationAfter, 50);
  assert.equal(r.macBefore, 0);
  assert.equal(r.macAfter, 40);
  assert.equal(r.improvedAny, true);
  assert.equal(r.degradedAny, false);
  assert.equal(r.improved, true);
  assert.equal(r.rounds, 0);
  assert.equal(r.maxRounds, 5);
  assert.deepEqual(r.changedFiles, [KILL_TEST]);
  assert.match(r.diff, /\+\+\+ b\/test\/a-kill\.test\.ts/);

  const f = sb.file(FILE);
  assert.equal(f.mutationAfter, 50);
  assert.equal(f.coverageAfter, 80);
  assert.equal(f.macAfter, 40);
  assert.equal(f.survivorsStale, false);
  assert.equal(S.state.run.result.mutationPct, 50);
  assert.equal(S.state.measureLedger[sb.repoSlug][FILE].attemptMac, 40);
  assert.match(log(sb), /PROGRESS \(another round\)/);
}));

test('verify calls a round degraded when any metric fell below the round base', () => withSandbox(async (sb) => {
  const w = await killReady(sb, { mutants: [{ line: 10 }, { line: 20 }] });
  w.writeTest(KILL_TEST, { target: FILE, kills: [10] });
  S.upsertFile(FILE, { roundBase: { coverage: 90, mutation: 80, mac: 72 } });

  const r = await sb.post('/api/verify', { file: FILE });

  assert.equal(r.degradedAny, true);
  assert.equal(r.improvedAny, false);
  assert.match(log(sb), /DEGRADED \(stop, drop round\)/);
}));

test('verify does not measure a round that produced nothing', () => withSandbox(async (sb) => {
  const w = await killReady(sb, { mutants: [{ line: 10 }, { line: 20 }] });
  w.writeTest(KILL_TEST, { target: FILE, kills: [10] });
  await sb.post('/api/verify', { file: FILE });
  await sb.post('/api/round/accept', { file: FILE });     // commits the round
  const before = { cov: w.calls.coverage.length, stryker: w.calls.stryker.length };

  const r = await sb.post('/api/verify', { file: FILE });

  // Nothing is pending: the previous round is committed and this one wrote nothing.
  // Measuring would cost a suite, a coverage and a mutation run to rediscover that,
  // and any delta it reported would be Stryker flakiness rather than improvement.
  assert.equal(r.improved, false);
  assert.equal(r.improvedAny, false);
  assert.equal(r.reason, 'no changes in this round');
  assert.equal(w.calls.coverage.length, before.cov, 'no coverage run');
  assert.equal(w.calls.stryker.length, before.stryker, 'no mutation run');
}));

test('verify stops at a red suite without running mutation testing', () => withSandbox(async (sb) => {
  const w = await killReady(sb, { mutants: [{ line: 10 }] });
  w.writeTest(KILL_TEST, { target: FILE, kills: [10] });
  const strykerRuns = w.calls.stryker.length;
  w.suiteRed = true;

  const r = await sb.post('/api/verify', { file: FILE });

  assert.equal(r.ok, true);
  assert.equal(r.improved, false);
  assert.equal(r.testsGreen, false);
  assert.equal(r.reason, 'full suite red');
  // the coverage pass IS the suite run — what must not happen is the expensive part
  assert.equal(w.calls.stryker.length, strykerRuns, 'a score measured on a red suite means nothing');
}));

test('verify turns a measurement crash into a verdict, not a dead run', () => withSandbox(async (sb) => {
  const w = await killReady(sb, { mutants: [{ line: 10 }] });
  w.writeTest(KILL_TEST, { target: FILE, kills: [10] });
  w.failNext('coverage', new Error('coverage run produced no summary (exit 1)'));

  const r = await sb.post('/api/verify', { file: FILE });

  assert.equal(r.ok, true);
  assert.equal(r.improved, false);
  assert.equal(r.testsGreen, false);
  assert.match(r.error, /no summary/);
  assert.equal(S.state.run.status, 'running');
  assert.match(log(sb), /verification failed/);
}));

test('BUG-1 REGRESSION: verify stores 100 survivors, not 10, so later rounds still have work', () => withSandbox(async (sb) => {
  // Truncating this list to 10 silently capped how much of a big file a whole run
  // could ever reach: round 2 saw ten survivors and thought that was all of them.
  const w = await killReady(sb, { sourceLines: 160, mutants: manyMutants(130) });
  w.writeTest(KILL_TEST, { target: FILE, kills: [3] });

  const r = await sb.post('/api/verify', { file: FILE });

  assert.equal(r.testsGreen, true);
  const f = sb.file(FILE);
  assert.equal(f.lastSurvived.length, 100);
  assert.equal(f.survivedTotal, 129, 'and the COUNT is never truncated');
  const shortlisted = mutants.shortlist(f.lastSurvived, { attempts: f.mutantAttempts || {} });
  assert.equal(shortlisted.length, 12, 'the next round has a full shortlist to choose from');
}));

// ═══════════════════════════════════════════════════════════════════════════
//  round/accept + round/drop
// ═══════════════════════════════════════════════════════════════════════════

test('round/accept commits the round and moves the bar for the next one', () => withSandbox(async (sb) => {
  const w = await killReady(sb, { mutants: [{ line: 10 }, { line: 20 }] });
  w.writeTest(KILL_TEST, { target: FILE, kills: [10] });
  await sb.post('/api/verify', { file: FILE });

  const r = await sb.post('/api/round/accept', { file: FILE });

  assert.equal(r.rounds, 1);
  const f = sb.file(FILE);
  assert.equal(f.rounds, 1);
  assert.deepEqual(f.roundBase, { coverage: 80, mutation: 50, mac: 40 },
    'the next round must beat what this one reached, not the original baseline');
  assert.match(w.calls.commit[0], /round 1/);
  assert.ok(w.git.committed.has(KILL_TEST), 'each round is its own commit so a bad one can be dropped alone');
  assert.equal(w.git.uncommitted.size, 0);
}));

test('round/accept still counts the round when the commit fails', () => withSandbox(async (sb) => {
  const w = await killReady(sb, { mutants: [{ line: 10 }] });
  w.writeTest(KILL_TEST, { target: FILE, kills: [10] });
  await sb.post('/api/verify', { file: FILE });
  w.failNext('commit', new Error('husky hook exploded'));

  const r = await sb.post('/api/round/accept', { file: FILE });

  assert.equal(r.rounds, 1);
  assert.match(log(sb), /round 1 commit note: husky hook exploded/);
}));

test('round/drop with nothing kept leaves the after-columns empty', () => withSandbox(async (sb) => {
  const w = await killReady(sb, { mutants: [{ line: 10 }, { line: 20 }] });
  w.writeTest(KILL_TEST, { target: FILE, kills: [10] });
  await sb.post('/api/verify', { file: FILE });

  const r = await sb.post('/api/round/drop', { file: FILE });

  assert.equal(r.improved, false);
  assert.equal(r.rounds, 0);
  assert.equal(r.macAfter, 0, 'the response reports the round base, i.e. the before-numbers');
  assert.equal(w.exists(KILL_TEST), false, 'the unaccepted round is gone from the working tree');
  assert.equal(w.calls.discard.length, 1);

  const f = sb.file(FILE);
  assert.equal(f.coverageAfter, null, 'an empty "after" reads as untouched; echoing "before" reads as measured no-op');
  assert.equal(f.mutationAfter, null);
  assert.equal(f.macAfter, null);
  assert.equal(f.mutation, 0, 'the live numbers fall back to the round base');
}));

test('round/drop keeps accepted rounds and discards only the last one', () => withSandbox(async (sb) => {
  const w = await killReady(sb, { mutants: [{ line: 10 }, { line: 20 }] });
  w.writeTest(KILL_TEST, { target: FILE, kills: [10] });
  await sb.post('/api/verify', { file: FILE });
  await sb.post('/api/round/accept', { file: FILE });
  w.writeTest('test/a-kill2.test.ts', { target: FILE, kills: [] });   // a round that achieved nothing

  const r = await sb.post('/api/round/drop', { file: FILE });

  assert.equal(r.rounds, 1);
  assert.equal(r.improved, true);
  assert.equal(r.macAfter, 40);
  assert.equal(r.macBefore, 0);
  assert.ok(w.exists(KILL_TEST), 'the committed round survives');
  assert.equal(w.exists('test/a-kill2.test.ts'), false, 'the uncommitted one does not');
  assert.deepEqual(r.changedFiles, [KILL_TEST]);
  const f = sb.file(FILE);
  assert.equal(f.macAfter, 40);
  assert.equal(f.mutationAfter, 50);
}));

// ═══════════════════════════════════════════════════════════════════════════
//  test/cleanup
// ═══════════════════════════════════════════════════════════════════════════

/** A file with one accepted round: green suite, mutation 50, one committed test. */
async function withAcceptedRound(sb) {
  const w = await killReady(sb, { mutants: [{ line: 10 }, { line: 20 }] });
  w.writeTest(KILL_TEST, { target: FILE, kills: [10], cases: 6 });
  await sb.post('/api/verify', { file: FILE });
  await sb.post('/api/round/accept', { file: FILE });
  return w;
}

test('test/cleanup keeps a tidy-up that stays green and holds the score', () => withSandbox(async (sb) => {
  const w = await withAcceptedRound(sb);
  const tidy = w.testSource({ target: FILE, kills: [10], cases: 3 });
  w.llm.replyText(tidy);

  const r = await sb.post('/api/test/cleanup', { file: FILE });

  assert.equal(r.cleaned, 1);
  assert.equal(r.mutationAfter, 50);
  assert.equal(r.results[0].kept, 'cleaned');
  assert.equal(Object.prototype.hasOwnProperty.call(r.results[0], '_original'), false,
    'the pre-cleanup copy is internal state, not an HTTP field');
  assert.equal(w.read(KILL_TEST), tidy.trim() + '\n');
  const f = sb.file(FILE);
  assert.equal(f.mutationAfter, 50);
  assert.equal(f.macAfter, 40);
  assert.match(w.calls.commit.join('\n'), /tidy generated tests/);
}));

test('test/cleanup reverts a tidy-up that drops the mutation score', () => withSandbox(async (sb) => {
  const w = await withAcceptedRound(sb);
  const original = w.read(KILL_TEST);
  // the "cleaned" file quietly loses the assertion that killed the mutant
  w.llm.replyText(w.testSource({ target: FILE, kills: [], cases: 5 }));

  const r = await sb.post('/api/test/cleanup', { file: FILE });

  assert.equal(r.cleaned, 0);
  assert.equal(r.reverted, true);
  assert.equal(w.read(KILL_TEST), original, 'the original test is put back byte for byte');
  assert.equal(sb.file(FILE).mutationAfter, 50, 'and the recorded score is untouched');
  assert.match(log(sb), /cleanup reverted: mutation 50→0/);
}));

test('test/cleanup ignores an implausible answer without touching the suite', () => withSandbox(async (sb) => {
  const w = await withAcceptedRound(sb);
  const original = w.read(KILL_TEST);
  const suiteRuns = w.calls.tests.length;
  w.llm.replyText('sure! here is the file');

  const r = await sb.post('/api/test/cleanup', { file: FILE });

  assert.equal(r.cleaned, 0);
  assert.equal(r.reverted, undefined);
  assert.equal(r.results[0].reason, 'implausible cleanup output');
  assert.equal(w.read(KILL_TEST), original);
  assert.equal(w.calls.tests.length, suiteRuns, 'nothing was written, so nothing needs re-running');
}));

// ═══════════════════════════════════════════════════════════════════════════
//  pr/create + iteration/discard + run/finish
// ═══════════════════════════════════════════════════════════════════════════

test('pr/create settles the file, the ledger and the worktree', () => withSandbox(async (sb) => {
  const w = await withAcceptedRound(sb);
  await sb.post('/api/round/drop', { file: FILE });

  const r = await sb.post('/api/pr/create', { file: FILE, title: 'test: improve MAC of src/a.ts', body: 'body', labels: ['automated'] });

  assert.equal(r.ok, true);
  assert.match(r.pr.url, /^https:\/\/github\.com\//);
  assert.equal(S.state.prs.length, 1);

  const f = sb.file(FILE);
  assert.equal(f.status, 'improved');
  assert.equal(f.prUrl, r.pr.url);
  assert.ok(f.timesheet.totalMin > 0, 'the human-equivalent timesheet is attached to the file');
  assert.ok(f.timesheet.inputs.testCases > 0, 'and it was computed from the real diff');
  assert.equal(f.attemptStartedAt, null, 'the stopwatch is closed into spentSec');
  assert.ok(f.spentSec >= 0);

  const led = S.state.improvedLedger[sb.repoSlug][FILE];
  assert.equal(led.state, 'improved');
  assert.equal(led.prUrl, r.pr.url);
  assert.equal(led.metrics.macAfter, 40);
  assert.equal(led.metrics.macBefore, 0);

  assert.ok(w.calls.reset.length >= 1, 'the worktree goes back to base for the next file');
  assert.equal(w.exists(KILL_TEST), false);
}));

test('pr/create skips cleanly when there is nothing to commit', () => withSandbox(async (sb) => {
  await killReady(sb, { mutants: [{ line: 10 }] });

  const r = await sb.post('/api/pr/create', { file: FILE });

  assert.equal(r.ok, true);
  assert.equal(r.pr, null);
  assert.match(r.skipped, /no changed test files to commit/);
  assert.equal(sb.file(FILE).status, 'no_improvement');
  assert.equal(S.state.prs.length, 0);
  assert.equal(S.state.improvedLedger[sb.repoSlug]?.[FILE], undefined, 'a skip is not a settled improvement');
}));

test('iteration/discard returns a file to the queue until its attempts run out', () => withSandbox(async (sb) => {
  const w = await killReady(sb, { mutants: [{ line: 10 }] }, { maxAttemptsPerFile: 2 });

  await sb.post('/api/iteration/discard', { file: FILE, reason: 'no MAC improvement' });
  assert.equal(sb.file(FILE).status, 'candidate', 'attempt 1 of 2 — try again later');
  assert.equal(S.state.improvedLedger[sb.repoSlug]?.[FILE], undefined);

  await sb.post('/api/iteration/start', { file: FILE });
  await sb.post('/api/iteration/discard', { file: FILE, reason: 'still nothing' });

  assert.equal(sb.file(FILE).status, 'no_improvement');
  const led = S.state.improvedLedger[sb.repoSlug][FILE];
  assert.equal(led.state, 'exhausted');
  assert.equal(led.metrics.attempts, 2);
  assert.equal(led.metrics.macBefore, 0, 'a file we could not improve is still a file we measured');
  assert.ok(w.calls.reset.length >= 2);
}));

test('run/finish closes the run and returns the worktree to base', () => withSandbox(async (sb) => {
  const w = await killReady(sb, { mutants: [{ line: 10 }] });
  const resets = w.calls.reset.length;

  const r = await sb.post('/api/run/finish', {});

  assert.equal(r.ok, true);
  assert.equal(S.state.run.status, 'done');
  assert.ok(S.state.run.finishedAt > 0);
  assert.equal(S.state.stage.name, 'done');
  assert.equal(w.calls.reset.length, resets + 1);
}));

test('run/finish records a failed status when the driver reports one', () => withSandbox(async (sb) => {
  await killReady(sb, { mutants: [{ line: 10 }] });

  await sb.post('/api/run/finish', { status: 'failed' });

  assert.equal(S.state.run.status, 'failed');
}));

test('every run-scoped route refuses to work without a run', () => withSandbox(async (sb) => {
  installFakes(sb);
  for (const route of ['POST /api/run/finish', 'POST /api/coverage/run', 'POST /api/verify', 'POST /api/pr/create']) {
    await assert.rejects(() => sb.call(route, {}), /no active run/, route);
  }
}));

// ═══════════════════════════════════════════════════════════════════════════
//  admin/reset — starting a repo over
// ═══════════════════════════════════════════════════════════════════════════

test('admin/reset keeps the ledgers by default, because that is what batching relies on', () => withSandbox(async (sb) => {
  await started(sb);
  S.state.improvedLedger[sb.repoSlug] = { 'src/old.ts': { state: 'improved' } };
  S.state.tokenLedger[sb.repoSlug] = { in: 10, out: 20, calls: 1 };

  await sb.post('/api/admin/reset', {});

  assert.equal(S.state.run, null);
  assert.deepEqual(S.state.files, {});
  assert.ok(S.state.improvedLedger[sb.repoSlug]['src/old.ts'],
    'a batch driver resets between batches — losing the ledger there would redo every settled file');
}));

test('admin/reset with ledgers:true starts the repo over from nothing', () => withSandbox(async (sb) => {
  const w = installFakes(sb);
  await sb.start();
  w.addFile({ path: FILE, mutants: [{ line: 10 }] });
  S.state.improvedLedger[sb.repoSlug] = { 'src/old.ts': { state: 'improved' } };
  S.state.measureLedger[sb.repoSlug] = { 'src/old.ts': { macBefore: 10 } };
  S.state.overheadLedger[sb.repoSlug] = { cloneSec: 30 };
  S.state.tokenLedger[sb.repoSlug] = { in: 10, out: 20, calls: 1 };
  assert.ok(require('node:fs').existsSync(sb.repoDir), 'precondition: the clone is on disk');

  const r = await sb.post('/api/admin/reset', { ledgers: true, repo: true });

  assert.equal(r.ok, true);
  assert.deepEqual(S.state.improvedLedger, {}, 'nothing may be skipped as already settled');
  assert.deepEqual(S.state.measureLedger, {});
  assert.deepEqual(S.state.overheadLedger, {});
  assert.deepEqual(S.state.tokenLedger, {}, 'token cost starts from zero too, or the report is a lie');
  assert.equal(require('node:fs').existsSync(sb.repoDir), false,
    'repo:true forces a fresh clone rather than reusing a tree earlier runs wrote into');
}));

test('admin/reset can start ONE repo over without touching the others', () => withSandbox(async (sb) => {
  await started(sb);
  S.state.improvedLedger[sb.repoSlug] = { 'src/a.ts': { state: 'improved' } };
  S.state.improvedLedger['other-repo'] = { 'src/b.ts': { state: 'improved' } };

  await sb.post('/api/admin/reset', { ledgers: true, repoUrl: sb.repoUrl });

  assert.equal(S.state.improvedLedger[sb.repoSlug], undefined);
  assert.ok(S.state.improvedLedger['other-repo'], 'another repo\'s history is not ours to delete');
}));

// ── consolidation must see the files the sweep actually writes ───────────────
// The fold selected `kill-L<line>-` files: the single-target loop's naming. The sweep
// replaced it with `kill-batch-<hash>` and nothing failed — consolidation simply
// stopped seeing any kill test, folded the coverage-bootstrap files on their own,
// reported success, and every PR shipped one file per sweep call. A filter that
// silently matches nothing is invisible from outside: the stage runs, the event fires,
// the metrics are real, and only the PR shows it.
test('the fold picks up sweep-written kill tests, not just the old single-target names',
  () => withSandbox(async (sb) => {
    const w = await withAcceptedRound(sb);
    // what a real round leaves behind: one bootstrap coverage file and two sweep files
    const generated = ['test/a.mac-cov.test.ts', 'test/a.kill-batch-2icypk.test.ts', 'test/a.kill-batch-6tgkgv.test.ts'];
    for (const p of generated) w.writeTest(p, { target: FILE, kills: [10], cases: 2 });
    // one reply per cleanup pass plus one for the merge; every title must survive
    const same = w.testSource({ target: FILE, kills: [10], cases: 2 });
    w.llm.onCall(() => ({ text: same }));

    const r = await sb.post('/api/test/cleanup', { file: FILE });

    assert.equal(r.merged, generated.length,
      `the fold saw ${r.merged} of ${generated.length} generated files`);
    for (const p of generated) {
      assert.equal(w.read(p), null, `${p} must be deleted by the fold, or the PR carries it as well as the merge`);
    }
    assert.ok(w.read('test/a.mac.test.ts'), 'the merged file must exist');
  }));
