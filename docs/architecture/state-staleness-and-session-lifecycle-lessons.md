# State Staleness and Session Lifecycle Lessons

Updated: 2026-05-20

This document records the state bugs found during the May 2026 session
staleness investigation. It is intentionally concrete. These bugs looked like
UI weirdness, but the root problem was deeper: several surfaces were allowed to
act as if they had authoritative state when they only had partial, stale, or
historical state.

The rule from `lifecycle-observability-and-testing.md` still applies:

> Observability for users and observability for tests are the same problem.

This document adds the client and transcript lessons we learned from the
incidents around `0785684884fa`, `14260d2a2df0`, `ecea142f7344`,
`18fc406457f3`, `7ebf2bc8e556`, and `17a194b3c1c1`.

Related: `docs/architecture/timing-determinism-audit.md` generalizes these
incidents into an audit checklist for cached previews, optimistic UI ownership,
async response guards, timer races, SSE anchors, and stable ordering.

## Core Principle

No component, manager, route, or recovery path may treat a snapshot as
authoritative unless that snapshot declares the scope it is complete for.

If the payload does not say "this is the complete state for run X", it is a
partial update. Partial updates may add or refine state. They must not erase
optimistic local state, recently created sessions, delivered user inputs,
worker stream entries, or read markers.

## What Went Wrong

### 1. Queued steering looked like it crossed conversations

Symptom:

- A message was sent in `0785684884fa`.
- The user immediately switched to `14260d2a2df0`.
- The UI then showed worker output in `14260d2a2df0`, creating the appearance
  that the new message may have been delivered to two conversations.
- `14260d2a2df0` also showed an old queued item that had already been deleted,
  and the queue controls were no longer clickable.

Actual failure class:

- The UI state for queued messages and active worker output was too easy to
  confuse with the selected conversation.
- A queued row in `delivering` state was not cancelable through the same path
  as `pending`.
- Delivery code did not guard every async boundary against a row being
  cancelled while the delivery turn was in flight.

Guardrails:

- Queue cancellation must accept both `pending` and `delivering` rows.
- Delivery must re-read persisted queue status before appending user input,
  before calling the bridge, after the bridge returns, and before catch-block
  recovery writes.
- A cancelled or missing queued row must never resurrect itself through a late
  async continuation.
- A forced queued send must use one stable message id for the UI row, the
  mirrored message, and the worker-stream `user_input` entry.
- The queued drawer may disable edit/send while delivering, but cancel must
  stay enabled until the row is terminal.

Tests to keep:

- Cancelling a `delivering` queued message hides it and does not append it to
  the worker stream.
- Cancelling during delivery does not let a late bridge response recreate the
  queue row or the transcript entry.
- Forcing queued send anchors the delivered user input to the same id the UI
  already knows about.

### 2. Direct runs were classified from stale historical output

Symptom:

- A direct run appeared stuck or `awaiting_user` even though the worker had
  finished.
- Old `outputLog` text containing an input request could keep influencing the
  run status after newer bridge text said the turn was done.

Actual failure class:

- Status classification joined or considered historical text too broadly.
- Old output was treated as equally authoritative with the latest worker text.

Guardrails:

- Direct-run status must prefer the newest visible output source:
  `responseText`, `currentText`, `lastText`, latest visible stream entry,
  then older rendered or legacy output.
- A terminal direct worker with visible current/last text should resolve to
  `done` unless the latest visible text is actually asking the user a question.
- Any server-side status correction must notify event-stream subscribers.
- Historical text may support display and debugging, but must not overrule the
  latest worker state.

Tests to keep:

- A stale legacy `outputLog` question cannot make a completed direct turn look
  like `awaiting_user`.
- Recovery/sync of an idle direct worker with visible output persists `done`.
- `awaiting_user` is emitted only when the latest visible output requests user
  input.

### 3. Completion notifications stayed unread after being read

Symptom:

- `ecea142f7344` showed the blue unread dot.
- Opening the conversation appeared to mark it read.
- Switching away left the blue dot visible.

Actual failure class:

- The sidebar unread calculation and the selected-run read marker used
  different timestamp sources.
- Completion can be represented by `run.updatedAt`, not only by message rows.
- Running-state update churn must not create unread notifications.

Guardrails:

- Use one helper for both "is this run unread?" and "what timestamp should be
  marked read when this run is selected?"
- For terminal or user-relevant states (`done`, `awaiting_user`, `failed`,
  `needs_recovery`), compare against the later of latest message time and
  `run.updatedAt`.
- For `running`, use latest message time only. Do not turn polling/sync churn
  into unread notifications.

Tests to keep:

- Opening a completed run clears the unread dot even when completion is only
  visible through `run.updatedAt`.
- A running run's `updatedAt` changing by itself does not make it unread.

### 4. Newly created sessions could disappear until reload

Symptom:

- `18fc406457f3` appeared in the sidebar after creation.
- It then promptly disappeared.
- Reloading the page brought it back.

Actual failure class:

- The client had an optimistic "created conversation" snapshot, but deleted it
  after the server had included the run for a short stable window.
- A stale in-flight SSE/cache payload could arrive later without the new run.
- Once the optimistic snapshot had been pruned, the stale payload could replace
  the sidebar list and hide the run until a full reload.

Guardrails:

- Optimistic created-conversation snapshots stay alive until explicit
  delete/archive removes them, or the page lifecycle ends.
- Seeing a created run in one server payload is not proof that every later
  in-flight payload is fresh.
- A snapshot that omits a recently created run may not remove it unless the
  snapshot's completeness and freshness are explicit.
- Cache hydration must merge around current state. It must not treat older
  cached runs as a replacement for live local state.

Tests to keep:

- A newly created run survives stale event payloads before the server sees it.
- A newly created run survives late stale payloads after the server has seen it.
- A newly created run survives stale payloads even after the previous
  server-visible grace window has elapsed.
- Explicit delete/archive still removes the optimistic snapshot so deleted runs
  are not resurrected.

### 5. "Stuck" can be a control-plane bug, a stream bug, or a viewport bug

Symptom:

- `18fc406457f3` looked stuck.
- Runtime output was still being produced.
- Later the run reached `done`, and its worker stream contained the final
  output.

Actual failure class:

- "Stuck" is not a single state. It can mean:
  - `runs.status` is wrong.
  - `workers.status` is wrong.
  - The bridge is working but persisted worker entries are stale.
  - Persisted worker entries exist but `WorkerEntriesManager` has not loaded
    the contiguous range.
  - The transcript rendered but the viewport is scrolled to the beginning.
  - A stale selected-run snapshot is hiding the active run entirely.

Guardrails:

- Never diagnose stuckness from the sidebar alone.
- For a session id, inspect all of:
  - `runs`
  - `workers`
  - `messages`
  - `queued_conversation_messages`
  - `execution_events`
  - bridge `/agents`
  - worker stream under `getAppDataPath("run-data")`
  - `/api/events/log?since=<id>&runId=<id>` when event causality matters
- The worker stream is the transcript source of truth. Bridge runtime output is
  useful for liveness, but the UI should render through the persisted stream.
- Reloading or selecting a completed session should position the conversation at
  the latest output using a layout-phase instant scroll, then use smooth follow
  only for later live output.

Tests to keep:

- Direct worker stream loading fetches entries by `afterSeq` and reaches the
  latest contiguous seq.
- The terminal initially opens at the latest output for an existing transcript.
- Switching sessions resets first-positioning state so the next session is not
  left at an old scroll offset.

### 6. Stale worker streams can hide real user messages

Symptom:

- Loading `17a194b3c1c1` did not show the user's opening message at the top.
- The `messages` table contained the user message, but the worker JSONL started
  with lifecycle/agent entries and had no matching opening `user_input`.
- The conversation was historical leftover data, but the UI still had to render
  it intelligibly.

Actual failure class:

- The unified worker stream is the transcript authority, but legacy/historical
  data can be incomplete.
- `Terminal` was given both `entries` and `userMessages`. Once `entries` was
  present, legacy props were ignored, so a stale stream with no `user_input`
  hid the durable user row.
- Treating this as a normal loading state made the missing prompt look like a
  frontend bug instead of a stream/data integrity gap.

Guardrails:

- The worker stream remains the authority for worker-backed transcripts.
- `messages` rows are fallback evidence, not a second transcript source.
- Fallback user rows may be rendered only after `WorkerEntriesManager` reports
  the selected worker stream is loaded. Before that, the stream may still be
  incomplete in the client.
- Fallback placement must infer an order from nearby stream entries, timestamps,
  and known missing first-turn patterns. It must preserve chronological order.
- A stream that is missing the opening `user_input` should be treated as stale
  legacy data and documented by tests. Do not fix it by adding another
  persistence layer.

Tests to keep:

- A loaded stale stream missing the first `user_input` still renders the opening
  `messages` row at the top.
- A loaded stale stream missing a later user input places the fallback row in
  chronological order relative to agent/tool entries.
- An empty or partially loaded stream does not render fallback rows early.

### 7. Fallback rows can create a false chronology while entries load

Symptom:

- Loading `7ebf2bc8e556` initially showed both user messages immediately.
- One or two seconds later, the agent/tool entries that belonged between those
  user messages appeared.
- The final rendered state was correct, but the loading path told a false story
  for a moment.

Actual failure class:

- The UI allowed durable DB user rows to render before the worker stream had
  loaded its contiguous prefix.
- That made the DB mirror look authoritative during the loading window.
- When stream entries arrived, the client corrected itself, but the user had
  already seen a broken ordering.

Guardrails:

- Never render future `messages` rows ahead of an unloaded worker stream.
- Loading may show a pending/empty state, but it may not synthesize a transcript
  from a mirror table and later splice worker content into the middle.
- The fallback gate is `allowUserMessageFallback && entries.length > 0 &&
  WorkerEntriesManager.isLoaded(workerId)`, not merely "we have messages".
- A final correct state is not enough. The initial loading state is part of the
  product surface and needs tests.

Tests to keep:

- With no stream entries yet, `Terminal` does not render both DB user rows for a
  multi-turn worker conversation.
- With only the first stream entry loaded, `Terminal` does not render later DB
  user rows ahead of unknown worker output.
- Once the contiguous stream is loaded, fallback rows appear only where the
  missing stream entries belong.

### 8. Frontend cache existed but was not used on selection

Symptom:

- Switching back to a conversation still showed a loading transition even when
  the conversation had already been loaded and had not changed.
- The frontend had a cache, but route selection did not synchronously hydrate
  the selected run from the scoped cached snapshot.
- Snapshot fetches reapplied the same payload repeatedly.

Actual failure class:

- Cache write and cache read were not part of the same selected-run contract.
- The app treated conversation selection as "wait for the server snapshot"
  instead of "hydrate cached state immediately, then verify freshness".
- Without a checksum, an unchanged snapshot still looked like new work.

Guardrails:

- Route-scoped event snapshots must be readable synchronously on selection.
- Selecting a run hydrates the scoped frontend cache before the next network
  round trip can complete.
- Snapshot payloads carry `snapshotChecksum`.
- `GET /api/events?snapshot=1&checksum=<cached>` returns a not-modified payload
  when the server snapshot has not changed.
- A not-modified snapshot is a no-op for state replacement. It should not reset
  loading flags, scroll anchors, read markers, or cached transcript data.
- Cache hydration must be scoped by run id. A cached payload for one selected
  run cannot replace another selected run.

Tests to keep:

- `EventStreamStateManager.hydrateFromCacheScope(runId)` replaces state from
  the scoped cache and preserves the cached checksum.
- A not-modified snapshot response does not call the state replacement path.
- Switching between two loaded conversations shows cached state immediately,
  then updates only if the checksum changed.

### 9. Scroll affordances must mean content, not padding

Symptom:

- A page with only the user's message and an empty `Thinking...` row scrolled
  down into empty space.
- The floating "more below" indicator appeared even though there was no real
  content below the viewport.

Actual failure class:

- The scroll heuristic treated bottom padding and composer clearance as
  meaningful overflow.
- A pending assistant indicator is useful, but it is not enough to justify
  scrolling the viewport into empty space or showing a "more below" affordance.

Guardrails:

- `shouldConversationShowOutputBelow` must require meaningful overflow beyond
  layout padding.
- Initial auto-scroll for an existing conversation should happen only when
  there is real transcript content below the viewport.
- Pending states can render in place without forcing the conversation to the
  artificial bottom spacer.
- Scroll indicators are promises: if the UI says there is more below, there
  must be content worth seeing below.

Tests to keep:

- Bottom-padding-only overflow does not trigger the output-below indicator.
- A lone pending assistant indicator does not force an initial scroll.
- Real transcript overflow still triggers the indicator and first-positioning
  logic.

## Required Triage Protocol for Session IDs

When a user gives a UUID and asks what is going on, treat it as an OmniHarness
session lookup. Do this before making claims about what happened:

1. Query `runs` for the id and record `mode`, `status`, `created_at`,
   `updated_at`, `title`, and project path.
2. Query `workers` for the run and record `status`, bridge session id,
   current/last text presence, and update time.
3. Query `messages` for the run. Count user messages and compare content
   prefixes across suspected duplicate sessions.
4. Query `queued_conversation_messages` for the run. Check whether old rows are
   `pending`, `delivering`, `cancelled`, or terminal.
5. Query `execution_events` for state transitions and surfaced errors.
6. Compare persisted worker stream entries with bridge runtime output.
7. Use the dev event log when the question is "did the server do X?"

Do not infer duplication from visible worker text alone. The proof of duplicate
delivery is a matching message row or a matching `user_input` entry in another
worker stream. If those are absent, say that clearly.

## Implementation Rules

### Snapshot Merging

- Incoming run/message snapshots are not automatically authoritative.
- Completeness must be explicit. Absence from a partial payload is not deletion.
- Local optimistic state must be cleared by explicit success/failure paths, not
  by time alone.
- Any "stable window" heuristic must be treated as suspicious. Time passing is
  not proof that all older async work has drained.

### Queue Delivery

- Queue state is durable state. The database row wins over any closure-captured
  JavaScript object.
- Every long async delivery path must re-read queue status around bridge calls.
- `cancelled` is terminal. No catch block may transform it back into pending,
  failed, or delivered.

### Read Markers

- The timestamp used to display an unread indicator and the timestamp written
  when opening a run must come from the same helper.
- `run.updatedAt` is meaningful only for terminal/user-relevant states.
- Polling churn while running is not a notification.

### Worker Transcript

- Persist worker content through the unified worker stream.
- Render worker content through `WorkerEntriesManager` and `Terminal` entries.
- Do not add a second persistence layer to paper over stream loading bugs.
- If bridge output exists but the worker stream does not, fix persistence or
  sync. Do not teach the frontend to reconcile another source of truth.
- Use `messages` fallback rows only after the relevant worker stream is loaded.
  While entries are empty or partial, the client does not know enough to place
  fallback rows safely.
- Fallback rows must be deduped and ordered around stream entries; they must
  never appear ahead of unknown worker content.

### Event Snapshot Cache

- Cache hydration is part of selected-run routing, not an optional later
  optimization.
- Hydrate the scoped cached snapshot synchronously when selection changes.
- Preserve and send the cached `snapshotChecksum` during snapshot bootstrap.
- Treat not-modified snapshot responses as no-ops. They confirm freshness; they
  do not replace state.
- Never use an unscoped cache entry to replace the selected run's state.

### Conversation Scroll

- Scroll indicators must be based on meaningful transcript overflow, not bottom
  padding or composer clearance.
- Initial first-positioning may jump to the latest real transcript content.
  Empty pending space does not count as transcript content.
- A loading or pending state may show progress without forcing the viewport to
  an empty artificial bottom.

### Status Classification

- Latest visible output beats legacy output.
- A run may be `done` even if older text contained a question.
- A run may be `awaiting_user` only when the latest visible worker response is
  asking the user for input.

## Regression Checklist

Before declaring a state/lifecycle fix complete, run the smallest targeted
tests plus at least one test that exercises stale data arriving after fresh
data:

- Queue delivery/cancellation tests.
- Direct run status sync/recovery tests.
- Sidebar unread/read-marker tests.
- Home state merge tests for optimistic create plus stale payloads.
- Worker entries loading tests when the change touches transcript rendering.
- Terminal fallback ordering tests when a change touches `messages` + stream
  reconciliation.
- Event snapshot cache hydration and not-modified checksum tests when a change
  touches selected-run loading or `/api/events?snapshot=1`.
- Scroll affordance tests when a change touches first-positioning, bottom
  padding, or output-below indicators.
- `git diff --check`.

If a full typecheck fails on unrelated repo debt, record the exact failures in
the handoff or final response. Do not summarize it as "typecheck passed".

## Red Flags in Future Code Review

Flag these patterns immediately:

- `setState(incoming)` on streamed data without a scoped merge contract.
- Deleting optimistic state because a timer elapsed.
- Treating "server included this once" as "all future in-flight payloads are
  fresh".
- Reading queued-message status once, then doing async bridge work without
  checking again.
- Classifying lifecycle status from concatenated historical output.
- Separate helpers for unread display and mark-read writes.
- Rendering worker text from both bridge output and persisted stream in the
  same path.
- Rendering fallback DB user rows before the worker stream is loaded.
- Replacing scoped cached state without checking the selected run id.
- Reapplying unchanged snapshots as if they were fresh data.
- Showing "more below" from padding-only overflow.
- Silent catch blocks around spawn, sync, delivery, recovery, delete, or
  persistence.
