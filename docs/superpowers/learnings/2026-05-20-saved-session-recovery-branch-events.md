# Saved Session Recovery Needs Branch Events

**Date:** 2026-05-20
**Context:** OmniHarness worker/session recovery across direct, supervisor, recovery reconciler, and quota-reset paths.
**Symptom:** A saved Gemini session could be rejected with `Invalid session identifier`; some recovery paths would only reveal the outcome later through DB snapshots, and fresh-worker fallback could accidentally keep the rejected session id as the worker's persisted authority.
**Root Cause:** The code treated "resume saved session" and "start fresh after saved-session rejection" as implementation details inside helper functions. Several paths wrote execution events or worker rows without emitting the typed `worker.reattached` / `worker.recreated` event that the SSE control plane requires.
**Fix:** Emitted `worker.reattached` on successful saved-session reuse and `worker.recreated` when fallback starts a fresh runtime worker. Fresh fallback now clears the invalid session id and stores only the new session id returned by the fresh worker. The new `worker_session_recreated` execution event is treated as a turn reset so old completion evidence cannot leak across the fresh session boundary.
**Verification:** `pnpm vitest run tests/app/home-utils.test.ts tests/supervisor/wake.test.ts tests/supervisor/observer.test.ts tests/api/conversation-messages-route.test.ts tests/api/run-route.test.ts tests/server/runs/recovery-reconciler.test.ts tests/supervisor/index.test.ts`
**Prevention:** Recovery helpers must publish the branch they took. A UI or test should never have to infer reattach-vs-recreate from a later snapshot diff.
**Skill/Doc Updates:** Updated `docs/architecture/timing-determinism-audit.md`; no general skill change needed because `instrumenting-control-planes` already requires named events for reattach, recreate, recover, and fail decisions.
