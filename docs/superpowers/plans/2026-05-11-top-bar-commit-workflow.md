# Top Bar Commit Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current top-bar auto-commit action picker with a commit workflow menu that controls milestone auto-commit and push policy while preserving manual commit actions.

**Architecture:** Keep OmniHarness as the owner of commit policy and run lifecycle. Persist `Auto-commit milestones` and `Always push on commit` as settings, snapshot the milestone policy onto implementation runs when needed, and reuse the existing prompt-driven commit conversations for manual `Commit now` actions. The top bar becomes the primary control surface for commit behavior, while the backend owns safe auto-commit execution after meaningful run milestones.

**Tech Stack:** Next.js App Router, React 19, TypeScript, existing Manager-based frontend state, shadcn/Base UI dropdown components, existing `Switch`, Drizzle SQLite settings, Vitest, Playwright or Browser smoke testing.

**North Star Product:** OmniHarness makes git handoff feel like a supervised part of agent work: the user can decide when commits happen, whether pushes follow commits, and see every outcome without remembering fragile commands.

**Current Milestone:** Ship the top-bar commit dropdown with two persisted switches and two manual actions, integrate `Auto-commit milestones` with the existing completion auto-commit design, and make `Always push on commit` apply consistently to auto and manual commit flows.

**Future Product Direction:** Commit policy can later grow into per-project presets, diff review before committing, and richer milestone definitions, but those are product context only and are not required for this milestone.

**Final Functionality Standard:** The user can open the active session's top-bar commit dropdown and see exactly:

```text
[ ] Auto-commit milestones
[ ] Always push on commit
---
Commit now
Commit and push now
```

Both switches persist, all visible strings are translated through `shared/locales/*.json`, manual actions still create real commit worker prompts, automatic milestone commits run only through OmniHarness-owned lifecycle code, and no branch or worktree is created.

---

## Product Commitments

- The top-bar button should no longer say `Auto commit`; it should represent manual commit workflow. Use `Commit now` when `Always push on commit` is off and `Commit & push` or equivalent compact copy when it is on.
- `Auto-commit milestones` means OmniHarness may commit after meaningful implementation milestones. For this milestone, define a meaningful milestone as a successful implementation run completion or an existing validation-backed completion point if the current completion flow already exposes one.
- `Always push on commit` means push after any OmniHarness-created commit, including auto-commit milestones and the primary `Commit now` action. The explicit `Commit and push now` menu item pushes regardless of the switch.
- Manual commit actions reuse the current top-bar chat prompt path where possible:
  - `Commit now` sends the existing commit-only prompt.
  - `Commit and push now` sends the existing commit-and-push prompt.
- The old dropdown choices `Auto commit` and `Auto commit & push` become the manual actions `Commit now` and `Commit and push now`; they should no longer be represented as mutually exclusive selected modes.
- The project sidebar's `Auto Commit Project` action should be renamed and aligned with this language, or explicitly documented as a separate project-level manual commit action if it remains in place.
- Do not create branches. Do not create worktrees.

## State Model

- Persist these server settings in the existing `settings` table:
  - `GIT_AUTO_COMMIT_MILESTONES`: `"false"` by default.
  - `GIT_PUSH_ON_COMMIT`: `"false"` by default.
- Mirror them into the existing home UI settings snapshot so the top-bar menu can render immediately after settings load.
- Do not store translated text in settings or transactions.
- If run-level auto-commit behavior is implemented in this pass, snapshot `GIT_AUTO_COMMIT_MILESTONES` and `GIT_PUSH_ON_COMMIT` onto implementation runs at creation time so changing the switch mid-run does not silently mutate already-running completion behavior.
- Keep high-churn dropdown open/close state local to the dropdown primitive. Keep persisted switch state in the existing Manager/settings flow.

## File Map

Files to modify:

- `src/app/home/constants.ts`
  - Add default server setting keys for milestone auto-commit and push-on-commit.
  - Replace the local-only `AUTO_COMMIT_CHAT_ACTION_STORAGE_KEY` behavior if it becomes obsolete.

- `src/app/home/HomeUiStateManager.ts`
  - Replace `AutoCommitChatAction` as stored preference with explicit commit action and policy types if needed.
  - Add manager-owned state only for UI behavior that is not already represented in server settings.

- `src/app/home/useHomeLifecycle.ts`
  - Remove localStorage hydration for the old selected auto-commit chat action if the server settings now own policy.
  - Preserve any local UI preference only if it remains genuinely local and not user-facing workflow policy.

- `src/app/home/HomeApp.tsx`
  - Read `GIT_AUTO_COMMIT_MILESTONES` and `GIT_PUSH_ON_COMMIT` from `apiKeys` / settings snapshot.
  - Add switch handlers that update the settings draft or save immediately through the existing settings API path.
  - Change the top-bar manual commit handler so `Commit now` uses the commit-only prompt and the primary button uses push behavior when `GIT_PUSH_ON_COMMIT` is enabled.
  - Keep explicit `Commit and push now` as an action that sends the push prompt even when the switch is off.

- `src/components/home/HomeHeader.tsx`
  - Replace the two-item selected-action dropdown with:
    - a row containing `Switch` and `Auto-commit milestones`,
    - a row containing `Switch` and `Always push on commit`,
    - `DropdownMenuSeparator`,
    - `Commit now`,
    - `Commit and push now`.
  - Import and use `DropdownMenuSeparator` and `Switch`.
  - Keep the menu compact, accessible, keyboard-friendly, and stable in width.
  - Use `t()` and `useI18nSnapshot()` for all user-facing strings.

- `src/components/home/ConversationSidebar.tsx`
  - Rename `Auto Commit Project` to the same manual language, likely `Commit project now`, with i18n.
  - If project-level push is supported in this milestone, provide a matching `Commit and push project now` action; otherwise keep only the current project commit behavior and make the top-bar plan explicit about session-level scope.

- `src/lib/conversation-visuals.ts`
  - Rename prompt constants to manual commit language while preserving existing prompt content.
  - Add a push-capable project prompt only if project-level push is included.

- `src/server/git/status.ts` or `src/server/git/run-baseline.ts`
  - Add or reuse git baseline helpers from the completion git workflow plan.

- `src/server/git/auto-commit.ts`
  - Implement or extend auto-commit behavior so it can optionally push after commit when `GIT_PUSH_ON_COMMIT` is true.
  - Return structured results for commit-created, push-created, skipped, and failed states.

- `src/server/conversations/create.ts`
  - Snapshot milestone and push settings onto implementation runs if auto-commit lifecycle behavior is implemented here.

- `src/server/supervisor/index.ts`
  - Invoke auto-commit after successful implementation milestones.
  - Emit execution events for commit and push outcomes.
  - Do not turn a successful run into a failed run if commit or push fails.

- `src/app/home/utils.ts`
  - Add readable timeline formatting for auto-commit and push events.

- `src/app/home/useAppErrors.ts`
  - Rename error action labels away from `Auto commit chat/project` where those labels surface to the user.

- `shared/locales/en.json` and every other file in `shared/locales/`
  - Add keys for:
    - `commit.menu.label`
    - `commit.menu.autoCommitMilestones`
    - `commit.menu.alwaysPushOnCommit`
    - `commit.menu.commitNow`
    - `commit.menu.commitAndPushNow`
    - `commit.menu.commitProjectNow`
    - `commit.status.autoCommitCreated`
    - `commit.status.autoCommitSkipped`
    - `commit.status.autoCommitFailed`
    - `commit.status.pushCreated`
    - `commit.status.pushFailed`
  - Convert touched existing hardcoded commit labels in the changed components.

Files to create:

- `src/server/git/auto-commit.test.ts`
  - Unit tests for auto-commit and push behavior in temporary git repos.

- `src/components/home/HomeHeader.test.tsx` only if the project already has or adds a light component-test pattern for React rendering.
  - Otherwise prefer source-level tests plus a browser smoke test.

Tests to update or add:

- `tests` or `src/server/git/auto-commit.test.ts`
  - Clean baseline with changes creates a commit.
  - Push-on-commit calls push after a commit.
  - Explicit commit-and-push action pushes regardless of persisted switch.
  - Dirty baseline skips auto-commit.
  - No changes skips auto-commit.
  - Push failure records failure without failing the completed run.

- Locale/static checks
  - Verify every new i18n key exists in every `shared/locales/*.json` file.
  - Verify changed top-bar commit strings are rendered through `t()`.

- UI smoke checks
  - Open an active session.
  - Open the top-bar commit menu.
  - Verify the two switches, separator, and two action rows appear in the requested order.
  - Toggle both switches and verify they persist after reload.

Candidate agentic user journey tests, approval-gated:

- Start a clean temporary git project, enable `Auto-commit milestones`, complete a small implementation run, and verify a real commit appears in the timeline.
- Enable `Always push on commit` against a temporary local bare remote, complete a milestone, and verify the commit is pushed.
- Use `Commit now` and `Commit and push now` from the top-bar menu in an active session and verify the correct prompt is sent and rendered.

`.gitignore` coverage:

- Existing `.gitignore` already excludes local DBs, journals, env files, logs, build outputs, Playwright reports, `.next`, coverage, temporary folders, and OmniHarness runtime artifacts.
- Tests must create temporary git repositories in OS temp directories or Vitest temp folders, not in the project checkout, so no new ignore rules should be required.

## Implementation Tasks

- [ ] **Step 1: Lock down current commit flow behavior with tests or source assertions**
  - Inspect `src/app/home/HomeApp.tsx`, `src/components/home/HomeHeader.tsx`, `src/components/home/ConversationSidebar.tsx`, and `src/lib/conversation-visuals.ts`.
  - Add focused tests for prompt selection helpers if they can be extracted cleanly.
  - Verification: run `pnpm test` for the new focused tests, or run `pnpm lint` if the first step is source-only.

- [ ] **Step 2: Introduce explicit commit workflow settings**
  - Add `GIT_AUTO_COMMIT_MILESTONES` and `GIT_PUSH_ON_COMMIT` to `DEFAULT_SERVER_SETTINGS`.
  - Add parser helpers such as `parseBooleanSetting` reuse or a small `parseCommitWorkflowSettings` helper if current utilities already support this pattern.
  - Remove reliance on `AUTO_COMMIT_CHAT_ACTION_STORAGE_KEY` for workflow policy.
  - Verification: run `pnpm lint` and any settings manager tests.

- [ ] **Step 3: Build the top-bar dropdown UI**
  - Update `HomeHeader` props to receive:
    - `autoCommitMilestonesEnabled`,
    - `pushOnCommitEnabled`,
    - `onAutoCommitMilestonesChange`,
    - `onPushOnCommitChange`,
    - `onCommitNow`,
    - `onCommitAndPushNow`.
  - Render the exact requested menu order with `Switch` controls and `DropdownMenuSeparator`.
  - Keep menu actions disabled while a commit prompt is pending.
  - Use `t()` for all labels, aria-labels, and titles.
  - Verification: run `pnpm lint`; inspect the menu in Browser or Playwright.

- [ ] **Step 4: Rewire manual commit actions**
  - Rename existing `AutoCommitChatAction` concepts to manual commit action concepts, for example `"commit"` and `"commit-push"` under `ManualCommitAction`.
  - Keep the existing commit-only and commit-and-push prompts.
  - Make the primary top-bar button invoke commit-and-push when `GIT_PUSH_ON_COMMIT` is enabled, otherwise commit-only.
  - Make `Commit now` always commit-only.
  - Make `Commit and push now` always commit-and-push.
  - Verification: unit-test prompt resolution and manually verify sent message content in an active session.

- [ ] **Step 5: Persist switch changes through the existing settings path**
  - Wire switch changes to the same settings API used by Settings.
  - Update `apiKeys` / settings state optimistically only after preserving current error handling patterns.
  - On API failure, surface the existing inline error mechanism with a translated action label.
  - Verification: toggle switches, reload, and confirm persisted values reload from `/api/settings`.

- [ ] **Step 6: Integrate milestone auto-commit with run lifecycle**
  - Use the prior completion git workflow plan as the backend base, but rename the setting from completed-run wording to milestone wording.
  - Capture baseline for implementation runs where auto-commit milestones are enabled.
  - On successful completion milestone, create a commit only if the baseline was clean and current git status has changes.
  - If `GIT_PUSH_ON_COMMIT` was enabled for that run, push after a successful commit.
  - Emit structured `execution_events` for created, skipped, failed, pushed, and push-failed outcomes.
  - Verification: run git helper tests against temporary repos.

- [ ] **Step 7: Align project-level commit entry points**
  - Rename sidebar `Auto Commit Project` to `Commit project now`.
  - Decide in code, not copy, whether project-level `Commit and push project now` is supported in this milestone. If supported, wire it to a real push prompt. If not supported, do not show the action.
  - Ensure project-level manual commit prompts remain direct conversations and do not create branches or worktrees.
  - Verification: browser smoke test on the project sidebar menu.

- [ ] **Step 8: Add translations**
  - Add every new key to `shared/locales/en.json`, `de.json`, `es.json`, `fr.json`, `it.json`, `ja.json`, `ko.json`, `pt.json`, and `zh-CN.json`.
  - Convert touched hardcoded commit labels in changed components.
  - Verification: run a locale key parity check with a small script or `node` one-liner, plus `pnpm lint`.

- [ ] **Step 9: Add timeline/status visibility**
  - Update `src/app/home/utils.ts` to render auto-commit and push outcome events.
  - Use concise translated labels and preserve detailed stderr in structured event details where available.
  - Verification: unit-test formatting if utility tests exist, otherwise seed or trigger events and inspect the running UI.

- [ ] **Step 10: Final verification**
  - Run `pnpm lint`.
  - Run targeted tests for git helpers, settings parsing, and prompt resolution.
  - Run `pnpm build` if the touched frontend/server boundary is broad.
  - Run `rg -n "Auto commit|Auto Commit|Auto commit &|Auto Commit Project" src shared/locales` and confirm old visible copy is either removed or intentionally preserved in non-visible compatibility identifiers.
  - Run `rg -n "checkout -b|switch -c|git branch|worktree add" src` and confirm no branch or worktree creation was introduced.

## Acceptance Criteria

- The active-session top-bar commit menu matches the requested structure and order.
- `Auto-commit milestones` persists and controls lifecycle-owned milestone commits.
- `Always push on commit` persists and applies to automatic commits and the primary manual commit button.
- `Commit now` and `Commit and push now` remain available as explicit manual actions.
- Existing prompt-driven commit behavior is reused where appropriate instead of duplicating a second manual commit system.
- Commit and push failures are visible but do not hide a successfully completed run.
- Every new user-facing string lives in all locale JSON files and is rendered with `t()`.
- No task creates a branch or worktree.

## Self-Review Notes

- Every requested menu item maps to a concrete UI and state task.
- The plan integrates existing top-bar prompt flows instead of replacing them with a fake backend shortcut.
- The auto-commit behavior stays OmniHarness-owned at lifecycle boundaries rather than agent-hook-owned.
- The push setting has explicit behavior for automatic commits, primary manual commits, and explicit manual push actions.
- The plan does not assume additional repository isolation.
