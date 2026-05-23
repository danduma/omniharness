# Snapshot Marker Must Not Leapfrog Worker Events

**Date:** 2026-05-20
**Context:** OmniHarness SSE snapshots plus named `worker.entry_appended` wake-up frames.
**Symptom:** A direct-control turn could finish and persist worker output, but the selected UI stayed empty or stuck on `Thinking...` until a reload or session switch forced a fresh worker-stream fetch.
**Root Cause:** The SSE route drained named events, then allocated a snapshot marker id. A `worker.entry_appended` emitted in the tiny gap between those steps received an id lower than the snapshot marker. The client consumed the snapshot id as its latest event id and could skip that worker wake-up forever.
**Fix:** After allocating the snapshot marker, the SSE route performs a bounded drain through `marker.id - 1` before sending the snapshot frame. Events emitted after the marker remain for the next drain, so SSE ids stay monotonic while pre-marker wake-ups cannot be skipped.
**Verification:** Added `throughId` replay coverage in `tests/server/events/named-events.test.ts`; source behavior is covered by the route path using the bounded drain before writing the snapshot.
**Prevention:** Any cursor-advancing marker must either be allocated before the work it summarizes, or must drain all lower-id events immediately before the marker id is exposed to clients. Never let a marker advance `Last-Event-ID` past undelivered named decisions.
