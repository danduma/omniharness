# Direct-Control Session Regression Lessons

This document records the direct-control and worker-stream bugs found while
debugging sessions `ffb912d4d5d7`, `937e642f3535`, and `734cc38f4d7f`.

The point is not blame. The point is to make the failure modes memorable enough
that new work trips alarms before users see blank output, stale queues, or
permanent "Thinking..." states again.

## What happened

### Lifecycle noise rendered as conversation output

The direct-control terminal showed implementation details such as
`Worker spawned (gemini)` instead of the worker's answer.

Root cause: lifecycle entries and user-facing conversation entries shared the
same stream without a strict render filter. The frontend treated internal
session lifecycle as visible assistant output.

Rule: lifecycle events are observability data, not conversation content. They
may be available in inspectors and event logs, but normal direct-control chat
must render only conversation-relevant worker entries.

### Worker output existed in the runtime but not in the UI stream

For `734cc38f4d7f`, the runtime archive contained the worker's answer, while
the unified worker stream initially stopped after the queued `user_input`.
The viewport scrolled as if something had arrived, but there was no visible
assistant message.

Root cause: the force-send queued delivery path called `askAgent()` and marked
the queued row delivered, but did not run the normal response finalization path:

- `getAgent(workerId)`
- `persistWorkerSnapshot(workerId, snapshot)`
- `appendAskResponseFallbackEntry(...)`
- direct-run status resolution from the worker output

Rule: every successful worker turn, including queued delivery and recovery
paths, must finalize through the same persistence contract. A response that
only exists in the bridge/runtime archive is not delivered to the app.

### Direct runs stayed `running` after completed answers

Direct-control follow-ups could finish normally while the run stayed in
`running`, leaving the UI on "Thinking..." even though the worker was idle.

Root cause: some paths only called the old helper that promoted a run to
`awaiting_user` when the answer asked a question. If the answer was normal
completion, the helper intentionally did nothing. That left the run in the
previous active state.

Rule: direct worker completion is a two-way decision: `awaiting_user` when the
answer requests user input, otherwise `done`. It is never "leave the previous
state alone" after a successful response.

### Fast follow-up became a queued steer

In `734cc38f4d7f`, a second message sent quickly after the first became a
queued steer instead of an immediate bridge interruption.

Root cause: the server saw the worker as active and serialized the follow-up
through `queuedConversationMessages` to avoid colliding with an in-flight
bridge turn.

Rule: this is allowed behavior, but the UX copy must make the state honest.
"Queued" means "accepted for later delivery", not "lost". "Send now" means
"attempt delivery now"; if accepted into the chat, the queued drawer should no
longer show it as a pending item.

### Force-send left a delivered item in the queued drawer

Force-sent queued messages could appear in the chat but remain visible in the
queued list.

Root cause: the PATCH response returns while the background bridge turn is
still `delivering`. The frontend kept the optimistic queued record in
`BusyMessageQueueManager`, waiting for later reconciliation. If the later
state update was missed or stale, the drawer kept showing an item that had
already moved into chat.

Rule: when send-now returns a user `message`, the item has left the queue from
the user's perspective. Hide it from the queued drawer immediately unless the
server explicitly returns it to `pending`.

### New-session send returned to the new-session screen

Creating a new direct session and sending the first message could clear the
composer and show the new-session screen again. The created session appeared in
the sidebar later, requiring a manual switch.

Root cause: the frontend waited for the server-created run id before selecting
the session and updating the URL. Between click and response, the selected run
was still `null`.

Rule: session creation needs a client-reserved run id. Select it and update the
URL before the network round trip, then reconcile with the server response.

### Duplicate first message and missing messages until reload

Some direct-control sessions showed the first user message twice or showed no
messages until a hard reload.

Root cause: fallback `messages` table rendering raced against the unified
worker stream. When stream entries arrived late or with different ids, the UI
could render both the fallback row and the durable stream entry, or wait too
long before rendering either.

Rule: for unified worker streams, user-message fallback is allowed while
entries are loading, but it must dedupe against stream entries by stable id and
nearby equivalent text/timestamp. The stream is the final authority.

### "Thinking..." did not appear while the worker was actually busy

The user sent a follow-up and waited a long time with no "Thinking..." state.
The answer appeared later.

Root cause: the direct-control pending indicator was tied to a narrower set of
worker busy signals and did not always consider the selected direct run's
`running` state.

Rule: a selected direct run with status `running` is user-visible work. The UI
must show a small pending assistant indicator even if no assistant stream entry
has arrived yet.

### "Thinking..." stayed after final output

Some completed direct-control sessions rendered the final worker output and
still showed a trailing "Thinking..." indicator.

Root cause: stale worker `current_text` can survive in a persisted worker row or
live bridge snapshot after the direct run has already reached a terminal state.
The pending-assistant classifier treated any current text as active work even
when the selected run was `done`.

Rule: terminal direct runs cannot show pending assistant state. Durable worker
stream entries may still render, but stale `currentText`/`lastText` is not proof
of active work once the run status is terminal.

### Worker stream loaded empty before output existed

A direct-control terminal could load while the worker stream still had no
entries, mark that stream as `loaded` at seq `0`, then miss the later wake-up.
When the user revisited the same session, `ensureLoaded()` saw
`latestContiguousSeq === latestKnownSeq === 0` and refused to refetch. Output
appeared only after a later snapshot poll, reload, or session switch.

Root cause: "loaded empty" was treated as permanent authority. It only proves
the stream was empty at the time of that particular fetch.

Rule: an empty loaded stream with no positive seq is not durable proof of
completeness. When a selected worker subscribes again, revalidate from its
current cursor so missed wake-ups cannot hide durable output.

### Manual `stop` text became a user message

Typing exactly `stop` or `/stop` while a conversation was actively stoppable
could be persisted as an ordinary user message.

Root cause: the composer had a separate stop button while text existed, but the
submit path still interpreted exact stop text as a queue/steer message.

Rule: while a conversation is actively stoppable, exact manual stop commands are
control-plane actions. They must call the stop route and clear the draft, not
enter the transcript. Non-exact text such as "please stop after this" remains an
ordinary user message.

## Debugging checklist for a session id

When a user gives a session/conversation id and asks what is going on, inspect
the persistent state before guessing.

Start with sqlite:

```sql
select id, mode, status, last_error, updated_at
from runs
where id = :runId;

select id, type, status, bridge_session_id, current_text, last_text
from workers
where run_id = :runId
order by created_at;

select id, role, kind, content, created_at
from messages
where run_id = :runId
order by created_at;

select id, action, status, target_worker_id, last_error, created_at, updated_at, delivered_at, content
from queued_conversation_messages
where run_id = :runId
order by created_at;

select event_type, worker_id, created_at, details
from execution_events
where run_id = :runId
order by created_at;
```

Then compare the durable worker stream with the bridge/runtime archive. The
configured run-data root is usually `app-data/run-data/`, but local dev setups
may use `run-data/`; find the file rather than assuming the path:

```bash
find . -path "*<runId>/<workerId>.jsonl" -print
tail -n 80 <run-data-root>/<runId>/<workerId>.jsonl
tail -n 80 .omniharness/agent-runtime-output/<workerId>.jsonl
```

Interpretation:

- If runtime has output that `run-data` lacks, the persistence/finalization path
  is broken.
- If `queued_conversation_messages.status = delivered` but the drawer shows it,
  the frontend queue manager is stale.
- If the worker is `idle` and the run is still `running`, direct-run status
  resolution is broken.
- If `messages` has a user row that the worker stream lacks, the next direct
  message must be refused until the stream catches up.
- If `messages` has exact `stop` / `/stop` rows for an active conversation,
  inspect the composer control path; those should have been stop actions.
- If the stream manager says `loaded` at seq `0`, treat that as an old empty
  observation, not final proof that the worker has no output.
- If the event log lacks a decision, the server did not make or did not publish
  that decision. Do not debug this as a frontend rendering problem first.

## Server-side contracts

### One finalization path for worker turns

Every successful worker turn must persist through the same sequence:

1. Append the accepted `user_input` or `supervisor_input` to the worker stream.
2. Call `askAgent()`.
3. Fetch the post-turn snapshot with `getAgent()`.
4. Persist bridge entries with `persistWorkerSnapshot()`.
5. Append an assistant fallback with `appendAskResponseFallbackEntry()` when the
   snapshot has no visible assistant entry but `askAgent()` returned text.
6. Update the worker row from the snapshot state when available.
7. For direct runs, call `updateDirectRunStatusFromWorkerOutput()`.
8. Mark the queue/message/run transition delivered or completed.
9. Notify SSE subscribers.

This applies to initial prompts, direct follow-ups, queued send-now, queued
drain, recovery resume, and provider-backed sessions. A new path that skips one
of these steps is probably reintroducing this bug class.

### Queued delivery acceptance semantics

`queuedConversationMessages` is UI state for pending work. The worker stream is
the transcript of delivered work.

- `pending`: do not append to the worker stream.
- `delivering`: may show temporary progress, but the item is no longer an
  ordinary queued item once a user message has been accepted into chat.
- `delivered`: must have a corresponding stream input entry, and for worker
  turns must have a persisted worker response or a known failure.
- `failed`: must surface a stable error and remain inspectable.

Never insert a durable user message row for a worker-backed turn unless the
matching worker-stream `user_input` is present or is appended in the same
accepted path.

### Direct status resolution

Do not special-case direct runs as "running until somebody asks a question".
Resolve every completed direct turn:

- `awaiting_user` if the worker output asks for input, confirmation, approval,
  or a choice.
- `done` otherwise.
- `running` only while a turn is actually in flight.
- `failed` only when a user-relevant failure occurred and was surfaced.

## Frontend contracts

### Selected session must change optimistically on creation

When creating a session from the new-session screen:

1. Reserve a run id on the client.
2. Select that run id immediately.
3. Replace the browser path immediately.
4. Send the reserved id to the server.
5. Reconcile with the server response.
6. On failure, restore the prior selection, path, and composer text.

The user should never see their message disappear back to a new-session screen.

### Worker stream beats fallback rows

The terminal may render fallback user messages while worker entries are still
loading, but once entries arrive:

- dedupe by id first;
- dedupe by normalized text plus close timestamp second;
- preserve chronological order;
- never render lifecycle entries as assistant content;
- keep the pending assistant indicator visible while there is current direct
  worker activity (`starting`, `working`, `stuck`, `recovering`, live
  `currentText`, or a pending send). A stale `running` run row alone may keep
  stop/recovery controls available, but it must not fabricate a trailing
  "Thinking..." bubble.
- do not use terminal `isLoading` as a proxy for assistant activity. Loading the
  worker stream may show fallback user messages or an empty loading state, but
  it must not invent a pending assistant row.
- let authoritative server snapshots retire optimistic direct run statuses even
  if the local optimistic row has a newer timestamp.

### Queued drawer represents queued work, not accepted work

After send-now:

- If the server returns `pending`, keep the item in the drawer.
- If the server returns a user `message` and `delivering`, hide it from the
  drawer because it has moved into the conversation.
- If the server returns `delivered`, hide it.
- If the server returns `failed`, keep it visible with an actionable error.

## Regression tests required for this bug class

Any change touching direct-control delivery, queued messages, worker stream
persistence, or direct run status must include focused tests for at least the
affected rows below.

| Scenario | Required assertion |
| --- | --- |
| Direct follow-up completes normally | run becomes `done`, worker is idle, assistant output is in worker stream |
| Direct follow-up asks a question | run becomes `awaiting_user`, visible question exists |
| Fast direct follow-up while worker active | message is queued or serialized explicitly, with visible pending state |
| Send-now queued direct message | user input is appended before assistant output, queue row becomes delivered, run becomes `done` or `awaiting_user` |
| Send-now accepted into chat | queued drawer hides the item immediately |
| Send-now cancelled mid-flight | late bridge response does not resurrect the row |
| Runtime archive has response but snapshot has no message entry | fallback assistant entry is appended |
| New session first send | selected run and URL switch immediately to the reserved id |
| Unified stream loads after fallback | no duplicate first user message |
| Direct run `running` with no assistant entry yet | terminal shows pending assistant indicator |
| Direct run shows pending assistant indicator | stop control is visible and resolves to the active direct worker |
| Active direct stream misses SSE/snapshot wake-up | selected stream revalidates from its current seq cursor without switching sessions |
| Server snapshot says direct run is `done` | newer optimistic `running` state is retired without requiring reload |
| Worker stream is loading with fallback user messages | no synthetic "Thinking..." assistant row is rendered |
| Loaded-empty worker stream later gets output | subscription revalidates seq `0` instead of treating empty loaded as complete |
| Terminal direct run has stale current text | no trailing "Thinking..." indicator is rendered |
| User types exact `stop` during active work | stop mutation fires and no user message row is persisted |
| User types exact `stop` after work already ended | server returns control-plane no-op and no user message row is persisted |
| Worker wake-up lands while snapshot marker is allocated | SSE drains lower-id worker events before exposing the marker id |
| Lifecycle entries present | normal terminal does not render lifecycle noise |

Use `pnpm test:lifecycle` for lifecycle/chaos regressions. Use focused Vitest
suites for API and frontend state regressions. Do not rely on manual reloads as
evidence that a bug is fixed; reload often hides the exact stale-state problem
we need to catch.

## Review questions

Ask these before approving related changes:

1. Does this path append worker content only through the unified stream writer?
2. Does it persist the bridge snapshot or fallback response after `askAgent()`?
3. Does a successful direct turn resolve the run to `done` or `awaiting_user`?
4. Can a queued item remain visible after it has been accepted into chat?
5. Can lifecycle or internal status text render as assistant conversation text?
6. If the app reloads, does it show the same transcript as before reload?
7. If SSE reconnects, can the client recover without losing the decision event?
8. If the UI says a direct conversation is working, is there a visible stop
   control wired to a concrete worker id?
9. Is there a regression test that fails for the bug we just saw?

If the answer to any question is "not sure", stop and instrument before
shipping.
