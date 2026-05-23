# Composer Stop State Needs Run Ownership

**Date:** 2026-05-20
**Context:** OmniHarness composer, direct-control follow-ups, and stop controls
**Symptom:** After a session switch during a pending direct follow-up, the selected conversation could show the wrong busy/stop state. A working conversation could appear without a usable stop button, or a pending mutation from one run could disable controls in another run.
**Root Cause:** `sendConversationMessage.isPending`, `stopWorker.isPending`, and `stopSupervisor.isPending` were global mutation booleans. `HomeApp` used them while deriving state for whichever run was currently selected, without checking `mutation.variables.runId`.
**Fix:** Added run-owner helpers in `direct-control-activity.ts` and scoped pending send, queued-send, worker-stop, and supervisor-stop state to `selectedRunId` before deriving `pendingConversationWorkerId`, `isStopConversationPending`, and `isComposerSubmitting`.
**Verification:** `pnpm vitest run tests/app/direct-control-activity.test.ts tests/ui/composer-shell.test.ts tests/ui/sidebar-layout.test.ts`
**Prevention:** Any global mutation state used by selected-run UI must be guarded by the mutation's owner token before it can affect visible state or route actions.
**Skill/Doc Updates:** Updated `docs/architecture/timing-determinism-audit.md`; no general skill change needed because the existing client/server invariant already says async mutation results and pending state must prove ownership.
