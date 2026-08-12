# Durable Intent Needs Delivery Recovery

**Date:** 2026-08-10
**Context:** OmniHarness goal control plane, ACP commands, and named-event outbox
**Symptom:** A goal mutation could be durable while its ACP command or named event was never delivered. Concurrent requests could also let an older provider command finish after a newer durable revision.
**Root Cause:** The database transaction proved only that intent was committed. Provider dispatch happened later without a shared per-run ordering fence, idempotent replay skipped that dispatch entirely, and transient outbox backoff had no timer to wake it again.
**Fix:** Serialize provider commands per run, re-read canonical goal/session/revision state before every send, converge again when the row changes in flight, replay unsettled committed operations, recover unsettled controls at startup, and keep a bounded outbox retry pump alive until each eligible row publishes or becomes poisoned.
**Verification:** `pnpm exec vitest run tests/server/goal-control-dispatch.test.ts tests/server/goal-worker-reconciliation.test.ts tests/runtime-api/goals.test.ts tests/server/goal-outbox.test.ts`
**Prevention:** For every transaction followed by an external side effect, specify and test the crash boundary, ordering owner, durable delivery marker, retry wake-up mechanism, and stale-result fence. A committed row or stored idempotency result alone is not proof that the external system converged.
**Skill/Doc Updates:** Added the durable-intent delivery invariant to `docs/architecture/lifecycle-observability-and-testing.md`; no general skill update was needed because that document is the repository’s authoritative control-plane standard.
