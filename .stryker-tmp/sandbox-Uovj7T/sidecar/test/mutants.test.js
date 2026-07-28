// @ts-nocheck
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const mutants = require('../mutants');
const { rank, pickNext, shortlist, buildPickRequest, resolvePick, mutantKey, sameMutant, verifyRange, rangeSpec } = mutants;

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

// ── the "already failed" block in the pick prompt ───────────────────────────
//
// Found by a prompt test driving the real model. The candidate list is filtered on the
// FULL mutant key (mutator|line|column|replacement) but the prompt's failed block was
// rebuilt from mutator+line alone, so the two disagreed about what "this mutant" means.
// Stryker's EqualityOperator emits siblings at one position — `>=` becomes `>` and also
// `<` — so a still-killable sibling is described to the model, character for character,
// as the thing it must not pick.
//
// Measured 4/4 on the real endpoint when the sibling is the only candidate: the model
// picks it and believes it is RETRYING, inventing a cause ("the previous attempt failed
// likely due to floating point precision…"). That sentence becomes the killIdea, which
// kill-build-prompt splices verbatim under "HOW TO KILL IT" — so the next prompt is
// steered by a false premise about a test that was never written.

test('the failed block identifies a mutant as precisely as the filter that built the list', () => {
  const shortlist = [
    { mutator: 'EqualityOperator', line: 25, column: 16, replacement: 'w < H', status: 'survived' },
    { mutator: 'ArithmeticOperator', line: 30, column: 4, replacement: 'a - b', status: 'survived' },
  ];
  // the sibling at the same position that DID fail
  const failed = [{ mutator: 'EqualityOperator', line: 25, column: 16, replacement: 'w > H', attempts: 1 }];

  const req = buildPickRequest(shortlist, { file: 'src/a.ts', source: '', failed });

  assert.match(req.prompt, /w > H/, 'the failed sibling must be named by its replacement');
  assert.doesNotMatch(req.prompt, /EqualityOperator at line 25 \(\d+ failed attempt/,
    'a bare mutator+line ban also bans the sibling that is still on the list');
});

test('a replacement longer than the prompt budget is still valid text', () => {
  // JSON.stringify then slice cuts INSIDE the quotes, so the rendered line ends with an
  // unterminated string and the model reads a broken code fragment.
  const long = 'if (order.speed === "express" && order.weight > 20) { return base * 2; } else { return base; }'.repeat(3);
  const req = buildPickRequest([{ mutator: 'BlockStatement', line: 4, column: 1, replacement: long, status: 'survived' }],
    { file: 'src/a.ts', source: '' });

  const line = req.prompt.split('\n').find((l) => l.includes('code becomes:'));
  const rendered = line.slice(line.indexOf('code becomes:') + 13).trim();
  assert.ok(rendered.startsWith('"'), 'precondition: it is a quoted string');
  assert.ok(rendered.endsWith('"') || rendered.endsWith('…"'),
    `an unterminated quote reads as broken code: ${rendered.slice(-40)}`);
});

test('an answer that is a line number is not read as an index', () => {
  // 12 candidates and {"pick": 8} meaning "line 8" silently resolves to candidate #8,
  // which sits at line 47. The two readings are indistinguishable unless the index
  // reading is checked against what the model said it was pointing at.
  const shortlist = Array.from({ length: 12 }, (_, i) => ({
    mutator: 'BooleanLiteral', line: (i + 1) * 4, column: 2, replacement: 'false', status: 'survived',
  }));

  const r = resolvePick({ pick: 8, line: 8, reason: 'the guard at line 8', killIdea: 'x' }, shortlist);

  assert.equal(r.mutant.line, 8, 'the answer named a line, and one candidate is at that line');
});

// ── attribution: which test killed which mutant ────────────────────────────
//
// Stryker's report carries killedBy (test ids) and a testFiles map, so ONE mutation run
// says both what died and which file did it. That is what makes a sweep possible: write
// many tests, verify once, keep the ones that earned their place.

test('a report maps every kill back to the test file that made it', () => {
  const report = {
    testFiles: {
      'test/a.mac.test.ts': { tests: [{ id: '0', name: 'kills the boundary' }, { id: '1', name: 'sums' }] },
      'test/b.kill.test.ts': { tests: [{ id: '2', name: 'rejects empty' }] },
    },
    files: {
      'src/a.ts': {
        mutants: [
          { id: 'm1', mutatorName: 'EqualityOperator', status: 'Killed', killedBy: ['0'], location: { start: { line: 4, column: 3 } } },
          { id: 'm2', mutatorName: 'BooleanLiteral', status: 'Killed', killedBy: ['2'], location: { start: { line: 9, column: 1 } } },
          { id: 'm3', mutatorName: 'StringLiteral', status: 'Survived', location: { start: { line: 12, column: 2 } } },
        ],
      },
    },
  };

  const byFile = mutants.killsByTestFile(report);

  assert.equal(byFile['test/a.mac.test.ts'], 1);
  assert.equal(byFile['test/b.kill.test.ts'], 1);
  assert.equal(byFile['test/never-killed.test.ts'], undefined);
});

test('a test file that killed nothing is visible as such, not merely absent', () => {
  const report = {
    testFiles: {
      'test/useful.test.ts': { tests: [{ id: '0' }] },
      'test/dead-weight.test.ts': { tests: [{ id: '1' }, { id: '2' }] },
    },
    files: { 'src/a.ts': { mutants: [{ id: 'm1', status: 'Killed', killedBy: ['0'], location: { start: { line: 1, column: 1 } } }] } },
  };

  const byFile = mutants.killsByTestFile(report);

  assert.equal(byFile['test/useful.test.ts'], 1);
  assert.equal(byFile['test/dead-weight.test.ts'], 0,
    'a file Stryker ran and that killed nothing must report 0, so it can be dropped');
});

test('a timeout counts as a kill for attribution, exactly as it does for the score', () => {
  const report = {
    testFiles: { 'test/slow.test.ts': { tests: [{ id: '7' }] } },
    files: { 'src/a.ts': { mutants: [
      { id: 'm1', status: 'Timeout', killedBy: ['7'], location: { start: { line: 3, column: 1 } } },
    ] } },
  };
  assert.equal(mutants.killsByTestFile(report)['test/slow.test.ts'], 1);
});

// ── the fast filter: what NOT to write ─────────────────────────────────────
//
// A thousand mutants at ~100 tokens each is hours of generation. The name of the test
// that would kill a mutant is derivable from the mutant, so the question "does that
// test already exist?" costs nothing and is asked BEFORE any model call.

test('mutants at one site share a test name, because one test kills them all', () => {
  const site = { line: 8, column: 7, status: 'survived' };
  const names = [
    mutants.testNameFor({ ...site, mutator: 'EqualityOperator', replacement: 'n > 10' }),
    mutants.testNameFor({ ...site, mutator: 'EqualityOperator', replacement: 'n < 10' }),
    mutants.testNameFor({ ...site, mutator: 'EqualityOperator', replacement: 'n === 10' }),
  ];
  assert.equal(new Set(names).size, 1, 'one boundary test kills all three, so one name');
  assert.notEqual(mutants.testNameFor({ line: 8, column: 40, mutator: 'StringLiteral' }), names[0],
    'a different site on the same line is a different test');
});

test('grouping puts the busiest site first — one test there retires the most', () => {
  const surv = [
    { mutator: 'A', line: 5, column: 1 },
    { mutator: 'B', line: 9, column: 2 }, { mutator: 'C', line: 9, column: 2 }, { mutator: 'D', line: 9, column: 2 },
    { mutator: 'E', line: 7, column: 3 }, { mutator: 'F', line: 7, column: 3 },
  ];
  const g = mutants.groupByTestName(surv);
  assert.deepEqual(g.map((x) => x.mutants.length), [3, 2, 1]);
  assert.equal(g[0].line, 9);
  assert.equal(g.length, 3, 'six mutants, three tests to write');
});

test('a group whose test already exists is never sent to the model', () => {
  const groups = mutants.groupByTestName([
    { mutator: 'A', line: 4, column: 1 }, { mutator: 'B', line: 12, column: 6 },
  ]);
  const existing = [
    "import { it } from 'vitest';\nit('kills 4:1 — boundary at the floor', () => {});\n",
  ];

  const todo = mutants.unwrittenGroups(groups, existing);

  assert.equal(todo.length, 1);
  assert.equal(todo[0].line, 12, 'only the site with no test yet');
});

test('with no existing tests every group is work', () => {
  const groups = mutants.groupByTestName([{ mutator: 'A', line: 4, column: 1 }]);
  assert.equal(mutants.unwrittenGroups(groups, []).length, 1);
  assert.equal(mutants.unwrittenGroups(groups, ['it("something else", () => {})']).length, 1);
});
