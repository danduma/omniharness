# Automatic Session Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add configurable automatic cleanup for old OmniHarness sessions, triggered by session age and/or per-project disk usage, with safe deletion semantics, settings UI controls, and observable lifecycle events.

**Architecture:** Introduce a server-owned cleanup policy and cleanup service that reads persisted settings, computes eligible terminal sessions per project, measures project-attributed OmniHarness session storage, and deletes selected sessions through the same dependency-aware path used by `DELETE /api/runs/:id`. Automatic cleanup runs opportunistically on startup and after session lifecycle activity, protected by an in-process cleanup lock and durable `lastRunAt` metadata so it cannot churn hot paths or race itself.

**Tech Stack:** Next.js App Router and shared runtime HTTP handlers, React manager-backed settings UI, Drizzle SQLite schema, Node `fs/promises`, existing named SSE events, Vitest API/unit tests, lifecycle HTTP/SSE scenarios.

**North Star Product:** OmniHarness keeps long-lived project history useful without letting old session artifacts quietly consume disk. Users can trust that cleanup is configurable, conservative, observable, and reversible in policy even though deletion itself is permanent.

**Current Milestone:** Deliver configurable automatic deletion of terminal sessions older than a configured age and/or oldest terminal sessions needed to bring a project under a configured storage threshold.

**Future Product Direction:** Later product layers can add cleanup previews, one-click manual cleanup, per-project overrides, archival/export before deletion, and richer storage charts. Those are not required for this milestone unless the user explicitly expands scope.

**Final Functionality Standard:** The implementation is complete when a user can configure cleanup in Settings, the server persists and enforces the policy automatically, only eligible non-active sessions are deleted, all dependent DB rows and persisted artifacts are removed, named events explain every cleanup decision/failure, and deterministic tests prove both trigger modes and failure handling.

---

## Scope Notes

- Do not create a branch or worktree.
- Do not add server fault-injection paths; lifecycle/chaos behavior belongs in tests.
- Do not add a parallel worker-output or transcript persistence layer.
- Use existing i18n resources for every new user-facing frontend string.
- Default policy values:
  - cleanup mode enabled by default for age-based cleanup: sessions older than `15` days.
  - storage threshold default: `50` MB per project.
  - users can set cleanup to `never`.
- Interpret "old sessions" as terminal conversations only. Never automatically delete sessions whose run status is active, awaiting user input, recovering, or otherwise non-terminal.
- Archived terminal sessions are eligible for automatic cleanup. In this milestone, archive is treated as a visibility/organization state, not a retention hold. Users who want guaranteed retention can set cleanup mode to `never`.
- Interpret "time since last session" as `runs.updatedAt` for the candidate session. `createdAt` is a tie-breaker only. This keeps a recently touched old session from being removed solely because it was created long ago.
- Interpret "total storage taken by OmniHarness on disk per project" as all measured, project-attributed OmniHarness session storage, while only terminal sessions are eligible for deletion:
  - `<projectPath>/.omniharness/run-data/<runId>/`
  - legacy global run artifacts for runs whose `runs.projectPath` matches that project
  - repo-local `.omniharness/agent-runtime-output/<runId>-*.jsonl`
  - ad-hoc plan files linked to candidate runs
  - known artifact stream files discoverable through `artifact_streams`
  SQLite database page usage is not attributed per project in this milestone; rows are deleted and SQLite reuse/vacuum behavior is left to the database.
- If a project remains over the storage threshold after all eligible terminal sessions are deleted, cleanup emits `session.cleanup.skipped` with reason `only_active_or_ineligible_sessions_remain` and does not delete active sessions.

## User Stories

- As a user with many old sessions, I can leave cleanup enabled so sessions older than 15 days are removed without manual babysitting.
- As a user who wants full history retention, I can choose "Never" and OmniHarness will not automatically delete sessions.
- As a user working in a project with large artifacts, I can set a per-project MB limit and OmniHarness will delete the oldest eligible terminal sessions for that project until measured storage is under the limit or only active/ineligible sessions remain.
- As a user debugging what happened, I can inspect named events and logs to see when cleanup ran, which sessions were deleted, which were skipped, and why failures surfaced.

## File Map

### Files To Create

- `src/server/session-cleanup/policy.ts`
  - Owns cleanup policy types, defaults, JSON parsing, clamping, and serialization.
  - Exports setting key, defaults `{ mode: "age_and_storage", maxAgeDays: 15, maxProjectStorageMb: 50 }`, and helpers for disabled policy.

- `src/server/session-cleanup/storage.ts`
  - Computes per-run and per-project measured bytes from known OmniHarness artifact locations.
  - Uses bounded filesystem traversal and ignores missing paths.
  - Returns provenance for tests and diagnostics, not just a byte count.

- `src/server/session-cleanup/delete-run.ts`
  - Extracts the dependency-aware deletion body from `handleRunDeleteRequest` into a reusable function, for example `deleteRunFully({ runId, actor, reason })`.
  - Preserves current manual delete behavior while allowing automatic cleanup to call the same code path.

- `src/server/session-cleanup/service.ts`
  - Coordinates cleanup scans, candidate selection, in-process locking, setting reads, durable throttle metadata, event emission, and deletion execution.
  - Exposes `runSessionCleanup({ trigger, projectPath?, now? })`.

- `src/server/session-cleanup/scheduler.ts`
  - Owns `scheduleSessionCleanup({ trigger, runId?, projectPath? })`.
  - Debounces/throttles opportunistic production triggers and calls the service asynchronously.
  - This is the only module lifecycle code calls; cleanup logic must not be scattered through completion paths.

- `tests/server/session-cleanup/policy.test.ts`
  - Unit coverage for defaults, disabled policy, malformed JSON, clamping, and serialization.

- `tests/server/session-cleanup/storage.test.ts`
  - Unit coverage for byte accounting across project-local artifacts, legacy artifacts, runtime-output JSONL files, missing paths, and ad-hoc plan files.

- `tests/server/session-cleanup/service.test.ts`
  - Server-side tests for age cleanup, storage cleanup, active-run protection, lock behavior, throttle behavior, event emissions, and failure events.

- `tests/lifecycle/scenarios/session-cleanup.test.ts`
  - HTTP/SSE lifecycle scenario proving automatic cleanup emits an event transcript and removes persisted rows/artifacts without browser automation.
  - Must exercise a production trigger path, either startup or an actual terminal run transition. Direct service calls are allowed in unit tests, not as the only lifecycle proof.

### Files To Modify

- `src/app/home/constants.ts`
  - Add `SESSION_CLEANUP_POLICY` to `DEFAULT_SERVER_SETTINGS`.

- `src/app/home/types.ts`
  - Add frontend-facing cleanup policy shape if settings panels already centralize typed settings there.

- `src/app/home/SettingsDraftManager.ts`
  - No new source of truth; only ensure the new default setting participates in normalization through `DEFAULT_SERVER_SETTINGS`.

- `src/components/settings/RuntimeSettingsPanel.tsx`
  - Add compact cleanup controls under the existing Runtime tab.
  - Use `t()` and `useI18nSnapshot()`.
  - Keep controls dense: enable/never segmented control or select, number inputs for days and MB, optional checkbox/toggle for storage trigger if the policy shape needs it.

- `shared/locales/en.json` and all other files in `shared/locales/*.json`
  - Add all new user-facing labels, aria labels, option labels, and validation copy.

- `src/runtime/http/routes/settings.ts`
  - Validate/sanitize `SESSION_CLEANUP_POLICY` on POST before persistence.
  - Avoid storing malformed or unbounded values.

- `src/server/settings/read.ts`
  - Ensure server-side readers receive normalized cleanup defaults when the setting is absent.

- `src/runtime/http/routes/runs.ts`
  - Replace duplicated manual delete internals with the reusable `deleteRunFully` helper.
  - Preserve `DELETE /api/runs/:id` response shape and existing named events.

- `src/server/events/named-events.ts`
  - Add cleanup events and error code:
    - `session.cleanup.started`
    - `session.cleanup.skipped`
    - `session.cleanup.deleted`
    - `session.cleanup.finished`
    - `session.cleanup.failed`
    - `error.surfaced` code `session.cleanup.failed`
  - Include `trigger`, `runId`, `projectPath`, `reason`, byte counts, thresholds, and selected count where applicable.

- `src/runtime/bootstrap.ts`, `src/runtime/index.ts`, or the common runtime startup path
  - Invoke cleanup after runtime/server startup without blocking bootstrap responses.
  - Use `scheduleSessionCleanup({ trigger: "startup" })` rather than calling the service directly from route/bootstrap code.

- Conversation lifecycle entry points after terminal transitions
  - Add narrowly scoped calls to `scheduleSessionCleanup({ trigger: "run_terminal", runId, projectPath })` only after a run reaches a terminal status.
  - First look for an existing single terminal-status transition helper. If none exists, add the scheduler boundary and wire only proven terminal transition points surfaced by tests.
  - Manual delete/archive must not run cleanup inline; at most schedule opportunistically after the response path has completed.

- `tests/api/settings-route.test.ts`
  - Add settings validation and default hydration coverage.

- `tests/app/settings-draft-manager.test.ts`
  - Add coverage that cleanup defaults hydrate and dirty/save payload behavior remains scoped to edited keys.

- `tests/ui/settings-dialog.test.ts`
  - Add source/DOM-level assertions that the Runtime settings cleanup controls use translation keys and draft manager payloads.

- `tests/api/run-route.test.ts`
  - Add or update tests that manual delete still removes dependent records and artifacts through the extracted helper.

- `tests/server/events/*.test.ts` or existing event tests
  - Add named event ring assertions for cleanup started/deleted/finished/failed.

### Tests To Update Or Add

- `pnpm test -- tests/server/session-cleanup/policy.test.ts`
- `pnpm test -- tests/server/session-cleanup/storage.test.ts`
- `pnpm test -- tests/server/session-cleanup/service.test.ts`
- `pnpm test -- tests/api/settings-route.test.ts tests/app/settings-draft-manager.test.ts tests/ui/settings-dialog.test.ts`
- `pnpm test -- tests/api/run-route.test.ts tests/server/events/conversation-delete-events.test.ts`
- `pnpm test:lifecycle -- tests/lifecycle/scenarios/session-cleanup.test.ts` if the lifecycle runner supports file targeting; otherwise run `pnpm test:lifecycle`.

### Candidate Agentic User Journey Test

Running this requires explicit user approval.

- Mission: verify a user can open Settings, set cleanup to "Never", save, reopen, switch to automatic cleanup with age and storage thresholds, save again, and see the values persist.
- Entry point: already-running app at `http://localhost:3035`.
- Expected proof: Runtime settings controls render with no hardcoded strings, values persist through close/reopen, and no unrelated settings are dirtied.

## State, Persistence, And Invariants

- Owner:
  - Cleanup policy is server-owned in the `settings` table under `SESSION_CLEANUP_POLICY`.
  - Settings draft state is owned by `SettingsDraftManager`.
  - Cleanup execution state is server process-owned with durable `lastRunAt` metadata stored as an internal setting key such as `__SESSION_CLEANUP_LAST_RUN_AT`.
  - Cleanup decisions are observable through named events.

- Token:
  - Each cleanup pass has a generated `cleanupId`.
  - Each deletion operation carries `cleanupId`, `trigger`, and `runId`.
  - Async cleanup results must check the active in-process cleanup lock before emitting terminal events.

- Provenance:
  - Settings payloads are server-authoritative after `GET /api/settings`.
  - Draft edits are client-local until saved.
  - Storage byte counts are best-effort filesystem measurements with explicit provenance paths.

- Completeness:
  - A cleanup scan is complete for the projects it enumerates at scan start.
  - A scan must not delete sessions created or updated after the scan cutoff.
  - Partial filesystem errors do not authorize deleting extra runs; they emit `session.cleanup.failed`, and only per-run failures that have a `runId` also emit `error.surfaced`.

- Ordering:
  - Age cleanup selects sessions with `updatedAt < cutoff`.
  - Storage cleanup measures all known per-project OmniHarness session bytes, then deletes oldest eligible terminal sessions first, ordered by `(updatedAt asc, createdAt asc, id asc)`, until measured project bytes are under threshold or no eligible terminal sessions remain.
  - Named events rely on existing monotonic event ids.

- State machine:
  - Policy modes: `never`, `age`, `storage`, `age_and_storage`.
  - Cleanup pass states: `idle -> scanning -> deleting -> finished` or `failed`.
  - Candidate states: `eligible`, `skipped_active`, `skipped_not_old_enough`, `skipped_unattributed_project`, `selected_age`, `selected_storage`, `deleted`, `failed`.

- Hot-path rule:
  - Runtime bootstrap and session completion must not wait for filesystem traversal or deletes.
  - Cleanup is scheduled asynchronously with a throttle, and settings GET remains a bounded DB read.

- Failure surfacing:
  - Per-run deletion failures emit both `session.cleanup.failed` and `error.surfaced` with code `session.cleanup.failed` and `runId`.
  - Project/global scan failures that cannot be tied to a specific run emit `session.cleanup.failed` with `cleanupId`, `trigger`, `projectPath` when known, and reason details, but do not emit `error.surfaced` unless the event can include at least one of `runId`/`workerId`/`conversationId`.
  - This preserves the repo rule that `error.surfaced` includes a stable code, surface, and at least one concrete user object id.

## Cleanup Algorithm

1. Load and sanitize `SESSION_CLEANUP_POLICY`.
2. If mode is `never`, emit `session.cleanup.skipped` for explicit/manual triggers and return without scanning.
3. Acquire an in-process cleanup lock. If a pass is already running, emit `session.cleanup.skipped` with reason `already_running`.
4. Check durable throttle metadata so opportunistic triggers do not run more often than the configured cadence. The initial cadence can be fixed at once per 24 hours for automatic triggers; manual/test calls can bypass it.
5. Query runs with their plan IDs and project paths. Exclude non-terminal statuses. Treat archived terminal runs as eligible because archive is not a retention hold in this milestone.
6. Build age candidates where `updatedAt` is older than `maxAgeDays`.
7. Measure all known per-project OmniHarness session bytes for runs in each project.
8. Build storage candidates by project where total measured project bytes exceed `maxProjectStorageMb`, selecting oldest eligible terminal sessions until projected bytes fall below threshold or no eligible terminal sessions remain.
9. Union age and storage candidates by `runId`, preserving reasons.
10. For each selected run:
    - re-read the run before deletion,
    - verify it is still terminal and still older/eligible,
    - call the shared full-delete helper,
    - emit `session.cleanup.deleted` with reason and estimated reclaimed bytes.
11. If a project is still over threshold because remaining bytes belong only to active/non-terminal/ineligible sessions, emit `session.cleanup.skipped` with reason `only_active_or_ineligible_sessions_remain`.
12. Emit `session.cleanup.finished` with selected/deleted/skipped/error counts and remaining over-threshold project count.
13. Persist `__SESSION_CLEANUP_LAST_RUN_AT` only after the pass reaches a terminal state.

## Detailed Task Checklist

- [ ] Define cleanup policy types and defaults in `src/server/session-cleanup/policy.ts`.
  - Include `SESSION_CLEANUP_POLICY_SETTING`, `DEFAULT_SESSION_CLEANUP_POLICY`, `parseSessionCleanupPolicy`, `serializeSessionCleanupPolicy`, and `sanitizeSessionCleanupPolicy`.
  - Clamp days and MB to safe ranges, for example days `1..3650`, MB `1..1048576`.
  - Treat malformed JSON as defaults for reads, but reject/sanitize malformed POST values before writing.
  - Verification: `pnpm test -- tests/server/session-cleanup/policy.test.ts`.

- [ ] Add policy defaults to `src/app/home/constants.ts` and settings draft coverage.
  - Store the default as JSON under `SESSION_CLEANUP_POLICY`.
  - Confirm `SettingsDraftManager` hydration includes the value without special state variables.
  - Verification: `pnpm test -- tests/app/settings-draft-manager.test.ts`.

- [ ] Add POST validation for cleanup policy in `src/runtime/http/routes/settings.ts`.
  - Validate only the changed setting key.
  - Persist sanitized JSON, not arbitrary user input.
  - Do not expose internal `__SESSION_CLEANUP_LAST_RUN_AT` through GET.
  - Verification: `pnpm test -- tests/api/settings-route.test.ts`.

- [ ] Build the storage accounting module in `src/server/session-cleanup/storage.ts`.
  - Use `fs.stat` and bounded recursive traversal for directories.
  - Account for project-local run data, legacy global run data, runtime-output archives, artifact stream files, and ad-hoc plan files.
  - Ignore `ENOENT`; return structured errors for permission and traversal failures.
  - Verification: `pnpm test -- tests/server/session-cleanup/storage.test.ts`.

- [ ] Extract full run deletion into `src/server/session-cleanup/delete-run.ts`.
  - Move the dependency deletion sequence from `src/runtime/http/routes/runs.ts` without changing manual delete behavior.
  - Keep worker cancellation best-effort but add a named event for cleanup-owned cancellation failures if user-relevant.
  - Preserve ad-hoc plan file cleanup and `cleanupRunArtifacts`.
  - Preserve the generic `conversation.deleted` event for every successful full deletion, including automatic cleanup. Emit cleanup-specific events around that shared deletion event rather than replacing it.
  - Verification: `pnpm test -- tests/api/run-route.test.ts tests/server/events/conversation-delete-events.test.ts`.

- [ ] Add cleanup named events to `src/server/events/named-events.ts`.
  - Add typed event payloads and `SurfacedErrorCode` entry `session.cleanup.failed`.
  - Events must include enough context to debug which trigger selected which run.
  - Verification: update event tests to assert ring buffer payloads.

- [ ] Implement cleanup coordination in `src/server/session-cleanup/service.ts`.
  - Add in-process lock, generated `cleanupId`, durable throttle read/write, and scan execution.
  - Re-check eligibility immediately before deleting each run.
  - Emit started/skipped/deleted/finished/failed events through `emitNamedEvent`.
  - Emit `error.surfaced` only for per-run cleanup failures with a `runId`; project/global failures stay as typed cleanup events unless they can satisfy the existing `error.surfaced` id contract.
  - Emit `session.cleanup.skipped` when a project remains over threshold because only active or otherwise ineligible sessions remain.
  - Verification: `pnpm test -- tests/server/session-cleanup/service.test.ts`.

- [ ] Add and wire `src/server/session-cleanup/scheduler.ts`.
  - Startup: schedule a non-blocking cleanup pass after runtime initialization through the scheduler.
  - Lifecycle: schedule after a run reaches a terminal status, using the scheduler as the single boundary.
  - Manual delete/archive: do not run inline cleanup; at most schedule opportunistically after response.
  - Verification: service/scheduler tests with fake timers/deferred promises; lifecycle scenario that exercises a production trigger path, not a direct service shortcut.

- [ ] Add Runtime settings UI controls in `src/components/settings/RuntimeSettingsPanel.tsx`.
  - Parse policy JSON from `settings.SESSION_CLEANUP_POLICY`.
  - Render compact controls using existing UI primitives and native number inputs.
  - Call `setSetting("SESSION_CLEANUP_POLICY", serializedPolicy)` from event handlers.
  - Disable numeric inputs when mode is `never`.
  - Use stable dimensions so labels and inputs do not shift the settings dialog.
  - Verification: `pnpm test -- tests/ui/settings-dialog.test.ts`.

- [ ] Add all i18n keys to every `shared/locales/*.json` file.
  - Include tab/panel labels, mode options, number input labels, aria labels, validation text, and status/error copy if surfaced in UI.
  - Use stable keys such as `settings.runtime.cleanup.mode`, `settings.runtime.cleanup.maxAgeDays`, `settings.runtime.cleanup.maxProjectStorageMb`.
  - Verification: run existing i18n/resource tests if present; otherwise add a small key parity assertion.

- [ ] Add lifecycle cleanup scenario in `tests/lifecycle/scenarios/session-cleanup.test.ts`.
  - Seed terminal sessions and artifacts for one project.
  - Set policy through `/api/settings`.
  - Trigger cleanup through startup hook or an actual terminal run transition. Do not use a direct service call as the lifecycle proof.
  - Subscribe to `/api/events` and assert `session.cleanup.started`, `session.cleanup.deleted`, and `session.cleanup.finished`.
  - Assert deleted rows/artifacts are gone and active sessions remain.
  - Verification: `pnpm test:lifecycle`.

- [ ] Run focused and regression verification.
  - `pnpm test -- tests/server/session-cleanup/policy.test.ts tests/server/session-cleanup/storage.test.ts tests/server/session-cleanup/service.test.ts`
  - `pnpm test -- tests/api/settings-route.test.ts tests/app/settings-draft-manager.test.ts tests/ui/settings-dialog.test.ts`
  - `pnpm test -- tests/api/run-route.test.ts tests/server/events/conversation-delete-events.test.ts`
  - `pnpm test:lifecycle`

## Acceptance Criteria

- Settings exposes a persisted cleanup policy with `Never`, age-based cleanup, storage-based cleanup, and combined age/storage cleanup.
- Defaults are exactly 15 days and 50 MB.
- Automatic cleanup never deletes non-terminal sessions.
- Archived terminal sessions are eligible for automatic cleanup; archive is not treated as a retention hold.
- Age cleanup deletes terminal sessions whose `updatedAt` is older than the configured day threshold.
- Storage cleanup operates per project, measures all known OmniHarness session storage for the project, and deletes oldest eligible terminal sessions until measured storage is under the configured MB threshold or no eligible terminal sessions remain.
- If storage remains over threshold because active/non-terminal sessions are consuming space, cleanup emits a typed skipped event and leaves those sessions intact.
- Manual conversation delete still works and still emits existing delete/failure events.
- Automatic cleanup preserves the existing `conversation.deleted` event in addition to cleanup-specific events.
- Automatic cleanup emits typed named events for start, skip, per-run delete, finish, and failure.
- Per-run user-relevant cleanup failures emit `error.surfaced` with code `session.cleanup.failed` and `runId`; project/global scan failures emit typed cleanup events unless they can satisfy the existing surfaced-error id contract.
- All frontend strings are translated through `shared/locales/*.json` and rendered with `t()`.
- Focused tests and lifecycle scenario pass.

## Risks And Mitigations

- Risk: accidental deletion of live work.
  - Mitigation: terminal-status filter, pre-delete re-read, and no deletion of active/awaiting/recovering runs.

- Risk: cleanup duplicates manual delete logic and drifts.
  - Mitigation: extract one reusable full-delete helper used by both manual and automatic cleanup.

- Risk: filesystem traversal blocks hot paths.
  - Mitigation: asynchronous scheduling, in-process lock, durable throttle, bounded traversal, and no inline cleanup inside response-critical routes.

- Risk: storage accounting surprises users.
  - Mitigation: scope the metric to known OmniHarness session artifacts, make active-session leftovers explicit, and include provenance in service results/tests.

- Risk: named event union grows without UI consumption.
  - Mitigation: events are still required for lifecycle observability and testability; UI toast consumption is limited to `error.surfaced`.

## Self-Review

- Every user requirement maps to a task: settings, never mode, age threshold, storage threshold, defaults, automatic triggers, and cleanup behavior.
- No branch, worktree, file deletion, fake component, placeholder, or mock behavior is required as final functionality.
- The plan uses existing settings, deletion, artifact cleanup, i18n, and named event patterns.
- Client/server ownership and race-sensitive cleanup states are explicit.
- The final checklist has no deferred requirements for the requested milestone.
