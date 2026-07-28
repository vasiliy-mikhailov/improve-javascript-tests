// @ts-nocheck
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
const S = require('../state');
const events = () => S.state.events.map((e) => e.msg);

/**
 * Replace global.fetch with a scripted queue. Each reply is either a plain string
 * (wrapped in a normal envelope) or a whole response envelope, so a test can use a
 * real captured one.
 */
function scriptFetch(replies) {
  const seen = [];
  const real = global.fetch;
  global.fetch = async (url, init) => {
    const body = JSON.parse(init.body);
    seen.push(body);
    const reply = replies[seen.length - 1];
    if (reply === undefined) throw new Error('fetch called more times than scripted');
    const envelope = typeof reply === 'string'
      ? { choices: [{ finish_reason: 'stop', message: { content: reply } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }
      : reply;
    return { ok: true, async json() { return envelope; } };
  };
  return { seen, restore() { global.fetch = real; } };
}

// A REAL reply from the qwen endpoint, captured by replaying the exact
// coverage-bootstrap call that failed twice in the live run (see the fixture's
// _captured note). finish_reason "length", content null, and the whole answer
// stranded in the reasoning channel.
const TRUNCATED = require('./fixtures/qwen-thinking-truncated.json');

const GOOD = '{"tests":[{"path":"test/a.test.ts","content":"it(\'x\', () => {});"}]}';

test('a generation retry KEEPS thinking — it is the hard cases that run out of budget',
  async () => {
    // The mutants that exhaust the budget are the ones whose kill test needs the most
    // thought: an edge case nobody has asserted yet. Retrying those without reasoning
    // buys a cheap answer to the question we most needed answered well. What failed
    // was the BUDGET, so the budget is what changes.
    const f = scriptFetch(['', GOOD]);
    try {
      const r = await llm.chat({ prompt: 'write a test', json: true, maxTokens: 4000 });
      assert.equal(f.seen.length, 2, 'one generation, one retry');
      assert.equal(f.seen[0].chat_template_kwargs.enable_thinking, true);
      assert.equal(f.seen[1].chat_template_kwargs.enable_thinking, true,
        'still thinking — this is test-writing for a mutant that resisted everything else');
      assert.ok(f.seen[1].max_tokens > f.seen[0].max_tokens,
        'and with room to finish: the first attempt proved the old budget was too small');
      assert.deepEqual(r.json.tests[0].path, 'test/a.test.ts');
    } finally { f.restore(); }
  });

test('a truncated answer is retried the same way', async () => {
  const f = scriptFetch(['\n\n{"tests":[{"path":"tests/unit/a.kill-L', GOOD]);
  try {
    const r = await llm.chat({ prompt: 'write a test', json: true, maxTokens: 4000 });
    assert.equal(f.seen[1].chat_template_kwargs.enable_thinking, true);
    assert.ok(r.json, 'the retry result is what the caller gets');
  } finally { f.restore(); }
});

test('a DECISION asks without thinking, and only escalates if the answer is unusable', async () => {
  const f = scriptFetch(['not json at all', GOOD]);
  try {
    await llm.chat({ prompt: 'pick one', json: true, decision: true, maxTokens: 500 });
    assert.equal(f.seen[0].chat_template_kwargs.enable_thinking, false,
      'ordering a shortlist is a 1s call; measured, thinking makes it 7s for no gain');
    assert.equal(f.seen[1].chat_template_kwargs.enable_thinking, true,
      'but a second identical ask would just repeat the first — reasoning is what is left to try');
  } finally { f.restore(); }
});

test('the retry hands the model back its own reasoning so it resumes instead of restarting', async () => {
  const f = scriptFetch([TRUNCATED, GOOD]);
  try {
    await llm.chat({ prompt: 'write a test', json: true, maxTokens: 4000 });
    const assistantTurn = f.seen[1].messages.find((m) => m.role === 'assistant');
    const reasoning = TRUNCATED.choices[0].message.reasoning;
    assert.ok(assistantTurn.content.includes(reasoning.slice(-200)),
      'the work it already did is worth more than an apology for not finishing');
  } finally { f.restore(); }
});

test('the retry budget grows past what the failed attempt burned, and stays bounded', async () => {
  const f = scriptFetch(['', GOOD]);
  try {
    await llm.chat({ prompt: 'write a test', json: true, maxTokens: 4000 });
    assert.ok(f.seen[1].max_tokens > f.seen[0].max_tokens);
    assert.ok(f.seen[1].max_tokens <= 24000, 'the context window is finite');
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


// ═══════════════════════════════════════════════════════════════════════════
//  the reply that actually failed in production
// ═══════════════════════════════════════════════════════════════════════════
//
// Replaying the live call proved the mechanism: the model drafts the whole test file
// INSIDE the reasoning channel, runs out of completion budget there, and returns
// finish_reason "length" with content null. Nothing malformed was ever parsed —
// there was nothing to parse.

test('the captured reply is exactly the shape the run received', () => {
  const ch = TRUNCATED.choices[0];
  assert.equal(ch.finish_reason, 'length');
  assert.equal(ch.message.content, null, 'content is null, not even an empty string');
  assert.ok(ch.message.reasoning.length > 1000, 'the answer was being written in the reasoning channel');
  assert.equal(TRUNCATED.usage.completion_tokens, 2000, 'every completion token went to reasoning');
});

test('an empty completion is reported as such, not as bad JSON', async () => {
  const f = scriptFetch([TRUNCATED, GOOD]);
  try {
    await llm.chat({ prompt: 'write a test', json: true, maxTokens: 4000 });
    const msgs = events();
    assert.ok(msgs.some((m) => /no content|empty/i.test(m)),
      `the log must say the model returned nothing — got: ${JSON.stringify(msgs)}`);
    assert.ok(msgs.some((m) => /length/.test(m)),
      'and name finish_reason, which is the whole diagnosis');
  } finally { f.restore(); }
});

test('a complete JSON answer stranded in the reasoning channel is salvaged, not re-asked', async () => {
  // The captured reply was cut mid-test, but the model frequently finishes the JSON
  // inside its reasoning and is then cut before repeating it as content. Paying for
  // a second 200-second call to re-obtain an answer we already have is pure waste.
  const stranded = {
    choices: [{
      finish_reason: 'length',
      message: { content: null, reasoning: 'Let me write it.\n\n' + GOOD + '\n\nThat covers the branch.' },
    }],
    usage: { prompt_tokens: 10, completion_tokens: 2000 },
  };
  const f = scriptFetch([stranded]);
  try {
    const r = await llm.chat({ prompt: 'write a test', json: true, maxTokens: 4000 });
    assert.equal(f.seen.length, 1, 'no second call — the answer was already paid for');
    assert.equal(r.json.tests[0].path, 'test/a.test.ts');
  } finally { f.restore(); }
});

test('an INCOMPLETE answer in the reasoning channel is not salvaged', async () => {
  // The real capture ends mid-expression, and its reasoning also QUOTES the prompt's
  // uncovered-lines array — [9,11,12,…]. A salvage that takes "the first JSON-looking
  // thing" returns that array and calls the call a success, so the caller sees
  // resp.json.tests === undefined and silently writes nothing.
  const f = scriptFetch([TRUNCATED, GOOD]);
  try {
    const r = await llm.chat({ prompt: 'write a test', json: true, maxTokens: 4000 });
    assert.equal(f.seen.length, 2, 'this one does need re-asking');
    assert.equal(r.json.tests[0].path, 'test/a.test.ts');
  } finally { f.restore(); }
});

test('salvage never returns a stray array quoted from the prompt', async () => {
  const quoted = {
    choices: [{
      finish_reason: 'length',
      message: { content: null, reasoning: 'Uncovered lines: [9,11,12,104,105]. I will start by mocking prisma…' },
    }],
    usage: { prompt_tokens: 10, completion_tokens: 2000 },
  };
  const f = scriptFetch([quoted, GOOD]);
  try {
    const r = await llm.chat({ prompt: 'write a test', json: true, maxTokens: 4000 });
    assert.equal(f.seen.length, 2, 'an array of line numbers is not an answer');
    assert.deepEqual(r.json, JSON.parse(GOOD));
  } finally { f.restore(); }
});

// ═══════════════════════════════════════════════════════════════════════════
//  what the endpoint actually supports
// ═══════════════════════════════════════════════════════════════════════════
//
// Measured against the live endpoint (scratchpad A/B, 2026-07-26):
//   json_object + thinking ON   → 200, content 60ch, reasoning 929ch, finish=stop
//   json_object + thinking OFF  → 200, content 37ch, reasoning 0ch
//   no chat_template_kwargs     → reasoning 754ch, i.e. thinking is the DEFAULT
// So the two are NOT mutually exclusive, and the comment in llm.js that said they
// were was a misdiagnosis: what actually happens is that a long reasoning phase can
// exhaust max_tokens before any content is emitted — which has nothing to do with
// response_format and happens equally without it.

test('every JSON call asks the endpoint for JSON, not just the decision ones', async () => {
  const f = scriptFetch([GOOD, GOOD]);
  try {
    await llm.chat({ prompt: 'write a test', json: true, maxTokens: 4000 });
    await llm.chat({ prompt: 'pick one', json: true, decision: true, maxTokens: 500 });
    assert.deepEqual(f.seen[0].response_format, { type: 'json_object' },
      'a generation call parses JSON too — constraining the output removes the whole failure class');
    assert.deepEqual(f.seen[1].response_format, { type: 'json_object' });
  } finally { f.restore(); }
});

test('a decision still does not think — it is a 1s call that reasons in its `reason` field', async () => {
  const f = scriptFetch([GOOD]);
  try {
    await llm.chat({ prompt: 'pick one', json: true, decision: true, maxTokens: 500 });
    assert.equal(f.seen[0].chat_template_kwargs.enable_thinking, false,
      'measured: thinking turns a 1s pick into a 7s one for no gain');
    assert.equal(f.seen[0].max_tokens, 500, 'and it needs no reasoning headroom');
  } finally { f.restore(); }
});

test('a retry after an empty answer says what actually went wrong', async () => {
  const f = scriptFetch([TRUNCATED, GOOD]);
  try {
    await llm.chat({ prompt: 'write a test', json: true, maxTokens: 4000 });
    const retryMsgs = f.seen[1].messages;
    const lastUser = [...retryMsgs].reverse().find((m) => m.role === 'user');
    assert.doesNotMatch(lastUser.content, /not valid JSON/i,
      'the model did not write bad JSON — it wrote nothing, and telling it otherwise is a lie it has to reconcile');
    assert.match(lastUser.content, /think|reason|token/i, 'name the real cause');
    const assistantTurn = retryMsgs.find((m) => m.role === 'assistant');
    assert.ok(assistantTurn.content.length > 0,
      'an empty assistant turn is rejected by some backends and carries nothing anyway');
  } finally { f.restore(); }
});

test('a malformed — as opposed to absent — answer still gets the JSON nudge', async () => {
  const f = scriptFetch(['here you go: {"tests": [oops', GOOD]);
  try {
    await llm.chat({ prompt: 'write a test', json: true, maxTokens: 4000 });
    const lastUser = [...f.seen[1].messages].reverse().find((m) => m.role === 'user');
    assert.match(lastUser.content, /not valid JSON/i);
  } finally { f.restore(); }
});

test('a caller can force thinking off for a call that would otherwise think', async () => {
  const f = scriptFetch([GOOD]);
  try {
    await llm.chat({ prompt: 'write a test', json: true, maxTokens: 4000, thinking: false });
    assert.equal(f.seen[0].chat_template_kwargs.enable_thinking, false);
    assert.equal(f.seen[0].max_tokens, 4000, 'and it pays no reasoning headroom');
  } finally { f.restore(); }
});

test('forcing thinking off also forces the retry to think — the cheap try already failed', async () => {
  const f = scriptFetch(['', GOOD]);
  try {
    await llm.chat({ prompt: 'write a test', json: true, maxTokens: 4000, thinking: false });
    assert.equal(f.seen[1].chat_template_kwargs.enable_thinking, true,
      'a second cheap attempt would repeat the first one');
  } finally { f.restore(); }
});

test('a call we aborted ourselves is not retried — it would take the same time again', async () => {
  // Live: two escalated calls burned 631s and 447s. The 300s AbortController fired,
  // the retry logic saw "aborted" alongside network errors and tried twice more at the
  // same ceiling, and each attempt aborted at exactly the same point. Eighteen minutes,
  // no answer. A timeout WE set is deterministic; only a transport failure is worth
  // retrying.
  let calls = 0;
  const real = global.fetch;
  global.fetch = async () => { calls += 1; const e = new Error('This operation was aborted'); e.name = 'AbortError'; throw e; };
  try {
    await assert.rejects(() => llm.chat({ prompt: 'x', maxTokens: 500 }), /aborted/);
    assert.equal(calls, 1, `an abort must not be retried — the endpoint was called ${calls} times`);
  } finally { global.fetch = real; }
});

test('a thinking call gets longer to answer than a cold one', async () => {
  // The ceiling has to clear the measured tail: escalations run 112-186s median and
  // past 280s at the top, so a 300s limit turns the slowest — and therefore hardest —
  // calls into guaranteed failures.
  const seen = [];
  const real = global.fetch;
  global.fetch = async (url, init) => {
    seen.push({ body: JSON.parse(init.body), signal: init.signal });
    return { ok: true, async json() { return { choices: [{ message: { content: GOOD } }] }; } };
  };
  try {
    await llm.chat({ prompt: 'x', json: true, maxTokens: 4000, thinking: true });
    await llm.chat({ prompt: 'x', json: true, maxTokens: 4000, thinking: false });
    assert.ok(llm.timeoutFor(true) > llm.timeoutFor(false), 'reasoning needs more wall clock than no reasoning');
    assert.ok(llm.timeoutFor(true) >= 600000, `${llm.timeoutFor(true)}ms does not clear the measured tail`);
  } finally { global.fetch = real; }
});
