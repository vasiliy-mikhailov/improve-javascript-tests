'use strict';
// ═══════════════════════════════════════════════════════════════════════════
//  FAKES FOR THE OS-TOUCHING LAYER
//
//  Everything the sidecar does that needs a real machine — Stryker, the
//  coverage run, the test suite, the LLM, git and `gh` — is replaced here by a
//  deterministic model. The routes themselves stay real: this file exists so a
//  route test can assert on STATE after a realistic sequence of calls without
//  spawning anything.
//
//  Load order matters. Require './env' FIRST in the test file (it captures
//  DATA_DIR before any sidecar module loads); this file re-requires it, so a
//  test that only requires fakes is still safe, but the documented order is:
//
//      const { withSandbox } = require('./helpers/env');    // FIRST, always
//      const { installFakes } = require('./helpers/fakes');
//
//  ── THE MUTATION UNIVERSE ─────────────────────────────────────────────────
//  A real Stryker fixture cannot express the one case the whole one-shot-per-
//  mutant design exists for: an EQUIVALENT mutant, which no test can ever kill.
//  You would have to write a source file with a provably unobservable mutation
//  and hope Stryker generates exactly that mutant. So the universe is DATA:
//  each file declares its mutants, and each mutant declares how it dies.
//
//      { mutator, line, column, replacement, status, ...kill rules }
//
//    dies-when-a-test-names-its-line   the default. A generated test carries
//                                      `// KILLS: <line>` markers; every
//                                      non-equivalent mutant on a named line
//                                      dies.
//    collateral: [lines]               killing this mutant also kills the
//                                      mutants on those lines (transitively) —
//                                      one sharp test taking neighbours with it.
//    equivalent: true                  NEVER dies, whatever anyone writes.
//    killedAtBaseline: true            already killed by the repo's own tests.
//    timeout: true                     counted as killed, reported in timedOut.
//
//  A file with no test targeting it at all reproduces Stryker's "No tests were
//  executed" answer: { totalMutants: null, killed: 0, score: 0, survived: [],
//  noTests: true }. That is what a 0-coverage file looks like at baseline, and
//  it is the setup for BUG-2.
//
//  ── THE TEST-FILE DSL ─────────────────────────────────────────────────────
//  Generated tests are written to the sandbox repo by the REAL
//  repo.writeTestFile, so path validation, deletion and "is it still on disk?"
//  are all genuine. Their content is a tiny marker language read back by the
//  fake runners:
//
//      // TARGET: src/a.ts     this test exercises that source file
//      // KILLS: 42            it kills the mutants on line 42
//      // SUITE: RED           this test fails, so the suite is red
//
//  world.testSource({ target, kills, red }) writes one.
// ═══════════════════════════════════════════════════════════════════════════

const fs = require('node:fs');
const path = require('node:path');
const { sidecar, setChatImpl } = require('./env');

const { S, repo, coverage, stryker, tests, pr, util } = sidecar;
const { round2 } = util;

const DEFAULT_PKG = {
  name: 'fake-repo',
  version: '1.0.0',
  private: true,
  scripts: { test: 'vitest run' },
  devDependencies: { vitest: '^3.0.0' },
};

// Matches repo.js's own notion of a test file, so anything writeTestFile
// accepts is anything the fake runners can see.
const TEST_FILE_RE = /((^|\/)(tests?|__tests__|spec)\/|\.(test|spec)\.[cm]?[jt]sx?$)/;

/** Synthetic source, long enough that line numbers in mutants mean something. */
function defaultSource(p, lines) {
  const out = [`// ${p} — synthetic source for the fake mutation universe`];
  for (let i = 2; i <= lines; i++) out.push(`export const v${i} = (a) => (a >= ${i} ? ${i} : 0);`);
  return out.join('\n');
}

function normMutant(m) {
  if (m.line == null) throw new Error('a universe mutant needs a line');
  return {
    mutator: m.mutator ?? 'EqualityOperator',
    line: m.line,
    column: m.column ?? 5,
    endLine: m.endLine ?? m.line,
    replacement: m.replacement ?? '<=',
    status: m.status ?? 'survived',        // 'survived' | 'nocoverage'
    equivalent: !!m.equivalent,
    collateral: m.collateral ? [...m.collateral] : [],
    killedAtBaseline: !!m.killedAtBaseline,
    timeout: !!m.timeout,
  };
}

function normFile(spec) {
  const source = spec.source ?? defaultSource(spec.path, spec.sourceLines ?? 60);
  return {
    path: spec.path,
    source,
    // coverage the file reports once at least one test targets it, and before
    coverageWithTests: spec.coverageWithTests ?? 85,
    coverageWithout: spec.coverageWithout ?? 0,
    uncovered: spec.uncovered ?? [3, 4, 5],
    mutants: (spec.mutants || []).map(normMutant),
  };
}

/**
 * Install the fakes into one sandbox. Restores itself on sb.cleanup().
 * @param {object} sb        a sandbox from helpers/env
 * @param {object} [opts]
 * @param {object} [opts.pkg]  extra package.json fields (e.g. react, for detectUi)
 */
function installFakes(sb, opts = {}) {
  const repoDir = sb.repoDir;
  fs.mkdirSync(repoDir, { recursive: true });
  fs.writeFileSync(path.join(repoDir, 'package.json'),
    JSON.stringify({ ...DEFAULT_PKG, ...(opts.pkg || {}) }, null, 2));

  const universe = new Map();
  const git = { branch: 'main', committed: new Set(), uncommitted: new Set(), commits: [] };
  const calls = { stryker: [], coverage: [], tests: [], commit: [], createPr: [], clone: [], install: [], branch: [], reset: [], discard: [] };
  const errorQueue = {};
  const persistentErrors = {};

  function takeError(name) {
    if (persistentErrors[name]) return persistentErrors[name];
    const q = errorQueue[name];
    return q && q.length ? q.shift() : null;
  }

  // ── reading the generated tests back off disk ────────────────────────────
  function walkTestFiles(dir, depth = 0, out = []) {
    if (depth > 6) return out;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
    for (const ent of entries) {
      if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) { walkTestFiles(abs, depth + 1, out); continue; }
      const rel = path.relative(repoDir, abs).split(path.sep).join('/');
      if (TEST_FILE_RE.test(rel) && /\.[cm]?[jt]sx?$/.test(rel)) out.push({ rel, abs });
    }
    return out;
  }

  function allTestFiles() {
    return walkTestFiles(repoDir).map(({ rel, abs }) => {
      let content = '';
      try { content = fs.readFileSync(abs, 'utf8'); } catch { return null; }
      return {
        path: rel,
        content,
        target: content.match(/^\s*\/\/\s*TARGET:\s*(\S+)/m)?.[1] || null,
        kills: [...content.matchAll(/^\s*\/\/\s*KILLS:\s*(\d+)/gm)].map((m) => Number(m[1])),
        red: /^\s*\/\/\s*SUITE:\s*RED\s*$/m.test(content),
      };
    }).filter(Boolean);
  }

  const testsTargeting = (file) => allTestFiles().filter((t) => t.target === file);

  /** Which mutants are dead, following the declared kill rules transitively. */
  function deadMutants(spec, targeting) {
    const byLine = new Map();
    for (const m of spec.mutants) {
      if (!byLine.has(m.line)) byLine.set(m.line, []);
      byLine.get(m.line).push(m);
    }
    const dead = new Set();
    const seen = new Set();
    const queue = [];
    for (const t of targeting) for (const l of t.kills) queue.push(l);
    while (queue.length) {
      const line = queue.shift();
      if (seen.has(line)) continue;
      seen.add(line);
      for (const m of byLine.get(line) || []) {
        if (m.equivalent || dead.has(m)) continue;   // an equivalent mutant never dies
        dead.add(m);
        for (const c of m.collateral) queue.push(c);
      }
    }
    return dead;
  }

  /** One survivor as Stryker's parsed report would carry it (fresh object). */
  function survivorView(m, spec) {
    const srcLines = spec.source.split('\n');
    const from = Math.max(0, m.line - 6);
    const to = Math.min(srcLines.length, (m.endLine || m.line) + 5);
    return {
      id: `${spec.path}#${m.line}#${m.mutator}`,
      mutator: m.mutator,
      line: m.line,
      column: m.column,
      endLine: m.endLine,
      replacement: String(m.replacement).slice(0, 200),
      status: m.status,
      file: spec.path,
      context: srcLines.slice(from, to).map((l, i) => `${from + i + 1}: ${l}`).join('\n'),
    };
  }

  // ── stryker ──────────────────────────────────────────────────────────────
  async function runStryker(file, stOpts = {}) {
    calls.stryker.push({ file, range: stOpts.range || null });
    const err = takeError('stryker');
    if (err) throw err;
    const spec = universe.get(file);
    if (!spec) throw new Error(`fake stryker: ${file} is not in the mutation universe — world.addFile() it first`);
    if (world._noTests > 0) {
      world._noTests -= 1;
      S.event('stryker', `${file}: no tests executed — mutation score 0 (nothing kills mutants yet)`);
      return { file, totalMutants: null, killed: 0, score: 0, survived: [], noTests: true };
    }
    const targeting = testsTargeting(file);
    if (!targeting.length) {
      // exactly what runStryker returns for "No tests were executed"
      S.event('stryker', `${file}: no tests executed — mutation score 0 (nothing kills mutants yet)`);
      return { file, totalMutants: null, killed: 0, score: 0, survived: [], noTests: true };
    }
    const dead = deadMutants(spec, targeting);
    let pool = spec.mutants;
    if (stOpts.range) pool = pool.filter((m) => m.line >= stOpts.range.from && m.line <= stOpts.range.to);
    const isDead = (m) => m.killedAtBaseline || m.timeout || dead.has(m);
    const killed = pool.filter(isDead).length;
    const timedOut = pool.filter((m) => m.timeout).length;
    const score = pool.length ? round2((killed / pool.length) * 100) : 100;
    const survivors = pool.filter((m) => !isDead(m))
      // covered survivors first, then by line — the real sort
      .sort((a, b) => (a.status === 'survived' ? 0 : 1) - (b.status === 'survived' ? 0 : 1) || (a.line || 0) - (b.line || 0))
      .map((m) => survivorView(m, spec));
    const out = {
      file,
      totalMutants: pool.length,
      killed,
      timedOut,
      score,
      survivedTotal: survivors.length,
      survivedAll: survivors.map((m) => ({
        mutator: m.mutator, line: m.line, column: m.column, replacement: String(m.replacement ?? '').slice(0, 60),
        status: m.status,
      })),
      survived: survivors.slice(0, 100),
    };
    // Stryker's own report, as far as the sidecar reads it: which test file killed
    // what. Without this the fake cannot express "this file earned nothing", which is
    // the fact the round-end prune acts on.
    {
      const files = allTestFiles();
      const idOf = new Map(files.map((t, i) => [t.path, String(i)]));
      out.report = {
        testFiles: Object.fromEntries(files.map((t) => [t.path, { tests: [{ id: idOf.get(t.path), name: t.path }] }])),
        files: { [file]: { mutants: pool.map((m) => {
          const killer = files.find((t) => t.target === file && (t.kills || []).includes(m.line));
          return {
            id: String(m.line) + ':' + (m.column ?? 0),
            mutatorName: m.mutator,
            status: isDead(m) ? 'Killed' : 'Survived',
            ...(killer ? { killedBy: [idOf.get(killer.path)] } : {}),
            location: { start: { line: m.line, column: m.column ?? 0 } },
          };
        }) } },
      };
    }
    if (stOpts.range) {
      out.partial = true;
      out.range = stOpts.range;
      S.event('stryker', `${file}:${stOpts.range.from}-${stOpts.range.to} (kill check): `
        + `${out.totalMutants} mutant(s) in range, ${killed} killed, ${out.survived.length} still alive`);
    } else {
      S.event('stryker', `${file}: ${out.totalMutants} mutants, ${killed} killed, ${out.survivedTotal} survived+nocov, score ${score}%`);
    }
    return out;
  }

  // ── coverage ─────────────────────────────────────────────────────────────
  async function runCoverage() {
    calls.coverage.push({});
    const err = takeError('coverage');
    if (err) throw err;
    // The coverage pass RUNS THE SUITE — that is why /api/verify uses it as both
    // the green/red signal and the measurement. A fake that always reports exit 0
    // would let a caller believe a red suite was green.
    const red = !!world.suiteRed || allTestFiles().some((t) => t.red);
    const files = {};
    for (const spec of universe.values()) {
      files[spec.path] = testsTargeting(spec.path).length ? spec.coverageWithTests : spec.coverageWithout;
    }
    const vals = Object.values(files);
    const totalPct = world.totalCoverage != null ? world.totalCoverage
      : (vals.length ? round2(vals.reduce((a, b) => a + b, 0) / vals.length) : 0);
    // the real runCoverage merges into the files table before returning, and
    // /api/verify reads state.files[file].coverage right after calling it
    for (const [rel, pct] of Object.entries(files)) if (S.state.files[rel]) S.upsertFile(rel, { coverage: pct });
    for (const rel of Object.keys(S.state.files)) {
      if (files[rel] === undefined && S.state.files[rel].coverage == null) S.upsertFile(rel, { coverage: 0 });
    }
    S.event('coverage', `total line coverage ${totalPct}% (suite exit ${red ? 1 : 0})`);
    return {
      totalPct, files, exitCode: red ? 1 : 0,
      summary: red ? 'FAIL  1 failed | 2 passed (fake runner)' : 'ok  3 passed (fake runner)',
    };
  }

  function uncoveredLines(rel) {
    const spec = universe.get(rel);
    if (!spec) return { lines: [], note: 'no coverage-final.json' };
    if (!testsTargeting(rel).length) return { lines: 'all', note: 'file never loaded by tests — 0% coverage' };
    return { lines: spec.uncovered.slice(0, 200), functions: [], branches: [] };
  }

  // ── test suite ───────────────────────────────────────────────────────────
  async function runTests(scopePath) {
    calls.tests.push(scopePath || null);
    const err = takeError('tests');
    if (err) throw err;
    const red = !!world.suiteRed || allTestFiles().some((t) => t.red);
    S.event('tests', `${scopePath || 'full suite'}: ${red ? 'RED (exit 1)' : 'green'}`);
    return {
      passed: !red,
      exitCode: red ? 1 : 0,
      summary: red ? 'FAIL  1 failed | 2 passed (fake runner)' : 'ok  3 passed (fake runner)',
    };
  }

  // ── git-touching parts of repo ───────────────────────────────────────────
  const realWrite = repo.writeTestFile;
  const realDelete = repo.deleteTestFile;

  function rmGenerated(rels) {
    for (const rel of rels) {
      try { fs.unlinkSync(path.join(repoDir, rel)); } catch { }
    }
  }

  const repoFakes = {
    // writing/deleting stay REAL (path validation and disk state are the point);
    // they only additionally feed the fake git index
    writeTestFile(rel, content) {
      const r = realWrite(rel, content);
      git.uncommitted.add(r.path);          // new OR modified — both are working-tree changes
      return r;
    },
    deleteTestFile(rel) {
      const ok = realDelete(rel);
      if (ok) git.uncommitted.delete(rel);
      return ok;
    },
    async clone() {
      calls.clone.push({});
      const err = takeError('clone');
      if (err) throw err;
      fs.mkdirSync(repoDir, { recursive: true });
      return { dir: repoDir, head: 'facefeed1234567890abcdef0123456789abcdef' };
    },
    async install() {
      calls.install.push({});
      const err = takeError('install');
      if (err) throw err;
      const det = { pm: 'npm', testRunner: 'vitest', hasStrykerConfig: false, testScript: 'vitest run' };
      S.state.runner = det;
      S.event('installing', `deps ready (pm=${det.pm}, runner=${det.testRunner}, strykerConfig=${det.hasStrykerConfig})`);
      return det;
    },
    async listScopeFiles() {
      const paths = [...universe.keys()];
      for (const p of paths) S.upsertFile(p, {});
      return paths;
    },
    async createBranch(name) {
      calls.branch.push(name);
      // `git checkout -B <name> <base>` from a clean base: nothing generated survives
      rmGenerated([...git.uncommitted, ...git.committed]);
      git.uncommitted.clear();
      git.committed.clear();
      git.branch = name;
      S.event('branching', 'working on branch ' + name);
      return name;
    },
    async discardUncommitted() {
      calls.discard.push(git.branch);
      rmGenerated([...git.uncommitted]);
      git.uncommitted.clear();
    },
    async resetToBase() {
      calls.reset.push(git.branch);
      rmGenerated([...git.uncommitted, ...git.committed]);
      git.uncommitted.clear();
      git.committed.clear();
      git.branch = S.state.run?.config?.repoBranch || 'main';
    },
  };

  // ── pr / gh ──────────────────────────────────────────────────────────────
  const isCommittableTest = (p) => TEST_FILE_RE.test(p) && !/(^|\/)(node_modules|coverage|reports|\.stryker-tmp)\//.test(p);

  async function changedFiles() {
    return [...git.uncommitted].filter((p) => fs.existsSync(path.join(repoDir, p)));
  }
  async function changedTestFiles() {
    return [...new Set([...git.committed, ...git.uncommitted])].filter(isCommittableTest);
  }
  async function diffAgainstBase() {
    const paths = await changedTestFiles();
    const chunks = [];
    for (const p of paths) {
      let body = '';
      try { body = fs.readFileSync(path.join(repoDir, p), 'utf8'); } catch { continue; }
      const lines = body.split('\n');
      chunks.push([
        `diff --git a/${p} b/${p}`,
        'new file mode 100644',
        '--- /dev/null',
        `+++ b/${p}`,
        `@@ -0,0 +1,${lines.length} @@`,
        ...lines.map((l) => '+' + l),
      ].join('\n'));
    }
    return chunks.join('\n');
  }
  async function commit(message) {
    calls.commit.push(message);
    const err = takeError('commit');
    if (err) throw err;
    const testish = [...git.uncommitted].filter(isCommittableTest);
    if (!testish.length) {
      // rounds already committed on this branch are fine for PR creation
      if (git.committed.size > 0) return { sha: 'sha-' + git.commits.length };
      throw new Error('no changed test files to commit');
    }
    for (const p of testish) { git.committed.add(p); git.uncommitted.delete(p); }
    git.commits.push({ message, paths: testish });
    return { sha: 'sha-' + git.commits.length };
  }
  async function createPr({ file, branch, title, body, labels = [] }) {
    calls.createPr.push({ file, branch, title, body, labels });
    const err = takeError('createPr');
    if (err) throw err;
    const cfg = S.state.run.config;
    const record = {
      file, branch, title, body, labels,
      mode: cfg.prMode, createdAt: Date.now(),
      url: cfg.prMode === 'github' && !cfg.dryRun ? `https://github.com/fake/repo/pull/${S.state.prs.length + 1}` : null,
      patchPath: cfg.prMode === 'github' && !cfg.dryRun ? null : path.join(sb.dataDir, 'prs', branch.replace(/[^a-zA-Z0-9._-]+/g, '-') + '.patch'),
    };
    S.state.prs.push(record);
    S.event('preparing_pr', record.url ? 'PR created: ' + record.url : 'PR prepared locally: ' + record.patchPath);
    return record;
  }

  // ── llm ──────────────────────────────────────────────────────────────────
  const llm = {
    calls: [],
    queue: [],
    always: null,
    /** Queue one reply: a string, {text,json}, an Error, or a fn(opts). */
    reply(x) { llm.queue.push(x); return world; },
    replyText(t) { return llm.reply({ text: t }); },
    replyJson(obj) { return llm.reply({ text: JSON.stringify(obj), json: obj }); },
    fail(e) { return llm.reply(e instanceof Error ? e : new Error(String(e))); },
    /** Persistent handler used whenever the queue is empty. */
    onCall(fn) { llm.always = fn; return world; },
  };
  const restoreChat = setChatImpl(async (o) => {
    llm.calls.push(o);
    let r = llm.queue.length ? llm.queue.shift() : (llm.always ? llm.always(o) : undefined);
    if (r === undefined || r === null) {
      throw new Error('fake LLM: no scripted reply for this call — queue one with world.llm.replyJson()/replyText(). '
        + 'System prompt began: ' + String(o.system || '').slice(0, 80));
    }
    if (typeof r === 'function') r = r(o);
    r = await r;
    if (r instanceof Error) throw r;
    if (typeof r === 'string') r = { text: r };
    const text = r.text ?? '';
    if (!o.json) return { text };
    return { text, json: r.json !== undefined ? r.json : util.extractJson(text) };
  });

  // ── swap everything in ───────────────────────────────────────────────────
  const saved = [];
  const swap = (mod, name, fn) => { saved.push([mod, name, mod[name]]); mod[name] = fn; };
  swap(stryker, 'runStryker', runStryker);
  swap(coverage, 'runCoverage', runCoverage);
  swap(coverage, 'uncoveredLines', uncoveredLines);
  swap(tests, 'runTests', runTests);
  for (const [name, fn] of Object.entries(repoFakes)) swap(repo, name, fn);
  swap(pr, 'commit', commit);
  swap(pr, 'createPr', createPr);
  swap(pr, 'changedFiles', changedFiles);
  swap(pr, 'changedTestFiles', changedTestFiles);
  swap(pr, 'diffAgainstBase', diffAgainstBase);

  const world = {
    sb, repoDir, universe, git, calls, llm,
    suiteRed: false,
    totalCoverage: null,

    /**
     * Add one file to the mutation universe, write its source into the sandbox
     * repo, and register it in state.files (so call this AFTER run/start).
     * @param {object} spec {path, source?, sourceLines?, mutants:[], coverageWithTests?, coverageWithout?, uncovered?, existingTest?}
     */
    addFile(spec) {
      const f = normFile(spec);
      universe.set(f.path, f);
      const abs = path.join(repoDir, f.path);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, f.source);
      if (spec.existingTest) {
        // a test the repo already ships — NOT generated, so git never tracks it
        const t = typeof spec.existingTest === 'string'
          ? { path: spec.existingTest, content: world.testSource({ target: f.path, kills: spec.existingTestKills || [] }) }
          : spec.existingTest;
        const tabs = path.join(repoDir, t.path);
        fs.mkdirSync(path.dirname(tabs), { recursive: true });
        fs.writeFileSync(tabs, t.content);
      }
      if (S.state.run) S.upsertFile(f.path, {});
      return f;
    },

    /** Content for a generated test file, in the marker DSL. */
    testSource({ target, kills = [], red = false, cases = 2, note = '' }) {
      const lines = [
        '// generated by the fake test world',
        `// TARGET: ${target}`,
        ...kills.map((l) => `// KILLS: ${l}`),
        ...(red ? ['// SUITE: RED'] : []),
        ...(note ? ['// ' + note] : []),
        `import { v2 } from '${path.relative(path.dirname(target), target).replace(/\.[cm]?[jt]sx?$/, '') || './x'}';`,
        "import { describe, it, expect } from 'vitest';",
        '',
        `describe('${target}', () => {`,
      ];
      for (let i = 1; i <= cases; i++) {
        lines.push(`  it('case ${i}: pins behaviour around ${kills[i - 1] ?? 'the module'}', () => {`);
        lines.push(`    expect(v2(${i})).toBe(v2(${i}));`);
        lines.push('  });');
      }
      lines.push('});', '');
      return lines.join('\n');
    },

    /** Write a generated test straight to disk, as the route would. */
    writeTest(rel, spec) {
      return repo.writeTestFile(rel, typeof spec === 'string' ? spec : world.testSource(spec));
    },

    exists(rel) { return fs.existsSync(path.join(repoDir, rel)); },
    read(rel) { try { return fs.readFileSync(path.join(repoDir, rel), 'utf8'); } catch { return null; } },
    testFiles: allTestFiles,
    testsTargeting,

    /** Make the next call to `name` throw. name: stryker|coverage|tests|commit|createPr|clone|install */
    /**
     * Make the next N mutation runs answer the way Stryker does when its related-test
     * filter matched nothing: { totalMutants: null, killed: 0, score: 0, survived: [],
     * noTests: true }. An empty survivor list from a run that never happened reads as
     * "every mutant died" unless the caller checks — which is exactly what happened
     * on lib/admin-page-data.ts (112 phantom kills).
     */
    noTestsNext(n = 1) { world._noTests = (world._noTests || 0) + n; return world; },

    failNext(name, error) {
      (errorQueue[name] ||= []).push(error instanceof Error ? error : new Error(String(error)));
      return world;
    },
    failAlways(name, error) {
      persistentErrors[name] = error instanceof Error ? error : new Error(String(error));
      return world;
    },
    stopFailing(name) { delete persistentErrors[name]; delete errorQueue[name]; return world; },

    restore() {
      for (const [mod, name, fn] of saved.reverse()) mod[name] = fn;
      saved.length = 0;
      restoreChat();
    },
  };

  sb.onCleanup(() => world.restore());
  return world;
}

module.exports = { installFakes };
