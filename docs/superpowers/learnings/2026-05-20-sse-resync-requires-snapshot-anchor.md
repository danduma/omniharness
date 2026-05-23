# SSE Resync Requires Snapshot Anchor Ownership

**Date:** 2026-05-20
**Context:** OmniHarness browser event stream and persisted snapshot fallback.
**Symptom:** Sessions could appear empty, stuck on "Thinking...", or stale until a reload or session switch caused a fresh load, even though the server already had the finished output.
**Root Cause:** `LiveEventConnectionManager` treated the event-stream cursor as an initial construction value. Persisted snapshot fallback discarded `x-omni-last-event-id`, and `stream.resync_required` only reset worker-entry fetching instead of rebootstraping the whole event stream from a new authoritative snapshot anchor.
**Fix:** Persisted snapshot polling now captures the snapshot event id, stores it as the browser-owned cursor, and `stream.resync_required` closes the unsafe `EventSource`, loads a persisted snapshot, applies its worker seq hints, and reconnects SSE with the snapshot-owned cursor.
**Verification:** Added `LiveEventConnectionManager` coverage for resync rebootstrap and reconnect from the snapshot anchor; ran `pnpm vitest run tests/app/live-event-connection-manager.test.ts`.
**Prevention:** Treat SSE cursors as mutable server-owned facts, not constructor constants. Any event-stream gap must have a deterministic rebootstrap path that proves freshness before the client resumes live updates.
**Skill/Doc Updates:** Updated `docs/architecture/timing-determinism-audit.md`; no general skill update needed because `client-server-state-invariants` already requires explicit event ids, replay/resume, and resync paths.
