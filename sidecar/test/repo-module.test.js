'use strict';
// UNIT TESTS for the steps that put the repo on disk and make it runnable — clone,
// install — and for the classification logic that decides what the pipeline is
// allowed to look at.
//
// None of it was tested, because all of it either shells out or walks a real tree,
// and every failure in here is silent. A clone that keeps a stale checkout measures
// code that is not the code under review. An install that pairs stryker 9 with
// vitest 2 dies twenty minutes later, inside stryker, after the LLM budget is spent.
// A scope filter that lets node_modules or .d.ts files through burns a whole run
// writing tests for files nobody owns.
//
// Two stand-ins are used here, and both BEHAVE rather than record:
//   * real git, against a real origin repository in a temp dir — the pattern
//     pr-commit.test.js established. No network, no remote, no reliance on the
//     machine's git config beyond what each test sets itself.
//   * a package manager that actually materialises node_modules, so the assertions
//     are about which packages ended up installed, at which version, by which tool.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withSandbox, setExecImpl, repo, S } = require('./helpers/env');   // FIRST, always
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// ── real git, real origin ──────────────────────────────────────────────────

const OK = { code: 0, stdout: '', stderr: '', timedOut: false };
const originRoots = [];
process.on('exit', () => {
  for (const d of originRoots) { try { fs.rmSync(d, { recursive: true, force: true }); } catch { } }
});

function writeAll(dir, files) {
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
}

/**
 * A git repository on disk that a clone can be served from. Short temp path on
 * purpose: repoDir() is `slugify(repoUrl).slice(0, 80)`, so two long origin paths
 * could slug to the same checkout directory.
 */
function makeOrigin(files = { 'a.txt': 'one\n' }) {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'ijst-og-'));
  originRoots.push(dir);
  const git = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'Test');
  writeAll(dir, files);
  git('add', '-A');
  git('commit', '-q', '--no-verify', '-m', 'base');
  return {
    dir,
    git,
    head: () => git('rev-parse', 'HEAD').trim(),
    commit(more, msg) { writeAll(dir, more); git('add', '-A'); git('commit', '-q', '--no-verify', '-m', msg); return git('rev-parse', 'HEAD').trim(); },
    branch(name, more, msg) { git('checkout', '-q', '-b', name); return this.commit(more, msg); },
  };
}

/** Let the sidecar's exec run for real. `git clone` runs with no cwd of its own. */
function realGit(sb) {
  return setExecImpl((argv, opts = {}) => {
    const cwd = opts.cwd && fs.existsSync(opts.cwd) ? opts.cwd : sb.dataDir;
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
  fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"fixture"}');
  git('add', '-A');
  git('commit', '-q', '--no-verify', '-m', 'base');
  return git;
}

const readRepo = (sb, rel) => { try { return fs.readFileSync(path.join(sb.repoDir, rel), 'utf8'); } catch { return null; } };
const inRepo = (sb, rel) => fs.existsSync(path.join(sb.repoDir, rel));

// ── a package manager that installs things ─────────────────────────────────

// What the registry would hand back for an unpinned request.
const LATEST = {
  '@stryker-mutator/core': '9.6.1',
  '@stryker-mutator/vitest-runner': '9.6.1',
  '@stryker-mutator/jest-runner': '9.6.1',
  '@vitest/coverage-v8': '3.2.4',
};

function parseSpec(spec) {
  const at = spec.lastIndexOf('@');
  return at > 0 ? { name: spec.slice(0, at), range: spec.slice(at + 1) } : { name: spec, range: '' };
}

/** Resolve a range the way a registry would: a pin wins, anything else is latest. */
function resolveVersion(name, range) {
  const m = /(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(range || '');
  if (!m) return LATEST[name] || '1.0.0';
  return `${m[1]}.${m[2] ?? 0}.${m[3] ?? 0}`;
}

/**
 * Stand in for npm/pnpm/yarn with something that has consequences: packages appear
 * under node_modules at a resolved version, tagged with the tool that put them
 * there, and `run <script>` leaves the artifact a build step would leave.
 *
 * @param {object} [opts.fail]  (argv) => ({code, stderr}) | null — script a failure
 */
function fakePm(sb, opts = {}) {
  const dir = sb.repoDir;
  const put = (name, version, by) => {
    const d = path.join(dir, 'node_modules', ...name.split('/'));
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'package.json'), JSON.stringify({ name, version, installedBy: by }));
  };
  const installManifest = (by) => {
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    for (const [n, r] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) put(n, resolveVersion(n, r), by);
  };
  const restore = setExecImpl((argv) => {
    const scripted = opts.fail ? opts.fail(argv) : null;
    if (scripted) return { ...OK, code: 1, ...scripted };
    if (argv[0] === 'corepack' && argv[1] === 'enable') return OK;
    const pm = argv[0] === 'corepack' ? argv[1] : argv[0];
    const rest = argv[0] === 'corepack' ? argv.slice(2) : argv.slice(1);
    const args = rest.slice(1).filter((a) => !a.startsWith('-'));
    if (rest[0] === 'install' || rest[0] === 'ci') {
      if (args.length) for (const s of args) { const { name, range } = parseSpec(s); put(name, resolveVersion(name, range), pm); }
      else installManifest(pm);
      return OK;
    }
    if (rest[0] === 'add') {
      for (const s of args) { const { name, range } = parseSpec(s); put(name, resolveVersion(name, range), pm); }
      return OK;
    }
    if (rest[0] === 'run') {
      writeAll(dir, { [`dist/${rest[1]}-output.js`]: 'module.exports = {};\n' });
      return OK;
    }
    throw new Error('unexpected command in this test: ' + argv.join(' '));
  });
  sb.onCleanup(restore);
}

function installed(sb, name) {
  try { return JSON.parse(fs.readFileSync(path.join(sb.repoDir, 'node_modules', ...name.split('/'), 'package.json'), 'utf8')); }
  catch { return null; }
}

/** Lay down a repo directory (no git) with the given package.json and files. */
function repoAt(sb, pkg, files = {}) {
  fs.mkdirSync(sb.repoDir, { recursive: true });
  writeAll(sb.repoDir, { 'package.json': JSON.stringify(pkg, null, 2), ...files });
}

// ══ clone ══════════════════════════════════════════════════════════════════

test('a clone checks out the branch that was asked for, at its head', async () => {
  const origin = makeOrigin({ 'a.txt': 'main content\n' });
  const releaseSha = origin.branch('release', { 'a.txt': 'release content\n' }, 'release work');

  await withSandbox({ repoUrl: origin.dir }, async (sb) => {
    await sb.start({ repoBranch: 'release' });
    sb.onCleanup(realGit(sb));

    const r = await repo.clone();

    assert.equal(r.dir, sb.repoDir);
    assert.equal(readRepo(sb, 'a.txt'), 'release content\n');
    assert.equal(r.head, releaseSha, 'the reported head is what later stages record as the baseline commit');
  });
});

test('cloning over an existing checkout brings it up to the remote and keeps node_modules', async () => {
  // The second run on the same repo takes this path. If the fetch/reset were skipped
  // or the clean took node_modules with it, the run would either measure yesterday's
  // code or pay for a twenty-minute reinstall on every iteration.
  const origin = makeOrigin({ 'a.txt': 'one\n' });

  await withSandbox({ repoUrl: origin.dir }, async (sb) => {
    await sb.start();
    sb.onCleanup(realGit(sb));
    await repo.clone();

    writeAll(sb.repoDir, {
      'a.txt': 'locally mangled\n',
      'leftover.test.ts': 'it("stale", () => {});\n',
      'node_modules/dep/index.js': 'module.exports = 1;\n',
    });
    origin.commit({ 'a.txt': 'two\n' }, 'upstream moved');

    await repo.clone();

    assert.equal(readRepo(sb, 'a.txt'), 'two\n', 'the checkout must follow the remote, not the local edit');
    assert.equal(inRepo(sb, 'leftover.test.ts'), false, 'a previous attempt\'s untracked files must not survive');
    assert.equal(inRepo(sb, 'node_modules/dep/index.js'), true, 'node_modules is explicitly excluded from the clean');
  });
});

test('a fetch that fails aborts the clone instead of reporting a stale checkout as ready', async () => {
  const origin = makeOrigin({ 'a.txt': 'one\n' });

  await withSandbox({ repoUrl: origin.dir }, async (sb) => {
    await sb.start();
    sb.onCleanup(realGit(sb));
    await repo.clone();
    fs.rmSync(origin.dir, { recursive: true, force: true });   // the remote is gone

    await assert.rejects(() => repo.clone(), /git fetch failed/);
  });
});

test('a clone that fails carries git\'s own reason, not a bare exit code', async () => {
  const missing = path.join(fs.realpathSync(os.tmpdir()), 'ijst-no-such-origin-' + process.pid);

  await withSandbox({ repoUrl: missing }, async (sb) => {
    await sb.start();
    sb.onCleanup(realGit(sb));

    await assert.rejects(() => repo.clone(), (e) => {
      assert.match(e.message, /git clone failed/);
      assert.match(e.message, /does not exist|not a git repository|repository/i,
        'the operator needs git\'s sentence to tell a bad URL from a bad token');
      return true;
    });
  });
});

test('credentials left in an old checkout\'s remote are scrubbed before anything can echo them', async () => {
  // A token inlined in the remote URL is reproduced verbatim in git's error output,
  // which the sidecar puts in the event log and on the dashboard.
  const origin = makeOrigin({ 'a.txt': 'one\n' });
  const TOKEN = 'ghp_' + 'A1b2C3d4E5f6G7h8i9';

  await withSandbox({ repoUrl: origin.dir }, async (sb) => {
    await sb.start();
    sb.onCleanup(realGit(sb));
    fs.mkdirSync(path.dirname(sb.repoDir), { recursive: true });
    execFileSync('git', ['clone', '-q', origin.dir, sb.repoDir], { encoding: 'utf8' });
    const g = (...a) => execFileSync('git', a, { cwd: sb.repoDir, encoding: 'utf8' });
    g('remote', 'set-url', 'origin', `https://bot:${TOKEN}@example.test/thing.git`);
    // once the credentials are gone the fetch must still resolve — locally, so this
    // test never reaches the network
    g('config', `url.${origin.dir}.insteadOf`, 'https://example.test/thing.git');
    origin.commit({ 'a.txt': 'two\n' }, 'upstream moved');

    await repo.clone();

    assert.equal(g('config', '--get', 'remote.origin.url').trim(), 'https://example.test/thing.git');
    assert.equal(readRepo(sb, 'a.txt'), 'two\n', 'scrubbing the URL must not cost us the fetch');
    assert.equal(sb.events().join('\n').includes(TOKEN), false, 'the token must never reach the event log');
  });
});

// ══ install ════════════════════════════════════════════════════════════════

test('the stryker major follows the installed vitest major, which is the only pair that runs', async () => {
  // stryker 9's vitest runner requires vitest >= 3; against vitest 2 it fails at
  // startup, long after the install "succeeded".
  for (const [vitestRange, wantStryker] of [['^2.1.4', /^8\./], ['^3.0.0', /^9\./]]) {
    await withSandbox(async (sb) => {
      await sb.start();
      repoAt(sb, { scripts: { test: 'vitest run' }, devDependencies: { vitest: vitestRange } });
      fakePm(sb);

      await repo.install();

      assert.match(installed(sb, '@stryker-mutator/core').version, wantStryker, vitestRange);
      assert.match(installed(sb, '@stryker-mutator/vitest-runner').version, wantStryker, vitestRange);
    });
  }
});

test('the coverage provider is pinned to the repo\'s vitest instead of taking latest', async () => {
  // @vitest/coverage-v8 must match vitest's minor; the latest one against vitest 2
  // is a peer conflict that either refuses to install or reports no coverage at all.
  await withSandbox(async (sb) => {
    await sb.start();
    repoAt(sb, { scripts: { test: 'vitest run' }, devDependencies: { vitest: '^2.1.4' } });
    fakePm(sb);

    await repo.install();

    assert.equal(installed(sb, '@vitest/coverage-v8').version, '2.1.4');
  });
});

test('a vitest too old to be mutated stops the run before any tooling is installed', async () => {
  await withSandbox(async (sb) => {
    await sb.start();
    repoAt(sb, { scripts: { test: 'vitest run' }, devDependencies: { vitest: '^0.34.6' } });
    fakePm(sb);

    await assert.rejects(() => repo.install(), /too old/);
    assert.equal(installed(sb, '@stryker-mutator/core'), null,
      'giving up early is the point — nothing should have been added to the repo');
  });
});

test('a runner the pipeline cannot drive is named in the error, with the script that revealed it', async () => {
  await withSandbox(async (sb) => {
    await sb.start();
    repoAt(sb, { scripts: { test: 'mocha --recursive' }, devDependencies: { mocha: '^10' } });
    fakePm(sb);

    await assert.rejects(() => repo.install(), (e) => {
      assert.match(e.message, /only vitest and jest/);
      assert.match(e.message, /mocha --recursive/, 'the operator has to see what the repo actually runs');
      return true;
    });
    assert.equal(inRepo(sb, 'node_modules'), false, 'an unsupported repo must not be installed at all');
  });
});

test('tooling the repo already depends on is left at the version the repo pinned', async () => {
  // Adding it again resolves to latest and silently upgrades the repo's own stryker,
  // which then disagrees with the config the repo ships.
  await withSandbox(async (sb) => {
    await sb.start();
    repoAt(sb, {
      scripts: { test: 'vitest run' },
      devDependencies: {
        vitest: '^3.0.0', '@vitest/coverage-v8': '^3.0.1',
        '@stryker-mutator/core': '^8.2.0', '@stryker-mutator/vitest-runner': '^8.2.0',
      },
    });
    fakePm(sb);

    await repo.install();

    assert.equal(installed(sb, '@stryker-mutator/core').version, '8.2.0');
    assert.equal(installed(sb, '@stryker-mutator/vitest-runner').version, '8.2.0',
      'a runner plugin upgraded away from the core it plugs into is a stryker that will not boot');
    assert.equal(installed(sb, '@vitest/coverage-v8').version, '3.0.1');
  });
});

test('a jest repo gets the jest runner plugin and never the vitest one', async () => {
  await withSandbox(async (sb) => {
    await sb.start();
    repoAt(sb, { scripts: { test: 'jest --ci' }, devDependencies: { jest: '^29' } });
    fakePm(sb);

    const det = await repo.install();

    assert.ok(installed(sb, '@stryker-mutator/jest-runner'));
    assert.equal(installed(sb, '@stryker-mutator/vitest-runner'), null);
    assert.equal(installed(sb, '@vitest/coverage-v8'), null, 'jest brings its own coverage provider');
    assert.equal(det.testRunner, 'jest');
    assert.equal(S.state.runner.testRunner, 'jest', 'every later stage reads the runner off state');
  });
});

test('npm ci that trips over a stale lockfile falls back to a plain install', async () => {
  // A lockfile out of sync with package.json is the single most common reason a
  // target repo will not install; `npm ci` refuses, `npm install` fixes it.
  await withSandbox(async (sb) => {
    await sb.start();
    repoAt(sb, { scripts: { test: 'vitest run' }, devDependencies: { vitest: '^3.0.0' } },
      { 'package-lock.json': '{"lockfileVersion":3}' });
    fakePm(sb, { fail: (argv) => (argv[1] === 'ci' ? { stderr: 'npm ci can only install with an existing package-lock.json in sync' } : null) });

    await repo.install();

    assert.equal(installed(sb, 'vitest').version, '3.0.0');
    assert.ok(installed(sb, '@stryker-mutator/core'));
  });
});

test('a pnpm repo is installed with pnpm, which is the only tool its node_modules survives', async () => {
  await withSandbox(async (sb) => {
    await sb.start();
    repoAt(sb, { scripts: { test: 'vitest run' }, devDependencies: { vitest: '^3.0.0' } }, { 'pnpm-lock.yaml': '' });
    // npm against a pnpm store does not fail loudly in real life — it flattens the
    // symlink farm — so the fake makes it loud instead
    fakePm(sb, { fail: (argv) => (argv[0] === 'npm' ? { stderr: 'npm ran against a pnpm-managed node_modules' } : null) });

    const det = await repo.install();

    assert.equal(det.pm, 'pnpm');
    assert.equal(installed(sb, '@stryker-mutator/core').installedBy, 'pnpm');
  });
});

test('yarn classic, which has no --no-immutable, still gets its dependencies', async () => {
  await withSandbox(async (sb) => {
    await sb.start();
    repoAt(sb, { scripts: { test: 'vitest run' }, devDependencies: { vitest: '^3.0.0' } }, { 'yarn.lock': '' });
    fakePm(sb, { fail: (argv) => (argv.includes('--no-immutable') ? { stderr: 'error Unknown option "--no-immutable"' } : null) });

    await repo.install();

    assert.equal(installed(sb, 'vitest').installedBy, 'yarn');
    assert.equal(installed(sb, '@stryker-mutator/core').installedBy, 'yarn');
  });
});

test('a peer-dependency conflict on the tooling is retried leniently rather than ending the run', async () => {
  await withSandbox(async (sb) => {
    await sb.start();
    repoAt(sb, { scripts: { test: 'vitest run' }, devDependencies: { vitest: '^3.0.0' } });
    fakePm(sb, {
      fail: (argv) => (argv.includes('--no-save') && !argv.includes('--legacy-peer-deps')
        ? { stderr: 'npm ERR! ERESOLVE unable to resolve dependency tree' } : null),
    });

    await repo.install();

    assert.ok(installed(sb, '@stryker-mutator/core'), 'without the lenient retry the run ends here');
  });
});

test('a dependency install that fails reports the end of the output, where the reason is', async () => {
  // npm prints hundreds of lines of banner before the one line that says what broke;
  // keeping the head instead of the tail makes the event log useless.
  await withSandbox(async (sb) => {
    await sb.start();
    repoAt(sb, { scripts: { test: 'vitest run' }, devDependencies: { vitest: '^3.0.0' } });
    fakePm(sb, { fail: () => ({ stderr: 'BANNER-START' + 'y'.repeat(900) + 'ENOSPC: no space left on device' }) });

    await assert.rejects(() => repo.install(), (e) => {
      assert.match(e.message, /ENOSPC: no space left on device/);
      assert.equal(e.message.includes('BANNER-START'), false);
      return true;
    });
  });
});

test('the configured setup script runs, so a repo that needs a build step gets one', async () => {
  // Self-referencing imports (`import x from "my-pkg"`) resolve against build output;
  // without it every generated test fails to import the module it is testing.
  await withSandbox(async (sb) => {
    await sb.start({ setupScript: 'build' });
    repoAt(sb, { scripts: { test: 'vitest run', build: 'tsc -p .' }, devDependencies: { vitest: '^3.0.0' } });
    fakePm(sb);

    await repo.install();

    assert.equal(inRepo(sb, 'dist/build-output.js'), true);
  });
});

test('a setup script the repo does not define is skipped instead of failing the install', async () => {
  await withSandbox(async (sb) => {
    await sb.start({ setupScript: 'build' });
    repoAt(sb, { scripts: { test: 'vitest run' }, devDependencies: { vitest: '^3.0.0' } });
    fakePm(sb);

    const det = await repo.install();

    assert.equal(det.testRunner, 'vitest');
    assert.equal(inRepo(sb, 'dist/build-output.js'), false);
  });
});

test('a setup script that fails stops the run, naming the script', async () => {
  await withSandbox(async (sb) => {
    await sb.start({ setupScript: 'build' });
    repoAt(sb, { scripts: { test: 'vitest run', build: 'tsc -p .' }, devDependencies: { vitest: '^3.0.0' } });
    fakePm(sb, { fail: (argv) => (argv.includes('run') ? { stderr: 'TS2307: cannot find module' } : null) });

    await assert.rejects(() => repo.install(), (e) => {
      assert.match(e.message, /setup script "build" failed/);
      assert.match(e.message, /TS2307/);
      return true;
    });
  });
});

test('a repo shipping a stryker config is recorded as such, so ours does not replace it', async () => {
  await withSandbox(async (sb) => {
    await sb.start();
    repoAt(sb, { scripts: { test: 'vitest run' }, devDependencies: { vitest: '^3.0.0' } },
      { 'stryker.conf.json': '{"mutate":["src/**"]}' });
    fakePm(sb);

    const det = await repo.install();

    assert.equal(det.hasStrykerConfig, true);
  });
});

// ══ branch handling ════════════════════════════════════════════════════════

test('a new branch starts from the base branch, carrying nothing from the last file', async () => {
  // One branch and one PR per source file. Branching off wherever the previous file
  // left off would put its test in this file's PR — and the reviewer who rejects one
  // rejects both.
  await withSandbox(async (sb) => {
    await sb.start({ repoBranch: 'main' });
    const git = initRepo(sb.repoDir);
    sb.onCleanup(realGit(sb));
    git('checkout', '-q', '-b', 'ijst/improve-0');
    repo.writeTestFile('tests/previous.mac.test.ts', "it('the previous file', () => {});\n");
    git('add', '-A');
    git('commit', '-q', '--no-verify', '-m', 'previous file');
    repo.writeTestFile('tests/x.kill-batch-a.test.ts', "it('leftover', () => {});\n");
    writeAll(sb.repoDir, { 'node_modules/dep/index.js': 'module.exports = 1;\n' });

    await repo.createBranch('ijst/improve-1');

    assert.equal(git('rev-parse', '--abbrev-ref', 'HEAD').trim(), 'ijst/improve-1');
    assert.equal(inRepo(sb, 'tests/previous.mac.test.ts'), false, 'the previous file\'s committed test must not ride along');
    assert.equal(inRepo(sb, 'tests/x.kill-batch-a.test.ts'), false, 'nor its uncommitted leftovers');
    assert.equal(git('log', '--oneline').trim().split('\n').length, 1, 'the new branch is one commit deep — the base');
    assert.equal(inRepo(sb, 'node_modules/dep/index.js'), true, 'wiping node_modules costs a twenty-minute reinstall');
  });
});

test('discarding uncommitted work keeps the commits already made on the branch', async () => {
  // The repair loop discards a failed attempt and keeps going; if it also dropped the
  // rounds already accepted, the PR would ship empty.
  await withSandbox(async (sb) => {
    await sb.start({ repoBranch: 'main' });
    const git = initRepo(sb.repoDir);
    sb.onCleanup(realGit(sb));
    await repo.createBranch('ijst/improve-1');
    repo.writeTestFile('tests/x.mac.test.ts', "it('accepted', () => {});\n");
    git('add', '-A');
    git('commit', '-q', '--no-verify', '-m', 'round 1');

    repo.writeTestFile('tests/x.mac.test.ts', "it('broken attempt', () => {});\n");
    repo.writeTestFile('tests/x.kill-batch-b.test.ts', "it('broken attempt', () => {});\n");
    await repo.discardUncommitted();

    assert.match(readRepo(sb, 'tests/x.mac.test.ts'), /accepted/, 'the accepted round must come back intact');
    assert.equal(inRepo(sb, 'tests/x.kill-batch-b.test.ts'), false);
    assert.equal(git('rev-parse', '--abbrev-ref', 'HEAD').trim(), 'ijst/improve-1', 'the branch itself survives');
  });
});

test('resetting to base leaves the checkout on the base branch with nothing generated left', async () => {
  await withSandbox(async (sb) => {
    await sb.start({ repoBranch: 'main' });
    const git = initRepo(sb.repoDir);
    sb.onCleanup(realGit(sb));
    await repo.createBranch('ijst/improve-1');
    repo.writeTestFile('tests/x.mac.test.ts', "it('committed', () => {});\n");
    git('add', '-A');
    git('commit', '-q', '--no-verify', '-m', 'round 1');
    repo.writeTestFile('tests/x.kill-batch-b.test.ts', "it('uncommitted', () => {});\n");

    await repo.resetToBase();

    assert.equal(git('rev-parse', '--abbrev-ref', 'HEAD').trim(), 'main');
    assert.equal(inRepo(sb, 'tests/x.mac.test.ts'), false, 'the next file must start from a clean base');
    assert.equal(inRepo(sb, 'tests/x.kill-batch-b.test.ts'), false);
  });
});

// ══ which files the run is allowed to touch ════════════════════════════════

test('the scope glob is honoured brace groups and all', async () => {
  // Splitting the glob list naively on commas shreds `{ts,tsx}` into globs that match
  // nothing, and the run reports "0 candidate files" on a repo full of them.
  await withSandbox(async (sb) => {
    await sb.start({ scopeGlob: 'src/**/*.{ts,tsx}' });
    const git = initRepo(sb.repoDir);
    sb.onCleanup(realGit(sb));
    writeAll(sb.repoDir, {
      'src/a.ts': 'export const a = 1;\n',
      'src/nested/b.tsx': 'export const B = () => null;\n',
      'src/c.js': 'module.exports = 1;\n',
      'lib/d.ts': 'export const d = 1;\n',
      'README.md': '# hi\n',
    });
    git('add', '-A');

    const files = await repo.listScopeFiles();

    assert.deepEqual(files.sort(), ['src/a.ts', 'src/nested/b.tsx']);
    assert.deepEqual(Object.keys(S.state.files).sort(), ['src/a.ts', 'src/nested/b.tsx'],
      'the picker only ever sees what landed in state.files');
  });
});

test('tests, type declarations, config and vendored code are never candidates', async () => {
  // Each of these has been picked as a "file to improve" by a naive filter: a run
  // spends its whole budget writing tests for a .d.ts or for someone else's dependency.
  await withSandbox(async (sb) => {
    await sb.start();
    const git = initRepo(sb.repoDir);
    sb.onCleanup(realGit(sb));
    writeAll(sb.repoDir, {
      'src/a.ts': 'export const a = 1;\n',
      'src/a.test.ts': 'it("a", () => {});\n',
      'src/types.d.ts': 'export declare const a: number;\n',
      'src/a.test-d.ts': 'expectType<number>(a);\n',
      'vite.config.ts': 'export default {};\n',
      'tests/helper.ts': 'export const h = 1;\n',
      '__tests__/thing.ts': 'export const t = 1;\n',
      'spec/legacy.js': 'module.exports = 1;\n',
      'node_modules/dep/index.js': 'module.exports = 1;\n',
      'dist/bundle.js': 'module.exports = 1;\n',
      'coverage/lcov-report/x.js': 'module.exports = 1;\n',
      'src/logo.svg': '<svg/>\n',
    });
    git('add', '-A', '-f');

    const files = await repo.listScopeFiles();

    assert.deepEqual(files, ['src/a.ts'], `unwanted candidates got through: ${JSON.stringify(files)}`);
  });
});

test('every shape of existing test is remembered as the repo\'s own before we write anything', async () => {
  await withSandbox(async (sb) => {
    await sb.start();
    const git = initRepo(sb.repoDir);
    sb.onCleanup(realGit(sb));
    writeAll(sb.repoDir, {
      'src/a.ts': 'export const a = 1;\n',
      'test/a.spec.js': 'it("a", () => {});\n',
      'src/b.test.tsx': 'it("b", () => {});\n',
    });
    git('add', '-A');
    await repo.listScopeFiles();

    // the guard that stops a generated file from landing on top of a real one
    assert.throws(() => repo.writeTestFile('test/a.spec.js', 'it("generated", () => {});\n'), /repo-owned/);
    assert.throws(() => repo.deleteTestFile('src/b.test.tsx'), /repo-owned/);
    assert.equal(readRepo(sb, 'test/a.spec.js'), 'it("a", () => {});\n');
  });
});

// ══ reading files back ═════════════════════════════════════════════════════

test('readFileSafe truncates at the cap it was given', async () => {
  // The whole file goes into a prompt. An unbounded read on a 2 MB generated bundle
  // costs the request, and the model answers about the part that survived truncation
  // somewhere else anyway.
  await withSandbox(async (sb) => {
    await sb.start();
    repoAt(sb, {}, { 'src/big.ts': 'x'.repeat(5000) });

    assert.equal(repo.readFileSafe('src/big.ts', 100).length, 100);
    assert.equal(repo.readFileSafe('src/big.ts').length, 5000, 'the default cap must not truncate ordinary sources');
  });
});

test('a file that is not there reads as null rather than throwing', async () => {
  // Callers do `readFileSafe(p) || ''`; a throw here aborts a whole attempt because a
  // style reference the model invented does not exist.
  await withSandbox(async (sb) => {
    await sb.start();
    repoAt(sb, {});

    assert.equal(repo.readFileSafe('src/nope.ts'), null);
  });
});

test('a path that climbs out of the repo is refused', async () => {
  await withSandbox(async (sb) => {
    await sb.start();
    repoAt(sb, {});
    fs.writeFileSync(path.join(sb.dataDir, 'secret.txt'), 'token\n');

    assert.throws(() => repo.readFileSafe('../secret.txt'), /escapes repo/);
    assert.throws(() => repo.readFileSafe('src/../../secret.txt'), /escapes repo/);
  });
});

// ══ our own output, offered back for the same file ═════════════════════════

test('the bootstrap test we wrote for a file is preferred over the kill tests for it', async () => {
  // Live failure this pins: on a zod schema module the bootstrap wrote a green
  // safeParse test, guessTestPath looked for `<name>.test.ts`, found nothing, and the
  // kill prompt was handed a test from an unrelated file — every kill test then
  // invented an API that does not exist and died before it could kill anything.
  await withSandbox(async (sb) => {
    await sb.start();
    repoAt(sb, {}, {
      'src/schema.ts': 'export const s = 1;\n',
      'src/schema.kill-L4-booleanliteral-ab12.test.ts': "it('kill', () => {});\n",
      'src/schema.mac-cov.test.ts': "it('bootstrap: proven to run', () => {});\n",
      'src/other.mac.test.ts': "it('unrelated file', () => {});\n",
    });

    const ours = repo.ourTestFor('src/schema.ts');

    assert.equal(ours.path, 'src/schema.mac-cov.test.ts', 'the bootstrap is the one proven green against this module');
    assert.match(ours.content, /proven to run/);
  });
});

test('a test the repo wrote itself is never handed back as ours', async () => {
  await withSandbox(async (sb) => {
    await sb.start();
    repoAt(sb, {}, {
      'src/cart.ts': 'export const c = 1;\n',
      'src/cart.test.ts': "it('the team wrote this', () => {});\n",
    });

    assert.equal(repo.ourTestFor('src/cart.ts'), null);
  });
});

test('a guessed test folder that does not exist yet yields nothing, not a crash', async () => {
  await withSandbox(async (sb) => {
    await sb.start();
    repoAt(sb, {}, {
      'src/orders/cart.ts': 'export const c = 1;\n',
      'tests/unit/a.test.ts': "it('a', () => {});\n",
    });

    // guessTestPath mirrors into tests/unit/orders/, which nothing has created
    assert.equal(repo.ourTestFor('src/orders/cart.ts'), null);
  });
});

// ══ UI stack ═══════════════════════════════════════════════════════════════

test('each supported UI stack is matched with its own testing library', async () => {
  // The prompt names the library the model must import. Naming the wrong one produces
  // a test that cannot even resolve its imports.
  const cases = [
    [{ vue: '^3' }, { '@testing-library/vue': '^8' }, 'vue', '@testing-library/vue'],
    [{ svelte: '^4' }, { '@testing-library/svelte': '^5' }, 'svelte', '@testing-library/svelte'],
    [{ preact: '^10' }, { '@testing-library/preact': '^3' }, 'preact', '@testing-library/preact'],
    [{ react: '^17' }, { enzyme: '^3' }, 'react', 'enzyme'],
    [{ react: '^18' }, {}, 'react', null],
  ];
  for (const [deps, devDeps, framework, testingLibrary] of cases) {
    await withSandbox(async (sb) => {
      await sb.start();
      repoAt(sb, { dependencies: deps, devDependencies: devDeps });

      const ui = repo.detectUi();

      assert.equal(ui.framework, framework);
      assert.equal(ui.testingLibrary, testingLibrary, framework);
    });
  }
});
