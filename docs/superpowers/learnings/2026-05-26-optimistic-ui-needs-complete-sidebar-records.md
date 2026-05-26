# Optimistic UI Needs Complete Sidebar Records

**Date:** 2026-05-26
**Context:** OmniHarness home UI conversation creation and busy-message queue state.
**Symptom:** Creating a session could make the session list disappear while the new run loaded, and editing a queued steer message could put the text in the composer while the stale queued row remained visible.
**Root Cause:** The client selected a reserved run id before it had a complete local sidebar record, including the plan row required by `buildConversationGroups`. Separately, queued-message edits depended on a delayed server cancel before removing the item locally, so stale event snapshots could keep reintroducing it.
**Fix:** Create a complete optimistic conversation snapshot before selecting the new route, including an optimistic plan and run, then replace that optimistic plan when the server row arrives. Track locally hidden queued-message ids in `BusyMessageQueueManager`, filter stale snapshots through that tombstone set, and restore the queued row only if the cancel mutation fails.
**Verification:** `pnpm vitest run tests/app/busy-message-queue-manager.test.ts tests/app/home-utils.test.ts tests/app/event-stream-state-manager.test.ts`; targeted `pnpm vitest run tests/app/busy-message-queue-manager.test.ts tests/app/home-utils.test.ts tests/ui/conversation-actions.test.ts -t "editing or cancelling a queued message|send queued now hides accepted direct messages|optimistic created conversation|locally hidden queued messages"`.
**Prevention:** Any optimistic object used by a visible list must satisfy the same join requirements as server data. Any local edit/delete that changes the composer must update the queue manager synchronously and protect that local decision from stale snapshots.
**Skill/Doc Updates:** No shared skill update needed; the existing client/server state invariant guidance already covers ownership tokens, partial snapshots, optimistic objects, and stale-response tests.
