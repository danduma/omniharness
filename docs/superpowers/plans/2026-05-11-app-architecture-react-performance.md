# App Architecture React Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve OmniHarness frontend structure, React correctness, i18n compliance, lint signal quality, and local rendering performance without changing product behavior.

**Architecture:** Keep the current Next.js app and manager-based state model, but reduce orchestration gravity in `HomeApp` by moving domain workflows into focused controller hooks and manager methods. Preserve centralized state ownership while narrowing React subscription boundaries so high-churn UI state does not repaint the whole app shell.

**Tech Stack:** Next.js 15 app router, React 19, TypeScript, TanStack Query, custom Manager classes, `useSyncExternalStore`, shadcn-style UI primitives, Vitest, Playwright, ESLint, shared JSON locale resources.

**North Star Product:** OmniHarness should feel like a reliable local control plane for agent work: fast to open, easy to inspect, clear about state, transparent about errors, and resilient under long-running conversations.

**Current Milestone:** Refactor the existing app shell and supporting checks so the current product behaves the same but is easier to maintain, less prone to React race conditions, cleaner under lint/build, and measurably faster in local development.

**Future Product Direction:** Once the shell is modular and measured, the app can add richer profiling, user journey automation, and a non-file-routed backend surface if the project decides to move away from Next route handlers.

**Final Functionality Standard:** The milestone is complete only when existing user journeys still work end-to-end, production build passes, targeted tests pass, lint has no app warnings, i18n hardcoded-string checks cover frontend copy, and measured local startup/warm-response baselines are documented.

---

## Scope Notes

- Do not create a branch.
- Do not create a worktree.
- Work in `/Users/masterman/NLP/omniharness`.
- Preserve existing user-facing behavior unless a task explicitly names a UI copy migration to i18n.
- Keep all new user-facing frontend strings in `shared/locales/*.json` and render with `t()`.
- Do not introduce file-based routing beyond the current Next route-handler structure. The plan includes a decision task for the existing rule mismatch instead of silently rewriting the backend.
- Do not send data around in transactions.
- Do not use `require()` in source or frontend tests.
- Use `pnpm` for scripts.

## Findings That Drive This Plan

- `src/app/home/HomeApp.tsx` is 2,120 lines and concentrates auth, settings, run actions, conversation actions, event-state derivation, layout, side window, and composer orchestration.
- `src/components/Terminal.tsx` is 1,466 lines and is close enough to the 1,200-line refactor threshold that continued feature work should split it.
- `src/server/supervisor/index.ts` is 1,350 lines, outside frontend scope but relevant to overall app structure.
- `src/app/home/HomeApp.tsx` uses a broad selected shell state from `HomeUiStateManager`; this is better than a whole-manager subscription, but still risks unnecessary shell renders.
- `pnpm lint` currently reports no errors but 106 warnings, most from `.agents/**`, plus app warnings in React hooks and unused symbols.
- `pnpm build` passes, compiles successfully in about 90s, and reports `/` at 157 kB route size and 319 kB first-load JS.
- Local dev route compilation is slow: after restart, first `/` and `/api/auth/session` responses were about 12s; warm `/api/auth/session` was about 0.86s TTFB and warm `/` was about 1.39s TTFB.
- The in-app browser could not open `http://localhost:3035` because the browser client reported `net::ERR_BLOCKED_BY_CLIENT`, so browser trace profiling needs a separate setup fix or alternate approved route.
- The repo has good tests: 125 test files and about 904 `describe`/`it`/`test` declarations.
- Existing React best-practices tests pass, but they do not catch all i18n copy violations or broad subscription boundaries.

## File Map

### Files To Create

- `docs/architecture/frontend-state-and-rendering.md`
  - Document manager ownership, subscription boundaries, high-churn state policy, and render-performance budgets.
- `docs/architecture/routing-decision.md`
  - Record the decision for the current `src/app/api/**/route.ts` structure versus the local "Never use file-based routing" instruction.
- `src/app/home/useHomeQueries.ts`
  - Own home-screen queries: auth session, settings, worker catalog, project files.
- `src/app/home/useHomeMutations.ts`
  - Own home-screen mutations and optimistic update wiring.
- `src/app/home/useHomeViewModel.ts`
  - Derive selected run, worker groups, timeline items, execution state, composer mode, current project scope, and sidebar groups from manager snapshots.
- `src/app/home/useHomeLayoutController.ts`
  - Own sidebar, mobile panel, side-window, and resize actions.
- `src/app/home/useComposerController.ts`
  - Own composer draft selection, mention filtering, submit behavior, and attachment interaction.
- `src/app/home/useConversationActions.ts`
  - Own rename, archive, delete, recover, fork, retry, queued-message, and commit-chat action handlers.
- `tests/ui/i18n-hardcoded-copy.test.ts`
  - Enforce no hardcoded user-facing JSX text, labels, titles, placeholders, and aria labels in frontend files except explicit allowlisted technical constants.
- `tests/app/home-view-model.test.ts`
  - Unit-test derived state extracted from `HomeApp`.
- `tests/app/home-controllers.test.ts`
  - Unit-test controller behavior for selection, layout, queue, and composer transitions.
- `tests/perf/local-dev-baseline.test.ts` or `scripts/measure-local-dev.mjs`
  - Provide repeatable local timing capture for app shell and core API routes. Choose script if Vitest timing is too environment-sensitive.

### Files To Modify

- `eslint.config.mjs`
  - Ignore `.agents/**` and generated/cache directories so lint output reflects app code.
- `src/app/home/HomeApp.tsx`
  - Reduce to composition and layout wiring. Target under 700 lines in this milestone.
- `src/app/home/HomeUiStateManager.ts`
  - Move action-oriented state transitions into manager methods where repeated setter choreography exists.
- `src/app/home/EventStreamStateManager.ts`
  - Keep current merge/cache behavior, add targeted tests for snapshot identity and listener churn where needed.
- `src/app/home/useHomeLifecycle.ts`
  - Fix hook dependencies or replace effect-driven state updates with explicit manager/controller methods.
- `src/app/home/useRunSelectionEffects.ts`
  - Fix hook dependencies and reduce effect coupling.
- `src/app/home/utils.ts`
  - Split large derivation helpers into narrower modules if extraction from `HomeApp` pushes it further past 1,200 lines.
- `src/components/Terminal.tsx`
  - Split into focused subcomponents or hooks if touched by i18n/performance tasks. Target clear ownership around tool groups, message editing, thoughts, and scroll/follow logic.
- `src/components/LoginShell.tsx`
- `src/components/BootShell.tsx`
- `src/components/PairDeviceDialog.tsx`
- `src/components/FolderPickerDialog.tsx`
- `src/components/FileAttachmentPickerDialog.tsx`
- `src/components/AttachmentImagePreviewDialog.tsx`
- `src/components/composer/ComposerModelPicker.tsx`
- `src/components/home/ConversationSidebar.tsx`
- `src/components/home/HomeHeader.tsx`
- `src/components/home/ConversationMain.tsx`
- `src/components/home/QueuedMessageDrawer.tsx`
- `src/components/home/UserInputMessage.tsx`
- `src/components/home/WorkersSidebar.tsx`
- `src/components/home/SideWindow.tsx`
  - Replace hardcoded user-facing copy with `t()` keys and add `useI18nSnapshot()` where language changes need repainting.
- `shared/locales/en.json`
- `shared/locales/de.json`
- `shared/locales/es.json`
- `shared/locales/fr.json`
- `shared/locales/it.json`
- `shared/locales/ja.json`
- `shared/locales/ko.json`
- `shared/locales/pt.json`
- `shared/locales/zh-CN.json`
  - Add matching keys for all migrated strings.
- `tests/ui/react-best-practices.test.ts`
  - Keep current useState/ref/import checks, add source exclusions that match lint policy if needed.
- `tests/lib/i18n.test.ts`
  - Preserve locale key parity checks.
- `tests/ui/page-shell.test.ts`
  - Update string expectations to assert translation keys or rendered translated output instead of hardcoded source snippets.
- `next.config.ts`
  - Review config only if route or performance measurements identify specific Next behavior to change.
- `package.json`
  - Add a script for local performance measurement if `scripts/measure-local-dev.mjs` is created.

### Tests To Update Or Add

- `tests/ui/i18n-hardcoded-copy.test.ts`
  - Fail on hardcoded visible JSX text, `aria-label`, `title`, `placeholder`, dialog titles, button labels, empty states, status labels, and help text.
- `tests/app/home-view-model.test.ts`
  - Cover selected run derivation, project scope, worker grouping, timeline generation, busy state, recovery state, and composer mode.
- `tests/app/home-controllers.test.ts`
  - Cover command submit, selected run changes, rename/archive/delete optimistic behavior, queued-message actions, and layout toggles.
- `tests/app/home-lifecycle.test.ts`
  - Extend coverage for fixed effect dependency behavior and route hydration.
- `tests/ui/sidebar-layout.test.ts`
  - Keep responsive/sidebar coverage after prop and controller extraction.
- `tests/ui/composer-shell.test.ts`
  - Keep composer behavior after `useComposerController` extraction.
- `tests/ui/conversation-actions.test.ts`
  - Keep action behavior after `useConversationActions` extraction.
- `tests/lib/i18n.test.ts`
  - Keep locale key parity.
- `tests/ui/react-best-practices.test.ts`
  - Add a narrow-subscription expectation where practical, such as banning `useManagerSnapshot(homeUiStateManager)` outside approved leaf components.
- `tests/perf/local-dev-baseline.test.ts` or `scripts/measure-local-dev.mjs`
  - Capture repeatable local startup, cold route, warm route, and key API timings.

### Candidate Agentic User Journey Tests

Running these requires explicit user approval before execution.

- **Authenticated app boot:** Start from `http://localhost:3035`, verify loading, login shell or authenticated shell, and visible app readiness.
- **Conversation selection:** Select a conversation from the sidebar, verify transcript, run status, worker side panel, and composer context.
- **Composer submit path:** Type a message, attach no files, submit, verify visible queued/sent/pending state without relying on canned responses.
- **Settings language switch:** Open settings, switch language, verify header/sidebar/composer/dialog copy updates without page reload.
- **Workspace side window:** Open a project file reference, verify side window opens on desktop and mobile-appropriate surface appears on narrow viewport.
- **Recovery/error visibility:** Simulate or use an existing failed run, verify detailed error and recovery affordances remain visible.

### Real Integrations And Data Paths

- Browser app shell: `src/app/page.tsx` renders `HomeApp`.
- Local app URLs: normal local app `http://localhost:3035`; compressed Next dev server usually `http://localhost:3050`.
- State managers: `HomeUiStateManager`, `EventStreamStateManager`, `BusyMessageQueueManager`, `SettingsDraftManager`, `AppearancePreferencesManager`, `SideWindowManager`, component-level managers.
- Persistent browser state: locale, appearance preferences, event stream snapshot cache, worker output line cache, sidebar widths, collapsed projects, read markers, composer selection.
- Server data: `sqlite.db` via `src/server/db`, runs/messages/workers/events/settings.
- Live updates: `src/app/api/events/route.ts` plus `src/server/events/live-updates.ts`.
- Agent runtime: bridge on `http://127.0.0.1:7800`.
- Settings API: `src/app/api/settings/route.ts`.
- Worker catalog API: `src/app/api/agents/catalog/route.ts`.
- File APIs: `src/app/api/fs/route.ts` and `src/app/api/fs/files/route.ts`.

### `.gitignore` Coverage

Current `.gitignore` exists. Before any implementation commit, verify it covers:

- `.env`, `.env.*` except intentionally versioned examples.
- `node_modules/`.
- `.next/`, `out/`, build artifacts.
- coverage output.
- logs and temporary files.
- local database/runtime artifacts such as `sqlite.db`, `.omniharness/`, auth keys, attachments, and test results, unless the user explicitly asks to version one.

## Implementation Tasks

### 1. Establish Measurement And Guardrails

- [ ] Run and record baseline commands:
  - `pnpm lint`
  - `pnpm build`
  - `pnpm vitest run tests/ui/react-best-practices.test.ts`
  - `pnpm vitest run tests/lib/i18n.test.ts tests/ui/page-shell.test.ts tests/app/event-stream-state-manager.test.ts tests/app/home-lifecycle.test.ts`
- [ ] Capture local timing baseline without starting duplicate servers:
  - Check listeners with `lsof -nP -iTCP:3035 -sTCP:LISTEN` and `lsof -nP -iTCP:3050 -sTCP:LISTEN`.
  - If no app is running, start `pnpm dev` only for measurement and stop it afterward.
  - Measure `/`, `/api/auth/session`, `/api/settings`, `/api/agents/catalog`, and `/api/events?snapshot=1&persisted=1` where auth/session state permits.
- [ ] Add `scripts/measure-local-dev.mjs` or a documented command block in `docs/architecture/frontend-state-and-rendering.md`.
- [ ] Acceptance criteria:
  - Baseline numbers are recorded with date, command, environment, and whether the response was cold or warm.
  - No duplicate dev server remains running after measurement.

### 2. Clean Lint Signal

- [ ] Update `eslint.config.mjs` to ignore `.agents/**` and any generated/cache directories not already ignored.
- [ ] Remove unused `isAfterLoadedOutput` from `src/lib/worker-terminal-messages.ts` or use it if it is intentionally needed.
- [ ] Fix unused `_params` warnings in `src/server/omni-acp/agent.ts` without weakening lint globally.
- [ ] Run `pnpm lint`.
- [ ] Acceptance criteria:
  - `pnpm lint` has zero errors.
  - App-source warnings are resolved.
  - Tooling/plugin warnings from `.agents/**` no longer appear.

### 3. Fix React Hook Dependency Warnings

- [ ] In `src/app/home/useHomeLifecycle.ts`, fix missing dependencies at the current warning lines by using stable manager methods, explicit callbacks, or complete dependency arrays.
- [ ] In `src/app/home/useRunSelectionEffects.ts`, fix missing dependencies for setter callbacks.
- [ ] Where adding dependencies causes loops, move the state transition into a manager/controller method instead of suppressing the warning.
- [ ] Add or extend tests in `tests/app/home-lifecycle.test.ts` for route hydration, theme hydration, runtime error capture, selected run hydration, and read marker persistence.
- [ ] Run:
  - `pnpm lint`
  - `pnpm vitest run tests/app/home-lifecycle.test.ts`
- [ ] Acceptance criteria:
  - No `react-hooks/exhaustive-deps` warnings remain in app source.
  - Tests cover the effect behavior that was changed.

### 4. Document And Enforce Frontend State Ownership

- [ ] Create `docs/architecture/frontend-state-and-rendering.md`.
- [ ] Document each shared manager and owned state:
  - `HomeUiStateManager`: shell UI state, selected run, composer selections, dialog visibility, layout widths, attachments.
  - `EventStreamStateManager`: live event snapshot, cached output entries, message/run/worker merge behavior.
  - `SettingsDraftManager`: unsaved settings draft and save payload.
  - `BusyMessageQueueManager`: queued message visibility and cancellation state.
  - `AppearancePreferencesManager`: text-size preferences and theme-adjacent preferences.
  - Component managers: only local component UI state.
- [ ] Define high-churn state rules:
  - Composer text, cursor, mention index, hover/open flags, search text, and resize state must use leaf-level selectors or dedicated managers.
  - Root app shell must not subscribe to draft text or per-pointer state.
- [ ] Update `tests/ui/react-best-practices.test.ts` to forbid broad `useManagerSnapshot(homeUiStateManager)` usage outside approved leaf containers.
- [ ] Run `pnpm vitest run tests/ui/react-best-practices.test.ts`.
- [ ] Acceptance criteria:
  - State ownership is documented.
  - Tests enforce the most important subscription boundary.

### 5. Extract Home Queries

- [ ] Create `src/app/home/useHomeQueries.ts`.
- [ ] Move these queries out of `HomeApp`:
  - auth session query.
  - settings query.
  - worker catalog query.
  - project files query.
- [ ] Keep query keys unchanged unless tests require a deliberate update.
- [ ] Keep error descriptors and `requestJson` metadata intact.
- [ ] Ensure settings hydration still updates `SettingsDraftManager`, `HomeUiStateManager`, and diagnostics exactly once per successful load.
- [ ] Add tests in `tests/app/home-controllers.test.ts` or existing query-adjacent tests for settings hydration behavior.
- [ ] Run:
  - `pnpm vitest run tests/api/settings-route.test.ts tests/ui/settings-dialog.test.ts tests/app/settings-draft-manager.test.ts`
- [ ] Acceptance criteria:
  - `HomeApp` no longer defines query functions inline.
  - Query behavior and error surfacing remain unchanged.

### 6. Extract Home Mutations And Conversation Actions

- [ ] Create `src/app/home/useHomeMutations.ts`.
- [ ] Create `src/app/home/useConversationActions.ts`.
- [ ] Move these mutations and handlers out of `HomeApp`:
  - login/logout/pair redeem.
  - save settings.
  - commit workflow setting save.
  - rename run.
  - delete/archive run.
  - recover/resume run.
  - run command.
  - send conversation message.
  - queued message cancel/send-now.
  - auto-commit chat/project.
  - stop supervisor/worker/terminal process.
  - promote planning conversation.
- [ ] Preserve optimistic updates and rollback state exactly.
- [ ] Move repeated setter choreography into `HomeUiStateManager` methods where it is a named UI transition, such as start new plan, begin conversation in project, cancel rename, clear editing state.
- [ ] Add tests:
  - `tests/app/home-controllers.test.ts`
  - update `tests/ui/conversation-actions.test.ts`
  - update `tests/api/run-route.test.ts` only if API contracts are touched.
- [ ] Run:
  - `pnpm vitest run tests/ui/conversation-actions.test.ts tests/api/run-route.test.ts tests/api/events-route.test.ts`
- [ ] Acceptance criteria:
  - `HomeApp` no longer owns mutation definitions.
  - Optimistic updates and rollback paths remain covered by tests.
  - No user-visible behavior changes.

### 7. Extract Home View Model

- [ ] Create `src/app/home/useHomeViewModel.ts`.
- [ ] Move pure derivations out of `HomeApp`, including:
  - explicit projects.
  - grouped and filtered projects.
  - selected run and selected mode.
  - allowed worker types.
  - auto-selected worker.
  - composer options.
  - selected run messages and transcript run ids.
  - selected workers and conversation agents.
  - worker groups and active agents.
  - latest checkpoint, execution events, interventions, recovery state.
  - conversation failure descriptor.
  - visible messages and timeline items.
  - current project scope and active conversation cwd.
  - busy/stoppable/thinking state.
- [ ] Prefer pure helper functions that can be unit-tested without React where possible.
- [ ] Add `tests/app/home-view-model.test.ts` for representative state snapshots:
  - empty app.
  - planning conversation.
  - implementation conversation with active workers.
  - direct conversation.
  - failed run with recoverable worker status.
  - selected promoted planning transcript.
- [ ] Run:
  - `pnpm vitest run tests/app/home-view-model.test.ts tests/app/home-utils.test.ts tests/app/conversation-execution-status.test.ts`
- [ ] Acceptance criteria:
  - `HomeApp` renders a view model instead of recomputing large derived structures inline.
  - View model tests cover primary branches.

### 8. Extract Layout And Composer Controllers

- [ ] Create `src/app/home/useHomeLayoutController.ts`.
- [ ] Create `src/app/home/useComposerController.ts`.
- [ ] Move layout handlers:
  - sidebar open/close.
  - sidebar resize start.
  - mobile navigation open/close.
  - side window open/close.
  - project open/collapse.
- [ ] Move composer handlers:
  - mention query filtering.
  - apply mention.
  - submit behavior.
  - attach/paste/remove attachment wiring.
  - queued message edit.
  - stop conversation action selection.
- [ ] Keep composer draft subscription inside the composer container or `useComposerController`, not `HomeApp`.
- [ ] Update `tests/ui/composer-shell.test.ts` and `tests/ui/sidebar-layout.test.ts`.
- [ ] Run:
  - `pnpm vitest run tests/ui/composer-shell.test.ts tests/ui/sidebar-layout.test.ts tests/app/composer-keyboard.test.ts`
- [ ] Acceptance criteria:
  - Keystrokes in the composer do not require `HomeApp` to subscribe to command text.
  - Sidebar resize/open state remains stable across desktop and mobile tests.

### 9. Slim `HomeApp`

- [ ] Refactor `src/app/home/HomeApp.tsx` to compose:
  - queries.
  - mutations/actions.
  - view model.
  - layout controller.
  - top-level layout.
- [ ] Target under 700 lines for this milestone.
- [ ] Keep `HomeApp` responsible for:
  - auth gate rendering.
  - top-level shell layout.
  - wiring major child components.
  - modal/dialog mounting.
- [ ] Do not move UI copy into new hardcoded strings during extraction.
- [ ] Run:
  - `pnpm vitest run tests/ui/page-shell.test.ts tests/ui/auth-boot-shell.test.ts tests/ui/login-shell.test.ts`
  - `pnpm build`
- [ ] Acceptance criteria:
  - `HomeApp` is materially smaller and easier to scan.
  - Build and shell tests pass.

### 10. Enforce And Complete Frontend i18n

- [ ] Add `tests/ui/i18n-hardcoded-copy.test.ts`.
- [ ] Define a narrow allowlist for:
  - protocol values.
  - CSS class names.
  - storage keys.
  - API paths.
  - model ids.
  - non-visible technical constants.
  - intentionally displayed product name if already translated through `product.name` where practical.
- [ ] Migrate hardcoded user-facing strings in:
  - `BootShell`.
  - `LoginShell`.
  - `PairDeviceDialog`.
  - `FolderPickerDialog`.
  - `FileAttachmentPickerDialog`.
  - `AttachmentImagePreviewDialog`.
  - `ComposerModelPicker`.
  - `ConversationSidebar`.
  - `HomeHeader`.
  - `ConversationMain`.
  - `QueuedMessageDrawer`.
  - `UserInputMessage`.
  - `WorkersSidebar`.
  - `SideWindow`.
  - `HomeApp` browser prompts/confirms.
  - `Terminal` visible labels and aria labels.
- [ ] Add matching keys to every locale file in `shared/locales/`.
- [ ] Make every component that renders translated strings call `useI18nSnapshot()` when language changes must repaint.
- [ ] Replace `window.confirm` and `window.prompt` copy in `HomeApp` with translated strings. If prompt/confirm behavior needs richer UX, keep the functional equivalent for this milestone and record a separate decision in docs, not in the checklist.
- [ ] Update source-based tests that currently expect English literals.
- [ ] Run:
  - `pnpm vitest run tests/lib/i18n.test.ts tests/ui/i18n-hardcoded-copy.test.ts tests/ui/page-shell.test.ts`
  - `pnpm lint`
- [ ] Acceptance criteria:
  - Locale key parity passes.
  - Hardcoded frontend copy test passes.
  - Language switching repaints affected components.

### 11. Split `Terminal` If Touched By i18n Or Render Work

- [ ] If task 10 touches more than small label replacements in `src/components/Terminal.tsx`, split it in the same change set.
- [ ] Candidate files:
  - `src/components/terminal/TerminalToolbar.tsx`
  - `src/components/terminal/ToolGroup.tsx`
  - `src/components/terminal/MessageEditPanel.tsx`
  - `src/components/terminal/ThoughtGroup.tsx`
  - `src/components/terminal/TerminalScrollController.ts`
  - `src/components/terminal/terminal-rendering.ts`
- [ ] Keep `Terminal.tsx` as the composition root.
- [ ] Preserve scroll-follow behavior, output grouping, tool output expansion, project file reference opening, and text-size preferences.
- [ ] Add or update:
  - `tests/ui/terminal-fit.test.ts`
  - targeted tests for extracted pure rendering helpers if created.
- [ ] Run:
  - `pnpm vitest run tests/ui/terminal-fit.test.ts`
- [ ] Acceptance criteria:
  - Terminal behavior is unchanged.
  - The terminal root file moves toward the 1,200-line threshold or below it if practical in this milestone.

### 12. Improve Render Subscription Boundaries

- [ ] Audit every `useManagerSnapshot(...)` in `src/app` and `src/components`.
- [ ] Replace broad snapshots with `useManagerSelector(...)` where components only need a small slice.
- [ ] Prioritize:
  - `Terminal` manager subscriptions.
  - `WorkerCard` manager subscriptions.
  - `ConversationMain` manager subscriptions.
  - `WorkersSidebar` manager subscriptions.
  - settings dialog appearance subscriptions.
- [ ] Add stable selectors and equality checks for record/set based selections.
- [ ] Add tests where selector identity matters, especially for `useManagerSelector`.
- [ ] Run:
  - `pnpm vitest run tests/lib/state-manager.test.ts tests/ui/react-best-practices.test.ts`
- [ ] Acceptance criteria:
  - High-churn manager fields have narrow subscribers.
  - Tests prevent future broad root subscriptions.

### 13. Address Local Dev Performance

- [ ] Use the measurement script from task 1 to compare before/after.
- [ ] Inspect route compile logs for the slowest routes:
  - `/`
  - `/api/events`
  - `/api/fs/files`
  - `/api/agents/catalog`
  - `/api/settings`
- [ ] Reduce client module graph where practical:
  - Keep dynamic imports for heavy dialogs.
  - Ensure server-only modules are not pulled into client code.
  - Keep heavy code highlighting and terminal helpers scoped to the terminal path.
  - Avoid importing large constants or server-ish helpers into `HomeApp` when a smaller view model can own them.
- [ ] Review `.next` production output after build:
  - route size for `/`.
  - first-load JS.
  - dynamic chunks for settings/pair/folder dialogs.
- [ ] Do not add premature memoization everywhere. Only memoize where measurement, render count, or object identity requires it.
- [ ] Run:
  - `pnpm build`
  - measurement script.
- [ ] Acceptance criteria:
  - New timing numbers are recorded beside baseline.
  - No regression in production first-load JS.
  - Warm local `/` and key API response times do not worsen.

### 14. Resolve The Routing Rule Mismatch

- [ ] Create `docs/architecture/routing-decision.md`.
- [ ] Document the current reality:
  - The project uses Next route handlers under `src/app/api/**/route.ts`.
  - Local instructions say not to use file-based routing.
- [ ] Present two concrete options:
  - Keep current Next route handlers for now, and update/clarify AGENTS instructions if the rule is obsolete for this repo.
  - Plan a separate backend routing migration to an explicit router/control-plane server outside Next file routes.
- [ ] Do not migrate routing in this milestone unless the user explicitly approves that scope.
- [ ] Acceptance criteria:
  - The mismatch is visible and decision-ready.
  - No new API route files are added for this milestone unless needed by already-approved current work.

### 15. Full Product-Surface Verification

- [ ] Verify deterministic commands:
  - `pnpm lint`
  - `pnpm build`
  - `pnpm test`
  - `pnpm vitest run tests/ui/react-best-practices.test.ts tests/ui/i18n-hardcoded-copy.test.ts`
- [ ] Verify local app startup:
  - Use an already-running app if present.
  - Otherwise start `pnpm dev`, measure, then stop it.
- [ ] Verify primary visible states manually or with approved browser automation:
  - boot/loading.
  - unauthenticated login.
  - conversation sidebar.
  - selected conversation.
  - composer idle/submitting/stoppable states.
  - settings dialog.
  - language switch.
  - worker side panel.
  - file side window.
  - error/recovery notice when test data exists.
- [ ] If user approves agentic journey tests, run the candidate journeys listed above.
- [ ] Acceptance criteria:
  - Deterministic tests pass.
  - Build passes.
  - No app lint warnings remain.
  - Any manual/browser verification gaps are explicitly reported with reason.

## Rollout Order

1. Measurement and lint signal.
2. Hook dependency correctness.
3. State ownership documentation and tests.
4. Query/mutation/action extraction.
5. View model extraction.
6. Layout/composer controller extraction.
7. `HomeApp` slimming.
8. i18n enforcement and copy migration.
9. Terminal split if touched enough to justify it.
10. Subscription-boundary tightening.
11. Performance comparison.
12. Routing decision note.
13. Full verification.

## Risk Controls

- Keep each extraction behavior-preserving.
- Prefer pure helper tests before moving render wiring.
- Run focused tests after each slice, not only at the end.
- Avoid changing API contracts while slimming the frontend.
- Preserve optimistic update rollback behavior exactly.
- Treat hook dependency loops as design feedback, not as a reason to suppress lint.
- Avoid broad snapshot subscriptions in new hooks.
- Keep i18n migrations mechanical and key-stable.
- Stop any dev server started solely for verification.

## Success Metrics

- `HomeApp.tsx` under 700 lines.
- `Terminal.tsx` not allowed to grow; if materially touched, it moves toward or below 1,200 lines.
- `pnpm lint` reports zero app warnings.
- `pnpm build` passes.
- `/` production first-load JS does not increase above the baseline of 319 kB without a written reason.
- Local warm `/` TTFB does not regress from the measured baseline of about 1.39s.
- Local warm `/api/auth/session` TTFB does not regress from the measured baseline of about 0.86s.
- i18n hardcoded-copy test passes.
- React best-practices test passes.
- Existing primary UI/API tests pass.

## Final Checklist

- [ ] Baseline measurements documented.
- [ ] ESLint signal cleaned.
- [ ] React hook dependency warnings fixed.
- [ ] Frontend state and rendering ownership documented.
- [ ] Home queries extracted.
- [ ] Home mutations and conversation actions extracted.
- [ ] Home view model extracted and tested.
- [ ] Layout and composer controllers extracted.
- [ ] `HomeApp.tsx` slimmed below target.
- [ ] Frontend hardcoded i18n copy migrated.
- [ ] i18n enforcement test added.
- [ ] Terminal split performed if materially touched.
- [ ] Broad subscription boundaries tightened.
- [ ] Local performance compared after refactor.
- [ ] Routing mismatch documented for decision.
- [ ] Deterministic verification commands pass.
- [ ] Product-surface verification completed or gaps documented.
