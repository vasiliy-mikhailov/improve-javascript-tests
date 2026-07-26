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

function writeConfig(mutateSpec) {
  const dir = repoDir();
  const runner = state.runner?.testRunner;
  const cfg = {
    $schema: 'https://raw.githubusercontent.com/stryker-mutator/stryker/master/packages/api/schema/stryker-core.json',
    testRunner: runner,
    // explicit plugin list — auto-discovery fails under pnpm's symlinked node_modules
    plugins: [runner === 'vitest' ? '@stryker-mutator/vitest-runner' : '@stryker-mutator/jest-runner'],
    // may be a plain path or a mutation range "src/foo.ts:120-190" (Stryker 9.x).
    // A range instruments only those lines, which turns kill-verification from
    // minutes into seconds. Ranges cannot contain glob magic.
    mutate: [mutateSpec],
    reporters: ['json', 'progress'],
    coverageAnalysis: 'perTest',
    thresholds: { high: 80, low: 60, break: null },
    tempDirName: '.stryker-tmp',
    cleanTempDir: true,
    // CPU is cheap relative to model time, so run mutants wide. But raising
    // concurrency ALONE corrupts the metric: Stryker counts a timed-out mutant as
    // KILLED, so a loaded box silently inflates the mutation score. The timeout is
    // therefore scaled with the parallelism, and timeouts are reported (below) so
    // inflation is visible instead of silent.
    timeoutMS: parseInt(process.env.STRYKER_TIMEOUT_MS || '60000', 10),
    timeoutFactor: parseFloat(process.env.STRYKER_TIMEOUT_FACTOR || '2.5'),
    concurrency: parseInt(process.env.STRYKER_CONCURRENCY || '6', 10),
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

/**
 * @param {string} file  repo-relative source path
 * @param {object} [opts]
 * @param {{from:number,to:number}} [opts.range]  mutate only these lines (kill verification)
 */
async function runStryker(file, opts = {}) {
  const dir = repoDir();
  if (!state.runner?.testRunner) throw new Error('runner not detected — call /api/repo/prepare first');
  const spec = opts.range ? `${file}:${opts.range.from}-${opts.range.to}` : file;
  writeConfig(spec);
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
  if (opts.range) {
    // A range run scores ONLY those lines. It answers "did this mutant die?", never
    // "what is this file's mutation score" — callers must not write it into metrics.
    parsed.partial = true;
    parsed.range = opts.range;
    event('stryker', `${file}:${opts.range.from}-${opts.range.to} (kill check): `
      + `${parsed.totalMutants} mutant(s) in range, ${parsed.killed} killed, ${parsed.survived.length} still alive`);
  } else {
    event('stryker', `${file}: ${parsed.totalMutants} mutants, ${parsed.killed} killed, ${parsed.survived.length} survived+nocov, score ${parsed.score}%`);
  }
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
  const timedOut = valid.filter((m) => m.status === 'timeout').length;
  const score = valid.length ? round2((killed / valid.length) * 100) : 100;
  // A timeout counts as a kill in Stryker's score. On a loaded box that turns
  // machine contention into free "improvement", so make it loud when it is a
  // material share of the result rather than letting it flatter the metric.
  const timeoutShare = valid.length ? timedOut / valid.length : 0;
  if (timeoutShare > 0.1) {
    event('stryker', `WARNING: ${timedOut}/${valid.length} mutants (${round2(timeoutShare * 100)}%) counted as killed by TIMEOUT `
      + `on ${file} — the score may be inflated by machine load; consider raising STRYKER_TIMEOUT_MS or lowering STRYKER_CONCURRENCY`);
  }
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
    timedOut,
    score,
    // the array is capped for prompt/state size; the COUNT must not be, or
    // "how many died" is meaningless on files with many survivors
    survivedTotal: survivedList.length,
    // identity-only view of EVERY survivor. "Did the target die?" is answered by
    // absence from the survivor list, so answering it from the capped array below
    // reports a false kill for any mutant past the cap — exactly the weakly-tested
    // files where the cap bites.
    survivedAll: survivedList.map((m) => ({
      mutator: m.mutator, line: m.line, column: m.column, replacement: String(m.replacement ?? '').slice(0, 60),
    })),
    survived: survivedList.slice(0, 100),
  };
}

module.exports = { runStryker };
