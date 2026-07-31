# Interface / Runner Split — Design

Date: 2026-07-29
Status: Approved direction; hardened for implementation on 2026-07-30

## 1. Goal

Split OmniHarness into two independently runnable pieces:

- **Runner** — one logical headless service that owns all domain state and processes:
  SQLite, supervisor, agent-runtime bridge, PTY terminals, SSE event stream, auth.
  No Next.js. Serves only data (plus the static interface bundle for the web/PWA
  path). A runner deployment is managed as one unit even though the API server
  and ACP bridge remain separate co-located processes internally.
- **Interface** — a self-contained static React SPA (Vite build) that connects to
  one or more runners over HTTP + SSE. Ships as: web page served by any runner,
  installable PWA, Electron desktop app (macOS/Windows/Linux), Capacitor native
  apps (iOS/Android), and the existing VSCode shell. Every installed client can
  save any number of runners and keeps all authenticated profiles connected
  while the app process is active.

Motivations, in priority order:

1. Interface installable on a phone/laptop connecting to **multiple remote
   runners**.
2. Backend runs as a lean process that does not also host a frontend toolchain
   (Next dev today balloons to 8 GB+ RSS).
3. Web version keeps working exactly as it does now (same URL shape, same UI).

## 2. Decisions already made (user-confirmed)

| Decision | Choice |
|---|---|
| Next.js | **Remove.** Interface becomes a Vite SPA; runner serves the built bundle and injects the bootstrap JSON into `index.html` at serve time (preserves today's zero-round-trip boot; verified that the app tree is `ssr:false` and SSR only emits the BootShell skeleton + bootstrap blob). |
| Native shells v1 | **Electron desktop** (existing `apps/electron`, converted to a pure remote client) plus **Capacitor iOS/Android** (`apps/mobile`, sharing the Vite bundle). PWA and VSCode remain supported. Tauri is out of scope. |
| Multi-runner UI v1 | **Runner switcher with concurrent connections**: save N runner profiles; keep every authenticated profile connected while the app is active; show one runner's workspace at a time. Merged cross-runner views remain out of scope. |
| Backend topology | **Keep two services** as today: the omni API server and the agent-runtime bridge (port 7800) stay separate processes. Clients only ever talk to the API server; the bridge keeps binding to localhost by default (`OMNIHARNESS_AGENT_RUNTIME_HOST`). A "runner" deployment = both processes co-located on one machine sharing one filesystem, managed by one start script. |
| Authentication v1 | **One shared runner password.** Cookie clients and bearer clients use the same password login. Login creates a separately revocable session token. A user may save the shared password in that server's local client profile; it remains there until they clear the field or forget the server. Pairing tokens and QR authentication are not required by the new client flow. |

## 3. Verified current state (what we build on)

The split is substantially pre-architected:

- **Portable route registry**: `src/runtime/http/routes/index.ts` registers all 63
  method+path pairs framework-free (Fetch Request/Response). All 49 Next API
  routes are thin adapters over it.
- **Standalone server**: `src/runtime/http/server.ts` (`startOmniServer`) exists,
  with `staticDir` support — but cannot stream (buffers `arrayBuffer()`), so the
  two SSE endpoints (`/api/events`, `/api/terminals/:id/stream`) do not work
  through it yet.
- **Electron already uses the standalone server**, not Next:
  `apps/electron/src/runtime.ts` calls `startOmniServer`. The M2 transitional
  shell therefore survives Next removal; M6 changes ownership/networking, not
  its dependency on Next.
- **Client transport abstraction**: `src/runtime-api/` (`RuntimeAPIs` interface;
  `web.ts` already takes `baseUrl` + injectable `fetch`/`EventSource`).
- **Non-Next entry**: `src/ui/render-web.tsx` mounts `<OmniApp>` without Next.
- **Bootstrap over HTTP**: `GET /api/runtime/bootstrap` already mirrors the SSR
  bootstrap for Electron/VSCode.
- **Transports**: HTTP JSON + SSE only. No WebSockets, no server actions, no tRPC.

Known debts that gate the split (from exploration):

- **(B) Streaming**: standalone server buffers responses; SSE endpoints hang.
- **(C) Auth**: cookie + `SameSite=Lax` + `enforceSameOrigin` on all mutations +
  zero CORS headers → a cross-origin interface cannot authenticate.
- **(D) Runner identity**: `RuntimeAPIs` is a flat singleton; managers, SSE
  cursor, and query caches assume "the one server".
- **(H) 29 call sites** still hardcode `fetch('/api/...')`/`new EventSource('/api/...')`
  instead of going through `RuntimeAPIs` (list in
  `docs/architecture/common-runtime-multi-surface.md` §"debt").
- **(G) Client→server imports**: `src/server/workers/entries-types.ts` (types),
  `src/server/planning/review-preferences.ts` (runtime zod import) are imported
  by client components.
- **(A) Same-process event bus**: `src/server/events/named-events.ts` ring +
  `live-updates.ts` listener set are module-level memory → the API server must
  remain a single process. This is accepted and documented, not changed.

## 4. Target architecture

### 4.1 Repository shape (Approach A — in-place, two build targets)

Stay one pnpm package for now. Two build targets with an enforced boundary,
no mass file moves:

```
src/server/       → runner only (never bundled into interface)
src/runtime/      → runner only (HTTP registry, standalone server, bootstrap)
src/shared/       → NEW: types + pure logic importable by both sides
src/lib/          → interface-leaning isomorphic helpers (already clean)
src/runtime-api/  → interface transport layer (multi-runner aware)
src/ui/, src/components/, src/interface/home/ → interface
apps/interface/   → NEW: Vite app (index.html, vite.config.ts, entry that
                    reuses src/ui/render-web.tsx)
apps/electron/    → existing shell, becomes pure remote client
apps/mobile/      → NEW: Capacitor shell with iOS + Android native projects
apps/vscode/      → behavior unchanged; port/auth wiring updated
scripts/runner.ts → NEW: runner entrypoint (replaces Next start for backend)
```

`src/app/` (Next) is deleted at the end of Milestone 2; `src/app/home/` is
interface code and moves to `src/interface/home/` (import-path rename only) so
the `src/app` deletion is clean.

Boundary enforcement:
- ESLint `no-restricted-imports`: anything bundled by Vite may not import
  `@/server/*` or `@/runtime/*` (only `@/shared/*`).
- The two offending imports (G) move: `entries-types.ts` and
  `review-preferences.ts` → `src/shared/`, with re-export shims left at the old
  paths for server-side importers.
- Vite build failing on a server import is the backstop.
- Typechecking is split: separate `tsc --noEmit` projects for runner
  (`src/server` + `src/runtime`), shared, and interface, so a server-only type
  error can't hide in the SPA project and vice versa.

**Production artifact contract** (what a headless box installs):
- `pnpm build` → `dist/interface/` (hashed static assets + `index.html`
  template). The runner itself keeps running from source via `tsx`
  (existing convention in `scripts/start.ts`); no Vite, Next, or watcher runs
  in production.
- Runner with `dist/interface` present → serves SPA + API. Absent → **API-only
  mode**: `/` returns a plain informational page, a named event
  `runner.static_ui_missing` is emitted, and everything else works (this is a
  supported deployment, not an error). If `--static-dir` is passed explicitly
  and missing, startup fails loudly.
  Exactly one of `runner.static_ui_enabled` or `runner.static_ui_missing`
  emits once during boot.
- `pnpm electron:build` packages that same interface bundle in Electron.
  `pnpm mobile:sync`, `pnpm mobile:build:ios`, and
  `pnpm mobile:build:android` synchronize and build the Capacitor projects.
  Native generated outputs, signing material, and local SDK state remain
  ignored; native project source and configuration are versioned.
- Memory acceptance: measured via `scripts/measure-local-dev.mjs` over the
  **whole process tree** (API process, bridge, gateway children, plus
  Vite/watchers in dev) — dev combined RSS **< 2 GB**, production runner
  **< 1 GB** — recording both peak and end-of-workload RSS after a scripted
  deterministic 10-minute fixture-agent conversation workload (no live model
  or network dependency). M1 records the current baseline; M2 enforces the
  calibrated thresholds. A controlled local benchmark gate, not a CI-hardware
  assertion. (Today's Next dev process alone exceeds 8 GB.)

**Rejected alternatives**:
- *Approach B — full monorepo package extraction* (`packages/shared|runner|interface`):
  cleaner end state but moves ~460 files, breaks every open branch, buys
  nothing functional now. Revisit after the split is proven.
- *Approach C — keep Next as frontend host*: rejected by user (RAM, second
  pipeline).

### 4.2 Runner

**Entrypoint** `scripts/runner.ts`:
1. `await dbReady` (schema init).
2. Start supervisor watchdog (`ensureSupervisorRuntimeStarted()`).
3. Start Claude model gateway (`ensureClaudeModelGatewayStartedAtBoot()` + shutdown hooks).
4. Start/adopt the bridge through an extracted `ManagedBridgeController`
   (lockfile, health checks, build/install, retry, ownership). Unlike today's
   `scripts/dev.ts`, initial bridge failure is non-fatal: the controller enters
   `starting`/`unavailable`, retries with bounded exponential backoff, and emits
   lifecycle events while the API remains available.
5. `startOmniServer({ staticDir, port })` — one HTTP port for API + SSE + SPA.

This replaces `src/instrumentation.ts` (deleted with Next).

**Lifecycle contract**:
- `GET /api/healthz` (liveness, no auth, no state) and readiness reflected in
  the existing bootstrap route. Bridge unavailable at boot → runner starts,
  serves UI/API, reports `bridge: "starting" | "unavailable"` in bootstrap and
  emits `runner.bridge_unavailable`; bridge crash → existing supervisor
  sync/retry behavior, surfaced as named events (`runner.bridge_ready` on
  (re)connect). Port conflict → fail fast; the owning pid is reported
  best-effort via the runner's own lockfile (bridge-lock pattern), since bind
  errors don't carry it cross-platform. Shutdown order: stop accepting new
  connections → send a dedicated `runner.stopping` frame to open SSE streams
  (NOT `stream.resync_required`, which would trigger snapshot reloads against
  a dying server; clients show "runner stopping" and back off) → bounded
  flush window, then abort remaining readers → PTYs get SIGTERM with a
  deadline, then SIGKILL → gateway child likewise → bridge: terminated if
  this runner spawned it, released (lock only) if adopted.
- Runner and bridge configuration is instance-scoped: API port, bridge URL/
  port, bridge lockfile, gateway settings, database, and data root are explicit
  inputs derived from `OMNIHARNESS_ROOT`/`OMNIHARNESS_INSTANCE`. This lets the
  two-runner test start isolated deployments on one host without shared
  lockfiles or ports.
  Managed gateway instances bind port `0` in isolated tests and publish their
  chosen loopback URL into that runner's environment; production keeps the
  configured gateway URL. No test relies on the default gateway port.
- Every runner process mints a `streamEpoch` at boot. SSE ids are
  `<streamEpoch>:<sequence>`, and bootstrap includes the current epoch. A client
  reconnecting with another epoch always receives an id-bearing
  `stream.resync_required` frame and reboots from a snapshot. All frames,
  including `runner.stopping` and resync controls, carry ids; the client
  persists their epoch-aware cursor.
- A single process-global 15-second `stream.heartbeat` event advances the same
  id/ring sequence and is delivered to all subscribers. It is not synthesized
  independently per client. The ring holds at least 4096 entries so heartbeats
  do not collapse the useful reconnect window. Cursor sequence below the ring
  floor deterministically emits an id-bearing `stream.resync_required`.

**Streaming fix (prerequisite for everything)**: `writeFetchResponse` in
`src/runtime/http/server.ts` pipes `Response.body` (Web `ReadableStream`) to the
Node `ServerResponse` chunk-by-chunk, flushes headers immediately, disables
Nagle for `text/event-stream`, and destroys the upstream reader on client
disconnect. Non-streaming responses keep the buffered path.
Each subscriber has a bounded pending queue: at most 256 frames or 1 MiB,
whichever comes first. A slow reader never blocks the process-global ring and
never buffers without bound. Overflow attempts one id-bearing
`stream.resync_required` frame, then destroys the socket if it cannot flush;
the client re-bootstraps from a snapshot. Resync carries a stable reason:
`epoch_mismatch`, `cursor_evicted`, or `subscriber_overflow`.
`subscriber_overflow` also emits a named diagnostic event.

**Static serving + bootstrap injection contract**:
- `GET /` and `/session/:runId` (the deep-link rewrite from `next.config.ts`)
  serve `index.html` with
  `<script id="omni-bootstrap" type="application/json">…</script>` injected —
  same payload semantics as today's SSR (`includeInitialData: false`). JSON is
  serialized with `<`, `>`, `&`, U+2028, U+2029 escaped so it cannot terminate
  the script element.
- SPA fallback applies only to GET navigations without a file extension that
  aren't `/api/*`. `/api/*` and missing assets return proper 404s — never
  `index.html`.
- Hashed assets: `Cache-Control: public, max-age=31536000, immutable`.
  `index.html`: `no-store` (it contains per-request auth state).
- Vite emits `dist/interface/csp-manifest.json` containing the approved inline
  theme-script hash and asset metadata. The runner validates it at boot; an
  explicit static directory with a missing/mismatched manifest fails loudly.
- Static file resolution rejects path traversal and does not follow symlinks
  out of `staticDir`.
- **Frontend security policy** (browser tokens live in `localStorage`, so
  same-origin script injection is the main browser threat): interface pages ship a
  CSP **as an HTTP header** (meta tags can't enforce `frame-ancestors`) —
  `default-src 'self'`, `script-src 'self' 'sha256-<theme-bootstrap-hash>'`,
  `style-src`/`font-src`/`img-src`/`worker-src 'self'` (+ `data:`/`blob:`
  where the app needs them), `frame-ancestors 'none'`, `object-src 'none'`,
  `base-uri 'none'`, `require-trusted-types-for 'script'`, an
  application-specific `trusted-types` policy,
  `connect-src 'self' https: http://localhost:* http://127.0.0.1:*` (bearer
  runners are user-added HTTPS origins; loopback allowed for dev),
  `Referrer-Policy: no-referrer`. Because arbitrary user-added HTTPS runners
  must be reachable, web `connect-src` cannot prevent exfiltration after a
  successful same-origin script compromise; CSP reduces injection probability
  but is not token binding. Capacitor/Electron packaged pages use
  `connect-src 'self'` because all runner traffic crosses the native host
  bridge; direct renderer/WebView fetch to a runner is blocked and tested.
  Because xterm, Markdown/highlighting, and other dependencies may still touch
  HTML sinks, `require-trusted-types-for 'script'` first ships as
  `Content-Security-Policy-Report-Only`. The M2 exit gate is either verified
  enforcement with an application policy or a documented, narrowly scoped
  exception; it cannot silently remain untested. No third-party scripts, ever.
  All
  server-provided content (agent output, errors, project paths) renders
  through the existing markdown/text pipeline — a test asserts none of it can
  introduce executable markup.
- The interface reads the inline blob if present, else falls back to
  `GET /api/runtime/bootstrap` (Electron / remote / dev / offline-PWA path).
- Bootstrap injection is a bounded local read path. It never waits for a bridge
  health probe or reconciliation write; bridge readiness comes from the
  controller's in-memory read model and is explicitly marked stale/degraded
  when necessary.

**Ports & processes** (unchanged topology, per user decision):
- API server: default 3050 (today's web port), configurable.
- Bridge: 7800, localhost-bound by default. Existing `OMNIHARNESS_*` env vars
  keep their meanings. The dev compression proxy (3035) is retired with Next
  dev; the VSCode default `serverUrl` moves to the runner port.
- `scripts/start.ts`, `controller.sh`, `omni.sh` launch the runner instead of
  Next.

### 4.3 Auth & cross-origin model

The runner has one shared password and two session transports against the same
`auth_sessions` table and expiry/revocation rules. This is deliberately a
single-user trust model: there are no accounts, roles, device pairing secrets,
or separate mobile credentials in v1.

**Cookie sessions (unchanged)** — for the interface served by the runner itself
(web + PWA on that runner's origin). `POST /api/auth/login` verifies the shared
password, sets the existing `SameSite=Lax` HttpOnly cookie, and
`enforceSameOrigin` remains enabled on mutations. No CORS is involved.

**Bearer sessions (new)** — for every cross-origin or native client: an
interface hosted by runner A talking to runner B, Electron, Capacitor,
VSCode, the Vite dev server, and the CLI.

1. **Password login and issuance**: `POST /api/auth/login` accepts
   `{"password":"…","tokenTransport":"cookie"|"bearer","clientLabel":"…"}`.
   Cookie remains the default for same-origin compatibility. Bearer login
   returns one opaque session token in the response body. The password is
   verified by the server and may also be retained in the local server profile
   when the user saves it in Add server or Edit server. Every device/profile
   still gets a separately revocable session row.

   Guards accept `Authorization: Bearer <token>`; same-origin enforcement is
   skipped for bearer requests because the credential is not ambient. Session
   rows gain stored provenance:

   ```ts
   transport: "cookie" | "bearer";
   boundOrigin: string | null;       // exact browser origin at login
   clientKind: "browser" | "native"; // native host made the login request
   ```

   - A browser bearer session always requires its exact stored `boundOrigin`;
     missing, different, or `Origin: null` is rejected and audited as
     `auth.bearer_origin_rejected`.
   - Electron main, Capacitor native host, VSCode extension host, and CLI use
     an originless native login transport and receive
     `clientKind: "native", boundOrigin: null`.
   - Native login is rejected when `Origin`, `Referer`, or any `Sec-Fetch-*`
     header is present. Its response never carries
     `Access-Control-Allow-Origin`. A native session is rejected on any later
     request that carries `Origin`; these invariants prevent a browser from
     requesting or replaying the longer-lived native credential.
   - Cookie tokens are never accepted as bearer tokens and bearer tokens are
     never accepted as cookies.
   - This is browser-origin isolation, not cryptographic token binding. Bearer
     tokens remain replayable secrets. DPoP/device keys and multi-user roles are
     outside the approved v1 scope.
2. **Browser authorization + CORS**: a runner never reflects an arbitrary
   origin on the password-login response. That would let any page visited by
   the user probe a loopback runner, attempt the shared password, and exfiltrate
   a bearer token. Browser/PWA runner addition therefore uses a same-runner
   authorization window:
   - Interface A creates a random `state`, PKCE verifier/challenge, and opens
     runner B at
     `/authorize-interface?origin=<A>&state=<state>&challenge=<challenge>`.
     PKCE is S256 only; `plain` is rejected. `state`, verifier, and challenge
     are base64url with bounded length (43–128 characters) before rendering,
     hashing, or persistence.
   - The authorization page is served by B, submits the password only to B's
     same origin, names requesting origin A, and requires explicit approval.
     An already-authenticated B session may approve without re-entering the
     password; first contact uses the same IP/rate-limit bucket and lockout as
     `/api/auth/login`.
   - B parses and validates A as an exact `https` or loopback-`http` origin,
     rejects every other scheme/shape as `auth.login_origin_rejected`, and
     renders the parsed A and B origins in full (not raw attacker text or
     truncated labels). Approval requires a real user gesture.
   - B creates a 60-second, single-use authorization code bound to exact
     origin A + PKCE challenge and sends it to the opener with
     `postMessage(..., A)` (or a platform return link when no opener exists).
   - A verifies `event.origin === B`, the `state`, then exchanges
     code + verifier at `/api/auth/browser-token`. Only the bound origin gets
     CORS on this exchange. The code is atomically consumed and never logged.
   - Native Electron/Capacitor/VSCode/CLI login stays direct: their host process
     sends URL + shared password to `/api/auth/login` without browser CORS.
   - Bearer requests from a stored browser `boundOrigin` get exactly that
     origin reflected with `Vary: Origin`, including error responses.
   - `GET /api/healthz` allows non-credentialed cross-origin GET and returns
     only `{"ok":true}`—no identity, version, hostname, or state.
   - Registry-wide `OPTIONS` handles bearer-route preflight with
     `authorization, content-type`, per-route methods, and a bounded
     `Access-Control-Max-Age`. Cookie routes never receive CORS headers.
     `Access-Control-Allow-Credentials` is never emitted on any route.
3. **SSE auth**: browser `EventSource` cannot set headers. Bearer clients call
   `POST /api/auth/stream-ticket` to create a 60-second, single-use,
   atomically consumed ticket bound to (session, exact stream path). The ticket
   is passed in `?ticket=`. Redemption revalidates the session's stored origin.
   `LiveEventConnectionManager` owns reconnection, closes native EventSource
   auto-retry on error, fetches a fresh ticket for every connection, and sends
   the saved epoch-aware cursor as `?cursor=<epoch>:<sequence>` because a newly
   constructed `EventSource` cannot set `Last-Event-ID`. The server also accepts
   the standard header; explicit `cursor` wins when both exist. Cursors are not
   credentials and may be logged. The same mechanism protects
   `/api/terminals/:id/stream`. A successful cross-origin ticketed stream
   response reflects the ticket/session's bound origin in
   `Access-Control-Allow-Origin` and sends `Vary: Origin`; otherwise the browser
   rejects the `EventSource` response even though ticket redemption succeeded.
4. **Network exposure**: authentication is already required by the current
   application. Binding to a non-loopback host with a missing/invalid password
   fails at startup. Bearer login and stream-ticket issuance over plaintext
   non-loopback HTTP are refused. Loopback HTTP remains available for local
   development; production remote clients use HTTPS/Tailscale/tunnels. There is
   no unauthenticated network override in the supported product path.
   TLS validation failure is a hard `tls-untrusted` profile status, with a
   precise cause (unknown issuer, hostname mismatch, expired certificate).
   Browsers/PWA require trust through the OS/browser and recommend Tailscale
   HTTPS/`tailscale cert`. Native shells may offer per-profile SPKI pinning
   only after standard trust validation fails: show the fingerprint, require
   explicit confirmation, and persist the pin. OS-trusted chains are never
   pinned. A later mismatch enters `tls-untrusted` with cause `pin-mismatch`;
   the UI shows stored and presented fingerprints and requires an explicit
   re-pin gesture while preserving the profile/credential. Re-pin emits an
   auditable client diagnostic. There is no global insecure mode and no
   `rejectUnauthorized: false`.
5. **Trusted proxies and rate limiting**: the runner honors
   `Forwarded`, `X-Forwarded-Proto`, and `X-Forwarded-For` only when the
   immediate socket peer is in `OMNIHARNESS_TRUSTED_PROXIES`
   (addresses/CIDRs). Otherwise protocol and rate-limit identity come from the
   actual socket. Credentialed requests use `redirect: "manual"` so passwords,
   bearer tokens, and tickets never follow redirects.
6. **First-run provisioning**: `pnpm auth:password set` remains the canonical
   interactive command and stores an Argon2 hash. `omni auth init` becomes a
   friendly alias that prompts for the same shared password and supports
   `--password-file` for unattended deployment (file must be mode `0600`).
   A headless runner with no valid password fails with instructions.
7. **Session lifetime and revocation**:
   - Cookie and browser-bearer sessions: 30-day idle, 90-day absolute expiry.
   - Native sessions: 90-day idle, 365-day absolute expiry.
   - `lastSeenAt`/idle expiry is touched at most once per minute to bound SQLite
     writes. A runner retains at most 50 active sessions; successful login at
     the cap evicts the least-recently-seen non-current session and emits
     `auth.session_revoked` with reason `session_limit`.
   - `GET /api/auth/sessions` lists redacted device/session metadata;
     `DELETE /api/auth/sessions/:id` revokes one; `DELETE /api/auth/sessions`
     revokes all except the current session. `omni auth sessions list|revoke`
     exposes the same control plane. Every decision emits
     `auth.session_revoked` and user-relevant failures emit `error.surfaced`.
   - Changing the shared password revokes every existing session by default.
     `pnpm auth:password set --keep-sessions` is an explicit compatibility
     override. "Forget runner" first attempts server revocation, always clears
     the local credential, and surfaces a warning if the server was unreachable.
8. **Client storage**:
   - Each saved server profile may contain the shared password in its platform
     profile storage. It remains there without an expiry until the user clears
     the Edit server password field or forgets the server. This is an explicit
     convenience tradeoff: the saved password is readable by code with access
     to that client profile and is not a replacement for revocable sessions.
   - Web/PWA stores bearer session tokens in the versioned runner-profile store
     in `localStorage`; the CSP/no-third-party-script policy is the protection
     boundary.
   - Electron stores tokens in the main process with `safeStorage`; the
     renderer never sees them.
   - Capacitor stores tokens with an audited Keychain/Keystore-backed secure
     storage plugin. Tokens are loaded into memory only for the native
     networking bridge and are never written to WebView local storage.
   - VSCode stores bearer tokens in `SecretStorage`.
9. **Redaction and audit**: password bodies, authorization codes/verifiers,
   `Authorization` headers, bearer
   tokens, stream tickets, and token-bearing URLs are scrubbed from logs,
   errors, and named-event details. Login success/failure/rate limiting,
   bearer issuance/rejection, ticket issuance/redemption/rejection, and session
   revocation remain auditable without secrets.
10. **Existing pairing compatibility**: the existing QR/pair-token flow remains
   available to current web users but is not required by the new desktop or
   mobile onboarding. New runner profiles use URL + shared password. No new
   security or product dependency is built on pairing tokens.
11. **Next removal**: `NextRequest` usage in `auth/guards.ts`,
    `auth/session.ts`, `api-errors.ts` is replaced with plain Fetch `Request`.

### 4.4 Interface: Vite SPA

- `apps/interface/` with Vite + React. Entry reuses `src/ui/render-web.tsx`;
  `src/app/layout.tsx` content is ported to `index.html` (theme bootstrap
  script, meta/manifest/icons) and a `<Providers>` root.
- Remove Next-isms (all verified small):
  - `next/dynamic` (4 files) → `React.lazy` + `Suspense`.
  - `next/image` (5 files) → `<img>` (all usages are local static assets).
  - `next/font/google` → self-hosted Geist via `@fontsource` (offline-friendly,
    no Google fetch at build or runtime).
  - `src/app/home/` → `src/interface/home/` (rename only).
- **PWA & service worker contract**:
  - `manifest.webmanifest`, `sw.js`, `PwaBootstrap` move to the Vite app,
    served by the runner → phone install keeps working per runner origin.
  - The SW **never caches `index.html`** (it carries per-request auth state).
    It precaches hashed assets plus `app-shell.html`, a static,
    non-personalized navigation fallback that boots without inline bootstrap
    and calls `/api/runtime/bootstrap`. The manifest `start_url` targets the
    shell, and navigation failures fall back to it.
  - **The app mounts and loads `RunnerRegistry` independently of same-origin
    bootstrap success**: if the hosting runner is down, its profile is marked
    offline but the switcher stays usable and a saved remote runner connects
    normally (the installed interface is not held hostage by its origin
    runner). Test: install from A, save B, stop A, launch from SW cache,
    connect to B.
  - SW versioning: build hash in the SW file; install uses `skipWaiting`,
    activate evicts old caches and calls `clients.claim`. Same-origin
    `apiRevision` mismatch requests one update + guarded reload; a persisted
    loop flag prevents reload storms. The offline shell response carries the
    same CSP header as live pages.
  - The service worker never caches or rewrites requests whose origin differs
    from its own; cross-origin runner API/SSE traffic passes through untouched.
- **Dev workflow**: `pnpm dev` = runner via `tsx watch` + Vite dev server
  proxying `/api` to the runner (cookies stay same-origin in dev; no CORS
  needed). **The dev UI lives at Vite's port (5173)**; the runner port serves
  whatever `dist/interface` build exists (or API-only mode) — it is the
  canonical URL for production and packaged-mode e2e, not for dev. Expected
  dev RSS per §4.1 contract. The Vite proxy preserves the browser's
  `Origin: http://localhost:5173` (`changeOrigin: false`) and auth tests assert
  that exact development path.
- **Prod web**: `vite build` output is what the runner serves.
- **Native packaging**:
  - Electron loads the packaged Vite bundle; all HTTP/SSE runs in its main
    process through an IPC `RuntimeAPIs` adapter.
  - Capacitor iOS/Android load the same bundle from the native WebView. A
    narrow native bridge owns secure credentials, HTTP/SSE, external links,
    and local notifications. The shared React tree never branches on platform
    except through `RuntimeAPIs.native` capabilities.
  - Mobile operating systems may suspend an app in the background. "Keep all
    runners connected" is guaranteed while the app process is active; reliable
    delivery while suspended requires native push infrastructure and is not
    falsely claimed by v1.
  - `apps/mobile/capacitor.config.ts` points `webDir` at
    `../../dist/interface`; native builds never maintain a second frontend
    artifact.
  - iOS declares `NSLocalNetworkUsageDescription` for LAN runners and keeps App
    Transport Security strict outside explicit loopback development. Android
    sets `usesCleartextTraffic=false` with a debug-only loopback network
    security configuration. Release builds never bypass certificate checks.
- **UI starting point**: preserve the existing OmniHarness workspace. Adapt
  the official shadcn `sidebar-07` team-switcher structure for the runner
  switcher and `login-03` for URL + password onboarding. Remove their demo
  content and wire real `RunnerRegistry` state; do not replace the existing
  conversation layout with a generic dashboard.

### 4.5 Multi-runner client model

**Runner identity is server-generated.** The bootstrap payload (inline and
`/api/runtime/bootstrap`) gains:

```ts
runner: {
  instanceId: string;   // generated once, stored in the settings table
  name: string;         // user-configurable display name
  version: string;      // package version
  apiRevision: number;  // monotonically bumped on breaking API change
  capabilities: string[]; // additive feature/domain capability ids
}
```

Identity travels with the dataset: a restored/cloned database keeps its
`instanceId` (documented rule), and `omni runner rekey` mints a new identity
for deliberate clones. The client never treats two simultaneously reachable
endpoints with one identity as interchangeable — it flags the conflict.

Client-side profile:

```ts
type RunnerProfile = {
  id: string;                 // client uuid for list keys only — NOT identity
  runnerInstanceId?: string;  // learned at first successful login/connect
  label: string; baseUrl: string;
  savedPassword: string | null; // local convenience copy; clear/forget removes it
  authTransport: "cookie" | "bearer";
  credentialRef?: string;     // token lives behind the platform credential store
  schemaVersion: 1;
  createdAt: string; lastConnectedAt?: string;
};
```

- Identity rules: after login, the profile pins `runnerInstanceId`. If
  `baseUrl` later resolves to a different instance id → connection blocked
  with an explicit mismatch warning (log in again to accept). Editing
  `baseUrl` revokes/removes the local session credential. Two profiles
  resolving to the same instance id are flagged as duplicates. Authorization
  headers are never forwarded across redirects.
- API compatibility: `src/shared/api-revision.ts` publishes a supported
  revision window `[minimum, current]` and a deprecation policy that retains at
  least the previous two released revisions. Additive features gate on
  `capabilities` and degrade only that feature with an explained badge.
  Hard-blocking is reserved for revisions that break bootstrap/snapshot/event
  transport itself; equal-compatible revision with a different package version
  remains usable with an info badge.
  `src/shared/api-revision.ts` also records the declared classification for
  every route-contract fixture change: additive route/optional field changes
  must add/extend a capability without a revision bump; only
  bootstrap/snapshot/SSE-frame breaking changes may bump the revision and
  update `minimum`. Tests fail on an undeclared or misclassified contract diff.
  Same-origin mismatch triggers a service-worker update + one guarded reload;
  remote mismatch remains blocked. A valid same-origin session automatically
  re-pins after `omni runner rekey`; remote profiles require explicit login.
- **RunnerRegistry** (persisted): profiles + `activeRunnerId`, versioned
  schema (`schemaVersion`) with forward-migration and corrupt-store recovery
  (reset to same-origin default + toast, never a crash). Storage:
  `localStorage` on web/PWA (per-origin; the implicit same-origin runner is
  always present as a non-deletable profile); Electron profiles live in the
  main-process store; Capacitor profiles live in native preferences; VSCode
  profiles live in extension global state. Credential material uses the
  platform stores from §4.3.8.
- **Electron security boundary**: remote HTTP/SSE happens in the **main
  process** (mirroring the proven VSCode extension-host bridge pattern,
  `src/vscode-extension/bridge.ts`); the renderer gets an IPC-backed
  `RuntimeAPIs` implementation and never sees bearer tokens. IPC surface is
  validated per-channel; external links open in the OS browser; navigation is
  locked to the bundled SPA. `safeStorage.isEncryptionAvailable()` is checked:
  when the platform provides no key store, tokens are session-only (or
  persisted plaintext only after explicit user consent), and the degraded
  state is surfaced — never silently claimed as encrypted.
- **Electron migration**: Electron becomes remote-only in M6 and no longer
  starts an in-process runner. M2 adds a compatibility export bridge that
  copies the legacy renderer's preferences/drafts into Electron `userData`;
  M6 imports them into the new main-process profile/preferences store before
  loading `app://omniharness`. On first remote-only launch, it probes the
  legacy `http://127.0.0.1:3050` address and offers it as a profile when
  reachable. Otherwise the onboarding screen clearly offers "connect a remote
  runner" or documented `pnpm runner` startup instructions. The release notes
  call this process split out as a breaking operational change; the desktop app
  never silently launches or owns a runner.
- **Capacitor security boundary**: native projects allow navigation only to the
  bundled interface, validate every bridge method, open external URLs through
  the OS, and use Keychain/Keystore-backed credential storage. The native
  networking adapter attaches bearer tokens and obtains stream tickets; no
  token is placed in WebView storage, a URL, or a JavaScript bridge response.
- **Per-runner connection scope.** Everything currently keyed to "the server"
  becomes owned by a `RunnerConnection` created per profile: `RuntimeAPIs`
  instance, `LiveEventConnectionManager` (transport-neutral stream + cursor),
  `EventStreamStateManager`, snapshot cache, `WorkerEntriesManager`,
  notification manager. React context provides the *active* connection;
  TanStack Query keys use `runnerInstanceId` after identity is known, with the
  profile id only as a pre-login fallback and an atomic one-time cache/draft
  rekey when identity is learned.
- **Concurrent connection contract**: `RunnerRegistry` owns one
  `RunnerConnection` for every saved authenticated profile. All connections
  remain open while the app process is active, independently resume their SSE
  cursor, keep their cached run lists current, and retry with exponential
  backoff capped at five minutes. Switching changes only which connection is
  rendered; it does not close streams or cancel HTTP mutations. Offline and
  needs-reauth profiles keep their last non-authoritative cache for explicit
  stale display but never satisfy a fresh-load gate.
  - Each profile keeps one main event stream. Terminal streams belong only to
    the active visible connection; switching detaches them and reactivation
    reloads bounded scrollback before tailing again. M4 must first verify that
    `/api/terminals/:id/stream` already provides a bounded replay window on
    attach; if not, M4 adds that server contract before M5 client wiring. This
    prevents inactive PTY output from growing client memory and avoids
    exhausting browser HTTP/1.1 per-origin connection limits.
  - Worker/snapshot preview caches are size-bounded per connection and globally
    LRU-evicted; eviction never affects server authority or persisted drafts.
  - There is no product-level profile cap: every saved authenticated runner
    retains its main stream while the process is active. Retry timers are
    jittered so a network return does not create a reconnect storm. If a
    platform refuses another socket/resource, that profile enters explicit
    `deferred` rather than pretending to be offline and retries immediately
    when selected or capacity returns.
- **State invariants** (per `client-server-state-invariants`):
  - Ownership: all domain state belongs to the runner; the client persists
    only runner profiles, UI preferences, and drafts. Drafts are keyed by
    (`runnerInstanceId`, `conversationId`) after identity is known so switching
    runners never leaks a draft.
  - Provenance: every snapshot/event frame is tagged with runner scope at the
    connection layer; reducers reject frames whose scope doesn't match.
  - Freshness: each connection bootstraps from a scoped snapshot, then tails
    epoch-aware SSE. Epoch mismatch or an evicted cursor produces
    `stream.resync_required` and a complete scoped re-bootstrap. The cursor is
    persisted per `runnerInstanceId` in the platform profile store, cleared on
    resync/identity change, and never shared between profiles.
    Resync has its own governor: more than three resyncs for one profile in a
    rolling five-minute window applies jittered exponential delay before the
    next snapshot fetch (capped at five minutes) and marks the profile
    degraded. One slow connection cannot create a snapshot/resubscribe storm.
  - Scope completeness: a runner connection's always-live global catalog
    snapshot may populate navigation, but it must never satisfy or bypass a
    selected conversation's full-load gate. Selecting `/session/:runId`
    always starts or reuses a run-scoped snapshot and SSE connection carrying
    that `runId`; global updates cannot overwrite the scoped authority while
    the conversation is selected.
  - Mutations carry their `runnerId`. A mutation completing after a switch is
    **not** treated as cancelled: its cache updates apply to the originating
    runner's query keys (which may not be on screen), and failures surface
    as a notification naming the runner. Run/conversation ids are only unique
    per runner; all URL deep links (`/session/:runId`) resolve against the
    active runner only.
  - Races to test: rapid switching while every stream remains live; mutation
    resolving after switch; simultaneous events with the same run id from two
    runners; credential revocation (401 → only that profile becomes
    needs-reauth); process restart with an old epoch; instance-id mismatch;
    identity-learned cache/draft rekey; corrupt profile/credential stores.
- **Status derivation**: health failure means `offline`; health success followed
  by bootstrap 401 means `needs-reauth`; authenticated bootstrap with an
  unsupported revision means `incompatible`; identity change means
  `identity-mismatch`; certificate validation failure means `tls-untrusted`;
  platform socket/resource refusal means `deferred`; only snapshot authority
  plus a live stream means `connected`.

### 4.6 The 29 direct-fetch call sites

`RuntimeAPIs` defines transport-neutral request and stream primitives before
the migration starts. No shared consumer mentions `EventSource`, Electron IPC,
or a Capacitor plugin:

```ts
type RuntimeStream = {
  onOpen(listener: () => void): () => void;
  onFrame(listener: (frame: RuntimeStreamFrame) => void): () => void;
  onError(listener: (error: RuntimeApiError) => void): () => void;
  close(): void;
};

openStream(input: {
  path: string;
  cursor?: string | null;
  signal?: AbortSignal;
}): Promise<RuntimeStream>;
```

The web adapter obtains a stream ticket and constructs `EventSource`; Electron
and Capacitor hosts obtain tickets and forward parsed frames over validated
bridges; VSCode does the same in its extension host. Every request adapter
disables redirects in its platform-native HTTP stack. Ticket acquisition and
credential attachment remain below the shared interface boundary.

All migrate to methods on the per-runner `RuntimeAPIs` (extending
`src/runtime-api/types.ts` with the missing domains: runs, git, fs, attachments,
projects/memory, planning, accounts, notifications, terminals). Mechanical but
wide; `useHomeMutations.ts` (1,269 lines) is split by domain as part of the
migration (conversations / runs / planning / settings) to stay under the
1200-line rule. `InteractiveTerminal.tsx`'s `EventSource` goes through the
connection's ticket-aware stream opener.

### 4.7 Filesystem semantics

Paths shown in the UI (project pickers, file viewer, attachments) already flow
through runner APIs (`/api/fs`, `/api/fs/files`, `/api/attachments`) — they are
**runner paths** and keep working remotely. Co-location is a capability, not a
heuristic: desktop users may explicitly mark a profile as co-located. The
Electron app does not launch or own a runner process in v1. Only co-located
profiles offer `native.chooseFolder()` and OS editor links
(`project-file-links.ts`); everything else uses the `/api/fs` picker dialog and
the in-app file viewer. "localhost" in a URL proves nothing (SSH tunnels) and
is not used as a signal.

### 4.8 Notifications

- Web/PWA while open: every connected runner can produce an in-app
  notification naming the runner. Web push remains limited to the PWA's
  hosting runner because one service-worker registration holds one VAPID
  subscription.
- Electron and Capacitor: the native host observes notification-worthy events
  from every connected runner and posts a local notification naming the
  runner while the app process is active. Reliable notifications after a
  mobile OS suspends or kills the process require native push and are not part
  of this v1 acceptance contract.

## 5. User stories (v1 acceptance)

1. **Lean local dev** — As the builder, I run `pnpm dev` and get runner + Vite;
   combined RSS < 2 GB under the scripted workload (§4.1); the dev UI at
   Vite's port behaves identically to the current app. *(Acceptance: full
   existing e2e suite passes in packaged mode — built SPA served from the
   runner port — which is also the production parity gate.)*
2. **Headless runner** — I run `pnpm runner` on a box with no display; it
   serves API, SSE, and the built UI on one port (or API-only without
   `dist/interface`); `omni` CLI and `tests/lifecycle` drive it end-to-end.
3. **Phone/PWA** — I install the interface from one runner, add other runners
   with URL + shared password, and supervise any of them. If the hosting runner
   is down, the offline shell still opens and connects to the others.
4. **Native mobile** — I install the iOS or Android app, add runners with URL +
   shared password, and use the same terminal/composer/supervision interface.
   Session tokens persist in Keychain/Keystore and all profiles remain
   connected while the app process is active.
5. **Electron remote** — In the desktop app I add multiple runners by URL +
   shared password, see live status for all of them, switch without closing
   inactive streams, and receive runner-named notifications; tokens never
   reach the renderer.
6. **Failure honesty** — Unreachable runner → explicit offline banner with URL
   and error detail; reconnect resumes via the epoch-aware SSE cursor; 401 → named runner
   + password login CTA; process epoch mismatch → snapshot resync;
   instance-id mismatch → blocked with explanation.
7. **Return visit** — Runner profiles, active selection, per-runner drafts, and
   UI preferences survive restart on web, PWA, Electron, iOS, and Android; a
   corrupted profile or credential store recovers safely with a visible notice.
8. **Lost device/password rotation** — From an authenticated runner I can list
   sessions, revoke a lost device, and watch only that client transition to
   needs-reauth. Changing the shared password revokes all sessions unless I
   explicitly retain them.
9. **Graceful stop** — When a runner stops, every connected client shows
   "runner stopping," backs off, and does not create a snapshot/reconnect storm.
10. **Upgrade from current Electron** — Existing preferences and drafts are
    imported; the app either offers the reachable legacy local runner or gives
    exact instructions for starting/connecting a runner instead of failing.
11. **Profile administration** — I can save an unreachable URL as an offline
    profile, edit it (which clears its credential), forget it, rename a runner,
    and recover a same-origin PWA after an API revision/service-worker skew.
12. **API-only runner** — Electron, Capacitor, VSCode, and CLI can use a runner
    with no static interface artifact; web navigation receives the documented
    informational page without affecting API/SSE behavior.
13. **Mixed-version fleet** — A current interface remains connected to runners
    at revisions R and R-1 simultaneously. The older runner remains usable and
    only unsupported capabilities are hidden/explained; transport-incompatible
    revisions alone are blocked.
14. **Connection scale** — With eight saved authenticated runners, all main
    streams remain live with < 40 MB incremental RSS per additional fixture
    runner and < 750 MB aggregate client process-tree RSS in the controlled
    local benchmark. Network loss and restoration produces jittered reconnects
    rather than a thundering herd; platform resource refusal is shown as
    `deferred`.

Switcher status states: connected / connecting / offline / needs-reauth /
incompatible (transport revision) / identity-mismatch / tls-untrusted /
deferred.

Onboarding: Electron and Capacitor first launch show "Connect a runner"
(URL + shared password). Web/PWA starts with its non-deletable same-origin
profile and uses the same form to add remote runners.

## 6. Error transparency & instrumentation

- Existing posture (full error details + stack traces to the frontend) is
  preserved; `update_error` SSE frames and `app-errors.ts` flows unchanged —
  with the §4.3.9 redaction rules applied to credentials/tickets.
- New named events: `runner.bridge_ready`, `runner.bridge_unavailable`,
  `runner.static_ui_enabled`, `runner.static_ui_missing`, `runner.stopping`
  (also sent as the SSE goodbye frame), `auth.bearer_issued`,
  `auth.bearer_origin_rejected`, `auth.login_origin_rejected`,
  `auth.stream_ticket_issued`, `auth.stream_ticket_rejected`,
  `auth.login_rate_limited`, `auth.session_revoked`, plus existing
  `runtime.started/stopped`.
- User-relevant server failures additionally emit `error.surfaced` with new
  stable codes such as `runner.bridge.unavailable`,
  `runner.static_ui.missing`, `runner.auth.invalid`,
  `runner.auth.ticket_failed`, and `runner.network.insecure`. Client-owned
  failures (profile corruption, offline, compatibility and identity mismatch)
  live in the per-profile `RunnerConnection` diagnostics and notification
  manager because there may be no trustworthy runner to receive a server
  event.
- Client-side connection lifecycle is logged per profile through
  `LiveEventConnectionManager` diagnostics. Client-owned failures have stable
  codes; the switcher renders the already-redacted server/client message and
  tests assert the code rather than matching prose.
- Control plane: everything remains scriptable headless (`tests/lifecycle`
  already proves this). `omni` CLI gains `--runner <url>` plus token via
  `OMNI_TOKEN` env / `--token-file` / stdin — never a bare `--token` argv
  (shell history, `ps`) except as an explicitly warned compatibility flag.

## 7. Testing strategy

- **Unit/integration (vitest)**: streaming server (SSE via `startOmniServer`:
  heartbeat, epoch-aware cursor resume without duplicates, client-disconnect
  cleanup, backpressure, flush-per-frame through a compressing proxy,
  restart-epoch mismatch and id-bearing resync, non-reading consumer eviction
  with flat memory); password bearer auth (origin
  binding, wrong-origin rejection, preflight, redirect non-forwarding,
  trusted-proxy rate-limit identity, browser authorization
  state/S256-only PKCE bounds/origin/code replay/no-CORS-credentials);
  session list/revoke/expiry/max-count/password
  rotation; stream tickets (single-use atomicity,
  expiry, concurrent redemption, reconnect-with-fresh-ticket); static serving
  (bootstrap JSON
  escaping incl. `</script>`/U+2028, SPA-fallback scope, 404s for `/api/*`,
  traversal rejection, cache headers, CSP-manifest hash); RunnerRegistry
  (schema migration, corruption recovery, identity pinning/mismatch,
  baseUrl-edit credential clearing, identity rekey); concurrent connection
  races (§4.5 list), resync governor, inactive-terminal detachment and bounded
  caches; network exposure/TLS pin/re-pin policy; native-login header/CORS invariants;
  route-contract/api-revision/capability coupling; same-origin service-worker
  skew recovery and cross-origin SW pass-through.
- **Route parity gate before deleting Next adapters**: table-driven test
  hitting every registry route through both the Next adapter and
  `startOmniServer`, comparing status, headers (incl. cookies), and body
  semantics; includes multipart upload. Stateful routes run against isolated
  per-adapter fixtures (separate DB/data dirs), not sequentially on one DB.
  SSE endpoints compare status/headers plus a bounded sequence of normalized
  frames, then abort and assert subscriber cleanup (streams never "complete").
  `Set-Cookie` comparison normalizes attribute names/order while preserving
  values and security semantics.
  After the Next adapters are removed, the generated route/response contract
  fixtures remain as a standalone-registry regression suite rather than
  deleting the coverage with the adapters.
- **Lifecycle suite** (`tests/lifecycle`) runs against `scripts/runner.ts` —
  the primary backend regression gate.
- **Playwright e2e**: existing suites repointed at the runner-served SPA; new
  two-runner spec (two runner processes, separate DBs/data dirs/ports/
  identities): add with password → keep both streams live → switch → restart
  one runner → epoch resync. Browser cross-origin spec: SPA from runner A logs
  into and talks to runner B.
- **Eight-runner scale harness**: deterministic fixture runners with all main
  streams live; record per-connection and aggregate client RSS; disconnect and
  restore the network; assert bounded/jittered reconnect load and explicit
  `deferred` state if the platform refuses capacity.
- **Electron/VSCode**: `tests/electron` updated for the IPC RuntimeAPIs and
  main-process networking; `tests/vscode` updated for the new default port +
  bearer wiring ("behavior unchanged" still requires these test updates).
- **Capacitor**: unit tests for the bridge contract and credential adapter;
  Android Gradle and iOS Xcode build/sync smoke checks; a mobile-viewport
  packaged-interface Playwright suite for shared UI behavior; packaged CSP
  proves direct WebView fetch to a runner is blocked.
- **Candidate agentic user-journey tests** (require approval before running):
  (a) phone-viewport PWA password login + send message against two runners;
  (b) Electron keeps two runners connected and recovers one from restart;
  (c) Capacitor Android/iOS shell logs in, switches, and returns to saved
  profiles.

## 8. Milestones

Resequenced so the bundle boundary exists before Vite is introduced and
multi-runner ships dark until every request path is scoped:

**M1 — Boundaries + standalone runner** *(Next still serves the UI)*
Move shared runtime values/types (including worker labels, entry types, and
planning review preferences) into `src/shared`; add interface/runner/shared
typecheck projects and import-boundary lint rules. Define the
transport-neutral request/stream contract used by web, IPC, VSCode, and
Capacitor before migrating callers. Implement stream epochs and
the streaming server fix; `scripts/runner.ts` with non-fatal managed-bridge
controller, lifecycle/shutdown contract, isolated instance configuration,
`healthz`; remove `next/server` dependencies from auth/api-errors; add the
route-parity rig and run lifecycle against the runner.

**M2 — Interface on Vite, Next deleted**
`apps/interface`; layout ported; Next-isms removed; static-serving contract +
bootstrap injection/CSP manifest; `app-shell.html` SW/PWA contract;
`pnpm dev` = runner + Vite;
route-parity + Playwright green; then delete `src/app/api/*`, page/layout/
instrumentation, `next.config.ts`, Next deps; `src/app/home/` →
`src/interface/home/`; memory acceptance measured.
*Transitional shell contract*: Electron switches to loading the Vite
production bundle in this milestone while keeping its current local runtime
transport (it must not break for four milestones); VSCode's default port
moves off the retired 3035 here too, with its regression test.

**M3 — Transport unification** *(no user-visible change)*
all 29 call sites through `RuntimeAPIs`; `useHomeMutations.ts` split by domain;
query keys and drafts gain a stable runner-scope prefix (still always local).

**M4 — Shared-password remote auth protocol** *(dark: no switcher UI yet)*
Bearer sessions with stored-provenance origin binding (existing
`auth_sessions` rows migrate to `transport: "cookie"` without invalidating
live sessions); native password bearer login; same-origin browser
authorization-code + PKCE flow; session list/revoke routes and CLI; password
rotation semantics; stream tickets +
reconnect ownership in `LiveEventConnectionManager`; preflight handling;
trusted-proxy/rate-limit contract; first-run password provisioning; runner
identity (`instanceId`, editable `name`, `apiRevision`) in bootstrap and
settings route; network-exposure policy + redaction; `omni --runner` flags;
VSCode gains bearer wiring here.

**M5 — Concurrent multi-runner UI (web/PWA)**
RunnerRegistry persistence (+ migration/recovery); `RunnerConnection` scoping
and all-profile lifecycle/retry; switcher adapted from shadcn `sidebar-07`;
URL+password onboarding adapted from `login-03`; status states; drafts keyed
per identity; session administration + runner-name controls; inactive-runner
notifications; two-runner Playwright +
cross-origin browser specs pass. Switcher controls stay hidden in Electron
until M6.

**M6 — Electron + VSCode remote clients**
Main-process networking + IPC RuntimeAPIs; `safeStorage` tokens; co-location
capability gating for native pickers/editor links; switcher enabled in
Electron; VSCode `SecretStorage`; all-profile native notifications;
`tests/electron` and `tests/vscode` updated.

**M7 — Capacitor iOS + Android**
`apps/mobile` Capacitor project; iOS and Android native projects; native
`RuntimeAPIs` networking/SSE bridge; Keychain/Keystore credential adapter;
external-link and local-notification capabilities; safe-area/mobile layout
verification; build/sync smoke checks and packaged mobile acceptance.

Each milestone leaves all already-shipped shells working; M1–M3 are guarded by
parity tests, M4 ships dark, M5 turns concurrent multi-runner on for web/PWA,
M6 completes desktop/VSCode, and M7 completes the approved native platforms.

## 9. Risks & trust surfaces

- **Exposing runners on a network** is the point of this work. Mitigations:
  required shared password, refusal of plaintext non-loopback bearer login,
  origin-bound bearer sessions, single-use path-bound stream tickets,
  platform secure storage, no credentialed redirects, redaction, and
  rate-limited login.
  Docs recommend tailscale/tunnels over raw port-forwarding.
- **SSE through proxies/tunnels**: heartbeats exist; streaming rewrite must
  flush per-frame (tested through a compressing proxy — the scenario that
  motivated `dev-compression-proxy.ts`).
- **Single-process API server** remains a hard constraint (in-memory event
  bus/PTYs). Documented; horizontal scaling is a non-goal.
- **Churn risk**: M3 touches 29 files. Mitigated by per-domain mechanical PRs,
  parity tests, and shipping dark until M5.
- **Native-shell regression risk**: IPC/bridge and secure-storage contracts are
  covered by Electron/VSCode tests in M6 and Capacitor build/bridge tests in M7.
- **Mobile background limitation**: concurrent streams stay open while the app
  process is active; native push after suspension is a separate product
  capability and is not implied by local notifications.

## 10. North star & future direction (context, not commitment)

One interface, installed anywhere, showing all your runners: merged
cross-runner dashboard, cross-runner native push relay, runner health/resource
panel, Tauri as a possible desktop alternative, package extraction (Approach
B) once boundaries settle, and runner-to-runner work handoff.

## 11. Implementation gates

1. "Runner" remains one logical deployment consisting of the API server and
   co-located ACP bridge processes.
2. Before retiring the 3035 compression proxy, audit every consumer (scripts,
   docs, tunnels, VSCode settings) and update it in the same milestone.
3. Calibrate the memory thresholds (< 2 GB dev, < 1 GB production runner)
   against the controlled M1 baseline before treating them as failures.
4. Capacitor builds must use local developer signing configuration only;
   signing certificates, provisioning profiles, keystores, SDK caches, and
   generated release artifacts never enter the repository.
