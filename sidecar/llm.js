'use strict';
// OpenAI-compatible chat client for the vLLM endpoint (qwen), zero-dep via global fetch.
const { extractJson, extractLastJsonObject } = require('./util');
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
  // Measured against this endpoint rather than assumed (A/B, 2026-07-26):
  //   json_object + thinking ON  → 200, content 60ch, reasoning 929ch, finish=stop
  //   json_object + thinking OFF → 200, content 37ch, reasoning 0ch, 15 tokens, 1s
  //   no chat_template_kwargs    → reasoning 754ch — thinking is the DEFAULT here
  // So JSON mode and thinking are NOT mutually exclusive. An earlier comment here
  // claimed they were; what actually happens is that a long reasoning phase can
  // exhaust max_tokens before any content is emitted, which has nothing to do with
  // response_format and happens just as readily without it.
  //
  // What each kind of call gets, and why:
  //   every JSON call → response_format. Constraining the output removes the whole
  //     parse-failure class, and it costs nothing.
  //   decision calls  → no thinking. Measured: a pick answers in 1s and 15 tokens
  //     without it and 7s with it, and the model still reasons inside the `reason`
  //     field. Paying 7x for a shortlist ordering is not worth it.
  //   generation calls → thinking. That channel is what keeps chain-of-thought out
  //     of committed tests (D11).
  const wantsJson = !!opts.json && jsonModeSupported;
  const thinking = ENABLE_THINKING && !opts.decision;
  const body = {
    model: MODEL,
    messages,
    max_tokens: (opts.maxTokens || 4096) + (thinking ? THINKING_EXTRA : 0),
    temperature: opts.temperature ?? 0.3,
    chat_template_kwargs: { enable_thinking: thinking },
  };
  if (wantsJson) body.response_format = { type: 'json_object' };
  const structured = wantsJson && !!opts.decision;
  const startedAt = Date.now();
  const first = await post(body);
  const text = first.content;
  recordDialog({
    kind: structured ? 'decision' : 'generation',
    thinking, model: MODEL,
    system: messages.find((m) => m.role === 'system')?.content || '',
    prompt: messages.filter((m) => m.role === 'user').map((m) => m.content).join('\n---\n'),
    response: text,
    durationMs: Date.now() - startedAt,
    maxTokens: body.max_tokens,
    finishReason: first.finishReason,
    reasoningChars: first.reasoning.length,
  });
  if (!opts.json) return { text };
  let parsed = extractJson(text);
  // The model drafts its answer inside the reasoning channel and then repeats it as
  // content. When the budget runs out in between, the finished answer is sitting in
  // `reasoning` and we have already paid for it — re-asking costs another ~200s for
  // something we hold. Only a COMPLETE object is taken: half a test file would be
  // written to disk and fail to parse as JavaScript.
  if (parsed == null && first.reasoning) {
    const salvaged = extractLastJsonObject(first.reasoning);
    if (salvaged != null) {
      event('llm', `model emitted no content (finish_reason=${first.finishReason}) but a complete answer was in its reasoning — salvaged, no retry`);
      return { text: first.reasoning, json: salvaged };
    }
  }
  if (parsed == null) {
    // The recorded failures are not verbose answers, they are EMPTY ones: the
    // reasoning channel spends the completion budget before any visible output, so
    // `content` arrives blank or cut off mid-token — after ~158 seconds. Re-running
    // that same configuration is a long gamble on the same dice. The repair turn
    // therefore thinks NOT AT ALL: it has the previous attempt and an explicit
    // instruction, which is what the reasoning was for.
    // Two different failures need two different things said. "Your previous answer
    // was not valid JSON" is simply untrue when there was no answer, and a model
    // asked to reconcile a false statement wastes the retry doing it.
    const ranOut = text.length === 0;
    event('llm', ranOut
      ? `model returned NO CONTENT (finish_reason=${first.finishReason}, ${first.reasoning.length} chars of reasoning, `
        + `${body.max_tokens} token budget) — the answer never left the reasoning channel; retrying without thinking`
      : `JSON parse failed (${text.length} chars returned, finish_reason=${first.finishReason}), retrying without thinking`);
    messages.push({ role: 'assistant', content: text.slice(0, 4000) || '(no answer — the reasoning phase used the whole budget)' });
    messages.push({
      role: 'user',
      content: ranOut
        ? 'You spent the entire token budget thinking and never produced the answer. '
          + 'Do not think this time: reply immediately with ONLY the JSON, no prose, no markdown fences.'
        : 'Your previous answer was not valid JSON. Reply again with ONLY the JSON, no prose, no markdown fences.',
    });
    const t0 = Date.now();
    const retryRes = await post({
      ...body,
      messages,
      temperature: 0.1,
      max_tokens: opts.maxTokens || 4096,
      chat_template_kwargs: { enable_thinking: false },
    });
    const retry = retryRes.content;
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
    const choice = data.choices?.[0] || {};
    // finish_reason and the reasoning channel are the whole diagnosis when content
    // comes back empty, and both used to be discarded here — leaving "JSON parse
    // failed" as the only symptom of a model that never emitted an answer at all.
    return {
      content: choice.message?.content || '',
      finishReason: choice.finish_reason || '',
      reasoning: choice.message?.reasoning || choice.message?.reasoning_content || '',
    };
  } catch (e) {
    if (attempt < 2 && /abort|network|fetch failed|ECONN/i.test(String(e.message))) {
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
      return post(body, attempt + 1);
    }
    throw e;
  } finally { clearTimeout(timer); }
}

module.exports = { chat };
