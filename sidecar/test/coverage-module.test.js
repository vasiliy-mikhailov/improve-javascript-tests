'use strict';
// UNIT TESTS for coverage.js — the parsing, not the spawning.
//
// Everything downstream of this module trusts two numbers: the per-file percentage that
// decides which file is worth working on, and the total that the PR quotes as proof the
// run helped. Both are read out of files a child process leaves on disk, so the child is
// faked here the way a real runner behaves — it writes an istanbul summary into
// <repo>/coverage and exits — and the production reader is the code under test.
//
// The cases that matter are the ugly ones: a suite that goes red but still reports, a
// half-written summary (a killed container leaves one), keys that point outside the repo,
// and a file the tests never loaded at all, which must read as 0 % and not as "missing".
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withSandbox, setExecImpl, coverage, S } = require('./helpers/env');   // FIRST, always
const fs = require('node:fs');
const path = require('node:path');

/** Put an istanbul json-summary where a coverage run would have left it. */
function writeSummary(dir, summary) {
  fs.mkdirSync(path.join(dir, 'coverage'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'coverage', 'coverage-summary.json'),
    typeof summary === 'string' ? summary : JSON.stringify(summary));
}

function writeFinal(dir, report) {
  fs.mkdirSync(path.join(dir, 'coverage'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'coverage', 'coverage-final.json'), JSON.stringify(report));
}

/**
 * A stand-in for the repo's test runner. It answers only to the binary that is actually
 * installed — `npx --no-install vitest` in a jest repo really does exit non-zero and
 * write nothing — and otherwise leaves the summary behind and exits with `code`.
 */
function fakeRunner({ installed = 'vitest', summary, code = 0, stdout = '', stderr = '' } = {}) {
  return setExecImpl((argv, opts = {}) => {
    if (argv[2] !== installed) {
      return { code: 1, stdout: '', stderr: `npm error could not determine executable to run: ${argv[2]}`, timedOut: false };
    }
    if (summary !== undefined) writeSummary(opts.cwd, summary);
    return { code, stdout, stderr, timedOut: false };
  });
}

const lines = (pct) => ({ lines: { total: 100, covered: Math.round(pct), skipped: 0, pct } });

// ── runCoverage: what comes back from a run ────────────────────────────────

test('a vitest summary becomes repo-relative paths and a rounded total', () => withSandbox(async (sb) => {
  await sb.start();
  fs.mkdirSync(sb.repoDir, { recursive: true });
  sb.onCleanup(fakeRunner({
    installed: 'vitest',
    summary: {
      total: lines(71.4285),
      [path.join(sb.repoDir, 'src/a.ts')]: lines(87.666),
      [path.join(sb.repoDir, 'src/nested/b.ts')]: lines(50),
    },
  }));

  const r = await coverage.runCoverage();

  assert.deepEqual(r.files, { 'src/a.ts': 87.67, 'src/nested/b.ts': 50 },
    'the rest of the pipeline keys everything by repo-relative path; absolute keys match nothing');
  assert.equal(r.totalPct, 71.43);
  assert.equal(r.exitCode, 0);
  assert.ok(sb.events('coverage').some((m) => m.includes('71.43%')), 'the dashboard reads this event');
}));

test('a jest repo is measured with jest', () => withSandbox(async (sb) => {
  await sb.start({ runner: 'jest' });
  fs.mkdirSync(sb.repoDir, { recursive: true });
  sb.onCleanup(fakeRunner({
    installed: 'jest',
    summary: { total: lines(42), [path.join(sb.repoDir, 'lib/thing.js')]: lines(42) },
  }));

  const r = await coverage.runCoverage();
  assert.deepEqual(r.files, { 'lib/thing.js': 42 });
  assert.equal(r.totalPct, 42);
}));

test('a repo whose runner is vitest is not measured with jest', () => withSandbox(async (sb) => {
  // the mirror of the test above: if the runner were picked by anything other than what
  // prepare detected, the wrong binary runs, npx --no-install writes nothing, and the
  // run has to fail loudly rather than report a stale or empty report
  await sb.start({ runner: 'vitest' });
  fs.mkdirSync(sb.repoDir, { recursive: true });
  sb.onCleanup(fakeRunner({ installed: 'jest', summary: { total: lines(99) } }));

  await assert.rejects(() => coverage.runCoverage(), /produced no summary/);
}));

test('coverage cannot be measured before the runner is known', () => withSandbox(async (sb) => {
  await sb.start({ runner: null });
  sb.onCleanup(setExecImpl(() => { throw new Error('the runner check must come before any spawn'); }));

  await assert.rejects(() => coverage.runCoverage(), /runner not detected/);
}));

test('a runner that dies without a summary reports its exit code and its output',
  () => withSandbox(async (sb) => {
    await sb.start();
    fs.mkdirSync(sb.repoDir, { recursive: true });
    sb.onCleanup(fakeRunner({
      installed: 'vitest', code: 137,
      stderr: 'Error: Cannot find module @vitest/coverage-v8\nkilled',
    }));

    await assert.rejects(() => coverage.runCoverage(), (e) => {
      assert.match(e.message, /exit 137/, 'the exit code is the only clue when the output is empty');
      assert.match(e.message, /Cannot find module @vitest\/coverage-v8/, 'the cause has to travel with the error');
      return true;
    });
  }));

test('a red suite still yields its numbers, because failing tests do not erase the report',
  () => withSandbox(async (sb) => {
    // the baseline measurement of a repo whose suite is already broken: the percentages
    // are real and the pipeline needs them, but the non-zero exit must survive to the
    // caller so a broken suite is not mistaken for a clean one
    await sb.start();
    fs.mkdirSync(sb.repoDir, { recursive: true });
    sb.onCleanup(fakeRunner({
      installed: 'vitest', code: 1,
      summary: { total: lines(63.5), [path.join(sb.repoDir, 'src/a.ts')]: lines(63.5) },
      stdout: '1 failed | 12 passed',
    }));

    const r = await coverage.runCoverage();
    assert.equal(r.exitCode, 1);
    assert.equal(r.totalPct, 63.5);
    assert.ok(sb.events('coverage').some((m) => m.includes('suite exit 1')));
  }));

test('a half-written summary is an error, not zero percent', () => withSandbox(async (sb) => {
  // a container killed mid-write leaves a truncated file; reading that as 0 % would tell
  // the pipeline every file it just improved had lost all of its coverage
  await sb.start();
  fs.mkdirSync(sb.repoDir, { recursive: true });
  S.upsertFile('src/a.ts', { coverage: 80 });
  sb.onCleanup(fakeRunner({ installed: 'vitest', summary: '{"total":{"lines":{"pct":63.5' }));

  await assert.rejects(() => coverage.runCoverage(), (e) => e instanceof SyntaxError);
  assert.equal(sb.file('src/a.ts').coverage, 80, 'the last good measurement must stand');
}));

// ── runCoverage: what it writes back into the files table ──────────────────

test('coverage lands on the scope files, and a file the suite never loaded reads as 0 %',
  () => withSandbox(async (sb) => {
    await sb.start();
    fs.mkdirSync(sb.repoDir, { recursive: true });
    S.upsertFile('src/a.ts', {});                    // in scope, in the report
    S.upsertFile('src/never-loaded.ts', {});         // in scope, absent from the report
    S.upsertFile('src/kept.ts', { coverage: 42 });   // in scope, absent, already measured
    sb.onCleanup(fakeRunner({
      installed: 'vitest',
      summary: {
        total: lines(70),
        [path.join(sb.repoDir, 'src/a.ts')]: lines(90),
        [path.join(sb.repoDir, 'src/out-of-scope.ts')]: lines(10),
      },
    }));

    const r = await coverage.runCoverage();

    assert.equal(sb.file('src/a.ts').coverage, 90);
    assert.equal(sb.file('src/never-loaded.ts').coverage, 0,
      'absent from an istanbul summary means never imported, which is 0 % and not unknown');
    assert.equal(sb.file('src/kept.ts').coverage, 42,
      'a file already measured keeps its number: a partial report must not zero it');
    assert.equal(sb.file('src/out-of-scope.ts'), undefined,
      'the summary covers the whole repo; only scope files belong in the files table');
    assert.equal(r.files['src/out-of-scope.ts'], 10, 'it is still returned to the caller');
  }));

// ── parseSummary: the shapes real runners emit ─────────────────────────────

test('paths outside the repo and files with no percentage are left out', () => withSandbox(async (sb) => {
  // v8 summaries routinely carry linked workspace packages and virtual modules; a key
  // that relativises to ../../ is not a file this run can ever write a test for
  await sb.start();
  fs.mkdirSync(sb.repoDir, { recursive: true });
  sb.onCleanup(fakeRunner({
    installed: 'vitest',
    summary: {
      total: lines(55),
      [path.join(sb.repoDir, '..', 'shared-lib/index.ts')]: lines(12),
      '/opt/homebrew/lib/node_modules/x/index.js': lines(3),
      'src/relative.ts': lines(55),
      [path.join(sb.repoDir, 'src/empty.ts')]: { lines: { total: 0, covered: 0, pct: 'Unknown' } },
      [path.join(sb.repoDir, 'src/no-lines.ts')]: { statements: { pct: 100 } },
    },
  }));

  const r = await coverage.runCoverage();
  assert.deepEqual(r.files, { 'src/relative.ts': 55 },
    'a key already relative to the repo is kept as it is; everything else here is not a repo file');
}));

test('a total of "Unknown" reads as 0 %, not NaN', () => withSandbox(async (sb) => {
  // istanbul writes pct "Unknown" when nothing was instrumented, and NaN would spread
  // straight into the MAC score and into the PR body
  await sb.start();
  fs.mkdirSync(sb.repoDir, { recursive: true });
  sb.onCleanup(fakeRunner({
    installed: 'vitest',
    summary: { total: { lines: { total: 0, covered: 0, pct: 'Unknown' } } },
  }));

  assert.equal((await coverage.runCoverage()).totalPct, 0);
}));

test('a summary with no total block still parses its files', () => withSandbox(async (sb) => {
  await sb.start();
  fs.mkdirSync(sb.repoDir, { recursive: true });
  sb.onCleanup(fakeRunner({
    installed: 'vitest',
    summary: { [path.join(sb.repoDir, 'src/a.ts')]: lines(80) },
  }));

  const r = await coverage.runCoverage();
  assert.equal(r.totalPct, 0);
  assert.deepEqual(r.files, { 'src/a.ts': 80 });
}));

// ── uncoveredLines: what the model is told to aim at ───────────────────────

const stmt = (line, endLine = line) => ({ start: { line, column: 0 }, end: { line: endLine, column: 10 } });

test('the uncovered lines of a file are the ones no statement counter reached',
  () => withSandbox(async (sb) => {
    await sb.start();
    writeFinal(sb.repoDir, {
      [path.join(sb.repoDir, 'src/a.ts')]: {
        statementMap: { 0: stmt(3), 1: stmt(8), 2: stmt(9), 3: stmt(20, 40) },
        s: { 0: 7, 1: 0, 2: 0, 3: 0 },
        fnMap: {
          0: { name: 'parse', decl: { start: { line: 7 } } },
          1: { name: '', loc: { start: { line: 19 } } },
        },
        f: { 0: 1, 1: 0 },
        branchMap: { 0: { type: 'if', locations: [{ start: { line: 30 } }, { start: { line: 33 } }] } },
        b: { 0: [4, 0] },
      },
    });

    const u = coverage.uncoveredLines('src/a.ts');
    assert.deepEqual(u.lines, [8, 9, 20, 21, 22, 23],
      'a statement spanning lines 20-40 contributes only its first few lines — the prompt gets a target, not the whole file');
    assert.deepEqual(u.functions, [{ name: '(anonymous)', line: 19 }],
      'a function that ran is not worth a test, and an unnamed one still needs a line to point at');
    assert.deepEqual(u.branches, [{ line: 33, type: 'if' }], 'only the leg that was never taken');
  }));

test('a file the tests never loaded is reported as entirely uncovered', () => withSandbox(async (sb) => {
  // the distinction the prompt depends on: "write a test for these lines" versus
  // "this file is not imported by anything, start from nothing"
  await sb.start();
  writeFinal(sb.repoDir, {
    [path.join(sb.repoDir, 'src/other.ts')]: { statementMap: { 0: stmt(1) }, s: { 0: 1 } },
  });

  const u = coverage.uncoveredLines('src/missing.ts');
  assert.equal(u.lines, 'all');
  assert.match(u.note, /never loaded/);
}));

test('no coverage-final.json at all is a note, not a crash', () => withSandbox(async (sb) => {
  // uncoveredLines runs right after a coverage run that may have died; throwing here
  // would take down the whole file loop instead of just this one prompt
  await sb.start();
  fs.mkdirSync(sb.repoDir, { recursive: true });

  assert.deepEqual(coverage.uncoveredLines('src/a.ts'), { lines: [], note: 'no coverage-final.json' });
}));

test('a report keyed by a build-time absolute path still matches the repo file',
  () => withSandbox(async (sb) => {
    // the report is written inside the container the suite ran in, so its keys are that
    // container's paths, not this checkout's — matching on the tail is what saves it
    await sb.start();
    writeFinal(sb.repoDir, {
      '/builds/ci-42/src/a.ts': {
        data: { statementMap: { 0: stmt(5), 1: stmt(6) }, s: { 0: 0, 1: 2 } },
      },
    });

    assert.deepEqual(coverage.uncoveredLines('src/a.ts').lines, [5],
      'both the tail match and the counters nested under .data have to work');
  }));

test('a report keyed by the plain relative path is read too', () => withSandbox(async (sb) => {
  await sb.start();
  writeFinal(sb.repoDir, { 'src/a.ts': { statementMap: { 0: stmt(11) }, s: { 0: 0 } } });

  assert.deepEqual(coverage.uncoveredLines('src/a.ts').lines, [11]);
}));

test('a hopeless file is truncated rather than handed to the model whole', () => withSandbox(async (sb) => {
  // this text goes into a prompt: an untouched 2000-line file would otherwise spend the
  // entire context window listing line numbers
  await sb.start();
  const statementMap = {}; const s = {};
  for (let i = 0; i < 400; i++) { statementMap[i] = stmt(i + 1); s[i] = 0; }
  const fnMap = {}; const f = {};
  for (let i = 0; i < 60; i++) { fnMap[i] = { name: 'fn' + i, decl: { start: { line: i + 1 } } }; f[i] = 0; }
  const branchMap = {}; const b = {};
  for (let i = 0; i < 100; i++) { branchMap[i] = { type: 'binary-expr', loc: { start: { line: i + 1 } } }; b[i] = [0]; }
  writeFinal(sb.repoDir, { [path.join(sb.repoDir, 'src/a.ts')]: { statementMap, s, fnMap, f, branchMap, b } });

  const u = coverage.uncoveredLines('src/a.ts');
  assert.equal(u.lines.length, 200);
  assert.equal(u.functions.length, 50);
  assert.equal(u.branches.length, 80);
  assert.deepEqual(u.lines.slice(0, 3), [1, 2, 3], 'and it is the first lines, in order');
  assert.equal(u.branches[0].line, 1, 'a branch with no per-leg locations falls back to its own line');
}));
