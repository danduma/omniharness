# Read Markers Must Not Wake No-Op Synchronization

**Date:** 2026-07-11
**Context:** OmniHarness direct conversations, unread markers, and SSE live synchronization
**Symptom:** Selecting an `awaiting_user` conversation made the UI alternate between working and waiting, delayed typing, generated hundreds of `mark_read` requests, and kept the Next server busy.
**Root Cause:** A read marker emitted `conversation.read` even when it did not advance. That event woke the SSE loop, which rewrote unchanged worker and run rows with fresh `updatedAt` values. Because `awaiting_user` intentionally uses `run.updatedAt` as unread activity, the client treated every no-op synchronization as new activity and posted another read marker.
**Fix:** Read-marker upserts now update and emit only when `lastReadAt` strictly advances. Direct-run status synchronization and direct-worker synchronization now preserve `updatedAt` when their semantic fields are unchanged.
**Verification:** Added red-green regression coverage in `tests/api/run-route.test.ts`, `tests/conversations/direct-run-status.test.ts`, and `tests/server/conversations-sync.test.ts`. All 65 focused tests passed. Against live session `0abd06014635`, the request count stayed unchanged for ten seconds, run/worker timestamps stayed fixed, and Next server CPU fell from roughly 38% to 6%.
**Prevention:** Treat `updatedAt` as semantic activity, not a polling heartbeat. Every repeated observation must be idempotent at both the persistence and event layers. Events that wake live synchronization must not be emitted for unchanged state.
**Skill/Doc Updates:** No general skill update was needed; the existing client/server state and control-plane skills already require idempotent ownership, bounded hot paths, and named semantic events. This project-specific failure mode is recorded here for future regression work.
