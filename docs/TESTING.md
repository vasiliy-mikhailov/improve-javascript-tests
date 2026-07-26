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

`n8n/` is ESM (`n8n/package.json` sets `"type": "module"`), the sidecar is CommonJS.
That split is deliberate — don't try to unify it; the root `package.json` has no
`type` field and each subtree declares its own.

---

## Running

```bash
npm test              # everything: sidecar + n8n node units
npm run test:sidecar  # sidecar/test/*.test.js only
npm run test:n8n      # n8n/test/*.test.js only
npm run workflow      # regenerate n8n/workflows/Improve-JS-Tests.json
npm run check         # npm test && regenerate the workflow
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

### The suite is not all green, on purpose

Five tests are **deliberately RED**. Each one pins a production bug that was found
while writing the suite and left unfixed per the brief — never change production
behaviour to make a test pass.

```
BUG Parse Tests: two files with the same path are both reported, so one is silently lost
BUG Parse Repair: a reordered reply writes one file's content over another
BUG (unfixed): two different mutants on one line share a target path
BUG (unfixed): the model can overwrite the repo's own test file
BUG (unfixed): the kill system prompt authorises a second test file it will discard
```

So the healthy baseline is **187 tests, 182 pass, 5 fail**. Any *other* failing name
is a regression. Fixing one of the five bugs should turn its test green — that is the
point of leaving them in.

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

**Sidecar modules with no unit test**

- `repo.js` — `guessTestPath`, `findStyleReference`, `detectUi`, `listScopeFiles`,
  clone/install/branch. `writeTestFile`/`deleteTestFile` *are* exercised, for real,
  through the route tests; the rest is git- and filesystem-shaped.
- `stryker.js` — config generation, the CLI invocation, `parseReport` (including the
  >10 % timeout-inflation warning: the fake models `timeout: true`, but no route reads
  `timedOut`, so nothing asserts it).
- `coverage.js` — parsing a real `coverage-final.json`.
- `llm.js` — the HTTP client, retries, thinking blocks. (`util.extractJson` *is*
  tested.)
- `pr.js`, `exec.js` — every git/`gh`/child-process path.
- `rules.js` — the rules engine. Its routes are faked-adjacent and untested.
- `state.js` persistence — save/load across a restart, ledger replay.
- The dashboard (`sidecar/dashboard/*`), `entrypoint.sh`, `Dockerfile`.

**Routes not directly exercised** (15 of 31 are): `/api/health`, `/api/state`,
`/api/metrics`, `/api/rules`, `/api/dialog`, `/api/events`, `/api/stage`,
`/api/repo/clone`, `/api/repo/prepare` (notably its `settledFromLedger` /
`measurementsRestored` replay branch), `/api/files/candidates`, `/api/rules/apply`,
`/api/test/write`, `/api/test/delete`, `/api/test/delete-many`, `/api/test/run`,
`/api/llm/chat`, `/api/admin/reset`. Most are thin, but `repo/prepare`'s ledger replay
and `rules/apply` are not, and deserve their own pass.

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
