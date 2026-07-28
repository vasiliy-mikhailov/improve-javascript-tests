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

Set free-text rules in `.env`; the LLM interprets them; mechanical guardrails enforce the
non-negotiables (suite must stay green, MAC must strictly improve, generated files can only be
tests):

| env var | stage | example |
|---|---|---|
| `RULES_POST_CLONE` | after cloning | `read AGENTS.md to find out how to behave` |
| `RULES_PRE_PICK` | before picking | `create a separate branch per file named tests/improve-{file}` |
| `RULES_PICK_FILE` | picking a file | `don't touch ui` |
| `RULES_WRITE_TEST` | writing tests | `don't use introspection` |
| `RULES_CHECK_CHANGES` | validating | `good only if suite green and MAC improved` |
| `RULES_MAKE_PR` | making the PR | `title starts with "test:"; body has a metrics table` |

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
