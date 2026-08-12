# ACP V1 Plan Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `subagent-driven-development` (recommended) or `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a passive, live task-plan widget that shows the current ACP execution plan for the selected worker without duplicating plan updates in the conversation.

**V1 architecture:** The existing unified worker stream is the only durable source. ACP core plan notifications are appended there with verified session metadata; a pure reducer derives the latest complete plan for a worker-scoped HTTP read and tests. Named SSE events carry only bounded cursor/decision metadata; the widget refetches the derived plan through the existing worker-stream route. No plan table, task graph, compatibility accumulator, or second transcript store is introduced.

**Scope:** Direct-control and planning conversations, one unambiguous primary worker, read-only expand/collapse widget, ACP core `sessionUpdate: "plan"` only.

**Out of scope:** Claude `TaskCreate`/`TaskUpdate`, Codex `update_plan`, experimental ACP `plan_update`/`plan_removed`, Markdown/file rendering, WorkerCard integration, editing, pause/resume, clear/retry controls, run-level goals, and multi-worker aggregation. These require a separate evidence-based follow-up.

**Functionality standard:** The implementation must survive reload, reconnect/resync, restart, and worker reattachment using the unified stream. Headless event/snapshot tests are required. Responsive polish, screen-reader announcement quality, and live focus retention remain explicitly unverified until the approval-gated browser journey runs.

**Plan lifetime:** A plan belongs to the current ACP session, not to a durable goal. It remains visible as the provider’s current or final session plan until the ACP session is recreated; a new session appends the reset boundary. V1 does not invent prompt-turn identity because ACP notifications carry session identity, not a turn id.

## Protocol and repository context

ACP core defines `session/update` notifications with `sessionUpdate: "plan"`. Each update supplies a complete list of entries with content, priority, and `pending`, `in_progress`, or `completed` status; the client replaces the previous list. See the [ACP Agent Plan specification](https://agentclientprotocol.com/protocol/v1/agent-plan) and [ACP prompt-turn lifecycle](https://agentclientprotocol.com/protocol/v1/prompt-turn).

The installed SDK also exposes experimental `plan_update` and `plan_removed` forms, including structured, Markdown, and file variants. V1 preserves those as raw history and emits an informational unsupported-form event; it does not project them into the widget. Their semantics must not be inferred from the core plan contract. See the [SDK PlanUpdate type](https://agentclientprotocol.github.io/typescript-sdk/types/PlanUpdate.html).

Current repository boundaries:

- `src/server/agent-runtime/acp/session-updates.ts` already normalizes ACP plan-shaped notifications into worker output entries.
- `src/server/agent-runtime/acp/runtime-client.ts` owns the production ACP callback. `src/server/agent-runtime/manager.ts` constructs that client for normal, pooled, resume/load, and recovery paths; it must not carry a second inline callback implementation.
- `appendWorkerEntry` and `WorkerEntriesManager` own the unified append-only worker stream. Plan state must remain in that stream.
- `src/components/Terminal.tsx` currently renders plan entries as generic protocol activity; suppression must be explicit and limited to successfully projected core-plan entries.
- `src/interface/home/EventStreamStateManager.ts` owns snapshot/cache merging and is the canonical frontend state owner.
- `src/components/PlanProgress.tsx` belongs to a separate legacy file-backed model and is not reused unchanged.
- Before server changes, read `docs/architecture/lifecycle-observability-and-testing.md` and `docs/architecture/worker-conversation-stream.md`.

## V1 behavior

1. Before `spawnAgentConnection`/`resumeOrLoadSession`, the worker lifecycle registers a transient `WorkerPlanStartupContext` containing `(runId, workerId, connectionGeneration)` and an expected resume id when one exists. A plan-operation mutex serializes session boundaries and notification admission; each durable append acquires the existing worker-stream writer chain exactly once.
2. ACP callbacks can arrive while `newSession`, `resumeSession`, or `loadSession` is still pending, before `AgentRecord` exists. The production runtime client resolves the startup context by connection generation and buffers a bounded number of immutable `SessionNotification`s; it does not accept or persist plan content until the session response supplies the authoritative id. After the response, the lifecycle hydrates the durable boundary, establishes the binding, then drains only buffered notifications whose captured id matches that session.
3. Once a binding exists, the runtime client captures the immutable `params.sessionId` and verifies it against the binding before asynchronous append. It must never read mutable `record.sessionId` after the callback begins and use that value to reattribute the update.
4. A valid core `plan` is appended to the existing worker stream with `acpSessionId` and `planProjection: "accepted_core"` metadata. The complete list replaces the prior list in the reducer.
5. A malformed, oversized, unsupported, missing-session, or stale notification is retained as a bounded diagnostic worker-stream record with rejection metadata, but it never changes the derived widget state or becomes ordinary user conversation content. Existing debug/protocol activity may expose that record; only user-relevant failures use the existing `error.surfaced` path.
6. `worker.plan_updated` and `worker.plan_boundary_started` events carry only `{ runId, workerId, seq }`; the existing `worker.entry_appended` wake-up also remains the worker-stream trigger. The plan manager refetches the current bounded `WorkerPlanSnapshot` through the worker entries route, so the SSE channel never becomes a second content transport.
7. Bootstrap and resync retain worker entry seq cursors in the generic event snapshot. The plan manager fetches the worker-scoped derived plan by reducing durable worker-stream entries. `appendWorkerEntryWithResult` assigns `entry.seq`; `readWorkerLatestSeq` and `readWorkerEntriesSince` remain the durable ordering primitives. If profiling later demonstrates that this is too expensive, that is a separate projection-table proposal, not silent V1 scope expansion.

### Session binding rules

- `beginWorkerPlanSession` appends a session boundary successfully first, then publishes the in-process binding and `worker.plan_boundary_started`. Same id reattaches without a reset; a different id records the actual current worker-stream head and appends the invisible session boundary. If boundary append fails, the old binding remains authoritative and no reset event is emitted. After a durable boundary append, the new binding is authoritative even if event publication fails; restart reconstructs it from the latest boundary without appending another one.
- All session binding and notification operations run through a plan-operation mutex keyed by `(runId, workerId)`. This mutex must not call a task that re-enters `appendWorkerEntryWithResult` while holding `runOnChain`; the existing append function owns the worker writer chain and file lock exactly once. A notification queued before retirement may commit to the old session; one queued after retirement is stale and cannot affect the new session.
- A notification arriving before any binding is retained as a bounded diagnostic record and emits `worker.plan_rejected` with reason `unbound`; it is not adopted when a binding later appears.
- A missing session id is rejected. A provider reusing an old id is treated as the same ACP session; a provider recreation must use the lifecycle’s new binding transition to append a new boundary. The server must not guess from timestamps or prose.
- A stale update carries its captured session id in durable metadata, emits `worker.plan_rejected` with reason `stale_session`, and is excluded by the reducer.
- During startup, a callback with a missing id is rejected in the bounded startup context; a callback whose id differs from the returned session id is discarded as a bounded diagnostic after startup with reason `startup_session_mismatch`. A startup buffer overflow emits `startup_buffer_overflow`; neither case changes the widget. If startup fails or is cancelled, the transient buffer is discarded and no plan record is written.

Hydration contract: after `spawnAgentConnection` or `resumeOrLoadSession` returns a session id, and before the first prompt or buffered callback is accepted, `hydrateWorkerPlanBinding` reads the latest boundary using the existing worker-stream readers. It sets the in-process binding only from that durable boundary, then drains the matching startup buffer in arrival order. While hydration is pending, post-startup notifications receive `worker.plan_rejected` with reason `hydrating`; if hydration fails, no plan notification is accepted and the existing `error.surfaced` path uses code `worker_plan_binding_hydration_failed` with `runId` and `workerId`. A later successful hydration may resume acceptance without appending a speculative boundary. The startup context is transient control state, not a durable plan store.

### Ingestion ownership map

- `session-updates.ts` remains a pure normalizer; it does not append plan rows.
- `RuntimeClient.sessionUpdate` calls `handleAcpSessionUpdate` exactly once for its connection. Every manager construction path uses this extracted client. The helper owns validation, boundary/session checks, the sole `appendWorkerEntryWithResult` call, and the accepted/rejected event.
- The existing generic output-entry append branch is bypassed for every plan-shaped update (`sessionUpdate: "plan"`, experimental `plan_update`, and `plan_removed`); it may continue handling non-plan ACP updates. Core plans go through validation/projection, experimental forms become bounded unsupported diagnostics, and one notification can never produce both a generic plan row and a projected widget row.
- The server integration tests drive each production callback with a real `SessionNotification`, then read the persisted stream and assert exactly one accepted/rejected record per notification; helper spies are supplementary only.

## Shared model and stream contract

Define protocol-independent types in `src/shared/acp-plan.ts`, alongside `src/shared/home-types.ts` and the existing shared worker-entry contract:

```ts
type AcpPlanItemStatus = "pending" | "in_progress" | "completed";
type AcpPlanItem = {
  // Session-boundary-local render key only; ACP core has no provider item id.
  id: string;
  content: string;
  priority: "high" | "medium" | "low";
  status: AcpPlanItemStatus;
  order: number;
};

type WorkerPlanSnapshot = {
  runId: string;
  workerId: string;
  acpSessionId: string;
  planBoundarySeq: number; // actual seq returned by appendWorkerEntryWithResult
  lastEntrySeq: number; // accepted plan seq, or boundary seq while reset
  lastAcceptedEntryId: string | null;
  visible: boolean;
  items: AcpPlanItem[];
  updatedAt: string; // timestamp from the boundary or accepted entry, never snapshot-build time
};

type WorkerPlanScope = {
  complete: boolean;
  runId: string;
  workerIds: string[];
  plansByWorkerId: Record<string, WorkerPlanSnapshot>;
};

type WorkerPlanReadResponse = {
  plan: WorkerPlanSnapshot | null; // null means unbound/no durable boundary
  latestSeq: number;
};
```

Extend the existing worker-entry metadata, without creating another store, with:

- `acpSessionId` for every accepted plan-bearing or session-boundary entry, and the captured id when present on a rejected/stale entry;
- `planProjection: "accepted_core" | "session_reset" | "rejected" | "unsupported" | "stale"`;
- `diagnosticOnly: true` on session-boundary, rejected, unsupported, and stale entries so the existing protocol-debug surface can inspect them while ordinary conversation rendering, pagination, exports, and accessibility announcements exclude them;
- the original raw ACP notification for accepted updates only when it is within the 64 KiB plan-entry bound, plus a rejection envelope for malformed/oversized updates (classification, session id, measured size, 4 KiB preview, and hash); never persist an arbitrarily large rejected payload unchanged.

Reducer invariants:

- The reducer considers only the latest session boundary for the worker, then only accepted core-plan entries matching that boundary’s session id and having a greater sequence.
- `session_reset` yields `visible: false` and an empty item list until a newer accepted core plan arrives.
- For a reset snapshot, `lastEntrySeq` equals the boundary entry’s actual seq and `lastAcceptedEntryId` is null. For a visible plan, `lastEntrySeq` and `updatedAt` come from the accepted plan entry. Replay never generates a new timestamp.
- A core plan is a complete replacement; no client patching, array-index merge, or item continuity is inferred. Render keys are regenerated from the plan-boundary sequence and list position.
- Identical replays of the same `entryId` and payload are idempotent. The server append writer’s existing entry-id deduplication is authoritative; the client ignores an event whose `(runId, workerId, acpSessionId, planBoundarySeq, lastEntrySeq)` token is equal to current state and requests resync if its payload differs.
- Every accepted core-plan entry is marked `accepted_core`; the widget-owned Terminal projection hides all such plan rows, including older accepted rows loaded through pagination. Rejected, unsupported, stale, and malformed rows remain available only through existing debug/protocol activity.
- The reducer is bounded: at most 100 items, 500 Unicode code points per item, 1 KiB for a provider session id, 64 KiB for each accepted ingress/durable/read representation, and a 4 KiB rejection preview. Oversized input is rejected, not truncated.

Validation contract: at notification ingress, measure `JSON.stringify(params.update)` with `TextEncoder` UTF-8 bytes; before append, measure the UTF-8 JSON of the complete accepted durable entry `{ raw, acpSessionId, planProjection, normalizedPlan }` including all metadata; before returning the worker-scoped `view=plan` response, measure the UTF-8 JSON of `WorkerPlanReadResponse`. Trim surrounding whitespace from content, preserve internal whitespace, reject empty item content, count the item limit as Unicode code points after trimming (not UTF-8 bytes, UTF-16 units, or grapheme clusters), reject unknown status/priority values, ignore unknown fields, preserve duplicate content as separate position-based items, and accept an empty `entries` array as a valid empty plan. The 64 KiB limit applies independently to the ingress update, accepted durable entry, and read response; the 4 KiB limit applies to the rejection envelope preview. Reject the entire update when any measured representation exceeds its limit, using the bounded rejection envelope for the durable diagnostic record.

Snapshot and read-view semantics:

- `WorkerPlanScope` is a client-side derived state owned by `AcpPlanManager`, keyed by the existing worker catalog’s `workerIds`; it is not embedded in the generic `/api/events` snapshot. When `complete` is true, an omitted worker is unbound or deleted according to the existing worker catalog, not a plan transition. When false, omissions never clear a known per-worker plan. The UI selects one primary worker and never renders a run-level aggregate.
- Unbound/deleted workers have no plan entry. Worker deletion remains owned by the existing worker catalog.
- `GET /api/workers/:workerId/entries?view=plan` is a bounded derived read over the same JSONL stream, not a persistence layer or alternate transcript. Its response is the authoritative `WorkerPlanSnapshot` for that worker; the generic event snapshot carries only `workerEntrySeqs`.
- Cache data is preview/provenance-marked and cannot erase a complete server plan or reset tombstone. Equal-token different-payload responses preserve known state and trigger resync.

## File map

### New files

- `src/shared/acp-plan.ts` — normalized types, reducer input/output contracts, limits, and snapshot scope; `src/shared/home-types.ts` owns only transport composition.
- `src/server/agent-runtime/acp/plan-state.ts` — pure core-plan validation, normalization, render-key generation, session-boundary reduction, and unsupported ACP-form classification.
- `src/server/agent-runtime/acp/plan-stream.ts` — session-boundary hydration, immutable notification commands, append metadata, stale fencing, and named-event publication.
- `src/components/home/AcpPlanWidget.tsx` — localized, read-only collapsed/expanded checklist card.
- `src/interface/home/AcpPlanManager.ts` — canonical client-side derived plan state; fetches the worker-scoped plan read and responds to cursor wake-ups/resync.
- `src/interface/home/AcpPlanPresentationManager.ts` — expansion-only state keyed by run/worker; no canonical plan data.
- `tests/shared/acp-plan.test.ts` — reducer, bounds, render keys, replay, and stale-token tests.
- `tests/server/acp/plan-state.test.ts` — core ACP fixtures, malformed/oversized input, unsupported forms, and session fencing.
- `tests/server/acp/plan-stream.test.ts` — both runtime paths, serialized binding, append metadata, stale updates, and named events.
- `tests/app/acp-plan-widget-integration.test.ts` — runtime-derived plan through worker-stream read/wake-up, `AcpPlanManager`, and selected-worker selector.
- `tests/app/acp-plan-presentation-manager.test.ts` — expansion state and run/worker switching.
- `tests/ui/acp-plan-widget.test.tsx` — rendering, keyboard semantics, i18n keys, and no-submit behavior.
- `tests/lifecycle/scenarios/acp-plan-widget.test.ts` — HTTP/SSE update, replacement, session reset, reconnect, restart, and resync.

### Existing files to modify

- `src/shared/worker-entries.ts` and `src/server/workers/output-store.ts` — carry verified plan/session metadata through the existing unified stream; use `appendWorkerEntryWithResult`, `readWorkerLatestSeq`, and `readWorkerEntriesSince` for durable ordering; add a bounded `readLatestWorkerPlan` read that uses the existing tail/index/cache primitives and retains only entries after the latest boundary. Do not wrap the existing writer chain inside another call to the append function.
- `src/server/agent-runtime/acp/session-updates.ts` — preserve raw ACP updates and route plan-shaped notifications to the shared plan-stream helper.
- `src/server/agent-runtime/acp/runtime-client.ts` and `src/server/agent-runtime/manager.ts` — pass immutable notification session ids through the shared helper and keep the extracted `RuntimeClient` as the sole callback implementation.
- `src/server/agent-runtime/manager.ts` methods `spawnAgentConnection` and `resumeOrLoadSession`, the extracted `RuntimeClient.sessionUpdate`, plus `recreateWorkerFromTranscript` in `src/server/workers/provider-session-recovery.ts` — hydrate the session binding before prompt delivery, preserve same-session reattach, and append a new boundary on recreation.
- `src/server/events/named-events.ts` — typed plan session/update/rejection events and stable error codes; user-relevant failures use the existing `error.surfaced` event contract.
- `src/runtime/http/routes/worker-entries.ts` and `src/runtime-api/types.ts`/`src/runtime-api/domains/index.ts` — add the bounded `view=plan` read over the existing worker stream; keep generic event snapshots cursor-only. The ordinary worker-entry response remains the raw contiguous stream, including diagnostic rows, so `WorkerEntriesManager` cursors cannot develop gaps.
- `src/shared/home-types.ts` — transport types for `workerEntrySeqs` and plan-manager state/event payloads; do not add plan bodies to the generic event snapshot.
- `src/interface/home/EventStreamStateManager.ts`, `EventStreamSnapshotCacheManager.ts`, and `LiveEventConnectionManager.ts` — preserve cursor-only snapshot merge, route plan cursor wake-ups to `AcpPlanManager`, and handle resync without trusting SSE content. Mark the three plan event kinds as delta-only in the existing `DELTA_ONLY_EVENT_KINDS` policy so they do not trigger an expensive generic snapshot rebuild.
- `src/interface/home/useHomeViewModel.ts`, `src/interface/home/ComposerContainer.tsx`, and `src/components/home/ConversationComposer.tsx` — compute one `planSurfaceOwner` result and mount only the primary worker’s plan.
- `src/components/Terminal.tsx` and `src/lib/agent-output.ts` — consume `planSurfaceOwner.suppressAcceptedPlanRows`; do not independently infer ownership.
- Every `shared/locales/*.json` — widget labels, statuses, counts, accessibility text, and existing error-surface copy if needed.
- Existing ACP, event-stream, worker-stream, lifecycle, and UI tests — extend without deleting unrelated user changes.

Do not modify `PlanProgress.tsx` as part of V1; its legacy model remains separate. Do not add provider-tool parsing, a plan table, a reconciliation job, or worker-card aggregation.

## Implementation tasks

### 1. Establish the contract and fixtures

- [x] Read the two architecture documents named above.
- [x] Add `src/shared/acp-plan.ts` and the stream metadata types; keep durable entry metadata in `src/shared/worker-entries.ts` and transport composition in `src/shared/home-types.ts`.
- [x] Add fixtures for core `plan` replacement, empty list, duplicate content, reorder, whitespace normalization, invalid priority/status, empty content, Unicode byte limits, malformed fields, bounded oversize rejection envelope, unsupported ACP forms, session reset, stale session, and replay.
- [x] Define exact limits: 100 items, 500 Unicode code points per item, 64 KiB accepted raw/normalized plan entry and snapshot, and 4 KiB rejection preview.
- [x] Add a reducer test proving the current plan is derivable from only durable worker-stream entries after runtime memory is cleared.
- [x] State explicitly that legacy plan-shaped entries without `planProjection: "accepted_core"` are diagnostic history only; replay never infers acceptance from payload shape.

Checkpoint: shared tests pass before runtime or UI integration begins.

```bash
pnpm test -- tests/shared/acp-plan.test.ts
```

### 2. Define event and plan-read transport before runtime integration

- [x] Add typed events: `worker.plan_boundary_started`, `worker.plan_updated`, and `worker.plan_rejected` with reason codes `unsupported`, `unbound`, `hydrating`, `stale_session`, `missing_session`, `startup_session_mismatch`, `startup_buffer_overflow`, `malformed`, or `oversized`. User-relevant append/normalization failures also emit the existing `error.surfaced` event with stable code, surface, and subject ids.
- [x] Accepted-plan and plan-boundary events carry only `{ runId, workerId, seq }`; rejection events carry only bounded diagnostic metadata. Keep plan bodies out of SSE and generic event snapshots.
- [x] Define stable error codes and make unsupported/malformed raw-history events deduplicated by entry id; do not add a new plan-specific error Manager.
- [x] Add the bounded `view=plan` response to the existing worker entries route and runtime API; it must call `readLatestWorkerPlan`, reduce only the durable entries needed after the latest boundary, and return the plan boundary/entry cursors needed for stale-response rejection. A long transcript must not cause every plan update to return the full worker stream.
- [x] Test cursor-only bootstrap, plan-read hydration, live cursor wake-up, cache hydration, `Last-Event-ID` replay, and `stream.resync_required` behavior.

Checkpoint:

```bash
pnpm test -- tests/api/events-route.test.ts tests/app/event-stream-state-manager.test.ts
```

### 3. Implement session binding and ACP normalization

- [x] Implement `hydrateWorkerPlanBinding` and `beginWorkerPlanSession` behind a plan-operation mutex keyed by worker. Hydration reads the latest durable boundary before notifications are accepted; same id reattaches; different id appends a session boundary; missing lifecycle binding is observable and does not guess. The mutex may call `appendWorkerEntryWithResult`, but must not nest `runOnChain` around it.
- [x] Capture `params.sessionId` at callback entry in the production ACP runtime client and pass it immutably through every manager construction path and append/project step.
- [x] Append accepted, rejected, unsupported, stale, and session-boundary records through `appendWorkerEntry`; do not create a sibling JSONL/table/cache.
- [x] Preserve accepted raw ACP notifications and attach session id/session-boundary metadata to each plan-bearing entry; use the bounded rejection envelope for invalid oversized input.
- [x] Route core `plan` through the pure reducer. Experimental ACP forms are raw-only; provider tool payloads remain untouched.
- [x] Emit named events only after the unified stream append succeeds. If append fails, use the existing error-surfacing path and leave no false accepted event.
- [x] After each newly appended plan/boundary/diagnostic record, publish the existing cursor-only `worker.entry_appended` wake-up plus the typed plan decision event; neither event may include the entry body. Deduplicated appends do not publish a second wake-up.
- [x] Treat `emitNamedEvent` as the existing synchronous ring-buffer publication boundary. If its call throws after a durable append, do not append again; rely on the existing `LiveEventConnectionManager.startSnapshotValidation`/fallback polling to recover from stream truth, and emit `error.surfaced` only when user-relevant. Test the scheduled snapshot recovery with the existing configurable validation interval rather than a hidden dirty flag.
- [x] Add a test-only injected writer/pause seam to test append-vs-event failure without adding production chaos behavior.
- [x] Add startup callback tests: callback during `newSession`, `resumeSession`, and `loadSession` is buffered by connection generation; matching ids drain after hydration; mismatches, overflow, startup failure, and cancellation never produce an accepted plan.
- [x] Add a decision-table test for boundary append failure (`worker_plan_boundary_append_failed`), accepted-plan append failure (`worker_plan_append_failed`), diagnostic-record append failure (`worker_plan_diagnostic_append_failed`), snapshot/reducer read failure (`worker_plan_snapshot_failed`), event publication failure (`worker_plan_event_publish_failed`), and hydration failure (`worker_plan_binding_hydration_failed`). Each emits a named rejection or the existing `error.surfaced` event with stable subject ids; no failure creates a false accepted update.

Verification:

```bash
pnpm test -- tests/server/acp/plan-state.test.ts tests/server/acp/plan-stream.test.ts tests/server/acp/session-updates.test.ts
```

### 4. Integrate the worker plan read and live frontend state

- [x] Add `AcpPlanManager` as the canonical client owner for `WorkerPlanScope`; it requests `view=plan` for workers in the existing catalog, preserves explicit complete/partial coverage, and applies client selection only after transport merge.
- [x] Make `worker.plan_updated` and `worker.plan_boundary_started` cursor events trigger a plan read for the affected worker. The event body is never treated as plan content; a response with a stale cursor is ignored and a response with a conflicting equal token triggers resync.
- [x] Merge by `(runId, workerId, acpSessionId, planBoundarySeq, lastEntrySeq)` and reject stale events/cache data.
- [x] Add cache/manager tests for cached-visible/live-reset, cached-reset/live-visible, old cursor after newer plan read, newer wake-up during fetch, run switch, bound→unbound, worker deletion, partial response omitting a known worker, explicit coverage transitions, and equal-token replay.
- [x] Keep the raw worker-entry reader cursor-contiguous even when diagnostics are present; filter `diagnosticOnly` only in the ordinary transcript projection (`src/runtime/http/routes/conversation-transcript.ts`, `Terminal`/agent-output, pagination/export serializers) and expose the unfiltered worker stream only to its existing protocol/debug/stream consumers. Tests must assert filtered responses advance their raw seq cursors without inventing gaps.
- [x] Keep `AcpPlanPresentationManager` expansion-only and reset expansion on run/worker switch.
- [x] Add the integration test spanning runtime notification → unified stream → cursor-only SSE wake-up → `view=plan` read → `AcpPlanManager` → selected-worker selector.

### 5. Build the widget

- [x] Mount `AcpPlanWidget` above the composer only for the selected direct-control/planning primary worker.
- [x] Have `useHomeViewModel` compute one `planSurfaceOwner` containing `runId`, `workerId`, `ready`, `ownsWidget`, and `suppressAcceptedPlanRows` from `selectedRunWorkers`, `isDirectConversation`, `isPlanningConversation`, `primaryConversationAgent`, snapshot readiness, and worker status. Zero or multiple workers, terminal/deleted workers, wrong conversation mode, or a missing primary agent means `ownsWidget: false` and no suppression. Never choose the first worker as a plan fallback. While loading, preserve existing transcript rows until ownership is proven.
- [x] Render a compact localized progress count, active item, and expand/collapse control.
- [x] Render a semantic checklist with status icons, text, screen-reader status/priority, and completed styling; status does not rely on color alone.
- [x] Render nothing for the reset tombstone; render a localized empty state for a valid empty core plan.
- [x] Use `t()` and `useI18nSnapshot()` for every visible/accessibility string in every locale.
- [x] Use `type="button"`, `aria-expanded`, visible focus rings, keyboard operation, and one concise `role="status"` announcement per accepted update (`completed of total`); never reread the full checklist or move focus.
- [x] Keep expansion from submitting or stealing composer focus.

Verification:

```bash
pnpm test -- tests/ui/acp-plan-widget.test.tsx tests/app/acp-plan-widget-integration.test.ts
```

### 6. Suppress duplicate activity safely

- [x] Suppress all plan rows marked `planProjection: "accepted_core"` on the composer-owned surface, including paginated history.
- [x] Pass the same `planSurfaceOwner` to both the widget and Terminal/activity projection; no surface may hide an accepted row unless `ready`, `ownsWidget`, run id, and worker id all match.
- [x] Preserve bounded session-boundary, rejected, unsupported, stale, and malformed rows with `diagnosticOnly: true` for existing debug/protocol history without promoting them to ordinary conversation content, pagination, exports, or accessibility announcements. An append failure has no durable row; surface it through the existing error/resync path instead.
- [x] Prove every rejection class is excluded from ordinary conversation, pagination, exports, and accessibility announcements while remaining inspectable in the intended diagnostic surface; prove non-plan protocol activity, ordering, and WorkerCard behavior remain unchanged.

### 7. Add lifecycle and approval-gated visual verification

Add `tests/lifecycle/scenarios/acp-plan-widget.test.ts` over HTTP/SSE, not Chromium:

- [x] Use the existing fake ACP executable fixture pattern from `tests/server/agent-runtime/http.test.ts` to send a real JSON-RPC `session/update` through the public worker-spawn path and assert a cursor-only `worker.plan_updated` event followed by a correct `view=plan` response. Exercise normal, resume, and load manager paths through the extracted client’s actual `sessionUpdate` entry point, not by appending synthetic JSONL.
- [x] Assert complete-list replacement, item deletion/reorder, completed state, reset tombstone, same-session reattach, new-session reset, stale old-session refusal, hydration-vs-notification race, restart-derived state, reconnect/resync, and two-worker isolation through the stream and `view=plan` read.
- [x] Assert a long stream whose latest boundary is outside the tail window: the server’s `readLatestWorkerPlan` uses the sparse index/backward scan to find the boundary, then pages forward with the existing 200-entry cap until the current head; the HTTP response never returns unrelated transcript entries.
- [x] For restart, use the lifecycle harness’s real subprocess kill/respawn path: retain the test JSONL root, recreate the server and in-memory managers, force `GET /api/events?snapshot=1` after `stream.resync_required`, and assert the plan is derived from persisted entries rather than a synthetic snapshot.
- [x] Assert empty core plan versus reset tombstone, partial plan-manager coverage that omits a known worker, zero/multiple eligible workers, and no widget or suppression for ambiguous ownership.
- [x] Test duplicate entry replay and append/event failure at unit level through the injected writer seam; do not claim public lifecycle input can manufacture equal stream sequences.
- [x] Clean up test conversations and persisted artifacts.

Run with:

```bash
pnpm test:lifecycle
```

Approval-gated browser journey:

1. Open a direct-control conversation with an ACP plan.
2. Verify collapsed and expanded checklist states above the composer.
3. Keep the composer focused while a live plan update arrives.
4. Reload/reconnect and verify the current plan remains visible.
5. Verify keyboard operation, focus rings, wrapped narrow-layout text, and no duplicate accepted-plan transcript rows.

Do not run without explicit approval. Do not claim responsive/focus/screen-reader completion until it runs; report those criteria as unverified otherwise.

### 8. Final handoff

- [x] Run focused shared, event-transport, ACP, UI, integration, and lifecycle tests.
- [x] Run typecheck and relevant lint/build checks.
- [x] Run `git diff --check`; inspect the dirty worktree and preserve unrelated changes.
- [x] Confirm locale parity and no new persistence layer, provider compatibility path, task graph, or custom MCP tool.
- [x] Report exact verification commands and whether the approval-gated browser journey ran.

## Completion checklist

- [x] ACP core complete-list plans derive from the unified worker stream and update live through cursor-only named-event wake-ups plus the worker-scoped derived plan read.
- [x] Session binding, session-id fencing, reset tombstones, stale rejection, and restart derivation are covered.
- [x] Bootstrap/cache/SSE/resync state is cursor-based, worker-scoped, and stale-safe; no worker content travels in generic SSE.
- [x] The composer widget is read-only, localized, accessible in code, and scoped to one primary worker.
- [x] Only successfully projected ACP core rows are suppressed from the widget-owned transcript surface.
- [x] Provider task tools, experimental ACP forms, Markdown/file rendering, WorkerCard aggregation, and V2 controls remain out of scope.
- [x] Headless verification is complete; visual/focus criteria are explicitly marked run or unverified.

## Implementation result — 2026-08-10

V1 is implemented and headlessly verified. The final visual pass uses one dense summary row, removes decorative icon/progress-bar chrome, and keeps expanded tasks to one visible line each. Status and priority remain available to assistive technology without the former visible subtitle line.

Verification completed:

- `pnpm vitest run tests/shared/acp-plan.test.ts tests/server/acp/plan-stream.test.ts tests/server/acp/session-updates.test.ts tests/server/acp/runtime-client.test.ts tests/server/workers/output-store-plan.test.ts` — 36 passed.
- `OMNIHARNESS_MIN_DISK_FREE_MB=1024 pnpm vitest run tests/server/acp/plan-state.test.ts tests/server/agent-runtime/http.test.ts tests/api/conversation-transcript-plan-filter.test.ts` — 38 passed; the lower disk threshold is test-local because the host had less free space than the repository's default 8 GiB guard.
- `pnpm vitest run tests/api/events-route.test.ts tests/api/worker-entries-hot-path.test.ts tests/app/acp-plan-manager.test.ts tests/app/acp-plan-presentation-manager.test.ts tests/app/acp-plan-widget-integration.test.ts tests/app/live-event-connection-manager.test.ts tests/ui/acp-plan-widget.test.tsx` — 74 passed, 5 skipped.
- `pnpm test:lifecycle` — 28 files and 46 tests passed, including the real ACP callback and real subprocess restart scenarios.
- `pnpm typecheck` — passed.
- `pnpm lint` — passed with 0 errors; existing repository warnings remain.
- `pnpm build` — passed; the existing large-chunk advisory remains.
- `pnpm check:acp` — passed with all 42 ACP methods covered.
- `pnpm vitest run tests/lib/i18n.test.ts tests/ui/i18n-hardcoded-copy.test.ts` — 10 passed.
- `git diff --check` — passed.

The approval-gated browser journey was not run. Responsive wrapping, live focus retention, visible focus treatment in the running app, and screen-reader behavior remain visually/manual unverified as required by this plan.
