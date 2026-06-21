# Partial Queue Mutations Must Not Revive Server-Absent Rows

**Date:** 2026-06-15
**Context:** OmniHarness queued steering, interrupt-and-send, frontend queue manager
**Symptom:** A force-sent queued message appeared in the worker stream as steered/delivered, but it remained visible in the queued-message drawer.
**Root Cause:** The server delivered the row and authoritative event snapshots correctly omitted it from `queuedMessages`, but the interrupt mutation returned a partial `status: "delivering"` queued row. When delivery completed quickly, the complete empty snapshot could arrive before the mutation success handler, and the older partial response reinserted the row into `BusyMessageQueueManager`.
**Fix:** `BusyMessageQueueManager` now records active queued-message ids that disappear from authoritative server snapshots. Later active upserts for those ids are ignored unless a new server snapshot includes the row again, while terminal mutation rows remove the item and clear pending action flags.
**Verification:** `./node_modules/.bin/vitest run tests/app/busy-message-queue-manager.test.ts` passes and covers stale active mutation upserts after an empty server snapshot, server restoration of a genuinely pending row, and terminal mutation row removal.
**Prevention:** Treat mutation responses as partial and potentially stale. Complete server snapshots may erase active queue rows; older partial mutation responses must not be allowed to revive them without a newer authoritative server row.
**Skill/Doc Updates:** No general skill update needed; `client-server-state-invariants` already requires provenance, completeness, and stale-response tests for server-owned arrays.
