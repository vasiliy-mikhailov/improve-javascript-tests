'use strict';
// UNIT TESTS for the child-process runner — against REAL processes.
//
// exec.run is the one place where the sidecar leaves the JS heap: every clone,
// install, Stryker run and `git commit` goes through it. The rest of the suite
// replaces it wholesale (helpers/env.js installs a dispatcher that refuses to
// spawn), so nothing anywhere asserted that the wrapper itself works: that a
// non-zero exit is reported instead of thrown, that a hung child is actually
// killed, that a 6 MB Stryker log does not sit in memory forever, or that the
// LLM key the comment promises to withhold is really withheld.
//
// So this file spawns for real. Every child is `process.execPath -e <script>`
// or a fixed absolute path, every timeout is measured in hundreds of
// milliseconds, and nothing touches the network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withSandbox, S } = require('./helpers/env');   // FIRST, always
const fs = require('node:fs');
const path = require('node:path');

// helpers/env.js overwrites exec.run with a dispatcher that throws on any spawn
// — which is exactly the thing under test here. Load a second, pristine copy of
// the module (it shares the cached state.js singleton, so progress still lands
// in S.state), then hand the patched module back to require.cache so no other
// module can accidentally reach the real spawner through it.
const EXEC_PATH = require.resolve('../exec');
const patchedExec = require.cache[EXEC_PATH];
delete require.cache[EXEC_PATH];
const { run } = require('../exec');
require.cache[EXEC_PATH] = patchedExec;

/** argv for a throwaway node process running `src`. */
const node = (src) => [process.execPath, '-e', src];

const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

/** Poll `fn` every 50 ms until it returns truthy, or give up after `ms`. */
async function until(fn, ms, what) {
  const deadline = Date.now() + ms;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() > deadline) throw new Error('timed out waiting for ' + what);
    await new Promise((r) => setTimeout(r, 50));
  }
}

test('a command that succeeds comes back with code 0 and its stdout', () => withSandbox(async () => {
  // no options at all: the defaults must be usable on their own
  const r = await run(['/bin/echo', 'hello world']);
  assert.equal(r.code, 0);
  assert.equal(r.stdout, 'hello world\n');
  assert.equal(r.stderr, '');
  assert.equal(r.timedOut, false);
}));

test('a failing command resolves with its exit code instead of throwing', () => withSandbox(async () => {
  // callers branch on `code`; a rejected promise here would abort the pipeline
  // mid-stage instead of letting it record a red suite and carry on
  const r = await run(node('process.stdout.write("OUT"); process.stderr.write("ERR"); process.exit(3);'));
  assert.equal(r.code, 3);
  assert.equal(r.timedOut, false);
  // the two streams stay apart: the LLM is shown stderr, the parsers read stdout
  assert.equal(r.stdout, 'OUT');
  assert.equal(r.stderr, 'ERR');
}));

test('the child runs in the working directory it was given', () => withSandbox(async (sb) => {
  fs.mkdirSync(path.join(sb.repoDir, 'sub'), { recursive: true });
  const r = await run(node('process.stdout.write(process.cwd())'), { cwd: path.join(sb.repoDir, 'sub') });
  assert.equal(r.code, 0);
  assert.equal(r.stdout, path.join(sb.repoDir, 'sub'));
}));

test('the LLM key is withheld from the child while GH_TOKEN is passed through', () => withSandbox(async () => {
  // the target repo's own install scripts and tests run inside these children.
  // If LLM_API_KEY leaked, any repo we improve could read our credential; the
  // git credential helper, on the other hand, needs GH_TOKEN to be there.
  process.env.LLM_API_KEY = 'sk-must-not-leak';
  process.env.GH_TOKEN = 'ghp-needed-by-git';
  try {
    const r = await run(node('process.stdout.write(JSON.stringify({'
      + ' llm: process.env.LLM_API_KEY ?? null, gh: process.env.GH_TOKEN ?? null,'
      + ' ci: process.env.CI ?? null, color: process.env.FORCE_COLOR ?? null }))'));
    assert.deepEqual(JSON.parse(r.stdout), {
      llm: null, gh: 'ghp-needed-by-git', ci: 'true', color: '0',
    });
  } finally {
    delete process.env.LLM_API_KEY;
    delete process.env.GH_TOKEN;
  }
}));

test('an env entry from the caller overrides the runner defaults', () => withSandbox(async () => {
  // stryker.js passes NODE_OPTIONS this way, and coverage.js overrides CI
  const r = await run(node('process.stdout.write(process.env.CI + "|" + process.env.MY_VAR)'),
    { env: { CI: 'false', MY_VAR: 'set-by-caller' } });
  assert.equal(r.stdout, 'false|set-by-caller');
}));

test('a binary that does not exist resolves 127 with the spawn error in stderr', () => withSandbox(async () => {
  // a missing `gh` or `npx` must land in the run log as a normal stage failure,
  // not as an unhandled rejection that kills the sidecar
  const r = await run(['/nonexistent/ijst-no-such-binary'], { timeoutMs: 5000 });
  assert.equal(r.code, 127);
  assert.equal(r.timedOut, false);
  assert.match(r.stderr, /spawn error: .*ENOENT/);
}));

test('output past the cap keeps the end of the log, not the beginning', () => withSandbox(async () => {
  // a Stryker run on a big repo prints tens of megabytes; holding all of it
  // would grow the sidecar's heap without bound, and the useful part — the
  // summary and the failure — is always at the end
  const src = 'const chunk = "x".repeat(1e6);'
    + 'process.stdout.write("HEAD-OUT"); process.stderr.write("HEAD-ERR");'
    + 'for (let i = 0; i < 5; i++) { process.stdout.write(chunk); process.stderr.write(chunk); }'
    + 'process.stdout.write("TAIL-OUT"); process.stderr.write("TAIL-ERR");';
  const r = await run(node(src), { timeoutMs: 30000 });

  assert.equal(r.code, 0);
  for (const [name, tail, s] of [['stdout', 'TAIL-OUT', r.stdout], ['stderr', 'TAIL-ERR', r.stderr]]) {
    assert.ok(s.length < 4.1e6, `${name} was not capped: ${s.length} bytes`);
    assert.ok(s.length > 1.9e6, `${name} kept only ${s.length} bytes — the tail is meant to survive`);
    assert.ok(s.endsWith(tail), `${name} lost its last line`);
    assert.ok(!s.includes('HEAD-'), `${name} kept the head and dropped the tail`);
  }
}));

test('a process that never exits is killed and reported as timedOut', () => withSandbox(async () => {
  // /bin/sh rather than node, and a wider window: the child has to be up and
  // printing before the killer fires, and a cold node start loses that race
  // whenever the rest of the suite runs alongside — at 300 ms this came back
  // with an empty stdout twice in six parallel runs.
  const started = Date.now();
  const r = await run(['/bin/sh', '-c', 'echo up; exec sleep 60'], { timeoutMs: 1500 });
  assert.equal(r.timedOut, true);
  assert.ok(Date.now() - started < 10000, 'run() waited for the child instead of killing it');
  // SIGKILL leaves exit code null; callers compare `code !== 0`, so null must
  // not slip through as a success
  assert.equal(r.code, 1);
  // whatever the child managed to print before the kill is still reported
  assert.equal(r.stdout, 'up\n');
}));

test('the timeout kills grandchildren too, not just the process it spawned', () => withSandbox(async () => {
  // stryker spawns its own test-runner children. Killing only the direct child
  // leaves those orphans running full tilt for the rest of the run.
  //
  // The grandchild's own output goes to /dev/null: an orphan that still held the
  // inherited pipe would keep run()'s promise pending, and the bug would show up
  // as a hang with no assertion rather than as a failure. Two shells also start
  // inside the window on a loaded machine, where two node processes do not.
  const r = await run(['/bin/sh', '-c', 'sleep 60 >/dev/null 2>&1 & echo "PID:$!"; exec sleep 60'],
    { timeoutMs: 1500 });
  assert.equal(r.timedOut, true);

  const m = /PID:(\d+)/.exec(r.stdout);
  assert.ok(m, `the child never reported its grandchild: ${JSON.stringify(r.stdout)}`);
  const pid = Number(m[1]);
  try {
    await until(() => !alive(pid), 5000, `grandchild ${pid} to be killed with its group`);
  } finally {
    try { if (alive(pid)) process.kill(pid, 'SIGKILL'); } catch { }
  }
}));

test('the last output line reaches stage progress, stripped of ANSI and clipped', () => withSandbox(async () => {
  // the dashboard's only window into a ten-minute Stryker run is this line.
  // Raw colour codes render as garbage there, and an un-clipped line (some
  // runners emit a full progress bar per frame) pushes the layout apart.
  const line = 'a'.repeat(300);
  const src = `process.stdout.write("\\u001b[32m${line}\\u001b[0m\\n"); setTimeout(() => {}, 4000);`;
  const p = run(node(src), { timeoutMs: 8000, label: 'unit' });

  // the heartbeat only ticks every 3s, so wait for the first one
  const progress = await until(() => {
    const pr = S.state.stage.progress;
    return pr && pr.line.startsWith('unit: a') ? pr : null;
  }, 6000, 'the progress heartbeat');

  assert.equal(progress.line, 'unit: ' + 'a'.repeat(180),
    'the line must be clipped at 180 chars and carry no escape codes');
  assert.ok(progress.elapsed >= 3 && progress.elapsed < 60, `implausible elapsed: ${progress.elapsed}`);

  await p;
  // and when it is over, progress says how it ended
  assert.equal(S.state.stage.progress.line, 'unit: done (exit 0)');
}));

test('progress reports the exit code, with no label prefix when none was given',
  () => withSandbox(async () => {
    const r = await run(node('process.exit(2)'));
    assert.equal(r.code, 2);
    assert.equal(S.state.stage.progress.line, 'done (exit 2)');
  }));
