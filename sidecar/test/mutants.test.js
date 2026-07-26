'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { rank, pickNext, shortlist, buildPickRequest, resolvePick, mutantKey, sameMutant, verifyRange, rangeSpec } = require('../mutants');

const m = (over = {}) => ({ mutator: 'EqualityOperator', line: 10, column: 3, status: 'survived', replacement: '>', ...over });

test('covered survivors outrank no-coverage mutants', () => {
  const ranked = rank([
    m({ line: 50, status: 'nocoverage', mutator: 'EqualityOperator' }),
    m({ line: 10, status: 'survived', mutator: 'StringLiteral' }),
  ]);
  assert.equal(ranked[0].line, 10, 'the covered one wins even with a harder mutator');
  assert.match(ranked[0].why, /covered by tests/);
});

test('clustered survivors outrank isolated ones of the same kind', () => {
  const cluster = [m({ line: 100 }), m({ line: 102 }), m({ line: 104 }), m({ line: 106 })];
  const lonely = m({ line: 500 });
  const ranked = rank([lonely, ...cluster]);
  assert.notEqual(ranked[0].line, 500);
  assert.ok(ranked[0].neighbours >= 2);
});

test('tractable mutators outrank opaque ones, all else equal', () => {
  const ranked = rank([
    m({ line: 20, mutator: 'BlockStatement' }),
    m({ line: 40, mutator: 'EqualityOperator' }),
  ]);
  assert.equal(ranked[0].mutator, 'EqualityOperator');
});

test('repeatedly failed mutants sink and eventually drop out', () => {
  const hard = m({ line: 10 });
  const easy = m({ line: 200, mutator: 'ArithmeticOperator' });
  const attempts = { [mutantKey(hard)]: 2 };
  const ranked = rank([hard, easy], { attempts });
  assert.equal(ranked[0].line, 200);
  assert.equal(pickNext([hard], { attempts }), null, 'exhausted mutant is not picked again');
});

test('pickNext returns null when there is nothing to attack', () => {
  assert.equal(pickNext([]), null);
  assert.equal(pickNext(undefined), null);
});

test('mutant identity survives id churn between runs', () => {
  const before = { id: '1', mutator: 'EqualityOperator', line: 10, column: 3, replacement: '>' };
  const after = { id: '77', mutator: 'EqualityOperator', line: 10, column: 3, replacement: '>' };
  assert.ok(sameMutant(before, after));
  assert.ok(!sameMutant(before, { ...after, line: 11 }));
  assert.equal(mutantKey(before), mutantKey(after));
});

test('verifyRange pads around the mutant and clamps to the file', () => {
  assert.deepEqual(verifyRange({ line: 100, endLine: 104 }, { pad: 10 }), { from: 90, to: 114 });
  assert.deepEqual(verifyRange({ line: 3 }, { pad: 10 }), { from: 1, to: 13 }, 'never below line 1');
  assert.deepEqual(verifyRange({ line: 95 }, { pad: 10, fileLines: 100 }), { from: 85, to: 100 });
});

test('rangeSpec renders Stryker mutation-range syntax', () => {
  assert.equal(rangeSpec('src/foo.ts', { from: 120, to: 190 }), 'src/foo.ts:120-190');
});

test('shortlist drops exhausted mutants and caps the list', () => {
  const many = Array.from({ length: 30 }, (_, i) => m({ line: i * 3 + 1 }));
  const attempts = { [mutantKey(many[0])]: 2 };
  const short = shortlist(many, { attempts, size: 12 });
  assert.equal(short.length, 12);
  assert.ok(!short.some((x) => x.line === many[0].line), 'exhausted mutant excluded');
});

test('buildPickRequest presents numbered candidates with their coverage status', () => {
  const req = buildPickRequest([
    m({ line: 10, status: 'survived' }),
    m({ line: 20, status: 'nocoverage', mutator: 'StringLiteral' }),
  ], { file: 'src/a.ts', source: 'export const x = 1;', constraints: ['no introspection'] });
  assert.match(req.prompt, /#1 line 10/);
  assert.match(req.prompt, /#2 line 20/);
  assert.match(req.prompt, /ALREADY EXECUTED/);
  assert.match(req.prompt, /NOT COVERED/);
  assert.match(req.prompt, /no introspection/);
  assert.equal(req.json, true);
});

test('resolvePick accepts an index and rejects out-of-range answers', () => {
  const list = [m({ line: 10 }), m({ line: 20 })];
  assert.equal(resolvePick({ pick: 2, reason: 'r', killIdea: 'k' }, list).mutant.line, 20);
  assert.equal(resolvePick({ pick: 5 }, list), null);
  assert.equal(resolvePick({}, list), null);
  assert.equal(resolvePick(null, list), null);
});

test('resolvePick tolerates a line number instead of an index', () => {
  const list = [m({ line: 10 }), m({ line: 42 })];
  assert.equal(resolvePick({ pick: 42, reason: 'by line' }, list).mutant.line, 42);
});

test('the pick prompt warns off mutants that already resisted a targeted test', () => {
  const req = buildPickRequest([m({ line: 10 }), m({ line: 20 })], {
    file: 'src/a.ts', source: 'x',
    failed: [{ mutator: 'EqualityOperator', line: 10, attempts: 1 }],
  });
  assert.match(req.prompt, /ALREADY ATTEMPTED AND FAILED/);
  assert.match(req.prompt, /probably equivalent mutants/);
  assert.match(req.prompt, /EqualityOperator at line 10 \(1 failed attempt/);
});

test('no failure section when nothing has failed yet', () => {
  const req = buildPickRequest([m()], { file: 'src/a.ts', source: 'x' });
  assert.ok(!req.prompt.includes('ALREADY ATTEMPTED'));
});

test('the model cannot retire a Stryker survivor by declaring it equivalent', () => {
  // only a mutation run may remove a mutant from the queue; a refusal to pick is
  // an unusable answer, so the caller falls back to the ranked candidate
  const list = [m({ line: 10 }), m({ line: 20 })];
  assert.equal(resolvePick({ pick: null, allEquivalent: true, reason: 'looks equivalent' }, list), null);
  assert.equal(resolvePick({ pick: null, reason: 'nothing observable remains' }, list), null);
});

test('the pick prompt frames the job as ORDERING Stryker findings, not judging them', () => {
  const req = buildPickRequest([m()], { file: 'a.ts', source: 'x' });
  assert.match(req.system, /ORDERING work/);
  assert.match(req.system, /only a real mutation run can retire a mutant/);
  assert.ok(!req.system.includes('allEquivalent'));
  assert.equal(req.maxTokens, 2000, 'budget must fit a reason written without a thinking channel');
});
