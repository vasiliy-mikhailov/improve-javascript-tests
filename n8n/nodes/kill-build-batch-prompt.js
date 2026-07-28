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
// Written per SITE, not per mutant. Stryker gives location.start.{line,column} for
// every mutation, so `>` becoming `>=`, `<` and `==` are three mutants of ONE condition
// and a single boundary test kills all three. Each site carries the name the test must
// have — `kills <line>:<column>` — because that name is what lets the next run ask "is
// there already a test for this?" and skip the site without spending a token. On a file
// with a thousand mutants that filter is the difference between minutes and hours.
//
// @param t     response of "Next Mutant": `groups` (sites) or `targets` (flat mutants)
// @param opts  { thinking } — the sweep runs cold like the single attempt
export function killBuildBatchPrompt(t, opts) {
  const o = opts || {};
  // groups are the shape the sweep uses; a flat list still works for the batch path
  const groups = (t.groups && t.groups.length)
    ? t.groups.slice(0, 12)
    : (t.targets || []).slice(0, 8).map((m) => ({
      name: `kills ${m.line}:${m.column ?? 0}`, line: m.line, column: m.column ?? 0, mutants: [m],
    }));
  const targets = groups.flatMap((g) => g.mutants);
  const file = t.path;
  const ext = (file.match(/\.[cm]?[jt]sx?$/) || ['.ts'])[0];
  const base = t.testPath.replace(/\.(test|spec)\.[cm]?[jt]sx?$/, '').replace(/\.[cm]?[jt]sx?$/, '');
  const hash = (str) => { let x = 5381; for (let i = 0; i < str.length; i++) x = ((x * 33) ^ str.charCodeAt(i)) >>> 0; return x.toString(36); };
  // named for the batch, not for one victim: a batch file is dropped or kept whole
  const tag = hash(groups.map((g) => g.name).join(';'));
  const targetPath = base + '.kill-batch-' + tag + '.test' + ext;
  const gaps = { ui: t.ui, source: t.source, runner: t.runner, constraints: t.constraints };
  const ui = uiGuidance(file, gaps);
  const constraints = (t.constraints || []).map(c => '- ' + c).join('\n');

  const list = groups.map((g) => {
    const status = g.mutants.every((m) => String(m.status ?? '').toLowerCase() === 'nocoverage')
      ? 'not covered at all — this test must reach the code first'
      : 'covered by existing tests, but nothing asserts the difference';
    const variants = g.mutants.map((m) => `      - ${m.mutator}: the code becomes `
      + `${JSON.stringify(String(m.replacement ?? '')).slice(0, 200)}`).join('\n');
    return `  "${g.name}"  (line ${g.line}, column ${g.column}) — ${g.mutants.length} mutation(s), `
      + `${status}\n${variants}`;
  }).join('\n\n');

  const system = 'You are an expert test engineer. Write EXACTLY ONE ' + t.runner + ' test file containing one test '
    + 'case per SITE listed below. Each site is one place in the source that several mutations attack, and one sharp '
    + 'test case can kill all of them at once — a boundary test kills >, < and == on the same condition. A mutation is '
    + 'killed when the test FAILS on the mutated code while PASSING on the real code, so assert the precise value or '
    + 'behaviour every listed mutation would change. Name each test case with EXACTLY THE NAME GIVEN for its site, '
    + 'optionally followed by a short description — for example it("kills 8:7 — returns \'small\' at the boundary"). '
    + 'That name is how the site is recognised later, so it must appear verbatim. Do not write tests for anything not '
    + 'listed. Reply ONLY with JSON: {"tests":[{"path":"' + targetPath + '","content":"full test file content"}]}. Rules:'
    + commonTestRules(1) + ui
    + (constraints ? '\nTeam constraints:\n' + constraints : '');

  const prompt = 'SOURCE FILE: ' + file + ' (package: ' + t.packageJson + ')\n'
    + String(t.source || '').slice(0, 12000)
    + '\n\nSITES — one test case each, named exactly as shown:\n' + list + '\n'
    + '\nEXISTING TEST FILE (' + t.testPath + ', style reference — do not rewrite it):\n'
    + String(t.existingTest || '(none)').slice(0, 4000)
    + '\n\nWrite the single test file. JSON only.';

  return { system, prompt, json: true, maxTokens: 9000, temperature: 0.2,
    thinking: o.thinking,
    stage: 'improving_mutation',
    stageDetail: `writing ${groups.length} test(s) for ${targets.length} mutants`
      + (o.thinking === false ? ' (fast attempt, without reasoning)' : ''),
    targetPath, existingTestPath: t.testPath, existingTestExists: !!t.testExists,
    targetCount: targets.length, siteCount: groups.length,
    siteNames: groups.map((g) => g.name),
    // What this prompt ACTUALLY attacked. /api/mutant/next offers two work lists —
    // `groups` (sites from the durable queue, what we write tests for) and `targets`
    // (the picker's ranked shortlist) — and verification used to be handed the second
    // one. Charging a failed attempt to a mutant no test was written for spends the
    // single shot it gets, so those mutants left the shortlist unattacked and the
    // file's mutation loop ended early with sites still pending.
    aimed: targets.map((m) => ({
      mutator: m.mutator, line: m.line, column: m.column ?? 0,
      endLine: m.endLine, replacement: m.replacement, id: m.id, status: m.status,
    })) };
}
