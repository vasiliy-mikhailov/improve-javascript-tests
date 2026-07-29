'use strict';
// state.js is the pipeline's memory: the stage the dashboard renders, the event
// log, the per-file records, the token ledgers, and the JSON file the next boot
// restores all of it from. The rest of the suite drives it from the outside —
// routes write state, tests assert on the route's response — so what state.js
// itself produces is almost never pinned down: the defaults it invents when the
// environment is empty, the overrides it accepts and the ones it must ignore,
// the redaction and clipping that keep secrets and megabyte prompts out of the
// dashboard, the two ring buffers, and the debounced atomic flush to disk.
//
// Every assertion below is on a value something else reads back: a route, the
// dashboard, dialog.jsonl, or load() on the next boot.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { withSandbox, S, DATA_DIR, util } = require('./helpers/env');   // FIRST, always

const { nowSec } = util;
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.jsonl');
const DIALOG_FILE = path.join(DATA_DIR, 'dialog.jsonl');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Wait out state.js's 150 ms save debounce, so the flush has landed. */
const flushed = () => sleep(400);

/** The JSONL records `fn` appends to `file`, parsed. */
function appended(file, fn) {
  const before = fs.existsSync(file) ? fs.statSync(file).size : 0;
  fn();
  const text = fs.readFileSync(file).subarray(before).toString('utf8');
  return text.split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

/** Run `fn` with these variables in the environment, then put the environment back. */
function withEnv(vars, fn) {
  const prev = {};
  for (const [k, v] of Object.entries(vars)) { prev[k] = process.env[k]; process.env[k] = v; }
  try { return fn(); } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  }
}

const NO_RULES = {
  post_clone: '', pre_pick: '', pick_file: '', write_test: '', check_changes: '', make_pr: '',
};

/** A timestamp state.js has just written is the current second, give or take. */
const isNow = (ts) => typeof ts === 'number' && Math.abs(ts - nowSec()) <= 3;

// ═══════════════════════════════════════════════════════════════════════════
//  where the state lives
// ═══════════════════════════════════════════════════════════════════════════

test('with no DATA_DIR in the environment the sidecar falls back to /data', () => {
  // /data is the container's mounted volume — the one place that survives a
  // restart. Every test in this repo sets DATA_DIR, so the fallback itself is
  // never exercised: if it degraded to a relative path the deployed sidecar
  // would write its whole memory into the container's ephemeral layer and lose
  // it on the next boot, and the suite would stay green.
  const STATE_PATH = require.resolve('../state');
  const cached = require.cache[STATE_PATH];
  const dataDir = process.env.DATA_DIR;
  delete require.cache[STATE_PATH];
  delete process.env.DATA_DIR;
  try {
    assert.equal(require('../state').DATA_DIR, '/data');
  } finally {
    process.env.DATA_DIR = dataDir;
    require.cache[STATE_PATH] = cached;   // hand the singleton the rest of the suite shares back
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  envConfig
// ═══════════════════════════════════════════════════════════════════════════

test('an empty environment produces the documented default configuration', () => {
  // These defaults are the whole contract of an unconfigured box: a `main`
  // branch, every JS/TS file in scope, no caps except five mutants and one
  // attempt per file, a real GitHub PR, and dry-run off. A default that decays
  // to undefined or NaN is not a crash — `scopeLimit: NaN` silently drops every
  // candidate file, and `dryRun: undefined` is falsy, so the box would keep
  // running and quietly do the wrong thing.
  assert.deepEqual(S.envConfig(), {
    repoUrl: '',
    repoBranch: 'main',
    scopeGlob: '**/*.{js,ts,jsx,tsx}',
    scopeLimit: 0,
    maxIterations: 0,
    maxMutantsPerFile: 5,
    maxAttemptsPerFile: 1,
    prMode: 'github',
    prBase: '',
    setupScript: '',
    dryRun: false,
    rules: NO_RULES,
  });
});

test('every configuration variable in the environment reaches the config', () => {
  // The container is configured entirely through env vars — docker-compose sets
  // them and nothing else validates them. A variable that stopped being read
  // would leave the box running the default instead: the wrong branch, the wrong
  // scope, a real PR when DRY_RUN was asked for.
  withEnv({
    REPO_URL: 'https://example.test/env.git',
    REPO_BRANCH: 'release',
    SCOPE_GLOB: 'lib/*.js',
    SCOPE_LIMIT: '12',
    MAX_ITERATIONS: '3',
    MAX_MUTANTS_PER_FILE: '9',
    MAX_ATTEMPTS_PER_FILE: '4',
    PR_MODE: 'local',
    PR_BASE: 'trunk',
    SETUP_SCRIPT: 'npm run build',
    DRY_RUN: 'true',
    RULES_POST_CLONE: 'r1', RULES_PRE_PICK: 'r2', RULES_PICK_FILE: 'r3',
    RULES_WRITE_TEST: 'r4', RULES_CHECK_CHANGES: 'r5', RULES_MAKE_PR: 'r6',
  }, () => {
    assert.deepEqual(S.envConfig(), {
      repoUrl: 'https://example.test/env.git',
      repoBranch: 'release',
      scopeGlob: 'lib/*.js',
      scopeLimit: 12,
      maxIterations: 3,
      maxMutantsPerFile: 9,
      maxAttemptsPerFile: 4,
      prMode: 'local',
      prBase: 'trunk',
      setupScript: 'npm run build',
      dryRun: true,
      rules: {
        post_clone: 'r1', pre_pick: 'r2', pick_file: 'r3',
        write_test: 'r4', check_changes: 'r5', make_pr: 'r6',
      },
    });
  });
});

test('DRY_RUN is on only for the exact string "true"', () => {
  // dryRun decides whether the box pushes a branch and opens a real PR. Anything
  // looser than an exact match — "false" read as truthy, or the comparison
  // inverted — either blocks every PR or opens one on a box that was told not to.
  for (const raw of ['false', 'TRUE', '1', 'yes', '']) {
    withEnv({ DRY_RUN: raw }, () => assert.equal(S.envConfig().dryRun, false, `DRY_RUN=${raw}`));
  }
  withEnv({ DRY_RUN: 'true' }, () => assert.equal(S.envConfig().dryRun, true));
});

// ═══════════════════════════════════════════════════════════════════════════
//  freshRun
// ═══════════════════════════════════════════════════════════════════════════

test('a fresh run starts unmeasured, unfinished and identifiable', () => {
  // The id is the only thing distinguishing two runs of the same repo in the
  // events and in the PR body, and the dashboard renders baseline vs result as
  // "before → after": both halves have to exist and both have to start empty, or
  // the first measurement is indistinguishable from an improvement.
  const r = S.freshRun();

  assert.match(r.id, /^run-\d{13,}$/);
  assert.equal(r.status, 'running');
  assert.equal(r.finishedAt, null);
  assert.equal(r.iteration, 0);
  assert.ok(isNow(r.startedAt), `implausible startedAt: ${r.startedAt}`);
  assert.deepEqual(r.baseline, { coveragePct: null, mutationPct: null, mac: null });
  assert.deepEqual(r.result, { coveragePct: null, mutationPct: null, mac: null });
});

test('every field of the start request overrides the environment', () => {
  // This is the body of POST /api/run/start. A field that stopped being copied
  // would leave the run on the box's env default and the operator would only
  // find out from the PR: work pushed to the wrong branch, or a scope limit that
  // was never applied.
  const body = {
    repoUrl: 'https://example.test/body.git',
    repoBranch: 'dev',
    scopeGlob: 'src/*.js',
    scopeLimit: 7,
    maxIterations: 3,
    maxMutantsPerFile: 9,
    maxAttemptsPerFile: 4,
    prMode: 'local',
    prBase: 'release',
    dryRun: true,
    setupScript: 'npm run build',
  };

  assert.deepEqual(S.freshRun(body).config, { ...body, rules: NO_RULES });
});

test('an absent, null or empty field keeps the environment default', () => {
  // n8n sends every field of the start form, so the ones the operator left blank
  // arrive as '' or null. Treating those as real values would overwrite a branch
  // configured on the box with null and clone nothing.
  withEnv({ REPO_BRANCH: 'trunk', PR_MODE: 'local', SCOPE_GLOB: 'lib/*.js' }, () => {
    const cfg = S.freshRun({ repoBranch: null, prMode: '', scopeGlob: undefined }).config;

    assert.equal(cfg.repoBranch, 'trunk');
    assert.equal(cfg.prMode, 'local');
    assert.equal(cfg.scopeGlob, 'lib/*.js');
  });
});

test('a start body that is not an object at all is ignored, not crashed on', () => {
  // `POST /api/run/start` with an empty body hands freshRun whatever the JSON
  // parser produced — null for a zero-length body. A run that throws here never
  // reaches the state machine, so the box wedges in whatever stage it was in.
  for (const junk of [null, undefined, 'main', 42]) {
    assert.equal(S.freshRun(junk).config.repoBranch, 'main', `overrides: ${junk}`);
  }
  // same for the nested rules object, which the workflow omits or nulls out
  assert.deepEqual(S.freshRun({ rules: null }).config.rules, NO_RULES);
});

test('the numeric caps survive junk and coerce strings to numbers', () => {
  // These arrive as form strings from n8n and as numbers from the API. Once
  // parsed they are compared with `>=` all over the loop: NaN makes every one of
  // those comparisons false, so a NaN cap silently means "no limit at all".
  const junk = S.freshRun({
    scopeLimit: 'abc', maxIterations: 'abc', maxMutantsPerFile: 'abc', maxAttemptsPerFile: 'abc',
  }).config;
  assert.deepEqual(
    [junk.scopeLimit, junk.maxIterations, junk.maxMutantsPerFile, junk.maxAttemptsPerFile],
    [0, 0, 5, 1]);

  const strings = S.freshRun({
    scopeLimit: '7', maxIterations: '2', maxMutantsPerFile: '3', maxAttemptsPerFile: '6',
  }).config;
  assert.deepEqual(
    [strings.scopeLimit, strings.maxIterations, strings.maxMutantsPerFile, strings.maxAttemptsPerFile],
    [7, 2, 3, 6]);
});

test('a negative iteration cap clamps to unlimited instead of ending the run at once', () => {
  // maxIterations is compared as `iteration >= cap` to decide the run is done. A
  // negative cap that survived would satisfy that on iteration 0 and finish the
  // run before it picked a single file; clamping to 0 means "unlimited".
  assert.equal(S.freshRun({ maxIterations: -4 }).config.maxIterations, 0);
});

test('prBase defaults to the branch that was cloned, and an explicit base wins', () => {
  // The PR is opened against prBase. Defaulting it to the wrong end — or
  // overwriting an explicit base with the clone branch — targets a branch the
  // change was never diffed against.
  assert.equal(S.freshRun({ repoBranch: 'dev' }).config.prBase, 'dev');
  assert.equal(S.freshRun({ repoBranch: 'dev', prBase: 'release' }).config.prBase, 'release');
});

test('rules given in the start body replace only the stages they name', () => {
  // Rules are free-text instructions spliced into the model prompt for one stage.
  // Copying them into the wrong stages, or blanking the ones the operator did not
  // send, changes what the model is told at every other step of the loop.
  const cfg = S.freshRun({ rules: { pick_file: 'prefer the biggest file', make_pr: 'draft only' } }).config;

  assert.deepEqual(cfg.rules, { ...NO_RULES, pick_file: 'prefer the biggest file', make_pr: 'draft only' });
});

// ═══════════════════════════════════════════════════════════════════════════
//  the state singleton
// ═══════════════════════════════════════════════════════════════════════════

test('a box that has never run reports an idle stage and empty everything', () => withSandbox(async () => {
  // This is what GET /api/state answers before the first run, and what the
  // dashboard renders on a cold box. A phantom entry in events, prs or dialog
  // would be shown as real history of a run that never happened.
  assert.deepEqual(S.state.stage, { name: 'idle', detail: '', since: S.state.stage.since, progress: null });
  assert.ok(isNow(S.state.stage.since));
  assert.deepEqual(S.state.events, []);
  assert.deepEqual(S.state.dialog, []);
  assert.deepEqual(S.state.prs, []);
  assert.deepEqual(S.state.files, {});
  assert.equal(S.state.run, null);
  assert.equal(S.state.runner, null);
  assert.equal(S.state.seq, 0);
  assert.equal(S.state.dialogSeq, 0);
}));

// ═══════════════════════════════════════════════════════════════════════════
//  event
// ═══════════════════════════════════════════════════════════════════════════

test('each event is numbered in order and appended to events.jsonl as one line', () => withSandbox(async () => {
  // events.jsonl is the only record that outlives the 400-entry in-memory buffer
  // — it is what a post-mortem of a finished run reads. Two events on one line,
  // or an append that silently stopped happening, leaves that file unparseable
  // or empty while the dashboard still looks healthy.
  const lines = appended(EVENTS_FILE, () => {
    S.event('cloning', 'first');
    S.event('installing', 'second');
  });

  assert.deepEqual(lines.map((e) => [e.seq, e.stage, e.msg]), [[1, 'cloning', 'first'], [2, 'installing', 'second']]);
  assert.ok(isNow(lines[0].ts), `implausible event ts: ${lines[0].ts}`);
  assert.deepEqual(S.state.events, lines);
}));

test('an event message is redacted and cut to 500 characters', () => withSandbox(async () => {
  // Event messages are built from git and gh output, which echoes the token we
  // passed in, and from test-runner output, which can be a megabyte. The state
  // file holds 400 of them and every one is served to the dashboard: an
  // untrimmed message is a state.json that grows without bound, and an
  // unredacted one publishes the box's GitHub token.
  const msg = 'ghp_' + 'A'.repeat(36) + ' ' + 'x'.repeat(600);
  S.event('cloning', msg);

  const e = S.state.events.at(-1);
  assert.equal(e.msg.length, 500);
  assert.ok(e.msg.startsWith('«redacted-gh-token» xxx'), `not redacted: ${e.msg.slice(0, 40)}`);
  assert.ok(!e.msg.includes('ghp_'));
}));

test('an event prints one console line naming its stage', () => withSandbox(async (sb) => {
  // docker logs is the only view into a box whose dashboard is not reachable. A
  // line without its stage cannot be tied to a phase of the loop.
  S.event('cloning', 'cloning example/repo');

  assert.ok(sb.logs.includes('[cloning] cloning example/repo'), `console lines: ${sb.logs.slice(-3)}`);
}));

test('the in-memory event buffer keeps the newest 400 and drops the oldest', () => withSandbox(async () => {
  // The buffer is capped because the whole state object is JSON-stringified into
  // state.json on every change and served whole to the dashboard. Trimming the
  // wrong end throws away the events of the stage that is running now; trimming
  // too much empties the log the moment a run gets busy.
  for (let i = 1; i <= 401; i++) S.event('mutating', 'e' + i);

  assert.equal(S.state.events.length, 400);
  assert.equal(S.state.events[0].msg, 'e2');
  assert.equal(S.state.events.at(-1).msg, 'e401');
}));

// ═══════════════════════════════════════════════════════════════════════════
//  setStage / setProgress
// ═══════════════════════════════════════════════════════════════════════════

test('a stage change records the stage, redacts the detail and logs it once', () => withSandbox(async (sb) => {
  // The detail is routinely a clone URL with credentials in it, and it is shown
  // on the dashboard and written to the event log. `since` is what the dashboard
  // turns into "stuck for 12 minutes", and progress must be cleared or the new
  // stage inherits the previous stage's last output line.
  S.setProgress('leftover from the previous stage', 4);
  S.setStage('cloning', 'https://user:secret@example.test/r.git');

  assert.deepEqual(S.state.stage, {
    name: 'cloning',
    detail: 'https://«redacted»@example.test/r.git',
    since: S.state.stage.since,
    progress: null,
  });
  assert.ok(isNow(S.state.stage.since));
  assert.deepEqual(sb.events(), ['https://«redacted»@example.test/r.git']);
}));

test('re-entering the same stage with the same detail does not log again', () => withSandbox(async (sb) => {
  // The loop calls setStage on every pass — once per file, thousands of times per
  // run. Logging every call floods the 400-entry buffer with duplicates and
  // resets `since`, so a wedged stage looks like it just started. A change of
  // detail alone (the file being worked on) is real progress and must still log.
  S.setStage('improving_mutation', 'src/a.ts');
  S.setStage('improving_mutation', 'src/a.ts');
  S.setStage('improving_mutation', 'src/b.ts');   // same stage, new file
  S.setStage('writing_test', 'src/b.ts');         // new stage, same file

  assert.deepEqual(sb.events(), ['src/a.ts', 'src/b.ts', 'src/b.ts']);
}));

test('a stage with no detail logs its own name', () => withSandbox(async (sb) => {
  // Half the stages have nothing to say beyond their name. An empty message
  // leaves a blank line in the event log and a blank field on the dashboard,
  // and the operator cannot tell the box moved on at all.
  S.setStage('picking_file');

  assert.equal(S.state.stage.detail, '');
  assert.deepEqual(sb.events(), ['picking_file']);
}));

test('a progress line is redacted and cut to 200 characters', () => withSandbox(async () => {
  // setProgress is fed raw child-process output every three seconds, so it sees
  // whatever npm/gh/stryker printed — including the API key we passed in — and
  // it is written into state.json on every heartbeat. It renders in a one-line
  // field, so the cap is what keeps the dashboard readable and the state file
  // small.
  S.setProgress('sk-' + 'B'.repeat(40) + ' ' + 'y'.repeat(300), 12);

  const p = S.state.stage.progress;
  assert.equal(p.line.length, 200);
  assert.ok(p.line.startsWith('«redacted-api-key» yyy'), `not redacted: ${p.line.slice(0, 40)}`);
  assert.equal(p.elapsed, 12);
  assert.ok(isNow(p.ts), `implausible progress ts: ${p.ts}`);
}));

// ═══════════════════════════════════════════════════════════════════════════
//  upsertFile
// ═══════════════════════════════════════════════════════════════════════════

test('a file first seen is a candidate with nothing measured yet', () => withSandbox(async () => {
  // Every route that picks work reads these fields: `status: 'candidate'` is what
  // makes a file eligible, `attempts: 0` is what the per-file attempt cap counts,
  // and a missing null placeholder reads as "not measured" in some places and
  // "measured as nothing" in others.
  const f = S.upsertFile('src/a.ts', {});

  const { updatedAt, ...rest } = f;
  assert.deepEqual(rest, {
    path: 'src/a.ts', coverage: null, mutation: null, mac: null,
    macBefore: null, macAfter: null, status: 'candidate',
    attempts: 0, branch: null, prUrl: null, prPatch: null,
  });
  assert.ok(isNow(updatedAt), `implausible updatedAt: ${updatedAt}`);
  assert.equal(S.state.files['src/a.ts'], f);
}));

test('a later patch merges into the record instead of replacing it', () => withSandbox(async () => {
  // The loop upserts the same file a dozen times — coverage, then mutation, then
  // the branch, then the PR url. Rebuilding the record from scratch each time
  // would reset `attempts` to 0 and the file would be retried forever.
  S.upsertFile('src/a.ts', { attempts: 2, coverage: 40, branch: 'ijt/a' });
  const f = S.upsertFile('src/a.ts', { coverage: 90 });

  assert.equal(f.attempts, 2);
  assert.equal(f.branch, 'ijt/a');
  assert.equal(f.coverage, 90);
  assert.equal(Object.keys(S.state.files).length, 1);
}));

test('a patch cannot backdate the record it is applied to', () => withSandbox(async () => {
  // updatedAt is the dashboard's "last touched" and the tie-breaker when a run
  // resumes. Patches are built from stored records — the ledger entries carry
  // their own `ts`-like fields — so a patch that carried an old updatedAt through
  // would leave a file that is being worked on right now looking hours stale.
  const f = S.upsertFile('src/a.ts', { updatedAt: 1 });

  assert.ok(isNow(f.updatedAt), `patch backdated the record: ${f.updatedAt}`);
}));

// ═══════════════════════════════════════════════════════════════════════════
//  recordTokens
// ═══════════════════════════════════════════════════════════════════════════

test('token usage is charged to the repo, the run and the file being worked on', () => withSandbox(async (sb) => {
  // Three separate readers: the per-repo ledger outlives the run and is what the
  // FTE-ratio report divides by, run.tokens is the run summary, and the file's
  // own count is quoted in its PR body. The file charged has to be the picked
  // one — every other file in state is a candidate that no model call was made
  // for.
  S.state.run = S.freshRun({ repoUrl: sb.repoUrl });
  S.upsertFile('src/a.ts', { status: 'candidate' });
  S.upsertFile('src/b.ts', { status: 'picked' });

  S.recordTokens({ prompt_tokens: 100, completion_tokens: 20 });
  S.recordTokens({ prompt_tokens: 50, completion_tokens: 5 });

  const total = { in: 150, out: 25, calls: 2 };
  assert.deepEqual(S.state.tokenLedger[sb.repoSlug], total);
  assert.deepEqual(S.state.run.tokens, total);
  assert.deepEqual(sb.file('src/b.ts').tokens, total);
  assert.equal(sb.file('src/a.ts').tokens, undefined);
}));

test('a model call made outside a run is still counted and does not throw', () => withSandbox(async () => {
  // The pick and the post-clone rules run before a file is picked, and the
  // dashboard's own model calls happen with no run at all. recordTokens is the
  // last thing llm.chat does, so a crash here loses the response that was just
  // paid for.
  S.recordTokens({ prompt_tokens: 10, completion_tokens: 1 });
  assert.deepEqual(S.state.tokenLedger[''], { in: 10, out: 1, calls: 1 });

  S.state.run = {};                       // a run object that has not been configured yet
  S.recordTokens({ prompt_tokens: 5, completion_tokens: 0 });

  assert.deepEqual(S.state.tokenLedger[''], { in: 15, out: 1, calls: 2 });
  assert.deepEqual(S.state.run.tokens, { in: 5, out: 0, calls: 1 });
}));

// ═══════════════════════════════════════════════════════════════════════════
//  recordDialog
// ═══════════════════════════════════════════════════════════════════════════

test('a dialog entry carries its sequence, the current stage and the picked file', () => withSandbox(async (sb) => {
  // The dashboard streams this buffer as a transcript: it is how an operator sees
  // what the model was asked while a ten-minute stage runs. Without the stage and
  // the file, two exchanges from different files are indistinguishable, and the
  // sequence number is what the UI polls with to fetch only what is new.
  S.setStage('writing_test', 'src/b.ts');
  S.upsertFile('src/a.ts', { status: 'candidate' });
  S.upsertFile('src/b.ts', { status: 'picked' });

  S.recordDialog({ system: 'you are a test writer', prompt: 'write a test', response: 'ok' });
  S.recordDialog({ prompt: 'again' });

  const [first, second] = S.state.dialog;
  assert.equal(first.seq, 1);
  assert.equal(second.seq, 2);
  assert.equal(first.stage, 'writing_test');
  assert.equal(first.detail, 'src/b.ts');
  assert.equal(first.file, 'src/b.ts');
  assert.equal(first.system, 'you are a test writer');
  assert.equal(first.prompt, 'write a test');
  assert.equal(first.response, 'ok');
  assert.ok(isNow(first.ts), `implausible dialog ts: ${first.ts}`);
  assert.equal(sb.state.dialogSeq, 2);

  // the fields an exchange leaves out are blank, not filler: a call recorded
  // with no system prompt, or before its response came back, is rendered
  // verbatim by the dashboard's transcript view
  assert.equal(second.system, '');
  assert.equal(second.response, '');
}));

test('a dialog entry recorded with no stage at all falls back to idle', () => withSandbox(async () => {
  // load() copies a state.json in wholesale, so a file written by an older build
  // — one that had no `stage` key, or a null one — leaves state.stage empty while
  // the model calls carry on. Reaching into it unguarded would throw inside
  // llm.chat and lose the response.
  S.state.stage = null;

  S.recordDialog({ prompt: 'p' });

  assert.equal(S.state.dialog[0].stage, 'idle');
  assert.equal(S.state.dialog[0].detail, '');
  assert.equal(S.state.dialog[0].file, null);
}));

test('an oversized exchange is clipped in memory and kept whole in dialog.jsonl', () => withSandbox(async () => {
  // A write-test prompt carries the file, its tests and the survivor list — tens
  // of thousands of characters — and 40 of them are held in the state object that
  // is stringified to disk on every change and served whole to the dashboard.
  // The clip is what keeps that bounded; dialog.jsonl is where the full text
  // stays, and it is the only place a prompt can be read back for debugging.
  const system = 's'.repeat(1501);
  const prompt = 'p'.repeat(4001);
  const response = 'r'.repeat(4001);

  const lines = appended(DIALOG_FILE, () => {
    S.recordDialog({ system, prompt, response });
    S.recordDialog({ prompt: 'short' });
  });

  assert.deepEqual(lines.map((l) => l.seq), [1, 2], 'one JSON line per exchange');
  assert.equal(lines[0].prompt, prompt, 'the file keeps the untruncated prompt');
  assert.equal(lines[0].system, system);

  const d = S.state.dialog[0];
  assert.equal(d.system, 's'.repeat(1500) + '\n… [1 more chars]');
  assert.equal(d.prompt, 'p'.repeat(4000) + '\n… [1 more chars]');
  assert.equal(d.response, 'r'.repeat(4000) + '\n… [1 more chars]');
}));

test('an exchange exactly at the clip limit is left alone', () => withSandbox(async () => {
  // The cap is `length > n`. One character stricter and every prompt that lands
  // on the limit grows a "… [0 more chars]" tail that is not in the real prompt —
  // which is exactly the text an operator compares against the model's answer
  // when debugging a bad response.
  const prompt = 'p'.repeat(4000);
  const system = 's'.repeat(1500);
  S.recordDialog({ system, prompt });

  assert.equal(S.state.dialog[0].prompt, prompt);
  assert.equal(S.state.dialog[0].system, system);
}));

test('a secret quoted back by the model never reaches the dialog buffer', () => withSandbox(async () => {
  // Prompts contain repo contents and tool output; a response can quote a token
  // straight back. The dialog buffer is served unauthenticated to the dashboard.
  S.recordDialog({ prompt: 'clone https://user:secret@example.test/r.git', response: 'ghp_' + 'C'.repeat(36) });

  const d = S.state.dialog[0];
  assert.equal(d.prompt, 'clone https://«redacted»@example.test/r.git');
  assert.equal(d.response, '«redacted-gh-token»');
}));

test('the in-memory dialog buffer keeps the newest 40 exchanges', () => withSandbox(async () => {
  // Same bound as the event log, for the same reason: every entry is up to 9.5 kB
  // of clipped text and the whole buffer is re-serialised into state.json on
  // every model call. Trimming from the wrong end would leave the dashboard
  // showing the start of the run forever.
  for (let i = 1; i <= 41; i++) S.recordDialog({ prompt: 'p' + i });

  assert.equal(S.state.dialog.length, 40);
  assert.equal(S.state.dialog[0].prompt, 'p2');
  assert.equal(S.state.dialog.at(-1).prompt, 'p41');
}));

// ═══════════════════════════════════════════════════════════════════════════
//  save / load
// ═══════════════════════════════════════════════════════════════════════════

test('a change is flushed to DATA_DIR/state.json as parseable JSON', () => withSandbox(async () => {
  // This file is the box's entire memory across a restart, and the flush is
  // debounced and wrapped in a try/catch — a flush that silently stopped
  // happening (a directory that is no longer created, a temp path that is no
  // longer a valid path) leaves the sidecar looking perfectly healthy and loses
  // everything on the next boot.
  await flushed();
  fs.rmSync(STATE_FILE, { force: true });

  S.state.seq = 7;
  S.upsertFile('src/a.ts', { coverage: 80 });
  await flushed();

  const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  assert.equal(raw.seq, 7);
  assert.equal(raw.files['src/a.ts'].coverage, 80);
}));

test('a flush that fails is reported on stderr rather than thrown', () => withSandbox(async () => {
  // save() runs on a timer, so anything it throws is an unhandled rejection that
  // takes the sidecar down mid-run. A full disk or a read-only volume has to end
  // as one log line saying which stage of saving failed — the operator gets
  // nothing else to go on, since the dashboard keeps serving in-memory state.
  await flushed();                              // drain any flush already pending
  const errs = [];
  const realError = console.error;
  console.error = (...args) => { errs.push(args.join(' ')); };
  try {
    fs.mkdirSync(STATE_FILE + '.tmp');          // the temp file save() writes is now a directory
    S.state.seq = 3;
    S.save();
    await flushed();
  } finally {
    console.error = realError;
    fs.rmSync(STATE_FILE + '.tmp', { recursive: true, force: true });
  }

  assert.equal(errs.length, 1);
  assert.match(errs[0], /^state save failed: \S/);
}));

test('load restores the saved state and flags a run that was cut off mid-flight', () => withSandbox(async () => {
  // The container restarts on any crash and comes straight back into the same
  // n8n loop. A run left at status 'running' has no process behind it any more,
  // so the stage has to say so: the workflow keys "take over a stale run" off
  // exactly this, and without it the box waits for a run that will never move.
  fs.writeFileSync(STATE_FILE, JSON.stringify({
    seq: 12,
    run: { id: 'run-1', status: 'running', config: { repoUrl: 'https://example.test/r.git' } },
    files: { 'src/a.ts': { path: 'src/a.ts', status: 'picked' } },
    stage: { name: 'improving_mutation', detail: 'src/a.ts', since: 1, progress: { line: 'x' } },
  }));

  S.load();

  assert.equal(S.state.seq, 12);
  assert.equal(S.state.files['src/a.ts'].status, 'picked');
  assert.equal(S.state.run.id, 'run-1');
  assert.deepEqual(S.state.stage, {
    name: 'interrupted', detail: 'sidecar restarted', since: S.state.stage.since, progress: null,
  });
  assert.ok(isNow(S.state.stage.since));
}));

test('load leaves a run that had already finished exactly as it was', () => withSandbox(async () => {
  // Most restarts happen between runs. Marking a finished run as interrupted
  // would make the dashboard claim the last completed run had crashed, and would
  // offer a takeover of a run with nothing left to do.
  fs.writeFileSync(STATE_FILE, JSON.stringify({
    run: { id: 'run-1', status: 'done' },
    stage: { name: 'idle', detail: 'run finished', since: 1, progress: null },
  }));

  S.load();

  assert.equal(S.state.run.status, 'done');
  assert.deepEqual(S.state.stage, { name: 'idle', detail: 'run finished', since: 1, progress: null });
}));

test('a first boot with no state file keeps the in-memory defaults', () => withSandbox(async () => {
  // load() is called unconditionally at startup. On a fresh volume there is no
  // file; if that path stopped being tolerated the sidecar would die before it
  // ever served a route, and the operator would see a container restart loop.
  await flushed();
  fs.rmSync(STATE_FILE, { force: true });
  S.state.seq = 5;

  S.load();

  assert.equal(S.state.seq, 5);
  assert.equal(S.state.stage.name, 'idle');
}));
