# Busy Conversation Steer And Queue Design

## Goal

When a supervisor or worker is already running, typing into the composer should turn the stop control back into a send control. Sending that text should either steer the active work immediately or queue the message for later delivery, based on a saved setting.

## Constraints

- Do not create branches or worktrees.
- Do not introduce file-based routing.
- Keep state centralized in manager classes. Components subscribe to managers and call manager methods.
- Avoid growing `src/app/home/HomeApp.tsx`, which is already over 1,200 lines.
- Preserve the current empty-input stop behavior while a conversation is stoppable.
- Persist the setting through the existing `/api/settings` path, not `.env`.

## Product Pass

Primary user: the human builder watching one or more agents work, with a need to add context without losing the ability to stop runaway work.

Supporting jobs:

- Know whether typed text will steer now or wait in the queue.
- Add several queued notes while an agent is busy.
- See pending queued notes without opening another panel.
- Remove queued notes before they are delivered.
- Keep stop available when the input is empty.
- Persist the default behavior across reloads and sessions.

Trust surfaces:

- The UI must not silently drop a message sent while an agent is busy.
- Queued messages need durable storage, visible pending status, and clear delivery or failure events.
- Immediate steering should be explicit in event logs, especially for supervisor interventions.

## Recommended Behavior

Use a setting called `BUSY_MESSAGE_ACTION` with values:

- `steer`: send typed busy-time messages immediately to the active supervisor or worker.
- `queue`: store typed busy-time messages and deliver them when the active supervisor or worker reaches a safe turn boundary.

Default recommendation: `queue`. It is safer because typing during active work usually means "remember this next," not "interrupt the active turn right now." Users who prefer active steering can switch the setting.

## Composer Behavior

Busy definition:

- Implementation mode: the selected run has an active supervisor loop.
- Planning or direct mode: the selected run has a worker in `starting`, `working`, or `stuck`, or a message send is pending.

Button rule:

- Busy plus empty input: show stop button, existing behavior.
- Busy plus non-empty input or attachments: show send button.
- Not busy: show normal send button.

Send label:

- `BUSY_MESSAGE_ACTION=steer`: "Steer active work".
- `BUSY_MESSAGE_ACTION=queue`: "Queue message".

The textarea must no longer be disabled just because the conversation is stoppable. It should only be disabled during the specific mutation that would make editing unsafe, such as attachment upload or local submit in progress.

## Queue Drawer

The queued-message surface should live directly above the composer form:

- Width: slightly narrower than the composer, for example `max-w-[calc(theme(maxWidth.3xl)-2rem)]` or an inner `mx-4`.
- Shape: top-left and top-right rounded, bottom visually tucked under the composer so the input area appears attached to it.
- Position: absolute or stacked immediately before the composer shell, above the input and below mention picker priority.
- Content: compact list of pending queued messages, oldest first.
- Controls: remove/cancel per queued item, and optionally "Send now" later if we want to expand scope.
- Empty state: do not render the drawer.
- Mobile: full composer width minus side padding, max height with scroll.

The drawer should be a product UI surface, restrained, dense, and familiar. No nested cards.

## Data Model

Create a durable queue table instead of overloading `messages`:

`queued_conversation_messages`

- `id`
- `run_id`
- `target_worker_id`, nullable
- `action`, `queue` or `steer`
- `content`
- `attachments_json`
- `status`, `pending`, `delivering`, `delivered`, `cancelled`, `failed`
- `last_error`
- `created_at`
- `updated_at`
- `delivered_at`

Expose pending queue entries in the event stream so every connected client sees the same drawer.

## Server Semantics

`POST /api/conversations/[id]/messages` should accept an optional `busyAction` payload:

- Omitted: preserve existing behavior for non-busy sends.
- `steer`: immediately deliver while busy.
- `queue`: persist as pending and return the queued entry.

Implementation mode:

- `steer`: insert a user checkpoint and notify or restart the supervisor loop. The next supervisor turn must see the new checkpoint.
- `queue`: persist the queued entry. The supervisor loop drains pending entries at the start of a turn boundary, converts them into user checkpoint messages, marks them delivered, and records an execution event.

Planning and direct modes:

- `steer`: attempt immediate `askAgent`. If the bridge reports "agent is busy," do not fail after accepting the user message. Either convert to queue or return a precise error depending on final product choice. Recommendation: convert to queue and surface an event that immediate steering was deferred.
- `queue`: persist pending entries. A queue processor drains pending entries when the worker snapshot sync shows an idle or done turn boundary, then calls `askAgent` in FIFO order.

Cancellation:

- Add an API action to cancel queued messages, scoped to the selected run.
- Cancelled queue entries stay in storage for audit but do not render in the pending drawer.

## Frontend Architecture

Add a dedicated manager instead of expanding component-local state:

- `src/app/home/BusyMessageQueueManager.ts`: owns selected-run queue entries, optimistic enqueue/cancel, and snapshots from event stream.
- `src/app/home/busy-message-behavior.ts`: pure helpers for resolving busy state, button mode, aria label, and submit action.
- `src/components/home/QueuedMessageDrawer.tsx`: drawer UI.

Minimal changes in existing files:

- `src/app/home/types.ts`: queue record type and settings tab/action type.
- `src/app/home/HomeUiStateManager.ts`: default `BUSY_MESSAGE_ACTION`.
- `src/components/home/SettingsDialog.tsx`: add a "During active work" setting, probably under Worker Agents unless we add a small "Behavior" tab.
- `src/components/home/ConversationComposer.tsx`: accept queue entries and resolved button mode, render drawer, call explicit submit handlers.
- `src/app/home/HomeApp.tsx`: wire managers and mutations only. Avoid embedding queue logic directly.

## Testing Strategy

Deterministic tests:

- Helper tests for busy-state and button-mode resolution.
- Server tests for queue creation, cancellation, FIFO draining, and failed delivery retention.
- Settings load/save test for `BUSY_MESSAGE_ACTION`.

Manual or agentic journey tests after implementation approval:

- Start a direct worker, type while it is working, confirm the stop button becomes send when text exists.
- Set busy behavior to `queue`, send two notes, confirm the drawer appears above the input and notes deliver FIFO after the worker is ready.
- Set busy behavior to `steer`, send a note while implementation supervisor is running, confirm an event records the steering and the supervisor incorporates it.

## Open Decision

If immediate `steer` hits a busy worker bridge error, should we auto-convert to queue or fail loudly? Recommendation: auto-convert to queue with an event, because the user has already expressed intent and dropping back to an error is the least useful outcome.
