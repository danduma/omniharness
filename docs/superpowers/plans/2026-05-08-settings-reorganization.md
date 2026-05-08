# Settings Reorganization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize OmniHarness Settings into a coherent preferences and runtime configuration surface with General, Models, Agents, and Runtime tabs, placing Language and text-size preferences under General while keeping Theme as the fast header toggle.

**Architecture:** Split the current monolithic `SettingsDialog` into a shell plus focused panel components, and separate browser-local preferences from server-backed workspace/runtime settings. Browser-local preferences, including language and text-size preferences, apply immediately through their own managers, while server-backed settings are edited through a draft manager and persisted explicitly via `/api/settings`.

**Tech Stack:** Next.js 15, React 19, TypeScript, existing shadcn/Base UI components, existing `StateManager` pattern, `@danduma/i18n`, Vitest source and behavior tests.

**North Star Product:** Settings should feel like a trustworthy control plane for OmniHarness: easy defaults for normal use, transparent runtime status, clear persistence boundaries, and room to add advanced controls without becoming a junk drawer.

**Current Milestone:** Reorganize the existing Settings dialog, add Language and text-size preferences under the first General tab, keep Theme in the header, split panels into maintainable files, and make Save/Cancel behavior correct for server-backed settings.

**Later Milestones / Deferred But Intentional:** Add Access/Pairing settings, richer project-root management, provider connection tests, saved credential clearing, per-agent model defaults, and additional advanced runtime controls after the core structure lands.

**Final Functionality Standard:** The shipped milestone must preserve all currently editable settings, add real Language and text-size controls under General, distinguish instant local preferences from server-backed saved settings, and keep all existing worker/model/runtime behavior functional end to end.

---

## Approved Product Decisions

- Theme remains in the header because it is a frequent, normal quick toggle.
- Language belongs in Settings because users usually set it once and leave it alone.
- Text-size preferences belong in Settings > General because they are personal readability defaults rather than runtime behavior.
- The Settings surface should be reorganized around setting type and user intent, not the current implementation bucket called `apiKeys`.
- Existing server-backed settings should get real draft semantics: Save persists changes, Cancel discards unsaved edits.
- Browser-local settings should apply immediately and should not pretend to participate in the Save button.

## Current Problems

- `src/components/home/SettingsDialog.tsx` is a single large component mixing shell, tabs, LLM forms, worker controls, diagnostics, and footer behavior.
- `apiKeys` is a misleading state name; it also stores worker defaults, credit strategy, busy-message behavior, and project roots.
- Save/Cancel is ambiguous because current changes are written directly into global UI state before save.
- Worker availability is live status, but it is placed beside editable settings as if it were persisted form data.
- Credit exhaustion strategy is model routing/failover behavior, not a credential field.
- Browser preferences and workspace runtime settings are mixed together.
- Terminal text sizing already exists as an inline control, but it is not represented as a clear default preference in Settings.
- Direct-control conversation surfaces use fixed text sizes, so readability cannot be tuned consistently with terminal output.
- Language i18n plumbing exists, but the visible Settings placement and save semantics need to be aligned with the product model.

## Proposed Settings Information Architecture

Top-level tabs:

- `General`
  - Language
  - Appearance
    - Direct-control text size
    - Terminal / agent-output text size
    - Local preferences reset affordance if added later
  - No Theme control; theme stays in the header

- `Models`
  - Supervisor primary model profile
  - Supervisor fallback model profile
  - Credit/failover strategy
  - Saved credential status
  - Deferred: test connection and clear saved credential actions

- `Agents`
  - Worker availability status
  - Allowed worker agents
  - Default worker agent
  - YOLO / permission posture
  - Deferred: per-agent model defaults

- `Runtime`
  - Busy-message behavior
  - Deferred: retry, recovery, context, and compaction controls

Deferred future tab:

- `Access`
  - Phone pairing
  - Sessions
  - Auth status

## Persistence Model

- Language:
  - Owner: `i18nManager` from `src/lib/i18n.ts`.
  - Storage: browser `localStorage` key `omni-locale`.
  - Load: `i18nManager.hydrateAsync()` in `src/app/providers.tsx`.
  - Save behavior: applies immediately when selected.
  - Cancel behavior: no effect; language changes are not part of server settings draft.
  - Reset behavior: can be added later with `i18nManager.resetLocaleAsync()`.

- Theme:
  - Owner: `homeUiStateManager` and existing lifecycle code.
  - Storage: browser `localStorage` key `omni-theme-mode`.
  - Placement: unchanged header quick toggle.

- Text-size preferences:
  - Owner: new or extended browser-local appearance manager using the existing `StateManager` pattern.
  - Storage: browser `localStorage`, with stable keys such as `omni-direct-text-size` and the existing or migrated terminal text-size key.
  - Direct-control scope: direct conversation transcript, direct user messages, direct assistant Markdown output, and any direct-control panes where fixed `text-sm`/`text-[15px]` classes currently define readability.
  - Terminal scope: `Terminal`, `WorkerCard` terminal surfaces, and `AgentSurface` output surfaces that already render through `Terminal`.
  - Existing terminal behavior: preserve `TerminalTextSizeControl` as a quick inline entry point, but make it update the same persisted terminal text-size preference shown in Settings.
  - Save behavior: applies immediately when changed.
  - Cancel behavior: no effect; text-size preferences are not part of the server settings draft.
  - Theme interaction: no color theme selector is added to Settings.

- Server/workspace settings:
  - Owner: new `SettingsDraftManager`.
  - Storage: `/api/settings` backed by the `settings` database table.
  - Load: settings query hydrates draft baseline and current draft.
  - Save behavior: only dirty server settings are POSTed to `/api/settings`.
  - Cancel behavior: discards draft and restores last loaded/saved baseline.
  - Secret handling: preserve existing behavior where blank secret fields do not clear already saved credentials.

- Live diagnostics:
  - Owner: existing settings/worker catalog queries.
  - Storage: not user-editable form state.
  - Save behavior: none.

## File Map

Files to create:

- `src/app/home/SettingsDraftManager.ts`
  - Owns server-backed settings draft, baseline, dirty state, reset/discard behavior, and field setters.

- `src/components/settings/SettingsDialog.tsx`
  - New shell component or migrated location for the settings dialog.
  - Owns top-level tab navigation and footer.

- `src/components/settings/GeneralSettingsPanel.tsx`
  - Renders Language and Appearance text-size preferences, and explains only if necessary that theme remains in the header.

- `src/components/settings/AppearanceSettingsPanel.tsx`
  - Renders direct-control and terminal text-size controls if this is large enough to deserve extraction from `GeneralSettingsPanel`.

- `src/components/settings/ModelsSettingsPanel.tsx`
  - Contains supervisor/fallback model profile controls and credit/failover strategy.

- `src/components/settings/ModelProfileForm.tsx`
  - Extracted from current `LlmSettingsForm`; handles provider/model/base URL/API key fields.

- `src/components/settings/AgentsSettingsPanel.tsx`
  - Contains worker availability, allowed agents, default agent, and YOLO mode.

- `src/components/settings/RuntimeSettingsPanel.tsx`
  - Contains busy-message behavior.

- `src/components/settings/SettingsTabs.tsx`
  - Optional helper if top-level tab rendering is large enough to deserve extraction.

- `tests/ui/settings-dialog.test.ts`
  - Focused source/behavior tests for the new settings architecture.

- `tests/app/settings-draft-manager.test.ts`
  - Unit tests for draft, save payload, dirty state, and cancel/discard behavior.

- `tests/app/appearance-preferences-manager.test.ts`
  - Unit tests for browser-local text-size defaults, mutation, persistence, and reset behavior if a dedicated manager is created.

Files to modify:

- `src/components/home/SettingsDialog.tsx`
  - Either reduce to a compatibility re-export or move implementation to `src/components/settings/SettingsDialog.tsx`.

- `src/app/home/HomeApp.tsx`
  - Replace direct `apiKeys` mutation in settings flows with `SettingsDraftManager` where feasible.
  - Keep existing runtime use of effective settings working.

- `src/app/home/HomeUiStateManager.ts`
  - Keep `activeSettingsTab`, but default it to `"general"`.
  - Rename `apiKeys` only if it can be done safely in this milestone; otherwise add `settingsDraftManager` first and defer broader state naming cleanup.

- `src/app/home/AppearancePreferencesManager.ts` or `src/components/component-state-managers.ts`
  - Own direct-control and terminal text-size preference state.
  - Reuse existing `terminalUiManager.terminalZoom` semantics where practical instead of creating a competing terminal preference.
  - Persist browser-local text-size defaults.

- `src/app/home/types.ts`
  - Define `SettingsTab = "general" | "models" | "agents" | "runtime"`.
  - Keep `WorkerSettingsTab` only if nested agent tabs remain necessary; otherwise remove it.
  - Add server settings draft types if they are shared.

- `src/app/home/constants.ts`
  - Add typed server setting keys/defaults if useful.
  - Preserve existing worker and provider option values.

- `src/lib/i18n.ts`
  - Reuse existing manager and locale loaders.
  - No change expected unless `LanguageSelect` needs a helper.

- `src/components/LanguageSelect.tsx`
  - Keep as the General panel control; ensure it has no dependency on server settings Save/Cancel.

- `src/components/Terminal.tsx`
  - Keep `TerminalTextSizeControl`.
  - Wire terminal text-size changes through the shared/persisted appearance preference path.
  - Preserve existing terminal CSS variable approach for text scaling.

- `src/components/WorkerCard.tsx`
  - Preserve inline terminal text-size affordance and ensure it updates the shared terminal preference.

- `src/components/AgentSurface.tsx`
  - Confirm agent output inherits the shared terminal text-size preference via `Terminal`.

- `src/components/home/ConversationMain.tsx`
  - Apply direct-control text-size classes or CSS variables to direct assistant/user transcript surfaces.

- `src/components/home/UserInputMessage.tsx`
  - Replace fixed text-size assumptions with the shared direct-control text-size style.

- `src/components/home/ConversationComposer.tsx`
  - Decide whether the direct composer participates in direct-control text size; include it only if it improves readability without harming layout.

- `shared/locales/*.json`
  - Add strings for the Settings tabs, Language control, Appearance section, direct-control text size, and terminal text size.

- `tests/ui/sidebar-layout.test.ts`
  - Update or move Settings assertions into `tests/ui/settings-dialog.test.ts` to reduce the current broad source-test coupling.

- `tests/lib/i18n.test.ts`
  - Keep dynamic locale coverage.

Tests to update or add:

- `tests/app/settings-draft-manager.test.ts`
  - Verifies loaded server values become both baseline and draft.
  - Verifies field edits mark draft dirty.
  - Verifies cancel restores baseline.
  - Verifies save payload includes server-backed settings only.
  - Verifies local language changes are excluded from server settings payload.

- `tests/ui/settings-dialog.test.ts`
  - Verifies top-level tabs are `General`, `Models`, `Agents`, `Runtime` in that order.
  - Verifies General contains `LanguageSelect`.
  - Verifies General contains text-size controls for direct control and terminal output.
  - Verifies Theme is not rendered in Settings.
  - Verifies Models contains primary/fallback profiles and credit/failover strategy.
  - Verifies Agents contains availability, allowed workers, default worker, and YOLO mode.
  - Verifies Runtime contains busy-message behavior.
  - Verifies footer copy or disabled state communicates server-backed Save semantics.

- `tests/app/appearance-preferences-manager.test.ts`
  - Verifies direct-control text size defaults to the current visual size.
  - Verifies terminal text size defaults to the current `terminalZoom` default.
  - Verifies preference changes persist locally.
  - Verifies appearance preferences are excluded from server settings payload.

- `tests/ui/terminal-fit.test.ts` or `tests/ui/settings-dialog.test.ts`
  - Verifies terminal text-size controls still render.
  - Verifies `Terminal` continues to use CSS variables for stable text scaling.

- `tests/ui/conversation-actions.test.ts`
  - Update fixed `text-sm` assertions if direct-control text size moves to shared CSS variables or helper classes.

- Existing tests:
  - Update `tests/ui/sidebar-layout.test.ts` only for high-level settings entry points after moving detailed Settings coverage.
  - Update any tests referencing `activeSettingsTab === "llm"` or `activeSettingsTab === "workers"`.

Candidate agentic user journey tests, approval-gated:

- Open Settings, confirm General is first, switch language, close Settings, reopen, and verify language remains selected after reload.
- Open Settings, change direct-control text size, close Settings, and verify direct conversation messages resize without saving server settings.
- Open Settings, change terminal text size, verify worker/direct terminal surfaces resize, reload, and verify the preference remains.
- Edit a server-backed model field, cancel, reopen, and verify the old value remains.
- Edit a server-backed worker/runtime setting, save, reload, and verify the persisted value returns.
- Confirm theme stays available in the header and does not appear inside Settings.

Real integrations and data paths:

- `/api/settings` remains the server persistence endpoint.
- `settings` database table remains the server settings store.
- `i18nManager` remains the browser-local language owner.
- Appearance/text-size manager remains the browser-local readability preference owner.
- `homeUiStateManager` remains the owner of `showSettings` and active Settings tab UI state.
- Worker availability remains sourced from `/api/agents/catalog`.
- Gemini model list remains sourced from `/api/llm-models`.

`.gitignore` coverage:

- Existing `.gitignore` already excludes dependencies, caches, build output, logs, local databases, auth keys, env files, and temporary files.
- New source files, tests, and locale JSON files are intended source artifacts and should be tracked.

File growth:

- `src/components/home/SettingsDialog.tsx` should shrink substantially or become a re-export.
- `src/app/home/HomeApp.tsx` is already over 1200 lines. Avoid adding Settings logic there; move draft behavior into `SettingsDraftManager` and panel components.

## Implementation Tasks

- [ ] Add failing draft-manager tests.
  - Create `tests/app/settings-draft-manager.test.ts`.
  - Cover baseline hydration, draft mutation, dirty state, cancel/reset, save payload generation, and exclusion of local language and text-size preferences.
  - Verification: `pnpm test tests/app/settings-draft-manager.test.ts`.

- [ ] Implement `SettingsDraftManager`.
  - Create `src/app/home/SettingsDraftManager.ts`.
  - Use the existing `StateManager` pattern.
  - State should include `baseline`, `draft`, `dirtyKeys`, `isDirty`, and helper methods for `hydrate(values)`, `setValue(key, value)`, `resetDraft()`, and `buildSavePayload()`.
  - Verification: `pnpm test tests/app/settings-draft-manager.test.ts`.

- [ ] Add focused Settings UI tests.
  - Create `tests/ui/settings-dialog.test.ts`.
  - Move detailed Settings assertions out of `tests/ui/sidebar-layout.test.ts` where practical.
  - Encode the approved IA: General, Models, Agents, Runtime.
  - Encode General contents: Language and Appearance text-size preferences, without Theme.
  - Verification: `pnpm test tests/ui/settings-dialog.test.ts`.

- [ ] Split the Settings shell and panels.
  - Create `src/components/settings/SettingsDialog.tsx`.
  - Create panel files listed in the file map.
  - Leave `src/components/home/SettingsDialog.tsx` as a compatibility re-export if it reduces import churn.
  - Keep component styling consistent with existing dialog patterns; dense, predictable, not decorative.
  - Verification: `pnpm test tests/ui/settings-dialog.test.ts`.

- [ ] Add General tab with Language and Appearance.
  - Put `LanguageSelect` in `GeneralSettingsPanel`.
  - Add direct-control text-size and terminal text-size controls.
  - Use concise labels such as `Direct control` and `Terminals and agent output`.
  - Ensure Theme is not present in Settings.
  - Add copy explaining, briefly, that theme is available in the header only if needed. Avoid bloated instructional text.
  - Language changes should call `i18nManager.setLocaleAsync()` and apply immediately.
  - Text-size changes should apply immediately and persist locally.
  - Verification: `pnpm test tests/lib/i18n.test.ts tests/ui/settings-dialog.test.ts tests/app/appearance-preferences-manager.test.ts`.

- [ ] Implement browser-local text-size preferences.
  - Create `AppearancePreferencesManager` or extend the existing terminal UI manager if that keeps ownership clearer.
  - Preserve existing `TERMINAL_ZOOM_LEVELS` values and migrate `TerminalTextSizeControl` to the shared preference.
  - Add a direct-control text-size scale with conservative options, for example `Compact`, `Default`, `Large`, `Larger`.
  - Apply direct-control text size through CSS variables or a small typed class helper rather than scattering new fixed Tailwind classes.
  - Keep layout stable when text size changes, especially in the direct transcript, composer, and terminal headers.
  - Verification: `pnpm test tests/app/appearance-preferences-manager.test.ts tests/ui/terminal-fit.test.ts tests/ui/conversation-actions.test.ts`.

- [ ] Move model settings into Models.
  - Extract current `LlmSettingsForm` into `ModelProfileForm`.
  - Rename top-level UI from `LLM Settings` to `Models`.
  - Keep supervisor/fallback profile functionality intact.
  - Move credit strategy into Models as failover behavior.
  - Preserve Gemini model fetching and saved credential display.
  - Verification: `pnpm test tests/ui/settings-dialog.test.ts tests/supervisor/model-config.test.ts tests/supervisor/runtime-settings.test.ts`.

- [ ] Move worker settings into Agents.
  - Preserve worker availability rendering.
  - Preserve allowed worker toggles and default worker selection.
  - Move YOLO mode here as permission posture.
  - Decide during implementation whether nested `availability/defaults/runtime` tabs are still needed; prefer simple grouped sections if the panel remains readable.
  - Verification: `pnpm test tests/ui/settings-dialog.test.ts tests/app/home-utils.test.ts tests/supervisor/worker-availability.test.ts`.

- [ ] Move busy-message behavior into Runtime.
  - Render `BUSY_MESSAGE_ACTION` in `RuntimeSettingsPanel`.
  - Preserve existing values: `queue` and `steer`.
  - Verification: `pnpm test tests/app/busy-message-behavior.test.ts tests/ui/settings-dialog.test.ts`.

- [ ] Wire HomeApp to the draft manager.
  - On settings query success, hydrate the draft manager with loaded server values.
  - Panels read/write the draft instead of mutating persisted/effective settings directly.
  - Save posts `settingsDraftManager.buildSavePayload()`.
  - Cancel calls `settingsDraftManager.resetDraft()` and closes the dialog.
  - Runtime behavior should continue using the last saved/effective settings, not unsaved drafts.
  - Browser-local language and text-size preference changes should bypass the server draft entirely.
  - Verification: `pnpm test tests/app/settings-draft-manager.test.ts tests/ui/settings-dialog.test.ts tests/ui/composer-shell.test.ts`.

- [ ] Update locale resources.
  - Add Settings tab, Language, and Appearance text-size strings to `shared/locales/en.json` and the already-created main language files.
  - Use the existing `@danduma/i18n` dynamic loaders.
  - Verification: `pnpm test tests/lib/i18n.test.ts`.

- [ ] Clean up old naming where safe.
  - Prefer `serverSettingsDraft` / `settingsDraft` in new code.
  - Do not attempt a broad `apiKeys` rename across `HomeApp.tsx` unless tests show it is low risk.
  - Document any deferred naming cleanup in the final handoff.
  - Verification: `pnpm exec tsc --noEmit --pretty false`.

- [ ] Final verification.
  - Run `pnpm test tests/app/settings-draft-manager.test.ts tests/app/appearance-preferences-manager.test.ts tests/ui/settings-dialog.test.ts tests/lib/i18n.test.ts`.
  - Run relevant existing regression tests listed above.
  - Run `pnpm exec tsc --noEmit --pretty false`.
  - Run `pnpm lint` if the touched files trigger lint-sensitive patterns.
  - Note that full `pnpm build` may currently fail from the existing Next page-manifest/page-data issue; rerun if that issue is resolved before implementation completes.

## Acceptance Criteria

- Settings opens on `General`.
- `General` contains Language and text-size preferences, and does not contain Theme.
- Theme remains accessible from the header.
- Models, Agents, and Runtime settings preserve their existing behavior.
- Language changes apply immediately and persist locally.
- Direct-control text-size changes apply immediately and persist locally.
- Terminal and agent-output text-size changes apply immediately, persist locally, and continue to be adjustable from the existing inline terminal control.
- Server-backed setting edits are draft-only until Save.
- Cancel discards unsaved server-backed setting edits.
- Save posts only server-backed settings.
- Worker availability remains visible but is not presented as persisted form state.
- `SettingsDialog` is split into focused components rather than growing as a monolith.

## Self-Review

- The plan maps every approved product decision to tasks.
- The plan assumes no branch and no worktree.
- The plan preserves Manager-owned state and adds a dedicated draft manager.
- The plan keeps Theme in the header and Language in Settings.
- The plan treats text size as a General appearance preference while keeping color theme switching in the header.
- The plan avoids file-based routing.
- The plan treats oversized file risk explicitly and moves Settings logic out of large components.
- The plan does not introduce fake controls or placeholder behavior as completion proof.
