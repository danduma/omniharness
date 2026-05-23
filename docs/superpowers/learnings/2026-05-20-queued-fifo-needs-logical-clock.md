# Queued FIFO Needs A Logical Clock

**Date:** 2026-05-20
**Context:** OmniHarness busy-message queue draining into supervisor/user checkpoint messages.
**Symptom:** Full-suite verification exposed queued messages draining as `Second queued note`, then `First queued note` when both were created inside the same persisted timestamp bucket.
**Root Cause:** Queue reads used `(createdAt, id)` as a deterministic tie-breaker. That is stable, but it is not FIFO when ids are random UUIDs and SQLite timestamp persistence collapses closely spaced Date values into the same ordering bucket.
**Fix:** Queue creation now assigns a per-run monotonic logical timestamp with a one-second tick, and drained checkpoint messages use the queued record's createdAt. This preserves FIFO through DB reads that order by `createdAt`.
**Verification:** `pnpm vitest run tests/server/queued-messages.test.ts`.
**Prevention:** For user-visible FIFO queues, deterministic random-id tie-breakers are not enough. Use an insertion sequence or a logical clock that survives the persistence layer's timestamp precision.
