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
- Project memory list/file/toggle/save requests carry request generations and
  patch only while the same project/path still owns the response.
- Git workspace status and operations carry per-project request ids; stale
  responses no longer overwrite newer project state, and global pending state
  stays active while any project operation is still running.
- Pair-device activation and polling patch only the active `pairingId`.
- Conversation mutation navigation is owner-scoped. Optimistic new
  conversations may still render immediately, but stale success/error handlers
  cannot navigate after the user selects another conversation.
- Message-send side effects are scoped to the submitted run and submitted
  composer draft; late responses cannot clear a newer draft in another
  conversation.
- Auto-resume timers re-check the selected run and failure generation at fire
  time before retrying.
- Supervisor wake lease contention and durable wake claims emit named events;
  due durable wake claiming uses a single `DELETE ... RETURNING` transition.
- Snapshot SQL and frontend "latest" sorts use stable id tie-breakers for
  equal timestamps.
- Worker stream fetching now retries when a wake-up advances a worker's known
  sequence while an older empty fetch is still in flight. A selected direct
  conversation no longer depends on a later remount/session switch to fetch
  entries that were announced during the in-flight request.
- Worker failover selection failures preserve the concrete availability error
  in both execution events and `worker.failover_failed` named events.
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

### 2. The browser event client does not use the snapshot anchor on SSE connect

Files:

- `src/app/home/LiveEventConnectionManager.ts`
- `src/runtime/http/routes/events.ts`
- `docs/architecture/lifecycle-observability-and-testing.md`

The server exposes the right protocol: `GET /api/events?snapshot=1` returns
`x-omni-last-event-id`, and the SSE route accepts `Last-Event-ID` or
`?lastEventId=`.

The frontend client currently opens `new EventSource(buildEventStreamUrl(...))`
without a last-event id. It also polls snapshots through `requestJson`, which
does not expose response headers to the caller.

That means named events emitted between snapshot bootstrap and SSE open can be
missed by the browser client. Worker entry content can often recover via
`workerEntrySeqs`, but discrete lifecycle events still depend on timing.

Required shape:

- Initial browser bootstrap must read the snapshot anchor.
- SSE connect must include that anchor, probably via `?lastEventId=...`
  because browser `EventSource` cannot set arbitrary headers.
- Snapshot fallback should update the local anchor when it receives a newer
  `x-omni-last-event-id`.

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

1. Separate cached/optimistic preview from authoritative conversation load.
2. Make the frontend SSE client use snapshot anchors and `lastEventId`.
3. Add stale-response guards to `ProjectMemoryPanelManager`.
4. Add operation ids to `GitWorkspaceManager`.
5. Standardize navigation ownership for all mutation success handlers.
6. Stabilize timestamp-only ordering with id/seq tie-breakers.
7. Add named events around supervisor wake lease contention and durable wake
   claiming.
