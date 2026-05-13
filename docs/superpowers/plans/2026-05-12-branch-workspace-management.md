# Branch Workspace Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bottom-composer branch/workspace control that lets users inspect git state, choose the checkout a new conversation will use, and start a new session in its own branch-backed worktree with one explicit action.

**Architecture:** Add a server-owned git workspace service that uses structured git commands, not shell string parsing, and expose it through a dedicated `src/app/api/git/route.ts` control-plane API. A new frontend `GitWorkspaceManager` owns branch/worktree state, selected workspace preferences, pending confirmations, and operation errors, while conversations keep their launch workspace immutable through `runs.project_path`, worker `cwd`, and a minimal run-level git workspace snapshot.

**Tech Stack:** Next.js App Router already present in the repo, React 19, TypeScript, Manager-based frontend state, shadcn/Base UI popover/dialog/dropdown primitives, Drizzle SQLite, project `.omniharness/config.json`, git CLI via `child_process.execFile`, Vitest, Playwright/Browser approval-gated journey testing.

**North Star Product:** OmniHarness should make repository isolation feel like part of the agent workflow: before work starts, the user can see exactly where agents will operate, create an isolated workspace when needed, and recover from git problems with full transparency.

**Current Milestone:** Deliver full v2 branch/workspace management: status inspection, existing branch/worktree selection, one-command feature worktree creation, explicit branch checkout, existing worktree reuse, session/message fork into new worktree, safe cleanup, persistence, immutable run snapshots, execution-event visibility, i18n, deterministic tests, and approval-gated browser journeys.

**Future Product Direction:** This can later grow into PR creation, branch protection policy integration, remote branch sync helpers, and per-team workspace presets. Those are product context only; the checklist below is the complete current deliverable.

**Final Functionality Standard:** A user can open the composer branch button, understand the current git state, start a new conversation in a fresh worktree on its own new branch as one submit-time flow, fork an existing session or message checkpoint into a fresh branch-backed worktree, reuse an existing checkout when desired, and trust that OmniHarness will never silently switch branches, create branches, or create worktrees without an explicit user action and visible result.

---

## Product Commitments

- The control lives in the bottom composer toolbar because workspace choice is part of "where this next message/run goes."
- Active conversations are pinned to the workspace they started in. Changing the selector affects the next new conversation only, not a running or historical conversation.
- The obsolete repo-level "no file-based routing" instruction has been removed; implement the git control plane as `src/app/api/git/route.ts`.
- Starting a new session in a new worktree is not just a setup action: the user types the prompt, chooses the new worktree option, confirms branch/path, and the same conversation submit creates the branch-backed worktree and starts the run pinned to it.
- Git mutations are explicit:
  - selecting an existing worktree changes only the selected target for future runs,
  - switching the current checkout to an existing branch requires a confirmation dialog when the target is the current checkout,
  - creating a feature worktree creates a new branch and worktree together in one confirmed flow,
  - forking into a worktree creates a new branch and worktree together, then starts the forked run pinned to that worktree,
  - creating a worktree for an existing branch remains available for advanced/recovery cases, but it is not the primary new-session path,
  - cleanup/removal requires confirmation and never deletes uncommitted work.
- "Automatic git stuff" means OmniHarness refreshes status, detects repo/worktree topology, chooses the selected `cwd` for workers, records snapshots, warns about risk, and surfaces errors. It does not mean hidden branch/worktree mutation.
- New session isolation defaults to a fresh branch-backed worktree in a sibling directory outside the repository root, for example `<repo-parent>/<repo-name>-<branch-slug>`, and resolves branch/path collisions by suffixing with a counter such as `-2`, `-3`, then validating the final branch and path immediately before running git.
- Branch and path validation must be explicit: validate branch names with `git check-ref-format --branch`, reject path traversal and symlink escapes, require the resolved worktree path to remain under the configured worktree parent, re-stat parent/path immediately before `git worktree add`, and reject existing non-empty target directories.
- Detached checkouts display as `detached@<sha7>` in compact labels.
- Submodule repositories, Git LFS configuration, sparse-checkout, and hook failures are detected or surfaced as warnings/errors. Worktree creation may still proceed when safe, but the UI must show that hooks or repository extensions can affect setup.
- Dirty-state handling is conservative:
  - dirty current checkout blocks branch switching unless the user explicitly confirms an allowed safe path,
  - dirty worktrees cannot be removed,
  - detached HEAD and conflicted states are shown prominently and disable unsafe operations.
- No frontend user-facing strings may be hardcoded in JSX. All new labels, dialog titles, aria labels, placeholders, status text, errors, option labels, and help text must use `t()` with keys in every `shared/locales/*.json` file.
- Do not hide git operations inside `src/app/api/fs/route.ts`. Filesystem browsing and git workspace control have different auth, validation, tests, and error envelopes.
- Switching the current checkout to another branch is an advanced/recovery operation, not the primary path. Keep it visually secondary to creating or selecting isolated worktrees.

## User Stories

- As a builder starting work, I can see the current branch/worktree in the composer before I send a prompt.
- As a builder with several active sessions in one checkout, I can start the next session in a fresh worktree on its own new branch with one action, so that agent does not touch the shared checkout or commit into the shared branch.
- As a builder returning later, I can select an existing worktree and know new agents will use that path.
- As a builder reviewing a running conversation, I can see which checkout that run is pinned to.
- As a builder with a useful existing session, I can fork the whole session or fork from a message checkpoint into a new branch-backed worktree so the continuation is isolated from the original agents.
- As a cautious user, I get clear warnings before OmniHarness switches branches, creates branches, creates worktrees, removes worktrees, or starts a run in a dirty/conflicted checkout.
- As a debugger, I can see the raw git command, exit code, stderr summary, and structured error details when git operations fail.

## PM Pass

- Primary user: the human builder using OmniHarness to coordinate coding agents locally.
- Supporting jobs:
  - understand current repo state quickly,
  - avoid overlapping agent work in the same dirty checkout,
  - create safe isolation for parallel tasks,
  - reconnect old conversations to their real `cwd`,
  - recover from failed git operations without guessing.
- State model:
  - backend owns authoritative git state per project path,
  - frontend manager owns cached snapshots, selected workspace target, dialogs, and pending operation ids,
  - run records own immutable launch snapshots.
- Persistence model:
  - per-project preferred workspace target is stored in `.omniharness/config.json`,
  - run launch snapshot is stored in SQLite,
  - branch/worktree lists are discovered live from git and not treated as durable app state.
- Operational readiness:
  - all git operations have timeouts, structured errors, and event logging,
  - no operation shells through user-provided strings,
  - destructive operations require explicit confirmation and validation immediately before execution.
- Control plane:
  - deterministic server functions can be tested against temporary git repositories,
  - authenticated API actions support status refresh and operations,
  - execution events record run launch workspace snapshots and workspace warnings.
- Trust surface:
  - branch creation, checkout, worktree creation, and worktree removal are high-trust actions and must show exact target branch/path before execution.

## Product Completeness Pass

Baseline v2 surfaces and states:

- Composer branch button:
  - current branch or `detached`,
  - worktree indicator when selected target is a worktree,
  - dirty/conflict/ahead/behind badge icon,
  - loading and unavailable states.
- Popover/sheet:
  - current selected workspace,
  - repo status summary,
  - local branches,
  - remote branches if fetched/discoverable without mutation,
  - existing worktrees,
  - create worktree action,
  - refresh action,
  - operation errors with details expansion.
- Confirmation dialogs:
  - switch current checkout,
  - start session in new branch worktree,
  - fork session into new branch worktree,
  - fork from message into new branch worktree,
  - create worktree from existing branch,
  - remove/prune worktree.
- Run visibility:
  - active/historical run shows pinned branch/worktree path in the header or workspace side window,
  - worker cards continue to show real `cwd`.
- Empty/unavailable states:
  - no git repository,
  - git unavailable,
  - no branches beyond current,
  - no extra worktrees,
  - repo path missing or permission denied.
- Recovery states:
  - conflicted checkout,
  - dirty checkout,
  - stale worktree path,
  - pending orphan worktree after a partial fork/start failure,
  - parent fork workspace missing,
  - fork source message no longer available,
  - branch already checked out elsewhere,
  - branch name collision,
  - path collision,
  - git command timeout.

## State And Data Model

Types to introduce:

```ts
type GitWorkspaceKind = "current_checkout" | "worktree";

type GitRepositoryIdentity = {
  repoRoot: string;
  gitCommonDir: string;
};

type GitWorkspaceTarget = {
  kind: GitWorkspaceKind;
  repoRoot: string;
  gitCommonDir: string;
  checkoutPath: string;
  branchName: string | null;
  worktreeId: string | null;
};

type GitWorkspaceSnapshot = {
  repoRoot: string;
  gitCommonDir: string;
  checkoutPath: string;
  headSha: string | null;
  branchName: string | null;
  detachedLabel: string | null;
  isDetached: boolean;
  isBare: boolean;
  dirtyFileCount: number;
  conflictedFileCount: number;
  aheadCount: number | null;
  behindCount: number | null;
  statusFingerprint: string;
  worktrees: GitWorktreeSummary[];
  branches: GitBranchSummary[];
  warnings: GitWorkspaceWarning[];
  refreshedAt: string;
};

type GitWorkspaceRunSnapshot = {
  target: GitWorkspaceTarget;
  headSha: string | null;
  branchName: string | null;
  detachedLabel: string | null;
  dirtyFileCount: number;
  conflictedFileCount: number;
  aheadCount: number | null;
  behindCount: number | null;
  warnings: GitWorkspaceWarning[];
  selectedAt: string;
};
```

SQLite additions:

- `runs.git_workspace_json text`
  - immutable launch snapshot containing only load-bearing pin data: selected target, `headSha`, branch/detached label, dirty/conflict counts, ahead/behind counts, and warnings.
  - Do not persist full `branches[]` or `worktrees[]` topology on runs; those lists are live discovery state and can be large.
- `execution_events.details`
  - already exists; add structured event details for workspace launch, warnings, operations, and failures.

Project config additions in `.omniharness/config.json`:

- `git.workspace.defaultTarget`
  - selected checkout path, branch/worktree metadata, repo root, and git common-dir identity for future new conversations in that project.
  - On load, validate the saved target still belongs to the same repository identity before using it; if the target is stale or belongs to a different repository, warn and fall back to the current checkout without deleting the saved value.
- `git.workspace.worktreeParent`
  - optional user-managed preferred parent directory for new worktrees.

Frontend Manager:

- Create `src/app/home/GitWorkspaceManager.ts`.
- Own:
  - per-project git snapshots,
  - selected target by project root,
  - loading/pending operation states,
  - active confirmation dialog state,
  - last structured error.
- Components subscribe with narrow selectors through `useManagerSelector`.
- High-churn UI state such as search text or branch filter stays scoped to the popover component unless it must survive close/reopen.

## File Map

Files to create:

- `src/server/git/command.ts`
  - Safe `execFile` wrapper, timeout handling, cwd validation, structured `GitCommandError`.
- `src/server/git/status.ts`
  - Repo discovery, status parsing, branch parsing, upstream/ahead/behind parsing, worktree parsing.
- `src/server/git/workspaces.ts`
  - Workspace target validation, checkout existing branch, create worktree, remove/prune worktree, snapshot building.
- `src/app/api/git/route.ts`
  - Dedicated authenticated git workspace control-plane route with request parsing, same-origin enforcement for mutations, structured error responses, and no dependency on `src/app/api/fs/route.ts`.
- `src/server/git/workspaces.test.ts`
  - Temporary git repository tests for status, selection, creation, dirty blocking, and cleanup safety.
- `src/app/home/GitWorkspaceManager.ts`
  - Frontend state owner and API client methods.
- `src/components/home/BranchWorkspaceButton.tsx`
  - Composer toolbar button, popover/sheet shell, branch/worktree lists, operation actions.
- `src/components/home/BranchWorkspaceDialogs.tsx`
  - Confirmation dialogs for git-mutating operations.
- `src/components/home/RunWorkspaceBadge.tsx`
  - Compact immutable run workspace indicator for selected runs.
- `src/lib/git-workspace.ts`
  - Shared frontend-safe types and formatting helpers.

Files to modify:

- `src/app/api/conversations/route.ts`
  - Accept either an existing selected `GitWorkspaceTarget` or a confirmed new-worktree launch request for submit-time conversation starts.
- `src/server/db/index.ts`
  - Add migration for `runs.git_workspace_json`.
- `src/server/db/schema.ts`
  - Add `gitWorkspaceJson` to `runs`.
- `src/app/home/types.ts`
  - Add `gitWorkspaceJson` to `RunRecord`.
- `src/server/conversations/create.ts`
  - Accept selected git workspace target or new-worktree launch request, validate it server-side, create the worktree when requested, set `projectPath` to the selected checkout path, and persist run snapshot.
- `src/app/home/useHomeMutations.ts`
  - Send selected workspace target or confirmed new-worktree launch request when starting a new conversation.
  - Preserve existing attachment and worker selection behavior.
- `src/app/home/useHomeViewModel.ts`
  - Resolve current project and selected workspace without broad high-churn subscriptions.
- `src/app/home/ComposerContainer.tsx`
  - Pass stable workspace props/actions into the composer.
- `src/components/home/ConversationComposer.tsx`
  - Add the branch/workspace button to the bottom toolbar with responsive behavior.
- `src/components/home/HomeHeader.tsx`
  - Show immutable selected-run workspace badge where appropriate.
- `src/components/home/WorkersSidebar.tsx` or `src/components/WorkerCard.tsx`
  - Keep real worker `cwd` visible and align copy with workspace selection.
- `src/app/home/utils.ts`
  - Render git workspace execution events and warnings.
- `src/server/projects/config.ts`
  - Add typed helpers for project git workspace settings.
- `shared/locales/*.json`
  - Add every new user-facing string key to all locale files.

Tests to add or update:

- `src/server/git/workspaces.test.ts`
- Existing API tests if present; otherwise focused Vitest server tests.
- Locale parity check for new keys.
- Browser/Playwright smoke test for the branch button and dialogs, approval-gated before running.

`.gitignore` coverage:

- Git tests must use OS temp directories or test runner temp folders.
- New worktree defaults are outside the repo and should never be created during tests against this checkout.
- Existing ignore coverage is sufficient if tests avoid writing generated worktrees inside `/Users/masterman/NLP/omniharness`.

## API Contract

Use a dedicated git API contract hosted at `src/app/api/git/route.ts`. Suggested operations:

- `status`
  - input: `{ projectPath }`
  - output: `GitWorkspaceSnapshot`
- `select`
  - input: `{ projectPath, target, expectedHeadSha, expectedStatusFingerprint }`
  - output: persisted target and refreshed snapshot
- `checkout_existing_branch`
  - input: `{ projectPath, branchName, expectedHeadSha, expectedStatusFingerprint, allowDirty: false }`
  - output: refreshed snapshot and operation event details
- `create_worktree_existing_branch`
  - input: `{ projectPath, branchName, checkoutPath, expectedHeadSha, expectedStatusFingerprint }`
  - output: new target, refreshed snapshot
- `prepare_session_worktree`
  - input: `{ projectPath, newBranchName, checkoutPath, startPoint, expectedHeadSha, expectedStatusFingerprint, selectForNextRun: true }`
  - output: new target, persisted selected target, refreshed snapshot
  - use when the user explicitly wants to create/select a worktree before submitting a prompt.
- `/api/conversations` submit-time new-worktree launch
  - input: existing conversation payload plus `{ gitWorkspaceLaunch: { mode: "new_worktree", projectPath, newBranchName, checkoutPath, startPoint, expectedHeadSha, expectedStatusFingerprint } }`
  - output: created run id, new target, run launch snapshot, refreshed snapshot, and normal conversation response fields.
  - use for the primary "Start in new worktree" composer flow so worktree creation and run launch feel like one explicit action.
- `fork_run_worktree`
  - input: `{ runId, targetMessageId?: string, contentOverride?: string, newBranchName, checkoutPath, startPoint, expectedHeadSha, expectedStatusFingerprint }`
  - output: new run id, new target, run launch snapshot, refreshed snapshot
- `remove_worktree`
  - input: `{ projectPath, checkoutPath, expectedHeadSha, expectedStatusFingerprint, pruneOnly?: boolean }`
  - output: refreshed snapshot

Mutation handlers must re-read git state immediately before executing the command and reject stale confirmations. `expectedHeadSha` catches committed movement; `expectedStatusFingerprint` catches dirty/conflict changes that do not move `HEAD`. Worktree creation plus conversation/fork creation is not perfectly database-transactional because `git worktree add` mutates the filesystem; if the DB step fails after git succeeds, persist and return a `pending_orphan_worktree` recovery detail so the UI can keep showing cleanup guidance after refresh.

## Implementation Tasks

- [ ] **Step 1: Add test scaffolding for git workspace services**
  - Create temporary repo helpers in `src/server/git/workspaces.test.ts`.
  - Cover local branch, remote branch, dirty tree, conflict-like porcelain output if practical, and multiple worktrees.
  - Verification: run `pnpm test src/server/git/workspaces.test.ts`.

- [ ] **Step 2: Implement safe git command primitives**
  - Create `src/server/git/command.ts`.
  - Use `execFile("git", args, { cwd, timeout })`.
  - Return stdout/stderr/exit code and throw structured errors with redacted command details.
  - Reject non-absolute cwd and missing directories before invoking git.
  - Verification: run the new git command tests and `pnpm lint`.

- [ ] **Step 3: Implement git status discovery**
  - Create `src/server/git/status.ts`.
  - Parse `git rev-parse`, `git status --porcelain=v2 --branch`, `git branch --format`, and `git worktree list --porcelain`.
  - Build `GitWorkspaceSnapshot` with branches, worktrees, dirty count, conflicts, ahead/behind, detached state, compact detached labels, status fingerprint, and warnings.
  - Detect submodule repositories, sparse-checkout, and Git LFS configuration where practical; otherwise preserve command output that explains why detection failed.
  - Verification: tests cover clean, dirty, detached, ahead/behind where a local bare remote can be created.

- [ ] **Step 4: Implement workspace operations**
  - Create `src/server/git/workspaces.ts`.
  - Implement validation and operations for selecting existing worktrees, checking out existing branches, creating a new branch-backed session worktree as one operation, creating worktrees from existing branches for advanced cases, pruning stale worktrees, and removing clean worktrees.
  - Add a helper that can create a branch-backed worktree for an existing run fork without mutating the parent run checkout.
  - Generate collision-free branch/path suggestions by applying deterministic numeric suffixes and validating both branch names and directories before execution.
  - Validate branch names with `git check-ref-format --branch`.
  - Resolve and validate worktree paths under the configured worktree parent; reject path traversal, symlink escapes, existing non-empty directories, and final paths outside the parent after `realpath`/path resolution.
  - Re-read status and re-stat the selected parent/path immediately before `git worktree add`.
  - Do not use shell string commands.
  - Block dirty removal and stale branch checkout confirmations.
  - Detect branch-already-checked-out-in-another-worktree and return a specific actionable error.
  - Verification: tests prove no operation runs when preconditions fail, including when a dirty file appears between the user's status read and the mutation call.

- [ ] **Step 5: Persist run workspace snapshots**
  - Add `runs.git_workspace_json` in `src/server/db/index.ts` and `src/server/db/schema.ts`.
  - Add `gitWorkspaceJson` to `RunRecord` in `src/app/home/types.ts`.
  - In `src/server/conversations/create.ts`, validate the selected target or confirmed new-worktree launch request server-side, set `projectPath` to the final checkout path, and persist a launch snapshot.
  - In fork recovery/run creation paths, persist a fresh workspace snapshot for the forked run instead of copying the parent run's workspace snapshot.
  - Persist `GitWorkspaceRunSnapshot`, not full live topology.
  - Emit a `git_workspace_selected` execution event with warnings.
  - Verification: create-conversation tests or manual API request shows `project_path` and `git_workspace_json` agree.

- [ ] **Step 6: Add project-level workspace preferences**
  - Extend `src/server/projects/config.ts` with typed git workspace get/set helpers.
  - Persist selected default target, repo root, git common-dir identity, and optional worktree parent in `.omniharness/config.json`.
  - Validate persisted targets on load; if stale or from a different repository identity, return a warning and fall back to current checkout without deleting the saved value.
  - Verification: unit tests for config read/write and stale target handling.

- [ ] **Step 7: Extend the authenticated API surface**
  - Add a dedicated `src/app/api/git/route.ts` backed by `src/server/git/*`.
  - Do not put git actions in `src/app/api/fs/route.ts`.
  - Require API session for reads and same-origin for mutations.
  - Return structured errors with `source: "Git workspace"` and action-specific labels.
  - Add `status`, `select`, `checkout_existing_branch`, `prepare_session_worktree`, `create_worktree_existing_branch`, `fork_run_worktree`, and `remove_worktree` operations.
  - Add a fork-into-worktree operation that coordinates git worktree creation and run forking in one backend transaction boundary where possible; if run creation fails after worktree creation, persist and return `pending_orphan_worktree` details for user-visible cleanup instead of hiding the partial result.
  - Verification: API-level tests or manual `fetch` checks for status and one rejected stale mutation.

- [ ] **Step 8: Create `GitWorkspaceManager`**
  - Own snapshots, selected targets, loading states, pending operations, dialogs, and errors.
  - Provide methods: `loadStatus`, `selectTarget`, `requestCheckout`, `confirmCheckout`, `requestStartInNewWorktree`, `confirmStartInNewWorktree`, `requestCreateWorktree`, `confirmCreateWorktree`, `requestRemoveWorktree`, `confirmRemoveWorktree`, `clearError`.
  - Store the confirmed new-worktree launch request separately from the persisted selected target until composer submit succeeds.
  - Use narrow selectors in UI consumers.
  - Verification: manager unit tests for state transitions if existing Manager tests are available; otherwise run `pnpm lint` and exercise through UI.

- [ ] **Step 9: Build the composer branch button**
  - Add required locale keys before rendering new JSX text.
  - Create `BranchWorkspaceButton`.
  - Show branch/worktree label, dirty/conflict indicator, loading state, and disabled no-repo state.
  - Show detached checkouts as `detached@<sha7>`.
  - Desktop: popover anchored to composer toolbar.
  - Mobile: sheet/dialog that preserves tap targets and avoids text overflow.
  - Use lucide icons for branch, worktree/folder, refresh, warning, and cleanup actions.
  - Verification: Browser screenshot at desktop and mobile widths; no overlapping text.

- [ ] **Step 10: Build branch/worktree selection and creation UI**
  - Add required locale keys alongside each new control, dialog, error, and empty state.
  - Primary action is `Start in new worktree` from the composer workspace control.
  - The primary flow asks for a branch name, shows the generated worktree path, lets the user adjust the path, stores the confirmed launch request in `GitWorkspaceManager`, and on the next composer submit creates the branch/worktree and starts the run pinned there.
  - Existing branch list supports selecting for current checkout or creating a worktree from that branch as an advanced action.
  - Current-checkout branch switching is visually secondary and grouped under advanced/recovery actions.
  - Worktree list supports selecting existing worktree and clean removal/prune actions.
  - Create-worktree forms include base/source selector, branch name when a new branch is created, computed path, path edit field, and validation.
  - Confirmation dialogs show exact branch, path, repo root, and consequence.
  - Keep the surface compact; helper text only explains consequences and constraints.
  - Verification: UI smoke test all dialogs and validation errors.

- [ ] **Step 11: Add fork into new worktree UI**
  - Add required locale keys alongside each new action and dialog string.
  - Add `Fork session into new worktree` to the selected run/session action surface.
  - Extend the existing message action currently labeled `Fork from here` with a sibling action `Fork from here into new worktree`.
  - The fork dialog uses the same branch/path suggestion and validation model as `Start in new worktree`.
  - The backend copies/forks the conversation using existing `parentRunId` and `forkedFromMessageId` semantics, but assigns the forked run's `projectPath` and `git_workspace_json` to the newly-created worktree.
  - Verification: fork a run into a temp worktree and confirm parent and child runs have different pinned checkout paths.

- [ ] **Step 12: Wire composer run creation**
  - In `ComposerContainer` and `useHomeMutations`, send either the selected `GitWorkspaceTarget` or the confirmed `new_worktree` launch request with new conversation creation.
  - Extend `src/app/api/conversations/route.ts` and `src/server/conversations/create.ts` so the primary "Start in new worktree" submit validates stale state, creates the worktree, persists the target preference when requested, persists `git_workspace_json`, and starts the run in the new checkout path as one user-visible action.
  - Ensure selected workspace does not mutate active selected runs.
  - If selected target is invalid at submit time, including a worktree deleted on disk after selection, block submit and show the git error instead of starting a run in the wrong path.
  - Verification: start a direct/planning/implementation conversation from a selected worktree and confirm worker `cwd` equals the worktree path.

- [ ] **Step 13: Add run-level workspace visibility**
  - Add required locale keys before rendering new badge/timeline text.
  - Create `RunWorkspaceBadge`.
  - Show pinned branch/worktree in `HomeHeader` or side window for selected runs.
  - For historical runs with no snapshot, fall back to `projectPath` and worker `cwd`.
  - Render workspace warnings in the activity timeline.
  - Verification: selected run displays immutable workspace even after changing composer selection.

- [ ] **Step 14: Audit i18n coverage**
  - Confirm keys for button labels, menu sections, statuses, dialogs, form labels, warnings, operation outcomes, API action labels, and empty states exist in every file in `shared/locales/`.
  - Convert all touched hardcoded strings in modified components.
  - Verification: run locale parity script or `node` one-liner and `rg` for visible hardcoded branch/worktree copy in touched files.

- [ ] **Step 15: Add event and error transparency**
  - Emit execution events for workspace selection, workspace warnings, checkout operation, worktree creation, worktree removal/prune, and operation failure.
  - Emit fork-specific events when a run/message checkpoint is forked into a new worktree.
  - Persist and render `pending_orphan_worktree` recovery details when git worktree creation succeeds but conversation or fork creation fails afterward.
  - Preserve stderr summaries and command context in details without exposing unnecessary environment data.
  - Update `src/app/home/utils.ts` to render concise translated timeline text.
  - Verification: trigger a failed operation in a temp repo and confirm UI shows useful details.

- [ ] **Step 16: Full deterministic verification**
  - Run `pnpm lint`.
  - Run targeted git workspace tests.
  - Run `pnpm test` if runtime allows.
  - Run `pnpm build` because this touches server, DB schema, and frontend boundaries.
  - Run `rg -n "git checkout|git switch|git worktree|branch" src` and inspect every occurrence for explicit safeguards.
  - Run `rg -n ">[^<{]*(branch|worktree|checkout|dirty|conflict|create|remove)" src/components src/app` and verify touched user-facing copy uses `t()`.
  - Verify `runs.git_workspace_json` snapshots do not contain full branch or worktree arrays.

## Approval-Gated Agentic Journey Tests

- Branch button discovery:
  - Entry: open `http://localhost:3035` with an existing project.
  - Mission: verify the composer shows the current branch and opens a usable workspace selector.
  - Proof: screenshot of button, popover, and status summary.
- Existing worktree run:
  - Entry: temp git repo with a pre-created worktree.
  - Mission: select the worktree, start a conversation, confirm worker `cwd`.
  - Proof: run header badge and worker card show the worktree path.
- Start session in new branch worktree:
  - Entry: temp git repo with a clean branch.
  - Mission: type a prompt, choose `Start in new worktree`, confirm branch/path, submit once, and verify that submit creates the branch-backed worktree and starts a run there.
  - Proof: `git worktree list` includes the path, `git branch --show-current` in that worktree shows the new branch, and OmniHarness run is pinned there.
- Fork session into new worktree:
  - Entry: existing conversation in a shared checkout.
  - Mission: use the session action to create a branch-backed worktree and fork the conversation there.
  - Proof: parent and child runs have different `projectPath` values, the child has `parentRunId`, and the child worker `cwd` is the new worktree.
- Fork from message into new worktree:
  - Entry: existing conversation with several user messages.
  - Mission: fork from a message checkpoint into a branch-backed worktree.
  - Proof: child run has `forkedFromMessageId`, copied messages stop at the checkpoint, and the child worker `cwd` is the new worktree.
- Dirty checkout safety:
  - Entry: repo with uncommitted changes.
  - Mission: attempt branch switch/removal and verify blocking warnings.
  - Proof: dialog/error prevents unsafe operation and does not change `HEAD`.
- Branch already checked out elsewhere:
  - Entry: temp git repo with one branch already checked out in another worktree.
  - Mission: attempt to create or checkout that branch in an incompatible workspace.
  - Proof: UI shows a specific actionable error and no checkout/worktree mutation occurs.
- Deleted selected worktree:
  - Entry: select an existing worktree, then remove that directory outside OmniHarness.
  - Mission: attempt to start a conversation.
  - Proof: submit is blocked, the stale target is explained, and no run starts in the wrong checkout.
- Partial start/fork failure recovery:
  - Entry: force the DB/run creation step to fail after a temp worktree is created.
  - Mission: verify OmniHarness reports a pending orphan worktree instead of hiding the partial result.
  - Proof: UI shows the created path/branch and offers cleanup guidance after refresh.

These journeys require explicit user approval before running because they drive the UI and create temporary git repositories/worktrees.

## Acceptance Criteria

- The composer bottom toolbar contains a translated branch/workspace control.
- The control accurately reports no-repo, clean, dirty, conflicted, detached, ahead/behind, branch, and worktree states.
- The user can select an existing worktree for future conversations.
- The user can explicitly switch the current checkout to an existing branch after confirmation and stale-state validation.
- The user can start a new conversation in a new branch-backed worktree through one composer submit-time flow.
- The user can fork an existing session into a new branch-backed worktree.
- The user can fork from a message checkpoint into a new branch-backed worktree.
- The user can explicitly create a worktree from an existing branch.
- The user can prune stale worktrees and remove only clean worktrees after confirmation.
- New conversations launch in the selected checkout path.
- Active and historical conversations remain pinned to their launch workspace.
- Runs persist `git_workspace_json` and workers continue to persist real `cwd`.
- `runs.git_workspace_json` contains only minimal launch pin data and never stores full branch/worktree topology.
- Git operation errors preserve actionable detail in API responses and UI.
- Stale confirmations are rejected using both `expectedHeadSha` and `expectedStatusFingerprint`.
- Deleted selected worktrees are detected before conversation creation.
- Branch names are validated with `git check-ref-format --branch`; worktree paths reject traversal, symlink escapes, existing non-empty target directories, and resolved paths outside the configured worktree parent.
- Persisted default targets include repo identity and are ignored with a warning if they no longer belong to the same repository.
- Partial failures after worktree creation persist and render `pending_orphan_worktree` recovery details.
- Branch-already-checked-out-in-another-worktree errors are handled explicitly.
- Submodules, sparse-checkout, Git LFS, and hook failures produce warnings or actionable errors.
- Every new user-facing string is translated through `shared/locales/*.json` and rendered with `t()`.
- No new branch or worktree is created automatically by status refresh, selection, page load, or plain run start without a confirmed new-worktree launch request.
- No branch or worktree is created in this repository during implementation verification unless the user explicitly asks for that specific operation.
