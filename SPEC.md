# Implementation spec

What the system actually does, as built. For *why*, see [PROBLEM.md](PROBLEM.md); for the DoD and
reward, [RESEARCH.md](RESEARCH.md); for operating it, [docs/PAPER.md](docs/PAPER.md).

## 1. Shape

One container. Two processes. A hard split between orchestration and execution:

```
┌─ ijst-n8n ─────────────────────────────────────────────────────────────┐
│                                                                        │
│  n8n :5678 — workflow "Improve JS Tests", 62 nodes                     │
│    node types: manualTrigger, webhook, httpRequest, code, if, noOp      │
│    Code-node logic lives in n8n/nodes/*.js, inlined by SOURCE at build   │
│    time — one copy, unit-testable; no child_process, no fs in a node     │
│         │                                                              │
│         │  every OS-touching operation is an HTTP call                 │
│         ▼                                                              │
│  sidecar :3000 — Node 22, zero npm dependencies                        │
│    git · npm/pnpm/yarn · vitest/jest · Stryker · gh · LLM              │
│    state.json + events.jsonl + dialog.jsonl on the /data volume        │
│    dashboard (static, no build step)                                   │
└────────────────────────────────────────────────────────────────────────┘
```

The generator (`n8n/generate-workflows.mjs`) enforces the split at build time: it fails if a node
type is outside the whitelist or if a Code node mentions `child_process`/`fs`.

## 2. The run

### 2.1 Bootstrap (once per run)

| Step | Endpoint | What happens |
|---|---|---|
| Start Run | `POST /api/run/start` | merge per-run overrides over `.env`; reject a concurrent run (409) unless `force` or the previous run is stale/interrupted |
| Clone Repo | `POST /api/repo/clone` | clone or fetch+reset; strip credentials from any pre-existing remote (auth comes from the `gh` credential helper) |
| Rules: post-clone | `POST /api/rules/apply` | model turns the team rule + AGENTS.md/README into a constraint list used by later prompts |
| Install & Detect | `POST /api/repo/prepare` | detect package manager and runner; install deps; add missing tooling (coverage provider, Stryker core + runner plugin, **Stryker major matched to the vitest major**); run `SETUP_SCRIPT`; enumerate scope files; replay the ledgers |
| Baseline Coverage | `POST /api/coverage/run` | full suite with istanbul JSON reporters; per-file line coverage |
| Rules: pre-pick / write-test | `POST /api/rules/apply` | branch-name template; test-writing constraints |

### 2.2 File loop

```
Next Iteration → Get Candidates → More Work? ─no→ Finish Run
                                      │yes
                              Rules: pick file → File Picked? ─no→ Pick Retryable? ─┬yes→ Next Iteration
                                      │yes                                          └no → Finish Run
                              Start Iteration → Baseline Mutation → Coverage Gaps → …
```

- **Get Candidates** — files with status `candidate`, fewer than `MAX_ATTEMPTS_PER_FILE` attempts,
  not already settled in the ledger; ordered by lowest MAC. Ledger-replayed files do not consume
  the batch's `SCOPE_LIMIT` quota.
- **Rules: pick file** — the model picks under the team rule. If the rule excludes everything the
  answer is terminal; if the answer is merely unusable it retries (capped), because a blind
  mechanical pick could violate a rule such as "don't touch ui".
- **Start Iteration** — create `tests/improve-{file}` from the base branch, reset the per-file
  counters, start the machine-time stopwatch, and fold the pre-first-pick time into the per-repo
  overhead ledger.
- **Baseline Mutation** — `POST /api/stryker/run` with `phase: baseline`. A Stryker crash here is
  soft: the file is marked `failed` and the loop moves on rather than the run dying.

### 2.3 Per-file improvement

**Coverage bootstrap — only when the file has no coverage at all** (`needsBootstrap`: coverage 0,
or istanbul never loaded the file). Mutation testing has nothing to work with until something
imports the module. The model writes at most 2 test files; if the suite goes red there is one
repair attempt, then the files are deleted. Once any coverage exists this phase is skipped
entirely — killing mutants raises coverage as a side effect.

**Mutant loop** — the core. Two attempts per mutant at most, and the first one is cheap:

```
Next Mutant → Mutant To Kill? ─no→ Mutant Loop Done → Verify
     ▲              │yes
     │       Kill: Build Prompt (thinking OFF) → LLM → Parse → Write → Kill: Verify (phase 'single')
     └────────────────────────────────────────────────────────────────────────→ Next Mutant
```

Measured on a prompt taken from the pipeline's own dialog log: the model answers in 21-28s
without reasoning and 112-186s with it, and on everything that could be checked mechanically the
cheap answer was no worse. A reasoning retry used to follow a failed attempt; it was removed after
attribution showed it taking 25.3% of a five-hour run's wall clock for about 8% of the kills, and
after one of its 15-minute calls collided with the n8n node timeout and ended a 496-file run five
files in. One attempt per mutant, and on to the next.

`GET /api/mutant/next`
- **Re-measures first if the list is stale.** After the coverage bootstrap the stored survivors are
  the baseline ones — on a 0-coverage file that list is empty, because Stryker had no tests to run.
  An empty list is not evidence that nothing is killable, so the endpoint re-runs mutation before
  concluding the file is done.
- Candidates come from **Stryker's survivor list only**. The heuristic (`sidecar/mutants.js`)
  *shortlists* 12: covered-but-surviving first (they need a sharper assertion, not a new path),
  then survivor density in the same region, then mutator tractability, minus already-attempted.
- The **model chooses** from that shortlist and returns a reason and a kill idea. It is ordering
  work, not judging which findings count — it cannot retire a mutant, and an unusable answer falls
  back to the ranked candidate rather than stopping the loop.
- Stops when: no un-attempted survivors remain, the **failure budget** is spent
  (`MAX_MUTANTS_PER_FILE` — *failures only*, kills are free), a 6× hard ceiling trips, or the
  model has failed to produce a usable test `budget × 3` times (a broken endpoint, not a verdict
  on the file). A mutant we could not write a test for three times running is parked so one
  pathological target cannot pin the loop.

`Kill: Build Prompt` → one mutant, its source context, the kill idea, the repo's test conventions,
UI guidance when the file is a component. One test file whose name carries the whole mutant
identity — mutator, line, column and a hash of the replacement
(`foo.kill-L42-equalityoperator-1fgc2lh.test.ts`). Line and mutator alone are not an identity:
Stryker emits several mutants in one place, and a shared name made round two overwrite the test
that killed round one's mutant, then delete it when round two failed.

`POST /api/mutant/verify`
1. The new test must pass — checked **scoped to the file just written**, not against the whole
   suite. Measured on the live repo: 1s against 52-59s, on every one of up to fifteen attempts per
   file. The whole-suite question is still asked once per round by `/api/verify`, and a round whose
   full suite is red is dropped entirely, so nothing unverified reaches a PR.
2. **Re-run mutation over the whole file.** This yields the fresh survivor list, the current score,
   and the answer to "did the target die". That last question is answered against the *full*
   survivor list (`survivedAll`), not the 100-entry array kept for prompts — a mutant past the cap
   would otherwise be scored as killed without dying.
3. **Keep the test if anything died** — the target or collateral. One test routinely takes
   neighbours with it, and that is real improvement.
4. **Retire the target unless it died.** One shot per mutant, whatever else the test achieved —
   `mutantAttempts[key]` is keyed on `killedTarget`, so a test that killed only neighbours still
   uses up its target's attempt. The **failure budget** is charged separately, on `worthKeeping`,
   so a test that achieved something never costs budget.
5. **A shot is spent by evidence, not by accident.** A test was written and the mutant survived it
   — that is evidence. These are not, and none of them retires the target or charges the budget:
   the model returned nothing; the generated test failed against the *unmutated* code; the
   verification run crashed; the verification run executed no tests at all. Each is counted as a
   generation miss with its own ceiling, and the unverified test is deleted either way.
   A `phase: 'batch'` failure is likewise not a verdict on any single mutant — the sweep writes
   one test per SITE, so the single-target attempt is still worth making. Every other phase is
   that mutant's verdict, because nothing follows it.

   "No tests were executed" deserves its own line, because it once read as a triumph: Stryker's
   reply carries `survived: []` with no totals, and the kill check is absence from the survivor
   list, so a run that measured nothing scored a single test as **112 kills**.

### 2.4 Verify, rounds, PR

```
Verify → Another Round? ─yes→ Accept Round (commit) → back to Coverage Gaps
             │no
        Drop Last Round → Rules: check changes → Approved? ─yes→ Cleanup Tests → Rules: make PR → Create PR
                                                     │no → Discard Changes
                                                              └──────────────→ Iteration Done → Next Iteration
```

- **Verify** — full suite (must be green), full coverage, Stryker on the file. Computes
  `improvedAny` (≥1 of coverage/mutation/MAC rose against the round baseline), `degradedAny` (any
  fell), and cumulative `improved` (MAC above the file's original baseline, with real file changes
  — the guard against Stryker flakiness).
- **Another Round?** — continue iff `improvedAny && !degradedAny && rounds < MAX_ROUNDS_PER_FILE`.
  Accepted rounds are committed individually, so a later bad round can be dropped alone.
- **Cleanup Tests** — strips leaked scratch commentary and vacuous tests, then re-runs the suite
  and re-measures; any regression reverts the cleanup. Selection is against the base branch, since
  accepted rounds are already committed.
- **Create PR** — commit test files only (never reports, configs, `node_modules`), `--no-verify`
  so repo hooks cannot abort a run, push, `gh pr create` (or a patch artifact in `local` mode),
  then record the file in the ledger and reset the tree.

## 3. State

Four per-repo ledgers survive `run/start`, so batched runs and restarts never redo settled work:

| Ledger | Holds | Why |
|---|---|---|
| `improvedLedger` | final disposition per file (`improved` / `exhausted` / `failed`) + PR + metrics + timesheet + tokens | skip settled files; keep their numbers |
| `measureLedger` | baseline coverage/mutation/MAC and the best any attempt reached — for **every** file measured | a file that was not improved is still a file we measured |
| `overheadLedger` | clone/install/baseline seconds per repo | so the FTE ratio counts run overhead, not just per-file work |
| `tokenLedger` | cumulative input/output tokens and call count | cost accounting across batches |

Transient per-file state: `lastSurvived` (Stryker's current survivors), `mutantAttempts` (by
position-stable key, since Stryker ids are not stable), `mutantFailures`, `mutantsKilled`,
`rounds`, `roundBase`, `spentSec`, `tokens`.

## 4. Guardrails

**Correctness — these decide whether a PR means anything:**

| Guardrail | Where |
|---|---|
| The suite must be green before anything is kept | `mutant/verify`, `verify` |
| MAC must strictly improve, with real changed files, before a PR | `verify`, `rules.applyCheckChanges` |
| Only test files may be written, deleted or committed (path allowlist) | `repo.writeTestFile`, `pr.commit` |
| A test the repo already owned is never overwritten or deleted — we only ever ADD | `repo.isRepoOwnedTest`, snapshotted at `listScopeFiles` |
| The loop verifies what the sidecar WROTE, not what the model asked for | `Kill: Verify` binding |
| Our own generated tests are never used as the style reference the model imitates | `repo.findStyleReference` |
| A kill counts only when a mutation run says the mutant died, checked against the untruncated survivor list | `mutant/verify` |
| A mutant is retired only by evidence — never by model opinion | `mutants.resolvePick` |
| Timeouts are counted and flagged; Stryker scores a timeout as a kill, so load can inflate the metric | `stryker.parseReport` |
| Cleanup is reverted if it costs mutation score | `test/cleanup` |
| Secrets redacted from events, stage text, progress lines and API errors | `util.redact` |

**Effort — these only bound cost and are tuned freely:**
`SCOPE_LIMIT`, `MAX_ITERATIONS`, `MAX_ROUNDS_PER_FILE`, `MAX_ATTEMPTS_PER_FILE`,
`MAX_MUTANTS_PER_FILE` (failures only), shortlist size, prompt/token budgets.

`STRYKER_CONCURRENCY` is the exception that looks like an effort knob but is not: Stryker scores a
timed-out mutant as killed, so raising it on a loaded box inflates the metric. Move it only together
with `STRYKER_TIMEOUT_MS`, and watch the timeout warning.

Range (partial) mutation runs were removed when kill verification became a whole-file re-run: the
`opts.range` branch in `stryker.runStryker` and `mutants.verifyRange`/`rangeSpec` are now unreachable.

## 5. Model calls

| Call | Mode | Why |
|---|---|---|
| decisions — mutant pick, plus the five rule stages that consult the model (`write_test` is assembled mechanically, and each rule stage short-circuits to a default when the team set no rule text) | JSON mode, **thinking off** | small structured answers that must parse; the model reasons inside the `reason` field |
| generation — test writing, repair, cleanup | thinking on, free-form + repair | the thinking channel is what keeps chain-of-thought out of committed tests |

The two cannot be combined on this backend: with both enabled the reasoning channel consumes the
completion budget and `content` returns empty. If the endpoint ever rejects `response_format`,
`jsonModeSupported` flips and decision calls degrade to free-form *with* thinking on. Every exchange is recorded — prompt, response,
duration, stage, file — to `/data/dialog.jsonl` and streamed into the dashboard activity feed.

## 6. Batch driver

`eval/full-run.mjs` runs whole repos as chained n8n executions: 25 new files per batch, `force` on
start (it owns execution lifecycle), stopping when nothing remains or two consecutive batches pick
nothing. Per-repo ledger counts; ships in the image and is refreshed into `/data` on boot so it can
never lag the deployed code.

## 7. Access

Caddy terminates TLS and enforces basic auth. n8n's own login never appears: at boot the container
creates the owner, logs in once with a 10-year JWT duration, stores the cookie, and `deploy.sh`
injects it into the Caddy site block. `/dashboard/*` proxies to the sidecar.

## 8. Tests

Three layers, and the middle one is the newest:

| layer | what it asks | cost |
|---|---|---|
| **unit** (`npm test`) | does our code do what we meant? Fakes for everything OS-touching. | 311 tests, ~0.3s, offline |
| **prompt** (`npm run test:prompts`) | does the MODEL do what our prompt asks? Real endpoint, mechanical verdicts, N samples with a threshold. | 7 tests, ~4 min, real tokens |
| **e2e** | a straight-through run against a real repository. | hours |

A prompt test is unit-sized in scope — one prompt, one criterion — and nothing like a unit test in
character: non-hermetic and probabilistic. A kill-prompt case is judged the way Stryker judges,
running the generated test against the original module and the mutated one. They skip themselves
when the endpoint is not configured, so a clean checkout stays offline.

Coverage of our own code: `npm run coverage` (79.6% lines / 79.9% branches / 80.2% functions);
`npm run coverage:check` gates just under that so it can only ratchet up. The floor is
`exec.js`/`stryker.js`/`coverage.js`/`pr.js` — the OS boundary, which the harness replaces
wholesale and only e2e exercises for real. **Mutation score of our own code is not measured.**

### Layer detail

`npm test` — unit tests for the pure logic: glob matching (including the brace-aware split that a
naive comma-split broke), slugs, MAC, JSON extraction, secret redaction, timesheet estimation,
token accounting, mutant ranking and identity across runs.
