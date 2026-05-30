# Multi-Account CLI Credentials Design

## Goal

Support multiple authentication accounts per coding CLI, let users choose or automate which credentials a worker uses, and track usage/quota per account across subscription and API modes without leaking secrets.

## Current State

- The Agents settings tab ranks worker types with `WORKER_ALLOWED_TYPES` and `WORKER_DEFAULT_TYPE`.
- Runtime startup already accepts one optional `credentialProfile` and resolves profile env through `src/server/agent-runtime/external-credentials.ts`.
- `src/server/agent-runtime/manager.ts` applies project-scoped CLI homes for Codex, Claude, Gemini, and OpenCode, but credential profile env is applied after project-scoped storage is chosen.
- `accounts` and `credit_events` tables exist, but they are a thin config-backed credit model and are not a complete credential/account source of truth.
- Worker availability detects one installation/authentication/quota status per worker type, not per account.
- The quota tracking plan explicitly left multi-account as future work. This design makes account id part of quota and allocation from the start.

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
   - keep `CREDIT_STRATEGY` as fallback compatibility until all readers move.

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
- account resolver env ordering,
- account-specific CLI home selection,
- no secret leakage in `/api/accounts`, snapshots, SSE, logs, and errors,
- allocator strategies,
- explicit account unavailable failure,
- quota exhaustion switching from account A to B,
- wait-for-reset keeping the same account,
- worker resume reusing the recorded account,
- account-aware worker pool keys,
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

## Open Decision

The main product choice is whether account selection should be global-only at first or also exposed per run in the composer. This design recommends including the per-run `Account: Auto | specific account` selector because it makes the feature understandable and gives users an escape hatch when automatic allocation makes the wrong trade-off.
