# Recovery Must Preserve Worker Account Allocation

**Date:** 2026-08-29
**Context:** OmniHarness worker recovery and Claude local-session credentials
**Symptom:** After a runner restart, session `61fa7ea0422e` failed with `Spawn failed: Credential profile "claude" provider command failed.` even though its Claude subscription account was available.
**Root Cause:** The worker had been auto-assigned account `claude-sub-1`, but several recovery and respawn paths consulted only the run's explicit `preferredWorkerAccountId`. Auto-selected accounts are persisted on `worker_credential_allocations`, so those paths dropped the account id and fell back to the generic credential profile.
**Fix:** Recovery, observer revival, supervisor saved-session resume, and failover now read the worker's persisted allocation and pass it to `resolveWorkerLaunchSelection`. A regression test covers saved-session recovery with an auto-selected account.
**Verification:** `pnpm vitest run tests/server/runs/recovery-reconciler.test.ts`; `pnpm vitest run tests/supervisor/observer.test.ts`; `pnpm vitest run tests/supervisor/worker-failover.test.ts`; `pnpm vitest run tests/server/workers/launch-selection.test.ts`; `pnpm exec tsc -p tsconfig.runner.json --noEmit`; targeted ESLint.
**Prevention:** Treat `worker_credential_allocations` as the authoritative credential owner for every respawn path. Run-level account preferences are only the explicit-selection fallback; auto-selected worker allocations must survive recovery.
**Skill/Doc Updates:** No general skill update was needed; the existing `readWorkerAllocatedAccountId` helper and launch-selection comments now encode the rule, and this note records the incident-specific lesson.
