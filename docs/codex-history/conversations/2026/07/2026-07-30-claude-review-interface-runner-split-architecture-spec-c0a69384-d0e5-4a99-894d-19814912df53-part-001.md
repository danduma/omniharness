---
provider: "claude"
codex_thread_id: "c0a69384-d0e5-4a99-894d-19814912df53"
title: "Review Interface/Runner split architecture spec"
started_at: "2026-07-30T21:59:21.529Z"
updated_at: "2026-07-30T22:03:10.003Z"
working_directory: "/Users/masterman/NLP/omniharness"
archive_status: "unknown"
part: 1
parts: 1
---

# Review Interface/Runner split architecture spec

> This archive contains Claude Code conversation activity, stored thinking blocks, tools, and subagents. Raw system prompts and credentials are excluded.
<!-- codex-event:{"kind":"state","timestamp":"2026-07-30T21:59:21.529Z","phase":null} -->
## Claude state: queue-operation · 2026-07-30T21:59:21.529Z

````text
{
  "type": "queue-operation",
  "operation": "enqueue",
  "timestamp": "2026-07-30T21:59:21.529Z",
  "sessionId": "c0a69384-d0e5-4a99-894d-19814912df53",
  "content": "You are my second-opinion architecture-spec reviewer. Use only the artifact included below. Do not inspect or edit files and do not call tools.\n\nUser goal: fully implement one logical OmniHarness runner plus a shared interface shipped as web/PWA, Electron desktop, Capacitor iOS/Android, and VSCode. Every client can save arbitrary runners and keeps all authenticated runner connections live while its process is active. Authentication uses the existing single shared runner password; login issues per-device revocable cookie or bearer sessions.\n\nRepository constraints: one package for now; server decisions emit typed events plus error.surfaced; every SSE frame carries an id; client state is Manager-owned and runner-scoped; no fake functionality.\n\nPlease judge whether this revised spec is ready to turn into a file-by-file implementation plan. Look for contradictions, missing security/state/persistence/mobile/runtime details, bad sequencing, untestable requirements, and acceptance gaps.\n\nReturn exactly:\n1. Verdict: READY or HARDEN\n2. Highest-impact findings, with concrete fixes\n3. Anything you would deliberately leave alone\n\nArtifact:\n# Interface / Runner Split — Design\n\nDate: 2026-07-29\nStatus: Approved direction; hardened for implementation on 2026-07-30\n\n## 1. Goal\n\nSplit OmniHarness into two independently runnable pieces:\n\n- **Runner** — one logical headless service that owns all domain state and processes:\n  SQLite, supervisor, agent-runtime bridge, PTY terminals, SSE event stream, auth.\n  No Next.js. Serves only data (plus the static interface bundle for the web/PWA\n  path). A runner deployment is managed as one unit even though the API server\n  and ACP bridge remain separate co-located processes internally.\n- **Interface** — a self-contained static React SPA (Vite build) that connects to\n  one or more runners over HTTP + SSE. Ships as: web page served by any runner,\n  installable PWA, Electron desktop app (macOS/Windows/Linux), Capacitor native\n  apps (iOS/Android), and the existing VSCode shell. Every installed client can\n  save any number of runners and keeps all authenticated profiles connected\n  while the app process is active.\n\nMotivations, in priority order:\n\n1. Interface installable on a phone/laptop connecting to **multiple remote\n   runners**.\n2. Backend runs as a lean process that does not also host a frontend toolchain\n   (Next dev today balloons to 8 GB+ RSS).\n3. Web version keeps working exactly as it does now (same URL shape, same UI).\n\n## 2. Decisions already made (user-confirmed)\n\n| Decision | Choice |\n|---|---|\n| Next.js | **Remove.** Interface becomes a Vite SPA; runner serves the built bundle and injects the bootstrap JSON into `index.html` at serve time (preserves today's zero-round-trip boot; verified that the app tree is `ssr:false` and SSR only emits the BootShell skeleton + bootstrap blob). |\n| Native shells v1 | **Electron desktop** (existing `apps/electron`, converted to a pure remote client) plus **Capacitor iOS/Android** (`apps/mobile`, sharing the Vite bundle). PWA and VSCode remain supported. Tauri is out of scope. |\n| Multi-runner UI v1 | **Runner switcher with concurrent connections**: save N runner profiles; keep every authenticated profile connected while the app is active; show one runner's workspace at a time. Merged cross-runner views remain out of scope. |\n| Backend topology | **Keep two services** as today: the omni API server and the agent-runtime bridge (port 7800) stay separate processes. Clients only ever talk to the API server; the bridge keeps binding to localhost by default (`OMNIHARNESS_AGENT_RUNTIME_HOST`). A \"runner\" deployment = both processes co-located on one machine sharing one filesystem, managed by one start script. |\n| Authentication v1 | **One shared runner password.** Cookie clients and bearer clients use the same password login. Login creates a separately revocable session token; clients never store the password. Pairing tokens and QR authentication are not required by the new client flow. |\n\n## 3. Verified current state (what we build on)\n\nThe split is substantially pre-architected:\n\n- **Portable route registry**: `src/runtime/http/routes/index.ts` registers all 63\n  method+path pairs framework-free (Fetch Request/Response). All 49 Next API\n  routes are thin adapters over it.\n- **Standalone server**: `src/runtime/http/server.ts` (`startOmniServer`) exists,\n  with `staticDir` support — but cannot stream (buffers `arrayBuffer()`), so the\n  two SSE endpoints (`/api/events`, `/api/terminals/:id/stream`) do not work\n  through it yet.\n- **Client transport abstraction**: `src/runtime-api/` (`RuntimeAPIs` interface;\n  `web.ts` already takes `baseUrl` + injectable `fetch`/`EventSource`).\n- **Non-Next entry**: `src/ui/render-web.tsx` mounts `<OmniApp>` without Next.\n- **Bootstrap over HTTP**: `GET /api/runtime/bootstrap` already mirrors the SSR\n  bootstrap for Electron/VSCode.\n- **Transports**: HTTP JSON + SSE only. No WebSockets, no server actions, no tRPC.\n\nKnown debts that gate the split (from exploration):\n\n- **(B) Streaming**: standalone server buffers responses; SSE endpoints hang.\n- **(C) Auth**: cookie + `SameSite=Lax` + `enforceSameOrigin` on all mutations +\n  zero CORS headers → a cross-origin interface cannot authenticate.\n- **(D) Runner identity**: `RuntimeAPIs` is a flat singleton; managers, SSE\n  cursor, and query caches assume \"the one server\".\n- **(H) 29 files** still hardcode `fetch('/api/...')`/`new EventSource('/api/...')`\n  instead of going through `RuntimeAPIs` (list in\n  `docs/architecture/common-runtime-multi-surface.md` §\"debt\").\n- **(G) Client→server imports**: `src/server/workers/entries-types.ts` (types),\n  `src/server/planning/review-preferences.ts` (runtime zod import) are imported\n  by client components.\n- **(A) Same-process event bus**: `src/server/events/named-events.ts` ring +\n  `live-updates.ts` listener set are module-level memory → the API server must\n  remain a single process. This is accepted and documented, not changed.\n\n## 4. Target architecture\n\n### 4.1 Repository shape (Approach A — in-place, two build targets)\n\nStay one pnpm package for now. Two build targets with an enforced boundary,\nno mass file moves:\n\n```\nsrc/server/       → runner only (never bundled into interface)\nsrc/runtime/      → runner only (HTTP registry, standalone server, bootstrap)\nsrc/shared/       → NEW: types + pure logic importable by both sides\nsrc/lib/          → interface-leaning isomorphic helpers (already clean)\nsrc/runtime-api/  → interface transport layer (multi-runner aware)\nsrc/ui/, src/components/, src/interface/home/ → interface\napps/interface/   → NEW: Vite app (index.html, vite.config.ts, entry that\n                    reuses src/ui/render-web.tsx)\napps/electron/    → existing shell, becomes pure remote client\napps/mobile/      → NEW: Capacitor shell with iOS + Android native projects\napps/vscode/      → behavior unchanged; port/auth wiring updated\nscripts/runner.ts → NEW: runner entrypoint (replaces Next start for backend)\n```\n\n`src/app/` (Next) is deleted at the end of Milestone 2; `src/app/home/` is\ninterface code and moves to `src/interface/home/` (import-path rename only) so\nthe `src/app` deletion is clean.\n\nBoundary enforcement:\n- ESLint `no-restricted-imports`: anything bundled by Vite may not import\n  `@/server/*` or `@/runtime/*` (only `@/shared/*`).\n- The two offending imports (G) move: `entries-types.ts` and\n  `review-preferences.ts` → `src/shared/`, with re-export shims left at the old\n  paths for server-side importers.\n- Vite build failing on a server import is the backstop.\n- Typechecking is split: separate `tsc --noEmit` projects for runner\n  (`src/server` + `src/runtime`), shared, and interface, so a server-only type\n  error can't hide in the SPA project and vice versa.\n\n**Production artifact contract** (what a headless box installs):\n- `pnpm build` → `dist/interface/` (hashed static assets + `index.html`\n  template). The runner itself keeps running from source via `tsx`\n  (existing convention in `scripts/start.ts`); no Vite, Next, or watcher runs\n  in production.\n- Runner with `dist/interface` present → serves SPA + API. Absent → **API-only\n  mode**: `/` returns a plain informational page, a named event\n  `runner.static_ui_missing` is emitted, and everything else works (this is a\n  supported deployment, not an error). If `--static-dir` is passed explicitly\n  and missing, startup fails loudly.\n- `pnpm electron:build` packages that same interface bundle in Electron.\n  `pnpm mobile:sync`, `pnpm mobile:build:ios`, and\n  `pnpm mobile:build:android` synchronize and build the Capacitor projects.\n  Native generated outputs, signing material, and local SDK state remain\n  ignored; native project source and configuration are versioned.\n- Memory acceptance: measured via `scripts/measure-local-dev.mjs` over the\n  **whole process tree** (API process, bridge, gateway children, plus\n  Vite/watchers in dev) — dev combined RSS **< 2 GB**, production runner\n  **< 1 GB** — recording both peak and end-of-workload RSS after a scripted\n  10-minute conversation workload. A controlled local benchmark gate, not a\n  CI-hardware assertion. (Today's Next dev process alone exceeds 8 GB.)\n\n**Rejected alternatives**:\n- *Approach B — full monorepo package extraction* (`packages/shared|runner|interface`):\n  cleaner end state but moves ~460 files, breaks every open branch, buys\n  nothing functional now. Revisit after the split is proven.\n- *Approach C — keep Next as frontend host*: rejected by user (RAM, second\n  pipeline).\n\n### 4.2 Runner\n\n**Entrypoint** `scripts/runner.ts`:\n1. `await dbReady` (schema init).\n2. Start supervisor watchdog (`ensureSupervisorRuntimeStarted()`).\n3. Start Claude model gateway (`ensureClaudeModelGatewayStartedAtBoot()` + shutdown hooks).\n4. Start/adopt the bridge through an extracted `ManagedBridgeController`\n   (lockfile, health checks, build/install, retry, ownership). Unlike today's\n   `scripts/dev.ts`, initial bridge failure is non-fatal: the controller enters\n   `starting`/`unavailable`, retries with bounded exponential backoff, and emits\n   lifecycle events while the API remains available.\n5. `startOmniServer({ staticDir, port })` — one HTTP port for API + SSE + SPA.\n\nThis replaces `src/instrumentation.ts` (deleted with Next).\n\n**Lifecycle contract**:\n- `GET /api/healthz` (liveness, no auth, no state) and readiness reflected in\n  the existing bootstrap route. Bridge unavailable at boot → runner starts,\n  serves UI/API, reports `bridge: \"starting\" | \"unavailable\"` in bootstrap and\n  emits `runner.bridge_unavailable`; bridge crash → existing supervisor\n  sync/retry behavior, surfaced as named events (`runner.bridge_ready` on\n  (re)connect). Port conflict → fail fast; the owning pid is reported\n  best-effort via the runner's own lockfile (bridge-lock pattern), since bind\n  errors don't carry it cross-platform. Shutdown order: stop accepting new\n  connections → send a dedicated `runner.stopping` frame to open SSE streams\n  (NOT `stream.resync_required`, which would trigger snapshot reloads against\n  a dying server; clients show \"runner stopping\" and back off) → bounded\n  flush window, then abort remaining readers → PTYs get SIGTERM with a\n  deadline, then SIGKILL → gateway child likewise → bridge: terminated if\n  this runner spawned it, released (lock only) if adopted.\n- Runner and bridge configuration is instance-scoped: API port, bridge URL/\n  port, bridge lockfile, gateway settings, database, and data root are explicit\n  inputs derived from `OMNIHARNESS_ROOT`/`OMNIHARNESS_INSTANCE`. This lets the\n  two-runner test start isolated deployments on one host without shared\n  lockfiles or ports.\n- Every runner process mints a `streamEpoch` at boot. SSE ids are\n  `<streamEpoch>:<sequence>`, and bootstrap includes the current epoch. A client\n  reconnecting with another epoch always receives an id-bearing\n  `stream.resync_required` frame and reboots from a snapshot. All frames,\n  including `runner.stopping` and resync controls, carry ids; the client\n  persists their epoch-aware cursor.\n\n**Streaming fix (prerequisite for everything)**: `writeFetchResponse` in\n`src/runtime/http/server.ts` pipes `Response.body` (Web `ReadableStream`) to the\nNode `ServerResponse` chunk-by-chunk, flushes headers immediately, disables\nNagle for `text/event-stream`, and destroys the upstream reader on client\ndisconnect. Non-streaming responses keep the buffered path.\n\n**Static serving + bootstrap injection contract**:\n- `GET /` and `/session/:runId` (the deep-link rewrite from `next.config.ts`)\n  serve `index.html` with\n  `<script id=\"omni-bootstrap\" type=\"application/json\">…</script>` injected —\n  same payload semantics as today's SSR (`includeInitialData: false`). JSON is\n  serialized with `<`, `>`, `&`, U+2028, U+2029 escaped so it cannot terminate\n  the script element.\n- SPA fallback applies only to GET navigations without a file extension that\n  aren't `/api/*`. `/api/*` and missing assets return proper 404s — never\n  `index.html`.\n- Hashed assets: `Cache-Control: public, max-age=31536000, immutable`.\n  `index.html`: `no-store` (it contains per-request auth state).\n- Vite emits `dist/interface/csp-manifest.json` containing the approved inline\n  theme-script hash and asset metadata. The runner validates it at boot; an\n  explicit static directory with a missing/mismatched manifest fails loudly.\n- Static file resolution rejects path traversal and does not follow symlinks\n  out of `staticDir`.\n- **Frontend security policy** (browser tokens live in `localStorage`, so\n  same-origin script injection is the real threat): interface pages ship a\n  CSP **as an HTTP header** (meta tags can't enforce `frame-ancestors`) —\n  `default-src 'self'`, `script-src 'self' 'sha256-<theme-bootstrap-hash>'`,\n  `style-src`/`font-src`/`img-src`/`worker-src 'self'` (+ `data:`/`blob:`\n  where the app needs them), `frame-ancestors 'none'`, `object-src 'none'`,\n  `connect-src 'self' https: http://localhost:* http://127.0.0.1:*` (bearer\n  runners are user-added HTTPS origins; loopback allowed for dev),\n  `Referrer-Policy: no-referrer`. No third-party scripts, ever. All\n  server-provided content (agent output, errors, project paths) renders\n  through the existing markdown/text pipeline — a test asserts none of it can\n  introduce executable markup.\n- The interface reads the inline blob if present, else falls back to\n  `GET /api/runtime/bootstrap` (Electron / remote / dev / offline-PWA path).\n- Bootstrap injection is a bounded local read path. It never waits for a bridge\n  health probe or reconciliation write; bridge readiness comes from the\n  controller's in-memory read model and is explicitly marked stale/degraded\n  when necessary.\n\n**Ports & processes** (unchanged topology, per user decision):\n- API server: default 3050 (today's web port), configurable.\n- Bridge: 7800, localhost-bound by default. Existing `OMNIHARNESS_*` env vars\n  keep their meanings. The dev compression proxy (3035) is retired with Next\n  dev; the VSCode default `serverUrl` moves to the runner port.\n- `scripts/start.ts`, `controller.sh`, `omni.sh` launch the runner instead of\n  Next.\n\n### 4.3 Auth & cross-origin model\n\nThe runner has one shared password and two session transports against the same\n`auth_sessions` table and expiry/revocation rules. This is deliberately a\nsingle-user trust model: there are no accounts, roles, device pairing secrets,\nor separate mobile credentials in v1.\n\n**Cookie sessions (unchanged)** — for the interface served by the runner itself\n(web + PWA on that runner's origin). `POST /api/auth/login` verifies the shared\npassword, sets the existing `SameSite=Lax` HttpOnly cookie, and\n`enforceSameOrigin` remains enabled on mutations. No CORS is involved.\n\n**Bearer sessions (new)** — for every cross-origin or native client: an\ninterface hosted by runner A talking to runner B, Electron, Capacitor,\nVSCode, the Vite dev server, and the CLI.\n\n1. **Password login and issuance**: `POST /api/auth/login` accepts\n   `{\"password\":\"…\",\"tokenTransport\":\"cookie\"|\"bearer\",\"clientLabel\":\"…\"}`.\n   Cookie remains the default for same-origin compatibility. Bearer login\n   returns one opaque session token in the response body. The password is\n   verified once and is never persisted by a client; every device/profile gets\n   a separately revocable session row.\n\n   Guards accept `Authorization: Bearer <token>`; same-origin enforcement is\n   skipped for bearer requests because the credential is not ambient. Session\n   rows gain stored provenance:\n\n   ```ts\n   transport: \"cookie\" | \"bearer\";\n   boundOrigin: string | null;       // exact browser origin at login\n   clientKind: \"browser\" | \"native\"; // native host made the login request\n   ```\n\n   - A browser bearer session always requires its exact stored `boundOrigin`;\n     missing, different, or `Origin: null` is rejected and audited as\n     `auth.bearer_origin_rejected`.\n   - Electron main, Capacitor native host, VSCode extension host, and CLI use\n     an originless native login transport and receive\n     `clientKind: \"native\", boundOrigin: null`.\n   - Cookie tokens are never accepted as bearer tokens and bearer tokens are\n     never accepted as cookies.\n   - This is browser-origin isolation, not cryptographic token binding. Bearer\n     tokens remain replayable secrets. DPoP/device keys and multi-user roles are\n     outside the approved v1 scope.\n2. **CORS**: browsers enforce CORS, so runner B must answer the interface\n   origin hosted by runner A.\n   - Bearer-form `/api/auth/login` is callable from any non-null HTTP(S) origin\n     with a reflected `Access-Control-Allow-Origin` and no credentials mode.\n     Password attempts use the existing rate limiter.\n   - Bearer requests from the stored `boundOrigin` get exactly that origin\n     reflected with `Vary: Origin`, including error responses.\n   - `GET /api/healthz` allows non-credentialed cross-origin GET and returns\n     only `{\"ok\":true}`—no identity, version, hostname, or state.\n   - Registry-wide `OPTIONS` handles bearer-route preflight with\n     `authorization, content-type`, per-route methods, and a bounded\n     `Access-Control-Max-Age`. Cookie routes never receive CORS headers.\n3. **SSE auth**: browser `EventSource` cannot set headers. Bearer clients call\n   `POST /api/auth/stream-ticket` to create a 60-second, single-use,\n   atomically consumed ticket bound to (session, exact stream path). The ticket\n   is passed in `?ticket=`. Redemption revalidates the session's stored origin.\n   `LiveEventConnectionManager` owns reconnection, closes native EventSource\n   auto-retry on error, fetches a fresh ticket for every connection, and sends\n   the saved epoch-aware cursor. The same mechanism protects\n   `/api/terminals/:id/stream`.\n4. **Network exposure**: authentication is already required by the current\n   application. Binding to a non-loopback host with a missing/invalid password\n   fails at startup. Bearer login and stream-ticket issuance over plaintext\n   non-loopback HTTP are refused. Loopback HTTP remains available for local\n   development; production remote clients use HTTPS/Tailscale/tunnels. There is\n   no unauthenticated network override in the supported product path.\n5. **Trusted proxies and rate limiting**: the runner honors\n   `Forwarded`, `X-Forwarded-Proto`, and `X-Forwarded-For` only when the\n   immediate socket peer is in `OMNIHARNESS_TRUSTED_PROXIES`\n   (addresses/CIDRs). Otherwise protocol and rate-limit identity come from the\n   actual socket. Credentialed requests use `redirect: \"manual\"` so passwords,\n   bearer tokens, and tickets never follow redirects.\n6. **First-run provisioning**: `pnpm auth:password set` remains the canonical\n   interactive command and stores an Argon2 hash. `omni auth init` becomes a\n   friendly alias that prompts for the same shared password and supports\n   `--password-file` for unattended deployment (file must be mode `0600`).\n   A headless runner with no valid password fails with instructions.\n7. **Client storage**:\n   - Web/PWA stores bearer session tokens in the versioned runner-profile store\n     in `localStorage`; the CSP/no-third-party-script policy is the protection\n     boundary.\n   - Electron stores tokens in the main process with `safeStorage`; the\n     renderer never sees them.\n   - Capacitor stores tokens with an audited Keychain/Keystore-backed secure\n     storage plugin. Tokens are loaded into memory only for the native\n     networking bridge and are never written to WebView local storage.\n   - VSCode stores bearer tokens in `SecretStorage`.\n8. **Redaction and audit**: password bodies, `Authorization` headers, bearer\n   tokens, stream tickets, and token-bearing URLs are scrubbed from logs,\n   errors, and named-event details. Login success/failure/rate limiting,\n   bearer issuance/rejection, ticket issuance/redemption/rejection, and session\n   revocation remain auditable without secrets.\n9. **Existing pairing compatibility**: the existing QR/pair-token flow remains\n   available to current web users but is not required by the new desktop or\n   mobile onboarding. New runner profiles use URL + shared password. No new\n   security or product dependency is built on pairing tokens.\n10. **Next removal**: `NextRequest` usage in `auth/guards.ts`,\n    `auth/session.ts`, `api-errors.ts` is replaced with plain Fetch `Request`.\n\n### 4.4 Interface: Vite SPA\n\n- `apps/interface/` with Vite + React. Entry reuses `src/ui/render-web.tsx`;\n  `src/app/layout.tsx` content is ported to `index.html` (theme bootstrap\n  script, meta/manifest/icons) and a `<Providers>` root.\n- Remove Next-isms (all verified small):\n  - `next/dynamic` (4 files) → `React.lazy` + `Suspense`.\n  - `next/image` (5 files) → `<img>` (all usages are local static assets).\n  - `next/font/google` → self-hosted Geist via `@fontsource` (offline-friendly,\n    no Google fetch at build or runtime).\n  - `src/app/home/` → `src/interface/home/` (rename only).\n- **PWA & service worker contract**:\n  - `manifest.webmanifest`, `sw.js`, `PwaBootstrap` move to the Vite app,\n    served by the runner → phone install keeps working per runner origin.\n  - The SW **never caches `index.html`** (it carries per-request auth state).\n    It precaches hashed assets plus `app-shell.html`, a static,\n    non-personalized navigation fallback that boots without inline bootstrap\n    and calls `/api/runtime/bootstrap`. The manifest `start_url` targets the\n    shell, and navigation failures fall back to it.\n  - **The app mounts and loads `RunnerRegistry` independently of same-origin\n    bootstrap success**: if the hosting runner is down, its profile is marked\n    offline but the switcher stays usable and a saved remote runner connects\n    normally (the installed interface is not held hostage by its origin\n    runner). Test: install from A, save B, stop A, launch from SW cache,\n    connect to B.\n  - SW versioning: build hash in the SW file; old caches evicted on activate.\n    The offline shell response carries the same CSP header as live pages.\n- **Dev workflow**: `pnpm dev` = runner via `tsx watch` + Vite dev server\n  proxying `/api` to the runner (cookies stay same-origin in dev; no CORS\n  needed). **The dev UI lives at Vite's port (5173)**; the runner port serves\n  whatever `dist/interface` build exists (or API-only mode) — it is the\n  canonical URL for production and packaged-mode e2e, not for dev. Expected\n  dev RSS per §4.1 contract.\n- **Prod web**: `vite build` output is what the runner serves.\n- **Native packaging**:\n  - Electron loads the packaged Vite bundle; all HTTP/SSE runs in its main\n    process through an IPC `RuntimeAPIs` adapter.\n  - Capacitor iOS/Android load the same bundle from the native WebView. A\n    narrow native bridge owns secure credentials, HTTP/SSE, external links,\n    and local notifications. The shared React tree never branches on platform\n    except through `RuntimeAPIs.native` capabilities.\n  - Mobile operating systems may suspend an app in the background. \"Keep all\n    runners connected\" is guaranteed while the app process is active; reliable\n    delivery while suspended requires native push infrastructure and is not\n    falsely claimed by v1.\n- **UI starting point**: preserve the existing OmniHarness workspace. Adapt\n  the official shadcn `sidebar-07` team-switcher structure for the runner\n  switcher and `login-03` for URL + password onboarding. Remove their demo\n  content and wire real `RunnerRegistry` state; do not replace the existing\n  conversation layout with a generic dashboard.\n\n### 4.5 Multi-runner client model\n\n**Runner identity is server-generated.** The bootstrap payload (inline and\n`/api/runtime/bootstrap`) gains:\n\n```ts\nrunner: {\n  instanceId: string;   // generated once, stored in the settings table\n  name: string;         // user-configurable display name\n  version: string;      // package version\n  apiRevision: number;  // monotonically bumped on breaking API change\n}\n```\n\nIdentity travels with the dataset: a restored/cloned database keeps its\n`instanceId` (documented rule), and `omni runner rekey` mints a new identity\nfor deliberate clones. The client never treats two simultaneously reachable\nendpoints with one identity as interchangeable — it flags the conflict.\n\nClient-side profile:\n\n```ts\ntype RunnerProfile = {\n  id: string;                 // client uuid for list keys only — NOT identity\n  runnerInstanceId?: string;  // learned at first successful login/connect\n  label: string; baseUrl: string;\n  authTransport: \"cookie\" | \"bearer\";\n  credentialRef?: string;     // token lives behind the platform credential store\n  schemaVersion: 1;\n  createdAt: string; lastConnectedAt?: string;\n};\n```\n\n- Identity rules: after login, the profile pins `runnerInstanceId`. If\n  `baseUrl` later resolves to a different instance id → connection blocked\n  with an explicit mismatch warning (log in again to accept). Editing\n  `baseUrl` revokes/removes the local session credential. Two profiles\n  resolving to the same instance id are flagged as duplicates. Authorization\n  headers are never forwarded across redirects.\n- API compatibility: interface publishes the `apiRevision` range it supports;\n  out-of-range runners are blocked with an explicit message (not a soft\n  warning); equal-revision, different-version runners just show an info badge.\n- **RunnerRegistry** (persisted): profiles + `activeRunnerId`, versioned\n  schema (`schemaVersion`) with forward-migration and corrupt-store recovery\n  (reset to same-origin default + toast, never a crash). Storage:\n  `localStorage` on web/PWA (per-origin; the implicit same-origin runner is\n  always present as a non-deletable profile); Electron profiles live in the\n  main-process store; Capacitor profiles live in native preferences; VSCode\n  profiles live in extension global state. Credential material uses the\n  platform stores from §4.3.7.\n- **Electron security boundary**: remote HTTP/SSE happens in the **main\n  process** (mirroring the proven VSCode extension-host bridge pattern,\n  `src/vscode-extension/bridge.ts`); the renderer gets an IPC-backed\n  `RuntimeAPIs` implementation and never sees bearer tokens. IPC surface is\n  validated per-channel; external links open in the OS browser; navigation is\n  locked to the bundled SPA. `safeStorage.isEncryptionAvailable()` is checked:\n  when the platform provides no key store, tokens are session-only (or\n  persisted plaintext only after explicit user consent), and the degraded\n  state is surfaced — never silently claimed as encrypted.\n- **Capacitor security boundary**: native projects allow navigation only to the\n  bundled interface, validate every bridge method, open external URLs through\n  the OS, and use Keychain/Keystore-backed credential storage. The native\n  networking adapter attaches bearer tokens and obtains stream tickets; no\n  token is placed in WebView storage, a URL, or a JavaScript bridge response.\n- **Per-runner connection scope.** Everything currently keyed to \"the server\"\n  becomes owned by a `RunnerConnection` created per profile: `RuntimeAPIs`\n  instance, `LiveEventConnectionManager` (EventSource + cursor),\n  `EventStreamStateManager`, snapshot cache, `WorkerEntriesManager`,\n  notification manager. React context provides the *active* connection;\n  TanStack Query keys use `runnerInstanceId` after identity is known, with the\n  profile id only as a pre-login fallback and an atomic one-time cache/draft\n  rekey when identity is learned.\n- **Concurrent connection contract**: `RunnerRegistry` owns one\n  `RunnerConnection` for every saved authenticated profile. All connections\n  remain open while the app process is active, independently resume their SSE\n  cursor, keep their cached run lists current, and retry with exponential\n  backoff capped at five minutes. Switching changes only which connection is\n  rendered; it does not close streams or cancel HTTP mutations. Offline and\n  needs-reauth profiles keep their last non-authoritative cache for explicit\n  stale display but never satisfy a fresh-load gate.\n- **State invariants** (per `client-server-state-invariants`):\n  - Ownership: all domain state belongs to the runner; the client persists\n    only runner profiles, UI preferences, and drafts. Drafts are keyed by\n    (`runnerInstanceId`, `conversationId`) after identity is known so switching\n    runners never leaks a draft.\n  - Provenance: every snapshot/event frame is tagged with runner scope at the\n    connection layer; reducers reject frames whose scope doesn't match.\n  - Freshness: each connection bootstraps from a scoped snapshot, then tails\n    epoch-aware SSE. Epoch mismatch or an evicted cursor produces\n    `stream.resync_required` and a complete scoped re-bootstrap.\n  - Mutations carry their `runnerId`. A mutation completing after a switch is\n    **not** treated as cancelled: its cache updates apply to the originating\n    runner's query keys (which may not be on screen), and failures surface\n    as a notification naming the runner. Run/conversation ids are only unique\n    per runner; all URL deep links (`/session/:runId`) resolve against the\n    active runner only.\n  - Races to test: rapid switching while every stream remains live; mutation\n    resolving after switch; simultaneous events with the same run id from two\n    runners; credential revocation (401 → only that profile becomes\n    needs-reauth); process restart with an old epoch; instance-id mismatch;\n    identity-learned cache/draft rekey; corrupt profile/credential stores.\n\n### 4.6 The 29 direct-fetch call sites\n\nAll migrate to methods on the per-runner `RuntimeAPIs` (extending\n`src/runtime-api/types.ts` with the missing domains: runs, git, fs, attachments,\nprojects/memory, planning, accounts, notifications, terminals). Mechanical but\nwide; `useHomeMutations.ts` (1,269 lines) is split by domain as part of the\nmigration (conversations / runs / planning / settings) to stay under the\n1200-line rule. `InteractiveTerminal.tsx`'s `EventSource` goes through the\nconnection's ticket-aware stream opener.\n\n### 4.7 Filesystem semantics\n\nPaths shown in the UI (project pickers, file viewer, attachments) already flow\nthrough runner APIs (`/api/fs`, `/api/fs/files`, `/api/attachments`) — they are\n**runner paths** and keep working remotely. Co-location is a capability, not a\nheuristic: desktop users may explicitly mark a profile as co-located. The\nElectron app does not launch or own a runner process in v1. Only co-located\nprofiles offer `native.chooseFolder()` and OS editor links\n(`project-file-links.ts`); everything else uses the `/api/fs` picker dialog and\nthe in-app file viewer. \"localhost\" in a URL proves nothing (SSH tunnels) and\nis not used as a signal.\n\n### 4.8 Notifications\n\n- Web/PWA while open: every connected runner can produce an in-app\n  notification naming the runner. Web push remains limited to the PWA's\n  hosting runner because one service-worker registration holds one VAPID\n  subscription.\n- Electron and Capacitor: the native host observes notification-worthy events\n  from every connected runner and posts a local notification naming the\n  runner while the app process is active. Reliable notifications after a\n  mobile OS suspends or kills the process require native push and are not part\n  of this v1 acceptance contract.\n\n## 5. User stories (v1 acceptance)\n\n1. **Lean local dev** — As the builder, I run `pnpm dev` and get runner + Vite;\n   combined RSS < 2 GB under the scripted workload (§4.1); the dev UI at\n   Vite's port behaves identically to the current app. *(Acceptance: full\n   existing e2e suite passes in packaged mode — built SPA served from the\n   runner port — which is also the production parity gate.)*\n2. **Headless runner** — I run `pnpm runner` on a box with no display; it\n   serves API, SSE, and the built UI on one port (or API-only without\n   `dist/interface`); `omni` CLI and `tests/lifecycle` drive it end-to-end.\n3. **Phone/PWA** — I install the interface from one runner, add other runners\n   with URL + shared password, and supervise any of them. If the hosting runner\n   is down, the offline shell still opens and connects to the others.\n4. **Native mobile** — I install the iOS or Android app, add runners with URL +\n   shared password, and use the same terminal/composer/supervision interface.\n   Session tokens persist in Keychain/Keystore and all profiles remain\n   connected while the app process is active.\n5. **Electron remote** — In the desktop app I add multiple runners by URL +\n   shared password, see live status for all of them, switch without closing\n   inactive streams, and receive runner-named notifications; tokens never\n   reach the renderer.\n6. **Failure honesty** — Unreachable runner → explicit offline banner with URL\n   and error detail; reconnect resumes via `Last-Event-ID`; 401 → named runner\n   + password login CTA; process epoch mismatch → snapshot resync;\n   instance-id mismatch → blocked with explanation.\n7. **Return visit** — Runner profiles, active selection, per-runner drafts, and\n   UI preferences survive restart on web, PWA, Electron, iOS, and Android; a\n   corrupted profile or credential store recovers safely with a visible notice.\n\nSwitcher status states: connected / connecting / offline / needs-reauth /\nincompatible (apiRevision) / identity-mismatch.\n\nOnboarding: Electron and Capacitor first launch show \"Connect a runner\"\n(URL + shared password). Web/PWA starts with its non-deletable same-origin\nprofile and uses the same form to add remote runners.\n\n## 6. Error transparency & instrumentation\n\n- Existing posture (full error details + stack traces to the frontend) is\n  preserved; `update_error` SSE frames and `app-errors.ts` flows unchanged —\n  with the §4.3.6 redaction rules applied to credentials/tickets.\n- New named events: `runner.bridge_ready`, `runner.bridge_unavailable`,\n  `runner.static_ui_enabled`, `runner.static_ui_missing`, `runner.stopping`\n  (also sent as the SSE goodbye frame), `auth.bearer_issued`,\n  `auth.bearer_origin_rejected`, `auth.stream_ticket_issued`,\n  `auth.stream_ticket_rejected`, `auth.login_rate_limited`, plus existing\n  `runtime.started/stopped`.\n- User-relevant server failures additionally emit `error.surfaced` with new\n  stable codes such as `runner.bridge.unavailable`,\n  `runner.static_ui.missing`, `runner.auth.invalid`,\n  `runner.auth.ticket_failed`, and `runner.network.insecure`. Client-owned\n  failures (profile corruption, offline, compatibility and identity mismatch)\n  live in the per-profile `RunnerConnection` diagnostics and notification\n  manager because there may be no trustworthy runner to receive a server\n  event.\n- Client-side connection lifecycle is logged per profile through\n  `LiveEventConnectionManager` diagnostics; the switcher surfaces the last\n  error per profile verbatim.\n- Control plane: everything remains scriptable headless (`tests/lifecycle`\n  already proves this). `omni` CLI gains `--runner <url>` plus token via\n  `OMNI_TOKEN` env / `--token-file` / stdin — never a bare `--token` argv\n  (shell history, `ps`) except as an explicitly warned compatibility flag.\n\n## 7. Testing strategy\n\n- **Unit/integration (vitest)**: streaming server (SSE via `startOmniServer`:\n  heartbeat, `Last-Event-ID` resume without duplicates, client-disconnect\n  cleanup, backpressure, flush-per-frame through a compressing proxy,\n  restart-epoch mismatch and id-bearing resync); password bearer auth (origin\n  binding, wrong-origin rejection, preflight, redirect non-forwarding,\n  trusted-proxy rate-limit identity); stream tickets (single-use atomicity,\n  expiry, concurrent redemption, reconnect-with-fresh-ticket); static serving\n  (bootstrap JSON\n  escaping incl. `</script>`/U+2028, SPA-fallback scope, 404s for `/api/*`,\n  traversal rejection, cache headers, CSP-manifest hash); RunnerRegistry\n  (schema migration, corruption recovery, identity pinning/mismatch,\n  baseUrl-edit credential clearing, identity rekey); concurrent connection\n  races (§4.5 list); network exposure policy.\n- **Route parity gate before deleting Next adapters**: table-driven test\n  hitting every registry route through both the Next adapter and\n  `startOmniServer`, comparing status, headers (incl. cookies), and body\n  semantics; includes multipart upload. Stateful routes run against isolated\n  per-adapter fixtures (separate DB/data dirs), not sequentially on one DB.\n  SSE endpoints compare status/headers plus a bounded sequence of normalized\n  frames, then abort and assert subscriber cleanup (streams never \"complete\").\n  After the Next adapters are removed, the generated route/response contract\n  fixtures remain as a standalone-registry regression suite rather than\n  deleting the coverage with the adapters.\n- **Lifecycle suite** (`tests/lifecycle`) runs against `scripts/runner.ts` —\n  the primary backend regression gate.\n- **Playwright e2e**: existing suites repointed at the runner-served SPA; new\n  two-runner spec (two runner processes, separate DBs/data dirs/ports/\n  identities): add with password → keep both streams live → switch → restart\n  one runner → epoch resync. Browser cross-origin spec: SPA from runner A logs\n  into and talks to runner B.\n- **Electron/VSCode**: `tests/electron` updated for the IPC RuntimeAPIs and\n  main-process networking; `tests/vscode` updated for the new default port +\n  bearer wiring (\"behavior unchanged\" still requires these test updates).\n- **Capacitor**: unit tests for the bridge contract and credential adapter;\n  Android Gradle and iOS Xcode build/sync smoke checks; a mobile-viewport\n  packaged-interface Playwright suite for shared UI behavior.\n- **Candidate agentic user-journey tests** (require approval before running):\n  (a) phone-viewport PWA password login + send message against two runners;\n  (b) Electron keeps two runners connected and recovers one from restart;\n  (c) Capacitor Android/iOS shell logs in, switches, and returns to saved\n  profiles.\n\n## 8. Milestones\n\nResequenced so the bundle boundary exists before Vite is introduced and\nmulti-runner ships dark until every request path is scoped:\n\n**M1 — Boundaries + standalone runner** *(Next still serves the UI)*\nMove shared runtime values/types (including worker labels, entry types, and\nplanning review preferences) into `src/shared`; add interface/runner/shared\ntypecheck projects and import-boundary lint rules. Implement stream epochs and\nthe streaming server fix; `scripts/runner.ts` with non-fatal managed-bridge\ncontroller, lifecycle/shutdown contract, isolated instance configuration,\n`healthz`; remove `next/server` dependencies from auth/api-errors; add the\nroute-parity rig and run lifecycle against the runner.\n\n**M2 — Interface on Vite, Next deleted**\n`apps/interface`; layout ported; Next-isms removed; static-serving contract +\nbootstrap injection/CSP manifest; `app-shell.html` SW/PWA contract;\n`pnpm dev` = runner + Vite;\nroute-parity + Playwright green; then delete `src/app/api/*`, page/layout/\ninstrumentation, `next.config.ts`, Next deps; `src/app/home/` →\n`src/interface/home/`; memory acceptance measured.\n*Transitional shell contract*: Electron switches to loading the Vite\nproduction bundle in this milestone while keeping its current local runtime\ntransport (it must not break for four milestones); VSCode's default port\nmoves off the retired 3035 here too, with its regression test.\n\n**M3 — Transport unification** *(no user-visible change)*\nall 29 call sites through `RuntimeAPIs`; `useHomeMutations.ts` split by domain;\nquery keys and drafts gain a stable runner-scope prefix (still always local).\n\n**M4 — Shared-password remote auth protocol** *(dark: no switcher UI yet)*\nBearer sessions with stored-provenance origin binding (existing\n`auth_sessions` rows migrate to `transport: \"cookie\"` without invalidating\nlive sessions); password bearer login; stream tickets +\nreconnect ownership in `LiveEventConnectionManager`; preflight handling;\ntrusted-proxy/rate-limit contract; first-run password provisioning; runner\nidentity (`instanceId`, `apiRevision`) in bootstrap; network-exposure policy +\nredaction; `omni --runner` flags; VSCode gains bearer wiring here.\n\n**M5 — Concurrent multi-runner UI (web/PWA)**\nRunnerRegistry persistence (+ migration/recovery); `RunnerConnection` scoping\nand all-profile lifecycle/retry; switcher adapted from shadcn `sidebar-07`;\nURL+password onboarding adapted from `login-03`; status states; drafts keyed\nper identity; inactive-runner notifications; two-runner Playwright +\ncross-origin browser specs pass. Switcher controls stay hidden in Electron\nuntil M6.\n\n**M6 — Electron + VSCode remote clients**\nMain-process networking + IPC RuntimeAPIs; `safeStorage` tokens; co-location\ncapability gating for native pickers/editor links; switcher enabled in\nElectron; VSCode `SecretStorage`; all-profile native notifications;\n`tests/electron` and `tests/vscode` updated.\n\n**M7 — Capacitor iOS + Android**\n`apps/mobile` Capacitor project; iOS and Android native projects; native\n`RuntimeAPIs` networking/SSE bridge; Keychain/Keystore credential adapter;\nexternal-link and local-notification capabilities; safe-area/mobile layout\nverification; build/sync smoke checks and packaged mobile acceptance.\n\nEach milestone leaves all already-shipped shells working; M1–M3 are guarded by\nparity tests, M4 ships dark, M5 turns concurrent multi-runner on for web/PWA,\nM6 completes desktop/VSCode, and M7 completes the approved native platforms.\n\n## 9. Risks & trust surfaces\n\n- **Exposing runners on a network** is the point of this work. Mitigations:\n  required shared password, refusal of plaintext non-loopback bearer login,\n  origin-bound bearer sessions, single-use path-bound stream tickets,\n  platform secure storage, no credentialed redirects, redaction, and\n  rate-limited login.\n  Docs recommend tailscale/tunnels over raw port-forwarding.\n- **SSE through proxies/tunnels**: heartbeats exist; streaming rewrite must\n  flush per-frame (tested through a compressing proxy — the scenario that\n  motivated `dev-compression-proxy.ts`).\n- **Single-process API server** remains a hard constraint (in-memory event\n  bus/PTYs). Documented; horizontal scaling is a non-goal.\n- **Churn risk**: M3 touches 29 files. Mitigated by per-domain mechanical PRs,\n  parity tests, and shipping dark until M5.\n- **Native-shell regression risk**: IPC/bridge and secure-storage contracts are\n  covered by Electron/VSCode tests in M6 and Capacitor build/bridge tests in M7.\n- **Mobile background limitation**: concurrent streams stay open while the app\n  process is active; native push after suspension is a separate product\n  capability and is not implied by local notifications.\n\n## 10. North star & future direction (context, not commitment)\n\nOne interface, installed anywhere, showing all your runners: merged\ncross-runner dashboard, cross-runner native push relay, runner health/resource\npanel, Tauri as a possible desktop alternative, package extraction (Approach\nB) once boundaries settle, and runner-to-runner work handoff.\n\n## 11. Implementation gates\n\n1. \"Runner\" remains one logical deployment consisting of the API server and\n   co-located ACP bridge processes.\n2. Before retiring the 3035 compression proxy, audit every consumer (scripts,\n   docs, tunnels, VSCode settings) and update it in the same milestone.\n3. Calibrate the memory thresholds (< 2 GB dev, < 1 GB production runner)\n   against the controlled M1 baseline before treating them as failures.\n4. Capacitor builds must use local developer signing configuration only;\n   signing certificates, provisioning profiles, keystores, SDK caches, and\n   generated release artifacts never enter the repository.\n"
}
````

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-30T21:59:21.529Z","phase":null} -->
## Claude state: queue-operation · 2026-07-30T21:59:21.529Z

```text
{
  "type": "queue-operation",
  "operation": "dequeue",
  "timestamp": "2026-07-30T21:59:21.529Z",
  "sessionId": "c0a69384-d0e5-4a99-894d-19814912df53"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-30T21:59:21.546Z","phase":null} -->
## Claude attachment · 2026-07-30T21:59:21.546Z

```text
{
  "type": "plan_mode",
  "reminderType": "full",
  "isSubAgent": false,
  "planFilePath": "/Users/masterman/.claude/plans/you-are-my-second-opinion-mighty-popcorn.md",
  "planExists": false
}

binary omitted from archive

uuid: 1f2249f2-289c-4f4e-affe-4b80664e874d
parent: 8fc7af91-2ee7-43dc-91db-95af4bb193d4
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"user","timestamp":"2026-07-30T21:59:21.547Z","phase":null} -->
## User · 2026-07-30T21:59:21.547Z

You are my second-opinion architecture-spec reviewer. Use only the artifact included below. Do not inspect or edit files and do not call tools.

User goal: fully implement one logical OmniHarness runner plus a shared interface shipped as web/PWA, Electron desktop, Capacitor iOS/Android, and VSCode. Every client can save arbitrary runners and keeps all authenticated runner connections live while its process is active. Authentication uses the existing single shared runner password; login issues per-device revocable cookie or bearer sessions.

Repository constraints: one package for now; server decisions emit typed events plus error.surfaced; every SSE frame carries an id; client state is Manager-owned and runner-scoped; no fake functionality.

Please judge whether this revised spec is ready to turn into a file-by-file implementation plan. Look for contradictions, missing security/state/persistence/mobile/runtime details, bad sequencing, untestable requirements, and acceptance gaps.

Return exactly:
1. Verdict: READY or HARDEN
2. Highest-impact findings, with concrete fixes
3. Anything you would deliberately leave alone

Artifact:
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
| Authentication v1 | **One shared runner password.** Cookie clients and bearer clients use the same password login. Login creates a separately revocable session token; clients never store the password. Pairing tokens and QR authentication are not required by the new client flow. |

## 3. Verified current state (what we build on)

The split is substantially pre-architected:

- **Portable route registry**: `src/runtime/http/routes/index.ts` registers all 63
  method+path pairs framework-free (Fetch Request/Response). All 49 Next API
  routes are thin adapters over it.
- **Standalone server**: `src/runtime/http/server.ts` (`startOmniServer`) exists,
  with `staticDir` support — but cannot stream (buffers `arrayBuffer()`), so the
  two SSE endpoints (`/api/events`, `/api/terminals/:id/stream`) do not work
  through it yet.
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
- **(H) 29 files** still hardcode `fetch('/api/...')`/`new EventSource('/api/...')`
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
- `pnpm electron:build` packages that same interface bundle in Electron.
  `pnpm mobile:sync`, `pnpm mobile:build:ios`, and
  `pnpm mobile:build:android` synchronize and build the Capacitor projects.
  Native generated outputs, signing material, and local SDK state remain
  ignored; native project source and configuration are versioned.
- Memory acceptance: measured via `scripts/measure-local-dev.mjs` over the
  **whole process tree** (API process, bridge, gateway children, plus
  Vite/watchers in dev) — dev combined RSS **< 2 GB**, production runner
  **< 1 GB** — recording both peak and end-of-workload RSS after a scripted
  10-minute conversation workload. A controlled local benchmark gate, not a
  CI-hardware assertion. (Today's Next dev process alone exceeds 8 GB.)

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
- Every runner process mints a `streamEpoch` at boot. SSE ids are
  `<streamEpoch>:<sequence>`, and bootstrap includes the current epoch. A client
  reconnecting with another epoch always receives an id-bearing
  `stream.resync_required` frame and reboots from a snapshot. All frames,
  including `runner.stopping` and resync controls, carry ids; the client
  persists their epoch-aware cursor.

**Streaming fix (prerequisite for everything)**: `writeFetchResponse` in
`src/runtime/http/server.ts` pipes `Response.body` (Web `ReadableStream`) to the
Node `ServerResponse` chunk-by-chunk, flushes headers immediately, disables
Nagle for `text/event-stream`, and destroys the upstream reader on client
disconnect. Non-streaming responses keep the buffered path.

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
  same-origin script injection is the real threat): interface pages ship a
  CSP **as an HTTP header** (meta tags can't enforce `frame-ancestors`) —
  `default-src 'self'`, `script-src 'self' 'sha256-<theme-bootstrap-hash>'`,
  `style-src`/`font-src`/`img-src`/`worker-src 'self'` (+ `data:`/`blob:`
  where the app needs them), `frame-ancestors 'none'`, `object-src 'none'`,
  `connect-src 'self' https: http://localhost:* http://127.0.0.1:*` (bearer
  runners are user-added HTTPS origins; loopback allowed for dev),
  `Referrer-Policy: no-referrer`. No third-party scripts, ever. All
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
   verified once and is never persisted by a client; every device/profile gets
   a separately revocable session row.

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
   - Cookie tokens are never accepted as bearer tokens and bearer tokens are
     never accepted as cookies.
   - This is browser-origin isolation, not cryptographic token binding. Bearer
     tokens remain replayable secrets. DPoP/device keys and multi-user roles are
     outside the approved v1 scope.
2. **CORS**: browsers enforce CORS, so runner B must answer the interface
   origin hosted by runner A.
   - Bearer-form `/api/auth/login` is callable from any non-null HTTP(S) origin
     with a reflected `Access-Control-Allow-Origin` and no credentials mode.
     Password attempts use the existing rate limiter.
   - Bearer requests from the stored `boundOrigin` get exactly that origin
     reflected with `Vary: Origin`, including error responses.
   - `GET /api/healthz` allows non-credentialed cross-origin GET and returns
     only `{"ok":true}`—no identity, version, hostname, or state.
   - Registry-wide `OPTIONS` handles bearer-route preflight with
     `authorization, content-type`, per-route methods, and a bounded
     `Access-Control-Max-Age`. Cookie routes never receive CORS headers.
3. **SSE auth**: browser `EventSource` cannot set headers. Bearer clients call
   `POST /api/auth/stream-ticket` to create a 60-second, single-use,
   atomically consumed ticket bound to (session, exact stream path). The ticket
   is passed in `?ticket=`. Redemption revalidates the session's stored origin.
   `LiveEventConnectionManager` owns reconnection, closes native EventSource
   auto-retry on error, fetches a fresh ticket for every connection, and sends
   the saved epoch-aware cursor. The same mechanism protects
   `/api/terminals/:id/stream`.
4. **Network exposure**: authentication is already required by the current
   application. Binding to a non-loopback host with a missing/invalid password
   fails at startup. Bearer login and stream-ticket issuance over plaintext
   non-loopback HTTP are refused. Loopback HTTP remains available for local
   development; production remote clients use HTTPS/Tailscale/tunnels. There is
   no unauthenticated network override in the supported product path.
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
7. **Client storage**:
   - Web/PWA stores bearer session tokens in the versioned runner-profile store
     in `localStorage`; the CSP/no-third-party-script policy is the protection
     boundary.
   - Electron stores tokens in the main process with `safeStorage`; the
     renderer never sees them.
   - Capacitor stores tokens with an audited Keychain/Keystore-backed secure
     storage plugin. Tokens are loaded into memory only for the native
     networking bridge and are never written to WebView local storage.
   - VSCode stores bearer tokens in `SecretStorage`.
8. **Redaction and audit**: password bodies, `Authorization` headers, bearer
   tokens, stream tickets, and token-bearing URLs are scrubbed from logs,
   errors, and named-event details. Login success/failure/rate limiting,
   bearer issuance/rejection, ticket issuance/redemption/rejection, and session
   revocation remain auditable without secrets.
9. **Existing pairing compatibility**: the existing QR/pair-token flow remains
   available to current web users but is not required by the new desktop or
   mobile onboarding. New runner profiles use URL + shared password. No new
   security or product dependency is built on pairing tokens.
10. **Next removal**: `NextRequest` usage in `auth/guards.ts`,
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
  - SW versioning: build hash in the SW file; old caches evicted on activate.
    The offline shell response carries the same CSP header as live pages.
- **Dev workflow**: `pnpm dev` = runner via `tsx watch` + Vite dev server
  proxying `/api` to the runner (cookies stay same-origin in dev; no CORS
  needed). **The dev UI lives at Vite's port (5173)**; the runner port serves
  whatever `dist/interface` build exists (or API-only mode) — it is the
  canonical URL for production and packaged-mode e2e, not for dev. Expected
  dev RSS per §4.1 contract.
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
- API compatibility: interface publishes the `apiRevision` range it supports;
  out-of-range runners are blocked with an explicit message (not a soft
  warning); equal-revision, different-version runners just show an info badge.
- **RunnerRegistry** (persisted): profiles + `activeRunnerId`, versioned
  schema (`schemaVersion`) with forward-migration and corrupt-store recovery
  (reset to same-origin default + toast, never a crash). Storage:
  `localStorage` on web/PWA (per-origin; the implicit same-origin runner is
  always present as a non-deletable profile); Electron profiles live in the
  main-process store; Capacitor profiles live in native preferences; VSCode
  profiles live in extension global state. Credential material uses the
  platform stores from §4.3.7.
- **Electron security boundary**: remote HTTP/SSE happens in the **main
  process** (mirroring the proven VSCode extension-host bridge pattern,
  `src/vscode-extension/bridge.ts`); the renderer gets an IPC-backed
  `RuntimeAPIs` implementation and never sees bearer tokens. IPC surface is
  validated per-channel; external links open in the OS browser; navigation is
  locked to the bundled SPA. `safeStorage.isEncryptionAvailable()` is checked:
  when the platform provides no key store, tokens are session-only (or
  persisted plaintext only after explicit user consent), and the degraded
  state is surfaced — never silently claimed as encrypted.
- **Capacitor security boundary**: native projects allow navigation only to the
  bundled interface, validate every bridge method, open external URLs through
  the OS, and use Keychain/Keystore-backed credential storage. The native
  networking adapter attaches bearer tokens and obtains stream tickets; no
  token is placed in WebView storage, a URL, or a JavaScript bridge response.
- **Per-runner connection scope.** Everything currently keyed to "the server"
  becomes owned by a `RunnerConnection` created per profile: `RuntimeAPIs`
  instance, `LiveEventConnectionManager` (EventSource + cursor),
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
- **State invariants** (per `client-server-state-invariants`):
  - Ownership: all domain state belongs to the runner; the client persists
    only runner profiles, UI preferences, and drafts. Drafts are keyed by
    (`runnerInstanceId`, `conversationId`) after identity is known so switching
    runners never leaks a draft.
  - Provenance: every snapshot/event frame is tagged with runner scope at the
    connection layer; reducers reject frames whose scope doesn't match.
  - Freshness: each connection bootstraps from a scoped snapshot, then tails
    epoch-aware SSE. Epoch mismatch or an evicted cursor produces
    `stream.resync_required` and a complete scoped re-bootstrap.
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

### 4.6 The 29 direct-fetch call sites

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
   and error detail; reconnect resumes via `Last-Event-ID`; 401 → named runner
   + password login CTA; process epoch mismatch → snapshot resync;
   instance-id mismatch → blocked with explanation.
7. **Return visit** — Runner profiles, active selection, per-runner drafts, and
   UI preferences survive restart on web, PWA, Electron, iOS, and Android; a
   corrupted profile or credential store recovers safely with a visible notice.

Switcher status states: connected / connecting / offline / needs-reauth /
incompatible (apiRevision) / identity-mismatch.

Onboarding: Electron and Capacitor first launch show "Connect a runner"
(URL + shared password). Web/PWA starts with its non-deletable same-origin
profile and uses the same form to add remote runners.

## 6. Error transparency & instrumentation

- Existing posture (full error details + stack traces to the frontend) is
  preserved; `update_error` SSE frames and `app-errors.ts` flows unchanged —
  with the §4.3.6 redaction rules applied to credentials/tickets.
- New named events: `runner.bridge_ready`, `runner.bridge_unavailable`,
  `runner.static_ui_enabled`, `runner.static_ui_missing`, `runner.stopping`
  (also sent as the SSE goodbye frame), `auth.bearer_issued`,
  `auth.bearer_origin_rejected`, `auth.stream_ticket_issued`,
  `auth.stream_ticket_rejected`, `auth.login_rate_limited`, plus existing
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
  `LiveEventConnectionManager` diagnostics; the switcher surfaces the last
  error per profile verbatim.
- Control plane: everything remains scriptable headless (`tests/lifecycle`
  already proves this). `omni` CLI gains `--runner <url>` plus token via
  `OMNI_TOKEN` env / `--token-file` / stdin — never a bare `--token` argv
  (shell history, `ps`) except as an explicitly warned compatibility flag.

## 7. Testing strategy

- **Unit/integration (vitest)**: streaming server (SSE via `startOmniServer`:
  heartbeat, `Last-Event-ID` resume without duplicates, client-disconnect
  cleanup, backpressure, flush-per-frame through a compressing proxy,
  restart-epoch mismatch and id-bearing resync); password bearer auth (origin
  binding, wrong-origin rejection, preflight, redirect non-forwarding,
  trusted-proxy rate-limit identity); stream tickets (single-use atomicity,
  expiry, concurrent redemption, reconnect-with-fresh-ticket); static serving
  (bootstrap JSON
  escaping incl. `</script>`/U+2028, SPA-fallback scope, 404s for `/api/*`,
  traversal rejection, cache headers, CSP-manifest hash); RunnerRegistry
  (schema migration, corruption recovery, identity pinning/mismatch,
  baseUrl-edit credential clearing, identity rekey); concurrent connection
  races (§4.5 list); network exposure policy.
- **Route parity gate before deleting Next adapters**: table-driven test
  hitting every registry route through both the Next adapter and
  `startOmniServer`, comparing status, headers (incl. cookies), and body
  semantics; includes multipart upload. Stateful routes run against isolated
  per-adapter fixtures (separate DB/data dirs), not sequentially on one DB.
  SSE endpoints compare status/headers plus a bounded sequence of normalized
  frames, then abort and assert subscriber cleanup (streams never "complete").
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
- **Electron/VSCode**: `tests/electron` updated for the IPC RuntimeAPIs and
  main-process networking; `tests/vscode` updated for the new default port +
  bearer wiring ("behavior unchanged" still requires these test updates).
- **Capacitor**: unit tests for the bridge contract and credential adapter;
  Android Gradle and iOS Xcode build/sync smoke checks; a mobile-viewport
  packaged-interface Playwright suite for shared UI behavior.
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
typecheck projects and import-boundary lint rules. Implement stream epochs and
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
live sessions); password bearer login; stream tickets +
reconnect ownership in `LiveEventConnectionManager`; preflight handling;
trusted-proxy/rate-limit contract; first-run password provisioning; runner
identity (`instanceId`, `apiRevision`) in bootstrap; network-exposure policy +
redaction; `omni --runner` flags; VSCode gains bearer wiring here.

**M5 — Concurrent multi-runner UI (web/PWA)**
RunnerRegistry persistence (+ migration/recovery); `RunnerConnection` scoping
and all-profile lifecycle/retry; switcher adapted from shadcn `sidebar-07`;
URL+password onboarding adapted from `login-03`; status states; drafts keyed
per identity; inactive-runner notifications; two-runner Playwright +
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


uuid: 8fc7af91-2ee7-43dc-91db-95af4bb193d4

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-30T22:01:41.519Z","phase":null} -->
## Claude thinking · 2026-07-30T22:01:41.519Z



uuid: fa599e37-168e-47e6-96c0-9e194c2c2a57
parent: 1f2249f2-289c-4f4e-affe-4b80664e874d

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-07-30T22:03:10.003Z","phase":null} -->
## Claude · 2026-07-30T22:03:10.003Z

I did not inspect the repo or run anything — this is a read of the artifact only.

# 1. Verdict

**HARDEN.** The spec is close: the boundary strategy, milestone dark-shipping, epoch/resync model, and honesty about mobile background limits are all better than typical. But there are five items that would stall or mislead a file-by-file plan — one security hole, one internal contradiction in the SSE resume path, one capability that's in your stated goal and absent from the design, one transport-abstraction sequencing error, and one unspecified product migration for existing Electron users. Everything else below is tightening.

# 2. Highest-impact findings

### A. Cross-origin bearer login is an open password oracle (security, blocking)

§4.3.2 makes `POST /api/auth/login` (bearer form) callable **from any non-null HTTP(S) origin with a reflected `Access-Control-Allow-Origin`**. Because the response is readable cross-origin, any web page a user visits can script password attempts against `http://127.0.0.1:3050` (and any runner URL it knows), and on success **read the bearer token out of the response body and exfiltrate it**. Rate limiting doesn't close this; it only slows it and hands an attacker a lockout DoS against the legitimate user. This is the classic drive-by-localhost / DNS-rebinding shape, and it's worse here because the credential is a single shared password with no second factor.

The design also can't actually satisfy its own requirement as written: runner B cannot know runner A's interface origin in advance, so "reflect whatever origin asks" was the only way to make §4.3.2 work.

**Fix:** make cross-origin login an explicit, per-origin grant rather than open reflection.
- Add `OMNIHARNESS_ALLOWED_INTERFACE_ORIGINS` (exact origins, no wildcards). Only listed origins get ACAO on `/api/auth/login`; everything else gets no CORS headers (browser blocks the read) and is audited as `auth.login_origin_rejected`.
- For the "add runner B from runner A's UI" flow without pre-configuration, use a **runner-side approval step**: the login attempt from an unknown origin returns 403 with a code, and the origin is added via `omni runner allow-origin <origin>` or a same-origin admin toggle on B. That is a one-time action per pairing, which matches how often this actually happens.
- Independently: reject bearer login where `Origin` is a loopback address but the request arrives on a non-loopback socket, and keep the existing plaintext refusal.
- Note in §9 that this is the one place where the "shared password, no accounts" model is weakest, and that the existing QR/pair-token flow (§4.3.9) is a strictly better UX for this specific step if you ever want to revive it.

### B. SSE resume contradicts itself: `Last-Event-ID` can't be sent by the clients you designed

§4.3.3 says `LiveEventConnectionManager` **closes native `EventSource` auto-retry** and constructs a fresh connection with a fresh ticket per attempt. A freshly constructed `EventSource` has no `lastEventId`, so the browser will **not** send the `Last-Event-ID` header. §5 story 6 and §7 both assert resume "via `Last-Event-ID`". As specified, every reconnect will full-resync.

**Fix:**
- Pass the cursor explicitly: `GET /api/events?ticket=…&cursor=<epoch>:<seq>`. Server accepts both the header and the query param; query wins when both are present. State that the cursor is **not** a secret (unlike the ticket) and is safe in the URL and logs.
- Specify heartbeats explicitly against your "every frame carries an id" constraint: heartbeats are SSE **comment lines** (`:hb`), carry no id, and do not consume sequence numbers or ring slots. If you instead make them id-bearing events, say so and account for ring-buffer pressure — this materially changes how long a cursor stays resumable.
- Specify cursor persistence: per (`runnerInstanceId`), where it's stored, and that it is cleared on `stream.resync_required` and on epoch change.
- Define the ring-eviction → resync decision as a server-side rule (`cursor sequence < ring floor` ⇒ id-bearing `stream.resync_required`), since that's the branch the tests in §7 need to hit deterministically.

### C. Per-device revocable sessions exist in the schema but there's no way to list or revoke them

Your stated goal is "per-device revocable cookie or bearer sessions." §4.3 stores `clientLabel`, `transport`, `boundOrigin`, `clientKind` and calls sessions "separately revocable," and §6 audits "session revocation" — but **no route, CLI command, or UI is specified for enumerating or revoking a session.** Today, a lost phone cannot be de-authorized short of rotating the password (and password rotation's effect on existing sessions is also unspecified).

**Fix:** add to M4:
- `GET /api/auth/sessions` → `{ id, clientLabel, transport, clientKind, boundOrigin, createdAt, lastUsedAt, currentSession: bool }` (never token material).
- `DELETE /api/auth/sessions/:id` and `DELETE /api/auth/sessions` (all-but-current), emitting `auth.session_revoked`.
- `omni auth sessions list|revoke`.
- Define the TTL model, which is currently a hand-wave ("same expiry/revocation rules"): browser-bearer and cookie sessions need a short-ish absolute TTL; native sessions need a long one or users retype the shared password constantly. Specify absolute TTL, idle TTL, whether `lastUsedAt` updates on every request (write amplification on SQLite — consider coarse bucketing), and max concurrent sessions.
- Specify password rotation semantics: does `auth:password set` revoke all sessions? (Recommend yes, with `--keep-sessions`.) This is a user story worth adding to §5.
- Add a client "log out / forget runner" flow that revokes the server session *and* clears the platform credential, not just the local one.

### D. The streaming transport abstraction is sequenced too late — M7 (and M6) will force a second sweep of M3's work

§3 describes `RuntimeAPIs` as taking an injectable `fetch`/`EventSource`. But Capacitor (§4.5) and Electron (§4.5) both move networking into a native/main process where **`EventSource` does not exist** and frames arrive over a bridge/IPC. M3 migrates all 29 call sites, including `InteractiveTerminal.tsx`, against the *current* shape. M6 and M7 then have to change that shape again across every stream consumer.

**Fix:** promote the stream contract into M1/M3, before the 29-site sweep:

```ts
openStream(path: string, opts: { cursor?: string; signal: AbortSignal })
  → { onFrame, onError, onOpen, close }   // no EventSource in the type
```

Web implements it with ticket-fetch + `EventSource`; Electron with IPC; Capacitor with the native adapter. Add to the same contract, since all three transports need them: per-platform **redirect suppression** (§4.3.5 says `redirect: "manual"` but URLSession/OkHttp/Electron `net` each need their own opt-out, asserted in the bridge tests), and ticket acquisition, so no platform accidentally puts a ticket in a JS-visible place.

### E. Electron's migration for existing users is undefined

§4.7 states "The Electron app does not launch or own a runner process in v1," and §4.2/M2 keep "its current local runtime transport" for four milestones before M6 flips it to a pure remote client. If today's desktop app is self-contained, then at M6 an existing user updates and lands on "Connect a runner (URL + password)" with **no runner to connect to** and no path to create one. That's a shipped regression disguised as a milestone.

**Fix:** pick one and write it down explicitly, with a story in §5:
1. Electron continues to spawn/adopt a co-located runner and auto-provisions a non-deletable local profile (recommended — preserves the product, and §4.7's co-location capability flag already exists to gate native pickers); or
2. Electron becomes remote-only and M6 ships a migration screen plus documented `pnpm runner` install instructions, and the release is called out as breaking.

Also decide whether the local profile in case (1) uses cookie or bearer auth, and whether the desktop user must set a shared password at all for a purely loopback deployment — right now §4.3.6 says a runner with no valid password fails to start, which would break a first-launch desktop install.

### F. `connect-src 'self' https:` defeats the CSP argument you're relying on

§4.3 explicitly justifies `localStorage` token storage by saying CSP + no-third-party-scripts is "the protection boundary," then sets `connect-src` to allow **any HTTPS origin**. Under the exact threat you named (same-origin script injection), that policy permits token exfiltration to anywhere. The mitigation and the threat model don't meet.

**Fix:** be honest and compensate elsewhere rather than claiming a boundary you don't have.
- State plainly that `connect-src` cannot be tightened for a user-configurable multi-runner client, so CSP mitigates script *injection*, not *exfiltration*.
- Add `require-trusted-types-for 'script'` and `trusted-types` to the header, plus the existing `object-src 'none'` / `base-uri 'none'` (add `base-uri`, it's missing) — these actually reduce injection probability.
- For the **mobile bundle specifically**, `connect-src 'self'` only, since all runner traffic goes through the native bridge. Add the test: a WebView `fetch()` to a runner origin must be CSP-blocked. Without this, a regression silently falls back to unauthenticated/unbridged WebView requests.
- Consider keeping web bearer tokens in memory + a short-lived refresh in `localStorage`, or accept `localStorage` and document the residual risk in §9. Either is fine; the current text does neither.

### G. Missing runtime details that will bite during implementation

- **Per-origin connection budget.** `startOmniServer` is HTTP/1.1. A browser allows ~6 connections per origin; main event stream + several terminal streams + normal fetches will deadlock the app. Specify a cap on concurrent terminal streams per runner, or multiplex terminal output over the main event stream, or require HTTP/2 behind TLS. This is not theoretical at 3–4 open terminals.
- **Inactive-runner stream cost.** §4.5 says switching "does not close streams." So a background runner's terminal streams keep pushing PTY output into client memory indefinitely. Specify a bounded per-connection buffer and a policy for non-visible runners (recommend: keep the event stream, detach terminal streams and re-attach with a scrollback fetch on activation).
- **Profile count.** "All connections remain open" with no cap. Define behavior at N profiles (recommend: hard cap + explicit "idle" state beyond it), especially for mobile battery/data.
- **Gateway port collision in the two-runner test.** §4.2 says gateway settings are instance-scoped, but the Claude model gateway child needs an actual ephemeral-port strategy or the second runner's gateway will collide. Name the mechanism.
- **Dev proxy and `Origin`.** §4.3 rejects browser-kind bearer sessions with missing `Origin`. Behind the Vite dev proxy the runner may see `localhost:5173`, the rewritten host, or nothing depending on `changeOrigin`. Specify the dev configuration and add it to the parity/auth tests, or you'll discover it as a "works in prod, broken in dev" bug.

### H. `apiRevision` and the PWA skew case are currently untestable / self-bricking

`apiRevision` is "bumped on breaking API change" with no mechanical trigger — it will rot within two months. Worse: §4.5 says out-of-range runners are **blocked, not warned**, while §4.4's service worker precaches hashed assets. Upgrade the runner, and the installed PWA can serve stale JS that hard-blocks against its own hosting runner, with no in-app path out.

**Fix:**
- Tie the bump to the §7 route-contract fixtures: a fixture diff without an `apiRevision` bump fails CI. Name the file that holds the interface's supported range and its M4 initial value.
- Special-case the **same-origin, non-deletable profile**: an `apiRevision` mismatch there triggers SW update + reload (once, with a loop guard), not a hard block. Hard block stays for remote profiles only.
- Specify SW activation semantics (`skipWaiting`/`clientsClaim` or not) — it directly determines whether the above recovery works.
- Same for `omni runner rekey`: define that the same-origin profile re-pins automatically on a valid session, otherwise rekey bricks the local web app.

### I. Acceptance gaps in §5

Add stories (each maps to something the design already implies but nothing gates):
- Revoke a session from another device; the revoked client transitions to needs-reauth without affecting other profiles.
- Password rotation and its session effect.
- `runner.stopping`: clients show "runner stopping," back off, and **do not** issue a snapshot storm — this is a specific design decision in §4.2 with no acceptance behind it.
- API-only mode observed by a client (§4.1 calls it "a supported deployment"; nothing tests a client against it).
- Saving an unreachable runner profile (allowed or not?), and editing `baseUrl` clearing credentials.
- Upgrade migration: existing local drafts keyed by `conversationId` only → `(runnerInstanceId, conversationId)`. §4.5's "identity-learned rekey" is written abstractly; the concrete case is the one-time upgrade of today's users, and it should be named as such.
- Runner rename: `runner.name` is "user-configurable" but no route or UI is specified.

### J. Smaller, cheap to fix

- §7 route parity: specify `Set-Cookie` normalization (attribute order/casing differ between `NextResponse.cookies` and raw headers) or the gate will fail on noise.
- §6 "the switcher surfaces the last error per profile verbatim" conflicts mildly with §4.3.8 redaction. State that the client renders the already-redacted server payload, and give client-side failures **stable codes** (mirroring `error.surfaced` codes) so tests assert codes, not strings.
- §4.1 memory gate: name the workload script and require a deterministic fixture agent, not a live model call. Also fix the ordering against Gate 3 — the `< 2 GB` dev threshold cannot be asserted at M1 (Next still serves the UI); M1 records the baseline, M2 asserts the threshold.
- `runner.static_ui_enabled` / `runner.static_ui_missing`: state that exactly one is emitted once at boot, so the lifecycle test can assert on it.
- Add `base-uri 'none'` to the CSP list (currently absent).
- `capacitor.config.ts` should be stated to point `webDir` at `dist/interface`, given the single-package constraint.
- Switcher state derivation: make explicit that `healthz` 200 + bootstrap 401 ⇒ `needs-reauth`, and `healthz` failure ⇒ `offline`. It's implied but it's the rule three specs depend on.

# 3. What I'd deliberately leave alone

- **Approach A (one package, two build targets) over the monorepo extraction.** Correctly reasoned; the ESLint boundary + split `tsc` projects + Vite build failure is a sufficient three-layer backstop. Don't let anyone relitigate this mid-implementation.
- **Keeping the API server and ACP bridge as two co-located processes** and the single-process in-memory event bus as a hard constraint. Documented, load-bearing, and changing it would double the scope.
- **Bearer tokens as replayable secrets; no DPoP, no device keys, no multi-user roles.** The spec says this out loud instead of implying stronger guarantees. That honesty is worth more than the crypto would be here.
- **The mobile background-suspension carve-out** and the notifications scoping in §4.8. Exactly the right call to refuse to claim delivery you can't make; don't let a "but can't we just…" during M7 erode it.
- **Keeping the existing pairing/QR flow alive but load-bearing on nothing.** Cheap optionality. (My finding A note about reviving it for origin approval is a suggestion, not a dependency.)
- **Milestone shape: parity gate → Next deletion → dark auth → web multi-runner → native.** The dark-ship of M4 and the "each milestone leaves shipped shells working" rule are the main things preventing this from becoming a six-week broken-trunk project. Fix the sequencing defect in finding D by moving the *stream contract* earlier, not by reordering milestones.
- **Error-transparency posture** (full details + stack traces to the frontend) with redaction layered on top, and the §6 carve-out putting client-owned failures in client diagnostics rather than forcing them through `error.surfaced`. That carve-out is a correct reading of the constraint, not a violation of it.
- **The memory gate as a controlled local benchmark rather than a CI assertion.** Right call; just make the workload deterministic per finding J.

uuid: ba0f8177-bbf1-47ea-a2f8-8880e3db6500
parent: fa599e37-168e-47e6-96c0-9e194c2c2a57

<!-- /codex-event -->
