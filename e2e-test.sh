#!/bin/bash
set -euo pipefail

export MOCK_LLM=true
pnpm test:e2e
