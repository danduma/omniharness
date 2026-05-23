# Background Turn Cleanup Ownership

**Date:** 2026-05-20
**Context:** OmniHarness lifecycle harness and fire-and-forget direct/planning worker turns
**Symptom:** `pnpm test:lifecycle` could pass while stderr showed background `run-data/...jsonl` writes failing with `ENOENT` after the harness deleted its temporary `OMNIHARNESS_ROOT`.
**Root Cause:** Direct follow-ups and initial direct/planning turns intentionally run after the HTTP response returns, but those background promises were not registered anywhere. Test cleanup closed the server and removed the temp root without proving server-owned work was quiescent.
**Fix:** Added explicit background conversation task tracking in `worker-turn-gate`, registered fire-and-forget direct/planning turns, and made the lifecycle harness wait for tracked work before removing its temp root.
**Verification:** `pnpm vitest run tests/server/conversations/worker-turn-gate.test.ts tests/api/conversation-messages-route.test.ts tests/lifecycle/scenarios/session-types.test.ts tests/lifecycle/scenarios/conversation-continuation.test.ts tests/lifecycle/scenarios/flaky-network.test.ts`; `pnpm test:lifecycle`.
**Prevention:** Treat "test passed but async stderr appeared after cleanup" as a race, not noise. Cleanup must wait for owned background work or fail on timeout.
**Skill/Doc Updates:** Updated `docs/architecture/lifecycle-observability-and-testing.md` and `docs/architecture/timing-determinism-audit.md`; no general skill update needed because the project docs carry the harness-specific cleanup contract.
