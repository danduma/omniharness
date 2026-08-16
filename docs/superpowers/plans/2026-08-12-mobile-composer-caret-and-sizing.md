# Mobile Composer Caret and Sizing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve caret-following and touch scrolling for long mobile drafts, give the new-session mobile textarea a `50dvh` cap, and make its shell exactly as wide as the ongoing-session composer.

**Architecture:** Keep draft and cursor ownership in `HomeUiStateManager`. Move the DOM-only autosize sequence into a small tested helper, invoke it once after controlled renders with `useLayoutEffect`, and preserve the browser-managed internal scroll position. CSS remains the single source of truth for the existing pixel caps and the new mobile `50dvh` cap. Remove the extra empty-state width constraint so the shared composer form owns width in both states.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Vitest, Vite

**North Star Product:** OmniHarness mobile supervision preserves the control, context, and confidence of desktop supervision across touch, keyboard, paste, and voice input.

**Current Milestone:** Repair long-draft mobile interaction and new-session composer sizing without changing controls, persistence, or desktop behavior.

**Future Product Direction:** Real-device coverage can expand across iOS and Android dictation engines once an approval-gated device journey is available.

**Final Functionality Standard:** The real shared composer supports the requested interaction and responsive behavior end to end, with deterministic regression coverage and a production interface build.

---

## File map

- **Create:** `src/lib/composer-textarea.ts`, the authoritative DOM autosize helper over a minimal textarea-like interface. It measures content, lets CSS cap rendered height, and restores a clamped native scroll position when content overflows.
- **Create:** `tests/ui/composer-textarea.test.ts`, deterministic autosize tests with textarea-like elements for overflow preservation, scroll clamping after shrink, and non-overflow behavior.
- **Modify:** `src/components/home/ConversationComposer.tsx`, use the sizing helper, preserve internal scroll across autosize, and select responsive maximum-height classes.
- **Modify:** `src/interface/styles/globals.css`, declare vertical touch panning, contained overscroll, and momentum scrolling for the existing composer input.
- **Modify:** `src/components/home/ConversationMain.tsx`, let the shared composer own empty-state width while keeping the heading independently padded. The file is already above 1,200 lines; this plan makes one surgical replacement without increasing its line count. A general split is outside this focused fix.
- **Modify:** `tests/ui/composer-shell.test.ts`, assert integration markers for scroll preservation, touch behavior, responsive cap, and identical width ownership.
- **Modify:** `tests/interface/pwa-playwright.test.ts`, exercise the built React composer in Chromium, including controlled corrections, computed responsive/touch styles, and equal new-session versus ongoing-session shell widths.
- **Existing unrelated changes:** Preserve all current `docs/codex-history/**` modifications and untracked files.
- **Git hygiene:** Existing `.gitignore` covers project artifacts; do not add generated build output or test artifacts.
- **Agentic journey candidate:** On a phone, dictate more than five lines, allow the dictation engine to revise prior words, drag-scroll the text, and compare new versus ongoing composer width. Running this requires separate explicit approval and is not included here.

## State and product completeness

- The high-churn draft and cursor remain narrowly subscribed through `HomeUiStateManager`; no local React state or parallel data structure is added.
- No setting is introduced, so no load, save, reset, migration, or cross-device persistence behavior changes.
- The draft remains recoverable through the existing Manager-owned flow.
- No server state, async ownership, event ordering, lifecycle transition, or named event is touched.
- No new user-facing copy is introduced, so locale resources do not change.

## Tasks

- [x] Add `tests/ui/composer-textarea.test.ts` with failing cases that expect an overflowing textarea-like element to retain its native `scrollTop`, expect restoration to clamp after content shrinks, and expect non-overflow content to keep its natural measured height.
- [x] Update `tests/ui/composer-shell.test.ts` and `tests/ui/sidebar-layout.test.ts` with failing integration assertions for `useLayoutEffect`, removal of the zero-height measurement, permanent `overflow-y-auto`, `max-h-[50dvh] sm:max-h-[120px]` only for a new session, unchanged ongoing caps, the three scoped mobile touch declarations, removal of the empty-state ancestor width constraint, and independent heading padding.
- [x] Run the focused tests and confirm failures point to the missing helper and interaction/layout behavior.
- [x] Create `src/lib/composer-textarea.ts`. Capture `scrollTop`, set height to `auto`, read `scrollHeight`, set height to the measured pixel value, compare content height with the rendered `clientHeight`, and restore `Math.min(previousScrollTop, Math.max(0, scrollHeight - clientHeight))` only while overflowing.
- [x] In `src/components/home/ConversationComposer.tsx`, replace the local resize function and `useEffect` with the helper and one `useLayoutEffect` keyed by content/attachments. Remove the synchronous resize call from `onChange` so the post-render path is authoritative.
- [x] In `src/components/home/ConversationComposer.tsx`, keep `overflow-y-auto` permanent, select `max-h-[50dvh] sm:max-h-[120px]` for a new session, and preserve `max-h-[100px] sm:max-h-[120px]` for ongoing sessions. Permanent automatic overflow makes CSS cap reductions scrollable even when content does not change.
- [x] In `src/interface/styles/globals.css`, scope `touch-action: pan-y`, `overscroll-behavior-y: contain`, and `-webkit-overflow-scrolling: touch` to `.omni-composer-input` below `640px`.
- [x] In `src/components/home/ConversationMain.tsx`, remove the empty-state wrapper's `mx-auto`, `max-w-3xl`, and `px-6`; add independent constraints to the welcome heading and empty-state errors so the shared composer form controls both input widths without stretching other content.
- [x] Add a deterministic Chromium regression against the built app. Prove it fails with the old zero-height and padded-wrapper behavior, then passes with the fix while comparing new and ongoing shell widths.
- [x] Run `pnpm vitest run tests/ui/composer-textarea.test.ts tests/ui/composer-shell.test.ts tests/ui/sidebar-layout.test.ts tests/interface/pwa-playwright.test.ts`; confirm all 74 tests pass.
- [x] Run `pnpm typecheck`; confirm all TypeScript projects pass.
- [x] Inspect the diff for unrelated changes and requirement coverage.
- [x] Run `pnpm build:interface:web` and confirm a successful production interface build.
- [x] Record that real-device speech correction and one-finger scrolling were not run and remain residual interaction verification risk.

## Acceptance checklist

- [x] Input corrections preserve the native caret-following scroll position.
- [x] Overflowing mobile textarea accepts vertical drag scrolling.
- [x] New-session and ongoing composer widths are controlled by the same shared form.
- [x] New-session mobile cap is half the dynamic viewport height.
- [x] Ongoing mobile and desktop caps remain unchanged.
- [x] Existing composer features and Manager ownership are unchanged.
- [x] Focused unit, integration, browser, typecheck, and required interface build verification pass.
