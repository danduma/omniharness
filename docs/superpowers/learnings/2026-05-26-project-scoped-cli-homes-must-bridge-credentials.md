# Project-Scoped CLI Homes Must Bridge Credentials

**Date:** 2026-05-26
**Context:** OmniHarness agent runtime recovery for Codex/Gemini workers
**Symptom:** Workers with persisted sessions failed to respawn after a crash. Gemini surfaced `Authentication required`; Codex exited before ACP startup completed.
**Root Cause:** Project-scoped CLI homes isolated session storage, but also isolated provider credentials. The scoped Gemini home had project metadata only, while auth lived in `~/.gemini`; the scoped Codex home had session SQLite only, while auth/config lived in `~/.codex`.
**Fix:** Keep project-scoped session storage, but bridge missing credential/config files into the scoped home with symlinks and copy fallback. This preserves durable per-project sessions without forcing each project to log in again.
**Verification:** `pnpm vitest run tests/server/agent-runtime/http.test.ts -t "spawns Codex ACP workers|pins Gemini CLI session storage|bridges Codex credentials|bridges Gemini credentials|uses the requested session id"` passes.
**Prevention:** When scoping provider homes, separate session/artifact isolation from auth/config availability. Recovery tests must assert both: sessions stay project-scoped and credentials remain reachable.
**Skill/Doc Updates:** No shared skill update needed; this rule is provider-runtime specific and is captured in the project learning notes.
