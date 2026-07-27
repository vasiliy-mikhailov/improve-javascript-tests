'use strict';
// Sidecar HTTP API (:3000). Everything the n8n workflow needs, so the workflow
// itself stays 100% native n8n nodes (HTTP Request / Code / IF / SplitInBatches).
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const S = require('./state');
const repo = require('./repo');
const coverage = require('./coverage');
const stryker = require('./stryker');
const tests = require('./tests');
const rulesMod = require('./rules');
const pr = require('./pr');
const llm = require('./llm');
const timesheet = require('./timesheet');
const mutantsMod = require('./mutants');
const mutantStore = require('./mutant-store');
const { run } = require('./exec');
const { mac, fileSlug, round2, clamp, slugify } = require('./util');

const PORT = parseInt(process.env.SIDECAR_PORT || '3000', 10);
const state = S.state;

// ── helpers ────────────────────────────────────────────────────────────────
function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => {
      data += c;
      if (data.length > 20e6) { req.destroy(); reject(new Error('request body too large')); }
    });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(new Error('bad JSON body')); } });
    req.on('error', reject);
  });
}
// How many mutants one generated file is asked to kill. Eight measured best against
// the real model; more crowds the prompt, fewer wastes the cycle.
const BATCH_TARGETS = 8;

function needRun() { if (!state.run) throw new Error('no active run — POST /api/run/start first'); }
function ledger() {
  const slug = slugify(state.run.config.repoUrl);
  return (state.improvedLedger[slug] ||= {});
}
/** Per-repo record of every measurement taken, regardless of outcome. */
function measured() {
  const slug = slugify(state.run.config.repoUrl);
  return (state.measureLedger[slug] ||= {});
}
function recordMeasurement(file, patch) {
  const m = measured();
  m[file] = { ...(m[file] || {}), ...patch, ts: Date.now() };
  S.save();
}

/** The file the loop is currently working on (there is at most one). */
function pickedFile() {
  const e = Object.entries(state.files).find(([, v]) => v.status === 'picked');
  return e ? e[0] : null;
}

/** Close the current attempt's stopwatch into the file's cumulative machine time. */
function accrueSpent(file) {
  const f = state.files[file];
  if (!f || !f.attemptStartedAt) return f?.spentSec || 0;
  const spent = (f.spentSec || 0) + (Math.floor(Date.now() / 1000) - f.attemptStartedAt);
  S.upsertFile(file, { spentSec: spent, attemptStartedAt: null });
  return spent;
}

function metricsPayload() {
  const files = Object.values(state.files).sort((a, b) => (a.mac ?? 999) - (b.mac ?? 999));
  const targeted = files.filter((f) => f.macBefore != null);
  const avg = (xs) => xs.length ? round2(xs.reduce((s, x) => s + x, 0) / xs.length) : null;
  // work accounting: human-equivalent hours, machine time, ETA, FTE, progress
  const settled = files.filter((f) => ['improved', 'no_improvement', 'failed'].includes(f.status));
  const now = Math.floor(Date.now() / 1000);
  const humanMin = files.reduce((s, f) => s + (f.timesheet?.totalMin || 0), 0);
  let machineSec = files.reduce((s, f) => s + (f.spentSec || 0), 0);
  // only the file currently being worked on has a live stopwatch; a crashed
  // attempt must not keep accruing time forever
  for (const f of files) if (f.attemptStartedAt && f.status === 'picked') machineSec += now - f.attemptStartedAt;
  // clone + install + baseline measurement are real machine time too, and they
  // dominate short batches — without them the FTE ratio flatters the pipeline
  machineSec += state.overheadLedger?.[slugify(state.run?.config?.repoUrl || '')] || 0;
  const timedSettled = settled.filter((f) => f.spentSec > 0);
  const remaining = files.filter((f) => f.status === 'candidate' || f.status === 'picked').length;
  const avgSecPerFile = timedSettled.length
    ? timedSettled.reduce((s, f) => s + f.spentSec, 0) / timedSettled.length : null;
  // FTE must compare like with like: only files whose machine time we actually
  // measured. (Files improved before the stopwatch existed carry human-equivalent
  // hours but no machine time, and would inflate the ratio.)
  const comparable = files.filter((f) => f.timesheet?.totalMin > 0 && f.spentSec > 0);
  const comparableHumanMin = comparable.reduce((s, f) => s + f.timesheet.totalMin, 0);
  const comparableMachineSec = comparable.reduce((s, f) => s + f.spentSec, 0);
  const tok = state.tokenLedger?.[slugify(state.run?.config?.repoUrl || '')] || { in: 0, out: 0, calls: 0 };
  const work = {
    tokensIn: tok.in || 0,
    tokensOut: tok.out || 0,
    llmCalls: tok.calls || 0,
    tokensPerImprovedFile: null,   // filled below once `improved` is known
    humanHours: round2(humanMin / 60),
    machineHours: round2(machineSec / 3600),
    fte: comparableMachineSec > 600 ? round2((comparableHumanMin * 60) / comparableMachineSec) : null,
    fteBasis: comparable.length,
    etaSec: avgSecPerFile != null ? Math.round(remaining * avgSecPerFile) : null,
    settled: settled.length,
    improved: settled.filter((f) => f.status === 'improved').length,
    totalFiles: files.length,
    remaining,
  };
  // like-for-like again: only files that were improved AND have token data
  const tokenedImproved = files.filter((f) => f.status === 'improved' && f.tokens?.calls > 0);
  const tokenedSum = tokenedImproved.reduce((s2, f) => s2 + (f.tokens.in || 0) + (f.tokens.out || 0), 0);
  work.tokensPerImprovedFile = tokenedImproved.length
    ? Math.round(tokenedSum / tokenedImproved.length) : null;
  work.tokensBasis = tokenedImproved.length;
  return {
    work,
    stage: state.stage,
    run: state.run,
    runner: state.runner,
    totals: {
      baseline: state.run?.baseline || {},
      current: state.run?.result || {},
      targetedFiles: targeted.length,
      improvedFiles: targeted.filter((f) => f.status === 'improved').length,
      avgMacBefore: avg(targeted.map((f) => f.macBefore).filter((x) => x != null)),
      avgMacAfter: avg(targeted.map((f) => f.macAfter ?? f.macBefore).filter((x) => x != null)),
    },
    // project only what the dashboard renders, and only as many rows as it shows:
    // full records for ~500 files made this a ~130 KB poll every 2 s. Files the
    // pipeline has touched always win a slot; untouched candidates fill the rest.
    files: [...files.filter((f) => f.status !== 'candidate'),
      ...files.filter((f) => f.status === 'candidate')].slice(0, 250).map((f) => ({
      path: f.path, status: f.status, attempts: f.attempts, rounds: f.rounds || 0,
      coverage: f.coverage, mutation: f.mutation, mac: f.mac,
      coverageBefore: f.coverageBefore, mutationBefore: f.mutationBefore, macBefore: f.macBefore,
      coverageAfter: f.coverageAfter, mutationAfter: f.mutationAfter, macAfter: f.macAfter,
      // what the best attempt reached even when the result was not kept
      attemptCoverage: f.attemptCoverage, attemptMutation: f.attemptMutation, attemptMac: f.attemptMac,
      failure: f.failure,
      tokens: f.tokens,
      prUrl: f.prUrl, prPatch: f.prPatch,
      timesheet: f.timesheet && {
        hours: f.timesheet.hours, totalMin: f.timesheet.totalMin,
        analysisMin: f.timesheet.analysisMin, testsMin: f.timesheet.testsMin,
        mutationMin: f.timesheet.mutationMin, verifyMin: f.timesheet.verifyMin,
      },
    })),
    prs: state.prs,
    decisions: state.decisions,
    events: state.events.slice(-60),
  };
}

function candidates() {
  const cfg = state.run.config;
  const maxAttempts = cfg.maxAttemptsPerFile || 3;
  const all = Object.values(state.files);
  // ledger-replayed files were settled in PREVIOUS batches — they must not
  // consume this batch's scopeLimit quota
  const processed = all.filter((f) => ['improved', 'no_improvement', 'failed'].includes(f.status)
    && !f.fromLedger && f.failedKind !== 'measurement').length;
  const list = all
    .filter((f) => f.status === 'candidate' && f.attempts < maxAttempts)
    .map((f) => ({ path: f.path, coverage: f.coverage, mutation: f.mutation, mac: f.mac, attempts: f.attempts }))
    .sort((a, b) => (a.mac ?? (a.coverage ?? 0) / 2) - (b.mac ?? (b.coverage ?? 0) / 2));
  let done = false, reason = '';
  if (cfg.maxIterations > 0 && state.run.iteration >= cfg.maxIterations) { done = true; reason = `max iterations (${cfg.maxIterations}) reached`; }
  else if (cfg.scopeLimit > 0 && processed >= cfg.scopeLimit) { done = true; reason = `scope limit (${cfg.scopeLimit} files) reached`; }
  else if (!list.length) { done = true; reason = 'no remaining candidate files'; }
  return { done, reason, iteration: state.run.iteration, processed, candidates: list.slice(0, 100) };
}


/**
 * One file per SOURCE file, not one per mutant.
 *
 * The loop writes a separate file per target on purpose: a failed attempt is trivially
 * droppable and two mutants cannot overwrite each other. That is right for the loop and
 * wrong for the PR. Measured on a real branch: ten files, 805 lines, for one source
 * file — because every file re-declares the same forty lines of module mocks to assert
 * one thing. A reviewer should get one file with ten tests.
 *
 * Verified exactly like the cleanup that precedes it: suite green, and neither half of
 * MAC may drop. Anything else and the originals come back.
 */
async function consolidate(file, covBase, mutBase) {
  const changed = (await pr.changedTestFiles()).filter((p) => /\.(kill-L\d+-|mac-cov)/.test(p));
  if (changed.length < 2) return 0;
  S.setStage('preparing_pr', `folding ${changed.length} generated test files into one for ${file}`);
  const originals = changed.map((p) => ({ path: p, content: repo.readFileSafe(p, 200000) })).filter((o) => o.content);
  if (originals.length < 2) return 0;
  const ext = (file.match(/\.[cm]?[jt]sx?$/) || ['.ts'])[0];
  const target = originals[0].path.replace(/\.(kill-L\d+-[a-z0-9-]+|mac-cov(-r\d+)?)\.test\.[cm]?[jt]sx?$/, `.mac.test${ext}`);
  if (target === originals[0].path) return 0;

  let mergedText;
  try {
    const r = await llm.chat({
      system: 'You merge several generated test files for ONE source file into a single file. Keep EVERY test — same names, same assertions, same values. Deduplicate imports and shared mock setup into one block at the top. Do not rename tests, do not weaken or reorder assertions, do not add tests. Reply with ONLY the merged file content: no markdown fences, no explanation.',
      prompt: originals.map((o) => `=== ${o.path} ===\n${o.content}`).join('\n\n'),
      maxTokens: 12000, temperature: 0.1,
    });
    mergedText = (r.text || '').replace(/^[\s\S]*?<\/think>/, '')
      .replace(/^```[a-z]*\s*\n?/m, '').replace(/```\s*$/m, '').trim() + '\n';
  } catch (e) {
    S.event('preparing_pr', 'merge skipped: ' + e.message.slice(0, 140));
    return 0;
  }
  // every test must still be there: losing one is a silent regression the metrics
  // might not notice, because a dropped test can leave the score untouched
  const titles = (t) => (t.match(/\b(it|test)\s*\(\s*['"`]([^'"`]+)/g) || []).map((x) => x.slice(x.indexOf('(') + 1));
  const before = originals.flatMap((o) => titles(o.content));
  const after = titles(mergedText);
  const missing = before.filter((t) => !after.includes(t));
  if (mergedText.length < 200 || missing.length) {
    S.event('preparing_pr', `merge rejected: ${missing.length} test(s) would be lost`);
    return 0;
  }

  for (const o of originals) repo.deleteTestFile(o.path);
  repo.writeTestFile(target, mergedText);
  const cr = await coverage.runCoverage();
  let ok = false, newCov = null, newScore = null;
  if (cr.exitCode === 0) {
    newCov = state.files[file]?.coverage ?? null;
    try {
      const st = await stryker.runStryker(file);
      newScore = st.score;
      ok = !st.noTests && st.totalMutants != null && newScore >= mutBase && (newCov ?? 0) >= covBase;
    } catch { ok = false; }
  }
  if (!ok) {
    repo.deleteTestFile(target);
    for (const o of originals) repo.writeTestFile(o.path, o.content);
    S.upsertFile(file, { coverage: covBase, coverageAfter: covBase });
    S.event('preparing_pr', `merge reverted: coverage ${covBase}→${newCov}, mutation ${mutBase}→${newScore}`);
    return 0;
  }
  S.upsertFile(file, { coverage: newCov, coverageAfter: newCov, mutation: newScore, mutationAfter: newScore,
    mac: mac(newCov, newScore), macAfter: mac(newCov, newScore) });
  try { await pr.commit(`test: fold generated tests for ${file} into one file`); }
  catch (e) { S.event('preparing_pr', 'merge commit note: ' + e.message.slice(0, 140)); }
  S.event('preparing_pr', `merged ${originals.length} files into ${target} (${mergedText.length}B)`);
  return originals.length;
}

// ── route table ────────────────────────────────────────────────────────────
const routes = {
  'GET /api/health': async () => ({ ok: true, service: 'ijst-sidecar', stage: state.stage.name, ts: Date.now() }),
  'GET /api/state': async () => state,
  'GET /api/metrics': async () => metricsPayload(),
  'GET /api/rules': async () => ({ rules: state.run?.config?.rules || S.envConfig().rules, decisions: state.decisions }),
  // live model transcript for the dashboard; `after` makes it an incremental feed
  'GET /api/dialog': async (q) => {
    const after = parseInt(q.get('after') || '0', 10);
    const items = (state.dialog || []).filter((d) => d.seq > after);
    return { dialog: items.slice(-20), latestSeq: state.dialogSeq || 0 };
  },

  'GET /api/events': async (q) => {
    const after = parseInt(q.get('after') || '0', 10);
    return { events: state.events.filter((e) => e.seq > after) };
  },

  'POST /api/stage': async (q, body) => {
    S.setStage(String(body.stage || 'idle'), String(body.detail || ''));
    return { ok: true, stage: state.stage };
  },

  'POST /api/run/start': async (q, body) => {
    // one git worktree + one run state: overlapping executions would corrupt both.
    // `force` (used by the batch driver, which owns execution lifecycle) and a
    // staleness window let a genuinely dead run be taken over.
    // 'interrupted' means the sidecar restarted: whatever execution owned that
    // run is gone, so it can never be a real concurrency conflict.
    const active = state.run && state.run.status === 'running' && state.stage?.name !== 'interrupted';
    const idleSec = Math.floor(Date.now() / 1000) - (state.stage?.since || 0);
    if (active && !body.force && idleSec < 900) {
      const err = new Error(`a run is already active (${state.run.id}, stage ${state.stage.name}, `
        + `${idleSec}s since last stage change) — stop it first or pass force:true`);
      err.statusCode = 409;
      throw err;
    }
    if (active) S.event('starting', `taking over stale/forced run ${state.run.id} (idle ${idleSec}s)`);
    state.run = S.freshRun(body);
    state.files = {};
    state.decisions = {};
    state.prs = [];
    state.pickFailures = 0;
    if (body.clearLedger) delete state.improvedLedger[slugify(state.run.config.repoUrl)];
    S.setStage('starting', `run ${state.run.id} on ${state.run.config.repoUrl}#${state.run.config.repoBranch}`);
    S.save();
    return { ok: true, run: state.run };
  },

  'POST /api/run/finish': async (q, body) => {
    needRun();
    state.run.status = body.status || 'done';
    state.run.finishedAt = Math.floor(Date.now() / 1000);
    S.setStage('done', `run finished: ${state.run.status}; ${state.prs.length} PR(s)`);
    await repo.resetToBase().catch(() => { });
    return { ok: true, run: state.run, prs: state.prs };
  },

  'POST /api/repo/clone': async () => {
    needRun();
    S.setStage('cloning', state.run.config.repoUrl);
    return { ok: true, ...(await repo.clone()) };
  },

  'POST /api/repo/prepare': async () => {
    needRun();
    S.setStage('installing', 'installing dependencies + tooling');
    const det = await repo.install();
    const files = await repo.listScopeFiles();
    // replay measurements first: every file we ever measured keeps its numbers,
    // whether or not it was ever improved (status is untouched here)
    let remeasured = 0;
    for (const [p, m] of Object.entries(measured())) {
      if (!state.files[p]) continue;
      S.upsertFile(p, {
        coverageBefore: m.coverageBefore, mutationBefore: m.mutationBefore, macBefore: m.macBefore,
        attemptCoverage: m.attemptCoverage, attemptMutation: m.attemptMutation, attemptMac: m.attemptMac,
        failure: m.failure,
      });
      remeasured += 1;
    }
    // replay the persistent ledger so finished files are not re-picked
    let replayed = 0;
    for (const [p, rec] of Object.entries(ledger())) {
      if (!state.files[p]) continue;
      S.upsertFile(p, rec.state === 'improved'
        ? { status: 'improved', fromLedger: true, prUrl: rec.prUrl || null, prPatch: rec.patchPath || null, ...(rec.metrics || {}) }
        : { status: rec.state === 'failed' ? 'failed' : 'no_improvement', fromLedger: true, attempts: state.run.config.maxAttemptsPerFile || 3, ...(rec.metrics || {}) });
      replayed += 1;
    }
    if (replayed || remeasured) {
      S.event('installing', `ledger: ${replayed} file(s) already settled in previous runs — skipping them; `
        + `${remeasured} file(s) restored earlier measurements`);
    }
    return { ok: true, runner: det, scopeFiles: files.length, settledFromLedger: replayed, measurementsRestored: remeasured };
  },

  'POST /api/coverage/run': async (q, body) => {
    needRun();
    S.setStage(body.stage || 'improving_coverage', 'running test suite with coverage');
    const r = await coverage.runCoverage();
    if (body.phase === 'baseline') {
      state.run.baseline.coveragePct = r.totalPct;
      // per-file mac recompute
      for (const f of Object.values(state.files)) f.mac = mac(f.coverage, f.mutation);
    }
    state.run.result.coveragePct = r.totalPct;
    S.save();
    return { ok: true, totalPct: r.totalPct, exitCode: r.exitCode };
  },

  'GET /api/files/candidates': async () => { needRun(); S.setStage('picking_file', 'evaluating candidate files'); return candidates(); },

  'POST /api/rules/apply': async (q, body) => {
    needRun();
    const stage = body.stage;
    const stageNames = {
      post_clone: ['applying_rules', 'post-clone rules'],
      pre_pick: ['applying_rules', 'pre-pick rules'],
      pick_file: ['picking_file', 'picking a file to mutate'],
      write_test: ['improving_coverage', 'assembling test-writing constraints'],
      check_changes: ['improving_mac', 'checking whether changes are good'],
      make_pr: ['preparing_pr', 'composing PR per team rules'],
    };
    const [sn, sd] = stageNames[stage] || ['applying_rules', stage];
    S.setStage(sn, sd);
    let context = body.context || {};
    if (stage === 'pick_file' && !context.candidates) context = { candidates: candidates().candidates };
    const result = await rulesMod.apply(stage, context);
    return { ok: true, stage, result };
  },

  'POST /api/iteration/start': async (q, body) => {
    needRun();
    const file = body.file;
    if (!file || !state.files[file]) throw new Error('unknown file: ' + file);
    if (state.run.iteration === 0) {
      // first pick of this batch: everything before it was setup overhead
      const slug = slugify(state.run.config.repoUrl);
      state.overheadLedger[slug] = (state.overheadLedger[slug] || 0)
        + Math.max(0, Math.floor(Date.now() / 1000) - state.run.startedAt);
    }
    // close any stopwatch left running by a previous, abandoned attempt
    for (const other of Object.values(state.files)) {
      if (other.attemptStartedAt && other.path !== file) accrueSpent(other.path);
    }
    state.run.iteration += 1;
    const template = state.decisions.pre_pick?.result?.branchTemplate || 'tests/improve-{file}';
    const branch = template.replace('{file}', fileSlug(file));
    S.setStage('picking_file', `iteration ${state.run.iteration}: picked ${file}`);
    await repo.createBranch(branch);
    S.upsertFile(file, {
      status: 'picked', branch, attempts: state.files[file].attempts + 1,
      rounds: 0, roundBase: null, lastSurvived: null,
      mutantAttempts: {}, mutantAttemptCount: 0, mutantFailures: 0, mutantsKilled: 0,
      mutantNoOutput: {}, mutantGenFailures: 0,
      attemptStartedAt: Math.floor(Date.now() / 1000),
    });
    S.save();
    return { ok: true, file, branch, iteration: state.run.iteration };
  },

  'POST /api/stryker/run': async (q, body) => {
    needRun();
    const file = body.file;
    if (!file) throw new Error('file required');
    S.setStage(body.stage || 'improving_mutation', `mutation testing ${file}`);
    let r;
    try {
      r = await stryker.runStryker(file);
    } catch (e) {
      if (body.phase === 'baseline') {
        // one broken file must not sink a full-repo run: record and move on
        S.event('improving_mutation', `stryker failed on ${file} — marking file failed: ${e.message.slice(0, 250)}`);
        const spentSec = accrueSpent(file);
        const cov = state.files[file]?.coverage ?? null;
        // Settling it in the ledger is PERMANENT — replayed in every later batch — so
        // one timeout or OOM would blacklist a file forever. Let it come back until
        // it has failed as often as any other file is allowed to be attempted.
        const crashes = (measured()[file]?.baselineCrashes || 0) + 1;
        const settled = crashes >= (state.run.config.maxAttemptsPerFile || 3);
        S.upsertFile(file, {
          status: 'failed', failedKind: 'measurement', coverageBefore: cov, failure: e.message.slice(0, 200),
        });
        recordMeasurement(file, { coverageBefore: cov, failure: e.message.slice(0, 200), baselineCrashes: crashes });
        if (settled) {
          ledger()[file] = {
            state: 'failed', ts: Date.now(),
            metrics: { spentSec, tokens: state.files[file]?.tokens, coverageBefore: cov, failure: e.message.slice(0, 200) },
          };
        }
        S.save();
        return { ok: false, failed: true, score: 0, survived: [], totalMutants: 0, error: e.message.slice(0, 500) };
      }
      throw e;
    }
    const f = state.files[file] || S.upsertFile(file, {});
    const fileMac = mac(f.coverage, r.score);
    S.upsertFile(file, {
      mutation: r.score, mac: fileMac, totalMutants: r.totalMutants,
      survivedTotal: r.survivedTotal ?? (r.survived || []).length,
      lastSurvived: (r.survived || []).slice(0, 100),
    });
    // state.json keeps the first hundred for the dashboard; the QUEUE keeps all of
    // them, on disk, with what has already been tried at each site.
    mutantStore.replace(file, r.survivedAll || r.survived || []);
    if (body.phase === 'baseline') {
      S.upsertFile(file, {
        macBefore: fileMac, coverageBefore: f.coverage, mutationBefore: r.score,
      });
      // survives batches even if this file is never improved
      recordMeasurement(file, { coverageBefore: f.coverage, mutationBefore: r.score, macBefore: fileMac });
      if (state.run.baseline.mutationPct == null) state.run.baseline.mutationPct = r.score;
      state.run.baseline.mac = mac(state.run.baseline.coveragePct, state.run.baseline.mutationPct);
      S.save();
    }
    // survivedAll is an internal identity list — keep it out of n8n execution data
    const { survivedAll, ...payload } = r;
    return { ok: true, ...payload };
  },

  'GET /api/files/gaps': async (q) => {
    needRun();
    const p = q.get('path');
    if (!p) throw new Error('path required');
    S.setStage('improving_coverage', `analysing coverage gaps in ${p}`);
    const source = repo.readFileSafe(p, 24000);
    const guess = repo.guessTestPath(p);
    let existingTest = guess.exists ? repo.readFileSafe(guess.path, 12000) : null;
    if (!existingTest) {
      // no test for this file yet → hand the LLM a sibling test to imitate
      // (import aliases, setup files, naming conventions)
      const ref = repo.findStyleReference(p);
      if (ref) existingTest = `// STYLE REFERENCE — an existing test from this repo (${ref.path}).\n// Imitate its imports, aliases and conventions. Do not modify it.\n${ref.content}`;
    }
    return {
      ok: true, path: p, source, sourceLines: source ? source.split('\n').length : 0,
      uncovered: coverage.uncoveredLines(p),
      rounds: state.files[p]?.rounds || 0,
      survived: state.files[p]?.lastSurvived || [],
      // the coverage phase is only a BOOTSTRAP: it exists to get a file executed at
      // all, because mutation testing has nothing to work with otherwise. Once any
      // coverage exists, killing mutants raises coverage as a side effect.
      needsBootstrap: (state.files[p]?.coverage ?? 0) <= 0 || coverage.uncoveredLines(p).lines === 'all',
      ui: repo.detectUi(),
      testPath: guess.path, testExists: guess.exists, existingTest,
      runner: state.runner?.testRunner,
      constraints: rulesMod.testWritingConstraints(),
      packageJson: (repo.readPkg().name || '') + ' (type=' + (repo.readPkg().type || 'commonjs') + ')',
    };
  },

  'POST /api/test/write': async (q, body) => {
    needRun();
    try {
      const r = repo.writeTestFile(body.path, String(body.content || ''));
      S.event('improving_coverage', 'wrote ' + r.path + ' (' + r.bytes + ' bytes)');
      return { ok: true, ...r };
    } catch (e) { return { ok: false, error: e.message }; }
  },

  'POST /api/test/delete': async (q, body) => {
    needRun();
    return { ok: repo.deleteTestFile(body.path) };
  },

  'POST /api/test/write-many': async (q, body) => {
    needRun();
    if (body.stage) S.setStage(body.stage, 'writing generated tests');
    const written = [], errors = [];
    for (const t of (body.tests || []).slice(0, 5)) {
      try {
        const r = repo.writeTestFile(t.path, String(t.content || ''));
        written.push(r.path);
        S.event(body.stage || 'improving_coverage', 'wrote ' + r.path + ' (' + r.bytes + ' bytes)');
      } catch (e) { errors.push({ path: t.path, error: e.message }); }
    }
    // Bootstrap tests change what mutation testing can see. The survivor list the
    // mutant loop is about to read came from the BASELINE run, when the file had no
    // tests at all — on a 0-coverage file that list is empty, and the loop would
    // conclude "nothing to kill" on a file that just became fully mutable.
    const cur = pickedFile();
    if (written.length && cur && body.stage === 'improving_coverage') {
      S.upsertFile(cur, { survivorsStale: true });
    }
    return { ok: true, written, errors };
  },

  'POST /api/test/delete-many': async (q, body) => {
    needRun();
    const deleted = [];
    for (const p of [...new Set(body.paths || [])]) {
      if (repo.deleteTestFile(p)) deleted.push(p);
    }
    S.event(body.stage || 'improving_coverage', 'deleted generated tests that broke the suite: ' + deleted.join(', '));
    return { ok: true, deleted };
  },

  'POST /api/test/run': async (q, body) => {
    needRun();
    if (body.stage) S.setStage(body.stage, 'running tests ' + (body.path || '(full suite)'));
    try {
      const r = await tests.runTests(body.path || null);
      return { ok: true, ...r };
    } catch (e) { return { ok: false, passed: false, error: e.message }; }
  },

  'POST /api/llm/chat': async (q, body) => {
    if (body.stage) S.setStage(body.stage, body.stageDetail || 'consulting LLM');
    try {
      const r = await llm.chat({
        system: body.system, prompt: body.prompt, messages: body.messages,
        maxTokens: clamp(parseInt(body.maxTokens || '4096', 10), 64, 12000),
        temperature: body.temperature, json: !!body.json, decision: !!body.decision,
        // explicit override from the workflow: the cheap kill attempt asks for no reasoning
        thinking: body.thinking,
      });
      return { ok: true, text: r.text, json: r.json ?? null };
    } catch (e) { S.event('llm', 'LLM error: ' + e.message); return { ok: false, error: e.message }; }
  },

  'POST /api/test/cleanup': async (q, body) => {
    needRun();
    const file = body.file;
    const f = state.files[file] || {};
    S.setStage('preparing_pr', `cleaning up generated tests for ${file}`);
    // Accepted rounds are already COMMITTED, so the working tree is usually clean
    // here — select against the base branch, not `git status`.
    const changed = await pr.changedTestFiles();
    if (!changed.length) S.event('preparing_pr', `cleanup: no generated test files found for ${file}`);
    const results = [];
    for (const p of changed.slice(0, 5)) {
      const original = repo.readFileSafe(p, 100000);
      if (!original) continue;
      try {
        const r = await llm.chat({
          system: 'You are a strict test-code editor. Clean this generated test file: (1) REMOVE all scratch/chain-of-thought comments — anything reasoning aloud ("Wait", "Let\'s try", exploratory strategy essays, self-corrections). Keep at most ONE short comment per test stating which mutant/behavior it verifies. (2) REMOVE tests that are vacuous (cannot fail, assert nothing meaningful, or admit in comments they kill nothing). (3) Do NOT change, weaken, or reorder any remaining test logic, imports, or setup. Reply with ONLY the complete cleaned file content — no markdown fences, no explanation.',
          prompt: original,
          maxTokens: 9000, temperature: 0.1,
        });
        const cleaned = (r.text || '').replace(/^[\s\S]*?<\/think>/, '')
          .replace(/^```[a-z]*\s*\n?/m, '').replace(/```\s*$/m, '').trim() + '\n';
        const plausible = cleaned.length > 200 && /\b(it|test|describe)\s*\(/.test(cleaned)
          && cleaned.length >= original.length * 0.2 && cleaned.length <= original.length * 1.2;
        if (!plausible || cleaned === original) {
          results.push({ path: p, kept: 'original', reason: !plausible ? 'implausible cleanup output' : 'no changes' });
          continue;
        }
        repo.writeTestFile(p, cleaned);
        results.push({ path: p, kept: 'cleaned', bytesBefore: original.length, bytesAfter: cleaned.length, _original: original });
      } catch (e) { results.push({ path: p, kept: 'original', reason: e.message.slice(0, 200) }); }
    }
    const touched = results.filter((r) => r.kept === 'cleaned');
    const publicResults = results.map(({ _original, ...r }) => r);
    if (!touched.length) {
      const mergedOnly = await consolidate(file, f.coverageAfter ?? f.coverage ?? 0, f.mutationAfter ?? f.mutation ?? 0);
      return { ok: true, cleaned: 0, merged: mergedOnly, results: publicResults };
    }
    // Verified cleanup: the suite stays green and NEITHER HALF of MAC may drop.
    // Checking the mutation score alone let cleanup delete the bootstrap coverage
    // test — which is exactly the "vacuous" shape it is told to remove — for free:
    // deleting a test moves its mutants from `survived` to `nocoverage`, and both
    // sit in the score's denominator, so the score does not move while coverage
    // collapses. The PR body, written before cleanup, would then advertise coverage
    // the branch no longer delivers.
    const covBase = f.coverageAfter ?? f.coverage ?? 0;   // snapshot first: runCoverage overwrites it
    const mutBase = f.mutationAfter ?? f.mutation ?? 0;
    let newScore = null, newCov = null, ok = false, why = '';
    const cr = await coverage.runCoverage();              // this runs the whole suite too
    if (cr.exitCode !== 0) why = 'suite went red';
    else {
      newCov = state.files[file]?.coverage ?? null;
      try {
        const st = await stryker.runStryker(file);
        newScore = st.score;
        ok = newScore >= mutBase && (newCov ?? 0) >= covBase;
        if (!ok) why = `mutation ${mutBase}→${newScore}, coverage ${covBase}→${newCov}`;
      } catch (e) { why = 'could not re-measure: ' + e.message.slice(0, 120); }
    }
    if (!ok) {
      for (const t of touched) repo.writeTestFile(t.path, t._original);
      // runCoverage already wrote the post-cleanup number into state — put it back
      S.upsertFile(file, { coverage: covBase, coverageAfter: covBase });
      S.event('preparing_pr', `cleanup reverted: ${why}`);
      return { ok: true, cleaned: 0, reverted: true, results: publicResults };
    }
    const cov = newCov ?? covBase;
    S.upsertFile(file, {
      coverage: cov, coverageAfter: cov,
      mutation: newScore, mutationAfter: newScore, mac: mac(cov, newScore), macAfter: mac(cov, newScore),
    });
    // cleaned files are edits on top of committed rounds — commit them so the PR carries them
    try { await pr.commit(`test: tidy generated tests for ${file}`); }
    catch (e) { S.event('preparing_pr', 'cleanup commit note: ' + e.message.slice(0, 160)); }
    S.event('preparing_pr', 'cleanup kept: ' + touched.map((t) => `${t.path} ${t.bytesBefore}→${t.bytesAfter}B`).join(', '));
    const merged = await consolidate(file, covBase, newScore);
    return { ok: true, cleaned: touched.length, merged, mutationAfter: newScore, results: publicResults };
  },

  // ── mutant-driven loop: one target, one test, verified kill ────────────────
  'GET /api/mutant/next': async (q) => {
    needRun();
    const p = q.get('path');
    const f = p && state.files[p];
    if (!f) throw new Error('unknown file: ' + p);
    // The budget stops WASTE, not progress: a successful kill is the goal, so only
    // failed attempts consume it. (Counting every attempt made the loop quit with
    // 10 killable survivors still on the table.) A generous hard ceiling remains as
    // a runaway guard.
    const budget = state.run.config.maxMutantsPerFile || 5;
    const failures = f.mutantFailures || 0;
    const spent = f.mutantAttemptCount || 0;
    const hardCeiling = budget * 6;
    // The budget bounds WASTE, and a test that cannot run is waste whoever is at
    // fault. Counting only judged failures against it removed the brake entirely: on a
    // live file 19 red tests cost 0 of 15, so the round ran for two and a half hours
    // with the 90-attempt ceiling as its only stop. A red test still does not retire
    // its MUTANT — that distinction is about evidence and stands — but it does spend
    // the loop's time.
    const genFailures = f.mutantGenFailures || 0;
    if (failures + genFailures >= budget) {
      return {
        ok: true, mutant: null, done: true,
        reason: `attempt budget spent (${failures} test(s) killed nothing, ${genFailures} could not be written or run; `
          + `${f.mutantsKilled || 0} killed)`,
      };
    }
    if (spent >= hardCeiling) {
      return { ok: true, mutant: null, done: true, reason: `hard attempt ceiling ${hardCeiling} reached (${f.mutantsKilled || 0} killed)` };
    }

    // A stale list is not evidence of "nothing left to kill". Re-measure before
    // giving up: the coverage bootstrap just made the file executable, so mutants
    // that were unreachable (or invisible, when the baseline run found no tests at
    // all) are now live targets.
    if (f.survivorsStale) {
      S.setStage('improving_mutation', `re-measuring mutants in ${p} after new tests`);
      try {
        // Coverage is otherwise measured only at baseline and at verify, so a file that
        // had no tests carries coverage 0 — and therefore MAC 0 — for the whole round,
        // however many mutants die. This is the one moment we KNOW it changed: the
        // bootstrap just made the file executable. One coverage run, once per file.
        try { await coverage.runCoverage(); } catch { }
        const fresh = await stryker.runStryker(p);
        const cov = state.files[p]?.coverage ?? f.coverage;
        S.upsertFile(p, {
          mutation: fresh.score, mac: mac(cov, fresh.score), totalMutants: fresh.totalMutants,
          survivedTotal: fresh.survivedTotal ?? (fresh.survived || []).length,
          lastSurvived: (fresh.survived || []).slice(0, 100),
          survivorsStale: false,
        });
      } catch (e) {
        S.event('improving_mutation', `mutation re-measure failed on ${p}: ${e.message.slice(0, 200)}`);
        S.upsertFile(p, { survivorsStale: false });
      }
    }
    const cur = state.files[p];
    // a mutant we could not write a test for a few times running is parked, so one
    // pathological target cannot pin the loop to itself
    const misses = cur.mutantNoOutput || {};
    const writable = (cur.lastSurvived || []).filter((m) => (misses[mutantsMod.mutantKey(m)] || 0) < 3);
    const candidates = mutantsMod.shortlist(writable, { attempts: cur.mutantAttempts || {} });
    if (!candidates.length) return { ok: true, mutant: null, done: true, reason: 'no viable surviving mutants left' };

    const source = repo.readFileSafe(p, 24000);
    const fileLines = source ? source.split('\n').length : null;

    // The model chooses. The heuristic only shortlisted: it can see "covered" and
    // "clustered", but not whether a mutation has an observable effect a test can
    // assert — which is what actually decides killability.
    let next = candidates[0];
    let pickedBy = 'heuristic (only one candidate)';
    let killIdea = '';
    if (candidates.length > 1) {
      S.setStage('improving_mutation', `choosing the next mutant to attack in ${p}`);
      try {
        // what already resisted a targeted test — usually equivalent mutants
        const failed = Object.entries(f.mutantAttempts || {})
          .filter(([, n]) => n > 0)
          .map(([k, n]) => {
            // the key is mutator|line|column|replacement — keep all of it, or the
            // prompt bans siblings the candidate filter deliberately left in
            const [mutator, line, column, replacement] = k.split('|');
            return { mutator, line: Number(line), column: column || null, replacement: replacement || null, attempts: n };
          });
        const req = mutantsMod.buildPickRequest(candidates, {
          file: p, source, constraints: rulesMod.testWritingConstraints(), failed,
        });
        const r = await llm.chat(req);
        const resolved = mutantsMod.resolvePick(r.json, candidates);
        if (resolved) {
          next = resolved.mutant;
          killIdea = resolved.killIdea;
          pickedBy = 'llm';
          state.decisions.pick_mutant = {
            rule: '(pipeline decision — which surviving mutant to attack next)',
            result: {
              file: p, mutator: next.mutator, line: next.line,
              reason: resolved.reason, killIdea: resolved.killIdea,
              consideredCandidates: candidates.length,
            },
            ts: Date.now(),
          };
          S.event('improving_mutation', `LLM picked ${next.mutator} at line ${next.line} of ${candidates.length} candidates: ${resolved.reason}`);
        } else {
          pickedBy = 'heuristic (LLM answer unusable)';
          S.event('improving_mutation', 'mutant choice: LLM answer unusable — falling back to the ranked top candidate');
        }
      } catch (e) {
        pickedBy = 'heuristic (LLM error)';
        S.event('improving_mutation', 'mutant choice: LLM error — falling back to the ranked top candidate: ' + e.message.slice(0, 140));
      }
    }
    const guess = repo.guessTestPath(p);
    // Prefer a test WE already wrote for THIS file — the bootstrap's is proven green
    // against this exact module, and a working example is worth more than a stylistic
    // one from a stranger.
    const ours = repo.ourTestFor(p);
    let existingTest = ours?.content
      ? `// A test already generated for THIS file, and it RUNS. Follow its imports, its\n`
        + `// helpers and its setup exactly; only the assertions need to be new (${ours.path}).\n${ours.content}`
      : (guess.exists ? repo.readFileSafe(guess.path, 8000) : null);
    if (!existingTest) {
      const ref = repo.findStyleReference(p);
      if (ref) existingTest = `// STYLE REFERENCE — an existing test from this repo (${ref.path}).\n${ref.content}`;
    }
    S.setStage('improving_mutation', `targeting ${next.mutator} at ${p}:${next.line} (${spent + 1}/${budget})`);
    S.event('improving_mutation', `next target [${pickedBy}]: ${next.mutator} at line ${next.line} — ${next.why}`);
    // The BATCH the loop aims at first. Measured against the real model on eight
    // survivors: one file aimed at all of them kills 6.0 on average, where the
    // single-target prompt kills 3.0 — and a single-target attempt pays a scoped test
    // run and a mutation check for its one mutant, so the real gap is wider. The
    // single pick stays as the head of the list and as the fallback when a batch
    // kills nothing.
    const batch = [next, ...candidates.filter((m) => !mutantsMod.sameMutant(m, next))].slice(0, BATCH_TARGETS);
    // Sites, not mutants: one test per place in the source, busiest first. The queue
    // holds every survivor and remembers which sites already have a test, so a file with
    // a thousand mutants costs one generation per SITE and nothing at all for the sites
    // already covered.
    const groups = mutantStore.nextGroups(p, 12);
    return {
      ok: true, done: false, path: p, mutant: next, targets: batch, groups,
      pickedBy, killIdea, candidatesConsidered: candidates.length,
      attemptsSpent: spent, failures, budget,
      verifyRange: mutantsMod.verifyRange(next, { fileLines }),
      source, sourceLines: fileLines,
      testPath: guess.path, testExists: guess.exists, existingTest,
      runner: state.runner?.testRunner, ui: repo.detectUi(),
      constraints: rulesMod.testWritingConstraints(),
      packageJson: (repo.readPkg().name || '') + ' (type=' + (repo.readPkg().type || 'commonjs') + ')',
    };
  },

  // A site now has a test, whatever that test turns out to be worth. Recorded before
  // any verification, because the guarantee is "one shot per site" and a shot fired is a
  // shot spent — otherwise the next sweep offers the same sites for ever.
  'POST /api/mutant/written': async (q, body) => {
    needRun();
    const { file, names = [] } = body;
    if (!file || !state.files[file]) throw new Error('unknown file: ' + file);
    mutantStore.markWritten(file, names);
    return { ok: true, written: names.length, pending: mutantStore.pending(file).length };
  },

  'POST /api/mutant/verify': async (q, body) => {
    needRun();
    // phase 'cheap' is the no-reasoning first attempt: its failure is not a verdict on
    // the mutant, because the escalated attempt has not happened yet. Anything else
    // (including no phase at all) is the last word.
    const { file, testPaths = [], phase } = body;
    // One entry point, two shapes: `mutants` is a batch aimed at many targets at once,
    // `mutant` is the single-target attempt (and the head of any batch). The verdict
    // machinery below is identical — only the bookkeeping differs, because a batch that
    // kills nothing has a single-target attempt still to come.
    const batch = Array.isArray(body.mutants) && body.mutants.length ? body.mutants : null;
    const mutant = batch ? batch[0] : body.mutant;
    const cheap = phase === 'cheap' || phase === 'batch';
    const f = file && state.files[file];
    if (!f || !mutant) throw new Error('file and mutant are required');
    const key = mutantsMod.mutantKey(mutant);
    // Two different questions, so two different flags:
    //   targetDied  → retire THIS mutant (it had its one shot)
    //   worthKeeping→ keep the test, and do not charge the failure budget
    // Conflating them let a test that killed only neighbours leave its target
    // with no recorded attempt, so the target could be picked again.
    const bump = (targetDied, worthKeeping) => {
      const attempts = { ...(f.mutantAttempts || {}) };
      // Every mutant this attempt AIMED at has now had its shot: the ones that died
      // leave the survivor list on their own, and the ones that survived a test written
      // for them are retired. Without that, the survivors of a batch come straight back
      // as candidates and the next batch attacks the same set for ever.
      const aimed = batch || [mutant];
      const dead = new Set(deadTargets.map((m) => mutantsMod.mutantKey(m)));
      for (const m of aimed) {
        const k = mutantsMod.mutantKey(m);
        if (!dead.has(k)) attempts[k] = (attempts[k] || 0) + 1;
      }
      S.upsertFile(file, {
        mutantAttempts: attempts,
        mutantAttemptCount: (f.mutantAttemptCount || 0) + 1,
        mutantFailures: (f.mutantFailures || 0) + (worthKeeping ? 0 : 1),
        mutantsKilled: (f.mutantsKilled || 0) + (batch ? deadTargets.length : (targetDied ? 1 : 0)),
      });
    };
    const drop = () => { for (const p of testPaths) repo.deleteTestFile(p); };
    // A mutant's one shot is spent by EVIDENCE — a test was written and the mutant
    // survived it. "The model returned nothing" and "the verification run crashed"
    // are evidence of nothing: retiring the target there discards a killable mutant
    // that was never attacked, and charging the failure budget lets a broken
    // generator or a flaky Stryker end the loop while the file is still improvable.
    const miss = (why) => {
      const misses = { ...(f.mutantNoOutput || {}) };
      misses[key] = (misses[key] || 0) + 1;
      S.upsertFile(file, {
        mutantNoOutput: misses,
        mutantAttemptCount: (f.mutantAttemptCount || 0) + 1,
        mutantGenFailures: (f.mutantGenFailures || 0) + 1,
      });
      S.event('improving_mutation', `${why} for ${mutant.mutator} at line ${mutant.line} `
        + `— the target stays on the queue (miss ${misses[key]})`);
    };

    if (!testPaths.length) {
      miss('no usable test was generated');
      return { ok: true, killed: false, noTest: true, retryable: cheap, reason: 'no test was written' };
    }

    // 1. The new test must pass — one that fails is never worth keeping.
    //    Scoped to the file just written: on a real repo that is ~1s against ~55s for
    //    the whole suite, on every one of up to fifteen attempts per file. The
    //    whole-suite question is still asked once per round by /api/verify, and a
    //    round whose full suite is red is dropped entirely — so a test that passes
    //    alone but breaks a neighbour costs that round, not a PR. Already-committed
    //    rounds were each full-suite verified when they were accepted.
    S.setStage('improving_mutation', `checking the new test for ${mutant.mutator} at line ${mutant.line}`);
    const suite = await tests.runTests(testPaths);
    if (!suite.passed) {
      // A test that fails against the REAL code is a broken test, not evidence that
      // this mutant resists testing — the same distinction as an empty answer, and
      // capped the same way.
      drop();
      miss('the generated test failed against the unmutated code');
      return { ok: true, killed: false, retryable: cheap, reason: 'suite red', summary: suite.summary };
    }
    // 2. Verify the kill on a RANGE around the target, and fall back to the whole file
    //    only when the window saw nothing die.
    //
    //    Measured over a 5-hour run: the whole-file re-run after every attempt was 178
    //    of 305 minutes — 58% of the pipeline, 194s median — spent answering one
    //    question about one mutant by re-testing every mutant in the file.
    //
    //    A window answers that question cheaply, but it cannot see collateral outside
    //    itself, and a test whose only kill was distant would be discarded on its
    //    evidence alone. So the window is a FAST PATH, not a replacement: if anything
    //    in it died, that is enough to keep the test and we stop there. If nothing did,
    //    we pay for the whole-file run before drawing any conclusion — which is what
    //    used to happen every single time. About four attempts in five kill something,
    //    so most of the 178 minutes goes away and no test is thrown out that the old
    //    path would have kept.
    const src = repo.readFileSafe(file, 500000);
    const fileLines = src ? src.split('\n').length : null;
    // A batch spans several targets, so the window has to cover all of them — the
    // union of each one's range, capped so a batch spread across a whole file simply
    // becomes a whole-file run rather than a window that pretends to be one.
    const ranges = (batch || [mutant]).map((m) => mutantsMod.verifyRange(m, { pad: 30, fileLines }));
    const range = {
      from: Math.min(...ranges.map((r) => r.from)),
      to: Math.max(...ranges.map((r) => r.to)),
    };
    const inRange = (m) => (m.line ?? 0) >= range.from && (m.line ?? 0) <= range.to;
    const before = f.survivedTotal ?? (f.lastSurvived || []).length;
    const beforeScore = f.mutation ?? 0;
    let killedTarget = false, killedCount = 0, scoreRose = false, note = '', fullRun = false;
    let deadTargets = [];
    try {
      const r = await stryker.runStryker(file, { range });
      // A window with no mutants is not a measurement: an empty survivor list would
      // read as "everything in it died" — the trap that once scored one test as 112.
      if (r.noTests || !r.totalMutants) throw new Error('window measured nothing');
      const alive = r.survivedAll || r.survived || [];
      killedTarget = !alive.some((x) => mutantsMod.sameMutant(x, mutant));
      // per-target verdict: which of the ones we AIMED at actually died
      deadTargets = (batch || [mutant]).filter((m) => !alive.some((x) => mutantsMod.sameMutant(x, m)));
      const nowDead = (f.lastSurvived || []).filter(inRange)
        .filter((m) => !alive.some((x) => mutantsMod.sameMutant(x, m)));
      if (killedTarget || nowDead.length) {
        killedCount = nowDead.length || 1;
        // the queue must lose what this run proved dead, or the next pick attacks a
        // corpse; the whole-file run used to refresh it as a side effect
        const pruned = (f.lastSurvived || []).filter((m) => !nowDead.some((d) => mutantsMod.sameMutant(d, m)));
        const remaining = Math.max(0, before - nowDead.length);
        S.upsertFile(file, { lastSurvived: pruned, survivedTotal: remaining });
        // A window cannot measure the file's score, but the survivor COUNT is now
        // exact for everything it saw, and the total came from the last whole-file
        // run — so the dashboard gets a real per-attempt figure instead of a blank row.
        const total = f.totalMutants;
        if (total) {
          const est = round2(((total - remaining) / total) * 100);
          const cov = state.files[file]?.coverageAfter ?? state.files[file]?.coverage;
          const estMac = mac(cov, est);
          recordMeasurement(file, { attemptMutation: est, attemptMac: estMac });
          if ((estMac ?? 0) >= (state.files[file]?.attemptMac ?? -1)) {
            S.upsertFile(file, { attemptCoverage: cov, attemptMutation: est, attemptMac: estMac });
          }
        }
      } else {
        // nothing died where we looked — that is not yet a verdict
        fullRun = true;
      }
    } catch (e) {
      fullRun = true;
      note = 'window check failed: ' + e.message.slice(0, 120);
    }

    if (fullRun) {
      note = '';
      try {
        const r = await stryker.runStryker(file);
        if (r.noTests || r.totalMutants == null) {
          note = 'mutation re-run executed no tests — nothing was measured';
          throw new Error(note);
        }
        const alive = r.survived || [];
        const aliveAll = r.survivedAll || alive;
        killedTarget = !aliveAll.some((x) => mutantsMod.sameMutant(x, mutant));
        deadTargets = (batch || [mutant]).filter((m) => !aliveAll.some((x) => mutantsMod.sameMutant(x, m)));
        const afterTotal = r.survivedTotal ?? alive.length;
        killedCount = Math.max(0, before - afterTotal);
        scoreRose = (r.score ?? 0) > beforeScore;
        S.upsertFile(file, {
          lastSurvived: alive.slice(0, 100),
          survivedTotal: afterTotal,
          mutation: r.score,
          totalMutants: r.totalMutants,
          mac: mac(f.coverageAfter ?? f.coverage, r.score),
        });
        const cov = state.files[file]?.coverageAfter ?? state.files[file]?.coverage;
        const attemptMac = mac(cov, r.score);
        recordMeasurement(file, { attemptMutation: r.score, attemptMac });
        if ((attemptMac ?? 0) >= (state.files[file]?.attemptMac ?? -1)) {
          S.upsertFile(file, { attemptCoverage: cov, attemptMutation: r.score, attemptMac });
        }
      } catch (e) {
        note = note || ('mutation re-run failed: ' + e.message.slice(0, 160));
      }
    }

    // A test earns its place if it killed ANYTHING — collateral kills are real
    // improvement even when the chosen target turns out to be equivalent.
    // three independent signals, any of which means the test did real work:
    // the target died, the survivor count fell, or the score rose.
    if (note) {
      drop();
      miss(note);
      return { ok: true, killed: false, killedCount: 0, retryable: cheap, reason: note, testPaths };
    }
    const worthKeeping = killedTarget || killedCount > 0 || scoreRose;
    // A cheap attempt that achieved nothing is not the mutant's verdict — the
    // reasoning attempt is still to come, and retiring the target here would leave it
    // with nothing to aim at. Charge nothing, keep the target on the queue, and tell
    // the caller to escalate.
    if (cheap && !worthKeeping) {
      drop();
      S.upsertFile(file, { mutantAttemptCount: (f.mutantAttemptCount || 0) + 1 });
      S.event('improving_mutation', `no kill without reasoning for ${mutant.mutator} at line ${mutant.line} — escalating to a thinking attempt`);
      return { ok: true, killed: false, killedCount: 0, retryable: true, reason: 'no mutant died (cheap attempt)', testPaths };
    }
    // The TARGET is retired unless it actually died — one shot per mutant, whatever
    // else the test achieved. The failure budget, by contrast, is only charged when
    // the test achieved nothing at all.
    bump(killedTarget, worthKeeping);
    if (!worthKeeping) {
      drop();
      S.event('improving_mutation', `discarded: ${mutant.mutator} at line ${mutant.line} — nothing died${note ? ' (' + note + ')' : ''}`);
      return { ok: true, killed: false, killedCount: 0, retryable: false, reason: note || 'no mutant died', testPaths };
    }
    const collateral = Math.max(0, killedCount - (killedTarget ? 1 : 0));
    S.event('improving_mutation', `KILLED ${killedCount} mutant(s) — target ${mutant.mutator} at line ${mutant.line} `
      + `${killedTarget ? 'died' : 'SURVIVED but the test killed others'}${collateral ? `, ${collateral} collateral` : ''} `
      + `— keeping ${testPaths.join(', ')} (${state.files[file].survivedTotal ?? (f.lastSurvived || []).length} survivor(s) left)`);
    return {
      ok: true, killed: true, killedTarget, killedCount, collateral, retryable: false,
      killedTargets: deadTargets.length, aimedAt: (batch || [mutant]).length,
      testPaths, killedSoFar: state.files[file].mutantsKilled || 0,
    };
  },

  'POST /api/verify': async (q, body) => {
    needRun();
    const file = body.file;
    if (!file || !state.files[file]) throw new Error('unknown file: ' + file);
    const f = state.files[file];
    S.setStage('improving_mac', `verifying MAC improvement for ${file}`);
    try {
      // A round that wrote nothing has nothing to measure — and measuring it anyway
      // costs a suite run, a coverage run and a mutation run (three minutes on a
      // real repo) to rediscover that. This happens for real: the bootstrap returns
      // no parseable answer, the mutant loop keeps nothing, and the file is verified
      // against itself.
      const changedNow = await pr.changedFiles();
      if (!changedNow.length) {
        S.event('improving_mac', `nothing to verify for ${file} — this round changed no files`);
        return {
          ok: true, improved: false, improvedAny: false, degradedAny: false, testsGreen: true,
          reason: 'no changes in this round', rounds: f.rounds || 0,
          maxRounds: state.run.config.maxRoundsPerFile, file,
        };
      }
      // ONE measurement pass: runCoverage runs the whole suite already, so a separate
      // runTests here was a second full suite run over an unchanged tree.
      const cov = await coverage.runCoverage();
      if (cov.exitCode !== 0) {
        return { ok: true, improved: false, testsGreen: false, reason: 'full suite red', summary: cov.summary, file };
      }
      S.setStage('improving_mac', `re-measuring mutation score for ${file}`);
      const st = await stryker.runStryker(file);
      const coverageAfter = state.files[file].coverage;
      const macAfter = mac(coverageAfter, st.score);
      S.upsertFile(file, {
        mutation: st.score, mac: macAfter, macAfter, coverageAfter, mutationAfter: st.score,
        // this is the list the NEXT round's mutant loop works from — truncating it
        // to 10 silently caps how much of a big file a run can ever reach
        lastSurvived: (st.survived || []).slice(0, 100),
        survivedTotal: st.survivedTotal ?? (st.survived || []).length,
        survivorsStale: false,
      });
      state.run.result.coveragePct = cov.totalPct;
      state.run.result.mutationPct = st.score;
      state.run.result.mac = mac(cov.totalPct, st.score);
      S.save();
      // ONE mutation run has just told us which test file killed what. A file that
      // killed nothing is dead weight by D12's definition, and this is the only moment
      // we can say so without paying for another measurement.
      if (st.report) {
        const byFile = mutantsMod.killsByTestFile(st.report);
        const ours = /\.(kill-L\d+-[a-z0-9-]+|kill-batch-[a-z0-9]+|mac-cov(-r\d+)?)\.test\.[cm]?[jt]sx?$/;
        for (const [testFile, kills] of Object.entries(byFile)) {
          if (kills > 0 || !ours.test(testFile)) continue;
          // the coverage bootstrap is exempt: its job is to make the file execute at
          // all, and it is measured by coverage rather than by kills
          if (/mac-cov/.test(testFile)) continue;
          if (repo.deleteTestFile(testFile)) {
            S.event('improving_mac', `dropped ${testFile}: the mutation run credits it with no kills`);
          }
        }
        mutantStore.recordOutcome(file, { killed: [] });
      }
      const diff = await pr.diffAgainstBase();
      const changed = await pr.changedFiles();
      // round criterion: keep the round iff ≥1 metric improves AND none degrades
      const rb = f.roundBase || { coverage: f.coverageBefore, mutation: f.mutationBefore, mac: f.macBefore };
      const improvedAny = changed.length > 0 && ((coverageAfter ?? 0) > (rb.coverage ?? 0)
        || (st.score ?? 0) > (rb.mutation ?? 0) || (macAfter ?? 0) > (rb.mac ?? 0));
      const degradedAny = (coverageAfter ?? 0) < (rb.coverage ?? 0)
        || (st.score ?? 0) < (rb.mutation ?? 0) || (macAfter ?? 0) < (rb.mac ?? 0);
      // no changed files → any measured delta is stryker flakiness, not improvement
      const improved = (macAfter ?? 0) > (f.macBefore ?? 0) && changed.length > 0;
      // remember the best result any attempt reached, even if it is not kept —
      // "we tried and got this far" is information worth showing
      const prev = measured()[file] || {};
      if ((macAfter ?? 0) >= (prev.attemptMac ?? -1)) {
        recordMeasurement(file, { attemptCoverage: coverageAfter, attemptMutation: st.score, attemptMac: macAfter });
      }
      S.event('improving_mac', `round ${(f.rounds || 0) + 1} of ${file}: cov ${rb.coverage}→${coverageAfter}, mut ${rb.mutation}→${st.score}, mac ${rb.mac}→${macAfter} — ${improvedAny && !degradedAny ? 'PROGRESS (another round)' : degradedAny ? 'DEGRADED (stop, drop round)' : 'STALE (stop)'}`);
      return {
        ok: true, file, testsGreen: true,
        coverageBefore: f.coverageBefore, coverageAfter,
        mutationBefore: f.mutationBefore, mutationAfter: st.score,
        macBefore: f.macBefore, macAfter,
        improved,
        improvedAny, degradedAny,
        rounds: f.rounds || 0,
        maxRounds: state.run.config.maxRoundsPerFile || 5,
        totalCoverage: cov.totalPct,
        changedFiles: changed,
        diff: diff.slice(0, 30000),
        branch: f.branch,
      };
    } catch (e) {
      S.event('improving_mac', 'verification failed: ' + e.message.slice(0, 300));
      return { ok: true, improved: false, testsGreen: false, error: e.message, file };
    }
  },

  'POST /api/round/accept': async (q, body) => {
    needRun();
    const file = body.file;
    const f = state.files[file];
    if (!f) throw new Error('unknown file: ' + file);
    const rounds = (f.rounds || 0) + 1;
    // commit this round's tests so a later degrading round can be dropped alone
    try { await pr.commit(`test: improve MAC of ${file} (round ${rounds})`); }
    catch (e) { S.event('improving_mac', `round ${rounds} commit note: ${e.message}`); }
    S.upsertFile(file, {
      rounds,
      roundBase: { coverage: f.coverageAfter, mutation: f.mutationAfter, mac: f.macAfter },
      // The waste budget is PER ROUND. Carrying it across meant a round that ended on
      // the budget left the next one with nothing to spend: observed live as round 2
      // returning STALE 168 seconds after round 1, having made no attempt at all.
      // Rounds have their own stop rule — they continue only while a metric improves
      // and none degrades — so the budget does not need to bound them as well.
      // mutantAttempts is NOT reset: a mutant that resisted a targeted test has had its
      // one shot, and that verdict holds for the whole file.
      mutantFailures: 0, mutantGenFailures: 0, mutantAttemptCount: 0, mutantNoOutput: {},
    });
    S.event('improving_mac', `round ${rounds} accepted for ${file} (mac now ${f.macAfter}) — trying another round`);
    return { ok: true, file, rounds };
  },

  'POST /api/round/drop': async (q, body) => {
    needRun();
    const file = body.file;
    const f = state.files[file];
    if (!f) throw new Error('unknown file: ' + file);
    S.setStage('improving_mac', `finalizing ${file} after ${f.rounds || 0} accepted round(s)`);
    // drop the last (stale/degraded) round: uncommitted changes only
    await repo.discardUncommitted();
    const rb = f.roundBase || { coverage: f.coverageBefore, mutation: f.mutationBefore, mac: f.macBefore };
    const keptRounds = (f.rounds || 0) > 0;
    S.upsertFile(file, keptRounds
      ? { coverage: rb.coverage, mutation: rb.mutation, mac: rb.mac,
        coverageAfter: rb.coverage, mutationAfter: rb.mutation, macAfter: rb.mac }
      // nothing was kept: leave the "after" columns empty rather than echoing
      // "before" values, which read as a measured (null) improvement
      : { coverage: rb.coverage, mutation: rb.mutation, mac: rb.mac,
        coverageAfter: null, mutationAfter: null, macAfter: null });
    const diff = await pr.diffAgainstBase();
    const changed = diff.match(/^\+\+\+ b\/(.+)$/gm)?.map((l) => l.slice(6)) || [];
    const improved = (f.rounds || 0) > 0 && (rb.mac ?? 0) > (f.macBefore ?? 0);
    return {
      ok: true, file, testsGreen: true,
      coverageBefore: f.coverageBefore, coverageAfter: rb.coverage,
      mutationBefore: f.mutationBefore, mutationAfter: rb.mutation,
      macBefore: f.macBefore, macAfter: rb.mac,
      improved, rounds: f.rounds || 0,
      tokens: f.tokens,
      changedFiles: changed,
      diff: diff.slice(0, 30000),
      branch: f.branch,
    };
  },

  'POST /api/pr/create': async (q, body) => {
    needRun();
    const file = body.file;
    const f = state.files[file];
    if (!f) throw new Error('unknown file: ' + file);
    S.setStage('preparing_pr', `preparing PR for ${file}`);
    // human-equivalent timesheet from the cumulative diff (before commit resets nothing:
    // diff is vs base and includes committed rounds)
    let ts = null;
    try {
      const diffText = await pr.diffAgainstBase();
      const stats = timesheet.diffStats(diffText);
      const src = repo.readFileSafe(file, 500000);
      const mutantsKilled = (f.totalMutants && f.mutationAfter != null && f.mutationBefore != null)
        ? Math.max(0, Math.round((f.mutationAfter - f.mutationBefore) * f.totalMutants / 100))
        : Math.ceil(stats.testCases / 2);
      ts = timesheet.estimate({
        sourceLines: src ? src.split('\n').length : 0,
        testCases: stats.testCases, addedTestLines: stats.addedTestLines,
        mutantsKilled, rounds: f.rounds || 1,
      });
      S.event('preparing_pr', `human-equivalent timesheet for ${file}: ${ts.hours} h (analysis ${ts.analysisMin}m + writing ${ts.testsMin}m + mutation ${ts.mutationMin}m + verify ${ts.verifyMin}m)`);
    } catch (e) { S.event('preparing_pr', 'timesheet estimate skipped: ' + e.message.slice(0, 120)); }
    try {
      await pr.commit(body.title || `test: improve MAC of ${file}`);
    } catch (e) {
      if (/no changed test files/.test(e.message)) {
        await repo.resetToBase();
        S.upsertFile(file, { status: 'no_improvement' });
        S.event('preparing_pr', `skipping PR for ${file}: ${e.message}`);
        return { ok: true, pr: null, skipped: e.message };
      }
      throw e;
    }
    const rec = await pr.createPr({
      file, branch: f.branch, title: body.title, body: body.body || '', labels: body.labels || [],
    });
    const spentSec = accrueSpent(file);
    S.upsertFile(file, { status: 'improved', prUrl: rec.url, prPatch: rec.patchPath, timesheet: ts });
    ledger()[file] = {
      state: 'improved', prUrl: rec.url, patchPath: rec.patchPath, branch: f.branch, ts: Date.now(),
      metrics: {
        coverageBefore: f.coverageBefore, coverageAfter: f.coverageAfter,
        mutationBefore: f.mutationBefore, mutationAfter: f.mutationAfter,
        macBefore: f.macBefore, macAfter: f.macAfter,
        timesheet: ts, spentSec, tokens: f.tokens,
      },
    };
    S.save();
    await repo.resetToBase();
    return { ok: true, pr: rec };
  },

  'POST /api/iteration/discard': async (q, body) => {
    needRun();
    const file = body.file;
    S.setStage('improving_mac', `no improvement for ${file} — discarding changes`);
    await repo.resetToBase();
    if (file && state.files[file]) {
      const f = state.files[file];
      const spentSec = accrueSpent(file);
      if (f.status !== 'failed') {
        const maxAttempts = state.run.config.maxAttemptsPerFile || 3;
        S.upsertFile(file, { status: f.attempts >= maxAttempts ? 'no_improvement' : 'candidate' });
        if (f.attempts >= maxAttempts) {
          // keep the numbers: a file we could not improve is still a file we measured
          const m = measured()[file] || {};
          ledger()[file] = {
            state: 'exhausted', ts: Date.now(),
            metrics: {
              spentSec, attempts: f.attempts, tokens: f.tokens,
              coverageBefore: f.coverageBefore ?? m.coverageBefore,
              mutationBefore: f.mutationBefore ?? m.mutationBefore,
              macBefore: f.macBefore ?? m.macBefore,
              attemptCoverage: m.attemptCoverage, attemptMutation: m.attemptMutation, attemptMac: m.attemptMac,
            },
          };
          S.save();
        }
      }
    }
    S.event('improving_mac', `discarded changes for ${file}: ${body.reason || 'no MAC improvement'}`);
    return { ok: true };
  },

  // Plain reset is what the batch driver does BETWEEN batches, so it deliberately
  // keeps the ledgers — they are the record of what is already settled. Starting a
  // repo over is a different request, and has to say so.
  'POST /api/admin/reset': async (q, body = {}) => {
    // read the target BEFORE the run is dropped — it is where the repo url lives
    const target = body.repoUrl || state.run?.config?.repoUrl || process.env.REPO_URL || '';
    state.run = null; state.files = {}; state.decisions = {}; state.prs = []; state.events = []; state.seq = 0;
    const LEDGERS = ['improvedLedger', 'measureLedger', 'overheadLedger', 'tokenLedger'];
    let cleared = null;
    if (body.ledgers) {
      cleared = body.repoUrl ? slugify(body.repoUrl) : 'all repos';
      for (const name of LEDGERS) {
        if (body.repoUrl) delete state[name][slugify(body.repoUrl)];
        else state[name] = {};
      }
    }
    let repoRemoved = false;
    if (body.repo && target) {
      // a tree earlier runs wrote into is not a clean starting point
      try { fs.rmSync(path.join(S.DATA_DIR, 'repos', slugify(target)), { recursive: true, force: true }); repoRemoved = true; } catch { }
    }
    S.setStage('idle', cleared ? `state reset — ledgers cleared for ${cleared}` : 'state reset');
    S.save();
    return { ok: true, ledgersCleared: cleared, repoRemoved };
  },
};

// ── static dashboard ───────────────────────────────────────────────────────
const DASH = path.join(__dirname, 'dashboard');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
function serveStatic(req, res, rel) {
  if (!rel || rel === '/') rel = '/index.html';
  const abs = path.join(DASH, path.normalize(rel));
  if (!abs.startsWith(DASH)) { res.writeHead(403); return res.end(); }
  fs.readFile(abs, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(abs)] || 'application/octet-stream' });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const key = req.method + ' ' + u.pathname;
  try {
    if (routes[key]) {
      const body = req.method === 'POST' ? await readBody(req) : {};
      const out = await routes[key](u.searchParams, body);
      return json(res, 200, out);
    }
    if (u.pathname.startsWith('/api/')) return json(res, 404, { error: 'no such endpoint: ' + key });
    // dashboard: served at / and /dashboard (Caddy strips the /dashboard prefix)
    let rel = u.pathname;
    if (rel.startsWith('/dashboard')) rel = rel.slice('/dashboard'.length) || '/';
    return serveStatic(req, res, rel);
  } catch (e) {
    S.event('error', `${key}: ${e.message}`);
    // a rejected concurrent start is a guard, not a run failure
    if (e.statusCode === 409) return json(res, 409, { ok: false, error: e.message });
    // a hard error aborts the n8n execution → the run is dead; reflect that
    if (state.run && state.run.status === 'running' && req.method === 'POST') {
      state.run.status = 'failed';
      state.run.finishedAt = Math.floor(Date.now() / 1000);
      S.setStage('failed', e.message.slice(0, 200));
    }
    return json(res, 500, { ok: false, error: require('./util').redact(e.message) });
  }
});

// Importable: tests drive the route table in-process (with the OS-touching
// modules faked) instead of only ever exercising it through a live container.
if (require.main === module) {
  S.load();
  server.listen(PORT, () => console.log(`sidecar listening on :${PORT}`));
}

module.exports = { routes, server };
