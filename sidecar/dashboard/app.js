'use strict';
// Live dashboard: polls api/metrics (relative path — works at / and behind /dashboard/).

const STAGE_LABELS = {
  idle: 'Idle', starting: 'Starting run', cloning: 'Cloning repository',
  applying_rules: 'Applying team rules', installing: 'Installing dependencies',
  measuring_baseline: 'Measuring baseline', picking_file: 'Picking a file to mutate',
  branching: 'Creating branch', improving_coverage: 'Improving coverage',
  improving_mutation: 'Improving mutation score', improving_mac: 'Improving MAC (verifying)',
  preparing_pr: 'Preparing PR', iteration_done: 'Iteration done', done: 'Done',
  failed: 'Failed', interrupted: 'Interrupted', error: 'Error',
};
const ACTIVE = ['starting', 'cloning', 'applying_rules', 'installing', 'measuring_baseline',
  'picking_file', 'branching', 'improving_coverage', 'improving_mutation', 'improving_mac', 'preparing_pr'];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (x, suf = '%') => (x == null ? '–' : (Math.round(x * 100) / 100) + suf);

async function tick() {
  let m;
  try {
    const r = await fetch('api/metrics', { cache: 'no-store' });
    m = await r.json();
  } catch { setBanner({ name: 'offline', detail: 'sidecar unreachable' }); return; }
  render(m);
}

function setBanner(stage) {
  const el = $('stage-banner');
  el.className = 'stage ' + (ACTIVE.includes(stage.name) ? 'active' : stage.name === 'failed' ? 'failed' : stage.name === 'done' ? 'done' : 'idle');
  $('stage-name').textContent = STAGE_LABELS[stage.name] || stage.name;
  $('stage-detail').textContent = stage.detail || '';
  const p = stage.progress;
  $('stage-progress').textContent = p && (Date.now() / 1000 - p.ts) < 60
    ? `${p.line}  ·  ${p.elapsed}s` : '';
}

function render(m) {
  setBanner(m.stage || { name: 'idle' });
  const cfg = m.run?.config;
  $('repo').textContent = cfg ? `${cfg.repoUrl} @ ${cfg.repoBranch} · PR mode: ${cfg.prMode} · run ${m.run.status}` : 'no run yet';

  const b = m.totals?.baseline || {}, c = m.totals?.current || {};
  $('c-cov').textContent = fmt(c.coveragePct ?? b.coveragePct);
  $('c-cov-d').textContent = b.coveragePct != null ? `baseline ${fmt(b.coveragePct)}` : '';
  $('c-mut').textContent = fmt(c.mutationPct ?? b.mutationPct);
  $('c-mut-d').textContent = b.mutationPct != null ? `baseline ${fmt(b.mutationPct)} (picked files)` : '';
  $('c-mac').textContent = fmt(m.totals?.avgMacAfter, '');
  $('c-mac-d').textContent = m.totals?.avgMacBefore != null ? `before ${fmt(m.totals.avgMacBefore, '')} (targeted files)` : '';
  $('c-iter').textContent = m.run ? m.run.iteration : '–';
  $('c-iter-d').textContent = cfg ? `of max ${cfg.maxIterations}` : '';
  $('c-prs').textContent = (m.prs || []).length;
  $('c-prs-d').textContent = `${m.totals?.improvedFiles ?? 0} file(s) improved`;

  const tb = $('files').querySelector('tbody');
  const files = (m.files || []).filter((f) => f.status !== 'candidate' || f.coverage != null).slice(0, 200);
  $('files-count').textContent = `(${(m.files || []).length} in scope)`;
  tb.innerHTML = files.map((f) => `<tr class="st-${esc(f.status)}">
    <td class="path">${esc(f.path)}</td>
    <td>${fmt(f.coverage)}</td><td>${fmt(f.mutation)}</td>
    <td>${fmt(f.macBefore, '')}</td>
    <td>${f.macAfter != null ? `<b>${fmt(f.macAfter, '')}</b>` : '–'}</td>
    <td><span class="badge b-${esc(f.status)}">${esc(f.status)}</span></td>
    <td>${f.prUrl ? `<a href="${esc(f.prUrl)}" target="_blank">PR ↗</a>` : (f.prPatch ? 'patch' : '')}</td>
  </tr>`).join('');

  $('prs').innerHTML = (m.prs || []).map((p) => `<li>
    <b>${esc(p.title)}</b> — <code>${esc(p.branch)}</code>
    ${p.url ? ` · <a href="${esc(p.url)}" target="_blank">${esc(p.url)}</a>` : ` · local patch: <code>${esc(p.patchPath || '')}</code>`}
  </li>`).join('') || '<li class="muted">none yet</li>';

  $('decisions').innerHTML = Object.entries(m.decisions || {}).map(([k, v]) => `
    <details><summary><b>${esc(k)}</b> ${v.rule ? '· rule: “' + esc(v.rule).slice(0, 90) + '”' : '· (no rule set)'}</summary>
    <pre>${esc(JSON.stringify(v.result, null, 2)).slice(0, 2000)}</pre></details>`).join('') || '<span class="muted">none yet</span>';

  $('events').innerHTML = (m.events || []).slice().reverse().map((e) => `
    <div class="ev"><span class="ts">${new Date(e.ts * 1000).toLocaleTimeString()}</span>
    <span class="badge b-stage">${esc(e.stage)}</span> ${esc(e.msg)}</div>`).join('');
}

tick();
setInterval(tick, 2000);
