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
 * Ask the model to choose. The heuristic above only shortlists — it is good at
 * cheap signals (covered? clustered? tractable mutator?) and blind to the thing
 * that actually decides killability: whether the surrounding code has an
 * observable effect a test can assert. Prompt/parse live here so they are pure
 * and unit-testable; the HTTP call happens in the caller.
 */
function buildPickRequest(shortlist, { file, source = '', constraints = [] } = {}) {
  const rows = shortlist.map((m, i) => [
    `#${i + 1} line ${m.line}${m.column ? ':' + m.column : ''} — ${m.mutator}`,
    `   code becomes: ${JSON.stringify(String(m.replacement ?? '')).slice(0, 120)}`,
    `   ${m.status === 'survived' ? 'ALREADY EXECUTED by tests (needs a sharper assertion)' : 'NOT COVERED (a test must reach it first)'}`,
    m.context ? '   context:\n' + m.context.split('\n').map((l) => '     ' + l).join('\n') : '',
  ].filter(Boolean).join('\n')).join('\n\n');

  const system = 'You choose which surviving Stryker mutant an automated pipeline should attack next. '
    + 'It will write ONE test for your choice, then re-run mutation to check the mutant died. '
    + 'Choose the mutant most likely to be KILLED by a single, honest test — i.e. the mutation changes '
    + 'behaviour a test can observe through the public API (a returned value, a thrown error, a rendered '
    + 'output, a callback argument). Avoid mutants whose effect is unobservable (logging, defensive '
    + 'branches that cannot be triggered, equivalent mutants that do not change behaviour at all). '
    + 'Prefer one that also puts neighbouring survivors under test. '
    + 'Reply ONLY with JSON: {"pick": <number from the list>, "reason": "one line", "killIdea": "one line on how to kill it"}.';

  const prompt = `FILE: ${file}\n\nSOURCE:\n${String(source).slice(0, 10000)}\n\n`
    + `SURVIVING MUTANT CANDIDATES:\n\n${rows}\n\n`
    + (constraints.length ? `Team constraints on tests:\n${constraints.map((c) => '- ' + c).join('\n')}\n\n` : '')
    + 'Pick the one single test can most reliably kill. JSON only.';

  return { system, prompt, json: true, maxTokens: 1200, temperature: 0.2 };
}

/** Validate the model's answer against the shortlist it was actually offered. */
function resolvePick(answer, shortlist) {
  if (!answer || !shortlist?.length) return null;
  const n = Number(answer.pick);
  if (Number.isInteger(n) && n >= 1 && n <= shortlist.length) {
    return { mutant: shortlist[n - 1], reason: String(answer.reason || '').slice(0, 300), killIdea: String(answer.killIdea || '').slice(0, 300) };
  }
  // tolerate a line number instead of an index
  const byLine = shortlist.find((m) => m.line === n);
  if (byLine) return { mutant: byLine, reason: String(answer.reason || '').slice(0, 300), killIdea: String(answer.killIdea || '').slice(0, 300) };
  return null;
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

/** Shortlist for the model: viable candidates, best-first, small enough to reason about. */
function shortlist(survivors, { attempts = {}, maxAttemptsPerMutant = 2, size = 12 } = {}) {
  return rank(survivors, { attempts })
    .filter((m) => m.failedAttempts < maxAttemptsPerMutant)
    .slice(0, size);
}

module.exports = {
  rank, pickNext, shortlist, buildPickRequest, resolvePick,
  mutantKey, sameMutant, verifyRange, rangeSpec, TRACTABLE, NEIGHBOUR_WINDOW,
};
