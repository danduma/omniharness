# Steer Delivery Must Not Revive Queued Intent

**Date:** 2026-06-26
**Context:** OmniHarness direct/implementation conversations, queued messages, forced steer delivery, worker elicitations, unified worker stream
**Symptom:** A user answer appeared twice: once as the accepted direct answer, then again from an older queued row. The older row could disappear, reappear as queued/delivering, be force-sent, and leave duplicate transcript entries after failing with `no_pending_elicitations`.
**Root Cause:** Pending queued intent and delivered worker-stream input had separate ownership. Direct elicitation answers did not retire equivalent queued rows, and queued elicitation drains appended `user_input`/`messages` before the ACP runtime confirmed the elicitation was still pending. Separately, `busyAction: "steer"` could still mean "create a pending queue row" instead of force-delivering.
**Fix:** Direct elicitation answers now cancel matching pending/delivering queued rows. Queued elicitation drains append transcript entries only after `respondElicitation` succeeds. Busy direct/supervised `steer` submissions now route through interrupt delivery instead of parking as visible queued work, and the frontend hides that internal delivery handle.
**Verification:** Focused regressions passed for direct-answer queue retirement, stale elicitation snapshots, busy force-steer delivery, busy-message queue manager behavior, and `tsc --noEmit`.
**Prevention:** Treat queued rows as pending intent only. Once an input is accepted into the worker transcript, any equivalent queued intent must be settled, and no queued path may append durable transcript content until the runtime accepts the delivery boundary.
**Skill/Doc Updates:** No global skill update needed; the project already has worker stream and lifecycle docs. This note adds the concrete queue/steer ownership lesson.
