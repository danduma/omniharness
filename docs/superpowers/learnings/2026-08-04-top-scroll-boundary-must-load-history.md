# Top Scroll Boundary Must Load History

**Date:** 2026-08-04
**Context:** OmniHarness paged worker conversation transcripts
**Symptom:** Run `f3987ae9caa2` appeared to begin with Fable's final answer. The opening prompts existed at worker-stream sequences 1 and 379, but scrolling upward from the displayed top never revealed them.
**Root Cause:** The initial 100-row tail page covered sequences 651–750 and was dominated by 60 revisions of one assistant message. The server correctly returned `hasOlder: true`, but the UI requested the preceding page only from a `scroll` event. At `scrollTop = 0`, an upward wheel or trackpad gesture cannot move the viewport, so no `scroll` event was emitted and pagination never ran.
**Fix:** Listen for upward wheel gestures on the actual scroll-owning viewport and call the existing older-history loader when the viewport is already at the top.
**Verification:** `pnpm vitest run tests/ui/terminal-fit.test.ts tests/ui/terminal-paged-history-user-message-order.test.ts tests/app/conversation-transcript-manager.test.ts tests/app/worker-entries-manager.test.ts` passed 60 tests; `pnpm build` completed successfully.
**Prevention:** Infinite-scroll boundaries must respond to user intent even when the scroll offset cannot change. Test the boundary gesture as well as ordinary `scroll` events.
**Skill/Doc Updates:** Updated `docs/architecture/worker-conversation-stream.md`; no general Codex skill update was needed because this is an OmniHarness transcript-pagination rule.
