# Append-Only Artifact Storage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move bulky append-only conversation/runtime records out of SQLite into the existing active-JSONL plus inactive-gzip artifact storage model, while keeping SQLite as the fast metadata/index layer.

**Architecture:** Reuse the worker stream persistence pattern from `src/server/workers/output-store.ts`: active streams append to per-run JSONL files under each run project's `.omniharness` directory, inactive streams compact to `.jsonl.gz`, and readers support tail/cursor reads without loading whole history. SQLite keeps durable identity, ownership, project-root pointers, cursors, counts, status summaries, and small queryable metadata; large bodies/details move to project-local artifact streams.

**Tech Stack:** TypeScript, Next.js runtime route handlers, Drizzle/libsql SQLite, JSONL artifact files, gzip compaction, existing lifecycle tests via Vitest and HTTP/SSE.

**North Star Product:** Conversation history should feel instant and durable even with thousands of events, large review records, long-running workers, and restarted servers.

**Current Milestone:** Migrate execution events, supervisor interventions, and planning review finding details to artifact-backed append-only streams without losing existing API behavior or lifecycle observability.

**Future Product Direction:** The same artifact framework can later absorb other append-heavy logs, trace payloads, and archival transcripts. This is context only; the checklist below delivers the current milestone.

**Final Functionality Standard:** Existing UI/API surfaces continue to render the same records, persisted historical data is backfilled safely, hot snapshot endpoints stay bounded and fast, and lifecycle/delete/compaction tests prove artifacts remain consistent with SQLite metadata.

---

## Simplification Principles

- One append-only artifact engine, many typed adapters. Do not clone worker output-store mechanics into event/review stores.
- One selected-run snapshot assembly path. `src/runtime/http/routes/events.ts` and `src/server/events/persisted-snapshot.ts` should share lower-level readers instead of diverging.
- One serializer per record family. If a serializer is needed by both hot snapshots and mutation routes, put the lightweight serializer in a dependency-light module and keep mutation/control-plane code out of hot imports.
- One compaction policy. Worker streams, event streams, intervention streams, and review streams should all use the same inactive-age/status rules unless a test proves they need different treatment.
- One delete/artifact cleanup path. Conversation deletion should call a shared artifact cleanup helper rather than knowing every file suffix and stream kind itself.
- Prefer fewer SQLite tables if they preserve clarity. Use a generic `artifact_streams` table plus existing domain summary rows before adding stream-kind-specific metadata tables.
- Remove compatibility once migration is proven. Legacy body columns may stay for one migration window, but the plan must include tests that prove they are no longer read for newly written data.
- Project-local by default. New JSONL/gzip artifacts must live under the selected project's `.omniharness` directory, not the app's global data directory. Global `run-data` remains a legacy read/migration source only.

## Scope

In scope:
- `execution_events.details` payloads and event bodies needed for run timelines/logs.
- `supervisor_interventions.prompt` and `summary` payloads.
- Planning review finding `details` and `recommendation` bodies, plus any large review artifacts that are only displayed after selecting a run.
- Hot read paths used by `/api/events?snapshot=1&persisted=1`, `/api/events`, lifecycle tests, and selected-run UI.
- Backfill from existing SQLite rows into artifact streams.
- Move existing worker/event artifacts from global app `run-data` into the owning project's `.omniharness` tree.
- Delete/archive cleanup using existing conversation deletion and worker artifact conventions.

Out of scope:
- Moving core `runs`, `workers`, `messages`, `queued_conversation_messages`, `conversation_read_markers`, auth/session/settings/account tables, or small planner status rows out of SQLite.
- Changing user-visible timeline semantics.
- Creating a new database, branch, worktree, or persistence framework.
- Writing new artifacts to global app `run-data`, except as a temporary legacy fallback during migration.

## File Map

Create:
- `src/server/artifacts/append-only-store.ts`: shared append/tail/read/latest/compact primitives modeled on worker output storage, parameterized by stream kind.
- `src/server/artifacts/stream-types.ts`: common stream record envelopes, cursors, and stream-kind unions.
- `src/server/artifacts/project-root.ts`: resolves and validates the project-local artifact root for a run.
- `src/server/artifacts/cleanup.ts`: shared run-scoped artifact deletion/archival cleanup helper used by scripts and server routes.
- `src/server/events/execution-event-store.ts`: execution-event write/read adapter over artifact streams plus SQLite summary rows.
- `src/server/supervisor/intervention-store.ts`: supervisor-intervention write/read adapter.
- `src/server/planning/review-artifact-store.ts`: planning-review finding/detail artifact adapter.
- `scripts/backfill-append-only-artifacts.ts`: idempotent migration from existing SQLite body columns to artifact streams.
- `tests/server/artifacts/append-only-store.test.ts`: unit coverage for append, tail, gzip read, corruption boundaries, latest cursor, and delete behavior.
- `tests/server/events/execution-event-store.test.ts`: adapter and backfill behavior.
- `tests/lifecycle/scenarios/artifact-backed-snapshot.test.ts`: HTTP/SSE lifecycle coverage for migrated records.

Modify:
- `src/server/workers/output-store.ts`: extract or delegate shared JSONL/gzip mechanics where practical; keep worker-specific behavior intact.
- `src/server/workers/stream-writer.ts`: call the generic artifact append engine through the worker adapter if extraction proves clean; otherwise leave as a compatibility wrapper over the shared primitives.
- `src/server/app-root.ts`: keep app-global paths for SQLite/auth only; artifact stream path helpers should move to project-root-aware helpers.
- `src/server/db/index.ts`: add metadata columns/tables and indexes, guarded by `PRAGMA user_version` migration.
- `src/server/db/schema.ts`: add typed schema for artifact stream metadata and slimmed event/intervention/review rows.
- `src/server/events/named-events.ts`: ensure decisions around migration, compaction, backfill failures, and artifact read failures emit named events.
- `src/runtime/http/routes/events.ts`: read selected-run event/intervention/review payloads through artifact adapters; keep snapshot payload bounded.
- `src/server/events/persisted-snapshot.ts`: align any alternate persisted snapshot path with the same adapters.
- `src/server/supervisor/interventions.ts`, `src/server/supervisor/index.ts`, `src/server/supervisor/observer.ts`: write supervisor intervention payloads through the artifact adapter.
- `src/server/planning/review.ts`: write planning-review finding bodies through the artifact adapter.
- `src/server/conversations/create.ts`, `src/server/conversations/send-message.ts`, `src/server/conversations/queued-messages.ts`, `src/server/runs/recovery-*`: switch execution-event writes to the adapter where events can carry large details.
- `scripts/delete-conversations.sh`: remove artifact stream directories/files for deleted runs.
- `.gitignore`: ignore project-local `.omniharness` runtime artifact directories where needed without hiding source-controlled docs/config unintentionally.
- `tests/scripts/delete-conversations.test.ts`: assert artifact cleanup.
- `docs/architecture/lifecycle-observability-and-testing.md`: document artifact-backed named-event/event-detail persistence.
- `docs/architecture/worker-conversation-stream.md`, `docs/architecture/session-provider-model.md`, and direct-control troubleshooting docs: replace global `run-data` assumptions with project-local `.omniharness` paths plus legacy fallback notes.

Potential file growth:
- `src/server/workers/output-store.ts` is already large. Do not add generic store code into it. Extract shared mechanics into `src/server/artifacts/append-only-store.ts` and keep worker-specific compatibility shims thin.
- `src/runtime/http/routes/events.ts` should not grow much; move transformation into adapters/helpers if needed.

## Data Model

Artifact root:
- Canonical root is `<run.projectPath>/.omniharness/run-data/<runId>/`.
- Worker streams live at `<project>/.omniharness/run-data/<runId>/workers/<workerId>.jsonl`.
- Run-level streams live at `<project>/.omniharness/run-data/<runId>/<kind>.jsonl`, for example `execution-events.jsonl`, `supervisor-interventions.jsonl`, and `planning-review-findings.jsonl`.
- Compressed inactive streams use the same path plus `.gz`.
- Legacy global files under `getAppDataPath("run-data")` are read only as migration/backward-compatibility input.

Stream identity:
- Worker stream key is `(run_id, kind="worker_entries", owner_id=<workerId>)`.
- Execution events use one run-level stream: `(run_id, kind="execution_events", owner_id=NULL)`.
- Supervisor interventions use one run-level stream: `(run_id, kind="supervisor_interventions", owner_id=NULL)`.
- Planning review findings use one run-level stream per run for the current milestone: `(run_id, kind="planning_review_findings", owner_id=NULL)`. If review-round-level paging becomes necessary, introduce it deliberately with a schema/test change rather than ad hoc extra files.
- Enforce uniqueness on `(run_id, kind, owner_id)` with `owner_id` normalized to a sentinel or generated key if SQLite nullable uniqueness would allow duplicates.

SQLite remains the index/summary layer:
- `artifact_streams`: `id`, `run_id`, `project_path`, `kind`, `owner_id`, `relative_path`, `latest_seq`, `latest_record_id`, `status`, `created_at`, `updated_at`, `compacted_at`, `last_error`, `last_verified_at`.
- Existing logical tables keep small fields needed for list/filter/order:
  - `execution_events`: `id`, `run_id`, `worker_id`, `plan_item_id`, `event_type`, `artifact_seq`, `details_hash`, `details_preview`, `created_at`; keep `details` during migration, then treat as legacy fallback.
  - `supervisor_interventions`: `id`, `run_id`, `worker_id`, `intervention_type`, `artifact_seq`, `prompt_hash`, `summary_preview`, `created_at`; make legacy body columns nullable or replace new-write values with documented empty sentinels until a later drop migration.
  - `planning_review_findings`: keep severity/category/title/source path/created time plus `details_hash`, `recommendation_preview`, and `artifact_seq` in SQLite; move long `details` and `recommendation` to artifact payload. Make current `NOT NULL` body columns nullable or use documented empty sentinels before new writes stop populating them.

Simplification target after migration:
- New writes should not populate legacy large body columns.
- Readers should prefer `artifact_seq`/artifact payload and only read legacy columns when `artifact_seq` is null.
- A follow-up migration can drop legacy body columns only after all supported local DBs have been backfilled. Do not drop columns in the same milestone unless tests and product requirements explicitly allow it.

Artifact records use an envelope:
```ts
{
  id: string;
  seq: number;
  runId: string;
  kind: "execution_event" | "supervisor_intervention" | "planning_review_finding";
  createdAt: string;
  payload: unknown;
}
```

Ordering:
- Primary order remains `(createdAt, id)` for existing UI semantics.
- Artifact `seq` is append-order and cursor-oriented, not a replacement for timeline sort unless a surface explicitly wants append order.
- Backfill must preserve existing `createdAt` and stable ids.

## State And Persistence Invariants

- SQLite metadata and artifact append are one logical write with an explicit recovery protocol:
  - Append an idempotent artifact record whose `id` is the durable domain row id and whose payload includes enough identity to repair metadata.
  - Insert/update the SQLite domain row with `artifact_seq`, small summary fields, and hashes in the same adapter call immediately after append.
  - If append succeeds and SQLite fails, emit `error.surfaced` plus a named artifact inconsistency event and leave the artifact record in place for repair.
  - If SQLite references an artifact seq that is missing or corrupt, readers surface a stable error, fall back only when a legacy body is present, and record the stream health failure in `artifact_streams.last_error`.
  - A repair scan reconciles orphan artifact records, dangling SQLite metadata, latest seq mismatches, and duplicated ids. It is part of the backfill/diagnostic tooling, not a manual hope.
- The artifact root is resolved from server-owned run metadata, not from client input. Path traversal or artifacts outside `<project>/.omniharness/run-data` are hard failures.
- Every artifact metadata row stores `project_path` plus a relative path, never an absolute artifact path as the only source of truth. This keeps projects portable.
- Readers must tolerate legacy SQLite body columns until backfill is complete.
- Readers must tolerate legacy global `run-data` files only for runs that have not been migrated; new writes must never append there.
- Snapshot payloads must declare the same selected-run completeness rules as today; artifact-backed payloads may be partial only when marked with cursor metadata. Execution events, supervisor interventions, and review findings all need explicit limits/cursors/completeness flags rather than relying on unbounded selected-run arrays.
- No UI surface treats local cache or artifact tail data as server-authoritative unless the server snapshot says the selected run and scope are complete.
- Compaction never runs on a stream that is actively being appended to. Use the same per-stream chain/lock pattern as worker output.
- Delete/archive cleanup removes both plaintext and compressed artifacts for the run.
- Event stream replay/resync remains named-event driven; artifact storage is not a second event bus.

## Implementation Tasks

- [ ] Inventory and simplify existing persistence paths before adding new code.
  - Map current JSONL/gzip behavior in `src/server/workers/output-store.ts`, worker stream writes in `src/server/workers/stream-writer.ts`, archived run cleanup, and persisted snapshot assembly.
  - Identify duplicated helpers to extract exactly once: path resolution, lock/chain management, JSONL parse/tail scan, gzip compact/expand, latest-seq read, archive/delete.
  - Identify every caller that assumes global `run-data` and classify it as migrate, compatibility read, or documentation-only.
  - Decide which worker-specific logic must remain in a thin adapter: bridge-entry normalization, legacy DB `output_entries_json`, archive marker behavior, raw compaction.
  - Verification: produce a short checklist in the implementation PR/notes showing which helpers were extracted, reused, or deliberately left worker-specific.

- [ ] Define project-local artifact path resolution.
  - Create `src/server/artifacts/project-root.ts`.
  - Resolve artifact roots from `runs.projectPath` first, then a validated plan/project fallback only for legacy runs that lack `projectPath`.
  - Create `<project>/.omniharness/run-data/<runId>/` on write.
  - Store only relative paths below `.omniharness/run-data` in SQLite metadata.
  - Refuse writes if no project root can be resolved; surface `error.surfaced` with a stable code.
  - Verification: tests for normal project paths, missing project paths, path traversal, deleted/moved project directories, and portability of relative metadata.

- [ ] Update ignore rules for project-local runtime artifacts.
  - Ensure `.gitignore` covers `.omniharness/run-data/` and other runtime artifact directories in any project checkout.
  - Do not blanket-ignore `.omniharness` files that may be intentionally source-controlled unless the repo policy already does so.
  - Verification: `git check-ignore` tests or script assertions for `.omniharness/run-data/<runId>/...` and allowed `.omniharness` docs/config cases.

- [ ] Add failing tests for current hot-path boundedness.
  - Add route-level timing/shape tests that create thousands of execution events and assert selected-run snapshot reads only the selected run and latest bounded records.
  - Add `EXPLAIN QUERY PLAN` assertions where practical for avoiding full scans/temp sorts on selected-run queries.
  - Verification: targeted Vitest test fails before storage migration or bounded reads are implemented.

- [ ] Build the generic append-only artifact store.
  - Create `src/server/artifacts/append-only-store.ts` with append, read-all, read-since, latest-seq, compact, expand, delete, and stream path helpers.
  - Reuse worker output-store locking/chain concepts; do not add a parallel ad hoc persistence style.
  - Accept a resolved project-local stream path from `project-root.ts`; do not call `getAppDataPath("run-data")` for new writes.
  - Support plaintext `.jsonl` first, `.jsonl.gz` fallback, and bounded tail reads for active streams.
  - Keep the API small: one generic append/read engine plus typed adapter callbacks for parse/compact, not one class per stream kind.
  - Verification: `tests/server/artifacts/append-only-store.test.ts`.

- [ ] Refactor worker output storage onto the shared primitives.
  - Move generic mechanics from `src/server/workers/output-store.ts` into `src/server/artifacts/append-only-store.ts`.
  - Move new worker writes to `<project>/.omniharness/run-data/<runId>/workers/<workerId>.jsonl`.
  - Keep legacy global `run-data/<runId>/<workerId>.jsonl(.gz)` reads as compatibility until migration completes.
  - Keep public worker APIs stable: `appendWorkerEntry`, `readWorkerEntriesSince`, `readWorkerLatestSeq`, compaction helpers, and legacy migration helpers should still exist.
  - Do not rewrite worker conversation semantics in this task; this is a mechanical deduplication with tests.
  - Verification: `tests/server/workers/output-store.test.ts`, `tests/app/worker-entries-manager.test.ts`, and unified terminal stream tests.

- [ ] Add SQLite artifact metadata schema.
  - Update `src/server/db/schema.ts` and `src/server/db/index.ts` with `artifact_streams` and relevant metadata columns/indexes.
  - Increment `DB_SCHEMA_VERSION`.
  - Include indexes for `(run_id, kind)`, `(project_path, run_id)`, `(kind, updated_at)`, and selected-run metadata lookups.
  - Add a real uniqueness guarantee for stream identity: `(run_id, kind, normalized_owner_id)`.
  - Resolve current `NOT NULL` conflicts before stopping large-body writes. `supervisor_interventions.prompt` and planning review `details`/`recommendation` currently cannot simply become absent; choose nullable columns or documented empty sentinels, then test that readers never show sentinel text.
  - Verification: schema init test/import check and `sqlite_master`/query-plan checks.

- [ ] Implement execution-event artifact adapter.
  - Create `src/server/events/execution-event-store.ts`.
  - Provide `recordExecutionEvent`, `listExecutionEventsForRun`, and `listExecutionEventSummariesForSnapshot`.
  - Store large `details` in artifact payload; keep small queryable fields in SQLite.
  - Store `details_hash` and a compact preview/summary in SQLite for dedupe, diagnostics, and hot snapshot lists that do not need the full body.
  - Implement the append-then-SQLite recovery protocol from the invariants section.
  - Preserve legacy fallback from `execution_events.details`.
  - Do not create a second event identity system; SQLite `execution_events.id` remains the durable UI/log id, artifact `seq` is only the stream cursor.
  - Verification: adapter tests cover new writes, legacy reads, mixed reads, ordering ties, and missing artifact error surfacing.

- [ ] Migrate every execution-event details reader, not only writers.
  - Audit with `rg "executionEvents|execution_events|\\.details"` and inspect server-side callers that parse `details` for behavior, not display.
  - Move supervisor context building, memory reads/writes, file reads, repo inspections, worker-history reads, summaries, and any observer dedupe logic to adapter APIs.
  - Replace exact serialized-`details` dedupe with `details_hash` plus stable semantic keys where available.
  - Verification: tests cover supervisor context, observer dedupe, and any event-derived behavior after legacy `details` is absent.

- [ ] Migrate execution-event writers.
  - Replace direct inserts into `executionEvents` across conversation, supervisor, recovery, quota, planning, and worker code with the adapter.
  - Keep named-event emission rules unchanged.
  - Verification: existing lifecycle tests plus focused tests for worker stuck/fail/recovery events.

- [ ] Implement supervisor-intervention artifact adapter.
  - Create `src/server/supervisor/intervention-store.ts`.
  - Store large prompt/summary bodies in artifact records; keep intervention type, run, worker, and timestamp in SQLite.
  - Preserve legacy fallback.
  - Verification: tests for read/write/backfill and selected-run snapshot rendering.

- [ ] Implement planning-review artifact adapter.
  - Create `src/server/planning/review-artifact-store.ts`.
  - Store finding `details` and `recommendation` in artifact payloads while leaving list metadata in SQLite.
  - Preserve review round/run summary rows in SQLite.
  - Verification: review tests confirm findings render with full bodies and snapshot payloads remain bounded.

- [ ] Update persisted snapshot assembly.
  - Modify `src/runtime/http/routes/events.ts` and `src/server/events/persisted-snapshot.ts` to read migrated payloads through adapters.
  - Extract shared selected-run persisted snapshot readers if the two routes duplicate query/serialization logic.
  - Keep `/api/events?snapshot=1&persisted=1&runId=<id>` selected-run scoped and bounded.
  - Add explicit limits and cursor metadata for supervisor interventions and planning review findings, not only execution events.
  - Include completeness flags for each bounded collection so the UI can distinguish "fully loaded" from "preview/tail only".
  - Avoid importing supervisor startup, provider registries, queue delivery, or bridge sync in persisted-only snapshots.
  - Verification: route import timing probe, route tests, and snapshot checksum/not-modified tests.

- [ ] Add idempotent backfill script.
  - Create `scripts/backfill-append-only-artifacts.ts`.
  - Backfill rows with legacy bodies into artifact records using stable ids and created timestamps.
  - Move/copy existing global worker streams from app `run-data` into each owning project's `.omniharness/run-data` directory.
  - Leave global files in place until verification passes, then support an explicit cleanup mode; do not silently delete migration sources.
  - Record progress in a durable migration marker table or sidecar metadata keyed by database path, run id, stream kind, and source fingerprint.
  - Provide `--dry-run`, `--verify`, and explicit cleanup modes. Default mode must backfill/copy but never delete sources.
  - Print per-kind counts: scanned rows, written records, skipped existing records, missing project roots, corrupt payloads, orphan artifact records, dangling SQLite rows, and repaired metadata rows.
  - Emit named events or clear console diagnostics for skipped/corrupt rows, with a machine-readable report path.
  - Verification: fixture DB backfill test and rerun idempotency test.

- [ ] Wire compaction.
  - Extend the existing compaction sweep through a shared artifact compaction helper that covers worker and non-worker streams.
  - Ensure active streams are never compacted while writers may append.
  - Verification: compaction tests for terminal runs, active runs, gzip read fallback, and append-after-expand.

- [ ] Update delete/archive cleanup.
  - Update `scripts/delete-conversations.sh` and server-side delete/archive helpers to call `src/server/artifacts/cleanup.ts`.
  - Ensure no stale project-local or legacy global artifact files survive conversation deletion after cleanup runs.
  - Verification: `tests/scripts/delete-conversations.test.ts` and lifecycle delete scenario.

- [ ] Add observability and repair diagnostics.
  - Emit named events for artifact append failure, metadata mismatch, compaction failure, backfill failure, and missing artifact payload.
  - Add a small script or command mode to inspect artifact stream health for a run.
  - Repair command verifies `artifact_streams.latest_seq`, domain-row `artifact_seq`, artifact record ids, hashes/previews, project-local path existence, gzip readability, and legacy global fallback status.
  - Repair command must report before mutating and require an explicit repair flag for metadata changes.
  - Verification: tests assert named events on injected missing/corrupt artifact cases.

- [ ] Run full verification.
  - `pnpm test tests/server/artifacts tests/server/events tests/server/planning tests/runtime tests/app`
  - `pnpm test:lifecycle`
  - `pnpm exec tsc --noEmit`
  - Manual/local timing check: persisted selected-run snapshot should avoid full event-table scans and target sub-50ms handler work after module warm-up.

- [ ] Remove or quarantine obsolete code paths.
  - Delete duplicate helper functions made unnecessary by the shared artifact engine only when all callers have moved.
  - Mark legacy SQLite body readers with explicit comments and tests showing they are fallback-only.
  - Mark legacy global `run-data` readers with explicit comments and tests showing they are fallback-only.
  - Remove unused imports that pull supervisor/provider/mutation modules into read-only hot routes.
  - Verification: `rg` checks for old direct inserts/large-body reads and route import timing probes.

## What Moves Out Of SQLite

- Move:
  - full execution event `details`,
  - supervisor intervention `prompt` and `summary`,
  - planning review finding `details` and `recommendation`,
  - any future append-only trace payloads with unbounded growth.

- Keep:
  - run/session/worker identity and status,
  - selected-run sidebar/list metadata,
  - messages that are durable user/supervisor checkpoints,
  - queued message state,
  - read markers,
  - settings/auth/accounts,
  - artifact stream cursors and health summaries.

## Risks And Mitigations

- Dual-write inconsistency: use adapter-only writes and named artifact inconsistency events.
- Backfill duplicates: stable ids plus stream-level dedupe by id/fingerprint.
- Slow gzip reads: active reads use plaintext tail; gzip reads are historical and can be paged.
- Project moved/deleted: artifact root resolution emits a stable surfaced error and readers fall back to legacy/global or SQLite bodies only when the run has not been migrated.
- Accidental source control of artifacts: `.gitignore` and docs explicitly cover `.omniharness/run-data`.
- Broken lifecycle observability: named event emission remains separate from artifact persistence; tests assert both.
- Route import regression: persisted snapshot route must keep heavy imports lazy.
- Over-abstraction: keep the shared artifact engine byte/stream focused; put domain semantics in adapters.
- Half-simplified migration: require `rg`/test checks so old direct writes do not coexist with adapter writes indefinitely.

## Acceptance Criteria

- Existing UI renders selected-run timelines, intervention summaries, and review findings with no missing content.
- Persisted snapshot routes do not synchronously load large historical bodies for unrelated runs.
- `EXPLAIN QUERY PLAN` for selected-run snapshot queries uses indexes and avoids broad table scans for migrated data.
- Backfill can run repeatedly without changing record counts or duplicating artifact entries.
- Terminal/inactive artifact streams compact to `.jsonl.gz`; active streams stay appendable.
- New JSONL/gzip writes land under `<project>/.omniharness/run-data`, not global app `run-data`.
- Delete-conversations removes SQLite rows plus project-local and legacy global artifact files for deleted runs.
- Lifecycle tests pass, including restart/reconnect/resync paths.

## Self-Review

- Every requested storage target maps to a concrete adapter and migration task.
- The plan reuses the existing JSONL/gzip framework instead of inventing another persistence layer.
- SQLite remains the authoritative metadata/index layer where queryability matters.
- No branch or worktree is assumed.
- No placeholder or fake persistence path is accepted as complete.
- The plan includes tests for bounded reads, ordering, backfill idempotency, compaction, delete cleanup, and lifecycle behavior.
