# Direct Elicitation State Must Use Request IDs

**Date:** 2026-06-25
**Context:** OmniHarness direct-control worker elicitations and run status.
**Symptom:** Session `279f067d7f7c` appeared to ask for input without showing a clear question, then bounced between working and not working after the user answered.
**Root Cause:** The UI and server treated historical `pending` elicitation rows as still blocking even after a later `answered` row for the same `requestId`. The direct-run status helper also re-derived `done` vs `running` from raw adapter state, which could override sync's reconciled `idle` status for final-looking direct turns.
**Fix:** Pending permission/elicitation checks now collapse rows by `type + requestId`, terminal statuses clear the pending signal, and direct-run status accepts the reconciled worker status. Live sync passes `nextWorkerStatus` after quiescing final-looking direct turns. The worker question popup also renders schema field descriptions so structured prompts are specific.
**Verification:** `pnpm vitest run tests/conversations/direct-run-status.test.ts tests/server/conversations-sync.test.ts tests/app/direct-control-activity.test.ts tests/app/conversation-execution-status.test.ts tests/app/worker-elicitations.test.ts` and `pnpm exec tsc --noEmit`.
**Prevention:** For append-only worker streams, never classify current blocking state by checking whether any historical pending row exists. Always fold by request id and let later terminal rows win. When a reconciler computes a post-processed worker state, downstream run-status writers must consume that reconciled state instead of raw bridge state.
**Skill/Doc Updates:** No global skill update needed; this is a project-specific control-plane invariant already covered by the lifecycle observability rules.
