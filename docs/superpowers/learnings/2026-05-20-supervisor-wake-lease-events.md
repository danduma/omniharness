# Supervisor Wake Lease Decisions Need First-Class Events

**Date:** 2026-05-20
**Context:** OmniHarness supervisor wake scheduling and lease coordination.
**Symptom:** The wake loop could report a generic `lease_blocked` skip, but the lease layer itself did not reveal whether it acquired a fresh lease, replaced an expired/malformed lease, lost an insert/update race, skipped release because of a wrong owner, or recovered an orphaned lease.
**Root Cause:** Observability stopped at the caller. The lower-level state machine owned the race-prone decision but returned only `leaseId | null`, forcing tests and operators to infer the reason from later behavior.
**Fix:** Added typed named events for wake lease acquired, blocked, released, release-skipped, and recovered decisions. Orphaned completion recovery now emits both its durable execution event and a named `supervisor.wake_lease_recovered` event.
**Verification:** `pnpm vitest run tests/supervisor/lease.test.ts tests/supervisor/wake.test.ts`
**Prevention:** If a helper owns a concurrency decision, the helper emits the decision. Higher-level callers may emit summaries, but they are not a substitute for the lower-level owner event.
**Skill/Doc Updates:** Updated `docs/architecture/timing-determinism-audit.md`; no shared skill update was needed because `instrumenting-control-planes` and the lifecycle observability doc already require named events for branch decisions.
