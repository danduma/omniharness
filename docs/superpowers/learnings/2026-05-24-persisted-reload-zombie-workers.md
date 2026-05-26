# Persisted Reload Zombie Workers

**Date:** 2026-05-24
**Context:** OmniHarness event snapshots, direct-run recovery, crash/reload lifecycle
**Symptom:** After a system crash, a conversation could reload as `running` with a worker stuck in `starting`, even though the bridge runtime no longer had that worker. The UI looked alive, but the session was unrecoverable without manual inspection.
**Root Cause:** The runtime-enriched snapshot could detect a missing live bridge worker, but the persisted reload bootstrap intentionally avoids bridge polling. That left old `running` + stale `starting` rows visible during reload. Recovery incidents could exist later, but the first persisted snapshot did not perform an unambiguous stale-starting check.
**Fix:** Added a persisted-bootstrap reconciliation pass for selected runs. If a non-terminal selected run has a worker stuck in `starting` beyond the grace window with no saved bridge session, the bootstrap marks the run `needs_recovery`, opens/updates a `worker_lost` incident, and surfaces a recovery banner event before building the snapshot.
**Verification:** `pnpm exec vitest run tests/api/events-route.test.ts --pool=forks --poolOptions.forks.singleFork=true`; `pnpm exec vitest run tests/server/runs/recovery-reconciler.test.ts tests/server/runs/recovery-state.test.ts tests/server/events/recovery-incident-events.test.ts --pool=forks --poolOptions.forks.singleFork=true`; `pnpm test:lifecycle`.
**Prevention:** Persisted bootstrap paths need their own conservative stale-state checks for states that are impossible after a crash, instead of assuming the runtime-enriched path will run first. Recovery transitions that stop for the user should emit `error.surfaced`, not only write recovery rows.
**Skill/Doc Updates:** No skill update needed; the lifecycle observability doc already requires reload/recovery decisions to be typed and visible. This note records the concrete persisted-bootstrap failure mode.
