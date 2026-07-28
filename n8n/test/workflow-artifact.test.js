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
  assert.ok(llm.length >= 3, `expected the model-calling nodes, found ${llm.length}`);
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
  assert.ok(waits.length >= 3, `expected the mutation-waiting nodes, found ${waits.length}`);
  for (const n of waits) {
    assert.ok(timeoutOf(n) > STRYKER_BUDGET_MS,
      `${n.name}: timeout ${timeoutOf(n)} must exceed Stryker's ${STRYKER_BUDGET_MS}ms budget`);
  }
});

test('the mutant phase is a single pass, not a loop', () => {
  const gone = ['Kill: Batch Failed?', 'Kill: Build Prompt', 'Kill: LLM', 'Kill: Parse Test',
    'Kill: Write Test', 'Kill: Verify'];
  for (const name of gone) {
    assert.equal(wf.nodes.find((n) => n.name === name), undefined, `${name} still exists`);
  }
  const targets = Object.values(wf.connections).flatMap((c) => (c.main || []).flat().map((x) => x.node));
  assert.ok(!targets.includes('Next Mutant') || wf.connections['Mutant Loop Done'],
    'nothing may loop back to Next Mutant');
  const backEdges = Object.entries(wf.connections)
    .filter(([, c]) => (c.main || []).flat().some((x) => x.node === 'Next Mutant'))
    .map(([from]) => from);
  assert.deepEqual(backEdges, ['Cov: Done'], `only the coverage phase enters the sweep: ${backEdges}`);
  assert.deepEqual((wf.connections['Kill: Verify Batch']?.main?.[0] || []).map((c) => c.node),
    ['Mutant Loop Done'], 'a verified sweep ends the mutant phase either way');
});

test('one round per file: nothing asks for another', () => {
  assert.equal(wf.nodes.find((n) => n.name === 'Another Round?'), undefined);
  assert.deepEqual((wf.connections['Accept Round']?.main?.[0] || []).map((c) => c.node), ['Drop Last Round'],
    'an accepted round settles straight away');
  assert.ok(!JSON.stringify(wf).includes('anotherRoundWorthIt'),
    'the round gate is gone, so nothing may still read its flag');
});
