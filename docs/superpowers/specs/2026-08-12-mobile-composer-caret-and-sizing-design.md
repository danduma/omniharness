# Mobile Composer Caret and Sizing Design

## Goal

Make long mobile dictation drafts remain controllable: the textarea follows the browser-managed caret during speech-to-text corrections, supports one-finger vertical scrolling, and gives the new-session composer the same horizontal width as the composer in an ongoing session. On mobile, the new-session textarea may grow to half of the dynamic viewport height.

## Product context

- **First user:** A developer supervising OmniHarness from a phone and entering substantial prompts through voice dictation.
- **Core job:** Compose and revise a long prompt without losing the caret or fighting the textarea's scroll position.
- **Supporting jobs:** Manually scroll within a long draft, paste or reposition the caret, and begin a new session with enough writing space.
- **State model:** The existing Manager-owned draft, cursor, attachments, and selected-run state remain the source of truth. This change adds no persisted state.
- **Trust surface:** Draft text, selection, and scroll context must not appear lost during an input correction.
- **North star:** Mobile supervision should preserve the same control and confidence as desktop supervision, adapted to touch and voice input.
- **Current milestone:** Repair composer scrolling and align new-session mobile sizing without redesigning controls or changing desktop behavior.

## Root cause

`resizeComposerTextarea` currently sets the textarea height to `0px` on every input and again after the controlled value renders. That measurement step resets the textarea's internal scroll position. Speech-to-text corrections repeatedly exercise this path once the content exceeds the five-line height cap, leaving the visible text at the top instead of where the browser placed the caret.

The overflowing textarea also has no explicit mobile vertical-pan behavior. Its overflow mode is switched inline, but touch intent is not declared for the nested scrolling surface.

## Approved design

### Caret-following autosize

Use one authoritative post-render autosize in `useLayoutEffect`. Before measuring, capture the textarea's current `scrollTop`. Set height to `auto`, read `scrollHeight`, then set the inline height to that content height. The responsive CSS `max-height` remains the single source of truth for the rendered cap. Keep `overflow-y: auto` permanent so a keyboard, browser-chrome, or orientation resize cannot leave newly overflowing content unscrollable without a React render. If content overflows the rendered `clientHeight`, restore the captured internal scroll position clamped to the new maximum scroll range. This preserves the browser's native caret-following decision made during the input event and avoids forcing every edit to the bottom, which would be wrong when the user places the caret earlier in the draft.

### Touch scrolling

Declare vertical touch panning, contained vertical overscroll, and momentum scrolling on the composer textarea. Native selection, dictation, copy, paste, and keyboard handling remain unchanged.

### New-session height

Keep the existing `100px` mobile and `120px` desktop CSS caps for ongoing sessions. A new-session composer uses `50dvh` below the existing `640px` breakpoint and the existing `120px` cap at and above it. JavaScript measures content only; CSS owns the cap so dynamic viewport, browser chrome, keyboard, and orientation changes remain browser-resolved.

### Matching width

Remove the empty-state wrapper's additional `max-w-3xl` and horizontal padding. The shared composer component and its existing `max-w-3xl` form then establish exactly the same width in new and ongoing sessions. Keep separate horizontal padding and a readable maximum width on the welcome heading.

## Boundaries

- No new controls, copy, translation keys, settings, or persistence.
- No changes to draft ownership or Manager subscriptions.
- No backend, lifecycle, event-stream, or observability changes.
- No branch or worktree.

## Acceptance criteria

- Long dictated input no longer jumps to the top when an input correction triggers autosizing.
- A user can vertically drag-scroll an overflowing textarea on mobile.
- New-session and ongoing-session composer shells have the same horizontal width at the same viewport width.
- The new-session mobile textarea grows with content up to `50dvh`, then scrolls internally.
- Ongoing-session mobile and all desktop textarea caps remain unchanged.
- Existing composer submission, mentions, attachments, settings, and draft persistence behavior remain intact.

## Verification

- Add deterministic regression tests that exercise the autosize helper against overflowing and shrinking textarea-like elements, including scroll preservation and clamping. Assert permanent automatic vertical overflow separately so viewport cap reductions remain scrollable without a content change.
- Add integration assertions for the responsive cap, mobile touch declarations, and both new-session and ongoing-session width ancestor paths.
- Add an isolated Chromium regression against the built React app that exercises the controlled input/layout-effect cycle, computed mobile and desktop styles, and equal new-session versus ongoing-session shell widths.
- Run `pnpm vitest run tests/ui/composer-textarea.test.ts tests/ui/composer-shell.test.ts tests/ui/sidebar-layout.test.ts tests/interface/pwa-playwright.test.ts`.
- Run `pnpm typecheck`.
- Run `pnpm build:interface:web`, required after frontend changes.
- A real-device iOS or Android dictation journey would be the strongest final interaction proof, but no device run is available in this implementation. Agentic user-journey testing is approval-gated and is not part of this run, so real dictation remains a stated residual verification risk.
