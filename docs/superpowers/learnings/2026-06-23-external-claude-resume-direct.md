# External Claude Resumes Must Bypass Omni

**Date:** 2026-06-23
**Context:** OmniHarness external Claude session picker and `/api/conversations` creation path.
**Symptom:** Selecting a saved Claude session created an Omni implementation run with no worker rows. The supervisor woke up, inspected the project, and asked for clarification instead of attaching to the selected Claude session.
**Root Cause:** `ExternalSessionsPicker` sent `externalClaudeSessionId`, `projectPath`, and an empty `command`, but no `mode` or `preferredWorkerType`. The route defaulted the request to implementation/Omni, and the implementation path ignores `externalClaudeSessionId`; the direct-worker path is the only path that can pass `resumeSessionId` to Claude.
**Fix:** Treat any `externalClaudeSessionId` as a direct Claude resume at both the HTTP route boundary and the shared `createConversation` chokepoint. The route no longer starts supervisor runtime warmup for this request, and `createConversation` forces the direct worker path with worker type `claude`.
**Verification:** `pnpm vitest run tests/api/conversations-route.test.ts -t "resumes an external Claude session"` failed before the fix with `implementation` instead of `direct`, then passed after the fix. `pnpm vitest run tests/api/conversations-route.test.ts` passed all 29 tests.
**Prevention:** When a request carries an external provider session id, resolve the provider/session intent before applying default conversation mode. Defaults like Omni/implementation are safe for new tasks, but wrong for resume flows because they can bypass the only code path that knows how to attach the provider session.
**Skill/Doc Updates:** No general skill update needed; the lifecycle observability rules already require tracing session decisions and adding a regression at the route/control-plane boundary.
