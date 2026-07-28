// @ts-nocheck
'use strict';
// UNIT TESTS for the per-stage team rules — D7, the feature a team actually adapts
// the pipeline with, and until now the least-tested module in the repo (17% lines).
//
// Every stage has the same shape and the same hazard: a free-text rule is handed to a
// model, and the answer decides what the pipeline does next. What matters is not the
// happy path but what happens when the model answers badly — because a rule like
// "don't touch ui" is a CONSTRAINT, and quietly falling back to a mechanical choice
// would violate it while looking like success.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withSandbox, S, rules, setChatImpl } = require('./helpers/env');   // FIRST, always
const { installFakes } = require('./helpers/fakes');

/** Answer the next chat() call with this JSON (or throw the given error). */
function replies(list) {
  const seen = [];
  const restore = setChatImpl(async (opts) => {
    seen.push(opts);
    const r = list[seen.length - 1];
    if (r === undefined) throw new Error('rules made more model calls than the test scripted');
    if (r instanceof Error) throw r;
    return { text: JSON.stringify(r), json: r };
  });
  return { seen, restore };
}

const CANDIDATES = [
  { path: 'src/ui/Button.tsx', coverage: 10, mutation: 10, mac: 1, attempts: 0 },
  { path: 'src/lib/parse.ts', coverage: 90, mutation: 20, mac: 18, attempts: 0 },
  { path: 'src/lib/fresh.ts', coverage: 0, mutation: null, mac: null, attempts: 0 },
];

// ── with no rule configured, no model call happens at all ───────────────────

test('a stage with no rule text never calls the model', () => withSandbox(async (sb) => {
  installFakes(sb);
  await sb.start();
  const { seen, restore } = replies([]);
  sb.onCleanup(restore);

  const prePick = await rules.apply('pre_pick');
  const post = await rules.apply('post_clone');

  assert.equal(seen.length, 0, 'an unconfigured stage is a default, not a question');
  assert.equal(prePick.branchTemplate, 'tests/improve-{file}');
  assert.deepEqual(post.constraints, []);
}));

test('pick_file with no rule takes the lowest MAC, treating unmeasured as weakest', () => withSandbox(async (sb) => {
  installFakes(sb);
  await sb.start();
  const { seen, restore } = replies([]);
  sb.onCleanup(restore);

  const r = await rules.apply('pick_file', { candidates: CANDIDATES });

  assert.equal(seen.length, 0);
  assert.equal(r.file, 'src/lib/fresh.ts', 'mac null → 0: a file nobody has measured is the weakest');
  assert.match(r.reason, /mechanical/);
}));

// ── the guardrail: a rule that cannot be applied must not be silently dropped ──

test('an unusable pick answer refuses to guess — a rule like "don\'t touch ui" would be violated',
  () => withSandbox(async (sb) => {
    installFakes(sb);
    await sb.start({ rules: { pick_file: 'never touch anything under src/ui' } });
    const { restore } = replies([{ nonsense: true }, { nonsense: true }, { nonsense: true }, { nonsense: true }]);
    sb.onCleanup(restore);

    const first = await rules.apply('pick_file', { candidates: CANDIDATES });
    assert.equal(first.file, null, 'no file rather than a file the rule may forbid');
    assert.equal(first.retry, true, 'one bad answer is a hiccup, so ask again');

    await rules.apply('pick_file', { candidates: CANDIDATES });
    const third = await rules.apply('pick_file', { candidates: CANDIDATES });
    assert.equal(third.retry, false, 'but three in a row is a broken endpoint, not a hiccup');
  }));

test('a pick of null is terminal — the rule excluded everything, retrying cannot help',
  () => withSandbox(async (sb) => {
    installFakes(sb);
    await sb.start({ rules: { pick_file: 'only touch files under src/payments' } });
    const { restore } = replies([{ file: null, reason: 'no candidate is under src/payments' }]);
    sb.onCleanup(restore);

    const r = await rules.apply('pick_file', { candidates: CANDIDATES });

    assert.equal(r.file, null);
    assert.equal(r.retry, false);
    assert.match(r.reason, /payments/);
  }));

test('a pick outside the candidate list is not honoured', () => withSandbox(async (sb) => {
  installFakes(sb);
  await sb.start({ rules: { pick_file: 'prefer library code' } });
  const { restore } = replies([{ file: 'src/lib/invented.ts', reason: 'made this up' }]);
  sb.onCleanup(restore);

  const r = await rules.apply('pick_file', { candidates: CANDIDATES });

  assert.equal(r.file, null, 'the pipeline would open a branch for a file that does not exist');
  assert.equal(r.retry, true);
}));

test('a successful pick clears the failure counter', () => withSandbox(async (sb) => {
  installFakes(sb);
  await sb.start({ rules: { pick_file: 'prefer library code' } });
  const { restore } = replies([{ bad: 1 }, { file: 'src/lib/parse.ts', reason: 'weakest assertions' }]);
  sb.onCleanup(restore);

  await rules.apply('pick_file', { candidates: CANDIDATES });
  assert.equal(S.state.pickFailures, 1);
  const ok = await rules.apply('pick_file', { candidates: CANDIDATES });

  assert.equal(ok.file, 'src/lib/parse.ts');
  assert.equal(S.state.pickFailures, 0, 'otherwise an earlier hiccup counts against a later batch');
}));

// ── check_changes: the mechanical gate comes first, always ──────────────────

test('check_changes refuses a red suite before any rule is consulted', () => withSandbox(async (sb) => {
  installFakes(sb);
  await sb.start({ rules: { check_changes: 'approve anything that compiles' } });
  const { seen, restore } = replies([]);
  sb.onCleanup(restore);

  const r = await rules.apply('check_changes', { testsGreen: false, macBefore: 10, macAfter: 20 });

  assert.equal(r.approved, false);
  assert.match(r.reason, /red/);
  assert.equal(seen.length, 0, 'no rule may approve a red suite, so there is nothing to ask');
}));

test('check_changes refuses an unimproved MAC before any rule is consulted', () => withSandbox(async (sb) => {
  installFakes(sb);
  await sb.start({ rules: { check_changes: 'approve anything that compiles' } });
  const { seen, restore } = replies([]);
  sb.onCleanup(restore);

  const r = await rules.apply('check_changes', { testsGreen: true, macBefore: 20, macAfter: 20 });

  assert.equal(r.approved, false);
  assert.match(r.reason, /MAC did not improve/);
  assert.equal(seen.length, 0);
}));

test('check_changes lets the rule veto changes the mechanical gate allowed', () => withSandbox(async (sb) => {
  installFakes(sb);
  await sb.start({ rules: { check_changes: 'reject tests that mock the database' } });
  const { restore } = replies([{ approved: false, reason: 'the diff mocks prisma' }]);
  sb.onCleanup(restore);

  const r = await rules.apply('check_changes', { testsGreen: true, macBefore: 10, macAfter: 20, diff: 'vi.mock("@/lib/db")' });

  assert.equal(r.approved, false);
  assert.deepEqual(r.mechanical, { testsGreen: true, macImproved: true },
    'the verdict must show both halves, or a rejection is unattributable');
}));

test('an unparseable check_changes verdict defaults to the measurement, not to a veto',
  () => withSandbox(async (sb) => {
    // The mechanical gate has already passed: the suite is green and MAC really rose.
    // Throwing that away because the model stuttered would discard verified work.
    installFakes(sb);
    await sb.start({ rules: { check_changes: 'style rules apply' } });
    const { restore } = replies([new Error('endpoint down')]);
    sb.onCleanup(restore);

    await assert.rejects(() => rules.apply('check_changes', { testsGreen: true, macBefore: 10, macAfter: 20 }));
  }));

// ── make_pr: a bad answer must never cost the PR ────────────────────────────

test('make_pr falls back to a full metrics table when the model returns junk', () => withSandbox(async (sb) => {
  installFakes(sb);
  await sb.start({ rules: { make_pr: 'title must start with [tests]' } });
  const { restore } = replies([{ title: 'only a title' }]);
  sb.onCleanup(restore);

  const r = await rules.apply('make_pr', {
    file: 'src/a.ts', branch: 'tests/improve-src-a',
    coverageBefore: 10, coverageAfter: 80, mutationBefore: 0, mutationAfter: 40, macBefore: 0, macAfter: 32,
  });

  assert.match(r.title, /src\/a\.ts/);
  assert.match(r.body, /\| \*\*MAC\*\* \| \*\*0\*\* \| \*\*32\*\* \|/, 'the numbers are the point of the PR');
  assert.deepEqual(r.labels, []);
}));

test('make_pr keeps a good answer but repairs a missing labels array', () => withSandbox(async (sb) => {
  installFakes(sb);
  await sb.start({ rules: { make_pr: 'label everything' } });
  const { restore } = replies([{ title: '[tests] improve src/a.ts', body: '# body', labels: 'tests' }]);
  sb.onCleanup(restore);

  const r = await rules.apply('make_pr', { file: 'src/a.ts' });

  assert.equal(r.title, '[tests] improve src/a.ts');
  assert.deepEqual(r.labels, [], 'a string where an array belongs would break gh pr create');
}));

// ── write_test is assembled, not asked ─────────────────────────────────────

test('write_test constraints combine the post-clone findings with the team rule', () => withSandbox(async (sb) => {
  installFakes(sb);
  await sb.start({ rules: { write_test: 'no introspection' } });
  S.state.decisions.post_clone = { result: { constraints: ['read AGENTS.md'] } };
  const { seen, restore } = replies([]);
  sb.onCleanup(restore);

  const r = await rules.apply('write_test');

  assert.deepEqual(r.constraints, ['read AGENTS.md', 'no introspection']);
  assert.equal(seen.length, 0, 'this stage is assembled from what we already know');
}));

test('every stage records its decision, because the dashboard shows what was applied',
  () => withSandbox(async (sb) => {
    installFakes(sb);
    await sb.start();
    const { restore } = replies([]);
    sb.onCleanup(restore);

    await rules.apply('pre_pick');

    const d = S.state.decisions.pre_pick;
    assert.equal(d.rule, '');
    assert.equal(d.result.branchTemplate, 'tests/improve-{file}');
    assert.ok(d.ts > 0);
  }));

test('an unknown stage is a programming error, not a silent no-op', () => withSandbox(async (sb) => {
  installFakes(sb);
  await sb.start();
  await assert.rejects(() => rules.apply('post_pr'), /unknown rule stage/);
}));
