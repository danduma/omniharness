# Conversation Recovery Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add durable run failure visibility plus message-level retry, edit-in-place, and fork-from-here controls for conversations.

**Architecture:** Extend persisted run and message records so recovery state is durable, then add a single recovery service that cancels workers, reconstructs conversation checkpoints, and either truncates or forks history before restarting the supervisor. Update the UI to render failed states and expose message-level controls that call the recovery APIs.

**Tech Stack:** Next.js App Router, React 19, TanStack Query, better-sqlite3, Drizzle ORM, Vitest

---

### Task 1: Persist Recovery Metadata And Failure State

**Files:**
- Modify: `src/server/db/schema.ts`
- Modify: `src/server/db/index.ts`
- Modify: `src/server/supervisor/index.ts`
- Create: `src/server/runs/failures.ts`
- Test: `tests/api/supervisor-route.test.ts`
- Test: `tests/supervisor/runtime-settings.test.ts`

- [ ] **Step 1: Write the failing tests for durable failure state**

Add tests that prove supervisor launch failures mark the run as failed and insert a durable error message, plus schema-level expectations for new persisted fields used by recovery.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/api/supervisor-route.test.ts`
Expected: FAIL because failed supervisor launches do not persist visible run/message state.

- [ ] **Step 3: Implement the minimal persistence changes**

Add run fields for recovery metadata and message fields for visible error/superseded state, add lightweight runtime migration code in the SQLite bootstrap, and funnel supervisor failures through a shared helper that updates run state and inserts a durable error message.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/api/supervisor-route.test.ts`
Expected: PASS

### Task 2: Add Recovery Service And Run APIs

**Files:**
- Create: `src/server/runs/recovery.ts`
- Modify: `src/server/supervisor/resume.ts`
- Modify: `src/app/api/runs/[id]/route.ts`
- Test: `tests/api/run-route.test.ts`

- [ ] **Step 1: Write the failing tests for retry, edit, and fork**

Add API tests that cover:
- retry from a user message truncates downstream history and restarts the same run,
- edit in place updates the selected user message and truncates later records,
- fork from a user message creates a new run with copied history,
- all recovery actions cancel active workers first,
- invalid targets return useful 4xx errors.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/api/run-route.test.ts`
Expected: FAIL because no recovery API exists and the route only supports rename/delete.

- [ ] **Step 3: Implement the minimal recovery service and routes**

Add a recovery service that:
- validates the target user message,
- cancels workers,
- marks the run as cancelling/running as needed,
- reconstructs messages up to the checkpoint,
- truncates or clones downstream state,
- updates fork lineage fields,
- restarts the supervisor with persisted history.

Wire this service into a new run-level recovery action in `src/app/api/runs/[id]/route.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/api/run-route.test.ts`
Expected: PASS

### Task 3: Render Failed States And Message Controls In The UI

**Files:**
- Modify: `src/app/page.tsx`
- Test: `tests/ui/conversation-actions.test.ts`
- Test: `tests/ui/sidebar-layout.test.ts`

- [ ] **Step 1: Write the failing UI tests**

Add tests that assert:
- failed runs render visible failed messaging,
- user messages expose retry/edit/fork controls,
- the header shows retry for failed runs,
- existing rename/delete actions still exist.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/ui/conversation-actions.test.ts tests/ui/sidebar-layout.test.ts`
Expected: FAIL because the UI only exposes rename/delete and does not render durable failure controls.

- [ ] **Step 3: Implement the minimal UI changes**

Update the conversation view to:
- distinguish error messages visually,
- add user-message actions menus,
- support inline edit state,
- call the new recovery API,
- show cancelling and failed states in the header and message feed.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/ui/conversation-actions.test.ts tests/ui/sidebar-layout.test.ts`
Expected: PASS

### Task 4: Verify End-To-End Recovery Paths

**Files:**
- Modify: `tests/api/supervisor-route.test.ts`
- Modify: `tests/api/run-route.test.ts`
- Modify: `tests/ui/conversation-actions.test.ts`

- [ ] **Step 1: Add regression coverage for complete recovery flow**

Add a focused regression path that:
- creates a failed run,
- confirms the error becomes visible,
- retries from the failed user message,
- confirms the run is recoverable without hidden stale failure state.

- [ ] **Step 2: Run targeted verification**

Run: `pnpm test tests/api/supervisor-route.test.ts tests/api/run-route.test.ts tests/ui/conversation-actions.test.ts tests/ui/sidebar-layout.test.ts`
Expected: PASS

- [ ] **Step 3: Run touched-file lint verification**

Run: `pnpm lint src/app/page.tsx src/app/api/runs/[id]/route.ts src/app/api/supervisor/route.ts src/server/supervisor/index.ts src/server/runs/failures.ts src/server/runs/recovery.ts src/server/db/schema.ts src/server/db/index.ts`
Expected: exit 0
