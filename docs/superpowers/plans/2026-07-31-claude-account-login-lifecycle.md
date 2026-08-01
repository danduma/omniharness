# Claude Account Login Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user connect, verify, select, inspect, log out, unregister, and explicitly purge multiple isolated Claude Code subscription accounts from OmniHarness without exposing credentials or allowing ambient Anthropic environment variables to override the selected account.

**Architecture:** Keep the existing `accounts` table, allocator, run preference, and account-aware worker pool as the source of truth. Add a Claude-specific service on each runner that launches official `claude auth` commands inside that runner's server-computed `CLAUDE_CONFIG_DIR`, using a session-bound PTY for browser and headless/SSH login. Persist a durable operation lease on the account row, keep OAuth terminal output and process handles memory-only, fence the bridge from new account work during destructive operations, reconcile interrupted leases on runner startup, and expose every decision through typed named events.

**Tech Stack:** TypeScript, Node.js child processes and `node-pty`, Drizzle/SQLite, Fetch-compatible runtime routes, SSE, React 19 Manager classes, existing shadcn/Base UI primitives, xterm.js, Vitest, lifecycle HTTP/SSE scenarios, Playwright for deterministic UI coverage.

**North Star Product:** OmniHarness offers first-class, trustworthy account management for every coding CLI: connect through the provider's official flow, see real identity and health, choose an account or automatic policy per run, understand quota and failures, and manage local credential data without OmniHarness ever reading or persisting tokens.

**Current Milestone:** Deliver the complete Claude Code subscription-account lifecycle for local and remote runners, including isolated login, real status verification, safe worker launch, reconnect/cancel behavior, logout, unregister-with-data-preserved, explicit purge, UI status, and control-plane coverage.

**Future Product Direction:** Apply the same provider-adapter contract to Codex, Gemini, and OpenCode after the Claude implementation proves the lifecycle. This context is not part of the checklist below.

**Final Functionality Standard:** A user can complete the entire Claude subscription-account journey from OmniHarness on desktop or mobile-sized UI, including headless/SSH authorization-code entry, and deterministic tests prove that the correct isolated account—not an ambient API key, gateway, local session, or another profile—is used. No fake login screen, copied token, hidden terminal state, or silent failure qualifies as completion.

---

## Approved product decisions

- OmniHarness will integrate the official `claude auth login/status/logout` commands; it will not vendor, shell through, or depend on `claude-account`.
- Each additional Claude subscription account uses an OmniHarness-owned directory under `app-data/account-cli-homes/claude/<accountId>/config`, selected with `CLAUDE_CONFIG_DIR`.
- The account row is created disabled before login so the operation has a durable subject. It becomes enabled only after a successful account-scoped status verification.
- Official Claude Code owns credential creation, storage, refresh, and revocation. OmniHarness stores only the directory pointer and safe identity/status metadata.
- The login UI uses the real CLI in an authenticated terminal. This preserves Claude Code's browser flow and its authorization-code fallback for SSH, containers, and remote runners.
- The selected runner owns the database row, profile directory, Claude process, terminal buffer, status probe, logout, unregister, and purge. The interface and central web client never touch another runner's filesystem or run Claude locally on its behalf.
- Disable, log out, unregister, and purge remain separate actions:
  - **Disable** blocks new allocations and leaves the active credential and files untouched.
  - **Log out** runs official Claude logout, keeps the account row and non-credential profile data, and marks the account as requiring login.
  - **Remove from OmniHarness** removes the inventory record and dependent account records but preserves the profile directory.
  - **Purge local data** is an explicit destructive action that removes the inventory record and the exact server-owned profile directory after a second confirmation.
- Remove and Purge are alternative terminal actions. After Remove, the retained directory is no longer manageable from OmniHarness; Purge must be chosen before removal. The confirmation text states this plainly, and the live journey uses separate disposable accounts to test the two outcomes.
- Logout, unregister, and purge are refused while a non-terminal worker is allocated to the account. Disable remains available because it affects only new allocations.
- Existing worker processes are never switched to a different account. New workers and prewarmed workers receive the selected account's exact environment and account-aware pool key.
- The implementation works in the current checkout. It must not create a branch or worktree.

## User stories and acceptance criteria

1. **Connect:** As a user, I can name a second Claude account, optionally prefill an email or require SSO, complete Claude's official login, and see the verified email/subscription type before using it.
2. **Headless/remote:** As a user connected to a remote runner, I can copy the URL printed by Claude and paste the returned authorization code into the same terminal.
3. **Return/revisit:** If I close and reopen settings while the runner remains alive, I can reattach to the login terminal. If the runner restarted, the account shows an interrupted/login-required state and offers Retry rather than pretending login is still running.
4. **Selection safety:** When I select an isolated Claude account, ambient Anthropic API keys, auth tokens, OAuth tokens, base URLs, and the macOS global-keychain bridge cannot override it.
5. **Status:** Refresh performs a real account-scoped `claude auth status --json` probe and updates safe identity/status metadata. The client cannot submit an arbitrary status value.
6. **Failure/recovery:** Missing or incompatible Claude binaries, nonzero login exits, malformed status JSON, timeouts, cancellation, cross-profile credential bleed, runner replacement, and runner restart all produce an accurate visible state plus named events and `error.surfaced` where user action is needed.
7. **Manage:** I can disable, retry login, log out, unregister without deleting files, or explicitly purge local data, with active-worker protection and clear destructive confirmation.
8. **Privacy:** Account DTOs, snapshots, named events, errors, logs, SQLite, and durable test artifacts never contain credential contents, authorization codes, real OAuth URLs, or terminal output. Deterministic tests may use an obviously fake `.invalid` authorization URL only inside the in-memory terminal/browser fixture so link handling can be verified.

## File map

### Files to create

- `src/server/accounts/cli-home.ts` — single server-owned resolver for account CLI-home roots and Claude config paths; validates that destructive targets remain beneath the account-home root.
- `src/server/accounts/claude-auth-contract.ts` — Claude auth environment scrubbing, command arguments, status parsing, safe identity projection, profile-directory permissions, and installed-CLI capability checks.
- `src/server/accounts/claude-account-auth-service.ts` — serialized account-auth state machine; owns managed PTYs, timeouts, verification, cancellation, restart reconciliation, logout, active-worker refusal, unregister, and purge orchestration.
- `src/runtime/http/routes/account-auth.ts` — thin authenticated/same-origin routes for connect, operation lookup, cancel/retry, logout, unregister, and purge; delegates decisions to the service.
- `src/interface/home/ClaudeAccountAuthManager.ts` — global Manager for the connect-dialog draft and volatile operation ownership; fences stale requests by runner identity, account id, operation id, and request id.
- `src/components/settings/ClaudeAccountConnectDialog.tsx` — compact login-01-derived form and the managed account-auth terminal/status surface.
- `src/components/terminal/ManagedTerminalViewport.tsx` — reusable xterm viewport for a server-created terminal id, with stream replay, resize/input batching, copyable/clickable HTTP(S) links, and no automatic process destruction on ordinary dialog unmount.
- `tests/server/accounts/claude-auth-contract.test.ts` — pure environment, parsing, installed-CLI capability, isolation, path, permission, and redaction contract tests.
- `tests/server/accounts/claude-account-auth-service.test.ts` — deterministic service/state-machine tests with an injected fake PTY/CLI adapter.
- `tests/app/claude-account-auth-manager.test.ts` — request ownership, stale result, runner switch, resume, and terminal-exit manager tests.
- `tests/ui/claude-account-connect-dialog.test.tsx` — rendered dialog states, accessible controls, compact settings content, responsive classes, and destructive confirmation tests.
- `tests/lifecycle/scenarios/claude-account-auth-lifecycle.test.ts` — black-box HTTP/SSE lifecycle scenario using a temporary fake `claude` executable through the normal PATH contract.
- `tests/e2e/claude-account-auth.spec.ts` — deterministic browser test for narrow/desktop layout, terminal replay/input/link handling, close/reopen, focus restoration, and destructive confirmations against the fake runner CLI.

### Files to modify

- `src/server/accounts/account-resolver.ts` — use the shared CLI-home resolver and clear conflicting Claude auth/gateway variables for `isolated_cli_home` accounts.
- `src/server/accounts/account-allocator.ts` — explicitly reject authenticating, login-required, auth-failed, disabled, and quota-blocked accounts from automatic allocation.
- `src/server/agent-runtime/manager.ts` — preserve identical credential ordering in spawn and prewarm; add focused assertions/tests rather than a second auth path.
- `src/server/agent-runtime/types.ts`, `src/server/agent-runtime/http.ts`, `src/server/agent-runtime/worker-pool.ts`, and `src/server/bridge-client/index.ts` — carry account id into live/prewarmed records and add bridge-side `quiesceAccount`/`resumeAccount` operations that fence new spawns before logout/unregister/purge.
- `src/server/terminal/terminal-manager.ts` — add a server-only managed-command terminal constructor and lifecycle subscription API while retaining the bounded output/replay/reaper behavior.
- `src/components/InteractiveTerminal.tsx` — delegate xterm rendering to `ManagedTerminalViewport`; retain existing shell-creation behavior.
- `src/runtime/http/routes/accounts.ts` — make status refresh server-authoritative and route generic deletion through shared account-removal checks; keep raw account rows private.
- `src/runtime/http/routes/index.ts` — register the new account-auth routes.
- `src/runtime-api/types.ts` and `src/runtime-api/domains/index.ts` — add typed connect/operation/cancel/retry/logout/unregister/purge calls for every runtime surface.
- `src/server/events/named-events.ts` — add Claude account-auth transitions and stable surfaced error codes.
- `src/server/db/schema.ts` and `src/server/db/index.ts` — add durable account-operation lease columns, bump the schema version, and backfill existing rows safely.
- `src/server/runner/run.ts` — reconcile expired or foreign-owner account operations before the HTTP server starts; stop managed auth terminals during runner shutdown.
- `src/server/accounts/dto.ts` and `src/shared/home-types.ts` — whitelist safe lifecycle/identity fields only; never expose `authRef`, config paths, operation terminal output, or credentials.
- `src/components/settings/AgentsSettingsPanel.tsx` — extract account-row actions from the growing worker panel, open the connect dialog for Claude, and render truthful account states.
- `src/interface/home/HomeApp.tsx` and `src/interface/home/useHomeLifecycle.ts` — configure/reset the auth Manager on runner changes and let server snapshots remain authoritative for the account inventory.
- `shared/locales/en.json` plus every other `shared/locales/*.json` file — add all labels, status copy, decision-critical helper text, confirmation text, and errors through `t()`.
- `tests/server/accounts/account-resolver.test.ts` — prove isolated Claude env cleanup.
- `tests/server/agent-runtime/http.test.ts` and `tests/server/agent-runtime/worker-pool.test.ts` — prove spawn/prewarm environment parity and account-specific pool isolation.
- `tests/server/accounts/account-routes.test.ts` — replace client-supplied fake status assertions with real injected probes; cover auth route authorization, DTO redaction, and action semantics.
- `tests/runtime-api/adapter-contract.test.ts` and the Electron/Capacitor/web runtime API suites — prove every surface exposes the same account-auth contract.
- `tests/ui/settings-dialog.test.ts` — preserve settings information architecture and assert that account management remains compact rather than becoming another nested settings page.
- `package.json` / `pnpm-lock.yaml` — update only if implementation proves a link helper is required; prefer xterm's existing link-provider API and avoid a new dependency.

### Files deliberately not added

- No credential table or token-copying layer: Claude owns credentials inside its selected config directory.
- No second JSON registry: SQLite `accounts` remains the inventory source of truth.
- No parallel event stream: auth events use the existing named-event SSE stream and replay/resync contract.
- No new general settings key: connect-dialog drafts are volatile Manager state; account identity/status and operation leases are server-persisted; profile files are provider-owned and never rewritten by OmniHarness.
- No separate screen or route shell: the existing Agents settings panel is the discoverable owner.

### UI block/component starting point

The official shadcn catalog has authentication blocks but no settings-account block. Use the compact stacked form structure from `login-01` as the starting point, adapted inside the existing shadcn `Dialog`; omit its page wrapper, branding, card, and ordinary password fields. Reuse the repository's existing `Dialog`, `Input`, `Switch`, `Button`, `DropdownMenu`, `Badge`, and `ErrorNotice` primitives. Do not install a page-oriented block into the Vite app. The implementation trace should record that `login-01` was inspected and structurally adapted because direct CLI OAuth is not a conventional web login form.

### File-growth guard

- `AgentsSettingsPanel.tsx` is already about 500 lines; account list/action rendering must move into a focused component rather than extending the file substantially.
- `named-events.ts` is about 918 lines; the new event union is still below the 1,200-line threshold, but implementation must re-check and split account events into a type-only module if it would cross 1,200.
- `accounts.ts` stays focused on inventory CRUD/status; new long-running auth handlers live in `account-auth.ts`.

### `.gitignore` coverage

The current `.gitignore` already excludes databases, WAL files, `.env*`, logs, `/tmp`, generated build output, test artifacts, and all `**/.omniharness/` directories. Account profile homes live under ignored app data and must never be added to source control. Add a regression assertion only if the final resolved account-home path can fall outside existing ignored runtime storage.

## State, persistence, and ownership invariants

### Server state machine

```text
unregistered
  -> authenticating (row exists, enabled=false, managed PTY running)
  -> verifying      (PTY exited successfully; scoped status/isolation checks running)
  -> available      (verified identity, enabled=true)

authenticating/verifying
  -> login_required (user cancel, runner restart, CLI reports logged out)
  -> auth_failed    (spawn, timeout, incompatible CLI, malformed output, or isolation failure)

available/disabled/login_required/auth_failed
  -> authenticating (Retry)

available
  -> disabled       (Disable; credential and files retained)

disabled
  -> available      (Enable only after a scoped status probe verifies login)

available/disabled
  -> login_required (successful official logout)

quota_blocked/unknown
  -> login_required (scoped preflight verifies login, then official logout succeeds)

available/disabled/login_required/auth_failed/quota_blocked/unknown
  -> unregistered   (remove; files retained)
  -> purging        (account fenced; files and DB cleanup pending)
  -> unregistered   (purge completes; files removed)
```

- The selected runner owns account identity, status, enabled state, timestamps, allocation eligibility, auth process ownership, filesystem mutations, and destructive decisions. Its per-runner SQLite database and `app-data/account-cli-homes` root are co-located under that runner's instance root.
- Add nullable account columns `lifecycle_operation_id`, `lifecycle_operation_kind`, `lifecycle_operation_owner`, `lifecycle_operation_started_at`, `lifecycle_operation_deadline_at`, `lifecycle_operation_error_code`, `lifecycle_previous_status`, and `lifecycle_previous_enabled`. Together with typed `accounts.status`, safe `metadata.identity`, and `updatedAt`, these form the durable read/lease model. Raw PTY output, terminal id, OAuth URL/code, PID, and credential contents are never persisted.
- Bump `DB_SCHEMA_VERSION` and add idempotent `PRAGMA table_info(accounts)` migrations for those columns. Existing null/unknown statuses remain compatible and normalize to `unknown`; existing local/API/legacy accounts receive no fabricated operation. Migration tests open a pre-change database and prove account DTO redaction/backfill.
- The runner lock already enforces one authoritative server process per instance root. Within that process, the service serializes operations and claims a lease with a compare-and-set update over `(accountId, updatedAt, lifecycle_operation_id IS NULL)`. At most one interactive Claude login runs per runner. Duplicate same-operation requests return the owned operation; competing requests receive a typed busy refusal.
- Operation ownership is `runnerInstanceId`. Runner startup reconciles leases owned by another/replaced instance or past deadline: probe authenticating/verifying accounts, complete them only if the isolated profile verifies, otherwise mark `login_required` and emit `account.auth_interrupted`. `purging` rows resume idempotent purge cleanup. Startup never silently leaves a fake running state.
- Offline runners reject mutations at the `RunnerConnection` boundary and render the saved account snapshot as unavailable/stale. A replacement runner with a different `runnerInstanceId` never attaches to the old in-memory terminal; it reconciles only its own database/profile root and emits the ownership change.
- Runner shutdown kills owned auth PTYs and emits terminal/interruption outcomes before normal process teardown.
- A login terminal has a bounded ten-minute deadline. Status/logout probes use short bounded timeouts and capped stdout/stderr. Timeouts are source constants, not frontend or `.env` settings.
- Quota-blocked and migrated/unknown accounts remain removable and purgeable. Logout from either state first requires a valid scoped probe showing that the isolated profile is logged in; a logged-out probe normalizes to `login_required`, and an invalid/unknown probe refuses Logout without changing provider files. No account status becomes an inventory trap.
- Account profile directories are created `0700` where supported. OmniHarness does not parse or rewrite `.claude.json`, `.credentials.json`, settings, history, plugins, or other provider-owned files; successful `claude auth login` plus scoped status verification is the only completion contract.
- Purge resolves and validates the exact account directory, refuses a symlink or unexpected target, and never accepts a client path.
- Destructive mutation first claims the durable operation lease and sets `enabled=false`/a non-allocatable lifecycle status in one short transaction. It then calls bridge-side `quiesceAccount(accountId)`, which atomically fences future spawn/prewarm, kills account prewarms, and reports live/starting agents. Any active result refuses the action, restores the prior row state, and calls `resumeAccount`; success keeps the fence until logout/remove/purge reaches its terminal state.
- Bridge-fence release is explicit: successful Logout commits `login_required`/disabled and then resumes the bridge; successful Remove resumes only after the account row is gone; successful or recovered Purge resumes only after filesystem and database cleanup are complete. A failed Logout always runs a scoped status probe before releasing the fence: verified logged-in restores the prior row, verified logged-out commits `login_required`/disabled, and an unknown probe result leaves the account disabled with `auth_failed`; it never blindly restores `available`. A retryable Purge failure stays `purging` and fenced. Startup re-establishes every durable destructive-operation fence before accepting HTTP traffic, then resumes or rolls back it according to the same rules.
- Purge commits `status=purging` before filesystem work. If directory deletion succeeds but DB cleanup fails or the runner exits, startup/retry sees the durable purging lease and finishes dependent-row/account deletion idempotently. An already-missing directory completes only when a valid purging lease proves OmniHarness began the deletion; an otherwise missing directory is surfaced as external tampering/auth failure.
- Remove and Purge use one named database-cleanup transaction: set matching `runs.preferred_worker_account_id` to null; delete matching `worker_credential_allocations`, `worker_token_usage`, `account_usage_snapshots`, `account_secrets`, and `credit_events`; then delete the `accounts` row last. Preserve the `runs`, `workers`, `messages`, execution events, and worker JSONL/history rows themselves. There is no separate plugin/account association in the current schema; provider-owned settings/plugins remain in the retained profile for Remove and disappear only with that exact profile directory during Purge.

### Client ownership

- The selected runner's snapshot remains authoritative for its account inventory. Mutation responses may accelerate rendering but cannot overwrite an account row with an older `updatedAt` or a different runner ownership token.
- `ClaudeAccountAuthManager` owns only volatile dialog state: draft label/email/SSO, selected account id, terminal id, operation phase, current request id, and the latest public error.
- Every async result checks `(runnerProfileId, runnerInstanceId, accountId, operationId, requestId)` before changing the Manager. Switching/offlining runners or receiving `stream.resync_required` resets volatile authority and rehydrates only from the selected runner.
- Closing the dialog does not cancel the server-owned login. Cancel is an explicit action. Reopening queries the account operation and reattaches to its existing terminal when the runner still owns it.
- Terminal stream frames use a terminal-local sequence/cursor on `/api/terminals/:id/stream`; account decisions use the independent main named-event cursor on `/api/events`. If a requested terminal cursor predates its bounded buffer, the terminal endpoint emits `terminal.resync_required` and the auth dialog says the instructions are incomplete and offers Cancel/Retry. It never silently resumes from a truncated OAuth prompt.
- Loading states remain distinct: starting, authenticating, verifying, cancelling, logging out, removing, purging, completed, failed, interrupted. A generic `isLoading` flag must not replace them.

### Authentication and privacy boundary

- Define one audited `stripClaudeCredentialRoutingEnv` contract used by login, status, logout, isolation probes, normal spawn, and prewarm: remove every `ANTHROPIC_*` variable plus `CLAUDE_CODE_OAUTH_TOKEN`, `CLAUDE_CODE_USE_BEDROCK`, `CLAUDE_CODE_USE_VERTEX`, `CLAUDE_CODE_USE_FOUNDRY`, `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY`, `CLAUDE_CODE_ACCOUNT_UUID`, `CLAUDE_CODE_USER_EMAIL`, and `CLAUDE_CODE_ORGANIZATION_UUID`. The explicit model-gateway path remains separate and applies its allowlisted variables last.
- Auth subprocesses use `buildClaudeAuthChildEnv`, a minimal allowlist layered after stripping: PATH, HOME, USER/LOGNAME, SHELL, TMPDIR/TEMP/TMP, TERM, LANG/`LC_*`, upper/lowercase HTTP(S)/ALL/NO proxy variables, `SSL_CERT_FILE`, `SSL_CERT_DIR`, and `NODE_EXTRA_CA_CERTS`, plus `CLAUDE_CONFIG_DIR`. Capability/help probes override locale with `LC_ALL=C` so flag detection is deterministic; login/status/logout retain the user's allowlisted locale. Worker processes retain their normal tool environment after the same credential-routing strip.
- Do not call the global macOS Keychain fallback for an isolated account. Verification must be scoped to that account's `CLAUDE_CONFIG_DIR`.
- Before login, run a cached capability probe against the resolved binary/version: confirm `auth login` supports the requested flags, `auth status` supports JSON, and two fresh empty server-owned config directories both report logged out without consulting the global session. After login, require the connected directory to report logged in while a fresh sentinel remains logged out. Any global-Keychain/config bleed fails closed as `unsupported` before the account can be enabled; identity equality alone is never used as proof.
- Parse the installed semantic version and capability help output. Remote/headless login requires the provider version known to support authorization-code entry; unsupported/unknown versions produce `account.auth.unsupported_cli`, not a generic malformed-status error. Extra JSON fields are ignored, required field type changes are rejected, and capability results are cached by `(binary realpath, version)` with a bounded TTL.
- Safe identity metadata is limited to values returned by `claude auth status --json` such as email, auth method, API provider, subscription type, and checked time. Unknown fields are ignored, not copied wholesale.
- Redaction tests inspect serialized DTOs/events/errors and prove that fixture tokens, OAuth codes, terminal text, command environment values, config paths, and `authRef` never escape.

### Terminal attachment authorization

- Replace predictable terminal ids with random UUIDs and bind every terminal session to the authenticated OmniHarness session that created it. Managed auth terminals additionally carry immutable `{ runnerInstanceId, accountId, operationId, scope: "account_auth" }` metadata.
- `createTerminal`, account-operation lookup, terminal stream, input, resize, and close all compare the authenticated session id and runner instance before returning a terminal id or touching the PTY. A different authenticated session may request account-auth Cancel through the account service, but cannot read output or send terminal input.
- Stream tickets retain their existing short lifetime and session binding. The account terminal id is never placed in the named-event stream or account DTO; it is returned only in the initiating/session-owned operation response.
- Exact safe operation response:

```ts
type ClaudeAccountAuthOperationDto = {
  id: string;
  accountId: string;
  phase: "authenticating" | "verifying" | "completed" | "failed" | "cancelled" | "interrupted";
  startedAt: string;
  deadlineAt: string;
  error: { code: string; message: string } | null;
  terminal: { id: string } | null; // non-null only for the owning authenticated session
};
```

- Exact route contract:
  - `POST /api/accounts/claude/connect` body `{ label: string, email?: string, sso?: boolean }` -> `{ account: AccountDto, operation: ClaudeAccountAuthOperationDto }`. Headless/remote code entry needs no request flag: the same managed PTY always preserves the official CLI's URL and code-input flow when its capability probe says that flow is supported.
  - `GET /api/accounts/:id/auth-operation` -> `{ account: AccountDto, operation: ClaudeAccountAuthOperationDto | null }`.
  - `POST /api/accounts/:id/auth-operation` body `{ action: "retry" | "cancel" }` -> same payload.
  - `POST /api/accounts/:id/logout` -> `{ account: AccountDto }`.
  - `DELETE /api/accounts/:id` -> `{ ok: true, accountId: string, profileDataPreserved: true }`.
  - `POST /api/accounts/:id/purge` body `{ purge: true, confirmAccountId: string }` -> `{ ok: true, accountId: string, profileDataPurged: true }`.
  - All conflicts use `409`; unsupported CLI/platform uses `422`; invalid inputs use `400`; missing account uses `404`; surfaced error codes remain stable.

## Named events and surfaced errors

Add typed named events with `accountId`, `operationId` where relevant, `workerType: "claude"`, previous/next state where relevant, and stable reason codes:

- `account.auth_started`
- `account.auth_terminal_ready`
- `account.auth_verifying`
- `account.auth_completed`
- `account.auth_failed`
- `account.auth_cancelled`
- `account.auth_interrupted`
- `account.auth_retry_refused`
- `account.logout_started`
- `account.logout_completed`
- `account.logout_failed`
- `account.remove_started`
- `account.remove_completed`
- `account.remove_refused`
- `account.remove_failed`
- `account.purge_started`
- `account.purge_completed`
- `account.purge_refused`
- `account.purge_failed`
- Extend `account.status_checked` with `previousStatus`, `status`, and a stable `source/reason` without exposing command output.

Add stable `error.surfaced` codes:

- `account.auth.binary_missing`
- `account.auth.spawn_failed`
- `account.auth.failed`
- `account.auth.timeout`
- `account.auth.status_invalid`
- `account.auth.isolation_failed`
- `account.auth.unsupported_cli`
- `account.auth.busy`
- `account.logout.failed`
- `account.remove.failed`
- `account.action.active_workers`
- `account.purge.failed`
- `account.purge.unsafe_path`

Failures shown in the initiating dialog also emit `error.surfaced`; background reconciliation failures use the log surface unless user action is required. Events contain public messages/cause metadata only after credential, URL, path, and terminal-output redaction.

## Implementation tasks

### Task 1: Lock down the Claude auth and filesystem contracts

- [ ] Read `docs/architecture/lifecycle-observability-and-testing.md` before adding the account state transitions or named events below; use its event, replay, snapshot, and `error.surfaced` rules as the implementation contract.
- [ ] Add failing tests in `tests/server/accounts/claude-auth-contract.test.ts` for:
  - server-generated account/config paths and traversal/symlink refusal;
  - private directory modes on POSIX and platform-safe behavior elsewhere;
  - exact prefix/denylist removal of credential-routing variables, case variants where the platform is case-insensitive, and the minimal auth-child allowlist;
  - exact `auth login --claudeai`, optional `--email`, optional `--sso`, `auth status --json`, and `auth logout` argument construction without a shell;
  - safe parsing of logged-in, logged-out, malformed, and unknown-field status payloads;
  - safe identity projection and serialization redaction;
  - installed binary/version/help capability parsing under `LC_ALL=C`, older/missing flags, a non-English parent locale, remote authorization-code support, cache key/TTL, two-empty-dir preflight, and post-login sentinel isolation.
- [ ] Create `src/server/accounts/cli-home.ts` and move account-home computation out of `account-resolver.ts`; validate all ids and return only server-computed absolute paths.
- [ ] Create `src/server/accounts/claude-auth-contract.ts` with injected filesystem/command dependencies so tests do not touch real credentials.
- [ ] Add failing schema migration tests in `tests/server/accounts/schema.test.ts` for a pre-change accounts table, idempotent rerun, null backfill, typed unknown-status compatibility, and DTO redaction of lifecycle-owner fields.
- [ ] Add the eight nullable `lifecycle_*` lease columns to `src/server/db/schema.ts` and both create/ALTER paths in `src/server/db/index.ts`; bump `DB_SCHEMA_VERSION` and leave legacy/local/API rows operation-free.
- [ ] Use `withManagedPath`/the existing managed command resolution instead of assuming `/usr/local/bin` or a shell alias.
- [ ] Run `pnpm vitest run tests/server/accounts/claude-auth-contract.test.ts tests/server/accounts/account-resolver.test.ts tests/server/accounts/schema.test.ts` and keep the first test failure/output in the implementation notes before making it pass.

### Task 2: Add server-owned managed login terminals

- [ ] Add failing `TerminalManager` tests proving a managed terminal can launch a fixed executable/argument/env/cwd tuple, stream/replay output, accept input, report exit exactly once, stay alive while a server lifecycle subscriber owns it, and be explicitly killed.
- [ ] Add authorization tests for random ids, creator-session binding, runner/account/operation scope, guessed ids, stale operation ids, cross-session replay/input/resize/close, stream-ticket session mismatch, and terminal-buffer eviction returning `terminal.resync_required`.
- [ ] Refactor `src/server/terminal/terminal-manager.ts` so normal user shells and server-owned commands share one bounded PTY/session implementation; its server-only signature is `createManagedTerminal({ command, args, env, cwd, cols, rows, ownerSessionId, runnerInstanceId, accountId, operationId, onExit })`. Never expose arbitrary command/args/env through the public terminal-create route.
- [ ] Add lifecycle subscriptions separate from client SSE subscribers so closing/reloading the UI does not orphan or prematurely reap an active login.
- [ ] Update terminal HTTP handlers to call `authorize(terminalId, authenticatedSessionId, expectedScope?)` before lookup/input/resize/replay/close and emit terminal-local resync when `fromSeq` predates the buffer.
- [ ] Ensure managed terminal output remains memory-only, bounded to the existing byte cap, and removed when the terminal is reaped or the runner stops.
- [ ] Verify the exact terminal suites with `pnpm vitest run tests/server/terminal/terminal-manager.test.ts tests/api/terminals-route.test.ts tests/ui/interactive-terminal.test.ts tests/ui/terminal-fit.test.ts tests/ui/terminal-unified-stream-order.test.ts`.

### Task 3: Implement the Claude account auth service test-first

- [ ] Add `tests/server/accounts/claude-account-auth-service.test.ts` with injected DB/PTY/clock/command dependencies covering:
  - create-disabled -> durable lease -> auth-started -> verify -> available/enabled;
  - safe label/email/SSO validation and server-generated ids;
  - successful process exit followed by `loggedIn:false` remains login-required;
  - nonzero exit, spawn error, missing/incompatible binary, malformed status, timeout, user cancel, and cross-profile isolation failure;
  - retry reuses the account directory and does not create a duplicate account row;
  - duplicate same-account request returns the current operation; competing login is refused;
  - the service never persists or emits terminal text, OAuth URLs/codes, env values, or auth refs;
  - cancellation racing process exit, cancellation during verification, shutdown during verification, duplicate retries, expired/foreign runner leases, and runner replacement;
  - shutdown/startup reconciliation turns auth leases into available/login-required and resumes purging leases truthfully.
- [ ] Implement `src/server/accounts/claude-account-auth-service.ts` as the sole owner of login PTYs and auth transitions. Keep process handles and terminal ids in a bounded in-memory map keyed by account id; persist the typed lease columns and safe identity only.
- [ ] Claim/transition/clear leases with compare-and-set helpers that include account id, current `updatedAt`, operation id, and owner runner instance. A losing caller returns the current operation or a typed `409`; it never starts a second PTY.
- [ ] Register service startup reconciliation and shutdown cleanup in `src/server/runner/run.ts` after `dbReady` and before accepting HTTP traffic.
- [ ] Emit all auth decision/failure events through `emitNamedEvent`; no silent catches or bare early returns.
- [ ] Run `pnpm vitest run tests/server/accounts/claude-account-auth-service.test.ts tests/server/accounts/claude-auth-contract.test.ts`.

### Task 4: Make status and worker selection genuinely account-scoped

- [ ] Replace the existing route test that posts a desired status with failing tests showing the server ignores/rejects client-supplied status and invokes the correct provider probe.
- [ ] Update `src/runtime/http/routes/accounts.ts` so Claude `local_session` and `isolated_cli_home` rows call the Claude status contract with the correct config directory and sanitized environment. Return `unknown` on probe infrastructure failure rather than falsely claiming logged out; return `login_required` only for a valid logged-out result.
- [ ] Update `account-resolver.ts` so isolated Claude accounts apply `stripClaudeCredentialRoutingEnv`, while still disabling global credential bridging. Login/status/logout/sentinel and both spawn paths must import the same strip function rather than copy a list.
- [ ] Add normal-spawn and prewarm tests proving selected isolated account A gets A's config dir, selected B gets B's config dir, ambient API/gateway variables are absent, the global keychain bridge is skipped, and the worker-pool keys differ.
- [ ] Update `account-allocator.ts` tests and implementation so auth-in-progress/failure/login-required states cannot be automatically selected even if priorities tie.
- [ ] Preserve gateway routing: the explicit Claude model-gateway path continues to apply its required variables last and never masquerades as an isolated subscription account.
- [ ] Run `pnpm vitest run tests/server/accounts/account-resolver.test.ts tests/server/accounts/account-allocator.test.ts tests/server/agent-runtime/worker-pool.test.ts tests/server/agent-runtime/http.test.ts`.

### Task 5: Add safe logout, unregister, and purge semantics

- [ ] Add failing service/route/bridge tests for active-worker refusal, in-flight spawn races, account prewarm eviction, official isolated logout, unregister-with-directory-preserved, purge-with-directory-removed, purging crash recovery, symlink/unexpected-path refusal, dependent-row cleanup, run preference clearing, no run-history deletion, and Logout/Remove/Purge behavior from `quota_blocked` and migrated `unknown` states.
- [ ] Extend bridge runtime records/pool members with `accountId`; implement internal `quiesceAccount(accountId)` to establish a fence before reporting/terminating prewarms and `resumeAccount(accountId)` to release a rolled-back fence. Spawn and prewarm check the fence before and after asynchronous initialization.
- [ ] Implement a shared destructive-operation guard: transactionally claim the lease and make the account ineligible, call bridge quiesce, then check both bridge live/starting records and persisted non-terminal workers. Include blocking worker ids only in authenticated route responses/logs where safe; named events need account id, count, and stable reason. Implement the exact success/failure/startup `resumeAccount` rules above and test every release/retention branch.
- [ ] Implement logout through `claude auth logout` with the same isolated/sanitized environment. On success set `enabled=false`, `status=login_required`, refresh safe metadata, and retain settings/history/plugins.
- [ ] Route existing DELETE inventory behavior through the shared service so isolated profile files are explicitly preserved and the response reports `profileDataPreserved: true` without exposing an absolute server path. In one transaction, clear `runs.preferred_worker_account_id`, delete the five named account-dependent tables (including `credit_events`), delete the account last, and emit Remove started/completed/failed or refused events while retaining run/worker/message/event/JSONL history.
- [ ] Implement purge as a separately named endpoint requiring `{ confirmAccountId, purge: true }`; transition durably to `purging`, validate the exact server-computed directory, refuse symlinks/unexpected roots, delete the directory, then transactionally remove dependent DB records and the account row.
- [ ] Implement idempotent purge recovery: only a valid purging lease treats an already-missing directory as completed; filesystem-success/DB-failure remains purging and finishes on retry/startup. Other missing directories surface tampering/auth failure.
- [ ] Preserve failure atomicity: do not clear the row/lease before filesystem purge succeeds; do not report logout success if official logout failed; rollback state and bridge fence on refusal/recoverable failure. Emit distinct refusal/failure events for every terminal branch.
- [ ] Run `pnpm vitest run tests/server/accounts/account-routes.test.ts tests/server/accounts/claude-account-auth-service.test.ts tests/server/accounts/schema.test.ts`.

### Task 6: Expose typed runtime APIs and a race-safe client Manager

- [ ] Add failing runtime adapter-contract tests for the exact route/DTO shapes above across web, Electron, VS Code, and Capacitor adapters. Assert selected-runner targeting, offline refusal, replacement `runnerInstanceId`, and that native shells never execute Claude auth or filesystem operations locally on behalf of a remote runner.
- [ ] Register the exact routes in `src/runtime/http/routes/index.ts` with session/same-origin enforcement matching other account mutations; pass `auth.session.id` and current runner instance into the service and terminal authorization. Add OPTIONS only where the registry/runtime requires it.
- [ ] Extend `RuntimeAPIs.accounts` and `src/runtime-api/domains/index.ts` with `connectClaude`, `getAuthOperation`, `actOnAuthOperation`, `logout`, `remove`, and `purge` using concrete request/response types instead of `unknown`.
- [ ] Add `ClaudeAccountAuthManager` tests first for stale connect responses, late terminal exit after runner switch, dialog close/reopen, operation resume, explicit cancel, retry, status snapshot arriving before mutation response, and resync reset.
- [ ] Implement `ClaudeAccountAuthManager` with narrow state and explicit methods (`configure`, `begin`, `resume`, `cancel`, `retry`, `logout`, `unregister`, `purge`, `resetForRunner`). Do not introduce component-owned parallel arrays or use `useEffect` to reconcile account status.
- [ ] Wire runner identity/offline/replacement changes and both main-stream `stream.resync_required` and terminal-local `terminal.resync_required` through `HomeApp`/`useHomeLifecycle`; retain the selected runner snapshot as inventory authority and compare `updatedAt` plus runner identity before applying an accelerated mutation result.
- [ ] Run `pnpm vitest run tests/runtime-api tests/app/claude-account-auth-manager.test.ts tests/interface/runners/runner-connection.test.ts`.

### Task 7: Build the compact account-management UI and i18n

- [ ] Write failing UI tests for every user-visible state: idle form, starting, browser/authorization-code instructions, terminal running, verifying, available, quota-blocked, migrated unknown, failed with Retry, interrupted, cancelling, logging out, active-worker refusal, unregister confirmation, and purge confirmation. Quota-blocked/unknown rows still expose Remove/Purge; Logout is enabled only after the service's scoped preflight accepts it.
- [ ] Extract account chips/actions from `AgentsSettingsPanel.tsx` into a focused account section so the worker panel stays below the file-growth threshold and components subscribe only to the account/operation slice they render.
- [ ] Add a Claude-only “Connect another account” action beside the existing local-session account action. Keep existing local-login detection and account selection behavior intact.
- [ ] Implement `ClaudeAccountConnectDialog` from the inspected `login-01` stacked-form structure inside the existing Dialog:
  - label and optional email inputs;
  - SSO switch;
  - one primary Start/Retry action;
  - one decision-critical helper explaining browser and headless code entry;
  - managed terminal with copyable/clickable links and keyboard focus;
  - visible phase/status and full public error;
  - explicit Cancel that owns cancellation semantics.
- [ ] Refactor `InteractiveTerminal` onto `ManagedTerminalViewport` without changing the ordinary shell terminal behavior. Lazy-load xterm so settings does not add xterm to the initial application chunk.
- [ ] Replace tiny destructive icon clusters with the existing shadcn dropdown menu for Refresh, Enable/Disable, Log out, Remove, and Purge. Keep destructive confirmation in a Dialog and require exact account-id confirmation for purge.
- [ ] Keep content disciplined: one dialog title, no repeated “Accounts” heading, no decorative card per action, and helper text only for credential scope, browser/headless flow, preserved data, and irreversible purge.
- [ ] Add all new strings to `shared/locales/en.json` and every sibling locale file in the same change; render with `t()` and subscribe with `useI18nSnapshot()`.
- [ ] Verify responsive behavior at narrow mobile width and desktop width, focus trapping, keyboard terminal input, link activation, scroll containment, and accessible names.
- [ ] Add `tests/e2e/claude-account-auth.spec.ts` against the deterministic fake CLI/runner. Cover a 390px viewport and desktop viewport, keyboard input, clickable/copyable auth URL, dialog close/reopen and terminal replay, terminal truncation recovery, focus restoration, Remove warning, and Purge confirmation. This test does not touch a real Claude account.
- [ ] Run `pnpm vitest run tests/ui/claude-account-connect-dialog.test.tsx tests/ui/settings-dialog.test.ts tests/app/account-labels.test.ts` and the exact relevant frontend component tests.
- [ ] Run `pnpm exec playwright test tests/e2e/claude-account-auth.spec.ts` using the already-defined deterministic runner fixture.

### Task 8: Prove the control plane end to end

- [ ] Add the lifecycle scenario `tests/lifecycle/scenarios/claude-account-auth-lifecycle.test.ts`. The fixture CLI must exercise the production PATH/env/PTY/routes/events and write credentials only beneath the scenario's temporary OmniHarness root; do not add a test-only server branch.
- [ ] Assert this event transcript at minimum:
  - `account.created`
  - `account.auth_started`
  - `account.auth_terminal_ready`
  - `account.auth_verifying`
  - `account.auth_completed`
  - `account.status_checked`
  - account-specific `account.credential_selected` on a worker launch
  - logout, Remove, refusal, and Purge started/terminal outcomes in their respective cases.
- [ ] Add failure scenario cases for disconnect/reconnect terminal replay and buffer loss, cross-session/cross-runner terminal access, runner restart/replacement during login, cancellation-versus-exit races, stale operation resync, ambient Anthropic env precedence, incompatible CLI capability, active/prewarmed/in-flight worker destructive refusal, purge crash recovery, and unsafe purge target. Assert `error.surfaced` codes rather than inferring decisions from snapshots.
- [ ] Ensure scenario cleanup waits for auth background work, closes PTYs, removes only its own temporary account directories, and leaves no test conversations/account rows/artifacts.
- [ ] Run `pnpm test:lifecycle` and fix the scenario, service, or event contract rather than loosening assertions.

### Task 9: Final deterministic verification and handoff

- [ ] Run targeted lint on every changed source/test file with `pnpm exec eslint <changed-files>`.
- [ ] Run `pnpm typecheck`.
- [ ] Run the focused suites from Tasks 1-8 again after all refactors.
- [ ] Run `pnpm test` and `pnpm build`.
- [ ] Inspect the built chunks or Vite manifest to confirm the managed xterm dialog remains lazily loaded and does not inflate the initial settings/app chunk.
- [ ] Use the already-running server if available to perform non-destructive UI layout/focus verification. Do not start a duplicate server.
- [ ] Propose, but do not run without explicit user approval, an agentic live journey using real disposable secondary Claude profiles:
  - **Mission:** connect a real second account, close/reopen settings during login, finish browser or pasted-code auth, start a Claude task pinned to it, refresh status, log out, and retry. Separately connect two disposable profiles so one can test Remove-with-data-preserved and the other can test Purge; never claim that a removed row can later be purged from OmniHarness.
  - **Entry point:** Settings -> Agents -> Claude -> Connect another account on `http://localhost:3050`;
  - **Visible proof:** verified account identity/status, pinned selection in the composer/run, correct named-event transcript from `/api/events/log`, and no ambient/gateway credential override;
  - **Approval gate:** the journey changes real Claude login state and may consume subscription usage, so ask immediately before running it.
- [ ] Confirm `git diff --check`, review `git status --short`, and report only files changed by this implementation. Do not alter or clean unrelated user changes.

## Test matrix

| Risk | Deterministic proof |
| --- | --- |
| Ambient API/gateway credential wins | Resolver and runtime spawn/prewarm tests assert conflicting variables are absent for isolated subscription accounts. |
| Two account homes share credentials | Service isolation probe test simulates bleed; lifecycle fixture proves distinct homes/identity. |
| Login request arrives twice | Service returns the owned operation and spawns one PTY. |
| Two accounts login concurrently | Second operation receives `account.auth_retry_refused`/busy error; no shared process state. |
| UI switches runner mid-login | Manager owner-token test rejects the late response/exit and selected runner state remains unchanged. |
| Dialog closes or terminal SSE disconnects | Terminal replay/reattach test resumes from its terminal-local cursor; explicit Cancel is still required to stop auth. |
| Runner dies mid-login | Startup reconciliation emits `account.auth_interrupted` and leaves a retryable login-required row. |
| CLI exits zero but login is false | Service refuses enablement and emits auth failure/login-required truthfully. |
| `auth status` is malformed or slow | Bounded probe returns unknown/failure with typed event, never a fabricated available state. |
| Parent process uses a non-English locale | Capability probe forces `LC_ALL=C` and recognizes the same supported flags deterministically. |
| Provider-owned configuration is changed by OmniHarness | Contract and filesystem-spy tests prove OmniHarness creates only its containing account directory and invokes the official CLI; it never opens or writes Claude-owned config, credential, history, settings, or plugin files. |
| Two server requests claim one operation | Database compare-and-set tests prove only one durable lease wins across concurrent callers and the loser starts no PTY. |
| A stale runner owns an operation lease | Startup reconciliation tests prove a replacement runner probes auth truthfully, marks interrupted login retryable, and resumes only durable purge work. |
| Purge succeeds on disk then the database update fails | Recovery tests keep the row in `purging` and finish the dependent-row/account cleanup idempotently on retry or startup. |
| Logout fails after partially changing provider state | Scoped status decides logged-in restoration, logged-out transition, or disabled unknown failure before the bridge fence is released. |
| Another signed-in browser guesses a terminal id | Route tests prove session, runner, account, and operation binding blocks replay, input, resize, and close. |
| Remove/log out/purge during active work | Active-allocation guard refuses with named event and leaves DB/files untouched. |
| Quota-blocked or migrated unknown account becomes unmanageable | Service/route/UI tests keep Remove and Purge available, and allow Logout only after a valid scoped logged-in probe. |
| Remove accidentally deletes profile data | Route test asserts directory remains and response says data was preserved. |
| Purge escapes account root | Traversal/symlink/canonical-path tests refuse before deletion and emit stable unsafe-path error. |
| Snapshot/mutation ordering race | Manager test applies newer `updatedAt` row first and proves older mutation response cannot overwrite it. |
| Secrets leak | DTO/event/error/snapshot serialization tests search for seeded secrets, OAuth codes, URLs, terminal text, env values, auth refs, and absolute config paths. |
| Pool crosses accounts | Worker-pool test proves different config homes yield different fingerprints/keys and no member reuse. |
| Mobile UI blocks completion | Component/Playwright layout test proves terminal, code entry, actions, and confirmation remain reachable at narrow width. |
| Fake authorization link leaks into durable surfaces | Browser fixture uses only a `.invalid` URL in terminal memory; serialization/log/trace assertions prove no real OAuth URL or code reaches snapshots, DTOs, events, errors, SQLite, or durable artifacts. |

## External contracts reviewed

- Community reference lifecycle: `hamzarehmandeveloper/claude-account` usefully demonstrates isolated `CLAUDE_CONFIG_DIR`, official login/status/logout, auth-environment cleanup, and separate unregister/purge semantics. OmniHarness deliberately does **not** copy its provider-file onboarding mutation; the official Claude CLI and scoped status probe are the only credential/config writers and verification contract here.
- Anthropic's Claude Code issue #261 records `CLAUDE_CONFIG_DIR` as the supported immediate workaround for multiple CLI profiles.
- Current local Claude Code `2.1.220` exposes `claude auth login --claudeai [--email] [--sso]`, `auth status --json`, and `auth logout`.
- Anthropic's changelog records authorization-code entry for `claude auth login` when localhost browser callbacks cannot reach SSH/WSL/container sessions; the managed PTY preserves that official flow.

## Completion gate

This milestone is complete only when the deterministic suite passes, the UI exposes all approved actions and recovery states, account-scoped launch is proven for spawn and prewarm, destructive targets are proven safe, named events make every decision inspectable, and no secret-bearing material crosses the provider-owned config-directory boundary. The real-account agentic journey remains separately approval-gated and is not a substitute for deterministic verification.
