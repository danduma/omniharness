# Multi-Agent Specialist Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow an OmniHarness run to execute an auditable specialist workflow that selects decision, planning, implementation, review, and validation agents from user-selected token-budget profiles.

**Architecture:** Add a server-owned orchestration policy containing named stages, model bindings, budget ceilings, and safe fallback rules. Jev is the low-cost decision lane; a configurable Claude binding (default intended for Opus 5.5) plans; a configurable Codex binding (default intended for Terra 5.6) reviews the plan then implements; independent specialist workers review and validate the result. Cross-CLI changes create a new run using the existing hybrid-handoff path, never mutate a live provider session in place. The scheduler persists each stage and dispatches only the next eligible stage, so restarts, retries, costs, and user overrides are explainable.

**Tech Stack:** TypeScript, Drizzle + SQLite, existing agent runtime/worker launch selection, existing decision layer and planning review modules, append-only worker JSONL stream, named SSE events, React Manager classes, locale JSON, Vitest, and lifecycle HTTP/SSE scenarios.

**Spec:** User request of 2026-11-04; product decisions and acceptance criteria are captured in this plan because no separate approved design document exists.

## Global Constraints

- Do not create branches or worktrees; do not delete files as part of this implementation.
- Treat model identifiers as configuration values, not capability claims: installation validates an exact provider/CLI/model/effort binding before dispatch.
- Preserve the provider-identity invariant: requested model intent and provider-reported effective model are stored separately and aliases must resolve unambiguously.
- A provider/CLI switch is a new run linked through the existing `HybridHandoffPacketV1`; never recreate a worker under a different CLI in the same run.
- Persist all worker conversation content only through `appendWorkerEntry` and render it through `WorkerEntriesManager`/`Terminal.entries`; do not add a transcript store.
- Every orchestration decision, refusal, retry, fallback, dispatch, completion, and recovery emits a typed `emitNamedEvent`; user-relevant failures also emit `error.surfaced` with a stable code.
- New frontend copy is added to every `shared/locales/*.json`, rendered with `t()`, and managers—not component state/effects—own mutable UI state.
- Model credentials remain in existing account/gateway/environment mechanisms; policies, costs, and model IDs must not expose credentials.
- Before shipping UI changes run `pnpm build:interface:web`; run targeted Vitest suites and `pnpm test:lifecycle` for lifecycle/state-machine coverage.

## Product contract

### Workflow stages

| Stage | Default specialist | Input | Durable output / gate |
| --- | --- | --- | --- |
| `triage` | Jev decision layer | minimal redacted task facts | task class, risk, recommended profile and decomposition; advisory unless explicitly enabled |
| `plan` | Claude planner binding | user request plus workspace evidence | spec/plan artifacts, readiness verdict |
| `plan_review` | Codex reviewer binding | immutable plan/spec snapshot | structured findings; planner revision loop or approval |
| `implement` | Codex implementer binding | approved plan and selected task slice | worker stream, changed files, verification evidence |
| `code_review` | independently configured reviewer | diff, plan acceptance criteria, test evidence | structured findings; repair loop or acceptance |
| `validate` | low-cost validator, escalated on risk | final workspace and acceptance criteria | command results and final stage decision |

`Jev` is deliberately restricted to bounded classification/routing questions. It cannot approve a plan, authorize an unsafe action, silently change a user-selected profile, or substitute for the human-facing plan. Each heavyweight stage uses the exact configured CLI binding, so the names “Claude Opus 5.5” and “Codex Terra 5.6” are defaults that can be changed if a local installation exposes different canonical IDs.

### Token profiles and deterministic escalation

| Profile | Intended use | Initial policy | Escalation rule |
| --- | --- | --- | --- |
| `economy` | low-risk fixes, short tasks | Jev triage; mid-tier planner/implementer; one combined review/validation pass | escalate only on low confidence, failed verification, or user-confirmed risk |
| `balanced` | default feature work | Jev triage; Opus planner; Terra plan review + implementation; independent review | one repair cycle, then ask user if budget ceiling would be exceeded |
| `thorough` | risky, cross-cutting, security/data changes | strongest configured planner, implementer, reviewer; separate validation; wider test matrix | mandatory independent review; two bounded repair cycles; never auto-spend beyond hard cap |
| `custom` | expert control | user pins each stage binding and caps | no automatic binding replacement; blocked stages request a choice |

Profiles store **token and monetary caps per stage and per run**, not a promise of a provider's billing semantics. Runtime usage reported by the provider is recorded when present; unreported usage is `unknown`, displayed as such, and cannot bypass a hard token cap. The preflight estimator is advisory, while a persisted reservation/ledger is authoritative for dispatch.

## Review Focus

- A configured model ID is unavailable, resolves to the wrong provider family, or is an ambiguous alias: preflight refuses without creating a worker.
- A low-confidence or unavailable Jev decision must keep the selected profile/default policy, never silently select a more expensive model.
- A stage reaches its cap while a provider reports no usage: stop dispatch, emit a surfaced budget error, and retain a resumable stage.
- Concurrent SSE retries, browser actions, or recovery wake-ups try to dispatch the same stage: only one launch claim may create a worker.
- Planner/reviewer/implementer switches CLI: the target begins from a redacted immutable handoff snapshot and the source cannot keep editing the checkout.

---

## File Structure

- Create: `src/shared/orchestration-policy.ts` — stable stage/profile/binding schemas, parser/validator, defaults, and pure next-stage rules.
- Create: `src/server/orchestration/model-catalog.ts` — resolves configured bindings against installed worker types/accounts/gateway models and canonicalizes requested identity.
- Create: `src/server/orchestration/budget-ledger.ts` — estimates, reserves, settles, and exposes per-stage/per-run budget accounting.
- Create: `src/server/orchestration/service.ts` — transactional stage state machine, launch claims, handoff integration, dispatch/recovery, and event emission.
- Create: `src/server/orchestration/prompts.ts` — bounded, redacted role prompts and JSON contracts for triage/review/validation.
- Create: `src/server/orchestration/reconcile.ts` — startup reconciliation for unclaimed, dispatched, and uncertain stages.
- Modify: `src/server/db/schema.ts` — orchestration policy/version on runs and normalized stage/ledger records with foreign keys and indexes.
- Modify: `src/server/db/migrations/*` — additive migration and safe backfill for existing runs.
- Modify: `src/server/events/named-events.ts` — orchestration event and surfaced-error unions.
- Modify: `src/server/decisions/{types.ts,service.ts}` and `src/shared/decision-layer.ts` — add the bounded `workflow_triage` decision point without changing Jev's existing safeguards.
- Modify: `src/server/planning/review.ts`, `src/server/planning/transition.ts`, `src/server/supervisor/index.ts`, and `src/server/review/*` — adapt existing planning/review/implementation completion hooks into idempotent orchestration-stage adapters rather than duplicate worker launch logic.
- Modify: `src/runtime/http/routes/{settings.ts,planning.ts,runs.ts,index.ts}` and runtime API types — policy/profile endpoints and stage controls.
- Create: `src/interface/orchestration/OrchestrationManager.ts` — global client source of truth for policy drafts, preflight, stage state, and actions.
- Create: `src/components/settings/OrchestrationPolicySettings.tsx` and `src/components/home/OrchestrationTimeline.tsx` — translated profile/binding setup and run-stage timeline/controls.
- Modify: `src/components/settings/ModelsSettingsPanel.tsx`, `src/components/home/ConversationMain.tsx`, relevant runtime client adapters, `shared/locales/*.json` — integration, event hydration, i18n.
- Create: `tests/server/orchestration/{model-catalog,budget-ledger,service,reconcile,prompts}.test.ts` — unit/contract coverage.
- Create: `tests/api/orchestration-routes.test.ts`, `tests/app/orchestration-manager.test.ts`, `tests/ui/orchestration-policy-settings.test.tsx`, and lifecycle scenarios for duplicate dispatch/restart/budget/handoff refusal.

### Task 1: Define the immutable policy and profile contracts

**Files:**
- Create: `src/shared/orchestration-policy.ts`
- Test: `tests/shared/orchestration-policy.test.ts`

**Interfaces:**
- Produces `WorkflowStage`, `TokenProfile`, `ModelBinding`, `StageBudget`, `OrchestrationPolicyV1`, `parseOrchestrationPolicy(value)`, and `resolveProfilePolicy(policy, profile)`.
- Consumes existing `SupportedWorkerType` and normalized reasoning-effort types.

- [ ] **Step 1: Write failing parser and transition tests**

Cover valid `economy`/`balanced`/`thorough`/`custom` policies; reject unknown CLI, duplicate stage binding, negative caps, a profile with no implementation binding, and any transition that skips an unmet hard gate.

- [ ] **Step 2: Run the focused test file**

Run: `pnpm vitest run tests/shared/orchestration-policy.test.ts`

Expected: FAIL because the policy module does not exist.

- [ ] **Step 3: Implement stable, versioned policy types and pure rules**

Add exact discriminated unions for the six stages and profile modes. A binding carries `workerType`, canonical requested `model`, `effort`, optional account/gateway source, `maxInputTokens`, `maxOutputTokens`, and `maxCostUsd`; a policy carries per-stage and aggregate caps, bounded repair rounds, and explicit fallback bindings. Keep no translated copy in persisted fields.

- [ ] **Step 4: Run the focused test file**

Run: `pnpm vitest run tests/shared/orchestration-policy.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/orchestration-policy.ts tests/shared/orchestration-policy.test.ts
git commit -m "feat: define orchestration policy contracts"
```

### Task 2: Persist policies, stages, and budget reservations

**Files:**
- Modify: `src/server/db/schema.ts`
- Create: `src/server/db/migrations/<timestamp>_orchestration_policy.sql`
- Create: `src/server/orchestration/budget-ledger.ts`
- Test: `tests/server/db/orchestration-schema.test.ts`
- Test: `tests/server/orchestration/budget-ledger.test.ts`

**Interfaces:**
- Consumes `OrchestrationPolicyV1` from Task 1 and `runs`/`workers` records.
- Produces `orchestrationStages`, `orchestrationBudgetLedger`, `reserveStageBudget(args)`, `settleStageBudget(args)`, and `getRunBudgetSummary(runId)`.

- [ ] **Step 1: Write failing migration and ledger-concurrency tests**

Assert foreign-key cleanup follows run deletion order, `(runId, stageKey, attempt)` is unique, only one active dispatch claim exists per stage, reservations cannot exceed stage/run caps, and settlement preserves `usageUnknown` rather than inventing usage.

- [ ] **Step 2: Run focused tests**

Run: `pnpm vitest run tests/server/db/orchestration-schema.test.ts tests/server/orchestration/budget-ledger.test.ts`

Expected: FAIL because tables and ledger do not exist.

- [ ] **Step 3: Add additive schema, migration, and transactional ledger**

Persist policy JSON/version and selected profile on `runs`; add normalized stages (`pending`, `preflight`, `blocked`, `dispatched`, `waiting`, `completed`, `failed`, `cancelled`, `needs_recovery`) and append-only reservation/settlement rows. Use SQLite transaction predicates for budget and launch claims; store requested/effective model identities, worker/run links, handoff ID, structured failure code, and timestamps.

- [ ] **Step 4: Run focused tests**

Run: `pnpm vitest run tests/server/db/orchestration-schema.test.ts tests/server/orchestration/budget-ledger.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/db/schema.ts src/server/db/migrations tests/server/db/orchestration-schema.test.ts src/server/orchestration/budget-ledger.ts tests/server/orchestration/budget-ledger.test.ts
git commit -m "feat: persist orchestration stages and budgets"
```

### Task 3: Validate model bindings before any dispatch

**Files:**
- Create: `src/server/orchestration/model-catalog.ts`
- Test: `tests/server/orchestration/model-catalog.test.ts`

**Interfaces:**
- Consumes `ModelBinding`, installed worker availability, account allocation, Claude gateway model menu, and provider identity verification.
- Produces `preflightBinding(binding, context): Promise<BindingPreflightResult>` with `ready | unavailable | identity_mismatch | quota_blocked | credential_missing` outcomes.

- [ ] **Step 1: Write failing preflight tests**

Test canonical Claude/Codex bindings, unavailable binary, missing account, quota block, gateway model, exact alias acceptance, and ambiguous/cross-family alias refusal.

- [ ] **Step 2: Run the focused test file**

Run: `pnpm vitest run tests/server/orchestration/model-catalog.test.ts`

Expected: FAIL because `preflightBinding` is undefined.

- [ ] **Step 3: Implement binding catalog and no-side-effect preflight**

Reuse worker-availability and existing launch-selection rules. Return machine-readable diagnostics and normalized requested identity; never start an agent, reserve budget, or write a stage during catalog inspection.

- [ ] **Step 4: Run the focused test file**

Run: `pnpm vitest run tests/server/orchestration/model-catalog.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/orchestration/model-catalog.ts tests/server/orchestration/model-catalog.test.ts
git commit -m "feat: preflight orchestration model bindings"
```

### Task 4: Extend Jev only as a bounded triage decision point

**Files:**
- Modify: `src/shared/decision-layer.ts`
- Modify: `src/server/decisions/types.ts`
- Modify: `src/server/decisions/service.ts`
- Create: `src/server/orchestration/prompts.ts`
- Test: `tests/server/decisions/orchestration-triage.test.ts`
- Test: `tests/server/orchestration/prompts.test.ts`

**Interfaces:**
- Produces `workflow_triage` decision point and `buildTriageDecisionRequest(input)` returning only `complexity`, `risk`, `parallelizable`, and recommended profile confidence.
- Consumes `DecisionService.decide`; fallback returns `null`, leaving selected/default profile unchanged.

- [ ] **Step 1: Write failing triage contract tests**

Assert redaction and size limits, restricted answer schema, shadow mode non-action, confidence threshold behavior, unavailable Jev fallback, and that neither model IDs nor a stage plan can be selected solely by the decision output.

- [ ] **Step 2: Run focused tests**

Run: `pnpm vitest run tests/server/decisions/orchestration-triage.test.ts tests/server/orchestration/prompts.test.ts`

Expected: FAIL because the new decision point and prompt builder are absent.

- [ ] **Step 3: Implement the triage point and role prompts**

Use existing `DecisionService` safeguards, events, redaction, timeout, shadow/acting split, and budget error behavior. Prompt builders must wrap worker-derived text in the existing untrusted-data boundary and request structured findings/verification records, never hidden reasoning.

- [ ] **Step 4: Run focused tests**

Run: `pnpm vitest run tests/server/decisions/orchestration-triage.test.ts tests/server/orchestration/prompts.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/decision-layer.ts src/server/decisions src/server/orchestration/prompts.ts tests/server/decisions/orchestration-triage.test.ts tests/server/orchestration/prompts.test.ts
git commit -m "feat: add bounded workflow triage"
```

### Task 5: Implement the durable orchestration state machine

**Files:**
- Create: `src/server/orchestration/service.ts`
- Modify: `src/server/events/named-events.ts`
- Test: `tests/server/orchestration/service.test.ts`
- Test: `tests/server/events/orchestration-events.test.ts`

**Interfaces:**
- Produces `createWorkflow`, `selectProfile`, `preflightWorkflow`, `dispatchNextStage`, `completeStage`, `failStage`, `retryStage`, and `cancelWorkflow`.
- Consumes Tasks 1–4, the budget ledger, named events, existing planning/review adapters, and hybrid handoff coordinator.

- [ ] **Step 1: Write failing state-machine tests**

Cover normal `triage → plan → plan_review → implement → code_review → validate`, planner findings revision loop, approval gates, profile lock after preflight, token-cap block, duplicate dispatch, cancellation, and a failure that remains recoverable after process restart.

- [ ] **Step 2: Run focused tests**

Run: `pnpm vitest run tests/server/orchestration/service.test.ts tests/server/events/orchestration-events.test.ts`

Expected: FAIL because the orchestration service and event kinds do not exist.

- [ ] **Step 3: Implement atomic claims, eventful transitions, and safe handoff dispatch**

For each mutation: validate policy/profile, preflight binding, reserve budget, claim stage, emit `orchestration.stage_*`, then delegate to the existing stage owner. If target CLI differs from the source worker, call the hybrid-handoff coordinator and persist its ID; if it cannot prove source shutdown/target launch, keep `needs_recovery` and the workspace fence. Emit stable surfaced codes including `orchestration.binding_unavailable`, `orchestration.identity_mismatch`, `orchestration.budget_exceeded`, `orchestration.dispatch_conflict`, and `orchestration.handoff_failed`.

- [ ] **Step 4: Run focused tests**

Run: `pnpm vitest run tests/server/orchestration/service.test.ts tests/server/events/orchestration-events.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/orchestration/service.ts src/server/events/named-events.ts tests/server/orchestration/service.test.ts tests/server/events/orchestration-events.test.ts
git commit -m "feat: orchestrate specialist workflow stages"
```

### Task 6: Adapt existing planner, reviewer, implementer, and validator paths

**Files:**
- Modify: `src/server/planning/review.ts`
- Modify: `src/server/planning/transition.ts`
- Modify: `src/server/supervisor/index.ts`
- Modify: `src/server/review/*`
- Test: `tests/server/orchestration/stage-adapters.test.ts`
- Test: `tests/supervisor/orchestration-stage-completion.test.ts`

**Interfaces:**
- Consumes a claimed stage and model binding from Task 5.
- Produces a single terminal stage callback containing worker IDs, requested/effective identity, structured findings, verification, usage, and durable stream sequence.

- [ ] **Step 1: Write failing adapter tests**

Prove plan review launches the policy's Codex binding rather than a global preference, implementation cannot start before an approved review, review findings produce one bounded repair stage, and every terminal agent result settles the same reservation exactly once.

- [ ] **Step 2: Run focused tests**

Run: `pnpm vitest run tests/server/orchestration/stage-adapters.test.ts tests/supervisor/orchestration-stage-completion.test.ts`

Expected: FAIL because existing paths are not stage-aware.

- [ ] **Step 3: Add adapters at stage boundaries, not parallel launch paths**

Pass stable stage IDs/role metadata through existing worker creation and use `appendWorkerEntry` for every prompt, handoff, finding, and terminal outcome. Preserve standalone planning/review/supervisor behavior when a run has no orchestration policy. Keep reviewer workers independent from the implementation worker and ensure all cross-CLI dispatches use Task 5's handoff path.

- [ ] **Step 4: Run focused tests**

Run: `pnpm vitest run tests/server/orchestration/stage-adapters.test.ts tests/supervisor/orchestration-stage-completion.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/planning src/server/supervisor src/server/review src/server/workers tests/server/orchestration/stage-adapters.test.ts tests/supervisor/orchestration-stage-completion.test.ts
git commit -m "feat: connect workflow stages to agent execution"
```

### Task 7: Add recovery reconciliation and lifecycle journeys

**Files:**
- Create: `src/server/orchestration/reconcile.ts`
- Modify: existing runtime startup/reconciliation registration module
- Create: `tests/lifecycle/scenarios/orchestration-duplicate-dispatch.test.ts`
- Create: `tests/lifecycle/scenarios/orchestration-restart-recovery.test.ts`
- Create: `tests/lifecycle/scenarios/orchestration-cross-cli-handoff.test.ts`
- Create: `tests/lifecycle/scenarios/orchestration-budget-stop.test.ts`

**Interfaces:**
- Produces `reconcileOrchestrationStages()` and one registered startup owner.
- Consumes durable stage/ledger/worker/handoff records and live bridge ownership.

- [ ] **Step 1: Write failing lifecycle scenarios**

Use HTTP/SSE only to assert named event sequences for duplicate requests, server restart during dispatch, exhausted budget, unavailable target binding, and ambiguous cross-CLI target shutdown. Each scenario must wait for background tasks before cleanup.

- [ ] **Step 2: Run the new scenarios**

Run: `pnpm test:lifecycle -- orchestration-duplicate-dispatch orchestration-restart-recovery orchestration-cross-cli-handoff orchestration-budget-stop`

Expected: FAIL because reconciliation and lifecycle events are incomplete.

- [ ] **Step 3: Implement reconciliation with no silent branch**

On startup, discover stage claim/worker/handoff facts; adopt confirmed delivery, resume idempotent unsettled dispatch only under its durable claim, or transition to `needs_recovery` with events and surfaced actionable error. Never infer that a provider turn completed from session reattachment alone.

- [ ] **Step 4: Run lifecycle coverage**

Run: `pnpm test:lifecycle -- orchestration-duplicate-dispatch orchestration-restart-recovery orchestration-cross-cli-handoff orchestration-budget-stop`

Expected: PASS with every expected `orchestration.*`, worker, handoff, and `error.surfaced` event observed.

- [ ] **Step 5: Commit**

```bash
git add src/server/orchestration/reconcile.ts src/server tests/lifecycle/scenarios/orchestration-*.test.ts
git commit -m "feat: recover orchestrated workflows safely"
```

### Task 8: Expose policy setup, preflight, and run controls over HTTP

**Files:**
- Modify: `src/runtime/http/routes/settings.ts`
- Modify: `src/runtime/http/routes/planning.ts`
- Modify: `src/runtime/http/routes/runs.ts`
- Modify: `src/runtime/http/routes/index.ts`
- Modify: `src/runtime-api/types.ts`
- Create: `tests/api/orchestration-routes.test.ts`

**Interfaces:**
- Produces authenticated endpoints to save policy defaults, query binding preflight, select a run profile before dispatch, and retry/cancel/continue a blocked stage.
- Consumes Task 5 service only; route handlers do not directly update orchestration tables.

- [ ] **Step 1: Write failing API tests**

Test invalid policy rejection, environment-secret rejection, preflight report without writes, same-origin mutation protection, idempotency keys, conflict response for an active dispatch, and stable error-event emission for every user-actionable failure.

- [ ] **Step 2: Run the focused API test file**

Run: `pnpm vitest run tests/api/orchestration-routes.test.ts`

Expected: FAIL because the endpoints are absent.

- [ ] **Step 3: Implement typed route adapters and snapshot projection**

Reuse settings validation/encryption conventions; persist only policy data. Include stage, ledger, requested/effective model, binding diagnostics, and immutable references in the existing run snapshot so reconnecting clients need no side channel.

- [ ] **Step 4: Run the focused API test file**

Run: `pnpm vitest run tests/api/orchestration-routes.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/runtime/http src/runtime-api tests/api/orchestration-routes.test.ts
git commit -m "feat: add orchestration policy API"
```

### Task 9: Build the translated settings and run timeline UI

**Files:**
- Create: `src/interface/orchestration/OrchestrationManager.ts`
- Create: `src/components/settings/OrchestrationPolicySettings.tsx`
- Create: `src/components/home/OrchestrationTimeline.tsx`
- Modify: `src/components/settings/ModelsSettingsPanel.tsx`
- Modify: `src/components/home/ConversationMain.tsx`
- Modify: relevant runtime API providers/managers
- Modify: `shared/locales/en.json`, `shared/locales/de.json`, `shared/locales/es.json`, `shared/locales/fr.json`, `shared/locales/it.json`, `shared/locales/ja.json`, `shared/locales/ko.json`, `shared/locales/pt.json`, `shared/locales/zh-CN.json`
- Test: `tests/app/orchestration-manager.test.ts`
- Test: `tests/ui/orchestration-policy-settings.test.tsx`
- Test: `tests/ui/orchestration-timeline.test.tsx`

**Interfaces:**
- Consumes HTTP snapshots/events from Task 8.
- Produces one global manager that owns draft policy, preflight state, selected profile, timeline state, and retry/cancel commands.

- [ ] **Step 1: Write failing manager/UI tests**

Verify default profile comparison, custom binding validation display, no secrets in the UI model, disabled start on failed preflight, cap and unknown-usage display, stage timeline ordering, event-driven refresh, retry/cancel behavior, and language-change rerendering.

- [ ] **Step 2: Run focused frontend tests**

Run: `pnpm vitest run tests/app/orchestration-manager.test.ts tests/ui/orchestration-policy-settings.test.tsx tests/ui/orchestration-timeline.test.tsx`

Expected: FAIL because the manager and components do not exist.

- [ ] **Step 3: Implement manager-owned UI**

Render profile cards with their actual stage bindings and caps, a preflight summary, and an ordered timeline that distinguishes pending, blocked, active, complete, and recovery states. All text uses `t()` and every translated component calls `useI18nSnapshot()`; components issue manager commands rather than owning workflow state.

- [ ] **Step 4: Run frontend tests and interface build**

Run: `pnpm vitest run tests/app/orchestration-manager.test.ts tests/ui/orchestration-policy-settings.test.tsx tests/ui/orchestration-timeline.test.tsx && pnpm build:interface:web`

Expected: PASS and a successful interface build.

- [ ] **Step 5: Commit**

```bash
git add src/interface/orchestration src/components/settings/OrchestrationPolicySettings.tsx src/components/home/OrchestrationTimeline.tsx src/components/settings/ModelsSettingsPanel.tsx src/components/home/ConversationMain.tsx src/interface shared/locales tests/app/orchestration-manager.test.ts tests/ui/orchestration-policy-settings.test.tsx tests/ui/orchestration-timeline.test.tsx
git commit -m "feat: configure and monitor specialist workflows"
```

### Task 10: Verify end-to-end behavior and document operational rollout

**Files:**
- Create: `docs/architecture/specialist-orchestration.md`
- Modify: `docs/architecture/lifecycle-observability-and-testing.md` only if new event/recovery invariants need cross-reference
- Test: `tests/lifecycle/scenarios/orchestration-full-workflow.test.ts`

**Interfaces:**
- Produces an operator document covering model binding setup, default profile semantics, cap accounting, user intervention, event diagnosis, and safe rollback (disable policy for new runs; retain existing history).

- [ ] **Step 1: Write the full workflow scenario**

Create a mocked end-to-end `balanced` journey: Jev triage is advisory, Claude planning produces artifacts, Codex plan review finds and resolves one issue, Codex implements, independent review/validation pass, and SSE records the complete causal sequence and ledger settlement.

- [ ] **Step 2: Run the scenario and full relevant verification**

Run: `pnpm test:lifecycle -- orchestration-full-workflow && pnpm vitest run tests/server/orchestration tests/api/orchestration-routes.test.ts tests/app/orchestration-manager.test.ts tests/ui/orchestration-policy-settings.test.tsx tests/ui/orchestration-timeline.test.tsx && pnpm build:interface:web`

Expected: PASS; no live provider credentials or external model invocation required.

- [ ] **Step 3: Write operational documentation**

Document exact setup of Jev/AI Gateway, provider bindings, budget profiles, model-ID validation, named events/error codes, and how to investigate a blocked stage through `/api/events/log`. State explicitly that configured defaults may be changed when provider model availability changes.

- [ ] **Step 4: Commit**

```bash
git add docs/architecture/specialist-orchestration.md docs/architecture/lifecycle-observability-and-testing.md tests/lifecycle/scenarios/orchestration-full-workflow.test.ts
git commit -m "docs: document specialist orchestration operations"
```

## Self-Review

- **Spec coverage:** The plan covers specialized roles, Claude/Codex/Jev assignment, plan review before implementation, independent review/validation, token-consumption scale, configuration/preflight, auditability, recovery, and UI control.
- **Step scan:** Each task starts with a failing test, implements one bounded responsibility, and provides an exact verification command.
- **Type consistency:** Policies use `SupportedWorkerType`; all runtime dispatch flows through model preflight, stage claims, and existing launch selection/handoff contracts.
- **Review Focus:** Model identity, Jev fallback, unknown provider usage, duplicate dispatch, and cross-CLI continuity are each pinned to Tasks 3, 4, 2/5, 5/7, and 5/7 respectively.
- **Proportion:** This is intentionally a multi-subsystem plan, but implementation is phased so Tasks 1–5 yield an API-only vertical slice before UI and operational rollout.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-11-04-multi-agent-specialist-orchestration.md`. Please review the plan. I recommend the subagent-driven execution approach because the state machine, budget ledger, existing agent adapters, and UI are independently testable but have high lifecycle risk. Does the plan capture what you want, and which approach should we use?
