# Escape Interrupt Queued Message Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Claude Code-style Escape shortcut that interrupts the active worker turn and immediately delivers the queued user message OmniHarness should take next.

**Architecture:** Promote the existing ACP turn-cancel primitive into a conversation-level control-plane action. The server will own queue selection, worker turn cancellation, durable status updates, named events, and queued-message delivery; the frontend will expose Escape and an explicit queued-message action that call the same API. Delivery continues through the unified worker stream and existing queued-message persistence instead of adding a second transcript or queue layer.

**Tech Stack:** Next.js App Router route shims, portable runtime HTTP handlers, React manager-backed composer state, Drizzle SQLite queue/message/workers tables, ACP bridge client, named SSE lifecycle events, unified worker JSONL stream, Vitest server/API/app tests, lifecycle HTTP/SSE tests.

**North Star Product:** OmniHarness should make active agent control feel as immediate as the native CLI while staying durable, observable, and safe across reloads, multiple surfaces, and worker recovery.

**Current Milestone:** Deliver Escape-to-interrupt for busy conversations with queued user intent: oldest pending queued message is delivered immediately after cancellation, and a non-empty busy composer draft can be queued and delivered by the same Escape gesture.

**Future Product Direction:** Later product layers can add configurable shortcut preferences, command-palette actions, mobile-specific interrupt controls, and richer interruption history. Those are not required for this milestone.

**Final Functionality Standard:** The feature is complete when Escape and the visible interrupt action both route through one server action that cancels the active turn, preserves old turn output, delivers exactly one queued/draft user message through the unified worker stream, emits observable events for success/refusal/failure, converges across event-stream clients, and is proven by deterministic server/API/app tests plus a lifecycle scenario.

---

## Scope Notes

- Do not create a branch or worktree.
- Do not delete files.
- Do not add a parallel persistence layer for worker content, queued messages, or interruption state.
- Do not send translated UI strings through transactions or persist translated copy.
- Every new user-facing frontend string must be added to `shared/locales/*.json` and rendered with `t()`.
- The shortcut must be additive. Existing Enter, Command/Ctrl+Enter, stop, queue, steer, edit queued message, cancel queued message, and send-now behavior must keep working.
- Escape is already used by the file mention picker in `ConversationComposer`; mention-picker Escape keeps priority.
- The feature targets active worker turns. It should refuse clearly when there is no selected run, no active worker, no queued/draft message to deliver, the target worker is missing, or the session provider does not support turn cancellation.
- Implementation runs are included only where the existing queued-message delivery path can safely target a worker. Do not interrupt the supervisor loop by guessing; use existing run/worker targeting helpers and refuse/defer if no safe target exists.
- This milestone does not add a persisted user preference for the shortcut.

## User Stories

- As a user watching Claude Code work in OmniHarness, I can type a correction while it is busy and press Escape so the current turn stops and the correction is taken immediately.
- As a user with queued follow-ups already visible above the composer, I can press Escape to force the oldest pending queued message into the active worker now.
- As a user using the queued-message drawer, I can click an explicit interrupt/send action and get the same behavior as Escape.
- As a user with multiple OmniHarness windows open, I can see that a queued message moved to delivering/delivered and that the worker was interrupted from the shared event stream.
- As a user debugging a surprising interruption, I can inspect named events and execution events to see whether the server cancelled, refused, delivered, deferred, or failed.

## File Map

### Files To Create

- `src/server/conversations/queued-message-interrupt.ts`
  - Owns the new conversation-level workflow: select queued message, resolve target worker, cancel current turn, mark interruption state, and invoke queued-message delivery.
  - Keeps `src/server/conversations/queued-messages.ts` from growing past 1200 lines with another large orchestration path.
  - Exports focused functions such as:
    - `interruptAndSendQueuedConversationMessageNow({ runId, messageId })`
    - `interruptAndSendNextQueuedConversationMessage({ runId })`
    - `interruptWithDraftMessage({ runId, content, attachments, busyAction, preferredWorker... })`

- `tests/server/queued-message-interrupt.test.ts`
  - Server workflow coverage with mocked bridge cancel/ask helpers and real DB rows.

- `tests/app/composer-interrupt-keyboard.test.ts`
  - Pure keyboard-intent tests for Escape gating.

- `tests/lifecycle/scenarios/queued-message-interrupt.test.ts`
  - Headless HTTP/SSE scenario proving the control-plane event transcript and queue convergence without Chromium.

### Files To Modify

- `src/server/bridge-client/index.ts`
  - Add `cancelAgentTurn(name: string)` that calls `POST /agents/:name/cancel`.
  - Preserve existing `cancelAgent(name)` as full worker stop via `DELETE /agents/:name`.
  - Normalize connection-refused and bridge errors with action text that distinguishes turn cancel from worker cancel.

- `tests/server/bridge-client.test.ts`
  - Add coverage for successful turn cancel, bridge error normalization, and connection-refused messaging.

- `src/server/conversations/queued-messages.ts`
  - Export or extract only the minimum reusable helpers needed by `queued-message-interrupt.ts`.
  - Candidate extractions:
    - pending queue record selection with deterministic FIFO order,
    - target worker resolution,
    - worker content building with attachment context,
    - async delivery continuation.
  - Keep delivery through `appendUserInputOnDelivery`, `persistDeliveredWorkerResponse`, and existing queued-message status transitions.
  - Do not add a second worker-output writer.

- `src/server/conversations/worker-turn-gate.ts`
  - Review interaction with cancellation and queued delivery.
  - Ensure the interrupt path cannot run two concurrent turns for the same worker.
  - Add or expose a turn-generation/turn-token fence so late completions from an interrupted turn cannot persist status, queue, or response updates after a newer interrupted delivery has started.
  - If needed, expose a small helper for "cancel then reopen gate for next turn" instead of bypassing the gate.

- `src/server/db/schema.ts`
  - Add a durable worker turn fence if the implementation cannot prove an existing persisted token is sufficient.
  - Candidate fields: `turnGeneration` integer with default `0`, and/or nullable `activeTurnId` text.
  - Keep the migration narrow and avoid changing worker stream persistence.

- `src/server/db/index.ts`
  - Add the corresponding SQLite migration/backfill for the worker turn fence.
  - Existing workers should default to generation `0` with no active turn id.

- `src/runtime/http/routes/conversation-messages.ts`
  - Extend queued-message route handling with an interrupt action.
  - Recommended API:
    - `POST /api/conversations/:id/queued-messages/:messageId/interrupt`
    - `POST /api/conversations/:id/queued-messages/interrupt-next`
  - Keep existing `PATCH` send-now semantics unchanged.
  - Return serialized `message`, `queuedMessage`, and concise `interruption` metadata when applicable.

- `src/runtime/http/routes/index.ts`
  - Register the portable runtime routes for the new interrupt endpoints.

- `src/app/api/conversations/[id]/queued-messages/[messageId]/interrupt/route.ts`
  - Add Next route shim to call the portable handler.

- `src/app/api/conversations/[id]/queued-messages/interrupt-next/route.ts`
  - Add Next route shim for Escape when the server should choose the oldest pending queued message or accept a draft payload.

- `src/server/events/named-events.ts`
  - Add typed events:
    - `queue.interrupt_requested`
    - `queue.interrupt_refused`
    - `queue.interrupt_cancelled_turn`
    - `queue.interrupt_delivery_started`
    - `queue.interrupt_delivery_finished`
    - `queue.interrupt_delivery_failed`
  - Add `error.surfaced` codes:
    - `queue.interrupt.refused`
    - `queue.interrupt.cancel_failed`
    - `queue.interrupt.delivery_failed`
  - Include `runId`, `workerId`, `queuedMessageId`, `reason`, `source`, and enough error detail for `/api/events/log` triage.
  - Include latency fields where available:
    - `cancelDurationMs` on `queue.interrupt_cancelled_turn`
    - `totalInterruptLatencyMs` on delivery start/finish/failure events.

- `src/server/events/execution-event-store.ts` consumers in the new interrupt module
  - Record execution events mirroring the named events for durable conversation history:
    - `queued_message_interrupt_requested`
    - `queued_message_turn_cancelled`
    - `queued_message_interrupt_delivered`
    - `queued_message_interrupt_deferred`
    - `queued_message_interrupt_failed`

- `src/app/home/composer-keyboard.ts`
  - Add pure helpers:
    - `shouldInterruptQueuedMessageKeyDown({ key, shiftKey, metaKey, ctrlKey, isComposing })`
    - optional `resolveEscapeInterruptIntent(...)` if state gating benefits from pure tests.
  - Ensure IME composition does not trigger interrupt.

- `tests/app/composer-keyboard.test.ts`
  - Cover Escape, modifier keys, Enter behavior unchanged, mobile behavior unchanged, and IME composition.

- `src/components/home/ConversationComposer.tsx`
  - Wire Escape after mention-picker handling.
  - Trigger an `onInterruptQueuedMessage` prop only when:
    - selected run exists,
    - conversation is busy/stoppable,
    - mention picker is closed,
    - not currently submitting/stopping/interruption-pending,
    - there is either a non-empty draft/attachment or at least one pending queued message.
  - Use `t()` for any title/aria/help text.
  - Keep Escape mention-picker behavior unchanged.

- `src/app/home/ComposerContainer.tsx`
  - Pass the interrupt handler and minimal state down to `ConversationComposer`.
  - Keep high-churn draft state inside the existing narrow manager subscription.

- `src/components/home/QueuedMessageDrawer.tsx`
  - Add an explicit icon action for "Interrupt and send now" on pending queued messages.
  - Prefer a lucide icon that communicates interruption/send; add tooltip and aria string through locales.
  - Keep existing "Send now" as non-interrupt behavior unless the product decision changes during implementation.

- `src/app/home/useHomeMutations.ts`
  - This file is already 1162 lines. Do not add a large new mutation block directly if it pushes the file past 1200 lines.
  - Extract queued-message mutation hooks into a focused file, for example `src/app/home/useQueuedMessageMutations.ts`, before adding interrupt mutations.
  - New mutation responsibilities:
    - optimistic mark interrupting/delivering,
    - submit draft as interrupt payload when no persisted queue item should be selected,
    - restore queue/draft state on refusal or failure,
    - preserve owner-token checks so late responses cannot mutate a newly selected run.

- `src/app/home/BusyMessageQueueManager.ts`
  - Add manager-owned `interruptingMessageIds` or a generalized pending-action map.
  - Do not use component-local arrays as the source of truth.
  - Preserve existing local hide/cancel behavior.

- `src/app/home/types.ts`
  - Add response and local pending-action types for queued-message interruption.

- `src/app/home/useAppErrors.ts`
  - Add action labels/source metadata for interruption failures if the existing error plumbing requires explicit action names.

- `shared/locales/en.json`, `de.json`, `es.json`, `fr.json`, `it.json`, `ja.json`, `ko.json`, `pt.json`, `zh-CN.json`
  - Add keys for interrupt action labels, aria labels, tooltips, and error/action labels.
  - At minimum:
    - `queued.message.interruptSendAria`
    - `queued.message.interruptSendTitle`
    - `conversation.composer.interruptQueuedTitle`
    - `conversation.composer.interruptQueuedAria`
    - any mutation action label surfaced in toasts/errors.

- `tests/api/conversation-messages-route.test.ts`
  - Add API route coverage for new endpoints and draft interrupt flow if route-level tests already cover conversation sends.

- `tests/server/queued-messages.test.ts`
  - Add or adjust lower-level queue helper tests only when helpers move out of this file.

- `tests/app/direct-control-activity.test.ts`
  - Add stale-owner coverage if the new mutation affects direct control pending states.

- `tests/app/event-stream-state-manager.test.ts`
  - Add snapshot merge coverage if new queue pending-action fields or event state are added to snapshots.

- `docs/architecture/lifecycle-observability-and-testing.md`
  - Add a short note under lifecycle/queued-message examples documenting interrupt events and the expectation that interruption is observable.

### Files To Avoid Modifying Unless Necessary

- `src/server/agent-runtime/manager.ts`
  - The runtime already has `cancelAgentTurn`.
  - Modify only if tests prove current cancellation semantics are insufficient.

- `src/server/agent-runtime/http.ts`
  - The runtime already exposes `POST /agents/:id/cancel`.
  - Modify only for response-shape or status-code defects discovered by tests.

### Tests To Add Or Update

- `pnpm test -- tests/server/bridge-client.test.ts`
- `pnpm test -- tests/server/queued-message-interrupt.test.ts`
- `pnpm test -- tests/api/conversation-messages-route.test.ts`
- `pnpm test -- tests/app/composer-keyboard.test.ts tests/app/composer-interrupt-keyboard.test.ts`
- `pnpm test -- tests/app/event-stream-state-manager.test.ts tests/app/direct-control-activity.test.ts`
- `pnpm test:lifecycle -- tests/lifecycle/scenarios/queued-message-interrupt.test.ts` if the lifecycle runner supports file targeting; otherwise run `pnpm test:lifecycle`.

### Candidate Agentic User Journey Test

Running this requires explicit user approval.

- Mission: verify the real UI behaves like Claude Code Escape for queued steering.
- Entry point: already-running app at `http://localhost:3035`.
- Setup: start a direct Claude worker on a long-running task, type a correction while busy, press Escape.
- Expected visible proof: the current worker turn stops, the typed correction appears as delivered user input in the worker stream, the queue drawer clears or marks the item delivered, and the conversation continues from the correction.
- Failure proof: if cancellation is refused or the worker is missing, the queued message remains pending and a visible error/action state explains why.

## State, Persistence, And Invariants

- Owner:
  - Server owns persisted queued-message rows, run/worker status, durable messages, execution events, worker JSONL entries, and named interruption events.
  - `BusyMessageQueueManager` owns frontend queue display and local pending-action state.
  - `HomeUiStateManager` owns high-churn composer draft state.
  - The runtime bridge owns the live ACP cancel/prompt calls.

- Token:
  - Server mutations are scoped by `runId`, `queuedMessageId`, and `workerId`.
  - Draft interrupt requests receive a generated queued-message id server-side or reuse the persisted queue helper.
  - Frontend mutation side effects must check the selected `runId` before clearing draft, hiding rows, or scrolling.

- Provenance:
  - Queue rows from `/api/events` are server-authoritative for pending/delivering/delivered/cancelled state.
  - Frontend pending-action flags are optimistic UI only and cannot erase server rows.
  - Worker JSONL entries are the authoritative worker conversation content.

- Completeness:
  - Server queue snapshots may replace the queue list for their declared scope.
  - Partial mutation responses may upsert one queued message but must not clear unrelated queued messages.
  - An empty authoritative server queue still means no pending queue; do not resurrect cached rows.

- Ordering:
  - When no specific message id is supplied, the server chooses the oldest pending queued row by `(createdAt, id)`.
  - Draft Escape creates one queued row and then delivers that exact row, preserving its id through worker-stream `user_input`.
  - Old turn output that arrives after cancellation remains in the stream with its own sequence; the delivered queued user input must be appended at the delivery boundary before new response output for the interrupted delivery.

- State machine:
  - Queue row statuses remain within existing statuses where possible: `pending -> delivering -> delivered`, `pending -> cancelled`, `delivering -> pending` on busy/deferred, `delivering -> failed` on non-recoverable failure.
  - Interruption adds events, not a second queue status, unless implementation discovers a strong need for a distinct `interrupting` persisted status.
  - Worker statuses must not remain `working` solely because stale persisted text exists after cancel succeeds.
  - Successful cancellation must atomically advance the target worker's turn fence and put persisted worker state into a delivery-safe state (`idle` or a narrowly defined interrupted state) before the queued delivery attempts `askAgent`.
  - Any old async completion path must compare its captured turn token/generation before persisting run status, worker status, queue state, or worker response fallback entries.

- Events:
  - Server emits named events for request, refusal, cancel success, delivery start, delivery finish, and delivery failure.
  - User-relevant failures additionally emit `error.surfaced`.
  - Tests assert server decisions from events, not only DOM or snapshot diffs.

- Race handling:
  - Late `askAgent` responses from the interrupted turn cannot mark the interrupted queued message delivered or failed.
  - Cancelling a queued message while interrupt delivery is in flight keeps the row cancelled if the background call later resolves.
  - Switching selected runs before the interrupt mutation resolves cannot clear the new selected run's draft or queue drawer.

## Control-Plane Design

1. Frontend asks for interruption with one of two intents:
   - `messageId`: interrupt and deliver this queued message.
   - `draft`: persist this draft as a queued message, then interrupt and deliver it.

2. Server resolves the target:
   - load run,
   - verify provider/session type supports Omni worker interruption,
   - load specific queued row or create a queued row from draft,
   - resolve target worker from `targetWorkerId` or latest eligible non-cancelled worker.

3. Server cancels the current worker turn:
   - call `cancelAgentTurn(worker.id)`,
   - cancel pending permissions as part of runtime behavior,
   - measure cancellation duration,
   - advance the worker turn fence so older async completions are stale,
   - update persisted worker status/current text in the same DB mutation as the fence advancement so immediate delivery does not hit stale busy state,
   - emit `queue.interrupt_cancelled_turn`.

4. Server delivers the queued message:
   - mark queue row `delivering`,
   - capture the new turn token/generation for this delivery,
   - append `user_input` through `appendUserInputOnDelivery`,
   - call `askAgent` through the existing worker-turn gate,
   - persist worker response through existing response helpers,
   - before every terminal persistence update, verify the captured turn token/generation is still current,
   - mark queue row delivered or deferred/failed,
   - emit final named and execution events.

5. Clients converge:
   - mutation response updates the visible row immediately,
   - `/api/events` snapshot and named events become the durable truth,
   - worker-entry events wake the terminal to fetch the appended user input and response.

## Error And Refusal Cases

- No selected run or route run missing:
  - Return 404/400 as appropriate; no queued row mutation.

- No queued message and no draft:
  - Refuse with `queue.interrupt_refused` reason `no_user_intent`.

- Mention picker open:
  - Frontend consumes Escape for mention picker and does not call the server.

- Session provider unsupported:
  - Refuse with `session.action.refused` or `queue.interrupt_refused` reason `unsupported_session_provider`.

- Worker missing:
  - Keep queued row `pending`, record recovery-blocked event if existing recovery patterns apply, and surface `queue.interrupt.refused` or `queue.interrupt.delivery_failed`.

- Cancel fails:
  - Keep queued row `pending`, emit `queue.interrupt_delivery_failed`, emit `error.surfaced` with `queue.interrupt.cancel_failed`.

- Cancel succeeds but immediate `askAgent` still returns busy:
  - Keep queued row `pending`, set `lastError`, emit `queued_message_interrupt_deferred`, and do not lose draft/user intent.

- Delivery fails after user input is appended:
  - Follow existing queued-message failure policy. Preserve the worker-stream input entry for audit and mark the queue row failed unless the error is a known busy/deferred case.

## Implementation Checklist

- [ ] **1. Lock down behavior with server tests**
  - Add `tests/server/queued-message-interrupt.test.ts`.
  - Mock `cancelAgentTurn` and `askAgent` from `@/server/bridge-client`.
  - Cover oldest pending row selection by `(createdAt, id)`.
  - Cover specific queued message interruption.
  - Cover draft Escape creating exactly one queued row and delivering that same id.
  - Cover cancel failure preserving pending queued state.
  - Cover cancel succeeds but `askAgent` busy preserves pending queued state with `lastError`.
  - Cover late interrupted-turn completion cannot overwrite cancelled/delivered queue state.
  - Verification: `pnpm test -- tests/server/queued-message-interrupt.test.ts` fails for missing implementation.

- [ ] **2. Add bridge-client turn cancellation**
  - Modify `src/server/bridge-client/index.ts`.
  - Add `cancelAgentTurn(name: string)` using `POST /agents/${name}/cancel`.
  - Add bridge-client tests for success and errors.
  - Verification: `pnpm test -- tests/server/bridge-client.test.ts`.

- [ ] **3. Extract queue delivery helpers without changing behavior**
  - Modify `src/server/conversations/queued-messages.ts`.
  - Export/extract reusable FIFO selection, target worker resolution, attachment content building, and queued worker delivery helpers.
  - Keep existing `sendQueuedConversationMessageNow`, `drainQueuedImplementationMessages`, and `drainQueuedWorkerMessages` behavior passing.
  - If extraction is too large, move shared internals into a small helper module rather than expanding `queued-messages.ts` past 1200 lines.
  - Verification: `pnpm test -- tests/server/queued-messages.test.ts tests/api/conversation-messages-route.test.ts`.

- [ ] **4. Add the worker turn fence**
  - Modify `src/server/conversations/worker-turn-gate.ts`.
  - If no existing durable token is sufficient, modify `src/server/db/schema.ts` and `src/server/db/index.ts` to add a narrow worker turn generation/token.
  - Ensure every new interrupt delivery captures the active token/generation and stale old-turn completions cannot persist terminal updates.
  - Add tests that simulate an old `askAgent` resolving after a newer interrupt delivery has started.
  - Verification: `pnpm test -- tests/server/queued-message-interrupt.test.ts tests/server/queued-messages.test.ts`.

- [ ] **5. Implement server interruption workflow**
  - Create `src/server/conversations/queued-message-interrupt.ts`.
  - Implement specific message, next message, and draft interrupt entry points.
  - Use existing DB schema and queued-message statuses.
  - Use `runWorkerTurn` or an equivalent gate-safe path.
  - On successful cancel, advance the turn fence and reset persisted worker state before delivery starts.
  - Persist execution events and notify event-stream subscribers.
  - Verification: `pnpm test -- tests/server/queued-message-interrupt.test.ts`.

- [ ] **6. Add typed named events and surfaced errors**
  - Modify `src/server/events/named-events.ts`.
  - Add queue interruption events and error codes.
  - Include `cancelDurationMs` and `totalInterruptLatencyMs` where measurable.
  - Add tests in the nearest named-events/event-log test file.
  - Verification: `pnpm test -- tests/server/events/named-events.test.ts tests/server/events/log-endpoint.test.ts`.

- [ ] **7. Expose portable and Next API routes**
  - Modify `src/runtime/http/routes/conversation-messages.ts` and `src/runtime/http/routes/index.ts`.
  - Add Next route shims under `src/app/api/conversations/[id]/queued-messages/...`.
  - Preserve existing `PATCH`/`DELETE` behavior.
  - Add API tests for auth/same-origin, specific interrupt, next interrupt, draft interrupt, refusal cases, and response shape.
  - Verification: `pnpm test -- tests/api/conversation-messages-route.test.ts`.

- [ ] **8. Extract queued-message mutations before adding UI mutation**
  - Create `src/app/home/useQueuedMessageMutations.ts` or another focused home mutation module.
  - Move existing cancel/send-now queued-message mutations out of `useHomeMutations.ts`.
  - Add interrupt mutation there.
  - Preserve owner-token checks before clearing draft or hiding queue rows.
  - Verification: existing app mutation tests plus source check that `src/app/home/useHomeMutations.ts` stays below 1200 lines.

- [ ] **9. Extend queue manager state**
  - Modify `src/app/home/BusyMessageQueueManager.ts`.
  - Add manager-owned interruption pending state.
  - Ensure event-stream snapshots remain server-authoritative and clear optimistic flags when rows leave pending/delivering states.
  - Add/adjust manager tests if available.
  - Verification: `pnpm test -- tests/app/event-stream-state-manager.test.ts`.

- [ ] **10. Add Escape intent helpers and tests**
  - Modify `src/app/home/composer-keyboard.ts`.
  - Add pure Escape interrupt helper that rejects modifier keys and IME composition.
  - Keep Enter and alternate Enter helpers unchanged.
  - Verification: `pnpm test -- tests/app/composer-keyboard.test.ts tests/app/composer-interrupt-keyboard.test.ts`.

- [ ] **11. Wire composer Escape and drawer action**
  - Modify `src/components/home/ConversationComposer.tsx`, `src/app/home/ComposerContainer.tsx`, and `src/components/home/QueuedMessageDrawer.tsx`.
  - Mention-picker Escape remains local to the picker.
  - Composer Escape calls interrupt only when busy and there is draft or pending queued intent.
  - Drawer action calls specific-message interrupt.
  - Existing send-now arrow remains non-interrupt send-now.
  - Use lucide icons and translated aria/title strings.
  - Verification: app/unit tests and manual keyboard smoke if running app is available.

- [ ] **12. Add locale keys across all locales**
  - Modify every file in `shared/locales/*.json`.
  - Add the same stable keys in each locale file.
  - Use best-effort translations consistent with current locale quality.
  - Verification: run existing i18n/static tests if present; otherwise run `pnpm test -- tests/ui/settings-dialog.test.ts tests/app/composer-keyboard.test.ts` and `rg -n '"queued.message.interruptSendAria"|hardcoded label text' shared/locales src/components/home src/app/home`.

- [ ] **13. Add lifecycle scenario**
  - Add `tests/lifecycle/scenarios/queued-message-interrupt.test.ts`.
  - Drive the control plane through HTTP/SSE, not Chromium.
  - Assert named events:
    - `queue.interrupt_requested`
    - `queue.interrupt_cancelled_turn`
    - `queue.interrupt_delivery_started`
    - `queue.interrupt_delivery_finished` or failure event for negative case.
  - Assert queued row and worker entries converge after reconnect/resync.
  - Verification: `pnpm test:lifecycle -- tests/lifecycle/scenarios/queued-message-interrupt.test.ts` if supported; otherwise `pnpm test:lifecycle`.

- [ ] **14. Document observability contract**
  - Modify `docs/architecture/lifecycle-observability-and-testing.md`.
  - Add a short section for queued-message interruption events and testing expectations.
  - Verification: `rg -n "queue.interrupt|queued-message interruption" docs/architecture/lifecycle-observability-and-testing.md`.

- [ ] **15. Run focused verification suite**
  - Run:
    - `pnpm test -- tests/server/bridge-client.test.ts`
    - `pnpm test -- tests/server/queued-messages.test.ts tests/server/queued-message-interrupt.test.ts`
    - `pnpm test -- tests/api/conversation-messages-route.test.ts`
    - `pnpm test -- tests/app/composer-keyboard.test.ts tests/app/composer-interrupt-keyboard.test.ts tests/app/event-stream-state-manager.test.ts`
    - lifecycle command from step 13.
  - Inspect failures for race conditions before making additional changes.

## Self-Review

- Requirement mapping:
  - Claude Code-style Escape behavior maps to tasks 5, 7, 10, and 11.
  - Existing queued-message preservation maps to tasks 3, 5, and 9.
  - Observable control-plane behavior maps to tasks 6, 13, and 14.
  - Frontend i18n maps to tasks 11 and 12.
  - No parallel worker persistence is preserved by tasks 3 and 5.

- File growth:
  - `src/app/home/useHomeMutations.ts` is 1162 lines; the plan requires extracting queued-message mutations before adding interrupt logic.
  - `src/server/conversations/queued-messages.ts` is 999 lines; the plan creates `queued-message-interrupt.ts` and limits changes to helper extraction.

- Client/server state:
  - The server remains authoritative for queue rows and events.
  - Optimistic UI state is limited to pending-action flags and guarded by selected `runId`.
  - Worker stream remains append-only and authoritative for worker conversation content.

- Scope discipline:
  - No branch, worktree, deletion, new settings preference, mobile redesign, or new persistence layer is included.
  - Future product direction is context only; every current-milestone requirement is represented in the executable checklist.

- Risk notes:
  - The most likely implementation bug is treating successful cancel as equivalent to safe delivery while stale worker state still says `working`; tests must prove the transition.
  - The second likely bug is clearing the draft/queue after the user switches runs; mutation owner-token checks are required.
  - The third likely bug is old turn output arriving after cancellation and confusing delivery assertions; worker-entry ordering tests are required.

## Second-Opinion Review

- Reviewer: Gemini CLI, after `baton` and Claude CLI timed out without output and Codex CLI failed to start because its local config rejected `service_tier = "default"`.
- Verdict: READY, with hardening suggestions applied.
- Applied changes:
  - Added an explicit worker turn-generation/token fence requirement.
  - Added cancellation and total interruption latency fields to named events.
  - Strengthened the requirement that successful cancel resets persisted worker state before queued delivery starts.
