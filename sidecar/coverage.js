'use strict';
// Coverage: run vitest/jest with istanbul json reporters, parse per-file line coverage.
const fs = require('node:fs');
const path = require('node:path');
const { run } = require('./exec');
const { state, event, upsertFile } = require('./state');
const { repoDir } = require('./repo');
const { round2 } = require('./util');

function npx(dir, args) {
  return run(['npx', '--no-install', ...args], { cwd: dir, timeoutMs: 1800000, label: args[0] });
}

async function runCoverage() {
  const dir = repoDir();
  const runner = state.runner?.testRunner;
  if (!runner) throw new Error('runner not detected — call /api/repo/prepare first');
  let r;
  if (runner === 'vitest') {
    r = await npx(dir, ['vitest', 'run', '--coverage.enabled', '--coverage.provider=v8',
      '--coverage.reporter=json-summary', '--coverage.reporter=json',
      '--coverage.reportsDirectory=coverage', '--passWithNoTests']);
  } else {
    r = await npx(dir, ['jest', '--coverage', '--coverageReporters=json-summary', '--coverageReporters=json',
      '--coverageDirectory=coverage', '--silent', '--passWithNoTests', '--ci']);
  }
  const summaryPath = path.join(dir, 'coverage', 'coverage-summary.json');
  if (!fs.existsSync(summaryPath)) {
    throw new Error(`coverage run produced no summary (exit ${r.code}): ` + (r.stderr || r.stdout).slice(-600));
  }
  const parsed = parseSummary(summaryPath, dir);
  // merge into files table (only scope files already registered keep their entries;
  // still record coverage for files in summary that are in scope table)
  for (const [rel, pct] of Object.entries(parsed.files)) {
    if (state.files[rel]) upsertFile(rel, { coverage: pct });
  }
  // scope files absent from the summary were never loaded → 0 % covered
  for (const rel of Object.keys(state.files)) {
    if (parsed.files[rel] === undefined && state.files[rel].coverage == null) {
      upsertFile(rel, { coverage: 0 });
    }
  }
  event('coverage', `total line coverage ${parsed.totalPct}% (suite exit ${r.code})`);
  return { totalPct: parsed.totalPct, files: parsed.files, exitCode: r.code };
}

function parseSummary(summaryPath, dir) {
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const files = {};
  let totalPct = summary.total?.lines?.pct ?? 0;
  if (typeof totalPct !== 'number') totalPct = 0;
  for (const [abs, data] of Object.entries(summary)) {
    if (abs === 'total') continue;
    const pct = data.lines?.pct;
    if (typeof pct !== 'number') continue;
    const rel = path.isAbsolute(abs) ? path.relative(dir, abs) : abs;
    if (rel.startsWith('..')) continue;
    files[rel.split(path.sep).join('/')] = round2(pct);
  }
  return { totalPct: round2(totalPct), files };
}

/** Uncovered line ranges for one file, from istanbul coverage-final.json. */
function uncoveredLines(rel) {
  const dir = repoDir();
  const finalPath = path.join(dir, 'coverage', 'coverage-final.json');
  let cov = {};
  try { cov = JSON.parse(fs.readFileSync(finalPath, 'utf8')); } catch { return { lines: [], note: 'no coverage-final.json' }; }
  const abs = path.join(dir, rel);
  const entry = cov[abs] || cov[rel] || Object.entries(cov).find(([k]) => k.endsWith('/' + rel))?.[1];
  if (!entry) return { lines: 'all', note: 'file never loaded by tests — 0% coverage' };
  const data = entry.data || entry; // some formats nest under .data
  const uncovered = new Set();
  const stmts = data.statementMap || {};
  const s = data.s || {};
  for (const [id, loc] of Object.entries(stmts)) {
    if ((s[id] || 0) === 0 && loc?.start?.line) {
      for (let ln = loc.start.line; ln <= Math.min(loc.end?.line || loc.start.line, loc.start.line + 3); ln++) uncovered.add(ln);
    }
  }
  const fns = data.fnMap || {}; const f = data.f || {};
  const uncoveredFns = [];
  for (const [id, fn] of Object.entries(fns)) {
    if ((f[id] || 0) === 0) uncoveredFns.push({ name: fn.name || '(anonymous)', line: fn.decl?.start?.line || fn.loc?.start?.line });
  }
  const b = data.b || {}; const branches = data.branchMap || {};
  const uncoveredBranches = [];
  for (const [id, br] of Object.entries(branches)) {
    const counts = b[id] || [];
    counts.forEach((c, i) => {
      if (c === 0) uncoveredBranches.push({ line: br.locations?.[i]?.start?.line || br.loc?.start?.line, type: br.type });
    });
  }
  return {
    lines: [...uncovered].sort((a, z) => a - z).slice(0, 200),
    functions: uncoveredFns.slice(0, 50),
    branches: uncoveredBranches.slice(0, 80),
  };
}

module.exports = { runCoverage, uncoveredLines };
