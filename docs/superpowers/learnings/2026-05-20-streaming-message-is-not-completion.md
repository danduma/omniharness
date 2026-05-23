# Streaming Message Is Not Completion

**Date:** 2026-05-20
**Context:** OmniHarness direct conversations and worker stream sync
**Symptom:** A direct session showed only `I’ll trace the co-p` as the worker reply, accepted a follow-up as if the worker was idle, then later revealed minutes of output after reload.
**Root Cause:** Direct-run sync treated any live assistant `message` entry with no open tool call as a completed turn. Streaming agents create a `message` entry on the first token chunk, so a partial chunk could mark the run `done`. Once terminal, selected-run sync skipped later live output and left stale `currentText` / `lastText` in the worker row.
**Fix:** A still-active live worker can only be quiesced from completion evidence when it has an explicit stop reason or a long final-looking fallback text. Short streaming chunks keep the run `running`. Selected terminal direct runs with a live worker are synced instead of skipped so reload does not freeze on stale persisted text.
**Verification:** `pnpm vitest run tests/server/conversations-sync.test.ts tests/api/conversation-load-coverage.test.ts`; `pnpm vitest run tests/server/conversations-sync.test.ts`; `pnpm exec tsc --noEmit`; `bunx biome check src/server/conversations/sync.ts tests/server/conversations-sync.test.ts`.
**Prevention:** Do not infer lifecycle completion from the existence of assistant text. Completion requires a terminal runtime state, explicit stop reason, or a conservative fallback with tests proving partial chunks remain active.
**Skill/Doc Updates:** No shared skill update needed; this is a project-specific control-plane invariant already covered by the lifecycle observability docs.
