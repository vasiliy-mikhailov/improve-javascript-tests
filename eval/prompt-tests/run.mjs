// PROMPT TESTS — unit-sized, but they call the real model.
//
// A unit test asks "does our code do what we meant?" and answers it with fakes, in
// milliseconds, deterministically. These ask a different question: "does the MODEL do
// what our prompt asks?" Nothing but the real endpoint can answer that, so they are
// non-hermetic, slow and probabilistic — and they must never run inside `npm test`,
// which has to stay fast and offline.
//
// What keeps them test-shaped rather than vibes:
//   - one prompt, one criterion, decided MECHANICALLY (it kills the mutant / it
//     compiles / the comment is gone). Never "looks reasonable".
//   - N samples with a pass threshold, because the model is not deterministic.
//   - the prompt comes from the pipeline's own builders, so a prompt edit is what
//     these catch.
//
// Run: npm run test:prompts            (all)
//      npm run test:prompts -- kill    (cases whose name matches)
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = (process.env.LLM_BASE_URL || '').replace(/\/$/, '');
if (!BASE) {
  console.error('LLM_BASE_URL is not set. These tests call the real endpoint:\n'
    + "  export $(grep -E '^LLM_(BASE_URL|API_KEY|MODEL)=' .env.production | xargs)");
  process.exit(2);
}

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

const filter = process.argv[2] || '';
const files = readdirSync(join(HERE, 'cases')).filter((f) => f.endsWith('.mjs')).sort();
let failed = 0, total = 0;
for (const f of files) {
  const mod = await import(join(HERE, 'cases', f));
  for (const c of mod.cases) {
    if (filter && !`${f} ${c.name}`.includes(filter)) continue;
    total += 1;
    const samples = [];
    for (let i = 0; i < (c.samples || 3); i++) samples.push(await c.run(ask, i));
    const passes = samples.filter((s) => s.ok).length;
    const need = c.threshold ?? samples.length;         // default: every sample
    const ok = passes >= need;
    if (!ok) failed += 1;
    const secs = (samples.reduce((s, x) => s + (x.secs || 0), 0) / samples.length).toFixed(0);
    console.log(`${ok ? 'ok  ' : 'FAIL'}  ${c.name}  — ${passes}/${samples.length} (need ${need}), ${secs}s avg`);
    for (const s of samples) if (s.note) console.log(`        ${s.ok ? '·' : '✗'} ${s.note}`);
  }
}
console.log(`\n${total - failed}/${total} prompt tests passed`);
process.exit(failed ? 1 : 0);
