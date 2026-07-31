# Selected Conversations Require Scoped Runner Snapshots

**Date:** 2026-07-31  
**Context:** Interface/runner split and the multi-runner Vite client

## Symptom

Opening a direct conversation URL in the Vite interface left the main panel on
"Loading conversation..." even though the runner was online and both the run
and transcript existed. Session `b13b642f2778` reproduced the failure.

## Root cause

The home lifecycle stopped at the runner connection's global catalog snapshot
whenever a runner connection existed. That snapshot was sufficient for sidebar
navigation, but it had no selected-run scope (`snapshotRunId` remained null).
As a result, the selected conversation's full-load gate never saw authoritative
data for its run and could not become ready.

## Fix

The runner connection's global snapshot now supplies home catalog data only
when no run is selected. When a route selects a conversation, the existing live
event connection manager performs the snapshot and SSE subscription with that
run's `runId`.

## Verification

- The home lifecycle regression test covers global-catalog and selected-run
  behavior.
- The lifecycle, event connection, worker stream, and conversation coverage
  suites pass together (36 tests).
- TypeScript checking and the production Vite build pass.
- Session `b13b642f2778` was opened against the rebuilt app on port 3050; its
  complete transcript rendered and the browser console remained clean.

## Prevention

A global catalog preview must never satisfy a selected conversation's full-load
gate. Tests for selected conversation loading should verify that the snapshot
and event stream carry the selected `runId`, especially when a multi-runner
connection is already active.

## Skill and documentation updates

The interface/runner split design now states the scope-completeness invariant.
The existing client/server state guidance already covers ownership, provenance,
and freshness, so no shared skill change was needed.
