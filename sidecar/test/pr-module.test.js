'use strict';
// UNIT TESTS for everything pr.js does around the commit — what it reports as changed,
// what goes into the patch, and what "create a PR" means in each of the two modes.
//
// Like pr-commit.test.js, this file lets REAL git run inside the sandbox repo, because
// every one of these functions is a thin wrapper over a git invocation whose exact flags
// are the behaviour: `-z` (paths with spaces), `base...HEAD` (three dots, not two),
// `add -N` (a brand-new test file is invisible to `git diff` without it), the `:!` path
// exclusions. Fake the git call and all of that becomes untestable.
//
// The network is never touched: `origin` is a bare repository on disk, and `gh` is the
// only command that is faked — a small stand-in that keeps the pull requests it is told
// to open, so the assertions are about the PR that exists afterwards.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withSandbox, setExecImpl, pr, repo, DATA_DIR } = require('./helpers/env');   // FIRST, always
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Let the sidecar's exec run git for real inside the sandbox repo. `gh` is routed to
 * the supplied stand-in; anything else is refused, so a test can never reach npm,
 * npx or the real gh CLI.
 */
function realGit(sb, gh) {
  return setExecImpl((argv, opts = {}) => {
    if (argv[0] === 'gh') {
      if (!gh) throw new Error('a test reached the real gh CLI: ' + argv.join(' '));
      return gh(argv.slice(1));
    }
    if (argv[0] !== 'git') throw new Error('a test tried to spawn ' + argv[0]);
    const cwd = opts.cwd || sb.repoDir;
    try {
      const stdout = execFileSync(argv[0], argv.slice(1), { cwd, encoding: 'utf8', timeout: 30000 });
      return { code: 0, stdout, stderr: '', timedOut: false };
    } catch (e) {
      return { code: e.status ?? 1, stdout: e.stdout || '', stderr: e.stderr || String(e.message), timedOut: false };
    }
  });
}

function initRepo(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const git = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'Test');
  git('config', 'commit.gpgsign', 'false'); // a signing key on the dev machine must not decide the outcome
  fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"fixture"}');
  git('add', '-A');
  git('commit', '-q', '--no-verify', '-m', 'base');
  return git;
}

/** A bare repository on disk standing in for `origin`. No network, real push. */
function addOrigin(sb, url) {
  const bare = url || path.join(fs.mkdtempSync(path.join(DATA_DIR, 'remote-')), 'origin.git');
  if (!url) execFileSync('git', ['init', '-q', '--bare', bare]);
  execFileSync('git', ['remote', 'add', 'origin', bare], { cwd: sb.repoDir });
  return bare;
}

const refs = (bare) => execFileSync('git', ['ls-remote', bare], { encoding: 'utf8' });

/**
 * A stand-in for the `gh` CLI that keeps the pull requests it opens, so tests assert on
 * the PR that exists at the end rather than on the commands that were issued. Unknown
 * arguments fail the way gh does — a wrong flag cannot pass silently.
 */
function fakeGitHub() {
  const prs = new Map();          // head branch -> pull request
  let lastNumber = 41;
  const ok = (stdout) => ({ code: 0, stdout, stderr: '', timedOut: false });
  const fail = (stderr) => ({ code: 1, stdout: '', stderr, timedOut: false });
  const gh = (args) => {
    const flag = (name) => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1]; };
    if (args[0] !== 'pr') return fail('unknown command: gh ' + args.join(' '));
    if (args[1] === 'create') {
      const head = flag('--head');
      // the message gh's GraphQL path prints — deliberately WITHOUT a url in it
      if (prs.has(head)) return fail(`pull request create failed: GraphQL: A pull request already exists for acme:${head}.`);
      const number = ++lastNumber;
      prs.set(head, {
        number, head, base: flag('--base'), title: flag('--title'), body: flag('--body'),
        labels: [], url: `https://github.com/acme/widget/pull/${number}`,
      });
      return ok(`https://github.com/acme/widget/pull/${number}\n`);
    }
    const target = prs.get(args[2]);
    if (args[1] === 'view') return target ? ok(target.url + '\n') : fail('no pull requests found');
    if (args[1] === 'edit') {
      if (!target) return fail('no pull requests found for ' + args[2]);
      const label = flag('--add-label');
      if (label) target.labels.push(label);
      if (args.includes('--title')) target.title = flag('--title');
      if (args.includes('--body')) target.body = flag('--body');
      return ok('');
    }
    return fail('unknown command: gh ' + args.join(' '));
  };
  return { gh, prs };
}

const aheadOfBase = (dir) => parseInt(execFileSync('git', ['rev-list', '--count', 'main..HEAD'],
  { cwd: dir, encoding: 'utf8' }).trim(), 10);

// ── what the working tree says has changed ────────────────────────────────────

test('a renamed test is reported once, under its new name, spaces and all', () => withSandbox(async (sb) => {
  // `git status --porcelain` without -z quotes any path containing a space and prints a
  // rename as "old -> new"; both would put a path git cannot resolve into `git add`, and
  // the commit would fail or, worse, stage nothing.
  await sb.start({ prBase: 'main' });
  const git = initRepo(sb.repoDir);
  sb.onCleanup(realGit(sb));

  repo.writeTestFile('tests/old name.test.js', "it('a', () => {});\n");
  git('add', '-A');
  git('commit', '-q', '--no-verify', '-m', 'existing test');

  git('mv', 'tests/old name.test.js', 'tests/renamed.test.js');
  repo.writeTestFile('tests/brand new.test.js', "it('b', () => {});\n");

  const changed = (await pr.changedFiles()).sort();
  assert.deepEqual(changed, ['tests/brand new.test.js', 'tests/renamed.test.js'],
    'the source path of the rename must be dropped and neither path may come back quoted');
}));

test('the changed tests of a branch span committed rounds and the edit still on disk',
  () => withSandbox(async (sb) => {
    // The PR body and the fold both ask "what did this branch touch?" after some rounds
    // are already committed. Looking only at `git status` would report the last round;
    // looking only at the diff would miss the round in progress.
    await sb.start({ prBase: 'main' });
    initRepo(sb.repoDir);
    sb.onCleanup(realGit(sb));
    await repo.createBranch('tests/improve-src-cart');

    repo.writeTestFile('tests/cart.mac-cov.test.js', "it('round 1', () => {});\n");
    await pr.commit('round 1');
    repo.writeTestFile('tests/cart.kill-batch-a.test.js', "it('round 2', () => {});\n");
    fs.writeFileSync(path.join(sb.repoDir, 'notes.md'), 'not a test\n');

    assert.deepEqual((await pr.changedTestFiles()).sort(),
      ['tests/cart.kill-batch-a.test.js', 'tests/cart.mac-cov.test.js']);
  }));

test('a test someone else landed on the base branch is not claimed as ours', () => withSandbox(async (sb) => {
  // `base..HEAD` (two dots) diffs the two tips, so a file added to main after we branched
  // shows up as a DELETION on our side and lands in the list of tests we changed. Three
  // dots asks the only question that matters: what did this branch add.
  await sb.start({ prBase: 'main' });
  const git = initRepo(sb.repoDir);
  sb.onCleanup(realGit(sb));
  await repo.createBranch('tests/improve-src-cart');
  repo.writeTestFile('tests/cart.mac.test.js', "it('ours', () => {});\n");
  await pr.commit('round 1');

  git('checkout', '-q', 'main');
  repo.writeTestFile('tests/basket.test.js', "it('theirs', () => {});\n");
  git('add', '-A');
  git('commit', '-q', '--no-verify', '-m', 'someone else improves the basket');
  git('checkout', '-q', 'tests/improve-src-cart');

  assert.deepEqual(await pr.changedTestFiles(), ['tests/cart.mac.test.js']);
}));

// ── the patch ─────────────────────────────────────────────────────────────────

test('a test file that was never staged still appears in the diff', () => withSandbox(async (sb) => {
  // `git diff <base>` knows nothing about untracked files, so without the intent-to-add
  // the PR preview of a first round is empty and the reviewer sees no new test at all.
  await sb.start({ prBase: 'main' });
  initRepo(sb.repoDir);
  sb.onCleanup(realGit(sb));
  await repo.createBranch('tests/improve-src-cart');
  repo.writeTestFile('tests/cart.mac-cov.test.js', "it('fresh', () => { expect(total([])).toBe(0); });\n");

  const diff = await pr.diffAgainstBase();

  assert.match(diff, /\+\+\+ b\/tests\/cart\.mac-cov\.test\.js/);
  assert.match(diff, /\+it\('fresh'/);
  assert.equal(aheadOfBase(sb.repoDir), 0, 'intent-to-add must not turn into a commit');
}));

test('pipeline artifacts committed on the branch stay out of the patch', () => withSandbox(async (sb) => {
  // Rounds run inside the checkout, so reports/, node_modules/ and the generated stryker
  // config can end up committed by anything that ran `git add -A`. A patch carrying a
  // node_modules tree is not a patch a human can read, let alone apply.
  await sb.start({ prBase: 'main' });
  const git = initRepo(sb.repoDir);
  sb.onCleanup(realGit(sb));
  await repo.createBranch('tests/improve-src-cart');

  fs.mkdirSync(path.join(sb.repoDir, 'reports/mutation'), { recursive: true });
  fs.writeFileSync(path.join(sb.repoDir, 'reports/mutation/mutation.json'), '{"mutants":[]}');
  fs.writeFileSync(path.join(sb.repoDir, '.ijst-stryker.config.json'), '{"mutate":[]}');
  fs.mkdirSync(path.join(sb.repoDir, 'node_modules/left-pad'), { recursive: true });
  fs.writeFileSync(path.join(sb.repoDir, 'node_modules/left-pad/index.js'), 'module.exports = 1;\n');
  git('add', '-A', '-f');
  git('commit', '-q', '--no-verify', '-m', 'artifacts leaked into a commit');
  repo.writeTestFile('tests/cart.mac.test.js', "it('kept', () => {});\n");

  const diff = await pr.diffAgainstBase();

  assert.match(diff, /\+\+\+ b\/tests\/cart\.mac\.test\.js/);
  for (const junk of ['reports/mutation', '.ijst-stryker.config.json', 'node_modules']) {
    assert.ok(!diff.includes(junk), `${junk} leaked into the patch`);
  }
}));

// ── commit, when there is nothing new on disk ─────────────────────────────────

test('a branch that already carries its rounds commits again as a no-op', () => withSandbox(async (sb) => {
  // PR creation calls commit() one last time. By then every round is usually committed
  // already and the working tree is clean — that must yield the branch head, not an error
  // that skips the PR for a file we did improve.
  await sb.start({ prBase: 'main' });
  initRepo(sb.repoDir);
  sb.onCleanup(realGit(sb));
  await repo.createBranch('tests/improve-src-cart');
  repo.writeTestFile('tests/cart.mac.test.js', "it('round 1', () => {});\n");
  const first = await pr.commit('round 1');

  const again = await pr.commit('test: improve MAC of src/cart.ts');

  assert.equal(again.sha, first.sha);
  assert.equal(aheadOfBase(sb.repoDir), 1, 'a second commit object must not be created');
}));

test('a branch level with base and a clean tree refuses to commit', () => withSandbox(async (sb) => {
  // server.js keys the "no improvement, skip the PR" path off this exact message.
  await sb.start({ prBase: 'main' });
  initRepo(sb.repoDir);
  sb.onCleanup(realGit(sb));
  await repo.createBranch('tests/improve-src-cart');

  await assert.rejects(() => pr.commit('test: improve MAC of src/cart.ts'),
    /no changed test files to commit/);
}));

test('a git commit that fails for any other reason is reported, not swallowed', () => withSandbox(async (sb) => {
  // Only "nothing to commit" is benign. Everything else — a locked index, a broken
  // signing key — must stop the file, because the PR would otherwise be opened on a
  // branch that does not contain the tests.
  await sb.start({ prBase: 'main' });
  initRepo(sb.repoDir);
  sb.onCleanup(realGit(sb));
  await repo.createBranch('tests/improve-src-cart');
  repo.writeTestFile('tests/cart.mac.test.js', "it('round 1', () => {});\n");
  fs.writeFileSync(path.join(sb.repoDir, '.git/index.lock'), '');

  await assert.rejects(() => pr.commit('round 1'), /git commit failed/);
  assert.equal(aheadOfBase(sb.repoDir), 0);
}));

// ── PR_MODE=local: the deliverable is a patch ─────────────────────────────────

test('local mode writes a patch that applies cleanly onto the base branch', () => withSandbox(async (sb) => {
  // For a third-party repo the patch IS the product — nobody checks out our branch. It has
  // to carry both the committed rounds and whatever the last round left uncommitted, and
  // it has to apply to a pristine base.
  await sb.start({ prBase: 'main', prMode: 'local' });
  initRepo(sb.repoDir);
  sb.onCleanup(realGit(sb));
  await repo.createBranch('tests/improve-src-cart-ts');
  repo.writeTestFile('tests/cart.mac-cov.test.js', "it('round 1', () => {});\n");
  await pr.commit('round 1');
  repo.writeTestFile('tests/cart.kill-batch-a.test.js', "it('round 2', () => {});\n");

  const rec = await pr.createPr({
    file: 'src/cart.ts', branch: 'tests/improve-src-cart-ts',
    title: 'test: improve MAC of src/cart.ts', body: 'two rounds, one survivor killed',
    labels: ['generated-tests'],
  });

  assert.equal(rec.url, null);
  assert.equal(rec.mode, 'local');
  await repo.resetToBase();   // back to a pristine main, exactly what a reviewer starts from
  execFileSync('git', ['apply', rec.patchPath], { cwd: sb.repoDir });
  assert.equal(fs.readFileSync(path.join(sb.repoDir, 'tests/cart.mac-cov.test.js'), 'utf8'),
    "it('round 1', () => {});\n");
  assert.equal(fs.readFileSync(path.join(sb.repoDir, 'tests/cart.kill-batch-a.test.js'), 'utf8'),
    "it('round 2', () => {});\n", 'the uncommitted round is missing from the patch');

  const payload = JSON.parse(fs.readFileSync(rec.patchPath.replace(/\.patch$/, '.json'), 'utf8'));
  assert.deepEqual(
    { file: payload.file, branch: payload.branch, title: payload.title, body: payload.body, labels: payload.labels, mode: payload.mode },
    { file: 'src/cart.ts', branch: 'tests/improve-src-cart-ts', title: 'test: improve MAC of src/cart.ts',
      body: 'two rounds, one survivor killed', labels: ['generated-tests'], mode: 'local' });
  assert.equal(sb.state.prs.length, 1);
  assert.ok(sb.events('preparing_pr').some((m) => m.includes(rec.patchPath)));
}));

test('a branch name with slashes becomes one flat file, not a directory tree', () => withSandbox(async (sb) => {
  // Branches are named from the file path (tests/improve-{file}), so most of them contain
  // slashes. Writing the patch under the raw name would throw ENOENT — no PR, no
  // deliverable — because /data/prs/tests/improve-src does not exist.
  await sb.start({ prBase: 'main', prMode: 'local' });
  initRepo(sb.repoDir);
  sb.onCleanup(realGit(sb));
  await repo.createBranch('tests/improve-src/cart.ts');
  repo.writeTestFile('tests/cart.mac.test.js', "it('x', () => {});\n");

  const rec = await pr.createPr({
    file: 'src/cart.ts', branch: 'tests/improve-src/cart.ts', title: 't', body: 'b',
  });

  assert.equal(rec.patchPath, path.join(DATA_DIR, 'prs', 'tests-improve-src-cart.ts.patch'));
  assert.ok(fs.existsSync(rec.patchPath));
  assert.ok(!fs.existsSync(path.join(DATA_DIR, 'prs', 'tests')), 'the branch name created a directory');
}));

// ── PR_MODE=github: push + gh ─────────────────────────────────────────────────

test('github mode pushes the branch and opens a PR carrying its labels', () => withSandbox(async (sb) => {
  await sb.start({ prBase: 'main', prMode: 'github' });
  initRepo(sb.repoDir);
  const bare = addOrigin(sb);
  const hub = fakeGitHub();
  sb.onCleanup(realGit(sb, hub.gh));
  await repo.createBranch('tests/improve-src-cart');
  repo.writeTestFile('tests/cart.mac.test.js', "it('x', () => {});\n");
  const { sha } = await pr.commit('round 1');

  const rec = await pr.createPr({
    file: 'src/cart.ts', branch: 'tests/improve-src-cart', title: 'test: improve MAC of src/cart.ts',
    body: 'killed 3 mutants', labels: ['generated-tests', 'mac'],
  });

  assert.ok(refs(bare).includes(`${sha}\trefs/heads/tests/improve-src-cart`),
    'the commit under review never reached the remote: ' + refs(bare));
  assert.equal(rec.url, 'https://github.com/acme/widget/pull/42');
  assert.equal(rec.patchPath, null, 'github mode must not also write a local patch');
  const opened = hub.prs.get('tests/improve-src-cart');
  assert.deepEqual(
    { base: opened.base, title: opened.title, body: opened.body, labels: opened.labels },
    { base: 'main', title: 'test: improve MAC of src/cart.ts', body: 'killed 3 mutants',
      labels: ['generated-tests', 'mac'] });
  assert.ok(sb.events('preparing_pr').some((m) => m.includes(rec.url)));
}));

test('a second PR for the same branch reuses the open one and refreshes it', () => withSandbox(async (sb) => {
  // A file can be picked again in a later batch; the branch is force-pushed and gh then
  // refuses to create a duplicate. Treating that refusal as failure would abandon a file
  // whose PR is sitting there, one round out of date.
  await sb.start({ prBase: 'main', prMode: 'github' });
  initRepo(sb.repoDir);
  addOrigin(sb);
  const hub = fakeGitHub();
  sb.onCleanup(realGit(sb, hub.gh));
  await repo.createBranch('tests/improve-src-cart');
  repo.writeTestFile('tests/cart.mac.test.js', "it('round 1', () => {});\n");
  await pr.commit('round 1');
  const first = await pr.createPr({
    file: 'src/cart.ts', branch: 'tests/improve-src-cart', title: 'first title', body: 'first body',
  });

  repo.writeTestFile('tests/cart.kill-batch-a.test.js', "it('round 2', () => {});\n");
  await pr.commit('round 2');
  const second = await pr.createPr({
    file: 'src/cart.ts', branch: 'tests/improve-src-cart', title: 'second title', body: 'second body',
  });

  assert.equal(second.url, first.url);
  const open = hub.prs.get('tests/improve-src-cart');
  assert.equal(open.title, 'second title');
  assert.equal(open.body, 'second body');
  assert.equal(hub.prs.size, 1);
  assert.equal(sb.state.prs.length, 2);
}));

test('a push that fails stops the PR before github is asked for anything', () => withSandbox(async (sb) => {
  await sb.start({ prBase: 'main', prMode: 'github' });
  initRepo(sb.repoDir);
  addOrigin(sb, path.join(DATA_DIR, 'no-such-remote.git'));
  const hub = fakeGitHub();
  sb.onCleanup(realGit(sb, hub.gh));
  await repo.createBranch('tests/improve-src-cart');
  repo.writeTestFile('tests/cart.mac.test.js', "it('x', () => {});\n");
  await pr.commit('round 1');

  await assert.rejects(() => pr.createPr({
    file: 'src/cart.ts', branch: 'tests/improve-src-cart', title: 't', body: 'b',
  }), /git push failed/);
  assert.equal(hub.prs.size, 0, 'a PR was opened against commits that were never pushed');
  assert.equal(sb.state.prs.length, 0);
}));

test('gh failing with no url and no existing PR aborts the file', () => withSandbox(async (sb) => {
  // The url is the only proof the PR exists; recording a null one would mark the file
  // improved with nothing to show for it.
  await sb.start({ prBase: 'main', prMode: 'github' });
  initRepo(sb.repoDir);
  addOrigin(sb);
  const broken = () => ({ code: 1, stdout: '', stderr: 'GraphQL: Resource not accessible by integration', timedOut: false });
  sb.onCleanup(realGit(sb, broken));
  await repo.createBranch('tests/improve-src-cart');
  repo.writeTestFile('tests/cart.mac.test.js', "it('x', () => {});\n");
  await pr.commit('round 1');

  await assert.rejects(() => pr.createPr({
    file: 'src/cart.ts', branch: 'tests/improve-src-cart', title: 't', body: 'b',
  }), /gh pr create failed: .*Resource not accessible/);
  assert.equal(sb.state.prs.length, 0);
}));

test('a dry run leaves the remote untouched and produces a patch instead', () => withSandbox(async (sb) => {
  // DRY_RUN exists so a run can be exercised end to end against a real repo we own
  // without publishing anything. A push is already publication.
  await sb.start({ prBase: 'main', prMode: 'github', dryRun: true });
  initRepo(sb.repoDir);
  const bare = addOrigin(sb);
  sb.onCleanup(realGit(sb));   // no gh stand-in: reaching gh at all is a failure
  await repo.createBranch('tests/dry-run-src-cart');
  repo.writeTestFile('tests/cart.mac.test.js', "it('x', () => {});\n");
  await pr.commit('round 1');

  const rec = await pr.createPr({
    file: 'src/cart.ts', branch: 'tests/dry-run-src-cart', title: 't', body: 'b',
  });

  assert.equal(refs(bare).trim(), '', 'a dry run pushed the branch to origin');
  assert.equal(rec.url, null);
  assert.match(fs.readFileSync(rec.patchPath, 'utf8'), /\+\+\+ b\/tests\/cart\.mac\.test\.js/);
}));
