---
provider: "claude"
codex_thread_id: "23684cf2-66e9-47ff-ada1-76c62f4558a0"
title: "Review cross-CLI handoff fork implementation plan"
started_at: "2026-08-20T18:04:33.774Z"
updated_at: "2026-08-20T18:18:30.695Z"
working_directory: "/Users/masterman/NLP/omniharness"
archive_status: "unknown"
part: 1
parts: 1
---

# Review cross-CLI handoff fork implementation plan

> This archive contains Claude Code conversation activity, stored thinking blocks, tools, and subagents. Raw system prompts and credentials are excluded.
<!-- codex-event:{"kind":"state","timestamp":"","phase":null} -->
## Claude state: mode

```text
{
  "type": "mode",
  "mode": "normal",
  "sessionId": "23684cf2-66e9-47ff-ada1-76c62f4558a0"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"","phase":null} -->
## Claude state: mode

```text
{
  "type": "mode",
  "mode": "normal",
  "sessionId": "23684cf2-66e9-47ff-ada1-76c62f4558a0"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"","phase":null} -->
## Claude state: mode

```text
{
  "type": "mode",
  "mode": "normal",
  "sessionId": "23684cf2-66e9-47ff-ada1-76c62f4558a0"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-08-20T18:04:33.774Z","phase":null} -->
## Claude state: queue-operation · 2026-08-20T18:04:33.774Z

````text
{
  "type": "queue-operation",
  "operation": "enqueue",
  "timestamp": "2026-08-20T18:04:33.774Z",
  "sessionId": "23684cf2-66e9-47ff-ada1-76c62f4558a0",
  "content": "You are a read-only senior architecture reviewer. Review the complete implementation plan below for an existing TypeScript/React/SQLite control-plane application.\n\nObjective: identify concrete correctness gaps, race conditions, persistence/deletion problems, security/privacy risks, missing edge cases, contradictory sequencing, and tasks that are not implementation-ready. The non-negotiable product invariant is that switching CLI/provider always creates a new run; never switch CLI within one run. Same-CLI model/account recovery may remain in-run. The source and target share the current checkout, so the source must be fenced/stopped to prevent concurrent edits.\n\nJudge only the artifact supplied below. You have no tools and must not request or assume repository access. Return exactly one of:\n\nREADY\n\nor\n\nHARDEN\n\nIf HARDEN, follow it with a concise prioritized numbered list of specific changes to make to this plan. Do not rewrite the plan and do not suggest unrelated features.\n\n--- PLAN START ---\n\n# Feature Implementation Plan\n\n> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax.\n\n**Feature:** Cross-CLI Hybrid Handoff Fork\n\n**Goal:** Let a user fork any direct-control conversation into a new session running on a different CLI, carrying a compact, inspectable hybrid handoff packet; use the same new-run mechanism when cross-provider quota recovery is selected, and make same-run cross-CLI switching impossible.\n\n**Architecture:** A server-owned handoff coordinator freezes the source at a durable worker-stream sequence, gathers bounded deterministic evidence, optionally adds a semantic summary, compiles and persists a versioned packet, and launches a completely separate target run. SQLite stores lifecycle metadata; the append-only artifact store holds packet versions; the target worker stream receives the rendered packet as its first `user_input`. The source run is preserved as stopped history. Same-CLI model/account recovery may continue inside a run, but changing the CLI/provider always crosses a run boundary.\n\n**Tech Stack:** TypeScript, React, TanStack Query, global Manager classes, Drizzle + SQLite, append-only JSONL artifacts, existing runtime HTTP registry/API adapters, named SSE events, Vitest, lifecycle HTTP/SSE scenarios, existing shadcn/ui primitives, and locale JSON files.\n\n**North Star Product:** A user can move work between CLI ecosystems without pretending their provider sessions, recovery semantics, or transcripts are interchangeable. The new agent starts with the smallest trustworthy continuation context, the source remains auditable, and failures never strand or silently mutate either conversation.\n\n**Current Milestone:** Ship cross-CLI handoff forks for direct/commit conversations from the session menu, an individual message, the existing Resume CLI Session dialog, and quota recovery. The packet is editable where it is advisory, inspectable after launch, bounded, redacted, restart-safe, and synthesized without contacting an exhausted provider when necessary.\n\n**Future Product Direction:** Reuse the packet format for export/import and cross-device handoff only after this milestone proves the provenance, recovery, and deletion model. Do not add same-run CLI switching, background multi-agent continuation, or automatic worktree creation in this milestone.\n\n**Final Functionality Standard:** Every cross-CLI transition creates a new run and target worker stream; no server path can recreate a worker under another CLI in the source run. The packet accurately identifies uncertainty and pre-existing workspace changes, survives a process restart, excludes secrets and hidden reasoning, and produces enough observability to explain every capture, launch, refusal, and failure.\n\n---\n\n## Product decisions and non-goals\n\n1. **A CLI handoff is a fork, never a resume.** “Resume external session” keeps its existing meaning. “Fork current conversation to another CLI” creates a new OmniHarness run with `parentRunId` and an optional `forkedFromMessageId`.\n2. **The source is historical after a successful launch.** Stop/fence its active worker, retain its transcript and artifacts, and select the target run in the UI. Do not keep two CLIs editing the same checkout concurrently.\n3. **The packet is hybrid.** Deterministic state is authoritative; generated summaries and outgoing-agent reports are advisory. Current disk state wins over prose.\n4. **Manual and quota paths share one coordinator.** Manual entry points offer a preview. A quota-triggered cross-provider handoff may launch without waiting for an exhausted CLI, then exposes the persisted packet for inspection.\n5. **Only advisory content is user-editable.** The user may amend objective, status, next steps, blockers, notes, and relevant-file explanations. Source IDs, stream sequence, git evidence, verification records, target selection, provenance, and hash are server-owned.\n6. **No full transcript or full diff by default.** The packet contains a short exact tail plus summaries, file-level evidence, and compact error/test output. The source run remains the place to inspect full history.\n7. **No hidden reasoning.** Never copy `thought`, chain-of-thought, raw environment, credentials, authorization headers, binary attachments, or unrestricted tool output into a packet.\n8. **No automatic worktree.** This feature uses the current checkout and avoids concurrency by stopping the source. Existing explicit worktree fork actions remain separate.\n9. **No file deletion is part of this plan.** Refactor existing modules in place or add focused modules; preserve project history and user changes.\n\n## User journeys\n\n### Manual fork from the session\n\n1. The user opens the session menu and selects **Fork to another CLI**.\n2. The dialog defaults to a different available CLI and offers compatible account, model, and effort choices.\n3. The server captures a stable source boundary and returns a compact preview with provenance and warnings.\n4. The user may edit advisory notes, then launches.\n5. OmniHarness validates the target, creates a new run, persists the packet as the target's initial user input, starts the selected CLI, stops the source, and selects the target in the sidebar.\n\n### Fork from a message\n\n1. The user chooses **Fork to another CLI from here** on a user message.\n2. Candidate collection ignores superseded/later conversation entries but compares against the current workspace, explicitly warning when files contain changes made after the selected message.\n3. The rest of the flow is the same as the manual session fork.\n\n### Fork from Resume CLI Session\n\n1. The existing dialog clearly separates **Resume external session** from **Fork current conversation**.\n2. The fork option appears only with an eligible selected OmniHarness direct/commit run.\n3. Choosing it opens the same handoff dialog, not a provider-session resume flow.\n\n### Cross-provider quota recovery\n\n1. A CLI reaches a durable quota-waiting state.\n2. Same-provider account/model recovery may use existing same-CLI recovery.\n3. If the selected strategy requires another CLI/provider, the server synthesizes a packet from persisted evidence and creates a new run.\n4. The exhausted source is never prompted for a handoff and never receives a replacement worker of another type.\n5. If no target can launch, the source remains visibly recoverable/quota-waiting and the error names the failed stage.\n\n## Compact handoff packet contract\n\nCreate a versioned `HybridHandoffPacketV1` with the following logical shape. Use stable IDs and enums rather than translated labels.\n\n```ts\ntype HybridHandoffPacketV1 = {\n  handoffVersion: 1;\n  source: {\n    runId: string;\n    workerId: string | null;\n    workerType: SupportedWorkerType | null;\n    forkedFromMessageId: string | null;\n    sourceSeq: number | null;\n    interruptionReason: \"manual_session\" | \"manual_message\" | \"quota_exhausted\";\n    generatedAt: string;\n  };\n  target: {\n    workerType: SupportedWorkerType;\n    model: string | null;\n    effort: string | null;\n    accountId: string | null;\n  };\n  task: {\n    originalRequest: string | null;\n    currentObjective: string | null;\n    acceptanceCriteria: string[];\n    userConstraints: string[];\n  };\n  state: {\n    completed: string[];\n    inProgress: string[];\n    remaining: string[];\n    blockers: string[];\n    openQuestions: string[];\n    rejectedApproaches: Array<{ approach: string; reason: string }>;\n  };\n  decisions: Array<{ decision: string; reason: string | null; evidence: string[] }>;\n  workspace: {\n    projectPath: string;\n    baselineCommit: string | null;\n    currentHead: string | null;\n    dirtyBeforeSession: boolean | null;\n    modifiedFiles: Array<{\n      path: string;\n      changeType: \"added\" | \"modified\" | \"deleted\" | \"renamed\" | \"unmerged\";\n      ownership: \"session\" | \"probable_session\" | \"preexisting\" | \"external\" | \"unknown\";\n      summary: string | null;\n      evidence: string[];\n    }>;\n    untrackedFiles: string[];\n    relevantUnchangedFiles: string[];\n    commitsCreated: string[];\n  };\n  verification: Array<{\n    command: string;\n    result: \"passed\" | \"failed\" | \"unknown\";\n    exitCode: number | null;\n    importantOutput: string | null;\n  }>;\n  artifacts: {\n    plans: string[];\n    specs: string[];\n    generatedOutputs: string[];\n  };\n  continuity: {\n    recentUserMessages: string[];\n    recentAssistantSummary: string | null;\n    pendingUserInput: string | null;\n    queuedMessages: string[];\n  };\n  provenance: {\n    summarySource: \"outgoing_worker\" | \"recent_assistant\" | \"synthetic\" | \"hybrid\";\n    omittedSections: string[];\n    confidenceWarnings: string[];\n    truncatedFields: string[];\n  };\n};\n```\n\nCompilation rules:\n\n- Set an explicit 36,000-character rendered-packet ceiling (roughly 6,000–10,000 tokens depending on content), plus per-field item and character limits. Keep the constants in code, not environment variables.\n- Prioritize source identity and sequence, user constraints, current objective, blockers/errors, file evidence, verification, decisions, queued input, then recent conversational tail. Drop completed prose first.\n- Stable-sort every deterministic collection so the same evidence yields the same packet and hash.\n- Reuse a recent assistant recap only as advisory text. It is “fresh” only if its worker sequence is at or after the last included tool/result lifecycle boundary; otherwise include it with a stale-summary warning.\n- Ask an outgoing worker for a structured report only when it is idle/responsive and not quota-blocked. Bound the request timeout. Never delay quota recovery on this call.\n- For a hard interruption, synthesize entirely from the worker stream, execution events, messages/queued messages, run metadata, git evidence, and known artifacts.\n- For a message fork, cap conversation candidates at that message/stream boundary while computing workspace state at capture time; call out the mismatch rather than claiming the checkout was rewound.\n- Render advisory narrative inside an explicit untrusted-data boundary telling the target to verify disk state. Do not let tool/assistant text masquerade as system instructions.\n\n## State machine and invariants\n\nPersist these statuses: `capturing -> ready -> launching -> completed`, with terminal `failed` and `cancelled`. A `failed` capture/launch may be retried by creating a new revision or relaunching only when ownership still matches.\n\nThe coordinator owns an immutable launch fence:\n\n```ts\n{\n  handoffId,\n  revision,\n  sourceRunId,\n  sourceWorkerId,\n  sourceSeq,\n  targetSelectionHash\n}\n```\n\nServer invariants:\n\n- At most one nonterminal handoff exists for a source run.\n- New messages, queued-message delivery, retry/edit recovery, manual resume, and quota wake refuse with `409 handoff_in_progress` while the source is fenced.\n- Capture first interrupts/stops an active manual source through the existing turn-generation fence, then waits for persisted output to settle. Timeout uses the last durable sequence and records a confidence warning.\n- Launch validates CLI availability, account/model compatibility, project path, source revision, and target selection before creating a plan/run.\n- The target run and worker are created under the existing run/quota mutation controls. The rendered seed is persisted with `appendUserInputOnDelivery` in the target's unified worker stream before prompting the CLI.\n- `launch` is idempotent. Repeating it with the same operation/revision returns the existing `targetRunId`; a stale revision gets `409 handoff_revision_conflict`.\n- Mark `completed` only after target creation, target seed persistence, and worker launch acceptance. Then settle the source using existing stop/cancel terminal semantics.\n- A target launch failure never manufactures success, never deletes the source, and never leaves an unobservable fence. Release or retain the fence according to a persisted recoverable status and emit the decision.\n- Deleting the source removes its handoff metadata/artifact stream through existing run cleanup; the target remains independently understandable because its initial worker stream contains the rendered seed.\n- Same-run recreation must reject a requested worker type different from the run's existing CLI. Model, effort, or account changes within the same CLI remain allowed where currently supported.\n\n## File map\n\n### Create\n\n- `src/shared/handoff.ts` — packet, lifecycle, API DTO, edit-patch, and error-code contracts shared by server/client.\n- `src/server/handoff/candidates.ts` — bounded candidate reads from unified worker streams, messages, queued messages, events, and artifacts.\n- `src/server/handoff/workspace-state.ts` — read-only git baseline/current evidence and file ownership classification.\n- `src/server/handoff/redaction.ts` — path-safe text normalization, secret/tool-output filtering, and size limits.\n- `src/server/handoff/compiler.ts` — authoritative/advisory merge, priority budgeting, deterministic ordering, provenance, hash, and renderer input.\n- `src/server/handoff/store.ts` — SQLite metadata and append-only packet-version persistence.\n- `src/server/handoff/coordinator.ts` — capture/preview/edit/launch state machine, source fence, idempotency, and failure recovery.\n- `src/server/runs/fork.ts` — extracted generic new-run fork creation used by legacy message forks and handoff launches.\n- `src/server/events/handoff-events.ts` — focused named-event union for import into the existing event contract.\n- `src/runtime/http/routes/handoffs.ts` — create/list/get/patch/launch HTTP handlers and validation.\n- `src/interface/home/HandoffForkManager.ts` — single source of truth for dialog draft, server revision, request ownership, pending stages, and errors.\n- `src/interface/home/HandoffForkDialog.tsx` — target picker, packet preview/editor, warnings, and launch result UI.\n- `src/components/home/CliLaunchSelectionFields.tsx` — reusable CLI/account/model/effort controls for the handoff dialog without duplicating composer selection logic.\n- `tests/server/handoff/compiler.test.ts` — packet priority, freshness, deterministic hash, truncation, and rendering tests.\n- `tests/server/handoff/candidates.test.ts` — bounded stream/event/queued-message and message-boundary tests.\n- `tests/server/handoff/workspace-state.test.ts` — baseline/current classification and path-safety tests.\n- `tests/server/handoff/redaction.test.ts` — credentials, environment, hidden reasoning, malicious content, and byte-limit tests.\n- `tests/server/handoff/store.test.ts` — revisions, active-handoff uniqueness, idempotency, and cascade tests.\n- `tests/server/handoff/coordinator.test.ts` — state transitions, source fences, synthetic fallback, target failures, and launch idempotency.\n- `tests/api/handoffs-route.test.ts` — route validation/auth/contract/error responses.\n- `tests/app/handoff-fork-manager.test.ts` — stale-response ownership, retry, selection, and close/reopen behavior.\n- `tests/ui/handoff-fork-dialog.test.tsx` — translated copy, accessibility, advisory-only editing, and responsive states.\n- `tests/lifecycle/scenarios/cross-cli-handoff-fork.test.ts` — manual and quota cross-CLI lifecycle scenario over HTTP/SSE.\n- `tests/lifecycle/scenarios/cross-cli-handoff-restart.test.ts` — restart, replay, idempotent launch, and deletion scenario.\n\n### Modify\n\n- `src/server/db/schema.ts` — add `conversationHandoffs` metadata table and indexes.\n- `src/server/db/index.ts` — additive schema initialization/migration and database version bump.\n- `src/server/artifacts/stream-types.ts` — add the `handoff_packets` run-level stream kind.\n- `src/server/artifacts/append-only-store.ts` — map the new stream to `handoff-packets.jsonl`.\n- `src/server/handoff/request.ts` — make the outgoing summary request reason-neutral, structured, bounded, and optional.\n- `src/server/handoff/parser.ts` — parse advisory report fields into the versioned candidate contract without treating them as facts.\n- `src/server/handoff/render.ts` — render the versioned packet and remove quota-only wording.\n- `src/server/git/auto-commit.ts` — extract/reuse baseline parsing needed by read-only workspace evidence without synchronous shell work on the hot path.\n- `src/server/runs/recovery.ts` — delegate legacy retry/edit/fork run creation to focused services; do not grow this 1,300+ line module.\n- `src/server/supervisor/worker-failover.ts` — retain compatibility exports but route cross-CLI cases to the new-run handoff coordinator; do not spawn another CLI in the source run.\n- `src/server/supervisor/index.ts` and `src/server/supervisor/wake.ts` — consume target-run outcomes and preserve quota recovery semantics across restart.\n- `src/server/supervisor/observer.ts` — record pending cross-CLI handoff intent instead of only same-run failover intent.\n- `src/server/conversations/send-message.ts` — reject text/composer-driven cross-CLI changes inside an existing run and preserve same-CLI model/account recreation only.\n- `src/server/conversations/queued-messages.ts`, `src/server/conversations/queued-message-interrupt.ts`, `src/server/quota/worker-resume.ts`, and `src/server/runs/recovery-reconciler.ts` — enforce the persisted handoff fence before source mutation/recovery.\n- `src/server/prompts/supervisor.md` — describe cross-provider recovery as a new-session handoff, not an in-session worker swap.\n- `src/server/events/named-events.ts` — import the focused handoff event union, add stable surfaced error codes, and avoid embedding packet bodies in SSE.\n- `src/runtime/http/routes/index.ts` — register handoff routes.\n- `src/runtime-api/types.ts` and `src/runtime-api/domains/index.ts` — add typed `handoffs` operations.\n- `src/interface/home/useHomeMutations.ts` — add query/mutations for preview, edit, launch, and active-draft lookup; switch selection only under matching request ownership.\n- `src/interface/home/useConversationActions.ts` — route session/message cross-CLI actions into `HandoffForkManager`; retain ordinary same-run message retry/edit behavior.\n- `src/interface/home/ExternalSessionsPicker.tsx` — separate external resume from the new current-conversation fork option.\n- `src/components/home/HomeHeader.tsx` — add the session-level entry point.\n- `src/components/home/ConversationMain.tsx` — add the per-message entry point through a small extracted action component or callback; do not grow this 1,600+ line file.\n- `src/components/home/RunRecoveryNotice.tsx` — add quota handoff status/action and target-run navigation.\n- `src/interface/home/HomeApp.tsx` — mount/wire the lazy dialog and manager only; move logic out of this 1,700+ line file.\n- `src/interface/home/EventStreamStateManager.ts` and `src/interface/home/utils.ts` — reconcile handoff lifecycle events and target selection without optimistic run fabrication.\n- `src/components/settings/ModelsSettingsPanel.tsx` — clarify that `cross_provider` opens a new handoff session while same-provider strategies stay in the current CLI.\n- `shared/locales/*.json` — add every new visible label, description, warning, status, aria label, and error fallback to all locales.\n- `tests/db/schema.test.ts`, `tests/supervisor/worker-failover*.test.ts`, `tests/api/conversation-messages-route.test.ts`, `tests/ui/conversation-actions.test.ts`, `tests/app/event-stream-state-manager.test.ts`, and route-contract tests — update existing expectations around the new-run invariant.\n- `docs/architecture/lifecycle-observability-and-testing.md` — document handoff decisions/events and the source/target recovery model before adding server state transitions.\n- `docs/architecture/worker-conversation-stream.md` — document that the target handoff seed is an ordinary first `user_input`, not a parallel transcript.\n- `.gitignore` — verify packet temp/debug output cannot be tracked; add only a narrowly scoped ignore if implementation introduces a local debug artifact.\n\n## API and persistence design\n\n### SQLite metadata\n\nAdd `conversation_handoffs` with:\n\n- `id` primary key.\n- `source_run_id` foreign key to `runs` with `ON DELETE CASCADE`.\n- `source_worker_id` nullable foreign key to `workers` with `ON DELETE SET NULL`.\n- `target_run_id` nullable foreign key to `runs` with `ON DELETE SET NULL`.\n- `forked_from_message_id`, `reason`, `status`, `revision`, `source_seq`.\n- `target_worker_type`, `target_model`, `target_effort`, `target_account_id`, `target_selection_hash`.\n- `packet_version`, `artifact_seq`, `packet_hash`, `packet_preview`, `summary_source`.\n- `operation_id`, `last_error`, `created_at`, `updated_at`, `completed_at`.\n- A unique partial index for one nonterminal handoff per source run, plus indexes for target run and status/update time.\n\nKeep the full packet out of SQLite. Append every ready/revised packet as an `ArtifactRecordEnvelope<HybridHandoffPacketV1>` in the source run's `handoff_packets` stream and point metadata at the current sequence/hash. Store only a bounded, redacted preview for list/recovery UI.\n\n### HTTP contract\n\n- `POST /api/runs/:runId/handoffs` — create or return the active draft. Body: fork point, reason, and target selection. Returns `202 capturing` or `200 ready` with metadata/packet DTO.\n- `GET /api/runs/:runId/handoffs?active=1` — restore a durable draft after reload.\n- `GET /api/handoffs/:handoffId` — inspect the current packet/revision/result.\n- `PATCH /api/handoffs/:handoffId` — patch advisory fields with `expectedRevision`; return `409` on stale revision.\n- `POST /api/handoffs/:handoffId/launch` — idempotent launch with `expectedRevision`, `operationId`, and final target selection; return the target run/worker IDs.\n- `POST /api/handoffs/:handoffId/cancel` — release an unlaunched manual draft fence. A completed handoff cannot be cancelled.\n\nReturn typed stage-specific errors. User-relevant failures also emit `error.surfaced` with stable codes such as `handoff.capture_failed`, `handoff.revision_conflict`, `handoff.target_unavailable`, `handoff.source_changed`, and `handoff.launch_failed`.\n\n### Named events\n\nEmit these via `emitNamedEvent` for every server decision:\n\n- `handoff.capture_started`\n- `handoff.packet_ready`\n- `handoff.packet_revised`\n- `handoff.launch_started`\n- `handoff.completed`\n- `handoff.cancelled`\n- `handoff.failed`\n- `handoff.refused`\n\nEvents carry IDs, revisions, stage, source/target IDs, target worker type, reason, and stable error code where relevant. They never carry the full packet. All event frames retain the existing SSE ID/replay/resync behavior.\n\n## Implementation tasks\n\n### Task 1: Freeze the cross-CLI invariant in tests and architecture docs\n\n**Files:**\n- Modify: `docs/architecture/lifecycle-observability-and-testing.md`\n- Modify: `docs/architecture/worker-conversation-stream.md`\n- Modify: `tests/api/conversation-messages-route.test.ts`\n- Modify: `tests/supervisor/worker-failover.test.ts`\n- Modify: `tests/supervisor/worker-failover-handoff-fails.test.ts`\n- Modify: `tests/supervisor/worker-failover-spawn-retry.test.ts`\n- Modify: `tests/supervisor/worker-failover-no-replacement.test.ts`\n\n- [ ] Add architecture text stating that a CLI/provider change creates a new run, the target seed lives in its unified worker stream, and source/target ownership is never shared.\n- [ ] Add a failing API test proving a follow-up request cannot change `preferredWorkerType` from the source worker type inside the same run.\n- [ ] Replace same-run cross-provider failover expectations with failing expectations for a distinct target `runId`, source preservation, and no replacement worker of another type under the source run.\n- [ ] Add a failing case for target-unavailable behavior that leaves the source quota-waiting/recoverable.\n- [ ] Run `pnpm vitest run tests/api/conversation-messages-route.test.ts tests/supervisor/worker-failover.test.ts tests/supervisor/worker-failover-handoff-fails.test.ts tests/supervisor/worker-failover-spawn-retry.test.ts tests/supervisor/worker-failover-no-replacement.test.ts` and confirm the new assertions fail for the intended missing behavior.\n\n### Task 2: Define the packet and lifecycle contracts\n\n**Files:**\n- Create: `src/shared/handoff.ts`\n- Create: `tests/server/handoff/compiler.test.ts`\n- Create: `tests/server/handoff/redaction.test.ts`\n\n- [ ] Define V1 packet, provenance, lifecycle metadata, editable advisory patch, API request/response, and error-code types.\n- [ ] Make authoritative versus advisory fields explicit in the types so PATCH cannot alter source/workspace/verification provenance.\n- [ ] Add constants for total and per-field budgets, item counts, recent-tail bounds, and supported interruption reasons.\n- [ ] Write failing tests for stable ordering, deterministic hashes, priority truncation, exact omission metadata, and rejection of unknown packet versions.\n- [ ] Write failing redaction tests for common API keys/tokens, authorization headers, environment dumps, hidden-reasoning entries, absolute paths outside the project, control characters, and prompt-like tool output.\n- [ ] Run `pnpm vitest run tests/server/handoff/compiler.test.ts tests/server/handoff/redaction.test.ts` and confirm failures are contractual rather than fixture errors.\n\n### Task 3: Add durable metadata and packet artifact storage\n\n**Files:**\n- Modify: `src/server/db/schema.ts`\n- Modify: `src/server/db/index.ts`\n- Modify: `src/server/artifacts/stream-types.ts`\n- Modify: `src/server/artifacts/append-only-store.ts`\n- Create: `src/server/handoff/store.ts`\n- Create: `tests/server/handoff/store.test.ts`\n- Modify: `tests/db/schema.test.ts`\n\n- [ ] Add the `conversation_handoffs` table, foreign keys, timestamps, revision, operation ID, bounded preview, and indexes described above using the repository's additive schema pattern.\n- [ ] Increment `DB_SCHEMA_VERSION` and test initialization of old and fresh databases.\n- [ ] Add the run-level `handoff_packets` stream and map it to `app-data/run-data/<runId>/handoff-packets.jsonl` through the artifact store.\n- [ ] Implement transactional metadata transitions plus append/read of packet versions; never expose a metadata revision whose artifact append failed.\n- [ ] Enforce one active handoff per source run and idempotent operation IDs.\n- [ ] Test packet revision lookup, stale revision refusal, source deletion cascade, target deletion nulling, and no orphaned artifact metadata.\n- [ ] Run `pnpm vitest run tests/server/handoff/store.test.ts tests/db/schema.test.ts`.\n\n### Task 4: Gather bounded deterministic evidence\n\n**Files:**\n- Create: `src/server/handoff/candidates.ts`\n- Create: `src/server/handoff/workspace-state.ts`\n- Create: `src/server/handoff/redaction.ts`\n- Modify: `src/server/git/auto-commit.ts`\n- Create: `tests/server/handoff/candidates.test.ts`\n- Create: `tests/server/handoff/workspace-state.test.ts`\n- Modify: `tests/server/handoff/redaction.test.ts`\n\n- [ ] Read worker content only through bounded `readWorkerEntriesTail`/`Since`/`Before` APIs and respect superseded sequence ranges.\n- [ ] Gather original/current user requests, a small exact recent tail, latest assistant recap, queued messages, unresolved execution errors, verification commands/results, plan/spec/generated artifact paths, and the source sequence.\n- [ ] For message forks, constrain conversational evidence to the selected message boundary.\n- [ ] Parse `runs.gitBaselineJson`, current HEAD/status, diff stats, commit range, tool edit events, and relevant agent summaries into file ownership evidence.\n- [ ] Classify file ownership conservatively; never claim session ownership from current git status alone. Preserve `unknown` and warnings.\n- [ ] Normalize project-relative paths, omit file contents and raw diff hunks by default, and include only narrowly bounded hunks for unresolved conflicts/subtle incomplete edits.\n- [ ] Test large streams, already-compacted history, deleted/renamed/untracked files, a dirty pre-session baseline, external concurrent edits, post-message workspace drift, malformed baselines, and non-git projects.\n- [ ] Run `pnpm vitest run tests/server/handoff/candidates.test.ts tests/server/handoff/workspace-state.test.ts tests/server/handoff/redaction.test.ts`.\n\n### Task 5: Compile and render the hybrid packet\n\n**Files:**\n- Create: `src/server/handoff/compiler.ts`\n- Modify: `src/server/handoff/request.ts`\n- Modify: `src/server/handoff/parser.ts`\n- Modify: `src/server/handoff/render.ts`\n- Modify: `tests/server/handoff/compiler.test.ts`\n- Modify: existing tests under `tests/server/handoff/`\n\n- [ ] Implement deterministic merging where collected facts override advisory summaries and every conflict becomes a confidence warning.\n- [ ] Detect fresh recent assistant recaps using worker/event sequence evidence.\n- [ ] Update the outgoing request to return only structured task/state/decision/file explanations; use a short timeout and skip it for quota-blocked or busy workers.\n- [ ] Preserve the existing synthetic fallback, but feed it through the same candidates/compiler/redaction pipeline.\n- [ ] Enforce the packet budget by priority, populate `omittedSections`/`truncatedFields`, and hash the canonical representation.\n- [ ] Render a concise target prompt with objective, state, decisions, workspace, verification, pending input, uncertainty, and an explicit instruction to inspect current files before acting.\n- [ ] Ensure quota wording is a reason field, not hard-coded into all handoffs.\n- [ ] Test clean completed turns, mid-turn interruption, hard quota interruption, already-compacted history, short sessions, stale summaries, malicious advisory content, and overflow.\n- [ ] Run `pnpm vitest run tests/server/handoff`.\n\n### Task 6: Extract safe new-run fork creation\n\n**Files:**\n- Create: `src/server/runs/fork.ts`\n- Modify: `src/server/runs/recovery.ts`\n- Modify: `tests/api/run-route.test.ts`\n- Modify: `tests/ui/conversation-actions.test.ts`\n\n- [ ] Extract plan/run/message-copy creation from the existing `recoverRun(... action: \"fork\")` branch without changing retry/edit semantics.\n- [ ] Accept an explicit target worker type/model/effort/account/allowed-types selection and copy `preferredWorkerAccountId`, which the current fork path can omit.\n- [ ] Preserve `parentRunId`, `forkedFromMessageId`, project path, git baseline/workspace metadata, auto-commit preferences, and the selected message prefix.\n- [ ] Separate “create target” from “stop source”; the handoff coordinator controls ordering so a failed target validation cannot cancel the source first.\n- [ ] Keep existing ordinary and worktree fork behavior passing; do not create a worktree for cross-CLI handoff.\n- [ ] Add rollback/cleanup for a target plan/run created before worker launch fails, using existing recoverable cleanup conventions without deleting user files.\n- [ ] Run `pnpm vitest run tests/api/run-route.test.ts tests/ui/conversation-actions.test.ts`.\n\n### Task 7: Build the server coordinator and source fence\n\n**Files:**\n- Create: `src/server/handoff/coordinator.ts`\n- Create: `tests/server/handoff/coordinator.test.ts`\n- Modify: `src/server/conversations/queued-messages.ts`\n- Modify: `src/server/conversations/queued-message-interrupt.ts`\n- Modify: `src/server/quota/worker-resume.ts`\n- Modify: `src/server/runs/recovery-reconciler.ts`\n\n- [ ] Implement capture, revise, launch, cancel, retry, and restore transitions over the persisted metadata/store.\n- [ ] Acquire the per-run mutation fence and reject a second active handoff.\n- [ ] On manual capture, interrupt active delivery with the existing worker turn-generation fence, wait for durable stream stabilization, and record a warning on timeout.\n- [ ] Stop queued delivery and preserve undelivered messages as packet continuity data.\n- [ ] Validate target CLI/account/model/effort before target run creation.\n- [ ] Create the target run, persist rendered seed with `appendUserInputOnDelivery`, start the target worker, then settle the source as stopped/cancelled history.\n- [ ] Implement launch idempotency and stale source-sequence/revision refusal.\n- [ ] Gate send, queue, retry/edit, resume, wake, and reconciler mutations while a handoff owns the source.\n- [ ] Test races: send versus capture, capture versus quota wake, double launch, cancel versus launch, worker output after interrupt, target spawn failure, restart at every status, and source/target deletion.\n- [ ] Run `pnpm vitest run tests/server/handoff/coordinator.test.ts tests/server/quota/worker-resume.test.ts tests/server/runs/recovery-reconciler.test.ts`.\n\n### Task 8: Expose typed HTTP/runtime APIs and observability\n\n**Files:**\n- Create: `src/server/events/handoff-events.ts`\n- Modify: `src/server/events/named-events.ts`\n- Create: `src/runtime/http/routes/handoffs.ts`\n- Modify: `src/runtime/http/routes/index.ts`\n- Modify: `src/runtime-api/types.ts`\n- Modify: `src/runtime-api/domains/index.ts`\n- Create: `tests/api/handoffs-route.test.ts`\n- Modify: route registry/contract tests under `tests/runtime/` and `tests/api/`\n\n- [ ] Add the named handoff events and stable `error.surfaced` codes without growing `named-events.ts` with full implementation logic.\n- [ ] Register authenticated create/list/get/patch/launch/cancel routes and validate all IDs, enums, revisions, and selection fields.\n- [ ] Return `202` for in-progress capture, `409` for ownership/revision conflicts, `422` for incompatible target selection, and stage-specific `5xx` errors only for actual server failures.\n- [ ] Add typed runtime APIs; do not route handoffs through `runs.act` with `unknown` bodies.\n- [ ] Ensure no HTTP or SSE response includes secrets, raw packet artifacts when only metadata is needed, or untranslated visible server prose at the UI boundary.\n- [ ] Test auth, malformed input, unsupported source mode, same-CLI target refusal, stale revision, replayed operation ID, packet retrieval, and surfaced error event payloads.\n- [ ] Run `pnpm vitest run tests/api/handoffs-route.test.ts tests/runtime`.\n\n### Task 9: Replace every same-run cross-CLI path\n\n**Files:**\n- Modify: `src/server/conversations/send-message.ts`\n- Modify: `src/server/supervisor/worker-failover.ts`\n- Modify: `src/server/supervisor/index.ts`\n- Modify: `src/server/supervisor/wake.ts`\n- Modify: `src/server/supervisor/observer.ts`\n- Modify: `src/server/prompts/supervisor.md`\n- Modify: `src/server/credits/index.ts`\n- Modify: `src/components/settings/ModelsSettingsPanel.tsx`\n- Modify: `tests/api/conversation-messages-route.test.ts`\n- Modify: `tests/supervisor/worker-failover*.test.ts`\n\n- [ ] In `applyWorkerPreferenceForMessage`/`reconcileDirectWorkerSelection`, reject a type change for an existing run with a typed “fork required” result; do not persist the new preferred type and do not defer it for later recreation.\n- [ ] Keep same-CLI model, effort, and account recreation behavior and its current ownership fencing.\n- [ ] Route cross-provider quota strategy/allowed-worker selection to `coordinator.captureAndLaunch` and return `targetRunId` rather than a replacement worker ID.\n- [ ] Keep the existing `worker-failover.ts` exports as compatibility wrappers while callers/tests migrate; do not delete the file.\n- [ ] Update wake/restart recovery to continue a persisted handoff rather than retrying a same-run provider spawn.\n- [ ] Update supervisor prompt and settings explanation to say cross-provider recovery creates a new session.\n- [ ] Rename user-visible lifecycle copy from “switching workers” to handoff/fork language while retaining legacy event parsing only where backward compatibility needs it.\n- [ ] Run the focused API/supervisor/quota suites and assert no source run contains workers of two CLI types.\n\n### Task 10: Build the client Manager and dialog\n\n**Files:**\n- Create: `src/interface/home/HandoffForkManager.ts`\n- Create: `src/interface/home/HandoffForkDialog.tsx`\n- Create: `src/components/home/CliLaunchSelectionFields.tsx`\n- Modify: `src/interface/home/useHomeMutations.ts`\n- Create: `tests/app/handoff-fork-manager.test.ts`\n- Create: `tests/ui/handoff-fork-dialog.test.tsx`\n- Modify: `shared/locales/*.json`\n\n- [ ] Implement a Manager-owned state machine for closed/selecting/capturing/ready/editing/launching/completed/error, including source run/message IDs, revision, target selection, packet, warnings, and request token.\n- [ ] Use TanStack Query only for transport/cache; the Manager is the single UI source of truth and ignores responses whose ownership token no longer matches.\n- [ ] Build an accessible, responsive dialog using existing Dialog/Select/Textarea/Button/ScrollArea/Alert/Badge primitives.\n- [ ] Default to the last compatible *different* CLI, exclude the source CLI, and validate account/model/effort combinations before capture/launch.\n- [ ] Show authoritative sections read-only, advisory fields editable, source/provenance/warnings visible, and an explicit “current files win” note.\n- [ ] Debounce or explicitly save advisory edits with `expectedRevision`; disable launch until the current edit revision is acknowledged.\n- [ ] Allow recovery of the active durable draft after reload and a clear cancel action before launch.\n- [ ] Add all visible/aria/error strings to every `shared/locales/*.json` file and subscribe with `useI18nSnapshot()`.\n- [ ] Test keyboard focus, escape/cancel, mobile sizing, loading/error/retry states, stale edit conflicts, CLI exclusion, and no hard-coded user-facing JSX.\n- [ ] Run `pnpm vitest run tests/app/handoff-fork-manager.test.ts tests/ui/handoff-fork-dialog.test.tsx`.\n\n### Task 11: Wire every product entry point\n\n**Files:**\n- Modify: `src/interface/home/useConversationActions.ts`\n- Modify: `src/interface/home/ExternalSessionsPicker.tsx`\n- Modify: `src/components/home/HomeHeader.tsx`\n- Modify: `src/components/home/ConversationMain.tsx`\n- Modify: `src/components/home/RunRecoveryNotice.tsx`\n- Modify: `src/interface/home/HomeApp.tsx`\n- Modify: `tests/ui/conversation-actions.test.ts`\n- Modify: `tests/server/external-sessions/discovery.test.ts`\n- Modify: `shared/locales/*.json`\n\n- [ ] Add **Fork to another CLI** to the session menu for eligible direct/commit runs.\n- [ ] Add **Fork to another CLI from here** to user-message actions and pass the exact message ID.\n- [ ] Add a distinct current-conversation fork choice to Resume CLI Session without changing external Claude/Gemini resume behavior.\n- [ ] Add a quota notice action/status that opens or navigates to the automatic handoff and target run.\n- [ ] Keep `HomeApp.tsx` as wiring only and extract any message-action UI needed to avoid growing oversized components.\n- [ ] On success, select the target only if the user is still viewing the source associated with the completed request; otherwise show a non-destructive notification/link.\n- [ ] Preserve ordinary “Fork session” semantics if it remains same-CLI, and make the cross-CLI wording unambiguous.\n- [ ] Test eligibility, source/message payloads, no selected run, unsupported modes, selection races, external resume regression, and quota CTA behavior.\n- [ ] Run `pnpm vitest run tests/ui/conversation-actions.test.ts tests/server/external-sessions/discovery.test.ts`.\n\n### Task 12: Reconcile SSE, restart, and lifecycle recovery\n\n**Files:**\n- Modify: `src/interface/home/EventStreamStateManager.ts`\n- Modify: `src/interface/home/utils.ts`\n- Modify: `tests/app/event-stream-state-manager.test.ts`\n- Create: `tests/lifecycle/scenarios/cross-cli-handoff-fork.test.ts`\n- Create: `tests/lifecycle/scenarios/cross-cli-handoff-restart.test.ts`\n\n- [ ] Reconcile capture/revision/launch/completion/failure events into existing run snapshots without creating optimistic fake runs.\n- [ ] Fetch snapshot/active handoff after `stream.resync_required`; treat SSE as an invalidation signal and HTTP/SQLite as authority.\n- [ ] Add a manual lifecycle scenario covering source activity, stable capture, packet artifact, target run/worker/seed, source stop, and no mixed CLI types.\n- [ ] Add a quota scenario where the outgoing worker cannot answer, synthetic capture succeeds, and the target new run continues.\n- [ ] Add restart checkpoints after `capturing`, `ready`, and `launching`; prove recovery either finishes once or surfaces a retryable failure without duplicate targets.\n- [ ] Add FK/delete coverage: deleting the source removes its packet metadata/artifact while the target's seed remains readable.\n- [ ] Validate every decision through `/api/events/log?since=<id>&runId=<id>` and assert named refusal/failure events exist.\n- [ ] Run the focused state-manager test, then `pnpm test:lifecycle`.\n\n### Task 13: Full verification and handoff documentation\n\n**Files:**\n- Modify only as failures require within the files already listed.\n- Verify: `.gitignore`\n\n- [ ] Re-read both architecture docs and confirm every new server decision emits a named event and every user-relevant failure emits a stable `error.surfaced` code.\n- [ ] Verify every target seed was persisted through `appendUserInputOnDelivery` and no parallel conversation storage was introduced.\n- [ ] Verify all visible strings use `t()` and all locale files contain the same new keys.\n- [ ] Verify packet storage, test databases, generated debug packets, CLI transcripts, credentials, and temporary review output are not accidentally tracked; make only a narrow `.gitignore` addition if needed.\n- [ ] Run `pnpm typecheck`.\n- [ ] Run `pnpm lint`.\n- [ ] Run `pnpm vitest run`.\n- [ ] Run `pnpm test:lifecycle`.\n- [ ] Run the mandatory frontend build: `pnpm build:interface:web`.\n- [ ] Inspect `git diff --check` and `git status --short`; preserve unrelated user changes and confirm the implementation did not create a branch, worktree, or delete files.\n\n## Verification matrix\n\n| Case | Expected result |\n|---|---|\n| Header fork, idle source | Preview uses fresh recap plus deterministic evidence; target is a new run; source is stopped. |\n| Header fork, active turn | Source is generation-fenced; durable sequence settles or warning is recorded; no late output owns target state. |\n| Message fork | Conversation is bounded at the message; current workspace drift is explicit; `forkedFromMessageId` is preserved. |\n| Resume CLI Session dialog | External resume still resumes an external provider session; current-conversation fork opens handoff flow. |\n| Quota, outgoing CLI dead | No outgoing request; synthetic packet launches a distinct target run. |\n| Quota, target unavailable | Source stays quota-waiting/recoverable; no target run is reported; named failure and surfaced error exist. |\n| Same-run text asks to switch CLI | Request is refused with fork guidance; source preferences/worker type do not change. |\n| Same-CLI model/account change | Existing supported recreation path still works inside the run. |\n| Already compacted source | Provider recap is advisory; post-compaction evidence and exact recent tail are included. |\n| Dirty workspace before session | Pre-existing files are not claimed as session-owned; uncertainty is preserved. |\n| Concurrent/external file change | Ownership becomes external/unknown; packet does not overwrite or silently attribute it. |\n| Packet overflow | Highest-priority facts remain; dropped fields are named; hash is deterministic. |\n| Reload while preview is ready | Active draft and revision restore from server; edits do not regress. |\n| Disconnect during launch | SSE replay/snapshot returns one target; repeated operation ID is idempotent. |\n| Delete source after completion | Source metadata/artifact is cleaned; target initial seed remains self-contained. |\n\n## Agentic user-journey candidates (approval required before running)\n\nThese browser journeys are valuable after automated tests/build pass, but they must not be run without explicit user approval because they create real local conversations and CLI activity:\n\n1. Start a Codex direct session, make a small edit, open the header handoff dialog, inspect/edit the packet, fork to Claude, verify the new sidebar session and source preservation, then clean up the test conversations/artifacts.\n2. Fork from an earlier user message and confirm the preview distinguishes historical conversation state from the current checkout.\n3. Simulate/induce a quota-waiting source through supported test controls, select cross-provider recovery, verify the synthetic packet and target navigation, then clean up.\n4. Reload the browser while a handoff preview is open and while launch is completing; verify restoration, SSE replay, and no duplicate target.\n\n## Implementation guardrails\n\n- Begin implementation by rechecking `git status --short`; the current worktree already contains user changes. Never overwrite, revert, or reformat unrelated edits.\n- Do not create a branch or worktree and do not delete any file.\n- Keep new logic out of `HomeApp.tsx`, `ConversationMain.tsx`, `runs/recovery.ts`, and `worker-failover.ts` except thin integration/delegation because all are already oversized.\n- Use `src/server/git/command.ts` or existing async helpers for git evidence; avoid synchronous shell calls in request paths.\n- Never log or emit the full packet in named events, errors, or ordinary server logs.\n- Never pass translated strings through transactions or persist translated UI copy.\n- Never treat an LLM-generated summary as proof that a file changed, a test passed, or a command ran.\n- Do not add configurable frontend strings/settings through `.env`; packet limits are code constants.\n- Clean up test conversations and persisted artifacts after any approved live/agentic validation.\n--- PLAN END ---"
}
````

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-08-20T18:04:33.774Z","phase":null} -->
## Claude state: queue-operation · 2026-08-20T18:04:33.774Z

```text
{
  "type": "queue-operation",
  "operation": "dequeue",
  "timestamp": "2026-08-20T18:04:33.774Z",
  "sessionId": "23684cf2-66e9-47ff-ada1-76c62f4558a0"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-08-20T18:04:33.807Z","phase":null} -->
## Claude attachment · 2026-08-20T18:04:33.807Z

```text
{
  "type": "plan_mode",
  "reminderType": "full",
  "isSubAgent": false,
  "planFilePath": "/Users/masterman/.claude/plans/you-are-a-read-only-happy-otter.md",
  "planExists": false
}

binary omitted from archive

uuid: d1e36092-e0df-499d-af9d-9acbb507d892
parent: f82312a5-dc0c-4123-901f-1bd21503aa16
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"user","timestamp":"2026-08-20T18:04:33.808Z","phase":null} -->
## User · 2026-08-20T18:04:33.808Z

You are a read-only senior architecture reviewer. Review the complete implementation plan below for an existing TypeScript/React/SQLite control-plane application.

Objective: identify concrete correctness gaps, race conditions, persistence/deletion problems, security/privacy risks, missing edge cases, contradictory sequencing, and tasks that are not implementation-ready. The non-negotiable product invariant is that switching CLI/provider always creates a new run; never switch CLI within one run. Same-CLI model/account recovery may remain in-run. The source and target share the current checkout, so the source must be fenced/stopped to prevent concurrent edits.

Judge only the artifact supplied below. You have no tools and must not request or assume repository access. Return exactly one of:

READY

or

HARDEN

If HARDEN, follow it with a concise prioritized numbered list of specific changes to make to this plan. Do not rewrite the plan and do not suggest unrelated features.

--- PLAN START ---

# Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax.

**Feature:** Cross-CLI Hybrid Handoff Fork

**Goal:** Let a user fork any direct-control conversation into a new session running on a different CLI, carrying a compact, inspectable hybrid handoff packet; use the same new-run mechanism when cross-provider quota recovery is selected, and make same-run cross-CLI switching impossible.

**Architecture:** A server-owned handoff coordinator freezes the source at a durable worker-stream sequence, gathers bounded deterministic evidence, optionally adds a semantic summary, compiles and persists a versioned packet, and launches a completely separate target run. SQLite stores lifecycle metadata; the append-only artifact store holds packet versions; the target worker stream receives the rendered packet as its first `user_input`. The source run is preserved as stopped history. Same-CLI model/account recovery may continue inside a run, but changing the CLI/provider always crosses a run boundary.

**Tech Stack:** TypeScript, React, TanStack Query, global Manager classes, Drizzle + SQLite, append-only JSONL artifacts, existing runtime HTTP registry/API adapters, named SSE events, Vitest, lifecycle HTTP/SSE scenarios, existing shadcn/ui primitives, and locale JSON files.

**North Star Product:** A user can move work between CLI ecosystems without pretending their provider sessions, recovery semantics, or transcripts are interchangeable. The new agent starts with the smallest trustworthy continuation context, the source remains auditable, and failures never strand or silently mutate either conversation.

**Current Milestone:** Ship cross-CLI handoff forks for direct/commit conversations from the session menu, an individual message, the existing Resume CLI Session dialog, and quota recovery. The packet is editable where it is advisory, inspectable after launch, bounded, redacted, restart-safe, and synthesized without contacting an exhausted provider when necessary.

**Future Product Direction:** Reuse the packet format for export/import and cross-device handoff only after this milestone proves the provenance, recovery, and deletion model. Do not add same-run CLI switching, background multi-agent continuation, or automatic worktree creation in this milestone.

**Final Functionality Standard:** Every cross-CLI transition creates a new run and target worker stream; no server path can recreate a worker under another CLI in the source run. The packet accurately identifies uncertainty and pre-existing workspace changes, survives a process restart, excludes secrets and hidden reasoning, and produces enough observability to explain every capture, launch, refusal, and failure.

---

## Product decisions and non-goals

1. **A CLI handoff is a fork, never a resume.** “Resume external session” keeps its existing meaning. “Fork current conversation to another CLI” creates a new OmniHarness run with `parentRunId` and an optional `forkedFromMessageId`.
2. **The source is historical after a successful launch.** Stop/fence its active worker, retain its transcript and artifacts, and select the target run in the UI. Do not keep two CLIs editing the same checkout concurrently.
3. **The packet is hybrid.** Deterministic state is authoritative; generated summaries and outgoing-agent reports are advisory. Current disk state wins over prose.
4. **Manual and quota paths share one coordinator.** Manual entry points offer a preview. A quota-triggered cross-provider handoff may launch without waiting for an exhausted CLI, then exposes the persisted packet for inspection.
5. **Only advisory content is user-editable.** The user may amend objective, status, next steps, blockers, notes, and relevant-file explanations. Source IDs, stream sequence, git evidence, verification records, target selection, provenance, and hash are server-owned.
6. **No full transcript or full diff by default.** The packet contains a short exact tail plus summaries, file-level evidence, and compact error/test output. The source run remains the place to inspect full history.
7. **No hidden reasoning.** Never copy `thought`, chain-of-thought, raw environment, credentials, authorization headers, binary attachments, or unrestricted tool output into a packet.
8. **No automatic worktree.** This feature uses the current checkout and avoids concurrency by stopping the source. Existing explicit worktree fork actions remain separate.
9. **No file deletion is part of this plan.** Refactor existing modules in place or add focused modules; preserve project history and user changes.

## User journeys

### Manual fork from the session

1. The user opens the session menu and selects **Fork to another CLI**.
2. The dialog defaults to a different available CLI and offers compatible account, model, and effort choices.
3. The server captures a stable source boundary and returns a compact preview with provenance and warnings.
4. The user may edit advisory notes, then launches.
5. OmniHarness validates the target, creates a new run, persists the packet as the target's initial user input, starts the selected CLI, stops the source, and selects the target in the sidebar.

### Fork from a message

1. The user chooses **Fork to another CLI from here** on a user message.
2. Candidate collection ignores superseded/later conversation entries but compares against the current workspace, explicitly warning when files contain changes made after the selected message.
3. The rest of the flow is the same as the manual session fork.

### Fork from Resume CLI Session

1. The existing dialog clearly separates **Resume external session** from **Fork current conversation**.
2. The fork option appears only with an eligible selected OmniHarness direct/commit run.
3. Choosing it opens the same handoff dialog, not a provider-session resume flow.

### Cross-provider quota recovery

1. A CLI reaches a durable quota-waiting state.
2. Same-provider account/model recovery may use existing same-CLI recovery.
3. If the selected strategy requires another CLI/provider, the server synthesizes a packet from persisted evidence and creates a new run.
4. The exhausted source is never prompted for a handoff and never receives a replacement worker of another type.
5. If no target can launch, the source remains visibly recoverable/quota-waiting and the error names the failed stage.

## Compact handoff packet contract

Create a versioned `HybridHandoffPacketV1` with the following logical shape. Use stable IDs and enums rather than translated labels.

```ts
type HybridHandoffPacketV1 = {
  handoffVersion: 1;
  source: {
    runId: string;
    workerId: string | null;
    workerType: SupportedWorkerType | null;
    forkedFromMessageId: string | null;
    sourceSeq: number | null;
    interruptionReason: "manual_session" | "manual_message" | "quota_exhausted";
    generatedAt: string;
  };
  target: {
    workerType: SupportedWorkerType;
    model: string | null;
    effort: string | null;
    accountId: string | null;
  };
  task: {
    originalRequest: string | null;
    currentObjective: string | null;
    acceptanceCriteria: string[];
    userConstraints: string[];
  };
  state: {
    completed: string[];
    inProgress: string[];
    remaining: string[];
    blockers: string[];
    openQuestions: string[];
    rejectedApproaches: Array<{ approach: string; reason: string }>;
  };
  decisions: Array<{ decision: string; reason: string | null; evidence: string[] }>;
  workspace: {
    projectPath: string;
    baselineCommit: string | null;
    currentHead: string | null;
    dirtyBeforeSession: boolean | null;
    modifiedFiles: Array<{
      path: string;
      changeType: "added" | "modified" | "deleted" | "renamed" | "unmerged";
      ownership: "session" | "probable_session" | "preexisting" | "external" | "unknown";
      summary: string | null;
      evidence: string[];
    }>;
    untrackedFiles: string[];
    relevantUnchangedFiles: string[];
    commitsCreated: string[];
  };
  verification: Array<{
    command: string;
    result: "passed" | "failed" | "unknown";
    exitCode: number | null;
    importantOutput: string | null;
  }>;
  artifacts: {
    plans: string[];
    specs: string[];
    generatedOutputs: string[];
  };
  continuity: {
    recentUserMessages: string[];
    recentAssistantSummary: string | null;
    pendingUserInput: string | null;
    queuedMessages: string[];
  };
  provenance: {
    summarySource: "outgoing_worker" | "recent_assistant" | "synthetic" | "hybrid";
    omittedSections: string[];
    confidenceWarnings: string[];
    truncatedFields: string[];
  };
};
```

Compilation rules:

- Set an explicit 36,000-character rendered-packet ceiling (roughly 6,000–10,000 tokens depending on content), plus per-field item and character limits. Keep the constants in code, not environment variables.
- Prioritize source identity and sequence, user constraints, current objective, blockers/errors, file evidence, verification, decisions, queued input, then recent conversational tail. Drop completed prose first.
- Stable-sort every deterministic collection so the same evidence yields the same packet and hash.
- Reuse a recent assistant recap only as advisory text. It is “fresh” only if its worker sequence is at or after the last included tool/result lifecycle boundary; otherwise include it with a stale-summary warning.
- Ask an outgoing worker for a structured report only when it is idle/responsive and not quota-blocked. Bound the request timeout. Never delay quota recovery on this call.
- For a hard interruption, synthesize entirely from the worker stream, execution events, messages/queued messages, run metadata, git evidence, and known artifacts.
- For a message fork, cap conversation candidates at that message/stream boundary while computing workspace state at capture time; call out the mismatch rather than claiming the checkout was rewound.
- Render advisory narrative inside an explicit untrusted-data boundary telling the target to verify disk state. Do not let tool/assistant text masquerade as system instructions.

## State machine and invariants

Persist these statuses: `capturing -> ready -> launching -> completed`, with terminal `failed` and `cancelled`. A `failed` capture/launch may be retried by creating a new revision or relaunching only when ownership still matches.

The coordinator owns an immutable launch fence:

```ts
{
  handoffId,
  revision,
  sourceRunId,
  sourceWorkerId,
  sourceSeq,
  targetSelectionHash
}
```

Server invariants:

- At most one nonterminal handoff exists for a source run.
- New messages, queued-message delivery, retry/edit recovery, manual resume, and quota wake refuse with `409 handoff_in_progress` while the source is fenced.
- Capture first interrupts/stops an active manual source through the existing turn-generation fence, then waits for persisted output to settle. Timeout uses the last durable sequence and records a confidence warning.
- Launch validates CLI availability, account/model compatibility, project path, source revision, and target selection before creating a plan/run.
- The target run and worker are created under the existing run/quota mutation controls. The rendered seed is persisted with `appendUserInputOnDelivery` in the target's unified worker stream before prompting the CLI.
- `launch` is idempotent. Repeating it with the same operation/revision returns the existing `targetRunId`; a stale revision gets `409 handoff_revision_conflict`.
- Mark `completed` only after target creation, target seed persistence, and worker launch acceptance. Then settle the source using existing stop/cancel terminal semantics.
- A target launch failure never manufactures success, never deletes the source, and never leaves an unobservable fence. Release or retain the fence according to a persisted recoverable status and emit the decision.
- Deleting the source removes its handoff metadata/artifact stream through existing run cleanup; the target remains independently understandable because its initial worker stream contains the rendered seed.
- Same-run recreation must reject a requested worker type different from the run's existing CLI. Model, effort, or account changes within the same CLI remain allowed where currently supported.

## File map

### Create

- `src/shared/handoff.ts` — packet, lifecycle, API DTO, edit-patch, and error-code contracts shared by server/client.
- `src/server/handoff/candidates.ts` — bounded candidate reads from unified worker streams, messages, queued messages, events, and artifacts.
- `src/server/handoff/workspace-state.ts` — read-only git baseline/current evidence and file ownership classification.
- `src/server/handoff/redaction.ts` — path-safe text normalization, secret/tool-output filtering, and size limits.
- `src/server/handoff/compiler.ts` — authoritative/advisory merge, priority budgeting, deterministic ordering, provenance, hash, and renderer input.
- `src/server/handoff/store.ts` — SQLite metadata and append-only packet-version persistence.
- `src/server/handoff/coordinator.ts` — capture/preview/edit/launch state machine, source fence, idempotency, and failure recovery.
- `src/server/runs/fork.ts` — extracted generic new-run fork creation used by legacy message forks and handoff launches.
- `src/server/events/handoff-events.ts` — focused named-event union for import into the existing event contract.
- `src/runtime/http/routes/handoffs.ts` — create/list/get/patch/launch HTTP handlers and validation.
- `src/interface/home/HandoffForkManager.ts` — single source of truth for dialog draft, server revision, request ownership, pending stages, and errors.
- `src/interface/home/HandoffForkDialog.tsx` — target picker, packet preview/editor, warnings, and launch result UI.
- `src/components/home/CliLaunchSelectionFields.tsx` — reusable CLI/account/model/effort controls for the handoff dialog without duplicating composer selection logic.
- `tests/server/handoff/compiler.test.ts` — packet priority, freshness, deterministic hash, truncation, and rendering tests.
- `tests/server/handoff/candidates.test.ts` — bounded stream/event/queued-message and message-boundary tests.
- `tests/server/handoff/workspace-state.test.ts` — baseline/current classification and path-safety tests.
- `tests/server/handoff/redaction.test.ts` — credentials, environment, hidden reasoning, malicious content, and byte-limit tests.
- `tests/server/handoff/store.test.ts` — revisions, active-handoff uniqueness, idempotency, and cascade tests.
- `tests/server/handoff/coordinator.test.ts` — state transitions, source fences, synthetic fallback, target failures, and launch idempotency.
- `tests/api/handoffs-route.test.ts` — route validation/auth/contract/error responses.
- `tests/app/handoff-fork-manager.test.ts` — stale-response ownership, retry, selection, and close/reopen behavior.
- `tests/ui/handoff-fork-dialog.test.tsx` — translated copy, accessibility, advisory-only editing, and responsive states.
- `tests/lifecycle/scenarios/cross-cli-handoff-fork.test.ts` — manual and quota cross-CLI lifecycle scenario over HTTP/SSE.
- `tests/lifecycle/scenarios/cross-cli-handoff-restart.test.ts` — restart, replay, idempotent launch, and deletion scenario.

### Modify

- `src/server/db/schema.ts` — add `conversationHandoffs` metadata table and indexes.
- `src/server/db/index.ts` — additive schema initialization/migration and database version bump.
- `src/server/artifacts/stream-types.ts` — add the `handoff_packets` run-level stream kind.
- `src/server/artifacts/append-only-store.ts` — map the new stream to `handoff-packets.jsonl`.
- `src/server/handoff/request.ts` — make the outgoing summary request reason-neutral, structured, bounded, and optional.
- `src/server/handoff/parser.ts` — parse advisory report fields into the versioned candidate contract without treating them as facts.
- `src/server/handoff/render.ts` — render the versioned packet and remove quota-only wording.
- `src/server/git/auto-commit.ts` — extract/reuse baseline parsing needed by read-only workspace evidence without synchronous shell work on the hot path.
- `src/server/runs/recovery.ts` — delegate legacy retry/edit/fork run creation to focused services; do not grow this 1,300+ line module.
- `src/server/supervisor/worker-failover.ts` — retain compatibility exports but route cross-CLI cases to the new-run handoff coordinator; do not spawn another CLI in the source run.
- `src/server/supervisor/index.ts` and `src/server/supervisor/wake.ts` — consume target-run outcomes and preserve quota recovery semantics across restart.
- `src/server/supervisor/observer.ts` — record pending cross-CLI handoff intent instead of only same-run failover intent.
- `src/server/conversations/send-message.ts` — reject text/composer-driven cross-CLI changes inside an existing run and preserve same-CLI model/account recreation only.
- `src/server/conversations/queued-messages.ts`, `src/server/conversations/queued-message-interrupt.ts`, `src/server/quota/worker-resume.ts`, and `src/server/runs/recovery-reconciler.ts` — enforce the persisted handoff fence before source mutation/recovery.
- `src/server/prompts/supervisor.md` — describe cross-provider recovery as a new-session handoff, not an in-session worker swap.
- `src/server/events/named-events.ts` — import the focused handoff event union, add stable surfaced error codes, and avoid embedding packet bodies in SSE.
- `src/runtime/http/routes/index.ts` — register handoff routes.
- `src/runtime-api/types.ts` and `src/runtime-api/domains/index.ts` — add typed `handoffs` operations.
- `src/interface/home/useHomeMutations.ts` — add query/mutations for preview, edit, launch, and active-draft lookup; switch selection only under matching request ownership.
- `src/interface/home/useConversationActions.ts` — route session/message cross-CLI actions into `HandoffForkManager`; retain ordinary same-run message retry/edit behavior.
- `src/interface/home/ExternalSessionsPicker.tsx` — separate external resume from the new current-conversation fork option.
- `src/components/home/HomeHeader.tsx` — add the session-level entry point.
- `src/components/home/ConversationMain.tsx` — add the per-message entry point through a small extracted action component or callback; do not grow this 1,600+ line file.
- `src/components/home/RunRecoveryNotice.tsx` — add quota handoff status/action and target-run navigation.
- `src/interface/home/HomeApp.tsx` — mount/wire the lazy dialog and manager only; move logic out of this 1,700+ line file.
- `src/interface/home/EventStreamStateManager.ts` and `src/interface/home/utils.ts` — reconcile handoff lifecycle events and target selection without optimistic run fabrication.
- `src/components/settings/ModelsSettingsPanel.tsx` — clarify that `cross_provider` opens a new handoff session while same-provider strategies stay in the current CLI.
- `shared/locales/*.json` — add every new visible label, description, warning, status, aria label, and error fallback to all locales.
- `tests/db/schema.test.ts`, `tests/supervisor/worker-failover*.test.ts`, `tests/api/conversation-messages-route.test.ts`, `tests/ui/conversation-actions.test.ts`, `tests/app/event-stream-state-manager.test.ts`, and route-contract tests — update existing expectations around the new-run invariant.
- `docs/architecture/lifecycle-observability-and-testing.md` — document handoff decisions/events and the source/target recovery model before adding server state transitions.
- `docs/architecture/worker-conversation-stream.md` — document that the target handoff seed is an ordinary first `user_input`, not a parallel transcript.
- `.gitignore` — verify packet temp/debug output cannot be tracked; add only a narrowly scoped ignore if implementation introduces a local debug artifact.

## API and persistence design

### SQLite metadata

Add `conversation_handoffs` with:

- `id` primary key.
- `source_run_id` foreign key to `runs` with `ON DELETE CASCADE`.
- `source_worker_id` nullable foreign key to `workers` with `ON DELETE SET NULL`.
- `target_run_id` nullable foreign key to `runs` with `ON DELETE SET NULL`.
- `forked_from_message_id`, `reason`, `status`, `revision`, `source_seq`.
- `target_worker_type`, `target_model`, `target_effort`, `target_account_id`, `target_selection_hash`.
- `packet_version`, `artifact_seq`, `packet_hash`, `packet_preview`, `summary_source`.
- `operation_id`, `last_error`, `created_at`, `updated_at`, `completed_at`.
- A unique partial index for one nonterminal handoff per source run, plus indexes for target run and status/update time.

Keep the full packet out of SQLite. Append every ready/revised packet as an `ArtifactRecordEnvelope<HybridHandoffPacketV1>` in the source run's `handoff_packets` stream and point metadata at the current sequence/hash. Store only a bounded, redacted preview for list/recovery UI.

### HTTP contract

- `POST /api/runs/:runId/handoffs` — create or return the active draft. Body: fork point, reason, and target selection. Returns `202 capturing` or `200 ready` with metadata/packet DTO.
- `GET /api/runs/:runId/handoffs?active=1` — restore a durable draft after reload.
- `GET /api/handoffs/:handoffId` — inspect the current packet/revision/result.
- `PATCH /api/handoffs/:handoffId` — patch advisory fields with `expectedRevision`; return `409` on stale revision.
- `POST /api/handoffs/:handoffId/launch` — idempotent launch with `expectedRevision`, `operationId`, and final target selection; return the target run/worker IDs.
- `POST /api/handoffs/:handoffId/cancel` — release an unlaunched manual draft fence. A completed handoff cannot be cancelled.

Return typed stage-specific errors. User-relevant failures also emit `error.surfaced` with stable codes such as `handoff.capture_failed`, `handoff.revision_conflict`, `handoff.target_unavailable`, `handoff.source_changed`, and `handoff.launch_failed`.

### Named events

Emit these via `emitNamedEvent` for every server decision:

- `handoff.capture_started`
- `handoff.packet_ready`
- `handoff.packet_revised`
- `handoff.launch_started`
- `handoff.completed`
- `handoff.cancelled`
- `handoff.failed`
- `handoff.refused`

Events carry IDs, revisions, stage, source/target IDs, target worker type, reason, and stable error code where relevant. They never carry the full packet. All event frames retain the existing SSE ID/replay/resync behavior.

## Implementation tasks

### Task 1: Freeze the cross-CLI invariant in tests and architecture docs

**Files:**
- Modify: `docs/architecture/lifecycle-observability-and-testing.md`
- Modify: `docs/architecture/worker-conversation-stream.md`
- Modify: `tests/api/conversation-messages-route.test.ts`
- Modify: `tests/supervisor/worker-failover.test.ts`
- Modify: `tests/supervisor/worker-failover-handoff-fails.test.ts`
- Modify: `tests/supervisor/worker-failover-spawn-retry.test.ts`
- Modify: `tests/supervisor/worker-failover-no-replacement.test.ts`

- [ ] Add architecture text stating that a CLI/provider change creates a new run, the target seed lives in its unified worker stream, and source/target ownership is never shared.
- [ ] Add a failing API test proving a follow-up request cannot change `preferredWorkerType` from the source worker type inside the same run.
- [ ] Replace same-run cross-provider failover expectations with failing expectations for a distinct target `runId`, source preservation, and no replacement worker of another type under the source run.
- [ ] Add a failing case for target-unavailable behavior that leaves the source quota-waiting/recoverable.
- [ ] Run `pnpm vitest run tests/api/conversation-messages-route.test.ts tests/supervisor/worker-failover.test.ts tests/supervisor/worker-failover-handoff-fails.test.ts tests/supervisor/worker-failover-spawn-retry.test.ts tests/supervisor/worker-failover-no-replacement.test.ts` and confirm the new assertions fail for the intended missing behavior.

### Task 2: Define the packet and lifecycle contracts

**Files:**
- Create: `src/shared/handoff.ts`
- Create: `tests/server/handoff/compiler.test.ts`
- Create: `tests/server/handoff/redaction.test.ts`

- [ ] Define V1 packet, provenance, lifecycle metadata, editable advisory patch, API request/response, and error-code types.
- [ ] Make authoritative versus advisory fields explicit in the types so PATCH cannot alter source/workspace/verification provenance.
- [ ] Add constants for total and per-field budgets, item counts, recent-tail bounds, and supported interruption reasons.
- [ ] Write failing tests for stable ordering, deterministic hashes, priority truncation, exact omission metadata, and rejection of unknown packet versions.
- [ ] Write failing redaction tests for common API keys/tokens, authorization headers, environment dumps, hidden-reasoning entries, absolute paths outside the project, control characters, and prompt-like tool output.
- [ ] Run `pnpm vitest run tests/server/handoff/compiler.test.ts tests/server/handoff/redaction.test.ts` and confirm failures are contractual rather than fixture errors.

### Task 3: Add durable metadata and packet artifact storage

**Files:**
- Modify: `src/server/db/schema.ts`
- Modify: `src/server/db/index.ts`
- Modify: `src/server/artifacts/stream-types.ts`
- Modify: `src/server/artifacts/append-only-store.ts`
- Create: `src/server/handoff/store.ts`
- Create: `tests/server/handoff/store.test.ts`
- Modify: `tests/db/schema.test.ts`

- [ ] Add the `conversation_handoffs` table, foreign keys, timestamps, revision, operation ID, bounded preview, and indexes described above using the repository's additive schema pattern.
- [ ] Increment `DB_SCHEMA_VERSION` and test initialization of old and fresh databases.
- [ ] Add the run-level `handoff_packets` stream and map it to `app-data/run-data/<runId>/handoff-packets.jsonl` through the artifact store.
- [ ] Implement transactional metadata transitions plus append/read of packet versions; never expose a metadata revision whose artifact append failed.
- [ ] Enforce one active handoff per source run and idempotent operation IDs.
- [ ] Test packet revision lookup, stale revision refusal, source deletion cascade, target deletion nulling, and no orphaned artifact metadata.
- [ ] Run `pnpm vitest run tests/server/handoff/store.test.ts tests/db/schema.test.ts`.

### Task 4: Gather bounded deterministic evidence

**Files:**
- Create: `src/server/handoff/candidates.ts`
- Create: `src/server/handoff/workspace-state.ts`
- Create: `src/server/handoff/redaction.ts`
- Modify: `src/server/git/auto-commit.ts`
- Create: `tests/server/handoff/candidates.test.ts`
- Create: `tests/server/handoff/workspace-state.test.ts`
- Modify: `tests/server/handoff/redaction.test.ts`

- [ ] Read worker content only through bounded `readWorkerEntriesTail`/`Since`/`Before` APIs and respect superseded sequence ranges.
- [ ] Gather original/current user requests, a small exact recent tail, latest assistant recap, queued messages, unresolved execution errors, verification commands/results, plan/spec/generated artifact paths, and the source sequence.
- [ ] For message forks, constrain conversational evidence to the selected message boundary.
- [ ] Parse `runs.gitBaselineJson`, current HEAD/status, diff stats, commit range, tool edit events, and relevant agent summaries into file ownership evidence.
- [ ] Classify file ownership conservatively; never claim session ownership from current git status alone. Preserve `unknown` and warnings.
- [ ] Normalize project-relative paths, omit file contents and raw diff hunks by default, and include only narrowly bounded hunks for unresolved conflicts/subtle incomplete edits.
- [ ] Test large streams, already-compacted history, deleted/renamed/untracked files, a dirty pre-session baseline, external concurrent edits, post-message workspace drift, malformed baselines, and non-git projects.
- [ ] Run `pnpm vitest run tests/server/handoff/candidates.test.ts tests/server/handoff/workspace-state.test.ts tests/server/handoff/redaction.test.ts`.

### Task 5: Compile and render the hybrid packet

**Files:**
- Create: `src/server/handoff/compiler.ts`
- Modify: `src/server/handoff/request.ts`
- Modify: `src/server/handoff/parser.ts`
- Modify: `src/server/handoff/render.ts`
- Modify: `tests/server/handoff/compiler.test.ts`
- Modify: existing tests under `tests/server/handoff/`

- [ ] Implement deterministic merging where collected facts override advisory summaries and every conflict becomes a confidence warning.
- [ ] Detect fresh recent assistant recaps using worker/event sequence evidence.
- [ ] Update the outgoing request to return only structured task/state/decision/file explanations; use a short timeout and skip it for quota-blocked or busy workers.
- [ ] Preserve the existing synthetic fallback, but feed it through the same candidates/compiler/redaction pipeline.
- [ ] Enforce the packet budget by priority, populate `omittedSections`/`truncatedFields`, and hash the canonical representation.
- [ ] Render a concise target prompt with objective, state, decisions, workspace, verification, pending input, uncertainty, and an explicit instruction to inspect current files before acting.
- [ ] Ensure quota wording is a reason field, not hard-coded into all handoffs.
- [ ] Test clean completed turns, mid-turn interruption, hard quota interruption, already-compacted history, short sessions, stale summaries, malicious advisory content, and overflow.
- [ ] Run `pnpm vitest run tests/server/handoff`.

### Task 6: Extract safe new-run fork creation

**Files:**
- Create: `src/server/runs/fork.ts`
- Modify: `src/server/runs/recovery.ts`
- Modify: `tests/api/run-route.test.ts`
- Modify: `tests/ui/conversation-actions.test.ts`

- [ ] Extract plan/run/message-copy creation from the existing `recoverRun(... action: "fork")` branch without changing retry/edit semantics.
- [ ] Accept an explicit target worker type/model/effort/account/allowed-types selection and copy `preferredWorkerAccountId`, which the current fork path can omit.
- [ ] Preserve `parentRunId`, `forkedFromMessageId`, project path, git baseline/workspace metadata, auto-commit preferences, and the selected message prefix.
- [ ] Separate “create target” from “stop source”; the handoff coordinator controls ordering so a failed target validation cannot cancel the source first.
- [ ] Keep existing ordinary and worktree fork behavior passing; do not create a worktree for cross-CLI handoff.
- [ ] Add rollback/cleanup for a target plan/run created before worker launch fails, using existing recoverable cleanup conventions without deleting user files.
- [ ] Run `pnpm vitest run tests/api/run-route.test.ts tests/ui/conversation-actions.test.ts`.

### Task 7: Build the server coordinator and source fence

**Files:**
- Create: `src/server/handoff/coordinator.ts`
- Create: `tests/server/handoff/coordinator.test.ts`
- Modify: `src/server/conversations/queued-messages.ts`
- Modify: `src/server/conversations/queued-message-interrupt.ts`
- Modify: `src/server/quota/worker-resume.ts`
- Modify: `src/server/runs/recovery-reconciler.ts`

- [ ] Implement capture, revise, launch, cancel, retry, and restore transitions over the persisted metadata/store.
- [ ] Acquire the per-run mutation fence and reject a second active handoff.
- [ ] On manual capture, interrupt active delivery with the existing worker turn-generation fence, wait for durable stream stabilization, and record a warning on timeout.
- [ ] Stop queued delivery and preserve undelivered messages as packet continuity data.
- [ ] Validate target CLI/account/model/effort before target run creation.
- [ ] Create the target run, persist rendered seed with `appendUserInputOnDelivery`, start the target worker, then settle the source as stopped/cancelled history.
- [ ] Implement launch idempotency and stale source-sequence/revision refusal.
- [ ] Gate send, queue, retry/edit, resume, wake, and reconciler mutations while a handoff owns the source.
- [ ] Test races: send versus capture, capture versus quota wake, double launch, cancel versus launch, worker output after interrupt, target spawn failure, restart at every status, and source/target deletion.
- [ ] Run `pnpm vitest run tests/server/handoff/coordinator.test.ts tests/server/quota/worker-resume.test.ts tests/server/runs/recovery-reconciler.test.ts`.

### Task 8: Expose typed HTTP/runtime APIs and observability

**Files:**
- Create: `src/server/events/handoff-events.ts`
- Modify: `src/server/events/named-events.ts`
- Create: `src/runtime/http/routes/handoffs.ts`
- Modify: `src/runtime/http/routes/index.ts`
- Modify: `src/runtime-api/types.ts`
- Modify: `src/runtime-api/domains/index.ts`
- Create: `tests/api/handoffs-route.test.ts`
- Modify: route registry/contract tests under `tests/runtime/` and `tests/api/`

- [ ] Add the named handoff events and stable `error.surfaced` codes without growing `named-events.ts` with full implementation logic.
- [ ] Register authenticated create/list/get/patch/launch/cancel routes and validate all IDs, enums, revisions, and selection fields.
- [ ] Return `202` for in-progress capture, `409` for ownership/revision conflicts, `422` for incompatible target selection, and stage-specific `5xx` errors only for actual server failures.
- [ ] Add typed runtime APIs; do not route handoffs through `runs.act` with `unknown` bodies.
- [ ] Ensure no HTTP or SSE response includes secrets, raw packet artifacts when only metadata is needed, or untranslated visible server prose at the UI boundary.
- [ ] Test auth, malformed input, unsupported source mode, same-CLI target refusal, stale revision, replayed operation ID, packet retrieval, and surfaced error event payloads.
- [ ] Run `pnpm vitest run tests/api/handoffs-route.test.ts tests/runtime`.

### Task 9: Replace every same-run cross-CLI path

**Files:**
- Modify: `src/server/conversations/send-message.ts`
- Modify: `src/server/supervisor/worker-failover.ts`
- Modify: `src/server/supervisor/index.ts`
- Modify: `src/server/supervisor/wake.ts`
- Modify: `src/server/supervisor/observer.ts`
- Modify: `src/server/prompts/supervisor.md`
- Modify: `src/server/credits/index.ts`
- Modify: `src/components/settings/ModelsSettingsPanel.tsx`
- Modify: `tests/api/conversation-messages-route.test.ts`
- Modify: `tests/supervisor/worker-failover*.test.ts`

- [ ] In `applyWorkerPreferenceForMessage`/`reconcileDirectWorkerSelection`, reject a type change for an existing run with a typed “fork required” result; do not persist the new preferred type and do not defer it for later recreation.
- [ ] Keep same-CLI model, effort, and account recreation behavior and its current ownership fencing.
- [ ] Route cross-provider quota strategy/allowed-worker selection to `coordinator.captureAndLaunch` and return `targetRunId` rather than a replacement worker ID.
- [ ] Keep the existing `worker-failover.ts` exports as compatibility wrappers while callers/tests migrate; do not delete the file.
- [ ] Update wake/restart recovery to continue a persisted handoff rather than retrying a same-run provider spawn.
- [ ] Update supervisor prompt and settings explanation to say cross-provider recovery creates a new session.
- [ ] Rename user-visible lifecycle copy from “switching workers” to handoff/fork language while retaining legacy event parsing only where backward compatibility needs it.
- [ ] Run the focused API/supervisor/quota suites and assert no source run contains workers of two CLI types.

### Task 10: Build the client Manager and dialog

**Files:**
- Create: `src/interface/home/HandoffForkManager.ts`
- Create: `src/interface/home/HandoffForkDialog.tsx`
- Create: `src/components/home/CliLaunchSelectionFields.tsx`
- Modify: `src/interface/home/useHomeMutations.ts`
- Create: `tests/app/handoff-fork-manager.test.ts`
- Create: `tests/ui/handoff-fork-dialog.test.tsx`
- Modify: `shared/locales/*.json`

- [ ] Implement a Manager-owned state machine for closed/selecting/capturing/ready/editing/launching/completed/error, including source run/message IDs, revision, target selection, packet, warnings, and request token.
- [ ] Use TanStack Query only for transport/cache; the Manager is the single UI source of truth and ignores responses whose ownership token no longer matches.
- [ ] Build an accessible, responsive dialog using existing Dialog/Select/Textarea/Button/ScrollArea/Alert/Badge primitives.
- [ ] Default to the last compatible *different* CLI, exclude the source CLI, and validate account/model/effort combinations before capture/launch.
- [ ] Show authoritative sections read-only, advisory fields editable, source/provenance/warnings visible, and an explicit “current files win” note.
- [ ] Debounce or explicitly save advisory edits with `expectedRevision`; disable launch until the current edit revision is acknowledged.
- [ ] Allow recovery of the active durable draft after reload and a clear cancel action before launch.
- [ ] Add all visible/aria/error strings to every `shared/locales/*.json` file and subscribe with `useI18nSnapshot()`.
- [ ] Test keyboard focus, escape/cancel, mobile sizing, loading/error/retry states, stale edit conflicts, CLI exclusion, and no hard-coded user-facing JSX.
- [ ] Run `pnpm vitest run tests/app/handoff-fork-manager.test.ts tests/ui/handoff-fork-dialog.test.tsx`.

### Task 11: Wire every product entry point

**Files:**
- Modify: `src/interface/home/useConversationActions.ts`
- Modify: `src/interface/home/ExternalSessionsPicker.tsx`
- Modify: `src/components/home/HomeHeader.tsx`
- Modify: `src/components/home/ConversationMain.tsx`
- Modify: `src/components/home/RunRecoveryNotice.tsx`
- Modify: `src/interface/home/HomeApp.tsx`
- Modify: `tests/ui/conversation-actions.test.ts`
- Modify: `tests/server/external-sessions/discovery.test.ts`
- Modify: `shared/locales/*.json`

- [ ] Add **Fork to another CLI** to the session menu for eligible direct/commit runs.
- [ ] Add **Fork to another CLI from here** to user-message actions and pass the exact message ID.
- [ ] Add a distinct current-conversation fork choice to Resume CLI Session without changing external Claude/Gemini resume behavior.
- [ ] Add a quota notice action/status that opens or navigates to the automatic handoff and target run.
- [ ] Keep `HomeApp.tsx` as wiring only and extract any message-action UI needed to avoid growing oversized components.
- [ ] On success, select the target only if the user is still viewing the source associated with the completed request; otherwise show a non-destructive notification/link.
- [ ] Preserve ordinary “Fork session” semantics if it remains same-CLI, and make the cross-CLI wording unambiguous.
- [ ] Test eligibility, source/message payloads, no selected run, unsupported modes, selection races, external resume regression, and quota CTA behavior.
- [ ] Run `pnpm vitest run tests/ui/conversation-actions.test.ts tests/server/external-sessions/discovery.test.ts`.

### Task 12: Reconcile SSE, restart, and lifecycle recovery

**Files:**
- Modify: `src/interface/home/EventStreamStateManager.ts`
- Modify: `src/interface/home/utils.ts`
- Modify: `tests/app/event-stream-state-manager.test.ts`
- Create: `tests/lifecycle/scenarios/cross-cli-handoff-fork.test.ts`
- Create: `tests/lifecycle/scenarios/cross-cli-handoff-restart.test.ts`

- [ ] Reconcile capture/revision/launch/completion/failure events into existing run snapshots without creating optimistic fake runs.
- [ ] Fetch snapshot/active handoff after `stream.resync_required`; treat SSE as an invalidation signal and HTTP/SQLite as authority.
- [ ] Add a manual lifecycle scenario covering source activity, stable capture, packet artifact, target run/worker/seed, source stop, and no mixed CLI types.
- [ ] Add a quota scenario where the outgoing worker cannot answer, synthetic capture succeeds, and the target new run continues.
- [ ] Add restart checkpoints after `capturing`, `ready`, and `launching`; prove recovery either finishes once or surfaces a retryable failure without duplicate targets.
- [ ] Add FK/delete coverage: deleting the source removes its packet metadata/artifact while the target's seed remains readable.
- [ ] Validate every decision through `/api/events/log?since=<id>&runId=<id>` and assert named refusal/failure events exist.
- [ ] Run the focused state-manager test, then `pnpm test:lifecycle`.

### Task 13: Full verification and handoff documentation

**Files:**
- Modify only as failures require within the files already listed.
- Verify: `.gitignore`

- [ ] Re-read both architecture docs and confirm every new server decision emits a named event and every user-relevant failure emits a stable `error.surfaced` code.
- [ ] Verify every target seed was persisted through `appendUserInputOnDelivery` and no parallel conversation storage was introduced.
- [ ] Verify all visible strings use `t()` and all locale files contain the same new keys.
- [ ] Verify packet storage, test databases, generated debug packets, CLI transcripts, credentials, and temporary review output are not accidentally tracked; make only a narrow `.gitignore` addition if needed.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm vitest run`.
- [ ] Run `pnpm test:lifecycle`.
- [ ] Run the mandatory frontend build: `pnpm build:interface:web`.
- [ ] Inspect `git diff --check` and `git status --short`; preserve unrelated user changes and confirm the implementation did not create a branch, worktree, or delete files.

## Verification matrix

| Case | Expected result |
|---|---|
| Header fork, idle source | Preview uses fresh recap plus deterministic evidence; target is a new run; source is stopped. |
| Header fork, active turn | Source is generation-fenced; durable sequence settles or warning is recorded; no late output owns target state. |
| Message fork | Conversation is bounded at the message; current workspace drift is explicit; `forkedFromMessageId` is preserved. |
| Resume CLI Session dialog | External resume still resumes an external provider session; current-conversation fork opens handoff flow. |
| Quota, outgoing CLI dead | No outgoing request; synthetic packet launches a distinct target run. |
| Quota, target unavailable | Source stays quota-waiting/recoverable; no target run is reported; named failure and surfaced error exist. |
| Same-run text asks to switch CLI | Request is refused with fork guidance; source preferences/worker type do not change. |
| Same-CLI model/account change | Existing supported recreation path still works inside the run. |
| Already compacted source | Provider recap is advisory; post-compaction evidence and exact recent tail are included. |
| Dirty workspace before session | Pre-existing files are not claimed as session-owned; uncertainty is preserved. |
| Concurrent/external file change | Ownership becomes external/unknown; packet does not overwrite or silently attribute it. |
| Packet overflow | Highest-priority facts remain; dropped fields are named; hash is deterministic. |
| Reload while preview is ready | Active draft and revision restore from server; edits do not regress. |
| Disconnect during launch | SSE replay/snapshot returns one target; repeated operation ID is idempotent. |
| Delete source after completion | Source metadata/artifact is cleaned; target initial seed remains self-contained. |

## Agentic user-journey candidates (approval required before running)

These browser journeys are valuable after automated tests/build pass, but they must not be run without explicit user approval because they create real local conversations and CLI activity:

1. Start a Codex direct session, make a small edit, open the header handoff dialog, inspect/edit the packet, fork to Claude, verify the new sidebar session and source preservation, then clean up the test conversations/artifacts.
2. Fork from an earlier user message and confirm the preview distinguishes historical conversation state from the current checkout.
3. Simulate/induce a quota-waiting source through supported test controls, select cross-provider recovery, verify the synthetic packet and target navigation, then clean up.
4. Reload the browser while a handoff preview is open and while launch is completing; verify restoration, SSE replay, and no duplicate target.

## Implementation guardrails

- Begin implementation by rechecking `git status --short`; the current worktree already contains user changes. Never overwrite, revert, or reformat unrelated edits.
- Do not create a branch or worktree and do not delete any file.
- Keep new logic out of `HomeApp.tsx`, `ConversationMain.tsx`, `runs/recovery.ts`, and `worker-failover.ts` except thin integration/delegation because all are already oversized.
- Use `src/server/git/command.ts` or existing async helpers for git evidence; avoid synchronous shell calls in request paths.
- Never log or emit the full packet in named events, errors, or ordinary server logs.
- Never pass translated strings through transactions or persist translated UI copy.
- Never treat an LLM-generated summary as proof that a file changed, a test passed, or a command ran.
- Do not add configurable frontend strings/settings through `.env`; packet limits are code constants.
- Clean up test conversations and persisted artifacts after any approved live/agentic validation.
--- PLAN END ---

uuid: f82312a5-dc0c-4123-901f-1bd21503aa16

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-08-20T18:06:15.716Z","phase":null} -->
## Claude thinking · 2026-08-20T18:06:15.716Z



uuid: 26465770-8a66-4355-9254-951825ccbf84
parent: d1e36092-e0df-499d-af9d-9acbb507d892

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-08-20T18:06:57.117Z","phase":null} -->
## Claude · 2026-08-20T18:06:57.117Z

HARDEN

## Prioritized changes

1. **Fix the launch ordering — it violates the stated concurrency invariant.** Task 7 and the state-machine section say "create the target run, persist the seed, start the target worker, *then* settle the source." That opens a window where the source worker and the target worker are both live against the same checkout. Restructure launch into three phases: (a) validate target selection + source revision (no mutation); (b) terminate the source worker and confirm it is dead; (c) create the target run, persist the seed, start the target worker. Task 6's "a failed target validation cannot cancel the source first" is satisfied by phase (a), and no longer justifies deferring the stop.

2. **Specify source termination as process-level, bounded, and confirmed.** "Interrupt through the existing turn-generation fence" only stops turn generation; it does not guarantee the CLI process has stopped writing files. Define: interrupt → wait for durable stream settle with an explicit bounded timeout constant → force-terminate → verify process exit (or verify no worker PID for the source run) before phase (c). If exit cannot be confirmed, refuse the launch with `handoff.source_changed`/`handoff.launch_failed` rather than starting the target.

3. **Make the fence workspace-scoped, not only run-scoped.** "At most one nonterminal handoff per source run" does not prevent two different runs sharing the same `projectPath` from forking concurrently, nor a target run being immediately used as a source (fork chains). Add a project-path-scoped guard on launch and state the policy for runs whose `projectPath` already has another live worker.

4. **Define source-drift policy for the manual preview window.** The fence captures `sourceSeq`, but a user can hold the dialog open while late worker output, auto-commit, or external edits advance the stream and HEAD. Specify: on launch, re-read durable seq and git HEAD/dirty state; if either differs from the fence, either refuse with `handoff.source_changed` and require re-capture, or auto-revise the packet — pick one and make it consistent across manual and quota paths. Also recapture workspace evidence *after* source termination (step 1b), since stopping the source can itself move HEAD via auto-commit.

5. **Make restart recovery of `launching` non-duplicating by construction.** `operationId` is client-supplied, but quota-triggered launches have no client. Require a server-generated claim token persisted in `conversation_handoffs` *before* any target run is created, and stamp the target run row with the `handoffId` so a crash between run creation and metadata update is discoverable. Add a startup reconciler step that adopts or terminalizes such orphans; the current plan only tests restart checkpoints without specifying the mechanism that makes them safe.

6. **Resolve the `failed`-is-terminal contradiction.** The plan calls `failed` terminal, then allows retry "by creating a new revision or relaunching," which conflicts with the unique partial index over nonterminal statuses. Decide explicitly: retry creates a new handoff row (recommended), or `failed` is a recoverable non-terminal status excluded from the index. State which statuses the partial index covers.

7. **Prevent permanent fence leaks.** Add (a) a staleness policy — TTL or supervisor heartbeat that terminalizes `capturing`/`launching` rows abandoned by a crashed process and emits `handoff.failed`; (b) cancel must work for quota-initiated handoffs too, not only "unlaunched manual drafts"; (c) a cancel/clear affordance reachable from the run UI (`RunRecoveryNotice`), not only from a dialog whose client state is lost on reload.

8. **Handle target deletion while the handoff is nonterminal.** `target_run_id ON DELETE SET NULL` leaves a `launching` row with no target, occupying the uniqueness slot and fencing the source forever. Deleting a target must terminalize its handoff and release the fence.

9. **The packet hash cannot be deterministic as specified.** `source.generatedAt` is inside the packet, yet the plan promises "the same evidence yields the same packet and hash." Define the hash over a canonical serialization (fixed key order, NFC normalization) that excludes volatile fields (`generatedAt`, and any target-selection fields that change between revisions if they are meant to be hash-stable).

10. **Harden the seed against prompt injection at the delivery boundary.** The rendered packet is persisted as an ordinary `user_input`, which grants source-derived tool/assistant text the authority of a user instruction. Specify a structural boundary: a per-packet nonce-fenced block, with the fence token escaped/stripped from all embedded advisory content, and add a redaction test for fence/delimiter-injection and for content that imitates system or tool-result framing. "Render inside an explicit untrusted-data boundary" is currently prose, not a testable mechanism.

11. **Pin the redaction pipeline order and widen its scope.** State that redaction runs before budgeting, hashing, preview extraction, and event emission, and that it applies to the *rendered string* as well as structured fields. Explicitly cover `verification[].importantOutput`, `state.blockers`, `decisions[].evidence`, and the outgoing worker's advisory report. Also resolve the contradiction between `workspace.projectPath: string` (absolute, leaks home dir/username) and the rule to strip absolute paths — define whether it is stored raw server-side and redacted at the API/event boundary.

12. **Add loop and exhaustion guards to the quota path.** Nothing prevents the target provider hitting quota and triggering a handoff back, producing fork chains. Add a chain-depth limit (walk `parentRunId`/handoff lineage), a cooldown excluding recently exhausted providers/accounts, and validation that the *target account* is not itself quota-blocked before launch. Add a verification-matrix row for it.

13. **Resolve the message-prefix contradiction.** Task 6 says the fork preserves "the selected message prefix," while the architecture says the target's first stream entry is the rendered packet seed. For cross-CLI handoff, transcripts are explicitly not interchangeable — state that no source messages are copied into the target and that `fork.ts` takes a flag controlling prefix copy, used only by the legacy same-CLI fork path.

14. **Define the terminal disposition of the source's queued messages.** Task 7 says delivery is stopped and undelivered messages are carried into `continuity.queuedMessages`, but not what happens to the persisted rows. If they remain pending, resuming or reconciling the source later can double-execute them. Require marking them superseded/cancelled with a handoff reason, and assert it in the coordinator tests.

15. **Define target rollback precisely.** Task 6 adds "rollback/cleanup for a target plan/run created before worker launch fails," while the guardrails say no deletion. State whether a failed launch leaves a visible empty target run marked failed (recommended, matching the append-only/no-deletion posture) or removes the plan/run, and make the launch-failure path in Task 7 and the verification matrix agree.

16. **Scope the flat handoff routes by ownership.** `GET/PATCH/POST /api/handoffs/:handoffId` are not run-scoped; "authenticated" is not sufficient. Require resolving the handoff to its source run and checking the caller's access to that run, and add an IDOR case to `tests/api/handoffs-route.test.ts`.

17. **Enforce the cross-CLI invariant at a single choke point.** Editing `send-message.ts`, `worker-failover.ts`, `worker-resume.ts`, `recovery-reconciler.ts`, `wake.ts`, and `recovery.ts` individually leaves the invariant re-breakable by any future call site. Add an assertion inside the worker-creation/spawn function itself: reject any requested worker type differing from the run's existing worker type, emit `handoff.refused`, and test it directly.

18. **Close the not-implementation-ready items.** `src/server/credits/index.ts` appears in Task 9's file list with no corresponding step and is absent from the File map — either specify the change or drop it. Replace vague targets ("existing tests under `tests/server/handoff/`", "route registry/contract tests under `tests/runtime/` and `tests/api/`") with named files. Also state the migration/compat policy for any already-persisted pre-V1 handoff payloads produced by the existing `request.ts`/`parser.ts`/`render.ts`, since Task 2 requires rejecting unknown packet versions.

19. **Fix Task 1 sequencing.** Task 1 lands failing tests that stay red until Task 9, which will break the focused suites Tasks 3–8 ask you to run green. Either mark them skipped/`.todo` with a note to enable in Task 9, or move the failover expectation rewrites into Task 9 and keep only the doc changes in Task 1.

20. **Name the source's terminal status and the source→target link.** "Settle the source as stopped/cancelled history" is ambiguous and affects sidebar/recovery rendering. Pick one status, and add a durable source→target pointer for navigation that survives the handoff row (which is CASCADE-deleted with the source) — currently only `parentRunId` on the target exists, so "navigate to target" from a quota notice depends on a row that may be gone.

uuid: dd788a6a-8621-4d23-8653-48dc2d77069e
parent: 26465770-8a66-4355-9254-951825ccbf84

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-08-20T18:11:52.799Z","phase":null} -->
## Claude state: queue-operation · 2026-08-20T18:11:52.799Z

````text
{
  "type": "queue-operation",
  "operation": "enqueue",
  "timestamp": "2026-08-20T18:11:52.799Z",
  "sessionId": "23684cf2-66e9-47ff-ada1-76c62f4558a0",
  "content": "I revised the plan against all material findings: confirmed source process exit before target creation; workspace lease; post-stop capture and launch drift refusal; persisted server claim/originHandoffId/reconciler; terminal-failure retry semantics; expiry/cancel/target-delete fence release; canonical hash and nonce-fenced seed; redaction order/path privacy; quota loop guards; no source transcript copy; queued-row cancellation; visible failed target; IDOR checks; central direct/commit assertion plus SQLite trigger; exact test paths; green task sequencing; and explicit source statuses.\n\nRe-review the complete updated artifact below. Judge only the supplied artifact and return exactly READY, or HARDEN followed by only remaining concrete blockers. Do not repeat resolved findings or suggest unrelated features.\n\n--- UPDATED PLAN START ---\n\n# Feature Implementation Plan\n\n> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax.\n\n**Feature:** Cross-CLI Hybrid Handoff Fork\n\n**Goal:** Let a user fork any direct-control conversation into a new session running on a different CLI, carrying a compact, inspectable hybrid handoff packet; use the same new-run mechanism when cross-provider quota recovery is selected, and make same-run cross-CLI switching impossible.\n\n**Architecture:** A server-owned handoff coordinator freezes the source at a durable worker-stream sequence, gathers bounded deterministic evidence, optionally adds a semantic summary, compiles and persists a versioned packet, and launches a completely separate target run. SQLite stores lifecycle metadata; the append-only artifact store holds packet versions; the target worker stream receives the rendered packet as its first `user_input`. The source run is preserved as stopped history. Same-CLI model/account recovery may continue inside a run, but changing the CLI/provider always crosses a run boundary.\n\n**Tech Stack:** TypeScript, React, TanStack Query, global Manager classes, Drizzle + SQLite, append-only JSONL artifacts, existing runtime HTTP registry/API adapters, named SSE events, Vitest, lifecycle HTTP/SSE scenarios, existing shadcn/ui primitives, and locale JSON files.\n\n**North Star Product:** A user can move work between CLI ecosystems without pretending their provider sessions, recovery semantics, or transcripts are interchangeable. The new agent starts with the smallest trustworthy continuation context, the source remains auditable, and failures never strand or silently mutate either conversation.\n\n**Current Milestone:** Ship cross-CLI handoff forks for direct/commit conversations from the session menu, an individual message, the existing Resume CLI Session dialog, and quota recovery. The packet is editable where it is advisory, inspectable after launch, bounded, redacted, restart-safe, and synthesized without contacting an exhausted provider when necessary.\n\n**Future Product Direction:** Reuse the packet format for export/import and cross-device handoff only after this milestone proves the provenance, recovery, and deletion model. Do not add same-run CLI switching, background multi-agent continuation, or automatic worktree creation in this milestone.\n\n**Final Functionality Standard:** Every cross-CLI transition creates a new run and target worker stream; no server path can recreate a worker under another CLI in the source run. The packet accurately identifies uncertainty and pre-existing workspace changes, survives a process restart, excludes secrets and hidden reasoning, and produces enough observability to explain every capture, launch, refusal, and failure.\n\n---\n\n## Product decisions and non-goals\n\n1. **A CLI handoff is a fork, never a resume.** “Resume external session” keeps its existing meaning. “Fork current conversation to another CLI” creates a new OmniHarness run with `parentRunId` and an optional `forkedFromMessageId`.\n2. **The source is historical after a successful launch.** Before target creation, terminate the source CLI process and confirm it exited. On success set the source run to `cancelled`, retain its transcript and artifacts, and select the target run in the UI. If target launch fails after source termination, set the source to `needs_recovery` with an explicit retry path. Never keep two CLIs editing the same checkout concurrently.\n3. **The packet is hybrid.** Deterministic state is authoritative; generated summaries and outgoing-agent reports are advisory. Current disk state wins over prose.\n4. **Manual and quota paths share one coordinator.** Manual entry points offer a preview. A quota-triggered cross-provider handoff may launch without waiting for an exhausted CLI, then exposes the persisted packet for inspection.\n5. **Only advisory content is user-editable.** The user may amend objective, status, next steps, blockers, notes, and relevant-file explanations. Source IDs, stream sequence, git evidence, verification records, target selection, provenance, and hash are server-owned.\n6. **No full transcript or full diff by default.** The packet contains a short exact tail plus summaries, file-level evidence, and compact error/test output. The source run remains the place to inspect full history.\n7. **No hidden reasoning.** Never copy `thought`, chain-of-thought, raw environment, credentials, authorization headers, binary attachments, or unrestricted tool output into a packet.\n8. **No automatic worktree.** This feature uses the current checkout and avoids concurrency by stopping the source. Existing explicit worktree fork actions remain separate.\n9. **No file deletion is part of this plan.** Refactor existing modules in place or add focused modules; preserve project history and user changes.\n\n## User journeys\n\n### Manual fork from the session\n\n1. The user opens the session menu and selects **Fork to another CLI**.\n2. The dialog defaults to a different available CLI and offers compatible account, model, and effort choices.\n3. The server captures a stable source boundary and returns a compact preview with provenance and warnings.\n4. The user may edit advisory notes, then launches.\n5. OmniHarness validates the target, creates a new run, persists the packet as the target's initial user input, starts the selected CLI, stops the source, and selects the target in the sidebar.\n\n### Fork from a message\n\n1. The user chooses **Fork to another CLI from here** on a user message.\n2. Candidate collection ignores superseded/later conversation entries but compares against the current workspace, explicitly warning when files contain changes made after the selected message.\n3. The rest of the flow is the same as the manual session fork.\n\n### Fork from Resume CLI Session\n\n1. The existing dialog clearly separates **Resume external session** from **Fork current conversation**.\n2. The fork option appears only with an eligible selected OmniHarness direct/commit run.\n3. Choosing it opens the same handoff dialog, not a provider-session resume flow.\n\n### Cross-provider quota recovery\n\n1. A CLI reaches a durable quota-waiting state.\n2. Same-provider account/model recovery may use existing same-CLI recovery.\n3. If the selected strategy requires another CLI/provider, the server synthesizes a packet from persisted evidence and creates a new run.\n4. The exhausted source is never prompted for a handoff and never receives a replacement worker of another type.\n5. If no target can launch, the source remains visibly recoverable/quota-waiting and the error names the failed stage.\n\n## Compact handoff packet contract\n\nCreate a versioned `HybridHandoffPacketV1` with the following logical shape. Use stable IDs and enums rather than translated labels.\n\n```ts\ntype HybridHandoffPacketV1 = {\n  handoffVersion: 1;\n  source: {\n    runId: string;\n    workerId: string | null;\n    workerType: SupportedWorkerType | null;\n    forkedFromMessageId: string | null;\n    sourceSeq: number | null;\n    interruptionReason: \"manual_session\" | \"manual_message\" | \"quota_exhausted\";\n    generatedAt: string;\n  };\n  target: {\n    workerType: SupportedWorkerType;\n    model: string | null;\n    effort: string | null;\n    accountId: string | null;\n  };\n  task: {\n    originalRequest: string | null;\n    currentObjective: string | null;\n    acceptanceCriteria: string[];\n    userConstraints: string[];\n  };\n  state: {\n    completed: string[];\n    inProgress: string[];\n    remaining: string[];\n    blockers: string[];\n    openQuestions: string[];\n    rejectedApproaches: Array<{ approach: string; reason: string }>;\n  };\n  decisions: Array<{ decision: string; reason: string | null; evidence: string[] }>;\n  workspace: {\n    projectRootLabel: string;\n    baselineCommit: string | null;\n    currentHead: string | null;\n    dirtyBeforeSession: boolean | null;\n    modifiedFiles: Array<{\n      path: string;\n      changeType: \"added\" | \"modified\" | \"deleted\" | \"renamed\" | \"unmerged\";\n      ownership: \"session\" | \"probable_session\" | \"preexisting\" | \"external\" | \"unknown\";\n      summary: string | null;\n      evidence: string[];\n    }>;\n    untrackedFiles: string[];\n    relevantUnchangedFiles: string[];\n    commitsCreated: string[];\n  };\n  verification: Array<{\n    command: string;\n    result: \"passed\" | \"failed\" | \"unknown\";\n    exitCode: number | null;\n    importantOutput: string | null;\n  }>;\n  artifacts: {\n    plans: string[];\n    specs: string[];\n    generatedOutputs: string[];\n  };\n  continuity: {\n    recentUserMessages: string[];\n    recentAssistantSummary: string | null;\n    pendingUserInput: string | null;\n    queuedMessages: string[];\n  };\n  provenance: {\n    summarySource: \"outgoing_worker\" | \"recent_assistant\" | \"synthetic\" | \"hybrid\";\n    omittedSections: string[];\n    confidenceWarnings: string[];\n    truncatedFields: string[];\n  };\n};\n```\n\nCompilation rules:\n\n- Set an explicit 36,000-character rendered-packet ceiling (roughly 6,000–10,000 tokens depending on content), plus per-field item and character limits. Keep the constants in code, not environment variables.\n- Prioritize source identity and sequence, user constraints, current objective, blockers/errors, file evidence, verification, decisions, queued input, then recent conversational tail. Drop completed prose first.\n- Stable-sort every deterministic collection so the same redacted nonvolatile evidence yields the same semantic content hash; `generatedAt` may differ without changing that hash.\n- Reuse a recent assistant recap only as advisory text. It is “fresh” only if its worker sequence is at or after the last included tool/result lifecycle boundary; otherwise include it with a stale-summary warning.\n- Ask an outgoing worker for a structured report only when it is idle/responsive and not quota-blocked. Bound the request timeout. Never delay quota recovery on this call.\n- For a hard interruption, synthesize entirely from the worker stream, execution events, messages/queued messages, run metadata, git evidence, and known artifacts.\n- For a message fork, cap conversation candidates at that message/stream boundary while computing workspace state at capture time; call out the mismatch rather than claiming the checkout was rewound.\n- Render advisory narrative inside an explicit untrusted-data boundary telling the target to verify disk state. Do not let tool/assistant text masquerade as system instructions.\n- Run redaction before budgeting, canonicalization, hashing, preview extraction, rendering, logging, or event emission. Apply it to every structured text field and to the final rendered seed, including verification output, blockers, decision evidence, queued text, and outgoing-worker reports.\n- Keep the absolute `projectPath` only in server-side run/handoff metadata for access and launch checks. The packet/API uses a non-sensitive `projectRootLabel` such as the repository directory name; all file evidence is project-relative.\n- Hash the NFC-normalized, fixed-key-order canonical packet while excluding only volatile `generatedAt`. Target selection remains hash input, so changing it creates a new hash/revision.\n- Render untrusted content inside a randomly generated, high-entropy nonce fence created after sanitization. Reject/regenerate a nonce that occurs in content, encode the interior as canonical JSON, and test delimiter/system/tool-frame imitation. The renderer's nonce is not part of the semantic packet hash.\n\n## State machine and invariants\n\nPersist these statuses: `capturing -> ready -> launching -> completed`, with terminal `failed` and `cancelled`. Only `capturing`, `ready`, and `launching` are nonterminal and covered by active-handoff uniqueness. Retrying a terminal failure always creates a new handoff row linked to the failed attempt; it never resurrects the terminal row.\n\nThe coordinator owns an immutable launch fence:\n\n```ts\n{\n  handoffId,\n  revision,\n  sourceRunId,\n  sourceWorkerId,\n  sourceSeq,\n  workspaceFingerprint,\n  targetSelectionHash\n}\n```\n\nServer invariants:\n\n- At most one nonterminal handoff exists for a source run and normalized project path. A persistent workspace lease plus an in-process keyed mutex serializes capture/launch; every other OmniHarness mutation path for a run sharing that project refuses while the lease is active. Before capture, also refuse when another live run already owns a worker in the same checkout.\n- New messages, queued-message delivery, retry/edit recovery, manual resume, quota wake, auto-commit, and reconciler actions refuse with `409 handoff_in_progress` while the source workspace is fenced.\n- Opening the dialog is read-only. The explicit **Prepare handoff** action acquires the lease, advances the existing turn-generation fence, requests graceful interruption, waits up to a named stream-settle timeout, terminates the source CLI process, and confirms process exit/no live runtime ownership. If termination cannot be confirmed, fail capture and do not create a target.\n- After confirmed source termination, set the source run to `needs_recovery` with handoff-stage details, then capture the final durable worker sequence and git HEAD/status/workspace fingerprint. This post-stop state is what the packet describes. `ready`/`launching` live on the handoff row, not as new run statuses.\n- Launch first validates CLI availability, target account/model/effort compatibility, quota state, project path, source revision, and target selection without mutating source or target. It then re-reads the durable sequence and workspace fingerprint. Any drift refuses with `handoff.source_changed` and requires a new capture/preview; it never silently auto-revises a packet the user already reviewed.\n- The target run and worker are created under the existing run/quota mutation controls. The rendered seed is persisted with `appendUserInputOnDelivery` in the target's unified worker stream before prompting the CLI.\n- `launch` is idempotent. Persist a server-generated launch claim token and expiry before target creation, and stamp the target `runs.originHandoffId` before worker creation. Repeating the operation returns the discovered existing `targetRunId`; a stale revision gets `409 handoff_revision_conflict`.\n- A startup reconciler finds expired `capturing`/`launching` claims, discovers targets by `originHandoffId`, adopts the one target or terminalizes the attempt, releases the workspace fence, and emits the exact decision. There is never more than one target per handoff.\n- Mark `completed` only after target creation, target seed persistence, and worker launch acceptance. Set the already-terminated source run to `cancelled`, mark carried queued messages `cancelled` with a `cross_cli_handoff` reason, and persist the source-to-target link in the completed handoff row.\n- A target launch failure never manufactures success and never deletes persisted rows. Mark any partially created target run `failed` and visible for diagnosis, set the source run to `needs_recovery`, release the workspace fence, and emit the decision.\n- Cancellation applies to manual and quota-created nonlaunching handoffs. The dialog and `RunRecoveryNotice` both expose it. Expired claims are failed by the reconciler so a crashed client/server cannot leak a permanent fence.\n- Deleting the source removes its handoff metadata/artifact stream through existing run cleanup; the target remains independently understandable because its initial worker stream contains the rendered seed.\n- Deleting a target while its handoff is nonterminal first terminalizes the handoff and releases the source/workspace fence; `ON DELETE SET NULL` is not relied on as lifecycle logic.\n- Same-run recreation must reject a requested worker type different from an existing direct/commit run's CLI. Enforce this in a shared spawn assertion and a SQLite `BEFORE INSERT` safety trigger, not only at callers. Model, effort, or account changes within the same CLI remain allowed where currently supported. Supervisor implementation runs retain their intentional multi-worker behavior.\n- Automatic quota handoff walks handoff/parent lineage. Refuse after `MAX_AUTOMATIC_HANDOFF_DEPTH = 3`, exclude providers/accounts exhausted in the last two handoffs, enforce a cooldown, and verify the target account has no open quota incident before source termination.\n\n## File map\n\n### Create\n\n- `src/shared/handoff.ts` — packet, lifecycle, API DTO, edit-patch, and error-code contracts shared by server/client.\n- `src/server/handoff/candidates.ts` — bounded candidate reads from unified worker streams, messages, queued messages, events, and artifacts.\n- `src/server/handoff/workspace-state.ts` — read-only git baseline/current evidence and file ownership classification.\n- `src/server/handoff/redaction.ts` — path-safe text normalization, secret/tool-output filtering, and size limits.\n- `src/server/handoff/compiler.ts` — authoritative/advisory merge, priority budgeting, deterministic ordering, provenance, hash, and renderer input.\n- `src/server/handoff/store.ts` — SQLite metadata and append-only packet-version persistence.\n- `src/server/handoff/coordinator.ts` — capture/preview/edit/launch state machine, source fence, idempotency, and failure recovery.\n- `src/server/handoff/reconciler.ts` — startup/heartbeat recovery for expired capture/launch claims and orphan target adoption.\n- `src/server/runs/fork.ts` — extracted generic new-run fork creation used by legacy message forks and handoff launches.\n- `src/server/workers/direct-run-type-invariant.ts` — central direct/commit worker-type assertion used before worker insertion; emits typed refusal.\n- `src/server/events/handoff-events.ts` — focused named-event union for import into the existing event contract.\n- `src/runtime/http/routes/handoffs.ts` — create/list/get/patch/launch HTTP handlers and validation.\n- `src/interface/home/HandoffForkManager.ts` — single source of truth for dialog draft, server revision, request ownership, pending stages, and errors.\n- `src/interface/home/HandoffForkDialog.tsx` — target picker, packet preview/editor, warnings, and launch result UI.\n- `src/components/home/CliLaunchSelectionFields.tsx` — reusable CLI/account/model/effort controls for the handoff dialog without duplicating composer selection logic.\n- `tests/server/handoff/compiler.test.ts` — packet priority, freshness, deterministic hash, truncation, and rendering tests.\n- `tests/server/handoff/candidates.test.ts` — bounded stream/event/queued-message and message-boundary tests.\n- `tests/server/handoff/workspace-state.test.ts` — baseline/current classification and path-safety tests.\n- `tests/server/handoff/redaction.test.ts` — credentials, environment, hidden reasoning, malicious content, and byte-limit tests.\n- `tests/server/handoff/store.test.ts` — revisions, active-handoff uniqueness, idempotency, and cascade tests.\n- `tests/server/handoff/coordinator.test.ts` — state transitions, source fences, synthetic fallback, target failures, and launch idempotency.\n- `tests/server/handoff/reconciler.test.ts` — expired claim, orphan target adoption, target deletion, and fence-release tests.\n- `tests/server/workers/direct-run-type-invariant.test.ts` — application assertion and SQLite trigger safety-net tests.\n- `tests/api/handoffs-route.test.ts` — route validation/auth/contract/error responses.\n- `tests/app/handoff-fork-manager.test.ts` — stale-response ownership, retry, selection, and close/reopen behavior.\n- `tests/ui/handoff-fork-dialog.test.tsx` — translated copy, accessibility, advisory-only editing, and responsive states.\n- `tests/lifecycle/scenarios/cross-cli-handoff-fork.test.ts` — manual and quota cross-CLI lifecycle scenario over HTTP/SSE.\n- `tests/lifecycle/scenarios/cross-cli-handoff-restart.test.ts` — restart, replay, idempotent launch, and deletion scenario.\n\n### Modify\n\n- `src/server/db/schema.ts` — add `conversationHandoffs` metadata table and indexes.\n- `src/server/db/index.ts` — additive schema initialization/migration and database version bump.\n- `src/server/artifacts/stream-types.ts` — add the `handoff_packets` run-level stream kind.\n- `src/server/artifacts/append-only-store.ts` — map the new stream to `handoff-packets.jsonl`.\n- `src/server/handoff/request.ts` — make the outgoing summary request reason-neutral, structured, bounded, and optional.\n- `src/server/handoff/parser.ts` — parse advisory report fields into the versioned candidate contract without treating them as facts.\n- `src/server/handoff/render.ts` — render the versioned packet and remove quota-only wording.\n- `src/server/git/auto-commit.ts` — extract/reuse baseline parsing needed by read-only workspace evidence without synchronous shell work on the hot path.\n- `src/server/runs/recovery.ts` — delegate legacy retry/edit/fork run creation to focused services; do not grow this 1,300+ line module.\n- `src/server/supervisor/worker-failover.ts` — retain compatibility exports but route cross-CLI cases to the new-run handoff coordinator; do not spawn another CLI in the source run.\n- `src/server/supervisor/index.ts` and `src/server/supervisor/wake.ts` — consume target-run outcomes and preserve quota recovery semantics across restart.\n- `src/server/supervisor/observer.ts` — record pending cross-CLI handoff intent instead of only same-run failover intent.\n- `src/server/conversations/send-message.ts` — reject text/composer-driven cross-CLI changes inside an existing run and preserve same-CLI model/account recreation only.\n- `src/server/conversations/create.ts`, `src/server/supervisor/index.ts`, `src/server/planning/review.ts`, and `src/server/runs/recovery.ts` — call the central direct/commit worker-type assertion before worker insertion; supervisor implementation multi-worker behavior remains allowed.\n- `src/server/conversations/queued-messages.ts`, `src/server/conversations/queued-message-interrupt.ts`, `src/server/quota/worker-resume.ts`, and `src/server/runs/recovery-reconciler.ts` — enforce the persisted handoff fence before source mutation/recovery.\n- `src/server/prompts/supervisor.md` — describe cross-provider recovery as a new-session handoff, not an in-session worker swap.\n- `src/server/credits/index.ts` — make `cross_provider` return a target CLI/account candidate for the handoff coordinator rather than mutating the source worker account.\n- `src/server/events/named-events.ts` — import the focused handoff event union, add stable surfaced error codes, and avoid embedding packet bodies in SSE.\n- `src/runtime/http/routes/index.ts` — register handoff routes.\n- `src/runtime-api/types.ts` and `src/runtime-api/domains/index.ts` — add typed `handoffs` operations.\n- `src/interface/home/useHomeMutations.ts` — add query/mutations for preview, edit, launch, and active-draft lookup; switch selection only under matching request ownership.\n- `src/interface/home/useConversationActions.ts` — route session/message cross-CLI actions into `HandoffForkManager`; retain ordinary same-run message retry/edit behavior.\n- `src/interface/home/ExternalSessionsPicker.tsx` — separate external resume from the new current-conversation fork option.\n- `src/components/home/HomeHeader.tsx` — add the session-level entry point.\n- `src/components/home/ConversationMain.tsx` — add the per-message entry point through a small extracted action component or callback; do not grow this 1,600+ line file.\n- `src/components/home/RunRecoveryNotice.tsx` — add quota handoff status/action and target-run navigation.\n- `src/interface/home/HomeApp.tsx` — mount/wire the lazy dialog and manager only; move logic out of this 1,700+ line file.\n- `src/interface/home/EventStreamStateManager.ts` and `src/interface/home/utils.ts` — reconcile handoff lifecycle events and target selection without optimistic run fabrication.\n- `src/components/settings/ModelsSettingsPanel.tsx` — clarify that `cross_provider` opens a new handoff session while same-provider strategies stay in the current CLI.\n- `shared/locales/*.json` — add every new visible label, description, warning, status, aria label, and error fallback to all locales.\n- `tests/db/schema.test.ts`, `tests/supervisor/worker-failover.test.ts`, `tests/supervisor/worker-failover-handoff-fails.test.ts`, `tests/supervisor/worker-failover-spawn-retry.test.ts`, `tests/supervisor/worker-failover-no-replacement.test.ts`, `tests/api/conversation-messages-route.test.ts`, `tests/ui/conversation-actions.test.ts`, `tests/app/event-stream-state-manager.test.ts`, `tests/runtime/http-registry.test.ts`, `tests/runtime/http-routes.test.ts`, `tests/runtime/route-contract-fixture.test.ts`, and `tests/runtime/fixtures/routes.v1.json` — update existing expectations around the new-run invariant.\n- `docs/architecture/lifecycle-observability-and-testing.md` — document handoff decisions/events and the source/target recovery model before adding server state transitions.\n- `docs/architecture/worker-conversation-stream.md` — document that the target handoff seed is an ordinary first `user_input`, not a parallel transcript.\n- `.gitignore` — verify packet temp/debug output cannot be tracked; add only a narrowly scoped ignore if implementation introduces a local debug artifact.\n\n## API and persistence design\n\n### SQLite metadata\n\nAdd `conversation_handoffs` with:\n\n- `id` primary key.\n- `source_run_id` foreign key to `runs` with `ON DELETE CASCADE`.\n- `source_worker_id` nullable foreign key to `workers` with `ON DELETE SET NULL`.\n- `target_run_id` nullable foreign key to `runs` with `ON DELETE SET NULL`.\n- `forked_from_message_id`, `reason`, `status`, `revision`, `source_seq`, `normalized_project_path`, and `workspace_fingerprint`.\n- `target_worker_type`, `target_model`, `target_effort`, `target_account_id`, `target_selection_hash`.\n- `packet_version`, `artifact_seq`, `packet_hash`, `packet_preview`, `summary_source`.\n- `operation_id`, `launch_claim_token`, `claim_expires_at`, `retry_of_handoff_id`, `last_error`, `created_at`, `updated_at`, and `completed_at`.\n- Unique partial indexes for one `capturing|ready|launching` handoff per source run and normalized project path, plus indexes for target run, claim expiry, and status/update time.\n\nAdd nullable `runs.origin_handoff_id` and index it. It is written in the same transaction as target run creation, deliberately has no cascading foreign key, and lets restart recovery discover a target even if the process died before `conversation_handoffs.target_run_id` was updated.\n\nKeep the full packet out of SQLite. Append every ready/revised packet as an `ArtifactRecordEnvelope<HybridHandoffPacketV1>` in the source run's `handoff_packets` stream and point metadata at the current sequence/hash. Store only a bounded, redacted preview for list/recovery UI.\n\n### HTTP contract\n\n- `POST /api/runs/:runId/handoffs` — create or return the active draft. Body: fork point, reason, and target selection. Returns `202 capturing` or `200 ready` with metadata/packet DTO.\n- `GET /api/runs/:runId/handoffs?active=1` — restore a durable draft after reload.\n- `GET /api/handoffs/:handoffId` — inspect the current packet/revision/result.\n- `PATCH /api/handoffs/:handoffId` — patch advisory fields with `expectedRevision`; return `409` on stale revision.\n- `POST /api/handoffs/:handoffId/launch` — idempotent launch with `expectedRevision`, `operationId`, and final target selection; return the target run/worker IDs.\n- `POST /api/handoffs/:handoffId/cancel` — release any nonlaunching manual or quota draft fence. A launching/completed handoff cannot be cancelled; the reconciler owns abandoned launch claims.\n\nEvery flat `/api/handoffs/:handoffId` handler must resolve the source run and apply the same project/run authorization check as run-scoped endpoints before reading or mutating anything. Include an IDOR test using an authenticated caller without access to the source project. Cancellation covers every nonlaunching manual or quota draft.\n\nThere are no persisted V0 packet artifacts to migrate: the existing parser/request/render path produces ephemeral reports only. Treat those reports as advisory candidates when creating V1. If a future/unknown artifact version is encountered, retain it on disk, refuse to render it, surface `handoff.packet_version_unsupported`, and require a fresh V1 capture.\n\nReturn typed stage-specific errors. User-relevant failures also emit `error.surfaced` with stable codes such as `handoff.capture_failed`, `handoff.revision_conflict`, `handoff.target_unavailable`, `handoff.source_changed`, and `handoff.launch_failed`.\n\n### Named events\n\nEmit these via `emitNamedEvent` for every server decision:\n\n- `handoff.capture_started`\n- `handoff.packet_ready`\n- `handoff.packet_revised`\n- `handoff.launch_started`\n- `handoff.completed`\n- `handoff.cancelled`\n- `handoff.failed`\n- `handoff.refused`\n\nEvents carry IDs, revisions, stage, source/target IDs, target worker type, reason, and stable error code where relevant. They never carry the full packet. All event frames retain the existing SSE ID/replay/resync behavior.\n\n## Implementation tasks\n\n### Task 1: Document the invariant and preserve a green baseline\n\n**Files:**\n- Modify: `docs/architecture/lifecycle-observability-and-testing.md`\n- Modify: `docs/architecture/worker-conversation-stream.md`\n\n- [ ] Add architecture text stating that a CLI/provider change creates a new run, the target seed lives in its unified worker stream, and source/target ownership is never shared.\n- [ ] Record the three-phase ordering: validate target; terminate/confirm source and capture final state; create/prompt target. Document the `cancelled` success state and `needs_recovery` post-stop failure state.\n- [ ] Record workspace lease, drift refusal, packet redaction/untrusted-boundary, restart claim, and named-event requirements before implementing state transitions.\n- [ ] Run the existing baseline without changing its expectations: `pnpm vitest run tests/api/conversation-messages-route.test.ts tests/supervisor/worker-failover.test.ts tests/supervisor/worker-failover-handoff-fails.test.ts tests/supervisor/worker-failover-spawn-retry.test.ts tests/supervisor/worker-failover-no-replacement.test.ts`.\n\n### Task 2: Define the packet and lifecycle contracts\n\n**Files:**\n- Create: `src/shared/handoff.ts`\n- Create: `tests/server/handoff/compiler.test.ts`\n- Create: `tests/server/handoff/redaction.test.ts`\n\n- [ ] Define V1 packet, provenance, lifecycle metadata, editable advisory patch, API request/response, and error-code types.\n- [ ] Make authoritative versus advisory fields explicit in the types so PATCH cannot alter source/workspace/verification provenance.\n- [ ] Add constants for total and per-field budgets, item counts, recent-tail bounds, and supported interruption reasons.\n- [ ] Write failing tests for stable ordering, NFC/fixed-key canonicalization, a content hash that excludes only `generatedAt`, priority truncation, exact omission metadata, and rejection of unknown packet versions.\n- [ ] Write failing redaction/render-boundary tests for common API keys/tokens, authorization headers, environment dumps, hidden-reasoning entries, absolute paths outside the project, control characters, nonce/delimiter injection, and content imitating system/tool-result framing.\n- [ ] Run `pnpm vitest run tests/server/handoff/compiler.test.ts tests/server/handoff/redaction.test.ts` and confirm failures are contractual rather than fixture errors.\n\n### Task 3: Add durable metadata and packet artifact storage\n\n**Files:**\n- Modify: `src/server/db/schema.ts`\n- Modify: `src/server/db/index.ts`\n- Modify: `src/server/artifacts/stream-types.ts`\n- Modify: `src/server/artifacts/append-only-store.ts`\n- Create: `src/server/handoff/store.ts`\n- Create: `tests/server/handoff/store.test.ts`\n- Modify: `tests/db/schema.test.ts`\n\n- [ ] Add the `conversation_handoffs` table, `runs.originHandoffId`, foreign keys, normalized workspace key, timestamps, revision, operation/claim/expiry fields, bounded preview, and exact partial indexes described above using the repository's additive schema pattern.\n- [ ] Increment `DB_SCHEMA_VERSION` and test initialization of old and fresh databases.\n- [ ] Add the run-level `handoff_packets` stream and map it to `app-data/run-data/<runId>/handoff-packets.jsonl` through the artifact store.\n- [ ] Implement transactional metadata transitions plus append/read of packet versions; never expose a metadata revision whose artifact append failed.\n- [ ] Enforce one active handoff per source run and normalized project path, idempotent operation IDs, and target discovery by `originHandoffId`.\n- [ ] Test packet revision lookup, stale revision refusal, source deletion cascade, target deletion terminalization/fence release, expired claim lookup, and no orphaned artifact metadata.\n- [ ] Run `pnpm vitest run tests/server/handoff/store.test.ts tests/db/schema.test.ts`.\n\n### Task 4: Gather bounded deterministic evidence\n\n**Files:**\n- Create: `src/server/handoff/candidates.ts`\n- Create: `src/server/handoff/workspace-state.ts`\n- Create: `src/server/handoff/redaction.ts`\n- Modify: `src/server/git/auto-commit.ts`\n- Create: `tests/server/handoff/candidates.test.ts`\n- Create: `tests/server/handoff/workspace-state.test.ts`\n- Modify: `tests/server/handoff/redaction.test.ts`\n\n- [ ] Read worker content only through bounded `readWorkerEntriesTail`/`Since`/`Before` APIs and respect superseded sequence ranges.\n- [ ] Gather original/current user requests, a small exact recent tail, latest assistant recap, queued messages, unresolved execution errors, verification commands/results, plan/spec/generated artifact paths, and the source sequence.\n- [ ] For message forks, constrain conversational evidence to the selected message boundary.\n- [ ] Parse `runs.gitBaselineJson`, current HEAD/status, diff stats, commit range, tool edit events, and relevant agent summaries into file ownership evidence.\n- [ ] Classify file ownership conservatively; never claim session ownership from current git status alone. Preserve `unknown` and warnings.\n- [ ] Normalize project-relative paths, keep raw absolute project paths server-only, omit file contents and raw diff hunks by default, and include only narrowly bounded hunks for unresolved conflicts/subtle incomplete edits.\n- [ ] Redact every candidate before budgeting, hashing, previewing, rendering, logging, or event emission; perform a final redaction pass over the rendered seed.\n- [ ] Test large streams, already-compacted history, deleted/renamed/untracked files, a dirty pre-session baseline, external concurrent edits, post-message workspace drift, malformed baselines, and non-git projects.\n- [ ] Run `pnpm vitest run tests/server/handoff/candidates.test.ts tests/server/handoff/workspace-state.test.ts tests/server/handoff/redaction.test.ts`.\n\n### Task 5: Compile and render the hybrid packet\n\n**Files:**\n- Create: `src/server/handoff/compiler.ts`\n- Modify: `src/server/handoff/request.ts`\n- Modify: `src/server/handoff/parser.ts`\n- Modify: `src/server/handoff/render.ts`\n- Modify: `tests/server/handoff/compiler.test.ts`\n- Modify: `tests/server/handoff/parser.test.ts`\n\n- [ ] Implement deterministic merging where collected facts override advisory summaries and every conflict becomes a confidence warning.\n- [ ] Detect fresh recent assistant recaps using worker/event sequence evidence.\n- [ ] Update the outgoing request to return only structured task/state/decision/file explanations; use a short timeout and skip it for quota-blocked or busy workers.\n- [ ] Preserve the existing synthetic fallback, but feed it through the same candidates/compiler/redaction pipeline.\n- [ ] Enforce the packet budget by priority, populate `omittedSections`/`truncatedFields`, and hash the redacted canonical representation excluding only `generatedAt`.\n- [ ] Render a concise target prompt with objective, state, decisions, workspace, verification, pending input, uncertainty, and an explicit instruction to inspect current files before acting. Place canonical JSON inside a post-sanitization random nonce fence and ensure embedded text cannot close or imitate the boundary.\n- [ ] Ensure quota wording is a reason field, not hard-coded into all handoffs.\n- [ ] Test clean completed turns, mid-turn interruption, hard quota interruption, already-compacted history, short sessions, stale summaries, malicious advisory content, and overflow.\n- [ ] Run `pnpm vitest run tests/server/handoff/compiler.test.ts tests/server/handoff/redaction.test.ts tests/server/handoff/parser.test.ts`.\n\n### Task 6: Extract safe new-run fork creation\n\n**Files:**\n- Create: `src/server/runs/fork.ts`\n- Modify: `src/server/runs/recovery.ts`\n- Modify: `tests/api/run-route.test.ts`\n- Modify: `tests/ui/conversation-actions.test.ts`\n\n- [ ] Extract plan/run/message-copy creation from the existing `recoverRun(... action: \"fork\")` branch without changing retry/edit semantics.\n- [ ] Accept an explicit target worker type/model/effort/account/allowed-types selection and copy `preferredWorkerAccountId`, which the current fork path can omit.\n- [ ] Preserve `parentRunId`, `forkedFromMessageId`, project path, git baseline/workspace metadata, and auto-commit preferences. Add `copyMessagePrefix: boolean`: legacy same-CLI forks use `true`; cross-CLI handoffs use `false` so the rendered packet is the target's only initial conversation entry.\n- [ ] Keep target preflight validation separate from target creation. The coordinator performs source termination and post-stop capture between preflight and target creation.\n- [ ] Keep existing ordinary and worktree fork behavior passing; do not create a worktree for cross-CLI handoff.\n- [ ] On worker launch failure, retain the partially created plan/run as a visible `failed` diagnostic record stamped with `originHandoffId`; do not delete it or claim launch succeeded.\n- [ ] Run `pnpm vitest run tests/api/run-route.test.ts tests/ui/conversation-actions.test.ts`.\n\n### Task 7: Build the server coordinator and source fence\n\n**Files:**\n- Create: `src/server/handoff/coordinator.ts`\n- Create: `src/server/handoff/reconciler.ts`\n- Create: `tests/server/handoff/coordinator.test.ts`\n- Create: `tests/server/handoff/reconciler.test.ts`\n- Modify: `src/server/conversations/queued-messages.ts`\n- Modify: `src/server/conversations/queued-message-interrupt.ts`\n- Modify: `src/server/quota/worker-resume.ts`\n- Modify: `src/server/runs/recovery-reconciler.ts`\n\n- [ ] Implement capture, revise, launch, cancel, retry, and restore transitions over the persisted metadata/store.\n- [ ] Acquire the persisted normalized-workspace lease plus in-process workspace mutex; reject another active handoff or any other live worker already using that checkout.\n- [ ] On explicit prepare/capture, advance turn generation, request graceful interruption, wait up to the named stream-settle timeout, terminate the CLI process, and confirm exit/no runtime ownership. Refuse before target creation if confirmation fails.\n- [ ] After process exit, recapture the final durable sequence, HEAD/status/workspace fingerprint, and packet. On launch, re-read them and refuse drift with `handoff.source_changed` plus recapture guidance.\n- [ ] Stop queued delivery, preserve undelivered messages in continuity, and atomically mark their source rows `cancelled` with `cross_cli_handoff` after successful launch so they cannot execute twice.\n- [ ] Validate target CLI/account/model/effort/quota state and automatic handoff chain/cooldown limits before source termination.\n- [ ] Persist a server claim token/expiry, create the stamped target run, persist rendered seed with `appendUserInputOnDelivery`, and start the target only after source process exit was confirmed.\n- [ ] On success set source run `cancelled`; on post-stop target failure set source `needs_recovery`, leave any partial target visible as `failed`, and release the workspace fence.\n- [ ] Implement launch idempotency, stale source-sequence/revision/workspace refusal, and a startup/heartbeat reconciler that adopts targets by `originHandoffId` or fails expired claims.\n- [ ] Gate send, queue, retry/edit, resume, wake, auto-commit, and reconciler mutations for every run sharing a leased workspace.\n- [ ] Handle target deletion by terminalizing a nonterminal handoff and releasing its fence before `ON DELETE SET NULL` runs.\n- [ ] Test races: another live run in the checkout, send versus capture, capture versus quota wake, double launch, cancel versus launch, process refusing to exit, late output, workspace/HEAD drift, target spawn failure, claim expiry, orphan adoption, restart at every status, queued-message cancellation, and source/target deletion.\n- [ ] Run `pnpm vitest run tests/server/handoff/coordinator.test.ts tests/server/handoff/reconciler.test.ts tests/server/quota/worker-resume.test.ts tests/server/runs/recovery-reconciler.test.ts`.\n\n### Task 8: Expose typed HTTP/runtime APIs and observability\n\n**Files:**\n- Create: `src/server/events/handoff-events.ts`\n- Modify: `src/server/events/named-events.ts`\n- Create: `src/runtime/http/routes/handoffs.ts`\n- Modify: `src/runtime/http/routes/index.ts`\n- Modify: `src/runtime-api/types.ts`\n- Modify: `src/runtime-api/domains/index.ts`\n- Create: `tests/api/handoffs-route.test.ts`\n- Modify: `tests/runtime/http-registry.test.ts`\n- Modify: `tests/runtime/http-routes.test.ts`\n- Modify: `tests/runtime/route-contract-fixture.test.ts`\n- Modify: `tests/runtime/fixtures/routes.v1.json`\n\n- [ ] Add the named handoff events and stable `error.surfaced` codes without growing `named-events.ts` with full implementation logic.\n- [ ] Register create/list/get/patch/launch/cancel routes; resolve flat handoff IDs through the source run's authorization scope before returning data, and validate all IDs, enums, revisions, and selection fields.\n- [ ] Return `202` for in-progress capture, `409` for ownership/revision conflicts, `422` for incompatible target selection, and stage-specific `5xx` errors only for actual server failures.\n- [ ] Add typed runtime APIs; do not route handoffs through `runs.act` with `unknown` bodies.\n- [ ] Ensure no HTTP or SSE response includes secrets, raw packet artifacts when only metadata is needed, or untranslated visible server prose at the UI boundary.\n- [ ] Test auth/IDOR, malformed input, unsupported source mode, same-CLI target refusal, stale revision, replayed operation ID, packet retrieval, and surfaced error event payloads.\n- [ ] Run `pnpm vitest run tests/api/handoffs-route.test.ts tests/runtime/http-registry.test.ts tests/runtime/http-routes.test.ts tests/runtime/route-contract-fixture.test.ts`.\n\n### Task 9: Replace every same-run cross-CLI path\n\n**Files:**\n- Create: `src/server/workers/direct-run-type-invariant.ts`\n- Create: `tests/server/workers/direct-run-type-invariant.test.ts`\n- Modify: `src/server/conversations/send-message.ts`\n- Modify: `src/server/conversations/create.ts`\n- Modify: `src/server/supervisor/worker-failover.ts`\n- Modify: `src/server/supervisor/index.ts`\n- Modify: `src/server/supervisor/wake.ts`\n- Modify: `src/server/supervisor/observer.ts`\n- Modify: `src/server/prompts/supervisor.md`\n- Modify: `src/server/credits/index.ts`\n- Modify: `src/server/planning/review.ts`\n- Modify: `src/server/runs/recovery.ts`\n- Modify: `src/server/db/index.ts`\n- Modify: `src/components/settings/ModelsSettingsPanel.tsx`\n- Modify: `tests/api/conversation-messages-route.test.ts`\n- Modify: `tests/supervisor/worker-failover.test.ts`\n- Modify: `tests/supervisor/worker-failover-handoff-fails.test.ts`\n- Modify: `tests/supervisor/worker-failover-spawn-retry.test.ts`\n- Modify: `tests/supervisor/worker-failover-no-replacement.test.ts`\n\n- [ ] First write failing tests proving: follow-up text/API cannot change a direct run's CLI; cross-provider failover returns a distinct target run; target unavailable preserves quota recovery; and direct/commit worker insertion of another type is rejected at the central assertion and SQLite trigger.\n- [ ] Add `assertDirectRunWorkerTypeInvariant` before all direct/commit worker insertions and an additive SQLite `BEFORE INSERT` trigger as the final safety net. Emit `handoff.refused` at the application boundary. Do not restrict intentional multi-type supervisor implementation runs.\n- [ ] In `applyWorkerPreferenceForMessage`/`reconcileDirectWorkerSelection`, reject a type change for an existing run with a typed “fork required” result; do not persist the new preferred type and do not defer it for later recreation.\n- [ ] Keep same-CLI model, effort, and account recreation behavior and its current ownership fencing.\n- [ ] Change `src/server/credits/index.ts` so `cross_provider` selects and returns a candidate target CLI/account without mutating source credentials; validate it is not quota-blocked or in the recent exhaustion cooldown.\n- [ ] Route cross-provider quota strategy/allowed-worker selection to `coordinator.captureAndLaunch` and return `targetRunId` rather than a replacement worker ID. Enforce automatic chain depth three and recent-provider/account exclusions.\n- [ ] Keep the existing `worker-failover.ts` exports as compatibility wrappers while callers/tests migrate; do not delete the file.\n- [ ] Update wake/restart recovery to continue a persisted handoff rather than retrying a same-run provider spawn.\n- [ ] Update supervisor prompt and settings explanation to say cross-provider recovery creates a new session.\n- [ ] Rename user-visible lifecycle copy from “switching workers” to handoff/fork language while retaining legacy event parsing only where backward compatibility needs it.\n- [ ] Run `pnpm vitest run tests/server/workers/direct-run-type-invariant.test.ts tests/api/conversation-messages-route.test.ts tests/supervisor/worker-failover.test.ts tests/supervisor/worker-failover-handoff-fails.test.ts tests/supervisor/worker-failover-spawn-retry.test.ts tests/supervisor/worker-failover-no-replacement.test.ts` and assert no direct/commit source run contains workers of two CLI types.\n\n### Task 10: Build the client Manager and dialog\n\n**Files:**\n- Create: `src/interface/home/HandoffForkManager.ts`\n- Create: `src/interface/home/HandoffForkDialog.tsx`\n- Create: `src/components/home/CliLaunchSelectionFields.tsx`\n- Modify: `src/interface/home/useHomeMutations.ts`\n- Create: `tests/app/handoff-fork-manager.test.ts`\n- Create: `tests/ui/handoff-fork-dialog.test.tsx`\n- Modify: `shared/locales/*.json`\n\n- [ ] Implement a Manager-owned state machine for closed/selecting/capturing/ready/editing/launching/completed/error, including source run/message IDs, revision, target selection, packet, warnings, and request token.\n- [ ] Use TanStack Query only for transport/cache; the Manager is the single UI source of truth and ignores responses whose ownership token no longer matches.\n- [ ] Build an accessible, responsive dialog using existing Dialog/Select/Textarea/Button/ScrollArea/Alert/Badge primitives.\n- [ ] Keep dialog open/target selection read-only. Label **Prepare handoff** as the point that stops the source CLI; after preparation, cancelling releases the lease and leaves the stopped source in `needs_recovery` so the user can deliberately resume it.\n- [ ] Default to the last compatible *different* CLI, exclude the source CLI, and validate account/model/effort combinations before capture/launch.\n- [ ] Show authoritative sections read-only, advisory fields editable, source/provenance/warnings visible, and an explicit “current files win” note.\n- [ ] Debounce or explicitly save advisory edits with `expectedRevision`; disable launch until the current edit revision is acknowledged.\n- [ ] Allow recovery of the active durable draft after reload and a clear cancel action before launch for both manual and quota drafts.\n- [ ] Add all visible/aria/error strings to every `shared/locales/*.json` file and subscribe with `useI18nSnapshot()`.\n- [ ] Test keyboard focus, escape/cancel, mobile sizing, loading/error/retry states, stale edit conflicts, CLI exclusion, and no hard-coded user-facing JSX.\n- [ ] Run `pnpm vitest run tests/app/handoff-fork-manager.test.ts tests/ui/handoff-fork-dialog.test.tsx`.\n\n### Task 11: Wire every product entry point\n\n**Files:**\n- Modify: `src/interface/home/useConversationActions.ts`\n- Modify: `src/interface/home/ExternalSessionsPicker.tsx`\n- Modify: `src/components/home/HomeHeader.tsx`\n- Modify: `src/components/home/ConversationMain.tsx`\n- Modify: `src/components/home/RunRecoveryNotice.tsx`\n- Modify: `src/interface/home/HomeApp.tsx`\n- Modify: `tests/ui/conversation-actions.test.ts`\n- Modify: `tests/server/external-sessions/discovery.test.ts`\n- Modify: `shared/locales/*.json`\n\n- [ ] Add **Fork to another CLI** to the session menu for eligible direct/commit runs.\n- [ ] Add **Fork to another CLI from here** to user-message actions and pass the exact message ID.\n- [ ] Add a distinct current-conversation fork choice to Resume CLI Session without changing external Claude/Gemini resume behavior.\n- [ ] Add a quota notice action/status that opens or navigates to the automatic handoff and target run.\n- [ ] Add a quota/recovery notice action that cancels an abandoned ready/capturing handoff or retries a `needs_recovery` source; do not require the lost dialog state to release a fence.\n- [ ] Keep `HomeApp.tsx` as wiring only and extract any message-action UI needed to avoid growing oversized components.\n- [ ] On success, select the target only if the user is still viewing the source associated with the completed request; otherwise show a non-destructive notification/link.\n- [ ] Preserve ordinary “Fork session” semantics if it remains same-CLI, and make the cross-CLI wording unambiguous.\n- [ ] Test eligibility, source/message payloads, no selected run, unsupported modes, selection races, external resume regression, and quota CTA behavior.\n- [ ] Run `pnpm vitest run tests/ui/conversation-actions.test.ts tests/server/external-sessions/discovery.test.ts`.\n\n### Task 12: Reconcile SSE, restart, and lifecycle recovery\n\n**Files:**\n- Modify: `src/interface/home/EventStreamStateManager.ts`\n- Modify: `src/interface/home/utils.ts`\n- Modify: `tests/app/event-stream-state-manager.test.ts`\n- Create: `tests/lifecycle/scenarios/cross-cli-handoff-fork.test.ts`\n- Create: `tests/lifecycle/scenarios/cross-cli-handoff-restart.test.ts`\n\n- [ ] Reconcile capture/revision/launch/completion/failure events into existing run snapshots without creating optimistic fake runs.\n- [ ] Fetch snapshot/active handoff after `stream.resync_required`; treat SSE as an invalidation signal and HTTP/SQLite as authority.\n- [ ] Add a manual lifecycle scenario covering source activity, stable capture, packet artifact, target run/worker/seed, source stop, and no mixed CLI types.\n- [ ] Add a quota scenario where the outgoing worker cannot answer, synthetic capture succeeds, and the target new run continues.\n- [ ] Add restart checkpoints after `capturing`, `ready`, and `launching`; prove recovery either finishes once or surfaces a retryable failure without duplicate targets.\n- [ ] Add FK/delete coverage: deleting the source removes its packet metadata/artifact while the target's seed remains readable.\n- [ ] Validate every decision through `/api/events/log?since=<id>&runId=<id>` and assert named refusal/failure events exist.\n- [ ] Run the focused state-manager test, then `pnpm test:lifecycle`.\n\n### Task 13: Full verification and handoff documentation\n\n**Files:**\n- Modify only as failures require within the files already listed.\n- Verify: `.gitignore`\n\n- [ ] Re-read both architecture docs and confirm every new server decision emits a named event and every user-relevant failure emits a stable `error.surfaced` code.\n- [ ] Verify every target seed was persisted through `appendUserInputOnDelivery` and no parallel conversation storage was introduced.\n- [ ] Verify cross-CLI targets copy no source message rows/worker entries: only parent/message metadata plus the rendered first `user_input` packet crosses the boundary.\n- [ ] Verify logs/events demonstrate confirmed source process exit before target run creation and that the direct/commit SQLite trigger rejects mixed worker types.\n- [ ] Verify all visible strings use `t()` and all locale files contain the same new keys.\n- [ ] Verify packet storage, test databases, generated debug packets, CLI transcripts, credentials, and temporary review output are not accidentally tracked; make only a narrow `.gitignore` addition if needed.\n- [ ] Run `pnpm typecheck`.\n- [ ] Run `pnpm lint`.\n- [ ] Run `pnpm vitest run`.\n- [ ] Run `pnpm test:lifecycle`.\n- [ ] Run the mandatory frontend build: `pnpm build:interface:web`.\n- [ ] Inspect `git diff --check` and `git status --short`; preserve unrelated user changes and confirm the implementation did not create a branch, worktree, or delete files.\n\n## Verification matrix\n\n| Case | Expected result |\n|---|---|\n| Header fork, idle source | Preview uses fresh recap plus deterministic evidence; target is a new run; source is stopped. |\n| Header fork, active turn | Source is generation-fenced; durable sequence settles or warning is recorded; no late output owns target state. |\n| Source CLI refuses to exit | Launch is refused before target creation; source is `needs_recovery`; named failure identifies termination. |\n| Another live run uses checkout | Workspace lease/preflight refuses handoff; neither source nor other run is mutated. |\n| Message fork | Conversation is bounded at the message; current workspace drift is explicit; `forkedFromMessageId` is preserved. |\n| Manual preview becomes stale | Sequence/HEAD/workspace fingerprint drift returns `handoff.source_changed`; user must prepare a fresh packet. |\n| Resume CLI Session dialog | External resume still resumes an external provider session; current-conversation fork opens handoff flow. |\n| Quota, outgoing CLI dead | No outgoing request; synthetic packet launches a distinct target run. |\n| Quota, target unavailable | Source stays quota-waiting/recoverable; no target run is reported; named failure and surfaced error exist. |\n| Quota handoff loop | Recent exhausted providers/accounts are excluded; depth four is refused with a visible wait/manual-recovery state. |\n| Same-run text asks to switch CLI | Request is refused with fork guidance; source preferences/worker type do not change. |\n| Same-CLI model/account change | Existing supported recreation path still works inside the run. |\n| Already compacted source | Provider recap is advisory; post-compaction evidence and exact recent tail are included. |\n| Dirty workspace before session | Pre-existing files are not claimed as session-owned; uncertainty is preserved. |\n| Concurrent/external file change | Ownership becomes external/unknown; packet does not overwrite or silently attribute it. |\n| Packet overflow | Highest-priority facts remain; dropped fields are named; hash is deterministic. |\n| Reload while preview is ready | Active draft and revision restore from server; edits do not regress. |\n| Disconnect during launch | SSE replay/snapshot returns one target; repeated operation ID is idempotent. |\n| Crash after target row creation | Reconciler discovers exactly one target by `originHandoffId`, adopts or fails it, and releases the claim/lease. |\n| Target deleted during launch | Handoff terminalizes and source/workspace fence releases before the target link is nulled. |\n| Delete source after completion | Source metadata/artifact is cleaned; target initial seed remains self-contained. |\n\n## Agentic user-journey candidates (approval required before running)\n\nThese browser journeys are valuable after automated tests/build pass, but they must not be run without explicit user approval because they create real local conversations and CLI activity:\n\n1. Start a Codex direct session, make a small edit, open the header handoff dialog, inspect/edit the packet, fork to Claude, verify the new sidebar session and source preservation, then clean up the test conversations/artifacts.\n2. Fork from an earlier user message and confirm the preview distinguishes historical conversation state from the current checkout.\n3. Simulate/induce a quota-waiting source through supported test controls, select cross-provider recovery, verify the synthetic packet and target navigation, then clean up.\n4. Reload the browser while a handoff preview is open and while launch is completing; verify restoration, SSE replay, and no duplicate target.\n\n## Implementation guardrails\n\n- Begin implementation by rechecking `git status --short`; the current worktree already contains user changes. Never overwrite, revert, or reformat unrelated edits.\n- Do not create a branch or worktree and do not delete any file.\n- Keep new logic out of `HomeApp.tsx`, `ConversationMain.tsx`, `runs/recovery.ts`, and `worker-failover.ts` except thin integration/delegation because all are already oversized.\n- Use `src/server/git/command.ts` or existing async helpers for git evidence; avoid synchronous shell calls in request paths.\n- Never log or emit the full packet in named events, errors, or ordinary server logs.\n- Never pass translated strings through transactions or persist translated UI copy.\n- Never treat an LLM-generated summary as proof that a file changed, a test passed, or a command ran.\n- Do not add configurable frontend strings/settings through `.env`; packet limits are code constants.\n- Clean up test conversations and persisted artifacts after any approved live/agentic validation.\n--- UPDATED PLAN END ---"
}
````

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-08-20T18:11:52.800Z","phase":null} -->
## Claude state: queue-operation · 2026-08-20T18:11:52.800Z

```text
{
  "type": "queue-operation",
  "operation": "dequeue",
  "timestamp": "2026-08-20T18:11:52.800Z",
  "sessionId": "23684cf2-66e9-47ff-ada1-76c62f4558a0"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"user","timestamp":"2026-08-20T18:11:52.842Z","phase":null} -->
## User · 2026-08-20T18:11:52.842Z

I revised the plan against all material findings: confirmed source process exit before target creation; workspace lease; post-stop capture and launch drift refusal; persisted server claim/originHandoffId/reconciler; terminal-failure retry semantics; expiry/cancel/target-delete fence release; canonical hash and nonce-fenced seed; redaction order/path privacy; quota loop guards; no source transcript copy; queued-row cancellation; visible failed target; IDOR checks; central direct/commit assertion plus SQLite trigger; exact test paths; green task sequencing; and explicit source statuses.

Re-review the complete updated artifact below. Judge only the supplied artifact and return exactly READY, or HARDEN followed by only remaining concrete blockers. Do not repeat resolved findings or suggest unrelated features.

--- UPDATED PLAN START ---

# Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax.

**Feature:** Cross-CLI Hybrid Handoff Fork

**Goal:** Let a user fork any direct-control conversation into a new session running on a different CLI, carrying a compact, inspectable hybrid handoff packet; use the same new-run mechanism when cross-provider quota recovery is selected, and make same-run cross-CLI switching impossible.

**Architecture:** A server-owned handoff coordinator freezes the source at a durable worker-stream sequence, gathers bounded deterministic evidence, optionally adds a semantic summary, compiles and persists a versioned packet, and launches a completely separate target run. SQLite stores lifecycle metadata; the append-only artifact store holds packet versions; the target worker stream receives the rendered packet as its first `user_input`. The source run is preserved as stopped history. Same-CLI model/account recovery may continue inside a run, but changing the CLI/provider always crosses a run boundary.

**Tech Stack:** TypeScript, React, TanStack Query, global Manager classes, Drizzle + SQLite, append-only JSONL artifacts, existing runtime HTTP registry/API adapters, named SSE events, Vitest, lifecycle HTTP/SSE scenarios, existing shadcn/ui primitives, and locale JSON files.

**North Star Product:** A user can move work between CLI ecosystems without pretending their provider sessions, recovery semantics, or transcripts are interchangeable. The new agent starts with the smallest trustworthy continuation context, the source remains auditable, and failures never strand or silently mutate either conversation.

**Current Milestone:** Ship cross-CLI handoff forks for direct/commit conversations from the session menu, an individual message, the existing Resume CLI Session dialog, and quota recovery. The packet is editable where it is advisory, inspectable after launch, bounded, redacted, restart-safe, and synthesized without contacting an exhausted provider when necessary.

**Future Product Direction:** Reuse the packet format for export/import and cross-device handoff only after this milestone proves the provenance, recovery, and deletion model. Do not add same-run CLI switching, background multi-agent continuation, or automatic worktree creation in this milestone.

**Final Functionality Standard:** Every cross-CLI transition creates a new run and target worker stream; no server path can recreate a worker under another CLI in the source run. The packet accurately identifies uncertainty and pre-existing workspace changes, survives a process restart, excludes secrets and hidden reasoning, and produces enough observability to explain every capture, launch, refusal, and failure.

---

## Product decisions and non-goals

1. **A CLI handoff is a fork, never a resume.** “Resume external session” keeps its existing meaning. “Fork current conversation to another CLI” creates a new OmniHarness run with `parentRunId` and an optional `forkedFromMessageId`.
2. **The source is historical after a successful launch.** Before target creation, terminate the source CLI process and confirm it exited. On success set the source run to `cancelled`, retain its transcript and artifacts, and select the target run in the UI. If target launch fails after source termination, set the source to `needs_recovery` with an explicit retry path. Never keep two CLIs editing the same checkout concurrently.
3. **The packet is hybrid.** Deterministic state is authoritative; generated summaries and outgoing-agent reports are advisory. Current disk state wins over prose.
4. **Manual and quota paths share one coordinator.** Manual entry points offer a preview. A quota-triggered cross-provider handoff may launch without waiting for an exhausted CLI, then exposes the persisted packet for inspection.
5. **Only advisory content is user-editable.** The user may amend objective, status, next steps, blockers, notes, and relevant-file explanations. Source IDs, stream sequence, git evidence, verification records, target selection, provenance, and hash are server-owned.
6. **No full transcript or full diff by default.** The packet contains a short exact tail plus summaries, file-level evidence, and compact error/test output. The source run remains the place to inspect full history.
7. **No hidden reasoning.** Never copy `thought`, chain-of-thought, raw environment, credentials, authorization headers, binary attachments, or unrestricted tool output into a packet.
8. **No automatic worktree.** This feature uses the current checkout and avoids concurrency by stopping the source. Existing explicit worktree fork actions remain separate.
9. **No file deletion is part of this plan.** Refactor existing modules in place or add focused modules; preserve project history and user changes.

## User journeys

### Manual fork from the session

1. The user opens the session menu and selects **Fork to another CLI**.
2. The dialog defaults to a different available CLI and offers compatible account, model, and effort choices.
3. The server captures a stable source boundary and returns a compact preview with provenance and warnings.
4. The user may edit advisory notes, then launches.
5. OmniHarness validates the target, creates a new run, persists the packet as the target's initial user input, starts the selected CLI, stops the source, and selects the target in the sidebar.

### Fork from a message

1. The user chooses **Fork to another CLI from here** on a user message.
2. Candidate collection ignores superseded/later conversation entries but compares against the current workspace, explicitly warning when files contain changes made after the selected message.
3. The rest of the flow is the same as the manual session fork.

### Fork from Resume CLI Session

1. The existing dialog clearly separates **Resume external session** from **Fork current conversation**.
2. The fork option appears only with an eligible selected OmniHarness direct/commit run.
3. Choosing it opens the same handoff dialog, not a provider-session resume flow.

### Cross-provider quota recovery

1. A CLI reaches a durable quota-waiting state.
2. Same-provider account/model recovery may use existing same-CLI recovery.
3. If the selected strategy requires another CLI/provider, the server synthesizes a packet from persisted evidence and creates a new run.
4. The exhausted source is never prompted for a handoff and never receives a replacement worker of another type.
5. If no target can launch, the source remains visibly recoverable/quota-waiting and the error names the failed stage.

## Compact handoff packet contract

Create a versioned `HybridHandoffPacketV1` with the following logical shape. Use stable IDs and enums rather than translated labels.

```ts
type HybridHandoffPacketV1 = {
  handoffVersion: 1;
  source: {
    runId: string;
    workerId: string | null;
    workerType: SupportedWorkerType | null;
    forkedFromMessageId: string | null;
    sourceSeq: number | null;
    interruptionReason: "manual_session" | "manual_message" | "quota_exhausted";
    generatedAt: string;
  };
  target: {
    workerType: SupportedWorkerType;
    model: string | null;
    effort: string | null;
    accountId: string | null;
  };
  task: {
    originalRequest: string | null;
    currentObjective: string | null;
    acceptanceCriteria: string[];
    userConstraints: string[];
  };
  state: {
    completed: string[];
    inProgress: string[];
    remaining: string[];
    blockers: string[];
    openQuestions: string[];
    rejectedApproaches: Array<{ approach: string; reason: string }>;
  };
  decisions: Array<{ decision: string; reason: string | null; evidence: string[] }>;
  workspace: {
    projectRootLabel: string;
    baselineCommit: string | null;
    currentHead: string | null;
    dirtyBeforeSession: boolean | null;
    modifiedFiles: Array<{
      path: string;
      changeType: "added" | "modified" | "deleted" | "renamed" | "unmerged";
      ownership: "session" | "probable_session" | "preexisting" | "external" | "unknown";
      summary: string | null;
      evidence: string[];
    }>;
    untrackedFiles: string[];
    relevantUnchangedFiles: string[];
    commitsCreated: string[];
  };
  verification: Array<{
    command: string;
    result: "passed" | "failed" | "unknown";
    exitCode: number | null;
    importantOutput: string | null;
  }>;
  artifacts: {
    plans: string[];
    specs: string[];
    generatedOutputs: string[];
  };
  continuity: {
    recentUserMessages: string[];
    recentAssistantSummary: string | null;
    pendingUserInput: string | null;
    queuedMessages: string[];
  };
  provenance: {
    summarySource: "outgoing_worker" | "recent_assistant" | "synthetic" | "hybrid";
    omittedSections: string[];
    confidenceWarnings: string[];
    truncatedFields: string[];
  };
};
```

Compilation rules:

- Set an explicit 36,000-character rendered-packet ceiling (roughly 6,000–10,000 tokens depending on content), plus per-field item and character limits. Keep the constants in code, not environment variables.
- Prioritize source identity and sequence, user constraints, current objective, blockers/errors, file evidence, verification, decisions, queued input, then recent conversational tail. Drop completed prose first.
- Stable-sort every deterministic collection so the same redacted nonvolatile evidence yields the same semantic content hash; `generatedAt` may differ without changing that hash.
- Reuse a recent assistant recap only as advisory text. It is “fresh” only if its worker sequence is at or after the last included tool/result lifecycle boundary; otherwise include it with a stale-summary warning.
- Ask an outgoing worker for a structured report only when it is idle/responsive and not quota-blocked. Bound the request timeout. Never delay quota recovery on this call.
- For a hard interruption, synthesize entirely from the worker stream, execution events, messages/queued messages, run metadata, git evidence, and known artifacts.
- For a message fork, cap conversation candidates at that message/stream boundary while computing workspace state at capture time; call out the mismatch rather than claiming the checkout was rewound.
- Render advisory narrative inside an explicit untrusted-data boundary telling the target to verify disk state. Do not let tool/assistant text masquerade as system instructions.
- Run redaction before budgeting, canonicalization, hashing, preview extraction, rendering, logging, or event emission. Apply it to every structured text field and to the final rendered seed, including verification output, blockers, decision evidence, queued text, and outgoing-worker reports.
- Keep the absolute `projectPath` only in server-side run/handoff metadata for access and launch checks. The packet/API uses a non-sensitive `projectRootLabel` such as the repository directory name; all file evidence is project-relative.
- Hash the NFC-normalized, fixed-key-order canonical packet while excluding only volatile `generatedAt`. Target selection remains hash input, so changing it creates a new hash/revision.
- Render untrusted content inside a randomly generated, high-entropy nonce fence created after sanitization. Reject/regenerate a nonce that occurs in content, encode the interior as canonical JSON, and test delimiter/system/tool-frame imitation. The renderer's nonce is not part of the semantic packet hash.

## State machine and invariants

Persist these statuses: `capturing -> ready -> launching -> completed`, with terminal `failed` and `cancelled`. Only `capturing`, `ready`, and `launching` are nonterminal and covered by active-handoff uniqueness. Retrying a terminal failure always creates a new handoff row linked to the failed attempt; it never resurrects the terminal row.

The coordinator owns an immutable launch fence:

```ts
{
  handoffId,
  revision,
  sourceRunId,
  sourceWorkerId,
  sourceSeq,
  workspaceFingerprint,
  targetSelectionHash
}
```

Server invariants:

- At most one nonterminal handoff exists for a source run and normalized project path. A persistent workspace lease plus an in-process keyed mutex serializes capture/launch; every other OmniHarness mutation path for a run sharing that project refuses while the lease is active. Before capture, also refuse when another live run already owns a worker in the same checkout.
- New messages, queued-message delivery, retry/edit recovery, manual resume, quota wake, auto-commit, and reconciler actions refuse with `409 handoff_in_progress` while the source workspace is fenced.
- Opening the dialog is read-only. The explicit **Prepare handoff** action acquires the lease, advances the existing turn-generation fence, requests graceful interruption, waits up to a named stream-settle timeout, terminates the source CLI process, and confirms process exit/no live runtime ownership. If termination cannot be confirmed, fail capture and do not create a target.
- After confirmed source termination, set the source run to `needs_recovery` with handoff-stage details, then capture the final durable worker sequence and git HEAD/status/workspace fingerprint. This post-stop state is what the packet describes. `ready`/`launching` live on the handoff row, not as new run statuses.
- Launch first validates CLI availability, target account/model/effort compatibility, quota state, project path, source revision, and target selection without mutating source or target. It then re-reads the durable sequence and workspace fingerprint. Any drift refuses with `handoff.source_changed` and requires a new capture/preview; it never silently auto-revises a packet the user already reviewed.
- The target run and worker are created under the existing run/quota mutation controls. The rendered seed is persisted with `appendUserInputOnDelivery` in the target's unified worker stream before prompting the CLI.
- `launch` is idempotent. Persist a server-generated launch claim token and expiry before target creation, and stamp the target `runs.originHandoffId` before worker creation. Repeating the operation returns the discovered existing `targetRunId`; a stale revision gets `409 handoff_revision_conflict`.
- A startup reconciler finds expired `capturing`/`launching` claims, discovers targets by `originHandoffId`, adopts the one target or terminalizes the attempt, releases the workspace fence, and emits the exact decision. There is never more than one target per handoff.
- Mark `completed` only after target creation, target seed persistence, and worker launch acceptance. Set the already-terminated source run to `cancelled`, mark carried queued messages `cancelled` with a `cross_cli_handoff` reason, and persist the source-to-target link in the completed handoff row.
- A target launch failure never manufactures success and never deletes persisted rows. Mark any partially created target run `failed` and visible for diagnosis, set the source run to `needs_recovery`, release the workspace fence, and emit the decision.
- Cancellation applies to manual and quota-created nonlaunching handoffs. The dialog and `RunRecoveryNotice` both expose it. Expired claims are failed by the reconciler so a crashed client/server cannot leak a permanent fence.
- Deleting the source removes its handoff metadata/artifact stream through existing run cleanup; the target remains independently understandable because its initial worker stream contains the rendered seed.
- Deleting a target while its handoff is nonterminal first terminalizes the handoff and releases the source/workspace fence; `ON DELETE SET NULL` is not relied on as lifecycle logic.
- Same-run recreation must reject a requested worker type different from an existing direct/commit run's CLI. Enforce this in a shared spawn assertion and a SQLite `BEFORE INSERT` safety trigger, not only at callers. Model, effort, or account changes within the same CLI remain allowed where currently supported. Supervisor implementation runs retain their intentional multi-worker behavior.
- Automatic quota handoff walks handoff/parent lineage. Refuse after `MAX_AUTOMATIC_HANDOFF_DEPTH = 3`, exclude providers/accounts exhausted in the last two handoffs, enforce a cooldown, and verify the target account has no open quota incident before source termination.

## File map

### Create

- `src/shared/handoff.ts` — packet, lifecycle, API DTO, edit-patch, and error-code contracts shared by server/client.
- `src/server/handoff/candidates.ts` — bounded candidate reads from unified worker streams, messages, queued messages, events, and artifacts.
- `src/server/handoff/workspace-state.ts` — read-only git baseline/current evidence and file ownership classification.
- `src/server/handoff/redaction.ts` — path-safe text normalization, secret/tool-output filtering, and size limits.
- `src/server/handoff/compiler.ts` — authoritative/advisory merge, priority budgeting, deterministic ordering, provenance, hash, and renderer input.
- `src/server/handoff/store.ts` — SQLite metadata and append-only packet-version persistence.
- `src/server/handoff/coordinator.ts` — capture/preview/edit/launch state machine, source fence, idempotency, and failure recovery.
- `src/server/handoff/reconciler.ts` — startup/heartbeat recovery for expired capture/launch claims and orphan target adoption.
- `src/server/runs/fork.ts` — extracted generic new-run fork creation used by legacy message forks and handoff launches.
- `src/server/workers/direct-run-type-invariant.ts` — central direct/commit worker-type assertion used before worker insertion; emits typed refusal.
- `src/server/events/handoff-events.ts` — focused named-event union for import into the existing event contract.
- `src/runtime/http/routes/handoffs.ts` — create/list/get/patch/launch HTTP handlers and validation.
- `src/interface/home/HandoffForkManager.ts` — single source of truth for dialog draft, server revision, request ownership, pending stages, and errors.
- `src/interface/home/HandoffForkDialog.tsx` — target picker, packet preview/editor, warnings, and launch result UI.
- `src/components/home/CliLaunchSelectionFields.tsx` — reusable CLI/account/model/effort controls for the handoff dialog without duplicating composer selection logic.
- `tests/server/handoff/compiler.test.ts` — packet priority, freshness, deterministic hash, truncation, and rendering tests.
- `tests/server/handoff/candidates.test.ts` — bounded stream/event/queued-message and message-boundary tests.
- `tests/server/handoff/workspace-state.test.ts` — baseline/current classification and path-safety tests.
- `tests/server/handoff/redaction.test.ts` — credentials, environment, hidden reasoning, malicious content, and byte-limit tests.
- `tests/server/handoff/store.test.ts` — revisions, active-handoff uniqueness, idempotency, and cascade tests.
- `tests/server/handoff/coordinator.test.ts` — state transitions, source fences, synthetic fallback, target failures, and launch idempotency.
- `tests/server/handoff/reconciler.test.ts` — expired claim, orphan target adoption, target deletion, and fence-release tests.
- `tests/server/workers/direct-run-type-invariant.test.ts` — application assertion and SQLite trigger safety-net tests.
- `tests/api/handoffs-route.test.ts` — route validation/auth/contract/error responses.
- `tests/app/handoff-fork-manager.test.ts` — stale-response ownership, retry, selection, and close/reopen behavior.
- `tests/ui/handoff-fork-dialog.test.tsx` — translated copy, accessibility, advisory-only editing, and responsive states.
- `tests/lifecycle/scenarios/cross-cli-handoff-fork.test.ts` — manual and quota cross-CLI lifecycle scenario over HTTP/SSE.
- `tests/lifecycle/scenarios/cross-cli-handoff-restart.test.ts` — restart, replay, idempotent launch, and deletion scenario.

### Modify

- `src/server/db/schema.ts` — add `conversationHandoffs` metadata table and indexes.
- `src/server/db/index.ts` — additive schema initialization/migration and database version bump.
- `src/server/artifacts/stream-types.ts` — add the `handoff_packets` run-level stream kind.
- `src/server/artifacts/append-only-store.ts` — map the new stream to `handoff-packets.jsonl`.
- `src/server/handoff/request.ts` — make the outgoing summary request reason-neutral, structured, bounded, and optional.
- `src/server/handoff/parser.ts` — parse advisory report fields into the versioned candidate contract without treating them as facts.
- `src/server/handoff/render.ts` — render the versioned packet and remove quota-only wording.
- `src/server/git/auto-commit.ts` — extract/reuse baseline parsing needed by read-only workspace evidence without synchronous shell work on the hot path.
- `src/server/runs/recovery.ts` — delegate legacy retry/edit/fork run creation to focused services; do not grow this 1,300+ line module.
- `src/server/supervisor/worker-failover.ts` — retain compatibility exports but route cross-CLI cases to the new-run handoff coordinator; do not spawn another CLI in the source run.
- `src/server/supervisor/index.ts` and `src/server/supervisor/wake.ts` — consume target-run outcomes and preserve quota recovery semantics across restart.
- `src/server/supervisor/observer.ts` — record pending cross-CLI handoff intent instead of only same-run failover intent.
- `src/server/conversations/send-message.ts` — reject text/composer-driven cross-CLI changes inside an existing run and preserve same-CLI model/account recreation only.
- `src/server/conversations/create.ts`, `src/server/supervisor/index.ts`, `src/server/planning/review.ts`, and `src/server/runs/recovery.ts` — call the central direct/commit worker-type assertion before worker insertion; supervisor implementation multi-worker behavior remains allowed.
- `src/server/conversations/queued-messages.ts`, `src/server/conversations/queued-message-interrupt.ts`, `src/server/quota/worker-resume.ts`, and `src/server/runs/recovery-reconciler.ts` — enforce the persisted handoff fence before source mutation/recovery.
- `src/server/prompts/supervisor.md` — describe cross-provider recovery as a new-session handoff, not an in-session worker swap.
- `src/server/credits/index.ts` — make `cross_provider` return a target CLI/account candidate for the handoff coordinator rather than mutating the source worker account.
- `src/server/events/named-events.ts` — import the focused handoff event union, add stable surfaced error codes, and avoid embedding packet bodies in SSE.
- `src/runtime/http/routes/index.ts` — register handoff routes.
- `src/runtime-api/types.ts` and `src/runtime-api/domains/index.ts` — add typed `handoffs` operations.
- `src/interface/home/useHomeMutations.ts` — add query/mutations for preview, edit, launch, and active-draft lookup; switch selection only under matching request ownership.
- `src/interface/home/useConversationActions.ts` — route session/message cross-CLI actions into `HandoffForkManager`; retain ordinary same-run message retry/edit behavior.
- `src/interface/home/ExternalSessionsPicker.tsx` — separate external resume from the new current-conversation fork option.
- `src/components/home/HomeHeader.tsx` — add the session-level entry point.
- `src/components/home/ConversationMain.tsx` — add the per-message entry point through a small extracted action component or callback; do not grow this 1,600+ line file.
- `src/components/home/RunRecoveryNotice.tsx` — add quota handoff status/action and target-run navigation.
- `src/interface/home/HomeApp.tsx` — mount/wire the lazy dialog and manager only; move logic out of this 1,700+ line file.
- `src/interface/home/EventStreamStateManager.ts` and `src/interface/home/utils.ts` — reconcile handoff lifecycle events and target selection without optimistic run fabrication.
- `src/components/settings/ModelsSettingsPanel.tsx` — clarify that `cross_provider` opens a new handoff session while same-provider strategies stay in the current CLI.
- `shared/locales/*.json` — add every new visible label, description, warning, status, aria label, and error fallback to all locales.
- `tests/db/schema.test.ts`, `tests/supervisor/worker-failover.test.ts`, `tests/supervisor/worker-failover-handoff-fails.test.ts`, `tests/supervisor/worker-failover-spawn-retry.test.ts`, `tests/supervisor/worker-failover-no-replacement.test.ts`, `tests/api/conversation-messages-route.test.ts`, `tests/ui/conversation-actions.test.ts`, `tests/app/event-stream-state-manager.test.ts`, `tests/runtime/http-registry.test.ts`, `tests/runtime/http-routes.test.ts`, `tests/runtime/route-contract-fixture.test.ts`, and `tests/runtime/fixtures/routes.v1.json` — update existing expectations around the new-run invariant.
- `docs/architecture/lifecycle-observability-and-testing.md` — document handoff decisions/events and the source/target recovery model before adding server state transitions.
- `docs/architecture/worker-conversation-stream.md` — document that the target handoff seed is an ordinary first `user_input`, not a parallel transcript.
- `.gitignore` — verify packet temp/debug output cannot be tracked; add only a narrowly scoped ignore if implementation introduces a local debug artifact.

## API and persistence design

### SQLite metadata

Add `conversation_handoffs` with:

- `id` primary key.
- `source_run_id` foreign key to `runs` with `ON DELETE CASCADE`.
- `source_worker_id` nullable foreign key to `workers` with `ON DELETE SET NULL`.
- `target_run_id` nullable foreign key to `runs` with `ON DELETE SET NULL`.
- `forked_from_message_id`, `reason`, `status`, `revision`, `source_seq`, `normalized_project_path`, and `workspace_fingerprint`.
- `target_worker_type`, `target_model`, `target_effort`, `target_account_id`, `target_selection_hash`.
- `packet_version`, `artifact_seq`, `packet_hash`, `packet_preview`, `summary_source`.
- `operation_id`, `launch_claim_token`, `claim_expires_at`, `retry_of_handoff_id`, `last_error`, `created_at`, `updated_at`, and `completed_at`.
- Unique partial indexes for one `capturing|ready|launching` handoff per source run and normalized project path, plus indexes for target run, claim expiry, and status/update time.

Add nullable `runs.origin_handoff_id` and index it. It is written in the same transaction as target run creation, deliberately has no cascading foreign key, and lets restart recovery discover a target even if the process died before `conversation_handoffs.target_run_id` was updated.

Keep the full packet out of SQLite. Append every ready/revised packet as an `ArtifactRecordEnvelope<HybridHandoffPacketV1>` in the source run's `handoff_packets` stream and point metadata at the current sequence/hash. Store only a bounded, redacted preview for list/recovery UI.

### HTTP contract

- `POST /api/runs/:runId/handoffs` — create or return the active draft. Body: fork point, reason, and target selection. Returns `202 capturing` or `200 ready` with metadata/packet DTO.
- `GET /api/runs/:runId/handoffs?active=1` — restore a durable draft after reload.
- `GET /api/handoffs/:handoffId` — inspect the current packet/revision/result.
- `PATCH /api/handoffs/:handoffId` — patch advisory fields with `expectedRevision`; return `409` on stale revision.
- `POST /api/handoffs/:handoffId/launch` — idempotent launch with `expectedRevision`, `operationId`, and final target selection; return the target run/worker IDs.
- `POST /api/handoffs/:handoffId/cancel` — release any nonlaunching manual or quota draft fence. A launching/completed handoff cannot be cancelled; the reconciler owns abandoned launch claims.

Every flat `/api/handoffs/:handoffId` handler must resolve the source run and apply the same project/run authorization check as run-scoped endpoints before reading or mutating anything. Include an IDOR test using an authenticated caller without access to the source project. Cancellation covers every nonlaunching manual or quota draft.

There are no persisted V0 packet artifacts to migrate: the existing parser/request/render path produces ephemeral reports only. Treat those reports as advisory candidates when creating V1. If a future/unknown artifact version is encountered, retain it on disk, refuse to render it, surface `handoff.packet_version_unsupported`, and require a fresh V1 capture.

Return typed stage-specific errors. User-relevant failures also emit `error.surfaced` with stable codes such as `handoff.capture_failed`, `handoff.revision_conflict`, `handoff.target_unavailable`, `handoff.source_changed`, and `handoff.launch_failed`.

### Named events

Emit these via `emitNamedEvent` for every server decision:

- `handoff.capture_started`
- `handoff.packet_ready`
- `handoff.packet_revised`
- `handoff.launch_started`
- `handoff.completed`
- `handoff.cancelled`
- `handoff.failed`
- `handoff.refused`

Events carry IDs, revisions, stage, source/target IDs, target worker type, reason, and stable error code where relevant. They never carry the full packet. All event frames retain the existing SSE ID/replay/resync behavior.

## Implementation tasks

### Task 1: Document the invariant and preserve a green baseline

**Files:**
- Modify: `docs/architecture/lifecycle-observability-and-testing.md`
- Modify: `docs/architecture/worker-conversation-stream.md`

- [ ] Add architecture text stating that a CLI/provider change creates a new run, the target seed lives in its unified worker stream, and source/target ownership is never shared.
- [ ] Record the three-phase ordering: validate target; terminate/confirm source and capture final state; create/prompt target. Document the `cancelled` success state and `needs_recovery` post-stop failure state.
- [ ] Record workspace lease, drift refusal, packet redaction/untrusted-boundary, restart claim, and named-event requirements before implementing state transitions.
- [ ] Run the existing baseline without changing its expectations: `pnpm vitest run tests/api/conversation-messages-route.test.ts tests/supervisor/worker-failover.test.ts tests/supervisor/worker-failover-handoff-fails.test.ts tests/supervisor/worker-failover-spawn-retry.test.ts tests/supervisor/worker-failover-no-replacement.test.ts`.

### Task 2: Define the packet and lifecycle contracts

**Files:**
- Create: `src/shared/handoff.ts`
- Create: `tests/server/handoff/compiler.test.ts`
- Create: `tests/server/handoff/redaction.test.ts`

- [ ] Define V1 packet, provenance, lifecycle metadata, editable advisory patch, API request/response, and error-code types.
- [ ] Make authoritative versus advisory fields explicit in the types so PATCH cannot alter source/workspace/verification provenance.
- [ ] Add constants for total and per-field budgets, item counts, recent-tail bounds, and supported interruption reasons.
- [ ] Write failing tests for stable ordering, NFC/fixed-key canonicalization, a content hash that excludes only `generatedAt`, priority truncation, exact omission metadata, and rejection of unknown packet versions.
- [ ] Write failing redaction/render-boundary tests for common API keys/tokens, authorization headers, environment dumps, hidden-reasoning entries, absolute paths outside the project, control characters, nonce/delimiter injection, and content imitating system/tool-result framing.
- [ ] Run `pnpm vitest run tests/server/handoff/compiler.test.ts tests/server/handoff/redaction.test.ts` and confirm failures are contractual rather than fixture errors.

### Task 3: Add durable metadata and packet artifact storage

**Files:**
- Modify: `src/server/db/schema.ts`
- Modify: `src/server/db/index.ts`
- Modify: `src/server/artifacts/stream-types.ts`
- Modify: `src/server/artifacts/append-only-store.ts`
- Create: `src/server/handoff/store.ts`
- Create: `tests/server/handoff/store.test.ts`
- Modify: `tests/db/schema.test.ts`

- [ ] Add the `conversation_handoffs` table, `runs.originHandoffId`, foreign keys, normalized workspace key, timestamps, revision, operation/claim/expiry fields, bounded preview, and exact partial indexes described above using the repository's additive schema pattern.
- [ ] Increment `DB_SCHEMA_VERSION` and test initialization of old and fresh databases.
- [ ] Add the run-level `handoff_packets` stream and map it to `app-data/run-data/<runId>/handoff-packets.jsonl` through the artifact store.
- [ ] Implement transactional metadata transitions plus append/read of packet versions; never expose a metadata revision whose artifact append failed.
- [ ] Enforce one active handoff per source run and normalized project path, idempotent operation IDs, and target discovery by `originHandoffId`.
- [ ] Test packet revision lookup, stale revision refusal, source deletion cascade, target deletion terminalization/fence release, expired claim lookup, and no orphaned artifact metadata.
- [ ] Run `pnpm vitest run tests/server/handoff/store.test.ts tests/db/schema.test.ts`.

### Task 4: Gather bounded deterministic evidence

**Files:**
- Create: `src/server/handoff/candidates.ts`
- Create: `src/server/handoff/workspace-state.ts`
- Create: `src/server/handoff/redaction.ts`
- Modify: `src/server/git/auto-commit.ts`
- Create: `tests/server/handoff/candidates.test.ts`
- Create: `tests/server/handoff/workspace-state.test.ts`
- Modify: `tests/server/handoff/redaction.test.ts`

- [ ] Read worker content only through bounded `readWorkerEntriesTail`/`Since`/`Before` APIs and respect superseded sequence ranges.
- [ ] Gather original/current user requests, a small exact recent tail, latest assistant recap, queued messages, unresolved execution errors, verification commands/results, plan/spec/generated artifact paths, and the source sequence.
- [ ] For message forks, constrain conversational evidence to the selected message boundary.
- [ ] Parse `runs.gitBaselineJson`, current HEAD/status, diff stats, commit range, tool edit events, and relevant agent summaries into file ownership evidence.
- [ ] Classify file ownership conservatively; never claim session ownership from current git status alone. Preserve `unknown` and warnings.
- [ ] Normalize project-relative paths, keep raw absolute project paths server-only, omit file contents and raw diff hunks by default, and include only narrowly bounded hunks for unresolved conflicts/subtle incomplete edits.
- [ ] Redact every candidate before budgeting, hashing, previewing, rendering, logging, or event emission; perform a final redaction pass over the rendered seed.
- [ ] Test large streams, already-compacted history, deleted/renamed/untracked files, a dirty pre-session baseline, external concurrent edits, post-message workspace drift, malformed baselines, and non-git projects.
- [ ] Run `pnpm vitest run tests/server/handoff/candidates.test.ts tests/server/handoff/workspace-state.test.ts tests/server/handoff/redaction.test.ts`.

### Task 5: Compile and render the hybrid packet

**Files:**
- Create: `src/server/handoff/compiler.ts`
- Modify: `src/server/handoff/request.ts`
- Modify: `src/server/handoff/parser.ts`
- Modify: `src/server/handoff/render.ts`
- Modify: `tests/server/handoff/compiler.test.ts`
- Modify: `tests/server/handoff/parser.test.ts`

- [ ] Implement deterministic merging where collected facts override advisory summaries and every conflict becomes a confidence warning.
- [ ] Detect fresh recent assistant recaps using worker/event sequence evidence.
- [ ] Update the outgoing request to return only structured task/state/decision/file explanations; use a short timeout and skip it for quota-blocked or busy workers.
- [ ] Preserve the existing synthetic fallback, but feed it through the same candidates/compiler/redaction pipeline.
- [ ] Enforce the packet budget by priority, populate `omittedSections`/`truncatedFields`, and hash the redacted canonical representation excluding only `generatedAt`.
- [ ] Render a concise target prompt with objective, state, decisions, workspace, verification, pending input, uncertainty, and an explicit instruction to inspect current files before acting. Place canonical JSON inside a post-sanitization random nonce fence and ensure embedded text cannot close or imitate the boundary.
- [ ] Ensure quota wording is a reason field, not hard-coded into all handoffs.
- [ ] Test clean completed turns, mid-turn interruption, hard quota interruption, already-compacted history, short sessions, stale summaries, malicious advisory content, and overflow.
- [ ] Run `pnpm vitest run tests/server/handoff/compiler.test.ts tests/server/handoff/redaction.test.ts tests/server/handoff/parser.test.ts`.

### Task 6: Extract safe new-run fork creation

**Files:**
- Create: `src/server/runs/fork.ts`
- Modify: `src/server/runs/recovery.ts`
- Modify: `tests/api/run-route.test.ts`
- Modify: `tests/ui/conversation-actions.test.ts`

- [ ] Extract plan/run/message-copy creation from the existing `recoverRun(... action: "fork")` branch without changing retry/edit semantics.
- [ ] Accept an explicit target worker type/model/effort/account/allowed-types selection and copy `preferredWorkerAccountId`, which the current fork path can omit.
- [ ] Preserve `parentRunId`, `forkedFromMessageId`, project path, git baseline/workspace metadata, and auto-commit preferences. Add `copyMessagePrefix: boolean`: legacy same-CLI forks use `true`; cross-CLI handoffs use `false` so the rendered packet is the target's only initial conversation entry.
- [ ] Keep target preflight validation separate from target creation. The coordinator performs source termination and post-stop capture between preflight and target creation.
- [ ] Keep existing ordinary and worktree fork behavior passing; do not create a worktree for cross-CLI handoff.
- [ ] On worker launch failure, retain the partially created plan/run as a visible `failed` diagnostic record stamped with `originHandoffId`; do not delete it or claim launch succeeded.
- [ ] Run `pnpm vitest run tests/api/run-route.test.ts tests/ui/conversation-actions.test.ts`.

### Task 7: Build the server coordinator and source fence

**Files:**
- Create: `src/server/handoff/coordinator.ts`
- Create: `src/server/handoff/reconciler.ts`
- Create: `tests/server/handoff/coordinator.test.ts`
- Create: `tests/server/handoff/reconciler.test.ts`
- Modify: `src/server/conversations/queued-messages.ts`
- Modify: `src/server/conversations/queued-message-interrupt.ts`
- Modify: `src/server/quota/worker-resume.ts`
- Modify: `src/server/runs/recovery-reconciler.ts`

- [ ] Implement capture, revise, launch, cancel, retry, and restore transitions over the persisted metadata/store.
- [ ] Acquire the persisted normalized-workspace lease plus in-process workspace mutex; reject another active handoff or any other live worker already using that checkout.
- [ ] On explicit prepare/capture, advance turn generation, request graceful interruption, wait up to the named stream-settle timeout, terminate the CLI process, and confirm exit/no runtime ownership. Refuse before target creation if confirmation fails.
- [ ] After process exit, recapture the final durable sequence, HEAD/status/workspace fingerprint, and packet. On launch, re-read them and refuse drift with `handoff.source_changed` plus recapture guidance.
- [ ] Stop queued delivery, preserve undelivered messages in continuity, and atomically mark their source rows `cancelled` with `cross_cli_handoff` after successful launch so they cannot execute twice.
- [ ] Validate target CLI/account/model/effort/quota state and automatic handoff chain/cooldown limits before source termination.
- [ ] Persist a server claim token/expiry, create the stamped target run, persist rendered seed with `appendUserInputOnDelivery`, and start the target only after source process exit was confirmed.
- [ ] On success set source run `cancelled`; on post-stop target failure set source `needs_recovery`, leave any partial target visible as `failed`, and release the workspace fence.
- [ ] Implement launch idempotency, stale source-sequence/revision/workspace refusal, and a startup/heartbeat reconciler that adopts targets by `originHandoffId` or fails expired claims.
- [ ] Gate send, queue, retry/edit, resume, wake, auto-commit, and reconciler mutations for every run sharing a leased workspace.
- [ ] Handle target deletion by terminalizing a nonterminal handoff and releasing its fence before `ON DELETE SET NULL` runs.
- [ ] Test races: another live run in the checkout, send versus capture, capture versus quota wake, double launch, cancel versus launch, process refusing to exit, late output, workspace/HEAD drift, target spawn failure, claim expiry, orphan adoption, restart at every status, queued-message cancellation, and source/target deletion.
- [ ] Run `pnpm vitest run tests/server/handoff/coordinator.test.ts tests/server/handoff/reconciler.test.ts tests/server/quota/worker-resume.test.ts tests/server/runs/recovery-reconciler.test.ts`.

### Task 8: Expose typed HTTP/runtime APIs and observability

**Files:**
- Create: `src/server/events/handoff-events.ts`
- Modify: `src/server/events/named-events.ts`
- Create: `src/runtime/http/routes/handoffs.ts`
- Modify: `src/runtime/http/routes/index.ts`
- Modify: `src/runtime-api/types.ts`
- Modify: `src/runtime-api/domains/index.ts`
- Create: `tests/api/handoffs-route.test.ts`
- Modify: `tests/runtime/http-registry.test.ts`
- Modify: `tests/runtime/http-routes.test.ts`
- Modify: `tests/runtime/route-contract-fixture.test.ts`
- Modify: `tests/runtime/fixtures/routes.v1.json`

- [ ] Add the named handoff events and stable `error.surfaced` codes without growing `named-events.ts` with full implementation logic.
- [ ] Register create/list/get/patch/launch/cancel routes; resolve flat handoff IDs through the source run's authorization scope before returning data, and validate all IDs, enums, revisions, and selection fields.
- [ ] Return `202` for in-progress capture, `409` for ownership/revision conflicts, `422` for incompatible target selection, and stage-specific `5xx` errors only for actual server failures.
- [ ] Add typed runtime APIs; do not route handoffs through `runs.act` with `unknown` bodies.
- [ ] Ensure no HTTP or SSE response includes secrets, raw packet artifacts when only metadata is needed, or untranslated visible server prose at the UI boundary.
- [ ] Test auth/IDOR, malformed input, unsupported source mode, same-CLI target refusal, stale revision, replayed operation ID, packet retrieval, and surfaced error event payloads.
- [ ] Run `pnpm vitest run tests/api/handoffs-route.test.ts tests/runtime/http-registry.test.ts tests/runtime/http-routes.test.ts tests/runtime/route-contract-fixture.test.ts`.

### Task 9: Replace every same-run cross-CLI path

**Files:**
- Create: `src/server/workers/direct-run-type-invariant.ts`
- Create: `tests/server/workers/direct-run-type-invariant.test.ts`
- Modify: `src/server/conversations/send-message.ts`
- Modify: `src/server/conversations/create.ts`
- Modify: `src/server/supervisor/worker-failover.ts`
- Modify: `src/server/supervisor/index.ts`
- Modify: `src/server/supervisor/wake.ts`
- Modify: `src/server/supervisor/observer.ts`
- Modify: `src/server/prompts/supervisor.md`
- Modify: `src/server/credits/index.ts`
- Modify: `src/server/planning/review.ts`
- Modify: `src/server/runs/recovery.ts`
- Modify: `src/server/db/index.ts`
- Modify: `src/components/settings/ModelsSettingsPanel.tsx`
- Modify: `tests/api/conversation-messages-route.test.ts`
- Modify: `tests/supervisor/worker-failover.test.ts`
- Modify: `tests/supervisor/worker-failover-handoff-fails.test.ts`
- Modify: `tests/supervisor/worker-failover-spawn-retry.test.ts`
- Modify: `tests/supervisor/worker-failover-no-replacement.test.ts`

- [ ] First write failing tests proving: follow-up text/API cannot change a direct run's CLI; cross-provider failover returns a distinct target run; target unavailable preserves quota recovery; and direct/commit worker insertion of another type is rejected at the central assertion and SQLite trigger.
- [ ] Add `assertDirectRunWorkerTypeInvariant` before all direct/commit worker insertions and an additive SQLite `BEFORE INSERT` trigger as the final safety net. Emit `handoff.refused` at the application boundary. Do not restrict intentional multi-type supervisor implementation runs.
- [ ] In `applyWorkerPreferenceForMessage`/`reconcileDirectWorkerSelection`, reject a type change for an existing run with a typed “fork required” result; do not persist the new preferred type and do not defer it for later recreation.
- [ ] Keep same-CLI model, effort, and account recreation behavior and its current ownership fencing.
- [ ] Change `src/server/credits/index.ts` so `cross_provider` selects and returns a candidate target CLI/account without mutating source credentials; validate it is not quota-blocked or in the recent exhaustion cooldown.
- [ ] Route cross-provider quota strategy/allowed-worker selection to `coordinator.captureAndLaunch` and return `targetRunId` rather than a replacement worker ID. Enforce automatic chain depth three and recent-provider/account exclusions.
- [ ] Keep the existing `worker-failover.ts` exports as compatibility wrappers while callers/tests migrate; do not delete the file.
- [ ] Update wake/restart recovery to continue a persisted handoff rather than retrying a same-run provider spawn.
- [ ] Update supervisor prompt and settings explanation to say cross-provider recovery creates a new session.
- [ ] Rename user-visible lifecycle copy from “switching workers” to handoff/fork language while retaining legacy event parsing only where backward compatibility needs it.
- [ ] Run `pnpm vitest run tests/server/workers/direct-run-type-invariant.test.ts tests/api/conversation-messages-route.test.ts tests/supervisor/worker-failover.test.ts tests/supervisor/worker-failover-handoff-fails.test.ts tests/supervisor/worker-failover-spawn-retry.test.ts tests/supervisor/worker-failover-no-replacement.test.ts` and assert no direct/commit source run contains workers of two CLI types.

### Task 10: Build the client Manager and dialog

**Files:**
- Create: `src/interface/home/HandoffForkManager.ts`
- Create: `src/interface/home/HandoffForkDialog.tsx`
- Create: `src/components/home/CliLaunchSelectionFields.tsx`
- Modify: `src/interface/home/useHomeMutations.ts`
- Create: `tests/app/handoff-fork-manager.test.ts`
- Create: `tests/ui/handoff-fork-dialog.test.tsx`
- Modify: `shared/locales/*.json`

- [ ] Implement a Manager-owned state machine for closed/selecting/capturing/ready/editing/launching/completed/error, including source run/message IDs, revision, target selection, packet, warnings, and request token.
- [ ] Use TanStack Query only for transport/cache; the Manager is the single UI source of truth and ignores responses whose ownership token no longer matches.
- [ ] Build an accessible, responsive dialog using existing Dialog/Select/Textarea/Button/ScrollArea/Alert/Badge primitives.
- [ ] Keep dialog open/target selection read-only. Label **Prepare handoff** as the point that stops the source CLI; after preparation, cancelling releases the lease and leaves the stopped source in `needs_recovery` so the user can deliberately resume it.
- [ ] Default to the last compatible *different* CLI, exclude the source CLI, and validate account/model/effort combinations before capture/launch.
- [ ] Show authoritative sections read-only, advisory fields editable, source/provenance/warnings visible, and an explicit “current files win” note.
- [ ] Debounce or explicitly save advisory edits with `expectedRevision`; disable launch until the current edit revision is acknowledged.
- [ ] Allow recovery of the active durable draft after reload and a clear cancel action before launch for both manual and quota drafts.
- [ ] Add all visible/aria/error strings to every `shared/locales/*.json` file and subscribe with `useI18nSnapshot()`.
- [ ] Test keyboard focus, escape/cancel, mobile sizing, loading/error/retry states, stale edit conflicts, CLI exclusion, and no hard-coded user-facing JSX.
- [ ] Run `pnpm vitest run tests/app/handoff-fork-manager.test.ts tests/ui/handoff-fork-dialog.test.tsx`.

### Task 11: Wire every product entry point

**Files:**
- Modify: `src/interface/home/useConversationActions.ts`
- Modify: `src/interface/home/ExternalSessionsPicker.tsx`
- Modify: `src/components/home/HomeHeader.tsx`
- Modify: `src/components/home/ConversationMain.tsx`
- Modify: `src/components/home/RunRecoveryNotice.tsx`
- Modify: `src/interface/home/HomeApp.tsx`
- Modify: `tests/ui/conversation-actions.test.ts`
- Modify: `tests/server/external-sessions/discovery.test.ts`
- Modify: `shared/locales/*.json`

- [ ] Add **Fork to another CLI** to the session menu for eligible direct/commit runs.
- [ ] Add **Fork to another CLI from here** to user-message actions and pass the exact message ID.
- [ ] Add a distinct current-conversation fork choice to Resume CLI Session without changing external Claude/Gemini resume behavior.
- [ ] Add a quota notice action/status that opens or navigates to the automatic handoff and target run.
- [ ] Add a quota/recovery notice action that cancels an abandoned ready/capturing handoff or retries a `needs_recovery` source; do not require the lost dialog state to release a fence.
- [ ] Keep `HomeApp.tsx` as wiring only and extract any message-action UI needed to avoid growing oversized components.
- [ ] On success, select the target only if the user is still viewing the source associated with the completed request; otherwise show a non-destructive notification/link.
- [ ] Preserve ordinary “Fork session” semantics if it remains same-CLI, and make the cross-CLI wording unambiguous.
- [ ] Test eligibility, source/message payloads, no selected run, unsupported modes, selection races, external resume regression, and quota CTA behavior.
- [ ] Run `pnpm vitest run tests/ui/conversation-actions.test.ts tests/server/external-sessions/discovery.test.ts`.

### Task 12: Reconcile SSE, restart, and lifecycle recovery

**Files:**
- Modify: `src/interface/home/EventStreamStateManager.ts`
- Modify: `src/interface/home/utils.ts`
- Modify: `tests/app/event-stream-state-manager.test.ts`
- Create: `tests/lifecycle/scenarios/cross-cli-handoff-fork.test.ts`
- Create: `tests/lifecycle/scenarios/cross-cli-handoff-restart.test.ts`

- [ ] Reconcile capture/revision/launch/completion/failure events into existing run snapshots without creating optimistic fake runs.
- [ ] Fetch snapshot/active handoff after `stream.resync_required`; treat SSE as an invalidation signal and HTTP/SQLite as authority.
- [ ] Add a manual lifecycle scenario covering source activity, stable capture, packet artifact, target run/worker/seed, source stop, and no mixed CLI types.
- [ ] Add a quota scenario where the outgoing worker cannot answer, synthetic capture succeeds, and the target new run continues.
- [ ] Add restart checkpoints after `capturing`, `ready`, and `launching`; prove recovery either finishes once or surfaces a retryable failure without duplicate targets.
- [ ] Add FK/delete coverage: deleting the source removes its packet metadata/artifact while the target's seed remains readable.
- [ ] Validate every decision through `/api/events/log?since=<id>&runId=<id>` and assert named refusal/failure events exist.
- [ ] Run the focused state-manager test, then `pnpm test:lifecycle`.

### Task 13: Full verification and handoff documentation

**Files:**
- Modify only as failures require within the files already listed.
- Verify: `.gitignore`

- [ ] Re-read both architecture docs and confirm every new server decision emits a named event and every user-relevant failure emits a stable `error.surfaced` code.
- [ ] Verify every target seed was persisted through `appendUserInputOnDelivery` and no parallel conversation storage was introduced.
- [ ] Verify cross-CLI targets copy no source message rows/worker entries: only parent/message metadata plus the rendered first `user_input` packet crosses the boundary.
- [ ] Verify logs/events demonstrate confirmed source process exit before target run creation and that the direct/commit SQLite trigger rejects mixed worker types.
- [ ] Verify all visible strings use `t()` and all locale files contain the same new keys.
- [ ] Verify packet storage, test databases, generated debug packets, CLI transcripts, credentials, and temporary review output are not accidentally tracked; make only a narrow `.gitignore` addition if needed.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm vitest run`.
- [ ] Run `pnpm test:lifecycle`.
- [ ] Run the mandatory frontend build: `pnpm build:interface:web`.
- [ ] Inspect `git diff --check` and `git status --short`; preserve unrelated user changes and confirm the implementation did not create a branch, worktree, or delete files.

## Verification matrix

| Case | Expected result |
|---|---|
| Header fork, idle source | Preview uses fresh recap plus deterministic evidence; target is a new run; source is stopped. |
| Header fork, active turn | Source is generation-fenced; durable sequence settles or warning is recorded; no late output owns target state. |
| Source CLI refuses to exit | Launch is refused before target creation; source is `needs_recovery`; named failure identifies termination. |
| Another live run uses checkout | Workspace lease/preflight refuses handoff; neither source nor other run is mutated. |
| Message fork | Conversation is bounded at the message; current workspace drift is explicit; `forkedFromMessageId` is preserved. |
| Manual preview becomes stale | Sequence/HEAD/workspace fingerprint drift returns `handoff.source_changed`; user must prepare a fresh packet. |
| Resume CLI Session dialog | External resume still resumes an external provider session; current-conversation fork opens handoff flow. |
| Quota, outgoing CLI dead | No outgoing request; synthetic packet launches a distinct target run. |
| Quota, target unavailable | Source stays quota-waiting/recoverable; no target run is reported; named failure and surfaced error exist. |
| Quota handoff loop | Recent exhausted providers/accounts are excluded; depth four is refused with a visible wait/manual-recovery state. |
| Same-run text asks to switch CLI | Request is refused with fork guidance; source preferences/worker type do not change. |
| Same-CLI model/account change | Existing supported recreation path still works inside the run. |
| Already compacted source | Provider recap is advisory; post-compaction evidence and exact recent tail are included. |
| Dirty workspace before session | Pre-existing files are not claimed as session-owned; uncertainty is preserved. |
| Concurrent/external file change | Ownership becomes external/unknown; packet does not overwrite or silently attribute it. |
| Packet overflow | Highest-priority facts remain; dropped fields are named; hash is deterministic. |
| Reload while preview is ready | Active draft and revision restore from server; edits do not regress. |
| Disconnect during launch | SSE replay/snapshot returns one target; repeated operation ID is idempotent. |
| Crash after target row creation | Reconciler discovers exactly one target by `originHandoffId`, adopts or fails it, and releases the claim/lease. |
| Target deleted during launch | Handoff terminalizes and source/workspace fence releases before the target link is nulled. |
| Delete source after completion | Source metadata/artifact is cleaned; target initial seed remains self-contained. |

## Agentic user-journey candidates (approval required before running)

These browser journeys are valuable after automated tests/build pass, but they must not be run without explicit user approval because they create real local conversations and CLI activity:

1. Start a Codex direct session, make a small edit, open the header handoff dialog, inspect/edit the packet, fork to Claude, verify the new sidebar session and source preservation, then clean up the test conversations/artifacts.
2. Fork from an earlier user message and confirm the preview distinguishes historical conversation state from the current checkout.
3. Simulate/induce a quota-waiting source through supported test controls, select cross-provider recovery, verify the synthetic packet and target navigation, then clean up.
4. Reload the browser while a handoff preview is open and while launch is completing; verify restoration, SSE replay, and no duplicate target.

## Implementation guardrails

- Begin implementation by rechecking `git status --short`; the current worktree already contains user changes. Never overwrite, revert, or reformat unrelated edits.
- Do not create a branch or worktree and do not delete any file.
- Keep new logic out of `HomeApp.tsx`, `ConversationMain.tsx`, `runs/recovery.ts`, and `worker-failover.ts` except thin integration/delegation because all are already oversized.
- Use `src/server/git/command.ts` or existing async helpers for git evidence; avoid synchronous shell calls in request paths.
- Never log or emit the full packet in named events, errors, or ordinary server logs.
- Never pass translated strings through transactions or persist translated UI copy.
- Never treat an LLM-generated summary as proof that a file changed, a test passed, or a command ran.
- Do not add configurable frontend strings/settings through `.env`; packet limits are code constants.
- Clean up test conversations and persisted artifacts after any approved live/agentic validation.
--- UPDATED PLAN END ---

uuid: 6e36060b-49e2-47c4-b5cf-e8d7af64041b
parent: dd788a6a-8621-4d23-8653-48dc2d77069e

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-08-20T18:13:04.198Z","phase":null} -->
## Claude thinking · 2026-08-20T18:13:04.198Z



uuid: 7398fff4-206a-4abe-934f-929b26ae156e
parent: 6e36060b-49e2-47c4-b5cf-e8d7af64041b

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-08-20T18:13:34.102Z","phase":null} -->
## Claude · 2026-08-20T18:13:34.102Z


::write::
{"file_path":"/Users/masterman/.claude/plans/you-are-a-read-only-happy-otter.md","content":"# Architecture Review — Cross-CLI Hybrid Handoff Fork (revision 2)\n\n## Context\n\nRead-only review of the updated implementation plan for cross-CLI handoff forks. The\nprevious review returned HARDEN with 20 findings; the author revised the artifact and\nrequested a re-review that reports only remaining blockers. Judgment is based solely on\nthe supplied artifact — no repository access was used.\n\nThe revision resolves the substantive findings from the first pass: three-phase launch\nordering with confirmed source process exit, a normalized-workspace lease, post-stop\ncapture plus launch-time drift refusal, a persisted claim token with `runs.originHandoffId`\nand a startup reconciler, terminal-failure retry via new rows, target-delete fence release,\ncanonical hashing excluding `generatedAt`, nonce-fenced seed rendering, redaction ordering\nand `projectRootLabel` path privacy, quota chain-depth and cooldown guards, `copyMessagePrefix:\nfalse` for cross-CLI targets, queued-row cancellation, visible failed target runs, IDOR checks\non flat handoff routes, the central spawn assertion plus SQLite trigger, exact test paths, and\ngreen task sequencing.\n\n## Verdict\n\n**HARDEN** — seven remaining blockers, all consequences of the new terminate-first ordering\nnot being propagated consistently through the artifact.\n\n## Remaining blockers\n\n1. **No-live-worker capture path is undefined, and the quota post-failure status contradicts\n   itself.** The capture sequence assumes an active worker (advance turn generation → interrupt\n   → wait for settle → terminate → confirm exit). The quota case — the most common automatic\n   path — begins with an already-dead or quota-blocked worker, as does retrying a `needs_recovery`\n   source or forking an idle run. Define an explicit skip-termination branch that verifies no live\n   runtime ownership and proceeds directly to capture. Then reconcile the contradiction: product\n   decision 2 and the coordinator set a post-stop launch failure to `needs_recovery`, while user\n   journey 5 and the \"Quota, target unavailable\" matrix row still promise the source \"stays\n   quota-waiting/recoverable.\" State which status the source lands in for the quota path and\n   whether the existing wake scheduler still auto-resumes it at quota reset; otherwise a failed\n   cross-provider handoff silently destroys the pending quota recovery.\n\n2. **`ready` drafts leak the workspace lease and leave the source terminated indefinitely.** The\n   unique partial index covers `capturing|ready|launching`, but claim expiry and the reconciler are\n   specified only for `capturing`/`launching`. After \"Prepare handoff\" the source CLI is dead and\n   the whole checkout is fenced; an abandoned tab or a client that never returns holds that state\n   forever with no server-side release. Give `ready` a TTL or client heartbeat, define what expiry\n   does (terminalize, release the lease, emit `handoff.failed`/`handoff.cancelled`, leave the source\n   recoverable), and state the user-visible consequence for an in-progress edit.\n\n3. **`needs_recovery` is overloaded across three distinct meanings.** It now marks (a) a source\n   deliberately stopped mid-handoff during a normal preview, (b) a source stranded by post-stop\n   launch failure, and (c) a genuinely crashed run. `RunRecoveryNotice`, `recovery-reconciler`,\n   `wake`, and any auto-retry cannot behave correctly without distinguishing them, and case (a) —\n   the happy path — will render an alarming recovery banner for the entire preview window. Persist\n   a handoff-stage marker on the run (or a dedicated status) and specify how each consumer branches\n   on it.\n\n4. **`workspace_fingerprint` is never defined, so drift refusal is unimplementable as written.** It\n   is a fence field, a launch precondition, and the trigger for `handoff.source_changed`, but the\n   artifact never says what it hashes. If it includes untracked or ignored paths or working-tree\n   content, ordinary background activity — editors, formatters, language servers, build caches —\n   will make manual launch fail perpetually, and since \"never silently auto-revises\" forces a fresh\n   capture each time, the user cannot escape the loop. Specify the inputs (recommend HEAD plus\n   tracked-file porcelain status, excluding untracked/ignored), and specify the recapture affordance\n   presented on drift.\n\n5. **The target run's git baseline is contradictory.** Task 6 says the fork preserves the source's\n   \"git baseline/workspace metadata,\" while the coordinator captures a post-stop HEAD/status that the\n   packet describes. If the target inherits the source's original baseline, every change the source\n   session made is attributed to the target's own session; if it inherits post-stop HEAD, the packet\n   and baseline agree. Choose explicitly and state it in `fork.ts`. Relatedly, specify whether a final\n   auto-commit runs before termination or is deliberately skipped — `commitsCreated`, `currentHead`,\n   `dirtyBeforeSession`, and the target baseline all depend on the answer, and terminating mid-edit\n   can leave partially written files that the packet must flag.\n\n6. **User journeys and two matrix rows still describe the superseded ordering.** Manual journey step 5\n   reads \"creates a new run, persists the packet…, starts the selected CLI, stops the source\" — the\n   exact interleaving the revision was meant to eliminate — and step 3 describes capture without\n   mentioning termination. The \"Header fork, idle source\" and \"Header fork, active turn\" rows describe\n   generation fencing with no confirmed process exit. An implementer working from the journeys will\n   build the wrong sequence. Rewrite them to the three-phase order. In the same pass, address that\n   \"Fork to another CLI from here\" on an old message now terminates a running conversation: state that\n   the message entry point routes through the same explicit Prepare-handoff confirmation with copy\n   that names the stop.\n\n7. **The SQLite trigger is underspecified in three ways.** (a) It must distinguish direct/commit runs\n   from supervisor implementation runs, which are explicitly allowed to hold multiple worker types —\n   name the discriminator the trigger reads. (b) State the migration behavior on existing databases\n   that already contain mixed-type direct runs: trigger creation must succeed and must not retroactively\n   fail on pre-existing rows. (c) A raw trigger abort surfaces as a SQLite exception, not the typed\n   `handoff.refused` result; specify the mapping so the safety net cannot produce a 500 with untranslated\n   prose. While there, register `handoff.packet_version_unsupported` in the named-event/error-code lists —\n   it is introduced in the API section but appears in neither.\n"}
::/write::

uuid: 4d3cd5da-bd8f-471b-9fbf-822facc209ba
parent: 7398fff4-206a-4abe-934f-929b26ae156e

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-08-20T18:16:36.847Z","phase":null} -->
## Claude state: queue-operation · 2026-08-20T18:16:36.847Z

````text
{
  "type": "queue-operation",
  "operation": "enqueue",
  "timestamp": "2026-08-20T18:16:36.847Z",
  "sessionId": "23684cf2-66e9-47ff-ada1-76c62f4558a0",
  "content": "I resolved all seven remaining blockers: explicit no-live-runtime branch; quota preflight versus post-stop status and wake preservation; ready TTL/heartbeat/expiry UI; runs.activeHandoffId and recovery reasons; exact tracked-diff workspace fingerprint plus recapture; fresh post-stop target git baseline with auto-commit settlement/no final commit; corrected journeys/matrix/message confirmation; and exact SQLite discriminator/legacy behavior/error mapping plus packet-version code.\n\nReview the complete updated artifact one final time. Judge only the artifact. Return exactly READY if it is implementation-ready, otherwise HARDEN followed only by remaining concrete blockers. Do not write files, use tools, repeat resolved findings, or suggest optional enhancements.\n\n--- UPDATED PLAN START ---\n\n# Feature Implementation Plan\n\n> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax.\n\n**Feature:** Cross-CLI Hybrid Handoff Fork\n\n**Goal:** Let a user fork any direct-control conversation into a new session running on a different CLI, carrying a compact, inspectable hybrid handoff packet; use the same new-run mechanism when cross-provider quota recovery is selected, and make same-run cross-CLI switching impossible.\n\n**Architecture:** A server-owned handoff coordinator freezes the source at a durable worker-stream sequence, gathers bounded deterministic evidence, optionally adds a semantic summary, compiles and persists a versioned packet, and launches a completely separate target run. SQLite stores lifecycle metadata; the append-only artifact store holds packet versions; the target worker stream receives the rendered packet as its first `user_input`. The source run is preserved as stopped history. Same-CLI model/account recovery may continue inside a run, but changing the CLI/provider always crosses a run boundary.\n\n**Tech Stack:** TypeScript, React, TanStack Query, global Manager classes, Drizzle + SQLite, append-only JSONL artifacts, existing runtime HTTP registry/API adapters, named SSE events, Vitest, lifecycle HTTP/SSE scenarios, existing shadcn/ui primitives, and locale JSON files.\n\n**North Star Product:** A user can move work between CLI ecosystems without pretending their provider sessions, recovery semantics, or transcripts are interchangeable. The new agent starts with the smallest trustworthy continuation context, the source remains auditable, and failures never strand or silently mutate either conversation.\n\n**Current Milestone:** Ship cross-CLI handoff forks for direct/commit conversations from the session menu, an individual message, the existing Resume CLI Session dialog, and quota recovery. The packet is editable where it is advisory, inspectable after launch, bounded, redacted, restart-safe, and synthesized without contacting an exhausted provider when necessary.\n\n**Future Product Direction:** Reuse the packet format for export/import and cross-device handoff only after this milestone proves the provenance, recovery, and deletion model. Do not add same-run CLI switching, background multi-agent continuation, or automatic worktree creation in this milestone.\n\n**Final Functionality Standard:** Every cross-CLI transition creates a new run and target worker stream; no server path can recreate a worker under another CLI in the source run. The packet accurately identifies uncertainty and pre-existing workspace changes, survives a process restart, excludes secrets and hidden reasoning, and produces enough observability to explain every capture, launch, refusal, and failure.\n\n---\n\n## Product decisions and non-goals\n\n1. **A CLI handoff is a fork, never a resume.** “Resume external session” keeps its existing meaning. “Fork current conversation to another CLI” creates a new OmniHarness run with `parentRunId` and an optional `forkedFromMessageId`.\n2. **The source is historical after a successful launch.** Before target creation, terminate any live source CLI process and confirm it exited; if no live runtime owns the source, verify that fact and skip interruption/termination. On success set the source run to `cancelled`, retain its transcript and artifacts, and select the target run in the UI. If target launch fails after source termination, restore `quota_waiting` when a durable future quota wake exists; otherwise set `needs_recovery`. Never keep two CLIs editing the same checkout concurrently.\n3. **The packet is hybrid.** Deterministic state is authoritative; generated summaries and outgoing-agent reports are advisory. Current disk state wins over prose.\n4. **Manual and quota paths share one coordinator.** Manual entry points offer a preview. A quota-triggered cross-provider handoff may launch without waiting for an exhausted CLI, then exposes the persisted packet for inspection.\n5. **Only advisory content is user-editable.** The user may amend objective, status, next steps, blockers, notes, and relevant-file explanations. Source IDs, stream sequence, git evidence, verification records, target selection, provenance, and hash are server-owned.\n6. **No full transcript or full diff by default.** The packet contains a short exact tail plus summaries, file-level evidence, and compact error/test output. The source run remains the place to inspect full history.\n7. **No hidden reasoning.** Never copy `thought`, chain-of-thought, raw environment, credentials, authorization headers, binary attachments, or unrestricted tool output into a packet.\n8. **No automatic worktree.** This feature uses the current checkout and avoids concurrency by stopping the source. Existing explicit worktree fork actions remain separate.\n9. **No file deletion is part of this plan.** Refactor existing modules in place or add focused modules; preserve project history and user changes.\n\n## User journeys\n\n### Manual fork from the session\n\n1. The user opens the session menu and selects **Fork to another CLI**.\n2. The dialog defaults to a different available CLI and offers compatible account, model, and effort choices.\n3. The user explicitly chooses **Prepare handoff**, acknowledging that any live source CLI will stop. The server gracefully interrupts then terminates it (or verifies no live runtime exists), confirms exit, captures the final stable boundary, and returns a compact preview with provenance and warnings.\n4. The user may edit advisory notes, then launches.\n5. At launch OmniHarness revalidates target and source/workspace fingerprints. Because source exit was already confirmed, it creates the new run, persists the packet as the target's initial user input, starts the selected CLI, marks the source `cancelled`, and selects the target in the sidebar.\n\n### Fork from a message\n\n1. The user chooses **Fork to another CLI from here** on a user message and receives the same explicit **Prepare handoff** confirmation that names the source stop; selecting an old message never bypasses termination.\n2. Candidate collection ignores superseded/later conversation entries but compares against the current workspace, explicitly warning when files contain changes made after the selected message.\n3. The rest of the flow is the same as the manual session fork.\n\n### Fork from Resume CLI Session\n\n1. The existing dialog clearly separates **Resume external session** from **Fork current conversation**.\n2. The fork option appears only with an eligible selected OmniHarness direct/commit run.\n3. Choosing it opens the same handoff dialog, not a provider-session resume flow.\n\n### Cross-provider quota recovery\n\n1. A CLI reaches a durable quota-waiting state.\n2. Same-provider account/model recovery may use existing same-CLI recovery.\n3. If the selected strategy requires another CLI/provider, the server synthesizes a packet from persisted evidence and creates a new run.\n4. The exhausted source is never prompted for a handoff and never receives a replacement worker of another type.\n5. If preflight finds no target, the untouched source stays `quota_waiting` with its wake schedule. If launch fails after source termination, restore `quota_waiting` when a durable future wake exists; otherwise use `needs_recovery`. In both cases the error names the failed stage.\n\n## Compact handoff packet contract\n\nCreate a versioned `HybridHandoffPacketV1` with the following logical shape. Use stable IDs and enums rather than translated labels.\n\n```ts\ntype HybridHandoffPacketV1 = {\n  handoffVersion: 1;\n  source: {\n    runId: string;\n    workerId: string | null;\n    workerType: SupportedWorkerType | null;\n    forkedFromMessageId: string | null;\n    sourceSeq: number | null;\n    interruptionReason: \"manual_session\" | \"manual_message\" | \"quota_exhausted\";\n    generatedAt: string;\n  };\n  target: {\n    workerType: SupportedWorkerType;\n    model: string | null;\n    effort: string | null;\n    accountId: string | null;\n  };\n  task: {\n    originalRequest: string | null;\n    currentObjective: string | null;\n    acceptanceCriteria: string[];\n    userConstraints: string[];\n  };\n  state: {\n    completed: string[];\n    inProgress: string[];\n    remaining: string[];\n    blockers: string[];\n    openQuestions: string[];\n    rejectedApproaches: Array<{ approach: string; reason: string }>;\n  };\n  decisions: Array<{ decision: string; reason: string | null; evidence: string[] }>;\n  workspace: {\n    projectRootLabel: string;\n    baselineCommit: string | null;\n    currentHead: string | null;\n    dirtyBeforeSession: boolean | null;\n    modifiedFiles: Array<{\n      path: string;\n      changeType: \"added\" | \"modified\" | \"deleted\" | \"renamed\" | \"unmerged\";\n      ownership: \"session\" | \"probable_session\" | \"preexisting\" | \"external\" | \"unknown\";\n      summary: string | null;\n      evidence: string[];\n    }>;\n    untrackedFiles: string[];\n    relevantUnchangedFiles: string[];\n    commitsCreated: string[];\n  };\n  verification: Array<{\n    command: string;\n    result: \"passed\" | \"failed\" | \"unknown\";\n    exitCode: number | null;\n    importantOutput: string | null;\n  }>;\n  artifacts: {\n    plans: string[];\n    specs: string[];\n    generatedOutputs: string[];\n  };\n  continuity: {\n    recentUserMessages: string[];\n    recentAssistantSummary: string | null;\n    pendingUserInput: string | null;\n    queuedMessages: string[];\n  };\n  provenance: {\n    summarySource: \"outgoing_worker\" | \"recent_assistant\" | \"synthetic\" | \"hybrid\";\n    omittedSections: string[];\n    confidenceWarnings: string[];\n    truncatedFields: string[];\n  };\n};\n```\n\nCompilation rules:\n\n- Set an explicit 36,000-character rendered-packet ceiling (roughly 6,000–10,000 tokens depending on content), plus per-field item and character limits. Keep the constants in code, not environment variables.\n- Prioritize source identity and sequence, user constraints, current objective, blockers/errors, file evidence, verification, decisions, queued input, then recent conversational tail. Drop completed prose first.\n- Stable-sort every deterministic collection so the same redacted nonvolatile evidence yields the same semantic content hash; `generatedAt` may differ without changing that hash.\n- Reuse a recent assistant recap only as advisory text. It is “fresh” only if its worker sequence is at or after the last included tool/result lifecycle boundary; otherwise include it with a stale-summary warning.\n- Ask an outgoing worker for a structured report only when it is idle/responsive and not quota-blocked. Bound the request timeout. Never delay quota recovery on this call.\n- For a hard interruption, synthesize entirely from the worker stream, execution events, messages/queued messages, run metadata, git evidence, and known artifacts.\n- For a message fork, cap conversation candidates at that message/stream boundary while computing workspace state at capture time; call out the mismatch rather than claiming the checkout was rewound.\n- Render advisory narrative inside an explicit untrusted-data boundary telling the target to verify disk state. Do not let tool/assistant text masquerade as system instructions.\n- Run redaction before budgeting, canonicalization, hashing, preview extraction, rendering, logging, or event emission. Apply it to every structured text field and to the final rendered seed, including verification output, blockers, decision evidence, queued text, and outgoing-worker reports.\n- Keep the absolute `projectPath` only in server-side run/handoff metadata for access and launch checks. The packet/API uses a non-sensitive `projectRootLabel` such as the repository directory name; all file evidence is project-relative.\n- Hash the NFC-normalized, fixed-key-order canonical packet while excluding only volatile `generatedAt`. Target selection remains hash input, so changing it creates a new hash/revision.\n- Render untrusted content inside a randomly generated, high-entropy nonce fence created after sanitization. Reject/regenerate a nonce that occurs in content, encode the interior as canonical JSON, and test delimiter/system/tool-frame imitation. The renderer's nonce is not part of the semantic packet hash.\n\n## State machine and invariants\n\nPersist these statuses: `capturing -> ready -> launching -> completed`, with terminal `failed` and `cancelled`. Only `capturing`, `ready`, and `launching` are nonterminal and covered by active-handoff uniqueness. Retrying a terminal failure always creates a new handoff row linked to the failed attempt; it never resurrects the terminal row.\n\nThe coordinator owns an immutable launch fence:\n\n```ts\n{\n  handoffId,\n  revision,\n  sourceRunId,\n  sourceWorkerId,\n  sourceSeq,\n  workspaceFingerprint,\n  targetSelectionHash\n}\n```\n\nServer invariants:\n\n- At most one nonterminal handoff exists for a source run and normalized project path. A persistent workspace lease plus an in-process keyed mutex serializes capture/launch; every other OmniHarness mutation path for a run sharing that project refuses while the lease is active. Before capture, also refuse when another live run already owns a worker in the same checkout.\n- New messages, queued-message delivery, retry/edit recovery, manual resume, quota wake, auto-commit, and reconciler actions refuse with `409 handoff_in_progress` while the source workspace is fenced.\n- Opening the dialog is read-only. The explicit **Prepare handoff** action acquires the lease. If the source owns a live runtime, advance turn generation, request graceful interruption, wait up to `HANDOFF_STREAM_SETTLE_TIMEOUT_MS`, terminate the CLI process, and confirm process exit/no runtime ownership. If it is idle, quota-blocked, or already stopped, verify that no PID/live runtime owns it and skip the interruption/termination steps. If absence/exit cannot be confirmed, fail capture and do not create a target.\n- Before termination, disable new source auto-commit scheduling and await any in-flight auto-commit under the workspace lease; do not manufacture a final commit. After confirmed source absence/termination, set `runs.activeHandoffId`, use `needs_recovery` internally, and capture the final durable worker sequence and git state. UI/recovery consumers seeing `activeHandoffId` render the handoff draft state instead of a generic crash banner. `ready`/`launching` remain handoff statuses, not new run statuses.\n- Define `workspaceFingerprint` as SHA-256 over a canonical sequence containing HEAD, `git diff --binary --no-ext-diff`, and `git diff --cached --binary --no-ext-diff`, with NFC-normalized project-relative path records. Exclude untracked and ignored files from the drift fence to avoid editor/build-cache churn; still list capture-time untracked files in the packet with a warning that they are not launch-fenced.\n- Launch first validates CLI availability, target account/model/effort compatibility, quota state, project path, source revision, and target selection without mutating source or target. It then re-reads the durable sequence and workspace fingerprint. Any drift refuses with `handoff.source_changed` and requires a new capture/preview; it never silently auto-revises a packet the user already reviewed.\n- The target run and worker are created under the existing run/quota mutation controls. The rendered seed is persisted with `appendUserInputOnDelivery` in the target's unified worker stream before prompting the CLI.\n- `launch` is idempotent. Persist a server-generated launch claim token and expiry before target creation, and stamp the target `runs.originHandoffId` before worker creation. Repeating the operation returns the discovered existing `targetRunId`; a stale revision gets `409 handoff_revision_conflict`.\n- Every nonterminal handoff carries a lease expiry. `capturing`/`launching` use server heartbeats; the client renews a `ready` lease while the preview is open, capped at `HANDOFF_READY_MAX_LIFETIME_MS = 15 minutes`. A startup/heartbeat reconciler fails expired states, discovers targets by `originHandoffId`, adopts the one target where applicable, clears `runs.activeHandoffId`, releases the workspace fence, and emits the exact decision. Expired `ready` edits are not saved; the UI reports expiry and offers a fresh prepare.\n- Mark `completed` only after target creation, target seed persistence, and worker launch acceptance. Set the already-terminated source run to `cancelled`, mark carried queued messages `cancelled` with a `cross_cli_handoff` reason, and persist the source-to-target link in the completed handoff row.\n- A target launch failure never manufactures success and never deletes persisted rows. Mark any partially created target run `failed` and visible for diagnosis. Clear `runs.activeHandoffId`; if the source has a durable future quota wake, restore `quota_waiting` without clearing its quota incident/schedule so the same CLI can auto-resume at reset, otherwise set `needs_recovery` with recovery reason `handoff_post_stop_failure`. Release the workspace fence and emit the decision.\n- Cancellation applies to manual and quota-created nonlaunching handoffs. The dialog and `RunRecoveryNotice` both expose it. Cancellation/expiry clears `runs.activeHandoffId`, releases the lease, and restores `quota_waiting` when a durable future wake exists or `needs_recovery` otherwise. Recovery UI and reconcilers branch on active handoff ID/reason rather than treating all `needs_recovery` states alike.\n- Deleting the source removes its handoff metadata/artifact stream through existing run cleanup; the target remains independently understandable because its initial worker stream contains the rendered seed.\n- Deleting a target while its handoff is nonterminal first terminalizes the handoff and releases the source/workspace fence; `ON DELETE SET NULL` is not relied on as lifecycle logic.\n- Same-run recreation must reject a requested worker type different from an existing direct/commit run's CLI. Enforce this in a shared spawn assertion and a SQLite `BEFORE INSERT` safety trigger, not only at callers. Model, effort, or account changes within the same CLI remain allowed where currently supported. Supervisor implementation runs retain their intentional multi-worker behavior.\n- Automatic quota handoff walks handoff/parent lineage. Refuse after `MAX_AUTOMATIC_HANDOFF_DEPTH = 3`, exclude providers/accounts exhausted in the last two handoffs, enforce a cooldown, and verify the target account has no open quota incident before source termination.\n\n## File map\n\n### Create\n\n- `src/shared/handoff.ts` — packet, lifecycle, API DTO, edit-patch, and error-code contracts shared by server/client.\n- `src/server/handoff/candidates.ts` — bounded candidate reads from unified worker streams, messages, queued messages, events, and artifacts.\n- `src/server/handoff/workspace-state.ts` — read-only git baseline/current evidence and file ownership classification.\n- `src/server/handoff/redaction.ts` — path-safe text normalization, secret/tool-output filtering, and size limits.\n- `src/server/handoff/compiler.ts` — authoritative/advisory merge, priority budgeting, deterministic ordering, provenance, hash, and renderer input.\n- `src/server/handoff/store.ts` — SQLite metadata and append-only packet-version persistence.\n- `src/server/handoff/coordinator.ts` — capture/preview/edit/launch state machine, source fence, idempotency, and failure recovery.\n- `src/server/handoff/reconciler.ts` — startup/heartbeat recovery for expired capture/launch claims and orphan target adoption.\n- `src/server/runs/fork.ts` — extracted generic new-run fork creation used by legacy message forks and handoff launches.\n- `src/server/workers/direct-run-type-invariant.ts` — central direct/commit worker-type assertion used before worker insertion; emits typed refusal.\n- `src/server/events/handoff-events.ts` — focused named-event union for import into the existing event contract.\n- `src/runtime/http/routes/handoffs.ts` — create/list/get/patch/launch HTTP handlers and validation.\n- `src/interface/home/HandoffForkManager.ts` — single source of truth for dialog draft, server revision, request ownership, pending stages, and errors.\n- `src/interface/home/HandoffForkDialog.tsx` — target picker, packet preview/editor, warnings, and launch result UI.\n- `src/components/home/CliLaunchSelectionFields.tsx` — reusable CLI/account/model/effort controls for the handoff dialog without duplicating composer selection logic.\n- `tests/server/handoff/compiler.test.ts` — packet priority, freshness, deterministic hash, truncation, and rendering tests.\n- `tests/server/handoff/candidates.test.ts` — bounded stream/event/queued-message and message-boundary tests.\n- `tests/server/handoff/workspace-state.test.ts` — baseline/current classification and path-safety tests.\n- `tests/server/handoff/redaction.test.ts` — credentials, environment, hidden reasoning, malicious content, and byte-limit tests.\n- `tests/server/handoff/store.test.ts` — revisions, active-handoff uniqueness, idempotency, and cascade tests.\n- `tests/server/handoff/coordinator.test.ts` — state transitions, source fences, synthetic fallback, target failures, and launch idempotency.\n- `tests/server/handoff/reconciler.test.ts` — expired claim, orphan target adoption, target deletion, and fence-release tests.\n- `tests/server/workers/direct-run-type-invariant.test.ts` — application assertion and SQLite trigger safety-net tests.\n- `tests/api/handoffs-route.test.ts` — route validation/auth/contract/error responses.\n- `tests/app/handoff-fork-manager.test.ts` — stale-response ownership, retry, selection, and close/reopen behavior.\n- `tests/ui/handoff-fork-dialog.test.tsx` — translated copy, accessibility, advisory-only editing, and responsive states.\n- `tests/lifecycle/scenarios/cross-cli-handoff-fork.test.ts` — manual and quota cross-CLI lifecycle scenario over HTTP/SSE.\n- `tests/lifecycle/scenarios/cross-cli-handoff-restart.test.ts` — restart, replay, idempotent launch, and deletion scenario.\n\n### Modify\n\n- `src/server/db/schema.ts` — add `conversationHandoffs` metadata table and indexes.\n- `src/server/db/index.ts` — additive schema initialization/migration and database version bump.\n- `src/server/artifacts/stream-types.ts` — add the `handoff_packets` run-level stream kind.\n- `src/server/artifacts/append-only-store.ts` — map the new stream to `handoff-packets.jsonl`.\n- `src/server/handoff/request.ts` — make the outgoing summary request reason-neutral, structured, bounded, and optional.\n- `src/server/handoff/parser.ts` — parse advisory report fields into the versioned candidate contract without treating them as facts.\n- `src/server/handoff/render.ts` — render the versioned packet and remove quota-only wording.\n- `src/server/git/auto-commit.ts` — extract/reuse baseline parsing needed by read-only workspace evidence without synchronous shell work on the hot path.\n- `src/server/runs/recovery.ts` — delegate legacy retry/edit/fork run creation to focused services; do not grow this 1,300+ line module.\n- `src/server/supervisor/worker-failover.ts` — retain compatibility exports but route cross-CLI cases to the new-run handoff coordinator; do not spawn another CLI in the source run.\n- `src/server/supervisor/index.ts` and `src/server/supervisor/wake.ts` — consume target-run outcomes and preserve quota recovery semantics across restart.\n- `src/server/supervisor/observer.ts` — record pending cross-CLI handoff intent instead of only same-run failover intent.\n- `src/server/conversations/send-message.ts` — reject text/composer-driven cross-CLI changes inside an existing run and preserve same-CLI model/account recreation only.\n- `src/server/conversations/create.ts`, `src/server/supervisor/index.ts`, `src/server/planning/review.ts`, and `src/server/runs/recovery.ts` — call the central direct/commit worker-type assertion before worker insertion; supervisor implementation multi-worker behavior remains allowed.\n- `src/server/conversations/queued-messages.ts`, `src/server/conversations/queued-message-interrupt.ts`, `src/server/quota/worker-resume.ts`, and `src/server/runs/recovery-reconciler.ts` — enforce the persisted handoff fence before source mutation/recovery.\n- `src/server/prompts/supervisor.md` — describe cross-provider recovery as a new-session handoff, not an in-session worker swap.\n- `src/server/credits/index.ts` — make `cross_provider` return a target CLI/account candidate for the handoff coordinator rather than mutating the source worker account.\n- `src/server/events/named-events.ts` — import the focused handoff event union, add stable surfaced error codes, and avoid embedding packet bodies in SSE.\n- `src/runtime/http/routes/index.ts` — register handoff routes.\n- `src/runtime-api/types.ts` and `src/runtime-api/domains/index.ts` — add typed `handoffs` operations.\n- `src/interface/home/useHomeMutations.ts` — add query/mutations for preview, edit, launch, and active-draft lookup; switch selection only under matching request ownership.\n- `src/interface/home/useConversationActions.ts` — route session/message cross-CLI actions into `HandoffForkManager`; retain ordinary same-run message retry/edit behavior.\n- `src/interface/home/ExternalSessionsPicker.tsx` — separate external resume from the new current-conversation fork option.\n- `src/components/home/HomeHeader.tsx` — add the session-level entry point.\n- `src/components/home/ConversationMain.tsx` — add the per-message entry point through a small extracted action component or callback; do not grow this 1,600+ line file.\n- `src/components/home/RunRecoveryNotice.tsx` — add quota handoff status/action and target-run navigation.\n- `src/interface/home/HomeApp.tsx` — mount/wire the lazy dialog and manager only; move logic out of this 1,700+ line file.\n- `src/interface/home/EventStreamStateManager.ts` and `src/interface/home/utils.ts` — reconcile handoff lifecycle events and target selection without optimistic run fabrication.\n- `src/components/settings/ModelsSettingsPanel.tsx` — clarify that `cross_provider` opens a new handoff session while same-provider strategies stay in the current CLI.\n- `shared/locales/*.json` — add every new visible label, description, warning, status, aria label, and error fallback to all locales.\n- `tests/db/schema.test.ts`, `tests/supervisor/worker-failover.test.ts`, `tests/supervisor/worker-failover-handoff-fails.test.ts`, `tests/supervisor/worker-failover-spawn-retry.test.ts`, `tests/supervisor/worker-failover-no-replacement.test.ts`, `tests/api/conversation-messages-route.test.ts`, `tests/ui/conversation-actions.test.ts`, `tests/app/event-stream-state-manager.test.ts`, `tests/runtime/http-registry.test.ts`, `tests/runtime/http-routes.test.ts`, `tests/runtime/route-contract-fixture.test.ts`, and `tests/runtime/fixtures/routes.v1.json` — update existing expectations around the new-run invariant.\n- `docs/architecture/lifecycle-observability-and-testing.md` — document handoff decisions/events and the source/target recovery model before adding server state transitions.\n- `docs/architecture/worker-conversation-stream.md` — document that the target handoff seed is an ordinary first `user_input`, not a parallel transcript.\n- `.gitignore` — verify packet temp/debug output cannot be tracked; add only a narrowly scoped ignore if implementation introduces a local debug artifact.\n\n## API and persistence design\n\n### SQLite metadata\n\nAdd `conversation_handoffs` with:\n\n- `id` primary key.\n- `source_run_id` foreign key to `runs` with `ON DELETE CASCADE`.\n- `source_worker_id` nullable foreign key to `workers` with `ON DELETE SET NULL`.\n- `target_run_id` nullable foreign key to `runs` with `ON DELETE SET NULL`.\n- `forked_from_message_id`, `reason`, `status`, `revision`, `source_seq`, `normalized_project_path`, and `workspace_fingerprint`.\n- `target_worker_type`, `target_model`, `target_effort`, `target_account_id`, `target_selection_hash`.\n- `packet_version`, `artifact_seq`, `packet_hash`, `packet_preview`, `summary_source`.\n- `operation_id`, `launch_claim_token`, `claim_expires_at`, `retry_of_handoff_id`, `last_error`, `created_at`, `updated_at`, and `completed_at`.\n- Unique partial indexes for one `capturing|ready|launching` handoff per source run and normalized project path, plus indexes for target run, claim expiry, and status/update time.\n\nAdd nullable indexed `runs.origin_handoff_id` and `runs.active_handoff_id`. `origin_handoff_id` is written in the same transaction as target run creation, deliberately has no cascading foreign key, and lets restart recovery discover a target even if the process died before `conversation_handoffs.target_run_id` was updated. `active_handoff_id` distinguishes an intentionally prepared source from an ordinary `needs_recovery` run and is cleared on every terminal transition.\n\nKeep the full packet out of SQLite. Append every ready/revised packet as an `ArtifactRecordEnvelope<HybridHandoffPacketV1>` in the source run's `handoff_packets` stream and point metadata at the current sequence/hash. Store only a bounded, redacted preview for list/recovery UI.\n\n### HTTP contract\n\n- `POST /api/runs/:runId/handoffs` — create or return the active draft. Body: fork point, reason, and target selection. Returns `202 capturing` or `200 ready` with metadata/packet DTO.\n- `GET /api/runs/:runId/handoffs?active=1` — restore a durable draft after reload.\n- `GET /api/handoffs/:handoffId` — inspect the current packet/revision/result.\n- `PATCH /api/handoffs/:handoffId` — patch advisory fields with `expectedRevision`; return `409` on stale revision.\n- `POST /api/handoffs/:handoffId/launch` — idempotent launch with `expectedRevision`, `operationId`, and final target selection; return the target run/worker IDs.\n- `POST /api/handoffs/:handoffId/cancel` — release any nonlaunching manual or quota draft fence. A launching/completed handoff cannot be cancelled; the reconciler owns abandoned launch claims.\n\nEvery flat `/api/handoffs/:handoffId` handler must resolve the source run and apply the same project/run authorization check as run-scoped endpoints before reading or mutating anything. Include an IDOR test using an authenticated caller without access to the source project. Cancellation covers every nonlaunching manual or quota draft.\n\nThere are no persisted V0 packet artifacts to migrate: the existing parser/request/render path produces ephemeral reports only. Treat those reports as advisory candidates when creating V1. If a future/unknown artifact version is encountered, retain it on disk, refuse to render it, surface `handoff.packet_version_unsupported`, and require a fresh V1 capture.\n\nReturn typed stage-specific errors. User-relevant failures also emit `error.surfaced` with stable codes `handoff.capture_failed`, `handoff.revision_conflict`, `handoff.target_unavailable`, `handoff.source_changed`, `handoff.launch_failed`, and `handoff.packet_version_unsupported`; register every code in the named-event typed union.\n\n### Named events\n\nEmit these via `emitNamedEvent` for every server decision:\n\n- `handoff.capture_started`\n- `handoff.packet_ready`\n- `handoff.packet_revised`\n- `handoff.launch_started`\n- `handoff.completed`\n- `handoff.cancelled`\n- `handoff.failed`\n- `handoff.refused`\n\nEvents carry IDs, revisions, stage, source/target IDs, target worker type, reason, and stable error code where relevant. They never carry the full packet. All event frames retain the existing SSE ID/replay/resync behavior.\n\n## Implementation tasks\n\n### Task 1: Document the invariant and preserve a green baseline\n\n**Files:**\n- Modify: `docs/architecture/lifecycle-observability-and-testing.md`\n- Modify: `docs/architecture/worker-conversation-stream.md`\n\n- [ ] Add architecture text stating that a CLI/provider change creates a new run, the target seed lives in its unified worker stream, and source/target ownership is never shared.\n- [ ] Record the three-phase ordering: validate target; terminate/confirm source and capture final state; create/prompt target. Document the `cancelled` success state and `needs_recovery` post-stop failure state.\n- [ ] Record workspace lease, drift refusal, packet redaction/untrusted-boundary, restart claim, and named-event requirements before implementing state transitions.\n- [ ] Run the existing baseline without changing its expectations: `pnpm vitest run tests/api/conversation-messages-route.test.ts tests/supervisor/worker-failover.test.ts tests/supervisor/worker-failover-handoff-fails.test.ts tests/supervisor/worker-failover-spawn-retry.test.ts tests/supervisor/worker-failover-no-replacement.test.ts`.\n\n### Task 2: Define the packet and lifecycle contracts\n\n**Files:**\n- Create: `src/shared/handoff.ts`\n- Create: `tests/server/handoff/compiler.test.ts`\n- Create: `tests/server/handoff/redaction.test.ts`\n\n- [ ] Define V1 packet, provenance, lifecycle metadata, editable advisory patch, API request/response, and error-code types.\n- [ ] Make authoritative versus advisory fields explicit in the types so PATCH cannot alter source/workspace/verification provenance.\n- [ ] Add constants for total and per-field budgets, item counts, recent-tail bounds, and supported interruption reasons.\n- [ ] Write failing tests for stable ordering, NFC/fixed-key canonicalization, a content hash that excludes only `generatedAt`, priority truncation, exact omission metadata, and rejection of unknown packet versions.\n- [ ] Write failing redaction/render-boundary tests for common API keys/tokens, authorization headers, environment dumps, hidden-reasoning entries, absolute paths outside the project, control characters, nonce/delimiter injection, and content imitating system/tool-result framing.\n- [ ] Run `pnpm vitest run tests/server/handoff/compiler.test.ts tests/server/handoff/redaction.test.ts` and confirm failures are contractual rather than fixture errors.\n\n### Task 3: Add durable metadata and packet artifact storage\n\n**Files:**\n- Modify: `src/server/db/schema.ts`\n- Modify: `src/server/db/index.ts`\n- Modify: `src/server/artifacts/stream-types.ts`\n- Modify: `src/server/artifacts/append-only-store.ts`\n- Create: `src/server/handoff/store.ts`\n- Create: `tests/server/handoff/store.test.ts`\n- Modify: `tests/db/schema.test.ts`\n\n- [ ] Add the `conversation_handoffs` table, `runs.originHandoffId`, `runs.activeHandoffId`, foreign keys, normalized workspace key, timestamps, revision, operation/claim/expiry fields, bounded preview, and exact partial indexes described above using the repository's additive schema pattern.\n- [ ] Increment `DB_SCHEMA_VERSION` and test initialization of old and fresh databases.\n- [ ] Add the run-level `handoff_packets` stream and map it to `app-data/run-data/<runId>/handoff-packets.jsonl` through the artifact store.\n- [ ] Implement transactional metadata transitions plus append/read of packet versions; never expose a metadata revision whose artifact append failed.\n- [ ] Enforce one active handoff per source run and normalized project path, idempotent operation IDs, and target discovery by `originHandoffId`.\n- [ ] Test packet revision lookup, stale revision refusal, source deletion cascade, target deletion terminalization/fence release, expired claim lookup, and no orphaned artifact metadata.\n- [ ] Run `pnpm vitest run tests/server/handoff/store.test.ts tests/db/schema.test.ts`.\n\n### Task 4: Gather bounded deterministic evidence\n\n**Files:**\n- Create: `src/server/handoff/candidates.ts`\n- Create: `src/server/handoff/workspace-state.ts`\n- Create: `src/server/handoff/redaction.ts`\n- Modify: `src/server/git/auto-commit.ts`\n- Create: `tests/server/handoff/candidates.test.ts`\n- Create: `tests/server/handoff/workspace-state.test.ts`\n- Modify: `tests/server/handoff/redaction.test.ts`\n\n- [ ] Read worker content only through bounded `readWorkerEntriesTail`/`Since`/`Before` APIs and respect superseded sequence ranges.\n- [ ] Gather original/current user requests, a small exact recent tail, latest assistant recap, queued messages, unresolved execution errors, verification commands/results, plan/spec/generated artifact paths, and the source sequence.\n- [ ] For message forks, constrain conversational evidence to the selected message boundary.\n- [ ] Parse `runs.gitBaselineJson`, current HEAD/status, diff stats, commit range, tool edit events, and relevant agent summaries into file ownership evidence.\n- [ ] Classify file ownership conservatively; never claim session ownership from current git status alone. Preserve `unknown` and warnings.\n- [ ] Normalize project-relative paths, keep raw absolute project paths server-only, omit file contents and raw diff hunks by default, and include only narrowly bounded hunks for unresolved conflicts/subtle incomplete edits.\n- [ ] Redact every candidate before budgeting, hashing, previewing, rendering, logging, or event emission; perform a final redaction pass over the rendered seed.\n- [ ] Test large streams, already-compacted history, deleted/renamed/untracked files, a dirty pre-session baseline, external concurrent edits, post-message workspace drift, malformed baselines, and non-git projects.\n- [ ] Run `pnpm vitest run tests/server/handoff/candidates.test.ts tests/server/handoff/workspace-state.test.ts tests/server/handoff/redaction.test.ts`.\n\n### Task 5: Compile and render the hybrid packet\n\n**Files:**\n- Create: `src/server/handoff/compiler.ts`\n- Modify: `src/server/handoff/request.ts`\n- Modify: `src/server/handoff/parser.ts`\n- Modify: `src/server/handoff/render.ts`\n- Modify: `tests/server/handoff/compiler.test.ts`\n- Modify: `tests/server/handoff/parser.test.ts`\n\n- [ ] Implement deterministic merging where collected facts override advisory summaries and every conflict becomes a confidence warning.\n- [ ] Detect fresh recent assistant recaps using worker/event sequence evidence.\n- [ ] Update the outgoing request to return only structured task/state/decision/file explanations; use a short timeout and skip it for quota-blocked or busy workers.\n- [ ] Preserve the existing synthetic fallback, but feed it through the same candidates/compiler/redaction pipeline.\n- [ ] Enforce the packet budget by priority, populate `omittedSections`/`truncatedFields`, and hash the redacted canonical representation excluding only `generatedAt`.\n- [ ] Render a concise target prompt with objective, state, decisions, workspace, verification, pending input, uncertainty, and an explicit instruction to inspect current files before acting. Place canonical JSON inside a post-sanitization random nonce fence and ensure embedded text cannot close or imitate the boundary.\n- [ ] Ensure quota wording is a reason field, not hard-coded into all handoffs.\n- [ ] Test clean completed turns, mid-turn interruption, hard quota interruption, already-compacted history, short sessions, stale summaries, malicious advisory content, and overflow.\n- [ ] Run `pnpm vitest run tests/server/handoff/compiler.test.ts tests/server/handoff/redaction.test.ts tests/server/handoff/parser.test.ts`.\n\n### Task 6: Extract safe new-run fork creation\n\n**Files:**\n- Create: `src/server/runs/fork.ts`\n- Modify: `src/server/runs/recovery.ts`\n- Modify: `tests/api/run-route.test.ts`\n- Modify: `tests/ui/conversation-actions.test.ts`\n\n- [ ] Extract plan/run/message-copy creation from the existing `recoverRun(... action: \"fork\")` branch without changing retry/edit semantics.\n- [ ] Accept an explicit target worker type/model/effort/account/allowed-types selection and copy `preferredWorkerAccountId`, which the current fork path can omit.\n- [ ] Preserve `parentRunId`, `forkedFromMessageId`, project path, and auto-commit preferences. Add `copyMessagePrefix: boolean`: legacy same-CLI forks use `true`; cross-CLI handoffs use `false` so the rendered packet is the target's only initial conversation entry.\n- [ ] For a cross-CLI target, capture a fresh git baseline after source termination and in-flight auto-commit settlement, and store it as the target `gitBaselineJson`/workspace metadata. The packet separately reports source-session changes relative to the source's original baseline, so target ownership begins at handoff.\n- [ ] Keep target preflight validation separate from target creation. The coordinator performs source termination and post-stop capture between preflight and target creation.\n- [ ] Keep existing ordinary and worktree fork behavior passing; do not create a worktree for cross-CLI handoff.\n- [ ] On worker launch failure, retain the partially created plan/run as a visible `failed` diagnostic record stamped with `originHandoffId`; do not delete it or claim launch succeeded.\n- [ ] Run `pnpm vitest run tests/api/run-route.test.ts tests/ui/conversation-actions.test.ts`.\n\n### Task 7: Build the server coordinator and source fence\n\n**Files:**\n- Create: `src/server/handoff/coordinator.ts`\n- Create: `src/server/handoff/reconciler.ts`\n- Create: `tests/server/handoff/coordinator.test.ts`\n- Create: `tests/server/handoff/reconciler.test.ts`\n- Modify: `src/server/conversations/queued-messages.ts`\n- Modify: `src/server/conversations/queued-message-interrupt.ts`\n- Modify: `src/server/quota/worker-resume.ts`\n- Modify: `src/server/runs/recovery-reconciler.ts`\n\n- [ ] Implement capture, revise, launch, cancel, retry, and restore transitions over the persisted metadata/store.\n- [ ] Acquire the persisted normalized-workspace lease plus in-process workspace mutex; reject another active handoff or any other live worker already using that checkout.\n- [ ] On explicit prepare/capture, branch on runtime ownership: for a live source, advance turn generation, request graceful interruption, wait up to `HANDOFF_STREAM_SETTLE_TIMEOUT_MS`, terminate the CLI process, and confirm exit; for idle/quota/stopped sources, verify no PID/live runtime and proceed. Refuse before target creation if absence/exit cannot be confirmed.\n- [ ] Disable source auto-commit scheduling, await any in-flight commit, deliberately skip a new final auto-commit, and warn when interruption occurred without a clean tool/turn boundary because files may be partially written.\n- [ ] After process absence/exit, recapture the final durable sequence, HEAD, canonical tracked-diff workspace fingerprint, fresh target git baseline, and packet. On launch, re-read them and refuse drift with `handoff.source_changed` plus a visible recapture action.\n- [ ] Stop queued delivery, preserve undelivered messages in continuity, and atomically mark their source rows `cancelled` with `cross_cli_handoff` after successful launch so they cannot execute twice.\n- [ ] Validate target CLI/account/model/effort/quota state and automatic handoff chain/cooldown limits before source termination.\n- [ ] Persist a server claim token/expiry, create the stamped target run, persist rendered seed with `appendUserInputOnDelivery`, and start the target only after source process exit was confirmed.\n- [ ] On success clear `activeHandoffId` and set source run `cancelled`. On post-stop target failure clear the marker, restore `quota_waiting` plus its wake/incident when a future reset is durable, otherwise set `needs_recovery` with `handoff_post_stop_failure`; leave any partial target visible as `failed` and release the workspace fence.\n- [ ] Implement launch idempotency, stale source-sequence/revision/workspace refusal, and a startup/heartbeat reconciler that adopts targets by `originHandoffId` or fails expired `capturing`, `ready`, and `launching` leases. A client heartbeat may extend `ready` only up to the 15-minute maximum.\n- [ ] Gate send, queue, retry/edit, resume, wake, auto-commit, and reconciler mutations for every run sharing a leased workspace.\n- [ ] Handle target deletion by terminalizing a nonterminal handoff and releasing its fence before `ON DELETE SET NULL` runs.\n- [ ] Test races: another live run in the checkout, send versus capture, capture versus quota wake, live versus already-dead/quota sources, double launch, cancel versus launch, process refusing to exit, late output, tracked workspace/HEAD drift, untracked churn exclusion, ready expiry with unsaved client edits, target spawn failure, claim expiry, orphan adoption, restart at every status, queued-message cancellation, and source/target deletion.\n- [ ] Run `pnpm vitest run tests/server/handoff/coordinator.test.ts tests/server/handoff/reconciler.test.ts tests/server/quota/worker-resume.test.ts tests/server/runs/recovery-reconciler.test.ts`.\n\n### Task 8: Expose typed HTTP/runtime APIs and observability\n\n**Files:**\n- Create: `src/server/events/handoff-events.ts`\n- Modify: `src/server/events/named-events.ts`\n- Create: `src/runtime/http/routes/handoffs.ts`\n- Modify: `src/runtime/http/routes/index.ts`\n- Modify: `src/runtime-api/types.ts`\n- Modify: `src/runtime-api/domains/index.ts`\n- Create: `tests/api/handoffs-route.test.ts`\n- Modify: `tests/runtime/http-registry.test.ts`\n- Modify: `tests/runtime/http-routes.test.ts`\n- Modify: `tests/runtime/route-contract-fixture.test.ts`\n- Modify: `tests/runtime/fixtures/routes.v1.json`\n\n- [ ] Add the named handoff events and every stable `error.surfaced` code, including `handoff.packet_version_unsupported`, without growing `named-events.ts` with full implementation logic.\n- [ ] Register create/list/get/patch/launch/cancel routes; resolve flat handoff IDs through the source run's authorization scope before returning data, and validate all IDs, enums, revisions, and selection fields.\n- [ ] Return `202` for in-progress capture, `409` for ownership/revision conflicts, `422` for incompatible target selection, and stage-specific `5xx` errors only for actual server failures.\n- [ ] Add typed runtime APIs; do not route handoffs through `runs.act` with `unknown` bodies.\n- [ ] Ensure no HTTP or SSE response includes secrets, raw packet artifacts when only metadata is needed, or untranslated visible server prose at the UI boundary.\n- [ ] Test auth/IDOR, malformed input, unsupported source mode, same-CLI target refusal, stale revision, replayed operation ID, packet retrieval, and surfaced error event payloads.\n- [ ] Run `pnpm vitest run tests/api/handoffs-route.test.ts tests/runtime/http-registry.test.ts tests/runtime/http-routes.test.ts tests/runtime/route-contract-fixture.test.ts`.\n\n### Task 9: Replace every same-run cross-CLI path\n\n**Files:**\n- Create: `src/server/workers/direct-run-type-invariant.ts`\n- Create: `tests/server/workers/direct-run-type-invariant.test.ts`\n- Modify: `src/server/conversations/send-message.ts`\n- Modify: `src/server/conversations/create.ts`\n- Modify: `src/server/supervisor/worker-failover.ts`\n- Modify: `src/server/supervisor/index.ts`\n- Modify: `src/server/supervisor/wake.ts`\n- Modify: `src/server/supervisor/observer.ts`\n- Modify: `src/server/prompts/supervisor.md`\n- Modify: `src/server/credits/index.ts`\n- Modify: `src/server/planning/review.ts`\n- Modify: `src/server/runs/recovery.ts`\n- Modify: `src/server/db/index.ts`\n- Modify: `src/components/settings/ModelsSettingsPanel.tsx`\n- Modify: `tests/api/conversation-messages-route.test.ts`\n- Modify: `tests/supervisor/worker-failover.test.ts`\n- Modify: `tests/supervisor/worker-failover-handoff-fails.test.ts`\n- Modify: `tests/supervisor/worker-failover-spawn-retry.test.ts`\n- Modify: `tests/supervisor/worker-failover-no-replacement.test.ts`\n\n- [ ] First write failing tests proving: follow-up text/API cannot change a direct run's CLI; cross-provider failover returns a distinct target run; target unavailable preserves quota recovery; and direct/commit worker insertion of another type is rejected at the central assertion and SQLite trigger.\n- [ ] Add `assertDirectRunWorkerTypeInvariant` before all direct/commit worker insertions and an additive SQLite `BEFORE INSERT ON workers` trigger as the final safety net. The trigger applies only when the referenced run has `session_type = 'omni'` and `mode IN ('direct', 'commit')`, and only rejects a *new* row whose normalized type differs from an existing worker; creating it on a legacy database never scans/rejects pre-existing mixed rows. Do not restrict intentional multi-type supervisor implementation runs.\n- [ ] Catch the trigger's stable constraint marker at the shared worker-insert boundary, map it to typed `409 handoff_required`, emit `handoff.refused`, and translate visible guidance at the UI boundary; never leak a raw SQLite 500.\n- [ ] In `applyWorkerPreferenceForMessage`/`reconcileDirectWorkerSelection`, reject a type change for an existing run with a typed “fork required” result; do not persist the new preferred type and do not defer it for later recreation.\n- [ ] Keep same-CLI model, effort, and account recreation behavior and its current ownership fencing.\n- [ ] Change `src/server/credits/index.ts` so `cross_provider` selects and returns a candidate target CLI/account without mutating source credentials; validate it is not quota-blocked or in the recent exhaustion cooldown.\n- [ ] Route cross-provider quota strategy/allowed-worker selection to `coordinator.captureAndLaunch` and return `targetRunId` rather than a replacement worker ID. Enforce automatic chain depth three and recent-provider/account exclusions.\n- [ ] Keep the existing `worker-failover.ts` exports as compatibility wrappers while callers/tests migrate; do not delete the file.\n- [ ] Update wake/restart recovery to continue a persisted handoff rather than retrying a same-run provider spawn.\n- [ ] Update supervisor prompt and settings explanation to say cross-provider recovery creates a new session.\n- [ ] Rename user-visible lifecycle copy from “switching workers” to handoff/fork language while retaining legacy event parsing only where backward compatibility needs it.\n- [ ] Run `pnpm vitest run tests/server/workers/direct-run-type-invariant.test.ts tests/api/conversation-messages-route.test.ts tests/supervisor/worker-failover.test.ts tests/supervisor/worker-failover-handoff-fails.test.ts tests/supervisor/worker-failover-spawn-retry.test.ts tests/supervisor/worker-failover-no-replacement.test.ts` and assert no direct/commit source run contains workers of two CLI types.\n\n### Task 10: Build the client Manager and dialog\n\n**Files:**\n- Create: `src/interface/home/HandoffForkManager.ts`\n- Create: `src/interface/home/HandoffForkDialog.tsx`\n- Create: `src/components/home/CliLaunchSelectionFields.tsx`\n- Modify: `src/interface/home/useHomeMutations.ts`\n- Create: `tests/app/handoff-fork-manager.test.ts`\n- Create: `tests/ui/handoff-fork-dialog.test.tsx`\n- Modify: `shared/locales/*.json`\n\n- [ ] Implement a Manager-owned state machine for closed/selecting/capturing/ready/editing/launching/completed/error, including source run/message IDs, revision, target selection, packet, warnings, and request token.\n- [ ] Use TanStack Query only for transport/cache; the Manager is the single UI source of truth and ignores responses whose ownership token no longer matches.\n- [ ] Build an accessible, responsive dialog using existing Dialog/Select/Textarea/Button/ScrollArea/Alert/Badge primitives.\n- [ ] Keep dialog open/target selection read-only. Label **Prepare handoff** as the point that stops the source CLI; after preparation, cancelling releases the lease and leaves the stopped source in `needs_recovery` so the user can deliberately resume it.\n- [ ] Default to the last compatible *different* CLI, exclude the source CLI, and validate account/model/effort combinations before capture/launch.\n- [ ] Show authoritative sections read-only, advisory fields editable, source/provenance/warnings visible, and an explicit “current files win” note.\n- [ ] Debounce or explicitly save advisory edits with `expectedRevision`; disable launch until the current edit revision is acknowledged.\n- [ ] Renew the ready lease while the preview is open without exceeding 15 minutes. On expiry, discard only unsaved local edits, show that the source remains recoverable, and offer **Prepare fresh handoff**; on tracked drift, offer the same recapture action rather than looping launch retries.\n- [ ] Allow recovery of the active durable draft after reload and a clear cancel action before launch for both manual and quota drafts.\n- [ ] Add all visible/aria/error strings to every `shared/locales/*.json` file and subscribe with `useI18nSnapshot()`.\n- [ ] Test keyboard focus, escape/cancel, mobile sizing, loading/error/retry states, stale edit conflicts, CLI exclusion, and no hard-coded user-facing JSX.\n- [ ] Run `pnpm vitest run tests/app/handoff-fork-manager.test.ts tests/ui/handoff-fork-dialog.test.tsx`.\n\n### Task 11: Wire every product entry point\n\n**Files:**\n- Modify: `src/interface/home/useConversationActions.ts`\n- Modify: `src/interface/home/ExternalSessionsPicker.tsx`\n- Modify: `src/components/home/HomeHeader.tsx`\n- Modify: `src/components/home/ConversationMain.tsx`\n- Modify: `src/components/home/RunRecoveryNotice.tsx`\n- Modify: `src/interface/home/HomeApp.tsx`\n- Modify: `tests/ui/conversation-actions.test.ts`\n- Modify: `tests/server/external-sessions/discovery.test.ts`\n- Modify: `shared/locales/*.json`\n\n- [ ] Add **Fork to another CLI** to the session menu for eligible direct/commit runs.\n- [ ] Add **Fork to another CLI from here** to user-message actions and pass the exact message ID.\n- [ ] Add a distinct current-conversation fork choice to Resume CLI Session without changing external Claude/Gemini resume behavior.\n- [ ] Add a quota notice action/status that opens or navigates to the automatic handoff and target run.\n- [ ] Add a quota/recovery notice action that cancels an abandoned ready/capturing handoff or retries a `needs_recovery` source; do not require the lost dialog state to release a fence.\n- [ ] Keep `HomeApp.tsx` as wiring only and extract any message-action UI needed to avoid growing oversized components.\n- [ ] On success, select the target only if the user is still viewing the source associated with the completed request; otherwise show a non-destructive notification/link.\n- [ ] Preserve ordinary “Fork session” semantics if it remains same-CLI, and make the cross-CLI wording unambiguous.\n- [ ] Test eligibility, source/message payloads, no selected run, unsupported modes, selection races, external resume regression, and quota CTA behavior.\n- [ ] Run `pnpm vitest run tests/ui/conversation-actions.test.ts tests/server/external-sessions/discovery.test.ts`.\n\n### Task 12: Reconcile SSE, restart, and lifecycle recovery\n\n**Files:**\n- Modify: `src/interface/home/EventStreamStateManager.ts`\n- Modify: `src/interface/home/utils.ts`\n- Modify: `tests/app/event-stream-state-manager.test.ts`\n- Create: `tests/lifecycle/scenarios/cross-cli-handoff-fork.test.ts`\n- Create: `tests/lifecycle/scenarios/cross-cli-handoff-restart.test.ts`\n\n- [ ] Reconcile capture/revision/launch/completion/failure events into existing run snapshots without creating optimistic fake runs.\n- [ ] Fetch snapshot/active handoff after `stream.resync_required`; treat SSE as an invalidation signal and HTTP/SQLite as authority.\n- [ ] Add a manual lifecycle scenario covering source activity, stable capture, packet artifact, target run/worker/seed, source stop, and no mixed CLI types.\n- [ ] Add a quota scenario where the outgoing worker cannot answer, synthetic capture succeeds, and the target new run continues.\n- [ ] Add restart checkpoints after `capturing`, `ready`, and `launching`; prove recovery either finishes once or surfaces a retryable failure without duplicate targets.\n- [ ] Add FK/delete coverage: deleting the source removes its packet metadata/artifact while the target's seed remains readable.\n- [ ] Validate every decision through `/api/events/log?since=<id>&runId=<id>` and assert named refusal/failure events exist.\n- [ ] Run the focused state-manager test, then `pnpm test:lifecycle`.\n\n### Task 13: Full verification and handoff documentation\n\n**Files:**\n- Modify only as failures require within the files already listed.\n- Verify: `.gitignore`\n\n- [ ] Re-read both architecture docs and confirm every new server decision emits a named event and every user-relevant failure emits a stable `error.surfaced` code.\n- [ ] Verify every target seed was persisted through `appendUserInputOnDelivery` and no parallel conversation storage was introduced.\n- [ ] Verify cross-CLI targets copy no source message rows/worker entries: only parent/message metadata plus the rendered first `user_input` packet crosses the boundary.\n- [ ] Verify logs/events demonstrate confirmed source process exit before target run creation and that the direct/commit SQLite trigger rejects mixed worker types.\n- [ ] Verify all visible strings use `t()` and all locale files contain the same new keys.\n- [ ] Verify packet storage, test databases, generated debug packets, CLI transcripts, credentials, and temporary review output are not accidentally tracked; make only a narrow `.gitignore` addition if needed.\n- [ ] Run `pnpm typecheck`.\n- [ ] Run `pnpm lint`.\n- [ ] Run `pnpm vitest run`.\n- [ ] Run `pnpm test:lifecycle`.\n- [ ] Run the mandatory frontend build: `pnpm build:interface:web`.\n- [ ] Inspect `git diff --check` and `git status --short`; preserve unrelated user changes and confirm the implementation did not create a branch, worktree, or delete files.\n\n## Verification matrix\n\n| Case | Expected result |\n|---|---|\n| Header fork, idle source | Prepare verifies no live runtime, captures final state, and only then allows creation of a distinct target run. |\n| Header fork, active turn | Prepare generation-fences, settles, terminates, and confirms source process exit before capture; target creation cannot overlap. |\n| Source CLI refuses to exit | Launch is refused before target creation; source is `needs_recovery`; named failure identifies termination. |\n| Another live run uses checkout | Workspace lease/preflight refuses handoff; neither source nor other run is mutated. |\n| Message fork | Conversation is bounded at the message; current workspace drift is explicit; `forkedFromMessageId` is preserved. |\n| Manual preview becomes stale | Sequence/HEAD/workspace fingerprint drift returns `handoff.source_changed`; user must prepare a fresh packet. |\n| Ready preview abandoned | Lease expires by 15 minutes, source marker/fence clears, quota wake or recovery state is restored, and reopening offers a fresh prepare. |\n| Resume CLI Session dialog | External resume still resumes an external provider session; current-conversation fork opens handoff flow. |\n| Quota, outgoing CLI dead | No outgoing request; synthetic packet launches a distinct target run. |\n| Quota, target unavailable | Preflight failure leaves `quota_waiting` untouched; post-stop failure restores its durable future wake or uses `needs_recovery`; no success is reported. |\n| Quota handoff loop | Recent exhausted providers/accounts are excluded; depth four is refused with a visible wait/manual-recovery state. |\n| Same-run text asks to switch CLI | Request is refused with fork guidance; source preferences/worker type do not change. |\n| Same-CLI model/account change | Existing supported recreation path still works inside the run. |\n| Already compacted source | Provider recap is advisory; post-compaction evidence and exact recent tail are included. |\n| Dirty workspace before session | Pre-existing files are not claimed as session-owned; uncertainty is preserved. |\n| Concurrent/external file change | Ownership becomes external/unknown; packet does not overwrite or silently attribute it. |\n| Packet overflow | Highest-priority facts remain; dropped fields are named; hash is deterministic. |\n| Reload while preview is ready | Active draft and revision restore from server; edits do not regress. |\n| Disconnect during launch | SSE replay/snapshot returns one target; repeated operation ID is idempotent. |\n| Crash after target row creation | Reconciler discovers exactly one target by `originHandoffId`, adopts or fails it, and releases the claim/lease. |\n| Target deleted during launch | Handoff terminalizes and source/workspace fence releases before the target link is nulled. |\n| Delete source after completion | Source metadata/artifact is cleaned; target initial seed remains self-contained. |\n\n## Agentic user-journey candidates (approval required before running)\n\nThese browser journeys are valuable after automated tests/build pass, but they must not be run without explicit user approval because they create real local conversations and CLI activity:\n\n1. Start a Codex direct session, make a small edit, open the header handoff dialog, inspect/edit the packet, fork to Claude, verify the new sidebar session and source preservation, then clean up the test conversations/artifacts.\n2. Fork from an earlier user message and confirm the preview distinguishes historical conversation state from the current checkout.\n3. Simulate/induce a quota-waiting source through supported test controls, select cross-provider recovery, verify the synthetic packet and target navigation, then clean up.\n4. Reload the browser while a handoff preview is open and while launch is completing; verify restoration, SSE replay, and no duplicate target.\n\n## Implementation guardrails\n\n- Begin implementation by rechecking `git status --short`; the current worktree already contains user changes. Never overwrite, revert, or reformat unrelated edits.\n- Do not create a branch or worktree and do not delete any file.\n- Keep new logic out of `HomeApp.tsx`, `ConversationMain.tsx`, `runs/recovery.ts`, and `worker-failover.ts` except thin integration/delegation because all are already oversized.\n- Use `src/server/git/command.ts` or existing async helpers for git evidence; avoid synchronous shell calls in request paths.\n- Never log or emit the full packet in named events, errors, or ordinary server logs.\n- Never pass translated strings through transactions or persist translated UI copy.\n- Never treat an LLM-generated summary as proof that a file changed, a test passed, or a command ran.\n- Do not add configurable frontend strings/settings through `.env`; packet limits are code constants.\n- Clean up test conversations and persisted artifacts after any approved live/agentic validation.\n--- UPDATED PLAN END ---"
}
````

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-08-20T18:16:36.851Z","phase":null} -->
## Claude state: queue-operation · 2026-08-20T18:16:36.851Z

```text
{
  "type": "queue-operation",
  "operation": "dequeue",
  "timestamp": "2026-08-20T18:16:36.851Z",
  "sessionId": "23684cf2-66e9-47ff-ada1-76c62f4558a0"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"user","timestamp":"2026-08-20T18:16:36.891Z","phase":null} -->
## User · 2026-08-20T18:16:36.891Z

I resolved all seven remaining blockers: explicit no-live-runtime branch; quota preflight versus post-stop status and wake preservation; ready TTL/heartbeat/expiry UI; runs.activeHandoffId and recovery reasons; exact tracked-diff workspace fingerprint plus recapture; fresh post-stop target git baseline with auto-commit settlement/no final commit; corrected journeys/matrix/message confirmation; and exact SQLite discriminator/legacy behavior/error mapping plus packet-version code.

Review the complete updated artifact one final time. Judge only the artifact. Return exactly READY if it is implementation-ready, otherwise HARDEN followed only by remaining concrete blockers. Do not write files, use tools, repeat resolved findings, or suggest optional enhancements.

--- UPDATED PLAN START ---

# Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax.

**Feature:** Cross-CLI Hybrid Handoff Fork

**Goal:** Let a user fork any direct-control conversation into a new session running on a different CLI, carrying a compact, inspectable hybrid handoff packet; use the same new-run mechanism when cross-provider quota recovery is selected, and make same-run cross-CLI switching impossible.

**Architecture:** A server-owned handoff coordinator freezes the source at a durable worker-stream sequence, gathers bounded deterministic evidence, optionally adds a semantic summary, compiles and persists a versioned packet, and launches a completely separate target run. SQLite stores lifecycle metadata; the append-only artifact store holds packet versions; the target worker stream receives the rendered packet as its first `user_input`. The source run is preserved as stopped history. Same-CLI model/account recovery may continue inside a run, but changing the CLI/provider always crosses a run boundary.

**Tech Stack:** TypeScript, React, TanStack Query, global Manager classes, Drizzle + SQLite, append-only JSONL artifacts, existing runtime HTTP registry/API adapters, named SSE events, Vitest, lifecycle HTTP/SSE scenarios, existing shadcn/ui primitives, and locale JSON files.

**North Star Product:** A user can move work between CLI ecosystems without pretending their provider sessions, recovery semantics, or transcripts are interchangeable. The new agent starts with the smallest trustworthy continuation context, the source remains auditable, and failures never strand or silently mutate either conversation.

**Current Milestone:** Ship cross-CLI handoff forks for direct/commit conversations from the session menu, an individual message, the existing Resume CLI Session dialog, and quota recovery. The packet is editable where it is advisory, inspectable after launch, bounded, redacted, restart-safe, and synthesized without contacting an exhausted provider when necessary.

**Future Product Direction:** Reuse the packet format for export/import and cross-device handoff only after this milestone proves the provenance, recovery, and deletion model. Do not add same-run CLI switching, background multi-agent continuation, or automatic worktree creation in this milestone.

**Final Functionality Standard:** Every cross-CLI transition creates a new run and target worker stream; no server path can recreate a worker under another CLI in the source run. The packet accurately identifies uncertainty and pre-existing workspace changes, survives a process restart, excludes secrets and hidden reasoning, and produces enough observability to explain every capture, launch, refusal, and failure.

---

## Product decisions and non-goals

1. **A CLI handoff is a fork, never a resume.** “Resume external session” keeps its existing meaning. “Fork current conversation to another CLI” creates a new OmniHarness run with `parentRunId` and an optional `forkedFromMessageId`.
2. **The source is historical after a successful launch.** Before target creation, terminate any live source CLI process and confirm it exited; if no live runtime owns the source, verify that fact and skip interruption/termination. On success set the source run to `cancelled`, retain its transcript and artifacts, and select the target run in the UI. If target launch fails after source termination, restore `quota_waiting` when a durable future quota wake exists; otherwise set `needs_recovery`. Never keep two CLIs editing the same checkout concurrently.
3. **The packet is hybrid.** Deterministic state is authoritative; generated summaries and outgoing-agent reports are advisory. Current disk state wins over prose.
4. **Manual and quota paths share one coordinator.** Manual entry points offer a preview. A quota-triggered cross-provider handoff may launch without waiting for an exhausted CLI, then exposes the persisted packet for inspection.
5. **Only advisory content is user-editable.** The user may amend objective, status, next steps, blockers, notes, and relevant-file explanations. Source IDs, stream sequence, git evidence, verification records, target selection, provenance, and hash are server-owned.
6. **No full transcript or full diff by default.** The packet contains a short exact tail plus summaries, file-level evidence, and compact error/test output. The source run remains the place to inspect full history.
7. **No hidden reasoning.** Never copy `thought`, chain-of-thought, raw environment, credentials, authorization headers, binary attachments, or unrestricted tool output into a packet.
8. **No automatic worktree.** This feature uses the current checkout and avoids concurrency by stopping the source. Existing explicit worktree fork actions remain separate.
9. **No file deletion is part of this plan.** Refactor existing modules in place or add focused modules; preserve project history and user changes.

## User journeys

### Manual fork from the session

1. The user opens the session menu and selects **Fork to another CLI**.
2. The dialog defaults to a different available CLI and offers compatible account, model, and effort choices.
3. The user explicitly chooses **Prepare handoff**, acknowledging that any live source CLI will stop. The server gracefully interrupts then terminates it (or verifies no live runtime exists), confirms exit, captures the final stable boundary, and returns a compact preview with provenance and warnings.
4. The user may edit advisory notes, then launches.
5. At launch OmniHarness revalidates target and source/workspace fingerprints. Because source exit was already confirmed, it creates the new run, persists the packet as the target's initial user input, starts the selected CLI, marks the source `cancelled`, and selects the target in the sidebar.

### Fork from a message

1. The user chooses **Fork to another CLI from here** on a user message and receives the same explicit **Prepare handoff** confirmation that names the source stop; selecting an old message never bypasses termination.
2. Candidate collection ignores superseded/later conversation entries but compares against the current workspace, explicitly warning when files contain changes made after the selected message.
3. The rest of the flow is the same as the manual session fork.

### Fork from Resume CLI Session

1. The existing dialog clearly separates **Resume external session** from **Fork current conversation**.
2. The fork option appears only with an eligible selected OmniHarness direct/commit run.
3. Choosing it opens the same handoff dialog, not a provider-session resume flow.

### Cross-provider quota recovery

1. A CLI reaches a durable quota-waiting state.
2. Same-provider account/model recovery may use existing same-CLI recovery.
3. If the selected strategy requires another CLI/provider, the server synthesizes a packet from persisted evidence and creates a new run.
4. The exhausted source is never prompted for a handoff and never receives a replacement worker of another type.
5. If preflight finds no target, the untouched source stays `quota_waiting` with its wake schedule. If launch fails after source termination, restore `quota_waiting` when a durable future wake exists; otherwise use `needs_recovery`. In both cases the error names the failed stage.

## Compact handoff packet contract

Create a versioned `HybridHandoffPacketV1` with the following logical shape. Use stable IDs and enums rather than translated labels.

```ts
type HybridHandoffPacketV1 = {
  handoffVersion: 1;
  source: {
    runId: string;
    workerId: string | null;
    workerType: SupportedWorkerType | null;
    forkedFromMessageId: string | null;
    sourceSeq: number | null;
    interruptionReason: "manual_session" | "manual_message" | "quota_exhausted";
    generatedAt: string;
  };
  target: {
    workerType: SupportedWorkerType;
    model: string | null;
    effort: string | null;
    accountId: string | null;
  };
  task: {
    originalRequest: string | null;
    currentObjective: string | null;
    acceptanceCriteria: string[];
    userConstraints: string[];
  };
  state: {
    completed: string[];
    inProgress: string[];
    remaining: string[];
    blockers: string[];
    openQuestions: string[];
    rejectedApproaches: Array<{ approach: string; reason: string }>;
  };
  decisions: Array<{ decision: string; reason: string | null; evidence: string[] }>;
  workspace: {
    projectRootLabel: string;
    baselineCommit: string | null;
    currentHead: string | null;
    dirtyBeforeSession: boolean | null;
    modifiedFiles: Array<{
      path: string;
      changeType: "added" | "modified" | "deleted" | "renamed" | "unmerged";
      ownership: "session" | "probable_session" | "preexisting" | "external" | "unknown";
      summary: string | null;
      evidence: string[];
    }>;
    untrackedFiles: string[];
    relevantUnchangedFiles: string[];
    commitsCreated: string[];
  };
  verification: Array<{
    command: string;
    result: "passed" | "failed" | "unknown";
    exitCode: number | null;
    importantOutput: string | null;
  }>;
  artifacts: {
    plans: string[];
    specs: string[];
    generatedOutputs: string[];
  };
  continuity: {
    recentUserMessages: string[];
    recentAssistantSummary: string | null;
    pendingUserInput: string | null;
    queuedMessages: string[];
  };
  provenance: {
    summarySource: "outgoing_worker" | "recent_assistant" | "synthetic" | "hybrid";
    omittedSections: string[];
    confidenceWarnings: string[];
    truncatedFields: string[];
  };
};
```

Compilation rules:

- Set an explicit 36,000-character rendered-packet ceiling (roughly 6,000–10,000 tokens depending on content), plus per-field item and character limits. Keep the constants in code, not environment variables.
- Prioritize source identity and sequence, user constraints, current objective, blockers/errors, file evidence, verification, decisions, queued input, then recent conversational tail. Drop completed prose first.
- Stable-sort every deterministic collection so the same redacted nonvolatile evidence yields the same semantic content hash; `generatedAt` may differ without changing that hash.
- Reuse a recent assistant recap only as advisory text. It is “fresh” only if its worker sequence is at or after the last included tool/result lifecycle boundary; otherwise include it with a stale-summary warning.
- Ask an outgoing worker for a structured report only when it is idle/responsive and not quota-blocked. Bound the request timeout. Never delay quota recovery on this call.
- For a hard interruption, synthesize entirely from the worker stream, execution events, messages/queued messages, run metadata, git evidence, and known artifacts.
- For a message fork, cap conversation candidates at that message/stream boundary while computing workspace state at capture time; call out the mismatch rather than claiming the checkout was rewound.
- Render advisory narrative inside an explicit untrusted-data boundary telling the target to verify disk state. Do not let tool/assistant text masquerade as system instructions.
- Run redaction before budgeting, canonicalization, hashing, preview extraction, rendering, logging, or event emission. Apply it to every structured text field and to the final rendered seed, including verification output, blockers, decision evidence, queued text, and outgoing-worker reports.
- Keep the absolute `projectPath` only in server-side run/handoff metadata for access and launch checks. The packet/API uses a non-sensitive `projectRootLabel` such as the repository directory name; all file evidence is project-relative.
- Hash the NFC-normalized, fixed-key-order canonical packet while excluding only volatile `generatedAt`. Target selection remains hash input, so changing it creates a new hash/revision.
- Render untrusted content inside a randomly generated, high-entropy nonce fence created after sanitization. Reject/regenerate a nonce that occurs in content, encode the interior as canonical JSON, and test delimiter/system/tool-frame imitation. The renderer's nonce is not part of the semantic packet hash.

## State machine and invariants

Persist these statuses: `capturing -> ready -> launching -> completed`, with terminal `failed` and `cancelled`. Only `capturing`, `ready`, and `launching` are nonterminal and covered by active-handoff uniqueness. Retrying a terminal failure always creates a new handoff row linked to the failed attempt; it never resurrects the terminal row.

The coordinator owns an immutable launch fence:

```ts
{
  handoffId,
  revision,
  sourceRunId,
  sourceWorkerId,
  sourceSeq,
  workspaceFingerprint,
  targetSelectionHash
}
```

Server invariants:

- At most one nonterminal handoff exists for a source run and normalized project path. A persistent workspace lease plus an in-process keyed mutex serializes capture/launch; every other OmniHarness mutation path for a run sharing that project refuses while the lease is active. Before capture, also refuse when another live run already owns a worker in the same checkout.
- New messages, queued-message delivery, retry/edit recovery, manual resume, quota wake, auto-commit, and reconciler actions refuse with `409 handoff_in_progress` while the source workspace is fenced.
- Opening the dialog is read-only. The explicit **Prepare handoff** action acquires the lease. If the source owns a live runtime, advance turn generation, request graceful interruption, wait up to `HANDOFF_STREAM_SETTLE_TIMEOUT_MS`, terminate the CLI process, and confirm process exit/no runtime ownership. If it is idle, quota-blocked, or already stopped, verify that no PID/live runtime owns it and skip the interruption/termination steps. If absence/exit cannot be confirmed, fail capture and do not create a target.
- Before termination, disable new source auto-commit scheduling and await any in-flight auto-commit under the workspace lease; do not manufacture a final commit. After confirmed source absence/termination, set `runs.activeHandoffId`, use `needs_recovery` internally, and capture the final durable worker sequence and git state. UI/recovery consumers seeing `activeHandoffId` render the handoff draft state instead of a generic crash banner. `ready`/`launching` remain handoff statuses, not new run statuses.
- Define `workspaceFingerprint` as SHA-256 over a canonical sequence containing HEAD, `git diff --binary --no-ext-diff`, and `git diff --cached --binary --no-ext-diff`, with NFC-normalized project-relative path records. Exclude untracked and ignored files from the drift fence to avoid editor/build-cache churn; still list capture-time untracked files in the packet with a warning that they are not launch-fenced.
- Launch first validates CLI availability, target account/model/effort compatibility, quota state, project path, source revision, and target selection without mutating source or target. It then re-reads the durable sequence and workspace fingerprint. Any drift refuses with `handoff.source_changed` and requires a new capture/preview; it never silently auto-revises a packet the user already reviewed.
- The target run and worker are created under the existing run/quota mutation controls. The rendered seed is persisted with `appendUserInputOnDelivery` in the target's unified worker stream before prompting the CLI.
- `launch` is idempotent. Persist a server-generated launch claim token and expiry before target creation, and stamp the target `runs.originHandoffId` before worker creation. Repeating the operation returns the discovered existing `targetRunId`; a stale revision gets `409 handoff_revision_conflict`.
- Every nonterminal handoff carries a lease expiry. `capturing`/`launching` use server heartbeats; the client renews a `ready` lease while the preview is open, capped at `HANDOFF_READY_MAX_LIFETIME_MS = 15 minutes`. A startup/heartbeat reconciler fails expired states, discovers targets by `originHandoffId`, adopts the one target where applicable, clears `runs.activeHandoffId`, releases the workspace fence, and emits the exact decision. Expired `ready` edits are not saved; the UI reports expiry and offers a fresh prepare.
- Mark `completed` only after target creation, target seed persistence, and worker launch acceptance. Set the already-terminated source run to `cancelled`, mark carried queued messages `cancelled` with a `cross_cli_handoff` reason, and persist the source-to-target link in the completed handoff row.
- A target launch failure never manufactures success and never deletes persisted rows. Mark any partially created target run `failed` and visible for diagnosis. Clear `runs.activeHandoffId`; if the source has a durable future quota wake, restore `quota_waiting` without clearing its quota incident/schedule so the same CLI can auto-resume at reset, otherwise set `needs_recovery` with recovery reason `handoff_post_stop_failure`. Release the workspace fence and emit the decision.
- Cancellation applies to manual and quota-created nonlaunching handoffs. The dialog and `RunRecoveryNotice` both expose it. Cancellation/expiry clears `runs.activeHandoffId`, releases the lease, and restores `quota_waiting` when a durable future wake exists or `needs_recovery` otherwise. Recovery UI and reconcilers branch on active handoff ID/reason rather than treating all `needs_recovery` states alike.
- Deleting the source removes its handoff metadata/artifact stream through existing run cleanup; the target remains independently understandable because its initial worker stream contains the rendered seed.
- Deleting a target while its handoff is nonterminal first terminalizes the handoff and releases the source/workspace fence; `ON DELETE SET NULL` is not relied on as lifecycle logic.
- Same-run recreation must reject a requested worker type different from an existing direct/commit run's CLI. Enforce this in a shared spawn assertion and a SQLite `BEFORE INSERT` safety trigger, not only at callers. Model, effort, or account changes within the same CLI remain allowed where currently supported. Supervisor implementation runs retain their intentional multi-worker behavior.
- Automatic quota handoff walks handoff/parent lineage. Refuse after `MAX_AUTOMATIC_HANDOFF_DEPTH = 3`, exclude providers/accounts exhausted in the last two handoffs, enforce a cooldown, and verify the target account has no open quota incident before source termination.

## File map

### Create

- `src/shared/handoff.ts` — packet, lifecycle, API DTO, edit-patch, and error-code contracts shared by server/client.
- `src/server/handoff/candidates.ts` — bounded candidate reads from unified worker streams, messages, queued messages, events, and artifacts.
- `src/server/handoff/workspace-state.ts` — read-only git baseline/current evidence and file ownership classification.
- `src/server/handoff/redaction.ts` — path-safe text normalization, secret/tool-output filtering, and size limits.
- `src/server/handoff/compiler.ts` — authoritative/advisory merge, priority budgeting, deterministic ordering, provenance, hash, and renderer input.
- `src/server/handoff/store.ts` — SQLite metadata and append-only packet-version persistence.
- `src/server/handoff/coordinator.ts` — capture/preview/edit/launch state machine, source fence, idempotency, and failure recovery.
- `src/server/handoff/reconciler.ts` — startup/heartbeat recovery for expired capture/launch claims and orphan target adoption.
- `src/server/runs/fork.ts` — extracted generic new-run fork creation used by legacy message forks and handoff launches.
- `src/server/workers/direct-run-type-invariant.ts` — central direct/commit worker-type assertion used before worker insertion; emits typed refusal.
- `src/server/events/handoff-events.ts` — focused named-event union for import into the existing event contract.
- `src/runtime/http/routes/handoffs.ts` — create/list/get/patch/launch HTTP handlers and validation.
- `src/interface/home/HandoffForkManager.ts` — single source of truth for dialog draft, server revision, request ownership, pending stages, and errors.
- `src/interface/home/HandoffForkDialog.tsx` — target picker, packet preview/editor, warnings, and launch result UI.
- `src/components/home/CliLaunchSelectionFields.tsx` — reusable CLI/account/model/effort controls for the handoff dialog without duplicating composer selection logic.
- `tests/server/handoff/compiler.test.ts` — packet priority, freshness, deterministic hash, truncation, and rendering tests.
- `tests/server/handoff/candidates.test.ts` — bounded stream/event/queued-message and message-boundary tests.
- `tests/server/handoff/workspace-state.test.ts` — baseline/current classification and path-safety tests.
- `tests/server/handoff/redaction.test.ts` — credentials, environment, hidden reasoning, malicious content, and byte-limit tests.
- `tests/server/handoff/store.test.ts` — revisions, active-handoff uniqueness, idempotency, and cascade tests.
- `tests/server/handoff/coordinator.test.ts` — state transitions, source fences, synthetic fallback, target failures, and launch idempotency.
- `tests/server/handoff/reconciler.test.ts` — expired claim, orphan target adoption, target deletion, and fence-release tests.
- `tests/server/workers/direct-run-type-invariant.test.ts` — application assertion and SQLite trigger safety-net tests.
- `tests/api/handoffs-route.test.ts` — route validation/auth/contract/error responses.
- `tests/app/handoff-fork-manager.test.ts` — stale-response ownership, retry, selection, and close/reopen behavior.
- `tests/ui/handoff-fork-dialog.test.tsx` — translated copy, accessibility, advisory-only editing, and responsive states.
- `tests/lifecycle/scenarios/cross-cli-handoff-fork.test.ts` — manual and quota cross-CLI lifecycle scenario over HTTP/SSE.
- `tests/lifecycle/scenarios/cross-cli-handoff-restart.test.ts` — restart, replay, idempotent launch, and deletion scenario.

### Modify

- `src/server/db/schema.ts` — add `conversationHandoffs` metadata table and indexes.
- `src/server/db/index.ts` — additive schema initialization/migration and database version bump.
- `src/server/artifacts/stream-types.ts` — add the `handoff_packets` run-level stream kind.
- `src/server/artifacts/append-only-store.ts` — map the new stream to `handoff-packets.jsonl`.
- `src/server/handoff/request.ts` — make the outgoing summary request reason-neutral, structured, bounded, and optional.
- `src/server/handoff/parser.ts` — parse advisory report fields into the versioned candidate contract without treating them as facts.
- `src/server/handoff/render.ts` — render the versioned packet and remove quota-only wording.
- `src/server/git/auto-commit.ts` — extract/reuse baseline parsing needed by read-only workspace evidence without synchronous shell work on the hot path.
- `src/server/runs/recovery.ts` — delegate legacy retry/edit/fork run creation to focused services; do not grow this 1,300+ line module.
- `src/server/supervisor/worker-failover.ts` — retain compatibility exports but route cross-CLI cases to the new-run handoff coordinator; do not spawn another CLI in the source run.
- `src/server/supervisor/index.ts` and `src/server/supervisor/wake.ts` — consume target-run outcomes and preserve quota recovery semantics across restart.
- `src/server/supervisor/observer.ts` — record pending cross-CLI handoff intent instead of only same-run failover intent.
- `src/server/conversations/send-message.ts` — reject text/composer-driven cross-CLI changes inside an existing run and preserve same-CLI model/account recreation only.
- `src/server/conversations/create.ts`, `src/server/supervisor/index.ts`, `src/server/planning/review.ts`, and `src/server/runs/recovery.ts` — call the central direct/commit worker-type assertion before worker insertion; supervisor implementation multi-worker behavior remains allowed.
- `src/server/conversations/queued-messages.ts`, `src/server/conversations/queued-message-interrupt.ts`, `src/server/quota/worker-resume.ts`, and `src/server/runs/recovery-reconciler.ts` — enforce the persisted handoff fence before source mutation/recovery.
- `src/server/prompts/supervisor.md` — describe cross-provider recovery as a new-session handoff, not an in-session worker swap.
- `src/server/credits/index.ts` — make `cross_provider` return a target CLI/account candidate for the handoff coordinator rather than mutating the source worker account.
- `src/server/events/named-events.ts` — import the focused handoff event union, add stable surfaced error codes, and avoid embedding packet bodies in SSE.
- `src/runtime/http/routes/index.ts` — register handoff routes.
- `src/runtime-api/types.ts` and `src/runtime-api/domains/index.ts` — add typed `handoffs` operations.
- `src/interface/home/useHomeMutations.ts` — add query/mutations for preview, edit, launch, and active-draft lookup; switch selection only under matching request ownership.
- `src/interface/home/useConversationActions.ts` — route session/message cross-CLI actions into `HandoffForkManager`; retain ordinary same-run message retry/edit behavior.
- `src/interface/home/ExternalSessionsPicker.tsx` — separate external resume from the new current-conversation fork option.
- `src/components/home/HomeHeader.tsx` — add the session-level entry point.
- `src/components/home/ConversationMain.tsx` — add the per-message entry point through a small extracted action component or callback; do not grow this 1,600+ line file.
- `src/components/home/RunRecoveryNotice.tsx` — add quota handoff status/action and target-run navigation.
- `src/interface/home/HomeApp.tsx` — mount/wire the lazy dialog and manager only; move logic out of this 1,700+ line file.
- `src/interface/home/EventStreamStateManager.ts` and `src/interface/home/utils.ts` — reconcile handoff lifecycle events and target selection without optimistic run fabrication.
- `src/components/settings/ModelsSettingsPanel.tsx` — clarify that `cross_provider` opens a new handoff session while same-provider strategies stay in the current CLI.
- `shared/locales/*.json` — add every new visible label, description, warning, status, aria label, and error fallback to all locales.
- `tests/db/schema.test.ts`, `tests/supervisor/worker-failover.test.ts`, `tests/supervisor/worker-failover-handoff-fails.test.ts`, `tests/supervisor/worker-failover-spawn-retry.test.ts`, `tests/supervisor/worker-failover-no-replacement.test.ts`, `tests/api/conversation-messages-route.test.ts`, `tests/ui/conversation-actions.test.ts`, `tests/app/event-stream-state-manager.test.ts`, `tests/runtime/http-registry.test.ts`, `tests/runtime/http-routes.test.ts`, `tests/runtime/route-contract-fixture.test.ts`, and `tests/runtime/fixtures/routes.v1.json` — update existing expectations around the new-run invariant.
- `docs/architecture/lifecycle-observability-and-testing.md` — document handoff decisions/events and the source/target recovery model before adding server state transitions.
- `docs/architecture/worker-conversation-stream.md` — document that the target handoff seed is an ordinary first `user_input`, not a parallel transcript.
- `.gitignore` — verify packet temp/debug output cannot be tracked; add only a narrowly scoped ignore if implementation introduces a local debug artifact.

## API and persistence design

### SQLite metadata

Add `conversation_handoffs` with:

- `id` primary key.
- `source_run_id` foreign key to `runs` with `ON DELETE CASCADE`.
- `source_worker_id` nullable foreign key to `workers` with `ON DELETE SET NULL`.
- `target_run_id` nullable foreign key to `runs` with `ON DELETE SET NULL`.
- `forked_from_message_id`, `reason`, `status`, `revision`, `source_seq`, `normalized_project_path`, and `workspace_fingerprint`.
- `target_worker_type`, `target_model`, `target_effort`, `target_account_id`, `target_selection_hash`.
- `packet_version`, `artifact_seq`, `packet_hash`, `packet_preview`, `summary_source`.
- `operation_id`, `launch_claim_token`, `claim_expires_at`, `retry_of_handoff_id`, `last_error`, `created_at`, `updated_at`, and `completed_at`.
- Unique partial indexes for one `capturing|ready|launching` handoff per source run and normalized project path, plus indexes for target run, claim expiry, and status/update time.

Add nullable indexed `runs.origin_handoff_id` and `runs.active_handoff_id`. `origin_handoff_id` is written in the same transaction as target run creation, deliberately has no cascading foreign key, and lets restart recovery discover a target even if the process died before `conversation_handoffs.target_run_id` was updated. `active_handoff_id` distinguishes an intentionally prepared source from an ordinary `needs_recovery` run and is cleared on every terminal transition.

Keep the full packet out of SQLite. Append every ready/revised packet as an `ArtifactRecordEnvelope<HybridHandoffPacketV1>` in the source run's `handoff_packets` stream and point metadata at the current sequence/hash. Store only a bounded, redacted preview for list/recovery UI.

### HTTP contract

- `POST /api/runs/:runId/handoffs` — create or return the active draft. Body: fork point, reason, and target selection. Returns `202 capturing` or `200 ready` with metadata/packet DTO.
- `GET /api/runs/:runId/handoffs?active=1` — restore a durable draft after reload.
- `GET /api/handoffs/:handoffId` — inspect the current packet/revision/result.
- `PATCH /api/handoffs/:handoffId` — patch advisory fields with `expectedRevision`; return `409` on stale revision.
- `POST /api/handoffs/:handoffId/launch` — idempotent launch with `expectedRevision`, `operationId`, and final target selection; return the target run/worker IDs.
- `POST /api/handoffs/:handoffId/cancel` — release any nonlaunching manual or quota draft fence. A launching/completed handoff cannot be cancelled; the reconciler owns abandoned launch claims.

Every flat `/api/handoffs/:handoffId` handler must resolve the source run and apply the same project/run authorization check as run-scoped endpoints before reading or mutating anything. Include an IDOR test using an authenticated caller without access to the source project. Cancellation covers every nonlaunching manual or quota draft.

There are no persisted V0 packet artifacts to migrate: the existing parser/request/render path produces ephemeral reports only. Treat those reports as advisory candidates when creating V1. If a future/unknown artifact version is encountered, retain it on disk, refuse to render it, surface `handoff.packet_version_unsupported`, and require a fresh V1 capture.

Return typed stage-specific errors. User-relevant failures also emit `error.surfaced` with stable codes `handoff.capture_failed`, `handoff.revision_conflict`, `handoff.target_unavailable`, `handoff.source_changed`, `handoff.launch_failed`, and `handoff.packet_version_unsupported`; register every code in the named-event typed union.

### Named events

Emit these via `emitNamedEvent` for every server decision:

- `handoff.capture_started`
- `handoff.packet_ready`
- `handoff.packet_revised`
- `handoff.launch_started`
- `handoff.completed`
- `handoff.cancelled`
- `handoff.failed`
- `handoff.refused`

Events carry IDs, revisions, stage, source/target IDs, target worker type, reason, and stable error code where relevant. They never carry the full packet. All event frames retain the existing SSE ID/replay/resync behavior.

## Implementation tasks

### Task 1: Document the invariant and preserve a green baseline

**Files:**
- Modify: `docs/architecture/lifecycle-observability-and-testing.md`
- Modify: `docs/architecture/worker-conversation-stream.md`

- [ ] Add architecture text stating that a CLI/provider change creates a new run, the target seed lives in its unified worker stream, and source/target ownership is never shared.
- [ ] Record the three-phase ordering: validate target; terminate/confirm source and capture final state; create/prompt target. Document the `cancelled` success state and `needs_recovery` post-stop failure state.
- [ ] Record workspace lease, drift refusal, packet redaction/untrusted-boundary, restart claim, and named-event requirements before implementing state transitions.
- [ ] Run the existing baseline without changing its expectations: `pnpm vitest run tests/api/conversation-messages-route.test.ts tests/supervisor/worker-failover.test.ts tests/supervisor/worker-failover-handoff-fails.test.ts tests/supervisor/worker-failover-spawn-retry.test.ts tests/supervisor/worker-failover-no-replacement.test.ts`.

### Task 2: Define the packet and lifecycle contracts

**Files:**
- Create: `src/shared/handoff.ts`
- Create: `tests/server/handoff/compiler.test.ts`
- Create: `tests/server/handoff/redaction.test.ts`

- [ ] Define V1 packet, provenance, lifecycle metadata, editable advisory patch, API request/response, and error-code types.
- [ ] Make authoritative versus advisory fields explicit in the types so PATCH cannot alter source/workspace/verification provenance.
- [ ] Add constants for total and per-field budgets, item counts, recent-tail bounds, and supported interruption reasons.
- [ ] Write failing tests for stable ordering, NFC/fixed-key canonicalization, a content hash that excludes only `generatedAt`, priority truncation, exact omission metadata, and rejection of unknown packet versions.
- [ ] Write failing redaction/render-boundary tests for common API keys/tokens, authorization headers, environment dumps, hidden-reasoning entries, absolute paths outside the project, control characters, nonce/delimiter injection, and content imitating system/tool-result framing.
- [ ] Run `pnpm vitest run tests/server/handoff/compiler.test.ts tests/server/handoff/redaction.test.ts` and confirm failures are contractual rather than fixture errors.

### Task 3: Add durable metadata and packet artifact storage

**Files:**
- Modify: `src/server/db/schema.ts`
- Modify: `src/server/db/index.ts`
- Modify: `src/server/artifacts/stream-types.ts`
- Modify: `src/server/artifacts/append-only-store.ts`
- Create: `src/server/handoff/store.ts`
- Create: `tests/server/handoff/store.test.ts`
- Modify: `tests/db/schema.test.ts`

- [ ] Add the `conversation_handoffs` table, `runs.originHandoffId`, `runs.activeHandoffId`, foreign keys, normalized workspace key, timestamps, revision, operation/claim/expiry fields, bounded preview, and exact partial indexes described above using the repository's additive schema pattern.
- [ ] Increment `DB_SCHEMA_VERSION` and test initialization of old and fresh databases.
- [ ] Add the run-level `handoff_packets` stream and map it to `app-data/run-data/<runId>/handoff-packets.jsonl` through the artifact store.
- [ ] Implement transactional metadata transitions plus append/read of packet versions; never expose a metadata revision whose artifact append failed.
- [ ] Enforce one active handoff per source run and normalized project path, idempotent operation IDs, and target discovery by `originHandoffId`.
- [ ] Test packet revision lookup, stale revision refusal, source deletion cascade, target deletion terminalization/fence release, expired claim lookup, and no orphaned artifact metadata.
- [ ] Run `pnpm vitest run tests/server/handoff/store.test.ts tests/db/schema.test.ts`.

### Task 4: Gather bounded deterministic evidence

**Files:**
- Create: `src/server/handoff/candidates.ts`
- Create: `src/server/handoff/workspace-state.ts`
- Create: `src/server/handoff/redaction.ts`
- Modify: `src/server/git/auto-commit.ts`
- Create: `tests/server/handoff/candidates.test.ts`
- Create: `tests/server/handoff/workspace-state.test.ts`
- Modify: `tests/server/handoff/redaction.test.ts`

- [ ] Read worker content only through bounded `readWorkerEntriesTail`/`Since`/`Before` APIs and respect superseded sequence ranges.
- [ ] Gather original/current user requests, a small exact recent tail, latest assistant recap, queued messages, unresolved execution errors, verification commands/results, plan/spec/generated artifact paths, and the source sequence.
- [ ] For message forks, constrain conversational evidence to the selected message boundary.
- [ ] Parse `runs.gitBaselineJson`, current HEAD/status, diff stats, commit range, tool edit events, and relevant agent summaries into file ownership evidence.
- [ ] Classify file ownership conservatively; never claim session ownership from current git status alone. Preserve `unknown` and warnings.
- [ ] Normalize project-relative paths, keep raw absolute project paths server-only, omit file contents and raw diff hunks by default, and include only narrowly bounded hunks for unresolved conflicts/subtle incomplete edits.
- [ ] Redact every candidate before budgeting, hashing, previewing, rendering, logging, or event emission; perform a final redaction pass over the rendered seed.
- [ ] Test large streams, already-compacted history, deleted/renamed/untracked files, a dirty pre-session baseline, external concurrent edits, post-message workspace drift, malformed baselines, and non-git projects.
- [ ] Run `pnpm vitest run tests/server/handoff/candidates.test.ts tests/server/handoff/workspace-state.test.ts tests/server/handoff/redaction.test.ts`.

### Task 5: Compile and render the hybrid packet

**Files:**
- Create: `src/server/handoff/compiler.ts`
- Modify: `src/server/handoff/request.ts`
- Modify: `src/server/handoff/parser.ts`
- Modify: `src/server/handoff/render.ts`
- Modify: `tests/server/handoff/compiler.test.ts`
- Modify: `tests/server/handoff/parser.test.ts`

- [ ] Implement deterministic merging where collected facts override advisory summaries and every conflict becomes a confidence warning.
- [ ] Detect fresh recent assistant recaps using worker/event sequence evidence.
- [ ] Update the outgoing request to return only structured task/state/decision/file explanations; use a short timeout and skip it for quota-blocked or busy workers.
- [ ] Preserve the existing synthetic fallback, but feed it through the same candidates/compiler/redaction pipeline.
- [ ] Enforce the packet budget by priority, populate `omittedSections`/`truncatedFields`, and hash the redacted canonical representation excluding only `generatedAt`.
- [ ] Render a concise target prompt with objective, state, decisions, workspace, verification, pending input, uncertainty, and an explicit instruction to inspect current files before acting. Place canonical JSON inside a post-sanitization random nonce fence and ensure embedded text cannot close or imitate the boundary.
- [ ] Ensure quota wording is a reason field, not hard-coded into all handoffs.
- [ ] Test clean completed turns, mid-turn interruption, hard quota interruption, already-compacted history, short sessions, stale summaries, malicious advisory content, and overflow.
- [ ] Run `pnpm vitest run tests/server/handoff/compiler.test.ts tests/server/handoff/redaction.test.ts tests/server/handoff/parser.test.ts`.

### Task 6: Extract safe new-run fork creation

**Files:**
- Create: `src/server/runs/fork.ts`
- Modify: `src/server/runs/recovery.ts`
- Modify: `tests/api/run-route.test.ts`
- Modify: `tests/ui/conversation-actions.test.ts`

- [ ] Extract plan/run/message-copy creation from the existing `recoverRun(... action: "fork")` branch without changing retry/edit semantics.
- [ ] Accept an explicit target worker type/model/effort/account/allowed-types selection and copy `preferredWorkerAccountId`, which the current fork path can omit.
- [ ] Preserve `parentRunId`, `forkedFromMessageId`, project path, and auto-commit preferences. Add `copyMessagePrefix: boolean`: legacy same-CLI forks use `true`; cross-CLI handoffs use `false` so the rendered packet is the target's only initial conversation entry.
- [ ] For a cross-CLI target, capture a fresh git baseline after source termination and in-flight auto-commit settlement, and store it as the target `gitBaselineJson`/workspace metadata. The packet separately reports source-session changes relative to the source's original baseline, so target ownership begins at handoff.
- [ ] Keep target preflight validation separate from target creation. The coordinator performs source termination and post-stop capture between preflight and target creation.
- [ ] Keep existing ordinary and worktree fork behavior passing; do not create a worktree for cross-CLI handoff.
- [ ] On worker launch failure, retain the partially created plan/run as a visible `failed` diagnostic record stamped with `originHandoffId`; do not delete it or claim launch succeeded.
- [ ] Run `pnpm vitest run tests/api/run-route.test.ts tests/ui/conversation-actions.test.ts`.

### Task 7: Build the server coordinator and source fence

**Files:**
- Create: `src/server/handoff/coordinator.ts`
- Create: `src/server/handoff/reconciler.ts`
- Create: `tests/server/handoff/coordinator.test.ts`
- Create: `tests/server/handoff/reconciler.test.ts`
- Modify: `src/server/conversations/queued-messages.ts`
- Modify: `src/server/conversations/queued-message-interrupt.ts`
- Modify: `src/server/quota/worker-resume.ts`
- Modify: `src/server/runs/recovery-reconciler.ts`

- [ ] Implement capture, revise, launch, cancel, retry, and restore transitions over the persisted metadata/store.
- [ ] Acquire the persisted normalized-workspace lease plus in-process workspace mutex; reject another active handoff or any other live worker already using that checkout.
- [ ] On explicit prepare/capture, branch on runtime ownership: for a live source, advance turn generation, request graceful interruption, wait up to `HANDOFF_STREAM_SETTLE_TIMEOUT_MS`, terminate the CLI process, and confirm exit; for idle/quota/stopped sources, verify no PID/live runtime and proceed. Refuse before target creation if absence/exit cannot be confirmed.
- [ ] Disable source auto-commit scheduling, await any in-flight commit, deliberately skip a new final auto-commit, and warn when interruption occurred without a clean tool/turn boundary because files may be partially written.
- [ ] After process absence/exit, recapture the final durable sequence, HEAD, canonical tracked-diff workspace fingerprint, fresh target git baseline, and packet. On launch, re-read them and refuse drift with `handoff.source_changed` plus a visible recapture action.
- [ ] Stop queued delivery, preserve undelivered messages in continuity, and atomically mark their source rows `cancelled` with `cross_cli_handoff` after successful launch so they cannot execute twice.
- [ ] Validate target CLI/account/model/effort/quota state and automatic handoff chain/cooldown limits before source termination.
- [ ] Persist a server claim token/expiry, create the stamped target run, persist rendered seed with `appendUserInputOnDelivery`, and start the target only after source process exit was confirmed.
- [ ] On success clear `activeHandoffId` and set source run `cancelled`. On post-stop target failure clear the marker, restore `quota_waiting` plus its wake/incident when a future reset is durable, otherwise set `needs_recovery` with `handoff_post_stop_failure`; leave any partial target visible as `failed` and release the workspace fence.
- [ ] Implement launch idempotency, stale source-sequence/revision/workspace refusal, and a startup/heartbeat reconciler that adopts targets by `originHandoffId` or fails expired `capturing`, `ready`, and `launching` leases. A client heartbeat may extend `ready` only up to the 15-minute maximum.
- [ ] Gate send, queue, retry/edit, resume, wake, auto-commit, and reconciler mutations for every run sharing a leased workspace.
- [ ] Handle target deletion by terminalizing a nonterminal handoff and releasing its fence before `ON DELETE SET NULL` runs.
- [ ] Test races: another live run in the checkout, send versus capture, capture versus quota wake, live versus already-dead/quota sources, double launch, cancel versus launch, process refusing to exit, late output, tracked workspace/HEAD drift, untracked churn exclusion, ready expiry with unsaved client edits, target spawn failure, claim expiry, orphan adoption, restart at every status, queued-message cancellation, and source/target deletion.
- [ ] Run `pnpm vitest run tests/server/handoff/coordinator.test.ts tests/server/handoff/reconciler.test.ts tests/server/quota/worker-resume.test.ts tests/server/runs/recovery-reconciler.test.ts`.

### Task 8: Expose typed HTTP/runtime APIs and observability

**Files:**
- Create: `src/server/events/handoff-events.ts`
- Modify: `src/server/events/named-events.ts`
- Create: `src/runtime/http/routes/handoffs.ts`
- Modify: `src/runtime/http/routes/index.ts`
- Modify: `src/runtime-api/types.ts`
- Modify: `src/runtime-api/domains/index.ts`
- Create: `tests/api/handoffs-route.test.ts`
- Modify: `tests/runtime/http-registry.test.ts`
- Modify: `tests/runtime/http-routes.test.ts`
- Modify: `tests/runtime/route-contract-fixture.test.ts`
- Modify: `tests/runtime/fixtures/routes.v1.json`

- [ ] Add the named handoff events and every stable `error.surfaced` code, including `handoff.packet_version_unsupported`, without growing `named-events.ts` with full implementation logic.
- [ ] Register create/list/get/patch/launch/cancel routes; resolve flat handoff IDs through the source run's authorization scope before returning data, and validate all IDs, enums, revisions, and selection fields.
- [ ] Return `202` for in-progress capture, `409` for ownership/revision conflicts, `422` for incompatible target selection, and stage-specific `5xx` errors only for actual server failures.
- [ ] Add typed runtime APIs; do not route handoffs through `runs.act` with `unknown` bodies.
- [ ] Ensure no HTTP or SSE response includes secrets, raw packet artifacts when only metadata is needed, or untranslated visible server prose at the UI boundary.
- [ ] Test auth/IDOR, malformed input, unsupported source mode, same-CLI target refusal, stale revision, replayed operation ID, packet retrieval, and surfaced error event payloads.
- [ ] Run `pnpm vitest run tests/api/handoffs-route.test.ts tests/runtime/http-registry.test.ts tests/runtime/http-routes.test.ts tests/runtime/route-contract-fixture.test.ts`.

### Task 9: Replace every same-run cross-CLI path

**Files:**
- Create: `src/server/workers/direct-run-type-invariant.ts`
- Create: `tests/server/workers/direct-run-type-invariant.test.ts`
- Modify: `src/server/conversations/send-message.ts`
- Modify: `src/server/conversations/create.ts`
- Modify: `src/server/supervisor/worker-failover.ts`
- Modify: `src/server/supervisor/index.ts`
- Modify: `src/server/supervisor/wake.ts`
- Modify: `src/server/supervisor/observer.ts`
- Modify: `src/server/prompts/supervisor.md`
- Modify: `src/server/credits/index.ts`
- Modify: `src/server/planning/review.ts`
- Modify: `src/server/runs/recovery.ts`
- Modify: `src/server/db/index.ts`
- Modify: `src/components/settings/ModelsSettingsPanel.tsx`
- Modify: `tests/api/conversation-messages-route.test.ts`
- Modify: `tests/supervisor/worker-failover.test.ts`
- Modify: `tests/supervisor/worker-failover-handoff-fails.test.ts`
- Modify: `tests/supervisor/worker-failover-spawn-retry.test.ts`
- Modify: `tests/supervisor/worker-failover-no-replacement.test.ts`

- [ ] First write failing tests proving: follow-up text/API cannot change a direct run's CLI; cross-provider failover returns a distinct target run; target unavailable preserves quota recovery; and direct/commit worker insertion of another type is rejected at the central assertion and SQLite trigger.
- [ ] Add `assertDirectRunWorkerTypeInvariant` before all direct/commit worker insertions and an additive SQLite `BEFORE INSERT ON workers` trigger as the final safety net. The trigger applies only when the referenced run has `session_type = 'omni'` and `mode IN ('direct', 'commit')`, and only rejects a *new* row whose normalized type differs from an existing worker; creating it on a legacy database never scans/rejects pre-existing mixed rows. Do not restrict intentional multi-type supervisor implementation runs.
- [ ] Catch the trigger's stable constraint marker at the shared worker-insert boundary, map it to typed `409 handoff_required`, emit `handoff.refused`, and translate visible guidance at the UI boundary; never leak a raw SQLite 500.
- [ ] In `applyWorkerPreferenceForMessage`/`reconcileDirectWorkerSelection`, reject a type change for an existing run with a typed “fork required” result; do not persist the new preferred type and do not defer it for later recreation.
- [ ] Keep same-CLI model, effort, and account recreation behavior and its current ownership fencing.
- [ ] Change `src/server/credits/index.ts` so `cross_provider` selects and returns a candidate target CLI/account without mutating source credentials; validate it is not quota-blocked or in the recent exhaustion cooldown.
- [ ] Route cross-provider quota strategy/allowed-worker selection to `coordinator.captureAndLaunch` and return `targetRunId` rather than a replacement worker ID. Enforce automatic chain depth three and recent-provider/account exclusions.
- [ ] Keep the existing `worker-failover.ts` exports as compatibility wrappers while callers/tests migrate; do not delete the file.
- [ ] Update wake/restart recovery to continue a persisted handoff rather than retrying a same-run provider spawn.
- [ ] Update supervisor prompt and settings explanation to say cross-provider recovery creates a new session.
- [ ] Rename user-visible lifecycle copy from “switching workers” to handoff/fork language while retaining legacy event parsing only where backward compatibility needs it.
- [ ] Run `pnpm vitest run tests/server/workers/direct-run-type-invariant.test.ts tests/api/conversation-messages-route.test.ts tests/supervisor/worker-failover.test.ts tests/supervisor/worker-failover-handoff-fails.test.ts tests/supervisor/worker-failover-spawn-retry.test.ts tests/supervisor/worker-failover-no-replacement.test.ts` and assert no direct/commit source run contains workers of two CLI types.

### Task 10: Build the client Manager and dialog

**Files:**
- Create: `src/interface/home/HandoffForkManager.ts`
- Create: `src/interface/home/HandoffForkDialog.tsx`
- Create: `src/components/home/CliLaunchSelectionFields.tsx`
- Modify: `src/interface/home/useHomeMutations.ts`
- Create: `tests/app/handoff-fork-manager.test.ts`
- Create: `tests/ui/handoff-fork-dialog.test.tsx`
- Modify: `shared/locales/*.json`

- [ ] Implement a Manager-owned state machine for closed/selecting/capturing/ready/editing/launching/completed/error, including source run/message IDs, revision, target selection, packet, warnings, and request token.
- [ ] Use TanStack Query only for transport/cache; the Manager is the single UI source of truth and ignores responses whose ownership token no longer matches.
- [ ] Build an accessible, responsive dialog using existing Dialog/Select/Textarea/Button/ScrollArea/Alert/Badge primitives.
- [ ] Keep dialog open/target selection read-only. Label **Prepare handoff** as the point that stops the source CLI; after preparation, cancelling releases the lease and leaves the stopped source in `needs_recovery` so the user can deliberately resume it.
- [ ] Default to the last compatible *different* CLI, exclude the source CLI, and validate account/model/effort combinations before capture/launch.
- [ ] Show authoritative sections read-only, advisory fields editable, source/provenance/warnings visible, and an explicit “current files win” note.
- [ ] Debounce or explicitly save advisory edits with `expectedRevision`; disable launch until the current edit revision is acknowledged.
- [ ] Renew the ready lease while the preview is open without exceeding 15 minutes. On expiry, discard only unsaved local edits, show that the source remains recoverable, and offer **Prepare fresh handoff**; on tracked drift, offer the same recapture action rather than looping launch retries.
- [ ] Allow recovery of the active durable draft after reload and a clear cancel action before launch for both manual and quota drafts.
- [ ] Add all visible/aria/error strings to every `shared/locales/*.json` file and subscribe with `useI18nSnapshot()`.
- [ ] Test keyboard focus, escape/cancel, mobile sizing, loading/error/retry states, stale edit conflicts, CLI exclusion, and no hard-coded user-facing JSX.
- [ ] Run `pnpm vitest run tests/app/handoff-fork-manager.test.ts tests/ui/handoff-fork-dialog.test.tsx`.

### Task 11: Wire every product entry point

**Files:**
- Modify: `src/interface/home/useConversationActions.ts`
- Modify: `src/interface/home/ExternalSessionsPicker.tsx`
- Modify: `src/components/home/HomeHeader.tsx`
- Modify: `src/components/home/ConversationMain.tsx`
- Modify: `src/components/home/RunRecoveryNotice.tsx`
- Modify: `src/interface/home/HomeApp.tsx`
- Modify: `tests/ui/conversation-actions.test.ts`
- Modify: `tests/server/external-sessions/discovery.test.ts`
- Modify: `shared/locales/*.json`

- [ ] Add **Fork to another CLI** to the session menu for eligible direct/commit runs.
- [ ] Add **Fork to another CLI from here** to user-message actions and pass the exact message ID.
- [ ] Add a distinct current-conversation fork choice to Resume CLI Session without changing external Claude/Gemini resume behavior.
- [ ] Add a quota notice action/status that opens or navigates to the automatic handoff and target run.
- [ ] Add a quota/recovery notice action that cancels an abandoned ready/capturing handoff or retries a `needs_recovery` source; do not require the lost dialog state to release a fence.
- [ ] Keep `HomeApp.tsx` as wiring only and extract any message-action UI needed to avoid growing oversized components.
- [ ] On success, select the target only if the user is still viewing the source associated with the completed request; otherwise show a non-destructive notification/link.
- [ ] Preserve ordinary “Fork session” semantics if it remains same-CLI, and make the cross-CLI wording unambiguous.
- [ ] Test eligibility, source/message payloads, no selected run, unsupported modes, selection races, external resume regression, and quota CTA behavior.
- [ ] Run `pnpm vitest run tests/ui/conversation-actions.test.ts tests/server/external-sessions/discovery.test.ts`.

### Task 12: Reconcile SSE, restart, and lifecycle recovery

**Files:**
- Modify: `src/interface/home/EventStreamStateManager.ts`
- Modify: `src/interface/home/utils.ts`
- Modify: `tests/app/event-stream-state-manager.test.ts`
- Create: `tests/lifecycle/scenarios/cross-cli-handoff-fork.test.ts`
- Create: `tests/lifecycle/scenarios/cross-cli-handoff-restart.test.ts`

- [ ] Reconcile capture/revision/launch/completion/failure events into existing run snapshots without creating optimistic fake runs.
- [ ] Fetch snapshot/active handoff after `stream.resync_required`; treat SSE as an invalidation signal and HTTP/SQLite as authority.
- [ ] Add a manual lifecycle scenario covering source activity, stable capture, packet artifact, target run/worker/seed, source stop, and no mixed CLI types.
- [ ] Add a quota scenario where the outgoing worker cannot answer, synthetic capture succeeds, and the target new run continues.
- [ ] Add restart checkpoints after `capturing`, `ready`, and `launching`; prove recovery either finishes once or surfaces a retryable failure without duplicate targets.
- [ ] Add FK/delete coverage: deleting the source removes its packet metadata/artifact while the target's seed remains readable.
- [ ] Validate every decision through `/api/events/log?since=<id>&runId=<id>` and assert named refusal/failure events exist.
- [ ] Run the focused state-manager test, then `pnpm test:lifecycle`.

### Task 13: Full verification and handoff documentation

**Files:**
- Modify only as failures require within the files already listed.
- Verify: `.gitignore`

- [ ] Re-read both architecture docs and confirm every new server decision emits a named event and every user-relevant failure emits a stable `error.surfaced` code.
- [ ] Verify every target seed was persisted through `appendUserInputOnDelivery` and no parallel conversation storage was introduced.
- [ ] Verify cross-CLI targets copy no source message rows/worker entries: only parent/message metadata plus the rendered first `user_input` packet crosses the boundary.
- [ ] Verify logs/events demonstrate confirmed source process exit before target run creation and that the direct/commit SQLite trigger rejects mixed worker types.
- [ ] Verify all visible strings use `t()` and all locale files contain the same new keys.
- [ ] Verify packet storage, test databases, generated debug packets, CLI transcripts, credentials, and temporary review output are not accidentally tracked; make only a narrow `.gitignore` addition if needed.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm vitest run`.
- [ ] Run `pnpm test:lifecycle`.
- [ ] Run the mandatory frontend build: `pnpm build:interface:web`.
- [ ] Inspect `git diff --check` and `git status --short`; preserve unrelated user changes and confirm the implementation did not create a branch, worktree, or delete files.

## Verification matrix

| Case | Expected result |
|---|---|
| Header fork, idle source | Prepare verifies no live runtime, captures final state, and only then allows creation of a distinct target run. |
| Header fork, active turn | Prepare generation-fences, settles, terminates, and confirms source process exit before capture; target creation cannot overlap. |
| Source CLI refuses to exit | Launch is refused before target creation; source is `needs_recovery`; named failure identifies termination. |
| Another live run uses checkout | Workspace lease/preflight refuses handoff; neither source nor other run is mutated. |
| Message fork | Conversation is bounded at the message; current workspace drift is explicit; `forkedFromMessageId` is preserved. |
| Manual preview becomes stale | Sequence/HEAD/workspace fingerprint drift returns `handoff.source_changed`; user must prepare a fresh packet. |
| Ready preview abandoned | Lease expires by 15 minutes, source marker/fence clears, quota wake or recovery state is restored, and reopening offers a fresh prepare. |
| Resume CLI Session dialog | External resume still resumes an external provider session; current-conversation fork opens handoff flow. |
| Quota, outgoing CLI dead | No outgoing request; synthetic packet launches a distinct target run. |
| Quota, target unavailable | Preflight failure leaves `quota_waiting` untouched; post-stop failure restores its durable future wake or uses `needs_recovery`; no success is reported. |
| Quota handoff loop | Recent exhausted providers/accounts are excluded; depth four is refused with a visible wait/manual-recovery state. |
| Same-run text asks to switch CLI | Request is refused with fork guidance; source preferences/worker type do not change. |
| Same-CLI model/account change | Existing supported recreation path still works inside the run. |
| Already compacted source | Provider recap is advisory; post-compaction evidence and exact recent tail are included. |
| Dirty workspace before session | Pre-existing files are not claimed as session-owned; uncertainty is preserved. |
| Concurrent/external file change | Ownership becomes external/unknown; packet does not overwrite or silently attribute it. |
| Packet overflow | Highest-priority facts remain; dropped fields are named; hash is deterministic. |
| Reload while preview is ready | Active draft and revision restore from server; edits do not regress. |
| Disconnect during launch | SSE replay/snapshot returns one target; repeated operation ID is idempotent. |
| Crash after target row creation | Reconciler discovers exactly one target by `originHandoffId`, adopts or fails it, and releases the claim/lease. |
| Target deleted during launch | Handoff terminalizes and source/workspace fence releases before the target link is nulled. |
| Delete source after completion | Source metadata/artifact is cleaned; target initial seed remains self-contained. |

## Agentic user-journey candidates (approval required before running)

These browser journeys are valuable after automated tests/build pass, but they must not be run without explicit user approval because they create real local conversations and CLI activity:

1. Start a Codex direct session, make a small edit, open the header handoff dialog, inspect/edit the packet, fork to Claude, verify the new sidebar session and source preservation, then clean up the test conversations/artifacts.
2. Fork from an earlier user message and confirm the preview distinguishes historical conversation state from the current checkout.
3. Simulate/induce a quota-waiting source through supported test controls, select cross-provider recovery, verify the synthetic packet and target navigation, then clean up.
4. Reload the browser while a handoff preview is open and while launch is completing; verify restoration, SSE replay, and no duplicate target.

## Implementation guardrails

- Begin implementation by rechecking `git status --short`; the current worktree already contains user changes. Never overwrite, revert, or reformat unrelated edits.
- Do not create a branch or worktree and do not delete any file.
- Keep new logic out of `HomeApp.tsx`, `ConversationMain.tsx`, `runs/recovery.ts`, and `worker-failover.ts` except thin integration/delegation because all are already oversized.
- Use `src/server/git/command.ts` or existing async helpers for git evidence; avoid synchronous shell calls in request paths.
- Never log or emit the full packet in named events, errors, or ordinary server logs.
- Never pass translated strings through transactions or persist translated UI copy.
- Never treat an LLM-generated summary as proof that a file changed, a test passed, or a command ran.
- Do not add configurable frontend strings/settings through `.env`; packet limits are code constants.
- Clean up test conversations and persisted artifacts after any approved live/agentic validation.
--- UPDATED PLAN END ---

uuid: 5a163daf-0a51-48bc-96fd-ad42de323fba
parent: 4d3cd5da-bd8f-471b-9fbf-822facc209ba

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-08-20T18:17:34.557Z","phase":null} -->
## Claude thinking · 2026-08-20T18:17:34.557Z



uuid: bcf95be8-f111-462c-87b1-14567b2d146e
parent: 5a163daf-0a51-48bc-96fd-ad42de323fba

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-08-20T18:17:43.964Z","phase":null} -->
## Claude · 2026-08-20T18:17:43.964Z

HARDEN

1. **The source-status-on-release rule is stated once and contradicted in three places, and the contradiction is inside an executable step.** The invariant section defines the correct conditional: cancellation/expiry (and post-stop launch failure) clear `runs.activeHandoffId`, release the lease, and **restore `quota_waiting` when a durable future wake exists, otherwise set `needs_recovery`**. But Task 10's checkbox instructs the opposite unconditionally — "after preparation, cancelling releases the lease and leaves the stopped source in `needs_recovery` so the user can deliberately resume it." An agent executing Task 10 literally will destroy quota wake restoration for cancelled quota-originated handoffs, which is the exact failure mode the conditional was added to prevent. Two supporting spots carry the same stale rule: Task 1's doc bullet ("Document the `cancelled` success state and `needs_recovery` post-stop failure state") omits the `quota_waiting` branch it is supposed to document, and the matrix row "Source CLI refuses to exit → source is `needs_recovery`" hardcodes the status for a capture-stage failure without saying whether the same conditional applies when the source entered capture as `quota_waiting`. Fix: state the conditional once as a named helper/decision and reference it from Task 7, Task 10, Task 1, and both matrix rows, including the capture-termination-failure case.

2. **`409 handoff_required` is used but never registered.** Task 9 maps the trigger's constraint marker to a typed `409 handoff_required` and emits `handoff.refused`, yet the HTTP contract enumerates only `handoff_in_progress` and `handoff_revision_conflict` as 409 codes, and the `error.surfaced` registry lists `handoff.capture_failed`, `handoff.revision_conflict`, `handoff.target_unavailable`, `handoff.source_changed`, `handoff.launch_failed`, and `handoff.packet_version_unsupported` — not the fork-required code. The same gap covers the typed "fork required" result returned by `applyWorkerPreferenceForMessage`/`reconcileDirectWorkerSelection`. Since the plan requires that every code be registered in the named-event typed union and asserted in route/contract tests, add the fork-required code to the HTTP 409 list, the `error.surfaced` registry, and the Task 8 assertion list so the refusal path is not the one surfaced error without a stable contract.

uuid: da4547fe-38e3-44e8-bec2-27576e054680
parent: bcf95be8-f111-462c-87b1-14567b2d146e

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-08-20T18:18:22.966Z","phase":null} -->
## Claude state: queue-operation · 2026-08-20T18:18:22.966Z

````text
{
  "type": "queue-operation",
  "operation": "enqueue",
  "timestamp": "2026-08-20T18:18:22.966Z",
  "sessionId": "23684cf2-66e9-47ff-ada1-76c62f4558a0",
  "content": "I resolved the final two blockers by defining one settleSourceAfterUnsuccessfulHandoff helper used by every unsuccessful release (durable quota wake restored, otherwise stage-specific needs_recovery) and referencing it consistently in tasks/UI/matrix; and by registering HTTP handoff_required plus surfaced handoff.fork_required throughout contracts, events, trigger mapping, and Task 8.\n\nReview the complete artifact once more. Return exactly READY if no implementation blocker remains, otherwise HARDEN followed only by concrete blockers. Do not write files or use tools.\n\n--- PLAN START ---\n\n# Feature Implementation Plan\n\n> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax.\n\n**Feature:** Cross-CLI Hybrid Handoff Fork\n\n**Goal:** Let a user fork any direct-control conversation into a new session running on a different CLI, carrying a compact, inspectable hybrid handoff packet; use the same new-run mechanism when cross-provider quota recovery is selected, and make same-run cross-CLI switching impossible.\n\n**Architecture:** A server-owned handoff coordinator freezes the source at a durable worker-stream sequence, gathers bounded deterministic evidence, optionally adds a semantic summary, compiles and persists a versioned packet, and launches a completely separate target run. SQLite stores lifecycle metadata; the append-only artifact store holds packet versions; the target worker stream receives the rendered packet as its first `user_input`. The source run is preserved as stopped history. Same-CLI model/account recovery may continue inside a run, but changing the CLI/provider always crosses a run boundary.\n\n**Tech Stack:** TypeScript, React, TanStack Query, global Manager classes, Drizzle + SQLite, append-only JSONL artifacts, existing runtime HTTP registry/API adapters, named SSE events, Vitest, lifecycle HTTP/SSE scenarios, existing shadcn/ui primitives, and locale JSON files.\n\n**North Star Product:** A user can move work between CLI ecosystems without pretending their provider sessions, recovery semantics, or transcripts are interchangeable. The new agent starts with the smallest trustworthy continuation context, the source remains auditable, and failures never strand or silently mutate either conversation.\n\n**Current Milestone:** Ship cross-CLI handoff forks for direct/commit conversations from the session menu, an individual message, the existing Resume CLI Session dialog, and quota recovery. The packet is editable where it is advisory, inspectable after launch, bounded, redacted, restart-safe, and synthesized without contacting an exhausted provider when necessary.\n\n**Future Product Direction:** Reuse the packet format for export/import and cross-device handoff only after this milestone proves the provenance, recovery, and deletion model. Do not add same-run CLI switching, background multi-agent continuation, or automatic worktree creation in this milestone.\n\n**Final Functionality Standard:** Every cross-CLI transition creates a new run and target worker stream; no server path can recreate a worker under another CLI in the source run. The packet accurately identifies uncertainty and pre-existing workspace changes, survives a process restart, excludes secrets and hidden reasoning, and produces enough observability to explain every capture, launch, refusal, and failure.\n\n---\n\n## Product decisions and non-goals\n\n1. **A CLI handoff is a fork, never a resume.** “Resume external session” keeps its existing meaning. “Fork current conversation to another CLI” creates a new OmniHarness run with `parentRunId` and an optional `forkedFromMessageId`.\n2. **The source is historical after a successful launch.** Before target creation, terminate any live source CLI process and confirm it exited; if no live runtime owns the source, verify that fact and skip interruption/termination. On success set the source run to `cancelled`, retain its transcript and artifacts, and select the target run in the UI. If target launch fails after source termination, restore `quota_waiting` when a durable future quota wake exists; otherwise set `needs_recovery`. Never keep two CLIs editing the same checkout concurrently.\n3. **The packet is hybrid.** Deterministic state is authoritative; generated summaries and outgoing-agent reports are advisory. Current disk state wins over prose.\n4. **Manual and quota paths share one coordinator.** Manual entry points offer a preview. A quota-triggered cross-provider handoff may launch without waiting for an exhausted CLI, then exposes the persisted packet for inspection.\n5. **Only advisory content is user-editable.** The user may amend objective, status, next steps, blockers, notes, and relevant-file explanations. Source IDs, stream sequence, git evidence, verification records, target selection, provenance, and hash are server-owned.\n6. **No full transcript or full diff by default.** The packet contains a short exact tail plus summaries, file-level evidence, and compact error/test output. The source run remains the place to inspect full history.\n7. **No hidden reasoning.** Never copy `thought`, chain-of-thought, raw environment, credentials, authorization headers, binary attachments, or unrestricted tool output into a packet.\n8. **No automatic worktree.** This feature uses the current checkout and avoids concurrency by stopping the source. Existing explicit worktree fork actions remain separate.\n9. **No file deletion is part of this plan.** Refactor existing modules in place or add focused modules; preserve project history and user changes.\n\n## User journeys\n\n### Manual fork from the session\n\n1. The user opens the session menu and selects **Fork to another CLI**.\n2. The dialog defaults to a different available CLI and offers compatible account, model, and effort choices.\n3. The user explicitly chooses **Prepare handoff**, acknowledging that any live source CLI will stop. The server gracefully interrupts then terminates it (or verifies no live runtime exists), confirms exit, captures the final stable boundary, and returns a compact preview with provenance and warnings.\n4. The user may edit advisory notes, then launches.\n5. At launch OmniHarness revalidates target and source/workspace fingerprints. Because source exit was already confirmed, it creates the new run, persists the packet as the target's initial user input, starts the selected CLI, marks the source `cancelled`, and selects the target in the sidebar.\n\n### Fork from a message\n\n1. The user chooses **Fork to another CLI from here** on a user message and receives the same explicit **Prepare handoff** confirmation that names the source stop; selecting an old message never bypasses termination.\n2. Candidate collection ignores superseded/later conversation entries but compares against the current workspace, explicitly warning when files contain changes made after the selected message.\n3. The rest of the flow is the same as the manual session fork.\n\n### Fork from Resume CLI Session\n\n1. The existing dialog clearly separates **Resume external session** from **Fork current conversation**.\n2. The fork option appears only with an eligible selected OmniHarness direct/commit run.\n3. Choosing it opens the same handoff dialog, not a provider-session resume flow.\n\n### Cross-provider quota recovery\n\n1. A CLI reaches a durable quota-waiting state.\n2. Same-provider account/model recovery may use existing same-CLI recovery.\n3. If the selected strategy requires another CLI/provider, the server synthesizes a packet from persisted evidence and creates a new run.\n4. The exhausted source is never prompted for a handoff and never receives a replacement worker of another type.\n5. If preflight finds no target, the untouched source stays `quota_waiting` with its wake schedule. If launch fails after source termination, restore `quota_waiting` when a durable future wake exists; otherwise use `needs_recovery`. In both cases the error names the failed stage.\n\n## Compact handoff packet contract\n\nCreate a versioned `HybridHandoffPacketV1` with the following logical shape. Use stable IDs and enums rather than translated labels.\n\n```ts\ntype HybridHandoffPacketV1 = {\n  handoffVersion: 1;\n  source: {\n    runId: string;\n    workerId: string | null;\n    workerType: SupportedWorkerType | null;\n    forkedFromMessageId: string | null;\n    sourceSeq: number | null;\n    interruptionReason: \"manual_session\" | \"manual_message\" | \"quota_exhausted\";\n    generatedAt: string;\n  };\n  target: {\n    workerType: SupportedWorkerType;\n    model: string | null;\n    effort: string | null;\n    accountId: string | null;\n  };\n  task: {\n    originalRequest: string | null;\n    currentObjective: string | null;\n    acceptanceCriteria: string[];\n    userConstraints: string[];\n  };\n  state: {\n    completed: string[];\n    inProgress: string[];\n    remaining: string[];\n    blockers: string[];\n    openQuestions: string[];\n    rejectedApproaches: Array<{ approach: string; reason: string }>;\n  };\n  decisions: Array<{ decision: string; reason: string | null; evidence: string[] }>;\n  workspace: {\n    projectRootLabel: string;\n    baselineCommit: string | null;\n    currentHead: string | null;\n    dirtyBeforeSession: boolean | null;\n    modifiedFiles: Array<{\n      path: string;\n      changeType: \"added\" | \"modified\" | \"deleted\" | \"renamed\" | \"unmerged\";\n      ownership: \"session\" | \"probable_session\" | \"preexisting\" | \"external\" | \"unknown\";\n      summary: string | null;\n      evidence: string[];\n    }>;\n    untrackedFiles: string[];\n    relevantUnchangedFiles: string[];\n    commitsCreated: string[];\n  };\n  verification: Array<{\n    command: string;\n    result: \"passed\" | \"failed\" | \"unknown\";\n    exitCode: number | null;\n    importantOutput: string | null;\n  }>;\n  artifacts: {\n    plans: string[];\n    specs: string[];\n    generatedOutputs: string[];\n  };\n  continuity: {\n    recentUserMessages: string[];\n    recentAssistantSummary: string | null;\n    pendingUserInput: string | null;\n    queuedMessages: string[];\n  };\n  provenance: {\n    summarySource: \"outgoing_worker\" | \"recent_assistant\" | \"synthetic\" | \"hybrid\";\n    omittedSections: string[];\n    confidenceWarnings: string[];\n    truncatedFields: string[];\n  };\n};\n```\n\nCompilation rules:\n\n- Set an explicit 36,000-character rendered-packet ceiling (roughly 6,000–10,000 tokens depending on content), plus per-field item and character limits. Keep the constants in code, not environment variables.\n- Prioritize source identity and sequence, user constraints, current objective, blockers/errors, file evidence, verification, decisions, queued input, then recent conversational tail. Drop completed prose first.\n- Stable-sort every deterministic collection so the same redacted nonvolatile evidence yields the same semantic content hash; `generatedAt` may differ without changing that hash.\n- Reuse a recent assistant recap only as advisory text. It is “fresh” only if its worker sequence is at or after the last included tool/result lifecycle boundary; otherwise include it with a stale-summary warning.\n- Ask an outgoing worker for a structured report only when it is idle/responsive and not quota-blocked. Bound the request timeout. Never delay quota recovery on this call.\n- For a hard interruption, synthesize entirely from the worker stream, execution events, messages/queued messages, run metadata, git evidence, and known artifacts.\n- For a message fork, cap conversation candidates at that message/stream boundary while computing workspace state at capture time; call out the mismatch rather than claiming the checkout was rewound.\n- Render advisory narrative inside an explicit untrusted-data boundary telling the target to verify disk state. Do not let tool/assistant text masquerade as system instructions.\n- Run redaction before budgeting, canonicalization, hashing, preview extraction, rendering, logging, or event emission. Apply it to every structured text field and to the final rendered seed, including verification output, blockers, decision evidence, queued text, and outgoing-worker reports.\n- Keep the absolute `projectPath` only in server-side run/handoff metadata for access and launch checks. The packet/API uses a non-sensitive `projectRootLabel` such as the repository directory name; all file evidence is project-relative.\n- Hash the NFC-normalized, fixed-key-order canonical packet while excluding only volatile `generatedAt`. Target selection remains hash input, so changing it creates a new hash/revision.\n- Render untrusted content inside a randomly generated, high-entropy nonce fence created after sanitization. Reject/regenerate a nonce that occurs in content, encode the interior as canonical JSON, and test delimiter/system/tool-frame imitation. The renderer's nonce is not part of the semantic packet hash.\n\n## State machine and invariants\n\nPersist these statuses: `capturing -> ready -> launching -> completed`, with terminal `failed` and `cancelled`. Only `capturing`, `ready`, and `launching` are nonterminal and covered by active-handoff uniqueness. Retrying a terminal failure always creates a new handoff row linked to the failed attempt; it never resurrects the terminal row.\n\nThe coordinator owns an immutable launch fence:\n\n```ts\n{\n  handoffId,\n  revision,\n  sourceRunId,\n  sourceWorkerId,\n  sourceSeq,\n  workspaceFingerprint,\n  targetSelectionHash\n}\n```\n\nServer invariants:\n\n- At most one nonterminal handoff exists for a source run and normalized project path. A persistent workspace lease plus an in-process keyed mutex serializes capture/launch; every other OmniHarness mutation path for a run sharing that project refuses while the lease is active. Before capture, also refuse when another live run already owns a worker in the same checkout.\n- New messages, queued-message delivery, retry/edit recovery, manual resume, quota wake, auto-commit, and reconciler actions refuse with `409 handoff_in_progress` while the source workspace is fenced.\n- Opening the dialog is read-only. The explicit **Prepare handoff** action acquires the lease. If the source owns a live runtime, advance turn generation, request graceful interruption, wait up to `HANDOFF_STREAM_SETTLE_TIMEOUT_MS`, terminate the CLI process, and confirm process exit/no runtime ownership. If it is idle, quota-blocked, or already stopped, verify that no PID/live runtime owns it and skip the interruption/termination steps. If absence/exit cannot be confirmed, fail capture and do not create a target.\n- Before termination, disable new source auto-commit scheduling and await any in-flight auto-commit under the workspace lease; do not manufacture a final commit. After confirmed source absence/termination, set `runs.activeHandoffId`, use `needs_recovery` internally, and capture the final durable worker sequence and git state. UI/recovery consumers seeing `activeHandoffId` render the handoff draft state instead of a generic crash banner. `ready`/`launching` remain handoff statuses, not new run statuses.\n- Define `workspaceFingerprint` as SHA-256 over a canonical sequence containing HEAD, `git diff --binary --no-ext-diff`, and `git diff --cached --binary --no-ext-diff`, with NFC-normalized project-relative path records. Exclude untracked and ignored files from the drift fence to avoid editor/build-cache churn; still list capture-time untracked files in the packet with a warning that they are not launch-fenced.\n- Launch first validates CLI availability, target account/model/effort compatibility, quota state, project path, source revision, and target selection without mutating source or target. It then re-reads the durable sequence and workspace fingerprint. Any drift refuses with `handoff.source_changed` and requires a new capture/preview; it never silently auto-revises a packet the user already reviewed.\n- The target run and worker are created under the existing run/quota mutation controls. The rendered seed is persisted with `appendUserInputOnDelivery` in the target's unified worker stream before prompting the CLI.\n- `launch` is idempotent. Persist a server-generated launch claim token and expiry before target creation, and stamp the target `runs.originHandoffId` before worker creation. Repeating the operation returns the discovered existing `targetRunId`; a stale revision gets `409 handoff_revision_conflict`.\n- Every nonterminal handoff carries a lease expiry. `capturing`/`launching` use server heartbeats; the client renews a `ready` lease while the preview is open, capped at `HANDOFF_READY_MAX_LIFETIME_MS = 15 minutes`. A startup/heartbeat reconciler fails expired states, discovers targets by `originHandoffId`, adopts the one target where applicable, clears `runs.activeHandoffId`, releases the workspace fence, and emits the exact decision. Expired `ready` edits are not saved; the UI reports expiry and offers a fresh prepare.\n- Mark `completed` only after target creation, target seed persistence, and worker launch acceptance. Set the already-terminated source run to `cancelled`, mark carried queued messages `cancelled` with a `cross_cli_handoff` reason, and persist the source-to-target link in the completed handoff row.\n- A target launch failure never manufactures success and never deletes persisted rows. Mark any partially created target run `failed` and visible for diagnosis. Clear `runs.activeHandoffId`; if the source has a durable future quota wake, restore `quota_waiting` without clearing its quota incident/schedule so the same CLI can auto-resume at reset, otherwise set `needs_recovery` with recovery reason `handoff_post_stop_failure`. Release the workspace fence and emit the decision.\n- Cancellation applies to manual and quota-created nonlaunching handoffs. The dialog and `RunRecoveryNotice` both expose it. Cancellation/expiry clears `runs.activeHandoffId`, releases the lease, and restores `quota_waiting` when a durable future wake exists or `needs_recovery` otherwise. Recovery UI and reconcilers branch on active handoff ID/reason rather than treating all `needs_recovery` states alike.\n- Centralize that rule as `settleSourceAfterUnsuccessfulHandoff(sourceRecoverySnapshot, reason)` and call it for capture/termination refusal, cancel, expiry, drift abandonment, and post-stop launch failure. The snapshot preserves the original quota incident/wake. The helper always clears the active marker/lease, restores `quota_waiting` plus the durable future wake when one existed, and otherwise sets `needs_recovery` with the stage-specific reason; no caller chooses a status ad hoc.\n- Deleting the source removes its handoff metadata/artifact stream through existing run cleanup; the target remains independently understandable because its initial worker stream contains the rendered seed.\n- Deleting a target while its handoff is nonterminal first terminalizes the handoff and releases the source/workspace fence; `ON DELETE SET NULL` is not relied on as lifecycle logic.\n- Same-run recreation must reject a requested worker type different from an existing direct/commit run's CLI. Enforce this in a shared spawn assertion and a SQLite `BEFORE INSERT` safety trigger, not only at callers. Model, effort, or account changes within the same CLI remain allowed where currently supported. Supervisor implementation runs retain their intentional multi-worker behavior.\n- Automatic quota handoff walks handoff/parent lineage. Refuse after `MAX_AUTOMATIC_HANDOFF_DEPTH = 3`, exclude providers/accounts exhausted in the last two handoffs, enforce a cooldown, and verify the target account has no open quota incident before source termination.\n\n## File map\n\n### Create\n\n- `src/shared/handoff.ts` — packet, lifecycle, API DTO, edit-patch, and error-code contracts shared by server/client.\n- `src/server/handoff/candidates.ts` — bounded candidate reads from unified worker streams, messages, queued messages, events, and artifacts.\n- `src/server/handoff/workspace-state.ts` — read-only git baseline/current evidence and file ownership classification.\n- `src/server/handoff/redaction.ts` — path-safe text normalization, secret/tool-output filtering, and size limits.\n- `src/server/handoff/compiler.ts` — authoritative/advisory merge, priority budgeting, deterministic ordering, provenance, hash, and renderer input.\n- `src/server/handoff/store.ts` — SQLite metadata and append-only packet-version persistence.\n- `src/server/handoff/coordinator.ts` — capture/preview/edit/launch state machine, source fence, idempotency, and failure recovery.\n- `src/server/handoff/reconciler.ts` — startup/heartbeat recovery for expired capture/launch claims and orphan target adoption.\n- `src/server/runs/fork.ts` — extracted generic new-run fork creation used by legacy message forks and handoff launches.\n- `src/server/workers/direct-run-type-invariant.ts` — central direct/commit worker-type assertion used before worker insertion; emits typed refusal.\n- `src/server/events/handoff-events.ts` — focused named-event union for import into the existing event contract.\n- `src/runtime/http/routes/handoffs.ts` — create/list/get/patch/launch HTTP handlers and validation.\n- `src/interface/home/HandoffForkManager.ts` — single source of truth for dialog draft, server revision, request ownership, pending stages, and errors.\n- `src/interface/home/HandoffForkDialog.tsx` — target picker, packet preview/editor, warnings, and launch result UI.\n- `src/components/home/CliLaunchSelectionFields.tsx` — reusable CLI/account/model/effort controls for the handoff dialog without duplicating composer selection logic.\n- `tests/server/handoff/compiler.test.ts` — packet priority, freshness, deterministic hash, truncation, and rendering tests.\n- `tests/server/handoff/candidates.test.ts` — bounded stream/event/queued-message and message-boundary tests.\n- `tests/server/handoff/workspace-state.test.ts` — baseline/current classification and path-safety tests.\n- `tests/server/handoff/redaction.test.ts` — credentials, environment, hidden reasoning, malicious content, and byte-limit tests.\n- `tests/server/handoff/store.test.ts` — revisions, active-handoff uniqueness, idempotency, and cascade tests.\n- `tests/server/handoff/coordinator.test.ts` — state transitions, source fences, synthetic fallback, target failures, and launch idempotency.\n- `tests/server/handoff/reconciler.test.ts` — expired claim, orphan target adoption, target deletion, and fence-release tests.\n- `tests/server/workers/direct-run-type-invariant.test.ts` — application assertion and SQLite trigger safety-net tests.\n- `tests/api/handoffs-route.test.ts` — route validation/auth/contract/error responses.\n- `tests/app/handoff-fork-manager.test.ts` — stale-response ownership, retry, selection, and close/reopen behavior.\n- `tests/ui/handoff-fork-dialog.test.tsx` — translated copy, accessibility, advisory-only editing, and responsive states.\n- `tests/lifecycle/scenarios/cross-cli-handoff-fork.test.ts` — manual and quota cross-CLI lifecycle scenario over HTTP/SSE.\n- `tests/lifecycle/scenarios/cross-cli-handoff-restart.test.ts` — restart, replay, idempotent launch, and deletion scenario.\n\n### Modify\n\n- `src/server/db/schema.ts` — add `conversationHandoffs` metadata table and indexes.\n- `src/server/db/index.ts` — additive schema initialization/migration and database version bump.\n- `src/server/artifacts/stream-types.ts` — add the `handoff_packets` run-level stream kind.\n- `src/server/artifacts/append-only-store.ts` — map the new stream to `handoff-packets.jsonl`.\n- `src/server/handoff/request.ts` — make the outgoing summary request reason-neutral, structured, bounded, and optional.\n- `src/server/handoff/parser.ts` — parse advisory report fields into the versioned candidate contract without treating them as facts.\n- `src/server/handoff/render.ts` — render the versioned packet and remove quota-only wording.\n- `src/server/git/auto-commit.ts` — extract/reuse baseline parsing needed by read-only workspace evidence without synchronous shell work on the hot path.\n- `src/server/runs/recovery.ts` — delegate legacy retry/edit/fork run creation to focused services; do not grow this 1,300+ line module.\n- `src/server/supervisor/worker-failover.ts` — retain compatibility exports but route cross-CLI cases to the new-run handoff coordinator; do not spawn another CLI in the source run.\n- `src/server/supervisor/index.ts` and `src/server/supervisor/wake.ts` — consume target-run outcomes and preserve quota recovery semantics across restart.\n- `src/server/supervisor/observer.ts` — record pending cross-CLI handoff intent instead of only same-run failover intent.\n- `src/server/conversations/send-message.ts` — reject text/composer-driven cross-CLI changes inside an existing run and preserve same-CLI model/account recreation only.\n- `src/server/conversations/create.ts`, `src/server/supervisor/index.ts`, `src/server/planning/review.ts`, and `src/server/runs/recovery.ts` — call the central direct/commit worker-type assertion before worker insertion; supervisor implementation multi-worker behavior remains allowed.\n- `src/server/conversations/queued-messages.ts`, `src/server/conversations/queued-message-interrupt.ts`, `src/server/quota/worker-resume.ts`, and `src/server/runs/recovery-reconciler.ts` — enforce the persisted handoff fence before source mutation/recovery.\n- `src/server/prompts/supervisor.md` — describe cross-provider recovery as a new-session handoff, not an in-session worker swap.\n- `src/server/credits/index.ts` — make `cross_provider` return a target CLI/account candidate for the handoff coordinator rather than mutating the source worker account.\n- `src/server/events/named-events.ts` — import the focused handoff event union, add stable surfaced error codes, and avoid embedding packet bodies in SSE.\n- `src/runtime/http/routes/index.ts` — register handoff routes.\n- `src/runtime-api/types.ts` and `src/runtime-api/domains/index.ts` — add typed `handoffs` operations.\n- `src/interface/home/useHomeMutations.ts` — add query/mutations for preview, edit, launch, and active-draft lookup; switch selection only under matching request ownership.\n- `src/interface/home/useConversationActions.ts` — route session/message cross-CLI actions into `HandoffForkManager`; retain ordinary same-run message retry/edit behavior.\n- `src/interface/home/ExternalSessionsPicker.tsx` — separate external resume from the new current-conversation fork option.\n- `src/components/home/HomeHeader.tsx` — add the session-level entry point.\n- `src/components/home/ConversationMain.tsx` — add the per-message entry point through a small extracted action component or callback; do not grow this 1,600+ line file.\n- `src/components/home/RunRecoveryNotice.tsx` — add quota handoff status/action and target-run navigation.\n- `src/interface/home/HomeApp.tsx` — mount/wire the lazy dialog and manager only; move logic out of this 1,700+ line file.\n- `src/interface/home/EventStreamStateManager.ts` and `src/interface/home/utils.ts` — reconcile handoff lifecycle events and target selection without optimistic run fabrication.\n- `src/components/settings/ModelsSettingsPanel.tsx` — clarify that `cross_provider` opens a new handoff session while same-provider strategies stay in the current CLI.\n- `shared/locales/*.json` — add every new visible label, description, warning, status, aria label, and error fallback to all locales.\n- `tests/db/schema.test.ts`, `tests/supervisor/worker-failover.test.ts`, `tests/supervisor/worker-failover-handoff-fails.test.ts`, `tests/supervisor/worker-failover-spawn-retry.test.ts`, `tests/supervisor/worker-failover-no-replacement.test.ts`, `tests/api/conversation-messages-route.test.ts`, `tests/ui/conversation-actions.test.ts`, `tests/app/event-stream-state-manager.test.ts`, `tests/runtime/http-registry.test.ts`, `tests/runtime/http-routes.test.ts`, `tests/runtime/route-contract-fixture.test.ts`, and `tests/runtime/fixtures/routes.v1.json` — update existing expectations around the new-run invariant.\n- `docs/architecture/lifecycle-observability-and-testing.md` — document handoff decisions/events and the source/target recovery model before adding server state transitions.\n- `docs/architecture/worker-conversation-stream.md` — document that the target handoff seed is an ordinary first `user_input`, not a parallel transcript.\n- `.gitignore` — verify packet temp/debug output cannot be tracked; add only a narrowly scoped ignore if implementation introduces a local debug artifact.\n\n## API and persistence design\n\n### SQLite metadata\n\nAdd `conversation_handoffs` with:\n\n- `id` primary key.\n- `source_run_id` foreign key to `runs` with `ON DELETE CASCADE`.\n- `source_worker_id` nullable foreign key to `workers` with `ON DELETE SET NULL`.\n- `target_run_id` nullable foreign key to `runs` with `ON DELETE SET NULL`.\n- `forked_from_message_id`, `reason`, `status`, `revision`, `source_seq`, `normalized_project_path`, and `workspace_fingerprint`.\n- `target_worker_type`, `target_model`, `target_effort`, `target_account_id`, `target_selection_hash`.\n- `packet_version`, `artifact_seq`, `packet_hash`, `packet_preview`, `summary_source`.\n- `operation_id`, `launch_claim_token`, `claim_expires_at`, `retry_of_handoff_id`, `last_error`, `created_at`, `updated_at`, and `completed_at`.\n- Unique partial indexes for one `capturing|ready|launching` handoff per source run and normalized project path, plus indexes for target run, claim expiry, and status/update time.\n\nAdd nullable indexed `runs.origin_handoff_id` and `runs.active_handoff_id`. `origin_handoff_id` is written in the same transaction as target run creation, deliberately has no cascading foreign key, and lets restart recovery discover a target even if the process died before `conversation_handoffs.target_run_id` was updated. `active_handoff_id` distinguishes an intentionally prepared source from an ordinary `needs_recovery` run and is cleared on every terminal transition.\n\nKeep the full packet out of SQLite. Append every ready/revised packet as an `ArtifactRecordEnvelope<HybridHandoffPacketV1>` in the source run's `handoff_packets` stream and point metadata at the current sequence/hash. Store only a bounded, redacted preview for list/recovery UI.\n\n### HTTP contract\n\n- `POST /api/runs/:runId/handoffs` — create or return the active draft. Body: fork point, reason, and target selection. Returns `202 capturing` or `200 ready` with metadata/packet DTO.\n- `GET /api/runs/:runId/handoffs?active=1` — restore a durable draft after reload.\n- `GET /api/handoffs/:handoffId` — inspect the current packet/revision/result.\n- `PATCH /api/handoffs/:handoffId` — patch advisory fields with `expectedRevision`; return `409` on stale revision.\n- `POST /api/handoffs/:handoffId/launch` — idempotent launch with `expectedRevision`, `operationId`, and final target selection; return the target run/worker IDs.\n- `POST /api/handoffs/:handoffId/cancel` — release any nonlaunching manual or quota draft fence. A launching/completed handoff cannot be cancelled; the reconciler owns abandoned launch claims.\n\nEvery flat `/api/handoffs/:handoffId` handler must resolve the source run and apply the same project/run authorization check as run-scoped endpoints before reading or mutating anything. Include an IDOR test using an authenticated caller without access to the source project. Cancellation covers every nonlaunching manual or quota draft.\n\nThere are no persisted V0 packet artifacts to migrate: the existing parser/request/render path produces ephemeral reports only. Treat those reports as advisory candidates when creating V1. If a future/unknown artifact version is encountered, retain it on disk, refuse to render it, surface `handoff.packet_version_unsupported`, and require a fresh V1 capture.\n\nReturn typed stage-specific errors. HTTP conflicts include `handoff_in_progress`, `handoff_revision_conflict`, and `handoff_required`. User-relevant failures also emit `error.surfaced` with stable codes `handoff.capture_failed`, `handoff.revision_conflict`, `handoff.target_unavailable`, `handoff.source_changed`, `handoff.launch_failed`, `handoff.fork_required`, and `handoff.packet_version_unsupported`; register every code in the named-event typed union.\n\n### Named events\n\nEmit these via `emitNamedEvent` for every server decision:\n\n- `handoff.capture_started`\n- `handoff.packet_ready`\n- `handoff.packet_revised`\n- `handoff.launch_started`\n- `handoff.completed`\n- `handoff.cancelled`\n- `handoff.failed`\n- `handoff.refused`\n\nEvents carry IDs, revisions, stage, source/target IDs, target worker type, reason, and stable error code where relevant. They never carry the full packet. All event frames retain the existing SSE ID/replay/resync behavior.\n\n## Implementation tasks\n\n### Task 1: Document the invariant and preserve a green baseline\n\n**Files:**\n- Modify: `docs/architecture/lifecycle-observability-and-testing.md`\n- Modify: `docs/architecture/worker-conversation-stream.md`\n\n- [ ] Add architecture text stating that a CLI/provider change creates a new run, the target seed lives in its unified worker stream, and source/target ownership is never shared.\n- [ ] Record the three-phase ordering: validate target; terminate/confirm source and capture final state; create/prompt target. Document `cancelled` success and the single unsuccessful-settlement helper that restores a durable `quota_waiting` wake or uses stage-specific `needs_recovery`.\n- [ ] Record workspace lease, drift refusal, packet redaction/untrusted-boundary, restart claim, and named-event requirements before implementing state transitions.\n- [ ] Run the existing baseline without changing its expectations: `pnpm vitest run tests/api/conversation-messages-route.test.ts tests/supervisor/worker-failover.test.ts tests/supervisor/worker-failover-handoff-fails.test.ts tests/supervisor/worker-failover-spawn-retry.test.ts tests/supervisor/worker-failover-no-replacement.test.ts`.\n\n### Task 2: Define the packet and lifecycle contracts\n\n**Files:**\n- Create: `src/shared/handoff.ts`\n- Create: `tests/server/handoff/compiler.test.ts`\n- Create: `tests/server/handoff/redaction.test.ts`\n\n- [ ] Define V1 packet, provenance, lifecycle metadata, editable advisory patch, API request/response, and error-code types.\n- [ ] Make authoritative versus advisory fields explicit in the types so PATCH cannot alter source/workspace/verification provenance.\n- [ ] Add constants for total and per-field budgets, item counts, recent-tail bounds, and supported interruption reasons.\n- [ ] Write failing tests for stable ordering, NFC/fixed-key canonicalization, a content hash that excludes only `generatedAt`, priority truncation, exact omission metadata, and rejection of unknown packet versions.\n- [ ] Write failing redaction/render-boundary tests for common API keys/tokens, authorization headers, environment dumps, hidden-reasoning entries, absolute paths outside the project, control characters, nonce/delimiter injection, and content imitating system/tool-result framing.\n- [ ] Run `pnpm vitest run tests/server/handoff/compiler.test.ts tests/server/handoff/redaction.test.ts` and confirm failures are contractual rather than fixture errors.\n\n### Task 3: Add durable metadata and packet artifact storage\n\n**Files:**\n- Modify: `src/server/db/schema.ts`\n- Modify: `src/server/db/index.ts`\n- Modify: `src/server/artifacts/stream-types.ts`\n- Modify: `src/server/artifacts/append-only-store.ts`\n- Create: `src/server/handoff/store.ts`\n- Create: `tests/server/handoff/store.test.ts`\n- Modify: `tests/db/schema.test.ts`\n\n- [ ] Add the `conversation_handoffs` table, `runs.originHandoffId`, `runs.activeHandoffId`, foreign keys, normalized workspace key, timestamps, revision, operation/claim/expiry fields, bounded preview, and exact partial indexes described above using the repository's additive schema pattern.\n- [ ] Increment `DB_SCHEMA_VERSION` and test initialization of old and fresh databases.\n- [ ] Add the run-level `handoff_packets` stream and map it to `app-data/run-data/<runId>/handoff-packets.jsonl` through the artifact store.\n- [ ] Implement transactional metadata transitions plus append/read of packet versions; never expose a metadata revision whose artifact append failed.\n- [ ] Enforce one active handoff per source run and normalized project path, idempotent operation IDs, and target discovery by `originHandoffId`.\n- [ ] Test packet revision lookup, stale revision refusal, source deletion cascade, target deletion terminalization/fence release, expired claim lookup, and no orphaned artifact metadata.\n- [ ] Run `pnpm vitest run tests/server/handoff/store.test.ts tests/db/schema.test.ts`.\n\n### Task 4: Gather bounded deterministic evidence\n\n**Files:**\n- Create: `src/server/handoff/candidates.ts`\n- Create: `src/server/handoff/workspace-state.ts`\n- Create: `src/server/handoff/redaction.ts`\n- Modify: `src/server/git/auto-commit.ts`\n- Create: `tests/server/handoff/candidates.test.ts`\n- Create: `tests/server/handoff/workspace-state.test.ts`\n- Modify: `tests/server/handoff/redaction.test.ts`\n\n- [ ] Read worker content only through bounded `readWorkerEntriesTail`/`Since`/`Before` APIs and respect superseded sequence ranges.\n- [ ] Gather original/current user requests, a small exact recent tail, latest assistant recap, queued messages, unresolved execution errors, verification commands/results, plan/spec/generated artifact paths, and the source sequence.\n- [ ] For message forks, constrain conversational evidence to the selected message boundary.\n- [ ] Parse `runs.gitBaselineJson`, current HEAD/status, diff stats, commit range, tool edit events, and relevant agent summaries into file ownership evidence.\n- [ ] Classify file ownership conservatively; never claim session ownership from current git status alone. Preserve `unknown` and warnings.\n- [ ] Normalize project-relative paths, keep raw absolute project paths server-only, omit file contents and raw diff hunks by default, and include only narrowly bounded hunks for unresolved conflicts/subtle incomplete edits.\n- [ ] Redact every candidate before budgeting, hashing, previewing, rendering, logging, or event emission; perform a final redaction pass over the rendered seed.\n- [ ] Test large streams, already-compacted history, deleted/renamed/untracked files, a dirty pre-session baseline, external concurrent edits, post-message workspace drift, malformed baselines, and non-git projects.\n- [ ] Run `pnpm vitest run tests/server/handoff/candidates.test.ts tests/server/handoff/workspace-state.test.ts tests/server/handoff/redaction.test.ts`.\n\n### Task 5: Compile and render the hybrid packet\n\n**Files:**\n- Create: `src/server/handoff/compiler.ts`\n- Modify: `src/server/handoff/request.ts`\n- Modify: `src/server/handoff/parser.ts`\n- Modify: `src/server/handoff/render.ts`\n- Modify: `tests/server/handoff/compiler.test.ts`\n- Modify: `tests/server/handoff/parser.test.ts`\n\n- [ ] Implement deterministic merging where collected facts override advisory summaries and every conflict becomes a confidence warning.\n- [ ] Detect fresh recent assistant recaps using worker/event sequence evidence.\n- [ ] Update the outgoing request to return only structured task/state/decision/file explanations; use a short timeout and skip it for quota-blocked or busy workers.\n- [ ] Preserve the existing synthetic fallback, but feed it through the same candidates/compiler/redaction pipeline.\n- [ ] Enforce the packet budget by priority, populate `omittedSections`/`truncatedFields`, and hash the redacted canonical representation excluding only `generatedAt`.\n- [ ] Render a concise target prompt with objective, state, decisions, workspace, verification, pending input, uncertainty, and an explicit instruction to inspect current files before acting. Place canonical JSON inside a post-sanitization random nonce fence and ensure embedded text cannot close or imitate the boundary.\n- [ ] Ensure quota wording is a reason field, not hard-coded into all handoffs.\n- [ ] Test clean completed turns, mid-turn interruption, hard quota interruption, already-compacted history, short sessions, stale summaries, malicious advisory content, and overflow.\n- [ ] Run `pnpm vitest run tests/server/handoff/compiler.test.ts tests/server/handoff/redaction.test.ts tests/server/handoff/parser.test.ts`.\n\n### Task 6: Extract safe new-run fork creation\n\n**Files:**\n- Create: `src/server/runs/fork.ts`\n- Modify: `src/server/runs/recovery.ts`\n- Modify: `tests/api/run-route.test.ts`\n- Modify: `tests/ui/conversation-actions.test.ts`\n\n- [ ] Extract plan/run/message-copy creation from the existing `recoverRun(... action: \"fork\")` branch without changing retry/edit semantics.\n- [ ] Accept an explicit target worker type/model/effort/account/allowed-types selection and copy `preferredWorkerAccountId`, which the current fork path can omit.\n- [ ] Preserve `parentRunId`, `forkedFromMessageId`, project path, and auto-commit preferences. Add `copyMessagePrefix: boolean`: legacy same-CLI forks use `true`; cross-CLI handoffs use `false` so the rendered packet is the target's only initial conversation entry.\n- [ ] For a cross-CLI target, capture a fresh git baseline after source termination and in-flight auto-commit settlement, and store it as the target `gitBaselineJson`/workspace metadata. The packet separately reports source-session changes relative to the source's original baseline, so target ownership begins at handoff.\n- [ ] Keep target preflight validation separate from target creation. The coordinator performs source termination and post-stop capture between preflight and target creation.\n- [ ] Keep existing ordinary and worktree fork behavior passing; do not create a worktree for cross-CLI handoff.\n- [ ] On worker launch failure, retain the partially created plan/run as a visible `failed` diagnostic record stamped with `originHandoffId`; do not delete it or claim launch succeeded.\n- [ ] Run `pnpm vitest run tests/api/run-route.test.ts tests/ui/conversation-actions.test.ts`.\n\n### Task 7: Build the server coordinator and source fence\n\n**Files:**\n- Create: `src/server/handoff/coordinator.ts`\n- Create: `src/server/handoff/reconciler.ts`\n- Create: `tests/server/handoff/coordinator.test.ts`\n- Create: `tests/server/handoff/reconciler.test.ts`\n- Modify: `src/server/conversations/queued-messages.ts`\n- Modify: `src/server/conversations/queued-message-interrupt.ts`\n- Modify: `src/server/quota/worker-resume.ts`\n- Modify: `src/server/runs/recovery-reconciler.ts`\n\n- [ ] Implement capture, revise, launch, cancel, retry, and restore transitions over the persisted metadata/store.\n- [ ] Acquire the persisted normalized-workspace lease plus in-process workspace mutex; reject another active handoff or any other live worker already using that checkout.\n- [ ] On explicit prepare/capture, branch on runtime ownership: for a live source, advance turn generation, request graceful interruption, wait up to `HANDOFF_STREAM_SETTLE_TIMEOUT_MS`, terminate the CLI process, and confirm exit; for idle/quota/stopped sources, verify no PID/live runtime and proceed. Refuse before target creation if absence/exit cannot be confirmed.\n- [ ] Disable source auto-commit scheduling, await any in-flight commit, deliberately skip a new final auto-commit, and warn when interruption occurred without a clean tool/turn boundary because files may be partially written.\n- [ ] After process absence/exit, recapture the final durable sequence, HEAD, canonical tracked-diff workspace fingerprint, fresh target git baseline, and packet. On launch, re-read them and refuse drift with `handoff.source_changed` plus a visible recapture action.\n- [ ] Stop queued delivery, preserve undelivered messages in continuity, and atomically mark their source rows `cancelled` with `cross_cli_handoff` after successful launch so they cannot execute twice.\n- [ ] Validate target CLI/account/model/effort/quota state and automatic handoff chain/cooldown limits before source termination.\n- [ ] Persist a server claim token/expiry, create the stamped target run, persist rendered seed with `appendUserInputOnDelivery`, and start the target only after source process exit was confirmed.\n- [ ] On success clear `activeHandoffId` and set source run `cancelled`. On every unsuccessful terminal path call `settleSourceAfterUnsuccessfulHandoff`; for post-stop target failure also leave any partial target visible as `failed`.\n- [ ] Implement launch idempotency, stale source-sequence/revision/workspace refusal, and a startup/heartbeat reconciler that adopts targets by `originHandoffId` or fails expired `capturing`, `ready`, and `launching` leases. A client heartbeat may extend `ready` only up to the 15-minute maximum.\n- [ ] Gate send, queue, retry/edit, resume, wake, auto-commit, and reconciler mutations for every run sharing a leased workspace.\n- [ ] Handle target deletion by terminalizing a nonterminal handoff and releasing its fence before `ON DELETE SET NULL` runs.\n- [ ] Test races: another live run in the checkout, send versus capture, capture versus quota wake, live versus already-dead/quota sources, double launch, cancel versus launch, process refusing to exit, late output, tracked workspace/HEAD drift, untracked churn exclusion, ready expiry with unsaved client edits, target spawn failure, claim expiry, orphan adoption, restart at every status, queued-message cancellation, and source/target deletion.\n- [ ] Run `pnpm vitest run tests/server/handoff/coordinator.test.ts tests/server/handoff/reconciler.test.ts tests/server/quota/worker-resume.test.ts tests/server/runs/recovery-reconciler.test.ts`.\n\n### Task 8: Expose typed HTTP/runtime APIs and observability\n\n**Files:**\n- Create: `src/server/events/handoff-events.ts`\n- Modify: `src/server/events/named-events.ts`\n- Create: `src/runtime/http/routes/handoffs.ts`\n- Modify: `src/runtime/http/routes/index.ts`\n- Modify: `src/runtime-api/types.ts`\n- Modify: `src/runtime-api/domains/index.ts`\n- Create: `tests/api/handoffs-route.test.ts`\n- Modify: `tests/runtime/http-registry.test.ts`\n- Modify: `tests/runtime/http-routes.test.ts`\n- Modify: `tests/runtime/route-contract-fixture.test.ts`\n- Modify: `tests/runtime/fixtures/routes.v1.json`\n\n- [ ] Add the named handoff events and every stable `error.surfaced` code, including `handoff.fork_required` and `handoff.packet_version_unsupported`, without growing `named-events.ts` with full implementation logic.\n- [ ] Register create/list/get/patch/launch/cancel routes; resolve flat handoff IDs through the source run's authorization scope before returning data, and validate all IDs, enums, revisions, and selection fields.\n- [ ] Return `202` for in-progress capture, `409` for ownership/revision conflicts, `422` for incompatible target selection, and stage-specific `5xx` errors only for actual server failures.\n- [ ] Add typed runtime APIs; do not route handoffs through `runs.act` with `unknown` bodies.\n- [ ] Ensure no HTTP or SSE response includes secrets, raw packet artifacts when only metadata is needed, or untranslated visible server prose at the UI boundary.\n- [ ] Test auth/IDOR, malformed input, unsupported source mode, same-CLI target refusal, stale revision, replayed operation ID, packet retrieval, and surfaced error event payloads.\n- [ ] Run `pnpm vitest run tests/api/handoffs-route.test.ts tests/runtime/http-registry.test.ts tests/runtime/http-routes.test.ts tests/runtime/route-contract-fixture.test.ts`.\n\n### Task 9: Replace every same-run cross-CLI path\n\n**Files:**\n- Create: `src/server/workers/direct-run-type-invariant.ts`\n- Create: `tests/server/workers/direct-run-type-invariant.test.ts`\n- Modify: `src/server/conversations/send-message.ts`\n- Modify: `src/server/conversations/create.ts`\n- Modify: `src/server/supervisor/worker-failover.ts`\n- Modify: `src/server/supervisor/index.ts`\n- Modify: `src/server/supervisor/wake.ts`\n- Modify: `src/server/supervisor/observer.ts`\n- Modify: `src/server/prompts/supervisor.md`\n- Modify: `src/server/credits/index.ts`\n- Modify: `src/server/planning/review.ts`\n- Modify: `src/server/runs/recovery.ts`\n- Modify: `src/server/db/index.ts`\n- Modify: `src/components/settings/ModelsSettingsPanel.tsx`\n- Modify: `tests/api/conversation-messages-route.test.ts`\n- Modify: `tests/supervisor/worker-failover.test.ts`\n- Modify: `tests/supervisor/worker-failover-handoff-fails.test.ts`\n- Modify: `tests/supervisor/worker-failover-spawn-retry.test.ts`\n- Modify: `tests/supervisor/worker-failover-no-replacement.test.ts`\n\n- [ ] First write failing tests proving: follow-up text/API cannot change a direct run's CLI; cross-provider failover returns a distinct target run; target unavailable preserves quota recovery; and direct/commit worker insertion of another type is rejected at the central assertion and SQLite trigger.\n- [ ] Add `assertDirectRunWorkerTypeInvariant` before all direct/commit worker insertions and an additive SQLite `BEFORE INSERT ON workers` trigger as the final safety net. The trigger applies only when the referenced run has `session_type = 'omni'` and `mode IN ('direct', 'commit')`, and only rejects a *new* row whose normalized type differs from an existing worker; creating it on a legacy database never scans/rejects pre-existing mixed rows. Do not restrict intentional multi-type supervisor implementation runs.\n- [ ] Catch the trigger's stable constraint marker at the shared worker-insert boundary, map it to typed HTTP `409 handoff_required` plus surfaced code `handoff.fork_required`, emit `handoff.refused`, and translate visible guidance at the UI boundary; never leak a raw SQLite 500.\n- [ ] In `applyWorkerPreferenceForMessage`/`reconcileDirectWorkerSelection`, reject a type change for an existing run with a typed “fork required” result; do not persist the new preferred type and do not defer it for later recreation.\n- [ ] Keep same-CLI model, effort, and account recreation behavior and its current ownership fencing.\n- [ ] Change `src/server/credits/index.ts` so `cross_provider` selects and returns a candidate target CLI/account without mutating source credentials; validate it is not quota-blocked or in the recent exhaustion cooldown.\n- [ ] Route cross-provider quota strategy/allowed-worker selection to `coordinator.captureAndLaunch` and return `targetRunId` rather than a replacement worker ID. Enforce automatic chain depth three and recent-provider/account exclusions.\n- [ ] Keep the existing `worker-failover.ts` exports as compatibility wrappers while callers/tests migrate; do not delete the file.\n- [ ] Update wake/restart recovery to continue a persisted handoff rather than retrying a same-run provider spawn.\n- [ ] Update supervisor prompt and settings explanation to say cross-provider recovery creates a new session.\n- [ ] Rename user-visible lifecycle copy from “switching workers” to handoff/fork language while retaining legacy event parsing only where backward compatibility needs it.\n- [ ] Run `pnpm vitest run tests/server/workers/direct-run-type-invariant.test.ts tests/api/conversation-messages-route.test.ts tests/supervisor/worker-failover.test.ts tests/supervisor/worker-failover-handoff-fails.test.ts tests/supervisor/worker-failover-spawn-retry.test.ts tests/supervisor/worker-failover-no-replacement.test.ts` and assert no direct/commit source run contains workers of two CLI types.\n\n### Task 10: Build the client Manager and dialog\n\n**Files:**\n- Create: `src/interface/home/HandoffForkManager.ts`\n- Create: `src/interface/home/HandoffForkDialog.tsx`\n- Create: `src/components/home/CliLaunchSelectionFields.tsx`\n- Modify: `src/interface/home/useHomeMutations.ts`\n- Create: `tests/app/handoff-fork-manager.test.ts`\n- Create: `tests/ui/handoff-fork-dialog.test.tsx`\n- Modify: `shared/locales/*.json`\n\n- [ ] Implement a Manager-owned state machine for closed/selecting/capturing/ready/editing/launching/completed/error, including source run/message IDs, revision, target selection, packet, warnings, and request token.\n- [ ] Use TanStack Query only for transport/cache; the Manager is the single UI source of truth and ignores responses whose ownership token no longer matches.\n- [ ] Build an accessible, responsive dialog using existing Dialog/Select/Textarea/Button/ScrollArea/Alert/Badge primitives.\n- [ ] Keep dialog open/target selection read-only. Label **Prepare handoff** as the point that stops the source CLI; after preparation, cancel invokes the server's single unsuccessful-settlement helper, preserving a durable quota wake or exposing stage-specific recovery.\n- [ ] Default to the last compatible *different* CLI, exclude the source CLI, and validate account/model/effort combinations before capture/launch.\n- [ ] Show authoritative sections read-only, advisory fields editable, source/provenance/warnings visible, and an explicit “current files win” note.\n- [ ] Debounce or explicitly save advisory edits with `expectedRevision`; disable launch until the current edit revision is acknowledged.\n- [ ] Renew the ready lease while the preview is open without exceeding 15 minutes. On expiry, discard only unsaved local edits, show that the source remains recoverable, and offer **Prepare fresh handoff**; on tracked drift, offer the same recapture action rather than looping launch retries.\n- [ ] Allow recovery of the active durable draft after reload and a clear cancel action before launch for both manual and quota drafts.\n- [ ] Add all visible/aria/error strings to every `shared/locales/*.json` file and subscribe with `useI18nSnapshot()`.\n- [ ] Test keyboard focus, escape/cancel, mobile sizing, loading/error/retry states, stale edit conflicts, CLI exclusion, and no hard-coded user-facing JSX.\n- [ ] Run `pnpm vitest run tests/app/handoff-fork-manager.test.ts tests/ui/handoff-fork-dialog.test.tsx`.\n\n### Task 11: Wire every product entry point\n\n**Files:**\n- Modify: `src/interface/home/useConversationActions.ts`\n- Modify: `src/interface/home/ExternalSessionsPicker.tsx`\n- Modify: `src/components/home/HomeHeader.tsx`\n- Modify: `src/components/home/ConversationMain.tsx`\n- Modify: `src/components/home/RunRecoveryNotice.tsx`\n- Modify: `src/interface/home/HomeApp.tsx`\n- Modify: `tests/ui/conversation-actions.test.ts`\n- Modify: `tests/server/external-sessions/discovery.test.ts`\n- Modify: `shared/locales/*.json`\n\n- [ ] Add **Fork to another CLI** to the session menu for eligible direct/commit runs.\n- [ ] Add **Fork to another CLI from here** to user-message actions and pass the exact message ID.\n- [ ] Add a distinct current-conversation fork choice to Resume CLI Session without changing external Claude/Gemini resume behavior.\n- [ ] Add a quota notice action/status that opens or navigates to the automatic handoff and target run.\n- [ ] Add a quota/recovery notice action that cancels an abandoned ready/capturing handoff or retries a `needs_recovery` source; do not require the lost dialog state to release a fence.\n- [ ] Keep `HomeApp.tsx` as wiring only and extract any message-action UI needed to avoid growing oversized components.\n- [ ] On success, select the target only if the user is still viewing the source associated with the completed request; otherwise show a non-destructive notification/link.\n- [ ] Preserve ordinary “Fork session” semantics if it remains same-CLI, and make the cross-CLI wording unambiguous.\n- [ ] Test eligibility, source/message payloads, no selected run, unsupported modes, selection races, external resume regression, and quota CTA behavior.\n- [ ] Run `pnpm vitest run tests/ui/conversation-actions.test.ts tests/server/external-sessions/discovery.test.ts`.\n\n### Task 12: Reconcile SSE, restart, and lifecycle recovery\n\n**Files:**\n- Modify: `src/interface/home/EventStreamStateManager.ts`\n- Modify: `src/interface/home/utils.ts`\n- Modify: `tests/app/event-stream-state-manager.test.ts`\n- Create: `tests/lifecycle/scenarios/cross-cli-handoff-fork.test.ts`\n- Create: `tests/lifecycle/scenarios/cross-cli-handoff-restart.test.ts`\n\n- [ ] Reconcile capture/revision/launch/completion/failure events into existing run snapshots without creating optimistic fake runs.\n- [ ] Fetch snapshot/active handoff after `stream.resync_required`; treat SSE as an invalidation signal and HTTP/SQLite as authority.\n- [ ] Add a manual lifecycle scenario covering source activity, stable capture, packet artifact, target run/worker/seed, source stop, and no mixed CLI types.\n- [ ] Add a quota scenario where the outgoing worker cannot answer, synthetic capture succeeds, and the target new run continues.\n- [ ] Add restart checkpoints after `capturing`, `ready`, and `launching`; prove recovery either finishes once or surfaces a retryable failure without duplicate targets.\n- [ ] Add FK/delete coverage: deleting the source removes its packet metadata/artifact while the target's seed remains readable.\n- [ ] Validate every decision through `/api/events/log?since=<id>&runId=<id>` and assert named refusal/failure events exist.\n- [ ] Run the focused state-manager test, then `pnpm test:lifecycle`.\n\n### Task 13: Full verification and handoff documentation\n\n**Files:**\n- Modify only as failures require within the files already listed.\n- Verify: `.gitignore`\n\n- [ ] Re-read both architecture docs and confirm every new server decision emits a named event and every user-relevant failure emits a stable `error.surfaced` code.\n- [ ] Verify every target seed was persisted through `appendUserInputOnDelivery` and no parallel conversation storage was introduced.\n- [ ] Verify cross-CLI targets copy no source message rows/worker entries: only parent/message metadata plus the rendered first `user_input` packet crosses the boundary.\n- [ ] Verify logs/events demonstrate confirmed source process exit before target run creation and that the direct/commit SQLite trigger rejects mixed worker types.\n- [ ] Verify all visible strings use `t()` and all locale files contain the same new keys.\n- [ ] Verify packet storage, test databases, generated debug packets, CLI transcripts, credentials, and temporary review output are not accidentally tracked; make only a narrow `.gitignore` addition if needed.\n- [ ] Run `pnpm typecheck`.\n- [ ] Run `pnpm lint`.\n- [ ] Run `pnpm vitest run`.\n- [ ] Run `pnpm test:lifecycle`.\n- [ ] Run the mandatory frontend build: `pnpm build:interface:web`.\n- [ ] Inspect `git diff --check` and `git status --short`; preserve unrelated user changes and confirm the implementation did not create a branch, worktree, or delete files.\n\n## Verification matrix\n\n| Case | Expected result |\n|---|---|\n| Header fork, idle source | Prepare verifies no live runtime, captures final state, and only then allows creation of a distinct target run. |\n| Header fork, active turn | Prepare generation-fences, settles, terminates, and confirms source process exit before capture; target creation cannot overlap. |\n| Source CLI refuses to exit | Launch is refused before target creation; the unsuccessful-settlement helper restores a durable quota wake or uses `needs_recovery`; named failure identifies termination. |\n| Another live run uses checkout | Workspace lease/preflight refuses handoff; neither source nor other run is mutated. |\n| Message fork | Conversation is bounded at the message; current workspace drift is explicit; `forkedFromMessageId` is preserved. |\n| Manual preview becomes stale | Sequence/HEAD/workspace fingerprint drift returns `handoff.source_changed`; user must prepare a fresh packet. |\n| Ready preview abandoned | Lease expires by 15 minutes, source marker/fence clears, quota wake or recovery state is restored, and reopening offers a fresh prepare. |\n| Resume CLI Session dialog | External resume still resumes an external provider session; current-conversation fork opens handoff flow. |\n| Quota, outgoing CLI dead | No outgoing request; synthetic packet launches a distinct target run. |\n| Quota, target unavailable | Preflight failure leaves `quota_waiting` untouched; post-stop failure restores its durable future wake or uses `needs_recovery`; no success is reported. |\n| Quota handoff loop | Recent exhausted providers/accounts are excluded; depth four is refused with a visible wait/manual-recovery state. |\n| Same-run text asks to switch CLI | Request is refused with fork guidance; source preferences/worker type do not change. |\n| Same-CLI model/account change | Existing supported recreation path still works inside the run. |\n| Already compacted source | Provider recap is advisory; post-compaction evidence and exact recent tail are included. |\n| Dirty workspace before session | Pre-existing files are not claimed as session-owned; uncertainty is preserved. |\n| Concurrent/external file change | Ownership becomes external/unknown; packet does not overwrite or silently attribute it. |\n| Packet overflow | Highest-priority facts remain; dropped fields are named; hash is deterministic. |\n| Reload while preview is ready | Active draft and revision restore from server; edits do not regress. |\n| Disconnect during launch | SSE replay/snapshot returns one target; repeated operation ID is idempotent. |\n| Crash after target row creation | Reconciler discovers exactly one target by `originHandoffId`, adopts or fails it, and releases the claim/lease. |\n| Target deleted during launch | Handoff terminalizes and source/workspace fence releases before the target link is nulled. |\n| Delete source after completion | Source metadata/artifact is cleaned; target initial seed remains self-contained. |\n\n## Agentic user-journey candidates (approval required before running)\n\nThese browser journeys are valuable after automated tests/build pass, but they must not be run without explicit user approval because they create real local conversations and CLI activity:\n\n1. Start a Codex direct session, make a small edit, open the header handoff dialog, inspect/edit the packet, fork to Claude, verify the new sidebar session and source preservation, then clean up the test conversations/artifacts.\n2. Fork from an earlier user message and confirm the preview distinguishes historical conversation state from the current checkout.\n3. Simulate/induce a quota-waiting source through supported test controls, select cross-provider recovery, verify the synthetic packet and target navigation, then clean up.\n4. Reload the browser while a handoff preview is open and while launch is completing; verify restoration, SSE replay, and no duplicate target.\n\n## Implementation guardrails\n\n- Begin implementation by rechecking `git status --short`; the current worktree already contains user changes. Never overwrite, revert, or reformat unrelated edits.\n- Do not create a branch or worktree and do not delete any file.\n- Keep new logic out of `HomeApp.tsx`, `ConversationMain.tsx`, `runs/recovery.ts`, and `worker-failover.ts` except thin integration/delegation because all are already oversized.\n- Use `src/server/git/command.ts` or existing async helpers for git evidence; avoid synchronous shell calls in request paths.\n- Never log or emit the full packet in named events, errors, or ordinary server logs.\n- Never pass translated strings through transactions or persist translated UI copy.\n- Never treat an LLM-generated summary as proof that a file changed, a test passed, or a command ran.\n- Do not add configurable frontend strings/settings through `.env`; packet limits are code constants.\n- Clean up test conversations and persisted artifacts after any approved live/agentic validation.\n--- PLAN END ---"
}
````

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-08-20T18:18:22.967Z","phase":null} -->
## Claude state: queue-operation · 2026-08-20T18:18:22.967Z

```text
{
  "type": "queue-operation",
  "operation": "dequeue",
  "timestamp": "2026-08-20T18:18:22.967Z",
  "sessionId": "23684cf2-66e9-47ff-ada1-76c62f4558a0"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"user","timestamp":"2026-08-20T18:18:23.004Z","phase":null} -->
## User · 2026-08-20T18:18:23.004Z

I resolved the final two blockers by defining one settleSourceAfterUnsuccessfulHandoff helper used by every unsuccessful release (durable quota wake restored, otherwise stage-specific needs_recovery) and referencing it consistently in tasks/UI/matrix; and by registering HTTP handoff_required plus surfaced handoff.fork_required throughout contracts, events, trigger mapping, and Task 8.

Review the complete artifact once more. Return exactly READY if no implementation blocker remains, otherwise HARDEN followed only by concrete blockers. Do not write files or use tools.

--- PLAN START ---

# Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax.

**Feature:** Cross-CLI Hybrid Handoff Fork

**Goal:** Let a user fork any direct-control conversation into a new session running on a different CLI, carrying a compact, inspectable hybrid handoff packet; use the same new-run mechanism when cross-provider quota recovery is selected, and make same-run cross-CLI switching impossible.

**Architecture:** A server-owned handoff coordinator freezes the source at a durable worker-stream sequence, gathers bounded deterministic evidence, optionally adds a semantic summary, compiles and persists a versioned packet, and launches a completely separate target run. SQLite stores lifecycle metadata; the append-only artifact store holds packet versions; the target worker stream receives the rendered packet as its first `user_input`. The source run is preserved as stopped history. Same-CLI model/account recovery may continue inside a run, but changing the CLI/provider always crosses a run boundary.

**Tech Stack:** TypeScript, React, TanStack Query, global Manager classes, Drizzle + SQLite, append-only JSONL artifacts, existing runtime HTTP registry/API adapters, named SSE events, Vitest, lifecycle HTTP/SSE scenarios, existing shadcn/ui primitives, and locale JSON files.

**North Star Product:** A user can move work between CLI ecosystems without pretending their provider sessions, recovery semantics, or transcripts are interchangeable. The new agent starts with the smallest trustworthy continuation context, the source remains auditable, and failures never strand or silently mutate either conversation.

**Current Milestone:** Ship cross-CLI handoff forks for direct/commit conversations from the session menu, an individual message, the existing Resume CLI Session dialog, and quota recovery. The packet is editable where it is advisory, inspectable after launch, bounded, redacted, restart-safe, and synthesized without contacting an exhausted provider when necessary.

**Future Product Direction:** Reuse the packet format for export/import and cross-device handoff only after this milestone proves the provenance, recovery, and deletion model. Do not add same-run CLI switching, background multi-agent continuation, or automatic worktree creation in this milestone.

**Final Functionality Standard:** Every cross-CLI transition creates a new run and target worker stream; no server path can recreate a worker under another CLI in the source run. The packet accurately identifies uncertainty and pre-existing workspace changes, survives a process restart, excludes secrets and hidden reasoning, and produces enough observability to explain every capture, launch, refusal, and failure.

---

## Product decisions and non-goals

1. **A CLI handoff is a fork, never a resume.** “Resume external session” keeps its existing meaning. “Fork current conversation to another CLI” creates a new OmniHarness run with `parentRunId` and an optional `forkedFromMessageId`.
2. **The source is historical after a successful launch.** Before target creation, terminate any live source CLI process and confirm it exited; if no live runtime owns the source, verify that fact and skip interruption/termination. On success set the source run to `cancelled`, retain its transcript and artifacts, and select the target run in the UI. If target launch fails after source termination, restore `quota_waiting` when a durable future quota wake exists; otherwise set `needs_recovery`. Never keep two CLIs editing the same checkout concurrently.
3. **The packet is hybrid.** Deterministic state is authoritative; generated summaries and outgoing-agent reports are advisory. Current disk state wins over prose.
4. **Manual and quota paths share one coordinator.** Manual entry points offer a preview. A quota-triggered cross-provider handoff may launch without waiting for an exhausted CLI, then exposes the persisted packet for inspection.
5. **Only advisory content is user-editable.** The user may amend objective, status, next steps, blockers, notes, and relevant-file explanations. Source IDs, stream sequence, git evidence, verification records, target selection, provenance, and hash are server-owned.
6. **No full transcript or full diff by default.** The packet contains a short exact tail plus summaries, file-level evidence, and compact error/test output. The source run remains the place to inspect full history.
7. **No hidden reasoning.** Never copy `thought`, chain-of-thought, raw environment, credentials, authorization headers, binary attachments, or unrestricted tool output into a packet.
8. **No automatic worktree.** This feature uses the current checkout and avoids concurrency by stopping the source. Existing explicit worktree fork actions remain separate.
9. **No file deletion is part of this plan.** Refactor existing modules in place or add focused modules; preserve project history and user changes.

## User journeys

### Manual fork from the session

1. The user opens the session menu and selects **Fork to another CLI**.
2. The dialog defaults to a different available CLI and offers compatible account, model, and effort choices.
3. The user explicitly chooses **Prepare handoff**, acknowledging that any live source CLI will stop. The server gracefully interrupts then terminates it (or verifies no live runtime exists), confirms exit, captures the final stable boundary, and returns a compact preview with provenance and warnings.
4. The user may edit advisory notes, then launches.
5. At launch OmniHarness revalidates target and source/workspace fingerprints. Because source exit was already confirmed, it creates the new run, persists the packet as the target's initial user input, starts the selected CLI, marks the source `cancelled`, and selects the target in the sidebar.

### Fork from a message

1. The user chooses **Fork to another CLI from here** on a user message and receives the same explicit **Prepare handoff** confirmation that names the source stop; selecting an old message never bypasses termination.
2. Candidate collection ignores superseded/later conversation entries but compares against the current workspace, explicitly warning when files contain changes made after the selected message.
3. The rest of the flow is the same as the manual session fork.

### Fork from Resume CLI Session

1. The existing dialog clearly separates **Resume external session** from **Fork current conversation**.
2. The fork option appears only with an eligible selected OmniHarness direct/commit run.
3. Choosing it opens the same handoff dialog, not a provider-session resume flow.

### Cross-provider quota recovery

1. A CLI reaches a durable quota-waiting state.
2. Same-provider account/model recovery may use existing same-CLI recovery.
3. If the selected strategy requires another CLI/provider, the server synthesizes a packet from persisted evidence and creates a new run.
4. The exhausted source is never prompted for a handoff and never receives a replacement worker of another type.
5. If preflight finds no target, the untouched source stays `quota_waiting` with its wake schedule. If launch fails after source termination, restore `quota_waiting` when a durable future wake exists; otherwise use `needs_recovery`. In both cases the error names the failed stage.

## Compact handoff packet contract

Create a versioned `HybridHandoffPacketV1` with the following logical shape. Use stable IDs and enums rather than translated labels.

```ts
type HybridHandoffPacketV1 = {
  handoffVersion: 1;
  source: {
    runId: string;
    workerId: string | null;
    workerType: SupportedWorkerType | null;
    forkedFromMessageId: string | null;
    sourceSeq: number | null;
    interruptionReason: "manual_session" | "manual_message" | "quota_exhausted";
    generatedAt: string;
  };
  target: {
    workerType: SupportedWorkerType;
    model: string | null;
    effort: string | null;
    accountId: string | null;
  };
  task: {
    originalRequest: string | null;
    currentObjective: string | null;
    acceptanceCriteria: string[];
    userConstraints: string[];
  };
  state: {
    completed: string[];
    inProgress: string[];
    remaining: string[];
    blockers: string[];
    openQuestions: string[];
    rejectedApproaches: Array<{ approach: string; reason: string }>;
  };
  decisions: Array<{ decision: string; reason: string | null; evidence: string[] }>;
  workspace: {
    projectRootLabel: string;
    baselineCommit: string | null;
    currentHead: string | null;
    dirtyBeforeSession: boolean | null;
    modifiedFiles: Array<{
      path: string;
      changeType: "added" | "modified" | "deleted" | "renamed" | "unmerged";
      ownership: "session" | "probable_session" | "preexisting" | "external" | "unknown";
      summary: string | null;
      evidence: string[];
    }>;
    untrackedFiles: string[];
    relevantUnchangedFiles: string[];
    commitsCreated: string[];
  };
  verification: Array<{
    command: string;
    result: "passed" | "failed" | "unknown";
    exitCode: number | null;
    importantOutput: string | null;
  }>;
  artifacts: {
    plans: string[];
    specs: string[];
    generatedOutputs: string[];
  };
  continuity: {
    recentUserMessages: string[];
    recentAssistantSummary: string | null;
    pendingUserInput: string | null;
    queuedMessages: string[];
  };
  provenance: {
    summarySource: "outgoing_worker" | "recent_assistant" | "synthetic" | "hybrid";
    omittedSections: string[];
    confidenceWarnings: string[];
    truncatedFields: string[];
  };
};
```

Compilation rules:

- Set an explicit 36,000-character rendered-packet ceiling (roughly 6,000–10,000 tokens depending on content), plus per-field item and character limits. Keep the constants in code, not environment variables.
- Prioritize source identity and sequence, user constraints, current objective, blockers/errors, file evidence, verification, decisions, queued input, then recent conversational tail. Drop completed prose first.
- Stable-sort every deterministic collection so the same redacted nonvolatile evidence yields the same semantic content hash; `generatedAt` may differ without changing that hash.
- Reuse a recent assistant recap only as advisory text. It is “fresh” only if its worker sequence is at or after the last included tool/result lifecycle boundary; otherwise include it with a stale-summary warning.
- Ask an outgoing worker for a structured report only when it is idle/responsive and not quota-blocked. Bound the request timeout. Never delay quota recovery on this call.
- For a hard interruption, synthesize entirely from the worker stream, execution events, messages/queued messages, run metadata, git evidence, and known artifacts.
- For a message fork, cap conversation candidates at that message/stream boundary while computing workspace state at capture time; call out the mismatch rather than claiming the checkout was rewound.
- Render advisory narrative inside an explicit untrusted-data boundary telling the target to verify disk state. Do not let tool/assistant text masquerade as system instructions.
- Run redaction before budgeting, canonicalization, hashing, preview extraction, rendering, logging, or event emission. Apply it to every structured text field and to the final rendered seed, including verification output, blockers, decision evidence, queued text, and outgoing-worker reports.
- Keep the absolute `projectPath` only in server-side run/handoff metadata for access and launch checks. The packet/API uses a non-sensitive `projectRootLabel` such as the repository directory name; all file evidence is project-relative.
- Hash the NFC-normalized, fixed-key-order canonical packet while excluding only volatile `generatedAt`. Target selection remains hash input, so changing it creates a new hash/revision.
- Render untrusted content inside a randomly generated, high-entropy nonce fence created after sanitization. Reject/regenerate a nonce that occurs in content, encode the interior as canonical JSON, and test delimiter/system/tool-frame imitation. The renderer's nonce is not part of the semantic packet hash.

## State machine and invariants

Persist these statuses: `capturing -> ready -> launching -> completed`, with terminal `failed` and `cancelled`. Only `capturing`, `ready`, and `launching` are nonterminal and covered by active-handoff uniqueness. Retrying a terminal failure always creates a new handoff row linked to the failed attempt; it never resurrects the terminal row.

The coordinator owns an immutable launch fence:

```ts
{
  handoffId,
  revision,
  sourceRunId,
  sourceWorkerId,
  sourceSeq,
  workspaceFingerprint,
  targetSelectionHash
}
```

Server invariants:

- At most one nonterminal handoff exists for a source run and normalized project path. A persistent workspace lease plus an in-process keyed mutex serializes capture/launch; every other OmniHarness mutation path for a run sharing that project refuses while the lease is active. Before capture, also refuse when another live run already owns a worker in the same checkout.
- New messages, queued-message delivery, retry/edit recovery, manual resume, quota wake, auto-commit, and reconciler actions refuse with `409 handoff_in_progress` while the source workspace is fenced.
- Opening the dialog is read-only. The explicit **Prepare handoff** action acquires the lease. If the source owns a live runtime, advance turn generation, request graceful interruption, wait up to `HANDOFF_STREAM_SETTLE_TIMEOUT_MS`, terminate the CLI process, and confirm process exit/no runtime ownership. If it is idle, quota-blocked, or already stopped, verify that no PID/live runtime owns it and skip the interruption/termination steps. If absence/exit cannot be confirmed, fail capture and do not create a target.
- Before termination, disable new source auto-commit scheduling and await any in-flight auto-commit under the workspace lease; do not manufacture a final commit. After confirmed source absence/termination, set `runs.activeHandoffId`, use `needs_recovery` internally, and capture the final durable worker sequence and git state. UI/recovery consumers seeing `activeHandoffId` render the handoff draft state instead of a generic crash banner. `ready`/`launching` remain handoff statuses, not new run statuses.
- Define `workspaceFingerprint` as SHA-256 over a canonical sequence containing HEAD, `git diff --binary --no-ext-diff`, and `git diff --cached --binary --no-ext-diff`, with NFC-normalized project-relative path records. Exclude untracked and ignored files from the drift fence to avoid editor/build-cache churn; still list capture-time untracked files in the packet with a warning that they are not launch-fenced.
- Launch first validates CLI availability, target account/model/effort compatibility, quota state, project path, source revision, and target selection without mutating source or target. It then re-reads the durable sequence and workspace fingerprint. Any drift refuses with `handoff.source_changed` and requires a new capture/preview; it never silently auto-revises a packet the user already reviewed.
- The target run and worker are created under the existing run/quota mutation controls. The rendered seed is persisted with `appendUserInputOnDelivery` in the target's unified worker stream before prompting the CLI.
- `launch` is idempotent. Persist a server-generated launch claim token and expiry before target creation, and stamp the target `runs.originHandoffId` before worker creation. Repeating the operation returns the discovered existing `targetRunId`; a stale revision gets `409 handoff_revision_conflict`.
- Every nonterminal handoff carries a lease expiry. `capturing`/`launching` use server heartbeats; the client renews a `ready` lease while the preview is open, capped at `HANDOFF_READY_MAX_LIFETIME_MS = 15 minutes`. A startup/heartbeat reconciler fails expired states, discovers targets by `originHandoffId`, adopts the one target where applicable, clears `runs.activeHandoffId`, releases the workspace fence, and emits the exact decision. Expired `ready` edits are not saved; the UI reports expiry and offers a fresh prepare.
- Mark `completed` only after target creation, target seed persistence, and worker launch acceptance. Set the already-terminated source run to `cancelled`, mark carried queued messages `cancelled` with a `cross_cli_handoff` reason, and persist the source-to-target link in the completed handoff row.
- A target launch failure never manufactures success and never deletes persisted rows. Mark any partially created target run `failed` and visible for diagnosis. Clear `runs.activeHandoffId`; if the source has a durable future quota wake, restore `quota_waiting` without clearing its quota incident/schedule so the same CLI can auto-resume at reset, otherwise set `needs_recovery` with recovery reason `handoff_post_stop_failure`. Release the workspace fence and emit the decision.
- Cancellation applies to manual and quota-created nonlaunching handoffs. The dialog and `RunRecoveryNotice` both expose it. Cancellation/expiry clears `runs.activeHandoffId`, releases the lease, and restores `quota_waiting` when a durable future wake exists or `needs_recovery` otherwise. Recovery UI and reconcilers branch on active handoff ID/reason rather than treating all `needs_recovery` states alike.
- Centralize that rule as `settleSourceAfterUnsuccessfulHandoff(sourceRecoverySnapshot, reason)` and call it for capture/termination refusal, cancel, expiry, drift abandonment, and post-stop launch failure. The snapshot preserves the original quota incident/wake. The helper always clears the active marker/lease, restores `quota_waiting` plus the durable future wake when one existed, and otherwise sets `needs_recovery` with the stage-specific reason; no caller chooses a status ad hoc.
- Deleting the source removes its handoff metadata/artifact stream through existing run cleanup; the target remains independently understandable because its initial worker stream contains the rendered seed.
- Deleting a target while its handoff is nonterminal first terminalizes the handoff and releases the source/workspace fence; `ON DELETE SET NULL` is not relied on as lifecycle logic.
- Same-run recreation must reject a requested worker type different from an existing direct/commit run's CLI. Enforce this in a shared spawn assertion and a SQLite `BEFORE INSERT` safety trigger, not only at callers. Model, effort, or account changes within the same CLI remain allowed where currently supported. Supervisor implementation runs retain their intentional multi-worker behavior.
- Automatic quota handoff walks handoff/parent lineage. Refuse after `MAX_AUTOMATIC_HANDOFF_DEPTH = 3`, exclude providers/accounts exhausted in the last two handoffs, enforce a cooldown, and verify the target account has no open quota incident before source termination.

## File map

### Create

- `src/shared/handoff.ts` — packet, lifecycle, API DTO, edit-patch, and error-code contracts shared by server/client.
- `src/server/handoff/candidates.ts` — bounded candidate reads from unified worker streams, messages, queued messages, events, and artifacts.
- `src/server/handoff/workspace-state.ts` — read-only git baseline/current evidence and file ownership classification.
- `src/server/handoff/redaction.ts` — path-safe text normalization, secret/tool-output filtering, and size limits.
- `src/server/handoff/compiler.ts` — authoritative/advisory merge, priority budgeting, deterministic ordering, provenance, hash, and renderer input.
- `src/server/handoff/store.ts` — SQLite metadata and append-only packet-version persistence.
- `src/server/handoff/coordinator.ts` — capture/preview/edit/launch state machine, source fence, idempotency, and failure recovery.
- `src/server/handoff/reconciler.ts` — startup/heartbeat recovery for expired capture/launch claims and orphan target adoption.
- `src/server/runs/fork.ts` — extracted generic new-run fork creation used by legacy message forks and handoff launches.
- `src/server/workers/direct-run-type-invariant.ts` — central direct/commit worker-type assertion used before worker insertion; emits typed refusal.
- `src/server/events/handoff-events.ts` — focused named-event union for import into the existing event contract.
- `src/runtime/http/routes/handoffs.ts` — create/list/get/patch/launch HTTP handlers and validation.
- `src/interface/home/HandoffForkManager.ts` — single source of truth for dialog draft, server revision, request ownership, pending stages, and errors.
- `src/interface/home/HandoffForkDialog.tsx` — target picker, packet preview/editor, warnings, and launch result UI.
- `src/components/home/CliLaunchSelectionFields.tsx` — reusable CLI/account/model/effort controls for the handoff dialog without duplicating composer selection logic.
- `tests/server/handoff/compiler.test.ts` — packet priority, freshness, deterministic hash, truncation, and rendering tests.
- `tests/server/handoff/candidates.test.ts` — bounded stream/event/queued-message and message-boundary tests.
- `tests/server/handoff/workspace-state.test.ts` — baseline/current classification and path-safety tests.
- `tests/server/handoff/redaction.test.ts` — credentials, environment, hidden reasoning, malicious content, and byte-limit tests.
- `tests/server/handoff/store.test.ts` — revisions, active-handoff uniqueness, idempotency, and cascade tests.
- `tests/server/handoff/coordinator.test.ts` — state transitions, source fences, synthetic fallback, target failures, and launch idempotency.
- `tests/server/handoff/reconciler.test.ts` — expired claim, orphan target adoption, target deletion, and fence-release tests.
- `tests/server/workers/direct-run-type-invariant.test.ts` — application assertion and SQLite trigger safety-net tests.
- `tests/api/handoffs-route.test.ts` — route validation/auth/contract/error responses.
- `tests/app/handoff-fork-manager.test.ts` — stale-response ownership, retry, selection, and close/reopen behavior.
- `tests/ui/handoff-fork-dialog.test.tsx` — translated copy, accessibility, advisory-only editing, and responsive states.
- `tests/lifecycle/scenarios/cross-cli-handoff-fork.test.ts` — manual and quota cross-CLI lifecycle scenario over HTTP/SSE.
- `tests/lifecycle/scenarios/cross-cli-handoff-restart.test.ts` — restart, replay, idempotent launch, and deletion scenario.

### Modify

- `src/server/db/schema.ts` — add `conversationHandoffs` metadata table and indexes.
- `src/server/db/index.ts` — additive schema initialization/migration and database version bump.
- `src/server/artifacts/stream-types.ts` — add the `handoff_packets` run-level stream kind.
- `src/server/artifacts/append-only-store.ts` — map the new stream to `handoff-packets.jsonl`.
- `src/server/handoff/request.ts` — make the outgoing summary request reason-neutral, structured, bounded, and optional.
- `src/server/handoff/parser.ts` — parse advisory report fields into the versioned candidate contract without treating them as facts.
- `src/server/handoff/render.ts` — render the versioned packet and remove quota-only wording.
- `src/server/git/auto-commit.ts` — extract/reuse baseline parsing needed by read-only workspace evidence without synchronous shell work on the hot path.
- `src/server/runs/recovery.ts` — delegate legacy retry/edit/fork run creation to focused services; do not grow this 1,300+ line module.
- `src/server/supervisor/worker-failover.ts` — retain compatibility exports but route cross-CLI cases to the new-run handoff coordinator; do not spawn another CLI in the source run.
- `src/server/supervisor/index.ts` and `src/server/supervisor/wake.ts` — consume target-run outcomes and preserve quota recovery semantics across restart.
- `src/server/supervisor/observer.ts` — record pending cross-CLI handoff intent instead of only same-run failover intent.
- `src/server/conversations/send-message.ts` — reject text/composer-driven cross-CLI changes inside an existing run and preserve same-CLI model/account recreation only.
- `src/server/conversations/create.ts`, `src/server/supervisor/index.ts`, `src/server/planning/review.ts`, and `src/server/runs/recovery.ts` — call the central direct/commit worker-type assertion before worker insertion; supervisor implementation multi-worker behavior remains allowed.
- `src/server/conversations/queued-messages.ts`, `src/server/conversations/queued-message-interrupt.ts`, `src/server/quota/worker-resume.ts`, and `src/server/runs/recovery-reconciler.ts` — enforce the persisted handoff fence before source mutation/recovery.
- `src/server/prompts/supervisor.md` — describe cross-provider recovery as a new-session handoff, not an in-session worker swap.
- `src/server/credits/index.ts` — make `cross_provider` return a target CLI/account candidate for the handoff coordinator rather than mutating the source worker account.
- `src/server/events/named-events.ts` — import the focused handoff event union, add stable surfaced error codes, and avoid embedding packet bodies in SSE.
- `src/runtime/http/routes/index.ts` — register handoff routes.
- `src/runtime-api/types.ts` and `src/runtime-api/domains/index.ts` — add typed `handoffs` operations.
- `src/interface/home/useHomeMutations.ts` — add query/mutations for preview, edit, launch, and active-draft lookup; switch selection only under matching request ownership.
- `src/interface/home/useConversationActions.ts` — route session/message cross-CLI actions into `HandoffForkManager`; retain ordinary same-run message retry/edit behavior.
- `src/interface/home/ExternalSessionsPicker.tsx` — separate external resume from the new current-conversation fork option.
- `src/components/home/HomeHeader.tsx` — add the session-level entry point.
- `src/components/home/ConversationMain.tsx` — add the per-message entry point through a small extracted action component or callback; do not grow this 1,600+ line file.
- `src/components/home/RunRecoveryNotice.tsx` — add quota handoff status/action and target-run navigation.
- `src/interface/home/HomeApp.tsx` — mount/wire the lazy dialog and manager only; move logic out of this 1,700+ line file.
- `src/interface/home/EventStreamStateManager.ts` and `src/interface/home/utils.ts` — reconcile handoff lifecycle events and target selection without optimistic run fabrication.
- `src/components/settings/ModelsSettingsPanel.tsx` — clarify that `cross_provider` opens a new handoff session while same-provider strategies stay in the current CLI.
- `shared/locales/*.json` — add every new visible label, description, warning, status, aria label, and error fallback to all locales.
- `tests/db/schema.test.ts`, `tests/supervisor/worker-failover.test.ts`, `tests/supervisor/worker-failover-handoff-fails.test.ts`, `tests/supervisor/worker-failover-spawn-retry.test.ts`, `tests/supervisor/worker-failover-no-replacement.test.ts`, `tests/api/conversation-messages-route.test.ts`, `tests/ui/conversation-actions.test.ts`, `tests/app/event-stream-state-manager.test.ts`, `tests/runtime/http-registry.test.ts`, `tests/runtime/http-routes.test.ts`, `tests/runtime/route-contract-fixture.test.ts`, and `tests/runtime/fixtures/routes.v1.json` — update existing expectations around the new-run invariant.
- `docs/architecture/lifecycle-observability-and-testing.md` — document handoff decisions/events and the source/target recovery model before adding server state transitions.
- `docs/architecture/worker-conversation-stream.md` — document that the target handoff seed is an ordinary first `user_input`, not a parallel transcript.
- `.gitignore` — verify packet temp/debug output cannot be tracked; add only a narrowly scoped ignore if implementation introduces a local debug artifact.

## API and persistence design

### SQLite metadata

Add `conversation_handoffs` with:

- `id` primary key.
- `source_run_id` foreign key to `runs` with `ON DELETE CASCADE`.
- `source_worker_id` nullable foreign key to `workers` with `ON DELETE SET NULL`.
- `target_run_id` nullable foreign key to `runs` with `ON DELETE SET NULL`.
- `forked_from_message_id`, `reason`, `status`, `revision`, `source_seq`, `normalized_project_path`, and `workspace_fingerprint`.
- `target_worker_type`, `target_model`, `target_effort`, `target_account_id`, `target_selection_hash`.
- `packet_version`, `artifact_seq`, `packet_hash`, `packet_preview`, `summary_source`.
- `operation_id`, `launch_claim_token`, `claim_expires_at`, `retry_of_handoff_id`, `last_error`, `created_at`, `updated_at`, and `completed_at`.
- Unique partial indexes for one `capturing|ready|launching` handoff per source run and normalized project path, plus indexes for target run, claim expiry, and status/update time.

Add nullable indexed `runs.origin_handoff_id` and `runs.active_handoff_id`. `origin_handoff_id` is written in the same transaction as target run creation, deliberately has no cascading foreign key, and lets restart recovery discover a target even if the process died before `conversation_handoffs.target_run_id` was updated. `active_handoff_id` distinguishes an intentionally prepared source from an ordinary `needs_recovery` run and is cleared on every terminal transition.

Keep the full packet out of SQLite. Append every ready/revised packet as an `ArtifactRecordEnvelope<HybridHandoffPacketV1>` in the source run's `handoff_packets` stream and point metadata at the current sequence/hash. Store only a bounded, redacted preview for list/recovery UI.

### HTTP contract

- `POST /api/runs/:runId/handoffs` — create or return the active draft. Body: fork point, reason, and target selection. Returns `202 capturing` or `200 ready` with metadata/packet DTO.
- `GET /api/runs/:runId/handoffs?active=1` — restore a durable draft after reload.
- `GET /api/handoffs/:handoffId` — inspect the current packet/revision/result.
- `PATCH /api/handoffs/:handoffId` — patch advisory fields with `expectedRevision`; return `409` on stale revision.
- `POST /api/handoffs/:handoffId/launch` — idempotent launch with `expectedRevision`, `operationId`, and final target selection; return the target run/worker IDs.
- `POST /api/handoffs/:handoffId/cancel` — release any nonlaunching manual or quota draft fence. A launching/completed handoff cannot be cancelled; the reconciler owns abandoned launch claims.

Every flat `/api/handoffs/:handoffId` handler must resolve the source run and apply the same project/run authorization check as run-scoped endpoints before reading or mutating anything. Include an IDOR test using an authenticated caller without access to the source project. Cancellation covers every nonlaunching manual or quota draft.

There are no persisted V0 packet artifacts to migrate: the existing parser/request/render path produces ephemeral reports only. Treat those reports as advisory candidates when creating V1. If a future/unknown artifact version is encountered, retain it on disk, refuse to render it, surface `handoff.packet_version_unsupported`, and require a fresh V1 capture.

Return typed stage-specific errors. HTTP conflicts include `handoff_in_progress`, `handoff_revision_conflict`, and `handoff_required`. User-relevant failures also emit `error.surfaced` with stable codes `handoff.capture_failed`, `handoff.revision_conflict`, `handoff.target_unavailable`, `handoff.source_changed`, `handoff.launch_failed`, `handoff.fork_required`, and `handoff.packet_version_unsupported`; register every code in the named-event typed union.

### Named events

Emit these via `emitNamedEvent` for every server decision:

- `handoff.capture_started`
- `handoff.packet_ready`
- `handoff.packet_revised`
- `handoff.launch_started`
- `handoff.completed`
- `handoff.cancelled`
- `handoff.failed`
- `handoff.refused`

Events carry IDs, revisions, stage, source/target IDs, target worker type, reason, and stable error code where relevant. They never carry the full packet. All event frames retain the existing SSE ID/replay/resync behavior.

## Implementation tasks

### Task 1: Document the invariant and preserve a green baseline

**Files:**
- Modify: `docs/architecture/lifecycle-observability-and-testing.md`
- Modify: `docs/architecture/worker-conversation-stream.md`

- [ ] Add architecture text stating that a CLI/provider change creates a new run, the target seed lives in its unified worker stream, and source/target ownership is never shared.
- [ ] Record the three-phase ordering: validate target; terminate/confirm source and capture final state; create/prompt target. Document `cancelled` success and the single unsuccessful-settlement helper that restores a durable `quota_waiting` wake or uses stage-specific `needs_recovery`.
- [ ] Record workspace lease, drift refusal, packet redaction/untrusted-boundary, restart claim, and named-event requirements before implementing state transitions.
- [ ] Run the existing baseline without changing its expectations: `pnpm vitest run tests/api/conversation-messages-route.test.ts tests/supervisor/worker-failover.test.ts tests/supervisor/worker-failover-handoff-fails.test.ts tests/supervisor/worker-failover-spawn-retry.test.ts tests/supervisor/worker-failover-no-replacement.test.ts`.

### Task 2: Define the packet and lifecycle contracts

**Files:**
- Create: `src/shared/handoff.ts`
- Create: `tests/server/handoff/compiler.test.ts`
- Create: `tests/server/handoff/redaction.test.ts`

- [ ] Define V1 packet, provenance, lifecycle metadata, editable advisory patch, API request/response, and error-code types.
- [ ] Make authoritative versus advisory fields explicit in the types so PATCH cannot alter source/workspace/verification provenance.
- [ ] Add constants for total and per-field budgets, item counts, recent-tail bounds, and supported interruption reasons.
- [ ] Write failing tests for stable ordering, NFC/fixed-key canonicalization, a content hash that excludes only `generatedAt`, priority truncation, exact omission metadata, and rejection of unknown packet versions.
- [ ] Write failing redaction/render-boundary tests for common API keys/tokens, authorization headers, environment dumps, hidden-reasoning entries, absolute paths outside the project, control characters, nonce/delimiter injection, and content imitating system/tool-result framing.
- [ ] Run `pnpm vitest run tests/server/handoff/compiler.test.ts tests/server/handoff/redaction.test.ts` and confirm failures are contractual rather than fixture errors.

### Task 3: Add durable metadata and packet artifact storage

**Files:**
- Modify: `src/server/db/schema.ts`
- Modify: `src/server/db/index.ts`
- Modify: `src/server/artifacts/stream-types.ts`
- Modify: `src/server/artifacts/append-only-store.ts`
- Create: `src/server/handoff/store.ts`
- Create: `tests/server/handoff/store.test.ts`
- Modify: `tests/db/schema.test.ts`

- [ ] Add the `conversation_handoffs` table, `runs.originHandoffId`, `runs.activeHandoffId`, foreign keys, normalized workspace key, timestamps, revision, operation/claim/expiry fields, bounded preview, and exact partial indexes described above using the repository's additive schema pattern.
- [ ] Increment `DB_SCHEMA_VERSION` and test initialization of old and fresh databases.
- [ ] Add the run-level `handoff_packets` stream and map it to `app-data/run-data/<runId>/handoff-packets.jsonl` through the artifact store.
- [ ] Implement transactional metadata transitions plus append/read of packet versions; never expose a metadata revision whose artifact append failed.
- [ ] Enforce one active handoff per source run and normalized project path, idempotent operation IDs, and target discovery by `originHandoffId`.
- [ ] Test packet revision lookup, stale revision refusal, source deletion cascade, target deletion terminalization/fence release, expired claim lookup, and no orphaned artifact metadata.
- [ ] Run `pnpm vitest run tests/server/handoff/store.test.ts tests/db/schema.test.ts`.

### Task 4: Gather bounded deterministic evidence

**Files:**
- Create: `src/server/handoff/candidates.ts`
- Create: `src/server/handoff/workspace-state.ts`
- Create: `src/server/handoff/redaction.ts`
- Modify: `src/server/git/auto-commit.ts`
- Create: `tests/server/handoff/candidates.test.ts`
- Create: `tests/server/handoff/workspace-state.test.ts`
- Modify: `tests/server/handoff/redaction.test.ts`

- [ ] Read worker content only through bounded `readWorkerEntriesTail`/`Since`/`Before` APIs and respect superseded sequence ranges.
- [ ] Gather original/current user requests, a small exact recent tail, latest assistant recap, queued messages, unresolved execution errors, verification commands/results, plan/spec/generated artifact paths, and the source sequence.
- [ ] For message forks, constrain conversational evidence to the selected message boundary.
- [ ] Parse `runs.gitBaselineJson`, current HEAD/status, diff stats, commit range, tool edit events, and relevant agent summaries into file ownership evidence.
- [ ] Classify file ownership conservatively; never claim session ownership from current git status alone. Preserve `unknown` and warnings.
- [ ] Normalize project-relative paths, keep raw absolute project paths server-only, omit file contents and raw diff hunks by default, and include only narrowly bounded hunks for unresolved conflicts/subtle incomplete edits.
- [ ] Redact every candidate before budgeting, hashing, previewing, rendering, logging, or event emission; perform a final redaction pass over the rendered seed.
- [ ] Test large streams, already-compacted history, deleted/renamed/untracked files, a dirty pre-session baseline, external concurrent edits, post-message workspace drift, malformed baselines, and non-git projects.
- [ ] Run `pnpm vitest run tests/server/handoff/candidates.test.ts tests/server/handoff/workspace-state.test.ts tests/server/handoff/redaction.test.ts`.

### Task 5: Compile and render the hybrid packet

**Files:**
- Create: `src/server/handoff/compiler.ts`
- Modify: `src/server/handoff/request.ts`
- Modify: `src/server/handoff/parser.ts`
- Modify: `src/server/handoff/render.ts`
- Modify: `tests/server/handoff/compiler.test.ts`
- Modify: `tests/server/handoff/parser.test.ts`

- [ ] Implement deterministic merging where collected facts override advisory summaries and every conflict becomes a confidence warning.
- [ ] Detect fresh recent assistant recaps using worker/event sequence evidence.
- [ ] Update the outgoing request to return only structured task/state/decision/file explanations; use a short timeout and skip it for quota-blocked or busy workers.
- [ ] Preserve the existing synthetic fallback, but feed it through the same candidates/compiler/redaction pipeline.
- [ ] Enforce the packet budget by priority, populate `omittedSections`/`truncatedFields`, and hash the redacted canonical representation excluding only `generatedAt`.
- [ ] Render a concise target prompt with objective, state, decisions, workspace, verification, pending input, uncertainty, and an explicit instruction to inspect current files before acting. Place canonical JSON inside a post-sanitization random nonce fence and ensure embedded text cannot close or imitate the boundary.
- [ ] Ensure quota wording is a reason field, not hard-coded into all handoffs.
- [ ] Test clean completed turns, mid-turn interruption, hard quota interruption, already-compacted history, short sessions, stale summaries, malicious advisory content, and overflow.
- [ ] Run `pnpm vitest run tests/server/handoff/compiler.test.ts tests/server/handoff/redaction.test.ts tests/server/handoff/parser.test.ts`.

### Task 6: Extract safe new-run fork creation

**Files:**
- Create: `src/server/runs/fork.ts`
- Modify: `src/server/runs/recovery.ts`
- Modify: `tests/api/run-route.test.ts`
- Modify: `tests/ui/conversation-actions.test.ts`

- [ ] Extract plan/run/message-copy creation from the existing `recoverRun(... action: "fork")` branch without changing retry/edit semantics.
- [ ] Accept an explicit target worker type/model/effort/account/allowed-types selection and copy `preferredWorkerAccountId`, which the current fork path can omit.
- [ ] Preserve `parentRunId`, `forkedFromMessageId`, project path, and auto-commit preferences. Add `copyMessagePrefix: boolean`: legacy same-CLI forks use `true`; cross-CLI handoffs use `false` so the rendered packet is the target's only initial conversation entry.
- [ ] For a cross-CLI target, capture a fresh git baseline after source termination and in-flight auto-commit settlement, and store it as the target `gitBaselineJson`/workspace metadata. The packet separately reports source-session changes relative to the source's original baseline, so target ownership begins at handoff.
- [ ] Keep target preflight validation separate from target creation. The coordinator performs source termination and post-stop capture between preflight and target creation.
- [ ] Keep existing ordinary and worktree fork behavior passing; do not create a worktree for cross-CLI handoff.
- [ ] On worker launch failure, retain the partially created plan/run as a visible `failed` diagnostic record stamped with `originHandoffId`; do not delete it or claim launch succeeded.
- [ ] Run `pnpm vitest run tests/api/run-route.test.ts tests/ui/conversation-actions.test.ts`.

### Task 7: Build the server coordinator and source fence

**Files:**
- Create: `src/server/handoff/coordinator.ts`
- Create: `src/server/handoff/reconciler.ts`
- Create: `tests/server/handoff/coordinator.test.ts`
- Create: `tests/server/handoff/reconciler.test.ts`
- Modify: `src/server/conversations/queued-messages.ts`
- Modify: `src/server/conversations/queued-message-interrupt.ts`
- Modify: `src/server/quota/worker-resume.ts`
- Modify: `src/server/runs/recovery-reconciler.ts`

- [ ] Implement capture, revise, launch, cancel, retry, and restore transitions over the persisted metadata/store.
- [ ] Acquire the persisted normalized-workspace lease plus in-process workspace mutex; reject another active handoff or any other live worker already using that checkout.
- [ ] On explicit prepare/capture, branch on runtime ownership: for a live source, advance turn generation, request graceful interruption, wait up to `HANDOFF_STREAM_SETTLE_TIMEOUT_MS`, terminate the CLI process, and confirm exit; for idle/quota/stopped sources, verify no PID/live runtime and proceed. Refuse before target creation if absence/exit cannot be confirmed.
- [ ] Disable source auto-commit scheduling, await any in-flight commit, deliberately skip a new final auto-commit, and warn when interruption occurred without a clean tool/turn boundary because files may be partially written.
- [ ] After process absence/exit, recapture the final durable sequence, HEAD, canonical tracked-diff workspace fingerprint, fresh target git baseline, and packet. On launch, re-read them and refuse drift with `handoff.source_changed` plus a visible recapture action.
- [ ] Stop queued delivery, preserve undelivered messages in continuity, and atomically mark their source rows `cancelled` with `cross_cli_handoff` after successful launch so they cannot execute twice.
- [ ] Validate target CLI/account/model/effort/quota state and automatic handoff chain/cooldown limits before source termination.
- [ ] Persist a server claim token/expiry, create the stamped target run, persist rendered seed with `appendUserInputOnDelivery`, and start the target only after source process exit was confirmed.
- [ ] On success clear `activeHandoffId` and set source run `cancelled`. On every unsuccessful terminal path call `settleSourceAfterUnsuccessfulHandoff`; for post-stop target failure also leave any partial target visible as `failed`.
- [ ] Implement launch idempotency, stale source-sequence/revision/workspace refusal, and a startup/heartbeat reconciler that adopts targets by `originHandoffId` or fails expired `capturing`, `ready`, and `launching` leases. A client heartbeat may extend `ready` only up to the 15-minute maximum.
- [ ] Gate send, queue, retry/edit, resume, wake, auto-commit, and reconciler mutations for every run sharing a leased workspace.
- [ ] Handle target deletion by terminalizing a nonterminal handoff and releasing its fence before `ON DELETE SET NULL` runs.
- [ ] Test races: another live run in the checkout, send versus capture, capture versus quota wake, live versus already-dead/quota sources, double launch, cancel versus launch, process refusing to exit, late output, tracked workspace/HEAD drift, untracked churn exclusion, ready expiry with unsaved client edits, target spawn failure, claim expiry, orphan adoption, restart at every status, queued-message cancellation, and source/target deletion.
- [ ] Run `pnpm vitest run tests/server/handoff/coordinator.test.ts tests/server/handoff/reconciler.test.ts tests/server/quota/worker-resume.test.ts tests/server/runs/recovery-reconciler.test.ts`.

### Task 8: Expose typed HTTP/runtime APIs and observability

**Files:**
- Create: `src/server/events/handoff-events.ts`
- Modify: `src/server/events/named-events.ts`
- Create: `src/runtime/http/routes/handoffs.ts`
- Modify: `src/runtime/http/routes/index.ts`
- Modify: `src/runtime-api/types.ts`
- Modify: `src/runtime-api/domains/index.ts`
- Create: `tests/api/handoffs-route.test.ts`
- Modify: `tests/runtime/http-registry.test.ts`
- Modify: `tests/runtime/http-routes.test.ts`
- Modify: `tests/runtime/route-contract-fixture.test.ts`
- Modify: `tests/runtime/fixtures/routes.v1.json`

- [ ] Add the named handoff events and every stable `error.surfaced` code, including `handoff.fork_required` and `handoff.packet_version_unsupported`, without growing `named-events.ts` with full implementation logic.
- [ ] Register create/list/get/patch/launch/cancel routes; resolve flat handoff IDs through the source run's authorization scope before returning data, and validate all IDs, enums, revisions, and selection fields.
- [ ] Return `202` for in-progress capture, `409` for ownership/revision conflicts, `422` for incompatible target selection, and stage-specific `5xx` errors only for actual server failures.
- [ ] Add typed runtime APIs; do not route handoffs through `runs.act` with `unknown` bodies.
- [ ] Ensure no HTTP or SSE response includes secrets, raw packet artifacts when only metadata is needed, or untranslated visible server prose at the UI boundary.
- [ ] Test auth/IDOR, malformed input, unsupported source mode, same-CLI target refusal, stale revision, replayed operation ID, packet retrieval, and surfaced error event payloads.
- [ ] Run `pnpm vitest run tests/api/handoffs-route.test.ts tests/runtime/http-registry.test.ts tests/runtime/http-routes.test.ts tests/runtime/route-contract-fixture.test.ts`.

### Task 9: Replace every same-run cross-CLI path

**Files:**
- Create: `src/server/workers/direct-run-type-invariant.ts`
- Create: `tests/server/workers/direct-run-type-invariant.test.ts`
- Modify: `src/server/conversations/send-message.ts`
- Modify: `src/server/conversations/create.ts`
- Modify: `src/server/supervisor/worker-failover.ts`
- Modify: `src/server/supervisor/index.ts`
- Modify: `src/server/supervisor/wake.ts`
- Modify: `src/server/supervisor/observer.ts`
- Modify: `src/server/prompts/supervisor.md`
- Modify: `src/server/credits/index.ts`
- Modify: `src/server/planning/review.ts`
- Modify: `src/server/runs/recovery.ts`
- Modify: `src/server/db/index.ts`
- Modify: `src/components/settings/ModelsSettingsPanel.tsx`
- Modify: `tests/api/conversation-messages-route.test.ts`
- Modify: `tests/supervisor/worker-failover.test.ts`
- Modify: `tests/supervisor/worker-failover-handoff-fails.test.ts`
- Modify: `tests/supervisor/worker-failover-spawn-retry.test.ts`
- Modify: `tests/supervisor/worker-failover-no-replacement.test.ts`

- [ ] First write failing tests proving: follow-up text/API cannot change a direct run's CLI; cross-provider failover returns a distinct target run; target unavailable preserves quota recovery; and direct/commit worker insertion of another type is rejected at the central assertion and SQLite trigger.
- [ ] Add `assertDirectRunWorkerTypeInvariant` before all direct/commit worker insertions and an additive SQLite `BEFORE INSERT ON workers` trigger as the final safety net. The trigger applies only when the referenced run has `session_type = 'omni'` and `mode IN ('direct', 'commit')`, and only rejects a *new* row whose normalized type differs from an existing worker; creating it on a legacy database never scans/rejects pre-existing mixed rows. Do not restrict intentional multi-type supervisor implementation runs.
- [ ] Catch the trigger's stable constraint marker at the shared worker-insert boundary, map it to typed HTTP `409 handoff_required` plus surfaced code `handoff.fork_required`, emit `handoff.refused`, and translate visible guidance at the UI boundary; never leak a raw SQLite 500.
- [ ] In `applyWorkerPreferenceForMessage`/`reconcileDirectWorkerSelection`, reject a type change for an existing run with a typed “fork required” result; do not persist the new preferred type and do not defer it for later recreation.
- [ ] Keep same-CLI model, effort, and account recreation behavior and its current ownership fencing.
- [ ] Change `src/server/credits/index.ts` so `cross_provider` selects and returns a candidate target CLI/account without mutating source credentials; validate it is not quota-blocked or in the recent exhaustion cooldown.
- [ ] Route cross-provider quota strategy/allowed-worker selection to `coordinator.captureAndLaunch` and return `targetRunId` rather than a replacement worker ID. Enforce automatic chain depth three and recent-provider/account exclusions.
- [ ] Keep the existing `worker-failover.ts` exports as compatibility wrappers while callers/tests migrate; do not delete the file.
- [ ] Update wake/restart recovery to continue a persisted handoff rather than retrying a same-run provider spawn.
- [ ] Update supervisor prompt and settings explanation to say cross-provider recovery creates a new session.
- [ ] Rename user-visible lifecycle copy from “switching workers” to handoff/fork language while retaining legacy event parsing only where backward compatibility needs it.
- [ ] Run `pnpm vitest run tests/server/workers/direct-run-type-invariant.test.ts tests/api/conversation-messages-route.test.ts tests/supervisor/worker-failover.test.ts tests/supervisor/worker-failover-handoff-fails.test.ts tests/supervisor/worker-failover-spawn-retry.test.ts tests/supervisor/worker-failover-no-replacement.test.ts` and assert no direct/commit source run contains workers of two CLI types.

### Task 10: Build the client Manager and dialog

**Files:**
- Create: `src/interface/home/HandoffForkManager.ts`
- Create: `src/interface/home/HandoffForkDialog.tsx`
- Create: `src/components/home/CliLaunchSelectionFields.tsx`
- Modify: `src/interface/home/useHomeMutations.ts`
- Create: `tests/app/handoff-fork-manager.test.ts`
- Create: `tests/ui/handoff-fork-dialog.test.tsx`
- Modify: `shared/locales/*.json`

- [ ] Implement a Manager-owned state machine for closed/selecting/capturing/ready/editing/launching/completed/error, including source run/message IDs, revision, target selection, packet, warnings, and request token.
- [ ] Use TanStack Query only for transport/cache; the Manager is the single UI source of truth and ignores responses whose ownership token no longer matches.
- [ ] Build an accessible, responsive dialog using existing Dialog/Select/Textarea/Button/ScrollArea/Alert/Badge primitives.
- [ ] Keep dialog open/target selection read-only. Label **Prepare handoff** as the point that stops the source CLI; after preparation, cancel invokes the server's single unsuccessful-settlement helper, preserving a durable quota wake or exposing stage-specific recovery.
- [ ] Default to the last compatible *different* CLI, exclude the source CLI, and validate account/model/effort combinations before capture/launch.
- [ ] Show authoritative sections read-only, advisory fields editable, source/provenance/warnings visible, and an explicit “current files win” note.
- [ ] Debounce or explicitly save advisory edits with `expectedRevision`; disable launch until the current edit revision is acknowledged.
- [ ] Renew the ready lease while the preview is open without exceeding 15 minutes. On expiry, discard only unsaved local edits, show that the source remains recoverable, and offer **Prepare fresh handoff**; on tracked drift, offer the same recapture action rather than looping launch retries.
- [ ] Allow recovery of the active durable draft after reload and a clear cancel action before launch for both manual and quota drafts.
- [ ] Add all visible/aria/error strings to every `shared/locales/*.json` file and subscribe with `useI18nSnapshot()`.
- [ ] Test keyboard focus, escape/cancel, mobile sizing, loading/error/retry states, stale edit conflicts, CLI exclusion, and no hard-coded user-facing JSX.
- [ ] Run `pnpm vitest run tests/app/handoff-fork-manager.test.ts tests/ui/handoff-fork-dialog.test.tsx`.

### Task 11: Wire every product entry point

**Files:**
- Modify: `src/interface/home/useConversationActions.ts`
- Modify: `src/interface/home/ExternalSessionsPicker.tsx`
- Modify: `src/components/home/HomeHeader.tsx`
- Modify: `src/components/home/ConversationMain.tsx`
- Modify: `src/components/home/RunRecoveryNotice.tsx`
- Modify: `src/interface/home/HomeApp.tsx`
- Modify: `tests/ui/conversation-actions.test.ts`
- Modify: `tests/server/external-sessions/discovery.test.ts`
- Modify: `shared/locales/*.json`

- [ ] Add **Fork to another CLI** to the session menu for eligible direct/commit runs.
- [ ] Add **Fork to another CLI from here** to user-message actions and pass the exact message ID.
- [ ] Add a distinct current-conversation fork choice to Resume CLI Session without changing external Claude/Gemini resume behavior.
- [ ] Add a quota notice action/status that opens or navigates to the automatic handoff and target run.
- [ ] Add a quota/recovery notice action that cancels an abandoned ready/capturing handoff or retries a `needs_recovery` source; do not require the lost dialog state to release a fence.
- [ ] Keep `HomeApp.tsx` as wiring only and extract any message-action UI needed to avoid growing oversized components.
- [ ] On success, select the target only if the user is still viewing the source associated with the completed request; otherwise show a non-destructive notification/link.
- [ ] Preserve ordinary “Fork session” semantics if it remains same-CLI, and make the cross-CLI wording unambiguous.
- [ ] Test eligibility, source/message payloads, no selected run, unsupported modes, selection races, external resume regression, and quota CTA behavior.
- [ ] Run `pnpm vitest run tests/ui/conversation-actions.test.ts tests/server/external-sessions/discovery.test.ts`.

### Task 12: Reconcile SSE, restart, and lifecycle recovery

**Files:**
- Modify: `src/interface/home/EventStreamStateManager.ts`
- Modify: `src/interface/home/utils.ts`
- Modify: `tests/app/event-stream-state-manager.test.ts`
- Create: `tests/lifecycle/scenarios/cross-cli-handoff-fork.test.ts`
- Create: `tests/lifecycle/scenarios/cross-cli-handoff-restart.test.ts`

- [ ] Reconcile capture/revision/launch/completion/failure events into existing run snapshots without creating optimistic fake runs.
- [ ] Fetch snapshot/active handoff after `stream.resync_required`; treat SSE as an invalidation signal and HTTP/SQLite as authority.
- [ ] Add a manual lifecycle scenario covering source activity, stable capture, packet artifact, target run/worker/seed, source stop, and no mixed CLI types.
- [ ] Add a quota scenario where the outgoing worker cannot answer, synthetic capture succeeds, and the target new run continues.
- [ ] Add restart checkpoints after `capturing`, `ready`, and `launching`; prove recovery either finishes once or surfaces a retryable failure without duplicate targets.
- [ ] Add FK/delete coverage: deleting the source removes its packet metadata/artifact while the target's seed remains readable.
- [ ] Validate every decision through `/api/events/log?since=<id>&runId=<id>` and assert named refusal/failure events exist.
- [ ] Run the focused state-manager test, then `pnpm test:lifecycle`.

### Task 13: Full verification and handoff documentation

**Files:**
- Modify only as failures require within the files already listed.
- Verify: `.gitignore`

- [ ] Re-read both architecture docs and confirm every new server decision emits a named event and every user-relevant failure emits a stable `error.surfaced` code.
- [ ] Verify every target seed was persisted through `appendUserInputOnDelivery` and no parallel conversation storage was introduced.
- [ ] Verify cross-CLI targets copy no source message rows/worker entries: only parent/message metadata plus the rendered first `user_input` packet crosses the boundary.
- [ ] Verify logs/events demonstrate confirmed source process exit before target run creation and that the direct/commit SQLite trigger rejects mixed worker types.
- [ ] Verify all visible strings use `t()` and all locale files contain the same new keys.
- [ ] Verify packet storage, test databases, generated debug packets, CLI transcripts, credentials, and temporary review output are not accidentally tracked; make only a narrow `.gitignore` addition if needed.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm vitest run`.
- [ ] Run `pnpm test:lifecycle`.
- [ ] Run the mandatory frontend build: `pnpm build:interface:web`.
- [ ] Inspect `git diff --check` and `git status --short`; preserve unrelated user changes and confirm the implementation did not create a branch, worktree, or delete files.

## Verification matrix

| Case | Expected result |
|---|---|
| Header fork, idle source | Prepare verifies no live runtime, captures final state, and only then allows creation of a distinct target run. |
| Header fork, active turn | Prepare generation-fences, settles, terminates, and confirms source process exit before capture; target creation cannot overlap. |
| Source CLI refuses to exit | Launch is refused before target creation; the unsuccessful-settlement helper restores a durable quota wake or uses `needs_recovery`; named failure identifies termination. |
| Another live run uses checkout | Workspace lease/preflight refuses handoff; neither source nor other run is mutated. |
| Message fork | Conversation is bounded at the message; current workspace drift is explicit; `forkedFromMessageId` is preserved. |
| Manual preview becomes stale | Sequence/HEAD/workspace fingerprint drift returns `handoff.source_changed`; user must prepare a fresh packet. |
| Ready preview abandoned | Lease expires by 15 minutes, source marker/fence clears, quota wake or recovery state is restored, and reopening offers a fresh prepare. |
| Resume CLI Session dialog | External resume still resumes an external provider session; current-conversation fork opens handoff flow. |
| Quota, outgoing CLI dead | No outgoing request; synthetic packet launches a distinct target run. |
| Quota, target unavailable | Preflight failure leaves `quota_waiting` untouched; post-stop failure restores its durable future wake or uses `needs_recovery`; no success is reported. |
| Quota handoff loop | Recent exhausted providers/accounts are excluded; depth four is refused with a visible wait/manual-recovery state. |
| Same-run text asks to switch CLI | Request is refused with fork guidance; source preferences/worker type do not change. |
| Same-CLI model/account change | Existing supported recreation path still works inside the run. |
| Already compacted source | Provider recap is advisory; post-compaction evidence and exact recent tail are included. |
| Dirty workspace before session | Pre-existing files are not claimed as session-owned; uncertainty is preserved. |
| Concurrent/external file change | Ownership becomes external/unknown; packet does not overwrite or silently attribute it. |
| Packet overflow | Highest-priority facts remain; dropped fields are named; hash is deterministic. |
| Reload while preview is ready | Active draft and revision restore from server; edits do not regress. |
| Disconnect during launch | SSE replay/snapshot returns one target; repeated operation ID is idempotent. |
| Crash after target row creation | Reconciler discovers exactly one target by `originHandoffId`, adopts or fails it, and releases the claim/lease. |
| Target deleted during launch | Handoff terminalizes and source/workspace fence releases before the target link is nulled. |
| Delete source after completion | Source metadata/artifact is cleaned; target initial seed remains self-contained. |

## Agentic user-journey candidates (approval required before running)

These browser journeys are valuable after automated tests/build pass, but they must not be run without explicit user approval because they create real local conversations and CLI activity:

1. Start a Codex direct session, make a small edit, open the header handoff dialog, inspect/edit the packet, fork to Claude, verify the new sidebar session and source preservation, then clean up the test conversations/artifacts.
2. Fork from an earlier user message and confirm the preview distinguishes historical conversation state from the current checkout.
3. Simulate/induce a quota-waiting source through supported test controls, select cross-provider recovery, verify the synthetic packet and target navigation, then clean up.
4. Reload the browser while a handoff preview is open and while launch is completing; verify restoration, SSE replay, and no duplicate target.

## Implementation guardrails

- Begin implementation by rechecking `git status --short`; the current worktree already contains user changes. Never overwrite, revert, or reformat unrelated edits.
- Do not create a branch or worktree and do not delete any file.
- Keep new logic out of `HomeApp.tsx`, `ConversationMain.tsx`, `runs/recovery.ts`, and `worker-failover.ts` except thin integration/delegation because all are already oversized.
- Use `src/server/git/command.ts` or existing async helpers for git evidence; avoid synchronous shell calls in request paths.
- Never log or emit the full packet in named events, errors, or ordinary server logs.
- Never pass translated strings through transactions or persist translated UI copy.
- Never treat an LLM-generated summary as proof that a file changed, a test passed, or a command ran.
- Do not add configurable frontend strings/settings through `.env`; packet limits are code constants.
- Clean up test conversations and persisted artifacts after any approved live/agentic validation.
--- PLAN END ---

uuid: 44566e26-bc2b-4178-a71e-8d9d4d2163f2
parent: da4547fe-38e3-44e8-bec2-27576e054680

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-08-20T18:18:30.632Z","phase":null} -->
## Claude thinking · 2026-08-20T18:18:30.632Z



uuid: 70e71c85-2143-488c-b856-1fe291e28cf8
parent: 44566e26-bc2b-4178-a71e-8d9d4d2163f2

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-08-20T18:18:30.695Z","phase":null} -->
## Claude · 2026-08-20T18:18:30.695Z

READY

uuid: f376ae29-5426-4a5f-aece-67393b16063d
parent: 70e71c85-2143-488c-b856-1fe291e28cf8

<!-- /codex-event -->
