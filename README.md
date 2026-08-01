# improve-javascript-tests

One Docker container that points an **n8n pipeline** at any JavaScript/TypeScript repo and
produces **pull requests that improve tests**: higher line coverage, higher Stryker mutation
score, and higher **MAC = coverage% × mutation%** — one PR per improved file — with a live
dashboard showing exactly what the pipeline is doing right now.

See [RESEARCH.md](RESEARCH.md) for the problem statement, Definition of Done, and reward formula.

## Run it yourself, on your own repo, with nothing but Docker

`docker-compose.yml` is the *deployed* shape: it publishes no ports and expects an
external Caddy on `proxy-net` to terminate TLS and inject the n8n auth cookie. On your
own machine use the standalone file instead — one container, two ports, no proxy.

```bash
cp .env.example .env
```

Four lines in `.env` decide the run; the rest have working defaults:

| key | what to put there |
| :-- | :-- |
| `REPO_URL` / `REPO_BRANCH` | the repo to improve. Public repos need no token to clone |
| `GH_TOKEN` | PAT with `repo` scope — to push the branch and open the PR. Leave empty and set `PR_MODE=local` to keep everything on disk instead |
| `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` | any OpenAI-compatible `/v1` endpoint (vLLM, Ollama, OpenAI, …) |
| `SCOPE_GLOB` / `SCOPE_LIMIT` | which source files are eligible, and how many to process (`1` for a first run, `0` for the whole repo) |

```bash
docker compose -f docker-compose.standalone.yml up -d --build
```

- Dashboard — live stage, per-file MAC, model transcript: <http://localhost:3000/dashboard/>
- n8n editor: <http://localhost:5678/> — user `admin@ijst.local`, password from
  `docker exec ijst-standalone cat /data/.owner_password`
- Start a run — hit *Execute* on **Improve JS Tests** in the editor, or:

```bash
curl -X POST http://localhost:5678/webhook/improve-run -H 'content-type: application/json' -d '{"scopeLimit": 1}'
```

Any `.env` key can be overridden per run in that JSON body, camelCased
(`{"repoUrl": "...", "scopeGlob": "lib/**/*.ts"}`) — no restart needed.

Notes:

- **Ports already taken?** Change the left-hand side of the `ports:` mappings; also set
  `WEBHOOK_URL`/`N8N_EDITOR_BASE_URL` to the port you picked, or n8n's copy-link buttons
  point at the wrong place.
- **The target repo's own toolchain must work in the container.** It runs
  `npm ci || npm install` and needs Vitest or Jest; Stryker is injected. If the repo
  needs a build step first, set `SETUP_SCRIPT=build`.
- **State lives in the `ijst_data` volume** — clone, mutant queues, ledgers, n8n's
  database. `down` keeps it; `down -v` gives you a genuinely clean run.
- **Watch it work**: `docker logs -f ijst-standalone`, or the dashboard, or
  `curl -s localhost:3000/api/events?limit=40`.
- The first run on a fresh repo spends its first minutes on `npm install` and a baseline
  coverage + mutation measurement before any model call — that is expected, not a hang.

## Quick start (this deployment)

```bash
cp .env.example .env      # set REPO_URL, REPO_BRANCH, GH_TOKEN, SCOPE_GLOB, rules
docker compose up -d --build
```

- n8n editor: `https://improve-javascript-tests.mikhailov.tech` (Caddy basic-auth; no n8n login —
  a 10-year auth token is injected by Caddy)
- Dashboard: `https://improve-javascript-tests.mikhailov.tech/dashboard`
- Start a run: open workflow **Improve JS Tests** in n8n and hit *Execute*, or POST the webhook:

```bash
curl -X POST https://improve-javascript-tests.mikhailov.tech/webhook/improve-run \
  -u admin:<basic-auth-password> -H 'Content-Type: application/json' \
  -d '{"scopeLimit": 1}'   # any .env key can be overridden per run (camelCase)
```

## Feedback on the tests it writes

Every kept test is filed in **`improve-tests.json` at the target repo's root**, together
with the prompt that produced it, the source it was shown, and how it scored:

```json
{ "id": "gen_ab12…", "file": "lib/foo.ts", "testPath": "tests/unit/foo.mac.test.ts",
  "prompt": { "system": "You are an expert test engineer…", "user": "…", "model": "qwen" },
  "source": "…", "test": "…",
  "outcome": { "kept": true, "mutantsKilled": 3, "aimedAt": 5, "macAfter": 42.5 },
  "signals": { "cases": 6, "mockSetup": 2, "mockAssertions": 1, "realAssertions": 12 },
  "feedback": [] }
```

Add a judgement to any of them — by test path, which is what you have in front of you in
a PR diff:

```bash
curl -X POST http://localhost:3000/api/feedback -H 'content-type: application/json' \
  -d '{"testPath":"tests/unit/foo.mac.test.ts","text":"i do not like too many mocks in these tests","author":"you"}'
```

`GET /api/feedback` reads the judged records back.

The file lives in the repo it describes, so it is versioned with that code, reviewable in
a pull request, and still there on a fresh clone — which is when a run would otherwise
repeat a mistake the team has already objected to. It is the corpus a prompt optimiser
(GEPA) reflects on: a verdict like "too many mocks" can only improve anything when it
sits next to the prompt that asked for them and the score that prompt earned. `signals`
records mock setup lines, mock assertions and real assertions so that complaint is a
number, not an argument.

Records carrying human feedback are never evicted; unjudged ones are capped so the file
stays readable.

## Browser tests

The dashboard is checked in a real browser, in containers — nothing installed on the host:

```bash
docker compose -f docker-compose.ui.yml up --build --abort-on-container-exit --exit-code-from playwright
```

`dash` runs the real sidecar against a fixed `ui-tests/seed/state.json`, so a failing
assertion means the UI changed rather than that a live run moved on; `playwright` drives
Chromium against it over the compose network.

They cover what neither the unit suite nor the API tests can see: the page reaching its
own API at both `/` and `/dashboard/`, the seeded metrics rendering in the right columns,
the comment button appearing on improved files but not candidates, and a comment
travelling from a click through to `improve-tests.json` and back as a count on the button.

## How it works

```
n8n workflow (native nodes ONLY: HTTP Request / Code / IF / NoOp / triggers)
   │  every OS-touching operation = HTTP call to the sidecar
   ▼
sidecar :3000  (zero-dependency Node 22)  ── git / npm / vitest / jest / stryker / gh / LLM
   │  state.json + events  →  dashboard (/dashboard) polls every 2 s
   ▼
per file: pick (rules) → branch → measure → write coverage tests (LLM) →
          write mutant-killing tests (LLM) → verify MAC improved → PR (or discard)
```

Stages you'll see live on the dashboard: cloning, installing, measuring baseline,
**picking a file**, **improving coverage**, **improving mutation score**, **improving MAC
(verifying)**, **preparing PR**.

### Team rules (applied at every stage)

Rules are free text, the LLM interprets them, and mechanical guardrails enforce the
non-negotiables (suite must stay green, MAC must strictly improve, generated files can
only be tests).

**They live in the repo they describe** — `improve-tests.json` at its root, the same file
as the feedback corpus:

```json
{ "rules": {
    "write_test": "never mock the database; use the in-memory adapter",
    "pick_file": "don't touch ui"
} }
```

Rules are prompts, and a prompt that lives in one operator's `.env` means the tests a
repo gets depend on whose container ran, and nobody reading the repo can see what was
asked for. `.env` supplies **defaults** for stages the repo says nothing about:

| default env var | stage | example |
|---|---|---|
| `DEFAULT_RULES_POST_CLONE` | after cloning | `read AGENTS.md to find out how to behave` |
| `DEFAULT_RULES_PRE_PICK` | before picking | `create a separate branch per file named tests/improve-{file}` |
| `DEFAULT_RULES_PICK_FILE` | picking a file | `don't touch ui` |
| `DEFAULT_RULES_WRITE_TEST` | writing tests | `don't use introspection` |
| `DEFAULT_RULES_CHECK_CHANGES` | validating | `good only if suite green and MAC improved` |
| `DEFAULT_RULES_MAKE_PR` | making the PR | `title starts with "test:"; body has a metrics table` |

`GET /api/rules` shows the effective rules, the defaults, and which ones the repo set
itself. Edits to `improve-tests.json` take effect at the next stage, not the next run.

### Adapting the workflow

The workflow is pure native n8n — open it in the editor and edit prompts (Code nodes) or
rewire stages. It never shells out; the sidecar API surface is documented in
`sidecar/server.js` (routes table).

`PR_MODE=github` opens real PRs via `gh`; `PR_MODE=local` (for repos you don't own) records the
branch, patch and PR payload under `/data/prs/`.

## Operating (this deployment)

```bash
./deploy.sh            # build + up + rotate the 10-year token into Caddy
./deploy.sh --fresh    # same, but wipe /data first
```

## Evaluation

`eval/` holds the harness from RESEARCH.md: 1 synthetic repo + 10 real-world OSS repos.

```bash
docker exec ijst-n8n node /data/eval/run-eval.mjs synth     # or a repo name from eval/repos.json
docker exec ijst-n8n node /data/eval/score.mjs              # implementation_performance + reward
```

Iteration history: `eval/RESULTS.md`.
