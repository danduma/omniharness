# Conversation Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit `planning`, `implementation`, and `direct` conversation modes, with planning and direct sessions running a single CLI directly, a verified planner-to-supervisor handoff, and a mode-aware UI that can render agent output either inline or as the primary surface.

**Architecture:** Introduce a top-level conversation/session model that persists mode and project root, then layer specialized execution records under it: implementation runs remain supervisor-owned, while planning and direct sessions own exactly one bridge worker plus mode-specific metadata. Standardize planning handoff through a planner prompt contract, explicit artifact detection, and a user-confirmed promotion flow that creates a fresh implementation run only after the selected plan file is verified against the current `cwd`.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Drizzle ORM with SQLite, TanStack Query, shadcn/ui, bridge-backed external CLI workers.

**North Star Product:** OmniHarness becomes a mode-aware remote software-delivery workspace where users can brainstorm and write plans, supervise implementation, or directly control a single remote coding CLI without switching tools or losing continuity.

**Current Milestone:** Ship the first three conversation modes end-to-end, including mode selection, planning-session artifact detection and promotion, direct-mode full-surface rendering, and backward-compatible implementation mode.

**Later Milestones / Deferred But Intentional:** Planner review by other agents, richer provider-specific direct-mode affordances, planner artifact confidence explanations in the UI timeline, cross-mode conversion beyond planning-to-implementation, and deeper direct-session replay/export tooling.

---

## File Map

### Files to create

- `src/server/prompts/planner.md`
  Planning-mode prompt with the standardized planner handoff contract, standard save-location guidance, and explicit `cwd` rules.
- `src/server/conversations/create.ts`
  Shared creation logic for launching mode-specific conversations from one backend entrypoint.
- `src/server/conversations/modes.ts`
  Shared mode constants, labels, and validation helpers used by API and frontend.
- `src/server/planning/artifacts.ts`
  Planner artifact extraction, path normalization relative to `cwd`, file validation, and readiness assessment.
- `src/server/planning/promote.ts`
  Promotion logic that creates a fresh implementation plan/run from a verified planning session.
- `src/components/ConversationModePicker.tsx`
  Reusable shadcn/ui-backed mode selector with inline mode descriptions.
- `src/components/AgentSurface.tsx`
  Shared worker output/status/permission surface reusable for inline cards and full-surface direct mode.
- `src/components/PlanningArtifactsPanel.tsx`
  Planning-mode panel showing detected spec/plan files, confidence, readiness, and promotion controls.
- `tests/server/planning/artifacts.test.ts`
  Detection and readiness tests for explicit handoff blocks, relative paths, ambiguity, and missing files.
- `tests/api/conversations-route.test.ts`
  Launch-path tests for all three modes.
- `tests/api/planning-promote-route.test.ts`
  Promotion tests proving planning sessions become fresh implementation runs only after verification.

### Files to modify

- `src/server/db/schema.ts`
  Add conversation/session persistence for mode and project-root-aware planning/direct records.
- `src/server/db/index.ts`
  Add SQLite table creation/migration logic for the new conversation and planning/direct session tables and columns.
- `src/app/api/events/route.ts`
  Stream mode-aware conversation/session data, planning artifacts, and direct-session state alongside existing runs.
- `src/app/api/supervisor/route.ts`
  Preserve implementation-mode launch behavior or convert it into a compatibility shim that delegates to the new mode-aware creation path.
- `src/app/page.tsx`
  Refactor the main shell around a selected conversation/session instead of assuming every conversation is a supervisor run.
- `src/lib/conversations.ts`
  Group and label mixed-mode conversations in the sidebar.
- `src/lib/project-scope.ts`
  Resolve active project scope for implementation runs, planning sessions, and direct sessions.
- `src/server/bridge-client/index.ts`
  Reuse direct worker spawn/ask/get primitives and expose any additional worker-session fields needed by planning/direct mode UI.
- `src/app/api/runs/[id]/route.ts`
  Keep implementation-only recovery/delete logic correct once mode-aware conversations exist and avoid deleting planning/direct records through the wrong path.
- `tests/api/run-route.test.ts`
  Update implementation-mode tests if `/api/supervisor` becomes a delegating compatibility path.
- `tests/ui/sidebar-layout.test.ts`
  Update composer and layout expectations for the new mode picker and direct-mode UI.
- `tests/lib/conversations.test.ts`
  Cover sidebar grouping with mixed-mode conversations.

### Tests to add or update

- `tests/db/schema.test.ts`
  Assert new conversation/session tables or columns exist.
- `tests/api/conversations-route.test.ts`
  TDD the mode-specific launch contract before implementing it.
- `tests/api/planning-promote-route.test.ts`
  TDD the planning-to-implementation handoff.
- `tests/server/planning/artifacts.test.ts`
  TDD the parser and `cwd`-relative resolution logic.
- `tests/ui/sidebar-layout.test.ts`
  Verify mode picker, descriptions, and direct-mode worker selector removal.
- `tests/lib/conversations.test.ts`
  Verify sidebar grouping and labels for mixed conversation modes.

## Task Plan

- [x] Add a durable mode-aware conversation/session data model in `src/server/db/schema.ts` and `src/server/db/index.ts`.
  Create the minimal persisted shape needed to list, select, and restore three conversation modes without overloading implementation runs. The model must persist the conversation mode, title, status, `projectPath`, and enough child records to represent planning sessions and direct sessions separately from supervisor-owned implementation runs.
  Verification:
  - Add `tests/db/schema.test.ts` coverage for the new tables/columns.
  - Add a migration test or schema bootstrap assertion proving existing databases upgrade cleanly.

- [x] Introduce a single mode-aware launch path in `src/server/conversations/create.ts` and expose it through a new API entrypoint such as `src/app/api/conversations/route.ts`.
  The launch contract should accept `mode`, `command`, `projectPath`, selected worker settings, and attachments. Implementation mode must preserve the current supervisor startup path. Planning and direct modes must spawn exactly one worker directly through `spawnAgent`/`askAgent`, must persist the worker `cwd`, and must not call `startSupervisorRun`.
  Verification:
  - Write `tests/api/conversations-route.test.ts` first, covering `implementation`, `planning`, and `direct`.
  - Prove only implementation mode triggers supervisor startup.

- [x] Standardize planning-mode behavior with a dedicated planner prompt in `src/server/prompts/planner.md`.
  The prompt must instruct the planning CLI to inspect the repo first, write the spec and plan in standard locations when possible, emit a final OmniHarness handoff block, and treat all relative file paths as relative to the launched `cwd`. Keep the handoff format text-based and easy to parse reliably across providers.
  Verification:
  - Add a prompt test asserting the planner prompt contains the handoff block contract, the no-implementation rule, and the `cwd` rule.

- [x] Build planner artifact detection and verification in `src/server/planning/artifacts.ts`.
  Parse explicit handoff blocks from direct worker output first, then fall back to path extraction and filesystem validation. Normalize relative paths against the persisted worker `cwd`, verify existence, infer artifact kind, and run `parsePlan` plus `assessPlanReadiness` on candidate plan files. Persist candidate artifacts with confidence, source, and evidence instead of a single guessed answer.
  Verification:
  - TDD `tests/server/planning/artifacts.test.ts` for:
    - explicit handoff block with absolute paths,
    - relative paths resolved against `cwd`,
    - ambiguous multiple candidates,
    - missing files,
    - plan readiness failures.

- [x] Implement planning-session promotion in `src/server/planning/promote.ts` and a route such as `src/app/api/planning/[id]/promote/route.ts`.
  Promotion must remain an explicit user action. It should accept a selected candidate plan, verify it again, create a fresh implementation `plans` row and `runs` row tied to the same project root, seed the implementation conversation from the planning result, and only then start the supervisor. Planning sessions should remain readable after promotion for traceability.
  Verification:
  - Write `tests/api/planning-promote-route.test.ts` first.
  - Prove promotion is blocked without a verified plan or an explicit user override path.

- [x] Extend the event stream and frontend state model in `src/app/api/events/route.ts`, `src/lib/conversations.ts`, and `src/lib/project-scope.ts`.
  The event payload must stream mixed conversation/session records, planning artifacts, and direct-session worker state without assuming everything is a `run`. Sidebar grouping should still work by project, and project-scope resolution must prefer the persisted conversation/session `projectPath` rather than inferred plan paths. This is where the `cwd`/project-root guarantee needs to become visible to the UI.
  Verification:
  - Add or update `tests/lib/conversations.test.ts` and `tests/lib/project-scope.test.ts` for mixed implementation/planning/direct data.

- [x] Refactor the composer and conversation shell in `src/app/page.tsx` around a selected conversation mode instead of a selected run.
  Add a `shadcn/ui` horizontal mode picker with descriptions directly beneath it. Preserve implementation-mode controls, but in direct mode remove the worker-type dropdown and lock the session to the preselected worker. Keep model/effort selection only when it applies to the chosen mode. The selected conversation route and title area should surface the active mode and project root clearly.
  Verification:
  - Update `tests/ui/sidebar-layout.test.ts` first to require the mode picker and descriptions.
  - Add a UI source assertion that direct mode no longer renders the multi-worker agent dropdown.

- [x] Split worker rendering out of `src/app/page.tsx` into a reusable `src/components/AgentSurface.tsx`.
  Move worker status, permissions, terminal output, and primary input interactions into a shared component that can be embedded inline for implementation/planning or take over the full main surface for direct mode. Do not duplicate worker rendering logic across modes.
  Verification:
  - Add a UI test proving the same component can render both inline-card and full-surface variants via props.

- [x] Add planning-mode artifact UX in `src/components/PlanningArtifactsPanel.tsx` and integrate it into the planning conversation view.
  Show detected spec/plan files, confidence, readiness, detection source, and a manual override option when auto-detection is ambiguous. The panel should clearly explain whether the plan is ready and expose the promotion action once verification passes.
  Verification:
  - Add a UI test covering ready, ambiguous, and blocked artifact states.

- [x] Implement direct-mode full-surface layout and behavior in `src/app/page.tsx` using `src/components/AgentSurface.tsx`.
  Direct mode should render the selected worker as the primary pane, hide implementation-specific worker sidebars, and surface session errors as direct-session failures instead of supervisor-run failures. Keep the experience focused on one remote CLI.
  Verification:
  - Add a UI test asserting direct mode renders the worker surface as the main pane and suppresses implementation-only worker chrome.

- [x] Preserve and harden implementation mode while migrating to mode-aware infrastructure.
  Keep current recovery, retry, rename, and delete behavior intact for implementation runs. If `src/app/api/supervisor/route.ts` becomes a compatibility layer, ensure its semantics remain unchanged for existing implementation-mode callers while new frontend code moves to the mode-aware endpoint.
  Verification:
  - Re-run `tests/api/run-route.test.ts`, relevant supervisor tests, and any compatibility tests for `/api/supervisor`.

- [x] Finish with an end-to-end verification pass across backend and UI.
  Confirm the three launch modes, planning artifact detection, promotion flow, direct-mode rendering, and implementation compatibility all work together without regressing the current conversation UX.
  Verification:
  - `pnpm test tests/db/schema.test.ts tests/api/conversations-route.test.ts tests/api/planning-promote-route.test.ts tests/server/planning/artifacts.test.ts tests/api/run-route.test.ts tests/ui/sidebar-layout.test.ts tests/lib/conversations.test.ts tests/lib/project-scope.test.ts`

## Notes And Constraints

- Keep `cwd` explicit everywhere:
  - planning/direct worker launch requests must include the selected `projectPath` as `cwd`,
  - relative planner artifact paths must resolve against that `cwd`,
  - promotion must carry the same project root into the new implementation run unless the user explicitly overrides it.
- Do not rely on provider-specific TUI behavior for planner handoff. Standardize around the planner prompt contract and treat fallback path scanning as secondary.
- Do not use file-based routing.
- Keep implementation supervisor scope narrow: planning and direct sessions should not wake the supervisor in this milestone.
- Preserve mobile and desktop usability when splitting the main surface and sidebars.

## Self-Review

- [x] The spec’s three explicit modes are each mapped to backend launch behavior and frontend rendering work.
- [x] Planner handoff, artifact detection, `cwd` normalization, and promotion are covered as first-class tasks rather than implicit behavior.
- [x] The plan preserves the current implementation mode while separating planning/direct infrastructure.
- [x] The plan keeps obvious baseline surfaces and states in scope:
  mode descriptions, artifact readiness, ambiguous-candidate handling, direct-session failures, and compatibility with existing implementation recovery.
- [x] The current milestone is clearly scoped to the first three modes, while planner review by other agents remains deferred-but-intentional.
