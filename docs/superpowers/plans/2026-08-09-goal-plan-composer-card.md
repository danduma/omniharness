# Goal/Plan Composer Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task.

**Goal:** Add a durable, live, ACP-backed goal/plan card directly above the composer, matching the supplied reference.

**Architecture:** A durable run-level goal is reconciled to the active ACP worker session. ACP goal metadata and plan updates are normalized into the existing event/snapshot control plane, then rendered by a dedicated composer-adjacent card.

**Tech Stack:** TypeScript, SQLite/Drizzle, ACP, SSE event snapshots, React, existing Manager classes, shadcn/ui primitives, Playwright/lifecycle tests.

**North Star Product:** Long-running `/goal` work feels like a first-class controllable job: users can always see what is being pursued, its duration, current plan, and available controls.

**Current Milestone:** One active goal per run, collapsed and expanded card states, edit/pause/resume/clear controls, persistence across reconnect/restart/failover, capability-aware behavior for Claude and Codex, accessibility, localization, and deterministic lifecycle coverage.

**Future Product Direction:** Support richer goal histories, multiple coordinated goals, and deeper plan/artifact navigation after the single-active-goal experience is reliable.

**Final Functionality Standard:** The card must control and display real server/ACP state end-to-end. No transcript-only state, fake UI state, placeholder actions, or parallel worker-conversation persistence may be used as the final implementation.

---

## Product decisions

Treat these decisions as the implementation baseline:

- One active goal per OmniHarness run.
- The supplied screenshot is the collapsed state.
- The chevron expands a concise checklist in place, growing upward above the composer.
- The existing file-backed planning/review surface remains separate.
- Clearing a goal hides the card after the server confirms the clear. A persisted tombstone prevents it from reappearing from stale cache after refresh.
- Completed goals may remain visible as a terminal summary until the run changes or the user dismisses them.
- Pause/resume controls are displayed only when the active agent advertises support.
- Claude/Codex ACP extensions remain provider-specific; OmniHarness exposes one normalized goal model to the UI.

ACP's native plan updates should populate the expanded checklist, while `_session/goal` remains the control extension rather than a new ACP core method. See the [ACP agent plan](https://agentclientprotocol.com/protocol/v1/agent-plan) and [ACP extensibility](https://agentclientprotocol.com/protocol/v1/extensibility) specifications.

---

## Current repository surfaces

- `src/components/home/ConversationComposer.tsx` owns the composer form and is the insertion point above the input surface.
- `src/interface/home/ComposerContainer.tsx` wires the composer from the home surface.
- `src/components/PlanProgress.tsx` is a generic plan list, is not currently wired to the composer, and contains hardcoded UI strings.
- `src/components/PlanningArtifactsPanel.tsx` is a separate file-backed artifact/review surface.
- `src/server/agent-runtime/acp/session-updates.ts` normalizes `plan`, `plan_update`, and `plan_removed` into worker output entries.
- `src/components/Terminal.tsx` renders those plan entries in the transcript.
- `src/server/agent-runtime/manager.ts` and `src/server/agent-runtime/acp/runtime-client.ts` already support generic ACP extension-method dispatch.
- `src/runtime/http/routes/index.ts` registers typed HTTP routes.
- `src/runtime-api/types.ts` and `src/runtime-api/domains/index.ts` define renderer API domains.
- `src/interface/home/EventStreamStateManager.ts` owns server snapshots, cache provenance, runs, plans, workers, planning artifacts, queued messages, and recovery state.
- `shared/home-types.ts` contains existing file-backed `PlanRecord` and `PlanItemRecord` types.
- `src/server/events/persisted-snapshot.ts` builds the server snapshot used for bootstrap and resync.
- `docs/architecture/lifecycle-observability-and-testing.md` governs new server state transitions.

`HomeApp.tsx`, `ConversationMain.tsx`, and `useHomeMutations.ts` are already large. Keep goal business logic in new focused modules instead of growing those files further; split adjacent wiring if a change would make an oversized file harder to maintain.

---

## File map

### New files

- `shared/goal-plan.ts`
  - Shared goal snapshot, plan item, status, capability, action, and API response types.

- `src/server/agent-runtime/acp/goal-state.ts`
  - Normalize ACP goal metadata and structured plan updates.
  - Parse extension capabilities and provider-specific statuses.

- `src/server/runs/goal-control.ts`
  - Durable goal state machine.
  - Set, edit, pause, resume, clear, reconcile, and validate operations.

- `src/server/runs/goal-outbox.ts`
  - Drain durable goal lifecycle publications after the state transaction commits.
  - Re-emit unpublished named events safely after restart.

- `src/runtime/http/routes/goals.ts`
  - Authenticated run-goal API handlers.

- `src/interface/home/GoalPlanManager.ts`
  - Own card presentation state, action lifecycle, expansion, editing, and display clock.
  - Must not duplicate the canonical server snapshot owned by the event stream manager.

- `src/components/home/GoalPlanCard.tsx`
  - Collapsed/expanded UI and action controls.

### Existing files to modify

- `src/server/db/schema.ts`
- `src/server/db/index.ts`
  - Add durable run-goal, idempotency, and publication-outbox storage and initialization.

- `src/server/agent-runtime/types.ts`
- `src/server/agent-runtime/acp/session-updates.ts`
- `src/server/agent-runtime/acp/runtime-client.ts`
- `src/server/agent-runtime/manager.ts`
  - Integrate normalized ACP goal and plan state without routing it through worker transcript persistence.

- `src/server/events/named-events.ts`
- `src/server/events/persisted-snapshot.ts`
  - Add goal lifecycle events and snapshot data.

- `src/runtime/http/routes/index.ts`
- `src/runtime-api/types.ts`
- `src/runtime-api/domains/index.ts`
  - Register and expose typed goal APIs.

- `src/interface/home/EventStreamStateManager.ts`
- `src/interface/home/EventStreamSnapshotCacheManager.ts`
- `src/interface/home/useHomeViewModel.ts`
  - Add goal snapshots to canonical event-stream state and cache/provenance rules.

- `src/interface/home/ComposerContainer.tsx`
- `src/components/home/ConversationComposer.tsx`
  - Insert the card above the input while preserving composer behavior and focus.

- `src/components/PlanProgress.tsx`
  - Reuse it through the new normalized model or refactor it so there is no duplicate plan model or hardcoded copy.

- `shared/locales/en.json` and every other `shared/locales/*.json`
  - Add all goal statuses, controls, tooltips, errors, confirmations, checklist labels, and accessibility text.

### Tests and verification surfaces

- `tests/shared/goal-plan.test.ts`
- `tests/server/goal-control.test.ts`
- `tests/server/goal-outbox.test.ts`
- `tests/server/agent-runtime-goal.test.ts`
- `tests/app/goal-plan-manager.test.ts`
- `tests/app/event-stream-state-manager.test.ts`
- `tests/runtime-api/goals.test.ts`
- `tests/lifecycle/scenarios/goal-set-and-display.test.ts`
- `tests/lifecycle/scenarios/goal-plan-update.test.ts`
- `tests/lifecycle/scenarios/goal-pause-resume.test.ts`
- `tests/lifecycle/scenarios/goal-clear-tombstone.test.ts`
- `tests/lifecycle/scenarios/goal-reconnect-resync.test.ts`
- `tests/lifecycle/scenarios/goal-worker-reattach.test.ts`
- `tests/lifecycle/scenarios/goal-worker-failover.test.ts`
- `tests/lifecycle/scenarios/goal-unsupported-control.test.ts`
- `tests/lifecycle/scenarios/goal-stale-revision.test.ts`
- `tests/lifecycle/scenarios/goal-provider-failure.test.ts`
- `tests/lifecycle/scenarios/goal-concurrent-actions.test.ts`
- `tests/lifecycle/scenarios/goal-clear-versus-update.test.ts`
- `tests/lifecycle/scenarios/goal-stale-lease.test.ts`
- `tests/lifecycle/scenarios/goal-publication-recovery.test.ts`
- `tests/lifecycle/scenarios/goal-bootstrap-overlap.test.ts`

Propose, but do not run without explicit user approval, a browser journey test under `tests/e2e/` for the visual card and composer interaction.

---

## Data and state contract

Create `shared/goal-plan.ts` with these stable protocol-independent types.

### Goal status

```text
absent
pending
pursuing
paused
waiting_user
blocked
limited
validating
completed
cleared
error
```

### GoalSnapshot

Include:

- `runId`
- `goalId`
- `revision`
- `leaseGeneration`
- `objective`
- `status`
- `startedAt`
- `pausedAt`
- `resumedAt`
- `completedAt`
- `updatedAt`
- `workerId`
- `acpSessionId`
- `plan`
- `planSource`
- `capabilities`
- `lastError`
- `validationState`
- `visible`
- snapshot provenance and event cursor metadata

`revision` is a monotonically increasing per-run canonical version. It advances for every accepted goal mutation, accepted plan replacement/removal, and authoritative reconciliation state change. It is the conditional-write token and the client merge ordering key.

`leaseGeneration` identifies the active worker/session lease. It advances whenever a worker session is attached, recreated, transferred, or failover-replaced. Updates from an older lease generation are ignored as stale and emit an observable stale-lease event.

### GoalPlanItem

Include:

- stable id
- title/content
- optional phase
- status
- ordering
- provider id when available

### GoalCapabilities

Represent:

- set
- edit
- pause
- resume
- clear
- fallback method used

### Mutation contract

Every mutation carries:

- `goalId`
- expected revision
- `operationId`

A stale revision must return the newest canonical snapshot. Repeated operation ids must be idempotent and must not send duplicate ACP commands.

The UI must never infer terminal state from transcript text, elapsed time, or the presence of a plan item. The server snapshot is authoritative.

### Precedence and terminal semantics

- An accepted API mutation is the durable desired state.
- ACP metadata is authoritative for observed adapter capability/lease state and current provider plan, but cannot overwrite the durable objective or revive a cleared goal.
- A newer durable revision wins over an older ACP update, regardless of arrival order.
- Clear increments the run revision, records a tombstone, sets `visible=false`, and prevents delayed updates from the cleared `goalId` or an older `leaseGeneration` from reviving it.
- `GET /api/runs/:id/goal` returns the canonical tombstone after clear. A new goal receives a new `goalId` and a later run revision.
- One active goal per run is enforced by the run-goal row key and the state transaction, not only by application checks.

Define the state machines and legal actors explicitly:

- Goal: `absent → pending → pursuing → paused/waiting_user/blocked/limited/validating → completed`; any active state may become `error` or `cleared`; only API/reconciliation recovery may leave `error`, and `cleared` is terminal for that `goalId`.
- Operation: `received → committed`, `replayed`, `rejected`, or `fingerprint_conflict`; only an authenticated API request or authorized recovery command may create one.
- Outbox: `pending → claimed → published`, with `retryable` and `poisoned` failure states; only the owner claim may complete or retry a row.
- Lease: `detached → active → expired/superseded`; only attach/reattach/recreate/failover reconciliation may advance the lease generation.
- Tombstone: `visible terminal → hidden cleared`; no ACP, retry, administrative recovery, or stale worker path may revive the cleared `goalId`.

Rejected and true no-op mutations do not advance the goal revision. Accepted clear, goal replacement, plan replacement/removal, and authoritative reconciliation changes do advance it.

### Idempotency and publication

- Store `(runId, operationId)` in a unique idempotency table with an input fingerprint and the canonical result snapshot.
- Bind each operation record to the authenticated principal/tenant, endpoint, and action type in addition to `runId` and `operationId`.
- Retrying the same operation id with the same fingerprint returns the stored result without a second ACP command.
- Reusing an operation id with different input fails deterministically.
- In one database transaction, validate the expected revision, mutate the goal row, record the operation result, and enqueue the named-event publication in a durable outbox.
- The outbox dispatcher calls `emitNamedEvent` after commit and marks the publication complete. Startup/recovery drains unpublished entries.
- Goal revisions provide per-run event ordering and merge deduplication; SSE `id`/`Last-Event-ID` remains the transport cursor.
- Operation records remain available through the active-run retry window and configured post-archive retention; compaction is allowed only after all outbox rows are published/poisoned and the retention checkpoint makes replay/resurrection impossible.

The mutation CAS predicates are explicit:

- set/edit requires the current row to have the expected revision and either no goal or the requested `goalId`;
- pause/resume requires the expected revision, matching `goalId`, an active status, and the current lease generation;
- clear requires the expected revision and matching `goalId`, then writes a terminal tombstone in the same transaction;
- ACP plan/status updates require matching `goalId`, `acpSessionId`, and `leaseGeneration`, and may only advance the revision;
- every non-clear mutation rejects a row whose current status is `cleared`.

The mutation transaction is conceptually:

```text
BEGIN IMMEDIATE
  lock/read run_goals row for runId
  resolve or insert run_goal_operations(runId, operationId, fingerprint)
  if an existing operation has the same fingerprint, return its stored result
  if an existing operation has a different fingerprint, reject
  compare expected revision, goalId, status, and leaseGeneration
  allocate next revision
  mutate run_goals or write its clear tombstone
  insert run_goal_outbox with stable eventKey = runId/revision/eventKind
  store canonical result in run_goal_operations
COMMIT
```

No ACP call occurs while the database transaction is open. The ACP command is sent after the durable desired state exists, and its result is reconciled through a new fenced revision.

---

## Implementation tasks

### 1. Establish the shared contract and tests first

- [ ] Read `docs/architecture/lifecycle-observability-and-testing.md` before adding state transitions.
- [ ] Define the shared types and stable status/action ids in `shared/goal-plan.ts`.
- [ ] Define objective validation, including non-empty content and the selected maximum length.
- [ ] Add failing tests for snapshot validation, status transitions, plan replacement/removal, deterministic item ids, capability normalization, stale revisions, and duplicate operations.

Verification:

- `pnpm test -- tests/shared/goal-plan.test.ts tests/server/goal-control.test.ts`

### 2. Add durable run-level persistence

Add a `run_goals` table in `src/server/db/schema.ts` and `src/server/db/index.ts`.

Use one current row per run with:

- `run_id` primary key and foreign key to `runs`
- `goal_id`
- `objective`
- `status`
- `revision`
- `plan_json`
- `plan_source`
- `worker_id`
- `acp_session_id`
- `capabilities_json`
- `validation_state_json`
- `last_error`
- `started_at`
- `paused_at`
- `resumed_at`
- `completed_at`
- `cleared_at`
- `updated_at`

Use JSON for the current plan because ACP plan updates replace the complete list atomically. Existing `plans` and `plan_items` remain the source for file-backed Omni planning artifacts.

Add two small control-plane tables alongside `run_goals`:

- `run_goal_operations`, uniquely keyed by `(run_id, operation_id)`, storing the request fingerprint and canonical result for idempotent retries;
- `run_goal_outbox`, storing the run id, goal id, revision, stable event key, event kind, payload, claim token, claim expiry, attempt count, last error, and publication status for crash-safe named-event delivery.

Outbox delivery is at-least-once and must be safe under multiple OmniHarness processes:

- Claim one eligible row in a short SQLite transaction using an owner token and lease expiry.
- Publish rows in per-run revision order; do not publish a later revision while an earlier eligible row for that run is pending.
- Retry transient failures with bounded exponential backoff.
- Mark permanently failing rows as `poisoned`, emit a surfaced error with a stable outbox code, and retain the durable goal state for explicit recovery.
- A poisoned row blocks later revisions for that run until an explicit recovery action resolves or supersedes it; skipping it is never silent.
- Mark successful publication with the stable event key. A crash after `emitNamedEvent` but before marking published may duplicate delivery, so named-event consumers and client merges deduplicate by event key/revision.
- Outbox completion, retry, and recovery updates must match `runId + goalId + leaseGeneration + revision + claimToken`; stale claims cannot mark a row published.
- Retain operation and outbox history through the configured run-retention period and delete it with the run; idempotency must not expire during an active run.
- Drain pending rows during startup/recovery and expose that decision through named events.

The outbox uses the existing named-event ring/SSE path; it is not a second worker conversation stream.

Requirements:

- Existing runs without a goal remain valid.
- Adding or updating a goal is transactional with its revision.
- Clear leaves a tombstone sufficient to prevent stale cache resurrection.
- Run deletion cleans up the associated goal row.
- Run deletion cleans up operations and outbox rows for the goal.
- Fresh and existing databases initialize safely.
- No destructive migration or data rewrite is required.

Roll out the schema additively:

1. Expand with nullable/defaulted goal, operation, and outbox columns/tables.
2. Backfill only safe absent-goal defaults for existing runs.
3. Validate constraints and indexes with the production SQLite/libsql engine.
4. Enable writers after schema readiness is confirmed.
5. Contract only through the existing safe database-maintenance path; do not remove legacy fields during this feature.

Older workers and clients must ignore unknown goal fields and unknown lifecycle events without mutating state. New readers must tolerate legacy runs with no goal row. A rollback stops new goal writes, leaves existing durable rows readable, and drains or explicitly surfaces pending outbox rows.

Verification:

- Fresh database initialization test.
- Existing database initialization test.
- One-goal-per-run and revision tests.
- Clear/tombstone test.
- Run deletion/foreign-key cleanup test.
- Unique operation-id and input-fingerprint constraint tests.
- Crash/restart recovery test for an outbox row committed before publication.
- Competing outbox drainer test.
- Duplicate publish-after-ack test.
- Poison-event/recovery test.
- Schema initialization compatibility test for all three new tables.
- Expand/backfill/validate/rollback compatibility tests.
- Legacy-run and mixed-version reader/writer tests.

### 3. Normalize ACP goal and plan updates

Create `src/server/agent-runtime/acp/goal-state.ts`.

Implement:

- `_meta.goal` capability parsing during initialization.
- `session_info_update._meta.goal` parsing.
- Provider status normalization.
- `plan` normalization.
- `plan_update` normalization for `items`, `markdown`, and `uri` forms.
- `plan_removed` handling.

Modify `src/server/agent-runtime/acp/session-updates.ts` so one ACP update can produce both:

1. the existing raw worker output entry; and
2. an authoritative control-plane goal/plan update.

Do not append the control-plane snapshot as a second worker conversation stream.

Plan rules:

- Structured plan updates replace the current plan atomically.
- Markdown plans render as read-only expanded content.
- URI plans become a safe artifact/reference link.
- Provider item ids are preferred.
- Items without ids use deterministic revision/content identity rather than an unstable array index.
- Validate versioned ACP payloads before they can mutate canonical state.
- Bound objective, item count, item length, markdown length, and URI length according to the shared schema.
- Ignore unknown metadata fields safely, reject invalid required fields with a named diagnostic event, and preserve the raw update only through the existing worker stream/diagnostic path.
- Bound nesting depth, collection size, and string/byte size in addition to item-count limits.
- Version the accepted ACP payload schema and define safe downgrade behavior for unsupported versions.

Verification:

- Native goal metadata fixtures.
- Structured plan fixture.
- Markdown plan fixture.
- URI plan fixture.
- Plan removal fixture.
- Malformed metadata fixture.
- Unknown-field and size-limit fixtures.
- Invalid required-field fixture proving canonical state is unchanged.
- Unsupported-version and nested/byte-size limit fixtures.

### 4. Implement the durable goal state machine

Create `src/server/runs/goal-control.ts`.

The service owns:

- create/set goal
- edit objective
- pause
- resume
- clear
- provider/session reconciliation
- validation before completion
- persistence
- revision checks
- operation idempotency

Rules:

- The run-level goal is the desired durable state.
- The ACP worker goal is a session-level lease.
- Adapter completion does not automatically complete the Omni goal.
- A stale revision returns the latest canonical snapshot with a conflict response.
- Duplicate operation ids return the original result.
- Unsupported actions become visible limited/error state rather than silent no-ops.
- Invalid transitions fail without mutating the goal row or advancing the revision.
- Every state transition records its source (`api`, `acp`, `reconciliation`, or `recovery`) and lease generation.
- Reuse of an operation id with a different input fingerprint fails without mutation.

Cover these transitions:

- absent → pending
- pending → pursuing
- pursuing → paused
- paused → pursuing
- pursuing → blocked
- pursuing → limited
- pursuing → validating
- validating → completed
- any active state → cleared
- any active state → error
- error → pursuing only through explicit retry/reconciliation

Verification:

- State-machine transition tests.
- Persistence rollback tests.
- Revision conflict tests.
- Idempotency tests.
- Validation-before-completion tests.
- Invalid-transition no-mutation tests.
- Clear-versus-update and simultaneous-action race tests.
- Stale lease-generation rejection tests.
- DB-backed compare-and-swap/concurrency tests using the production SQLite/libsql engine.
- Operation-id concurrent-insert and retention tests.

### 5. Integrate ACP controls and worker reconciliation

Modify `src/server/agent-runtime/manager.ts` and `src/server/agent-runtime/acp/runtime-client.ts`.

Control selection:

1. Use `_session/goal` when advertised.
2. Use only actions advertised by the adapter.
3. Use slash fallback only when the extension is absent and `available_commands_update` explicitly advertises the relevant command.
4. Never send both extension and slash-command controls for one operation.
5. Persist which method was selected.

Reconciliation:

- On worker attach, apply the durable goal if the session lacks it.
- On reattach/recreate, reapply once per worker-session/revision pair.
- If adapter metadata is older or conflicting, emit a reconciliation event and resolve against the durable goal.
- If the worker rejects the goal, surface a stable error and leave the run visibly limited/error.
- Fence every adapter update by `goalId`, `revision`, `acpSessionId`, and `leaseGeneration`; stale workers cannot mutate current state.
- Reconciliation is retry-safe: the same worker/session/revision fence may be applied repeatedly without duplicate commands or revision churn.
- Failover always reapplies the latest durable goal to the replacement lease before accepting provider updates.
- Claude-style adapters may expose set/clear without pause/resume.
- Codex-style adapters may expose pause/resume.

Verification:

- Native extension path.
- Slash fallback path.
- No fallback when the command is not advertised.
- No duplicate set/clear.
- Unsupported pause/resume.
- Attach/reattach/recreate.
- Stale adapter metadata.
- Transport failure.
- Reconciliation failure.
- Stale worker update after failover.
- Duplicate reconciliation attempt.
- Worker update after clear.

### 6. Add named lifecycle events and snapshots

Modify `src/server/events/named-events.ts` and `src/server/events/persisted-snapshot.ts`.

Add typed events for:

- goal set started/completed/refused/failed
- goal updated
- action started/completed/refused/failed
- paused/resumed/cleared
- plan updated/removed
- validation started/completed/failed
- blocked/limited/completed
- reconciliation and worker/session transfer
- resync required

Add stable surfaced error codes for invalid objectives, revision conflicts, unsupported actions, ACP transport failure, reconciliation failure, validation failure, and persistence failure.

Snapshot requirements:

- Include the current goal snapshot in bootstrap.
- Include goal completeness/provenance metadata.
- Preserve event cursor/anchor.
- Capture the goal revision and SSE anchor from one consistent snapshot read.
- Prevent older revisions from overwriting newer revisions.
- Prevent incomplete cache snapshots from erasing complete server state.
- Use `GET /api/events?snapshot=1` for resync recovery.
- Bootstrap and replay overlap is deduplicated by `(runId, revision)` and the SSE cursor; a snapshot anchor is inclusive/exclusive by one documented rule.
- Truncated replay or a detected cursor gap emits `stream.resync_required` and does not apply partial goal updates.
- Raw worker plan entries never independently mutate the canonical goal snapshot.
- Live events received during bootstrap are buffered; the client applies the snapshot at its anchor and then applies only events newer than that anchor.
- A replay gap, truncated ring history, or ambiguous cursor boundary discards the partial merge and requests a fresh snapshot.
- Duplicate or stale events are ignored by stable event key/revision; missing or unknown-version events are observable and trigger resync when they affect the goal snapshot.

Verification:

- Named event type tests.
- Event log assertions for every decision/refusal/failure path.
- Snapshot merge ordering tests.
- Last-Event-ID replay/resync tests.
- Bootstrap/live-event overlap ordering tests.

### 7. Add scriptable goal APIs

Create `src/runtime/http/routes/goals.ts` and register it in `src/runtime/http/routes/index.ts`.

Recommended routes:

- `GET /api/runs/:id/goal`
- `PUT /api/runs/:id/goal`
- `POST /api/runs/:id/goal/actions`

`PUT` creates or edits the objective. The action endpoint handles pause, resume, and clear.

Every mutation accepts `goalId`, `expectedRevision`, and `operationId`.

Responses must:

- return the canonical `GoalSnapshot`;
- return HTTP 409 with the newest snapshot for stale revisions;
- return detailed provider/ACP errors;
- never mask failures behind a generic message;
- return the prior canonical operation result for an idempotent retry;
- reject operation-id reuse with a different fingerprint;
- return a typed conflict for invalid transitions and stale lease/session fences;
- enforce per-run authorization and tenant isolation before revealing whether a goal exists;
- enforce applicable CSRF/same-origin, payload-size, and rate-limit rules.

Modify `src/runtime-api/types.ts` and `src/runtime-api/domains/index.ts` to expose typed renderer methods.

Verification:

- Authentication.
- Missing run/goal.
- Invalid objective.
- Stale revision.
- Duplicate operation.
- Unsupported action.
- Successful set/edit/pause/resume/clear.
- Provider error propagation.
- Per-run authorization and tenant-isolation checks.
- CSRF/same-origin behavior where the runtime surface requires it.
- Payload/rate-limit behavior and non-leaking unauthorized/conflict responses.
- Ownership-change-during-request race.
- Guessed run-id and cross-principal operation-id reuse.
- Sensitive-data redaction in errors and named events.

### 8. Add client state ownership

Extend `EventStreamStateManager` with canonical goal snapshots keyed by run id.

Create `src/interface/home/GoalPlanManager.ts` for presentation/action state only:

- expanded/collapsed state
- edit mode
- edit draft
- pending operation
- operation id
- display clock
- focus restoration intent
- action error state

Do not duplicate the canonical server snapshot in this manager.

Manager invariants:

- Server snapshot is the only goal truth.
- Optimistic UI can show pending state but cannot invent success.
- Action completion is accepted only for the matching operation or a newer server revision.
- Reconnect clears unconfirmed optimistic state.
- Switching runs resets presentation state without deleting server state.
- Timer updates affect display only and never cause persistence/network work.
- `EventStreamStateManager` owns canonical transport snapshots, revisions, ordering, cache provenance, and resync.
- `GoalPlanManager` owns only ephemeral expansion, edit draft, pending action, focus, and display-clock state.
- `PlanProgress` consumes the canonical normalized plan through props and owns no mutable plan copy.

Verification:

- Selected-run switching.
- Cache-to-server hydration.
- Stale snapshot rejection.
- Event replay merge.
- Action pending/success/failure.
- Duplicate click suppression.
- Focus restoration.
- One shared timer subscription.
- Reconnect during snapshot bootstrap.
- Snapshot/replay overlap deduplication.
- Partial replay/resync-required behavior.
- Bootstrap/live-event overlap ordering.

### 9. Build the composer card

Create `src/components/home/GoalPlanCard.tsx` using existing shadcn/ui primitives such as `Button`, `Tooltip`, `Popover`/`Dialog`, and theme tokens. This is an embedded composer accessory, not a new screen-level block.

Modify `src/components/home/ConversationComposer.tsx` and `src/interface/home/ComposerContainer.tsx`.

Collapsed layout:

- Same width as the composer.
- Dark elevated background in night mode.
- Rounded border.
- Pursuit icon on the left.
- Bright status label.
- Muted single-line ellipsized objective.
- Elapsed time.
- Edit button.
- Pause/resume button when supported.
- Clear button.
- Chevron button.

All card controls must use `type="button"` and must not submit the composer.

Expanded layout:

- Grow upward above the input.
- Show plan progress count.
- Show checklist items.
- Show active, blocked, failed, and completed item states.
- Show markdown plans read-only.
- Show an empty-plan state.
- Link to the full planning artifact when one exists.

Interaction requirements:

- Edit preserves focus correctly.
- Cancel restores the previous objective.
- Save validates and submits through the goal API.
- Pause/resume is distinct from stopping the run.
- Clear is not run deletion.
- Failed actions remain visible and retryable.
- Mention picker and queued-message drawer keep correct layering.
- Live updates do not steal composer focus.
- Status changes may use polite live announcements, but the timer must not announce every second.

Responsive behavior:

- Desktop keeps controls visible when space permits.
- Mobile wraps the objective.
- Lower-priority controls move into an overflow menu.
- Edit and clear remain discoverable.
- Keyboard navigation and visible focus work at every width.

Verification:

- Component interaction tests.
- Keyboard/focus tests.
- Responsive layout checks.
- Action failure rendering.
- Layering checks with mention picker and queued messages.
- Accessibility checks for keyboard actions, focus restoration, status announcements, and unsupported controls.

### 10. Refactor existing plan UI safely

Review `src/components/PlanProgress.tsx`.

Either reuse it in the expanded card after adapting it to `GoalPlanItem`, or extract shared plan-item rendering so both surfaces consume the shared model.

Do not maintain separate plan item types or status mappings.

Move all existing hardcoded `PlanProgress` strings into every locale file.

Keep `PlanningArtifactsPanel` separate in purpose: it remains the file-backed plan/review/promote workflow.

### 11. Add localization and accessibility

Add keys to `shared/locales/en.json` and every other locale for:

- status labels
- action labels
- action titles/tooltips
- edit labels
- validation errors
- clear confirmation
- empty-plan text
- unsupported-action explanations
- plan progress summaries
- checklist status labels
- elapsed-time labels
- screen-reader descriptions

`GoalPlanCard` must call `useI18nSnapshot()` and render all visible text through `t()`.

Accessibility requirements:

- Icon-only controls have translated `aria-label` and `title`.
- Status is not communicated by color alone.
- Focus rings are visible.
- Expanded state uses `aria-expanded`.
- Checklist uses a semantic list.
- Error/terminal states are readable without animation.
- Dynamic updates do not spam screen readers with timer ticks.

### 12. Add deterministic lifecycle coverage

Add lifecycle scenarios under `tests/lifecycle/scenarios/` for:

- set and display
- plan replacement
- pause/resume
- clear/tombstone
- reconnect/resync
- worker reattach
- worker failover
- unsupported controls
- stale revisions
- provider failures
- simultaneous actions
- clear-versus-update
- stale worker lease
- crash between goal commit and named-event publication
- bootstrap/replay overlap
- truncated replay and resync
- approval denial/unsupported capability
- database migration/rollback compatibility
- mixed-version producer/consumer behavior
- transaction serialization/deadlock behavior
- outbox duplicate delivery and competing drainers
- operation-record retention
- authorization races and sensitive-data redaction
- fault boundaries at transaction, claim, ACP-call, and acknowledgement stages

Drive scenarios through HTTP/SSE and assert:

- API responses
- named events
- persisted snapshot
- selected-run snapshot
- final visible state
- absence of stale-state regression

Run them with the existing lifecycle runner and clean up only test conversations/artifacts created by verification.

### 13. Propose an approval-gated UI journey test

Do not run this without explicit user approval.

Candidate mission:

1. Open a running conversation with an active goal.
2. Verify the compact card appears immediately above the input.
3. Verify objective truncation, elapsed time, and controls.
4. Expand the card.
5. Confirm checklist items and progress.
6. Edit the objective.
7. Pause/resume where supported.
8. Clear the goal.
9. Reload or reconnect.
10. Confirm the cleared goal does not resurrect.

Visible proof:

- collapsed-state screenshot;
- expanded-checklist screenshot;
- paused/error-state screenshot where supported;
- input remains usable and focusable;
- transcript does not gain a duplicate synthetic goal message.

### 14. Verification and handoff

Run:

- focused shared goal tests;
- database schema tests;
- ACP normalization tests;
- goal-control state-machine tests;
- API route tests;
- event-stream merge/replay tests;
- Manager tests;
- i18n tests;
- relevant architecture/typecheck tests;
- `pnpm test:lifecycle`;
- relevant existing UI/e2e checks.

Before claiming completion, verify:

- screenshot-level visual hierarchy;
- no layout jump when the card appears;
- no lost composer focus;
- no stale plan overwrite;
- no unsupported pause/resume control;
- no duplicate transcript persistence;
- no goal resurrection after clear;
- correct mobile behavior;
- complete localization coverage;
- named event evidence for every server decision.
- outbox recovery and publication evidence after restart;
- no stale lease can mutate or revive a cleared goal;
- operation-id reuse with different input is rejected;
- concurrent mutations have deterministic revision/conflict results;
- migrations preserve legacy runs and safely initialize missing goal state;
- mixed-version readers ignore unknown goal fields without bypassing validation;
- API authorization prevents cross-run or cross-tenant goal access.
- fault simulation is confined to test infrastructure/dependency fakes; no production fault-injection switch or server chaos path is added.

---

## Acceptance criteria

- A goal created through the API or `/goal` flow appears above the selected run's composer without becoming a transcript message.
- The collapsed card matches the reference hierarchy and remains stable while the input receives focus.
- The expanded view shows the authoritative current checklist after plan replacement/removal.
- Edit, pause/resume, and clear update the real ACP-backed goal, are capability-aware, idempotent, and survive reconnect/reattach.
- Refresh, SSE reconnect, Last-Event-ID replay, snapshot bootstrap, restart, and worker failover do not lose or regress the goal.
- Stale cached snapshots and stale action responses cannot overwrite newer revisions.
- All statuses, errors, controls, tooltips, and aria labels are localized and accessible.
- Unsupported actions are not presented as working controls.
- Named event logs prove server decisions, refusals, failures, recoveries, and terminal states.
- Deterministic tests cover transitions, ordering, replay/resync, stale races, persistence, and bounded timer/render behavior.
- Concurrent actions, stale leases, durable outbox recovery, operation-id fingerprinting, migration compatibility, and snapshot/replay overlap are explicitly covered.
- No parallel worker-conversation persistence layer or fake/mock final behavior is introduced.
