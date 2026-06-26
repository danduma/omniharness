# Session Selection Must Not Clear Restored Composer Drafts

**Date:** 2026-06-25
**Context:** OmniHarness React home composer draft state
**Symptom:** Draft text typed into one session disappeared after switching to another session and returning.
**Root Cause:** `HomeUiStateManager.selectRun()` already saves the current composer draft under the previous run id and restores the next run's saved draft, but `handleSelectRun()` immediately called `setCommand("")`, `setCommandCursor(0)`, and `clearAttachments()` after selecting the run. Those later writes clobbered the restored draft and could cause the saved draft to be deleted on a subsequent switch because the live composer looked empty.
**Fix:** Removed the post-selection composer clearing calls from `handleSelectRun()` so run selection relies on the manager's atomic save-and-restore transition.
**Verification:** `pnpm test tests/ui/composer-shell.test.ts tests/app/home-ui-state-manager.test.ts` passed with 22 tests.
**Prevention:** Treat `selectRun()` as the owner of per-session composer draft transitions. Do not add separate command, cursor, mention, or attachment clearing after selecting an existing run; add explicit tests if a new action needs destructive draft behavior.
**Skill/Doc Updates:** No shared skill update needed; this is a project-specific state ownership lesson already covered by the React manager and client-state invariants guidance.
