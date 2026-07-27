# Managed Claude Model Gateway Design

**Date:** 2026-07-13

**Status:** Approved for implementation planning

## Purpose

Let a user install, connect, configure, and use models exposed by CLIProxyAPI from inside OmniHarness. The first supported routed model is `gpt-5.6-sol`, with the exact Claude Code behavior requested by the user, while the design remains model-agnostic.

The resulting experience must not require a shell alias, global environment changes, or edits to the user's Claude Code configuration. Native Claude models must keep working unchanged.

## Product outcome

In Settings > Agents, a user can:

1. Choose an OmniHarness-managed CLIProxyAPI service or connect an existing service.
2. Install and start the managed service.
3. Open the provider's ChatGPT/Codex sign-in flow and see when it completes.
4. Discover models from the service and add a model ID manually.
5. See those models in the existing Claude Code model picker.
6. Start, resume, prewarm, and recover Claude Code workers with the selected routed model.

For `gpt-5.6-sol`, OmniHarness launches Claude Code with behavior equivalent to:

```sh
CLAUDE_CODE_SUBAGENT_MODEL=gpt-5.6-sol \
CLAUDE_CODE_ALWAYS_ENABLE_EFFORT=1 \
CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY=3 \
ENABLE_TOOL_SEARCH=false \
claude --model gpt-5.6-sol
```

The ACP adapter is launched by OmniHarness, so the main `--model` choice is represented by `ANTHROPIC_MODEL=gpt-5.6-sol`. The gateway connection is injected only into that worker process.

## Scope

### Included

- Managed download, checksum verification, configuration, start, stop, restart adoption, and status for CLIProxyAPI.
- External-service mode for users who already run CLIProxyAPI.
- Provider OAuth URL creation and completion polling through CLIProxyAPI's management API.
- Model discovery from the Anthropic-compatible service plus user-defined model IDs.
- Routed-model entries in the existing Claude Code model picker.
- Exact environment construction for all Claude worker creation paths.
- Persistence, secret handling, named lifecycle events, explicit error surfaces, internationalized UI, deterministic tests, and a real local smoke test.

### Not included in this milestone

- Uninstalling CLIProxyAPI or deleting its credentials.
- Automatic upgrades or background release checks after installation.
- Editing shell profiles, creating aliases, or modifying global Claude settings.
- Running CLIProxyAPI on a non-loopback interface in managed mode.
- Supporting arbitrary Anthropic-compatible gateways with different management APIs. External mode still expects the CLIProxyAPI-compatible data plane; OAuth controls require its management API.
- Silent fallback from a routed model to a native Claude model.

## Existing architecture and integration points

- Settings are persisted in SQLite. Keys recognized as secrets are encrypted and are omitted from normal settings GET responses.
- Every Claude worker eventually uses `spawnAgent()` or `prewarmWorker()` in `src/server/bridge-client/index.ts`, but the base environment is currently read independently at many callers. Implementation must make the bridge functions invoke one routed-model preparation helper themselves, then audit every caller; it must not assume the existing environment reads are centralized.
- The agent runtime starts `claude-agent-acp`; it does not currently apply the selected Claude model.
- Worker pool fingerprints already include `ANTHROPIC_*` and `CLAUDE_*` variables, so a routed model can safely receive a distinct process pool.
- The agents catalog is the source for the composer model picker.
- `src/server/agent-runtime/manager.ts`, `src/server/bridge-client/index.ts`, and `src/app/home/useHomeMutations.ts` are already large. The integration must be implemented in focused modules and use those files only as delegation points.
- Server lifecycle decisions must follow `docs/architecture/lifecycle-observability-and-testing.md`.
- Quota resume currently reconstructs a worker from run-level preferred model/account/effort. That is insufficient once actual worker routing can differ, so the effective launch selection must also be persisted on each worker and used for every resume/recovery path.
- `src/server/restart-control.ts` and `src/server/dev/bridge-lock.ts` already provide injected process operations, liveness checks, PID records, and command-identity validation patterns. Extract their portable liveness/PID/command-query pieces into one shared process-ownership module and refactor the existing consumers to it. Do not reuse `createNodeRestartSystem().spawnDetached()` for the gateway because its shell/PTY logging pipeline is app-restart-specific; the gateway launches the binary directly with file descriptors and an argument array.

## Model identity

Persisted model selections need to distinguish a native Claude model from a raw gateway model ID. OmniHarness will use an internal route prefix:

```text
cliproxyapi:gpt-5.6-sol
```

`encodeClaudeGatewayModel(rawId)` and `decodeClaudeGatewayModel(selection)` are the only code paths allowed to construct or interpret this value. The raw ID is sent to Claude Code; the encoded value remains in runs, worker preferences, and UI state.

This prevents a gateway outage from accidentally turning `gpt-5.6-sol` into a native Claude request. Existing native values such as `claude-sonnet-*` remain untouched.

## Settings and durable state

The SQLite settings table remains authoritative. New stable settings are:

| Key | Meaning | Secret |
| --- | --- | --- |
| `CLAUDE_MODEL_GATEWAY_MODE` | `managed` or `external` | No |
| `CLAUDE_MODEL_GATEWAY_ENABLED` | Whether managed service should run and restart | No |
| `CLAUDE_MODEL_GATEWAY_BASE_URL` | Loopback managed URL or external URL | No |
| `CLAUDE_MODEL_GATEWAY_API_TOKEN` | Data-plane bearer token | Yes |
| `CLAUDE_MODEL_GATEWAY_MANAGEMENT_TOKEN` | Management API bearer token | Yes |
| `CLAUDE_MODEL_GATEWAY_MODELS` | JSON list of custom model IDs and optional labels | No |
| `__CLAUDE_MODEL_GATEWAY_CATALOG_CACHE` | Last valid discovery result, source, and timestamp | Internal |

Managed binaries and credentials live outside the repository under `~/.omniharness/cliproxyapi/`:

```text
versions/<version>/<binary>
managed-config.yaml
auth/
process.json
logs/
```

Directories containing credentials are mode `0700`; config, metadata containing secrets, and log files are mode `0600`. Secrets never appear in API status payloads, events, error messages, command arguments, or test snapshots.

Installation is retryable. Generated secrets are persisted in a provisional disabled state before filesystem or process operations. The same values are reused on retry. `enabled=true` is written only after readiness succeeds.

Managed files carry an OmniHarness ownership marker. If a target path exists without that marker, the operation refuses instead of overwriting it. Stop never deletes files or credentials.

## Managed installation

The installer follows this order:

1. Detect `cli-proxy-api` or `cliproxyapi` already on `PATH` and record it as the managed executable without copying it.
2. Otherwise request the latest official CLIProxyAPI GitHub release.
3. Select a supported asset for macOS, Linux, or Windows on `x64` or `arm64`.
4. Download the archive and published checksum file to a version-scoped temporary location.
5. Verify SHA-256 before extraction.
6. Defend against archive traversal and refuse unexpected executable paths.
7. List and validate archive entries before extraction, use the platform `tar` executable for official macOS/Linux `.tar.gz` assets and existing `adm-zip` support for Windows `.zip`, then extract into a staging directory.
8. Move the verified staging directory into a version-specific directory and atomically update the managed metadata pointer.

Downloads have bounded connect and body timeouts and a size cap. Failed archives remain diagnosable but are never marked current. No automatic updater is part of this milestone.

## Process ownership

`ClaudeModelGatewayService` is a Next-server singleton and the only owner of managed process transitions. Its process adapter uses the shared process-ownership primitives extracted from restart control and bridge locking, while its child launch is a direct `spawn(executable, args, { shell: false, stdio })`. It maintains:

- a monotonically increasing status revision;
- one in-flight operation per operation kind;
- executable/config/PID ownership metadata;
- bounded stdout/stderr tails with redaction;
- readiness and liveness probes;
- shutdown handlers that stop only a verified owned child.

The managed command is equivalent to:

```sh
cli-proxy-api --config ~/.omniharness/cliproxyapi/managed-config.yaml
```

The generated configuration binds only to `127.0.0.1`, defaults to port `8317`, uses the managed auth directory, and contains randomly generated data-plane and management tokens. A port collision produces an explicit error; OmniHarness does not kill or adopt an unknown process.

On app restart, the singleton verifies the recorded PID's executable, start time, and configuration arguments before considering it owned. Command inspection is platform-specific (`ps` on macOS/Linux and CIM/PowerShell on Windows) behind the shared adapter. If inspection is unavailable, OmniHarness may report the process but may not signal or adopt it. If no valid process exists and the integration is enabled, `src/instrumentation.ts` mirrors its existing `ensureSupervisorRuntimeStarted().catch(...)` pattern to schedule a bounded background start. App boot is not blocked by release downloads, OAuth, or an external network probe.

External mode never starts, stops, signals, or modifies the external process or config.

## Server-owned state machine

Gateway state is not a second test-only observability surface. The singleton produces one complete snapshot with a monotonic `revision`; the operational GET returns it, and the same redacted summary is included in the canonical `/api/events?snapshot=1` payload. All decisions still travel as named frames on the existing SSE ring buffer with IDs and replay behavior:

```text
mode: managed | external
enabled: boolean
installation: absent | installing | installed | unsupported | error
service: stopped | starting | running | unreachable | error
oauth: disconnected | connecting | connected | error
operation: null | { id, kind, state, error? }
models: { custom, discovered, updatedAt?, stale }
```

Legal transitions include:

- `absent -> installing -> installed`
- `stopped -> starting -> running`
- `running -> stopped`
- `disconnected -> connecting -> connected`
- any active transition to its specific `error` state

Repeated install and start requests share the same in-flight promise. A stale probe may not overwrite a later revision. Cached models may be displayed, but they do not prove service readiness. OAuth completion polling is server-owned and updates this same state/event stream; the browser does not create a competing source of truth.

## API

The runtime-registry route and Next adapter expose:

```text
GET  /api/integrations/claude-model-gateway
POST /api/integrations/claude-model-gateway
```

GET returns the complete redacted status snapshot. POST accepts one action:

- `install`
- `start`
- `stop`
- `connect`
- `refresh_models`

Authentication is required. Mutations enforce same-origin checks. Inputs are schema-validated and unknown fields/actions are rejected. `connect` returns the OAuth URL and state; the UI opens it and retains a visible fallback link. The server owns bounded completion polling and emits the result through the canonical status/event path.

The generic settings POST continues to own draft configuration such as mode, external URL, tokens, and custom models. Operational actions are immediate and visually separate from Save/Cancel settings semantics.

## Provider and model clients

The client uses bounded requests to:

- check readiness;
- `GET /v1/models` with the data-plane token;
- request a Codex OAuth URL from the management endpoint;
- inspect management auth files to recognize OAuth completion.

This OAuth store is intentionally separate from `src/server/supervisor/codex-auth.ts`, which reads `~/.codex/auth.json` for the supervisor's own Codex fallback. OmniHarness does not copy or reuse those credentials: CLIProxyAPI owns its provider auth directory and token refresh. UI copy calls this the **gateway provider connection** so it is not confused with the existing Codex CLI account.

The client parses only required response fields and preserves the original error cause internally. It never logs tokens, OAuth URLs containing sensitive query data, or auth-file contents.

Model refresh validates, trims, deduplicates, and caches returned IDs. Custom IDs reject control characters, empty values, duplicates, and oversized input. Installation seeds `gpt-5.6-sol` as a custom model so it remains selectable even before discovery succeeds.

The agents catalog merges native Claude models, encoded custom models, and encoded cached discoveries. Catalog reads never probe an external service. Source and staleness remain available to the settings status UI.

## Worker routing

Before any rows are created, conversation/prewarm entry points call `prepareClaudeGatewayLaunch()` for a routed model. It validates the compound selection, checks readiness, and returns a request-fenced prepared selection containing the encoded durable model, raw runtime model, `credentialSource: "gateway"`, and sanitized connection metadata. No secret is persisted in that selection. If preparation fails, the request returns before creating a plan, run, worker, message, or artifact.

Immediately before transport, `spawnAgent()` and `prewarmWorker()` call the same helper themselves (deduplicating the readiness check). This covers callers that currently assemble base environments independently. The helper:

1. Recognizes and decodes `cliproxyapi:<raw-model>`.
2. Loads decrypted gateway settings.
3. Ensures the selected managed service is ready, or probes the configured external service.
4. Refuses the spawn with a stable surfaced error if readiness fails.
5. Marks the runtime request `credentialSource: "gateway"` and supplies the required process-only environment:

```text
ANTHROPIC_BASE_URL=<gateway base URL>
ANTHROPIC_AUTH_TOKEN=<data-plane token>
ANTHROPIC_MODEL=<raw model ID>
CLAUDE_CODE_SUBAGENT_MODEL=<raw model ID>
CLAUDE_CODE_ALWAYS_ENABLE_EFFORT=1
CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY=3
ENABLE_TOOL_SEARCH=false
```

6. Adds the officially documented Claude Code gateway variables `ANTHROPIC_CUSTOM_MODEL_OPTION=<raw model ID>` and `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1` only when a parsed installed Claude Code version meets the documented minimum capability table (`/v1/models` discovery requires 2.1.129+). These are gateway usability settings, not part of the user's literal alias contract; an unknown/older version leaves them out without weakening the required route.
7. Sends the raw model ID to the agent runtime while retaining the encoded selection in durable OmniHarness state.
8. Persists the effective encoded model, effort, and launch credential source on the worker row at reservation time, before background spawn begins. Resume, quota recovery, reconciliation, observer recovery, failover, planning review, and prewarm use that worker-level selection when one exists; legacy rows fall back to the run selection.

Inside the agent runtime, `credentialSource: "gateway"` is accepted only for `type="claude"`, `accountId=null`, and a routed request prepared by the server. That path skips credential-profile/account/keychain bridging, applies project-scoped storage, then overlays the gateway environment last before computing the pool fingerprint and spawning `claude-agent-acp`. This ordering prevents normal Claude credential resolution from deleting or replacing `ANTHROPIC_AUTH_TOKEN`/`ANTHROPIC_BASE_URL`. Native Claude keeps the existing credential path.

Spawn, resume, recovery, and prewarm use the same helper. Native Claude selections bypass it. There is no fallback or model substitution. Tests enumerate every current `readRuntimeEnvFromSettings()` + `spawnAgent()`/`prewarmWorker()` caller so a newly missed route fails coverage.

## Compound worker selection

A routed Claude model receives credentials from the gateway, not from an Anthropic/Claude account row. To preserve the repository's compound-selection invariant, model compatibility resolution produces and transmits this complete tuple together:

```text
{ workerType: "claude", accountId: null, model: "cliproxyapi:<id>", effort: <selected effort> }
```

The composer displays the account portion as the derived, non-editable **Gateway provider connection** while a routed model is selected. The server rejects a non-null Claude account combined with a routed model before creating any plan, run, worker, message, or artifact. Switching back to a native Claude model restores the last compatible Claude account through the existing compound-selection Manager. Runs persist the intentional null account together with the encoded model and effort.

## UI design

The Agents settings panel gets a focused `ClaudeModelGatewaySettings` section built from existing shadcn/ui primitives. The closest official settings shell is `sidebar-13`, but the existing OmniHarness settings dialog already provides that shell; implementation should reuse it rather than install or overwrite a block.

The section has clear, progressive states:

- Not installed: explanation and **Install and start**.
- Installed/stopped: **Start**.
- Running/disconnected: **Connect gateway provider**.
- Connecting: status plus a reusable sign-in link.
- Connected: account status, model list, and **Refresh models**.
- Error: exact actionable error and retry.
- External: endpoint and secret inputs, connection health, and model controls; no process-management buttons.

Operational buttons act immediately. Mode, endpoint, secret replacements, and custom model edits use the dialog's normal Save/Cancel flow. Saved tokens use existing configured-secret semantics, so an empty field does not erase them.

`ClaudeModelGatewayManager` is the single frontend state owner. It uses operation/request IDs and server revisions so a slower status response cannot overwrite a newer user action. It consumes the existing live-event connection for service changes and performs GET only for bootstrap/manual refresh. React effects may subscribe; they must not mirror authoritative state into component-local state.

All visible copy and accessibility labels use `t()` and exist in every locale. Status changes use an accessible live region. The layout must work at desktop and narrow settings widths.

## Lifecycle events and errors

Typed named events cover every server decision:

- install started, completed, and failed;
- service starting, started, stopped, and start failed;
- OAuth started, completed, and failed;
- model refresh completed and failed;
- worker spawn refused because the routed gateway was not ready.

User-relevant failures also emit `error.surfaced` with stable codes. Reuse generic process codes where their meaning is exact, and add only domain failures that the existing union cannot express:

- `claude_gateway.install_failed`
- `claude_gateway.oauth_failed`
- `claude_gateway.model_discovery_failed`
- `claude_gateway.not_ready`
- `claude_gateway.unsupported_platform`
- `claude_gateway.invalid_configuration`
- `process.spawn.failed` for managed-service start failures
- `process.stop.failed` and `process.orphaned_after_restart` for owned-process failures

Every event identifies its operation and relevant run/worker where available. Errors are specific and preserve causes without exposing secrets. Silent returns and bare catches are forbidden.

## Safety and failure behavior

- All network and readiness operations are bounded.
- Release assets are checksum-verified before execution.
- Managed mode binds only to loopback.
- Process stop verifies ownership before signaling.
- Secrets are encrypted at rest and redacted at every boundary.
- Unknown existing files and processes are never overwritten or killed.
- An unavailable routed model fails before worker spawn and remains visibly selected.
- External mode does not mutate the external service.
- No production fault-injection branches are added for testing.

## Acceptance criteria

- A fresh supported machine can install and start CLIProxyAPI from Settings without a terminal.
- A user can complete provider OAuth and see the connected state without exposing credential contents.
- `gpt-5.6-sol` appears under Claude Code and starts with the exact required routing and effort/concurrency/tool-search values.
- Any valid user-added or discovered raw model ID can follow the same route.
- Native Claude models behave exactly as before.
- Routed spawn, prewarm, resume, and recovery share one environment builder and never silently fall back.
- Managed service state survives app reload/restart and enabled services are safely re-adopted or restarted.
- External services are supported without process ownership.
- Every state transition and user-facing failure is observable by named events and stable error codes.
- Unit, API, UI, lifecycle, build, real-binary smoke, and running-app journey checks pass.
- Test conversations and persisted artifacts created by verification are removed before handoff.

## Implementation constraints

- Work in the current checkout. Do not create a branch or worktree.
- Preserve all unrelated dirty-worktree changes.
- Do not delete files or credentials in this milestone.
- Do not add a parallel worker-content persistence layer.
- Do not grow the existing oversized runtime, bridge, and home mutation modules beyond small delegation hooks.
- No new package dependency is planned: use the platform `tar` executable for official macOS/Linux `.tar.gz` releases, existing `adm-zip` for Windows `.zip`, and existing YAML support. Probe `tar` before download and surface `unsupported_platform` if it is unavailable. Add a dependency only if implementation proves this strategy insufficient and document why.

## Validated external contracts

- [Claude Code model configuration](https://code.claude.com/docs/en/model-config): `CLAUDE_CODE_SUBAGENT_MODEL`, custom model picker entries, and supported-capability metadata.
- [Claude Code LLM gateway configuration](https://code.claude.com/docs/en/llm-gateway): `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, and opt-in `/v1/models` discovery through `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1`.
- [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI): official release assets, configuration example, data API, and management API implementation used by install/connect tests. Pin tests to the installed release's observed contract and fail explicitly if upstream changes it.
