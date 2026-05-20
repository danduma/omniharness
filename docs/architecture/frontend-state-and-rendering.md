# Frontend State and Rendering

This document is the source of truth for state ownership, subscription boundaries, high-churn state policy, and render-performance budgets in the OmniHarness Next.js app shell.

Related incident note:
`docs/architecture/state-staleness-and-session-lifecycle-lessons.md` records
the May 2026 conversation-loading regressions where cached selected-run state
was not hydrated immediately, unchanged snapshots were reapplied, fallback
`messages` rows rendered before worker entries were loaded, and scroll
affordances treated bottom padding as real content.

## Manager Ownership

Each shared manager owns a focused slice of UI state. Components should subscribe via `useManagerSelector` to a narrow slice; broad `useManagerSnapshot` reads are only permitted in approved leaf containers (see `tests/ui/react-best-practices.test.ts`).

| Manager | Owned state | Notes |
| --- | --- | --- |
| `HomeUiStateManager` | shell UI: selected run id, composer worker/model/effort/mode selections, dialog visibility, sidebar widths, mobile nav, attachments, editing rename state, runtime errors, read markers, draft project path | Stores transient view state; do not put server data here |
| `EventStreamStateManager` | live event snapshot, cached output entries, merged runs/messages/workers/events | Persists per-run snapshots; merges live updates |
| `SettingsDraftManager` | unsaved settings draft and save payload | Hydrated once per successful settings load |
| `BusyMessageQueueManager` | queued message visibility, cancellation state | Updated optimistically by composer controller |
| `AppearancePreferencesManager` | text-size preferences, theme-adjacent UI prefs | Persists to localStorage |
| `SideWindowManager` | side-window open state, current resource | Opens in response to project file refs |
| Component-level managers (e.g. inside `Terminal`, `WorkerCard`) | local component UI state (expanded groups, scroll-follow, search) | Never lifted into `HomeUiStateManager` |

## Conversation Loading Invariants

- Selecting a run hydrates `EventStreamStateManager` from the scoped frontend
  cache immediately, then asks the server whether the snapshot checksum changed.
- A not-modified snapshot confirms freshness and must not replace local state.
- Worker-backed transcripts render from `WorkerEntriesManager` entries. Legacy
  `messages` rows are fallback evidence only after the selected worker stream
  is fully loaded.
- Conversation first-positioning and "more below" affordances must be driven by
  meaningful transcript overflow, not bottom padding or pending-state spacers.

## High-Churn State Rules

The following kinds of state must NOT cause `HomeApp` (the shell) to re-render:

- Composer draft text, cursor position, mention search index.
- Hover / pointer / open flags for menus and tooltips.
- Per-keystroke search filters.
- Active resize / drag pointer position.
- Terminal scroll position, follow flag, and tool-group expansion.

Rules:

1. High-churn state lives in a leaf container's own `useState`, a dedicated manager, or behind a narrow `useManagerSelector`.
2. The root `HomeApp` may only subscribe to a small set of shell-level fields via `useManagerSelector` (selected run id, dialog visibility, mobile-nav state, sidebar widths).
3. No component above the composer subtree may subscribe to draft text.
4. No component above a worker card may subscribe to per-worker scroll state.

## Subscription Boundary Policy

- Default to `useManagerSelector(manager, (s) => slice)` with a tuple/object selector that returns stable identity where possible.
- Use the optional equality function for record/set selections.
- Reserve `useManagerSnapshot(manager)` for:
  - the manager's owning container (where the entire state is needed for layout wiring).
  - tests and devtools.
- New code may not call `useManagerSnapshot(homeUiStateManager)` outside the explicit allowlist in `tests/ui/react-best-practices.test.ts`.

## Snapshot Merge Safety

Live event snapshots are not automatically authoritative. If a payload does
not declare a complete scope, it is a partial update and must not erase local
optimistic state, recently created sessions, delivered worker-stream inputs, or
read markers.

State merge bugs are documented in
`docs/architecture/state-staleness-and-session-lifecycle-lessons.md`. Read that
note before changing `EventStreamStateManager`, `mergePendingCreatedConversationSnapshots`,
`WorkerEntriesManager`, queued-message UI state, or read-marker logic.

## Render Performance Budgets

For local development (Apple Silicon, Node 22, default `pnpm dev`):

| Metric | Baseline (2026-05-11) | Budget |
| --- | --- | --- |
| Cold `/` compile + TTFB | ~12 s | ≤ 15 s |
| Cold `/api/auth/session` | ~12 s | ≤ 15 s |
| Warm `/` TTFB | ~1.39 s (pre-refactor) → 36 ms (post-refactor, server already warm) | ≤ 1.6 s |
| Warm `/api/auth/session` TTFB | ~0.86 s (pre-refactor) → 10 ms (post-refactor) | ≤ 1.0 s |
| `pnpm build` total | ~90 s | ≤ 110 s |
| `/` route size (build report) | 157 kB (pre-refactor) → 160 kB (post-refactor) | ≤ 165 kB |
| `/` first-load JS | 319 kB (pre-refactor) → 323 kB (post-refactor) | ≤ 330 kB |

Post-refactor measurement taken 2026-05-11 (node v22.22.0, darwin arm64, dev server already warm):

```
cold /                    200   964 ms
cold /api/auth/session    200  3785 ms
warm /                    200    36 ms
warm /api/auth/session    200    10 ms
```

Run `pnpm exec node scripts/measure-local-dev.mjs` (see "Measurement" below) to capture comparable numbers.

## Home Hooks

`HomeApp.tsx` is the composition root. It wires:

- `useHomeQueries` — auth session, settings, worker catalog, project files.
- `useHomeMutations` — login/logout/pair, save settings, run mutations.
- `useConversationActions` — rename / delete / archive / recover / fork / retry / commit / promote actions.
- `useHomeViewModel` — pure derivations (selected run, worker groups, timeline items, busy state, recovery, composer options).
- `useHomeLayoutController` — sidebar, mobile nav, side window, resize.
- `useComposerController` — composer draft selection, mention filtering, submit, attachments.
- `useHomeLifecycle` — route hydration, theme persistence, runtime error capture, pair-redeem flow.
- `useRunSelectionEffects` — worker hydration when selected run changes.

`HomeApp.tsx` itself is responsible only for:

- Auth gate rendering (login / boot shell / authenticated shell).
- Top-level layout composition.
- Wiring major child components (sidebar, header, conversation main, side window, composer).
- Mounting modal/dialog roots.

Target: under 700 lines.

## Measurement

`scripts/measure-local-dev.mjs` measures cold/warm response times against a running dev server.

```bash
# Make sure :3035 is free or a dev server is already running on it
lsof -nP -iTCP:3035 -sTCP:LISTEN

# If not running:
pnpm dev &
DEV_PID=$!

# Measure
pnpm exec node scripts/measure-local-dev.mjs

# Clean up
kill $DEV_PID
```

The script writes a timestamped row to stdout suitable for pasting into this doc when establishing a new baseline.
