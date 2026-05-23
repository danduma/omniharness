# Stale Gemini Session Recovery

**Date:** 2026-05-20
**Context:** OmniHarness worker recovery for Gemini-backed implementation runs.
**Symptom:** Session `ca18b7e86437` showed `Run failed` after a Gemini resume tried to use session `39d027fa-643b-4f56-b260-3101b313ff53`, which no longer existed under `/Users/masterman/.gemini/tmp/directorscut/chats`.
**Root Cause:** A missing external Gemini session id was treated as a worker resume failure, leaving the run failed and blocking fresh implementation-worker spawn behind stale persisted worker state.
**Fix:** Treat rejected saved sessions as missing runtime state, clear the stale worker session, cancel the old worker row, restart the supervisor from the checkpoint, and reconnect the run to a fresh Gemini runtime session on the same conversation.
**Verification:** Checked `sqlite.db` run, worker, event, queued-message, and recovery rows; confirmed the stale Gemini id was absent from the Gemini chat store; ran `pnpm vitest run tests/server/runs/recovery-reconciler.test.ts tests/supervisor/index.test.ts tests/api/run-route.test.ts`; then resumed `ca18b7e86437` and verified `ca18b7e86437-worker-7` was `working` with bridge session `27ad6db2-6001-443f-b5f1-0907d5934edd`.
**Prevention:** Recovery paths that call external CLI resume APIs must classify "invalid session identifier", "session not found", and `not_found` errors as missing-session recovery, emit a typed event, and continue through checkpoint restart when the conversation mode supports it.
**Skill/Doc Updates:** No general skill update needed; the control-plane observability rules already require typed events for recovery decisions, and this case is now captured as an OmniHarness-specific lesson.
