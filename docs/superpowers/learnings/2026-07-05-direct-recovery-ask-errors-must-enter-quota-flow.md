# Direct Recovery Ask Errors Must Enter Quota Flow

**Date:** 2026-07-05
**Context:** OmniHarness direct conversation recovery, Claude Code session limits.
**Symptom:** Clicking Recover conversation on a failed direct Claude run returned `Ask failed: Internal error: You've hit your session limit ...` and left the UI telling the user to reconnect or fix the runtime instead of waiting for the reset time.
**Root Cause:** Queued-message delivery handled worker quota errors, but direct recovery ask calls did not. `resumeDirectRunFromSavedSession` and fresh direct reruns set the run back to `running`, called `askAgent`, and let quota/rate-limit errors bubble to the HTTP route as generic 500 errors.
**Fix:** Direct recovery ask calls now detect quota errors, invoke `handleWorkerQuotaExhaustion`, mark the worker `cred-exhausted`, park the run in `quota_waiting` or `needs_recovery`, and return a successful recovery response with the new recovery state.
**Verification:** `pnpm vitest run tests/api/run-route.test.ts -t "parks direct saved-session recovery"`; `pnpm vitest run tests/server/quota/recovery.test.ts tests/server/quota/reset-parser.test.ts tests/server/quota/type-blocking.test.ts tests/api/run-route.test.ts`; `pnpm vitest run tests/supervisor/wake.test.ts -t "quota|direct quota"`; `pnpm typecheck`.
**Prevention:** When adding or changing worker ask paths, check every path that can call `askAgent`, not only normal queue delivery. If the error can be quota, session limit, rate limit, or billing exhaustion, it must enter the quota recovery flow before surfacing to the route.
**Skill/Doc Updates:** No general skill update needed; the project lifecycle and control-plane docs already require typed user-visible recovery transitions. This note records the missed direct recovery branch.
