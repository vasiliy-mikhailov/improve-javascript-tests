'use strict';
// Assertions on the parts of pr.js that pr-module.test.js and pr-commit.test.js run but
// never pin down: which directory each git command lands in, the exact set of paths the
// two path filters accept, what survives of a git failure's own words, what the patch
// file is called, and the sentence the dashboard is shown when a PR is made.
//
// Every one of these is a place the code can change without a test noticing today. The
// `cwd:` can fall off a run() call and git would then read the sidecar's own directory
// instead of the checkout. `.slice(-300)` can go and a signing failure's whole banner
// lands in the error. The extension class in the test-path regex can widen until the
// pipeline commits application code. `|| null` and `?.` around the url gh printed can
// swap for something that throws or loses it. None of that is visible unless something
// sits on the exact edge.
//
// Like the other two pr files this one lets REAL git run inside a throwaway repo — the
// flags ARE the behaviour — and stands in only for `gh`, for the one command whose own
// failure output is the thing under test, and for the two that reach the network.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withSandbox, setExecImpl, pr, repo, DATA_DIR } = require('./helpers/env');   // FIRST, always
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Real git, in exactly the directory pr.js asked for.
 *
 * The helper in pr-module.test.js falls back to the sandbox repo whenever a call comes
 * in without `cwd`, which hides the mistake this one is here to catch: in the container
 * the sidecar's own working directory is not the checkout, so a run() that loses its
 * `cwd:` reads a directory that is not a git repository at all. This helper therefore
 * falls back to an empty directory, and `gh` — which finds the remote by asking git —
 * is refused outside a worktree the same way.
 *
 * @param {object}   [o.gh]         stand-in for the gh CLI, receives argv after 'gh'
 * @param {Function} [o.intercept]  (argv, opts) => result | null, first refusal wins
 */
function strictGit(sb, o = {}) {
  const nowhere = fs.mkdtempSync(path.join(DATA_DIR, 'not-a-repo-'));
  return setExecImpl((argv, opts = {}) => {
    const cwd = opts.cwd || nowhere;
    if (o.intercept) {
      const forced = o.intercept(argv, opts);
      if (forced) return forced;
    }
    if (argv[0] === 'gh') {
      if (!o.gh) throw new Error('a test reached the real gh CLI: ' + argv.join(' '));
      if (!fs.existsSync(path.join(cwd, '.git'))) {
        return { code: 1, stdout: '', stderr: 'failed to run git: fatal: not a git repository', timedOut: false };
      }
      return o.gh(argv.slice(1));
    }
    if (argv[0] !== 'git') throw new Error('a test tried to spawn ' + argv[0]);
    try {
      return { code: 0, stdout: execFileSync('git', argv.slice(1), { cwd, encoding: 'utf8', timeout: 30000 }), stderr: '', timedOut: false };
    } catch (e) {
      return { code: e.status ?? 1, stdout: e.stdout || '', stderr: e.stderr || String(e.message), timedOut: false };
    }
  });
}

// helpers/env.js swaps exec.run for a dispatcher that refuses to spawn, so the real
// runner has to be loaded a second time to be reachable at all. It shares the cached
// state.js singleton, which is the whole point: `label` exists only to name the running
// command on the dashboard, and nothing but the real runner puts it there.
const EXEC_PATH = require.resolve('../exec');
const patchedExec = require.cache[EXEC_PATH];
delete require.cache[EXEC_PATH];
const { run: realRun } = require('../exec');
require.cache[EXEC_PATH] = patchedExec;

function initRepo(dir, config = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const git = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'Test');
  git('config', 'commit.gpgsign', 'false'); // a signing key on the dev machine must not decide the outcome
  for (const [k, v] of Object.entries(config)) git('config', k, v);
  fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"fixture"}');
  git('add', '-A');
  git('commit', '-q', '--no-verify', '-m', 'base');
  return git;
}

/**
 * `count` lines of failure output, exactly 50 characters each, with `marks` placed at the
 * line numbers given. The caps in pr.js keep the LAST 300 or 400 characters of a command
 * that failed; a marker placed inside that window but before the 300th (or 400th)
 * character is the only thing that tells `slice(-300)` from `slice(300)`, which keeps
 * everything AFTER that point and so also ends with the same last line.
 */
function log(count, marks) {
  const pad = (s) => (s + ' '.repeat(60)).slice(0, 49) + '\n';
  return Array.from({ length: count }, (_, i) => pad(marks[i] || 'hint: rerun with GIT_TRACE=1 for more detail')).join('');
}

/** Write `rel` inside the sandbox repo, making its directory. Any path, not just tests. */
function put(sb, rel, body = 'x\n') {
  const abs = path.join(sb.repoDir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
  return abs;
}

const headSha = (dir) => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
const aheadOfBase = (dir) => parseInt(execFileSync('git', ['rev-list', '--count', 'main..HEAD'],
  { cwd: dir, encoding: 'utf8' }).trim(), 10);

/** A bare repository on disk standing in for `origin`. No network, real push. */
function addOrigin(sb) {
  const bare = path.join(fs.mkdtempSync(path.join(DATA_DIR, 'remote-')), 'origin.git');
  execFileSync('git', ['init', '-q', '--bare', bare]);
  execFileSync('git', ['remote', 'add', 'origin', bare], { cwd: sb.repoDir });
  return bare;
}

/**
 * A stand-in for `gh` that keeps the pull requests it opens AND insists on the exact
 * invocation the real CLI needs. `gh pr view <branch>` without `--json url -q .url`
 * prints a human-readable page, not a url, and `-q` without `--json` is an error — so a
 * flag that goes missing here has to come back as gh's failure, or a test can pass while
 * the pipeline reads a url out of prose.
 */
function fakeGitHub() {
  const prs = new Map();
  let lastNumber = 6;
  const ok = (stdout) => ({ code: 0, stdout, stderr: '', timedOut: false });
  const fail = (stderr) => ({ code: 1, stdout: '', stderr, timedOut: false });
  const gh = (args) => {
    const flag = (name) => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1]; };
    if (args[0] !== 'pr') return fail('unknown command "' + args[0] + '" for "gh"');
    if (args[1] === 'create') {
      const head = flag('--head');
      if (!head || !flag('--base') || !flag('--title') || flag('--body') === null) {
        return fail('unknown or missing flag in: gh ' + args.join(' '));
      }
      if (prs.has(head)) return fail(`pull request create failed: GraphQL: A pull request already exists for acme:${head}.`);
      const number = ++lastNumber;
      prs.set(head, {
        number, head, base: flag('--base'), title: flag('--title'), body: flag('--body'),
        labels: [], url: `https://github.com/acme/widget/pull/${number}`,
      });
      return ok(`https://github.com/acme/widget/pull/${number}\n`);
    }
    const target = prs.get(args[2]);
    if (args[1] === 'view') {
      // the shape the pipeline relies on: gh only prints a bare url for `--json url -q .url`
      if (flag('--json') !== 'url' || flag('-q') !== '.url') {
        return fail('unknown or missing flag in: gh ' + args.join(' '));
      }
      return target ? ok(target.url + '\n') : fail('no pull requests found for branch "' + args[2] + '"');
    }
    if (args[1] === 'edit') {
      if (!target) return fail('no pull requests found for branch "' + args[2] + '"');
      const label = flag('--add-label');
      if (label) target.labels.push(label);
      if (args.includes('--title')) target.title = flag('--title');
      if (args.includes('--body')) target.body = flag('--body');
      return ok('');
    }
    return fail('unknown command "' + args.slice(0, 2).join(' ') + '" for "gh"');
  };
  return { gh, prs };
}

// ── the status parser ─────────────────────────────────────────────────────────

test('a copied test is reported under its new path, and the file it came from stays whole',
  () => withSandbox(async (sb) => {
    // A repo that sets status.renames=copies gets `C  new\0old\0` records, exactly like
    // renames. Consuming only the rename's source path leaves the copy's source to be
    // parsed as a record of its own, and `rec.slice(3)` then chops three characters off a
    // real path — the pipeline would try to commit `ts/cart.test.js` and lose the edit it
    // actually made to `tests/cart.test.js`.
    await sb.start({ prBase: 'main' });
    const git = initRepo(sb.repoDir, { 'status.renames': 'copies' });
    sb.onCleanup(strictGit(sb));
    repo.writeTestFile('tests/cart.test.js', "it('a', () => { expect(total([])).toBe(0); });\n".repeat(20));
    git('add', '-A');
    git('commit', '-q', '--no-verify', '-m', 'existing test');

    // git only offers a copy when the source was touched in the same change
    fs.copyFileSync(path.join(sb.repoDir, 'tests/cart.test.js'), path.join(sb.repoDir, 'tests/cart.copy.test.js'));
    fs.appendFileSync(path.join(sb.repoDir, 'tests/cart.test.js'), "it('b', () => {});\n");
    git('add', '-A');

    assert.deepEqual((await pr.changedFiles()).sort(),
      ['tests/cart.copy.test.js', 'tests/cart.test.js']);
  }));

// ── which paths count as a test, and which as an artifact ─────────────────────

test('the committable set spans every test layout and stops at every artifact tree',
  () => withSandbox(async (sb) => {
    // These two regexes decide what the PR contains. Loosen the extension class and the
    // pipeline commits application code as if it were a test; tighten it and a `.spec.tsx`
    // round is silently dropped. Drop the `(^|/)` anchor on either one and `atests/` counts
    // as a test directory while `src/node_modules/` stops counting as vendored. Only a list
    // that sits on all of those edges at once can tell.
    await sb.start({ prBase: 'main' });
    const git = initRepo(sb.repoDir);
    sb.onCleanup(strictGit(sb));
    await repo.createBranch('tests/improve-src-cart');

    const committable = [
      'tests/cart.test.js',            // the directory form, plural
      'test/cart.js',                  // singular, and nothing test-ish about the filename
      '__tests__/cart.js',             // no .test. in the name at all
      'spec/cart.js',
      'src/deep/nested/tests/cart.js', // the directory anywhere, not only at the root
      'src/checkout.test.js',          // the commonest shape of all: beside the source
      'src/cart.test.mjs',             // [cm]? — esm
      'src/cart.spec.cjs',             // and commonjs
      'src/widget.test.tsx',           // [jt]sx? — all four of tsx, jsx, ts, js
      'src/widget.spec.jsx',
      'src/basket.spec.ts',
      'mynode_modules/pkg/tests/cart.js', // "node_modules" that is not a node_modules dir
    ];
    const rejected = [
      'src/cart.js',
      'docs/testing.md',
      'specs/cart.js',                 // spec, not specs
      'atests/cart.js',                // tests, but not at a path boundary
      'src/cart.testing.js',           // .test must be followed by a dot
      'src/cart.test.py',              // a test, but not one of ours to commit
      'src/cart.test.js.bak',          // the extension has to end the path
      'node_modules/left-pad/tests/index.test.js',
      'coverage/tests/cart.test.js',
      'reports/mutation/tests/cart.test.js',
      '.stryker-tmp/sandbox-1/tests/cart.test.js',
      'src/node_modules/pkg/tests/cart.js', // vendored below the root is still vendored
    ];
    for (const rel of [...committable, ...rejected]) put(sb, rel);
    git('add', '-A', '-f');
    git('commit', '-q', '--no-verify', '-m', 'a branch touching every kind of path');

    assert.deepEqual((await pr.changedTestFiles()).sort(), [...committable].sort());
  }));

test('a test committed last round and edited again is listed once', () => withSandbox(async (sb) => {
  // The list is the union of what the branch committed and what is still on disk, and the
  // usual case — a round extending the file the previous round wrote — is in both. It
  // feeds the PR body and the fold, which reads every file it names: a path listed twice
  // gets its contents sent to the model twice and counted twice in the round's tally.
  await sb.start({ prBase: 'main' });
  initRepo(sb.repoDir);
  sb.onCleanup(strictGit(sb));
  await repo.createBranch('tests/improve-src-cart');
  repo.writeTestFile('tests/cart.test.js', "it('round 1', () => {});\n");
  await pr.commit('round 1');
  repo.writeTestFile('tests/cart.test.js', "it('round 1', () => {});\nit('round 2', () => {});\n");

  assert.deepEqual(await pr.changedTestFiles(), ['tests/cart.test.js']);
}));

test('a source file the model left in the checkout never reaches the patch', () => withSandbox(async (sb) => {
  // diffAgainstBase intent-to-adds the new files so they show up in the diff. It has to
  // add only the tests: the model is asked for a test and sometimes writes a helper, a
  // scratch script or a fix to the file under test next to it, and `git add -N` on that
  // would put a change to production code into a PR that claims to be tests only.
  await sb.start({ prBase: 'main' });
  const git = initRepo(sb.repoDir);
  sb.onCleanup(strictGit(sb));
  await repo.createBranch('tests/improve-src-cart');
  put(sb, 'src/.keep');                       // so src/ is tracked and cart.js is listed on its own
  git('add', '-A');
  git('commit', '-q', '--no-verify', '-m', 'src exists');
  repo.writeTestFile('tests/cart.test.js', "it('kept', () => {});\n");
  put(sb, 'src/cart.js', 'module.exports = () => 0; // the model "fixed" the bug\n');

  const diff = await pr.diffAgainstBase();

  assert.match(diff, /\+\+\+ b\/tests\/cart\.test\.js/);
  assert.ok(!diff.includes('src/cart.js'), 'a non-test file was staged into the patch:\n' + diff);
}));

// ── commit: the two failures that are not the same failure ────────────────────

test('a commit that stages nothing yields the branch head instead of failing', () => withSandbox(async (sb) => {
  // The working tree is read, then handed to `git add` as a list of paths — and the tree
  // can move in between (a repo script cleaning up, the next round starting). What git
  // stages is then empty and `git commit` exits non-zero saying "nothing to commit". That
  // one failure is benign: every earlier round is already on the branch, and treating it
  // like a broken index would throw away a PR for a file we did improve.
  await sb.start({ prBase: 'main' });
  initRepo(sb.repoDir);
  sb.onCleanup(strictGit(sb, {
    intercept: (argv) => {
      // the file goes away between the status and the add, then real git runs as usual
      if (argv[0] === 'git' && argv[1] === 'add') fs.rmSync(path.join(sb.repoDir, 'tests/cart.test.js'), { force: true });
      return null;
    },
  }));
  await repo.createBranch('tests/improve-src-cart');
  repo.writeTestFile('tests/cart.test.js', "it('a', () => {});\n");
  const before = headSha(sb.repoDir);

  const { sha } = await pr.commit('round 1');

  assert.equal(sha, before);
  assert.equal(aheadOfBase(sb.repoDir), 0, 'an empty commit was created');
}));

test('a commit that fails for real keeps git\'s last words and drops the banner', () => withSandbox(async (sb) => {
  // A failing commit can be very loud — a signing failure prints gpg's whole session —
  // and the error travels into the run's event log and the dashboard, both of which cap
  // what they store. The last 300 characters are the ones worth keeping: git's own
  // `fatal:` line is at the end, the banner at the start is noise.
  await sb.start({ prBase: 'main' });
  initRepo(sb.repoDir);
  const head = 'error: gpg failed to sign the data';
  const middle = 'gpg: no pinentry available on this host';
  const tail = 'fatal: failed to write commit object';
  // 8 lines, 400 characters: the head sits before the last 300, the middle inside them
  const stderr = log(8, { 0: head, 4: middle, 7: tail });
  sb.onCleanup(strictGit(sb, {
    intercept: (argv) => (argv[0] === 'git' && argv[1] === 'commit'
      ? { code: 128, stdout: '', stderr, timedOut: false } : null),
  }));
  await repo.createBranch('tests/improve-src-cart');
  repo.writeTestFile('tests/cart.test.js', "it('a', () => {});\n");

  const err = await pr.commit('round 1').then(() => null, (e) => e);

  assert.ok(err, 'a failing commit resolved');
  assert.ok(err.message.startsWith('git commit failed: '), err.message);
  assert.ok(err.message.includes(tail), 'git\'s own verdict is missing: ' + err.message);
  assert.ok(err.message.includes(middle), 'only the very end was kept: ' + err.message);
  assert.ok(!err.message.includes(head), 'the whole log was kept: ' + err.message);
  assert.ok(err.message.length <= 'git commit failed: '.length + 300, 'length ' + err.message.length);
}));

// ── push and gh ───────────────────────────────────────────────────────────────

test('a push that fails keeps git\'s last words and drops the banner', () => withSandbox(async (sb) => {
  // Same cap, a different number: a rejected push prints a hint block many lines long and
  // the reason — "protected branch", "permission denied" — is the last line of it.
  await sb.start({ prBase: 'main', prMode: 'github' });
  initRepo(sb.repoDir);
  addOrigin(sb);
  const head = 'To github.com:acme/widget.git';
  const middle = 'remote: error: refusing to update a protected ref';
  const tail = 'error: failed to push some refs to acme/widget';
  // 12 lines, 600 characters: the head sits before the last 400, the middle inside them
  const stderr = log(12, { 0: head, 5: middle, 11: tail });
  sb.onCleanup(strictGit(sb, {
    intercept: (argv) => (argv[0] === 'git' && argv[1] === 'push'
      ? { code: 1, stdout: '', stderr, timedOut: false } : null),
  }));
  await repo.createBranch('tests/improve-src-cart');
  repo.writeTestFile('tests/cart.test.js', "it('a', () => {});\n");
  await pr.commit('round 1');

  const err = await pr.createPr({ file: 'src/cart.ts', branch: 'tests/improve-src-cart', title: 't', body: 'b' })
    .then(() => null, (e) => e);

  assert.ok(err, 'a failing push resolved');
  assert.ok(err.message.startsWith('git push failed: '), err.message);
  assert.ok(err.message.includes(tail), 'git\'s own verdict is missing: ' + err.message);
  assert.ok(err.message.includes(middle), 'only the very end was kept: ' + err.message);
  assert.ok(!err.message.includes(head), 'the whole log was kept: ' + err.message);
  assert.ok(err.message.length <= 'git push failed: '.length + 400, 'length ' + err.message.length);
}));

test('a gh that opens nothing keeps its last words and drops the banner', () => withSandbox(async (sb) => {
  // gh's failures are the ones a human has to act on — a missing scope, a repo that
  // forbids PRs from forks — and they arrive under a wall of GraphQL context. The last
  // 400 characters carry the verdict; keeping the whole wall pushes it out of the 500
  // characters an event stores, so the run would report a failure with no reason in it.
  await sb.start({ prBase: 'main', prMode: 'github' });
  initRepo(sb.repoDir);
  addOrigin(sb);
  const head = 'GraphQL: request failed';
  const middle = 'type: FORBIDDEN, field: createPullRequest';
  const tail = 'Requires scope "public_repo" or "repo"';
  // 12 lines, 600 characters: the head sits before the last 400, the middle inside them
  const stderr = log(12, { 0: head, 5: middle, 11: tail });
  sb.onCleanup(strictGit(sb, { gh: () => ({ code: 1, stdout: '', stderr, timedOut: false }) }));
  await repo.createBranch('tests/improve-src-cart');
  repo.writeTestFile('tests/cart.test.js', "it('a', () => {});\n");
  await pr.commit('round 1');

  const err = await pr.createPr({ file: 'src/cart.ts', branch: 'tests/improve-src-cart', title: 't', body: 'b' })
    .then(() => null, (e) => e);

  assert.ok(err, 'a PR that was never opened resolved');
  assert.ok(err.message.startsWith('gh pr create failed: '), err.message);
  assert.ok(err.message.includes(tail), 'gh\'s own verdict is missing: ' + err.message);
  assert.ok(err.message.includes(middle), 'only the very end was kept: ' + err.message);
  assert.ok(!err.message.includes(head), 'the whole log was kept: ' + err.message);
  assert.ok(err.message.length <= 'gh pr create failed: '.length + 400, 'length ' + err.message.length);
  assert.equal(sb.state.prs.length, 0);
}));

test('the dashboard is told which command a run is waiting on', () => withSandbox(async (sb) => {
  // The push and the `gh pr create` are the two commands that reach the network, and a run
  // can sit on either of them for a minute. state.stage.progress is all the dashboard
  // renders while that happens, and "done (exit 0)" on its own names neither of them —
  // the only way to tell a stalled push from a stalled GitHub API is the label.
  //
  // Both commands are stood in for by a child that exits cleanly, because the real ones
  // talk to github; everything else is real git through the real runner.
  await sb.start({ prBase: 'main', prMode: 'github' });
  initRepo(sb.repoDir);
  const progress = [];
  sb.onCleanup(setExecImpl((argv, opts = {}) => {
    // sampled as each command starts, this is the line the previous one finished on
    progress.push(sb.state.stage.progress && sb.state.stage.progress.line);
    // never spawn without a cwd: this machine's own checkout has a real origin
    if (!opts.cwd) return { code: 128, stdout: '', stderr: 'fatal: not a git repository', timedOut: false };
    if (argv[0] === 'git' && argv[1] === 'push') return realRun([process.execPath, '-e', ''], opts);
    if (argv[0] === 'gh') return realRun([process.execPath, '-e', 'console.log("https://github.com/acme/widget/pull/7")'], opts);
    return realRun(argv, opts);
  }));
  await repo.createBranch('tests/improve-src-cart');
  repo.writeTestFile('tests/cart.test.js', "it('a', () => {});\n");
  await pr.commit('round 1');

  const rec = await pr.createPr({ file: 'src/cart.ts', branch: 'tests/improve-src-cart', title: 't', body: 'b' });
  progress.push(sb.state.stage.progress.line);

  assert.equal(rec.url, 'https://github.com/acme/widget/pull/7');
  assert.ok(progress.includes('git push: done (exit 0)'), progress.join(' | '));
  assert.ok(progress.includes('gh pr create: done (exit 0)'), progress.join(' | '));
}));

test('a PR asked for with no labels is opened with none', () => withSandbox(async (sb) => {
  // `labels = []` is the default for every caller that does not classify the round. If it
  // ever holds anything, every PR the pipeline opens carries a label nobody asked for —
  // and on a repo where that label does not exist, `gh pr edit --add-label` fails.
  await sb.start({ prBase: 'main', prMode: 'github' });
  initRepo(sb.repoDir);
  addOrigin(sb);
  const hub = fakeGitHub();
  sb.onCleanup(strictGit(sb, { gh: hub.gh }));
  await repo.createBranch('tests/improve-src-cart');
  repo.writeTestFile('tests/cart.test.js', "it('a', () => {});\n");
  await pr.commit('round 1');

  const rec = await pr.createPr({ file: 'src/cart.ts', branch: 'tests/improve-src-cart', title: 't', body: 'b' });

  assert.deepEqual(rec.labels, []);
  assert.deepEqual(hub.prs.get('tests/improve-src-cart').labels, []);
}));

test('the url of a PR gh refuses to duplicate is read back with the flags gh needs',
  () => withSandbox(async (sb) => {
    // `gh pr view <branch>` on its own prints a page for a human — title, body, comments —
    // with no bare url anywhere. Only `--json url -q .url` yields the one line the record
    // stores, so losing any of those four arguments turns a recovered PR into a null url
    // and the file is abandoned with its PR sitting open.
    await sb.start({ prBase: 'main', prMode: 'github' });
    initRepo(sb.repoDir);
    addOrigin(sb);
    const hub = fakeGitHub();
    sb.onCleanup(strictGit(sb, { gh: hub.gh }));
    await repo.createBranch('tests/improve-src-cart');
    repo.writeTestFile('tests/cart.test.js', "it('round 1', () => {});\n");
    await pr.commit('round 1');
    const first = await pr.createPr({
      file: 'src/cart.ts', branch: 'tests/improve-src-cart', title: 'first', body: 'first body',
    });

    repo.writeTestFile('tests/basket.test.js', "it('round 2', () => {});\n");
    await pr.commit('round 2');
    const second = await pr.createPr({
      file: 'src/cart.ts', branch: 'tests/improve-src-cart', title: 'second', body: 'second body',
    });

    assert.equal(second.url, 'https://github.com/acme/widget/pull/7');
    assert.equal(second.url, first.url);
    const open = hub.prs.get('tests/improve-src-cart');
    // the recovered PR is also brought up to date, and that edit runs in the checkout too
    assert.deepEqual({ title: open.title, body: open.body }, { title: 'second', body: 'second body' });
  }));

test('a branch already carrying its rounds reports the head it has', () => withSandbox(async (sb) => {
  // PR creation commits one last time, by which point the tree is usually clean. The
  // answer then comes from `rev-list --count` and `rev-parse HEAD`, and a sha with the
  // newline git prints still attached is not a sha anything downstream can use — it goes
  // into the run's file record and into `git push`'s refspec.
  await sb.start({ prBase: 'main' });
  initRepo(sb.repoDir);
  sb.onCleanup(strictGit(sb));
  await repo.createBranch('tests/improve-src-cart');
  repo.writeTestFile('tests/cart.test.js', "it('round 1', () => {});\n");
  await pr.commit('round 1');

  const again = await pr.commit('test: improve MAC of src/cart.ts');

  assert.equal(again.sha, headSha(sb.repoDir));
  assert.equal(aheadOfBase(sb.repoDir), 1, 'a second commit object was created');
}));

test('a url gh printed is kept even when it also mentions an existing pull request',
  () => withSandbox(async (sb) => {
    // The recovery path exists for the case where gh gave us NO url. Entering it whenever
    // the words "already exists" appear anywhere in gh's output — a note about the branch,
    // a label, the PR body we passed in and gh echoed back — throws away a url we already
    // hold and re-asks for one gh has only just created, which comes back empty.
    await sb.start({ prBase: 'main', prMode: 'github' });
    initRepo(sb.repoDir);
    addOrigin(sb);
    const chatty = (args) => (args[1] === 'create'
      ? { code: 0, stdout: 'https://github.com/acme/widget/pull/7\n', stderr: 'the label "mac" already exists\n', timedOut: false }
      : { code: 1, stdout: '', stderr: 'no pull requests found for branch "' + args[2] + '"', timedOut: false });
    sb.onCleanup(strictGit(sb, { gh: chatty }));
    await repo.createBranch('tests/improve-src-cart');
    repo.writeTestFile('tests/cart.test.js', "it('a', () => {});\n");
    await pr.commit('round 1');

    const rec = await pr.createPr({ file: 'src/cart.ts', branch: 'tests/improve-src-cart', title: 't', body: 'b' });

    assert.equal(rec.url, 'https://github.com/acme/widget/pull/7');
  }));

// ── the patch on disk, and what the run is told ───────────────────────────────

test('a patch saved without a PR payload leaves no payload behind', () => withSandbox(async (sb) => {
  // The route that offers a file's diff for download calls savePatch(branch) with no
  // record. Writing a payload anyway would put a file full of `null` next to the patch
  // and overwrite the real payload of a PR that was prepared earlier for that branch.
  await sb.start({ prBase: 'main', prMode: 'local' });
  initRepo(sb.repoDir);
  sb.onCleanup(strictGit(sb));
  await repo.createBranch('tests/improve-src-cart');
  repo.writeTestFile('tests/cart.test.js', "it('a', () => {});\n");

  const patchPath = await pr.savePatch('tests/improve-src-cart');

  assert.match(fs.readFileSync(patchPath, 'utf8'), /\+\+\+ b\/tests\/cart\.test\.js/);
  assert.ok(!fs.existsSync(patchPath.replace(/\.patch$/, '.json')), 'a payload was written for nobody');
}));

test('a branch name keeps its dots, dashes and underscores in the patch file name',
  () => withSandbox(async (sb) => {
    // The patch is the deliverable in local mode and its name is how a human finds it, so
    // the slug has to stay recognisable as the branch: everything a filename can safely
    // hold survives, every run of anything else collapses to a single dash. Replacing each
    // bad character separately would turn `improve@@src` into `improve--src`, and dropping
    // `.` or `_` from the safe set turns `cart_v1.2.ts` into `cart-v1-2-ts`.
    await sb.start({ prBase: 'main', prMode: 'local' });
    initRepo(sb.repoDir);
    sb.onCleanup(strictGit(sb));
    repo.writeTestFile('tests/cart.test.js', "it('a', () => {});\n");

    const patchPath = await pr.savePatch('tests//improve@@src cart_v1.2.ts');

    assert.equal(patchPath, path.join(DATA_DIR, 'prs', 'tests-improve-src-cart_v1.2.ts.patch'));
  }));

test('the event announcing a PR names what was made and where it is', () => withSandbox(async (sb) => {
  // The event log is the only place a local-mode run says where the deliverable landed.
  // "PR prepared locally: /data/prs/x.patch" is a path someone copies; the url alone, or
  // the sentence alone, is not.
  await sb.start({ prBase: 'main', prMode: 'local' });
  initRepo(sb.repoDir);
  sb.onCleanup(strictGit(sb));
  await repo.createBranch('tests/improve-src-cart');
  repo.writeTestFile('tests/cart.test.js', "it('a', () => {});\n");

  const rec = await pr.createPr({ file: 'src/cart.ts', branch: 'tests/improve-src-cart', title: 't', body: 'b' });

  assert.deepEqual(sb.events('preparing_pr'), ['PR prepared locally: ' + rec.patchPath]);
}));

test('the event announcing a github PR names the url', () => withSandbox(async (sb) => {
  await sb.start({ prBase: 'main', prMode: 'github' });
  initRepo(sb.repoDir);
  addOrigin(sb);
  const hub = fakeGitHub();
  sb.onCleanup(strictGit(sb, { gh: hub.gh }));
  await repo.createBranch('tests/improve-src-cart');
  repo.writeTestFile('tests/cart.test.js', "it('a', () => {});\n");
  await pr.commit('round 1');

  const rec = await pr.createPr({
    file: 'src/cart.ts', branch: 'tests/improve-src-cart', title: 't', body: 'b', labels: ['generated-tests'],
  });

  assert.deepEqual(sb.events('preparing_pr'), ['PR created: https://github.com/acme/widget/pull/7']);
  assert.equal(rec.url, 'https://github.com/acme/widget/pull/7');
  // labelling is a separate gh call per label, and it has to reach the checkout as well
  assert.deepEqual(hub.prs.get('tests/improve-src-cart').labels, ['generated-tests']);
}));
