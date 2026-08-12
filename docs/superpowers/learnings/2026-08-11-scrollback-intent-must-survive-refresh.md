# Scroll-back Intent Must Survive Live Refreshes

**Date:** 2026-08-11
**Context:** Direct-control conversation history pagination
**Symptom:** A large active conversation showed only its newest page on mobile, and scrolling to the top appeared to do nothing.
**Root Cause:** The transcript managers use a single-flight request slot. When a periodic live refresh occupied that slot, `loadOlder()` returned the refresh promise and discarded the user's scroll-back intent instead of scheduling the older-page request.
**Fix:** Track whether an older-page load is already active. If a refresh is active, defer one older-page request until the refresh settles; repeated scroll events coalesce onto the same older-page request.
**Verification:** `pnpm exec vitest run tests/app/conversation-transcript-manager.test.ts tests/app/worker-entries-manager.test.ts`; `pnpm exec vitest run tests/ui/terminal-fit.test.ts tests/app/direct-worker-stream-loading.test.ts tests/app/conversation-transcript-manager.test.ts tests/app/worker-entries-manager.test.ts`; targeted ESLint; `pnpm typecheck`. The focused manager and scroll tests pass. The terminal-fit suite still has one unrelated pre-existing source-contract failure from other uncommitted `Terminal.tsx` changes.
**Prevention:** Treat user-initiated pagination as durable intent separate from background refresh single-flight state, and test scroll-back while refresh is unresolved.
**Skill/Doc Updates:** No general skill update was needed; the manager-level concurrency rule is captured here.
