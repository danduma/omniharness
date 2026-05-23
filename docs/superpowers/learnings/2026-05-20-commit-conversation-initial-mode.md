# Commit Conversation Initial Mode

**Date:** 2026-05-20
**Context:** OmniHarness conversation/session classification and sidebar visuals.
**Symptom:** Project commit conversations were displayed as commit sessions based on posterior heuristics such as the title or initial message content. Normal sessions that mentioned "commit" could be misclassified, and even exact-message matching kept display state coupled to transcript content.
**Root Cause:** Commit was treated as a visual inference layered on top of `direct` mode instead of as an explicit conversation mode assigned when the session is created.
**Fix:** Add `commit` as a persisted run mode, have the project commit action create conversations with `mode: "commit"`, and make visual classification read only that initial mode. Commit mode keeps direct-worker execution behavior internally.
**Verification:** `pnpm test tests/lib/conversation-visuals.test.ts tests/api/conversations-route.test.ts`; `pnpm test tests/ui/conversation-actions.test.ts`; `pnpm test tests/api/conversation-messages-route.test.ts`; `pnpm test tests/server/conversations-sync.test.ts tests/server/worker-snapshot-initial-prompt.test.ts`; `pnpm test tests/server/runs/recovery-reconciler.test.ts tests/server/queued-messages.test.ts`; `pnpm exec eslint ...touched files...`; `git diff --check`.
**Prevention:** When a session needs distinct product behavior or visuals, persist a type/kind at creation time. Do not derive durable session identity from editable titles, transcript wording, or prompt text.
**Skill/Doc Updates:** No shared skill update needed; the repo-specific lesson captures a local state-model rule.
