# Specialist orchestration

An orchestrated conversation runs as an auditable, staged workflow in which
each stage is handled by a configured specialist:

| Stage | Default specialist (balanced) | Owner it delegates to | Completes on |
| --- | --- | --- | --- |
| `triage` | Jev (`typesafe-ai/jev`) through the decision layer | `DecisionService` (`workflow_triage` point) | inline; always `advisory` |
| `plan` | Claude `claude-opus-5-5`, effort high | the Omni run's planner phase | `plan.ready` |
| `plan_review` | Codex `gpt-5.6-terra`, effort high | `startPlanningReview` (1 round, exact model) | `plan.review.finished` |
| `implement` | Codex `gpt-5.6-terra`, effort high | `startImplementationPhase` / supervisor | `supervisor.run_finished` |
| `code_review` | Claude `claude-sonnet-5-5` (different CLI than the implementer) | `startCodeReview` (1 round, exact reviewer) | `code_review.finished` |
| `validate` | Codex `gpt-5.6-luna` | read-only helper agent with a JSON verdict | the validator's reply |

Plan: `docs/superpowers/plans/2026-11-04-multi-agent-specialist-orchestration.md`.

## Where things live

- `src/shared/orchestration-policy.ts`: the versioned policy, profiles,
  bindings, caps, the parser/validator, the defaults, and the pure
  next-stage rules (`computeNextStage`, `canEnterStage`).
- `src/server/orchestration/service.ts`: the stage state machine
  (`createWorkflow`, `selectProfile`, `preflightWorkflow`,
  `dispatchNextStage`, `completeStage`, `failStage`, `signalStage`,
  `retryStage`, `cancelWorkflow`, `getWorkflowSnapshot`).
- `src/server/orchestration/model-catalog.ts`: side-effect-free binding preflight.
- `src/server/orchestration/budget-ledger.ts`: reservations and settlements.
- `src/server/orchestration/stage-adapters.ts`: per-stage delegation to the
  existing owners and the single listener that turns their terminal events
  into stage signals.
- `src/server/orchestration/reconcile.ts`: startup reconciliation.
- Tables: `orchestration_stages`, `orchestration_budget_ledger`, plus
  `runs.orchestration_*` columns (schema version 11).
- HTTP: `GET/PUT /api/orchestration/policy`, `POST /api/orchestration/preflight`,
  `GET/POST /api/runs/:id/orchestration` (actions `create`, `select_profile`,
  `preflight`, `dispatch`, `retry`, `cancel`).
- UI: Settings → Models → Specialist orchestration
  (`OrchestrationPolicySettings`) and the timeline above the conversation
  (`OrchestrationTimeline`), both driven by `OrchestrationManager`.

## Which conversations can be orchestrated

Only Omni conversations (`runs.mode = "implementation"`). An Omni run may
mix CLIs: its planner and the supervisor's workers can be different agents,
and reviewers/validators are independent helper agents. The
`HANDOFF_REQUIRED` invariant that pins a CLI applies only to `direct` and
`commit` conversations, so a workflow is refused for them
(`orchestration.refused`, reason `unsupported_run`) instead of mutating a
live provider session. The plan stage likewise refuses (`identity_mismatch`)
when the conversation's planner is already running on another CLI than the
policy binds. The planner's CLI and model are pinned on the run before the
first worker exists; the implementer's CLI, model and effort are pinned when
implementation starts (`allowedWorkerTypes` becomes that CLI only).

## Setting it up

1. **Jev / AI Gateway.** Set `AI_GATEWAY_API_KEY` in the runner environment
   (never in settings). Enable the decision layer and the
   `workflow_triage` point in Settings → Models → Decision layer. Without a
   key, triage is recorded as `advisory` and the workflow continues on the
   chosen profile; Jev never blocks a workflow.
2. **Provider bindings.** Each stage binds an exact CLI, canonical model id,
   effort, and optionally an account or the Claude model gateway. The
   defaults (`claude-opus-5-5`, `gpt-5.6-terra`, …) are configuration values,
   not capability claims: change them when a local installation exposes
   different ids. Built-in profiles may list fallbacks; `custom` never does.
3. **Profiles and caps.** Choose the default profile and adjust run caps.
   Default run caps cover every stage once plus the profile's bounded
   revision and repair loops at full reservation.
4. **Preflight.** Use "Check bindings" per profile. Preflight reports
   `ready | unavailable | identity_mismatch | quota_blocked |
   credential_missing` per stage and writes nothing.

## Model-ID validation

A binding's model must resolve to exactly one model of its own CLI family:
an exact id passes; a display-name alias passes only when it names one model
of that family and none of another; an ambiguous or cross-family alias is
refused as `identity_mismatch` and is never replaced by a fallback. The
requested canonical id and the provider-reported effective model are stored
separately on the stage row (`requested_model`, `effective_model`).

## Profile semantics and user intervention

- `economy`, `balanced`, `thorough`, `custom` — see the plan's product contract.
- The profile can change until the first non-triage stage is dispatched;
  afterwards `select_profile` is refused (`profile_locked`).
- Triage in acting mode may only move a profile the user did not choose to an
  equal or cheaper one. A recommendation for a more expensive profile stays a
  recommendation (`orchestration.triage_recommended`, `applied: false`).
- A blocked, failed, or interrupted stage waits for the user: `retry` cancels
  that attempt (settling its reservation as unknown usage) and dispatches a
  new one. A review loop that reached its round cap is the user's decision and
  cannot be retried away.
- `cancel` stops the workflow, cancels the active stage, and settles it.

## Cap accounting

Each stage attempt reserves its stage cap before dispatch. The reservation is
admitted by a single `INSERT … SELECT` that re-reads the run's committed
spend, so concurrent reservations cannot both pass a cap. Committed spend is
the settled provider usage where reported (from `worker_token_usage` since
the stage was claimed, or the decision layer's usage) and the full
reservation otherwise — unknown usage never frees budget. Settlement is
insert-once per stage, so every terminal result settles exactly once. Costs
are recorded as reported; they are not a promise of a provider's billing.

## Events and error codes

Every decision is a named event: `orchestration.workflow_created`,
`profile_selected`, `refused`, `preflight_completed`, `fallback_selected`,
`stage_claimed`, `budget_reserved`, `stage_dispatched`, `stage_waiting`,
`stage_completed`, `stage_failed`, `stage_blocked`, `stage_retried`,
`stage_signal_ignored`, `budget_settled`, `handoff_started`,
`workflow_blocked`, `workflow_completed`, `workflow_cancelled`,
`recovery_reconciled`, `triage_recommended`, `triage_ignored`,
`adapter_failed`, `policy_saved`, `policy_rejected`. The supervisor's
terminal outcome is `supervisor.run_finished`.

User-actionable failures also emit `error.surfaced` with one of
`orchestration.binding_unavailable`, `orchestration.identity_mismatch`,
`orchestration.budget_exceeded`, `orchestration.dispatch_conflict`,
`orchestration.handoff_failed`, `orchestration.stage_failed`,
`orchestration.needs_recovery`, `orchestration.profile_locked`,
`orchestration.invalid_policy`.

## Investigating a blocked stage

1. `GET /api/runs/<runId>/orchestration` shows each attempt's status,
   `failureCode`, `lastError`, requested/effective model, and ledger, plus
   `next` (the deterministic next decision, e.g. `blocked/needs_recovery`).
2. `GET /api/events/log?runId=<runId>` shows the causal event trail. If the
   expected `orchestration.*` event is missing, the server did not do the
   thing — look for the branch that should have emitted it.
3. `sqlite.db`: `orchestration_stages` (ordered by `seq`) and
   `orchestration_budget_ledger` for the run; then the owner's own records
   (`planning_review_runs`, `code_reviews`, the run's supervisor status).

## Restart behavior

On startup `reconcileOrchestrationStages` inspects every stage that held the
run's dispatch claim: a stage whose launch cannot be proven
(`preflight`/`dispatched`), or whose owner was an in-process helper
(triage, validation, a still-`running` review), becomes `needs_recovery`
with its reservation kept and `orchestration.needs_recovery` surfaced; a
stage whose owner recorded a terminal result is settled from that record;
a waiting planner phase or running supervisor is adopted. A reattached
session is never taken as proof that a provider turn finished.

## Rollback

Orchestration only acts on runs whose `orchestration_policy_json` is set.
To stop using it, stop creating workflows (the UI's "Start workflow" is the
only entry point); existing runs keep their history. Standalone planning
review, code cross-review, and supervisor runs behave as before: their
terminal events reach the orchestration listener, which ignores runs without
a waiting stage.
