# Worker Output Lock EINVAL Is Retryable

**Date:** 2026-06-29
**Context:** OmniHarness worker conversation stream persistence and append-only artifact streams
**Symptom:** A live recovered run surfaced `EINVAL: invalid argument, open '<worker>.jsonl.lock/owner.json'` while streaming live agent state. The run recorded `worker_observer_failed` and `run_failed` even though the worker later continued producing valid stream entries.
**Root Cause:** The mkdir-based file lock treated `ENOENT` and `ENOTDIR` during `owner.json` creation as recoverable races, but treated `EINVAL` as fatal. On macOS this can surface during the same transient lock-directory race: the owner metadata path is briefly invalid, the `.lock` directory disappears afterward, and a retry would have succeeded.
**Fix:** `acquireWorkerFileLock` and `acquireArtifactFileLock` now classify `EINVAL` during owner metadata write as a recoverable lock race, remove the lock directory, and retry.
**Verification:** `pnpm vitest run tests/server/workers/output-store.test.ts tests/server/artifacts/append-only-store.test.ts` failed on the new `EINVAL` regression tests before the fix and passed afterward with 35 tests.
**Prevention:** File-lock owner metadata creation should treat transient filesystem path errors as retryable when they occur immediately after acquiring the lock directory. Keep this behavior mirrored between worker streams and generic artifact streams.
**Skill/Doc Updates:** No general skill update needed; this is a project-specific filesystem lock invariant and is covered by regression tests in both lock implementations.
