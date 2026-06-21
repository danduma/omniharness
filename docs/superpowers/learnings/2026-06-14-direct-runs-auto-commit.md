# Direct Runs Must Enter Milestone Workflows

**Date:** 2026-06-14
**Context:** OmniHarness commit workflow for agent conversations
**Symptom:** Enabling auto-commit milestones and push-on-commit did not commit when a direct agent finished its work.
**Root Cause:** Commit workflow settings, git baseline capture, and `runMilestoneAutoCommit` were scoped to `implementation` runs. Direct runs reached completion through `updateDirectRunStatusFromWorkerOutput`, bypassing the supervisor `mark_complete` path where milestone auto-commit was invoked.
**Fix:** Direct conversations now capture commit workflow metadata at creation, direct `done` transitions invoke milestone auto-commit, and the milestone runner accepts direct runs while still excluding planning and manual commit conversations.
**Verification:** Ran `PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" node_modules/.bin/vitest run tests/conversations/direct-run-status.test.ts tests/server/git/run-auto-commit.test.ts`, `PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH" node_modules/.bin/vitest run tests/api/conversations-route.test.ts`, and `git diff --check -- src/server/conversations/create.ts src/server/conversations/direct-run-status.ts src/server/git/run-auto-commit.ts tests/conversations/direct-run-status.test.ts tests/api/conversations-route.test.ts tests/server/git/run-auto-commit.test.ts`.
**Prevention:** When adding or debugging run lifecycle features, audit every completion path by mode. A workflow wired only through supervisor completion does not automatically cover direct, planning, or manual commit conversations.
**Skill/Doc Updates:** No skill update needed; `instrumenting-control-planes` already requires auditing server-side decisions and non-silent branches. This note records the project-specific mode split.
