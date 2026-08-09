# Automatic Recovery Must Claim Provider Resumes

**Date:** 2026-08-06
**Context:** OmniHarness direct-control Claude quota/session recovery
**Symptom:** A direct conversation received an ACP `[ede_diagnostic]` error while resuming a Claude session. Automatic recovery reattached the same provider session multiple times, then surfaced a generic failed run even though the user never retried.
**Root Cause:** The ACP diagnostic was classified as transient because it arrived through HTTP 500. Recovery incident rows were read without an atomic claim, so concurrent wake paths could all resume the same provider session. A non-quota resume failure was also allowed to escape into the supervisor wake failure path instead of becoming a terminal `needs_recovery` state.
**Fix:** Classify `[ede_diagnostic]` results as non-retryable; atomically claim recovery incidents before external reattachment, with stale-claim recovery after a runner crash; and transition non-transient resume failures to `needs_recovery`, `worker.status=error`, `recovery_needs_user`, and a durable execution event.
**Verification:** Focused retry, bridge-client, and quota-resume suites pass (47 tests); recovery reconciler, recovery event, wake, and wake-schedule suites pass (43 tests); all four configured TypeScript checks pass directly. The package wrapper could not verify its pinned pnpm release because registry signature fetches failed.
**Prevention:** Every automatic external resume must have a persisted ownership claim and a terminal failure path. HTTP status alone must not determine retryability for provider protocol errors; classify the structured diagnostic first.
**Skill/Doc Updates:** No general skill update was needed; the existing lifecycle observability document already requires named recovery decisions, terminal recovery events, and no silent retry loops.
