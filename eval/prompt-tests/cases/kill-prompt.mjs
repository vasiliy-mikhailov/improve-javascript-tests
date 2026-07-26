// The prompt that writes every test in every PR. Judged the way Stryker judges:
// the generated test must PASS on the original module and FAIL on the mutated one.
import { killBuildPrompt } from '../../../n8n/nodes/kill-build-prompt.js';
import { killParseTest } from '../../../n8n/nodes/kill-parse-test.js';
import { kills, leakedReasoning } from '../harness/kill-check.mjs';

const ORIGINAL = `export function loyaltyBonus(daysActive, purchases) {
  const weeks = Math.floor(daysActive / 7);
  const tier = weeks >= 2 ? 2 : 1;
  const base = purchases * tier;
  return base > 50 ? 50 : base;
}
`;
// Hitting the boundary is not enough: the cap masks the difference for any large
// `purchases`, which is the value a hurried test reaches for.
const MUTATED = ORIGINAL.replace('weeks >= 2', 'weeks > 2');

const target = {
  ok: true, path: 'pricing.js', runner: 'vitest', packageJson: 'fixture (type=module)',
  source: ORIGINAL, testPath: 'pricing.test.js', testExists: false, existingTest: null,
  constraints: [], ui: null, killIdea: '',
  mutant: {
    mutator: 'EqualityOperator', line: 3, column: 21, status: 'survived',
    replacement: 'weeks > 2',
    context: ORIGINAL.split('\n').slice(0, 6).map((l, i) => `${i + 1}: ${l}`).join('\n'),
  },
};

async function attempt(ask, thinking) {
  const plan = killBuildPrompt(target, { thinking });
  const r = await ask({ system: plan.system, prompt: plan.prompt, thinking, json: true,
    maxTokens: thinking ? 12000 : 4000, temperature: plan.temperature });
  let parsed = { tests: [] };
  try { parsed = killParseTest({ ok: true, json: JSON.parse(r.content || '{}') }, plan); } catch { }
  const content = parsed.tests[0]?.content || '';
  return { r, content, verdict: content ? kills(content, ORIGINAL, MUTATED) : { kills: false } };
}

export const cases = [
  {
    name: 'the FAST kill prompt (no reasoning) writes a test that kills the mutant',
    samples: 3, threshold: 2,
    async run(ask) {
      const a = await attempt(ask, false);
      return { ok: a.verdict.kills, secs: a.r.secs,
        note: `${a.r.secs.toFixed(0)}s, ${a.content.length}ch, kills=${a.verdict.kills}` };
    },
  },
  {
    name: 'the ESCALATED kill prompt (reasoning) also kills it',
    samples: 2, threshold: 2,
    async run(ask) {
      const a = await attempt(ask, true);
      return { ok: a.verdict.kills, secs: a.r.secs,
        note: `${a.r.secs.toFixed(0)}s, reasoning ${a.r.reasoning.length}ch, kills=${a.verdict.kills}` };
    },
  },
  {
    name: 'D11: the committed test carries no narrated reasoning',
    samples: 3, threshold: 3,
    async run(ask, i) {
      // alternates, because this is where the two modes were seen to differ
      const a = await attempt(ask, i % 2 === 1);
      const leaks = leakedReasoning(a.content);
      return { ok: leaks.length === 0, secs: a.r.secs,
        note: `thinking=${i % 2 === 1} leaks=${leaks.length}${leaks.length ? ' ' + JSON.stringify(leaks[0]).slice(0, 80) : ''}` };
    },
  },
];
