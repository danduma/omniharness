# Multi-Server Standalone Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the OmniHarness interface into a standalone client surface that can connect to, switch between, and safely operate multiple real OmniHarness servers from one running app.

**Architecture:** Add one selected-server transport beneath the existing Home renderer: it wraps `requestJson`, raw `fetch`, and SSE URL construction with `serverId + generation` ownership. The current `src/runtime-api/*` adapters remain the boot/shell capability layer and are changed only where bootstrap or event-source construction needs the same selected-server behavior. The current local Next/runtime server remains a valid target, but the renderer stops assuming every API request, SSE stream, worker-entry fetch, cache record, and auth query belongs to `window.location.origin`; all runtime-owned state is keyed by a stable server identity plus the existing run/worker/session cursors.

**Tech Stack:** Next.js 15, React 19, existing Manager classes, TanStack Query, TypeScript, runtime HTTP registry, SSE named events, localStorage for device-local server directory state, shadcn/ui controls already present in the app, shared i18n JSON resources, Vitest, lifecycle HTTP/SSE scenarios, Playwright for approval-gated UI journeys.

**North Star Product:** OmniHarness becomes a control room for local, LAN, tunneled, desktop-started, editor-started, and remote OmniHarness runtimes: one interface can observe and operate many servers without losing lifecycle observability, transcript authority, auth boundaries, or user trust.

**Current Milestone:** Ship a complete standalone interface mode for multiple HTTP OmniHarness server origins: users can add/edit/remove servers, select an active server, authenticate per server, browse conversations from the active server, switch servers without stale data bleed, reconnect/resync SSE per server, fetch worker entries from the correct server, and see clear per-server health/auth/error state.

**Future Product Direction:** Later surfaces can add hosted account sync for the server directory, richer fleet monitoring across many servers at once, native discovery through desktop/editor shells, and admin dashboards. These are context only; the checklist below delivers the current milestone completely.

**Final Functionality Standard:** The interface must operate against real OmniHarness servers only. No fake server records, mock conversations, synthetic health success, duplicate transcript persistence, or UI-only routing shims count as completion.

---

## Scope Notes

- Do not create branches.
- Do not create worktrees.
- Do not delete files.
- Keep the existing single-server local app behavior working while multi-server mode is introduced.
- Do not replace the unified worker conversation stream. Worker content remains fetched through the target server's `/api/workers/:workerId/entries` endpoint and rendered through `WorkerEntriesManager`/`Terminal`.
- Do not add a parallel server-side persistence layer for remote conversations. Each OmniHarness server remains authoritative for its own runs, workers, messages, events, queued messages, settings, and auth.
- Do not create competing runtime API abstractions. The selected-server transport is the single low-level injection point for Home app HTTP/SSE work; `src/runtime-api/types.ts`, `src/runtime-api/web.ts`, `src/runtime-api/electron.ts`, `src/runtime-api/vscode.ts`, and `src/runtime-api/provider.tsx` remain boot/shell adapters and delegate only where they actually issue bootstrap or event-stream requests.
- Every new user-facing frontend string must be added to every file in `shared/locales/` and rendered with `t()`.
- All new shared frontend state must be centralized in Manager classes with narrow subscriptions. Do not use independent component arrays as source-of-truth server lists.

## PM Pass

**First User:** The human builder who may run more than one OmniHarness instance: local default server, desktop-started server, a server exposed through a tunnel, and possibly a second machine on LAN.

**Core Job:** Use one interface to choose an OmniHarness server and operate that server's conversations, workers, plans, files, settings, and lifecycle state without restarting the UI.

**Supporting Jobs:**

- Add a server by URL and confirm it is really an OmniHarness server.
- Remember trusted servers across browser refreshes.
- See whether each server is reachable, locked by auth, authenticated, degraded, or unavailable.
- Switch the active server without cached snapshots, query data, worker entries, or optimistic mutations corrupting the newly selected server.
- Reconnect to SSE streams per server using the server's own event ids.
- Recover when the selected server goes offline, returns an auth challenge, emits `stream.resync_required`, or returns incompatible version/capability data.
- Remove a remembered server from this interface without deleting data from that server.
- Keep local/offline single-server use simple for users who never add another server.

**User Segmentation And Role Clarity:** This milestone is still a single-user builder tool. Multi-user permissioning, team server directories, and shared fleet administration are not part of the milestone.

**State Model:**

- `noServers`: first-run standalone directory has no configured server.
- `serverKnown`: a server record exists with an id, display name, origin, and trust metadata.
- `checking`: the interface is probing bootstrap/session/health for a server.
- `reachable`: the server responded with an OmniHarness runtime descriptor.
- `authRequired`: the server has auth enabled and the current browser context is not authenticated.
- `authenticated`: the server accepted session state and runtime data can load.
- `selected`: a server is the active source for app-level queries and streams.
- `degraded`: the selected server is reachable but one or more runtime surfaces fail.
- `offline`: the server cannot be reached.
- `incompatible`: the server responded but lacks required multi-server contract fields.
- `removed`: the interface forgot a server locally; remote server data is untouched.

**Persistence Model:**

- Server directory records persist device-locally in browser `localStorage` under a versioned key such as `omni.server-directory:v1`.
- Stored server records include stable `serverId`, normalized origin, display name, last selected marker, last known health/auth state, last seen version/capabilities, and timestamps. They do not store translated copy.
- Server credentials are not persisted by the directory. Existing cookie/session auth remains server-owned by browser origin. This milestone uses secure cookie auth for explicitly allowed HTTPS standalone origins; token/session bridges are future work and require a separate explicit secret-storage design.
- Runtime snapshots, worker-entry caches, TanStack Query keys, optimistic pending ids, route selection, and read markers are keyed by `serverId` so data from one server cannot satisfy authority for another.
- Removing a server deletes only local directory/cache records for that `serverId`; it does not call delete endpoints on the target server.

**Operational Readiness:**

- Bootstrap, health, auth-session, settings, event stream, worker entries, and mutation requests must all use bounded timeouts or cancellation through the runtime client.
- Switching servers cancels or ownership-invalidates in-flight requests and SSE streams from the previous server.
- Cross-origin access is a product feature, not just a frontend URL change. Remote servers must explicitly allow configured standalone UI origins, credentials, preflight requests, and SSE connection rules before the standalone client can treat them as usable.
- Authenticated cross-origin access is limited to HTTPS target origins. Plain-HTTP LAN servers can be used only when unlocked or same-origin because browsers block mixed content from HTTPS standalone UIs and `SameSite=None` cookies require `Secure`.
- Auth errors must show the target server and action that failed.
- Version/capability mismatch must be explicit and recoverable.
- Hot-path active-server bootstrap must not synchronously probe every known server; background health checks are bounded and staggered.

**Instrumentation And Observability:**

- The local interface emits client-side diagnostics through existing frontend error surfaces with `serverId`, `origin`, `source`, and `action`.
- Server-side decisions remain owned by each target OmniHarness server and observed through its named event stream. The interface must not infer server decisions by diffing snapshots.
- Model client-side lifecycle diagnostics in `ServerDirectoryManager` as bounded recent records and render the latest relevant records through the existing frontend error/status surfaces. Required records: `server.selected`, `server.probe.started`, `server.probe.failed`, `server.auth.required`, `server.connection.offline`, `server.connection.restored`, `server.cache.cleared`, `server.incompatible`, and `server.removed`.
- Keep `/api/events/log?since=<id>&runId=<id>` scoped to the selected target server through the runtime client.

**Onboarding And Discoverability:**

- Existing local app behavior stays the default when the UI is served by an OmniHarness server.
- Standalone mode shows a compact server selector in the header and an empty state that lets the user add a server URL.
- Adding a server validates the URL and shows reachability/auth/version state before selection.
- Server settings live in a dense settings/control surface with compact rows and no redundant explanatory chrome.

**Risk And Trust Surfaces:**

- Cross-server data bleed is the main trust risk. Every cache and async callback must prove server ownership before mutating visible state.
- Auth confusion is high risk: a login prompt must name the server it applies to and never imply the user is logged into all servers.
- Destructive actions must keep acting only on the active server and clearly show the server context.
- `localhost` is not globally meaningful across devices. Stored server origins must be displayed exactly enough for users to distinguish local, LAN, and tunneled servers.

## Product Completeness Pass

### Primary Stories

- As a builder, I can add a real OmniHarness server by URL and select it as the active server.
- As a builder, I can switch between remembered servers and see the correct conversations, workers, status, and settings for the selected server.
- As a builder, I can continue using the current single-server local app without configuring a server directory.

### First-Run And Empty-State Stories

- As a first-time standalone user, I see that no server is connected and can add one.
- As a user who opens the local app at `http://localhost:3035`, I land directly in the existing home surface with the current server auto-registered as the local server.

### Return/Revisit Stories

- As a returning user, I see remembered servers and the last selected server.
- As a returning user, cached previews may speed up the UI but cannot satisfy loaded authority until the selected server responds.

### Failure And Recovery Stories

- As a user, I see when a server is offline, requires login, is incompatible, or returns a runtime error.
- As a user, I can retry health/auth/bootstrap for a server without losing draft input for another server.
- As a user, if SSE replay is unavailable, the interface re-bootstrapes from the target server's snapshot anchor and does not silently miss events.

### Status-Awareness Stories

- As a user, I know which server is active at all times.
- As a user, I can tell whether active conversations and worker streams are live, cached preview, reconnecting, resyncing, or terminal.
- As a user, I can see per-server status in the selector without every known server blocking initial render.

### Mutation Stories

- As a user, creating, sending, stopping, retrying, deleting, archiving, editing, forking, settings saves, file opens, git workspace actions, and planning review actions apply only to the selected server.
- As a user, if I switch servers while a mutation is in flight, the mutation result cannot navigate, clear composer state, or update snapshots for the new server unless it owns the current server token.

### Mobile Stories

- As a mobile user, I can still see and change the active server through the existing header/mobile navigation without crowding the composer or conversation controls.
- As a mobile user, add/edit server controls use a sheet/dialog pattern that preserves the current conversation context.

## Architecture

### Standalone Interface Definition

This milestone includes two entry modes:

- **Served local mode:** the current app is served by an OmniHarness runtime at an origin such as `http://localhost:3035`. This mode auto-registers the serving origin as the local/default server and must remain the simplest path.
- **Standalone client mode:** `src/ui/render-web.tsx` becomes the browser/static entry that can mount `OmniApp` with `bootstrap={null}` when `/api/runtime/bootstrap` is unavailable or intentionally skipped. The milestone is not complete until that entry renders the server-directory empty state without requiring a local OmniHarness runtime to provide initial conversation data.

Standalone acceptance criteria:

- `OmniApp` and `HomeApp` accept `HomeBootstrapPayload | null`.
- The renderer has a boot path where `initialEventState`, `initialQueries.session`, and `initialQueries.settings` are absent because no server is selected yet.
- Served-local mode renders the bootstrap descriptor for first paint, then reconciles localStorage after mount so the server selector does not create hydration mismatches.
- Adding a server probes `/api/runtime/bootstrap` on that target and transitions into normal authenticated/unauthenticated runtime flow.
- Browser routing, selected run params, and pair-token params do not crash when no server exists.
- The local served mode still works without any visible setup for single-server users.

### Server Directory

Create a frontend `ServerDirectoryManager` that owns remembered servers and selected server state. It is the only source of truth for:

- `serverId`,
- normalized origin,
- display name,
- status,
- last selected server,
- last health/auth/version result,
- local validation errors,
- add/edit/remove dialog draft state.

The manager persists only directory metadata to localStorage. It also exposes a current `serverToken`/generation that increments on selection, edit, removal, and explicit reconnect. Async code must carry this token and check it before mutating Managers, query caches, route state, worker stream state, or composer state.

### Runtime Descriptor Schema

Add a versioned runtime descriptor to `/api/runtime/bootstrap` and `HomeBootstrapPayload`:

```ts
type RuntimeServerDescriptor = {
  descriptorVersion: 1;
  installationId: string;
  serverId: string;
  origin: string;
  displayName: string;
  runtimeVersion: string;
  capabilities: Array<
    | "events.sse.v1"
    | "events.log.v1"
    | "events.snapshot.v1"
    | "workers.entries.v1"
    | "auth.cookie.v1"
    | "settings.v1"
    | "conversations.v1"
    | "files.v1"
    | "git.v1"
    | "notifications.v1"
  >;
  standaloneInterfaceSupported: boolean;
};
```

Descriptor rules:

- For the server that serves the UI, derive `serverId` from the durable `installationId`. Remote directory entries keep their generated local `serverId` stable even if display name changes.
- `installationId` is a durable server-side uuid persisted outside the browser, generated on first startup if missing, and returned by every runtime bootstrap. Use it as the preferred stable identity across localhost/LAN/tunnel origins.
- `serverId` is the local directory key. For servers with `installationId`, derive it from `installationId`; for legacy servers without it, derive it from normalized origin and descriptor version. Any `descriptor.serverId` value is informational/validation data; the client computes the directory key locally from this rule.
- Store `installationId` in the local OmniHarness app data/config area through `src/server/installation-id.ts`, not in browser localStorage. The helper owns creation, read, validation, and corruption recovery for that id.
- Duplicate normalized origins map to one remembered server record; adding the same origin updates/probes the existing record instead of creating a duplicate.
- If a tunnel URL points to the same `installationId` as another remembered origin, the directory links both origins to the same server record and updates the preferred origin only through explicit user action. Without `installationId`, the UI may warn about matching display/version but must not merge records by guesswork.
- Missing required capabilities produce `incompatible` status with a precise list of missing capabilities.
- Descriptor version mismatch is recoverable: the user can keep the server record, retry after upgrade, or remove the local record.
- Tests must cover same origin, duplicate origin, changed display name, tunnel origin with same installation id, legacy server without installation id, missing capability, and unsupported descriptor version.

### Selected-Server Transport Boundary

Use `src/app/home/runtime-client.ts` as the selected-server transport. It is not a second product API; it is the single low-level implementation used by Home app call sites:

```ts
type RuntimeServerRef = {
  serverId: string;
  origin: string;
  generation: number;
};

type SelectedRuntimeTransport = {
  server: RuntimeServerRef;
  buildUrl(path: string): string;
  requestJson<T>(path: string, init: RequestInit | undefined, fallback: AppErrorDescriptor): Promise<T>;
  fetch(path: string, init?: RequestInit): Promise<Response>;
  openEvents(args: { runId?: string | null; lastEventId?: string | null }, handlers: EventStreamHandlers): RuntimeSubscription;
  fetchSnapshot(args: { runId?: string | null; checksum?: string | null }): Promise<SnapshotPollResult>;
};
```

The exact shape can change during implementation, but the boundary must preserve these ownership rules:

- `requestJson` and raw `fetch` call sites in Home/runtime UI code migrate to the selected-server transport unless the audit classifies them as local-shell-only.
- `LiveEventConnectionManager` receives the selected-server transport, not a bare URL builder.
- `src/runtime-api/web.ts` changes are limited to boot-time `bootstrap.load`, event-source option support, and compatibility with shared descriptor types. The Home app does not currently consume `RuntimeAPIs` for its main request surface, so implementation must not rely on `web.ts` as the migration path for Home call sites.
- Local-only shell endpoints may remain relative only after a call-site audit classifies them as local-shell-only.
- Direct calls to hardcoded `"/api/..."` from app-state code that depends on the selected server are forbidden after this migration.

### Transport Wiring

The selected-server transport reaches code through two paths:

- React hooks and components read the current `RuntimeServerRef` through a narrow selector/context backed by `ServerDirectoryManager`.
- Non-React managers receive a transport provider through constructor options or explicit setters, and are re-pointed on server selection changes. This applies to `WorkerEntriesManager`, `LiveEventConnectionManager`, `ConversationNotificationManager`, `GitWorkspaceManager`, `ProjectMemoryPanelManager`, and any other manager found by the audit.

Phase 2 defines and tests the `RuntimeServerRef` contract with an injected provider so the transport can be tested before the full server directory UI exists. In served-local mode the provider must use the bootstrap descriptor's installation-id-derived `serverId` from the start; use a deterministic synthetic id only for null-bootstrap standalone mode before any server is selected. Phase 3 tests can drive generation bumps and server-ref swaps through this injected provider without waiting for the Phase 4 server directory UI. Phase 4 replaces the temporary provider with `ServerDirectoryManager` while preserving the same `serverId` key space.

### Bootstrap Model

Extend `HomeBootstrapPayload` with a runtime descriptor for the server that served the page:

- `serverId`,
- `origin`,
- `displayName`,
- `runtimeVersion`,
- `capabilities`,
- `standaloneInterfaceSupported`.

When the page is served by an OmniHarness runtime, the interface auto-registers this origin as the local/current server and hydrates initial event/settings/session data under that `serverId`. When the page is served as a static/standalone interface, it starts without an initial runtime payload and prompts for a server.

### Remote Access Policy

To support a standalone UI hosted on a different origin from a target server, the target OmniHarness server must expose an explicit browser access policy. Add this as a server-side runtime feature, not as an implicit permissive CORS change:

- Configured allowed UI origins, with local defaults for same-origin and explicit development origins only.
- `OPTIONS` preflight handling for runtime routes that accept cross-origin requests.
- `Access-Control-Allow-Origin` echo for allowed origins, never `*` when credentials are used.
- `Access-Control-Allow-Credentials: true` for allowed credentialed requests.
- Allowed methods/headers for JSON runtime calls.
- SSE support with credentials. Native `EventSource` does not support arbitrary headers and only supports cookies when constructed with `{ withCredentials: true }`; the runtime API adapter must account for this.
- Cookie strategy is explicit for this milestone: add a secure cross-site cookie mode for explicitly allowed HTTPS origins (`SameSite=None; Secure`). Do not implement a token/session bridge in this milestone.
- Authenticated cross-origin standalone access is supported only for HTTPS targets. Plain `http://` LAN targets may be added and probed, but protected sessions on those targets must surface a clear unsupported-auth transport state unless the UI is same-origin.
- Existing same-origin CSRF checks in auth routes must be revisited so cross-origin login is accepted only from configured standalone UI origins and still rejected from arbitrary sites.
- Tests must cover protected server login/session from an allowed origin, disallowed origin rejection, preflight, SSE credentials, and logout/session revocation.

This cross-origin backend work is part of the current milestone. Multi-server same-origin/localhost support may land behind passing tests first, but the milestone is not complete until allowed-origin standalone access works against an authenticated protected server.

### Query And Cache Model

Every TanStack Query key for runtime state must include `serverId`:

- `["auth-session", serverId]`,
- `["settings", serverId]`,
- `["worker-catalog", serverId]`,
- `["project-files", serverId, projectPath]`,
- mutation side-effect ownership checked by `serverId + generation`.

Every localStorage cache key or envelope scope must include `serverId`:

- event snapshot cache: `serverId + runId/global`,
- worker entries cache: `serverId + workerId`,
- route selection/read markers where persisted locally,
- optimistic created/sent conversation snapshots.

### SSE And Worker Entries

`LiveEventConnectionManager` receives a runtime client and `serverRef`. Remote/runtime-targeted SSE goes through `runtime-client.openEvents`, which constructs `EventSource` against the selected origin with `{ withCredentials: true }` when credentials are needed. `src/runtime-api/web.ts` may keep local-shell boot stream compatibility, but remote Home SSE does not route through `web.ts`. The connection carries the selected server generation and ignores late events from old generations. `lastEventId` is per `serverId` and per selected run scope.

`WorkerEntriesManager` keys state by `{ serverId, workerId }`, not by `workerId` alone. SSE `worker.entry_appended` remains a wake-up hint; the manager fetches entry bodies from the selected server's `/api/workers/:workerId/entries` endpoint. A global ring-buffer resync on one server must not clear worker streams for another server.

### Auth And Trust Boundary

Auth remains server-origin-owned. The runtime client uses `credentials: "include"` for same-origin and configured remote origins, and surfaces `401`/`403` as server-specific auth state. Login/logout/session routes are issued against the selected server only.

Cross-origin support must be explicit:

- Detect and report CORS/network failures separately from auth failures.
- Require `http://` or `https://` origins; normalize away trailing slashes.
- Block obviously unsafe protocols.
- Show the exact origin in auth and destructive-action context.

### UI Surface

Add a compact active-server control to `HomeHeader` using existing shadcn/ui primitives:

- active server name/origin,
- health/auth status indicator,
- menu to switch servers,
- add server action,
- edit/remove action for remembered servers,
- retry connection action.

Settings gets a server directory panel or section with dense rows. It should follow the existing settings layout and avoid duplicate headings/subtitles. The add/edit server dialog validates and probes a server before saving or selecting.

Desktop/mobile behavior:

- Desktop: header selector plus settings panel.
- Mobile: same selector accessible from top navigation or a sheet; no crowded inline server table in the composer.

### Error Model

Extend `AppErrorDescriptor` or wrap it at runtime-client boundaries with:

- `serverId`,
- `origin`,
- `code`,
- `status`,
- `source`,
- `action`,
- `details`.

Do not replace target server errors with generic "failed" text. Preserve server-provided stable codes and details when present.

### Runtime Call-Site Audit

Before changing runtime behavior, run and preserve an audit of every runtime-shaped call site:

```bash
rg -n "fetch\\(|requestJson\\(|new EventSource|/api/" src/app src/components src/lib src/runtime-api
```

Classify each call as:

- `runtime-targeted`: must go through the selected-server transport and include `serverId` in cache/ownership.
- `local-shell-only`: remains relative because it targets the shell hosting the renderer rather than the selected OmniHarness server.
- `server-internal`: stays server-side and is not part of browser server selection.

Known runtime-targeted areas include auth/session/login/logout, settings saves, worker catalog, project files and file viewer, file pickers, attachments, notifications, project memory, git workspace, queued-message mutations, transcript/history fetches, prewarm, pairing, external sessions, model auth status, conversation create/send, run actions, planning review/promote, events/log, and worker entries. The implementation checklist must update the file map from this audit before implementation proceeds.

## Client/Server State Invariants

- **Owner:** Runtime data is owned by the selected server. Directory metadata is owned by `ServerDirectoryManager`. Worker transcript content is owned by the target server's worker JSONL stream.
- **Token:** Every async result carries `serverId + generation`; run-specific work also carries `runId`; worker content also carries `serverId + workerId + seq`.
- **Provenance:** Cached snapshots and worker entries are preview/fallback only until the selected server returns authoritative bootstrap/snapshot or contiguous stream data.
- **Completeness:** Event snapshots keep existing `snapshotScope`, `messageScope`, and catalog completeness rules, now scoped by `serverId`.
- **Ordering:** SSE uses the target server's monotonic event ids. Worker content uses target server per-worker `seq`. Lists keep existing deterministic tie-breakers such as `(createdAt, id)`.
- **State machine:** Server directory status transitions are explicit: unknown -> checking -> reachable/authRequired/authenticated/degraded/offline/incompatible.
- **Events:** Server decisions still come from the target server's named events. Client-side server-selection decisions are manager-owned UI state, not synthetic runtime events.
- **Loading shape:** Split active-server bootstrap, auth check, snapshot load, SSE reconnect, worker-entry fetch, background health check, and terminal error states.
- **Fallbacks:** A cached same-server preview may render while reconnecting. A different server's cache must never render for the selected server.
- **Tests:** Include stale-response, server-switch, query-key, SSE replay/resync, worker-entry cache, and mutation ownership tests.

## File Map

### Files To Create

- `docs/architecture/multi-server-runtime-callsite-audit.md`
  - Required first artifact: classified audit table for every browser/runtime `fetch`, `requestJson`, `new EventSource`, and `"/api/"` call site.
- `src/app/home/ServerDirectoryManager.ts`
  - Manager for remembered servers, selected server, health/auth status, add/edit/remove dialog drafts, localStorage persistence, and generation tokens.
- `src/app/home/runtime-client.ts`
  - Selected-server-aware wrapper for `requestJson`, raw `fetch`, snapshot fetches, event-stream construction, worker-entry URL construction, timeout, cancellation, and error-normalization helpers.
- `src/app/home/server-directory-storage.ts`
  - Versioned serialization, migration, origin normalization, pruning, and local removal helpers for server directory records.
- `src/app/home/server-health.ts`
  - Probe logic for runtime bootstrap/session capability checks with bounded timeouts and typed outcomes.
- `src/server/installation-id.ts`
  - Durable runtime installation id creation/read helper used by bootstrap descriptors.
- `src/runtime/http/cors.ts`
  - Allowed standalone UI origin parsing, CORS/preflight response helpers, credential policy, and route wrapper utilities.
- `tests/runtime/cors-auth.test.ts`
  - Cross-origin protected-server auth, preflight, cookie/session, and disallowed-origin coverage.
- `src/components/home/ServerSelector.tsx`
  - Header/mobile server selector, status menu, switch/retry/edit/remove entry points, all strings through i18n.
- `src/components/settings/ServersSettingsPanel.tsx`
  - Dense settings panel for remembered servers and add/edit/remove controls.
- `src/components/home/ServerConnectionDialog.tsx`
  - Add/edit server dialog with URL normalization, validation, probe result, auth/incompatible/offline messaging, and save/select actions.
- `tests/app/home/ServerDirectoryManager.test.ts`
  - Directory persistence, selection generation, remove semantics, migration, and status transitions.
- `tests/app/home/runtime-client.test.ts`
  - URL building, error normalization, auth/offline/unsupported-transport classification, timeout/cancellation, and ownership-token behavior.
- `tests/app/home/multi-server-cache.test.ts`
  - Snapshot/worker cache scoping by `serverId`, stale SSE generation fencing, stale mutation side effects, and corrupt localStorage recovery.
- `tests/lifecycle/scenarios/multi-server-interface.test.ts`
  - Headless two-server scenario proving selected-server bootstrap, event logs, worker entries, auth/offline behavior, and cleanup.
- `docs/architecture/multi-server-standalone-interface.md`
  - Architecture doc covering server directory ownership, runtime-client contracts, cache keys, auth boundary, and test rules.

### Files To Modify

- `src/runtime/bootstrap.ts`
  - Add runtime/server descriptor fields to `HomeBootstrapPayload`, including durable `installationId`.
- `src/app/home/bootstrap.server.ts`
  - Preserve existing Next bootstrap while passing descriptor data through.
- `src/ui/OmniApp.tsx`
  - Accept `HomeBootstrapPayload | null` and keep `RuntimeApiProvider` available for served and standalone entry modes.
- `src/ui/render-web.tsx`
  - Support standalone null-bootstrap mounting when no server is selected or `/api/runtime/bootstrap` is unavailable.
- `src/runtime-api/types.ts`
  - Add event-source option and descriptor types that belong in the shared shell contract.
- `src/runtime-api/web.ts`
  - Keep as the web boot/shell adapter; update bootstrap descriptor typing and `EventSource` constructor typing to support `{ withCredentials: true }`.
- `src/runtime-api/electron.ts` and `src/runtime-api/vscode.ts`
  - Keep shell adapters compatible with the updated shared runtime API types.
- `src/runtime-api/provider.tsx`
  - Preserve provider behavior while allowing standalone/null-bootstrap app startup.
- `src/runtime/http/registry.ts` and/or `src/runtime/http/server.ts`
  - Apply CORS/preflight policy consistently to runtime routes without weakening same-origin defaults.
- `src/runtime/http/routes/cookies.ts`
  - Support the chosen explicit standalone cookie/session strategy for configured HTTPS standalone origins.
- `src/runtime/http/routes/auth-login.ts` and `src/runtime/http/routes/auth-session.ts`
  - Revisit same-origin/CSRF checks for configured standalone UI origins while still rejecting arbitrary cross-site requests.
- `src/app/home/HomeApp.tsx`
  - Hydrate server directory from bootstrap, pass active server context to queries, lifecycle, mutations, header, settings, and stream managers. Split before adding substantial logic because this file is already over 1200 lines.
- `src/app/home/useHomeQueries.ts`
  - Include `serverId` in query keys and route all runtime requests through `runtime-client`.
- `src/app/home/useHomeMutations.ts`
  - Include selected server ownership in mutation start state, route requests through `runtime-client`, and block stale mutation side effects after server switches.
- `src/app/home/useQueuedMessageMutations.ts`
  - Route queued-message actions through selected-server transport with ownership checks.
- `src/app/home/useConversationActions.ts`
  - Route fire-and-forget settings/runtime calls through selected-server transport or classify as local-shell-only.
- `src/app/home/useHomeLifecycle.ts`
  - Recreate/cancel live event connections when `serverId`, generation, selected run, or auth state changes.
- `src/app/home/LiveEventConnectionManager.ts`
  - Replace relative URL builders with runtime-client URL builders, carry server generation, and report server-scoped errors.
- `src/app/home/EventStreamStateManager.ts`
  - Preserve merge/completeness behavior while scoping cache hydration and authoritative snapshots by `serverId`.
- `src/app/home/EventStreamSnapshotCacheManager.ts`
  - Version cache envelopes to include `serverId` in scope keys; migrate or ignore v1 same-origin-only cache safely.
- `src/app/home/WorkerEntriesManager.ts`
  - Key state, listeners, cache entries, in-flight requests, wake versions, and endpoint builders by `serverId + workerId`; preserve the existing `listEntries({ runId, workerId, afterSeq })`/query shape where required by the endpoint.
- `src/app/home/HomeUiStateManager.ts`
  - Add selected server route/UI state only if it belongs with existing route state; otherwise keep it in `ServerDirectoryManager`.
- `src/components/home/HomeHeader.tsx`
  - Render `ServerSelector` without broad subscriptions to high-churn conversation state.
- `src/components/home/SettingsDialog.tsx`
  - Register the servers settings section/tab if the existing settings composition supports it.
- `src/components/settings/GeneralSettingsPanel.tsx`
  - Link or route to server directory controls if that matches the current settings hierarchy.
- `src/components/home/ConversationSidebar.tsx`
  - Make active-server identity visible where needed and avoid cross-server cached counts.
- `src/components/home/ConversationMain.tsx`
  - Ensure destructive and mutation controls receive active server context and render server-specific failure context. Avoid growing this already-large file; extract helper components if substantial UI is needed.
- `src/components/home/FileViewerPanel.tsx`, `src/components/FolderPickerDialog.tsx`, `src/components/FileAttachmentPickerDialog.tsx`, `src/app/home/ComposerContainer.tsx`, `src/app/home/ExternalSessionsPicker.tsx`, `src/app/home/ConversationNotificationManager.ts`, `src/app/home/ProjectMemoryPanelManager.ts`, `src/app/home/GitWorkspaceManager.ts`, `src/app/home/upload-attachments.ts`, and `src/components/settings/ModelProfileForm.tsx`
  - Classify through the call-site audit and migrate runtime-targeted requests to selected-server transport.
- `src/lib/app-errors.ts`
  - Preserve runtime `code`, `serverId`, and `origin` fields in normalized app errors.
- `shared/locales/*.json`
  - Add keys for server selector, server statuses, add/edit/remove dialogs, validation, auth/offline/incompatible errors, retry, and settings labels.
- `tests/lifecycle/harness/server.ts`
  - Keep for in-process single-server scenarios; do not use it as the authority for two-server isolation.
- `tests/lifecycle/harness/subprocess.ts` and `tests/lifecycle/harness/subprocess-runner.ts`
  - Add or verify support for launching two independent subprocess harnesses with separate roots and route coverage for bootstrap, auth, events/log, worker entries, settings, conversations, and cleanup.
- `tests/lifecycle/harness/client.ts`
  - Add helpers for server-specific bootstrap/events/log/worker-entry calls used by the two-subprocess scenario.
- `.gitignore`
  - Verify no change is needed; add ignores only if tests introduce new temp output paths.

### Tests To Update Or Add

- Unit tests for server origin normalization and unsafe protocol rejection.
- Unit tests for runtime descriptor schema, durable installation id stability, duplicate origin handling, tunnel origin with same installation id, legacy no-installation-id fallback, and incompatible capability detection.
- Unit tests for `ServerDirectoryManager` persistence, migrations, generation ownership, last-selected behavior, and local-only removal.
- Unit tests for runtime-client request URL building, credentials mode, timeout/cancellation, auth/offline/incompatible classification, and error details.
- Unit tests for malformed/corrupt server-directory localStorage recovery.
- Unit tests for `useHomeQueries` query keys or extracted key builders to prove `serverId` is always present for runtime queries.
- Unit tests for mutation ownership helpers in `useHomeMutations.ts`: start on server A, switch to B, resolve A, assert B navigation, composer draft, attachments, query cache, and snapshots are not mutated.
- Unit tests for `EventStreamSnapshotCacheManager` proving server A cache cannot hydrate server B, and server-authoritative bootstrap cannot be demoted by same-server cache.
- Unit tests for `WorkerEntriesManager` proving same `workerId` on two servers has independent entries, in-flight requests, cache, and wake-up behavior.
- Unit tests for stale SSE generation fencing: open stream for server A generation 1, switch/reconnect to generation 2 or server B, deliver generation 1 event, assert it is ignored.
- Runtime route tests for allowed-origin CORS, denied-origin CORS, preflight, credentialed auth login/session/logout, and SSE credential compatibility.
- Lifecycle scenario with two real isolated servers:
  - add/select server A and server B,
  - verify bootstrap and `/api/events/log` source for each,
  - create or inspect a conversation on A,
  - switch to B and verify A data disappears or becomes clearly inactive,
  - reconnect A with `Last-Event-ID`,
  - simulate B offline and verify A remains usable,
  - cleanup all test conversations/artifacts on both servers.
- Existing lifecycle tests must keep passing: `pnpm test:lifecycle`.

### Candidate Agentic User Journey Tests

These require explicit user approval before running:

- **Two-server switching journey:** open the UI, add two local test servers, create a conversation on each, switch repeatedly, and confirm conversations, worker streams, and composer drafts do not bleed across servers.
- **Auth boundary journey:** connect to one unlocked server and one password-protected server, verify login state and errors are scoped to the protected server.
- **Offline recovery journey:** connect to two servers, stop one, verify status/error/retry behavior while the other remains usable, restart the stopped server, and verify reconnect/resync.
- **Mobile selector journey:** verify server selection and add/edit flows fit on mobile without hiding the active conversation state.

### `.gitignore` Coverage

Before implementation, verify `.gitignore` covers:

- `node_modules/`, package-manager caches, `.next/`, coverage, logs, temp files, and lifecycle harness temp roots.
- No server-directory secret files are introduced.
- No generated screenshots, Playwright reports, or lifecycle run artifacts are committed unless explicitly requested.

## Implementation Checklist

- [ ] Phase 0: audit touched file sizes and split before adding major logic.
  - `src/app/home/HomeApp.tsx` is already over 1200 lines; extract server-directory bootstrap/lifecycle glue before adding the new surface.
  - `src/app/home/useHomeMutations.ts` is close to 1200 lines; extract server-aware request helpers and ownership checks rather than growing inline mutation bodies.
  - Verification: `wc -l` confirms new multi-server logic lives in dedicated modules and no touched file newly exceeds 1200 lines without a planned split.

- [ ] Phase 0: perform the runtime call-site audit before implementation.
  - Run `rg -n "fetch\\(|requestJson\\(|new EventSource|/api/" src/app src/components src/lib src/runtime-api`.
  - Create `docs/architecture/multi-server-runtime-callsite-audit.md` with a table of file, line, endpoint, owner classification, migration action, and test requirement.
  - Update this plan's file map if the audit finds any additional runtime-targeted modules.
  - Verification: every browser-visible call site is classified as `runtime-targeted`, `local-shell-only`, or `server-internal`; no unclassified direct runtime calls remain.

- [ ] Phase 1: add the runtime descriptor schema and durable installation id.
  - Create `src/server/installation-id.ts`.
  - Modify `src/runtime/bootstrap.ts`, `src/app/home/bootstrap.server.ts`, and runtime bootstrap route tests.
  - Include `descriptorVersion`, durable `installationId`, `serverId`, origin, display name, runtime version, required capabilities, standalone support, and initial data ownership.
  - Verification: tests prove `/api/runtime/bootstrap` and SSR bootstrap include the descriptor; duplicate origin, same installation via tunnel, legacy no-installation-id fallback, missing capability, and unsupported descriptor version behave as specified.

- [ ] Phase 1: keep current single-server behavior passing after descriptor changes.
  - Run focused bootstrap/session/settings/event snapshot tests.
  - Verification: the served local app still loads without creating or selecting any extra server record manually.

- [ ] Phase 2: implement the selected-server transport with TDD.
  - Create `src/app/home/runtime-client.ts` and `src/app/home/server-health.ts`.
  - Update `src/runtime-api/types.ts`, `src/runtime-api/web.ts`, and `src/runtime-api/provider.tsx` only as needed for bootstrap descriptors and event-source option compatibility; do not route Home call-site migration through `RuntimeAPIs`.
  - Enforce URL normalization, allowed protocols, credentials, timeouts, aborts, error normalization, ownership-token checks, and `EventSource` option support for `{ withCredentials: true }`.
  - Verification: `pnpm test -- tests/app/home/runtime-client.test.ts` covers request URL building, raw fetch wrapping, credentials mode, timeout/cancellation, auth/offline/incompatible/unsupported-transport classification, event-source credentials, and stale generation rejection using an injected `RuntimeServerRef` provider.

- [ ] Phase 2: migrate audited runtime call sites to the selected-server transport.
  - Migrate `useHomeQueries`, `useHomeMutations`, `useQueuedMessageMutations`, `useConversationActions`, file viewer/pickers, attachments, notifications, project memory, git workspace, external sessions, model auth status, prewarm, pairing, events/log, and worker entries according to the audit table.
  - Leave only audited `local-shell-only` relative calls behind, with comments or helper names that make their ownership clear.
  - Verification: rerun the audit command and confirm all runtime-targeted browser calls use the selected-server transport.

- [ ] Phase 3: scope event snapshot cache by server while defaulting to the local server.
  - Modify `src/app/home/EventStreamSnapshotCacheManager.ts` and `src/app/home/EventStreamStateManager.ts`.
  - Preserve server-authoritative bootstrap behavior and existing scoped completeness merges.
  - Create/update `tests/app/home/multi-server-cache.test.ts`.
  - Verification: cache tests prove no cross-server hydration, corrupt localStorage recovery, and no demotion of `snapshotSource: "server"`.

- [ ] Phase 3: scope worker entry state and cache by server.
  - Modify `src/app/home/WorkerEntriesManager.ts`.
  - Keep the contiguous-prefix invariant, wake-up semantics, bounded cache, and `?afterSeq=`/tail/backfill flows.
  - Add worker-entry isolation cases to `tests/app/home/multi-server-cache.test.ts` or a focused worker manager test.
  - Verification: worker manager tests prove same `workerId` on two servers stays isolated and stale fetches cannot mutate the active server stream.

- [ ] Phase 3: route live event connections through the selected-server transport.
  - Modify `src/app/home/LiveEventConnectionManager.ts` and `src/app/home/useHomeLifecycle.ts`.
  - Carry `serverId + generation`, per-server `lastEventId`, snapshot anchor headers, fallback polling, resync behavior, and stale SSE generation fencing.
  - Verification: unit tests for URL construction/ownership plus lifecycle SSE scenario for reconnect/resync and stale-generation event drops.

- [ ] Phase 3: make query keys and bootstrap hydration server-aware.
  - Modify `src/app/home/HomeApp.tsx`, `src/app/home/useHomeQueries.ts`, and related extracted helpers.
  - Prime TanStack Query under `serverId` keys and clear or ignore previous-server queries on selection change without globally discarding useful caches.
  - Verification: tests or focused assertions prove `auth-session`, `settings`, `worker-catalog`, and `project-files` cannot be read across servers.

- [ ] Phase 3: make mutations server-aware and stale-safe.
  - Modify `src/app/home/useHomeMutations.ts`, `src/app/home/useQueuedMessageMutations.ts`, and supporting action helpers.
  - At mutation start, capture `serverId`, generation, selected run, composer draft, and attachments identity. On success/error, mutate UI only if ownership still matches.
  - Verification: stale mutation tests for create, send, stop, delete/archive, settings save, queued-message actions, composer clearing, attachment clearing, and navigation side effects.

- [ ] Phase 4: implement server directory storage and manager with TDD.
  - Create `src/app/home/server-directory-storage.ts` and `src/app/home/ServerDirectoryManager.ts`.
  - Cover add, update, remove, select, generation increment, last selected server, migration, malformed JSON recovery, invalid records, bootstrap auto-registration, installation-id duplicate handling, and bounded diagnostics records.
  - Verification: `pnpm test -- tests/app/home/ServerDirectoryManager.test.ts`.

- [ ] Phase 4: implement null-bootstrap standalone entry behavior.
  - Modify `src/ui/OmniApp.tsx`, `src/ui/render-web.tsx`, and `src/app/home/HomeApp.tsx`.
  - Let `HomeApp` render the server-directory empty state when bootstrap is null and no server is selected.
  - Render bootstrap descriptor data on first paint in served-local mode, then reconcile server-directory localStorage after mount to avoid hydration mismatch.
  - Verify selected run params, project params, and pair-token params do not crash before a server exists.
  - Verification: component/unit test mounts `OmniApp`/`HomeApp` with null bootstrap and proves the empty state renders without runtime queries firing.

- [ ] Phase 4: build the server selector and connection dialogs.
  - Create `src/components/home/ServerSelector.tsx` and `src/components/home/ServerConnectionDialog.tsx`.
  - Modify `src/components/home/HomeHeader.tsx` and mobile navigation wiring.
  - Use existing shadcn/ui controls; use lucide icons where appropriate; keep subscriptions narrow.
  - Verification: component tests where practical and Playwright screenshot/journey only with user approval.

- [ ] Phase 4: add the servers settings surface.
  - Create `src/components/settings/ServersSettingsPanel.tsx`.
  - Modify `src/components/home/SettingsDialog.tsx` or the active settings composition to include it.
  - Use compact rows, explicit save/remove/retry behavior, and no repeated headings or decorative nested cards.
  - Verification: i18n tests/static checks plus manual UI check if running browser verification is approved.

- [ ] Phase 4: add all i18n resources.
  - Modify every `shared/locales/*.json` file in the same change.
  - Add stable dotted keys for selector labels, statuses, validation, auth/offline/incompatible errors, add/edit/remove actions, retry, and settings copy.
  - Verification: JSON parse check and existing i18n/lint checks.

- [ ] Phase 5: implement explicit cross-origin runtime access policy.
  - Create `src/runtime/http/cors.ts`.
  - Modify runtime registry/server and auth/cookie routes to support configured standalone UI origins, preflight, credentialed requests, SSE credentials, and secure cross-site cookie mode for allowed HTTPS origins.
  - Keep same-origin defaults unchanged and reject arbitrary cross-site requests.
  - Document HTTPS-only constraints for cross-site cookie auth and authenticated SSE.
  - Verification: `pnpm test -- tests/runtime/cors-auth.test.ts` covers allowed origin, disallowed origin, preflight, protected login/session/logout, and SSE credentials.

- [ ] Phase 5: preserve error transparency with server context.
  - Modify `src/lib/app-errors.ts` and runtime-client error handling.
  - Preserve target server stable error codes, status, details, source/action, `serverId`, and origin.
  - Verification: tests cover server JSON error payloads, network failures, CORS-like fetch failures, auth failures, and malformed payloads.

- [ ] Phase 6: add lifecycle coverage for two real subprocess servers.
  - Create `tests/lifecycle/scenarios/multi-server-interface.test.ts`.
  - Use or extend `tests/lifecycle/harness/subprocess.ts` and `tests/lifecycle/harness/subprocess-runner.ts`; do not rely on the in-process harness for two-server isolation.
  - Launch two isolated subprocess servers with separate roots and route coverage for bootstrap, auth, events/log, worker entries, settings, conversations, and cleanup.
  - Assert on HTTP/SSE/event-log behavior rather than browser DOM for control-plane correctness.
  - Verification: targeted lifecycle scenario passes and cleanup leaves no test conversations/artifacts behind.

- [ ] Phase 6: run deterministic verification.
  - `pnpm test -- tests/app/home/ServerDirectoryManager.test.ts tests/app/home/runtime-client.test.ts tests/app/home/multi-server-cache.test.ts`
  - `pnpm test:lifecycle -- tests/lifecycle/scenarios/multi-server-interface.test.ts` if the script accepts file filtering; otherwise run the full `pnpm test:lifecycle`.
  - `pnpm lint`
  - `pnpm build`

- [ ] Phase 6: run approval-gated browser/user-journey verification if approved.
  - Proposed journeys: two-server switching, auth boundary, offline recovery, and mobile selector.
  - Use the already-running app process when possible and the normal local URL `http://localhost:3035`.
  - Clean up all test conversations and persisted artifacts before finishing.

## Self-Review

- Every runtime-owned query, mutation, cache, stream, and worker-entry fetch has a `serverId` owner token.
- Cached data can pre-render only for the same server and cannot satisfy authoritative load gates across servers.
- Late async responses and mutation results cannot mutate the active UI after server selection changes.
- Worker content remains in the unified worker stream; no parallel transcript store is introduced.
- Server-side decisions remain observable through target server named events.
- Auth, offline, incompatible, and degraded states are visible and server-scoped.
- The plan does not require branches, worktrees, file deletion, mocked servers, fake components, or fallback success.
- The checklist delivers the complete current milestone; future product ideas remain context only.
