# Research: improve-javascript-tests — an adaptable n8n pipeline that raises test quality of any JS/TS repo

## 1. Problem

Teams own JavaScript/TypeScript repositories with tests of uneven quality. Line coverage alone
overstates quality: a covered line whose mutants survive is weakly tested. The composite metric

> **MAC (Mutation-Adjusted Coverage) = line-coverage% × mutation-score% / 100** (Stryker)

captures both. Teams need a **turn-key, adaptable pipeline** they can point at their repo and get
back **pull requests that measurably improve tests**, with **live visibility** into what the
pipeline is doing and **team-specific rules** applied at every stage.

Concretely, a team must be able to:

1. **Specify a JS/TS repo** (URL + branch) via configuration only — no code changes.
2. **Run one Docker deliverable** (image + compose) that contains the whole pipeline: n8n
   orchestrator, execution sidecar, dashboard.
3. **Get improved tests per file**: improved coverage, improved mutation score (Stryker), and
   improved MAC = coverage × mutation-score. A picked file goes through **repeated improvement
   rounds**: a round is kept only if at least one of the three metrics improves and none degrades;
   rounds stop when **all three stale or one or more degrades** (that round's changes are dropped;
   kept rounds accumulate as commits), bounded by `MAX_ROUNDS_PER_FILE`.
4. **Get a PR per improved file** — only where an improvement actually happened.
5. **See what is happening right now**: is the pipeline picking a file, improving coverage,
   improving mutation score, improving MAC, or preparing a PR.
6. **Apply team rules at every stage** of the process:
   - `post_clone` — how to act after downloading the repo (e.g. read AGENTS.md);
   - `pre_pick` — how to act before picking a file (e.g. make a separate branch, naming scheme);
   - `pick_file` — how to pick the file (e.g. "don't touch UI");
   - `write_test` — constraints on generated tests (e.g. "don't use introspection");
   - `check_changes` — how to decide whether changes are good;
   - `make_pr` — how the PR must look (style, labels, title conventions).
7. **Adapt the workflow** in the n8n editor. Therefore the workflow uses **only n8n-native
   blocks** — no Execute Command, no shell, no Python embedded in nodes. Anything that touches
   the OS (git, npm, vitest/jest, Stryker, GitHub) is behind a plain HTTP API (sidecar) that the
   native **HTTP Request** node calls.

### Deployment constraints (this instance)

- Host: `mikhailov.tech` (ssh alias `mh`), folder `~/improve-javascript-tests`.
- LLM: `https://inference.mikhailov.tech/qwen-3.6-27b-fp8/v1` (OpenAI-compatible vLLM).
- n8n UI: `https://improve-javascript-tests.mikhailov.tech`,
  dashboard: `https://improve-javascript-tests.mikhailov.tech/dashboard`.
- Access protected by **Caddy** (basic auth). **No n8n login screen**: a 10-year n8n auth JWT
  (`N8N_USER_MANAGEMENT_JWT_DURATION_HOURS=87600`) is minted once and injected by Caddy via
  `header_up Cookie`.

## 2. Definition of Done (DoD)

Each item scores 0 (absent), 0.5 (partial), or 1 (fully met). `DoD_score` = mean of D1–D12.
(D11–D12 added after iteration 2: implementation-quality criteria for the generated tests themselves.)

| # | Item | Verification |
|---|------|--------------|
| **D1** | **One-command Docker deliverable**: `docker compose up -d` brings up n8n + sidecar + dashboard in one container; state survives restarts via volume. | Fresh `compose up` on the server; `/api/health` OK; n8n UI reachable; restart keeps state. |
| **D2** | **Repo is configuration**: team sets `REPO_URL`/`REPO_BRANCH` (+ scope globs) in `.env`; no source edits needed to target a different repo. | Point at ≥2 different repos with env change only. |
| **D3** | **Metrics measured per file and overall**: line coverage %, Stryker mutation score %, MAC = coverage × mutation. Baseline and after values stored and visible. | Dashboard/API shows per-file + total before/after values matching raw vitest/jest + Stryker reports. |
| **D4** | **Tests actually improve**: pipeline-generated tests raise coverage and/or mutation score so that per-file MAC strictly increases; suite stays green. | Eval runs show ΔMAC > 0 on improved files; test run passes after changes. |
| **D5** | **PR per improved file, only on improvement**: separate branch + commit + PR for each file whose MAC improved; no PR when no improvement. Real `gh` PR on owned repos; prepared-PR artifact (branch, title, body, diff) in local mode for third-party repos. | PR exists per improved file on synth/owned repo; no PR for non-improved files. |
| **D6** | **Live stage visibility**: dashboard and API expose the current stage — `picking_file`, `improving_coverage`, `improving_mutation`, `improving_mac` (verification), `preparing_pr` (+ bootstrap stages) — updating in near-real-time (≤5 s), including live progress lines of long steps. | Watch dashboard during a run; stages change as the n8n execution progresses. |
| **D7** | **Per-stage rules**: free-text rules for `post_clone`, `pre_pick`, `pick_file`, `write_test`, `check_changes`, `make_pr` are configurable via env; each is demonstrably applied at its stage (LLM-interpreted, with mechanical guardrails where possible). | Set a distinctive rule per stage (e.g. "don't touch ui", branch naming, PR style) and observe it obeyed in the run artifacts. |
| **D8** | **n8n-native workflow only**: workflow contains only native nodes (Triggers, HTTP Request, Code (pure JS data transforms — no `child_process`, no `fs`), IF, SplitInBatches, Set/NoOp, Wait). All OS work behind the sidecar HTTP API. | Static scan of workflow JSON: node types whitelist; grep Code nodes for `child_process|execSync|spawn|require('fs')`. |
| **D9** | **Adaptable across repos/runners**: auto-detects vitest vs jest, injects Stryker config + runner plugin when missing; README documents how a team adapts env, rules, and workflow. | Eval includes repos with both runners and repos without Stryker preconfigured. |
| **D10** | **Protected access, no n8n login**: Caddy basic auth in front of `improve-javascript-tests.mikhailov.tech`; 10-year n8n JWT injected by Caddy; dashboard at `/dashboard`; hitting n8n never shows its login screen. | Open both URLs: browser asks Caddy basic auth only, then lands directly in n8n editor / dashboard. |
| **D11** | **No reasoning leakage in committed artifacts**: LLM chain-of-thought must never appear in PR'd test files (no "Wait, let's try…" scratch commentary). Model thinking runs in the thinking channel (`LLM_ENABLE_THINKING`), and a cleanup pass strips residual scratch comments; at most one short intent comment per test. | Grep merged/PR'd test files for scratch-comment patterns; inspect samples across repos. |
| **D12** | **No dead-weight tests**: every committed test earns its place — it kills ≥1 mutant or exercises previously uncovered code; vacuous tests (cannot fail / assert nothing) are pruned by a cleanup pass that is itself verified (suite stays green, mutation score does not drop, else the cleanup is reverted). | Review PR diffs for vacuous tests; cleanup events show prune/revert decisions backed by re-measurement. |

## 3. Reward formula

```
reward = DoD_score × implementation_performance            ∈ [0, 1]

DoD_score = (Σ Di) / 12                                    Di ∈ {0, 0.5, 1}

implementation_performance = mean over eval repos of per_repo_score
  eval set = 1 synthetic repo + real-world OSS repos (brief asked for 10; grown to 13)

per_repo_score = 0.4 × completion + 0.6 × improvement
  completion  ∈ {0, 0.5, 1}:
      1   — pipeline ran unattended to a terminal state; on improvement a PR
            (real or prepared, per repo mode) was produced for each improved file
      0.5 — pipeline produced measurements and attempts but failed before
            finishing PR stage, or needed manual intervention
      0   — pipeline failed before producing a baseline measurement
  improvement = clamp( ΔMAC_gap_closed, 0, 1 )
      ΔMAC_gap_closed = (MAC_after − MAC_before) / (100 − MAC_before)
      computed PER FILE and averaged over the repo's targeted files; files already
      at MAC_before = 100 are excluded from that mean, and a measured file that was
      not improved contributes 0 (eval/score.mjs).
```

The 0.4/0.6 split rewards *finishing* the loop but weights *actual test-quality gain* higher.
Gap-closed normalisation makes a +5 pt gain on a 90 %-MAC file worth as much as +50 pt on a
0 %-MAC file — otherwise the optimum strategy is to only ever pick empty files.

## 4. Evaluation methodology

- **Synthetic repo** (`eval/synth-repo`): small vitest package with engineered defects — an
  untested branch-heavy module, a partially tested module whose tests assert too weakly (mutants
  survive), a UI-ish file that `pick_file` rules must skip, and an AGENTS.md carrying the rules.
  Known ground truth → checks D4/D5/D7 sharply.
- **10 real-world repos**: small/medium OSS JS/TS libraries using vitest or jest (mix of: with
  and without Stryker config). Selected empirically (cloneable, installable, suite green in
  ≤ ~5 min). Run in **local PR mode** (we don't own them): branch + commit + prepared-PR
  artifact recorded instead of pushing.
- Each eval run: fixed `SCOPE_LIMIT` (small, e.g. 1–2 files) and fixed `MAX_ITERATIONS` so runs
  are comparable and token-bounded. `eval/score.mjs` computes per-repo scores and the reward.
- Results per ralph-loop iteration are appended to `eval/RESULTS.md`.

## 5. Improvement protocol (ralph loop)

```
loop:
  deploy current implementation
  run eval (synth first, then real repos)
  compute reward; append to eval/RESULTS.md
  pick the lowest-scoring DoD item or worst-performing repo class
  fix it; repeat
until reward plateaus (2 consecutive iterations with no gain)
```
