# Loaded Empty Worker Stream Is Not Authority

**Date:** 2026-05-20
**Context:** OmniHarness direct-control worker stream loading
**Symptom:** A direct session had durable output on disk, but the selected terminal stayed empty or "Thinking..." until a reload, session switch, or later snapshot poll.
**Root Cause:** `WorkerEntriesManager.ensureLoaded()` treated `loaded` with `latestContiguousSeq === latestKnownSeq === 0` as complete. That state only proves an earlier fetch saw no entries; it does not prove no entries were appended later if the wake-up or snapshot hint was missed.
**Fix:** Empty loaded streams with no positive seq now revalidate from seq `0` when subscribed again. Selected direct worker streams also keep a lightweight validation refresh after work looks idle, so missed SSE wake-ups or stale snapshot hints cannot strand the terminal until reload. Terminal direct runs also ignore stale `currentText` for pending-assistant UI once the run is terminal.
**Verification:** `pnpm vitest run tests/app/worker-entries-manager.test.ts tests/app/direct-worker-stream-loading.test.ts tests/app/direct-control-activity.test.ts tests/app/busy-message-behavior.test.ts`
**Prevention:** Treat "loaded empty" as a timestamped observation, not durable completeness. Positive cursors, snapshot seq hints, selected-stream validation refreshes, or explicit terminal state are the proof tokens.
**Skill/Doc Updates:** Updated `docs/architecture/direct-control-session-regressions.md` and `docs/architecture/timing-determinism-audit.md` because this is a reusable direct-control lifecycle invariant.
