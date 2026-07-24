'use strict';
// Repo lifecycle: clone, install, detect runner, branches, file access.
const fs = require('node:fs');
const path = require('node:path');
const { run } = require('./exec');
const { state, event, upsertFile, DATA_DIR } = require('./state');
const { slugify, globsToMatcher } = require('./util');

function repoDir() {
  const cfg = state.run?.config;
  if (!cfg?.repoUrl) throw new Error('no run started / REPO_URL missing');
  return path.join(DATA_DIR, 'repos', slugify(cfg.repoUrl));
}

function authUrl(url) {
  const tok = process.env.GH_TOKEN;
  if (tok && /^https:\/\/github\.com\//.test(url)) {
    return url.replace('https://', `https://x-access-token:${tok}@`);
  }
  return url;
}

async function clone() {
  const cfg = state.run.config;
  const dir = repoDir();
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  if (fs.existsSync(path.join(dir, '.git'))) {
    event('cloning', 'repo exists, fetching latest');
    let r = await run(['git', 'fetch', 'origin', cfg.repoBranch], { cwd: dir, timeoutMs: 300000, label: 'git fetch' });
    if (r.code !== 0) throw new Error('git fetch failed: ' + r.stderr.slice(-400));
    await run(['git', 'checkout', '-f', cfg.repoBranch], { cwd: dir, timeoutMs: 60000 });
    await run(['git', 'reset', '--hard', `origin/${cfg.repoBranch}`], { cwd: dir, timeoutMs: 60000 });
    await run(['git', 'clean', '-fd', '-e', 'node_modules'], { cwd: dir, timeoutMs: 60000 });
  } else {
    event('cloning', `cloning ${cfg.repoUrl} (branch ${cfg.repoBranch})`);
    const r = await run(['git', 'clone', '--branch', cfg.repoBranch, '--single-branch',
      authUrl(cfg.repoUrl), dir], { timeoutMs: 600000, label: 'git clone' });
    if (r.code !== 0) throw new Error('git clone failed: ' + r.stderr.slice(-400));
  }
  const head = await run(['git', 'rev-parse', 'HEAD'], { cwd: dir, timeoutMs: 10000 });
  event('cloning', 'repo ready at ' + head.stdout.trim().slice(0, 12));
  return { dir, head: head.stdout.trim() };
}

function readPkg() {
  try { return JSON.parse(fs.readFileSync(path.join(repoDir(), 'package.json'), 'utf8')); }
  catch { return {}; }
}

function detectRunner() {
  const pkg = readPkg();
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const testScript = pkg.scripts?.test || '';
  let testRunner = null;
  if (deps.vitest || /\bvitest\b/.test(testScript)) testRunner = 'vitest';
  else if (deps.jest || /\bjest\b/.test(testScript)) testRunner = 'jest';
  const dir = repoDir();
  const pm = fs.existsSync(path.join(dir, 'pnpm-lock.yaml')) ? 'pnpm'
    : fs.existsSync(path.join(dir, 'yarn.lock')) ? 'yarn' : 'npm';
  const hasStrykerConfig = ['stryker.config.mjs', 'stryker.config.js', 'stryker.config.json', 'stryker.conf.js', 'stryker.conf.json']
    .some((f) => fs.existsSync(path.join(dir, f)));
  return { pm, testRunner, hasStrykerConfig, testScript };
}

async function install() {
  const dir = repoDir();
  const det = detectRunner();
  if (!det.testRunner) throw new Error('unsupported test runner: only vitest and jest are supported (test script: "' + det.testScript + '")');
  let r;
  if (det.pm === 'pnpm') {
    await run(['corepack', 'enable', 'pnpm'], { cwd: dir, timeoutMs: 60000 });
    r = await run(['corepack', 'pnpm', 'install', '--no-frozen-lockfile'], { cwd: dir, timeoutMs: 1200000, label: 'pnpm install' });
  } else if (det.pm === 'yarn') {
    await run(['corepack', 'enable', 'yarn'], { cwd: dir, timeoutMs: 60000 });
    r = await run(['corepack', 'yarn', 'install', '--no-immutable'], { cwd: dir, timeoutMs: 1200000, label: 'yarn install' });
    if (r.code !== 0) r = await run(['corepack', 'yarn', 'install'], { cwd: dir, timeoutMs: 1200000, label: 'yarn install' });
  } else {
    const hasLock = fs.existsSync(path.join(dir, 'package-lock.json'));
    r = await run(['npm', hasLock ? 'ci' : 'install', '--no-audit', '--no-fund'], { cwd: dir, timeoutMs: 1200000, label: 'npm install' });
    if (r.code !== 0 && hasLock) r = await run(['npm', 'install', '--no-audit', '--no-fund'], { cwd: dir, timeoutMs: 1200000, label: 'npm install' });
  }
  if (r.code !== 0) throw new Error('dependency install failed: ' + (r.stderr || r.stdout).slice(-500));

  // Extra tooling: coverage provider for vitest, stryker core + runner plugin.
  const pkg = readPkg();
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const extras = [];
  if (det.testRunner === 'vitest' && !deps['@vitest/coverage-v8']) {
    // pin coverage provider to installed vitest major/minor to avoid peer clashes
    const v = String(deps.vitest || '').replace(/^[^0-9]*/, '');
    extras.push('@vitest/coverage-v8@' + (v ? '~' + v : 'latest'));
  }
  // stryker major must match the installed vitest major: stryker 9 needs vitest>=3,
  // stryker 8 supports vitest 1-2
  let strykerVer = '';
  if (det.testRunner === 'vitest') {
    try {
      const v = JSON.parse(fs.readFileSync(path.join(dir, 'node_modules', 'vitest', 'package.json'), 'utf8')).version;
      const major = parseInt(v.split('.')[0], 10);
      if (major < 1) throw new Error(`vitest ${v} is too old for mutation testing (need >= 1.0)`);
      strykerVer = major < 3 ? '@8' : '';
      event('installing', `vitest ${v} detected → stryker${strykerVer || ' latest'}`);
    } catch (e) { if (/too old/.test(e.message)) throw e; }
  }
  if (!deps['@stryker-mutator/core']) extras.push('@stryker-mutator/core' + strykerVer);
  const plugin = det.testRunner === 'vitest' ? '@stryker-mutator/vitest-runner' : '@stryker-mutator/jest-runner';
  if (!deps[plugin]) extras.push(plugin + strykerVer);
  if (extras.length) {
    event('installing', 'adding tooling via ' + det.pm + ': ' + extras.join(', '));
    // use the repo's own package manager — npm corrupts pnpm/yarn-managed node_modules
    let argv;
    if (det.pm === 'pnpm') argv = ['corepack', 'pnpm', 'add', '-D', ...extras];
    else if (det.pm === 'yarn') argv = ['corepack', 'yarn', 'add', '-D', ...extras];
    else argv = ['npm', 'install', '--no-save', '--no-audit', '--no-fund', ...extras];
    let r2 = await run(argv, { cwd: dir, timeoutMs: 900000, label: 'tooling install' });
    if (r2.code !== 0 && argv[0] === 'npm') {
      // peer conflicts: retry lenient (NOT default — legacy mode prunes auto-installed peers)
      r2 = await run([...argv, '--legacy-peer-deps'], { cwd: dir, timeoutMs: 900000, label: 'tooling install (legacy peers)' });
    }
    if (r2.code !== 0) throw new Error('tooling install failed: ' + (r2.stderr || r2.stdout).slice(-500));
  }
  // optional post-install setup (e.g. build step so self-referencing imports resolve)
  const setupScript = state.run?.config?.setupScript;
  if (setupScript && pkg.scripts?.[setupScript]) {
    event('installing', `running setup script: ${det.pm} run ${setupScript}`);
    const pmRun = det.pm === 'npm' ? ['npm', 'run'] : ['corepack', det.pm, 'run'];
    const r3 = await run([...pmRun, setupScript], { cwd: dir, timeoutMs: 900000, label: 'setup ' + setupScript });
    if (r3.code !== 0) throw new Error(`setup script "${setupScript}" failed: ` + (r3.stderr || r3.stdout).slice(-500));
  }
  state.runner = det;
  event('installing', `deps ready (pm=${det.pm}, runner=${det.testRunner}, strykerConfig=${det.hasStrykerConfig})`);
  return det;
}

async function listScopeFiles() {
  const dir = repoDir();
  const cfg = state.run.config;
  const r = await run(['git', 'ls-files'], { cwd: dir, timeoutMs: 30000 });
  if (r.code !== 0) throw new Error('git ls-files failed');
  const match = globsToMatcher(cfg.scopeGlob);
  const isTest = (p) => /(^|\/)(tests?|__tests__|__mocks__|spec)\//.test(p) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(p);
  const files = r.stdout.split('\n').map((s) => s.trim()).filter(Boolean)
    .filter((p) => /\.[cm]?[jt]sx?$/.test(p))
    .filter((p) => !/\.d\.[cm]?ts$/.test(p) && !/\.test-d\./.test(p) && !/\.config\.[cm]?[jt]s$/.test(p))
    .filter((p) => !isTest(p))
    .filter((p) => !/(^|\/)(node_modules|dist|build|coverage|\.stryker-tmp)\//.test(p))
    .filter(match);
  for (const p of files) upsertFile(p, {});
  return files;
}

async function createBranch(name) {
  const dir = repoDir();
  const cfg = state.run.config;
  await run(['git', 'checkout', '-f', cfg.repoBranch], { cwd: dir, timeoutMs: 60000 });
  await run(['git', 'clean', '-fd', '-e', 'node_modules'], { cwd: dir, timeoutMs: 60000 });
  const r = await run(['git', 'checkout', '-B', name, cfg.repoBranch], { cwd: dir, timeoutMs: 60000 });
  if (r.code !== 0) throw new Error('branch create failed: ' + r.stderr.slice(-300));
  event('branching', 'working on branch ' + name);
  return name;
}

/** Discard uncommitted changes on the current branch, keeping its commits. */
async function discardUncommitted() {
  const dir = repoDir();
  await run(['git', 'checkout', '--', '.'], { cwd: dir, timeoutMs: 60000 });
  await run(['git', 'clean', '-fd', '-e', 'node_modules'], { cwd: dir, timeoutMs: 60000 });
}

async function resetToBase() {
  const dir = repoDir();
  const cfg = state.run.config;
  await run(['git', 'checkout', '-f', cfg.repoBranch], { cwd: dir, timeoutMs: 60000 });
  await run(['git', 'clean', '-fd', '-e', 'node_modules'], { cwd: dir, timeoutMs: 60000 });
}

function readFileSafe(rel, maxLen = 200000) {
  const dir = repoDir();
  const abs = path.resolve(dir, rel);
  if (!abs.startsWith(dir + path.sep)) throw new Error('path escapes repo');
  try { return fs.readFileSync(abs, 'utf8').slice(0, maxLen); } catch { return null; }
}

const TEST_PATH_RE = /((^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$)/;

function writeTestFile(rel, content) {
  if (!TEST_PATH_RE.test(rel)) throw new Error('refusing to write outside test locations: ' + rel);
  if (!/\.[cm]?[jt]sx?$/.test(rel)) throw new Error('test file must be a js/ts file');
  const dir = repoDir();
  const abs = path.resolve(dir, rel);
  if (!abs.startsWith(dir + path.sep)) throw new Error('path escapes repo');
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return { path: rel, bytes: Buffer.byteLength(content) };
}

function deleteTestFile(rel) {
  if (!TEST_PATH_RE.test(rel)) throw new Error('refusing to delete outside test locations');
  const dir = repoDir();
  const abs = path.resolve(dir, rel);
  if (!abs.startsWith(dir + path.sep)) throw new Error('path escapes repo');
  try { fs.unlinkSync(abs); return true; } catch { return false; }
}

/** Count existing test files per directory (repo-relative), skipping node_modules. */
function testDirCounts() {
  const dir = repoDir();
  const counts = {};
  const walk = (d, depth) => {
    if (depth > 5) return;
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      if (ent.name === 'node_modules' || ent.name.startsWith('.') || ent.name === 'dist' || ent.name === 'coverage') continue;
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p, depth + 1);
      else if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(ent.name)) {
        const rel = path.relative(dir, path.dirname(p)).split(path.sep).join('/');
        counts[rel] = (counts[rel] || 0) + 1;
      }
    }
  };
  walk(dir, 0);
  return counts;
}

/** Guess where a test for `srcRel` should live, following existing repo conventions. */
function guessTestPath(srcRel) {
  const dir = repoDir();
  const ext = srcRel.match(/\.[cm]?[jt]sx?$/)?.[0] || '.ts';
  const base = path.basename(srcRel).replace(/\.[cm]?[jt]sx?$/, '');
  const srcDir = path.dirname(srcRel);
  const srcSansRoot = srcRel.replace(/^(src|lib|app)\//, '');
  const candidates = [
    path.join(srcDir, `${base}.test${ext}`),
    path.join(srcDir, '__tests__', `${base}.test${ext}`),
    path.join('test', `${base}.test${ext}`),
    path.join('tests', `${base}.test${ext}`),
    path.join('tests', 'unit', srcSansRoot.replace(/\.[cm]?[jt]sx?$/, `.test${ext}`)),
  ];
  for (const c of candidates) if (fs.existsSync(path.join(dir, c))) return { path: c, exists: true };
  // No test for this file yet: mirror the DOMINANT existing convention so new
  // tests actually match the runner's include patterns (e.g. tests/unit/**).
  const counts = testDirCounts();
  const dirs = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (dirs.length) {
    const top = dirs[0][0]; // e.g. "tests/unit/surveys" or "test" or "src/__tests__"
    const segs = top.split('/');
    let root;
    if (segs.includes('__tests__')) {
      return { path: path.join(srcDir, '__tests__', `${base}.test${ext}`), exists: false };
    }
    // root = leading segments that look like test roots ("test", "tests", "tests/unit", "src/test"...)
    const idx = segs.findIndex((s) => /^(tests?|spec|unit|integration)$/.test(s));
    if (idx !== -1) {
      root = segs.slice(0, idx + 1).join('/');
      if (/^(unit|integration)$/.test(segs[idx + 1] || '')) root += '/' + segs[idx + 1];
      const mirrored = path.join(root, path.dirname(srcSansRoot), `${base}.test${ext}`);
      return { path: mirrored, exists: false };
    }
    // tests colocated with sources
    return { path: path.join(srcDir, `${base}.test${ext}`), exists: false };
  }
  return { path: candidates[0], exists: false };
}

module.exports = {
  repoDir, clone, install, detectRunner, listScopeFiles, createBranch, resetToBase, discardUncommitted,
  readFileSafe, writeTestFile, deleteTestFile, guessTestPath, readPkg,
};
