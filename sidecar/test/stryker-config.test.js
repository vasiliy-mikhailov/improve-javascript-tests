'use strict';
// UNIT TESTS for the Stryker config we generate and for the run around it.
//
// Nothing in the suite looked at the config file itself, and it is the single input
// that decides what a mutation run means: the wrong plugin list makes Stryker find no
// runner under pnpm, `related` on Stryker 8 is a crash, and a mutate spec that loses
// its line range turns a two-second kill check into a full-file run. The config is
// also the reason a run can be *silently wrong* rather than loud — a stale report left
// by the previous file parses perfectly.
//
// So these tests let the sidecar write a real config into a real repo directory and
// hand it to a stand-in for `stryker run` that locates the config the way the binary
// would: resolve the last argv entry against the cwd it was given. A wrong cwd or a
// renamed config file therefore fails here instead of passing quietly.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withSandbox, setExecImpl, stryker } = require('./helpers/env');   // FIRST, always
const fs = require('node:fs');
const path = require('node:path');

const { runStryker } = stryker;
const CFG_NAME = '.ijst-stryker.config.json';
const SRC_FILE = 'src/calc.ts';

const SRC = [
  'export function discount(total: number, tier: string): number {',   // 1
  '  let rate = 0;',                                                   // 2
  '  if (tier === "gold") rate = 0.2;',                                // 3
  '  else if (tier === "silver") rate = 0.1;',                         // 4
  '  const floor = rate;                    // WINDOW_TOP',            // 5
  '  if (total > 100) rate += 0.05;',                                  // 6
  '  if (rate > 0.3) rate = 0.3;',                                     // 7
  '  if (rate < floor) rate = floor;',                                 // 8
  '  return Math.round(total * (1 - rate) * 100) / 100;',              // 9
  '}',                                                                 // 10
  'export function isFree(total: number): boolean {',                  // 11
  '  return total <= 0;',                                              // 12
  '}',                                                                 // 13
  'export function tierOf(spend: number): string {',                   // 14
  '  return spend > 500 ? "gold" : "silver";',                         // 15
  '}',                                                                 // 16
  '',                                                                  // 17
].join('\n');

/** A checked-out repo: the source under test plus an installed Stryker of some major. */
function prepRepo(sb, { strykerVersion = '9.6.1' } = {}) {
  fs.mkdirSync(path.join(sb.repoDir, path.dirname(SRC_FILE)), { recursive: true });
  fs.writeFileSync(path.join(sb.repoDir, SRC_FILE), SRC);
  if (strykerVersion) {
    const core = path.join(sb.repoDir, 'node_modules', '@stryker-mutator', 'core');
    fs.mkdirSync(core, { recursive: true });
    fs.writeFileSync(path.join(core, 'package.json'),
      JSON.stringify({ name: '@stryker-mutator/core', version: strykerVersion }));
  }
}

/**
 * Stand-in for `npx stryker run`. `respond(cfg)` may write a report and may return
 * an exec result to override the default success. Returns the calls it saw, each
 * carrying the config exactly as Stryker would have read it.
 */
function fakeStryker(sb, respond) {
  const seen = [];
  sb.onCleanup(setExecImpl((argv, opts = {}) => {
    const cfgPath = path.resolve(opts.cwd || path.join(sb.dataDir, 'nowhere'), argv[argv.length - 1]);
    let cfg;
    try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); }
    catch (e) { throw new Error(`stryker could not read its config at ${cfgPath}: ${e.message}`); }
    seen.push({ argv, opts, cfg });
    return { code: 0, stdout: '', stderr: '', timedOut: false, ...(respond ? respond(cfg) : {}) };
  }));
  return seen;
}

const mutant = (id, status, line, over = {}) => ({
  id, mutatorName: 'ConditionalExpression', replacement: 'true', status,
  location: { start: { line, column: 3 }, end: { line, column: 30 } },
  ...over,
});

/** Write a report where the config says Stryker will write one — not where we guess. */
function writeReport(sb, cfg, mutants, file = SRC_FILE) {
  const abs = path.join(sb.repoDir, cfg.jsonReporter.fileName);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify({ schemaVersion: '1.0', files: { [file]: { mutants } } }));
}

const configOnDisk = (sb) => JSON.parse(fs.readFileSync(path.join(sb.repoDir, CFG_NAME), 'utf8'));

// ── the generated config ───────────────────────────────────────────────────

test('a vitest repo names the vitest plugin explicitly and never the jest one',
  () => withSandbox(async (sb) => {
    // pnpm symlinks node_modules, and Stryker's plugin auto-discovery walks it and
    // finds nothing: without this list every mutation run dies at "no test runner".
    await sb.start({ runner: 'vitest' });
    prepRepo(sb);
    const seen = fakeStryker(sb, (cfg) => writeReport(sb, cfg, [mutant(1, 'Killed', 6)]));
    await runStryker(SRC_FILE);

    const cfg = seen[0].cfg;
    assert.equal(cfg.testRunner, 'vitest');
    assert.deepEqual(cfg.plugins, ['@stryker-mutator/vitest-runner']);
    assert.deepEqual(cfg.vitest, { related: true },
      'stryker 9 must only run the tests that import the mutated file');
    assert.equal(cfg.jest, undefined, 'a jest section would make stryker load the wrong runner');
  }));

test('stryker 8 gets no vitest options, because `related` does not exist there',
  () => withSandbox(async (sb) => {
    // Passing an unknown option to Stryker 8 aborts the run before a single mutant
    // is tested, so the version in the repo — not ours — decides the shape here.
    await sb.start({ runner: 'vitest' });
    prepRepo(sb, { strykerVersion: '8.7.1' });
    const seen = fakeStryker(sb, (cfg) => writeReport(sb, cfg, [mutant(1, 'Killed', 6)]));
    await runStryker(SRC_FILE);

    assert.deepEqual(seen[0].cfg.vitest, {});
    assert.deepEqual(seen[0].cfg.plugins, ['@stryker-mutator/vitest-runner']);
  }));

test('a repo whose stryker version cannot be read is treated as 9',
  () => withSandbox(async (sb) => {
    // node_modules may be a pnpm store, a yarn PnP zip, or simply not installed yet;
    // an unreadable package.json must not quietly drop related-test filtering, which
    // is what keeps one broken unrelated suite from sinking every mutation run.
    await sb.start({ runner: 'vitest' });
    prepRepo(sb, { strykerVersion: null });
    const seen = fakeStryker(sb, (cfg) => writeReport(sb, cfg, [mutant(1, 'Killed', 6)]));
    await runStryker(SRC_FILE);

    assert.deepEqual(seen[0].cfg.vitest, { related: true });
  }));

test('a jest repo gets the jest plugin and find-related-tests',
  () => withSandbox(async (sb) => {
    await sb.start({ runner: 'jest' });
    prepRepo(sb);
    const seen = fakeStryker(sb, (cfg) => writeReport(sb, cfg, [mutant(1, 'Killed', 6)]));
    await runStryker(SRC_FILE);

    const cfg = seen[0].cfg;
    assert.equal(cfg.testRunner, 'jest');
    assert.deepEqual(cfg.plugins, ['@stryker-mutator/jest-runner']);
    assert.deepEqual(cfg.jest, { enableFindRelatedTests: true });
    assert.equal(cfg.vitest, undefined, 'a vitest section on a jest repo is dead weight at best');
  }));

test('a kill check mutates a line range while a full run mutates the whole file',
  () => withSandbox(async (sb) => {
    // The range is the whole point of kill verification: instrumenting the file's
    // other 300 mutants turns a seconds-long check into minutes per attempt.
    await sb.start({ runner: 'vitest' });
    prepRepo(sb);
    const seen = fakeStryker(sb, (cfg) => writeReport(sb, cfg, [mutant(1, 'Killed', 120)]));

    const full = await runStryker(SRC_FILE);
    assert.deepEqual(seen[0].cfg.mutate, [SRC_FILE]);
    assert.equal(full.partial, undefined, 'a full run is the file\'s real score');

    const partial = await runStryker(SRC_FILE, { range: { from: 120, to: 190 } });
    assert.deepEqual(seen[1].cfg.mutate, ['src/calc.ts:120-190']);
    assert.equal(partial.partial, true,
      'a range score is not the file\'s score and must never be written into metrics');
    assert.deepEqual(partial.range, { from: 120, to: 190 });
  }));

test('concurrency and both timeouts have defaults a single box survives',
  () => withSandbox(async (sb) => {
    await sb.start({ runner: 'vitest' });
    prepRepo(sb);
    const seen = fakeStryker(sb, (cfg) => writeReport(sb, cfg, [mutant(1, 'Killed', 6)]));
    await runStryker(SRC_FILE);

    const cfg = seen[0].cfg;
    assert.equal(cfg.concurrency, 6);
    assert.equal(cfg.timeoutMS, 60000);
    assert.equal(cfg.timeoutFactor, 2.5);
    assert.equal(cfg.coverageAnalysis, 'perTest');
  }));

test('the environment overrides concurrency and both timeouts, as numbers',
  () => withSandbox(async (sb) => {
    // These are the knobs an operator reaches for when timeouts start inflating the
    // score. JSON.stringify keeps a string "12" as "12", and Stryker rejects it —
    // so the parse matters, not just the plumbing.
    process.env.STRYKER_CONCURRENCY = '12';
    process.env.STRYKER_TIMEOUT_MS = '90000';
    process.env.STRYKER_TIMEOUT_FACTOR = '4';
    sb.onCleanup(() => {
      delete process.env.STRYKER_CONCURRENCY;
      delete process.env.STRYKER_TIMEOUT_MS;
      delete process.env.STRYKER_TIMEOUT_FACTOR;
    });
    await sb.start({ runner: 'vitest' });
    prepRepo(sb);
    const seen = fakeStryker(sb, (cfg) => writeReport(sb, cfg, [mutant(1, 'Killed', 6)]));
    await runStryker(SRC_FILE);

    const cfg = seen[0].cfg;
    assert.equal(cfg.concurrency, 12);
    assert.equal(cfg.timeoutMS, 90000);
    assert.equal(cfg.timeoutFactor, 4);
  }));

test('the config is written where the commit step knows to exclude it, and stryker is never fetched',
  () => withSandbox(async (sb) => {
    // pr.js excludes exactly `.ijst-stryker.config.json` from every commit and diff;
    // renaming the file here would ship pipeline config inside the PR. And the
    // container has no npm registry access at run time, so `npx` must never install.
    await sb.start({ runner: 'vitest' });
    prepRepo(sb);
    const seen = fakeStryker(sb, (cfg) => writeReport(sb, cfg, [mutant(1, 'Killed', 6)]));
    await runStryker(SRC_FILE);

    assert.ok(fs.existsSync(path.join(sb.repoDir, CFG_NAME)),
      'the config must sit at the repo root under the name pr.js excludes');
    assert.ok(seen[0].argv.includes('--no-install'), `npx would hit the network: ${seen[0].argv.join(' ')}`);
    assert.equal(seen[0].opts.cwd, sb.repoDir);
  }));

// ── the run around it ──────────────────────────────────────────────────────

test('a repo where nothing runs scores 0 instead of failing the run',
  () => withSandbox(async (sb) => {
    // A source file with no tests at all is the normal starting point, not an error:
    // throwing here would abort the pipeline on precisely the files it exists to fix.
    await sb.start({ runner: 'vitest' });
    prepRepo(sb);
    fakeStryker(sb, () => ({
      code: 1,
      stderr: 'ERROR Stryker No tests were executed. Stryker will exit prematurely.',
    }));

    const r = await runStryker(SRC_FILE);
    assert.equal(r.noTests, true);
    assert.equal(r.score, 0);
    assert.equal(r.killed, 0);
    assert.equal(r.totalMutants, null, 'the mutant count is unknown, not zero');
    assert.deepEqual(r.survived, []);
    assert.ok(sb.events('stryker').some((m) => /no tests executed/i.test(m)));
  }));

test('a crashed stryker is an error carrying its exit code and the tail of its output',
  () => withSandbox(async (sb) => {
    // A broken install must not read as a legitimate score of 0 — only the literal
    // "No tests were executed" earns that. And a full stryker log is megabytes of
    // progress lines, so the message keeps the end of it and nothing more.
    await sb.start({ runner: 'vitest' });
    prepRepo(sb);
    fakeStryker(sb, () => ({
      code: 7,
      stdout: 'EARLY_NOISE' + 'x'.repeat(2000) + 'Cannot find module vitest-runner LAST_LINE',
      stderr: 'stryker failed\n',
    }));

    await assert.rejects(runStryker(SRC_FILE), (e) => {
      assert.match(e.message, /stryker produced no report \(exit 7\)/);
      assert.match(e.message, /LAST_LINE/);
      assert.ok(!e.message.includes('EARLY_NOISE'), 'megabytes of progress must not ride along');
      return true;
    });
  }));

test('the previous file\'s report cannot be mistaken for this file\'s result',
  () => withSandbox(async (sb) => {
    // reports/mutation/mutation.json is a fixed path reused by every file in the run.
    // If a crashed run left the last file's report behind, a stale 100% would be
    // recorded as this file's score and the pipeline would move on satisfied.
    await sb.start({ runner: 'vitest' });
    prepRepo(sb);
    const stale = path.join(sb.repoDir, 'reports', 'mutation', 'mutation.json');
    fs.mkdirSync(path.dirname(stale), { recursive: true });
    fs.writeFileSync(stale, JSON.stringify({
      schemaVersion: '1.0', files: { 'src/other.ts': { mutants: [mutant(1, 'Killed', 3)] } },
    }));

    fakeStryker(sb, () => ({ code: 0, stdout: 'stryker exited without writing anything' }));

    await assert.rejects(runStryker(SRC_FILE), /produced no report/);
    assert.ok(!fs.existsSync(stale), 'the stale report must be gone before stryker starts');
  }));

test('a parsed run carries the raw report and the source around each survivor',
  () => withSandbox(async (sb) => {
    // The caller needs the raw report to say which test earned its place, and the
    // model needs numbered source context: an off-by-one in that window sends it to
    // rewrite the wrong line.
    await sb.start({ runner: 'vitest' });
    prepRepo(sb);
    fakeStryker(sb, (cfg) => writeReport(sb, cfg, [
      mutant(1, 'Killed', 6),
      mutant(2, 'Survived', 10),
      mutant(3, 'NoCoverage', 15),
    ]));

    const r = await runStryker(SRC_FILE);
    assert.equal(r.score, 33.33);
    assert.equal(r.report.files[SRC_FILE].mutants.length, 3,
      'the raw report travels with the result so nobody re-reads it from disk');

    const survivor = r.survived[0];
    assert.equal(survivor.line, 10, 'a covered survivor outranks a no-coverage one');
    assert.match(survivor.context, /^10: \}$/m, 'line numbers in the context must match the file');
    assert.match(survivor.context, /^5: .*WINDOW_TOP/m, 'the window reaches five lines above');
    assert.ok(sb.events('stryker').some((m) => /3 mutants, 1 killed, 2 survived/.test(m)));
  }));

test('timeouts inflating the score are reported once they are a material share of it',
  () => withSandbox(async (sb) => {
    // Stryker counts a timed-out mutant as KILLED, so a loaded box hands us free
    // "improvement": here ten mutants score 100% while two of them died of nothing but
    // machine load. That is the one failure mode of this pipeline that looks like
    // success in every metric, so it has to be said out loud — and not on every run,
    // or the warning becomes noise nobody reads.
    await sb.start({ runner: 'vitest' });
    prepRepo(sb);
    let mutants = [mutant(1, 'Timeout', 6), ...Array.from({ length: 9 }, (_, i) => mutant(i + 2, 'Killed', 6))];
    fakeStryker(sb, (cfg) => writeReport(sb, cfg, mutants));

    const quiet = await runStryker(SRC_FILE);
    assert.equal(quiet.timedOut, 1);
    assert.ok(!sb.events('stryker').some((m) => /WARNING/.test(m)),
      'one timeout in ten is the threshold itself, not past it');

    // the Ignored mutant is here so the ratio is 2-of-10-valid, not 2-of-11-reported:
    // measuring the share against every mutant in the file would quietly shrink it
    mutants = [mutant(1, 'Timeout', 6), mutant(2, 'Timeout', 7), mutant(3, 'Ignored', 8),
      ...Array.from({ length: 8 }, (_, i) => mutant(i + 4, 'Killed', 6))];
    const loud = await runStryker(SRC_FILE);

    assert.equal(loud.totalMutants, 10, 'an ignored mutant is not a mutant anyone can kill');
    assert.equal(loud.score, 100, 'stryker scores a timeout as a kill — that is the whole hazard');
    assert.equal(loud.timedOut, 2);
    assert.ok(sb.events('stryker').some((m) => /WARNING: 2\/10 mutants \(20%\) counted as killed by TIMEOUT on src\/calc\.ts/.test(m)),
      `the warning must carry the real numbers: ${JSON.stringify(sb.events('stryker'))}`);
  }));

test('runStryker refuses to write a config before the runner is known',
  () => withSandbox(async (sb) => {
    // testRunner: undefined produces a config Stryker accepts and then fails on
    // obscurely, minutes later; the pipeline says so up front instead.
    await sb.start({ runner: null });
    prepRepo(sb);

    await assert.rejects(runStryker(SRC_FILE), /runner not detected/);
    assert.ok(!fs.existsSync(path.join(sb.repoDir, CFG_NAME)),
      'no half-formed config may be left in the repo');
  }));
