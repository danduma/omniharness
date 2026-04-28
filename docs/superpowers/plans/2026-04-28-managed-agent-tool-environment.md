# Managed Agent Tool Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure ACP-launched coding agents receive a strong, predictable tool environment even when OmniHarness or the bridge starts from a thin GUI/service PATH.

**Architecture:** Put the core fix in the ACP bridge because it owns child process spawning. Build a managed worker PATH from the inherited environment, common developer bin locations, package-manager bin folders, and optional login-shell PATH capture, then expose diagnostics through the existing bridge doctor flow. Keep OmniHarness setup messaging aligned with the stronger runtime checks.

**Tech Stack:** Node.js/TypeScript ACP bridge, OmniHarness TypeScript/Bash setup scripts, Node test runner and Vitest tests.

**North Star Product:** OmniHarness agents feel locally native and fully capable on fresh machines without users needing to understand shell startup, GUI PATH inheritance, or adapter internals.

**Current Milestone:** Managed PATH construction, worker spawn integration, doctor visibility for essential tools, and setup output that points users at actionable remediation.

**Later Milestones / Deferred But Intentional:** Vendored cross-platform binaries for essentials like ripgrep, one-command auto-fix installers per OS, and UI-visible environment health panels.

**Final Functionality Standard:** ACP worker processes get the managed PATH for real agent sessions, diagnostics show exactly which essential tools are available or missing, and verification covers the regression where a thin launch environment cannot find common tools.

---

## File Map

- Create: `/Users/masterman/NLP/acp-bridge/src/tool-env.ts`
  - Responsibility: construct managed PATHs, capture login-shell PATH when safe, resolve command availability, and produce tool diagnostics.
- Modify: `/Users/masterman/NLP/acp-bridge/src/daemon.ts`
  - Responsibility: use the managed PATH in preflight, doctor, and agent child process spawning.
- Add: `/Users/masterman/NLP/acp-bridge/tests/tool-env.test.mjs`
  - Responsibility: red-green coverage for PATH expansion, deduping, login shell merge, and tool diagnostics.
- Modify: `/Users/masterman/NLP/omniharness/scripts/install-agent-acp.sh`
  - Responsibility: check/report essential agent tools beyond adapters and explain that the bridge uses a managed runtime PATH.
- Modify: `/Users/masterman/NLP/omniharness/tests/scripts/install-agent-acp.test.ts`
  - Responsibility: verify setup output includes essential tool checks without requiring every optional tool to be installed.

## Tasks

- [ ] **Step 1: Add failing bridge tests**
  - Write tests for managed PATH construction with a minimal inherited PATH.
  - Verify common bins such as `/usr/local/bin`, `/opt/homebrew/bin`, `~/.cargo/bin`, and project `node_modules/.bin` are included and deduped.
  - Verify diagnostics report present/missing essential tools.
  - Command: `cd /Users/masterman/NLP/acp-bridge && npm test -- tests/tool-env.test.mjs`

- [ ] **Step 2: Implement managed tool environment**
  - Add `src/tool-env.ts`.
  - Update `daemon.ts` to use managed PATH in `commandExists`, preflight, doctor, and `spawnAgentConnection`.
  - Preserve configured agent env and per-request env as higher-priority overlays.
  - Command: `cd /Users/masterman/NLP/acp-bridge && npm run build && npm test -- tests/tool-env.test.mjs`

- [ ] **Step 3: Improve OmniHarness setup checks**
  - Extend `scripts/install-agent-acp.sh` to report core tools: `rg`, `git`, `node`, `npm`, `pnpm`, `python3`, `bash`, `zsh`, `jq`, `gh`, `cargo`, and `uv`.
  - Keep optional tools advisory rather than hard failure.
  - Update existing tests.
  - Command: `pnpm test -- tests/scripts/install-agent-acp.test.ts`

- [ ] **Step 4: Final verification**
  - Run targeted tests in both repos.
  - Run bridge build.
  - Confirm no branches or worktrees were created.
