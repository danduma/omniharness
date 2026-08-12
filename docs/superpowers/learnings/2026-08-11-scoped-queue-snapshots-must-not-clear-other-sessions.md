# Scoped Queue Snapshots Must Not Clear Other Sessions

**Date:** 2026-08-11
**Context:** OmniHarness direct-control queued-message drawer
**Symptom:** A queued message remained persisted in SQLite but disappeared from the queue drawer after switching to another session and returning.
**Root Cause:** The server event payload was complete only for its selected `runId`, but the global client queue manager treated each payload as a complete queue for every run. An empty snapshot for another session marked the original row as absent; the row later reappeared with the same timestamp and was rejected as stale.
**Fix:** Queue reconciliation now uses `snapshotRunId` and replaces/marks absent rows only within that run. Unscoped snapshots do not mutate the queue manager.
**Verification:** `pnpm vitest run tests/app/busy-message-queue-manager.test.ts tests/ui/composer-shell.test.ts tests/ui/conversation-actions.test.ts`; `pnpm typecheck`; `git diff --check`.
**Prevention:** Partial or scoped snapshots must carry an owner token and may only erase state within the declared scope. Add a session-switch regression whenever a manager reconciles server-owned collections.
**Skill/Doc Updates:** No general skill update was needed; the existing client/server-state invariant already requires explicit scope, ownership, and completeness handling.
