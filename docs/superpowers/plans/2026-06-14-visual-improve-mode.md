# Visual Improve Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an OmniHarness `improve` conversation mode that runs one advisor agent with the improve skill bundle and turns its audit/planning output into structured, reviewable cards.

**Architecture:** Model `improve` as a direct-worker-backed advisor mode, not as an implementation supervisor mode. The advisor worker owns the prose transcript through the existing unified worker stream, while the server extracts and persists structured improve results into typed database rows/artifact streams and surfaces them through the existing SSE snapshot/event path. The UI renders those records in an improve-results panel where each card can be inspected, approved for planning/implementation, rejected, or refined through the same worker conversation.

**Tech Stack:** Next.js 15, React 19, TypeScript, Drizzle/SQLite, existing OmniHarness ACP bridge, unified worker stream, named SSE events, shadcn/ui primitives already in the app, Vitest lifecycle tests.

**North Star Product:** OmniHarness becomes an agent-work review cockpit: expensive advisor runs produce durable, structured recommendations; humans can compare, approve, refine, promote, execute, and reconcile agent work without reading terminal scrollback as the primary UI.

**Current Milestone:** Deliver the first usable visual `/improve` equivalent: one advisor agent, improve-skill prompt, structured findings/direction/plan candidates, card review UI, per-card refine/approve/reject actions, and lifecycle coverage for start, completion, reconnect, and failure.

**Future Product Direction:** Later milestones can add multi-category parallel advisor workers, GitHub issue publishing, backlog reconciliation, execution dispatch, and historical cross-run trend views. Those are context only; this plan does not implement them.

**Final Functionality Standard:** A user can choose `Improve`, start an advisor run, watch status, review structured result cards without scrolling through the transcript, approve or reject individual cards, ask the advisor to refine a card, and promote approved output into the existing planning/implementation path. No source-code edits, branches, worktrees, or file deletions are performed by improve mode itself.

---

## Product Design

### PM Pass

- **First User:** The human builder using OmniHarness to decide what a codebase needs next.
- **Core Job:** Run a high-quality codebase improvement advisor and review its output as structured decisions.
- **Supporting Jobs:** See progress, understand evidence, recover from failures, revisit prior improve runs, refine one recommendation without losing the rest, approve selected work, and send approved work into the existing planning/implementation pipeline.
- **User Segmentation:** Single-user local tool for this milestone. No collaboration or permissions model changes.
- **State Model:** `starting`, `running`, `awaiting_refinement`, `completed`, `failed`, plus per-result `proposed`, `approved`, `rejected`, `refining`, `refine_failed`, `superseded`, `promoted`.
- **Persistence Model:** Runs remain in `runs`; transcript content remains in the worker JSONL stream; structured improve output lives in new typed DB rows plus artifact-stream-backed long fields. Per-card approval/rejection/refinement state is workspace-local and survives reload/restart. No translated UI copy is persisted.
- **Operational Readiness:** Spawn failures, malformed advisor output, partial output, restart, SSE reconnect, and stale refine requests must all surface as named events and visible UI state.
- **Instrumentation And Observability:** Emit named events for improve start, parsed result, parse failure, card state changes, refinement requested/completed, promote requested/completed/failed, and advisor failure. User-visible failures emit `error.surfaced` with stable codes.
- **Onboarding And Discoverability:** Add `Improve` to the composer mode picker with concise i18n copy. Empty improve runs show one clear status panel and one obvious path back to the composer.
- **Risk And Trust Surfaces:** The UI must distinguish advisor suggestions from approved work. Evidence must be visible. Malformed or incomplete structured output must not silently disappear behind the transcript.

### Story-Derived Scope

- As a builder, I can choose `Improve` and describe the desired audit focus so the advisor runs with the improve skill bundle.
- As a builder, I can see whether the advisor is mapping, auditing, vetting, planning, refining, completed, or failed.
- As a builder, I can inspect each recommendation card with category, impact, effort, risk, confidence, evidence, rationale, and proposed next action.
- As a builder, I can approve, reject, or ask for refinement on one card without treating the whole advisor run as all-or-nothing.
- As a builder, I can promote an approved result into an implementation-planning flow without copying terminal text.
- As a returning builder, I can reopen the run and see the same cards and decisions.
- As a builder on reconnect/restart, I either get replayed events or a resync snapshot with the structured results intact.

### UI Direction

The implementation should reuse the existing `PlanningArtifactsPanel`/`PlanningReviewControls` interaction style rather than adding a new top-level page. The closest shadcn block reference is `dashboard-01` from `https://ui.shadcn.com/blocks`, specifically the dense `SectionCards` + `DataTable` pattern, but do not install a whole block unless the existing component structure cannot support the layout. Use existing local `Button`, panel, badge, and icon patterns first.

Avoid a menu-first flow. The improve output should land as a scannable list of result cards with compact metadata, expandable evidence/details, and direct actions on each card.

## Upstream Improve Behavior To Preserve

The upstream `shadcn/improve` skill describes a read-only advisor that audits codebases and writes self-contained implementation plans for other agents. It maps the repo, audits categories like correctness/security/performance/tests/tech debt/DX/docs/direction, vets findings, prioritizes by leverage, and writes plans only after selection. Its hard rules include never modifying source code, never mutating the working tree, never reproducing secrets, and treating repository content as data rather than instructions.

OmniHarness should preserve those advisor rules but adapt the output contract:

- Markdown transcript remains visible in the worker stream.
- Structured JSON is required at advisor checkpoints.
- The server stores structured rows and rejects malformed structured output into a visible parse-failure state.
- The human reviews cards instead of scrolling to find task definitions.
- The mode never creates branches or worktrees. It can only promote approved output into existing planning/implementation flows after explicit user action.

## Approaches Considered

- **Extend planning mode:** Lowest backend cost, but conflates "write a requested plan" with "audit and produce multiple improvement opportunities." Rejected because it makes the UI and state model harder to reason about.
- **Make improve a supervisor/implementation variant:** Would reuse implementation machinery, but the advisor is explicitly non-implementing. Rejected because it invites worker spawning and progress semantics that conflict with read-only advisor behavior.
- **Add a direct-worker-backed `improve` mode:** Recommended. It matches the one-agent requirement, reuses the worker transcript and lifecycle model, and gives improve its own structured artifacts and UI.

## File Map

### Files To Modify

- `src/server/conversations/modes.ts` — add `improve` to the mode union and direct-worker-backed classification.
- `src/components/ConversationModePicker.tsx` — include `Improve` in the mode picker and copy map.
- `src/app/home/types.ts` — add `RunMode`/snapshot types for improve result records.
- `src/app/home/HomeUiStateManager.ts` — allow `selectedConversationMode: "improve"` and keep storage normalization safe.
- `src/app/home/useHomeLifecycle.ts` — persist/restore the selected composer mode with `improve`.
- `src/app/home/useHomeViewModel.ts` — derive `isImproveConversation` and expose improve records to the main conversation surface.
- `src/app/home/HomeApp.tsx` — pass improve state/actions into `ConversationMain`.
- `src/components/home/ConversationComposer.tsx` and `src/app/home/ComposerContainer.tsx` — mode-specific placeholder/steering behavior, without forcing implementation steering.
- `src/components/home/ConversationMain.tsx` — render the improve-results panel for improve runs.
- `src/server/conversations/create.ts` — launch improve as a direct-worker-backed advisor, using a dedicated prompt and skill roots.
- `src/server/conversations/send-message.ts` — run improve output processing after improve follow-up/refinement turns.
- `src/server/conversations/queued-messages.ts` — run improve output processing for queued improve refinements that later deliver.
- `src/server/prompts/improve.md` — new advisor prompt based on upstream improve semantics plus OmniHarness structured-output contract.
- `src/server/db/schema.ts` and `src/server/db/index.ts` — add improve result tables and migrations.
- `src/server/events/named-events.ts` — add improve event kinds and surfaced error codes.
- `src/server/events/persisted-snapshot.ts` — include improve rows in selected-run snapshots with scoped completeness metadata.
- `src/server/artifacts/stream-types.ts` and `src/server/artifacts/append-only-store.ts` — add an improve artifact stream kind and deterministic relative path.
- `src/server/improve/artifact-store.ts` — domain adapter for appending/hydrating long improve result bodies, modeled after `src/server/planning/review-artifact-store.ts`.
- `src/server/workers/entries-types.ts` and `src/server/workers/output-store.ts` only if a new worker entry type is truly required. Prefer not to add one; transcript content should remain ordinary worker output and structured rows should be separate artifacts.
- `src/server/improve/*` — create focused server modules for prompt building, post-turn processing, structured parsing, row persistence, card state mutations, promotion, and cleanup helpers.
- `src/app/api/improve/[id]/results/route.ts` or `src/runtime/http/routes/improve.ts` — card mutation/promote/refine endpoints, following existing runtime route patterns.
- `src/runtime/http/routes/index.ts` — register improve routes for non-Next surfaces.
- `src/components/ImproveResultsPanel.tsx` and `src/components/ImproveResultCard.tsx` — new UI surface for cards and actions.
- `shared/locales/*.json` — all user-facing labels, statuses, actions, aria labels, placeholders, errors, and empty states.
- `scripts/delete-conversations.sh` — delete improve rows and improve artifact files when clearing conversations.

### Tests To Add Or Update

- `tests/db/schema.test.ts` — assert new improve tables export correctly.
- `tests/api/events-route.test.ts` — snapshot includes improve results and scoped completeness for selected improve run.
- `tests/lifecycle/scenarios/session-types.test.ts` — add `improve` mode creation, run row, worker row, and `worker.spawned`.
- `tests/lifecycle/scenarios/improve-mode-flow.test.ts` — start improve, receive structured result events, reconnect/resync, mutate card state.
- `tests/server/improve/parser.test.ts` — structured extraction accepts valid output, rejects malformed output, preserves evidence, and redacts/omits secret-like values.
- `tests/server/improve/promote.test.ts` — approved result promotion creates/reuses planning artifacts without creating branches/worktrees.
- `tests/server/improve/post-turn-processing.test.ts` — initial, follow-up, queued, malformed, and stale refine output call the parser/store correctly.
- `tests/server/artifacts/append-only-store.test.ts` — improve stream kind resolves to the intended path and appends/hydrates deterministically.
- `tests/scripts/delete-conversations.test.ts` and `tests/api/conversations-route.test.ts` — improve rows/artifacts do not block deletion and are cleaned up.
- `tests/ui/improve-results-panel.test.tsx` — cards render metadata/actions from manager state and all visible copy comes through i18n.

### Candidate Agentic Journey Test

Requires explicit user approval before running in a browser:

- Mission: Start an `Improve` run, wait for a mocked structured finding, approve it, refine another card, and promote the approved one.
- Entry point: `http://localhost:3035`.
- Expected visible proof: mode picker shows `Improve`; result cards appear below the transcript; approved/rejected/refining statuses persist across reload; promoted card opens or creates the planning/implementation handoff.

## Data Model

Add tables rather than overloading `planningReview*`:

- `improve_runs`
  - `id`, `runId`, `status`, `focus`, `skillRootsJson`, `startedAt`, `completedAt`, `lastError`, timestamps.
- `improve_results`
  - `id`, `improveRunId`, `runId`, `clientId`, `version`, `kind`, `category`, `title`, `status`, `impact`, `effort`, `risk`, `confidence`, `priority`, `sourcePath`, `artifactSeq`, `detailsHash`, `detailsPreview`, `recommendationPreview`, `parentResultId`, `supersedesResultId`, `supersededByResultId`, `refinementRequestId`, `lastMutationId`, `promotedPlanId`, `promotedRunId`, `promotedAt`, timestamps.
- Artifact stream kind: `improve_results`
  - Extend `ArtifactStreamKind` and `streamRelativePath()` so long `details`, `evidence`, `fixSketch`, `planMarkdown`, `rejectionReason`, and `refinementPrompt` bodies live in `improve-results.jsonl`.
  - Use a domain adapter like `planning/review-artifact-store.ts`: reserve seq, append envelope, write DB row with previews/hashes, commit seq, hydrate bodies only on detail reads.

Statuses:

- Improve run: `starting`, `running`, `completed`, `failed`.
- Improve result: `proposed`, `approved`, `rejected`, `refining`, `refine_failed`, `superseded`, `promoted`.

Do not persist translated labels. Persist only stable ids/statuses and translate in React.

## Structured Output Contract

The advisor prompt must require fenced JSON blocks for machine-readable checkpoints:

```json
{
  "schema": "omniharness.improve.results.v1",
  "status": "partial|final",
  "phase": "recon|audit|vet|prioritize|plan",
  "results": [
    {
      "clientId": "CORRECTNESS-01",
      "kind": "finding|direction|plan_candidate|rejected",
      "category": "correctness|security|performance|tests|tech_debt|dependencies|dx|docs|direction",
      "title": "Short human label",
      "impact": "Concrete cost or user value",
      "effort": "S|M|L",
      "risk": "LOW|MED|HIGH",
      "confidence": "LOW|MED|HIGH",
      "priority": 1,
      "evidence": [{ "path": "src/example.ts", "line": 42, "summary": "What exists there" }],
      "details": "Short explanation",
      "recommendation": "What to do next",
      "planMarkdown": null
    }
  ]
}
```

Parser rules:

- Accept the latest valid `omniharness.improve.results.v1` block.
- Validate with `zod`.
- Never require the UI to parse freeform markdown.
- Treat a malformed `omniharness.improve.results.v1` fenced block as `improve.parse_failed` plus `error.surfaced`, but keep the transcript visible.
- Distinguish "no structured block yet" from "malformed structured block"; normal prose before a checkpoint is not a parse failure.
- Store secret-like evidence as location/type only. Do not store secret values if they appear in advisor output.
- Deduplicate by `(runId, clientId)` and preserve existing user decisions when a later partial update refines the same result.

## Output Processing Call Sites

Add one shared server helper:

```ts
processImproveWorkerOutput({
  runId,
  workerId,
  responseText,
  source,
  mutationId,
}: {
  runId: string;
  workerId: string;
  responseText: string;
  source: "initial" | "follow_up" | "queued_refine" | "refine";
  mutationId?: string;
})
```

It should:

- no-op unless the run mode is `improve`;
- parse and persist valid `omniharness.improve.results.v1` blocks;
- emit `improve.result_upserted` for every inserted/updated result;
- emit `improve.parse_failed` and `error.surfaced` for malformed structured output;
- preserve prior user decisions when a partial update changes result content;
- reject stale refinement responses whose `mutationId` no longer matches the card's `lastMutationId`.

Call it from every improve worker turn path:

- initial improve launch in `src/server/conversations/create.ts` after `runInitialWorkerTurn` returns;
- normal improve follow-up in `src/server/conversations/send-message.ts` after `continueWorkerConversation` receives a response;
- busy/steer path in `send-message.ts` when an improve turn is run synchronously;
- queued improve delivery in `src/server/conversations/queued-messages.ts` after `askAgent` resolves.

If a call path cannot access the response text without invasive changes, stop and refactor the worker-turn helper first. Do not add an independent transcript parser that tails JSONL.

## Client/Server State Invariants

- **Owner:** Server owns improve run/result rows. `ImproveResultsManager` owns the client snapshot projection and local UI expansion state only.
- **Token:** Every result mutation carries `runId`, `improveRunId`, and `resultId`; stale mutation responses must confirm the selected run still matches before changing visible selection.
- **Provenance:** Transcript is worker-produced evidence; structured result rows are server-validated projection; user decisions are server-authoritative after mutation success.
- **Completeness:** Snapshot payload must declare `improveResults.complete` for the selected run. Partial SSE events may add/update rows but cannot erase existing cards unless scoped complete.
- **Ordering:** Sort by `priority`, then `createdAt`, then `id`. Do not rely on timestamp-only ordering.
- **State Machine:** Result transitions are constrained: `proposed -> approved|rejected|refining`; `refining -> proposed|superseded|refine_failed`; `refine_failed -> proposed|rejected|refining`; `approved -> promoted`; no mutation from `promoted` back to proposed without a new result row.
- **Events:** Server decisions emit named events. The UI must not infer decisions by diffing snapshots.
- **Reconnect:** Use existing SSE `id:`/`Last-Event-ID`; if `stream.resync_required` fires, snapshot reload must restore improve rows.
- **Hot Path:** Snapshot rows carry previews and artifact cursors, not large plan/details bodies.

## Named Events

Add these to `src/server/events/named-events.ts`:

- `improve.started` `{ runId, improveRunId }`
- `improve.phase` `{ runId, improveRunId, phase }`
- `improve.result_upserted` `{ runId, improveRunId, resultId, status }`
- `improve.result_status_changed` `{ runId, improveRunId, resultId, prev, next }`
- `improve.refine_requested` `{ runId, improveRunId, resultId }`
- `improve.refine_finished` `{ runId, improveRunId, resultId, status }`
- `improve.promote_requested` `{ runId, improveRunId, resultId }`
- `improve.promote_finished` `{ runId, improveRunId, resultId, targetRunId, status }`
- `improve.promote_failed` `{ runId, improveRunId, resultId, reason }`
- `improve.parse_failed` `{ runId, improveRunId, reason }`
- `improve.finished` `{ runId, improveRunId, status }`

## Promotion Semantics

`Approve` only changes the improve card status. `Promote` creates a planning handoff; it does not start implementation directly.

Implement `promoteImproveResult({ runId, improveRunId, resultId })`:

- Require result status `approved`.
- Require a usable `planMarkdown` body in the result artifact. If the card is only a finding/direction with no plan body, create a planning conversation/run seeded with the result's recommendation and mark the card `promoted` only after that planning run is created.
- If `planMarkdown` exists, write it to `docs/superpowers/plans/YYYY-MM-DD-improve-<slug>.md` under the project root, create/update a `plans` row, create a `planning` run with `artifactPlanPath` and `plannerArtifactsJson` pointing at that file, and run the existing readiness pipeline against the file.
- Persist `promotedPlanId`, `promotedRunId`, and `promotedAt` on the improve result.
- Emit `improve.promote_requested` before mutation and `improve.promote_finished` or `improve.promote_failed` after.
- Never call `promotePlanningRun` directly on the improve run, because `src/server/planning/promote.ts` only accepts planning runs and verified plan files.
- Never create a branch, worktree, commit, or implementation run as part of promotion.

Add surfaced error codes:

- `improve.start_failed`
- `improve.parse_failed`
- `improve.refine_failed`
- `improve.promote_failed`
- `improve.mutation_stale`

## Implementation Tasks

- [ ] Add failing schema and parser tests.
  - Files: `tests/db/schema.test.ts`, `tests/server/improve/parser.test.ts`.
  - Verify: `pnpm test tests/db/schema.test.ts tests/server/improve/parser.test.ts` fails for missing improve schema/parser.

- [ ] Add improve DB tables and migration.
  - Files: `src/server/db/schema.ts`, `src/server/db/index.ts`.
  - Include cleanup behavior in existing delete-conversation paths if foreign-key cleanup is manual there.
  - Verify: `pnpm test tests/db/schema.test.ts`.

- [ ] Implement structured parser and artifact-backed persistence.
  - Files: `src/server/improve/parser.ts`, `src/server/improve/store.ts`, `src/server/improve/artifact-store.ts`, `src/server/improve/types.ts`, `src/server/artifacts/stream-types.ts`, `src/server/artifacts/append-only-store.ts`.
  - Use `zod`; keep large bodies in the `improve_results` artifact stream and bounded previews in SQLite/snapshots.
  - Verify: `pnpm test tests/server/improve/parser.test.ts tests/server/artifacts/append-only-store.test.ts`.

- [ ] Add improve prompt and launch wiring.
  - Files: `src/server/prompts/improve.md`, `src/server/conversations/modes.ts`, `src/server/conversations/create.ts`, `src/server/bridge-client/index.ts`, `src/server/agent-runtime/types.ts` only if request typing is incomplete.
  - Thread improve `skillRoots` explicitly through conversation creation into the direct-worker launch path. The current `spawnAgent` supports `skillRoots`, but normal direct conversation creation does not pass a mode-specific skill root.
  - Test that an improve conversation spawn request contains the configured improve skill root.
  - Do not create a branch or worktree.
  - Verify: `pnpm test tests/lifecycle/scenarios/session-types.test.ts`.

- [ ] Add shared improve post-turn output processing.
  - Files: `src/server/improve/process-output.ts`, `src/server/conversations/create.ts`, `src/server/conversations/send-message.ts`, `src/server/conversations/queued-messages.ts`.
  - Invoke `processImproveWorkerOutput` after initial, follow-up, synchronous steer, refine, and queued-refine improve turns.
  - Verify malformed output, valid partial output, valid final output, and stale mutation ids.
  - Verify: `pnpm test tests/server/improve/post-turn-processing.test.ts`.

- [ ] Add improve lifecycle events and surfaced errors.
  - Files: `src/server/events/named-events.ts`, improve server modules, tests.
  - Verify event transcript for start, result upsert, parse failure, finish, and surfaced errors.
  - Verify: `pnpm test tests/lifecycle/scenarios/improve-mode-flow.test.ts tests/server/events/*.test.ts`.

- [ ] Include improve records in snapshots.
  - Files: `src/server/events/persisted-snapshot.ts`, `src/app/home/types.ts`, `src/app/home/EventStreamSnapshotCacheManager.ts`.
  - Add scoped completeness metadata and deterministic merge behavior.
  - Verify: `pnpm test tests/api/events-route.test.ts`.

- [ ] Add card mutation and promotion routes.
  - Files: `src/runtime/http/routes/improve.ts`, `src/app/api/improve/[id]/results/route.ts` or equivalent Next route wrappers.
  - Actions: approve, reject, refine, promote.
  - Refine creates a `mutationId`, writes `lastMutationId`, transitions the card to `refining`, and sends a targeted prompt to the same advisor worker when available. If the worker is unavailable, transition to `refine_failed`, emit `improve.refine_finished` with failure status, and surface the error.
  - A successful refinement either updates the same card version or creates a new result row with `parentResultId`/`supersedesResultId`; stale responses must not overwrite a newer card state.
  - Promote uses `promoteImproveResult` exactly as defined in this plan. It creates a planning handoff, not implementation.
  - Verify: `pnpm test tests/server/improve/promote.test.ts tests/api/events-route.test.ts`.

- [ ] Add `ImproveResultsManager`.
  - Files: `src/app/home/ImproveResultsManager.ts`, `src/app/home/types.ts`, `src/app/home/HomeUiStateManager.ts`.
  - Keep server rows authoritative; local manager tracks expansion, selection, and pending mutation ids.
  - Verify stale mutation responses cannot update the wrong selected run.
  - Verify: add focused manager tests or include in UI tests.

- [ ] Add `Improve` to the composer and mode state.
  - Files: `src/components/ConversationModePicker.tsx`, `src/components/home/ConversationComposer.tsx`, `src/app/home/ComposerContainer.tsx`, `src/app/home/useHomeLifecycle.ts`, `shared/locales/*.json`.
  - All visible strings must use `t()` and exist in every locale file.
  - Verify: `pnpm test tests/ui/composer-shell.test.ts`.

- [ ] Build the improve results UI.
  - Files: `src/components/ImproveResultsPanel.tsx`, `src/components/ImproveResultCard.tsx`, `src/components/home/ConversationMain.tsx`, `shared/locales/*.json`.
  - Cards show title, category, impact, effort, risk, confidence, evidence count, status, and actions.
  - Expanded card shows evidence, details, recommendation, generated plan preview/link if present, and parse/failure context.
  - Avoid nested cards. Keep card radius at or below the project default. Use lucide icons for actions.
  - Verify: `pnpm test tests/ui/improve-results-panel.test.tsx`.

- [ ] Add lifecycle flow coverage.
  - Files: `tests/lifecycle/scenarios/improve-mode-flow.test.ts`.
  - Test: start improve, emit `improve.started`, parse one result, receive `improve.result_upserted`, drop SSE, resync, approve/reject/refine card, assert persisted row state.
  - Verify: `pnpm test:lifecycle -- tests/lifecycle/scenarios/improve-mode-flow.test.ts` if supported by the runner, otherwise `pnpm test tests/lifecycle/scenarios/improve-mode-flow.test.ts`.

- [ ] Add cleanup and deletion coverage.
  - Files: `scripts/delete-conversations.sh`, any API route/helper that deletes conversations, `tests/scripts/delete-conversations.test.ts`, `tests/api/conversations-route.test.ts`.
  - Delete improve result rows before deleting runs/plans where foreign keys require it.
  - Remove improve artifact files under both project-local and legacy run-data roots.
  - Verify no improve row or artifact can block conversation deletion.

- [ ] Run full targeted verification.
  - Commands:
    - `pnpm test tests/server/improve/parser.test.ts tests/server/improve/promote.test.ts`
    - `pnpm test tests/api/events-route.test.ts tests/ui/improve-results-panel.test.tsx tests/ui/composer-shell.test.ts`
    - `pnpm test:lifecycle`
    - `pnpm lint`
  - Expected: all commands exit 0. If lifecycle creates conversations/sessions, clean them up before finishing.

## STOP Conditions

Stop and report instead of improvising if:

- The improve skill bundle cannot be exposed through existing `skillRoots` support without changing CLI storage or installing dependencies.
- Implementing promotion requires branch or worktree creation. Branches are forbidden; worktrees require explicit user approval and are out of scope for this milestone.
- The advisor output can only be captured by brittle terminal scraping with no structured checkpoint. In that case, revise the prompt/contract first.
- Initial/follow-up improve output cannot be processed from explicit response objects without tailing worker JSONL.
- Snapshot hot paths require loading full markdown bodies for all cards.
- Existing dirty worktree changes conflict with a file in scope and it is unclear which behavior is current user intent.

## Acceptance Criteria

- `Improve` appears as a mode and launches exactly one advisor worker.
- The advisor run can expose the improve skill bundle through `skillRoots`.
- Improve mode never edits source code, creates branches, creates worktrees, deletes files, commits, or pushes.
- Structured findings/direction/plan candidates persist independently of the transcript.
- Initial output, follow-up output, queued refinement output, and malformed output all pass through the same improve post-turn processing helper.
- Cards render after reload/reconnect from server-authoritative state.
- Per-card approve/reject/refine/promote actions persist and emit named events.
- Promotion creates a planning handoff with persisted `promotedPlanId`, `promotedRunId`, and `promotedAt`; it does not call planning promotion on an improve run and does not start implementation.
- Parse failure and advisor failure are visible through `error.surfaced`.
- Conversation deletion and `scripts/delete-conversations.sh` remove improve rows and artifacts without FK failures.
- All user-facing strings live in every `shared/locales/*.json` file and render through `t()`.
- Lifecycle tests assert named events rather than deriving server decisions from DOM or snapshot diffs.
- No large advisor markdown bodies are shipped in the hot snapshot path.

## Human Review Notes

- Product choice to confirm before implementation: exact mode label. This plan uses `Improve` because it mirrors the upstream command and is shorter than `Audit`.
- Product choice to confirm before implementation: whether approving a card should create a planning run immediately or only mark it approved until the user clicks `Promote`. This plan uses explicit `Promote` to avoid surprising state changes.
- Product choice to confirm before implementation: whether to preinstall/reference `shadcn/improve` locally or require the user to configure the skill root. This plan assumes existing `skillRoots` support and a configured local skill path.
