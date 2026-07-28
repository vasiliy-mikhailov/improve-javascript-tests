'use strict';
// UNIT TESTS for the mutation-report parser — production's, not the fake's.
//
// The fake mirrored `survivedAll` field for field, including the field it was missing,
// so every test agreed with production about a shape that was wrong. `survivedAll` is
// what fills the durable queue, and it dropped `status`; the sweep prompt's branch for
// an uncovered site ("this test must reach the code first") could therefore never fire,
// and every no-coverage site was described to the model as already covered.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withSandbox, stryker } = require('./helpers/env');
const { parseReport } = stryker;
const fs = require('node:fs');
const path = require('node:path');

const mutant = (id, status, over = {}) => ({
  id, mutatorName: 'BooleanLiteral', replacement: 'false', status,
  location: { start: { line: over.line ?? 10, column: over.column ?? 4 }, end: { line: over.line ?? 10, column: 20 } },
  ...over,
});

function reportAt(dir, mutants) {
  const p = path.join(dir, 'mutation.json');
  fs.writeFileSync(p, JSON.stringify({ schemaVersion: '1.0', files: { 'src/a.ts': { mutants } } }));
  return p;
}

test('a survivor keeps the status that says whether any test even reaches it',
  () => withSandbox(async (sb) => {
    await sb.start();
    const p = reportAt(sb.dataDir, [
      mutant(1, 'Survived', { line: 10 }),
      mutant(2, 'NoCoverage', { line: 20 }),
      mutant(3, 'Killed', { line: 30 }),
    ]);
    const r = parseReport(p, 'src/a.ts');

    assert.deepEqual(r.survivedAll.map((m) => [m.line, m.status]), [[10, 'survived'], [20, 'nocoverage']],
      'the queue is built from this list, and a nocoverage site needs a test that REACHES the code');
    assert.equal(r.killed, 1);
    assert.equal(r.totalMutants, 3);
  }));

test('a compile error is neither killed nor a survivor to write tests for',
  () => withSandbox(async (sb) => {
    await sb.start();
    const p = reportAt(sb.dataDir, [mutant(1, 'CompileError'), mutant(2, 'Survived', { line: 12 })]);
    const r = parseReport(p, 'src/a.ts');
    assert.equal(r.totalMutants, 1, 'stryker excludes compile errors from the denominator');
    assert.deepEqual(r.survivedAll.map((m) => m.line), [12]);
  }));

test('a timeout counts as a kill, which is Stryker\'s definition and not ours',
  () => withSandbox(async (sb) => {
    await sb.start();
    const p = reportAt(sb.dataDir, [mutant(1, 'Timeout'), mutant(2, 'Survived', { line: 12 })]);
    const r = parseReport(p, 'src/a.ts');
    assert.equal(r.killed, 1);
    assert.equal(r.timedOut, 1);
    assert.equal(r.score, 50);
  }));
