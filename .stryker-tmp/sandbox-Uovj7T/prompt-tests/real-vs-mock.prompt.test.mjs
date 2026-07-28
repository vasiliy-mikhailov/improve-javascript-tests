// @ts-nocheck
// Does the pipeline test the CODE, or does it test its own mocks?
//
// Measured on what it actually shipped: in the one Prisma-backed file among five PRs,
// 11 of 28 it() blocks assert only on `toHaveBeenCalledWith` / `mock.calls` and never
// look at what the function returned — and every table was mocked to `[]`, so no
// transformation logic ran at all. The other four PRs had zero mocks and zero mock
// assertions.
//
// A mock-argument assertion is sometimes the ONLY way to see a mutation (a field
// dropped from a query the mock ignores). The claim under test here is narrower and
// checkable: when the mutation IS visible in the return value, the model should assert
// on the return value.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ask, samples, skipUnlessLive } from './helpers/ask.mjs';
import { killBuildPrompt } from '../n8n/nodes/kill-build-prompt.js';
import { killParseTest } from '../n8n/nodes/kill-parse-test.js';

// A dependency worth mocking (it would hit a database), and a rule whose mutation is
// plainly visible in what the function RETURNS.
const SOURCE = `import { findOrders } from './orders-repo.js';

export async function invoiceTotal(customerId, { rush = false } = {}) {
  const orders = await findOrders({ customerId, select: { amount: true, qty: true, tier: true } });
  let total = 0;
  for (const o of orders) total += o.amount * o.qty;
  if (orders.length >= 3) total *= 0.9;        // bulk discount
  if (rush) total += 15;
  return Math.round(total * 100) / 100;
}
`;

const t = {
  ok: true, runner: 'vitest', packageJson: 'fixture (type=module)',
  path: 'src/invoice.js', source: SOURCE, testPath: 'test/invoice.test.js',
  testExists: false, constraints: [], ui: null, killIdea: '',
  existingTest: "import { describe, it, expect, vi } from 'vitest';\n"
    + "import { invoiceTotal } from '../src/invoice.js';\n"
    + "vi.mock('../src/orders-repo.js', () => ({ findOrders: vi.fn() }));\n"
    + "import { findOrders } from '../src/orders-repo.js';\n\n"
    + "describe('invoiceTotal', () => {\n"
    + "  it('sums one order', async () => {\n"
    + "    findOrders.mockResolvedValue([{ amount: 10, qty: 2, tier: 'a' }]);\n"
    + "    expect(await invoiceTotal('c1')).toBe(20);\n  });\n});\n",
  // the bulk-discount boundary: three orders discount, two do not — and the difference
  // shows up directly in the returned total
  mutant: { mutator: 'EqualityOperator', line: 8, column: 7, status: 'survived', replacement: 'orders.length > 3' },
};

async function generate(opts = {}) {
  const p = killBuildPrompt(t, { thinking: false, ...opts });
  const r = await ask({ system: p.system, prompt: p.prompt, json: true, thinking: false,
    maxTokens: p.maxTokens, temperature: p.temperature });
  let json = null;
  try { json = JSON.parse(r.content || '{}'); } catch { }
  return killParseTest({ ok: true, json }, p).tests[0]?.content || '';
}

const mockAsserts = (s) => (s.match(/toHaveBeenCalled\w*|\.mock\.calls/g) || []).length;
const valueAsserts = (s) => (s.match(/expect\(/g) || []).length - mockAsserts(s);
const emptyMocks = (s) => /mockResolvedValue\(\s*\[\s*\]\s*\)|mockReturnValue\(\s*\[\s*\]\s*\)/.test(s);

test('a mutation visible in the RETURN VALUE is asserted on the return value',
  { skip: skipUnlessLive, timeout: 900000 }, async () => {
    // PASS: the generated test contains at least one assertion that is not about a
    // mock. Asserting only that the repo was queried would pass mutation testing while
    // saying nothing about the discount the function is supposed to apply.
    const { passed, total, out } = await samples(3, async () => {
      const c = await generate();
      const v = valueAsserts(c), m = mockAsserts(c);
      return { ok: c.length > 0 && v >= 1, note: `${v} value-assert(s), ${m} mock-assert(s), ${c.length}ch` };
    });
    assert.equal(passed, total,
      `tests asserted only on mocks in ${total - passed}/${total} samples: `
      + JSON.stringify(out.filter((s) => !s.ok).map((s) => s.note)));
  });

test('mocks return realistic data, not empty collections that switch the logic off',
  { skip: skipUnlessLive, timeout: 900000 }, async () => {
    // Mocking every source to [] is what made the shipped Prisma tests unable to assert
    // on anything but the query: with no rows, no transformation runs. This is the
    // mechanism behind the mock-only assertions, not a style preference.
    const { passed, total, out } = await samples(3, async () => {
      const c = await generate();
      return { ok: c.length > 0 && !emptyMocks(c), note: emptyMocks(c) ? 'mocked to []' : 'realistic fixture data' };
    });
    assert.ok(passed >= 2, `mocks were emptied in ${total - passed}/${total} samples`);
  });
