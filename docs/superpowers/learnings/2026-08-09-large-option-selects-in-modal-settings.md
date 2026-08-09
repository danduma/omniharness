# Large Option Lists Should Not Use Menu Primitives by Default

**Date:** 2026-08-09
**Context:** General Settings project commit-agent model picker
**Symptom:** Opening the project commit model picker was very slow and the picker could dismiss itself while the settings surface or worker catalog refreshed.
**Root Cause:** The shared settings `Select` rendered every option as a Base UI menu item, including while closed. The model catalog can contain dozens of entries, and the menu's portal and focus lifecycle was nested inside the modal settings dialog.
**Fix:** Added an opt-in native `<select>` path to the shared control and used it for the project commit model. The browser now owns the option popup and the React tree no longer mounts a menu item per model for this control.
**Verification:** `pnpm exec vitest run tests/ui/settings-dialog.test.ts tests/ui/sidebar-layout.test.ts tests/ui/composer-shell.test.ts`; `pnpm exec vitest run tests/lib/commit-workflow.test.ts tests/api/settings-route.test.ts tests/ui/settings-dialog.test.ts`; `pnpm exec eslint src/components/ui/select.tsx src/components/settings/GeneralSettingsPanel.tsx tests/ui/settings-dialog.test.ts`; `pnpm typecheck`; `pnpm build:interface:web`.
**Prevention:** Prefer native selects for ordinary settings choices with larger option sets. Use menu primitives when the richer menu behavior is actually needed, and test controls in their real dialog/portal nesting when dismissal or performance is reported.
**Skill/Doc Updates:** No general skill or architecture-doc change was needed; the local regression is recorded here.
