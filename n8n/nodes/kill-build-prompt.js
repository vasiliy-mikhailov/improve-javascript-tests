import { uiGuidance } from './ui-guidance.js';
import { commonTestRules } from './common-test-rules.js';

// Code node "Kill: Build Prompt".
//
// ONE target, ONE test file. The old batch approach ("here are 5 survivors, write
// tests") produced tests that passed but killed nothing, so the prompt now names a
// single victim and the file it goes in is named after that victim — a failed
// attempt is then trivial to drop.
//
// @param t  response of the "Next Mutant" node: { mutant, path, testPath, source, ... }
export function killBuildPrompt(t) {
  const m = t.mutant;
  const file = t.path;
  const ext = (file.match(/\.[cm]?[jt]sx?$/) || ['.ts'])[0];
  const base = t.testPath.replace(/\.(test|spec)\.[cm]?[jt]sx?$/, '').replace(/\.[cm]?[jt]sx?$/, '');
  // One file per target — but the NAME has to carry the whole mutant identity, not
  // just line + mutator. Stryker emits several distinct mutants in one place
  // (ConditionalExpression gives a `true` and a `false` variant; `a === 1 && b === 2`
  // gives two EqualityOperator mutants), and sidecar/mutants.js separates them by
  // column AND replacement, so the loop attacks each of them in its own round. A name
  // that ignores column and replacement makes round two overwrite the test that killed
  // round one's mutant — and delete it outright when round two fails.
  // djb2, inlined: an n8n Code node has no require().
  const hash = (str) => { let x = 5381; for (let i = 0; i < str.length; i++) x = ((x * 33) ^ str.charCodeAt(i)) >>> 0; return x.toString(36); };
  const tag = hash(String(m.mutator) + '|' + m.line + '|' + (m.column ?? '') + '|' + String(m.replacement ?? '').slice(0, 60));
  const targetPath = base + '.kill-L' + m.line + '-' + String(m.mutator).toLowerCase() + '-' + tag + '.test' + ext;
  const gaps = { ui: t.ui, source: t.source, runner: t.runner, constraints: t.constraints };
  const ui = uiGuidance(file, gaps);
  const constraints = (t.constraints || []).map(c => '- ' + c).join('\n');
  const system = 'You are an expert test engineer. Write EXACTLY ONE ' + t.runner + ' test file containing the FEWEST tests needed to kill ONE specific Stryker mutant. '
    + 'A mutant is killed when a test FAILS on the mutated code while PASSING on the real code — so assert the precise value/behaviour the mutation would change. '
    + 'Reply ONLY with JSON: {"tests":[{"path":"' + targetPath + '","content":"full test file content"}]}. Rules:' + commonTestRules(1)
    + ui
    + (constraints ? '\nTeam constraints:\n' + constraints : '');
  const prompt = 'SOURCE FILE: ' + file + ' (package: ' + t.packageJson + ')\n'
    + String(t.source || '').slice(0, 12000)
    + '\n\nTARGET MUTANT — kill this one:\n'
    + '  mutator: ' + m.mutator + '\n  line: ' + m.line + (m.column ? ':' + m.column : '') + '\n'
    + '  the mutation replaces that code with: ' + JSON.stringify(m.replacement) + '\n'
    + '  status: ' + (m.status === 'survived' ? 'covered by existing tests, but nothing asserts the difference' : 'not covered at all — your test must reach this code') + '\n'
    + (m.context ? '\nSOURCE AROUND THE TARGET:\n' + m.context + '\n' : '')
    + (t.killIdea ? '\nHOW TO KILL IT (from the analysis that selected this mutant):\n  ' + t.killIdea + '\n' : '')
    + '\nEXISTING TEST FILE (' + t.testPath + ', style reference — do not rewrite it):\n'
    + String(t.existingTest || '(none)').slice(0, 4000)
    + '\n\nWrite the single test file that kills this mutant. JSON only.';
  return { system, prompt, json: true, maxTokens: 9000, temperature: 0.2,
    stage: 'improving_mutation', stageDetail: 'writing a test to kill ' + m.mutator + ' at line ' + m.line,
    // the parser needs to know which path belongs to the repo, or it cannot refuse it
    targetPath, existingTestPath: t.testPath, existingTestExists: !!t.testExists };
}
