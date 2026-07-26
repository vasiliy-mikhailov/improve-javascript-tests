// Generates the n8n workflow JSON for improve-javascript-tests.
//
// HARD CONSTRAINT: only native n8n nodes — Manual/Webhook triggers, HTTP Request,
// Code (pure JS data transforms: no child_process, no fs, no shell), IF, NoOp.
// Every OS-touching operation goes through the sidecar HTTP API on :3000.
//
// Run: node generate-workflows.mjs → writes workflows/Improve-JS-Tests.json

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, 'workflows');
mkdirSync(OUT, { recursive: true });

const API = 'http://127.0.0.1:3000';
const WORKFLOW_ID = 'ijstImproveTests1';

// ── tiny builder ───────────────────────────────────────────────────────────
let _x = 0, _y = 0;
const pos = () => { _x += 220; if (_x > 3600) { _x = 220; _y += 200; } return [_x, _y]; };
const w = { name: 'Improve JS Tests', nodes: [], connections: {} };
function add(type, name, parameters = {}, typeVersion = 1) {
  w.nodes.push({ parameters, type, typeVersion, position: pos(), id: randomUUID(), name });
  return name;
}
function link(from, to, out = 0) {
  const conn = (w.connections[from] ||= { main: [] });
  while (conn.main.length <= out) conn.main.push([]);
  if (!conn.main[out].some((c) => c.node === to)) conn.main[out].push({ node: to, type: 'main', index: 0 });
}
function chain(...names) { for (let i = 0; i < names.length - 1; i++) link(names[i], names[i + 1]); }

const NoOp = (name) => add('n8n-nodes-base.noOp', name, {});
const Code = (name, jsCode) => add('n8n-nodes-base.code', name, { jsCode, mode: 'runOnceForAllItems' }, 2);
const IfNum = (name, valueExpr, operation, value2) =>
  add('n8n-nodes-base.if', name, {
    conditions: { number: [{ value1: valueExpr, value2, operation }] },
  }, 1);

function Http(name, { method = 'POST', path, urlExpr, body, timeout = 600000 }) {
  const params = {
    method,
    url: urlExpr || API + path,
    options: { timeout, redirect: { redirect: {} } },
  };
  if (method === 'POST') {
    params.sendBody = true;
    params.specifyBody = 'json';
    params.jsonBody = body || '={{ {} }}';
  }
  return add('n8n-nodes-base.httpRequest', name, params, 4.2);
}

// ── shared prompt fragments (live inside Code nodes) ───────────────────────
// Component-testing guidance, injected when the picked file is a UI component
// (.jsx/.tsx or imports the detected framework). Kept as a Code-node snippet.
const UI_GUIDANCE_SNIPPET = `
const isComponent = /\\.[jt]sx$/.test(file) || (gaps.ui && /from\\s+["'](react|vue|svelte|preact)["']/.test(String(gaps.source || '').slice(0, 2000)));
const uiGuidance = (gaps.ui && isComponent) ? '\\nThis file is a UI COMPONENT (' + gaps.ui.framework + '). Component-testing rules:'
  + '\\n- Render it with ' + (gaps.ui.testingLibrary || "the repo's established component-testing approach") + ' and assert on VISIBLE behavior: roles, accessible names, text, attributes — never on implementation internals or state.'
  + '\\n- Prefer accessible queries (getByRole, getByLabelText, getByText) over test ids.'
  + (gaps.ui.userEvent ? "\\n- Simulate clicks/typing with @testing-library/user-event and assert the resulting DOM and callback invocations." : '')
  + (gaps.ui.jestDom ? '\\n- jest-dom matchers (toBeInTheDocument, toBeDisabled, toHaveAttribute, ...) are available.' : '')
  + '\\n- Cover props/variants, conditional rendering branches, and event-handler callbacks (pass vi/jest mocks as handlers).'
  + '\\n- Do not snapshot; do not shallow-render; do not reach into component internals.'
  : '';`;

const COMMON_TEST_RULES = `
- Tests must be deterministic (no timing races, no network, no randomness without seeding).
- Code must satisfy strict linters: no \`any\` types, no unused imports or variables, no non-null assertions.
- Import the module under test via its public path exactly as existing tests do.
- Never inspect function source code (no fn.toString() introspection).
- No snapshot tests. Prefer precise value assertions.
- The tests MUST pass against the CURRENT implementation of the source file.
- Output at most 2 test files.`;

// =============================================================================
// SPINE
// =============================================================================
add('n8n-nodes-base.manualTrigger', 'Start (manual)', {});
add('n8n-nodes-base.webhook', 'Start (webhook)', {
  path: 'improve-run', httpMethod: 'POST', responseMode: 'onReceived', options: {},
}, 2);
w.nodes[w.nodes.length - 1].webhookId = 'aa11bb22-ijst-4run-9000-improverun001';

Http('Start Run', { path: '/api/run/start', body: '={{ $json.body || {} }}' });
Http('Clone Repo', { path: '/api/repo/clone', timeout: 900000 });
Http('Rules: post-clone', { path: '/api/rules/apply', body: `={{ { stage: 'post_clone' } }}` });
Http('Install & Detect', { path: '/api/repo/prepare', timeout: 2400000 });
Http('Baseline Coverage', { path: '/api/coverage/run', body: `={{ { phase: 'baseline', stage: 'measuring_baseline' } }}`, timeout: 2400000 });
Http('Rules: pre-pick', { path: '/api/rules/apply', body: `={{ { stage: 'pre_pick' } }}` });
Http('Rules: write-test', { path: '/api/rules/apply', body: `={{ { stage: 'write_test' } }}` });

NoOp('Next Iteration');
Http('Get Candidates', { method: 'GET', path: '/api/files/candidates' });
IfNum('More Work?', '={{ $json.done ? 0 : 1 }}', 'equal', 1);
Http('Rules: pick file', { path: '/api/rules/apply', body: `={{ { stage: 'pick_file' } }}` });
IfNum('File Picked?', `={{ $json.result && $json.result.file ? 1 : 0 }}`, 'equal', 1);
// pick failed: transient (bad LLM output) → try again; terminal (rule excludes
// every candidate) → finish. The sidecar caps consecutive transient retries.
IfNum('Pick Retryable?', `={{ ($json.result && $json.result.retry) ? 1 : 0 }}`, 'equal', 1);
Http('Start Iteration', { path: '/api/iteration/start', body: `={{ { file: $('Rules: pick file').first().json.result.file } }}` });
Http('Baseline Mutation', { path: '/api/stryker/run', body: `={{ { file: $('Start Iteration').first().json.file, phase: 'baseline', stage: 'improving_mutation' } }}`, timeout: 2700000 });
Http('Coverage Gaps', { method: 'GET', urlExpr: `=${API}/api/files/gaps?path={{ encodeURIComponent($('Start Iteration').first().json.file) }}` });

chain('Start (manual)', 'Start Run');
chain('Start (webhook)', 'Start Run');
chain('Start Run', 'Clone Repo', 'Rules: post-clone', 'Install & Detect', 'Baseline Coverage',
  'Rules: pre-pick', 'Rules: write-test', 'Next Iteration', 'Get Candidates', 'More Work?');
link('More Work?', 'Rules: pick file', 0);
link('Rules: pick file', 'File Picked?');
link('File Picked?', 'Start Iteration', 0);
chain('Start Iteration', 'Baseline Mutation', 'Coverage Gaps');

// =============================================================================
// IMPROVEMENT PHASE (generic: coverage / mutation)
// =============================================================================
function phase(prefix, buildPromptCode, entryNode) {
  const B = (n) => `${prefix}: ${n}`;
  Code(B('Build Prompt'), buildPromptCode);
  IfNum(B('Has Work?'), `={{ $json.skip ? 0 : 1 }}`, 'equal', 1);
  Http(B('LLM Write Tests'), { path: '/api/llm/chat', body: '={{ $json }}', timeout: 900000 });
  Code(B('Parse Tests'), `
const resp = $json;
const plan = $('${B('Build Prompt')}').first().json;
let tests = (resp.ok && resp.json && Array.isArray(resp.json.tests)) ? resp.json.tests : [];
tests = tests
  .filter(t => t && typeof t.path === 'string' && typeof t.content === 'string' && t.content.trim().length > 10)
  .slice(0, 2)
  .map((t, i) => {
    let p = t.path.replace(/^\\.?\\//, '');
    const safe = /((^|\\/)(tests?|__tests__|spec)\\/|\\.(test|spec)\\.[cm]?[jt]sx?$)/.test(p) && !p.includes('..');
    const collides = p === plan.existingTestPath && plan.existingTestExists;
    if (!safe || collides) p = i === 0 ? plan.targetPath : plan.targetPath.replace('.test.', '-' + i + '.test.');
    return { path: p, content: t.content };
  });
return [{ json: { tests, paths: tests.map(t => t.path), count: tests.length } }];`);
  Http(B('Write Tests'), { path: '/api/test/write-many', body: `={{ { tests: $json.tests, stage: '${prefix === 'Cov' ? 'improving_coverage' : 'improving_mutation'}' } }}` });
  Http(B('Run Tests'), { path: '/api/test/run', body: `={{ { stage: '${prefix === 'Cov' ? 'improving_coverage' : 'improving_mutation'}' } }}`, timeout: 1200000 });
  IfNum(B('Green?'), '={{ $json.passed ? 1 : 0 }}', 'equal', 1);
  IfNum(B('Wrote Any?'), `={{ $('${B('Parse Tests')}').first().json.count }}`, 'larger', 0);
  Code(B('Build Repair'), `
const fail = $json;
const parsed = $('${B('Parse Tests')}').first().json;
const gaps = $('Coverage Gaps').first().json;
const filesTxt = parsed.tests.map(t => 'PATH: ' + t.path + '\\n' + t.content.slice(0, 6000)).join('\\n\\n---\\n\\n');
const system = 'You are an expert test engineer. Tests you previously wrote FAIL against the current implementation. Fix them. Keep the SAME file paths. Reply ONLY with JSON: {"tests":[{"path":"...","content":"full corrected file content"}]}. If a test asserts wrong expected values, correct the expectations to match the real behavior of the source. If a test cannot be fixed, drop it from the output.';
const prompt = 'TEST RUNNER OUTPUT (failures):\\n' + String(fail.summary || '').slice(0, 3500)
  + '\\n\\nYOUR TEST FILES:\\n' + filesTxt
  + '\\n\\nSOURCE FILE ' + gaps.path + ' (for reference):\\n' + String(gaps.source || '').slice(0, 10000)
  + '\\n\\nReply with corrected JSON now.';
return [{ json: { system, prompt, json: true, maxTokens: 6000, temperature: 0.2, stage: '${prefix === 'Cov' ? 'improving_coverage' : 'improving_mutation'}', stageDetail: 'repairing failing generated tests' } }];`);
  Http(B('LLM Repair'), { path: '/api/llm/chat', body: '={{ $json }}', timeout: 900000 });
  Code(B('Parse Repair'), `
const resp = $json;
const prev = $('${B('Parse Tests')}').first().json;
let tests = (resp.ok && resp.json && Array.isArray(resp.json.tests)) ? resp.json.tests : [];
tests = tests
  .filter(t => t && typeof t.content === 'string' && t.content.trim().length > 10)
  .slice(0, prev.paths.length)
  .map((t, i) => ({ path: prev.paths.includes(t.path) ? t.path : prev.paths[i], content: t.content }))
  .filter(t => t.path);
return [{ json: { tests, paths: tests.map(t => t.path), count: tests.length } }];`);
  Http(B('Write Repair'), { path: '/api/test/write-many', body: `={{ { tests: $json.tests } }}` });
  Http(B('Re-run Tests'), { path: '/api/test/run', body: `={{ {} }}`, timeout: 1200000 });
  IfNum(B('Green After Repair?'), '={{ $json.passed ? 1 : 0 }}', 'equal', 1);
  Http(B('Delete Broken Tests'), {
    path: '/api/test/delete-many',
    body: `={{ { paths: ($('${B('Parse Tests')}').first().json.paths || []).concat($('${B('Parse Repair')}').first().json.paths || []) } }}`,
  });
  NoOp(B('Done'));

  chain(entryNode, B('Build Prompt'), B('Has Work?'));
  link(B('Has Work?'), B('LLM Write Tests'), 0);
  link(B('Has Work?'), B('Done'), 1);
  chain(B('LLM Write Tests'), B('Parse Tests'), B('Write Tests'), B('Run Tests'), B('Green?'));
  link(B('Green?'), B('Done'), 0);
  link(B('Green?'), B('Wrote Any?'), 1);
  link(B('Wrote Any?'), B('Build Repair'), 0);
  link(B('Wrote Any?'), B('Done'), 1);
  chain(B('Build Repair'), B('LLM Repair'), B('Parse Repair'), B('Write Repair'), B('Re-run Tests'), B('Green After Repair?'));
  link(B('Green After Repair?'), B('Done'), 0);
  link(B('Green After Repair?'), B('Delete Broken Tests'), 1);
  link(B('Delete Broken Tests'), B('Done'));
  return B('Done');
}

// ── coverage phase ─────────────────────────────────────────────────────────
const covDone = phase('Cov', `
const gaps = $json; // response of Coverage Gaps
const file = $('Start Iteration').first().json.file;
const ext = (file.match(/\\.[cm]?[jt]sx?$/) || ['.ts'])[0];
const u = gaps.uncovered || {};
const fullyUncovered = u.lines === 'all';
// The coverage phase is a BOOTSTRAP only: it exists so a file is executed at all,
// because mutation testing has nothing to work with otherwise. Once any coverage
// exists, killing mutants raises coverage as a side effect, so we skip straight to
// the mutant loop instead of writing bulk coverage tests.
const nothingToCover = !gaps.needsBootstrap
  || (!fullyUncovered && (!u.lines || !u.lines.length) && (!u.functions || !u.functions.length) && (!u.branches || !u.branches.length));
const base = gaps.testPath.replace(/\\.(test|spec)\\.[cm]?[jt]sx?$/, '').replace(/\\.[cm]?[jt]sx?$/, '');
const roundSuffix = (gaps.rounds || 0) > 0 ? '-r' + ((gaps.rounds || 0) + 1) : '';
const targetPath = base + '.mac-cov' + roundSuffix + '.test' + ext;
if (nothingToCover) return [{ json: { skip: true, reason: gaps.needsBootstrap ? 'file fully covered' : 'already executed by tests — mutant loop takes it from here', targetPath, existingTestPath: gaps.testPath, existingTestExists: gaps.testExists } }];
const constraints = (gaps.constraints || []).map(c => '- ' + c).join('\\n');${UI_GUIDANCE_SNIPPET}
const system = 'You are an expert JavaScript/TypeScript test engineer writing ' + gaps.runner + ' tests to INCREASE LINE COVERAGE of one source file. Reply ONLY with JSON: {"tests":[{"path":"...","content":"full test file content"}]}. Create NEW test files only — never modify existing files. Preferred new file path: ' + targetPath + '. Rules:${COMMON_TEST_RULES.replace(/\n/g, '\\n')}'
  + uiGuidance
  + (constraints ? '\\nTeam constraints:\\n' + constraints : '');
const prompt = 'SOURCE FILE: ' + gaps.path + ' (package: ' + gaps.packageJson + ')\\n'
  + String(gaps.source || '').slice(0, 14000)
  + '\\n\\nUNCOVERED: ' + (fullyUncovered ? 'ENTIRE FILE (never imported by any test)' :
      'lines ' + JSON.stringify((u.lines || []).slice(0, 120))
      + '; functions ' + JSON.stringify((u.functions || []).slice(0, 30))
      + '; branches ' + JSON.stringify((u.branches || []).slice(0, 40)))
  + '\\n\\nEXISTING TEST FILE (' + gaps.testPath + ', style reference — do not rewrite it):\\n'
  + String(gaps.existingTest || '(none)').slice(0, 6000)
  + '\\n\\nWrite tests that execute the uncovered lines/functions/branches. JSON only.';
return [{ json: { system, prompt, json: true, maxTokens: 6000, temperature: 0.3, stage: 'improving_coverage', stageDetail: 'writing tests for uncovered code', targetPath, existingTestPath: gaps.testPath, existingTestExists: gaps.testExists } }];`,
  'Coverage Gaps');

// ── mutant loop: ONE target, ONE test, verified kill, repeat ───────────────
// The old batch approach ("here are 5 survivors, write tests") produced tests that
// passed but killed nothing. Now every committed test has a named victim and is
// kept only if that mutant actually died — dead weight becomes impossible rather
// than pruned afterwards, and the prompt shrinks to a single focused target.
function mutantLoop(entryNode) {
  Http('Next Mutant', {
    method: 'GET',
    urlExpr: `=${API}/api/mutant/next?path={{ encodeURIComponent($('Start Iteration').first().json.file) }}`,
    // may re-run mutation testing when the survivor list is stale (post-bootstrap)
    timeout: 2400000,
  });
  IfNum('Mutant To Kill?', '={{ $json.mutant ? 1 : 0 }}', 'equal', 1);

  Code('Kill: Build Prompt', `
const t = $json;                       // /api/mutant/next
const m = t.mutant;
const file = t.path;
const ext = (file.match(/\\.[cm]?[jt]sx?$/) || ['.ts'])[0];
const base = t.testPath.replace(/\\.(test|spec)\\.[cm]?[jt]sx?$/, '').replace(/\\.[cm]?[jt]sx?$/, '');
// one file per target keeps the suite readable and makes a failed attempt trivial to drop
const targetPath = base + '.kill-L' + m.line + '-' + String(m.mutator).toLowerCase() + '.test' + ext;
const gaps = { ui: t.ui, source: t.source, runner: t.runner, constraints: t.constraints };
${UI_GUIDANCE_SNIPPET}
const constraints = (t.constraints || []).map(c => '- ' + c).join('\\n');
const system = 'You are an expert test engineer. Write EXACTLY ONE ' + t.runner + ' test file containing the FEWEST tests needed to kill ONE specific Stryker mutant. '
  + 'A mutant is killed when a test FAILS on the mutated code while PASSING on the real code — so assert the precise value/behaviour the mutation would change. '
  + 'Reply ONLY with JSON: {"tests":[{"path":"' + targetPath + '","content":"full test file content"}]}. Rules:${COMMON_TEST_RULES.replace(/\n/g, '\\n')}'
  + uiGuidance
  + (constraints ? '\\nTeam constraints:\\n' + constraints : '');
const prompt = 'SOURCE FILE: ' + file + ' (package: ' + t.packageJson + ')\\n'
  + String(t.source || '').slice(0, 12000)
  + '\\n\\nTARGET MUTANT — kill this one:\\n'
  + '  mutator: ' + m.mutator + '\\n  line: ' + m.line + (m.column ? ':' + m.column : '') + '\\n'
  + '  the mutation replaces that code with: ' + JSON.stringify(m.replacement) + '\\n'
  + '  status: ' + (m.status === 'survived' ? 'covered by existing tests, but nothing asserts the difference' : 'not covered at all — your test must reach this code') + '\\n'
  + (m.context ? '\\nSOURCE AROUND THE TARGET:\\n' + m.context + '\\n' : '')
  + (t.killIdea ? '\\nHOW TO KILL IT (from the analysis that selected this mutant):\\n  ' + t.killIdea + '\\n' : '')
  + '\\nEXISTING TEST FILE (' + t.testPath + ', style reference — do not rewrite it):\\n'
  + String(t.existingTest || '(none)').slice(0, 4000)
  + '\\n\\nWrite the single test file that kills this mutant. JSON only.';
return [{ json: { system, prompt, json: true, maxTokens: 4000, temperature: 0.2,
  stage: 'improving_mutation', stageDetail: 'writing a test to kill ' + m.mutator + ' at line ' + m.line,
  targetPath } }];`);

  Http('Kill: LLM', { path: '/api/llm/chat', body: '={{ $json }}', timeout: 900000 });

  Code('Kill: Parse Test', `
const resp = $json;
const plan = $('Kill: Build Prompt').first().json;
let tests = (resp.ok && resp.json && Array.isArray(resp.json.tests)) ? resp.json.tests : [];
tests = tests
  .filter(t => t && typeof t.content === 'string' && t.content.trim().length > 10)
  .slice(0, 1)                                  // one target, one test file
  .map(t => {
    let p = String(t.path || '').replace(/^\\.?\\//, '');
    const safe = /((^|\\/)(tests?|__tests__|spec)\\/|\\.(test|spec)\\.[cm]?[jt]sx?$)/.test(p) && !p.includes('..');
    return { path: safe ? p : plan.targetPath, content: t.content };
  });
return [{ json: { tests, paths: tests.map(t => t.path), count: tests.length } }];`);

  Http('Kill: Write Test', {
    path: '/api/test/write-many',
    body: `={{ { tests: $json.tests, stage: 'improving_mutation' } }}`,
  });
  // suite must stay green AND the target must actually die; the sidecar deletes the
  // test and records the failed attempt when it does not
  Http('Kill: Verify', {
    path: '/api/mutant/verify',
    body: `={{ { file: $('Start Iteration').first().json.file, mutant: $('Next Mutant').first().json.mutant, testPaths: $('Kill: Parse Test').first().json.paths } }}`,
    timeout: 2400000,
  });
  NoOp('Mutant Loop Done');

  chain(entryNode, 'Next Mutant', 'Mutant To Kill?');
  link('Mutant To Kill?', 'Kill: Build Prompt', 0);
  link('Mutant To Kill?', 'Mutant Loop Done', 1);   // budget spent or nothing viable
  chain('Kill: Build Prompt', 'Kill: LLM', 'Kill: Parse Test', 'Kill: Write Test', 'Kill: Verify');
  link('Kill: Verify', 'Next Mutant');              // kept or dropped — either way, next target
  return 'Mutant Loop Done';
}
const mutDone = mutantLoop(covDone);

// =============================================================================
// VERIFY → CHECK RULES → PR / DISCARD → LOOP
// =============================================================================
Http('Verify', { path: '/api/verify', body: `={{ { file: $('Start Iteration').first().json.file } }}`, timeout: 3600000 });
// multi-round: keep the round iff ≥1 of coverage/mutation/MAC improved AND none degraded
IfNum('Another Round?', `={{ ($json.improvedAny && !$json.degradedAny && ($json.rounds || 0) < ($json.maxRounds || 5)) ? 1 : 0 }}`, 'equal', 1);
Http('Accept Round', { path: '/api/round/accept', body: `={{ { file: $('Start Iteration').first().json.file } }}` });
Http('Drop Last Round', { path: '/api/round/drop', body: `={{ { file: $('Start Iteration').first().json.file } }}` });
Http('Cleanup Tests', { path: '/api/test/cleanup', body: `={{ { file: $('Start Iteration').first().json.file } }}`, timeout: 3600000 });
Http('Rules: check changes', { path: '/api/rules/apply', body: `={{ { stage: 'check_changes', context: $('Drop Last Round').first().json } }}`, timeout: 600000 });
IfNum('Approved?', `={{ ($json.result && $json.result.approved && $('Drop Last Round').first().json.improved) ? 1 : 0 }}`, 'equal', 1);
Http('Rules: make PR', { path: '/api/rules/apply', body: `={{ { stage: 'make_pr', context: $('Drop Last Round').first().json } }}`, timeout: 600000 });
Http('Create PR', {
  path: '/api/pr/create',
  body: `={{ { file: $('Start Iteration').first().json.file, title: $json.result.title, body: $json.result.body, labels: $json.result.labels } }}`,
  timeout: 300000,
});
Http('Discard Changes', { path: '/api/iteration/discard', body: `={{ { file: $('Start Iteration').first().json.file, reason: $('Rules: check changes').first().json.result.reason || 'not approved' } }}` });
NoOp('Iteration Done');
Http('Finish Run', { path: '/api/run/finish', body: '={{ {} }}' });
NoOp('End');

chain(mutDone, 'Verify', 'Another Round?');
link('Another Round?', 'Accept Round', 0);
link('Accept Round', 'Coverage Gaps');           // next round on the same file
link('Another Round?', 'Drop Last Round', 1);
chain('Drop Last Round', 'Rules: check changes', 'Approved?');
link('Approved?', 'Cleanup Tests', 0);
link('Cleanup Tests', 'Rules: make PR');
link('Approved?', 'Discard Changes', 1);
chain('Rules: make PR', 'Create PR', 'Iteration Done');
link('Discard Changes', 'Iteration Done');
link('Iteration Done', 'Next Iteration');
link('More Work?', 'Finish Run', 1);
link('File Picked?', 'Pick Retryable?', 1);
link('Pick Retryable?', 'Next Iteration', 0);   // transient → pick again
link('Pick Retryable?', 'Finish Run', 1);       // terminal → done
link('Finish Run', 'End');

// =============================================================================
const out = {
  id: WORKFLOW_ID,
  name: w.name,
  nodes: w.nodes,
  connections: w.connections,
  active: true,
  settings: { executionOrder: 'v1', timezone: 'UTC' },
  tags: [],
};
writeFileSync(join(OUT, 'Improve-JS-Tests.json'), JSON.stringify(out, null, 2));
console.log(`✓ ${w.name}: ${w.nodes.length} nodes`);

// static safety scan: forbid non-native/system node types
const allowed = ['n8n-nodes-base.manualTrigger', 'n8n-nodes-base.webhook', 'n8n-nodes-base.httpRequest',
  'n8n-nodes-base.code', 'n8n-nodes-base.if', 'n8n-nodes-base.noOp', 'n8n-nodes-base.splitInBatches'];
const bad = w.nodes.filter((n) => !allowed.includes(n.type));
const shellish = w.nodes.filter((n) => n.type === 'n8n-nodes-base.code' && /child_process|execSync|spawn|require\(['"]fs['"]\)|readFileSync|writeFileSync/.test(n.parameters.jsCode || ''));
if (bad.length || shellish.length) {
  console.error('CONSTRAINT VIOLATION', { bad: bad.map((n) => n.name), shellish: shellish.map((n) => n.name) });
  process.exit(1);
}
console.log('✓ native-nodes-only constraint satisfied');
