# notModified Snapshot Poll Must Honor the Manager's Active Flag

**Date:** 2026-05-20
**Context:** OmniHarness `LiveEventConnectionManager.runSnapshotPoll()` in the home view.
**Symptom:** When the user changed `selectedRunId` while a `/api/events?snapshot=1` poll was in flight, the old manager could still write worker-entry cursor hints into the singleton `workerEntriesManager` *after* `stop()` had run, because the `notModified` branch did not check `this.active` before forwarding cursors.
**Root Cause:** `runSnapshotPoll()` had an asymmetric guard: the modified branch wrapped both `applyUpdate(data)` and `workerEntries.onKnownSeqs(...)` in `if (this.active)`, but the notModified branch forwarded `workerEntries.onKnownSeqs(...)` unconditionally. `setLastEventId(...)` was also called before either branch. A stale poll resolving after unmount therefore mutated shared singleton state belonging to the new selection.
**Fix:** `runSnapshotPoll()` checks `this.active` immediately after the snapshot resolves and returns early when stopped. Both branches now run only when active, so the manager cannot write cursor hints, `lastEventId`, or apply updates after `stop()`.
**Verification:** `pnpm vitest run tests/app/live-event-connection-manager.test.ts` — 11 tests pass; new test holds an in-flight snapshot, calls `stop()`, resolves the promise as `notModified`, and asserts no cursor write reached the worker entries notifier.
**Prevention:**
- Any async resolution path that writes to shared singleton state must check the owner's active flag at resolve time, not just at scheduling time. The condition can flip between the two.
- When refactoring an "if active" guard, audit every branch — partial guards are silently asymmetric and only surface as flaky state for adjacent selections.

**Skill/Doc Updates:** Added section 31 to `docs/architecture/timing-determinism-audit.md`.
