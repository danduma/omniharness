# Mutation Result Navigation Ownership

**Date:** 2026-05-20
**Context:** OmniHarness home mutations and conversation routing
**Symptom:** A delayed mutation result could select a different conversation than the one the user was working in, matching the reported class where the UI appeared to switch sessions without interaction.
**Root Cause:** Mutation success handlers had only a generic "selection unchanged" guard. Planning promotion also synthesized ownership with `selectedRunIdAtStart ?? payload.runId`, so a mutation that did not start from an actually selected source run could later claim ownership if the UI happened to select that source run before the response resolved. Delete/archive error handlers also restored the previous selection unconditionally, so a late failure after the user selected another session could steal navigation back.
**Fix:** Added separate guards for project-created results, source-run-created results, and optimistic-removal error restoration. Source-run mutations must prove the source run was selected at mutation start and is still selected at success time. Delete/archive failures restore the removed selected run only if the optimistic removal still owns the empty selection. Owned navigation now updates both selected run and browser route together.
**Verification:** `pnpm vitest run tests/app/home-mutation-ownership.test.ts tests/ui/conversation-actions.test.ts`.
**Prevention:** Do not use fallback ids to invent async ownership. Every mutation result or error rollback that navigates needs an explicit owner token captured at start and re-checked at completion.
**Skill/Doc Updates:** Updated `docs/architecture/timing-determinism-audit.md`; no skill change needed because `client-server-state-invariants` already requires mutation success handlers to check owner tokens before navigation.
