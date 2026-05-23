# Selected Server Bootstrap Must Not Be Demoted By Cache

## Context

The home app can receive an authoritative server snapshot for the selected run during bootstrap, then run the scoped frontend-cache hydration effects for that same run. If the cache wins after bootstrap, the view model treats the selected conversation as a preview and keeps the main panel in a loading state.

## Learning

Frontend cache hydration is only a preview fallback. It must not replace or demote an already server-authoritative snapshot for the same selected run.

## Guardrail

When changing event stream hydration, test the bootstrap path with `initialSnapshotSource: "server"` and a populated same-run cache. `hydrateFromCacheScope(selectedRunId)` should return false and preserve `snapshotSource: "server"`.
