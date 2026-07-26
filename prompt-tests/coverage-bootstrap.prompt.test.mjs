// The prompt that bootstraps a source file NOTHING executes yet — the pipeline's
// largest single reasoning spend, and the call that returned two empty completions in
// a live run. It writes up to two whole test files from scratch, and every later phase
// rides on them: a generated file that does not parse is deleted and the round is
// spent for nothing, while a file that parses but imports nothing runs green forever
// and raises coverage by zero, which is the one thing this phase exists to do.
//
// Four claims, each decided by the sidecar or by node itself — never by reading the
// tests and finding them reasonable. Each criterion is stated in a comment above the
// code that enforces it, and each was checked against a reply broken in exactly that
// way before it was trusted: a file importing nothing reddens claim 3 alone, an
// unparseable file claim 2 alone, a copy of the style reference claims 1/3/4, an empty
// `tests` array claims 1/2/3. A criterion that has never been seen to fail is a
// decoration, and one of these was — see `parses` for what it was quietly passing.
//
// What it does NOT reach: the budget cliff. The fixture source below is 17 lines, and
// the longest reasoning phase measured over it was ~14 000 characters against a 12 000
// TOKEN budget — comfortable headroom. The empty completions that motivated this file
// came from real sources near covBuildPrompt's 14 000-character source ceiling, where
// that headroom is gone. This guards the SHAPE of the answer, not the budget.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

import { ask, samples, skipUnlessLive } from './helpers/ask.mjs';
import { leakedReasoning } from './harness/kill-check.mjs';
import { covBuildPrompt } from '../n8n/nodes/cov-build-prompt.js';
import { covParseTests } from '../n8n/nodes/cov-parse-tests.js';
// The sidecar's OWN json extraction, imported rather than reimplemented: a test that
// parsed the reply more strictly than llm.js does would fail the prompt for something
// production survives, and one that parsed it more loosely would pass a reply
// production throws away.
import { extractJson, extractLastJsonObject } from '../sidecar/util.js';

// ── fixture ────────────────────────────────────────────────────────────────

const FILE = 'src/inventory.js';

// PLAIN JAVASCRIPT ON PURPOSE. Criterion 2 below is `node --check`, which is a real
// parser for .js and cannot read TypeScript at all. On a .ts fixture the syntax
// verdict would be theatre — either everything passes because we never really check,
// or everything fails on the types. The repos this pipeline runs against are mostly
// TS; this file deliberately pins the JS half, where the answer is honest, and claims
// nothing about TS output.
const SOURCE = `const LOW_STOCK = 3;

export function restock(items, sku, qty) {
  if (qty <= 0) throw new RangeError('qty must be positive');
  const known = items.some((i) => i.sku === sku);
  if (!known) return [...items, { sku, qty }];
  return items.map((i) => (i.sku === sku ? { ...i, qty: i.qty + qty } : i));
}

export function lowStock(items, threshold = LOW_STOCK) {
  return items.filter((i) => i.qty < threshold).map((i) => i.sku);
}

export function stockValue(items, prices) {
  return items.reduce((sum, i) => sum + i.qty * (prices[i.sku] ?? 0), 0);
}
`;
const EXPORTS = ['restock', 'lowStock', 'stockValue'];

// A test of a DIFFERENT module, which is what repo.findStyleReference hands over when
// the picked file has no test of its own. It is git-tracked, so writeTestFile refuses
// to touch it (isRepoOwnedTest) — hence criterion 4.
const STYLE_REF_PATH = 'test/greet.test.js';
const STYLE_REF_MARKER = 'includes the honorific when one is given';
const STYLE_REF = `import { describe, it, expect } from 'vitest';
import { greet } from '../src/greet.js';

describe('greet', () => {
  it('${STYLE_REF_MARKER}', () => {
    expect(greet('Ada', 'Dr')).toBe('Hello, Dr Ada');
  });
});
`;

// The GET /api/files/gaps response for a file no test has ever loaded, field for field
// as sidecar/server.js builds it: `uncovered` is coverage.uncoveredLines()'s
// never-loaded verdict, `ui` is detectUi()'s null for a repo with no framework dep,
// and `existingTest` carries the style-reference header the route prepends.
const GAPS = {
  ok: true,
  path: FILE,
  source: SOURCE,
  sourceLines: SOURCE.split('\n').length,
  uncovered: { lines: 'all', note: 'file never loaded by tests — 0% coverage' },
  rounds: 0,
  survived: [],
  needsBootstrap: true,
  ui: null,
  testPath: 'test/inventory.test.js',
  testExists: false,
  existingTest: `// STYLE REFERENCE — an existing test from this repo (${STYLE_REF_PATH}).\n`
    + `// Imitate its imports, aliases and conventions. Do not modify it.\n${STYLE_REF}`,
  runner: 'vitest',
  constraints: [],
  packageJson: 'shopfront (type=module)',
};

// What the DEPLOYED pipeline sends. covBuildPrompt asks for 6000 completion tokens and
// llm.js silently adds LLM_THINKING_BUDGET on top when thinking is on (6000 in
// .env.production). Reproducing that arithmetic matters more here than any other knob:
// the empty completions this file exists for are a budget symptom, and a test that
// quietly handed the model 24k tokens would never see them.
const THINKING_EXTRA = 6000;
const SAMPLES = 3;

// ── mechanical checks ──────────────────────────────────────────────────────

// CRITERION 1. "A path the sidecar would accept" means what sidecar/repo.js means:
// TEST_PATH_RE, then the js/ts extension check inside writeTestFile, then the refusal
// to overwrite a git-tracked test. A path that fails any of the three is a file
// "Cov: Write Tests" reports and never creates, after which the suite runs against
// something that does not exist.
const SIDECAR_TEST_PATH_RE = /((^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$)/;
const SIDECAR_EXT_RE = /\.[cm]?[jt]sx?$/;
const REPO_OWNED = [STYLE_REF_PATH];
const sidecarWouldWrite = (p) =>
  SIDECAR_TEST_PATH_RE.test(p) && SIDECAR_EXT_RE.test(p) && !p.includes('..') && !REPO_OWNED.includes(p);

// CRITERION 2. Syntax, decided by the same parser that will load the file. Nothing is
// executed — a bootstrap test may legitimately fail an assertion against the real
// module; what it may not do is fail to PARSE, because that is what gets it deleted.
//
// The package.json beside the candidate is not decoration. Measured on Node 22.22.2:
// `node --check x.js` with no package.json in scope exits 0 for ANY file containing
// import/export syntax — including `import {a} from './x.js'; const = ;`. The
// CommonJS parse fails, module syntax is detected, and the retry reports success
// instead of the error. Declaring type=module (which is what this fixture's package
// says anyway) restores a real verdict; without it this criterion passes everything
// and measures nothing. Verified in both directions before the first live run.
function parses(content, name = 'candidate.js') {
  const dir = mkdtempSync(join(tmpdir(), 'ijst-cov-'));
  try {
    writeFileSync(join(dir, 'package.json'), '{"type":"module"}');
    const f = join(dir, name.replace(/.*\//, ''));
    writeFileSync(f, content);
    execFileSync(process.execPath, ['--check', f], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 20000 });
    return { ok: true, error: '' };
  } catch (e) {
    const lines = String(e.stderr || e.message).split('\n').map((l) => l.trim()).filter(Boolean);
    return { ok: false, error: (lines.find((l) => /Error/.test(l)) || lines[0] || '').slice(0, 120) };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// CRITERION 3. Two halves, both textual and both exact:
//   (a) the module under test is IMPORTED — via `from '...'`, `import('...')` or
//       `require('...')`. `vi.mock('../src/inventory.js')` deliberately does not
//       count: mocking a module is the opposite of executing it.
//   (b) at least one of its exports appears in CALL position. A name followed by `(`
//       cannot occur inside an import clause, so the two halves cannot satisfy each
//       other by accident.
// Together they are the weakest thing that can possibly raise coverage. A file that
// imports nothing runs green forever and moves the number this phase exists to move
// by exactly zero.
const IMPORTS_MODULE =
  /(?:from\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)['"][^'"]*\binventory(?:\.[cm]?[jt]sx?)?['"]/;
const callsFromModule = (src) => EXPORTS.filter((n) => new RegExp(`\\b${n}\\s*\\(`).test(src));

// CRITERION 4. Two ways to "rewrite" the file the prompt told it not to touch: aim a
// test at its path, or hand its contents back under another name. The first is refused
// outright by writeTestFile and costs the round a file; the second raises the picked
// file's coverage by nothing at all.
const rewritesReference = (t) => t.path === STYLE_REF_PATH || t.content.includes(STYLE_REF_MARKER);

// ── one live batch per thinking setting, shared by every claim ──────────────

// Four verdicts over the SAME evidence. Re-drawing per criterion would quadruple a
// 90-second call and — worse — let each claim be judged on a different roll, so a
// summary reading "3/3 parse, 3/3 import" could describe six unrelated files.
async function draw(thinking) {
  const plan = covBuildPrompt(GAPS, FILE);
  const r = await ask({
    system: plan.system, prompt: plan.prompt, json: plan.json,
    temperature: plan.temperature,
    maxTokens: plan.maxTokens + (thinking ? THINKING_EXTRA : 0),
    thinking,
  });
  // llm.js's own path: parse the content, and when the reasoning phase ate the budget
  // before anything was emitted, salvage the finished object out of `reasoning`. The
  // repair TURN is not mirrored, so a sample that yields nothing here is one the
  // pipeline pays a second full call for.
  let json = extractJson(r.content);
  let salvaged = false;
  if (json == null && r.reasoning) {
    json = extractLastJsonObject(r.reasoning);
    salvaged = json != null;
  }
  const parsed = covParseTests({ ok: true, json }, plan);
  const files = parsed.tests.map((t) => ({
    path: t.path,
    accepted: sidecarWouldWrite(t.path),
    syntax: parses(t.content, t.path),
    imports: IMPORTS_MODULE.test(t.content),
    calls: callsFromModule(t.content),
    rewrites: rewritesReference(t),
    leaks: leakedReasoning(t.content),
    chars: t.content.length,
    // Crude, and labelled as such: counting cases and assertions says nothing about
    // whether they are GOOD ones. It is here because "valid but thinner" is the one
    // way reasoning could still be earning its 4x latency, and a decision made without
    // any size number at all would be made on latency alone.
    cases: (t.content.match(/\b(?:it|test)\s*\(/g) || []).length,
    asserts: (t.content.match(/\bexpect\s*\(/g) || []).length,
  }));
  return { r, plan, salvaged, files };
}

// The arm the assertions judge must be the arm production actually uses. The bootstrap
// runs cold now (measured: same parse/syntax/import rates, 2.5-3.7x faster, more tests
// on the hardest file), so asserting on the thinking arm would test a configuration
// nothing runs — and would take fourteen minutes to do it.
const PRODUCTION_THINKING = covBuildPrompt(GAPS, FILE).thinking !== false;

const BATCHES = new Map();
function batch(thinking) {
  if (!BATCHES.has(thinking)) {
    BATCHES.set(thinking, (async () => {
      const out = [];
      for (let i = 0; i < SAMPLES; i++) out.push(await draw(thinking));
      return out;
    })());
  }
  return BATCHES.get(thinking);
}

// ── the claims ─────────────────────────────────────────────────────────────

test('the coverage bootstrap returns at least one test file the sidecar will actually write',
  { skip: skipUnlessLive, timeout: 900000 }, async () => {
    // PASS: covParseTests yields >= 1 test and EVERY path it yields survives
    // repo.writeTestFile's allowlist.
    //
    // The load-bearing half is ">= 1". A draw that yields nothing costs the entire
    // round, and that is the failure this call has an actual history of. The path half
    // rarely fires by design: covParseTests REPAIRS an unusable path to
    // plan.targetPath — fed 'notes/inventory.txt' it returns
    // test/inventory.mac-cov.test.js — so it is not policing the model here. It is
    // kept because it is the only thing that would notice if that repair were dropped
    // and the model's own path choice started reaching the sidecar.
    const B = await batch(PRODUCTION_THINKING);
    const { passed, total } = await samples(SAMPLES, (i) => {
      const d = B[i];
      const ok = d.files.length > 0 && d.files.every((f) => f.accepted);
      return { ok, note: `${d.r.secs.toFixed(0)}s finish=${d.r.finishReason} content=${d.r.content.length}ch `
        + `reasoning=${d.r.reasoning.length}ch${d.salvaged ? ' SALVAGED' : ''} `
        + `→ ${d.files.length} file(s) ${JSON.stringify(d.files.map((f) => f.path))}` };
    });
    assert.equal(passed, total,
      `${total - passed}/${total} draws produced no writable test file — this is the phase's only output, `
      + 'and a draw that produces nothing costs a whole round');
  });

test('every file the bootstrap emits parses as JavaScript — one that does not is deleted',
  { skip: skipUnlessLive, timeout: 900000 }, async () => {
    // PASS: `node --check` accepts every emitted file, in all SAMPLES draws.
    const B = await batch(PRODUCTION_THINKING);
    const { passed, total } = await samples(SAMPLES, (i) => {
      const d = B[i];
      const bad = d.files.filter((f) => !f.syntax.ok);
      return { ok: d.files.length > 0 && bad.length === 0,
        note: `${d.files.length} file(s), ${d.files.map((f) => f.chars).join('/')}ch, `
          + (bad.length ? `PARSE FAIL: ${bad[0].syntax.error}` : 'all parse') };
    });
    assert.equal(passed, total, 'a generated test that does not parse is thrown away and the round is wasted');
  });

test('the bootstrapped test imports the module under test and calls it — an import-less test cannot raise coverage',
  { skip: skipUnlessLive, timeout: 900000 }, async () => {
    // PASS: in every draw, at least one emitted file both imports src/inventory.js and
    // calls one of its exports. This is the entire job of the phase: the coverage
    // bootstrap exists so the file is EXECUTED at all, because mutation testing has
    // nothing to work with until it is.
    const B = await batch(PRODUCTION_THINKING);
    const { passed, total } = await samples(SAMPLES, (i) => {
      const d = B[i];
      const live = d.files.filter((f) => f.imports && f.calls.length > 0);
      return { ok: live.length > 0,
        note: `${live.length}/${d.files.length} file(s) execute the module; exports called: `
          + JSON.stringify([...new Set(d.files.flatMap((f) => f.calls))]) };
    });
    assert.equal(passed, total, 'a bootstrap that imports nothing leaves the file at 0% and the mutant loop with no mutants');
  });

test('the bootstrap writes a NEW file instead of rewriting the style reference it was shown',
  { skip: skipUnlessLive, timeout: 900000 }, async () => {
    // PASS: no emitted file targets the git-tracked reference's path, and none carries
    // the reference's contents back. covParseTests only guards `plan.existingTestPath`,
    // which in a bootstrap is a path that does not exist yet — the reference the model
    // is actually shown is a DIFFERENT, repo-owned file, and nothing between the model
    // and the sidecar's refusal protects it. So this is checked on the model.
    const B = await batch(PRODUCTION_THINKING);
    const { passed, total } = await samples(SAMPLES, (i) => {
      const d = B[i];
      const bad = d.files.filter((f) => f.rewrites);
      return { ok: bad.length === 0, note: bad.length ? `REWRITES ${bad[0].path}` : `left ${STYLE_REF_PATH} alone` };
    });
    assert.equal(passed, total, 'the reference is a repo-owned file: writeTestFile refuses it, so a draw aimed there is a lost file');
  });

test('MEASUREMENT: the same bootstrap prompt with reasoning OFF — reported, not asserted',
  { skip: skipUnlessLive, timeout: 900000 }, async () => {
    // Reasoning is on for this call today, and it is the pipeline's biggest consumer of
    // it. This does not decide the question, it supplies the numbers for it: latency,
    // how much of the output survives the same four checks, and whether the reasoning
    // that no longer has a channel of its own reappears as commentary inside the test
    // file (D11 — the thing the thinking channel is meant to prevent).
    //
    // The only assertion is about the measurement itself: three answered calls. A
    // silently failing endpoint must not be reported as a result.
    const [on, off] = [await batch(PRODUCTION_THINKING), await batch(!PRODUCTION_THINKING)];
    const line = (label, B) => {
      const files = B.flatMap((d) => d.files);
      const clean = files.filter((f) => f.syntax.ok && f.imports && f.calls.length && f.accepted && !f.rewrites);
      const secs = B.map((d) => d.r.secs);
      const sum = (xs) => xs.reduce((a, b) => a + b, 0);
      console.log(`      ${label}: ${(sum(secs) / secs.length).toFixed(0)}s avg `
        + `(${secs.map((s) => s.toFixed(0)).join('/')}), ${files.length} file(s) over ${B.length} draws, `
        + `${clean.length}/${files.length} pass all four checks, `
        + `${files.filter((f) => f.leaks.length).length}/${files.length} leak reasoning, `
        + `reasoning ${B.map((d) => d.r.reasoning.length).join('/')}ch, `
        + `salvaged ${B.filter((d) => d.salvaged).length}/${B.length}`);
      console.log(`        size: ${sum(files.map((f) => f.cases))} cases / `
        + `${sum(files.map((f) => f.asserts))} assertions / ${sum(files.map((f) => f.chars))}ch over ${B.length} draws `
        + `(per draw: ${B.map((d) => sum(d.files.map((f) => f.cases))).join('/')} cases)`);
      const leaks = files.flatMap((f) => f.leaks);
      if (leaks.length) console.log(`        leaked: ${JSON.stringify(leaks.slice(0, 3))}`);
    };
    line('thinking ON ', on);
    line('thinking OFF', off);
    assert.equal(off.filter((d) => d.r.status === 200).length, SAMPLES, 'the measurement itself has to have happened');
  });
