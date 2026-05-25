# Benchmark doku with Harbor

Harbor runs doku inside Docker task containers and scores trials with each task's verifier (`tests/test.sh` → `/logs/verifier/reward.txt`).

## Prerequisites

- Docker daemon running (`docker info`)
- Harbor CLI (`benchmarks/harbor/scripts/install-harbor.sh`)
- DeepSeek (or compatible) API key in `DOKU_API_KEY` or `DEEPSEEK_API_KEY`
- Optional: `DOKU_BASE_URL` (defaults to DeepSeek API)

## Quick validation (no doku)

Confirms Harbor + Docker + dataset access:

```bash
bash benchmarks/harbor/scripts/run-oracle-smoke.sh
```

Oracle should score `1.0` on all 3 smoke tasks.

## Pilot benchmark (10 Terminal-Bench tasks)

```bash
export DOKU_API_KEY=sk-...
bash benchmarks/harbor/scripts/run-pilot.sh
```

Results land in `benchmarks/harbor/jobs/output/`.

## Full Terminal-Bench 2.0 sweep

```bash
export DOKU_API_KEY=sk-...
bash benchmarks/harbor/scripts/run-full.sh
```

## How doku is invoked

The Harbor agent (`benchmarks/harbor/doku_agent/agent.py`) installs `doku-deepseek-cli` from npm and runs:

```bash
doku exec --non-interactive \
  --prompt "<task instruction>" \
  --output /logs/agent/doku.jsonl \
  --max-turns 80 \
  --timeout-sec 1800
```

Harbor registers the agent via `import_path` — no fork of `harbor-framework/harbor` is required. Set `PYTHONPATH=benchmarks/harbor` when launching jobs.

## Benchmarking a local doku build

Before npm publish, install your built CLI inside the agent container by overriding `npm_spec`:

```yaml
agents:
  - import_path: doku_agent.agent:DokuAgent
    kwargs:
      npm_spec: /path/to/doku-deepseek-cli  # directory with package.json
```

Or publish a tarball: `npm pack` and set `npm_spec` to the `.tgz` path mounted into the container.

## Compare against other agents

Run the same dataset slice with a built-in Harbor agent:

```bash
export ANTHROPIC_API_KEY=sk-...
harbor run \
  --dataset terminal-bench@2.0 \
  --agent claude-code \
  --model anthropic/claude-haiku-4-5 \
  --limit 10 \
  --n-concurrent 2
```

## Metrics to compare

| Metric | Where |
|--------|--------|
| Pass rate | trial `reward.txt` / job summary |
| Duration | trial `result.json` |
| Tokens | doku JSONL `session_end.usage` |
| Failures | agent log `/logs/agent/doku.txt` |

## Known limitations (v1)

- MCP disabled in exec mode unless `doku exec --mcp`
- `AskUserQuestion` auto-selects the first option
- Agent install expects Debian/Ubuntu base images (apt + NodeSource 22)
