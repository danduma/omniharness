# Public Development Hosts Must Be Allowed by Next

**Date:** 2026-07-25
**Context:** OmniHarness development server behind the Cloudflare tunnel
**Symptom:** The public URL returned HTTP 200 but showed Next.js’s generic client-side exception page.
**Root Cause:** `OMNIHARNESS_PUBLIC_ORIGIN` had been changed to the active Cloudflare hostname, but `next.config.ts` still allowed only older public development hostnames. Next.js blocked `/_next/*` requests from the active hostname, so the HTML loaded without the JavaScript needed to start the app.
**Fix:** Added the active Cloudflare hostname to `allowedDevOrigins`.
**Verification:** A regression test checks that the hostname configured in `.env` appears in `allowedDevOrigins`. After restarting through the reloader, the public page rendered in Chrome with no console errors and the server emitted no new cross-origin blocking warning.
**Prevention:** Whenever the public development origin changes, update and test Next.js `allowedDevOrigins` at the same time. An HTTP 200 check alone is not enough for a JavaScript application; verify the page in a browser and inspect client errors.
**Skill/Doc Updates:** No general skill update was needed because the existing React and completion guidance already requires browser-level verification for product-surface failures. This note records the OmniHarness-specific configuration coupling.
