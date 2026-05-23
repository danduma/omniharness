# Timing Determinism Audit

This audit records repository patterns where behavior can depend on timing:
which request returns first, whether a timer fires before navigation, whether
cached state arrives before live state, or whether two control-plane actors see
the same row before either one updates it.

The goal is not to ban optimistic UI. Optimism is good when it is explicit.

## Optimism Contract

Optimistic state is allowed when all of these are true:

1. The optimistic object has an owner token, such as `requestedRunId`,
   `projectPath + requestId`, `pairingId`, `workerId + afterSeq`, or
   `operationId`.
2. The UI can represent the state as `pending`, `reconciled`, or `failed`.
3. A later authoritative server snapshot can prove whether the optimistic
   state was accepted, replaced, or rejected.
4. A stale async response cannot overwrite state owned by a newer request.
5. Cached or optimistic data can pre-render, but it must not be counted as
   fully loaded or authoritative.

The bug pattern we are hunting is different: state that is treated as verified
truth only because a request, timer, cache hydration, observer poll, or SSE
frame happened to arrive in a lucky order.

## High-Confidence Findings

## Resolution Ledger

These fixes were applied with tests so future work can preserve the same
determinism contract:

- Snapshot cache hydration is now marked as `snapshotSource: "cache"` and
  cannot satisfy authoritative selected-conversation load gates.
- Frontend SSE connects with the bootstrap `initialLastEventId` anchor so
  named events emitted between snapshot bootstrap and stream open can replay.
- Persisted snapshot fallback now reads `x-omni-last-event-id` and owns the
  browser event cursor. When the server emits `stream.resync_required`, the
  client closes the unsafe stream, loads an authoritative persisted snapshot,
  updates the cursor, and reconnects SSE from that anchor.
- Project memory list/file/toggle/save requests carry request generations and
  patch only while the same project/path still owns the response.
- Git workspace status and operations carry per-project request ids; stale
  responses no longer overwrite newer project state, and global pending state
  stays active while any project operation is still running.
- Pair-device activation and polling patch only the active `pairingId`.
- Pair-device status polling also carries a per-poll request id, so an older
  in-flight poll for the same pairing cannot overwrite a newer status or error.
- Conversation mutation navigation is owner-scoped. Optimistic new
  conversations may still render immediately, but stale success/error handlers
  cannot navigate after the user selects another conversation. Source-run
  mutations, such as planning promotion, must prove the source run was actually
  selected when the mutation started and is still selected when it resolves.
- Message-send side effects are scoped to the submitted run and submitted
  composer draft; late responses cannot clear a newer draft in another
  conversation.
- Auto-resume timers re-check the selected run and failure generation at fire
  time before retrying, and now re-check the selected checkpoint, failed status,
  worker availability, worker-failure detail, and pending recovery state.
- Supervisor wake lease contention and durable wake claims emit named events;
  due durable wake claiming uses a single `DELETE ... RETURNING` transition.
- Snapshot SQL and frontend "latest" sorts use stable id tie-breakers for
  equal timestamps.
- Supervisor context and observer event reads also use id tie-breakers for
  equal timestamps, including in-memory context row sorting.
- Recovery fork source selection, recovery transcript copying, quota incident
  selection, recovery notice selection, and snapshot-cache pruning now use
  deterministic id/key tie-breakers when timestamps tie.
- Worker stream fetching now retries when a wake-up advances a worker's known
  sequence while an older empty fetch is still in flight. A selected direct
  conversation no longer depends on a later remount/session switch to fetch
  entries that were announced during the in-flight request.
- Selected direct worker streams keep a validation refresh even after the
  visible worker looks idle. A missed `worker.entry_appended` wake-up or stale
  `workerEntrySeqs` hint can no longer leave a selected terminal at `0/0`
  until reload.
- The browser event client now keeps a lightweight persisted-snapshot
  validation loop even when EventSource is open. An open SSE socket is no
  longer treated as proof that no run/status/message/worker-entry cursor update
  was missed.
- The direct-control pending assistant indicator is now tied to actual direct
  worker activity or pending send ownership, not to a stale `running` run row
  by itself.
- Direct conversation sync now treats "adapter still says working" as lower
  authority than a completed worker-stream turn. If the selected direct
  transcript has no open tool/permission and ends in an assistant message, the
  run is quiesced to `done` and the worker to `idle`.
- Lifecycle tests now wait for server-owned fire-and-forget conversation turns
  before deleting temporary roots. A passing test suite with background
  `run-data` write failures is not acceptable evidence.
- Worker failover selection failures preserve the concrete availability error
  in both execution events and `worker.failover_failed` named events.
- Saved-session recovery paths now emit `worker.reattached` for successful
  session reuse and `worker.recreated` when a rejected/expired session id is
  replaced by a fresh runtime worker. Fresh-worker fallback also clears the
  invalid session id instead of carrying it forward as authority.
- Planning-review planner recovery now distinguishes missing-session errors
  from transient bridge/runtime failures before reattaching or recreating the
  planner worker.
- Initial direct/planning worker spawn failures now take the same terminal
  branch: persisted run/worker state, worker-stream lifecycle entry, named
  `worker.status`, and `error.surfaced`. A background spawn rejection can no
  longer leave a new session indefinitely in `starting`/`Thinking...`.
- Persisted snapshot `notModified` responses still carry `workerEntrySeqs`, so
  a worker-stream manager that missed or lost its in-memory cursor can recover
  from an unchanged authoritative snapshot.
- Composer pending-send and stop-button state is now scoped to the selected
  run. A pending message or stop mutation for another run can no longer hide,
  disable, or retarget the stop affordance after a session switch.
- Planning promotion, run recovery, and recovery-resume mutation pending states
  are now scoped to the selected run via `isMutationPendingForSelectedRun`.
  A pending `promotePlanningConversation`, `recoverRun`, or `resumeRunRecovery`
  in run A can no longer lock the composer, suppress auto-resume, or show
  "resuming" in run B after a session switch. The preflight-answering gate was
  also corrected to use the already-scoped `isSendingSelectedConversationMessage`
  flag instead of the global `sendConversationMessage.isPending`.
- Heuristic observer/stabilization breadcrumbs remain low-authority and hidden
  from visible recovery/error surfaces unless confirmed by run state or durable
  recovery state.

### 1. Cached conversation snapshots can masquerade as authoritative loads

Files:

- `src/app/home/EventStreamStateManager.ts`
- `src/app/home/EventStreamSnapshotCacheManager.ts`
- `src/app/home/useHomeViewModel.ts`

`hydrateFromCacheScope()` swaps in a cached scoped snapshot and preserves the
cached `snapshotRunId`. `useHomeViewModel()` then treats
`state.snapshotRunId === selectedRunId` as `isSelectedConversationLoaded`.

That makes a frontend cache load indistinguishable from a fresh server snapshot.
The conversation may render as fully loaded before `/api/events?runId=...`
actually proves that the selected conversation is current. This is the same
class of bug as "load once and only see the initial message, load again and
everything appears": the UI lacks a verifiable source/provenance bit.

Required shape:

- Keep cache pre-rendering.
- Add explicit snapshot provenance, for example
  `previewSource: "cache" | "optimistic" | "server"`.
- Split the current boolean into:
  - `hasPreviewForSelectedConversation`
  - `hasAuthoritativeSnapshotForSelectedConversation`
  - `isFullyLoaded`
- Only the authoritative server snapshot may satisfy full-load gates.

Resolved shape:

- `EventStreamStateManager` tags frontend cache hydration as
  `snapshotSource: "cache"` and server updates as `snapshotSource: "server"`.
- `useHomeViewModel()` requires both matching `snapshotRunId` and
  `snapshotSource: "server"` before the selected conversation counts as
  loaded.
- Cache previews can still render immediately, but loading/error/full-state
  gates wait for server authority.
- `tests/app/event-stream-state-manager.test.ts` and
  `tests/app/home-view-model.test.ts` cover cache preview provenance and
  selected conversation load gating.

### 2. The browser event client must own the snapshot anchor across SSE gaps

Files:

- `src/app/home/LiveEventConnectionManager.ts`
- `src/runtime/http/routes/events.ts`
- `docs/architecture/lifecycle-observability-and-testing.md`

The server exposes the right protocol: `GET /api/events?snapshot=1` returns
`x-omni-last-event-id`, and the SSE route accepts `Last-Event-ID` or
`?lastEventId=`.

The frontend originally opened `new EventSource(buildEventStreamUrl(...))`
from the initial bootstrap anchor only. Snapshot fallback polled through
`requestJson`, which discarded response headers, and `stream.resync_required`
only reset the worker-entry cursor. After a ring-buffer gap, the browser could
keep listening from an unsafe stream without ever learning the newer snapshot
anchor.

That meant named events emitted during a disconnect or buffer gap could be
missed until a later reload, session switch, or unrelated snapshot happened to
rebuild state. Worker entry content can often recover via `workerEntrySeqs`,
but discrete lifecycle events still depended on timing.

Resolved shape:

- Initial browser bootstrap must read the snapshot anchor.
- SSE connect must include that anchor, probably via `?lastEventId=...`
  because browser `EventSource` cannot set arbitrary headers.
- Snapshot fallback updates the local anchor when it receives a newer
  `x-omni-last-event-id`.
- `stream.resync_required` closes the unsafe `EventSource`, loads a persisted
  snapshot, applies its state and worker seq hints, then reopens SSE with the
  snapshot-owned cursor. If the snapshot cannot load, fallback polling remains
  active rather than pretending the old stream is trustworthy.

### 3. Project memory panel accepts stale async responses

File: `src/app/home/ProjectMemoryPanelManager.ts`

`reloadList()`, `loadFile()`, `toggleEnabled()`, and `save()` read
`projectPath` / `selectedPath`, await a fetch, then patch manager state without
checking that the project and selected file are still the same.

Failure modes:

- Select project A, request is slow, select project B, project A response
  overwrites project B's file list.
- Select file A, then file B, file A response overwrites editor content for B.
- Save file A, switch file/project, delayed save completion marks the wrong
  content as saved.

Required shape:

- Add request tokens per operation.
- Patch only if the current `projectPath`, `selectedPath`, and token still
  match the request owner.
- Keep optimistic save feedback, but make it owner-scoped.

Resolved shape:

- `ProjectMemoryPanelManager` invalidates list, file, toggle, and save request
  ids when the project or selected file changes.
- List, file, toggle, and save responses patch state only while the matching
  request id and owner path are still current.
- Save completion also proves the submitted content is still the visible draft
  before setting `originalContent` or `saveStatus: "saved"`, so an old save
  cannot label a newer draft as saved.
- `tests/app/project-memory-panel-manager.test.ts` covers stale list/file
  responses, stale project toggle responses, latest same-project toggle
  ownership, and stale save completion after draft edits.

### 4. Git workspace operations have project-level and global races

File: `src/app/home/GitWorkspaceManager.ts`

`loadStatus(projectPath)` tracks `loadingByProject[projectPath]`, but no
request generation. Two status loads for the same project can resolve out of
order, with the older response overwriting the newer snapshot.

`runOperation()` uses one global `pendingOperation` and `lastError`. Concurrent
operations on different projects can clear or replace each other's pending and
error state. Several payload appliers also merge against `this.getSnapshot()`
after the await, which makes the result depend on whatever unrelated state
changed while the request was in flight.

Required shape:

- Track `operationId` by project and operation.
- Store pending/error state by project.
- Apply a response only if its operation id still owns that project slot.
- Keep cached git snapshots as previews, not as proof that a live status load
  completed.

Resolved shape:

- `GitWorkspaceManager` tracks status request ids by project and operation ids
  by project. Stale same-project status and operation responses cannot replace
  newer state.
- Pending operation remains globally visible while any project operation is
  active, but error display is stored and selected by project via
  `lastErrorByProject`.
- Branch and fork worktree surfaces read the error for their project instead
  of rendering a global error from another project.
- `tests/app/git-workspace-manager.test.ts` covers stale same-project status,
  concurrent project pending state, and project-scoped operation errors.

### 5. Mutation success handlers can still navigate from stale ownership

File: `src/app/home/useHomeMutations.ts`

Known-fixed example: `recoverRun.onSuccess` now checks whether the source run is
still selected before navigating.

Remaining audit hits:

- `autoCommitProject.onSuccess` unconditionally selects `data.runId`.
- `promotePlanningConversation.onSuccess` unconditionally selects `data.runId`.
- `runCommand.onSuccess` intentionally selects the created run, but the owner is
  implicit rather than encoded as a reusable navigation contract.

These may be correct for direct user commands, especially "start new
conversation" where immediate optimistic navigation is desired. The missing
piece is an explicit rule for when a mutation owns navigation after the user has
changed context.

Required shape:

- Keep immediate optimistic navigation for new conversations.
- Add a helper such as `shouldNavigationMutationSelectResult({ kind,
  requestOwner, currentSelection, currentDraftProject, resultRunId })`.
- Tests should cover "user starts action, switches session, stale success
  returns" for every mutation that calls `setSelectedRunId`.

Resolved shape:

- `useHomeMutations.ts` now exposes explicit ownership helpers for optimistic
  run creation, project-created results, source-run results, and submitted
  conversation side effects.
- New conversation creation keeps immediate optimistic navigation to the
  reserved run id, but success/error handlers reconcile only while that
  reserved id still owns the selection.
- Project commit and planning promotion success handlers use project/source
  ownership guards before selecting their result or clearing composer state.
- Delete/archive rollback restores the previously removed selection only while
  the optimistic removal still owns the empty selection, so late failures cannot
  steal navigation after the user selects another conversation.
- `tests/app/home-mutation-ownership.test.ts` covers stale success after
  selection changes and stale error rollback for each navigation ownership
  class.

### 6. Message sends and history hydration update global surfaces after context changes

File: `src/app/home/useHomeMutations.ts`

`sendConversationMessage.onSuccess` appends the returned message by id, which is
mostly safe, but it also clears the current composer and scrolls the current
conversation to bottom. If the user has changed sessions during upload/send, a
stale success can affect the wrong visible conversation.

`handleLoadWorkerHistory()` dedupes only by `workerId`; the full history
response can replace an agent snapshot after newer live stream data has already
arrived. There is no cursor, `updatedAt`, or generation check.

Required shape:

- Message-send side effects should be scoped to the run that owned the send.
- Worker history loads should have a request generation and merge only if they
  are newer than the current agent/worker stream cursor.

Resolved shape:

- Message-send composer clearing and selection side effects are scoped to the
  submitted run and draft identity.
- Full worker-history hydration no longer blindly replaces the current agent
  snapshot. It merges history output entries with current entries by stable id
  and preserves newer live agent metadata when the current snapshot has a newer
  `updatedAt`.
- `tests/app/home-mutation-ownership.test.ts` covers submitted-draft clearing
  ownership and late worker-history hydration preserving newer live state.

### 7. Pairing polling lacks an in-flight ownership check

File: `src/components/PairDeviceDialog.tsx`

`createPairing()` correctly guards server activation by comparing
`pairingId`. The polling interval does not. A status request can be in flight
while the user refreshes the code or closes the dialog; the delayed response can
set `pairingStatus` or `error` for a stale pairing.

Required shape:

- Capture `pairingId` in the poll.
- On response/error, patch only if the current pairing still has that id and
  the dialog is still open.
- Avoid overlapping polls for the same pairing, or track poll generations.

Resolved shape:

- `PairDeviceStateManager.beginStatusPoll()` issues a per-poll request id for
  the active pairing.
- Poll responses and errors call `patchIfCurrentStatusPoll(pairingId,
  requestId, ...)`, so a late older status for the same pairing cannot replace
  a newer status.
- `tests/app/pair-device-manager.test.ts` covers both stale pairing ids and
  stale same-pairing poll generations.

### 8. Auto-resume timer still has a narrow stale-fire window

File: `src/app/home/HomeApp.tsx`

Inactive timers are cancelled when `selectedRunId` changes, which is good. The
timer callback still only checks the auto-resume map entry; it does not
re-validate the current selected run, failure key, or recovery preconditions
immediately before calling `recoverRun.mutate`.

A timer can fire at the same time as navigation or state recovery. That is a
small window, but it is the exact class of race this audit is targeting.

Required shape:

- Store the owner state in the timer entry.
- In the timeout callback, re-read current UI/run state and prove that the same
  run and failure key still own the retry.

Resolved shape:

- Auto-resume timer entries store both `failureKey` and `targetMessageId`.
- `HomeApp` keeps a current runtime facts ref for the selected run, status,
  checkpoint, worker availability, worker-failure detail, and pending recovery
  state.
- The timer callback calls `shouldFireAutoResumeTimer()` with those current
  facts before mutating recovery state.
- `tests/app/auto-resume-selection.test.ts` proves stale run selection, stale
  failure generation, stale checkpoint, non-failed status, and unavailable
  worker state all block the delayed retry.

### 9. Supervisor wake lease contention is mostly silent

Files:

- `src/server/supervisor/wake.ts`
- `src/server/supervisor/lease.ts`

`executeSupervisorWake()` returns silently when another in-process wake is
already in flight. Lease acquisition failure retries after one second. Insert
conflict in `acquireSupervisorWakeLease()` returns `null` without a named event.

Some of this is correct coordination, but it is not observable enough. When a
supervisor appears stuck, we need to distinguish:

- another wake is already running,
- a durable lease is held,
- a lease was malformed/expired,
- an orphaned lease was recovered,
- retry scheduling is active.

Required shape:

- Emit named events for lease blocked/acquired/released/recovered decisions.
- Keep high-frequency events deduped, but do not make the decision invisible.
- Add lifecycle tests that assert a blocked wake eventually either acquires or
  emits a recover/give-up decision.

Resolved shape:

- `acquireSupervisorWakeLease()` emits `supervisor.wake_lease_acquired` with
  `insert`, `replace_expired`, or `replace_malformed` source.
- Lease acquisition refusal emits `supervisor.wake_lease_blocked` with
  `active_lease`, `insert_conflict`, or `claim_race`.
- `releaseSupervisorWakeLease()` emits either
  `supervisor.wake_lease_released` or
  `supervisor.wake_lease_release_skipped` with `missing`, `malformed`, or
  `not_owner`.
- Orphaned completion recovery emits `supervisor.wake_lease_recovered` and the
  durable execution event.
- `tests/supervisor/lease.test.ts` and `tests/supervisor/wake.test.ts` assert
  those branch decisions directly from the named-event ring.

### 10. Durable wake claiming is select-then-delete

File: `src/server/supervisor/wake-schedule.ts`

`claimDueDurableSupervisorWake()` selects a due wake, then deletes by `runId`,
then returns the selected row. Two callers can select the same due row before
either delete completes. The supervisor lease probably prevents duplicate
execution later, but the durable wake claim itself is not a single verifiable
state transition.

Required shape:

- Claim in one transaction or use a conditional delete/returning pattern.
- Emit a named event when a durable wake is claimed, skipped, or already taken.

Resolved shape:

- `claimDueDurableSupervisorWake()` uses a single
  `DELETE ... WHERE wake_at <= now RETURNING *` transition.
- `executeSupervisorWake()` emits `supervisor.durable_wake_claimed` only when
  that atomic claim returns a row.
- `tests/supervisor/wake-schedule.test.ts` proves concurrent claimers can
  claim a due durable wake only once.

### 11. Timestamp-only ordering creates nondeterministic "latest" records

Files:

- `src/server/events/persisted-snapshot.ts`
- `src/runtime/http/routes/events.ts`
- `src/server/supervisor/wake.ts`
- `src/app/home/useHomeViewModel.ts`
- `src/app/home/BusyMessageQueueManager.ts`

Many queries and client sorts order only by `createdAt` or `updatedAt`. SQLite
can return ties in an implementation-dependent order. JavaScript sorts with a
zero comparator preserve input order, but the input order may already be
unstable if it came from timestamp-only SQL.

Risk areas:

- "latest execution event"
- "latest recovery incident"
- "latest queued message"
- "latest clarification"
- "latest awaiting-user question"
- "first active worker" when two workers share timestamps

Required shape:

- Every "latest" query needs a stable tie-breaker such as `(createdAt, id)` or
  a monotonic seq.
- For worker streams, prefer `seq` over timestamps.

Resolved shape:

- Event payload snapshot routes order timestamped rows by `(createdAt, id)`.
- Frontend helpers use `compareNewestByCreatedAtThenId` and
  `compareOldestByCreatedAtThenId`.
- Supervisor observer/context paths now use `desc(executionEvents.createdAt),
  desc(executionEvents.id)` for timestamp-ordered event reads.
- Supervisor context in-memory message and worker sorts use an explicit
  `createdAt + id` comparator.
- Handoff synthesis, queued-message selection/draining, recovery checkpoint
  reads, worker snapshot prompt matching, planning refresh/review/promotion
  reads, CLI/ACP replay, all-message reads, and plan/session list endpoints now
  include id tie-breakers on timestamp-ordered SQL.
- The remaining timestamp-order search hits in `src` include explicit id
  tie-breakers.
- `tests/server/supervisor-ordering-source.test.ts` and the
  `latestRunWorkerEvents` observer regression preserve these ordering
  contracts.

### 12. Worker failover hides selection failure detail

File: `src/server/supervisor/worker-failover.ts`

`selectSpawnableWorkerTypeAsync()` failures are caught and collapsed into
"All allowed worker types are quota-blocked." This may be a fine user outcome,
but the specific decision is lost unless the deeper function emitted its own
event.

Required shape:

- Preserve the selection error in an execution event or `worker.failover_failed`
  named event.
- Make "quota-blocked" vs "worker availability check failed" distinguishable.

Resolved shape:

- `attemptWorkerFailover()` preserves replacement selection exceptions as
  `worker_failover_failed` execution events with `stage: "selection"` and as
  `worker.failover_failed` named events.
- The returned no-replacement reason distinguishes availability-check failure
  from ordinary quota-blocked exhaustion.
- `tests/supervisor/worker-failover-no-replacement.test.ts` covers the
  selection-failure branch, and lifecycle failover transcript tests cover
  `worker.failover_failed` SSE delivery/replay.

### 13. Observer stuck/idle logic is time-threshold based and must stay low-authority

File: `src/server/supervisor/observer.ts`

The observer derives `worker_idle` and `worker_stuck` from elapsed silence and
progress fingerprints. That is inherently heuristic. This is acceptable only if
the resulting status is treated as a hint, not as proof that a worker failed.

Recent UI fixes already moved in this direction by hiding stale stuck state
unless the selected run is actually running. Keep applying that rule:

- Heuristic events can wake the supervisor.
- They should not be rendered as hard user-visible failures unless confirmed by
  run state or a durable recovery incident.
- Tests should inject time deterministically rather than waiting wall-clock
  intervals.

Resolved shape:

- The frontend gates stuck-worker recovery behind `selectedRun.status ===
  "running"` before it can drive `hasStuckWorker` or the execution panel.
- Awaiting-user, terminal, and needs-recovery runs do not surface stale
  worker-stuck heuristics as active work.
- Started run-observer polls carry an observer generation. If the observer is
  stopped or restarted while an async poll is in flight, the old poll returns
  before persisting worker snapshots or execution events.
- Observer tests drive silence/churn thresholds with explicit timestamps, and
  `tests/app/home-view-model.test.ts` covers stale stuck state while awaiting
  user input.

### 14. Worker stream wake-ups can arrive while an older fetch is in flight

File: `src/app/home/WorkerEntriesManager.ts`

The unified worker stream is intentionally split: SSE sends only
`worker.entry_appended { workerId, seq }`, and the client fetches content from
`/api/workers/:workerId/entries?afterSeq=...`.

The risky timing pattern is:

1. A fetch is already in flight for `afterSeq=N`.
2. A new wake-up arrives and raises `latestKnownSeq` to `M`.
3. The older fetch returns no new entries, for example because it was issued
   before the durable writer had published the later JSONL lines.
4. The manager records `latestKnownSeq=M` and `latestContiguousSeq=N`, but does
   not retry because the previous retry rule required forward progress.

That leaves the selected terminal stale until some unrelated path calls
`ensureLoaded()` again, such as switching away and back to the session. This is
not acceptable: the state already proves it is incomplete.

Required shape:

- Capture both contiguous and known cursors at fetch start.
- Retry after the fetch if either the contiguous cursor advanced or the known
  cursor advanced while the request was in flight.
- Keep the stale-server guard: do not loop forever when the server repeatedly
  reports `latestSeq` ahead but returns no entries and no newer wake-up arrives.

Resolved shape:

- `WorkerEntriesManager` records `latestContiguousSeq`, `latestKnownSeq`, and a
  per-worker wake version at fetch start.
- Fetch completion retries when the contiguous cursor advanced, the known cursor
  advanced, or any useful wake-up arrived during the in-flight request and the
  contiguous cursor still trails the known cursor.
- `workerEntrySeqs` snapshot hints can recover missed wake-up frames without
  becoming a parallel content source.
- `tests/app/worker-entries-manager.test.ts` covers in-flight empty fetch
  wake-ups, lower missing seq wake-ups, snapshot seq hints, loaded-state cursor
  checks, and stale old wake-up dedupe.

### 15. Live adapter active state can outlive a completed direct turn

File: `src/server/conversations/sync.ts`

Some adapters can keep reporting `state: "working"` after the visible direct
turn has finished. In the reported case, Gemini returned identical
`currentText`/`lastText`, all tool entries were completed, and the latest
worker-stream entry was an assistant message. The run and worker rows stayed
`running`/`working`, so the UI kept showing "Thinking..." even though the
transcript was complete.

This is another authority mismatch: bridge state is useful, but for direct
conversation turn completion it is not the only source of truth. The append-only
worker stream has stronger evidence about whether there is still open work in
the current turn.

Required shape:

- For direct runs, inspect the current turn entries after the latest
  user/supervisor input.
- If there are no open tool/permission entries and the latest meaningful entry
  is an assistant message, quiesce stale active adapter state to `done`/`idle`.
- Do not apply this to implementation sessions or to cancelled/error states.
- Keep active state when there is no terminal stream evidence; output text
  alone is not enough.

Resolved shape:

- Direct conversation sync inspects the unified worker stream for the current
  turn and treats a terminal assistant entry with no open tool/permission work
  as stronger completion evidence than stale adapter `working` state.
- The quiescing rule is limited to direct-style conversations and does not
  apply to implementation sessions or error/cancelled states.
- `tests/server/conversations-sync.test.ts` covers stale adapter-working direct
  runs and preserves active state when terminal stream evidence is missing.

### 16. Completed direct output must not remain in live-current fields

Files:

- `src/server/agent-runtime/manager.ts`
- `src/server/conversations/sync.ts`
- `src/server/workers/stream-writer.ts`
- `src/app/home/WorkerEntriesManager.ts`

The reported `a463020eb4ef` failure had two contradictory facts at once:
the direct worker was `idle` and the run was `done`, but the worker row still
stored the final answer in `currentText`. The UI treats `currentText` as live
draft/progress, so a terminal session could show final CLI output and still add
a trailing "Thinking..." indicator.

The same session also exposed an ordering hazard: a duplicate replay of the
initial user input could re-emit `worker.entry_appended` for an old seq after a
later seq had already been announced. That old wake-up is not content, but it
can collide with an in-flight fetch that has already observed a gap.

Required shape:

- Runtime completion copies the completed response to `lastText` and clears
  `currentText` before publishing an `idle` agent status.
- Direct terminal sync cleans up persisted `idle` direct workers whose
  `currentText` is just a stale copy of `lastText`.
- Stream writers emit `worker.entry_appended` only for newly appended entries,
  never for deduped stable ids.
- The frontend worker stream manager treats any useful wake-up during an
  in-flight fetch as a reason to retry if its contiguous cursor still trails
  the known cursor, including lower missing seq wake-ups.
- A terminal direct run overrides stale live-current fields for pending UI.
  `currentText` is useful while work is active, but it is not stronger than a
  terminal run status.

Resolved shape:

- Runtime completion clears `currentText` when publishing idle completion, and
  direct sync cleans stale persisted `currentText` on idle/done direct workers.
- Worker stream append helpers emit `worker.entry_appended` only for newly
  appended entries, not stable-id dedupes.
- Frontend worker stream fetching now retries on useful in-flight wake-ups.
- Direct pending-assistant classification returns false for terminal direct
  runs even when stale `currentText` remains.
- `tests/server/live-worker-snapshots.test.ts`,
  `tests/server/conversations-sync.test.ts`,
  `tests/server/workers/output-store.test.ts`, and
  `tests/app/worker-entries-manager.test.ts` cover the durable-output and
  duplicate-wake paths.

### 17. Active direct streams need independent revalidation and a stop target

Files:

- `src/app/home/HomeApp.tsx`
- `src/app/home/WorkerEntriesManager.ts`
- `src/components/home/ConversationComposer.tsx`
- `src/components/home/ConversationMain.tsx`

The direct-session UI can prove that work is active in more than one way. A run
row can be `running`, a worker can be `working`, a send mutation can be pending,
or the worker stream can have known-but-unloaded entries. A bug appeared when
the UI showed "Thinking..." from `selectedRun.status === "running"` but derived
the stop button only from a busy worker id. That created an impossible surface:
the user was told work was active but was given no stop control.

The same report exposed another stale-stream path. A direct follow-up was
persisted in the worker JSONL stream, but the selected terminal remained empty
until a force reload or session switch caused a fresh fetch. SSE and snapshot
cursors are the primary wake-up path, but a visible active direct stream cannot
depend solely on those events arriving at the right moment.

Required shape:

- Any UI path that shows direct-control work as active must also resolve a
  concrete stoppable worker id when one exists.
- A stale `running` direct run is not enough to render the terminal's pending
  assistant bubble. The bubble requires current direct activity: a pending
  send, `starting`/`working`/`stuck`/`recovering` worker state, or live
  `currentText`.
- Busy-with-text composers may keep the send/queue/steer button, but they must
  expose a separate stop button while the conversation is stoppable.
- The selected active direct worker stream must periodically revalidate from
  its current contiguous cursor. This refresh is a cursor check, not a parallel
  transcript source.
- A loaded worker stream may still be explicitly refreshed. "Loaded" means
  caught up to the latest known cursor, not permanently complete.
- A loaded-empty stream at seq `0` is only an observation that an old fetch saw
  no entries. On later subscription it must revalidate from seq `0`, because no
  positive cursor proves durable completeness.
- Exact manual `stop` / `/stop` text during active stoppable work is a
  control-plane stop command, not transcript content.
- The global event client must also periodically validate the selected
  persisted snapshot. EventSource `open` is transport state, not proof that the
  client has observed the latest durable run state.

Resolved shape:

- Direct activity is derived through `direct-control-activity.ts`; stale
  `running` rows alone cannot create a pending assistant bubble.
- Busy-with-text composers render a separate stop button when a conversation is
  stoppable, while still allowing queue/steer sends. Exact manual stop text is
  routed to the stop mutation and clears the draft instead of persisting a user
  message.
- Selected direct worker streams can refresh from their contiguous cursor even
  after a loaded state. Loaded-empty seq `0` streams revalidate on
  `ensureLoaded()`, and the global event client validates persisted snapshots
  while SSE is open.
- `tests/app/direct-control-activity.test.ts`,
  `tests/app/direct-worker-stream-loading.test.ts`,
  `tests/app/worker-entries-manager.test.ts`,
  `tests/app/busy-message-behavior.test.ts`,
  `tests/app/live-event-connection-manager.test.ts`, and UI composer tests
  cover the stop/refresh/loading invariants.

### 18. Server snapshots must retire optimistic run state

Files:

- `src/app/home/EventStreamStateManager.ts`
- `src/components/Terminal.tsx`

A direct follow-up can complete on disk while the browser still holds an
optimistic `running` row. The bad pattern is timestamp arbitration:

> "My local row has a later `updatedAt`, so it should beat this server row."

That is nondeterministic because the timestamp only says when a local preview was
created, not whether it is authoritative. It caused terminal states like `done`
or worker `idle` to be ignored until a full reload cleared the in-memory row.

Required shape:

- `snapshotSource: "server"` means the server owns run status. It must be able
  to retire optimistic `running`, `working`, or `cancelled` rows even when their
  local timestamps are newer.
- Optimistic preservation must be explicit and scoped: pending-created
  conversations, pending-sent messages, and pending-deleted conversations each
  have their own reconciliation maps. Do not use generic timestamp comparison as
  a fallback ownership model.
- Loading a worker transcript is not assistant activity. `isLoading` may render
  a loading empty state, but it must not fabricate a trailing "Thinking..."
  bubble. The pending assistant bubble requires explicit active-worker facts.

Resolved shape:

- Server snapshots are tagged with `snapshotSource: "server"` and bypass
  timestamp arbitration when merging scoped run rows.
- Cache snapshots remain preview-only and cannot satisfy selected conversation
  loaded gates.
- Terminal loading state no longer fabricates assistant activity; pending
  bubbles require explicit active direct-worker facts.
- `tests/app/event-stream-state-manager.test.ts`,
  `tests/app/home-view-model.test.ts`, and
  `tests/ui/terminal-unified-stream-order.test.ts` cover server-authoritative
  run retirement and terminal pending-state behavior.

### 19. Mutation result navigation needs source ownership

File: `src/app/home/useHomeMutations.ts`

Some mutations create or reveal a new conversation when they succeed. That is
allowed, but the success handler is asynchronous. It can resolve after the user
has selected another conversation, after route hydration has changed selection,
or after the same source run is selected for a different reason.

The bad pattern is treating a stale mutation success as permission to call
`setSelectedRunId(resultRunId)` merely because the current selection equals a
fallback source id. That can switch the user into an unrelated result session
without an explicit click.

Required shape:

- Optimistic create-run success handlers may reconcile the reserved client run
  id only if the selected run still equals the reserved id.
- Project-level create mutations may select their result only if the selected
  run at start still equals the selected run at completion. `null -> null` is
  valid because the user stayed in the project/new-session context.
- Source-run mutations may select their result only if the source run was
  actually selected at mutation start and is still selected at completion.
  Do not synthesize ownership with `selectedRunIdAtStart ?? sourceRunId`.
- Any success handler that legitimately changes selected conversation must keep
  the browser path in sync in the same owned branch.

Resolved shape:

- Conversation mutation helpers now distinguish optimistic-created,
  project-created, and source-run-created navigation ownership.
- Project-level creates only select when the selected run at start still equals
  the selected run at completion. Source-run mutations require the source run to
  have been selected at start and still selected at completion.
- Owned navigation branches update the browser path together with selection.
- Optimistic removal error branches restore selection only if the selected run
  at start was the removed run and the current selection is still empty.
- `tests/app/home-mutation-ownership.test.ts` covers project-created,
  optimistic-created, source-run-created result ownership, and optimistic
  removal error ownership.

### 20. Test cleanup cannot race server-owned background turns

Files:

- `src/server/conversations/worker-turn-gate.ts`
- `src/server/conversations/create.ts`
- `src/server/conversations/send-message.ts`
- `tests/lifecycle/harness/server.ts`

Direct and planning conversations intentionally return before the worker turn
finishes. The lifecycle harness used to close the HTTP server and immediately
delete its temporary `OMNIHARNESS_ROOT`. Background turns could still be writing
worker JSONL files at that moment, producing `ENOENT` after the test had already
passed. That is a false-green pattern: cleanup timing decided whether the
background failure was visible.

Required shape:

- Any fire-and-forget conversation turn is registered with a background task
  tracker.
- Lifecycle harness shutdown waits for tracked background tasks before deleting
  its temporary root.
- If a tracked background task never settles, cleanup fails the test via timeout.
- Do not solve cleanup-owned `ENOENT` by retrying worker file writes. The fix is
  deterministic ownership and quiescence, not hiding the symptom.

Resolved shape:

- Fire-and-forget conversation turns are registered with the worker turn gate.
- Lifecycle harness shutdown waits for tracked worker-turn tasks before
  deleting the temporary root, and timeout/failure remains visible to the test.
- `tests/server/conversations/worker-turn-gate.test.ts` and lifecycle tests
  preserve the cleanup/quiescence contract.

### 21. Idle live bridge text is not active work

Files:

- `src/server/workers/live-snapshots.ts`
- `src/app/home/direct-control-activity.ts`
- `src/components/Terminal.tsx`

Direct-control providers can leave the final assistant text in `currentText`
after the bridge state has returned to `idle`. If the snapshot forwards that
field as live text, the frontend has no deterministic way to distinguish stale
turn residue from active work. The result is a false `Thinking...` indicator
after final durable output exists.

Required shape:

- Only active bridge states (`starting`, `working`, `stuck`) may surface
  `currentText` as live text.
- Idle/stopped/done/error workers must render from durable worker entries,
  `lastText`, or explicit diagnostics, not stale live text.
- The frontend pending assistant indicator must be derived from active worker
  status or active live text, never from a terminal run row alone.
- Tests should assert that an idle completed direct worker with populated
  bridge `currentText` snapshots as `currentText: ""`.

Resolved shape:

- Live worker snapshots forward `currentText` only for active bridge states.
- Idle/stopped/done/error direct workers render from durable worker entries or
  `lastText`; stale live text is not treated as active work.
- `tests/server/live-worker-snapshots.test.ts` asserts that idle completed
  direct workers with bridge `currentText` snapshot with empty live text.

### 22. Snapshot markers must not skip lower-id named events

Files:

- `src/runtime/http/routes/events.ts`
- `src/server/events/named-events.ts`

The SSE route uses snapshot markers as cursor anchors for `update` frames.
Before the fix, it drained named events, then allocated the marker. A worker
entry wake-up emitted in the gap between those two actions received an id lower
than the marker. Once the client consumed the marker id, `Last-Event-ID` resume
could skip that worker wake-up even though the output was durable on disk. The
visible symptom is a direct conversation that has finished output but stays
empty or stuck until a later reload/session switch forces a fresh stream fetch.

Required shape:

- A marker may not advance the browser cursor past any undelivered lower-id
  named event.
- Events emitted after a marker must not be delivered before the marker frame,
  or SSE ids can regress.
- The replay API needs a bounded drain primitive for marker-boundary races.

Resolved shape:

- `getNamedEventsSince` accepts `throughId` so callers can drain only a bounded
  id range.
- The SSE route drains normally, allocates the marker, then drains through
  `marker.id - 1` before writing the snapshot frame.
- `tests/server/events/named-events.test.ts` covers bounded replay across a
  marker boundary.

### 23. FIFO queues need an order key, not random-id tie-breaking

Files:

- `src/server/conversations/queued-messages.ts`
- `tests/server/queued-messages.test.ts`

Ordering queue records by `(createdAt, id)` is deterministic but not FIFO if
two records share the same persisted timestamp bucket and ids are random UUIDs.
The full test suite exposed this by draining `Second queued note` before
`First queued note`.

Required shape:

- User-visible FIFO queues need an insertion sequence or logical clock.
- Drained messages should carry the queue record's owned order timestamp, not a
  fresh delivery timestamp that can collapse or reorder during a fast drain.

Resolved shape:

- Queue creation assigns a per-run monotonic logical timestamp.
- The logical tick is one second because the current SQLite timestamp mode
  stores at second precision for these records.
- Drained checkpoint messages use the queue record's `createdAt`, preserving
  FIFO in downstream transcript reads.

### 24. Saved-session recovery must publish the branch it took

Files:

- `src/server/conversations/send-message.ts`
- `src/server/runs/recovery.ts`
- `src/server/runs/recovery-reconciler.ts`
- `src/server/supervisor/index.ts`
- `src/server/quota/worker-resume.ts`
- `src/server/supervisor/observer.ts`
- `src/server/supervisor/wake.ts`

A persisted `bridgeSessionId` is useful history, but it is not live authority.
When a provider rejects the saved session, especially Gemini's `Invalid session
identifier`, the control plane has two distinct decisions: reattach to the saved
session, or abandon that session and create a fresh runtime worker. Before the
fix, several paths wrote DB state but did not emit typed named events, and some
fresh-worker fallbacks could keep the rejected session id as the worker's
authoritative session if the fresh spawn did not echo one.

Required shape:

- Successful saved-session reuse emits `worker.reattached`.
- Rejected saved-session fallback emits `worker.recreated`.
- Fresh-worker fallback clears the invalid `bridgeSessionId`; it may only store
  a new session id supplied by the fresh worker.
- Tests assert the named event, not only eventual worker table state.

Resolved shape:

- Direct follow-ups, failed-run direct recovery, supervisor `worker_continue`,
  recovery reconciler auto-resume, and quota-reset worker resume now emit the
  appropriate named event.
- Direct/supervisor fresh-worker fallback records
  `worker_session_recreated` execution events and avoids reusing rejected
  session ids.
- `worker_session_recreated` is treated as a worker-turn reset, like
  `worker_session_resumed`, so completion and lease recovery logic cannot treat
  older completion evidence as authoritative after a fresh worker starts.
- `tests/api/conversation-messages-route.test.ts`,
  `tests/api/run-route.test.ts`, `tests/server/runs/recovery-reconciler.test.ts`,
  `tests/supervisor/index.test.ts`, `tests/supervisor/wake.test.ts`,
  `tests/supervisor/observer.test.ts`, and `tests/app/home-utils.test.ts`
  cover these branches.

### 25. Planner recovery must not turn every bridge error into a recreate

File:

- `src/server/planning/review.ts`

During planning review, reviewer findings are sent back to the original
planner worker. The code checked whether the planner was live with `getAgent()`,
but the catch block treated every failure as "missing agent" and then attempted
saved-session resume or fresh spawn. A transient bridge error, runtime outage,
or malformed bridge response could therefore create duplicate planner runtime
state instead of failing the review through the existing `plan.review.failed`
surface.

Required shape:

- Only explicit missing-agent/session errors may trigger saved-session resume or
  fresh-worker recreate.
- Other bridge/runtime errors must propagate to the review failure path, which
  emits `plan.review.finished` with `status: "failed"` and `error.surfaced`.
- The resume/recreate branch should be durable in execution events as well as
  visible in named events.

Resolved shape:

- `isRecoverablePlannerAgentMissingError()` gates the planner recovery branch.
- Planner resume records `worker_session_resumed` and emits
  `worker.reattached`.
- Planner fresh spawn records `worker_session_recreated` and emits
  `worker.recreated`.
- `tests/server/planning/review-resume-source.test.ts` guards the branch so a
  broad catch cannot silently return.

### 26. Fire-and-forget initial spawn failures must become terminal state

Files:

- `src/server/conversations/create.ts`
- `tests/api/conversations-route.test.ts`
- `tests/lifecycle/scenarios/worker-spawn-failure.test.ts`

New conversation creation is intentionally optimistic: the API returns after
the run, message, worker row, and worker stream prompt exist, while the runtime
worker is spawned in the background. That is fine only if the background branch
has a deterministic reconciliation path.

Before the fix, direct spawn failure updated DB failure state but did not emit
`error.surfaced`; planning spawn failure emitted `error.surfaced` but did not
move the run/plan/worker out of `starting`. The UI could therefore see a
half-created session with a spinner even though no worker would ever produce
output.

Required shape:

- Every fire-and-forget initial spawn failure must persist terminal run/worker
  state.
- Planning conversation spawn failure must also move the plan out of
  `starting`.
- The worker stream must contain a lifecycle entry for the branch.
- The named event ring must contain both `worker.status` and `error.surfaced`
  so the frontend and lifecycle harness can assert the same truth.

Resolved shape:

- `persistInitialWorkerSpawnFailure()` handles direct, commit, and planning
  initial spawn failures.
- Direct and planning startup now both mark the worker `error`, mark the run
  `failed`, write the run failure message, append a worker-stream lifecycle
  failure entry, emit `worker.status`, and emit `error.surfaced` with code
  `worker.spawn.failed`.
- Planning startup additionally marks the plan `failed`.
- Route tests cover direct and planning spawn rejection, and the lifecycle
  spawn-failure scenario now asserts persisted DB state as well as the named
  event.

### 27. Not-modified snapshots must still refresh stream cursors

Files:

- `src/runtime/http/routes/events.ts`
- `src/app/home/LiveEventConnectionManager.ts`
- `tests/api/events-route.test.ts`
- `tests/app/live-event-connection-manager.test.ts`

The global event snapshot and the worker-entry manager are separate state
owners. The snapshot checksum includes `workerEntrySeqs`, but the worker-entry
manager can still miss an SSE wake-up, lose process-local state during dev
reload, or start after the snapshot cache is already current.

Before the fix, a persisted snapshot poll whose checksum matched returned only
`{ notModified: true }`. The client skipped `applyUpdate()`, which is correct,
but also had no worker-entry cursor hint to pass to `WorkerEntriesManager`.
That created a bad state where the authoritative snapshot was unchanged while
the terminal stream was locally empty or stale until a full reload without the
checksum forced a full payload.

Required shape:

- `notModified` means the snapshot body is unchanged; it must not mean all
  dependent local managers are already synchronized.
- Lightweight cursor hints that repair dependent managers must still be
  available on unchanged snapshots.
- The client must consume those hints even when it skips applying the full
  snapshot.

Resolved shape:

- Persisted snapshot `notModified` responses include `workerEntrySeqs`.
- `LiveEventConnectionManager` calls `workerEntries.onKnownSeqs()` for
  not-modified responses.
- API and frontend manager tests cover unchanged snapshots still waking worker
  stream recovery.

### 28. Composer stop state must be owned by the selected run

Files:

- `src/app/home/HomeApp.tsx`
- `src/app/home/direct-control-activity.ts`
- `tests/app/direct-control-activity.test.ts`
- `tests/ui/composer-shell.test.ts`
- `tests/ui/sidebar-layout.test.ts`

The composer is global UI, but direct message sends and stop requests are
run-owned operations. Before the fix, `sendConversationMessage.isPending`,
`stopWorker.isPending`, and `stopSupervisor.isPending` were read as global
booleans when deriving the selected conversation's stop affordance. If the user
changed sessions while a direct follow-up was pending, the composer could apply
that pending state to the newly selected run: the stop button could disappear,
disable, or target the wrong run/worker.

Required shape:

- Pending message-send state may affect the composer only while
  `mutation.variables.runId === selectedRunId`.
- Pending stop state may disable stop only for the run being stopped.
- Pending direct-send worker selection must be resolved from the selected run's
  workers only when the selected run owns the send mutation.

Resolved shape:

- `isMutationPendingForSelectedRun()` centralizes the run-owner check.
- `resolvePendingConversationWorkerId()` returns a pending direct worker only
  for the selected run that owns the in-flight send.
- `HomeApp` scopes pending send, queued send, worker stop, and supervisor stop
  state by `runId` before deriving `isComposerSubmitting`,
  `isStopConversationPending`, and `stoppableConversationWorkerId`.
- Unit/source tests cover the owner guard and preserve the composer wiring.

### 29. Every persistRunFailure caller must publish `error.surfaced`

Files:

- `src/server/runs/failures.ts`
- `src/server/events/named-events.ts`
- `src/server/conversations/send-message.ts`
- `src/server/conversations/sync.ts`
- `src/server/conversations/create.ts`
- `src/server/supervisor/observer.ts`
- `src/server/supervisor/wake.ts`
- `src/server/supervisor/index.ts`
- `src/server/runs/recovery.ts`
- `tests/server/runs/failures.test.ts`

The lifecycle observability contract requires that every user-visible failure
publishes `error.surfaced` with a stable code, a human message, and a surface
target. `persistRunFailure` is the canonical point where a run transitions into
the failed state, but it had previously only written DB rows. Each call site
was responsible for emitting `error.surfaced` separately, and most did not.

Before the fix, the following call sites moved a run to `failed` without ever
emitting `error.surfaced`. The UI saw the failed state and could render a
banner, but the runtime-wide error transcript stayed silent and surfaces that
listen for `error.surfaced` (toasts, mobile notifications, the test harness's
named-event assertions) missed the failure entirely:

| Call site | Surfaced code (new) |
| --- | --- |
| `conversations/send-message.ts` direct/planning continue failure | `conversation.continue.failed` |
| `conversations/sync.ts` idle-with-no-output (live) | `worker.idle.empty_output` |
| `conversations/sync.ts` idle-with-no-output (no live session) | `worker.idle.missing_output` |
| `conversations/create.ts` initial response empty output | `worker.initial.empty_output` |
| `conversations/create.ts` initial turn rejection (planning) | `worker.initial.turn_failed` |
| `conversations/create.ts` initial turn rejection (direct fallback) | `worker.initial.turn_failed` |
| `supervisor/observer.ts` worker environment mismatch | `worker.environment_mismatch` |
| `supervisor/observer.ts` snapshot validation failure | `worker.snapshot.invalid` |
| `supervisor/observer.ts` saved-session resume failure (two paths) | `worker.resume.failed` |
| `supervisor/observer.ts` poll failure (non-retryable) | `worker.poll.failed` |
| `supervisor/observer.ts` fatal bridge stderr | `worker.bridge.fatal_stderr` |
| `supervisor/observer.ts` observer step failure (non-retryable) | `worker.observer.failed` |
| `supervisor/wake.ts` wake processing failure | `supervisor.wake.failed` |
| `supervisor/index.ts` supervisor explicit give-up | `supervisor.gave_up` |
| `runs/recovery.ts` recovery worker produced no output | `recovery.run_failed` |

Required shape:

- A run transitioning to `failed` must publish exactly one `error.surfaced`
  event for the transition.
- A second call to `persistRunFailure` on the same run (safety-net catches,
  re-entry from outer handlers) must not produce a duplicate `error.surfaced`.
- A call that no-ops because the run is already terminal in a non-failed state
  (e.g. `cancelled`) must not emit anything.
- Each call site supplies a stable `SurfacedErrorCode` and, when known, the
  `workerId` for downstream filtering.

Resolved shape:

- `persistRunFailure(runId, error, { surface })` accepts an optional surface
  spec (`code`, `surface`, `workerId`). When supplied, it emits `error.surfaced`
  inline iff the run actually transitions from a non-failed state to `failed`.
  Repeated calls and late calls against `cancelled`/`done` runs stay silent.
- Every persistRunFailure caller that runs in a user-visible failure path
  passes a surface spec. The single exception is `persistInitialWorkerSpawnFailure`,
  which already emits its own `error.surfaced` with code `worker.spawn.failed`
  and therefore does not request a second emit from the helper.
- `SurfacedErrorCode` enumerates one stable code per failure class so client
  filters and tests can assert against compile-time-checked values.
- `tests/server/runs/failures.test.ts` covers: surface emits on first
  transition, no emit when no surface is supplied, no re-emit on duplicate
  failure, no emit when the run is already terminal in a non-failed state.

### 30. HTTP stop endpoints must emit worker.status and worker.terminal

Files:

- `src/runtime/http/routes/runs.ts`
- `tests/api/run-route.test.ts`

`cancelWorker()` in the runs route was the canonical helper for every HTTP
stop path (`stop_supervisor`, `stop_worker`, `pauseImplementationRunAfterWorkerStop`).
It updated the worker row to `cancelled` and triggered `notifyEventStreamSubscribers()`
but emitted no named events. The in-conversation `stopConversationFromManualStopCommand`
in `conversations/send-message.ts` did emit `worker.status` + `worker.terminal`,
so HTTP stops and in-conversation stops produced different transcripts for the
same outcome. Subscribers that filter on named events (toast surfaces, tests,
the lifecycle observability ring) silently missed every HTTP-initiated stop.

Required shape:

- Every transition of a worker into a terminal status must emit `worker.status`
  with the prev/next labels, and `worker.terminal` with the terminal status.
- A duplicate cancellation (the worker was already cancelled) must not double-emit.
- The same emit contract must hold whether the stop is in-conversation,
  HTTP-initiated, or part of an implementation pause.

Resolved shape:

- `cancelWorker()` reads the previous status, performs the update, and emits
  `worker.status` + `worker.terminal` only when transitioning out of a
  non-cancelled state.
- `stop_worker`, `stop_supervisor`, and `pauseImplementationRunAfterWorkerStop`
  all flow through the helper and therefore inherit the emit.
- API tests assert both events fire for stop_worker and for each active
  worker stopped by stop_supervisor.

### 31. Behavioral coverage for mutation-scoping invariants


Files:

- `src/app/home/direct-control-activity.ts`
- `tests/app/direct-control-activity.test.ts`
- `tests/ui/composer-shell.test.ts`

Section 28 introduced `isMutationPendingForSelectedRun()` and
`resolvePendingConversationWorkerId()` so the composer no longer applies a
different run's pending state. The regression test suite at that point was a
set of *source-string guards* in `composer-shell.test.ts` (e.g.
`expect(pageSource).toContain("isMutationPendingForSelectedRun({")`). Those
guards prove that HomeApp uses the helpers, but they break on cosmetic
refactors that do not change behavior, and they do not exercise the
ownership-mismatch race directly.

Required shape:

- Every mutation-scoping helper must have behavioral coverage that exercises
  the race the source-guard was added for, parameterized by mutation type
  (send, planning promote, recover, resume).
- Source-string guards may remain as belt-and-suspenders but must not be the
  *only* coverage — behavioral assertions are the canonical check.

Resolved shape:

- `tests/app/direct-control-activity.test.ts` exercises
  `isMutationPendingForSelectedRun` for the four pending-mutation scenarios
  flagged in HomeApp: send-message, planning-promotion, recoverRun,
  resumeRunRecovery, plus the no-mutationRunId and null-selection edge cases.
  Each test names the race it represents so a future failure is interpretable
  from the test output alone.
- The remaining source-string guards in `composer-shell.test.ts` are now
  redundant rather than the sole check.

### 32. notModified poll work must respect the manager's active flag

Files:

- `src/app/home/LiveEventConnectionManager.ts`
- `tests/app/live-event-connection-manager.test.ts`

`runSnapshotPoll()` had an asymmetric active-check: the *modified* branch was
guarded by `if (this.active)` before calling `applyUpdate` and forwarding
cursors, but the *notModified* branch forwarded cursors unconditionally.
`setLastEventId` was also called before either branch. If a
`selectedRunId` change unmounted the effect mid-poll, the old manager could
still write worker-entry cursor hints into the singleton `workerEntriesManager`
after `stop()` had run.

Required shape:

- An in-flight snapshot poll that resolves after the manager is stopped must
  not write anything to shared singleton state.
- Both the modified and notModified branches must honor the same active-guard.

Resolved shape:

- `runSnapshotPoll()` returns early when `this.active` is false, before any
  cursor write.
- Symmetric path: both branches now run only when the manager is active.
- Unit test holds an in-flight snapshot, calls `stop()`, then resolves the
  promise as `notModified` and asserts no cursor write reached the worker
  entries notifier.

## Audit Heuristics To Keep Running

Use these searches during reviews:

```sh
rg -n "setTimeout|setInterval|requestAnimationFrame" src
rg -n "onSuccess:|onError:|onMutate:" src/app src/components
rg -n "getSnapshot\\(\\).*await|await .*getSnapshot\\(\\)" src/app src/components
rg -n "orderBy\\((asc|desc)\\([^)]*(createdAt|updatedAt)" src
rg -n "catch \\{|catch \\([^)]*\\) \\{" src/server src/app src/components
rg -n "setSelectedRunId\\(" src
```

For each hit, ask:

1. What owns this async result?
2. Can a newer owner appear before it resolves?
3. Is cached/optimistic data marked as preview, or can it satisfy a full-load
   gate?
4. Is there a stable cursor/seq/id proving completeness?
5. If the branch refuses, blocks, retries, or gives up, is there a named event?

## Priority Fix Order

The original priority items above are now represented in the resolution ledger
and the per-section resolved shapes. Keep this order for future regressions in
the same class:

1. Prove cache/optimistic provenance before full-load gates.
2. Prove stream freshness with event ids, snapshot anchors, replay, or resync.
3. Add owner tokens to every async frontend manager response.
4. Scope mutation navigation and side effects to their original owner.
5. Treat server snapshots as authoritative over optimistic timestamps.
6. Stabilize timestamp-only ordering with id/seq tie-breakers.
7. Emit named events for server decisions that block, refuse, retry, give up,
   or recover.
8. Carry owner generations into timer/poll/background async bodies, not just
   the scheduling shell.
