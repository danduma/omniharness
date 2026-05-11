# Quota Reset Auto Resume Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically pause active OmniHarness supervision when a coding-agent or supervisor-model quota is exhausted, parse the provider reset time, and resume the run at the reset time plus a small grace delay without leaving the conversation stuck in `failed`.

**Architecture:** Extend the existing recovery system instead of creating a parallel failure path. Add a quota parser and durable wake scheduler, record quota waits as recovery incidents/events, keep runs in an active `quota_waiting` state, and rehydrate scheduled resumes through the runtime watchdog after app restart or machine sleep.

**Tech Stack:** TypeScript, Next.js App Router APIs, Drizzle SQLite, existing `recovery_incidents`, existing supervisor wake leases, existing runtime watchdog, existing settings persistence, React Manager-owned state, `shared/locales/*.json`, pnpm/vitest.

**North Star Product:** OmniHarness should treat external subscription limits as normal operational backpressure: it reads the provider's reset signal, explains the wait, preserves user intent and queued messages, and quietly resumes when the account is usable again.

**Current Milestone:** Ship end-to-end quota-wait recovery for supervisor model requests and worker/runtime quota failures, including reset-time parsing, durable scheduled wakes, incident visibility, manual override, restart-safe rehydration, and deterministic tests. Account swapping and provider-specific credential rotation are supported only where existing settings already make them real.

**Future Product Direction:** Provider-specific quota adapters can later add richer account identity, multiple subscription pools, measured remaining quota, and proactive scheduling before hard failure. That direction is context only; this milestone is complete when reactive quota reset auto-resume works reliably.

**Final Functionality Standard:** A real run that receives a quota error such as `429`, `quota exceeded until 2026-05-10T18:00:00+08:00`, `try again in 5 hours`, or a `Retry-After` value must persist a quota incident, set a durable resume alarm for `resetAt + 1s`, stay recoverable rather than failed, survive process restart, avoid duplicate resumes, preserve queued user messages, and continue automatically at the scheduled time. Generic 5-second retry loops, UI-only timers, fake recovered statuses, or failed runs requiring a manual retry do not count.

---

## Current Reality

- The worker monitor recognizes quota-like text only as `cred-exhausted` via simple substring checks in `src/server/workers/monitor.ts`.
- Supervisor model quota detection exists in `src/server/supervisor/index.ts`, but only `fallback_api` is implemented as real behavior.
- `wait_for_reset` exists as a credit strategy name in `src/server/credits/index.ts`, but it does not compute or schedule a reset.
- `src/server/supervisor/wake.ts` can schedule in-memory timers, but those timers are not persisted and are lost across restart.
- The recoverable run state machine exists and already prevents several stale failed states through `recovery_incidents`, `needs_recovery`, `recovering`, retry budgets, and wake leases.
- `syncRunningSupervision()` currently restarts only `running` and recoverable transient `failed` implementation runs, so quota wait rows need explicit watchdog rehydration.

## Product Commitments

### User Stories

As a builder, I want OmniHarness to wait until my coding-agent subscription resets, so a five-hour quota window does not force me to babysit the run.

As a builder, I want OmniHarness to show the exact reset time it inferred, so I can trust why work paused and when it will resume.

As a builder, I want follow-up messages sent during a quota wait to stay queued, so my intent is not lost while the worker is unavailable.

As a builder, I want app restarts and laptop sleep to be safe, so a scheduled quota resume still fires when the app wakes back up.

As a builder, I want manual resume to be possible, so I can retry early after switching accounts or upgrading quota.

As a service operator, I want quota waits logged as structured incidents and execution events, so I can diagnose provider messages, parse failures, and repeated quota loops.

## State Model

### Run Statuses

Add `quota_waiting` as an active, non-terminal run status.

- It must remain compatible with `isActiveImplementationRun()` because it is not terminal.
- It must not be picked up by watchdog as an immediate normal `running` wake.
- It must be visible through events and recovery state as a deliberate wait, not a failure.
- A due quota wake transitions the run back to `running` before executing supervisor logic.
- Manual cancellation, archiving, completion, or failure clears any scheduled quota wake.

### Worker Statuses

Use the existing `cred-exhausted` worker status for worker-level quota exhaustion.

- Preserve the worker's `bridgeSessionId` and `bridgeSessionMode` when available.
- Do not clear saved sessions on quota waits.
- Do not mark the worker `error` unless quota resume attempts exhaust policy or the provider message cannot be interpreted and no manual path exists.

### Recovery State

Extend recovery state with:

- `quota_waiting`
- recommended action `wait_for_quota_reset`
- optional `resumeAt`
- optional `quotaResetSource`
- optional `quotaResetConfidence`

Extend recovery incident kind with:

- `quota_exhausted`

Use `recovery_incidents.details` for structured fields first, and add first-class schema columns only where queryability or scheduling requires them. The scheduled wake itself needs queryable columns in a dedicated table.

## Quota Reset Detection

Create one parser that is used by supervisor model errors, bridge worker errors, stderr tails, stop reasons, and HTTP-ish errors.

The parser returns:

```ts
type QuotaResetInfo = {
  isQuotaError: boolean;
  resetAt: Date | null;
  retryAfterMs: number | null;
  source: "retry-after-header" | "absolute-timestamp" | "relative-duration" | "time-of-day" | "reset-schedule" | "quota-without-reset";
  confidence: "high" | "medium" | "low";
  rawText: string;
  provider?: string | null;
};
```

Parsing rules:

- Prefer explicit `Retry-After` header values when present.
- Support `Retry-After` seconds and HTTP-date formats.
- Support ISO timestamps with offsets.
- Support common absolute phrases such as `until 2026-05-10 18:00`, `resets at 2026-05-10T18:00:00+08:00`, and `try again after May 10, 2026 6:00 PM GMT+8`.
- Support relative phrases such as `in 5 hours`, `after 4h 12m`, `try again in 30 minutes`, and `reset in 1 hour`.
- Support time-only phrases such as `until 5:00 PM` by resolving in the configured local timezone and rolling to the next day when the time has already passed.
- Treat quota text without a reset time as a quota error but not as schedulable.
- Apply `quotaResetGraceMs`, defaulting to 1000ms, after the parsed reset.
- Clamp absurd waits with policy: default max schedulable quota wait is 24 hours. Longer waits become `needs_recovery` unless explicitly allowed in settings.
- Reject parsed dates that are `Invalid Date`, wildly old, or caused by a low-confidence match inside unrelated output.

## Durable Scheduler Design

Create a persistent wake schedule table:

```sql
CREATE TABLE IF NOT EXISTS supervisor_scheduled_wakes (
  run_id text PRIMARY KEY NOT NULL,
  wake_at integer NOT NULL,
  reason text NOT NULL,
  source text,
  incident_id text,
  details text,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  FOREIGN KEY (run_id) REFERENCES runs(id),
  FOREIGN KEY (incident_id) REFERENCES recovery_incidents(id)
);
```

Create index:

```sql
CREATE INDEX IF NOT EXISTS supervisor_scheduled_wakes_wake_at_idx
ON supervisor_scheduled_wakes(wake_at);
```

Scheduler behavior:

- `scheduleSupervisorWake(runId, delayMs)` remains available for ordinary short in-memory supervision heartbeats.
- Add `scheduleDurableSupervisorWakeAt({ runId, wakeAt, reason, source, incidentId, details })`.
- Add `cancelDurableSupervisorWake(runId, reason?)`.
- Add `rehydrateDurableSupervisorWakes()` for startup/watchdog.
- The durable scheduler also installs an in-memory timer when the process is alive.
- For very long delays, clamp the current `setTimeout` chunk to a safe maximum and re-arm until due.
- If an existing durable wake is earlier than a new one, keep the earlier wake unless the new schedule is a forced replacement from the same quota incident.
- If an existing normal in-memory wake is sooner than a quota wait while the run is `quota_waiting`, suppress the normal wake so the supervisor does not hammer the provider every 5 seconds.
- When a scheduled wake fires, delete the durable row only after a wake lease is acquired or mark it due for retry if lease acquisition is blocked.

## Race Conditions And Edge Cases

- **Two errors schedule the same run at once:** use the existing supervisor wake lease and upsert the scheduled wake atomically by `run_id`; keep the earliest safe resume unless a force path intentionally overrides it.
- **App restarts during the wait:** `ensureSupervisorRuntimeStarted()` calls rehydration; due rows execute immediately, future rows re-arm timers.
- **Machine sleeps past the reset time:** watchdog treats overdue rows as due and executes once.
- **Manual resume before reset:** clear the durable wake, mark the incident `recovering`, and attempt now. If the provider still returns quota, reopen/update the same incident and schedule the new parsed reset.
- **Run is archived, cancelled, completed, or promoted before reset:** cancel the durable wake and do not restart observers.
- **Queued messages arrive while waiting:** leave them queued; do not attempt delivery until the quota wake or manual override. The UI should show the queue as waiting on quota, not failed.
- **Multiple workers hit quota:** open per-worker incidents, but schedule the run for the earliest reset. On wake, the supervisor may detect another still-blocked worker and schedule again.
- **Supervisor model quota and worker quota happen together:** record source-specific details, but preserve one run-level durable wake at the earliest usable reset. Do not let model quota fallback clear a worker quota incident.
- **Fallback API is configured:** try fallback first when `CREDIT_STRATEGY=fallback_api`; schedule a wait only if fallback is unavailable or also exhausted. For `wait_for_reset`, schedule immediately from the parsed reset.
- **Reset time parses into the past:** if the parsed absolute time is within a small clock-skew window, resume immediately plus grace. If a time-only value is in the past, roll to the next day. If an absolute date is far in the past, mark parse low-confidence and require user action.
- **Provider changes message format:** quota text without a parseable reset becomes `needs_recovery` with the raw message and no retry loop.
- **DST/timezone ambiguity:** explicit offsets win. Time-only values use the app/server timezone and include that assumption in incident details.
- **Repeated quota at scheduled wake:** increment incident attempt count, parse the new reset, and reschedule. Do not exhaust normal recovery retry budget just because quota continues to report a later reset.
- **Provider returns 429 for non-quota transient overload:** classify as transient only if no quota language or reset signal exists. Do not create quota incidents for generic overload text.
- **System clock changes:** always compare persisted `wake_at` to current `Date.now()` at rehydration and wake execution. Log `scheduledAt`, `actualWakeAt`, and drift.

## File Map

### Files To Create

- `src/server/quota/reset-parser.ts`
  - Pure parser for quota/reset messages, HTTP-ish headers, error chains, stderr text, and relative durations.
  - Exports `extractQuotaResetInfo()`, `parseQuotaResetText()`, and `normalizeQuotaResumeAt()`.

- `src/server/quota/recovery.ts`
  - Owns `handleSupervisorQuotaExhaustion()` and `handleWorkerQuotaExhaustion()`.
  - Opens or updates `quota_exhausted` recovery incidents.
  - Updates run/worker status, preserves queued messages, and calls durable wake scheduling.

- `src/server/supervisor/wake-schedule.ts`
  - Owns durable schedule persistence, rehydration, cancellation, due-row execution, and timer chunking.
  - Keeps `wake.ts` small and avoids pushing it into scheduler/database mixed concerns.

- `tests/server/quota/reset-parser.test.ts`
  - Covers `Retry-After`, ISO timestamps, date/time strings, relative durations, time-only rollover, no-reset quota text, non-quota 429s, past dates, and max-wait clamping.

- `tests/server/quota/recovery.test.ts`
  - Database-backed quota incident tests for supervisor quota, worker quota, no parseable reset, manual override, repeated quota after wake, and queued-message preservation.

- `tests/supervisor/wake-schedule.test.ts`
  - Durable scheduler tests for upsert, earlier/later deadlines, restart rehydration, due rows, lease blocked retry, cancellation, and long-delay timer chunking.

### Files To Modify

- `src/server/db/schema.ts`
  - Add `supervisorScheduledWakes`.
  - Keep existing table names and recovery schema compatible.

- `src/server/db/index.ts`
  - Create `supervisor_scheduled_wakes`.
  - Create the `wake_at` index.
  - Add safe bootstrap logic for existing databases.

- `src/server/runs/recovery-state.ts`
  - Add `quota_waiting` recovery state and `wait_for_quota_reset` recommended action.
  - Include `resumeAt` metadata in the state type.
  - Treat `quota_waiting` as active but intentionally paused.

- `src/server/runs/recovery-incidents.ts`
  - Extend `RecoveryIncidentKind` with `quota_exhausted`.
  - Preserve existing open-incident dedupe behavior by run, worker, queued message, and kind.

- `src/server/runs/recovery-policy.ts`
  - Add quota policy fields:
    - `autoResumeAfterQuotaReset: boolean`
    - `quotaResetGraceMs: number`
    - `maxQuotaWaitMs: number`
    - `allowQuotaWaitWithoutParsedReset: boolean` default `false`
  - Normalize legacy settings so existing `RECOVERY_POLICY` values remain valid.
  - Keep normal recovery attempt budgets separate from quota wait reschedules.

- `src/server/supervisor/wake.ts`
  - Delegate durable wake work to `wake-schedule.ts`.
  - Handle supervisor results that include `quota_wait` or due durable wakes.
  - Avoid scheduling short transient retry loops while the run is `quota_waiting`.

- `src/server/supervisor/runtime-watchdog.ts`
  - Rehydrate durable supervisor wakes on startup.
  - Include `quota_waiting` in the active implementation run scan without immediately forcing a normal wake.
  - Clear stale quota waits for terminal runs.

- `src/server/supervisor/start.ts`
  - Start observers only when appropriate for current run status.
  - For `quota_waiting`, rely on durable wake rehydration instead of immediate wake.

- `src/server/supervisor/index.ts`
  - In supervisor model request errors, parse quota reset info before falling into generic transient handling.
  - For `fallback_api`, try fallback first and schedule quota wait only when fallback cannot continue.
  - For `wait_for_reset`, persist `quota_waiting` and return a quota wait result with `resumeAt`.
  - Do not call `persistRunFailure()` for schedulable quota exhaustion.

- `src/server/supervisor/retry.ts`
  - Stop treating all `rate limit` / `too many requests` messages as identical.
  - Expose enough error-chain/header detail for the quota parser while preserving transient retry behavior for non-quota overload.

- `src/server/supervisor/observer.ts`
  - Inspect `snapshot.stderrBuffer`, `snapshot.stopReason`, `currentText`, and `lastText` for quota reset info before fatal/failure handling.
  - Mark worker `cred-exhausted`, open a quota incident, stop or quiet polling for that worker, and schedule durable resume.
  - Wake the supervisor immediately only when quota handling fails into `needs_recovery`.

- `src/server/workers/monitor.ts`
  - Replace substring-only quota classification with the shared parser while keeping the existing `cred-exhausted` return value.

- `src/server/credits/index.ts`
  - Make `wait_for_reset` mean a real wait path when reset data exists.
  - Stop recording `switched` for `wait_for_reset`; record a `wait` credit event with `resumeAt` details.
  - Preserve current `swap_account`, `fallback_api`, and `cross_provider` behavior where it is real.

- `src/app/api/events/route.ts`
  - Include quota wait metadata in compact recovery state and incident payloads.
  - Keep payload bounded; include raw provider text only truncated in incident details.

- `src/app/api/runs/[id]/resume/route.ts`
  - Manual resume clears durable quota waits and forces a wake.
  - Return whether the run resumed, rescheduled because quota still applies, or moved to `needs_recovery`.

- `src/app/home/types.ts`
  - Add quota wait fields to `RunRecoveryState` and `RecoveryIncidentRecord`.

- `src/app/home/recovery-utils.ts`
  - Add quota-specific tone/title/description helpers, but render strings through i18n keys at component boundaries.
  - Do not add new hardcoded user-facing copy here unless the implementation first refactors these helpers to return translation keys.

- `src/components/home/RunRecoveryNotice.tsx`
  - Show reset time, source/confidence, manual resume action, and queued-message wait state.
  - All labels, aria labels, titles, status text, and fallback text must use `t()` and keys in every `shared/locales/*.json`.

- `src/components/home/RecoveryIncidentInspector.tsx`
  - Show quota incident details: parsed reset, raw/truncated provider message, source, confidence, scheduled wake, actual wake drift, attempt count, and last outcome.
  - Use translated strings only.

- `shared/locales/en.json` and every other `shared/locales/*.json`
  - Add quota recovery strings for notices, incident rows, buttons, status labels, and parse-source labels in the same change.

- `tests/supervisor/wake.test.ts`
  - Extend current transient and lease tests with quota wait behavior.

- `tests/supervisor/index.test.ts`
  - Add supervisor-model quota scenarios for `fallback_api`, `wait_for_reset`, no parseable reset, and repeated quota at scheduled wake.

- `tests/supervisor/observer.test.ts`
  - Add worker quota scenarios from stderr, stop reason, current text, missing reset, and repeated quota.

- `tests/workers/monitor.test.ts`
  - Update quota classification tests to use shared parser cases.

- `tests/api/events-route.test.ts`
  - Assert quota wait state and incident details are exposed without unbounded raw text.

- `tests/api/run-route.test.ts` or `tests/api/answer-route.test.ts`
  - Assert manual resume clears durable quota wait and does not lose queued messages.

- `tests/ui/conversation-actions.test.ts` and/or `tests/ui/sidebar-layout.test.ts`
  - Assert quota wait copy is translated, manual resume appears, and hardcoded strings are not introduced.

### Candidate Agentic User Journey Tests

Running these requires explicit user approval after deterministic tests pass.

- **Mission:** Simulate a worker quota message with a reset five minutes in the future and verify the UI enters quota wait.
  - **Entry point:** Local app on an implementation run with a controlled bridge test fixture that emits a real snapshot-shaped quota event.
  - **Expected proof:** Recovery notice shows a reset time, queued messages remain queued, run status is not `failed`, and execution events show `quota_wait_scheduled`.

- **Mission:** Restart the app while a quota wait is pending and verify resume still fires.
  - **Entry point:** Local app plus persisted `supervisor_scheduled_wakes` row.
  - **Expected proof:** Runtime watchdog rehydrates the due wake, acquires the lease once, clears the row, and the run returns to `running`.

- **Mission:** Manually resume early after changing credentials.
  - **Entry point:** Quota-waiting conversation in the UI.
  - **Expected proof:** Manual resume clears the scheduled wake, records a force attempt, and either continues or reschedules with a new provider reset message.

## Implementation Tasks

- [ ] **1. Add quota parser tests first**
  - Create `tests/server/quota/reset-parser.test.ts`.
  - Cover high-confidence, medium-confidence, low-confidence, and non-quota cases.
  - Include current-time injection so relative and time-only tests are deterministic.
  - Verification: `pnpm test tests/server/quota/reset-parser.test.ts`.

- [ ] **2. Implement the shared quota reset parser**
  - Create `src/server/quota/reset-parser.ts`.
  - Parse error chains without losing nested `cause`, `status`, `statusCode`, headers-like records, and message text.
  - Return structured `QuotaResetInfo`; do not mutate run state here.
  - Verification: parser tests pass.

- [ ] **3. Add durable wake schema**
  - Update `src/server/db/schema.ts` and `src/server/db/index.ts`.
  - Add table and index for `supervisor_scheduled_wakes`.
  - Add database tests or extend existing schema tests.
  - Verification: `pnpm test tests/db/schema.test.ts`.

- [ ] **4. Build durable wake scheduling**
  - Create `src/server/supervisor/wake-schedule.ts`.
  - Implement schedule, cancel, rehydrate, due execution, long-delay chunking, and terminal-run cleanup.
  - Integrate with `acquireSupervisorWakeLease()` / `releaseSupervisorWakeLease()`.
  - Verification: `pnpm test tests/supervisor/wake-schedule.test.ts tests/supervisor/wake.test.ts`.

- [ ] **5. Extend recovery state and policy for quota waits**
  - Modify `src/server/runs/recovery-state.ts`, `src/server/runs/recovery-incidents.ts`, and `src/server/runs/recovery-policy.ts`.
  - Keep legacy `RECOVERY_POLICY` settings valid.
  - Keep quota wait rescheduling separate from lost-worker retry exhaustion.
  - Verification: `pnpm test tests/server/runs/recovery-policy.test.ts tests/server/runs/recovery-state.test.ts`.

- [ ] **6. Implement quota recovery handlers**
  - Create `src/server/quota/recovery.ts`.
  - Implement supervisor and worker handlers that open/update incidents, set `quota_waiting`, mark workers `cred-exhausted`, record execution events, record credit events where applicable, schedule durable wakes, and preserve queued messages.
  - Handle no-parseable-reset as `needs_recovery` with raw truncated diagnostics.
  - Verification: `pnpm test tests/server/quota/recovery.test.ts`.

- [ ] **7. Wire supervisor model quota handling**
  - Modify `src/server/supervisor/index.ts` and related result types.
  - Preserve `fallback_api` semantics: fallback first, wait only if fallback cannot continue.
  - Implement `wait_for_reset` as a real scheduled wait.
  - Ensure quota waits do not call `persistRunFailure()`.
  - Verification: `pnpm test tests/supervisor/index.test.ts tests/supervisor/wake.test.ts`.

- [ ] **8. Wire worker quota handling**
  - Modify `src/server/supervisor/observer.ts` to detect quota before generic fatal/failure paths.
  - Modify `src/server/workers/monitor.ts` to use the shared parser.
  - Ensure observers are quieted while `quota_waiting`, then restarted on due wake.
  - Verification: `pnpm test tests/supervisor/observer.test.ts tests/workers/monitor.test.ts`.

- [ ] **9. Rehydrate quota waits through runtime startup**
  - Modify `src/server/supervisor/runtime-watchdog.ts` and `src/server/supervisor/start.ts`.
  - Startup must resume `running` runs normally, re-arm `quota_waiting` runs by durable schedule, and immediately execute overdue quota wakes.
  - Verification: add watchdog tests and run `pnpm test tests/supervisor/wake.test.ts`.

- [ ] **10. Add API and event payload support**
  - Modify `src/app/api/events/route.ts` and `src/app/api/runs/[id]/resume/route.ts`.
  - Manual resume must clear durable quota waits before force-waking.
  - Event payload must expose bounded quota metadata without leaking secrets or huge raw provider output.
  - Verification: `pnpm test tests/api/events-route.test.ts tests/api/run-route.test.ts`.

- [ ] **11. Add UI visibility with i18n**
  - Update `src/app/home/types.ts`, `src/app/home/recovery-utils.ts`, `src/components/home/RunRecoveryNotice.tsx`, and `src/components/home/RecoveryIncidentInspector.tsx`.
  - Add every new user-facing string to every `shared/locales/*.json`.
  - Use `useI18nSnapshot()` wherever components must re-render on language change.
  - Verification: `pnpm test tests/ui/conversation-actions.test.ts tests/ui/sidebar-layout.test.ts tests/lib/i18n.test.ts`.

- [ ] **12. Harden cancellation, archive, and terminal cleanup**
  - Ensure run recovery, run deletion, archive/cancel paths, and delete-conversations cleanup remove durable quota schedules and related credit events.
  - Extend `scripts/delete-conversations.sh` only if the new table needs explicit cleanup.
  - Verification: `pnpm test tests/scripts/delete-conversations.test.ts tests/api/run-route.test.ts`.

- [ ] **13. Add end-to-end scheduler safety tests**
  - Cover duplicate timers, lease-blocked due wakes, manual override racing with due wake, repeated quota after wake, and process restart rehydration.
  - Use fake timers for deterministic coverage.
  - Verification: targeted scheduler/recovery tests pass.

- [ ] **14. Final verification pass**
  - Run targeted test groups first:
    - `pnpm test tests/server/quota/reset-parser.test.ts tests/server/quota/recovery.test.ts tests/supervisor/wake-schedule.test.ts`
    - `pnpm test tests/supervisor/index.test.ts tests/supervisor/observer.test.ts tests/supervisor/wake.test.ts`
    - `pnpm test tests/api/events-route.test.ts tests/api/run-route.test.ts`
    - `pnpm test tests/ui/conversation-actions.test.ts tests/ui/sidebar-layout.test.ts tests/lib/i18n.test.ts`
  - Run `pnpm lint`.
  - Run full `pnpm test` if targeted tests and lint pass.

## Acceptance Criteria

- A schedulable supervisor quota error creates a `quota_exhausted` incident and a durable wake at `resetAt + quotaResetGraceMs`.
- A schedulable worker quota error marks the worker `cred-exhausted`, preserves session metadata, creates a quota incident, and schedules a durable wake.
- The run remains active as `quota_waiting`; it does not become `failed` for schedulable quota exhaustion.
- Runtime restart or sleep does not lose pending quota resumes.
- The wake lease prevents duplicate resumes when timers, watchdog, and manual resume race.
- Manual resume clears or supersedes the durable wake and records a force attempt.
- Repeated quota at the scheduled wake reschedules from the new provider reset instead of hammering every 5 seconds.
- Quota text without a reset does not loop; it becomes `needs_recovery` with clear diagnostics.
- Queued messages remain persisted through the wait and are not marked failed solely because quota is exhausted.
- UI surfaces reset time, wait reason, and manual resume using translated strings only.
- Recovery incident inspector shows parse source, confidence, scheduled time, actual wake drift, attempts, and latest outcome.
- No new branch or worktree is created.

## Out Of Scope

- Building provider-specific account pool rotation beyond the existing `fallback_api`, `swap_account`, and `cross_provider` settings.
- Predicting quota depletion before a provider reports exhaustion.
- Billing/subscription management for external coding agents.
- Persisting translated strings or provider messages as UI copy. Store raw diagnostics and stable status ids; translate only at render time.
