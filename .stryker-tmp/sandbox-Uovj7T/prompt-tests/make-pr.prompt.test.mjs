// @ts-nocheck
// The last prompt family without a test: the PULL REQUEST the pipeline opens.
//
// Everything upstream can be perfect and a team still meets this and only this. The
// body is the only place the work is explained, and `labels` is handed to `gh pr
// create`, where a string instead of an array is a hard failure at the very last step.
//
// Driven through the pipeline's own entry point — rules.apply('make_pr') — with only
// the TRANSPORT intercepted, so the system prompt, the context rendering and every
// guardrail are production code. Same pattern as pick-file-rule.prompt.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ask, samples, skipUnlessLive } from './helpers/ask.mjs';

const require = createRequire(import.meta.url);

// helpers/env.js scrubs every LLM_* variable at require time so a UNIT test can never
// reach the network. Right for that layer, wrong for this one — snapshot and restore.
const SAVED = ['LLM_BASE_URL', 'LLM_API_KEY', 'LLM_MODEL', 'LLM_ENABLE_THINKING']
  .map((k) => [k, process.env[k]]);
const { withSandbox, setChatImpl } = require('../sidecar/test/helpers/env.js');
for (const [k, v] of SAVED) if (typeof v === 'string') process.env[k] = v;

// The context /api/pr/create hands to this stage after a real improvement.
const CTX = {
  file: 'src/checkout/quote.js',
  branch: 'tests/improve-src-checkout-quote',
  coverageBefore: 41, coverageAfter: 96,
  mutationBefore: 12, mutationAfter: 58,
  macBefore: 4.92, macAfter: 55.68,
  changedFiles: ['test/quote.mac.test.js'],
  tokens: { in: 18420, out: 6310, calls: 9 },
};

async function makePr(rule) {
  return withSandbox(async (sb) => {
    await sb.start({ rules: { make_pr: rule } });
    let raw = null;
    const restore = setChatImpl(async (opts) => {
      // transport only — the prompt and every guardrail stay in production code
      const r = await ask({
        system: opts.system, prompt: opts.prompt, json: !!opts.json,
        thinking: false,                    // applyMakePr passes decision:true
        maxTokens: opts.maxTokens, temperature: opts.temperature ?? 0.3,
      });
      raw = r;
      const { extractJson } = require('../sidecar/util.js');
      return { text: r.content, json: extractJson(r.content) };
    });
    try {
      const resp = await sb.call('POST /api/rules/apply', { stage: 'make_pr', context: CTX });
      return { result: resp.result ?? resp, raw };
    } finally { restore(); }
  });
}

test('the PR body states what actually changed — every before/after number is in it',
  { skip: skipUnlessLive, timeout: 900000 }, async () => {
    // CRITERION: the body contains all six figures. A PR that says "improved tests"
    // without them asks a reviewer to take the whole thing on faith, and those numbers
    // are the only claim the pipeline is entitled to make.
    const { passed, total, out } = await samples(3, async () => {
      const { result } = await makePr('Keep PR bodies short and factual.');
      const body = String(result.body || '');
      const want = ['41', '96', '12', '58', '4.92', '55.68'];
      const missing = want.filter((n) => !body.includes(n));
      return {
        ok: missing.length === 0,
        note: `${body.length}ch, missing ${JSON.stringify(missing)}, title ${JSON.stringify(String(result.title).slice(0, 60))}`,
      };
    });
    assert.equal(passed, total, `a PR body dropped its own metrics: ${JSON.stringify(out.filter((s) => !s.ok).map((s) => s.note))}`);
  });

test('a team PR-style rule is obeyed in the title', { skip: skipUnlessLive, timeout: 900000 }, async () => {
  // CRITERION: the literal prefix a team asked for is present. This is D7 at the last
  // stage of the pipeline, and it is the stage where a violation is most visible.
  const { passed, total, out } = await samples(3, async () => {
    const { result } = await makePr('Every PR title MUST begin with the literal prefix "[tests] ". No exceptions.');
    const title = String(result.title || '');
    return { ok: title.startsWith('[tests] '), note: JSON.stringify(title.slice(0, 70)) };
  });
  assert.ok(passed >= 2, `the title prefix rule was ignored in ${total - passed}/${total} samples: `
    + JSON.stringify(out.filter((s) => !s.ok).map((s) => s.note)));
});

test('labels always reach gh as an array, whatever the model sends',
  { skip: skipUnlessLive, timeout: 900000 }, async () => {
    // CRITERION: Array.isArray(labels). applyMakePr repairs a non-array, so this asserts
    // the REPAIR holds under real answers — a string here fails `gh pr create` at the
    // last step of a run that did everything else right.
    const { passed, total } = await samples(3, async () => {
      const { result } = await makePr('Label every PR with "tests" and the area, e.g. checkout.');
      return { ok: Array.isArray(result.labels), note: `labels=${JSON.stringify(result.labels)}` };
    });
    assert.equal(passed, total, 'a non-array label list breaks gh pr create');
  });

test('the PR names the file it improved', { skip: skipUnlessLive, timeout: 900000 }, async () => {
  const { passed, total } = await samples(3, async () => {
    const { result } = await makePr('Keep PR bodies short and factual.');
    const both = `${result.title}\n${result.body}`;
    return { ok: both.includes('quote.js'), note: JSON.stringify(String(result.title).slice(0, 70)) };
  });
  assert.equal(passed, total, 'one PR per improved file only means something if the PR says which file');
});
