# Refresh Static Entrypoints After Rebuilds

**Date:** 2026-08-04
**Context:** OmniHarness runner static interface serving
**Symptom:** The page was blank because the JavaScript and CSS URLs in the served HTML returned 404 after rebuilding the interface while the runner stayed up.
**Root Cause:** `prepareStaticInterface` read and retained `index.html` only at runner startup. An in-place Vite rebuild replaced the content-hashed assets and wrote a new entrypoint, but the running server continued sending the old entrypoint with filenames that no longer existed.
**Fix:** Before serving the interface entrypoint, compare it with the current file. When it changes, validate the new CSP manifest and assets, then replace the cached HTML and security headers together.
**Verification:** `pnpm vitest run tests/runtime/static-files.test.ts tests/server/runner/restart-request.test.ts`; `pnpm exec tsc -p tsconfig.runner.json --noEmit`; live requests to port 3050 returned 200 for the JavaScript and CSS named by the served HTML; an in-app browser rendered the OmniHarness password screen with no console errors.
**Prevention:** Any server that survives content-hashed frontend rebuilds must refresh the entrypoint and its CSP metadata as one validated snapshot. Regression tests must simulate removing the old hashed asset after an in-place rebuild.
**Skill/Doc Updates:** No general skill update was needed because the debugging and verification skills already require tracing cached state and reproducing the live failure. This project note and the static-interface regression test capture the OmniHarness-specific rule.
