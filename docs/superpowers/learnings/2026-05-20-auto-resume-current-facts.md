# Auto Resume Timers Need Current Facts At Fire Time

**Date:** 2026-05-20
**Context:** OmniHarness failed-run auto-resume, frontend timer ownership, recovery control plane
**Symptom:** Auto-resume timers were cancelled when the selected run changed and checked the failure key, but the delayed callback did not re-prove all retry preconditions. A timer scheduled while recovery looked safe could still fire after the selected checkpoint changed, the run stopped being failed, worker availability changed, a worker-failure detail appeared, or recovery was already pending.
**Root Cause:** The timer entry stored too little owner state, and the callback relied on stale closure context plus only a narrow helper check. The async owner was "this exact failed run at this exact checkpoint under these recovery preconditions," not just `runId + failureKey`.
**Fix:** Auto-resume timer entries now store `failureKey` and `targetMessageId`. `HomeApp` maintains current runtime facts for the selected run, selected status, checkpoint, worker availability, worker-failure detail, and pending recovery state. The timer callback must pass all those facts through `shouldFireAutoResumeTimer()` before calling `recoverRun.mutate()`.
**Verification:** Added failing coverage in `tests/app/auto-resume-selection.test.ts`, then passed `pnpm vitest run tests/app/auto-resume-selection.test.ts tests/ui/conversation-actions.test.ts` with 37 tests passing.
**Prevention:** Any delayed control-plane action must re-read current facts at fire time. Cancelling timers on navigation is useful but insufficient; the callback still needs a complete owner token and current precondition check.
**Skill/Doc Updates:** Updated `docs/architecture/timing-determinism-audit.md` with the resolved auto-resume invariant. No global skill update was needed because the existing client/server state invariant already requires timer callbacks to re-check ownership before acting.
