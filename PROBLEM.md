# Problem

## What we want

Teams own JavaScript/TypeScript repositories whose tests are of uneven quality. Line coverage
alone flatters them: a line can be executed by a test that asserts nothing. We want a pipeline a
team can **point at their repo and leave running**, which comes back with **pull requests that
measurably improve the tests** — and which shows, while it works, exactly what it is doing.

The measure of "better tests" is **MAC — Mutation-Adjusted Coverage**:

```
MAC = line-coverage % × mutation-score % / 100    (both in [0,100]; MAC is on the same 0–100 scale)
```

Coverage says the code was *reached*; mutation score says the code was *constrained*. A test that
raises MAC has done real work; a test that only raises coverage may have done none.

Concretely, a team must be able to:

1. **Specify a repo** — URL, branch and scope globs, as configuration. No code changes.
2. **Run one Docker deliverable** containing the whole pipeline: n8n orchestrator, execution
   sidecar, dashboard.
3. **Get improved tests per file** — better coverage, better mutation score, better MAC.
4. **Get a PR per improved file**, and only where an improvement actually happened.
5. **See what is happening right now**: picking a file, improving coverage, improving mutation
   score, improving MAC, preparing a PR.
6. **Impose team rules at every stage** — after cloning, before picking, how to pick, how to write
   tests, how to judge changes, how to make the PR.
7. **Adapt the workflow themselves.** It is built from **n8n-native blocks only** — no shell, no
   Python in nodes. Everything that touches the OS sits behind an HTTP API the native HTTP Request
   node calls.

## How the work is done: the improvement loop

Per file, the loop is **mutant-driven**, and every claim in it is measured rather than asserted:

1. **Measure** the file: coverage, then Stryker mutation testing. Stryker's report is the *only*
   source of mutants — the model never decides what survives.
2. **Bootstrap coverage** only if the file has no coverage at all. With nothing importing the
   module, mutation testing has nothing to run; once any coverage exists, killing mutants raises
   coverage as a side effect, so no bulk coverage tests are written.
3. **Pick the most promising surviving mutant.** The model chooses from Stryker's survivors — it
   is ordering the work, not judging which findings count.
4. **Write one test** aimed at that single mutant.
5. **Re-run mutation over the whole file.** This answers both questions at once: did the target
   die, and what is still alive now.
6. **Keep the test only if something actually died** — the target, or a neighbour it took with it.
   Otherwise delete it. The target gets **one shot**: whether or not the test achieved anything
   else, that mutant is not attempted again.
7. **Repeat** from the fresh survivor list until nothing killable remains or the failure budget is
   spent, then verify the file end to end and open a PR if MAC improved.

The result is a **small, high-value test suite**: every test the mutant loop writes provably kills
something, or it is deleted. The one exception is the coverage bootstrap, whose tests exist to make
a file executable at all — they are kept on a green suite, and still reach a PR only if the round
improved a measured metric.

## The ralph loop

The pipeline itself is built the same way it improves code — measure, change the weakest thing,
measure again:

```
loop:
  deploy the current implementation
  run the evaluation (1 synthetic repo + real-world repos)
  compute reward; append the iteration to eval/RESULTS.md
  fix the lowest-scoring DoD item or the worst-performing repo class
until the reward plateaus (two consecutive iterations with no gain)
```

Iteration history, including what each change bought, is in [eval/RESULTS.md](eval/RESULTS.md).

## Reward

```
reward = DoD_score × implementation_performance                    ∈ [0, 1]

DoD_score = (Σ Di) / N                     Di ∈ {0, 0.5, 1}, the checklist in RESEARCH.md §2

implementation_performance = mean over eval repos of per_repo_score
  eval set = 1 synthetic repo + real-world OSS repos (the brief asked for 10; the set has grown
             to 13 as repos were added). The scorer averages over every result file present.

per_repo_score = 0.4 × completion + 0.6 × improvement
  completion  ∈ {0, 0.5, 1}   1 = ran unattended to a terminal state and produced a PR per
                              improved file; 0.5 = measured but did not finish; 0 = failed
                              before a baseline
  improvement = mean, over the repo's targeted files with MAC_before < 100, of
                clamp((MAC_after − MAC_before) / (100 − MAC_before), 0, 1)
                a measured file that was not improved contributes 0; files already at MAC 100
                are excluded from the mean
```

The two factors are deliberate: `DoD_score` asks *did we build the thing that was asked for*,
`implementation_performance` asks *does it work on real repositories*. Either being zero makes the
reward zero. Gap-closed normalisation stops the optimum being "only ever pick empty files" — +5
points on a 90-MAC file counts the same as +50 on a 0-MAC file.

Full DoD checklist, evaluation methodology and the improvement protocol: [RESEARCH.md](RESEARCH.md).
Current implementation flow: [SPEC.md](SPEC.md).

---

## Appendix: the original brief, verbatim

> We are building improve-javascript-tests n8n pipeline in docker for teams to adapt on their repos.
> Team need to: specify javascript repo, run docker with n8n pipeline against it and get improved
> tests for each file, meaning improved coverage, improved mutation score (with Stryker), improved
> MAC (coverage * mutation score) and to get pr's with improvements for each file where improvements
> happened. Also teams need to see what's happening in n8n right now - is it picking a file to mutate
> or improving coverage or improving mutation score or improving mac or preparing pr. Also there can
> be rules that should be applied to every stage of process - you will implement - e.g. after
> downloading repo, how to act before picking a file (e.g. make separate branch), how to pick file
> (e.g. don't touch ui), on write test (e.g. don't use introspection), on how to check if changes are
> good, how to make pr (e.g. pr style is ...). Teams will use this docker file and n8n workflow
> adapting it to their particular project, so use only n8n native blocks - no shell, no python etc.
>
> Please turn this problem into research, meaning: problem + DoD + reward formula for implementation
> - DoD * implementation_performance. Where DoD is structured list you extracted from problem and
> implementation performance is result of running implementation against 1 synth repo and 10
> real-world repos.
>
> Implement and improve in ralph loop.

### Amendments, in order

| # | Date | Amendment |
|---|------|-----------|
| 1 | 2026-07-24 | **D11 — no reasoning leakage.** Model chain-of-thought must never appear in committed tests. |
| 2 | 2026-07-24 | **D12 — no dead-weight tests.** Every committed test must earn its place; pruning must itself be verified. |
| 3 | 2026-07-24 | **Multi-round per-file improvement.** A round is kept iff ≥1 of coverage/mutation/MAC improves and none degrades; rounds stop when all three stale or any degrades. |
| 4 | 2026-07-24 | **UI components are first-class** — `.jsx`/`.tsx` get component-testing treatment, not generic logic tests. |
| 5 | 2026-07-25 | **Human-equivalent timesheets** per file and cumulative, plus machine time, ETA and human-FTE equivalent. |
| 6 | 2026-07-25 | **LLM token accounting** — input/output tokens per file and cumulative. |
| 7 | 2026-07-26 | **Mutant-driven loop.** Coverage is a bootstrap only; then pick the most promising mutant, write ONE test, re-run mutation, keep only verified kills. Goal: a small test model. |
| 8 | 2026-07-26 | **The model picks the mutant**, from Stryker's survivor list. |
| 9 | 2026-07-26 | **No per-file cap on productive work.** Re-run mutation after every attempt and work from the fresh list; never attempt a mutant twice; expect one kill to take several mutants with it. |
| 10 | 2026-07-26 | **Live model dialog** in the activity feed — prompts and responses visible as they happen. |
| 11 | 2026-07-26 | **Mutants come from Stryker, never from model judgement.** |
