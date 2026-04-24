# Worker Detail Streaming Design

## Summary

OmniHarness currently uses two overlapping live-update paths for implementation workers:

- [`src/app/api/events/route.ts`](/Users/masterman/NLP/omniharness/src/app/api/events/route.ts) opens one long-lived SSE stream and polls the bridge every second for the global agent list.
- [`src/app/page.tsx`](/Users/masterman/NLP/omniharness/src/app/page.tsx) also starts one TanStack Query poller per active worker and hits [`src/app/api/agents/[name]/route.ts`](/Users/masterman/NLP/omniharness/src/app/api/agents/[name]/route.ts) every two seconds.

That architecture duplicates bridge traffic, creates noisy dev logs, and makes live worker rendering depend on both a global stream and N worker-specific polls. The selected approach is to make `/api/events` the default live source of truth for worker detail, and reserve `/api/agents/[name]` for explicit on-demand fetches and recovery paths.

The key product goal is not just fewer requests. It is a cleaner control plane: one live stream for current worker state, one detail endpoint for intentional inspection and actions, and no background fetches that happen only because a worker exists.

## Goals

- Remove steady-state per-worker polling from the main conversation UI.
- Keep worker cards and sidebars live without regressing rich detail.
- Preserve `outputEntries`, `currentText`, `lastText`, `pendingPermissions`, `contextUsage`, and merged error and fallback display state in the normal rendering path.
- Keep worker-detail fetches available for explicit user actions, debugging, and degraded fallback paths.
- Preserve current implementation-mode UX, including live worker cards, activity feed rendering, permission warnings, and context-usage indicators.
- Keep errors visible in the frontend instead of silently degrading.
- Reduce ACP bridge traffic and Next.js dev log noise in proportion to active worker count.

## Non-Goals

- Rebuilding the bridge protocol.
- Introducing file-based routing.
- Reworking planning or direct conversation modes as part of this change.
- Removing `/api/agents/[name]`; it remains valuable as an explicit detail endpoint and recovery surface.
- Building a fully event-driven push model from bridge to browser; this design stays within the current server-polled SSE architecture.

## Product View

### User Stories

As a builder watching an implementation run, I want worker cards to stay live without the app firing a separate background request for every active worker, so the UI feels efficient and intentional.

As a builder investigating one worker deeply, I want an explicit detail request path to remain available, so recovery and debugging still have a precise source of truth.

As a builder dealing with failures, I want stale, missing, or bridge-failed worker data to show visible degradation states, so I can tell whether the stream is healthy and what data is authoritative.

### North Star

The conversation page should behave like a single coherent live session, not a mix of one global stream plus hidden per-card polling loops.

## Current Problems

- [`src/app/page.tsx`](/Users/masterman/NLP/omniharness/src/app/page.tsx) builds `conversationAgents` by combining `state.agents` with `useQueries` results from `/api/agents/${worker.id}`.
- Those queries poll every two seconds for workers whose persisted status is `starting`, `working`, or `stuck`.
- [`src/app/api/events/route.ts`](/Users/masterman/NLP/omniharness/src/app/api/events/route.ts) already polls `${BRIDGE_URL}/agents` every second, so the app is paying both the global poll cost and the per-worker poll cost.
- The detail route currently performs useful enrichment that the SSE payload does not guarantee.
- That enrichment includes persisted fallback output when the bridge agent is missing, merged `displayText`, merged bridge and run errors, and worker-derived fallbacks for session metadata.
- The frontend agent type in [`src/app/page.tsx`](/Users/masterman/NLP/omniharness/src/app/page.tsx) is also looser than the richer payload rendered by [`src/components/Terminal.tsx`](/Users/masterman/NLP/omniharness/src/components/Terminal.tsx), which encourages route-specific fetching instead of one normalized state model.

## Design

### Core Decision

Make `/api/events` the primary live source for worker snapshots used by the conversation page. Move the worker-detail enrichment that is needed for normal rendering into the SSE assembly path. Stop background polling `/api/agents/[name]` for routine worker-card updates.

### Recommended Architecture

Use one live data path for steady-state rendering:

- browser subscribes to `/api/events`
- `/api/events` assembles normalized worker snapshots for the current app state
- the frontend renders worker surfaces directly from `state.agents`

Keep `/api/agents/[name]` for explicit demand-driven usage:

- manual refresh or debugging controls added later
- focused recovery workflows
- future detail drawers or deep-inspection surfaces
- degraded fallback if the live stream is unavailable or malformed

### Data Model

Introduce one shared server-side worker snapshot normalizer used by both:

- `/api/events`
- `/api/agents/[name]`

The normalized live worker snapshot should include the fields the UI already consumes today:

- `name`
- `type`
- `cwd`
- `state`
- `sessionId`
- `requestedModel`
- `effectiveModel`
- `requestedEffort`
- `effectiveEffort`
- `sessionMode`
- `lastError`
- `bridgeLastError`
- `runLastError`
- `pendingPermissions`
- `contextUsage`
- `outputEntries`
- `renderedOutput`
- `displayText`
- `currentText`
- `lastText`
- `stderrBuffer`
- `stopReason`
- `bridgeMissing`
- `updatedAt`

The important boundary is that the frontend should no longer need to merge a coarse stream record with a separately fetched detail record just to render normal worker UI.

### Server Responsibilities

#### `/api/events`

`/api/events` should:

- keep polling the bridge agent list on its existing cadence,
- normalize each returned agent into the shared snapshot model,
- merge persisted worker and run data where bridge data is absent or partial,
- emit worker snapshots in the `agents` field already used by the frontend,
- emit visible frontend errors if snapshot normalization or enrichment fails.

If the bridge list endpoint cannot provide enough detail for a worker, `/api/events` may enrich that worker from persisted data without issuing a second bridge request in the steady-state path.

#### `/api/agents/[name]`

The detail route should be refactored to reuse the same normalization and merge logic, but it should no longer be part of routine rendering. Its purpose becomes:

- targeted detail retrieval,
- debugging parity,
- resilience when the live stream is down,
- future explicit refresh controls.

### Frontend Responsibilities

#### Conversation page

[`src/app/page.tsx`](/Users/masterman/NLP/omniharness/src/app/page.tsx) should:

- remove `conversationAgentQueries` for steady-state worker rendering,
- build `conversationAgents` directly from `state.agents` plus minimal worker-record fallbacks when no live snapshot exists yet,
- keep worker grouping and execution-state logic based on persisted workers and runs,
- surface live-stream errors clearly when worker detail cannot be trusted.

#### Detail fetching

No background fetch should occur merely because a worker is active. If a future UI needs explicit refresh or inspection, it should call `/api/agents/[name]` intentionally, behind a user action or a clear degraded-state gate.

### State Model

For implementation conversations, `state.agents` becomes the authoritative live snapshot list for worker detail rendering. Persisted `workers` rows remain important for:

- conversation membership,
- status grouping,
- recovery state,
- session ownership,
- degraded fallback when no live snapshot exists.

This keeps a clean separation:

- `workers` table answers which workers belong to a run and what the durable backend state is,
- `agents` stream answers what each worker looks like right now.

### Error Transparency

Failures should remain explicit:

- if `/api/events` cannot reach the bridge, it should continue emitting `frontendErrors`,
- if a worker cannot be normalized, the frontend should display visible degradation instead of silently omitting detail,
- if the bridge agent is missing but persisted worker data exists, the stream should emit a degraded snapshot with `bridgeMissing`,
- if both live and persisted data are unavailable, the worker UI should show an explicit missing-data state.

### Observability

This change should make the system easier to inspect:

- Next.js dev logs should no longer show one `/api/agents/[name]` request per active worker every two seconds during steady-state use.
- The SSE payload should remain inspectable as the single live state source.
- The detail route should still be testable and manually callable for one-off debugging.

## Rollout Plan

### Milestone 1

Create a shared worker snapshot normalizer and move current route enrichment logic into it.

### Milestone 2

Update `/api/events` to emit enriched worker snapshots using that normalizer.

### Milestone 3

Update the conversation page to remove steady-state worker detail polling and render from streamed agent snapshots.

### Milestone 4

Keep `/api/agents/[name]` wired to the shared normalizer for explicit retrieval and fallback coverage.

## Testing Strategy

- Add API tests covering enriched worker snapshots from `/api/events`.
- Update UI tests that currently assert the existence of `conversationAgentQueries` polling.
- Add tests that verify worker cards still render live output entries, pending permissions, context-usage indicators, and degraded snapshots when the bridge is missing.
- Keep route tests for `/api/agents/[name]` to ensure parity with shared normalization logic.
- Add regression coverage that steady-state rendering does not require polling `/api/agents/[name]`.

## Acceptance Criteria

- Opening an implementation conversation with active workers does not produce recurring `/api/agents/[name]` requests during normal rendering.
- Worker cards and sidebar rows still show live activity, permissions, context, and errors.
- The UI still renders usable worker state when a bridge agent disappears but persisted worker data remains.
- `/api/agents/[name]` still returns a valid enriched worker snapshot when explicitly requested.
- Frontend errors remain visible when the live stream fails.

## Recommendation

Implement this as a focused architecture cleanup, not as a general realtime rewrite. The fastest reliable path is:

- share worker-snapshot normalization,
- enrich the SSE stream,
- remove steady-state per-worker polling,
- preserve the detail route for explicit demand-driven use.

That keeps the product behavior familiar while collapsing duplicate live traffic into one control path.
