# Gemini YOLO Needs CLI Approval Mode

**Date:** 2026-06-30
**Context:** OmniHarness agent runtime, Gemini ACP workers, worker YOLO/full-access mode
**Symptom:** A Gemini worker in YOLO/full-access mode still failed tool execution with `Tool execution ... denied by policy`.
**Root Cause:** OmniHarness tracked the worker as `full-access` and auto-approved ACP permission callbacks, but default Gemini ACP processes were launched without Gemini's own startup-time YOLO approval mode. Gemini could therefore deny tools internally before OmniHarness had any permission request to approve.
**Fix:** Centralize Gemini default argv construction in `buildGeminiArgs`, add `--approval-mode yolo` for `full-access` and `danger-full-access`, and route that builder through both normal worker spawn and worker prewarm.
**Verification:** `pnpm exec vitest run tests/server/agent-runtime/http.test.ts tests/server/agent-runtime/gemini-args.test.ts --no-file-parallelism --testTimeout 30000 --hookTimeout 30000`; `pnpm typecheck`.
**Prevention:** For CLI-backed workers, treat OmniHarness session mode and provider CLI policy as separate layers. When adding or changing permission modes, verify the child process argv/env as well as ACP permission callback behavior, including prewarmed workers.
**Skill/Doc Updates:** No shared skill update needed; this is a project-specific runtime contract captured in the OmniHarness learnings.
