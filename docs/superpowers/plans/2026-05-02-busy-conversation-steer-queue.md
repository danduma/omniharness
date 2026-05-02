# Busy Conversation Steer Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users send text while a supervisor or worker is active, either steering immediately or queuing the message for later delivery according to a persisted setting.

**Architecture:** Add a durable queued-message model and server helpers, expose pending entries through the event stream, and keep frontend behavior in small managers/helpers instead of expanding `HomeApp.tsx`. The composer resolves its button mode from pure busy-state helpers: empty busy input stops, non-empty busy input sends.

**Tech Stack:** Next.js app routes, Drizzle with SQLite, React 19, existing manager classes, Vitest, Tailwind/shadcn-style primitives.

**North Star Product:** Human steering becomes a reliable control plane for active agent work, with visible intent, durable delivery, cancellation, and audit events.

**Current Milestone:** Persist one busy-message behavior setting, queue/cancel pending busy messages, auto-convert failed steer attempts to queued entries, drain queued direct/planning worker messages when the bridge reports the worker is no longer busy, and render the pending queue drawer above the composer.

**Later Milestones / Deferred But Intentional:** Targeted queue entries for specific implementation workers, "send queued item now", per-conversation override, richer delivery status history, and black-box journey automation after explicit approval.

**Final Functionality Standard:** This milestone delivers real persisted settings, durable queue storage, server queue APIs, frontend drawer state, cancellation, and worker queue draining. Implementation-supervisor queued messages are delivered into the next supervisor turn as user checkpoints; direct/planning worker queued messages drain when the worker is available. Failed immediate worker steering is automatically converted to queued delivery.

---

## File Map

Files to create:

- `src/server/conversations/queued-messages.ts`: queued-message create/cancel/serialize/drain helpers.
- `src/app/home/busy-message-behavior.ts`: pure frontend helpers for busy state, button mode, and submit action.
- `src/app/home/BusyMessageQueueManager.ts`: frontend manager for pending queue snapshots and optimistic cancellation.
- `src/components/home/QueuedMessageDrawer.tsx`: compact drawer above the composer.
- `src/app/api/conversations/[id]/queued-messages/[messageId]/route.ts`: cancellation route.
- `tests/app/busy-message-behavior.test.ts`: button-mode and action helper tests.
- `tests/server/queued-messages.test.ts`: queue helper tests.

Files to modify:

- `src/server/db/schema.ts`: add queued-message table.
- `src/server/db/index.ts`: create/migrate queued-message table.
- `src/server/conversations/send-message.ts`: accept `busyAction`, queue messages, auto-convert busy steer failures.
- `src/server/conversations/sync.ts`: drain worker queues after runtime sync reports a worker turn boundary.
- `src/server/supervisor/index.ts`: drain implementation-supervisor queue before supervisor tool selection.
- `src/app/api/conversations/[id]/messages/route.ts`: parse `busyAction`.
- `src/app/api/events/route.ts`: include pending queued messages.
- `src/app/home/types.ts`: add queue and setting types.
- `src/app/home/HomeUiStateManager.ts`: default `BUSY_MESSAGE_ACTION`.
- `src/app/home/HomeApp.tsx`: wire busy helper, queue manager, mutations, and settings with minimal orchestration.
- `src/components/home/ConversationComposer.tsx`: render drawer and resolve send-vs-stop button display.
- `src/components/home/SettingsDialog.tsx`: add "During active work" setting.
- Existing API/UI tests as needed if route payload shapes change.

Tests to update or add:

- Helper unit tests first, red then green.
- Queue helper tests for create, cancel, implementation drain, and worker drain.
- Event route or API tests if payload contract coverage is missing after implementation.

Candidate agentic user journey tests:

- Start a long-running direct worker, set queue mode, send two notes while active, confirm drawer and FIFO delivery.
- Switch to steer mode, send while active, confirm immediate steering or auto-queued fallback is visible.

These journey tests require explicit user approval before running.

## Tasks

- [ ] Write failing tests for frontend busy-message helper behavior.
- [ ] Implement `busy-message-behavior.ts` enough to pass helper tests.
- [ ] Write failing tests for queued-message server helpers.
- [ ] Add queued-message schema, DB creation, serialization, create/cancel/drain helpers.
- [ ] Extend send-message API to accept `busyAction`, persist queued messages, and auto-convert busy steer failures.
- [ ] Add event stream queued-message payload and frontend types.
- [ ] Add queue cancellation API.
- [ ] Add `BusyMessageQueueManager` and wire queue snapshots/cancel mutation in `HomeApp.tsx`.
- [ ] Update composer button behavior and render `QueuedMessageDrawer`.
- [ ] Add settings UI and persistence for `BUSY_MESSAGE_ACTION`.
- [ ] Wire queue draining into supervisor turns and worker runtime sync.
- [ ] Run targeted unit tests, type/lint/build verification as appropriate, and inspect diff for unrelated changes.
