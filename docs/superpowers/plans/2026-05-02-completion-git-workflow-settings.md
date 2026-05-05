# Completion Git Workflow Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Settings controls for repository isolation and completed-run auto-commit behavior, with explicit copy explaining same-checkout risk and no branch creation.

**Architecture:** Persist workflow preferences in the existing settings key/value table, snapshot the relevant choices onto each implementation run at creation time, and execute any completion git behavior from the supervisor completion path. Keep checkout strategy and auto-commit independent: users may use same-checkout with or without auto-commit, or opt into worktrees with or without auto-commit. Branch creation remains forbidden in this product surface.

**Tech Stack:** Next.js App Router API routes, React components with existing Home UI manager state, Drizzle SQLite schema/migrations, Node `child_process` git helpers, Vitest for server logic, Playwright or in-app browser smoke testing for Settings UI.

**North Star Product:** OmniHarness becomes a trustworthy local agent control plane where users can choose the right isolation and finishing behavior per run without remembering fragile git rituals.

**Current Milestone:** Add the Settings design and backend plumbing for independent checkout strategy and auto-commit preferences, including same-checkout explanatory UI and durable completion events.

**Later Milestones / Deferred But Intentional:** Full worktree execution support, per-project workflow presets, manual "commit now" actions on completed runs, richer diff review before committing, and policy controls for ignored/untracked files are deferred unless explicitly requested.

**Final Functionality Standard:** This milestone delivers real persisted Settings controls and real completion behavior for same-checkout auto-commit. Worktree mode is exposed as an explicit preference only if the implementation also wires run creation and worker cwd behavior end-to-end; otherwise the UI must label worktree support as unavailable and not pretend it is active.

---

## Product Design

### Settings Surface

Add a third top-level Settings tab beside `LLM Settings` and `Worker Agents`:

- `Workflow`

Inside `Workflow`, use two compact sections. Match the existing settings dialog style: bordered section, small label, restrained copy, native checkbox/select controls, no modal-on-modal flow.

### Section 1: Checkout Strategy

Title:

`Checkout strategy`

Control:

`Run implementations in`

Options:

- `Same checkout`
- `Worktree`

Default:

`Same checkout`

Explanatory subtitle when `Same checkout` is selected:

`Agents work directly in the selected project checkout. OmniHarness never creates branches. Auto-commit only commits after the run completes, and it is skipped if the checkout was already dirty when the run started.`

Explanatory subtitle when `Worktree` is selected:

`OmniHarness may create a temporary git worktree for the run, but still never creates branches. Auto-commit remains a separate setting and can be on or off.`

Important implementation note:

Git worktrees normally require a branch or detached HEAD. Because branches are forbidden in this repository, a worktree implementation must use a detached HEAD worktree or another branchless strategy. If that cannot be made robust in this milestone, keep the `Worktree` option disabled with copy:

`Worktree support needs a branchless implementation before it can be enabled.`

### Section 2: Completion Actions

Title:

`Completion actions`

Control:

`Auto-commit completed implementation runs`

Default:

Off for existing users and new installs, unless the user later asks for a different default.

Subtitle:

`When an implementation run finishes successfully, OmniHarness can commit the resulting git changes. This setting is independent of checkout strategy.`

Same-checkout warning shown only when checkout strategy is `Same checkout` and auto-commit is enabled:

`Same-checkout commits are conservative: the run must start from a clean git status. If you edit files during the run or had local changes before it started, OmniHarness skips the commit and leaves the diff for review.`

### Per-Run Visibility

The selected defaults should be visible near the conversation composer when `Implementation` mode is selected:

- `Same checkout` or `Worktree`
- `Auto-commit off` or `Auto-commit on`

If there is room, expose per-run overrides in the composer settings area. If this would bloat the current composer, use read-only pills in this milestone and defer per-run overrides.

### Completion Timeline Events

The conversation timeline should show:

- `Auto-commit created: <short-sha> <subject>`
- `Auto-commit skipped: checkout was dirty when the run started`
- `Auto-commit skipped: no git changes`
- `Auto-commit failed: <short reason>`

Failure details should preserve git stderr in event details so the frontend can expose it through existing error/detail affordances.

## File Map

Files to modify:

- `src/app/home/types.ts`
  - Extend `SettingsTab` with `"workflow"`.
  - Add typed workflow setting helpers or constants if local patterns warrant it.

- `src/app/home/HomeUiStateManager.ts`
  - Add default settings keys:
    - `GIT_CHECKOUT_STRATEGY: "same_checkout"`
    - `GIT_AUTO_COMMIT_COMPLETED_RUNS: "false"`

- `src/components/home/SettingsDialog.tsx`
  - Add the `Workflow` tab.
  - Render checkout strategy and auto-commit controls.
  - Include dynamic explanatory subtitles for same-checkout and worktree behavior.
  - Keep state updates centralized through the existing `apiKeys` settings object.

- `src/app/home/HomeApp.tsx`
  - Pass and display workflow setting state where composer or run metadata needs it.
  - Include workflow preferences in implementation conversation creation requests if run-level snapshots are added.

- `src/server/db/schema.ts`
  - Add run-level columns if this milestone snapshots settings per run:
    - `checkoutStrategy`
    - `autoCommitOnComplete`
    - `gitBaselineJson`
    - `completionCommitSha`

- `src/server/db/index.ts`
  - Add idempotent migrations for any new run columns.

- `src/server/conversations/create.ts`
  - Read workflow settings when creating implementation runs.
  - Persist run-level snapshots so a later settings change does not mutate already-running conversations.
  - Capture git baseline for implementation runs with a project path.

- `src/server/git/status.ts` or `src/server/git/run-baseline.ts`
  - Create a focused git helper module for repository root detection, clean/dirty status, and baseline capture.

- `src/server/git/auto-commit.ts`
  - Implement conservative same-checkout auto-commit logic.
  - Emit structured result objects for `created`, `skipped`, and `failed`.

- `src/server/supervisor/index.ts`
  - After validation passes and `run_completed` is emitted, call the auto-commit helper if enabled for the run.
  - Insert `auto_commit_*` execution events with structured details.

- `src/app/home/utils.ts`
  - Add timeline labels for `auto_commit_created`, `auto_commit_skipped`, and `auto_commit_failed`.

Tests to add or update:

- `src/server/git/auto-commit.test.ts`
  - Same-checkout clean baseline with changes creates a commit.
  - Dirty baseline skips.
  - No changes skips.
  - Non-git project skips.
  - Git command failure returns a failed result without crashing completion.

- `src/components/home/SettingsDialog.test.tsx` if component tests exist, otherwise add focused Vitest/Testing Library coverage only if the repo already has that setup.
  - Workflow tab renders.
  - Same-checkout subtitle appears.
  - Auto-commit warning appears only when enabled in same-checkout mode.

Candidate agentic user journey tests, approval-gated:

- Start an implementation run in a clean temporary git repo with auto-commit enabled, let it complete, and verify the timeline shows a commit with a real SHA.
- Start a run in a dirty checkout with auto-commit enabled, let it complete, and verify the timeline shows a skipped commit and no new commit exists.

## Implementation Tasks

- [ ] Confirm current test tooling and add a minimal git-helper test harness
  - Inspect `package.json`, existing Vitest setup, and test naming patterns.
  - Create temporary git repositories inside test temp directories, not inside the project checkout.
  - Verification: run the new empty or skeleton git test file and confirm the test runner discovers it.

- [ ] Add workflow setting constants and UI defaults
  - Update `src/app/home/HomeUiStateManager.ts` with `GIT_CHECKOUT_STRATEGY` and `GIT_AUTO_COMMIT_COMPLETED_RUNS`.
  - Add parser helpers for the checkout strategy and boolean value in `src/app/home/utils.ts` if keeping them near existing setting parsers fits better than inline logic.
  - Verification: run TypeScript checking or targeted unit tests.

- [ ] Build the Settings `Workflow` tab
  - Extend `SettingsTab` in `src/app/home/types.ts`.
  - Add the third tab button in `src/components/home/SettingsDialog.tsx`.
  - Add `Checkout strategy` and `Completion actions` sections.
  - Use dynamic copy exactly enough to make same-checkout behavior understandable:
    - no branches,
    - same checkout means direct edits,
    - auto-commit is independent,
    - same-checkout auto-commit skips dirty baselines.
  - Verification: run TypeScript checking and inspect the Settings dialog in the browser.

- [ ] Decide and implement the worktree milestone boundary
  - If implementing branchless worktree support now, add a backend worktree allocator using detached HEAD or another branchless approach, with cleanup and error events.
  - If not implementing worktree support now, disable the `Worktree` option and keep the explanatory disabled copy. Do not store a selectable value that the backend ignores.
  - Verification: search for branch-creating commands and confirm none are introduced.

- [ ] Snapshot workflow settings onto implementation runs
  - Add run columns only if needed for durable per-run behavior.
  - Update idempotent DB migrations in `src/server/db/index.ts`.
  - Read settings in `src/server/conversations/create.ts` for implementation runs.
  - Persist `checkoutStrategy`, `autoCommitOnComplete`, and initial git baseline.
  - Verification: create a run through an API-level test or local smoke path and confirm persisted values do not change when global Settings are later edited.

- [ ] Implement git baseline capture
  - Add a server git helper that runs commands without shell interpolation.
  - Capture:
    - repository root,
    - `HEAD` SHA if present,
    - clean/dirty status,
    - short porcelain status for diagnostics.
  - Treat missing git repo as a structured non-fatal state.
  - Verification: unit tests cover clean repo, dirty repo, and non-git directory.

- [ ] Implement same-checkout auto-commit
  - Add `src/server/git/auto-commit.ts`.
  - Preconditions:
    - enabled for run,
    - checkout strategy is `same_checkout`,
    - project path resolves,
    - git repo exists,
    - baseline was clean,
    - current status has changes.
  - Run:
    - `git add -A`
    - `git commit -m <subject> -m <body>`
    - `git rev-parse --short HEAD`
  - Commit subject format:
    - `OmniHarness: <run title or plan summary>`
  - Commit body includes:
    - run id,
    - plan id,
    - completion summary,
    - note that no branch was created.
  - Verification: unit tests create a real commit and inspect `git log -1`.

- [ ] Wire auto-commit into supervisor completion
  - In `src/server/supervisor/index.ts`, call the helper after successful validation and run completion state persistence.
  - Insert execution events:
    - `auto_commit_created`
    - `auto_commit_skipped`
    - `auto_commit_failed`
  - Do not allow commit failure to turn a successfully completed implementation run into a failed run.
  - Verification: tests or a local smoke run confirm completion survives commit failure and the event is visible.

- [ ] Add frontend event summaries
  - Update `src/app/home/utils.ts` so auto-commit events render as readable timeline entries.
  - Include commit SHA in success labels.
  - Include skip reason or failure reason in skipped/failed labels.
  - Verification: unit test timeline formatting if existing utilities are tested; otherwise inspect with seeded or real events.

- [ ] Add composer/run visibility
  - Show compact workflow pills for implementation mode:
    - checkout strategy,
    - auto-commit state.
  - If adding per-run overrides, route them through the existing Home UI manager and conversation create payload; otherwise keep this read-only in the current milestone.
  - Verification: desktop and mobile browser inspection to ensure text does not overflow.

- [ ] Final verification
  - Run `pnpm lint` or the repo's established lint command.
  - Run `pnpm test` or targeted Vitest commands for new tests.
  - Run TypeScript checking if separate from lint.
  - Browser smoke test:
    - open Settings,
    - switch to Workflow,
    - toggle auto-commit,
    - confirm explanatory copy updates,
    - save and reload,
    - confirm values persist.
  - Git safety check:
    - `rg -n "checkout -b|switch -c|branch |git branch|worktree add" src`
    - Confirm no branch creation path exists.

## Acceptance Criteria

- Settings has a clear `Workflow` tab with independent checkout strategy and auto-commit controls.
- Same-checkout behavior is explained directly in the UI, including dirty-checkout skip behavior.
- Branch creation is not introduced anywhere.
- Auto-commit only runs after successful implementation completion.
- Auto-commit does not include unrelated pre-existing work because dirty baselines are skipped.
- Auto-commit failure is visible but does not reclassify a completed run as failed.
- Completion timeline shows created, skipped, and failed commit outcomes.
- Settings persist through the existing settings API.

## Self-Review Notes

- This plan intentionally separates worktree support from auto-commit behavior.
- This plan does not create branches or assume branch-based finishing.
- Same-checkout auto-commit is conservative by design because the checkout is shared with the human.
- If worktree support cannot be implemented without branches in the current milestone, the UI must not present it as functional.
