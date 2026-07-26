'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  READ THIS BEFORE YOU require() ANYTHING ELSE
//
//  sidecar/state.js captures the data directory ONCE, at require time:
//
//      const DATA_DIR = process.env.DATA_DIR || '/data';
//
//  and every other module (pr.js, and repoDir() in repo.js, which is the root of
//  every path the pipeline touches) reads that captured constant. Setting
//  process.env.DATA_DIR AFTER state.js is loaded therefore does nothing at all:
//  the tests would quietly operate on /data — the production directory.
//
//  So this file MUST be the first sidecar-related require in every test file:
//
//      const { sandbox } = require('./helpers/env');   // FIRST, always
//
//  and every sidecar module must be reached through `sidecar` (below) rather
//  than required directly. Requiring e.g. '../../server' before this helper is
//  a hard error — the guard at the top of this file throws rather than letting
//  a test silently run against the wrong directory.
//
//  A second load-order rule, for the same reason: several modules destructure
//  their dependencies at require time —
//
//      rules.js:   const { chat } = require('./llm');
//      stryker.js: const { run }  = require('./exec');   (also coverage/tests/pr/repo)
//
//  so replacing `llm.chat` later cannot reach rules.js, and replacing `exec.run`
//  later cannot reach any of them. This file installs a permanent *dispatcher*
//  on both properties BEFORE those modules are loaded; the dispatcher forwards
//  to a swappable implementation, which is what installFakes() actually swaps.
// ═══════════════════════════════════════════════════════════════════════════

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SIDECAR_DIR = path.resolve(__dirname, '..', '..');

// ── load-order guard ───────────────────────────────────────────────────────
for (const mod of ['state', 'exec', 'llm', 'repo', 'stryker', 'coverage', 'tests', 'pr', 'rules', 'server']) {
  if (require.cache[path.join(SIDECAR_DIR, mod + '.js')]) {
    throw new Error(
      `sidecar/${mod}.js was required BEFORE test/helpers/env.js. state.js captures DATA_DIR at `
      + 'require time, so the test would run against the production /data directory. '
      + "Require './helpers/env' first and take the sidecar modules from its `sidecar` export.");
  }
}

// ── temp DATA_DIR, before any sidecar module is loaded ─────────────────────
// realpath: macOS resolves os.tmpdir() through /var → /private/var, and a test
// that compares a path it built against one the sidecar built should not fail
// over that.
const DATA_DIR = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'ijst-sandbox-'));
process.env.DATA_DIR = DATA_DIR;
process.on('exit', () => { try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch { } });

// The sidecar reads its whole configuration from the environment. Anything left
// over from the developer's shell (a real REPO_URL, a real token) would make the
// tests non-hermetic and could point them at a real repo, so clear it once.
for (const key of [
  'REPO_URL', 'REPO_BRANCH', 'SCOPE_GLOB', 'SCOPE_LIMIT', 'MAX_ITERATIONS',
  'MAX_MUTANTS_PER_FILE', 'MAX_ROUNDS_PER_FILE', 'MAX_ATTEMPTS_PER_FILE',
  'PR_MODE', 'PR_BASE', 'SETUP_SCRIPT', 'DRY_RUN',
  'RULES_POST_CLONE', 'RULES_PRE_PICK', 'RULES_PICK_FILE', 'RULES_WRITE_TEST',
  'RULES_CHECK_CHANGES', 'RULES_MAKE_PR',
  'GH_TOKEN', 'LLM_BASE_URL', 'LLM_API_KEY', 'LLM_MODEL', 'LLM_ENABLE_THINKING',
  'STRYKER_TIMEOUT_MS', 'STRYKER_CONCURRENCY', 'STRYKER_TIMEOUT_FACTOR',
]) delete process.env[key];

// ── dispatchers on the two boundaries other modules destructure ────────────
const exec = require('../../exec');
function refuseExec(argv) {
  throw new Error('a test tried to spawn a child process: ' + (Array.isArray(argv) ? argv.join(' ') : String(argv))
    + ' — a module that touches the OS is not faked. Fake it, or set an exec impl with setExecImpl().');
}
let execImpl = refuseExec;
exec.run = (argv, opts) => execImpl(argv, opts);
function setExecImpl(fn) { const prev = execImpl; execImpl = fn || refuseExec; return () => { execImpl = prev; }; }

const llm = require('../../llm');
function refuseChat() { throw new Error('a test called llm.chat() with no fake installed — call installFakes() first'); }
let chatImpl = refuseChat;
llm.chat = (opts) => chatImpl(opts);
function setChatImpl(fn) { const prev = chatImpl; chatImpl = fn || refuseChat; return () => { chatImpl = prev; }; }

// ── the sidecar, loaded exactly once, with DATA_DIR already correct ────────
const S = require('../../state');
const repo = require('../../repo');
const coverage = require('../../coverage');
const stryker = require('../../stryker');
const tests = require('../../tests');
const pr = require('../../pr');
const rules = require('../../rules');
const mutants = require('../../mutants');
const util = require('../../util');
const timesheet = require('../../timesheet');
const tokens = require('../../tokens');
const { routes, server } = require('../../server');

// Captured before a single test can mutate it, so resetState() tracks any field
// added to state.js later without this helper having to be updated.
const PRISTINE_STATE = JSON.parse(JSON.stringify(S.state));

const sidecar = {
  S, state: S.state, routes, server,
  repo, coverage, stryker, tests, pr, rules, mutants, llm, exec, util, timesheet, tokens,
};

/** Wipe every trace of a previous test out of the in-memory singletons. */
function resetState() {
  for (const k of Object.keys(S.state)) delete S.state[k];
  Object.assign(S.state, JSON.parse(JSON.stringify(PRISTINE_STATE)));
  S.state.stage.since = util.nowSec();
}

let sandboxSeq = 0;

/**
 * An isolated pipeline world: fresh module state, its own repo directory (its
 * own repoUrl slug, so two sandboxes in one process can never share a checkout),
 * and its own event/log capture.
 *
 * @param {object}  [opts]
 * @param {string}  [opts.repoUrl]  override the generated unique repo URL
 * @param {boolean} [opts.quiet=true]  swallow state.event's console.log noise
 */
function sandbox(opts = {}) {
  resetState();
  const seq = ++sandboxSeq;
  const repoUrl = opts.repoUrl || `https://example.test/fake-repo-${seq}.git`;
  const repoSlug = util.slugify(repoUrl);
  const repoDir = path.join(DATA_DIR, 'repos', repoSlug);
  const cleanups = [];
  const logs = [];

  const quiet = opts.quiet !== false && !process.env.IJST_TEST_VERBOSE;
  if (quiet) {
    const realLog = console.log;
    console.log = (...args) => { logs.push(args.join(' ')); };
    cleanups.push(() => { console.log = realLog; });
  }

  const sb = {
    seq, dataDir: DATA_DIR, repoUrl, repoSlug, repoDir,
    sidecar, S, state: S.state, routes, logs,

    /** Invoke a route handler exactly as the HTTP layer would. */
    async call(key, body = {}, query = {}) {
      const handler = routes[key];
      if (!handler) throw new Error('no such route: ' + key);
      return handler(new URLSearchParams(query), body);
    },
    get(pathname, query = {}) { return sb.call('GET ' + pathname, {}, query); },
    post(pathname, body = {}) { return sb.call('POST ' + pathname, body); },

    /**
     * POST /api/run/start with this sandbox's repo. Also marks the runner as
     * detected (most routes refuse to work without it); pass `runner: null` to
     * exercise the "runner not detected" path instead.
     */
    async start(overrides = {}) {
      const { runner, ...cfg } = overrides;
      const r = await sb.call('POST /api/run/start', {
        force: true, repoUrl, repoBranch: 'main', ...cfg,
      });
      if (runner !== null) {
        S.state.runner = {
          pm: 'npm', testRunner: runner || 'vitest',
          hasStrykerConfig: false, testScript: (runner || 'vitest') + ' run',
        };
      }
      return r.run;
    },

    file(p) { return S.state.files[p]; },
    /** Event messages, newest last, optionally filtered by stage. */
    events(stage) {
      return S.state.events.filter((e) => !stage || e.stage === stage).map((e) => e.msg);
    },
    onCleanup(fn) { cleanups.push(fn); },

    cleanup() {
      while (cleanups.length) { try { cleanups.pop()(); } catch { } }
      try { fs.rmSync(repoDir, { recursive: true, force: true }); } catch { }
      resetState();
    },
  };
  return sb;
}

/** sandbox() + guaranteed cleanup. `withSandbox(fn)` or `withSandbox(opts, fn)`. */
async function withSandbox(optsOrFn, maybeFn) {
  const fn = typeof optsOrFn === 'function' ? optsOrFn : maybeFn;
  const opts = typeof optsOrFn === 'function' ? {} : optsOrFn;
  const sb = sandbox(opts);
  try { return await fn(sb); } finally { sb.cleanup(); }
}

module.exports = {
  DATA_DIR, sidecar, sandbox, withSandbox, resetState,
  setExecImpl, setChatImpl,
  // re-exported for convenience so a test file needs one require
  S, routes, repo, coverage, stryker, tests, pr, rules, mutants, llm, util,
};
