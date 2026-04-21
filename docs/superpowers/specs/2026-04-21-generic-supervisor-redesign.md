# Generic Supervisor Redesign

## Summary

The current supervisor is too brittle because it mixes deterministic orchestration with ad hoc model-driven control flow, treats tool payloads like ordinary chat strings, and hardcodes a narrow plan/checklist execution path. The redesigned supervisor should be a general-purpose supervisory layer over external CLI coding agents such as Codex and Claude Code.

The supervisor's job is not to directly implement code. Its job is to do what a strong human technical lead does while supervising external coding agents:

- decide what work should happen next,
- delegate focused subproblems,
- watch agent output and repo state,
- ask whether the work is truly complete,
- keep pushing until the goal is actually satisfied,
- recover from failure without losing the thread.

This redesign entirely removes the current brittle plan/checklist-first model and replaces it with a generic event-driven orchestration engine with hybrid memory, strict structured tool contracts, interval-driven and event-driven wakeups, and task-scoped external worker sessions.

## Goals

- Make the supervisor capable of supervising any software-delivery objective, not only a narrow plan/checklist workflow.
- Keep the supervisor autonomous by default, including continuing, cancelling, restarting, and validating work without user approval.
- Support both interval-based supervision and event-driven reactions to worker output or state changes.
- Treat external CLI coding agents as task-scoped workers that can be resumed if useful, but whose internal memory is not mirrored by the supervisor.
- Replace brittle text-based tool payload handling with strict structured tool/result envelopes.
- Make the supervisor restartable, observable, and durable across crashes or server restarts.

## Non-Goals

- Rebuilding Codex or Claude Code behavior inside OmniHarness.
- Maintaining a special-case "plan file plus checklist" orchestration path as the primary runtime model.
- Requiring the supervisor to own or reproduce the entire internal conversation history of external agents.
- Solving every advanced scheduling problem in v1, such as multi-run global prioritization or long-horizon portfolio management.

## Product View

### User Story

As a builder, I want to hand OmniHarness a software objective and have a supervisor keep external coding agents moving until the work is actually done, instead of manually babysitting them by repeatedly saying "continue," "why is this not fully implemented," or "did you test all the routes yet?"

### Supported Objective Types

The supervisor should be able to supervise at least these objective shapes:

- fully implement this spec,
- fix this bug,
- investigate why this failure is happening,
- finish this partially completed feature,
- validate whether this repo state satisfies the requested outcome,
- resume and complete a previously interrupted run.

The objective is a freeform supervisory goal, not a hardcoded flow selector.

### Baseline User Expectations

For a usable v1, the product should support:

- visible running, sleeping, blocked, failed, and completed supervisory states,
- visible worker lifecycle states,
- durable logs of supervisor decisions and worker interactions,
- message-level retry, edit, and fork recovery,
- validation-aware completion rather than naive "agent said done",
- clear explanations of why the supervisor took a given action,
- safe restart after process crash or API failure,
- continuous supervision without requiring the user to watch the screen.

### Baseline Supervisory Behavior

The most basic and most important supervisory behavior in v1 is not complex multi-agent orchestration. It is supervising one external coding agent well.

The baseline run should look like this:

- one main implementation worker is active,
- the supervisor checks that worker's output and state periodically,
- the supervisor mostly decides whether to wait or intervene,
- the supervisor intervenes when the worker appears stuck, done, confused, or in need of redirection,
- the supervisor keeps pushing until there is evidence the objective is actually satisfied.

Additional workers such as validators, debuggers, or replacement implementers are secondary behaviors layered on top of this core loop.

## Current Problems

### Current Architecture

The current implementation in `src/server/supervisor/index.ts` has these brittle properties:

- it assumes a plan/checklist model,
- it asks the model to call tools for deterministic operations such as plan reading,
- it stores human-readable tool results and reuses them as model-facing tool payloads,
- it keeps the orchestration loop largely in-memory,
- it directly parses tool arguments with `JSON.parse` and crashes on malformed payloads,
- it treats all tool calls as equally trustworthy once they exist.

### Root Cause Of Recent Failures

The recent Gemini errors were symptoms of a deeper protocol problem:

- tool arguments are expected to be JSON,
- tool results are also provider-specific structured payloads,
- the current supervisor loop sends raw prose and raw markdown back through the tool channel,
- the provider adapter for Gemini expects structured machine data and tries to parse it,
- malformed tool payloads crash the loop instead of becoming durable protocol errors.

The redesign must treat tool traffic as a strict machine protocol and UI logs as a separate concern.

## Recommended Architecture

The recommended architecture is a hybrid event-driven orchestrator with durable state and reusable supervisor memory.

### Three Layers

#### 1. Durable Run State

Persist state needed to resume supervision without trusting one long in-memory loop:

- objective,
- repository root and relevant scope,
- current supervisory status,
- active or recent worker handles,
- latest known repo observations,
- outstanding blockers,
- validation state,
- next scheduled wake,
- recent protocol errors,
- last meaningful supervisor decision.

#### 2. Hybrid Supervisor Memory

The supervisor should not rely on a single unbounded live chat transcript. Instead it should use:

- a short recent structured transcript,
- a rolling summary of prior reasoning and decisions,
- durable event and observation records,
- the current run snapshot as primary truth.

This gives the model continuity while keeping the system restartable and bounded.

#### 3. Execution Layer

The execution layer exposes structured tools that let the supervisor:

- inspect run state,
- spawn external workers,
- continue existing worker sessions,
- read worker status and output,
- cancel workers,
- inspect repo state,
- request or run validation,
- sleep until the next wake condition,
- ask the user when necessary,
- mark the run complete.

The LLM decides what to do next; the runtime executes it deterministically.

### Default Run Shape

For v1, the default run shape should optimize for supervising a single main worker rather than immediately fan-out orchestration.

The normal pattern is:

- start one main worker,
- observe it over time,
- continue it when needed,
- redirect it when needed,
- validate its claimed completion,
- replace it only if needed.

This should be the common path that the prompt, tools, state model, and UI make easy.

## Supervisor Control Loop

### Wake Sources

The supervisor should wake on:

- periodic watchdog interval,
- new worker output,
- worker state transitions,
- worker exit or stop reason,
- validation result arrival,
- user message,
- recovery action such as retry, edit, or fork,
- explicit run restart,
- protocol or runtime failure.

### Loop Shape

Each supervisory turn should follow this pattern:

1. Load the durable run snapshot.
2. Gather fresh observations.
3. Build a compact supervisor context from:
   - the run state,
   - recent transcript,
   - rolling summary,
   - latest worker events,
   - latest validation state.
4. Call the supervisor LLM with required tool use.
5. Execute exactly one supervisory action.
6. Persist:
   - tool request,
   - structured tool result,
   - human-readable log,
   - updated run state,
   - next wake condition.
7. Sleep until the next event or timer.

This makes the system both autonomous and restartable.

### Default Conversational Turn

The supervisor should treat each wake as another turn in its own ongoing conversation, not as an unrelated one-shot planner call.

Each turn should provide the model with a compact observation bundle including:

- the active worker state,
- the latest output snapshot,
- whether the output changed since the last wake,
- how long it has been since the last output change,
- recent validation or repo observations,
- the previous supervisor summary and last decision.

The supervisor then chooses exactly one next action.

In most turns, the correct action will simply be to wait and check again later.

### Wait As A First-Class Action

`wait` or `sleep` must be a first-class supervisory action, not hidden runtime behavior.

The supervisor should be able to explicitly choose:

- wait because the worker is making progress,
- wait because the worker may still be thinking,
- wait until a shorter or longer interval based on observed conditions,
- wake immediately on a relevant event instead of only by timer.

This makes "no intervention yet" a real supervisory decision rather than an absence of logic.

### Stall Detection

The runtime should supply the supervisor with simple stall signals derived from worker observation history.

The baseline heuristic should be:

- if worker output changed recently, keep waiting,
- if output has not changed for roughly 30 seconds, wake the supervisor,
- if repeated stagnant snapshots occur, bias the supervisor toward intervening,
- if the worker explicitly appears done, waiting, blocked, or confused, wake immediately.

The exact timing can be configurable, but the default should support the common pattern: "watch the worker, and once it stops moving for a while, decide what to do next."

## Worker Model

### Task-Scoped External Workers

Workers should be task-scoped external harnesses, not long-lived in-process subagents.

The default supervisory pattern is:

- spawn one main worker for the current implementation objective,
- observe progress through periodic and event-driven snapshots,
- continue or redirect that worker if appropriate,
- validate the result when it appears done or stalled,
- tear the worker down when it is done, stale, blocked, or replaced,
- optionally spawn additional workers only when the main supervisory loop needs them.

### Persisted Worker Metadata

The supervisor should persist only the metadata it needs to supervise:

- worker id,
- harness type,
- cwd,
- assigned subproblem,
- external conversation/session identifier if the harness exposes one,
- last requested action,
- last known state,
- recent output snapshot,
- stop reason,
- timestamps.

The supervisor does not need to mirror the worker's full internal memory.

### Continuing Existing Worker Sessions

Continuing an existing worker conversation should be a supported option, not the default assumption.

The supervisor should be able to choose between:

- continue an existing worker conversation,
- spawn a new worker for the next attempt,
- spawn a separate validator worker,
- cancel and replace a stale worker.

That decision should be based on run state and fresh observations, not hardcoded flow.

### Primary Intervention Types

For the baseline one-worker loop, the most common interventions are:

- `wait_until` because the worker is still progressing,
- `worker_continue` when the worker appears to have stopped but should keep going,
- `worker_redirect` when the output indicates misunderstanding or missed requirements,
- `spawn_validator` when the worker may be done and the supervisor wants independent confirmation,
- `worker_cancel` and replace only when the current worker is clearly not converging.

This is the concrete "keep saying continue until the job is really done" behavior expressed as explicit tools.

## Validation Model

Validation should also be general and externalizable.

The supervisor should be able to request validation from:

- a specialized validator harness,
- a general coding agent asked to inspect repo state and answer whether the objective is complete,
- deterministic local checks where available,
- or a combination of those.

The key design point is that completion is not a single checklist flag. It is a supervisory decision backed by evidence.

### Completion Criteria

A run is complete when the supervisor has enough evidence that:

- the requested objective is satisfied,
- obvious regressions have been checked appropriately,
- the repo state matches the intended outcome,
- no active blocker remains unresolved.

The supervisor should be able to conclude either:

- done,
- not done yet,
- blocked,
- failed.

## Tool Contract

### Strict Tool Use

The supervisor loop should enforce:

- required tool use for normal supervisory turns,
- explicit terminal/control tools such as:
  - `wait_until`,
  - `run_sleep`,
  - `run_complete`,
  - `run_fail`,
  - `ask_user`.

The supervisor should not need to emit freeform prose to express control flow.

### Structured Tool Arguments

Tool arguments must be treated as untrusted machine payloads:

- validate before parse,
- parse inside guarded boundaries,
- persist malformed arguments as protocol errors,
- never crash the whole supervisor loop on malformed model output.

### Structured Tool Results

Every tool execution must return a structured JSON envelope to the model. Example shape:

```json
{
  "ok": true,
  "data": {
    "workerId": "worker-123",
    "state": "idle"
  },
  "summary": "Spawned worker worker-123"
}
```

or

```json
{
  "ok": false,
  "error": {
    "code": "spawn_failed",
    "message": "Bridge returned 503"
  },
  "summary": "Worker spawn failed"
}
```

Human-readable logs shown in the UI must be stored separately from the model-facing tool result.

### Consequence

The model-facing tool protocol becomes deterministic and typed.
The UI log becomes readable and operator-friendly.
They are no longer the same string.

## Prompting Strategy

The supervisor prompt should become general-purpose and role-oriented.

It should describe:

- the supervisor's job,
- its available tool surface,
- the expectation that it acts like a persistent technical lead,
- how to reason about delegation, validation, and continuation,
- examples of common objective types,
- the requirement to keep pushing until there is evidence of completion,
- the expectation that it should use workers and validators rather than doing implementation inline.

It should not encode a brittle fixed sequence like:

- read plan,
- update checklist,
- mark done.

Examples are useful. Hardcoded execution paths are not.

The prompt should also make the baseline behavior explicit:

- supervise one main worker well,
- keep watching output snapshots,
- choose `wait_until` when appropriate,
- intervene when output stalls or indicates confusion,
- use validation before trusting that the work is done.

## State Model

The run state should be generalized. Suggested baseline statuses:

- `queued`,
- `waking`,
- `observing`,
- `deciding`,
- `dispatching`,
- `sleeping`,
- `awaiting_user`,
- `validating`,
- `completed`,
- `blocked`,
- `failed`.

The UI should reflect these states clearly.

## Recovery And Fault Tolerance

The new system should treat failures as first-class supervisory events.

### Protocol Failures

Examples:

- malformed tool arguments,
- malformed tool result envelopes,
- missing required tool calls,
- unsupported tool names.

These should be persisted as protocol failures and surfaced in the run history.

### Runtime Failures

Examples:

- bridge errors,
- provider errors,
- invalid settings,
- worker harness crashes.

These should update run state durably and trigger the next supervisory decision rather than terminating the whole system silently.

### Crash Recovery

Because the supervisor is event-driven and state-backed, a server restart should be able to:

- reload active runs,
- determine which runs were mid-flight,
- schedule them for wakeup,
- continue from durable state and recent memory.

## Observability

For a supervisor product, observability is part of the feature, not just an internal convenience.

Persist and expose at least:

- each supervisor wake reason,
- each tool decision,
- each tool execution result,
- worker lifecycle transitions,
- validation attempts and conclusions,
- protocol failures,
- run summaries,
- sleep intervals and next wake reasons.

## Migration Strategy

The redesign should happen in stages:

1. Replace the current stringly typed tool result path with structured envelopes.
2. Remove plan/checklist-specific control flow from the core supervisor loop.
3. Introduce a generic run state model and event-driven wake scheduler.
4. Convert worker supervision to task-scoped external agents with durable metadata.
5. Add validator-style external supervision actions.
6. Replace the current narrow system prompt with a general supervisory prompt and examples.

## Testing Strategy

Tests should cover:

- malformed tool arguments do not crash the run,
- malformed tool results are persisted as protocol failures,
- supervisor turns require valid tool use,
- structured tool results are returned to the model while logs stay human-readable,
- worker output events wake the supervisor,
- interval wakeups work,
- supervisor can continue an existing worker conversation,
- supervisor can choose to spawn a new worker instead,
- validator responses can keep a run open or mark it done,
- server restart can recover sleeping or active runs,
- generic objectives such as:
  - implement spec,
  - fix bug,
  - investigate failure.

## Risks

- If the prompt is too vague, the supervisor may become indecisive or overly verbose.
- If the tool surface is too broad without clear result schemas, the protocol will remain fragile.
- If wake frequency is too aggressive, the system may become expensive or thrashy.
- If worker continuation semantics vary widely across harnesses, provider adapters may need careful normalization.

## Recommendation

Build a hybrid event-driven supervisor with strict structured tool contracts, task-scoped external workers, generalized run state, and validator-aware completion logic. This best matches the intended product: a persistent supervisory layer over external coding agents that behaves like a strong human lead rather than a brittle scripted checklist runner.
