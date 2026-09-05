# Handoff Errors Must Preserve Runtime Messages

**Date:** 2026-09-02
**Context:** OmniHarness cross-CLI handoff dialog and runtime API boundary
**Symptom:** A failed handoff preparation displayed `[object Object]`, hiding the server's actionable failure message.
**Root Cause:** `HandoffManager` formatted rejected runtime requests with `error instanceof Error ? error.message : String(error)`. Runtime API failures are intentionally thrown as plain `RuntimeApiError` objects, so `String(error)` discarded their `message` field.
**Fix:** Route handoff preparation, revision, and launch failures through the existing `runtimeErrorMessage()` helper.
**Verification:** `pnpm test tests/interface/handoff-manager.test.ts tests/runtime-api/request.test.ts` passed 14 tests, and `pnpm build:interface:web` completed successfully.
**Prevention:** At UI/runtime boundaries, use `runtimeErrorMessage()` for unknown rejections instead of assuming runtime failures are `Error` instances. Add a manager-level regression test whenever a product surface renders a runtime API rejection.
**Skill/Doc Updates:** No general skill update was needed because the repository's runtime request module already documents and tests this exact error shape; the missing enforcement was in the handoff caller.
