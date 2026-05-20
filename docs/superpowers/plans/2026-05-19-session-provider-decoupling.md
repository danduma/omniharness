# Session Provider Decoupling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make OmniHarness able to host multiple session types, starting with the existing Omni agent sessions and a real local process/script session, without tying the frontend to one backend conversation model.

**Architecture:** Introduce a canonical `SessionProvider` boundary that owns creation, input delivery, lifecycle control, persistence mapping, and capability reporting for each session type. Keep the existing unified worker stream as the transcript transport, but make the global event snapshot and UI actions derive from provider-neutral session records and advertised capabilities instead of hardcoded Omni implementation/planning/direct assumptions.

**Tech Stack:** Next.js App Router, React manager classes, Drizzle/SQLite, SSE named events, append-only worker JSONL streams, Node child processes for the first non-Omni provider, existing shadcn/ui components and i18n resources.

**North Star Product:** A conversation workbench that can display and control agents, subprocesses, scripted tools, remote services, and future ACP-backed systems through the same session UI, while each provider exposes only the actions it genuinely supports.

**Current Milestone:** Ship a provider abstraction with two production providers: `omni` for the existing behavior and `process` for local command/script sessions whose stdout, stderr, stdin prompts, exit state, cancellation, and errors render through the same transcript surface.

**Future Product Direction:** After this milestone, the same provider contract can support remote ACP sessions, notebooks, test runners, shell jobs, or task-specific tools. That direction is context only; the checklist below delivers the current `omni` plus `process` milestone end-to-end.

**Final Functionality Standard:** A user can create, view, interact with, stop, resume display history for, and delete both existing Omni conversations and local process sessions. The UI must not show unsupported Omni-specific controls for process sessions, and tests must assert provider decisions through named events and durable transcript entries.

---

## Scope Notes

- Do not create branches or worktrees.
- Do not delete files.
- Do not replace the unified worker stream. Extend and reuse it as the transcript substrate.
- Do not build a fake process provider. It must run a real configured local command, stream stdout/stderr, accept stdin when running, persist entries, and report exit status.
- Do not use ACP as the only frontend abstraction. ACP remains one possible backend/runtime protocol; `SessionProvider` is the app boundary.
- Keep Omni implementation/planning/direct behavior working throughout migration.
- Use the existing `runs`/`workers`/worker JSONL model for this milestone. Do not introduce an alternate transcript store or an ambiguous parallel `sessions` table.
- Process sessions are powerful local execution. The first implementation must be explicit and conservative about cwd validation, environment inheritance, command parsing, output limits, and stop behavior.

## User Stories

- As a user, I can start a normal Omni implementation/planning/direct conversation and it behaves as it does today.
- As a user, I can start a process session, choose a working directory and command, and see stdout/stderr appear incrementally in the conversation surface.
- As a user, I can type input to a running process session and have it delivered to stdin, with my input recorded in the transcript.
- As a user, I can stop a running process session and see whether it exited, was cancelled, or failed.
- As a user, I can reopen a process session after reload and see its persisted transcript and final state.
- As an operator/test author, I can inspect named events and persisted entries to know exactly when a provider created, started, accepted input, refused input, stopped, failed, or completed.

## File Map

### Files To Create

- `src/server/session-providers/types.ts`
  - Provider-neutral session, actor, capability, command, lifecycle, and transcript mapping types.
- `src/server/session-providers/registry.ts`
  - Registry for installed providers and provider lookup by `sessionType`.
- `src/server/session-providers/omni-provider.ts`
  - Adapter around existing `createConversation`, `sendConversationMessage`, run recovery, and stop/fork actions.
- `src/server/session-providers/process-provider.ts`
  - Real local process provider using Node child processes, stdin delivery, stdout/stderr entry mapping, stop handling, and exit persistence.
- `src/server/session-providers/process-store.ts`
  - In-memory runtime handles for live child processes plus durable DB/read helpers.
- `src/server/session-providers/session-records.ts`
  - Serialization from DB rows into provider-neutral API records.
- `src/server/session-providers/capabilities.ts`
  - Shared capability constants and helpers such as `canSendInput`, `canStop`, `canFork`, `canEditInput`, `supportsQueuedInput`.
- `src/app/home/SessionStateManager.ts`
  - Frontend manager for provider-neutral selected session metadata, capabilities, and action availability, fed from event snapshots.
- `src/components/home/SessionTypePicker.tsx`
  - Composer control for choosing Omni vs process sessions, with all visible strings in `shared/locales/*.json`.
- `src/components/home/ProcessSessionOptions.tsx`
  - Process command/cwd/options editor, owned by a manager rather than local source-of-truth arrays.
- `src/app/home/ProcessSessionDraftManager.ts`
  - Centralized manager for process session draft command, args/raw command mode, cwd, environment option toggles, and validation state.
- `tests/lifecycle/scenarios/process-session-basic.test.ts`
  - Headless lifecycle scenario for create, stream stdout/stderr, send stdin, exit, reload snapshot, and delete cleanup.
- `tests/lifecycle/scenarios/session-provider-capabilities.test.ts`
  - Headless scenario asserting unsupported actions are refused with typed events and visible errors.
- `tests/lifecycle/scenarios/process-session-restart.test.ts`
  - Headless lifecycle scenario for server restart while a process session is active.
- `docs/architecture/session-provider-model.md`
  - Canonical architecture doc for session providers, capabilities, event contracts, and transcript mapping.

### Files To Modify

- `src/server/db/schema.ts`
  - Add provider-neutral columns/tables without breaking existing rows:
    - `runs.session_type` default `"omni"`.
    - `process_sessions` table keyed by `run_id`.
    - process runtime metadata for command argv, cwd, pid, status, exit code, signal, started/exited timestamps, kill escalation state, and safe command preview.
    - a normal `workers` row for the process actor so `app-data/run-data/<runId>/<workerId>.jsonl`, `workerEntrySeqs`, and `/api/workers/:workerId/entries` continue to work unchanged.
- `src/server/db/index.ts`
  - Update `initializeSchema()` with `CREATE TABLE IF NOT EXISTS process_sessions`, `runs.session_type` handling, indexes/FKs, and existing-DB `ALTER TABLE` guards. This repo initializes schema manually here; do not plan work against a nonexistent migrations directory.
- `src/server/workers/entries-types.ts`
  - Add entry metadata needed for non-agent streams, likely `channel?: "stdout" | "stderr" | "stdin" | "system" | "agent"` and `authorRole` reuse. Keep existing entry types compatible.
- `src/server/workers/stream-writer.ts`
  - Add provider-neutral append helpers such as `appendSessionInputEntry`, `appendProcessOutputEntry`, `appendSessionLifecycleEntry`, all delegating to `appendWorkerEntry`.
- `src/runtime/http/routes/conversations.ts`
  - Route create requests through the provider registry based on `sessionType`, preserving existing request behavior as `sessionType: "omni"`.
- `src/runtime/http/routes/conversation-messages.ts`
  - Route send/input requests through provider registry and enforce provider capabilities.
- `src/runtime/http/routes/runs.ts`
  - Route stop/delete/fork/retry/edit/archive actions through provider-aware action handlers where applicable.
- `src/app/api/runs/[id]/route.ts`
  - Keep as a thin Next wrapper around runtime route handlers.
- `src/app/api/events/route.ts` and `src/server/events/persisted-snapshot.ts`
  - Include provider-neutral `sessions` or extended run metadata and capability maps in snapshots.
- `src/server/events/named-events.ts`
  - Add typed events for provider lifecycle and action decisions.
- `src/app/home/types.ts`
  - Add `SessionType`, `SessionCapability`, provider-neutral `SessionRecord`, and capability fields. Preserve existing `RunRecord` consumers during migration.
- `src/app/home/useHomeViewModel.ts`
  - Derive UI mode, primary actor, composer availability, and action visibility from session type/capabilities rather than only `run.mode`.
- `src/components/home/ConversationMain.tsx`
  - Hide or show retry/edit/fork/worktree/recovery controls based on capabilities. Render process entries through the existing `Terminal` path.
- `src/components/home/ConversationComposer.tsx` and `src/app/home/ComposerContainer.tsx`
  - Add process session creation controls and send input behavior for running process sessions.
- `src/app/home/useHomeMutations.ts`
  - Send provider-neutral create/input/action payloads. Keep optimistic updates limited to actions whose provider explicitly supports them.
- `src/app/home/LiveEventConnectionManager.ts`
  - Keep worker-entry wakeups, but generalize naming/docs to session entries where useful. Preserve wire compatibility.
- `src/runtime-api/types.ts` and `src/runtime-api/web.ts`
  - Replace `unknown` request/response shapes with typed provider-neutral create/input/action contracts where practical.
- `shared/locales/*.json`
  - Add all new UI strings for session type selection, process options, action labels, validation, and errors.
- `docs/architecture/worker-conversation-stream.md`
  - Add a short note that worker streams now serve provider-backed session actors, not only AI workers.
- `scripts/delete-conversations.sh`
  - Ensure process session metadata and artifacts are cleaned with conversations.

### Tests To Update Or Add

- Unit tests for provider registry lookup, capability checks, and request validation.
- Unit tests for `ProcessSessionDraftManager` and `SessionStateManager`.
- Unit tests for process output to `WorkerEntry` mapping, including stdout/stderr chunk splitting and seq ordering.
- Lifecycle scenarios:
  - process session create/stream/exit/reload/delete;
  - stdin delivery while running;
  - input refusal after exit;
  - stop running process;
  - server restart while process is active;
  - process spawn failure surfaces `error.surfaced`;
  - unsupported action refusal emits a named event.
- Existing lifecycle scenarios must still pass for Omni implementation/planning/direct sessions.

### Candidate Agentic User Journey Tests

These require explicit user approval before running:

- Start a process session from the UI with a small Python script, watch incremental output, send input, and confirm transcript persistence after reload.
- Start an Omni direct session and confirm the existing UI still shows the worker stream and expected controls.
- Switch between Omni and process sessions in the sidebar and confirm provider-specific controls do not bleed across sessions.

### `.gitignore` Coverage

Before implementation, verify `.gitignore` covers:

- `node_modules/`, package-manager caches, Next build output, coverage, logs, temporary files.
- process-session runtime temp dirs if introduced.
- generated process output artifacts if any are written outside `app-data/run-data`.
- no secrets or local process environment dumps are persisted.

## Chosen Persistence Model

Use the existing `runs` row as the durable user-visible session identity. Add `runs.session_type` with default `"omni"` for all existing rows. Add a `process_sessions` table keyed by `run_id`:

```ts
processSessions = {
  runId: string;              // primary key, references runs.id
  workerId: string;           // references workers.id
  cwd: string;
  commandJson: string;        // argv array, not a shell string
  commandPreview: string;     // redacted, bounded display string
  envPolicy: "minimal" | "inherit_safe";
  pid: number | null;
  status: "starting" | "running" | "exited" | "cancelled" | "failed" | "orphaned";
  exitCode: number | null;
  signal: string | null;
  startedAt: Date | null;
  exitedAt: Date | null;
  lastError: string | null;
}
```

Every process session also creates one `workers` row with `type: "process"` and the usual `runId`, `cwd`, `status`, `workerNumber`, timestamps, and text fields. This preserves the existing worker stream storage path and reader endpoint.

## Process Execution Boundaries

- Use `spawn(file, args, { cwd, shell: false })` for the first implementation. Do not accept raw shell mode in this milestone.
- Accept command input as either an argv array from the API or a UI command string parsed with a structured shell-words parser into argv. Persist the argv array as JSON.
- Validate cwd against the same project/root rules used by the app: it must be an existing directory and must be within the selected project scope or explicitly chosen folder.
- Environment policy starts as `minimal`, with only safe runtime variables required for PATH/process execution. Do not persist environment values.
- Redact command previews with a bounded display string and obvious secret-like argument redaction.
- Stream output in bounded chunks. The process provider must preserve ordering within each stdout/stderr data event and rely on `appendWorkerEntry` seq for global transcript order.
- Stop behavior sends `SIGTERM`, records `session.stopped`, and escalates to `SIGKILL` after a bounded timeout if the process remains alive.
- Stdin is accepted only when status is `running` and the child stdin is writable. Refused stdin emits `session.input.refused`; delivered stdin appends an input entry only after the write callback succeeds.
- On server restart, live child handles are gone. The startup/reconciliation path marks any `starting`/`running` process sessions without a live handle as `orphaned` or terminal failed, emits `session.status`, and surfaces a user-visible explanation.

## Provider Contract

Define a server-side provider interface in `src/server/session-providers/types.ts`:

```ts
export type SessionType = "omni" | "process";

export type SessionCapability =
  | "send_input"
  | "stop"
  | "retry_from_message"
  | "edit_message"
  | "fork_session"
  | "fork_message"
  | "queue_input"
  | "approve_permission"
  | "open_project_file"
  | "use_git_workspace";

export interface SessionProvider {
  readonly type: SessionType;
  create(input: CreateSessionInput): Promise<CreateSessionResult>;
  sendInput(input: SendSessionInput): Promise<SendSessionInputResult>;
  stop(input: StopSessionInput): Promise<StopSessionResult>;
  delete?(input: DeleteSessionInput): Promise<DeleteSessionResult>;
  getCapabilities(session: ProviderSessionRecord): SessionCapability[];
  serialize(session: ProviderSessionRecord): SessionRecord;
}
```

The exact names can change during implementation, but the boundary must preserve these ideas:

- The UI sends intent to a session provider, not directly to Omni-specific functions.
- The provider decides whether an action is supported and emits a refusal event when it is not.
- Transcript entries remain durable JSONL entries keyed by `(runId, actorId)` or the evolved equivalent.
- Capabilities are data. Components do not infer support from `run.mode` alone.

## Event Contract

Add exact typed events to `src/server/events/named-events.ts`:

- `session.created` with `{ runId, sessionType, actorIds }`
- `session.starting` with `{ runId, sessionType }`
- `session.status` with `{ runId, sessionType, prev, next, reason? }`
- `session.input.accepted` with `{ runId, targetActorId, inputId }`
- `session.input.delivered` with `{ runId, targetActorId, inputId }`
- `session.input.refused` with `{ runId, sessionType, code, reason }`
- `session.action.refused` with `{ runId, sessionType, action, code, reason }`
- `session.stopped` with `{ runId, sessionType, reason }`
- `process.spawned` with `{ runId, workerId, pid, commandPreview }`
- `process.exited` with `{ runId, workerId, exitCode, signal }`

Add exact `SurfacedErrorCode` members:

- `process.spawn.failed`
- `process.cwd.invalid`
- `process.stdin.closed`
- `process.stop.failed`
- `process.orphaned_after_restart`
- `session.provider.unknown`
- `session.action.unsupported`

Every user-relevant failure also emits `error.surfaced` with a stable `code`, `surface`, and `runId`/`workerId`. Unsupported action paths must emit both `session.action.refused` and, when the user initiated the action from the UI/API, `error.surfaced` with `session.action.unsupported`.

## Implementation Checklist

- [ ] Audit current file sizes and split any touched file that would exceed 1200 lines before adding major logic.
  - Check `src/components/home/ConversationMain.tsx`, `src/app/home/HomeApp.tsx`, `src/app/home/useHomeMutations.ts`, and `src/server/conversations/create.ts`.
  - Verification: `wc -l` confirms new provider logic lives in dedicated modules, not oversized UI/server files.

- [ ] Add provider-neutral schema and migrations.
  - Extend run/session metadata with `sessionType` in both `src/server/db/schema.ts` and manual schema initialization in `src/server/db/index.ts`.
  - Add process metadata persistence for command, cwd, pid, status, exit code, signal, timestamps, and safe command preview.
  - Keep existing rows defaulting to `omni`.
  - Create one `workers` row per process session with `type: "process"`.
  - Add `ALTER TABLE` guards in `initializeSchema()` for existing sqlite DBs and `CREATE TABLE IF NOT EXISTS process_sessions`.
  - Verification: schema initialization succeeds on a fresh DB and an existing sqlite DB; existing conversations still load.

- [ ] Define provider contracts and capability helpers.
  - Create `src/server/session-providers/types.ts`, `registry.ts`, and `capabilities.ts`.
  - Include typed request/result objects for create, send input, stop, delete, and serialize.
  - Verification: unit tests cover registry lookup, unknown provider refusal, and capability helper behavior.

- [ ] Implement the Omni provider adapter.
  - Move orchestration calls behind `omni-provider.ts` while preserving current `createConversation` and `sendConversationMessage` behavior.
  - Do not rewrite all Omni internals in this task; wrap existing stable behavior first.
  - Emit provider-level named events around create/send/stop decisions where missing.
  - Verification: existing direct/planning/implementation tests and lifecycle scenarios pass.

- [ ] Implement process provider runtime and persistence.
  - Use `child_process.spawn(file, args, { cwd, shell: false })`.
  - Validate cwd, parse argv, apply env policy, and redact command preview before spawn.
  - Stream stdout and stderr incrementally into the unified entry writer.
  - Deliver user input to stdin only while the process is running.
  - Persist exit code, signal, failure, start, and exit timestamps.
  - Implement `SIGTERM` then bounded `SIGKILL` escalation.
  - Ensure process handles are in memory only; durable state is reconstructable after restart as terminal if the child is gone.
  - Verification: unit tests cover stdout/stderr mapping, exit mapping, spawn failure, and stdin after exit refusal.

- [ ] Extend `WorkerEntry` safely for process streams.
  - Add `channel` or equivalent metadata without breaking existing Terminal rendering.
  - Map stdout/stderr/stdin/system lifecycle content to readable entries.
  - Append stdin entries only after the write is accepted by the child process; failed attempts stay out of JSONL and surface through named events/errors.
  - Ensure each process output entry has a stable id, channel metadata, timestamp, seq, and emits `worker.entry_appended`.
  - Preserve existing `message`, `thought`, `tool_call`, `permission`, `user_input`, `supervisor_input`, `system_note`, and `lifecycle` behavior.
  - Verification: existing worker stream tests pass and process entry snapshots show correct seq ordering.

- [ ] Route create through providers.
  - Update conversation create and message routes to read `sessionType`, defaulting to `omni`.
  - Verification: creating with missing `sessionType` behaves as Omni; creating with `process` creates run, worker, process metadata, stream file, and events.

- [ ] Route send/input through providers.
  - Use provider registry from `conversation-messages.ts`.
  - Process input writes to stdin only when the provider reports `send_input`.
  - Verification: delivered stdin appears in JSONL; stdin after exit emits `session.input.refused` and `error.surfaced`.

- [ ] Route stop/delete/retry/edit/fork/archive through providers.
  - Put provider-aware action dispatch in `src/runtime/http/routes/runs.ts`; keep `src/app/api/runs/[id]/route.ts` as a wrapper.
  - Enforce provider capabilities before calling actions.
  - For unsupported process actions such as retry/edit/fork/worktree, emit `session.action.refused` and return a typed error.
  - Verification: supported Omni paths remain unchanged; unsupported process paths are observable.

- [ ] Add provider-neutral event snapshot data.
  - Include session type, capabilities, primary actor id, status, cwd/project path, title, and safe provider metadata in snapshots.
  - Keep `runs`, `workers`, and `workerEntrySeqs` compatible during migration.
  - Verification: `GET /api/events?snapshot=1` includes enough data for UI action visibility without guessing from `run.mode`.

- [ ] Add frontend session state and draft managers.
  - Create `SessionStateManager` for provider-neutral selected session metadata and capabilities.
  - Create `ProcessSessionDraftManager` for command/cwd/options validation.
  - `SessionStateManager` owns provider-neutral records derived from snapshots and exposes selected session, primary actor id, capabilities, and action availability.
  - `useHomeViewModel` consumes `SessionStateManager` outputs instead of re-deriving action support from `RunRecord.mode`.
  - Keep subscriptions narrow so typing process commands does not repaint the full app shell.
  - Verification: manager unit tests cover draft updates, validation, capability updates, and reset on successful create.

- [ ] Add process session creation UI.
  - Add `SessionTypePicker` and `ProcessSessionOptions`.
  - Use existing shadcn/ui primitives and existing layout style.
  - Add every user-facing string to all `shared/locales/*.json` files.
  - Default to current Omni behavior so existing users are not surprised.
  - Verification: typecheck plus i18n key check if available; no hardcoded user-facing strings in new components.

- [ ] Make conversation actions capability-driven.
  - Update `ConversationMain`, composer, worker/sidebar controls, and mutation handlers to hide/disable unsupported actions.
  - Process sessions should show send input and stop while running; no edit/fork/worktree/recovery controls unless explicitly supported.
  - Omni sessions should preserve existing controls.
  - Verification: component/unit tests or focused assertions cover action availability for `omni` and `process`.

- [ ] Preserve transcript rendering through the unified stream.
  - Process sessions should render in `Terminal` via `entries`.
  - Add lightweight visual treatment for stderr if needed using entry metadata, but avoid a broad redesign.
  - Verification: process stdout/stderr/stdin/lifecycle entries display in order after reload.

- [ ] Implement process lifecycle cleanup and deletion.
  - Delete conversation/session rows and associated process metadata through the existing delete path.
  - Stop live child process before deleting a running process session.
  - Update `scripts/delete-conversations.sh` to remove process session persisted artifacts.
  - Verification: lifecycle delete scenario leaves no process metadata or JSONL artifacts for test sessions.

- [ ] Implement process restart reconciliation.
  - On runtime startup/bootstrap, find process sessions in `starting` or `running`.
  - If no live child handle exists, mark them `orphaned` or terminal failed with a clear reason.
  - Emit `session.status` and `error.surfaced` with `process.orphaned_after_restart`.
  - Verification: `process-session-restart.test.ts` proves transcript survives and the user-visible status is not silently stale.

- [ ] Add lifecycle scenarios for the provider model.
  - Add `process-session-basic.test.ts`.
  - Add `session-provider-capabilities.test.ts`.
  - Add `process-session-restart.test.ts`.
  - Include event transcript assertions for create, start, input accepted/delivered/refused, stop, exit, failure, and delete.
  - Verification: `pnpm test:lifecycle -- <new scenario selector if supported>` or full `pnpm test:lifecycle`.

- [ ] Update architecture docs.
  - Write `docs/architecture/session-provider-model.md`.
  - Update worker stream docs to explain provider-backed actors.
  - Mention that ACP is a backend protocol option, not the frontend session abstraction.
  - Verification: docs mention event contract, persistence model, capabilities, and process provider behavior.

- [ ] Run final verification.
  - `pnpm lint`.
  - `pnpm test tests/lib/i18n.test.ts` plus targeted provider/process/frontend manager tests.
  - `pnpm test:lifecycle`.
  - `pnpm build` if provider changes touch app route typing or production-only boundaries.
  - Manual or approval-gated browser journey only if the user explicitly approves.

## Acceptance Criteria

- Existing Omni conversations keep working in implementation, planning, and direct modes.
- A process session can be created from the UI and via HTTP, streams real stdout/stderr into persisted entries, accepts stdin while running, and reaches a visible terminal state on exit.
- The global event snapshot exposes provider-neutral session metadata and capabilities.
- UI controls are capability-driven; process sessions do not show Omni-only actions.
- Provider refusals and failures are visible through typed named events and `error.surfaced` where user-relevant.
- Reloading the app preserves process session transcript and final status.
- Restarting the server while a process session is active does not leave the UI pretending the lost child process is still running; it emits a named event and visible explanation.
- Delete cleanup removes DB rows and persisted process transcript artifacts for test sessions.
- Lifecycle tests assert the control-plane decisions without relying on DOM rendering.

## Self-Review Checklist

- Every requested requirement maps to a task: other session types, ACP not being sufficient alone, Python/script-like output, backend decoupling, action decoupling, data shape decoupling.
- The plan has no fake provider, mock transcript, or placeholder UI as final functionality.
- The plan preserves current Omni behavior while introducing the provider boundary.
- The plan explicitly handles state, persistence, frontend managers, capabilities, events, errors, tests, and docs.
- The plan does not assume branches or worktrees.
- The plan proposes agentic user journey tests but gates them on explicit user approval.
- The final checklist completes the approved milestone without hiding required behavior in a deferred section.
