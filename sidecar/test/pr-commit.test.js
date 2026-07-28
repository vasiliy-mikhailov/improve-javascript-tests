'use strict';
// UNIT TESTS for what actually lands in a commit — against a REAL git repository.
//
// Every other test fakes pr.commit, which is why a real defect walked straight through
// the suite: consolidation merged five files into one, logged success, and the commit
// it made contained none of that. The merge is verified by re-measurement, the file is
// written, the event is logged — and the single step that makes any of it real was
// never asserted anywhere.
//
// So this file lets git run. It is the only place in the unit suite that does, and it
// is deliberately narrow: one throwaway repo per test, no network, no remote.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withSandbox, setExecImpl, pr, repo, S } = require('./helpers/env');   // FIRST, always
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

/** Let the sidecar's exec run for real, inside the sandbox repo only. */
function realGit(sb) {
  return setExecImpl((argv, opts = {}) => {
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
  fs.writeFileSync(path.join(dir, 'package.json'), '{"name":"fixture"}');
  git('add', '-A');
  git('commit', '-q', '--no-verify', '-m', 'base');
  return git;
}

const tracked = (dir) => execFileSync('git', ['ls-tree', '-r', '--name-only', 'HEAD'], { cwd: dir, encoding: 'utf8' })
  .split('\n').filter(Boolean);

test('a commit contains the files that are on disk, additions and deletions alike',
  () => withSandbox(async (sb) => {
    await sb.start({ prBase: 'main' });
    const git = initRepo(sb.repoDir);
    sb.onCleanup(realGit(sb));

    // five generated tests, committed the way an accepted round commits them
    for (const n of ['a', 'b', 'c', 'd', 'e']) {
      repo.writeTestFile(`tests/x.kill-batch-${n}.test.ts`, `it('${n}', () => {});\n`);
    }
    await pr.commit('round 1');
    assert.equal(tracked(sb.repoDir).filter((p) => p.includes('kill-batch')).length, 5);

    // now the fold: five files replaced by one
    for (const n of ['a', 'b', 'c', 'd', 'e']) repo.deleteTestFile(`tests/x.kill-batch-${n}.test.ts`);
    repo.writeTestFile('tests/x.mac.test.ts', "it('merged', () => {});\n");
    await pr.commit('fold generated tests into one file');

    const now = tracked(sb.repoDir).filter((p) => p.startsWith('tests/'));
    assert.deepEqual(now, ['tests/x.mac.test.ts'],
      `the fold must reach the commit — HEAD still holds ${JSON.stringify(now)}`);
  }));

test('a deletion on its own is committed, not silently skipped', () => withSandbox(async (sb) => {
  // the prune deletes a test the mutation run credits with nothing, and that deletion
  // has to land or the PR ships a file we decided was dead weight
  await sb.start({ prBase: 'main' });
  initRepo(sb.repoDir);
  sb.onCleanup(realGit(sb));
  repo.writeTestFile('tests/x.kill-batch-a.test.ts', "it('a', () => {});\n");
  repo.writeTestFile('tests/x.kill-batch-b.test.ts', "it('b', () => {});\n");
  await pr.commit('round 1');

  repo.deleteTestFile('tests/x.kill-batch-b.test.ts');
  await pr.commit('drop what earned nothing');

  assert.deepEqual(tracked(sb.repoDir).filter((p) => p.startsWith('tests/')), ['tests/x.kill-batch-a.test.ts']);
}));

test('pipeline artifacts are never committed, whatever else changed', () => withSandbox(async (sb) => {
  await sb.start({ prBase: 'main' });
  initRepo(sb.repoDir);
  sb.onCleanup(realGit(sb));
  repo.writeTestFile('tests/x.kill-batch-a.test.ts', "it('a', () => {});\n");
  fs.writeFileSync(path.join(sb.repoDir, '.ijst-stryker.config.json'), '{}');
  fs.mkdirSync(path.join(sb.repoDir, 'reports/mutation'), { recursive: true });
  fs.writeFileSync(path.join(sb.repoDir, 'reports/mutation/mutation.json'), '{}');

  await pr.commit('round 1');

  const files = tracked(sb.repoDir);
  assert.ok(files.includes('tests/x.kill-batch-a.test.ts'));
  assert.ok(!files.some((p) => p.startsWith('reports/') || p.startsWith('.ijst-')),
    `artifacts leaked into the commit: ${JSON.stringify(files)}`);
}));
