# Recoverable Run State Machine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make lost OmniHarness worker/session states detectable, visible, automatically recoverable when safe, and manually resumable when automation cannot proceed.

**Architecture:** Add a backend-owned recovery reconciler that compares persisted run/worker state with live bridge agents, records durable recovery incidents, and drives resume/rerun behavior. Keep the UI as a visibility and override layer: it displays recovery state and exposes explicit rescue actions, but does not decide whether a run is dead.

**Tech Stack:** Next.js App Router API handlers, TypeScript, Drizzle SQLite schema, existing bridge client, existing SSE event stream, React with Manager-owned state, shadcn/ui primitives, pnpm/vitest test workflow.

**North Star Product:** OmniHarness should behave like a durable agent control plane: if a worker disappears, the system diagnoses the mismatch, preserves user intent and queued input, applies a configurable recovery policy, attempts safe recovery, and explains exactly what happened before, during, and after recovery.

**Complete Product Shape:** Recovery is a first-class subsystem with durable incidents, explicit run/worker recovery states, backend-owned reconciliation, policy-driven automatic recovery, user-visible incident inspection, retry budgets/backoff, queue preservation/replay, scriptable inspection, and deterministic tests for every recovery route. The final checklist below is the definition of complete.

**Implementation Sequence:** Build the narrow lost-worker path first because it is the failing case in front of us, then complete the policy, inspection, controls, and verification layers in the same plan. Sequencing is execution order, not scope reduction.

**Final Functionality Standard:** The plan is complete only when the full recovery system works end-to-end with real persisted runs, real bridge-agent comparisons, real queued message preservation/replay, durable recovery incidents, configurable auto-recovery policy, retry budgets/backoff, incident inspection UI, API/scriptable manual controls, and deterministic tests. No fake recovery banners, canned statuses, UI-only heuristics, or “detect but do not rescue” paths count as completion.

---

## File Map

### Files To Create

- `src/server/runs/recovery-state.ts`
  - Owns recovery classification types and pure detection helpers.
  - Classifies runs as `healthy`, `recovering`, `lost_worker_resumable`, `lost_worker_rerunnable`, `needs_recovery`, or `unrecoverable`.

- `src/server/runs/recovery-incidents.ts`
  - Owns durable recovery incident persistence using a new table.
  - Provides `openRecoveryIncident`, `markRecoveryIncidentRecovering`, `markRecoveryIncidentResolved`, and `markRecoveryIncidentFailed`.

- `src/server/runs/recovery-reconciler.ts`
  - Orchestrates detection, incident creation, auto-recovery attempts, queue handling, and event emission.
  - Used by SSE sync, queue delivery, resume endpoints, and future CLI/control-plane entry points.

- `src/server/runs/recovery-actions.ts`
  - Contains explicit server actions for `resume`, `restart_from_checkpoint`, and `acknowledge_needs_recovery`.
  - Keeps `src/server/runs/recovery.ts` from absorbing more responsibilities.

- `src/server/runs/recovery-policy.ts`
  - Owns recovery policy resolution, retry budgets, backoff, worker-type policy hooks, and safety decisions.
  - Reads persisted settings and produces an explicit `RecoveryPolicyDecision`.

- `src/server/runs/recovery-control-plane.ts`
  - Provides scriptable inspection and administration helpers for recovery incidents.
  - Used by existing API/CLI surfaces instead of adding disconnected one-off logic.

- `src/app/home/recovery-utils.ts`
  - Owns frontend display mapping for recovery state labels, tones, recommended actions, and compact descriptions.
  - Keeps `src/app/home/utils.ts` from crossing the 1200-line threshold.

- `src/app/home/useRunRecoveryState.ts`
  - Owns HomeApp-facing recovery derivation and action wiring so recovery logic stays out of oversized `HomeApp.tsx`.
  - Components subscribe to state and call Manager/API methods; they do not own recovery truth.

- `src/components/home/RunRecoveryNotice.tsx`
  - Displays the selected run’s current recovery state and recommended action.

- `src/components/home/RecoveryIncidentInspector.tsx`
  - Displays the selected run’s open and recent recovery incidents, attempts, errors, policy decisions, queue impact, and resolved outcome.

- `tests/server/runs/recovery-state.test.ts`
  - Pure classifier tests for persisted/live state combinations.

- `tests/server/runs/recovery-reconciler.test.ts`
  - Database-backed recovery tests for lost workers, saved-session resume, no-session rerun, and queued-message preservation.

- `tests/server/runs/recovery-policy.test.ts`
  - Policy, retry budget, backoff, and worker-type decision tests.

- `tests/server/runs/recovery-control-plane.test.ts`
  - Scriptable inspection/admin helper tests.

- `tests/api/run-recovery-route.test.ts`
  - API-level tests for manual resume/recover actions and returned recovery state.

- `tests/ui/run-recovery-state.test.tsx`
  - Focused UI tests for recovery banners/actions.

- `tests/ui/recovery-incident-inspector.test.tsx`
  - Focused UI tests for incident inspection and recovery history.

### Files To Modify

- `src/server/db/schema.ts`
  - Add `recoveryIncidents` table.
  - Do not remove existing status fields. Preserve current data compatibility.

- Migration or schema bootstrap location used by this repo
  - Add the SQLite table creation path for `recovery_incidents`.
  - If no explicit migrations exist, update the existing bootstrap/schema sync path consistently with current project conventions.

- `src/server/conversations/sync.ts`
  - Replace implementation-run skip behavior with recovery reconciliation.
  - When persisted implementation workers are active but absent from live agents, call the reconciler instead of leaving the run stale.

- `src/server/conversations/queued-messages.ts`
  - Treat `Agent not found` during queued delivery as a recovery signal.
  - Keep queued user intent recoverable instead of burying it as a dead failed queue item.

- `src/server/supervisor/observer.ts`
  - Reuse incident persistence for `worker_session_missing` and `worker_resume_failed`.
  - Keep observer resume behavior, but route terminal recovery outcomes through the shared state model.

- `src/server/supervisor/resume.ts`
  - Delegate to `recovery-actions` or `recovery-reconciler` so `/resume` means “resume or safely restart if needed,” not only “flip run.status to running.”

- `src/server/runs/recovery.ts`
  - Keep existing checkpoint retry/edit/fork behavior.
  - Expose a clean helper for implementation checkpoint restart so the reconciler can call it without duplicating rerun logic.

- `src/app/api/events/route.ts`
  - Include compact open/recent recovery incidents and derived `recoveryState` for the selected run.
  - Keep payload small and typed.

- `src/app/api/runs/[id]/resume/route.ts`
  - Return recovery action outcome, including whether it resumed a session, restarted from checkpoint, or now needs user intervention.

- `src/app/api/runs/[id]/route.ts`
  - Keep legacy recovery POST actions working.
  - Prefer calling shared recovery actions for implementation retry/resume semantics.

- `src/app/home/types.ts`
  - Add `RecoveryIncidentRecord` and `RunRecoveryState` client types.

- `src/app/home/utils.ts`
  - Do not add substantial recovery logic here. Move recovery display helpers to `src/app/home/recovery-utils.ts`.

- `src/app/home/HomeApp.tsx`
  - Avoid adding significant new logic because it is already 1767 lines.
  - Wire returned recovery state into existing Manager/state flow with the smallest possible changes.
  - If more than a small integration patch is needed, extract recovery-derived state into `src/app/home/useRunRecoveryState.ts`.

- `src/components/home/ConversationMain.tsx`
  - Add a recovery banner/action slot or delegate to a new component.

- `src/components/home/RunRecoveryNotice.tsx`
  - Displays “Recovering worker,” “Worker disconnected,” “Needs recovery,” “Recovery exhausted,” and action buttons.

- `src/components/home/RecoveryIncidentInspector.tsx`
  - Shows recovery history, attempt count, policy decision, last error, queued-message impact, and resolved outcome.

- `src/components/settings/RuntimeSettingsPanel.tsx` or the existing settings surface that owns runtime preferences
  - Add user-facing auto-recovery controls if runtime settings are the existing home for operational preferences.
  - Persist settings through the existing settings manager/API, not `.env`.

- `src/lib/run-recovery-state.ts`
  - Extend optimistic UI update behavior only where it aligns with backend-confirmed recovery actions.
  - Avoid frontend-only lost-worker heuristics.

- `src/lib/conversation-workers.ts`
  - Add `lost` and `recovering` worker statuses to display grouping rules deliberately.

- Existing CLI/control-plane entry point (`omni-cli.ts` or related command dispatcher)
  - Add recovery inspection/resume commands through `recovery-control-plane.ts`.
  - Scriptability is required; if the CLI dispatcher needs a small extension point, add it as part of this plan instead of leaving recovery UI-only.

### Tests To Update Or Add

- `tests/supervisor/observer.test.ts`
  - Update expectations around missing sessions to include recovery incidents/events.

- `tests/api/conversation-messages-route.test.ts`
  - Add queued-message missing-agent recovery assertions.

- `tests/ui/conversation-actions.test.ts`
  - Add manual recovery action visibility and disabled/loading behavior.

- Existing settings tests
  - Add persisted auto-recovery setting coverage.

- Existing CLI/control-plane tests, if a natural command surface exists
  - Add recovery incident inspection and manual resume coverage.

### Candidate Agentic User Journey Tests

Running these requires explicit user approval after deterministic tests pass:

- **Mission:** Start from a stale implementation run with a missing bridge worker and a failed queued steer; confirm the UI shows recovery and can resume.
  - **Entry point:** Existing local app on the selected stale run.
  - **Expected proof:** Recovery notice appears, action restarts work, queued message remains visible or is replayed, run log records the recovery.

- **Mission:** Simulate bridge restart while a run is active; confirm automatic recovery begins without user clicking anything.
  - **Entry point:** Local app plus controlled bridge/runtime restart.
  - **Expected proof:** Run enters `recovering`, then returns to `running` or `needs_recovery` with a clear reason.

- **Mission:** Open a recovered run after completion and inspect what happened.
  - **Entry point:** Selected recovered conversation in the app.
  - **Expected proof:** Incident inspector shows detection, policy decision, attempt count, queued-message handling, and final resolved/failed state.

### Real Integrations And Data Paths

- SQLite tables: `runs`, `workers`, `messages`, `execution_events`, `queued_conversation_messages`, `settings`, new `recovery_incidents`.
- Runtime source of truth: bridge `/agents` list, `getAgent`, `spawnAgent`, and `askAgent`.
- Supervisor paths: `startSupervisorRun`, observer polling, wake leases.
- User intent paths: latest persisted user checkpoint and queued messages.
- UI data path: SSE `/api/events` payload into HomeApp state, recovery utilities/hook, conversation components, and incident inspector.
- Settings path: existing settings APIs/managers store auto-recovery policy, budgets, and backoff preferences.

### `.gitignore` Coverage

Current `.gitignore` covers local DBs, journals, env files, logs, dependency directories, build outputs, coverage, `.next`, and app-local auth/runtime data. No changes required unless new recovery diagnostics write new local artifacts; this plan should persist diagnostics in SQLite/events, not temp files.

### File Growth Constraints

- `src/app/home/HomeApp.tsx` is already over 1200 lines. Do not add more recovery business logic there; use `useRunRecoveryState.ts` for recovery derivation and action wiring.
- `src/app/home/utils.ts` is 1070 lines. Prefer `src/app/home/recovery-utils.ts` for new display helpers.
- `src/server/supervisor/observer.ts` is 910 lines. Keep shared recovery logic in new server modules.
- `src/server/conversations/queued-messages.ts` is 562 lines. Add only signal handoff and preserve delivery flow readability.

---

## State Model

### Run Statuses

Current code should continue accepting existing statuses. Add these statuses deliberately:

- `recovering`: backend is actively trying to restore progress.
- `needs_recovery`: automatic recovery cannot continue safely, but user action can.

Keep `failed` for non-recoverable or exhausted failures: invalid state, missing credentials with no valid worker option, repeated recovery budget exhaustion, corrupted persisted data, or bridge/runtime failures that prevent any recovery attempt.

### Worker Statuses

Add:

- `lost`: persisted active worker has no matching live bridge agent and could not be resumed immediately.
- `recovering`: worker/session is being resumed or replaced.

Existing active status helpers must be audited so `lost` does not render as active work.

### Recovery Incidents

New durable table:

```ts
recovery_incidents:
  id text primary key
  run_id text not null
  worker_id text null
  queued_message_id text null
  kind text not null
  status text not null
  auto_attempt_count integer not null default 0
  last_error text null
  details text null
  detected_at integer not null
  updated_at integer not null
  resolved_at integer null
```

Supported `kind` values for the complete plan:

- `worker_lost`
- `session_missing`
- `queue_blocked`
- `stale_running`

Supported `status` values:

- `open`
- `recovering`
- `resolved`
- `needs_user`
- `failed`

Use one open incident per `(runId, workerId, kind)` where possible to avoid duplicate noise during SSE polling.

### Recovery Policy

Add a persisted, explicit policy model. Defaults should be conservative but useful:

```ts
recovery_policy:
  autoRecoverImplementationRuns: true
  autoRecoverDirectRuns: false
  maxAutoAttemptsPerIncident: 3
  baseBackoffMs: 5_000
  maxBackoffMs: 60_000
  sessionResumeFirst: true
  restartFromCheckpointWhenSessionMissing: true
  preserveQueuedMessages: true
```

Store these as normal application settings through the existing settings persistence layer. Do not put UI strings or runtime policy in `.env`.

Policy decisions must be logged into incident details so the user can understand why the system resumed, restarted, waited, or asked for help.

### Recovery Outcomes

Every incident must end in one of these visible outcomes:

- `resolved`: recovery restored progress or correctly determined no action was needed.
- `needs_user`: recovery is possible, but needs a user choice such as resume, edit, fork, credential repair, or worker selection.
- `failed`: the recovery path was exhausted or the persisted state cannot be safely repaired.

No incident should remain `open` or `recovering` indefinitely without a budget/backoff reason and next scheduled action.

---

## Final Ideal Behavior

The complete system should behave this way:

1. A reconciler continuously compares persisted active work with live bridge workers during SSE sync, supervisor observation, queued message delivery, and manual resume.
2. When persisted state and live runtime disagree, the reconciler opens one durable incident with a clear kind and reason.
3. The policy engine decides whether to resume, restart from checkpoint, wait/back off, or ask the user.
4. If a saved bridge session exists, the system tries session resume first.
5. If no saved session exists and the run is an implementation run, the system restarts the supervisor from the latest persisted user checkpoint.
6. Queued messages are preserved and replayed in order after recovery, unless the user explicitly performs a destructive edit/retry from an earlier checkpoint.
7. Retry budgets prevent recovery loops; exhausted incidents become `needs_user` or `failed` with the exact reason.
8. The UI shows current recovery status, automatic action progress, manual controls, and a recovery incident history.
9. API/scriptable surfaces can inspect incidents and trigger the same backend recovery actions used by the UI.
10. Completed recovery remains auditable in the run log and incident inspector.

---

## Implementation Tasks

- [ ] **1. Add recovery incident persistence and pure classifier tests first**
  - Create `src/server/runs/recovery-state.ts`.
  - Create `src/server/runs/recovery-incidents.ts`.
  - Update `src/server/db/schema.ts` with `recoveryIncidents`.
  - Add/adjust schema bootstrap/migration.
  - Add `tests/server/runs/recovery-state.test.ts`.
  - Classifier scenarios:
    - running implementation run + active worker + live agent -> `healthy`
    - running implementation run + active worker + no live agent + `bridgeSessionId` -> `lost_worker_resumable`
    - running implementation run + active worker + no live agent + no `bridgeSessionId` + latest user checkpoint -> `lost_worker_rerunnable`
    - direct run with missing worker -> `needs_recovery`
    - terminal run -> `healthy`
  - Verification:
    - `pnpm test tests/server/runs/recovery-state.test.ts`

- [ ] **2. Implement backend recovery reconciler**
  - Create `src/server/runs/recovery-reconciler.ts`.
  - Inputs: run, workers, live agents, latest user checkpoint, queued messages, options.
  - Outputs: `RecoveryReconcileResult` with action taken and compact UI state.
  - For `lost_worker_resumable`:
    - mark incident `recovering`
    - update worker `recovering`
    - call `spawnAgent({ resumeSessionId })`
    - update worker from returned snapshot
    - mark run `running`
    - mark incident `resolved`
    - insert `worker_session_resumed`
  - For `lost_worker_rerunnable` implementation runs:
    - mark incident `recovering`
    - update worker `lost`
    - update run `recovering`
    - restart from latest user checkpoint using shared implementation recovery action
    - preserve pending queued messages
    - mark incident resolved when restart begins successfully
  - If automatic action fails:
    - mark run `needs_recovery`
    - mark incident `needs_user` or `failed`
    - insert execution event with full error detail
  - Verification:
    - Add database-backed tests in `tests/server/runs/recovery-reconciler.test.ts`.

- [ ] **3. Implement recovery policy, retry budgets, and backoff**
  - Create `src/server/runs/recovery-policy.ts`.
  - Define typed defaults and persisted policy resolution.
  - Read persisted settings through the existing settings layer.
  - Track `autoAttemptCount`, last attempt time, and computed next attempt time on incidents or incident details.
  - Support worker-type hooks so future worker-specific recovery behavior has a real extension point.
  - Decisions:
    - `resume_session`
    - `restart_from_checkpoint`
    - `wait_for_backoff`
    - `needs_user`
    - `mark_failed`
  - Verification:
    - `pnpm test tests/server/runs/recovery-policy.test.ts`
    - Tests cover budgets, backoff caps, disabled automation, direct-vs-implementation policy, and session-first behavior.

- [ ] **4. Expose reusable implementation restart action**
  - Refactor `src/server/runs/recovery.ts` so implementation retry logic can be called by the reconciler without pretending a user clicked retry.
  - Keep public `recoverRun` API behavior unchanged.
  - Add `src/server/runs/recovery-actions.ts` as the shared implementation home for reusable restart/resume actions.
  - The restart action must:
    - clear supervisor wake lease
    - keep queued messages unless explicitly invalidated
    - set plan/run status correctly
    - call `startSupervisorRun`
    - emit events through caller or shared helper
  - Verification:
    - Existing recovery tests still pass.
    - New test proves no-session lost worker restarts from latest checkpoint.

- [ ] **5. Integrate detection into conversation sync**
  - Modify `src/server/conversations/sync.ts`.
  - In implementation-run handling, after checking live active workers, detect active persisted workers missing from `rawAgents`.
  - Call `reconcileRunRecovery`.
  - Do not skip stale implementation runs silently.
  - Preserve existing transient failure auto-resume behavior, but route connection/session cases through the new reconciler where possible.
  - Verification:
    - Test stale running implementation run becomes `recovering` or `needs_recovery`.
    - Test healthy active live implementation run remains unchanged.

- [ ] **6. Integrate queued-message missing-agent recovery**
  - Modify `src/server/conversations/queued-messages.ts`.
  - When `askAgent` fails with `Agent not found`:
    - insert `queued_message_worker_missing` or `queue_blocked` incident/event
    - for implementation runs, put the queued message back to `pending` or keep it blocked with clear `lastError` while recovery starts
    - call recovery reconciler
    - avoid marking the queued message permanently failed if recovery is available
  - For direct runs:
    - mark `needs_recovery` and keep a manual retry affordance instead of silent failure.
  - Verification:
    - `tests/api/conversation-messages-route.test.ts` covers `Agent not found` preserving user intent.

- [ ] **7. Make manual resume use the same recovery path**
  - Modify `src/server/supervisor/resume.ts`.
  - Modify `src/app/api/runs/[id]/resume/route.ts`.
  - Manual resume should:
    - classify current state
    - resume saved session if available
    - restart implementation supervisor from latest checkpoint if no session exists
    - return clear JSON outcome
  - Keep old behavior for ordinary paused/awaiting runs.
  - Verification:
    - `tests/api/run-recovery-route.test.ts` covers resumable, rerunnable, and needs-user outcomes.

- [ ] **8. Include recovery state in the SSE/event payload**
  - Modify `src/app/api/events/route.ts`.
  - Add compact selected-run recovery state:
    - `kind`
    - `status`
    - `workerId`
    - `queuedMessageId`
    - `message`
    - `recommendedAction`
    - `lastError`
    - `attemptCount`
    - `nextAttemptAt`
    - `policyDecision`
  - Include open and recent selected-run incidents in compact form to avoid payload bloat while keeping recovery auditable.
  - Verification:
    - API test against `snapshot=1`, plus event payload snapshot coverage where the repo already has that pattern.

- [ ] **9. Add frontend recovery notice without bloating HomeApp**
  - Add `src/components/home/RunRecoveryNotice.tsx`.
  - Add `src/app/home/recovery-utils.ts` if display mapping needs more than tiny helpers.
  - Modify `src/app/home/types.ts`.
  - Modify `src/app/home/HomeApp.tsx` only to pass recovery state and call resume/recover mutation.
  - Modify `src/components/home/ConversationMain.tsx` to render the notice near existing failure/recovery affordances.
  - Notice states:
    - `recovering`: “Recovering worker…” with spinner/passive status.
    - `lost_worker_rerunnable` / `needs_recovery`: “Worker disconnected” with “Resume from latest checkpoint.”
    - `queue_blocked`: “Queued message is waiting for worker recovery.”
    - `needs_user`: “Recovery needs your input” with the recommended action.
    - `failed`: “Recovery failed” with backend error details.
  - Use existing `Button`, `Badge`, and icon patterns. No new design system.
  - Verification:
    - UI tests for visible notice and action disabled state.

- [ ] **10. Add recovery incident inspector UI**
  - Create `src/components/home/RecoveryIncidentInspector.tsx`.
  - Show:
    - incident kind/status
    - detection time
    - worker id
    - queued message id/content preview when relevant
    - attempt count
    - policy decision
    - last error
    - resolved time/outcome
  - Render it near the run log or as a collapsible sibling to keep the main conversation readable.
  - Verification:
    - `pnpm test tests/ui/recovery-incident-inspector.test.tsx`

- [ ] **11. Add auto-recovery settings UI and persistence**
  - Use the existing settings storage/API/manager path.
  - Add settings for:
    - implementation auto-recovery enabled
    - direct-run auto-recovery enabled
    - max auto attempts per incident
    - base/max backoff
    - preserve queued messages
  - Put strings/settings in source, not `.env`.
  - Ensure settings load on app start and apply server-side without depending on React state.
  - Verification:
    - Existing settings tests plus focused recovery policy persistence tests.

- [ ] **12. Update worker grouping and recoverable-running heuristics**
  - Modify `src/lib/conversation-workers.ts`.
  - Ensure `lost` is not treated as active.
  - Ensure `recovering` displays as active/recovering where appropriate.
  - Modify `src/app/home/utils.ts` or new `recovery-utils.ts` so stale-running UI heuristics defer to backend `recoveryState` when available.
  - Verification:
    - Unit tests for grouping if existing tests cover worker utilities.

- [ ] **13. Preserve and replay queued user intent after recovery**
  - Ensure implementation recovery drains pending run-level queued messages after supervisor restart.
  - Ensure worker-targeted queue items are retargeted only when a replacement worker exists and belongs to the same run.
  - Avoid deleting queued messages in automatic lost-worker recovery unless the user explicitly retries from an earlier checkpoint that invalidates downstream state.
  - Verification:
    - Test the concrete shape from `54b0e6effa9c`: failed steer caused by missing worker becomes recoverable, user text is not lost, run can restart.

- [ ] **14. Add observability and scriptable control-plane affordances**
  - Persist execution events:
    - `recovery_incident_opened`
    - `recovery_auto_resume_started`
    - `recovery_auto_restart_started`
    - `recovery_backoff_scheduled`
    - `recovery_policy_decision`
    - `recovery_resolved`
    - `recovery_needs_user`
    - `recovery_exhausted`
    - `queued_message_recovery_blocked`
  - Add concise detail JSON with reason, worker id, queued message id, and action.
  - Create `src/server/runs/recovery-control-plane.ts`.
  - Add scriptable helper functions:
    - list incidents for a run
    - inspect current recovery state
    - trigger resume/reconcile
    - mark incident acknowledged only when terminal
  - Wire those helpers into the existing API and CLI/control-plane surfaces.
  - Verification:
    - Reconciler tests assert events are written.
    - `pnpm test tests/server/runs/recovery-control-plane.test.ts`

- [ ] **15. Add post-recovery timeline explanation**
  - In the incident inspector and run log, show the before/after chain:
    - persisted worker status before detection
    - live bridge absence/session id state
    - policy decision
    - recovery action
    - queue handling
    - final outcome
  - This is not a full visual diff; it is the minimal audit trail needed to understand what happened without opening SQLite.
  - Verification:
    - UI test confirms recovered incidents show a complete explanation.

- [ ] **16. Add recovery exhaustion and user-choice paths**
  - When retry budget is exhausted, transition to `needs_recovery` or `failed` based on whether user action can help.
  - User-choice actions:
    - resume/retry latest checkpoint
    - edit checkpoint and rerun where existing semantics allow
    - fork where existing semantics allow
    - cancel recovery and mark incident acknowledged
  - Verification:
    - API and UI tests cover exhausted auto-recovery and manual rescue.

- [ ] **17. Run focused and regression verification**
  - Deterministic tests:
    - `pnpm test tests/server/runs/recovery-state.test.ts`
    - `pnpm test tests/server/runs/recovery-policy.test.ts`
    - `pnpm test tests/server/runs/recovery-reconciler.test.ts`
    - `pnpm test tests/server/runs/recovery-control-plane.test.ts`
    - `pnpm test tests/api/run-recovery-route.test.ts`
    - `pnpm test tests/api/conversation-messages-route.test.ts`
    - `pnpm test tests/ui/run-recovery-state.test.tsx tests/ui/conversation-actions.test.ts`
    - `pnpm test tests/ui/recovery-incident-inspector.test.tsx`
  - Broader gate:
    - Use the repo’s established test/lint/typecheck command from `package.json`.
  - Manual DB spot-check:
    - Create or reuse a test fixture matching `54b0e6effa9c`.
    - Confirm `running + working + missing agent` does not remain stale after sync.

---

## User Stories Covered

- As a builder, when a worker disappears, I can see that the problem is runtime continuity, not my task failing.
- As a builder, if recovery is safe, the system attempts it automatically without requiring me to diagnose SQLite rows.
- As a builder, if automation cannot continue, I get a clear “Resume from latest checkpoint” action.
- As a builder, if I typed a queued steer while a worker was gone, that message is preserved and replayed or left visibly blocked.
- As a builder, I can inspect the run log and understand exactly what recovery attempted and why it stopped.
- As a builder, I can configure how aggressive automatic recovery should be without editing environment files.
- As a builder, I can inspect recovery incidents through the UI or scriptable control plane after the fact.
- As a builder, I am protected from infinite recovery loops by retry budgets and visible exhaustion states.

---

## Acceptance Criteria

- A run like `54b0e6effa9c` is classified as `lost_worker_rerunnable` or `needs_recovery`, not left indefinitely as plain `running`.
- Missing bridge agent states are detected by backend reconciliation, not frontend guessing.
- Automatic recovery attempts happen server-side and are durable/idempotent.
- Queued messages that fail with `Agent not found` remain recoverable and do not silently disappear.
- Manual resume uses the same backend recovery logic as automation.
- UI shows recovery state and a real resume action backed by API behavior.
- Recovery attempts write execution events and recovery incident records.
- Recovery policy settings are persisted, loaded, and enforced server-side.
- Retry budgets/backoff prevent loops and surface exhausted recovery clearly.
- Recovery incident inspector shows the complete detection, policy, action, queue, and outcome story.
- Scriptable inspection/manual recovery uses the same backend logic as the UI.
- Tests cover classifier, policy, reconciler, queued-message recovery, resume route, control-plane helpers, UI notice, settings, and incident inspector.

---

## Risks And Guardrails

- **Recovery loops:** Use incident `auto_attempt_count` and one open incident per worker/kind to avoid infinite restart cycles.
- **Duplicate supervisor starts:** Reuse wake leases and existing `startSupervisorRun` safeguards; tests should verify repeated reconciliation is idempotent.
- **Queue replay order:** Preserve creation order and avoid converting failed messages into new user messages until the recovery path explicitly drains them.
- **Status compatibility:** Add statuses without breaking older UI paths that only know `running`, `done`, and `failed`.
- **Oversized frontend files:** Do not add recovery business logic to `HomeApp.tsx`; use `useRunRecoveryState.ts` and focused components.
- **User trust:** Keep detailed backend errors visible in the UI and run log.

---

## Self-Review

- Every agreed requirement maps to at least one task: detection, rescue, resume, automation, UI visibility, queue handling, policy, retry budgets, incident inspection, scriptable control, and tests.
- No task relies on placeholder UI or fake backend state.
- The plan works in the current repository and does not create a branch or worktree.
- Existing recovery controls remain compatible while the complete recovery state model is introduced.
- The checklist includes the full ideal shape: policy, budgets, incident inspection, queue replay, manual and automatic rescue, scriptable control-plane helpers, and verification.
