# Not-Modified Snapshots Still Need Stream Cursors

**Date:** 2026-05-20
**Context:** OmniHarness event snapshots and unified worker stream
**Symptom:** A selected direct conversation could have worker output persisted on disk while the frontend stayed empty or `Thinking...` until a force reload. The global snapshot state could be current, but the separate worker-entry manager had not learned the latest worker stream seq.
**Root Cause:** Persisted snapshot polling used `snapshotChecksum` to return `{ notModified: true }`. Because `workerEntrySeqs` lived only in the full snapshot body, the client skipped both `applyUpdate()` and the cursor hint needed to repair `WorkerEntriesManager`.
**Fix:** Include `workerEntrySeqs` on not-modified snapshot responses and have `LiveEventConnectionManager` pass those hints to `workerEntries.onKnownSeqs()` even when the full snapshot body is unchanged.
**Verification:** `pnpm vitest run tests/app/live-event-connection-manager.test.ts tests/api/events-route.test.ts`
**Prevention:** Treat `notModified` as a statement about one owner only. If another local manager depends on lightweight cursors from that payload, keep those cursors available even when the main snapshot does not need to be re-applied.
**Skill/Doc Updates:** Updated `docs/architecture/timing-determinism-audit.md`; this is a direct client/server state invariant about owner-specific freshness.
