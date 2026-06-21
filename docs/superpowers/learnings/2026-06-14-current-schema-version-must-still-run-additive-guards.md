# Current Schema Version Must Still Run Additive Guards

**Date:** 2026-06-14
**Context:** OmniHarness SQLite schema initialization for persisted runs and event snapshots.
**Symptom:** `/api/events?snapshot=1&persisted=1&runId=...` returned 500 with `SQLITE_ERROR: no such column: phase` when `reconcilePersistedReloadZombies` selected from `runs`.
**Root Cause:** `initializeSchema()` returned early when `PRAGMA user_version` was already current, so a drifted local database at version 3 skipped idempotent `ALTER TABLE` guards that would have added newly expected columns.
**Fix:** Let current-version databases still execute idempotent schema creation and additive column guards, and create indexes after column backfills so index creation cannot fail on missing columns.
**Verification:** `./node_modules/.bin/vitest run tests/db/schema.test.ts`; `./node_modules/.bin/vitest run tests/server/runs/persisted-zombie-reconciler.test.ts`; `./node_modules/.bin/vitest run tests/api/events-route.test.ts`; live log showed the same authenticated `/api/events?snapshot=1&persisted=1&runId=a03e7c439b55` request returning 200.
**Prevention:** When adding SQLite columns, keep compatibility guards idempotent and ensure they run regardless of `user_version`; put dependent indexes after the guards.
**Skill/Doc Updates:** No general skill update needed; this is a project-specific migration invariant captured here.
