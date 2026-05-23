# Artifact Lock Owner Races Need Immediate Reclaim

**Date:** 2026-05-21
**Context:** OmniHarness worker/artifact JSONL persistence locks.
**Symptom:** Run `ca18b7e86437` failed after repeated worker observer errors, including `ENOENT` for `<worker>.jsonl.lock/owner.json`, leaving the run failed even though worker transcript data still existed.
**Root Cause:** The lock protocol treated a lock directory as live even when its `owner.json` metadata was missing, and owner metadata write races could escape instead of retrying. That made transient lock cleanup look like a fatal observer failure.
**Fix:** Recovered the run's worker streams, parked stale active workers, cleared the failed run state, queued a supervisor wake, and hardened the shared artifact lock to reclaim ownerless lock directories and retry recoverable owner metadata races.
**Verification:** `pnpm vitest run tests/server/artifacts/append-only-store.test.ts tests/server/workers/output-store.test.ts tests/supervisor/retry.test.ts` passed with 46 tests.
**Prevention:** Any mkdir-based file lock with owner metadata must treat a missing owner file as stale immediately and retry `ENOENT`/`ENOTDIR` races between lock acquisition and owner write.
**Skill/Doc Updates:** No global skill update needed; the project learning plus regression tests cover this concrete storage pattern.
