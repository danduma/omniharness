# Claude GPT-5.6 Live Lifecycle Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task by task. Mark a checkbox only after its stated evidence has been run and read.

**Goal:** Add a safe, repeatable human-level test journey that proves Claude Code can use `GPT-5.6 SOL` at Low effort across interrupt, multi-session switching, stop, resume, reload, and reconnect, then fix every confirmed state or delivery bug with deterministic regression coverage.

**Architecture:** Keep one production control plane and add an opt-in Playwright consumer of it. All mutations in the live journey use the real UI; canonical snapshots, named events, targeted route reads, SQLite, and unified worker JSONL act only as after-action oracles. The runner owns a marked temporary project and a manifest of exact run IDs so real-agent testing cannot touch the repository or unrelated conversations.

**Tech Stack:** Next.js 15, React 19, TypeScript, global Manager classes, Playwright, Vitest, lifecycle HTTP/SSE harness, SQLite/Drizzle, unified worker JSONL, CLIProxyAPI, Claude Code ACP.

**Design specification:** `docs/superpowers/specs/2026-07-13-claude-gpt56-live-lifecycle-journey-design.md`

**North Star Product:** A provider-agnostic conformance suite that every OmniHarness CLI/model combination must pass for create, work, steer, queue, interrupt, switch, stop, resume, reconnect, reload, and cleanup.

**Current Milestone:** Real Claude Code through `cliproxyapi:gpt-5.6-sol` at Low effort in one disposable project with three conversations and the full lifecycle journey.

**Future Product Direction:** Add profile data for native Claude, Codex, Gemini, OpenCode, and later gateway models only after the current profile is reliable. This context is not part of the implementation checklist below.

**Final Functionality Standard:** The milestone is complete only when the real browser journey passes twice from fresh state, every discovered defect has a red-green deterministic regression, server evidence agrees with the visible UI, and only journey-owned data is cleaned up.

---

## Execution rules

- [ ] Work directly in the current checkout. Never create a branch or worktree.
- [ ] Preserve all unrelated dirty-worktree changes and do not reformat touched files broadly.
- [ ] Do not delete any existing source file, conversation, project, branch, or artifact.
- [ ] Use `apply_patch` for source and test edits.
- [ ] Reuse the already-running app at `http://localhost:3035` (or the configured local URL); do not start a competing dev server.
- [ ] Read `docs/architecture/lifecycle-observability-and-testing.md`, `docs/architecture/worker-conversation-stream.md`, and `docs/architecture/direct-control-session-regressions.md` before changing server lifecycle behavior.
- [ ] Use the unified worker stream through `appendWorkerEntry`; do not add another transcript store.
- [ ] Emit typed named events for every new server decision and `error.surfaced` for every new user-relevant failure.
- [ ] Put any new visible copy in every `shared/locales/*.json` file and render it through `t()`; prefer no new product copy for the harness.
- [ ] Keep shared client state in the existing Manager classes. Every async mutation, snapshot, timer, and stream callback must prove current ownership before updating visible state.
- [ ] Write the failing deterministic test before each production fix and watch the expected failure.
- [ ] Use condition-based waits tied to visible or durable state. Do not make fixed sleeps the primary synchronization mechanism.
- [ ] Cap each real worker turn at eight active minutes, fail after two minutes with no visible transition or new durable owned-run evidence, and cap one full journey at forty-five minutes. On a limit, use the visible Stop control before cleanup.
- [ ] Keep real-agent tests opt-in and out of normal `pnpm test`, default Playwright, and CI.
- [ ] Keep passwords, gateway tokens, OAuth data, session cookies, and unrelated conversation content out of test output and source control.

## File map

### New live-journey harness

- `playwright.live.config.ts`: opt-in configuration for an already-running local app; one worker, no retries, long per-test deadline, and trace/screenshot retention on failure.
- `tests/e2e/live/types.ts`: journey manifest, checkpoint, owned run, gateway preflight, and redacted evidence contracts.
- `tests/e2e/live/safety.ts`: loopback validation, temp-root containment, ownership-marker checks, repository/project exclusion, explicit real-agent opt-in, and secret-free manifest helpers.
- `tests/e2e/live/auth.ts`: unlock the real local app from a runtime-only password without storing it in source or the durable report.
- `tests/e2e/live/omniharness-ui.ts`: stable browser operations for folder selection, harness/model/effort selection, conversation creation, switching, interrupt/send-now, stop, resume/follow-up, reload, and visible-state capture.
- `tests/e2e/live/control-plane-oracle.ts`: read-only canonical snapshot, event-log, worker-entry, and targeted run evidence for journey-owned IDs.
- `tests/e2e/live/project-fixture.ts`: create the marked dependency-free temporary project and remove it only after ownership and containment checks pass.
- `tests/e2e/live/checkpoint-reporter.ts`: write bounded, redacted ignored artifacts and a step-by-step UI/server comparison.
- `tests/e2e/live/claude-gpt56-lifecycle.spec.ts`: the three-conversation live journey and final filesystem assertions.
- `scripts/cleanup-live-agent-journey.ts`: recover cleanup from an interrupted run using a manifest path, targeted run IDs, and the ownership marker; never bulk-delete conversations.
- `tests/e2e/live/safety.test.ts`: deterministic tests for all guard and cleanup-refusal cases.
- `tests/e2e/live/checkpoint-reporter.test.ts`: deterministic redaction and mismatch-report tests.

### Existing configuration and scripts

- `.gitignore`: confirm existing `/test-results/` and `/playwright-report/` coverage is sufficient; add only a focused live-auth or manifest path if a new artifact falls outside those roots.
- `package.json`: add `test:e2e:live:claude` and `test:e2e:live:cleanup`; do not change the default `test:e2e` command.
- `playwright.config.ts`: leave the mock/default suite behavior unchanged unless a shared type-only extraction is required.

### Deterministic regression targets used only when the live journey exposes a failure

- `tests/app/event-stream-state-manager.test.ts` / `src/app/home/EventStreamStateManager.ts`: catalog completeness, stale snapshot, optimistic-run retirement, and deterministic ordering.
- `tests/app/run-selection-effects.test.ts` / `src/app/home/useRunSelectionEffects.ts`: late selection/load ownership and URL/session restoration.
- `tests/app/home-view-model.test.ts` / `src/app/home/useHomeViewModel.ts`: selected-run composition and cross-session projection.
- `tests/app/home/sidebar-activity.test.ts` / `src/app/home/sidebar-activity.ts`: honest per-session sidebar status.
- `tests/app/direct-control-activity.test.ts` / `src/app/home/direct-control-activity.ts`: active, cancelled, terminal, and stale-current-text classification.
- `tests/app/live-event-connection-manager.test.ts` / `src/app/home/LiveEventConnectionManager.ts`: replay, resync, owner fencing, and reconnect state.
- `tests/app/worker-entries-manager.test.ts` / `src/app/home/WorkerEntriesManager.ts`: seq ordering, revalidation after loaded-empty state, and selection isolation.
- `tests/app/conversation-transcript-manager.test.ts` / `src/app/home/ConversationTranscriptManager.ts`: fallback/stream dedupe and transcript ownership.
- `tests/app/busy-message-queue-manager.test.ts` / `src/app/home/BusyMessageQueueManager.ts`: interrupt acceptance, optimistic hiding, late-response rejection, and no resurrection. Create the focused test file if it does not already exist.
- `tests/ui/conversation-actions.test.ts`, `tests/ui/sidebar-layout.test.ts`, and `tests/ui/composer-shell.test.ts`: source-level or rendered affordance contracts when the visible control is wrong.
- `tests/conversations/direct-run-status.test.ts` / `src/server/conversations/direct-run-status.ts`: successful-turn terminal resolution.
- `tests/server/conversations/worker-turn-gate.test.ts`, `tests/server/conversations/reconcile-user-messages.test.ts`, and focused send/queue tests: exactly-once acceptance and finalization.
- `tests/lifecycle/scenarios/conversation-continuation.test.ts`: follow-up persistence across SSE gaps.
- `tests/lifecycle/scenarios/direct-mode-rerun.test.ts`: stopped direct-session continuation.
- `tests/lifecycle/scenarios/worker-reattach.test.ts`: explicit reattach/recreate decision evidence.
- `tests/lifecycle/scenarios/sse-resume.test.ts`: replay or resync after disconnect.
- Create `tests/lifecycle/scenarios/direct-control-interrupt-stop-resume.test.ts` only if the existing scenarios cannot express the exact combined production sequence without conflating responsibilities.

### Architecture and durable lessons

- `docs/architecture/lifecycle-observability-and-testing.md`: document only genuinely new event/state invariants introduced by a fix.
- `docs/architecture/direct-control-session-regressions.md`: add the exact reproduced sequence and rule for a new direct-control bug class.
- `docs/superpowers/learnings/YYYY-MM-DD-<root-cause>.md`: one concise learning for each meaningful client/server ownership, persistence, recovery, or control-plane root cause fixed.

### Large-file constraint

`src/components/Terminal.tsx` and `src/components/home/ConversationMain.tsx` already exceed 1200 lines. The plan does not add harness logic to either file. If a confirmed UI root cause requires touching one, first extract the smallest cohesive state/behavior unit into a focused module and cover it with a failing test; do not expand the oversized component further.

## State and data invariants

- [ ] The server snapshot is authoritative for the complete conversation catalog only when its anchor and scope declare completeness; cached/scoped data is preview.
- [ ] A partial run or worker update may refine known state but may not erase other conversations, optimistic creations, delivered input, read markers, or stream entries.
- [ ] Selection-changing async work is fenced by project path, run ID, and request/operation ID and rechecks ownership immediately before mutation or navigation.
- [ ] Conversation ordering uses a deterministic tie-breaker such as `(updatedAt, id)`, never timestamp alone.
- [ ] The URL, `HomeUiStateManager`, selected snapshot scope, transcript manager, and composer all refer to the same run before visible state changes.
- [ ] The unified worker JSONL is the final transcript authority, keyed by worker ID and monotonic seq.
- [ ] A loaded-empty stream at seq 0 is an observation, not permanent completeness; selecting it again revalidates.
- [ ] Queue states are monotonic from the user's perspective. An item accepted into chat leaves the drawer immediately and cannot be resurrected by a stale poll or mutation result.
- [ ] Active UI requires real current activity. Terminal/cancelled run or worker evidence defeats stale `currentText`, old bridge snapshots, and optimistic `running` rows.
- [ ] Stop targets a concrete active worker and emits `worker.status` plus `worker.terminal`; the UI clears active controls without waiting for reload.
- [ ] Resume/follow-up publishes `worker.reattached` or `worker.recreated` as appropriate, persists the new turn through the normal finalization path, and appends visible output to the same conversation stream.
- [ ] SSE frames have IDs. Reconnect supplies `Last-Event-ID`, fills the gap from the ring, or receives `stream.resync_required` and bootstraps a complete snapshot.
- [ ] Gateway readiness has a revision and remains server-owned. Selecting an encoded routed model never falls back to native Claude.
- [ ] The journey manifest is the sole cleanup authority. A title prefix, temp-looking path, or absent database row is insufficient authorization to delete anything.

## Task 1: Establish the baseline and lock the live mission

**Files:**

- Verify `docs/superpowers/specs/2026-07-13-claude-gpt56-live-lifecycle-journey-design.md`
- Read the three architecture documents listed in the execution rules
- No production source edits

- [ ] Record the current dirty-worktree paths and treat them as user-owned baseline.
- [ ] Confirm the running proxy and Next server ports, login shell, gateway status, Claude model catalog, and `GPT-5.6 SOL` option through the real UI.
- [ ] Confirm the live URL is local and the app can be authenticated without changing the configured password.
- [ ] Run the focused gateway suites and existing direct-session/lifecycle suites before adding the harness; record pre-existing failures separately.
- [ ] Write the exact three prompts from the design into the live spec as constants. Keep them dependency-free, low-effort, and bounded to the owned temp project.
- [ ] Define checkpoints for `created`, `working`, `switched-away`, `interrupt-queued`, `interrupt-accepted`, `stopped`, `resumed`, `completed`, `reloaded`, `reconnected`, and `cleaned`.
- [ ] Confirm the UI controls' accessible contracts from the running app: Add project, folder dialog, Direct control, CLI harness, Worker model, Worker effort, Send/Stop, queue interrupt, conversation selection, and delete.
- [ ] Do not begin a real worker turn during this task.

**Verification:**

- [ ] Save only non-secret baseline results in the implementation notes.
- [ ] Run `git diff --check` and confirm this task changed documentation/test constants only.

**Checkpoint:** The mission, cost boundary, UI actions, and existing failures are known before harness code or real token use.

## Task 2: Build and test the safety boundary

**Files:**

- Create `tests/e2e/live/types.ts`
- Create `tests/e2e/live/safety.ts`
- Create `tests/e2e/live/project-fixture.ts`
- Create `tests/e2e/live/safety.test.ts`

- [ ] Write failing tests that reject non-loopback URLs, missing real-agent opt-in, missing password/session input, repository paths, registered user-project paths, non-temp paths, `..` escapes, symlink escapes, missing/mismatched ownership markers, non-empty manifests at creation, and cleanup IDs absent from the manifest.
- [ ] Write failing tests that allow `localhost`, `127.0.0.1`, and `::1`, then create a random temp directory with `.gitignore` and an ownership marker containing only journey ID, created-at, and path.
- [ ] Watch the safety suite fail for the expected missing implementation, not for test setup.
- [ ] Implement pure guards first, then the minimal filesystem fixture.
- [ ] Make cleanup verify realpath containment, marker journey ID, and manifest ownership immediately before each destructive action.
- [ ] Append each run ID and flush the manifest file plus its parent directory synchronously as soon as the UI exposes the ID, before any later UI mutation. Add a crash-boundary test proving cleanup can recover a run created immediately before process exit.
- [ ] Refuse cleanup when any proof is missing; leave a clear recovery report instead of guessing.
- [ ] Ensure manifest serialization cannot contain passwords, cookies, tokens, OAuth URLs, arbitrary environment data, or unrelated run content.
- [ ] Run `pnpm vitest run tests/e2e/live/safety.test.ts` and confirm all cases pass.

**Checkpoint:** No browser or worker can be started until the test proves it owns a harmless local project and exact cleanup scope.

## Task 3: Add the opt-in live Playwright surface

**Files:**

- Create `playwright.live.config.ts`
- Create `tests/e2e/live/auth.ts`
- Modify `package.json`
- Inspect `.gitignore`

- [ ] Add a configuration test or import assertion that verifies the live config has no `webServer`, uses one worker, zero retries, a forty-five-minute journey timeout, `trace: retain-on-failure`, `screenshot: only-on-failure`, and a loopback base URL.
- [ ] Implement an eight-minute active-turn deadline and a two-minute no-progress deadline that watch visible transitions plus new durable evidence. A deadline must visibly Stop the owned worker, record the failure, and proceed to targeted cleanup rather than merely timing out the Playwright process.
- [ ] Bound safety Stop itself: if the UI does not expose terminal run and worker state within sixty seconds, end the browser phase and hand the manifest to targeted cleanup, which invokes the same production delete handler. If that handler cannot prove termination, retain the manifest/report and do not remove the temp project.
- [ ] Configure `testDir` narrowly to `tests/e2e/live` so ordinary E2E tests cannot accidentally run real agents.
- [ ] Require `OMNIHARNESS_LIVE_E2E=1` and read `OMNIHARNESS_LIVE_E2E_PASSWORD` only at runtime. Allow an already-authenticated in-app journey as the manual alternative.
- [ ] Implement UI login using the current password form; never place the password in Playwright output, trace annotations, or manifest.
- [ ] Add `pnpm test:e2e:live:claude` without changing `pnpm test:e2e`.
- [ ] Confirm all live artifacts remain under ignored `test-results/`/`playwright-report/`; do not add a tracked auth state file.
- [ ] Run a preflight-only Playwright test that logs in, reaches the workspace, and exits without creating a project or conversation.

**Checkpoint:** A developer can attach headless Chromium to the real local app safely, but no real agent work starts yet.

## Task 4: Implement UI-only actions and visible checkpoints

**Files:**

- Create `tests/e2e/live/omniharness-ui.ts`
- Create `tests/e2e/live/checkpoint-reporter.ts`
- Create `tests/e2e/live/checkpoint-reporter.test.ts`

- [ ] Write failing reporter tests for secret redaction, bounded DOM/event/stream tails, stable text hashing, mismatch classification, and omission of unrelated runs.
- [ ] Implement one UI helper per user action. Use `data-testid` only when the existing accessible name or stable URL cannot uniquely identify the control; never rely on `.first()` or positional CSS.
- [ ] Every action must take a fresh or still-valid DOM observation, prove a unique target, perform one mutation, and wait for a visible state transition.
- [ ] Capture selected URL/run, visible session list, status labels, transcript hashes, Stop/Send state, queued drawer state, and visible error state after each checkpoint.
- [ ] Make the conversation-creation helper await the synchronous manifest append/file-and-directory flush before returning control to the next mission step; add a test proving the next click cannot run concurrently with that flush.
- [ ] Add assertions that the selected conversation title and transcript remain stable through A -> B -> A switching before any server oracle is read.
- [ ] Do not put API mutation shortcuts in this helper.
- [ ] Run reporter unit tests and a no-agent browser smoke that opens/closes the project picker and changes then restores harness/model/effort selections.

**Checkpoint:** The test can behave like a human and describe what the human sees without backend knowledge.

## Task 5: Add the read-only control-plane oracle

**Files:**

- Create `tests/e2e/live/control-plane-oracle.ts`
- Extend `tests/e2e/live/checkpoint-reporter.test.ts`

- [ ] Write failing tests for parsing the canonical snapshot anchor, scoping events to owned run IDs, deterministic event ordering, worker-entry monotonic seq, queue status comparison, and redaction.
- [ ] Read `/api/events?snapshot=1&persisted=1`, the dev event-log endpoint, targeted worker entries/transcript routes, and only the run IDs recorded in the journey manifest.
- [ ] Keep SQLite inspection behind a diagnostic function used after a mismatch or at final audit; query only owned run IDs and the tables named in the architecture debugging checklist.
- [ ] Implement comparison rules for selected run, catalog membership, sidebar status, run/worker state, queue state, transcript seq/content hashes, and terminal/active consistency.
- [ ] Classify the first divergence as control-plane missing decision, persistence/finalization gap, stream delivery gap, client ownership/merge bug, or visible affordance bug.
- [ ] Never use the oracle to create, send, interrupt, stop, resume, switch, or delete.
- [ ] Run the focused oracle/reporter tests.

**Checkpoint:** When the screen is wrong, the harness points to the first disagreeing boundary instead of guessing.

## Task 6: Write the real three-conversation journey before fixing anything

**Files:**

- Create `tests/e2e/live/claude-gpt56-lifecycle.spec.ts`

- [ ] Write the full test with the three prompts and checkpoints from the design.
- [ ] Preflight gateway status and the exact catalog value `cliproxyapi:gpt-5.6-sol`; refuse rather than substitute another model.
- [ ] Add the marked temporary project through **Add project** and the real folder picker.
- [ ] Select Direct control, Claude Code, `GPT-5.6 SOL`, and Low before every new conversation; assert the compound selection remains correct after session switches.
- [ ] Start A, record its URL/run ID, and wait for visible active state plus durable `worker.spawned`/`worker.status` evidence.
- [ ] Create B while A remains active, switch A -> B -> A -> B, and assert both sidebar rows, URL selection, model/effort, and transcript ownership.
- [ ] Send A's change-of-direction message while busy, verify queued state, use the visible interrupt/send-now action, and assert exactly one accepted stream input and no remaining pending row.
- [ ] Stop B through the visible Stop control and assert active UI clears; then send the resume follow-up and assert visible post-resume output without reload.
- [ ] Create C, let it complete, and use it as the known-terminal reference while A and B change state.
- [ ] Repeat A -> C -> B -> A switches while capturing checkpoints. Fail on disappearance, duplication, wrong status, transcript bleed, stale Thinking, missing Stop, or lost output.
- [ ] Reload the selected run and assert the same URL, transcript, and terminal/active status after authority loads.
- [ ] Drop and restore browser network/SSE in the Playwright profile, then assert replay or resync and repeat the switch loop.
- [ ] Verify `index.html`, `styles.css`, `app.js`, `README.md`, `AUDIT.md`, and `STATUS.md` inside the owned project and assert the interrupt requirements are present.
- [ ] Let the first run expose failures. Do not patch production code inside this task.

**Verification:**

- [ ] Run only the live spec with a single explicit real-agent opt-in.
- [ ] Preserve the first failing trace/checkpoint and record exact reproduction steps.
- [ ] If the journey passes, still inspect the complete event transcript and state comparisons before moving on.

**Checkpoint:** There is one real, repeatable account of what currently breaks, with visible and server evidence tied to owned IDs.

## Task 7: Reduce each failure to a deterministic red test

**Files:**

- Use the regression targets in the file map; do not choose a production file before tracing the failing boundary.

- [ ] For each observed failure, read the full error/trace, reproduce it at least twice, and identify the first state boundary that diverges.
- [ ] Compare the broken path with the nearest working path in the same codebase.
- [ ] State one root-cause hypothesis and the evidence that supports it.
- [ ] Add the smallest failing deterministic test at the owning layer and run it to see the expected failure.
- [ ] For stale selection/catalog bugs, defer request A, switch to B, resolve A, and assert A cannot mutate B or erase catalog rows.
- [ ] For status bugs, table-test active, runnable, awaiting-user, cancelled, terminal, stale, and recoverable inputs across sidebar and conversation projections.
- [ ] For missing/duplicate output, reproduce fallback/stream arrival orders and worker seq gaps without a browser.
- [ ] For interrupt/stop/resume bugs, add a lifecycle event transcript asserting input acceptance, queue transition, terminal event, reattach/recreate decision, finalization, and final run state.
- [ ] For reconnect bugs, bootstrap at an anchor, emit during the gap, reconnect with the last ID, and assert replay or explicit resync.
- [ ] Do not combine unrelated root causes in one test or one patch.

**Checkpoint:** Every production change that follows has a test that demonstrated the actual bug first.

## Task 8: Implement minimal root-cause fixes

**Files:**

- Modify only the owning modules identified by Task 7.
- Add locale keys in all locale files only if a visible error/action needs new copy.
- Add or update architecture/learning docs for meaningful root causes.

- [ ] Implement one minimal fix per confirmed hypothesis.
- [ ] Keep server authority on the server and client projection in Managers; do not add component-local arrays, parallel caches, translated persisted strings, or transaction-carried UI state.
- [ ] Fence every late callback with the correct compound owner token.
- [ ] Preserve partial/complete snapshot semantics and deterministic ordering.
- [ ] Reuse the existing successful worker-turn finalization path for interrupt, queue drain, stop/recovery follow-up, and reattach output.
- [ ] Emit a typed named decision and surfaced error where the server previously returned silently or swallowed a user-relevant failure.
- [ ] If `Terminal.tsx` or `ConversationMain.tsx` must change, extract a focused helper/module before adding behavior because both files are already oversized.
- [ ] Run the red test until green, then run all directly related Manager/route/lifecycle suites.
- [ ] If a hypothesis fails, return to evidence gathering. After three failed fixes for the same symptom, stop and review the architecture with the user instead of stacking a fourth patch.
- [ ] Record a durable learning for every meaningful state ownership, stream, persistence, stop/resume, or recovery root cause.

**Checkpoint:** Confirmed causes are fixed at their source, with no symptom-only polling, reload, timeout, or fallback workaround.

## Task 9: Add crash-safe targeted cleanup

**Files:**

- Create `scripts/cleanup-live-agent-journey.ts`
- Modify `package.json`
- Extend `tests/e2e/live/safety.test.ts`

- [ ] Write failing tests for targeted deletion of manifest-owned run IDs, idempotent already-gone responses, refusal on unknown IDs, refusal on marker mismatch, refusal outside temp, and preservation of the report when cleanup is incomplete.
- [ ] Prefer deleting A/B/C through the same production conversation delete flow exercised by the UI. Allow a targeted authenticated DELETE fallback for cleanup only, record that fallback, and require it to invoke the exact same server route/handler as the UI delete action rather than a new deletion path.
- [ ] Wait for `conversation.deleted` or verify an idempotent absent result for each owned ID.
- [ ] Confirm related workers, messages, queued rows, execution events, recovery rows, and run-data files are removed by production cascade behavior; never hand-delete database rows.
- [ ] Remove the temp directory only after all owned workers are terminal, all manifest run deletions are confirmed, realpath/marker checks pass, and no process has the directory as its working directory.
- [ ] If project grouping is derived from conversations, confirm it disappears after targeted deletion; do not invent a second project registry cleanup.
- [ ] Keep the manifest/report when cleanup refuses so a developer can inspect and rerun the cleanup command safely.
- [ ] Run safety and cleanup tests without touching real conversations.

**Checkpoint:** Normal completion and interrupted test runs can clean only what they prove they own.

## Task 10: Run the final verification matrix

**Deterministic checks:**

- [ ] Run `pnpm vitest run tests/e2e/live/safety.test.ts tests/e2e/live/checkpoint-reporter.test.ts`.
- [ ] Run every focused Manager, route, server, and lifecycle regression added or changed during Tasks 7-8.
- [ ] Run `pnpm test:lifecycle` and account for every scenario; do not summarize a partial pass as green.
- [ ] Run the focused Claude model gateway suite, including routing and real smoke coverage appropriate to the current installation.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm lint` on touched source/test files or the repository command if it supports clean targeted execution.
- [ ] Run `pnpm build`.
- [ ] Run `git diff --check`.

**Real browser checks:**

- [ ] Run `pnpm test:e2e:live:claude` from a fresh marked temp project and read the full result.
- [ ] Run the same mission through the in-app browser as a black-box user. Use only visible UI to choose actions; use the oracle afterward for comparison.
- [ ] Repeat the live journey once more from fresh state to catch one-run timing luck.
- [ ] Confirm both runs used Claude Code, encoded model `cliproxyapi:gpt-5.6-sol`, and Low effort in persisted worker selection.
- [ ] Confirm A's interrupted instruction appears once and the app contains the changed requirement.
- [ ] Confirm B's Stop ends the worker and its resume output appears without reload.
- [ ] Confirm C remains complete through switches, reload, and reconnect.
- [ ] Confirm no conversation disappears, duplicates, borrows content, or shows a stale working state at any checkpoint.
- [ ] Confirm no browser console errors or visible generic failures were ignored.

**Cleanup and final audit:**

- [ ] Delete only the journey-owned runs and verify their durable artifacts are gone.
- [ ] Remove only the marked temporary project after the cleanup safety checks pass.
- [ ] Confirm unrelated project/conversation counts and the pre-existing dirty-worktree baseline are unchanged.
- [ ] Inspect `git status --short` for secrets, auth state, test output, temporary projects, dependencies, caches, logs, or generated artifacts.
- [ ] Re-read every pass criterion in the design and attach fresh evidence or an explicit unresolved gap.

**Checkpoint:** The user-visible lifecycle is proven end to end with a real worker, and the deterministic suite guards every root cause found along the way.

## Agentic journey mission card

**Running app:** `http://localhost:3035` or the explicitly configured loopback URL.

**User role:** A builder using OmniHarness to manage several Claude Code sessions in one disposable project.

**Mission:** Add the marked temporary project, run Conversations A/B/C with Claude Code + GPT-5.6 SOL + Low effort, change A's instructions while it works, stop and resume B, complete C, repeatedly switch among them, reload and reconnect, and decide whether every status and transcript is trustworthy.

**Allowed interface:** In-app browser or Playwright browser UI, keyboard, pointer, accessibility tree, and visible page state.

**Forbidden shortcuts during the mission:** No API mutations, source inspection, direct database changes, direct worker calls, filesystem edits by the test driver, or implementation knowledge used to choose the next UI action.

**Expected visible proof:** Each session remains present exactly once; active and terminal controls are honest; A accepts the changed instruction exactly once; B visibly stops and later shows resumed output; C stays complete; switching, reload, and reconnect do not lose or mix state.

**Failure conditions:** A session disappears or flickers out of the list, selection changes unexpectedly, status surfaces disagree, Stop leaves working UI behind, resume returns no visible output, queue state survives acceptance, transcript content crosses sessions, output requires reload, a generic error hides the cause, or cleanup cannot prove ownership.

**Approval:** The user explicitly requested this real, potentially long-running agentic journey in the current conversation. The runner still requires its local opt-in guard on every invocation.
