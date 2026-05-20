# Common Runtime Multi-Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure OmniHarness so the agent/control-plane runtime and primary UI can be reused by the web app, a native desktop shell, a VS Code extension, and later interfaces without forking product behavior.

**Architecture:** Follow the useful part of OpenChamber's model: one shared server runtime, one shared React renderer, and thin surface adapters. Omni's Next app remains the compatibility web surface while runtime logic moves behind portable service and HTTP boundaries; Electron starts the same runtime in-process and loads the shared renderer from loopback; VS Code reuses the renderer with a `postMessage` runtime adapter mediated by the extension host.

**Tech Stack:** TypeScript, pnpm, Next.js 15, React 19, existing Manager classes, SQLite/Drizzle, SSE with named events, Node HTTP, Vite for embeddable renderer builds, Electron for the first native desktop shell, VS Code Extension API for editor integration, Vitest, lifecycle HTTP/SSE tests, Playwright where UI verification is required.

**North Star Product:** OmniHarness becomes a portable agent supervision runtime: run it once locally or remotely, then operate the same conversations, workers, plans, files, events, notifications, and recovery controls from browser, desktop, editor, phone/PWA, CLI, or future hosted surfaces.

**Current Milestone:** Deliver the common runtime and renderer boundary, keep the existing web app working, add an Electron desktop shell that starts the runtime in-process, and add a VS Code extension proof surface that can authenticate, list/start conversations, stream events, and open files through the shared contracts.

**Future Product Direction:** Additional shells can reuse the same runtime and renderer contracts: SwiftUI/WKWebView native app, mobile wrappers, hosted remote access, MCP/admin dashboards, and editor integrations beyond VS Code. These are context only; the checklist below delivers the current milestone completely.

**Final Functionality Standard:** The milestone is complete only when web, CLI, Electron, and VS Code all exercise real OmniHarness runtime behavior through shared contracts, with no mocked conversations, fake shell success states, duplicated persistence layers, or UI-only policy enforcement.

---

## Source Model From OpenChamber

OpenChamber's current shape is:

- `packages/ui`: shared React renderer.
- `packages/web`: web server, CLI package, API routes, static UI build, and exported `startWebUiServer(...)`.
- `packages/electron`: thin native shell that imports the web server, starts it in the Electron main process, stages the web build, and loads loopback.
- `packages/vscode`: VS Code extension host plus webview. It reuses the shared UI but provides a `RuntimeAPIs` implementation over `postMessage`.

The lesson for Omni is not "copy the folders exactly." The lesson is: product behavior lives in a runtime, UI behavior lives in a renderer, and every shell supplies only transport/native capabilities.

### Research Appendix

OpenChamber references inspected for this plan:

- `packages/web/server/index.js`: exports `startWebUiServer` and returns a handle with `getPort()`, `stop()`, readiness, restart, tunnel, and quit-risk helpers.
- `packages/electron/main.mjs`: sets desktop runtime env, imports `@openchamber/web/server/index.js`, calls `startWebUiServer(...)`, stores the handle, and loads the local URL in Electron.
- `packages/electron/preload.mjs`: exposes shell identity and a gated native command bridge. It keeps native capability in the shell, not in the server runtime.
- `packages/ui/src/lib/api/types.ts`: defines `RuntimeAPIs`, the typed frontend capability contract that lets the shared UI run under web or VS Code adapters.
- `packages/web/src/main.tsx`: creates web `RuntimeAPIs`, installs them on `window`, and imports the shared UI entry.
- `packages/vscode/webview/main.tsx`: creates VS Code `RuntimeAPIs`, listens for extension-host messages, and imports the shared VS Code renderer.
- `packages/vscode/webview/api/bridge.ts`: implements request/response and SSE proxy messages over `postMessage`.
- `packages/vscode/src/bridge.ts` and `ChatViewProvider.ts`: route webview bridge requests to extension-host filesystem, git, proxy, settings, and SSE handlers.
- `packages/electron/scripts/build-web-assets.mjs`: builds the web UI and stages it as Electron resources.

Things Omni should copy:

- runtime starts once and exposes an explicit lifecycle handle,
- native shell stays thin,
- shared UI receives a typed runtime capability object,
- VS Code is a mediated adapter rather than pretending it is the browser.

Things Omni should improve:

- keep shell-specific globals out of shared UI where possible,
- define the `RuntimeAPIs` contract before broad renderer migration,
- migrate API routes in a risk-ordered sequence rather than all at once,
- preserve Omni's stronger named-event and lifecycle testing discipline.

## Product Scope

### Primary User Stories

As a builder, I want the same Omni conversation to be available in browser, desktop, CLI, and VS Code, so I can move between surfaces without losing state or behavior.

As a builder, I want the desktop app to feel native while still running the same Omni runtime, so native menus, dialogs, notifications, and deep links do not become a second backend.

As a builder in VS Code, I want Omni beside my editor with editor-aware actions, so I can start or continue runs and open files/diffs without leaving the workspace.

As a maintainer, I want runtime decisions to be emitted through the same named event surface on every interface, so lifecycle bugs can be tested without guessing from DOM state.

### Return And Recovery Stories

As a returning user, I want each surface to reattach to the same persisted conversations, workers, queued messages, and validation state.

As a user after a disconnect or restart, I want each surface to resume from SSE event ids or explicitly request a resync, not silently invent state.

As an operator debugging a shell issue, I want to know whether the failing layer is runtime, HTTP adapter, renderer adapter, native bridge, VS Code bridge, or agent runtime bridge.

### Scope Boundaries

This plan does include Electron as the first native shell because it can import the Node runtime in-process, matching the OpenChamber pattern most closely.

This plan does include a VS Code proof surface with real conversation and event behavior. It does not require a fully polished Marketplace extension in the first pass.

This plan does not create branches or worktrees. Current repo instructions forbid both unless explicitly requested.

This plan does not delete files. Any file removal discovered during migration is a separate user decision.

## Open Decisions

These decisions should be confirmed before executing the Electron and VS Code phases. Runtime extraction and web parity can proceed without them.

- **Electron as first native shell:** This plan recommends Electron because it can start the Node runtime in-process like OpenChamber. A SwiftUI/WKWebView app remains possible but would likely supervise a child Node process instead.
- **VS Code runtime location:** Decide whether the VS Code proof surface starts a local Omni runtime, connects to an already-running local runtime, or supports both from the start. Recommended current milestone: support both, defaulting to reuse/connect when a healthy local runtime exists.
- **VS Code auth model:** Decide whether VS Code webviews use the same Omni session auth flow, a local extension-issued session token, or a trusted-loopback shortcut. Recommended current milestone: use the same runtime auth concepts and make any extension-issued token explicit, short-lived, and observable.
- **Workspace trust and filesystem roots:** Decide whether VS Code filesystem/git operations are limited to the active workspace folder or can target Omni's selected project path. Recommended current milestone: require workspace trust and limit editor-originated file actions to workspace roots unless Omni project scope already grants access.
- **Renderer breadth in VS Code:** Decide whether the first VS Code surface loads the full Omni renderer or a narrowed route/panel. Recommended current milestone: load the shared renderer with shell flags that hide unsupported surfaces rather than forking a separate mini UI.

### Decisions Recorded For The Implemented Slice

- **Electron as first native shell:** confirmed for this milestone. It starts the Node runtime in-process and serves staged renderer assets from the runtime origin.
- **VS Code runtime location:** confirmed for the proof surface. The extension connects to a configured Omni runtime, defaulting to `http://localhost:3035`; starting an embedded runtime from the extension remains future work.
- **VS Code auth model:** confirmed for the proof surface. The extension can forward an explicit configured `omni_session` cookie value for password-protected runtimes.
- **Workspace trust and filesystem roots:** confirmed for the proof surface. Editor-originated file actions use VS Code document APIs; conversation creation defaults to the first workspace folder.
- **Renderer breadth in VS Code:** confirmed for the proof surface. It uses the shared VS Code `RuntimeAPIs` adapter and a focused webview panel rather than the full browser Home surface.

## Architecture

### Runtime Kernel

Create an explicit Omni runtime kernel that owns:

- database access and migrations,
- settings reads/writes,
- auth/session validation,
- conversation creation and message sending,
- supervisor lifecycle,
- worker stream persistence,
- named event emission and SSE replay,
- notifications,
- git/filesystem service boundaries,
- cleanup and graceful shutdown.

The runtime must be constructible once per process and injectable into HTTP, CLI, Electron, and test harnesses. Shells must not import random server modules directly after the boundary exists.

### Portable HTTP Surface

Move business logic out of Next route files into standard request handlers. The preferred shape is Fetch-compatible:

```ts
type OmniHttpHandler = (request: Request, context: OmniRequestContext) => Promise<Response>;
```

Next route files become adapters. The standalone runtime server and Electron server use the same route registry. This avoids maintaining two API implementations.

### Shared Renderer

Extract the main client app into a renderer entry that does not import Next server modules or assume `window.location` is the only runtime authority. The renderer receives:

- bootstrap payload,
- `RuntimeAPIs`,
- runtime descriptor,
- shell capabilities,
- optional native/editor bridge capabilities.

The existing Manager classes remain the state model. Subscriptions must stay narrow, especially for composer draft state, terminal output, worker streams, search text, hover/open state, and resizers.

### RuntimeAPIs Contract

Define a typed frontend contract for capabilities such as:

- auth/session/bootstrap,
- conversations/messages/queued messages,
- events/SSE replay,
- worker entries and terminal streams,
- plans and validation records,
- settings,
- files,
- git/workspace status,
- notifications,
- native shell actions,
- editor actions.

Implementations:

- Web/Next adapter: `fetch` and `EventSource`/SSE against the local HTTP API.
- Electron adapter: mostly the web adapter, plus preload-exposed native capabilities.
- VS Code adapter: `postMessage` bridge to extension host, including SSE proxying and editor/file operations.
- Test adapter: real HTTP against lifecycle harness, not canned data.

### Initial RuntimeAPIs Slice

The first implemented `RuntimeAPIs` slice must be small and real. Do not define the entire future surface before proving the contract.

```ts
export interface RuntimeAPIs {
  runtime: {
    surface: "web" | "electron" | "vscode";
    label: string;
    supportsNativeNotifications: boolean;
    supportsEditorActions: boolean;
  };
  bootstrap: {
    load(input: { selectedRunId?: string | null; draftProjectPath?: string | null; pairToken?: string | null }): Promise<HomeBootstrapPayload>;
  };
  events: {
    open(input: { snapshot: boolean; runId?: string | null; lastEventId?: string | null }, handlers: EventStreamHandlers): RuntimeSubscription;
    fetchLog(input: { since?: string; runId?: string | null }): Promise<NamedEventLogResponse>;
  };
  conversations: {
    create(input: CreateConversationRequest): Promise<CreateConversationResponse>;
    sendMessage(input: SendConversationMessageRequest): Promise<SendConversationMessageResponse>;
  };
  workers: {
    listEntries(input: { runId: string; workerId: string; afterSeq?: number }): Promise<WorkerEntriesResponse>;
  };
  settings: {
    load(): Promise<SettingsResponse>;
    save(input: SettingsSaveRequest): Promise<SettingsResponse>;
  };
  native?: {
    openExternal(input: { url: string }): Promise<{ ok: true }>;
    chooseFolder?(): Promise<{ path: string | null }>;
    notify?(input: { title: string; body?: string }): Promise<{ ok: boolean }>;
  };
  editor?: {
    openFile(input: { path: string; line?: number; column?: number }): Promise<{ ok: true }>;
    openDiff(input: { originalPath: string; modifiedPath: string; title?: string }): Promise<{ ok: true }>;
  };
}
```

Contract requirements:

- Errors use one typed shape: `{ code, message, details?, surface?, runId?, workerId?, conversationId? }`.
- SSE adapters must support cancellation and must report terminal errors through both the callback and named events where server-side.
- Auth/session failures must be explicit `401`/`403` equivalents in every adapter, including VS Code bridge responses.
- Managers consume `RuntimeAPIs` through a provider or injected module, never by importing shell-specific code.
- Data returned by adapters is raw domain data; translated UI copy is produced at render boundaries with `t()`.

### Surface Adapters

Web remains the first-class compatibility surface. Next keeps server bootstrap for the initial screen while route logic migrates behind portable handlers.

Electron is a thin shell:

- start the runtime HTTP server in the Electron main process,
- stage the renderer build as static assets,
- load `http://127.0.0.1:<port>`,
- expose native-only affordances in preload,
- gate native commands by origin and command allowlist,
- shut down runtime and agent bridge cleanly.

VS Code is a mediated shell:

- extension host starts or connects to the Omni runtime,
- webview loads the renderer bundle,
- webview `RuntimeAPIs` sends requests through `postMessage`,
- extension host proxies HTTP/SSE, exposes editor actions, and reports connection health.

CLI continues to call runtime services directly and can also gain a scriptable runtime-status command for multi-surface diagnostics.

## State And Persistence Model

Existing SQLite and JSON/file-backed settings remain authoritative. The migration must not introduce a second persistence layer for conversations, worker streams, messages, queued messages, or validation records.

Shell-specific state is separate:

- Electron: window geometry, selected host, native notification preference, update state.
- VS Code: extension global settings, selected workspace folder, panel/session editor state.
- Web/PWA: existing local browser preferences only where already appropriate.

Stored records must use stable ids and raw values. Translated UI copy, shell-rendered labels, and frontend presentation state must not be persisted as product data.

## Instrumentation And Observability

Every server-side decision introduced or moved by this work must continue to emit named events through `emitNamedEvent` from `@/server/events/named-events`.

The migration must preserve:

- SSE frames with `id:`,
- `Last-Event-ID` resume,
- snapshot bootstrap through `/api/events?snapshot=1`,
- `stream.resync_required` when replay is impossible,
- `error.surfaced` for user-relevant failures,
- dev event log inspection through `/api/events/log?since=<id>&runId=<id>`.

Add shell-specific events where useful:

- `runtime.started`
- `runtime.start_failed`
- `runtime.stopped`
- `surface.connected`
- `surface.disconnected`
- `surface.bridge_failed`
- `native.command_refused`
- `vscode.bridge_request_failed`

## File Map

### Create

- `src/runtime/index.ts`: public factory for `createOmniRuntime(...)`.
- `src/runtime/types.ts`: runtime kernel types, dependencies, lifecycle handles, and shell descriptors.
- `src/runtime/http/registry.ts`: portable route registry shared by Next and standalone servers.
- `src/runtime/http/context.ts`: request auth, origin, runtime, and shell context helpers.
- `src/runtime/http/server.ts`: Node HTTP server that serves API routes, SSE, and static renderer assets.
- `src/runtime/http/adapters/next.ts`: helpers for adapting Next route handlers to the portable registry.
- `src/runtime/bootstrap.ts`: portable bootstrap payload builder currently backed by `buildHomeBootstrap`.
- `src/runtime-api/types.ts`: frontend `RuntimeAPIs` contract.
- `src/runtime-api/web.ts`: browser implementation over HTTP/SSE.
- `src/runtime-api/electron.ts`: web implementation plus native bridge methods.
- `src/runtime-api/vscode.ts`: webview implementation over `postMessage`.
- `src/runtime-api/provider.tsx`: React provider and manager registration for runtime APIs.
- `src/ui/OmniApp.tsx`: renderer root that accepts bootstrap and runtime APIs.
- `src/ui/render-web.tsx`: browser/Vite renderer entry.
- `src/ui/render-vscode.tsx`: VS Code webview renderer entry.
- `apps/electron/package.json`: Electron shell package.
- `apps/electron/main.ts`: Electron main process, runtime startup, window lifecycle, native menus.
- `apps/electron/preload.ts`: native bridge with origin and command gating.
- `apps/electron/scripts/build.mjs`: builds main, preload, and staged renderer assets.
- `apps/electron/scripts/dev.mjs`: local dev launcher using existing runtime where possible.
- `apps/electron/resources/`: icons, entitlements, and static packaging resources.
- `apps/vscode/package.json`: VS Code extension package.
- `apps/vscode/src/extension.ts`: activation, provider registration, runtime start/connect, commands.
- `apps/vscode/src/bridge.ts`: extension-host bridge request router.
- `apps/vscode/src/sseProxy.ts`: SSE proxy with ids, cancellation, and error propagation.
- `apps/vscode/src/webviewHtml.ts`: CSP-safe webview HTML for renderer bundle.
- `apps/vscode/webview/main.tsx`: webview bootstrap that installs `RuntimeAPIs`.
- `tests/runtime/http-registry.test.ts`: route registry behavior.
- `tests/runtime/runtime-lifecycle.test.ts`: runtime start/stop/reuse behavior.
- `tests/runtime/bootstrap.test.ts`: portable bootstrap parity with existing Next bootstrap.
- `tests/runtime-api/web-runtime-api.test.ts`: web adapter request and error behavior.
- `tests/electron/runtime-shell.test.ts`: Electron main runtime startup contract, headless where feasible.
- `tests/vscode/bridge.test.ts`: VS Code bridge request routing and refusal behavior.
- `tests/lifecycle/scenarios/multi-surface-reconnect.ts`: HTTP/SSE scenario covering web plus shell reconnect semantics.
- `docs/architecture/common-runtime-multi-surface.md`: durable architecture doc and ownership map.

### Modify

- `package.json`: add workspace-aware scripts for runtime, renderer, Electron, VS Code, and tests.
- `pnpm-workspace.yaml`: include root, `apps/*`, and any future `packages/*` if package boundaries are introduced.
- `tsconfig.json`: add aliases for runtime, runtime API, and UI extraction if needed.
- `next.config.ts`: ensure aliases and static renderer constraints remain compatible.
- `src/app/page.tsx`: continue server bootstrap but render through `src/ui/OmniApp`.
- `src/app/home/HomeApp.tsx`: become renderer-owned or delegate to `OmniApp`; remove Next-only assumptions.
- `src/app/home/bootstrap.server.ts`: move portable logic into `src/runtime/bootstrap.ts`; keep compatibility wrapper.
- `src/app/api/**/route.ts`: convert route files to thin adapters over `src/runtime/http/registry.ts`.
- `src/server/cli/runner.ts`: construct/use the runtime kernel instead of starting services ad hoc.
- `src/server/supervisor/runtime-watchdog.ts`: expose lifecycle through runtime dependencies and named events.
- `src/server/events/live-updates.ts`: verify ring buffer and replay are surface-neutral.
- `src/server/events/named-events.ts`: add shell/runtime event names and `error.surfaced` codes.
- `src/components/**`: replace direct `fetch` assumptions with runtime API calls only where needed for portability.
- `src/lib/i18n.ts` and `shared/locales/*.json`: add any new shell-visible strings through existing i18n resources.
- `scripts/dev.ts`: delegate to runtime startup helpers once extracted; keep existing process reuse behavior.
- `scripts/start.ts`: use the shared runtime server path when production standalone mode is ready.
- `omni-cli.ts` / `omni`: preserve current CLI behavior while switching internals to runtime services.
- `.gitignore`: verify coverage for Electron dist, VS Code dist, renderer build output, logs, temp bundles, and local shell settings.

### Tests To Add Or Update

- Runtime unit tests for kernel construction, dependency reuse, graceful shutdown, and bridge-start failure.
- HTTP adapter tests proving Next and standalone server produce equivalent responses for core routes.
- Lifecycle scenario tests for SSE ids, replay, resync, shell reconnect, and runtime restart.
- Frontend manager tests proving bootstrap and event hydration still work with injected `RuntimeAPIs`.
- Electron shell tests for command gating, local-origin-only native privileges, startup failure surfacing, and shutdown cleanup.
- VS Code bridge tests for request/response, SSE chunk/end/error behavior, editor open-file commands, and refused unknown commands.
- Existing API, app, lifecycle, and UI tests touched by route extraction.

## Route Migration Order

Before converting a route, write or identify its parity tests, named events touched, auth requirements, and affected Managers. Convert in this order unless the inventory finds a safer sequence.

| Order | Route | Risk | Runtime owner / notes |
| --- | --- | --- | --- |
| 1 | `src/app/api/auth/session/route.ts` | Low | Auth/session read model; proves portable auth context. |
| 2 | `src/app/api/settings/route.ts` | Low | Settings runtime; needed by bootstrap and shells. |
| 3 | `src/app/api/accounts/route.ts` | Low | Account/model config read/write, no streaming. |
| 4 | `src/app/api/agents/route.ts` | Low | Agent catalog read path. |
| 5 | `src/app/api/agents/catalog/route.ts` | Low | Agent catalog read path. |
| 6 | `src/app/api/agents/[name]/route.ts` | Medium | Agent detail/possibly mutation; preserve validation and errors. |
| 7 | `src/app/api/llm-models/route.ts` | Low | Model metadata read path. |
| 8 | `src/app/api/codex-auth/status/route.ts` | Low | Auth status read path. |
| 9 | `src/app/api/notifications/route.ts` | Medium | Migrated; user-visible failure paths and permissions. |
| 10 | `src/app/api/auth/login/route.ts` | Medium | Migrated; session mutation and cookie/session behavior. |
| 11 | `src/app/api/auth/logout/route.ts` | Medium | Migrated; session mutation and cleanup. |
| 12 | `src/app/api/auth/pair/route.ts` | Medium | Migrated; pair token lifecycle and public origin. |
| 13 | `src/app/api/auth/pair/redeem/route.ts` | Medium | Migrated; pair token redemption and auth event surfacing. |
| 14 | `src/app/api/projects/memory/route.ts` | Medium | Migrated; project-scoped persistence and settings. |
| 15 | `src/app/api/plans/route.ts` | Medium | Migrated; plan records/readiness and planning UI expectations. |
| 16 | `src/app/api/planning/[id]/review/route.ts` | Medium | Migrated; plan-review state transition and named events. |
| 17 | `src/app/api/planning/[id]/promote/route.ts` | Medium | Migrated; plan promotion mutation and validation. |
| 18 | `src/app/api/attachments/route.ts` | Medium | Migrated; file/blob handling, project scope, and cleanup. |
| 19 | `src/app/api/fs/route.ts` | High | Migrated; filesystem scope enforcement. |
| 20 | `src/app/api/fs/files/route.ts` | High | Migrated; file read/write/download scope enforcement. |
| 21 | `src/app/api/git/route.ts` | High | Migrated; git mutations, dirty/conflict handling, no branch/worktree creation unless user action requests it. |
| 22 | `src/app/api/conversations/route.ts` | High | Migrated; conversation creation, supervisor startup, git workspace launch policy. |
| 23 | `src/app/api/conversations/[id]/messages/route.ts` | High | Migrated; message append/send flow and busy conversation behavior. |
| 24 | `src/app/api/messages/route.ts` | High | Migrated; message compatibility path. |
| 25 | `src/app/api/conversations/[id]/queued-messages/[messageId]/route.ts` | High | Migrated; queue mutation and lifecycle events. |
| 26 | `src/app/api/runs/[id]/route.ts` | High | Migrated; run deletion/status mutation and dependent cleanup. |
| 27 | `src/app/api/runs/[id]/answer/route.ts` | High | Migrated; user input continuation. |
| 28 | `src/app/api/runs/[id]/resume/route.ts` | High | Migrated; recovery transition and live update notification. |
| 29 | `src/app/api/workers/[workerId]/entries/route.ts` | High | Migrated; unified worker stream with no parallel persistence. |
| 30 | `src/app/api/supervisor/route.ts` | High | Migrated; supervisor lifecycle and runtime watchdog. |
| 31 | `src/app/api/events/log/route.ts` | High | Migrated; dev event log and diagnostics. |
| 32 | `src/app/api/events/route.ts` | Highest | Migrated; snapshot/SSE/replay/resync through the portable registry. |

### Candidate Agentic User Journey Tests

These require explicit user approval before running:

- Desktop smoke journey: launch Electron, confirm the existing conversation list appears, start a planning conversation, observe named events, quit, relaunch, and verify state reattaches.
- VS Code smoke journey: open a workspace in VS Code extension host, start a conversation from selected text, stream events, open a referenced file, and reconnect after webview reload.
- Cross-surface continuity journey: create a conversation in web, open the same run in Electron and VS Code, send a queued message from one surface, and verify every surface converges from the event stream.

## Implementation Tasks

### Phase 0: Inventory And Architecture Gate

- [x] Document the target architecture in `docs/architecture/common-runtime-multi-surface.md`.
  - Include the OpenChamber comparison, Omni-specific runtime ownership, shell responsibilities, security boundaries, and migration order.
  - Verification: documentation review plus link checks for all referenced local files.

- [x] Inventory current route, runtime, and UI dependencies.
  - Map every `src/app/api/**/route.ts` to the `src/server/**` functions it calls.
  - Map every frontend direct fetch/SSE call to the proposed `RuntimeAPIs` method.
  - Identify files already over or near 1200 lines and plan split points before adding behavior.
  - Verification: save the inventory in the architecture doc and confirm no runtime-owned data path is missing.

**Gate:** Do not start runtime code movement until the inventory names each route, direct fetch/SSE caller, and over-1200-line file risk.

### Phase 1: Runtime Kernel And Bootstrap Gate

- [x] Add the runtime kernel skeleton.
  - Create `src/runtime/index.ts` and `src/runtime/types.ts`.
  - Wrap existing singleton services without changing behavior.
  - Ensure runtime construction is idempotent per process and emits named start/stop/failure events.
  - Verification: `pnpm test -- tests/runtime/runtime-lifecycle.test.ts` after adding focused tests.

- [x] Move bootstrap logic behind the runtime boundary.
  - Create `src/runtime/bootstrap.ts`.
  - Keep `src/app/home/bootstrap.server.ts` as a compatibility wrapper.
  - Preserve auth/session, settings, selected run, initial event snapshot, and feature flags.
  - Verification: `pnpm test -- tests/runtime/bootstrap.test.ts` plus existing bootstrap-related app tests.

**Gate:** Existing Next page bootstrap and CLI conversation start still work before broader HTTP extraction.

### Phase 2: Portable HTTP And SSE Gate

- [x] Build the portable HTTP route registry.
  - Create `src/runtime/http/registry.ts`, `context.ts`, and `adapters/next.ts`.
  - Convert routes according to the Route Migration Order table.
  - Keep Next route files as thin adapters.
  - Verification: route parity tests and existing `tests/api/*`.

- [x] Preserve SSE and lifecycle semantics during route extraction.
  - Ensure `/api/events?snapshot=1`, `Last-Event-ID`, event ids, replay, and `stream.resync_required` work through the portable registry.
  - Add shell/runtime named events in `src/server/events/named-events.ts`.
  - Define payload shapes and `error.surfaced` codes before adding emit call sites.
  - Verification: `pnpm test:lifecycle` and targeted event route tests.

**Gate:** `/api/events?snapshot=1`, SSE resume, and dev event log work through the portable registry before Electron or VS Code begins.

### Phase 3: RuntimeAPIs And Renderer Gate

- [x] Add `RuntimeAPIs` frontend contracts.
  - Create `src/runtime-api/types.ts`, `web.ts`, and `provider.tsx`.
  - Start only with the Initial RuntimeAPIs Slice in this plan.
  - Keep data in existing Manager classes; components call Manager methods or API methods, not raw transaction objects.
  - Verification: runtime API adapter tests and existing manager tests.

- [x] Extract the shared renderer root.
  - Create `src/ui/OmniApp.tsx`.
  - Move the client shell currently rooted at `HomeApp` behind props for bootstrap and runtime APIs.
  - Keep Next `src/app/page.tsx` server-rendering the bootstrap and delegating to the renderer root.
  - Keep high-churn state subscriptions narrow.
  - Verification: `pnpm lint`, `pnpm test -- tests/app tests/ui`, and manual check of initial page render.

- [x] Add an embeddable renderer build.
  - Create `src/ui/render-web.tsx` and Vite config if required for Electron/VS Code bundles.
  - Ensure i18n resources, CSS, images, and dynamic imports resolve outside Next.
  - Keep heavy settings, terminal, file viewer, markdown/code surfaces lazy-loaded.
  - Verification: `pnpm run electron:build` builds `apps/electron/dist/renderer/index.html` and `renderer.js`; `pnpm run vscode:build` builds the VS Code webview bundle.

**Gate:** The existing browser app uses the shared renderer/API contract with parity tests passing before standalone server work proceeds.

### Phase 4: Standalone Server And CLI Gate

- [x] Implement the standalone runtime HTTP server.
  - Create `src/runtime/http/server.ts`.
  - Serve portable API routes and staged renderer assets.
  - Provide `startOmniServer(...)` with `getPort()`, `stop()`, `isReady()`, and diagnostics.
  - Reuse existing agent runtime bridge startup rules from `scripts/dev.ts`; do not start duplicate bridge processes when one is healthy.
  - Verification: runtime server tests plus a local smoke request to bootstrap and events snapshot.

- [x] Switch CLI internals to the runtime kernel.
  - Update `src/server/cli/runner.ts` to use the runtime rather than scattered imports.
  - Preserve current CLI output and `--json` behavior.
  - Add a scriptable runtime status command if it materially improves diagnostics.
  - Verification: CLI unit tests and a local `./omni --help` / dry start test where safe.

**Gate:** Standalone runtime server can serve bootstrap and event snapshot, and CLI still starts/watches real conversations.

### Phase 5: Electron Gate

- [x] Confirm Electron open decisions before implementation.
  - Resolve the native shell choice, runtime ownership, auth/session assumptions, and supported native capabilities for the current milestone.
  - Verification: record the decision in `docs/architecture/common-runtime-multi-surface.md`.

- [x] Add the Electron shell.
  - Create `apps/electron/*`.
  - Main process starts `startOmniServer(...)`, stages renderer assets, loads loopback, and handles shutdown.
  - Preload exposes only native capabilities: folder picker, open external, notifications, deep links, window actions, update hooks.
  - Gate commands by origin and explicit allowlist.
  - Verification: Electron startup contract tests and manual smoke if the environment supports GUI launch.

- [x] Add Electron diagnostics and failure surfacing.
  - Emit `runtime.start_failed`, `surface.bridge_failed`, and `error.surfaced` with stable codes.
  - Show real failure details in the renderer through existing error surfaces and logs.
  - Verification: tests simulate port conflict, bridge unavailable, and refused native command.

**Gate:** Electron can start the real runtime, show the existing conversation list, create a real conversation, quit, and relaunch without orphaning the runtime or test artifacts.

### Phase 6: VS Code Gate

- [x] Confirm VS Code open decisions before implementation.
  - Resolve runtime location, auth model, workspace trust/filesystem roots, and renderer breadth for the proof surface.
  - Verification: record the decision in `docs/architecture/common-runtime-multi-surface.md`.

- [x] Add the VS Code extension proof surface.
  - Create `apps/vscode/*`.
  - Extension host starts/connects to Omni runtime, serves webview HTML, and installs commands.
  - Webview implements `RuntimeAPIs` through `postMessage`.
  - Extension host proxies HTTP/SSE and exposes editor open-file/open-diff actions.
  - Verification: bridge unit tests and extension host smoke where available.

- [x] Add VS Code connection, reconnect, and refusal handling.
  - Persist connection status in extension state only where shell-specific.
  - Surface runtime connection failures, unknown bridge commands, and SSE proxy errors through typed responses.
  - Verification: bridge tests assert error payloads and no silent dropped requests.

**Gate:** VS Code proof surface can connect to a real runtime, list/start conversations, stream events, and open a referenced file through the editor bridge.

### Phase 7: Integration Hardening Gate

- [x] Update settings and i18n for new surfaces.
  - Add shell-visible labels/status strings to `shared/locales/*.json`.
  - Define persistence for any new setting: owner, storage, read/write path, reset behavior, migration behavior, and tests.
  - Do not put frontend UI settings in `.env`.
  - Verification: `pnpm test` includes i18n and VS Code webview checks; `pnpm lint` covers the touched frontend files.

- [x] Update scripts and workspace configuration.
  - Add `pnpm-workspace.yaml` only if package/app boundaries require it.
  - Add root scripts for renderer build, Electron dev/build, VS Code build/test, and runtime server smoke.
  - Keep existing `pnpm dev`, `pnpm start`, normal local URL, and compressed dev proxy behavior intact.
  - Verification: `pnpm dev` still reuses running processes according to existing testing rules.

- [x] Harden security boundaries.
  - Enforce auth/session checks in runtime/HTTP logic, not only in UI.
  - Ensure native bridge commands reject remote/untrusted origins.
  - Ensure VS Code bridge validates command types and payload shapes.
  - Ensure filesystem/git operations retain existing project scope protections.
  - Verification: security-focused unit tests and refused-command event assertions.

- [x] Run full deterministic verification.
  - `pnpm lint`
  - `pnpm test`
  - `pnpm test:lifecycle`
  - targeted Electron and VS Code build/test scripts added by this plan
  - renderer build and smoke server request

- [x] Clean up test conversations and persisted artifacts.
  - Use existing cleanup paths and `scripts/delete-conversations.sh` when conversations were created by verification.
  - Do not delete unrelated files or user data.
  - Verification: no manual smoke conversations were created for this pass; automated tests used their existing isolated cleanup paths.

### Verification Evidence From This Pass

- `pnpm lint`: passed with warnings only.
- `pnpm test`: passed, 211 files, 1190 tests, 5 skipped.
- `pnpm test:lifecycle`: passed, 17 files, 24 tests.
- `pnpm run vscode:build`: passed, producing extension and webview bundles.
- `pnpm run electron:build`: passed, producing main/preload bundles and staged renderer assets.
- `./omni --help`: passed, printing CLI usage and exiting 0.

### Verification Evidence From Follow-Up Route/Security Pass

- `pnpm test -- tests/runtime/http-routes.test.ts tests/api/notifications-route.test.ts tests/api/pairing-route.test.ts tests/vscode/bridge.test.ts tests/electron/runtime-shell.test.ts`: passed, 5 files, 27 tests.
- Added portable handlers and registry mounts for `/api/notifications`, `/api/auth/pair`, and `/api/auth/pair/redeem`.
- Tightened bridge validation so the VS Code proxy only accepts supported HTTP methods and OmniHarness `/api/` paths.
- Tightened Electron native `openExternal` so only `http:` and `https:` URLs are allowed.
- `pnpm test -- tests/runtime/http-routes.test.ts tests/api/read-support-routes.test.ts`: passed, 2 files, 22 tests.
- Added portable handlers and registry mounts for `/api/plans` and `/api/projects/memory`.
- `pnpm test -- tests/api/attachments-route.test.ts tests/runtime/http-routes.test.ts`: passed, 2 files, 18 tests.
- Added portable handler and registry mount for `/api/attachments`, with upload and readback coverage.
- `pnpm test -- tests/runtime/http-routes.test.ts tests/api/read-support-routes.test.ts tests/fs/files.test.ts`: passed, 3 files, 30 tests.
- Added portable handlers and registry mounts for `/api/fs` and `/api/fs/files`, using path containment checks for filesystem scope enforcement.
- `pnpm test -- tests/runtime/http-routes.test.ts tests/api/git-route.test.ts tests/server/git/workspaces.test.ts`: passed, 3 files, 35 tests.
- Added portable handler and registry mount for `/api/git`; temp-repo tests continue to cover stale guards, dirty checkout refusal, branch/worktree validation, and fork-run worktree behavior.
- `pnpm test -- tests/runtime/http-routes.test.ts tests/api/conversations-route.test.ts tests/api/conversation-messages-route.test.ts`: passed, 3 files, 56 tests.
- Added portable handlers and registry mounts for `/api/messages`, `/api/conversations`, `/api/conversations/:id/messages`, and queued-message send/cancel routes.
- `pnpm test -- tests/server/events/log-endpoint.test.ts tests/api/conversation-load-coverage.test.ts tests/runtime/http-routes.test.ts`: passed, 3 files, 27 tests.
- Added portable handlers and registry mounts for `/api/workers/:workerId/entries` and `/api/events/log`.
- `pnpm test -- tests/api/supervisor-route.test.ts tests/runtime/http-routes.test.ts`: passed, 2 files, 27 tests.
- Added portable handler and registry mount for `/api/supervisor`.
- `pnpm test -- tests/runtime/http-routes.test.ts tests/api/answer-route.test.ts tests/api/read-support-routes.test.ts`: passed, 3 files, 28 tests.
- Added portable handlers and registry mounts for `/api/runs/:id/answer` and `/api/runs/:id/resume`.
- `pnpm test -- tests/api/run-route.test.ts tests/server/events/conversation-delete-events.test.ts tests/lifecycle/scenarios/delete-conversation-fk.test.ts tests/runtime/http-routes.test.ts`: passed, 4 files, 42 tests.
- Added portable handler and registry mount for `/api/runs/:id` PATCH/POST/DELETE, with the existing Next route converted to a thin adapter.
- `pnpm test -- tests/api/events-route.test.ts tests/api/events-auth.test.ts tests/server/events/sse-resume.test.ts tests/runtime/http-routes.test.ts`: passed, 4 files, 52 tests, 5 skipped.
- Added portable handler and registry mount for `/api/events`, preserving snapshot checksums, `x-omni-last-event-id`, SSE ids, `Last-Event-ID`/query resume, and `stream.resync_required`.
- `pnpm test -- tests/api/planning-review-route.test.ts tests/api/planning-promote-route.test.ts tests/runtime/http-routes.test.ts`: passed, 3 files, 27 tests.
- Added portable handlers and registry mounts for `/api/planning/:id/review` and `/api/planning/:id/promote`.
- `pnpm test -- tests/cli/runner.test.ts tests/cli/options.test.ts tests/vscode/bridge.test.ts tests/electron/runtime-shell.test.ts`: passed, 4 files, 15 tests.
- Switched the CLI runner through `createOmniRuntime({ surface: "cli" })`; bridge tests continue to cover VS Code API-path/method refusal and Electron native URL gating.
- `pnpm test -- tests/api/events-route.test.ts`: passed, 27 tests, 5 skipped after adding an explicit test-only event payload cache reset for direct database mutation tests.

### Remaining Known Gaps

- Full route migration is complete for the inventoried API routes. The portable registry covers runtime bootstrap, auth/session/login/logout/pairing, settings, accounts, agents, LLM model discovery, Codex auth status, notifications, plans, project memory, planning review/promote, attachments, filesystem read routes, git, conversations, messages, queued-message mutations, run lifecycle routes, worker entries, supervisor, event-log diagnostics, and event snapshot/SSE streaming.
- Browser Home managers still contain direct fetch/SSE callers for compatibility. They should move behind `RuntimeAPIs` incrementally.
- GUI smoke journeys for Electron and VS Code were not run in this headless pass; build and unit/contract tests prove the shell contracts.

## Acceptance Criteria

- Existing browser app behavior is preserved.
- CLI still starts conversations and can watch output.
- Electron shell starts the real runtime in-process, loads the shared renderer, surfaces real startup/shutdown errors, and cleans up on quit.
- VS Code proof surface uses the shared renderer and real runtime bridge to list/start conversations and stream events.
- No new parallel persistence layer exists for conversations, workers, messages, events, queued messages, worker streams, plans, or validation records.
- All new user-facing strings are in locale files.
- All server-side decisions introduced or moved by the plan emit typed named events.
- SSE resume and snapshot bootstrap work across web, Electron, and VS Code adapters.
- All deterministic verification commands pass before the milestone is called complete. Any failing required check means the milestone remains incomplete, even if the blocker is documented.

## Self-Review Notes

- The plan honors the local prohibition on branches and worktrees.
- The plan does not authorize file deletion.
- The plan keeps Next working while runtime and renderer boundaries are extracted.
- The plan chooses Electron for the first native shell because it supports the OpenChamber-style in-process Node runtime; SwiftUI/WKWebView remains a future shell option.
- The plan avoids fake extension/native success paths: shells must exercise the real runtime before acceptance.
- The biggest risk is scope size. The route registry and renderer extraction must land incrementally with tests after each converted slice.
