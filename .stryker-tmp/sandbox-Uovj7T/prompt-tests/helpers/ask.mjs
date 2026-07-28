// @ts-nocheck
// The one thing these tests need that a unit test must never have: the real endpoint.
//
// Every file here is an ordinary node:test file — same runner, same reporter, same
// --test-name-pattern filtering as the rest of the suite. What makes them a separate
// LAYER is only that they are excluded from `npm test`'s glob and skip themselves
// when the endpoint is not configured, so a clean checkout stays offline and fast.
export const LIVE = !!process.env.LLM_BASE_URL;
export const skipUnlessLive = LIVE ? false : 'set LLM_BASE_URL/LLM_API_KEY/LLM_MODEL to run prompt tests';

const BASE = (process.env.LLM_BASE_URL || '').replace(/\/$/, '');

export async function ask({ system, prompt, maxTokens = 4000, temperature = 0.2, thinking = false, json = true }) {
  const t0 = Date.now();
  const res = await fetch(BASE + '/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.LLM_API_KEY },
    body: JSON.stringify({
      model: process.env.LLM_MODEL,
      messages: [...(system ? [{ role: 'system', content: system }] : []), { role: 'user', content: prompt }],
      max_tokens: maxTokens, temperature,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
      chat_template_kwargs: { enable_thinking: thinking },
    }),
  });
  const d = await res.json();
  const m = d.choices?.[0]?.message || {};
  return {
    status: res.status, secs: (Date.now() - t0) / 1000,
    content: m.content || '', reasoning: String(m.reasoning ?? m.reasoning_content ?? ''),
    finishReason: d.choices?.[0]?.finish_reason || '', usage: d.usage || {},
  };
}

/**
 * The model is not deterministic, so a single sample proves nothing either way.
 * Run it n times and assert on the count — and always report every sample, because
 * "2 of 3" with the failure printed is information and a bare pass is not.
 */
export async function samples(n, fn) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(await fn(i));
  for (const s of out) console.log(`      ${s.ok ? '·' : '✗'} ${s.note}`);
  return { out, passed: out.filter((s) => s.ok).length, total: n };
}
