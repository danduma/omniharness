# Worker Failover Selection Errors Must Survive Parking

**Date:** 2026-05-20
**Context:** OmniHarness supervisor worker failover.
**Symptom:** A failed replacement-worker availability check could collapse into a generic no-replacement/quota-wait result.
**Root Cause:** Parking a run for quota wait is a valid terminal action, but if the replacement selection failure detail is not emitted before parking, the user and tests cannot tell quota exhaustion from an availability subsystem failure.
**Fix:** The failover path records selection exceptions as `worker_failover_failed` execution events and `worker.failover_failed` named events with `stage: "selection"`, and returns a reason that names the availability-check failure.
**Verification:** Ran `pnpm vitest run tests/supervisor/worker-failover-no-replacement.test.ts tests/supervisor/worker-failover.test.ts tests/server/events/named-events.test.ts tests/lifecycle/scenarios/worker-failover/failover-transcript.test.ts`.
**Prevention:** When a recovery path parks or defers work, preserve the concrete failed decision as a typed event before returning the softer parked state.
**Skill/Doc Updates:** Updated `docs/architecture/timing-determinism-audit.md`; no general skill update needed because named server decisions are already required by the lifecycle observability docs.
