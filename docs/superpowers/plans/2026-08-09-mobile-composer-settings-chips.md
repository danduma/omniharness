# Mobile Composer Settings Chips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the active mobile composer configuration as one unlabeled model-settings summary chip, keep the branch chip in its prior mobile-rail position, and open the existing settings dialog from the summary chip.

**Architecture:** Add a focused `MobileComposerSettings` presentation component that composes the existing branch control, one summary chip, and the existing bottom-sheet controls. Keep selection and dialog-open state in manager-owned composer state; the component owns no application state.

**Tech Stack:** React 19, TypeScript, Tailwind utility classes, existing shadcn/ui Button primitives, native `<select>` controls, Vitest.

**North Star Product:** OmniHarness makes every consequential run configuration visible and understandable at the moment a builder is about to send work, across desktop and mobile.

**Current Milestone:** Mobile users can see the active CLI, model, effort, account, and (for new conversations) branch/workspace above the composer, with the existing settings dialog available from one summary chip.

**Future Product Direction:** Continue making run configuration and runtime status progressively more legible without duplicating state or forcing users into modal surfaces.

**Final Functionality Standard:** The mobile composer exposes real current values and real existing callbacks end-to-end, supports locked and narrow layouts, preserves desktop behavior, and is covered by deterministic regression checks plus type/build verification.

---

## File map

Create:

- `src/components/composer/MobileComposerSettings.tsx` — mobile branch/summary rail, existing bottom-sheet controls, and pure descriptor wiring helper; owns no application state.
- `docs/superpowers/specs/2026-08-09-mobile-composer-settings-chips-design.md` — approved design record.
- `docs/superpowers/plans/2026-08-09-mobile-composer-settings-chips.md` — this execution plan.

Modify:

- `src/components/home/ConversationComposer.tsx` — wire manager-owned mobile sheet state, render the mobile rail, and preserve the desktop branch placement.
- `src/components/composer/ComposerSelect.tsx` — accept an optional styling class for bounded mobile chip values without changing selection semantics.
- `src/components/composer/ComposerModelPicker.tsx` — accept the same optional styling hook.
- `tests/ui/composer-shell.test.ts` — add failing-then-passing source assertions and include the new component source in the existing source fixture.
- `tests/ui/mobile-composer-settings.test.tsx` — render the actual component to static markup and assert the single unlabeled summary, branch placement, dialog wiring, and descriptor callbacks.

Tests to add/update:

- Static-render behavior assertions and pure descriptor callback tests in `tests/ui/mobile-composer-settings.test.tsx` plus focused source-level assertions in `tests/ui/composer-shell.test.ts`; no mocks or fake product controls.

Integrations and state paths:

- `selectedCliAgent`, `selectedWorkerAccountId`, `selectedModel`, and `selectedEffort` flow from `HomeUiStateManager` through `ComposerContainer` into the new presentation component.
- `BranchWorkspaceButton` continues to call `gitWorkspaceManager` for new-conversation workspace changes.
- No API, database, SSE, worker, event, or persistence changes.

Client/server invariants:

- Owner remains the client’s manager-backed composer selection state; workspace status remains the git workspace manager snapshot.
- No new async response, owner token, snapshot merge, or ordering behavior is introduced.
- The component renders the latest props only and never treats translated UI labels as authoritative data.

## Execution tasks

### 1. Add the regression test first

- [ ] Extend `tests/ui/composer-shell.test.ts` to read `MobileComposerSettings.tsx`.
- [ ] Add assertions that new conversations include the branch/workspace chip while existing conversations keep the single summary chip; also assert the `relative` positioning context, `bottom-full`, `max-w-full`, `min-w-0`, `flex-wrap`, mobile-only rail visibility, desktop branch/selector visibility, existing `onChange` callback wiring, and controlled `mobileSettingsOpen`/sheet markup.
- [ ] Export a pure descriptor helper from `MobileComposerSettings.tsx` for the existing dialog controls, and test each selectable descriptor’s callback, locked CLI non-interactivity, Auto-account-only summary, gateway-account summary, and disabled/submitting props without introducing mirrored state.
- [ ] Create `tests/ui/mobile-composer-settings.test.tsx` using `renderToStaticMarkup` and assert the single unlabeled CLI/model/effort/account summary, branch visibility, settings-chip accessibility, dialog source wiring, and existing-conversation variants.
- [ ] Run `pnpm exec vitest run tests/ui/composer-shell.test.ts tests/ui/mobile-composer-settings.test.tsx` and confirm it fails because the new component and behavior do not exist yet.

### 2. Implement the mobile chip presentation

- [ ] Create `MobileComposerSettings.tsx` with an upward-anchored, wrapping rail.
- [ ] Render branch/workspace only when there is no selected run, then render one summary chip containing CLI, model, effort, and account in that order.
- [ ] Use the existing summary values without visible field labels; keep the settings chip accessible and make it open the existing bottom sheet.
- [ ] Preserve the dialog’s native keyboard/select behavior, existing titles/aria labels, focus rings, and current touch-target height.
- [ ] Call `useI18nSnapshot()` in the new translated component and reuse existing locale keys; add locale keys in every locale only if implementation discovers a missing visible label.
- [ ] Keep the rail width-bounded and bottom-anchored with explicit constraints on non-focusable value containers so wrapped rows grow upward without obscuring the input shell or viewport or clipping focus rings.

### 3. Integrate and remove the redundant mobile settings surface

- [ ] Wire the new rail into `ConversationComposer`.
- [ ] Keep the desktop branch chip in its current location and desktop selectors unchanged.
- [ ] Restore the controlled mobile settings manager state and bottom sheet behind the summary chip.
- [ ] Confirm the removed sheet contained no actions beyond the four selectors, and preserve the existing submit, stop, file-drop, branch, and desktop selector paths.
- [ ] Preserve the existing desktop and mobile submit/stop/file-drop behavior.

### 4. Verify the complete approved milestone

- [ ] Run `pnpm exec vitest run tests/ui/composer-shell.test.ts tests/ui/mobile-composer-settings.test.tsx` and confirm both focused tests pass.
- [ ] Run `pnpm test`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm build`.
- [ ] Inspect `git diff` and `git status --short`; report only this feature’s files as intentional additions/edits while preserving all pre-existing user changes.
- [ ] Do not run the approval-gated live agentic journey test without explicit user approval.
