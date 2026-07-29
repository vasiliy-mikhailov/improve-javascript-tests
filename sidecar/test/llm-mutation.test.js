'use strict';
// Assertions on the parts of llm.js that llm.test.js and llm-config.test.js run but
// never look at: the request that actually goes on the wire, the numbers in it, the
// dialog row a call leaves behind, and the entire HTTP-failure half of post() — the
// retries, the backoff, the JSON-mode fallback and the give-up timer, none of which
// any existing test reaches.
//
// Every case here is a place where llm.js can be changed without a single test
// noticing: the endpoint URL can grow a doubled slash, the api key can stop being
// sent, the reasoning budget can silently become NaN, a 400 can start being retried
// three times, a 429 can stop being, the backoff can run backwards, the 300-character
// cap on an error body can come off, a salvaged answer can be reported as a fresh
// one, and the abort timer can be left running for fifteen minutes after every call.
//
// Like llm.test.js this file tests the REAL client, so it must reach past the
// dispatcher that helpers/env.js installs on llm.chat — see loadLlm() below. No test
// here touches the network: global.fetch is scripted, and every reply is either a
// string, a captured-shaped envelope or an HTTP error.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { withSandbox, S } = require('./helpers/env');   // FIRST, always

// ── a client with the configuration this test wants ────────────────────────
// llm.js freezes its whole configuration into module constants at require time
// (BASE, KEY, MODEL, ENABLE_THINKING, THINKING_EXTRA, jsonModeSupported), so the only
// way to exercise a different endpoint — or no api key, or thinking off — is to load
// the module again with a different environment. helpers/env.js has already replaced
// the cached llm.chat with its dispatcher; the fresh copy is handed back to the test
// and the dispatcher is put back in the cache, so nothing else can reach the real
// client through require('../llm').
const LLM_PATH = require.resolve('../llm');
const DISPATCHER = require.cache[LLM_PATH];

const CONFIG = {
  LLM_BASE_URL: 'http://llm.invalid/v1',
  LLM_API_KEY: 'test-key',
  LLM_ENABLE_THINKING: 'true',
  LLM_MODEL: undefined,            // left unset on purpose: the built-in default is
  LLM_THINKING_BUDGET: undefined,  // what production runs on, so it is what is tested
  LLM_JSON_MODE: undefined,
};

function loadLlm(overrides = {}) {
  const env = { ...CONFIG, ...overrides };
  const saved = {};
  for (const k of Object.keys(CONFIG)) {
    saved[k] = process.env[k];
    if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k];
  }
  delete require.cache[LLM_PATH];
  try {
    return require('../llm');
  } finally {
    require.cache[LLM_PATH] = DISPATCHER;
    for (const k of Object.keys(CONFIG)) {
      if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k];
    }
  }
}

const llm = loadLlm();

// ── a scripted endpoint ────────────────────────────────────────────────────
/**
 * Replace global.fetch with a queue of replies. A reply is a string (wrapped in a
 * normal 200 envelope), a whole envelope, `http(status, text)` for an error response,
 * or a function that receives the call and returns or throws whatever it likes.
 */
function scriptFetch(replies) {
  const calls = [];
  const real = global.fetch;
  global.fetch = async (url, init) => {
    const call = { url, init, body: JSON.parse(init.body) };
    calls.push(call);
    const reply = replies[calls.length - 1];
    // deliberately says nothing about networks or sockets: an over-eager retry loop
    // must fail the test, not be mistaken for a transport failure and retried again
    if (reply === undefined) throw new Error(`no scripted reply for call #${calls.length}`);
    if (typeof reply === 'function') return reply(call);
    if (typeof reply === 'string') return { ok: true, status: 200, async json() { return answer(reply); } };
    if (reply.__status) return { ok: false, status: reply.__status, async text() { return reply.__text; } };
    return { ok: true, status: 200, async json() { return reply; } };
  };
  return { calls, restore() { global.fetch = real; } };
}

const answer = (content) => ({
  choices: [{ finish_reason: 'stop', message: { content } }],
  usage: { prompt_tokens: 10, completion_tokens: 5 },
});
const http = (status, text) => ({ __status: status, __text: text });
const GOOD = '{"tests":[{"path":"test/a.test.ts"}]}';

// ── timers, without the wall clock ─────────────────────────────────────────
const realSetTimeout = global.setTimeout;
const realClearTimeout = global.clearTimeout;

/**
 * Record every timer llm.js sets. The give-up ceiling is minutes long, so it is kept
 * as a handle the test can fire on demand instead of waited for; everything shorter
 * (the retry backoff, and state.js's 150 ms save flush) still runs, just immediately.
 */
function captureTimers() {
  const delays = [];
  const live = new Set();
  global.setTimeout = (fn, ms) => {
    delays.push(ms);
    if (ms >= 60000) { const h = { fn, long: true }; live.add(h); return h; }
    return realSetTimeout(fn, 0);
  };
  global.clearTimeout = (h) => { if (h && h.long) live.delete(h); else realClearTimeout(h); };
  return {
    /** give-up timers still holding the process open */
    get live() { return [...live]; },
    fire() {
      const h = [...live][0];
      if (!h) throw new Error('no give-up timer is pending');
      live.delete(h);
      h.fn();
    },
    /** the retry backoff sleeps, in order */
    backoffs() { return delays.filter((d) => d >= 1000 && d < 60000); },
    /** the give-up ceiling each call was given */
    ceilings() { return delays.filter((d) => d >= 60000); },
    restore() { global.setTimeout = realSetTimeout; global.clearTimeout = realClearTimeout; },
  };
}

/** Fail fast instead of hanging when a call never settles. */
function deadline(promise, ms, what) {
  let timer;
  const guard = new Promise((_, reject) => {
    // deliberately shares no wording with what the tests assert on, so a call that
    // hangs can never be mistaken for the failure the test was looking for
    timer = realSetTimeout(() => reject(new Error(`nothing settled within ${ms}ms: ${what}`)), ms);
  });
  return Promise.race([promise, guard]).finally(() => realClearTimeout(timer));
}

/** A fresh pipeline world with a scripted endpoint and captured timers. */
function withEndpoint(replies, fn) {
  return withSandbox(async () => {
    const t = captureTimers();
    const f = scriptFetch(replies);
    try { return await fn(f, t); } finally { f.restore(); t.restore(); }
  });
}

const lastEvent = () => S.state.events[S.state.events.length - 1];
const lastDialog = () => S.state.dialog[S.state.dialog.length - 1];

// ═══════════════════════════════════════════════════════════════════════════
//  the configuration, as it is read once at require time
// ═══════════════════════════════════════════════════════════════════════════

test('a trailing slash on the configured endpoint does not become a doubled one', () =>
  withEndpoint([GOOD], async (f) => {
    // .env.example invites a copy-paste, and a pasted URL usually ends in a slash.
    // `${base}//chat/completions` is a 404 from every OpenAI-compatible server, which
    // surfaces as an unexplained HTTP error part-way into a run.
    const trailing = loadLlm({ LLM_BASE_URL: 'http://llm.invalid/v1/' });
    await trailing.chat({ prompt: 'x', maxTokens: 100, thinking: false });
    assert.equal(f.calls[0].url, 'http://llm.invalid/v1/chat/completions');
  }));

test('the request is a POST of JSON, bearing the api key and the model', () =>
  withEndpoint([GOOD], async (f) => {
    await llm.chat({ prompt: 'x', maxTokens: 100, thinking: false });
    assert.equal(f.calls[0].init.method, 'POST');
    assert.deepEqual(f.calls[0].init.headers, {
      'Content-Type': 'application/json',
      Authorization: 'Bearer test-key',
    });
    assert.equal(f.calls[0].body.model, 'qwen-3.6-27b-fp8',
      'the shipped default is what an operator who sets no LLM_MODEL actually runs');
  }));

test('LLM_MODEL is what reaches the endpoint when it is set', () =>
  withEndpoint([GOOD], async (f) => {
    const other = loadLlm({ LLM_MODEL: 'llama-4-70b' });
    await other.chat({ prompt: 'x', maxTokens: 100, thinking: false });
    assert.equal(f.calls[0].body.model, 'llama-4-70b');
  }));

test('a local endpoint that wants no key is sent an empty bearer, not a placeholder', () =>
  withEndpoint([GOOD], async (f) => {
    // Ollama and a bare vLLM take no key at all. Sending a made-up one is how you get
    // a 401 from a server that was never asking for authentication.
    const keyless = loadLlm({ LLM_API_KEY: undefined });
    await keyless.chat({ prompt: 'x', maxTokens: 100, thinking: false });
    assert.equal(f.calls[0].init.headers.Authorization, 'Bearer ');
  }));

test('a thinking call buys reasoning headroom on top of the answer budget', () =>
  withEndpoint([GOOD], async (f) => {
    // 4000 for the answer plus the 3000-token default reasoning budget. Nothing else
    // asserts this number, so the headroom could quietly become 0 — which is the exact
    // failure this whole module works around — or NaN, which max_tokens rejects.
    await llm.chat({ prompt: 'write a test', json: true, maxTokens: 4000 });
    assert.equal(f.calls[0].body.max_tokens, 7000);
  }));

test('LLM_THINKING_BUDGET moves that headroom', () =>
  withEndpoint([GOOD], async (f) => {
    const stingy = loadLlm({ LLM_THINKING_BUDGET: '500' });
    await stingy.chat({ prompt: 'write a test', json: true, maxTokens: 4000 });
    assert.equal(f.calls[0].body.max_tokens, 4500);
  }));

test('an endpoint configured without thinking neither thinks nor pays for it', () =>
  withEndpoint([GOOD, GOOD], async (f) => {
    // LLM_ENABLE_THINKING unset is the default a first-time operator runs on.
    const cold = loadLlm({ LLM_ENABLE_THINKING: undefined });
    await cold.chat({ prompt: 'write a test', json: true, maxTokens: 4000 });
    assert.equal(f.calls[0].body.chat_template_kwargs.enable_thinking, false);
    assert.equal(f.calls[0].body.max_tokens, 4000, 'no reasoning, no headroom');

    // and when a caller overrides it for one call, the budget it asked for is still
    // the budget it gets: the headroom belongs to the endpoint's configuration
    await cold.chat({ prompt: 'write a test', json: true, maxTokens: 4000, thinking: true });
    assert.equal(f.calls[1].body.max_tokens, 4000);
  }));

test('LLM_JSON_MODE=off stops the endpoint being asked for JSON at all', () =>
  withEndpoint([GOOD], async (f) => {
    // For a backend that answers 400 to response_format. Without the switch the first
    // JSON call of every run is spent discovering that.
    const freeForm = loadLlm({ LLM_JSON_MODE: 'off' });
    const r = await freeForm.chat({ prompt: 'write a test', json: true, maxTokens: 100 });
    assert.equal('response_format' in f.calls[0].body, false);
    assert.deepEqual(r.json, JSON.parse(GOOD), 'and the answer is still parsed');
  }));

test('an unconfigured endpoint is refused before a single byte is sent', () =>
  withEndpoint([], async (f) => {
    const unset = loadLlm({ LLM_BASE_URL: undefined });
    await assert.rejects(() => unset.chat({ prompt: 'x', maxTokens: 100 }), /LLM_BASE_URL is not set/);
    assert.equal(f.calls.length, 0, 'the prompt carries the operator source — it goes nowhere');
  }));

// ═══════════════════════════════════════════════════════════════════════════
//  the guard on the endpoint, at its edges
// ═══════════════════════════════════════════════════════════════════════════

test('an unset endpoint is told it is unset, not that it is malformed', () => {
  // `new URL('')` throws, so a guard that stops checking for empty first reports the
  // most confusing thing it could: that the empty string is not a valid url.
  const p = llm.endpointProblem('', 'sk-real');
  assert.match(p, /is not set/);
  assert.match(p, /OpenAI-compatible/, 'and says what to put there instead');
});

test('a base url that is not a url names the value it choked on', () => {
  // A hostname pasted without the scheme is the common miss. The value has to be in
  // the message: the operator has to see what they actually typed.
  const p = llm.endpointProblem('llm.invalid/v1', 'sk-real');
  assert.match(String(p), /not a valid url/);
  assert.match(String(p), /llm\.invalid\/v1/);
});

test('a host that merely starts with the example domain belongs to the operator', () => {
  // mikhailov.tech.example.com is a different machine. Refusing it would be a guard
  // that blocks a legitimate endpoint, which is how guards get deleted.
  assert.equal(llm.endpointProblem('https://mikhailov.tech.my-own-host.invalid/v1', 'sk-mine'), null);
});

test('the placeholder key is caught however .env.example spelled it', () => {
  for (const key of ['sk-replace_me', 'yourkey', 'your-key', 'your_key', 'sk-xxxxxxxx']) {
    assert.notEqual(llm.endpointProblem('https://my-own-host.invalid/v1', key), null,
      `${key} is a placeholder, not a key`);
  }
});

test('a real key that happens to contain sk-xxx later on is not a placeholder', () => {
  // The placeholder is anchored at the start for a reason: a live key is arbitrary
  // characters, and refusing to run because of a substring is a guard that lies.
  assert.equal(llm.endpointProblem('https://my-own-host.invalid/v1', 'prod-sk-xxx99'), null);
});

// ═══════════════════════════════════════════════════════════════════════════
//  the conversation that is sent
// ═══════════════════════════════════════════════════════════════════════════

test('a system-and-prompt call sends exactly those two turns', () =>
  withEndpoint([GOOD], async (f) => {
    await llm.chat({ system: 'you write tests', prompt: 'write one', maxTokens: 100, thinking: false });
    assert.deepEqual(f.calls[0].body.messages, [
      { role: 'system', content: 'you write tests' },
      { role: 'user', content: 'write one' },
    ]);
  }));

test('a call with no system prompt sends only the user turn', () =>
  withEndpoint([GOOD], async (f) => {
    // an empty system turn is not free: some backends reject it, and all of them
    // spend tokens on it
    await llm.chat({ prompt: 'write one', maxTokens: 100, thinking: false });
    assert.deepEqual(f.calls[0].body.messages, [{ role: 'user', content: 'write one' }]);
  }));

test('a call with no prompt at all sends an empty turn, not filler', () =>
  withEndpoint([GOOD], async (f) => {
    await llm.chat({ maxTokens: 100, thinking: false });
    assert.deepEqual(f.calls[0].body.messages, [{ role: 'user', content: '' }]);
  }));

test('a caller-supplied conversation is sent as-is, with nothing appended', () =>
  withEndpoint([GOOD], async (f) => {
    // /api/llm/chat forwards `messages` straight from the workflow. Appending a fresh
    // system turn and an empty user turn to an existing conversation changes what the
    // model is answering.
    const turns = [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }];
    await llm.chat({ messages: turns, system: 'ignored', prompt: 'ignored', maxTokens: 100, thinking: false });
    assert.deepEqual(f.calls[0].body.messages, turns);
  }));

test('the array a caller passed in is not written into by the repair turn', () =>
  withEndpoint(['not json at all', GOOD], async (f) => {
    // chat() copies before it pushes. Without the copy a caller that retries the same
    // conversation sends the failed answer and the repair nudge again, every time.
    const turns = [{ role: 'user', content: 'a' }];
    await llm.chat({ messages: turns, json: true, maxTokens: 100 });
    assert.deepEqual(turns, [{ role: 'user', content: 'a' }]);
    assert.equal(f.calls[1].body.messages.length, 3, 'the copy is what grew');
  }));

test('temperature defaults to 0.3, and an explicit 0 stays 0', () =>
  withEndpoint([GOOD, GOOD], async (f) => {
    // /api/llm/chat forwards body.temperature raw, so it is routinely undefined; 0 is
    // a deliberate ask for determinism and must not be read as "unset".
    await llm.chat({ prompt: 'x', maxTokens: 100, thinking: false });
    await llm.chat({ prompt: 'x', maxTokens: 100, thinking: false, temperature: 0 });
    assert.equal(f.calls[0].body.temperature, 0.3);
    assert.equal(f.calls[1].body.temperature, 0);
  }));

test('a free-form call does not ask for JSON mode', () =>
  withEndpoint(['just prose'], async (f) => {
    // response_format on a call whose answer is prose makes the model emit JSON and
    // the caller hand that to git as a commit message.
    await llm.chat({ prompt: 'summarise', maxTokens: 100, thinking: false });
    assert.equal('response_format' in f.calls[0].body, false);
  }));

test('the thinking flag goes on the wire as a boolean whatever the caller passed', () =>
  withEndpoint([GOOD], async (f) => {
    // /api/llm/chat forwards body.thinking untouched, so a workflow node that sends
    // 1 instead of true puts 1 into chat_template_kwargs and the jinja template
    // decides for itself what that means.
    await llm.chat({ prompt: 'x', maxTokens: 100, thinking: 1 });
    assert.strictEqual(f.calls[0].body.chat_template_kwargs.enable_thinking, true);
  }));

// ═══════════════════════════════════════════════════════════════════════════
//  the row the call leaves in the dialog
// ═══════════════════════════════════════════════════════════════════════════
//
// The dashboard's dialog view is the only record of what was asked and what came
// back; a run that produced nothing is diagnosed from it and nothing else.

test('a generation call is recorded as one, with the system turn kept out of the prompt', () =>
  withEndpoint([GOOD], async () => {
    await llm.chat({ system: 'you write tests', prompt: 'write one', json: true, maxTokens: 4000 });
    const d = lastDialog();
    assert.equal(d.kind, 'generation');
    assert.equal(d.system, 'you write tests');
    assert.equal(d.prompt, 'write one', 'the system turn has its own field');
    assert.equal(d.model, 'qwen-3.6-27b-fp8');
    assert.equal(d.thinking, true);
    assert.equal(d.maxTokens, 7000, 'the budget actually sent, headroom included');
    assert.equal(d.finishReason, 'stop');
    assert.equal(d.reasoningChars, 0);
    assert.equal(d.response, GOOD);
    assert.ok(d.durationMs >= 0 && d.durationMs < 60000,
      `a call takes milliseconds, not ${d.durationMs} — that is a timestamp, not a duration`);
  }));

test('a decision is recorded as a decision', () =>
  withEndpoint([GOOD], async () => {
    // the two kinds are costed and read separately: a decision that starts being
    // logged as a generation hides which half of a run is spending the time
    await llm.chat({ prompt: 'pick one', json: true, decision: true, maxTokens: 500 });
    const d = lastDialog();
    assert.equal(d.kind, 'decision');
    assert.equal(d.thinking, false);
    assert.equal(d.maxTokens, 500);
  }));

test('a call with no system prompt records an empty system, not filler', () =>
  withEndpoint([GOOD], async () => {
    await llm.chat({ prompt: 'write one', json: true, maxTokens: 100 });
    assert.equal(lastDialog().system, '');
  }));

test('several user turns are recorded with a separator between them', () =>
  withEndpoint([GOOD], async () => {
    // run together, "…install deps" and "npm test failed" read as one instruction
    await llm.chat({
      messages: [
        { role: 'user', content: 'a' },
        { role: 'assistant', content: 'b' },
        { role: 'user', content: 'c' },
      ],
      json: true, maxTokens: 100,
    });
    assert.equal(lastDialog().prompt, 'a\n---\nc');
  }));

test('the repair turn is recorded as a repair, with its own budget and no thinking', () =>
  withEndpoint(['not json at all', GOOD], async () => {
    await llm.chat({ prompt: 'write a test', json: true, maxTokens: 4000 });
    const d = lastDialog();
    assert.equal(d.kind, 'json-repair');
    assert.equal(d.thinking, false);
    assert.equal(d.model, 'qwen-3.6-27b-fp8');
    assert.match(d.system, /repair nudge/);
    assert.match(d.prompt, /ONLY the JSON/);
    assert.equal(d.response, GOOD);
    assert.equal(d.maxTokens, 4000, 'what the caller asked for, not the doubled retry budget');
    assert.ok(d.durationMs >= 0 && d.durationMs < 60000, `${d.durationMs} is not a duration`);
  }));

// ═══════════════════════════════════════════════════════════════════════════
//  salvage, and the retry that follows when there is nothing to salvage
// ═══════════════════════════════════════════════════════════════════════════

const stranded = (reasoning, content = null) => ({
  choices: [{ finish_reason: 'length', message: { content, reasoning } }],
  usage: { prompt_tokens: 10, completion_tokens: 2000 },
});

test('a salvaged answer is reported as salvaged, and the reasoning is its text', () =>
  withEndpoint([stranded('Let me write it.\n\n' + GOOD + '\n\nThat covers the branch.')], async (f) => {
    // A salvage that is logged as a normal answer makes a 200-second near-miss look
    // like a clean call, and the budget that caused it never gets raised.
    const r = await llm.chat({ prompt: 'write a test', json: true, maxTokens: 4000 });
    assert.equal(f.calls.length, 1);
    assert.deepEqual(r.json, JSON.parse(GOOD));
    assert.equal(r.text, 'Let me write it.\n\n' + GOOD + '\n\nThat covers the branch.',
      'the caller is handed what the model actually produced');
    const ev = lastEvent();
    assert.equal(ev.stage, 'llm');
    assert.match(ev.msg, /salvaged/);
    assert.match(ev.msg, /finish_reason=length/, 'the diagnosis is the finish reason');
  }));

test('an answer that arrived is not thrown away for a draft in the reasoning', () =>
  withEndpoint([{
    choices: [{
      finish_reason: 'stop',
      message: { content: GOOD, reasoning: 'First idea: {"tests":[{"path":"draft.ts"}]} — no, better:' },
    }],
    usage: { prompt_tokens: 10, completion_tokens: 40 },
  }], async () => {
    // Salvage is the fallback for an EMPTY answer. Reaching into the reasoning when
    // content parsed fine returns the discarded draft — a file the model rejected.
    const r = await llm.chat({ prompt: 'write a test', json: true, maxTokens: 4000 });
    assert.equal(r.json.tests[0].path, 'test/a.test.ts');
    assert.equal(r.text, GOOD);
  }));

test('the reasoning_content field is read as reasoning too', () =>
  withEndpoint([{
    choices: [{ finish_reason: 'length', message: { content: null, reasoning_content: 'drafting…\n' + GOOD } }],
    usage: { prompt_tokens: 10, completion_tokens: 2000 },
  }], async (f) => {
    // The channel is `reasoning` on some builds and `reasoning_content` on others.
    // Reading only one of them turns a salvageable answer into another 200-second call.
    const r = await llm.chat({ prompt: 'write a test', json: true, maxTokens: 4000 });
    assert.equal(f.calls.length, 1, 'the answer was already paid for');
    assert.deepEqual(r.json, JSON.parse(GOOD));
  }));

test('the repair turn carries at most four thousand characters of a long answer', () =>
  withEndpoint(['{"tests": [' + 'x'.repeat(6000), GOOD], async (f) => {
    // The whole point of the carry is that it is bounded: handing back an unbounded
    // answer on top of the original prompt is how the retry runs out of context.
    await llm.chat({ prompt: 'write a test', json: true, maxTokens: 4000 });
    const carried = f.calls[1].body.messages.find((m) => m.role === 'assistant').content;
    assert.equal(carried.length, 4000);
    assert.equal(carried, ('{"tests": [' + 'x'.repeat(6000)).slice(0, 4000));
  }));

test('with no answer at all, the repair carries the LAST three thousand characters of the reasoning', () =>
  withEndpoint([stranded('x'.repeat(2000) + 'y'.repeat(3000)), GOOD], async (f) => {
    // Where the model got to is the end of its reasoning, not the beginning: the head
    // is it re-reading the prompt.
    await llm.chat({ prompt: 'write a test', json: true, maxTokens: 4000 });
    const carried = f.calls[1].body.messages.find((m) => m.role === 'assistant').content;
    assert.equal(carried, 'My reasoning so far (cut off):\n' + 'y'.repeat(3000));
  }));

test('a reply with nothing in it at all says so, and carries a placeholder turn', () =>
  withEndpoint([{ choices: [{ message: { content: '' } }], usage: { prompt_tokens: 10, completion_tokens: 0 } }, GOOD],
    async (f) => {
      // No content, no reasoning, no finish_reason — a backend that just gave up. An
      // empty assistant turn is rejected outright by some of them, so there has to be
      // something in it, and the log has to say the reasoning channel was empty too
      // (otherwise the diagnosis points at a budget that was never the problem).
      await llm.chat({ prompt: 'write a test', json: true, maxTokens: 4000 });
      const carried = f.calls[1].body.messages.find((m) => m.role === 'assistant').content;
      assert.equal(carried, '(no answer)');
      const ev = lastEvent();
      assert.match(ev.msg, /0 chars of reasoning/);
      assert.match(ev.msg, /finish_reason=,/, 'an absent finish reason is reported as absent');
      assert.match(ev.msg, /7000 token budget/, 'and the budget it failed to fit into');
    }));

test('the nudge after an empty answer gives all three instructions', () =>
  withEndpoint([stranded('thinking about it, at length'), GOOD], async (f) => {
    // "reply with only the JSON" alone leaves the model free to think itself out of
    // budget again, and without "no markdown fences" it wraps the answer in ```json.
    await llm.chat({ prompt: 'write a test', json: true, maxTokens: 4000 });
    const lastUser = [...f.calls[1].body.messages].reverse().find((m) => m.role === 'user');
    assert.match(lastUser.content, /ran out of tokens/);
    assert.match(lastUser.content, /reasoning short/);
    assert.match(lastUser.content, /ONLY the JSON/);
    assert.match(lastUser.content, /no markdown fences/);
  }));

test('the nudge after a malformed answer asks only for the JSON again', () =>
  withEndpoint(['here you go: {"tests": [oops', GOOD], async (f) => {
    await llm.chat({ prompt: 'write a test', json: true, maxTokens: 4000 });
    const lastUser = [...f.calls[1].body.messages].reverse().find((m) => m.role === 'user');
    assert.match(lastUser.content, /not valid JSON/);
    assert.match(lastUser.content, /no markdown fences/);
  }));

test('a malformed answer is logged as a parse failure, with how much came back', () =>
  withEndpoint(['here you go: {"tests": [oops', GOOD], async () => {
    // "JSON parse failed" and "no content" are different diagnoses with different
    // fixes; the character count is what tells them apart at a glance.
    const bad = 'here you go: {"tests": [oops';
    await llm.chat({ prompt: 'write a test', json: true, maxTokens: 4000 });
    const ev = lastEvent();
    assert.equal(ev.stage, 'llm');
    assert.match(ev.msg, /JSON parse failed/);
    assert.ok(ev.msg.includes(`${bad.length} chars returned`), `got: ${ev.msg}`);
    assert.match(ev.msg, /finish_reason=stop/);
  }));

test('the retry budget is the failed one doubled, and stops at the context window', () =>
  withEndpoint(['not json at all', GOOD, 'not json at all', GOOD], async (f) => {
    // Doubling is the point: the attempt that failed proved the old ceiling too low.
    // 24000 is the other end — a request over the window is a 400, not a slow answer.
    await llm.chat({ prompt: 'write a test', json: true, maxTokens: 4000 });
    assert.equal(f.calls[0].body.max_tokens, 7000);
    assert.equal(f.calls[1].body.max_tokens, 14000);

    await llm.chat({ prompt: 'write a test', json: true, maxTokens: 20000 });
    assert.equal(f.calls[2].body.max_tokens, 23000);
    assert.equal(f.calls[3].body.max_tokens, 24000, 'capped, not 46000');
  }));

test('a retry for a call that named no budget still asks for a number', () =>
  withEndpoint(['not json at all', GOOD], async (f) => {
    // maxTokens is optional, and NaN in max_tokens is a 400 from every backend —
    // the retry would fail on a request that never left the client.
    await llm.chat({ prompt: 'write a test', json: true });
    assert.equal(f.calls[0].body.max_tokens, 7096);
    assert.equal(f.calls[1].body.max_tokens, 14192);
  }));

// ═══════════════════════════════════════════════════════════════════════════
//  what happens when the endpoint answers with a failure
// ═══════════════════════════════════════════════════════════════════════════
//
// None of this half of post() is reached by any other test: every existing reply is
// `ok: true`.

test('a 429 is retried once the rate limiter has had three seconds', () =>
  withEndpoint([http(429, 'rate limit exceeded'), GOOD], async (f, t) => {
    const r = await deadline(llm.chat({ prompt: 'x', json: true, maxTokens: 100 }), 2000, 'the retried call');
    assert.equal(f.calls.length, 2);
    assert.deepEqual(r.json, JSON.parse(GOOD));
    assert.deepEqual(t.backoffs(), [3000], 'retrying a rate limit immediately just spends the next one');
  }));

test('a 500 is retried twice and then reported with its status and body', () =>
  withEndpoint([http(500, 'upstream exploded'), http(500, 'upstream exploded'), http(500, 'upstream exploded')],
    async (f, t) => {
      // Three attempts, then stop: a backend that is down stays down, and the run has
      // other files to get to. The backoff grows so the third try is not the same
      // moment as the first.
      await assert.rejects(
        () => deadline(llm.chat({ prompt: 'x', json: true, maxTokens: 100 }), 2000, 'the call to give up'),
        /LLM HTTP 500: upstream exploded/);
      assert.equal(f.calls.length, 3);
      assert.deepEqual(t.backoffs(), [3000, 6000]);
    }));

test('a 400 is not retried — sending the same bad request twice cannot help', () =>
  withEndpoint([http(400, 'bad request: temperature out of range')], async (f, t) => {
    await assert.rejects(
      () => deadline(llm.chat({ prompt: 'x', json: true, maxTokens: 100 }), 2000, 'the failing call'),
      /LLM HTTP 400: bad request: temperature out of range/);
    assert.equal(f.calls.length, 1);
    assert.deepEqual(t.backoffs(), [], 'and nothing was waited for');
  }));

test('only the first three hundred characters of an error body reach the message', () =>
  withEndpoint([http(400, 'E'.repeat(1000))], async () => {
    // The event log clips at 500 characters, so an unclipped HTML error page from a
    // proxy pushes the status code — the only useful part — out of the record.
    await assert.rejects(
      () => deadline(llm.chat({ prompt: 'x', json: true, maxTokens: 100 }), 2000, 'the failing call'),
      (e) => {
        assert.equal(e.message, 'LLM HTTP 400: ' + 'E'.repeat(300));
        return true;
      });
  }));

test('an endpoint that rejects response_format is retried without it, once and for all', () =>
  withEndpoint([http(400, 'unrecognized argument: response_format'), GOOD, GOOD], async (f) => {
    // A backend without JSON mode used to fail every single call. The fallback has to
    // stick: rediscovering it costs a wasted call at every step of every run.
    // its own client: the fallback is permanent, and it must not leak into the tests
    // that come after this one
    const own = loadLlm();
    const r = await deadline(own.chat({ prompt: 'x', json: true, maxTokens: 100 }), 2000, 'the retried call');
    assert.deepEqual(f.calls[0].body.response_format, { type: 'json_object' });
    assert.equal('response_format' in f.calls[1].body, false, 'the same request, minus the part it refused');
    assert.deepEqual(r.json, JSON.parse(GOOD), 'and the answer still parses');

    await own.chat({ prompt: 'y', json: true, maxTokens: 100 });
    assert.equal('response_format' in f.calls[2].body, false, 'the endpoint is not asked a second time');

    const ev = S.state.events.find((e) => /JSON mode/.test(e.msg));
    assert.ok(ev, `nothing in the log says why JSON mode stopped: ${JSON.stringify(S.state.events)}`);
    assert.equal(ev.stage, 'llm');
    assert.match(ev.msg, /free-form/);
  }));

test('an error mentioning an unexpected argument on a call that sent none is just an error', () =>
  withEndpoint([http(400, 'unexpected keyword argument')], async (f) => {
    // The fallback strips response_format. On a call that never sent one there is
    // nothing to strip, so re-sending the identical request is an endless loop.
    await assert.rejects(
      () => deadline(llm.chat({ prompt: 'x', maxTokens: 100 }), 2000, 'the failing call'),
      /LLM HTTP 400: unexpected keyword argument/);
    assert.equal(f.calls.length, 1);
  }));

// ═══════════════════════════════════════════════════════════════════════════
//  transport failures, and the timer we set ourselves
// ═══════════════════════════════════════════════════════════════════════════

const throws = (name, message) => () => { const e = new Error(message); e.name = name; throw e; };

test('a transport failure is retried twice with a growing backoff', () =>
  withEndpoint([throws('TypeError', 'fetch failed'), throws('TypeError', 'fetch failed'), throws('TypeError', 'fetch failed')],
    async (f, t) => {
      // A dropped connection is not deterministic: the same request a moment later
      // usually works, and giving up on the first one loses the whole file.
      await assert.rejects(
        () => deadline(llm.chat({ prompt: 'x', json: true, maxTokens: 100 }), 2000, 'the call to give up'),
        /fetch failed/);
      assert.equal(f.calls.length, 3);
      assert.deepEqual(t.backoffs(), [3000, 6000]);
    }));

test('an abort that arrives dressed as a socket error is still not retried', () =>
  withEndpoint([throws('AbortError', 'socket hang up'), GOOD], async (f) => {
    // Live, three identical escalations aborted at exactly the same ceiling for 631
    // seconds of nothing. The message is whatever the runtime felt like; the name is
    // what says the deadline was ours, and it has to be enough on its own.
    await assert.rejects(
      () => deadline(llm.chat({ prompt: 'x', json: true, maxTokens: 100 }), 2000, 'the aborted call'),
      /socket hang up/);
    assert.equal(f.calls.length, 1);
  }));

test('a thinking call is given fifteen minutes, a cold one five, and neither timer outlives it', () =>
  withEndpoint([GOOD, GOOD], async (f, t) => {
    // A give-up timer that is never cleared keeps the sidecar's event loop alive for
    // its full ceiling after every single call.
    await llm.chat({ prompt: 'x', json: true, maxTokens: 100 });
    await llm.chat({ prompt: 'x', json: true, decision: true, maxTokens: 100 });
    assert.deepEqual(t.ceilings(), [900000, 300000]);
    assert.deepEqual(t.live, [], 'a finished call leaves nothing holding the process open');
    assert.equal(f.calls.length, 2);
  }));

test('a call that never answers is aborted when its ceiling passes', () =>
  withEndpoint([(call) => new Promise((_, reject) => {
    call.init.signal.addEventListener('abort', () => {
      const e = new Error('This operation was aborted');
      e.name = 'AbortError';
      reject(e);
    });
  })], async (f, t) => {
    // Without the abort the call sits there forever and the run stops, silently, with
    // no event and no failure — the one outcome the operator cannot diagnose.
    const p = llm.chat({ prompt: 'x', json: true, maxTokens: 100 });
    t.fire();
    await assert.rejects(() => deadline(p, 2000, 'the ceiling to end the call'), (e) => {
      // the NAME is what the retry logic keys on: a ceiling we set ourselves is
      // deterministic, and re-running it buys another identical wait
      assert.equal(e.name, 'AbortError');
      assert.match(e.message, /This operation was aborted/);
      return true;
    });
    assert.equal(f.calls.length, 1, 'and an abort we caused is not retried');
  }));

// ═══════════════════════════════════════════════════════════════════════════
//  replies that are not the shape the client expects
// ═══════════════════════════════════════════════════════════════════════════

test('a reply with no choices at all is an empty answer, not a crash', () =>
  withEndpoint([{ usage: { prompt_tokens: 1, completion_tokens: 0 } }], async () => {
    // vLLM returns exactly this when the request was cancelled server-side. A crash
    // here loses the run; an empty answer takes the repair path like any other.
    const r = await llm.chat({ prompt: 'x', maxTokens: 100, thinking: false });
    assert.equal(r.text, '');
  }));

test('a choice with no message is an empty answer too', () =>
  withEndpoint([{ choices: [{ finish_reason: 'length' }], usage: { prompt_tokens: 1, completion_tokens: 0 } }],
    async () => {
      const r = await llm.chat({ prompt: 'x', maxTokens: 100, thinking: false });
      assert.equal(r.text, '');
    }));

// The example-host rejection these two tests pinned is gone: it took production down on
// deploy, because the host it rejected is this operator's own endpoint. .env.example now
// ships no url at all, so a value being present is the operator's explicit choice, and
// the guard checks only that a choice was made. See sidecar/test/llm-config.test.js.
test('a configured endpoint passes the guard whichever host it names', () => {
  assert.equal(llm.endpointProblem('https://inference.mikhailov.tech/v1', 'sk-real'), null);
  assert.equal(llm.endpointProblem('http://localhost:11434/v1', ''), null);
});
