# Hot Snapshot Routes Must Avoid Cold Heavy Imports

**Date:** 2026-05-20
**Context:** OmniHarness event snapshots and worker-entry loading
**Symptom:** Local API routes that should read small SQLite/file slices were taking 4-9 seconds after server start.
**Root Cause:** Hot snapshot routes paid cold costs unrelated to their work: schema bootstrap replayed DDL on fresh route imports, `/api/events?snapshot=1&persisted=1` imported supervisor/session machinery that it did not need, and several run-scoped SQLite queries had prefix indexes that still forced temp B-tree sorts for their exact `ORDER BY`.
**Fix:** Added exact-order indexes for snapshot queries, added a `PRAGMA user_version` schema fast path, made persisted event snapshots avoid heavy runtime imports, split queued-message serialization into a lightweight module, and let cached conversation/worker previews render while server authority catches up.
**Verification:** `pnpm test tests/app/worker-entries-manager.test.ts tests/app/home-view-model.test.ts tests/app/direct-worker-stream-loading.test.ts tests/app/event-stream-state-manager.test.ts tests/runtime/http-routes.test.ts`; `pnpm exec tsc --noEmit`; `EXPLAIN QUERY PLAN` confirmed the selected-run event/message/review queries use the new covering indexes instead of temp B-trees.
**Prevention:** Profile route import time separately from handler time, and keep snapshot/preview routes free of supervisor startup, queue delivery, provider registries, and other mutation/control-plane modules.
**Skill/Doc Updates:** No general skill update needed; this is a project-specific route architecture and persistence lesson.
