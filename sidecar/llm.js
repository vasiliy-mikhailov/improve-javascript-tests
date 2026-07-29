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

// The endpoint has to be the operator's own. .env.example used to ship a working URL —
// the author's inference host — beside `LLM_API_KEY=sk-replace_me`, so the natural edit
// was to paste a real key and leave the URL, sending that key and up to 24000 characters
// of the operator's source to someone else's machine. Refuse before anything is sent,
// and name the variable that is wrong.
const EXAMPLE_HOSTS = /(^|\.)mikhailov\.tech$/i;
function endpointProblem(base = BASE, key = KEY) {
  if (!base) return 'LLM_BASE_URL is not set — point it at any OpenAI-compatible /v1 endpoint (vLLM, Ollama, OpenAI)';
  let host = '';
  try { host = new URL(base).hostname; } catch { return `LLM_BASE_URL is not a valid url: ${base}`; }
  if (EXAMPLE_HOSTS.test(host)) {
    return `LLM_BASE_URL still points at the example host (${host}) — set it to your own endpoint before running, `
      + 'or your api key and your source code are sent to a machine you do not control';
  }
  // an empty key is fine: local endpoints usually want none. A placeholder is not.
  if (/replace_me|^sk-xxx|your[-_]?key/i.test(key)) return 'LLM_API_KEY is still the placeholder from .env.example';
  return null;
}

/**
 * chat({system, prompt, messages, maxTokens, temperature, json})
 * json=true → returns parsed object (retries once with a repair nudge).
 */
async function chat(opts) {
  const problem = endpointProblem();
  if (problem) throw new Error(problem);
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
  // opts.thinking is an explicit override: the mutant loop tries a kill test WITHOUT
  // reasoning first (measured 21-28s against 112-186s for the same prompt) and only
  // escalates when that attempt fails to kill anything.
  const thinking = opts.thinking != null ? !!opts.thinking : (ENABLE_THINKING && !opts.decision);
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
    // Hand back the work it already did. Its reasoning is where the answer was being
    // written, so resuming from it beats an apology and a blank page.
    const carry = text.slice(0, 4000)
      || (first.reasoning ? `My reasoning so far (cut off):\n${first.reasoning.slice(-3000)}` : '(no answer)');
    messages.push({ role: 'assistant', content: carry });
    messages.push({
      role: 'user',
      content: ranOut
        ? 'You ran out of tokens while thinking and never produced the answer. Keep your remaining '
          + 'reasoning short — you have already done the analysis above — and reply with ONLY the JSON, '
          + 'no prose, no markdown fences.'
        : 'Your previous answer was not valid JSON. Reply again with ONLY the JSON, no prose, no markdown fences.',
    });
    const t0 = Date.now();
    // KEEP thinking for generation. The calls that exhaust the budget are, by
    // selection, the hard ones: a mutant that survived everything else, whose kill
    // test has to hit an edge case nobody has asserted yet. Answering that without
    // reasoning buys a cheap answer to the question we most needed answered well.
    // What failed was the BUDGET, so the budget is what changes. (Decision calls
    // never had thinking, so this leaves them exactly as they were.)
    // If the first attempt deliberately did not think, thinking is exactly what the
    // retry has left to offer; otherwise keep it and give it room to finish.
    const retryRes = await post({
      ...body,
      messages,
      temperature: 0.1,
      max_tokens: Math.min(Math.max(body.max_tokens, opts.maxTokens || 4096) * 2, 24000),
      chat_template_kwargs: { enable_thinking: true },
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

/**
 * How long a call may take before we give up on it. Reasoning legitimately runs long —
 * measured 112-186s median and past 280s at the tail — so a single ceiling turned the
 * slowest and therefore HARDEST calls into guaranteed failures.
 */
function timeoutFor(thinking) { return thinking ? 900000 : 300000; }

async function post(body, attempt = 0) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutFor(body.chat_template_kwargs?.enable_thinking));
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
    // Never retry an abort WE caused: the same request takes the same time and hits the
    // same ceiling. Live, that turned two slow escalations into 631s and 447s of
    // nothing — three attempts each, all identical, all aborted. Transport failures are
    // different and still worth a second go.
    const ours = e.name === 'AbortError' || /operation was aborted/i.test(String(e.message));
    if (!ours && attempt < 2 && /network|fetch failed|ECONN|socket/i.test(String(e.message))) {
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
      return post(body, attempt + 1);
    }
    throw e;
  } finally { clearTimeout(timer); }
}

module.exports = { chat, timeoutFor, endpointProblem };
