#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SMOKE_DIR="${ROOT}/benchmarks/smoke"
TASKS_DIR="${SMOKE_DIR}/tasks"
OUT_DIR="${SMOKE_DIR}/output"
RUN_ID="$(date +%Y-%m-%d__%H-%M-%S)"
RUN_DIR="${OUT_DIR}/${RUN_ID}"

MAX_TURNS="${SMOKE_MAX_TURNS:-25}"
TIMEOUT_SEC="${SMOKE_TIMEOUT_SEC:-300}"
TASK_FILTER="${SMOKE_TASK:-}"

if [[ -z "${DOKU_API_KEY:-}" && -n "${OPENAI_API_KEY:-}" ]]; then
  export DOKU_API_KEY="$OPENAI_API_KEY"
  export DOKU_BASE_URL="${DOKU_BASE_URL:-${OPENAI_BASE_URL:-https://api.openai.com/v1}}"
fi

if [[ -z "${DOKU_API_KEY:-}" && -z "${DEEPSEEK_API_KEY:-}" ]]; then
  if [[ -f "${HOME}/.doku/settings.json" ]]; then
    DOKU_API_KEY="$(node -e "
      const fs = require('fs');
      const path = require('path');
      const settings = JSON.parse(fs.readFileSync(path.join(process.env.HOME, '.doku/settings.json'), 'utf8'));
      process.stdout.write(String(settings.env?.API_KEY || settings.apiKey || ''));
    ")"
    export DOKU_API_KEY
  fi
fi

if [[ -z "${DOKU_API_KEY:-}" && -z "${DEEPSEEK_API_KEY:-}" ]]; then
  echo "Blocker: set DOKU_API_KEY, DEEPSEEK_API_KEY, OPENAI_API_KEY, or ~/.doku/settings.json." >&2
  exit 1
fi

cd "$ROOT"
npm run bundle >/dev/null
DOKU=(node dist/cli.js exec --non-interactive)

mkdir -p "$RUN_DIR"
SUMMARY="${RUN_DIR}/summary.json"
echo "[]" >"$SUMMARY"

pass=0
fail=0
skipped=0

run_task() {
  local task_dir="$1"
  local task_name
  task_name="$(basename "$task_dir")"
  local task_out="${RUN_DIR}/${task_name}"
  local workspace
  workspace="$(mktemp -d -t doku-smoke-XXXXXX)"
  local log_path="${task_out}/run.jsonl"

  mkdir -p "$task_out"
  cp -a "${task_dir}/workspace/." "$workspace/"

  local prompt
  prompt="$(tr -d '\r' <"${task_dir}/prompt.txt")"
  local harness_exit=0
  local verify_exit=null

  echo "==> ${task_name}"
  if ! "${DOKU[@]}" \
    --prompt "$prompt" \
    --cwd "$workspace" \
    --output "$log_path" \
    --max-turns "$MAX_TURNS" \
    --timeout-sec "$TIMEOUT_SEC"; then
    harness_exit=$?
  fi

  cp -a "$workspace/." "${task_out}/workspace/"

  if [[ -x "${task_dir}/verify.sh" ]]; then
    if (cd "$workspace" && bash "${task_dir}/verify.sh"); then
      verify_exit=0
    else
      verify_exit=$?
    fi
  fi

  rm -rf "$workspace"

  local metrics
  metrics="$(node "${SMOKE_DIR}/score-run.mjs" "$log_path")"
  node -e "
    const fs = require('fs');
    const path = require('path');
    const summaryPath = process.argv[1];
    const entry = {
      task: process.argv[2],
      harnessExit: Number(process.argv[3]),
      verifyExit: process.argv[4] === 'null' ? null : Number(process.argv[4]),
      metrics: JSON.parse(process.argv[5]),
    };
    const rows = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    rows.push(entry);
    fs.writeFileSync(summaryPath, JSON.stringify(rows, null, 2) + '\n');
  " "$SUMMARY" "$task_name" "$harness_exit" "$verify_exit" "$metrics"

  node --input-type=module -e "
    import { formatSummary } from '${SMOKE_DIR}/score-run.mjs';
    const [taskName, harnessExit, verifyExit, metricsJson] = process.argv.slice(1);
    const verify = verifyExit === 'null' ? null : Number(verifyExit);
    console.log(formatSummary(taskName, Number(harnessExit), verify, JSON.parse(metricsJson)));
  " "$task_name" "$harness_exit" "$verify_exit" "$metrics"

  local task_ok=1
  if [[ "$harness_exit" -eq 0 && ( "$verify_exit" == "null" || "$verify_exit" -eq 0 ) ]]; then
    task_ok=0
  fi
  return "$task_ok"
}

shopt -s nullglob
task_dirs=("${TASKS_DIR}"/*/)
if [[ ${#task_dirs[@]} -eq 0 ]]; then
  echo "No smoke tasks found in ${TASKS_DIR}" >&2
  exit 1
fi

for task_dir in "${task_dirs[@]}"; do
  [[ -d "$task_dir" ]] || continue
  task_name="$(basename "$task_dir")"
  if [[ -n "$TASK_FILTER" && "$task_name" != "$TASK_FILTER" ]]; then
    continue
  fi
  if run_task "$task_dir"; then
    pass=$((pass + 1))
  else
    fail=$((fail + 1))
  fi
done

if [[ -n "$TASK_FILTER" && "$pass" -eq 0 && "$fail" -eq 0 ]]; then
  echo "No task matched SMOKE_TASK=${TASK_FILTER}" >&2
  exit 1
fi

echo ""
echo "Smoke run ${RUN_ID}: ${pass} passed, ${fail} failed (${RUN_DIR})"

if [[ "$fail" -gt 0 ]]; then
  exit 1
fi
