# CodexBar Basic Usage Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the basic CodexBar job to OmniHarness: show account-scoped Codex and Claude quota windows, usage percentages, reset times, credits when available, refresh freshness, and honest authentication/error states in the existing OmniHarness control plane.

**Architecture:** Build a server-owned quota refresh service behind a provider-descriptor boundary. The service resolves each account through OmniHarness’s existing credential isolation, fetches only non-interactive local/API sources for Codex and Claude, normalizes provider responses into durable quota-window snapshots, and exposes a small runtime API. The interface consumes those snapshots through a dedicated manager, a compact header summary, and a focused Usage settings panel.

**Tech Stack:** TypeScript, Node runner, SQLite/Drizzle schema helpers, existing runtime HTTP registry, named SSE events, React 19, `StateManager`, existing shadcn/ui primitives, Vitest, and Playwright approval-gated journey coverage.

**North Star Product:** OmniHarness becomes the trustworthy control plane for agent capacity across local and remote runners: a user can glance at every provider/account’s current headroom, understand when a long task can start, and see exactly why a value is stale, unavailable, or blocked.

**Current Milestone:** Implement a web/packaged-interface Usage surface for Codex and Claude accounts using existing local sessions, isolated CLI homes, credential profiles, and direct OAuth-backed usage endpoints where credentials are already available. Include session/five-hour and weekly windows, reset countdowns, optional credits, manual refresh, fixed background refresh, persistence, and transparent failure states.

**Future Product Direction:** The provider boundary should make additional providers, browser-cookie sources, API spend/cost history, status-page incidents, notifications, CLI JSON output, widgets, and a native macOS menu-bar surface possible without changing the normalized snapshot contract. Those capabilities are context only and are not part of this milestone.

**Final Functionality Standard:** The milestone is complete only when a real configured Codex or Claude account can be refreshed end-to-end, its provider response is parsed into durable snapshots, the interface renders loading/available/stale/auth-required/error/empty states, refresh races cannot overwrite newer data, secrets never cross the API/event boundary, and the server decisions are observable through named events and tests.

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

- `src/server/quota/types.ts`: normalized quota windows, credits, provider refresh results, refresh state, and public snapshot contracts. Define provider status separately from derived freshness; import the shared usage timing/concurrency constants rather than defining server-only values.
- `src/server/quota/provider-registry.ts`: descriptor registry for `codex` and `claude`, supported source metadata, display order, and provider capability flags.
- `src/server/quota/provider-fetch.ts`: bounded, non-interactive command/HTTP helpers with abort and output limits; never log environment values, headers, or raw provider payloads.
- `src/server/quota/providers/codex.ts`: account-scoped Codex app-server JSON-RPC client and parser for identity, primary/secondary windows, reset timestamps, and credits.
- `src/server/quota/providers/claude.ts`: account-scoped Claude OAuth credential reader and usage endpoint client/parser for five-hour/weekly windows and optional credits; return `login_required` for unreadable/expired credentials.
- `src/server/quota/store.ts`: transactional persistence and read-model assembly for current account quota rows plus one account-level refresh-state row per account, including last-known-good data and refresh errors.
- `src/server/accounts/account-store.ts`: centralize account lifecycle mutations and quota-row cleanup; HTTP routes invoke this service rather than owning provider/account deletion semantics. It is the sole writer of `accountCredentialGeneration`.
- `src/server/quota/refresh-manager.ts`: one runner-owned background manager with fixed cadence, manual refresh coalescing, per-account ownership tokens, startup/shutdown handling, and named-event emission.
- `src/server/quota/dto.ts`: secret-free API serialization and deterministic provider/account/window ordering.
- `src/runtime/http/routes/usage.ts`: authenticated `GET /api/usage` and authenticated `POST /api/usage/refresh` handlers using the existing mutation transport rules; return the stable `quota.subsystem_unavailable` 503 contract when quota schema bootstrap has failed closed.
- `src/interface/home/UsageManager.ts`: client single source of truth for bootstrap, refresh, polling, event freshness, stale-response guards, server/client clock offset, and the display ticker that re-derives age/reset freshness between server fetches.
- `src/lib/formatters/usage.ts`: locale-aware percent, absolute-time, and countdown formatting built on `Intl`; return formatted values/data for translated UI boundaries and clamp expired countdowns at zero.
- `src/components/home/UsageSummaryButton.tsx`: compact header summary using the existing button/popover/dropdown vocabulary.
- `src/components/settings/UsageSettingsPanel.tsx`: detailed responsive account/window table or compact stacked rows, refresh controls, and state-specific empty/loading/error UI.
- `tests/server/quota/provider-fetch.test.ts`: timeout, abort, bounded output, redaction, and non-interactive command tests.
- `tests/server/quota/providers/codex.test.ts`: JSON-RPC framing and provider payload fixtures.
- `tests/server/quota/providers/claude.test.ts`: credential resolution, request headers, payload mapping, and auth/error fixtures.
- `tests/server/quota/store.test.ts`: upsert, deterministic ordering, last-known-good retention, stale marking, completeness behavior, account removal, provider reconfiguration, disabled-account filtering, an in-flight success rejected after account/provider-generation deletion, and typed-schema/bootstrap-DDL column/index/unique-constraint parity via SQLite pragmas.
- `tests/server/quota/refresh-manager.test.ts`: cadence, coalescing including broad/narrow dual completion, per-account isolation, shutdown, stale refresh-generation tests, no-op cycle event bounds, restart-seeded backoff/skip eligibility, backoff precedence, and credential-restored retry.
- `tests/api/usage-route.test.ts`: existing account-mutation auth/CSRF parity, response shape, refresh behavior, fail-closed 503 behavior with `quota.subsystem_unavailable`, error transparency, secret redaction, and an assertion that every operation id returned by `POST /api/usage/refresh` receives one matching cycle-completed event.
- `tests/runtime-api/usage-adapters.test.ts`: shared web/Electron/VS Code/Capacitor transport mutation behavior using each adapter’s existing session/auth mechanism.
- `tests/app/usage-manager.test.ts`: stale async responses, timer ownership, loading stages, partial snapshot safety, event-to-fetch operation correlation (including coalesced effective ids), abandoned-operation timeout recovery, display-ticker age/reset freshness, server/client clock skew, fallback polling and reconnect-stops-polling behavior, header constraint selection, locale formatting, and error transitions.
- `tests/app/usage-settings-panel.test.tsx`: visible states, accessible controls, and deterministic ordering.
- `tests/lifecycle/scenarios/usage-refresh-restart.test.ts`: lifecycle scenario for mandatory non-blocking startup refresh and refresh state across runner stop/restart, including child/timer cleanup and durable snapshot rebuild.
- `tests/e2e/usage-quota.spec.ts`: approval-gated black-box journey candidate, not to be run without explicit user approval.

### Files to modify

- `src/server/db/schema.ts`: add a semantically correct current-quota snapshot table rather than overloading token-only `accountUsageSnapshots`; add a one-row-per-account refresh-state table for `backoffUntil`/skip metadata; add a persisted `accountCredentialGeneration` on accounts, a uniqueness constraint for `(accountId, windowKey)`, and indexes for account/provider reads. The credential generation is internal and never enters public DTOs.
- `src/server/db/index.ts`: add the matching `CREATE TABLE`/index/bootstrap migration path used by this repository and preserve existing databases. If quota bootstrap fails, fail closed for the quota subsystem (do not start its manager or serve usage data), emit `quota.schema_bootstrap_failed` plus `error.surfaced`, and let the existing runner continue only if its core database readiness succeeds.
- `src/runtime/http/routes/accounts.ts`: invoke the account store for deletion/provider-auth reconfiguration and emit the resulting lifecycle/invalidation events; it does not own quota cleanup directly.
- `src/server/accounts/dto.ts`: keep account DTOs secret-free; do not put full quota data into the account list response. If a compact summary is added, use a separate explicit field and document its freshness.
- `src/server/supervisor/codex-auth.ts` and/or `src/server/agent-runtime/external-credentials.ts`: extract/reuse read-only account-scoped credential resolution helpers instead of duplicating auth paths. No helper may return credentials to a DTO, event, or client.
- `src/server/events/named-events.ts`: add typed `quota.schema_bootstrap_failed`, `account.quota_refresh_cycle_started`, `account.quota_refresh_cycle_completed`, `account.quota_refresh_cycle_skipped`, `account.quota_refresh_requested`, `account.quota_refresh_rejected`, `account.quota_refresh_coalesced`, `account.quota_rows_invalidated`, `account.quota_state_changed`, `account.quota_refresh_failed`, and `account.quota_refresh_skipped` events, plus `error.surfaced` payloads with operation/account/provider subjects and stable error codes. Emit one cycle-level pair per operation; emit cycle-skipped once per timer-overlap episode; emit the named account events only when payload or the derived freshness/status state changes, excluding timestamp advancement alone, and emit account refresh-skipped only when the skip state changes. The cycle-completed aggregate is the agreed typed record for routine non-transition account decisions; per-account events are reserved for state changes and user-relevant failures to protect the shared ring buffer. Its payload includes attempted/skipped/changed/failed counts and per-reason breakdowns.
- `src/server/runner/run.ts`: construct, start, and stop exactly one `QuotaRefreshManager` per runner after database readiness; make startup refresh non-blocking and emit start/failure decisions.
- `src/runtime/http/routes/index.ts`: register the usage routes.
- `src/runtime-api/domains/index.ts` and `src/runtime-api/types.ts`: expose `usage.load` and `usage.refresh` in the shared runtime API used by web, Electron, VS Code, and Capacitor adapters.
- `src/shared/home-types.ts`: add public usage DTOs and status/window types plus shared constants: `USAGE_REFRESH_CADENCE_MS = 300_000`, `USAGE_STALE_AFTER_MS = 2 * USAGE_REFRESH_CADENCE_MS`, `USAGE_REFRESH_ALL_CONCURRENCY = 4`, `USAGE_FALLBACK_POLL_MS = 15_000`, and `USAGE_CYCLE_DEADLINE_MS = 60_000`.
- `src/interface/home/useHomeLifecycle.ts` or the appropriate home bootstrap wiring: hydrate and start/stop `UsageManager` without coupling it to selected conversation state.
- `src/interface/home/HomeApp.tsx`: configure the manager, open the Usage tab, and pass narrow usage selectors to the header/settings surfaces.
- `src/components/home/HomeHeader.tsx`: place the compact usage summary at the existing top-bar density and keep it hidden or disabled when there are no visible accounts.
- `src/components/settings/SettingsDialog.tsx`: add the Usage tab without duplicating headings or explanatory chrome; preserve existing Save/Cancel semantics for unrelated settings.
- `shared/locales/*.json`: add all Usage labels, statuses, aria labels, reset copy, freshness copy, source labels, error/remediation copy, and empty/loading text to every locale file present at implementation time; the glob, not a hard-coded list, is authoritative.
- `src/runtime-api/web.ts`, `src/runtime-api/electron.ts`, `src/runtime-api/vscode.ts`, `src/runtime-api/capacitor.ts`, and `src/runtime-api/legacy-live-events.ts`: register the usage invalidation event types wherever the shared event adapter requires explicit knowledge of custom events. The first UI need not add native-specific rendering.
- `src/components/ui/*` only when an existing primitive is missing; use existing `Button`, `Badge`, `Card`, `DropdownMenu`, `Skeleton`, `Table`, `Tooltip`, and `Separator` primitives before adding controls.

### Tests and integration paths to preserve

- The existing account route and schema tests must continue to prove auth references are not serialized.
- The existing quota recovery/parser tests remain authoritative for runtime error-derived reset parsing; the new provider parsers must not silently fork those semantics.
- `GET /api/events/log?since=<id>&runId=<id>` must expose the new named refresh decisions for triage.
- The runner lifecycle must not leave a refresh timer or child `codex app-server` process alive after stop.
- Existing initialized database files must acquire the quota table and indexes on upgrade without a manual migration command.

## Early feasibility gate

Before building the shared UI contract, verify the existing account setup/worker-auth path can supply a usable Claude OAuth access token from the account-scoped credential location, including its already-supported non-interactive refresh behavior if one exists. If it cannot, keep the provider adapter and honest `login_required` state but explicitly downgrade Claude’s milestone acceptance to “credential-present accounts only” before proceeding with UI and locale work; do not discover this scope change after the surface is built.

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
  freshness: "current" | "age_stale" | "reset_pending_refresh" | "stale_preserved";
};
```

`labelKey` and `sourceKey` are allowlisted translation keys emitted by the provider descriptor, never provider-supplied copy. The UI maps an unknown/missing label or source key to a generic translated fallback, and a contract test enumerates `shared/locales/*.json` at runtime to assert every registry key exists in every locale. Stable `errorCode` values use the same allowlist/fallback rule. `errorMessage` is diagnostic-only for server logs and the dev event log; it is never rendered in the UI or returned in the public DTO.

The internal account snapshot carries `accountId`, provider, worker type, display label, optional plan label, `lastAttemptAt`, `lastSuccessAt`, `staleAt`, `errorCode`, diagnostic `errorMessage`, and `refreshGeneration`. The public DTO carries only safe display metadata, translated-key ids, stable error codes, and freshness timestamps; it never includes `authRef`, diagnostic error text, secret values, raw headers, raw provider JSON, filesystem credential paths, or token/account identifiers that are not already safe display metadata.

The quota snapshot table stores one current row per account/window and retains last-known-good values when a refresh fails. A separate one-row-per-account refresh-state record stores `backoffUntil`, skip reason, last error code, and the account credential generation. A failed refresh updates attempt/error metadata and sets derived freshness to `stale_preserved`; it does not zero usage or replace a real reset timestamp with an invented value. A successful provider response declares its window completeness. Replacement is transactional and deterministic, and rows absent from a complete response become unavailable rather than silently surviving as current data. This account-level state survives restart without copying retry metadata into every window row.

### Ownership and synchronization invariants

- The runner and quota store are authoritative for persisted usage. The client manager is authoritative only for its current view of the API payload and its local refresh lifecycle.
- Every refresh attempt has a manager generation plus account id/provider token. A timer or manual response may update state only if it still owns that generation and the manager is active.
- Manual refreshes coalesce with an in-flight refresh for the same account and never launch concurrent provider probes for that account. A refresh-all operation has a separate operation id and bounded concurrency.
- `GET /api/usage` is a read of the last durable snapshot. It declares `generatedAt`, `complete`, and per-account freshness so the UI cannot treat a partial or stale payload as fully current.
- Provider/account/window ordering is provider registry order, account priority descending, then label/id, with stable window order from the descriptor. Timestamp-only “latest” queries are forbidden.
- The UI distinguishes initial bootstrap, background refresh, manual refresh, reconnect/resync, stale data, and terminal provider errors. A background refresh must not unmount the settings dialog or reset unrelated conversation state.
- A row is stale by age when the current time is later than `lastSuccessAt + staleAfterMs`, where `staleAfterMs = 2 * refreshCadenceMs` and the fixed five-minute cadence makes the current threshold 10 minutes; the store/DTO and client display ticker use the same constant. If `resetAt` has elapsed but no successful refresh after that timestamp has confirmed the new window, the renderer derives a `reset_pending_refresh` freshness state, clamps the countdown to zero, and uses translated “reset pending refresh” copy; it must not show the row as confidently current.
- The current runner’s usage is not merged with another runner’s usage. The runtime profile/runner connection is the ownership scope, and switching runners replaces the manager’s payload only after the new runner’s response is authoritative.

## Implementation tasks

### 0. Resolve the provider feasibility gate

- [ ] Record the current `git status --short` and `git diff --stat` as the dirty-worktree baseline before any implementation work; include the already-created plan file and unrelated user changes in that baseline.
- [ ] Trace the existing Claude credential helper and account setup path, without adding a quota-specific credential store, and prove what happens before and after an access token expires.
- [ ] Resolve the configured Codex executable for each supported account context and run a bounded version/capability probe for `account/read` and `account/rateLimits/read`. Record missing-binary and unsupported-method outcomes as stable `provider_unavailable`/`unsupported` states rather than generic errors.
- [ ] Confirm which existing account mutation/credential events and payloads are available (`account.updated`, `account.credential_selected`, login/setup events). If an event is unavailable or too coarse, make the manager re-evaluate skip eligibility from account/configuration metadata at the start of every scheduled cycle, without making a provider call until the account is eligible.
- [ ] Decide and record whether the milestone supports current-token Claude accounts only or may reuse an existing non-interactive credential refresh capability. The quota manager must not prompt, launch an interactive login, or persist a second refresh-token format.
- [ ] Add a fixture/contract test for usable credentials, expired credentials, and missing credentials. If the existing path cannot refresh, make the `login_required`-only limitation explicit in the milestone acceptance criteria before implementing the UI.

Verification: the implementation has a documented Claude credential boundary and a deterministic `login_required` result for unusable credentials; no UI work depends on an unverified token-refresh assumption.

### 1. Establish provider and snapshot contracts first

- [ ] Add the shared normalized types, provider descriptor registry, source capability flags, stable ordering rules, and public DTO shape.
- [ ] Add a dedicated quota snapshot table and an idempotent `CREATE TABLE IF NOT EXISTS`/`CREATE INDEX IF NOT EXISTS` bootstrap path executed on every runner startup, with a unique account/window key. Keep existing token/cost tables for their original semantics.
- [ ] Create `account-store.ts` and move existing deletion/auth-reconfiguration mutations behind it while keeping route behavior byte-compatible. Make it the sole writer of `accountCredentialGeneration`, incrementing on auth-mode changes, credential profile/home reassignment, and account setup completion; a label-only edit must not increment it. Keep the increment and quota-row invalidation in the same account mutation transaction.
- [ ] Add store functions for reading complete snapshots, transactional success replacement, stale/error retention, one-row-per-account retry metadata, and bounded deterministic queries. A success replacement must verify inside the same transaction that the account still exists and its persisted `accountCredentialGeneration` matches the expected value; otherwise discard the late result and emit the appropriate invalidation/skip decision. The in-memory refresh generation remains the callback race guard only.
- [ ] Define account lifecycle cleanup: delete quota rows transactionally when an account is removed, clear/invalidate rows when provider or auth context changes, and keep disabled accounts visible but excluded from provider probes. Reads must join/filter against live account identity so no orphaned or cross-provider row can be served.
- [ ] Write parser/store tests before provider wiring, including null/unknown values and response completeness. Include an upgrade test that opens a pre-existing database file and verifies the idempotent bootstrap creates the quota table/indexes without disturbing existing account/token rows.

Verification: `pnpm test -- tests/server/quota/store.test.ts tests/server/quota/providers` and schema tests pass; no DTO or serialized event contains credential material.

### 2. Implement bounded, account-scoped Codex and Claude fetchers

- [ ] Add the shared command/HTTP runner with fixed executable/argument allowlists, abort signals, startup/request timeouts, output-size caps, and redacted diagnostics.
- [ ] Implement Codex app-server JSON-RPC using the account’s resolved `CODEX_HOME`; use a spawn-per-refresh child rather than a persistent daemon, validate response ids and methods, map `primary_window`/`secondary_window`, preserve reset timestamps, and parse credits only when the provider returns them. Map missing-binary, spawn failure, and unsupported-method outcomes during any refresh—not only the feasibility probe—to stable `provider_unavailable`/`unsupported` states.
- [ ] Implement Claude OAuth usage using the account-scoped `CLAUDE_CONFIG_DIR` credential source and the documented OAuth usage endpoint/header contract. Reuse any existing non-interactive credential-refresh capability owned by account setup/worker authentication, but do not add a quota-specific token store or mutate credentials from the quota adapter. Do not prompt Keychain, launch an interactive PTY, read browser cookies, or expose bearer tokens. Map five-hour/weekly and optional credit data; classify missing/expired credentials as `login_required`, and add an acceptance fixture/check for the credential path after access-token expiry.
- [ ] Ensure account fetches use the same account allocation/auth-mode rules as worker launches and never fall back from an isolated account to ambient global credentials.
- [ ] Add fixture-driven tests for valid, partial, malformed, unauthorized, timeout, rate-limited, provider-unavailable, and provider-contract-changed responses.

Verification: provider tests cover both providers, subprocesses are killed on timeout, and error messages contain only safe provider/account labels and stable codes.

### 3. Add the runner-owned refresh manager and observability

- [ ] Implement one `QuotaRefreshManager` per runner with a fixed five-minute timer, a mandatory non-blocking startup refresh, manual refresh methods, per-account coalescing, `USAGE_REFRESH_ALL_CONCURRENCY` bounded refresh-all concurrency, and clean shutdown. Use the shared `USAGE_REFRESH_CADENCE_MS`, `USAGE_STALE_AFTER_MS`, `USAGE_FALLBACK_POLL_MS`, and `USAGE_CYCLE_DEADLINE_MS` constants; do not duplicate timing/deadline literals.
- [ ] Define transitions for started, skipped (disabled/unsupported/unconfigured), succeeded, stale-preserved, failed, and stopped. Emit one `account.quota_refresh_cycle_started` and one `account.quota_refresh_cycle_completed` event per operation, including operation id, attempted/skipped/changed/failed counts, per-reason breakdowns, and a safe reason. Emit `account.quota_refresh_cycle_skipped` once per timer-overlap episode when a prior cycle is still running. Emit account-level named events when payload or the derived freshness/status state changes, explicitly excluding `lastSuccessAt` timestamp advancement alone, and on skip-state transitions, including account id, provider, source, generation, and safe reason. Unchanged successful rows must not generate a per-account event; the cycle-completed aggregate is the agreed typed record for routine non-transition account decisions and the terminal signal for the client.
- [ ] Apply per-account retry policy in the manager: skip `login_required` until credentials/account metadata changes or an explicit manual recheck, honor provider `Retry-After` when present, and use capped backoff for repeated rate-limit/provider-unavailable failures. Persist `backoffUntil`/last error metadata and seed eligibility from those rows on runner startup before the mandatory startup refresh. Emit skip/backoff decisions only on state transition.
- [ ] Subscribe the manager to existing `account.updated`, `account.credential_selected`, and account setup/login events so a changed credential/account configuration clears the `login_required` skip and permits the next cycle to retry that account. A manual refresh also bypasses the skip once; test credentials-restored → next cycle attempts. Emit `account.quota_rows_invalidated` for account removal/provider-auth reconfiguration, alongside the existing account lifecycle event, so the cleanup decision is directly inspectable.
- [ ] Define display precedence for intentional backoff: `login_required`, `unavailable`, and provider `error` states remain the primary row status, while age-staleness is secondary freshness metadata. Use the shared `staleAfterMs` constant, and test a backed-off row so the UI does not mislabel correct backoff behavior as an unexplained generic stale state.
- [ ] If a timer tick arrives while a cycle is running, do not overlap provider probes: emit `account.quota_refresh_cycle_skipped` once for the overlap episode, define that episode as ending when the blocking cycle completes, and let that completion establish the next authoritative snapshot.
- [ ] Give each cycle a hard overall deadline in addition to per-provider timeouts; cancel remaining probes when the deadline is reached, complete the operation with partial counts, and test that total wall-clock time is bounded by the configured deadline under the chosen concurrency.
- [ ] Emit `error.surfaced` with stable codes such as `account.quota.refresh_failed`, `account.quota.login_required`, and `account.quota.provider_unavailable` when a user-relevant failure is surfaced. Never use a blanket empty catch.
- [ ] Wire the manager into runner start/stop after `dbReady`; do not block runner readiness on provider network calls and do not leave child processes/timers after shutdown.
- [ ] Add manager tests for timer behavior, coalescing, generation races, failure retention, bounded cycle/account event emission, spawn-per-refresh child cleanup, hard overall cycle deadline, and stop-before-completion.

Verification: `pnpm test -- tests/server/quota/refresh-manager.test.ts tests/server/quota/provider-fetch.test.ts`; inspect `GET /api/events/log` in route tests for every decision branch and assert one cycle stays bounded as account count grows.

### 4. Expose a small authenticated runtime API

- [ ] Add `GET /api/usage` returning the complete secret-free current snapshot for the current runner, with `generatedAt`, `serverNow`, completeness, last-attempt/success times, and explicit per-row status. `UsageManager` computes a server/client clock offset from `serverNow` at response receipt and uses the adjusted clock for display-ticker freshness/countdowns. If quota bootstrap failed closed, return `503` with stable code `quota.subsystem_unavailable`, never an empty healthy-looking snapshot.
- [ ] Add `POST /api/usage/refresh` accepting `all`, provider, and/or account id intent. Reuse the exact authentication and CSRF/mutation mechanism of the existing account mutation routes: browser web requests require the repository’s same-origin check, while Electron/VS Code/Capacitor calls use their existing authenticated runtime transport and do not spoof a browser `Origin`. Validate account ownership and worker/provider compatibility, coalesce duplicate requests, and return `202` with the effective operation id plus the current snapshot rather than holding the HTTP request open on provider I/O. The bundled snapshot is applied with the operation’s `refreshing` flag set and is never treated as the result of the requested refresh. Same-scope duplicate requests join the existing operation. A broader request never coalesces onto a narrower in-flight cycle: it creates an operation that awaits those in-flight account probes and schedules the remaining requested accounts, and its completion event is delayed until the whole requested scope is done. A narrower request may join an in-flight broader operation only when its account is included and its account probe has not completed; if it already completed within that broader operation, queue a fresh probe after the cycle and return that fresh operation id. For a coalesced request, the response and `account.quota_refresh_coalesced` event carry the effective operation id the client must await, never an id that will not complete. Emit typed `account.quota_refresh_requested`, `account.quota_refresh_rejected`, and `account.quota_refresh_coalesced` events for the request decision; user-relevant rejections also emit `error.surfaced` with a stable code and account/operation subject. The manager treats an accepted operation as refreshing until `account.quota_refresh_cycle_completed` arrives, then re-reads `GET /api/usage`; a bounded fallback poll handles disconnected event streams. Return stable error payloads for invalid requests or an operation that cannot be scheduled.
- [ ] Register both routes and add `runtimeApis.usage.load()` / `runtimeApis.usage.refresh()` to every adapter’s shared API type. Keep the route usable by Electron/VS Code/Capacitor clients even though their dedicated UI is outside this milestone.
- [ ] Add route tests for unauthenticated access, existing same-origin/CSRF mutation parity, non-browser adapter authentication, provider/account filters, deterministic ordering, `202` operation responses, partial snapshots, stale retention, timeout errors, and secret redaction.

Verification: `pnpm test -- tests/api/usage-route.test.ts tests/api/events-route.test.ts`; assert all responses omit `authRef`, credential paths, bearer tokens, cookies, and raw provider payloads.

### 5. Build the Usage UI from the existing shell and shadcn block structure

- [ ] Optionally inspect the official `dashboard-01` shadcn block source as structural inspiration and hand-copy only the section-card, compact data-table, and chart-free status-row patterns into the existing settings dialog. The in-repo primitives are the acceptance baseline, so implementation must remain self-contained if the external block source is unavailable. Do not run the shadcn generator against this repository, add a second sidebar, or duplicate the app shell.
- [ ] Add `UsageManager` as the global owner of usage data and refresh lifecycle. Hydrate it from the runtime API, treat named quota events as invalidation signals that trigger a debounced/coalesced authoritative `GET /api/usage` re-read with at most one in-flight request and one trailing re-read, and use bounded polling only as a fallback while the event stream is disconnected. A replay burst must produce one fetch rather than one fetch per event, and resync plus one authoritative read stops fallback polling. Run a display ticker at the countdown cadence so age-based staleness and `reset_pending_refresh` are re-derived locally even when no server event arrives. Give each awaited refresh operation a client timeout; if its completion event is abandoned by a runner restart or lost stream, clear the operation-scoped `refreshing` flag, retain the snapshot-derived state, and surface translated stale/retry guidance. Guard every timer/event response by generation and expose narrow selectors so the Home header does not re-render on unrelated conversation changes.
- [ ] Add a compact header summary showing the most constrained available window, next reset, stale/error indicator, and an action to open Usage. Define “most constrained” as the highest numeric `usedPercent` among currently available, non-stale windows; exclude token/credit-only or unknown windows from that comparison, and use stable provider/account/window order as the tie-break. If no comparable percent window exists, show a translated unavailable/unknown summary while retaining all rows in Usage. Use existing shadcn `Button`, `Badge`, `DropdownMenu`/`Popover`, `Skeleton`, and `Tooltip` primitives.
- [ ] Add the Usage settings tab with provider/account grouping, session/five-hour and weekly rows, usage bar/percentage, reset countdown plus absolute time, credits if available, source/freshness, and a manual refresh control per account and for all accounts. Render only allowlisted `errorCode` and descriptor `sourceKey` values through `t()` with translated generic fallbacks; include `provider_contract_changed` as a distinct stable error code for schema drift and never render diagnostic `errorMessage`. Use the generic translated window label for any unknown descriptor key and the display-ticker freshness semantics defined above; clamp countdowns at zero and never imply a reset has been confirmed solely because the clock elapsed.
- [ ] Implement empty, loading, refreshing, available, stale, login-required, unavailable, provider-error, and narrow/mobile states. Do not rely on color alone; include text/icon/status semantics and accessible labels.
- [ ] Keep settings-dialog chrome compact: the tab label supplies context, no repeated Usage heading/subtitle, and helper text only where it explains privacy, freshness, or login boundaries. Refresh is an explicit action; no usage setting is added in this milestone, so there is no new persistence/reset/migration surface beyond durable server snapshots.
- [ ] Use `src/lib/formatters/usage.ts` for locale-aware `Intl.NumberFormat`, `Intl.DateTimeFormat`, and `Intl.RelativeTimeFormat` values; keep countdown pluralization, source labels, error reasons, and status phrases in translated `t()` keys rather than interpolated English fragments. Add all visible strings to every locale file under `shared/locales/*.json`, enumerate that glob in the contract test, and subscribe components with `useI18nSnapshot()` where language changes must repaint. Test at least one non-English locale for formatted percent/time output.

Verification: `pnpm test -- tests/app/usage-manager.test.ts tests/app/usage-settings-panel.test.tsx`; run the interface build and a responsive browser check after implementation. The candidate Playwright test requires explicit user approval before execution.

### 6. Complete lifecycle, security, and operational verification

- [ ] Add the lifecycle scenario for the mandatory non-blocking startup refresh and a refresh in flight during runner stop/restart. Assert startup and stop decisions are observable, no orphaned child or timer remains, and the next runner rebuilds from durable snapshots.
- [ ] Add redaction assertions for server logs, named events, API DTOs, and frontend error objects.
- [ ] Add a boundedness test for provider output, database rows, refresh concurrency, and spawn-per-refresh child lifetime. No refresh path may scan full conversation streams or store raw provider responses.
- [ ] Verify event replay/resync behavior remains intact for named refresh events and that the usage manager can recover with a normal API snapshot after reconnect; resync plus one authoritative read must stop fallback polling so polling never runs concurrently with a healthy stream.
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
- **Stale truth:** Preserve last-known-good values but label them stale with timestamps. The header must not present stale percentages as current.
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

- [ ] Codex and Claude provider adapters fetch real account-scoped usage without interactive login or browser-cookie access.
- [ ] Quota windows, reset times, credits, source, freshness, and failures are normalized and durably persisted.
- [ ] GET and manual-refresh runtime routes are authenticated, secret-free, deterministic, and covered by tests.
- [ ] The runner refresh manager is bounded, coalesced, observable, and cleanly stopped.
- [ ] The header summary and Settings → Usage surface cover all loading, available, stale, auth, unavailable, error, empty, desktop, mobile, accessibility, and locale states.
- [ ] Named events and `error.surfaced` make every refresh decision and user-relevant failure inspectable.
- [ ] Focused tests, typecheck, lint, interface build, and lifecycle verification pass before completion is claimed.
