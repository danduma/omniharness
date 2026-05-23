# Queued Steering Delivery Requires Post-Input Output

## Context

Forced queued steering can append the user input to the unified worker stream before asking the bridge worker. If the bridge returns an empty response and the live snapshot contains only old output, treating the turn as delivered makes the queue row disappear even though the worker did no new work.

## Learning

Do not mark queued worker steering as delivered solely because `askAgent` returned without throwing. Delivery must be backed by either a non-empty ask response or a worker-stream entry after the delivered `user_input` entry.

## Guardrail

When changing queued delivery, add tests that pre-seed old worker output, force an empty bridge response, and assert the queued row fails instead of emitting `queued_message_delivered`.
