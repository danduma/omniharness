# Source-String Guards Need a Behavioral Pair, Not a Replacement

**Date:** 2026-05-20
**Context:** OmniHarness UI tests for the composer mutation-scoping fix in `tests/ui/composer-shell.test.ts` and the helper exercised at `src/app/home/direct-control-activity.ts`.
**Symptom:** The composer stop-state ownership fix landed with ten source-string `expect(pageSource).toContain(...)` assertions — guards that HomeApp wires four mutations (`sendConversationMessage`, `promotePlanningConversation`, `recoverRun`, `resumeRunRecovery`) through `isMutationPendingForSelectedRun()` before consuming `.isPending`. These tests broke on cosmetic refactors and did not exercise the race they exist to prevent.
**Root Cause:** The behavior under test (cross-run pending state must not leak into the composer of the currently-selected run) is owned by a pure helper. The original PR asserted only on HomeApp source text, which makes the test a structural ratchet rather than a behavioral check. The helper itself had a single multi-case test that did not enumerate the per-mutation scenarios HomeApp passes through it.
**Fix:** Added six behavioral assertions to `tests/app/direct-control-activity.test.ts` that exercise `isMutationPendingForSelectedRun()` for each of the four mutation races plus the no-mutationRunId and null-selectedRunId edge cases. Each test names the race it represents so failures are interpretable. The source-string guards remain as belt-and-suspenders but are no longer the sole coverage.
**Verification:** `pnpm vitest run tests/app/direct-control-activity.test.ts` — 11 tests pass; the 6 new assertions cover scenarios 1–4 from the recommended-work item 6 in the audit handoff.
**Prevention:**
- When a fix introduces a new helper, the helper deserves a behavioral test per scenario the calling site exercises — not just one happy-path test plus N source-string guards.
- Source-string guards are acceptable as a structural ratchet, but never as the sole proof that a race is closed. Test the function call's return shape, not its substring presence in a callee.
- Name each behavioral test after the race it represents ("does not report send-message pending when the user has switched off the run that owns the send") so the suite reads as a documented inventory of guarded races.

**Skill/Doc Updates:** Added section 31 ("Behavioral coverage for mutation-scoping invariants") to `docs/architecture/timing-determinism-audit.md`.
