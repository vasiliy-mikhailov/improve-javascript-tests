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

test('a configured host is never second-guessed, whichever host it is', () => {
  // An earlier guard rejected a hardcoded "example host" and took production down on
  // deploy — that host is this operator's own endpoint. .env.example ships no url, so a
  // value being present IS the operator's choice; the guard checks that a choice was
  // made, not whose infrastructure it names.
  assert.equal(llm.endpointProblem('https://inference.mikhailov.tech/qwen-3.6-27b-fp8/v1', 'sk-a-real-key'), null);
});

test('a url that is not a url is refused', () => {
  assert.match(llm.endpointProblem('not-a-url', 'sk-real') || '', /not a valid url/);
});

test('a configured endpoint passes the guard', () => {
  assert.equal(llm.endpointProblem('https://my-own-host.invalid/v1', 'sk-mine'), null);
  // local endpoints usually need no key at all
  assert.equal(llm.endpointProblem('http://host.docker.internal:11434/v1', ''), null);
});
