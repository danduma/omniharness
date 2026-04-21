# Worker Launch And Inspector Design

## Goal

Make worker launch configuration real and observable.

When a user selects a worker type, model, and effort in the composer:

- the selected values must be persisted on the run,
- the spawned worker must receive that configuration,
- the conversation UI must show the effective worker configuration,
- bridge and worker failures must surface as explicit run errors instead of leaving the UI in a fake working state.

## Current Problems

- The composer `selectedModel` and `selectedEffort` controls are cosmetic and are not sent to the backend.
- Worker cards only show a minimal status line instead of the richer session information users expect from the TUI.
- Bridge polling failures are swallowed in some paths, which can leave the frontend showing activity without a visible error.
- The detailed agent payload currently omits model and context-usage fields, so the UI cannot mirror TUI-style status yet.

## Design

### Run launch contract

Add worker launch preferences to the run request and persisted run state:

- `preferredWorkerType`
- `allowedWorkerTypes`
- `preferredWorkerModel`
- `preferredWorkerEffort`

The selected worker model and effort become part of the run contract and must be visible in persisted state for later inspection, retries, and forks.

### Worker spawn contract

When the supervisor spawns a worker, it must pass through the requested model and effort when the bridge/worker type supports them.

If the requested configuration cannot be applied:

- do not silently ignore it,
- either record the effective configuration returned by the bridge, or
- fail the run with a clear message explaining that the selected configuration could not be honored.

### Bridge worker status contract

Expand bridge status responses to expose the richest session status available per worker, including when available:

- worker type
- session id
- protocol version
- current mode
- selected model
- provider
- reasoning effort
- token or context usage
- context window size
- context fullness percent
- pending permissions
- last error
- recent stderr
- timestamps

Unknown values should remain explicit `null`/missing values and must not be guessed in the frontend.

### Worker inspector UI

Upgrade worker cards from a thin terminal wrapper to a TUI-style inspector:

- always-visible compact summary row with state, model, effort, provider, context fullness, permissions count, and last update time,
- expandable detail panel with raw bridge/session metadata,
- terminal output remains available below the summary,
- if context fullness is unavailable, show `Unknown`,
- if a worker is running with a model different from the requested one, show both requested and effective values.

### Failure behavior

Bridge failures that prevent worker inspection or continued execution must be treated as real errors:

- worker status polling errors should create visible execution events,
- repeated or fatal bridge failures should fail the run,
- the run failure should persist `lastError`,
- the conversation feed should show a clear `Run failed: ...` message,
- the thinking/syncing UI should stop once the run is failed.

## Testing

- API test for `/api/supervisor` persisting model and effort on the run.
- Supervisor spawn test proving worker config is passed to the bridge.
- Bridge status route test for richer worker fields.
- UI source test for worker inspector sections and labels.
- Failure-path test proving bridge errors persist visible run failure state.

## Acceptance Criteria

- A selected worker model is no longer cosmetic.
- A selected worker effort is no longer cosmetic.
- The worker panel shows the effective model in the conversation view.
- The worker panel shows context usage/fullness when available from the bridge.
- Bridge failures stop the run and surface a clear error in the conversation.
