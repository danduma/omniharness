# persistRunFailure Must Publish error.surfaced

**Date:** 2026-05-20
**Context:** OmniHarness server-side run lifecycle (conversations, supervisor observer, recovery, supervisor wake, supervisor give-up).
**Symptom:** Many user-visible failure paths transitioned a run to `failed` (worker idle with no output, observer poll failure, fatal bridge stderr, snapshot validation failure, environment mismatch, supervisor give-up, wake failure, recovery dead-end, etc.) without firing `error.surfaced`. The DB row went red but toasts, banners, and the test harness's named-event assertions stayed silent.
**Root Cause:** `persistRunFailure(runId, error)` only wrote DB rows. Each call site was independently responsible for emitting `error.surfaced` and most did not. The contract was implicit and easy to drift away from, so adding a new failure branch did not statically force the engineer to add a surface.
**Fix:** `persistRunFailure` now accepts an optional `surface: { code, surface?, workerId? }`. When supplied, it emits `error.surfaced` inline, but only when the run actually transitions from a non-failed state to `failed` — repeated calls and late calls against already-terminal runs stay silent. Every persistRunFailure call site that runs in a user-visible failure path passes a surface spec with a stable `SurfacedErrorCode`. The lone exception is `persistInitialWorkerSpawnFailure`, which already publishes its own canonical `worker.spawn.failed` and therefore declines the helper's emit.
**Verification:** `pnpm vitest run tests/server/runs/failures.test.ts tests/server/runs/ tests/api/conversations-route.test.ts tests/lifecycle/scenarios/worker-spawn-failure.test.ts tests/server/conversations-sync.test.ts tests/server/events/named-events.test.ts tests/supervisor/index.test.ts tests/supervisor/wake.test.ts` — 132 tests pass; lint clean.
**Prevention:**
- Any helper that writes a *terminal* state row should also fire the named event for that transition, with the call site supplying the stable code. State change without an event is invisible to every observer that is not currently rendering the affected row.
- A surface helper must guard against duplicate emit: read the previous state in the same transaction that performs the transition and emit only on the actual transition edge. Otherwise safety-net catches double-toast.
- Closed `SurfacedErrorCode` unions are the right tool: adding a new failure branch forces an explicit code, which is testable and greppable.

**Skill/Doc Updates:** Added section 29 to `docs/architecture/timing-determinism-audit.md`; extended `SurfacedErrorCode` in `src/server/events/named-events.ts`.
