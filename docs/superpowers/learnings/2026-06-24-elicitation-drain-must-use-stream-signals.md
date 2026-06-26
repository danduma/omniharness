# Elicitation Drain Must Use Stream Signals

**Date:** 2026-06-24
**Context:** OmniHarness direct conversations, worker elicitations, queued steering, and live session sync
**Symptom:** Session `68d1442869a0` showed `Working...` while the run was already `awaiting_user`; the user's queued correction stayed pending behind a worker row that still said `working`.
**Root Cause:** The direct-run status layer treated pending human input from structured worker output entries as authoritative, but the queue-drain gate only trusted `pendingElicitations`. A live snapshot with an open `elicitation` stream entry but no populated `pendingElicitations` array could mark the run input-ready while the queue drain still recorded `worker_not_drainable`.
**Fix:** Let the drain gate treat open `elicitation` output entries as pending elicitation signals, and let queued-message delivery answer an elicitation reconstructed from the stream entry when `pendingElicitations` is missing. Added a regression for an awaiting direct worker whose list snapshot only carries an open elicitation entry.
**Verification:** `pnpm vitest run tests/server/conversations-sync.test.ts tests/server/queued-messages.test.ts tests/conversations/direct-run-status.test.ts tests/app/direct-control-activity.test.ts tests/app/conversation-execution-status.test.ts tests/app/home-utils.test.ts`; `pnpm tsc --noEmit --pretty false`.
**Prevention:** Any state source that can mark a direct run `awaiting_user` must also be usable by queue delivery, or queued user intent can remain trapped behind stale active worker status. Keep the status predicate and delivery predicate symmetric for elicitations.
**Skill/Doc Updates:** No shared skill update needed; this is a project-specific invariant already captured in the lifecycle/control-plane notes and now in regression tests.
