'use strict';
// Stryker: generate a per-run config, run mutation testing on one file, parse mutation.json.
const fs = require('node:fs');
const path = require('node:path');
const { run } = require('./exec');
const { state, event } = require('./state');
const { repoDir, readFileSafe } = require('./repo');
const { round2 } = require('./util');

const CFG_NAME = '.ijst-stryker.config.json';
const REPORT = path.join('reports', 'mutation', 'mutation.json');

function writeConfig(mutateFile) {
  const dir = repoDir();
  const runner = state.runner?.testRunner;
  const cfg = {
    $schema: 'https://raw.githubusercontent.com/stryker-mutator/stryker/master/packages/api/schema/stryker-core.json',
    testRunner: runner,
    // explicit plugin list — auto-discovery fails under pnpm's symlinked node_modules
    plugins: [runner === 'vitest' ? '@stryker-mutator/vitest-runner' : '@stryker-mutator/jest-runner'],
    mutate: [mutateFile],
    reporters: ['json', 'progress'],
    coverageAnalysis: 'perTest',
    thresholds: { high: 80, low: 60, break: null },
    tempDirName: '.stryker-tmp',
    cleanTempDir: true,
    timeoutMS: 20000,
    concurrency: 2,
    jsonReporter: { fileName: REPORT },
  };
  if (runner === 'vitest') {
    // related:false (stryker>=9 only) → run whole suite; otherwise files without
    // any test crash stryker. Stryker 8 has no such option (runs whole suite anyway).
    let major = 9;
    try {
      major = parseInt(JSON.parse(fs.readFileSync(path.join(dir, 'node_modules', '@stryker-mutator', 'core', 'package.json'), 'utf8')).version.split('.')[0], 10);
    } catch { }
    // related:true → only tests importing the mutated file run; unrelated broken
    // suite parts (git-dependent tests, strict fixtures) can't sink the mutation run.
    // Files with no related tests are handled upstream (score 0, noTests flag).
    cfg.vitest = major >= 9 ? { related: true } : {};
  } else if (runner === 'jest') {
    cfg.jest = { enableFindRelatedTests: true };
  }
  // TS repos: stryker may fail on type errors introduced by mutants unless checkers off (default off).
  fs.writeFileSync(path.join(dir, CFG_NAME), JSON.stringify(cfg, null, 2));
}

async function runStryker(file) {
  const dir = repoDir();
  if (!state.runner?.testRunner) throw new Error('runner not detected — call /api/repo/prepare first');
  writeConfig(file);
  const reportAbs = path.join(dir, REPORT);
  try { fs.unlinkSync(reportAbs); } catch { }
  const r = await run(['npx', '--no-install', 'stryker', 'run', CFG_NAME],
    { cwd: dir, timeoutMs: 2400000, label: 'stryker' });
  if (!fs.existsSync(reportAbs)) {
    const out = r.stderr + r.stdout;
    if (/No tests were executed/i.test(out)) {
      // file (or repo) has no tests at all → mutation score is by definition 0
      event('stryker', `${file}: no tests executed — mutation score 0 (nothing kills mutants yet)`);
      return { file, totalMutants: null, killed: 0, score: 0, survived: [], noTests: true };
    }
    throw new Error(`stryker produced no report (exit ${r.code}): ` + out.slice(-800));
  }
  const parsed = parseReport(reportAbs, file);
  event('stryker', `${file}: ${parsed.totalMutants} mutants, ${parsed.killed} killed, ${parsed.survived.length} survived+nocov, score ${parsed.score}%`);
  return parsed;
}

function parseReport(reportAbs, file) {
  const report = JSON.parse(fs.readFileSync(reportAbs, 'utf8'));
  const mutants = [];
  for (const [f, d] of Object.entries(report.files || {})) {
    for (const m of d.mutants || []) {
      mutants.push({
        id: m.id,
        mutator: m.mutatorName,
        line: m.location?.start?.line,
        column: m.location?.start?.column,
        endLine: m.location?.end?.line,
        replacement: (m.replacement || '').slice(0, 200),
        status: String(m.status || '').toLowerCase(),
        file: f,
      });
    }
  }
  // Mutation score (stryker definition): killed+timeout / (all - ignored - compileError)
  const valid = mutants.filter((m) => !['ignored', 'compileerror'].includes(m.status));
  const killed = valid.filter((m) => ['killed', 'timeout'].includes(m.status)).length;
  const score = valid.length ? round2((killed / valid.length) * 100) : 100;
  const survivedList = valid.filter((m) => ['survived', 'nocoverage'].includes(m.status))
    // covered-but-surviving mutants first: they only need sharper assertions,
    // while no-coverage mutants need brand-new tests (coverage phase's job)
    .sort((a, b) => (a.status === 'survived' ? 0 : 1) - (b.status === 'survived' ? 0 : 1) || (a.line || 0) - (b.line || 0));
  // attach short source context for each survived mutant (for LLM prompts)
  const src = readFileSafe(file, 500000);
  const lines = src ? src.split('\n') : [];
  for (const m of survivedList) {
    if (m.line && lines.length) {
      const from = Math.max(0, m.line - 6);
      const to = Math.min(lines.length, (m.endLine || m.line) + 5);
      m.context = lines.slice(from, to).map((l, i) => `${from + i + 1}: ${l}`).join('\n');
    }
  }
  return {
    file,
    totalMutants: valid.length,
    killed,
    score,
    survived: survivedList.slice(0, 100),
  };
}

module.exports = { runStryker };
