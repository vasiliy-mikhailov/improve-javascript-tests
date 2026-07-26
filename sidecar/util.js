'use strict';
// Zero-dependency helpers shared by the sidecar.

/**
 * Split a comma-separated glob list WITHOUT breaking brace groups:
 * `src/**\/*.{js,ts},lib/*.ts` → ['src/**\/*.{js,ts}', 'lib/*.ts'].
 * (A naive split on ',' shreds `{js,ts}` into separate globs that match nothing.)
 */
function splitGlobList(globCsv) {
  const out = [];
  let cur = '', depth = 0;
  for (const ch of String(globCsv || '**/*')) {
    if (ch === '{') depth += 1;
    else if (ch === '}') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out.map((g) => g.trim()).filter(Boolean);
}

/** Convert a comma-separated glob list to a matcher fn for repo-relative paths. */
function globsToMatcher(globCsv) {
  const regs = splitGlobList(globCsv).map(globToRegExp);
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
/**
 * Find the LAST complete JSON OBJECT in a block of prose. Used to salvage an answer
 * the model wrote inside its reasoning channel and then had cut off before it could
 * repeat it as content.
 *
 * Stricter than extractJson on purpose. Reasoning text quotes the prompt, so the
 * first JSON-looking thing in it is routinely something else — in the reply that
 * prompted this function, an array of uncovered line numbers copied out of the
 * prompt. Accepting that would report a successful parse of an object the caller
 * cannot use, and skip the retry that would have produced a real answer.
 */
function extractLastJsonObject(text) {
  if (!text) return null;
  const s = String(text).replace(/```(?:json)?/g, '');
  let best = null;
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '{') continue;
    let depth = 0, inStr = false, esc = false;
    for (let j = i; j < s.length; j++) {
      const c = s[j];
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          try {
            const v = JSON.parse(s.slice(i, j + 1));
            // an empty object is not an answer, and neither is an array — the
            // reasoning quotes the prompt, so arrays in it are usually its input
            if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length) {
              best = v;
              i = j;            // skip past it: braces INSIDE it are not candidates
            }
          } catch { }
          break;
        }
      }
    }
  }
  return best;
}

function extractJson(text) {
  if (!text) return null;
  const s = String(text)
    .replace(/^[\s\S]*?<\/think>/, '') // drop thinking block if present
    .replace(/```(?:json)?/g, '');
  // try whichever bracket opens FIRST — otherwise a top-level array response
  // ("[{...}]") yields its first element instead of the array
  const openers = [['{', s.indexOf('{')], ['[', s.indexOf('[')]]
    .filter(([, i]) => i !== -1).sort((a, b) => a[1] - b[1]).map(([c]) => c);
  for (const opener of openers) {
    const start = s.indexOf(opener);
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

/**
 * Strip secrets from anything that reaches the event log, the dashboard or an
 * HTTP response. Tool output (git, npm, gh) can echo credentials we passed in.
 */
function redact(text) {
  let s = String(text ?? '');
  for (const secret of [process.env.GH_TOKEN, process.env.LLM_API_KEY]) {
    if (secret && secret.length >= 8) s = s.split(secret).join('«redacted»');
  }
  return s
    .replace(/\b(gh[pousr]_[A-Za-z0-9]{16,})/g, '«redacted-gh-token»')
    .replace(/\b(github_pat_[A-Za-z0-9_]{20,})/g, '«redacted-gh-token»')
    .replace(/\bsk-[A-Za-z0-9-]{16,}/g, '«redacted-api-key»')
    .replace(/(https?:\/\/)[^/@\s:]+:[^/@\s]+@/g, '$1«redacted»@');
}

module.exports = {
  extractLastJsonObject, globsToMatcher, globToRegExp, splitGlobList, slugify, fileSlug, nowSec, round2, mac, extractJson, clamp, redact };
