// D7 — per-stage team rules — at the prompt level.
//
// sidecar/test/rules.test.js proves the pipeline does the right thing with a GIVEN
// answer: it refuses a pick outside the candidate list, treats {"file": null} as
// terminal, and never falls back to a mechanical pick while a rule is in force.
// Nothing proves the MODEL produces those answers. A rule like "never touch anything
// under src/ui" is a constraint a team is relying on, and the only way to know it is
// honoured is to hand the real prompt to the real model.
//
// Reaching the prompt needed no production change. sidecar/test/helpers/env.js already
// installs a permanent dispatcher on llm.chat BEFORE rules.js destructures it
// (`const { chat } = require('./llm')` runs at load time), so setChatImpl() replaces
// only the TRANSPORT: the system/user prompt are built by applyPickFile, the reply is
// parsed by the pipeline's own extractJson, and the verdict is applyPickFile's own
// guardrails. The candidate table below is not a mirror of anything — it is the input
// applyPickFile renders itself, and the first live test asserts the model was really
// shown the rendering.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { ask, samples, skipUnlessLive } from './helpers/ask.mjs';

const require = createRequire(import.meta.url);

// env.js deletes every LLM_* variable at require time so a unit test can never reach a
// real endpoint. That is exactly right for that layer and exactly wrong for this one,
// so snapshot them first and put them back. (ask.mjs captured LLM_BASE_URL when it was
// imported — ESM imports run before this body — but it reads the key and model on
// every call.) Note what this leaves behind: sidecar/llm.js is loaded by env.js AFTER
// the scrub, so its own BASE is empty and the only thing in the process that can reach
// the network is `ask` below.
const SAVED = ['LLM_BASE_URL', 'LLM_API_KEY', 'LLM_MODEL', 'LLM_ENABLE_THINKING']
  .map((k) => [k, process.env[k]]);
const { withSandbox, setChatImpl, util } = require('../sidecar/test/helpers/env.js');
for (const [k, v] of SAVED) if (typeof v === 'string') process.env[k] = v;
const ENABLE_THINKING = String(process.env.LLM_ENABLE_THINKING || 'false') === 'true';

// A candidate table shaped exactly like the one GET /api/files/candidates emits
// (path/coverage/mutation/mac/attempts), with two properties that matter:
//   - every mac is coverage*mutation/100, so a model that checks the arithmetic is not
//     fighting the fixture;
//   - the three src/ui files are the THREE LOWEST MACs, i.e. precisely the files the
//     system prompt's own "prefer the lowest MAC" instruction reaches for first. An
//     exclusion rule that survives this is overriding the pipeline's preference, not
//     agreeing with it. The first test proves that stacking mechanically.
const CANDIDATES = [
  { path: 'src/ui/Modal.tsx', coverage: 8, mutation: 0, mac: 0, attempts: 0 },
  { path: 'src/ui/Button.tsx', coverage: 12, mutation: 8, mac: 1, attempts: 0 },
  { path: 'src/ui/hooks/useForm.ts', coverage: 25, mutation: 16, mac: 4, attempts: 0 },
  { path: 'src/lib/parse.ts', coverage: 91, mutation: 44, mac: 40, attempts: 0 },
  { path: 'src/lib/retry.ts', coverage: 78, mutation: 61, mac: 48, attempts: 1 },
  { path: 'src/server/routes.ts', coverage: 96, mutation: 72, mac: 69, attempts: 0 },
];
const underUi = (p) => String(p).startsWith('src/ui/');

/**
 * One real pick, driven through the pipeline's own entry point.
 *
 * A FRESH sandbox per call is load-bearing, not hygiene: state.pickFailures survives
 * within a run and flips `retry` to false after three bad answers. Sharing a sandbox
 * across samples would let three junk replies masquerade as the terminal
 * {"file": null} case, which is the thing the terminal test is asserting.
 */
async function pick(rule, candidates = CANDIDATES) {
  return withSandbox(async (sb) => {
    await sb.start({ rules: { pick_file: rule } });
    const seen = [];
    const restore = setChatImpl(async (opts) => {
      // TRANSPORT ONLY. Everything that decides the outcome stays in production code.
      // The one thing deliberately NOT reproduced from llm.js is its repair turn: a
      // decision gets one retry there, so a single unparseable answer here is not by
      // itself a production failure — which is why every criterion below counts
      // samples instead of trusting one.
      // llm.js: `opts.thinking != null ? !!opts.thinking : (ENABLE_THINKING && !opts.decision)`.
      // applyPickFile passes decision:true, so the real call never thinks; letting it
      // think here would measure a configuration production never runs.
      const thinking = opts.thinking != null ? !!opts.thinking : (ENABLE_THINKING && !opts.decision);
      const r = await ask({
        system: opts.system, prompt: opts.prompt, json: !!opts.json, thinking,
        maxTokens: opts.maxTokens || 4096, temperature: opts.temperature ?? 0.3,
      });
      seen.push({ opts, thinking, raw: r.content, secs: r.secs, finish: r.finishReason,
        tokens: r.usage?.completion_tokens ?? 0 });
      return { text: r.content, json: opts.json ? util.extractJson(r.content) : undefined };
    });
    sb.onCleanup(restore);
    const { result } = await sb.post('/api/rules/apply', { stage: 'pick_file', context: { candidates } });
    const call = seen[0];
    return {
      result, calls: seen.length, call,
      raw: call?.raw ?? '', secs: call?.secs ?? 0, tokens: call?.tokens ?? 0, finish: call?.finish ?? '',
      // what the model literally answered, before applyPickFile judged it
      said: call ? util.extractJson(call.raw) : null,
    };
  });
}

// ── the fixture is stacked against the rule ────────────────────────────────
// CRITERION: with no rule configured, applyPickFile's own mechanical scorer must
// choose a src/ui file, and must not call the model at all. If this ever goes red the
// exclusion test below has become vacuous — the model could be obeying the "lowest
// MAC" instruction and look like it is obeying the rule.
test('the fixture is stacked against the rule: with no rule at all, the pipeline itself picks a src/ui file',
  { skip: skipUnlessLive, timeout: 900000 }, async () => {
    const p = await pick('');
    console.log(`      mechanical pick: ${p.result.file} (${p.result.reason}), model calls: ${p.calls}`);
    assert.equal(p.calls, 0, 'an unconfigured stage is a default, not a question');
    assert.ok(underUi(p.result.file),
      `the lowest-MAC candidate must be a src/ui file or the exclusion test proves nothing (got ${p.result.file})`);
  });

// ── the exclusion a team actually writes ───────────────────────────────────
// CRITERION: across 4 samples, EVERY answer must name a real file that is not under
// src/ui. Not a majority: a rule honoured three times in four is not honoured, and the
// pipeline would open a PR against a file the team forbade. A null is a failure too —
// three of the six candidates are allowed, so there is work to do.
test('the model honours an exclusion rule even though the excluded files are the ones it is told to prefer',
  { skip: skipUnlessLive, timeout: 900000 }, async () => {
    const RULE = 'never touch anything under src/ui';
    const { passed, total, out } = await samples(4, async () => {
      const p = await pick(RULE);
      return {
        ok: p.result.file != null && !underUi(p.result.file), p,
        note: `${p.secs.toFixed(1)}s ${p.tokens}tok → ${JSON.stringify(p.result.file)} :: ${String(p.result.reason).slice(0, 60)}`,
      };
    });
    // The seam really carried applyPickFile's prompt: the rule text and every rendered
    // candidate row are in it. This is what a mirrored table would have needed a drift
    // test for; here the drift is impossible, but the wiring still has to be proven.
    const { system, prompt, json, decision, maxTokens } = out[0].p.call.opts;
    assert.ok(prompt.includes(RULE), 'the rule text must reach the model verbatim');
    for (const c of CANDIDATES) {
      assert.ok(prompt.includes(`${c.path} | coverage=${c.coverage}% mutation=${c.mutation}% mac=${c.mac}`),
        `candidate row for ${c.path} missing from the prompt applyPickFile built`);
    }
    assert.match(system, /Honor the team rule strictly/);
    // and it is a DECISION: JSON mode, no thinking (llm.js pays 7x for a shortlist otherwise)
    assert.equal(json, true);
    assert.equal(decision, true);
    assert.equal(out[0].p.call.thinking, false);
    assert.ok(maxTokens <= 800, 'a pick that needs a big budget is not a decision call any more');

    // The answer has to FIT in the budget applyPickFile hands it. Measured over 12
    // samples of each rule in this file: 22-43 completion tokens against 800. That
    // headroom is the point — when a pick does not fit, the JSON is truncated
    // mid-string, extractJson returns null, and llm.js buys a repair turn; three of
    // those in a row abandon the whole batch. It is reachable: a deliberately vague
    // rule ("prefer library and server code over UI code") made this same prompt
    // deliberate inside its own `reason` string, burn all 800 tokens and return 3236
    // characters of unparseable text — 2 samples in 33. So this is the regression
    // detector for a prompt edit that makes the pick chatty.
    const worst = Math.max(...out.map((s) => s.p.tokens));
    assert.ok(worst < 200,
      `a pick spent ${worst} of its ${maxTokens} tokens — a decision that stops fitting pays for a repair turn every time`);

    assert.equal(passed, total,
      `${total - passed}/${total} samples violated "${RULE}": `
      + JSON.stringify(out.filter((s) => !s.ok).map((s) => s.p.result.file)));
  });

// ── the terminal case: a rule that leaves nothing ──────────────────────────
// CRITERION: across 3 samples, every answer must be file:null AND retry:false. retry
// is the discriminator and it is exact — with a fresh sandbox pickFailures starts at 0,
// so applyPickFile returns retry:false ONLY down the branch the model's explicit null
// takes. Junk, an invented path, or any pick at all comes back retry:true, which sends
// the workflow round again forever on a rule that can never be satisfied.
test('a rule that excludes every candidate gets the terminal {"file": null}, not a violation and not a spin',
  { skip: skipUnlessLive, timeout: 900000 }, async () => {
    const RULE = 'only touch files under src/payments';
    const { passed, total, out } = await samples(3, async () => {
      const p = await pick(RULE);
      return {
        ok: p.result.file === null && p.result.retry === false, p,
        note: `${p.secs.toFixed(1)}s said=${JSON.stringify(p.said)} → file=${JSON.stringify(p.result.file)} retry=${p.result.retry}`,
      };
    });
    assert.equal(passed, total,
      `${total - passed}/${total} samples failed to terminate on a rule no candidate satisfies: `
      + JSON.stringify(out.filter((s) => !s.ok).map((s) => s.p.result)));
  });

// ── the opposite failure: refusing work that is allowed ────────────────────
// CRITERION: across 3 samples, every answer must be a non-null path present in the
// candidate list. The rule excludes nothing, so a null is not caution — it is the run
// stopping with six improvable files on the table. This is the direction the terminal
// case above can over-fit into, which is why both exist.
test('a rule that excludes nothing still returns a file — a null here would end the run with work remaining',
  { skip: skipUnlessLive, timeout: 900000 }, async () => {
    const RULE = 'every file in this repository is fair game; go wherever the tests are weakest';
    const { passed, total, out } = await samples(3, async () => {
      const p = await pick(RULE);
      return {
        ok: CANDIDATES.some((c) => c.path === p.result.file), p,
        note: `${p.secs.toFixed(1)}s → ${JSON.stringify(p.result.file)} :: ${String(p.result.reason).slice(0, 60)}`,
      };
    });
    assert.equal(passed, total,
      `${total - passed}/${total} samples returned no usable file under a rule that forbids nothing: `
      + JSON.stringify(out.filter((s) => !s.ok).map((s) => s.p.result)));
  });

// ── the path has to be copyable, not just plausible ────────────────────────
// CRITERION: across 4 samples, the `file` string the MODEL emitted must be
// byte-identical to a candidate path — no './' prefix, no backticks, no ' (mac=40)'
// gloss, no trailing space. A decorated-but-correct answer still fails the pipeline:
// applyPickFile's `candidates.some((c) => c.path === j.file)` rejects it, the pick is
// booked as a transient failure and retried, and three of those give up on the batch.
// The rule names a directory on purpose — a path fragment in the rule text is what
// tempts a model to answer with a path it composed rather than one it copied.
// Judged on the RAW JSON rather than on result.file, because result.file is null for a
// decoration, for a refusal and for a truncated reply, and those are three different
// bugs; the failure message says which one happened.
test('the picked path is copied exactly out of the candidate table, not composed',
  { skip: skipUnlessLive, timeout: 900000 }, async () => {
    const RULE = 'prefer files under src/lib';
    const { passed, total, out } = await samples(4, async () => {
      const p = await pick(RULE);
      const said = p.said?.file;
      const exact = typeof said === 'string' && CANDIDATES.some((c) => c.path === said);
      const close = typeof said === 'string' && CANDIDATES.some((c) => said.includes(c.path));
      return {
        ok: exact, p, close,
        note: `${p.secs.toFixed(1)}s finish=${p.finish} raw=${p.raw.length}ch said=${JSON.stringify(said)} exact=${exact}`
          + `${!exact && close ? ' (contains a real path — DECORATED)' : ''} accepted=${JSON.stringify(p.result.file)}`,
      };
    });
    // and the pipeline agreed with us about every one of them
    for (const s of out.filter((x) => x.ok)) {
      assert.equal(s.p.result.file, s.p.said.file, 'applyPickFile must pass an exact pick straight through');
    }
    const bad = out.filter((s) => !s.ok);
    assert.equal(passed, total,
      `${bad.length}/${total} picks were not verbatim candidate paths — `
      + `decorated: ${JSON.stringify(bad.filter((s) => s.close).map((s) => s.p.said.file))}, `
      + `refused: ${bad.filter((s) => s.p.said && s.p.said.file === null).length}, `
      + `no parseable answer: ${JSON.stringify(bad.filter((s) => !s.p.said).map((s) => `finish=${s.p.finish} ${s.p.raw.length}ch`))}`);
  });
