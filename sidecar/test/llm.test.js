'use strict';
// UNIT TESTS for the model client — specifically for what happens when the answer
// comes back unusable.
//
// The live evidence this pins down (from /data/dialog.jsonl of a real run): the
// generation calls that failed to parse were not verbose, they were EMPTY. Two
// recorded failures, one with `response: ''` and one cut off after 73 characters,
// each after ~158 SECONDS. Thinking is on for generation calls (it is what keeps
// chain-of-thought out of committed tests), and the reasoning channel spends the
// completion budget before any visible output. Retrying that exact configuration is
// a 158-second gamble on the same dice; retrying with thinking OFF is a few seconds
// and cannot fail the same way.
//
// This file does NOT use helpers/env.js: that helper replaces llm.chat with a
// dispatcher so route tests can fake it, and here the real implementation is the
// thing under test. node:test gives each file its own process, so configuring the
// environment before the require is safe and cannot leak into another suite.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'ijst-llm-'));
process.env.LLM_BASE_URL = 'http://llm.invalid/v1';
process.env.LLM_API_KEY = 'test-key';
process.env.LLM_ENABLE_THINKING = 'true';
process.env.LLM_THINKING_BUDGET = '3000';
process.on('exit', () => { try { fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }); } catch { } });

const llm = require('../llm');

/** Replace global.fetch with a scripted queue; returns the recorded request bodies. */
function scriptFetch(replies) {
  const seen = [];
  const real = global.fetch;
  global.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    seen.push(body);
    const content = replies[seen.length - 1];
    if (content === undefined) throw new Error('fetch called more times than scripted');
    return {
      ok: true,
      async json() {
        return { choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 5 } };
      },
    };
  };
  return { seen, restore() { global.fetch = real; } };
}

const GOOD = '{"tests":[{"path":"test/a.test.ts","content":"it(\'x\', () => {});"}]}';

test('an empty answer is retried WITHOUT thinking, not with the setup that produced it',
  async () => {
    const f = scriptFetch(['', GOOD]);
    try {
      const r = await llm.chat({ prompt: 'write a test', json: true, maxTokens: 4000 });
      assert.equal(f.seen.length, 2, 'one generation, one repair');
      assert.equal(f.seen[0].chat_template_kwargs.enable_thinking, true,
        'the first call still thinks — that is what keeps reasoning out of the test file');
      assert.equal(f.seen[1].chat_template_kwargs.enable_thinking, false,
        'the repair must not re-run the configuration that returned nothing');
      assert.deepEqual(r.json.tests[0].path, 'test/a.test.ts');
    } finally { f.restore(); }
  });

test('a truncated answer is retried the same way', async () => {
  const f = scriptFetch(['\n\n{"tests":[{"path":"tests/unit/a.kill-L', GOOD]);
  try {
    const r = await llm.chat({ prompt: 'write a test', json: true, maxTokens: 4000 });
    assert.equal(f.seen[1].chat_template_kwargs.enable_thinking, false);
    assert.ok(r.json, 'the repair result is what the caller gets');
  } finally { f.restore(); }
});

test('the repair turn drops the thinking headroom it no longer needs', async () => {
  const f = scriptFetch(['', GOOD]);
  try {
    await llm.chat({ prompt: 'write a test', json: true, maxTokens: 4000 });
    assert.ok(f.seen[1].max_tokens < f.seen[0].max_tokens,
      'the first call budgets for a reasoning chain; the repair does not have one');
    assert.ok(f.seen[1].max_tokens >= 4000, 'but the answer itself still has its full budget');
  } finally { f.restore(); }
});

test('a good first answer costs exactly one call', async () => {
  const f = scriptFetch([GOOD]);
  try {
    const r = await llm.chat({ prompt: 'write a test', json: true, maxTokens: 4000 });
    assert.equal(f.seen.length, 1);
    assert.equal(r.json.tests.length, 1);
  } finally { f.restore(); }
});

test('a free-form call is never repaired — there is nothing to parse', async () => {
  const f = scriptFetch(['just prose']);
  try {
    const r = await llm.chat({ prompt: 'summarise', maxTokens: 500 });
    assert.equal(f.seen.length, 1);
    assert.equal(r.text, 'just prose');
  } finally { f.restore(); }
});
