# Multi-Account CLI Credentials Design

## Goal

Support multiple authentication accounts per coding CLI, let users choose or automate which credentials a worker uses, and track usage/quota per account across subscription and API modes without leaking secrets.

## Current State

- The Agents settings tab ranks worker types with `WORKER_ALLOWED_TYPES` and `WORKER_DEFAULT_TYPE`.
- Runtime startup already accepts one optional `credentialProfile` and resolves profile env through `src/server/agent-runtime/external-credentials.ts`.
- `src/server/agent-runtime/manager.ts` applies project-scoped CLI homes for Codex, Claude, Gemini, and OpenCode, but credential profile env is applied after project-scoped storage is chosen.
- `accounts` and `credit_events` tables exist, but they are a thin config-backed credit model and are not a complete credential/account source of truth.
- `/api/accounts` now returns an explicit redacted DTO through `src/server/accounts/dto.ts`; event snapshots must use the same mapper and must never serialize raw account rows.
- Execution events, supervisor interventions, planning review findings, and worker entries now use append-only artifact streams for larger payloads. New account/allocation ledgers should keep hot SQLite rows small and use artifact-backed payloads if details can grow.
- Quota recovery is now a durable control-plane workflow built around `recovery_incidents`, `supervisor_scheduled_wakes`, and type-level quota blocking in `src/server/quota/type-blocking.ts`.
- Worker availability detects one installation/authentication/quota status per worker type, not per account.
- The quota tracking plan explicitly left multi-account as future work. This design makes account id part of quota and allocation from the start.

## Readiness Update - 2026-06-29

This design is still directionally correct, but implementation must account for code that landed after the original May 29 draft:

- Snapshot account redaction is a hard boundary. Any route or SSE snapshot that carries accounts must return `AccountDto`, not database rows with `authRef`.
- Account selection is a conversation/run preference, not only a visual composer detail. It must be carried through `POST /api/conversations`, `POST /api/conversations/:id/messages`, commit/direct conversation flows, and stored on `runs`.
- Quota blocking must become account-aware. A quota incident for one Codex account must not block all Codex workers if another healthy Codex account exists.
- Worker pool keys must include account-specific credential homes and credential env. Prewarmed workers must never be shared across accounts.
- Runtime prewarm must use the same account resolution and env ordering as real spawn.
- The legacy `config/accounts.yml`, `CreditManager`, and `CREDIT_STRATEGY=swap_account` surface is still present. Migrate it deliberately instead of assuming it is dead.

## Product Shape

OmniHarness should treat each usable CLI identity as an account record:

- a ChatGPT/Codex subscription login,
- a Claude subscription login,
- a Gemini OAuth login,
- an OpenCode provider login,
- an API-key backed account,
- an external credential profile,
- or a command-backed credential provider.

The user can:

- see detected CLIs and detected/default accounts,
- add additional accounts for each CLI,
- choose a specific account for a run or leave it on Auto,
- choose a per-CLI allocation strategy,
- see account-level health, identity, quota, usage, cost, last used time, and reset/wait state,
- safely set up multiple logins through isolated CLI homes.

## Recommended Approach

Use a first-class account inventory plus a server-side allocator.

Alternative 1, only expanding credential profiles, is too hidden: it can launch workers with different env, but it cannot give the UI good account status, usage, quota, or migration semantics.

Alternative 2, only storing account settings JSON, is quick but brittle: it would make allocation, usage, and secrets hard to query/test and would not fit the existing `/api/accounts` and event snapshot model.

Recommended: evolve the existing `accounts` concept into real CLI credential accounts, add account allocation/usage tables, and keep legacy settings as migration inputs and fallback compatibility.

## Data Model

Evolve `accounts` by adding fields rather than deleting the existing table:

- `cli_type`: `codex | claude | gemini | opencode`.
- `provider`: upstream provider where known, such as `openai`, `anthropic`, `google`, or `opencode`.
- `type`: keep as account billing kind, `subscription | api | external`.
- `label`: user-facing account name.
- `auth_mode`: `local_session | isolated_cli_home | api_key | credential_profile | credential_command | legacy_ref`.
- `auth_ref`: non-secret pointer only, such as `setting:ACCOUNT_SECRET_<id>`, `profile:work`, `cli-home:<id>`, or `local-default`.
- `enabled`, `priority`, `capacity`, `reset_schedule`.
- `status`, `status_checked_at`, `metadata_json`, `created_at`, `updated_at`.

Add:

- `account_secrets`: encrypted secret values keyed by account and secret kind. API responses only expose configured/preview metadata.
- `worker_credential_allocations`: durable record of `workerId -> accountId`, selected strategy, selection reason, and whether it was explicit or automatic.
- `worker_token_usage`: token/cost rows with `accountId`, `workerId`, `workerType`, model, token fields, `costUsd`, and `occurredAt`.
- `account_usage_snapshots`: cached read model for quotas, windows, spend, reset times, and source.

Keep `credit_events`, but use it as the durable account event ledger for allocation/switch/exhaustion/wait decisions, or rename only in a later migration if needed.

Keep account-related SQLite rows queryable and small. If an allocation, usage, or account event needs a large JSON payload, follow the artifact-stream pattern used by `execution_events` and `supervisor_interventions`: store a preview/hash/seq in SQLite and put the body in append-only JSONL.

DTO/API rule: database rows are private. All public account payloads, including `/api/accounts`, `/api/events?snapshot=1`, SSE update frames, and runtime-portable route responses, must pass through a whitelist DTO mapper.

## Credential Execution

Introduce `src/server/accounts/account-resolver.ts`:

- resolves account id to env/unset/metadata,
- never returns raw secrets to UI or named events,
- supports existing external profile directories and provider commands,
- supports account-specific CLI home env before project-scoped storage is applied.

Important runtime change:

- resolve account env before `applyProjectScopedCliStorage`,
- then let project-scoped storage fill only missing CLI home variables,
- then apply account/profile env,
- then compute the worker pool key using an account-aware env fingerprint.

This avoids the current single-login bias where project-scoped homes bridge the global Codex/Gemini credentials before account-specific env is known.

Apply the same ordering in every runtime path, including real spawn and prewarm. `prewarmAgent` must not resolve a different env from `spawnAgent`.

Account-aware pool keys must include at least: `CODEX_HOME`, `CODEX_SQLITE_HOME`, `CLAUDE_CONFIG_DIR`, `GEMINI_CLI_HOME`, `OPENCODE_CONFIG_DIR`, `XDG_DATA_HOME`, `XDG_STATE_HOME`, `XDG_CACHE_HOME`, provider API/token env, `PATH`, and `HOME`.

Claude-specific note: the current macOS keychain fallback injects the global Claude OAuth token when no explicit Claude credential env is set. Under account selection, that fallback must only run for `local_session` or a selected account that explicitly allows the global keychain. It must not override or leak into an isolated/account-specific Claude config.

## Multiple Login Model

For CLIs that naturally use one global login, additional subscription accounts use isolated CLI homes under app data:

- Codex: account sets `CODEX_HOME` and `CODEX_SQLITE_HOME`.
- Claude: account sets `CLAUDE_CONFIG_DIR`.
- Gemini: account sets `GEMINI_CLI_HOME`.
- OpenCode: account sets `OPENCODE_CONFIG_DIR`, `XDG_DATA_HOME`, `XDG_STATE_HOME`, and `XDG_CACHE_HOME`.

The UI can show a login command for each account, for example `CODEX_HOME=<account-home> codex login`. The app should not delete credential files when an account is removed or disabled; account removal is a DB/settings action unless the user explicitly chooses a separate credential-file cleanup action.

## Allocation Strategy

Create `src/server/accounts/account-allocator.ts`.

Inputs:

- worker type,
- optional explicit `accountId`,
- run/project/model/effort,
- configured per-CLI strategy,
- current account status/usage/quota,
- open quota wait incidents,
- active leases/allocations.

Strategies:

- `manual`: use the selected account only; fail visibly if unavailable.
- `priority`: try enabled accounts in priority order.
- `round_robin`: spread workers across healthy accounts.
- `quota_balanced`: prefer the account with the most remaining usable capacity.
- `subscription_then_api`: prefer subscription accounts, spill to API accounts after quota exhaustion.
- `wait_for_reset`: pause on the chosen subscription account instead of switching.

The default migration should preserve current behavior as `priority`, with one default account per detected CLI.

Every worker spawn stores the selected account in `worker_credential_allocations`. Resume/recovery should reuse the same account unless the selected strategy explicitly allows a switch after quota exhaustion.

Quota blocking changes:

- replace type-only blocking (`codex` blocked) with account-aware blocking (`codex/account-a` blocked),
- keep type-level fallback only when no account inventory exists yet,
- persist the account id on quota incidents and allocation records,
- make failover select another healthy account for the same worker type before falling back to another worker type when policy allows,
- keep `wait_for_reset` tied to the originally allocated account.

## Settings And UI

Agents settings remains the owner of worker ordering, but each worker row gains an account table:

- account label,
- mode,
- identity/status,
- usage/quota,
- last used,
- enabled toggle,
- priority controls,
- status refresh,
- setup/login command.

Add account creation/editing as compact settings-dialog controls:

- Use detected login,
- Isolated CLI login,
- API key,
- Existing credential profile,
- Credential command.

Composer run settings should gain an `Account` selector when a concrete worker type is selected:

- `Auto` uses the configured strategy,
- specific account pins the run to that account.

Persist run-level choice with a new nullable `preferred_worker_account_id` column. The server treats the run value as an explicit allocation request.

Wire the run account choice through all run/message entry points:

- frontend `useHomeMutations` create, send, direct, and commit flows,
- `src/runtime/http/routes/conversations.ts`,
- `src/runtime/http/routes/conversation-messages.ts`,
- `src/server/conversations/create.ts`,
- `src/server/conversations/send-message.ts`,
- CLI options and runner payloads if CLI-created runs should support account pinning.

The server must validate that a requested account exists, is enabled, and matches the selected worker type. Invalid explicit accounts fail visibly with `error.surfaced`; automatic allocation may fall back according to policy.

All new frontend text must be added to every `shared/locales/*.json` file and rendered through `t()`.

## Migration

Add a startup migration from existing settings and rows:

1. Existing `accounts` rows:
   - fill `cli_type` from `provider` when it matches a worker type, otherwise infer from `provider`/`auth_ref`,
   - map old `type` to `subscription | api | external`,
   - set `auth_mode = legacy_ref`,
   - keep `auth_ref` unchanged as a non-secret pointer,
   - set `enabled = true`, priority by insertion order.

2. Existing default local logins:
   - on first account catalog refresh, create a `local_session` account per detected authenticated CLI if no equivalent account exists,
   - use `auth_ref = local-default`,
   - store only derived identity metadata such as email/account id hash/plan tier.

3. Existing credential profile settings:
   - `OMNIHARNESS_CREDENTIAL_PROFILES_DIR` remains the profile root setting,
   - per-CLI command settings create `credential_command` accounts,
   - default profile folders named after a CLI create `credential_profile` accounts.

4. Existing API key settings:
   - create API accounts referencing the existing encrypted setting keys where possible,
   - do not duplicate supervisor LLM keys into account secrets unless the user explicitly adds them as worker credentials.

5. Existing worker settings:
   - keep `WORKER_ALLOWED_TYPES`, `WORKER_DEFAULT_TYPE`, and `WORKER_YOLO_MODE`,
   - migrate `CREDIT_STRATEGY` into a new per-CLI allocation policy setting or table-backed config,
   - map legacy `swap_account` to `priority` or `quota_balanced` according to the existing behavior at migration time,
   - keep `CREDIT_STRATEGY` as fallback compatibility until all readers move.

6. Existing `config/accounts.yml` / `CreditManager`:
   - import rows into the account inventory idempotently,
   - treat `auth_ref` values as non-secret pointers unless they are known secret material,
   - preserve the file as a fallback compatibility source until all tests and runtime readers use the new inventory,
   - do not delete or rewrite the file during migration.

Migration must be idempotent and emit named events for migration failures or skipped invalid rows.

## Observability

Add named events:

- `account.detected`
- `account.created`
- `account.updated`
- `account.status_checked`
- `account.credential_selected`
- `account.quota_exhausted`
- `account.switch_decision`
- `account.usage_recorded`
- `account.login_required`

Add `error.surfaced` codes for account resolver failures, missing login, invalid explicit account, quota switch failure, secret decryption failure, and migration failure.

The dev event log must be enough to answer: which account was chosen, why, what failed, and whether a switch/wait was deliberate.

Snapshot and event invariants:

- account payloads are always DTOs with no `authRef`, secret setting key, token, API key, or credential command output,
- named events may include `accountId`, account label, mode, status, reason, and strategy, but never raw secret refs,
- account allocation/switch/refusal decisions are named events, not inferred from snapshots,
- user-visible allocation failures emit `error.surfaced` with stable account-specific codes.

## State Invariants

- Server is authoritative for accounts, account status, allocation decisions, usage history, and run account choice.
- Client settings draft owns only unsaved form edits.
- Account list payloads carry a revision or updated timestamp; stale refreshes cannot overwrite newer edits.
- Account status refreshes are scoped by `accountId + requestId`.
- Allocation decisions are never inferred from snapshots; they are persisted and emitted as named events.
- Secrets never appear in account payloads, snapshots, SSE events, event log, test fixtures, or worker output.
- Cached availability may render as stale, but cannot erase known account records.

## Testing

Add tests for:

- schema migration from old `accounts` rows,
- migration from old settings keys,
- migration from `config/accounts.yml` and legacy `CREDIT_STRATEGY`,
- account resolver env ordering,
- account-specific CLI home selection,
- no secret leakage in `/api/accounts`, `/api/events?snapshot=1`, SSE, logs, and errors,
- allocator strategies,
- explicit account unavailable failure,
- quota exhaustion switching from account A to B,
- wait-for-reset keeping the same account,
- worker resume reusing the recorded account,
- account-aware worker pool keys,
- prewarm using the same account env as spawn,
- account-aware quota blocking so one exhausted account does not block the whole worker type,
- UI rendering for account rows and composer account selection,
- i18n hardcoded copy coverage.

Add lifecycle scenarios for:

- two Codex accounts, first exhausted, strategy switches to second,
- explicit account selected, account missing login, user-visible failure emitted,
- reconnect/restart does not lose worker-to-account allocation,
- quota wait resolves and resumes on the same account.

## Current Milestone

Deliver account inventory, migration, account-aware worker spawn, account allocation strategies, Agents settings management, composer account choice, account-level usage rollups, and tests for the main account-switching path.

Do not try to automate every interactive login inside OmniHarness in this milestone. Generate exact per-account login commands and verify status after the user completes login in a terminal.

## Implementation Status - 2026-06-29

Implemented:

- Expanded `accounts` into a redacted account inventory and added `account_secrets`, `worker_credential_allocations`, `worker_token_usage`, and `account_usage_snapshots`.
- Added `preferred_worker_account_id` on `runs` and threaded account choice through conversation create/send, direct/commit flows, supervisor spawn, recovery, failover, and runtime prewarm.
- Added account allocation and credential resolution foundations for manual, priority, round-robin, quota-balanced, subscription-then-api, isolated CLI home, local session, legacy ref, and credential profile paths.
- Made runtime env ordering account-aware and prevented global credential bridging/keychain fallback for isolated/profile-selected accounts.
- Made quota blocking account-aware when account inventory exists, while preserving type-level fallback for legacy/no-inventory installs.
- Added composer account selection and Agents settings account controls for adding local-session accounts, toggling enabled state, and refreshing stored status, with locale keys in every locale file.
- Added idempotent account inventory migration/import from existing thin rows, `config/accounts.yml`, credential command settings, credential profile folders, and API key settings.
- Added account management routes for redacted create, update, and status refresh, exposed through both the portable runtime registry and Next route handlers.
- Added focused tests for schema, DTO redaction, allocation, resolver env, account-aware quota blocking, account-sensitive worker pool keys, migration/import, management routes, and i18n coverage.

Remaining follow-ups:

- Add richer account edit controls for changing labels, priorities, auth modes, and setup/login command generation in Agents settings.
- Add default local login detection from worker availability/authentication metadata.
- Add account usage rollup writes from live token/cost observations once per-account token extraction is available.
- Add CLI-created run support for account pinning if CLI entry points need parity with the web composer.

## Open Decision

The main product choice is whether account selection should be global-only at first or also exposed per run in the composer. This design recommends including the per-run `Account: Auto | specific account` selector because it makes the feature understandable and gives users an escape hatch when automatic allocation makes the wrong trade-off.
