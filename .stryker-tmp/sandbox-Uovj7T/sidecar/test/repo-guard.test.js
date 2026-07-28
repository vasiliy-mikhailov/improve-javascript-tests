// @ts-nocheck
'use strict';
// env.js MUST come before any other sidecar require — it captures DATA_DIR.
const { withSandbox, repo, setExecImpl, S } = require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// The pipeline is only ever allowed to ADD test files. Every prompt says so, but
// nothing enforced it: writeTestFile's allowlist checks that a path LOOKS like a
// test file, and a repo's own test file looks exactly like one. A model that
// echoes the style-reference path instead of the target path therefore overwrites
// a real test — and if that attempt then fails to kill its mutant, drop() deletes
// the repo's test outright.

/** Lay down a repo tree and run the enumeration that snapshots what the repo owns. */
async function repoWith(sb, files) {
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(sb.repoDir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  const restore = setExecImpl((argv) => {
    if (argv[0] === 'git' && argv[1] === 'ls-files') {
      return { code: 0, stdout: Object.keys(files).join('\n'), stderr: '', timedOut: false };
    }
    throw new Error('unexpected command in this test: ' + argv.join(' '));
  });
  sb.onCleanup(restore);
  await repo.listScopeFiles();
}

test('writeTestFile refuses to overwrite a test file the repo already owned', async () => {
  await withSandbox(async (sb) => {
    await sb.start();
    await repoWith(sb, {
      'src/pricing.ts': 'export const total = (n) => n * 2;\n',
      'test/pricing.test.ts': 'it("existing", () => {});\n',
    });

    assert.throws(
      () => repo.writeTestFile('test/pricing.test.ts', 'it("generated", () => {});\n'),
      /repo-owned|already exists|refusing/i,
      'a generated test must never be written over one the repo shipped',
    );
    assert.match(
      fs.readFileSync(path.join(sb.repoDir, 'test/pricing.test.ts'), 'utf8'),
      /existing/,
      'the original content must still be on disk',
    );
  });
});

test('deleteTestFile refuses to delete a test file the repo already owned', async () => {
  await withSandbox(async (sb) => {
    await sb.start();
    await repoWith(sb, {
      'src/pricing.ts': 'export const total = (n) => n * 2;\n',
      'test/pricing.test.ts': 'it("existing", () => {});\n',
    });

    assert.throws(
      () => repo.deleteTestFile('test/pricing.test.ts'),
      /repo-owned|refusing/i,
      'a failed attempt must not be able to delete the repo\'s own tests',
    );
    assert.ok(fs.existsSync(path.join(sb.repoDir, 'test/pricing.test.ts')), 'the file must survive');
  });
});

test('a generated test can still be overwritten and deleted — the repair loop needs that', async () => {
  await withSandbox(async (sb) => {
    await sb.start();
    await repoWith(sb, { 'src/pricing.ts': 'export const total = (n) => n * 2;\n' });

    repo.writeTestFile('test/pricing.kill-L1-arithmetic.test.ts', 'v1\n');
    repo.writeTestFile('test/pricing.kill-L1-arithmetic.test.ts', 'v2\n');
    assert.strictEqual(
      fs.readFileSync(path.join(sb.repoDir, 'test/pricing.kill-L1-arithmetic.test.ts'), 'utf8'), 'v2\n',
      'the repair turn rewrites its own file in place',
    );
    assert.strictEqual(repo.deleteTestFile('test/pricing.kill-L1-arithmetic.test.ts'), true);
  });
});

test('the repo-owned snapshot only covers tests, and survives into state', async () => {
  await withSandbox(async (sb) => {
    await sb.start();
    await repoWith(sb, {
      'src/pricing.ts': 'export const total = (n) => n * 2;\n',
      'test/pricing.test.ts': 'it("a", () => {});\n',
      'src/__tests__/util.spec.tsx': 'it("b", () => {});\n',
      'README.md': '# hi\n',
    });

    const owned = S.state.repoOwnedTests || [];
    assert.deepStrictEqual(
      [...owned].sort(),
      ['src/__tests__/util.spec.tsx', 'test/pricing.test.ts'],
      'every shape of test path the allowlist accepts must be protected',
    );
  });
});
