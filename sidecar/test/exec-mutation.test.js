'use strict';
// Assertions on the parts of exec.run that exec.test.js exercises but never
// pins down: the exact edges of the 4 MB output cap, the child's stdin, the
// signal the timeout sends, the progress line before the child has said
// anything, and the shape of the last line the dashboard is shown.
//
// Every one of these is a place where the code can be changed without a single
// existing test noticing — the cap can start trimming a log that is exactly at
// the limit or keep the wrong 2 MB, the kill can soften to SIGTERM, the ANSI
// stripper can stop handling `ESC[m`, the line splitter can stop handling a
// bare `\n`, and the run's elapsed seconds can turn into a unix timestamp.
// Like exec.test.js this file spawns real children: every one is
// `process.execPath -e <script>` or /bin/sh, and none touches the network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withSandbox, S } = require('./helpers/env');   // FIRST, always

// helpers/env.js replaces exec.run with a dispatcher that refuses to spawn —
// the very function under test. Load a second, pristine copy (it shares the
// cached state.js singleton, so progress still lands in S.state), then hand the
// patched module back so nothing else can reach the real spawner through it.
const EXEC_PATH = require.resolve('../exec');
const patchedExec = require.cache[EXEC_PATH];
delete require.cache[EXEC_PATH];
const { run } = require('../exec');
require.cache[EXEC_PATH] = patchedExec;

/** argv for a throwaway node process running `src`. */
const node = (src) => [process.execPath, '-e', src];

/** Poll `fn` every 25 ms until it returns truthy, or give up after `ms`. */
async function until(fn, ms, what) {
  const deadline = Date.now() + ms;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() > deadline) throw new Error('timed out waiting for ' + what);
    await new Promise((r) => setTimeout(r, 25));
  }
}

/** A child that writes `bytes` to stdout and the same number to stderr. */
const writer = (bytes) => node(
  `const c = "x".repeat(1e5);`
  + `for (let i = 0; i < ${bytes / 1e5}; i++) { process.stdout.write(c); process.stderr.write(c); }`);

test('a log that lands exactly on the four-megabyte cap is kept whole', () => withSandbox(async () => {
  // the cap is `length > 4e6`. Off by one in the other direction — `>=` — throws
  // away the first half of a log the moment it reaches the limit, so a Stryker
  // run whose output stops dead on 4 MB would lose its own summary. Nothing else
  // in the suite sits on the boundary: the existing cap test overshoots it by a
  // megabyte, where trimming is correct either way.
  const r = await run(writer(4e6), { timeoutMs: 60000 });
  assert.equal(r.code, 0);
  assert.equal(r.stdout.length, 4e6);
  assert.equal(r.stderr.length, 4e6);
}));

test('a log under the cap keeps every byte, not only the last two megabytes', () => withSandbox(async () => {
  // 3 MB is above the 2 MB the trimmer keeps and below the 4 MB that triggers
  // it. If the comparison ever loosens to `<=`, or the branch is taken
  // unconditionally, this log silently loses its first megabyte — and the first
  // megabyte of an `npm install` log is where the failure usually is.
  const r = await run(writer(3e6), { timeoutMs: 60000 });
  assert.equal(r.code, 0);
  assert.equal(r.stdout.length, 3e6);
  assert.equal(r.stderr.length, 3e6);
}));

test('a log that overshoots the cap comes back under it', () => withSandbox(async () => {
  // The trimmer keeps the LAST two megabytes. Keeping everything from the
  // two-megabyte mark onwards instead — slice(2e6) rather than slice(-2e6) —
  // also drops the head and also ends with the tail, so nothing that looks at
  // the ends can tell the two apart. The length can: 6 MB in leaves exactly
  // 4 MB, sitting *on* the cap rather than under it, and the gap grows with
  // every chunk the runner prints, which is the unbounded heap the cap exists
  // to prevent.
  const src = 'const pad = "x".repeat(6e6 - 16);'
    + 'process.stdout.write("HEAD-OUT" + pad + "TAIL-OUT");'
    + 'process.stderr.write("HEAD-ERR" + pad + "TAIL-ERR");';
  const r = await run(node(src), { timeoutMs: 60000 });

  assert.equal(r.code, 0);
  for (const [name, tail, s] of [['stdout', 'TAIL-OUT', r.stdout], ['stderr', 'TAIL-ERR', r.stderr]]) {
    assert.ok(s.length < 4e6, `${name} came back at ${s.length} bytes, on or over the 4 MB cap`);
    assert.ok(s.length >= 2e6, `${name} kept only ${s.length} bytes — two megabytes are meant to survive`);
    assert.ok(s.endsWith(tail), `${name} lost its last line`);
    assert.ok(!s.includes('HEAD-'), `${name} kept the head and dropped the tail`);
  }
}));

test('a command that reads stdin sees end-of-file instead of hanging', () => withSandbox(async () => {
  // stdin is deliberately 'ignore', i.e. /dev/null. If it were a pipe the
  // sidecar never writes to, any tool that reads stdin — `npm` asking to
  // confirm a prompt, `gh` reading a body, a test runner in watch mode —
  // would block until the timeout killed it, and the stage would fail after
  // ten minutes of nothing.
  const r = await run(node('process.stdout.write("read:" + require("node:fs").readFileSync(0, "utf8").length)'),
    { timeoutMs: 8000 });
  assert.equal(r.code, 0);
  assert.equal(r.timedOut, false);
  assert.equal(r.stdout, 'read:0');
}));

test('a child that ignores SIGTERM is still killed when its time runs out', () => withSandbox(async () => {
  // SIGKILL, not a polite signal — and the difference is invisible on a
  // well-behaved child, because node quietly turns a falsy signal into
  // SIGTERM. A wedged test runner is exactly the child that traps it: `sleep`
  // here ignores SIGTERM across the exec, so with anything short of SIGKILL
  // the pipeline sits out the full hang it believed it had just killed.
  const started = Date.now();
  const r = await run(['/bin/sh', '-c', 'trap "" TERM; echo up; exec sleep 8'], { timeoutMs: 1500 });
  assert.equal(r.timedOut, true);
  // SIGKILL leaves no exit code, which run() reports as 1; a child that shrugged
  // off the signal and ran to completion would come back 0
  assert.equal(r.code, 1);
  assert.equal(r.stdout, 'up\n');
  assert.ok(Date.now() - started < 6000, 'run() waited the child out instead of killing it');
}));

test('a run that has printed nothing shows "(starting)" and no label prefix', () => withSandbox(async () => {
  // a `git clone` of a large repo is silent for a minute, and the heartbeat
  // still fires every three seconds. The dashboard has to show something for
  // that stage — an empty seed would leave the field blank — and for a run
  // with no label it must not be the string "undefined: " that building the
  // prefix unconditionally would produce.
  const p = run(node('setTimeout(() => {}, 4000)'), { timeoutMs: 20000 });
  const progress = await until(() => S.state.stage.progress, 8000, 'the first progress heartbeat');
  assert.equal(progress.line, '(starting)');
  await p;
}));

// One line of a real runner's output: colour on and off, a bare `ESC[m` reset
// with no parameters, an uppercase `ESC[2K` erase-line, indentation, and a
// digit in the visible text. Two earlier lines, one ended with CRLF and one
// with a bare LF, so that the splitter has to handle both.
const BLOB = '\u001b[32mALPHA\u001b[0m\r\n'
  + 'middle\n'
  + '  second \u001b[1;33mLINE\u001b[m \u001b[2K9 counter\n';

test('progress shows the last non-empty line, stripped of colour and padding', () => withSandbox(async () => {
  // this string is the dashboard's entire view of a ten-minute Stryker run.
  // Every part of the expected value is load-bearing: escape codes render as
  // garbage, the indentation the runner uses for nesting is noise in a
  // one-line field, and the blank line that ends every log must not blank the
  // field out.
  const p = run(node('process.stdout.write(' + JSON.stringify(BLOB) + '); setTimeout(() => {}, 4000)'),
    { timeoutMs: 20000 });
  const progress = await until(() => S.state.stage.progress, 8000, 'the first progress heartbeat');

  assert.equal(progress.line, 'second LINE 9 counter');
  await p;
}));

test('progress reports how long the run took, not when it ended', () => withSandbox(async () => {
  // `elapsed` is rendered as a duration. Adding the start time instead of
  // subtracting it puts a unix timestamp — about 55 years — in the dashboard's
  // "running for" field, and every existing test only looks at the line.
  const r = await run(['/bin/echo', 'quick']);
  assert.equal(r.code, 0);
  assert.equal(S.state.stage.progress.line, 'done (exit 0)');
  assert.ok(S.state.stage.progress.elapsed >= 0 && S.state.stage.progress.elapsed < 60,
    `implausible elapsed: ${S.state.stage.progress.elapsed}`);
}));
