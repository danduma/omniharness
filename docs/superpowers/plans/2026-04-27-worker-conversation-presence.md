# Worker Conversation Presence Implementation Plan

## Objective

Make implementation conversations stop duplicating the sidebar terminal. Keep detailed worker history in the worker sidebar, and render workers in the supervisor conversation as compact, clickable controls that show only the latest action and open the sidebar for details.

## Scope

**Primary files:**

- Modify: `src/components/home/ConversationMain.tsx`
- Modify: `src/app/home/HomeApp.tsx`
- Modify: `src/components/home/HomeHeader.tsx`
- Modify: `src/components/home/WorkersSidebar.tsx`
- Modify: `src/lib/conversation-workers.ts`
- Add: `src/components/home/ConversationWorkerPresence.tsx` or an equivalent focused component
- Modify: `tests/ui/sidebar-layout.test.ts`
- Add or modify focused helper tests near `tests/lib/conversation-workers.test.ts` if latest-action logic is extracted

**Out of scope:**

- Do not change worker runtime orchestration.
- Do not change `src/components/Terminal.tsx` for this feature.
- Do not add routes or file-based routing.

## Task 1: Extract Latest Worker Action

- [ ] **Step 1: Define the summary contract**

Create a helper that accepts a worker record and matching live agent snapshot, then returns a compact object such as:

- `label` for the latest action text,
- `tone` for normal, active, warning, error, or permission states,
- optional `timestamp` if available,
- optional `isLive` for current thinking/tool activity.

- [ ] **Step 2: Reuse existing activity parsing**

Use `buildAgentOutputActivity` from `src/lib/agent-output.ts` to inspect `outputEntries` instead of reimplementing terminal parsing in the component. Prefer the newest meaningful item and fall back to `currentText`, `displayText`, `lastText`, `lastError`, `stopReason`, then worker status.

- [ ] **Step 3: Add focused helper coverage**

Add or update tests to cover:

- pending permission outranks normal output,
- in-progress tool/thinking summarizes as latest action,
- fallback text works when `outputEntries` are missing,
- error/stop states produce useful summaries,
- summaries are truncated.

Run:

```bash
pnpm test -- tests/lib/conversation-workers.test.ts
```

Expected: latest-action behavior is verified without rendering the full UI.

## Task 2: Add Compact Conversation Worker Control

- [ ] **Step 1: Create the component**

Add `ConversationWorkerPresence` under `src/components/home/` or an equivalent focused location. It should render a compact card/row for one worker with identity, status, latest action, and an `Open worker` interaction.

- [ ] **Step 2: Keep it terminal-free**

Do not import `Terminal`, `WorkerCard`, or `ConversationWorkerCard` into the new component. The component should use lightweight markup only.

- [ ] **Step 3: Support fallback spawned-worker data**

When the persisted worker record is not available yet, render from parsed spawn-message data and the live agent snapshot if present.

- [ ] **Step 4: Wire stop affordances carefully**

If preserving stop-worker from the inline card is required, expose it as a small secondary action. Do not make the stop action interfere with the main click-to-open behavior.

## Task 3: Add Worker Sidebar Navigation

- [ ] **Step 1: Centralize open behavior in `HomeApp`**

Add an `openWorkerSidebar(workerId: string)` callback in `src/app/home/HomeApp.tsx` that records the focused worker id and opens the appropriate sidebar state.

- [ ] **Step 2: Pass navigation into conversation and header/sidebar**

Pass the callback to `ConversationMain`. Pass focused worker state to `WorkersSidebar` on desktop and mobile.

- [ ] **Step 3: Make sidebar select the relevant tab**

Update `WorkersSidebar` so a focused active worker selects the active tab, and a focused finished worker selects the finished tab.

- [ ] **Step 4: Optionally scroll/highlight**

If straightforward, scroll the focused worker card into view and apply a short highlight. If this becomes fragile, keep the first implementation to opening the sidebar and selecting the correct tab.

## Task 4: Replace Inline Worker Terminals

- [ ] **Step 1: Replace spawned-worker rendering**

In `src/components/home/ConversationMain.tsx`, replace the `ConversationWorkerCard` render for `Spawned worker.` system messages with `ConversationWorkerPresence`.

- [ ] **Step 2: Remove bottom active worker terminal section**

Remove the implementation conversation `CLI Agents` section that maps active workers to inline `ConversationWorkerCard` instances.

- [ ] **Step 3: Keep ordinary message rendering intact**

Do not alter direct conversation terminal rendering or planning `AgentSurface` rendering.

- [ ] **Step 4: Add worker reference rendering if scoped**

For known worker ids in system/supervisor copy, render compact clickable references that call the same `openWorkerSidebar(workerId)` callback. If broad text parsing is risky, limit this to structured spawned-worker messages in the first pass and leave generic parsing as a follow-up.

## Task 5: Update UI Regression Coverage

- [ ] **Step 1: Update source-level layout tests**

Update `tests/ui/sidebar-layout.test.ts` so it asserts:

- `WorkersSidebar` still renders `ConversationWorkerCard`,
- `ConversationMain` no longer renders inline `ConversationWorkerCard` for spawned workers,
- `ConversationMain` no longer contains the bottom `CLI Agents` terminal section,
- the new compact worker presence component is used for spawned workers,
- `Terminal` remains owned by sidebar/direct/planning surfaces, not the implementation transcript worker controls.

- [ ] **Step 2: Add interaction-oriented coverage if practical**

If current test patterns support it, add assertions that the conversation worker control has an open-sidebar callback prop and accessible label.

- [ ] **Step 3: Run focused UI tests**

Run:

```bash
pnpm test -- tests/ui/sidebar-layout.test.ts
```

Expected: source-level regressions protect against reintroducing inline worker terminals.

## Task 6: Final Verification

- [ ] **Step 1: Run focused tests together**

Run:

```bash
pnpm test -- tests/lib/conversation-workers.test.ts tests/ui/sidebar-layout.test.ts
```

Expected: helper behavior and UI ownership regressions pass.

- [ ] **Step 2: Manual UI sanity check**

In an implementation conversation with a spawned worker, verify:

- the conversation shows a compact worker control, not a terminal,
- the sidebar still shows the full terminal,
- clicking the compact control opens the worker sidebar/sheet,
- only one latest worker action appears inline,
- active workers are not duplicated at the bottom of the conversation.

- [ ] **Step 3: Confirm requirement mapping**

Confirm the implementation satisfies the product objective: the supervisor transcript stays readable while detailed worker history is available from the dedicated sidebar.
