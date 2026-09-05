# Android PWA System Bars Need an Edge-to-Edge Background

**Date:** 2026-09-02
**Context:** OmniHarness Android installed PWA theming and static asset caching
**Symptom:** The Android PWA status bar stayed white in night mode even after reloading and reinstalling the app.
**Root Cause:** Android's edge-to-edge system-bar behavior can make the status bar transparent instead of honoring the legacy theme-color surface. OmniHarness did not opt its viewport into edge-to-edge rendering and its native window fallback was still white, so a browser/OS behavior change exposed white behind light status icons. Separately, the service-worker build hash covered emitted JavaScript and CSS but not the cached app shell, manifest, or icons, so metadata-only changes could leave an existing static cache version unchanged.
**Fix:** Opt both HTML shells into `viewport-fit=cover`, pad the application root by the top and bottom safe-area insets, set the installed window fallback to the dark application chrome color, and include every cached PWA metadata asset in the deterministic service-worker build hash.
**Verification:** `pnpm test tests/ui/pwa-bootstrap.test.ts tests/interface/pwa-contract.test.ts`; `pnpm build:interface:web`; direct checks of the manifest and service worker served from `http://127.0.0.1:3050`.
**Prevention:** Treat installed-PWA system chrome as three layers: adaptive document theme metadata, the manifest/native-window fallback, and page content painted through edge-to-edge safe areas. When a service worker pre-caches a file, also include that file's content hash in the cache version.
**Skill/Doc Updates:** No general skill update was needed. This is a project-specific PWA cache-versioning invariant now enforced by the interface contract tests.
