# Provider Session Materialization From Worker Streams

**Date:** 2026-05-25
**Context:** OmniHarness direct-control ACP worker recovery
**Symptom:** A saved ACP session ID could be rejected because the provider CLI lost its own session file, leaving OmniHarness with the user-visible transcript but no provider-native resume artifact.
**Root Cause:** Recovery treated provider session stores as authoritative. They are not. OmniHarness already owns the authoritative append-only worker stream, but recovery did not regenerate missing provider artifacts for every harness.
**Fix:** Added provider session materializers for Gemini, Codex, Claude, and OpenCode. Rejected saved-session recovery now writes the provider-native session file(s), retries ACP resume with the same session ID, and only falls back to transcript replay if materialization or resumed ACP startup still fails.
**Verification:** `pnpm test tests/server/workers/session-recovery.test.ts tests/api/run-route.test.ts tests/api/conversation-messages-route.test.ts tests/lib/run-recovery-state.test.ts tests/lib/conversation-workers.test.ts`; `pnpm exec vitest run tests/server/agent-runtime/http.test.ts`; `git diff --check`. `pnpm exec tsc --noEmit` still fails only on pre-existing `tests/supervisor/protocol.test.ts` `ProcessEnv` fixture typing errors.
**Prevention:** When adding a new worker harness, identify both its durable session storage path and minimal resumable session format. Wire it into `materializeProviderSessionFromWorkerStream` before exposing direct-control retry/resume.
**Skill/Doc Updates:** No general skill update needed; the project-specific rule belongs with the worker conversation stream and lifecycle recovery docs.
