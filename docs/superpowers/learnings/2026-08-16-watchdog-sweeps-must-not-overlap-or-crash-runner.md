# Watchdog Sweeps Must Not Overlap or Crash the Runner

**Date:** 2026-08-16
**Context:** OmniHarness supervisor runtime watchdog and SQLite-backed durable wake cleanup
**Symptom:** The production runner disappeared from port 3050 while the restart controller stayed alive. The last runner log entry was an uncaught `SQLITE_BUSY: database is locked` error from scheduled-wake cleanup.
**Root Cause:** The 15-second watchdog timer launched `syncRunningSupervision()` without tracking or catching its promise. Slow sweeps could overlap and increase database contention, and a rejection that remained after the SQLite retry budget became an unhandled promise rejection that terminated Node.
**Fix:** Scheduled watchdog calls now share one in-flight sweep, contain failures, emit `supervisor.watchdog_sweep_failed`, and write the failure to stderr. Startup synchronization still rejects normally so an invalid initial state cannot be hidden.
**Verification:** `pnpm exec vitest run tests/supervisor/runtime-watchdog-scheduling.test.ts tests/supervisor/runtime-watchdog.test.ts tests/server/db-retry.test.ts tests/server/events/named-events.test.ts --reporter=dot` passed 27 tests; `pnpm typecheck` passed; five live health probes spanning more than one watchdog interval returned HTTP 200, with listeners present on ports 3050 and 7800.
**Prevention:** Every repeating async timer must define overlap behavior and handle its returned promise. Background maintenance failures must be observable without becoming process-wide unhandled rejections.
**Skill/Doc Updates:** No general skill update was needed because the existing control-plane guidance already requires bounded work, explicit failure events, and no silent background failures; this regression came from not applying those rules to the timer boundary.
