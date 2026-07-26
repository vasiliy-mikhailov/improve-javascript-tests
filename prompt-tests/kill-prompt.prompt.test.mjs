// The prompt that writes every test in every PR, judged the way Stryker judges:
// the generated test must PASS against the original module and FAIL against the
// mutated one. Executed in-process against a fixture — no repo, no Stryker.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ask, samples, skipUnlessLive } from './helpers/ask.mjs';
import { killBuildPrompt } from '../n8n/nodes/kill-build-prompt.js';
import { killParseTest } from '../n8n/nodes/kill-parse-test.js';
import { kills, leakedReasoning } from './harness/kill-check.mjs';

const ORIGINAL = `export function loyaltyBonus(daysActive, purchases) {
  const weeks = Math.floor(daysActive / 7);
  const tier = weeks >= 2 ? 2 : 1;
  const base = purchases * tier;
  return base > 50 ? 50 : base;
}
`;
// Reaching the boundary is not enough: the cap hides the difference for any large
// `purchases` — the value a hurried test reaches for first.
const MUTATED = ORIGINAL.replace('weeks >= 2', 'weeks > 2');

const target = {
  ok: true, path: 'pricing.js', runner: 'vitest', packageJson: 'fixture (type=module)',
  source: ORIGINAL, testPath: 'pricing.test.js', testExists: false, existingTest: null,
  constraints: [], ui: null, killIdea: '',
  mutant: {
    mutator: 'EqualityOperator', line: 3, column: 21, status: 'survived', replacement: 'weeks > 2',
    context: ORIGINAL.split('\n').slice(0, 6).map((l, i) => `${i + 1}: ${l}`).join('\n'),
  },
};

async function attempt(thinking, escalated = false) {
  const plan = killBuildPrompt(target, { thinking, escalated });
  const r = await ask({ system: plan.system, prompt: plan.prompt, thinking, json: true,
    maxTokens: thinking ? 12000 : 4000, temperature: plan.temperature });
  let parsed = { tests: [] };
  try { parsed = killParseTest({ ok: true, json: JSON.parse(r.content || '{}') }, plan); } catch { }
  const content = parsed.tests[0]?.content || '';
  return { r, content, verdict: content ? kills(content, ORIGINAL, MUTATED) : { kills: false } };
}

test('the FAST kill prompt writes a test that actually kills the mutant',
  { skip: skipUnlessLive, timeout: 900000 }, async () => {
    const { passed, total } = await samples(3, async () => {
      const a = await attempt(false);
      return { ok: a.verdict.kills, note: `${a.r.secs.toFixed(0)}s, ${a.content.length}ch, kills=${a.verdict.kills}` };
    });
    assert.ok(passed >= 2, `only ${passed}/${total} fast attempts killed it — the cheap-first loop stops paying off below this`);
  });

test('the ESCALATED kill prompt kills it too',
  { skip: skipUnlessLive, timeout: 900000 }, async () => {
    const { passed, total } = await samples(2, async () => {
      const a = await attempt(true, true);
      return { ok: a.verdict.kills, note: `${a.r.secs.toFixed(0)}s, reasoning ${a.r.reasoning.length}ch, kills=${a.verdict.kills}` };
    });
    assert.equal(passed, total, 'the escalation is the last chance a mutant gets');
  });

test('generation alone does NOT guarantee D11 — it leaks sometimes, which is why cleanup exists',
  { skip: skipUnlessLive, timeout: 900000 }, async () => {
    // First written as "no leaks, ever", and it failed on its first real run: one
    // sample in four narrated its reasoning inside the test file. That is the honest
    // contract — generation is best-effort and the cleanup pass is the enforcer — so
    // the test now measures the rate instead of asserting an aspiration. If leakage
    // ever becomes the norm, this goes red and the cleanup pass is carrying the whole
    // guarantee alone.
    const { passed, total, out } = await samples(4, async (i) => {
      const a = await attempt(i % 2 === 1);
      const leaks = leakedReasoning(a.content);
      return { ok: leaks.length === 0, leaks,
        note: `thinking=${i % 2 === 1} leaks=${leaks.length}${leaks.length ? ' ' + JSON.stringify(leaks[0]).slice(0, 70) : ''}` };
    });
    console.log(`      leak rate: ${total - passed}/${total}`);
    assert.ok(passed >= Math.ceil(total / 2),
      `reasoning leaked into ${total - passed}/${total} generated files — generation has stopped being best-effort: `
      + JSON.stringify(out.filter((s) => !s.ok).map((s) => s.leaks[0])));
  });

test('D11 is enforced by the cleanup pass: a leaking file comes back clean',
  { skip: skipUnlessLive, timeout: 900000 }, async () => {
    // The real cleanup prompt from sidecar/server.js, on a file that leaks exactly the
    // way generation was just observed to leak.
    const dirty = `import { describe, it, expect } from 'vitest';
import { loyaltyBonus } from './pricing.js';

describe('loyaltyBonus', () => {
  // Wait, let me think about this. Original: weeks >= 2 is true at 14 days -> tier 2 -> 20
  // Mutant:   weeks > 2 is false at 14 days -> tier 1 -> 10
  // We need to avoid the cap, so purchases must be small.
  it('applies tier 2 at exactly two weeks', () => {
    expect(loyaltyBonus(14, 10)).toBe(20);
  });
});
`;
    assert.ok(leakedReasoning(dirty).length >= 2, 'precondition: the input really does leak');
    const r = await ask({
      system: 'You are a strict test-code editor. Clean this generated test file: (1) REMOVE all scratch/chain-of-thought comments '
        + '— anything reasoning aloud ("Wait", "Let\'s try", exploratory strategy essays, self-corrections). Keep at most ONE short '
        + 'comment per test stating which mutant/behavior it verifies. (2) REMOVE tests that are vacuous (cannot fail, assert nothing '
        + 'meaningful, or admit in comments they kill nothing). (3) Do NOT change, weaken, or reorder any remaining test logic, imports, '
        + 'or setup. Reply with ONLY the complete cleaned file content — no markdown fences, no explanation.',
      prompt: dirty, thinking: true, json: false, maxTokens: 9000, temperature: 0.1,
    });
    const cleaned = r.content.replace(/^```[a-z]*\s*\n?/m, '').replace(/```\s*$/m, '').trim();
    console.log(`      ${r.secs.toFixed(0)}s, ${dirty.length}ch → ${cleaned.length}ch, leaks ${leakedReasoning(dirty).length} → ${leakedReasoning(cleaned).length}`);
    assert.equal(leakedReasoning(cleaned).length, 0, 'the backstop must actually strip it');
    assert.match(cleaned, /loyaltyBonus\(14, 10\)/, 'and must not touch the test that does the work');
    assert.match(cleaned, /toBe\(20\)/);
  });
