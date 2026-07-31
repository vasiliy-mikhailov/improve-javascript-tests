'use strict';
// JSON-file-backed state store. Single-process, in-memory with debounced flush.
const fs = require('node:fs');
const path = require('node:path');
const { nowSec, redact, slugify } = require('./util');
const { addUsage } = require('./tokens');

const DATA_DIR = process.env.DATA_DIR || '/data';
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.jsonl');
const MAX_EVENTS_IN_STATE = 400;

function envConfig() {
  const e = process.env;
  return {
    repoUrl: e.REPO_URL || '',
    repoBranch: e.REPO_BRANCH || 'main',
    scopeGlob: e.SCOPE_GLOB || '**/*.{js,ts,jsx,tsx}',
    scopeLimit: parseInt(e.SCOPE_LIMIT || '0', 10),
    maxIterations: parseInt(e.MAX_ITERATIONS || '0', 10), // 0 = unlimited
    maxMutantsPerFile: parseInt(e.MAX_MUTANTS_PER_FILE || '5', 10),
    maxAttemptsPerFile: parseInt(e.MAX_ATTEMPTS_PER_FILE || '1', 10),
    prMode: e.PR_MODE || 'github', // github | local
    prBase: e.PR_BASE || '',       // defaults to repoBranch
    setupScript: e.SETUP_SCRIPT || '', // npm script to run after install (e.g. a build)
    dryRun: String(e.DRY_RUN || 'false') === 'true',
    rules: {
      // DEFAULT_, because these are only the fallback. Team rules ARE prompts, so they
      // belong in the repo they describe (improve-tests.json, `rules`), not with
      // whoever happens to run the container — see feedback.rulesFor(). The legacy
      // RULES_ names are still read so a deployed .env keeps working through the rename.
      post_clone: e.DEFAULT_RULES_POST_CLONE || e.RULES_POST_CLONE || '',
      pre_pick: e.DEFAULT_RULES_PRE_PICK || e.RULES_PRE_PICK || '',
      pick_file: e.DEFAULT_RULES_PICK_FILE || e.RULES_PICK_FILE || '',
      write_test: e.DEFAULT_RULES_WRITE_TEST || e.RULES_WRITE_TEST || '',
      check_changes: e.DEFAULT_RULES_CHECK_CHANGES || e.RULES_CHECK_CHANGES || '',
      make_pr: e.DEFAULT_RULES_MAKE_PR || e.RULES_MAKE_PR || '',
    },
  };
}

function freshRun(overrides = {}) {
  const cfg = envConfig();
  const o = overrides && typeof overrides === 'object' ? overrides : {};
  for (const k of ['repoUrl', 'repoBranch', 'scopeGlob', 'scopeLimit', 'maxIterations',
    'maxMutantsPerFile', 'maxAttemptsPerFile', 'prMode', 'prBase', 'dryRun', 'setupScript']) {
    if (o[k] !== undefined && o[k] !== null && o[k] !== '') cfg[k] = o[k];
  }
  if (o.rules && typeof o.rules === 'object') {
    for (const k of Object.keys(cfg.rules)) if (o.rules[k] !== undefined) cfg.rules[k] = o.rules[k];
  }
  cfg.scopeLimit = parseInt(cfg.scopeLimit, 10) || 0;
  cfg.maxIterations = Math.max(0, parseInt(cfg.maxIterations, 10) || 0); // 0 = unlimited
  cfg.maxMutantsPerFile = parseInt(cfg.maxMutantsPerFile, 10) || 5;
  cfg.maxAttemptsPerFile = parseInt(cfg.maxAttemptsPerFile, 10) || 1;
  if (!cfg.prBase) cfg.prBase = cfg.repoBranch;
  return {
    id: 'run-' + Date.now(),
    startedAt: nowSec(),
    finishedAt: null,
    status: 'running',
    config: cfg,
    iteration: 0,
    baseline: { coveragePct: null, mutationPct: null, mac: null },
    result: { coveragePct: null, mutationPct: null, mac: null },
  };
}

const state = {
  run: null,
  stage: { name: 'idle', detail: '', since: nowSec(), progress: null },
  runner: null,      // { pm, testRunner, hasStrykerConfig }
  files: {},         // path -> file record
  decisions: {},     // ruleStage -> last application result
  prs: [],
  events: [],
  seq: 0,
  // per-repo ledger of final file dispositions, SURVIVES run/start — enables
  // batched full-repo runs and crash-restart without redoing finished files.
  // { [repoSlug]: { [path]: {state: 'improved'|'exhausted'|'failed', prUrl?, ts} } }
  improvedLedger: {},
  // per-repo cumulative clone/install/baseline seconds, so the FTE ratio counts
  // run overhead and not just per-file work
  overheadLedger: {},
  // per-repo measurements for EVERY file we ever measured, improved or not:
  // baseline coverage/mutation/MAC plus what the best attempt reached. Kept
  // separate from improvedLedger because these entries say nothing about
  // whether a file is settled — they exist so the numbers survive batches.
  // { [repoSlug]: { [path]: {coverageBefore, mutationBefore, macBefore,
  //                          attemptCoverage, attemptMutation, attemptMac, ts} } }
  measureLedger: {},
  // per-repo cumulative LLM spend { in, out, calls }, survives run/start
  tokenLedger: {},
  // rolling transcript of model exchanges, newest last (full text goes to
  // /data/dialog.jsonl; this buffer is what the dashboard streams)
  dialog: [],
  dialogSeq: 0,
};

const MAX_DIALOG_IN_STATE = 40;
const DIALOG_FILE = path.join(DATA_DIR, 'dialog.jsonl');

/** Record one model exchange so it can be watched live. */
function recordDialog(entry) {
  state.dialogSeq += 1;
  const picked = Object.values(state.files).find((f) => f.status === 'picked');
  const full = {
    seq: state.dialogSeq,
    ts: nowSec(),
    stage: state.stage?.name || 'idle',
    detail: state.stage?.detail || '',
    file: picked?.path || null,
    ...entry,
  };
  try { fs.appendFileSync(DIALOG_FILE, JSON.stringify(full) + '\n'); } catch { }
  // the in-memory copy is trimmed: prompts run to tens of thousands of characters
  const clip = (s, n) => { const t = redact(s || ''); return t.length > n ? t.slice(0, n) + `\n… [${t.length - n} more chars]` : t; };
  state.dialog.push({
    ...full,
    system: clip(full.system, 1500),
    prompt: clip(full.prompt, 4000),
    response: clip(full.response, 4000),
  });
  if (state.dialog.length > MAX_DIALOG_IN_STATE) {
    state.dialog.splice(0, state.dialog.length - MAX_DIALOG_IN_STATE);
  }
  save();
}

/**
 * Count one model response. Attributed three ways: to the file currently being
 * worked on (so a PR can say what it cost), to the run, and to a per-repo
 * accumulator that outlives batches.
 */
function recordTokens(usage) {
  const slug = slugify(state.run?.config?.repoUrl || '');
  state.tokenLedger[slug] = addUsage(state.tokenLedger[slug], usage);
  if (state.run) state.run.tokens = addUsage(state.run.tokens, usage);
  const picked = Object.values(state.files).find((f) => f.status === 'picked');
  if (picked) picked.tokens = addUsage(picked.tokens, usage);
  save();
}

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    Object.assign(state, raw);
    if (state.run && state.run.status === 'running') {
      // process restarted mid-run
      state.stage = { name: 'interrupted', detail: 'sidecar restarted', since: nowSec(), progress: null };
    }
  } catch { /* first boot */ }
}

let flushTimer = null;
function save() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const tmp = STATE_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(state));
      fs.renameSync(tmp, STATE_FILE);
    } catch (e) { console.error('state save failed:', e.message); }
  }, 150);
}

function event(stage, msg) {
  state.seq += 1;
  const entry = { seq: state.seq, ts: nowSec(), stage, msg: redact(msg).slice(0, 500) };
  state.events.push(entry);
  if (state.events.length > MAX_EVENTS_IN_STATE) state.events.splice(0, state.events.length - MAX_EVENTS_IN_STATE);
  try { fs.appendFileSync(EVENTS_FILE, JSON.stringify(entry) + '\n'); } catch { }
  save();
  console.log(`[${stage}] ${msg}`);
}

function setStage(name, rawDetail = '') {
  const detail = redact(rawDetail);
  if (state.stage.name !== name || state.stage.detail !== detail) {
    state.stage = { name, detail, since: nowSec(), progress: null };
    event(name, detail || name);
  }
  save();
}

function setProgress(line, elapsed) {
  // child-process output: may echo credentials we passed in
  state.stage.progress = { line: redact(line).slice(0, 200), elapsed, ts: nowSec() };
  save();
}

function upsertFile(p, patch) {
  const f = state.files[p] || {
    path: p, coverage: null, mutation: null, mac: null,
    macBefore: null, macAfter: null, status: 'candidate',
    attempts: 0, branch: null, prUrl: null, prPatch: null, updatedAt: nowSec(),
  };
  Object.assign(f, patch, { updatedAt: nowSec() });
  state.files[p] = f;
  save();
  return f;
}

module.exports = {
  state, load, save, event, setStage, setProgress, upsertFile, recordTokens, recordDialog,
  freshRun, envConfig, DATA_DIR,
};
