#!/usr/bin/env bash
set -euo pipefail
grep -qxF "Hello, doku smoke!" message.txt
