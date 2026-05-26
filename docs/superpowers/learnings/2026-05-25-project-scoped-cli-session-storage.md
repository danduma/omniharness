# Project-Scoped CLI Session Storage

**Date:** 2026-05-25
**Context:** OmniHarness direct-control worker recovery across Gemini, Codex, Claude, and OpenCode ACP harnesses
**Symptom:** Direct recovery could hold a saved ACP session id, but the underlying CLI could no longer resume it because its own session files lived in provider-global storage outside the project. Gemini reported an invalid saved session after looking in its global temp-backed chat directory.
**Root Cause:** OmniHarness treated the ACP session id as durable while allowing each CLI harness to choose its default storage root. That made recovery depend on global provider storage layout, temp cleanup behavior, and whatever project hashing each CLI used internally.
**Fix:** Worker startup now pins CLI session storage under `<project>/.omniharness/cli-home/...` for every built-in CLI harness: `GEMINI_CLI_HOME` for Gemini, `CODEX_SQLITE_HOME` for Codex, `CLAUDE_CONFIG_DIR` for Claude, and OpenCode's config/XDG data/state/cache roots. Explicit user-provided env vars still win.
**Verification:** `pnpm exec vitest run tests/server/agent-runtime/http.test.ts`; `pnpm test tests/api/run-route.test.ts tests/lib/run-recovery-state.test.ts tests/lib/conversation-workers.test.ts`; `pnpm exec vitest run tests/api/conversation-messages-route.test.ts -t "automatically resumes a missing direct worker|creates a fresh direct worker"`; `git diff --check`.
**Prevention:** Any new built-in CLI harness must have a project-scoped session/storage root before it is used for direct-control recovery. Do not rely on a provider's default global home, cache, or temp directory for resumable ACP sessions.
**Skill/Doc Updates:** No general skill update needed; this is OmniHarness runtime policy, captured here and covered by agent-runtime tests.
