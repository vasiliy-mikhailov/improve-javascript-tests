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
