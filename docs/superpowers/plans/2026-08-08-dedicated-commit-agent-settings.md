# Dedicated Commit Agent Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users configure the CLI, model, and effort used by the separate agent spawned for “commit and push project,” independently of the most recently used composer selection.

**Architecture:** Add three server-backed settings keys to the existing General Settings draft/save flow. The `commit` conversation creation path resolves those settings on the server, overrides any client-supplied composer selection, restricts the run to that CLI, and emits a typed selection event for observability. The existing “commit this conversation” action remains unchanged because it sends instructions to an already-running worker instead of creating a new commit worker.

**Tech Stack:** TypeScript, React, TanStack Query, Drizzle/SQLite settings table, existing `Select` controls, Vitest.

**North Star Product:** Every consequential automation action has an explicit, inspectable execution identity and never inherits an unrelated transient UI choice by accident.

**Current Milestone:** Dedicated project-commit agent configuration in General Settings, persisted server-side, used end to end by new `commit` runs, with localized UI copy and regression coverage.

**Future Product Direction:** The same explicit-action configuration pattern may later be reused for other spawned utility agents, but no other workflows are included in this milestone.

**Final Functionality Standard:** A user can choose CLI, model, and effort in General Settings, save and revisit those values, and trigger “commit and push project”; the resulting run records and worker launch use exactly that configuration regardless of the latest composer selection. Invalid setting values are rejected, missing legacy values receive deterministic defaults, and the server decision is observable in the named event stream.

---

## File map

### Files to modify

- `src/lib/commit-workflow.ts`: Define setting keys, deterministic defaults, normalization, and effort/worker validation helpers shared by client and server. Model ids remain explicit raw CLI values; they are not silently rewritten when a dynamic catalog changes.
- `src/interface/home/constants.ts`: Add the new settings to `DEFAULT_SERVER_SETTINGS`.
- `src/components/settings/GeneralSettingsPanel.tsx`: Render the compact persisted commit-agent controls using the existing select primitive and worker model catalog.
- `src/components/settings/SettingsDialog.tsx`: Pass settings draft values, setter, and worker model catalog into General Settings.
- `src/server/conversations/create.ts`: Resolve dedicated settings for `commit` mode, ignore unrelated composer account/worker constraints, use automatic account allocation only within the configured CLI, and emit the selected configuration event. If the configured CLI has no usable account, preserve that CLI and let the normal transparent worker-start failure surface; never fall back to another CLI.
- `src/runtime/http/routes/settings.ts`: Validate the new settings on save.
- `src/server/events/named-events.ts`: Add the typed `conversation.commit_agent_selected` event.
- `shared/locales/en.json`, `de.json`, `es.json`, `fr.json`, `it.json`, `ja.json`, `ko.json`, `pt.json`, `zh-CN.json`: Add all user-facing labels and accessibility text.

### Tests to add or modify

- `tests/lib/commit-workflow.test.ts`: Cover default normalization and validation behavior.
- `tests/api/settings-route.test.ts`: Verify valid values persist and invalid CLI/effort values are rejected.
- `tests/api/conversations-route.test.ts`: Verify a `commit` request ignores client composer selection and creates the configured worker/model/effort, including the named selection event, no-settings legacy defaults, and no cross-CLI account fallback.
- `tests/ui/settings-dialog.test.ts`: Verify the General Settings panel wires all three server-backed controls and uses translated copy.

### Required data paths and state ownership

- Source of truth: SQLite `settings` table, exposed through the existing `/api/settings` GET/POST routes.
- Client draft owner: existing `SettingsDraftManager`; controls call `setField`, and the existing Save/Cancel semantics apply. The model select includes the saved model even if the live catalog no longer reports it, so returning to settings does not silently change the configured value.
- Catalog owner: existing worker catalog React Query result; the settings panel receives its narrow `workerModels` slice and falls back to the shared catalog constants.
- Commit-run authority: server `createConversation` owns the effective commit agent configuration. Client values for `preferredWorkerType`, `preferredWorkerModel`, `preferredWorkerEffort`, `preferredWorkerAccountId`, and `allowedWorkerTypes` are not authoritative when mode resolves to `commit`. Model ids and effort are not silently downgraded for catalog/support changes; the configured values are recorded and normal worker launch errors remain visible if the selected CLI rejects them.
- Async/race invariant: settings are read at commit-run creation time, not captured from the current composer closure, so an earlier/later composer selection cannot alter the action. The created run and worker rows are the authoritative snapshot of the chosen config.
- Account rule: the configured CLI uses normal automatic account allocation for that CLI only. A missing or unusable account does not select another CLI; the existing worker startup/account error path remains the visible recovery path.
- Observability: emit `conversation.commit_agent_selected` with run id, worker type, model, and effort before worker startup; existing worker spawn/error events continue to describe execution outcomes.

### Verification and user journey candidate

- Deterministic verification: focused Vitest tests, typecheck/lint/build checks appropriate to the repository, and source diff review that confirms every locale has the new keys.
- Approval-gated journey candidate (propose, do not run without explicit approval): open General Settings, set Claude Code + a specific model + High effort, save, change the composer to a different CLI/model/effort, trigger “commit and push project,” and verify the resulting run’s visible worker metadata and event log show the saved Claude configuration.
- No new database migration is required because this uses the existing key/value settings table. Missing keys are handled by deterministic defaults for older installations.

## Implementation tasks

- [x] Add shared commit-agent setting keys, defaults, normalization, and validation helpers; write the unit tests first and verify the red/green behavior, including explicit raw model preservation and effort normalization.
- [x] Add the three defaults to the settings draft and build the General Settings controls with narrow props, responsive rows, existing `Select` controls, and i18n keys in every locale.
- [x] Validate settings writes and make `commit` conversation creation resolve the saved configuration server-side, including the typed named event, dedicated-run regression tests, the missing-settings default path, and no cross-CLI account fallback.
- [x] Run focused tests, repository typecheck/lint/build checks, inspect the diff, and verify no unrelated dirty-worktree changes were overwritten.

## Final checklist

- [x] General Settings exposes CLI, model, and effort for the project-commit agent.
- [x] Values persist through the existing settings save flow and survive reload/cancel semantics.
- [x] Selecting a different CLI updates the model choices without inheriting the composer’s latest model.
- [x] “Commit and push project” uses the saved CLI/model/effort and ignores transient composer selection.
- [x] The configured CLI is the only allowed worker for the commit run, with no accidental composer account override.
- [x] Invalid CLI/effort settings are rejected with transparent errors.
- [x] Legacy installations receive deterministic defaults without a migration.
- [x] Named event and existing lifecycle events make the server decision inspectable.
- [x] All new UI strings are translated through `t()` and present in every locale file.
- [x] Focused regression tests and proportionate repository verification pass.
