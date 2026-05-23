# Durable Wake Backup Failures Must Be Observed

**Date:** 2026-05-20
**Context:** OmniHarness supervisor wake scheduling and durable wake backups
**Symptom:** A `SQLITE_BUSY: database is locked` failure while inserting `supervisor_scheduled_wakes` surfaced as an unhandled rejection from the web process.
**Root Cause:** `scheduleSupervisorWake()` intentionally kept a volatile in-memory timer, but fired the durable backup write with `void scheduleDurableSupervisorWakeAt(...)` and no rejection handler. If SQLite stayed locked past `busy_timeout`, the backup failure had no observer.
**Fix:** Durable backup scheduling failures are now caught and emitted as a typed named event, `supervisor.durable_wake_schedule_failed`, while leaving the volatile wake timer intact.
**Verification:** `pnpm test tests/supervisor/wake.test.ts` covers a rejected durable backup write and asserts the failure event is emitted while the volatile wake remains scheduled.
**Prevention:** Any background persistence backup launched with `void` needs an explicit rejection path. If the server decides to continue with a degraded in-memory fallback, that degradation still needs a named event.
**Skill/Doc Updates:** No general skill update needed; the lifecycle observability rules already require branches and failures in server decisions to emit named events.
