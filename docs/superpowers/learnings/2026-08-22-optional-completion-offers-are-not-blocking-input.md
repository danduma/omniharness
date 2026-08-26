# Optional Completion Offers Are Not Blocking Input

**Date:** 2026-08-22
**Context:** OmniHarness direct-control conversation lifecycle, session `830b751e2667`
**Symptom:** A read conversation with no queued message, clarification, permission, or elicitation continued to show the warning triangle.
**Root Cause:** The worker's completed report ended with the optional offer “Want me to restart the runner?”. The direct-run classifier treated any idle worker message ending in `?` as blocking prose input, persisted the run as `awaiting_user`, and emitted `direct_worker_awaiting_user`. The sidebar correctly rendered that persisted lifecycle status independently of the conversation read marker.
**Fix:** Keep the prose-question fallback for explicit decisions, but classify explicit post-completion offers beginning with “Want me to…?”, “Do you want me to…?”, or “Would you like me to…?” as non-blocking so the direct run completes.
**Verification:** Added a regression fixture matching the session's streamed final chunk and a control for a genuinely blocking prose decision. `pnpm vitest run tests/conversations/direct-run-status.test.ts` first failed with `awaiting_user` for the optional offer, then passed all 11 tests after the classifier change.
**Prevention:** Do not equate terminal punctuation with lifecycle actionability. Preserve a positive control whenever narrowing prose input detection, and prefer live structured permissions or elicitations whenever the provider exposes them.
**Skill/Doc Updates:** No general skill update was needed. This is an OmniHarness-specific classifier rule, and `docs/architecture/lifecycle-observability-and-testing.md` already defines live structured permissions and elicitations as the authority for interactive actionability.
