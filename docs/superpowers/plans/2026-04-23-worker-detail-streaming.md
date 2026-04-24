# Worker Detail Streaming Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the conversation UI consume enriched worker detail from the existing SSE stream instead of background-polling one detail endpoint per active worker.

**Architecture:** Extract worker snapshot enrichment into a shared server helper that can merge bridge agent records with persisted worker and run data. Use that helper from both `/api/events` and `/api/agents/[name]`, then simplify `src/app/page.tsx` so `state.agents` is the steady-state live source for worker cards and sidebars.

**Tech Stack:** Next.js App Router, React, TypeScript, TanStack Query, Drizzle ORM, Vitest

**North Star Product:** OmniHarness exposes one coherent live control plane for worker state, with a single streamed worker-detail source for routine rendering and explicit targeted endpoints for debugging or recovery.

**Current Milestone:** Ship the first worker-detail streaming slice by eliminating steady-state per-worker polling while preserving rich worker cards, degraded fallback behavior, and explicit error visibility.

**Later Milestones / Deferred But Intentional:** add explicit detail refresh controls, deeper worker inspection surfaces, richer stream diagnostics, and potentially bridge-driven push updates if the current server-polled SSE model becomes the bottleneck.

---

## File Map

- Create: `src/server/workers/live-snapshots.ts`
  Responsibility: normalize and enrich live worker snapshots from bridge, persisted worker rows, and run metadata for reuse across APIs.

- Add: `tests/server/live-worker-snapshots.test.ts`
  Responsibility: lock down fallback merging, display text construction, and bridge-missing behavior with test-first coverage.

- Modify: `src/app/api/events/route.ts`
  Responsibility: emit enriched worker snapshots through the SSE `agents` payload instead of raw bridge list records.

- Modify: `src/app/api/agents/[name]/route.ts`
  Responsibility: reuse the shared snapshot builder so the explicit detail route stays behaviorally aligned with the stream.

- Modify: `src/app/page.tsx`
  Responsibility: remove steady-state worker detail polling and render implementation worker surfaces directly from streamed `state.agents` snapshots plus minimal local fallback.

- Modify: `tests/ui/sidebar-layout.test.ts`
  Responsibility: replace the old polling assertions with regressions that lock in streamed worker detail rendering.

## Task 1: Add Shared Worker Snapshot Enrichment

**Files:**

- Create: `src/server/workers/live-snapshots.ts`
- Add: `tests/server/live-worker-snapshots.test.ts`

- [ ] **Step 1: Write failing tests for snapshot enrichment**

Cover:

- bridge-present snapshots merging persisted run metadata,
- bridge-missing snapshots falling back to persisted worker state,
- `displayText`, `lastError`, and `outputEntries` behavior matching current route semantics.

- [ ] **Step 2: Implement the shared builder**

Create a helper that accepts a bridge agent record plus optional persisted worker and run rows, then returns the enriched worker snapshot shape used by the UI.

- [ ] **Step 3: Verify the helper**

Run:

```bash
pnpm test -- tests/server/live-worker-snapshots.test.ts
```

Expected: the new helper passes focused regression coverage before any page or API refactor lands.

## Task 2: Stream Enriched Worker Snapshots Through `/api/events`

**Files:**

- Modify: `src/app/api/events/route.ts`
- Modify: `src/server/conversations/sync.ts`
- Modify: `tests/server/live-worker-snapshots.test.ts`

- [ ] **Step 1: Replace raw agent streaming with enriched snapshots**

Update the SSE route so it:

- fetches the bridge agent list once per poll cycle,
- maps each bridge agent through the shared builder,
- preserves visible `frontendErrors`,
- keeps `syncConversationSessions` working against the bridge-normalized agent data or an equivalent normalized source.

- [ ] **Step 2: Preserve degraded worker states**

When the bridge list omits a worker that still exists in persisted conversation state, ensure the stream can still produce a usable fallback snapshot once that worker is relevant to rendering.

- [ ] **Step 3: Verify the stream assembly path**

Run:

```bash
pnpm test -- tests/server/live-worker-snapshots.test.ts
```

Expected: stream-facing snapshot behavior remains covered without requiring route-level stream parsing.

## Task 3: Remove Steady-State Per-Worker Polling From The Page

**Files:**

- Modify: `src/app/page.tsx`
- Modify: `tests/ui/sidebar-layout.test.ts`

- [ ] **Step 1: Write the failing UI regression**

Update the sidebar/page test to assert that:

- `useQueries`-driven worker polling is gone,
- worker detail rendering derives from streamed `state.agents`,
- no steady-state `/api/agents/${worker.id}` fetch logic remains in the page source.

- [ ] **Step 2: Simplify conversation agent assembly**

Remove `conversationAgentQueries` and related query-error handling. Build `conversationAgents` from streamed `state.agents` keyed by worker id, with a small fallback object only when no live snapshot exists yet.

- [ ] **Step 3: Verify the page regression**

Run:

```bash
pnpm test -- tests/ui/sidebar-layout.test.ts
```

Expected: the source-level regression confirms the page no longer defines steady-state per-worker polling.

## Task 4: Keep The Explicit Detail Route Aligned

**Files:**

- Modify: `src/app/api/agents/[name]/route.ts`
- Modify: `tests/api/agent-route.test.ts`

- [ ] **Step 1: Refactor the route onto the shared builder**

Preserve the current explicit endpoint behavior while removing duplicated enrichment logic from the route implementation.

- [ ] **Step 2: Extend regression coverage if needed**

Keep the existing fallback test green and add any narrow assertions needed for parity with the shared builder.

- [ ] **Step 3: Verify the explicit detail route**

Run:

```bash
pnpm test -- tests/api/agent-route.test.ts
```

Expected: the route still returns a valid enriched snapshot for targeted worker inspection.

## Task 5: Final Verification

**Files:**

- Modify: `src/app/api/events/route.ts`
- Modify: `src/app/api/agents/[name]/route.ts`
- Modify: `src/app/page.tsx`
- Modify: `tests/server/live-worker-snapshots.test.ts`
- Modify: `tests/ui/sidebar-layout.test.ts`
- Modify: `tests/api/agent-route.test.ts`

- [ ] **Step 1: Run the focused test suite**

```bash
pnpm test -- tests/server/live-worker-snapshots.test.ts tests/api/agent-route.test.ts tests/ui/sidebar-layout.test.ts
```

Expected: all focused worker-streaming regressions pass together.

- [ ] **Step 2: Sanity-check the requirement mapping**

Confirm the implementation delivers:

- one steady-state live worker-detail source via SSE,
- no per-active-worker polling in the page,
- preserved worker-card detail fields,
- preserved explicit detail endpoint behavior,
- visible degraded and error states.
