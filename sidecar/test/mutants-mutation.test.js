'use strict';
// Assertions for sidecar/mutants.js written against surviving Stryker mutants.
//
// Every line of mutants.js already runs under the suite; what was missing was anyone
// looking at what it produced. Each case below names the observable difference one
// mutation makes — a boundary that moves, a clause that vanishes from a prompt, a
// crash where an empty result belongs.

const { mutants } = require('./helpers/env');   // FIRST: temp DATA_DIR before any sidecar module
const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  rank, pickNext, shortlist, buildPickRequest, resolvePick, mutantKey, sameMutant,
  verifyRange, killsByTestFile, testNameFor, groupByTestName, unwrittenGroups,
} = mutants;

const m = (over = {}) => ({ mutator: 'EqualityOperator', line: 10, column: 3, status: 'survived', replacement: '>', ...over });

// ── how a replacement is rendered into the prompt ──────────────────────────
//
// The model reads the mutated code as a quoted string. It is the only place the prompt
// shows what the mutant actually does, so both the budget and the quoting matter.

/** The `code becomes:` value the prompt shows for one candidate, decoded back from JSON. */
function renderedReplacement(replacement) {
  const req = buildPickRequest([{ mutator: 'BlockStatement', line: 1, column: 1, status: 'survived', replacement }],
    { file: 'a.js', source: '' });
  const row = req.prompt.split('\n').find((l) => l.includes('code becomes:'));
  return JSON.parse(row.slice(row.indexOf('code becomes:') + 'code becomes:'.length).trim());
}

test('a replacement of exactly the budget length is shown whole', () => {
  // 118 is the cut-off and the comparison is strict: at `>=` every replacement that
  // just fits loses its last character and gains a misleading ellipsis.
  const exact = 'a'.repeat(118);
  assert.equal(renderedReplacement(exact), exact);
});

test('a replacement over the budget is cut to 118 characters plus an ellipsis', () => {
  assert.equal(renderedReplacement('a'.repeat(200)), 'a'.repeat(118) + '…');
});

test('a mutant with no replacement renders as an empty string, not the word undefined', () => {
  // Stryker omits `replacement` for some mutators; String(undefined) would put the word
  // "undefined" in the prompt as if that were the code the mutation produces.
  assert.equal(renderedReplacement(undefined), '');
});

// ── mutant identity ────────────────────────────────────────────────────────

test('a mutant key spells out mutator, line, column and replacement', () => {
  // The key is what an attempts map is filed under. Every field has to be in it and the
  // separator has to survive, or two different mutants share one attempt count and the
  // second one is retired without ever being tried.
  assert.equal(mutantKey({ mutator: 'EqualityOperator', line: 10, column: 3, replacement: '>' }),
    'EqualityOperator|10|3|>');
  assert.equal(mutantKey({ mutator: 'EqualityOperator', line: 10 }), 'EqualityOperator|10||',
    'a missing column or replacement is an empty field, not the string "undefined"');
});

test('mutants differing in one field alone get different keys', () => {
  const base = { mutator: 'EqualityOperator', line: 10, column: 3, replacement: '>' };
  assert.notEqual(mutantKey(base), mutantKey({ ...base, column: 40 }));
  assert.notEqual(mutantKey(base), mutantKey({ ...base, replacement: '<' }));
  assert.notEqual(mutantKey(base), mutantKey({ ...base, mutator: 'RelationalOperator' }));
  assert.notEqual(mutantKey(base), mutantKey({ ...base, line: 11 }));
});

test('two replacements agreeing for sixty characters are one key', () => {
  // A replacement can be a whole mutated block. The key is bounded so it stays usable as
  // a map key; the first sixty characters are what identity is built on.
  const head = 'x'.repeat(60);
  assert.equal(mutantKey({ mutator: 'BlockStatement', line: 4, column: 1, replacement: head + 'AAAA' }),
    mutantKey({ mutator: 'BlockStatement', line: 4, column: 1, replacement: head + 'ZZZZ' }));
});

test('a missing mutant is never the same as anything, including another missing one', () => {
  // sameMutant is handed the result of a lookup that can come back empty; without the
  // guard it dereferences null and takes the run down mid-verification.
  assert.equal(sameMutant(null, m()), false);
  assert.equal(sameMutant(m(), undefined), false);
  assert.equal(sameMutant(null, null), false);
});

test('one side knowing its column does not make two mutants different', () => {
  // Some report shapes carry no column. A missing column is unknown, not a mismatch, so
  // it must not veto identity — whichever side is missing it — while two columns both
  // sides know must still be compared.
  assert.ok(sameMutant({ mutator: 'A', line: 5, replacement: 'x' },
    { mutator: 'A', line: 5, column: 9, replacement: 'x' }));
  assert.ok(sameMutant({ mutator: 'A', line: 5, column: 9, replacement: 'x' },
    { mutator: 'A', line: 5, replacement: 'x' }));
  assert.ok(!sameMutant({ mutator: 'A', line: 5, column: 2, replacement: 'x' },
    { mutator: 'A', line: 5, column: 9, replacement: 'x' }),
  'two columns that are both known and differ are two mutants');
});

test('two mutators at one position are two mutants', () => {
  // A ConditionalExpression and an EqualityOperator can share a line and column; taking
  // them for one mutant retires the second the moment the first is attempted.
  assert.ok(!sameMutant({ mutator: 'ConditionalExpression', line: 5, column: 2, replacement: 'true' },
    { mutator: 'EqualityOperator', line: 5, column: 2, replacement: 'true' }));
});

test('the same position with a different replacement is a different mutant', () => {
  // Stryker emits siblings at one position (`>=` becomes `>` and also `<`). Collapsing
  // them bans a still-killable sibling from ever being picked again.
  assert.ok(!sameMutant(m({ replacement: '>' }), m({ replacement: '<' })));
});

test('replacements agreeing for sixty characters are the same mutant', () => {
  const head = 'y'.repeat(60);
  assert.ok(sameMutant({ mutator: 'B', line: 3, column: 1, replacement: head + '111' },
    { mutator: 'B', line: 3, column: 1, replacement: head + '222' }));
});

// ── ranking ────────────────────────────────────────────────────────────────

test('entries with no line, and holes in the list, are dropped rather than crashing', () => {
  // Survivor lists are assembled from report JSON that has been merged across runs; a
  // null entry, or one Stryker gave no location, is the difference between a ranked
  // list and a TypeError in the middle of a round.
  const ranked = rank([null, undefined, { mutator: 'EqualityOperator', status: 'survived' }, m({ line: 5 })]);
  assert.equal(ranked.length, 1);
  assert.equal(ranked[0].line, 5);
});

test('a survivor eight lines away is a neighbour and nine lines away is not', () => {
  // NEIGHBOUR_WINDOW is 8 and the comparison is inclusive. A window that quietly shrank
  // to 7 would stop clustering exactly the sites that fall together.
  assert.equal(rank([m({ line: 100 }), m({ line: 108 })])[0].neighbours, 1);
  assert.equal(rank([m({ line: 100 }), m({ line: 109 })])[0].neighbours, 0);
});

test('the cluster bonus is capped, so it cannot swamp the other signals', () => {
  // The bonus is min(neighbours, 10) * 4. Turned into max it becomes a flat 40 for
  // everyone — including a mutant with no neighbours at all — and clustering stops
  // meaning anything; divided instead of multiplied it stops mattering at all.
  const isolated = m({ line: 1000, mutator: 'EqualityOperator' });
  const cluster = [100, 102, 104, 106].map((line) => m({ line, mutator: 'BlockStatement' }));
  const ranked = rank([isolated, ...cluster]);
  assert.equal(ranked[0].line, 100, 'four clustered survivors beat one isolated tractable mutant');
  assert.equal(ranked.at(-1).line, 1000);
});

test('higher score wins over the order the survivors arrived in', () => {
  const ranked = rank([
    { mutator: 'StringLiteral', line: 100, column: 1, status: 'nocoverage', replacement: '""' },
    { mutator: 'EqualityOperator', line: 300, column: 1, status: 'survived', replacement: '>=' },
    { mutator: 'BlockStatement', line: 500, column: 1, status: 'survived', replacement: '{}' },
  ]);
  assert.deepEqual(ranked.map((x) => x.line), [300, 500, 100]);
});

test('equal scores are broken by line, so the order is the same on every run', () => {
  // Two mutation runs hand the same survivors over in different orders. Without the
  // line tie-break the pipeline attacks a different mutant each time it restarts, and
  // the attempts map it keeps never lines up with what it did last time.
  const ranked = rank([m({ line: 100 }), m({ line: 1000 }), m({ line: 500 })]);
  assert.deepEqual(ranked.map((x) => x.line), [100, 500, 1000]);
});

test('the explanation names coverage, cluster size, window and tractability', () => {
  // `why` is what a human reads in the run log to understand a pick; every clause is a
  // signal that went into the score, and a clause that vanishes is a signal that did not.
  const [r] = rank([{ mutator: 'ArrayDeclaration', line: 40, column: 2, status: 'nocoverage', replacement: '[]' }]);
  assert.equal(r.why,
    'not covered (needs a new test path), 0 survivor(s) within 8 lines, ArrayDeclaration tractability 5');
  assert.equal(r.neighbours, 0);
  assert.equal(r.failedAttempts, 0);
});

test('the explanation records failed attempts, and says nothing when there are none', () => {
  const target = m({ line: 10 });
  const [tried] = rank([target], { attempts: { [mutantKey(target)]: 3 } });
  assert.equal(tried.why,
    'covered by tests (needs a sharper assertion), 0 survivor(s) within 8 lines, EqualityOperator tractability 10'
    + ', 3 failed attempt(s)');
  assert.equal(tried.failedAttempts, 3);

  const [fresh] = rank([target]);
  assert.ok(!fresh.why.includes('failed attempt'), 'a mutant nobody has tried is not reported as having tried');
});

test('a mutator the table has never heard of gets the middling tractability', () => {
  // Stryker adds mutators between versions. An unknown one must score like an average
  // mutant, not like undefined, which poisons the whole sum.
  const [r] = rank([m({ mutator: 'SomeNewStrykerMutator' })]);
  assert.match(r.why, /SomeNewStrykerMutator tractability 4$/);
});

// ── choosing what to attack ────────────────────────────────────────────────

test('a mutant nobody has attempted is the one to attack', () => {
  assert.equal(pickNext([m({ line: 7 })]).line, 7);
});

test('one failed attempt retires a mutant, zero does not', () => {
  // The default is one attempt each: a test written specifically to kill it and failing
  // is the evidence that it is equivalent. At `<=` the pipeline funds a second try that
  // by construction cannot go any differently.
  const target = m({ line: 7 });
  assert.equal(pickNext([target], { attempts: { [mutantKey(target)]: 0 } }).line, 7);
  assert.equal(pickNext([target], { attempts: { [mutantKey(target)]: 1 } }), null);
});

test('a caller can buy more attempts per mutant', () => {
  const target = m({ line: 7 });
  assert.equal(pickNext([target], { attempts: { [mutantKey(target)]: 1 }, maxAttemptsPerMutant: 2 }).line, 7);
});

test('the shortlist drops a mutant that has used up its single attempt', () => {
  // Boundary: failedAttempts equal to the cap is spent, not eligible.
  const spent = m({ line: 10 });
  const fresh = m({ line: 200 });
  assert.deepEqual(shortlist([spent, fresh], { attempts: { [mutantKey(spent)]: 1 } }).map((x) => x.line), [200]);
});

// ── the prompt the model is actually shown ─────────────────────────────────

test('the system prompt carries every instruction the decision depends on', () => {
  // It is one long concatenation. Losing a segment — or turning a `+` into a `-`, which
  // makes everything before it the string "NaN" — changes what the model is told
  // without changing the shape of the request at all.
  const req = buildPickRequest([m()], { file: 'a.js', source: 'x' });
  for (const phrase of [
    'You choose which surviving Stryker mutant',
    'It will write ONE test for your choice',
    'KILLED by a single, honest test',
    'observe through the public API',
    'Avoid mutants whose effect is unobservable',
    'branches that cannot be triggered',
    'Prefer one that also puts neighbouring survivors under test',
    'You are ORDERING work',
    'Always pick one',
    'equivalent-looking of them and say so in your reason',
    'Reply ONLY with JSON',
    'Keep reason and killIdea to one short line each',
  ]) assert.ok(req.system.includes(phrase), `the system prompt lost: ${phrase}`);
});

test('the pick call is marked as a decision, in JSON, at a low temperature', () => {
  // llm.chat routes decision calls with the thinking channel off; flipped, the answer
  // comes back as prose the JSON parser cannot read.
  const req = buildPickRequest([m()], { file: 'a.js', source: 'x' });
  assert.equal(req.decision, true);
  assert.equal(req.json, true);
  assert.equal(req.temperature, 0.2);
});

test('the prompt opens with the file, carries the source, and closes with the instruction', () => {
  const req = buildPickRequest([m()], { file: 'src/checkout.ts', source: 'export const rate = 0.2;' });
  assert.ok(req.prompt.startsWith('FILE: src/checkout.ts\n'), req.prompt.slice(0, 60));
  assert.ok(req.prompt.includes('SOURCE:\nexport const rate = 0.2;'));
  assert.ok(req.prompt.includes('SURVIVING MUTANT CANDIDATES:'));
  assert.ok(req.prompt.endsWith('Pick the one single test can most reliably kill. JSON only.'));
});

test('a source larger than the budget is truncated', () => {
  // The whole file goes into the prompt. Without the cut a large file blows the context
  // window and the call fails instead of returning a pick.
  const req = buildPickRequest([m()], { file: 'a.js', source: 'a'.repeat(10000) + 'TAIL_MARKER' });
  assert.ok(!req.prompt.includes('TAIL_MARKER'));
});

test('a candidate with a column is addressed by line and column', () => {
  const req = buildPickRequest([m({ line: 10, column: 3 })], { file: 'a.js', source: '' });
  assert.ok(req.prompt.includes('#1 line 10:3 — EqualityOperator'), req.prompt);
});

test('a candidate with no column is addressed by line alone', () => {
  // Rendering `line 10:undefined` tells the model there is a column and that it is the
  // word undefined, which is a position it will then reason about.
  const req = buildPickRequest([{ mutator: 'BooleanLiteral', line: 10, status: 'survived', replacement: 'false' }],
    { file: 'a.js', source: '' });
  assert.ok(req.prompt.includes('#1 line 10 — BooleanLiteral'), req.prompt);
});

test('candidates are separated by exactly one blank line', () => {
  // Each candidate block is joined from parts, one of which is an empty string when
  // there is no context. Left in, it adds a stray newline that runs the list together.
  const req = buildPickRequest([m({ line: 10 }), m({ line: 20 })], { file: 'a.js', source: '' });
  assert.ok(req.prompt.includes('ALREADY EXECUTED by tests (needs a sharper assertion)\n\n#2 line 20:3'), req.prompt);
});

test('surrounding source is indented under a context heading', () => {
  // The context is spliced into a numbered list; unindented it is indistinguishable
  // from the pipeline's own instructions.
  const req = buildPickRequest([m({ line: 10, context: 'function f() {\n  return 1;\n}' })],
    { file: 'a.js', source: '' });
  assert.ok(req.prompt.includes('   context:\n     function f() {\n       return 1;\n     }'), req.prompt);
});

test('the failed block names the column and the replacement of what already resisted', () => {
  // The ban has to be as precise as the filter that built the candidate list, or it
  // describes a still-killable sibling character for character as the thing to avoid.
  const req = buildPickRequest([m({ line: 40 })], {
    file: 'a.js',
    source: '',
    failed: [{ mutator: 'EqualityOperator', line: 25, column: 16, replacement: 'w < H', attempts: 2 }],
  });
  assert.ok(req.prompt.includes('  - EqualityOperator at line 25:16 where the code becomes "w < H" (2 failed attempt(s))'),
    req.prompt);
});

test('two failed mutants are listed one per line', () => {
  const req = buildPickRequest([m({ line: 40 })], {
    file: 'a.js',
    source: '',
    failed: [
      { mutator: 'EqualityOperator', line: 25, attempts: 1 },
      { mutator: 'BooleanLiteral', line: 60, attempts: 1 },
    ],
  });
  assert.ok(req.prompt.includes(
    '  - EqualityOperator at line 25 (1 failed attempt(s))\n  - BooleanLiteral at line 60 (1 failed attempt(s))'),
  req.prompt);
});

test('the failed block explains why those are off the table, and what still is on it', () => {
  const req = buildPickRequest([m({ line: 40 })], {
    file: 'a.js',
    source: '',
    failed: [{ mutator: 'EqualityOperator', line: 25, column: 16, replacement: 'w < H', attempts: 1 }],
  });
  for (const phrase of [
    'ALREADY ATTEMPTED AND FAILED',
    'probably equivalent mutants',
    'say so in your reason and pick the best of the rest:',
    'A mutant at the SAME line and mutator but a DIFFERENT replacement is a different mutant',
    'and is fair game — Stryker emits several per position.',
  ]) assert.ok(req.prompt.includes(phrase), `the failed block lost: ${phrase}`);
});

test('team constraints are bulleted, one per line, and absent when there are none', () => {
  const withConstraints = buildPickRequest([m()], {
    file: 'a.js', source: '', constraints: ['no introspection', 'no snapshots'],
  });
  assert.ok(withConstraints.prompt.includes('Team constraints on tests:\n- no introspection\n- no snapshots\n'),
    withConstraints.prompt);

  const without = buildPickRequest([m()], { file: 'a.js', source: '' });
  assert.ok(!without.prompt.includes('Team constraints'), 'an empty constraint list is no heading at all');
});

// ── reading the model's answer ─────────────────────────────────────────────

test('the first candidate is reachable by index', () => {
  // `pick: 1` sits exactly on the lower bound. At `n > 1` the commonest answer the model
  // gives is rejected and silently re-read as a line number.
  assert.equal(resolvePick({ pick: 1 }, [m({ line: 10 }), m({ line: 20 })]).mutant.line, 10);
});

test('a pick below the first candidate is unusable, not the last one', () => {
  // `shortlist[n - 1]` with n = 0 is shortlist[-1], which is undefined — the caller then
  // holds a pick whose mutant does not exist, and finds out only when it builds a range.
  const list = [m({ line: 10 }), m({ line: 20 })];
  assert.equal(resolvePick({ pick: 0 }, list), null);
  assert.equal(resolvePick({ pick: -1 }, list), null);
});

test('no shortlist at all is an unusable answer, not a crash', () => {
  assert.equal(resolvePick({ pick: 1 }, null), null);
  assert.equal(resolvePick({ pick: 1 }, undefined), null);
  assert.equal(resolvePick({ pick: 1 }, []), null);
});

test('a stated line that matches nothing falls back to reading the pick as an index', () => {
  // Otherwise a hallucinated line number resolves to nothing and the caller is handed a
  // pick whose mutant is undefined — which only shows up much later, as a bad range.
  assert.equal(resolvePick({ pick: 2, line: 999 }, [m({ line: 10 }), m({ line: 20 })]).mutant.line, 20);
});

test('reason and killIdea are bounded and never read as the word undefined', () => {
  // Both are spliced verbatim into the next prompt: an unbounded reason drags a whole
  // reasoning transcript along with it, and a missing one would write "undefined" there.
  const list = [m({ line: 10 })];
  const long = resolvePick({ pick: 1, reason: 'r'.repeat(400), killIdea: 'k'.repeat(400) }, list);
  assert.equal(long.reason.length, 300);
  assert.equal(long.killIdea.length, 300);

  const bare = resolvePick({ pick: 1 }, list);
  assert.equal(bare.reason, '');
  assert.equal(bare.killIdea, '');
});

// ── the range re-mutated to verify a kill ──────────────────────────────────

test('a mutant with no line is verified from the top of the file', () => {
  // A merged report can lose the location. `undefined - pad` makes the range NaN-NaN,
  // which Stryker reads as no range at all and re-mutates the whole file.
  assert.deepEqual(verifyRange({}, { pad: 10 }), { from: 1, to: 11 });
});

test('the default pad is twelve lines either side', () => {
  assert.deepEqual(verifyRange({ line: 100 }), { from: 88, to: 112 });
});

// ── attribution: which test file earned its place ──────────────────────────

test('a report that is missing, or missing its sections, yields no attributions', () => {
  // The report is read from a file Stryker may not have finished writing, or may have
  // failed before writing. Every section access is optional so a truncated report is an
  // empty result rather than a crash that loses the whole sweep.
  assert.deepEqual(killsByTestFile(undefined), {});
  assert.deepEqual(killsByTestFile({}), {});
  assert.deepEqual(killsByTestFile({ testFiles: {}, files: {} }), {});
});

test('a test file with no test list still appears with zero kills', () => {
  assert.deepEqual(killsByTestFile({ testFiles: { 'test/a.test.js': null }, files: {} }), { 'test/a.test.js': 0 });
});

test('a source file with no mutant list contributes nothing', () => {
  const report = { testFiles: { 'test/a.test.js': { tests: [{ id: '0' }] } }, files: { 'src/a.js': null } };
  assert.deepEqual(killsByTestFile(report), { 'test/a.test.js': 0 });
});

test('a killed mutant with no killedBy list is skipped, not thrown on', () => {
  const report = {
    testFiles: { 'test/a.test.js': { tests: [{ id: '0' }] } },
    files: { 'src/a.js': { mutants: [{ id: 'm1', status: 'Killed', location: { start: { line: 1, column: 1 } } }] } },
  };
  assert.deepEqual(killsByTestFile(report), { 'test/a.test.js': 0 });
});

test('kills accumulate, so a file that killed two mutants reports two', () => {
  // The counter reads its own previous value. Capped at one, every file that pulls its
  // weight looks exactly like a file that killed a single mutant.
  const report = {
    testFiles: { 'test/a.test.js': { tests: [{ id: '0' }, { id: '1' }] } },
    files: {
      'src/a.js': {
        mutants: [
          { id: 'm1', status: 'Killed', killedBy: ['0'], location: { start: { line: 1, column: 1 } } },
          { id: 'm2', status: 'Killed', killedBy: ['1'], location: { start: { line: 2, column: 1 } } },
        ],
      },
    },
  };
  assert.deepEqual(killsByTestFile(report), { 'test/a.test.js': 2 });
});

test('a kill credited to a test Stryker never listed creates no phantom file', () => {
  // An unknown test id must be dropped, not filed under the key "undefined" — which
  // would then show up in the sweep as a test file with kills and no path.
  const report = {
    testFiles: { 'test/known.test.js': { tests: [{ id: '0' }] } },
    files: {
      'src/a.js': {
        mutants: [{ id: 'm1', status: 'Killed', killedBy: ['0', '99'], location: { start: { line: 1, column: 1 } } }],
      },
    },
  };
  assert.deepEqual(killsByTestFile(report), { 'test/known.test.js': 1 });
});

test('a surviving mutant that still carries a killedBy is credited to nobody', () => {
  // Only killed and timed-out mutants count. Without the status filter, an attribution
  // carried over from an earlier run would earn a test file a reprieve it did not win.
  const report = {
    testFiles: { 'test/a.test.js': { tests: [{ id: '0' }] } },
    files: {
      'src/a.js': {
        mutants: [{ id: 'm1', status: 'Survived', killedBy: ['0'], location: { start: { line: 1, column: 1 } } }],
      },
    },
  };
  assert.deepEqual(killsByTestFile(report), { 'test/a.test.js': 0 });
});

// ── grouping survivors into the tests that would kill them ─────────────────

test('the test name is the site, spelled line:column', () => {
  // The name is compared textually against the test files that already exist, so its
  // exact shape is the interface: a column rendered as 0 matches a different site.
  assert.equal(testNameFor({ line: 8, column: 7 }), 'kills 8:7');
  assert.equal(testNameFor({ line: 8 }), 'kills 8:0', 'a site with no column is column 0');
});

test('a group keeps the line and column of its site', () => {
  const [g] = groupByTestName([{ mutator: 'A', line: 8, column: 7 }]);
  assert.equal(g.name, 'kills 8:7');
  assert.equal(g.line, 8);
  assert.equal(g.column, 7);
  const [noColumn] = groupByTestName([{ mutator: 'A', line: 8 }]);
  assert.equal(noColumn.column, 0);
});

test('sites of equal size are ordered by line, not by the order they arrived in', () => {
  // Two mutation runs list survivors in different orders. Without the line tie-break
  // the sweep writes the same tests in a different order every time it runs, and the
  // diff it produces is unreadable.
  const surv = [
    { mutator: 'A', line: 30, column: 1 }, { mutator: 'B', line: 30, column: 1 },
    { mutator: 'C', line: 10, column: 1 }, { mutator: 'D', line: 10, column: 1 },
    { mutator: 'E', line: 20, column: 1 }, { mutator: 'F', line: 20, column: 1 },
  ];
  assert.deepEqual(groupByTestName(surv).map((g) => g.line), [10, 20, 30]);
});

test('a name counts as already written only when it appears inside one file', () => {
  // The sources are joined before the search. Without a separator, the end of one file
  // and the start of the next form a name that exists in neither of them, and the site
  // is skipped as done.
  const groups = groupByTestName([{ mutator: 'A', line: 12, column: 3 }]);
  assert.equal(unwrittenGroups(groups, ['// kills 12', ':3 belongs to the next file']).length, 1);
});
