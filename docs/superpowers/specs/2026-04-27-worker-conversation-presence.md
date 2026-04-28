# Worker Conversation Presence Design

## Summary

Implementation conversations currently render the same rich terminal-style worker view in two places:

- The worker sidebar renders `src/components/Terminal.tsx` through `src/components/WorkerCard.tsx`.
- The supervisor conversation also renders `ConversationWorkerCard` for spawned workers and active workers in `src/components/home/ConversationMain.tsx`.

This makes the supervisor transcript feel like it contains a second embedded worker sidebar. The new behavior should keep the full terminal history in the worker sidebar, and replace inline worker terminals in the conversation with a compact worker presence control that only communicates the worker's latest action and opens the worker sidebar when clicked.

The high-level objective is to make the supervisor conversation read like a conversation again: workers should be visible as lightweight participants or references, while detailed worker history and controls live in one dedicated sidebar.

## Goals

- Preserve `src/components/Terminal.tsx` and the existing sidebar worker terminal experience.
- Stop rendering full worker terminal history inline in the supervisor conversation.
- Add a separate conversation-level worker control that appears when a worker is started.
- Show only the latest meaningful worker action in that control, not the full output history.
- Make clicking the control open the worker sidebar by default and bring the referenced worker into view.
- Allow workers to be referenced inline when needed, with references also opening the worker sidebar.
- Keep implementation scoped to the current component hierarchy and avoid file-based routing changes.

## Non-Goals

- Rebuilding worker orchestration, bridge streaming, or persisted worker state.
- Removing or redesigning `src/components/Terminal.tsx`.
- Removing the desktop or mobile worker sidebar.
- Changing planning or direct conversation terminal behavior.
- Adding a full worker detail page or route.

## Current Behavior

- `src/components/home/ConversationMain.tsx` detects system messages beginning with `Spawned worker.` and renders `ConversationWorkerCard` inline.
- The same file also appends an inline `CLI Agents` section for active implementation workers, again using `ConversationWorkerCard`.
- `src/components/home/WorkersSidebar.tsx` exports `ConversationWorkerCard`, which wraps `src/components/WorkerCard.tsx`.
- `src/components/WorkerCard.tsx` renders `Terminal`, so conversation inline cards and sidebar cards share the same rich terminal history UI.
- `src/app/home/HomeApp.tsx` owns `rightSidebarOpen`, `mobileWorkersOpen`, `selectedRunWorkers`, and `conversationAgents`, so it is the natural place to expose an open-sidebar callback to conversation controls.

## Desired UX

### Worker Start Control

When a supervisor message indicates a worker was spawned, the conversation should render a compact worker control instead of an inline terminal card.

The control should include:

- Worker identity: title or `Worker N`, with worker id available as a tooltip or secondary text.
- Worker status: starting, working, idle, stuck, stopped, completed, failed, or cancelled.
- Worker type/model metadata if it fits without visual clutter.
- Latest action text derived from live worker activity.
- Permission/stuck/error emphasis when applicable.
- A clear affordance such as `Open worker` or row click behavior.

The control should not include:

- `Terminal`.
- Collapsible full history.
- Tool input/output panes.
- The complete stream of past messages.

### Latest Action Semantics

The latest action should be a single short summary selected from the worker's available live snapshot, in priority order:

1. Pending permission request summary.
2. Current in-progress tool call or thinking state from `outputEntries`.
3. Latest completed tool/message/permission activity from `outputEntries`.
4. `currentText`, then `displayText`, then `lastText` as fallback.
5. Error or stop reason for failed/stopped workers.
6. A neutral state fallback such as `Worker is starting` or `Worker is waiting`.

The summary should be truncated for transcript readability and should not expose multiple historical entries.

### Sidebar Navigation

Clicking a worker control or worker reference should:

- Open the desktop worker sidebar by setting `rightSidebarOpen` to `true`.
- Open the mobile worker sheet by setting `mobileWorkersOpen` to `true` on small screens.
- Prefer the active workers tab when the worker is active, and the finished workers tab when the worker is no longer active.
- Bring the referenced worker into view and visually highlight it briefly if practical.

If the worker does not yet exist in persisted state but a worker id was parsed from the spawn message, the control should still open the sidebar and show a graceful starting/fallback state.

### Inline Worker References

When supervisor copy needs to mention a worker outside the spawn control, worker references should be rendered as small clickable chips or links rather than embedding another terminal.

References should support at least known worker ids and display labels from `selectedRunWorkers`. They should reuse the same sidebar navigation behavior as the worker start control.

## Architecture

### Component Split

Keep the existing sidebar stack intact:

- `WorkersSidebar` renders `ConversationWorkerCard`.
- `ConversationWorkerCard` renders `WorkerCard`.
- `WorkerCard` renders `Terminal`.

Add a separate conversation stack:

- `ConversationWorkerPresence` or similarly named component for the compact worker-start control.
- A small latest-action helper, likely in `src/lib/conversation-workers.ts` or a focused UI helper module, to avoid duplicating output-entry parsing in JSX.
- Optional `WorkerReference` component for clickable worker mentions in plain supervisor/system message text.

### State Flow

`HomeApp` should pass a worker navigation callback into `ConversationMain`, for example `openWorkerSidebar(workerId: string)`.

`ConversationMain` should use that callback when rendering:

- parsed `Spawned worker.` system messages,
- compact worker reference chips,
- any future conversation-level worker status controls.

`WorkersSidebar` should accept optional focus props, for example `focusedWorkerId` and `onFocusedWorkerHandled`, and use them to select the right tab and scroll/highlight the worker. If scroll/highlight adds too much complexity, opening the correct sidebar is the minimum requirement.

### Data Reuse

Use existing frontend state already available to `ConversationMain`:

- `selectedRunWorkers` for persisted worker identity and status.
- `conversationAgents` for live output, permissions, context usage, and errors.
- `parseSpawnedWorkerMessage` for worker id and purpose fallback.
- `isWorkerActiveStatus` and `buildWorkerLists` for tab selection and active/finished grouping.
- `buildAgentOutputActivity` for deriving latest activity from `outputEntries` where useful.

## Acceptance Criteria

- Inline supervisor conversation no longer renders `ConversationWorkerCard`, `WorkerCard`, or `Terminal` for implementation workers.
- The worker sidebar still renders `Terminal` exactly through the existing sidebar card path.
- Spawned worker system messages render a compact worker presence control.
- The presence control shows one latest action summary and does not show full terminal history.
- Active workers are not duplicated in a bottom `CLI Agents` terminal section in the conversation.
- Clicking a worker control opens the worker sidebar by default on desktop and the worker sheet on mobile.
- Worker references in conversation text, where implemented, use the same open-sidebar behavior.
- Focused tests cover the absence of inline terminals and the presence of the new compact control behavior.

## Risks

- Deriving a useful latest action from heterogeneous agent output entries may need careful fallbacks.
- Automatically focusing a worker in the sidebar can introduce fragile DOM scrolling if over-specified.
- Existing source-string UI tests in `tests/ui/sidebar-layout.test.ts` may need updates because they currently assert around worker card placement.
- Mobile and desktop sidebar opening share intent but use different state variables.

## Open Decisions

- Whether worker references should parse every raw worker id in supervisor text or only render in known structured locations first.
- Whether the first implementation should include scroll-and-highlight in the sidebar or only open the sidebar with the correct active/finished tab.
- Exact visual styling of the compact control, as long as it is clearly distinct from the terminal/sidebar card.
