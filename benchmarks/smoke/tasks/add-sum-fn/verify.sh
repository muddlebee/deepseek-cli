#!/usr/bin/env bash
set -euo pipefail
node --input-type=module -e "import { sum } from './math.js'; if (sum(2, 3) !== 5) process.exit(1);"
