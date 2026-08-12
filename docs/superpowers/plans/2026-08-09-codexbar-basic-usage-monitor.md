# CodexBar Basic Usage Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the basic CodexBar job to OmniHarness: show account-scoped Codex and Claude quota windows, usage percentages, reset times, credits when available, refresh freshness, and honest authentication/error states in the existing OmniHarness control plane.

**Architecture:** Build a server-owned quota refresh service behind a provider-descriptor boundary. The service resolves each account through OmniHarness’s existing credential isolation, fetches only non-interactive local/API sources for Codex and Claude, normalizes provider responses into durable quota-window snapshots, and exposes a small runtime API. The interface consumes those snapshots through a dedicated manager, a compact header summary, and a focused Usage settings panel.

**Revision status:** This plan has been iteratively hardened against repository review. Implementation is gated on the feasibility, schema-readiness, runner-ownership, event-delivery, and operation-reconciliation checks in Task 0 and the contracts below.

**Tech Stack:** TypeScript, Node runner, SQLite/Drizzle schema helpers, existing runtime HTTP registry, named SSE events, React 19, `StateManager`, existing shadcn/ui primitives, Vitest, and Playwright approval-gated journey coverage.

**North Star Product:** OmniHarness becomes the trustworthy control plane for agent capacity across local and remote runners: a user can glance at every provider/account’s current headroom, understand when a long task can start, and see exactly why a value is stale, unavailable, or blocked.

**Current Milestone:** Implement a web/packaged-interface Usage surface for Codex and, subject to the Task 0 feasibility decision, Claude accounts using existing local sessions, isolated CLI homes, credential profiles, and direct OAuth-backed usage endpoints where credentials are already available. The selected branch may be full Claude support, credential-present-only Claude support, or Codex-only with an honest Claude inventory state. Include session/five-hour and weekly windows, reset countdowns, optional credits, manual refresh, fixed background refresh, persistence, and transparent failure states.

**Future Product Direction:** The provider boundary should make additional providers, browser-cookie sources, API spend/cost history, status-page incidents, notifications, CLI JSON output, widgets, and a native macOS menu-bar surface possible without changing the normalized snapshot contract. Those capabilities are context only and are not part of this milestone.

**Final Functionality Standard:** The milestone is complete only when a real configured Codex account and every provider included by the selected Task 0 branch can be refreshed end-to-end, each included provider response is parsed into durable snapshots, the interface renders loading/available/stale/auth-required/error/empty states, refresh races cannot overwrite newer data, secrets never cross the API/event boundary, and the server decisions are observable through named events and tests. A provider excluded by the selected branch must remain explicitly unavailable or credential-required rather than being presented as supported.

---

## Investigation findings

CodexBar’s basic product loop is smaller than its current provider catalog:

- A background refresh runs provider-specific fetch strategies and writes a shared usage snapshot.
- Each provider exposes normalized quota lanes such as session and weekly, with used percentage and reset time.
- A compact status surface is backed by a richer detail view, with manual refresh and stale/error indicators.
- Provider credentials are reused from existing OAuth/CLI/browser sources rather than asking CodexBar to own passwords.
- Provider-specific failures are retained and shown instead of being converted into an empty or falsely healthy card.
- The full project now has 69 providers, optional web scraping, local cost scans, status polling, widgets, CLI output, notifications, and a native menu-bar app. Those are not required to deliver the basic monitor.

CodexBar’s documented initial source paths are directly relevant to this repository:

- Codex: `codex app-server` JSON-RPC with `account/read` and `account/rateLimits/read`, producing primary/secondary usage windows, reset timestamps, and optional credits.
- Claude: OAuth usage endpoint when an existing Claude credential file is readable, with CLI/web fallbacks in the full product. The first OmniHarness implementation should avoid interactive PTY and browser-cookie scraping in background refreshes.

OmniHarness already provides the integration seams needed for a first implementation:

- `accounts`, `accountSecrets`, `workerCredentialAllocations`, `workerTokenUsage`, and `accountUsageSnapshots` already model account ownership and some usage persistence.
- `resolveAccountCredentials` already maps account auth modes to isolated `CODEX_HOME`, `CLAUDE_CONFIG_DIR`, credential profiles, and API-key environments.
- `src/server/quota/reset-parser.ts` and quota recovery already normalize reset times from runtime failures.
- `src/runtime/http/routes/accounts.ts` already provides authenticated account CRUD and a status endpoint, but the current status refresh only stores a caller-supplied status and does not fetch usage.
- The runner lifecycle in `src/server/runner/run.ts`, named-event ring buffer, SSE replay/resync, and `StateManager`-based interface managers provide the right lifecycle and synchronization patterns.
- The existing Agents settings panel and settings dialog can host the first Usage surface without introducing a second application shell.
- `PRODUCT.md` establishes a calm, dense, explicit product register; `DESIGN.md` is absent, so the implementation should preserve the existing shadcn vocabulary and avoid decorative dashboard chrome.

## Scope and assumptions

The plan assumes “implement the basic functionality” means adapting CodexBar’s capacity-monitoring job to OmniHarness’s existing web and packaged interfaces, not cloning the Swift/macOS application. The implementation will not create a separate native status-item process in this milestone. Electron and other runtime surfaces will receive the shared API contract, while the initial UI is the existing interface used by the web and packaged app.

In scope:

- Codex and Claude provider descriptors and fetchers.
- Existing account inventory and credential-isolation paths.
- Session/five-hour and weekly quota windows, reset timestamps/countdowns, optional credits, account labels, source, freshness, and errors.
- A fixed five-minute background refresh plus explicit manual refresh.
- Durable current snapshots, deterministic ordering, and last-known-good retention on refresh failure.
- Authenticated `GET` and manual-refresh API routes.
- A compact header summary and a full Usage tab inside Settings.
- i18n for every new visible string in every locale file under `shared/locales/*.json`.
- Named server events, error surfacing, unit/API tests, and a proposed approval-gated UI journey test.

Explicitly out of scope for this milestone:

- Browser cookie import, hidden WebViews, Full Disk Access, Keychain browser decryption, or manual cookie headers.
- The remaining CodexBar provider catalog, OpenAI Admin API spend, Claude organization spend, local cost-history scans, charts, widgets, CLI commands, hook automation, notifications, and status-page polling.
- Interactive login repair and a new quota-specific OAuth token store are out of scope. Claude quota reads must reuse the existing account credential path, including any non-interactive credential-refresh capability that account setup/worker authentication already owns; the quota manager must not invent a second refresh-token persistence path. If an account has no currently usable credential after that existing path, report `login_required` with a remediation path through account setup rather than retrying indefinitely. Claude end-to-end acceptance therefore includes verifying the repository’s existing credential path can supply a current access token; otherwise the implementation must surface that limitation before claiming Claude support complete.
- Cross-runner aggregation. Each runner remains the authority for its own configured accounts; runner switching already scopes the interface connection.

## User stories and product completeness

- **Glance before starting work:** A developer opens OmniHarness and sees the most constrained enabled account’s current headroom and next reset without opening a long conversation.
- **Inspect capacity:** The Usage tab lists Codex and Claude accounts with session/five-hour and weekly lanes, reset times, credits if returned, source, and last successful refresh.
- **Refresh deliberately:** The user can refresh one account or all visible accounts and sees a distinct refreshing state, not a frozen or optimistic number.
- **Return after failure:** When a provider is offline or credentials expire, the last successful values remain visible with a stale/error badge, timestamp, and actionable reason.
- **Understand absence:** An account with no supported local credential is shown as unconfigured/login-required rather than silently omitted; no configured accounts has an explanatory empty state.
- **Keep account boundaries:** Multiple accounts are ordered by account priority, then label/id, and each snapshot is keyed to the account that produced it. No response may merge credentials or usage between accounts.

Legal UI states are `empty`, `loading`, `refreshing`, `available`, `stale`, `login_required`, `unavailable`, and `error`. `available`, `stale`, `login_required`, `unavailable`, and `error` are terminal states for one refresh attempt; a later explicit or scheduled refresh starts a new attempt. A row with stale data must never be classified as currently available without its stale marker.

## Approach options

1. **Native CodexBar-style macOS status item:** Port or reimplement the Swift menu-bar app and share data with OmniHarness. This is the closest visual clone but introduces a new native product, packaging path, credential boundary, and synchronization problem before OmniHarness has a provider data contract.
2. **Server-backed OmniHarness Usage surface (recommended):** Put the provider adapters and durable snapshots in the runner, expose a small authenticated runtime API, and reuse the existing web/packaged interface. This aligns with the current control-plane architecture, works for remote runners, and lets Electron/mobile/VS Code consume the same data later.
3. **Client-only CLI polling:** Have the browser invoke local CLIs or inspect local files directly. This fails for remote runners, exposes credential and filesystem concerns to the client, and cannot provide durable status when no tab is open.

The plan chooses option 2. Provider fetchers remain isolated behind a descriptor interface so the core service can later back a CLI or native surface without moving credential handling into the UI.

## File map

### Files to create

- `src/server/quota/types.ts`: normalized quota windows, account-level `enabled`/availability, credits, provider refresh results, refresh state, and public snapshot contracts. Define provider status separately from derived freshness; import the shared usage timing/concurrency constants rather than defining server-only values.
- `src/server/quota/provider-registry.ts`: descriptor registry for `codex` and `claude`, supported source metadata, display order, and provider capability flags.
- `src/server/quota/provider-fetch.ts`: bounded, non-interactive command/HTTP helpers with abort and output limits; never log environment values, headers, or raw provider payloads.
- `src/server/quota/providers/codex.ts`: account-scoped Codex app-server JSON-RPC client and parser for identity, primary/secondary windows, reset timestamps, and credits.
- `src/server/quota/providers/claude.ts`: account-scoped Claude OAuth credential reader and usage endpoint client/parser for five-hour/weekly windows and optional credits; return `login_required` for unreadable/expired credentials.
- `src/server/quota/store.ts`: transactional persistence and read-model assembly for current account quota rows plus one account-level refresh-state row per account, including last-known-good data and refresh errors.
- `src/server/quota/operation-store.ts`: durable, bounded operation ledger for accepted refresh requests, effective/coalesced operation ids, terminal status, scope, alias relationships, and runner-restart reconciliation; prune by age/count and never store provider payloads or secrets.
- `src/server/accounts/account-store.ts`: centralize account lifecycle mutations and quota-row cleanup; HTTP routes invoke this service rather than owning provider/account deletion semantics. It is the sole writer of `accountCredentialGeneration`, and it has an explicit degraded path when quota schema readiness is false.
- `src/server/quota/refresh-manager.ts`: one runner-owned background manager with fixed cadence, manual refresh coalescing, per-account ownership tokens, startup/shutdown handling, and named-event emission.
- `src/server/quota/dto.ts`: secret-free API serialization and deterministic provider/account/window ordering.
- `src/runtime/http/routes/usage.ts`: authenticated `GET /api/usage` and authenticated `POST /api/usage/refresh` handlers using the existing mutation transport rules; return the stable `quota.subsystem_unavailable` 503 contract when quota schema bootstrap has failed closed.
- `src/runtime/http/routes/usage-operations.ts`: authenticated operation-status reads used to close the POST/SSE completion race and report runner-restart abandonment without exposing diagnostics or secrets.
- `src/interface/home/UsageManager.ts`: client single source of truth for bootstrap, refresh, polling, event freshness, stale-response guards, server/client clock offset, and the display ticker that re-derives age/reset freshness between server fetches.
- `src/shared/usage-freshness.ts`: pure shared derivation of age/reset freshness from server facts and adjusted time; time-derived freshness is never persisted.
- `src/lib/formatters/usage.ts`: locale-aware percent, absolute-time, and countdown formatting built on `Intl`; return formatted values/data for translated UI boundaries and clamp expired countdowns at zero.
- `src/components/home/UsageSummaryButton.tsx`: compact header summary using the existing button/popover/dropdown vocabulary.
- `src/components/settings/UsageSettingsPanel.tsx`: detailed responsive account/window table or compact stacked rows, refresh controls, and state-specific empty/loading/error UI.
- `tests/server/quota/provider-fetch.test.ts`: timeout, abort, bounded output, redaction, and non-interactive command tests.
- `tests/server/quota/providers/codex.test.ts`: JSON-RPC framing and provider payload fixtures.
- `tests/server/quota/providers/claude.test.ts`: credential resolution, request headers, payload mapping, and auth/error fixtures.
- `tests/server/quota/store.test.ts`: upsert, deterministic ordering, last-known-good retention, stale marking, completeness behavior, account removal, provider reconfiguration, disabled-account filtering, an in-flight success rejected after account/provider-generation deletion, and typed-schema/bootstrap-DDL column/index/unique-constraint parity via SQLite pragmas.
- `tests/shared/usage-freshness.test.ts`: boundary tests for current, age-stale, reset-pending-refresh, preserved, unknown, and clock-skew cases using the shared pure derivation.
- `tests/server/quota/operation-store.test.ts`: effective-operation aliases, full-scope terminal inheritance, durable restart recovery, bounded pruning, and operation-id redaction.
- `docs/superpowers/decisions/2026-08-09-codexbar-basic-usage-monitor-feasibility.md`: Task 0’s persisted Claude/Codex feasibility decision and selected acceptance branch; this is a required implementation artifact, not an optional note.
- `tests/server/quota/refresh-manager.test.ts`: cadence, coalescing including broad/narrow dual completion, per-account isolation, shutdown, stale refresh-generation tests, no-op cycle event bounds, restart-seeded backoff/skip eligibility, backoff precedence, and credential-restored retry.
- `tests/api/usage-route.test.ts`: existing account-mutation auth/CSRF parity, response shape, refresh behavior, fail-closed 503 behavior with `quota.subsystem_unavailable`, error transparency, secret redaction, and an assertion that every operation id returned by `POST /api/usage/refresh` receives one matching cycle-completed event.
- `tests/api/usage-operation-route.test.ts`: operation-status reads, completion-before-client-listener reconciliation, coalesced/effective operation ids, deadline, stopped, and runner-restart terminal outcomes.
- `tests/runtime-api/usage-adapters.test.ts`: shared web/Electron/VS Code/Capacitor transport mutation behavior using each adapter’s existing session/auth mechanism.
- `tests/app/usage-manager.test.ts`: stale async responses, timer ownership, loading stages, partial snapshot safety, event-to-fetch operation correlation (including coalesced effective ids), abandoned-operation timeout recovery, display-ticker age/reset freshness, server/client clock skew, fallback polling and reconnect-stops-polling behavior, header constraint selection, locale formatting, and error transitions.
- `tests/app/usage-runner-scope.test.ts`: two-runner ownership, profile switching, inactive-runner events, and manager teardown/rebuild without cross-runner snapshot application.
- `tests/app/usage-settings-panel.test.tsx`: visible states, accessible controls, and deterministic ordering.
- `tests/lifecycle/scenarios/usage-refresh-restart.test.ts`: lifecycle scenario for mandatory non-blocking startup refresh and refresh state across runner stop/restart, including child/timer cleanup and durable snapshot rebuild.
- `tests/e2e/usage-quota.spec.ts`: approval-gated black-box journey candidate, not to be run without explicit user approval.
- `tests/runtime-api/usage-event-delivery.test.ts`: exact named-event delivery through the shared stream normalizer and every runtime adapter, including replay/resync cursor handling.

### Files to modify

- `src/server/db/schema.ts`: add a semantically correct current-quota snapshot table rather than overloading token-only `accountUsageSnapshots`; add a one-row-per-account refresh-state table for `backoffUntil`/skip metadata; add a bounded quota refresh-operation table for accepted/terminal operation facts with immutable scope identifiers and no live-account foreign key; add a one-row quota read-model metadata table for `quotaSchemaVersion` and monotonic `snapshotRevision`; add a persisted `accountCredentialGeneration` on accounts, a uniqueness constraint for `(accountId, windowKey)`, and indexes for account/provider reads. The credential generation and revision are internal and never enter public DTOs except the safe revision number.
- `src/server/db/index.ts`: keep core `dbReady` and quota readiness as separate phases. The existing core schema migration, including an explicit idempotent `ALTER TABLE accounts ADD COLUMN account_credential_generation integer NOT NULL DEFAULT 0` backfill, remains fatal before runner readiness; quota tables/indexes and quota refresh-state bootstrap run afterward and fail closed without stopping a healthy core runner. Add schema-version and partial-migration coverage.
- `src/runtime/http/routes/accounts.ts`: invoke the account store for deletion/provider-auth reconfiguration and emit the resulting lifecycle/invalidation events; it does not own quota cleanup directly.
- `src/server/accounts/dto.ts`: keep account DTOs secret-free; do not put full quota data into the account list response. If a compact summary is added, use a separate explicit field and document its freshness.
- `src/server/supervisor/codex-auth.ts` and/or `src/server/agent-runtime/external-credentials.ts`: extract/reuse read-only account-scoped credential resolution helpers instead of duplicating auth paths. No helper may return credentials to a DTO, event, or client.
- `src/server/events/named-events.ts`: add typed `quota.schema_bootstrap_failed`, `account.quota_refresh_cycle_started`, `account.quota_refresh_cycle_completed`, `account.quota_refresh_cycle_terminated`, `account.quota_refresh_cycle_skipped`, `account.quota_refresh_requested`, `account.quota_refresh_rejected`, `account.quota_refresh_coalesced`, `account.quota_rows_invalidated`, `account.quota_reconciliation_needed`, `account.quota_state_changed`, `account.quota_refresh_failed`, and `account.quota_refresh_skipped` events, plus `error.surfaced` payloads with operation/account/provider subjects and stable error codes. Emit one cycle-level pair per effective execution operation; aliases emit request/coalesced events and point to the effective operation record. Emit cycle-skipped once per timer-overlap episode; emit account events only when persisted payload/provider status, preserved-value state, backoff, or account enabled/provider identity changes. Age-stale and reset-pending transitions are client-local ticker derivations and never generate server events. Emit account refresh-skipped only when the skip state changes. The cycle-completed aggregate is the agreed typed record for routine non-transition account decisions; termination is the terminal event for deadline/stop/restart/deletion. Per-account events are reserved for state changes and user-relevant failures to protect the shared ring buffer. Its payload includes attempted/skipped/changed/failed counts and per-reason breakdowns.
- `src/server/runner/run.ts`: construct, start, and stop exactly one `QuotaRefreshManager` per runner after database readiness; make startup refresh non-blocking and emit start/failure decisions.
- `src/runtime/http/routes/index.ts`: register the usage routes.
- `src/runtime-api/domains/index.ts` and `src/runtime-api/types.ts`: expose `usage.load` and `usage.refresh` in the shared runtime API used by web, Electron, VS Code, and Capacitor adapters.
- `src/shared/home-types.ts`: add public usage DTOs, account-level `enabled`/availability and status/window types plus shared constants: `USAGE_REFRESH_CADENCE_MS = 300_000`, `USAGE_STALE_AFTER_MS = 2 * USAGE_REFRESH_CADENCE_MS`, `USAGE_REFRESH_ALL_CONCURRENCY = 4`, `USAGE_FALLBACK_POLL_MS = 15_000`, and `USAGE_CYCLE_DEADLINE_MS = 60_000`.
- `src/interface/home/useHomeLifecycle.ts` or the appropriate home bootstrap wiring: hydrate and start/stop `UsageManager` without coupling it to selected conversation state.
- `src/interface/home/HomeApp.tsx`: configure the manager, open the Usage tab, and pass narrow usage selectors to the header/settings surfaces.
- `src/components/home/HomeHeader.tsx`: place the compact usage summary at the existing top-bar density and keep it hidden or disabled when there are no visible accounts.
- `src/components/settings/SettingsDialog.tsx`: add the Usage tab without duplicating headings or explanatory chrome; preserve existing Save/Cancel semantics for unrelated settings.
- `shared/locales/*.json`: add all Usage labels, statuses, aria labels, reset copy, freshness copy, source labels, error/remediation copy, and empty/loading text to every locale file present at implementation time; the glob, not a hard-coded list, is authoritative.
- `src/runtime-api/web.ts`, `src/runtime-api/electron.ts`, `src/runtime-api/vscode.ts`, `src/runtime-api/capacitor.ts`, and `src/runtime-api/legacy-live-events.ts`: register the usage invalidation event types wherever the shared event adapter requires explicit knowledge of custom events. The first UI need not add native-specific rendering.
- `src/runtime-api/stream.ts`: normalize every named SSE event as `{ kind, payload, lastEventId }` instead of returning raw payloads for unlisted kinds; preserve the explicit resync shape.
- `src/interface/home/LiveEventConnectionManager.ts` and `src/interface/runners/RunnerConnection.ts`: fan out quota events from the existing per-runner main stream to the runner-scoped UsageManager; do not open a second main event stream from the UsageManager.
- `src/components/ui/*` only when an existing primitive is missing; use existing `Button`, `Badge`, `Card`, `DropdownMenu`, `Skeleton`, `Table`, `Tooltip`, and `Separator` primitives before adding controls.

### Tests and integration paths to preserve

- The existing account route and schema tests must continue to prove auth references are not serialized.
- The existing quota recovery/parser tests remain authoritative for runtime error-derived reset parsing; the new provider parsers must not silently fork those semantics.
- `GET /api/events/log?since=<id>&runId=<id>` must expose the new named refresh decisions for triage.
- The runner lifecycle must not leave a refresh timer or child `codex app-server` process alive after stop.
- Existing initialized database files must acquire the quota table and indexes on upgrade without a manual migration command.

## Early feasibility gate

Before building the shared UI contract, verify the existing account setup/worker-auth path can supply a usable Claude OAuth access token from the account-scoped credential location, including its already-supported non-interactive refresh behavior if one exists. If it cannot, keep the provider adapter and honest `login_required` state but explicitly downgrade Claude’s milestone acceptance to “credential-present accounts only” before proceeding with UI and locale work; do not discover this scope change after the surface is built. This is a hard gate: record the result in the plan’s implementation notes and update the Current Milestone, Final Functionality Standard, and Final Checklist before any later task is considered executable.

## Readiness and ownership gates

- **Dirty-worktree overlap:** Task 0 must classify every pre-existing modification that overlaps the file map, especially `HomeApp.tsx`, `useHomeLifecycle.ts`, runtime API files, `named-events.ts`, `run.ts`, `home-types.ts`, database files, and `src/server/quota/*`. If ownership cannot be distinguished from the baseline, stop and ask the owner; do not overwrite or fold unrelated changes into this feature.
- **Schema readiness:** Core database readiness and quota-subsystem readiness are separate. Core account compatibility migrations complete before `dbReady`; quota tables, indexes, and manager startup are conditional on a separate quota bootstrap result. A quota bootstrap failure leaves the core runner serving existing features, emits the required failure events, and makes usage reads return `503 quota.subsystem_unavailable`.
- **Revision ownership:** One runner-scoped `snapshotRevision` covers every fact that can change `GET /api/usage`: quota rows, account label/priority/enabled/provider identity, account generation, operation-visible refresh state, and reconciliation. When quota schema is ready, account-store mutations and quota-store mutations increment it in the same transaction; while quota schema is unavailable, usage is 503 and the next reconciliation increments it before the first successful read. Equal revisions must represent equivalent payload facts; the client keeps the first authoritative payload for an equal revision and emits a diagnostic conflict event if the serialized safe payload differs.
- **Degraded account mutations:** Account create/update/delete/auth changes remain available when `quotaSchemaReady=false`. The account store commits the core account change and generation/provider identity, skips quota-table writes, and emits the normal account event plus a quota-reconciliation-needed event. The next successful quota bootstrap reconciles all quota rows against live account identity, provider, enabled state, and generation before serving them; no pre-bootstrap row is trusted as current.
- **Runner ownership:** There is one UsageManager per `RunnerConnection`/runner profile, not one process-global client manager. It is created, hydrated, subscribed, and stopped with that runner connection. Switching profiles fences old callbacks and replaces visible usage only after the new runner’s authoritative read.
- **Single stream:** UsageManager consumes quota events from the existing per-runner main stream. It must not open another `/api/events` stream. The event delivery test must exercise the real adapter → normalizer → `LiveEventConnectionManager`/`RunnerConnection` fanout path.
- **Operation reconciliation:** Every accepted operation is recorded before the `202` response is returned. The client performs an immediate authoritative read after acceptance and may query operation status; it never relies on registering an SSE listener before completion. The operation ledger is bounded, secret-free, and returns a deterministic terminal result for completion, deadline, stop, rejection, or runner restart.
- **Rejected operations:** Authenticated, well-formed requests that are rejected after validation receive a durable `requestId`, a stable non-2xx response, and an operation-status record with `effectiveOperationId: null`; they emit `account.quota_refresh_rejected` and never emit a cycle or termination event. Unauthenticated or malformed requests rejected before operation parsing need not create an operation record.

## Data and state design

### Normalized server contract

Use a provider-neutral snapshot with these semantics:

```ts
type QuotaWindow = {
  key: string;                 // stable provider/window id, e.g. session or weekly
  labelKey: string;            // translated at render time
  usedPercent: number | null;  // 0..100, never a fabricated estimate
  resetAt: string | null;
  remainingValue: number | null;
  limitValue: number | null;
  unit: "percent" | "credits" | "tokens";
  sourceKey: string;          // allowlisted descriptor key, translated at render time
  status: "available" | "unknown" | "login_required" | "unavailable" | "error";
  freshness: "current" | "age_stale" | "reset_pending_refresh" | "stale_preserved" | "unknown"; // derived, never persisted
};

type QuotaAccountSnapshot = {
  accountId: string;
  provider: "codex" | "claude";
  label: string;
  enabled: boolean;
  availability: "configured" | "disabled" | "login_required" | "unavailable" | "error";
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  staleAfterMs: number;
  windows: QuotaWindow[];
};
```

`labelKey` and `sourceKey` are allowlisted translation keys emitted by the provider descriptor, never provider-supplied copy. The UI maps an unknown/missing label or source key to a generic translated fallback, and a contract test enumerates `shared/locales/*.json` at runtime to assert every registry key exists in every locale. Stable `errorCode` values use the same allowlist/fallback rule. `errorMessage` is diagnostic-only for server logs and the dev event log; it is never rendered in the UI or returned in the public DTO.

The internal account snapshot carries `accountId`, provider, worker type, display label, `enabled`, account availability, optional plan label, `lastAttemptAt`, `lastSuccessAt`, `resetAt`, provider status, preserved-value state, `errorCode`, diagnostic `errorMessage`, and `refreshGeneration`. The public DTO carries only safe display metadata, translated-key ids, stable error codes, fact timestamps (`lastAttemptAt`, `lastSuccessAt`, `staleAfterMs`, and each window’s `resetAt`), the explicit account enabled/availability fields, and a monotonic `snapshotRevision`. It never includes `authRef`, diagnostic error text, secret values, raw headers, raw provider JSON, filesystem credential paths, or token/account identifiers that are not already safe display metadata. `deriveQuotaFreshness` in `src/shared/usage-freshness.ts` is the shared authority: a provider failure or preserved value yields `stale_preserved` when a prior usable value exists and `unknown` otherwise; an elapsed unconfirmed reset then yields `reset_pending_refresh`; otherwise age beyond `lastSuccessAt + staleAfterMs` yields `age_stale`; otherwise the row is `current`; rows with no successful data are `unknown`. The server includes this derived value for bootstrap display, while the client may advance it locally from the same facts; neither time-derived state is stored in SQLite. Every committed quota read-model change increments `snapshotRevision` transactionally; the client rejects an older revision even if its request, event, or timestamp arrives later.

The quota snapshot table stores one current row per account/window and retains last-known-good values when a refresh fails. A separate one-row-per-account refresh-state record stores `backoffUntil`, skip reason, and last error code; `accounts.accountCredentialGeneration` is the sole generation authority and is read in the same transaction as quota replacement. A failed refresh updates attempt/error metadata and preserves the last-known-good values; it does not zero usage or replace a real reset timestamp with an invented value. A successful provider response declares its window completeness. Replacement is transactional and deterministic, and rows absent from a complete response become unavailable rather than silently surviving as current data. A durable bounded operation record stores accepted scope, effective operation id, terminal status, and safe counts; operation status changes that are visible in `GET /api/usage` advance `snapshotRevision` in the same transaction. In-flight records are marked `runner_restarted` during startup recovery. The shared freshness function derives time-dependent presentation state from these persisted facts for both server DTOs and the client ticker.

### Preserved-data transition contract

The following table is the canonical persisted-row and public-DTO behavior. `snapshotRevision` advances for every committed change; time-only ticker derivation does not advance it.

| Provider result or account change | Persisted facts | Public status/freshness |
|---|---|---|
| complete success | replace declared windows, update `lastSuccessAt`, clear error/backoff, mark omitted windows unavailable | `available` + derived current/age-stale |
| partial success | replace returned windows, preserve last-known-good values for omitted windows, record incomplete result | returned rows available; preserved rows `stale_preserved` |
| malformed/contract-changed | preserve prior values, update attempt/error code, no fabricated usage/reset | prior rows with `error` + `stale_preserved` |
| unauthorized/expired credential | preserve prior values, record `login_required`, set retry skip | `login_required` + preserved freshness when values exist |
| timeout/rate-limit/provider unavailable | preserve prior values, record safe error and backoff | `error`/`unavailable` + preserved freshness when values exist |
| reset elapsed without a successful post-reset read | preserve facts and reset timestamp | derived `reset_pending_refresh`, countdown clamped to zero |
| credential/provider configuration changed | increment account generation, invalidate affected rows, clear retry skip in one transaction | rows `unavailable`/`login_required` until a new attempt |
| account disabled | retain rows for inspection, exclude from probes | account `enabled=false` plus translated `unavailable`/disabled reason; preserved windows remain visibly preserved |
| account deleted | delete live quota rows and refresh state transactionally; retain bounded operation records independently and mark affected operations `account_deleted` | account absent; late results rejected by generation/account check |

### Ownership and synchronization invariants

- The runner and quota store are authoritative for persisted usage. The client manager is authoritative only for its current view of the API payload and its local refresh lifecycle.
- Every refresh attempt has a manager generation plus account id/provider token. A timer or manual response may update state only if it still owns that generation and the manager is active.
- Manual refreshes coalesce with an in-flight refresh for the same account and never launch concurrent provider probes for that account. A refresh-all operation has a separate operation id and bounded concurrency.
- `GET /api/usage` is a read of the last durable snapshot. It declares `generatedAt`, `complete`, and per-account freshness so the UI cannot treat a partial or stale payload as fully current.
- Provider/account/window ordering is provider registry order, account priority descending, then label/id, with stable window order from the descriptor. Timestamp-only “latest” queries are forbidden.
- The UI distinguishes initial bootstrap, background refresh, manual refresh, reconnect/resync, stale data, and terminal provider errors. A background refresh must not unmount the settings dialog or reset unrelated conversation state.
- A row is stale by age when the current time is later than `lastSuccessAt + staleAfterMs`, where `staleAfterMs = 2 * refreshCadenceMs` and the fixed five-minute cadence makes the current threshold 10 minutes; the store/DTO and client display ticker use the same constant. If `resetAt` has elapsed but no successful refresh after that timestamp has confirmed the new window, the renderer derives a `reset_pending_refresh` freshness state, clamps the countdown to zero, and uses translated “reset pending refresh” copy; it must not show the row as confidently current.
- The current runner’s usage is not merged with another runner’s usage. The runtime profile/runner connection is the ownership scope, and switching runners replaces the manager’s payload only after the new runner’s response is authoritative.

### Refresh operation transition matrix

The manager and operation ledger must implement this matrix before provider wiring. Each accepted request has a request id and an `effectiveOperationId`; the effective id is returned to the client. A coalesced request aliases the effective operation and inherits its complete terminal condition. Only the effective execution operation emits the cycle-level start/completed pair; the alias is observable through the request/coalesced event and operation-status record.

| Incoming intent | Existing work | Decision | Provider probes | Terminal condition |
|---|---|---|---|---|
| timer/all | idle | create timer operation | all eligible accounts, bounded concurrency | every requested account is attempted or skipped |
| account A | same-account probe running | coalesce onto existing operation | no duplicate A probe | existing probe reaches terminal state |
| all | narrower operation running | create broad operation and await included probes | remaining eligible accounts only | full broad scope reaches terminal state |
| account A | broad operation running and A incomplete | coalesce onto broad operation | no duplicate A probe | broad operation’s full requested scope reaches terminal state |
| account A | broad operation running and A complete | queue a fresh account operation | one new A probe after the broad probe | fresh A probe reaches terminal state |
| timer | any cycle running | emit one overlap-skip episode event | none | blocking cycle completes, ending the episode |
| any accepted operation | deadline reached | abort remaining probes and complete partially | only probes already terminal count as complete | terminal status `deadline` |
| any operation | runner stop/restart | fence callbacks and mark operation stopped/restarted | no post-stop writes | terminal status is inspectable through the operation route |

The tests must assert operation ownership, counts, event ids, alias/effective-id relationships, and the absence of duplicate provider probes for every row. Every accepted effective operation has exactly one terminal operation record and exactly one mapped terminal event; aliases never claim an earlier account-local completion.

Accepted-operation terminal mapping is fixed: normal complete/partial/empty-scope results emit `account.quota_refresh_cycle_completed`; deadline, explicit stop, runner restart, and account deletion emit `account.quota_refresh_cycle_terminated` with the corresponding terminal status; rejected requests emit only `account.quota_refresh_rejected` and have no cycle terminal event. Recovery-time termination events include the durable operation id, immutable scope labels/counts, and safe reason, but never require the deleted account row to exist.

## Implementation tasks

### Implementation checkpoints

The work is intentionally staged so later layers do not hide contract failures in earlier layers:

1. **Checkpoint A — feasibility, schema, and contracts:** Task 0 and Task 1. Stop until Claude’s gate branch, core/quota readiness split, account-generation migration, quota schema versioning, snapshot revision, preserved-data transitions, and account-store characterization tests pass.
2. **Checkpoint B — one real provider:** Task 2 for Codex first, including a real configured account or an explicit provider-unavailable result. Stop until account isolation, parser fixtures, bounded subprocess behavior, and durable snapshot replacement pass end-to-end. Add Claude only under the selected Task 0 branch.
3. **Checkpoint C — orchestration and API:** Task 3 and Task 4. Stop until the operation matrix, durable operation status, single-stream event delivery, runner restart recovery, and headless HTTP/SSE tests pass without the UI.
4. **Checkpoint D — interface and final integration:** Task 5 and Task 6. Stop until runner-scoped manager ownership, snapshot revision guards, i18n, settings-dialog behavior, responsive rendering, lifecycle scenarios, and final verification pass.

Do not mark a checkpoint complete based only on unit tests if its contract crosses the runner, runtime adapter, or event stream; use the corresponding headless integration test before proceeding.

### 0. Resolve the provider feasibility gate

- [ ] Record the current `git status --short` and `git diff --stat` as the dirty-worktree baseline before any implementation work; include the already-created plan file and unrelated user changes in that baseline. Produce an overlap table for every modified file in the file map. If a file has mixed ownership, stop for owner direction before editing it.
- [ ] Trace the existing Claude credential helper and account setup path, without adding a quota-specific credential store, and prove what happens before and after an access token expires.
- [ ] Resolve the configured Codex executable for each supported account context and run a bounded version/capability probe for `account/read` and `account/rateLimits/read`. Record missing-binary and unsupported-method outcomes as stable `provider_unavailable`/`unsupported` states rather than generic errors.
- [ ] Confirm which existing account mutation/credential events and payloads are available (`account.updated`, `account.credential_selected`, login/setup events). If an event is unavailable or too coarse, make the manager re-evaluate skip eligibility from account/configuration metadata at the start of every scheduled cycle, without making a provider call until the account is eligible.
- [ ] Decide and record whether the milestone supports current-token Claude accounts only or may reuse an existing non-interactive credential refresh capability. The quota manager must not prompt, launch an interactive login, or persist a second refresh-token format.
- [ ] Add a fixture/contract test for usable credentials, expired credentials, and missing credentials. If the existing path cannot refresh, update the plan’s Current Milestone, Final Functionality Standard, user-story acceptance, and Final Checklist to say “credential-present Claude accounts only” before implementing the UI.
- [ ] Write `docs/superpowers/decisions/2026-08-09-codexbar-basic-usage-monitor-feasibility.md` with the selected gate branch, evidence, provider acceptance matrix, and the exact milestone/checklist/UI copy changes. Task 1 and all later work are blocked until this decision record exists; later implementation must follow its selected branch without ad hoc scope changes.

Gate outcome must select exactly one branch before Task 1:

| Gate result | Required plan/implementation branch |
|---|---|
| existing non-interactive refresh works | Full Codex + Claude acceptance; test refresh-before/after expiry and credential-file rotation without duplicating token storage. |
| only a current access token is available | Default fallback: support Claude accounts while credentials are present, show deterministic `login_required` after expiry, remove any claim that the quota layer refreshes Claude credentials, and update the milestone/checklist/UI remediation copy before continuing. |
| no safe account-scoped Claude credential path exists | Do not claim Claude support complete. Keep a descriptor-level `unavailable`/`login_required` state only if it is useful for account inventory, and require explicit user approval before adding Claude to the deliverable; otherwise execute the milestone as Codex-only. |

Verification: the implementation has a documented Claude credential boundary and a deterministic `login_required` result for unusable credentials; no UI work depends on an unverified token-refresh assumption.

### 1. Establish provider and snapshot contracts first

- [ ] Add the shared normalized types, provider descriptor registry, source capability flags, stable ordering rules, and public DTO shape.
- [ ] Add the dedicated quota snapshot, refresh-state, bounded operation-ledger, and read-model-metadata tables in a quota-only bootstrap phase with an explicit ordered `QUOTA_SCHEMA_VERSION` migration list. Each version has a named migration function and a short transaction boundary: inspect `PRAGMA table_info`, `index_list`, and `index_info`; add missing columns/indexes; validate existing objects’ columns, nullability, foreign keys, and uniqueness; advance the metadata version only after validation commits. If a process dies after DDL but before version advancement, rerun the same migration idempotently and validate rather than assuming `IF NOT EXISTS` repaired the shape. Any incompatible object leaves `quotaSchemaReady=false` with an inspectable failure event. Keep existing token/cost tables for their original semantics. Add the core account-column migration separately: idempotently add `account_credential_generation integer NOT NULL DEFAULT 0`, backfill existing rows to `0`, and test restart behavior after each migration statement. On quota startup, mark accepted operations without a terminal status as `runner_restarted` before admitting new work.
- [ ] Before moving code, enumerate every account writer: HTTP create/update/delete/status routes, account inventory migration/tombstone cleanup, setup completion, and test-only direct writers. Add characterization tests for emitted events, dependent-row cleanup, error responses, rollback, and `quotaSchemaReady=false`. Then create `account-store.ts` and route all production deletion/auth-reconfiguration writers through it while preserving response/event contracts. Make it the sole writer of `accountCredentialGeneration`, incrementing on auth-mode changes, credential profile/home reassignment, and account setup completion; a label-only edit must not increment it. When quota schema is ready, keep the increment and quota-row invalidation in the same account mutation transaction and emit lifecycle/invalidation events only after commit. Any account metadata change that affects the usage DTO (label, priority, enabled, provider identity, or credential generation) must also advance the same `snapshotRevision` in that transaction, even when the credential generation itself is unchanged. When quota schema is unavailable, commit the core account mutation, emit `account.quota_reconciliation_needed`, and let quota bootstrap reconcile rows before any read is served.
- [ ] Add store functions for reading complete snapshots, transactional success replacement, stale/error retention, one-row-per-account retry metadata, and bounded deterministic queries. A success replacement must verify inside the same transaction that the account still exists and its persisted `accountCredentialGeneration` matches the expected value; otherwise discard the late result and emit the appropriate invalidation/skip decision. The in-memory refresh generation remains the callback race guard only.
- [ ] Define account lifecycle cleanup: delete quota rows transactionally when an account is removed, clear/invalidate rows when provider or auth context changes, and keep disabled accounts visible but excluded from provider probes. Reads must join/filter against live account identity so no orphaned or cross-provider row can be served. The operation ledger has no live-account foreign key: account deletion removes live snapshot state but retains the bounded immutable scope and marks affected operations `account_deleted` so late results and status reconciliation remain safe and inspectable until normal pruning.
- [ ] Write parser/store tests before provider wiring, including null/unknown values and response completeness. Include upgrade tests for a pre-existing database: account-generation column backfill, quota table/index creation, unique constraints, preserved account/token rows, and recovery after an injected failure between migration phases.

Verification: `pnpm test -- tests/server/quota/store.test.ts tests/server/quota/providers` and schema tests pass; no DTO or serialized event contains credential material.

### 2. Implement bounded, account-scoped Codex and Claude fetchers

- [ ] Add the shared command/HTTP runner with fixed executable/argument allowlists, abort signals, startup/request timeouts, output-size caps, and redacted diagnostics.
- [ ] Implement Codex app-server JSON-RPC using the account’s resolved `CODEX_HOME`; use a spawn-per-refresh child rather than a persistent daemon, write the required initialization handshake followed by the ordered `account/read` and `account/rateLimits/read` requests over the provider’s line-delimited JSON transport, validate response ids/methods, ignore or separately bound interleaved notifications, map `primary_window`/`secondary_window`, preserve reset timestamps, and parse credits only when the provider returns them. Handle stderr separately with a bounded redacted buffer, gracefully close stdin/processes after the response, force-kill at the abort/deadline boundary, and classify one-RPC-success/next-RPC-failure as partial/provider error without fabricating a complete snapshot. Map missing-binary, spawn failure, and unsupported-method outcomes during any refresh—not only the feasibility probe—to stable `provider_unavailable`/`unsupported` states.
- [ ] Implement Claude OAuth usage using the account-scoped `CLAUDE_CONFIG_DIR` credential source and the documented OAuth usage endpoint/header contract. Reuse any existing non-interactive credential-refresh capability owned by account setup/worker authentication, but do not add a quota-specific token store or mutate credentials from the quota adapter. Do not prompt Keychain, launch an interactive PTY, read browser cookies, or expose bearer tokens. Map five-hour/weekly and optional credit data; classify missing/expired credentials as `login_required`, and add an acceptance fixture/check for the credential path after access-token expiry.
- [ ] Ensure account fetches use the same account allocation/auth-mode rules as worker launches and never fall back from an isolated account to ambient global credentials.
- [ ] Add fixture-driven tests for valid, partial, malformed, unauthorized, timeout, rate-limited, provider-unavailable, and provider-contract-changed responses. Codex fixtures must cover interleaved notifications, mismatched response ids, malformed/oversized JSON frames, stderr output, handshake failure, and one successful RPC followed by a failed RPC.

Verification: provider tests cover both providers, subprocesses are killed on timeout, and error messages contain only safe provider/account labels and stable codes.

### 3. Add the runner-owned refresh manager and observability

- [ ] Implement one `QuotaRefreshManager` per runner with a fixed five-minute timer, a mandatory non-blocking startup refresh, manual refresh methods, per-account coalescing, `USAGE_REFRESH_ALL_CONCURRENCY` bounded refresh-all concurrency, an operation ledger, and clean shutdown. Use the shared `USAGE_REFRESH_CADENCE_MS`, `USAGE_STALE_AFTER_MS`, `USAGE_FALLBACK_POLL_MS`, and `USAGE_CYCLE_DEADLINE_MS` constants; do not duplicate timing/deadline literals. The manager is not process-global and is created/stopped with the owning runner.
- [ ] Define transitions for started, skipped (disabled/unsupported/unconfigured), succeeded, stale-preserved, failed, and stopped. Emit one `account.quota_refresh_cycle_started` and exactly one mapped terminal event per effective execution operation: `account.quota_refresh_cycle_completed` for complete/partial/empty-scope outcomes, or `account.quota_refresh_cycle_terminated` for deadline/stop/restart/deletion. Include operation id, attempted/skipped/changed/failed counts, per-reason breakdowns, terminal status, and a safe reason. Coalesced request aliases emit request/coalesced events and inherit the effective operation’s full terminal status; they do not emit a false account-local completion. Emit `account.quota_refresh_cycle_skipped` once per timer-overlap episode when a prior cycle is still running. Emit account-level named events only when persisted payload/provider status, preserved-value state, backoff, or account enabled/provider identity changes, explicitly excluding timestamp-only advancement and client-local age/reset freshness transitions. Unchanged successful rows must not generate a per-account event; the cycle-completed aggregate is the agreed typed record for routine non-transition account decisions and the terminal signal for the client.
- [ ] Apply per-account retry policy in the manager: skip `login_required` until credentials/account metadata changes or an explicit manual recheck, honor provider `Retry-After` when present, and use capped backoff for repeated rate-limit/provider-unavailable failures. Persist `backoffUntil`/last error metadata and seed eligibility from those rows on runner startup before the mandatory startup refresh. Emit skip/backoff decisions only on state transition.
- [ ] Subscribe the manager to existing `account.updated`, `account.credential_selected`, and account setup/login events so a changed credential/account configuration clears the `login_required` skip and permits the next cycle to retry that account. A manual refresh also bypasses the skip once; test credentials-restored → next cycle attempts. Emit `account.quota_rows_invalidated` for account removal/provider-auth reconfiguration, alongside the existing account lifecycle event, so the cleanup decision is directly inspectable.
- [ ] Define display precedence for intentional backoff: `login_required`, `unavailable`, and provider `error` states remain the primary row status, while age-staleness is secondary freshness metadata. Use the shared `staleAfterMs` constant, and test a backed-off row so the UI does not mislabel correct backoff behavior as an unexplained generic stale state.
- [ ] If a timer tick arrives while a cycle is running, do not overlap provider probes: emit `account.quota_refresh_cycle_skipped` once for the overlap episode, define that episode as ending when the blocking cycle completes, and let that completion establish the next authoritative snapshot.
- [ ] Give each cycle a hard overall deadline in addition to per-provider timeouts; cancel remaining probes when the deadline is reached, complete the operation with partial counts, and test that total wall-clock time is bounded by the configured deadline under the chosen concurrency.
- [ ] Emit `error.surfaced` with stable codes such as `account.quota.refresh_failed`, `account.quota.login_required`, and `account.quota.provider_unavailable` when a user-relevant failure is surfaced. Never use a blanket empty catch.
- [ ] Wire quota bootstrap and manager startup into runner start/stop after core `dbReady`; do not block runner readiness on provider network calls, do not start the manager when quota bootstrap failed, and do not leave child processes/timers after shutdown. Recover the durable operation ledger before accepting new refresh requests, emit terminal `runner_restarted` events for abandoned operations, and emit a quota readiness decision for both successful and failed bootstrap.
- [ ] Add manager tests for timer behavior, coalescing, generation races, failure retention, bounded cycle/account event emission, terminal-event mapping, no server event for ticker-only freshness changes, spawn-per-refresh child cleanup, hard overall cycle deadline, account deletion termination, and stop-before-completion.

Verification: `pnpm test -- tests/server/quota/refresh-manager.test.ts tests/server/quota/provider-fetch.test.ts`; inspect `GET /api/events/log` in route tests for every decision branch and assert one cycle stays bounded as account count grows.

### 4. Expose a small authenticated runtime API

- [ ] Add `GET /api/usage` returning the complete secret-free current snapshot for the current runner, with monotonic `snapshotRevision`, `generatedAt`, `serverNow`, completeness, last-attempt/success times, and explicit per-row provider status plus fact timestamps. Use the shared pure freshness derivation for the DTO. `UsageManager` computes a server/client clock offset from `serverNow` at response receipt and uses the adjusted clock for display-ticker freshness/countdowns. If quota bootstrap failed closed, return `503` with stable code `quota.subsystem_unavailable`, never an empty healthy-looking snapshot.
- [ ] Add `POST /api/usage/refresh` accepting `all`, provider, and/or account id intent. Reuse the exact authentication and CSRF/mutation mechanism of the existing account mutation routes: browser web requests require the repository’s same-origin check, while Electron/VS Code/Capacitor calls use their existing authenticated runtime transport and do not spoof a browser `Origin`. Validate the exact legal shapes: `{all:true}` exclusively; `{provider:"codex"|"claude"}`; `{accountId:string}`; or `{provider,accountId}` only when the account matches the provider. Map authentication/CSRF failures to the existing auth response with no operation record; map malformed JSON, empty/ambiguous/unknown-field shapes to `400` with no operation record; map an unknown/not-owned account to the existing non-disclosing `404`; and map disabled accounts, provider mismatches, and unsupported providers to `409` with a durable rejected request id and `account.quota_refresh_rejected`. A valid provider scope with zero eligible accounts is accepted as `empty_scope` and returns `202`. Record accepted or validated-rejected operations before returning, coalesce according to the transition matrix, and return `202` with the effective operation id plus the current snapshot rather than holding the HTTP request open on provider I/O. The bundled snapshot is applied with the operation’s `refreshing` flag set and is never treated as the result of the requested refresh. Emit typed request/rejected/coalesced events and the mapped terminal event per effective operation. Add `GET /api/usage/operations/:id` for bounded status reconciliation; the operation route returns `completed`, `deadline`, `stopped`, `runner_restarted`, `account_deleted`, `rejected`, or `unknown` with safe counts and timestamps only. The client performs one immediate authoritative read after accepting a refresh, then follows the effective operation through the event stream or operation route; it never depends on winning a listener-registration race.
- [ ] Register the usage snapshot, refresh, and operation-status routes and add `runtimeApis.usage.load()`, `runtimeApis.usage.refresh()`, and `runtimeApis.usage.operationStatus()` to every adapter’s shared API type. Keep the route usable by Electron/VS Code/Capacitor clients even though their dedicated UI is outside this milestone.
- [ ] Add route tests for unauthenticated access, existing same-origin/CSRF mutation parity, non-browser adapter authentication, provider/account filters, deterministic ordering, `202` operation responses, alias/effective-operation status, partial snapshots, monotonic revision ordering, stale retention, timeout errors, and secret redaction.

Verification: `pnpm test -- tests/api/usage-route.test.ts tests/api/events-route.test.ts`; assert all responses omit `authRef`, credential paths, bearer tokens, cookies, and raw provider payloads.

### 5. Build the Usage UI from the existing shell and shadcn block structure

- [ ] Inspect the official `dashboard-01` shadcn block source before implementation and adapt only its compact section-card/data-table/status-row patterns into the existing settings dialog. Use the in-repo primitives as the acceptance baseline; do not run the generator, add a second sidebar, or duplicate the app shell. Apply the settings-dialog rules: the Usage tab supplies context, no repeated Usage heading/subtitle is added, and helper text appears only for privacy, freshness, login, or reset boundaries.
- [ ] Add a runner-scoped `UsageManager` as the owner of usage data and refresh lifecycle. Hydrate it from the runtime API, receive named quota events through the existing runner event fanout, and treat them as invalidation signals that trigger a debounced/coalesced authoritative `GET /api/usage` re-read with at most one in-flight request and one trailing re-read. A replay burst must produce one fetch rather than one fetch per event, and resync plus one authoritative read stops fallback polling. Apply a response only when its runner identity, manager generation, and `snapshotRevision` are current; a newer revision wins over older requests regardless of timestamps. Run a display ticker at the countdown cadence so age-based staleness and `reset_pending_refresh` are derived locally from the shared freshness function. Give each awaited refresh operation a client timeout; if its completion event is abandoned by a runner restart or lost stream, query operation status and reconcile with a fresh snapshot before clearing `refreshing`. Guard every timer/event response by runner identity, manager generation, and operation id, and expose narrow selectors so the Home header does not re-render on unrelated conversation changes.
- [ ] Add a compact header summary showing the most constrained available window, next reset, stale/error indicator, and an action to open Usage. Define “most constrained” as the highest numeric `usedPercent` among currently available, non-stale windows; exclude token/credit-only or unknown windows from that comparison, and use stable provider/account/window order as the tie-break. If no comparable percent window exists, show a translated unavailable/unknown summary while retaining all rows in Usage. Use existing shadcn `Button`, `Badge`, `DropdownMenu`/`Popover`, `Skeleton`, and `Tooltip` primitives.
- [ ] Add the Usage settings tab with provider/account grouping, session/five-hour and weekly rows, usage bar/percentage, reset countdown plus absolute time, credits if available, source/freshness, and a manual refresh control per account and for all accounts. Render only allowlisted `errorCode` and descriptor `sourceKey` values through `t()` with translated generic fallbacks; include `provider_contract_changed` as a distinct stable error code for schema drift and never render diagnostic `errorMessage`. Use the generic translated window label for any unknown descriptor key and the display-ticker freshness semantics defined above; clamp countdowns at zero and never imply a reset has been confirmed solely because the clock elapsed.
- [ ] Implement empty, loading, refreshing, available, stale, login-required, unavailable, provider-error, and narrow/mobile states. Do not rely on color alone; include text/icon/status semantics and accessible labels.
- [ ] Keep settings-dialog chrome compact: the tab label supplies context, no repeated Usage heading/subtitle, and helper text only where it explains privacy, freshness, or login boundaries. Refresh is an explicit action; no usage setting is added in this milestone, so there is no new persistence/reset/migration surface beyond durable server snapshots.
- [ ] Use `src/lib/formatters/usage.ts` for locale-aware `Intl.NumberFormat`, `Intl.DateTimeFormat`, and `Intl.RelativeTimeFormat` values; keep countdown pluralization, source labels, error reasons, and status phrases in translated `t()` keys rather than interpolated English fragments. Add all visible strings to every locale file under `shared/locales/*.json`, enumerate that glob in the contract test, and subscribe components with `useI18nSnapshot()` where language changes must repaint. Test at least one non-English locale for formatted percent/time output.

Verification: `pnpm test -- tests/app/usage-manager.test.ts tests/app/usage-settings-panel.test.tsx`; run the interface build and a responsive browser check after implementation. The candidate Playwright test requires explicit user approval before execution.

### 6. Complete lifecycle, security, and operational verification

- [ ] Add the lifecycle scenario for quota bootstrap success/failure, mandatory non-blocking startup refresh, and a refresh in flight during runner stop/restart. Assert startup and stop decisions are observable, no orphaned child or timer remains, and the next runner rebuilds from durable snapshots while the operation route reports `runner_restarted`.
- [ ] Add redaction assertions for server logs, named events, API DTOs, operation-status responses, and frontend error objects. Provider error text must be normalized before it reaches `error.surfaced` or `/api/events/log`; no raw response body, URL query, header, credential path, or bearer token may be retained.
- [ ] Add a boundedness test for provider output, database rows, refresh concurrency, and spawn-per-refresh child lifetime. No refresh path may scan full conversation streams or store raw provider responses.
- [ ] Verify event replay/resync behavior remains intact for named refresh events through the existing single per-runner stream and every runtime adapter. The runner-scoped UsageManager must recover with a normal API snapshot after reconnect; resync plus one authoritative read must stop fallback polling so polling never runs concurrently with a healthy stream.
- [ ] Run `pnpm typecheck`, the focused Vitest suites, `pnpm lint`, and the interface build. Run `pnpm test:lifecycle` when the lifecycle scenario is included.
- [ ] Before any implementation work, record the current `git status --short` and `git diff --stat` as the dirty-worktree baseline, including the already-created plan file and unrelated user changes. Before claiming completion, compare the final status/diff against that baseline and verify only intended implementation files were added; preserve all baseline changes and never create a branch/worktree.

## Approval-gated user journey test proposal

Do not run this without explicit user approval. The candidate journey is:

1. Start the existing runner with one fixture-backed Codex account and one Claude account.
2. Open the interface, observe the header usage summary, open Settings → Usage, and verify both providers show the correct session/five-hour and weekly percentages and reset times.
3. Trigger refresh-all, verify the refreshing state, then verify the updated `lastSuccessAt` and stable ordering.
4. Make one provider return unauthorized and the other return a timeout. Verify the successful provider remains current, the failed provider retains last-known-good values as stale/error, and the UI offers login/retry guidance.
5. Reload or reconnect and verify durable snapshots reappear without duplicate rows or secret material.

Visible proof must include the rendered status, the post-refresh timestamp, the stale/error explanation, and a matching named event in the dev event log. The test should cover desktop and a narrow viewport once approved.

## Risks and trust boundaries

- **Provider protocol drift:** Keep provider parsing isolated and fixture-driven. A malformed response must become unavailable/error, never a fabricated zero.
- **Credential leakage:** Resolve credentials only on the server, pass them to one bounded adapter, redact command output and errors, and never persist raw provider payloads.
- **Account crossover:** Carry `accountId` and credential-home ownership through every fetch/store call; do not use ambient `process.env` when an account-specific environment exists.
- **Stale truth:** Preserve last-known-good values and persist the facts needed to derive stale/reset-pending status. The header must not present stale percentages as current.
- **Refresh storms:** Coalesce manual and timer refreshes, cap concurrency, and bound child process lifetime/output.
- **Process cost:** Spawn-per-refresh Codex children are deliberately chosen for bounded ownership and reliable shutdown; accept the startup cost in this milestone rather than introducing an unmanaged persistent daemon.
- **Remote runner mismatch:** Scope usage to the selected runner connection and never merge snapshots from different runner profiles.
- **Unauthorized refresh mutation:** Require the same session and same-origin protections as account mutation routes; use stable error codes and include enough detail for diagnosis without secrets.

## Sources reviewed

- [CodexBar README](https://github.com/steipete/CodexBar): product scope, refresh/display behavior, privacy boundary, supported source families, and current feature set.
- [CodexBar architecture](https://github.com/steipete/CodexBar/blob/main/docs/architecture.md): provider fetch core, state/UI store, and background-refresh data flow.
- [CodexBar provider authoring guide](https://github.com/steipete/CodexBar/blob/main/docs/provider.md): descriptor/strategy boundary and shared host capability model.
- [CodexBar provider overview](https://github.com/steipete/CodexBar/blob/main/docs/providers.md): Codex/Claude source choices and normalized provider strategy patterns.
- [Codex provider notes](https://github.com/steipete/CodexBar/blob/main/docs/codex.md): OAuth usage and `codex app-server` RPC methods/window mapping.
- [Claude provider notes](https://github.com/steipete/CodexBar/blob/main/docs/claude.md): OAuth usage endpoint, headers, window mapping, and explicit cookie/CLI fallbacks.
- [CodexBar refresh loop](https://github.com/steipete/CodexBar/blob/main/docs/refresh-loop.md): manual/background refresh, stale/error behavior, and adaptive cadence concepts.
- [CodexBar CLI reference](https://github.com/steipete/CodexBar/blob/main/docs/cli.md): generic usage snapshot shape and provider source semantics.
- [shadcn/ui Blocks](https://ui.shadcn.com/blocks): selected `dashboard-01` structural starting point for the status/table surface.

## Final checklist

- [ ] Codex and every provider included by the selected feasibility branch fetch real account-scoped usage without interactive login or browser-cookie access; excluded Claude support is represented honestly as unavailable or credential-required.
- [ ] The selected Claude feasibility branch is recorded in the decision artifact and the milestone, acceptance, and checklist match it; no unsupported token-refresh behavior is implied.
- [ ] Quota windows, reset times, credits, source, fact timestamps, preserved values, account enabled/availability, operation status, and failures are normalized and durably persisted; time-derived freshness is consistent through the shared derivation function.
- [ ] Core account mutations remain safe when quota schema readiness is false, and the next successful quota bootstrap reconciles all affected rows before serving usage data.
- [ ] Quota schema versions validate existing SQLite objects and recover safely after interrupted migrations.
- [ ] GET and manual-refresh runtime routes are authenticated, secret-free, deterministic, and covered by tests.
- [ ] The runner refresh manager is bounded, coalesced, observable, and cleanly stopped.
- [ ] UsageManager is runner-scoped, consumes the existing event stream exactly once, and cannot apply inactive-runner data.
- [ ] Accepted refresh operations have race-safe effective ids, bounded status reconciliation, and terminal events/status for completion, deadline, stop, rejection, runner restart, and account deletion.
- [ ] The header summary and Settings → Usage surface cover all loading, available, stale, auth, unavailable, error, empty, desktop, mobile, accessibility, and locale states.
- [ ] Named events and `error.surfaced` make every refresh decision and user-relevant failure inspectable.
- [ ] Focused tests, typecheck, lint, interface build, and lifecycle verification pass before completion is claimed.
