# A Quota Reset Time Is Not Proof Of Exhaustion

**Date:** 2026-08-02
**Context:** OmniHarness quota parsing and worker recovery
**Symptom:** A progress notice such as “You've used 76% of your weekly limit · resets Aug 3 at 8pm” was classified as a quota error and could park a run in `quota_waiting`. When Claude did explicitly reject a request with that reset date, the parser dropped “Aug 3” and scheduled the wake for Aug 2 at 8pm.
**Root Cause:** `looksLikeQuota` treated any text with reset language and a parseable reset time as exhaustion. That conflated informational usage telemetry with an explicit provider rejection. The time parser also recognized only the clock portion of a named month-and-day reset.
**Fix:** Detect percentage-based usage progress notices and keep values below 100% out of quota recovery. Explicit exhaustion text and provider errors still enter the existing recovery path. Named month-and-day reset times now retain their calendar date.
**Verification:** `pnpm exec vitest run tests/server/quota/reset-parser.test.ts` failed on the new 76% and named-date regression tests before their respective parser changes and passed afterward.
**Prevention:** Quota recovery must require an exhaustion signal. Reset schedules and usage percentages are supporting metadata, not blocking signals by themselves.
**Skill/Doc Updates:** No shared skill update was needed; this rule is specific to OmniHarness quota parsing and is covered by the regression test and this project note.
