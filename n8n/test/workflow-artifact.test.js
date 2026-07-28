// UNIT TESTS for the generated artifact itself — the file n8n actually imports.
//
// The generator gave every node a fresh randomUUID() on every run, so regenerating
// an UNCHANGED workflow produced a 112-line diff of nothing but ids. Two costs:
// conditions.test.js claims "a wiring edit that was never regenerated shows up as a
// dirty working tree", which was simply untrue — the tree is dirty either way, so
// real drift was undetectable; and every re-import handed n8n a different identity
// for the same node.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nodeId } from '../node-id.js';

const wf = JSON.parse(readFileSync(new URL('../workflows/Improve-JS-Tests.json', import.meta.url), 'utf8'));

test('a node id is a function of its name, not of when it was generated', () => {
  assert.equal(nodeId('Kill: LLM'), nodeId('Kill: LLM'));
  assert.notEqual(nodeId('Kill: LLM'), nodeId('Kill: Verify'));
  assert.match(nodeId('Kill: LLM'), /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    'n8n expects a uuid-shaped id');
});

test('every node in the committed workflow carries the id its name implies', () => {
  for (const n of wf.nodes) {
    assert.equal(n.id, nodeId(n.name),
      `${n.name}: the artifact was not regenerated from the current sources`);
  }
});

test('no two nodes collide on an id', () => {
  const ids = wf.nodes.map((n) => n.id);
  assert.equal(new Set(ids).size, ids.length);
  const names = wf.nodes.map((n) => n.name);
  assert.equal(new Set(names).size, names.length, 'names are the identity, so they must be unique too');
});

// The seam between "what the model asked for" and "what exists on disk". The parse
// nodes decide a path is acceptable using their own regexes; the sidecar's writer has
// three guards of its own (test-path shape, a js/ts extension, and never a test the
// repo already owned) and reports what it actually wrote. Verifying against the
// PLANNED paths means verifying a file that may never have been created: the scoped
// test run finds nothing, passes, and a whole mutation run is spent proving that
// nothing died.
test('Kill: Verify is told what the sidecar WROTE, not what the model asked for', () => {
  const node = wf.nodes.find((n) => n.name === 'Kill: Verify');
  assert.match(node.parameters.jsonBody, /Kill: Write Test/,
    'the written list is the single source of truth for what is on disk');
  assert.doesNotMatch(node.parameters.jsonBody, /Kill: Parse Test/,
    'the planned paths are a request, not a fact');
});

// ── a round's work must survive the decision to stop ─────────────────────────
// One IF answered two different questions. `Another Round?` chose between
// Accept Round (commit this round, loop) and Drop Last Round (discardUncommitted).
// That was survivable only while the sole reason to stop was a stale round: stopping
// and discarding were the same event. The moment the gate started saying "this round
// improved, and there is nothing left to do" — a file taken to MAC 100 — the graph
// read it as "stale" and threw the round away. Observed live: ChartCard.tsx reached
// cov 0→100, mut 0→100, then "finalizing after 0 accepted round(s) — discarding".
//
// Keeping a round and running another one are separate facts, and /api/verify has
// always returned both.
const edges = (from, out = 0) => (wf.connections[from]?.main?.[out] || []).map((c) => c.node);
const nodeNamed = (n) => wf.nodes.find((x) => x.name === n);

test('a round that improved is committed even when no further round is worthwhile', () => {
  const kept = wf.nodes.find((n) => /Round Kept\?/.test(n.name));
  assert.ok(kept, 'the graph needs a decision for "keep this round" separate from "run another"');
  const expr = JSON.stringify(kept.parameters);
  assert.match(expr, /improvedAny/, 'keeping a round is decided by whether it improved anything');
  assert.match(expr, /degradedAny/, 'a round that degraded a metric is not kept');

  assert.deepEqual(edges('Round Kept?', 0), ['Accept Round'], 'improved → commit the round');
  assert.deepEqual(edges('Round Kept?', 1), ['Drop Last Round'], 'not improved → discard it');

  // and only after the round is safely committed do we ask whether to go again
  assert.deepEqual(edges('Accept Round'), ['Another Round?']);
  assert.deepEqual(edges('Another Round?', 0), ['Coverage Gaps'], 'worth another → next round');
  assert.deepEqual(edges('Another Round?', 1), ['Drop Last Round'],
    'not worth another → settle; after a commit this discards nothing and restores the accepted metrics');

  assert.deepEqual(edges('Verify'), ['Round Kept?'], 'the first question after verifying is whether to keep');
});

test('the round gate reads the worth-another flag from Verify, which is where it is computed', () => {
  // Another Round? now runs downstream of Accept Round, whose payload is {ok,file,rounds}.
  // Reading $json.anotherRoundWorthIt there is reading a field that is never present —
  // undefined is falsy, so it would look exactly like a correct "stop" forever.
  const expr = JSON.stringify(nodeNamed('Another Round?').parameters);
  assert.match(expr, /\$\('Verify'\)[^"]*anotherRoundWorthIt/,
    'the flag lives in Verify\'s response, so it must be read from that node');
});

test('Kill: Verify Batch is told what the prompt aimed at, not the picker\'s shortlist', () => {
  // `Next Mutant` returns both lists; only one of them describes what got a test.
  // Charging an attempt to a mutant nothing was written for spends its single shot.
  const body = wf.nodes.find((n) => n.name === 'Kill: Verify Batch').parameters.jsonBody;
  assert.match(body, /Kill: Build Batch'\)\.first\(\)\.json\.aimed/,
    'the node that built the prompt is the only one that knows which mutants it covered');
  assert.doesNotMatch(body, /Next Mutant'\)\.first\(\)\.json\.targets/,
    'the ranked shortlist is a picking aid, not the set under test');
});

// ── a call that runs its full budget must not kill the run ───────────────────
// A 496-file run stopped after 5. The escalated kill call ran to the sidecar's
// 900s reasoning budget; the n8n node's timeout was also 900000, and n8n starts its
// clock first, so the HTTP node errored a moment before the sidecar could answer
// {ok:false} — and an errored node aborts the whole execution. 491 files never
// happened, and the event log's last line was "LLM error: fetch failed".
//
// Both halves are needed. The margin lets the sidecar always be the one to answer,
// and onError keeps a transport blip from ending a run the graph could carry on with,
// since every consumer of an LLM response already branches on `ok`.
const LLM_BUDGET_MS = 900000;      // sidecar/llm.js timeoutFor(thinking)
const STRYKER_BUDGET_MS = 2400000; // sidecar/stryker.js run(..., timeoutMs)
const COVERAGE_BUDGET_MS = 1800000; // sidecar/coverage.js run(..., timeoutMs)

const httpNodes = wf.nodes.filter((n) => n.type === 'n8n-nodes-base.httpRequest');
const timeoutOf = (n) => n.parameters?.options?.timeout;

test('every model call gives the sidecar room to answer, and survives it not answering', () => {
  const llm = httpNodes.filter((n) => String(n.parameters.url).includes('/api/llm/chat'));
  assert.ok(llm.length >= 4, `expected the model-calling nodes, found ${llm.length}`);
  for (const n of llm) {
    assert.ok(timeoutOf(n) > LLM_BUDGET_MS,
      `${n.name}: timeout ${timeoutOf(n)} must exceed the sidecar's ${LLM_BUDGET_MS}ms budget, or n8n aborts first`);
    assert.equal(n.onError, 'continueRegularOutput',
      `${n.name}: a failed model call is one lost attempt, not the end of the run`);
  }
});

test('every suite run outlives the suite runner', () => {
  // the inverse of the same mistake: these waited 1200000 on a runner the sidecar
  // gives 1800000, so n8n gave up first on any repo whose suite is slow
  for (const n of httpNodes.filter((x) => String(x.parameters.url).includes('/api/test/run'))) {
    assert.ok(timeoutOf(n) > COVERAGE_BUDGET_MS,
      `${n.name}: timeout ${timeoutOf(n)} must exceed the runner's ${COVERAGE_BUDGET_MS}ms budget`);
  }
});

test('a stage that runs coverage AND mutation outlives both together', () => {
  // /api/verify and /api/test/cleanup do a coverage pass and then a mutation run
  for (const name of ['Verify', 'Cleanup Tests']) {
    const n = wf.nodes.find((x) => x.name === name);
    assert.ok(timeoutOf(n) > COVERAGE_BUDGET_MS + STRYKER_BUDGET_MS,
      `${name}: ${timeoutOf(n)} must exceed ${COVERAGE_BUDGET_MS + STRYKER_BUDGET_MS}ms — it waits on both`);
  }
});

test('every mutation-run call outlives the mutation run it is waiting for', () => {
  const waits = httpNodes.filter((n) => /\/api\/(mutant\/verify|stryker\/run|verify)\b/.test(String(n.parameters.url))
    || /Verify|Baseline Mutation/.test(n.name));
  assert.ok(waits.length >= 4);
  for (const n of waits) {
    assert.ok(timeoutOf(n) > STRYKER_BUDGET_MS,
      `${n.name}: timeout ${timeoutOf(n)} must exceed Stryker's ${STRYKER_BUDGET_MS}ms budget`);
  }
});

// ── the thinking escalation is gone ──────────────────────────────────────────
// A failed cheap attempt used to be retried with reasoning enabled. Measured, that
// second attempt cost 25.3% of a five-hour run's wall clock, and the last time it ran
// it produced a red test and then sat on a 15-minute call that ended the whole run.
// One attempt per mutant, and on to the next.
test('no node, condition or connection is left over from the thinking escalation', () => {
  const gone = ['Kill: Escalate?', 'Kill: Build Prompt 2', 'Kill: LLM 2', 'Kill: Parse Test 2',
    'Kill: Write Test 2', 'Kill: Verify 2'];
  for (const name of gone) {
    assert.equal(wf.nodes.find((n) => n.name === name), undefined, `${name} still exists`);
    assert.equal(wf.connections[name], undefined, `${name} still has outgoing connections`);
  }
  const targets = Object.values(wf.connections).flatMap((c) => (c.main || []).flat().map((x) => x.node));
  for (const name of gone) assert.ok(!targets.includes(name), `something still points at ${name}`);
  assert.ok(!JSON.stringify(wf).includes('escalated'), 'the escalated prompt option survives somewhere');
});

test('a verified single-target attempt goes straight to the next mutant', () => {
  assert.deepEqual((wf.connections['Kill: Verify']?.main?.[0] || []).map((c) => c.node), ['Next Mutant'],
    'with no second attempt there is nothing to branch on');
});

test('the single-target attempt tells the sidecar it is the only one', () => {
  // 'batch' is the one phase whose failure condemns nobody — the sweep covers many
  // sites at once, so a batch that kills nothing says nothing about any single mutant.
  // Every other phase is a verdict, and must spend the mutant's one shot.
  const body = wf.nodes.find((n) => n.name === 'Kill: Verify').parameters.jsonBody;
  assert.match(body, /phase: 'single'/, "a lone attempt is 'single', not 'cheap' — there is no second one to be cheap relative to");
});
