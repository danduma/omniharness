# Named SSE Events Require End-to-End Registration

**Date:** 2026-08-10
**Context:** OmniHarness ACP plan widget and live event transport
**Symptom:** `LiveEventConnectionManager` contained handlers for `worker.plan_updated` and `worker.plan_boundary_started`, but emitting those event names through the legacy EventSource adapter never invoked the plan manager.
**Root Cause:** The event contract had been implemented at the server emitter and final manager only. The EventSource adapter did not subscribe to the two names, and the shared stream normalizer returned their bare payloads without preserving `kind`. Handler-level review therefore gave a false impression that the transport was complete.
**Fix:** Register both event names in `createLegacyLiveEventAPIs`, normalize them as typed runtime events, and test real adapter frames through `LiveEventConnectionManager` into `AcpPlanManager` wake-ups.
**Verification:** `pnpm vitest run tests/app/live-event-connection-manager.test.ts tests/app/acp-plan-manager.test.ts tests/app/acp-plan-widget-integration.test.ts`
**Prevention:** For every new named SSE event, verify four links together: server emission, EventSource subscription, stream normalization, and owner dispatch. A final-handler unit test is not sufficient.
**Skill/Doc Updates:** Added the end-to-end named-event delivery invariant to `docs/architecture/lifecycle-observability-and-testing.md`; no general skill update was needed because the repository architecture document is the authoritative local control-plane standard.
