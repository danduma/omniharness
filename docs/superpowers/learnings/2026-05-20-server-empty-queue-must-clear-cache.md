# Server Empty Queue Must Clear Cache

**Date:** 2026-05-20
**Context:** OmniHarness queued steering, event snapshots, frontend snapshot cache
**Symptom:** A queued steering message delivered to the worker, but the UI kept showing it in the queued-message drawer, so the same user text appeared both in the worker stream and in the queue.
**Root Cause:** The server correctly omits delivered queue rows from `queuedMessages`, but `EventStreamSnapshotCacheManager` treated an authoritative server `queuedMessages: []` the same as missing data and restored stale cached pending queue rows.
**Fix:** Cache hydration now respects server-authoritative snapshots: when `snapshotSource` is `"server"` and an array is present, even an empty array wins over cached data.
**Verification:** `pnpm test tests/app/event-stream-state-manager.test.ts` covers stale cached queued rows being cleared by an empty server queue. `pnpm test tests/server/queued-messages.test.ts` confirms queued-message delivery behavior still passes.
**Prevention:** For server-owned arrays, do not use non-empty array checks as authority checks. Empty arrays can be terminal facts, especially for queues and filtered delivered state.
**Skill/Doc Updates:** No general skill update needed; `client-server-state-invariants` already requires provenance and completeness before treating cached state as authoritative.
