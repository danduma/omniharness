# Implementation Plan: CLI Quota Tracking

Tracks per-worker quota state (subscription remaining + reset, or API spend), surfaces it on conversation cards, and shows a "waiting for quota reset" indicator with live ETA on any worker blocked on quota.

## Phase 1: Data model and parsing

1. **Schema** (`src/server/db/schema.ts`):
   - Add `worker_quota_snapshots` (per-type rows): `id`, `workerType`, `mode` (`subscription` | `api`), `windows` (JSON array of `{ window, resetAt, remainingTokens, limitTokens }` — Claude/Codex carry both 5h and weekly), `usedTokens`, `costUsd`, `currency`, `source`, `capturedAt`.
   - Reuse existing `recovery_incidents` rows with `reason = "quota_wait"` as the source of truth for "blocked" state — they already carry `resetAt`. No new waiting-state table.
2. **Parser** (`src/server/supervisor/worker-availability.ts`):
   - Extend `WorkerTokenQuotaInfo` with `mode`, `costUsd`, `currency`, and `windows[]`.
   - Update `parseWorkerTokenQuotaOutput` to capture monetary amounts (`/\$[\d,]+\.\d{2}/`) and multiple named windows ("5-hour", "weekly", "daily") where CLIs report them.
   - Mode is inferred from `getWorkerAuthenticationInfo`: `api_key` → `api`, otherwise `subscription`.
   - **Confirmed today**: `claude auth status` returns only `{loggedIn, authMethod, apiProvider}` — no remaining/limit/reset fields, no `usage`/`cost`/`quota` subcommand. Treat CLI output as login-state only and compute both windows ourselves (see Phase 2 §5). Re-verify `codex login status` and `gemini` once available — assume the same until proven otherwise.
   - Tests in `tests/api/workers-availability.test.ts` covering monetary parsing, multi-window parsing (using fixtures, in case future CLI versions add it), and the "login-only output" fallback.

## Phase 2: Event-driven polling (replaces fixed 6h timer)

Polling is driven by events and per-CLI policy, not a global cron.

1. **Per-CLI policy table** (`src/server/quota/policy.ts`):

   ```ts
   type QuotaPolicy = {
     resetCadence: "rolling-5h" | "daily-midnight-pt" | "weekly" | "rolling-5h+weekly" | "none";
     staleAfterMs: number;          // when to consider a cached snapshot stale
     pollOnTurnComplete: boolean;   // refresh after each worker turn
     scrapeFromWorkerOutput: boolean; // try parsing remaining from existing stdout first
   };
   ```

   - **claude** (Pro/Max): `rolling-5h+weekly`, `staleAfterMs: 15m`, scrape + per-turn.
   - **codex** (ChatGPT Plus/Pro): `rolling-5h+weekly`, same shape as Claude.
   - **gemini** (free): `daily-midnight-pt`, `staleAfterMs: 1h`, per-turn poll.
   - **opencode**: `none` (API spend), `staleAfterMs: 1h`, on-demand only.

2. **Service** (`src/server/quota/tracker.ts`):
   - `pollWorkerQuota(type, reason)` — fetch via `getWorkerTokenQuotaInfo`, write a `worker_quota_snapshots` row, emit `worker_quota_changed`.
   - `maybePollIfStale(type)` — skip if last snapshot newer than policy `staleAfterMs`.
   - `scheduleResetPoll(type, resetAt)` — uses existing `wake-schedule` machinery to fire `pollWorkerQuota` shortly after `resetAt`; on no-confirmation backs off (+5m → +15m → +1h).

3. **Triggers** (wired from existing call sites):
   - After each worker turn completes (in `supervisor/observer.ts` or wherever turn-completion fires) → `pollWorkerQuota(type, "turn-complete")` when policy says so. Prefer scraping from the worker's own stdout if it already reports remaining; only shell out otherwise.
   - On `quota_wait` incident open (`server/quota/recovery.ts`) → immediate `pollWorkerQuota(type, "quota-wait-open")` to capture zero-remaining state and call `scheduleResetPoll`.
   - On worker spawn attempt (`isSpawnableWorkerType` callers) → `maybePollIfStale`.
   - On `GET /api/quota/status` request → `maybePollIfStale`.
   - **API-mode spend** is derived locally from `executionEvents` token counts × `src/server/quota/model-rates.ts` (manually maintained, keyed by model id, separate input/output/cache rates). Unknown model id → log a warning and bill at zero rather than dropping the event. Do not rely on any CLI to print spend.
   - **Subscription windows** are also computed locally for now: roll up `executionEvents` token usage per worker type over the rolling 5h and trailing 7d windows. Compare against a configured plan limit (`src/server/quota/plan-limits.ts`, e.g. `claude-max-5h`, `claude-max-weekly`) to get `remaining` / `pctUsed`. `resetAt` for rolling windows is `oldestEventInWindow + windowDuration`. When a real `quota_wait` incident fires with a parsed `resetAt`, that value takes precedence over our local estimate.

4. **Watchdog integration** (`src/server/supervisor/runtime-watchdog.ts`): registers a once-a-day safety sweep that polls any worker whose last snapshot is older than 24h — fallback only, not the primary mechanism.

5. **Schema for local window computation**: snapshot writes are still useful as a cached read-model, but the source of truth is `executionEvents`. Add a small index on `(workerId, createdAt)` if not already present to keep rollups fast. The 7-day rollup is bounded by event retention; if events older than 7d get pruned we lose accurate weekly tracking — document this constraint.

## Phase 3: Per-worker QuotaStatus and API

1. **Derivation** (`src/server/quota/status.ts`):

   ```ts
   getWorkerQuotaStatus(workerId): {
     mode: "subscription" | "api",
     subscription?: { windows: Array<{ window, remainingTokens, limitTokens, pctUsed, resetAt }> },
     api?: { spentUsd, currency, periodStart, periodEnd },
     waiting?: { since, resetAt, incidentId, source }, // present iff open quota_wait incident
     snapshotAt
   }
   ```

   The waiting badge picks the soonest-resetting window when multiple are active.

2. **API endpoints**:
   - Extend the existing run/conversation detail endpoint to include `quota: QuotaStatus` per worker (avoids extra round-trip per card).
   - `GET /api/quota/status` returns all worker types (used by the settings panel and global badge).
   - Emit `worker_quota_changed` over SSE on snapshot write, incident open, and resume — same path as `worker_session_resumed` in `notifyEventStreamSubscribers`.

3. **CLI command** (`src/server/cli/options.ts`, new `src/server/cli/stats.ts`):
   - `omniharness stats` prints a table: type, mode, remaining/limit per window, next reset, spend, last snapshot age, current waiting state.

## Phase 4: UI

All reset times render in the user's local timezone. Polls scheduled for Gemini's daily reset still resolve the boundary in `America/Los_Angeles` server-side; the badge displays the same instant in the browser's local TZ.

1. **Worker quota chip** on conversation card — render inside `src/components/home/ConversationSidebar.tsx` next to the existing `CliBrandIcon` block (~line 312), and in the conversation header rendered by `ConversationMain.tsx`:
   - Subscription: `73% · resets May 31` with thin progress bar, color-graded green/amber/red. Multi-window workers show the tightest constraint with a tooltip listing all windows.
   - API: `$4.21 this cycle`.
   - Tooltip includes source CLI command and snapshot age.

2. **`WorkerQuotaWaitBadge`** (new component): hourglass glyph + live countdown driven by `waiting.resetAt`, rendered in user-local time. Renders on the conversation row (next to or replacing the awaiting-user indicator in `ConversationSidebar.tsx` lines 287–302 when a quota wait is the actual blocker), the worker row in `WorkersSidebar.tsx`, and inside `ConversationMain.tsx` when the active run is blocked. States:
   - Future reset → `resets in 2h 14m`.
   - Past reset, worker not yet resumed → `resuming…` until `worker_session_resumed` event arrives.
   - Stale snapshot → muted color with `?` affordance.

3. **Settings panel** (`src/components/settings/UsagePanel.tsx`):
   - Current-status table grouped by worker type, one row per window.
   - "Currently waiting" section listing any open `quota_wait` incident with its ETA.
   - Historical bar chart of token usage / spend over the last 30 days from `worker_quota_snapshots`.
   - Route into the settings dialog.

4. **API client** (`src/lib/api-client.ts`): fetchers for `/api/quota/status` plus typed handling of the new SSE event.

## Phase 5: Tests

All tests live under the existing `tests/` suite alongside today's quota tests (`tests/server/quota/`) and are picked up by the standard vitest run — no harness changes needed. Each test file owns DB cleanup with `db.delete(...)` in `beforeEach`, matching the pattern used in `tests/supervisor/observer.test.ts`.

### Unit — parsing and detection (`tests/api/workers-availability.test.ts`, extend existing)

- `parseWorkerTokenQuotaOutput` extracts `costUsd` from `$12.34` and `USD 12.34` shapes.
- Parser returns one entry per named window when output mentions both "5-hour" and "weekly" (fixture-driven, even though real CLIs don't emit this today).
- Login-only output (`{"loggedIn":true,"authMethod":"claudeai"}`) yields `mode: "subscription"` and empty `windows[]`.
- Unsupported worker type returns `status: "unavailable"`.

### Unit — plan detection (`tests/server/quota/plan-detection.test.ts`, new)

- Mock the keychain reader to return a synthetic `Claude Code-credentials` blob; assert `subscriptionType: "pro"` + `rateLimitTier` flow into the returned `tier`.
- Mock `~/.codex/auth.json` with a JWT whose payload contains `chatgpt_plan_type: "prolite"`; assert the JWT is decoded base64url without signature checks and `tier === "prolite"`.
- JWT decode rejects garbage payloads with `tier: "unknown"`, never throws.
- On Linux/Windows (mock `process.platform`), keychain reader is not invoked; returns `tier: "unknown"`.
- **Security**: assert the returned object contains no `accessToken`, `refreshToken`, or `id_token` field. A negative test that fails if any of those keys leak into the result.

### Unit — rate table and spend (`tests/server/quota/model-rates.test.ts`, new)

- Known model ids resolve to per-MTok rates; unknown ids return zero-rate and emit one warning per process (verified via spy).
- `computeCostUsd({model, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens})` matches hand-computed values for a sample.

### Unit — token usage rollups (`tests/server/quota/usage-rollup.test.ts`, new)

- Insert synthetic `worker_token_usage` rows across a 14-day span; rollup for the 5h window includes only rows with `occurredAt > now - 5h`.
- Weekly rollup respects the trailing 7d boundary; rows older than 7d ignored.
- Multi-worker rows are partitioned by `workerType`.
- `pctUsed` against a `plan-limits.ts` entry is correct at boundary values (0, exactly-at-limit, over-limit).
- Rollup query uses the `(workerType, occurredAt)` index (asserted via `EXPLAIN QUERY PLAN`).

### Unit — status derivation (`tests/server/quota/status.test.ts`, new)

- Worker with no open incident → `waiting` is `undefined`.
- Worker with open `quota_wait` incident → `waiting.resetAt` matches the incident's `resetAt`; if the incident's `resetAt` differs from the local rollup estimate, the incident value wins.
- Multi-window worker reports all windows; the soonest-resetting one is flagged for the badge.
- `mode: "api"` returns `api.spentUsd` from rollup and never populates `subscription`.

### Unit — tracker scheduling (`tests/server/quota/tracker.test.ts`, new)

- `pollWorkerQuota` writes a `worker_quota_snapshots` row and emits `worker_quota_changed` exactly once.
- `maybePollIfStale` skips when last snapshot age < `policy.staleAfterMs`.
- `scheduleResetPoll(type, resetAt)` enqueues a wake at the right time via the existing `wake-schedule` mock harness.
- On no-confirmation (next poll still shows zero remaining), backs off `+5m`, `+15m`, `+1h` in order; max 3 retries before giving up and surfacing an error event.
- Confirmation (remaining > 0) marks the open incident resolved via the existing `markRecoveryIncidentResolved` path.

### Unit — observer hook (`tests/supervisor/observer-quota-hook.test.ts`, new)

- Emitting a `worker_turn_completed` event with `usage` metadata inserts a corresponding `worker_token_usage` row.
- The same event triggers `pollWorkerQuota` exactly once per turn (not once per tool call); verified by spying on the tracker.
- Events without usage metadata don't insert a row and don't throw.

### API tests

- `tests/api/quota-status.test.ts` (new): `GET /api/quota/status` returns the right shape for each `mode`; respects auth; emits `worker_quota_changed` SSE on demand.
- `tests/api/runs-route-quota.test.ts` (extend existing run-detail tests): the run detail payload includes `quota` per worker, with `waiting` populated when an incident is open.

### Lifecycle scenarios (`tests/lifecycle/scenarios/`)

- `quota-wait-display.test.ts` — drive a real run to a `quota_wait` incident via the harness fault-injection; assert (a) the SSE stream emits `worker_quota_changed`, (b) the run detail endpoint exposes `quota.waiting.resetAt`, (c) after a simulated reset the worker resumes and `waiting` clears.
- `quota-poll-on-turn.test.ts` — complete a worker turn end-to-end; assert a `worker_token_usage` row exists and the latest snapshot reflects updated remaining.
- `quota-reset-schedule.test.ts` — open a quota wait with `resetAt = now + 100ms`; advance fake timers; assert `pollWorkerQuota` fires once, confirms reset, resolves the incident, and worker resumes.

### UI tests (`tests/ui/`)

- `worker-quota-chip.test.ts` (new) — renders subscription vs API mode correctly; multi-window picks tightest constraint; tooltip surfaces snapshot age.
- `worker-quota-wait-badge.test.ts` (new) — countdown updates per tick (fake timers); states: future / past / resuming / stale; reads `waiting.resetAt` in user-local TZ.
- `conversation-sidebar-quota.test.ts` (extend or new alongside `sidebar-layout.test.ts`) — when a run has an open quota_wait incident, the wait badge replaces the awaiting-user indicator next to `CliBrandIcon`.
- `settings-quota-panel.test.ts` (new) — `UsagePanel` shows one row per window per worker type, lists waiting workers separately, renders the 30-day chart.

### Locale tests

- `tests/ui/i18n-hardcoded-copy.test.ts` already enforces that all new UI strings live in `shared/locales/`. Adding quota copy will be validated automatically; ensure all 8 locale files are updated.

### Security tests (`tests/server/quota/plan-detection-leak.test.ts`, new)

- Snapshot the full result of `detectPlanTier()` and assert it does not match `/sk-ant-|sk-|ey[A-Za-z0-9_-]{20,}/`.
- Same assertion on `worker_quota_snapshots` row JSON, on `/api/quota/status` response, and on the `worker_quota_changed` SSE payload. Prevents future regressions that accidentally leak OAuth material into telemetry.

## Resolved decisions (2026-05-15)

- **API spend**: derive locally from `executionEvents` × `model-rates.ts`. No reliance on CLI output.
- **Subscription windows**: also derive locally from `executionEvents` against `plan-limits.ts`, since `claude auth status` only returns login state and there is no `usage`/`cost`/`quota` subcommand. Real `quota_wait` incident `resetAt` overrides the local estimate when present.
- **Timezone**: reset times render in user-local time; scheduling logic for Gemini still resolves the boundary in `America/Los_Angeles`.
- **Multi-account**: single-account for now. Schema is designed to allow a future `accountId` column on `worker_quota_snapshots` and on any per-account `plan-limits.ts` row, but the first cut keys everything by `workerType` only. Avoid baking the single-account assumption into UI selectors — leave a single "Account" slot in the chip so adding a switcher later is additive.

## Plan-tier auto-detection (no settings UI needed)

Each CLI persists subscription metadata locally; we read it instead of asking the user.

- **Claude**: macOS keychain item `Claude Code-credentials` (service name). JSON value contains `claudeAiOauth.subscriptionType` (e.g. `"pro"`, `"max"`) and `claudeAiOauth.rateLimitTier`. Read via `security find-generic-password -s "Claude Code-credentials" -w` on macOS. Linux/Windows store this differently — fall back to `~/.config/anthropic/...` (verify path on those platforms) and finally to "unknown plan, no limit enforced".
- **Codex**: `~/.codex/auth.json` → `tokens.id_token` is a JWT. Decode the payload (base64url, no signature verification needed — we trust the local file) and read `https://api.openai.com/auth.chatgpt_plan_type` (values seen: `prolite`, `pro`, `plus`, `team`, etc.) plus `chatgpt_subscription_active_until` for plan expiry.
- **Gemini**: no plan field in `~/.gemini/` config based on inspection — likely needs an API call against the user's account, or stays "unknown / assume free tier daily limit" until we find a source.
- **OpenCode**: API-only, no plan tier concept.

Implementation lives in `src/server/quota/plan-detection.ts`, called once on startup and on auth status changes. Result is cached and fed into `plan-limits.ts` lookup (`{worker: "claude", tier: "pro"} → {fiveHour: N, weekly: M}`). User can still override in settings if auto-detection picks the wrong tier.

**Security note**: these files contain live OAuth tokens. The plan-detection code must (a) read only the fields it needs, (b) never log token values, (c) never persist them into `worker_quota_snapshots` or any UI-visible field.

## Resolved decisions (2026-05-15)

- **API spend**: derive locally from `executionEvents` × `model-rates.ts`. No reliance on CLI output.
- **Subscription windows**: also derive locally from `executionEvents` against `plan-limits.ts`, since `claude auth status` only returns login state and there is no `usage`/`cost`/`quota` subcommand. Real `quota_wait` incident `resetAt` overrides the local estimate when present.
- **Plan tier**: auto-detected from local CLI credential storage (see above), not user-configured.
- **Turn boundary hook**: confirmed — `observer.ts` already emits a `worker_turn_completed` event (constant at line 25). Wire `pollWorkerQuota` into the same handler that processes this event (lines 552 / 571).
- **Timezone**: reset times render in user-local time; scheduling logic for Gemini still resolves the boundary in `America/Los_Angeles`.
- **Multi-account**: single-account for now. Schema is designed to allow a future `accountId` column on `worker_quota_snapshots` and on any per-account `plan-limits.ts` row, but the first cut keys everything by `workerType` only.

## Token-usage persistence (required schema addition)

`execution_events` currently has only `id, runId, workerId, planItemId, eventType, details, createdAt` — no token columns. Token counts live in-memory on `AgentRecord.contextUsage` (`src/server/agent-runtime/manager.ts:57+`) and are not persisted, so a naive "scan executionEvents over 7 days" query has nothing to sum.

Add a dedicated table `worker_token_usage`:

```ts
{
  id, runId, workerId, workerType, model,
  inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens,
  costUsd,             // computed at write time from model-rates.ts
  occurredAt           // indexed
}
```

Indexes: `(workerType, occurredAt)` for fast 5h/7d rollups, `(workerId, occurredAt)` for per-worker views. Written on every `worker_turn_completed` event from the same observer hook that triggers `pollWorkerQuota`.

Retention check: `execution_events` has no time-based pruning today (only deleted when the parent run is deleted, per `src/app/api/runs/[id]/route.ts:518` and `scripts/delete-conversations.sh`). The new table follows the same lifecycle — rows survive until the run is deleted — so a 7-day weekly window works without retention changes. If quota history grows unboundedly, add a separate prune job that keeps the last 35 days for active workers.

## Platform scope

macOS first. Plan-detection code fails soft on Linux/Windows (returns `tier: "unknown"`, falls back to a conservative default limit, surfaces a "Couldn't detect plan tier" hint in the settings panel where the user can override).

## Gemini plan tier

No plan field exists in `~/.gemini/` config files. Ship with Gemini defaulting to free-tier daily-limit assumption, with a manual override in the settings panel. If a real Gemini account endpoint turns out to expose plan info via the cached OAuth token, swap the detection in later — additive change.

## All decisions resolved

Plan is ready to implement starting at Phase 1.
