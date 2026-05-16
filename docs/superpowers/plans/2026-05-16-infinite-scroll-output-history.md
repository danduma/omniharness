# Infinite-scroll output history (kill the "X older records archived" marker)

**Date:** 2026-05-16
**Owner:** TBD
**Status:** Proposed (revised after first-round review)

## Goal

Two outcomes that have to hold true everywhere in the UI:

1. **No "X older raw worker activity records…" / "X earlier output entries omitted…" markers ever rendered.** They're a leaky internal detail and infuriate users opening older conversations.
2. **Conversation/worker views show a continuous window of real entries**, with older entries auto-loaded as the user scrolls up. No magic "open the worker detail again as it updates" copy.

Triggering bug: opening session `2b665fecf0d1` shows `22 older raw worker activity records are only in archived history, not in the current terminal output.` even though the full 177-entry history (worker-1: 22, worker-2: 155) is sitting on disk in `.omniharness/agent-runtime-output/`.

## Current state (so the plan is grounded)

- **Agent runtime archive** — `src/server/agent-runtime/output-store.ts`. Append-only JSONL with byte-cursor pagination already implemented in `AgentOutputArchive.readPage({ cursor, limit })` (output-store.ts:168-205). In-memory `outputEntries` capped at `LIVE_OUTPUT_ENTRY_LIMIT = 80`; `selectLiveOutputEntries` injects the `output-archive-marker` message when pruned (lines 277-292).
- **Worker terminal output** — `src/server/workers/output-store.ts`. *Not* an append-only byte-cursor archive: reads whole JSONL / `.gz` / `.zip` / legacy snapshot blobs in one shot. Mirroring the agent endpoint here requires either an index-based cursor (slice in memory after a single full read) or a real archive refactor. We pick the simpler path for v1; see Phase 1b.
- **SSE compaction** — `src/app/api/events/route.ts` `selectCompactAgentOutputEntries` (line 515) keeps only head + tail + lifecycle tool entries and inserts an `output-entries-omitted:*` marker for the live SSE payload.
- **Existing full-history endpoint** — `GET /api/agents/[name]?history=full` already returns up to 20k coalesced archive entries (`route.ts:113-124`). Used in some places but not by the live conversation view by default.
- **Markers are partially filtered on the frontend** — `lib/agent-output.ts:103,176,999`, `WorkerCard.tsx:157-158`, `EventStreamStateManager.ts:25,30,…`. They still leak through wherever rendering reads `outputEntries` directly (`Terminal.tsx`, `ConversationMain.tsx`).

So this is half-built. The plan finishes it.

## Cursor API contract (defined up front, see review point 2)

Both new endpoints return:

```ts
type OutputPageResponse = {
  entries: OutputEntry[];           // chronological, oldest-first, post-sanitization (no marker entries)
  olderCursor: string | null;       // pass back to load entries strictly older than the oldest in this page; null = no older data
  newerCursor: string | null;       // pass back to load entries strictly newer than the newest in this page; null = caller already has the tail
  totalEntries: number;             // count of *visible* entries after marker sanitization, when knowable; -1 only when the store can't compute it cheaply (some legacy archives) — see review point 3
  byteSize?: number;                // agent-runtime only; omitted for worker store
};
```

`olderCursor` / `newerCursor` are opaque strings from the client's perspective. The server is responsible for translation. **No "forward-only with `nextCursor`" semantics** — the previous shape was a footgun for scroll-back.

**Exact cursor semantics (review point 1).** Each store maintains an ordered index of `{ id, startByte, endByte }` (agent-runtime) or `{ id, index }` (worker), oldest-first.

Agent-runtime archive (byte offsets):
- `olderCursor = "byte:<startByte of oldest returned entry>"` — server returns entries whose `endByte <= startByte` of the cursor (strictly older).
- `newerCursor = "byte:<endByte of newest returned entry>"` — server returns entries whose `startByte >= endByte` of the cursor (strictly newer).

Worker store (entry indices):
- `olderCursor = "idx:<startIndex of oldest returned entry>"` — server returns entries with `index < startIndex`.
- `newerCursor = "idx:<endIndexExclusive>"` where `endIndexExclusive = indexOfNewestReturned + 1` — server returns entries with `index >= endIndexExclusive`.

Both cursor families are half-open in the same direction so backward pages tile cleanly without overlap or off-by-one. A `null` `olderCursor` means "no older data on disk"; `null` `newerCursor` means "caller already has the tail at the time of this response."

Request shape:

```
GET /api/agents/[name]/output?before=<olderCursor>&after=<newerCursor>&limit=100
```

- `before` set → return up to `limit` entries strictly older than that cursor (the scroll-back case).
- `after` set → return up to `limit` entries strictly newer (resume / catch-up case).
- Neither set → return the most recent `limit` entries (initial load).
- Both set → 400.

## Phase 0 — Tests first (lock the contract)

Files to add/update assertions in:

- `tests/lib/agent-output.test.ts` — rendering a snapshot whose `outputEntries` contains an `output-archive-marker` or `output-entries-omitted:*` entry must produce **zero** user-visible items mentioning "older raw worker activity" or "earlier output entries omitted". Covers id-based and substring fallbacks. **Invert** the existing assertions at lines 890, 991.
- `tests/api/agent-route.test.ts` — invert the assertion at line 79; add coverage for `GET /api/agents/[name]/output` with `before` / `after` / no-params variants asserting `olderCursor`/`newerCursor` semantics and that no marker entry ever appears in `entries`.
- `tests/api/events-route.test.ts` — assert SSE payloads never include marker entries, but their snapshot metadata exposes `omittedLiveEntries` and `totalEntries`. (Called out in review point 4.)
- `tests/app/event-stream-state-manager.test.ts` — drop the marker-aware merge tests; replace with tests that `EventStreamStateManager` ingests payloads with no markers and exposes `totalEntries` / `oldestKnownCursor` per agent. (Review point 4.)
- `tests/server/agent-runtime/http.test.ts` — invert/remove the assertion at line 861.
- New `tests/app/conversation-infinite-scroll.test.ts` — component-level test: when `outputEntries.length < totalEntries`, the IntersectionObserver sentinel firing dispatches the loadOlder mutation, the older entries get prepended, and scroll position is anchored.
- New `tests/server/agent-runtime/output-pagination.test.ts` — direct `readPage` / new `readArchivePage` coverage for forward, backward, and end-of-file edge cases.

## Phase 1a — Backend (agent runtime): stop emitting markers, add pagination endpoint

### `src/server/agent-runtime/output-store.ts`
- Delete the marker injection branch in `selectLiveOutputEntries` (lines 282–291). Function returns `record.outputEntries.map(...)` clones only.
- Keep `stats()` + `omittedLiveEntries` so SSE snapshots can advertise "there's more on disk" — but never manufacture entries from it.
- Bump `LIVE_OUTPUT_ENTRY_LIMIT` from 80 → 300 so first paint almost never needs an immediate scroll-back fetch.
- Add `readArchivePage(record, { before?, after?, limit })`:
  - `before` carries a `startByte` (decoded from the `"byte:<n>"` cursor). Return entries whose `endByte <= before.startByte`, take the newest `limit`, sort oldest-first. (See "Exact cursor semantics" above.)
  - `after` analogous in the forward direction (entries whose `startByte >= after.endByte`).
  - Implementation: keep an in-memory ordered index of `{ id, startByte, endByte }` built lazily on first archive read (one full file scan, then O(log n) lookup + O(limit) walk per page). For very old archives we still do a streaming scan but cap memory.
  - `totalEntries` is the index length **after** running the marker sanitizer (review point 3).

### `src/app/api/events/route.ts`
- Delete the marker injection in `selectCompactAgentOutputEntries` (lines 533–555). Keep the head/tail compaction (SSE payload still needs bounding) but drop the omitted entries silently. Include `omittedLiveEntries` + `totalEntries` + `oldestKnownCursor` in the snapshot metadata so the frontend knows more is available via REST.

### New route `src/app/api/agents/[name]/output/route.ts` (`GET`)
- Query params per the cursor contract above.
- Server-side **legacy sanitizer** strips any marker entries by id prefix (`output-archive-marker`, `output-entries-omitted:`) so old archives are filtered on read. This sanitizer stays in the codebase permanently — it is **not** removed in Phase 3. (Review point 3.)
- Calls `getAgentOutput(name, { before, after, limit })` via bridge-client.

### `src/server/bridge-client/index.ts`
- Extend `getAgentOutput` to accept `{ before?, after?, limit? }` (today: `{ limit }` only).

### Type propagation (review point 2)
The new snapshot metadata (`omittedLiveEntries`, `totalEntries`, `oldestKnownCursor`, `newerKnownCursor`, `outputArchive` flags) has to be declared everywhere the snapshot/live-snapshot type flows. Files to update in this phase, end-to-end, so the metadata survives serialization:
- `src/server/workers/live-snapshots.ts:189` — add the new fields to whatever the snapshot builder produces here; ensure they're populated from the output store rather than dropped.
- `src/server/agent-runtime/output-store.ts` — `stats()` return type extended with the cursor + total fields.
- `src/app/home/types.ts:152` — extend `AgentSnapshot` (and any sibling worker snapshot type) with `totalEntries`, `oldestKnownCursor`, `newerKnownCursor`, `omittedLiveEntries`. The frontend cache managers depend on these being typed, not stringly-keyed.
- `src/server/bridge-client/index.ts` — propagate through any bridge response types.
- `src/app/api/events/route.ts` — SSE payload type carries the same fields.

Without this propagation the runtime data flows but TypeScript can't enforce that the frontend reads what the backend writes, which is how the current marker mess was allowed to drift.

## Phase 1b — Backend (worker terminal): pagination without a full archive refactor

The worker store is **not** an append-only byte archive. Path of least disruption:

- Keep the existing whole-file read (JSONL / `.gz` / `.zip` / legacy snapshot) inside `readWorkerOutputEntries`.
- Add `readWorkerOutputPage({ runId, workerId, before?, after?, limit })` that calls `readWorkerOutputEntries` once, **runs the marker sanitizer**, then slices the result by **entry index** per the cursor semantics above (half-open: `before.startIndex` exclusive on the high side, `after.endIndexExclusive` inclusive on the low side). Returns it in the same `OutputPageResponse` shape with `totalEntries = sanitizedEntries.length`. Total cost: one disk read per page. Acceptable for v1.
- Cache the most recent decoded entries array per `(runId, workerId)` in an LRU keyed by file mtime + size, so a user repeatedly scrolling back doesn't re-decode the gzip/zip on every page.
- File a follow-up to migrate the worker store to append-only JSONL with byte-cursor parity (separate plan, not blocking).

### New route `src/app/api/workers/[id]/output/route.ts`
- Mirrors agent endpoint. Same `OutputPageResponse` shape, index-based cursor strings under the hood.
- **Route only has `workerId`** (URL param). It looks up the worker row in the DB to recover `runId`, then calls `readWorkerOutputPage({ runId, workerId, before, after, limit })`. The store helper still takes both ids — the route is the lookup boundary. (Review point 4.) Returns `404` if the worker row is missing.

### Worker-store omission strings — scoping note (review point 5)
- `truncateHistoryStringByChars` / `truncateHistoryString` (`workers/output-store.ts:49-73`) and the diff-side omission strings (`130-152`) are **truncation metadata for individual large command payloads**, not output-history gap markers. **Leave these alone.** This plan only removes markers that represent "we have older entries you can't see"; it does not touch per-entry payload compression.

## Phase 2 — Frontend: filter what slips through + scroll-back loader

### `src/lib/agent-output.ts` (permanent sanitizer, review point 3)
- Tighten `isOmittedOutputEntriesMarker` (line 103) to also catch by text-prefix as belt-and-suspenders for old archived files: `/^\d+ (older raw worker activity records|earlier output entries omitted)/`. This filter **stays** — it sanitises legacy cached/archive data we don't control. It is the canonical check; every UI codepath flows through it.

### `src/components/home/ConversationMain.tsx`, `src/components/Terminal.tsx`, `src/components/WorkerCard.tsx`
- Audit every place that iterates `outputEntries` directly and route through the central filter from `lib/agent-output.ts`. No component should accept a marker entry as input.

### Ownership of fetch + in-flight state (review point 7)

Single owner: the existing home mutation/manager flow. Concretely:

- **Cache managers** (`EventStreamSnapshotCacheManager`, `WorkerOutputLineCacheManager`) gain new persisted fields: `oldestKnownCursor: string | null`, `newerKnownCursor: string | null`, `totalEntries: number`. They hydrate/persist these but do **not** make network calls.
- **New mutation** in the home view model (`useHomeViewModel.ts` or a new `useLoadOlderOutput.ts` sibling): `loadOlderAgentOutput({ name })` / `loadOlderWorkerOutput({ workerId })`. Owns the in-flight `Set<string>`, debounces overlapping calls, and dispatches the merge into the cache manager when the fetch resolves.
- Components subscribe to `{ hasMore, isLoadingOlder }` from the view model and invoke the mutation when the IntersectionObserver sentinel fires.

### `src/components/home/ConversationMain.tsx`, `src/components/WorkerCard.tsx`, `src/components/Terminal.tsx`
- Wrap the scrollable container with an IntersectionObserver sentinel at the top. When it intersects and `hasMore` is true and no fetch is in flight, dispatch the mutation.
- Preserve scroll position on prepend: capture `scrollHeight` before merge; after render set `scrollTop += newScrollHeight - oldScrollHeight`.
- Render an i18n'd loading affordance while a backward fetch is in flight. **No "X messages are archived" copy ever.**

### i18n (review point 6)
- New keys in every `shared/locales/*.json`:
  - `conversation.history.loadingOlder` → "Loading older messages…" (en)
  - `conversation.history.loadOlderFailed` → "Couldn't load older messages. Try again." (en) — desktop-first wording; avoid "Tap to retry" since most surfaces are mouse/keyboard. (Review point 6.)
- All other present locales (de, es, fr, ja, ko, pt-BR, zh-CN, …) get parallel entries. Translation pass goes through whichever process the repo uses; ship English first if locked, but no hard-coded strings in components. Render with `t()` plus `useI18nSnapshot()` where the component needs reactive locale switching.

### First-load behavior
- On opening a conversation/worker, if `oldestKnownCursor` is null (we only have what SSE sent) **and** `omittedLiveEntries > 0`, kick off one immediate backward `loadOlder` so the user starts with ≥1 page of history without scrolling. Small conversations make no extra calls.

## Phase 3 — Cleanup (narrowed, review point 3)

**Remove:**
- Marker *generation* in `agent-runtime/output-store.ts` (already done in Phase 1a).
- Marker *generation* in `app/api/events/route.ts` (already done in Phase 1a).
- Marker-aware merge / counting logic in `EventStreamStateManager.ts` (lines 30, 51, 85, 91, 112, 118, 373) — these special-cases existed to preserve marker entries through merges; with generation gone, they're dead. Collapse to the standard non-marker path.
- Unused constant `ARCHIVE_MARKER_ID` in `output-store.ts`. **Leave `OUTPUT_TRUNCATION_MARKER` in place** — it is still consumed by `appendBoundedText` for per-field payload truncation, which is out of scope here (review point 5).
- Inverted/removed test assertions per Phase 0.

**Keep (permanently):**
- The central frontend sanitizer in `lib/agent-output.ts` (`isOmittedOutputEntriesMarker`) — defends against legacy archived/cached payloads that may live on user machines.
- The server-side sanitizer in the new output endpoints (same reason).
- Marker filters in `WorkerCard.tsx:157-158`, `worker-terminal-messages.ts:25` — same defensive role; these are cheap and stop a regression from reaching the user.

This split keeps the cleanup focused on removing the *broken* code (generation + merge book-keeping) while preserving cheap defenses against bad data on disk.

## Phase 4 — Verify end-to-end

- Test suite passes with inverted assertions and new pagination tests.
- Manual: open session `2b665fecf0d1`:
  - No marker line.
  - Latest window of real entries visible immediately.
  - Scrolling up loads worker-1's 22 entries + the older worker-2 entries until everything is visible.
  - Scroll position stays anchored during prepend.
  - i18n: switch locale, confirm loading affordance localizes.
- Verify JSONL archive files were not modified (size unchanged after a session loads).
- Verify worker-store gzip/zip archives are not modified either.

## Out of scope / explicit non-goals

- Supervisor context-window truncation strings (`server/supervisor/context-window.ts`) — those go into LLM prompts, not the UI.
- Per-entry byte/char truncation of `text` / `raw` fields, and worker command-history compression strings (review point 5). Safety bounds for individual large payloads, not gap markers.
- Worker-store migration to append-only byte-cursor archive — separate follow-up plan; this work uses index-based pagination over the existing format.
- Unbounded frontend memory: cache still has a soft cap (~5k entries); entries beyond that get evicted from memory and re-fetched on scroll.

## Estimated change footprint

- Backend agent-runtime: ~180 lines net (new route + index helper), `-60` deleted marker code.
- Backend worker: ~120 lines (new route + paging helper + LRU cache).
- Frontend cache managers + mutation: ~250 lines added.
- Frontend components (sentinel, scroll-anchor, i18n hookup): ~150 lines.
- Cleanup of marker-aware merge logic: `-120` lines.
- Tests: ~8 files touched.
- i18n: N keys × M locales; mechanical.

## Suggested commit sequence

1. `tests: assert archive markers never reach UI; add pagination contracts` (red)
2. `server(agent-runtime): stop injecting markers; expose /api/agents/[name]/output`
3. `server(workers): index-based pagination via /api/workers/[id]/output`
4. `frontend: load older output on scroll with single-owner mutation`
5. `cleanup: remove marker-generation + marker-aware merge logic (keep sanitizers)`
6. `i18n: add loading-older-messages keys across locales`

## Open questions

- Does the home view model already have a mutation primitive shape we should reuse, or do we add a new one? (Affects whether Phase 2 ownership lives in `useHomeViewModel.ts` or a sibling file.)
- Are there any consumers of the SSE payload outside the web frontend (CLI, native wrapper) that depend on the marker entry being present? Grep says no, but worth a final confirm before deletion.
- Acceptable initial-load prefetch count: one page (100) or two? Two reduces "scroll, wait, scroll" feel but costs a redundant request for small archives.
