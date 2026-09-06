# Preserve structured API errors at authentication boundaries

**Date:** 2026-09-06
**Context:** OmniHarness browser login, pairing, and browser authorization.
**Symptom:** New users saw `[object Object]` when authentication failed.
**Root Cause:** Runtime HTTP requests reject with plain `RuntimeApiError` objects. Authentication callbacks tested `instanceof Error` and otherwise called `String(error)`, discarding the server message. A tunnel without a configured public origin or trusted proxy can trigger an origin rejection, but the affected user's precise underlying failure was not available.
**Fix:** Use the existing `runtimeErrorMessage` helper for login, pairing, and browser authorization exchange failures. Document explicit ngrok public-origin and loopback-proxy configuration in README.md.
**Verification:** Four regression cases failed with `[object Object]` before the change. All 35 tests across home authentication errors, browser authorization, runtime requests, origin guards, auth routes, and pairing routes passed afterward. `pnpm build:interface:web` and `pnpm exec tsc -p tsconfig.interface.json --noEmit` passed. The existing server returned HTTP 200 for `/`; no live ngrok tunnel was exercised and no production test conversations were created.
**Prevention:** At runtime API rejection boundaries, use `runtimeErrorMessage` instead of assuming rejections are native Error instances. Test server-originated failures through the actual callback that updates visible state.
**Skill/Doc Updates:** README.md now covers ngrok setup. No shared skill update is needed: the runtime helper already documents the contract; these callers failed to use it.
