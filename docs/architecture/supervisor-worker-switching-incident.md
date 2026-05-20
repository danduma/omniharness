# Supervisor Worker Switching Incident

> Lessons from session `690d2fa9f2a7`: stopping Codex, switching to Gemini, and watching the UI say nothing happened.

## Why this document exists

This incident exposed a cluster of lifecycle bugs that all looked like the same user experience:

> The user explicitly changed what should happen next, but the supervisor either resumed the wrong thing, spawned too much, or hid the live worker behind stale persisted state.

The session was valuable because the failure crossed every layer that matters:

- user intent parsing
- persisted run and worker state
- supervisor wake/resume behavior
- worker selection UI
- bridge runtime state
- unified worker stream ordering
- event and observer visibility

We keep this document as a regression checklist. If future work touches supervisor continuation, worker spawning, worker selection, or worker transcript persistence, read this first.

## What happened

The user stopped a Codex worker because they wanted to change the next worker to Gemini. The UI correctly paused and asked:

```text
I paused the active workers after you stopped one. Is there anything you want to modify before I continue?
```

Then the system resumed work before the user could complete the change. Later, when the user sent:

```text
continue but using gemini cli with gemini 3
```

the bridge did launch Gemini workers, but the persisted app state still showed them as `starting`, so the UI looked like nothing happened. Worse, the supervisor spawned two Gemini continuation workers.

Finally, one worker transcript showed the original supervisor prompt at the end of the conversation, after the worker had already streamed tool calls and its final answer.

These were not one bug. They were several missing invariants.

## Root causes

### 1. `awaiting_user` was treated as runnable

The supervisor and wake paths considered any non-terminal implementation run active enough to continue. That made `awaiting_user` eligible for automatic resume, recovery, and worker follow-up.

That is wrong. `awaiting_user` means the user owns the next transition.

Required invariant:

> Implementation runs can be active but not runnable. `awaiting_user` is active for display, but not runnable by supervisor or recovery.

Code must use the stricter runnable predicate when deciding whether to execute supervisor work.

Regression expectations:

- A wake for an `awaiting_user` implementation run does not execute the supervisor.
- A recovery reconciler does not auto-resume workers for an `awaiting_user` implementation run.
- If a run becomes `awaiting_user` while a supervisor model call is in flight, the tool call returned by that model is ignored.

### 2. Worker selection was stored too narrowly

The run's `allowedWorkerTypes` had been narrowed by earlier worker availability, so the dropdown could become effectively locked to one CLI. First it looked like only Codex was selectable; later only Gemini was selectable.

That is wrong for implementation continuation. The dropdown should choose the next worker preference, not permanently collapse the run to the last selected worker.

Required invariant:

> The worker selector controls the next worker spawn. It must not be locked to the previous worker type when multiple configured worker types are available.

Regression expectations:

- For selected implementation runs, the composer exposes all configured/available worker types.
- Sending a conversation message includes the current preferred worker type, model, effort, and allowed worker type list.
- Natural language like `switch workers to gemini` updates the same persisted preference before resuming the supervisor.

### 3. Natural-language switch requests were not control-plane intent

The text `switch workers to gemini` is not just a chat message. It is an instruction to update the next worker selection before the supervisor continues.

Required invariant:

> Before resolving clarification or resuming a supervisor, message handling must apply explicit composer worker preference and recognized worker-switch text to the run row.

Regression expectations:

- A clarification answer with selected Gemini persists `preferredWorkerType = "gemini"` before the supervisor resumes.
- A clarification answer that says `switch workers to gemini` does the same, even if the dropdown was not changed.
- The worker spawned after that point uses the new preference.

### 4. Starting workers with live bridge sessions were invisible

The observer skipped every worker whose persisted status was `starting`. That protected freshly reserved rows before bridge spawn completed, but it also hid workers that already had a `bridgeSessionId`.

In the incident, Gemini workers were live in the bridge runtime and producing output, but SQLite still said `starting` and the unified worker stream lagged behind. The UI rendered the persisted truth, so it looked dead.

Required invariant:

> A fresh `starting` row with no bridge session is not pollable. A stale `starting` row with a bridge session is pollable and must be reconciled from the bridge.

Regression expectations:

- Observer does not poll a newly reserved worker row with no `bridgeSessionId`.
- Observer gives a short grace period after spawn.
- After the grace period, a `starting` worker with `bridgeSessionId` is polled, its snapshot is persisted, and its status advances to the bridge state.

### 5. Duplicate-spawn detection misclassified continuation prompts

The duplicate-spawn guard allowed multiple workers when it believed the existing worker was a separate validation/review allocation. It used broad text matching: any prompt with words like `review` and `worker` could be considered separate.

The continuation prompt said the previous worker had stopped and the new worker should review current repository state before continuing. That is normal main-worker continuation, not independent validation.

Required invariant:

> "Review current state and continue" is main implementation work. It must not be classified as a separate validator/reviewer allocation.

Regression expectations:

- An active main worker whose prompt mentions reviewing current state after a previous worker stopped still blocks another main worker spawn.
- Independent validation remains allowed only when the prompt clearly describes a separate review of worker output, result, diff, patch, or an explicitly separated slice.

### 6. Supervisor input was appended after streamed worker output

For supervisor-spawned workers, the server appended `supervisor_input` after `askAgent()` resolved. Gemini streams output while `askAgent()` is still in flight. That meant bridge output received earlier sequence numbers, and the original instruction appeared at the end of the transcript.

Required invariant:

> For a freshly supervisor-spawned worker, append the initial `supervisor_input` before invoking `askAgent()`, so the worker stream reads input -> worker activity -> answer.

Regression expectations:

- A supervisor-spawned worker prompt is the first supervisor input before streamed bridge output.
- Failover handoff prompts follow the same rule.
- Ordinary follow-ups that may hit a busy worker still need delivery-aware handling; do not append speculative duplicate follow-ups to the stream.

## The invariants we keep

### User pause is a hard boundary

When a user stops a worker and the run enters `awaiting_user`, no background path may reinterpret that as "continue when convenient".

Allowed:

- render current state
- persist the user's next instruction
- update worker preferences
- wait for explicit resume/answer

Not allowed:

- supervisor wake execution
- recovery auto-resume
- missing-agent resume
- worker follow-up delivery
- replacement worker spawn

### Next-worker preference is applied before continuation

When the user changes the dropdown or says `switch workers to <type>`, the run preference changes before clarification resolution or supervisor continuation. The next worker spawn reads that persisted preference.

### Bridge truth must reconcile persisted truth

The UI renders persisted worker state and worker-stream entries. If the bridge has a live worker but persistence says `starting`, the system is lying to the user. The observer exists to close that gap.

### The worker stream is chronological by sequence, not by hope

`seq` order is the transcript. Timestamps are informational. If an entry is appended late, it will render late. Therefore the code that appends server-produced input must run before any bridge output can be appended for the same turn.

## Testing checklist

Add or update tests whenever touching these paths:

- `tests/supervisor/wake.test.ts`
  - awaiting-user runs are not executed by wake
- `tests/server/runs/recovery-reconciler.test.ts`
  - awaiting-user implementation runs are not auto-resumed
- `tests/supervisor/index.test.ts`
  - mid-turn pause prevents later tool calls from resuming workers
  - duplicate continuation workers are blocked
  - supervisor-spawned worker prompt is anchored before streamed bridge output
- `tests/supervisor/observer.test.ts`
  - fresh starting workers are skipped
  - stale starting workers with bridge sessions are polled and persisted
- `tests/api/conversation-messages-route.test.ts`
  - composer worker selection applies before clarification resolution
  - natural-language worker switch applies before supervisor continuation
- UI tests around the composer/dropdown
  - all configured worker types remain selectable for implementation continuation

## Debugging playbook

When a user gives a session id and says "nothing happened":

1. Start with `runs`.
   - Check `status`, `mode`, `preferred_worker_type`, `allowed_worker_types`, model, effort.
2. Check `workers`.
   - Compare persisted `status`, `type`, `bridge_session_id`, `created_at`, `updated_at`.
3. Check `execution_events`.
   - Look for `worker_selection_changed`, `clarification_resolved`, `worker_spawned`, `worker_output_changed`, `worker_session_resumed`, `recovery_*`.
4. Check bridge runtime.
   - A live bridge worker with persisted `starting` means observer reconciliation is failing.
5. Check `run-data/<runId>/<workerId>.jsonl`.
   - The UI transcript follows `seq`. If an entry is visually late, find its line and sequence number.
6. Check active locks only after confirming writes are stalled.
   - A lock held by the running app process may simply mean the app is writing. Do not delete locks casually.

## Anti-patterns

Avoid these patterns:

- Treating `awaiting_user` as "active enough to continue".
- Narrowing `allowedWorkerTypes` so the user cannot choose the next worker.
- Applying worker preference after resolving the clarification.
- Parsing "review current state" as a separate validation worker.
- Skipping all `starting` workers forever.
- Appending server input after a long-running streamed `askAgent()`.
- Adding a second persistence surface for worker conversation content.
- Using UI silence as evidence that nothing happened without checking bridge state.

## The short version

The user stopped the worker to change the next worker. That must be respected as a durable control-plane boundary. The next worker selection must be persisted before continuation. A spawned bridge session must be reflected back into the persisted worker stream. And the transcript must be ordered by the actual worker turn: input first, output after.

