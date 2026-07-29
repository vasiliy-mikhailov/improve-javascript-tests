'use strict';
// MUTATION-HARDENING for coverage.js — the cases coverage-module.test.js leaves open.
//
// Two themes. First, the command line: coverage.js is the only place that decides which
// flags the repo's runner is invoked with, and every one of them is load-bearing. A flag
// that silently goes missing does not throw — it produces a run that reports nothing, or
// reports into a directory nobody reads, and the pipeline concludes the repo has no
// coverage. So the argv is pinned literally, per runner.
//
// Second, half-formed istanbul reports. `uncoveredLines` is a wall of optional chaining
// because the report it reads is written by someone else's coverage provider: v8-to-istanbul
// emits entries whose source location it could not resolve, a container killed mid-write
// truncates records, and providers disagree about `decl` vs `loc` and `locations` vs `loc`.
// Every `?.` in that function is a field a real report has been seen to omit, and dropping
// any of them turns one unmappable entry into a TypeError that takes down the whole file's
// prompt. Each case below removes exactly one field.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withSandbox, setExecImpl, coverage } = require('./helpers/env');   // FIRST, always
const fs = require('node:fs');
const path = require('node:path');

/** Record every argv the module hands to the OS, and behave like a runner that worked. */
function recordingRunner(sb) {
  const calls = [];
  sb.onCleanup(setExecImpl((argv, opts = {}) => {
    calls.push({ argv, opts });
    fs.mkdirSync(path.join(opts.cwd, 'coverage'), { recursive: true });
    fs.writeFileSync(path.join(opts.cwd, 'coverage', 'coverage-summary.json'),
      JSON.stringify({ total: { lines: { total: 1, covered: 1, pct: 100 } } }));
    return { code: 0, stdout: '', stderr: '', timedOut: false };
  }));
  return calls;
}

function writeFinal(dir, report) {
  fs.mkdirSync(path.join(dir, 'coverage'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'coverage', 'coverage-final.json'), JSON.stringify(report));
}

const stmt = (line, endLine = line) => ({ start: { line, column: 0 }, end: { line: endLine, column: 10 } });

// ── the command line, flag by flag ─────────────────────────────────────────

test('vitest is invoked with every flag the report depends on', () => withSandbox(async (sb) => {
  // each of these earns its place, and none of them fails loudly when it goes missing:
  //   --no-install            without it npx downloads a runner the repo never installed,
  //                           and measures the repo against a version it does not use
  //   run                     without it vitest starts in watch mode and the 30-minute
  //                           timeout is the only thing that ends the run
  //   --coverage.enabled      without it the suite passes and writes no report at all
  //   --coverage.provider=v8  istanbul is the vitest default in some versions and needs a
  //                           plugin the repo has not installed
  //   reporter=json-summary   the file runCoverage reads for its percentages
  //   reporter=json           coverage-final.json, the file uncoveredLines reads
  //   reportsDirectory        both readers look in <repo>/coverage and nowhere else
  //   --passWithNoTests       a repo whose scope has no tests yet must measure as 0 %,
  //                           not exit 1 with no report
  await sb.start({ runner: 'vitest' });
  fs.mkdirSync(sb.repoDir, { recursive: true });
  const calls = recordingRunner(sb);

  await coverage.runCoverage();

  assert.equal(calls.length, 1, 'the repo suite is the longest step in a run; measuring it twice doubles it');
  assert.deepEqual(calls[0].argv, [
    'npx', '--no-install', 'vitest', 'run', '--coverage.enabled', '--coverage.provider=v8',
    '--coverage.reporter=json-summary', '--coverage.reporter=json',
    '--coverage.reportsDirectory=coverage', '--passWithNoTests',
  ]);
  assert.equal(calls[0].opts.cwd, sb.repoDir, 'the runner has to start in the checkout, not in the sidecar');
}));

test('jest is invoked with every flag the report depends on', () => withSandbox(async (sb) => {
  // --silent and --ci are not cosmetic: jest without --ci writes new snapshots on the spot,
  // which turns a measurement into an uncommitted change to the repo under test, and a
  // chatty reporter is what the 4 MB output cap in exec.js exists to survive
  await sb.start({ runner: 'jest' });
  fs.mkdirSync(sb.repoDir, { recursive: true });
  const calls = recordingRunner(sb);

  await coverage.runCoverage();

  assert.deepEqual(calls[0].argv, [
    'npx', '--no-install', 'jest', '--coverage', '--coverageReporters=json-summary',
    '--coverageReporters=json', '--coverageDirectory=coverage', '--silent',
    '--passWithNoTests', '--ci',
  ]);
}));

// ── the error a dead runner leaves behind ──────────────────────────────────

test('a dead runner reports the last 600 characters of its output and no more',
  () => withSandbox(async (sb) => {
    // this message reaches the event log and the dashboard. npm puts its noise at the top
    // and the actual stack at the bottom, so the window has to be the TAIL, and it has to
    // be a window — a runner that dies after printing a megabyte would otherwise paste all
    // of it into state.json.
    await sb.start();
    fs.mkdirSync(sb.repoDir, { recursive: true });
    const stderr = 'npm-noise-at-the-top' + 'x'.repeat(480)   // occupies indices 0-499
      + 'inside-the-last-600' + 'y'.repeat(481)               // 500-999: inside 1025-600=425
      + 'Error: Cannot find module';                          // 1025 characters in total
    sb.onCleanup(setExecImpl(() => ({ code: 137, stdout: '', stderr, timedOut: false })));

    await assert.rejects(() => coverage.runCoverage(), (e) => {
      assert.ok(e.message.includes('Error: Cannot find module'), 'the cause is the last thing printed');
      assert.ok(e.message.includes('inside-the-last-600'),
        'the window is measured back from the end; counting forward from 600 would cut the cause loose from its context');
      assert.ok(!e.message.includes('npm-noise-at-the-top'), 'and it is a window, not the whole log');
      return true;
    });
  }));

// ── summaries that are shaped like a real runner's, minus one field ────────

test('a total block with no lines section reads as 0 %', () => withSandbox(async (sb) => {
  // jest configured with coverageReporters but no line counters, and v8 summaries for a
  // repo where nothing was instrumented, both emit a `total` that has no `lines` key.
  // Reaching into it would throw before a single per-file percentage was recorded.
  await sb.start();
  fs.mkdirSync(sb.repoDir, { recursive: true });
  sb.onCleanup(setExecImpl((argv, opts) => {
    fs.mkdirSync(path.join(opts.cwd, 'coverage'), { recursive: true });
    fs.writeFileSync(path.join(opts.cwd, 'coverage', 'coverage-summary.json'), JSON.stringify({
      total: { statements: { total: 4, covered: 4, pct: 100 } },
      [path.join(opts.cwd, 'src/a.ts')]: { lines: { total: 10, covered: 8, pct: 80 } },
    }));
    return { code: 0, stdout: '', stderr: '', timedOut: false };
  }));

  const r = await coverage.runCoverage();
  assert.equal(r.totalPct, 0);
  assert.deepEqual(r.files, { 'src/a.ts': 80 }, 'and the files it could read still come back');
}));

// ── uncoveredLines: matching the right file ────────────────────────────────

test('a vendored copy whose path merely ends with the file name is not its coverage',
  () => withSandbox(async (sb) => {
    // the tail match exists because the report was written under the CI container's paths.
    // It has to match on a whole path segment: a repo that vendors `legacy-src/a.ts` next
    // to `src/a.ts` would otherwise be told its untested file is fully covered, and the
    // pipeline would skip the one file it was pointed at.
    await sb.start();
    writeFinal(sb.repoDir, {
      '/builds/ci-42/legacy-src/a.ts': { statementMap: { 0: stmt(1), 1: stmt(2) }, s: { 0: 5, 1: 5 } },
    });

    const u = coverage.uncoveredLines('src/a.ts');
    assert.equal(u.lines, 'all');
    assert.match(u.note, /never loaded/);
  }));

// ── uncoveredLines: reports missing one field at a time ────────────────────

test('statements the provider could not place are skipped, not crashed on',
  () => withSandbox(async (sb) => {
    // three shapes v8-to-istanbul really produces for code it cannot map back to source:
    // a null entry, an entry with no start, and a single-line entry with no end. Only the
    // third names a line, so only the third can be reported.
    await sb.start();
    writeFinal(sb.repoDir, {
      [path.join(sb.repoDir, 'src/a.ts')]: {
        statementMap: { 0: null, 1: { column: 4 }, 2: { start: { line: 12, column: 0 } } },
        s: { 0: 0, 1: 0, 2: 0 },
      },
    });

    assert.deepEqual(coverage.uncoveredLines('src/a.ts').lines, [12],
      'an entry with no end line covers just its own line, and the two unplaceable ones drop out');
  }));

test('uncovered functions are listed even when the report omits their location',
  () => withSandbox(async (sb) => {
    // providers disagree about where a function's line lives — istanbul writes `decl`,
    // some write only `loc`, and a minified or generated function gets neither. The line
    // is only a hint for the prompt; losing it must not lose the function, and must not
    // throw while assembling the list.
    await sb.start();
    writeFinal(sb.repoDir, {
      [path.join(sb.repoDir, 'src/a.ts')]: {
        statementMap: {}, s: {},
        fnMap: {
          0: { name: 'declWithoutStart', decl: { end: { line: 9 } } },
          1: { name: 'noPositionAtAll' },
          2: { name: 'locWithoutStart', loc: { end: { line: 30 } } },
          3: { name: 'ordinary', decl: { start: { line: 44 } } },
        },
        f: { 0: 0, 1: 0, 2: 0, 3: 0 },
      },
    });

    assert.deepEqual(coverage.uncoveredLines('src/a.ts').functions, [
      { name: 'declWithoutStart', line: undefined },
      { name: 'noPositionAtAll', line: undefined },
      { name: 'locWithoutStart', line: undefined },
      { name: 'ordinary', line: 44 },
    ]);
  }));

test('uncovered branches are listed even when the report omits their location',
  () => withSandbox(async (sb) => {
    // `locations` carries one entry per leg, but not every provider fills it: the counters
    // in `b` regularly outnumber it, and default-argument branches arrive with neither
    // `locations` nor `loc`. Each of these is one leg that was never taken, which is what
    // the prompt is for; a missing coordinate must degrade to "no line", not to a throw.
    await sb.start();
    writeFinal(sb.repoDir, {
      [path.join(sb.repoDir, 'src/a.ts')]: {
        statementMap: {}, s: {},
        branchMap: {
          0: { type: 'binary-expr', locations: [{ start: { line: 70 } }], loc: { start: { line: 69 } } },
          1: { type: 'cond-expr', locations: [{ end: { line: 80 } }], loc: { start: { line: 79 } } },
          2: { type: 'default-arg' },
          3: { type: 'if', loc: { end: { line: 90 } } },
        },
        b: { 0: [1, 0], 1: [0], 2: [0], 3: [0] },
      },
    });

    assert.deepEqual(coverage.uncoveredLines('src/a.ts').branches, [
      { line: 69, type: 'binary-expr' },  // second leg, but `locations` only has one entry
      { line: 79, type: 'cond-expr' },    // its leg has no start, so the branch's own line stands in
      { line: undefined, type: 'default-arg' },
      { line: undefined, type: 'if' },
    ]);
  }));

test('the uncovered lines come back in source order, not in statement-id order',
  () => withSandbox(async (sb) => {
    // istanbul numbers statements in traversal order, so a file whose last function is
    // hoisted above the code that calls it yields ids that run backwards through the file.
    // The prompt quotes this list to the model as the lines to write a test for; out of
    // order it reads as noise, and the truncation at 200 would keep an arbitrary subset
    // rather than the top of the file.
    await sb.start();
    writeFinal(sb.repoDir, {
      [path.join(sb.repoDir, 'src/a.ts')]: {
        statementMap: { 0: stmt(30), 1: stmt(5), 2: stmt(17), 3: stmt(8) },
        s: { 0: 0, 1: 0, 2: 0, 3: 0 },
      },
    });

    assert.deepEqual(coverage.uncoveredLines('src/a.ts').lines, [5, 8, 17, 30]);
  }));
