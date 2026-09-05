# Claude Alias And Dead Session Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a canonical Claude Opus 5 request accept the provider-verified `opus[1m]` alias without permitting cross-model substitution, contain every failed startup/disconnect, keep lost workers in an honest recovery state, and replay session `76d5d121fe24`.

**Architecture:** Treat the Claude ACP model menu as the authority for alias identity while keeping family and version checks fail-closed. Give every pre-registration ACP process explicit cleanup ownership, treat HTTP disconnects as normal cancellation rather than zlib failures, and make persisted `lost` workers classify as recovery-required instead of healthy/running.

**Tech Stack:** TypeScript, ACP, Node child processes and streams, Drizzle/SQLite, Vitest, OmniHarness lifecycle harness.

**North Star Product:** A worker launch either runs the exact model identity the user selected or fails visibly, and every interrupted run converges to a truthful, actionable state without leaking processes or crashing the runner.

**Current Milestone:** Fix and regression-test the four failure modes that stranded session `76d5d121fe24`, then safely resume that persisted user request.

**Final Functionality Standard:** The real Claude adapter alias launches successfully, incompatible aliases still refuse, rejected launches leave no child behind, compressed client disconnects cannot take down the runner, lost workers cannot be marked healthy/running, and the affected session produces a persisted worker response.

---

## File map and invariants

- Modify `src/lib/claude-session-model.ts`: keep provider alias verification family/version-safe and document canonical-request-to-provider-alias behavior.
- Modify `src/server/agent-runtime/manager.ts`: use the verified model resolution for explicit Claude selections and clean every acquired startup resource on pre-registration failure. This file is already over 1,200 lines; keep the edit local and move cohesive cleanup logic to a small helper rather than growing the launch path further.
- Create or modify a focused helper under `src/server/agent-runtime/` only if cleanup ownership cannot remain clear in the existing launch scope.
- Modify `src/runtime/http/stream-response.ts`: make disconnect cancellation non-exceptional for gzip and settle both producer and consumer work.
- Modify `src/server/conversations/sync.ts` and `src/server/runs/recovery-state.ts`: map `lost` to recovery-required and never allow it to fall through to `running`/`healthy`. `sync.ts` is near 1,200 lines, so add only the narrow status rule and keep classification logic in `recovery-state.ts`.
- Modify `tests/lib/claude-session-model.test.ts` and `tests/server/agent-runtime/claude-model-pin.test.ts`: cover the exact `claude-opus-5` → provider-reported `opus[1m]` case, incompatible-version refusal, and failed-launch process cleanup.
- Modify `tests/runtime/http-server.test.ts`: abort a real gzip/SSE client and prove the server remains usable with no uncaught stream failure.
- Modify `tests/server/runs/recovery-state.test.ts` and `tests/server/conversations-sync.test.ts`: prove a persisted lost direct worker without session metadata remains `needs_recovery` and keeps an unsettled incident.
- Add a headless scenario under `tests/lifecycle/scenarios/` if the existing lifecycle harness can reproduce the persisted-lost transition without production-only fault injection; otherwise cover the same real state transition through the server integration suite and run the full lifecycle suite.
- Create `docs/superpowers/learnings/2026-09-02-provider-aliases-and-startup-ownership.md` and update the lifecycle architecture invariant with the durable lesson.
- No frontend files or user-facing copy are required. No new settings or persistence surfaces are introduced.
- Stable ownership: the requested model remains canonical intent; the ACP-reported menu choice is observed runtime identity; the manager owns an ACP child until it is either registered or fully disposed; the recovery classifier owns persisted run truth.
- Alias proof: an exact reported canonical value is sufficient even without menu choices; otherwise the currently reported alias must identify the requested family and its one menu option must unambiguously identify the requested version. Empty, missing, internally contradictory, duplicate, wrong-family, or wrong-version evidence refuses the launch. Context suffixes such as `[1m]` may vary without changing model identity.
- Launch ownership: the launch scope owns child, connection/client, and managed skill links until the fully constructed record is inserted into the manager map. That insertion is the single ownership transfer. Every earlier failure/timeout/abort disposes each resource once; cleanup failure is surfaced without replacing the original launch error.
- Ordering: model verification completes before worker registration and prompting; failed startup cleanup settles before the rejection escapes; a disconnect cancels and settles the body reader and compressor before the response task finishes; recovery classification happens before sync can rewrite a run.
- Completeness: an absent live worker plus persisted `lost` status is complete evidence of non-health, regardless of whether a queued message or bridge session id exists.
- Recovery incident ownership: `recovery-state.ts` classifies evidence, every selected or background sync routes durable `lost` state through the reconciler, and incident identity is claimed inside a SQLite write transaction so concurrent callers open or retain one incident. Only verified active work or a terminal run may resolve it.
- Observability: alias refusal continues to emit its existing stable `worker.model.*` `error.surfaced` code; recovery classification/attempt/result continues through existing `recovery_*` execution events and `recovery.*` named events. A cleanup failure receives a stable `error.surfaced` code while preserving the primary launch error. Expected client disconnect cancellation is not an error decision; an unexpected compression/cancellation failure remains rejected to the server error boundary.
- `.gitignore` already excludes `*.db`, `.omniharness/`, dependency caches, logs, and build artifacts used by this work.

## Tasks

- [x] Add failing tests for the Opus 5 provider alias and pre-registration process cleanup; cover wrong family/version, absent and contradictory metadata, plus verification failure, and run them alone to capture the red failures.
- [x] Implement verified explicit-model alias acceptance while preserving family/version refusal, and implement deterministic startup resource cleanup; rerun the focused tests green.
- [x] Add a failing real HTTP regression that disconnects from a gzip stream, observes upstream cancellation/settlement and absence of delayed unhandled rejection, then successfully requests another endpoint; run it red.
- [x] Make gzip disconnect cancellation fully settled and non-fatal with listeners removed; rerun the focused runtime HTTP test green.
- [x] Add failing recovery classifier and conversation-sync tests for a persisted `lost` direct worker with no ACP metadata; include repeated and background-first sync plus concurrent incident creation so recovery cannot resolve healthy or duplicate incidents, then run them red.
- [x] Make `lost` recovery-required in both classification and persisted sync projection, retaining/creating the named recovery incident; rerun focused tests green.
- [x] Add the narrow headless lifecycle regression and run `pnpm test:lifecycle` to verify event/state behavior through HTTP/SSE.
- [x] Run focused suites, `pnpm typecheck`, and the relevant complete server/runtime test files. No interface build is required because no frontend file is changed by this fix. Typecheck reaches the final all-tests pass and stops only on the unrelated pre-existing `tests/app/conversation-transcript-retention.test.ts:27` error.
- [x] Inspect the final diff against the dirty baseline, write the learning note and architecture rule, and rerun verification after documentation/code adjustments.
- [ ] Record every test-created run/worker id and clean only those exact records/artifacts. Re-audit session `76d5d121fe24` immediately before replay: runs, workers, messages, queued messages, execution events, plan/validation records, incidents, live bridge agents, and unified worker streams. Retry only if there is still no live/in-flight worker, no pending/delivering queue item, and no persisted assistant response to the original checkpoint. Use the ordinary retry path to create one replacement worker, and require its named recovery/spawn/terminal events, exactly one delivered attempt, terminal successful unified-stream output, truthful run/worker status, resolved incident, and no confirmed orphan process.

  Replay gate passed and worker 5 launched exactly once on provider identity `opus[1m]`; the canonical run preference was restored to `claude-opus-5`. The worker is truthfully `awaiting_user` on four material product decisions, with one user-input delivery and one live elicitation. Terminal verification remains pending until the user answers it.

## Deterministic acceptance checks

- A fake adapter that reports `opus[1m]` with one unambiguous menu option identifying Opus 5 starts for requested `claude-opus-5`, records requested and effective identities separately, and never calls the model menu mutation.
- The same request refuses a reported Fable alias, Opus 4/6 aliases, missing version metadata, and contradictory/duplicate alias metadata.
- Every startup failure after process creation causes the fake ACP child to exit and leaves no registered or pooled agent.
- Cancelling a compressed SSE response settles the upstream reader/compressor/response work, removes listeners, produces no delayed uncaught exception or unhandled rejection, and the same server answers a follow-up health request.
- A running direct run with a persisted `lost` worker and no live agent/session classifies and persists as `needs_recovery`; repeated sync retains one unsettled incident and cannot resolve it as healthy.
- Session `76d5d121fe24` has exactly one replay attempt with terminal successful output in its replacement worker's unified stream, truthful terminal run/worker statuses, a resolved incident, and no live orphan process.

## Approval-gated journey testing

No browser-based agentic journey is proposed: this is a backend/control-plane regression, and the deterministic ACP, HTTP, SQLite, and lifecycle tests exercise the relevant real boundaries more directly.
