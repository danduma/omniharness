# Direct Follow-Up After Stop Must Carry Submit-Time Intent

**Date:** 2026-06-23
**Context:** OmniHarness direct-control conversation recovery
**Symptom:** After a user stopped direct session `d55a06e08f08`, typing `continue` persisted a user message but no worker resumed and no new turn ran.
**Root Cause:** The direct follow-up path selected the only conversation worker even though it was already `cancelled`, appended the user input, and launched the background turn. `continueWorkerConversation` then re-read the worker, saw `cancelled`, and returned silently. That guard is correct for the race where a user stops an in-flight turn before the background ask starts, but it also blocked a deliberate follow-up submitted after the stop.
**Fix:** Direct sends now pass an explicit `allowCancelledWorkerResume` flag only when the selected worker was already cancelled at submit time. That lets the existing saved-session resume path reattach the direct worker for an intentional post-stop follow-up while preserving the cancellation race guard for turns that were stopped after submission.
**Verification:** `pnpm exec vitest run tests/api/conversation-messages-route.test.ts -t "resumes a stopped direct worker|automatically resumes a missing direct worker|keeps a direct worker cancelled"`; `pnpm exec vitest run tests/api/conversation-messages-route.test.ts`; `pnpm exec vitest run tests/api/run-route.test.ts -t "stop_worker|marks a direct worker cancelled without waiting|emits worker.status and worker.terminal named events when stop_worker cancels"`.
**Prevention:** When a lifecycle guard protects against races, preserve the submit-time state that disambiguates a stale background task from a new user action. Do not infer that distinction from the latest worker row alone.
**Skill/Doc Updates:** No general skill update needed; the repo lifecycle rules already require observable recovery decisions, and this note records the project-specific direct-control edge case.
