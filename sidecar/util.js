'use strict';
// Zero-dependency helpers shared by the sidecar.

/** Convert a comma-separated glob list to a matcher fn for repo-relative paths. */
function globsToMatcher(globCsv) {
  const globs = String(globCsv || '**/*')
    .split(',').map((g) => g.trim()).filter(Boolean);
  const regs = globs.map(globToRegExp);
  return (p) => regs.some((r) => r.test(p));
}

function globToRegExp(glob) {
  let re = '';
  let i = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        // '**/' or '**'
        if (glob[i + 2] === '/') { re += '(?:.*/)?'; i += 3; } else { re += '.*'; i += 2; }
      } else { re += '[^/]*'; i += 1; }
    } else if (c === '?') { re += '[^/]'; i += 1; }
    else if (c === '{') {
      const end = glob.indexOf('}', i);
      if (end === -1) { re += '\\{'; i += 1; }
      else {
        const alts = glob.slice(i + 1, end).split(',').map(escapeRe);
        re += '(?:' + alts.join('|') + ')'; i = end + 1;
      }
    } else { re += escapeRe(c); i += 1; }
  }
  return new RegExp('^' + re + '$');
}

function escapeRe(s) { return s.replace(/[.+^$()|[\]\\]/g, '\\$&'); }

function slugify(s) {
  return String(s).toLowerCase().replace(/^https?:\/\//, '').replace(/\.git$/, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function fileSlug(p) {
  return String(p).replace(/\.[jt]sx?$/, '').replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').toLowerCase().slice(0, 60);
}

function nowSec() { return Math.floor(Date.now() / 1000); }

function round2(x) { return Math.round(x * 100) / 100; }

/** MAC = coverage% × mutation% / 100, both in [0,100]. */
function mac(coveragePct, mutationPct) {
  if (coveragePct == null || mutationPct == null) return null;
  return round2((coveragePct * mutationPct) / 100);
}

/** Extract the first balanced JSON object or array from LLM output. */
function extractJson(text) {
  if (!text) return null;
  const s = String(text)
    .replace(/^[\s\S]*?<\/think>/, '') // drop thinking block if present
    .replace(/```(?:json)?/g, '');
  for (const opener of ['{', '[']) {
    const start = s.indexOf(opener);
    if (start === -1) continue;
    const closer = opener === '{' ? '}' : ']';
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < s.length; i++) {
      const c = s[i];
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === opener) depth++;
      else if (c === closer) {
        depth--;
        if (depth === 0) {
          try { return JSON.parse(s.slice(start, i + 1)); } catch { break; }
        }
      }
    }
  }
  return null;
}

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

module.exports = { globsToMatcher, globToRegExp, slugify, fileSlug, nowSec, round2, mac, extractJson, clamp };
