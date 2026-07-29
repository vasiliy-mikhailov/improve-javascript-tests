'use strict';
// env.js MUST come before any other sidecar require — it captures DATA_DIR.
const { withSandbox, sidecar, setExecImpl } = require('./helpers/env');
const { test } = require('node:test');
const assert = require('node:assert/strict');

// tests.js is the pipeline's only answer to "is the repo green?". Two things it
// produces are load-bearing and invisible everywhere else:
//
//   the ARGV — helpers/fakes.js swaps tests.runTests wholesale, so no route test
//   ever sees the command that would really be spawned; and
//
//   the SUMMARY — the ~25-line tail of the runner's output. It is what the mutant
//   loop shows the model when a test comes back red, and the whole verdict
//   ({passed, exitCode, summary}) is what decides whether a generated test is
//   kept. A silently-empty or unbounded summary is a real failure mode: jest can
//   emit megabytes, and state.js persists whatever it is handed.
//
// These tests drive the REAL runTests with a fake child process and assert on
// what a caller can actually see.

/**
 * Run the real tests.runTests against a scripted child-process result.
 * @returns everything observable: the spawned command, its options, the return
 *   value, and the messages logged under the 'tests' stage.
 */
async function observe({ scope = null, runner = 'vitest', code = 0, stdout = '', stderr = '' } = {}) {
  return withSandbox(async (sb) => {
    await sb.start({ runner });
    let argv = null, opts = null;
    const restore = setExecImpl((a, o) => { argv = a; opts = o; return { code, stdout, stderr, timedOut: false }; });
    try {
      const result = await sidecar.tests.runTests(scope);
      return { argv, opts, result, events: sb.events('tests'), repoDir: sb.repoDir };
    } finally { restore(); }
  });
}

// ── the command ────────────────────────────────────────────────────────────

test('the whole-suite vitest command is spelled out in full', async () => {
  // Every word here is doing work: `npx --no-install` refuses to reach the
  // network mid-run, `run` stops vitest sitting in watch mode forever, and
  // `--passWithNoTests` keeps a repo whose scope glob matched nothing from
  // being reported as RED.
  const { argv } = await observe({ runner: 'vitest' });
  assert.deepEqual(argv, ['npx', '--no-install', 'vitest', 'run', '--passWithNoTests']);
});

test('the whole-suite jest command is spelled out in full', async () => {
  // `--ci` and `--silent` keep jest from writing snapshots and from drowning the
  // 25-line summary in console noise from the repo's own code.
  const { argv } = await observe({ runner: 'jest' });
  assert.deepEqual(argv, ['npx', '--no-install', 'jest', '--silent', '--ci', '--passWithNoTests']);
});

test('a scoped vitest run is the full-suite command with the paths appended', async () => {
  const { argv } = await observe({ runner: 'vitest', scope: ['test/a.test.ts', 'test/b.test.ts'] });
  assert.deepEqual(argv,
    ['npx', '--no-install', 'vitest', 'run', '--passWithNoTests', 'test/a.test.ts', 'test/b.test.ts']);
});

test('a scoped jest run is the full-suite command with a flagged path each', async () => {
  const { argv } = await observe({ runner: 'jest', scope: ['test/a.test.ts', 'test/b.test.ts'] });
  assert.deepEqual(argv, ['npx', '--no-install', 'jest', '--silent', '--ci', '--passWithNoTests',
    '--runTestsByPath', 'test/a.test.ts', '--runTestsByPath', 'test/b.test.ts']);
});

test('the suite is spawned inside the checkout, capped at 15 minutes, labelled tests', async () => {
  // cwd is the difference between testing the repo under improvement and testing
  // the sidecar itself. The cap matters because a hung runner otherwise pins the
  // pipeline forever — a real full suite is ~55s, so 15 minutes is slack, not a
  // budget. The label is what the dashboard's progress line is prefixed with.
  const { opts, repoDir } = await observe();
  assert.equal(opts.cwd, repoDir);
  assert.equal(opts.timeoutMs, 900000);
  assert.equal(opts.label, 'tests');
});

test('with no runner detected runTests refuses to run rather than guessing', async () => {
  await withSandbox(async (sb) => {
    await sb.start({ runner: null });
    // state.runner is null until detection succeeds, so the optional chaining is
    // what makes this a diagnosable Error instead of "cannot read properties of
    // null". No exec impl is installed either: reaching the spawn at all fails.
    await assert.rejects(
      () => sidecar.tests.runTests(null),
      (e) => e.message === 'runner not detected');
  });
});

// ── the verdict ────────────────────────────────────────────────────────────

test('exit 0 is green and every other exit code is red, verbatim', async () => {
  // The mutant loop keeps or discards a generated test on `passed` alone, and it
  // reports `exitCode` when it discards one.
  const green = await observe({ code: 0, stdout: 'ok' });
  assert.deepEqual(green.result, { passed: true, exitCode: 0, summary: 'ok' });
  const red = await observe({ code: 1, stdout: 'nope' });
  assert.deepEqual(red.result, { passed: false, exitCode: 1, summary: 'nope' });
});

test('the event log names the scoped files and the verdict', async () => {
  const { events } = await observe({ scope: ['test/a.test.ts', 'test/b.test.ts'], code: 0 });
  assert.deepEqual(events, ['test/a.test.ts test/b.test.ts: green']);
});

test('a full-suite failure is logged with the exit code that produced it', async () => {
  // 'full suite' rather than an empty scope list, and the exit code inline: this
  // line is the only trace of a red run left on the dashboard.
  const { events } = await observe({ scope: null, code: 2 });
  assert.deepEqual(events, ['full suite: RED (exit 2)']);
});

// ── the summary ────────────────────────────────────────────────────────────

test('stdout and stderr are stitched together on separate lines', async () => {
  // vitest prints the failure to stdout and the stack to stderr. Concatenating
  // them without a break glues the last line of one onto the first of the other,
  // and the model reading the summary sees a line that never existed.
  const { result } = await observe({ stdout: 'FAIL src/a.test.ts', stderr: 'AssertionError: 1 !== 2' });
  assert.equal(result.summary, 'FAIL src/a.test.ts\nAssertionError: 1 !== 2');
});

test('blank and whitespace-only lines are dropped from the summary', async () => {
  // Runner output is mostly vertical padding. Kept, it eats the 25-line budget
  // with nothing and pushes the actual assertion failure out of the summary.
  const { result } = await observe({ stdout: 'FAIL one\n\n   \nFAIL two\n' });
  assert.equal(result.summary, 'FAIL one\nFAIL two');
});

test('the summary is the LAST 25 lines of output, not the first', async () => {
  // A test runner's head is banner and progress; what failed is at the end.
  const lines = Array.from({ length: 30 }, (_, i) => 'line' + (i + 1));
  const { result } = await observe({ stdout: lines.join('\n') });
  assert.deepEqual(result.summary.split('\n'), lines.slice(5));
});

test('a long summary is cut to 2500 characters from the END', async () => {
  // This string is persisted into state and pasted into an LLM prompt. Jest can
  // emit megabytes; taking the head instead of the tail would keep the banner
  // and throw away the failure.
  const lines = Array.from({ length: 25 }, (_, i) => 'L' + String(i).padStart(2, '0') + 'x'.repeat(147));
  const { result } = await observe({ stdout: lines.join('\n') });
  assert.equal(result.summary.length, 2500);          // 25 lines * 150 + 24 newlines = 3774 in
  assert.ok(result.summary.endsWith(lines[24]), 'the last line must survive');
  assert.ok(!result.summary.includes('L00'), 'the first line must be the part that was cut');
});
