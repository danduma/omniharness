# Initial Worker Spawn Failures Need Terminal State

**Date:** 2026-05-20
**Context:** OmniHarness direct/planning conversation creation
**Symptom:** A newly created conversation could stay at `Thinking...` or `starting` after a background worker spawn failed. Planning startup failures emitted a surfaced error but left persisted state non-terminal; direct startup failures persisted DB failure state but did not emit the named user-visible failure.
**Root Cause:** Conversation creation is intentionally optimistic, but the fire-and-forget spawn branch did not have one shared reconciliation path. Different modes updated different surfaces, so no single queryable truth proved that startup had failed.
**Fix:** Added a shared initial-spawn failure handler that marks worker/run terminal, marks planning plans failed, appends a worker-stream lifecycle failure entry, emits `worker.status`, and emits `error.surfaced` with `worker.spawn.failed`.
**Verification:** `pnpm vitest run tests/api/conversations-route.test.ts tests/lifecycle/scenarios/worker-spawn-failure.test.ts`
**Prevention:** Any optimistic server-created object whose background startup can fail must have an explicit terminal reconciliation branch across DB state, append-only streams, and named events. A toast without terminal state, or terminal state without a named event, is still nondeterministic.
**Skill/Doc Updates:** Updated `docs/architecture/timing-determinism-audit.md` because this is another instance of the repository-wide timing determinism pattern.
