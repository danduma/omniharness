# Remote Access, Single-User Auth, Push, And PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make OmniHarness securely accessible from anywhere through an HTTPS tunnel while keeping the ACP bridge private, adding single-user password auth, QR-based desktop-to-mobile pairing, durable mobile sessions, mobile Web Push notifications, and installable PWA behavior.

**Architecture:** Keep the existing Next.js shell as the only public surface, add a first-party auth layer with durable DB-backed sessions and protected routes, add one-time QR pairing tokens that redeem into persistent mobile sessions, persist push subscriptions and notification preferences in SQLite, add a service worker plus manifest for PWA installability, and hook notification delivery into run, clarification, and worker-health events without changing the bridge trust boundary.

**Tech Stack:** Next.js App Router, React, TypeScript, Drizzle ORM, SQLite, Web Crypto / Node crypto, Argon2id, Web Push (VAPID), service worker, Playwright, Vitest

**North Star Product:** OmniHarness is a personal remote control plane for local coding agents with secure remote access, actionable mobile alerts, installable app behavior, and explicit operational controls.

**Current Milestone:** Ship secure remote access v1 with password-only single-user auth, protected UI/API/SSE access, QR-based mobile pairing with restart-safe sessions, Web Push for high-value events, and installable PWA shell behavior.

**Later Milestones / Deferred But Intentional:** optional MFA, read-only mobile mode, richer per-event notification controls, panic mode, remote kill-switch operations, digest notifications, and multi-user support.

---

## File Structure

- Create: `middleware.ts`
- Create: `src/server/auth/config.ts`
- Create: `src/server/auth/password.ts`
- Create: `src/server/auth/session.ts`
- Create: `src/server/auth/pairing.ts`
- Create: `src/server/auth/guards.ts`
- Create: `src/server/auth/audit.ts`
- Create: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/logout/route.ts`
- Create: `src/app/api/auth/session/route.ts`
- Create: `src/app/api/auth/pair/route.ts`
- Create: `src/app/api/auth/pair/redeem/route.ts`
- Create: `src/app/api/notifications/subscribe/route.ts`
- Create: `src/app/api/notifications/unsubscribe/route.ts`
- Create: `src/server/notifications/web-push.ts`
- Create: `src/server/notifications/preferences.ts`
- Create: `src/server/notifications/deliver.ts`
- Create: `src/server/notifications/triggers.ts`
- Create: `src/components/LoginShell.tsx`
- Create: `src/components/PairDeviceDialog.tsx`
- Create: `src/components/PwaBootstrap.tsx`
- Create: `src/components/NotificationSettings.tsx`
- Create: `src/lib/pwa.ts`
- Create: `public/manifest.webmanifest`
- Create: `public/sw.js`
- Create: `public/icons/icon-192.png`
- Create: `public/icons/icon-512.png`
- Create: `docs/remote-access.md`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/api/events/route.ts`
- Modify: `src/app/api/settings/route.ts`
- Modify: `src/app/api/agents/route.ts`
- Modify: `src/app/api/agents/[name]/route.ts`
- Modify: `src/app/api/supervisor/route.ts`
- Modify: `src/app/api/messages/route.ts`
- Modify: `src/app/api/plans/route.ts`
- Modify: `src/app/api/runs/[id]/route.ts`
- Modify: `src/app/api/runs/[id]/answer/route.ts`
- Modify: `src/app/api/runs/[id]/validate/route.ts`
- Modify: `src/app/api/fs/route.ts`
- Modify: `src/app/api/fs/files/route.ts`
- Modify: `src/app/api/accounts/route.ts`
- Modify: `src/app/api/llm-models/route.ts`
- Modify: `src/server/db/schema.ts`
- Modify: `src/server/db/index.ts`
- Modify: `src/server/api-errors.ts`
- Modify: `src/server/clarifications/store.ts`
- Modify: `src/server/supervisor/index.ts`
- Modify: `src/server/supervisor/observer.ts`
- Modify: `src/server/workers/monitor.ts`
- Modify: `package.json`
- Modify: `README.md`
- Add tests: `tests/auth/password.test.ts`
- Add tests: `tests/auth/session.test.ts`
- Add tests: `tests/auth/pairing.test.ts`
- Add tests: `tests/api/auth-route.test.ts`
- Add tests: `tests/api/pairing-route.test.ts`
- Add tests: `tests/api/events-auth.test.ts`
- Add tests: `tests/api/notifications-route.test.ts`
- Add tests: `tests/ui/login-shell.test.ts`
- Add tests: `tests/ui/pair-device-dialog.test.ts`
- Add tests: `tests/ui/pwa-bootstrap.test.ts`
- Add tests: `tests/e2e/remote-auth.spec.ts`
- Add tests: `tests/e2e/mobile-pairing.spec.ts`
- Add tests: `tests/e2e/pwa-shell.spec.ts`

## Task 1: Add Authentication Foundations

**Files:**

- Create: `src/server/auth/config.ts`
- Create: `src/server/auth/password.ts`
- Create: `src/server/auth/session.ts`
- Create: `src/server/auth/pairing.ts`
- Create: `src/server/auth/guards.ts`
- Create: `src/server/auth/audit.ts`
- Modify: `src/server/db/schema.ts`
- Modify: `src/server/db/index.ts`
- Modify: `src/app/api/settings/route.ts`
- Add tests: `tests/auth/password.test.ts`
- Add tests: `tests/auth/session.test.ts`
- Add tests: `tests/auth/pairing.test.ts`

- [ ] **Step 1: Verify the current auth gap**

Run:

```bash
rg -n "login|logout|session|auth|argon|password hash|HttpOnly|SameSite|middleware" src tests
```

Expected: no first-party app auth stack exists yet.

- [ ] **Step 2: Define auth config and storage**

Implement:

- a password-hash loading strategy that prefers explicit env/config and can later be migrated to encrypted settings,
- a session secret loading strategy distinct from the password,
- durable auth session tables and helpers,
- pairing-token tables and helpers,
- auth audit helpers,
- database support for auth-related audit events and any lightweight metadata needed for remote-access settings.

Decision constraints:

- use Argon2id for password hashing,
- do not store plaintext passwords,
- do not expose session secrets to the client.

- [ ] **Step 3: Implement session primitives**

Add:

- password verification,
- opaque cookie issue / verify helpers backed by durable session lookup,
- expiry, rotation, and invalidation semantics,
- pairing-token creation, hashing, redemption, and replay rejection,
- helpers for same-origin checks on mutating requests.

- [ ] **Step 4: Verify the auth foundation**

Run:

```bash
pnpm test -- tests/auth/password.test.ts tests/auth/session.test.ts tests/auth/pairing.test.ts
```

Expected: password hashing/verification, durable session behavior, and pairing-token logic pass.

## Task 2: Protect The App Surface

**Files:**

- Create: `middleware.ts`
- Create: `src/app/api/auth/login/route.ts`
- Create: `src/app/api/auth/logout/route.ts`
- Create: `src/app/api/auth/session/route.ts`
- Modify: `src/app/api/events/route.ts`
- Modify: `src/app/api/agents/route.ts`
- Modify: `src/app/api/agents/[name]/route.ts`
- Modify: `src/app/api/supervisor/route.ts`
- Modify: `src/app/api/messages/route.ts`
- Modify: `src/app/api/plans/route.ts`
- Modify: `src/app/api/runs/[id]/route.ts`
- Modify: `src/app/api/runs/[id]/answer/route.ts`
- Modify: `src/app/api/runs/[id]/validate/route.ts`
- Modify: `src/app/api/fs/route.ts`
- Modify: `src/app/api/fs/files/route.ts`
- Modify: `src/app/api/accounts/route.ts`
- Modify: `src/app/api/llm-models/route.ts`
- Add tests: `tests/api/auth-route.test.ts`
- Add tests: `tests/api/pairing-route.test.ts`
- Add tests: `tests/api/events-auth.test.ts`

- [ ] **Step 1: Add login/logout/session routes**

Implement:

- login endpoint issuing the durable session cookie,
- logout endpoint clearing the cookie,
- session-status endpoint for the UI bootstrap path,
- desktop-authenticated pairing endpoint minting a short-lived one-time token plus QR payload,
- pairing redemption endpoint exchanging the one-time token for a durable mobile session,
- rate-limited failure handling and audit-event inserts.

- [ ] **Step 2: Protect page and API access**

Use `middleware.ts` plus shared auth guards so that:

- the root UI shell is inaccessible without a valid session,
- all privileged API routes reject unauthenticated requests,
- the SSE route rejects unauthenticated access before beginning the stream,
- mutating routes reject cross-site requests.

- [ ] **Step 3: Preserve explicit failures**

Ensure unauthorized states return clear 401/403 responses and that the frontend receives explicit locked/session-expired signals instead of silent empty data.

Ensure pairing-token failures are explicit:

- expired token,
- already-used token,
- malformed token,
- revoked desktop session.

- [ ] **Step 4: Verify protected access**

Run:

```bash
pnpm test -- tests/api/auth-route.test.ts tests/api/pairing-route.test.ts tests/api/events-auth.test.ts
```

Expected: unauthenticated page/API/SSE access is blocked, authenticated access succeeds, and pairing endpoints enforce single-use short-lived redemption.

## Task 3: Add Login UI And Locked-State Shell

**Files:**

- Create: `src/components/LoginShell.tsx`
- Create: `src/components/PairDeviceDialog.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`
- Add tests: `tests/ui/login-shell.test.ts`
- Add tests: `tests/ui/pair-device-dialog.test.ts`
- Add tests: `tests/e2e/remote-auth.spec.ts`
- Add tests: `tests/e2e/mobile-pairing.spec.ts`

- [ ] **Step 1: Build the locked/authenticated shell split**

Update the app so it can render:

- unauthenticated login view,
- loading/session-check state,
- authenticated existing shell,
- expired-session and logout flows.

Add a desktop `Connect phone` affordance that opens a pairing dialog with:

- QR code,
- copy-link fallback,
- expiry countdown,
- pairing success / expired states.

- [ ] **Step 2: Keep the mobile experience first-class**

Make sure the login screen works cleanly on the current mobile layout, with:

- large enough touch targets,
- explicit error text,
- no hidden dependency on desktop-only affordances.

- [ ] **Step 3: Verify login UX**

Run:

```bash
pnpm test -- tests/ui/login-shell.test.ts
pnpm test -- tests/ui/pair-device-dialog.test.ts
pnpm test:e2e -- tests/e2e/remote-auth.spec.ts
pnpm test:e2e -- tests/e2e/mobile-pairing.spec.ts
```

Expected: login/logout work on the primary shell path, and desktop-to-mobile pairing UX works end-to-end.

## Task 4: Add PWA Installability And Service Worker Bootstrapping

**Files:**

- Create: `src/components/PwaBootstrap.tsx`
- Create: `src/lib/pwa.ts`
- Create: `public/manifest.webmanifest`
- Create: `public/sw.js`
- Create: `public/icons/icon-192.png`
- Create: `public/icons/icon-512.png`
- Modify: `src/app/layout.tsx`
- Modify: `package.json`
- Add tests: `tests/ui/pwa-bootstrap.test.ts`
- Add tests: `tests/e2e/pwa-shell.spec.ts`

- [ ] **Step 1: Add manifest and metadata**

Implement:

- manifest with standalone display mode,
- app icons and theme colors,
- layout metadata and links required for installability.

- [ ] **Step 2: Add service worker registration**

Bootstrap a service worker that handles:

- install/activate lifecycle,
- conservative shell caching,
- push event handling,
- notification click deep-link routing.

Constraint:

- do not design this as an offline-first app,
- show offline/reconnecting state in the UI instead of pretending remote control works offline.

The post-pair mobile landing flow should naturally hand off into install and notification setup, not a dead-end success screen.

- [ ] **Step 3: Verify PWA basics**

Run:

```bash
pnpm test -- tests/ui/pwa-bootstrap.test.ts
pnpm test:e2e -- tests/e2e/pwa-shell.spec.ts
```

Expected: manifest, service worker registration, and standalone-friendly shell behavior are present.

## Task 5: Add Push Subscription Persistence And Settings UI

**Files:**

- Create: `src/app/api/notifications/subscribe/route.ts`
- Create: `src/app/api/notifications/unsubscribe/route.ts`
- Create: `src/server/notifications/preferences.ts`
- Create: `src/components/NotificationSettings.tsx`
- Modify: `src/server/db/schema.ts`
- Modify: `src/server/db/index.ts`
- Modify: `src/app/page.tsx`
- Add tests: `tests/api/notifications-route.test.ts`

- [ ] **Step 1: Add database tables**

Add tables for:

- push subscriptions,
- notification preferences,
- delivery status metadata if needed for cleanup/backoff.

The auth/session migration in Task 1 should already have added durable session and pairing-token tables.

- [ ] **Step 2: Add subscription APIs**

Implement authenticated routes that:

- save subscriptions,
- remove subscriptions,
- validate ownership and payload shape,
- keep secrets server-side only.

Notification preference storage should be associated with the durable device/session identity when that helps preserve device-specific behavior.

- [ ] **Step 3: Add notification settings UI**

Expose:

- permission state,
- subscribe / unsubscribe actions,
- a compact event-preferences surface for the initial notification set,
- install guidance when the platform/browser has extra requirements.

- [ ] **Step 4: Verify persistence and settings behavior**

Run:

```bash
pnpm test -- tests/api/notifications-route.test.ts
```

Expected: push subscriptions and notification preferences persist and can be removed cleanly.

## Task 6: Add Server-Side Web Push Delivery

**Files:**

- Create: `src/server/notifications/web-push.ts`
- Create: `src/server/notifications/deliver.ts`
- Modify: `package.json`
- Modify: `README.md`

- [ ] **Step 1: Add Web Push infrastructure**

Implement:

- VAPID key loading/generation guidance,
- payload serializer,
- delivery helper with response handling,
- cleanup / disable behavior for permanently invalid subscriptions.

- [ ] **Step 2: Keep failures observable**

On delivery failure:

- write explicit audit or execution events,
- mark invalid subscriptions disabled instead of silently retrying forever,
- avoid crashing the main request that triggered the notification when best-effort delivery fails.

- [ ] **Step 3: Verify delivery helpers**

Run:

```bash
pnpm test -- tests/api/notifications-route.test.ts
```

Expected: delivery helpers validate payload shape and subscription failure paths are covered.

## Task 7: Trigger Notifications From High-Value Runtime Events

**Files:**

- Create: `src/server/notifications/triggers.ts`
- Modify: `src/server/supervisor/index.ts`
- Modify: `src/server/supervisor/observer.ts`
- Modify: `src/server/clarifications/store.ts`
- Modify: `src/server/workers/monitor.ts`
- Modify: `src/app/api/events/route.ts`

- [ ] **Step 1: Define the first event matrix**

Wire notifications for:

- run completed,
- run failed,
- clarification requested,
- worker stuck,
- permission/manual action needed,
- runtime health issues worth immediate attention.

- [ ] **Step 2: Deep-link all notifications**

Every run-scoped notification should include a path back to `/session/:runId`.

Worker/runtime notifications that are not tied to a single run should link back to the main shell with a clear status surface.

- [ ] **Step 3: Verify trigger coverage**

Run:

```bash
pnpm test -- tests/supervisor/index.test.ts tests/supervisor/observer.test.ts tests/workers/monitor.test.ts
```

Expected: the existing runtime paths still pass and notification trigger points are covered by focused assertions or new companion tests.

## Task 8: Add Deployment Guidance And Tunnel Hardening Notes

**Files:**

- Create: `docs/remote-access.md`
- Modify: `README.md`

- [ ] **Step 1: Document the supported remote-access topology**

Write docs that make these points explicit:

- expose only the Next app,
- keep the bridge on loopback,
- prefer HTTPS tunnel endpoints,
- app auth is still required even if edge auth exists,
- QR pairing shares only a short-lived one-time link to the public OmniHarness origin,
- mobile sessions are stored durably and survive server restarts,
- list env vars / secrets needed for auth and Web Push,
- include `ngrok` quick-start and stable-tunnel recommendations.

- [ ] **Step 2: Document recovery procedures**

Include:

- how to rotate the password hash,
- how to rotate the session secret,
- how to revoke one paired device without logging out every device,
- how to regenerate VAPID keys,
- how to recover from expired or broken subscriptions.

- [ ] **Step 3: Verify docs reference the real implementation**

Run:

```bash
rg -n "bridge|loopback|password|session|pair|QR|VAPID|push|PWA|ngrok|Cloudflare" README.md docs/remote-access.md
```

Expected: the docs accurately reflect the implemented topology and secrets.

## Task 9: Final Verification And Review

**Files:**

- Review all files touched above

- [ ] **Step 1: Run the targeted automated checks**

Run:

```bash
pnpm test -- tests/auth/password.test.ts tests/auth/session.test.ts tests/auth/pairing.test.ts tests/api/auth-route.test.ts tests/api/pairing-route.test.ts tests/api/events-auth.test.ts tests/api/notifications-route.test.ts tests/ui/login-shell.test.ts tests/ui/pair-device-dialog.test.ts tests/ui/pwa-bootstrap.test.ts
pnpm test:e2e -- tests/e2e/remote-auth.spec.ts tests/e2e/mobile-pairing.spec.ts tests/e2e/pwa-shell.spec.ts
```

Expected: targeted auth, pairing, push, UI, and PWA coverage passes.

- [ ] **Step 2: Run broader regression checks**

Run:

```bash
pnpm test -- tests/supervisor/index.test.ts tests/supervisor/observer.test.ts tests/workers/monitor.test.ts tests/e2e/mobile-layout.spec.ts
```

Expected: remote-access work does not regress the existing mobile shell or supervisor runtime behavior.

- [ ] **Step 3: Review the final diff**

Run:

```bash
git diff -- middleware.ts src/app/layout.tsx src/app/page.tsx src/app/api/auth/login/route.ts src/app/api/auth/logout/route.ts src/app/api/auth/session/route.ts src/app/api/auth/pair/route.ts src/app/api/auth/pair/redeem/route.ts src/app/api/events/route.ts src/app/api/notifications/subscribe/route.ts src/app/api/notifications/unsubscribe/route.ts src/components/LoginShell.tsx src/components/PairDeviceDialog.tsx src/components/NotificationSettings.tsx src/components/PwaBootstrap.tsx src/server/auth/config.ts src/server/auth/password.ts src/server/auth/session.ts src/server/auth/pairing.ts src/server/auth/guards.ts src/server/auth/audit.ts src/server/notifications/web-push.ts src/server/notifications/preferences.ts src/server/notifications/deliver.ts src/server/notifications/triggers.ts src/server/db/schema.ts src/server/db/index.ts public/manifest.webmanifest public/sw.js docs/remote-access.md README.md docs/superpowers/specs/2026-04-23-remote-access-pwa-design.md docs/superpowers/plans/2026-04-23-remote-access-pwa.md
```

Expected: the diff shows one coherent remote-access slice with clear auth boundaries, QR pairing, durable sessions, PWA behavior, and notification plumbing.
