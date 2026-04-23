# Conversation Modes Design

## Summary

OmniHarness currently behaves like a single conversation mode with one strong opinionated flow: start a run, immediately start the supervisor, and let that supervisor orchestrate worker CLIs against a plan or ad hoc request. That maps well to implementation work once a usable plan already exists, but it does not cleanly serve two adjacent use cases:

- starting from a rough request and creating a spec and implementation plan from scratch,
- using a single remote CLI directly as a full-surface control session without supervisor orchestration.

This design introduces three explicit conversation modes:

- `Implementation mode`: the existing supervised multi-agent implementation workflow,
- `Planning mode`: one direct planning CLI works with the user until a spec and plan are ready, then the user promotes that output into implementation,
- `Direct mode`: one direct worker session is proxied to the frontend as the primary surface, without supervisor intervention.

The key architectural decision is to keep the supervisor narrow. The supervisor should only take over once an implementation plan is ready. Planning and direct-control sessions should not be supervised in v1.

## Goals

- Make conversation mode an explicit part of conversation creation, state, and rendering.
- Preserve the current implementation-mode behavior as one mode instead of the global default for all conversations.
- Support planning from scratch using a single external CLI that can inspect the repo, ask clarifying questions, and write spec and plan files.
- Support direct remote control of a single CLI worker with a full-surface UI.
- Separate agent-output rendering from the surrounding conversation layout so the same worker output can appear either:
  - as inline cards in implementation mode, or
  - as the entire main surface in direct mode.
- Let the system identify candidate spec/plan files from planner output well enough to support a promotion flow.
- Keep room for a v2 planning-review loop where other agents can inspect the produced plan before the user promotes it.

## Non-Goals

- Making the implementation supervisor responsible for writing specs or plans.
- Auto-promoting planning sessions into implementation without an explicit user action.
- Solving every future planner-review workflow in v1.
- Rebuilding provider-specific remote TUIs inside OmniHarness; direct mode should proxy the existing agent surface and metadata, not emulate every native UI detail.
- Introducing file-based routing.

## Product View

### User Stories

As a builder, I want to choose whether I am:

- creating a plan from scratch,
- implementing an existing plan,
- or directly controlling a single remote coding CLI,

so the product matches the job I am trying to do instead of forcing every conversation through the implementation supervisor.

As a builder using planning mode, I want one CLI to help me inspect the repo, ask clarifying questions, and write the spec and plan files, so I can stay in one coherent conversation until I decide the plan is ready.

As a builder using direct mode, I want a remote Codex, Claude Code, Gemini, or OpenCode session to take over the full surface, so OmniHarness feels like a remote terminal and control shell rather than a supervisor dashboard.

As a builder using implementation mode, I want the existing supervisor-first orchestration flow to remain available once I already have a plan or want supervised execution.

### Mode Definitions

#### Implementation mode

Implementation mode is the current OmniHarness behavior:

- a run starts from an existing plan path or ad hoc implementation request,
- a supervisor owns the control loop,
- the supervisor may spawn and manage one or more workers,
- the main conversation feed shows user, supervisor, worker, and system messages,
- worker cards appear as supporting detail alongside the message feed.

#### Planning mode

Planning mode is a single-worker planning flow:

- the conversation launches one external CLI directly,
- no supervisor loop runs during planning,
- the user and planner interact through the conversation,
- the planner may inspect the repo and write spec and plan files,
- the user later clicks an explicit action to promote the planning result into implementation mode.

#### Direct mode

Direct mode is a single-worker control surface:

- the conversation launches one external CLI directly,
- no supervisor loop runs,
- the worker output becomes the main conversation surface,
- the conversation behaves like a remote coding-agent session rather than a supervisor log,
- only one worker type is relevant for the session, so multi-worker controls are removed.

## Current Problems

- The current run-creation path in [src/app/api/supervisor/route.ts](/Users/masterman/NLP/omniharness/src/app/api/supervisor/route.ts) immediately creates an ad hoc plan file and starts the supervisor.
- The current supervisor prompt in [src/server/prompts/supervisor.md](/Users/masterman/NLP/omniharness/src/server/prompts/supervisor.md) is implementation-oriented, not planning-oriented.
- The current main UI in [src/app/page.tsx](/Users/masterman/NLP/omniharness/src/app/page.tsx) assumes a conversation feed plus supporting worker cards rather than multiple surface modes.
- Worker selection in the composer currently assumes the user is configuring a supervised conversation, not selecting a fixed direct-control runtime.
- The system has no durable concept of conversation mode, planning-session readiness, or plan-promotion metadata.

## Design

### Core Model

Every conversation must have an explicit mode:

- `implementation`
- `planning`
- `direct`

This mode becomes part of persisted conversation state and drives:

- backend launch behavior,
- run or session state transitions,
- frontend rendering,
- available controls,
- handoff options.

### Recommended Architecture

Use one conceptual conversation shell with two execution engines:

- `supervised execution engine` for implementation mode,
- `direct worker engine` for planning and direct modes.

The architecture should not try to shoehorn planning into the implementation supervisor.

### State Model

#### Implementation conversations

Implementation conversations continue to use the existing `plans` plus `runs` model, with the addition of a persisted mode field so the UI can render them explicitly as implementation conversations.

#### Planning conversations

Planning should use a separate planning-session concept rather than overloading implementation runs.

A planning session should store at least:

- `id`
- `mode = planning`
- `projectPath`
- `title`
- `status = planning | awaiting_user | ready | failed`
- `workerId`
- `workerType`
- `requestedModel`
- `requestedEffort`
- `sourcePrompt`
- `specPath` nullable
- `planPath` nullable
- `candidateArtifactsJson`
- `createdAt`
- `updatedAt`

The most important stored planning metadata is the planner artifact set:

- last known spec path,
- last known plan path,
- candidate files with confidence and evidence,
- latest readiness assessment for the candidate plan.

#### Direct conversations

Direct conversations should store a lightweight direct-session record, or a generic conversation/session record with `mode = direct`, containing:

- `id`
- `mode = direct`
- `projectPath`
- `title`
- `status = running | completed | failed`
- `workerId`
- `workerType`
- `requestedModel`
- `requestedEffort`
- `createdAt`
- `updatedAt`

The direct conversation does not own a plan and does not create a supervisor run.

## Launch Flows

### New conversation composer

The new-conversation surface should add an explicit mode picker above the command input using a `shadcn/ui` single-select horizontal control such as tabs or a segmented toggle.

The control should present:

- `Create plan`
- `Implement plan`
- `Direct control`

Directly below the picker, show a short description for the selected mode:

- `Create plan`: Work directly with one CLI to inspect the repo, ask questions, and write a spec and plan before implementation.
- `Implement plan`: Start a supervisor-managed implementation run for an existing plan or implementation request.
- `Direct control`: Open one remote CLI session and use OmniHarness as a direct control surface.

### Mode-specific launch behavior

#### Create plan

When the user starts a planning conversation:

- create a planning-session record,
- spawn one direct worker through the bridge,
- send the planning prompt and user request directly to that worker,
- do not call `startSupervisorRun`.

#### Implement plan

When the user starts an implementation conversation:

- preserve the current run-start behavior,
- create the plan and run records,
- start the supervisor,
- render the conversation in implementation layout.

#### Direct control

When the user starts a direct conversation:

- create a direct-session record,
- spawn exactly one worker,
- send the user request directly to that worker,
- do not start the supervisor,
- render the worker output as the main surface.

## Planner Behavior

### Planner prompt contract

Planning mode should use a dedicated planner prompt that instructs the single CLI to:

- inspect the repo before proposing architecture,
- ask clarifying questions when needed,
- write a spec file,
- write an implementation plan file,
- report where those files were saved,
- stop short of implementation.

The planner should be allowed to revise the spec and plan files as the user answers questions.

### Planning conversation behavior

Planning mode should feel like a normal conversation with one intelligent CLI, not like a supervisor audit log.

The planner may:

- read the repo,
- propose options,
- ask questions,
- write files,
- revise files,
- summarize progress.

The planner should not:

- automatically start implementation,
- spawn additional workers in v1,
- present itself as a supervisor.

## Planner Artifact Detection

Planner-to-implementation handoff depends on identifying the files the planner created. This is the hardest new contract in v1 and should be explicit rather than magical.

### Artifact tracking strategy

Use a layered approach:

#### 1. Explicit worker output parsing

Inspect direct worker output entries and textual output for explicit file-save signals, such as:

- markdown links or raw file paths,
- phrases like `wrote`, `saved`, `created`, `updated`, `spec`, `plan`,
- structured output entries when the bridge exposes them.

This should produce candidate artifact records with:

- `path`
- `kind = spec | plan | unknown`
- `source = output_text | output_entry | filesystem_scan | user_selected`
- `confidence`
- `evidence`

#### 2. Filesystem validation

When a candidate file path is found:

- resolve it against the session project root when needed,
- verify that the file exists,
- read enough of it to infer whether it is likely a spec or plan,
- for plan candidates, run the existing parser and readiness checks.

#### 3. Artifact inference from known conventions

If explicit output parsing is inconclusive, scan likely planning directories and recent markdown writes, prioritizing:

- `docs/superpowers/specs/`
- `docs/superpowers/plans/`
- `vibes/`

The scan should prefer files modified during the planning session lifetime and should never silently guess a promotion target without surfacing the confidence level.

### Candidate artifact UX

The planning UI should show a compact "Planning artifacts" panel containing:

- detected spec file,
- detected plan file,
- confidence badge,
- source of detection,
- readiness status,
- a manual override action if detection is wrong.

This makes the handoff two-way:

- the backend tries to understand the planner output,
- the user can correct or confirm that understanding.

### Promotion gate

The `Promote to implementation` action should remain disabled until there is at least one candidate plan file that:

- exists,
- parses into checklist items,
- passes a minimum readiness threshold,
- or is explicitly user-confirmed despite warnings.

Promotion should prefer a verified plan file over a merely mentioned one.

## Promotion To Implementation

Promotion is a distinct user action, not an automatic state change.

When the user promotes a planning session:

- create the implementation `plans` record from the chosen plan file,
- create the implementation `runs` record with `mode = implementation`,
- persist the source planning session id for traceability,
- optionally carry over the original request and selected planning artifacts,
- start the supervisor,
- leave the planning session readable for audit/history.

The promoted implementation run should not reuse the planning session as if it were already a supervisor run. It should start as a new execution-stage object with a clean implementation lifecycle.

## Direct Mode Design

### Surface behavior

Direct mode should render the single worker as the primary surface. The UI should feel like:

- a remote coding session,
- a full-height primary terminal and activity surface,
- minimal surrounding orchestration chrome.

The main pane should prioritize:

- live worker output,
- worker metadata,
- permission prompts,
- direct user input to the worker.

The standard implementation conversation feed should not be the primary visual metaphor in direct mode.

### Control behavior

In direct mode:

- remove the composer dropdown that selects among multiple worker types,
- treat the selected worker type as fixed for the session,
- keep model and effort controls only if that provider supports changing them for the initial launch,
- remove implementation-specific sidebars and language that imply supervision,
- keep worker restart or reconnect controls if useful.

## Shared Agent Rendering

The frontend should separate agent-output rendering from conversation framing.

### New rendering split

Create a shared agent-surface layer that can render:

- worker output,
- session metadata,
- pending permissions,
- status,
- terminal or tool-call activity,
- input composer for the direct worker.

Then compose it differently by mode:

- `implementation`: conversation feed remains primary, worker surfaces appear as cards or side panels,
- `planning`: conversation feed remains primary, but only one worker is shown and planning-artifact UI is added,
- `direct`: the worker surface becomes the full primary pane.

This separation should eliminate the current assumption in [src/app/page.tsx](/Users/masterman/NLP/omniharness/src/app/page.tsx) that worker output always lives in the lower "CLI Agents" section.

## Backend Contract

### Conversation mode persistence

Persist mode at the conversation/session level so the frontend can restore the correct view after reload.

### Session launch APIs

Split the current one-size-fits-all conversation launch route into mode-aware launches:

- implementation launch,
- planning launch,
- direct launch.

This can be done via separate endpoints or a single mode-aware endpoint, but the runtime behavior must be mode-specific.

### Direct worker observation

Planning and direct modes need direct worker polling without going through supervisor context assembly.

The bridge-backed agent observation model should expose enough detail to render:

- live output entries,
- rendered output,
- pending permissions,
- effective worker settings,
- recent stderr,
- stop reason.

## V2 Direction: Plan Review And Multi-Agent Feedback

Planning mode should leave room for a future review pass where the user can ask OmniHarness to:

- validate the plan with another agent,
- compare two implementation strategies,
- run a readiness review using other workers,
- present summarized review feedback before promotion.

To support that future state, planning artifacts should already be first-class persisted records rather than ephemeral regex matches in UI code.

V1 does not need to launch those reviewers automatically, but the artifact model should not block that future direction.

## Error Handling

### Planning mode

- If the planner never writes or reports a plan file, keep the session in `planning` and show that no promotion target is ready.
- If candidate-path detection is ambiguous, show multiple candidates rather than silently picking one.
- If a detected plan file fails readiness checks, show the gaps and keep promotion blocked unless the user explicitly overrides.

### Direct mode

- If the direct worker fails or disconnects, surface that as a direct-session error rather than a run failure owned by the supervisor.
- If the worker type is unavailable, fail conversation launch with a clear error before opening the session.

### Implementation mode

Existing implementation failure handling should remain unchanged except where mode-awareness is needed for rendering.

## Testing

- API test proving conversation mode is persisted at launch time.
- API test proving planning mode does not call `startSupervisorRun`.
- API test proving direct mode does not call `startSupervisorRun`.
- API test proving implementation mode still does call `startSupervisorRun`.
- Planning artifact detection tests for:
  - explicit path in output,
  - relative path in output,
  - ambiguous multiple candidates,
  - missing file,
  - plan readiness failure.
- Promotion test proving a planning session can create a new implementation run from a detected plan.
- UI source test for the new mode picker and its mode descriptions.
- UI source test proving direct mode hides the worker-type dropdown.
- UI source test proving the direct worker surface can render as the primary pane.
- UI test proving implementation mode still renders the conversation feed plus worker support surfaces.

## Acceptance Criteria

- A new conversation can be started in `Create plan`, `Implement plan`, or `Direct control` mode.
- Each mode shows a clear explanation before launch.
- Planning mode uses one direct CLI and does not start the implementation supervisor.
- Direct mode uses one direct CLI and does not start the implementation supervisor.
- Implementation mode preserves the current supervisor-managed behavior.
- Planning mode can detect, display, and validate candidate spec and plan files from planner output.
- The user can explicitly promote a planning result into implementation mode once a plan is ready.
- Direct mode renders the single worker as the main surface and does not show multi-worker implementation controls.
- Agent rendering is reusable across inline-card and full-surface contexts.
