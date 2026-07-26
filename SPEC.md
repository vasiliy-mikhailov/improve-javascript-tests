# Implementation spec

What the system actually does, as built. For *why*, see [PROBLEM.md](PROBLEM.md); for the DoD and
reward, [RESEARCH.md](RESEARCH.md); for operating it, [docs/PAPER.md](docs/PAPER.md).

## 1. Shape

One container. Two processes. A hard split between orchestration and execution:

```
┌─ ijst-n8n ─────────────────────────────────────────────────────────────┐
│                                                                        │
│  n8n :5678 — workflow "Improve JS Tests", 55 nodes                     │
│    node types: manualTrigger, webhook, httpRequest, code, if, noOp      │
│    Code nodes are pure data transforms: no child_process, no fs         │
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

**Mutant loop** — the core:

```
Next Mutant → Mutant To Kill? ─no→ Mutant Loop Done → Verify
     ▲              │yes
     │       Kill: Build Prompt → Kill: LLM → Kill: Parse Test → Kill: Write Test → Kill: Verify
     └───────────────────────────────────────────────────────────────────────────────────┘
```

`GET /api/mutant/next`
- Candidates come from **Stryker's survivor list only**. The heuristic (`sidecar/mutants.js`)
  *shortlists* 12: covered-but-surviving first (they need a sharper assertion, not a new path),
  then survivor density in the same region, then mutator tractability, minus already-attempted.
- The **model chooses** from that shortlist and returns a reason and a kill idea. It is ordering
  work, not judging which findings count — it cannot retire a mutant, and an unusable answer falls
  back to the ranked candidate rather than stopping the loop.
- Stops when: no un-attempted survivors remain, the **failure budget** is spent
  (`MAX_MUTANTS_PER_FILE` — *failures only*, kills are free), or a 6× hard ceiling trips.

`Kill: Build Prompt` → one mutant, its source context, the kill idea, the repo's test conventions,
UI guidance when the file is a component. One test file, named for its victim
(`foo.kill-L42-equalityoperator.test.ts`).

`POST /api/mutant/verify`
1. The full suite must be green; if not, the test is deleted.
2. **Re-run mutation over the whole file.** This yields the fresh survivor list, the current score,
   and the answer to "did the target die".
3. **Keep the test if anything died** — the target or collateral. One test routinely takes
   neighbours with it, and that is real improvement.
4. Mark the mutant attempted **either way**. A mutant that resisted a test written specifically for
   it is not attempted again.

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
| A kill counts only when a mutation run says the mutant died | `mutant/verify` |
| A mutant is retired only by evidence — never by model opinion | `mutants.resolvePick` |
| A range run's score may never be used as the file's score | `stryker.runStryker` (`partial`) |
| Timeouts are counted and flagged; Stryker scores a timeout as a kill, so load can inflate the metric | `stryker.parseReport` |
| Cleanup is reverted if it costs mutation score | `test/cleanup` |
| Secrets redacted from events, stage text, progress lines and API errors | `util.redact` |

**Effort — these only bound cost and are tuned freely:**
`SCOPE_LIMIT`, `MAX_ITERATIONS`, `MAX_ROUNDS_PER_FILE`, `MAX_ATTEMPTS_PER_FILE`,
`MAX_MUTANTS_PER_FILE` (failures only), shortlist size, prompt/token budgets,
`STRYKER_CONCURRENCY`.

## 5. Model calls

| Call | Mode | Why |
|---|---|---|
| decisions — mutant pick, all six rule stages | JSON mode, **thinking off** | small structured answers that must parse; the model reasons inside the `reason` field |
| generation — test writing, repair, cleanup | thinking on, free-form + repair | the thinking channel is what keeps chain-of-thought out of committed tests |

The two cannot be combined on this backend: with both enabled the reasoning channel consumes the
completion budget and `content` returns empty. Every exchange is recorded — prompt, response,
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

`npm test` — unit tests for the pure logic: glob matching (including the brace-aware split that a
naive comma-split broke), slugs, MAC, JSON extraction, secret redaction, timesheet estimation,
token accounting, mutant ranking and identity across runs.
