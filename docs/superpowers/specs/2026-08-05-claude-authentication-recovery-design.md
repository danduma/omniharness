# Claude Authentication Recovery

**Date:** 2026-08-05

## Goal

When a Claude worker cannot answer because its selected account is no longer authenticated, OmniHarness must identify the failure as an account problem, preserve the conversation, and guide the user through Claude's supported remote login flow.

The first milestone opens Claude's authorization URL in the user's normal system browser and asks the user to paste the returned authorization code into OmniHarness. The waiting login process runs on the same runner and under the same account environment as the Claude worker, so successful login repairs the credential that the conversation will actually use.

Browser extensions, injected callback scripts, native callback relays, and automatic code capture are explicitly deferred.

## First User and Core Job

The first user is the person running coding-agent conversations through OmniHarness, possibly with the interface and runner on different machines.

The core job is: recover a Claude conversation after authentication expires without losing the conversation, opening a terminal manually, or guessing which runner/account must be repaired.

Supporting jobs are:

- understand that Claude authentication failed rather than the conversation being corrupted;
- sign in to the exact account selected by the failed worker;
- see whether login is starting, waiting for a code, verifying, completed, expired, cancelled, or failed;
- retry or resume the failed conversation after authentication succeeds;
- return after a page reload without mistaking stale client state for a live login process;
- inspect the server's decisions and errors through named events and tests.

## Confirmed Failure

Session `cf466dfc2492` proves the current problem:

- the run and unified worker transcript are intact;
- the saved Claude session was found and reattached;
- the first prompt failed with `Authentication required`;
- the UI rendered the mutation error as `Recover conversation — Ask failed: Authentication required`;
- no recovery incident or account-focused error explained that signing in was the required action.

This is both an error-classification failure and a missing recovery journey.

## User Journey

1. A Claude prompt or recovery attempt returns a recognized authentication failure.
2. The server records the run as needing recovery, associates the failure with the selected account, emits `account.login_required`, and emits `error.surfaced` with stable code `account.login_required`.
3. The conversation renders a Claude sign-in notice instead of a generic Ask/Recover error. The notice identifies the account label and preserves the failed conversation action.
4. The user selects **Sign in to Claude**.
5. The runner starts one bounded Claude login operation for that account using Claude's subscription login command and the selected account's resolved environment.
6. When the login process prints a valid Anthropic authorization URL, OmniHarness opens it:
   - web: a new tab/window in the browser displaying OmniHarness;
   - Electron: the system default browser through the native bridge;
   - VS Code: the system default browser through `vscode.env.openExternal`;
   - mobile: the platform external-browser handler.
7. OmniHarness shows the account, the authorization host, a single-line authorization-code field, **Complete sign-in**, **Open link again**, and **Cancel**.
8. The user completes Claude authentication in the browser, copies the returned code, pastes it into OmniHarness, and selects **Complete sign-in**.
9. The runner writes the code only to the waiting login process's stdin and waits for a bounded terminal result.
10. On success, the server runs an authentication-status check under the same account environment. Process exit alone is not sufficient proof.
11. The account status and worker catalog refresh. The conversation notice changes to **Claude is signed in** and offers **Resume conversation**. It must not automatically submit an old prompt unless the recovery operation still owns the currently selected failed action.
12. Resume uses the existing saved Claude session and unified transcript recovery path.

If the popup is blocked, OmniHarness keeps the login operation alive and presents an ordinary clickable authorization link. If the user closes the browser tab, the operation remains in `awaiting_code` until cancelled or expired.

## State and Ownership

The server owns the authoritative login state. A dedicated `ClaudeLoginManager` owns at most one live login operation per runner/account pair:

`starting -> awaiting_code -> verifying -> authenticated`

Terminal alternatives are:

- `failed`
- `cancelled`
- `expired`

Each operation has a random `operationId`, `accountId`, creation time, expiration time, process ownership, and optional associated `runId`/`workerId`. The authorization URL and code are volatile secrets and are never written to SQLite, JSONL, logs, execution events, error payloads, or browser storage.

The client uses a global manager keyed by runner identity and `operationId`. Async start, submit, cancel, status, and event results must prove that the runner identity, account ID, and operation ID still match before changing visible state. Cached client state may render a preview but cannot claim that an operation is live after reload; the server snapshot/status response is authoritative.

Closing the dialog does not silently cancel the operation. Explicit **Cancel** does. Expiration terminates the process and requires starting a fresh OAuth attempt.

## Server Boundaries

The login service is account-specific, not a general remote-shell endpoint.

- It accepts only an enabled Claude `local_session` account.
- It resolves credentials and environment through the same account resolver used by worker launch.
- It spawns a fixed argument vector for Claude subscription login; the browser or client cannot supply a command, executable, arguments, working directory, or environment.
- It uses a PTY because Claude's login flow is interactive.
- It parses bounded terminal output for an HTTPS authorization URL whose hostname is on the explicit Anthropic allowlist.
- It strips terminal control sequences before parsing or returning display text.
- It accepts one bounded code value, rejects control characters and oversized input, appends the terminal newline server-side, and never echoes the code.
- It has startup, awaiting-code, verification, and total-operation timeouts.
- It kills and releases the PTY on success, failure, cancellation, expiration, account deletion, or runner shutdown.
- It never reuses the general-purpose terminal routes or exposes an arbitrary terminal ID to this UI.

Proposed authenticated routes:

- `POST /api/accounts/:id/claude-login` — begin or return the account's current live operation;
- `GET /api/accounts/:id/claude-login` — authoritative operation status without secrets after the initial URL delivery;
- `POST /api/accounts/:id/claude-login/code` — submit `{ operationId, code }`;
- `DELETE /api/accounts/:id/claude-login` — cancel `{ operationId }`.

All state-changing requests require an authenticated OmniHarness session and same-origin enforcement. Multi-runner calls go through the existing runtime API for the selected runner.

## URL Handling

Opening the browser is a client-side action caused by the user's click.

For the plain web runtime, the click opens a blank named window synchronously before waiting for the server to return the authorization URL; this avoids popup blockers. Once the URL arrives and passes client-side HTTPS/hostname validation, the blank window navigates to it. Failure closes the blank window when possible and keeps an ordinary link available.

Native runtimes use their existing `openExternal` capability. No runtime injects JavaScript into Anthropic pages, reads their DOM, or attempts to intercept the callback in this milestone.

## Error Classification and Conversation Recovery

Claude authentication failures include the provider's exact forms such as `Authentication required`, `not authenticated`, revoked/expired OAuth tokens, and failed authentication responses. Classification happens at the server boundary where the worker prompt fails.

For a direct conversation:

- persist the worker terminal error;
- set the run to `needs_recovery` with the original provider error preserved;
- open or update an authentication recovery incident associated with the run, worker, and account;
- do not keep auto-resuming against the same unauthenticated account;
- emit the account and error events below;
- return a structured application error carrying `accountId`, `runId`, and `workerId` so mutation rendering cannot reduce it to a generic Ask failure.

Successful authentication resolves the authentication incident but does not silently claim the failed turn completed. Resuming the conversation remains an explicit, owned recovery transition.

## Named Events and Observability

The control plane emits:

- `account.login_required` with account, worker type, run/worker IDs when available, and a stable reason category;
- `account.login_started` with account and operation IDs;
- `account.login_awaiting_code` with account and operation IDs, but no URL or OAuth state;
- `account.login_verifying`;
- `account.login_succeeded`;
- `account.login_failed` with a sanitized reason;
- `account.login_cancelled`;
- `account.login_expired`;
- `recovery.opened` / `recovery.resolved` through the existing recovery incident contract;
- `error.surfaced` with `account.login_required` or a new narrowly scoped login-operation code for user-relevant failures.

No event contains the authorization URL, authorization code, OAuth state, PKCE challenge/verifier, token, environment values, or raw PTY transcript.

The dev event-log endpoint and headless tests must be able to establish whether login was requested, reached code entry, succeeded/failed, and resolved recovery without inspecting rendered UI.

## UI Surface

The existing conversation recovery notice is the primary surface. Authentication is not buried exclusively in Settings.

The notice and login dialog use existing shadcn primitives: `Button`, `Dialog`, `Input`, and the existing error/status components. No new major screen or dashboard is introduced.

All user-facing copy lives in every `shared/locales/*.json` file and renders through `t()`. React components subscribe with `useI18nSnapshot()`.

Settings may also show **Sign in** for a Claude account detected as unauthenticated, using the same manager and routes. This is a secondary entry point, not a separate implementation.

Desktop and mobile keep the primary action visible. The code field uses an appropriate text input mode, permits password-manager-neutral paste, and does not persist its value. Leaving the dialog clears the client draft after the server accepts or cancels it.

## Persistence

Claude owns credential storage. OmniHarness neither copies nor encrypts Claude OAuth tokens.

OmniHarness persists only:

- the account record and status already owned by the account subsystem;
- the run/worker failure and recovery incident;
- sanitized named lifecycle events.

Live login operations are process-local because their PTYs cannot survive a runner restart. On restart, any previously visible nonterminal operation becomes `expired`/unavailable from the client's perspective, and the user starts a new attempt. No stale code submission may attach to a new operation.

## Security and Trust Boundaries

- Allow only HTTPS Anthropic/Claude authorization hosts explicitly expected from the installed Claude flow.
- Treat terminal output, URL text, and error text as untrusted provider output.
- Never render terminal output as HTML.
- Never accept executable/argument/environment input from the browser.
- Never place the authorization code in a URL, event, query cache, analytics payload, or log.
- Rate-limit start and code-submission attempts per authenticated OmniHarness session and account.
- Use constant ownership checks on runner/account/operation IDs.
- Do not mark the account authenticated until an account-scoped status command confirms it.
- Do not automatically resume a conversation after page navigation or selection changes.

## Testing

Implementation follows test-first development.

Server unit and route tests cover:

- exact authentication-failure classification;
- structured `account.login_required` errors and named events;
- fixed-command spawn and account-specific environment resolution;
- ANSI-stripped, chunk-split authorization URL parsing;
- rejection of non-HTTPS and non-Anthropic URLs;
- one live operation per account;
- code validation, non-echoing stdin delivery, and newline handling;
- success requiring the post-login status check;
- failure, cancellation, expiration, restart loss, and process cleanup;
- refusal of stale or mismatched operation IDs;
- absence of secrets from responses after initial URL delivery, events, and persisted records.

Client manager and component tests cover:

- browser popup opened from the direct user gesture;
- popup-blocked fallback link;
- runner/account/operation ownership guards for late responses;
- code draft clearing;
- conversation auth notice replacing the generic Ask failure;
- explicit resume after successful login;
- translated rendering for every new string.

A lifecycle scenario drives the real HTTP/SSE control plane with a fake login executable injected only through the test harness environment, not through a production fault-injection branch. It asserts the event transcript from authentication failure through successful login and recovery resolution.

A real browser journey would add confidence for popup behavior and focus return, but it requires explicit user approval before it is run.

## Acceptance Criteria

- Session `cf466dfc2492` would be described as requiring Claude sign-in, not as a generic Ask failure.
- The conversation remains intact and recoverable.
- One click starts login and opens the correct link in the normal system browser.
- The pasted code reaches only the matching waiting login process.
- Authentication is verified under the same account environment the worker will use.
- The UI shows deterministic running, waiting, verifying, success, cancellation, expiration, and failure states.
- The user can explicitly resume the conversation after success.
- Login and recovery decisions are visible as typed events.
- No OAuth secret, code, state, verifier, token, URL, or raw login transcript is persisted or logged.
- All relevant focused tests and lifecycle tests pass.

## Future Direction

The server state machine and UI manager deliberately support future automatic code delivery. A Chrome extension, Electron-controlled authorization window, or native callback relay can later submit the code through the same operation-bound endpoint. Those helpers must not change the account, recovery, security, or observability contracts defined here.
