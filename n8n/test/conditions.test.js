// UNIT TESTS for the 10 IF conditions — the branch semantics the pipeline depends on.
//
// An IF node is two things: an expression, and the wiring of its two outputs. A test
// that only checked the expression would happily pass while the workflow sent "green"
// down the repair branch, so every truth-table case below is asserted as an OUTPUT
// INDEX, and a separate test pins those indexes to what the generator actually wires.
//
// n8n IF nodes have exactly two main outputs: index 0 = TRUE, index 1 = FALSE.
//
//   node                       output 0 (true)          output 1 (false)
//   ─────────────────────────  ───────────────────────  ──────────────────────────
//   More Work?                 Rules: pick file         Finish Run
//   File Picked?               Start Iteration          Pick Retryable?
//   Pick Retryable?            Next Iteration           Finish Run
//   Cov: Has Work?             Cov: LLM Write Tests     Cov: Done
//   Cov: Green?                Cov: Done                Cov: Wrote Any?
//   Cov: Wrote Any?            Cov: Build Repair        Cov: Done
//   Cov: Green After Repair?   Cov: Done                Cov: Delete Broken Tests
//   Mutant To Kill?            Kill: Build Prompt       Mutant Loop Done
//   Another Round?             Accept Round             Drop Last Round
//   Approved?                  Cleanup Tests            Discard Changes
//
// The fixtures are the real sidecar response shapes (sidecar/server.js), because the
// cases that matter are the ones a failed model answer or a crashed endpoint produces.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { CONDITIONS, COMPARISONS, condition } from '../nodes/conditions.js';
import { covBuildPrompt } from '../nodes/cov-build-prompt.js';
import { covParseTests } from '../nodes/cov-parse-tests.js';

// ── the evaluator ──────────────────────────────────────────────────────────
// Evaluates ONE expression against a fixture. It is deliberately not a workflow
// runner: it understands two n8n forms — `$json` and `$('Node').first().json` — and
// THROWS on everything else, including a node the fixture never supplied. A tolerant
// evaluator would turn an unresolvable reference into `undefined`, i.e. into a
// silently-false branch, and would "validate" a condition that can never be true.
function evaluate(expr, fx) {
  const m = /^=\{\{([\s\S]+)\}\}$/.exec(expr);
  if (!m) throw new Error(`not an n8n expression: ${expr}`);
  const nodes = fx.nodes || {};
  const body = m[1].replace(/\$\('([^']*)'\)\.first\(\)\.json/g, (_, name) => {
    // in n8n this is a hard execution error, not an undefined — mirror that
    if (!Object.hasOwn(nodes, name)) throw new Error(`fixture has no node ${JSON.stringify(name)}`);
    return `N[${JSON.stringify(name)}]`;
  });
  if (body.includes('$json') && !Object.hasOwn(fx, 'json')) throw new Error('expression reads $json but the fixture has none');
  const leftover = body.match(/\$(?!json\b)[A-Za-z_(]/);
  if (leftover) throw new Error(`unsupported n8n variable near "${leftover[0]}" in ${body}`);
  return Function('$json', 'N', `'use strict'; return (${body});`)(fx.json, nodes);
}

// n8n's IF v1 compares numbers with === / >, so an expression yielding undefined
// takes the false branch rather than throwing.
const OPS = { equal: (a, b) => a === b, larger: (a, b) => a > b };

// The whole decision: expression → comparison → output index (0 = true, 1 = false).
function branchOf(name, fx) {
  const { value1, value2, operation } = condition(name);
  const op = OPS[operation];
  if (!op) throw new Error(`evaluator does not model operation "${operation}"`);
  return op(evaluate(value1, fx), value2) ? 0 : 1;
}

const without = (o, ...keys) => { const c = { ...o }; for (const k of keys) delete c[k]; return c; };

// ── the wiring, as the generator writes it ─────────────────────────────────
const BRANCHES = {
  'More Work?': ['Rules: pick file', 'Finish Run'],
  'File Picked?': ['Start Iteration', 'Pick Retryable?'],
  'Pick Retryable?': ['Next Iteration', 'Finish Run'],
  'Baseline OK?': ['Coverage Gaps', 'Iteration Done'],
  'Cov: Has Work?': ['Cov: LLM Write Tests', 'Cov: Done'],
  'Cov: Green?': ['Cov: Done', 'Cov: Wrote Any?'],
  'Cov: Wrote Any?': ['Cov: Build Repair', 'Cov: Done'],
  'Cov: Green After Repair?': ['Cov: Done', 'Cov: Delete Broken Tests'],
  'Mutant To Kill?': ['Kill: Build Batch', 'Mutant Loop Done'],
  'Kill: Batch Failed?': ['Kill: Build Prompt', 'Next Mutant'],
  'Kill: Escalate?': ['Kill: Build Prompt 2', 'Next Mutant'],
  'Another Round?': ['Accept Round', 'Drop Last Round'],
  'Approved?': ['Cleanup Tests', 'Discard Changes'],
};

// The committed artifact, not a re-run of the generator: this is the file n8n
// actually imports, and importing generate-workflows.mjs would write to disk as a
// side effect. `npm run check` regenerates it, so a wiring edit that was never
// regenerated shows up as a dirty working tree.
const wf = JSON.parse(readFileSync(new URL('../workflows/Improve-JS-Tests.json', import.meta.url), 'utf8'));
const ifNodes = wf.nodes.filter((n) => n.type === 'n8n-nodes-base.if');

// =============================================================================
// the evaluator itself — if this is wrong, every table below is worthless
// =============================================================================
test('the evaluator refuses what it cannot resolve', () => {
  // a referenced node the fixture never supplied: n8n aborts the execution here,
  // so the test must too rather than quietly evaluating `undefined.improved`
  assert.throws(() => branchOf('Cov: Wrote Any?', { json: { count: 3 } }), /no node "Cov: Parse Tests"/);
  // $json used but not supplied
  assert.throws(() => evaluate('={{ $json.done ? 0 : 1 }}', {}), /reads \$json/);
  // n8n forms we deliberately do not model — silently returning undefined here
  // would let a broken expression look like a working false branch
  assert.throws(() => evaluate("={{ $('Verify').item.json.improved }}", { nodes: { Verify: {} } }), /unsupported n8n variable/);
  assert.throws(() => evaluate('={{ $items(0).length }}', { json: {} }), /unsupported n8n variable/);
  assert.throws(() => evaluate('{{ $json.done }}', { json: {} }), /not an n8n expression/);
  // an unknown identifier inside the body is a ReferenceError, not undefined
  assert.throws(() => evaluate('={{ nope.field }}', { json: {} }), ReferenceError);
  // a MISSING FIELD, by contrast, is legal n8n and must evaluate
  assert.equal(evaluate('={{ $json.done ? 0 : 1 }}', { json: {} }), 1);
});

test('condition() is the single source for all 13 IF nodes', () => {
  assert.equal(Object.keys(CONDITIONS).length, 13);
  assert.deepEqual(Object.keys(COMPARISONS).sort(), Object.keys(CONDITIONS).sort());
  assert.deepEqual(Object.keys(BRANCHES).sort(), Object.keys(CONDITIONS).sort());
  assert.throws(() => condition('Wrote Any?'), /no condition registered/);   // near-miss name
  for (const name of Object.keys(CONDITIONS)) assert.ok(OPS[condition(name).operation], `${name}: unmodelled operation`);
});

// =============================================================================
// the generated workflow must agree with the module the tables below exercise
// =============================================================================
test('every IF node in the workflow carries exactly the registered condition', () => {
  assert.equal(ifNodes.length, 13, 'workflow has a different number of IF nodes than conditions.js knows');
  for (const n of ifNodes) {
    assert.deepEqual(n.parameters.conditions.number, [condition(n.name)], `${n.name}: expression drifted from conditions.js`);
    assert.equal(n.typeVersion, 1, `${n.name}: IF v2+ uses a different parameter shape than this test models`);
  }
});

test('output 0 is the true branch and output 1 the false branch, everywhere', () => {
  for (const [name, [onTrue, onFalse]] of Object.entries(BRANCHES)) {
    const main = wf.connections[name].main;
    assert.deepEqual(main[0].map((c) => c.node), [onTrue], `${name}: true branch`);
    assert.deepEqual(main[1].map((c) => c.node), [onFalse], `${name}: false branch`);
    assert.equal(main.length, 2, `${name}: an IF node has two outputs`);
  }
});

// =============================================================================
// More Work?   $json = GET /api/files/candidates
// =============================================================================
test('More Work? routes to the picker only while the sidecar says there is work', () => {
  assert.equal(branchOf('More Work?', { json: { done: false, candidates: [{ path: 'src/a.ts' }] } }), 0);
  assert.equal(branchOf('More Work?', { json: { done: true, reason: 'no remaining candidate files' } }), 1);
  assert.equal(branchOf('More Work?', { json: { done: true, reason: 'scope limit (3 files) reached' } }), 1);
  // missing/null `done` keeps the run going: the pipeline never stops on a field it
  // did not get, it stops when the sidecar says so
  assert.equal(branchOf('More Work?', { json: {} }), 0);
  assert.equal(branchOf('More Work?', { json: { done: null } }), 0);
  // the loop cannot spin forever on an empty list: no candidates ⇒ the sidecar sets
  // done, and even if it did not, the pick below fails and Pick Retryable? ends the run
  assert.equal(branchOf('More Work?', { json: { done: true, candidates: [] } }), 1);
});

// =============================================================================
// File Picked? / Pick Retryable?   $json = POST /api/rules/apply {stage:'pick_file'}
// =============================================================================
const pick = (result) => ({ json: { ok: true, stage: 'pick_file', result } });

test('File Picked? demands an actual path, not just a response', () => {
  assert.equal(branchOf('File Picked?', pick({ file: 'src/a.ts', reason: 'lowest MAC (mechanical pick)' })), 0);
  assert.equal(branchOf('File Picked?', pick({ file: null, retry: true, reason: 'pick rule could not be applied' })), 1);
  assert.equal(branchOf('File Picked?', pick({ file: null, retry: false, reason: 'all candidates excluded by rule' })), 1);
  assert.equal(branchOf('File Picked?', pick({ file: '' })), 1, 'an empty string is not a pick');
  assert.equal(branchOf('File Picked?', pick({})), 1);
  // no `result` at all — the `$json.result &&` guard is what keeps this from throwing
  assert.equal(branchOf('File Picked?', { json: { ok: true } }), 1);
  assert.equal(branchOf('File Picked?', { json: {} }), 1);
});

test('Pick Retryable? retries a transient model hiccup and ends the run on a terminal one', () => {
  // transient: the LLM answered something unusable, the sidecar allows 3 of these
  assert.equal(branchOf('Pick Retryable?', pick({ file: null, retry: true })), 0);
  // terminal: the team rule excludes every candidate, or the 3 strikes are spent
  assert.equal(branchOf('Pick Retryable?', pick({ file: null, retry: false })), 1);
  // the sidecar's "no candidates" answer carries no `retry` key at all — missing must
  // mean "do not loop", otherwise this is an infinite Next Iteration ↔ pick cycle
  assert.equal(branchOf('Pick Retryable?', pick({ file: null, reason: 'no candidates' })), 1);
  assert.equal(branchOf('Pick Retryable?', { json: { ok: true } }), 1);
  assert.equal(branchOf('Pick Retryable?', { json: {} }), 1);
});

// =============================================================================
// Cov: Has Work?   $json = output of the Cov: Build Prompt Code node
// =============================================================================
const gaps = (over = {}) => ({
  ok: true, path: 'src/a.ts', packageJson: 'package.json', runner: 'node:test',
  source: 'export const f = (x) => x + 1;', testPath: 'test/a.test.ts', testExists: true,
  needsBootstrap: true, uncovered: { lines: [3, 4], functions: [], branches: [] }, rounds: 0, ...over,
});

test('Cov: Has Work? skips the LLM exactly when Build Prompt marked the file skippable', () => {
  // fed with the REAL builder output, so the two extracted modules cannot drift apart
  const work = covBuildPrompt(gaps(), 'src/a.ts');
  assert.equal(work.skip, undefined);
  assert.equal(branchOf('Cov: Has Work?', { json: work }), 0, 'a real prompt must reach the LLM');

  const covered = covBuildPrompt(gaps({ uncovered: { lines: [], functions: [], branches: [] } }), 'src/a.ts');
  assert.equal(covered.skip, true);
  assert.equal(branchOf('Cov: Has Work?', { json: covered }), 1, 'fully covered ⇒ straight to Cov: Done');

  // the common case in a mature repo: coverage exists, so the mutant loop takes over
  const bootstrapped = covBuildPrompt(gaps({ needsBootstrap: false }), 'src/a.ts');
  assert.equal(bootstrapped.skip, true);
  assert.equal(branchOf('Cov: Has Work?', { json: bootstrapped }), 1);

  assert.equal(branchOf('Cov: Has Work?', { json: { skip: false } }), 0);
});

// =============================================================================
// Cov: Green? / Cov: Green After Repair?   $json = POST /api/test/run
// =============================================================================
test('Cov: Green? sends a green suite to Done and a red one towards repair', () => {
  assert.equal(branchOf('Cov: Green?', { json: { ok: true, passed: true, summary: '12 passing' } }), 0);
  assert.equal(branchOf('Cov: Green?', { json: { ok: true, passed: false, summary: '1 failing' } }), 1);
  // the endpoint's catch returns ok:false/passed:false — an infra failure (runner not
  // installed, timeout) is indistinguishable here from a genuinely failing test and
  // is sent down the repair branch too
  assert.equal(branchOf('Cov: Green?', { json: { ok: false, passed: false, error: 'command failed' } }), 1);
  // fail closed: no `passed` field ⇒ not green
  assert.equal(branchOf('Cov: Green?', { json: { ok: true } }), 1);
});

test('Cov: Green After Repair? keeps a repaired suite and deletes an unrepaired one', () => {
  assert.equal(branchOf('Cov: Green After Repair?', { json: { ok: true, passed: true } }), 0, 'green ⇒ keep the tests');
  assert.equal(branchOf('Cov: Green After Repair?', { json: { ok: true, passed: false } }), 1, 'still red ⇒ Delete Broken Tests');
  assert.equal(branchOf('Cov: Green After Repair?', { json: { ok: false, passed: false, error: 'boom' } }), 1);
  assert.equal(branchOf('Cov: Green After Repair?', { json: {} }), 1);
  // both green gates use the same expression — same input, same branch semantics
  assert.equal(condition('Cov: Green?').value1, condition('Cov: Green After Repair?').value1);
});

// =============================================================================
// Cov: Wrote Any?   reads the Cov: Parse Tests NODE, not $json
// =============================================================================
const parsed = (json) => ({ json: { ok: true, passed: false }, nodes: { 'Cov: Parse Tests': json } });
const plan = { targetPath: 'test/a.mac-cov.test.ts', existingTestPath: 'test/a.test.ts', existingTestExists: true };

test('Cov: Wrote Any? repairs only when Parse Tests actually produced files', () => {
  // real parser output, so the count this branch trusts is the count that ships
  const two = covParseTests({ ok: true, json: { tests: [
    { path: 'test/a.mac-cov.test.ts', content: 'test("a", () => {});' },
    { path: 'test/b.mac-cov.test.ts', content: 'test("b", () => {});' },
  ] } }, plan);
  assert.equal(two.count, 2);
  assert.equal(branchOf('Cov: Wrote Any?', parsed(two)), 0, 'files on disk ⇒ worth repairing');

  const none = covParseTests({ ok: false, error: 'model returned prose' }, plan);
  assert.equal(none.count, 0);
  assert.equal(branchOf('Cov: Wrote Any?', parsed(none)), 1, 'nothing written ⇒ nothing to repair, go to Done');

  assert.equal(branchOf('Cov: Wrote Any?', parsed({ count: 1 })), 0);
  // `larger 0` on a missing count is false, so a Parse Tests node that returned an
  // unexpected shape lands on Done rather than paying for a repair round
  assert.equal(branchOf('Cov: Wrote Any?', parsed({})), 1);
  assert.equal(branchOf('Cov: Wrote Any?', parsed({ count: 0 })), 1);
  // this is the ONLY condition that is not a 0/1 flag compared against 1
  assert.deepEqual(COMPARISONS['Cov: Wrote Any?'], { operation: 'larger', value2: 0 });
});

// =============================================================================
// Mutant To Kill?   $json = GET /api/mutant/next
// =============================================================================
const mutant = { mutator: 'EqualityOperator', line: 42, column: 7, status: 'survived', replacement: '>=' };

test('Mutant To Kill? loops on a target and leaves when the sidecar hands back none', () => {
  assert.equal(branchOf('Mutant To Kill?', { json: { ok: true, done: false, path: 'src/a.ts', mutant } }), 0);
  assert.equal(branchOf('Mutant To Kill?', { json: { ok: true, mutant: null, done: true, reason: 'no viable surviving mutants left' } }), 1);
  assert.equal(branchOf('Mutant To Kill?', { json: { ok: true, mutant: null, done: true, reason: 'failure budget spent (6 unsuccessful attempts; 2 killed)' } }), 1);
  assert.equal(branchOf('Mutant To Kill?', { json: { ok: true, mutant: null, done: true, reason: 'hard attempt ceiling 20 reached (2 killed)' } }), 1);
  assert.equal(branchOf('Mutant To Kill?', { json: { ok: true } }), 1, 'no mutant field ⇒ leave the loop');
  // `done` is NOT read: `mutant` alone terminates the loop. Every /api/mutant/next
  // exit must therefore null the mutant out, or the loop keeps spending money.
  assert.equal(branchOf('Mutant To Kill?', { json: { ok: true, done: true, mutant } }), 0);
  assert.doesNotMatch(condition('Mutant To Kill?').value1, /done/);
});

// =============================================================================
// Another Round?   $json = POST /api/verify
// =============================================================================
const verify = (over = {}) => {
  const base = {
    ok: true, file: 'src/a.ts', testsGreen: true, improved: true,
    improvedAny: true, degradedAny: false, rounds: 0, maxRounds: 5, pendingSites: 3, ...over,
  };
  // /api/verify computes this from the three facts below; the fixture derives it the
  // same way unless a case sets it explicitly, so the two cannot drift apart.
  if (!('anotherRoundWorthIt' in over)) {
    base.anotherRoundWorthIt = (base.pendingSites ?? 0) > 0 && base.improvedAny && !base.degradedAny;
  }
  return base;
};
const round = (over) => branchOf('Another Round?', { json: verify(over) });
// for the missing-field cases: the key must be absent, not overridden with undefined
const roundOn = (json) => branchOf('Another Round?', { json });

test('Another Round? continues only on improvement with no degradation', () => {
  assert.equal(round({ improvedAny: true, degradedAny: false }), 0, 'progress ⇒ Accept Round');
  assert.equal(round({ improvedAny: true, degradedAny: true }), 1, 'a degraded metric outweighs an improved one');
  assert.equal(round({ improvedAny: false, degradedAny: false }), 1, 'stale ⇒ stop');
  assert.equal(round({ improvedAny: false, degradedAny: true }), 1);
});

test('Another Round? stops at the round cap and treats the boundary as exclusive', () => {
  assert.equal(round({ rounds: 4, maxRounds: 5 }), 0, 'the 5th round is allowed');
  assert.equal(round({ rounds: 5, maxRounds: 5 }), 1, 'rounds === maxRounds ⇒ stop');
  assert.equal(round({ rounds: 6, maxRounds: 5 }), 1, 'past the cap ⇒ stop');
  assert.equal(round({ rounds: 0, maxRounds: 1 }), 0);
  assert.equal(round({ rounds: 1, maxRounds: 1 }), 1);
  // NOTE: at the cap the round is stopped even though it improved, and the false
  // branch (Drop Last Round) discards that round's uncommitted tests. See the report.
});

test('Another Round? falls back to rounds=0 / maxRounds=5 when the fields are missing', () => {
  assert.equal(roundOn(without(verify(), 'rounds')), 0, 'no rounds ⇒ treated as the first round');
  assert.equal(roundOn(without(verify(), 'maxRounds')), 0, 'no maxRounds ⇒ documented default of 5');
  assert.equal(roundOn(without(verify(), 'rounds', 'maxRounds')), 0);
  assert.equal(roundOn(without(verify({ rounds: 4 }), 'maxRounds')), 0, 'default cap of 5: round 5 still allowed');
  assert.equal(roundOn(without(verify({ rounds: 5 }), 'maxRounds')), 1, 'default cap of 5: round 6 refused');
  // The verdict the graph now reads is anotherRoundWorthIt — /api/verify derives it
  // from improvedAny, degradedAny and what is still untried, so a response missing the
  // verdict must not buy a round.
  assert.equal(roundOn(without(verify(), 'anotherRoundWorthIt')), 1, 'no verdict ⇒ do not spend another round');
  assert.equal(roundOn(verify({ anotherRoundWorthIt: false })), 1, 'nothing untried ⇒ nothing to do');
  assert.equal(branchOf('Another Round?', { json: {} }), 1);
});

test('Another Round? stops when /api/verify itself failed', () => {
  // the endpoint's two failure shapes carry no improvedAny/rounds at all
  assert.equal(branchOf('Another Round?', { json: { ok: true, improved: false, testsGreen: false, reason: 'full suite red', file: 'src/a.ts' } }), 1);
  assert.equal(branchOf('Another Round?', { json: { ok: true, improved: false, testsGreen: false, error: 'stryker crashed', file: 'src/a.ts' } }), 1);
});

test('Another Round? honours an explicit maxRounds of 0 — one pass per file, no extra rounds', () => {
  // NEW CONTRACT. `($json.maxRounds || 5)` could not tell "the team asked for zero
  // extra rounds" from "the field is missing", so a configured 0 bought five rounds
  // nobody asked for. `?? 5` separates the two: only ABSENT means "use the default".
  assert.equal(round({ rounds: 0, maxRounds: 0 }), 1, 'maxRounds:0 ⇒ stop at once, even on an improving round');
  assert.equal(roundOn({ improvedAny: true, degradedAny: false, maxRounds: 0 }), 1, 'no rounds field either ⇒ still stop');
  // the boundary, pinned in both directions
  assert.equal(roundOn(without(verify(), 'maxRounds')), 0, 'MISSING maxRounds still means the documented default of 5');
  assert.equal(round({ rounds: 4, maxRounds: 5 }), 0, 'below the cap ⇒ another round');
  assert.equal(round({ rounds: 5, maxRounds: 5 }), 1, 'rounds === maxRounds ⇒ stop');
  // `($json.rounds || 0)` keeps its `||` on purpose: 0 IS the intended default there,
  // so no legitimate value is swallowed by it
  assert.equal(round({ rounds: 0, maxRounds: 1 }), 0, 'first round runs under a cap of 1');
  assert.equal(roundOn(without(verify({ maxRounds: 1 }), 'rounds')), 0);
  // `??` also treats null as absent. /api/verify answers with a number today, so this
  // is a characterization, not a contract the sidecar exercises.
  assert.equal(round({ rounds: 0, maxRounds: null }), 0, 'null ⇒ treated as absent ⇒ default 5');
  // WHAT 0 THEN MEANS, end to end: `rounds` counts ACCEPTED (committed) rounds, and the
  // false branch is Drop Last Round → POST /api/round/drop → discardUncommitted(). So a
  // cap of 0 lets a file be worked on and then throws every test away, reporting
  // improved:false and no PR. A team wanting "one pass per file, kept" wants 1, not 0.
  // See the report: the sidecar should reject 0 rather than accept an expensive no-op.
});

// =============================================================================
// Approved?   $json = Rules: check changes,  plus the Drop Last Round node
// =============================================================================
const approved = (result, dropped) => ({
  json: { ok: true, stage: 'check_changes', result },
  nodes: { 'Drop Last Round': { ok: true, file: 'src/a.ts', testsGreen: true, rounds: 1, ...dropped } },
});

test('Approved? needs BOTH the rules verdict and the measured improvement', () => {
  assert.equal(branchOf('Approved?', approved({ approved: true, reason: 'MAC 12 → 31, suite green' }, { improved: true })), 0,
    'approved and improved ⇒ Cleanup Tests → Rules: make PR → Create PR');
  // the case this gate exists for: the rules engine says yes, the measurement says no
  assert.equal(branchOf('Approved?', approved({ approved: true, reason: 'looks good to me' }, { improved: false })), 1,
    'approved but not improved must NOT reach the PR branch');
  assert.equal(branchOf('Approved?', approved({ approved: false, reason: 'MAC did not improve (12 → 12)' }, { improved: true })), 1);
  assert.equal(branchOf('Approved?', approved({ approved: false, reason: 'test suite is red' }, { improved: false })), 1);
  // a round that was never accepted reports improved:false — nothing is committed, so
  // there is nothing to open a PR from
  assert.equal(branchOf('Approved?', approved({ approved: true }, { improved: false, rounds: 0 })), 1);
});

test('Approved? survives a malformed rules answer and requires Drop Last Round to have run', () => {
  assert.equal(branchOf('Approved?', approved(undefined, { improved: true })), 1, 'no result ⇒ discard');
  assert.equal(branchOf('Approved?', approved({}, { improved: true })), 1, 'no verdict ⇒ discard');
  assert.equal(branchOf('Approved?', approved({ approved: true }, {})), 1, 'no improved field ⇒ discard');
  // the PR gate reads a second node; if Drop Last Round never ran, n8n fails the
  // execution here rather than defaulting to "not approved"
  assert.throws(() => branchOf('Approved?', { json: { ok: true, result: { approved: true } } }), /no node "Drop Last Round"/);
});

// =============================================================================
// cross-cutting: nothing may throw on the shapes a broken model answer produces
// =============================================================================
test('no condition throws on an empty response from its own node', () => {
  const nodes = { 'Cov: Parse Tests': {}, 'Drop Last Round': {} };
  for (const name of Object.keys(CONDITIONS)) {
    const idx = branchOf(name, { json: {}, nodes });
    assert.ok(idx === 0 || idx === 1, `${name} produced ${idx}`);
    // Three conditions fail OPEN on an empty response — More Work? (keep iterating),
    // Cov: Has Work? (write tests anyway) and Baseline OK? (an absent `failed` flag
    // means the run did not crash). All three are self-limiting: the pick fails, the
    // prompt is nonsense and gets deleted, or the empty survivor list ends the loop.
    // The other eight fail CLOSED: no repair, no kill, no extra round, no PR.
    const expected = ['More Work?', 'Cov: Has Work?', 'Baseline OK?'].includes(name) ? 0 : 1;
    assert.equal(idx, expected, `${name}: empty input changed which way it fails`);
  }
});

// =============================================================================
// cross-cutting: the `||`-swallows-a-legitimate-falsy-value audit
// =============================================================================
test('only the rounds counter may default with `||`, because 0 IS its default', () => {
  // The bug class: `x || D` cannot distinguish "not supplied" from a supplied 0, ''
  // or false, so any expression that defaults a field an operator can legitimately
  // set to a falsy value silently overrides them. maxRounds was exactly that and now
  // reads `?? 5`. This guard fails the moment a new `||` default is added anywhere.
  for (const [name, expr] of Object.entries(CONDITIONS)) {
    if (name === 'Another Round?') continue;
    assert.doesNotMatch(expr, /\|\|/, `${name}: a new \`||\` default needs the 0/''/false audit first`);
  }
  const another = CONDITIONS['Another Round?'];
  assert.equal(another.match(/\|\|/g).length, 1, 'exactly one `||` survives the audit');
  assert.match(another, /\$json\.rounds \|\| 0/, 'the survivor is the rounds counter, whose default IS 0');
  assert.match(another, /\$json\.maxRounds \?\? 5/, 'the cap must distinguish an explicit 0 from a missing field');
});

test('every condition reads a field whose falsy value already MEANS the false answer', () => {
  // The other half of the audit: no `||` is not enough — a bare truthiness test
  // (`$json.x ? 1 : 0`) swallows a falsy value just as thoroughly. For each condition,
  // the falsy value the sidecar can actually send, and why that branch is right.
  const cases = [
    ['More Work?', { json: { done: false } }, 0, 'done:false is the sidecar saying there IS work left'],
    ['File Picked?', pick({ file: '' }), 1, 'an empty path is not a file anything downstream could open'],
    ['Pick Retryable?', pick({ file: null, retry: false }), 1, 'retry:false is terminal by definition'],
    ['Baseline OK?', { json: { failed: false, score: 0 } }, 0, 'failed:false is a measured baseline; score 0 is not read here'],
    ['Cov: Has Work?', { json: { skip: false } }, 0, 'skip:false means Build Prompt produced real work'],
    ['Cov: Green?', { json: { passed: false } }, 1, 'passed:false is a red suite'],
    ['Cov: Wrote Any?', parsed({ count: 0 }), 1, 'count 0 is READ, not defaulted — the comparison is `larger 0`'],
    ['Cov: Green After Repair?', { json: { passed: false } }, 1, 'still red after the repair turn'],
    ['Mutant To Kill?', { json: { mutant: null } }, 1, 'null is the only "no target" /api/mutant/next sends'],
    ['Kill: Batch Failed?', { json: { killed: true, retryable: false } }, 1,
      'retryable:false after a batch means something died — go straight to the next batch'],
    ['Kill: Escalate?', { json: { killed: true, retryable: false } }, 1,
      'retryable:false is the sidecar saying the target is spent — a kill, or the reasoning attempt already ran'],
    ['Another Round?', { json: verify({ maxRounds: 0 }) }, 1, 'the fixed one: an explicit cap of 0 now stops the loop'],
    ['Approved?', approved({ approved: false }, { improved: true }), 1, 'approved:false is a refusal, not a missing verdict'],
  ];
  assert.deepEqual(cases.map((c) => c[0]).sort(), Object.keys(CONDITIONS).sort(), 'every condition must be audited');
  for (const [name, fx, expected, why] of cases) assert.equal(branchOf(name, fx), expected, `${name}: ${why}`);
});

test('Baseline OK? routes a file whose baseline could not be measured to the next iteration', () => {
  // /api/stryker/run answers { ok: false, failed: true, ... } when the baseline
  // crashes, and a normal run never carries `failed` at all.
  assert.equal(branchOf('Baseline OK?', { json: { ok: false, failed: true, score: 0, survived: [] } }), 1,
    'a crashed baseline takes the false branch, straight to Iteration Done');
  assert.equal(branchOf('Baseline OK?', { json: { ok: true, score: 42, survived: [], totalMutants: 10 } }), 0);
  assert.equal(branchOf('Baseline OK?', { json: { ok: true, score: 0, survived: [], noTests: true } }), 0,
    'a file with no tests yet is NOT a failure — that is what the coverage bootstrap is for');
});

test('Another Round? asks the sidecar whether another round can DO anything', () => {
  // This is a seam, and it failed silently once: /api/verify computed
  // anotherRoundWorthIt and returned it, the condition never referenced it, and each
  // side's tests passed — one asserts the response field, the other asserts branch
  // wiring, and neither asserts they are talking about the same thing. Live cost was
  // twelve minutes of measuring a file that had nothing left to try.
  const expr = CONDITIONS['Another Round?'];
  assert.match(expr, /anotherRoundWorthIt/,
    'the decision belongs to the side that knows what is left in the queue');

  // and it must still respect the cap
  assert.match(expr, /maxRounds/);
  assert.equal(branchOf('Another Round?', { json: verify({ anotherRoundWorthIt: true, rounds: 0, maxRounds: 5 }) }), 0);
  assert.equal(branchOf('Another Round?', { json: verify({ anotherRoundWorthIt: false, rounds: 0, maxRounds: 5 }) }), 1,
    'nothing untried means another round can only re-measure a settled file');
  assert.equal(branchOf('Another Round?', { json: verify({ anotherRoundWorthIt: true, rounds: 5, maxRounds: 5 }) }), 1,
    'the cap still stops it');
});
