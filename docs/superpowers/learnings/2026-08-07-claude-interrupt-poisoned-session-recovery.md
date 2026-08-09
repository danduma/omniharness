# Interrupting Claude Turns Must Recreate Poisoned ACP Sessions

**Date:** 2026-08-07

**Symptom:** Interrupting an active Claude Code turn to deliver a STEER message could leave the run with `[ede_diagnostic] result_type=user last_content_type=n/a stop_reason=null`. Retry, Resume worker, and sending `continue` kept reattaching the same provider session and failed again.

**Root cause:** Local turn cancellation correctly stopped the in-flight request, but Claude's ACP session could remain accepted and idle while no longer being able to produce the next user result. The earlier recovery change correctly stopped blind retries, but the direct retry and interrupt paths still treated that poisoned session as resumable.

**Fix:** Detect the incomplete ACP diagnostic at every direct ask boundary. Cancel the full worker runtime, start a fresh worker with the saved launch settings, replay the authoritative unified OmniHarness worker transcript, and retry the requested prompt once. If recovery still fails, persist a safe user-facing message instead of the provider's internal diagnostic. The common run-failure persistence boundary also sanitizes this diagnostic so other server paths cannot write it into the conversation UI.

**Prevention:** A provider session that emits an incomplete ACP diagnostic after an interrupted turn must be replaced, not retried in place. Regression coverage now exercises steer delivery, direct follow-up, and the Retry/Resume API action, and asserts a fresh session, transcript replay, no `run_failed` event on successful recovery, and no raw diagnostic in persisted user-visible errors.

**Verification:** The focused recovery tests, bridge tests, failure persistence tests, API run-route tests, and typecheck pass. The full lifecycle suite has one unrelated parallel-cleanup failure in `process-session-restart.test.ts`; that test passes in isolation.
