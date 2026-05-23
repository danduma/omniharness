# Native Terminal Pending Scroll

**Date:** 2026-05-20
**Context:** OmniHarness direct-control conversation scroll behavior.
**Symptom:** A new direct session with only the initial user message and a `Thinking...` indicator could open scrolled into empty bottom space, leaving the pending indicator at the top and the real first message above the viewport.
**Root Cause:** The embedded native `Terminal` reused terminal-pane auto-scroll behavior against the outer conversation viewport. Combined with an artificial `min-h-[32rem]` on the direct conversation terminal, first-render and pending-only activity treated blank layout height as transcript content. A follow-up edge appeared because skipping a user-only first render still marked the terminal as first-positioned, so later-arriving worker entries could not perform the initial bottom jump.
**Fix:** Remove the direct chat terminal's artificial minimum height and gate native terminal auto-scroll so user-only and pending-only activity do not scroll the parent viewport. When that gate skips scrolling, leave first positioning open so a later real worker entry can still jump to the latest meaningful output.
**Verification:** `pnpm vitest run tests/ui/terminal-unified-stream-order.test.ts tests/ui/conversation-actions.test.ts`; `pnpm lint`; browser metric check against `http://localhost:3035/session/15ec1be9150c` without creating another persisted test session.
**Prevention:** Do not let embedded transcript components scroll their parent for pending states. Conversation scroll-follow should chase real transcript output, not component min-height, bottom padding, or composer clearance.
**Skill/Doc Updates:** No general skill update needed; `docs/architecture/state-staleness-and-session-lifecycle-lessons.md` and `docs/architecture/frontend-state-and-rendering.md` already record the project-level invariant that scroll affordances must mean content, not padding.
