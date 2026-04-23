# Remote Access, Single-User Auth, Push, And PWA Design

## Goal

Make OmniHarness safely reachable from anywhere on a phone or laptop without exposing the ACP bridge directly.

The remote experience should support:

- single-user password-only access,
- QR-based device pairing from desktop to mobile,
- a mobile-friendly control surface,
- Web Push notifications for important run events,
- installable PWA behavior for a more app-like mobile experience.

## Current State

- OmniHarness is a Next.js app with a single-shell UI in [src/app/page.tsx](/Users/masterman/NLP/omniharness/src/app/page.tsx).
- Live state reaches the frontend through a long-lived SSE endpoint in [src/app/api/events/route.ts](/Users/masterman/NLP/omniharness/src/app/api/events/route.ts).
- The ACP bridge is treated as a local service and is auto-managed in development when it is on `127.0.0.1` or `localhost`.
- Secrets in the `settings` table are already encrypted at rest through [src/server/settings/crypto.ts](/Users/masterman/NLP/omniharness/src/server/settings/crypto.ts).
- There is no app-level login, session model, route protection, service worker, manifest, push subscription persistence, install flow, or QR-based pairing flow.

## Constraints And Assumptions

- OmniHarness remains a single-user system in this milestone. There is no multi-user account model, invitation model, or RBAC.
- The ACP bridge must remain private and bound to loopback; remote users must never talk to the bridge directly.
- The public entrypoint should be HTTPS because notifications, service workers, and installability require a secure context.
- The app already has a mobile-oriented interface; this work should extend that interface instead of creating a separate mobile app.
- The repo should continue to avoid file-based routing decisions beyond what the existing Next app router already uses.
- The design should work with `ngrok` for quick setup, but should not be coupled to any one tunnel provider.

## North Star Product

OmniHarness becomes a persistent personal remote control plane for supervising local coding agents from anywhere: secure remote access, mobile-first visibility, actionable alerts, installable app behavior, and clear operational controls for pausing, recovering, and inspecting long-running work.

## Current Milestone

Deliver a secure remote-access v1:

- app-level single-user password auth,
- desktop-to-mobile pairing QR flow,
- tunnel-friendly deployment guidance,
- protected UI and API access,
- Web Push subscriptions and notifications for high-value events,
- installable PWA shell for mobile use,
- basic operational hardening and auditability.

## Later Milestones / Deferred But Intentional

- optional second factor or device-bound trust,
- multiple notification channels and per-event preferences,
- read-only versus operator modes,
- remote panic controls and safe-mode startup,
- richer offline affordances and background sync,
- multi-user support and approval flows,
- push notification digests and quiet hours.

## User Stories

### Primary stories

As the sole operator, I want to open OmniHarness from my phone while away from my machine, authenticate with a password, and see the live state of my runs and workers.

As the sole operator, I want to receive a push notification when a run fails, finishes, gets stuck, or needs my input so I do not have to babysit the app.

As the sole operator, I want OmniHarness to behave like an installed app on my phone so it is easy to reopen quickly and feels stable during repeated use.

As the sole operator, I want to scan a QR code from the desktop app and have my phone open OmniHarness already paired, without typing the password again on that device.

### Return / revisit stories

As the sole operator, I want the app to reopen into my recent context, reconnect live updates, and deep-link back to the exact run that triggered a notification.

As the sole operator, I want notification preferences and session state to persist sensibly across visits without having to reconfigure the app every time.

As the sole operator, I want a paired phone to stay signed in across server restarts so my mobile control surface does not randomly break.

### Failure / recovery stories

As the sole operator, I want failed logins, expired sessions, offline tunnel conditions, and bridge failures to be explicit rather than leaving the UI in a fake healthy state.

As the sole operator, I want to revoke sessions and recover from a lost or rotated password without exposing the bridge or corrupting existing runs.

## Recommended Architecture

### Trust boundary

Only the Next.js app is published through the tunnel.

The ACP bridge continues to listen on loopback and is never placed on a public hostname. The browser talks only to OmniHarness HTTP routes, and the server continues to broker all bridge communication.

### Exposure model

Support two deployment styles:

- quick-start tunnel: `ngrok` or equivalent HTTPS tunnel to the Next app,
- stable tunnel: custom domain plus Cloudflare Tunnel or equivalent always-on tunnel.

Tunnel choice is transport and edge policy only. OmniHarness itself still owns the login/session model so the remote UX does not depend on the tunnel vendor's auth UI.

### Auth model

Add first-party single-user authentication at the OmniHarness app layer.

Core behavior:

- one password for the whole app,
- password stored only as a strong hash,
- persistent server-backed sessions for browser auth,
- route protection for pages, API routes, and SSE streams,
- logout and session revocation support,
- failed-login throttling and audit events.

Recommended details:

- use Argon2id for password hashing,
- use an opaque session identifier in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie,
- persist session records in SQLite so sessions survive process and server restarts,
- require a separate session secret distinct from the password hash,
- prefer bootstrap through env or local setup rather than unauthenticated first-run web setup.

### Session model

Sessions are per browser/device, stored durably in SQLite, and expire after an inactivity window plus an absolute max lifetime.

The session model should support:

- login,
- logout,
- device labeling,
- device-specific revocation,
- logout-all / session secret rotation,
- re-auth requirement after expiry,
- optional short re-auth gate for destructive actions in a later milestone.

Session records should include at least:

- session id,
- created at,
- last seen at,
- expires at,
- device label,
- user agent summary,
- pairing source such as `password_login` or `qr_pair`,
- revoked at.

If the server restarts, existing unrevoked sessions should remain valid because they are reloaded from SQLite.

### Device pairing model

Add a one-time QR pairing flow from an already authenticated desktop session to a mobile device.

Core behavior:

- the desktop generates a short-lived pairing token,
- the token is encoded into a QR link to the public OmniHarness origin,
- the phone opens the link and redeems the token,
- redemption creates a normal durable mobile session,
- the pairing token is then invalidated.

The pairing URL should look like:

- `https://public-origin/connect?pair=<one-time-token>`

The QR payload may also include optional context such as:

- target run id for deep-linking after redemption,
- device label hint,
- token expiry metadata encoded server-side rather than trusted from the client.

Security rules:

- tokens are single-use,
- tokens expire quickly, such as in 60 to 120 seconds,
- tokens are stored as hashes rather than plaintext when persisted,
- screenshots or delayed replays should fail once the token is used or expired,
- the QR must never contain the password, bridge URL, or a long-lived reusable session secret.

### CSRF / request-trust model

Because the app will use cookies for auth, mutating routes must reject cross-site requests.

For v1:

- require same-origin `Origin` or `Referer` validation on authenticated mutating routes,
- keep session cookies `SameSite=Lax`,
- do not rely on obscurity or tunnel URL secrecy as a security layer.

## UI And Product Surface Design

### Login surface

Add a minimal login screen or locked-state shell in front of the existing app.

Requirements:

- mobile-friendly password entry,
- clear session-expired handling,
- explicit errors for bad credentials and rate limiting,
- no partial access to run or agent data before authentication.

### Remote-ready shell

After login, the existing shell remains the main product surface.

The app should preserve:

- current mobile navigation controls,
- live worker and run visibility,
- direct deep links to `/session/:runId`,
- notification-driven reopen behavior.

### Settings additions

Add a remote-access / notifications section to settings covering:

- whether remote access is configured,
- session status and logout,
- paired device visibility and device revocation,
- push notification permission state,
- subscribe / unsubscribe actions,
- high-level event toggles for notifications,
- install app guidance when the PWA is not yet installed.

### Device pairing surface

Add a desktop-oriented `Connect phone` action inside the authenticated shell.

Requirements:

- opens a modal or panel with a QR code,
- shows token expiry countdown,
- offers a copy-link fallback,
- optionally notes the destination run that the phone will open,
- confirms success or expiry visibly on the desktop side.

On the mobile side, the pairing link should:

- redeem the token,
- create the durable mobile session,
- route into the requested run or default shell,
- then offer install and notification setup guidance.

## Notification Design

### Transport

Use standards-based Web Push with VAPID.

The app stores browser push subscriptions and sends notifications from the server when important events happen. This keeps the mobile experience inside the existing web product and works with installed PWAs on supported platforms.

### Subscription model

Persist subscriptions in the OmniHarness database with enough metadata to manage them safely:

- id,
- endpoint,
- encryption keys,
- device label or user agent summary,
- created / updated timestamps,
- last success / last failure,
- disabled status if the endpoint becomes invalid.

### Initial event set

Trigger push notifications for:

- run completed,
- run failed,
- clarification requested,
- manual approval or permission action needed,
- worker stuck,
- bridge unavailable or supervisor runtime unhealthy.

Each notification should include:

- short title,
- short body,
- run id when applicable,
- event type,
- timestamp,
- deep link target for the app.

### Notification UX rules

- Ask for notification permission only after the user is authenticated and after a user gesture.
- Do not prompt immediately on first page load.
- Start with a small high-value event set to avoid alert fatigue.
- Deep-link notifications back to the relevant run.
- When supported, update the app badge count for actionable unseen events.

## PWA Design

### Installability

Add:

- web app manifest,
- app icons,
- standalone display mode,
- theme metadata,
- service worker registration,
- install prompt handling when supported.

### Service worker scope

The service worker should support installability, push handling, notification clicks, and light shell caching.

This is not an offline-first product in v1. The service worker should cache static shell assets conservatively, but live run control continues to require network access.

### Mobile app behavior

The installed PWA should:

- launch in standalone mode,
- reopen quickly to the last shell state,
- reconnect the live event stream on resume,
- show a clear offline / reconnecting state,
- handle notification clicks by opening the exact run when available.

## State And Persistence Model

### Existing persisted state

Continue to use the existing SQLite-backed app state for runs, workers, messages, settings, clarifications, and events.

### New persisted state

Add durable storage for:

- password hash and auth configuration metadata,
- auth sessions,
- QR pairing tokens,
- push subscriptions,
- notification preferences,
- audit events for auth and subscription changes.

### Browser-local state

Persist in browser storage only low-risk UX state such as:

- last selected run,
- dismissed install prompt state,
- non-secret notification UI state.

Do not store the password, session secret, or any reusable auth token in local storage.

## Operational Readiness

### Deployment readiness

Remote access is only considered ready when:

- the public origin is HTTPS,
- the app is protected by first-party auth,
- the bridge is confirmed private,
- a process manager keeps OmniHarness and the tunnel alive across disconnects or reboots,
- the operator has a recovery path for password/session-secret rotation.

### Health and observability

Add explicit, inspectable events for:

- login success,
- login failure,
- logout,
- session invalidation,
- pairing token created,
- pairing token redeemed,
- pairing token expired or denied,
- notification subscription added / removed,
- notification delivery failure,
- tunnel or runtime health issues surfaced to the UI.

### Recovery expectations

If push delivery fails permanently for a subscription, disable it visibly instead of retrying forever.

If the session is invalid or expired, the app should stop live activity and redirect to login instead of showing stale privileged state.

If a pairing token expires or is already used, the mobile side should fail explicitly and invite the user to generate a fresh code from desktop.

If the tunnel is down, the local app may continue running normally; remote unavailability should not crash the supervisor or bridge.

## Risk And Trust Surfaces

### Major risks

- exposing the ACP bridge directly,
- relying only on tunnel edge auth and forgetting app auth,
- leaking privileged app data through unauthenticated SSE or API routes,
- putting reusable credentials or long-lived sessions directly inside the QR payload,
- over-notifying and training the operator to ignore alerts,
- pretending the app works offline when remote control actually requires connectivity,
- fragile password bootstrap or recovery flows.

### Explicit trust decisions

- App-level auth is mandatory even when the tunnel provider also offers auth.
- The bridge remains local-only.
- Password-only is accepted for this milestone because the product is single-user, but the implementation should not block adding a second factor later.
- Notification prompts are opt-in and delayed until the user has context.

## Testing Strategy

- auth unit tests for hashing, durable session lookup, verification, and cookie parsing,
- auth session tests for expiry, revocation, and restart-safe persistence assumptions,
- pairing-token tests for creation, single-use redemption, expiry, and replay rejection,
- API tests proving unauthenticated requests are rejected,
- API tests proving authenticated requests and SSE streams succeed,
- API tests for pairing QR generation and redemption,
- UI tests for login, logout, expired-session handling, and locked-state shell behavior,
- UI tests for desktop pairing modal states,
- push subscription API tests,
- service worker / PWA smoke tests for manifest, registration, and notification click routing,
- mobile e2e coverage for install-prompt affordance and notification subscription entry points,
- regression tests proving the bridge URL is never exposed as a direct client target.

## Acceptance Criteria

- OmniHarness can be reached through an HTTPS tunnel without exposing the ACP bridge publicly.
- All privileged pages, APIs, and live event streams require a valid authenticated session.
- A single-user password flow works cleanly on mobile.
- A desktop user can generate a short-lived pairing QR and a phone can redeem it into a durable mobile session.
- Mobile sessions remain valid across server restarts unless explicitly revoked or expired.
- Push subscriptions can be created and removed from the app.
- High-value run and worker events can send Web Push notifications that deep-link back into the app.
- OmniHarness is installable as a PWA and behaves correctly in standalone mobile use.
- Failures in auth, push delivery, runtime health, or connectivity are explicit in logs and UI.
