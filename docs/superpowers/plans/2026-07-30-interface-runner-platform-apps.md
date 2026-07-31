# Interface / Runner / Platform Apps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship OmniHarness as one logical headless runner plus one shared interface delivered through web/PWA, Electron desktop, Capacitor iOS/Android, and VSCode, with every authenticated runner profile concurrently connected while the client process is active.

**Architecture:** Keep the repository as one pnpm package with enforced runner/shared/interface boundaries. The runner remains a managed API-server + local ACP-bridge deployment; clients use transport-neutral `RuntimeAPIs` over HTTP/SSE or validated native bridges. The existing shared password creates revocable cookie or bearer sessions, while browser-to-browser authorization uses a same-runner S256 PKCE approval window rather than open-CORS password login.

**Tech Stack:** Node 22+, TypeScript, React 19, Vite, TanStack Query, Base UI/shadcn, SQLite/Drizzle, HTTP/SSE, Electron, Capacitor iOS/Android, Swift Keychain Services, Android Keystore, VSCode extension APIs, Vitest, Playwright.

**North Star Product:** One interface installed anywhere, keeping all of a builder's runners visible and connected, with platform-native security and capabilities but one shared product experience.

**Current Milestone:** Deliver the entire approved v1 in the seven architecture milestones below; this plan does not stop after the runner or web split.

**Future Product Direction:** Merged cross-runner dashboards, native push after mobile suspension, runner-to-runner handoff, and later package extraction remain context only.

**Final Functionality Standard:** Completion requires real runner, browser, Electron, VSCode, iOS, and Android functionality; password authentication and session administration; concurrent live runner streams; restart/resync safety; platform-secure credential storage; end-to-end migration/recovery states; and the full verification matrix. No mock shell, placeholder connection, canned runner data, or fake native bridge can satisfy a task.

---

## Approved product decisions

- One logical runner deployment owns SQLite, supervisor, agents, ACP bridge, PTYs, auth, and events. The API server and bridge remain separate co-located processes.
- Desktop uses Electron. iOS and Android use Capacitor. Web/PWA and VSCode remain first-class.
- Every saved authenticated runner keeps one main event connection live while the app process is active. The interface renders one runner workspace at a time.
- The existing shared runner password is the only login secret. It creates separate revocable sessions; clients do not persist the password.
- Browser/PWA cross-origin login uses a target-runner approval window + S256 PKCE. Native hosts use originless direct password login and never expose bearer tokens to renderers/WebViews.
- Work stays in the current checkout. Do not create a branch or worktree. Preserve all existing user changes.

## Product and state model

### Primary journeys

1. Start a headless runner and use it through API/SSE, with or without a static interface artifact.
2. Add runners from web/PWA through the target-runner authorization window.
3. Add runners from Electron, Capacitor, VSCode, or CLI with URL + shared password.
4. Keep all authenticated profiles connected, switch the visible workspace without closing inactive main streams, and receive runner-named notifications.
5. Return after restart with profiles, per-runner drafts, cursors, and preferences restored.
6. Recover honestly from offline, deferred, needs-reauth, TLS-untrusted, identity-mismatch, incompatible, degraded/resync, and runner-stopping states.
7. List/revoke sessions, rotate the shared password, forget/edit profiles, rename a runner, and migrate existing Electron state.

### Ownership and invariants

- Runner owns all domain state. Client persistence is limited to profiles, credentials through a platform adapter, UI preferences, bounded preview caches, cursors, and drafts.
- `runnerInstanceId` is the durable scope after identity is known; profile UUID is only the pre-login/list-key fallback.
- Every async response, mutation, timer, reconnect, snapshot, and frame carries/checks runner scope before updating a Manager or Query cache.
- Bootstrap/snapshot proves authority and completeness. Preview caches never satisfy a fresh-load gate.
- SSE ids are `<streamEpoch>:<sequence>`. Every event frame carries an id. Resync has a stable reason and a separate anti-storm governor.
- One profile has one main event stream. Terminal streams exist only for the visible runner and reload bounded scrollback on activation.
- Query keys, drafts, cursors, worker caches, notifications, and errors are runner-scoped.
- Every server decision/refusal/failure emits a typed named event; user-relevant server failures additionally emit `error.surfaced`.
- All new user-facing copy is added to every file in `shared/locales/*.json` and rendered with `t()`.
- Shared Manager subscriptions remain narrow; draft text, cursors, hover/open state, and other high-churn fields cannot repaint the full application shell.

## File map

### Create

- `src/shared/runtime.ts` — runtime surface/stop/event-id primitives shared across boundaries.
- `src/shared/bootstrap.ts` — runner identity, capabilities, bootstrap, and compatibility payload types.
- `src/shared/home-types.ts` — portable on-wire home/event/settings/session records with an interface re-export shim.
- `src/shared/api-revision.ts` — revision window, capability ids, and declared contract-change classifications.
- `src/shared/worker-entries.ts` — client/server worker-entry types.
- `src/shared/planning-review.ts` — planning review schemas/types safe for the interface.
- `src/shared/worker-types.ts` — supported worker types and display labels used by both sides.
- `tsconfig.shared.json`, `tsconfig.runner.json`, `tsconfig.interface.json` — independent typecheck projects.
- `src/server/runner/config.ts` — isolated runner/bridge/gateway/static/TLS configuration.
- `src/server/runner/ManagedBridgeController.ts` — bridge adopt/start/retry/ownership state machine.
- `src/server/runner/RunnerReadinessManager.ts` — bounded in-memory readiness/bridge/static state.
- `src/server/runner/shutdown.ts` — ordered server/SSE/PTY/gateway/bridge shutdown.
- `scripts/runner.ts` — production/development runner entry.
- `src/runtime/http/stream-response.ts` — bounded Web-stream to Node response bridge.
- `src/runtime/http/static-files.ts` — safe SPA/static serving, cache policy, manifest validation.
- `src/runtime/http/bootstrap-html.ts` — escaped bootstrap injection.
- `src/runtime/http/security-headers.ts` — web and packaged CSP/referrer headers.
- `apps/interface/index.html`, `apps/interface/app-shell.html`, `apps/interface/vite.config.ts`, `apps/interface/src/main.tsx` — Vite interface target.
- `src/interface/providers.tsx`, `src/interface/styles/**` — Vite-owned providers and styles moved from `src/app`.
- `apps/interface/vite-csp-manifest.ts` — build-time theme hash/asset manifest output.
- `apps/interface/public/manifest.webmanifest`, `apps/interface/public/sw.js` — Vite-owned PWA assets.
- `src/runtime-api/stream.ts` — transport-neutral stream/frame contract.
- `src/runtime-api/request.ts` — redirect-safe request/error primitives.
- `src/runtime-api/domains/*.ts` — typed API domain adapters for auth, runs, conversations, workers, files, git, planning, settings, accounts, notifications, and terminals.
- `src/server/auth/browser-authorization.ts` — S256 approval-code lifecycle.
- `src/server/auth/stream-tickets.ts` — atomic single-use path-bound SSE tickets.
- `src/server/auth/trusted-proxy.ts` — socket-derived protocol/client identity.
- `src/server/auth/cors.ts` — route-aware bearer CORS with no credentials flag.
- `src/runtime/http/routes/auth-browser-authorization.ts` — authorization/code-exchange routes.
- `src/runtime/http/routes/auth-stream-ticket.ts` — ticket route.
- `src/runtime/http/routes/auth-sessions.ts` — session list/revoke routes.
- `src/interface/auth/InterfaceAuthorizationScreen.tsx` — same-runner origin approval screen.
- `src/interface/runners/RunnerProfile.ts` — versioned profile and status types.
- `src/interface/runners/RunnerCredentialStore.ts` — platform credential-store interface.
- `src/interface/runners/RunnerProfileStore.ts` — platform profile/prefs persistence interface.
- `src/interface/runners/RunnerConnection.ts` — one runner's transport, managers, caches, state machine, cursor, retries.
- `src/interface/runners/RunnerRegistry.ts` — all profiles/connections + active selection.
- `src/interface/runners/RunnerRegistryProvider.tsx` — narrow active/all-runner React subscriptions.
- `src/interface/runners/RunnerSwitcher.tsx` — shadcn `sidebar-07`-derived switcher.
- `src/interface/runners/ConnectRunnerScreen.tsx` — shadcn `login-03`-derived onboarding.
- `src/interface/runners/RunnerSessionsPanel.tsx` — compact session/revocation control surface.
- `src/interface/home/mutations/*.ts` — split conversation/run/planning/settings/auth mutations.
- `src/components/terminal/*.tsx` and `src/components/terminal/*.ts` — split terminal rendering/stream/control responsibilities.
- `apps/electron/src/ProfileStore.ts`, `CredentialStore.ts`, `RuntimeBridge.ts`, `TlsPinStore.ts`, `migration.ts` — remote-only desktop host.
- `src/runtime-api/capacitor.ts` — Capacitor bridge-backed interface adapter.
- `apps/mobile/capacitor.config.ts`, `apps/mobile/package.json` — shared mobile shell config.
- `apps/mobile/src/native-contract.ts` — validated JavaScript/native request contract.
- `apps/mobile/ios/App/App/OmniNativePlugin.swift` — URLSession/SSE, Keychain, TLS pinning, links/notifications.
- `apps/mobile/android/app/src/main/java/.../OmniNativePlugin.kt` — OkHttp/SSE, Android Keystore, TLS pinning, links/notifications.
- `tests/runtime/route-contract-fixture.ts` and versioned fixture data — portable route contract after Next deletion.
- New tests under `tests/runtime`, `tests/server/runner`, `tests/server/auth`, `tests/runtime-api`, `tests/interface/runners`, `tests/electron`, `tests/vscode`, `tests/mobile`, `tests/lifecycle/scenarios`, and `tests/e2e`.

### Modify

- `.gitignore`, `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `components.json`, `eslint.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`.
- `src/server/events/named-events.ts`, `src/server/events/live-updates.ts`, `src/runtime/http/routes/events.ts`, `src/runtime/http/server.ts`.
- `scripts/dev.ts`, `scripts/start.ts`, `scripts/measure-local-dev.mjs`, `scripts/free-port.sh`, `controller.sh`, `omni.sh`, `start.sh`.
- `src/server/db/schema.ts`, `src/server/db/index.ts`.
- `src/server/auth/config.ts`, `password.ts`, `session.ts`, `guards.ts`, `rate-limit.ts`, `audit.ts`.
- `src/server/api-errors.ts`, `src/runtime/http/routes/index.ts`, `auth-login.ts`, `runtime-bootstrap.ts`, `terminals.ts`, `settings.ts`.
- `src/runtime-api/types.ts`, `web.ts`, `electron.ts`, `vscode.ts`, `provider.tsx`.
- `src/ui/render-web.tsx`, `src/ui/OmniApp.tsx`, then `src/interface/providers.tsx`.
- All direct browser API/SSE owners listed in `docs/architecture/common-runtime-multi-surface.md`.
- `src/interface/home/HomeApp.tsx`, `useHomeMutations.ts`, `useHomeQueries.ts`, `LiveEventConnectionManager.ts`, `WorkerEntriesManager.ts`, `EventStreamStateManager.ts`, `EventStreamSnapshotCacheManager.ts`, `ConversationNotificationManager.ts`, `GitWorkspaceManager.ts`, `ProjectMemoryPanelManager.ts` after the import-only move in Task 11A.
- `src/components/InteractiveTerminal.tsx`, `Terminal.tsx`, file/folder/attachment components, planning controls, and `ConversationMain.tsx`.
- All nine `shared/locales/*.json`.
- `apps/electron/main.ts`, `preload.ts`, `scripts/build.mjs`, `package.json`, `README.md`.
- `apps/vscode/src/extension.ts`, `webview/main.tsx`, `package.json`, `README.md`, `src/vscode-extension/bridge.ts`.
- `src/server/cli/options.ts`, `src/server/cli/runner.ts`, `scripts/auth-password.mjs`.
- `README.md`, `.env.example`, `AGENTS.md`, `docs/architecture/common-runtime-multi-surface.md`, lifecycle docs, deployment/TLS docs.

### Remove at the M2 cutover

These removals are explicitly part of the approved Next-removal design and happen only after route parity, Vite packaged e2e, and PWA tests pass:

- `src/app/api/**`, `src/app/page.tsx`, `src/app/layout.tsx`, `src/instrumentation.ts`.
- `src/app/home/bootstrap.server.ts` after its interface type consumer moves to `src/shared/bootstrap`.
- `next.config.ts`, `next-env.d.ts`, Next-only dependencies/configuration.
- Old Next-owned PWA copies after their Vite-owned replacements pass tests.
- No file outside this enumerated list is removed as part of the cutover.

### Existing large-file rule

- `src/app/home/useHomeMutations.ts` (1,269 lines), `HomeApp.tsx` (1,697), and `src/components/Terminal.tsx` (2,553) are split before adding the new behavior they own.
- Do not add runner work to already oversized `src/server/supervisor/index.ts` or `src/server/agent-runtime/manager.ts`; use the new focused runner modules.

### `.gitignore` requirements

- Add `/dist/`, `/apps/mobile/ios/App/Pods/`, `/apps/mobile/ios/DerivedData/`, `/apps/mobile/android/.gradle/`, `/apps/mobile/android/**/build/`, `/apps/mobile/android/local.properties`, signing files, provisioning profiles, keystores, generated release archives, and native SDK caches.
- Keep native project source/configuration versioned. Never stage `.env`, auth keys, SQLite files, tokens, certificates/private keys, build output, logs, or local signing state.

## Execution checklist

### Task 1 — Baseline and boundary tests

**Files:** `tests/architecture/interface-boundary.test.ts`, `tests/architecture/typecheck-projects.test.ts`, `eslint.config.mjs`, `tsconfig*.json`, `.gitignore`.

**Current-checkout note (2026-07-31):** The boundary work below is implemented and verified but uncommitted. Preserve `src/shared/**`, the three server re-export shims, the tsconfig files, architecture tests, and ESLint/gitignore edits alongside the user's earlier `Terminal.tsx`, model-selection, agent-runtime, named-events, external-session discovery, and test changes. Do not branch, stash, reset, or rewrite completed moves.

- [x] Record `git status --short` and the full diff/untracked-file inventory. Preserve and re-verify all named existing edits after Tasks 3 and 12.
- [x] Add architecture tests that enumerate interface entry imports and reject runtime imports from `@/server/*`/`@/runtime/*`, except declared `@/shared/*`.
- [x] Add tests that require separate shared/runner/interface typecheck configs and mobile/build ignores; observe the intended red failures.
- [x] Create the three tsconfig projects, enforce the ESLint restriction, and add `.gitignore` entries; keep root `typecheck` running all projects.
- [x] Verify the architecture tests, all typecheck projects, focused shared tests, and lint with zero errors.

### Task 2 — Extract genuinely shared types and values

**Files:** new `src/shared/*.ts`; old `src/server/workers/entries-types.ts`, `src/server/planning/review-preferences.ts`, `src/server/supervisor/worker-types.ts`; `src/runtime/bootstrap.ts`; affected interface imports.

- [x] Add failing import/runtime tests for worker entry types, planning schema, worker labels, runtime primitives, home wire records, and bootstrap types from `src/shared`.
- [x] Move pure definitions to shared modules; leave server-side and interface re-export shims so unrelated imports do not churn.
- [x] Move `HomeBootstrapPayload` and runner/capability types out of `src/runtime/bootstrap.ts`.
- [x] Update interface imports, including `src/lib/agent-output.ts`, and prove the interface graph contains no server/runtime source.
- [x] Repoint `HomeApp.tsx` to `@/shared/bootstrap`, turn the interface-boundary test green, and enforce `no-restricted-imports` as an error.
- [x] Run targeted shared/import tests, all three project typechecks, the root typecheck, and lint.

### Task 2A — Record the pre-split process-memory baseline

**Files:** `scripts/measure-local-dev.mjs`, deterministic fixture-agent harness, checked-in baseline report under `docs/architecture/benchmarks/`, measurement tests.

- [x] Add failing parser/sampler tests for process-tree discovery, peak/final RSS aggregation, deterministic workload timing, and child exit cleanup.
- [x] Extend the measurement script to run a deterministic 10-minute fixture-agent workload with no live model and sample the whole current Next/runner/bridge process tree.
- [x] Record the pre-split baseline while the current Next development topology is still intact. Task 11 cannot calibrate or authorize cutover without this report.
- [x] Verify repeat behavior against the documented tolerance, record the observed tolerance miss without weakening the cutover target, and clean every fixture session/process/artifact.

### Task 3 — Epoch-aware event ids, heartbeat, replay, and resync

**Files:** `src/shared/runtime.ts`, `src/server/events/named-events.ts`, `src/runtime/http/routes/events.ts`, `src/app/home/LiveEventConnectionManager.ts`, event/lifecycle tests.

- [x] Add failing tests for `<epoch>:<seq>` parsing/comparison, every event frame carrying an id, a process-global id-bearing heartbeat, restart epoch mismatch, cursor below ring floor, and resync reasons.
- [x] Add failing client tests for cursor persistence behind an injectable scope key and clear-on-resync; durable `runnerInstanceId` scoping and the resync governor land after Tasks 13 and 18.
- [x] Implement the per-process epoch, 4096-entry ring, heartbeat event, header/query cursor parsing (`cursor` wins), and stable resync reasons.
- [x] Update `LiveEventCursorManager` to compare epoch + sequence rather than treating all nonnumeric ids as newer.
- [x] Emit the subscriber-overflow diagnostic and add its typed event/error codes without overwriting existing named-event work.
- [x] Verify event-route, cursor, lifecycle reconnect/restart, and event-log tests.

### Task 4 — Bounded Node streaming and shutdown behavior

**Files:** `src/runtime/http/stream-response.ts`, `src/runtime/http/server.ts`, `src/runtime/http/routes/events.ts`, terminal stream route, server tests.

- [x] Add failing real-server tests for immediate headers, per-frame flush, compressing-proxy flush, `drain` handling, client disconnect cleanup, and upstream reader cancellation.
- [x] Add a non-reading consumer test that drives output past 256 frames/1 MiB, observes eviction/resync or socket close, and samples flat runner RSS.
- [x] Implement streaming without `arrayBuffer()`, with Nagle disabled for SSE and bounded subscriber queues independent of the global ring.
- [x] Track open streams so shutdown stops accepts, emits id-bearing `runner.stopping`, gives a bounded flush window, then aborts readers.
- [x] Verify standalone server, event SSE, terminal SSE, and lifecycle graceful-stop tests.

### Task 5 — Isolated managed runner and degraded bridge lifecycle

**Files:** new `src/server/runner/*`, `scripts/runner.ts`, extracted pieces from `scripts/dev.ts`, `src/instrumentation.ts`, runner/lifecycle tests.

- [x] Add failing controller tests for adopt, spawn, missing runtime, unhealthy bridge, lock contention, child crash, retry/backoff, ownership-aware shutdown, and explicit instance roots/ports/lockfiles.
- [x] Add failing runner tests proving bridge failure does not prevent health/API/bootstrap, while bind conflict and invalid auth/static configuration fail fast with typed events/errors.
- [x] Implement `ManagedBridgeController` and `RunnerReadinessManager` as Manager-owned state machines; no silent returns/catches.
- [x] Implement `scripts/runner.ts` boot order and isolated gateway port-0 strategy for tests.
- [x] Implement ordered shutdown for HTTP/SSE, PTYs, gateway, and owned/adopted bridge.
- [x] Emit all bridge/runner/error events specified by the design; static-UI events belong to Task 9.
- [x] Point `scripts/start.ts`, controller scripts, and lifecycle subprocess harness at the runner.
- [x] Verify runner unit tests and `pnpm test:lifecycle`; clean all test roots/processes.

### Task 6 — Portable route registry, health, and terminal replay contract

**Files:** `src/runtime/http/routes/index.ts`, all route modules, `src/runtime/http/server.ts`, `tests/runtime/route-contract-fixture.ts`, `tests/runtime/fixtures/routes.v1.json`, terminal route/tests.

- [x] Generate a checked-in route-contract fixture from the current 49 Next route handlers and 63 registered standalone routes. Add a table-driven `tests/runtime/next-standalone-route-parity.test.ts` that executes every registry route through both adapters against separate per-adapter data/database roots and compares status, normalized headers (including `Set-Cookie` values/security semantics), and body semantics.
- [x] Add parity cases for multipart upload and every SSE endpoint. Compare a bounded normalized frame sequence, abort both clients, and assert subscriber/readers are cleaned up.
- [x] Add failing tests for minimal cross-origin `/api/healthz`, authenticated bootstrap while the bridge is degraded, API 404 behavior, and exactly one response per request.
- [x] Test whether a terminal attach receives bounded scrollback before live output. If it does not, add a failing contract test and implement a size-bounded server replay window before client work begins.
- [x] Move any remaining route-only logic out of `src/app/api/**` into portable route/service modules, with Next handlers temporarily delegating to them.
- [x] Make route registration metadata drive `OPTIONS`, auth, and the contract fixture rather than maintaining parallel lists.
- [x] Verify route parity, health, terminal replay, and lifecycle tests before changing the interface build.

### Task 7 — Transport-neutral Runtime APIs

**Files:** `src/runtime-api/request.ts`, `stream.ts`, `domains/*.ts`, `types.ts`, `web.ts`, `electron.ts`, `vscode.ts`, `provider.tsx`, adapter contract tests.

- [x] Inventory every existing API/SSE call in a checked-in `docs/architecture/runtime-api-migration-inventory.md`, mapping each call site to its target domain method; update `common-runtime-multi-surface.md` from the same inventory. Add failing compile/runtime tests for typed request, abort, redirect refusal, error normalization, stream frames, and all domain methods.
- [x] Define one `RuntimeAPIs` surface with domain adapters for auth, runs, conversations, workers, files, git, planning, settings, accounts, notifications, and terminals.
- [x] Implement the web adapter with injectable `fetch`/stream creation and no direct global network access in shared consumers.
- [x] Keep Electron and VSCode adapters behaviorally compatible while their host transports are replaced later.
- [x] Run identical adapter contract tests against web and fake validated host transports.

### Task 8 — Vite interface scaffold and selected shadcn blocks

**Files:** `apps/interface/**`, `components.json`, `package.json`, `pnpm-lock.yaml`, `src/ui/OmniApp.tsx`, current `src/app/home/HomeApp.tsx` (moved in Task 11A), `src/components/Terminal.tsx`, `src/components/cli-brand-icons.tsx`, `src/components/AttachmentImagePreviewDialog.tsx`, `src/components/home/{HomeHeader,ConversationMain,UserInputMessage,ConversationComposer}.tsx`, interface build/import tests.

- [x] Add failing build tests requiring browser and packaged Vite outputs, correct aliases, no Node/server modules, and a mountable `app-shell.html`.
- [x] Add Vite, React plugin, split build scripts, and interface HTML/entry files. Keep the existing interface rendering through `src/ui/render-web.tsx`.
- [x] Import the current `src/app/globals.css` and `src/app/fx.css` from the Vite entry before any Next deletion so packaged-interface/PWA/visual gates exercise the real styles; Task 11A later moves those files without a behavior change.
- [x] Replace the four `next/dynamic` usages with `React.lazy` + `Suspense`, the five `next/image` usages with appropriate native `<img>` rendering, and `next/font/google` Geist/Geist Mono with self-hosted `@fontsource` packages in the interface HTML/styles.
- [x] Run `pnpm dlx shadcn@latest add sidebar-07` and `pnpm dlx shadcn@latest add login-03`; record the generated files and run build/typecheck before adapting either block.
- [x] Keep the generated primitives, tokens, and dependency additions; remove only demo-page wiring that conflicts with the real app.
- [x] Add a Vite backstop test that fails if an interface chunk contains `src/server`, `src/runtime/http`, `node:*`, or a server-only package.
- [x] Verify both Vite targets, interface typecheck, and the existing component test suite.

### Task 9 — Static interface serving, bootstrap, and security headers

**Files:** `src/runtime/http/static-files.ts`, `bootstrap-html.ts`, `security-headers.ts`, `vite-csp-manifest.ts`, `src/runtime/http/server.ts`, static/CSP tests.

- [x] Add failing tests for SPA fallback, API/asset 404s, cache headers, traversal/symlink rejection, escaped bootstrap data, malformed/missing CSP manifest, and exactly one `runner.static_ui_enabled` or `runner.static_ui_missing` boot event.
- [x] Preserve deep links: add failing tests for `/session/<uuid>` and `/session/<12-hex>` resolving to the same selected run as `/?run=`, then parse the path into bootstrap and make the interface entry use `location.pathname` when `?run=` is absent. Keep `?project=` and legacy `?pair=` bootstrap behavior intact.
- [x] Add failing CSP tests for no third-party scripts, web versus packaged `connect-src`, `frame-ancestors`, `base-uri`, referrer policy, and an approved theme-script hash.
- [x] Serve the built interface without buffering and validate `csp-manifest.json` at startup.
- [x] Ship Trusted Types in `Content-Security-Policy-Report-Only`; exercise xterm, Markdown, highlighting, and dialogs. Enforce it only if those paths pass with the application policy, otherwise document the narrow exception and keep the report-only test as a release gate.
- [x] Add `--static-dir`, `--no-static`, and clear fail-fast configuration behavior to runner CLI/config.
- [x] Verify static-server, CSP, runner-startup, and packaged-interface tests.

### Task 10 — PWA application shell and offline behavior

**Files:** `apps/interface/app-shell.html`, `apps/interface/public/manifest.webmanifest`, `apps/interface/public/sw.js`, PWA tests; old `public/` copies at cutover.

- [x] Add failing tests that the manifest starts at the mountable app shell, same-origin app assets are cached, runner API/SSE requests are always network pass-through, and no bearer/session response enters Cache Storage.
- [x] Implement install/update/activate logic with versioned static caches and deterministic cleanup.
- [x] Render the normal shared interface offline with runner profiles and honest stale/offline states instead of a separate dead-end page.
- [x] Verify offline launch, online recovery, update activation, and multi-origin pass-through in Playwright.

### Task 11 — Vite cutover and removal of Next

**Files:** `package.json`, configs, scripts, `src/app/api/**`, `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/home/bootstrap.server.ts`, `src/instrumentation.ts`, old PWA files, `AGENTS.md`, `playwright.live.config.ts`, `src/server/restart-control.ts`, `tests/ui/ssr-bootstrap.test.ts`, `tests/e2e/live/{auth,auth.test,safety.test,playwright-live-config.test}.ts`, `tests/runtime-api/web-runtime-api.test.ts`, `tests/server/restart-control.test.ts`, `tests/electron/runtime-shell.test.ts`, `tests/vscode/bridge.test.ts`, `apps/vscode/package.json`, `scripts/{dev,dev-compression-proxy,remote-restart,measure-local-dev,free-port,cleanup-live-agent-journey}.*`, app READMEs.

- [x] Add a failing cutover test that rejects `next`, `.next`, Next route ownership, and Next-only environment assumptions.
- [x] Make `dev`, `build`, `start`, local-size measurement, and port cleanup use the runner plus Vite.
- [x] Audit port references with a port-context matcher such as `(?:localhost|127\.0\.0\.1|PORT|port|:)\\D{0,20}3035`, not a bare-number grep (an SVG path also contains `3035`). Exclude `docs/codex-history/**`, `docs/superpowers/**`, and the retrospective `docs/architecture/{conversation-ui-regression-lessons,hot-path-responsiveness-and-resource-leaks,frontend-state-and-rendering}.md`; update or retire every live operator source/script/config/test/doc reference, including `AGENTS.md`, `src/server/restart-control.ts`, Playwright/live helpers, dev/restart/measurement/cleanup scripts, app READMEs, `common-runtime-multi-surface.md`, and the listed tests. Add a test asserting no live reference remains under that exact rule.
- [x] Retiring the old dev compression proxy must retain the compressing-proxy SSE harness proven in Task 4.
- [x] Re-run the whole-process measurement and enforce the calibrated `<2 GB` development and `<1 GB` production-runner thresholds; a miss blocks cutover.
- [x] Run `tests/runtime/next-standalone-route-parity.test.ts`, packaged-interface e2e, PWA, lint, all typechecks, unit tests, lifecycle tests, and production build.
- [x] Only after those gates pass, print the exact approved deletion list and remove only the explicitly enumerated Next files/dependencies and old Vite-replaced PWA copies. The user's instruction to fully implement this plan authorizes that exact list; any added deletion requires fresh confirmation.
- [x] Retarget `tests/ui/ssr-bootstrap.test.ts` from the removed `bootstrap.server.ts` file to the portable runner bootstrap route.
- [x] Re-run the full cutover matrix and confirm local development has one runner process tree and no hidden second server.

### Task 11A — Move the interface out of `src/app`

**Files:** `src/app/home/**` → `src/interface/home/**`; `src/app/providers.tsx` → `src/interface/providers.tsx`; app styles/assets → `src/interface/styles/**` or `apps/interface/**`; affected imports/tests.

- [x] Add a failing architecture test that no shared interface entry imports from or lives under the Next-owned `src/app` tree.
- [x] Move `home/**` and `providers.tsx` with import-path-only changes; move `globals.css`, `fx.css`, `fx/`, `fx-spike/`, and `favicon.ico` under Vite-owned interface paths and import them from `apps/interface/src/main.tsx`.
- [x] Repoint `tests/app/**` imports without changing test behavior or creating a second test suite.
- [x] Verify interface typecheck, unit tests, visual CSS smoke tests, and the Vite build before any behavior work resumes.

### Task 11B — Keep Electron working through the Vite cutover

**Files:** `apps/electron/main.ts`, `apps/electron/scripts/build.mjs`, Electron bootstrap/migration helper, Electron tests.

- [x] Add failing tests that the transitional Electron shell loads `dist/interface`, keeps its current local `startOmniServer` transport, and does not build a second renderer artifact or inline HTML.
- [x] Before changing renderer origin, export legacy localStorage preferences and drafts from the current renderer origin into an atomic versioned payload under Electron `userData`; test success, retry, corrupt payload, and idempotence.
- [x] Point the shell at the Vite production artifact and remove the old esbuild renderer pipeline while leaving remote-only conversion for Task 22.
- [x] Verify Electron build and current desktop journeys at the M2 boundary.

### Task 12 — Migrate direct network consumers and split oversized owners

**Files:** every call site in `docs/architecture/runtime-api-migration-inventory.md`; `src/interface/home/mutations/*.ts`; `src/components/terminal/*`; `HomeApp.tsx`; query/Manager files.

- [x] Add failing architecture tests that reject direct `fetch`, `EventSource`, absolute API construction, or transport-specific IPC outside runtime adapters.
- [x] Split `useHomeMutations.ts`, `HomeApp.tsx`, and `Terminal.tsx` into focused Manager/domain/render modules before adding runner behavior; preserve the user's current `Terminal.tsx` changes.
- [x] Move each mutation/query/stream consumer to `RuntimeAPIs`; preserve abort, optimistic update, and server-authority behavior with focused tests.
- [x] Replace terminal stream ownership only after the bounded replay contract from Task 6 is proven.
- [x] Keep all shared domain state in Manager classes and verify narrow subscriptions for high-churn terminal/draft/cursor state.
- [x] Verify migrated consumer tests, interface boundary tests, typechecks, and current end-to-end journeys.

### Task 13 — Runner identity, compatibility, capabilities, and auth persistence

**Files:** `src/shared/bootstrap.ts`, `api-revision.ts`, `src/server/db/schema.ts`, migrations, bootstrap route, session/auth tests.

- [x] Add failing migration tests for durable `runnerInstanceId`, session kind/origin/device metadata, idle/absolute expiry, last-used throttling, and existing database upgrades.
- [x] Add failing contract tests for `current`/`minimum` revisions, declared additive-capability versus transport-breaking changes, unknown additive capabilities, and undeclared fixture diffs.
- [x] Persist runner identity once per data root and return identity, revision window, capability ids, display name, bridge/readiness state, and stream epoch from bootstrap.
- [x] Implement API-change classification in `src/shared/api-revision.ts` and make route fixture diffs fail unless declared.
- [x] Verify clean and upgraded databases, bootstrap schema, revision compatibility, and identity stability across restart.

### Task 14 — Password login, native-session rules, CORS, proxy trust, and TLS policy

**Files:** `src/server/auth/{config,password,session,guards,rate-limit,audit,cors,trusted-proxy}.ts`, login/health routes, runner config, auth/security tests.

- [x] Add failing tests for cookie login, originless native bearer login, rejection when native login carries `Origin`, `Referer`, or fetch-metadata headers, later native-session origin rejection, password never being returned or stored, cookie tokens never being accepted as bearer tokens, and bearer tokens never being accepted as cookies.
- [x] Add failing CORS tests for exact stored browser origin, `Vary: Origin`, error responses, registry-driven preflight, cookie-route exclusion, and `Access-Control-Allow-Credentials` never appearing.
- [x] Add failing tests for socket-derived client/protocol identity, explicitly configured trusted proxies, plaintext non-loopback refusal, and loopback development allowance.
- [x] Implement one rate-limit/audit path shared by password and browser authorization entry points.
- [x] Define native TLS behavior: standard platform trust first; a per-profile SPKI pin may be used only after trust failure, requires explicit fingerprint confirmation, and requires explicit re-pin on change.
- [x] Verify auth, CORS, proxy-spoofing, TLS-policy, and lifecycle tests.

### Task 15 — Browser approval with S256 PKCE

**Files:** `src/server/auth/browser-authorization.ts`, authorization routes, `src/interface/auth/InterfaceAuthorizationScreen.tsx`, web adapter, locales, auth/e2e tests.

- [x] Add failing tests for S256-only verifier/challenge length and alphabet, exact HTTPS or loopback-HTTP requesting origin, user gesture, state binding, 60-second expiry, atomic single use, origin binding, and no code/token logging.
- [x] Add failing browser tests for popup success, blocked popup, user denial, timeout, wrong origin/state, replay, opener loss with platform return link, and reauthorization.
- [x] Implement the target runner's same-origin approval page using the existing password session and localized copy in every locale.
- [x] Exchange the code only for the bound origin and persist the resulting browser bearer session, never the password or PKCE verifier.
- [x] Verify password-login routes still have no cross-origin support and the complete two-origin PKCE journey passes.

### Task 16 — Stream tickets and cross-origin streams

**Files:** `src/server/auth/stream-tickets.ts`, ticket route, events/terminal routes, web stream adapter, stream/auth tests.

- [x] Add failing tests for 60-second expiry, atomic single use, exact session/path/origin binding, fresh ticket per reconnect, ticket redaction, and session revalidation at redemption.
- [x] Add a real cross-origin `EventSource` test requiring `Access-Control-Allow-Origin: <boundOrigin>` and `Vary: Origin` on the successful ticketed 200 response.
- [x] Implement ticket issuance/redemption for main and terminal streams; keep cursor separate and non-secret.
- [x] Make the web adapter close native `EventSource` retry, request a fresh ticket, and reconnect under `RunnerConnection` control.
- [x] Verify cross-origin main/terminal streaming, restart/resync, session revocation, and no credential leakage in logs.

### Task 17 — Session administration, password rotation, runner naming, and CLI

**Files:** sessions/settings routes, auth modules, `src/server/cli/*`, `scripts/auth-password.mjs`, CLI/session tests.

- [x] Add failing tests for 30-day idle/90-day absolute browser sessions, 90-day idle/365-day absolute native sessions, at-most-once-per-minute touch, maximum 50 active sessions, and successful-login LRU eviction excluding the new session.
- [x] Add failing list/current/revoke/revoke-all tests, including immediate stream/mutation invalidation and stable audit/named events.
- [x] Implement `--runner <url>` with `OMNI_TOKEN`, `--token-file`, or token stdin; never put a token in `process.argv`. If the legacy `--token` argv form is retained for compatibility, emit an explicit warning and test its redaction.
- [x] Add `omni auth init` as the provisioning alias and `--password-file` for unattended setup; refuse password files whose mode is not `0600`.
- [x] Make password rotation revoke all sessions by default, with an explicit audited `--keep-sessions` override.
- [x] Add authenticated runner rename with validation, audit/event emission, and bootstrap propagation.
- [x] Add `omni runner rekey`. A valid same-origin session automatically re-pins the new runner identity; remote profiles require explicit login and identity confirmation.
- [x] Verify API, CLI, lifecycle, and concurrent-session tests.

### Task 18 — Profile and credential stores

**Files:** `src/interface/runners/{RunnerProfile,RunnerProfileStore,RunnerCredentialStore}.ts`, web implementations, migration/store tests.

- [x] Add failing tests for versioned profile migrations, pre-login profile UUID scope, post-login `runnerInstanceId` rekey, duplicate identity merge, URL edits, forget behavior, and per-runner preferences/drafts/cursors.
- [x] Implement profile metadata persistence separately from credentials; expose credential handles, never raw secrets, to interface Managers.
- [x] Implement web profile storage and browser bearer storage with exact-origin/identity checks and explicit clearing on forget/revocation, including a non-deletable same-origin profile that survives migration and corrupt-store reset-to-default with a visible localized notice.
- [x] Test rekey handling: a valid same-origin session automatically accepts the new identity while remote profiles remain blocked until explicit login/confirmation.
- [x] Add collision and identity-mismatch recovery states without silently replacing trusted identity.
- [x] Verify restart, migration, failed-write, partial-profile, and store-isolation tests.

### Task 19 — Concurrent RunnerConnection and RunnerRegistry Managers

**Files:** `src/interface/runners/{RunnerConnection,RunnerRegistry,RunnerRegistryProvider}.ts(x)`, existing stream/cache/notification Managers, runner-state tests.

- [x] Add failing state-machine tests for connecting, online, offline, deferred, needs-reauth, TLS-untrusted, identity-mismatch, incompatible, degraded/resync, and runner-stopping.
- [x] Add race tests for stale responses after runner switch, delete/re-add, auth replacement, delayed bootstrap, reconnect timers, and mutation completion.
- [x] Add failing tests that cursors persist per durable `runnerInstanceId`, clear on resync or trusted-identity change, and more than three resyncs within five minutes enter degraded jittered backoff.
- [x] Implement one live main stream per authenticated profile, runner-scoped Query clients/keys, jittered exponential retry capped at five minutes, and the resync anti-storm governor.
- [x] Keep only the active runner's terminal streams; detach on switch and request bounded scrollback on reactivation.
- [x] Resolve `/session/:runId` against the active runner only. If the active snapshot does not contain the run, show an explicit not-found state without probing other connections; test deep-link arrival while another runner is active.
- [x] Bound per-runner preview caches and global LRU memory while keeping persisted drafts/cursors authoritative to their store.
- [x] Verify switching does not close inactive main streams or cancel their mutations and all manager subscriptions remain narrow.

### Task 20 — Runner switcher, connect flow, sessions UI, notifications, and i18n

**Files:** runner UI components, shared shell/home components, notification Manager, all nine `shared/locales/*.json`, UI/accessibility tests.

- [x] Add failing UI tests for first-run onboarding, add/edit/forget, active switching, status labels, reauth, TLS confirm/re-pin, identity mismatch, incompatibility, deferred runner, session revoke, and runner rename.
- [x] Adapt the installed `sidebar-07` block into the persistent runner switcher and `login-03` into connect/authorize screens while retaining existing OmniHarness visual language.
- [x] Keep runner-switcher controls hidden in the transitional Electron shell until Task 22 enables the remote-only host.
- [x] Render one workspace at a time; make inactive runner activity visible through bounded counts and runner-named notifications.
- [x] Add every new string to all nine locale files and use `useI18nSnapshot()` + `t()` at render boundaries.
- [x] Verify keyboard navigation, focus restoration, screen-reader labels, reduced motion, narrow desktop/mobile widths, and live language switching.

### Task 21 — Web/PWA two-runner and scale acceptance

**Files:** `tests/e2e/multi-runner*.spec.ts`, fixtures/runner harness, memory scripts, Playwright config.

- [x] Start two isolated real runners on port 0 with distinct roots/passwords/identities and the packaged Vite artifact; do not reuse production/user data.
- [x] Test add/login/PKCE, both live streams, active switching, inactive mutation completion, terminal detach/replay, offline/restart/epoch resync, revoke/reauth, identity mismatch, and PWA recovery.
- [x] Run an eight-runner benchmark with all main streams live and bounded activity; require less than 40 MB incremental client memory per added idle runner and less than 750 MB aggregate under the specified workload.
- [x] Run one runner at the declared `minimum` API revision and one at `current`; keep both connected, hide only unsupported additive capabilities with an explanation, and block only transport-breaking incompatibility.
- [x] Assert retry jitter, deferred/background status when the platform limits sockets, and no uncaught browser errors or secret-bearing logs.
- [x] Clean all test sessions, databases, processes, and generated run artifacts.

### Task 22 — Remote-only Electron host and migration

**Files:** `apps/electron/{main,preload,scripts/build,package}.ts/json/mjs`, new Electron store/bridge/TLS/migration modules, Electron tests/docs.

- [x] Add failing tests proving Electron never imports or starts the runner, renderer network access to runners is blocked, and IPC contracts validate every request/response/frame.
- [x] Implement remote HTTP/SSE in the main process, `safeStorage` credential persistence, per-profile SPKI confirmation/re-pin, bounded stream delivery, and renderer-safe error objects.
- [x] Import the versioned legacy preferences/drafts payload exported in Task 11B, then add an explicit path to profile the former embedded runtime as a local or remote runner; never silently abandon existing data.
- [x] Test app restart, multiple runners, offline/reconnect, revoke, deep links, notifications, migration success/failure/rollback, and packaged CSP.
- [x] Build and smoke-test the signed-development/unsigned-local package supported by the host environment.

### Task 23 — VSCode remote runner client

**Files:** `apps/vscode/src/extension.ts`, `webview/main.tsx`, `src/vscode-extension/bridge.ts`, VSCode manifest/docs/tests.

- [x] Add failing bridge tests for all-profile connection ownership, bearer-only host networking, validated messages, stream reconnect/cursor behavior, and renderer token isolation.
- [x] Store sessions only in `ExtensionContext.secrets`; migrate and clear the current plain setting without logging its value.
- [x] Implement the same profile/status/switching/session flows through the shared interface and VSCode host adapter.
- [x] Verify multi-runner restart/reload, revoke/reauth, identity mismatch, notifications, and extension build/package.

### Task 24 — Capacitor iOS and Android hosts

**Files:** `apps/mobile/**`, `src/runtime-api/capacitor.ts`, root workspace/scripts, mobile/native contract tests.

- [x] Add Capacitor packages/config and generate committed iOS/Android source projects; add only `packages: ["apps/mobile"]` to `pnpm-workspace.yaml` (never an `apps/*` glob), keep generated build/signing/cache output ignored, and prove Electron/VSCode builds are unchanged by workspace membership.
- [x] Point `capacitor.config.ts` `webDir` at the single `../../dist/interface` artifact. Add iOS `NSLocalNetworkUsageDescription` with strict ATS outside loopback development, and Android `usesCleartextTraffic=false` with a debug-only loopback network-security configuration; assert release builds never bypass certificate checks.
- [x] Add failing JavaScript/native contract tests for request, abort, SSE frames, bounded queues, credential handles, TLS trust failure, explicit pin/re-pin, deep links, lifecycle suspension/resume, and notifications.
- [x] Implement iOS networking/SSE with `URLSession`, secrets with Keychain Services, per-profile trust/pinning, links, and local notifications in a custom Capacitor plugin.
- [x] Implement Android networking/SSE with OkHttp, encrypted token material backed by Android Keystore, per-profile trust/pinning, links, and local notifications in the matching plugin.
- [x] Keep bearer tokens inside native code and block direct WebView runner networking with packaged CSP.
- [x] Implement all-profile connections while active; when the OS suspends the app, persist cursors and reconnect/resync honestly on resume—no v1 push guarantee.
- [x] Run native unit/contract tests, `cap sync`, Android debug build/tests, and iOS simulator no-sign build/tests on the available host.

### Task 25 — Security, deployment, migration, and operator documentation

**Files:** `README.md`, `.env.example`, app READMEs, architecture/lifecycle docs, new deployment/TLS/session/migration docs.

- [x] Document the logical runner/process model, bridge-degraded behavior, static/no-static modes, ports/locks/data roots, TLS requirements, trusted proxy configuration, and backup/restore.
- [x] Document password login, browser approval, session TTL/list/revoke, password rotation, URL changes, identity mismatch, SPKI confirmation/re-pin, and credential-storage boundaries.
- [x] Document Electron migration, VSCode secret migration, mobile build/signing prerequisites, PWA offline limits, platform socket/suspension limits, and v1 non-goals.
- [x] Add copy-paste smoke commands that use temporary roots and never expose passwords in process listings or logs.
- [x] Validate every documented command in a disposable test environment.

### Task 26 — Full verification, security review, and clean handoff

**Files:** all changed files and generated contract/build reports; no new product behavior.

- [x] Run targeted suites after each task, then final `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:lifecycle`, `pnpm build`, and `pnpm test:e2e`.
- [x] Run runner route/static/security tests, two-runner and eight-runner suites, Electron build/tests, VSCode build/tests, Capacitor contract/sync, Android build/tests, and iOS simulator build/tests.
- [x] Inspect logs/event ring for silent decisions, missing `error.surfaced`, missing SSE ids, leaked passwords/tokens/tickets/codes, CORS credentials, and unbounded subscriber/cache growth.
- [x] Compare the final route fixture and API revision declaration; require every contract change to be additive-capability or transport-breaking-revision classified.
- [x] Confirm Next/server code is absent from interface artifacts, native renderers cannot directly reach runners, and all credentials survive/revoke only through platform-secure stores.
- [x] Clean only test-created sessions, roots, databases, processes, and build artifacts covered by test cleanup; preserve all user-owned files and pre-existing changes.
- [x] Record exact command results, platform limitations if a required native toolchain is unavailable, and any explicitly documented Trusted Types exception before claiming completion.
