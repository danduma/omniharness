# Direct Adapter Stale Working State

**Date:** 2026-05-20
**Context:** OmniHarness direct-control conversations, bridge session sync, worker stream authority
**Symptom:** Session `e89818e9d776` stayed visibly stuck on "Thinking..." even though the worker transcript had a final assistant answer and no queued/recovery blockers.
**Root Cause:** The live Gemini adapter still reported `state: "working"` after the direct turn had completed. `syncConversationSessions()` trusted that active bridge state over the completed append-only worker stream, so it persisted `runs.status = "running"` and `workers.status = "working"`.
**Fix:** For direct runs only, sync now detects a completed live turn when the current turn has no open tool/permission entries and the latest meaningful entry is an assistant message. In that case it quiesces the run to `done`, the worker to `idle`, and clears `currentText` while preserving the final `lastText`.
**Verification:** Added a failing regression in `tests/server/conversations-sync.test.ts` for a live adapter that keeps reporting `working` after a final assistant message. Verified the test failed before the fix and passed after. Also ran `pnpm exec vitest run tests/server/conversations-sync.test.ts tests/api/events-route.test.ts --pool=forks --poolOptions.forks.singleFork=true`.
**Prevention:** Do not let one stale "active" flag dominate richer cursor/stream evidence. For direct conversations, the worker stream is the authority for whether the current user turn has open work. Bridge state should refresh metadata, not hold the UI in an active state after the stream proves completion.
**Skill/Doc Updates:** Updated `docs/architecture/timing-determinism-audit.md` with this authority mismatch. No global skill update was needed; the existing control-plane guidance already says snapshots show current truth while named/stream events show why, but this project needed the explicit direct-turn invariant.
