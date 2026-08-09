# Detached Supervisor Wake Rejections Must Be Contained

**Date:** 2026-08-05
**Context:** OmniHarness durable supervisor wakes and automatic quota recovery
**Symptom:** The production runner exited when an automatic quota-resume prompt lost a race to a newer worker turn and raised `WORKER_TURN_SUPERSEDED`.
**Root Cause:** The superseded turn is an expected ownership handoff, but quota recovery treated it as an error. That rejection escaped through a timer-started durable wake whose promise had no final rejection handler, so Node terminated the runner.
**Fix:** Quota recovery now records the superseded continuation, resolves the recovery incident, and continues without failing the run. Durable and volatile supervisor timers now pass their promises through a final safety boundary that persists any otherwise-unhandled wake failure as `supervisor.wake.failed` instead of letting it reach the process.
**Verification:** The focused wake tests first reproduced both failures, then passed with `pnpm exec vitest run tests/supervisor/wake.test.ts tests/supervisor/wake-schedule.test.ts`. The regression checks the exact superseded quota-resume race and a deliberately rejected detached wake executor.
**Prevention:** Every timer, callback, or other detached background entry point must terminate in an explicit rejection boundary. Expected cancellation and supersession outcomes must be handled at the workflow boundary as ownership changes, not reported as run failures.
**Skill/Doc Updates:** No general skill update was needed. The existing control-plane and lifecycle guidance already requires observable background work, explicit failure events, and successful handling of intentional stop or supersession outcomes; this note records the concrete OmniHarness failure mode.
