// @ts-nocheck
// One-time backfill: compute human-equivalent timesheets for ledger entries
// created before the timesheet feature. Runs in the app image with /data mounted,
// while the sidecar is stopped. Usage: node backfill-timesheets.mjs <baseBranch>
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const BASE = process.argv[2] || 'next';
const state = JSON.parse(readFileSync('/data/state.json', 'utf8'));
const RATES = { aBase: 30, aPerLines: 20, aCap: 90, perCase: 12, perMutant: 10, vBase: 15, perRound: 5 };

let patched = 0;
for (const [slug, entries] of Object.entries(state.improvedLedger || {})) {
  const dir = `/data/repos/${slug}`;
  if (!existsSync(dir)) continue;
  for (const [file, rec] of Object.entries(entries)) {
    if (rec.state !== 'improved' || rec.metrics?.timesheet || !rec.branch) continue;
    try {
      const diff = execSync(`git diff ${BASE}..${rec.branch} -- ':!node_modules'`, { cwd: dir, encoding: 'utf8', maxBuffer: 20e6 });
      const testCases = (diff.match(/^\+[^+].*\b(?:it|test)\s*\(/gm) || []).length;
      const addedTestLines = (diff.match(/^\+[^+]/gm) || []).length;
      let sourceLines = 0;
      try { sourceLines = execSync(`git show ${BASE}:${file}`, { cwd: dir, encoding: 'utf8', maxBuffer: 5e6 }).split('\n').length; } catch { }
      const m = rec.metrics || {};
      const mutantsKilled = (m.mutationAfter != null && m.mutationBefore != null)
        ? Math.max(1, Math.round((m.mutationAfter - m.mutationBefore) / 10)) : Math.ceil(testCases / 2);
      const analysisMin = Math.min(RATES.aCap, RATES.aBase + sourceLines / RATES.aPerLines);
      const testsMin = testCases * RATES.perCase;
      const mutationMin = mutantsKilled * RATES.perMutant;
      const verifyMin = RATES.vBase + RATES.perRound;
      const totalMin = Math.round(analysisMin + testsMin + mutationMin + verifyMin);
      rec.metrics = { ...m, timesheet: {
        analysisMin: Math.round(analysisMin), testsMin, mutationMin, verifyMin, totalMin,
        hours: Math.round(totalMin / 60 * 100) / 100,
        inputs: { sourceLines, testCases, addedTestLines, mutantsKilled, rounds: 1 },
        backfilled: true,
      } };
      patched += 1;
      console.log(`backfilled ${file}: ${rec.metrics.timesheet.hours} h (${testCases} test cases)`);
    } catch (e) { console.log(`skip ${file}: ${e.message.split('\n')[0]}`); }
  }
}
writeFileSync('/data/state.json', JSON.stringify(state));
console.log('patched', patched, 'entries');
