'use strict';
// UNIT TESTS for /api/metrics — the numbers on the dashboard.
//
// This is the one part of the sidecar a human reads directly and cannot check: the
// human-equivalent hours, the FTE ratio, the ETA, the token cost per improved file.
// It was 0% covered, which means every figure the pipeline has ever shown about its
// own productivity was unverified. The arithmetic below is the point — a wrong ETA
// or a flattering FTE is worse than none, because it is believed.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withSandbox, S, util } = require('./helpers/env');   // FIRST, always
const { installFakes } = require('./helpers/fakes');

/** A run with files in known states, so every derived figure has a hand-checkable value. */
async function withFiles(sb, files, cfg = {}) {
  installFakes(sb);
  await sb.start(cfg);
  for (const [path, patch] of Object.entries(files)) S.upsertFile(path, { path, ...patch });
  return sb;
}

const improved = (over = {}) => ({
  status: 'improved', macBefore: 10, macAfter: 40, coverage: 80, mutation: 50, mac: 40,
  spentSec: 600, timesheet: { totalMin: 120, hours: 2 }, tokens: { in: 1000, out: 2000, calls: 5 },
  ...over,
});

test('totals count only files the pipeline actually targeted', () => withSandbox(async (sb) => {
  await withFiles(sb, {
    'src/a.ts': improved(),
    'src/b.ts': { status: 'no_improvement', macBefore: 20, macAfter: 20 },
    'src/untouched.ts': { status: 'candidate' },       // never measured: macBefore null
  });

  const m = await sb.get('/api/metrics');

  assert.equal(m.totals.targetedFiles, 2, 'a candidate nobody measured is not a data point');
  assert.equal(m.totals.improvedFiles, 1);
  assert.equal(m.totals.avgMacBefore, 15, '(10 + 20) / 2');
  assert.equal(m.totals.avgMacAfter, 30, '(40 + 20) / 2');
}));

test('a file with no "after" value counts its BEFORE value in the average, not zero',
  () => withSandbox(async (sb) => {
    // Dropping it would understate the result; counting it as 0 would invent a
    // regression that never happened.
    await withFiles(sb, {
      'src/a.ts': improved({ macAfter: 60 }),
      'src/b.ts': { status: 'no_improvement', macBefore: 30, macAfter: null },
    });

    const m = await sb.get('/api/metrics');

    assert.equal(m.totals.avgMacBefore, 20, '(10 + 30) / 2');
    assert.equal(m.totals.avgMacAfter, 45, '(60 + 30) / 2 — b held its ground');
  }));

test('human hours are the sum of the per-file timesheets', () => withSandbox(async (sb) => {
  await withFiles(sb, {
    'src/a.ts': improved({ timesheet: { totalMin: 90 } }),
    'src/b.ts': improved({ timesheet: { totalMin: 150 } }),
  });

  const m = await sb.get('/api/metrics');

  assert.equal(m.work.humanHours, 4, '(90 + 150) / 60');
}));

test('the FTE ratio compares like with like, and refuses to report on too little data',
  () => withSandbox(async (sb) => {
    // A file improved before the stopwatch existed carries human-equivalent hours and
    // no machine time. Including it would divide real hours by nothing and make the
    // pipeline look arbitrarily good.
    await withFiles(sb, {
      'src/timed.ts': improved({ timesheet: { totalMin: 120 }, spentSec: 1200 }),
      'src/untimed.ts': improved({ timesheet: { totalMin: 600 }, spentSec: 0 }),
    });

    const m = await sb.get('/api/metrics');

    assert.equal(m.work.fteBasis, 1, 'only the file with both numbers is comparable');
    assert.equal(m.work.fte, 6, '120 human minutes / 1200 machine seconds = 7200s / 1200s');
  }));

test('FTE is withheld until there is enough machine time to mean anything', () => withSandbox(async (sb) => {
  await withFiles(sb, { 'src/a.ts': improved({ spentSec: 300, timesheet: { totalMin: 120 } }) });

  const m = await sb.get('/api/metrics');

  assert.equal(m.work.fte, null, 'five minutes of machine time cannot support a productivity claim');
}));

test('the ETA extrapolates from files that were actually timed', () => withSandbox(async (sb) => {
  await withFiles(sb, {
    'src/done1.ts': improved({ spentSec: 600 }),
    'src/done2.ts': { status: 'no_improvement', macBefore: 5, macAfter: 5, spentSec: 1200 },
    'src/todo1.ts': { status: 'candidate' },
    'src/todo2.ts': { status: 'candidate' },
    'src/todo3.ts': { status: 'candidate' },
  });

  const m = await sb.get('/api/metrics');

  assert.equal(m.work.remaining, 3);
  assert.equal(m.work.etaSec, 2700, '3 files x the 900s average of 600 and 1200');
}));

test('tokens per improved file divides by files that have BOTH numbers', () => withSandbox(async (sb) => {
  await withFiles(sb, {
    'src/a.ts': improved({ tokens: { in: 1000, out: 2000, calls: 5 } }),
    'src/b.ts': improved({ tokens: { in: 3000, out: 4000, calls: 7 } }),
    'src/c.ts': improved({ tokens: undefined }),         // improved before token accounting
    'src/d.ts': { status: 'no_improvement', tokens: { in: 9999, out: 9999, calls: 9 } },
  });

  const m = await sb.get('/api/metrics');

  assert.equal(m.work.tokensBasis, 2, 'c has no tokens; d was not improved');
  assert.equal(m.work.tokensPerImprovedFile, 5000, '(3000 + 7000) / 2');
}));

test('a live attempt accrues machine time, and a crashed one does not accrue forever',
  () => withSandbox(async (sb) => {
    const now = Math.floor(Date.now() / 1000);
    await withFiles(sb, {
      'src/live.ts': { status: 'picked', spentSec: 100, attemptStartedAt: now - 60 },
      'src/crashed.ts': { status: 'failed', spentSec: 50, attemptStartedAt: now - 100000 },
    });

    const m = await sb.get('/api/metrics');

    // 100 + ~60 running + 50 banked = ~210s; the crashed file's stopwatch is ignored
    assert.ok(m.work.machineHours >= 210 / 3600 && m.work.machineHours < 400 / 3600,
      `only the PICKED file has a live stopwatch — got ${m.work.machineHours}h`);
  }));

test('run overhead is machine time too — clone, install and baseline are not free',
  () => withSandbox(async (sb) => {
    await withFiles(sb, { 'src/a.ts': improved({ spentSec: 600 }) });
    S.state.overheadLedger[util.slugify(sb.repoUrl)] = 3000;

    const m = await sb.get('/api/metrics');

    assert.equal(m.work.machineHours, 1, '(600 + 3000) / 3600 — without it the FTE ratio flatters us');
  }));

test('the file list is capped but never at the expense of files we touched', () => withSandbox(async (sb) => {
  const files = {};
  for (let i = 0; i < 300; i++) files[`src/c${i}.ts`] = { status: 'candidate' };
  files['src/touched.ts'] = improved();
  await withFiles(sb, files);

  const m = await sb.get('/api/metrics');

  assert.equal(m.files.length, 250, 'a 500-file repo would otherwise be a 130KB poll every 2s');
  assert.equal(m.files[0].path, 'src/touched.ts', 'the ones with results always win a slot');
}));

test('progress counts every settled disposition, not just the wins', () => withSandbox(async (sb) => {
  await withFiles(sb, {
    'src/a.ts': improved(),
    'src/b.ts': { status: 'no_improvement' },
    'src/c.ts': { status: 'failed' },
    'src/d.ts': { status: 'candidate' },
    'src/e.ts': { status: 'picked' },
  });

  const m = await sb.get('/api/metrics');

  assert.equal(m.work.settled, 3);
  assert.equal(m.work.improved, 1);
  assert.equal(m.work.remaining, 2, 'a picked file is still remaining — it has not landed yet');
  assert.equal(m.work.totalFiles, 5);
}));

test('a kill mid-round shows up on the dashboard before the round ends', () => withSandbox(async (sb) => {
  // The dashboard's "after" columns render coverageAfter/mutationAfter/macAfter, which
  // /api/verify writes at the END of a round, and fall back to attemptCoverage/
  // attemptMutation/attemptMac — the best any attempt reached. Those three ARE recorded
  // on every kill, but into the measure LEDGER, while metricsPayload reads them off the
  // file record. The two never meet during a run, so a file three hours into a round
  // with 85 mutants dead renders as a blank row and looks stuck.
  const w = installFakes(sb);
  await sb.start();
  // an existing test, or the baseline mutation run reports "no tests executed" and the
  // loop has no survivors to pick from
  w.addFile({ path: 'src/a.ts', existingTest: 'test/a.test.ts', coverageWithTests: 80,
    mutants: [{ line: 10 }, { line: 20 }, { line: 30 }, { line: 40 }] });
  await sb.post('/api/coverage/run', { phase: 'baseline' });
  await sb.post('/api/iteration/start', { file: 'src/a.ts' });
  await sb.post('/api/stryker/run', { file: 'src/a.ts', phase: 'baseline' });
  const target = (await sb.get('/api/mutant/next', { path: 'src/a.ts' })).mutant;
  w.writeTest('test/a-kill.test.ts', { target: 'src/a.ts', kills: [target.line] });

  await sb.post('/api/mutant/verify', { file: 'src/a.ts', mutant: target, testPaths: ['test/a-kill.test.ts'], phase: 'thinking' });

  const row = (await sb.get('/api/metrics')).files.find((f) => f.path === 'src/a.ts');
  assert.ok((row.attemptMutation ?? 0) > 0,
    `the row must show the score this attempt reached — got ${JSON.stringify(row.attemptMutation)}`);
  assert.ok((row.attemptMac ?? 0) > 0, 'and the MAC that follows from it');

  // The ledger is the record that OUTLIVES the run: /api/metrics falls back to it for
  // any file the current state no longer holds. attemptMutation and attemptMac were
  // written there and attemptCoverage was not, so a restart kept two thirds of a
  // measurement and the coverage column of a finished attempt went blank.
  const led = S.state.measureLedger[sb.repoSlug]['src/a.ts'];
  assert.ok((led.attemptCoverage ?? 0) > 0,
    `the permanent record must keep the coverage too — got ${JSON.stringify(led.attemptCoverage)}`);
  assert.equal(led.attemptCoverage, row.attemptCoverage, 'and agree with what the dashboard just showed');
}));

// ── a run that says it starts clean must actually start clean ────────────────
// clearLedger deleted one of four per-repo ledgers. The other three carried the
// previous run's measurements, overheads and token counts into a run declared
// independent — so an eval comparing "before" against a fresh run was comparing
// against numbers the previous run had already put there.
test('run/start with clearLedger wipes every per-repo ledger, not just the improved one',
  () => withSandbox(async (sb) => {
    await sb.start();
    const slug = sb.repoSlug;
    for (const k of ['improvedLedger', 'measureLedger', 'overheadLedger', 'tokenLedger']) {
      S.state[k][slug] = { 'src/old.ts': { mac: 42 } };
      S.state[k]['some-other-repo'] = { 'src/x.ts': { mac: 7 } };
    }

    await sb.post('/api/run/start', { repoUrl: sb.repoUrl, clearLedger: true, force: true });

    for (const k of ['improvedLedger', 'measureLedger', 'overheadLedger', 'tokenLedger']) {
      assert.equal(S.state[k][slug], undefined, `${k} still holds the previous run's numbers`);
      assert.ok(S.state[k]['some-other-repo'], `${k}: another repo's history is not ours to delete`);
    }
  }));
