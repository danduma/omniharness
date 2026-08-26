# Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax.

**Feature:** Cross-CLI Hybrid Handoff Fork

**Goal:** Let a user fork any direct-control conversation into a new session running on a different CLI, carrying a compact, inspectable hybrid handoff packet; use the same new-run mechanism when cross-provider quota recovery is selected, and make same-run cross-CLI switching impossible.

**Architecture:** A server-owned handoff coordinator freezes the source at a durable worker-stream sequence, gathers bounded deterministic evidence, optionally adds a semantic summary, compiles and persists a versioned packet, and launches a completely separate target run. SQLite stores lifecycle metadata; the append-only artifact store holds packet versions; the target worker stream receives the rendered packet as its first `user_input`. After successful launch, the source runtime is terminated and the run is retained as `cancelled` history. Same-CLI model/account recovery may continue inside a run, but changing the CLI/provider always crosses a run boundary.

**Tech Stack:** TypeScript, React, TanStack Query, global Manager classes, Drizzle + SQLite, append-only JSONL artifacts, existing runtime HTTP registry/API adapters, named SSE events, Vitest, lifecycle HTTP/SSE scenarios, existing shadcn/ui primitives, and locale JSON files.

**North Star Product:** A user can move work between CLI ecosystems without pretending their provider sessions, recovery semantics, or transcripts are interchangeable. The new agent starts with the smallest trustworthy continuation context, the source remains auditable, and failures never strand or silently mutate either conversation.

**Current Milestone:** Ship cross-CLI handoff forks for direct/commit conversations from the session menu, an individual message, the existing Resume CLI Session dialog, and quota recovery. The packet is editable where it is advisory, inspectable after launch, bounded, redacted, and restart-safe. Durable evidence is summarized by a disposable instance of the selected target CLI; the source provider is never contacted, and the real target session never receives raw packet JSON.

**Future Product Direction:** Reuse the packet format for export/import and cross-device handoff only after this milestone proves the provenance, recovery, and deletion model. Do not add same-run CLI switching, background multi-agent continuation, or automatic worktree creation in this milestone.

**Final Functionality Standard:** Every cross-CLI transition creates a new run and target worker stream; no server path can recreate a worker under another CLI in the source run. The packet accurately identifies uncertainty and pre-existing workspace changes, survives a process restart, excludes secrets and hidden reasoning, and produces enough observability to explain every capture, launch, refusal, and failure.

---

## Product decisions and non-goals

1. **A CLI handoff is a fork, never a resume.** “Resume external session” keeps its existing meaning. “Fork current conversation to another CLI” creates a new OmniHarness run with `parentRunId` and an optional `forkedFromMessageId`.
2. **The source is historical after a successful launch.** Before target creation, terminate any live source CLI process and confirm it exited; if no live runtime owns the source, verify that fact and skip interruption/termination. On success set the source run to `cancelled`, retain its transcript and artifacts, and select the target run in the UI. If target launch fails after source termination, restore `quota_waiting` when a durable future quota wake exists; otherwise set `needs_recovery`. Never keep two CLIs editing the same checkout concurrently.
3. **The packet is hybrid.** Deterministic state is authoritative; a disposable target-CLI summarizer converts that evidence into advisory progress and next steps. Current disk state wins over prose. The source CLI is assumed unavailable and is never asked to prepare the handoff.
4. **Manual and quota paths share one coordinator.** Manual entry points offer a preview. A quota-triggered cross-provider handoff may launch without waiting for an exhausted CLI, then exposes the persisted packet for inspection.
5. **Only advisory content is user-editable.** The user may amend objective, status, next steps, blockers, notes, and relevant-file explanations. Source IDs, stream sequence, git evidence, verification records, target selection, provenance, and hash are server-owned.
6. **No full transcript or full diff by default.** The packet contains a short exact tail plus summaries, file-level evidence, and compact error/test output. The source run remains the place to inspect full history.
7. **No hidden reasoning.** Never copy `thought`, chain-of-thought, raw environment, credentials, authorization headers, binary attachments, or unrestricted tool output into a packet.
8. **No automatic worktree.** This feature uses the current checkout and avoids concurrency by stopping the source. Existing explicit worktree fork actions remain separate.
9. **No file deletion is part of this plan.** Refactor existing modules in place or add focused modules; preserve project history and user changes.

## User journeys

### Manual fork from the session

1. The user opens the session menu and selects **Fork to another CLI**.
2. The dialog defaults to a different available CLI and offers compatible account, model, and effort choices.
3. The user explicitly chooses **Prepare handoff**, acknowledging that any live source CLI will stop. The server gracefully interrupts then terminates it (or verifies no live runtime exists), confirms exit, captures the final stable boundary, and returns a compact preview with provenance and warnings.
4. The user may edit advisory notes, then launches.
5. At launch OmniHarness revalidates target and source/workspace fingerprints. Because source exit was already confirmed, it creates the new run, persists the packet as the target's initial user input, starts the selected CLI, marks the source `cancelled`, and selects the target in the sidebar.

### Fork from a message

1. The user chooses **Fork to another CLI from here** on a user message and receives the same explicit **Prepare handoff** confirmation that names the source stop; selecting an old message never bypasses termination.
2. Candidate collection ignores superseded/later conversation entries but compares against the current workspace, explicitly warning when files contain changes made after the selected message.
3. The rest of the flow is the same as the manual session fork.

### Fork from Resume CLI Session

1. The existing dialog clearly separates **Resume external session** from **Fork current conversation**.
2. The fork option appears only with an eligible selected OmniHarness direct/commit run.
3. Choosing it opens the same handoff dialog, not a provider-session resume flow.

### Cross-provider quota recovery

1. A CLI reaches a durable quota-waiting state.
2. Same-provider account/model recovery may use existing same-CLI recovery.
3. If the selected strategy requires another CLI/provider, the server synthesizes a packet from persisted evidence and creates a new run.
4. The exhausted source is never prompted for a handoff and never receives a replacement worker of another type.
5. If preflight finds no target, the untouched source stays `quota_waiting` with its wake schedule. If launch fails after source termination, restore `quota_waiting` when a durable future wake exists; otherwise use `needs_recovery`. In both cases the error names the failed stage.

## Compact handoff packet contract

Create a versioned `HybridHandoffPacketV1` with the following logical shape. Use stable IDs and enums rather than translated labels.

```ts
type HybridHandoffPacketV1 = {
  handoffVersion: 1;
  source: {
    runId: string;
    workerId: string | null;
    workerType: SupportedWorkerType | null;
    forkedFromMessageId: string | null;
    sourceSeq: number | null;
    interruptionReason: "manual_session" | "manual_message" | "quota_exhausted";
    generatedAt: string;
  };
  target: {
    workerType: SupportedWorkerType;
    model: string | null;
    effort: string | null;
    accountId: string | null;
  };
  task: {
    originalRequest: string | null;
    currentObjective: string | null;
    acceptanceCriteria: string[];
    userConstraints: string[];
  };
  state: {
    completed: string[];
    inProgress: string[];
    remaining: string[];
    blockers: string[];
    openQuestions: string[];
    rejectedApproaches: Array<{ approach: string; reason: string }>;
  };
  decisions: Array<{ decision: string; reason: string | null; evidence: string[] }>;
  workspace: {
    projectRootLabel: string;
    baselineCommit: string | null;
    currentHead: string | null;
    dirtyBeforeSession: boolean | null;
    modifiedFiles: Array<{
      path: string;
      changeType: "added" | "modified" | "deleted" | "renamed" | "unmerged";
      ownership: "session" | "probable_session" | "preexisting" | "external" | "unknown";
      summary: string | null;
      evidence: string[];
    }>;
    untrackedFiles: string[];
    relevantUnchangedFiles: string[];
    commitsCreated: string[];
  };
  verification: Array<{
    command: string;
    result: "passed" | "failed" | "unknown";
    exitCode: number | null;
    importantOutput: string | null;
  }>;
  artifacts: {
    plans: string[];
    specs: string[];
    generatedOutputs: string[];
  };
  continuity: {
    recentUserMessages: string[];
    recentAssistantSummary: string | null;
    pendingUserInput: string | null;
    queuedMessages: string[];
  };
  provenance: {
    summarySource: "outgoing_worker" | "recent_assistant" | "synthetic" | "hybrid";
    omittedSections: string[];
    confidenceWarnings: string[];
    truncatedFields: string[];
  };
};
```

Compilation rules:

- Set an explicit 36,000-character rendered-packet ceiling (roughly 6,000–10,000 tokens depending on content), plus per-field item and character limits. Keep the constants in code, not environment variables.
- Prioritize source identity and sequence, user constraints, current objective, blockers/errors, file evidence, verification, decisions, queued input, then recent conversational tail. Drop completed prose first.
- Stable-sort every deterministic collection so the same redacted nonvolatile evidence yields the same semantic content hash; `generatedAt` may differ without changing that hash.
- Reuse recent persisted assistant context only as advisory text. Gather it across the conversation's replacement-worker streams, discard quota/authentication failures, and mark stale evidence where applicable.
- Never ask the source worker to prepare a report. Treat it as unavailable in every manual and automatic cross-CLI handoff, because quota exhaustion is the normal operating condition for this feature. Instead, run a disposable read-only instance of the selected target CLI to summarize the durable packet before the real target session is created.
- For a hard interruption, synthesize entirely from the worker stream, execution events, messages/queued messages, run metadata, git evidence, and known artifacts.
- For a message fork, cap conversation candidates at that message/stream boundary while computing workspace state at capture time; call out the mismatch rather than claiming the checkout was rewound.
- Render advisory narrative inside an explicit untrusted-data boundary telling the target to verify disk state. Do not let tool/assistant text masquerade as system instructions.
- Run redaction before budgeting, canonicalization, hashing, preview extraction, rendering, logging, or event emission. Apply it to every structured text field and to the final rendered seed, including verification output, blockers, decision evidence, queued text, and persisted conversation summaries.
- Keep the absolute `projectPath` only in server-side run/handoff metadata for access and launch checks. The packet/API uses a non-sensitive `projectRootLabel` such as the repository directory name; all file evidence is project-relative.
- Hash the NFC-normalized, fixed-key-order canonical packet while excluding only volatile `generatedAt`. Target selection remains hash input, so changing it creates a new hash/revision.
- Render untrusted content inside a randomly generated, high-entropy nonce fence created after sanitization. Reject/regenerate a nonce that occurs in content, encode the interior as canonical JSON, and test delimiter/system/tool-frame imitation. The renderer's nonce is not part of the semantic packet hash.

## State machine and invariants

Persist these statuses: `capturing -> ready -> launching -> completed`, with terminal `failed` and `cancelled`, plus durable nonterminal `needs_recovery` when a partially launched target cannot be confirmed stopped. `capturing`, `ready`, `launching`, and `needs_recovery` are covered by active-handoff/workspace uniqueness; only the first three expire automatically. Retrying a terminal failure always creates a new handoff row linked to the failed attempt; it never resurrects the terminal row. An ambiguous target must be explicitly stopped/deleted before `needs_recovery` can terminalize and release the source.

The coordinator owns an immutable launch fence:

```ts
{
  handoffId,
  revision,
  sourceRunId,
  sourceWorkerId,
  sourceSeq,
  workspaceFingerprint,
  targetSelectionHash
}
```

Server invariants:

- At most one nonterminal handoff exists for a source run and normalized project path. A persistent workspace lease plus an in-process keyed mutex serializes capture/launch; every other OmniHarness mutation path for a run sharing that project refuses while the lease is active. Before capture, also refuse when another live run already owns a worker in the same checkout.
- New messages, queued-message delivery, retry/edit recovery, manual resume, quota wake, auto-commit, and reconciler actions refuse with `409 handoff_in_progress` while the source workspace is fenced.
- Opening the dialog is read-only. The explicit **Prepare handoff** action acquires the lease. If the source owns a live runtime, advance turn generation, request graceful interruption, wait up to `HANDOFF_STREAM_SETTLE_TIMEOUT_MS`, terminate the CLI process, and confirm process exit/no runtime ownership. If it is idle, quota-blocked, or already stopped, verify that no PID/live runtime owns it and skip the interruption/termination steps. If absence/exit cannot be confirmed, fail capture and do not create a target.
- Before termination, disable new source auto-commit scheduling and await any in-flight auto-commit under the workspace lease; do not manufacture a final commit. After confirmed source absence/termination, set `runs.activeHandoffId`, use `needs_recovery` internally, and capture the final durable worker sequence and git state. UI/recovery consumers seeing `activeHandoffId` render the handoff draft state instead of a generic crash banner. `ready`/`launching` remain handoff statuses, not new run statuses.
- Define `workspaceFingerprint` as SHA-256 over a canonical sequence containing HEAD, `git diff --binary --no-ext-diff`, and `git diff --cached --binary --no-ext-diff`, with NFC-normalized project-relative path records. Exclude untracked and ignored files from the drift fence to avoid editor/build-cache churn; still list capture-time untracked files in the packet with a warning that they are not launch-fenced.
- Launch first validates CLI availability, target account/model/effort compatibility, quota state, project path, source revision, and target selection without mutating source or target. It then re-reads the durable sequence and workspace fingerprint. Any drift refuses with `handoff.source_changed` and requires a new capture/preview; it never silently auto-revises a packet the user already reviewed.
- The target run and worker are created under the existing run/quota mutation controls. The rendered seed is persisted with `appendUserInputOnDelivery` in the target's unified worker stream before prompting the CLI.
- `launch` is idempotent. Persist a server-generated launch claim token and expiry before target creation, and stamp the target `runs.originHandoffId` before worker creation. Repeating the operation returns the discovered existing `targetRunId`; a stale revision gets `409 handoff_revision_conflict`.
- Every nonterminal handoff carries a lease expiry. `capturing`/`launching` use server heartbeats; the client renews a `ready` lease while the preview is open, capped at `HANDOFF_READY_MAX_LIFETIME_MS = 15 minutes`. A startup/heartbeat reconciler fails expired states, discovers targets by `originHandoffId`, adopts the one target where applicable, clears `runs.activeHandoffId`, releases the workspace fence, and emits the exact decision. Expired `ready` edits are not saved; the UI reports expiry and offers a fresh prepare.
- Mark `completed` only after target creation, target seed persistence, a successful bridge response accepting the initial prompt, and a live bridge-agent check. Persist that acceptance in the target unified worker stream so restart reconciliation uses the same proof. Set the already-terminated source run to `cancelled`, mark carried queued messages `cancelled` with a `cross_cli_handoff` reason, and persist the source-to-target link in the completed handoff row.
- A target launch failure never manufactures success and never deletes persisted rows. When the partial target is confirmed stopped, mark it `failed`, clear `runs.activeHandoffId`, restore `quota_waiting` when a durable future quota wake exists (otherwise source `needs_recovery`), and release the fence. When target stop is ambiguous, keep the handoff itself in durable `needs_recovery`, retain `runs.activeHandoffId`, remove any source auto-wake, and fence both runs plus the checkout until an operator confirms target shutdown/deletion.
- Cancellation applies to manual and quota-created nonlaunching handoffs. The dialog and `RunRecoveryNotice` both expose it. Cancellation/expiry clears `runs.activeHandoffId`, releases the lease, and restores `quota_waiting` when a durable future wake exists or `needs_recovery` otherwise. Recovery UI and reconcilers branch on active handoff ID/reason rather than treating all `needs_recovery` states alike.
- Centralize that rule as `settleSourceAfterUnsuccessfulHandoff(sourceRecoverySnapshot, reason)` and call it for capture/termination refusal, cancel, expiry, drift abandonment, and post-stop launch failure. The snapshot preserves the original quota incident/wake. The helper always clears the active marker/lease, restores `quota_waiting` plus the durable future wake when one existed, and otherwise sets `needs_recovery` with the stage-specific reason; no caller chooses a status ad hoc.
- Deleting the source removes its handoff metadata/artifact stream through existing run cleanup; the target remains independently understandable because its initial worker stream contains the rendered seed.
- Deleting a target while its handoff is nonterminal first requests target cancellation and confirms bridge absence/termination. Only then does it terminalize the handoff and release the source/workspace fence; an ambiguous stop refuses deletion and retains `needs_recovery`. `ON DELETE SET NULL` is not relied on as lifecycle logic.
- Same-run recreation must reject a requested worker type different from an existing direct/commit run's CLI. Enforce this in a shared spawn assertion and a SQLite `BEFORE INSERT` safety trigger, not only at callers. Model, effort, or account changes within the same CLI remain allowed where currently supported. Supervisor implementation runs retain their intentional multi-worker behavior.
- Automatic quota handoff walks handoff/parent lineage. Refuse after `MAX_AUTOMATIC_HANDOFF_DEPTH = 3`, exclude providers/accounts exhausted in the last two handoffs, enforce a cooldown, and verify the target account has no open quota incident before source termination.

## File map

### Create

- `src/shared/handoff.ts` — packet, lifecycle, API DTO, edit-patch, and error-code contracts shared by server/client.
- `src/server/handoff/candidates.ts` — bounded candidate reads from unified worker streams, messages, queued messages, events, and artifacts.
- `src/server/handoff/workspace-state.ts` — read-only git baseline/current evidence and file ownership classification.
- `src/server/handoff/redaction.ts` — path-safe text normalization, secret/tool-output filtering, and size limits.
- `src/server/handoff/compiler.ts` — authoritative/advisory merge, priority budgeting, deterministic ordering, provenance, hash, and renderer input.
- `src/server/handoff/store.ts` — SQLite metadata and append-only packet-version persistence.
- `src/server/handoff/coordinator.ts` — capture/preview/edit/launch state machine, source fence, idempotency, and failure recovery.
- `src/server/handoff/reconciler.ts` — startup/heartbeat recovery for expired capture/launch claims and orphan target adoption.
- `src/server/runs/fork.ts` — extracted generic new-run fork creation used by legacy message forks and handoff launches.
- `src/server/workers/direct-run-type-invariant.ts` — central direct/commit worker-type assertion used before worker insertion; emits typed refusal.
- `src/server/events/handoff-events.ts` — focused named-event union for import into the existing event contract.
- `src/runtime/http/routes/handoffs.ts` — create/list/get/patch/launch HTTP handlers and validation.
- `src/interface/home/HandoffForkManager.ts` — single source of truth for dialog draft, server revision, request ownership, pending stages, and errors.
- `src/interface/home/HandoffForkDialog.tsx` — target picker, packet preview/editor, warnings, and launch result UI.
- `src/components/home/CliLaunchSelectionFields.tsx` — reusable CLI/account/model/effort controls for the handoff dialog without duplicating composer selection logic.
- `tests/server/handoff/compiler.test.ts` — packet priority, freshness, deterministic hash, truncation, and rendering tests.
- `tests/server/handoff/candidates.test.ts` — bounded stream/event/queued-message and message-boundary tests.
- `tests/server/handoff/workspace-state.test.ts` — baseline/current classification and path-safety tests.
- `tests/server/handoff/redaction.test.ts` — credentials, environment, hidden reasoning, malicious content, and byte-limit tests.
- `tests/server/handoff/store.test.ts` — revisions, active-handoff uniqueness, idempotency, and cascade tests.
- `tests/server/handoff/coordinator.test.ts` — state transitions, source fences, synthetic fallback, target failures, and launch idempotency.
- `tests/server/handoff/reconciler.test.ts` — expired claim, orphan target adoption, target deletion, and fence-release tests.
- `tests/server/workers/direct-run-type-invariant.test.ts` — application assertion and SQLite trigger safety-net tests.
- `tests/api/handoffs-route.test.ts` — route validation/auth/contract/error responses.
- `tests/app/handoff-fork-manager.test.ts` — stale-response ownership, retry, selection, and close/reopen behavior.
- `tests/ui/handoff-fork-dialog.test.tsx` — translated copy, accessibility, advisory-only editing, and responsive states.
- `tests/lifecycle/scenarios/cross-cli-handoff-fork.test.ts` — manual and quota cross-CLI lifecycle scenario over HTTP/SSE.
- `tests/lifecycle/scenarios/cross-cli-handoff-restart.test.ts` — restart, replay, idempotent launch, and deletion scenario.

### Modify

- `src/server/db/schema.ts` — add `conversationHandoffs` metadata table and indexes.
- `src/server/db/index.ts` — additive schema initialization/migration and database version bump.
- `src/server/artifacts/stream-types.ts` — add the `handoff_packets` run-level stream kind.
- `src/server/artifacts/append-only-store.ts` — map the new stream to `handoff-packets.jsonl`.
- `src/server/handoff/request.ts` — reconstruct the failover report exclusively from persisted conversation, worker-stream, verification, and workspace evidence.
- `src/server/handoff/target-summarizer.ts` — run and clean up the disposable target CLI, validate its structured report, and refuse preparation on failure.
- `src/server/handoff/parser.ts` — retain parsing support only for legacy report artifacts; new handoffs do not request source-worker reports.
- `src/server/handoff/render.ts` — render the versioned packet and remove quota-only wording.
- `src/server/git/auto-commit.ts` — extract/reuse baseline parsing needed by read-only workspace evidence without synchronous shell work on the hot path.
- `src/server/runs/recovery.ts` — delegate legacy retry/edit/fork run creation to focused services; do not grow this 1,300+ line module.
- `src/server/supervisor/worker-failover.ts` — retain compatibility exports but route cross-CLI cases to the new-run handoff coordinator; do not spawn another CLI in the source run.
- `src/server/supervisor/index.ts` and `src/server/supervisor/wake.ts` — consume target-run outcomes and preserve quota recovery semantics across restart.
- `src/server/supervisor/observer.ts` — record pending cross-CLI handoff intent instead of only same-run failover intent.
- `src/server/conversations/send-message.ts` — reject text/composer-driven cross-CLI changes inside an existing run and preserve same-CLI model/account recreation only.
- `src/server/conversations/create.ts`, `src/server/supervisor/index.ts`, `src/server/planning/review.ts`, and `src/server/runs/recovery.ts` — call the central direct/commit worker-type assertion before worker insertion; supervisor implementation multi-worker behavior remains allowed.
- `src/server/conversations/queued-messages.ts`, `src/server/conversations/queued-message-interrupt.ts`, `src/server/quota/worker-resume.ts`, and `src/server/runs/recovery-reconciler.ts` — enforce the persisted handoff fence before source mutation/recovery.
- `src/server/prompts/supervisor.md` — describe cross-provider recovery as a new-session handoff, not an in-session worker swap.
- `src/server/credits/index.ts` — make `cross_provider` return a target CLI/account candidate for the handoff coordinator rather than mutating the source worker account.
- `src/server/events/named-events.ts` — import the focused handoff event union, add stable surfaced error codes, and avoid embedding packet bodies in SSE.
- `src/runtime/http/routes/index.ts` — register handoff routes.
- `src/runtime-api/types.ts` and `src/runtime-api/domains/index.ts` — add typed `handoffs` operations.
- `src/interface/home/useHomeMutations.ts` — add query/mutations for preview, edit, launch, and active-draft lookup; switch selection only under matching request ownership.
- `src/interface/home/useConversationActions.ts` — route session/message cross-CLI actions into `HandoffForkManager`; retain ordinary same-run message retry/edit behavior.
- `src/interface/home/ExternalSessionsPicker.tsx` — separate external resume from the new current-conversation fork option.
- `src/components/home/HomeHeader.tsx` — add the session-level entry point.
- `src/components/home/ConversationMain.tsx` — add the per-message entry point through a small extracted action component or callback; do not grow this 1,600+ line file.
- `src/components/home/RunRecoveryNotice.tsx` — add quota handoff status/action and target-run navigation.
- `src/interface/home/HomeApp.tsx` — mount/wire the lazy dialog and manager only; move logic out of this 1,700+ line file.
- `src/interface/home/EventStreamStateManager.ts` and `src/interface/home/utils.ts` — reconcile handoff lifecycle events and target selection without optimistic run fabrication.
- `src/components/settings/ModelsSettingsPanel.tsx` — clarify that `cross_provider` opens a new handoff session while same-provider strategies stay in the current CLI.
- `shared/locales/*.json` — add every new visible label, description, warning, status, aria label, and error fallback to all locales.
- `tests/db/schema.test.ts`, `tests/supervisor/worker-failover.test.ts`, `tests/supervisor/worker-failover-handoff-fails.test.ts`, `tests/supervisor/worker-failover-spawn-retry.test.ts`, `tests/supervisor/worker-failover-no-replacement.test.ts`, `tests/api/conversation-messages-route.test.ts`, `tests/ui/conversation-actions.test.ts`, `tests/app/event-stream-state-manager.test.ts`, `tests/runtime/http-registry.test.ts`, `tests/runtime/http-routes.test.ts`, `tests/runtime/route-contract-fixture.test.ts`, and `tests/runtime/fixtures/routes.v1.json` — update existing expectations around the new-run invariant.
- `docs/architecture/lifecycle-observability-and-testing.md` — document handoff decisions/events and the source/target recovery model before adding server state transitions.
- `docs/architecture/worker-conversation-stream.md` — document that the target handoff seed is an ordinary first `user_input`, not a parallel transcript.
- `.gitignore` — verify packet temp/debug output cannot be tracked; add only a narrowly scoped ignore if implementation introduces a local debug artifact.

## API and persistence design

### SQLite metadata

Add `conversation_handoffs` with:

- `id` primary key.
- `source_run_id` foreign key to `runs` with `ON DELETE CASCADE`.
- `source_worker_id` nullable foreign key to `workers` with `ON DELETE SET NULL`.
- `target_run_id` nullable foreign key to `runs` with `ON DELETE SET NULL`.
- `forked_from_message_id`, `reason`, `status`, `revision`, `source_seq`, `normalized_project_path`, and `workspace_fingerprint`.
- `target_worker_type`, `target_model`, `target_effort`, `target_account_id`, `target_selection_hash`.
- `packet_version`, `artifact_seq`, `packet_hash`, `packet_preview`, `summary_source`.
- `operation_id`, `launch_claim_token`, `claim_expires_at`, `retry_of_handoff_id`, `last_error`, `created_at`, `updated_at`, and `completed_at`.
- Unique partial indexes for one `capturing|ready|launching` handoff per source run and normalized project path, plus indexes for target run, claim expiry, and status/update time.

Add nullable indexed `runs.origin_handoff_id` and `runs.active_handoff_id`. `origin_handoff_id` is written in the same transaction as target run creation, deliberately has no cascading foreign key, and lets restart recovery discover a target even if the process died before `conversation_handoffs.target_run_id` was updated. `active_handoff_id` distinguishes an intentionally prepared source from an ordinary `needs_recovery` run and is cleared on every terminal transition.

Keep the full packet out of SQLite. Append every ready/revised packet as an `ArtifactRecordEnvelope<HybridHandoffPacketV1>` in the source run's `handoff_packets` stream and point metadata at the current sequence/hash. Store only a bounded, redacted preview for list/recovery UI.

### HTTP contract

- `POST /api/runs/:runId/handoffs` — create or return the active draft. Body: fork point, reason, and target selection. Returns `202 capturing` or `200 ready` with metadata/packet DTO.
- `GET /api/runs/:runId/handoffs?active=1` — restore a durable draft after reload.
- `GET /api/handoffs/:handoffId` — inspect the current packet/revision/result.
- `PATCH /api/handoffs/:handoffId` — patch advisory fields with `expectedRevision`; return `409` on stale revision.
- `POST /api/handoffs/:handoffId/launch` — idempotent launch with `expectedRevision`, `operationId`, and final target selection; return the target run/worker IDs.
- `POST /api/handoffs/:handoffId/cancel` — release any nonlaunching manual or quota draft fence. A launching/completed handoff cannot be cancelled; the reconciler owns abandoned launch claims.

Every flat `/api/handoffs/:handoffId` handler must resolve the source run and apply the same project/run authorization check as run-scoped endpoints before reading or mutating anything. Include an IDOR test using an authenticated caller without access to the source project. Cancellation covers every nonlaunching manual or quota draft.

There are no persisted V0 packet artifacts to migrate. Existing legacy worker-produced reports remain readable as advisory history, but V1 capture reconstructs new packets without contacting the source. If a future/unknown artifact version is encountered, retain it on disk, refuse to render it, surface `handoff.packet_version_unsupported`, and require a fresh V1 capture.

Return typed stage-specific errors. HTTP conflicts include `handoff_in_progress`, `handoff_revision_conflict`, and `handoff_required`. User-relevant failures also emit `error.surfaced` with stable codes `handoff.capture_failed`, `handoff.revision_conflict`, `handoff.target_unavailable`, `handoff.source_changed`, `handoff.launch_failed`, `handoff.fork_required`, and `handoff.packet_version_unsupported`; register every code in the named-event typed union.

### Named events

Emit these via `emitNamedEvent` for every server decision:

- `handoff.capture_started`
- `handoff.packet_ready`
- `handoff.packet_revised`
- `handoff.launch_started`
- `handoff.completed`
- `handoff.cancelled`
- `handoff.failed`
- `handoff.refused`

Events carry IDs, revisions, stage, source/target IDs, target worker type, reason, and stable error code where relevant. They never carry the full packet. All event frames retain the existing SSE ID/replay/resync behavior.

## Implementation tasks

### Task 1: Document the invariant and preserve a green baseline

**Files:**
- Modify: `docs/architecture/lifecycle-observability-and-testing.md`
- Modify: `docs/architecture/worker-conversation-stream.md`

- [ ] Add architecture text stating that a CLI/provider change creates a new run, the target seed lives in its unified worker stream, and source/target ownership is never shared.
- [ ] Record the three-phase ordering: validate target; terminate/confirm source and capture final state; create/prompt target. Document `cancelled` success and the single unsuccessful-settlement helper that restores a durable `quota_waiting` wake or uses stage-specific `needs_recovery`.
- [ ] Record workspace lease, drift refusal, packet redaction/untrusted-boundary, restart claim, and named-event requirements before implementing state transitions.
- [ ] Run the existing baseline without changing its expectations: `pnpm vitest run tests/api/conversation-messages-route.test.ts tests/supervisor/worker-failover.test.ts tests/supervisor/worker-failover-handoff-fails.test.ts tests/supervisor/worker-failover-spawn-retry.test.ts tests/supervisor/worker-failover-no-replacement.test.ts`.

### Task 2: Define the packet and lifecycle contracts

**Files:**
- Create: `src/shared/handoff.ts`
- Create: `tests/server/handoff/compiler.test.ts`
- Create: `tests/server/handoff/redaction.test.ts`

- [ ] Define V1 packet, provenance, lifecycle metadata, editable advisory patch, API request/response, and error-code types.
- [ ] Make authoritative versus advisory fields explicit in the types so PATCH cannot alter source/workspace/verification provenance.
- [ ] Add constants for total and per-field budgets, item counts, recent-tail bounds, and supported interruption reasons.
- [ ] Write failing tests for stable ordering, NFC/fixed-key canonicalization, a content hash that excludes only `generatedAt`, priority truncation, exact omission metadata, and rejection of unknown packet versions.
- [ ] Write failing redaction/render-boundary tests for common API keys/tokens, authorization headers, environment dumps, hidden-reasoning entries, absolute paths outside the project, control characters, nonce/delimiter injection, and content imitating system/tool-result framing.
- [ ] Run `pnpm vitest run tests/server/handoff/compiler.test.ts tests/server/handoff/redaction.test.ts` and confirm failures are contractual rather than fixture errors.

### Task 3: Add durable metadata and packet artifact storage

**Files:**
- Modify: `src/server/db/schema.ts`
- Modify: `src/server/db/index.ts`
- Modify: `src/server/artifacts/stream-types.ts`
- Modify: `src/server/artifacts/append-only-store.ts`
- Create: `src/server/handoff/store.ts`
- Create: `tests/server/handoff/store.test.ts`
- Modify: `tests/db/schema.test.ts`

- [ ] Add the `conversation_handoffs` table, `runs.originHandoffId`, `runs.activeHandoffId`, foreign keys, normalized workspace key, timestamps, revision, operation/claim/expiry fields, bounded preview, and exact partial indexes described above using the repository's additive schema pattern.
- [ ] Increment `DB_SCHEMA_VERSION` and test initialization of old and fresh databases.
- [ ] Add the run-level `handoff_packets` stream and map it to `app-data/run-data/<runId>/handoff-packets.jsonl` through the artifact store.
- [ ] Implement transactional metadata transitions plus append/read of packet versions; never expose a metadata revision whose artifact append failed.
- [ ] Enforce one active handoff per source run and normalized project path, idempotent operation IDs, and target discovery by `originHandoffId`.
- [ ] Test packet revision lookup, stale revision refusal, source deletion cascade, target deletion terminalization/fence release, expired claim lookup, and no orphaned artifact metadata.
- [ ] Run `pnpm vitest run tests/server/handoff/store.test.ts tests/db/schema.test.ts`.

### Task 4: Gather bounded deterministic evidence

**Files:**
- Create: `src/server/handoff/candidates.ts`
- Create: `src/server/handoff/workspace-state.ts`
- Create: `src/server/handoff/redaction.ts`
- Modify: `src/server/git/auto-commit.ts`
- Create: `tests/server/handoff/candidates.test.ts`
- Create: `tests/server/handoff/workspace-state.test.ts`
- Modify: `tests/server/handoff/redaction.test.ts`

- [ ] Read worker content only through bounded `readWorkerEntriesTail`/`Since`/`Before` APIs and respect superseded sequence ranges.
- [ ] Gather original/current user requests, a small exact recent tail, latest assistant recap, queued messages, unresolved execution errors, verification commands/results, plan/spec/generated artifact paths, and the source sequence.
- [ ] For message forks, constrain conversational evidence to the selected message boundary.
- [ ] Parse `runs.gitBaselineJson`, current HEAD/status, diff stats, commit range, tool edit events, and relevant agent summaries into file ownership evidence.
- [ ] Classify file ownership conservatively; never claim session ownership from current git status alone. Preserve `unknown` and warnings.
- [ ] Normalize project-relative paths, keep raw absolute project paths server-only, omit file contents and raw diff hunks by default, and include only narrowly bounded hunks for unresolved conflicts/subtle incomplete edits.
- [ ] Redact every candidate before budgeting, hashing, previewing, rendering, logging, or event emission; perform a final redaction pass over the rendered seed.
- [ ] Test large streams, already-compacted history, deleted/renamed/untracked files, a dirty pre-session baseline, external concurrent edits, post-message workspace drift, malformed baselines, and non-git projects.
- [ ] Run `pnpm vitest run tests/server/handoff/candidates.test.ts tests/server/handoff/workspace-state.test.ts tests/server/handoff/redaction.test.ts`.

### Task 5: Compile and render the hybrid packet

**Files:**
- Create: `src/server/handoff/compiler.ts`
- Modify: `src/server/handoff/request.ts`
- Modify: `src/server/handoff/parser.ts`
- Modify: `src/server/handoff/render.ts`
- Modify: `tests/server/handoff/compiler.test.ts`
- Modify: `tests/server/handoff/parser.test.ts`

- [ ] Implement deterministic merging where collected facts override advisory summaries and every conflict becomes a confidence warning.
- [ ] Detect fresh recent assistant recaps using worker/event sequence evidence.
- [ ] Remove every outgoing-worker report request. Reconstruct task/state/decision/file evidence from the durable conversation, all relevant replacement-worker streams, verification records, and current workspace; then use a disposable read-only target CLI to produce the advisory summary.
- [ ] Preserve the existing synthetic fallback, but feed it through the same candidates/compiler/redaction pipeline.
- [ ] Enforce the packet budget by priority, populate `omittedSections`/`truncatedFields`, and hash the redacted canonical representation excluding only `generatedAt`.
- [ ] Render a concise target prompt with objective, state, decisions, workspace, verification, pending input, uncertainty, and an explicit instruction to inspect current files before acting. Place canonical JSON inside a post-sanitization random nonce fence and ensure embedded text cannot close or imitate the boundary.
- [ ] Ensure quota wording is a reason field, not hard-coded into all handoffs.
- [ ] Test clean completed turns, mid-turn interruption, hard quota interruption, already-compacted history, short sessions, stale summaries, malicious advisory content, and overflow.
- [ ] Run `pnpm vitest run tests/server/handoff/compiler.test.ts tests/server/handoff/redaction.test.ts tests/server/handoff/parser.test.ts`.

### Task 6: Extract safe new-run fork creation

**Files:**
- Create: `src/server/runs/fork.ts`
- Modify: `src/server/runs/recovery.ts`
- Modify: `tests/api/run-route.test.ts`
- Modify: `tests/ui/conversation-actions.test.ts`

- [ ] Extract plan/run/message-copy creation from the existing `recoverRun(... action: "fork")` branch without changing retry/edit semantics.
- [ ] Accept an explicit target worker type/model/effort/account/allowed-types selection and copy `preferredWorkerAccountId`, which the current fork path can omit.
- [ ] Preserve `parentRunId`, `forkedFromMessageId`, project path, and auto-commit preferences. Add `copyMessagePrefix: boolean`: legacy same-CLI forks use `true`; cross-CLI handoffs use `false` so the rendered packet is the target's only initial conversation entry.
- [ ] For a cross-CLI target, capture a fresh git baseline after source termination and in-flight auto-commit settlement, and store it as the target `gitBaselineJson`/workspace metadata. The packet separately reports source-session changes relative to the source's original baseline, so target ownership begins at handoff.
- [ ] Keep target preflight validation separate from target creation. The coordinator performs source termination and post-stop capture between preflight and target creation.
- [ ] Keep existing ordinary and worktree fork behavior passing; do not create a worktree for cross-CLI handoff.
- [ ] On worker launch failure, retain the partially created plan/run as a visible `failed` diagnostic record stamped with `originHandoffId`; do not delete it or claim launch succeeded.
- [ ] Run `pnpm vitest run tests/api/run-route.test.ts tests/ui/conversation-actions.test.ts`.

### Task 7: Build the server coordinator and source fence

**Files:**
- Create: `src/server/handoff/coordinator.ts`
- Create: `src/server/handoff/reconciler.ts`
- Create: `tests/server/handoff/coordinator.test.ts`
- Create: `tests/server/handoff/reconciler.test.ts`
- Modify: `src/server/conversations/queued-messages.ts`
- Modify: `src/server/conversations/queued-message-interrupt.ts`
- Modify: `src/server/quota/worker-resume.ts`
- Modify: `src/server/runs/recovery-reconciler.ts`

- [ ] Implement capture, revise, launch, cancel, retry, and restore transitions over the persisted metadata/store.
- [ ] Acquire the persisted normalized-workspace lease plus in-process workspace mutex; reject another active handoff or any other live worker already using that checkout.
- [ ] On explicit prepare/capture, branch on runtime ownership: for a live source, advance turn generation, request graceful interruption, wait up to `HANDOFF_STREAM_SETTLE_TIMEOUT_MS`, terminate the CLI process, and confirm exit; for idle/quota/stopped sources, verify no PID/live runtime and proceed. Refuse before target creation if absence/exit cannot be confirmed.
- [ ] Disable source auto-commit scheduling, await any in-flight commit, deliberately skip a new final auto-commit, and warn when interruption occurred without a clean tool/turn boundary because files may be partially written.
- [ ] After process absence/exit, recapture the final durable sequence, HEAD, canonical tracked-diff workspace fingerprint, fresh target git baseline, and packet. On launch, re-read them and refuse drift with `handoff.source_changed` plus a visible recapture action.
- [ ] Stop queued delivery, preserve undelivered messages in continuity, and atomically mark their source rows `cancelled` with `cross_cli_handoff` after successful launch so they cannot execute twice.
- [ ] Validate target CLI/account/model/effort/quota state and automatic handoff chain/cooldown limits before source termination.
- [ ] Persist a server claim token/expiry, create the stamped target run, persist rendered seed with `appendUserInputOnDelivery`, and start the target only after source process exit was confirmed.
- [ ] On success clear `activeHandoffId` and set source run `cancelled`. On every unsuccessful terminal path call `settleSourceAfterUnsuccessfulHandoff`; for post-stop target failure also leave any partial target visible as `failed`.
- [ ] Implement launch idempotency, stale source-sequence/revision/workspace refusal, and a startup/heartbeat reconciler that adopts targets by `originHandoffId` or fails expired `capturing`, `ready`, and `launching` leases. A client heartbeat may extend `ready` only up to the 15-minute maximum.
- [ ] Gate send, queue, retry/edit, resume, wake, auto-commit, and reconciler mutations for every run sharing a leased workspace.
- [ ] Handle target deletion by terminalizing a nonterminal handoff and releasing its fence before `ON DELETE SET NULL` runs.
- [ ] Test races: another live run in the checkout, send versus capture, capture versus quota wake, live versus already-dead/quota sources, double launch, cancel versus launch, process refusing to exit, late output, tracked workspace/HEAD drift, untracked churn exclusion, ready expiry with unsaved client edits, target spawn failure, claim expiry, orphan adoption, restart at every status, queued-message cancellation, and source/target deletion.
- [ ] Run `pnpm vitest run tests/server/handoff/coordinator.test.ts tests/server/handoff/reconciler.test.ts tests/server/quota/worker-resume.test.ts tests/server/runs/recovery-reconciler.test.ts`.

### Task 8: Expose typed HTTP/runtime APIs and observability

**Files:**
- Create: `src/server/events/handoff-events.ts`
- Modify: `src/server/events/named-events.ts`
- Create: `src/runtime/http/routes/handoffs.ts`
- Modify: `src/runtime/http/routes/index.ts`
- Modify: `src/runtime-api/types.ts`
- Modify: `src/runtime-api/domains/index.ts`
- Create: `tests/api/handoffs-route.test.ts`
- Modify: `tests/runtime/http-registry.test.ts`
- Modify: `tests/runtime/http-routes.test.ts`
- Modify: `tests/runtime/route-contract-fixture.test.ts`
- Modify: `tests/runtime/fixtures/routes.v1.json`

- [ ] Add the named handoff events and every stable `error.surfaced` code, including `handoff.fork_required` and `handoff.packet_version_unsupported`, without growing `named-events.ts` with full implementation logic.
- [ ] Register create/list/get/patch/launch/cancel routes; resolve flat handoff IDs through the source run's authorization scope before returning data, and validate all IDs, enums, revisions, and selection fields.
- [ ] Return `202` for in-progress capture, `409` for ownership/revision conflicts, `422` for incompatible target selection, and stage-specific `5xx` errors only for actual server failures.
- [ ] Add typed runtime APIs; do not route handoffs through `runs.act` with `unknown` bodies.
- [ ] Ensure no HTTP or SSE response includes secrets, raw packet artifacts when only metadata is needed, or untranslated visible server prose at the UI boundary.
- [ ] Test auth/IDOR, malformed input, unsupported source mode, same-CLI target refusal, stale revision, replayed operation ID, packet retrieval, and surfaced error event payloads.
- [ ] Run `pnpm vitest run tests/api/handoffs-route.test.ts tests/runtime/http-registry.test.ts tests/runtime/http-routes.test.ts tests/runtime/route-contract-fixture.test.ts`.

### Task 9: Replace every same-run cross-CLI path

**Files:**
- Create: `src/server/workers/direct-run-type-invariant.ts`
- Create: `tests/server/workers/direct-run-type-invariant.test.ts`
- Modify: `src/server/conversations/send-message.ts`
- Modify: `src/server/conversations/create.ts`
- Modify: `src/server/supervisor/worker-failover.ts`
- Modify: `src/server/supervisor/index.ts`
- Modify: `src/server/supervisor/wake.ts`
- Modify: `src/server/supervisor/observer.ts`
- Modify: `src/server/prompts/supervisor.md`
- Modify: `src/server/credits/index.ts`
- Modify: `src/server/planning/review.ts`
- Modify: `src/server/runs/recovery.ts`
- Modify: `src/server/db/index.ts`
- Modify: `src/components/settings/ModelsSettingsPanel.tsx`
- Modify: `tests/api/conversation-messages-route.test.ts`
- Modify: `tests/supervisor/worker-failover.test.ts`
- Modify: `tests/supervisor/worker-failover-handoff-fails.test.ts`
- Modify: `tests/supervisor/worker-failover-spawn-retry.test.ts`
- Modify: `tests/supervisor/worker-failover-no-replacement.test.ts`

- [ ] First write failing tests proving: follow-up text/API cannot change a direct run's CLI; cross-provider failover returns a distinct target run; target unavailable preserves quota recovery; and direct/commit worker insertion of another type is rejected at the central assertion and SQLite trigger.
- [ ] Add `assertDirectRunWorkerTypeInvariant` before all direct/commit worker insertions and an additive SQLite `BEFORE INSERT ON workers` trigger as the final safety net. The trigger applies only when the referenced run has `session_type = 'omni'` and `mode IN ('direct', 'commit')`, and only rejects a *new* row whose normalized type differs from an existing worker; creating it on a legacy database never scans/rejects pre-existing mixed rows. Do not restrict intentional multi-type supervisor implementation runs.
- [ ] Catch the trigger's stable constraint marker at the shared worker-insert boundary, map it to typed HTTP `409 handoff_required` plus surfaced code `handoff.fork_required`, emit `handoff.refused`, and translate visible guidance at the UI boundary; never leak a raw SQLite 500.
- [ ] In `applyWorkerPreferenceForMessage`/`reconcileDirectWorkerSelection`, reject a type change for an existing run with a typed “fork required” result; do not persist the new preferred type and do not defer it for later recreation.
- [ ] Keep same-CLI model, effort, and account recreation behavior and its current ownership fencing.
- [ ] Change `src/server/credits/index.ts` so `cross_provider` selects and returns a candidate target CLI/account without mutating source credentials; validate it is not quota-blocked or in the recent exhaustion cooldown.
- [ ] Route cross-provider quota strategy/allowed-worker selection to `coordinator.captureAndLaunch` and return `targetRunId` rather than a replacement worker ID. Enforce automatic chain depth three and recent-provider/account exclusions.
- [ ] Keep the existing `worker-failover.ts` exports as compatibility wrappers while callers/tests migrate; do not delete the file.
- [ ] Update wake/restart recovery to continue a persisted handoff rather than retrying a same-run provider spawn.
- [ ] Update supervisor prompt and settings explanation to say cross-provider recovery creates a new session.
- [ ] Rename user-visible lifecycle copy from “switching workers” to handoff/fork language while retaining legacy event parsing only where backward compatibility needs it.
- [ ] Run `pnpm vitest run tests/server/workers/direct-run-type-invariant.test.ts tests/api/conversation-messages-route.test.ts tests/supervisor/worker-failover.test.ts tests/supervisor/worker-failover-handoff-fails.test.ts tests/supervisor/worker-failover-spawn-retry.test.ts tests/supervisor/worker-failover-no-replacement.test.ts` and assert no direct/commit source run contains workers of two CLI types.

### Task 10: Build the client Manager and dialog

**Files:**
- Create: `src/interface/home/HandoffForkManager.ts`
- Create: `src/interface/home/HandoffForkDialog.tsx`
- Create: `src/components/home/CliLaunchSelectionFields.tsx`
- Modify: `src/interface/home/useHomeMutations.ts`
- Create: `tests/app/handoff-fork-manager.test.ts`
- Create: `tests/ui/handoff-fork-dialog.test.tsx`
- Modify: `shared/locales/*.json`

- [ ] Implement a Manager-owned state machine for closed/selecting/capturing/ready/editing/launching/completed/error, including source run/message IDs, revision, target selection, packet, warnings, and request token.
- [ ] Use TanStack Query only for transport/cache; the Manager is the single UI source of truth and ignores responses whose ownership token no longer matches.
- [ ] Build an accessible, responsive dialog using existing Dialog/Select/Textarea/Button/ScrollArea/Alert/Badge primitives.
- [ ] Keep dialog open/target selection read-only. Label **Prepare handoff** as the point that stops the source CLI; after preparation, cancel invokes the server's single unsuccessful-settlement helper, preserving a durable quota wake or exposing stage-specific recovery.
- [ ] Default to the last compatible *different* CLI, exclude the source CLI, and validate account/model/effort combinations before capture/launch.
- [ ] Show authoritative sections read-only, advisory fields editable, source/provenance/warnings visible, and an explicit “current files win” note.
- [ ] Debounce or explicitly save advisory edits with `expectedRevision`; disable launch until the current edit revision is acknowledged.
- [ ] Renew the ready lease while the preview is open without exceeding 15 minutes. On expiry, discard only unsaved local edits, show that the source remains recoverable, and offer **Prepare fresh handoff**; on tracked drift, offer the same recapture action rather than looping launch retries.
- [ ] Allow recovery of the active durable draft after reload and a clear cancel action before launch for both manual and quota drafts.
- [ ] Add all visible/aria/error strings to every `shared/locales/*.json` file and subscribe with `useI18nSnapshot()`.
- [ ] Test keyboard focus, escape/cancel, mobile sizing, loading/error/retry states, stale edit conflicts, CLI exclusion, and no hard-coded user-facing JSX.
- [ ] Run `pnpm vitest run tests/app/handoff-fork-manager.test.ts tests/ui/handoff-fork-dialog.test.tsx`.

### Task 11: Wire every product entry point

**Files:**
- Modify: `src/interface/home/useConversationActions.ts`
- Modify: `src/interface/home/ExternalSessionsPicker.tsx`
- Modify: `src/components/home/HomeHeader.tsx`
- Modify: `src/components/home/ConversationMain.tsx`
- Modify: `src/components/home/RunRecoveryNotice.tsx`
- Modify: `src/interface/home/HomeApp.tsx`
- Modify: `tests/ui/conversation-actions.test.ts`
- Modify: `tests/server/external-sessions/discovery.test.ts`
- Modify: `shared/locales/*.json`

- [ ] Add **Fork to another CLI** to the session menu for eligible direct/commit runs.
- [ ] Add **Fork to another CLI from here** to user-message actions and pass the exact message ID.
- [ ] Add a distinct current-conversation fork choice to Resume CLI Session without changing external Claude/Gemini resume behavior.
- [ ] Add a quota notice action/status that opens or navigates to the automatic handoff and target run.
- [ ] Add a quota/recovery notice action that cancels an abandoned ready/capturing handoff or retries a `needs_recovery` source; do not require the lost dialog state to release a fence.
- [ ] Keep `HomeApp.tsx` as wiring only and extract any message-action UI needed to avoid growing oversized components.
- [ ] On success, select the target only if the user is still viewing the source associated with the completed request; otherwise show a non-destructive notification/link.
- [ ] Preserve ordinary “Fork session” semantics if it remains same-CLI, and make the cross-CLI wording unambiguous.
- [ ] Test eligibility, source/message payloads, no selected run, unsupported modes, selection races, external resume regression, and quota CTA behavior.
- [ ] Run `pnpm vitest run tests/ui/conversation-actions.test.ts tests/server/external-sessions/discovery.test.ts`.

### Task 12: Reconcile SSE, restart, and lifecycle recovery

**Files:**
- Modify: `src/interface/home/EventStreamStateManager.ts`
- Modify: `src/interface/home/utils.ts`
- Modify: `tests/app/event-stream-state-manager.test.ts`
- Create: `tests/lifecycle/scenarios/cross-cli-handoff-fork.test.ts`
- Create: `tests/lifecycle/scenarios/cross-cli-handoff-restart.test.ts`

- [ ] Reconcile capture/revision/launch/completion/failure events into existing run snapshots without creating optimistic fake runs.
- [ ] Fetch snapshot/active handoff after `stream.resync_required`; treat SSE as an invalidation signal and HTTP/SQLite as authority.
- [ ] Add a manual lifecycle scenario covering source activity, stable capture, packet artifact, target run/worker/seed, source stop, and no mixed CLI types.
- [ ] Add quota and manual scenarios proving the source worker is never prompted, persisted capture succeeds, and the target new run continues.
- [ ] Add restart checkpoints after `capturing`, `ready`, and `launching`; prove recovery either finishes once or surfaces a retryable failure without duplicate targets.
- [ ] Add FK/delete coverage: deleting the source removes its packet metadata/artifact while the target's seed remains readable.
- [ ] Validate every decision through `/api/events/log?since=<id>&runId=<id>` and assert named refusal/failure events exist.
- [ ] Run the focused state-manager test, then `pnpm test:lifecycle`.

### Task 13: Full verification and handoff documentation

**Files:**
- Modify only as failures require within the files already listed.
- Verify: `.gitignore`

- [ ] Re-read both architecture docs and confirm every new server decision emits a named event and every user-relevant failure emits a stable `error.surfaced` code.
- [ ] Verify every target seed was persisted through `appendUserInputOnDelivery` and no parallel conversation storage was introduced.
- [ ] Verify cross-CLI targets copy no source message rows/worker entries: only parent/message metadata plus the rendered first `user_input` packet crosses the boundary.
- [ ] Verify logs/events demonstrate confirmed source process exit before target run creation and that the direct/commit SQLite trigger rejects mixed worker types.
- [ ] Verify all visible strings use `t()` and all locale files contain the same new keys.
- [ ] Verify packet storage, test databases, generated debug packets, CLI transcripts, credentials, and temporary review output are not accidentally tracked; make only a narrow `.gitignore` addition if needed.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm vitest run`.
- [ ] Run `pnpm test:lifecycle`.
- [ ] Run the mandatory frontend build: `pnpm build:interface:web`.
- [ ] Inspect `git diff --check` and `git status --short`; preserve unrelated user changes and confirm the implementation did not create a branch, worktree, or delete files.

## Verification matrix

| Case | Expected result |
|---|---|
| Header fork, idle source | Prepare verifies no live runtime, captures final state, and only then allows creation of a distinct target run. |
| Header fork, active turn | Prepare generation-fences, settles, terminates, and confirms source process exit before capture; target creation cannot overlap. |
| Source CLI refuses to exit | Launch is refused before target creation; the unsuccessful-settlement helper restores a durable quota wake or uses `needs_recovery`; named failure identifies termination. |
| Another live run uses checkout | Workspace lease/preflight refuses handoff; neither source nor other run is mutated. |
| Message fork | Conversation is bounded at the message; current workspace drift is explicit; `forkedFromMessageId` is preserved. |
| Manual preview becomes stale | Sequence/HEAD/workspace fingerprint drift returns `handoff.source_changed`; user must prepare a fresh packet. |
| Ready preview abandoned | Lease expires by 15 minutes, source marker/fence clears, quota wake or recovery state is restored, and reopening offers a fresh prepare. |
| Resume CLI Session dialog | External resume still resumes an external provider session; current-conversation fork opens handoff flow. |
| Quota, outgoing CLI dead | No outgoing request; synthetic packet launches a distinct target run. |
| Quota, target unavailable | Preflight failure leaves `quota_waiting` untouched; post-stop failure restores its durable future wake or uses `needs_recovery`; no success is reported. |
| Quota handoff loop | Recent exhausted providers/accounts are excluded; depth four is refused with a visible wait/manual-recovery state. |
| Same-run text asks to switch CLI | Request is refused with fork guidance; source preferences/worker type do not change. |
| Same-CLI model/account change | Existing supported recreation path still works inside the run. |
| Already compacted source | Provider recap is advisory; post-compaction evidence and exact recent tail are included. |
| Dirty workspace before session | Pre-existing files are not claimed as session-owned; uncertainty is preserved. |
| Concurrent/external file change | Ownership becomes external/unknown; packet does not overwrite or silently attribute it. |
| Packet overflow | Highest-priority facts remain; dropped fields are named; hash is deterministic. |
| Reload while preview is ready | Active draft and revision restore from server; edits do not regress. |
| Disconnect during launch | SSE replay/snapshot returns one target; repeated operation ID is idempotent. |
| Crash after target row creation | Reconciler discovers exactly one target by `originHandoffId`, adopts or fails it, and releases the claim/lease. |
| Target deleted during launch | Handoff terminalizes and source/workspace fence releases before the target link is nulled. |
| Delete source after completion | Source metadata/artifact is cleaned; target initial seed remains self-contained. |

## Agentic user-journey candidates (approval required before running)

These browser journeys are valuable after automated tests/build pass, but they must not be run without explicit user approval because they create real local conversations and CLI activity:

1. Start a Codex direct session, make a small edit, open the header handoff dialog, inspect/edit the packet, fork to Claude, verify the new sidebar session and source preservation, then clean up the test conversations/artifacts.
2. Fork from an earlier user message and confirm the preview distinguishes historical conversation state from the current checkout.
3. Simulate/induce a quota-waiting source through supported test controls, select cross-provider recovery, verify the synthetic packet and target navigation, then clean up.
4. Reload the browser while a handoff preview is open and while launch is completing; verify restoration, SSE replay, and no duplicate target.

## Implementation guardrails

- Begin implementation by rechecking `git status --short`; the current worktree already contains user changes. Never overwrite, revert, or reformat unrelated edits.
- Do not create a branch or worktree and do not delete any file.
- Keep new logic out of `HomeApp.tsx`, `ConversationMain.tsx`, `runs/recovery.ts`, and `worker-failover.ts` except thin integration/delegation because all are already oversized.
- Use `src/server/git/command.ts` or existing async helpers for git evidence; avoid synchronous shell calls in request paths.
- Never log or emit the full packet in named events, errors, or ordinary server logs.
- Never pass translated strings through transactions or persist translated UI copy.
- Never treat an LLM-generated summary as proof that a file changed, a test passed, or a command ran.
- Do not add configurable frontend strings/settings through `.env`; packet limits are code constants.
- Clean up test conversations and persisted artifacts after any approved live/agentic validation.
