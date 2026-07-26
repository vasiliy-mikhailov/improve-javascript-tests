'use strict';
// OpenAI-compatible chat client for the vLLM endpoint (qwen), zero-dep via global fetch.
const { extractJson } = require('./util');
const { event, recordTokens, recordDialog } = require('./state');

const BASE = (process.env.LLM_BASE_URL || '').replace(/\/$/, '');
const KEY = process.env.LLM_API_KEY || '';
const MODEL = process.env.LLM_MODEL || 'qwen-3.6-27b-fp8';
const ENABLE_THINKING = String(process.env.LLM_ENABLE_THINKING || 'false') === 'true';
// thinking consumes completion tokens before any visible output — give it headroom
const THINKING_EXTRA = ENABLE_THINKING ? parseInt(process.env.LLM_THINKING_BUDGET || '3000', 10) : 0;

/**
 * chat({system, prompt, messages, maxTokens, temperature, json})
 * json=true → returns parsed object (retries once with a repair nudge).
 */
async function chat(opts) {
  const messages = opts.messages && opts.messages.length ? opts.messages.slice() : [];
  if (!messages.length) {
    if (opts.system) messages.push({ role: 'system', content: opts.system });
    messages.push({ role: 'user', content: opts.prompt || '' });
  }
  // Thinking mode and JSON mode CANNOT be combined on this backend: with both on,
  // the reasoning channel consumes the whole completion budget and `content` comes
  // back empty (finish_reason=length), which is worse than no JSON mode at all.
  // So each call picks one:
  //   decision calls (small structured answers) → JSON mode, no thinking. The model
  //     still reasons, inside the "reason" field, and the answer always parses.
  //   generation calls (test code)              → thinking, free-form + repair. The
  //     thinking channel is what keeps chain-of-thought out of committed tests (D11).
  const structured = !!opts.decision && !!opts.json && jsonModeSupported;
  const thinking = ENABLE_THINKING && !structured;
  const body = {
    model: MODEL,
    messages,
    max_tokens: (opts.maxTokens || 4096) + (thinking ? THINKING_EXTRA : 0),
    temperature: opts.temperature ?? 0.3,
    chat_template_kwargs: { enable_thinking: thinking },
  };
  if (structured) body.response_format = { type: 'json_object' };
  const startedAt = Date.now();
  const text = await post(body);
  recordDialog({
    kind: structured ? 'decision' : 'generation',
    thinking, model: MODEL,
    system: messages.find((m) => m.role === 'system')?.content || '',
    prompt: messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n---\n'),
    response: text,
    durationMs: Date.now() - startedAt,
    maxTokens: body.max_tokens,
  });
  if (!opts.json) return { text };
  let parsed = extractJson(text);
  if (parsed == null) {
    // The recorded failures are not verbose answers, they are EMPTY ones: the
    // reasoning channel spends the completion budget before any visible output, so
    // `content` arrives blank or cut off mid-token — after ~158 seconds. Re-running
    // that same configuration is a long gamble on the same dice. The repair turn
    // therefore thinks NOT AT ALL: it has the previous attempt and an explicit
    // instruction, which is what the reasoning was for.
    event('llm', `JSON parse failed (${text.length} chars returned), retrying without thinking`);
    messages.push({ role: 'assistant', content: text.slice(0, 4000) });
    messages.push({ role: 'user', content: 'Your previous answer was not valid JSON. Reply again with ONLY the JSON, no prose, no markdown fences.' });
    const t0 = Date.now();
    const retry = await post({
      ...body,
      messages,
      temperature: 0.1,
      max_tokens: opts.maxTokens || 4096,
      chat_template_kwargs: { enable_thinking: false },
    });
    recordDialog({
      kind: 'json-repair', thinking: false, model: MODEL,
      system: '(repair nudge — the previous answer was not valid JSON)',
      prompt: 'Reply again with ONLY the JSON.',
      response: retry, durationMs: Date.now() - t0, maxTokens: opts.maxTokens || 4096,
    });
    parsed = extractJson(retry);
  }
  return { text, json: parsed };
}

// Flipped to false the first time the endpoint refuses response_format, so a
// backend without JSON mode degrades to the old free-form + repair path instead
// of failing every call.
let jsonModeSupported = String(process.env.LLM_JSON_MODE || 'auto') !== 'off';

async function post(body, attempt = 0) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 300000);
  try {
    const res = await fetch(BASE + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + KEY },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const errText = (await res.text()).slice(0, 300);
      // endpoint does not know response_format → drop it permanently and retry once
      if (jsonModeSupported && body.response_format && /response_format|guided|json_object|unrecognized|unexpected/i.test(errText)) {
        jsonModeSupported = false;
        event('llm', 'endpoint rejected JSON mode — falling back to free-form output with repair retries');
        const { response_format, ...plain } = body;
        return post(plain, attempt);
      }
      if (attempt < 2 && (res.status === 429 || res.status >= 500)) {
        await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
        return post(body, attempt + 1);
      }
      throw new Error(`LLM HTTP ${res.status}: ${errText}`);
    }
    const data = await res.json();
    // every call is counted, including the JSON-repair retry below: that is real
    // spend, and hiding it would understate the cost of a flaky response
    recordTokens(data.usage);
    return data.choices?.[0]?.message?.content || '';
  } catch (e) {
    if (attempt < 2 && /abort|network|fetch failed|ECONN/i.test(String(e.message))) {
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
      return post(body, attempt + 1);
    }
    throw e;
  } finally { clearTimeout(timer); }
}

module.exports = { chat };
