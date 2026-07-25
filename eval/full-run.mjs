// Full-repo improvement driver. Runs INSIDE the container, detached:
//   nohup node /data/eval/full-run.mjs > /data/full-run.log 2>&1 &
// Repeats bounded n8n executions (batches) until every in-scope file is settled
// (improved / exhausted / failed) in the persistent ledger. Batching keeps each
// n8n execution small and lets the run survive restarts.
import { readFileSync } from 'node:fs';

const N8N = 'http://127.0.0.1:5678';
const API = 'http://127.0.0.1:3000';
const BATCH_FILES = 25;
const BATCH_MAX_ITER = 0; // unlimited picks within a batch; scopeLimit bounds it
const BATCH_TIMEOUT_MS = 12 * 3600e3;

const overrides = process.argv[2] ? JSON.parse(process.argv[2]) : {};
const log = (m) => console.log(new Date().toISOString() + ' ' + m);

async function api(p) { return (await fetch(API + p)).json(); }

async function stopLingering() {
  try {
    const tok = readFileSync('/data/n8n-auth-token.txt', 'utf8').trim();
    const hdrs = { Cookie: 'n8n-auth=' + tok };
    const running = await (await fetch(`${N8N}/rest/executions?filter=${encodeURIComponent('{"status":["running"]}')}`, { headers: hdrs })).json();
    for (const ex of running?.data?.results || []) {
      log('stopping lingering execution ' + ex.id);
      await fetch(`${N8N}/rest/executions/${ex.id}/stop`, { method: 'POST', headers: hdrs });
    }
  } catch (e) { log('execution cleanup skipped: ' + e.message); }
}

function ledgerSize(state) {
  const slugs = Object.keys(state.improvedLedger || {});
  let n = 0;
  for (const s of slugs) n += Object.keys(state.improvedLedger[s]).length;
  return n;
}

for (let batch = 1; batch <= 100; batch++) {
  await stopLingering();
  const before = ledgerSize(await api('/api/state'));
  const body = { scopeLimit: BATCH_FILES, maxIterations: BATCH_MAX_ITER, ...overrides };
  log(`batch ${batch}: triggering (${JSON.stringify(body)}), ledger=${before}`);
  const trig = await fetch(`${N8N}/webhook/improve-run`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (trig.status >= 400) { log('webhook failed: ' + trig.status); process.exit(1); }

  const t0 = Date.now();
  let last = '';
  for (; ;) {
    await new Promise((r) => setTimeout(r, 30000));
    let m;
    try { m = await api('/api/metrics'); } catch { continue; }
    const line = `batch ${batch} [${Math.round((Date.now() - t0) / 60000)}m] stage=${m.stage?.name} iter=${m.run?.iteration} prs=${(m.prs || []).length}`;
    if (line !== last) { log(line); last = line; }
    if (m.run && m.run.status !== 'running') break;
    if (Date.now() - t0 > BATCH_TIMEOUT_MS) { log('batch timeout'); break; }
  }

  const st = await api('/api/state');
  const after = ledgerSize(st);
  const total = Object.keys(st.files || {}).length;
  const improved = Object.values(st.improvedLedger || {}).flatMap((r) => Object.values(r)).filter((x) => x.state === 'improved').length;
  log(`batch ${batch} done: run=${st.run?.status}, ledger ${before}→${after} of ${total} files, ${improved} improved total`);
  if (after >= total && total > 0) { log('ALL FILES SETTLED — full run complete'); break; }
  if (after === before) { log('no progress in this batch — stopping to avoid a loop'); break; }
}
log('driver exiting');
