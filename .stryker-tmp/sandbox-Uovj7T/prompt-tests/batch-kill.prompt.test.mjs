// @ts-nocheck
// Can ONE generated test file kill EIGHT mutants?
//
// The loop currently spends a whole cycle — model call, scoped test run, mutation
// check — per mutant. Measured on a real file that is 2-4 minutes each, and a file
// with 126 mutants cannot be finished that way. If one call can kill eight, the same
// cycle does eight times the work.
//
// The reason this needs measuring rather than assuming: an early version of this
// pipeline DID batch ("here are 5 survivors, write tests") and produced tests that
// passed and killed nothing, which is why the single-target prompt exists. So the
// question is not "is batching faster" — obviously — but "does a batch actually kill",
// judged the way Stryker judges: green on the real module, red on each mutant.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ask, samples, skipUnlessLive } from './helpers/ask.mjs';
import { killBuildBatchPrompt } from '../n8n/nodes/kill-build-batch-prompt.js';
import { killBuildPrompt } from '../n8n/nodes/kill-build-prompt.js';
import { killParseTest } from '../n8n/nodes/kill-parse-test.js';
import { killsMany } from './harness/multi-kill.mjs';

// A module with the shape that actually reaches this prompt: several independent
// decisions, each with a mutation a sharp assertion can see.
const SOURCE = `const RATES = { standard: 4.95, express: 12.5 };
const FREE_FLOOR = 75;
const HEAVY_KG = 20;

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
  if (net >= FREE_FLOOR && order.speed !== 'express') shipping = 0;

  return { total: round(net + shipping), shipping: round(shipping), discount: round(discount) };
}

function round(n) { return Math.round(n * 100) / 100; }
`;

/** Each mutant: how Stryker describes it, and the exact edit, so the verdict is real. */
const MUTANTS = [
  { id: '#1', mutator: 'EqualityOperator', line: 6, column: 52, replacement: 'order.items.length !== 0',
    status: 'survived', apply: (s) => s.replace('order.items.length === 0', 'order.items.length !== 0') },
  { id: '#2', mutator: 'StringLiteral', line: 7, column: 55, replacement: '""',
    status: 'survived', apply: (s) => s.replace("note: 'empty order'", "note: ''") },
  { id: '#3', mutator: 'EqualityOperator', line: 13, column: 7, replacement: "customer.tier !== 'gold'",
    status: 'survived', apply: (s) => s.replace("customer.tier === 'gold'", "customer.tier !== 'gold'") },
  { id: '#4', mutator: 'ArithmeticOperator', line: 14, column: 44, replacement: 'subtotal / 0.1',
    status: 'survived', apply: (s) => s.replace('subtotal * 0.1', 'subtotal / 0.1') },
  { id: '#5', mutator: 'EqualityOperator', line: 15, column: 7, replacement: 'discount >= 50',
    status: 'survived', apply: (s) => s.replace('discount > 50', 'discount >= 50') },
  { id: '#6', mutator: 'EqualityOperator', line: 19, column: 7, replacement: 'weightKg > HEAVY_KG',
    status: 'survived', apply: (s) => s.replace('weightKg >= HEAVY_KG', 'weightKg > HEAVY_KG') },
  { id: '#7', mutator: 'LogicalOperator', line: 20, column: 7, replacement: "net >= FREE_FLOOR || order.speed !== 'express'",
    status: 'survived', apply: (s) => s.replace("net >= FREE_FLOOR && order.speed !== 'express'", "net >= FREE_FLOOR || order.speed !== 'express'") },
  { id: '#8', mutator: 'ArithmeticOperator', line: 22, column: 24, replacement: 'net - shipping',
    status: 'survived', apply: (s) => s.replace('round(net + shipping)', 'round(net - shipping)') },
];

const BASE = {
  ok: true, path: 'src/checkout/quote.js', runner: 'vitest', packageJson: 'fixture (type=module)',
  source: SOURCE, testPath: 'test/quote.test.js', testExists: false, existingTest: null,
  constraints: [], ui: null,
};

async function attemptBatch(n) {
  const plan = killBuildBatchPrompt({ ...BASE, targets: MUTANTS.slice(0, n) }, { thinking: false });
  const r = await ask({ system: plan.system, prompt: plan.prompt, json: true, thinking: false,
    maxTokens: plan.maxTokens, temperature: plan.temperature });
  let content = '';
  try { content = killParseTest({ ok: true, json: JSON.parse(r.content || '{}') }, plan).tests[0]?.content || ''; } catch { }
  return { r, content, verdict: content ? killsMany(content, SOURCE, MUTANTS.slice(0, n)) : { greenOnReal: false, killed: [], survived: [] } };
}

test('ONE test file aimed at EIGHT mutants kills most of them',
  { skip: skipUnlessLive, timeout: 1800000 }, async () => {
    // PASS: the file is green on the real module and kills a majority of the eight.
    // Majority, not all: the loop's own verification decides what actually died, so a
    // batch that lands five of eight has still done five cycles of work in one.
    const { passed, total, out } = await samples(3, async () => {
      const a = await attemptBatch(8);
      return {
        ok: a.verdict.greenOnReal && a.verdict.killed.length >= 5,
        killed: a.verdict.killed.length,
        note: `${a.r.secs.toFixed(0)}s, ${a.content.length}ch, green=${a.verdict.greenOnReal}, `
          + `killed ${a.verdict.killed.length}/8 [${a.verdict.killed.join(' ')}], missed [${a.verdict.survived.join(' ')}]`,
      };
    });
    const mean = out.reduce((s, x) => s + x.killed, 0) / total;
    console.log(`      mean kills per call: ${mean.toFixed(1)} of 8`);
    assert.ok(passed >= 2, `a batch call must earn its cycle: only ${passed}/${total} samples killed 5+`);
  });

test('the batch file is GREEN on the real module — a red one kills nothing at all',
  { skip: skipUnlessLive, timeout: 1800000 }, async () => {
    // The failure mode that matters most: a batch is one file, so if it does not run,
    // every mutant it aimed at is lost together. The single-target path risks one.
    const { passed, total } = await samples(3, async () => {
      const a = await attemptBatch(8);
      return { ok: a.verdict.greenOnReal, note: `green=${a.verdict.greenOnReal} killed=${a.verdict.killed.length}` };
    });
    assert.ok(passed >= 2, `batch files must run against real code: ${passed}/${total} were green`);
  });

test('BASELINE: the single-target prompt, for comparison on the same fixture',
  { skip: skipUnlessLive, timeout: 1800000 }, async () => {
    // Same module, same model, one mutant. Reported rather than asserted — this is the
    // number the batch has to beat per unit of wall clock, not a contract.
    const target = MUTANTS[5];
    const { out } = await samples(2, async () => {
      const plan = killBuildPrompt({ ...BASE, mutant: target, killIdea: '' }, { thinking: false });
      const r = await ask({ system: plan.system, prompt: plan.prompt, json: true, thinking: false,
        maxTokens: plan.maxTokens, temperature: plan.temperature });
      let content = '';
      try { content = killParseTest({ ok: true, json: JSON.parse(r.content || '{}') }, plan).tests[0]?.content || ''; } catch { }
      const v = content ? killsMany(content, SOURCE, MUTANTS) : { greenOnReal: false, killed: [] };
      return { ok: true, killed: v.killed.length,
        note: `${r.secs.toFixed(0)}s, green=${v.greenOnReal}, killed ${v.killed.length}/8 [${v.killed.join(' ')}]` };
    });
    const mean = out.reduce((s, x) => s + x.killed, 0) / out.length;
    console.log(`      single-target mean kills per call: ${mean.toFixed(1)} of 8`);
  });
