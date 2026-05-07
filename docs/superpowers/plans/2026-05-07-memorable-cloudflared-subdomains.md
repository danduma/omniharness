# Memorable Cloudflared Subdomains Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each OmniHarness installation a permanent, automatically generated, memorable three-word hostname like `solar-maple-signal.app.omniharness.dev` that tunnels phone traffic to the user's local OmniHarness web app through Cloudflare Tunnel.

**Architecture:** Add a hosted OmniHarness remote-access control plane that owns slug allocation, Cloudflare named tunnel provisioning, DNS records, token rotation, and billing/account ownership. The local OmniHarness app becomes a tunnel client: it stores only its assigned remote installation id, public origin, and scoped tunnel token, runs `cloudflared` against `http://127.0.0.1:3050`, and feeds the active public origin into the existing QR pairing flow. The ACP bridge remains private on loopback; only the Next.js web app is exposed.

**Tech Stack:** Next.js 15, React, TypeScript, SQLite/Drizzle for local state, hosted persistence for remote installations, Cloudflare Tunnel API, Cloudflare DNS API, `cloudflared`, encrypted settings, existing OmniHarness auth and QR pairing, Vitest, Playwright.

**North Star Product:** Remote access feels like claiming a personal agent address rather than configuring networking: a user clicks "Enable remote access", receives a delightful permanent URL, scans a phone QR, installs the PWA, and can supervise agents from anywhere.

**Current Milestone:** Ship the Cloudflare named-tunnel path with generated three-word hostnames under `app.omniharness.dev`, complete provisioning, local connector lifecycle, public-origin handoff, phone pairing, status UI, diagnostics, and token revocation/regeneration.

**Later Milestones / Deferred But Intentional:** Omni Relay on Cloudflare Workers and Durable Objects, custom domains, user-selected slug edits, organization/team hostnames, read-only share links, fleet management, usage-based billing enforcement, and multi-device native apps.

**Final Functionality Standard:** A real hosted control plane provisions a real Cloudflare named tunnel and DNS record; a real local OmniHarness installation starts `cloudflared`; the public hostname reaches the local web app; existing login, SSE, QR pairing, PWA, and session flows work through that hostname; failures are explicit in UI, logs, and a scriptable status path. Quick tunnels, mocked tunnel responses, canned DNS records, and placeholder success states do not count as delivery.

---

## Product Commitments

### User Stories

As a builder, I want OmniHarness to generate a memorable remote address for me, so I can open it from my phone without copying a random tunnel URL.

As a builder, I want that address to be permanent across restarts, network changes, and laptop reboots, so my phone bookmark and installed PWA keep working.

As a builder, I want setup to feel immediate: enable remote access, wait for health, scan QR, and land in my authenticated mobile session.

As a builder, I want remote status to explain whether the hostname, Cloudflare tunnel, local web app, agent runtime, auth, or pairing token is failing.

As a paying customer, I want my slug and tunnel to belong to my account and survive local app reinstall, while still allowing token revocation if my machine is lost.

### Slug Experience

The default generated hostname format is:

```text
<adjective>-<noun>-<noun>.app.omniharness.dev
```

Examples:

```text
lunar-copper-harbor.app.omniharness.dev
quiet-neon-signal.app.omniharness.dev
mint-paper-orbit.app.omniharness.dev
silver-river-echo.app.omniharness.dev
velvet-spark-cabin.app.omniharness.dev
```

Slug rules:

- Lowercase ASCII only.
- Labels contain only `a-z`, `0-9`, and `-`.
- Three curated words joined by hyphens.
- Maximum slug length: 40 characters.
- Maximum full hostname length: 63 characters per DNS label and 253 characters overall.
- No profanity, slurs, adult terms, political terms, medical terms, trademarks, auth/security words, scary operational terms, or misleading reserved words.
- Avoid homophones and visually confusing words where possible.
- Avoid words that imply official status, such as `admin`, `root`, `staff`, `support`, `billing`, `login`, `secure`, or `omni`.
- If collision rate becomes noticeable, add a fourth short word only as a controlled fallback, not as the default experience.

The slug is a user-facing handle, not the security boundary and not the primary identity. The immutable identity is a server-issued remote installation id.

### Trust Boundary

Only the local Next.js app is published through Cloudflare Tunnel:

```text
public phone browser
  -> https://<slug>.app.omniharness.dev
  -> Cloudflare edge
  -> Cloudflare Tunnel
  -> cloudflared on user's laptop or VPS
  -> http://127.0.0.1:3050
  -> OmniHarness Next.js app
  -> server-side calls to private ACP bridge on loopback
```

The ACP/runtime bridge remains private:

```text
http://127.0.0.1:7800
```

The public hostname is convenience and routing, not authentication. Existing OmniHarness app auth, durable sessions, same-origin checks, and QR pairing remain mandatory.

---

## State And Persistence Model

### Hosted Control Plane Records

Create a hosted control-plane persistence model for remote installations. This may live in a separate deployment database if the commercial service is split from the local app; if this repo owns that deployment, keep the model under server modules and do not mix hosted records with local conversation records.

Required conceptual table:

```ts
remote_installations {
  id: string;                  // immutable UUID
  ownerAccountId: string;       // billing/account owner
  slug: string;                 // "solar-maple-signal"
  hostname: string;             // "solar-maple-signal.app.omniharness.dev"
  cloudflareAccountId: string;
  cloudflareZoneId: string;
  cloudflareTunnelId: string;
  cloudflareTunnelName: string;
  dnsRecordId: string | null;
  tunnelTokenVersion: number;
  tunnelTokenLastIssuedAt: Date | null;
  status: "reserved" | "provisioning" | "active" | "degraded" | "revoked";
  lastConnectorSeenAt: Date | null;
  lastHealthCheckAt: Date | null;
  lastHealthCheckStatus: string | null;
  createdAt: Date;
  updatedAt: Date;
  revokedAt: Date | null;
}
```

Required hosted audit events:

```ts
remote_access_events {
  id: string;
  installationId: string | null;
  ownerAccountId: string | null;
  eventType: string;
  detailsJson: string;
  createdAt: Date;
}
```

Audit events must include:

- slug reserved,
- slug collision,
- tunnel created,
- tunnel token issued,
- DNS record created,
- provisioning failed,
- connector heartbeat received,
- public reachability check passed or failed,
- token rotated,
- installation revoked,
- hostname reassigned or released.

### Local OmniHarness Records

Use local encrypted settings for client-side remote access state:

```text
remoteAccess.installationId
remoteAccess.publicOrigin
remoteAccess.slug
remoteAccess.hostname
remoteAccess.provider = "cloudflared_named_tunnel"
remoteAccess.statusSnapshot
remoteAccess.lastHealthyAt
remoteAccess.lastError
remoteAccess.cloudflareTunnelToken // encrypted secret
remoteAccess.tunnelTokenVersion
```

Do not store Cloudflare account API tokens locally for the Omni-managed flow. The local app receives only a scoped tunnel token for its own tunnel.

The existing `settings` table and encrypted setting helpers are acceptable for local storage. If remote-access state grows beyond simple settings, create a dedicated local table rather than spreading related state across unrelated setting keys.

### Frontend State Ownership

Create a remote access Manager as the single source of truth for frontend remote status and actions. Components subscribe to the Manager and call Manager methods; do not introduce independent arrays or scattered `useState` sources for the same remote status.

Expected Manager responsibilities:

- load local remote access status,
- start provisioning,
- start/stop local connector,
- rotate token,
- copy public URL,
- expose health, errors, and diagnostics,
- notify `PairDeviceDialog` when the active public origin is healthy or stale.

---

## File Map

### Create

- `src/lib/remote-access-slugs.ts`: shared slug validation, normalization, reserved-word checks, and generated slug display helpers.
- `src/server/remote-access/word-lists.ts`: curated word lists and banned words for slug generation.
- `src/server/remote-access/slug-generator.ts`: deterministic, testable three-word slug generation and collision retry logic.
- `src/server/remote-access/cloudflare-client.ts`: Cloudflare API client for named tunnel, tunnel config, DNS record, and token operations.
- `src/server/remote-access/control-plane.ts`: hosted provisioning workflow orchestration and idempotency.
- `src/server/remote-access/local-state.ts`: local encrypted setting read/write helpers for assigned hostname and tunnel token.
- `src/server/remote-access/connector.ts`: local `cloudflared` process lifecycle, log capture, heartbeat, and health check helpers for non-native-wrapper runtime.
- `src/server/remote-access/status.ts`: shared remote status model, error codes, and diagnostic payload shaping.
- `src/lib/remote-access-manager.ts`: frontend Manager for remote access state and actions.
- `src/components/home/RemoteAccessPanel.tsx`: remote access status, public URL, enable/disable, reconnect, token rotation, and diagnostics UI.
- `docs/remote-access-cloudflared.md`: user-facing setup, security model, troubleshooting, and billing/product notes.
- `tests/remote-access/slug-generator.test.ts`: generated slug format, banned word filtering, collision retry behavior.
- `tests/remote-access/cloudflare-client.test.ts`: request construction and error mapping using test doubles for HTTP transport only.
- `tests/remote-access/control-plane.test.ts`: idempotent provisioning, rollback, status, and audit behavior.
- `tests/remote-access/local-state.test.ts`: encrypted local setting read/write and migration behavior.
- `tests/remote-access/connector.test.ts`: connector command construction, process state transitions, and health mapping.
- `tests/ui/remote-access-panel.test.tsx`: visible panel states and Manager-driven interactions.
- `tests/e2e/remote-access-cloudflared.spec.ts`: environment-gated real Cloudflare and real `cloudflared` journey.

### Modify

- `src/server/settings/crypto.ts`: mark remote tunnel token setting keys as encrypted.
- `src/server/auth/config.ts`: resolve public origin in this order: healthy local remote-access origin, `OMNIHARNESS_PUBLIC_ORIGIN`, forwarded host/proto, request origin.
- `src/app/api/auth/pair/route.ts`: include remote-origin health in pairing response and refuse to silently generate stale remote QR links.
- `src/app/api/auth/session/route.ts`: expose active public origin and remote-access status to authenticated clients.
- `src/app/api/settings/route.ts`: expose remote-access settings/status without leaking encrypted secrets; accept remote-access actions only if the existing route remains the chosen explicit API surface.
- `src/components/PairDeviceDialog.tsx`: show the active remote hostname, stale/unhealthy warnings, QR origin, copy-link fallback, and pairing status.
- `src/components/home/SettingsDialog.tsx`: add an entry point to remote access without stuffing the full feature into the settings file.
- `src/components/home/HomeHeader.tsx` and `src/components/home/ConversationSidebar.tsx`: add or adjust "Connect phone" and "Remote access" entry points if needed.
- `src/components/component-state-managers.ts`: wire the remote access Manager if this remains the local pattern.
- `src/app/home/HomeApp.tsx`: only narrow wiring; do not add substantial remote-access logic because this file is already over 1700 lines.
- `src/server/db/schema.ts` and `src/server/db/index.ts`: add local remote-access tables only if settings are insufficient after implementation review.
- `README.md`: describe the permanent hostname flow and keep bridge exposure warnings explicit.
- `.gitignore`: confirm local cloudflared logs, tunnel token files, generated diagnostics archives, and local secret files are ignored.

### API Surface Constraint

The repo instruction says not to use file-based routing. Do not add new user-facing pages for this milestone. Prefer extending existing API surfaces and server modules. If implementation needs a new API endpoint despite that constraint, stop and ask for approval before adding a new route file.

### File Growth Constraint

`src/app/home/HomeApp.tsx` is already over 1200 lines. This plan treats any direct addition of substantial remote-access behavior to that file as a refactor trigger. Keep new logic in Manager/server/component files and wire only props, dialog state, or provider registration through the existing shell.

---

## Phase 0: Confirm Cloudflare And Domain Prerequisites

**Purpose:** Make the operational assumptions explicit before writing feature code.

- [ ] **Step 0.1: Confirm Cloudflare zone setup**

Verify that `omniharness.dev` is in the OmniHarness Cloudflare account and that `app.omniharness.dev` can host per-installation subdomains.

Required Cloudflare resources:

- Cloudflare account id,
- zone id for `omniharness.dev`,
- API token scoped to Cloudflare Tunnel edit and DNS edit,
- decision on whether DNS records are individual CNAME records for v1 or wildcard-routed through a Worker in a later milestone.

For v1, use one CNAME per client hostname:

```text
<slug>.app.omniharness.dev CNAME <tunnel-id>.cfargotunnel.com
```

- [ ] **Step 0.2: Confirm local port and service target**

Confirm the public tunnel target is always the local web app:

```text
http://127.0.0.1:3050
```

Do not route public traffic to the ACP bridge. Verify current development defaults:

```bash
rg -n "3050|7800|BRIDGE_URL|OMNIHARNESS_BRIDGE_URL|OMNIHARNESS_PUBLIC_ORIGIN|getPublicOrigin" src scripts README.md
```

- [ ] **Step 0.3: Confirm current pairing origin behavior**

Inspect:

```bash
rg -n "getPublicOriginFromRequest|pairUrl|PairDeviceDialog|auth.pairing_created|auth.pairing_redeemed" src tests
```

Expected: pairing already creates short-lived one-time QR links and only needs a reliable active public origin.

---

## Phase 1: Slug System

**Purpose:** Make memorable names deterministic, safe, collision-resistant, and pleasant.

- [ ] **Step 1.1: Build curated word lists**

Create `src/server/remote-access/word-lists.ts` with:

- adjectives,
- concrete nouns,
- optional place/object nouns,
- banned words,
- reserved labels,
- version metadata for the list.

Start with enough words for a large namespace. Target at least:

- 400 adjectives,
- 600 nouns,
- 600 second-position nouns.

This gives roughly 144 million combinations before reserved filtering. Keep words short and friendly.

- [ ] **Step 1.2: Implement slug validation**

Create `src/lib/remote-access-slugs.ts` with:

- `normalizeRemoteSlug(input: string): string`,
- `isValidRemoteSlug(slug: string): boolean`,
- `validateRemoteHostname(hostname: string): ValidationResult`,
- `containsReservedRemoteWord(slug: string): boolean`,
- `REMOTE_HOSTNAME_SUFFIX = ".app.omniharness.dev"`.

Validation must reject:

- invalid DNS label characters,
- leading/trailing hyphens,
- duplicate hyphens,
- overlong slugs,
- overlong hostnames,
- banned/reserved words,
- non-three-word default generated slugs unless explicitly marked as a future custom slug.

- [ ] **Step 1.3: Implement collision-aware generation**

Create `src/server/remote-access/slug-generator.ts`.

The generator should:

- select one word from each configured bucket,
- validate the final slug,
- call an injected `isSlugAvailable(slug)` function,
- retry with jittered randomness for a bounded number of attempts,
- emit enough metadata for audit logs without exposing randomness internals.

Do not use the slug as a secret. Randomness only reduces collisions and makes names feel varied.

- [ ] **Step 1.4: Test slug behavior**

Run:

```bash
pnpm test -- tests/remote-access/slug-generator.test.ts
```

Expected coverage:

- all generated slugs match the format,
- banned words never appear,
- collisions retry,
- exhausted retries return a precise error,
- generated hostnames end in `.app.omniharness.dev`,
- no generated label violates DNS limits.

---

## Phase 2: Hosted Control Plane Provisioning

**Purpose:** Own permanent hostnames and Cloudflare resources centrally so users never touch Cloudflare setup.

- [ ] **Step 2.1: Define hosted installation model**

Implement the hosted `remote_installations` and `remote_access_events` model in the commercial control-plane persistence layer.

If this repo owns the hosted deployment, place model helpers under:

- `src/server/remote-access/control-plane.ts`,
- `src/server/remote-access/status.ts`.

Keep this model separate from local conversation persistence. A local laptop should not be authoritative for slug ownership.

- [ ] **Step 2.2: Implement Cloudflare API client**

Create `src/server/remote-access/cloudflare-client.ts`.

Required operations:

- create named tunnel,
- get named tunnel,
- delete or revoke named tunnel,
- issue/read tunnel token if supported by the current Cloudflare API flow,
- put tunnel ingress configuration,
- create proxied DNS CNAME record,
- update DNS record,
- delete DNS record,
- fetch DNS record by hostname,
- map Cloudflare API errors into stable product error codes.

Tunnel ingress for each installation should route:

```json
{
  "hostname": "<slug>.app.omniharness.dev",
  "service": "http://localhost:3050",
  "originRequest": {}
}
```

The final ingress rule must be a catch-all 404:

```json
{ "service": "http_status:404" }
```

- [ ] **Step 2.3: Implement idempotent provisioning workflow**

Create a provisioning function equivalent to:

```ts
provisionRemoteInstallation(ownerAccountId: string): Promise<ProvisionedInstallation>
```

Required behavior:

1. Allocate immutable installation id.
2. Generate and reserve slug in hosted DB.
3. Create Cloudflare named tunnel with a stable name like `omni-<installation-id>`.
4. Configure tunnel ingress for the generated hostname.
5. Create DNS CNAME to `<tunnel-id>.cfargotunnel.com`.
6. Issue or return scoped tunnel token.
7. Mark installation active only after Cloudflare resources are confirmed.
8. Emit audit events for each state transition.

The workflow must be idempotent:

- If tunnel creation succeeds but DNS creation fails, retry should reuse the same installation and tunnel.
- If DNS already exists for the same installation, treat it as success.
- If DNS exists for a different installation, mark collision/blocked and generate a new slug.
- If final activation fails, leave a precise provisioning error and do not return fake success.

- [ ] **Step 2.4: Implement revoke and token rotation**

Required operations:

- rotate tunnel token for an active installation,
- revoke installation,
- disable DNS or tunnel routing on revoke,
- preserve slug ownership history unless account deletion policy requires release,
- update local clients with token version changes.

Rotation should not change the public hostname.

- [ ] **Step 2.5: Verify control-plane behavior**

Run:

```bash
pnpm test -- tests/remote-access/cloudflare-client.test.ts tests/remote-access/control-plane.test.ts
```

Expected:

- Cloudflare requests are constructed correctly,
- Cloudflare errors are mapped to stable product errors,
- provisioning is retry-safe,
- rollback/degraded states are explicit,
- audit events are emitted,
- tokens are never logged.

---

## Phase 3: Local Remote Access State And Connector

**Purpose:** Let a local OmniHarness install claim, store, start, stop, and inspect its permanent tunnel.

- [ ] **Step 3.1: Add local encrypted state helpers**

Create `src/server/remote-access/local-state.ts`.

Responsibilities:

- read current assigned hostname,
- write assigned installation metadata,
- write encrypted tunnel token,
- clear local token on revoke,
- expose a redacted status snapshot,
- migrate old `OMNIHARNESS_PUBLIC_ORIGIN` usage into managed origin only when explicitly enabled.

Modify `src/server/settings/crypto.ts` so tunnel token setting keys are encrypted.

- [ ] **Step 3.2: Implement local provisioning client**

Add a local client that calls the hosted control plane to:

- claim a remote installation,
- refresh assignment,
- rotate token,
- report connector heartbeat,
- report local app version and health summary.

Do not put the hosted Cloudflare API token in the local app.

- [ ] **Step 3.3: Implement `cloudflared` connector lifecycle**

Create `src/server/remote-access/connector.ts`.

Responsibilities:

- locate `cloudflared` on PATH or configured binary path,
- start `cloudflared tunnel --no-autoupdate run --token <token>`,
- capture stderr/stdout logs into a bounded in-memory ring buffer and optional ignored local log file,
- detect healthy connection,
- detect process exit,
- stop connector gracefully,
- restart with backoff if enabled,
- expose precise errors for missing binary, invalid token, DNS pending, tunnel unhealthy, local port unreachable, and auth misconfiguration.

Do not write token values to logs, diagnostics, UI, tests, or error messages.

- [ ] **Step 3.4: Add external reachability check**

After starting the connector, validate:

```text
https://<slug>.app.omniharness.dev/api/auth/session
```

Expected responses:

- `200` with session when already authenticated,
- `401` or locked/session-required response when not authenticated,
- not a Cloudflare 1016/1033/tunnel unavailable response,
- not a connection timeout.

Remote access is not "healthy" until Cloudflare edge can reach the local app.

- [ ] **Step 3.5: Verify local state and connector**

Run:

```bash
pnpm test -- tests/remote-access/local-state.test.ts tests/remote-access/connector.test.ts
```

Expected:

- tunnel token is encrypted at rest,
- status snapshots redact secrets,
- connector command uses token safely,
- missing binary and invalid token states are explicit,
- health check gates active status.

---

## Phase 4: Public Origin Integration And Pairing

**Purpose:** Make the existing phone QR flow use the managed hostname automatically and safely.

- [ ] **Step 4.1: Update public origin resolution**

Modify `src/server/auth/config.ts` so public origin resolution order is:

1. healthy managed remote-access public origin,
2. `OMNIHARNESS_PUBLIC_ORIGIN`,
3. trusted forwarded host/proto,
4. request origin.

A managed origin is healthy only if:

- it was set by local remote-access state,
- the hostname matches the assigned installation hostname,
- the latest connector/reachability state is active,
- it uses HTTPS,
- it ends with `.app.omniharness.dev` for this milestone.

- [ ] **Step 4.2: Update pairing QR behavior**

Modify `src/app/api/auth/pair/route.ts`.

The response should include:

```ts
{
  pairingId: string;
  expiresAt: string;
  pairUrl: string;
  publicOrigin: string;
  publicOriginSource: "managed_remote_access" | "env" | "request";
  remoteAccessStatus?: RemoteAccessStatusSnapshot;
}
```

If the user explicitly opens "Connect phone" while remote access is configured but unhealthy, the API should not silently fall back to localhost. It should return an actionable error or an explicit `originSource` warning that the UI must show before presenting the QR.

- [ ] **Step 4.3: Preserve QR security rules**

Do not change the existing pairing token semantics:

- single-use,
- short-lived,
- hashed at rest,
- no password in QR,
- no bridge URL in QR,
- no long-lived tunnel token in QR.

- [ ] **Step 4.4: Test pairing integration**

Run:

```bash
pnpm test -- tests/auth/pairing.test.ts tests/api/pairing-route.test.ts tests/remote-access/local-state.test.ts
```

Expected:

- managed origin is preferred when healthy,
- stale managed origin does not create a misleading QR,
- env origin still works for advanced/manual setups,
- pairing redemption creates durable mobile sessions exactly as before.

---

## Phase 5: Remote Access UI

**Purpose:** Turn provisioning and tunneling into a delightful product flow rather than a networking task.

- [ ] **Step 5.1: Build Manager-owned frontend state**

Create `src/lib/remote-access-manager.ts`.

State should include:

- `status`,
- `hostname`,
- `publicOrigin`,
- `slug`,
- `isProvisioning`,
- `isConnectorRunning`,
- `lastHealthyAt`,
- `lastError`,
- `diagnostics`,
- `tokenRotationState`,
- `copyState`.

Actions should include:

- `loadStatus`,
- `enableRemoteAccess`,
- `startConnector`,
- `stopConnector`,
- `reconnect`,
- `rotateToken`,
- `copyPublicUrl`,
- `openDiagnostics`.

Components must subscribe to this Manager and not duplicate remote state.

- [ ] **Step 5.2: Build remote access panel**

Create `src/components/home/RemoteAccessPanel.tsx`.

Required states:

- not configured,
- provisioning,
- claiming address,
- DNS/tunnel propagating,
- connector starting,
- active,
- degraded,
- reconnecting,
- token expired or revoked,
- local app unreachable,
- Cloudflare unreachable,
- auth not configured,
- cloudflared missing,
- disabled/revoked.

Required UI elements:

- public hostname with copy button,
- connection status,
- last healthy time,
- setup CTA,
- reconnect CTA,
- rotate token CTA,
- disable/revoke CTA with confirmation,
- diagnostics expander,
- "Connect phone" CTA when active.

No marketing hero or decorative card-heavy layout. This is an operational control surface.

- [ ] **Step 5.3: Update Pair Device dialog**

Modify `src/components/PairDeviceDialog.tsx`.

Show:

- QR destination hostname,
- remote health status,
- countdown,
- copy link fallback,
- warning if QR is using request/env origin instead of managed remote origin,
- explicit expired/redeemed state.

If remote access is active, the QR should feel like the natural next step:

```text
Scan to open solar-maple-signal.app.omniharness.dev
```

- [ ] **Step 5.4: Wire entry points without growing HomeApp**

Modify only narrow wiring in:

- `src/components/home/SettingsDialog.tsx`,
- `src/components/home/HomeHeader.tsx`,
- `src/components/home/ConversationSidebar.tsx`,
- `src/app/home/HomeApp.tsx`.

If `HomeApp.tsx` needs substantial logic, split a remote-access container/hook/Manager integration instead of adding more inline behavior.

- [ ] **Step 5.5: Verify UI behavior**

Run:

```bash
pnpm test -- tests/ui/remote-access-panel.test.tsx tests/ui/pair-device-dialog.test.tsx
```

Expected:

- each status renders a clear state,
- no token or secret appears,
- QR origin is visible,
- unhealthy remote access blocks or warns before QR display,
- Manager actions drive state transitions.

---

## Phase 6: Diagnostics And Scriptable Control Plane

**Purpose:** Make tunnel issues inspectable without guessing.

- [ ] **Step 6.1: Add local diagnostics model**

Expose a redacted diagnostic payload with:

- local app origin,
- public origin,
- assigned hostname,
- slug,
- connector process status,
- cloudflared binary path/version,
- last connector logs with secrets redacted,
- last Cloudflare edge reachability result,
- last auth/session endpoint result,
- local bridge privacy check,
- last pairing QR origin,
- last pairing token status,
- last error code and detail.

- [ ] **Step 6.2: Add CLI-readable status**

Extend the existing CLI or add a scriptable command path that can print:

```bash
omniharness remote status --json
omniharness remote reconnect
omniharness remote rotate-token
omniharness remote diagnostics --redacted
```

If CLI expansion is too broad for this milestone, add a script under `scripts/` with the same functionality and document the intentional deferral of first-class CLI integration.

- [ ] **Step 6.3: Add audit events**

Persist meaningful local events:

- remote provisioning requested,
- assignment saved,
- connector started,
- connector healthy,
- connector exited,
- reachability failed,
- public origin changed,
- QR generated against managed hostname,
- QR generated against fallback origin,
- token rotated,
- remote access disabled.

Do not persist prompts, file contents, worker output payloads, session cookies, pairing token plaintext, or tunnel tokens in diagnostics/audit details.

- [ ] **Step 6.4: Verify diagnostics**

Run:

```bash
pnpm test -- tests/remote-access/connector.test.ts tests/remote-access/local-state.test.ts
```

Then manually verify the scriptable status command once implemented:

```bash
omniharness remote status --json
```

Expected: status is machine-readable, secrets are redacted, and failure reasons are precise.

---

## Phase 7: Real End-To-End Cloudflared Journey

**Purpose:** Prove the feature works with real Cloudflare infrastructure and real phone-browser behavior.

- [ ] **Step 7.1: Add environment-gated e2e test**

Create `tests/e2e/remote-access-cloudflared.spec.ts`.

Required environment variables:

```text
OMNIHARNESS_E2E_CLOUDFLARE=1
OMNIHARNESS_E2E_ACCOUNT_ID
OMNIHARNESS_E2E_ZONE_ID
OMNIHARNESS_E2E_API_TOKEN
OMNIHARNESS_E2E_DOMAIN_SUFFIX=app.omniharness.dev
```

Skip the test unless the flag and credentials are present.

- [ ] **Step 7.2: Test full provisioning and pairing**

The e2e should:

1. Start local OmniHarness.
2. Enable auth.
3. Request remote access provisioning.
4. Wait for Cloudflare DNS/tunnel readiness.
5. Start real `cloudflared`.
6. Open the generated public URL in a separate browser context.
7. Confirm login shell appears.
8. Generate a Connect Phone QR/link from an authenticated desktop context.
9. Redeem pairing link in a mobile-sized browser context.
10. Confirm durable mobile session reaches the app.
11. Confirm `/api/events` streams or connects without quick-tunnel limitations.
12. Clean up Cloudflare resources for test-created installations.

- [ ] **Step 7.3: Test failure and recovery**

Cover:

- kill `cloudflared` and verify degraded UI,
- restart connector and verify healthy UI,
- rotate token and verify old connector can no longer connect,
- revoke installation and verify public URL no longer reaches app,
- generate QR during degraded state and verify explicit warning/error.

- [ ] **Step 7.4: Run deterministic and gated checks**

Always run:

```bash
pnpm test -- tests/remote-access tests/auth tests/api tests/ui
pnpm build
```

With credentials and explicit approval, run:

```bash
pnpm test:e2e -- tests/e2e/remote-access-cloudflared.spec.ts
```

Expected: real public hostname reaches the local app and mobile pairing works end-to-end.

---

## Phase 8: Documentation, Security Review, And Release Readiness

**Purpose:** Make the feature trustworthy enough to monetize.

- [ ] **Step 8.1: Document the product flow**

Create `docs/remote-access-cloudflared.md` with:

- what the three-word hostname is,
- why it is permanent,
- what is exposed,
- what remains local/private,
- how QR pairing works,
- what happens when laptop is asleep/offline,
- how to rotate token,
- how to revoke access,
- how billing/account ownership maps to hostname ownership,
- troubleshooting for Cloudflare and local connector errors.

- [ ] **Step 8.2: Update README security section**

Add a concise remote-access warning:

- only expose the web app,
- never expose the ACP bridge,
- keep app auth enabled,
- tunnel URL secrecy is not a security layer,
- use revoke/rotate if a machine or token is compromised.

- [ ] **Step 8.3: Confirm `.gitignore` coverage**

Ensure these are ignored:

```text
.cloudflared/
*.cfargotunnel.json
*.tunnel-token
remote-access-diagnostics*.json
remote-access-diagnostics*.log
.omniharness-auth.key
```

Do not ignore source word lists, tests, or docs.

- [ ] **Step 8.4: Security self-review**

Check:

- no Cloudflare account API token in local app,
- no tunnel token in logs,
- no pairing token plaintext in persistent audit records,
- no bridge URL in QR,
- host validation rejects non-assigned hostnames,
- app auth protects pages/API/SSE,
- mutating routes still enforce same-origin checks,
- revocation disables the tunnel path,
- DNS/tunnel failures are visible.

- [ ] **Step 8.5: Release acceptance**

The milestone is complete when:

- a new installation receives a generated three-word hostname,
- the hostname is permanent and stored by remote installation id,
- Cloudflare named tunnel and DNS are created by the hosted control plane,
- local `cloudflared` connects using a scoped token,
- public URL reaches local OmniHarness,
- phone QR opens the public hostname and redeems into a durable session,
- reconnect, rotate token, revoke, and diagnostics work,
- tests and build pass,
- real Cloudflare e2e passes in the gated environment.

---

## Open Product Decisions Before Implementation

These are the few decisions that should be confirmed before coding:

- Should users be allowed to regenerate their slug in v1, or should v1 keep generated slugs permanent after claim?
- Should revoked slugs be quarantined forever, quarantined for a fixed period, or eventually reusable?
- Is v1 account identity handled by an OmniHarness hosted account service already, or do we need to define the billing/account token flow in this milestone?
- Should the local app auto-start remote access on launch, or should it require a user toggle?
- Should a user be able to run the same remote installation from multiple machines, or should one hostname bind to one active connector at a time?

Recommended defaults:

- no user-edited custom slugs in v1,
- no casual slug regeneration in v1,
- quarantine revoked slugs indefinitely until a deletion policy exists,
- auto-start only after the user explicitly enables "Start remote access on launch",
- one hostname maps to one active connector at a time.
