# Live journeys must assert recovery and settlement semantics

## Context

The Claude GPT-5.6 browser journey exercises several sessions, interruption, stop/resume, switching, reload, and offline recovery while also reading the named-event log.

## Symptoms

- The reconnect check failed because it required one new non-snapshot event-stream request within 60 seconds, although persisted snapshot polling had already recovered the UI.
- Event collection could skip a run's event because it queried each run separately while advancing one global cursor.
- Normal Claude turn completion was incorrectly required to emit `worker.terminal`.

## Root causes

The harness asserted transport details instead of product guarantees. It also treated a global event cursor as if it were safe to advance across multiple sequential filtered reads. Finally, it confused a resumable worker's `working -> idle` decision with a true terminal state such as cancelled or failed.

## Fix

- Offline recovery accepts any successful authoritative `/api/events` response, including the persisted snapshot fallback.
- The event log is read once from the global cursor and scoped to owned runs locally.
- A settled worker is proven by either `worker.status` to `idle` or `worker.terminal`; the explicit stop path still requires `worker.terminal: cancelled`.

## Verification and prevention

Unit tests cover atomic event collection and settlement classification. The complete headless-browser journey passes with three real Claude sessions. Browser tests should assert recovered state, ownership, and lifecycle decisions rather than a single request shape or timing accident.
