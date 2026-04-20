#!/bin/bash
set -euo pipefail

export MOCK_LLM=true
npx playwright test
