# Git Workspace Errors Are Project Owned

**Date:** 2026-05-20
**Context:** OmniHarness git workspace selector and fork worktree dialogs.
**Symptom:** Concurrent git operations in different projects shared one `lastError`, so an error from one project could appear on another project's workspace surface.
**Root Cause:** The manager had per-project request ids for status and operations, but its visible error slot was global. That left a race where the latest failed operation owned the error display everywhere.
**Fix:** `GitWorkspaceManager` now stores `lastErrorByProject` while keeping `lastError` as a compatibility summary. Branch and fork workspace selectors read the error for their current project.
**Verification:** Added a regression for concurrent project operation errors and ran `pnpm vitest run tests/app/git-workspace-manager.test.ts`.
**Prevention:** If async work is keyed by project, every visible byproduct of that work, including errors, must be keyed by the same owner token.
**Skill/Doc Updates:** Updated `docs/architecture/timing-determinism-audit.md`; no general skill update needed because project-scoped owner tokens are already covered by `client-server-state-invariants`.
