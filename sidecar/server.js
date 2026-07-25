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
    req.on('data', (c) => { data += c; if (data.length > 20e6) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(new Error('bad JSON body')); } });
    req.on('error', reject);
  });
}
function needRun() { if (!state.run) throw new Error('no active run — POST /api/run/start first'); }
function ledger() {
  const slug = slugify(state.run.config.repoUrl);
  return (state.improvedLedger[slug] ||= {});
}

function metricsPayload() {
  const files = Object.values(state.files).sort((a, b) => (a.mac ?? 999) - (b.mac ?? 999));
  const targeted = files.filter((f) => f.macBefore != null);
  const avg = (xs) => xs.length ? round2(xs.reduce((s, x) => s + x, 0) / xs.length) : null;
  return {
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
    files,
    prs: state.prs,
    decisions: state.decisions,
    events: state.events.slice(-60),
  };
}

function candidates() {
  const cfg = state.run.config;
  const maxAttempts = cfg.maxAttemptsPerFile || 3;
  const all = Object.values(state.files);
  const processed = all.filter((f) => ['improved', 'no_improvement', 'failed'].includes(f.status)).length;
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

// ── route table ────────────────────────────────────────────────────────────
const routes = {
  'GET /api/health': async () => ({ ok: true, service: 'ijst-sidecar', stage: state.stage.name, ts: Date.now() }),
  'GET /api/state': async () => state,
  'GET /api/metrics': async () => metricsPayload(),
  'GET /api/rules': async () => ({ rules: state.run?.config?.rules || S.envConfig().rules, decisions: state.decisions }),
  'GET /api/events': async (q) => {
    const after = parseInt(q.get('after') || '0', 10);
    return { events: state.events.filter((e) => e.seq > after) };
  },

  'POST /api/stage': async (q, body) => {
    S.setStage(String(body.stage || 'idle'), String(body.detail || ''));
    return { ok: true, stage: state.stage };
  },

  'POST /api/run/start': async (q, body) => {
    state.run = S.freshRun(body);
    state.files = {};
    state.decisions = {};
    state.prs = [];
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
    // replay the persistent ledger so finished files are not re-picked
    let replayed = 0;
    for (const [p, rec] of Object.entries(ledger())) {
      if (!state.files[p]) continue;
      S.upsertFile(p, rec.state === 'improved'
        ? { status: 'improved', prUrl: rec.prUrl || null, prPatch: rec.patchPath || null, ...(rec.metrics || {}) }
        : { status: rec.state === 'failed' ? 'failed' : 'no_improvement', attempts: state.run.config.maxAttemptsPerFile || 3 });
      replayed += 1;
    }
    if (replayed) S.event('installing', `ledger: ${replayed} file(s) already settled in previous runs — skipping them`);
    return { ok: true, runner: det, scopeFiles: files.length, settledFromLedger: replayed };
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
    state.run.iteration += 1;
    const template = state.decisions.pre_pick?.result?.branchTemplate || 'tests/improve-{file}';
    const branch = template.replace('{file}', fileSlug(file));
    S.setStage('picking_file', `iteration ${state.run.iteration}: picked ${file}`);
    await repo.createBranch(branch);
    S.upsertFile(file, {
      status: 'picked', branch, attempts: state.files[file].attempts + 1,
      rounds: 0, roundBase: null, lastSurvived: null,
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
        S.upsertFile(file, { status: 'failed' });
        ledger()[file] = { state: 'failed', ts: Date.now() };
        S.save();
        return { ok: false, failed: true, score: 0, survived: [], totalMutants: 0, error: e.message.slice(0, 500) };
      }
      throw e;
    }
    const f = state.files[file] || S.upsertFile(file, {});
    const fileMac = mac(f.coverage, r.score);
    S.upsertFile(file, { mutation: r.score, mac: fileMac, lastSurvived: (r.survived || []).slice(0, 10) });
    if (body.phase === 'baseline') {
      S.upsertFile(file, {
        macBefore: fileMac, coverageBefore: f.coverage, mutationBefore: r.score,
      });
      if (state.run.baseline.mutationPct == null) state.run.baseline.mutationPct = r.score;
      state.run.baseline.mac = mac(state.run.baseline.coveragePct, state.run.baseline.mutationPct);
      S.save();
    }
    return { ok: true, ...r };
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
        temperature: body.temperature, json: !!body.json,
      });
      return { ok: true, text: r.text, json: r.json ?? null };
    } catch (e) { S.event('llm', 'LLM error: ' + e.message); return { ok: false, error: e.message }; }
  },

  'POST /api/test/cleanup': async (q, body) => {
    needRun();
    const file = body.file;
    const f = state.files[file] || {};
    S.setStage('preparing_pr', `cleaning up generated tests for ${file}`);
    const TESTISH = /((^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$)/;
    const changed = (await pr.changedFiles()).filter((p) => TESTISH.test(p));
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
    if (!touched.length) return { ok: true, cleaned: 0, results: publicResults };
    // verified cleanup: suite must stay green AND mutation score must not drop
    const suite = await tests.runTests(null);
    let newScore = null, scoreOk = false;
    if (suite.passed) {
      try {
        const st = await stryker.runStryker(file);
        newScore = st.score;
        scoreOk = newScore >= (f.mutationAfter ?? f.mutation ?? 0);
      } catch { scoreOk = false; }
    }
    if (!suite.passed || !scoreOk) {
      for (const t of touched) repo.writeTestFile(t.path, t._original);
      S.event('preparing_pr', `cleanup reverted: ${!suite.passed ? 'suite went red' : 'mutation score dropped to ' + newScore}`);
      return { ok: true, cleaned: 0, reverted: true, results: publicResults };
    }
    const cov = f.coverageAfter ?? f.coverage;
    S.upsertFile(file, { mutation: newScore, mutationAfter: newScore, mac: mac(cov, newScore), macAfter: mac(cov, newScore) });
    S.event('preparing_pr', 'cleanup kept: ' + touched.map((t) => `${t.path} ${t.bytesBefore}→${t.bytesAfter}B`).join(', '));
    return { ok: true, cleaned: touched.length, mutationAfter: newScore, results: publicResults };
  },

  'POST /api/verify': async (q, body) => {
    needRun();
    const file = body.file;
    if (!file || !state.files[file]) throw new Error('unknown file: ' + file);
    const f = state.files[file];
    S.setStage('improving_mac', `verifying MAC improvement for ${file}`);
    try {
      const suite = await tests.runTests(null);
      if (!suite.passed) {
        return { ok: true, improved: false, testsGreen: false, reason: 'full suite red', summary: suite.summary, file };
      }
      const cov = await coverage.runCoverage();
      S.setStage('improving_mac', `re-measuring mutation score for ${file}`);
      const st = await stryker.runStryker(file);
      const coverageAfter = state.files[file].coverage;
      const macAfter = mac(coverageAfter, st.score);
      S.upsertFile(file, {
        mutation: st.score, mac: macAfter, macAfter, coverageAfter, mutationAfter: st.score,
        lastSurvived: (st.survived || []).slice(0, 10),
      });
      state.run.result.coveragePct = cov.totalPct;
      state.run.result.mutationPct = st.score;
      state.run.result.mac = mac(cov.totalPct, st.score);
      S.save();
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
    S.upsertFile(file, {
      coverage: rb.coverage, mutation: rb.mutation, mac: rb.mac,
      coverageAfter: rb.coverage, mutationAfter: rb.mutation, macAfter: rb.mac,
    });
    const diff = await pr.diffAgainstBase();
    const changed = diff.match(/^\+\+\+ b\/(.+)$/gm)?.map((l) => l.slice(6)) || [];
    const improved = (f.rounds || 0) > 0 && (rb.mac ?? 0) > (f.macBefore ?? 0);
    return {
      ok: true, file, testsGreen: true,
      coverageBefore: f.coverageBefore, coverageAfter: rb.coverage,
      mutationBefore: f.mutationBefore, mutationAfter: rb.mutation,
      macBefore: f.macBefore, macAfter: rb.mac,
      improved, rounds: f.rounds || 0,
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
    S.upsertFile(file, { status: 'improved', prUrl: rec.url, prPatch: rec.patchPath });
    ledger()[file] = {
      state: 'improved', prUrl: rec.url, patchPath: rec.patchPath, branch: f.branch, ts: Date.now(),
      metrics: {
        coverageBefore: f.coverageBefore, coverageAfter: f.coverageAfter,
        mutationBefore: f.mutationBefore, mutationAfter: f.mutationAfter,
        macBefore: f.macBefore, macAfter: f.macAfter,
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
      if (f.status !== 'failed') {
        const maxAttempts = state.run.config.maxAttemptsPerFile || 3;
        S.upsertFile(file, { status: f.attempts >= maxAttempts ? 'no_improvement' : 'candidate' });
        if (f.attempts >= maxAttempts) { ledger()[file] = { state: 'exhausted', ts: Date.now() }; S.save(); }
      }
    }
    S.event('improving_mac', `discarded changes for ${file}: ${body.reason || 'no MAC improvement'}`);
    return { ok: true };
  },

  'POST /api/admin/reset': async () => {
    state.run = null; state.files = {}; state.decisions = {}; state.prs = []; state.events = []; state.seq = 0;
    S.setStage('idle', 'state reset');
    return { ok: true };
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
    // a hard error aborts the n8n execution → the run is dead; reflect that
    if (state.run && state.run.status === 'running' && req.method === 'POST') {
      state.run.status = 'failed';
      state.run.finishedAt = Math.floor(Date.now() / 1000);
      S.setStage('failed', e.message.slice(0, 200));
    }
    return json(res, 500, { ok: false, error: e.message });
  }
});

S.load();
server.listen(PORT, () => console.log(`sidecar listening on :${PORT}`));
