# Native macOS Wrapper And Managed Remote Tunnel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a native macOS OmniHarness wrapper that runs the local app, exposes a first-class remote access control surface, and eventually connects phones through a managed Cloudflare-backed tunnel without asking users to configure ngrok, Cloudflare Tunnel, or Tailscale by hand.

**Architecture:** Build a SwiftUI macOS app that owns local OmniHarness process lifecycle, embeds the existing Next.js UI in a `WKWebView`, and talks to the web app through a small localhost wrapper API. Remote access is modeled as a provider abstraction with three provider families: a practical bundled `cloudflared` provider, an account-owned Tailscale/manual provider, and the north-star Omni Relay provider built on Cloudflare Workers plus Durable Objects. The Cloudflare Worker relay uses outbound WebSockets from the Mac app to a per-device Durable Object, then proxies browser HTTP/SSE traffic over authenticated tunnel frames to the local OmniHarness server.

**Tech Stack:** SwiftUI, AppKit interop where needed, `WKWebView`, Swift `Process`, Keychain, Launch Services/Login Items, TypeScript, Next.js 15, SQLite/Drizzle, Vitest, Playwright, Cloudflare Workers, Durable Objects, WebSockets, `cloudflared`, optional Tailscale/Funnel integration.

**North Star Product:** OmniHarness becomes a native Mac app and personal remote control plane: launch it once on the Mac, scan a QR code from a phone, and supervise local coding agents securely from anywhere with visible health, reconnect, audit, and recovery states.

**Current Milestone:** Deliver the native wrapper plus provider-ready remote access management, with a fully working bundled `cloudflared` path and manual/Tailscale escape hatches. The custom Cloudflare Worker relay is specified and built in later phases as the default no-fiddle experience.

**Later Milestones / Deferred But Intentional:** The Omni Relay Worker/Durable Object network, relay billing/quotas, optional Omni-managed identity, device sharing, read-only remote mode, end-to-end encrypted tunnel payloads beyond TLS, multi-Mac fleet management, and mobile native apps.

**Final Functionality Standard:** The first complete milestone must run OmniHarness from a signed-ish local macOS app, show accurate local/runtime/remote status, configure `OMNIHARNESS_PUBLIC_ORIGIN` automatically when a provider is active, generate existing pairing QR codes against the active public origin, recover cleanly from process and tunnel failures, and provide deterministic diagnostics. The custom Cloudflare relay is not presented as delivered until real remote browser traffic can traverse the relay to a local OmniHarness instance without mock tunnels, canned responses, or fake success states.

---

## Product Scope

### Primary User Stories

As a builder, I want to launch OmniHarness like a normal Mac app, so I do not have to remember terminal commands before supervising agents.

As a builder, I want remote access to show a clear status, public URL, and failure reason, so I know whether my phone can reach the running app.

As a builder, I want the Mac app to handle the tunnel setup and public origin for me, so pairing a phone is a product flow rather than a networking project.

As a builder, I want to choose between a bundled provider and my own network provider, so I can trade convenience, privacy, cost, and account ownership deliberately.

As a builder away from the Mac, I want the existing OmniHarness auth, pairing, PWA, and notification flows to work through the tunnel without exposing the local agent runtime directly.

### Return And Recovery Stories

As a returning builder, I want the wrapper to remember my chosen provider, local app path, ports, and public origin mapping, so remote access survives app restarts.

As a builder debugging access, I want a diagnostic panel and CLI-readable status output, so I can tell whether the local server, runtime, tunnel connector, relay, auth, or phone path is failing.

As a builder changing providers, I want the old public origin and tunnel process to be stopped before the new one starts, so QR links and sessions do not point at stale endpoints.

### Trust And Risk Boundaries

Only the OmniHarness web server is exposed remotely. The internal agent runtime stays loopback-only, and the remote browser never talks directly to the ACP/runtime port.

The existing app-layer auth remains mandatory. Tunnel provider auth, Cloudflare account auth, or Tailscale network membership is defense in depth, not a replacement for OmniHarness sessions.

Long-lived provider tokens live in macOS Keychain or encrypted OmniHarness settings. Pairing QR codes remain short-lived and single-use.

The wrapper must never report remote access as healthy unless an actual external reachability check or provider health signal has succeeded.

## Provider Strategy

### Provider 1: Bundled `cloudflared` Provider

This is the first practical provider because it can be shipped quickly and relies on a stable connector instead of a brand-new protocol.

The Mac app owns:

- locating or bundling the `cloudflared` binary,
- requesting the needed Cloudflare token/API credentials from the user,
- creating or selecting the tunnel configuration,
- starting and stopping the connector process,
- reading connector logs and health,
- setting `OMNIHARNESS_PUBLIC_ORIGIN`,
- showing setup, connected, degraded, and failed states.

User burden:

- the user needs a Cloudflare account,
- depending on the final Cloudflare flow, the user may need a zone/domain or token,
- the user does not manually run `cloudflared`, copy URLs, or edit env vars.

### Provider 2: Tailscale / Manual Provider

This is an account-owned power-user path.

The Mac app owns:

- detecting whether Tailscale is installed,
- showing Tailnet/Funnel status where available,
- accepting a manually supplied public URL,
- validating that the URL reaches this OmniHarness instance,
- setting `OMNIHARNESS_PUBLIC_ORIGIN` only after validation.

User burden:

- the user manages Tailscale account/policy/Funnel availability,
- this provider is private-network friendly but is not the default no-account OmniHarness flow.

### Provider 3: Omni Relay On Cloudflare Workers And Durable Objects

This is the north-star default.

The Mac app opens an authenticated outbound WebSocket to a Cloudflare Worker. The Worker routes the connection to a Durable Object representing the user/device/session. Remote browsers connect to stable relay URLs, and the Durable Object multiplexes HTTP requests, SSE streams, and selected WebSocket-like traffic over the Mac app's outbound tunnel.

The protocol must support:

- device registration and relay session authorization,
- request/response multiplexing,
- streamed response bodies,
- SSE passthrough for `/api/events`,
- heartbeats and reconnect resume semantics,
- backpressure and payload limits,
- error frames with visible causes,
- public origin discovery,
- relay-side access logs with sensitive payload redaction,
- local denylist protection so only the OmniHarness web port can be reached.

The relay may be deployed either as an Omni-owned Cloudflare project or as a bring-your-own Cloudflare deployment. The product default should target Omni-owned deployment if we want the cleanest user experience; bring-your-own Cloudflare can remain an advanced mode if billing or distribution requires it.

## State And Persistence Model

### macOS Wrapper State

Persist in app preferences:

- selected provider id,
- local web port,
- local runtime port,
- launch-at-login preference,
- start-remote-on-launch preference,
- last known public origin,
- last known local app root,
- wrapper UI preferences such as selected sidebar section.

Store in Keychain:

- Cloudflare API token or scoped tunnel token,
- Tailscale auth material if any is ever accepted,
- Omni Relay device private key or refresh token,
- wrapper-to-local control secret.

Do not store provider secrets in `.env`, plain JSON, localStorage, or unencrypted settings.

### Web App State

Extend existing OmniHarness settings/auth data with:

- active public origin,
- remote provider status snapshot,
- wrapper-managed mode flag,
- remote diagnostics events,
- provider-visible audit records.

The web app should read remote status from a Manager-backed single source of truth on the frontend. Components subscribe to the manager and call manager methods rather than owning separate local state arrays.

### Relay State

Persist or derive in Cloudflare:

- device id,
- relay session id,
- current tunnel connection id,
- public host/path mapping,
- connection heartbeat timestamps,
- rate-limit counters,
- recent redacted diagnostics.

Do not persist OmniHarness session cookies, pairing token plaintext, prompt content, file content, worker output payloads, or ACP/runtime secrets in relay storage.

## File Map

### Create

- `macos/OmniHarnessMac/Package.swift`: SwiftPM package for the native app if SwiftPM is chosen for the first wrapper milestone.
- `macos/OmniHarnessMac/Sources/OmniHarnessMac/App/OmniHarnessMacApp.swift`: app entrypoint, main window scene, settings scene, and menu commands.
- `macos/OmniHarnessMac/Sources/OmniHarnessMac/Views/ContentView.swift`: root native layout and wrapper status composition.
- `macos/OmniHarnessMac/Sources/OmniHarnessMac/Views/WebShellView.swift`: `WKWebView` host for the local OmniHarness UI.
- `macos/OmniHarnessMac/Sources/OmniHarnessMac/Views/RemoteAccessView.swift`: native remote access status, provider selection, public URL, and diagnostics.
- `macos/OmniHarnessMac/Sources/OmniHarnessMac/Views/SettingsView.swift`: wrapper settings for ports, launch behavior, provider defaults, and diagnostics controls.
- `macos/OmniHarnessMac/Sources/OmniHarnessMac/Models/WrapperState.swift`: app-wide observable wrapper state.
- `macos/OmniHarnessMac/Sources/OmniHarnessMac/Models/RemoteProvider.swift`: provider ids, statuses, capabilities, and user-facing state.
- `macos/OmniHarnessMac/Sources/OmniHarnessMac/Services/ProcessSupervisor.swift`: starts/stops OmniHarness web/runtime processes, captures logs, restarts safely.
- `macos/OmniHarnessMac/Sources/OmniHarnessMac/Services/LocalServerProbe.swift`: checks localhost web/runtime readiness and version metadata.
- `macos/OmniHarnessMac/Sources/OmniHarnessMac/Services/RemoteAccessManager.swift`: single owner for selected provider lifecycle.
- `macos/OmniHarnessMac/Sources/OmniHarnessMac/Services/CloudflaredProvider.swift`: bundled Cloudflare Tunnel connector provider.
- `macos/OmniHarnessMac/Sources/OmniHarnessMac/Services/TailscaleProvider.swift`: Tailscale/manual public URL provider.
- `macos/OmniHarnessMac/Sources/OmniHarnessMac/Services/OmniRelayProvider.swift`: client for the custom Worker/Durable Object relay.
- `macos/OmniHarnessMac/Sources/OmniHarnessMac/Services/KeychainStore.swift`: secure provider credential storage.
- `macos/OmniHarnessMac/Sources/OmniHarnessMac/Services/WrapperControlClient.swift`: local API client that updates web-app remote settings.
- `macos/OmniHarnessMac/Sources/OmniHarnessMac/Support/LogBuffer.swift`: bounded logs for UI and diagnostics export.
- `macos/OmniHarnessMac/Sources/OmniHarnessMac/Support/PortAllocator.swift`: deterministic free-port selection with conflict reporting.
- `macos/OmniHarnessMac/script/build_and_run.sh`: local build/run script for Codex app execution.
- `macos/OmniHarnessMac/.codex/environments/environment.toml`: run-button bootstrap config for the macOS app.
- `src/server/wrapper/status.ts`: server-side wrapper status model and validation helpers.
- `src/app/api/wrapper/status/route.ts`: local-only route for wrapper status updates and reads.
- `src/app/api/wrapper/remote-origin/route.ts`: local-only route for wrapper-managed public origin updates.
- `src/lib/remote-access-manager.ts`: frontend Manager for remote access status and actions.
- `src/components/home/RemoteAccessPanel.tsx`: web UI panel showing provider status and active public origin.
- `src/server/remote/provider-events.ts`: provider audit and diagnostic event persistence.
- `relay/cloudflare/wrangler.toml`: Cloudflare Worker project config.
- `relay/cloudflare/src/index.ts`: Worker fetch/WebSocket entrypoint.
- `relay/cloudflare/src/relay-object.ts`: Durable Object managing one device/session relay.
- `relay/cloudflare/src/protocol.ts`: relay frame types, validation, and error codes.
- `relay/cloudflare/src/auth.ts`: relay device auth and request signing.
- `relay/cloudflare/test/relay-protocol.test.ts`: protocol validation tests.
- `relay/cloudflare/test/relay-object.test.ts`: Durable Object routing and reconnect tests.
- `tests/server/wrapper-status.test.ts`: local wrapper route and status tests.
- `tests/ui/remote-access-panel.test.tsx`: web UI remote status tests.
- `tests/e2e/remote-provider-cloudflared.spec.ts`: approval-gated or environment-gated cloudflared provider journey.
- `tests/e2e/omni-relay.spec.ts`: relay end-to-end journey against local Worker dev environment.
- `docs/native-macos-wrapper.md`: user-facing wrapper setup and troubleshooting docs.
- `docs/remote-providers.md`: provider comparison and setup docs.

### Modify

- `package.json`: add scripts for relay tests/dev where needed.
- `README.md`: describe native wrapper, provider choices, and the no-manual-tunnel product direction.
- `src/server/auth/config.ts`: allow wrapper-managed public origin to override request-derived origin safely.
- `src/app/api/auth/pair/route.ts`: ensure pairing QR uses the active wrapper-managed origin when present and valid.
- `src/components/PairDeviceDialog.tsx`: show remote provider health when generating QR codes.
- `src/components/home/SettingsDialog.tsx`: add remote provider status and settings entrypoint if the web UI owns part of the surface.
- `src/components/component-state-managers.ts`: add remote access manager wiring if existing patterns centralize component managers there.
- `src/server/db/schema.ts` and `src/server/db/index.ts`: add remote provider status/audit tables if status needs durable persistence.
- `playwright.config.ts`: include remote provider e2e setup projects when explicitly enabled.

### Tests To Add Or Update

- Swift unit tests for process supervision, port allocation, provider state transitions, and Keychain error handling.
- Swift integration tests for `WKWebView` launch readiness where feasible.
- Vitest tests for wrapper status route validation and public-origin selection.
- Vitest tests for relay protocol frame validation, multiplexing, request completion, stream cancellation, and heartbeat timeouts.
- Playwright tests for remote access panel states, QR generation against active public origin, and local-to-relay e2e paths.
- Environment-gated tests for real `cloudflared` and Tailscale detection, skipped unless credentials/tools are present.

### Candidate Agentic User Journey Tests

These require explicit user approval before running:

- **Native launch journey:** open the macOS wrapper, wait for local OmniHarness to become ready, start a conversation, close/reopen wrapper, confirm the web UI and runtime recover.
- **Cloudflared journey:** configure a test Cloudflare tunnel credential, start remote access from the wrapper, open the public URL in a separate browser context, log in, and redeem a pairing QR.
- **Relay journey:** run local Worker dev, start `OmniRelayProvider`, open the relay URL in a browser context, stream `/api/events`, send a message, and verify the local run updates remotely.
- **Failure journey:** kill the tunnel connector or Worker dev process and confirm wrapper, web UI, and QR dialog show explicit degraded states rather than stale success.

## Phase 0: Confirm Existing Remote Access Baseline

**Purpose:** Establish the exact state of auth, pairing, PWA, and public-origin handling before the wrapper work begins.

**Files:**

- Inspect: `src/server/auth/config.ts`
- Inspect: `src/app/api/auth/pair/route.ts`
- Inspect: `src/components/PairDeviceDialog.tsx`
- Inspect: `src/server/db/schema.ts`
- Inspect: `docs/superpowers/plans/2026-04-23-remote-access-pwa.md`

- [ ] **Step 0.1: Verify the web-side remote access pieces**

Run:

```bash
rg -n "OMNIHARNESS_PUBLIC_ORIGIN|getPublicOrigin|pairUrl|auth_sessions|auth_pair_tokens|PairDeviceDialog" src tests docs
```

Expected: auth session, pairing, and public-origin logic are already present and can be reused.

- [ ] **Step 0.2: Run focused existing tests**

Run the existing tests that cover auth, pairing, events, and PWA surfaces.

```bash
pnpm test -- tests/auth tests/api tests/ui
```

If the repository test layout differs, use `rg --files tests | rg "(auth|pair|events|pwa|remote)"` and run the focused available set.

- [ ] **Step 0.3: Record gaps**

Update this plan or add a short note under `docs/native-macos-wrapper.md` identifying:

- whether auth is fully implemented,
- whether PWA notifications are fully implemented,
- whether `OMNIHARNESS_PUBLIC_ORIGIN` can be changed at runtime,
- whether any existing remote-access plan tasks are stale.

## Phase 1: Native macOS Wrapper Foundation

**Purpose:** Create a real Mac app that launches and monitors OmniHarness locally.

**Files:**

- Create the `macos/OmniHarnessMac/**` app structure.
- Create `ProcessSupervisor.swift`, `LocalServerProbe.swift`, `PortAllocator.swift`, `LogBuffer.swift`, and `WrapperState.swift`.
- Create build/run bootstrap files under `macos/OmniHarnessMac/`.

- [ ] **Step 1.1: Choose package shape and create scaffold**

Use SwiftPM unless packaging needs force an Xcode project immediately. Keep the app in `macos/OmniHarnessMac` so it is clearly not a Next.js route or web artifact.

The app must start with separate files for app entrypoint, root views, models, services, and support code. Do not create a single oversized Swift file.

- [ ] **Step 1.2: Implement process supervision**

`ProcessSupervisor` owns:

- spawning `pnpm dev` or the production-equivalent app command,
- injecting wrapper-managed environment values,
- capturing stdout/stderr into `LogBuffer`,
- detecting ready URLs,
- stopping child processes on app exit,
- reporting failures with exit code, signal, and recent logs.

The wrapper must not hide failures behind a generic "could not start" message.

- [ ] **Step 1.3: Implement local readiness probing**

`LocalServerProbe` checks:

- Next.js web readiness on the selected web port,
- runtime readiness on the selected runtime port,
- auth configuration warnings,
- current app version or health metadata once available.

The probe output feeds a single `WrapperState` object. Views subscribe to `WrapperState`; child views do not independently poll process state.

- [ ] **Step 1.4: Embed the web UI**

`WebShellView` uses `WKWebView` to load the local OmniHarness URL after readiness succeeds.

It must show native loading, failed, retry, and diagnostics states. It must not show a blank webview as a success state.

- [ ] **Step 1.5: Add native commands and settings**

Add menu/toolbar affordances for:

- start/stop/restart OmniHarness,
- reload web UI,
- open local URL in browser,
- copy diagnostics,
- open Remote Access,
- open Settings.

Settings persist selected ports and launch behavior through app preferences.

- [ ] **Step 1.6: Verify wrapper foundation**

Run:

```bash
cd macos/OmniHarnessMac
swift test
swift build
script/build_and_run.sh
```

Expected: the app builds, launches OmniHarness, shows the local UI, and reports real readiness/failure states.

## Phase 2: Wrapper-to-Web Control Plane

**Purpose:** Let the native wrapper update remote status and public origin without editing environment files or restarting the web app unnecessarily.

**Files:**

- Create `src/server/wrapper/status.ts`.
- Create `src/app/api/wrapper/status/route.ts`.
- Create `src/app/api/wrapper/remote-origin/route.ts`.
- Create `src/server/remote/provider-events.ts`.
- Create `src/lib/remote-access-manager.ts`.
- Create `src/components/home/RemoteAccessPanel.tsx`.
- Modify `src/server/auth/config.ts`.
- Modify `src/app/api/auth/pair/route.ts`.

- [ ] **Step 2.1: Add a local-only wrapper control secret**

The wrapper and web server share a random local control secret generated by the wrapper and injected into the web process environment.

Wrapper-only routes must require:

- loopback source,
- control secret header,
- JSON schema validation,
- explicit error responses.

- [ ] **Step 2.2: Add remote status and public origin storage**

Create a server-side status model with:

- provider id,
- lifecycle state: `disabled`, `configuring`, `starting`, `connected`, `degraded`, `failed`, `stopping`,
- public origin,
- last reachability check timestamp,
- last error code/message,
- provider diagnostics summary,
- updated-at timestamp.

Persist the latest meaningful status in SQLite if the web UI needs restart continuity. Volatile connector health can remain in memory but must be refreshed after wrapper reconnect.

- [ ] **Step 2.3: Make pairing origin wrapper-aware**

Update public-origin resolution order:

1. valid wrapper-managed public origin,
2. `OMNIHARNESS_PUBLIC_ORIGIN`,
3. forwarded host/proto,
4. request origin.

The wrapper-managed origin must be accepted only when it has been set by the authenticated local wrapper route. Do not trust arbitrary browser-submitted origins.

- [ ] **Step 2.4: Add web remote access panel**

The web panel shows:

- selected provider,
- status,
- public URL,
- last successful check,
- current failure,
- link to native wrapper instructions when the web app is not wrapper-managed.

For frontend state, use a Manager as the single source of truth and Manager methods for actions.

- [ ] **Step 2.5: Verify control plane**

Run:

```bash
pnpm test -- tests/server/wrapper-status.test.ts tests/ui/remote-access-panel.test.tsx
pnpm test -- tests/auth tests/api
```

Expected: wrapper routes reject unauthenticated/non-loopback calls, accepted wrapper updates affect pairing URLs, and the UI shows accurate remote status.

## Phase 3: Remote Provider Abstraction In macOS App

**Purpose:** Give the wrapper one state machine for all remote providers so provider implementations do not leak into views.

**Files:**

- Create `RemoteProvider.swift`.
- Create `RemoteAccessManager.swift`.
- Create `KeychainStore.swift`.
- Create `RemoteAccessView.swift`.
- Modify `WrapperState.swift`.
- Modify `SettingsView.swift`.

- [ ] **Step 3.1: Define provider protocol and state machine**

Each provider implements:

- `configure()`,
- `start(localURL:)`,
- `stop()`,
- `refreshStatus()`,
- `validateReachability()`,
- `diagnostics()`.

All providers report through one `RemoteAccessManager`, which owns transitions and publishes state to `WrapperState`.

- [ ] **Step 3.2: Implement credential storage**

`KeychainStore` stores provider credentials by provider id and account/device id.

Credential errors must be explicit:

- missing credential,
- denied keychain access,
- invalid token,
- token revoked,
- provider unavailable.

- [ ] **Step 3.3: Implement provider selection UI**

`RemoteAccessView` shows:

- provider options,
- account/configuration state,
- start/stop controls,
- public URL,
- connection diagnostics,
- copy URL,
- open web pairing dialog.

Use native macOS controls and avoid turning the remote access screen into a marketing page.

- [ ] **Step 3.4: Wire provider status to web control plane**

Whenever provider state changes, the wrapper calls `/api/wrapper/status` and `/api/wrapper/remote-origin` as needed.

On stop/failure, clear the active public origin unless another provider has become active.

- [ ] **Step 3.5: Verify provider abstraction**

Run Swift tests for provider transitions with real state objects. Test doubles are acceptable inside unit tests, but not as delivered provider functionality.

```bash
cd macos/OmniHarnessMac
swift test
```

Expected: provider transitions are deterministic and invalid transitions are rejected with visible errors.

## Phase 4: Bundled `cloudflared` Provider

**Purpose:** Deliver a working remote access provider before the custom relay exists.

**Files:**

- Create `CloudflaredProvider.swift`.
- Add bundled binary handling or documented install detection.
- Modify `RemoteAccessView.swift`.
- Modify `docs/remote-providers.md`.

- [ ] **Step 4.1: Decide binary distribution**

Choose one:

- bundle a pinned `cloudflared` binary for supported architectures,
- download and verify a pinned release on first setup,
- require installation but automate detection and setup guidance.

The plan preference is bundling or verified download so the user does not manually install CLI tools.

- [ ] **Step 4.2: Implement Cloudflare credential flow**

Support the smallest secure Cloudflare credential flow available:

- API token or tunnel token entered by the user,
- token stored in Keychain,
- token validated before starting connector,
- errors mapped to actionable UI states.

Do not store Cloudflare tokens in `.env`.

- [ ] **Step 4.3: Start and supervise connector**

`CloudflaredProvider` starts `cloudflared` as a child process, captures logs, discovers the public origin, validates reachability, and reports health to `RemoteAccessManager`.

The provider must distinguish:

- binary missing,
- credential invalid,
- tunnel creation failed,
- connector exited,
- public origin unreachable,
- local app unreachable.

- [ ] **Step 4.4: Integrate with pairing**

Once connected, the wrapper updates the web app public origin. The existing `PairDeviceDialog` should generate QR links with the Cloudflare public URL.

Add UI copy that makes the account ownership clear without asking the user to operate the tunnel manually.

- [ ] **Step 4.5: Verify `cloudflared` provider**

Run:

```bash
cd macos/OmniHarnessMac
swift test
pnpm test -- tests/server/wrapper-status.test.ts tests/auth tests/api
```

With real Cloudflare credentials available, run the environment-gated e2e:

```bash
pnpm test:e2e -- tests/e2e/remote-provider-cloudflared.spec.ts
```

Expected: a remote browser can reach the local OmniHarness UI through the provider, authenticate, and redeem a pairing QR.

## Phase 5: Tailscale And Manual Public URL Provider

**Purpose:** Support users who already have a private mesh or want to own their remote network path.

**Files:**

- Create `TailscaleProvider.swift`.
- Modify `RemoteAccessView.swift`.
- Modify `docs/remote-providers.md`.

- [ ] **Step 5.1: Implement installed Tailscale detection**

Detect common Tailscale install paths and CLI availability. Read status through supported local commands only when available.

The app should not require Tailscale for normal operation.

- [ ] **Step 5.2: Implement manual URL validation**

Allow a user to paste a public URL. Before accepting it, the wrapper validates:

- HTTPS unless explicitly local/private,
- reaches the current OmniHarness web instance,
- returns an expected health marker,
- does not point at the runtime port.

- [ ] **Step 5.3: Add provider UX**

Show Tailscale/manual as an advanced provider:

- good for users who already operate Tailscale,
- may require account/policy setup,
- not the default zero-fiddle path.

- [ ] **Step 5.4: Verify provider**

Run Swift tests for URL validation and status transitions.

With Tailscale available, run a manual or approval-gated journey proving a phone can reach the public/private URL and pair.

## Phase 6: Omni Relay Protocol And Cloudflare Worker

**Purpose:** Build the custom tunnel protocol on Cloudflare Workers and Durable Objects so OmniHarness can offer a default no-manual-tunnel path.

**Files:**

- Create `relay/cloudflare/**`.
- Create `OmniRelayProvider.swift`.
- Add relay tests.
- Add relay docs.

- [ ] **Step 6.1: Define protocol frames test-first**

Create typed protocol frames:

- `hello`,
- `hello_ack`,
- `request_start`,
- `request_body`,
- `request_end`,
- `response_start`,
- `response_body`,
- `response_end`,
- `stream_cancel`,
- `heartbeat`,
- `error`,
- `reconnect`.

Each frame includes:

- protocol version,
- device id,
- connection id,
- request id when applicable,
- timestamp or sequence,
- payload length metadata,
- error code when applicable.

Add tests for schema validation, unknown frame rejection, oversized payload rejection, and version mismatch.

- [ ] **Step 6.2: Implement Durable Object session broker**

The Durable Object owns:

- current Mac tunnel WebSocket,
- remote browser request queue,
- request id allocation,
- response routing,
- SSE stream routing,
- heartbeat timeouts,
- reconnect cleanup,
- redacted diagnostics.

It must reject browser requests when no Mac tunnel is connected instead of hanging indefinitely.

- [ ] **Step 6.3: Implement Worker routing**

The Worker handles:

- Mac tunnel WebSocket upgrade,
- browser HTTP request forwarding,
- public health endpoint,
- device/session lookup,
- authentication and signature validation,
- CORS and security headers,
- relay diagnostics endpoint for the wrapper.

The Worker must not expose arbitrary host/port forwarding. It forwards only to the connected local OmniHarness web server through the Mac tunnel.

- [ ] **Step 6.4: Implement macOS relay client**

`OmniRelayProvider`:

- registers or authenticates the device,
- opens outbound WebSocket,
- converts relay request frames into local HTTP requests,
- streams local responses back through frames,
- supports SSE without buffering the full response,
- enforces local destination allowlist,
- reconnects with backoff,
- publishes precise status and diagnostics.

- [ ] **Step 6.5: Implement relay auth and device identity**

For v1 relay auth:

- generate a device keypair or device secret,
- store local credential in Keychain,
- issue relay session credentials,
- sign tunnel hello requests,
- rotate/revoke sessions,
- do not put OmniHarness app session cookies in relay credentials.

If Omni-owned accounts are not ready, implement bring-your-own Cloudflare deployment mode as an advanced setup, but keep the protocol compatible with a future Omni-owned control plane.

- [ ] **Step 6.6: Verify relay locally**

Run:

```bash
pnpm test -- relay/cloudflare/test
pnpm test:e2e -- tests/e2e/omni-relay.spec.ts
```

Expected: a browser request through the Worker reaches the local OmniHarness app, login works, `/api/events` streams, and tunnel disconnects are visible.

## Phase 7: Remote UX Polish, Diagnostics, And Operations

**Purpose:** Make the feature usable when something goes wrong, because tunnels fail in boring and creative ways.

**Files:**

- Modify native `RemoteAccessView.swift`.
- Modify web `RemoteAccessPanel.tsx`.
- Modify `PairDeviceDialog.tsx`.
- Modify `src/server/remote/provider-events.ts`.
- Modify docs.

- [ ] **Step 7.1: Add diagnostics export**

The wrapper can export:

- wrapper version,
- macOS version,
- provider id,
- local port status,
- web/runtime readiness,
- recent provider logs with secrets redacted,
- last public origin check,
- last QR origin used,
- relay/connector error code.

Do not include passwords, session cookies, pairing token plaintext, Cloudflare tokens, Tailscale tokens, prompts, file contents, or worker output by default.

- [ ] **Step 7.2: Add failure-specific remediation**

Show actionable states for:

- local app failed to start,
- auth not configured,
- provider credential missing,
- provider credential rejected,
- connector disconnected,
- relay unreachable,
- public URL not reaching this machine,
- stale public origin,
- pairing token expired,
- mobile session authenticated but live events disconnected.

- [ ] **Step 7.3: Add audit events**

Persist events for:

- provider configured,
- provider started/stopped,
- public origin changed,
- relay connected/disconnected,
- reachability check failed,
- QR generated against provider origin,
- remote login/pairing success/failure where already covered by auth events.

- [ ] **Step 7.4: Add docs**

Document:

- wrapper setup,
- provider comparison,
- Cloudflare account-owned tunnel setup,
- Tailscale/manual setup,
- Omni Relay architecture,
- security model,
- troubleshooting matrix.

## Phase 8: Packaging, Signing, And Release Readiness

**Purpose:** Make the wrapper installable and trustworthy enough for regular use.

**Files:**

- Add packaging scripts under `macos/OmniHarnessMac/script/`.
- Add release docs.
- Add signing/notarization configuration if distribution credentials are available.

- [ ] **Step 8.1: Package app**

Produce a `.app` bundle that includes or locates:

- native wrapper executable,
- bundled Node runtime strategy or documented Node requirement,
- OmniHarness web assets,
- `cloudflared` binary if bundling is chosen,
- required helper scripts.

- [ ] **Step 8.2: Add launch-at-login support**

Implement native launch-at-login only after the process lifecycle is stable. The setting persists in app preferences and is visible in Settings.

- [ ] **Step 8.3: Sign and notarize when credentials exist**

Use hardened runtime and notarization for distribution builds. If credentials are unavailable, document unsigned local development builds separately and do not present them as release-ready.

- [ ] **Step 8.4: Final verification**

Run:

```bash
pnpm lint
pnpm test
pnpm build
cd macos/OmniHarnessMac && swift test && swift build
```

Run approved e2e journeys for the providers included in the release.

## Acceptance Criteria

- The macOS wrapper launches OmniHarness without a terminal and shows real local readiness.
- The wrapper can start, stop, and restart the local app and runtime without orphaning child processes.
- Remote access has a single provider state model across native and web surfaces.
- The active public origin is set by the wrapper and used by the existing pairing QR flow.
- The first release-quality provider works end-to-end with real remote browser traffic.
- Tailscale/manual provider support validates user-supplied URLs before accepting them.
- The Cloudflare Worker/Durable Object relay passes protocol, reconnect, stream, and browser journey tests before it is called the default no-fiddle provider.
- ACP/runtime ports remain private and loopback-only.
- Secrets are stored in Keychain or encrypted server settings, never `.env` or localStorage.
- Failure states are explicit in native UI, web UI, logs, and diagnostics.
- No implementation creates a git branch or worktree.

## Implementation Notes

- Do not use file-based routing beyond the existing Next.js App Router structure already in the repo.
- Keep frontend state centralized in Manager classes.
- Avoid `require()` imports.
- Avoid `.env` for frontend UI settings or string literals.
- Use `RefObject` instead of deprecated `MutableRefObject` in React code.
- If a React fix fails, reassess for race conditions before layering on more effects.
- Do not let new Swift or TypeScript files grow past 1200 lines; split provider, protocol, and UI responsibilities early.
- Any real-provider e2e that requires external accounts must be environment-gated and clearly reported as skipped when credentials are absent.
