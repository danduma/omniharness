# Idle Live Current Text Is Not Work

**Date:** 2026-05-20
**Context:** OmniHarness direct-control worker snapshots and pending assistant UI.
**Symptom:** A completed direct session could keep showing `Thinking...` after final output existed in the durable worker stream.
**Root Cause:** The bridge can leave final turn text in `currentText` after its state returns to `idle`. The server snapshot forwarded that stale field, and the frontend treated any `currentText` as evidence of active assistant work.
**Fix:** `buildLiveWorkerSnapshot` now surfaces `currentText` only for active bridge states. Idle completed workers render durable entries and `lastText` without reintroducing stale live text.
**Verification:** Added and ran `pnpm vitest run tests/server/live-worker-snapshots.test.ts`; the new regression test failed before the fix and passed after it.
**Prevention:** Treat live text as a state-machine field, not just a non-empty string. A field named `currentText` is only current when the owning worker state proves the worker is active.
**Skill/Doc Updates:** Updated `docs/architecture/timing-determinism-audit.md` with the reusable invariant.
