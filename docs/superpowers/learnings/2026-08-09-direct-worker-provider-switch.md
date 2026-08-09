# Direct continuation must reconcile provider identity

**Date:** 2026-08-09
**Context:** OmniHarness direct-control continuation and worker recovery
**Symptom:** Run `fe0978d3739f` reported `403 Account suspended` and could not be continued, even though the selected Codex account was healthy.
**Root Cause:** The run preference had been changed from Claude to Codex, but continuation selected the existing Claude worker row and reused its Claude ACP session. The persisted run preference and the live worker/provider identity diverged, so the error came from the wrong account path.
**Fix:** Before a direct follow-up, compare the selected worker type, model, effort, and credential allocation with the run preference. When they differ and the worker is switchable, cancel the stale runtime, recreate the worker from the unified transcript with the requested launch selection, update worker/account metadata, and send the replay prompt to the fresh session. Replacement failures now persist failed state and emit lifecycle/error events.
**Verification:** The focused regression passed, the full conversation-message route suite passed (35/35), ESLint passed on touched files, typecheck passed, and the real run was recovered with a fresh Codex session. The run reached `done` with no error; lifecycle events recorded the selection reconciliation and transcript recreation.
**Prevention:** Treat provider, model, effort, and credential account as one launch identity. Never reuse a persisted worker session after that identity changes; add a regression whenever continuation preferences can differ from the worker row.
**Skill/Doc Updates:** No general skill update was needed; the existing lifecycle observability and worker-stream architecture docs already define the required eventing and transcript boundary.
