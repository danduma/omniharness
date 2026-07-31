---
provider: "claude"
codex_thread_id: "1c8101b1-aa25-4c6f-9a76-84671505b28a"
title: "Review OmniHarness interface/runner split design"
started_at: "2026-07-30T15:58:19.751Z"
updated_at: "2026-07-30T16:00:55.439Z"
working_directory: "/Users/masterman/NLP/omniharness"
archive_status: "unknown"
part: 1
parts: 1
---

# Review OmniHarness interface/runner split design

> This archive contains Claude Code conversation activity, stored thinking blocks, tools, and subagents. Raw system prompts and credentials are excluded.
<!-- codex-event:{"kind":"state","timestamp":"2026-07-30T15:58:19.751Z","phase":null} -->
## Claude state: queue-operation · 2026-07-30T15:58:19.751Z

````text
{
  "type": "queue-operation",
  "operation": "enqueue",
  "timestamp": "2026-07-30T15:58:19.751Z",
  "sessionId": "1c8101b1-aa25-4c6f-9a76-84671505b28a",
  "content": "You are my second-opinion architecture-spec reviewer. Use only the artifact included below. Do not inspect or edit files and do not call tools.\n\nUser goal: decide whether this OmniHarness interface/runner split design is ready to implement.\nContext and constraints:\n- Existing single-package TypeScript/React/Next app with standalone Node HTTP registry, SQLite, SSE, Electron and VSCode shells.\n- Server decisions require typed named events, error.surfaced for user-visible failures, SSE ids/replay/resync, and headless lifecycle tests.\n- Frontend state must be manager-owned, runner-scoped, race-safe, and localized.\n- No branches or worktrees.\n\nPlease judge whether this spec is ready to use. Look for missing requirements, internal contradictions, unsafe sequencing, ambiguous ownership/state/persistence/security details, scope decisions needing confirmation, instrumentation gaps, and acceptance-test gaps.\n\nReturn exactly:\n1. Verdict: READY or HARDEN\n2. Highest-impact findings, with concrete fixes\n3. Anything you would deliberately leave alone\n\nArtifact:\n# Interface / Runner Split — Design\n\nDate: 2026-07-29\nStatus: Draft for review (revised after cross-harness second opinion)\n\n## 1. Goal\n\nSplit OmniHarness into two independently runnable pieces:\n\n- **Runner** — a headless Node service that owns all domain state and processes:\n  SQLite, supervisor, agent-runtime bridge, PTY terminals, SSE event stream, auth.\n  No Next.js. Serves only data (plus the static interface bundle for the web/PWA\n  path).\n- **Interface** — a self-contained static React SPA (Vite build) that connects to\n  one or more runners over HTTP + SSE. Ships as: web page served by any runner,\n  installable PWA (phone), and the existing Electron shell as a pure remote\n  client. The existing VSCode shell keeps its behavior (it is already\n  remote-capable; its default port and auth wiring get updated).\n\nMotivations, in priority order:\n\n1. Interface installable on a phone/laptop connecting to **multiple remote\n   runners**.\n2. Backend runs as a lean process that does not also host a frontend toolchain\n   (Next dev today balloons to 8 GB+ RSS).\n3. Web version keeps working exactly as it does now (same URL shape, same UI).\n\n## 2. Decisions already made (user-confirmed)\n\n| Decision | Choice |\n|---|---|\n| Next.js | **Remove.** Interface becomes a Vite SPA; runner serves the built bundle and injects the bootstrap JSON into `index.html` at serve time (preserves today's zero-round-trip boot; verified that the app tree is `ssr:false` and SSR only emits the BootShell skeleton + bootstrap blob). |\n| Native shells v1 | **Electron** (existing `apps/electron`, converted to pure remote client). Phone = existing PWA support, now served by the runner. VSCode shell behavior unchanged. Tauri: future option, out of scope. |\n| Multi-runner UI v1 | **Runner switcher**: save N runner profiles, connect, switch; one runner's data on screen at a time. Merged cross-runner views: future. |\n| Backend topology | **Keep two services** as today: the omni API server and the agent-runtime bridge (port 7800) stay separate processes. Clients only ever talk to the API server; the bridge keeps binding to localhost by default (`OMNIHARNESS_AGENT_RUNTIME_HOST`). A \"runner\" deployment = both processes co-located on one machine sharing one filesystem, managed by one start script. |\n\n## 3. Verified current state (what we build on)\n\nThe split is substantially pre-architected:\n\n- **Portable route registry**: `src/runtime/http/routes/index.ts` registers all 62\n  method+path pairs framework-free (Fetch Request/Response). All 49 Next API\n  routes are thin adapters over it.\n- **Standalone server**: `src/runtime/http/server.ts` (`startOmniServer`) exists,\n  with `staticDir` support — but cannot stream (buffers `arrayBuffer()`), so the\n  two SSE endpoints (`/api/events`, `/api/terminals/:id/stream`) do not work\n  through it yet.\n- **Client transport abstraction**: `src/runtime-api/` (`RuntimeAPIs` interface;\n  `web.ts` already takes `baseUrl` + injectable `fetch`/`EventSource`).\n- **Non-Next entry**: `src/ui/render-web.tsx` mounts `<OmniApp>` without Next.\n- **Bootstrap over HTTP**: `GET /api/runtime/bootstrap` already mirrors the SSR\n  bootstrap for Electron/VSCode.\n- **Transports**: HTTP JSON + SSE only. No WebSockets, no server actions, no tRPC.\n\nKnown debts that gate the split (from exploration):\n\n- **(B) Streaming**: standalone server buffers responses; SSE endpoints hang.\n- **(C) Auth**: cookie + `SameSite=Lax` + `enforceSameOrigin` on all mutations +\n  zero CORS headers → a cross-origin interface cannot authenticate.\n- **(D) Runner identity**: `RuntimeAPIs` is a flat singleton; managers, SSE\n  cursor, and query caches assume \"the one server\".\n- **(H) 29 files** still hardcode `fetch('/api/...')`/`new EventSource('/api/...')`\n  instead of going through `RuntimeAPIs` (list in\n  `docs/architecture/common-runtime-multi-surface.md` §\"debt\").\n- **(G) Client→server imports**: `src/server/workers/entries-types.ts` (types),\n  `src/server/planning/review-preferences.ts` (runtime zod import) are imported\n  by client components.\n- **(A) Same-process event bus**: `src/server/events/named-events.ts` ring +\n  `live-updates.ts` listener set are module-level memory → the API server must\n  remain a single process. This is accepted and documented, not changed.\n\n## 4. Target architecture\n\n### 4.1 Repository shape (Approach A — in-place, two build targets)\n\nStay one pnpm package for now. Two build targets with an enforced boundary,\nno mass file moves:\n\n```\nsrc/server/       → runner only (never bundled into interface)\nsrc/runtime/      → runner only (HTTP registry, standalone server, bootstrap)\nsrc/shared/       → NEW: types + pure logic importable by both sides\nsrc/lib/          → interface-leaning isomorphic helpers (already clean)\nsrc/runtime-api/  → interface transport layer (multi-runner aware)\nsrc/ui/, src/components/, src/interface/home/ → interface\napps/interface/   → NEW: Vite app (index.html, vite.config.ts, entry that\n                    reuses src/ui/render-web.tsx)\napps/electron/    → existing shell, becomes pure remote client\napps/vscode/      → behavior unchanged; port/auth wiring updated\nscripts/runner.ts → NEW: runner entrypoint (replaces Next start for backend)\n```\n\n`src/app/` (Next) is deleted at the end of Milestone 2; `src/app/home/` is\ninterface code and moves to `src/interface/home/` (import-path rename only) so\nthe `src/app` deletion is clean.\n\nBoundary enforcement:\n- ESLint `no-restricted-imports`: anything bundled by Vite may not import\n  `@/server/*` or `@/runtime/*` (only `@/shared/*`).\n- The two offending imports (G) move: `entries-types.ts` and\n  `review-preferences.ts` → `src/shared/`, with re-export shims left at the old\n  paths for server-side importers.\n- Vite build failing on a server import is the backstop.\n- Typechecking is split: separate `tsc --noEmit` projects for runner\n  (`src/server` + `src/runtime`), shared, and interface, so a server-only type\n  error can't hide in the SPA project and vice versa.\n\n**Production artifact contract** (what a headless box installs):\n- `pnpm build` → `dist/interface/` (hashed static assets + `index.html`\n  template). The runner itself keeps running from source via `tsx`\n  (existing convention in `scripts/start.ts`); no Vite, Next, or watcher runs\n  in production.\n- Runner with `dist/interface` present → serves SPA + API. Absent → **API-only\n  mode**: `/` returns a plain informational page, a named event\n  `runner.static_ui_missing` is emitted, and everything else works (this is a\n  supported deployment, not an error). If `--static-dir` is passed explicitly\n  and missing, startup fails loudly.\n- Memory acceptance: measured via `scripts/measure-local-dev.mjs` over the\n  **whole process tree** (API process, bridge, gateway children, plus\n  Vite/watchers in dev) — dev combined RSS **< 2 GB**, production runner\n  **< 1 GB** — recording both peak and end-of-workload RSS after a scripted\n  10-minute conversation workload. A controlled local benchmark gate, not a\n  CI-hardware assertion. (Today's Next dev process alone exceeds 8 GB.)\n\n**Rejected alternatives**:\n- *Approach B — full monorepo package extraction* (`packages/shared|runner|interface`):\n  cleaner end state but moves ~460 files, breaks every open branch, buys\n  nothing functional now. Revisit after the split is proven.\n- *Approach C — keep Next as frontend host*: rejected by user (RAM, second\n  pipeline).\n\n### 4.2 Runner\n\n**Entrypoint** `scripts/runner.ts`:\n1. `await dbReady` (schema init).\n2. Start supervisor watchdog (`ensureSupervisorRuntimeStarted()`).\n3. Start Claude model gateway (`ensureClaudeModelGatewayStartedAtBoot()` + shutdown hooks).\n4. Spawn/adopt the bridge exactly as `scripts/dev.ts` does today (lockfile,\n   health checks, `managed-bridge.ts`) — extracted into a shared module so\n   dev.ts and runner.ts don't duplicate it.\n5. `startOmniServer({ staticDir, port })` — one HTTP port for API + SSE + SPA.\n\nThis replaces `src/instrumentation.ts` (deleted with Next).\n\n**Lifecycle contract**:\n- `GET /api/healthz` (liveness, no auth, no state) and readiness reflected in\n  the existing bootstrap route. Bridge unavailable at boot → runner starts,\n  serves UI/API, reports `bridge: \"starting\" | \"unavailable\"` in bootstrap and\n  emits `runner.bridge_unavailable`; bridge crash → existing supervisor\n  sync/retry behavior, surfaced as named events (`runner.bridge_ready` on\n  (re)connect). Port conflict → fail fast; the owning pid is reported\n  best-effort via the runner's own lockfile (bridge-lock pattern), since bind\n  errors don't carry it cross-platform. Shutdown order: stop accepting new\n  connections → send a dedicated `runner.stopping` frame to open SSE streams\n  (NOT `stream.resync_required`, which would trigger snapshot reloads against\n  a dying server; clients show \"runner stopping\" and back off) → bounded\n  flush window, then abort remaining readers → PTYs get SIGTERM with a\n  deadline, then SIGKILL → gateway child likewise → bridge: terminated if\n  this runner spawned it, released (lock only) if adopted.\n\n**Streaming fix (prerequisite for everything)**: `writeFetchResponse` in\n`src/runtime/http/server.ts` pipes `Response.body` (Web `ReadableStream`) to the\nNode `ServerResponse` chunk-by-chunk, flushes headers immediately, disables\nNagle for `text/event-stream`, and destroys the upstream reader on client\ndisconnect. Non-streaming responses keep the buffered path.\n\n**Static serving + bootstrap injection contract**:\n- `GET /` and `/session/:runId` (the deep-link rewrite from `next.config.ts`)\n  serve `index.html` with\n  `<script id=\"omni-bootstrap\" type=\"application/json\">…</script>` injected —\n  same payload semantics as today's SSR (`includeInitialData: false`). JSON is\n  serialized with `<`, `>`, `&`, U+2028, U+2029 escaped so it cannot terminate\n  the script element.\n- SPA fallback applies only to GET navigations without a file extension that\n  aren't `/api/*`. `/api/*` and missing assets return proper 404s — never\n  `index.html`.\n- Hashed assets: `Cache-Control: public, max-age=31536000, immutable`.\n  `index.html`: `no-store` (it contains per-request auth state).\n- Static file resolution rejects path traversal and does not follow symlinks\n  out of `staticDir`.\n- **Frontend security policy** (browser tokens live in `localStorage`, so\n  same-origin script injection is the real threat): interface pages ship a\n  CSP **as an HTTP header** (meta tags can't enforce `frame-ancestors`) —\n  `default-src 'self'`, `script-src 'self' 'sha256-<theme-bootstrap-hash>'`,\n  `style-src`/`font-src`/`img-src`/`worker-src 'self'` (+ `data:`/`blob:`\n  where the app needs them), `frame-ancestors 'none'`, `object-src 'none'`,\n  `connect-src 'self' https: http://localhost:* http://127.0.0.1:*` (bearer\n  runners are user-added HTTPS origins; loopback allowed for dev),\n  `Referrer-Policy: no-referrer`. No third-party scripts, ever. All\n  server-provided content (agent output, errors, project paths) renders\n  through the existing markdown/text pipeline — a test asserts none of it can\n  introduce executable markup.\n- The interface reads the inline blob if present, else falls back to\n  `GET /api/runtime/bootstrap` (Electron / remote / dev / offline-PWA path).\n\n**Ports & processes** (unchanged topology, per user decision):\n- API server: default 3050 (today's web port), configurable.\n- Bridge: 7800, localhost-bound by default. Existing `OMNIHARNESS_*` env vars\n  keep their meanings. The dev compression proxy (3035) is retired with Next\n  dev; the VSCode default `serverUrl` moves to the runner port.\n- `scripts/start.ts`, `controller.sh`, `omni.sh` launch the runner instead of\n  Next.\n\n### 4.3 Auth & cross-origin model\n\nTwo session transports against the same `auth_sessions` table and expiry rules:\n\n**Cookie sessions (unchanged)** — for the interface served by the runner itself\n(web + PWA on that runner's origin). `SameSite=Lax`, `enforceSameOrigin` on\nmutations, no CORS involvement. No behavior change.\n\n**Bearer sessions (new)** — for every cross-origin client: the PWA installed\nfrom runner A talking to runner B, Electron, the Vite dev server, future\nshells.\n\n1. **Issuance**: `POST /api/auth/pair/redeem` and `POST /api/auth/login` accept\n   `{\"tokenTransport\":\"bearer\"}` and return the opaque session token in the\n   response body. Guards accept `Authorization: Bearer <token>`; same-origin\n   enforcement is skipped for bearer requests (the token is never ambient, so\n   it is the CSRF defense). Session rows gain provenance columns and the\n   guard enforces from **stored** provenance, not per-request headers:\n\n   ```ts\n   transport: \"cookie\" | \"bearer\";\n   boundOrigin: string | null;      // exact Origin at issuance, browser flows\n   clientKind: \"browser\" | \"native\"; // native = no Origin header at issuance\n   ```\n\n   - A `browser` bearer session **always** requires its exact `boundOrigin`;\n     missing, different, or `Origin: null` → 401, audited\n     (`auth.bearer_origin_rejected`). Threat model, stated honestly: this is\n     **browser-origin isolation** (script on another origin can't use the\n     token), not cryptographic token binding — a stolen token replayed by a\n     non-browser client can forge `Origin`. Bearer tokens remain replayable\n     secrets; DPoP/device keys are out of scope for v1. The v1 protections\n     against theft are CSP, expiry/revocation, redaction, and encrypted\n     storage.\n   - Only sessions issued through an originless flow (Electron main process,\n     VSCode host, CLI) get `clientKind: \"native\"`, `boundOrigin: null`.\n   - Cookie tokens are never accepted as bearer tokens and vice versa\n     (transport checked against presentation).\n2. **Origin binding / CORS (this is the multi-runner design)**: browsers\n   enforce CORS, so runner B must answer the PWA-from-runner-A origin. Policy:\n   - `POST /api/auth/pair/redeem` and `/api/auth/login` are callable from\n     **any** origin (`Access-Control-Allow-Origin: <reflected>`, no\n     credentials mode) — protected by the expiring single-use pairing token /\n     password + existing rate limiting (`auth/rate-limit.ts`).\n   - Bearer requests from the session's `boundOrigin` get exactly that origin\n     reflected (`Vary: Origin`) — **on error responses too**, so the interface\n     can read real API errors cross-origin.\n   - `GET /api/healthz` allows non-credentialed cross-origin GET from any\n     origin (the switcher's status ping must work from a browser).\n   - Preflight: `OPTIONS` handled registry-wide for bearer routes\n     (`Allow-Headers: authorization, content-type`, methods per route,\n     `Access-Control-Max-Age` set). Credentialed wildcard CORS is never used;\n     cookie routes never get CORS headers.\n   - No static allowlist config needed for the core story; an optional\n     `OMNIHARNESS_CORS_ORIGINS` allowlist can additionally enable\n     cookie-less same-device conveniences in dev.\n   - Pairing tokens are the one secret that transits a URL (QR deep link):\n     they are already short-lived and single-use; additionally the interface\n     strips `?pair=` via `history.replaceState` immediately on load, all\n     interface pages send `Referrer-Policy: no-referrer`, and pair tokens are\n     covered by the same log/proxy redaction rules as bearer tokens. Session\n     tokens themselves never appear in URLs (stream tickets are the only\n     query-string credential, and they are 60 s single-use).\n3. **SSE auth**: `EventSource` cannot set headers. Bearer clients call\n   `POST /api/auth/stream-ticket` → short-lived (60 s), **single-use,\n   atomically consumed**, bound to (session, exact stream path); passed as\n   `?ticket=`. Redemption validates the request origin against the *session's*\n   stored `boundOrigin` (not just the ticket). Reconnection is owned by\n   `LiveEventConnectionManager` (it already owns retry + `Last-Event-ID`\n   bookkeeping): native `EventSource` auto-retry is disabled (`close()` on\n   error), and each (re)connect fetches a fresh ticket and passes the saved\n   cursor via the existing `?lastEventId=` parameter. Tickets never appear in\n   logs (redaction in the request logger); accepted only over HTTPS except on\n   loopback. Same mechanism for `/api/terminals/:id/stream`.\n4. **Pairing UX for remote devices**: existing QR flow already encodes URL +\n   pair token; the \"Add runner\" screen accepts the QR deep link or pasted\n   URL+token, redeems with bearer transport, stores the token in the profile.\n5. **Network exposure policy** (changes current permissive behavior —\n   flagged for user confirmation): binding the API server to a non-loopback\n   host with no auth configured **refuses to start** unless\n   `OMNIHARNESS_ALLOW_UNAUTHENTICATED_NETWORK=1` is set; bearer issuance over\n   plaintext non-loopback HTTP is likewise refused without the same explicit\n   override. Loopback HTTP stays frictionless. `auth.unprotected_non_loopback`\n   named event is emitted whenever the override is used.\n6. **Trusted-proxy contract** (HTTPS behind reverse proxies / tunnels): the\n   runner honors `Forwarded`/`X-Forwarded-Proto` only when the immediate\n   socket peer is in `OMNIHARNESS_TRUSTED_PROXIES` (addresses/CIDRs);\n   otherwise protocol security is judged from the actual socket. Prevents\n   spoofed `X-Forwarded-Proto: https` from downgrading the plaintext rule\n   above. Docs cover the supported tailscale / TLS-terminating-proxy setups.\n   All credentialed client requests — including initial pairing — use\n   `redirect: \"manual\"` so secrets never follow redirects.\n7. **First-run provisioning** (headless box, fresh DB — required so the\n   refuse-to-start policy has no dead end): `omni auth init` generates either\n   a password (stored as argon2 hash) or a **single-use, short-lived bootstrap\n   pairing token**, and prints the pairing URL/QR to the attached TTY — or\n   writes it to a file with `0600` perms via `--pair-token-file` for\n   unattended deploys. In unattended mode with no secret source configured,\n   the runner fails with instructions rather than starting open. The normal QR\n   flow (which requires an authenticated session) is unchanged; `omni auth\n   pair-url` prints an equivalent pairing link for an already-provisioned\n   headless runner. Acceptance test: empty DB → provision → non-loopback bind\n   → pair a phone-origin interface → bootstrap token invalidated after use.\n8. **Redaction**: `Authorization` headers, pair tokens, stream tickets, and\n   token-bearing URLs are scrubbed from logs, error payloads, and named-event\n   details.\n9. **Next removal**: `NextRequest` usage in `auth/guards.ts`,\n   `auth/session.ts`, `api-errors.ts` is replaced with plain Fetch `Request`\n   (the 9-line shim `routes/next-request.ts` shows this is mechanical).\n\n### 4.4 Interface: Vite SPA\n\n- `apps/interface/` with Vite + React. Entry reuses `src/ui/render-web.tsx`;\n  `src/app/layout.tsx` content is ported to `index.html` (theme bootstrap\n  script, meta/manifest/icons) and a `<Providers>` root.\n- Remove Next-isms (all verified small):\n  - `next/dynamic` (4 files) → `React.lazy` + `Suspense`.\n  - `next/image` (5 files) → `<img>` (all usages are local static assets).\n  - `next/font/google` → self-hosted Geist via `@fontsource` (offline-friendly,\n    no Google fetch at build or runtime).\n  - `src/app/home/` → `src/interface/home/` (rename only).\n- **PWA & service worker contract**:\n  - `manifest.webmanifest`, `sw.js`, `PwaBootstrap` move to the Vite app,\n    served by the runner → phone install keeps working per runner origin.\n  - The SW **never caches `index.html`** (it carries per-request auth state).\n    It precaches hashed assets plus a static, non-personalized offline shell\n    that boots by calling `/api/runtime/bootstrap`.\n  - **The app mounts and loads `RunnerRegistry` independently of same-origin\n    bootstrap success**: if the hosting runner is down, its profile is marked\n    offline but the switcher stays usable and a saved remote runner connects\n    normally (the installed interface is not held hostage by its origin\n    runner). Test: install from A, save B, stop A, launch from SW cache,\n    connect to B.\n  - SW versioning: build hash in the SW file; old caches evicted on activate.\n    The offline shell response carries the same CSP header as live pages.\n- **Dev workflow**: `pnpm dev` = runner via `tsx watch` + Vite dev server\n  proxying `/api` to the runner (cookies stay same-origin in dev; no CORS\n  needed). **The dev UI lives at Vite's port (5173)**; the runner port serves\n  whatever `dist/interface` build exists (or API-only mode) — it is the\n  canonical URL for production and packaged-mode e2e, not for dev. Expected\n  dev RSS per §4.1 contract.\n- **Prod web**: `vite build` output is what the runner serves.\n\n### 4.5 Multi-runner client model\n\n**Runner identity is server-generated.** The bootstrap payload (inline and\n`/api/runtime/bootstrap`) gains:\n\n```ts\nrunner: {\n  instanceId: string;   // generated once, stored in the settings table\n  name: string;         // user-configurable display name\n  version: string;      // package version\n  apiRevision: number;  // monotonically bumped on breaking API change\n}\n```\n\nIdentity travels with the dataset: a restored/cloned database keeps its\n`instanceId` (documented rule), and `omni runner rekey` mints a new identity\nfor deliberate clones. The client never treats two simultaneously reachable\nendpoints with one identity as interchangeable — it flags the conflict.\n\nClient-side profile:\n\n```ts\ntype RunnerProfile = {\n  id: string;                 // client uuid for list keys only — NOT identity\n  runnerInstanceId?: string;  // learned at first successful connect/pair\n  label: string; baseUrl: string;\n  authToken?: string;         // bearer; absent for the same-origin runner\n  schemaVersion: 1;\n  createdAt: string; lastConnectedAt?: string;\n};\n```\n\n- Identity rules: after pairing, the profile pins `runnerInstanceId`. If\n  `baseUrl` later resolves to a different instance id → connection blocked\n  with an explicit mismatch warning (re-pair to accept). Editing `baseUrl`\n  clears the token. Two profiles resolving to the same instance id are flagged\n  as duplicates. Authorization headers are never forwarded across cross-origin\n  redirects (fetch wrapper uses `redirect: \"manual\"` for bearer requests).\n- API compatibility: interface publishes the `apiRevision` range it supports;\n  out-of-range runners are blocked with an explicit message (not a soft\n  warning); equal-revision, different-version runners just show an info badge.\n- **RunnerRegistry** (persisted): profiles + `activeRunnerId`, versioned\n  schema (`schemaVersion`) with forward-migration and corrupt-store recovery\n  (reset to same-origin default + toast, never a crash). Storage:\n  `localStorage` on web/PWA (per-origin; the implicit same-origin runner is\n  always present as a non-deletable profile); on Electron, profiles live in\n  the **main process** store with tokens encrypted via `safeStorage`.\n- **Electron security boundary**: remote HTTP/SSE happens in the **main\n  process** (mirroring the proven VSCode extension-host bridge pattern,\n  `src/vscode-extension/bridge.ts`); the renderer gets an IPC-backed\n  `RuntimeAPIs` implementation and never sees bearer tokens. IPC surface is\n  validated per-channel; external links open in the OS browser; navigation is\n  locked to the bundled SPA. `safeStorage.isEncryptionAvailable()` is checked:\n  when the platform provides no key store, tokens are session-only (or\n  persisted plaintext only after explicit user consent), and the degraded\n  state is surfaced — never silently claimed as encrypted.\n- **Per-runner connection scope.** Everything currently keyed to \"the server\"\n  becomes owned by a `RunnerConnection` created per profile: `RuntimeAPIs`\n  instance, `LiveEventConnectionManager` (EventSource + cursor),\n  `EventStreamStateManager`, snapshot cache, `WorkerEntriesManager`,\n  notification manager. React context provides the *active* connection;\n  TanStack Query keys gain a `runnerId` prefix (the client profile id).\n  Switching runners swaps the context; inactive connections are **closed** in\n  v1, except the switcher's status ping: `GET /api/healthz` per saved profile,\n  15 s timeout, exponential backoff capped at 5 min, only while the switcher\n  UI is open (no permanent background polling).\n- **State invariants** (per `client-server-state-invariants`):\n  - Ownership: all domain state belongs to the runner; the client persists\n    only runner profiles, UI preferences, and drafts. Drafts are keyed by\n    (runnerId, conversationId) so switching runners never leaks a draft.\n  - Provenance: every snapshot/event frame is tagged with `runnerId` at the\n    connection layer; reducers reject frames whose scope doesn't match.\n  - Freshness: on switch/reconnect, the existing snapshot + `Last-Event-ID`\n    resume protocol runs per runner; `stream.resync_required` unchanged.\n  - Mutations carry their `runnerId`. A mutation completing after a switch is\n    **not** treated as cancelled: its cache updates apply to the originating\n    runner's query keys (which are simply not on screen), and failures surface\n    as a notification naming the runner. Run/conversation ids are only unique\n    per runner; all URL deep links (`/session/:runId`) resolve against the\n    active runner only.\n  - Races to test: rapid switching mid-stream; mutation resolving after\n    switch; token revoked mid-session (401 → profile marked needs-reauth,\n    banner + re-pair CTA); runner restarted mid-conversation (resume via\n    cursor); instance-id mismatch on reconnect.\n\n### 4.6 The 29 direct-fetch call sites\n\nAll migrate to methods on the per-runner `RuntimeAPIs` (extending\n`src/runtime-api/types.ts` with the missing domains: runs, git, fs, attachments,\nprojects/memory, planning, accounts, notifications, terminals). Mechanical but\nwide; `useHomeMutations.ts` (1,269 lines) is split by domain as part of the\nmigration (conversations / runs / planning / settings) to stay under the\n1200-line rule. `InteractiveTerminal.tsx`'s `EventSource` goes through the\nconnection's ticket-aware stream opener.\n\n### 4.7 Filesystem semantics\n\nPaths shown in the UI (project pickers, file viewer, attachments) already flow\nthrough runner APIs (`/api/fs`, `/api/fs/files`, `/api/attachments`) — they are\n**runner paths** and keep working remotely. Co-location is a *capability, not a\nheuristic*: the Electron shell marks a profile co-located only when it launched\nthat runner process itself (or the user explicitly asserts it). Only co-located\nprofiles offer `native.chooseFolder()` and OS editor links\n(`project-file-links.ts`); everything else uses the `/api/fs` picker dialog and\nthe in-app file viewer. \"localhost\" in a URL proves nothing (SSH tunnels) and\nis not used as a signal.\n\n### 4.8 Notifications\n\n- Web/PWA: web push keeps working for the runner that serves the PWA (its\n  origin's service worker + its VAPID keys — the existing flow, unchanged).\n  **Constraint acknowledged**: one SW registration holds one push\n  subscription tied to one VAPID key, so a PWA installed from runner A cannot\n  also receive native push from runner B in v1. Remote runners' events surface\n  in-app while connected; cross-runner push relay is future work.\n- Electron: `RuntimeAPIs.native.notify` already exists; the main process\n  subscribes to the active runner's named events for notification-worthy\n  kinds. Inactive-runner notifications are out of scope for v1.\n\n## 5. User stories (v1 acceptance)\n\n1. **Lean local dev** — As the builder, I run `pnpm dev` and get runner + Vite;\n   combined RSS < 2 GB under the scripted workload (§4.1); the dev UI at\n   Vite's port behaves identically to the current app. *(Acceptance: full\n   existing e2e suite passes in packaged mode — built SPA served from the\n   runner port — which is also the production parity gate.)*\n2. **Headless runner** — I run `pnpm runner` on a box with no display; it\n   serves API, SSE, and the built UI on one port (or API-only without\n   `dist/interface`); `omni` CLI and `tests/lifecycle` drive it end-to-end.\n3. **Phone** — I open the runner URL on my phone (tailscale/tunnel), install\n   the PWA, pair via QR, and supervise agents; terminal, composer, and this\n   runner's push notifications work; offline launch shows an explicit\n   runner-unreachable shell, not a stale session.\n4. **Electron remote** — In the desktop app I add a second runner by URL +\n   pairing token, see both in the switcher with status dots, switch between\n   them; each shows its own runs/conversations with correct resume after\n   reconnect; tokens never reach the renderer.\n5. **Failure honesty** — Unreachable runner → explicit offline banner with URL\n   and error detail; reconnect resumes via `Last-Event-ID`; 401 → named runner\n   + re-pair CTA; instance-id mismatch → blocked with explanation.\n6. **Return visit** — Runner profiles, active selection, and UI preferences\n   survive restart on web, PWA, and Electron; a corrupted profile store resets\n   safely to the same-origin default with a visible notice.\n\nSwitcher status states: connected / connecting / offline / needs-reauth /\nincompatible (apiRevision) / identity-mismatch.\n\nOnboarding: Electron first launch with no reachable local runner shows a\n\"Connect a runner\" screen (URL + token / QR paste) instead of an error. Web/PWA\nnever needs onboarding (served by its runner).\n\n## 6. Error transparency & instrumentation\n\n- Existing posture (full error details + stack traces to the frontend) is\n  preserved; `update_error` SSE frames and `app-errors.ts` flows unchanged —\n  with the §4.3.6 redaction rules applied to credentials/tickets.\n- New named events: `runner.bridge_ready`, `runner.bridge_unavailable`,\n  `runner.static_ui_enabled`, `runner.static_ui_missing`, `runner.stopping`\n  (also sent as the SSE goodbye frame), `auth.bearer_issued`,\n  `auth.bearer_origin_rejected`, `auth.stream_ticket_issued`,\n  `auth.unprotected_non_loopback`, plus existing `runtime.started/stopped`.\n- Client-side connection lifecycle logged through `LiveEventConnectionManager`\n  diagnostics; switcher surfaces last error per profile verbatim.\n- Control plane: everything remains scriptable headless (`tests/lifecycle`\n  already proves this). `omni` CLI gains `--runner <url>` plus token via\n  `OMNI_TOKEN` env / `--token-file` / stdin — never a bare `--token` argv\n  (shell history, `ps`) except as an explicitly warned compatibility flag.\n\n## 7. Testing strategy\n\n- **Unit/integration (vitest)**: streaming server (SSE via `startOmniServer`:\n  heartbeat, `Last-Event-ID` resume without duplicates, client-disconnect\n  cleanup, backpressure, flush-per-frame through a compressing proxy); bearer\n  auth (origin binding, wrong-origin rejection, preflight, redirect\n  non-forwarding); stream tickets (single-use atomicity, expiry, concurrent\n  redemption, reconnect-with-fresh-ticket); static serving (bootstrap JSON\n  escaping incl. `</script>`/U+2028, SPA-fallback scope, 404s for `/api/*`,\n  traversal rejection, cache headers); RunnerRegistry (schema migration,\n  corruption recovery, identity pinning/mismatch, baseUrl-edit token clearing);\n  connection races (§4.5 list); network exposure policy (refuse-to-start\n  matrix).\n- **Route parity gate before deleting Next adapters**: table-driven test\n  hitting every registry route through both the Next adapter and\n  `startOmniServer`, comparing status, headers (incl. cookies), and body\n  semantics; includes multipart upload. Stateful routes run against isolated\n  per-adapter fixtures (separate DB/data dirs), not sequentially on one DB.\n  SSE endpoints compare status/headers plus a bounded sequence of normalized\n  frames, then abort and assert subscriber cleanup (streams never \"complete\").\n- **Lifecycle suite** (`tests/lifecycle`) runs against `scripts/runner.ts` —\n  the primary backend regression gate.\n- **Playwright e2e**: existing suites repointed at the runner-served SPA; new\n  two-runner spec (two runner processes, separate DBs/data dirs/ports/\n  identities): add → pair → switch → restart one runner → resume. Browser\n  cross-origin spec: SPA from runner A pairs and talks to runner B.\n- **Electron/VSCode**: `tests/electron` updated for the IPC RuntimeAPIs and\n  main-process networking; `tests/vscode` updated for the new default port +\n  bearer wiring (\"behavior unchanged\" still requires these test updates).\n- **Candidate agentic user-journey tests** (require approval before running):\n  (a) phone-viewport PWA pair + send message against a fresh runner;\n  (b) Electron connects to a remote runner, switches, and recovers from a\n  runner restart mid-conversation.\n\n## 8. Milestones\n\nResequenced so multi-runner ships dark until every request path is scoped:\n\n**M1 — Runner stands alone** *(backend only; Next still serves the UI)*\nStreaming fix; `scripts/runner.ts` with boot duties, lifecycle contract,\n`healthz`; `next/server` out of auth/api-errors; route-parity test rig;\nlifecycle suite green against the runner.\n\n**M2 — Interface on Vite, Next deleted**\n`apps/interface`; layout ported; Next-isms removed; static-serving contract +\nbootstrap injection; SW/PWA caching contract; `pnpm dev` = runner + Vite;\nroute-parity + Playwright green; then delete `src/app/api/*`, page/layout/\ninstrumentation, `next.config.ts`, Next deps; `src/app/home/` →\n`src/interface/home/`; memory acceptance measured.\n*Transitional shell contract*: Electron switches to loading the Vite\nproduction bundle in this milestone while keeping its current local runtime\ntransport (it must not break for four milestones); VSCode's default port\nmoves off the retired 3035 here too, with its regression test.\n\n**M3 — Transport unification** *(no user-visible change)*\nShared types to `src/shared/` + ESLint boundary + split typecheck projects;\nall 29 call sites through `RuntimeAPIs`; `useHomeMutations.ts` split by domain;\nquery keys gain `runnerId` prefix (still always `\"local\"`).\n\n**M4 — Remote auth protocol** *(dark: no switcher UI yet; gate: network-policy\nsign-off from §11.1)*\nBearer sessions with stored-provenance origin binding (existing\n`auth_sessions` rows migrate to `transport: \"cookie\"` without invalidating\nlive sessions); stream tickets +\nreconnect ownership in `LiveEventConnectionManager`; preflight handling;\ntrusted-proxy contract; first-run provisioning (`omni auth init`); runner\nidentity (`instanceId`, `apiRevision`) in bootstrap; network-exposure policy +\nredaction; `omni --runner` flags; VSCode gains bearer wiring here.\n\n**M5 — Multi-runner UI (web/PWA only)**\nRunnerRegistry persistence (+ migration/recovery); `RunnerConnection` scoping\nand race handling; switcher + status states; onboarding screen; drafts keyed\nper runner; two-runner Playwright + cross-origin browser specs pass. Switcher\ncontrols stay hidden in Electron until M6.\n\n**M6 — Electron remote client**\nMain-process networking + IPC RuntimeAPIs; `safeStorage` tokens; co-location\ncapability gating for native pickers/editor links; switcher enabled in\nElectron; `tests/electron` updated.\n\nEach milestone leaves every shell working; M1–M3 are refactors guarded by\nparity tests, M4 ships dark, M5 turns multi-runner on for web/PWA, M6\ncompletes Electron.\n\n## 9. Risks & trust surfaces\n\n- **Exposing runners on a network** is the point of this work. Mitigations:\n  refuse-to-start policy (§4.3.5, needs user sign-off), origin-bound bearer\n  sessions, single-use path-bound stream tickets, tokens encrypted at rest in\n  Electron's main process only, never in URLs or logs, rate-limited issuance.\n  Docs recommend tailscale/tunnels over raw port-forwarding.\n- **SSE through proxies/tunnels**: heartbeats exist; streaming rewrite must\n  flush per-frame (tested through a compressing proxy — the scenario that\n  motivated `dev-compression-proxy.ts`).\n- **Single-process API server** remains a hard constraint (in-memory event\n  bus/PTYs). Documented; horizontal scaling is a non-goal.\n- **Churn risk**: M3 touches 29 files. Mitigated by per-domain mechanical PRs,\n  parity tests, and shipping dark until M5.\n- **Electron regression risk**: startup contract changes; covered by\n  `tests/electron` in M6.\n\n## 10. North star & future direction (context, not commitment)\n\nOne interface, installed anywhere, showing all your runners: merged\ncross-runner dashboard, cross-runner push relay, background notifications from\ninactive runners, runner health/resource panel, Tauri/mobile-native shells,\npackage extraction (Approach B) once boundaries settle, runner-to-runner work\nhandoff.\n\n## 11. Open questions for review\n\nThese become milestone gates, not loose ends:\n\n1. **Network exposure policy** (§4.3.5): OK to refuse non-loopback start\n   without auth (override via env)? Stricter than today. **Sign-off required\n   before M4 starts.**\n2. Naming: \"runner\" = API server + bridge pair; docs-level rename only.\n3. Compression proxy (3035) retired; VSCode default port changes. **M2 entry\n   task: audit all consumers of 3035** (scripts, docs, tunnels, VSCode\n   settings) before removal.\n4. Memory thresholds (< 2 GB dev, < 1 GB prod runner): **calibrated against a\n   baseline measurement in M1** before being treated as failures.\n"
}
````

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-30T15:58:19.751Z","phase":null} -->
## Claude state: queue-operation · 2026-07-30T15:58:19.751Z

```text
{
  "type": "queue-operation",
  "operation": "dequeue",
  "timestamp": "2026-07-30T15:58:19.751Z",
  "sessionId": "1c8101b1-aa25-4c6f-9a76-84671505b28a"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-07-30T15:58:19.768Z","phase":null} -->
## Claude attachment · 2026-07-30T15:58:19.768Z

```text
{
  "type": "plan_mode",
  "reminderType": "full",
  "isSubAgent": false,
  "planFilePath": "/Users/masterman/.claude/plans/you-are-my-second-opinion-memoized-wombat.md",
  "planExists": false
}

binary omitted from archive

uuid: dc629077-fe50-4ca2-b2b4-c7efbd2ed8e2
parent: fd2a4d17-3609-418a-9c53-14ceec210a84
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"user","timestamp":"2026-07-30T15:58:19.769Z","phase":null} -->
## User · 2026-07-30T15:58:19.769Z

You are my second-opinion architecture-spec reviewer. Use only the artifact included below. Do not inspect or edit files and do not call tools.

User goal: decide whether this OmniHarness interface/runner split design is ready to implement.
Context and constraints:
- Existing single-package TypeScript/React/Next app with standalone Node HTTP registry, SQLite, SSE, Electron and VSCode shells.
- Server decisions require typed named events, error.surfaced for user-visible failures, SSE ids/replay/resync, and headless lifecycle tests.
- Frontend state must be manager-owned, runner-scoped, race-safe, and localized.
- No branches or worktrees.

Please judge whether this spec is ready to use. Look for missing requirements, internal contradictions, unsafe sequencing, ambiguous ownership/state/persistence/security details, scope decisions needing confirmation, instrumentation gaps, and acceptance-test gaps.

Return exactly:
1. Verdict: READY or HARDEN
2. Highest-impact findings, with concrete fixes
3. Anything you would deliberately leave alone

Artifact:
# Interface / Runner Split — Design

Date: 2026-07-29
Status: Draft for review (revised after cross-harness second opinion)

## 1. Goal

Split OmniHarness into two independently runnable pieces:

- **Runner** — a headless Node service that owns all domain state and processes:
  SQLite, supervisor, agent-runtime bridge, PTY terminals, SSE event stream, auth.
  No Next.js. Serves only data (plus the static interface bundle for the web/PWA
  path).
- **Interface** — a self-contained static React SPA (Vite build) that connects to
  one or more runners over HTTP + SSE. Ships as: web page served by any runner,
  installable PWA (phone), and the existing Electron shell as a pure remote
  client. The existing VSCode shell keeps its behavior (it is already
  remote-capable; its default port and auth wiring get updated).

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
| Native shells v1 | **Electron** (existing `apps/electron`, converted to pure remote client). Phone = existing PWA support, now served by the runner. VSCode shell behavior unchanged. Tauri: future option, out of scope. |
| Multi-runner UI v1 | **Runner switcher**: save N runner profiles, connect, switch; one runner's data on screen at a time. Merged cross-runner views: future. |
| Backend topology | **Keep two services** as today: the omni API server and the agent-runtime bridge (port 7800) stay separate processes. Clients only ever talk to the API server; the bridge keeps binding to localhost by default (`OMNIHARNESS_AGENT_RUNTIME_HOST`). A "runner" deployment = both processes co-located on one machine sharing one filesystem, managed by one start script. |

## 3. Verified current state (what we build on)

The split is substantially pre-architected:

- **Portable route registry**: `src/runtime/http/routes/index.ts` registers all 62
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
4. Spawn/adopt the bridge exactly as `scripts/dev.ts` does today (lockfile,
   health checks, `managed-bridge.ts`) — extracted into a shared module so
   dev.ts and runner.ts don't duplicate it.
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

**Ports & processes** (unchanged topology, per user decision):
- API server: default 3050 (today's web port), configurable.
- Bridge: 7800, localhost-bound by default. Existing `OMNIHARNESS_*` env vars
  keep their meanings. The dev compression proxy (3035) is retired with Next
  dev; the VSCode default `serverUrl` moves to the runner port.
- `scripts/start.ts`, `controller.sh`, `omni.sh` launch the runner instead of
  Next.

### 4.3 Auth & cross-origin model

Two session transports against the same `auth_sessions` table and expiry rules:

**Cookie sessions (unchanged)** — for the interface served by the runner itself
(web + PWA on that runner's origin). `SameSite=Lax`, `enforceSameOrigin` on
mutations, no CORS involvement. No behavior change.

**Bearer sessions (new)** — for every cross-origin client: the PWA installed
from runner A talking to runner B, Electron, the Vite dev server, future
shells.

1. **Issuance**: `POST /api/auth/pair/redeem` and `POST /api/auth/login` accept
   `{"tokenTransport":"bearer"}` and return the opaque session token in the
   response body. Guards accept `Authorization: Bearer <token>`; same-origin
   enforcement is skipped for bearer requests (the token is never ambient, so
   it is the CSRF defense). Session rows gain provenance columns and the
   guard enforces from **stored** provenance, not per-request headers:

   ```ts
   transport: "cookie" | "bearer";
   boundOrigin: string | null;      // exact Origin at issuance, browser flows
   clientKind: "browser" | "native"; // native = no Origin header at issuance
   ```

   - A `browser` bearer session **always** requires its exact `boundOrigin`;
     missing, different, or `Origin: null` → 401, audited
     (`auth.bearer_origin_rejected`). Threat model, stated honestly: this is
     **browser-origin isolation** (script on another origin can't use the
     token), not cryptographic token binding — a stolen token replayed by a
     non-browser client can forge `Origin`. Bearer tokens remain replayable
     secrets; DPoP/device keys are out of scope for v1. The v1 protections
     against theft are CSP, expiry/revocation, redaction, and encrypted
     storage.
   - Only sessions issued through an originless flow (Electron main process,
     VSCode host, CLI) get `clientKind: "native"`, `boundOrigin: null`.
   - Cookie tokens are never accepted as bearer tokens and vice versa
     (transport checked against presentation).
2. **Origin binding / CORS (this is the multi-runner design)**: browsers
   enforce CORS, so runner B must answer the PWA-from-runner-A origin. Policy:
   - `POST /api/auth/pair/redeem` and `/api/auth/login` are callable from
     **any** origin (`Access-Control-Allow-Origin: <reflected>`, no
     credentials mode) — protected by the expiring single-use pairing token /
     password + existing rate limiting (`auth/rate-limit.ts`).
   - Bearer requests from the session's `boundOrigin` get exactly that origin
     reflected (`Vary: Origin`) — **on error responses too**, so the interface
     can read real API errors cross-origin.
   - `GET /api/healthz` allows non-credentialed cross-origin GET from any
     origin (the switcher's status ping must work from a browser).
   - Preflight: `OPTIONS` handled registry-wide for bearer routes
     (`Allow-Headers: authorization, content-type`, methods per route,
     `Access-Control-Max-Age` set). Credentialed wildcard CORS is never used;
     cookie routes never get CORS headers.
   - No static allowlist config needed for the core story; an optional
     `OMNIHARNESS_CORS_ORIGINS` allowlist can additionally enable
     cookie-less same-device conveniences in dev.
   - Pairing tokens are the one secret that transits a URL (QR deep link):
     they are already short-lived and single-use; additionally the interface
     strips `?pair=` via `history.replaceState` immediately on load, all
     interface pages send `Referrer-Policy: no-referrer`, and pair tokens are
     covered by the same log/proxy redaction rules as bearer tokens. Session
     tokens themselves never appear in URLs (stream tickets are the only
     query-string credential, and they are 60 s single-use).
3. **SSE auth**: `EventSource` cannot set headers. Bearer clients call
   `POST /api/auth/stream-ticket` → short-lived (60 s), **single-use,
   atomically consumed**, bound to (session, exact stream path); passed as
   `?ticket=`. Redemption validates the request origin against the *session's*
   stored `boundOrigin` (not just the ticket). Reconnection is owned by
   `LiveEventConnectionManager` (it already owns retry + `Last-Event-ID`
   bookkeeping): native `EventSource` auto-retry is disabled (`close()` on
   error), and each (re)connect fetches a fresh ticket and passes the saved
   cursor via the existing `?lastEventId=` parameter. Tickets never appear in
   logs (redaction in the request logger); accepted only over HTTPS except on
   loopback. Same mechanism for `/api/terminals/:id/stream`.
4. **Pairing UX for remote devices**: existing QR flow already encodes URL +
   pair token; the "Add runner" screen accepts the QR deep link or pasted
   URL+token, redeems with bearer transport, stores the token in the profile.
5. **Network exposure policy** (changes current permissive behavior —
   flagged for user confirmation): binding the API server to a non-loopback
   host with no auth configured **refuses to start** unless
   `OMNIHARNESS_ALLOW_UNAUTHENTICATED_NETWORK=1` is set; bearer issuance over
   plaintext non-loopback HTTP is likewise refused without the same explicit
   override. Loopback HTTP stays frictionless. `auth.unprotected_non_loopback`
   named event is emitted whenever the override is used.
6. **Trusted-proxy contract** (HTTPS behind reverse proxies / tunnels): the
   runner honors `Forwarded`/`X-Forwarded-Proto` only when the immediate
   socket peer is in `OMNIHARNESS_TRUSTED_PROXIES` (addresses/CIDRs);
   otherwise protocol security is judged from the actual socket. Prevents
   spoofed `X-Forwarded-Proto: https` from downgrading the plaintext rule
   above. Docs cover the supported tailscale / TLS-terminating-proxy setups.
   All credentialed client requests — including initial pairing — use
   `redirect: "manual"` so secrets never follow redirects.
7. **First-run provisioning** (headless box, fresh DB — required so the
   refuse-to-start policy has no dead end): `omni auth init` generates either
   a password (stored as argon2 hash) or a **single-use, short-lived bootstrap
   pairing token**, and prints the pairing URL/QR to the attached TTY — or
   writes it to a file with `0600` perms via `--pair-token-file` for
   unattended deploys. In unattended mode with no secret source configured,
   the runner fails with instructions rather than starting open. The normal QR
   flow (which requires an authenticated session) is unchanged; `omni auth
   pair-url` prints an equivalent pairing link for an already-provisioned
   headless runner. Acceptance test: empty DB → provision → non-loopback bind
   → pair a phone-origin interface → bootstrap token invalidated after use.
8. **Redaction**: `Authorization` headers, pair tokens, stream tickets, and
   token-bearing URLs are scrubbed from logs, error payloads, and named-event
   details.
9. **Next removal**: `NextRequest` usage in `auth/guards.ts`,
   `auth/session.ts`, `api-errors.ts` is replaced with plain Fetch `Request`
   (the 9-line shim `routes/next-request.ts` shows this is mechanical).

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
    It precaches hashed assets plus a static, non-personalized offline shell
    that boots by calling `/api/runtime/bootstrap`.
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
  runnerInstanceId?: string;  // learned at first successful connect/pair
  label: string; baseUrl: string;
  authToken?: string;         // bearer; absent for the same-origin runner
  schemaVersion: 1;
  createdAt: string; lastConnectedAt?: string;
};
```

- Identity rules: after pairing, the profile pins `runnerInstanceId`. If
  `baseUrl` later resolves to a different instance id → connection blocked
  with an explicit mismatch warning (re-pair to accept). Editing `baseUrl`
  clears the token. Two profiles resolving to the same instance id are flagged
  as duplicates. Authorization headers are never forwarded across cross-origin
  redirects (fetch wrapper uses `redirect: "manual"` for bearer requests).
- API compatibility: interface publishes the `apiRevision` range it supports;
  out-of-range runners are blocked with an explicit message (not a soft
  warning); equal-revision, different-version runners just show an info badge.
- **RunnerRegistry** (persisted): profiles + `activeRunnerId`, versioned
  schema (`schemaVersion`) with forward-migration and corrupt-store recovery
  (reset to same-origin default + toast, never a crash). Storage:
  `localStorage` on web/PWA (per-origin; the implicit same-origin runner is
  always present as a non-deletable profile); on Electron, profiles live in
  the **main process** store with tokens encrypted via `safeStorage`.
- **Electron security boundary**: remote HTTP/SSE happens in the **main
  process** (mirroring the proven VSCode extension-host bridge pattern,
  `src/vscode-extension/bridge.ts`); the renderer gets an IPC-backed
  `RuntimeAPIs` implementation and never sees bearer tokens. IPC surface is
  validated per-channel; external links open in the OS browser; navigation is
  locked to the bundled SPA. `safeStorage.isEncryptionAvailable()` is checked:
  when the platform provides no key store, tokens are session-only (or
  persisted plaintext only after explicit user consent), and the degraded
  state is surfaced — never silently claimed as encrypted.
- **Per-runner connection scope.** Everything currently keyed to "the server"
  becomes owned by a `RunnerConnection` created per profile: `RuntimeAPIs`
  instance, `LiveEventConnectionManager` (EventSource + cursor),
  `EventStreamStateManager`, snapshot cache, `WorkerEntriesManager`,
  notification manager. React context provides the *active* connection;
  TanStack Query keys gain a `runnerId` prefix (the client profile id).
  Switching runners swaps the context; inactive connections are **closed** in
  v1, except the switcher's status ping: `GET /api/healthz` per saved profile,
  15 s timeout, exponential backoff capped at 5 min, only while the switcher
  UI is open (no permanent background polling).
- **State invariants** (per `client-server-state-invariants`):
  - Ownership: all domain state belongs to the runner; the client persists
    only runner profiles, UI preferences, and drafts. Drafts are keyed by
    (runnerId, conversationId) so switching runners never leaks a draft.
  - Provenance: every snapshot/event frame is tagged with `runnerId` at the
    connection layer; reducers reject frames whose scope doesn't match.
  - Freshness: on switch/reconnect, the existing snapshot + `Last-Event-ID`
    resume protocol runs per runner; `stream.resync_required` unchanged.
  - Mutations carry their `runnerId`. A mutation completing after a switch is
    **not** treated as cancelled: its cache updates apply to the originating
    runner's query keys (which are simply not on screen), and failures surface
    as a notification naming the runner. Run/conversation ids are only unique
    per runner; all URL deep links (`/session/:runId`) resolve against the
    active runner only.
  - Races to test: rapid switching mid-stream; mutation resolving after
    switch; token revoked mid-session (401 → profile marked needs-reauth,
    banner + re-pair CTA); runner restarted mid-conversation (resume via
    cursor); instance-id mismatch on reconnect.

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
**runner paths** and keep working remotely. Co-location is a *capability, not a
heuristic*: the Electron shell marks a profile co-located only when it launched
that runner process itself (or the user explicitly asserts it). Only co-located
profiles offer `native.chooseFolder()` and OS editor links
(`project-file-links.ts`); everything else uses the `/api/fs` picker dialog and
the in-app file viewer. "localhost" in a URL proves nothing (SSH tunnels) and
is not used as a signal.

### 4.8 Notifications

- Web/PWA: web push keeps working for the runner that serves the PWA (its
  origin's service worker + its VAPID keys — the existing flow, unchanged).
  **Constraint acknowledged**: one SW registration holds one push
  subscription tied to one VAPID key, so a PWA installed from runner A cannot
  also receive native push from runner B in v1. Remote runners' events surface
  in-app while connected; cross-runner push relay is future work.
- Electron: `RuntimeAPIs.native.notify` already exists; the main process
  subscribes to the active runner's named events for notification-worthy
  kinds. Inactive-runner notifications are out of scope for v1.

## 5. User stories (v1 acceptance)

1. **Lean local dev** — As the builder, I run `pnpm dev` and get runner + Vite;
   combined RSS < 2 GB under the scripted workload (§4.1); the dev UI at
   Vite's port behaves identically to the current app. *(Acceptance: full
   existing e2e suite passes in packaged mode — built SPA served from the
   runner port — which is also the production parity gate.)*
2. **Headless runner** — I run `pnpm runner` on a box with no display; it
   serves API, SSE, and the built UI on one port (or API-only without
   `dist/interface`); `omni` CLI and `tests/lifecycle` drive it end-to-end.
3. **Phone** — I open the runner URL on my phone (tailscale/tunnel), install
   the PWA, pair via QR, and supervise agents; terminal, composer, and this
   runner's push notifications work; offline launch shows an explicit
   runner-unreachable shell, not a stale session.
4. **Electron remote** — In the desktop app I add a second runner by URL +
   pairing token, see both in the switcher with status dots, switch between
   them; each shows its own runs/conversations with correct resume after
   reconnect; tokens never reach the renderer.
5. **Failure honesty** — Unreachable runner → explicit offline banner with URL
   and error detail; reconnect resumes via `Last-Event-ID`; 401 → named runner
   + re-pair CTA; instance-id mismatch → blocked with explanation.
6. **Return visit** — Runner profiles, active selection, and UI preferences
   survive restart on web, PWA, and Electron; a corrupted profile store resets
   safely to the same-origin default with a visible notice.

Switcher status states: connected / connecting / offline / needs-reauth /
incompatible (apiRevision) / identity-mismatch.

Onboarding: Electron first launch with no reachable local runner shows a
"Connect a runner" screen (URL + token / QR paste) instead of an error. Web/PWA
never needs onboarding (served by its runner).

## 6. Error transparency & instrumentation

- Existing posture (full error details + stack traces to the frontend) is
  preserved; `update_error` SSE frames and `app-errors.ts` flows unchanged —
  with the §4.3.6 redaction rules applied to credentials/tickets.
- New named events: `runner.bridge_ready`, `runner.bridge_unavailable`,
  `runner.static_ui_enabled`, `runner.static_ui_missing`, `runner.stopping`
  (also sent as the SSE goodbye frame), `auth.bearer_issued`,
  `auth.bearer_origin_rejected`, `auth.stream_ticket_issued`,
  `auth.unprotected_non_loopback`, plus existing `runtime.started/stopped`.
- Client-side connection lifecycle logged through `LiveEventConnectionManager`
  diagnostics; switcher surfaces last error per profile verbatim.
- Control plane: everything remains scriptable headless (`tests/lifecycle`
  already proves this). `omni` CLI gains `--runner <url>` plus token via
  `OMNI_TOKEN` env / `--token-file` / stdin — never a bare `--token` argv
  (shell history, `ps`) except as an explicitly warned compatibility flag.

## 7. Testing strategy

- **Unit/integration (vitest)**: streaming server (SSE via `startOmniServer`:
  heartbeat, `Last-Event-ID` resume without duplicates, client-disconnect
  cleanup, backpressure, flush-per-frame through a compressing proxy); bearer
  auth (origin binding, wrong-origin rejection, preflight, redirect
  non-forwarding); stream tickets (single-use atomicity, expiry, concurrent
  redemption, reconnect-with-fresh-ticket); static serving (bootstrap JSON
  escaping incl. `</script>`/U+2028, SPA-fallback scope, 404s for `/api/*`,
  traversal rejection, cache headers); RunnerRegistry (schema migration,
  corruption recovery, identity pinning/mismatch, baseUrl-edit token clearing);
  connection races (§4.5 list); network exposure policy (refuse-to-start
  matrix).
- **Route parity gate before deleting Next adapters**: table-driven test
  hitting every registry route through both the Next adapter and
  `startOmniServer`, comparing status, headers (incl. cookies), and body
  semantics; includes multipart upload. Stateful routes run against isolated
  per-adapter fixtures (separate DB/data dirs), not sequentially on one DB.
  SSE endpoints compare status/headers plus a bounded sequence of normalized
  frames, then abort and assert subscriber cleanup (streams never "complete").
- **Lifecycle suite** (`tests/lifecycle`) runs against `scripts/runner.ts` —
  the primary backend regression gate.
- **Playwright e2e**: existing suites repointed at the runner-served SPA; new
  two-runner spec (two runner processes, separate DBs/data dirs/ports/
  identities): add → pair → switch → restart one runner → resume. Browser
  cross-origin spec: SPA from runner A pairs and talks to runner B.
- **Electron/VSCode**: `tests/electron` updated for the IPC RuntimeAPIs and
  main-process networking; `tests/vscode` updated for the new default port +
  bearer wiring ("behavior unchanged" still requires these test updates).
- **Candidate agentic user-journey tests** (require approval before running):
  (a) phone-viewport PWA pair + send message against a fresh runner;
  (b) Electron connects to a remote runner, switches, and recovers from a
  runner restart mid-conversation.

## 8. Milestones

Resequenced so multi-runner ships dark until every request path is scoped:

**M1 — Runner stands alone** *(backend only; Next still serves the UI)*
Streaming fix; `scripts/runner.ts` with boot duties, lifecycle contract,
`healthz`; `next/server` out of auth/api-errors; route-parity test rig;
lifecycle suite green against the runner.

**M2 — Interface on Vite, Next deleted**
`apps/interface`; layout ported; Next-isms removed; static-serving contract +
bootstrap injection; SW/PWA caching contract; `pnpm dev` = runner + Vite;
route-parity + Playwright green; then delete `src/app/api/*`, page/layout/
instrumentation, `next.config.ts`, Next deps; `src/app/home/` →
`src/interface/home/`; memory acceptance measured.
*Transitional shell contract*: Electron switches to loading the Vite
production bundle in this milestone while keeping its current local runtime
transport (it must not break for four milestones); VSCode's default port
moves off the retired 3035 here too, with its regression test.

**M3 — Transport unification** *(no user-visible change)*
Shared types to `src/shared/` + ESLint boundary + split typecheck projects;
all 29 call sites through `RuntimeAPIs`; `useHomeMutations.ts` split by domain;
query keys gain `runnerId` prefix (still always `"local"`).

**M4 — Remote auth protocol** *(dark: no switcher UI yet; gate: network-policy
sign-off from §11.1)*
Bearer sessions with stored-provenance origin binding (existing
`auth_sessions` rows migrate to `transport: "cookie"` without invalidating
live sessions); stream tickets +
reconnect ownership in `LiveEventConnectionManager`; preflight handling;
trusted-proxy contract; first-run provisioning (`omni auth init`); runner
identity (`instanceId`, `apiRevision`) in bootstrap; network-exposure policy +
redaction; `omni --runner` flags; VSCode gains bearer wiring here.

**M5 — Multi-runner UI (web/PWA only)**
RunnerRegistry persistence (+ migration/recovery); `RunnerConnection` scoping
and race handling; switcher + status states; onboarding screen; drafts keyed
per runner; two-runner Playwright + cross-origin browser specs pass. Switcher
controls stay hidden in Electron until M6.

**M6 — Electron remote client**
Main-process networking + IPC RuntimeAPIs; `safeStorage` tokens; co-location
capability gating for native pickers/editor links; switcher enabled in
Electron; `tests/electron` updated.

Each milestone leaves every shell working; M1–M3 are refactors guarded by
parity tests, M4 ships dark, M5 turns multi-runner on for web/PWA, M6
completes Electron.

## 9. Risks & trust surfaces

- **Exposing runners on a network** is the point of this work. Mitigations:
  refuse-to-start policy (§4.3.5, needs user sign-off), origin-bound bearer
  sessions, single-use path-bound stream tickets, tokens encrypted at rest in
  Electron's main process only, never in URLs or logs, rate-limited issuance.
  Docs recommend tailscale/tunnels over raw port-forwarding.
- **SSE through proxies/tunnels**: heartbeats exist; streaming rewrite must
  flush per-frame (tested through a compressing proxy — the scenario that
  motivated `dev-compression-proxy.ts`).
- **Single-process API server** remains a hard constraint (in-memory event
  bus/PTYs). Documented; horizontal scaling is a non-goal.
- **Churn risk**: M3 touches 29 files. Mitigated by per-domain mechanical PRs,
  parity tests, and shipping dark until M5.
- **Electron regression risk**: startup contract changes; covered by
  `tests/electron` in M6.

## 10. North star & future direction (context, not commitment)

One interface, installed anywhere, showing all your runners: merged
cross-runner dashboard, cross-runner push relay, background notifications from
inactive runners, runner health/resource panel, Tauri/mobile-native shells,
package extraction (Approach B) once boundaries settle, runner-to-runner work
handoff.

## 11. Open questions for review

These become milestone gates, not loose ends:

1. **Network exposure policy** (§4.3.5): OK to refuse non-loopback start
   without auth (override via env)? Stricter than today. **Sign-off required
   before M4 starts.**
2. Naming: "runner" = API server + bridge pair; docs-level rename only.
3. Compression proxy (3035) retired; VSCode default port changes. **M2 entry
   task: audit all consumers of 3035** (scripts, docs, tunnels, VSCode
   settings) before removal.
4. Memory thresholds (< 2 GB dev, < 1 GB prod runner): **calibrated against a
   baseline measurement in M1** before being treated as failures.


uuid: fd2a4d17-3609-418a-9c53-14ceec210a84

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-07-30T16:00:05.321Z","phase":null} -->
## Claude thinking · 2026-07-30T16:00:05.321Z



uuid: b9a91364-b2ea-42e9-bdd3-2ba6082ebdd5
parent: dc629077-fe50-4ca2-b2b4-c7efbd2ed8e2

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-07-30T16:00:55.439Z","phase":null} -->
## Claude · 2026-07-30T16:00:55.439Z

## 1. Verdict

**HARDEN.** The spec is unusually mature — the auth threat model, milestone dark-shipping, and state-invariant sections are better than most designs at this stage. But there are three internal contradictions and one sequencing error that would each cost a milestone to discover during implementation, plus a missing SSE epoch concept that the stated replay/resync constraint depends on.

## 2. Highest-impact findings

**a. Missing stream epoch — resume across runner restart is undefined (blocks the stated SSE ids/replay/resync requirement).**
§3(A) states the event ring is module-level memory, so ids do not survive a restart, yet §4.5 and §5.5 promise "reconnect resumes via `Last-Event-ID`" and §4.5 lists "runner restarted mid-conversation (resume via cursor)" as a test. After a restart a stale cursor either falls outside the new ring (detectable) or coincidentally inside it (silent gap or duplicate replay). Nothing distinguishes the two.
*Fix:* mint a per-process `streamEpoch` at boot, expose it in bootstrap, and format SSE ids as `<epoch>-<seq>`. On connect, epoch mismatch → unconditional `stream.resync_required` before any frames. Add a test: kill runner mid-stream, restart, reconnect with the old cursor, assert resync and no duplicate/dropped frames.

**b. Control frames must not advance the client cursor.**
§4.2 makes `runner.stopping` "also sent as the SSE goodbye frame" and §6 lists it as a named event. If it lands in the ring with an id, clients persist a cursor pointing at a dead epoch, compounding (a).
*Fix:* state explicitly that `runner.stopping` and `stream.resync_required` are id-less control frames excluded from cursor bookkeeping in `LiveEventConnectionManager`, and test that the cursor is unchanged after receiving each.

**c. Contradiction: Electron is "pure remote client" but §4.7 gates co-location on Electron having launched the runner.**
§2 and §4.5 describe a client that only connects; §4.7 says a profile is co-located "only when it launched that runner process itself"; §5 onboarding says first launch with no reachable local runner shows a connect screen. There is no spawn/supervise/shutdown contract anywhere for the case where Electron *does* launch one. This materially changes M6 scope (port selection, health wait, quit-time teardown, orphan cleanup).
*Fix:* pick one. Either drop the "launched it ourselves" branch and make co-location a purely explicit user assertion in v1, or add a local-runner lifecycle contract to §4.2 and size M6 accordingly. The first is the cheaper, more consistent choice.

**d. Contradiction: PWA offline launch vs. "SW never caches `index.html`".**
§4.4 forbids caching `index.html`, yet requires that installing from A, stopping A, and launching offline still boots the switcher and connects to B (§4.4, §5.3, §5.6). With `start_url: /` uncached, the navigation simply fails — there is nothing to boot.
*Fix:* define a precached, non-personalized `app-shell.html` (hashed, no bootstrap blob, same CSP header), have the SW serve it as the navigation fallback, and point `start_url` at the shell path. State that the shell always takes the `GET /api/runtime/bootstrap` path. This is the artifact the §4.4 test already assumes exists.

**e. Sequencing error: the Vite build (M2) precedes the boundary work that makes it possible (M3).**
§3(G) names `review-preferences.ts` as a *runtime* zod import pulled in by client components, and §3(H) names 29 hardcoded fetch/EventSource sites. M2 stands up `apps/interface` and deletes Next; M3 does the `src/shared/` extraction, the ESLint boundary, and the split typecheck projects. The first Vite build will pull `src/server` into the browser graph, and the spec's own backstop ("Vite build failing on a server import") does not exist yet.
*Fix:* move the `src/shared/` extraction, the two file moves with re-export shims, the `no-restricted-imports` rule, and the split `tsc` projects into M1 (they are backend-safe refactors). Leave the 29 call-site migration and the `useHomeMutations.ts` split in M3 — those are same-origin-safe and genuinely independent.

**f. `error.surfaced` is absent from the entire spec despite being a stated house rule.**
§6 adds nine named events, none of them `error.surfaced`, while the design introduces many new user-visible failure modes: bridge unavailable, needs-reauth 401, identity mismatch, incompatible `apiRevision`, refuse-to-start, stream-ticket issuance failure, static UI missing, runner unreachable.
*Fix:* enumerate which of those paths emit `error.surfaced` alongside their domain event, and — since several originate client-side (registry corruption, identity mismatch, offline) — state explicitly whether client-origin failures report through a runner endpoint or whether `error.surfaced` is scoped server-side with a named client-side equivalent. Add one acceptance test per surface asserting emission.

**g. Contradiction: mutations survive a switch, but switching closes the connection.**
§4.5 says inactive connections are "closed in v1" and, separately, that "a mutation completing after a switch is **not** treated as cancelled" and applies to the originating runner's query keys.
*Fix:* define close as SSE teardown plus a bounded grace window for in-flight HTTP (no `AbortController` fire on switch); after the window, abort and surface a notification naming the runner. Add this to the §4.5 race test list explicitly — "mutation resolving after switch" is listed but the abort semantics it depends on are not specified.

**h. Scope keys use the profile id, which the spec itself says is not identity.**
§4.5 declares `id` is "for list keys only — NOT identity", then keys TanStack Query and drafts on it. Delete-and-re-add orphans caches and drafts; two profiles pointing at one instance diverge (a case §4.5 explicitly detects as a duplicate).
*Fix:* key caches and drafts on `runnerInstanceId` once learned, falling back to profile id only in the pre-pair window, and define the one-time rekey when the instance id is first learned.

**i. Two runners on one host is untestable as specified.**
§7 requires a two-runner Playwright spec with "separate DBs/data dirs/ports/identities", but §4.2 fixes the bridge at 7800 with a single lockfile, and boot also starts a Claude model gateway child. Both are per-machine singletons today.
*Fix:* parameterize bridge port, gateway, lockfile path, and any shared runtime dir off a single `OMNIHARNESS_INSTANCE`/data-dir root; make the extracted bridge-spawn module (§4.2 step 4) take these as parameters rather than reading globals. Without this, M5's headline acceptance test cannot run.

**j. Trusted-proxy contract covers protocol but not rate-limit identity.**
§4.3.6 gates `Forwarded`/`X-Forwarded-Proto` on `OMNIHARNESS_TRUSTED_PROXIES` but says nothing about `X-Forwarded-For`. Behind the recommended tailscale/tunnel setup, every request shares one socket peer, so the §4.3.2 rate limiting on `/api/auth/login` either degrades to a global lockout (self-DoS) or, if XFF is trusted unconditionally, is trivially bypassed.
*Fix:* derive the rate-limit key from XFF **only** when the peer is trusted, otherwise from the socket; state the per-key policy and add it to the §7 "refuse-to-start matrix" test group.

**k. The CSP script hash has no build→runtime plumbing.**
§4.2 has the runner emit `script-src 'self' 'sha256-<theme-bootstrap-hash>'` as an HTTP header, but the hash is a property of the Vite build and `pnpm build` produces only `dist/interface/`.
*Fix:* have the Vite build emit a `csp-manifest.json` into `dist/interface/`; the runner loads it at boot and fails loudly on missing/mismatched hash rather than shipping a page that white-screens. Add a test asserting the header is present, the hash matches the served inline script, and the `type="application/json"` bootstrap block still parses under the policy.

**l. Smaller but concrete:** `GET /api/healthz` is unauthenticated and cross-origin readable — pin its body to a fixed `{ok:true}` with no version/instanceId/hostname, since §4.5 only needs reachability. Specify where the VSCode shell stores its bearer token (SecretStorage), since §4.3 gives it bearer wiring in M4 while §2 calls its behavior unchanged. Say what happens to the §7 route-parity harness after M2 deletes the Next adapters — convert it to a registry-contract snapshot rather than letting the coverage evaporate. And state that `apiRevision` hard-blocking (§4.5) can strand a user mid-upgrade with two runners on different versions; that is a UX call worth listing alongside §11.1 rather than asserting.

## 3. What I would deliberately leave alone

- **Approach A (in-place, one package).** Correct call. The 460-file monorepo extraction buys nothing until the boundary is proven, and the ESLint rule plus split typecheck projects give you most of the enforcement now.
- **The bearer threat model as written.** Naming it browser-origin isolation rather than token binding, and explicitly deferring DPoP, is the right kind of honesty. Don't add crypto binding to v1.
- **The single-process API server constraint.** Documented, not fought. Right.
- **The one-VAPID-per-SW push limitation and the runner-switcher-over-merged-views decision.** Both are correctly identified as v1 boundaries with future work named.
- **Bootstrap injection to preserve zero-round-trip boot**, and keeping the cookie flow byte-identical for the same-origin case. Adding a second transport without touching the working one is what makes M4 shippable dark.
- **Memory thresholds as a calibrated local benchmark rather than a CI gate**, and §11.4's decision to baseline before enforcing.
- **Keeping the API server and bridge as two processes.** Merging them would be a second migration riding on this one.

*(No tools used and no plan file written, per your instruction.)*

uuid: 2ba9ffac-a4ac-49bb-845c-8929fdbcca65
parent: b9a91364-b2ea-42e9-bdd3-2ba6082ebdd5

<!-- /codex-event -->
