# Run Selection Must Restore the Saved Account

**Date:** 2026-07-11
**Context:** OmniHarness composer state, optimistic conversation creation, and Claude account selection
**Symptom:** A Claude conversation started with an explicit account, but the composer later displayed `Auto account` and a recreated worker used automatic allocation.
**Root Cause:** Reopening a run restored its worker, model, and effort but omitted `preferredWorkerAccountId`. The next message submitted the composer default (`auto`) and cleared the durable run preference. Adding account hydration alone would also have reset newly created runs because their optimistic snapshots omitted the account.
**Fix:** Run selection now restores the saved account, and optimistic run snapshots retain the selected account until the server snapshot arrives.
**Verification:** `pnpm vitest run tests/app/home-utils.test.ts tests/app/run-selection-effects.test.ts` proved both regressions red before the change and green afterward. Broader verification is recorded in the task handoff.
**Prevention:** Treat worker, account, model, and effort as one compound selection across durable rows, optimistic snapshots, hydration, rendering, prewarm, and mutation payloads. A partial restore is a state-corruption bug.
**Skill/Doc Updates:** Rule 12 in the lifecycle architecture document now requires restoring and optimistically preserving the full compound selection. The existing React and client/server state skills already require a single owner and correct optimistic-state completeness, so no general skill update was needed.
