# Implementation Plan: Unified Worker Conversation Stream

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Motivation

Today, a single worker conversation is split across three storage layers:

1. User-typed messages → `messages` table (SQL), written synchronously on POST.
2. Worker assistant final-turn text → also `messages` table (`role:"worker"`), written after `askAgent()` returns.
3. Tool calls, thoughts, streamed text, stdout → JSONL files at `app-data/run-data/<runId>/<workerId>.jsonl(.gz)`, written when the bridge is polled.

The frontend Terminal then has to reconcile `messages[]` with `agents[].outputEntries[]` to render a single timeline. That reconciliation is the source of a long-running class of bugs:

- Direct-control session loaded → user bubbles appear; tool calls trickle in seconds later.
- Supervisor → worker turns → same problem; reconciliation between the supervisor narration in `messages` and the worker's JSONL log routinely drops or reorders content.
- "Loading" state is a heuristic (`snapshotRunId === selectedRunId`) rather than a fact.

This plan makes the JSONL output-store the **single source of truth** for every direct worker conversation — user/supervisor inputs *and* worker outputs *and* lifecycle events. The merge logic is deleted. `isWorkerConversationLoaded` becomes a single integer comparison: `receivedUpTo(latestKnownSeq)`.

## Scope

**In scope:** every direct conversation with a single worker — direct-control mode (user ↔ worker) and supervisor-driven worker turns (supervisor ↔ worker).

**Out of scope:** planning-mode aggregation across multiple workers. The new per-worker stream remains the source for each worker's content; any cross-worker view becomes a derived join on read, never a stored merge.

## Architectural decisions

- **One file per worker** stays the unit of persistence — `<runId>/<workerId>.jsonl(.gz)`. Layout, gzip compaction, archive fallback are unchanged.
- **Append-only**: the writer never rewrites the file; it appends one line per entry. The current overwrite-on-snapshot path is replaced with a diff-and-append against entry `id`.
- **Monotonic `seq` per worker**, assigned at write time. Computed from the file's current tail line on writer init; held in memory in the per-worker write chain.
- **Two cursor systems, kept distinct**:
  - **Global SSE event id** (the `id:` field on every SSE frame, backed by the ring buffer in `src/server/events/named-events.ts:124` and replayed via `Last-Event-ID` in `src/app/api/events/route.ts:934`) — stays as today. Used for liveness, drain, and `stream.resync_required` signaling.
  - **Per-worker `entry.seq`** — the durable content cursor. Used by the entries endpoint, by the frontend's contiguous-range tracking, and by the resync path. SSE frames are wake-up hints; replay is via `?afterSeq=`, never via the global id.
- **One writer function**: `appendWorkerEntry(runId, workerId, entry)`. Every code path that currently persists worker conversation content goes through it.
- **One read endpoint**: `GET /api/workers/:workerId/entries?afterSeq=N` returning `{ entries, latestSeq }`. SSE delivers a `worker_entry_appended` wake-up; the client refetches via the endpoint to fill gaps.
- **One write chain, one lock**: the per-worker mutex (`writeChainByKey` in `output-store.ts:291`) coordinates appends **and** compaction/expand/delete. The current sweep in `compactStaleWorkerOutputs` does **not** acquire the chain; that is a latent loss bug today and must be fixed by this work.
- **Two types, not one**:
  - `BridgeOutputEntry` — what the bridge produces (`message | thought | tool_call | tool_call_update | permission`). Stays in `src/server/bridge-client/index.ts`.
  - `WorkerEntry` — the new shared, on-disk and on-wire type. A superset that adds `user_input | supervisor_input | system_note | lifecycle`, plus `seq`, `authorRole`, `attachments`. Lives in a new `src/server/workers/entries-types.ts`. Bridge entries are converted to `WorkerEntry` at the writer boundary. The frontend Terminal renders `WorkerEntry` only.
- **`/api/events` stops carrying worker conversation content.** It keeps run/worker metadata, queued messages, recovery state, supervisor interventions, planning artifacts — the non-content stuff.
- **`messages` table audit before deletion.** Phase 5 deletion is gated on an explicit audit of all readers (recovery, supervisor context, planning promotion, CLI, tests). Until each reader has migrated to `WorkerEntry`-derived data or to a different source, `messages` writes continue.
- **Dual-write behind a feature flag** (`OMNI_UNIFIED_WORKER_STREAM`) for one release cycle. New writer always runs once the flag ships; reader flips when flag is on; old writer is removed after audit and observation.

## Write-acceptance semantics (resolves rollback hazard)

Append-only persistence makes "insert then delete on busy" (currently in `src/server/conversations/send-message.ts:400`) impossible to undo. Inputs are categorized by their acceptance state and only appended on durable acceptance:

| State | Trigger | Stream action |
|---|---|---|
| `accepted` | Server has validated the request and chosen a delivery path | nothing yet |
| `queued` | Inserted into `queuedConversationMessages` | nothing yet |
| `delivered` | `askAgent()` returned successfully OR `queued_message_delivered` fired | **append** `user_input`/`supervisor_input` with `timestamp = deliveredAt` |
| `failed` / `deferred` | Worker busy retry, validation error, etc. | nothing — caller's responsibility to retry; the queued-messages SSE event still surfaces the pending state via `/api/events` |

Consequence: the JSONL is a transcript of what was **delivered to the worker**, not of what the user attempted. The "pending / queued" UI state is rendered from `queuedConversationMessages` (which already exists), not from the stream. This eliminates the `delete-on-busy` rollback path entirely.

## Entry schema

New shared type in `src/server/workers/entries-types.ts`. `BridgeOutputEntry` (in `src/server/bridge-client/index.ts`) is **not** extended — the bridge keeps emitting only what it produces today.

```ts
// src/server/workers/entries-types.ts
export type WorkerEntryType =
  // bridge-produced
  | "message"
  | "thought"
  | "tool_call"
  | "tool_call_update"
  | "permission"
  // server-produced
  | "user_input"
  | "supervisor_input"
  | "system_note"
  | "lifecycle";

export interface WorkerEntry {
  id: string;            // stable id from the bridge for bridge entries; uuid for server-produced entries
  seq: number;           // monotonic per (runId, workerId), assigned at write time
  type: WorkerEntryType;
  text: string;
  timestamp: string;     // for server-produced entries: the delivery timestamp; for bridge entries: bridge clock
  toolCallId?: string | null;
  toolKind?: string | null;
  status?: string | null;
  raw?: unknown;
  authorRole?: "user" | "supervisor" | "system";
  attachments?: Array<{ id: string; filename: string; mimeType: string; sizeBytes: number }>;
}

// Type-narrowing helpers; existing agent-output renderers must use these
// instead of branching on `type` ad-hoc, so they cannot accidentally treat
// server-produced entries as bridge output.
export function isBridgeOutputEntry(entry: WorkerEntry): boolean { /* ... */ }
export function isServerProducedEntry(entry: WorkerEntry): boolean { /* ... */ }
```

`seq` is assigned at the writer; the bridge never sees it. `id` continues to be the dedup key for bridge entries. The writer converts `BridgeOutputEntry → WorkerEntry` at the boundary; nothing outside `output-store.ts` constructs `WorkerEntry` for bridge entries.

## Phase 1: Writer and schema groundwork (dual-write off)

- [ ] **Step 1:** Create `src/server/workers/entries-types.ts` with the `WorkerEntry` type and the `isBridgeOutputEntry` / `isServerProducedEntry` narrowing helpers. Do **not** modify `BridgeOutputEntry` in `src/server/bridge-client/index.ts`.
- [ ] **Step 2:** In `src/server/workers/output-store.ts`, add `appendWorkerEntry(runId, workerId, entry: Omit<WorkerEntry, "seq">): Promise<WorkerEntry>`:
  - Routes through the existing `writeChainByKey` per `${runId}/${workerId}`.
  - On first use per (runId, workerId), reads the file tail (and gz/archive fallbacks) to determine current max `seq`.
  - Caches the next `seq` in a `Map<key, number>` to avoid re-reading on every append.
  - Writes one JSON line + `\n`, fsync, no temp/rename (append is atomic for line-sized writes under POSIX; doc this assumption).
  - Returns the persisted entry with its assigned `seq`.
- [ ] **Step 3: Bring compaction/expand/delete under the per-worker chain.** Wrap `compactWorkerOutputFile`, `expandWorkerOutputFile`, and `deleteWorkerOutputFile` so they acquire `writeChainByKey` for `${runId}/${workerId}` before touching the file. Update `compactRunOutputs` and `compactStaleWorkerOutputs` (`src/server/workers/output-store.ts:499, 525`) to go through the same chain — today they bypass it, and an append racing with a rename can drop the new line. After this step, every file mutation for `(runId, workerId)` is serialized through one mutex.
- [ ] **Step 4:** Refactor `writeWorkerOutputEntries` to diff against the in-memory "seen ids" set (loaded lazily from the file) and call `appendWorkerEntry` only for new entries. Preserve `compactEntryForHistory` truncation behavior. Existing callers (`persistWorkerSnapshot`) get the same observable behavior with no overwrite.
- [ ] **Step 5:** Add `readWorkerEntriesSince(runId, workerId, afterSeq)` to `output-store.ts`. Returns `{ entries, latestSeq }`. Reuses `readWorkerOutputEntries`, filters by `seq`, and treats missing `seq` (legacy entries) as `0` on first request so all legacy content is delivered once.
- [ ] **Step 6:** Backfill `seq` lazily on read: when `readWorkerOutputEntries` encounters entries without `seq`, assign sequential numbers in file order before returning. Do **not** rewrite the file on read — assignment is in-memory only. The file is rewritten with `seq` fields on next compaction.
- [ ] **Step 7:** Add `OMNI_UNIFIED_WORKER_STREAM` env flag (default off). Wire a single `isUnifiedWorkerStreamEnabled()` helper in `src/server/feature-flags.ts` (create if absent).
- [ ] **Step 8:** Unit tests in `tests/server/workers/output-store.test.ts`:
  - Append assigns monotonic seq.
  - Reader returns entries in seq order after `afterSeq`.
  - Legacy file without `seq` fields gets virtual seqs assigned on read.
  - Concurrent appends through the per-worker chain stay serialized.
  - Diff-and-append never re-adds an entry with the same `id`.
  - **Append racing compaction: 100 interleaved appends + compaction sweeps preserve every entry, in order.**
  - File survives a simulated crash (truncated last line) and the writer continues at max-valid-seq + 1.

## Phase 2: Dual-write — capture inputs into the stream

Per the write-acceptance semantics above: append on **delivery**, not on accept. All four sites below must be covered or the transcript will drift.

- [ ] **Step 1: Direct-control immediate delivery.** Inside `continueWorkerConversation` (`src/server/conversations/send-message.ts:178`), after `askDirectWorkerWithResume` returns successfully and **before** the `getAgent` + `persistWorkerSnapshot` call at line 185, append `{ type: "user_input", text: trimmedContent, authorRole: "user", attachments, timestamp: deliveredAt }`. This ordering matters: `persistWorkerSnapshot` writes bridge entries with their own seqs; appending the input first guarantees the transcript order `user_input` → bridge tool_calls/messages, matching the lifecycle test in Step 10. Do **not** append in the busy-fallback branch at `send-message.ts:400` — the queued delivery path appends on its own `deliveredAt` boundary (Step 3).
- [ ] **Step 2: Initial-prompt path.** In `runInitialWorkerTurn` in `src/server/conversations/create.ts`, append `user_input` after `askAgent` returns successfully at line 253 and **before** the `getAgent`/`persistWorkerSnapshot` call at line 256–257. Timestamp = the `askAgent` resolution time. Appending at spawn ack would log a prompt that never reached the worker if `askAgent` fails.
- [ ] **Step 3: Queued steering delivery.** In `src/server/conversations/queued-messages.ts:488`, immediately after `askAgent(worker.id, workerContent)` resolves (and before the `queued_message_delivered` execution event at line 528), append `{ type: "user_input", ..., timestamp: deliveredAt }`. Use `record.content` (the literal user text), not `workerContent` (which has attachment context appended for the bridge).
- [ ] **Step 4: Supervisor-conversation queued delivery.** The `drainQueuedWorkerMessages` path at `src/server/conversations/queued-messages.ts:619` also inserts a user message row. Append `user_input` here on the same `deliveredAt` boundary.
- [ ] **Step 5: Supervisor → worker turns.** In `src/server/supervisor/index.ts:1100` (the `bridge.askAgent(workerId, prompt)` site in the worker spawn + prompt delivery path), append `{ type: "supervisor_input", text: prompt, authorRole: "supervisor", timestamp: deliveredAt }` immediately after `bridge.askAgent` resolves successfully and **before** `persistWorkerOutput` at line 1105. Do not append in the `isAgentBusyError` branch at line 1112 — that path defers and the prompt is re-delivered later via `deferBusyWorkerPrompt`; the append happens on that eventual delivery.
- [ ] **Step 6: Lifecycle.** In `src/server/supervisor/observer.ts` and the worker-runtime lifecycle observers, append `{ type: "lifecycle", text: "<summary>", raw: { eventType, details } }` for worker_spawned, status transitions, completed, cancelled, failed. These also continue producing `executionEvents` rows in this phase — `executionEvents` deletion is out of scope.
- [ ] **Step 7: Recovery/rerun paths.** Audit `src/server/runs/recovery.ts` and the rerun-from-checkpoint flow in `send-message.ts` for any path that inserts a user-role message into `messages` for a worker. Each one needs a parallel append on delivery. Document any path that re-uses a message id (so dedup-on-replay works).
- [ ] **Step 8:** Confirm the existing snapshot poll path (`persistWorkerSnapshot` → refactored `writeWorkerOutputEntries`) appends bridge entries with their original `id` so dedup works across restarts.
- [ ] **Step 9: Append-then-emit ordering.** Wire `worker_entry_appended` named event emission **after** the JSONL append has fsynced. Add the event variant to the `NamedEvent` union in `src/server/events/named-events.ts:87`. The SSE frame carries `{ workerId, seq }` only as a wake-up hint; the full entry is fetched via the endpoint. This keeps the ring buffer cheap and avoids two sources of truth on the wire.
- [ ] **Step 10:** Tests:
  - `tests/server/conversations/send-message.test.ts` — direct-control happy path appends `user_input` once; busy-fallback appends **zero** times (the queued path does it on delivery).
  - `tests/server/conversations/queued-messages.test.ts` — queued delivery appends `user_input` exactly once at the `deliveredAt` boundary; failed delivery appends zero.
  - `tests/server/supervisor/observer.test.ts` — lifecycle transitions append lifecycle entries.
  - A lifecycle scenario in `tests/lifecycle/scenarios/` that walks a full direct-control turn and asserts the JSONL contains: `lifecycle:worker_spawned` → `user_input` → `tool_call`s → `message` → `lifecycle:completed`, in seq order.
  - A scenario that triggers busy-fallback and verifies the JSONL has exactly one `user_input` entry after eventual delivery (not two, not zero).

## Phase 3: Read API and frontend stream

- [ ] **Step 1:** Add `GET /api/workers/:workerId/entries?afterSeq=N` in `src/app/api/workers/[workerId]/entries/route.ts`. Returns `{ entries, latestSeq }`. Validates the worker belongs to a run the caller may view (reuse existing run auth checks).
- [ ] **Step 2:** Extend the SSE stream in `src/app/api/events/route.ts` (or add a dedicated `/api/workers/:workerId/stream` route — prefer dedicated) to emit `worker_entry_appended` named events. Each event carries `{ workerId, seq }` only — **no entry body**. Clients must ignore any event body for content purposes and always fetch via `?afterSeq=` to get the entry itself. Re-uses the existing ring buffer / `Last-Event-ID` plumbing.
- [ ] **Step 3:** New manager: `src/app/home/WorkerEntriesManager.ts`. Per `(workerId)` cache holding `{ entries: WorkerEntry[], latestContiguousSeq: number, latestKnownSeq: number, status: "idle" | "loading" | "loaded" | "error" }`. Methods:
  - `subscribe(workerId, listener)` — listener fires on cache changes.
  - `ensureLoaded(workerId)` — kicks off `GET /api/workers/:workerId/entries?afterSeq=latestContiguousSeq` if not already loading.
  - `onWakeUp({ workerId, seq })` — invoked by the SSE `worker_entry_appended` handler. If `seq === latestContiguousSeq + 1`, fetches `?afterSeq=latestContiguousSeq`. If `seq > latestContiguousSeq + 1`, there is a gap — fetch the same way; the endpoint fills it. `latestKnownSeq = max(latestKnownSeq, seq)` so the loaded-check stays accurate while the fetch is in flight.
  - `onStreamResync()` — invoked when the SSE emits `stream.resync_required`. Same refetch path. Per-worker cursor means a global resync is a no-op for workers whose `latestContiguousSeq === latestKnownSeq`.
  - **Invariant**: `latestContiguousSeq` only advances when entries arrive with no gap. `entries` is always exactly the contiguous prefix `[1..latestContiguousSeq]`.
- [ ] **Step 4:** `isWorkerConversationLoaded(workerId) === state.latestContiguousSeq === state.latestKnownSeq && state.status === "loaded"`. Replaces the current `snapshotRunId === selectedRunId` heuristic *for worker content*. The existing flag stays for non-worker bootstrap state (runs list, accounts) — they remain on `/api/events`.
- [ ] **Step 5:** In `src/components/Terminal.tsx`, add an `entries: WorkerEntry[]` prop and a code path that renders directly from it in seq order. Keep the legacy `agent` + `userMessages` props for now (Phase 4 removes them). When `entries` is provided, the legacy props are ignored.
- [ ] **Step 6:** In `src/components/home/ConversationMain.tsx`:
  - Direct-control branch: when flag is on, mount `<Terminal entries={WorkerEntriesManager.useEntries(primaryWorkerId)} isLoading={!WorkerEntriesManager.isLoaded(primaryWorkerId)} />`. Loading spinner gate is `!isLoaded`.
  - Supervisor branch: same swap for each worker conversation panel.
- [ ] **Step 7: i18n.** Any new frontend copy introduced by this phase — loading state, error fallback, gap-recovery banner, empty stream placeholder — goes into `shared/locales/*.json` for every locale, rendered through `t()` per `AGENTS.md`. No hardcoded strings.
- [ ] **Step 8:** Tests:
  - `tests/app/worker-entries-manager.test.ts` — load, append, dedup, reconnect after seq gap, `latestContiguousSeq` invariant under out-of-order wake-ups.
  - `tests/ui/conversation-actions.test.ts` — direct-control Terminal renders entries in seq order under the new prop.
  - A lifecycle scenario that connects mid-turn (after some entries already exist), asserts the client loads them all before rendering, and that subsequent SSE appends arrive in order.
  - **Ring-buffer overflow scenario**: produce more events than the global SSE ring buffer holds, force the client to receive `stream.resync_required`, assert worker-entry cache rehydrates via `?afterSeq` with no gaps and no duplicates.

## Phase 4: Backfill and cutover

`messages` rows are not all worker-scoped — `workerId` is nullable on the `messages` table (`src/server/db/schema.ts:76`). Backfill needs explicit mapping rules before it can attribute a row to a worker.

- [ ] **Step 1:** Backfill script `scripts/backfill-worker-entries.ts`. Mapping rules, applied per row in `createdAt` order:
  - **`workerId` IS NOT NULL** → append to that worker's stream as `user_input` / `supervisor_input` / `message` based on `role`. Dedup by reusing `messages.id` as the entry `id`.
  - **`role:"worker"` with NULL `workerId`** → query `workers` for any worker active on `runId` at `createdAt`. If exactly one, attribute. If multiple or zero, log to a `requires_manual_attribution.jsonl` report and skip.
  - **`role:"user"` with NULL `workerId` on a `direct` run** → attribute to the run's single worker.
  - **`role:"user"` with NULL `workerId` on a non-direct run** → these are supervisor-conversation inputs, not worker inputs. Skip; they stay in `messages` as supervisor narration.
  - **Queued/checkpoint kinds** (`kind:"checkpoint"`) → same rules as their `role`. Reuse `messages.id` so a partially-delivered backfill is resumable.
  - **`role:"supervisor"`** with `workerId` → append as `supervisor_input` to that worker's stream. Without `workerId` → stays in `messages`.
  - **`executionEvents`** scoped to a worker → append as `lifecycle` to that worker's stream. Without `workerId` → skip (those are run-level events that stay in `executionEvents`).
  - **Recovered/rerun-truncated runs** → if a `messages` row was deleted by a rerun before this work shipped, it will not be backfilled (it's gone). Document this as expected.
- [ ] **Step 2:** Idempotent: re-running yields zero new appends (dedup by entry id = source `messages.id` or `executionEvents.id`).
- [ ] **Step 3:** Dry-run flag prints planned appends and the `requires_manual_attribution.jsonl` report and exits with non-zero if any manual cases exist.
- [ ] **Step 4:** Run backfill against a dev DB snapshot; spot-check at least four sessions (direct control, supervisor-driven, recovered-mid-turn, multi-worker supervisor run with the ambiguous-attribution path) in the UI behind the flag.
- [ ] **Step 5:** Flip `OMNI_UNIFIED_WORKER_STREAM=1` as the default. Both writers still run; reader now reads the new stream.
- [ ] **Step 6:** Observe for one release. Track: disk growth in `run-data/`, SSE message volume, "loading" spinner duration, any user reports of missing content, and the per-row attribution report from re-running the dry-run backfill.

## Phase 5: Audit and deletions

Phase 4 cutover leaves both writers running. Before deleting the old write paths for `messages`, every reader of those rows must be migrated. Steps 1–3 are the audit gate; Steps 4+ are the actual removals.

- [ ] **Step 1: Reader audit.** Enumerate every consumer of `messages` rows where `role IN ('user','worker')` AND `workerId IS NOT NULL` (or the equivalents that backfill mapped to a worker stream):
  - Server recovery (`src/server/runs/recovery.ts`, `recovery-reconciler.ts`).
  - Supervisor context assembly (anything that feeds prior transcript back into the supervisor LLM).
  - Planning promotion (`src/server/planning/`).
  - CLI/inspection tooling (`scripts/`).
  - Tests asserting on `messages` shape.
  Produce a checklist; each item becomes a sub-step in Step 2.
- [ ] **Step 2: Migrate each reader** to read from `readWorkerEntriesSince(runId, workerId, 0)` (or a higher-level helper that joins per-worker streams for the supervisor-context case). Land these one at a time, each behind the same flag.
- [ ] **Step 3: Run for a release** with readers on the new path but writes still dual-running. Watch for missing-content tickets.
- [ ] **Step 4:** Delete `synthesizeStreamingWorkerMessages` and its call site in `src/app/api/events/route.ts`.
- [ ] **Step 5:** Delete `mergeAgentOutputHistory`, `mergeOutputEntries`, and `mergeAgentSnapshots` from `src/app/home/EventStreamStateManager.ts`. Delete `mergeScopedMessages` only if Step 1 confirmed no non-worker code path needs it.
- [ ] **Step 6:** Remove `agents[].outputEntries` from the `/api/events` payload and the frontend type. Keep `agents[]` for non-content metadata (state, currentText for the "thinking…" indicator, bridgeMissing, lastError).
- [ ] **Step 7:** Delete `src/app/home/WorkerOutputLineCacheManager.ts` and its references.
- [ ] **Step 8:** Stop writing worker-attributed rows to `messages`. Specifically:
  - `role:"worker"` rows from `send-message.ts` and `queued-messages.ts`.
  - `role:"user"` rows on `direct` runs (the worker stream is now authoritative).
  - `role:"user"` `kind:"checkpoint"` rows from queued delivery on direct runs.
  Supervisor-conversation rows (`role:"user"`/`role:"supervisor"` without a worker attribution) keep being written — they have no worker stream to live in.
- [ ] **Step 9:** Drop the dual-write feature flag. Single writer for worker content, single reader.
- [ ] **Step 10:** Drop legacy props (`agent`, `userMessages`) from `Terminal` once all call sites pass `entries`. Delete dead code in `ConversationMain.tsx` (the merge-based timeline builder for direct-control mode).
- [ ] **Step 11:** Remove the legacy backfill path in `readWorkerOutputEntries` once a compaction sweep has rewritten all files with `seq` fields present.

## Phase 6: Tests cleanup and docs

- [ ] **Step 1:** Delete tests that exercise the deleted merge code (`tests/app/event-stream-state-manager.test.ts` — keep run/worker merge cases, drop agent-output merge cases).
- [ ] **Step 2:** Update `docs/architecture/lifecycle-observability-and-testing.md` to describe the single worker stream as the canonical content surface; reference the new endpoint, the `worker_entry_appended` `NamedEvent` variant, and the cursor split (global SSE id for liveness, per-worker `seq` for content).
- [ ] **Step 3:** Add a short `docs/architecture/worker-conversation-stream.md` explaining the file format, seq invariants, dedup-by-id rule, write-acceptance semantics (append on delivery, never on accept), dual-write history, and the "one writer, one reader" rule.
- [ ] **Step 4:** Update `AGENTS.md` with a one-liner pointing future contributors at the new stream — and an explicit "do not add a parallel persistence layer for worker conversation content" rule to prevent regression.

## Risks and mitigations

- **Seq under crashes.** Writer reads file tail to compute next seq. If a write was truncated mid-line, that line is skipped (existing `parseLines` already tolerates malformed lines). Next append continues from max-valid-seq + 1.
- **Append racing compaction** (the latent loss bug today). Fixed by Phase 1 Step 3: append, expand, compact, and delete all acquire the same per-worker mutex. Verified by the racing test in Phase 1 Step 8.
- **Bridge drops earlier entries from its in-memory list** (`omittedLiveEntries`). Diff is by `id` presence in the on-disk file, not by length. Once an entry has been written it is never re-added.
- **Out-of-order appends across processes.** A worker is owned by one runtime instance; the write chain is in-process. Document the single-writer-per-worker invariant prominently in `output-store.ts`. If we ever shard, this must be enforced by a file lock.
- **Cursor confusion.** Two cursors (global SSE id, per-worker seq) is the cost of keeping the existing ring buffer cheap. The rule is: SSE frames are wake-up hints, content always comes via `?afterSeq=`. Documented in Phase 6 Step 2. The `worker_entry_appended` named event carries `{ workerId, seq }` only, never the entry body.
- **Disk growth from lifecycle entries.** Lifecycle and input entries are small (text + small `raw`). Existing compaction (gzip after worker terminal status + 5 minutes idle) handles them transparently. Watch in Phase 4.
- **Cross-worker supervisor view.** Supervisor conversations that span multiple workers used to be one timeline via the `messages` table. After cutover, that view becomes a derived join across each worker's stream plus the supervisor's own `system_note` entries. The Phase 5 audit (Step 1) is the gate: deletion does not proceed until this view, if any, has been re-built as a frontend join.
- **Backfill ambiguity.** Manual-attribution cases (logged to `requires_manual_attribution.jsonl`) must be zero before Phase 4 Step 5. If they are not zero, either extend the mapping rules or document the cases as "stays in `messages` only, never reaches the new stream".
- **Test surface area.** Many existing tests assume `messages[]` contains worker text. Phase 5 Step 1 audit covers this; Phase 6 cleanup is non-trivial.

## Success criteria

- A fresh page load of any direct-control or supervisor-driven worker conversation either shows the loading spinner or shows the complete conversation up to `latestKnownSeq`. There is no intermediate state where some entries are visible and others aren't.
- Reconnecting an SSE stream after a network drop resumes exactly at `latestKnownSeq` with no duplicates and no gaps.
- The terms "merge", "reconcile", and "synthesize" no longer appear in the worker-content read path.
- A new contributor can answer "where is this content stored?" with one file path.
