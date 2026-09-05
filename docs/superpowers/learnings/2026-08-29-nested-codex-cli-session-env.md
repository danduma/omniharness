# Nested Codex CLI Calls Need an Independent Session Environment

**Date:** 2026-08-29
**Context:** Claude workers invoking `codex exec` from an OmniHarness process launched under Codex
**Symptom:** In session `61fa7ea0422e`, Claude reported that “Codex was blocked from this session” after attempting a second-opinion CLI call.
**Root Cause:** Agent processes inherited the parent Codex CLI's `CODEX_HOME`, `CODEX_SQLITE_HOME`, `CODEX_THREAD_ID`, managed launcher/config variables, and other `CODEX_*` state. A nested `codex exec` could therefore reuse or contend with the outer session's local state. The first attempt also used GNU `timeout`, which is not installed by default on macOS; that failure happened before Codex was invoked.
**Fix:** Added `stripAmbientCodexSessionEnv`, which removes inherited `CODEX_*` state when session markers are present, and apply it before configured and request-specific worker environment overrides are merged. Explicit Codex storage configuration without an ambient marker remains intact.
**Verification:** `pnpm exec vitest run tests/server/agent-runtime/tool-env.test.ts` (10/10); `pnpm exec vitest run tests/server/agent-runtime/http.test.ts` (36/36); `pnpm exec tsc -p tsconfig.runner.json --noEmit`; targeted ESLint.
**Prevention:** Treat CLI session identity, storage, managed launcher paths, and managed config as process-boundary state. Never pass an active Codex session environment into a worker that may invoke another Codex CLI; keep worker-specific overrides applied after the boundary sanitizer.
**Skill/Doc Updates:** No general skill update was needed; this project learning records the nested-CLI environment rule.
