// Generates the n8n workflow JSON for improve-javascript-tests.
//
// HARD CONSTRAINT: only native n8n nodes — Manual/Webhook triggers, HTTP Request,
// Code (pure JS data transforms: no child_process, no fs, no shell), IF, NoOp.
// Every OS-touching operation goes through the sidecar HTTP API on :3000.
//
// Run: node generate-workflows.mjs → writes workflows/Improve-JS-Tests.json

// The 6 Code nodes' logic lives in ./nodes/*.js as plain, importable, unit-testable
// functions; `emit` inlines their SOURCE here so there is exactly one copy of it.
// The 10 IF conditions live in ./nodes/conditions.js for the same reason.
// All this file still owns is the WIRING: which graph value feeds which argument.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { emit } from './emit.js';
import { nodeId } from './node-id.js';
import { condition } from './nodes/conditions.js';
import { uiGuidance } from './nodes/ui-guidance.js';
import { commonTestRules } from './nodes/common-test-rules.js';
import { covBuildPrompt } from './nodes/cov-build-prompt.js';
import { covParseTests } from './nodes/cov-parse-tests.js';
import { covBuildRepair } from './nodes/cov-build-repair.js';
import { covParseRepair } from './nodes/cov-parse-repair.js';
import { killBuildPrompt } from './nodes/kill-build-prompt.js';
import { killParseTest } from './nodes/kill-parse-test.js';

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
  w.nodes.push({ parameters, type, typeVersion, position: pos(), id: nodeId(name), name });
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
// the expression and its comparison both come from nodes/conditions.js — an IF
// condition must never exist in two places
const IfNum = (name) => add('n8n-nodes-base.if', name, { conditions: { number: [condition(name)] } }, 1);

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

// Shared prompt fragments both builders call. Passed to `emit` as deps so their
// source is inlined alongside whichever builder needs them.
const PROMPT_DEPS = [uiGuidance, commonTestRules];

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
IfNum('More Work?');
Http('Rules: pick file', { path: '/api/rules/apply', body: `={{ { stage: 'pick_file' } }}` });
IfNum('File Picked?');
IfNum('Pick Retryable?');
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
IfNum('Baseline OK?');
chain('Start Iteration', 'Baseline Mutation', 'Baseline OK?');
link('Baseline OK?', 'Coverage Gaps', 0);

// =============================================================================
// IMPROVEMENT PHASE (generic: coverage / mutation)
// =============================================================================
function phase(prefix, buildPromptCode, entryNode) {
  const B = (n) => `${prefix}: ${n}`;
  const stage = prefix === 'Cov' ? 'improving_coverage' : 'improving_mutation';
  Code(B('Build Prompt'), buildPromptCode);
  IfNum(B('Has Work?'));
  Http(B('LLM Write Tests'), { path: '/api/llm/chat', body: '={{ $json }}', timeout: 900000 });
  Code(B('Parse Tests'), emit(covParseTests, [],
    '$json',                                       // the LLM response
    `$('${B('Build Prompt')}').first().json`));    // the plan it was asked to follow
  Http(B('Write Tests'), { path: '/api/test/write-many', body: `={{ { tests: $json.tests, stage: '${stage}' } }}` });
  Http(B('Run Tests'), { path: '/api/test/run', body: `={{ { stage: '${stage}' } }}`, timeout: 1200000 });
  IfNum(B('Green?'));
  IfNum(B('Wrote Any?'));
  Code(B('Build Repair'), emit(covBuildRepair, [],
    '$json',                                       // the failing test run
    `$('${B('Parse Tests')}').first().json`,       // the files we wrote
    `$('Coverage Gaps').first().json`,             // the source, for reference
    `'${stage}'`));
  Http(B('LLM Repair'), { path: '/api/llm/chat', body: '={{ $json }}', timeout: 900000 });
  Code(B('Parse Repair'), emit(covParseRepair, [],
    '$json',                                       // the repaired files
    `$('${B('Parse Tests')}').first().json`));    // the only paths a repair may touch
  Http(B('Write Repair'), { path: '/api/test/write-many', body: `={{ { tests: $json.tests } }}` });
  Http(B('Re-run Tests'), { path: '/api/test/run', body: `={{ {} }}`, timeout: 1200000 });
  IfNum(B('Green After Repair?'));
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
const covDone = phase('Cov', emit(covBuildPrompt, PROMPT_DEPS,
  '$json',                                         // response of Coverage Gaps
  `$('Start Iteration').first().json.file`),       // the file this iteration improves
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
  IfNum('Mutant To Kill?');

  // attempt one, deliberately WITHOUT reasoning: measured 21-28s against 112-186s
  Code('Kill: Build Prompt', emit(killBuildPrompt, PROMPT_DEPS,
    '$json',                                       // response of Next Mutant
    '{ thinking: false }'));

  Http('Kill: LLM', { path: '/api/llm/chat', body: '={{ $json }}', timeout: 900000 });

  Code('Kill: Parse Test', emit(killParseTest, [],
    '$json',                                       // the LLM response
    `$('Kill: Build Prompt').first().json`));      // the plan it was asked to follow

  Http('Kill: Write Test', {
    path: '/api/test/write-many',
    body: `={{ { tests: $json.tests, stage: 'improving_mutation' } }}`,
  });
  // suite must stay green AND the target must actually die; the sidecar deletes the
  // test and records the failed attempt when it does not
  IfNum('Kill: Escalate?');

  // ── second attempt, with reasoning ────────────────────────────────────────
  Code('Kill: Build Prompt 2', emit(killBuildPrompt, PROMPT_DEPS,
    "$('Next Mutant').first().json", '{ thinking: true, escalated: true }'));
  Http('Kill: LLM 2', { path: '/api/llm/chat', body: '={{ $json }}', timeout: 900000 });
  Code('Kill: Parse Test 2', emit(killParseTest, [], '$json', "$('Kill: Build Prompt 2').first().json"));
  Http('Kill: Write Test 2', {
    path: '/api/test/write-many',
    body: `={{ { tests: $json.tests, stage: 'improving_mutation' } }}`,
  });
  Http('Kill: Verify 2', {
    path: '/api/mutant/verify',
    body: `={{ { file: $('Start Iteration').first().json.file, mutant: $('Next Mutant').first().json.mutant, testPaths: $('Kill: Write Test 2').first().json.written, phase: 'thinking' } }}`,
    timeout: 2400000,
  });

  Http('Kill: Verify', {
    path: '/api/mutant/verify',
    // what the SIDECAR wrote, not what the model asked for: writeTestFile refuses a
    // path that is not a js/ts test file or that the repo already owned, and a
    // refusal lands in `errors`. Verifying the planned path would then measure a file
    // that does not exist — a scoped run that passes vacuously and a mutation run
    // spent proving nothing died.
    body: `={{ { file: $('Start Iteration').first().json.file, mutant: $('Next Mutant').first().json.mutant, testPaths: $('Kill: Write Test').first().json.written, phase: 'cheap' } }}`,
    timeout: 2400000,
  });
  NoOp('Mutant Loop Done');

  chain(entryNode, 'Next Mutant', 'Mutant To Kill?');
  link('Mutant To Kill?', 'Kill: Build Prompt', 0);
  link('Mutant To Kill?', 'Mutant Loop Done', 1);   // budget spent or nothing viable
  chain('Kill: Build Prompt', 'Kill: LLM', 'Kill: Parse Test', 'Kill: Write Test', 'Kill: Verify');
  // killed, or the cheap attempt used up the mutant's shot → next target.
  // Otherwise the target is still on the queue and reasoning is what is left to try.
  chain('Kill: Verify', 'Kill: Escalate?');
  link('Kill: Escalate?', 'Kill: Build Prompt 2', 0);
  link('Kill: Escalate?', 'Next Mutant', 1);
  chain('Kill: Build Prompt 2', 'Kill: LLM 2', 'Kill: Parse Test 2', 'Kill: Write Test 2', 'Kill: Verify 2');
  link('Kill: Verify 2', 'Next Mutant');
  return 'Mutant Loop Done';
}
const mutDone = mutantLoop(covDone);

// =============================================================================
// VERIFY → CHECK RULES → PR / DISCARD → LOOP
// =============================================================================
Http('Verify', { path: '/api/verify', body: `={{ { file: $('Start Iteration').first().json.file } }}`, timeout: 3600000 });
IfNum('Another Round?');
Http('Accept Round', { path: '/api/round/accept', body: `={{ { file: $('Start Iteration').first().json.file } }}` });
Http('Drop Last Round', { path: '/api/round/drop', body: `={{ { file: $('Start Iteration').first().json.file } }}` });
Http('Cleanup Tests', { path: '/api/test/cleanup', body: `={{ { file: $('Start Iteration').first().json.file } }}`, timeout: 3600000 });
Http('Rules: check changes', { path: '/api/rules/apply', body: `={{ { stage: 'check_changes', context: $('Drop Last Round').first().json } }}`, timeout: 600000 });
IfNum('Approved?');
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
// a file whose baseline could not be measured goes straight to the next one
link('Baseline OK?', 'Iteration Done', 1);
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
// `emit` inlines by SOURCE, so a node function that calls a shared helper the binding
// line forgot to list in `deps` yields a Code node that only blows up inside n8n at
// run time. Catch the missing copy here instead.
const HELPERS = [uiGuidance, commonTestRules];
const unbound = w.nodes.filter((n) => n.type === 'n8n-nodes-base.code' && HELPERS.some((h) =>
  new RegExp(`\\b${h.name}\\s*\\(`).test(n.parameters.jsCode || '') && !(n.parameters.jsCode || '').includes(`function ${h.name}(`)));
if (bad.length || shellish.length || unbound.length) {
  console.error('CONSTRAINT VIOLATION', { bad: bad.map((n) => n.name), shellish: shellish.map((n) => n.name), unbound: unbound.map((n) => n.name) });
  process.exit(1);
}
console.log('✓ native-nodes-only constraint satisfied');
