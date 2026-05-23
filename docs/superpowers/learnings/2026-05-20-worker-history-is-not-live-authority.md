# Worker History Is Not Live Authority

**Date:** 2026-05-20
**Context:** OmniHarness worker history hydration from the worker sidebar.
**Symptom:** A delayed full-history response could replace a newer live agent snapshot and erase active state or live text.
**Root Cause:** `handleLoadWorkerHistory()` keyed the response by worker id but treated the returned historical snapshot as wholly authoritative. It did not merge by entry id or compare live metadata freshness.
**Fix:** Added `mergeLoadedWorkerHistoryAgent()`. Full history now merges output entries by stable id and preserves newer live metadata when the current agent snapshot has a newer `updatedAt`.
**Verification:** Added a regression to `tests/app/home-mutation-ownership.test.ts` and ran `pnpm vitest run tests/app/home-mutation-ownership.test.ts`.
**Prevention:** Historical expansion requests may add missing content, but they must not overwrite newer live state unless their freshness token proves they are newer.
**Skill/Doc Updates:** Updated `docs/architecture/timing-determinism-audit.md`; no general skill update needed because the client/server state invariant already says fallbacks and historical rows must be gated and deduped by stable id.
