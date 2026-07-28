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
