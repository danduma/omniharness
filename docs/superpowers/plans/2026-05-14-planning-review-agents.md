# Planning Review Agents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a seamless manual "Improve plan with review agents" flow to planning mode, with inline remembered options for reviewer agent selection and review rounds.

**Architecture:** Keep the existing single-agent planning conversation as the source of truth. When a ready handoff exists, let the user expand inline review controls, start a review run, spawn read-only reviewer workers for the configured number of rounds, synthesize findings, and ask the original planner to revise the spec and plan before refreshing artifacts. Persist review preferences in the existing `settings` table and persist review execution state in dedicated planning review tables.

**Tech Stack:** Next.js App Router, React, TypeScript, Drizzle ORM with SQLite, existing agent bridge client, existing settings API/table, existing i18n resources, Vitest, Playwright for approval-gated browser journeys.

**North Star Product:** OmniHarness planning should move from rough intent to implementation-ready plan with a trustworthy review loop, while staying conversational and low-friction enough that users actually run the review.

**Current Milestone:** Ship a manual inline review flow for ready planning handoffs: remembered review options, Auto reviewer selection, persisted review rounds/findings, planner revision, artifact refresh, and visible progress/status in the handoff area.

**Future Product Direction:** Later product direction can include reviewer role presets, parallel reviewer panels, plan diff previews, and manual accept/reject of individual findings. Those are product direction only and are not part of this milestone.

**Final Functionality Standard:** A user can create a ready planning handoff, expand inline review options, rely on remembered defaults, click one `Start review` button, watch review progress, receive a planner-revised plan, and then continue revising or promote the reviewed plan without any modal or hidden manual steps.

---

## Constraints

- Do not create a branch.
- Do not create a worktree.
- Use the existing local process when testing the app.
- New user-facing frontend strings must be added to every `shared/locales/*.json` file and rendered with `t()`.
- Do not hardcode user-facing JSX strings.
- Review workers must not edit files. The planner remains the only writer of planning artifacts.
- Review preferences must persist across browser sessions and planning conversations.
- Do not put review settings in `.env`.

## User Stories

As a builder with a ready plan, I want to improve it with another agent before implementation, so I catch sequencing, completeness, and verification gaps before spending implementation time.

As a builder who usually likes the same review setup, I want OmniHarness to remember my reviewer agent and round count, so I can start review quickly next time.

As a builder using multiple CLIs with quotas, I want `Auto` to prefer a healthy different agent from the planner, so review gets a real second opinion when possible.

As a builder near quota limits, I want review startup to avoid agents that are unavailable or quota-exhausted, so the flow fails early with a clear message instead of getting stuck.

As a builder reviewing a reviewed plan, I want to see whether review is running, done, blocked, or failed directly in the planning handoff area, so I know the next action.

## PM Pass

Primary user: the human builder using OmniHarness to turn an idea into an implementation run.

Core job: improve a ready planning handoff before promotion.

Supporting jobs:

- Choose or remember the reviewer agent source.
- Choose or remember the number of review rounds.
- Resolve `Auto` into a concrete available worker type.
- Avoid known quota-exhausted workers.
- Persist review status and findings for traceability.
- Keep review read-only and centralized through planner revisions.
- Surface failures and quota blocks inline.
- Keep promotion explicit after review.

State model:

- Planning run status may include `reviewing_plan` and `revising_plan`.
- Review run status: `running`, `awaiting_planner_revision`, `completed`, `failed`, `cancelled`.
- Review round status: `pending`, `reviewing`, `revising`, `completed`, `failed`, `skipped`.
- Inline options expansion is UI state and does not need to persist.
- Review preferences persist in the `settings` table.

Persistence model:

- Preferences live in `settings` keys:
  - `PLANNING_REVIEW_AGENT_SELECTION`
  - `PLANNING_REVIEW_ROUNDS`
- Review records live in new SQLite tables.
- Findings are stored as structured records, not only as freeform worker output.
- Planner artifact paths remain on `runs.specPath`, `runs.artifactPlanPath`, and `runs.plannerArtifactsJson`.

Operational readiness:

- Every review start, reviewer selection, round completion, planner revision, failure, and quota block emits an `execution_events` record.
- API errors preserve specific backend messages so the UI can display actionable inline errors.
- Review orchestration is scriptable through `POST /api/planning/[id]/review` and inspectable through event stream state.

Risk and trust surfaces:

- Review agents must not mutate files.
- A review should not auto-promote implementation.
- `Auto` should explain its concrete selection in persisted event details.
- If the planner cannot be resumed for revision, findings remain visible and the run returns to a recoverable ready/failed state.

## Product Completeness Pass

Primary journey:

1. User creates a planning conversation.
2. Planner emits a ready handoff.
3. Planning handoff shows review and promotion actions.
4. User expands `Improve plan with review agents`.
5. Inline options appear, prefilled from remembered settings.
6. User clicks `Start review`.
7. UI shows review progress.
8. Reviewer produces findings.
9. Planner revises spec/plan.
10. Artifacts refresh.
11. User continues revising, reviews again, or starts implementation.

Return/revisit journey:

- Reloading the app preserves review preferences.
- Returning to the planning conversation shows latest review status and findings summary from persisted records.

Failure/recovery journey:

- If no reviewer can be selected, show inline error and leave plan promotable.
- If reviewer quota is exhausted, mark the review failed or blocked with quota details and leave the plan promotable.
- If reviewer succeeds but planner revision fails, keep findings visible and allow the user to retry review or continue revising manually.

Status-awareness journey:

- User can distinguish `ready`, `reviewing`, `revising`, `reviewed`, and `failed` without inspecting logs.
- The selected concrete reviewer for `Auto` is visible in the review summary.

Mutation journey:

- Changing inline options immediately persists the preference.
- Starting review creates durable records and transient worker activity.
- Review never promotes implementation.

## File Map

Files to create:

- `src/server/planning/review.ts`
  Owns review orchestration: validate handoff, resolve preferences, select reviewer worker type, spawn reviewer workers, collect findings, ask planner to revise, refresh artifacts, and persist events.

- `src/server/planning/review-prompts.ts`
  Owns read-only reviewer prompt and planner revision prompt builders.

- `src/server/planning/review-preferences.ts`
  Owns setting keys, parsing, clamping, and serialization for reviewer selection and round count.

- `src/server/planning/review-agent-selection.ts`
  Owns `Auto` resolution using allowed workers, planner worker type, spawnability, worker availability, recent quota incidents, and fallback behavior.

- `src/app/api/planning/[id]/review/route.ts`
  Starts a review run for a planning conversation.

- `src/app/home/PlanningReviewPreferencesManager.ts`
  Client Manager for review option state. Hydrates from settings, validates option changes, and exposes narrow subscriptions.

- `src/components/PlanningReviewControls.tsx`
  Inline expandable review controls and progress summary. Uses translated strings only.

- `tests/server/planning/review-preferences.test.ts`
  Unit tests for preference parsing, defaults, round clamping, and setting payloads.

- `tests/server/planning/review-agent-selection.test.ts`
  Unit tests for Auto selection and quota/unavailability fallback behavior.

- `tests/server/planning/review.test.ts`
  Orchestration tests for review rounds, findings persistence, planner revision, artifact refresh, and failure recovery.

- `tests/api/planning-review-route.test.ts`
  API tests for authentication, invalid run handling, non-planning rejection, unready plan rejection, successful review start, and preference override handling.

- `tests/app/planning-review-controls.test.tsx`
  UI/component tests for inline controls, remembered options, disabled states, and i18n key usage if the project has existing component test setup. If no component harness exists, cover source-level expectations in `tests/ui/sidebar-layout.test.ts` style.

Files to modify:

- `src/server/db/schema.ts`
  Add Drizzle tables for planning review runs, rounds, and findings.

- `src/server/db/index.ts`
  Add `CREATE TABLE IF NOT EXISTS` DDL for the new review tables.

- `src/server/planning/status.ts`
  Extend planning status types to include `reviewing_plan` and `revising_plan`.

- `src/server/planning/refresh.ts`
  Preserve explicit review/revision statuses while artifact refresh runs, then return to `ready` or `awaiting_user` when review orchestration completes.

- `src/server/conversations/send-message.ts`
  Ensure user follow-up messages during/after reviewed status still route to the planning worker and clear review-specific transient failure state as needed.

- `src/server/conversations/create.ts`
  No new planning behavior should be required, but update status type usage if TypeScript requires it.

- `src/server/bridge-client/index.ts`
  No required API change expected; use existing `spawnAgent`, `askAgent`, and `getAgent`.

- `src/app/home/types.ts`
  Add event stream types for planning review records and settings values if needed.

- `src/app/api/events/route.ts`
  Include latest planning review records and findings scoped to selected planning runs.

- `src/app/home/HomeUiStateManager.ts`
  Do not add review preferences here unless necessary. Prefer the dedicated `PlanningReviewPreferencesManager`.

- `src/app/home/HomeApp.tsx`
  Hydrate review preferences from initial settings and pass review mutation/control props only where needed.

- `src/app/home/useHomeMutations.ts`
  Add a small `startPlanningReview` mutation and a narrow immediate-save mutation for review preferences. Keep logic minimal because this file is already 861 lines.

- `src/components/PlanningArtifactsPanel.tsx`
  Replace the standalone review action with inline expansion point and include `PlanningReviewControls`.

- `src/components/component-state-managers.ts`
  Add only the local inline expansion manager if it must be shared. Preference state belongs in `PlanningReviewPreferencesManager`.

- `src/app/api/settings/route.ts`
  No schema change expected. Confirm it accepts non-secret review preference keys through the existing settings POST path.

- `shared/locales/en.json`
- `shared/locales/de.json`
- `shared/locales/es.json`
- `shared/locales/fr.json`
- `shared/locales/it.json`
- `shared/locales/ja.json`
- `shared/locales/ko.json`
- `shared/locales/pt.json`
- `shared/locales/zh-CN.json`
  Add all review UI, status, error, and aria-label strings.

Tests to update:

- `tests/db/schema.test.ts`
  Assert the new planning review tables exist.

- `tests/server/planning/refresh.test.ts`
  Assert review/revision statuses are handled without losing artifact state.

- `tests/api/events-route.test.ts`
  Assert planning review records/finding summaries are included and scoped correctly.

- Existing planning promotion tests if reviewed statuses affect promotion.

Candidate approval-gated browser journey:

- Start a planning conversation that produces a ready handoff.
- Expand inline review controls.
- Change reviewer to `Auto` and rounds to `2`.
- Reload and confirm options persist.
- Start review.
- Confirm progress appears inline.
- Confirm final state returns to ready/reviewed and promotion remains explicit.

Real integrations and data paths:

- Existing agent runtime bridge for spawning reviewer workers.
- Existing planning worker session for applying revisions.
- Existing settings table/API for preferences.
- Existing event stream for UI refresh.
- Existing planning artifact refresh and readiness checks.

`.gitignore` coverage:

- Existing `.gitignore` already covers `.next`, `node_modules`, sqlite runtime files, caches, and generated local artifacts. This plan adds no new generated directories requiring ignore changes.

File growth:

- `src/app/home/useHomeMutations.ts` is 861 lines. Keep added mutation code small; put preference validation in `PlanningReviewPreferencesManager` and server parsing in `review-preferences.ts`.
- No touched file is currently near 1200 lines, but avoid growing `PlanningArtifactsPanel.tsx` into a large compound component by creating `PlanningReviewControls.tsx`.

## Data Model

Add three tables.

`planning_review_runs`:

- `id text primary key`
- `run_id text not null references runs(id)`
- `status text not null`
- `agent_selection text not null`
- `resolved_worker_type text`
- `rounds_requested integer not null`
- `rounds_completed integer not null default 0`
- `started_at integer not null`
- `completed_at integer`
- `last_error text`
- `created_at integer not null`
- `updated_at integer not null`

`planning_review_rounds`:

- `id text primary key`
- `review_run_id text not null references planning_review_runs(id)`
- `run_id text not null references runs(id)`
- `round_number integer not null`
- `status text not null`
- `worker_id text`
- `resolved_worker_type text`
- `selection_reason text`
- `findings_summary text`
- `started_at integer`
- `completed_at integer`
- `last_error text`
- `created_at integer not null`
- `updated_at integer not null`

`planning_review_findings`:

- `id text primary key`
- `review_run_id text not null references planning_review_runs(id)`
- `round_id text not null references planning_review_rounds(id)`
- `run_id text not null references runs(id)`
- `severity text not null`
- `category text not null`
- `title text not null`
- `details text not null`
- `recommendation text not null`
- `source_path text`
- `created_at integer not null`

Recommended statuses:

- Review run: `running`, `awaiting_planner_revision`, `completed`, `failed`, `cancelled`.
- Round: `pending`, `reviewing`, `revising`, `completed`, `failed`, `skipped`.
- Finding severity: `critical`, `major`, `minor`, `note`.
- Finding category: `scope`, `architecture`, `sequencing`, `testing`, `ux`, `risk`, `observability`, `i18n`, `other`.

## Preference Model

Setting keys:

```ts
export const PLANNING_REVIEW_AGENT_SELECTION_SETTING = "PLANNING_REVIEW_AGENT_SELECTION";
export const PLANNING_REVIEW_ROUNDS_SETTING = "PLANNING_REVIEW_ROUNDS";
```

Allowed agent selection values:

- `auto`
- `same`
- `codex`
- `claude`
- `gemini`
- `opencode`

Round rules:

- Default: `1`.
- Minimum: `1`.
- Maximum: `5`.
- Invalid or missing values normalize to `1`.

Client behavior:

- Hydrate manager from settings at app bootstrap.
- Persist preference changes immediately through `/api/settings`.
- Optimistically update the manager, and roll back on save failure.
- The inline expanded/collapsed state does not persist.

## Auto Reviewer Selection

Inputs:

- Planning run allowed worker types.
- Planning worker type from the run's existing worker record.
- Requested selection value.
- Worker binary/auth availability.
- Recent quota/recovery signals.
- Existing worker statuses for the run and recent quota incidents.

Rules:

1. If selection is a concrete worker type, validate it is allowed and spawnable.
2. If selection is `same`, use the planning worker type if spawnable and not quota-blocked.
3. If selection is `auto`, prefer a healthy allowed worker type different from the planning worker.
4. If no different healthy worker exists, use the planning worker type.
5. If no healthy worker exists, fail before spawning and return an actionable error.
6. Re-evaluate before each round so quota/exhaustion changes between rounds are respected.

Quota-blocked detection should consider:

- Workers with `status = "cred-exhausted"`.
- Recent `recovery_incidents.kind = "quota_exhausted"` with unresolved or waiting status.
- Recent `credit_events.event_type = "exhausted"` where the event can be associated with that worker/provider.
- Reviewer spawn/ask errors parsed by existing quota reset helpers.

Persist the concrete selected worker type and selection reason on each review round.

## Review Prompt Contract

Reviewer prompt must:

- State that the worker is a read-only planning reviewer.
- Tell the worker not to edit files, not to run implementation, not to commit, not to promote.
- Include spec path/content and plan path/content.
- Include the original user intent from planning messages.
- Ask for structured JSON findings in a fenced block or a clearly parseable block.
- Require empty findings when the plan is good enough.
- Focus on plan quality: scope, architecture, sequencing, verification, i18n, observability, error handling, and risk.

Planner revision prompt must:

- Include reviewer findings and round number.
- Ask the original planner to revise the spec and/or plan files directly.
- Require the existing handoff block after revision.
- Preserve user constraints.
- Avoid expanding scope beyond findings unless required for correctness.

## Review Orchestration

`startPlanningReview(args)` should:

1. Load and validate the planning run.
2. Reject non-planning runs.
3. Reject missing or unready selected plan artifacts.
4. Parse preferences from request body or settings.
5. Create `planning_review_runs`.
6. Emit `planning_review_started`.
7. For each round:
   - Resolve reviewer worker type.
   - Create round record.
   - Spawn reviewer worker with the selected type.
   - Ask read-only review prompt.
   - Persist worker snapshot and reviewer output.
   - Parse structured findings.
   - Persist findings.
   - If no material findings, mark round completed and stop remaining rounds as skipped.
   - Ask the existing planning worker to revise using the findings.
   - Refresh planning artifacts.
   - Mark round completed.
8. Mark review run completed.
9. Return latest review summary.

Concurrency:

- If a review is already running for the planning run, return `409` with a translated UI error boundary displaying the backend detail.
- Starting a user message while review is running should either be blocked with a clear inline notice or queued only if existing planning busy behavior already supports it. For this milestone, block review start when the planner is already working and block planner user messages while `reviewing_plan`/`revising_plan` unless current busy queue logic safely supports them.

Planner resume:

- Use the same planning worker selection/resume path as `sendConversationMessage` where possible.
- If the planning worker session is missing, use existing resume behavior rather than spawning a second planner.

## API Contract

`POST /api/planning/[id]/review`

Request:

```json
{
  "agentSelection": "auto",
  "rounds": 1,
  "planPath": "/absolute/or/resolved/plan.md"
}
```

Response:

```json
{
  "ok": true,
  "reviewRunId": "uuid",
  "status": "running"
}
```

Error cases:

- `400`: invalid payload, no ready plan, selected plan not ready.
- `404`: planning run not found.
- `409`: review already running, planner busy, no healthy reviewer available.
- `500`: unexpected orchestration failure with persisted `last_error`.

The route should authenticate with `requireApiSession` and same-origin enforcement, matching nearby mutation routes.

## UI Design

In `PlanningArtifactsPanel`, when the selected plan is ready, show:

- `Continue revising`
- `Improve plan with review agents`
- `Start implementation from selected plan`

Clicking `Improve plan with review agents` expands inline controls directly under the actions:

- Agent selector as a compact segmented/select control.
- Rounds stepper.
- Compact summary of Auto behavior when selected.
- Latest review status/finding summary if present.
- One primary button at the bottom: `Start review`.

No dialog. No extra confirmation.

Collapsed state:

- The review action row can show a short remembered summary such as `Auto · 1 round`.
- The user must still expand the inline section before starting review unless a separate one-click start affordance is intentionally added. For this milestone, keep `Start review` inside the expanded section to satisfy the requested structure.

During review:

- Disable review options while a review is running.
- Disable promotion only while planner revision is actively mutating artifacts. If review has failed but the original plan is still ready, promotion should remain possible.
- Show current phase: selecting reviewer, reviewing, revising plan, refreshing artifacts, completed, failed.

Accessibility:

- All controls need translated `aria-label`s.
- The expanded section should be keyboard reachable and not trap focus.
- Status updates should use polite live-region semantics if existing UI patterns support them.

## i18n Keys

Add keys under `planning.review.*` in every locale file. Include at least:

- `planning.review.expand`
- `planning.review.summary`
- `planning.review.agentLabel`
- `planning.review.agent.auto`
- `planning.review.agent.same`
- `planning.review.agent.codex`
- `planning.review.agent.claude`
- `planning.review.agent.gemini`
- `planning.review.agent.opencode`
- `planning.review.roundsLabel`
- `planning.review.roundsValue`
- `planning.review.autoHelp`
- `planning.review.start`
- `planning.review.starting`
- `planning.review.reviewing`
- `planning.review.revising`
- `planning.review.completed`
- `planning.review.failed`
- `planning.review.noFindings`
- `planning.review.findingsSummary`
- `planning.review.persistError`
- `planning.review.startError`
- `planning.review.selectionReason`

Use English source text for all locales if no translation workflow is available, matching current project practice for newly added keys.

## Implementation Tasks

- [ ] **1. Add schema and database DDL for planning review records**
  - Modify `src/server/db/schema.ts`.
  - Modify `src/server/db/index.ts`.
  - Add `planningReviewRuns`, `planningReviewRounds`, and `planningReviewFindings`.
  - Add tests in `tests/db/schema.test.ts`.
  - Verification: `pnpm test -- tests/db/schema.test.ts`.

- [ ] **2. Add review preference parsing**
  - Create `src/server/planning/review-preferences.ts`.
  - Support setting keys, valid agent selections, defaults, round clamping, and request-body parsing.
  - Create `tests/server/planning/review-preferences.test.ts`.
  - Verification: `pnpm test -- tests/server/planning/review-preferences.test.ts`.

- [ ] **3. Add Auto reviewer selection**
  - Create `src/server/planning/review-agent-selection.ts`.
  - Reuse `parseAllowedWorkerTypes`, `normalizeWorkerType`, `SUPPORTED_WORKER_TYPES`, and spawnability checks.
  - Account for planner worker type and quota-blocking signals.
  - Persist selection reason shape for event details.
  - Create `tests/server/planning/review-agent-selection.test.ts`.
  - Verification: `pnpm test -- tests/server/planning/review-agent-selection.test.ts`.

- [ ] **4. Add reviewer and planner revision prompts**
  - Create `src/server/planning/review-prompts.ts`.
  - Include read-only reviewer prompt builder and planner revision prompt builder.
  - Add tests for required guardrail phrases and included plan/spec context.
  - Verification: `pnpm test -- tests/server/planning/review-prompts.test.ts`.

- [ ] **5. Implement review orchestration**
  - Create `src/server/planning/review.ts`.
  - Validate run mode and selected handoff readiness.
  - Create review records and execution events.
  - Spawn reviewer workers and ask read-only prompts.
  - Parse findings.
  - Ask original planner to revise.
  - Refresh artifacts after each planner revision.
  - Handle no-findings early stop.
  - Persist failures without losing the selected ready plan.
  - Create `tests/server/planning/review.test.ts`.
  - Verification: `pnpm test -- tests/server/planning/review.test.ts`.

- [ ] **6. Add review API route**
  - Create `src/app/api/planning/[id]/review/route.ts`.
  - Authenticate with same-origin enforcement.
  - Parse `{ agentSelection, rounds, planPath }`.
  - Start review and return review run id/status.
  - Create `tests/api/planning-review-route.test.ts`.
  - Verification: `pnpm test -- tests/api/planning-review-route.test.ts`.

- [ ] **7. Stream review state to the frontend**
  - Modify `src/app/api/events/route.ts` to include review runs, rounds, and finding summaries scoped to selected runs.
  - Modify `src/app/home/types.ts`.
  - Update event stream snapshot/cache helpers if their shape validation requires it.
  - Update `tests/api/events-route.test.ts`.
  - Verification: `pnpm test -- tests/api/events-route.test.ts tests/app/event-stream-state-manager.test.ts`.

- [ ] **8. Add client review preferences manager**
  - Create `src/app/home/PlanningReviewPreferencesManager.ts`.
  - Hydrate from `settingsQuery` data in `HomeApp`.
  - Expose `agentSelection` and `rounds` with validation.
  - Persist changes immediately through a narrow mutation that calls `/api/settings`.
  - Keep preference logic out of `PlanningArtifactsPanel`.
  - Verification: `pnpm test -- tests/app/settings-draft-manager.test.ts` plus any new manager test.

- [ ] **9. Add inline review controls**
  - Create `src/components/PlanningReviewControls.tsx`.
  - Modify `src/components/PlanningArtifactsPanel.tsx` to render the inline expandable section.
  - Wire option changes to `PlanningReviewPreferencesManager`.
  - Wire `Start review` to the new mutation.
  - Keep `Continue revising` and `Start implementation from selected plan` visible and explicit.
  - Verification: run component/source tests and TypeScript.

- [ ] **10. Add review mutation wiring**
  - Modify `src/app/home/useHomeMutations.ts` with a small `startPlanningReview` mutation.
  - Pass it through `HomeApp` to `ConversationMain`/`PlanningArtifactsPanel` only as needed.
  - Avoid adding large preference parsing logic to `useHomeMutations.ts`.
  - Verification: `pnpm test -- tests/app/busy-message-behavior.test.ts tests/api/planning-review-route.test.ts`.

- [ ] **11. Add all locale strings**
  - Update every file in `shared/locales/*.json`.
  - Ensure all visible labels, aria labels, status text, errors, and button text use `t()`.
  - Verification: `rg -n \"Improve plan|Start review|review agents|Round|Rounds|Auto\" src/components src/app` should not find hardcoded user-facing JSX copy.

- [ ] **12. Update planning status handling**
  - Modify `src/server/planning/status.ts`.
  - Modify `src/server/planning/refresh.ts` so review statuses do not collapse incorrectly mid-review.
  - Modify promotion checks only if reviewed statuses need to remain promotable.
  - Update `tests/server/planning/refresh.test.ts` and `tests/api/planning-promote-route.test.ts`.
  - Verification: `pnpm test -- tests/server/planning/refresh.test.ts tests/api/planning-promote-route.test.ts`.

- [ ] **13. Add end-to-end source verification**
  - Run focused tests from prior steps.
  - Run `pnpm test -- tests/server/planning tests/api/planning-promote-route.test.ts tests/api/planning-review-route.test.ts tests/db/schema.test.ts`.
  - Run `pnpm tsc --noEmit` or the repository's existing typecheck command from `package.json`.
  - Run lint if available.

- [ ] **14. Approval-gated browser journey**
  - With user approval, use the already-running app at `http://localhost:3035`.
  - Verify inline controls, preference persistence across reload, review start, progress visibility, and promotion still being explicit.
  - Do not start a second server if one is already running.

## Acceptance Criteria

- Ready planning handoffs show an inline `Improve plan with review agents` affordance.
- Clicking the affordance expands inline options, not a dialog.
- Inline options include reviewer agent selection and round count.
- Preferences persist across reloads and future planning conversations.
- `Auto` prefers a healthy different agent from the planner, then falls back to the planner when needed.
- `Auto` blocks with a clear inline error when no healthy reviewer is available.
- Review workers are read-only and do not edit planning artifacts.
- The original planning worker applies review findings to spec/plan files.
- Review progress and final status are visible in the planning handoff area.
- Promotion remains explicit and still validates plan readiness.
- Review failure does not destroy or hide a previously ready plan.
- All new frontend strings use locale resources and `t()`.
- Deterministic tests cover preferences, Auto selection, API behavior, orchestration, event streaming, and promotion compatibility.

## Self-Review

- Every requirement from the discussion maps to a task.
- The plan uses the existing planning handoff, artifact refresh, settings, event stream, and agent bridge architecture.
- No branch or worktree is assumed.
- The final checklist covers the complete milestone.
- Future product direction is context only.
- No final behavior depends on mocks, placeholders, canned output, or fake review completion.
