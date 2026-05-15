# Plan: Lifecycle Observability + Chaos Harness

Companion to `docs/architecture/lifecycle-observability-and-testing.md`. That
document is the *what and why*; this document is the *how and in what order*.

The plan is sequenced so each phase is independently shippable and verifiable.
Do not start phase N+1 before phase N is green.

---

## Phase 1 — Event spine (foundation)

**Goal:** make the SSE stream SSE-spec compliant and add a typed named-event
emitter. No server decisions are rewired yet; this is pure infrastructure.

**Deliverables**

1. **`src/server/events/named-events.ts`** — new module.
   - `type NamedEvent` discriminated union covering the event names that
     have an owner in phase 2: `worker.spawned`, `worker.status`,
     `worker.reattached`, `worker.recreated`, `worker.terminal`,
     `plan.ready`, `plan.review.started`, `plan.review.finished`,
     `plan.review.blocked`, `recovery.opened`, `recovery.attempt`,
     `recovery.gave_up`, `recovery.resolved`, `conversation.deleted`,
     `conversation.delete_failed`, `error.surfaced`,
     `stream.resync_required`.
   - **Not included** (until owned): `worker.abandoned`. The architecture
     doc mentions it; it has no emit site and no scenario in phase 2, so it
     does not enter the union until someone owns it. `recovery.gave_up`
     covers the recovery-cap case for now.
   - `emitNamedEvent(event: NamedEvent)` — appends to ring buffer, calls
     `notifyEventStreamSubscribers()`.
   - `getNamedEventsSince(lastEventId: string | null, opts?: { runId?: string })`
     — returns ordered slice from the ring buffer; returns
     `{ resyncRequired: true }` if the id has fallen off.
   - Ring buffer capacity: 500. In-process memory only. Reset on server
     restart is correct — clients resync via `?snapshot=1`.

2. **Extend `src/server/events/live-updates.ts`**
   - Keep `notifyEventStreamSubscribers` and version counter as-is (UI relies
     on them).
   - No new exports here. The ring buffer lives in `named-events.ts`.

3. **Rewire `src/app/api/events/route.ts`**
   - **Single monotonic cursor namespace for every emitted frame.** Both
     named events and `update` snapshots draw their `id:` from one
     in-process counter maintained by `named-events.ts`. Snapshots do
     **not** get a special `snapshot:<version>` id — they get the next
     integer like everything else. This matters because browsers send the
     last received `id` back as `Last-Event-ID` on reconnect; if that id
     is in a different namespace than the ring buffer, every reconnect
     after an `update` would spuriously trigger `stream.resync_required`.
     One namespace = one resume rule.
   - The ring buffer stores **all** emitted frames (named events *and*
     snapshot markers). For snapshot markers we store only `{ id, kind:
     "snapshot", version }` — not the snapshot body, which is large and
     reconstructible from `?snapshot=1`. On resume, a `snapshot` marker
     in the replay range is rendered as "your snapshot is stale, refetch"
     (in practice: the route sends one fresh snapshot, then the named
     events after it).
   - On connect: read `Last-Event-ID` header. If present and resolvable
     from the ring buffer, replay missed events first, then enter the
     normal poll loop. If unresolvable (id older than the oldest buffered
     entry), send `stream.resync_required` and proceed with a fresh
     snapshot.
   - On every poll-loop iteration: drain any new named events from the
     ring buffer since the last replay cursor and emit them as individual
     frames before/after the `update` snapshot. Order: named events that
     have happened since last loop, then the snapshot marker (whose id is
     drawn from the same counter), so a client sees the transitions and
     then the resulting state.

4. **New endpoint `src/app/api/events/log/route.ts`** — dev-only.
   - `GET /api/events/log?since=<id>&runId=<id>` returns JSON
     `{ events: NamedEvent[], lastEventId: string, resyncRequired?: true }`.
   - Gated behind `process.env.NODE_ENV !== "production"`. In production
     builds the route file is still present but returns 404 immediately —
     no behavioural code paths from production reach this endpoint.

5. **Tests for phase 1**
   - `tests/server/events/named-events.test.ts` — ring buffer FIFO,
     resync-required signalling, runId filter.
   - `tests/server/events/sse-resume.test.ts` — boots a route handler in
     isolation, opens stream, asserts `id:` field present, asserts
     `Last-Event-ID` replay works, asserts resync-required path.
   - `tests/server/events/log-endpoint.test.ts` — basic shape; 404 in
     production-mode env.

**Exit criteria for phase 1**
- All phase 1 tests green.
- Manual smoke: open the dev UI, kill the network briefly, reconnect, watch
  the SSE frames in devtools — every frame has an `id:`, no spurious resync
  on short reconnects.
- No behavioural changes for the UI (it still consumes `update` snapshots and
  ignores unknown event types — verify in `LiveEventConnectionManager.ts` that
  unknown events are tolerated; add a fallthrough if not).

---

## Phase 2 — Wire the decision points

**Goal:** every server-side decision listed in the architecture doc emits its
named event. Each emit site lands with a unit test that asserts the emit
fires under the relevant conditions. No new behaviour, only newly visible
behaviour — except where a previously silent failure now also produces
`error.surfaced`, which **is** a user-visible behaviour change and is the
point of the exercise.

**Emit sites (file → event)**

| File | Decision | Event(s) |
|---|---|---|
| Orchestration call sites that create workers (see "Worker spawn note") | Worker row created and process requested | `worker.spawned` |
| `src/server/supervisor/observer.ts` (status update site) | Worker status transition | `worker.status` with `prev`/`next` |
| `src/server/supervisor/observer.ts` (terminal status) | Worker reached terminal | `worker.terminal` |
| `src/server/restart-control.ts` / recovery path | Worker rebound to existing bridge session | `worker.reattached` |
| `src/server/restart-control.ts` / recovery path | Worker freshly respawned after restart | `worker.recreated` |
| `src/server/runs/recovery-incidents.ts` | Incident opened | `recovery.opened` |
| `src/server/runs/recovery-incidents.ts` (attempt loop) | Each retry | `recovery.attempt` with count |
| `src/server/runs/recovery-incidents.ts` (cap reached) | Gave up | `recovery.gave_up` + `error.surfaced` |
| `src/server/runs/recovery-incidents.ts` | Resolved | `recovery.resolved` |
| `src/server/planning/refresh.ts` `refreshPlanningArtifactsForRun` | Persisted run status transitions into `ready` | `plan.ready` |
| `src/server/planning/review.ts` | Review run kicked off | `plan.review.started` |
| `src/server/planning/review.ts` | Review run finished | `plan.review.finished` |
| `src/server/planning/review.ts` (early return on leftover state) | Refused | `plan.review.blocked` + `error.surfaced` |
| `src/app/api/runs/[id]/route.ts` DELETE handler | Conversation/run deleted | `conversation.deleted` |
| `src/app/api/runs/[id]/route.ts` DELETE (FK error path) | Refused | `conversation.delete_failed` + `error.surfaced` |
| Explicit emit-at-the-site (see "error.surfaced note") | Any user-visible error | `error.surfaced` |

**Worker spawn note.** Do **not** emit `worker.spawned` from
`bridge-client/index.ts` `spawnAgent`. That function only knows bridge-level
params (`name`, `type`, `cwd`) and has no run/plan context — emitting there
either produces under-contextualized events or forces bridge code to do DB
lookups it has no business doing. Emit from the orchestration call sites
that already know the run/worker context (the places that insert/update the
`workers` row before calling `spawnAgent`). Audit those call sites in phase
2 and pick a single canonical site per worker lifecycle.

**Plan-readiness note.** Readiness is already computed server-side via
`derivePlanningStatus` inside `refreshPlanningArtifactsForRun`
(`src/server/planning/refresh.ts`). The emit hook is "when the persisted
run/plan status transitions into `ready`" — read the previous value before
the write, compare to the new value, emit `plan.ready` on the edge. No
re-derivation needed; just a transition check at the existing write site.

**Leftover-state-blocks-review note.** The current bug is the silent
early-return. The fix is: emit `plan.review.blocked` with `reason:
"leftover_state"` and the offending worker/run id, AND emit `error.surfaced`
with a stable code (`plan.review.leftover_state`) and a user-visible
message. Both fall out of the same code change.

**FK-on-delete note.** The current bug is a raw 500 from the DELETE handler
in `src/app/api/runs/[id]/route.ts` (there is no `/api/conversations/[id]`
DELETE route — "conversation" and "run" share the runs table). The fix at
the route: catch the SqliteError, inspect the FK constraint, emit
`conversation.delete_failed` with the blocking table, emit `error.surfaced`,
return a 409 with a typed body. The deeper fix — actually cascading the
delete — is a separate change; this phase only makes the failure observable.

**`error.surfaced` contract note.** Do not emit `error.surfaced` from a
blanket wrapper in `src/server/api-errors.ts` — that produces noisy,
context-poor events for auth/config/generic failures that are not actually
user-relevant in the lifecycle sense. Instead require an **explicit emit at
each user-facing failure site** with a strict payload:

```ts
emitNamedEvent({
  kind: "error.surfaced",
  code: "plan.review.leftover_state",   // stable, dotted, finite set
  message: "...",                        // human-readable
  surface: "toast" | "banner" | "log",   // how the UI should render it
  runId?: string,
  workerId?: string,
  conversationId?: string,
  cause?: { name: string; message: string } | null,
});
```

Events without at least one of `runId`/`workerId`/`conversationId` are
log-only and should be rare. The `code` field is the contract surface for
tests — phase 2 introduces a typed union of allowed codes in
`named-events.ts` so adding a new code is a deliberate, reviewed change.

**Tests for phase 2**

For every emit site: a focused server-side test using the existing
`tests/server/**` style. Each test sets up the precondition, triggers the
operation, and asserts the named event was emitted with the expected payload
shape. Use a test helper `expectEmitted(eventName, predicate?)` that reads
the ring buffer.

**Exit criteria for phase 2**
- Every row in the table above has its emit site and its test.
- Manual scenario: trigger the three known bugs in the dev UI; each now
  produces a visible user-facing error AND an inspectable event in
  `/api/events/log`.

---

## Phase 3 — Headless chaos harness

**Goal:** a Node-only harness that drives the control plane via HTTP/SSE,
runs lifecycle scenarios, and can inject disconnects/restarts at every step.

**Layout**

```
tests/lifecycle/
  harness/
    server.ts          — spawn/kill/restart the app subprocess
    client.ts          — fetch + EventSource wrappers with chaos hooks
    chaos.ts           — ChaosPolicy: seeded RNG, decides when to fire
    assertions.ts      — expectEmitted, expectSequence, waitFor
    fixtures.ts        — fresh OMNI_HOME, fresh sqlite, free port
  scenarios/
    session-a-basic.test.ts
    session-b-basic.test.ts
    session-c-basic.test.ts
    restart-mid-message.test.ts
    restart-mid-plan-review.test.ts
    delete-conversation-while-worker-running.test.ts
    plan-improvement-leftover-state.test.ts
    reconnect-storm.test.ts          — chaos mode, many seeds
```

**Server lifecycle (concrete)**

- Mode: `pnpm start` (Next prod mode), not `pnpm dev`. Dev mode is too
  noisy and rebuilds on file changes, which is the wrong loop here.
- Build strategy: the harness expects a build to exist (`.next/`). If
  absent it runs `pnpm build` once at suite startup and caches it. CI
  always runs `pnpm build` first as a separate job step; locally the
  harness skips the build if `.next/BUILD_ID` is fresher than
  `package.json` and `next.config.*`. Override with
  `OMNI_HARNESS_FORCE_BUILD=1`.
- Per-scenario isolation: temp `OMNI_HOME=$tmpdir`, fresh sqlite under
  that home, free port via `net.createServer().listen(0)` then immediate
  close, set `PORT=$port`. The dev server on 3035/3050 is untouched.
- Auth: enable the existing bypass with
  `OMNIHARNESS_TEST_BYPASS_AUTH=true` and
  `OMNIHARNESS_E2E_BYPASS_AUTH=true` (see
  `src/server/auth/config.ts` for the gate). No login flow in scenarios.
  If the bypass turns out to be insufficient (e.g. cookies still
  required by some routes), the harness owns a single `loginAsTestUser`
  helper rather than inlining auth into every scenario.

**Harness primitives**

- `await harness.start()` — spawn `pnpm start` against a temp dir with the
  env above, wait until `GET /api/events?snapshot=1` returns 200.
- `await harness.restart({ mode: "sigterm" | "sigkill" })` — kill, wait
  for port to free, respawn, wait for ready.
- `const client = harness.client()` — returns an authenticated API client
  plus a live event tail.
- `client.events.waitFor(name, predicate?, { timeoutMs })` — resolves when
  the named event arrives.
- `client.events.assertSequence([...names])` — asserts ordered subset.
- `chaos.dropSSE()` — closes the EventSource; client must re-resume with
  `Last-Event-ID`.
- `chaos.flakeFetch({ rate })` — wraps subsequent fetches.
- `chaos.killServer()` / `chaos.restartServer()` — passthrough to harness.

**Run modes**

- `pnpm test:lifecycle` — runs all scenarios with **clean** chaos policy
  (no fault injection). Gates merges. Should be fast enough for CI
  (under ~2 minutes total; each scenario is sub-10s outside of induced
  restarts).
- `pnpm test:lifecycle:chaos` — runs the same scenarios with a seeded
  chaos policy. N seeds × M scenarios. Failures log the seed so they
  replay deterministically. Not blocking for merge initially; promotes to
  blocking once stable.

**Scenarios for v1**

Each is one file, one journey, ending with cleanup:

1. **Session type A, basic.** Login → create session → send message →
   assert `worker.spawned`, `worker.status: running`, `worker.terminal` →
   continue conversation → final state matches.
2. **Session type B, basic.** As (1) for the second session type.
3. **Session type C, basic.** As (1) for the third session type.
4. **Restart mid-message.** Send message → kill server → restart → assert
   either `worker.reattached` or `worker.recreated` (test asserts the
   *correct* one for the session type) → continue → no duplicate work.
5. **Restart mid-plan-review.** Trigger plan review → restart during
   agent run → assert recovery path emits `recovery.opened` then
   `recovery.resolved` → review completes.
6. **Delete conversation while worker running.** Spawn worker → DELETE
   conversation → assert either clean `conversation.deleted` with worker
   cancellation events, or `conversation.delete_failed` +
   `error.surfaced` (test asserts the *intended* behaviour, which is the
   first; failing test is the bug report).
7. **Plan-improvement leftover state.** Set up a run with stuck state →
   request plan improvement → assert `plan.review.blocked` +
   `error.surfaced` with code `plan.review.leftover_state`.
8. **Reconnect storm (chaos).** Normal happy-path session, but the SSE
   stream is dropped at random intervals throughout. Assert the final
   state matches the clean run.

**Exit criteria for phase 3**
- All 8 scenarios pass in clean mode.
- Reconnect-storm passes for 20 consecutive seeds.
- `pnpm test:lifecycle` is wired into the regular test command set and
  documented in `AGENTS.md`.

---

## Phase 4 — Sweep

**Goal:** remove the latent bugs the architecture doc warned about, now
that we have the visibility to detect them.

1. Audit every `try/catch` in `src/server/**`. Each one either rethrows or
   emits `error.surfaced`. Bare `catch { }` is banned.
2. Audit every early `return` in server methods that mutate state. Each
   one emits an explanatory event or has a comment justifying its silence
   (rare, e.g. idempotency early-returns).
3. UI: adopt snapshot-bootstrap + `Last-Event-ID` resume in
   `LiveEventConnectionManager.ts` instead of refetching a snapshot every
   reconnect. This is a perf win, not a correctness fix.
4. Document the dev workflow for inspecting events:
   `GET /api/events/log?runId=<id>` plus the named-event catalog.

This phase has no fixed exit criteria — it is ongoing discipline. The doc
in `docs/architecture/lifecycle-observability-and-testing.md` is the spec
new code is held to.

---

## Sequencing summary

```
Phase 1 (event spine)       — infra, no behaviour change
   ↓
Phase 2 (decision wiring)   — adds visibility, fixes the silent-bug class
   ↓
Phase 3 (chaos harness)     — proves we can detect regressions
   ↓
Phase 4 (sweep + UI)        — pays down the rest of the debt
```

Phases 1–2 are the high-leverage moves: they remove the structural reason
the bugs we just hit were invisible. Phase 3 is what stops the next round of
bugs from shipping. Phase 4 is hygiene.

---

## Out of scope

- Replacing Playwright. The two existing e2e specs continue to exist; they
  cover UI behaviour, which is the right job for them. The lifecycle
  harness is **additional**, not a replacement.
- Adding server-side fault injection. Chaos is a client concern; see
  architecture doc Rule 5.
- Changing the storage layer or the SSE transport. The fix is in the
  protocol on top of SSE, not the transport.
- Distributed tracing. Useful, but separate.

---

## Risks and how we mitigate them

- **Risk: scope creep on emit sites.** Mitigation: the phase-2 table is the
  contract. Adding new events later is fine; expanding phase 2 mid-flight
  is not. New decisions land in phase 4 or later.
- **Risk: ring buffer too small under load.** Mitigation: 500 is a starting
  number. Add a per-event-type counter and a "buffer overrun" log line; if
  we see overruns in practice, increase it. Clients that fall off the
  buffer get `stream.resync_required` and re-bootstrap — correct, just
  slightly more expensive.
- **Risk: chaos harness flakiness masks real bugs.** Mitigation: every
  failure has a seed; seeded reruns are deterministic; flakes either
  reproduce (real bug) or don't (harness bug to fix). Do not promote
  chaos mode to merge-blocking until the seed-replay discipline is real.
- **Risk: the UI fails to ignore unknown event types.** Mitigation: verify
  the SSE consumer in phase 1; add a fallthrough if needed. This is a
  one-line change at most.
