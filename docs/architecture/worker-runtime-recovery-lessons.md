# Worker Runtime Recovery Lessons

This note records the failure class exposed by run `ca18b7e86437` on
2026-05-20. It is intentionally concrete. The point is not only to explain
that incident, but to make sure future worker lifecycle changes preserve the
invariants that would have prevented it.

The short version:

- A completed or idle implementation worker was treated as an active blocker.
- A cancelled worker was later rewritten from a live bridge snapshot.
- A stale Gemini resume session id was retried as if it were authoritative.
- The recovery path blocked itself instead of clearing bad runtime state and
  spawning a fresh worker.
- The validator handoff tried to spawn before retiring an active worker that
  had already produced final-looking completion text.
- Worker allocation was inferred from loose wording instead of persisted
  `worker_role` and `allocation_key` metadata.

Those four mistakes combined into the repeated message:

```text
Blocked duplicate worker spawn because ca18b7e86437 already has active implementation worker ca18b7e86437-worker-4.
```

That message was accurate according to one stale branch of server state, but it
was wrong according to the real lifecycle. The active worker was not useful
work in progress. It was stale runtime state that recovery needed to retire.

## Incident Summary

Run `ca18b7e86437` belonged to project `/Users/masterman/NLP/directorscut`.
The implementation worker `ca18b7e86437-worker-4` had produced final-looking
output, then the supervisor repeatedly attempted to continue implementation.
Each attempt was blocked by the duplicate-worker guard because the system still
considered `worker-4` to be the active implementation worker.

At the same time, `worker-4` carried a saved Gemini session id:

```text
a83b4c52-8d3e-4037-8d03-f6bd6edb89df
```

Gemini refused to resume that id:

```text
Invalid session identifier "a83b4c52-8d3e-4037-8d03-f6bd6edb89df".
```

`gemini --list-sessions` did not include the id. Some stub files existed under
Gemini's temporary chat directory, but the provider did not recognize them as
resumable sessions. The provider list/resume API is the authority, not the mere
presence of files on disk.

The immediate recovery was to cancel `worker-4`, clear the bad resume state,
and start a new implementation worker. The replacement was
`ca18b7e86437-worker-5`.

## Root Causes

### Idle workers were treated as active blockers

The supervisor duplicate-spawn guard used an overly broad definition of
"active". It included `idle`, which is a valid post-turn state for a worker
that is no longer actively implementing anything. That let a completed or idle
implementation worker block all future implementation work for the run.

The invariant is:

```text
starting, working, running, interrupting, cancelling => active
idle, completed, failed, error, cancelled, stopped => not active blockers
```

If a future status is added, it must be classified deliberately. Do not let a
default branch silently make it a blocker.

### Cancelled workers were resurrected from late snapshots

The conversation sync path can poll live bridge snapshots and update worker
rows. That path must never rewrite a terminal local decision from stale remote
runtime data. In this incident, a cancelled implementation worker could be
observed again through a late snapshot and treated as live enough to block
replacement.

The invariant is:

```text
cancelled is terminal from the server database perspective.
```

Once the server marks a worker cancelled, later bridge snapshots for that
worker may append already-delivered stream content, but they must not promote
the worker back into an active lifecycle state.

### Missing provider sessions were not recoverable

The worker resume path recognized some "agent missing" failures but did not
classify Gemini's `Invalid session identifier` response as the same kind of
recoverable failure. Recovery therefore kept trying to reuse a session id the
provider had already rejected.

The invariant is:

```text
provider resume is best effort; provider refusal must clear saved runtime ids
and fall back to fresh spawn when fresh spawn is allowed.
```

Invalid, missing, expired, or unknown provider session identifiers are not
fatal by themselves. They mean the persisted bridge session id is stale.

### Filesystem artifacts were mistaken for resumability

Gemini may leave files in its temporary chat directory. Those files are useful
for forensic inspection, but they do not prove the session can be resumed.

The invariant is:

```text
a session is resumable only if the provider can list or resume it.
```

For Gemini, validate with the same environment the runtime uses and run
`gemini --list-sessions`. If the id is absent and `--resume <id>` fails, clear
the saved resume id and create a new worker.

### Recovery retried poison state

The supervisor had enough information to know that the old worker could not be
used, but the recovery path did not consistently retire the bad state before
the next spawn decision. That created a self-blocking loop:

```text
resume stale worker -> provider rejects session -> stale worker still active
-> duplicate guard blocks fresh worker -> supervisor retries
```

The invariant is:

```text
before attempting a fresh replacement, stale worker state must be made
non-blocking in the database.
```

Clearing `bridgeSessionId`, clearing runtime resume mode, and moving the worker
out of an active status are part of recovery. They are not optional cleanup.

### Validator handoff used the duplicate-spawn path

After the fresh implementation worker was started, the supervisor observed a
final-looking implementation result and attempted to spawn a validator. The
request text was simply validation-oriented:

```text
Validate Composable Video Understanding Capabilities
```

It did not say "validate worker output" or "review the diff", so the existing
separated-allocation heuristic did not recognize it as a validator handoff.
The duplicate-spawn guard saw the still-active implementation worker and
emitted another `worker_spawn_blocked` event before a later turn cancelled the
worker and spawned the validator.

The invariant is:

```text
validation spawn after final-looking worker output must park the completed
implementation worker before evaluating duplicate-worker refusal.
```

A validation handoff is not a duplicate implementation spawn. If the active
implementation worker has long final-looking output, park it as idle while
preserving its session id, emit `worker_completed_parked`, and then spawn the
validator. Do not surface `worker_spawn_blocked` for this path.

If the validator finds gaps, route the feedback back to the parked implementer
with `worker_continue` and `interventionType: "completion_gap"` whenever the
runtime session is still available. Spawning a brand new implementer is the
fallback, not the default.

### Worker roles must be explicit

The duplicate guard originally guessed from titles and prompts whether a worker
was a main implementation worker, a validator, or a separate slice. That made
small wording changes dangerous.

The invariant is:

```text
worker conflict checks use persisted role plus allocation key, not title text
as the primary source of truth.
```

New supervisor-spawned workers persist:

```text
worker_role: implementation | validation
allocation_key: main | slice:<stable-name>
```

The conflict rule is:

```text
block only active workers that conflict on allocation.
implementation/main blocks another implementation/main.
validation/main blocks another validation/main.
implementation/main blocks validation/main only until implementation has
final-looking output; then the implementer is parked and validation proceeds.
```

Validators do not replace implementers. Validators produce feedback. The
supervisor should feed unresolved issues back to the original implementer when
possible.

## Required Events

Every branch in this lifecycle must be externally visible through named events
or execution events. Silent recovery is not recovery. It is a future support
ticket.

At minimum, these decisions need event coverage:

| Decision | Required event |
| --- | --- |
| Duplicate implementation spawn refused | `worker_spawn_blocked` |
| Saved provider session is missing or invalid | `worker_session_missing` |
| Worker resume attempted | `worker_resume_attempted` |
| Worker resume failed | `worker_resume_failed` |
| Bad saved session state cleared | `worker_session_missing` or a more specific clear event |
| Final-looking worker parked before validator spawn | `worker_completed_parked` |
| Fresh replacement spawned | `worker_spawned` |
| User-visible recovery failure | `error.surfaced` with a stable code |

If a branch returns early because "there is already a worker", the event must
include the blocking `workerId`, that worker's status, and whether the worker is
actually considered active by the canonical status classifier.

## Triage Playbook

When a user gives a run id or conversation id and asks what happened, start
with persisted state. Do not guess from the UI.

1. Inspect `runs` for the id.
2. Inspect `workers` for the run, ordered by creation time.
3. Inspect `execution_events` for `worker_spawn_blocked`,
   `worker_resume_failed`, `worker_session_missing`, `worker_spawned`, and
   related supervisor events.
4. Inspect `messages`, `queued_conversation_messages`, validation records, and
   plan records only after the worker timeline is clear.
5. Inspect the worker stream at
   `app-data/run-data/<runId>/<workerId>.jsonl` or `.jsonl.gz`.
6. If the app server is running, inspect the dev event log:
   `GET /api/events/log?since=<id>&runId=<runId>`.
7. If a provider resume id is involved, validate it through the provider's own
   list/resume command using the runtime environment.

For Gemini specifically:

```bash
gemini --list-sessions
gemini --resume <session-id>
```

If the provider does not list or resume the id, do not keep retrying it.

## Regression Coverage

The minimum regression suite for this incident class is:

- `tests/supervisor/index.test.ts`
  - A completed idle implementation worker does not block a new worker.
  - A missing or invalid saved provider session starts a fresh worker.
  - A final-looking active implementation worker is parked before spawning a
    validator, without surfacing `worker_spawn_blocked`.
- `tests/server/conversations-sync.test.ts`
  - A cancelled implementation worker is not resurrected by a late live bridge
    snapshot.

These are unit-level guards. A future lifecycle scenario should also replay the
full end-to-end sequence:

1. Start an implementation worker.
2. Persist a provider resume id.
3. Make provider resume fail with "invalid session identifier".
4. Verify the server emits the missing-session event.
5. Verify the stale worker becomes non-blocking.
6. Verify a fresh implementation worker is spawned exactly once.
7. Verify no repeated `worker_spawn_blocked` loop appears.
8. Verify validator handoff after final-looking output emits
   `worker_completed_parked`, then `worker_spawned`, and no
   `worker_spawn_blocked`.

That scenario belongs under `tests/lifecycle/scenarios/` and should drive the
control plane through HTTP/SSE, not Chromium.

## Checklist Before Editing Worker Lifecycle Code

Before changing supervisor spawn, worker resume, bridge sync, recovery, retry,
or direct-control worker state:

- Are `cancelled`, `stopped`, `idle`, `error`, and `failed` handled explicitly?
- Does the duplicate-spawn guard use the canonical active-status classifier?
- Does provider resume failure clear stale runtime ids before fresh spawn?
- Is the provider list/resume API treated as authoritative over local files?
- Does validator handoff park final-looking active implementation workers
  before duplicate-spawn refusal?
- Does a validator gap route back to the parked implementer before starting a
  fresh implementer?
- Does every early return emit a named event or execution event?
- Does every user-relevant failure emit `error.surfaced` with a stable code?
- Does the code write worker content only through the unified worker stream?
- Is there a test proving no stale worker can block its own replacement?
- Is there a test proving a cancelled worker cannot be resurrected by sync?

If the answer to any item is "no", the change is incomplete.
