'use strict';
// LLM token accounting. OpenAI-compatible endpoints report usage per response;
// vLLM does too. Kept pure and separate so it can be unit-tested and so the
// accumulator shape is defined in exactly one place.

const EMPTY = { in: 0, out: 0, calls: 0 };

/** Normalize a provider `usage` object; tolerant of missing/renamed fields. */
function parseUsage(u) {
  if (!u || typeof u !== 'object') return { in: 0, out: 0 };
  const input = u.prompt_tokens ?? u.input_tokens ?? 0;
  const output = u.completion_tokens ?? u.output_tokens ?? 0;
  const num = (x) => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? Math.round(x) : 0);
  return { in: num(input), out: num(output) };
}

/** Fold one response's usage into an accumulator (returns a new object). */
function addUsage(acc, usage) {
  const base = acc && typeof acc === 'object' ? acc : EMPTY;
  const { in: i, out: o } = parseUsage(usage);
  return {
    in: (base.in || 0) + i,
    out: (base.out || 0) + o,
    // a call with no usage payload still happened, and still cost latency
    calls: (base.calls || 0) + 1,
  };
}

/** Compact human formatting: 1234 → "1.2k", 2_500_000 → "2.5M". */
function fmtTokens(n) {
  const v = Number(n) || 0;
  if (v >= 1e6) return (Math.round(v / 1e5) / 10) + 'M';
  if (v >= 1e3) return (Math.round(v / 1e2) / 10) + 'k';
  return String(v);
}

module.exports = { parseUsage, addUsage, fmtTokens, EMPTY };
