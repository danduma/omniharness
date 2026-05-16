# Implementation Plan: Intelligent Worker Failover on Quota Exhaustion

> **For agentic workers:** REQUIRED SUB-SKILL: Use `ultrapowers:subagent-driven-development` (recommended) or `ultrapowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Goal

When the worker currently driving a run exhausts its quota, the framework should automatically switch to the **next available worker in the user's priority list** (`WORKER_ALLOWED_TYPES`), seeded by a structured handoff so it can resume the in-flight task. If no other worker is available, fall back to the existing quota-reset auto-resume path.

This is the first concrete step toward general load balancing across the priority queue. Future passes will add proactive (pre-exhaustion) handoff and steady-state load balancing. This plan deliberately stops short of those.

## Scope

In scope:
1. Detect worker quota exhaustion during a run (already partly built).
2. Pick the next spawnable worker from the priority list, **excluding** worker types currently in quota wait.
3. Ask the outgoing worker to emit a structured **handoff report** before terminating.
4. Spawn the next worker with the handoff report as its seed prompt.
5. If no replacement is available, keep today's behaviour: park the run in `quota_waiting` and wake on reset.
6. Surface failover in the UI (event in feed, badge on the conversation).

Out of scope (explicit non-goals for this pass):
- Proactive "almost out of quota" prediction and migration before exhaustion. The user described this as the ideal; we'll do it in a follow-up once token-usage persistence (the CLI-quota-tracking plan) is wired up — without it we have no remaining-tokens signal to threshold on.
- Cross-run load balancing (e.g., shifting other runs off a worker that is getting hot).
- Per-conversation overrides of the priority list — uses run-level `allowedWorkerTypes` only.
- Multi-supervisor / multi-host coordination.

## Background — current state

Findings from a codebase sweep (file paths inline):

- **Priority list** is `WORKER_ALLOWED_TYPES` (ordered JSON array) plus `WORKER_DEFAULT_TYPE` (first item). Stored per-run as `runs.allowedWorkerTypes`. Persisted/edited in `src/components/settings/AgentsSettingsPanel.tsx:42-99`, defaults in `src/app/home/constants.ts:70-109`.
- **Fallback selection** already exists for spawn-time *availability* failures: `selectSpawnableWorkerType()` in `src/server/supervisor/worker-availability.ts:515-563` walks the allowed list and returns the first spawnable type. It does **not** consider quota state.
- **Spawn-time gating** in `isSpawnableWorkerType()` (`worker-availability.ts:461-498`) checks binary + (placeholder) auth only. No quota check.
- **Quota detection** is mature: `extractQuotaResetInfo` / `parseQuotaResetText` in `src/server/quota/reset-parser.ts` cover headers, ISO timestamps, durations, and time-only strings. Called from supervisor model path, worker spawn, and worker continuation in `src/server/supervisor/index.ts:924-962, 1042-1052, 1116-1122`.
- **Quota recovery** (`src/server/quota/recovery.ts`) opens a `quota_exhausted` recovery incident, sets the run to `quota_waiting`, and schedules a durable supervisor wake at `resumeAt`. Worker-specific: also marks `workers.status = "cred-exhausted"`.
- **Run state machine** (`src/server/runs/recovery-state.ts`) already has `quota_waiting`, `wait_for_quota_reset`, and carries `resumeAt`, `quotaResetSource`, `quotaResetConfidence`.
- **No mid-run handoff exists.** Planning has `<omniharness-plan-handoff>` blocks (`src/server/planning/artifacts.ts`), but nothing analogous for worker→worker transfer.
- **Worker-type swap is technically possible** today (`worker_cancel` then `worker_spawn` with a different `type`), but the supervisor has no prompt guidance or tool to do it on quota.

So: detection ✅, recovery-by-waiting ✅, switching ❌, handoff ❌, quota-aware availability ❌.

## Design

### 1. Quota-aware spawnability — reuse existing persisted signal

There is **already** a persisted, type-level quota-blocked check used by planning review: `isWorkerTypeQuotaBlocked(type)` in `src/server/planning/review-agent-selection.ts:12-42`. It returns true when any worker of that type has `status = "cred-exhausted"` **or** there is an open/waiting/`quota_waiting` `recoveryIncidents` row of kind `quota_exhausted` tied to a worker of that type. Both signals are set today by `handleWorkerQuotaExhaustion` (`src/server/quota/recovery.ts:79-118`).

Rather than introducing a parallel in-memory cooldown registry — which would diverge from the source of truth and risk drift across processes — we will:

1. **Extract** `isWorkerTypeQuotaBlocked` into `src/server/quota/type-blocking.ts` so both planning-review and failover use the same predicate. Move call sites in `review-agent-selection.ts` to the new module.
2. **Extend** the function with `quotaBlockedTypes(allowedTypes): Promise<Map<WorkerType, { reason: string; resumeAt: Date | null }>>` so callers can render reasons and pick the earliest reset for UI.
3. **Extend** `isSpawnableWorkerType` (`worker-availability.ts:461`) with an optional `quotaBlocked?: Set<WorkerType>` injected by the caller. Pure synchronous availability remains unchanged; the async DB check happens once at the call site and is passed in. This keeps the spawnability function side-effect free and easy to test, and lets `selectSpawnableWorkerType` skip blocked types without becoming async.
4. **Extend** `selectSpawnableWorkerType` to accept the same `quotaBlocked` set, and add `selectSpawnableWorkerTypeAsync(...)` as a thin async wrapper that builds the set via `quotaBlockedTypes()` before delegating. The async wrapper is what failover and any new "select a worker" call sites use.

Resolution behaviour. There is a real lifecycle gap when failover *succeeds*: the run stays `running`, so the durable wake path at `src/server/supervisor/wake.ts:118-132` (which only fires the quota-reset clearing when `run.status === "quota_waiting"`) never resolves the incident or clears `workers.status = "cred-exhausted"` for the outgoing worker. Without a fix, the type stays blocked forever for that run's process lifetime, and `quotaBlockedTypes` keeps reporting it as unavailable.

We close this with **belt and braces**:

- **(a) Time-based filter in the predicate.** `quotaBlockedTypes` ignores incidents whose stored `resumeAt` (in `recoveryIncidents.details.resumeAt`) is in the past — the parsed reset has already happened, so the type is eligible regardless of incident status. For `cred-exhausted` worker rows, we additionally check the run's most recent quota incident for that worker; if the resumeAt has passed, treat the row as stale and not blocking.
- **(b) Active clearing on quota wake.** Extend the durable-wake handler so that when a `quota_wait` durable wake fires, it resolves *all* open `quota_exhausted` incidents whose `resumeAt` has passed for that run and flips any still-`cred-exhausted` worker rows to `stopped` — even when the run is currently `running`. The existing `resumeQuotaExhaustedWorkers` call is only made for `quota_waiting` runs; we add a sibling `clearResolvedQuotaIncidents(runId)` that runs unconditionally on `quota_wait` wake reason.

(a) alone would work, but (b) keeps the DB tidy so the planning-review predicate (which also reads these signals) doesn't accumulate stale rows.

We do **not** add new schema in this pass; `2026-05-15-cli-quota-tracking.md` owns durable quota persistence.

### 2. Failover trigger points

There are **four** places quota errors surface in the server, not three. The observer path was missed in the first draft and is in fact the most common live-worker site:

| Site | File:line | What we do today | What we do after this plan |
|---|---|---|---|
| Supervisor model call | `src/server/supervisor/index.ts:924` | Park run in `quota_waiting` | Unchanged — supervisor LLM swap is the codex-subscription-supervisor plan's concern. |
| Worker spawn | `src/server/supervisor/index.ts:1042` | Park run in `quota_waiting` | Try `selectSpawnableWorkerTypeAsync` excluding blocked types; if a different type is returned, retry spawn with it. Else park. Reserved-row cleanup per §3. |
| Worker continue | `src/server/supervisor/index.ts:1116` | Park run in `quota_waiting` | Run failover (handoff + replacement) per §4. Else park. |
| Run observer (live snapshot) | `src/server/supervisor/observer.ts:955-969` | `handleWorkerQuotaExhaustion` → `stopRunObserver` → wake supervisor | Same handler still fires, but **after** it parks state, the supervisor wake should pick up the run, see `cred-exhausted` on the current worker, and the next supervisor turn enters the failover path (§4) instead of immediately treating the run as `quota_waiting`. |

The observer path is the trickiest because it runs *outside* the supervisor turn loop and already calls `handleWorkerQuotaExhaustion` eagerly. Two viable shapes:

- **A. Observer-side failover** — call a new `attemptObserverFailover()` before `handleWorkerQuotaExhaustion`, mirroring the supervisor branch. Pro: instantaneous. Con: duplicates orchestration in two places, observer becomes responsible for handoff timing.
- **B. Supervisor-driven, observer marks intent** — observer marks the incident with `failover_pending: true` and wakes the supervisor; the supervisor wake handler detects the flag and runs failover before honouring `quota_waiting`. Pro: one code path. Con: one extra supervisor tick of latency.

**Choose B.** Latency is acceptable (sub-second on warm supervisor) and the centralised path is easier to test through the named-event surface.

**But B as currently sketched is broken against the live code.** Two gates have to be opened explicitly:

1. **The observer only wakes the supervisor for `needs_recovery` returns** today — see `src/server/supervisor/observer.ts:965`. For a normal `quota_wait` return (which is the common case, since most CLIs surface a parsable `resetAt`), the supervisor is **not** woken. We must change the observer: when failover is enabled and there are ≥2 allowed types for this run, call `wakeSupervisor(runId, 0)` unconditionally after `handleWorkerQuotaExhaustion` returns — regardless of whether the result was `quota_wait` or `needs_recovery`. The `failover_pending` flag goes on the incident details before the wake.
2. **The supervisor wake handler returns early for `quota_waiting` runs that have a future durable wake** — see `src/server/supervisor/wake.ts:105-110`. This early-return is what prevents wasted supervisor ticks during the quota wait. For failover we must **bypass it when `failover_pending` is set on the most recent open quota incident for this run**. Concretely: after computing `dueDurableWake` and loading `run`, check the run's most recent open `quota_exhausted` incident; if its details carry `failover_pending: true`, skip the early-return at `:105-110` and proceed into the supervisor turn even though the run is `quota_waiting` and the durable wake is in the future.

The supervisor turn then loads the incident, sees `failover_pending`, calls `attemptWorkerFailover`. On success it clears the flag (`failover_pending: false`, `failover_resolved_at: now`) and flips the run back to `running`. On `no_replacement` it clears the flag and leaves the run in `quota_waiting` — the existing durable wake at `resumeAt` will handle resumption.

This bypass needs care: don't let `failover_pending` get stuck set. The wake handler clears it whenever it attempts failover (success **or** `no_replacement`), so a stuck flag would only happen if the supervisor crashed mid-failover, in which case the next observer wake or quota durable wake re-runs the path.

The interesting case is `worker_continue` — there is an in-flight worker with non-trivial state. The spawn-time case is simpler: nothing has happened yet, just pick a different type and spawn fresh.

### 3. Spawn-retry row lifecycle

`reserveWorkerRow()` already calls `emitNamedEvent({ kind: "worker.spawned", ... })` at `src/server/supervisor/index.ts:627` **before** the bridge spawn is attempted. If the bridge spawn then fails with a quota error and failover retries with a different type, that first row is already in the database and already announced over the named-event stream. We must finalise it cleanly, both for the DB and for any SSE client.

Rules for the spawn-time quota branch (`:1042`) when failover succeeds:

1. The original reserved row gets `workers.status = "cred-exhausted"` (same status the observer path uses — keeps the type-blocked predicate accurate). **The `workers` table has no `lastError` column** (`src/server/db/schema.ts:42-61`), so the quota text lives on the recovery-incident `details.rawText` (already true today via `handleQuotaExhaustion`) and is duplicated in the `error.surfaced` event payload below. Don't add a `lastError` column for this — the incident is the durable record.
2. Emit `worker.status` (`prev: "starting", next: "cred-exhausted"`).
3. Emit `error.surfaced` with `code: "worker.spawn.failed"`, `surface: "log"`, `runId`, `workerId` = the reserved row, `cause` carrying the truncated quota text. UI treats it as a non-toast log event so the user only sees the failover summary, not the underlying failure.
4. Emit the new `worker.failover_started` event (§5) so the client knows the next `worker.spawned` belongs to a failover, not an unrelated new worker.
5. `reserveWorkerRow` is called again for the replacement type — second `worker.spawned` is emitted as normal.

This makes the event transcript: `worker.spawned (codex)` → `worker.status (codex: starting→cred-exhausted)` → `error.surfaced (worker.spawn.failed, codex)` → `worker.failover_started` → `worker.spawned (claude)` → `worker.failover_completed`. A lifecycle test can pin this sequence exactly.

For the observer path (path B in §2), the row is already at `cred-exhausted` by the time the supervisor wakes; the supervisor only needs to emit `worker.failover_started` before reserving the replacement row.

### 4. Handoff report — internal function, not a supervisor tool

The handoff is a deterministic part of recovery, not an LLM-policy decision. Exposing it as a supervisor tool invites the model to skip it, double-invoke it, or call it on a healthy worker. Instead:

- `requestWorkerHandoff(workerId, reason): Promise<HandoffReport>` lives in `src/server/handoff/request.ts` and is called directly from `attemptWorkerFailover` (§5).
- It uses the bridge `askAgent` (the same primitive the supervisor's `worker_continue` uses) to send a constrained prompt and waits for the reply.
- The supervisor prompt is updated only to *explain* failover behaviour after the fact — there is no new tool definition in `src/server/supervisor/tools.ts`.

Prompt sent to the outgoing worker:

> *"Your runtime has reported a quota exhaustion and you will be replaced by another agent. Stop work immediately. Reply with exactly one fenced block:*
> ```` ```omniharness-handoff ````
> *containing: TASK (one sentence), PROGRESS (what you have done — files touched, commits, test status), NEXT_STEPS (what should be done next), BLOCKERS, OPEN_QUESTIONS, RELEVANT_FILES. Be terse and factual. Do not start new work."*

Implementation details:

1. Hard timeout configurable via `policy.maxHandoffWaitMs` (default 60s). Quota errors often allow one more cheap turn; if not, we degrade to a synthetic handoff.
2. Parse the fenced `omniharness-handoff` block via `src/server/handoff/parser.ts`. Store the parsed report on the recovery incident `details.handoff`.
3. Emit the new `worker.handoff_emitted` named event (§5) with `source: "worker" | "synthetic"`. This is what UI and lifecycle tests assert against — not raw `executionEvents` rows.
4. Tear down the outgoing worker via the existing internal cancellation path (not the LLM `worker_cancel` tool).

A small parser lives at `src/server/handoff/parser.ts`. Schema:

```ts
type HandoffReport = {
  task: string;
  progress: string;
  nextSteps: string;
  blockers?: string;
  openQuestions?: string;
  relevantFiles?: string[];
  source: "worker" | "synthetic";
  outgoingWorkerType: WorkerType;
  outgoingWorkerId: string;
  reason: string;
};
```

When the outgoing worker can't produce one (timeout, quota also blocks the handoff turn, malformed output), build a `synthetic` handoff from: the run's prompt, the last assistant message, and the most recent N execution events for that worker.

### 5. Replacement spawn + named events

A new module `src/server/supervisor/worker-failover.ts` exposes:

```ts
attemptWorkerFailover({
  runId, outgoingWorker, quotaInfo, allowedTypes, env
}): Promise<
  | { state: "failed_over"; newWorkerId: string; newType: WorkerType; handoff: HandoffReport }
  | { state: "no_replacement"; reason: string }
>
```

**Split `handleWorkerQuotaExhaustion` into two halves so failover can record the block without parking the run.** Today the function does two things atomically: (a) marks the outgoing worker `cred-exhausted` and opens a `quota_exhausted` recovery incident, and (b) transitions the run to `quota_waiting` and schedules a durable wake. Failover-success only wants (a); failover with `no_replacement` wants both.

Refactor `src/server/quota/recovery.ts`:

- `recordWorkerQuotaBlock({ runId, workerId, text, provider, now }): { incidentId, quota }` — does (a) only. Marks `workers.status = "cred-exhausted"`, opens the recovery incident with `details.failover_pending: true`, emits the existing `quota_wait_unschedulable` / `quota_wait_scheduled` event. Does **not** touch `runs.status`.
- `parkRunForQuotaWait({ runId, incidentId, quota, now }): QuotaRecoveryResult` — does (b) only. Transitions the run to `quota_waiting` or `needs_recovery`, schedules the durable wake, clears `failover_pending` on the incident (we're done deferring to failover).
- `handleWorkerQuotaExhaustion` becomes a thin wrapper: `recordWorkerQuotaBlock` → `parkRunForQuotaWait`. All existing call sites keep working unchanged.

Then `attemptWorkerFailover` flow:

1. Caller (spawn site, continue site, or supervisor wake handler driven by observer-set `failover_pending`) has either already called `recordWorkerQuotaBlock` (observer path) or has not yet recorded anything (spawn/continue paths — they catch the error themselves). On entry, `attemptWorkerFailover` calls `recordWorkerQuotaBlock` if the incident does not yet exist for this attempt. Idempotent.
2. Build the blocked-type set via `quotaBlockedTypes(allowedTypes)`. Call `selectSpawnableWorkerTypeAsync(outgoingWorker.type, env, allowedTypes)`. If it returns the **same** type or throws, return `no_replacement`.
3. **Emit `worker.failover_started`** with `{ runId, outgoingWorkerId, outgoingType, reason }`.
4. `requestWorkerHandoff()` (synchronous, with timeout) — falls back to synthetic handoff if the worker can't reply.
5. **Emit `worker.handoff_emitted`** with `{ runId, outgoingWorkerId, source: "worker" | "synthetic" }`.
6. Tear down the outgoing worker (internal cancellation).
7. `reserveWorkerRow` + bridge spawn for the replacement, seeded with the rendered handoff + original run prompt.
8. On success: clear `failover_pending` on the incident (mark `failover_resolved_at: now`); ensure `runs.status` stays `running` (it was never parked). **Emit `worker.failover_completed`** with `{ runId, outgoingWorkerId, newWorkerId, newType }`.
9. On `no_replacement` or any failure in steps 4–7: call `parkRunForQuotaWait` (now this is the only path that parks the run); on failure also **emit `worker.failover_failed`** with `{ runId, outgoingWorkerId, stage, reason }`.

All five events are typed variants added to `WorkerEvent` in `src/server/events/named-events.ts:36-41`. Spec:

```ts
export type WorkerEvent =
  // ...existing variants
  | { kind: "worker.failover_started"; runId: string; outgoingWorkerId: string; outgoingType: string; reason: string }
  | { kind: "worker.handoff_emitted"; runId: string; outgoingWorkerId: string; source: "worker" | "synthetic" }
  | { kind: "worker.failover_completed"; runId: string; outgoingWorkerId: string; newWorkerId: string; newType: string }
  | { kind: "worker.failover_failed"; runId: string; outgoingWorkerId: string; stage: "handoff" | "spawn" | "selection"; reason: string };
```

We also add a new `SurfacedErrorCode = "worker.failover.failed"` for the `error.surfaced` event when failover gives up and the run parks — so UI banners can distinguish a pure quota wait from a failed failover.

The supervisor's quota-handling blocks at `index.ts:1042` and `:1116` call `attemptWorkerFailover` first. The observer-path supervisor wake handler (§2 path B) reads `failover_pending` and calls `attemptWorkerFailover` before honouring `quota_waiting`. Run parking is now centralised inside `attemptWorkerFailover` via `parkRunForQuotaWait` and only happens on the failure paths (steps 8/9 above). Existing direct callers of `handleWorkerQuotaExhaustion` (e.g., supervisor-model path at `:924`) are unchanged — that thin wrapper still does record-then-park.

### 6. Resumption when quota resets

The existing `scheduleDurableSupervisorWakeAt` flow is unchanged. The clearing lifecycle now has two complementary parts:

- For runs that **parked** (no failover available), the existing `wake.ts:118-132` path runs `resumeQuotaExhaustedWorkers`, which already clears `cred-exhausted` and closes the incident — unchanged.
- For runs that **failed over** (`runs.status` stayed `running`), we add a new `clearResolvedQuotaIncidents(runId)` call inside the durable-wake handler that fires regardless of `runs.status` when the wake reason is `quota_wait`. It closes any open `quota_exhausted` incident whose `details.resumeAt` has passed and flips lingering `cred-exhausted` worker rows for this run to `stopped`.

Additionally, `quotaBlockedTypes` ignores incidents whose `details.resumeAt` is in the past, so even if the wake handler hasn't run yet, the type becomes eligible immediately on reset. (For the in-flight run we don't switch *back* to the original worker — that's churn for no value; the replacement worker keeps going.)

### 7. UI surface

Minimum viable surface (deeper UI lives in the cli-quota-tracking plan):
- New event renderers in `src/lib/agent-output.ts` for the four `worker.failover_*` and `worker.handoff_emitted` named events so they appear inline in the conversation feed.
- Localized strings for "Codex hit its quota — handed off to Claude Code" style messages. Add keys under `settings.agents.failover.*` and `events.failover.*` to **all** locale files (`shared/locales/*.json`).
- Optional: a small chip on `ConversationMain.tsx` saying "Switched workers: Codex → Claude" with the reason, driven by the last `worker.failover_completed` event.

### 8. Telemetry & tests

Three layers, in priority order:

**Lifecycle tests (`pnpm test:lifecycle`)** — primary surface. The architecture doc requires server decisions to be assertable through the named-event stream + SSE replay. Add scenarios under `tests/lifecycle/worker-failover/`:
- `failover-on-continue.transcript.json` — sequence: `worker.spawned (codex)` → `worker.status (working)` → simulated continue-time quota error → `worker.failover_started` → `worker.handoff_emitted (worker)` → `worker.spawned (claude)` → `worker.failover_completed`. Asserts the SSE replay produces the same transcript when reconnecting with `Last-Event-ID` mid-stream.
- `failover-on-spawn.transcript.json` — spawn-site failover with reserved-row cleanup events (§3).
- `failover-from-observer.transcript.json` — observer detects live quota, supervisor wake picks up failover (path B in §2).
- `no-replacement-parks.transcript.json` — single allowed type, asserts `quota_waiting` and no `worker.failover_*` events.
- `failover-failed.transcript.json` — replacement spawn fails, asserts `worker.failover_failed` then run parks.

**Integration tests (`tests/supervisor/`)** — drive the supervisor with a mocked bridge:
- `worker-failover.test.ts` — happy path, asserts handoff prompt content sent to outgoing worker and seed prompt received by new worker.
- `worker-failover-no-replacement.test.ts` — single allowed type, existing `quota_waiting` path preserved.
- `worker-failover-handoff-fails.test.ts` — outgoing worker times out → synthetic handoff used, replacement still spawns.
- `worker-failover-spawn-retry.test.ts` — second type also hits quota on spawn → walks to third, bounded by `allowedTypes.length`.

**Unit tests:**
- `tests/server/quota/type-blocking.test.ts` — extracted predicate, both `cred-exhausted` and active-incident branches.
- `tests/server/handoff/parser.test.ts` — happy, malformed, partial fields, synthetic fallback.
- `tests/server/supervisor/worker-availability.test.ts` — `selectSpawnableWorkerType` honours `quotaBlocked` set.

## Edge cases (called out explicitly because the user asked us to think them through)

1. **All allowed workers are blocked.** `attemptWorkerFailover` returns `no_replacement` and calls `parkRunForQuotaWait`. The durable wake is scheduled at the earliest `resumeAt` across active `quota_exhausted` incidents for this run.
2. **Replacement worker also hits quota immediately on spawn.** Treated as a fresh quota event on the new worker — the supervisor's spawn-site handler will try the *next* type in the list. Bounded by the number of allowed types; cap retries at `allowedTypes.length` per turn to avoid loops.
3. **User has only one allowed worker type.** `selectSpawnableWorkerType` returns the same type → `no_replacement` → existing wait-and-resume path.
4. **Handoff turn itself fails with quota.** Detected via the timeout / second quota-error catch. Build a synthetic handoff and proceed.
5. **Outgoing worker is unresponsive (lost_worker).** Skip the handoff request; build synthetic immediately. Don't block failover on a dead worker.
6. **Quota error is a false positive (e.g., transient 429).** Blocks expire at the incident's parsed `resumeAt`; if `resetAt` is unparseable, `normalizeQuotaResumeAt` already applies the policy's grace/minimum window so we don't churn. No new policy field is needed.
7. **Two runs hit the same worker's quota seconds apart.** The predicate reads from the shared DB tables; the second run's failover sees the existing open incident or `cred-exhausted` worker row from the first run's quota event and skips that type without needing any cross-run coordination.
8. **Replacement worker has a different model with different capabilities.** Out of scope to translate prompts. The handoff is plain markdown, which any worker can consume. Document this in the supervisor prompt: handoffs are advisory, not literal commands.
9. **User reorders priority list mid-run.** `runs.allowedWorkerTypes` is captured at run start (already true today). Reordering applies to new runs only. Document this; do not change it in this pass.
10. **Worker was spawned with a credential profile.** Currently each worker type can have a per-profile credential. The replacement uses the same profile-selection logic as a fresh spawn (no special handling needed — the credentials layer is keyed by type).

## File map

Create:
- `src/server/quota/type-blocking.ts` — extracted from `review-agent-selection.ts`; adds `quotaBlockedTypes(allowedTypes)`.
- `src/server/supervisor/worker-failover.ts` — `attemptWorkerFailover`.
- `src/server/handoff/request.ts` — `requestWorkerHandoff` (internal, not a supervisor tool).
- `src/server/handoff/parser.ts`
- `src/server/handoff/render.ts`
- `tests/server/quota/type-blocking.test.ts`
- `tests/server/handoff/parser.test.ts`
- `tests/supervisor/worker-failover.test.ts`
- `tests/supervisor/worker-failover-no-replacement.test.ts`
- `tests/supervisor/worker-failover-handoff-fails.test.ts`
- `tests/supervisor/worker-failover-spawn-retry.test.ts`
- `tests/lifecycle/worker-failover/*.transcript.json` (five scenarios from §8).

Modify:
- `src/server/events/named-events.ts` — add `worker.failover_started`, `worker.handoff_emitted`, `worker.failover_completed`, `worker.failover_failed` to `WorkerEvent`; add `worker.failover.failed` to `SurfacedErrorCode`.
- `src/server/supervisor/worker-availability.ts` — accept `quotaBlocked?: Set<WorkerType>` on `isSpawnableWorkerType` and `selectSpawnableWorkerType`; add async wrapper `selectSpawnableWorkerTypeAsync`.
- `src/server/planning/review-agent-selection.ts` — re-import `isWorkerTypeQuotaBlocked` from the new shared module; no behavioural change.
- `src/server/supervisor/index.ts` — invoke `attemptWorkerFailover` from the worker-spawn (`:1042`) and worker-continue (`:1116`) quota branches before falling through to `handleWorkerQuotaExhaustion`. Emit `worker.status` + `error.surfaced (worker.spawn.failed)` for reserved rows that failed spawn (§3).
- `src/server/supervisor/observer.ts:955-969` — after `handleWorkerQuotaExhaustion` returns, set `failover_pending: true` on the incident details and call `wakeSupervisor(runId, 0)` **unconditionally** when the run has ≥2 allowed worker types (today the wake only fires for `needs_recovery`).
- `src/server/supervisor/wake.ts:105-110` — bypass the `quota_waiting` + future-durable-wake early-return when the run's most recent open `quota_exhausted` incident has `details.failover_pending: true`.
- `src/server/supervisor/wake.ts:118-132` — add a `clearResolvedQuotaIncidents(runId)` call on `quota_wait` wake reason, executed regardless of `runs.status` so failover-success runs also have their stale incidents/worker rows cleared.
- `src/server/quota/recovery.ts` — split `handleWorkerQuotaExhaustion` into `recordWorkerQuotaBlock` + `parkRunForQuotaWait`. Wrapper preserves the existing public signature.
- `src/server/prompts/supervisor.md` — short paragraph explaining that failover is automatic and the supervisor may receive a new worker mid-task with a handoff seed.
- `src/server/runs/recovery-policy.ts` — add `maxHandoffWaitMs` (default `60_000`).
- `src/lib/agent-output.ts` — render the new named events.
- `shared/locales/*.json` — strings for the new events / chip.
- `tests/supervisor/index.test.ts` — update existing quota-path tests that assert `quota_waiting` to configure a single allowed worker (keeping the assertion valid) or to accept the new failover path.

## Phases

### Phase 1 — Quota-aware availability (shared persisted signal)
- [x] **Step 1:** Extract `isWorkerTypeQuotaBlocked` into `src/server/quota/type-blocking.ts`; add `quotaBlockedTypes(allowedTypes)` returning a Map keyed by type with `{ reason, resumeAt }`. Both functions ignore incidents whose `details.resumeAt` is in the past.
- [x] **Step 2:** Update `src/server/planning/review-agent-selection.ts` to import from the new module — no behaviour change, test suite stays green.
- [x] **Step 3:** Add `quotaBlocked?: Set<WorkerType>` option to `isSpawnableWorkerType` and `selectSpawnableWorkerType`; add `selectSpawnableWorkerTypeAsync` thin wrapper. Default behaviour unchanged when option omitted.
- [x] **Step 4:** Unit tests for `type-blocking` (both signal branches, expired-resumeAt filter) and for `selectSpawnableWorkerType` skipping blocked types.

### Phase 2 — Named events
- [x] **Step 1:** Add the four `worker.failover_*` and `worker.handoff_emitted` variants to `WorkerEvent` in `src/server/events/named-events.ts`. Add `worker.failover.failed` to `SurfacedErrorCode`.
- [x] **Step 2:** Update event-stream tests in `tests/server/events/` to assert the new variants serialize/replay correctly.

### Phase 3 — Handoff protocol (internal)
- [x] **Step 1:** Build `src/server/handoff/parser.ts` and `render.ts`. Parser tolerates missing optional fields.
- [x] **Step 2:** Build `src/server/handoff/request.ts:requestWorkerHandoff(workerId, reason)` — uses bridge `askAgent`, hard timeout from `policy.maxHandoffWaitMs`, returns parsed report or throws.
- [x] **Step 3:** Synthetic-handoff builder: from run prompt + last assistant message + last N events for that worker. Used when `requestWorkerHandoff` throws or times out.
- [x] **Step 4:** Unit tests for parser (happy, malformed, partial) and synthetic builder.
- [x] **Step 5:** Note explicitly that no new supervisor tool is added — `src/server/supervisor/tools.ts` is unchanged.

### Phase 4 — Failover orchestration
- [x] **Step 1:** Refactor `src/server/quota/recovery.ts`: split `handleWorkerQuotaExhaustion` into `recordWorkerQuotaBlock` + `parkRunForQuotaWait`; wrapper preserves the existing signature for the supervisor-model and worker-continue call sites that still want park-on-quota by default.
- [x] **Step 2:** Implement `src/server/supervisor/worker-failover.ts:attemptWorkerFailover` per §5 flow, emitting the four named events. Run parking lives only on the `no_replacement` / failure paths inside this function.
- [x] **Step 3:** Hook into worker-spawn branch at `src/server/supervisor/index.ts:1042`. Implement reserved-row finalisation per §3 (set `cred-exhausted`, emit `worker.status` + `error.surfaced (worker.spawn.failed)` — no `lastError` column write).
- [x] **Step 4:** Hook into worker-continue branch at `src/server/supervisor/index.ts:1116`.
- [x] **Step 5:** Observer path:
  - In `src/server/supervisor/observer.ts:955-969`, after `handleWorkerQuotaExhaustion`, set `failover_pending: true` on the incident and call `wakeSupervisor(runId, 0)` unconditionally when `allowedWorkerTypes.length >= 2` (today the wake only fires for `needs_recovery`).
  - In `src/server/supervisor/wake.ts:105-110`, bypass the `quota_waiting` + future-durable-wake early-return when the run's most recent open `quota_exhausted` incident has `details.failover_pending: true`.
  - In the supervisor turn, detect `failover_pending`, run `attemptWorkerFailover`, then clear the flag (success **or** `no_replacement`).
- [x] **Step 6:** Stale-incident clearing: add `clearResolvedQuotaIncidents(runId)` and call it from the `quota_wait` durable-wake branch in `wake.ts:118` regardless of `runs.status`, so failover-success runs don't accumulate stale `cred-exhausted` rows or open incidents.
- [x] **Step 7:** Bound retries by `allowedTypes.length` per supervisor turn.
- [x] **Step 8:** Update `src/server/prompts/supervisor.md` with a short failover paragraph (post-hoc explanation only; no new tool).

### Phase 5 — UI and i18n
- [x] **Step 1:** Add renderers in `src/lib/agent-output.ts` for the new named events. (Implemented in `src/app/home/utils.ts:summarizeExecutionEvent` — the timeline pipeline that consumes ExecutionEvents in the UI; `agent-output.ts` parses ACP streams and is not the right surface for failover-lifecycle text.)
- [x] **Step 2:** Add i18n keys to all `shared/locales/*.json` files.
- [x] **Step 3:** Add a small "Switched workers" chip on `ConversationMain.tsx` when the most recent event is `worker.failover_completed`.

### Phase 6 — Tests
- [x] **Step 1:** Lifecycle scenarios under `tests/lifecycle/scenarios/worker-failover/` covering ordered transcript, Last-Event-ID replay, and the failover_failed + error.surfaced pair. (Consolidated into a single transcript file; the supervisor-level cases for continue-time / spawn-time / observer-driven / no-replacement / replacement-spawn-fails live in the integration tests below.)
- [x] **Step 2:** Integration tests in `tests/supervisor/` driving `attemptWorkerFailover` directly with a mocked bridge — `worker-failover.test.ts` (happy + walks list), `worker-failover-no-replacement.test.ts`, `worker-failover-handoff-fails.test.ts`, `worker-failover-spawn-retry.test.ts`.
- [x] **Step 3:** Existing quota-path tests in `tests/supervisor/index.test.ts` continue to pass — they all configure a single allowed worker type, which routes through the existing `handleWorkerQuotaExhaustion` wrapper unchanged.

## Open questions to resolve during implementation

1. **Reserved-row finalisation status.** Plan reuses `cred-exhausted` for the failed-spawn row. If the observer's `cred-exhausted` interpretation elsewhere assumes the worker actually started, we may need a distinct `spawn_failed` status. Verify during Phase 4 Step 2 by reading every site that branches on `cred-exhausted`.
2. **Should failover be opt-out?** Initial plan: always on when ≥2 allowed types. Add `WORKER_FAILOVER_ENABLED` setting in Phase 5 if we get pushback.
3. **Observer-path latency under load.** Path B in §2 adds one supervisor tick. If real-world measurements show this is too slow (e.g., user-visible "stuck" state), revisit path A in a follow-up — but only with a clear measurement justifying the duplication.
4. **Does the handoff prompt count against the outgoing worker's quota?** Empirically often yes (one cheap final turn is usually allowed), but the timeout + synthetic fallback makes this non-blocking. We don't try to be clever here.

## What this plan deliberately does *not* do

- No predictive migration ("worker is at 90% — preemptively move"). That needs `worker_token_usage` persistence from `2026-05-15-cli-quota-tracking.md`. Revisit once that lands.
- No multi-run load balancing.
- No automatic switch-back when the original worker's quota resets mid-run.
- No new schema tables. Block state lives in existing `workers.status` and `recoveryIncidents` rows; durable per-CLI quota state is the other plan's job.

## Acceptance criteria

- With ≥2 allowed worker types and the current worker hitting quota mid-turn (continue-site, spawn-site, or observer-site): the conversation continues on the next worker in the priority list within one supervisor tick. The user sees the swap via the named-event stream. No manual intervention.
- With exactly 1 allowed worker type hitting quota: behaviour is identical to today (`quota_waiting`, scheduled wake, auto-resume). No `worker.failover_*` events emitted.
- The lifecycle transcript for each scenario in §8 is stable across runs and survives SSE reconnect with `Last-Event-ID`.
- The persisted type-blocked predicate is the single source of truth used by both planning-review reviewer selection and failover, with no parallel in-memory cooldown.
- No new schema tables; `2026-05-15-cli-quota-tracking.md` retains ownership of durable quota persistence.
- All existing tests pass; `pnpm test:lifecycle` covers the failover transcripts.
