# Framework Cutovers Must Preserve the Public Origin

**Date:** 2026-07-31
**Context:** OmniHarness Next.js-to-Vite interface/runner cutover and Cloudflare Tunnel deployment
**Symptom:** The configured public address returned Cloudflare HTTP 502 after the split, even though the new interface build had passed.
**Root Cause:** No persistent runner was listening on the canonical tunnel's existing origin, `localhost:3050`. During diagnosis, a stale secondary tunnel entry pointing at `3035` was mistaken for the active `lunar-copper-harbor` deployment, leading to an unnecessary attempt to change the port instead of first restoring the service on its established origin.
**Fix:** The temporary `3035` override was removed, the existing tunnel configuration was left unchanged, and the persistent restart service launched the new runner and static Vite interface on port `3050`.
**Verification:** `http://127.0.0.1:3050/api/healthz`, `https://lunar-copper-harbor.omniharness.dev/api/healthz`, the public root document, and its hashed Vite JavaScript asset all returned HTTP 200. The public HTML contained the Vite root and no `_next/` or `__NEXT_DATA__` marker.
**Prevention:** Treat the deployed hostname, port, TLS identity, and tunnel origin as compatibility contracts independent of the frontend framework. Before editing a tunnel, identify the canonical public origin from runtime configuration, check its connector log, and start the replacement service on the existing origin.
**Skill/Doc Updates:** `docs/deployment/runner-operations.md` now states that framework cutovers must preserve port `3050` and verify the public health endpoint before changing tunnel routing. No general skill update was needed because the systematic debugging workflow already requires checking each component boundary; the failure was not following it carefully enough.
