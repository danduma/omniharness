# The Runtime Owns Actionable Human Input

**Date:** 2026-08-04
**Context:** OmniHarness worker recovery, ACP elicitation and permission controls, unified worker stream
**Symptom:** After a runner restart, the conversation showed two nearly identical question forms. The user could answer both, but the form created before the crash no longer had a live worker promise to receive its answer.
**Root Cause:** The UI merged the runtime's live pending requests with historical `pending` rows from the append-only worker stream. Recovery restored the provider session but did not close stream requests that the new runtime instance no longer owned. A durable record of a past request was therefore mistaken for proof that the request was still actionable.
**Fix:** Recovery and every worker reattach/recreate path now compare open stream requests with the runtime's authoritative pending request ids, append terminal `cancelled` entries for orphans, and emit `worker.human_input_reconciled`. Conversation and worker-card forms now render only runtime-confirmed requests.
**Verification:** The regression was observed failing first in `tests/server/runs/recovery-reconciler.test.ts` and `tests/lifecycle/scenarios/worker-reattach.test.ts`, then passing after the fix. The UI ownership guard is covered by `tests/ui/conversation-actions.test.ts`.
**Prevention:** Treat the worker stream as append-only history, not current ownership. Any response control must be backed by a live runtime pending request. Every recovery boundary must reconcile historical open requests before announcing that the worker is recovered.
**Skill/Doc Updates:** Updated `docs/architecture/lifecycle-observability-and-testing.md` with the actionability ownership rule. No global skill change was needed because the existing client/server-state and control-plane skills already require explicit ownership and freshness; this bug violated those rules locally.
