# Terminal Runs Must Retire Stale Pending Messages

**Date:** 2026-05-24
**Context:** OmniHarness frontend event stream state, optimistic sent-message snapshots, conversation sidebar
**Symptom:** A completed direct session could show the sidebar spinner after switching away, even though persisted `runs.status` was `done` and the worker was `idle`.
**Root Cause:** `mergePendingSentConversationMessages` reapplied pending sent messages globally. When the selected-run snapshot changed, the completed run's messages were outside the scoped message payload, so an old pending message was not observed as delivered and `appendSentConversationMessageSnapshot` revived that run to `running`.
**Fix:** Pending sent messages now respect terminal server state. A terminal run only revives if the pending message is newer than the run's terminal `updatedAt`; older pending echoes are dropped instead of flipping the row back to `running`.
**Verification:** `pnpm exec vitest run tests/app/home-utils.test.ts --pool=forks --poolOptions.forks.singleFork=true`; `pnpm exec vitest run tests/app/event-stream-state-manager.test.ts tests/app/direct-control-activity.test.ts tests/app/home-view-model.test.ts tests/app/conversation-execution-status.test.ts --pool=forks --poolOptions.forks.singleFork=true`.
**Prevention:** When merging optimistic client state into scoped server snapshots, compare against authoritative run lifecycle timestamps before mutating run status. Scoped absence of a message is not proof that the server has not processed it.
**Skill/Doc Updates:** No shared skill update needed; this is a project-specific invariant already covered by the client/server state and event stream architecture guidance.
