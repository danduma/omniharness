# Supervisor Conversation Signal Design

## Summary

OmniHarness implementation conversations currently mix three different kinds of information in the same main transcript:

- human conversation: user requests, supervisor questions, supervisor completion summaries,
- user-relevant run state: workers started, permissions needed, failures, stuck or blocked work,
- supervisor and worker telemetry: periodic checks, busy retry bookkeeping, repo inspections, prompt deferrals, worker polling, context compaction, and other operational events.

That mixture makes the supervisor conversation feel spammy and undermines confidence. The user sees lines like:

```text
system
4e91c93f-0220-432d-82e2-ed08769c851e-worker-6 is already busy; waiting before sending another prompt.
```

Those messages are useful for debugging, but they are not useful conversation. The main feed should show what the human needs to know, decide, or trust. Full telemetry should still exist, but in an intentional run log or worker detail surface.

This design separates the product surfaces into:

- **Main conversation**: durable human conversation and action-worthy state.
- **Dynamic supervisor status**: one compact, updating row that shows the supervisor is attentive without adding transcript lines.
- **Worker status rows**: one dynamic row per spawned worker, updated in place.
- **Run log**: full persisted operational telemetry for debugging and auditability.

It also changes backend behavior: the supervisor should use events and worker-state snapshots to track progress instead of writing periodic check messages into the conversation.

## Goals

- Stop periodic supervisor and worker checks from creating main conversation messages.
- Stop operational `system` messages from rendering as ordinary transcript rows.
- Preserve a clear indication that the supervisor is alive, watching, and coordinating workers.
- Add one dynamic visual row per spawned worker, updated in place instead of repeated as chat.
- Preserve full operational logs for debugging and recovery without putting them in the transcript.
- Reduce supervisor polling chatter and prefer event-driven or state-derived worker awareness where feasible.
- Keep actionable failures, permission needs, and user decisions visible.
- Avoid file-based routing.
- Do not create branches or worktrees for this work.

## Non-Goals

- Removing `execution_events`.
- Removing the worker sidebar or terminal surfaces.
- Hiding real errors from the frontend.
- Building a full bridge push protocol in this milestone.
- Rewriting the entire supervisor loop.
- Removing explicit recovery, retry, edit, or fork controls.

## Product View

### Primary User

The primary user is the human builder supervising an implementation run. They want to stay oriented without reading internal scheduler noise.

### Core Job

The user needs to know:

- what they asked for,
- what the supervisor needs from them,
- whether work is active,
- which workers exist,
- whether any worker needs attention,
- whether the run is blocked, failed, or complete,
- where to inspect details when something looks wrong.

They do not need a transcript line every time the supervisor polls a worker, notices the worker is busy, reads routine context, or waits before checking again.

### North Star

The main conversation should read like a useful supervisory dialogue, not like a debug stream.

The app should still feel alive while work is running, but liveness should be represented by updating status surfaces, not by appending repetitive messages.

## Current Problems

### Runtime Writes Operational Messages Into Chat

Several supervisor paths persist `role = "system"` messages in the `messages` table for operational events. Examples include:

- worker busy retry deferral,
- worker spawn bookkeeping,
- worker cancellation,
- worker mode changes,
- permission approvals and denials,
- file reads,
- repo inspections,
- waits.

Some of these are also recorded as `execution_events`, so they can appear twice: once as event-derived activity and once as a persisted system message.

### UI Treats System Messages As Transcript

The main conversation renderer has a generic fallback for `msg.role === "system"`, which means any backend operational message can leak into the transcript unless explicitly filtered.

### Periodic Checks Create Product Noise

The supervisor loop currently expresses progress tracking as repeated actions like "wait", "busy", "prompt deferred", and "checking again". These may be operationally valid, but the user-facing product should show a single updating state such as:

```text
Supervisor is watching 2 workers. Worker 6 is busy. Next check soon.
```

That status should update in place and should not become chat history.

## Signal Taxonomy

Every supervisor or worker signal should be classified into exactly one display tier.

### Tier 1: Main Conversation

These are durable transcript items. They represent human intent, human decisions, or final human-facing results.

Show:

- user messages,
- user attachments,
- supervisor clarification questions,
- supervisor completion summaries,
- supervisor final failure summaries when the run ends,
- user answers,
- explicit retry, edit, fork, or recovery affordance context.

### Tier 2: Main Feed, Action-Worthy Event

These are not chat messages, but can appear inline because they explain a user-visible state or intervention need.

Show only when useful:

- `Read <file>` when it explains a following plan sync, question, or implementation decision,
- `Started <worker>` when a new worker is introduced and the user needs orientation,
- `Worker blocked: <reason>`,
- `Permission requested by <worker>`,
- `Permission approved for <worker>`,
- `Permission denied for <worker>`,
- `Worker cancelled: <reason>`,
- `Run validation failed: <reason>`,
- `Worker appears stuck`,
- `Worker unavailable: <reason>`,
- `Run failed: <reason>`.

These rows should not say `System`.

### Tier 3: Dynamic Status, Not Transcript

These show liveness and attentiveness, but never append lines to the conversation.

Show as updating UI:

- supervisor is monitoring active workers,
- worker is busy and the supervisor will retry,
- worker is currently thinking,
- worker has pending output,
- next planned check time,
- worker count and high-level states,
- latest live thought snippet if already available and useful,
- queue depth for user follow-up messages.

This tier should be derived from current run state, active worker snapshots, queued messages, and recent events. It should not create persisted chat messages.

### Tier 4: Run Log Only

These belong in telemetry and debugging surfaces only.

Do not show in the main conversation:

- `supervisor_wait`,
- `worker_prompt_deferred`,
- `worker_prompted`,
- `worker_output_changed`,
- `worker_idle`,
- `worker_mode_changed` unless manually triggered by the user and relevant,
- `worker_session_resumed`,
- `worker_snapshot_invalid`,
- `worker_poll_failed` unless escalated to an actionable error,
- `worker_observer_failed` unless escalated to an actionable error,
- `worker_permission_auto_approved`,
- `supervisor_repo_inspected`,
- `supervisor_context_compacted`,
- `plan_items_synced`,
- auth/session telemetry,
- routine bridge health checks,
- raw command output from supervisor inspection.

## UX Design

### Main Conversation Feed

The main feed should contain:

- user message bubbles,
- supervisor messages,
- worker result summaries when they are part of the user-facing flow,
- action-worthy event rows with short verb phrases,
- failure and recovery notices.

The main feed should not contain:

- visible `System` labels,
- raw worker ids unless needed for disambiguation,
- repeated check messages,
- internal retry messages,
- long operational details.

### Dynamic Supervisor Status Row

For active implementation conversations, render one compact status row below the newest transcript content or in a sticky in-thread position near the composer.

The row updates in place. It does not add transcript history.

Example states:

```text
Supervisor is watching 2 workers.
Worker 6 is busy. Retry queued.
Worker 6 is thinking. Worker 7 is verifying.
Awaiting permission from Worker 6.
Worker 6 appears stuck. Retry latest is available.
```

This row should prioritize the highest-urgency state:

1. permission needed,
2. stuck or failed worker,
3. queued user message waiting for delivery,
4. busy worker retry pending,
5. active thinking,
6. quiet monitoring,
7. completed.

### Worker Status Rows

When a worker is spawned, add one durable worker presence row or worker card reference. It should update in place with:

- worker number or short label,
- purpose/title,
- state,
- active model/effort if relevant,
- latest status,
- stop/action controls where appropriate.

This should replace repeated `Started worker`, `Prompted worker`, `worker busy`, and `worker output changed` lines.

### Run Log Surface

Add or refine an intentional log surface for all operational details.

The run log should:

- be collapsed by default,
- be clearly named `Run Log` or `Activity Log`,
- list `execution_events`,
- preserve timestamps, event type, worker id, summary, and expandable details,
- include telemetry currently removed from the main feed,
- be reachable when debugging but visually subordinate to conversation.

## Runtime Design

### Core Decision

Supervisor runtime should stop writing operational state transitions into the `messages` table.

Operational events should be written to `execution_events` and represented in UI through:

- dynamic status derivation,
- worker snapshots,
- run log entries,
- explicitly allowlisted transcript events.

### Backend Event Use

Keep recording full events for observability:

- busy retries,
- waits,
- worker prompts,
- bridge poll failures,
- inspections,
- file reads,
- compactions,
- session resumes,
- output changes.

But do not create `system` chat messages for routine operational events.

### Reducing Periodic Checks

The current supervisor loop appears to rely on frequent periodic checks of worker state. This should be improved in stages:

1. **Current milestone**: stop periodic checks from becoming conversation messages.
2. **Near-term**: derive liveness from existing worker snapshots and event timestamps instead of supervisor-authored wait chatter.
3. **Near-term**: use queued-message state and worker busy errors to schedule retry without writing chat messages.
4. **Later**: make the worker observer/event pipeline more authoritative, so the supervisor can react to worker state changes instead of asking the model to repeatedly decide to wait.
5. **Later**: consider bridge-level push or lower-cost worker event subscriptions if the ACP bridge supports them.

The product behavior should be that users see an attentive supervisor status, while implementation detail becomes a run-log concern.

## Data Flow

### Main Conversation

Input sources:

- `messages` filtered to user, supervisor, worker output summaries, and explicit error/completion kinds,
- `execution_events` filtered through a transcript visibility policy,
- current run failure and recovery state.

Output:

- transcript items only.

### Dynamic Supervisor Status

Input sources:

- active worker snapshots,
- persisted worker rows,
- pending permissions,
- queued messages,
- recent `execution_events`,
- run status.

Output:

- one updating status model, not transcript items.

### Run Log

Input sources:

- all `execution_events`,
- optional related worker/message ids,
- event details JSON.

Output:

- collapsed operational log.

## Visibility Policy

Create one explicit policy module or utility, rather than scattered string checks.

Recommended API:

```ts
type ConversationSignalDestination =
  | "main_conversation"
  | "inline_event"
  | "dynamic_status"
  | "run_log";

function classifyExecutionEvent(event: ExecutionEventRecord): ConversationSignalDestination;
function shouldRenderMessageInMainConversation(message: MessageRecord): boolean;
function summarizeInlineEvent(event: ExecutionEventRecord): string | null;
```

The policy must be tested with representative event and message fixtures.

## Error Transparency

Errors should not be hidden just because operational noise is hidden.

Escalate to main feed or visible notices when:

- a worker cannot start,
- a worker becomes stuck,
- permission is needed,
- validation fails,
- the run fails,
- the bridge/runtime is unavailable in a way that blocks progress,
- a queued user message cannot be delivered after retry policy is exhausted.

Keep in run log only when:

- the system recovered automatically,
- the event is transient,
- the user has no action to take,
- the event only helps developers inspect internals.

## State Model

Durable state:

- `messages`: human transcript and durable supervisor/user-facing messages.
- `execution_events`: full operational event log.
- `workers`: durable worker membership and lifecycle.
- `queuedConversationMessages`: user follow-ups waiting for delivery.
- `supervisorInterventions`: prompts sent to workers when meaningful for worker detail surfaces.

Derived UI state:

- main conversation timeline,
- dynamic supervisor status,
- worker status rows,
- run log view model,
- recovery notice state.

No frontend state should become the source of truth for run progress. UI state should derive from managers and server records.

## Persistence Model

No new user preference is required in the current milestone.

The run log open/closed state can be local UI state if added. If persistence is later desired, define a localStorage key owned by the relevant UI manager.

All meaningful operational data remains persisted in `execution_events`.

## Product Completeness Pass

### Primary Stories

- As a user, I can watch an implementation run without the transcript filling with repeated internal checks.
- As a user, I can still tell the supervisor is alive and monitoring workers.
- As a user, I can see one row per spawned worker and understand each worker's current role.
- As a user, I can see actionable blockers and recovery options in the main feed.
- As a user, I can inspect full operational logs when something is confusing.

### Return Stories

- As a user returning to an old conversation, I see a clean transcript, not old internal telemetry.
- As a user debugging an old run, I can open the run log and see the full event history.

### Failure and Recovery Stories

- If a worker is busy, the main feed does not get a new line. The dynamic status says retry is queued or worker is busy.
- If a worker is stuck, the main feed or status surface shows an actionable recovery state.
- If permission is needed, the user sees it prominently.
- If the bridge is down, the user sees a visible runtime error rather than silent disappearance.

### Status-Awareness Stories

- The user can tell whether the supervisor is monitoring, waiting, blocked, or complete.
- The user can tell which workers are active and what each is doing.
- The user can tell when no action is required.

## Acceptance Criteria

- The main conversation no longer renders generic `system` messages.
- `worker_prompt_deferred` never appears as a main conversation line.
- `supervisor_wait` never appears as a main conversation line.
- Routine worker prompt/output/idle/mode/session events do not appear in the main feed.
- One dynamic supervisor status row updates for active implementation runs without appending transcript history.
- One worker status row/card exists per spawned worker and updates in place.
- Full operational events remain visible in a run log or equivalent debug surface.
- Actionable failures, permission requests, blocked spawns, and recovery states remain visible.
- Existing conversations with old persisted operational `system` messages are filtered out of the main feed.
- Tests cover both new events and legacy persisted messages.

## Testing Strategy

### Unit Tests

Add tests for the visibility policy:

- `worker_prompt_deferred` routes to dynamic status or run log only.
- `supervisor_wait` routes to run log only.
- `worker_prompted`, `worker_output_changed`, `worker_idle` route to run log only.
- `worker_spawn_blocked`, permission events, validation failure, stuck worker, and run failure route to visible surfaces.
- legacy persisted `system` messages matching operational patterns are hidden.

### UI Source Tests

Assert:

- no generic `msg.role === "system"` transcript fallback remains,
- dynamic status is rendered as one surface,
- run log or activity log surface is present and collapsed by default,
- worker rows/cards are rendered from worker records and live snapshots.

### Integration Tests

Use supervisor runtime tests to verify:

- busy worker deferral records `execution_events` but not `messages`,
- wait actions record `execution_events` but not `messages`,
- routine repo inspection records events but does not write chat messages,
- actionable supervisor messages still persist when needed.

### Candidate User-Journey Test

After implementation, with approval, run an agentic user journey:

1. Start an implementation conversation that spawns a worker.
2. Cause a busy-worker deferral or wait cycle.
3. Confirm the main transcript does not gain operational lines.
4. Confirm the dynamic status updates.
5. Confirm the run log contains the operational events.

## Implementation Notes For The Later Plan

Likely files:

- `src/app/home/utils.ts`: visibility policy and event summaries.
- `src/components/home/ConversationMain.tsx`: remove generic system rendering and add dynamic status placement.
- `src/app/home/useConversationExecutionStatus.ts`: status priority and text model.
- `src/app/home/HomeApp.tsx`: derive status inputs and timeline items.
- `src/components/home/WorkersSidebar.tsx` or a new focused component: worker status row/card presentation.
- `src/server/supervisor/index.ts`: stop operational `insertRunMessage` calls.
- `tests/app/home-utils.test.ts`: visibility policy coverage.
- `tests/supervisor/index.test.ts`: runtime persistence coverage.
- `tests/ui/sidebar-layout.test.ts`: source-level UI guardrails.

If any touched file is already too large, extract focused helpers rather than expanding it further.

## Open Questions

- Should the run log live in the right worker sidebar, in the header, or below the conversation behind a compact disclosure?
- Should `Read <file>` appear only for plan files, or for any supervisor-read file that contributes to context?
- Should worker spawn show as a main feed inline event, or only as the worker row/card appearing?
- Should the dynamic supervisor status be sticky near the composer or inline at the bottom of the transcript?

