// The DECISION at the head of the mutant loop: of the survivors Stryker reported,
// which one does the pipeline attack next?
//
// "Did it pick the BEST mutant" is not mechanically checkable, so it is not attempted
// here. What is checkable is everything the loop actually consumes from this answer:
//   - it names a mutant Stryker really reported (an invented one would send the test
//     writer after something that does not exist)
//   - it carries a reason and a killIdea — killIdea is handed verbatim to the kill
//     prompt, so an empty one degrades the next call silently
//   - a shortlist of ONE still comes back usable
//   - a mutant that already resisted a targeted test is not chosen again
//   - it parses on the FIRST call: JSON mode + thinking off is the configuration
//     chosen precisely because it always parses, and a repair turn in llm.js means
//     that choice was wrong
//
// The prompt is the pipeline's own (mutants.buildPickRequest) and it is read back by
// the pipeline's own parser (util.extractJson, then mutants.resolvePick) — the exact
// pair sidecar/server.js's GET /api/mutant/next uses. Nothing here is retyped, so an
// edit to the prompt text shows up in this file and nowhere else in the suite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ask, samples, skipUnlessLive } from './helpers/ask.mjs';
import { buildPickRequest, resolvePick, shortlist } from '../sidecar/mutants.js';
import { extractJson } from '../sidecar/util.js';

const FILE = 'src/checkout/quote.js';

// A file with the shape that actually reaches this prompt: a covered main path whose
// survivors need sharper assertions, plus an uncovered guard and a debug log whose
// mutants are unobservable. Both kinds have to be on the table for the choice to mean
// anything.
const SOURCE = `// Order quoting for the checkout page: subtotal, tier discount, shipping.
// Extracted from the React component so it can be tested without a browser.
const FREE_SHIPPING_FLOOR = 75;
const HEAVY_KG = 20;
const RATES = { standard: 4.95, express: 12.5 };

function round(n) {
  return Math.round(n * 100) / 100;
}

export function quote(order, customer = {}) {
  if (!order || !Array.isArray(order.items) || order.items.length === 0) {
    return { total: 0, shipping: 0, discount: 0, note: 'empty order' };
  }
  const subtotal = order.items.reduce((s, i) => s + i.price * i.qty, 0);
  const weightKg = order.items.reduce((s, i) => s + i.weightKg * i.qty, 0);

  let discount = 0;
  if (customer.tier === 'gold') discount = subtotal * 0.2;
  else if (customer.tier === 'silver') discount = subtotal * 0.1;
  if (discount > 50) discount = 50;

  const net = subtotal - discount;
  let shipping = RATES[order.speed] ?? RATES.standard;
  if (weightKg >= HEAVY_KG) shipping += (weightKg - HEAVY_KG) * 0.75;
  if (net >= FREE_SHIPPING_FLOOR && order.speed !== 'express') shipping = 0;

  if (order.debug) console.warn('quote: net=' + net + ', shipping=' + shipping);
  return { total: round(net + shipping), shipping: round(shipping), discount: round(discount) };
}
`;
const LINES = SOURCE.split('\n');

/** Line/column are looked up, never typed: a fixture edit must not silently move a mutant. */
function at(needle) {
  const i = LINES.findIndex((l) => l.includes(needle));
  if (i < 0) throw new Error(`fixture drift: no source line contains ${JSON.stringify(needle)}`);
  return i + 1;
}

/** Exactly the window sidecar/stryker.js parseReport attaches to every survivor. */
function contextFor(line) {
  const from = Math.max(0, line - 6);
  const to = Math.min(LINES.length, line + 5);
  return LINES.slice(from, to).map((l, i) => `${from + i + 1}: ${l}`).join('\n');
}

let seq = 0;
/** A survivor in parseReport's exact shape: id, mutator, line, column, endLine, replacement, status, file, context. */
function mut(needle, token, mutator, replacement, status = 'survived') {
  const line = at(needle);
  const column = LINES[line - 1].indexOf(token) + 1;
  if (column === 0) throw new Error(`fixture drift: ${JSON.stringify(token)} not on line ${line}`);
  return { id: `${FILE}#${seq++}`, mutator, line, column, endLine: line, replacement, status, file: FILE, context: contextFor(line) };
}

const HEAVY = 'weightKg >= HEAVY_KG';
const FLOOR = 'net >= FREE_SHIPPING_FLOOR';
const CAP = 'discount > 50';

// Fourteen survivors, which is how the real thing arrives — more than the shortlist
// holds, so the ranker truncates to twelve and the model sees the size it sees in
// production. Ten covered ('survived'), four uncovered ('nocoverage').
const SURVIVORS = [
  // the same `>=` yields two Stryker mutants at one position: `>` and `<`
  mut(HEAVY, '>=', 'EqualityOperator', 'weightKg > HEAVY_KG'),
  mut(HEAVY, '>=', 'EqualityOperator', 'weightKg < HEAVY_KG'),
  mut(FLOOR, '>=', 'EqualityOperator', 'net > FREE_SHIPPING_FLOOR'),
  mut(FLOOR, '&&', 'LogicalOperator', "net >= FREE_SHIPPING_FLOOR || order.speed !== 'express'"),
  mut('* 0.75', '*', 'ArithmeticOperator', '(weightKg - HEAVY_KG) / 0.75'),
  mut('net + shipping', '+', 'ArithmeticOperator', 'net - shipping'),
  mut(CAP, '>', 'EqualityOperator', 'discount >= 50'),
  mut('subtotal * 0.1', '*', 'ArithmeticOperator', 'subtotal / 0.1'),
  mut("'silver'", "'silver'", 'StringLiteral', '""'),
  mut('Math.round(n * 100)', '*', 'ArithmeticOperator', 'Math.round(n / 100) / 100'),
  // the uncovered guard and the debug log — mutants a test cannot observe, or can only
  // observe after reaching code no test reaches
  mut('order.debug', 'order.debug', 'ConditionalExpression', 'false', 'nocoverage'),
  mut("'quote: net='", "'quote: net='", 'StringLiteral', '""', 'nocoverage'),
  mut("note: 'empty order'", "'empty order'", 'StringLiteral', '""', 'nocoverage'),
  mut('order.items.length === 0', '===', 'EqualityOperator', 'order.items.length !== 0', 'nocoverage'),
];

// What a team's AGENTS.md typically contributes by the time rules.testWritingConstraints()
// has run; they ride along in the prompt and must not derail the answer.
const CONSTRAINTS = [
  'Use vitest with describe/it and expect',
  'Never modify source files to make a test pass',
  'No snapshot tests',
];

const CANDIDATES = shortlist(SURVIVORS, { attempts: {} });

/**
 * One live pick, through the production path end to end: the pipeline's builder, the
 * transport settings the builder itself declares, the pipeline's JSON extractor, the
 * pipeline's resolver. `thinking: false` is not a choice made here — it is what
 * llm.js derives from `decision: true`, asserted below so the two cannot drift apart.
 */
async function pick(candidates, opts = {}) {
  const req = buildPickRequest(candidates, { file: FILE, source: SOURCE, constraints: CONSTRAINTS, ...opts });
  assert.equal(req.decision, true, 'llm.js turns thinking off for decision calls; this test mirrors that');
  assert.equal(req.json, true);
  const r = await ask({
    system: req.system, prompt: req.prompt, json: req.json,
    thinking: false, maxTokens: req.maxTokens, temperature: req.temperature,
  });
  const json = extractJson(r.content);         // the parse llm.js does before it decides to repair
  return { r, json, resolved: resolvePick(json, candidates) };
}

test('the shortlist handed to the model is the production one: twelve candidates, best-first',
  { skip: skipUnlessLive, timeout: 30000 }, () => {
    // Not a model test — a guard on the fixture. Every assertion below is about a
    // twelve-item list, and a fixture that quietly produced nine would weaken them all.
    assert.equal(CANDIDATES.length, 12, 'mutants.shortlist caps at 12; the fixture must exercise that cap');
    assert.equal(CANDIDATES.filter((m) => m.status === 'survived').length, 10);
    assert.ok(CANDIDATES.every((m) => m.context && m.replacement), 'candidates carry parseReport context');
  });

test('the model picks a mutant Stryker actually reported, so the loop never attacks a phantom',
  { skip: skipUnlessLive, timeout: 900000 }, async () => {
    // CRITERION: in every sample, extractJson yields an object AND resolvePick maps it
    // to an element of the shortlist by identity. resolvePick returning null is not a
    // crash — server.js falls back to the ranked top candidate — but the whole point of
    // paying for this call is that the model, not the ranker, chooses. A sample that
    // does not resolve is a call bought and thrown away.
    const { passed, total, out } = await samples(4, async () => {
      const { r, json, resolved } = await pick(CANDIDATES);
      const inList = !!resolved && CANDIDATES.includes(resolved.mutant);
      const asIndex = Number.isInteger(Number(json?.pick)) && Number(json.pick) >= 1 && Number(json.pick) <= CANDIDATES.length;
      return {
        ok: inList, asIndex,
        note: `${r.secs.toFixed(1)}s pick=${JSON.stringify(json?.pick)} → `
          + (resolved ? `${resolved.mutant.mutator}@${resolved.mutant.line} (in shortlist=${inList})` : 'UNUSABLE — heuristic fallback'),
      };
    });
    console.log(`      answered with a list index (not a line number): ${out.filter((s) => s.asIndex).length}/${total}`);
    assert.equal(passed, total,
      `${total - passed}/${total} picks did not resolve to a shortlisted mutant — those calls are paid for and discarded`);
  });

test('every pick carries the two strings the next prompt consumes: a reason and a kill idea',
  { skip: skipUnlessLive, timeout: 900000 }, async () => {
    // CRITERION: in every sample, resolved.reason and resolved.killIdea are non-empty
    // after trimming. killIdea is not decoration — server.js returns it as `killIdea`
    // and the kill prompt interpolates it verbatim, so an empty one silently removes a
    // whole section of the test-writing prompt with no error anywhere.
    const { passed, total } = await samples(4, async () => {
      const { r, resolved } = await pick(CANDIDATES);
      const reason = (resolved?.reason || '').trim();
      const idea = (resolved?.killIdea || '').trim();
      return {
        ok: reason.length > 0 && idea.length > 0,
        note: `${r.secs.toFixed(1)}s reason=${reason.length}ch killIdea=${idea.length}ch — ${JSON.stringify(idea.slice(0, 90))}`,
      };
    });
    assert.equal(passed, total, 'an empty killIdea degrades the kill prompt without failing anything');
  });

test('a shortlist of ONE still produces a usable answer instead of a refusal',
  { skip: skipUnlessLive, timeout: 900000 }, async () => {
    // The degenerate case for a "choose one of these" prompt: there is nothing to
    // choose, and a model can respond to that with an empty pick or a "N/A". server.js
    // short-circuits to the heuristic at one candidate today, so nothing is broken in
    // production if this is weak — but buildPickRequest accepts a one-item list, and
    // the killIdea for that lone mutant is worth having whether or not today's caller
    // asks for it. This is the test that would notice if that stopped being true.
    //
    // CRITERION: in every sample the answer resolves to the only candidate, with a
    // non-empty reason and killIdea.
    const only = CANDIDATES.slice(0, 1);
    const { passed, total } = await samples(3, async () => {
      const { r, json, resolved } = await pick(only);
      const ok = !!resolved && resolved.mutant === only[0]
        && resolved.reason.trim().length > 0 && resolved.killIdea.trim().length > 0;
      return { ok, note: `${r.secs.toFixed(1)}s pick=${JSON.stringify(json?.pick)} reason=${(resolved?.reason || '').length}ch killIdea=${(resolved?.killIdea || '').length}ch` };
    });
    assert.equal(passed, total, 'a one-item shortlist must still yield a mutant, a reason and a kill idea');
  });

test('a mutant that already resisted a targeted test is not chosen again',
  { skip: skipUnlessLive, timeout: 900000 }, async () => {
    // The `failed` block exists because a mutant that survived a test written to kill
    // it is usually equivalent, and re-picking it burns a full generation for nothing.
    //
    // Note WHICH mutants can still be picked despite being listed: server.js rebuilds
    // the failed list by splitting mutantKey and keeping only `mutator` and `line`,
    // while the shortlist filter matches on the full key (mutator|line|column|
    // replacement). So a sibling mutant at the same position — `>=` → `<` next to the
    // already-failed `>=` → `>` — stays in the candidate list and is indistinguishable
    // from the failed one in the rendered prompt. That is the first ban below.
    //
    // The other two bans are what make this test DISCRIMINATING rather than decorative.
    // Ban only mutants the model was never going to choose and every sample passes
    // without the failed block having been read at all. So the bans are this model's
    // measured favourites on this exact shortlist with NO failure history: across 8
    // unbanned samples it chose `net + shipping` 5 times and round()'s `n * 100` twice
    // — 7 of 8. A pass here therefore means the block moved the answer; a model that
    // ignored it would fail most samples.
    //
    // CRITERION: in every sample the pick resolves, and the picked mutant's
    // (mutator, line) pair does not appear in the `failed` block.
    const banned = [
      { mutator: 'EqualityOperator', line: at(HEAVY), attempts: 1 },              // the sibling case
      { mutator: 'ArithmeticOperator', line: at('net + shipping'), attempts: 1 }, // 5 of 8 unbanned picks
      { mutator: 'ArithmeticOperator', line: at('Math.round(n * 100)'), attempts: 2 }, // 2 of 8
    ];
    const isBanned = (m) => banned.some((b) => b.mutator === m.mutator && b.line === m.line);
    // precondition: the ban really does cover candidates that are still on the list,
    // or the criterion below is satisfied by an empty intersection and proves nothing
    const exposed = CANDIDATES.filter(isBanned);
    assert.equal(exposed.length, 4, 'three failed keys, four same-position candidates still offered (the `>=` pair counts twice)');
    assert.ok(CANDIDATES.filter((m) => !isBanned(m)).length >= 8, 'and plenty of alternatives remain');

    const { passed, total } = await samples(4, async () => {
      const { r, resolved } = await pick(CANDIDATES, { failed: banned });
      const m = resolved?.mutant;
      return {
        ok: !!m && !isBanned(m),
        note: `${r.secs.toFixed(1)}s → ${m ? `${m.mutator}@${m.line} ${JSON.stringify(String(m.replacement).slice(0, 40))}` : 'UNUSABLE'}`
          + (m && isBanned(m) ? '  ← RE-PICKED A FAILED TARGET' : ''),
      };
    });
    assert.equal(passed, total,
      `${total - passed}/${total} picks landed on a mutant the loop already failed on — each one costs a full generation for a target that is probably equivalent`);
  });

test('the decision configuration parses on the first call — llm.js never buys a repair turn here',
  { skip: skipUnlessLive, timeout: 900000 }, async () => {
    // JSON mode with thinking OFF is chosen for this call precisely because it always
    // parses; llm.js only reaches its repair branch when extractJson returns null, and
    // a repair turn costs a second round trip at double the budget. So the criterion is
    // llm.js's own condition, not a stricter one of this test's invention.
    //
    // CRITERION: in every sample extractJson(content) !== null (no repair), the answer
    // finishes on 'stop' rather than 'length' (the 2000-token budget is not tight), and
    // the reasoning channel is empty (the deployment honours thinking:false, which is
    // what makes a decision call cheap).
    const { passed, total, out } = await samples(3, async () => {
      const { r, json } = await pick(CANDIDATES);
      let strict = true;
      try { JSON.parse(r.content); } catch { strict = false; }
      return {
        ok: json != null && r.finishReason === 'stop' && r.reasoning.length === 0,
        strict, tokens: r.usage?.completion_tokens ?? 0,
        note: `${r.secs.toFixed(1)}s finish=${r.finishReason} content=${r.content.length}ch reasoning=${r.reasoning.length}ch `
          + `completion=${r.usage?.completion_tokens ?? '?'}tok parsed=${json != null} strictJSON=${strict}`,
      };
    });
    console.log(`      raw JSON.parse (no fence-stripping needed): ${out.filter((s) => s.strict).length}/${total}`
      + `, completion tokens: ${out.map((s) => s.tokens).join('/')} of a 2000 budget`);
    assert.equal(passed, total, 'a repair turn here means JSON mode + thinking off was the wrong choice for this call');
  });
