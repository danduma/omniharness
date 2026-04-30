# Internal Agent Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the ACP worker runtime into OmniHarness so local development no longer depends on a sibling OpenClaw-oriented `acp-bridge` checkout.

**Architecture:** Preserve the current HTTP boundary for this milestone, but run an OmniHarness-owned daemon from this repo. The daemon is split into focused runtime modules for ACP process/session management, HTTP routing, command diagnostics, skill materialization, and agent-specific environment handling.

**Tech Stack:** Next.js 15, TypeScript, Node HTTP/child_process streams, `@agentclientprotocol/sdk`, Vitest, current OmniHarness worker/supervisor APIs.

**North Star Product:** OmniHarness owns the whole local multi-agent control plane: worker lifecycle, diagnostics, tools, skills, event visibility, and recovery without external product assumptions.

**Current Milestone:** Replace the sibling `../acp-bridge` dependency with an internal runtime that supports the endpoints OmniHarness uses today.

**Later Milestones / Deferred But Intentional:** A direct in-process runtime client can replace HTTP for selected server-only code later. The old generic task graph API is intentionally not carried forward unless a live OmniHarness workflow proves it is needed.

**Final Functionality Standard:** `pnpm dev` starts the OmniHarness web UI and an OmniHarness-owned ACP runtime from this repository. Existing worker spawn, ask, inspect, cancel, permission, mode, diagnostics, skill root, and MCP server flows keep working through the current client surface.

---

## File Map

Create:

- `scripts/agent-runtime.ts`: CLI entrypoint for the internal daemon.
- `src/server/agent-runtime/codex.ts`: Codex-specific environment and mode helpers.
- `src/server/agent-runtime/tool-env.ts`: managed PATH and diagnostic helpers.
- `src/server/agent-runtime/types.ts`: shared runtime request/response and record types.
- `src/server/agent-runtime/manager.ts`: ACP child process/session lifecycle and worker state.
- `src/server/agent-runtime/http.ts`: HTTP API compatibility adapter.
- `tests/server/agent-runtime/http.test.ts`: fake ACP agent end-to-end runtime tests.

Modify:

- `package.json` / lockfile: add `@agentclientprotocol/sdk`.
- `scripts/dev.ts`: start `scripts/agent-runtime.ts` instead of a sibling bridge.
- `src/server/dev/managed-bridge.ts`: convert helper semantics to internal runtime while preserving exported names during migration.
- `src/server/bridge-client/index.ts`: update errors/messages from external bridge to internal runtime.
- `src/app/api/agents/*.ts`, `src/app/api/events/route.ts`, `src/server/api-errors.ts`, `scripts/delete-conversations.sh`, `README.md`: update user-facing wording where it refers to the external bridge.
- Relevant tests under `tests/server/dev`, `tests/server/bridge-client`, and API/event tests.

## Tasks

- [x] Add failing tests proving the dev helper defaults to an internal runtime directory and no longer requires `../acp-bridge`.
- [x] Add failing runtime HTTP tests with a fake ACP agent proving `/agents`, `/agents/:name/ask`, `/agents/:name`, `/doctor`, skill roots, and MCP forwarding work in-repo.
- [x] Add the runtime dependency and create focused runtime modules by porting only the needed ACP lifecycle behavior.
- [x] Update `scripts/dev.ts` to build/start the internal runtime script and keep lock/health behavior.
- [x] Update bridge-client wording and route consumers to call the same local runtime URL without external setup messaging.
- [x] Update README/setup docs to describe the internal runtime and remove sibling checkout requirements.
- [x] Run focused runtime, bridge-client, dev helper, supervisor, and typecheck verification.

## Acceptance Criteria

- `pnpm dev` no longer references or builds `../acp-bridge`.
- The default local runtime URL remains `http://127.0.0.1:7800` for compatibility.
- Worker API behavior remains compatible for existing OmniHarness callers.
- Runtime files stay split; no new 1200+ line daemon file.
- Existing unrelated dirty files remain untouched unless they directly overlap this migration.
