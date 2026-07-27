# Conversation deletion must fence worker startup

## Context

New direct conversations return before their first worker has finished spawning. This keeps the UI responsive, but it means a user can delete a conversation while its worker startup is still in flight.

## Symptom

The conversation disappeared from the sidebar and its database rows were deleted, yet Claude continued working. During live-journey cleanup, that worker recreated the already-removed test project and wrote `AUDIT.md` into it more than a minute after the delete request returned successfully.

## Root cause

The delete route called `cancelAgent(workerId)` once and deliberately ignored a not-found response. If the initial background startup had not registered the agent yet, the cancellation found nothing. The database cleanup then removed the only durable link to the worker, while the background startup completed normally and began its prompt.

## Fix

Conversation deletion now installs a run-scoped deletion fence before attempting worker cancellation. Background tasks are tracked by run. Initial direct and planning startup check the fence before spawning and again immediately after spawning; a worker that crosses the race is cancelled before any prompt is sent. The fence remains active until all background tasks owned by that run settle, then clears automatically.

The late-cancellation decision emits `worker.delete_race_cancelled`. A failed late cancellation emits `error.surfaced` with the stable code `conversation.delete.worker_cancel_failed`.

## Verification

- A unit test proves the deletion fence remains active until the run's tracked background task settles.
- A conversation-route regression holds worker startup open, requests deletion, completes the spawn, and proves the late worker is cancelled without receiving its prompt.
- A run-route regression proves deletion installs and retains the fence while run-owned background work is still pending.
- The orphaned live-test worker was stopped, its database rows were absent, and the recreated project remained gone after targeted cleanup.

## Prevention

Any endpoint that deletes durable ownership while work can still start in the background must establish a cancellation fence before removing records. A one-time best-effort cancellation is not sufficient when resource creation is asynchronous. Background work must be tracked by the same durable subject the delete operation owns.
