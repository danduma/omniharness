# Lifecycle Observability & Resilience Testing

> What we keep getting wrong, why our tests don't catch it, and the discipline that fixes it.

## Why this document exists

Over a single afternoon we hit three production-class bugs that the existing test
suite did not catch and could not have caught:

1. **Session fails to reconnect after a server restart and gives up after the
   first attempt.** No user-visible message, no telemetry event, no recovery
   incident — just a silently dead session.
2. **`DELETE /conversations/:id` fails with a foreign-key constraint** because
   related rows in dependent tables were not cleared first. The error surfaces
   as an opaque 500.
3. **Running plan-improvement agents fails because leftover state blocks the
   new run.** The block is silent; the user sees nothing happen and assumes the
   button is broken.

These are not unrelated bugs. They share a single root cause:

> **The server makes state transitions that nobody observes.** Neither the user,
> nor the UI, nor any test client can tell what the server decided. So bugs in
> the *decision* (gave up too early, took the wrong branch, refused silently)
> are invisible.

This document records what we learned and the rules we now follow so that this
class of bug stops shipping.

---

## What we found in the audit

A targeted audit of `src/app/api/events/route.ts` plus the planning, recovery,
and bridge-client subsystems revealed the structural gaps.

### 1. The SSE stream is a snapshot stream, not an event stream

`/api/events` emits exactly one named event: `update`, whose payload is the
*entire* current state of the world for the selected run (messages, plans,
runs, workers, planItems, clarifications, executionEvents, supervisor
interventions, queued messages, recovery incidents, review runs/rounds/findings).

There are no other named events. An observer cannot ask "did a worker spawn?"
or "was a recovery attempted?" — only "is the state now different?" To answer
the first kind of question the client must **diff snapshots**, which is:

- **Ambiguous** — many transitions produce identical visible state (a worker
  that was reattached and a worker that was recreated both end up as
  `status="running"`).
- **Lossy** — fast transitions can be coalesced inside a single snapshot
  interval and disappear entirely. (e.g. `starting → running → completed`
  inside one 15s window.)
- **Forced to re-derive server decisions** — the client has to reconstruct
  *why* state changed, which requires duplicating server logic.

### 2. There is no event ID and no resume

The SSE frames have no `id:` field. There is no `Last-Event-ID` handling on the
server. A client that disconnects and reconnects gets a fresh snapshot and has
*no way to know* whether events fired during the gap. For chaos testing (where
we deliberately drop the connection) this is fatal — we cannot assert
"between t0 and t1 the server emitted [X, Y, Z]" because the wire format does
not carry that information.

There is a `?snapshot=1` bootstrap endpoint, which is good. There is no
"give me the events I missed since id N" endpoint, which is the gap.

### 3. Several decisions are invisible to the wire

Concrete state transitions that **the server makes** but **never tells anyone
about**:

| Transition | Where it happens | Wire visibility |
|---|---|---|
| Worker spawned | `bridge-client/index.ts spawnAgent` | None — inferred from a row appearing |
| Worker reattached vs recreated after restart | `restart-control.ts` / recovery path | **None** — both look like `status="running"` |
| Recovery gave up after N attempts | `recoveryIncidents.autoAttemptCount` increments | Partial — count is visible but there is no terminal "abandoned" state |
| Plan readiness reached | `derivePlanningStatus()` — runs **client-side** | **None** — it is a client-side derivation, not a server event |
| Plan-improvement blocked by leftover state | `planning/review.ts` early-return | **None** — silent refusal |
| Conversation delete FK violation | `/api/conversations/[id]` DELETE | None as a typed event — only a 500 response |
| Message ack / persisted / streaming chunk | `conversations/send-message.ts` | Partial — only the resulting queued-message status |

Every row in this table is a bug class waiting to ship. If the server can
silently decide "I gave up", "I refused", "I took branch B not A", and the
test harness has no way to assert which branch it took, the test harness is
structurally incapable of catching the bug.

### 4. The user-facing surface mirrors the test-facing surface

The reason "leftover state blocked the run" did not show a user message is the
**same reason** no test could detect it: there was no event for it. Make the
state transitions observable, and both the UI fix and the test coverage
follow. Conversely, if a transition is observable only by re-deriving from a
snapshot diff, both the UI and tests will be brittle in the same ways.

This is the central insight: **observability for users and observability for
tests are the same problem**.

### 5. Playwright e2e is the wrong layer for resilience

The existing `tests/e2e/*.spec.ts` files boot Chromium. They are slow (tens of
seconds per scenario), flaky against real subprocess restarts, and they
exercise UI rendering rather than control-plane decisions. The bugs we are
hitting are not UI bugs — they are control-plane bugs. We should be hitting
HTTP/SSE directly, in Node, with no browser. The UI is one consumer of the
control plane; the chaos harness is another.

---

## The rules we now follow

These are not suggestions. They are the discipline that makes this class of
bug stop happening.

### Rule 1: every server-side state transition emits a named event

If the server makes a decision — spawn, reattach, recreate, give up, refuse,
delete, fail — that decision is published on the event stream with a
**named event type**, not just a state delta. Examples:

- `worker.spawned`, `worker.status` (with `prev` and `next`), `worker.terminal`
- `worker.reattached`, `worker.recreated`
- `plan.ready`, `plan.review.started`, `plan.review.finished`,
  `plan.review.blocked` (with a `reason`)
- `recovery.opened`, `recovery.attempt`, `recovery.gave_up`, `recovery.resolved`
- `conversation.deleted`, `conversation.delete_failed` (with FK details)
- `error.surfaced` — the catch-all for anything the user should know about

**Rule of thumb:** if a server method has an early-return, a try/catch that
swallows, or a branch that depends on a state check, it emits an event.
"Silent" is a code smell.

### Rule 2: errors that affect the user are events, not just response codes

A 500 with a body is not enough. A 200 that quietly did nothing is worse. Every
user-relevant failure publishes `error.surfaced` with a stable code, a
human-readable message, and the relevant run/worker/conversation ids. The UI's
job is to render `error.surfaced` events into toasts/banners. The test
harness's job is to assert that the expected `error.surfaced` event fired.

A failure that does not produce an `error.surfaced` event is a bug — even if
the underlying behaviour is technically correct — because it is invisible to
the user and to the tests.

### Rule 3: the event stream is SSE-spec compliant

- Every frame has an `id:` field. IDs are monotonic.
- The server keeps a bounded **ring buffer** (≥ 500 entries) of recent events.
- The server honours `Last-Event-ID` on reconnect: it replays everything after
  that id from the buffer, then resumes live streaming.
- If the requested id has fallen out of the buffer, the server emits a
  `stream.resync_required` event so the client knows to re-bootstrap from
  `?snapshot=1` rather than silently miss events.

This is the SSE spec. We were not following it. We are now.

### Rule 4: named events alongside, not instead of, snapshots

The existing `update` snapshot event stays. The UI keeps consuming it. The new
named events are *additional* frames on the same stream. Clients that don't
care about a given event type ignore it. There is no `?test=1` flag, no
separate test endpoint, no parallel surface that can drift.

If a transition is worth emitting for tests, it is worth emitting in
production. Anything else creates a second observability surface that will
diverge from reality.

### Rule 5: chaos testing belongs in the client, not the server

We do **not** add fault-injection code paths to the server. We do not add a
"random failure" mode. The server stays clean. Chaos lives in the test
client as middleware:

- An SSE wrapper that can drop the connection on command.
- A `fetch` wrapper that can fail a configurable percentage of requests.
- A harness that can SIGKILL the spawned server process and restart it.

Faults are seeded for reproducibility. Every failure has a seed; replaying
the seed reproduces the failure.

### Rule 6: tests assert on event sequences, not on rendered state

A scenario test reads like a transcript:

```
expect(events).toHaveEmitted("worker.spawned", { runId });
expect(events).toHaveEmitted("worker.status", { next: "running" });
chaos.killServer();
chaos.restartServer();
expect(events).toHaveEmitted("worker.reattached", { runId });
// not "worker.recreated", not absence — explicitly reattached
```

Asserting on rendered DOM state is the wrong granularity. We assert on the
server's *decisions*, which are now first-class events.

### Rule 7: the test harness runs in isolation

A separate Node process. A temporary `OMNI_HOME`. A fresh sqlite. A dedicated
port. No collision with the real dev server. Tear it all down on exit.
Scenarios can run in parallel because each one owns its own server.

### Rule 8: snapshot bootstrap, event tail thereafter

Every harness client starts by calling `GET /api/events?snapshot=1` for state
truth, then opens the SSE stream with `Last-Event-ID` set to the id at
snapshot time. This is the canonical pattern. The UI should do this too;
right now it doesn't, which is a latent bug.

---

## Anti-patterns to refuse on sight

These are the specific shapes of code that produce the bugs in this document.
Reviewers should reject these on sight.

1. **Silent early returns in server methods.**
   ```ts
   if (hasLeftoverState) return; // ← BUG
   ```
   If a method refuses to proceed, it emits an event explaining why.

2. **try/catch that swallows.**
   ```ts
   try { await doThing(); } catch { /* ignore */ } // ← BUG
   ```
   Either rethrow, or emit `error.surfaced` with the context. Never both
   silent and continuing.

3. **Client-side derivation of server decisions.**
   If the server decided something (plan is ready, recovery gave up), the
   server emits the event. The client does not re-derive it. If the client
   is computing `derivePlanningStatus()` from raw fields, that is a missing
   server event.

4. **SSE frames without `id:`.**
   Every frame has an id. No exceptions.

5. **State diffs as the primary observability mechanism.**
   "The UI will figure out what happened by diffing snapshots" is not an
   observability strategy. Name the event.

6. **Fault injection inside production code paths.**
   `if (process.env.CHAOS) throw new Error("boom")` does not appear in
   server code. Chaos is a client-side concern.

7. **Tests that boot Chromium to assert on control-plane behaviour.**
   Use the HTTP/SSE harness. Reserve Playwright for actual UI behaviour
   (rendering, input handling, layout).

8. **DELETE handlers that don't enumerate dependent rows.**
   If a row has foreign-key dependents, the DELETE handler either deletes
   them in a transaction or emits `conversation.delete_failed` with the
   blocking table/row. Never let the FK error reach the client as a raw 500.

9. **Recovery loops without a terminal state.**
   If `autoAttemptCount` keeps incrementing without an `abandoned` or
   `gave_up` terminal event, there is no way for anyone — user, UI, test —
   to know the system has given up. Always have a terminal state, and
   always emit it.

10. **Test-only code paths.**
    `if (process.env.NODE_ENV === "test")` in production code is a bug. The
    test harness should be able to drive production code paths from the
    outside. The only exception is the dev-only `/api/events/log` polling
    endpoint, which is build-stripped, has no behavioural effect, and exists
    purely as a read-side affordance.

---

## How to add a new server-side decision

The checklist, every time:

1. Pick the event name. Format: `domain.verb` (`worker.spawned`,
   `plan.review.blocked`). Past tense for things that happened, no
   "will/should".
2. Define the payload shape in `src/server/events/named-events.ts` (TypeScript
   union, exported).
3. At the point of decision, call `emitNamedEvent("domain.verb", payload)`.
   The emitter writes to the ring buffer and triggers the SSE notifier.
4. If the decision is a *failure* the user should see, also emit
   `error.surfaced` with a stable code and human message.
5. Write a scenario test that asserts the event fires under the expected
   conditions. If the test cannot assert this, the event is not specific
   enough — go back to step 1.
6. The UI may or may not consume the event. That is a separate choice. The
   event exists regardless.

If you find yourself unable to complete step 5, the design is wrong, not the
test.

---

## How to debug "the user reports X did not happen"

The procedure:

1. Open the event log for the run: `GET /api/events/log?runId=<id>`.
2. Look for the named event corresponding to X.
3. If it is present: the server did the thing. The bug is in the UI or in
   the user's mental model.
4. If it is absent: the server did not do the thing. Find the code path that
   *would* have emitted it, and find the early-return / swallowed error /
   silent branch that prevented it. Fix that, and emit the appropriate event
   (success or failure).
5. If the code path doesn't emit anything in either branch: that is the bug.
   Add the event per "How to add a new server-side decision."

Every reported bug should land at one of these four answers. If the answer is
"I don't know, the server is a black box", we have failed Rule 1.

---

## Open follow-ups

- Backfill named events at every existing decision site (see implementation
  plan).
- Adopt SSE-spec compliance in the UI client (snapshot bootstrap +
  `Last-Event-ID` resume). Today the UI just refetches a snapshot, which
  works but is wasteful.
- Audit every server `try/catch` and every early-`return` for missing
  events. This is a one-time sweep; new code is held to the rules above
  going forward.
- Build out the headless chaos harness and the scenario catalog.

---

## Audit log

### `try/catch` sweep — first pass

Walked every `} catch {` in `src/server/**` and `src/app/api/**`. Findings:

- **Legitimate silent fallbacks** (kept as-is, comment explains why):
  `restart-control.ts` process-liveness probes (`process.kill(pid, 0)`),
  `restart-control.ts:264` lsof-empty no-listener case,
  `conversations/create.ts:257` opportunistic snapshot persist (the
  function's user-visible state still comes from the `askAgent`
  response, not the dropped snapshot),
  `planning/review.ts:313` reviewer snapshot persist (same shape),
  parse-error fallbacks in `plans/readiness-pipeline.ts`,
  `planning/artifacts.ts`, `auth/guards.ts`, `projects/canonicalize.ts`.
  Each catches an internal probe that cannot affect user-visible state.
  These match the rare-exception carve-out for idempotency / probe
  catches.

- **Bugs that were already fixed in phase 2** (no remaining silent
  failure in this category):
  - Plan-review leftover-state silent throw → now emits
    `plan.review.blocked` + `error.surfaced` (`planning/review.ts`).
  - Recovery exhaustion silent cap → now emits `recovery.gave_up` +
    `error.surfaced` (`runs/recovery-incidents.ts`).
  - Delete conversation FK 500 → now returns 409 with
    `conversation.delete_failed` + `error.surfaced` (`api/runs/[id]`).

- **No new offenders found in the first pass.** New code is held to the
  rule via the AGENTS.md entry; reviewer should reject silent catches on
  state-mutating paths.

Future audit passes should look at:
- ~~Early-return sites in `supervisor/observer.ts` (decision branches).~~
  **Done.** All 16 `stopRunObserver` call sites now pass a typed
  `reason` (`run_terminated`, `run_failed`, `cwd_mismatch`,
  `snapshot_invalid`, `quota_exhausted`, `fatal_bridge_error`,
  `explicit`). `supervisor.stopped` is emitted from inside
  `stopRunObserver` itself, guarded by `wasActive` so bare stop calls
  on never-started runs don't spam the stream. Scenario:
  `tests/lifecycle/scenarios/supervisor-stopped.test.ts`.
- ~~Every `if (!latestRun)` short-circuit that stops the observer.~~
  Covered by the above — those now emit `supervisor.stopped` with
  reason `run_terminated`.

### Scenario catalog (`tests/lifecycle/scenarios/`)

| Scenario | Asserts |
|---|---|
| `end-to-end-events` | Snapshot bootstrap + tail + event ordering |
| `sse-resume` | `Last-Event-ID` replays the gap after a mid-stream drop |
| `restart-resync` | `stream.resync_required` fires after a server restart |
| `chaos-reconnect-storm` | Seeded high-drop-rate chaos doesn't lose events |
| `plan-review-blocked` | Leftover-state throws → 409 + named events on the wire |
| `delete-conversation-fk` | FK fail → 409 + named events, not a raw 500 |
| `recovery-exhaustion` | Cap reached → `recovery.gave_up` + `error.surfaced` in order |
| `worker-reattach` | Observer's revive branch emits `worker.reattached` |
| `session-types` | Direct / planning / implementation conversation creation |
| `conversation-continuation` | Mid-conversation SSE drop + reconnect; nothing lost |
| `plan-improvement-flow` | Review start + worker spawn + restart-resync end-to-end |
| `real-restart` | **Real subprocess** kill+respawn: sqlite persists, ring resets, client gets `stream.resync_required` |
| `direct-mode-rerun` | User pressing "re-run" — same content sent twice persists as two rows in order |
| `flaky-network` | Seeded HTTP flake: server stays consistent, deterministic across seed |
| `worker-spawn-failure` | Bridge `spawnAgent` rejection now emits `error.surfaced(worker.spawn.failed)` instead of going silent |
| `supervisor-stopped` | Every observer stop site emits `supervisor.stopped` with a typed reason (`run_terminated`, `run_failed`, `cwd_mismatch`, `snapshot_invalid`, `quota_exhausted`, `fatal_bridge_error`, `explicit`) |

### Real protocol bug found via the harness

While wiring `recovery-exhaustion`, the harness caught a real bug in the
SSE route: when an `update` (snapshot) frame was about to be written,
the route would record the snapshot marker (advancing the cursor) and
set `lastDeliveredId = marker.id` directly. Any named event emitted
*during* the snapshot build — id < marker.id — was then silently dropped
on subsequent drains, because the next drain queried
`getNamedEventsSince(marker.id, ...)`.

Fix: drain once more *before* recording the marker, so the marker's id
is monotonically ahead of all already-emitted named events. This was a
latent bug that would have caused intermittent missed UI updates under
load; the chaos harness paid for itself on its first real run.
