# Implementation Plan: Codex Subscription for Supervisor

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Goal

Let the supervisor use the user's existing **ChatGPT (Codex CLI) subscription** as its LLM by reading `~/.codex/auth.json` directly. No new OAuth flow, no new login UI — if the user has already run `codex login`, the supervisor can use it. Subscription billing, not API billing.

## Architecture

```
~/.codex/auth.json  ──read──▶  codex-auth.ts (sync reader, async refresher)
                                       │
                                       ▼
                          model-config.ts (provider="codex")
                                       │  builds custom fetch + headers
                                       ▼
                       @ai-sdk/openai createOpenAI({baseURL,fetch}).responses(id)
                                       │ LanguageModelV2
                                       ▼
                          Mastra Agent (supervisor + memory consolidation)
                                       │
                                       ▼
                  https://chatgpt.com/backend-api/codex/responses
```

The supervisor sees a normal `LanguageModelV2`; the Codex specifics are isolated to `codex-auth.ts` + the `codex` branch in `buildMastraModelConfig`.

## Tech stack

- `@ai-sdk/openai` — `createOpenAI({ baseURL, fetch }).responses(modelId)` builds the `LanguageModelV2`. Verify if transitively present from `@mastra/core ^1.28`; add as direct dep otherwise.
- `@mastra/core` `MastraModelConfig` accepts `LanguageModelV2` directly (`node_modules/@mastra/core/dist/llm/model/shared.types.d.ts:52`). No custom gateway needed.
- `proper-lockfile` or equivalent — advisory lock during `auth.json` writes.
- Existing settings encryption (`runtime-settings`) — for storing `SUPERVISOR_LLM_PROVIDER=codex`.

## Current milestone

Phase 0 (verification spikes) → Phase 1 (reader). Implementation order is sequential phase-by-phase; no parallelism until Phase 4 (UI) which can fork from Phase 3 (model wiring) once `model-config.ts` lands.

## Wire contract (verified)

- Endpoint: `https://chatgpt.com/backend-api/codex` (paths like `/responses`)
- Headers per request:
  - `Authorization: Bearer <tokens.access_token>`
  - `chatgpt-account-id: <tokens.account_id>`
  - `OpenAI-Beta: responses=experimental`
- Refresh endpoint: `POST https://auth.openai.com/oauth/token` with `grant_type=refresh_token`, `refresh_token`, `client_id` (Codex CLI public client id, to be confirmed in Phase 0).

## File map

Files to **create**:
- `src/server/supervisor/codex-auth.ts`
- `src/app/api/codex-auth/status/route.ts`
- `tests/server/supervisor/codex-auth.test.ts`
- `tests/server/supervisor/codex-auth-refresh.test.ts`
- `tests/api/codex-auth-status-route.test.ts`
- `tests/api/codex-auth-status-route.security.test.ts`
- `tests/supervisor/model-config-codex.test.ts`
- `tests/ui/codex-subscription-card.test.ts`

Files to **modify**:
- `src/server/supervisor/model-config.ts` — add `codex` provider branch; explicit Codex case in selection; sync vs async signature (see feedback #2).
- `src/server/supervisor/index.ts` — audit `formatSupervisorError`, `extractQuotaResetInfo`, any direct `llmConfig.apiKey` access for JWT leak.
- `src/server/supervisor/memory-consolidation.ts` — same call sites use the new config.
- `src/server/supervisor/runtime-settings.ts` (if applicable) — allow `codex` as a stored provider value.
- `src/server/settings/...` — provider option list.
- `src/components/settings/AgentsSettingsPanel.tsx` (or whichever component owns the supervisor LLM section — confirm via Grep for `SUPERVISOR_LLM_PROVIDER`) — add Codex card; hide/disable API key + base URL fields when `provider === "codex"`; localize provider labels.
- `shared/locales/*.json` — new keys for Codex card, status, error states.
- `package.json` / `pnpm-lock.yaml` — `@ai-sdk/openai` if needed.
- `src/server/runs/recovery.ts` / observer (if they emit supervisor errors) — wire new named events.

Files to **read** (for orientation, not edit):
- `src/server/supervisor/worker-availability.ts` — pattern for handling auth/availability errors.
- `docs/superpowers/plans/2026-05-15-cli-quota-tracking.md` — Phase 6 handoff target.

## Non-goals

- Implementing a device-code or browser OAuth login flow inside omniharness. The user logs in via `codex login` in their terminal.
- Supporting Codex subscription as a worker model setting — that already exists via the Codex CLI worker. This plan only covers the **supervisor** LLM.
- Exchanging the OAuth `id_token` for an API-billed `sk-…` key (evergreen's approach). We want subscription billing, not API billing.
- Globally signing the user out of `codex` from omniharness (feedback #4). "Disconnect" only flips the supervisor provider back; it never touches `auth.json`.

## Phase 0: Verification spikes (do these before coding)

These two unknowns can invalidate the implementation; resolve first.

- [ ] **Step 1 (feedback #3):** Verify whether `codex` CLI exposes any refresh mechanism. Current `codex login --help` only shows `status`. Investigate: does `codex login status` opportunistically refresh? Does any internal subcommand exist? Read the openai/codex source. **Decision output:** either keep the CLI-refresh-first fallback, or drop it and make direct refresh the only path. Document the answer in the plan and proceed.
- [ ] **Step 2:** Confirm the Codex CLI public `client_id` used for the OAuth refresh exchange. Source: `openai/codex` repository constants, or decode the JWT `aud` / `client_id` claims in a live `auth.json` (we already saw `app_EMoamEEZ73f0CkXaXp7hrann` in the user's JWT; verify it's the right value for the token endpoint).
- [ ] **Step 3:** Run a one-off Node script (in a sandbox dir, not the repo) that calls `https://chatgpt.com/backend-api/codex/responses` with our headers and a trivial `gpt-5.4` request to confirm the live wire format Mastra/`@ai-sdk/openai` will produce is accepted. This de-risks Phase 5 Step 2 before we wire anything up.

## Phase 1: Credentials reader

- [ ] **Step 1:** Add `@ai-sdk/openai` to `package.json` if not transitively present. Run `pnpm install`.
- [ ] **Step 2:** Create `src/server/supervisor/codex-auth.ts` exporting:
  - `getCodexAuthPath()` — respects `CODEX_HOME` env var, defaults to `~/.codex/auth.json`.
  - **`readCodexCredentialsSync(): CodexCredentials | null`** (feedback #2). Synchronous reader — uses `fs.readFileSync`. Validation must work in sync contexts (`validateSupervisorModelConfig`, title generation, plan-readiness). The expensive parts (refresh, network) stay async; the local file read is fast and synchronous everywhere.
  - `readCodexCredentials(): Promise<CodexCredentials | null>` — thin async wrapper for non-hot-path callers that prefer async; delegates to the sync reader.
  - Both return `null` when file missing, wrong `auth_mode`, or unparseable. Parses JWT `exp` from `tokens.access_token` (no signature verification — we trust the local file). Extracts `chatgpt_plan_type`, `email`, `chatgpt_subscription_active_until`.
  - `isCodexCredentialsExpired(creds, skewSeconds = 60)` helper.
  - Type: `CodexCredentials = { accessToken, refreshToken, accountId, idToken, planType, email, expiresAt, subscriptionActiveUntil, lastRefresh }`.
- [ ] **Step 3:** Tests in `tests/server/supervisor/codex-auth.test.ts`: missing file, wrong `auth_mode`, malformed JSON, malformed JWT, happy path, expiry detection, sync and async readers agree.

## Phase 2: Token refresh

- [ ] **Step 1:** Based on Phase 0 Step 1 outcome, either:
  - **(a) CLI refresh exists:** add `refreshCodexCredentialsViaCli()` that shells the verified command and returns success/failure. Or
  - **(b) CLI refresh doesn't exist:** skip this step. Direct refresh is the only path.
- [ ] **Step 2:** Add `refreshCodexCredentialsDirectly(creds)` — `POST https://auth.openai.com/oauth/token` with `grant_type=refresh_token`, `refresh_token`, and the `client_id` confirmed in Phase 0 Step 2. On success, atomically write back to `~/.codex/auth.json` preserving file permissions (`0600`) and all unrelated keys (`auth_mode`, `OPENAI_API_KEY: null`, etc.). Update `last_refresh`.
- [ ] **Step 3:** Add `ensureFreshCodexCredentials()` — reads via sync reader; if expired, tries the CLI path (if applicable) then direct refresh; on total failure throws `CodexAuthRefreshFailedError` (a typed error mapped to the `codex_auth_refresh_failed` event in Phase 3).
- [ ] **Step 4:** Use a per-process advisory lock (`proper-lockfile` or sibling `.lock` file) around any write to avoid racing with a concurrent Codex CLI worker invocation.
- [ ] **Step 5:** Tests in `tests/server/supervisor/codex-auth-refresh.test.ts` with mocked fs + fetch: each refresh path success/failure, total failure error type, lock acquisition.

## Phase 3: Supervisor model wiring

- [ ] **Step 1 (feedback #1):** Fix the provider-selection bug in `getSupervisorModelConfig` at `src/server/supervisor/model-config.ts:84`. Today it picks primary only when `primaryConfig.apiKey` is set, which means `SUPERVISOR_LLM_PROVIDER=codex` silently falls back to the fallback profile (because codex never has an apiKey). Change the selection to:
  ```ts
  function hasUsableCredentials(cfg: ModelConfig) {
    if (cfg.provider === "codex") return !!readCodexCredentialsSync();
    return !!cfg.apiKey;
  }
  // ... primary picked if hasUsableCredentials(primary), else fallback.
  ```
  Add a regression test covering "provider=codex with no fallback apiKey → still picks codex" and "provider=codex with creds present → picks codex even when fallback has an apiKey."
- [ ] **Step 2:** Add `provider: "codex"` handling to `getSupervisorModelConfig`. Default `SUPERVISOR_LLM_MODEL` for codex: `"gpt-5.4"` (Responses-API-capable; configurable). `apiKey` and `baseURL` fields are unused in the codex branch — set them to `undefined`.
- [ ] **Step 3 (feedback #2):** Keep `validateSupervisorModelConfig` synchronous. For codex provider, validation calls `readCodexCredentialsSync()`; if `null`, throw a typed `CodexAuthMissingError` mapped to the `codex_auth_missing` event. No signature changes required at the four call sites (supervisor, memory consolidation, title generation, plan readiness).
- [ ] **Step 4:** Rewrite `buildMastraModelConfig` to switch on provider:
  - For `codex`: import `createOpenAI` from `@ai-sdk/openai`; build provider with `baseURL: "https://chatgpt.com/backend-api/codex"` and a custom `fetch` that:
    - calls `await ensureFreshCodexCredentials()` once per request,
    - injects `Authorization`, `chatgpt-account-id`, `OpenAI-Beta: responses=experimental` headers,
    - never logs headers or body.
    Return `provider.responses(config.model)` as a `LanguageModelV2`.
  - For existing providers: unchanged behavior (return `{ id, apiKey, url }` for the model router).
- [ ] **Step 5 (feedback #6):** Add named supervisor events with stable codes. Wire emission at the call sites that catch `CodexAuthMissingError` / `CodexAuthRefreshFailedError`:
  - `codex_auth_missing` — emitted when validation throws because creds aren't present.
  - `codex_auth_refresh_failed` — refresh attempt failed.
  - `codex_auth_unavailable` — generic catch-all (e.g. unreadable file, malformed JWT) for cases not covered by the two above.
  - Each event also produces an `error.surfaced` record carrying the stable code, a user-actionable message, and a remediation hint (`Run \`codex login\``). Add to existing event taxonomy file.
- [ ] **Step 6:** Audit `src/server/supervisor/index.ts` for any direct `llmConfig.apiKey` access in logging/`formatSupervisorError`/`extractQuotaResetInfo`. Codex creds must never reach logs. Confirm by tracing every reference returned by the grep.
- [ ] **Step 7:** Tests in `tests/supervisor/model-config-codex.test.ts`: codex provider with present creds builds a `LanguageModelV2`; missing creds throws `CodexAuthMissingError` and emits `codex_auth_missing`; custom fetch injects exactly the three required headers; provider-selection fix (feedback #1) regression.

## Phase 4: Settings UI

- [ ] **Step 1:** Add `GET /api/codex-auth/status` route (`src/app/api/codex-auth/status/route.ts`) returning `{ available: boolean, email?, planType?, expiresAt?, subscriptionActiveUntil?, lastRefresh? }`. **Never** exposes access/refresh tokens, JWT contents (beyond plan tier + email), or `account_id`. Use `readCodexCredentialsSync()`.
- [ ] **Step 2 (feedback #7):** Update provider options. Locate the source of truth (Grep for `SUPERVISOR_LLM_PROVIDER` and provider-option lists in settings components) and:
  - Add `codex` to the provider enum / options array.
  - Localize the human label (`settings.supervisor.provider.codex` → "Codex (ChatGPT subscription)") via i18n; no hardcoded user-facing string.
  - When `provider === "codex"` is selected: hide/disable the API key field, base URL field, and fallback API key field. Show a small note linking to the Codex card.
  - Default-model picker for `codex` shows only Responses-API-capable models.
- [ ] **Step 3 (feedback #4):** Add a "Codex subscription" card above the manual API-key form:
  - If `available`: status row with email, plan tier, expiry, last refresh time. Toggle/button **"Use Codex subscription for supervisor"** flips `SUPERVISOR_LLM_PROVIDER` to `codex`. A second button **"Stop using Codex subscription"** flips the provider back to whatever was previously set (or the global default). This button **does not run `codex logout`** and never touches `~/.codex/auth.json`. A separate copy block explains: "To remove your Codex login from this machine, run `codex logout` in a terminal."
  - If not available: muted state with instructions "Run `codex login` in a terminal, then reload settings."
- [ ] **Step 4:** Add i18n keys for the new strings to every locale file in `shared/locales/`. Keys: `settings.supervisor.codex.title`, `.statusAvailable`, `.statusUnavailable`, `.useForSupervisor`, `.stopUsing`, `.runLoginHint`, `.runLogoutHint`, `.planTier`, `.expires`, `.lastRefresh`, plus the provider label from Step 2.
- [ ] **Step 5:** UI tests in `tests/ui/codex-subscription-card.test.ts` covering both states, the toggle interaction, and that the API key fields are hidden when codex is the active provider.

## Phase 5: End-to-end verification

- [ ] **Step 1:** Manual smoke test: with `codex` logged in, set provider to `codex` via the UI, run a conversation, confirm the supervisor produces tool calls and that requests hit `chatgpt.com/backend-api/codex` (verify via a one-time `DEBUG_CODEX_FETCH=1` env flag that logs only the request URL — never headers/body).
- [ ] **Step 2:** Verify Mastra serializes the Responses API correctly across multi-turn with memory enabled. Known historical bug area around reasoning items. If it breaks, add a request transformer to strip unsupported fields.
- [ ] **Step 3 (feedback #5):** Expiry path test uses **a temp `CODEX_HOME` fixture**, not the real `~/.codex/auth.json`. Concretely: copy the real file to a `tmp/` directory, set `CODEX_HOME=$PWD/tmp`, mutate the copy to have an expired JWT, run the supervisor, confirm refresh fires. Never mutate real user state.
- [ ] **Step 4:** Race test: spawn a Codex CLI worker and a supervisor heartbeat concurrently (also against a temp `CODEX_HOME` fixture), confirm the advisory lock prevents corruption of `auth.json`.
- [ ] **Step 5 (feedback #8):** Security tests. Add `tests/api/codex-auth-status-route.security.test.ts` and assertions in supervisor error tests:
  - `GET /api/codex-auth/status` response body must not contain any of `accessToken`, `refreshToken`, `idToken`, `account_id`, raw JWT strings, or the file path. Assertion uses a substring match against the response JSON.
  - Thrown `CodexAuthMissingError` / `CodexAuthRefreshFailedError` `.message` and `.toJSON()` must not contain any token material.
  - Supervisor `error.surfaced` events serialized to the SSE stream must not contain token material. Drive this with a snapshot test.
  - Log capture during a forced refresh (success + failure paths) must show zero matches for `Bearer `, `eyJ`, `rt_`, or the user's `account_id`.

## Phase 6: Worker-side reuse (handoff to `cli-quota-tracking`)

- [ ] **Step 1:** Export `readCodexCredentialsSync` and the JWT parser from `codex-auth.ts` for reuse by `src/server/quota/plan-detection.ts` (planned in `2026-05-15-cli-quota-tracking.md`). Do not duplicate parsing logic.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| `getSupervisorModelConfig` falls back away from codex when no apiKey is set | Feedback #1 fix in Phase 3 Step 1 with regression test |
| `codex auth refresh` doesn't exist | Phase 0 Step 1 spike before coding; direct-refresh path always implemented |
| Sync vs async signature mismatch in 4 validation call sites | Phase 1 Step 2 provides a sync reader; validation stays sync |
| `codex logout` in the UI nukes user's global Codex login | Feedback #4 — no logout button; only provider flip; copy explains terminal step |
| Mastra/AI SDK serialization mismatch with Responses API | Phase 0 Step 3 + Phase 5 Step 2 smoke tests |
| Race writing to `~/.codex/auth.json` vs Codex CLI worker | Advisory lock (Phase 2 Step 4); test in Phase 5 Step 4 |
| Token leak in logs / SSE / status endpoint | Phase 5 Step 5 security tests are mandatory before merge |
| Real `auth.json` corrupted by test runs | Feedback #5 — all tests use `CODEX_HOME` temp fixtures |
| OpenAI changes the subscription endpoint contract | Pin constants in `codex-auth.ts`; CI smoke test against stub |
| User has `auth_mode: "apikey"` not `"chatgpt"` | Reader returns `null`; UI shows "not available" state |

## Out of scope (future work)

- Anthropic / Claude subscription as supervisor (Claude Code login). Same pattern would apply; defer until requested.
- Surfacing Codex quota/usage in the supervisor settings panel — that ships in `2026-05-15-cli-quota-tracking.md`.
- Driving `codex login` from the web UI. Requires opening the user's browser to the device-code flow; the CLI already does this well.
- A "global sign out of Codex" button in omniharness UI (feedback #4). Belongs in the Codex CLI, not here.
