# doku smoke harness

Lightweight eval for the headless CLI harness (`doku exec`) without Docker or Harbor.

## What it measures

| Signal | Source |
|--------|--------|
| Harness completed | `doku exec` exit code + `session_end` in JSONL |
| Task solved | per-task `verify.sh` in an isolated temp workspace |
| Efficiency | JSONL: duration, tool calls, token usage |

## Tasks

| Task | Exercises |
|------|-----------|
| `fix-typo` | read + edit |
| `add-sum-fn` | write/edit a small module |
| `patch-json` | read + precise JSON edit |

Add a task: copy a folder under `tasks/` with `prompt.txt`, `workspace/`, and `verify.sh`.

## Run

```bash
export DOKU_API_KEY=sk-...   # or DEEPSEEK_API_KEY / OPENAI_API_KEY
npm run smoke
```

Single task:

```bash
SMOKE_TASK=fix-typo npm run smoke
```

OpenAI instead of DeepSeek:

```bash
export OPENAI_API_KEY=sk-...
export DOKU_MODEL=gpt-4o
export DOKU_BASE_URL=https://api.openai.com/v1
npm run smoke
```

Results land in `benchmarks/smoke/output/<timestamp>/` (`run.jsonl`, final workspace, `summary.json`).

## Score a log

```bash
node benchmarks/smoke/score-run.mjs benchmarks/smoke/output/<run>/fix-typo/run.jsonl
```

## When to use something heavier

Use Terminal-Bench / Harbor later only if you need **external** comparison against other terminal agents. For day-to-day harness regression and finding tool-loop improvements, this smoke suite is enough.
