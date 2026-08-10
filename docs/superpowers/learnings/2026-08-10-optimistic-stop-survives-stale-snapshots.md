# Optimistic Stops Must Survive Stale Snapshots

**Date:** 2026-08-10
**Context:** OmniHarness conversation recovery UI and event-stream state manager
**Symptom:** Clicking Stop on a quota-exhausted recovery notice made the notice disappear, reappear, and disappear again.
**Root Cause:** The local stop mutation optimistically changed the run to `cancelled`, but an in-flight server snapshot could still report `quota_waiting` and overwrite that terminal state before the server's cancellation snapshot arrived.
**Fix:** The central event-stream manager now tracks locally initiated run cancellations, retains the cancelled run across stale non-terminal server snapshots, and releases the protection when the server reports a terminal state or a local rollback restores the prior state.
**Verification:** `pnpm vitest run tests/app/event-stream-state-manager.test.ts tests/app/use-run-recovery-state.test.ts tests/ui/conversation-actions.test.ts`; `pnpm exec tsc -p tsconfig.interface.json --noEmit`; `pnpm exec eslint src/interface/home/EventStreamStateManager.ts`. The repository-wide `pnpm typecheck` remains blocked by the unrelated missing `@/shared/goal-plan` module referenced from `tests/shared/goal-plan.test.ts`.
**Prevention:** Model optimistic terminal actions as owned overlays. Stale, partial, duplicate, or out-of-order snapshots may not reverse them; only authoritative terminal confirmation or an explicit mutation rollback may release the overlay. Cover at least two consecutive stale snapshots so a one-frame preservation fix cannot regress into repeated flicker.
**Skill/Doc Updates:** No general skill update was needed. The existing client/server state-invariants skill already requires ownership and stale-response tests; this note records how that invariant applies to OmniHarness run stops.
