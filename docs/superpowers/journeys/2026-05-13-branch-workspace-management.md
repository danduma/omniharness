# Branch Workspace Management Agentic Journeys

These journeys are approval-gated. Run them only after explicit approval because they drive the UI and some create temporary git repositories or worktrees.

## Branch Button Discovery

- Running app: `http://localhost:3035`
- User role: builder starting a new OmniHarness session.
- Mission: verify the composer shows the current branch/workspace control and opens a usable workspace selector.
- Allowed interface: browser UI only, pointer, keyboard, accessibility tree.
- Forbidden shortcuts: no source inspection, no database queries, no backend logs.
- Expected completion proof: branch/workspace button is visible in the composer toolbar; opening it shows current workspace, status, refresh action, start-new-worktree action, and worktree list or empty state.
- Failure conditions: button is missing, selector cannot open, current workspace is ambiguous, or errors are hidden.

## Existing Worktree Run

- Running app: `http://localhost:3035`
- User role: builder reusing an existing isolated checkout.
- Mission: select an existing worktree, start a direct conversation, and confirm the run is pinned there.
- Allowed interface: browser UI plus setup of a temporary git repository/worktree before opening the app.
- Forbidden shortcuts: no source inspection; database checks only after UI proof if explicitly approved.
- Expected completion proof: run header shows the selected workspace badge and the worker card shows the same worktree path as its `cwd`.
- Failure conditions: selection mutates the current checkout, submit starts in the wrong directory, stale worktree selection is not explained, or worker `cwd` does not match.

## Start Session In New Branch Worktree

- Running app: `http://localhost:3035`
- User role: builder isolating new agent work.
- Mission: type a prompt, choose start in new worktree, confirm branch/path, submit once, and verify that the submit creates the branch-backed worktree and starts the run there.
- Allowed interface: browser UI plus `git worktree list` verification in the temporary repo after the UI completes.
- Forbidden shortcuts: no source inspection, no direct API calls.
- Expected completion proof: `git worktree list` includes the path, the worktree branch matches the confirmed branch, and OmniHarness shows the run pinned to that checkout.
- Failure conditions: branch/worktree is created before submit, branch/path differs from the confirmation, run starts in the original checkout, or errors are vague.

## Dirty Checkout Safety

- Running app: `http://localhost:3035`
- User role: cautious builder with uncommitted work.
- Mission: open the workspace selector in a dirty repo and attempt unsafe operations.
- Allowed interface: browser UI plus temporary repo setup.
- Forbidden shortcuts: no source inspection, no direct API calls.
- Expected completion proof: unsafe branch switching or dirty worktree removal is blocked with an actionable warning; `HEAD` remains unchanged.
- Failure conditions: operation proceeds, `HEAD` changes, dirty worktree is removed, or the UI hides the reason.

## Deleted Selected Worktree

- Running app: `http://localhost:3035`
- User role: builder whose selected checkout disappeared outside OmniHarness.
- Mission: select a worktree, remove it outside the app, then attempt to start a conversation.
- Allowed interface: browser UI plus external deletion of the temporary worktree path.
- Forbidden shortcuts: no source inspection, no backend logs.
- Expected completion proof: submit is blocked with a stale target explanation and no run starts in the wrong checkout.
- Failure conditions: run starts in the current checkout as a fallback, error lacks the deleted path, or the selection appears valid after refresh.

## Partial Start Failure Recovery

- Running app: `http://localhost:3035`
- User role: builder recovering from a failed isolated launch.
- Mission: force run creation to fail after worktree creation and verify the UI reports a pending orphan worktree.
- Allowed interface: browser UI and controlled failure injection approved for the test run.
- Forbidden shortcuts: no source edits during the journey, no hidden cleanup.
- Expected completion proof: UI shows the created branch/path and cleanup guidance after refresh.
- Failure conditions: orphan worktree is hidden, cleanup guidance is missing, or the user cannot tell whether the run exists.
