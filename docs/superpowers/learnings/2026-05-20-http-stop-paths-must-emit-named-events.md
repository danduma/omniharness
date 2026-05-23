# HTTP Stop Endpoints Must Emit worker.status / worker.terminal

**Date:** 2026-05-20
**Context:** OmniHarness `/api/runs/[id]` POST stop actions (`stop_supervisor`, `stop_worker`, implementation-mode pause-on-stop).
**Symptom:** Stops issued from the HTTP API changed the worker row to `cancelled` and triggered a `notifyEventStreamSubscribers()` snapshot refresh, but emitted no `worker.status` / `worker.terminal` named events. Subscribers that filter on the named-event ring (toast surfaces, tests, lifecycle observability) silently missed every HTTP-initiated stop, while the in-conversation `stopConversationFromManualStopCommand` correctly emitted both events for the same outcome.
**Root Cause:** `cancelWorker()` in `src/runtime/http/routes/runs.ts` was the canonical helper for all HTTP stop paths, but it only wrote the DB row and called `cancelAgent`. The named-event emit was scattered across other stop helpers and never adopted here. Once two code paths diverge on the canonical observability channel, the silence becomes invisible — the snapshot still updates, the UI still re-renders, only the audit transcript drifts.
**Fix:** `cancelWorker()` now reads the previous status, performs the update, and emits `worker.status` + `worker.terminal` whenever the worker actually transitions out of a non-cancelled state. Duplicate stop requests no longer double-emit. `stop_worker`, `stop_supervisor`, and `pauseImplementationRunAfterWorkerStop` inherit the emit because they all funnel through the helper.
**Verification:** `pnpm vitest run tests/api/run-route.test.ts tests/api/supervisor-route.test.ts` — 30 tests pass; two new tests assert `worker.terminal` fires for `stop_worker` and for each active worker stopped by `stop_supervisor`.
**Prevention:**
- When two helpers handle the same lifecycle transition (here: in-conversation stop vs HTTP stop), they must emit the same named events. State changes that bypass the canonical event channel are invisible to subscribers and tests.
- Read the previous status before the update so the emit can be skipped on duplicate transitions. A helper that fires events unconditionally will double-toast on retries.

**Skill/Doc Updates:** Added section 30 to `docs/architecture/timing-determinism-audit.md`.
