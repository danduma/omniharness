# Public tunnel must own the UI origin

**Date:** 2026-08-07
**Context:** OmniHarness local runner and the `omni-lunar-copper-harbor` Cloudflare tunnel.
**Symptom:** The public OmniHarness URL showed `Not found`, an API-only placeholder, or a Cloudflare 502 after a restart.
**Root Cause:** The tunnel forwards to port 3050, but the development launcher started the runner with `--no-static` and exposed the interface separately on Vite port 5173. Requests reaching 3050 therefore had no interface unless the runner proxied them to Vite.
**Fix:** Development now passes `--interface-dev-url http://127.0.0.1:5173` to the runner. The managed public process was restored in production mode so the built interface is served directly from port 3050.
**Verification:** `tests/dev-scripts.test.ts`, runner config tests, targeted recovery tests, runner typecheck, local HTTP response, public HTTP response, and browser inspection of the public OmniHarness unlock screen all passed.
**Prevention:** Treat the tunnel target port as the public origin. Any separate interface server must be explicitly proxied through the runner, or the managed process must serve the built interface itself.
**Skill/Doc Updates:** No general skill update was needed; the launch contract is now encoded in the development script regression test and this project learning note.
