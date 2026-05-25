#!/usr/bin/env bash
set -euo pipefail
node -e "
const fs = require('fs');
const cfg = JSON.parse(fs.readFileSync('config.json', 'utf8'));
if (cfg.name !== 'doku-smoke' || cfg.enabled !== true) process.exit(1);
"
