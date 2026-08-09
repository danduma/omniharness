# Map OmniHarness Full Access to the Codex ACP Mode

Date: 2026-08-06

## Context

OmniHarness workers are configured with the public mode name `full-access`. The Codex ACP adapter exposes that capability as `agent-full-access`.

## Symptom

The worker record reported `full-access`, but the Codex session remained in its default `agent` mode. That mode uses a workspace-write filesystem sandbox and disables network access, so nested Codex CLI reviewers could not reach `chatgpt.com`.

## Root cause

The runtime passed OmniHarness's public mode name directly to ACP `session/set_mode`. `shouldSetRequestedMode` correctly rejected the unknown ACP mode ID, but the caller treated that no-op as success and left the adapter's default mode active.

## Fix and prevention

Map `full-access` and `danger-full-access` to `agent-full-access` at the Codex ACP boundary, using the advertised session modes. Apply the mapping both when a worker starts and when an existing worker changes mode. Keep the public worker record in OmniHarness terminology, and test the actual ACP `session/set_mode` request so a mode-name mismatch cannot silently reintroduce the sandbox.

## Verification

`tests/server/agent-runtime/codex.test.ts` and `tests/server/agent-runtime/manager-permission-mode.test.ts` pass (6 tests total), and `pnpm exec tsc --noEmit` passes.
