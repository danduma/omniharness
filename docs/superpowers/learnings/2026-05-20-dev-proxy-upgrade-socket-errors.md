# Dev Proxy Upgrade Socket Errors Need Handlers

**Date:** 2026-05-20
**Context:** OmniHarness dev compression proxy
**Symptom:** The dev process exited after the proxy crashed with an unhandled `Error: write EPIPE` from a socket during proxied traffic.
**Root Cause:** The WebSocket upgrade path manually piped the client and upstream sockets without attaching `error` listeners to either upgraded socket. Expected disconnect errors such as `EPIPE` could therefore become fatal unhandled socket errors.
**Fix:** Attach paired upgrade-socket `error` and `close` handlers, treat common disconnect codes as expected teardown, and destroy both sides of the pair on failure or close.
**Verification:** `pnpm exec vitest run tests/dev-scripts.test.ts`; `pnpm exec tsc --noEmit --pretty false 2>&1 | rg "scripts/dev-compression-proxy|tests/dev-scripts"` produced no matching TypeScript errors for the changed files.
**Prevention:** When proxying upgraded or long-lived streams manually, add socket-level error handlers before piping. Do not rely on request-level error handling to catch errors emitted by the upgraded sockets.
**Skill/Doc Updates:** No general skill update needed; this is a project-specific dev proxy lifecycle note.
