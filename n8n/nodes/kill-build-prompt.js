import { uiGuidance } from './ui-guidance.js';
import { commonTestRules } from './common-test-rules.js';

// Code node "Kill: Build Prompt".
//
// ONE target, ONE test file. The old batch approach ("here are 5 survivors, write
// tests") produced tests that passed but killed nothing, so the prompt now names a
// single victim and the file it goes in is named after that victim — a failed
// attempt is then trivial to drop.
//
// Asked twice at most. The first attempt runs WITHOUT reasoning: measured on a prompt
// from the pipeline's own dialog log, the model answers in 21-28s that way against
// 112-186s with reasoning, and on everything that could be checked mechanically the
// cheap answer was no worse. Reasoning is then spent only on the mutants that survive
// the cheap attempt — which is exactly where it might be worth six times the wait.
//
// @param t     response of the "Next Mutant" node: { mutant, path, testPath, source, ... }
// @param opts  { thinking, escalated, failure } — the second attempt sets all three
export function killBuildPrompt(t, opts) {
  const o = opts || {};
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
  // A column of 0 is a position, not "no column" — so ask whether it is ABSENT.
  const col = m.column == null || m.column === '' ? '' : ':' + m.column;
  // What the status actually tells the test writer. This is a lookup and not a
  // two-way ternary because 'survived' and 'nocoverage' are two members of an open
  // set: sidecar/stryker.js filters survivors to exactly those two today, but the
  // moment that filter widens, an "everything else is nocoverage" branch would tell
  // the model its target is unreached — and it would then write a test that merely
  // executes the code instead of one that discriminates the mutation.
  // Stryker's own enum is PascalCase and the sidecar lower-cases it; do not depend on
  // that having happened.
  // null prototype: the status comes from a JSON report, and a plain object would
  // answer 'constructor' or '__proto__' with a prototype member that then gets
  // concatenated into the prompt as text.
  const statusBrief = {
    __proto__: null,
    survived: 'covered by existing tests, but nothing asserts the difference',
    nocoverage: 'not covered at all — your test must reach this code',
  };
  const rawStatus = String(m.status ?? '').trim().toLowerCase();
  // The fallback claims only what is known: the label, and that coverage is unknown.
  const status = statusBrief[rawStatus]
    || (rawStatus ? 'Stryker reports this mutant as "' + rawStatus + '"' : 'unreported by Stryker')
      + ' — whether any existing test reaches this code is unknown, so your test must both execute it and assert the difference';
  const gaps = { ui: t.ui, source: t.source, runner: t.runner, constraints: t.constraints };
  const ui = uiGuidance(file, gaps);
  const constraints = (t.constraints || []).map(c => '- ' + c).join('\n');
  const system = 'You are an expert test engineer. Write EXACTLY ONE ' + t.runner + ' test file containing the FEWEST tests needed to kill ONE specific Stryker mutant. '
    + 'A mutant is killed when a test FAILS on the mutated code while PASSING on the real code — so assert the precise value/behaviour the mutation would change. '
    + 'Reply ONLY with JSON: {"tests":[{"path":"' + targetPath + '","content":"full test file content"}]}. Rules:' + commonTestRules(1)
    + ui
    + (constraints ? '\nTeam constraints:\n' + constraints : '');
  // Two different failures need two different instructions. A test that would not RUN
  // is a mocking or import problem and the runner already said exactly what was wrong —
  // withholding that text made one live round write 13 red tests in a row, each
  // rebuilding the same broken scaffolding. A test that ran and killed nothing is an
  // assertion problem, and needs the opposite advice.
  const failure = String(o.failure || '').trim();
  const escalation = !o.escalated ? ''
    : failure
      ? '\n\nA previous attempt at this mutant DID NOT RUN against the real code. This is what the '
        + 'test runner said:\n' + failure.slice(0, 2000)
        + '\n\nFix that first: the imports, the module mocks and the setup have to match how this repo '
        + 'actually wires things — copy the existing test file above rather than inventing a new shape. '
        + 'A test that cannot run kills nothing.\n'
      : '\n\nA previous attempt at this same mutant already failed: a test was written, the suite stayed '
        + 'green, and the mutant SURVIVED it. Do not write that test again. Work out what observable '
        + 'difference the mutation actually makes — if the obvious assertion cannot see it, assert on '
        + 'something that can, such as the arguments a collaborator is called with.\n';
  const prompt = 'SOURCE FILE: ' + file + ' (package: ' + t.packageJson + ')\n'
    + String(t.source || '').slice(0, 12000)
    + '\n\nTARGET MUTANT — kill this one:\n'
    + '  mutator: ' + m.mutator + '\n  line: ' + m.line + col + '\n'
    + '  the mutation replaces that code with: ' + JSON.stringify(m.replacement) + '\n'
    + '  status: ' + status + '\n'
    + (m.context ? '\nSOURCE AROUND THE TARGET:\n' + m.context + '\n' : '')
    + (t.killIdea ? '\nHOW TO KILL IT (from the analysis that selected this mutant):\n  ' + t.killIdea + '\n' : '')
    + '\nEXISTING TEST FILE (' + t.testPath + ', style reference — do not rewrite it):\n'
    + String(t.existingTest || '(none)').slice(0, 4000)
    + escalation
    + '\n\nWrite the single test file that kills this mutant. JSON only.';
  return { system, prompt, json: true, maxTokens: 9000, temperature: 0.2,
    thinking: o.thinking,
    stage: 'improving_mutation',
    stageDetail: 'writing a test to kill ' + m.mutator + ' at line ' + m.line
      + (o.thinking === false ? ' (fast attempt, without reasoning)' : o.escalated ? ' (retry, with reasoning)' : ''),
    // the parser needs to know which path belongs to the repo, or it cannot refuse it
    targetPath, existingTestPath: t.testPath, existingTestExists: !!t.testExists };
}
