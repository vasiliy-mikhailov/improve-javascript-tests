'use strict';
// UNIT TESTS for the mutant queue.
//
// Until now the survivor list lived inside state.json, capped at 100 entries. On a
// file with 1000 mutants that discards 900 of them at every measurement, and nothing
// durable remembers which sites have already been tried — so a restart re-derives the
// same work and a big file can never be finished.
//
// The queue is the fix: every survivor, on disk, with the name of the test that would
// kill it and what has happened to it. Work is taken from it a group at a time, which
// is also what keeps a thousand mutants from ever reaching a prompt at once.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withSandbox, S } = require('./helpers/env');   // FIRST, always
const store = require('../mutant-store');

const surv = (n, from = 1) => Array.from({ length: n }, (_, i) => ({
  mutator: 'EqualityOperator', line: from + i, column: 3, replacement: '>=', status: 'survived',
}));

test('every survivor is kept, not the first hundred', () => withSandbox(async (sb) => {
  await sb.start();
  store.replace('src/big.ts', surv(1000));

  const all = store.all('src/big.ts');

  assert.equal(all.length, 1000, 'the cap was losing 900 mutants per measurement');
  assert.equal(store.pending('src/big.ts').length, 1000);
}));

test('the queue survives a restart, so a big file can be finished across runs',
  () => withSandbox(async (sb) => {
    await sb.start();
    store.replace('src/big.ts', surv(50));
    store.markWritten('src/big.ts', ['kills 1:3', 'kills 2:3']);

    store.forget();                       // as if the process had gone away
    const pending = store.pending('src/big.ts');

    assert.equal(store.all('src/big.ts').length, 50, 'reloaded from disk');
    assert.equal(pending.length, 48, 'and it remembers what was already written');
  }));

test('work comes out a group at a time, busiest site first', () => withSandbox(async (sb) => {
  await sb.start();
  store.replace('src/a.ts', [
    { mutator: 'A', line: 5, column: 1 },
    { mutator: 'B', line: 9, column: 2 }, { mutator: 'C', line: 9, column: 2 }, { mutator: 'D', line: 9, column: 2 },
    { mutator: 'E', line: 7, column: 3 }, { mutator: 'F', line: 7, column: 3 },
  ]);

  const batch = store.nextGroups('src/a.ts', 2);

  assert.equal(batch.length, 2, 'only what was asked for — the rest stays on disk');
  assert.deepEqual(batch.map((g) => g.mutants.length), [3, 2]);
  assert.equal(batch[0].line, 9);
}));

test('a site that has been written is not offered again', () => withSandbox(async (sb) => {
  await sb.start();
  store.replace('src/a.ts', surv(5));
  const first = store.nextGroups('src/a.ts', 2);
  store.markWritten('src/a.ts', first.map((g) => g.name));

  const second = store.nextGroups('src/a.ts', 2);

  assert.equal(second.length, 2);
  assert.equal(second.filter((g) => first.some((f) => f.name === g.name)).length, 0,
    'the same site must not come back — that is the retry the design forbids');
}));

test('a killed mutant leaves the queue; a survivor stays but is not re-offered',
  () => withSandbox(async (sb) => {
    await sb.start();
    store.replace('src/a.ts', surv(4));
    const groups = store.nextGroups('src/a.ts', 4);
    store.markWritten('src/a.ts', groups.map((g) => g.name));

    store.recordOutcome('src/a.ts', { killed: [groups[0].mutants[0], groups[1].mutants[0]] });

    assert.equal(store.alive('src/a.ts').length, 2, 'two died');
    assert.equal(store.pending('src/a.ts').length, 0, 'and nothing is pending — every site had its shot');
    const survivors = store.alive('src/a.ts');
    assert.ok(survivors.every((m) => m.written), 'the two that lived are recorded as tried');
  }));

test('re-measuring replaces the queue without forgetting what was tried', () => withSandbox(async (sb) => {
  await sb.start();
  store.replace('src/a.ts', surv(6));
  const g = store.nextGroups('src/a.ts', 3);
  store.markWritten('src/a.ts', g.map((x) => x.name));

  // a fresh Stryker run: three of the six are gone, the rest are the same mutants
  store.replace('src/a.ts', surv(6).slice(3));

  assert.equal(store.all('src/a.ts').length, 3);
  assert.equal(store.pending('src/a.ts').length, 3 - g.filter((x) => x.line >= 4).length,
    'a site already written stays written across a re-measure');
}));

test('two files keep separate queues', () => withSandbox(async (sb) => {
  await sb.start();
  store.replace('src/a.ts', surv(3));
  store.replace('src/b.ts', surv(7));
  assert.equal(store.all('src/a.ts').length, 3);
  assert.equal(store.all('src/b.ts').length, 7);
}));
