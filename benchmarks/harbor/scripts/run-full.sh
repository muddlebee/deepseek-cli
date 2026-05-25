#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if ! command -v harbor >/dev/null 2>&1; then
  echo "harbor CLI not found. Run benchmarks/harbor/scripts/install-harbor.sh first." >&2
  exit 1
fi

if [[ -z "${DOKU_API_KEY:-}" && -z "${DEEPSEEK_API_KEY:-}" ]]; then
  echo "Set DOKU_API_KEY or DEEPSEEK_API_KEY before running the full benchmark." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "docker daemon is not running or not accessible." >&2
  exit 1
fi

export PYTHONPATH="${ROOT}/benchmarks/harbor:${PYTHONPATH:-}"

harbor run -c benchmarks/harbor/jobs/full.yaml
