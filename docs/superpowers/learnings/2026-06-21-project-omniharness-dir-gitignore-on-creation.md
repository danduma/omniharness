# Gitignore Project Local OmniHarness State On Creation

**Date:** 2026-06-21
**Context:** Project-local `.omniharness/` state for config, memory, and run artifacts
**Symptom:** A newly created project-local `.omniharness/` directory could exist without a project `.gitignore` entry, making local runtime state easy to accidentally track.
**Root Cause:** Each subsystem created its own `.omniharness/` subdirectory directly, so there was no shared first-creation hook to create or amend the project `.gitignore`.
**Fix:** Centralized first creation through `ensureProjectOmniharnessDir`, which creates `.gitignore` if missing or appends `.omniharness/` when the entry is absent. Config, memory, and artifact writes now use the helper.
**Verification:** `./node_modules/.bin/vitest run tests/server/projects/config.test.ts tests/supervisor/memory-tools.test.ts tests/server/artifacts/project-root.test.ts`; `./node_modules/.bin/eslint src/server/projects/config.ts src/server/supervisor/memory-paths.ts src/server/artifacts/project-root.ts tests/server/projects/config.test.ts tests/supervisor/memory-tools.test.ts tests/server/artifacts/project-root.test.ts`
**Prevention:** Any future code that creates project-local OmniHarness state should call the shared project directory helper rather than directly mkdir-ing under `.omniharness/`.
**Skill/Doc Updates:** No general skill update needed; this is a project-specific persistence convention now covered by tests and this learning note.
