# Worker and Account Selection Is Compound State

**Date:** 2026-07-09
**Context:** OmniHarness composer account selection and conversation creation
**Symptom:** Switching the composer from Claude to OpenCode displayed automatic account selection but still submitted `claude-sub-1`, producing an account compatibility error and leaving a ghost run in `running`/`starting` state.
**Root Cause:** The UI derived a compatible account only for the visible control and prewarm request. Conversation mutations closed over the raw account field, whose value still belonged to the previous worker type. The server validated the account only after persisting the plan, run, and worker.
**Fix:** A single compatibility resolver now supplies the effective account to the visible composer, prewarm, and all conversation mutations. The server validates explicit account compatibility before creating plan/run/worker records, returns the `RuntimeHttpError` status code, and emits `error.surfaced(account.invalid_explicit)` for rejected requests.
**Verification:** The account resolver regression fails on Claude-account/OpenCode-worker input before the fix and passes afterward. The conversation route regression proves the server returns 400, emits the named error, and persists no run or worker for an incompatible explicit account.
**Prevention:** Model worker type and account as one compound selection. Any worker-type transition must recompute the effective account, and every consumer must use that same derived value. Validate user-controlled foreign selections before creating durable workflow state.
**Skill/Doc Updates:** The lifecycle architecture document now states the compound-selection and pre-persistence validation invariant. Existing client/server state and control-plane skills already require a single owner, explicit provenance, and observable refusals, so no general skill update was needed.
