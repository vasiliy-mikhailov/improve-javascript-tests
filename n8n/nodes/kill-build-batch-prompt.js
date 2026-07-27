import { uiGuidance } from './ui-guidance.js';
import { commonTestRules } from './common-test-rules.js';

// Code node "Kill: Build Batch Prompt".
//
// ONE test file aimed at MANY surviving mutants at once.
//
// The single-target prompt exists because an early batch attempt ("here are 5
// survivors, write tests") produced tests that passed and killed nothing — nothing in
// it forced the model to discriminate any particular mutation. This prompt is built
// the other way round: every target is listed with its exact replacement, the model is
// told a test only counts if it FAILS on that replacement, and it is asked to say
// which target each test case is for. Verification is unchanged and unforgiving — a
// mutation run decides what actually died, so a batch that overreaches simply scores
// what it earned.
//
// The economics are the point. One target per attempt costs a model call, a scoped
// test run and a mutation check for a single mutant; the same cycle spent on eight is
// the difference between a file taking hours and taking minutes.
//
// @param t     response of "Next Mutant" carrying `targets` (an array of mutants)
// @param opts  { thinking } — the batch attempt runs cold like the single one
export function killBuildBatchPrompt(t, opts) {
  const o = opts || {};
  const targets = (t.targets || []).slice(0, 8);
  const file = t.path;
  const ext = (file.match(/\.[cm]?[jt]sx?$/) || ['.ts'])[0];
  const base = t.testPath.replace(/\.(test|spec)\.[cm]?[jt]sx?$/, '').replace(/\.[cm]?[jt]sx?$/, '');
  const hash = (str) => { let x = 5381; for (let i = 0; i < str.length; i++) x = ((x * 33) ^ str.charCodeAt(i)) >>> 0; return x.toString(36); };
  // named for the batch, not for one victim: a batch file is dropped or kept whole
  const tag = hash(targets.map((m) => `${m.mutator}|${m.line}|${m.column ?? ''}|${String(m.replacement ?? '').slice(0, 60)}`).join(';'));
  const targetPath = base + '.kill-batch-' + tag + '.test' + ext;
  const gaps = { ui: t.ui, source: t.source, runner: t.runner, constraints: t.constraints };
  const ui = uiGuidance(file, gaps);
  const constraints = (t.constraints || []).map(c => '- ' + c).join('\n');

  const list = targets.map((m, i) => {
    const col = m.column == null || m.column === '' ? '' : ':' + m.column;
    const status = String(m.status ?? '').trim().toLowerCase() === 'nocoverage'
      ? 'not covered at all — your test must reach this code'
      : 'covered by existing tests, but nothing asserts the difference';
    return `#${i + 1} ${m.mutator} at line ${m.line}${col}\n`
      + `    the mutation replaces that code with: ${JSON.stringify(String(m.replacement ?? '')).slice(0, 200)}\n`
      + `    ${status}`;
  }).join('\n');

  const system = 'You are an expert test engineer. Write EXACTLY ONE ' + t.runner + ' test file that kills AS MANY as '
    + 'possible of the Stryker mutants listed below. A mutant is killed when a test FAILS on the mutated code while '
    + 'PASSING on the real code, so every test case must assert the precise value or behaviour one of those mutations '
    + 'would change. Prefer several small focused test cases over one large one, and name each case after the target '
    + 'it kills (for example: "kills #3: returns 0 for an empty order"). Do not write a test for anything not on the '
    + 'list. Reply ONLY with JSON: {"tests":[{"path":"' + targetPath + '","content":"full test file content"}]}. Rules:'
    + commonTestRules(1) + ui
    + (constraints ? '\nTeam constraints:\n' + constraints : '');

  const prompt = 'SOURCE FILE: ' + file + ' (package: ' + t.packageJson + ')\n'
    + String(t.source || '').slice(0, 12000)
    + '\n\nTARGET MUTANTS — kill as many of these as you can, in one file:\n' + list + '\n'
    + '\nEXISTING TEST FILE (' + t.testPath + ', style reference — do not rewrite it):\n'
    + String(t.existingTest || '(none)').slice(0, 4000)
    + '\n\nWrite the single test file. JSON only.';

  return { system, prompt, json: true, maxTokens: 9000, temperature: 0.2,
    thinking: o.thinking,
    stage: 'improving_mutation',
    stageDetail: `writing one test for ${targets.length} mutants` + (o.thinking === false ? ' (fast attempt, without reasoning)' : ''),
    targetPath, existingTestPath: t.testPath, existingTestExists: !!t.testExists,
    targetCount: targets.length };
}
