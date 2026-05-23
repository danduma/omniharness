# Ownerless Worker Output Locks Must Be Reclaimed

**Date:** 2026-05-21
**Context:** OmniHarness worker conversation stream persistence and supervisor observation
**Symptom:** A session status log could churn between a transient `worker_observer_failed` lock timeout and the worker's completed output. The run kept recording observer failures for a worker whose JSONL stream already contained final text.
**Root Cause:** `acquireWorkerFileLock` treated an existing `.jsonl.lock` directory as live until its directory mtime exceeded the stale threshold. An ownerless lock directory with no `owner.json` could remain fresh enough to block every writer, causing repeated `Timed out waiting for worker output lock` failures.
**Fix:** The stale-lock check now treats a lock directory without `owner.json` as immediately reclaimable.
**Verification:** `pnpm vitest run tests/server/workers/output-store.test.ts --testNamePattern 'recovers an ownerless worker output lock directory'` failed before the fix and passed after it. `pnpm vitest run tests/server/workers/output-store.test.ts` passed with 20 tests.
**Prevention:** Lock recovery should validate owner records, not only filesystem timestamps. Owner metadata is part of the lock invariant.
**Skill/Doc Updates:** No general skill update needed; the project-specific concurrency rule is captured here and enforced by the regression test.
