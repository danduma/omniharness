# Waiting On The User Is Not Being Stuck

**Date:** 2026-07-27
**Context:** OmniHarness direct conversations, worker elicitations (`AskUserQuestion`), stuck-worker watchdog.
**Symptom:** Run `594224099b56`: the worker asked a multiple-choice question, the user picked an option ~5 minutes later, and Send failed with `Respond elicitation failed: no_pending_elicitations`. The dead question card stayed on screen next to the error, and the worker had meanwhile answered its own question without the user's input.

**Root Cause:** `reapStuckDirectWorkers` treats "status `working` + no new stream entries for 5 minutes" as a hung ACP roundtrip. A worker blocked on an elicitation looks exactly like that — `createElicitation` sets `record.state = "working"` and the stream goes quiet the instant the question is raised. At `idleSeconds: 305` the reaper cancelled the agent (which cancels every pending elicitation), respawned the session, and re-delivered the last user message. Three more layers then hid what happened:

- `requestBridge` dropped the bridge's HTTP status when rethrowing, so the runtime's 409 reached the browser as an opaque 500 — and got retried three times on the way.
- `respondElicitation`'s `onError` restored the optimistic removal, putting the dead question back on screen where every retry failed identically.
- Every UI surface derives "is this question open?" from the durable worker stream (`/api/events` strips `agent.outputEntries`), so an in-memory request that vanishes without a terminal row is advertised forever.

**Fix:** The reaper now treats the bridge as authoritative when reachable and the durable stream as the fallback: a worker with an open elicitation/permission is skipped, reusing the existing `directWorkerOutputHasPendingHumanInput` predicate. `requestBridge` preserves `status` on the rethrown error and treats `no_pending_*` as non-retryable; the elicitation/permission routes return 409 instead of 500. On a 409 the route writes the terminal row the runtime never got to write (`closeStaleHumanInputEntries`), so every derived surface converges on "closed". The client keeps the optimistic removal on a 409 and says the question is no longer open instead of re-offering it.

Two further holes surfaced while hardening the above:

- *The exemption needed an escape hatch.* A stale `pending` row with no live request would have exempted a genuinely hung worker from the watchdog forever. When the bridge is reachable and reports nothing pending, that row is now recognised as an orphan, closed, and reaping continues — so the exemption can never become permanent. (Bridge-orphaned workers stay the `persisted-zombie-reconciler`'s job; it already excludes `awaiting_user` runs, so the two agree.)
- *Request ids restarted at 1 on every process launch.* `nextElicitationRequestId`/`nextPermissionRequestId` were module-globals seeded at 1, but a resumed worker keeps appending to the same JSONL. A new request could therefore take a retired id, and since every reader folds by id with "later row wins", two unrelated questions merge into one card and a stale terminal row can close a live request. Both counters now seed from `Date.now()`, so each process starts above every id it could previously have issued. Two tests asserted the literal id `1`; they now assert the round-trip uses whatever id the runtime published.

**Verification:** `./node_modules/.bin/vitest run` (316 files, 2046 passed, 5 pre-existing `it.skip`s in `events-route.test.ts`); `pnpm check:acp` (ACP 1, 42 methods operational); new regressions in `tests/server/workers/stuck-worker-reaper.test.ts` and `tests/api/agent-human-input-conflict.test.ts`; `tsc --noEmit` and `eslint` clean on the changed files.

**Prevention:** Any watchdog that infers liveness from silence must first ask whether the silence is *ours*. Blocking on human input is indistinguishable from hanging by timing alone — the only reliable signal is the pending-interaction state, and the user is allowed to take arbitrarily long. Symmetrically: when a request is torn down out of band, whichever layer discovers it must write the terminal row, because in an append-only stream a `pending` row with no successor is indistinguishable from a live request forever.

**Skill/Doc Updates:** None needed; reinforces the existing control-plane invariant that every state a surface can render must have a path to a terminal row.
