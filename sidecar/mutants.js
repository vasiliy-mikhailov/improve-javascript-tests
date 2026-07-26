'use strict';
// Choosing WHICH surviving mutant to attack next, and how to verify the kill cheaply.
//
// The loop is: pick one mutant → ask for one test → re-run mutation → keep the test only if
// that mutant actually died. So "promising" means: most likely to die from one well-aimed
// test, and most likely to take neighbours with it.
//
// Ranking signals, in order of weight:
//   covered vs no-coverage  a 'survived' mutant is already executed by some test, so it only
//                           needs a sharper assertion. A 'nocoverage' mutant needs a test that
//                           reaches it at all — strictly more work, and the coverage bootstrap
//                           is the better tool for that.
//   neighbour density       survivors clustered in the same few lines tend to fall together:
//                           one test that exercises the region can kill several at once.
//   mutator tractability    flipping `>=` to `>` is easy to pin down with a boundary case;
//                           emptying a string literal deep in an error path is not.
//   attempt history         a mutant we already failed to kill twice is a tar pit; deprioritise.

const TRACTABLE = {
  EqualityOperator: 10, ConditionalExpression: 9, RelationalOperator: 9, LogicalOperator: 8,
  ArithmeticOperator: 8, BooleanLiteral: 7, UpdateOperator: 7, AssignmentOperator: 6,
  ArrayDeclaration: 5, OptionalChaining: 5, MethodExpression: 4, ObjectLiteral: 3,
  StringLiteral: 2, Regex: 2, BlockStatement: 1,
};
const NEIGHBOUR_WINDOW = 8;   // lines either side counted as "the same region"
const DEFAULT_PAD = 12;       // lines either side re-mutated when verifying a kill

/** Stable identity across Stryker runs — mutant ids are NOT stable, positions are. */
function mutantKey(m) {
  return [m.mutator, m.line, m.column ?? '', String(m.replacement ?? '').slice(0, 60)].join('|');
}

function sameMutant(a, b) {
  if (!a || !b) return false;
  return a.mutator === b.mutator && a.line === b.line
    && (a.column == null || b.column == null || a.column === b.column)
    && String(a.replacement ?? '').slice(0, 60) === String(b.replacement ?? '').slice(0, 60);
}

/**
 * Score and sort surviving mutants, most promising first.
 * @param {Array} survivors  mutants with {mutator, line, column, status, replacement}
 * @param {object} opts
 * @param {object} opts.attempts  { [mutantKey]: numberOfFailedAttempts }
 */
function rank(survivors, { attempts = {} } = {}) {
  const list = Array.isArray(survivors) ? survivors.filter((m) => m && m.line != null) : [];
  const scored = list.map((m) => {
    const covered = m.status === 'survived';           // vs 'nocoverage'
    const neighbours = list.filter((o) => o !== m && Math.abs((o.line || 0) - m.line) <= NEIGHBOUR_WINDOW).length;
    const tract = TRACTABLE[m.mutator] ?? 4;
    const failed = attempts[mutantKey(m)] || 0;
    const score = (covered ? 100 : 0)
      + Math.min(neighbours, 10) * 4
      + tract
      - failed * 60;                                    // two failures ≈ off the table
    return {
      ...m,
      score,
      neighbours,
      failedAttempts: failed,
      why: `${covered ? 'covered by tests (needs a sharper assertion)' : 'not covered (needs a new test path)'}`
        + `, ${neighbours} survivor(s) within ${NEIGHBOUR_WINDOW} lines, ${m.mutator} tractability ${tract}`
        + (failed ? `, ${failed} failed attempt(s)` : ''),
    };
  });
  return scored.sort((a, b) => b.score - a.score || (a.line || 0) - (b.line || 0));
}

/** The most promising mutant that is still worth attempting, or null. */
function pickNext(survivors, opts = {}) {
  const ranked = rank(survivors, opts);
  const viable = ranked.filter((m) => m.failedAttempts < (opts.maxAttemptsPerMutant ?? 2));
  return viable[0] || null;
}

/**
 * Line range to re-mutate when verifying a kill. Narrow ranges make verification seconds
 * instead of minutes — Stryker accepts "file.ts:120-190" (mutation range, 9.x).
 */
function verifyRange(mutant, { pad = DEFAULT_PAD, fileLines = null } = {}) {
  const start = Math.max(1, (mutant.line || 1) - pad);
  const endBase = mutant.endLine || mutant.line || 1;
  const end = fileLines ? Math.min(fileLines, endBase + pad) : endBase + pad;
  return { from: start, to: Math.max(start, end) };
}

/** Stryker mutate-spec for a range: "src/foo.ts:120-190". Ranges cannot contain globs. */
function rangeSpec(file, range) {
  return `${file}:${range.from}-${range.to}`;
}

module.exports = { rank, pickNext, mutantKey, sameMutant, verifyRange, rangeSpec, TRACTABLE, NEIGHBOUR_WINDOW };
