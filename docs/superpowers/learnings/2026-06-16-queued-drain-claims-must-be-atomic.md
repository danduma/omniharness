# Queued Drain Claims Must Be Atomic

**Date:** 2026-06-16
**Context:** OmniHarness direct-control queued messages, live worker sync, event snapshots, and frontend queue rendering
**Symptom:** A force-steered queued message was delivered in SQLite and the worker stream, but the UI could still show the same row in the queued-message drawer while `Working...` flickered in the terminal.
**Root Cause:** Concurrent live sync paths could observe the same pending queued row and race through the drain path. The worker drain changed the row to `delivering` without a compare-and-swap status guard, then flipped run/worker state before serialized delivery. Late active snapshots could also arrive after an authoritative empty queue snapshot and revive a stale active row in the frontend.
**Fix:** Worker queue drains now claim rows with `WHERE id = ? AND status = 'pending'` before mutating run/worker state, and busy deferrals remove speculative message rows. Terminal live snapshots suppress stale active bridge state once the persisted run is terminal. The frontend queue manager now records the `updatedAt` of server-absent active rows and ignores older active snapshots or mutation rows for the same id.
**Verification:** `./node_modules/.bin/vitest run tests/app/busy-message-queue-manager.test.ts tests/server/live-worker-snapshots.test.ts tests/server/conversations-sync.test.ts tests/server/queued-messages.test.ts` passed with 46 tests.
**Prevention:** Treat queue delivery as a claimed state transition, not a read-then-write loop. For server-owned UI lists consumed through streams or caches, pair authoritative removals with monotonic freshness checks so late snapshots cannot resurrect older state.
**Skill/Doc Updates:** No general skill update needed; `instrumenting-control-planes`, `client-server-state-invariants`, and `systematic-debugging` already require named event evidence, ownership tokens, ordering, and stale-response tests.
