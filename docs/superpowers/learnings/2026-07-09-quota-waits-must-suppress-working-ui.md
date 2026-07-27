# Quota Waits Must Suppress Working UI

**Date:** 2026-07-09
**Context:** OmniHarness direct conversations, quota recovery, pending assistant UI.
**Symptom:** A direct conversation that hit a provider session limit was persisted as `quota_waiting`, but the transcript still showed the generic `Working...` indicator.
**Root Cause:** The server recorded the quota incident and scheduled wake correctly, but the direct-conversation UI did not render the recovery notice and the pending assistant classifier still trusted stale live worker state while the run status was `quota_waiting`.
**Fix:** Treat `quota_waiting` and `needs_recovery` as waiting states in the direct pending-status classifier, render the recovery notice in direct conversations, add Auto resume and Stop controls to quota waits, and let `stop_supervisor` cancel a `quota_waiting` run instead of returning `alreadyStopped`.
**Verification:** `pnpm test tests/app/direct-control-activity.test.ts`; `pnpm test tests/api/run-route.test.ts -- --runInBand`; `pnpm test tests/ui/conversation-actions.test.ts`; `pnpm typecheck`.
**Prevention:** When adding a recoverable runtime state, check both the server state transition and the UI classifier that decides whether the transcript is active, waiting, terminal, or recoverable. Stop controls must be backed by an endpoint branch that actually changes the persisted state.
**Skill/Doc Updates:** No general skill update needed; this is a project-specific recovery-state invariant already covered by the control-plane and client/server state guidance.
