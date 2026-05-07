# I18n Resource Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a custom Evergreen-style i18n layer so Omniharness can switch language easily and user-facing UI text is loaded from locale resources instead of hardcoded component strings.

**Architecture:** Extract Evergreen's small `t(key, params, defaultMessage)` idea into Omniharness, but tighten usage to `t(key, params?)` for application UI so English copy lives in JSON resources, not component fallbacks. Locale selection is owned by a global `I18nManager` that persists the chosen locale, updates `document.documentElement.lang`, and notifies React subscribers through the existing Manager subscription pattern.

**Tech Stack:** Next.js 15, React 19, TypeScript, JSON locale resources, existing `StateManager` / `useManagerSnapshot`, Vitest, optional Playwright/browser smoke test after implementation approval.

**North Star Product:** Omniharness can ship complete UI translations by adding locale resource files and selecting a supported locale, with no copy edits required inside UI components.

**Current Milestone:** Build the i18n library, add English resource coverage for existing user-facing frontend strings, add a language selector, migrate the main UI surfaces to use resource keys, and add tests that keep new hardcoded UI strings from creeping back in.

**Later Milestones / Deferred But Intentional:** Add real non-English locale files after the target languages are chosen, automate missing-key extraction/reporting, and extend i18n to server-generated user-facing API errors where appropriate.

**Final Functionality Standard:** This milestone delivers real end-to-end frontend i18n infrastructure and English resource coverage. It intentionally does not invent second-language translations without human approval of target languages and translation source.

---

## Observed Evergreen Pattern

- Evergreen has two nearly identical custom libraries at `../evergreen/frontend/src/lib/i18n.ts` and `../evergreen/publicapp/src/lib/i18n.ts`.
- Both import a flat dictionary from `../evergreen/shared/locales/en.json`, resolve locale from `window.localStorage.getItem("locale")`, fall back to `navigator.language`, then to `en`.
- Translation calls use flat dotted keys and `{name}` interpolation, for example `t("costs.entriesCount", { count }, "{count} entries")`.
- Evergreen currently has one locale resource, `../evergreen/shared/locales/en.json`, with 1275 flat key/value entries.
- Omniharness should copy the small custom-library spirit, but not Evergreen's call-site English fallback convention because the requested standard here is resource-loaded strings.

## Product Decisions

- Locale persistence: client-local setting in `window.localStorage` under `omni-locale`.
- Initial locale: stored `omni-locale` if supported, else browser language if supported, else `en`.
- Resource format: flat JSON dictionaries with dotted keys, matching Evergreen.
- Runtime missing translation behavior: return the key in production and record/report missing keys in development/test. Do not silently fall back to English for a selected non-English locale once real translations exist unless explicitly added as a later product decision.
- Language selector: place it in Settings alongside other workspace/user preferences. Add an "Interface" or "General" settings tab rather than burying language under LLM settings.
- Current supported locale list: start with `en` only. The selector and manager support more locales as data-only additions once real locale files exist.

## File Map

Files to create:

- `shared/locales/en.json`: canonical English UI copy resource, using flat dotted keys.
- `src/lib/i18n.ts`: extracted custom i18n library plus Omniharness `I18nManager`.
- `src/components/LanguageSelect.tsx`: small reusable language selector bound to `I18nManager`.
- `scripts/check-i18n-literals.ts`: TypeScript AST checker for hardcoded user-facing frontend strings.
- `tests/i18n/i18n.test.ts`: unit tests for locale resolution, interpolation, missing-key behavior, supported locale metadata, and manager persistence hooks where feasible.
- `tests/i18n/no-hardcoded-ui-strings.test.ts`: runs the string checker against `src/app` and `src/components`.
- `tests/ui/language-select.test.tsx` or equivalent existing UI-test style: verifies the selector calls the manager and visible labels come from resources.

Files to modify:

- `src/app/layout.tsx`: set initial `lang` from persisted locale before paint, similar to the existing theme bootstrap.
- `src/app/providers.tsx`: initialize/hydrate the `I18nManager` on the client if provider-level hydration is cleaner than doing it in `HomeApp`.
- `src/lib/use-manager-snapshot.ts`: likely unchanged, but confirm it works directly for `i18nManager`.
- `src/app/home/types.ts`: add `SettingsTab` value for `interface` or `general`.
- `src/app/home/HomeUiStateManager.ts`: add the settings tab default if needed; do not make locale state part of `HomeUiState` because `I18nManager` owns it.
- `src/components/home/SettingsDialog.tsx`: add the language selector and convert settings strings to `t(...)`.
- `src/components/home/HomeHeader.tsx`, `src/components/home/WorkersSidebar.tsx`, `src/components/home/ConversationComposer.tsx`, `src/components/home/ConversationMain.tsx`, `src/components/home/ConversationSidebar.tsx`, `src/components/home/QueuedMessageDrawer.tsx`, `src/components/WorkerCard.tsx`, dialogs, composer controls, boot/login shells, and other `src/components` UI surfaces: migrate user-facing strings to resource keys.
- `src/app/home/HomeApp.tsx`: migrate call-site strings, but include a refactor because this file is already 1718 lines.
- `src/app/home/constants.ts`: move user-facing option labels to locale resources while keeping stable option values in code.
- `tests/ui/react-best-practices.test.ts`: optionally extend or keep separate from i18n literal enforcement.
- `tests/config/next-config.test.ts` or equivalent if JSON imports or `shared` path assumptions need explicit coverage.
- `AGENTS.md`: add project convention: use `t("key", params?)` and update `shared/locales/en.json` for new UI strings.

Tests to update or add:

- Unit coverage for `formatTemplate`, supported locale validation, browser locale normalization, selected locale persistence, and missing key recording.
- Static coverage that fails on hardcoded JSX text and common user-facing attributes (`aria-label`, `title`, `placeholder`, `alt`, `DialogTitle`, `DialogDescription`, button labels, empty states).
- Focused UI tests around Settings language selector and theme/language bootstrapping.
- Existing UI tests updated where they assert exact English copy, importing `t` or reading resource values where that improves stability.

Candidate agentic user journey tests, approval-gated:

- Start the app, open Settings, verify the language selector is visible and uses locale resource labels.
- Set the language to a non-default supported test locale if one is approved, reload, and verify `document.documentElement.lang` plus representative UI labels update.
- Exercise composer, conversation sidebar, workers sidebar, and settings dialog to catch missed hardcoded strings or missing keys.

Real integrations and data paths:

- Locale resource JSON is bundled into the frontend by TypeScript/Next JSON imports.
- `I18nManager` reads/writes `window.localStorage` and updates the DOM `lang` attribute.
- React components subscribe through `useManagerSnapshot(i18nManager)` or a tiny `useI18n()` wrapper so language changes re-render without local `useState`.
- Backend settings API is not needed for this milestone because language is a per-browser interface preference, similar to theme.

`.gitignore` coverage:

- Existing `.gitignore` already excludes dependencies, caches, build outputs, logs, databases, local auth keys, env files, and Next artifacts.
- Locale JSON files, i18n source, tests, and checker scripts are source artifacts and should be committed.

File growth:

- `src/app/home/HomeApp.tsx` is already over 1200 lines. Any implementation task that touches it should first extract one or more focused subcomponents or move string-heavy helper definitions out of the file. Do not normalize further growth of this file as acceptable.

## Tasks

- [ ] Write i18n unit tests first.
  - Add `tests/i18n/i18n.test.ts`.
  - Cover interpolation (`"Hello {name}"`), missing params preserving `{name}`, unsupported stored locale fallback, navigator fallback, and missing-key reporting.
  - Verification: `pnpm test tests/i18n/i18n.test.ts`.

- [ ] Extract the custom i18n library.
  - Create `shared/locales/en.json` with initial app-level keys such as product name, settings labels, common actions, theme labels, composer labels, sidebar labels, worker labels, and status labels.
  - Create `src/lib/i18n.ts` with `SUPPORTED_LOCALES`, `fallbackLocale`, `i18nManager`, `t(key, params?)`, `formatTemplate`, `setLocale`, `resolveInitialLocale`, and `useI18n` if a hook keeps call sites clean.
  - Keep `defaultMessage` out of normal UI call sites. If kept for migration tooling compatibility, mark it internal/test-only and do not use it in components.
  - Verification: `pnpm test tests/i18n/i18n.test.ts`.

- [ ] Add locale bootstrapping.
  - Update `src/app/layout.tsx` to set `document.documentElement.lang` from `omni-locale` before first paint, mirroring the existing theme bootstrap style.
  - Hydrate `i18nManager` on the client in `src/app/providers.tsx` or a dedicated client component.
  - Verification: add/update a test similar to `tests/ui/theme-bootstrap.test.ts`.

- [ ] Add a language selector to Settings.
  - Create `src/components/LanguageSelect.tsx`.
  - Extend `SettingsTab` with `interface` or `general`.
  - Update `src/components/home/SettingsDialog.tsx` to show the selector and translate its own labels.
  - Persistence: `I18nManager.setLocale(locale)` writes `omni-locale`; reset behavior can be a manager method that clears localStorage and re-resolves browser/default locale.
  - Verification: focused UI test for manager updates and rendered labels.

- [ ] Add hardcoded UI string enforcement.
  - Create `scripts/check-i18n-literals.ts` using the TypeScript compiler API so no extra dependency is needed.
  - Flag JSX text and user-facing string attributes in `src/app` and `src/components`.
  - Allow non-user-facing literals such as class names, route paths, storage keys, data-testid values, component values, provider/model ids, and technical API paths.
  - Add `tests/i18n/no-hardcoded-ui-strings.test.ts` to run the checker.
  - Verification: `pnpm test tests/i18n/no-hardcoded-ui-strings.test.ts`.

- [ ] Migrate core chrome strings.
  - Convert `HomeHeader`, `WorkersSidebar` including `ThemeModeToggle`, `ConversationSidebar`, `ConversationComposer`, composer selects/model picker, `QueuedMessageDrawer`, login/boot shells, and common dialogs.
  - Move option labels in `src/app/home/constants.ts` to translation keys while preserving stable values.
  - Verification: targeted UI tests plus `pnpm test tests/ui`.

- [ ] Refactor and migrate `HomeApp.tsx` safely.
  - Before editing copy-heavy sections, extract at least one focused subcomponent or helper module from `HomeApp.tsx` to reduce the 1718-line file.
  - Migrate remaining direct UI strings in `HomeApp.tsx` to resource keys.
  - Verification: `pnpm test tests/ui/page-shell.test.ts tests/app/home-utils.test.ts` plus the i18n literal test.

- [ ] Migrate status, error, and derived UI copy.
  - Convert user-facing summaries in hooks such as `useConversationExecutionStatus.ts`, `useRunSelectionEffects.ts`, frontend error notices, validation summaries, plan progress, and worker cards.
  - Keep backend protocol values and event type ids as code constants; translate only displayed labels/sentences at render/summary boundaries.
  - Verification: affected unit tests plus `pnpm test tests/app tests/ui`.

- [ ] Update project conventions.
  - Add an `AGENTS.md` note: new UI strings must be added to `shared/locales/en.json` and referenced with `t("key", params?)`.
  - Document key naming (`area.component.intent`) and interpolation placeholders.
  - Verification: static test catches a deliberately hardcoded fixture in checker unit coverage.

- [ ] Full verification pass.
  - Run `pnpm lint`.
  - Run `pnpm test`.
  - Run `pnpm build`.
  - If approved, run an agentic browser journey across Settings, composer, sidebar, and worker panels.

## Open Questions Before Implementation

- Which real non-English locale(s) should be added first? The implementation can support multiple locales immediately, but translation content should be approved rather than invented.
- Should locale be per-browser only, or eventually shared across paired/mobile sessions through the settings API?
- Should server-generated error strings be translated in this milestone, or should this first milestone focus strictly on frontend-owned UI strings?

## Self-Review

- Every requested requirement maps to tasks: extract Evergreen custom i18n, resource-backed strings, easy language selection, and no hardcoded UI strings.
- The plan uses current-repo work only and assumes no branch or worktree.
- The plan preserves Manager-owned state and avoids file-based routing.
- The plan treats `HomeApp.tsx` file growth explicitly because it is already over 1200 lines.
- The plan avoids fake translations; non-English locale content is deferred until target languages are chosen.
