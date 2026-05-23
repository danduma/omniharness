# Observer Polls Need Generation Ownership

**Date:** 2026-05-20
**Context:** OmniHarness supervisor observer polling.
**Symptom:** The observer test suite could pass while stopped/restarted in-flight polls later attempted to write execution events for rows that had already been cleaned up, producing FK errors on stderr.
**Root Cause:** `startRunObserver()` tracked an observer generation for cleanup, but `pollRunWorkers()` did not receive or check that generation before persisting snapshots/events after awaited bridge calls.
**Fix:** Observer-managed polls now pass their generation into `pollRunWorkers()`. The poll re-checks ownership after awaited boundaries and returns before writing if the observer was stopped or restarted.
**Verification:** Strengthened the restart-while-in-flight observer regression and ran `pnpm vitest run tests/supervisor/observer.test.ts`; the suite passes without the previous background FK stderr.
**Prevention:** Timer-owned background work must carry an owner generation into the async body, not just use the generation for interval cleanup.
**Skill/Doc Updates:** Updated `docs/architecture/timing-determinism-audit.md`; no general skill update needed because timer/poll stale-fire ownership is already part of `client-server-state-invariants`.
