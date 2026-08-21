# Long Awaits Need A Busy Status Before They Start

**Date:** 2026-08-16
**Context:** OmniHarness direct-control quota reset resume (`src/server/quota/worker-resume.ts`)

## Symptom

Run `e2168e17ff4b` was parked on a Claude session limit at 15:09 with a resume scheduled for 18:00. The wake fired on time, the session reattached, and the agent worked for fifteen minutes: five review passes, a revised plan file, a final answer offering to start Task 1. None of it appeared in the conversation. The run showed as finished at its pre-quota state, and the event log ended with `quota_recovery_refused` — *"Ignored a late quota recovery callback after the conversation became terminal"*, `runStatus: done`.

Every part of the recovery machinery reported success. The parse of "resets 6pm (Europe/Madrid)" was right, the wake fired at the right second, `recovery_policy_decision` chose `resume_quota_worker`, and `recovery_resolved` recorded a clean resume. The work was thrown away after all of that succeeded.

## Root Cause

`promptResumedQuotaWorker` awaited `askAgent` before recording anything about the turn. Marking the worker busy, emitting `worker_prompted`, and appending the supervisor input all sat after that await, so for the entire fifteen-minute turn the worker row stayed at `status = idle` with `updated_at` frozen at the resume.

`resolveDirectRunStatusFromWorkerOutput` reads an idle worker as a finished conversation. It is only held off by `ACTIVE_DIRECT_WORKER_STATUSES`, by `cred-exhausted`, or by an active quota incident owning the run. The incident had been resolved two seconds earlier, deliberately, so the "Waiting for quota reset" banner would not stay up while the worker was visibly working. That earlier fix removed the last thing pinning `runs.status`. The `quota_wait_preserved` events stop at 18:00:01 and the incident resolves at 18:00:03; from then until 18:15:45 nothing protected the run, and a reconciliation sweep flipped it to `done`.

When `askAgent` finally returned, `refuseLateQuotaRecovery` saw a terminal run, returned `ignored`, and dropped the response on the floor. The guard was working exactly as designed. It was reading state that the resume path had itself corrupted.

## Fix

Persist the busy status in the same guarded mutation that resolves the incident, so no window exists between the two:

```ts
const willPromptResumedWorker = shouldPromptResumedWorker(resumedWorker.state);
// ... inside runQuotaRecoveryMutation, same CAS on turnGeneration:
status: willPromptResumedWorker ? "working" : resumedWorker.state,
```

`promptResumedQuotaWorker` now also parks the worker back on `cred-exhausted` if the ask throws, guarded on both `turnGeneration` and the `working` status it set, so a failed resume reconciles to `quota_waiting` instead of stranding the run as `running`, and a newer turn or a Stop keeps its own status.

The prompt append stays after delivery. That ordering is load-bearing for a different regression (a Stop landing mid-delivery must not leave a phantom `supervisor_input` in the stream) and has its own tests.

## Verification

Two tests added to `tests/server/quota/worker-resume.test.ts`. The first holds the ask open, asserts the worker reads `working` mid-turn, and runs `updateDirectRunStatusFromWorkerOutput` at that moment — the sweep that used to end the conversation — asserting it resolves to `running` and that no `quota_recovery_refused` event is recorded. The second asserts a failed ask parks the worker back on `cred-exhausted` and reconciles to `quota_waiting`.

The first test was confirmed non-vacuous by reverting the one-line status change and watching it fail with `expected 'idle' to be 'working'`. All 18 tests in the quota suite pass, along with the conversations, supervisor, and queued-message suites. One failure in `tests/server/conversations-sync.test.ts:1512` predates this change and reproduces with it stashed.

The lost turn was recovered: 364 entries replayed from `.omniharness/agent-runtime-output/` into the unified worker stream via `scripts/backfill-runtime-output-to-worker-stream.ts`, filtered to the post-resume window so earlier entries were not appended out of sequence.

## Prevention

Any `await` that owns a worker for the length of an agent turn has to publish the busy status before it starts, not after it returns. `send-message.ts` and `queued-messages.ts` both set `status: "working"` inside `runWorkerTurn` before calling `askAgent`; the quota path was the one caller that skipped it, and it was also the path where turns run longest.

The sharper lesson is about what happens when a protective state is released. Resolving the incident early was correct for the banner, but the incident was doing two jobs: telling the user what was happening, and pinning `runs.status` against reconciliation. Releasing it released both. When you shorten the life of a state that other code reads as ownership, check what else was depending on it, and hand that job to something explicit before you let go.

Watch for the shape where a guard reads state that its own caller is responsible for maintaining. `refuseLateQuotaRecovery` looked correct in isolation and was correct in isolation. Its input was wrong.

## Skill/Doc Updates

No general skill update. `instrumenting-control-planes` already covers emitting typed events for every decision, and this failure emitted all of them faithfully — the events were how the loss was traced in the first place. The gap was in status ordering around a long await, which is specific to this codebase's worker lifecycle and is now covered by tests next to the code.

## Open Follow-Up

The same run recorded 3464 `quota_wait_preserved` events between 15:41 and 18:00, roughly one per second. The CAS at `direct-run-status.ts:205` only emits when it actually changes the row, so some other writer was flipping `runs.status` away from `quota_waiting` at that rate for two and a half hours. The `previousStatus: "running"` on every one of them names the value being written, not the writer. Not diagnosed.
