#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if ! command -v harbor >/dev/null 2>&1; then
  echo "harbor CLI not found. Run benchmarks/harbor/scripts/install-harbor.sh first." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "docker daemon is not running or not accessible." >&2
  exit 1
fi

harbor run \
  --dataset terminal-bench@2.0 \
  --agent oracle \
  --limit 3
