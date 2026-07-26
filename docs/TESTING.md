# Testing

## Vocabulary

Two words, used consistently in file names, test names and here:

**UNIT TEST** — a test of *the code a node calls*. A node is not testable; the code
behind it is. That means exactly two things:

  1. the JS that lives inside an n8n **Code node** — extracted into `n8n/nodes/*.js`
     so it can be imported, and inlined verbatim into the workflow by `n8n/emit.js`;
  2. the sidecar **functions and routes** the HTTP Request nodes hit — `sidecar/*.js`,
     called through the real route table with only the OS-touching layer faked.

**E2E TEST** — a straight-through run of the whole pipeline: real n8n, real sidecar,
real git/npm/Stryker/LLM. `eval/run-eval.mjs` is the harness.

There is **no graph simulator and none is wanted.** Nothing here mocks n8n's execution
engine or replays a workflow. Where a behaviour only exists *between* nodes (n8n
resolving `$('Node').first()` across loop iterations, an HTTP Request node's URL and
body binding, retry/timeout settings), it is e2e-only by construction — see
[What only e2e covers](#what-only-e2e-covers). Say so rather than faking a graph.

---

## The layers

```
n8n/nodes/*.js        the 6 Code-node functions + the 10 IF conditions   ─┐
n8n/test/*.test.js      UNIT: pure functions, literal fixtures            │ npm run test:n8n
                                                                          ┘
sidecar/*.js          the HTTP API the workflow drives                   ─┐
sidecar/test/*.test.js  UNIT: real routes, faked OS layer                 │ npm run test:sidecar
sidecar/test/helpers/   env.js (sandbox) + fakes.js (the fake world)      ┘

eval/                 E2E: real container, real repos                      docker exec …
```

Both UNIT layers are measured together by `npm run coverage` — one report, because they
are one process. `eval/` is **not** measured: it drives a container over HTTP, so no
line of the code under test executes in the coverage process. Anything only `eval/`
exercises reads as uncovered here, and should — see
[What only e2e covers](#what-only-e2e-covers).

`n8n/` is ESM (`n8n/package.json` sets `"type": "module"`), the sidecar is CommonJS.
That split is deliberate — don't try to unify it; the root `package.json` has no
`type` field and each subtree declares its own.

---

## Running

```bash
npm test               # everything: sidecar + n8n node units
npm run test:sidecar   # sidecar/test/*.test.js only
npm run test:n8n       # n8n/test/*.test.js only
npm run coverage       # the same suite + the per-file coverage table
npm run coverage:check # the same, with the thresholds enforced (exit 1 if under)
npm run workflow       # regenerate n8n/workflows/Improve-JS-Tests.json
npm run check          # test + coverage gate + regenerate the workflow
```

One file, or one test:

```bash
node --test n8n/test/kill-nodes.test.js
node --test --test-name-pattern="exactly one test file survives" n8n/test/kill-nodes.test.js
IJST_TEST_VERBOSE=1 node --test sidecar/test/routes.test.js   # stop swallowing state.event's console.log
```

**`npm run workflow` is part of the test story.** The generator ends in a static scan
that fails the build if a Code node's inlined source mentions `child_process`,
`execSync`, `spawn`, `require('fs')`, `readFileSync` or `writeFileSync`, if any node
type is outside the native allowlist, or if a Code node calls a shared helper
(`uiGuidance`, `commonTestRules`) whose source the binding line forgot to inline.
That last check exists because `emit()` inlines by *source*: a missing `deps` entry
produces a Code node that is only broken inside n8n, at run time.

### The baseline is green

`npm test` is **all green**. Any red name is a regression — there are no tests left
deliberately failing. (There were: five `BUG …` tests pinned bugs the brief said not
to fix. They have since been fixed and their tests now assert the fixed contract. If
you pin a new bug you cannot fix, prefix the name `BUG ` and say so here, so the next
person can tell a pinned bug from a break.)

The working loop is fixed and non-negotiable:

> **write the unit test for the defect → watch it RED → fix → watch it GREEN.**

Never edit a test to make it pass. If a test encodes the old contract and your fix
deliberately changes that contract, rewrite the test to state the **new** contract,
keep its intent, and say so in the change description. Weakening an assertion until it
passes is how a suite of 200 tests ends up proving nothing.

---

## Coverage

Node 22's built-in coverage — no nyc, no c8, no dependency of any kind. Verified on
`v22.22.2`; the flags are `--experimental-test-coverage`, `--test-coverage-exclude`,
and `--test-coverage-lines` / `--test-coverage-branches` / `--test-coverage-functions`.

```bash
npm run coverage        # the table, no gate — what you read while working
npm run coverage:check  # the gate — exit 1 if any of the three totals is under
```

### What is in the denominator

Production code only: `sidecar/*.js` and `n8n/nodes/*.js`. Four exclusions, all in the
npm script:

```
**/test/**        the tests themselves and sidecar/test/helpers/{env,fakes}.js
**/dashboard/**   sidecar/dashboard/* is browser code; node --test never loads it
eval/**           the e2e harness — it runs against a container, not in this process
scripts/**        one-off operator scripts
```

Leaving the tests in flatters the number badly: counted, the line total reads **86.69 %**;
excluded, the honest figure for code that ships is **69.88 %**. The helpers are the worst
offender — `fakes.js` is ~550 lines at 96 %, and a test helper is always well covered
because running the tests *is* running the helper. Measuring it proves nothing.

### One caveat you must know

**Node reports only files that were loaded during the run.** A module no test ever
requires contributes nothing to the denominator — it does not appear as 0 %, it simply
is not there. `n8n/emit.js` and `n8n/generate-workflows.mjs` are the proof: neither is
excluded, neither is loaded by the unit suite, and neither appears in the table.

So the gate cannot catch "someone added `sidecar/newthing.js` and no test at all". It
catches "someone added code to a module that *is* under test and left it uncovered".
When you add a sidecar module, add at least one test that requires it, or its risk is
invisible here.

### Measured today

A snapshot, not a contract — `npm run coverage` reprints it in seconds, and that
output wins over this table whenever they disagree. Sorted worst-last on purpose: the
bottom of the table is the reading list.

| file | line % | branch % | funcs % |
| --- | ---: | ---: | ---: |
| `n8n/nodes/common-test-rules.js` | 100.00 | 100.00 | 100.00 |
| `n8n/nodes/conditions.js` | 100.00 | 83.33 | 100.00 |
| `n8n/nodes/cov-build-prompt.js` | 100.00 | 90.00 | 100.00 |
| `n8n/nodes/cov-build-repair.js` | 100.00 | 87.50 | 100.00 |
| `n8n/nodes/cov-parse-repair.js` | 100.00 | 94.44 | 100.00 |
| `n8n/nodes/cov-parse-tests.js` | 100.00 | 100.00 | 100.00 |
| `n8n/nodes/kill-build-prompt.js` | 100.00 | 95.83 | 100.00 |
| `n8n/nodes/kill-parse-test.js` | 100.00 | 100.00 | 100.00 |
| `n8n/nodes/ui-guidance.js` | 100.00 | 100.00 | 100.00 |
| `sidecar/timesheet.js` | 100.00 | 100.00 | 100.00 |
| `sidecar/tokens.js` | 100.00 | 100.00 | 100.00 |
| `sidecar/mutants.js` | 100.00 | 76.47 | 100.00 |
| `sidecar/util.js` | 99.19 | 88.71 | 94.44 |
| `sidecar/state.js` | 90.82 | 60.98 | 71.43 |
| `sidecar/llm.js` | 85.04 | **40.74** | 62.50 |
| `sidecar/server.js` | 78.60 | 70.83 | 62.90 |
| `sidecar/repo.js` | 58.48 | 59.76 | 73.33 |
| `sidecar/tests.js` | 29.63 | 100.00 | 0.00 |
| `sidecar/exec.js` | 23.33 | 100.00 | 0.00 |
| `sidecar/pr.js` | 17.36 | 100.00 | 0.00 |
| `sidecar/rules.js` | 17.33 | 37.50 | 22.22 |
| `sidecar/coverage.js` | 14.85 | 100.00 | 0.00 |
| `sidecar/stryker.js` | 13.13 | 100.00 | 0.00 |
| **all files** | **69.88** | **75.39** | **71.09** |

Two ways to be misled by that table:

- **A `100.00` branch % on a barely-run file means nothing.** `coverage.js`, `pr.js`,
  `stryker.js`, `exec.js` and `tests.js` all report perfect branches at 13-30 % lines —
  because no branch was ever *reached*, so none was ever half-taken. Read the branch
  column only for files whose line % is already high.
- **A high line % can hide the part that matters.** `llm.js` reads 85 % lines and
  **41 % branches**: the happy path is well covered and every failure path — the
  429/5xx retry ladder, the JSON-mode fallback, the network-abort retry — is not. The
  branch column is the one that found that.

Both blind spots are exactly the argument for the mutation testing this repo automates:
line coverage says the line ran, not that anything would have noticed it changing.

### The thresholds, and why they are low

```
--test-coverage-lines=67  --test-coverage-branches=72  --test-coverage-functions=68
```

Set a few points **below** what is measured, deliberately. A gate that goes red on a
fresh clone is a gate everyone learns to ignore, and then it protects nothing. These
three numbers are a **ratchet**: they may be raised when the real figure rises, and the
only legitimate reason to lower one is deleting tests on purpose.

Node's thresholds are **totals across the whole run**, not per file — it has no
per-file gate. So a well-covered new module can mask a badly-covered one. The per-file
table above, not the aggregate, is what to look at in review.

Raising the bar: run `npm run coverage`, take the three totals, subtract ~2, edit the
three flags in `package.json`. Nothing else knows about them.

---

## Layer 1 — the Code nodes (`n8n/test/`)

These functions are pure: `(fixture) → object`. No HTTP, no LLM, no n8n. A fixture is
a literal of the shape the graph feeds the node — the `/api/files/gaps` response, the
`/api/llm/chat` response, the previous Code node's output — copied from the real
route, never invented.

```js
import { covParseTests } from '../nodes/cov-parse-tests.js';

const llm = (tests, over = {}) => ({ ok: true, json: { tests }, ...over });

test('unsafe paths are rewritten to the planned target', () => {
  const r = covParseTests(llm([{ path: 'src/cart.ts', content: 'x'.repeat(40) }]), plan());
  assert.deepEqual(r.paths, ['test/cart.mac-cov.test.ts']);
});
```

The IF conditions are expression *strings* — n8n evaluates them, our code cannot. So
`n8n/test/conditions.test.js` carries a ~15-line strict evaluator that resolves only
`$json` and `$('Node').first().json` from a fixture and **throws** on anything else
(an unsupplied node, any other `$…` form, an unknown identifier). A tolerant
evaluator would turn an unresolvable reference into `undefined`, i.e. into a silently
false branch, and would happily "validate" a condition that can never be true.

Assert on the **branch**, not the number: `branchOf(name, fixture)` runs expression →
`COMPARISONS` → output index (`0` = true, `1` = false). A separate test pins those
indexes to the nodes the generator actually wires, and another deep-equals every IF
node in the committed workflow JSON against `condition(name)` so an expression can
never drift between the generator and the tests.

### Adding a case

1. Pick the node function in `n8n/nodes/`. If the input shape is new, build it with
   the file's existing fixture factory (`gaps()`, `llm()` and `plan()` in
   `cov-nodes.test.js`, `target()` in `kill-nodes.test.js`) rather than a fresh
   literal — the factories carry the real field set.
2. Name the test after the *behaviour*, in the user's vocabulary: "a path containing
   `..` is rejected however it is dressed up", not "test parse 3".
3. If it is a bug you are pinning rather than fixing, prefix `BUG …` and leave it red,
   with a comment saying why the production fix was not applied.
4. If it documents a hazard that is *current, intended* behaviour, keep it green and
   add a `REPORTED, NOT FIXED` comment so a later fix flips a named test.

---

## Layer 2 — the sidecar routes (`sidecar/test/`)

The route table is **real**. Only the layer that needs a machine is faked: Stryker,
the coverage run, the test suite, the LLM, git and `gh`. `repo.writeTestFile` and
`repo.deleteTestFile` stay real, because path validation, disk state and "is the test
still there?" are the assertions that matter.

Every bug this pipeline has shipped was a **state** bug that the HTTP response hid, so
assert on `state.files` / the ledgers / the disk first, and on the response second.

### Load order is a hard rule

`sidecar/state.js` captures `DATA_DIR` **once**, at require time. Setting
`process.env.DATA_DIR` after it loads does nothing — the test would quietly operate on
the production `/data`. So:

```js
const { withSandbox, S } = require('./helpers/env');    // FIRST, always
const { installFakes } = require('./helpers/fakes');
```

and take every sidecar module from `env`'s exports rather than requiring it directly.
`env.js` throws if a sidecar module was already loaded. It also installs permanent
dispatchers on `exec.run` and `llm.chat` *before* those modules load, because several
modules destructure their dependencies at require time — swapping `llm.chat` later
could never reach `rules.js`. Nothing can spawn: the default `exec` impl throws.

### The world

```js
test('…', () => withSandbox(async (sb) => {
  const w = installFakes(sb);
  await sb.start({ maxMutantsPerFile: 5 });         // POST /api/run/start
  w.addFile({
    path: 'src/a.ts',
    existingTest: 'test/a.test.ts',
    coverageWithTests: 80,
    mutants: [{ line: 10 }, { line: 20, equivalent: true }],
  });
  const r = await sb.post('/api/mutant/verify', { file: 'src/a.ts', mutant, testPaths: [p] });
  assert.equal(sb.file('src/a.ts').mutantsKilled, 1);
  assert.ok(w.exists(p), 'a test that killed something is kept on disk');
}));
```

`sb.call('POST /api/x', body, query)` invokes a handler exactly as the HTTP layer
would; `sb.get` / `sb.post` are sugar. `sb.file(p)` is `state.files[p]`, `sb.events()`
the event log, `sb.cleanup()` runs automatically under `withSandbox`.

**The mutation universe is data, not a Stryker fixture.** Each file declares its
mutants and each mutant declares how it dies:

| declaration | meaning |
| --- | --- |
| *(default)* | dies when a generated test carries `// KILLS: <line>` for its line |
| `collateral: [lines]` | killing it also kills those lines, transitively |
| `equivalent: true` | never dies, whatever anyone writes |
| `killedAtBaseline: true` | already killed by the repo's own tests |
| `timeout: true` | counted as killed, reported in `timedOut` |

`equivalent` is the case a real Stryker fixture cannot express and the one the whole
one-shot-per-mutant design exists for. A file no test touches reproduces Stryker's
"No tests were executed" answer (`{totalMutants: null, …, noTests: true}`) — that is
what a 0-coverage file looks like at baseline.

Generated tests go through the **real** writer and carry a marker DSL the fake runners
read back off disk — `// TARGET: <path>`, `// KILLS: <line>`, `// SUITE: RED` — so
deleting a test really removes its effect on the next measurement.

Other world knobs: `w.llm.replyJson(obj)` / `replyText(s)` / `fail(err)` queue LLM
answers, `w.llm.onCall(fn)` handles them persistently, `w.llm.calls` records what was
asked; `w.failNext('stryker', err)` / `failAlways` / `stopFailing` inject infra
failures; `w.exists(rel)` / `w.read(rel)` inspect the sandbox repo. An unscripted LLM
call **throws** with the start of the system prompt in the message — that is a
feature, not a nuisance: it tells you a route consulted the model when you did not
expect it.

### Adding a case

1. Start from the closest existing helper — `started(sb)` (run + one file) or
   `killReady(sb)` (file picked, coverage measured, baseline mutation done, i.e. the
   state the mutant loop actually starts from). They mirror the workflow's node order.
2. Describe the world through `addFile` rather than by writing state by hand: state
   written by hand can be a shape the routes never produce.
3. Drive the route sequence the workflow drives. If your test needs a state the
   workflow cannot reach, that is worth a comment — it may be dead code.
4. Assert state and disk, then the response.

### Adding a case to the synthetic mutation universe

Most new cases need **no change to `fakes.js` at all** — the universe is data, so you
describe the world in the test:

```js
const w = installFakes(sb);
await sb.start({ maxMutantsPerFile: 5 });
w.addFile({
  path: 'src/pricing.ts',
  sourceLines: 80,                    // synthetic source, so line numbers are real
  existingTest: 'test/pricing.test.ts',
  existingTestKills: [10],            // what the repo's own suite already kills
  coverageWithTests: 72,              // reported once anything targets the file
  coverageWithout: 0,                 // reported while nothing does
  uncovered: [31, 32, 33],            // what /api/files/gaps hands the prompt
  mutants: [
    { line: 12, mutator: 'ArithmeticOperator', replacement: '-' },
    { line: 20, collateral: [21, 22] },      // one sharp test takes neighbours
    { line: 40, equivalent: true },          // nothing can ever kill this
    { line: 50, killedAtBaseline: true },    // the repo's tests already got it
    { line: 60, timeout: true },             // scores as a kill, shows in timedOut
    { line: 70, status: 'nocoverage' },      // sorts after covered survivors
  ],
});
```

`addFile` writes the synthetic source into the sandbox repo, registers the file in
`state.files` (so call it **after** `/api/run/start`), and — if you passed
`existingTest` — writes a repo-owned test that git never tracks, so `resetToBase`
cannot delete it.

Then make a generated test kill something, exactly as a route would:

```js
const t = w.writeTest('test/pricing.mac-kill.test.ts',
  { target: 'src/pricing.ts', kills: [20], red: false });
```

`kills` becomes `// KILLS: 20` in the file; the fake Stryker re-reads the sandbox off
disk on every call, so deleting that file genuinely un-kills the mutant on the next
measurement. `red: true` adds `// SUITE: RED` and turns `runTests` red — that is how
you exercise the delete-and-charge-the-budget paths without a broken JS parser.

Only touch `fakes.js` when you need a **new kind of fate** — a rule that cannot be
expressed by the five above. Then:

1. Add the field to `normMutant()` with an explicit default, so every existing test
   keeps its current meaning.
2. Teach `deadMutants()` (transitive kill walk) or `runStryker`'s `isDead` about it —
   whichever is the right layer. Kill *rules* live in `deadMutants`; "already dead
   regardless of tests" lives in `isDead`.
3. Add the row to the table above **and** to the header comment in `fakes.js`. Both
   are load-bearing documentation; a fate nobody can find is a fate nobody uses.
4. Prove the new fate matters: write the route test first and watch it fail for the
   right reason before the fake supports it.

The rule that keeps this honest: **the fake models Stryker's answers, never the
sidecar's logic.** If you find yourself adding a knob to `fakes.js` so that a route
behaves a certain way, the knob belongs in the test's route sequence instead.

---

## Debugging one thing against a fixture

### One node function

```bash
node --input-type=module -e "
import { killParseTest } from './n8n/nodes/kill-parse-test.js';
const resp = { ok: true, json: { tests: [{ path: 'src/pricing.ts', content: 'x'.repeat(40) }] } };
console.dir(killParseTest(resp, { targetPath: 'test/pricing.kill-L42-equalityoperator.test.ts' }), { depth: null });
"
```

```
{ tests: [ { path: 'test/pricing.kill-L42-equalityoperator.test.ts', content: 'xxxx…' } ],
  paths: [ 'test/pricing.kill-L42-equalityoperator.test.ts' ], count: 1 }
```

That is the whole loop: the node function is a plain export, so print its output for
the input you suspect. To step through it, `node --inspect-brk --test
--test-name-pattern="<name>" n8n/test/kill-nodes.test.js`.

To see what n8n will actually run for that node, read the `jsCode` of the node in
`n8n/workflows/Improve-JS-Tests.json` — `emit()` inlines the function source plus one
binding line, so the only thing that can differ between the tested function and the
shipped node is which graph value feeds which argument.

### One endpoint

Write a scratch file (anywhere outside the repo) and run it with plain `node`:

```js
// probe.js — one endpoint, one fixture
const { withSandbox } = require('/abs/path/to/sidecar/test/helpers/env');   // FIRST, always
const { installFakes } = require('/abs/path/to/sidecar/test/helpers/fakes');

withSandbox({ quiet: false }, async (sb) => {         // quiet:false keeps state.event on stdout
  const w = installFakes(sb);
  await sb.start({ maxMutantsPerFile: 5 });
  w.addFile({
    path: 'src/a.ts', existingTest: 'test/a.test.ts', coverageWithTests: 80,
    mutants: [{ line: 10 }, { line: 20, equivalent: true }],
  });
  await sb.post('/api/coverage/run', { phase: 'baseline', stage: 'measuring_baseline' });
  await sb.post('/api/iteration/start', { file: 'src/a.ts' });
  await sb.post('/api/stryker/run', { file: 'src/a.ts', phase: 'baseline', stage: 'improving_mutation' });

  const r = await sb.get('/api/mutant/next', { path: 'src/a.ts' });
  console.log('RESPONSE:', r.mutant, r.budget);
  console.log('STATE   :', sb.file('src/a.ts').lastSurvived);
  console.log('EVENTS  :\n  ' + sb.events('improving_mutation').join('\n  '));
});
```

The sandbox uses a throwaway `DATA_DIR` under the OS temp dir and deletes it on exit,
so this cannot touch a real repo or the production `/data`.

### One file's coverage

To ask "what of `repo.js` does this one test file actually reach?", narrow the report
with `--test-coverage-include` (it takes the *source* path, not the test's):

```bash
node --test --experimental-test-coverage \
  --test-coverage-include='sidecar/repo.js' \
  sidecar/test/repo-guard.test.js
#  repo.js | 27.49 | 68.97 | 48.00 | 19 21-49 51-54 56-69 72-89 91-159 …
```

The `uncovered lines` column is the working list: write the next test against a range
in it, re-run, and watch the range shrink. Do not chase the percentage — chase the
ranges you can name a *behaviour* for. A range you cannot name is usually error
handling that deserves a test, or dead code that deserves deleting; either answer is
worth more than a point of coverage.

---

## Proving a test would have caught the bug

A test that passes proves nothing about a bug that has not happened yet. Before
trusting a suite, **break the code on purpose** and check the suite goes red — one
defect at a time, always reverted, verified with `git diff` (and, for untracked files
such as `n8n/nodes/`, against a byte-for-byte copy: `git diff` cannot see them).

Eight real defects were re-introduced individually against the shipped suite. All
eight went red, each with at least one test that names the behaviour rather than the
line:

| defect re-introduced | red? | first test that caught it |
| --- | --- | --- |
| `/api/verify` stores 10 survivors, not 100 | yes | `BUG-1 REGRESSION: verify stores 100 survivors, not 10, so later rounds still have work` |
| coverage bootstrap stops staling the survivor list | yes (3) | `BUG-2 REGRESSION: mutant/next re-measures a stale survivor list instead of quitting` |
| `killedTarget` checked against the capped `survived` | yes | `BUG-3 REGRESSION: a target past the 100-survivor cap is not reported as killed` |
| `Kill: Parse Test` keeps 2 files | yes | `exactly one test file survives, even when the model returns three` |
| `Kill: Parse Test` drops its path allowlist | yes (3) | `a path the sidecar would refuse is rewritten to the planned target` |
| `Another Round?` ignores `degradedAny` | yes (2) | `Another Round? continues only on improvement with no degradation` |
| `mutant/verify` keeps a test that reddened the suite | yes | `mutant/verify deletes a test that turns the suite red, and charges the budget` |
| a failed mutant is not recorded as attempted | yes (6) | `the loop retires equivalent mutants one shot each and ends before the budget does` |

The method is what matters more than the table — if a defect does *not* turn the suite
red, that is the most valuable finding available, and the fix is to strengthen the
test, not to shrug.

---

## What only e2e covers

Honest list. None of the following has a unit test, and no unit test can be written
for most of it without the graph simulator we are not building.

**Between nodes (structurally e2e-only)**

- **How n8n resolves `$('Node').first()` across loop iterations.** `Cov: Wrote Any?`
  and `Approved?` read another node's output. On round 2+ and inside the mutant loop
  that node has run several times, and which run index n8n serves is not something
  this repo can observe. The condition tests assume the current round's data.
- **The HTTP Request nodes themselves** — 32 of them. URL, method, JSON body
  expressions, timeouts, `onError`/retry settings. The route *handlers* are tested;
  the binding from node to route is not.
- **Whether IF v1 coerces a non-number expression result before comparing.** The
  evaluator models `===`/`>` from the node's source. Irrelevant today (all 10
  expressions yield a number or `undefined`), but a condition that ever yields a
  string would behave differently in n8n.
- **`.first()` on a node that emitted zero items** — our Code nodes always return
  exactly one item, so this is unreachable today and untested.
- **Webhook trigger, the batch driver (`eval/full-run.mjs`), n8n execution limits,
  and workflow-level restart/resume.**

**Sidecar modules with no unit test** (measured line coverage in brackets — every one
of these is a module the fakes *replace*, so the number is what the routes happen to
touch on the way past, not evidence of anything)

- `stryker.js` **[13 %]** — config generation, the CLI invocation, and all of
  `parseReport`. The fake reproduces `parseReport`'s *output shape* faithfully; nothing
  reads a real `mutation-report.json`.
- `coverage.js` **[15 %]** — `parseSummary` and `uncoveredLines` against a real
  istanbul `coverage-final.json` / `coverage-summary.json`.
- `pr.js` **[17 %]** — every git/`gh` path: `changedFiles` NUL parsing, rename records,
  `isCommittableTest`, commit, push, patch mode.
- `rules.js` **[17 %]** — the whole rules engine. Its route (`/api/rules/apply`) is
  untested too, so this is uncovered end to end.
- `exec.js` **[23 %]** — spawn, the process-group kill on timeout, output truncation,
  the `LLM_API_KEY` scrub.
- `tests.js` **[30 %]** — vitest/jest argv construction and the pass/fail decision.
- `repo.js` **[58 %]** — `guessTestPath`, `findStyleReference`, `detectUi`,
  `listScopeFiles`, clone/install/branch/reset. `writeTestFile`/`deleteTestFile` *are*
  exercised for real through the route tests; the rest is git- and filesystem-shaped.

**Partly tested, with the untested half being the dangerous one**

- `llm.js` **[85 % lines, 41 % branches]** — `chat()` and its repair nudge are tested;
  `post()`'s entire error half (lines 99-112 and 119-123) is not: the JSON-mode
  fallback latch, the 429/5xx retry ladder, the network-abort retry.
- `state.js` **[91 % lines, 61 % branches]** — `load()` is wholly uncovered, and so are
  `setProgress`'s redaction and the dialog-trim branch.
- `server.js` **[79 % lines, 63 % functions]** — the HTTP layer itself (`json`,
  `readBody`, `serveStatic`, the error funnel), `metricsPayload`, and the routes listed
  below. The route *table* is heavily tested; the server *around* it is not.
- The dashboard (`sidecar/dashboard/*`), `entrypoint.sh`, `Dockerfile` — excluded from
  the denominator on purpose; they cannot run under `node --test`.

### Where the next production bug will come from

Ranked by (blast radius × how likely the input is to be malformed). This is the useful
part of the coverage report — not the percentages.

1. **`stryker.parseReport` on a real report** (`stryker.js` 96-158, 13 %). Every
   decision the pipeline makes is downstream of this function: the score, the survivor
   list, `survivedAll` (which answers "did the target die?"). It is fed JSON produced
   by a tool that changes between majors — and the code already supports two Stryker
   majors. A shape change here silently reports a false kill or a 100 % score, and the
   fakes cannot see it because they *are* the expected output.
2. **`coverage.parseSummary` / `uncoveredLines`** (`coverage.js` 47-99, 15 %). Path
   normalisation between absolute istanbul keys and repo-relative state keys, plus
   three fallback lookups (`cov[abs] || cov[rel] || endsWith('/'+rel)`). Get it wrong
   and every file reports 0 % coverage, which sends the pipeline into the bootstrap
   path for files that are already covered — an expensive, silent wrong turn.
3. **`llm.post`'s error half** (`llm.js` 99-112 and 119-123 — 41 % branches, and the
   missing branches are all of the failure ones). Three ways to fail: `jsonModeSupported`
   is a module-level latch that never resets, so one misclassified error message
   downgrades every later call for the life of the process; the
   `/response_format|guided|json_object|unrecognized|unexpected/i` test runs against
   arbitrary vendor error text, and "unexpected" is a common word in unrelated 400s;
   and the retry ladder can turn one 300 s abort into a ~15-minute stall inside a
   single n8n HTTP node, which then trips *its* timeout and fails the run.
4. **`pr.changedFiles` porcelain parsing** (`pr.js` 11-26). Hand-written parsing of
   `git status --porcelain -z` with a manual index skip for `R`/`C` records. Off by one
   and the pipeline commits a file it did not mean to, or drops a generated test out of
   the PR. It touches the user's repo, which makes it the highest-consequence parser
   here even though it is small.
5. **`/api/repo/prepare`'s ledger replay** (`server.js` 241-270). Two loops that
   rewrite `state.files` from the persisted ledger on restart. Wrong, and the pipeline
   either re-does finished work or skips files that were never finished. It is the only
   substantial *route* with no test, and it is the one that runs after every crash.
6. **`repo.install`'s package-manager matrix** (`repo.js` 91-159). pnpm/yarn/npm ×
   vitest-major-to-stryker-major pinning × legacy-peer retry. It fails loudly rather
   than silently, which is why it is not higher, but it is the single most common
   real-world failure and it has no test at all.
7. **`exec.run`'s timeout kill** (`exec.js` 13-58). `process.kill(-child.pid)` on a
   detached group. If the group kill regresses, Stryker's test-runner children are
   orphaned and keep burning CPU for the rest of the container's life — the failure
   mode is a slow machine, not an error.
8. **`server.js`'s error funnel** (1041-1065). On any thrown error during a POST it
   marks the whole run `failed`. A spurious throw from a thin route therefore kills a
   run that was fine. `readBody`'s 20 MB guard and `serveStatic`'s traversal check
   (`abs.startsWith(DASH)`) are also unexercised, and the second one is a security
   control.
9. **`state.load()`** (`state.js` 142-151, uncovered). `Object.assign(state, raw)` over
   a persisted blob with no shape check, wrapped in a bare `catch {}` that treats a
   corrupt state file as a first boot — i.e. silently discards the ledger the whole
   batch mode depends on. Paired with a debounced `save()` a fast exit can drop.
10. **`rules.js`** (17 %). Uncovered, but every path ends in an LLM call whose answer is
    already treated as untrusted, and a wrong answer degrades one PR rather than the
    run. Low blast radius, hence last — but it is 148 lines nothing has ever executed.

**Routes not directly exercised** — 18 of the 32 in the route table are; these 14 are
not:

```
GET  /api/health   /api/state   /api/metrics   /api/rules   /api/dialog   /api/events
POST /api/stage    /api/repo/clone   /api/repo/prepare   /api/rules/apply
POST /api/test/delete   /api/test/delete-many   /api/test/run   /api/llm/chat
```

Most are thin. Three are not, and deserve their own pass: `repo/prepare`'s ledger
replay (see the risk list above), `rules/apply`'s stage dispatch — an unknown stage
name falls through to `rulesMod.apply`, which throws, which the error funnel turns into
a **failed run** — and `/api/metrics`, whose `metricsPayload` is ~90 lines of
aggregation (FTE, ETA, tokens-per-file, the 250-row cap) that only the dashboard reads
and nothing asserts.

To re-derive this list after adding tests:

```bash
for r in $(grep -oE "^  '(GET|POST) /api/[a-z/-]+'" sidecar/server.js | sed "s/^  '//; s/'\$//"); do
  p=${r#* }; n=$(grep -rohF "$p" sidecar/test/*.test.js | wc -l)
  [ "$n" -eq 0 ] && echo "UNTESTED $r"
done
```

**Judgement calls no unit test can make**

- **Whether the prompts work.** Truncation limits (14000/6000 for coverage,
  12000/4000 for kill) are pinned as *characters*, which is what the code does;
  whether that is the right budget for a given model is an e2e question.
- **Whether a generated test is any good.** The fakes decide a mutant's fate from a
  `// KILLS:` marker; only a real Stryker run knows.
- **Run-level aggregates.** `run.result.mutationPct` and `baseline.mutationPct` are
  per-file scores stored in run-level fields (first file measured / last file
  verified). Whether the dashboard's "mutation %" is meant to be a repo aggregate is
  undecidable from the code; the tests pin the current values without endorsing them.
