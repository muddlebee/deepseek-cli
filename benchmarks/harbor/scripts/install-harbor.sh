#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required but not installed." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "docker daemon is not running or not accessible." >&2
  exit 1
fi

if command -v uv >/dev/null 2>&1; then
  uv tool install harbor
  HARBOR=(uv tool run harbor)
elif command -v pipx >/dev/null 2>&1; then
  pipx install harbor
  HARBOR=(harbor)
else
  echo "Install uv or pipx, then re-run this script." >&2
  exit 1
fi

echo "Harbor installed. Validate with: harbor datasets list"
