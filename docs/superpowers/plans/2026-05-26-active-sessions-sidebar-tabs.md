# Active Sessions Sidebar Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `Projects` and `Active` tabs to the conversation sidebar, where `Active` shows only sessions that are unread, currently working, or have had user-input or worker-output activity in the last 20 minutes, grouped by project and ordered by last activity.

**Architecture:** Keep the existing project/session sidebar rendering as the visual source of truth by extracting it into a reusable list component. Build two sidebar datasets in the home view model: the existing full project list and a derived active-only list with deterministic activity metadata from the existing event-stream snapshot, read markers, workers, agents, messages, queued messages, and live worker-entry cursor observations.

**Tech Stack:** Next.js App Router, React 19, TypeScript, existing manager classes, existing shadcn/ui primitives, lucide-react icons, shared i18n JSON resources, Vitest unit tests, optional browser verification against the already-running local app.

**North Star Product:** The sidebar becomes a reliable operational triage surface: users can keep all project history in `Projects`, then switch to `Active` to see only conversations that need attention or are still alive.

**Current Milestone:** Deliver the sidebar tabs and active filter completely using existing snapshot data. Do not introduce new persistence, new server endpoints, or a parallel worker-stream reader for the sidebar.

**Future Product Direction:** Later product layers can add richer filters, per-project active counts, pinned sessions, snooze/mark-all-read actions, or notification-derived urgency. Those are context only and are not part of this implementation checklist.

**Final Functionality Standard:** The implementation is complete when the sidebar renders `Projects` and `Active` tabs, `Projects` preserves existing behavior, `Active` reuses the same project/session display component, active sessions are filtered and sorted deterministically, projects with no active sessions are hidden, all new visible strings use i18n resources, and tests prove unread/working/recent classification plus ordering.

---

## Scope Notes

- Do not create a branch.
- Do not create a worktree.
- Do not delete files.
- Interpret the active filter as an OR: a session appears in `Active` when it is unread, currently working, or recently changed. If the user later clarifies that all three conditions must be true, only the predicate helper and tests should change.
- "Recent" means `nowMs - lastActivityMs <= 20 minutes`.
- "Recent activity" for this milestone means user input and worker output. Do not include generic execution events or supervisor interventions as recent activity unless they directly correspond to user input or worker output.
- Use existing snapshot data only. The sidebar must not synchronously read worker JSONL stream files or add another persistence path.
- Use existing i18n rules: every new user-facing string goes in `shared/locales/*.json` and is rendered through `t()`.
- This is not a new screen, so no ShadCN block import is needed. Reuse the current sidebar design and primitives.
- Keep sidebar list rendering behavior intact: selection, rename, archive, delete, project collapse, show more, start in project, remove project, and project commit actions should behave the same in both tabs unless explicitly scoped otherwise.

## User Stories

- As a user with many project histories, I can keep browsing all sessions under `Projects`.
- As a user monitoring current work, I can switch to `Active` and see only sessions that are unread, still working, or recently changed.
- As a user scanning multiple projects, I see active sessions grouped under their projects, and projects with no matching sessions disappear from the active view.
- As a user revisiting the app after activity has quieted down, the 20-minute activity window is evaluated when the sidebar naturally renders, such as after switching tabs, searching, selecting a session, or receiving new event-stream state.

## File Map

### Files To Create

- `src/app/home/sidebar-activity.ts`
  - Owns pure data helpers for sidebar activity classification.
  - Exports `ACTIVE_SESSION_ACTIVITY_WINDOW_MS`, `getSidebarRunLastActivityAt`, `isSidebarRunCurrentlyWorking`, `isSidebarRunActive`, `buildActiveConversationGroups`, and deterministic comparators.
  - Keeps the active-filter logic testable without mounting React.

- `src/app/home/SidebarWorkerActivityManager.ts`
  - Owns a small non-persistent `workerId -> { runId, seq, observedAt }` map plus a derived `runId -> latestObservedWorkerOutputAt` view for live worker-output activity observed through worker-entry cursor increases.
  - Establishes an initial baseline from existing `workerEntrySeqs` without stamping historical entries as "recent now".
  - Updates `observedAt` only when a worker's known seq increases after baseline.
  - Uses `runId` from `worker.entry_appended` when available, and can later associate cursor hints to runs from worker metadata.
  - This is not a transcript store and must not contain worker content.

- `tests/app/home/sidebar-activity.test.ts`
  - Unit coverage for unread, working, recent user input, recent worker output, terminal/stale workers, grouping, hidden empty projects, and deterministic ordering.

- `tests/app/home/sidebar-worker-activity-manager.test.ts`
  - Unit coverage for baseline seq handling, live seq increases, no-op repeated seqs, and worker activity timestamps.

### Files To Modify

- `src/app/home/types.ts`
  - Extend `SidebarRun` with optional `updatedAt?: string | null`, `recentActivityAt?: string | null`, and `activeSortAt?: string | null`.
  - Add `ConversationSidebarTab = "projects" | "active"` if that type is not better owned in `HomeUiStateManager`.

- `src/lib/conversations.ts`
  - Preserve current grouping behavior.
  - Include `run.updatedAt` in `ConversationGroup.runs`.
  - Keep plan/project fallback behavior unchanged.
  - Do not embed active filtering here unless the helper stays pure and separately tested.

- `tests/lib/conversations.test.ts`
  - Update fixtures for optional `updatedAt` where useful.
  - Add coverage that grouped runs preserve `updatedAt` and existing grouping order/metadata remains unchanged.

- `src/lib/conversation-state.ts`
  - Reuse existing unread helpers.
  - Add only low-level timestamp helpers if needed by both the sidebar and existing unread logic.
  - Avoid making this module depend on home-specific worker/event shapes.

- `tests/lib/conversation-state.test.ts`
  - Add timestamp helper coverage only if new shared helpers are introduced.

- `src/app/home/HomeUiStateManager.ts`
  - Add `conversationSidebarTab: "projects" | "active"` with default `"projects"`.
  - Add manager methods/setters for tab selection.
  - Keep state centralized; do not introduce component-local tab state as the source of truth.

- `src/app/home/LiveEventConnectionManager.ts`
  - Feed the sidebar worker activity manager from the same `workerEntrySeqs` and `worker.entry_appended` wake-up paths already sent to `WorkerEntriesManager`.
  - Do not fetch or persist worker content.
  - Do not mark initial snapshot seqs as recent activity; only seq increases after the manager baseline count.
  - When handling `worker.entry_appended`, pass the event's `runId`, `workerId`, and `seq` into `SidebarWorkerActivityManager`.
  - When handling snapshot `workerEntrySeqs`, pass worker metadata if needed so the manager can associate known worker ids to run ids without reading content.

- `src/app/home/useHomeLifecycle.ts`
  - Hydrate/persist the tab choice only if product review decides it should survive reloads. For this milestone, prefer session-local tab state unless the user asks for persistence.
  - Do not add a timer or clock tick for active filtering. The recent-activity cutoff is evaluated only on normal renders caused by existing UI or event-stream updates.

- `src/app/home/useHomeViewModel.ts`
  - Continue building `groupedProjects` and `filteredProjects` for the `Projects` tab.
  - Build `activeProjects` by calling the new pure helpers with `runs`, `messages`, effective read markers, `workers`, `agents`, `queuedMessages`, sidebar worker activity observations, and a render-time `nowMs` value.
  - Apply search consistently to the selected tab while preserving current Projects behavior.
  - Treat terminal runs as not currently working even if stale worker metadata still says `working`.

- `src/app/home/HomeApp.tsx`
  - Read `conversationSidebarTab` from the home UI manager snapshot.
  - Compute `effectiveReadMarkers` before calling `useHomeViewModel`.
  - Pass the same effective read-marker object into `useHomeViewModel` and `ConversationSidebar` so active filtering agrees with visible unread dots.
  - Pass the active tab, setter, `filteredProjects`, and `activeProjects` into sidebar props.
  - Keep shared sidebar actions unchanged.

- `src/components/home/ConversationSidebar.tsx`
  - Extract the existing project/session mapped section into a reusable component, for example `ConversationProjectGroupList`.
  - Add the two-tab control next to the current `PROJECTS` area using existing button styles or a compact segmented control.
  - Reuse the same project/session component for both tabs.
  - Show a distinct i18n-backed empty state for `Active` when no active sessions match.
  - Replace any touched hardcoded user-facing strings in this file with `t()` keys as part of the edited surface.

- `src/components/home/HomeHeader.tsx`
  - Pass the same new sidebar props through the mobile/header sidebar instance.

- `src/app/home/WorkerEntriesManager.ts`
  - No content changes required.
  - If implementation finds that `LiveEventConnectionManager` already has all worker-entry cursor hooks needed, keep `WorkerEntriesManager` unchanged and route only cursor metadata into `SidebarWorkerActivityManager`.

- `shared/locales/en.json` and every other file in `shared/locales/*.json`
  - Add keys for tab labels, active empty state, and any aria/title strings introduced by the tab control.
  - Candidate keys:
    - `conversation.sidebar.tab.projects`
    - `conversation.sidebar.tab.active`
    - `conversation.sidebar.empty.active`
    - `conversation.sidebar.empty.projects`
    - `conversation.sidebar.collapse`
    - `conversation.sidebar.searchPlaceholder`
    - `conversation.sidebar.newSession`
    - `conversation.sidebar.newConversationInProject`
    - `conversation.sidebar.removeProject`
    - `conversation.sidebar.conversationActions`
    - `conversation.sidebar.archiveConversation`
    - `conversation.sidebar.visual.supervisor`
    - `conversation.sidebar.visual.direct`
    - `conversation.sidebar.visual.commit`

### Tests To Update Or Add

- `pnpm test -- tests/app/home/sidebar-activity.test.ts`
- `pnpm test -- tests/app/home/sidebar-worker-activity-manager.test.ts`
- `pnpm test -- tests/app/home-view-model-active-sidebar.test.ts` or the closest existing home view-model test file after extracting a pure searchable active-groups builder.
- `pnpm test -- tests/app/home-ui-state-manager.test.ts` or the closest existing manager test file for `conversationSidebarTab`.
- `pnpm test -- tests/lib/conversations.test.ts tests/lib/conversation-state.test.ts`
- `pnpm lint`

### Candidate Agentic User Journey Test

Running this requires explicit user approval.

- Mission: verify in the running app that `Projects` behavior is unchanged and `Active` shows only unread/working/recent sessions grouped by project.
- Entry point: already-running app at `http://localhost:3035`.
- Expected proof: tab switching works on desktop and mobile sidebar, active groups hide empty projects, search filters the selected tab, and no layout overlap appears in the tab header.

## Product And UX Decisions

- Tab placement: put `Projects` and `Active` where the current `PROJECTS` heading lives, with the add-project button still available on the same row.
- Default tab: `Projects`, preserving existing first-load behavior.
- Empty states:
  - `Projects`: keep existing meaning, but localize the text if the file is touched.
  - `Active`: show a concise empty state such as "No active sessions."
- Collapse state:
  - Reuse the existing project collapse state for both tabs in this milestone.
  - Because `Active` hides empty groups, stale collapsed entries are harmless.
- Show-more limits:
  - Reuse `visibleProjectSessionCounts` in both tabs.
  - Active sessions should usually be few; no separate active-tab pagination state is needed unless tests expose confusing behavior.
- Search:
  - Search applies to the currently selected tab.
  - In `Active`, a project remains visible only if it has active sessions after active filtering.
  - If the search query matches a project name in `Active`, show all active sessions in that project, ordered by active sort time.
  - If the search query does not match the project name, show only active sessions whose title or path matches the query.
  - If neither the project name nor any active session in the project matches, hide the project.
- Worker output recency:
  - Before implementing the helper, audit whether existing worker-output persistence updates `worker.updatedAt` for meaningful output changes.
  - If `worker.updatedAt` is proven output-backed, use it for historical worker-output recency and add a test fixture proving a recent worker `updatedAt` includes the run.
  - If `worker.updatedAt` is not proven output-backed, exclude it from recent worker-output classification and document that pre-existing worker output before page load is limited by currently exposed metadata. Live output after page load still uses `SidebarWorkerActivityManager`.
  - Live worker-output recency should use `SidebarWorkerActivityManager` observations from worker-entry seq increases.
  - Initial snapshot cursor values establish a baseline and must not make every historical worker stream look active.

## State, Ownership, And Invariants

- Owner:
  - Server owns runs, workers, messages, queued messages, execution events, supervisor interventions, and read markers through the `/api/events` snapshot stream.
  - `EventStreamStateManager` owns snapshot merge state.
  - `HomeUiStateManager` owns selected sidebar tab.
  - `SidebarWorkerActivityManager` owns live, non-persistent worker-output observation timestamps derived from worker-entry cursor increases.
  - `useHomeViewModel` owns derived sidebar groups.

- Token:
  - Derived active groups are scoped to the current event snapshot and the render-time `nowMs` used for the current derivation.
  - No async request is introduced for the active tab, so no new request token is needed.

- Provenance:
  - Active classification is derived from server-authoritative or merged event-stream state.
  - Cached/partial snapshots can pre-render, but existing event-stream completeness rules still determine when the app is hydrated.

- Completeness:
  - The active list is complete for the conversations present in the current merged snapshot.
  - The active list must not erase or mutate underlying runs; it is a pure view.
  - Partial selected-run message scopes must not be treated as complete message history for other runs. Use available catalog-level message/read/activity metadata conservatively.

- Ordering:
  - Session order in `Active`: `activeSortAt desc`, then `createdAt desc`, then `id asc`.
  - Project order in `Active`: newest remaining child activity desc, then project name asc, then project path asc.
  - `Projects` ordering remains whatever `buildConversationGroups` currently produces unless an existing test already expects otherwise.

- State machine:
  - Sidebar tab states: `projects`, `active`.
  - Run active classifier states: `inactive`, `unread`, `working`, `recent`, with a run allowed to match more than one reason.
  - The rendered active view only needs a boolean include/exclude and `activeSortAt`; reason badges are out of scope for this milestone.

- Race and stale-data rules:
  - Terminal run statuses override stale active worker metadata for `currently working`.
  - Worker live agent state can mark a run working when the run is non-terminal.
  - Late event-stream payloads are handled by existing `EventStreamStateManager` merge rules; active groups recalculate from the latest manager snapshot.
  - Do not add a timer that removes recent-only sessions solely because time passed. They should leave `Active` only on a natural re-render.
  - Initial `workerEntrySeqs` hydration must not stamp old worker output as recent. Only a known seq increase after baseline records a live `observedAt`.

- Hot-path rule:
  - Do not read worker transcript bodies.
  - Do not add synchronous filesystem or database work to render the sidebar.
  - Keep activity computation bounded over arrays already in memory.

## Activity Classification Details

Implement pure helpers around these inputs:

- `run`: `id`, `status`, `createdAt`, `updatedAt`, `projectPath`, `mode`.
- `messages`: user-authored conversation messages already present in snapshot.
- `readMarkers`: existing `runId -> lastReadAt`.
- `workers`: status and `updatedAt` metadata.
- `agents`: live worker state and `updatedAt`.
- `queuedMessages`: user input state changes, using `createdAt`, `updatedAt`, and `deliveredAt`.
- `workerOutputObservedAtByRunId`: non-persistent live worker-output timestamps from worker-entry cursor increases.

Use two derived timestamps:

- `recentActivityAt`: maximum timestamp across eligible user-input and worker-output signals. This is the only timestamp used to decide whether the "recent activity in the last 20 minutes" condition is true.
- `activeSortAt`: maximum timestamp across `recentActivityAt`, unread attention timestamp when the run is unread, and working activity timestamp when the run is currently working. This is the timestamp used for ordering included sessions.

Eligible activity signals:

1. Latest user-authored input message timestamp for the run. Count `role === "user"` messages. Exclude supervisor, assistant, worker, system, internal, checkpoint-only, and intervention records unless they are explicitly represented as user-authored input rows.
2. Latest queued user input `deliveredAt`, `updatedAt`, or `createdAt`.
3. Latest live worker-output observation from `SidebarWorkerActivityManager`.
4. Latest worker `updatedAt` for the run, only if the implementation audit proves it reflects meaningful worker output.
5. Latest live agent `updatedAt` after mapping agent name to worker id/run id, only when the agent has current/display/last text or active output state.
6. Run `updatedAt` only for unread terminal attention via `getRunLatestUnreadTimestamp`; do not use it as generic recent activity unless it represents user input or worker output.

Unread should use `getRunLatestUnreadTimestamp(run, messages)` and `isRunUnread(...)`, preserving the existing behavior where terminal status updates can create unread attention even if worker content lives outside `messages`.

Currently working should be true when:

- `run.status` normalizes to an active/running status; or
- any worker for the run has an active status from `isWorkerActiveStatus`; or
- any live agent mapped to a worker in the run has an active status.

Currently working should be false when:

- the run status is terminal, failed, stopped, archived, or needs-recovery in a way existing status helpers classify as terminal/non-working.
- only stale worker metadata is active for a terminal run.

Working activity timestamp should use the maximum of run `updatedAt`, active worker `updatedAt`, active agent `updatedAt`, and run `createdAt` as a fallback. This timestamp affects `activeSortAt` only; it must not make the run satisfy the recent-activity condition by itself.

## Implementation Checklist

- [ ] **Step 1: Add failing helper tests.**
  - Create `tests/app/home/sidebar-activity.test.ts`.
  - Cover unread inclusion, working inclusion, recent user-message inclusion, recent queued user input inclusion, recent worker-output inclusion via live worker-entry observation, recent worker-output inclusion via audited `worker.updatedAt`, old read terminal exclusion, hidden empty projects, and deterministic ordering.
  - Add a terminal-run stale-worker test to ensure a done run with a stale `working` worker is not included for the working reason.
  - Add tests that unread-only and working-only sessions still receive deterministic `activeSortAt` values.
  - Add tests that supervisor/intervention/internal rows do not count as recent user input.
  - Add a search test where the query matches a project name in `Active` and all active sessions for that project remain visible.

- [ ] **Step 2: Preserve grouping metadata and effective read markers.**
  - Update `src/lib/conversations.ts` to include `updatedAt` on grouped sidebar runs.
  - Update `tests/lib/conversations.test.ts` so this field is preserved without changing existing grouping behavior.
  - Move `effectiveReadMarkers` calculation before `useHomeViewModel` in `HomeApp`.
  - Update `useHomeViewModel` params so unread active filtering uses the exact same effective read markers passed to `ConversationSidebar`.
  - Audit whether `worker.updatedAt` is output-backed in existing persistence paths. Record the implementation choice in code comments/tests:
    - proven output-backed: include `worker.updatedAt` as historical worker-output recency;
    - not proven: exclude it from recent recency and rely on live cursor observations plus other exposed metadata.

- [ ] **Step 3: Implement sidebar activity helpers and worker-output observations.**
  - Create `src/app/home/sidebar-activity.ts`.
  - Implement timestamp parsing, max timestamp selection, active worker detection, unread/recent/working classification, active group building, and comparators.
  - Keep the module pure and free of React imports.
  - Create `src/app/home/SidebarWorkerActivityManager.ts` for non-persistent worker-entry cursor observations.
  - Wire `LiveEventConnectionManager` to update the manager from `workerEntrySeqs` and `worker.entry_appended` wake-ups without reading worker content.
  - Store `workerId -> { runId, seq, observedAt }` or an equivalent structure that can derive `runId -> latestObservedWorkerOutputAt`.
  - Add tests that initial cursor hydration does not mark old output as recent, later seq increases do, and an event with run id can be used even if the worker row is not yet present.

- [ ] **Step 4: Add sidebar tab state.**
  - Update `HomeUiStateManager` with `conversationSidebarTab`.
  - Add setters/manager methods.
  - Do not add interval/timer state for active filtering.
  - Add a focused manager test for default tab and tab switching.

- [ ] **Step 5: Derive active groups in the view model.**
  - Pass `readMarkers` into `useHomeViewModel` if it is not already available there.
  - Capture `const activeFilterNowMs = Date.now()` during render and use it for the current derivation without storing it in a manager or local state.
  - Build `activeProjects` from unsearched grouped projects, then apply search.
  - Return both `filteredProjects` and `activeProjects`.
  - Keep `Projects` behavior unchanged.
  - Add a focused view-model or pure builder test that proves effective read markers, search, hidden empty projects, and active ordering agree.
  - Include the project-name search behavior: matching the project name shows all active sessions in that project, not only active sessions whose own title/path matches.

- [ ] **Step 6: Extract reusable sidebar list rendering.**
  - In `ConversationSidebar.tsx`, extract the group list into a reusable component.
  - Move only rendering code; keep behavior and props equivalent.
  - Ensure the extraction does not push the file toward 1200 lines. If it grows significantly, split into a sibling file such as `ConversationProjectGroupList.tsx`.

- [ ] **Step 7: Add tab UI and i18n.**
  - Add `Projects` and `Active` tab controls to `ConversationSidebar.tsx`.
  - Thread the same props through `HomeHeader.tsx` for the mobile/header sidebar instance.
  - Add all new keys to `shared/locales/en.json`, `de.json`, `es.json`, `fr.json`, `it.json`, `ja.json`, `ko.json`, `pt.json`, and `zh-CN.json`.
  - Replace touched hardcoded sidebar strings with translation keys.

- [ ] **Step 8: Wire actions unchanged.**
  - Confirm selecting, renaming, archiving, deleting, starting a new session, starting in a project, project commit, project remove, collapse, and show-more all work from both tabs.
  - Ensure `Active` does not create a separate action path or duplicate transaction payloads.

- [ ] **Step 9: Deterministic verification.**
  - Run `pnpm test -- tests/app/home/sidebar-activity.test.ts`.
  - Run `pnpm test -- tests/app/home/sidebar-worker-activity-manager.test.ts`.
  - Run the focused home view-model/sidebar tab state tests added in this plan.
  - Run `pnpm test -- tests/lib/conversations.test.ts tests/lib/conversation-state.test.ts`.
  - Run `pnpm lint`.

- [ ] **Step 10: Manual/local app verification.**
  - Use the already-running app at `http://localhost:3035` if one exists; do not start a duplicate server.
  - Verify desktop sidebar tab switching.
  - Verify mobile/header sidebar tab switching.
  - Verify active groups hide projects without active sessions.
  - Verify search works in both tabs.
  - Clean up any test sessions/conversations and associated persisted artifacts before finishing.

## Acceptance Criteria

- `Projects` remains the default tab and preserves existing project/session behavior.
- `Active` uses the same session display component as `Projects`.
- `Active` includes sessions that are unread, currently working, or changed within the last 20 minutes.
- `Active` orders sessions by last activity and groups them by project.
- `Active` hides projects with no remaining sessions after filtering and search.
- In `Active`, project-name search shows all active sessions for matching projects; otherwise search filters active sessions by title/path.
- Recent-only sessions are evaluated against the 20-minute window on normal renders only; no timer makes them disappear solely because time passed.
- Worker-output recency comes from existing metadata plus live worker-entry cursor observations, without reading worker JSONL content in the sidebar.
- Active unread classification uses the same effective read markers as the visible sidebar unread indicators.
- No new server endpoint, database table, worker-output persistence layer, or worker JSONL sidebar read is introduced.
- All new user-facing frontend strings are in every locale file and rendered with `t()`.
- Unit tests cover classification, grouping, and deterministic ordering.

## Self-Review Notes

- Every user requirement maps to a checklist item: tabs, active filter, unread/working/recent conditions, ordering, grouping, hiding empty projects, and component reuse.
- The plan does not assume a branch or worktree.
- The plan does not introduce fake data, placeholders, or fallback behavior.
- The main race risk is stale runtime metadata; terminal run status explicitly wins over stale active workers.
- The main time-window product decision is intentional: no clock tick is added, so recent-only sessions do not disappear solely because time passed.
- The main worker-output recency risk is missing output that only appears as worker-entry cursor movement; the plan adds a non-content observation manager for cursor increases.
- The main performance risk is over-reading worker content; the plan forbids worker JSONL reads and uses already-loaded snapshot/cursor metadata.
