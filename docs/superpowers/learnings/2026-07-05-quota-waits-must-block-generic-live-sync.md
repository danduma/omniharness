# Quota Waits Must Block Generic Live Sync

**Date:** 2026-07-05
**Context:** OmniHarness direct worker recovery, quota waits, and live bridge sync
**Symptom:** Claude Code session-limit errors repeated as failed/reconnect attempts instead of showing a scheduled quota wait. A repaired quota incident could also be overwritten back to `running` by live sync.
**Root Cause:** Direct worker ask paths treated Claude session limits as generic failures, the reset parser missed `10:40am`, and `syncConversationSessions` did not treat open future `quota_exhausted` incidents as authoritative pause state.
**Fix:** Route direct, initial, and queued worker quota errors through `handleWorkerQuotaExhaustion`; parse no-space AM/PM reset text; resume direct quota waits from durable wakes without starting the supervisor; render recovery notices for direct runs; preserve open future quota incidents during live sync.
**Verification:** `pnpm vitest run tests/server/conversations-sync.test.ts tests/server/quota/reset-parser.test.ts tests/server/quota/recovery.test.ts tests/supervisor/wake.test.ts`; `pnpm typecheck`; focused ESLint passed with pre-existing warnings only.
**Prevention:** Any path that observes provider quota/session-limit text must enter the quota recovery incident path before generic failure persistence. Any background sync that can revive worker state must first check for open future quota incidents and preserve `quota_waiting`.
**Skill/Doc Updates:** No general skill update needed; the lifecycle observability doc already requires observable recovery state transitions. This note records the concrete direct-worker quota/sync interaction.
