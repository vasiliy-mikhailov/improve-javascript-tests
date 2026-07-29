'use strict';
// Assertions on the parts of sidecar/stryker.js that the suite runs but never looks
// at: the half of the generated config nobody reads back, the exact argv and exec
// options `stryker run` is given, the two event lines that are the entire log of a
// mutation run, and — the bulk of it — the shape parseReport hands the rest of the
// pipeline.
//
// parseReport is where a silent change is most expensive. Its output decides which
// mutant the model is asked to kill, which line of source it is shown, and whether
// "did the target die?" is answered from a complete list or a truncated one. Every
// one of those can be broken while the score still comes out right: the survivor
// ordering can invert, the source window can slide five lines or wrap to the end of
// the file, the replacement can arrive empty, the list can lose everything past its
// hundredth entry, and an empty file can score NaN instead of 100.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withSandbox, setExecImpl, stryker } = require('./helpers/env');   // FIRST, always
const fs = require('node:fs');
const path = require('node:path');

const { runStryker, parseReport } = stryker;
const CFG_NAME = '.ijst-stryker.config.json';
const SRC_FILE = 'src/target.js';

// 24 lines whose text states their own number, so the edges of the context window
// are readable at a glance: `12: line 12 of the source under test` is either the
// twelfth line or it is a bug.
const LINES = 24;
const SRC = Array.from({ length: LINES }, (_, i) => `line ${i + 1} of the source under test`).join('\n');
const at = (n) => `${n}: line ${n} of the source under test`;

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
 * Stand-in for `npx stryker run`, locating the config the way the binary would:
 * resolve the last argv entry against the cwd it was given.
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

/** Parse a hand-written report against the sandbox's checkout, without a run. */
function parseAt(sb, mutants, file = SRC_FILE) {
  const p = path.join(sb.dataDir, `report-${sb.seq}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(p, JSON.stringify({ schemaVersion: '1.0', files: { [file]: { mutants } } }));
  return parseReport(p, file);
}

// ── the config Stryker is actually handed ──────────────────────────────────

test('the config settles where the report lands, what is reported, and what is cleaned up',
  () => withSandbox(async (sb) => {
    // Half of this config is never read back by any other test, and each unread field
    // is load-bearing:
    //  - drop the json reporter and no mutation.json exists, so every run throws
    //    "produced no report" — the failure looks like a broken Stryker install;
    //  - jsonReporter.fileName is the exact path runStryker deletes before the run and
    //    reads after it. If the two ever disagree, either every run throws or, worse,
    //    every run parses the file left by the previous one;
    //  - `.stryker-tmp` is the one temp name Stryker always adds to its own ignore
    //    patterns and the one this repo's .gitignore knows; rename it and a full copy
    //    of the checkout is copied into the next sandbox and committed into the PR;
    //  - cleanTempDir:false leaves that copy behind for every file in the run;
    //  - break:null keeps a low score from ending the run with a non-zero exit —
    //    a badly tested file is this pipeline's normal input, not its failure mode.
    await sb.start({ runner: 'vitest' });
    prepRepo(sb);
    const seen = fakeStryker(sb, (cfg) => writeReport(sb, cfg, [mutant(1, 'Killed', 6)]));
    await runStryker(SRC_FILE);

    const cfg = seen[0].cfg;
    assert.equal(cfg.$schema,
      'https://raw.githubusercontent.com/stryker-mutator/stryker/master/packages/api/schema/stryker-core.json');
    assert.deepEqual(cfg.reporters, ['json', 'progress']);
    assert.equal(cfg.jsonReporter.fileName, 'reports/mutation/mutation.json');
    assert.equal(cfg.tempDirName, '.stryker-tmp');
    assert.equal(cfg.cleanTempDir, true);
    assert.deepEqual(cfg.thresholds, { high: 80, low: 60, break: null });
  }));

test('a two-digit stryker major still counts as 9 or newer',
  () => withSandbox(async (sb) => {
    // The major comes from splitting the version on '.' and taking the first field.
    // Lose the separator and "10.2.0" reads as "1" — every repo on Stryker 10 would
    // silently lose `related`, and one broken unrelated test file could then sink
    // every mutation run in it. 9.6.1 (the version the other tests use) survives
    // that bug intact, so nothing else in the suite can see it.
    await sb.start({ runner: 'vitest' });
    prepRepo(sb, { strykerVersion: '10.2.0' });
    const seen = fakeStryker(sb, (cfg) => writeReport(sb, cfg, [mutant(1, 'Killed', 6)]));
    await runStryker(SRC_FILE);

    assert.deepEqual(seen[0].cfg.vitest, { related: true });
  }));

test('stryker is run through npx in the checkout, labelled, with forty minutes to finish',
  () => withSandbox(async (sb) => {
    // exec.run's own default is ten minutes, which a thousand-mutant file blows
    // through; the run would be killed and reported as "produced no report".
    // The label is the prefix on the single progress line the dashboard shows for
    // the whole run — without it a forty-minute silence is indistinguishable from
    // an npm install.
    await sb.start({ runner: 'vitest' });
    prepRepo(sb);
    const seen = fakeStryker(sb, (cfg) => writeReport(sb, cfg, [mutant(1, 'Killed', 6)]));
    await runStryker(SRC_FILE);

    assert.deepEqual(seen[0].argv, ['npx', '--no-install', 'stryker', 'run', CFG_NAME]);
    assert.equal(seen[0].opts.label, 'stryker');
    assert.equal(seen[0].opts.timeoutMs, 2400000);
  }));

test('a crash whose whole log is shorter than the tail still reports the log',
  () => withSandbox(async (sb) => {
    // The error keeps the LAST 800 characters of the output. Keeping everything
    // *after* the first 800 instead is invisible on the megabyte of progress noise a
    // real run produces — both drop the head and both end with the tail — but on a
    // short log it yields nothing at all, and "stryker produced no report (exit 9): "
    // with an empty tail is what an operator would get for the single most common
    // failure there is, a missing runner plugin.
    await sb.start({ runner: 'vitest' });
    prepRepo(sb);
    fakeStryker(sb, () => ({ code: 9, stderr: 'Cannot find module @stryker-mutator/vitest-runner\n' }));

    await assert.rejects(runStryker(SRC_FILE), (e) => {
      assert.match(e.message, /stryker produced no report \(exit 9\): /);
      assert.match(e.message, /Cannot find module @stryker-mutator\/vitest-runner/);
      return true;
    });
  }));

// ── the two lines a mutation run writes to the log ─────────────────────────

test('a kill check logs the range it looked at and how many mutants in it are still alive',
  () => withSandbox(async (sb) => {
    // This line is the only trace a kill check leaves. It is built by concatenating
    // two templates around numbers, so an operator reading the sweep sees either the
    // real counts or the string "NaN" — and a NaN here reads exactly like a mutant
    // that could not be verified, which is the case the sweep retries.
    await sb.start({ runner: 'vitest' });
    prepRepo(sb);
    fakeStryker(sb, (cfg) => writeReport(sb, cfg, [
      mutant(1, 'Killed', 120), mutant(2, 'Survived', 130), mutant(3, 'NoCoverage', 140),
    ]));

    await runStryker(SRC_FILE, { range: { from: 120, to: 190 } });
    assert.ok(sb.events('stryker').includes(
      'src/target.js:120-190 (kill check): 3 mutant(s) in range, 1 killed, 2 still alive'),
    `the kill-check line was: ${JSON.stringify(sb.events('stryker'))}`);
  }));

test('the survivor list is capped for size, while the count and the identity list are not',
  () => withSandbox(async (sb) => {
    // `survived` is capped at 100 because it carries a source window each and is
    // written into state and into prompts. `survivedAll` and `survivedTotal` must not
    // be: "did this mutant die?" is answered by its ABSENCE from the survivor list,
    // so answering it from the capped array reports a false kill for every mutant past
    // the hundredth — on precisely the weakly-tested files where the cap bites. The
    // logged count comes from the same uncapped total, or the run reports 100
    // survivors on a file that has 120.
    await sb.start({ runner: 'vitest' });
    prepRepo(sb);
    const many = Array.from({ length: 120 }, (_, i) => mutant(i + 1, 'Survived', i + 1));
    fakeStryker(sb, (cfg) => writeReport(sb, cfg, many));

    const r = await runStryker(SRC_FILE);
    assert.equal(r.survivedTotal, 120);
    assert.equal(r.survivedAll.length, 120);
    assert.equal(r.survivedAll.at(-1).line, 120, 'the last survivor must still be identifiable');
    assert.equal(r.survived.length, 100);
    assert.equal(r.survived.at(-1).line, 100);
    assert.ok(sb.events('stryker').includes(
      'src/target.js: 120 mutants, 0 killed, 120 survived+nocov, score 0%'),
    `the run line was: ${JSON.stringify(sb.events('stryker'))}`);
  }));

// ── parseReport ────────────────────────────────────────────────────────────

test('a file with no mutant anyone could kill scores 100, not NaN',
  () => withSandbox(async (sb) => {
    // Ignored mutants leave an empty denominator, and 0/0 is NaN. NaN travels into
    // the file's recorded mutation score and into MAC, where it renders as "NaN%" and
    // compares false against every threshold — so the file is never "done" and the
    // run keeps picking it forever.
    await sb.start({ runner: 'vitest' });
    prepRepo(sb);
    fakeStryker(sb, (cfg) => writeReport(sb, cfg, [mutant(1, 'Ignored', 6)]));

    const r = await runStryker(SRC_FILE);
    assert.equal(r.totalMutants, 0);
    assert.equal(r.score, 100);
    assert.equal(r.survivedTotal, 0);
    assert.ok(!sb.events('stryker').some((m) => /WARNING/.test(m)),
      'no mutants means no timeouts to be suspicious of');
    assert.ok(sb.events('stryker').includes('src/target.js: 0 mutants, 0 killed, 0 survived+nocov, score 100%'),
      `the run line was: ${JSON.stringify(sb.events('stryker'))}`);
  }));

test('a report entry that lists no mutants at all adds nothing to the score',
  () => withSandbox(async (sb) => {
    // parseReport walks every entry in the report's `files` map, not just the one it
    // was asked about, and an entry can arrive without a `mutants` key — a file
    // Stryker copied and found nothing to mutate in. Defaulting that to anything but
    // "no mutants" invents one that nothing can ever kill: it lands in the
    // denominator, never appears in the survivor list, and leaves the real file's
    // score permanently short by a mutant the sweep cannot even be pointed at.
    await sb.start();
    const p = path.join(sb.dataDir, `report-sparse-${sb.seq}.json`);
    fs.writeFileSync(p, JSON.stringify({
      schemaVersion: '1.0',
      files: {
        [SRC_FILE]: { mutants: [mutant(1, 'Killed', 6), mutant(2, 'Survived', 8)] },
        'src/nothing-to-mutate.js': { source: 'module.exports = {};' },
      },
    }));
    const r = parseReport(p, SRC_FILE);

    assert.equal(r.totalMutants, 2);
    assert.equal(r.killed, 1);
    assert.equal(r.score, 50);
    assert.equal(r.survivedTotal, 1);
  }));

test('covered survivors come first, and within a group the lower line comes first',
  () => withSandbox(async (sb) => {
    // The sweep works the list from the top, so this order is what the model is asked
    // to kill first. A covered survivor needs one sharper assertion; a no-coverage one
    // needs a test that reaches the code at all — much more work, often for a file the
    // coverage phase is about to cover anyway. Two things can break here independently:
    // the group ranking, and the line tiebreak that only runs when the ranks are equal.
    // The report deliberately arrives in none of the right orders.
    await sb.start();
    const r = parseAt(sb, [
      mutant(1, 'NoCoverage', 10),
      mutant(2, 'Survived', 30),
      mutant(3, 'Survived', 5),
      mutant(4, 'NoCoverage', 2),
    ]);

    assert.deepEqual(r.survivedAll.map((m) => [m.status, m.line]),
      [['survived', 5], ['survived', 30], ['nocoverage', 2], ['nocoverage', 10]]);
  }));

test('a survivor carries the replacement that describes it, capped, and empty when there is none',
  () => withSandbox(async (sb) => {
    // The replacement is the whole description the sweep prompt gives the model of the
    // change no test noticed ("this line became `true`"). An empty one describes
    // nothing; an uncapped one is a whole minified line pasted into every prompt. The
    // two lists cap it differently on purpose — the identity list is the durable queue
    // and is kept small.
    await sb.start();
    const long = 'x'.repeat(300);
    const r = parseAt(sb, [
      mutant(1, 'Survived', 10, { replacement: long }),
      mutant(2, 'Survived', 20, { replacement: undefined }),
    ]);

    assert.equal(r.survived[0].replacement, 'x'.repeat(200));
    assert.equal(r.survivedAll[0].replacement, 'x'.repeat(60));
    assert.equal(r.survived[1].replacement, '', 'a report with no replacement must not invent one');
    assert.equal(r.survivedAll[1].replacement, '');
    assert.equal(r.survivedAll[0].mutator, 'ConditionalExpression');
    assert.equal(r.survivedAll[0].column, 3);
  }));

test('the source window runs from five lines above a survivor to five below it',
  () => withSandbox(async (sb) => {
    // The model is told to write a test for the line this window points at, so the
    // window's edges and its line numbers are the instruction. Sliding it by one, or
    // opening it at the top of the file, or letting it run to the end of the file,
    // all produce plausible-looking source that describes a different line — and the
    // mutant then never dies no matter how good the test is.
    await sb.start();
    prepRepo(sb);
    const r = parseAt(sb, [
      mutant(1, 'Survived', 10),
      // a survivor inside the first five lines: the window must clamp at the top of
      // the file rather than wrap to its end, which a negative slice index does
      mutant(2, 'Survived', 3),
    ]);

    const top = r.survived[0].context.split('\n');
    assert.equal(top[0], at(1));
    assert.equal(top.at(-1), at(8));
    assert.equal(top.length, 8);

    const mid = r.survived[1].context.split('\n');
    assert.equal(mid[0], at(5));
    assert.equal(mid.at(-1), at(15));
    assert.equal(mid.length, 11);
  }));

test('a mutant the report describes without a location is listed rather than fatal',
  () => withSandbox(async (sb) => {
    // Every field of a mutant's location is read through optional chaining, and this is
    // why: one malformed entry — an older schema version, a hand-edited report, a
    // reporter that omitted `end` — must not take the whole survivor list down with a
    // TypeError. The list IS the run's output; losing it loses the file.
    await sb.start();
    prepRepo(sb);
    const bare = (id, location) => ({ id, mutatorName: 'BooleanLiteral', replacement: 'false', status: 'Survived', location });
    const r = parseAt(sb, [
      bare(1, undefined),
      bare(2, {}),
      bare(3, { start: { line: 10, column: 4 } }),
    ]);

    assert.deepEqual(r.survivedAll.map((m) => m.line), [undefined, undefined, 10]);
    assert.equal(r.survived[0].context, undefined, 'no line means no window to show');
    assert.equal(r.survived[1].context, undefined);
    // no `end` in the location: the window still ends five lines past the start
    assert.equal(r.survived[2].context.split('\n').at(-1), at(15));
  }));

test('survivors are still reported for a source file the checkout does not have',
  () => withSandbox(async (sb) => {
    // readFileSafe returns null for anything it cannot read — a file the run deleted, a
    // path that is not there any more, a binary. That is not a reason to lose the
    // survivor list: the score and the queue are still the run's answer for that file.
    await sb.start();
    prepRepo(sb);
    const r = parseAt(sb, [mutant(1, 'Survived', 10)], 'src/never-checked-out.js');

    assert.equal(r.survivedTotal, 1);
    assert.equal(r.survived[0].line, 10);
    assert.equal(r.survived[0].context, undefined, 'no source means no window, not an empty one');
  }));
