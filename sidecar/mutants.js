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
/**
 * A quoted, length-bounded rendering. Slicing the output of JSON.stringify cuts inside
 * the quotes, so a long replacement rendered as an unterminated string and the model
 * read a broken code fragment.
 */
function quoted(text, max) {
  const raw = String(text ?? '');
  const body = raw.length > max ? raw.slice(0, max) + '…' : raw;
  return JSON.stringify(body);
}

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

/**
 * The most promising mutant still worth attempting, or null.
 * A mutant is attempted AT MOST ONCE: if a test written specifically to kill it
 * did not, a second attempt on the same target is throwing good money after bad
 * (usually it is an equivalent mutant).
 */
function pickNext(survivors, opts = {}) {
  const ranked = rank(survivors, opts);
  const viable = ranked.filter((m) => m.failedAttempts < (opts.maxAttemptsPerMutant ?? 1));
  return viable[0] || null;
}

/**
 * Ask the model to choose. The heuristic above only shortlists — it is good at
 * cheap signals (covered? clustered? tractable mutator?) and blind to the thing
 * that actually decides killability: whether the surrounding code has an
 * observable effect a test can assert. Prompt/parse live here so they are pure
 * and unit-testable; the HTTP call happens in the caller.
 */
function buildPickRequest(shortlist, { file, source = '', constraints = [], failed = [] } = {}) {
  const rows = shortlist.map((m, i) => [
    `#${i + 1} line ${m.line}${m.column ? ':' + m.column : ''} — ${m.mutator}`,
    `   code becomes: ${quoted(m.replacement, 118)}`,
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
    + 'You are ORDERING work, not deciding what survives: the candidate list comes from Stryker, and only a real '
    + 'mutation run can retire a mutant. Always pick one — if you believe several are equivalent, pick the least '
    + 'equivalent-looking of them and say so in your reason. '
    + 'Reply ONLY with JSON: {"pick": <number from the list>, "reason": "one line", "killIdea": "one line on how to kill it"}. '
    + 'Keep reason and killIdea to one short line each.';

  // Feed failures back: a mutant that survived a test written specifically to kill
  // it is usually EQUIVALENT (the mutation cannot change observable behaviour), and
  // re-picking it burns a full generation for nothing.
  const history = failed.length
    ? 'ALREADY ATTEMPTED AND FAILED — a test written specifically to kill these did NOT kill them, '
      + 'so they are probably equivalent mutants (no observable behaviour change). Do not pick them again; '
      + 'if a remaining candidate looks equivalent for the same reason, say so in your reason and pick the best of the rest:\n'
      + failed.map((f) => `  - ${f.mutator} at line ${f.line}${f.column ? ':' + f.column : ''}`
        + `${f.replacement ? ' where the code becomes ' + quoted(f.replacement, 60) : ''}`
        + ` (${f.attempts} failed attempt(s))`).join('\n')
      + '\n  A mutant at the SAME line and mutator but a DIFFERENT replacement is a different mutant '
      + 'and is fair game — Stryker emits several per position.\n\n'
    : '';

  const prompt = `FILE: ${file}\n\nSOURCE:\n${String(source).slice(0, 10000)}\n\n`
    + `SURVIVING MUTANT CANDIDATES:\n\n${rows}\n\n`
    + history
    + (constraints.length ? `Team constraints on tests:\n${constraints.map((c) => '- ' + c).join('\n')}\n\n` : '')
    + 'Pick the one single test can most reliably kill. JSON only.';

  // 2000, not 1200: with thinking disabled for decision calls the model reasons
  // inside `reason`, and a budget that truncates mid-string produces invalid JSON
  // even under constrained decoding.
  return { system, prompt, json: true, decision: true, maxTokens: 2000, temperature: 0.2 };
}

/** Validate the model's answer against the shortlist it was actually offered. */
function resolvePick(answer, shortlist) {
  if (!answer || !shortlist?.length) return null;
  // A refusal to pick is NOT a verdict on the mutants. Stryker found them; only
  // Stryker can retire them. Treat it as an unusable answer so the caller falls
  // back to the ranked candidate and the loop keeps working from measurement.
  const take = (m) => ({
    mutant: m,
    reason: String(answer.reason || '').slice(0, 300),
    killIdea: String(answer.killIdea || '').slice(0, 300),
  });
  const n = Number(answer.pick);
  // An index and a line number are the same kind of small integer, so "pick 8" out of
  // twelve candidates is ambiguous — and read as an index it silently returns the
  // mutant at line 47. When the answer says which line it means, believe that.
  const said = Number(answer.line);
  if (Number.isInteger(said)) {
    const byStatedLine = shortlist.find((m) => m.line === said);
    if (byStatedLine) return take(byStatedLine);
  }
  if (Number.isInteger(n) && n >= 1 && n <= shortlist.length) return take(shortlist[n - 1]);
  // tolerate a line number in the pick field itself
  const byLine = shortlist.find((m) => m.line === n);
  if (byLine) return take(byLine);
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


/**
 * Which test FILE killed how many mutants, from one report.
 *
 * Stryker records killedBy (test ids) per mutant and a testFiles map, so a single
 * mutation run answers both "what died" and "what killed it". That is what lets a sweep
 * write many tests, verify once, and drop the ones that earned nothing — instead of
 * paying a mutation run per test to find out.
 *
 * A file Stryker ran that killed nothing reports 0 rather than being absent, because
 * "no entry" and "earned nothing" are different facts and only the second is a reason
 * to delete a file.
 */
function killsByTestFile(report) {
  const testToFile = {};
  for (const [file, entry] of Object.entries(report?.testFiles || {})) {
    for (const t of entry?.tests || []) testToFile[String(t.id)] = file;
  }
  const out = {};
  for (const file of Object.keys(report?.testFiles || {})) out[file] = 0;
  for (const d of Object.values(report?.files || {})) {
    for (const m of d?.mutants || []) {
      // a timeout is a kill for the score, so it is a kill for attribution too
      if (!['killed', 'timeout'].includes(String(m.status || '').toLowerCase())) continue;
      for (const id of m.killedBy || []) {
        const f = testToFile[String(id)];
        if (f !== undefined) out[f] = (out[f] || 0) + 1;
      }
    }
  }
  return out;
}

/**
 * The canonical name of the test that would kill this mutant.
 *
 * Keyed on the SITE, not the mutation: `>` becoming `>=`, `<` and `==` are three
 * mutants of one condition, and one boundary test kills all three. Naming by site makes
 * that collapse explicit and — because the name is derived mechanically — lets us ask
 * "is there already a test called this?" before spending a single token.
 *
 * That question is the whole economy of a sweep. A thousand mutants at ~100 tokens each
 * is hours of generation; grouped by site and filtered against tests that already exist,
 * most of them cost nothing at all.
 */
function testNameFor(m) {
  return `kills ${m.line}:${m.column ?? 0}`;
}

/** Survivors grouped into the tests that would kill them: one entry per site. */
function groupByTestName(survivors) {
  const groups = new Map();
  for (const m of survivors) {
    const name = testNameFor(m);
    if (!groups.has(name)) groups.set(name, { name, line: m.line, column: m.column ?? 0, mutants: [] });
    groups.get(name).mutants.push(m);
  }
  // biggest sites first: one test there retires the most mutants
  return [...groups.values()].sort((a, b) => b.mutants.length - a.mutants.length || a.line - b.line);
}

/**
 * Drop the groups a test already exists for. Purely textual and deliberately so — it
 * runs before any model call, over every test we can see, and a name that is present is
 * a test that has already had its chance at that site.
 */
function unwrittenGroups(groups, existingTestSources = []) {
  const haystack = existingTestSources.join('\n');
  return groups.filter((g) => !haystack.includes(g.name));
}

/** Shortlist for the model: viable candidates, best-first, small enough to reason about. */
function shortlist(survivors, { attempts = {}, maxAttemptsPerMutant = 1, size = 12 } = {}) {
  return rank(survivors, { attempts })
    .filter((m) => m.failedAttempts < maxAttemptsPerMutant)
    .slice(0, size);
}

module.exports = {
  killsByTestFile, testNameFor, groupByTestName, unwrittenGroups,
  rank, pickNext, shortlist, buildPickRequest, resolvePick,
  mutantKey, sameMutant, verifyRange, rangeSpec, TRACTABLE, NEIGHBOUR_WINDOW,
};
