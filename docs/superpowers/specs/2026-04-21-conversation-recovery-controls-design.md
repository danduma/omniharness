# Conversation Recovery Controls Design

## Summary

The conversation UI needs to stop treating messages as passive output and start treating user prompts as recovery checkpoints. Today a run can fail in the backend without surfacing a durable error in the frontend, and the user has no way to retry, edit a prior prompt, or branch from an earlier point in the conversation.

This design adds three missing capabilities:

1. visible durable failure states for runs and messages,
2. message-level rerun controls for user prompts,
3. replay logic that can either truncate history in place or fork a new conversation from a chosen checkpoint.

Any recovery action that would restart execution must automatically cancel live workers for the affected conversation before rerunning.

## Goals

- Surface supervisor and execution failures directly in the conversation feed and sidebar.
- Allow retrying from the latest relevant user message after a failure.
- Allow editing a prior user message and rerunning in place, truncating downstream history.
- Allow forking a new conversation from any prior user message.
- Keep the interaction model obvious and low-friction for normal chat usage.
- Preserve enough history metadata to explain what happened after edits, forks, and retries.

## Non-Goals

- Building full event sourcing or arbitrary time-travel replay for every internal supervisor step.
- Preserving all downstream artifacts after an in-place edit rerun.
- Supporting rerun controls on non-user messages.
- Keeping active workers alive during retry or fork flows.

## User Experience

### Message-Level Controls

User messages become explicit checkpoints. Each user message should expose a compact actions menu with:

- `Retry from here`
- `Edit in place`
- `Fork from here`

These controls should only appear on user messages, not on supervisor, system, or worker messages.

### Retry From Here

`Retry from here` keeps the selected message content unchanged and reruns the conversation from that checkpoint in the same run.

Behavior:

- cancel any live workers for the run,
- clear the run's failed state,
- remove or supersede all later messages and run artifacts after the selected checkpoint,
- restart the supervisor using conversation history up to and including the selected user message.

This is the primary recovery action after a visible failure.

### Edit In Place

`Edit in place` lets the user change the selected user message and continue within the same conversation.

Behavior:

- open an inline editor for the selected message,
- warn that later history will be removed,
- cancel live workers for the run before applying the edit,
- update the selected message content,
- remove or supersede every later message and derived artifact in that run,
- restart the supervisor from the edited message.

This is destructive by design. The resulting conversation remains the same run.

### Fork From Here

`Fork from here` creates a new conversation starting from the selected checkpoint while preserving the original conversation as historical record.

Behavior:

- optionally allow the user to edit the selected prompt before launching the fork,
- cancel live workers for the source run if that run is still active,
- create a new run and a new ad hoc plan snapshot,
- copy conversation history through the selected checkpoint into the new run,
- mark the new run as forked from the source run and source message,
- restart the supervisor in the new run from that checkpoint.

The source run remains visible and unchanged after the fork except for worker cancellation if it was active.

### Visible Failure States

Failures must be persisted and shown in the main conversation view, not only logged to stderr.

When a run fails:

- the selected run header should show a failed state,
- the sidebar should show a red failed indicator,
- the conversation feed should include a durable system error message with the failure text,
- the latest relevant user message should expose retry/edit/fork controls,
- the header should also expose a top-level retry affordance for convenience.

Failure messages should use destructive styling and clearly indicate that execution stopped.

## Backend Model Changes

### Runs

`runs` should gain fields that support recovery and lineage:

- `parentRunId` for forks,
- `forkedFromMessageId` for fork provenance,
- `failedAt` for durable failure timestamps,
- `lastError` for concise run-level error summaries,
- `status` expanded to include `cancelling`, `failed`, and existing active states used by the UI.

### Messages

`messages` should gain fields that support checkpointing and replay:

- `kind` to distinguish normal output from error entries,
- `supersededAt` to mark messages hidden by in-place edits or retries,
- `editedFromMessageId` for message ancestry when editing,
- optional checkpoint metadata if needed to simplify replay selection.

At minimum, user messages and persisted failure messages must be distinguishable without guessing from `role`.

### Plans And Derived Records

Reruns affect plan items, clarifications, validation runs, execution events, and worker rows associated with the truncated segment.

For in-place retry and edit:

- downstream records after the checkpoint should be deleted or rebuilt so the run reflects the new history,
- active worker rows should be updated or cleaned up consistently with cancellation,
- stale clarifications and validation results from removed history must not remain attached to the run.

For forks:

- the new run should get fresh derived records,
- the source run keeps its existing records unchanged.

## Replay Semantics

The system should reconstruct supervisor input from persisted conversation state rather than trusting transient in-memory state.

Replay algorithm:

1. identify the selected user checkpoint,
2. cancel active workers for the relevant run,
3. gather non-superseded conversation messages up to that checkpoint,
4. apply the chosen action:
   - retry: keep selected message content,
   - edit in place: update selected message content and truncate later history,
   - fork: clone history into a new run and optionally update the copied checkpoint text,
5. rebuild or clear downstream derived records,
6. restart supervisor execution with reconstructed message history.

The replay path must be used both for explicit user retries and for recovering from failed runs.

## Failure Taxonomy

The system should persist and surface failures from these categories:

- supervisor startup failures,
- provider configuration and authentication failures,
- LLM request failures,
- bridge-client worker spawn or prompt failures that abort progress,
- invalid rerun or fork requests,
- cancellation failures that leave the run unable to continue,
- unexpected internal exceptions during supervisor execution,
- route-level failures for retry, edit, or fork actions.

If a failure prevents continued execution, the run status should become `failed` and a durable error message should be inserted into the conversation.

If a failure is recoverable inside the supervisor loop and execution can continue, it may remain a normal system message instead of failing the whole run.

## API Changes

### Existing Supervisor Start Route

The supervisor start flow should persist failure state when startup or background launch fails. It must stop relying on `console.error` as the only error sink.

### Run Recovery Route

Add a dedicated recovery endpoint under the run resource for checkpoint actions. It should accept:

- target message id,
- action type: `retry`, `edit`, or `fork`,
- optional replacement content for edit or fork flows.

The route should:

- validate the target message belongs to the run and is a user message,
- cancel live workers first,
- perform truncation or fork creation,
- restart supervisor execution,
- return the resulting run id and selected message id.

### Message Update Rules

Direct message editing should only be allowed through the recovery flow, not as a free-form message patch API. Editing a user message always implies rerun semantics.

## Frontend Changes

### Conversation Feed

The message renderer should:

- distinguish user, worker, system, and error messages visually,
- show message actions on user messages,
- support inline editing for `Edit in place`,
- hide or visually collapse superseded messages if that model is used,
- keep timestamps and role labels readable.

### Conversation Header

The selected conversation header should show:

- current run state,
- failure badge if failed,
- quick retry action when the run is failed,
- cancelling state while worker shutdown is in progress.

### Sidebar

The sidebar already distinguishes running and failed runs. It should continue to do so, but the failed state must now be driven by durable backend state rather than missing console-only errors.

### Interaction Safety

While a retry, edit, or fork action is in flight:

- disable duplicate action clicks,
- show pending feedback,
- prevent the command composer from accidentally launching conflicting work for the same run.

## Testing And Validation

Add focused tests for:

- supervisor failure persists `failed` run state and an error message,
- retry from latest user message clears failure state and relaunches execution,
- edit in place truncates downstream messages and derived records,
- fork from a checkpoint creates a new run with copied history,
- recovery actions auto-cancel active workers first,
- invalid checkpoint targets return useful errors,
- frontend renders failure styling and message action controls,
- header and sidebar reflect failed and cancelling states correctly.

Validation should include at least one end-to-end failure recovery path: fail a run, surface the error, retry from the message, and confirm the run can proceed.

## Risks

- Reconstructing supervisor state from persisted messages may expose gaps in what is currently stored.
- Truncating derived records incorrectly could leave orphaned plan or validation state.
- Worker cancellation timing may create races if rerun starts before cancellation fully completes.
- Fork behavior could confuse users if lineage is not clearly labeled.

## Recommendation

Implement message-level recovery around user checkpoints, backed by durable failure persistence and a single replay service that handles retry, in-place edit, and fork flows. This is the smallest design that fixes the current UX breakage without introducing a full event-sourcing system.
