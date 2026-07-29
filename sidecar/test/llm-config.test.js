'use strict';
// UNIT TESTS for the guard on an unconfigured endpoint.
//
// .env.example shipped a working LLM_BASE_URL — the author's own inference host — next
// to LLM_API_KEY=sk-replace_me. One value screams "replace me" and the other looks
// finished, so the natural edit is to paste your own provider key and leave the URL,
// which sends that key and your source (the prompt carries up to 24000 characters of
// it) to a host you do not own. Nothing validated either value; the only symptom was an
// HTTP 401 from an unfamiliar domain part-way into a run.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { llm } = require('./helpers/env');

test('a placeholder api key is refused, and the message says which one', () => {
  const p = llm.endpointProblem('https://example.invalid/v1', 'sk-replace_me');
  assert.match(p || '', /LLM_API_KEY/);
  assert.match(p || '', /placeholder/i);
});

test('an unset endpoint is refused with a message that says what to set', () => {
  assert.match(llm.endpointProblem('', 'sk-real') || '', /LLM_BASE_URL/);
});

test('the example host is refused even with a real-looking key', () => {
  // the whole point: someone pastes their own key and leaves the shipped URL
  const p = llm.endpointProblem('https://inference.mikhailov.tech/qwen-3.6-27b-fp8/v1', 'sk-a-real-key');
  assert.match(p || '', /LLM_BASE_URL/,
    'a key must never be sent to the example host just because the operator forgot to change it');
});

test('a configured endpoint passes the guard', () => {
  assert.equal(llm.endpointProblem('https://my-own-host.invalid/v1', 'sk-mine'), null);
  // local endpoints usually need no key at all
  assert.equal(llm.endpointProblem('http://host.docker.internal:11434/v1', ''), null);
});
