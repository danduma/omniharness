# Common Runtime Multi-Surface Architecture

## Intent

OmniHarness should behave like one local supervision runtime with many thin
interfaces. The browser, standalone server, native shells, editor extensions,
and future surfaces should share runtime services and renderer contracts rather
than duplicating conversation, worker, event, settings, filesystem, or auth
behavior.

This follows the useful OpenChamber pattern:

- a shared runtime/server owns product behavior,
- a shared React renderer owns UI behavior,
- each shell supplies transport and native capabilities only.

## Implemented architecture

The split now includes:

- `src/runtime/index.ts`: runtime lifecycle handle with named events for start,
  stop, and start failure.
- `src/runtime/bootstrap.ts`: portable bootstrap builder shared by the Next page
  and `/api/runtime/bootstrap`.
- `src/runtime/http/registry.ts`: portable Fetch-style route registry.
- `src/runtime/http/context.ts`: common request context builder.
- `src/runtime/http/adapters/next.ts`: Next route adapter for portable handlers.
- `src/runtime/http/server.ts`: local Node HTTP server plus
  `startOmniServer(...)` runtime-backed handle. It can also serve staged
  renderer assets for shell packaging.
- `src/runtime-api/types.ts`: transport-neutral `RuntimeAPIs` contract covering
  auth, runs, conversations, workers, files, git, planning, settings,
  accounts, notifications, terminals, bootstrap, and events.
- `src/runtime-api/web.ts`: browser adapter over HTTP and EventSource.
- `src/runtime-api/electron.ts`: validated Electron IPC adapter; runner
  networking and bearer credentials remain in the main process.
- `src/runtime-api/capacitor.ts`: validated iOS/Android plugin adapter; runner
  networking, SSE, TLS pins, and credentials remain native.
- `src/runtime-api/vscode.ts`: VS Code webview adapter over `postMessage`.
- `src/runtime-api/provider.tsx`: React provider for injecting runtime APIs.
- `src/ui/OmniApp.tsx`: renderer root wrapping the existing Home app.
- `src/ui/render-web.tsx`: embeddable React renderer entry used by packaged
  shell builds.
- `apps/electron`: pure remote client. It serves packaged assets from
  `app://omniharness`, blocks renderer networking, and owns all runner
  HTTP/SSE, credential, and TLS operations.
- `apps/mobile`: Capacitor iOS/Android clients with URLSession/OkHttp streams,
  Keychain/Android-Keystore sessions, per-profile pinning, lifecycle cursor
  recovery, links, and local notifications.
- `apps/vscode`: remote extension with profile-scoped HTTP/SSE in the extension
  host, `SecretStorage` sessions, and editor actions.
- `src/runtime/http/routes`: migrated portable route handlers for bootstrap,
  auth/session/login/logout/pairing, settings, accounts, agents, model
  discovery, notifications, plans, project memory, planning review/promote,
  attachments, filesystem, git, conversations, messages, queued messages,
  worker entries, supervisor, run lifecycle mutations, run answer/resume,
  event-log diagnostics, and event snapshot/SSE streaming,
  mounted through the shared runtime route registry and used by the existing
  Next route files as thin adapters.

## Surface Responsibilities

Web/PWA:

- loads the Vite static interface served by a runner,
- receives escaped request bootstrap JSON injected into the HTML template,
- uses same-origin cookies for the serving runner and PKCE-approved bearer
  sessions for additional runners.

Standalone runtime server:

- starts an `OmniRuntime`,
- serves registered portable HTTP handlers,
- owns clean shutdown through the returned server handle.

VS Code:

- stores multiple runner profiles in `globalState`,
- owns profile-scoped HTTP and SSE in the extension host,
- keeps bearer material in `SecretStorage`,
- exposes editor capabilities through typed bridge messages.

Electron:

- never imports or starts runner code,
- loads the shared renderer from `app://omniharness`,
- blocks renderer HTTP/SSE and injects sessions only in main-process requests,
- stores credentials with `safeStorage` and pins per profile/origin.

iOS/Android:

- load the same `dist/interface` artifact through Capacitor,
- own URLSession/OkHttp requests and streams in native plugins,
- store bearer sessions in Keychain/Android Keystore,
- persist cursors on suspension and reconnect/resync on resume.

All profile-aware clients keep one main stream per authenticated runner while
their process is active. Only the active runner owns visible terminal streams.

## Route Inventory And Migration Order

Current route inventory:

| Route | Runtime owner / dependencies | Portable status |
| --- | --- | --- |
| `/api/runtime/bootstrap` | `buildRuntimeBootstrap` | Migrated |
| `/api/auth/session` | auth config/session/audit | Migrated |
| `/api/auth/login` | auth config/password/session/audit/rate-limit | Migrated |
| `/api/auth/logout` | auth guards/session/audit | Migrated |
| `/api/auth/pair` | auth config/guards/pairing/audit | Migrated |
| `/api/auth/pair/redeem` | auth config/pairing/session/audit | Migrated |
| `/api/settings` | settings table, crypto, project root canonicalization | Migrated |
| `/api/accounts` | accounts table | Migrated |
| `/api/agents` | bridge client/runtime worker snapshots | Migrated |
| `/api/agents/catalog` | agent catalog/configuration diagnostics | Migrated |
| `/api/agents/[name]` | bridge client/runtime worker detail/history | Migrated |
| `/api/llm-models` | model discovery | Migrated |
| `/api/codex-auth/status` | Codex auth reader | Migrated |
| `/api/notifications` | auth guards, notification preferences, web push | Migrated |
| `/api/projects/memory` | auth guards, memory tools, project settings, runs lookup | Migrated |
| `/api/plans` | plans table | Migrated |
| `/api/attachments` | auth guards, app-data storage, attachment metadata | Migrated |
| `/api/planning/[id]/review` | planning review orchestration, preferences, live updates | Migrated |
| `/api/planning/[id]/promote` | planning promotion, live updates | Migrated |
| `/api/fs` | auth guards, filesystem directory listing/scope checks | Migrated |
| `/api/fs/files` | auth guards, project file listing/read APIs | Migrated |
| `/api/git` | git status/workspace mutation, project config, run recovery | Migrated |
| `/api/conversations` | supervisor watchdog, conversation creation, attachments, git workspace policy | Migrated |
| `/api/conversations/[id]/messages` | send message, attachments, busy-message actions | Migrated |
| `/api/messages` | messages table compatibility path | Migrated |
| `/api/conversations/[id]/queued-messages/[messageId]` | queued message cancel/send-now | Migrated |
| `/api/runs/[id]` | run mutation/delete/archive/recovery, bridge cancellation, output compaction | Migrated |
| `/api/runs/[id]/answer` | clarification answer/resume, messages, live updates | Migrated |
| `/api/runs/[id]/resume` | supervisor resume, live updates | Migrated |
| `/api/workers/[workerId]/entries` | worker/run auth visibility, worker output stream | Migrated |
| `/api/supervisor` | credits, conversation creation, supervisor watchdog | Migrated |
| `/api/events/log` | named-event ring buffer diagnostics | Migrated |
| `/api/events` | database snapshot, live worker snapshots, bridge polling, SSE replay/resync | Migrated |

Routes should move gradually from Next-only handlers to portable handlers. Start
with low-risk read paths, then mutation paths, then lifecycle/streaming paths:

1. `/api/auth/session` - migrated
2. `/api/settings` - migrated
3. `/api/accounts` - migrated
4. `/api/agents` - migrated
5. `/api/agents/catalog` - migrated
6. `/api/agents/[name]` - migrated
7. `/api/llm-models` - migrated
8. `/api/codex-auth/status` - migrated
9. `/api/auth/login` - migrated
10. `/api/auth/logout` - migrated
11. `/api/notifications` - migrated
12. remaining auth pairing routes - migrated
13. project memory and plans - migrated
14. attachments - migrated
15. filesystem routes - migrated
16. git routes - migrated
17. conversations and messages - migrated
18. run lifecycle routes - migrated
19. worker entries - migrated
20. supervisor - migrated
21. event log - migrated
22. `/api/events` - migrated

`/api/events` migrated last because it carries SSE ids, replay,
`stream.resync_required`, snapshot markers, and lifecycle diagnostics.

## Direct Frontend Fetch/SSE Owners

The checked-in
`docs/architecture/runtime-api-migration-inventory.md` is the source of truth
for every remaining compatibility caller and its target domain method.
`RuntimeAPIs` now has one injectable request/stream boundary for the full
domain surface, including abort propagation, redirect refusal, normalized
errors, multipart upload, binary responses, and browser or validated-host SSE.

Existing home Managers and hooks are migrated in Task 12. Until that migration
finishes, new interface work must not add direct `fetch`, `EventSource`,
absolute API construction, Electron IPC, or VS Code messages. It must extend a
typed domain adapter first.

## Large File Split Risks

Files at or above roughly 1200 lines need split planning before major new
behavior lands:

- `src/server/supervisor/index.ts`
- `src/components/Terminal.tsx`
- `src/server/agent-runtime/manager.ts`
- `src/app/home/utils.ts`

Near-threshold files that should not absorb unrelated behavior:

- `src/server/supervisor/observer.ts`
- `src/components/home/ConversationMain.tsx`
- `src/server/workers/output-store.ts`
- `src/app/home/HomeApp.tsx`
- `src/app/home/useHomeMutations.ts`
- `src/app/api/events/route.ts`

## Observability Rules

Runtime and server-side shell decisions must emit typed named events with
`emitNamedEvent`. User-visible failures must also surface through
`error.surfaced` with stable codes. SSE behavior must preserve:

- `id:` on event frames,
- `Last-Event-ID`/`lastEventId` resume,
- `/api/events?snapshot=1` bootstrap,
- `stream.resync_required`,
- `/api/events/log` diagnostics.

## File Size Watch List

Files already large enough to split before adding major new behavior:

- `src/app/api/events/route.ts`
- `src/app/home/HomeApp.tsx`

Do not add parallel persistence for worker streams, conversations, messages,
queued messages, plans, validation records, or events.
