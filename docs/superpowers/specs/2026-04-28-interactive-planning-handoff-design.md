# Interactive Planning Handoff Design

## Summary

Planning mode should be a hybrid workflow: the user starts in a direct, interactive CLI-agent conversation, then explicitly promotes a finalized plan into supervisor-managed implementation.

Today planning mode launches one planning worker and can detect handoff artifacts, but the product still feels too much like a batch run: the planner emits output, OmniHarness shows artifacts, and the user is implicitly nudged toward promotion. The redesigned model is:

- planning is direct control with planning-specific affordances,
- the planner can ask questions and receive follow-up answers across multiple turns,
- handoff readiness does not end the planning conversation,
- supervisor mode starts only after the user explicitly promotes a selected plan.

## Goals

- Make planning mode feel like an ongoing direct conversation with one CLI agent.
- Keep the composer active after planner responses, including after a valid handoff block appears.
- Let the planner ask clarifying questions and revise the spec or plan through repeated user turns.
- Treat handoff artifacts as promotable metadata, not as an automatic completion signal.
- Promote planning output into a new implementation conversation only after explicit user action.
- Preserve the planning conversation as readable source history after promotion.
- Reuse the direct-agent rendering model where possible, with planning-specific artifact and promotion controls.

## Non-Goals

- Auto-promoting a ready plan.
- Starting the supervisor during planning.
- Adding multi-agent planning review in this milestone.
- Building a full spec/plan editor with inline markdown editing.
- Introducing file-based routing.
- Creating branches or worktrees.

## Product Frame

### North Star Product

OmniHarness should let a builder move fluidly from rough intent to reviewed plan to supervised implementation without changing tools or losing context. Planning is not a preflight script; it is a collaborative conversation with an agent that can inspect the codebase, ask good questions, and leave behind durable artifacts that the supervisor can execute.

### Current Milestone

This milestone redesigns planning mode as an interactive direct-agent surface with a clear promotion gate. It does not add plan review agents or a dedicated markdown editor.

### Later Milestones

- Review a generated plan with a second agent before promotion.
- Compare multiple proposed implementation strategies.
- Show live diffs for spec and plan files created by the planner.
- Add explicit "request revision" templates for common planning feedback.
- Add a scriptable planning control plane for artifact inspection, promotion, and replay.

## User Stories

As a builder starting from rough intent, I want the planner to ask me questions before writing a final plan, so the plan reflects what I actually want.

As a builder reviewing a generated plan, I want to send follow-up instructions to the planning agent, so I can ask for revisions without starting over.

As a builder with a ready plan, I want a deliberate promotion action, so I know exactly when OmniHarness switches from direct planning to supervisor-managed implementation.

As a builder returning to an old planning conversation, I want to see whether it is still in discussion, ready to promote, or already promoted, so I can resume without guessing.

As a builder debugging a bad handoff, I want the planning conversation, selected spec, selected plan, and promoted implementation run linked together, so I can trace where decisions came from.

## Mode Model

Planning mode remains a persisted conversation mode, but its runtime semantics should change.

### Current Problem

Planning currently uses the same `runs.status` values as implementation. When the direct planning worker finishes a turn, the run can look `done`, even though the intended next state is often "waiting for the user."

### Desired Planning States

Planning conversations need interaction-oriented states:

- `starting`: the planning worker is being spawned.
- `working`: the planner is processing the latest user input.
- `awaiting_user`: the planner has responded and can receive more input.
- `ready`: at least one verified handoff plan is promotable, but the planner can still receive revisions.
- `promoting`: OmniHarness is creating the implementation run.
- `promoted`: an implementation run was created from this planning conversation.
- `failed`: the planning worker failed or the session cannot continue.

These can be represented either by extending `runs.status` or by deriving a planning status for the frontend from existing run, worker, and artifact fields. The key requirement is that `ready` is not terminal.

## UX Design

### Planning Surface

Planning mode should visually borrow from Direct Control, not Implementation mode.

The main planning surface should include:

- a compact planning status header,
- the user/planner transcript,
- the live planning agent surface,
- a planning artifact panel,
- the normal composer for continuing the conversation.

The implementation supervisor activity panel and multi-worker implementation chrome should not appear during planning.

### Layout

Recommended layout for desktop:

- Main column: transcript and live planner surface.
- Right or upper compact panel: detected artifacts and promotion action.
- Bottom composer: always available unless the planner is currently processing or the session failed.

Recommended layout for mobile:

- Transcript and live planner surface remain primary.
- Artifact panel appears inline above the latest planner surface or as a collapsible section.
- Promotion action remains visible inside the artifact panel, not hidden in global navigation.

### Composer Behavior

The composer should make the target obvious:

- No selected conversation: mode picker remains available.
- Planning selected: placeholder should be `Reply to planning agent...`.
- Direct selected: placeholder should be `Send to CLI...`.
- Implementation selected: placeholder should be `Ask supervisor...`.

For planning conversations:

- pressing send inserts a user message,
- sends the content to the existing planning worker,
- marks the planning conversation `working`,
- persists the planner response,
- refreshes artifact detection from the full planning transcript and worker output,
- then returns to `awaiting_user` or `ready`.

The user should be able to continue chatting after `ready`.

### Artifact Panel

The Planning artifacts panel should communicate that artifacts are reviewable and promotable, not that planning is complete.

It should show:

- selected spec path,
- selected plan path,
- source of detection (`handoff`, `output_text`, or future manual selection),
- readiness status,
- first readiness gap when blocked,
- promotion target,
- link to promoted implementation conversation when already promoted.

The primary action should be labeled `Start implementation from selected plan`.

If the planner has emitted a valid handoff:

- show the handoff plan as selected,
- hide unrelated transcript candidates when a handoff candidate exists,
- keep the composer enabled.

If the planner emits a later handoff after revisions:

- replace the selected handoff candidate with the latest handoff,
- keep earlier candidate data available only if needed for debug metadata.

### Promotion

Promotion is explicit. When the user clicks `Start implementation from selected plan`:

- validate that the selected plan exists,
- run plan parsing and readiness checks,
- create a new implementation run,
- link the implementation run to the source planning run,
- mark the planning conversation as `promoted`,
- keep the planning conversation in history,
- navigate to the new implementation run.

Promotion should not delete, mutate, or reuse the planning run as the implementation run.

### Copy

Planning mode copy should avoid implying the user is done.

Preferred language:

- `Planning agent`
- `Ready to implement`
- `Continue revising or start implementation`
- `Start implementation from selected plan`
- `Promoted to implementation`

Avoid:

- `Done`
- `Final`
- `Complete`
- `Supervisor`

## Backend Design

### Conversation Creation

Planning creation should continue to:

- create a planning conversation record,
- create one worker record,
- spawn one direct worker,
- send the planner system prompt plus the initial user request,
- avoid `startSupervisorRun`.

The initial response should be treated as the first interactive planner turn, not the whole planning lifecycle.

### Conversation Messages

`POST /api/conversations/:id/messages` should be mode-aware:

- implementation: insert checkpoint, start supervisor run.
- direct: send user input to direct worker.
- planning: send user input to planning worker, refresh planning artifacts, derive planning status.

Planning follow-up messages should use the same bridge worker created at planning launch. They should not spawn a new planner.

### Artifact Refresh

Artifact collection should run after every planning worker response.

Inputs should include:

- persisted user and worker messages,
- live worker output entries,
- current text and last text,
- rendered bridge output.

If an explicit handoff exists, it is authoritative for the primary selected spec and plan. Transcript path scanning can remain a fallback when no handoff exists.

### Status Derivation

After a planner response:

- if the worker errored, mark planning `failed`,
- if a verified handoff plan exists, mark planning `ready`,
- otherwise mark planning `awaiting_user`.

During an active `askAgent` call:

- mark planning `working`.

After promotion:

- mark planning `promoted`,
- persist the promoted implementation run id if a schema addition is accepted,
- otherwise derive the link from `parentRunId`.

### Traceability

Promotion should preserve links between:

- source planning run id,
- selected spec path,
- selected plan path,
- promoted implementation run id,
- original user request,
- planner transcript.

The existing `parentRunId` field can represent the source planning run for implementation runs. If the UI needs reverse lookup without scanning, add `promotedRunId` or equivalent metadata to the planning run in a later schema slice.

## Frontend Design

### Shared Direct Agent Surface

Planning and Direct Control should share direct-agent rendering primitives, but planning should add:

- artifact panel,
- planning status language,
- promotion action,
- optional spec/plan handoff summary.

Implementation mode should keep the existing supervisor-centered feed and worker cards.

### Conversation Main

`ConversationMain` should split mode rendering more explicitly:

- `ImplementationConversationMain`
- `DirectConversationMain`
- `PlanningConversationMain`

This prevents planning from inheriting implementation-specific affordances by accident.

If a full split is too large for the first implementation pass, extract at least a focused `PlanningConversationMain` component so planning behavior can evolve without crowding the current file.

### Composer

`ConversationComposer` should accept mode-aware copy and disabled states:

- disable while a planning `askAgent` call is in flight,
- keep enabled in `awaiting_user` and `ready`,
- show promotion as separate from sending a message.

The selected CLI agent controls should remain locked to the planner's original worker once a planning conversation exists.

## Persistence

No user preference changes are required.

Planning conversation state is durable through existing database records:

- `runs.mode`
- `runs.status`
- `runs.specPath`
- `runs.artifactPlanPath`
- `runs.plannerArtifactsJson`
- `runs.parentRunId` on promoted implementation runs
- `workers`
- `messages`

Potential schema extension:

- `runs.promotedRunId` for direct reverse linking from planning to implementation.

This extension is useful but not mandatory if the UI can derive the link from implementation runs whose `parentRunId` equals the planning run id.

## Error Handling

Planning worker unavailable:

- fail launch with a clear worker setup error,
- do not create a misleading ready state.

Planning worker fails mid-conversation:

- preserve the transcript,
- show the worker failure,
- disable message sending if the bridge session cannot continue,
- keep existing artifact data visible if any was found.

Artifact ambiguity:

- when no explicit handoff exists, show multiple candidates with source and readiness.
- when explicit handoff exists, prefer it and hide unrelated plan candidates in the primary UI.

Promotion failure:

- keep the user in the planning conversation,
- show the backend error details,
- preserve the selected plan path,
- allow retry after correction.

## PM Pass

### Primary User

The primary user is the human builder using OmniHarness to turn rough product or codebase intent into an executable implementation plan.

### Supporting Jobs

- Decide whether planning is still in discussion or ready for implementation.
- Answer the planner's questions.
- Ask the planner to revise artifacts.
- Inspect generated artifact paths.
- Promote the right plan without losing the planning transcript.
- Return later and understand what happened.

### State Model

The planning state model is interaction-focused: `starting`, `working`, `awaiting_user`, `ready`, `promoting`, `promoted`, `failed`.

### Operational Readiness

The backend should log or persist enough state transitions to debug:

- planner launch,
- user follow-up,
- worker response,
- artifact refresh,
- promotion attempt,
- promotion success or failure.

### Control Plane

Existing API endpoints should remain sufficient for v1, but they should expose enough state through the event stream for tests and future scripts to inspect planning readiness without relying on visual UI only.

### Error Transparency

Worker, artifact, and promotion errors should preserve real details in the UI rather than collapsing to generic failures.

### Trust Surfaces

The riskiest trust surface is accidentally implementing the wrong plan. The UI must show the selected plan path at the promotion action and keep promotion explicit.

## Product Completeness Pass

### Primary Journey

1. User chooses `Create plan`.
2. User enters a rough request.
3. OmniHarness opens a planning conversation with one CLI agent.
4. Planner inspects the repo and either asks questions or writes draft artifacts.
5. User answers and asks for revisions as needed.
6. Planner emits a handoff block.
7. OmniHarness shows the selected spec and plan as ready.
8. User either continues revising or starts implementation.
9. Promotion creates a new implementation conversation.

### Return Journey

When the user reopens a planning conversation, OmniHarness should show:

- latest planning status,
- latest transcript,
- current artifact selection,
- whether it has been promoted.

### Failure Journey

If the planner fails, the user should still see:

- previous transcript,
- any detected artifacts,
- the failure details,
- whether promotion is still possible from an already verified plan.

### Mutation Journey

After a ready handoff, a user can send another message. The planner may update the spec or plan and emit a new handoff. OmniHarness should refresh the artifact panel and promotion target.

### Status-Awareness Journey

The user should always be able to tell whether OmniHarness is:

- waiting on the planner,
- waiting on the user,
- ready to promote,
- promoting,
- already promoted,
- failed.

## Testing Strategy

### Backend Tests

- Planning conversation creation does not call `startSupervisorRun`.
- Planning follow-up message sends input to the existing planning worker.
- Planning follow-up transitions to `working` during the request and then `awaiting_user` or `ready`.
- Artifact detection refreshes after a follow-up planner response.
- A later handoff supersedes earlier handoff metadata.
- Promotion creates a new implementation run with `parentRunId` set to the planning run.
- Promotion leaves the planning run readable and marks or derives it as promoted.

### Frontend Source Tests

- Planning mode composer placeholder targets the planning agent.
- Planning ready state keeps the composer available.
- Planning artifact panel labels the action as `Start implementation from selected plan`.
- Planning mode does not render supervisor activity controls.
- Planning mode renders direct-agent surface plus artifact panel.

### Candidate Agentic User Journey Test

With user approval, run a browser journey:

- start a planning conversation,
- answer a planner question,
- observe artifact readiness,
- send a revision after readiness,
- verify the artifact panel updates,
- promote to implementation,
- verify the new implementation run opens and the planning run remains in history.

## Acceptance Criteria

- Planning mode behaves as an interactive direct-agent conversation.
- The user can send multiple follow-up messages to the same planning worker.
- A ready handoff does not disable or hide the composer.
- The artifact panel shows the selected plan and keeps promotion explicit.
- Promotion creates a separate implementation run and links it to the planning run.
- The supervisor never runs during planning.
- Implementation mode behavior remains unchanged after promotion.
- Direct Control mode remains unchanged except for any shared component improvements.
