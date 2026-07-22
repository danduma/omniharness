---
codex_thread_id: "019ec6c7-4c64-72d1-a22e-134185cd20de"
title: "OH multi server single app"
started_at: "2026-06-14T15:36:50.565Z"
updated_at: "2026-06-14T16:08:04.819Z"
working_directory: "/Users/masterman/NLP/omniharness"
archive_status: "complete"
part: 1
parts: 1
---

# OH multi server single app

> This archive contains visible conversation activity and tool records. Private model reasoning and system/developer instructions are not available here.
<!-- codex-event:{"kind":"state","timestamp":"2026-06-14T15:36:51.093Z","phase":null} -->
## Task state: task_started · 2026-06-14T15:36:51.093Z

```text
{
  "type": "task_started",
  "turn_id": "019ec6c7-4e78-7b02-a7a0-08736fdb106f",
  "started_at": 1781451411,
  "model_context_window": 258400,
  "collaboration_mode_kind": "default"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"user","timestamp":"2026-06-14T15:36:54.297Z","phase":null} -->
## User · 2026-06-14T15:36:54.297Z

Let's write and harden the plan to support multiple servers inside the same running app. Basically we want to turn the interface into its own standalone thing which can then connect to multiple Omni harness servers.

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:37:04.427Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:37:04.427Z

I’ll use the planning-related skills here: first the baseline skill workflow, then brainstorming for the product/architecture ambiguity, writing-plans for the actual plan shape, and second-opinion to harden the result before I hand it back.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:37:04.438Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:37:04.438Z

```json
{
  "cmd": "sed -n '1,240p' /Users/masterman/.agents/skills/using-ultrapowers/SKILL.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:37:04.464Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:37:04.464Z

```json
{
  "cmd": "sed -n '1,260p' /Users/masterman/.agents/skills/brainstorming/SKILL.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:37:04.464Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:37:04.464Z

```json
{
  "cmd": "sed -n '1,260p' /Users/masterman/.agents/skills/writing-plans/SKILL.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:37:04.480Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:37:04.480Z

```json
{
  "cmd": "sed -n '1,260p' /Users/masterman/.agents/skills/second-opinion/SKILL.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:37:04.525Z","phase":null} -->
## Tool result: call_Gkq5ehdPkFXdAbxkaBicTCCg · 2026-06-14T15:37:04.525Z

```text
Chunk ID: c5c712
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2019
Output:
---
name: using-ultrapowers
description: Use when starting any conversation - establishes how to find and use skills, requiring skill invocation before acting
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, skip this skill.
</SUBAGENT-STOP>

# Using Ultrapowers

Use relevant skills before acting, but keep process proportional to the task.

## Instruction Priority

1. User instructions and local repo instructions
2. Ultrapowers skills
3. Default model behavior

If the user says not to create extra repository isolation, or says to work directly in the current repository, follow that instruction.

## Core Rule

Before responding, ask:

1. Is there a process skill that governs how to approach this?
2. Is there an implementation skill that governs how to execute it?
3. Is the request substantial enough to justify that process, or is it a tiny mechanical edit?

If a skill applies and the task is substantial enough to justify it, use it before continuing. If the request is a tiny mechanical edit, make the edit directly with targeted verification.

## Proportional Skill Use

Do the smallest responsible workflow that matches the request.

For tiny, unambiguous mechanical edits, do the edit directly:

- changing a color value,
- fixing a typo,
- tweaking short copy,
- changing a prompt sentence,
- renaming a label,
- adjusting obvious spacing or formatting,
- making a one-line config or docs correction.

For these, do not run brainstorming, write a plan, or force TDD unless the change affects product behavior, data, persistence, control flow, user journeys, or non-obvious architecture.

Use the heavier process when the request is ambiguous, user-facing behavior changes, multiple files/modules are involved, the user journey can change, or the change could create regressions that are not obvious from a quick targeted check.

## Default Posture

- Work in the current repository by default.
- YOU WILL NEVER CREATE A BRANCH unless explicitly instructed.
- Ask the user whether we should work in worktrees as part of the planning.
- YOU WILL ONLY CREATE A WORKTREE if explicitly instructed.
- Keep skill use proportional. Tiny mechanical edits should stay tiny.
- Every project should have a `.gitignore`.
- Never commit or push secrets, credentials, local environment files, `node_modules`, dependency caches, build outputs, coverage output, logs, temporary files, or intermediate/generated artifacts unless the human explicitly asks to version a specific generated artifact.
- Deliver full product functionality by default. NO FAKE COMPONENTS, NO MOCKS, NO PLACEHOLDERS, NO FALLBACKS as substitutes for the requested functionality unless the human explicitly asks for a prototype or scaffold.
- For app, UI, and product-surface work, run a PM pass during planning. Treat it as mandatory default behavior, not optional polish.
- For app, UI, and product-surface work, consider `agentic-user-journey-testing` for important user stories, but do not run it without explicit user approval.
- Use `second-opinion` for substantial saved implementation plans, and for unusually hard, creative, high-risk, or architecture-heavy specs when an independent external review could improve the artifact. Prefer a different available coding harness for that review, such as Codex asking Claude Code or Claude Code asking Codex. If no different harness is available, the same harness is fine; the second opinion is still mandatory for matching artifacts.
- Refactor code when a file passes 1200 lines. Do not normalize oversized files as the default end state.
- Use user stories in specs and plans when they clarify behavior or value.
- Default UI work to `shadcn/ui` unless the user says otherwise.
- When designing UI from scratch, first inspect the available ShadCN Blocks at https://ui.shadcn.com/blocks for each screen, form, or major surface. Start from the closest matching block with `npx shadcn add <block-name>` or the block's source in https://github.com/shadcn-ui/ui, then edit it by adding, removing, or adapting controls. Do not invent a fresh layout before doing this block-selection pass.
- Before adding any individual UI control, check whether `shadcn/ui` already provides a control that does what is needed. Use the available shadcn control first, then customize it, instead of hand-building a one-off control.
- Treat desktop and mobile responsiveness as first-class from the beginning.
- Prefer explicit routing unless the framework strongly defaults to file-based routes.
- For React apps, use `building-react-apps` for state managers, explicit transitions, routing, refs, imports, package-manager defaults, and frontend configuration defaults.
- For React apps with server state, optimistic UI, caches, polling, SSE/WebSocket streams, background jobs, persistence, or client/server synchronization, use `client-server-state-invariants` during planning and verification.
- For React or Next.js slowness, root-load, compile-time, SSR/hydration, bundle, import-bloat, or UI dependency cleanup work, use `optimizing-react-next-apps`.
- Prefer strong instrumentation and auditability for backend behavior.
- When a project has backend or agent workflows, prefer a fully instrumented control plane: persist meaningful events, tool calls, actions, results, errors, and state transitions, and expose them through a CLI or other scriptable interface so the full system can be inspected and tested without the UI.
- Use `instrumenting-control-planes` when building, planning, reviewing, or debugging backend decisions, agent workflows, recovery paths, retries, deletes, long-running jobs, SSE/WebSocket streams, or user-visible failures.
- Use `learning-from-bugs` after diagnosing or fixing meaningful architecture, storage, memory, persistence, control-plane, or system-level bugs so reusable lessons become durable.
- Do not default to silent, masked, or over-abstracted errors.
- When a project has a frontend, prefer surfacing full backend error details and stack traces to the frontend so failures stay visible, debuggable, and testable end-to-end.
- Treat persistence of settings and preferences as explicit design work.
- For every meaningful UI setting, define whether it persists, where it is stored, how it is read and written, who owns it, and how reset, sync, migration, and testing are handled.

See `docs/ultrapowers-defaults.md` for the canonical fork defaults.

## Skill Priority

1. Process skills first
2. Implementation skills second

Examples:

- "Make this button blue" -> inspect the relevant file, make the small edit, do targeted verification
- "Update this prompt sentence" -> edit the prompt directly and verify the final text
- "Build a feature" -> `brainstorming` with a PM pass first, then `writing-plans`, then execution; consider approval-gated `agentic-user-journey-testing` for app workflows
- "Fix this bug" -> `systematic-debugging`, then the relevant implementation skill; if the root cause is meaningful or systemic, finish with `learning-from-bugs`
- "Review this change" -> `requesting-code-review`

## Examples Of User Override

- If a task feels risky and the user did not ask for extra repository isolation, keep working in the current repository unless the user explicitly instructs otherwise.
- If a stack supports file-based routing but the user says not to use it, choose an explicit routing approach instead.
- If a framework strongly defaults to file-based routing, such as Next.js App Router, use the framework-native routing model unless there is a good reason not to.
- If a frontend skill suggests `shadcn/ui` but the user wants another design system, follow the user.

## Red Flags

- "I need a whole workflow for this tiny edit" -> no. Use the smallest responsible process.
- "This is simple, so I need the whole process anyway" -> no. Tiny mechanical edits should stay tiny.
- "I'll create extra repository isolation just to be safe" -> forbidden unless the user clearly asked for it.
- "I already know the skill" -> read the current version before relying on it

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:37:04.525Z","phase":null} -->
## Tool result: call_ZZV0GPuBv1cMQnWZp3B8uazy · 2026-06-14T15:37:04.525Z

```text
Chunk ID: 794f2c
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2664
Output:
---
name: brainstorming
description: Use before substantial product, UI, feature, or behavior work with ambiguity, user-journey impact, or multiple plausible approaches
---

# Brainstorming Ideas Into Designs

Turn rough ideas into an approved design before implementation begins.

## Hard Gate

Do not implement, scaffold, or change behavior until the design has been presented and approved.

For app, UI, and product-surface work, do not skip the PM pass. It is a required part of brainstorming in Ultrapowers.

Do not use brainstorming for tiny mechanical edits with a clear target. A color tweak, typo fix, prompt wording change, label rename, or obvious formatting adjustment should be done directly with targeted verification.

## Checklist

1. Explore project context.
2. Ask clarifying questions one at a time.
3. Run a PM Pass for app, UI, and product-surface requests.
4. Run a Product Completeness Pass for app, UI, and product-surface requests.
5. Propose 2-3 approaches with trade-offs and a recommendation.
6. Present the design in manageable sections and get approval.
7. Write the spec to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`.
8. Self-review for ambiguity, contradictions, placeholders, and scope.
9. For unusually hard, creative, high-risk, or architecture-heavy specs, use `second-opinion`.
10. Ask the user to review the written spec.
11. Move to `writing-plans`.

## What The Design Should Cover

- goal and constraints,
- architecture and boundaries,
- file decomposition expectations for large files and growing modules,
- data flow and error handling,
- error transparency expectations,
- persistence model for settings, preferences, and user-managed state,
- testing strategy,
- candidate agentic user journey tests, with approval required before running them,
- user stories when they help define behavior,
- acceptance criteria when they clarify completion,
- supporting jobs,
- state model,
- client/server state ownership, freshness, completeness, ordering, and race risks when the product has server state or runtime state,
- persistence and ownership model for settings and preferences,
- operational readiness,
- instrumentation and observability expectations,
- control-plane and scriptability expectations,
- named event expectations for server decisions, refusals, failures, recovery, and terminal states,
- error reporting expectations across backend, frontend, and logs,
- onboarding and discoverability expectations,
- settings-dialog content discipline when the UI includes settings, preferences, configuration, or option panels,
- risk and trust surfaces,
- north-star product vision,
- current milestone and future product direction,
- baseline expected v1 surfaces and states for familiar product types.

## PM Pass

For app, UI, and product-surface work, run a PM pass before the completeness pass.

This is mandatory default behavior for those categories of work. Do not treat it as optional polish or something to skip when the prompt seems short.

During this pass:

- default the first user to the human builder unless the prompt says otherwise,
- ask the user whether we should work in worktrees as part of the planning when repository workflow is relevant,
- assume the core job is usually already implied by the prompt,
- aggressively discover the supporting jobs around that core job,
- identify user segmentation and role clarity when the product genuinely has multiple roles,
- define the state model,
- use `client-server-state-invariants` when React surfaces depend on server state, optimistic UI, caches, streams, polling, background jobs, or persisted runtime state,
- define the persistence model for settings, preferences, drafts, and other user-managed state,
- define operational readiness expectations,
- define instrumentation and observability expectations,
- define control-plane expectations for inspection, replay, administration, and end-to-end testing,
- define the named events that expose server-side decisions and user-visible failures,
- define error transparency expectations so failures are not silently swallowed or abstracted away,
- identify any high-value agentic user journey tests that should be proposed for user approval,
- define onboarding and discoverability expectations,
- define the main risk and trust surfaces,
- define the north-star product,
- define the current milestone as one slice of that product,
- define future product direction as context, not as a substitute for a complete implementation checklist.

Use `pm-pass.md` as the reference for this step.

Milestone slicing is for sequencing delivery, not for shrinking the product imagination. Be expansive about the full product. Be deliberate about what belongs in the current milestone.

## Product Completeness Pass

For app, UI, and product-surface work, do not stop at the literal requested controls. Expand the design into a usable v1 by asking what a user would reasonably expect this category of product to include.

During this pass:

- derive the primary user stories,
- derive return/revisit stories,
- derive failure/recovery stories,
- derive status-awareness stories,
- derive mutation stories when the product involves editing, retrying, resubmitting, forking, or other state-changing actions,
- separate:
  - explicitly requested capabilities,
  - baseline expected v1 surfaces and states inferred from the stories,
- map the primary user journey,
- infer the interface surfaces and system behaviors required to satisfy those stories,
- cover expected empty, loading, running, waiting, error, completed, and recovery states,
- cover navigation, hierarchy, and status signaling,
- identify which primary user journeys would benefit from approval-gated black-box testing in the running app,
- cover what settings and preferences exist, whether each one persists, and what happens across reload, sign-out, device changes, reset, and migration,
- cover desktop and mobile behavior,
- use the PM pass outputs as inputs,
- use `story-derived-completeness.md` as the primary reference,
- use `v1-product-completeness.md` as a sanity check when the product archetype is familiar.

For non-obvious, costly, opinionated, or materially scope-expanding additions, check with the user before baking them into the spec as committed scope.

You may brainstorm with yourself to expand the completeness pass. Only involve additional agents when the user explicitly wants that or has already allowed delegated brainstorming.

## Ultrapowers Defaults During Brainstorming

When the work involves an app, UI, or product surface, assume these defaults unless the user overrides them:

- use `shadcn/ui`,
- for every new screen, form, or major UI surface, inspect the available ShadCN Blocks at https://ui.shadcn.com/blocks, choose the closest matching block, and treat that block as the starting point to adapt,
- use the live blocks catalog or official source repo at https://github.com/shadcn-ui/ui rather than a vendored snapshot of the catalog,
- before adding any individual control, check whether `shadcn/ui` already provides a suitable control and plan to use/customize that control before inventing a custom one,
- design for desktop and mobile from the beginning,
- make responsiveness part of the initial design,
- for React apps, use `building-react-apps` and identify the global Manager-owned state model early,
- for React apps with server/runtime state, use `client-server-state-invariants` and identify ownership tokens, snapshot provenance, completeness rules, event decisions, and race tests early,
- for React apps, identify high-churn draft/input/hover/open state and keep subscriptions narrow so a centralized Manager does not make the whole app re-render,
- prefer explicit routing unless the framework strongly defaults to file-based routes, such as Next.js App Router,
- use `instrumenting-control-planes` for backend or agent workflows, and prefer named durable events plus a scriptable control plane,
- prefer surfacing full error details and stack traces to the frontend instead of replacing them with vague generic failures,
- make persistence behavior for settings explicit instead of leaving storage choices implicit,
- use `designing-settings-dialogs` when the UI includes settings, preferences, configuration, or option panels,
- propose agentic user journey tests for important user stories when useful, but do not run them without explicit user approval,
- aim for a usable v1, not just the smallest literal UI that exposes requested controls.
- think ambitiously about the full product, then sequence it into coherent milestones.

If the current codebase already has strong conventions, preserve them unless the user asks to change direction.

## Questions

- Ask one question at a time.
- Prefer multiple-choice framing when possible.
- Do not invent extra process when the user has already answered the important decisions.
- If the request is tiny and unambiguous, do the change instead of turning it into a design conversation.

## Design Quality

- Break systems into focused units with clear responsibilities.
- If a file is likely to pass 1200 lines, plan a refactor or split instead of letting that growth happen by default.
- Prefer explicit interfaces over vague coupling.
- Stay close to the current codebase patterns when working in an existing project.
- Include only refactors that directly support the requested work.
- Discover supporting jobs instead of assuming the prompt listed them all.
- Distinguish obvious category-standard additions from debatable product choices.
- Distinguish story-derived obvious additions from debatable product choices.
- Distinguish north-star product thinking from current-milestone commitment.
- Confirm debatable product choices with the user instead of silently baking them in.

## Review Gate

For unusually hard, creative, high-risk, or architecture-heavy specs, run `second-opinion` after self-review and before presenting the spec to the user. Prefer a different available coding harness for that review, such as Codex asking Claude Code or Claude Code asking Codex. If no different harness is available, same-harness review is fine; the second opinion is still mandatory. Apply useful feedback, ignore feedback that conflicts with user instructions or approved scope, and keep reviewer notes out of the spec unless the user asks for them.

After writing the spec, ask the user to review it before moving on:

`Spec written and committed to <path>. Please review it and let me know if you want any changes before we start the implementation plan.`

Only after approval should you invoke `writing-plans`.

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:37:04.525Z","phase":null} -->
## Tool result: call_mqE4p6B2rmDWGAlQjMsQa5im · 2026-06-14T15:37:04.525Z

````text
Chunk ID: 13b18e
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2912
Output:
---
name: writing-plans
description: Use when you have an approved spec or clear requirements for a multi-step task, before implementation
---

# Writing Plans

Write a concrete implementation plan that another capable engineer could execute without guessing.

**Announce at start:** "I'm using the writing-plans skill to create the implementation plan."

## Defaults

- Work in the current repository unless the user asked for isolation.
- Do not assume any extra repository isolation.
- Ask the user whether we should work in worktrees before putting any extra repository isolation into the plan.
- Keep the plan DRY, YAGNI, and test-first.
- Do not write an implementation plan for a tiny mechanical edit with a clear target.
- Use `second-opinion` before handing off or executing any substantial saved implementation plan; the reviewer should come from a different available coding harness when possible, but same-harness review is fine when no different harness is available.
- Plan for full, complete, final product functionality. NO FAKE COMPONENTS, NO MOCKS, NO PLACEHOLDERS, NO FALLBACKS as substitutes for requested behavior unless the human explicitly asks for a prototype or scaffold.
- The final task checklist must represent the complete approved deliverable for the plan. Do not add a "later", "future", "deferred", or similar checklist section that makes the plan look complete while required behavior sits outside the executable work.

## Save Plans To

`docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`

## Plan Header

Every plan should begin with:

```markdown
# [Feature Name] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** [one-sentence outcome]

**Architecture:** [2-3 sentences on the approach]

**Tech Stack:** [key technologies and libraries]

**North Star Product:** [what the fully realized product wants to become]

**Current Milestone:** [the coherent slice being delivered now]

**Future Product Direction:** [optional context for product vision only; not part of the implementation checklist unless explicitly included in the current milestone]

**Final Functionality Standard:** [state how this plan delivers complete approved functionality end-to-end]

---
```

## Build The File Map First

Before writing tasks, list:

- files to create,
- files to modify,
- tests to update or add,
- candidate agentic user journey tests to propose for approval,
- real integrations, data paths, and product surfaces required for final functionality,
- client/server state invariants when the work has server state, optimistic UI, caches, polling, streams, background jobs, or persistence,
- `.gitignore` coverage for secrets, local environment files, dependencies, caches, build outputs, logs, temporary files, and intermediate/generated artifacts,
- the responsibility of each file.

If any existing file is already near 1200 lines, or this change would push it past 1200, include refactoring or splitting work in the plan.

## Task Quality

Each task should:

- be small enough to execute confidently,
- name exact file paths,
- include concrete verification steps,
- distinguish deterministic tests from approval-gated agentic journey tests,
- make TDD the default flow,
- implement real functionality instead of fake components, mocks, placeholders, or fallback paths that pretend the feature works,
- avoid vague placeholders.

If the whole request would be one obvious task, make the change directly instead of manufacturing a plan.

## Include User Stories When Helpful

If the spec uses user stories, preserve them in the plan where they clarify what behavior a task is supposed to deliver. Use them to ground scope, not as ceremony.

If brainstorming ran a PM pass, preserve its outputs explicitly. Do not flatten them back into vague implementation chores.

## Preserve The Product Completeness Pass

If brainstorming identified baseline expected v1 surfaces or states for a familiar product archetype, preserve them in the plan. Do not collapse the work back down to only the literal controls named in the initial prompt.

If brainstorming derived baseline expected v1 behaviors from approved user stories or journeys, preserve those too. Make sure the plan includes implementation work for the primary journey, return/revisit path, failure/recovery path, and status visibility when they are relevant to the product.

Preserve the approved north-star product vision as well as the current milestone. Keep future product direction as context, not as a substitute for executable work. The final checklist must be the full set of tasks needed to deliver the approved milestone completely. Do not end implementation plans with "later", "future", "deferred", or similar task groups unless the user explicitly asks for a roadmap document instead of an implementation plan.

When relevant, make sure the plan includes treatment for:

- supporting jobs that matter in this milestone,
- state model requirements,
- persistence model requirements for settings, preferences, drafts, and user-managed state,
- operational readiness requirements,
- instrumentation and observability requirements,
- control-plane and scriptability requirements,
- named event requirements for server decisions, refusals, failures, recovery, and terminal states,
- error transparency requirements,
- agentic user journey test candidates, including mission, entry point, expected visible proof, and user approval gate,
- onboarding and discoverability requirements,
- trust and risk requirements.

Also make file growth explicit. Do not quietly allow a file to pass 1200 lines without planning a refactor or split.

Do not use mocks, fake components, placeholder screens, canned responses, or fallback behavior as acceptance criteria or completion proof. They are only acceptable when the human explicitly asks for a prototype, scaffold, temporary shim, or isolated test double. If the user explicitly removes something from scope, document that in scope notes, not in the final task checklist, and do not present it as delivered.

At the same time, do not silently hard-code debatable additions. If a proposed addition is non-obvious, materially expands scope, adds meaningful cost, or reflects a strong product opinion rather than an obvious story-derived expectation, check with the user before baking it into the plan.

## Frontend Defaults In Plans

Unless the user says otherwise, frontend plans should preserve these assumptions:

- `shadcn/ui` is the default design system,
- every new screen, form, or major surface must start from the closest available ShadCN Block after inspecting https://ui.shadcn.com/blocks; the plan should name the selected block and then list the add/remove/adapt work needed,
- use the live blocks catalog or official source repo at https://github.com/shadcn-ui/ui rather than a vendored snapshot of the catalog,
- before adding any individual UI control, plans must check whether `shadcn/ui` already provides a suitable control and should use/customize that control before inventing a custom one,
- desktop and mobile responsiveness are part of the first implementation pass,
- React app plans should invoke `building-react-apps` and identify the Manager classes that own shared state and data structures,
- React app plans with server state, optimistic UI, caches, polling, SSE/WebSocket streams, background jobs, or persistence should invoke `client-server-state-invariants` and name ownership tokens, snapshot provenance, completeness rules, ordering, state machines, and race tests,
- React app plans should also identify high-churn UI state and require narrow selector subscriptions so centralized Managers do not cause root-level re-renders on every keystroke or pointer update,
- React or Next.js performance plans should invoke `optimizing-react-next-apps` and explicitly identify the initial render boundary, server-bootstrap data, root client bundle risks, and heavy imports that must stay out of the first page chunk,
- prefer explicit routing unless the framework strongly defaults to file-based routes, such as Next.js App Router.
- backend and agent workflows should invoke `instrumenting-control-planes` and usually include named, durable events plus a CLI or other scriptable control plane so tests can assert server decisions without the UI.
- when there is a frontend, plans should usually preserve full backend error details and stack traces through to the frontend rather than replacing them with vague generic errors.
- for app workflows, plans should propose black-box agentic user journey tests when useful, but state that running them requires explicit user approval.
- plans should explicitly say for each meaningful UI setting whether it persists, where it is stored, how it is loaded and saved, and how reset, migration, and verification work.
- plans that include settings dialogs, preferences panels, configuration modals, option tabs, or UI settings surfaces should invoke `designing-settings-dialogs` and reject redundant headings, subtitles, helper text, and decorative chrome.

## Self-Review

Before execution, check:

1. every spec requirement maps to a task,
2. there are no placeholders or undefined references,
3. names and interfaces stay consistent across tasks,
4. the plan does not assume extra repository isolation unless the user asked for it,
5. the plan includes obvious baseline expected v1 surfaces and states,
6. the plan does not lock in non-obvious additions without user confirmation,
7. the current milestone is clearly separated from the north-star product,
8. future product direction is context only and does not replace executable tasks,
9. the final checklist covers the complete approved deliverable with no "later", "future", or "deferred" task group,
10. the plan's final deliverable is full, complete, final product functionality for the approved milestone,
11. no task accepts fake components, mocks, placeholders, canned data, or fallback paths as the final deliverable,
12. React/server-state plans include tests for stale async responses, snapshot merge safety, event-stream replay/resync, state classifiers, deterministic ordering, and hot-path boundedness where those risks exist.

## Second Opinion Gate

After self-review and before execution handoff, use `second-opinion` for substantial saved plans. This is mandatory for normal `writing-plans` output.

Prefer cross-harness review: Codex should ask Claude Code when available, Claude Code should ask Codex when available, and other harnesses should choose the best available different headless coding CLI before falling back to themselves. If no different harness is available, use the same harness in a separate reviewer session; the second opinion is mandatory either way.

The second opinion is advisory. Apply useful feedback, ignore feedback that conflicts with user instructions or approved scope, and rerun the same persistent reviewer session after material revisions. Stop when the reviewer says the plan is ready or after five total passes.

Do not copy second-opinion notes into the plan unless the user explicitly asks for them.

## Execution Handoff

After saving the plan, either:

- execute it inline with `executing-plans`, or
- execute it with `subagent-driven-development` when that workflow is a good fit.

If the user already asked you to continue and implement, you may proceed with the appropriate execution path without pausing for another choice prompt.

````

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:37:04.534Z","phase":null} -->
## Tool result: call_zh5hhiePwnoC79mSQOb2WfoE · 2026-06-14T15:37:04.534Z

````text
Chunk ID: ceceda
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1666
Output:
---
name: second-opinion
description: Use when writing or hardening substantial specs, implementation plans, architecture plans, design plans, or unusually hard creative decisions before execution
---

# Second Opinion

Use an external headless coding harness as a persistent reviewer while shaping substantial plans and specs.

## When To Use

Use this skill for:

- any saved implementation plan produced through `writing-plans` (mandatory),
- substantial specs where ambiguity, architecture, product scope, or implementation risk remains,
- unusually hard or creative design decisions where another independent pass could improve the result.

Skip it for tiny mechanical edits, obvious one-task changes, or short plans that are not being saved as durable execution artifacts.

## Core Rule

Run the second opinion through a separate reviewer session. Prefer a different available coding harness from the one currently writing the plan or spec because cross-harness review catches more blind spots than asking the same agent family to review its own artifact.

Different harnesses are preferred, not required. The second opinion itself is required for matching artifacts. If no different harness is available, using the same harness in a separate headless/session context is fine.

Preferred pairings:

- Codex asks Claude Code when `claude` is available.
- Claude Code asks Codex CLI when `codex` is available.
- Gemini asks Codex or Claude Code when either is available.
- OpenCode asks Codex or Claude Code when either is available.
- Other harnesses ask the best available different coding harness.

If the preferred different harness is missing, use any other installed headless coding CLI (`gemini`, `opencode`, etc.) before falling back to the same harness. Same-harness review is acceptable when no different headless reviewer is available; say that explicitly and continue with the required second opinion.

Do not substitute an in-process self-review, browser chat, or a non-coding assistant unless the user explicitly asks for that. The point is a separate process with its own model, tool defaults, and context.

## Session Protocol

1. Identify the current harness.
2. Check for a different installed headless coding CLI, starting with the preferred pairing above.
3. Discover that reviewer's documented headless and resume flags with `--help` if needed.
4. Start one persistent reviewer session for the plan/spec artifact when the reviewer supports resumable sessions.
5. Run the first review in headless mode and capture the session id or thread handle when available.
6. For later passes, resume that same reviewer session instead of starting fresh when possible.
7. Give the reviewer the artifact path, relevant user goal, constraints, and a focused review prompt.
8. Ask the reviewer not to edit files.
9. Incorporate useful feedback into the plan/spec.
10. Ignore feedback that is wrong, out of scope, or inconsistent with user instructions.
11. Rerun the reviewer after material revisions.
12. Stop when the reviewer says the artifact is ready, or after five total review passes.

If five passes still leave concerns, proceed with the best available artifact. Do not keep looping.

## Harness Discovery

Use `command -v` or the platform equivalent to check for reviewer CLIs before choosing a fallback. Do not install a new harness just for a second opinion unless the user asks.

Typical checks:

```bash
command -v claude || true
command -v codex || true
command -v gemini || true
command -v opencode || true
```

Prefer read-only or plan-mode permissions for the reviewer. The reviewer should inspect and comment, not mutate files.

## Claude Code Pattern

For Claude Code, discover the current flags with `claude --help`. Common headless usage is:

```bash
claude -p "$(cat /tmp/second-opinion-prompt.txt)" > /tmp/second-opinion-pass-1.txt
```

If the installed Claude Code version exposes resume/session flags, use them for later passes. Otherwise, include the previous review summary and revised artifact path in the next headless prompt.

## Codex CLI Pattern

For Codex, prefer a non-ephemeral session so it can be resumed:

```bash
codex exec -C "$PWD" --sandbox read-only --json -o /tmp/second-opinion-pass-1.txt -
```

Capture the session id from the JSONL event stream when available. Resume the same reviewer:

```bash
codex exec resume "$SESSION_ID" -o /tmp/second-opinion-pass-N.txt -
```

If the CLI version exposes a different headless/resume shape, follow that version's `--help` output.

## Gemini CLI Pattern

For Gemini, prefer non-interactive prompt mode with plan/read-only approval when available:

```bash
gemini --prompt "$(cat /tmp/second-opinion-prompt.txt)" --approval-mode plan --output-format text > /tmp/second-opinion-pass-1.txt
```

Resume the same session with `--resume` if that is available and useful for later passes.

## Review Prompt Template

```text
You are my second-opinion planning reviewer. Review the artifact below without editing files.

Artifact: [absolute path]
User goal: [brief goal]
Context and constraints:
- [important constraints, user preferences, repo defaults]

Please judge whether this plan/spec is ready to use.

Look for:
- missing requirements or user instructions,
- vague tasks, placeholders, fake components, mocks, or fallback behavior posing as final work,
- scope creep or non-obvious product decisions that need user confirmation,
- missing file map, ownership, state, persistence, instrumentation, error, or verification details,
- sequencing problems or tasks that are too large to execute safely,
- test gaps and unclear acceptance criteria.

Return:
1. Verdict: READY or HARDEN
2. Highest-impact findings, with concrete fixes
3. Anything you would deliberately leave alone
```

## Handling Feedback

Treat the reviewer as advisory, not authoritative. Apply feedback when it improves correctness, completeness, clarity, safety, or testability. Do not apply feedback that conflicts with the user, local repo instructions, or already-approved scope.

The reviewer feedback does not need to be copied into the plan or spec. Keep the durable artifact clean unless the user explicitly asks for review notes.

## Failure Mode

If no different headless coding harness is available, say that explicitly and use the current harness headlessly if possible. Same-harness review still satisfies the required second-opinion gate when it runs as a separate reviewer session. If no separate reviewer surface is available at all, stop and say the mandatory second opinion cannot be run; do not replace it with an in-process self-review unless the user explicitly waives the gate.

````

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:37:14.763Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:37:14.763Z

I’m going to inspect the repo shape and the existing architecture docs before drafting. This is a server-state-heavy React change, so I’ll also pull in the React/server-state/control-plane guidance that affects the plan.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:37:14.769Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:37:14.769Z

```json
{
  "cmd": "sed -n '1,260p' /Users/masterman/.agents/skills/building-react-apps/SKILL.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 24000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:37:14.769Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:37:14.769Z

```json
{
  "cmd": "sed -n '1,300p' /Users/masterman/.agents/skills/client-server-state-invariants/SKILL.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 26000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:37:14.769Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:37:14.769Z

```json
{
  "cmd": "sed -n '1,300p' /Users/masterman/.agents/skills/instrumenting-control-planes/SKILL.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 26000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:37:14.802Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:37:14.802Z

```json
{
  "cmd": "sed -n '1,260p' /Users/masterman/.agents/skills/designing-settings-dialogs/SKILL.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 22000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:37:14.828Z","phase":null} -->
## Tool result: call_WiW3y3PV79SXZX6wYhTJtLSt · 2026-06-14T15:37:14.828Z

```text
Chunk ID: 80159a
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2034
Output:
---
name: building-react-apps
description: Use when building, refactoring, planning, or debugging React or Next.js apps, React components, hooks, routing, frontend state, SSR, hydration, bundles, imports, or UI settings
---

# Building React Apps

Use these defaults for React app work unless the user or existing codebase explicitly chooses another architecture.

If the work is specifically about slowness, root-load time, compile time, SSR effectiveness, hydration cost, bundle size, import bloat, or decluttering heavy UI dependencies, use `optimizing-react-next-apps` as the focused workflow.

If the app has server state, optimistic UI, caches, polling, SSE/WebSocket streams, background jobs, persisted runtime state, or client/server synchronization, use `client-server-state-invariants` before planning or changing the state model.

## UI Starting Point

- For new React app screens, forms, and major surfaces, use `shadcn/ui` unless the user or existing app has chosen another design system.
- Before inventing layout, inspect the available ShadCN Blocks at https://ui.shadcn.com/blocks for the specific screen or form category.
- Start from the closest matching block with `npx shadcn add <block-name>` or the official source in https://github.com/shadcn-ui/ui, then add, remove, and adapt controls to fit the product.
- Do not use a blank custom layout as the first implementation path when a relevant ShadCN Block exists.
- Before adding any individual control, check whether `shadcn/ui` already provides a suitable control. Use/customize the shadcn control before hand-building a one-off control.

## State And Data

- Always centralize React app state in global single-source-of-truth Manager classes.
- Components, hooks, and listeners subscribe to Manager updates and use Manager methods to update data.
- Centralized state does not mean broad subscriptions. Components must subscribe to the smallest slice they need, preferably with selector hooks and equality checks, so unrelated UI does not re-render.
- Never let app shells, page roots, sidebars, timelines, or other broad containers subscribe to an entire high-churn Manager snapshot when they only need stable fields. Draft text, cursors, hover/open state, search text, and other per-keystroke or per-pointer state need narrow component-level subscriptions.
- If typing in an input, moving a cursor, toggling a hover/open flag, or editing a small draft makes the whole app repaint, the subscription boundary is wrong even if the data source is centralized.
- Always implement a custom data manager for any app data structure.
- Never use separate state variables or arrays as the source of truth.
- Never send data around in transactions. Pass intent, ids, commands, or Manager method calls instead.

## React Control Flow

- Avoid using `useEffect()` to update state. Prefer `useCallback()` handlers or Manager methods for explicit state transitions.
- Work ahead of time to avoid callback hell, race conditions, and infinite loops.
- When debugging React and a fix does not work, explicitly consider whether the root cause is a race condition. Race conditions are common in React.
- Every async callback, mutation result, timer, poll, or stream message that can update visible state must prove it still owns the current context before mutating Managers or navigation.
- Use `RefObject` instead of `MutableRefObject`.

## Routing And Modules

- Prefer explicit routing over file-based routing when the framework does not strongly default to file-based routes. Framework-native file routing, such as Next.js App Router, is fine.
- Never use `require()` to import modules. Use `import` instead.
- Avoid `npm` by default. Use `pnpm` for package installation, scripts, and lockfiles unless the user or existing project explicitly chooses another package manager.

## Next.js And SSR Defaults

- Treat `"use client"` as a boundary with a cost. Do not put an entire page, app shell, sidebar, timeline, composer, settings surface, and data boot path behind one giant client component unless there is a deliberate reason.
- SSR is only useful if the initial HTML contains meaningful above-the-fold UI or data. If `curl` for the route only shows a boot shell, script payloads, or empty placeholders, the route is not meaningfully server-rendered even if SSR is technically enabled.
- Server-render the first useful screen by fetching route-stable bootstrap data on the server: auth/session state, settings needed to choose the shell, selected route ids, and initial page/snapshot data. Hydrate Managers or query caches from that bootstrap data; do not wait for client `useEffect()` plus client fetches before the first meaningful paint.
- Use client effects for browser-only concerns: localStorage-only preferences, notifications, SSE/WebSocket subscriptions, focus management, and post-paint refreshes. Do not use effects as the only path for data required to decide what the initial screen is.
- In Next dev, first request time includes compilation. Distinguish cold compile cost from runtime slowness before optimizing the wrong layer.

## Import And Bundle Hygiene

- Keep imports proportional to the UI being rendered. Do not import an entire complex surface for a tiny control; split shared tiny controls into their own files instead of importing them from heavy feature modules.
- Lazy-load rarely opened or route-conditional surfaces with dynamic imports: settings dialogs, side panels, file viewers, terminals, worker inspectors, onboarding flows, QR/pairing dialogs, and large markdown/code viewers.
- Avoid package and barrel imports that drag in whole icon packs, design systems, syntax highlighters, markdown stacks, charting libraries, or component suites for one glyph or one primitive. Inline small SVG paths or use local assets when that is cheaper and stable.
- Prefer native browser controls for small, ordinary selects and pickers. Do not import a popover/dialog/menu stack for a low-value dropdown unless search, virtualization, or rich item rendering is genuinely needed.
- Use subpath imports when a package supports them. Avoid root package imports from large UI libraries if a narrower entrypoint exists.
- After dependency or UI-shell changes, inspect the emitted dev chunks or traces. Verify whether heavy modules moved out of the root chunk rather than assuming dynamic import worked.

## Performance Debugging

- Start with evidence: dev server logs, route timings, emitted chunk sizes, module counts, and initial HTML content.
- Separate long-lived requests from slow requests. SSE, streaming, and hanging fetches can show huge durations in logs without blocking page paint.
- Check recent dependency additions first when compile time suddenly explodes. A single icon, markdown, chart, or UI package can add thousands of modules.
- For Next.js root-load complaints, answer three questions before changing code: what compiled, what HTML was returned, and what client-side requests gated the first useful paint?

## Frontend Configuration

- Never store frontend string literals or UI settings in `.env` files.
- Put frontend strings and settings in normal source files, inline arrays, or `.json` files so they remain reviewable, testable, and versioned with the UI.

## Internationalization

- For meaningful React UI work, offer language support as an option when the user has not already decided: "Should we support other languages? If yes, I will wire user-facing copy through i18n resources now instead of hardcoding strings."
- If the user says yes, asks for translation/i18n/language/locale support, or reports that language switching only updates part of the UI, use `implementing-react-i18n`.
- Use the i18n library's `t("key", params?)` function for every user-facing string. Use `useI18nSnapshot()` only to subscribe React components so language changes repaint.
- Never name variables with locale codes or locale-like names such as `it`, `en`, `enUS`, `locIt`, or `locEnUs`.

## Settings UI

- For settings dialogs, preferences panels, configuration modals, option tabs, or UI settings surfaces, use `designing-settings-dialogs`.

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:37:14.828Z","phase":null} -->
## Tool result: call_KLeU4vtAIyHvAISKTlYaRgyX · 2026-06-14T15:37:14.828Z

```text
Chunk ID: 336ee1
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1481
Output:
---
name: client-server-state-invariants
description: Use when planning, building, reviewing, or debugging React apps with server state, optimistic UI, caches, polling, SSE/WebSocket streams, background jobs, persistence, or client/server synchronization
---

# Client Server State Invariants

React bugs often expose deeper ownership mistakes. When client state, server state, cache state, stream state, and persisted state all exist, every plan needs explicit invariants.

## Core Rule

No UI surface may treat data as authoritative unless the payload proves ownership, freshness, completeness, ordering, and terminal state.

If those words are missing from the plan, the plan is probably baking in a race condition.

## Planning Checklist

For every React app that reads server/runtime state, the plan must answer:

1. **Owner:** What owns this state: server, client manager, URL, cache, stream, local storage, or worker/runtime?
2. **Token:** What owner token protects async results: `requestId`, `runId`, `projectPath`, `operationId`, `workerId + seq`, or equivalent?
3. **Provenance:** Is data server-authoritative, optimistic, cached preview, partial update, or historical fallback?
4. **Completeness:** Does the payload declare what scope it is complete for? What may it erase?
5. **Ordering:** What stable order is used: monotonic seq, `(createdAt, id)`, version, or cursor?
6. **State machine:** What are the legal states, terminal states, and transitions?
7. **Events:** Which server decisions are named events rather than client-side derivations?
8. **Loading shape:** Which states are bootstrap, first load, incremental refresh, reconnect, resync, recovery, and terminal error?
9. **Fallbacks:** Which legacy/fallback rows can render, and only after what authority is loaded?
10. **Tests:** Which race, stale-response, event-sequence, reconnect, and merge tests prove the invariants?

## Invariants To Require

- Cached and optimistic data may pre-render, but cannot satisfy full-load gates.
- Partial snapshots may add or refine state, but may not erase optimistic objects, delivered user input, read markers, or stream entries unless they declare complete scope.
- Every async response checks that its owner token still matches before mutating visible state.
- Mutation success handlers may navigate or clear UI only if they still own the current context, unless the action explicitly creates a new selected context.
- Timers and polling callbacks re-check ownership immediately before acting.
- Server decisions are emitted as named events; the client does not infer decisions by diffing snapshots.
- SSE/WebSocket streams have event ids, replay/resume, and an explicit resync path.
- Loading booleans are split by lifecycle stage. A leaf stream refresh must not unmount the whole page.
- Append-only content has one writer, one reader, stable ids, and monotonic cursors.
- Fallback DB rows or historical rows are gated behind stream loading and deduped by stable id plus safe equivalence.
- Status classifiers distinguish active, runnable, blocked, awaiting user, terminal, stale, and recoverable states.
- "Latest" queries have deterministic tie-breakers. Timestamp-only ordering is not enough.
- Hot paths use bounded reads and do not synchronously load large bodies, bridge probes, schema setup, or heavy app graphs.
- Process-local caches have explicit TTL/size bounds and invalidation rules.

## Test Matrix

Pick the rows that match the work. Do not rely on one happy-path UI test.

| Risk | Test shape |
| --- | --- |
| Stale async response | Start request A, switch owner, resolve A, assert it cannot mutate B |
| Optimistic object erased | Create local optimistic state, apply stale/partial snapshot, assert object remains |
| Cache masquerades as loaded | Hydrate cache preview, assert full-load gate waits for server authority |
| Mutation steals navigation | Start mutation, switch selection, resolve mutation, assert focus stays put |
| Timer/poll stale-fire | Use fake timers or deferred promises; callback must re-check owner before acting |
| Snapshot merge erases stream | Apply partial snapshot missing known entries, assert entries/read markers remain |
| Event stream gap | Bootstrap snapshot, emit events during disconnect, reconnect with last id, assert replay or resync |
| Server decision invisible | Exercise branch and assert named event such as `blocked`, `refused`, `gave_up`, or `error.surfaced` |
| State classifier wrong | Table-test every status into active/runnable/terminal/recoverable buckets |
| Fallback duplicates stream | Load fallback rows then stream entries, assert no duplicate or false chronology |
| Hot path bloats | Assert snapshots carry cursors not bodies; route returns before DB/heavy imports when possible |
| Timestamp tie | Insert equal timestamps, assert deterministic order by id/seq |

Use headless HTTP/SSE tests for control-plane decisions. Use React/unit tests for manager merging and ownership guards. Use Playwright only for real UI layout, focus, scroll, mobile computed styles, and visible affordances.

## Refuse These Shapes

- one `isLoading` boolean for bootstrap, refresh, reconnect, and recovery;
- cache or optimistic data treated as authoritative without provenance;
- async callbacks that mutate state without checking owner tokens;
- client-side derivation of server decisions;
- snapshot diffs used as the only way to know what happened;
- event streams without ids or resume;
- timestamp-only "latest" queries;
- parallel transcript or persistence surfaces that the frontend must reconcile;
- unbounded process caches introduced to hide slow storage;
- tests that prove only the DOM result when the bug is a server decision.

## Review Prompt

Ask this before implementation starts:

> What can arrive late, out of order, partially, twice, or after the user changes context, and what test proves it cannot corrupt visible state?

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:37:14.828Z","phase":null} -->
## Tool result: call_IyfINpz8oSyO3rMHi0VwKoGn · 2026-06-14T15:37:14.828Z

````text
Chunk ID: 033e5b
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1303
Output:
---
name: instrumenting-control-planes
description: Use when building, planning, reviewing, or debugging apps with backend decisions, agent workflows, long-running jobs, SSE/WebSocket streams, recovery paths, deletes, retries, or user-visible failures
---

# Instrumenting Control Planes

Build the control plane as a product surface. If the server decides, refuses, retries, spawns, deletes, recovers, gives up, or fails, that decision must be observable by users, operators, and tests.

If a React UI consumes the control plane through server state, optimistic UI, caches, polling, SSE/WebSocket streams, or persisted runtime state, also use `client-server-state-invariants`.

## Core Rule

Every meaningful server-side state transition emits a named, durable event. The UI and tests consume the same production event surface.

Do not rely on snapshot diffs, rendered DOM state, logs only, or client-side re-derivation to prove what the server decided.

## Hot Path Rule

No user bootstrap, catalog, status, reconnect, or recovery request may depend on a lock-prone database write path or external health probe finishing. Serve these paths from a bounded read model, memory cache, append-only event log, or stale-but-marked snapshot; queue reconciliation writes outside the request. Every dependency on a database or bridge call in a hot path needs a short timeout, cancellation, and an explicit degraded response.

If SQLite, local files, or a single-writer store is used, assume writer contention can freeze readers at the worst moment. Use one writer, WAL/busy-timeout discipline, short transactions, bounded queues, and headless chaos tests that run bootstrap/reload while writes are active. A 25s UI request is a control-plane failure, even if the database eventually returns.

## Event Contract

For each backend or agent workflow, define:

- named events for decisions: `worker.spawned`, `worker.reattached`, `plan.ready`, `plan.review.blocked`, `recovery.gave_up`, `conversation.delete_failed`;
- payloads with stable ids, `prev`/`next` status when relevant, reason codes, and enough context to debug;
- `error.surfaced` or an equivalent user-facing failure event for every failure the user should know about;
- durable persistence or a bounded replay buffer so short disconnects do not erase history;
- a scriptable read path: CLI, HTTP endpoint, sqlite query, or event log command.

If a decision cannot be asserted from this surface, the design is incomplete.

If debugging a control-plane failure reveals a reusable lesson, use `ultrapowers:learning-from-bugs` after the fix is verified.

## Streaming Requirements

For SSE or WebSocket-like streams:

- emit named events alongside any snapshot/update frame;
- include monotonic event ids;
- support resume from the last seen id;
- replay missed events from a bounded buffer;
- emit an explicit resync-required event when replay is impossible;
- bootstrap from a snapshot, then tail events.

Snapshots show current truth. Named events show why it became true.

## Testing Standard

Control-plane tests should usually be headless HTTP/SSE scenario tests, not browser tests. Browser automation is for UI behavior; control-plane tests assert server decisions directly.

Write scenario assertions as event transcripts:

```ts
expect(events).toHaveEmitted("worker.spawned", { runId });
expect(events).toHaveEmitted("worker.status", { next: "running" });
chaos.killServer();
chaos.restartServer();
expect(events).toHaveEmitted("worker.reattached", { runId });
expect(events).not.toHaveEmitted("worker.recreated", { runId });
```

Chaos belongs outside production code paths: drop connections in the client, fail fetches in the harness, restart the server process, and use seeds for reproducibility.

## Refuse These Shapes

- silent early returns in server methods;
- swallowed `catch` blocks;
- client-side derivation of server decisions;
- response-code-only user failures;
- event streams without ids or resume;
- tests that infer control-plane behavior from rendered state;
- delete handlers that do not enumerate dependent rows or emit typed failure events;
- recovery loops without terminal events such as `gave_up` or `abandoned`;
- request handlers that wait on inline reconciliation writes, SQLite contention, or bridge `/doctor` checks before returning bootstrap data;
- test-only behavior branches in production code.

## Design Checklist

Before implementing a backend or agent workflow, answer:

1. What decisions can this workflow make?
2. What named event is emitted for each decision, including refusal and failure?
3. Where are events persisted or buffered?
4. How does a client resume after disconnect?
5. Which request paths must keep working while persistence or bridge dependencies are slow, locked, or stale?
6. How can a CLI or test harness inspect the exact event sequence without the UI?
7. Which headless scenario proves the happy path, failure path, recovery path, terminal state, and hot-path timeout/degraded path?
8. Which client state consumes these events, and how does it prove ownership, freshness, completeness, ordering, and replay/resync?

If the answer is "the UI can figure it out", name the missing event instead.

````

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:37:14.850Z","phase":null} -->
## Tool result: call_vHPy9ejlBnD09gYa47AIFvp9 · 2026-06-14T15:37:14.850Z

```text
Chunk ID: 96403b
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 785
Output:
---
name: designing-settings-dialogs
description: Use when designing, planning, building, or reviewing settings dialogs, settings dialogues, preferences panels, configuration modals, option tabs, or UI settings surfaces
---

# Designing Settings Dialogs

## Core Principle

A settings dialog is a control surface, not a narrative page. It should help users find, understand, and change preferences with minimal chrome.

## Defaults

- Do not repeat the selected tab, sidebar item, or section name as a heading inside the panel.
- Do not add subtitles that explain obvious groups.
- Do not describe what visible controls already say.
- Prefer compact rows: label, optional current value, control, validation or error when needed.
- Add helper text only when it explains consequences, scope, persistence, sync, privacy, security, irreversible behavior, constraints, or ambiguous terminology.
- Keep hierarchy shallow: tabs or sidebar sections at the top level, then grouped controls.
- Avoid nested cards, decorative wrappers, intro copy, empty headings, and repeated "Settings" labels.
- Use status text only for real state: unsaved changes, saving, saved, failed, unavailable, permission required.
- Make save semantics explicit: auto-save, Apply/Cancel, or Save. Do not mix them casually.
- Preserve the host platform or design-system conventions before inventing custom settings chrome.

## Content Test

Before adding any heading, subtitle, description, icon, badge, or callout, ask:

1. Would the user be confused without this text?
2. Does it explain a consequence or boundary the control itself cannot show?
3. Does it change what the user should do?

If all answers are no, delete it.

## Persistence And Scope

Every meaningful setting still needs explicit behavior:

- whether it persists,
- where it is stored,
- who owns it,
- when it is loaded and saved,
- whether it is local, workspace-level, account-level, or synced,
- how reset, migration, and verification work.

This persistence design belongs in the plan or spec, not as explanatory prose inside the dialog unless the user needs it to make a safe choice.

## Common Mistakes

| Mistake | Better |
|---|---|
| Tab says "Appearance", panel title says "Appearance", subtitle says "Customize how the app looks." | Use the tab label only. Show the controls. |
| "Notification settings let you control notifications." | Delete it. |
| A card per setting with icon, title, subtitle, and repeated copy. | Use dense labeled rows unless the setting has complex consequences. |
| "Configure your editor preferences below." | Delete it. The dialog already provides the context. |
| Helper text under every control for visual rhythm. | Add helper text only where it carries decision-critical information. |

## Review Checklist

- One clear navigation model.
- No repeated tab or section titles.
- No subtitles for self-explanatory sections.
- No helper text that merely restates a label.
- Controls are scannable without decorative cards.
- Save, cancel, reset, and error behavior are visible when relevant.
- Persistence and scope are designed, even when not narrated in the UI.

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"user","timestamp":"2026-06-14T15:37:14.852Z","phase":null} -->
## User · 2026-06-14T15:37:14.852Z

Use baton on cli for a second opinion

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:37:27.787Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:37:27.787Z

Noted: I’ll use `baton` from the CLI for the second-opinion pass. First I’m mapping the existing app structure and docs so the plan names real files and current ownership boundaries instead of inventing new ones.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:37:27.794Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:37:27.794Z

```json
{
  "cmd": "rg --files -g 'AGENTS.md' -g 'package.json' -g 'docs/**' -g 'src/**' -g 'app/**' -g 'shared/**' -g 'tests/**' | sed -n '1,260p'",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:37:27.794Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:37:27.794Z

```json
{
  "cmd": "sed -n '1,260p' docs/architecture/lifecycle-observability-and-testing.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 24000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:37:27.795Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:37:27.795Z

```json
{
  "cmd": "sed -n '1,260p' docs/architecture/worker-conversation-stream.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 24000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:37:27.853Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:37:27.853Z

```json
{
  "cmd": "sed -n '1,220p' package.json",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 16000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:37:27.918Z","phase":null} -->
## Tool result: call_sUyUuViYIqF5UJonVqWKHnNq · 2026-06-14T15:37:27.918Z

```text
Chunk ID: df6119
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2277
Output:
src/instrumentation.ts
src/vscode-extension/bridge.ts
src/lib/conversation-state.ts
src/lib/state-manager.ts
src/lib/worker-stuck-events.ts
src/lib/chat-attachments.ts
src/lib/run-status.ts
src/lib/app-errors.ts
src/lib/git-workspace.ts
src/lib/local-pairing-token.ts
src/lib/syntax-highlighting.ts
src/lib/project-paths.ts
src/lib/auth-constants.ts
src/lib/worker-terminal-messages.ts
src/lib/runtime-resource-settings.ts
src/lib/agent-output.ts
src/lib/run-recovery-state.ts
src/lib/utils.ts
src/lib/use-manager-snapshot.ts
src/lib/worker-terminal-processes.ts
src/lib/pwa.ts
src/lib/i18n-core.ts
src/lib/project-file-links.ts
src/lib/project-scope.ts
src/lib/i18n.ts
src/lib/mentions.ts
src/lib/planning-output.ts
src/lib/commit-workflow.ts
src/lib/conversations.ts
src/lib/conversation-visuals.ts
src/lib/conversation-workers.ts
src/shims/empty-encoding.ts
src/components/OmniHarnessMark.tsx
src/components/PairDeviceDialog.tsx
src/components/FolderPickerDialog.tsx
src/components/LoginShell.tsx
src/components/FileAttachmentPickerDialog.tsx
src/components/PlanningArtifactsPanel.tsx
src/components/AttachmentImagePreviewDialog.tsx
src/components/Terminal.tsx
src/components/AgentSurface.tsx
src/components/composer/ComposerSelect.tsx
src/components/composer/ComposerModelPicker.tsx
src/components/cli-brand-icons.tsx
src/components/BugDropBootstrap.tsx
src/components/PlanningReviewControls.tsx
src/components/BootShell.tsx
src/components/component-state-managers.ts
src/components/WorkerCard.tsx
src/components/ConversationModePicker.tsx
src/components/LanguageSelect.tsx
src/components/PwaBootstrap.tsx
src/components/home/RecoveryIncidentInspector.tsx
src/components/home/ConversationSidebar.tsx
src/components/home/RunRecoveryNotice.tsx
src/components/home/HomeHeader.tsx
src/components/home/BranchWorkspaceButton.tsx
src/components/home/SideWindow.tsx
src/components/home/RunWorkspaceBadge.tsx
src/components/home/SettingsDialog.tsx
src/components/home/UserInputMessage.tsx
src/components/home/WorkersSidebar.tsx
src/components/home/ConversationComposer.tsx
src/components/home/ThemeModeToggle.tsx
src/components/home/FileViewerPanel.tsx
src/components/home/QueuedMessageDrawer.tsx
src/components/home/ConversationMain.tsx
src/components/home/OnboardingSetupDialog.tsx
src/components/home/ErrorNotice.tsx
src/components/settings/AppearanceSettingsPanel.tsx
src/components/settings/CredentialsSettingsPanel.tsx
src/components/settings/ModelProfileForm.tsx
src/components/settings/SettingsDialog.tsx
src/components/settings/RuntimeSettingsPanel.tsx
src/components/settings/AgentsSettingsPanel.tsx
src/components/settings/ProjectMemorySettingsPanel.tsx
src/components/settings/worker-availability-copy.ts
src/components/settings/GeneralSettingsPanel.tsx
src/components/settings/ModelsSettingsPanel.tsx
src/components/settings/NotificationsSettingsPanel.tsx
src/components/ui/input.tsx
src/components/ui/textarea.tsx
src/components/ui/select.tsx
src/components/ui/dropdown-menu.tsx
src/components/ui/collapsible.tsx
src/components/ui/button.tsx
src/components/ui/separator.tsx
src/components/ui/badge.tsx
src/components/ui/dialog.tsx
src/components/ui/switch.tsx
src/components/ui/combobox.tsx
src/components/ui/tooltip.tsx
src/components/ui/scroll-area.tsx
src/components/ui/sheet.tsx
src/components/ui/input-group.tsx
src/components/ui/card.tsx
src/components/ui/button-group.tsx
src/components/PlanProgress.tsx
src/components/MarkdownContent.tsx
src/server/conversation-title.ts
src/server/supervisor/observer.ts
src/server/supervisor/model-config.ts
src/server/supervisor/resume.ts
src/server/supervisor/context-window.ts
src/server/supervisor/index.ts
src/server/supervisor/worker-failover.ts
src/server/supervisor/tools.ts
src/server/supervisor/protocol.ts
src/server/supervisor/runtime-watchdog.ts
src/server/supervisor/runtime.ts
src/server/supervisor/worker-types.ts
src/server/supervisor/start.ts
src/server/supervisor/conversation-bootstrap.ts
src/server/supervisor/retry.ts
src/server/supervisor/worker-completion.ts
src/server/supervisor/memory-consolidation.ts
src/server/supervisor/context.ts
src/server/supervisor/memory-tools.ts
src/server/supervisor/interventions.ts
src/server/supervisor/intervention-store.ts
src/server/supervisor/worker-availability.ts
src/server/supervisor/prompt.ts
src/server/supervisor/memory-paths.ts
src/server/supervisor/lease.ts
src/server/supervisor/codex-auth.ts
src/server/supervisor/wake-schedule.ts
src/server/supervisor/wake.ts
src/server/supervisor/runtime-settings.ts
src/server/git/command.ts
src/server/git/auto-commit.ts
src/server/git/orphan-recovery.ts
src/server/git/run-auto-commit.ts
src/server/git/status.ts
src/server/git/workspaces.ts
src/server/notifications/triggers.ts
src/server/notifications/preferences.ts
src/server/notifications/web-push.ts
src/server/notifications/deliver.ts
src/server/credits/index.ts
src/server/runs/recovery-actions.ts
src/server/runs/recovery.ts
src/server/runs/recovery-policy.ts
src/server/runs/ad-hoc-plan.ts
src/server/runs/persisted-zombie-reconciler.ts
src/server/runs/recovery-state.ts
src/server/runs/recovery-incidents.ts
src/server/runs/failures.ts
src/server/runs/recovery-reconciler.ts
src/server/runs/ids.ts
src/server/runs/recovery-control-plane.ts
src/server/runs/status.ts
src/server/clarifications/store.ts
src/server/clarifications/loop.ts
src/server/fs/files.ts
src/server/agent-runtime/codex.ts
src/server/agent-runtime/external-credentials.ts
src/server/agent-runtime/worker-pool.ts
src/server/agent-runtime/output-store.ts
src/server/agent-runtime/types.ts
src/server/agent-runtime/http.ts
src/server/agent-runtime/resource-admission.ts
src/server/agent-runtime/tool-env.ts
src/server/agent-runtime/acp-stream-sanitizer.ts
src/server/agent-runtime/memory-trace.ts
src/server/agent-runtime/manager.ts
src/server/events/live-updates.ts
src/server/events/named-events.ts
src/server/events/lifecycle-invariants.ts
src/server/events/execution-event-store.ts
src/server/events/payload-checksum.ts
src/server/events/persisted-snapshot.ts
src/server/quota/reset-parser.ts
src/server/quota/recovery.ts
src/server/quota/type-blocking.ts
src/server/quota/worker-resume.ts
src/server/omni-acp/agent.ts
src/server/omni-acp/stdio.ts
src/server/workers/stream-writer.ts
src/server/workers/snapshots.ts
src/server/workers/monitor.ts
src/server/workers/output-store.ts
src/server/workers/response-fallback.ts
src/server/workers/entries-types.ts
src/server/workers/session-recovery.ts
src/server/workers/session-metadata.ts
src/server/workers/stuck-worker-reaper.ts
src/server/workers/live-snapshots.ts
src/server/workers/ids.ts
src/server/error-format.ts
src/server/dev/managed-bridge.ts
src/server/dev/bridge-lock.ts
src/server/dev/bridge-health.ts
src/server/db/index.ts
src/server/db/schema.ts
src/server/prompts/supervisor.md
src/server/prompts/index.ts
src/server/prompts/planner.md
src/server/prompts/conversation-title.md
src/server/conversations/sync.ts
src/server/conversations/create.ts
src/server/conversations/send-message.ts
src/server/conversations/worker-turn-gate.ts
src/server/conversations/message-records.ts
src/server/conversations/queued-messages.ts
src/server/conversations/modes.ts
src/server/conversations/queued-message-interrupt.ts
src/server/conversations/direct-run-status.ts
src/server/conversations/queued-message-records.ts
src/server/accounts/dto.ts
src/server/restart-control.ts
src/server/api-errors.ts
src/server/permissions/index.ts
src/server/cli/options.ts
src/server/cli/runner.ts
src/server/bridge-client/index.ts
src/server/planning/review-prompts.ts
src/server/planning/promote.ts
src/server/planning/review.ts
src/server/planning/review-agent-selection.ts
src/server/planning/refresh.ts
src/server/planning/artifacts.ts
src/server/planning/review-artifact-store.ts
src/server/planning/review-preferences.ts
src/server/planning/status.ts
src/server/worker-models.ts
src/server/projects/config.ts
src/server/projects/canonicalize.ts
src/server/session-providers/registry.ts
src/server/session-providers/types.ts
src/server/session-providers/process-provider.ts
src/server/session-providers/capabilities.ts
src/server/session-providers/process-store.ts
src/server/session-providers/session-records.ts
src/server/session-providers/omni-provider.ts
src/server/handoff/render.ts
src/server/handoff/request.ts
src/server/handoff/parser.ts
src/server/auth/rate-limit.ts
src/server/auth/audit.ts
src/server/auth/config.ts
src/server/auth/guards.ts
src/server/auth/session.ts
src/server/auth/session-state.ts
src/server/auth/password.ts
src/server/auth/pairing.ts
src/server/worker-launch-mode.ts
src/server/plans/checklist.ts
src/server/plans/readiness-pipeline.ts
src/server/plans/parser.ts
src/server/plans/readiness.ts
src/server/plans/readiness-llm.ts
src/server/slow-probe.ts
src/server/artifacts/project-root.ts
src/server/artifacts/cleanup.ts
src/server/artifacts/stream-metadata.ts
src/server/artifacts/stream-index.ts
src/server/artifacts/append-only-store.ts
src/server/artifacts/compaction.ts
src/server/artifacts/stream-types.ts
src/server/app-root.ts

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:37:27.918Z","phase":null} -->
## Tool result: call_ynDGnXuGblRHme0nqSyiBNGQ · 2026-06-14T15:37:27.918Z

````text
Chunk ID: 0e5ecd
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 3126
Output:
# Lifecycle Observability & Resilience Testing

> What we keep getting wrong, why our tests don't catch it, and the discipline that fixes it.

Related: `docs/architecture/hot-path-responsiveness-and-resource-leaks.md`
documents the May 2026 reload/worker-streaming latency incident and the
resource-ownership rules for keeping page bootstrap, SSE, and worker stream
paths responsive while agents are running.

Related: `docs/architecture/timing-determinism-audit.md` records the May 20,
2026 audit of race-prone frontend and control-plane patterns: cached snapshots
pretending to be authoritative, stale async callbacks, timer-owned actions,
timestamp-only ordering, and silent wake/lease contention.

## Why this document exists

Over a single afternoon we hit three production-class bugs that the existing test
suite did not catch and could not have caught:

1. **Session fails to reconnect after a server restart and gives up after the
   first attempt.** No user-visible message, no telemetry event, no recovery
   incident — just a silently dead session.
2. **`DELETE /conversations/:id` fails with a foreign-key constraint** because
   related rows in dependent tables were not cleared first. The error surfaces
   as an opaque 500.
3. **Running plan-improvement agents fails because leftover state blocks the
   new run.** The block is silent; the user sees nothing happen and assumes the
   button is broken.

These are not unrelated bugs. They share a single root cause:

> **The server makes state transitions that nobody observes.** Neither the user,
> nor the UI, nor any test client can tell what the server decided. So bugs in
> the *decision* (gave up too early, took the wrong branch, refused silently)
> are invisible.

This document records what we learned and the rules we now follow so that this
class of bug stops shipping.

Related incident note: `docs/architecture/supervisor-worker-switching-incident.md`
records the worker-switching failure from session `690d2fa9f2a7`, where
`awaiting_user` was treated as runnable, Gemini workers were live but persisted
as `starting`, and duplicate continuation workers were spawned.

Related direct-control note:
`docs/architecture/direct-control-session-regressions.md` records the
`ffb912d4d5d7`, `937e642f3535`, and `734cc38f4d7f` regressions around
lifecycle noise, stale queued send-now state, missing unified-stream worker
output, and permanent "Thinking..." indicators.

Related state-staleness note:
`docs/architecture/state-staleness-and-session-lifecycle-lessons.md` records
the `0785684884fa`, `14260d2a2df0`, `ecea142f7344`, and `18fc406457f3`
regressions around stale SSE/cache payloads, queued-message races, direct-run
status classification, unread markers, and worker-stream loading.

---

## What we found in the audit

A targeted audit of `src/app/api/events/route.ts` plus the planning, recovery,
and bridge-client subsystems revealed the structural gaps.

### 1. The SSE stream is a snapshot stream, not an event stream

`/api/events` emits exactly one named event: `update`, whose payload is the
*entire* current state of the world for the selected run (messages, plans,
runs, workers, planItems, clarifications, executionEvents, supervisor
interventions, queued messages, recovery incidents, review runs/rounds/findings).

There are no other named events. An observer cannot ask "did a worker spawn?"
or "was a recovery attempted?" — only "is the state now different?" To answer
the first kind of question the client must **diff snapshots**, which is:

- **Ambiguous** — many transitions produce identical visible state (a worker
  that was reattached and a worker that was recreated both end up as
  `status="running"`).
- **Lossy** — fast transitions can be coalesced inside a single snapshot
  interval and disappear entirely. (e.g. `starting → running → completed`
  inside one 15s window.)
- **Forced to re-derive server decisions** — the client has to reconstruct
  *why* state changed, which requires duplicating server logic.

### 2. There is no event ID and no resume

The SSE frames have no `id:` field. There is no `Last-Event-ID` handling on the
server. A client that disconnects and reconnects gets a fresh snapshot and has
*no way to know* whether events fired during the gap. For chaos testing (where
we deliberately drop the connection) this is fatal — we cannot assert
"between t0 and t1 the server emitted [X, Y, Z]" because the wire format does
not carry that information.

There is a `?snapshot=1` bootstrap endpoint, which is good. There is no
"give me the events I missed since id N" endpoint, which is the gap.

### 3. Several decisions are invisible to the wire

Concrete state transitions that **the server makes** but **never tells anyone
about**:

| Transition | Where it happens | Wire visibility |
|---|---|---|
| Worker spawned | `bridge-client/index.ts spawnAgent` | None — inferred from a row appearing |
| Worker reattached vs recreated after restart | `restart-control.ts` / recovery path | **None** — both look like `status="running"` |
| Recovery gave up after N attempts | `recoveryIncidents.autoAttemptCount` increments | Partial — count is visible but there is no terminal "abandoned" state |
| Plan readiness reached | `derivePlanningStatus()` — runs **client-side** | **None** — it is a client-side derivation, not a server event |
| Plan-improvement blocked by leftover state | `planning/review.ts` early-return | **None** — silent refusal |
| Conversation delete FK violation | `/api/conversations/[id]` DELETE | None as a typed event — only a 500 response |
| Message ack / persisted / streaming chunk | `conversations/send-message.ts` | Partial — only the resulting queued-message status |

Every row in this table is a bug class waiting to ship. If the server can
silently decide "I gave up", "I refused", "I took branch B not A", and the
test harness has no way to assert which branch it took, the test harness is
structurally incapable of catching the bug.

### 4. The user-facing surface mirrors the test-facing surface

The reason "leftover state blocked the run" did not show a user message is the
**same reason** no test could detect it: there was no event for it. Make the
state transitions observable, and both the UI fix and the test coverage
follow. Conversely, if a transition is observable only by re-deriving from a
snapshot diff, both the UI and tests will be brittle in the same ways.

This is the central insight: **observability for users and observability for
tests are the same problem**.

### 5. Playwright e2e is the wrong layer for resilience

The existing `tests/e2e/*.spec.ts` files boot Chromium. They are slow (tens of
seconds per scenario), flaky against real subprocess restarts, and they
exercise UI rendering rather than control-plane decisions. The bugs we are
hitting are not UI bugs — they are control-plane bugs. We should be hitting
HTTP/SSE directly, in Node, with no browser. The UI is one consumer of the
control plane; the chaos harness is another.

---

## The rules we now follow

These are not suggestions. They are the discipline that makes this class of
bug stop happening.

### Rule 1: every server-side state transition emits a named event

If the server makes a decision — spawn, reattach, recreate, give up, refuse,
delete, fail — that decision is published on the event stream with a
**named event type**, not just a state delta. Examples:

- `worker.spawned`, `worker.status` (with `prev` and `next`), `worker.terminal`
- `worker.reattached`, `worker.recreated`
- `plan.ready`, `plan.review.started`, `plan.review.finished`,
  `plan.review.blocked` (with a `reason`)
- `recovery.opened`, `recovery.attempt`, `recovery.gave_up`, `recovery.resolved`
- `conversation.deleted`, `conversation.delete_failed` (with FK details)
- `error.surfaced` — the catch-all for anything the user should know about

**Rule of thumb:** if a server method has an early-return, a try/catch that
swallows, or a branch that depends on a state check, it emits an event.
"Silent" is a code smell.

### Rule 2: errors that affect the user are events, not just response codes

A 500 with a body is not enough. A 200 that quietly did nothing is worse. Every
user-relevant failure publishes `error.surfaced` with a stable code, a
human-readable message, and the relevant run/worker/conversation ids. The UI's
job is to render `error.surfaced` events into toasts/banners. The test
harness's job is to assert that the expected `error.surfaced` event fired.

A failure that does not produce an `error.surfaced` event is a bug — even if
the underlying behaviour is technically correct — because it is invisible to
the user and to the tests.

### Rule 3: the event stream is SSE-spec compliant

- Every frame has an `id:` field. IDs are monotonic.
- The server keeps a bounded **ring buffer** (≥ 500 entries) of recent events.
- The server honours `Last-Event-ID` on reconnect: it replays everything after
  that id from the buffer, then resumes live streaming.
- If the requested id has fallen out of the buffer, the server emits a
  `stream.resync_required` event so the client knows to re-bootstrap from
  `?snapshot=1` rather than silently miss events.

This is the SSE spec. We were not following it. We are now.

### Rule 4: named events alongside, not instead of, snapshots

The existing `update` snapshot event stays. The UI keeps consuming it. The new
named events are *additional* frames on the same stream. Clients that don't
care about a given event type ignore it. There is no `?test=1` flag, no
separate test endpoint, no parallel surface that can drift.

If a transition is worth emitting for tests, it is worth emitting in
production. Anything else creates a second observability surface that will
diverge from reality.

### Rule 5: chaos testing belongs in the client, not the server

We do **not** add fault-injection code paths to the server. We do not add a
"random failure" mode. The server stays clean. Chaos lives in the test
client as middleware:

- An SSE wrapper that can drop the connection on command.
- A `fetch` wrapper that can fail a configurable percentage of requests.
- A harness that can SIGKILL the spawned server process and restart it.

Faults are seeded for reproducibility. Every failure has a seed; replaying
the seed reproduces the failure.

### Rule 6: tests assert on event sequences, not on rendered state

A scenario test reads like a transcript:

```
expect(events).toHaveEmitted("worker.spawned", { runId });
expect(events).toHaveEmitted("worker.status", { next: "running" });
chaos.killServer();
chaos.restartServer();
expect(events).toHaveEmitted("worker.reattached", { runId });
// not "worker.recreated", not absence — explicitly reattached
```

### Rule 7: cleanup waits for server-owned background work

Lifecycle scenarios may call routes that intentionally return before a direct
worker turn finishes. That is fine for product latency, but it is not fine for
test cleanup to delete `OMNIHARNESS_ROOT` while those server-owned tasks are
still writing worker JSONL, recovery rows, or named events.

Required shape:

- Fire-and-forget direct/planning turns are registered as background
  conversation tasks.
- The lifecycle harness waits for registered background tasks before deleting
  its temp root.
- A timeout while waiting is a test failure, not harmless stderr after the test
  already passed.
- Do not paper over storage `ENOENT` from cleanup races by retrying file writes;
  the ownership bug is untracked background work.

Asserting on rendered DOM state is the wrong granularity. We assert on the
server's *decisions*, which are now first-class events.

### Rule 7: the test harness runs in isolation

A separate Node process. A temporary `OMNI_HOME`. A fresh sqlite. A dedicated
port. No collision with the real dev server. Tear it all down on exit.
Scenarios can run in parallel because each one owns its own server.

### Rule 8: snapshot bootstrap, event tail thereafter

Every harness client starts by calling `GET /api/events?snapshot=1` for state
truth, then opens the SSE stream with `Last-Event-ID` set to the id at
snapshot time. This is the canonical pattern. The UI should do this too;
right now it doesn't, which is a latent bug.

### Rule 9: snapshots declare scoped completeness

An event snapshot may be a full replacement for a selected run's transcript,
or it may be only a partial update. The payload must say which one it is.


````

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:37:27.918Z","phase":null} -->
## Tool result: call_YZDCPBiWH25dqhoEbFcAjWyc · 2026-06-14T15:37:27.918Z

````text
Chunk ID: 855254
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2958
Output:
# Worker Conversation Stream

The worker conversation stream is the single source of truth for every
direct conversation with a single worker — direct-control mode (user ↔
worker) and supervisor-driven worker turns (supervisor ↔ worker). It
replaces an earlier design where worker content was split between the
`messages` table, the bridge's in-memory `outputEntries`, and JSONL
files; reconciling those three surfaces on the frontend was the source
of a long-running class of bugs.

The plan that introduced this surface is at
`docs/superpowers/plans/2026-05-16-unified-worker-conversation-stream.md`.

Operational constraints for keeping this stream responsive under long-running
workers are captured in
`docs/architecture/hot-path-responsiveness-and-resource-leaks.md`. In
particular, snapshots carry worker seq cursors rather than transcript bodies,
incremental reads use bounded JSONL tail scans, and normal streaming appends
must not rebuild the full transcript cache on every chunk.

Direct-control regressions found after this cutover, including blank worker
output, queued send-now persistence, duplicate first messages, and stuck
"Thinking..." states, are documented in
`docs/architecture/direct-control-session-regressions.md`.

Frontend loading and stale-cache regressions involving sessions
`7ebf2bc8e556` and `17a194b3c1c1` are documented in
`docs/architecture/state-staleness-and-session-lifecycle-lessons.md`. That
note covers the fallback rule for legacy `messages` rows: use them only after
the relevant worker stream is loaded, and never let them render ahead of
unknown stream content.

Related incident note: `docs/architecture/supervisor-worker-switching-incident.md`
documents a transcript-ordering regression where a supervisor-spawned worker
streamed bridge output before the server appended the initial
`supervisor_input`, causing the prompt to render at the end of the worker
conversation.

## File format

One file per worker, in append-only JSONL. The location is project-local
when a project is known, with a fallback to the legacy global root:

```
<projectPath>/.omniharness/run-data/<runId>/workers/<workerId>.jsonl   (preferred)
<appData>/run-data/<runId>/<workerId>.jsonl                            (legacy, read-only)
```

After the worker reaches a terminal status and the file has been idle
for at least 5 minutes, it is gzipped to `<workerId>.jsonl.gz`. Reads
are transparent across both. If the worker resumes after compaction
(e.g. recovery), the next append auto-expands the gzip back to plain
JSONL.

Worker streams share the generic engine in
`src/server/artifacts/append-only-store.ts` with execution events,
supervisor interventions, and planning review findings: same lock
discipline, same compaction policy, same sparse seq→offset index for
fast tail-N reads.

Each line is one JSON object of type `WorkerEntry`
(`src/server/workers/entries-types.ts`). Two families of entries share
the file:

- **Bridge-produced** (`message`, `thought`, `tool_call`,
  `tool_call_update`, `permission`) — what the bridge emits as the
  worker speaks, thinks, or runs tools. The bridge's
  `BridgeOutputEntry` shape (in `src/server/bridge-client/index.ts`) is
  **not** extended; we convert at the writer boundary so the bridge
  never has to know about server-produced types.
- **Server-produced** (`user_input`, `supervisor_input`, `system_note`,
  `lifecycle`) — synthesized by the server on each delivery boundary
  and on observable lifecycle transitions.

Use `isBridgeOutputEntry(entry)` / `isServerProducedEntry(entry)` to
discriminate; never branch ad-hoc on `entry.type`.

## Seq invariants

Every entry carries a `seq: number` that is:

- Monotonically increasing per `(runId, workerId)`.
- Assigned at write time by `appendWorkerEntry` in
  `src/server/workers/output-store.ts`. The bridge never sees it.
- Persistently stored on disk; the file is the cursor's authority.
- Backfilled lazily on read for any legacy line that predates seq
  (assigned in file order, no rewrite). The next compaction sweep
  writes the assigned seq back to disk.

The writer caches the next-seq, seen ids, fingerprints, and file stat in
memory keyed by `(runId, workerId)`. It rebuilds from disk on first use after a
process restart, or when the file stat shows another writer changed the file.
Normal streaming appends must reuse the cache and advance the cursor without
re-reading the whole transcript. A truncated last line (crash mid-write) is
tolerated: `parseLines` skips the malformed bytes, and the next append starts
from `max-valid-seq + 1` and prefixes its own line with `\n` so the broken
trailer stays on its own line.

## Dedup-by-id

`appendWorkerEntry(runId, workerId, entry)` checks `entry.id` against
the file's seen-ids set before writing. If the id is already present,
the call is a no-op and the previously persisted entry is returned.
This makes the snapshot poll path (`persistWorkerSnapshot` →
`writeWorkerOutputEntries`) idempotent under bridge polling restarts
and rebuilds: an entry is never re-added once written.

Bridge entries' ids come from the bridge itself. Server-produced
entries (user_input, supervisor_input, lifecycle, system_note) are
assigned a uuid when constructed. Backfilled entries (the
`scripts/backfill-worker-entries.ts` script) reuse the source row id
(`messages.id` / `executionEvents.id`) so a partially completed
backfill is resumable.

## Write-acceptance semantics

Append-only persistence makes "insert then delete on busy" impossible
to undo. Inputs are categorized by their acceptance state and only
appended on durable acceptance:

| State        | Trigger                                              | Stream action                                                                              |
|--------------|------------------------------------------------------|--------------------------------------------------------------------------------------------|
| `accepted`   | Server has validated a direct/planning prompt that the UI will render immediately | **append first**, then write any `messages` mirror row; the stream is the display authority |
| `accepted`   | Server has validated a request that is not worker-stream-backed | nothing yet                                                                                |
| `queued`     | Inserted into `queuedConversationMessages`           | nothing yet                                                                                |
| `delivered`  | `askAgent()` returned OR `queued_message_delivered`  | **append** `user_input` / `supervisor_input` with `timestamp = deliveredAt`                |
| `failed`     | Validation error, busy retry, etc.                   | nothing — caller's responsibility to retry; `queuedConversationMessages` carries pending UI |

The JSONL is a transcript of what was **delivered to the worker**, not
of what the user attempted. "Pending / queued" UI state comes from
`queuedConversationMessages` (which already existed), not from the
stream.

For worker-backed direct/planning conversations, the JSONL stream is the
primary transcript. A `messages` row for the same user input is only a DB
mirror/index and must never get ahead of the stream. If an existing user
message row has no matching `user_input` entry, the server refuses the
next message instead of inserting another row.

## One writer, one reader

There is one writer per worker file (`appendWorkerEntry`) and one
reader endpoint (`GET /api/workers/:workerId/entries?afterSeq=N`).
Every code path that persists worker conversation content goes through
the writer; every frontend code path that renders worker conversation
content goes through the reader.

The writer holds an in-process per-worker mutex
(`writeChainByKey` in `output-store.ts`). All file mutations for a
given `(runId, workerId)` — append, expand-from-gz, compact-to-gz,
delete — acquire this mutex. An earlier version of the compaction
sweep bypassed the chain; that latent loss bug is fixed.

The in-process chain is paired with an OS-visible worker-file lock so Next dev
module instances and process boundaries cannot interleave file mutations. The
single-writer-per-worker invariant is load-bearing.

## Two cursors, kept distinct

- **Global SSE event id** (the `id:` field on every SSE frame, backed
  by the ring buffer in `src/server/events/named-events.ts`) — used
  for liveness, drain, and `stream.resync_required` signaling. Stays
  exactly as before.
- **Per-worker `entry.seq`** — the durable content cursor. Used by
  the entries endpoint, by the frontend's contiguous-range tracking,
  and by the resync path.

SSE frames are wake-up hints; content always comes via
`?afterSeq=`. The `worker.entry_appended` named event carries only
`{ workerId, seq }`, never the entry body. A global ring-buffer
overflow (`stream.resync_required`) triggers a refetch from the
per-worker contiguous cursor — no global resync is needed for workers
whose `latestContiguousSeq === latestKnownSeq`.

## Frontend loading invariant

`WorkerEntriesManager` (`src/app/home/WorkerEntriesManager.ts`) tracks
per-worker state. The contract is:

- `entries` is always the contiguous prefix `[1..latestContiguousSeq]`,
  with no gaps.
- `latestKnownSeq` is the highest seq the server has told us exists.
- `isLoaded(workerId)` is `true` iff `latestContiguousSeq ===
  latestKnownSeq && status === "loaded"`.

The Terminal renders either entries (when provided) or the legacy
`agent` + `userMessages` props (before cutover). When `entries` is provided,
the worker stream is the transcript authority. Legacy `userMessages` rows may
be used only as a gated fallback for stale historical data after
`WorkerEntriesManager.isLoaded(workerId)` is true; before that point, rendering
fallback rows can create a false chronology while the contiguous stream is
still arriving.

## Dual-write feature flag

`OMNI_UNIFIED_WORKER_STREAM` controls server-side dual-writes through
`appendUserInputOnDelivery` / `appendSupervisorInputOnDelivery` /
`appendLifecycleEntry`. The bootstrap surfaces this flag to the
frontend at `features.unifiedWorkerStream` so the reader can flip
together with the writer.

**Default after Phase 4 cutover: ON.** Setting the env var to
`0` / `false` / `off` reverts to the legacy reader path. The flag is
removed entirely in Phase 5.

## Observation plan

Phase 4 ships with the flag defaulted ON but the legacy `messages`
writes still happening (dual-write). Watch for:

- Disk growth under `app-data/run-data/` — lifecycle entries are
  small, but they multiply per worker. Existing 5-minute idle
  gzip-compaction handles them transparently.
- SSE message volume — each `appendWorkerEntry` emits one
  `worker.entry_appended` named event into the ring buffer.
- Frontend "loading" spinner duration on direct-control conversations
  with large transcripts. The contiguous-prefix invariant should keep
  this under one round-trip per worker.
- Any user reports of missing content.
- Re-running `pnpm tsx scripts/backfill-worker-entries.ts --dry-run`
  reports zero manual-attribution cases.

## Don't add a parallel persistence layer

If you need to persist new worker conversation content — a new
tool-call shape, a new lifecycle marker, a new server-injected note —
extend `WorkerEntry` and route it through `appendWorkerEntry`. Don't
add a sibling JSONL, a new `messages.kind`, or an in-memory cache that
the frontend has to reconcile against the stream.

Provider-backed sessions use the same stream. A local process session
creates a normal `workers` row with `type = "process"` and appends
stdout, stderr, stdin, and lifecycle markers to
`app-data/run-data/<runId>/<workerId>.jsonl`. The session provider
model is described in `docs/architecture/session-provider-model.md`.

````

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:37:27.918Z","phase":null} -->
## Tool result: call_VfQXnMCVukgRlSiz5EzQafqz · 2026-06-14T15:37:27.918Z

```text
Chunk ID: 24233c
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 764
Output:
{
  "name": "omniharness",
  "version": "0.1.0",
  "description": "Local web UI, CLI, and ACP control plane for supervising coding agents.",
  "license": "AGPL-3.0-only",
  "private": true,
  "bin": {
    "omni": "./omni",
    "omniharness": "./omniharness"
  },
  "packageManager": "pnpm@11.2.2",
  "engines": {
    "node": ">=22.13 <26"
  },
  "scripts": {
    "preinstall": "node ./scripts/check-pnpm.mjs",
    "predev": "node ./scripts/check-pnpm.mjs --verify-native",
    "dev": "pnpm exec tsx scripts/dev.ts",
    "dev:proxy": "pnpm exec tsx scripts/dev-compression-proxy.ts",
    "restart:control": "pnpm exec tsx scripts/remote-restart.ts",
    "prebuild": "node ./scripts/check-pnpm.mjs --verify-native",
    "dev:web": "next dev --turbo",
    "setup:agents": "./scripts/install-agent-acp.sh",
    "build": "next build",
    "start": "pnpm exec tsx scripts/start.ts",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "electron:build": "node ./apps/electron/scripts/build.mjs",
    "vscode:build": "node ./apps/vscode/scripts/build.mjs",
    "test:lifecycle": "vitest run tests/lifecycle",
    "measure:dev": "node ./scripts/measure-local-dev.mjs"
  },
  "dependencies": {
    "@agentclientprotocol/sdk": "^0.14.1",
    "@ai-sdk/openai": "^3.0.64",
    "@base-ui/react": "^1.4.1",
    "@danduma/i18n": "github:danduma/i18n#5684747b61b748173d0c1e1fb1e0d241083e3de0",
    "@libsql/client": "^0.17.3",
    "@mastra/core": "^1.28.0",
    "@node-rs/argon2": "^2.0.2",
    "@tanstack/react-query": "^5.99.1",
    "@xterm/addon-fit": "^0.11.0",
    "@xterm/xterm": "^6.0.0",
    "adm-zip": "^0.5.17",
    "better-sqlite3": "^12.9.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "drizzle-orm": "^0.45.2",
    "highlight.js": "^11.11.1",
    "js-yaml": "^4.1.1",
    "lucide-react": "^1.8.0",
    "next": "15.5.15",
    "node-pty": "^1.1.0",
    "proper-lockfile": "^4.1.2",
    "qrcode": "^1.5.4",
    "react": "19.1.0",
    "react-dom": "19.1.0",
    "shadcn": "^4.3.0",
    "tailwind-merge": "^3.5.0",
    "tw-animate-css": "^1.4.0",
    "web-push": "^3.6.7",
    "xterm": "^5.3.0",
    "xterm-addon-fit": "^0.8.0",
    "zod": "^3.25.76",
    "zustand": "^5.0.12"
  },
  "devDependencies": {
    "@eslint/eslintrc": "^3",
    "@playwright/test": "^1.53.0",
    "@tailwindcss/postcss": "^4",
    "@types/adm-zip": "^0.5.8",
    "@types/better-sqlite3": "^7.6.13",
    "@types/blessed": "^0.1.27",
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^20",
    "@types/proper-lockfile": "^4.1.4",
    "@types/qrcode": "^1.5.6",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@types/vscode": "^1.120.0",
    "@types/web-push": "^3.6.4",
    "blessed": "^0.1.81",
    "blessed-contrib": "^4.11.0",
    "drizzle-kit": "^0.31.10",
    "electron": "^42.2.0",
    "eslint": "^9",
    "eslint-config-next": "15.5.15",
    "tailwindcss": "^4",
    "tsx": "^4.21.0",
    "typescript": "^5",
    "vite-tsconfig-paths": "^5.1.4",
    "vitest": "^3.1.0"
  }
}

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:37:36.543Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:37:36.543Z

The existing docs reinforce two constraints the plan needs to preserve: the UI should consume server decisions through named SSE events, and worker transcript content must stay in the unified worker stream rather than introducing another reconciliation surface. Next I’m looking at the current API routes and frontend managers.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:37:36.548Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:37:36.548Z

```json
{
  "cmd": "rg --files src/app | sed -n '1,260p'",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:37:36.558Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:37:36.558Z

```json
{
  "cmd": "rg -n \"class .*Manager|Manager\" src/app src/components src/lib | sed -n '1,220p'",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 26000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:37:36.558Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:37:36.558Z

```json
{
  "cmd": "rg -n \"fetch\\(|EventSource|/api/events|useI18nSnapshot|t\\(\" src/app src/components src/lib | sed -n '1,260p'",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 32000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:37:36.618Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:37:36.618Z

```json
{
  "cmd": "find docs/superpowers -maxdepth 3 -type f | sort | sed -n '1,220p'",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 24000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:37:36.641Z","phase":null} -->
## Tool result: call_9t7v923b0tX50TM1mCG5q7IN · 2026-06-14T15:37:36.641Z

```text
Chunk ID: 805cf9
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 841
Output:
src/app/providers.tsx
src/app/fx.css
src/app/globals.css
src/app/page.tsx
src/app/api/supervisor/route.ts
src/app/api/git/route.ts
src/app/api/notifications/route.ts
src/app/api/runs/[id]/route.ts
src/app/api/runs/[id]/resume/route.ts
src/app/api/runs/[id]/answer/route.ts
src/app/api/fs/files/route.ts
src/app/api/fs/route.ts
src/app/api/attachments/route.ts
src/app/api/events/log/route.ts
src/app/api/events/route.ts
src/app/api/workers/[workerId]/entries/route.ts
src/app/api/conversations/[id]/transcript/route.ts
src/app/api/conversations/[id]/queued-messages/[messageId]/route.ts
src/app/api/conversations/[id]/queued-messages/[messageId]/interrupt/route.ts
src/app/api/conversations/[id]/queued-messages/interrupt-next/route.ts
src/app/api/conversations/[id]/messages/route.ts
src/app/api/conversations/route.ts
src/app/api/accounts/route.ts
src/app/api/agents/route.ts
src/app/api/agents/prewarm-worker/route.ts
src/app/api/agents/catalog/route.ts
src/app/api/agents/[name]/route.ts
src/app/api/planning/[id]/review/route.ts
src/app/api/planning/[id]/promote/route.ts
src/app/api/runtime/bootstrap/route.ts
src/app/api/projects/memory/route.ts
src/app/api/external-sessions/route.ts
src/app/api/auth/session/route.ts
src/app/api/auth/pair/route.ts
src/app/fx/Fx.tsx
src/app/api/auth/pair/redeem/route.ts
src/app/layout.tsx
src/app/api/settings/route.ts
src/app/favicon.ico
src/app/api/llm-models/route.ts
src/app/api/plans/route.ts
src/app/api/auth/logout/route.ts
src/app/api/auth/login/route.ts
src/app/api/codex-auth/status/route.ts
src/app/api/messages/route.ts
src/app/fx-spike/page.tsx
src/app/home/auto-resume-selection.ts
src/app/home/useConversationExecutionStatus.ts
src/app/home/BusyMessageQueueManager.ts
src/app/home/SidebarWorkerActivityManager.ts
src/app/home/useComposerController.ts
src/app/home/direct-worker-stream-loading.ts
src/app/home/ExternalSessionsPicker.tsx
src/app/home/useConversationActions.ts
src/app/home/upload-attachments.ts
src/app/home/PreflightConfirmationActionsManager.ts
src/app/home/SideWindowManager.ts
src/app/home/EventStreamSnapshotCacheManager.ts
src/app/home/side-window-viewport.ts
src/app/home/useHomeLayoutController.ts
src/app/home/useHomeViewModel.ts
src/app/home/useAppErrors.ts
src/app/home/composer-keyboard.ts
src/app/home/ConversationNotificationManager.ts
src/app/home/useRunRecoveryState.ts
src/app/home/SettingsDraftManager.ts
src/app/home/HomeApp.tsx
src/app/home/constants.ts
src/app/home/useHomeLifecycle.ts
src/app/home/useFrozenRecentOrder.ts
src/app/home/bootstrap.server.ts
src/app/home/useHomeQueries.ts
src/app/home/types.ts
src/app/home/useHomeMutations.ts
src/app/home/ConversationTranscriptManager.ts
src/app/home/direct-control-activity.ts
src/app/home/PlanningReviewPreferencesManager.ts
src/app/home/WorkerEntriesManager.ts
src/app/home/utils.ts
src/app/home/busy-message-behavior.ts
src/app/home/LiveEventConnectionManager.ts
src/app/home/GitWorkspaceManager.ts
src/app/home/useQueuedMessageMutations.ts
src/app/home/ComposerContainer.tsx
src/app/home/supervisor-activity.ts
src/app/home/AppearancePreferencesManager.ts
src/app/home/useRunSelectionEffects.ts
src/app/home/sidebar-activity.ts
src/app/home/EventStreamStateManager.ts
src/app/home/HomeUiStateManager.ts
src/app/home/recovery-utils.ts
src/app/home/ProjectMemoryPanelManager.ts
src/app/home/SessionStateManager.ts

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:37:36.642Z","phase":null} -->
## Tool result: call_qd2qfPkSwHS7n9U2aCm2GoC9 · 2026-06-14T15:37:36.642Z

```text
Chunk ID: a017cd
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 6635
Output:
src/app/providers.tsx:5:import { appearancePreferencesManager } from "@/app/home/AppearancePreferencesManager";
src/app/providers.tsx:6:import { fileViewerPanelManager } from "@/components/component-state-managers";
src/app/providers.tsx:7:import { i18nManager } from "@/lib/i18n";
src/app/providers.tsx:17:    appearancePreferencesManager.hydrateFromLocalStorage();
src/app/providers.tsx:18:    fileViewerPanelManager.hydrateFromLocalStorage();
src/app/providers.tsx:19:    void i18nManager.hydrateAsync();
src/components/PairDeviceDialog.tsx:9:import { pairDeviceManager, type PairingState } from "@/components/component-state-managers";
src/components/PairDeviceDialog.tsx:12:import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
src/components/PairDeviceDialog.tsx:77:  } = useManagerSnapshot(pairDeviceManager) as PairingState<PairCreateResponse, PairStatusResponse["pairing"]["status"]>;
src/components/PairDeviceDialog.tsx:89:      pairDeviceManager.patch({
src/components/PairDeviceDialog.tsx:107:    pairDeviceManager.patch({
src/components/PairDeviceDialog.tsx:126:      pairDeviceManager.patch({
src/components/PairDeviceDialog.tsx:152:      pairDeviceManager.patch((current) => {
src/components/PairDeviceDialog.tsx:165:      pairDeviceManager.patchIfCurrentPairing(draft.pairingId, {
src/components/PairDeviceDialog.tsx:196:    const interval = window.setInterval(() => pairDeviceManager.setKey("nowMs", Date.now()), 1000);
src/components/PairDeviceDialog.tsx:206:      const pollRequestId = pairDeviceManager.beginStatusPoll(pairing.pairingId);
src/components/PairDeviceDialog.tsx:213:        pairDeviceManager.patchIfCurrentStatusPoll(pairing.pairingId, pollRequestId, {
src/components/PairDeviceDialog.tsx:217:        pairDeviceManager.patchIfCurrentStatusPoll(pairing.pairingId, pollRequestId, {
src/components/PairDeviceDialog.tsx:228:      pairDeviceManager.reset();
src/components/PairDeviceDialog.tsx:237:    pairDeviceManager.setKey("copyNotice", "Link copied.");
src/lib/state-manager.ts:4:export class StateManager<TState> {
src/components/FolderPickerDialog.tsx:11:import { folderPickerManager } from "@/components/component-state-managers";
src/components/FolderPickerDialog.tsx:12:import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
src/components/FolderPickerDialog.tsx:25:  const { currentPath, search } = useManagerSnapshot(folderPickerManager);
src/components/FolderPickerDialog.tsx:52:    folderPickerManager.navigate(path);
src/components/FolderPickerDialog.tsx:67:            onChange={(event) => folderPickerManager.setSearch(event.target.value)}
src/lib/use-manager-snapshot.ts:4:import type { StateManager } from "@/lib/state-manager";
src/lib/use-manager-snapshot.ts:6:export function useManagerSnapshot<TState>(manager: StateManager<TState>) {
src/lib/use-manager-snapshot.ts:32:export function useManagerSelector<TState, TSelected>(
src/lib/use-manager-snapshot.ts:33:  manager: StateManager<TState>,
src/lib/i18n-core.ts:1:import { createI18nManager, type I18nSnapshot } from "@danduma/i18n";
src/lib/i18n-core.ts:35:const createStableI18nManager = () => {
src/lib/i18n-core.ts:36:  const manager = createI18nManager<OmniLocale>({
src/lib/i18n-core.ts:59:export const i18nManager = createStableI18nManager();
src/lib/i18n-core.ts:61:const notifyI18nListeners = (i18nManager as unknown as { notify: () => void }).notify.bind(i18nManager);
src/lib/i18n-core.ts:70:(i18nManager as unknown as { notify: () => void }).notify = () => {
src/lib/i18n-core.ts:87:export const t: typeof i18nManager.t = (...args) => {
src/lib/i18n-core.ts:90:    return i18nManager.t(...args);
src/lib/i18n-core.ts:97:  return i18nManager.getSnapshot().supportedLocales.map((locale) => ({
src/components/LoginShell.tsx:7:import { loginShellManager } from "@/components/component-state-managers";
src/components/LoginShell.tsx:8:import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
src/components/LoginShell.tsx:29:  const { password } = useManagerSnapshot(loginShellManager);
src/components/LoginShell.tsx:83:                onChange={(event) => loginShellManager.setPassword(event.target.value)}
src/components/home/RecoveryIncidentInspector.tsx:4:import { conversationMainManager } from "@/components/component-state-managers";
src/components/home/RecoveryIncidentInspector.tsx:5:import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
src/components/home/RecoveryIncidentInspector.tsx:37:  const { runLogOpenByRunId } = useManagerSnapshot(conversationMainManager);
src/components/home/RecoveryIncidentInspector.tsx:46:    <Collapsible open={open} onOpenChange={(nextOpen) => conversationMainManager.setRunLogOpen(key, nextOpen)}>
src/lib/i18n.ts:4:  i18nManager,
src/lib/i18n.ts:10:import { i18nManager } from "./i18n-core";
src/lib/i18n.ts:14:    useCallback((listener) => i18nManager.subscribe(listener), []),
src/lib/i18n.ts:15:    useCallback(() => i18nManager.getSnapshot(), []),
src/lib/i18n.ts:16:    () => i18nManager.getSnapshot(),
src/components/component-state-managers.ts:1:import { StateManager, type StateUpdate } from "@/lib/state-manager";
src/components/component-state-managers.ts:3:export const loginShellManager = new class extends StateManager<{ password: string }> {
src/components/component-state-managers.ts:11:export const folderPickerManager = new class extends StateManager<{ currentPath: string; search: string }> {
src/components/component-state-managers.ts:21:export const fileAttachmentPickerManager = new class extends StateManager<{ search: string; selectedFiles: string[] }> {
src/components/component-state-managers.ts:43:export const attachmentImagePreviewManager = new class extends StateManager<{ preview: AttachmentImagePreview | null }> {
src/components/component-state-managers.ts:76:export class PairDeviceStateManager extends StateManager<PairingState<unknown, string>> {
src/components/component-state-managers.ts:136:export const pairDeviceManager = new PairDeviceStateManager();
src/components/component-state-managers.ts:138:export const planningArtifactsManager = new class extends StateManager<{ selectedPlanPath: string | null }> {
src/components/component-state-managers.ts:148:export class FileViewerPanelManager extends StateManager<{ wordWrap: boolean; renderMarkdown: boolean }> {
src/components/component-state-managers.ts:178:export const fileViewerPanelManager = new FileViewerPanelManager();
src/components/component-state-managers.ts:180:export const conversationMainManager = new class extends StateManager<{
src/components/component-state-managers.ts:206:export class ConversationCopyNoticeManager extends StateManager<{ copiedMessageId: string | null }> {
src/components/component-state-managers.ts:233:export const conversationCopyNoticeManager = new ConversationCopyNoticeManager();
src/components/component-state-managers.ts:235:export const workersSidebarManager = new class extends StateManager<{
src/components/component-state-managers.ts:250:export const workerCardManager = new class extends StateManager<{
src/components/component-state-managers.ts:280:export const terminalUiManager = new class extends StateManager<{
src/components/FileAttachmentPickerDialog.tsx:11:import { fileAttachmentPickerManager } from "@/components/component-state-managers";
src/components/FileAttachmentPickerDialog.tsx:12:import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
src/components/FileAttachmentPickerDialog.tsx:43:  const { search, selectedFiles } = useManagerSnapshot(fileAttachmentPickerManager);
src/components/FileAttachmentPickerDialog.tsx:60:      fileAttachmentPickerManager.reset();
src/components/FileAttachmentPickerDialog.tsx:75:    fileAttachmentPickerManager.toggleFile(filePath);
src/components/FileAttachmentPickerDialog.tsx:90:            onChange={(event) => fileAttachmentPickerManager.setSearch(event.target.value)}
src/components/Terminal.tsx:7:import { attachmentImagePreviewManager, conversationCopyNoticeManager, terminalUiManager } from "@/components/component-state-managers";
src/components/Terminal.tsx:11:  appearancePreferencesManager,
src/components/Terminal.tsx:16:} from "@/app/home/AppearancePreferencesManager";
src/components/Terminal.tsx:22:import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
src/components/Terminal.tsx:177:  const { terminalTextSize } = useManagerSnapshot(appearancePreferencesManager);
src/components/Terminal.tsx:198:              onClick={() => appearancePreferencesManager.setTerminalTextSize(level.value)}
src/components/Terminal.tsx:1046:            onClick={() => attachmentImagePreviewManager.open({ url, name: attachment.name, size: attachment.size })}
src/components/Terminal.tsx:1196:  const { toolDetailsOpenById, toolOutputExpandedById } = useManagerSnapshot(terminalUiManager);
src/components/Terminal.tsx:1210:            terminalUiManager.setToolOutputExpanded(activity.id, true);
src/components/Terminal.tsx:1212:            terminalUiManager.setToolOutputExpanded(activity.id, false);
src/components/Terminal.tsx:1214:          terminalUiManager.setToolDetailsOpen(activity.id, nextDetailsOpen);
src/components/Terminal.tsx:1284:                  onClick={() => terminalUiManager.setToolOutputExpanded(activity.id, !outputExpanded)}
src/components/Terminal.tsx:1296:                  onClick={() => terminalUiManager.setToolOutputExpanded(activity.id, !outputExpanded)}
src/components/Terminal.tsx:1379:  const { toolGroupOpenById } = useManagerSnapshot(terminalUiManager);
src/components/Terminal.tsx:1388:        onClick={() => terminalUiManager.setToolGroupOpen(activity.id, !open)}
src/components/Terminal.tsx:1459:  const { thoughtOpenById } = useManagerSnapshot(terminalUiManager);
src/components/Terminal.tsx:1467:        onClick={() => terminalUiManager.setThoughtOpen(activity.id, !open)}
src/components/Terminal.tsx:1652:  const { workSummaryOpenById } = useManagerSnapshot(terminalUiManager);
src/components/Terminal.tsx:1664:        onClick={() => terminalUiManager.setWorkSummaryOpen(activity.id, !open)}
src/components/Terminal.tsx:1745:  const { copiedMessageId } = useManagerSnapshot(conversationCopyNoticeManager);
src/components/Terminal.tsx:1992:  const { conversationTextSize, terminalTextSize } = useManagerSnapshot(appearancePreferencesManager);
src/components/home/FileViewerPanel.tsx:15:import { fileViewerPanelManager } from "@/components/component-state-managers";
src/components/home/FileViewerPanel.tsx:21:import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
src/components/home/FileViewerPanel.tsx:36:  const { wordWrap, renderMarkdown } = useManagerSnapshot(fileViewerPanelManager);
src/components/home/FileViewerPanel.tsx:95:                  onCheckedChange={() => fileViewerPanelManager.toggleRenderMarkdown()}
src/components/home/FileViewerPanel.tsx:103:                onCheckedChange={() => fileViewerPanelManager.toggleWordWrap()}
src/components/home/ConversationSidebar.tsx:20:import { StateManager } from "@/lib/state-manager";
src/components/home/ConversationSidebar.tsx:23:class ConversationSidebarHydrationManager extends StateManager<boolean> {
src/components/home/ConversationSidebar.tsx:33:const conversationSidebarHydrationManager = new ConversationSidebarHydrationManager();
src/components/home/ConversationSidebar.tsx:497:    useCallback((listener) => conversationSidebarHydrationManager.subscribe(listener), []),
src/components/home/ConversationSidebar.tsx:498:    useCallback(() => conversationSidebarHydrationManager.getSnapshot(), []),
src/components/home/ConversationSidebar.tsx:499:    () => conversationSidebarHydrationManager.getSnapshot(),
src/components/home/ConversationSidebar.tsx:502:    conversationSidebarHydrationManager.markMounted();
src/components/PlanningArtifactsPanel.tsx:7:import { planningArtifactsManager } from "@/components/component-state-managers";
src/components/PlanningArtifactsPanel.tsx:9:import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
src/components/PlanningArtifactsPanel.tsx:12:import { planningReviewPreferencesManager } from "@/app/home/PlanningReviewPreferencesManager";
src/components/PlanningArtifactsPanel.tsx:172:  const { isExpanded: isReviewPanelExpanded } = useManagerSnapshot(planningReviewPreferencesManager);
src/components/PlanningArtifactsPanel.tsx:178:  const { selectedPlanPath: managerSelectedPlanPath } = useManagerSnapshot(planningArtifactsManager);
src/components/PlanningArtifactsPanel.tsx:181:  const currentManagerSelectedPlanPath = managerSelectedPlanPath && candidatePaths.has(managerSelectedPlanPath)
src/components/PlanningArtifactsPanel.tsx:184:  const selectedPlanPath = currentManagerSelectedPlanPath || planPath || artifacts.planPath || planCandidates[0]?.path || null;
src/components/PlanningArtifactsPanel.tsx:220:    planningReviewPreferencesManager.setExpanded(false);
src/components/PlanningArtifactsPanel.tsx:275:                onClick={() => planningArtifactsManager.setSelectedPlanPath(candidate.path)}
src/components/PlanningArtifactsPanel.tsx:291:            planningReviewPreferencesManager.setExpanded(false);
src/components/PlanningArtifactsPanel.tsx:302:          onClick={() => planningReviewPreferencesManager.setExpanded(!isReviewPanelExpanded)}
src/components/home/UserInputMessage.tsx:4:import { attachmentImagePreviewManager, conversationCopyNoticeManager } from "@/components/component-state-managers";
src/components/home/UserInputMessage.tsx:9:import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
src/components/home/UserInputMessage.tsx:64:  const { copiedMessageId } = useManagerSnapshot(conversationCopyNoticeManager);
src/components/home/UserInputMessage.tsx:92:                    onClick={() => attachmentImagePreviewManager.open({ url, name: attachment.name, size: attachment.size })}
src/components/AttachmentImagePreviewDialog.tsx:5:import { attachmentImagePreviewManager } from "@/components/component-state-managers";
src/components/AttachmentImagePreviewDialog.tsx:8:import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
src/components/AttachmentImagePreviewDialog.tsx:12:  const { preview } = useManagerSnapshot(attachmentImagePreviewManager);
src/components/AttachmentImagePreviewDialog.tsx:19:          attachmentImagePreviewManager.close();
src/components/AttachmentImagePreviewDialog.tsx:44:                onClick={attachmentImagePreviewManager.close}
src/components/WorkerCard.tsx:8:import { useWorkerStream } from "@/app/home/WorkerEntriesManager";
src/components/WorkerCard.tsx:9:import { workerCardManager } from "@/components/component-state-managers";
src/components/WorkerCard.tsx:10:import { sideWindowManager } from "@/app/home/SideWindowManager";
src/components/WorkerCard.tsx:14:import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
src/components/WorkerCard.tsx:215:  const { terminalProcessesOpenByWorkerId } = useManagerSnapshot(workerCardManager);
src/components/WorkerCard.tsx:226:    workerCardManager.setTerminalProcessesOpen(workerId, !open);
src/components/WorkerCard.tsx:234:          onOpenChange={(nextOpen) => workerCardManager.setTerminalProcessesOpen(workerId, nextOpen)}
src/components/WorkerCard.tsx:322:  const { permissionOpenByWorkerId } = useManagerSnapshot(workerCardManager);
src/components/WorkerCard.tsx:335:        workerCardManager.closePermission(workerId);
src/components/WorkerCard.tsx:350:        onClick={() => workerCardManager.togglePermission(workerId)}
src/components/WorkerCard.tsx:422:  const { openByWorkerId } = useManagerSnapshot(workerCardManager);
src/components/WorkerCard.tsx:618:    <Collapsible open={open} onOpenChange={(nextOpen) => workerCardManager.setOpen(workerId, nextOpen)} className={cn(shouldFillAvailable && "flex h-full min-h-0 flex-col")}>
src/components/WorkerCard.tsx:652:                onOpenProjectFile={(file) => sideWindowManager.openFile(file)}
src/components/home/BranchWorkspaceButton.tsx:23:import { shallowEqualRecord, useManagerSelector } from "@/lib/use-manager-snapshot";
src/components/home/BranchWorkspaceButton.tsx:27:import { gitWorkspaceManager, type GitWorkspaceLaunchRequest } from "@/app/home/GitWorkspaceManager";
src/components/home/BranchWorkspaceButton.tsx:93:  return function select(snapshot: ReturnType<typeof gitWorkspaceManager.getSnapshot>) {
src/components/home/BranchWorkspaceButton.tsx:122:  const { snapshot, selectedTarget, pendingLaunch, loading, pendingOperation, activeDialog, dialogDraft, lastError } = useManagerSelector(
src/components/home/BranchWorkspaceButton.tsx:123:    gitWorkspaceManager,
src/components/home/BranchWorkspaceButton.tsx:150:      void gitWorkspaceManager.loadStatus(projectPath).catch(() => undefined);
src/components/home/BranchWorkspaceButton.tsx:157:      gitWorkspaceManager.setDialogDraft({
src/components/home/BranchWorkspaceButton.tsx:167:      gitWorkspaceManager.setDialogDraft({
src/components/home/BranchWorkspaceButton.tsx:186:    gitWorkspaceManager.confirmStartInNewWorktree(request);
src/components/home/BranchWorkspaceButton.tsx:193:    void gitWorkspaceManager.selectTarget(projectPath, targetFromWorktree(snapshot, worktree)).catch(() => undefined);
src/components/home/BranchWorkspaceButton.tsx:218:    void gitWorkspaceManager.confirmCheckout({
src/components/home/BranchWorkspaceButton.tsx:231:    void gitWorkspaceManager.confirmCreateWorktree({
src/components/home/BranchWorkspaceButton.tsx:245:    void gitWorkspaceManager.confirmRemoveWorktree({
src/components/home/BranchWorkspaceButton.tsx:304:              onClick={() => projectPath && gitWorkspaceManager.loadStatus(projectPath).catch(() => undefined)}
src/components/home/BranchWorkspaceButton.tsx:311:              onClick={() => projectPath && gitWorkspaceManager.requestStartInNewWorktree(projectPath)}
src/components/home/BranchWorkspaceButton.tsx:344:                          onClick={() => projectPath && gitWorkspaceManager.requestCheckout(projectPath, branch.name)}
src/components/home/BranchWorkspaceButton.tsx:354:                          onClick={() => projectPath && gitWorkspaceManager.requestCreateWorktree(projectPath, branch.name)}
src/components/home/BranchWorkspaceButton.tsx:390:                    onClick={() => projectPath && gitWorkspaceManager.requestRemoveWorktree(projectPath, worktree.checkoutPath)}
src/components/home/BranchWorkspaceButton.tsx:414:            gitWorkspaceManager.setKey("activeDialog", null);
src/components/home/BranchWorkspaceButton.tsx:428:                gitWorkspaceManager.setDialogBranchName(nextBranch, suggestCheckoutPath(snapshot, nextBranch));
src/components/home/BranchWorkspaceButton.tsx:433:              <Input value={checkoutPath} onChange={(event) => gitWorkspaceManager.setDialogCheckoutPath(event.target.value)} />
src/components/home/BranchWorkspaceButton.tsx:442:            <Button type="button" variant="outline" onClick={() => gitWorkspaceManager.setKey("activeDialog", null)}>
src/components/home/BranchWorkspaceButton.tsx:456:            gitWorkspaceManager.setKey("activeDialog", null);
src/components/home/BranchWorkspaceButton.tsx:474:            <Button type="button" variant="outline" onClick={() => gitWorkspaceManager.setKey("activeDialog", null)}>
src/components/home/BranchWorkspaceButton.tsx:488:            gitWorkspaceManager.setKey("activeDialog", null);
src/components/home/BranchWorkspaceButton.tsx:502:                gitWorkspaceManager.setDialogBranchName(nextBranch, suggestCheckoutPath(snapshot, nextBranch));
src/components/home/BranchWorkspaceButton.tsx:507:              <Input value={checkoutPath} onChange={(event) => gitWorkspaceManager.setDialogCheckoutPath(event.target.value)} />
src/components/home/BranchWorkspaceButton.tsx:511:            <Button type="button" variant="outline" onClick={() => gitWorkspaceManager.setKey("activeDialog", null)}>
src/components/home/BranchWorkspaceButton.tsx:525:            gitWorkspaceManager.setKey("activeDialog", null);
src/components/home/BranchWorkspaceButton.tsx:543:            <Button type="button" variant="outline" onClick={() => gitWorkspaceManager.setKey("activeDialog", null)}>
src/components/LanguageSelect.tsx:4:import { i18nManager, supportedLocaleOptions, t, useI18nSnapshot, type OmniLocale } from "@/lib/i18n";
src/components/LanguageSelect.tsx:11:    void i18nManager.setLocaleAsync(value as OmniLocale);
src/components/home/SideWindow.tsx:6:import { sideWindowManager, type SideWindowFileTab } from "@/app/home/SideWindowManager";
src/components/home/SideWindow.tsx:10:import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
src/components/home/SideWindow.tsx:46:  const { tabs, activeTabId } = useManagerSnapshot(sideWindowManager);
src/components/home/SideWindow.tsx:110:                    sideWindowManager.closeTab(tab.id);
src/components/home/SideWindow.tsx:118:                onClick={() => sideWindowManager.selectTab(tab.id)}
src/components/home/ConversationMain.tsx:20:import { conversationCopyNoticeManager, conversationMainManager } from "@/components/component-state-managers";
src/components/home/ConversationMain.tsx:29:import { shallowEqualRecord, useManagerSelector, useManagerSnapshot } from "@/lib/use-manager-snapshot";
src/components/home/ConversationMain.tsx:32:import { gitWorkspaceManager, type GitWorkspaceLaunchRequest } from "@/app/home/GitWorkspaceManager";
src/components/home/ConversationMain.tsx:33:import { preflightConfirmationActionsManager } from "@/app/home/PreflightConfirmationActionsManager";
src/components/home/ConversationMain.tsx:34:import { useWorkerStream } from "@/app/home/WorkerEntriesManager";
src/components/home/ConversationMain.tsx:35:import { useConversationTranscript } from "@/app/home/ConversationTranscriptManager";
src/components/home/ConversationMain.tsx:177:  const { runLogOpenByRunId } = useManagerSnapshot(conversationMainManager);
src/components/home/ConversationMain.tsx:194:          conversationMainManager.setRunLogOpen(runId, nextOpen);
src/components/home/ConversationMain.tsx:485:  const { fullOutputOpenByMessageId } = useManagerSnapshot(conversationMainManager);
src/components/home/ConversationMain.tsx:501:    <Collapsible open={fullOutputOpen} onOpenChange={(open) => conversationMainManager.setFullOutputOpen(message.id, open)}>
src/components/home/ConversationMain.tsx:778:  const { hasOutputBelow } = useManagerSnapshot(conversationMainManager);
src/components/home/ConversationMain.tsx:779:  const { handledMessageIds: handledPreflightConfirmationMessageIds } = useManagerSnapshot(preflightConfirmationActionsManager);
src/components/home/ConversationMain.tsx:836:    return (state: ReturnType<typeof gitWorkspaceManager.getSnapshot>) => {
src/components/home/ConversationMain.tsx:851:  const { dialog: forkWorkspaceDialog, snapshot: forkWorkspaceSnapshot, loading: forkWorkspaceLoading, pendingOperation: forkWorkspacePendingOperation, dialogDraft: forkWorkspaceDraft, lastError: forkWorkspaceError } = useManagerSelector(
src/components/home/ConversationMain.tsx:852:    gitWorkspaceManager,
src/components/home/ConversationMain.tsx:862:    void gitWorkspaceManager.loadStatus(forkWorkspaceDialog.projectPath).catch(() => undefined);
src/components/home/ConversationMain.tsx:869:    gitWorkspaceManager.setDialogDraft({
src/components/home/ConversationMain.tsx:877:      conversationCopyNoticeManager.showCopiedMessage(messageId);
src/components/home/ConversationMain.tsx:1184:                                preflightConfirmationActionsManager.rememberMessage(msg.id);
src/components/home/ConversationMain.tsx:1196:                              onClick={() => preflightConfirmationActionsManager.rememberMessage(msg.id)}
src/components/home/ConversationMain.tsx:1339:        gitWorkspaceManager.setKey("activeDialog", null);
src/components/home/ConversationMain.tsx:1353:            gitWorkspaceManager.setDialogBranchName(nextBranch, suggestCheckoutPath(forkWorkspaceSnapshot?.repoRoot, nextBranch));
src/components/home/ConversationMain.tsx:1358:          <Input value={forkCheckoutPath} onChange={(event) => gitWorkspaceManager.setDialogCheckoutPath(event.target.value)} />
src/components/home/ConversationMain.tsx:1368:        <Button type="button" variant="outline" onClick={() => gitWorkspaceManager.setKey("activeDialog", null)}>
src/components/home/WorkersSidebar.tsx:6:import { workersSidebarManager } from "@/components/component-state-managers";
src/components/home/WorkersSidebar.tsx:12:import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
src/components/home/WorkersSidebar.tsx:134:  const { activeTab: requestedActiveTab, focusedWorkerId } = useManagerSnapshot(workersSidebarManager);
src/components/home/WorkersSidebar.tsx:178:        onToggleFocus={() => workersSidebarManager.toggleFocusedWorker(worker.id)}
src/components/home/WorkersSidebar.tsx:193:          workersSidebarManager.setFocusedWorker(null);
src/components/home/WorkersSidebar.tsx:226:            onClick={() => workersSidebarManager.setActiveTab("active")}
src/components/home/WorkersSidebar.tsx:238:            onClick={() => workersSidebarManager.setActiveTab("finished")}
src/components/home/ConversationComposer.tsx:18:import { StateManager } from "@/lib/state-manager";
src/components/home/ConversationComposer.tsx:19:import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
src/components/home/ConversationComposer.tsx:71:class ComposerUiManager extends StateManager<{ mobileSettingsOpen: boolean }> {
src/components/home/ConversationComposer.tsx:79:const composerUiManager = new ComposerUiManager();
src/components/home/ConversationComposer.tsx:133:  const { mobileSettingsOpen } = useManagerSnapshot(composerUiManager);
src/components/home/ConversationComposer.tsx:506:            onClick={() => composerUiManager.setMobileSettingsOpen(true)}
src/components/home/ConversationComposer.tsx:576:      <Sheet open={mobileSettingsOpen} onOpenChange={composerUiManager.setMobileSettingsOpen}>
src/components/settings/AppearanceSettingsPanel.tsx:2:  appearancePreferencesManager,
src/components/settings/AppearanceSettingsPanel.tsx:7:} from "@/app/home/AppearancePreferencesManager";
src/components/settings/AppearanceSettingsPanel.tsx:9:import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
src/components/settings/AppearanceSettingsPanel.tsx:93:  const { uiTextSize, conversationTextSize, terminalTextSize } = useManagerSnapshot(appearancePreferencesManager);
src/components/settings/AppearanceSettingsPanel.tsx:108:          onChange={(nextValue) => appearancePreferencesManager.setUiTextSize(nextValue)}

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:37:36.642Z","phase":null} -->
## Tool result: call_M0iqXnQkA3udEHWtZ4UvpulP · 2026-06-14T15:37:36.642Z

```text
Chunk ID: 628be2
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 6618
Output:
src/app/providers.tsx:9:function makeQueryClient() {
src/app/providers.tsx:10:  return new QueryClient();
src/app/providers.tsx:13:const queryClient = makeQueryClient();
src/app/providers.tsx:16:  useEffect(() => {
src/components/PairDeviceDialog.tsx:77:  } = useManagerSnapshot(pairDeviceManager) as PairingState<PairCreateResponse, PairStatusResponse["pairing"]["status"]>;
src/components/PairDeviceDialog.tsx:102:    const draft = createLocalPairingDraft({
src/components/PairDeviceDialog.tsx:177:  useEffect(() => {
src/components/PairDeviceDialog.tsx:191:  useEffect(() => {
src/components/PairDeviceDialog.tsx:200:  useEffect(() => {
src/components/PairDeviceDialog.tsx:208:        const data = await requestJson<PairStatusResponse>(`/api/auth/pair?id=${encodeURIComponent(pairing.pairingId)}`, undefined, {
src/components/PairDeviceDialog.tsx:226:  useEffect(() => {
src/components/PairDeviceDialog.tsx:228:      pairDeviceManager.reset();
src/components/PairDeviceDialog.tsx:236:    await navigator.clipboard.writeText(pairing.pairUrl);
src/lib/conversation-state.ts:46:  const status = run.status?.trim().toLowerCase().split(":")[0]?.trim() ?? "";
src/lib/run-status.ts:1:const TERMINAL_RUN_STATUSES = new Set(["done", "failed", "cancelled", "promoting", "promoted"]);
src/lib/run-status.ts:2:const ARCHIVABLE_RUN_STATUSES = new Set(["done", "failed", "cancelled", "canceled", "promoted"]);
src/lib/i18n.ts:12:export function useI18nSnapshot() {
src/lib/i18n.ts:15:    useCallback(() => i18nManager.getSnapshot(), []),
src/lib/i18n.ts:16:    () => i18nManager.getSnapshot(),
src/lib/syntax-highlighting.ts:80:  const basename = normalized.split("/").filter(Boolean).at(-1) ?? normalized;
src/lib/syntax-highlighting.ts:87:    ? basename.split(".").at(-1)?.toLowerCase()
src/lib/syntax-highlighting.ts:100:    return hljs.highlight(source, { language, ignoreIllegals: true }).value;
src/lib/i18n-core.ts:7:  es: async () => (await import("../../shared/locales/es.json")).default,
src/lib/i18n-core.ts:8:  fr: async () => (await import("../../shared/locales/fr.json")).default,
src/lib/i18n-core.ts:9:  de: async () => (await import("../../shared/locales/de.json")).default,
src/lib/i18n-core.ts:10:  it: async () => (await import("../../shared/locales/it.json")).default,
src/lib/i18n-core.ts:11:  pt: async () => (await import("../../shared/locales/pt.json")).default,
src/lib/i18n-core.ts:12:  "zh-CN": async () => (await import("../../shared/locales/zh-CN.json")).default,
src/lib/i18n-core.ts:13:  ja: async () => (await import("../../shared/locales/ja.json")).default,
src/lib/i18n-core.ts:14:  ko: async () => (await import("../../shared/locales/ko.json")).default,
src/lib/i18n-core.ts:27:function sameI18nSnapshot(left: I18nSnapshot<OmniLocale>, right: I18nSnapshot<OmniLocale>) {
src/lib/i18n-core.ts:43:  let cachedSnapshot = getUncachedSnapshot();
src/lib/i18n-core.ts:46:    const nextSnapshot = getUncachedSnapshot();
src/lib/i18n-core.ts:48:    if (sameI18nSnapshot(cachedSnapshot, nextSnapshot)) {
src/lib/i18n-core.ts:90:    return i18nManager.t(...args);
src/lib/i18n-core.ts:97:  return i18nManager.getSnapshot().supportedLocales.map((locale) => ({
src/lib/i18n-core.ts:99:    label: t(`language.${locale}`),
src/lib/state-manager.ts:12:  getSnapshot() {
src/lib/worker-stuck-events.ts:7:const STUCK_RESOLVING_EVENT_TYPES = new Set([
src/lib/worker-stuck-events.ts:16:const RUN_TERMINAL_EVENT_TYPES = new Set([
src/lib/worker-stuck-events.ts:58:    latestResolvingEventByWorker.set(worker, Math.max(
src/lib/worker-stuck-events.ts:59:      latestResolvingEventByWorker.get(worker) ?? Number.NEGATIVE_INFINITY,
src/lib/worker-stuck-events.ts:79:    const latestResolvingEventMs = latestResolvingEventByWorker.get(worker);
src/lib/worker-stuck-events.ts:87:    .sort((a, b) => eventTimeMs(b) - eventTimeMs(a))
src/lib/mentions.ts:16:  if (!/\s/.test(charBeforeMention)) {
src/lib/mentions.ts:21:  if (/\s/.test(query)) {
src/components/FolderPickerDialog.tsx:13:import { t, useI18nSnapshot } from "@/lib/i18n";
src/components/FolderPickerDialog.tsx:24:  useI18nSnapshot();
src/components/FolderPickerDialog.tsx:25:  const { currentPath, search } = useManagerSnapshot(folderPickerManager);
src/components/FolderPickerDialog.tsx:30:      const url = currentPath ? `/api/fs?path=${encodeURIComponent(currentPath)}` : "/api/fs";
src/components/FolderPickerDialog.tsx:60:            <DialogTitle>{t("folder.picker.title")}</DialogTitle>
src/components/FolderPickerDialog.tsx:61:            <div className="mt-1 truncate text-xs text-muted-foreground" title={data?.current || t("folder.picker.loading")}>
src/components/FolderPickerDialog.tsx:62:              {data?.current || t("folder.picker.loading")}
src/components/FolderPickerDialog.tsx:68:            placeholder={t("folder.picker.searchPlaceholder")}
src/components/FolderPickerDialog.tsx:72:            {t(
src/components/FolderPickerDialog.tsx:82:              <div className="font-semibold text-destructive">{t("folder.picker.errorTitle")}</div>
src/components/FolderPickerDialog.tsx:113:          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>{t("folder.picker.cancel")}</Button>
src/components/FolderPickerDialog.tsx:115:            if (data?.current) onSelect(data.current);
src/components/FolderPickerDialog.tsx:118:            {t("folder.picker.select")}
src/lib/app-errors.ts:111:      payload = await response.text();
src/lib/app-errors.ts:132:  const response = await fetch(input, init);
src/lib/app-errors.ts:153:    byKey.set(appErrorKey(error), error);
src/components/BootShell.tsx:4:import { t, useI18nSnapshot } from "@/lib/i18n";
src/components/BootShell.tsx:7:  useI18nSnapshot();
src/components/BootShell.tsx:16:        aria-label={t("boot.loading.aria")}
src/components/BootShell.tsx:25:          <h1 className="text-sm font-medium tracking-normal text-foreground">{t("product.name")}</h1>
src/components/BootShell.tsx:26:          <p className="text-sm text-muted-foreground">{t("boot.loading.message")}</p>
src/lib/project-file-links.ts:8:const LOCALHOST_NAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
src/lib/project-file-links.ts:11:  return decodeURIComponent(value)
src/lib/project-paths.ts:20:  return Array.from(new Set(
src/lib/project-paths.ts:52:      directRunCounts.set(matchingExplicitProject, (directRunCounts.get(matchingExplicitProject) ?? 0) + 1);
src/lib/project-paths.ts:63:    (directRunCounts.get(projectPath) ?? 0) === 0
src/lib/project-paths.ts:69:export function resolveStoredProjectRoot(
src/lib/use-manager-snapshot.ts:9:    useCallback(() => manager.getSnapshot(), [manager]),
src/lib/use-manager-snapshot.ts:10:    () => manager.getSnapshot(),
src/lib/use-manager-snapshot.ts:43:    const state = manager.getSnapshot();
src/app/globals.css:244:    background: linear-gradient(
src/components/home/RecoveryIncidentInspector.tsx:7:import { t, useI18nSnapshot } from "@/lib/i18n";
src/components/home/RecoveryIncidentInspector.tsx:10:  if (!value) return t("recovery.inspector.notResolved");
src/components/home/RecoveryIncidentInspector.tsx:13:    ? new Intl.DateTimeFormat("en-GB", {
src/components/home/RecoveryIncidentInspector.tsx:16:    }).format(date)
src/components/home/RecoveryIncidentInspector.tsx:36:  useI18nSnapshot();
src/components/home/RecoveryIncidentInspector.tsx:37:  const { runLogOpenByRunId } = useManagerSnapshot(conversationMainManager);
src/components/home/RecoveryIncidentInspector.tsx:47:      <div className="rounded-lg border border-border/70 bg-muted/20 text-sm" aria-label={t("recovery.inspector.ariaLabel")}>
src/components/home/RecoveryIncidentInspector.tsx:51:            {t("recovery.inspector.title")}
src/components/home/RecoveryIncidentInspector.tsx:68:                        {t("recovery.inspector.detectedUpdated", {
src/components/home/RecoveryIncidentInspector.tsx:75:                      {t("recovery.inspector.attempts", { count: incident.autoAttemptCount })}
src/components/home/RecoveryIncidentInspector.tsx:79:                    {incident.workerId ? <div><dt className="inline font-medium">{t("recovery.inspector.worker")}</dt> <dd className="inline font-mono">{incident.workerId}</dd></div> : null}
src/components/home/RecoveryIncidentInspector.tsx:80:                    {incident.queuedMessageId ? <div><dt className="inline font-medium">{t("recovery.inspector.queuedMessage")}</dt> <dd className="inline font-mono">{incident.queuedMessageId}</dd></div> : null}
src/components/home/RecoveryIncidentInspector.tsx:81:                    {incident.lastError ? <div><dt className="inline font-medium">{t("recovery.inspector.error")}</dt> <dd className="inline break-words">{incident.lastError}</dd></div> : null}
src/components/home/RecoveryIncidentInspector.tsx:82:                    {details?.decision ? <div><dt className="inline font-medium">{t("recovery.inspector.policy")}</dt> <dd className="inline">{String(details.decision)}</dd></div> : null}
src/components/home/RecoveryIncidentInspector.tsx:83:                    {details?.summary ? <div><dt className="inline font-medium">{t("recovery.inspector.summary")}</dt> <dd className="inline">{String(details.summary)}</dd></div> : null}
src/components/home/RecoveryIncidentInspector.tsx:84:                    {details?.resumeAt ? <div><dt className="inline font-medium">{t("recovery.inspector.resumeAt")}</dt> <dd className="inline">{formatTime(String(details.resumeAt))}</dd></div> : null}
src/components/home/RecoveryIncidentInspector.tsx:85:                    {details?.quotaResetSource ? <div><dt className="inline font-medium">{t("recovery.inspector.source")}</dt> <dd className="inline">{String(details.quotaResetSource)}</dd></div> : null}
src/components/home/RecoveryIncidentInspector.tsx:86:                    {details?.quotaResetConfidence ? <div><dt className="inline font-medium">{t("recovery.inspector.confidence")}</dt> <dd className="inline">{String(details.quotaResetConfidence)}</dd></div> : null}
src/components/home/RecoveryIncidentInspector.tsx:87:                    {details?.scheduledWakeAt ? <div><dt className="inline font-medium">{t("recovery.inspector.scheduledWake")}</dt> <dd className="inline">{formatTime(String(details.scheduledWakeAt))}</dd></div> : null}
src/components/home/RecoveryIncidentInspector.tsx:88:                    {details?.rawText ? <div><dt className="inline font-medium">{t("recovery.inspector.providerMessage")}</dt> <dd className="inline break-words">{String(details.rawText)}</dd></div> : null}
src/components/home/RecoveryIncidentInspector.tsx:89:                    {incident.resolvedAt ? <div><dt className="inline font-medium">{t("recovery.inspector.resolved")}</dt> <dd className="inline">{formatTime(incident.resolvedAt)}</dd></div> : null}
src/lib/local-pairing-token.ts:22:function createPairSecret() {
src/lib/local-pairing-token.ts:34:  return `${args.origin.replace(/\/+$/, "")}${targetPath}${targetPath.includes("?") ? "&" : "?"}pair=${encodeURIComponent(args.pairToken)}`;
src/lib/local-pairing-token.ts:37:export function createLocalPairingDraft(args: {
src/lib/local-pairing-token.ts:43:  const pairToken = `${pairingId}.${createPairSecret()}`;
src/lib/worker-terminal-processes.ts:47:function quoteCommandPart(value: string): string {
src/lib/worker-terminal-processes.ts:48:  if (/^[A-Za-z0-9_./:=@%+-]+$/.test(value)) {
src/lib/worker-terminal-processes.ts:72:function normalizeMultilineText(value: string): string {
src/lib/worker-terminal-processes.ts:115:function extractContentText(value: unknown): string | null {
src/lib/worker-terminal-processes.ts:157:      return normalizeMultilineText(command);
src/lib/worker-terminal-processes.ts:231:function extractOutputText(raw: Record<string, unknown> | null): string | null {
src/lib/worker-terminal-processes.ts:249:    extractContentText(raw.content),
src/lib/worker-terminal-processes.ts:256:      return normalizeMultilineText(text);
src/lib/worker-terminal-processes.ts:264:  const normalized = normalizeMultilineText(value);
src/lib/worker-terminal-processes.ts:278:  return Boolean(value && TERMINAL_TOOL_KIND_PATTERN.test(value));
src/lib/worker-terminal-processes.ts:282:  return Boolean(value && NON_TERMINAL_TOOL_KIND_PATTERN.test(value));
src/lib/worker-terminal-processes.ts:285:export function isWorkerTerminalToolCallStart(entry: AgentOutputEntry): boolean {
src/lib/worker-terminal-processes.ts:338:  const output = extractOutputText(raw);
src/lib/worker-terminal-processes.ts:397:    const existingProcess = processesById.get(nextProcess.id);
src/lib/worker-terminal-processes.ts:401:      processesById.set(nextProcess.id, nextProcess);
src/lib/worker-terminal-processes.ts:410:    .sort((left, right) => {
src/lib/planning-output.ts:6:export function isPlannerHandoffText(text: string) {
src/lib/planning-output.ts:7:  return /<omniharness-plan-handoff\b[\s\S]*?<\/omniharness-plan-handoff>/i.test(text.trim());
src/lib/planning-output.ts:11:  return activity.kind !== "message" || !isPlannerHandoffText(activity.text ?? "");
src/components/home/ThemeModeToggle.tsx:4:import { t, useI18nSnapshot } from "@/lib/i18n";
src/components/home/ThemeModeToggle.tsx:12:  useI18nSnapshot();
src/components/home/ThemeModeToggle.tsx:13:  const label = t(themeMode === "night" ? "theme.mode.switchDay" : "theme.mode.switchNight");
src/lib/pwa.ts:4:function isLocalhost(hostname: string) {
src/lib/pwa.ts:19:    (window.isSecureContext || isLocalhost(window.location.hostname))
src/app/api/supervisor/route.ts:4:export const POST = adaptOmniHandlerToNext(handleSupervisorRequest, { surface: "web" });
src/lib/project-scope.ts:27:  const projectRoot = resolveStoredProjectRoot(run?.projectPath, args.explicitProjects, { staleFallbackProject });
src/lib/project-scope.ts:39:      const folderName = projectPath.split("/").pop() || projectPath;
src/lib/chat-attachments.ts:29:export function normalizeChatAttachment(value: unknown): ChatAttachment | null {
src/lib/chat-attachments.ts:39:  const fallbackName = rawStoragePath?.split(/[/\\]/).filter(Boolean).pop();
src/lib/chat-attachments.ts:131:export function formatAttachmentContext(
src/lib/chat-attachments.ts:152:export function appendAttachmentContext(
src/lib/chat-attachments.ts:157:  const context = formatAttachmentContext(attachments, options);
src/lib/commit-workflow.ts:37:export function getManualCommitPrompt(action: ManualCommitAction) {
src/lib/commit-workflow.ts:41:export function getManualProjectCommitPrompt(action: ManualCommitAction) {
src/lib/agent-output.ts:23:const TERMINAL_TOOL_STATUSES = new Set(["completed", "failed", "cancelled", "canceled", "done", "error"]);
src/lib/agent-output.ts:24:const RUNNING_TOOL_STATUSES = new Set(["pending", "in_progress", "working"]);
src/lib/agent-output.ts:25:const ACTIVE_THINKING_AGENT_STATES = new Set(["starting", "working", "recovering"]);
src/lib/agent-output.ts:121:function normalizeMultilineText(value: string): string {
src/lib/agent-output.ts:139:  const normalized = normalizeMultilineText(value).trim();
src/lib/agent-output.ts:152:  const lines = value.split("\n");
src/lib/agent-output.ts:158:  const numberedLines = contentLines.filter((line) => /^\s*\d+\s{2,}\S/.test(line)).length;
src/lib/agent-output.ts:166:function cleanPaneText(value: string | null): string | null {
src/lib/agent-output.ts:180:  const text = normalizeMultilineText(value ?? "");
src/lib/agent-output.ts:182:  return cleanPaneText(match?.[1] ?? text);
src/lib/agent-output.ts:194:    const text = cleanPaneText(entry.text);
src/lib/agent-output.ts:219:function outputEntryFingerprint(entry: AgentOutputEntry): string {
src/lib/agent-output.ts:243:    return /^\s/.test(text)
src/lib/agent-output.ts:244:      || /\s$/.test(text)
src/lib/agent-output.ts:245:      || /^[`.,:;!?()[\]{}<>=+\-_/\\\n]/.test(text);
src/lib/agent-output.ts:255:    text: entries.map((entry) => normalizeMultilineText(entry.text ?? "")).join(""),
src/lib/agent-output.ts:289:function stringifyToolRawOutput(value: unknown): string | null {
src/lib/agent-output.ts:298:function extractContentText(value: unknown): string | null {
src/lib/agent-output.ts:369:  const segments = value.split(/[/\\]/).filter(Boolean);
src/lib/agent-output.ts:376:  return path && /[/\\]/.test(path) ? path : null;
src/lib/agent-output.ts:395:function summarizePromptLikeInput(raw: Record<string, unknown> | null): string | null {
src/lib/agent-output.ts:401:  const firstContentText = extractContentText(raw.content);
src/lib/agent-output.ts:419:      return normalizeMultilineText(candidate).trim();
src/lib/agent-output.ts:426:function extractCommandLikeInput(raw: Record<string, unknown> | null): string | null {
src/lib/agent-output.ts:441:      return normalizeMultilineText(candidate).trim();
src/lib/agent-output.ts:448:function extractDescriptionLikeInput(raw: Record<string, unknown> | null): string | null {
src/lib/agent-output.ts:454:  const firstContentText = extractContentText(raw.content);
src/lib/agent-output.ts:463:      return normalizeMultilineText(candidate).trim();
src/lib/agent-output.ts:471:  if (!path || /^(?:diff --|--- |\+\+\+ )/m.test(diff) || diff.includes(path)) {
src/lib/agent-output.ts:478:  const normalized = normalizeMultilineText(value).trim();
src/lib/agent-output.ts:480:    /^@@\s/m.test(normalized)
src/lib/agent-output.ts:481:    || /^diff --/m.test(normalized)
src/lib/agent-output.ts:482:    || /^\*\*\* (?:Begin Patch|Update File|Add File|Delete File)/m.test(normalized)
src/lib/agent-output.ts:491:  return normalizeMultilineText(value).trim();
src/lib/agent-output.ts:499:  const normalized = normalizeMultilineText(value);
src/lib/agent-output.ts:504:  const lines = normalized.split("\n").map((line) => `${marker}${line}`).join("\n");
src/lib/agent-output.ts:519:  const removed = oldString.split("\n").map((line) => `-${line}`).join("\n");
src/lib/agent-output.ts:520:  const added = newString.split("\n").map((line) => `+${line}`).join("\n");
src/lib/agent-output.ts:521:  return `${pathPrefixForDiff(path, "")}@@ -1,${oldString.split("\n").length} +1,${newString.split("\n").length} @@\n${removed}\n${added}`;
src/lib/agent-output.ts:536:      table[at(oldIndex, newIndex)] = oldLines[oldIndex] === newLines[newIndex]
src/lib/agent-output.ts:537:        ? table[at(oldIndex + 1, newIndex + 1)] + 1
src/lib/agent-output.ts:538:        : Math.max(table[at(oldIndex + 1, newIndex)], table[at(oldIndex, newIndex + 1)]);
src/lib/agent-output.ts:558:    if (table[at(oldIndex + 1, newIndex)] >= table[at(oldIndex, newIndex + 1)]) {
src/lib/agent-output.ts:637:    .sort(([left], [right]) => left.localeCompare(right))
src/lib/agent-output.ts:662:  const oldString = typeof oldValue === "string" ? normalizeMultilineText(oldValue) : null;
src/lib/agent-output.ts:663:  const newString = typeof newValue === "string" ? normalizeMultilineText(newValue) : null;
src/lib/agent-output.ts:668:  const oldLines = oldString.split("\n");
src/lib/agent-output.ts:669:  const newLines = newString.split("\n");
src/lib/agent-output.ts:777:  const uniqueDiffs = [...new Set(diffs)];
src/lib/agent-output.ts:783:  if (/\b(read|open|view)\b/.test(haystack)) {
src/lib/agent-output.ts:786:  if (/\b(agent|delegate|dispatch|spawn|worker)\b/.test(haystack)) {
src/lib/agent-output.ts:789:  if (/\b(edit|write|replace|patch|create)\b/.test(haystack)) {
src/lib/agent-output.ts:792:  if (/\b(execute|terminal|shell|bash|command|run)\b/.test(haystack)) {
src/lib/agent-output.ts:795:  if (/\b(search|find|grep|glob)\b/.test(haystack)) {
src/lib/agent-output.ts:824:  const promptLike = extractDescriptionLikeInput(raw) || summarizePromptLikeInput(raw);
src/lib/agent-output.ts:849:  const promptLike = extractCommandLikeInput(raw) || summarizePromptLikeInput(raw);
src/lib/agent-output.ts:856:    const text = cleanPaneText(promptLike);
src/lib/agent-output.ts:881:  const contentText = extractContentText(raw?.content);
src/lib/agent-output.ts:882:  const rawOutputText = stringifyToolRawOutput(rawOutput);
src/lib/agent-output.ts:897:  const text = cleanPaneText(metaOutputText || contentText || rawOutputText || summaryTail);
src/lib/agent-output.ts:953:function permissionDisplayText(entry: AgentOutputEntry, detail: string | null | undefined): string {
src/lib/agent-output.ts:954:  if (detail || /^Permission (?:requested|approved|denied|cancelled|canceled)\b/i.test(entry.text)) {
src/lib/agent-output.ts:957:  return normalizeMultilineText(entry.text || "").trim();
src/lib/agent-output.ts:979:    || FALLBACK_TOOL_TITLE_PATTERN.test(value);
src/lib/agent-output.ts:1164:    .split(/[_\s]+/)
src/lib/agent-output.ts:1166:    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
src/lib/agent-output.ts:1197:    const fingerprint = outputEntryFingerprint(entry);
src/lib/agent-output.ts:1204:      const text = normalizeMultilineText(entry.text || "").trim();
src/lib/agent-output.ts:1209:      const existingThought = thoughtLocationById.get(entry.id);
src/lib/agent-output.ts:1217:        thoughtLocationById.set(entry.id, {
src/lib/agent-output.ts:1230:        thoughtLocationById.set(entry.id, { activity: openThinking, index: 0 });
src/lib/agent-output.ts:1239:      const text = normalizeMultilineText(entry.text || "").trim();
src/lib/agent-output.ts:1244:      const existingIndex = messageIndexById.get(entry.id);
src/lib/agent-output.ts:1254:      messageIndexById.set(entry.id, items.length);
src/lib/agent-output.ts:1265:      const text = normalizeMultilineText(entry.text || "").trim();
src/lib/agent-output.ts:1274:        permissionDetailByRequestId.set(requestId, directDetail);
src/lib/agent-output.ts:1276:      const detail = directDetail ?? (requestId !== null ? permissionDetailByRequestId.get(requestId) ?? null : null);
src/lib/agent-output.ts:1277:      const existingIndex = requestId !== null ? permissionIndexByRequestId.get(requestId) : undefined;
src/lib/agent-output.ts:1283:          permissionActivity.text = permissionDisplayText(entry, detail);
src/lib/agent-output.ts:1291:        permissionIndexByRequestId.set(requestId, items.length);
src/lib/agent-output.ts:1297:        text: permissionDisplayText(entry, detail),
src/lib/agent-output.ts:1308:      const existingIndex = toolIndexById.get(key);
src/lib/agent-output.ts:1318:      toolIndexById.set(key, items.length);
src/lib/agent-output.ts:1326:      const existingIndex = toolIndexById.get(key);
src/lib/agent-output.ts:1336:      toolIndexById.set(key, items.length);
src/lib/agent-output.ts:1342:    const latestEntryTimestamp = outputEntries.at(-1)?.timestamp || openThinking.timestamp;
src/lib/agent-output.ts:1347:    const liveText = cleanPaneText(snapshot.currentText || snapshot.lastText || snapshot.displayText || null);
src/components/LoginShell.tsx:9:import { t, useI18nSnapshot } from "@/lib/i18n";
src/components/LoginShell.tsx:28:  useI18nSnapshot();
src/components/LoginShell.tsx:29:  const { password } = useManagerSnapshot(loginShellManager);
src/components/LoginShell.tsx:31:  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
src/components/LoginShell.tsx:32:    event.preventDefault();
src/components/LoginShell.tsx:33:    await onSubmit(password);
src/components/LoginShell.tsx:37:    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_38%),linear-gradient(180deg,_rgba(248,250,252,1),_rgba(241,245,249,1))] px-4 py-8 dark:bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.14),_transparent_40%),linear-gradient(180deg,_rgba(24,24,27,1),_rgba(10,10,10,1))]">
src/components/LoginShell.tsx:44:            <h1 className="text-xl font-semibold tracking-tight text-foreground">{t("product.name")}</h1>
src/components/LoginShell.tsx:47:                ? t("login.pair.description")
src/components/LoginShell.tsx:48:                : t("login.password.description")}
src/components/LoginShell.tsx:57:              <span>{t("login.pair.redeemingCode")}</span>
src/components/LoginShell.tsx:67:            <div className="font-semibold text-destructive">{t("login.configError.title")}</div>
src/components/LoginShell.tsx:76:                {t("login.password.label")}
src/components/LoginShell.tsx:84:                placeholder={t("login.password.placeholder")}
src/components/LoginShell.tsx:97:              {t("login.submit")}
src/lib/conversations.ts:32:function findMatchingProject(planPath: string, explicitProjects: string[]) {
src/lib/conversations.ts:35:      const folderName = projectPath.split("/").pop() || projectPath;
src/lib/conversations.ts:55:      const projectPath = resolveStoredProjectRoot(run.projectPath, args.explicitProjects, { staleFallbackProject })
src/lib/conversations.ts:56:        ?? (plan ? findMatchingProject(plan.path, args.explicitProjects) : null);
src/lib/conversations.ts:74:    groups.set(normalizedPath, {
src/lib/conversations.ts:76:      name: normalizedPath.split("/").pop() || normalizedPath,
src/lib/conversations.ts:87:      groups.set(run.groupPath, {
src/lib/conversations.ts:89:        name: t("conversation.sidebar.otherSessions"),
src/lib/conversations.ts:95:    groups.set(run.groupPath, {
src/lib/conversations.ts:97:      name: run.groupPath.split("/").pop() || run.groupPath,
src/lib/conversations.ts:134:      name: t("conversation.sidebar.otherSessions"),
src/components/component-state-managers.ts:106:    this.activeStatusPoll = pairingIdentifier(this.getSnapshot().pairing) === pairingId
src/components/component-state-managers.ts:215:      clearTimeout(this.clearTimer);
src/components/component-state-managers.ts:219:    this.clearTimer = setTimeout(() => {
src/components/component-state-managers.ts:225:    if (this.getSnapshot().copiedMessageId !== messageId) {
src/components/FileAttachmentPickerDialog.tsx:13:import { t, useI18nSnapshot } from "@/lib/i18n";
src/components/FileAttachmentPickerDialog.tsx:42:  useI18nSnapshot();
src/components/FileAttachmentPickerDialog.tsx:43:  const { search, selectedFiles } = useManagerSnapshot(fileAttachmentPickerManager);
src/components/FileAttachmentPickerDialog.tsx:48:      const url = rootPath ? `/api/fs/files?root=${encodeURIComponent(rootPath)}` : "/api/fs/files";
src/components/FileAttachmentPickerDialog.tsx:58:  useEffect(() => {
src/components/FileAttachmentPickerDialog.tsx:60:      fileAttachmentPickerManager.reset();
src/components/FileAttachmentPickerDialog.tsx:91:            placeholder={t("file.picker.searchPlaceholder")}

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:37:36.676Z","phase":null} -->
## Tool result: call_qpegtHHHxErFuACKpZaaRnxa · 2026-06-14T15:37:36.676Z

```text
Chunk ID: ccae2e
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2297
Output:
docs/superpowers/journeys/2026-05-13-branch-workspace-management.md
docs/superpowers/learnings/2026-05-20-auto-resume-current-facts.md
docs/superpowers/learnings/2026-05-20-background-turn-cleanup-ownership.md
docs/superpowers/learnings/2026-05-20-catalog-hot-path-conversation-load.md
docs/superpowers/learnings/2026-05-20-commit-conversation-initial-mode.md
docs/superpowers/learnings/2026-05-20-composer-stop-state-run-ownership.md
docs/superpowers/learnings/2026-05-20-dev-proxy-upgrade-socket-errors.md
docs/superpowers/learnings/2026-05-20-direct-active-stream-stop-and-refresh.md
docs/superpowers/learnings/2026-05-20-direct-adapter-stale-working.md
docs/superpowers/learnings/2026-05-20-direct-current-text-terminal-thinking.md
docs/superpowers/learnings/2026-05-20-durable-wake-backup-failures-must-be-observed.md
docs/superpowers/learnings/2026-05-20-git-workspace-errors-are-project-owned.md
docs/superpowers/learnings/2026-05-20-hot-snapshot-routes-must-avoid-cold-heavy-imports.md
docs/superpowers/learnings/2026-05-20-http-stop-paths-must-emit-named-events.md
docs/superpowers/learnings/2026-05-20-idle-live-current-text-is-not-work.md
docs/superpowers/learnings/2026-05-20-initial-worker-spawn-failures-need-terminal-state.md
docs/superpowers/learnings/2026-05-20-loaded-empty-worker-stream-is-not-authority.md
docs/superpowers/learnings/2026-05-20-manual-stop-is-control-plane.md
docs/superpowers/learnings/2026-05-20-mutation-result-navigation-ownership.md
docs/superpowers/learnings/2026-05-20-native-terminal-pending-scroll.md
docs/superpowers/learnings/2026-05-20-not-modified-snapshots-still-need-stream-cursors.md
docs/superpowers/learnings/2026-05-20-notmodified-poll-must-honor-active-flag.md
docs/superpowers/learnings/2026-05-20-observer-polls-need-generation-ownership.md
docs/superpowers/learnings/2026-05-20-open-sse-is-not-authoritative.md
docs/superpowers/learnings/2026-05-20-pair-device-poll-generation.md
docs/superpowers/learnings/2026-05-20-persist-run-failure-must-surface.md
docs/superpowers/learnings/2026-05-20-planner-recovery-needs-error-classification.md
docs/superpowers/learnings/2026-05-20-project-memory-save-owner-content.md
docs/superpowers/learnings/2026-05-20-queued-fifo-needs-logical-clock.md
docs/superpowers/learnings/2026-05-20-queued-steering-delivery-requires-post-input-output.md
docs/superpowers/learnings/2026-05-20-saved-session-recovery-branch-events.md
docs/superpowers/learnings/2026-05-20-selected-server-bootstrap-must-not-be-demoted-by-cache.md
docs/superpowers/learnings/2026-05-20-server-empty-queue-must-clear-cache.md
docs/superpowers/learnings/2026-05-20-server-snapshots-retire-optimistic-running.md
docs/superpowers/learnings/2026-05-20-snapshot-marker-must-not-leapfrog-worker-events.md
docs/superpowers/learnings/2026-05-20-source-string-tests-need-behavioral-pair.md
docs/superpowers/learnings/2026-05-20-sse-resync-requires-snapshot-anchor.md
docs/superpowers/learnings/2026-05-20-stale-gemini-session-recovery.md
docs/superpowers/learnings/2026-05-20-streaming-message-is-not-completion.md
docs/superpowers/learnings/2026-05-20-supervisor-timestamp-tie-breakers.md
docs/superpowers/learnings/2026-05-20-supervisor-wake-lease-events.md
docs/superpowers/learnings/2026-05-20-worker-failover-selection-errors.md
docs/superpowers/learnings/2026-05-20-worker-history-is-not-live-authority.md
docs/superpowers/learnings/2026-05-20-worker-stream-inflight-wakeup.md
docs/superpowers/learnings/2026-05-21-artifact-lock-owner-races.md
docs/superpowers/learnings/2026-05-21-direct-awaiting-user-is-worker-owned.md
docs/superpowers/learnings/2026-05-21-memory-consolidation-model-ownership.md
docs/superpowers/learnings/2026-05-21-ownerless-worker-output-lock.md
docs/superpowers/learnings/2026-05-24-persisted-reload-zombie-workers.md
docs/superpowers/learnings/2026-05-24-terminal-runs-must-retire-stale-pending-messages.md
docs/superpowers/learnings/2026-05-25-browser-route-and-queue-ownership.md
docs/superpowers/learnings/2026-05-25-direct-retry-must-resume-saved-acp-session.md
docs/superpowers/learnings/2026-05-25-direct-terminal-primary-worker-selection.md
docs/superpowers/learnings/2026-05-25-empty-direct-session-recreation.md
docs/superpowers/learnings/2026-05-25-project-scoped-cli-session-storage.md
docs/superpowers/learnings/2026-05-25-provider-session-materialization.md
docs/superpowers/learnings/2026-05-25-scoped-snapshots-sidebar-catalog.md
docs/superpowers/learnings/2026-05-26-optimistic-ui-needs-complete-sidebar-records.md
docs/superpowers/learnings/2026-05-26-project-scoped-cli-homes-must-bridge-credentials.md
docs/superpowers/learnings/2026-05-26-resource-guard-margins-are-not-worker-estimates.md
docs/superpowers/learnings/2026-05-29-cli-prompt-stdin-cleanup.md
docs/superpowers/learnings/2026-05-30-awaiting-user-clarification-rows-are-question-state.md
docs/superpowers/learnings/2026-05-30-stale-worker-session-recovery.md
docs/superpowers/learnings/2026-06-03-auth-hash-config-validation.md
docs/superpowers/learnings/2026-06-13-account-api-dto-redaction.md
docs/superpowers/learnings/2026-06-14-direct-conversation-title-generation.md
docs/superpowers/plans/2026-04-20-ultrapowers-implementation.md
docs/superpowers/plans/2026-04-21-conversation-recovery-controls.md
docs/superpowers/plans/2026-04-21-generic-supervisor-redesign-implementation.md
docs/superpowers/plans/2026-04-21-pm-pass-north-star.md
docs/superpowers/plans/2026-04-21-story-derived-completeness.md
docs/superpowers/plans/2026-04-21-v1-product-completeness.md
docs/superpowers/plans/2026-04-22-agent-output-activity-feed.md
docs/superpowers/plans/2026-04-23-conversation-modes-implementation.md
docs/superpowers/plans/2026-04-23-remote-access-pwa.md
docs/superpowers/plans/2026-04-23-worker-detail-streaming.md
docs/superpowers/plans/2026-04-24-page-refactor.md
docs/superpowers/plans/2026-04-27-worker-conversation-presence.md
docs/superpowers/plans/2026-04-28-managed-agent-tool-environment.md
docs/superpowers/plans/2026-04-30-internal-agent-runtime.md
docs/superpowers/plans/2026-05-02-busy-conversation-steer-queue.md
docs/superpowers/plans/2026-05-02-chat-file-attachments.md
docs/superpowers/plans/2026-05-02-completion-git-workflow-settings.md
docs/superpowers/plans/2026-05-02-native-macos-remote-wrapper.md
docs/superpowers/plans/2026-05-03-acp-worker-terminal-processes.md
docs/superpowers/plans/2026-05-05-agent-output-spool.md
docs/superpowers/plans/2026-05-06-side-window-file-tabs.md
docs/superpowers/plans/2026-05-07-i18n-resource-library.md
docs/superpowers/plans/2026-05-07-memorable-cloudflared-subdomains.md
docs/superpowers/plans/2026-05-08-settings-reorganization.md
docs/superpowers/plans/2026-05-09-recoverable-run-state-machine.md
docs/superpowers/plans/2026-05-10-hosted-remote-access-control-plane.md
docs/superpowers/plans/2026-05-10-quota-reset-auto-resume.md
docs/superpowers/plans/2026-05-11-app-architecture-react-performance.md
docs/superpowers/plans/2026-05-11-supervisor-memory.md
docs/superpowers/plans/2026-05-11-top-bar-commit-workflow.md
docs/superpowers/plans/2026-05-12-branch-workspace-management.md
docs/superpowers/plans/2026-05-14-planning-review-agents.md
docs/superpowers/plans/2026-05-15-cli-quota-tracking.md
docs/superpowers/plans/2026-05-16-codex-subscription-supervisor.md
docs/superpowers/plans/2026-05-16-infinite-scroll-output-history.md
docs/superpowers/plans/2026-05-16-intelligent-worker-failover.md
docs/superpowers/plans/2026-05-16-unified-worker-conversation-stream.md
docs/superpowers/plans/2026-05-18-common-runtime-multi-surface.md
docs/superpowers/plans/2026-05-19-session-provider-decoupling.md
docs/superpowers/plans/2026-05-20-append-only-artifact-storage.md
docs/superpowers/plans/2026-05-25-automatic-session-cleanup.md
docs/superpowers/plans/2026-05-26-active-sessions-sidebar-tabs.md
docs/superpowers/plans/2026-06-14-escape-interrupt-queued-message.md
docs/superpowers/plans/cli-quota-tracking.md
docs/superpowers/plans/lifecycle-observability-and-chaos-harness.md
docs/superpowers/plans/plan-readiness-llm-judge.md
docs/superpowers/specs/2026-04-20-ultrapowers-design.md
docs/superpowers/specs/2026-04-21-conversation-recovery-controls-design.md
docs/superpowers/specs/2026-04-21-generic-supervisor-redesign.md
docs/superpowers/specs/2026-04-21-worker-launch-and-inspector-design.md
docs/superpowers/specs/2026-04-23-conversation-modes-design.md
docs/superpowers/specs/2026-04-23-remote-access-pwa-design.md
docs/superpowers/specs/2026-04-23-ui-polish.md
docs/superpowers/specs/2026-04-23-worker-detail-streaming-design.md
docs/superpowers/specs/2026-04-27-worker-conversation-presence.md
docs/superpowers/specs/2026-04-28-interactive-planning-handoff-design.md
docs/superpowers/specs/2026-05-02-busy-conversation-steer-queue-design.md
docs/superpowers/specs/2026-05-02-chat-file-attachments.md
docs/superpowers/specs/2026-05-03-supervisor-conversation-signal-design.md
docs/superpowers/specs/2026-05-06-project-wide-supervisor-memory-design.md
docs/superpowers/specs/2026-05-11-organic-planning-interface-design.md
docs/superpowers/specs/2026-05-15-cli-quota-tracking.md
docs/superpowers/specs/2026-05-29-multi-account-cli-credentials.md

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:37:46.417Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:37:46.417Z

There are already adjacent plans around runtime surfaces and session providers, so I’m checking those before drafting a new plan. The key question is where to separate “interface host” concerns from “OmniHarness server” concerns without duplicating runtime state.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:37:46.422Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:37:46.422Z

```json
{
  "cmd": "sed -n '1,260p' docs/superpowers/plans/2026-05-18-common-runtime-multi-surface.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:37:46.422Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:37:46.422Z

```json
{
  "cmd": "sed -n '1,260p' docs/superpowers/plans/2026-05-19-session-provider-decoupling.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:37:46.422Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:37:46.422Z

```json
{
  "cmd": "sed -n '1,260p' docs/superpowers/plans/2026-05-10-hosted-remote-access-control-plane.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:37:46.503Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:37:46.503Z

```json
{
  "cmd": "sed -n '1,240p' docs/superpowers/learnings/2026-05-20-selected-server-bootstrap-must-not-be-demoted-by-cache.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:37:46.534Z","phase":null} -->
## Tool result: call_37yQGy3FPWLoaYtYM5T2rhfn · 2026-06-14T15:37:46.534Z

````text
Chunk ID: 06cd0e
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 4002
Output:
# Common Runtime Multi-Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure OmniHarness so the agent/control-plane runtime and primary UI can be reused by the web app, a native desktop shell, a VS Code extension, and later interfaces without forking product behavior.

**Architecture:** Follow the useful part of OpenChamber's model: one shared server runtime, one shared React renderer, and thin surface adapters. Omni's Next app remains the compatibility web surface while runtime logic moves behind portable service and HTTP boundaries; Electron starts the same runtime in-process and loads the shared renderer from loopback; VS Code reuses the renderer with a `postMessage` runtime adapter mediated by the extension host.

**Tech Stack:** TypeScript, pnpm, Next.js 15, React 19, existing Manager classes, SQLite/Drizzle, SSE with named events, Node HTTP, Vite for embeddable renderer builds, Electron for the first native desktop shell, VS Code Extension API for editor integration, Vitest, lifecycle HTTP/SSE tests, Playwright where UI verification is required.

**North Star Product:** OmniHarness becomes a portable agent supervision runtime: run it once locally or remotely, then operate the same conversations, workers, plans, files, events, notifications, and recovery controls from browser, desktop, editor, phone/PWA, CLI, or future hosted surfaces.

**Current Milestone:** Deliver the common runtime and renderer boundary, keep the existing web app working, add an Electron desktop shell that starts the runtime in-process, and add a VS Code extension proof surface that can authenticate, list/start conversations, stream events, and open files through the shared contracts.

**Future Product Direction:** Additional shells can reuse the same runtime and renderer contracts: SwiftUI/WKWebView native app, mobile wrappers, hosted remote access, MCP/admin dashboards, and editor integrations beyond VS Code. These are context only; the checklist below delivers the current milestone completely.

**Final Functionality Standard:** The milestone is complete only when web, CLI, Electron, and VS Code all exercise real OmniHarness runtime behavior through shared contracts, with no mocked conversations, fake shell success states, duplicated persistence layers, or UI-only policy enforcement.

---

## Source Model From OpenChamber

OpenChamber's current shape is:

- `packages/ui`: shared React renderer.
- `packages/web`: web server, CLI package, API routes, static UI build, and exported `startWebUiServer(...)`.
- `packages/electron`: thin native shell that imports the web server, starts it in the Electron main process, stages the web build, and loads loopback.
- `packages/vscode`: VS Code extension host plus webview. It reuses the shared UI but provides a `RuntimeAPIs` implementation over `postMessage`.

The lesson for Omni is not "copy the folders exactly." The lesson is: product behavior lives in a runtime, UI behavior lives in a renderer, and every shell supplies only transport/native capabilities.

### Research Appendix

OpenChamber references inspected for this plan:

- `packages/web/server/index.js`: exports `startWebUiServer` and returns a handle with `getPort()`, `stop()`, readiness, restart, tunnel, and quit-risk helpers.
- `packages/electron/main.mjs`: sets desktop runtime env, imports `@openchamber/web/server/index.js`, calls `startWebUiServer(...)`, stores the handle, and loads the local URL in Electron.
- `packages/electron/preload.mjs`: exposes shell identity and a gated native command bridge. It keeps native capability in the shell, not in the server runtime.
- `packages/ui/src/lib/api/types.ts`: defines `RuntimeAPIs`, the typed frontend capability contract that lets the shared UI run under web or VS Code adapters.
- `packages/web/src/main.tsx`: creates web `RuntimeAPIs`, installs them on `window`, and imports the shared UI entry.
- `packages/vscode/webview/main.tsx`: creates VS Code `RuntimeAPIs`, listens for extension-host messages, and imports the shared VS Code renderer.
- `packages/vscode/webview/api/bridge.ts`: implements request/response and SSE proxy messages over `postMessage`.
- `packages/vscode/src/bridge.ts` and `ChatViewProvider.ts`: route webview bridge requests to extension-host filesystem, git, proxy, settings, and SSE handlers.
- `packages/electron/scripts/build-web-assets.mjs`: builds the web UI and stages it as Electron resources.

Things Omni should copy:

- runtime starts once and exposes an explicit lifecycle handle,
- native shell stays thin,
- shared UI receives a typed runtime capability object,
- VS Code is a mediated adapter rather than pretending it is the browser.

Things Omni should improve:

- keep shell-specific globals out of shared UI where possible,
- define the `RuntimeAPIs` contract before broad renderer migration,
- migrate API routes in a risk-ordered sequence rather than all at once,
- preserve Omni's stronger named-event and lifecycle testing discipline.

## Product Scope

### Primary User Stories

As a builder, I want the same Omni conversation to be available in browser, desktop, CLI, and VS Code, so I can move between surfaces without losing state or behavior.

As a builder, I want the desktop app to feel native while still running the same Omni runtime, so native menus, dialogs, notifications, and deep links do not become a second backend.

As a builder in VS Code, I want Omni beside my editor with editor-aware actions, so I can start or continue runs and open files/diffs without leaving the workspace.

As a maintainer, I want runtime decisions to be emitted through the same named event surface on every interface, so lifecycle bugs can be tested without guessing from DOM state.

### Return And Recovery Stories

As a returning user, I want each surface to reattach to the same persisted conversations, workers, queued messages, and validation state.

As a user after a disconnect or restart, I want each surface to resume from SSE event ids or explicitly request a resync, not silently invent state.

As an operator debugging a shell issue, I want to know whether the failing layer is runtime, HTTP adapter, renderer adapter, native bridge, VS Code bridge, or agent runtime bridge.

### Scope Boundaries

This plan does include Electron as the first native shell because it can import the Node runtime in-process, matching the OpenChamber pattern most closely.

This plan does include a VS Code proof surface with real conversation and event behavior. It does not require a fully polished Marketplace extension in the first pass.

This plan does not create branches or worktrees. Current repo instructions forbid both unless explicitly requested.

This plan does not delete files. Any file removal discovered during migration is a separate user decision.

## Open Decisions

These decisions should be confirmed before executing the Electron and VS Code phases. Runtime extraction and web parity can proceed without them.

- **Electron as first native shell:** This plan recommends Electron because it can start the Node runtime in-process like OpenChamber. A SwiftUI/WKWebView app remains possible but would likely supervise a child Node process instead.
- **VS Code runtime location:** Decide whether the VS Code proof surface starts a local Omni runtime, connects to an already-running local runtime, or supports both from the start. Recommended current milestone: support both, defaulting to reuse/connect when a healthy local runtime exists.
- **VS Code auth model:** Decide whether VS Code webviews use the same Omni session auth flow, a local extension-issued session token, or a trusted-loopback shortcut. Recommended current milestone: use the same runtime auth concepts and make any extension-issued token explicit, short-lived, and observable.
- **Workspace trust and filesystem roots:** Decide whether VS Code filesystem/git operations are limited to the active workspace folder or can target Omni's selected project path. Recommended current milestone: require workspace trust and limit editor-originated file actions to workspace roots unless Omni project scope already grants access.
- **Renderer breadth in VS Code:** Decide whether the first VS Code surface loads the full Omni renderer or a narrowed route/panel. Recommended current milestone: load the shared renderer with shell flags that hide unsupported surfaces rather than forking a separate mini UI.

### Decisions Recorded For The Implemented Slice

- **Electron as first native shell:** confirmed for this milestone. It starts the Node runtime in-process and serves staged renderer assets from the runtime origin.
- **VS Code runtime location:** confirmed for the proof surface. The extension connects to a configured Omni runtime, defaulting to `http://localhost:3035`; starting an embedded runtime from the extension remains future work.
- **VS Code auth model:** confirmed for the proof surface. The extension can forward an explicit configured `omni_session` cookie value for password-protected runtimes.
- **Workspace trust and filesystem roots:** confirmed for the proof surface. Editor-originated file actions use VS Code document APIs; conversation creation defaults to the first workspace folder.
- **Renderer breadth in VS Code:** confirmed for the proof surface. It uses the shared VS Code `RuntimeAPIs` adapter and a focused webview panel rather than the full browser Home surface.

## Architecture

### Runtime Kernel

Create an explicit Omni runtime kernel that owns:

- database access and migrations,
- settings reads/writes,
- auth/session validation,
- conversation creation and message sending,
- supervisor lifecycle,
- worker stream persistence,
- named event emission and SSE replay,
- notifications,
- git/filesystem service boundaries,
- cleanup and graceful shutdown.

The runtime must be constructible once per process and injectable into HTTP, CLI, Electron, and test harnesses. Shells must not import random server modules directly after the boundary exists.

### Portable HTTP Surface

Move business logic out of Next route files into standard request handlers. The preferred shape is Fetch-compatible:

```ts
type OmniHttpHandler = (request: Request, context: OmniRequestContext) => Promise<Response>;
```

Next route files become adapters. The standalone runtime server and Electron server use the same route registry. This avoids maintaining two API implementations.

### Shared Renderer

Extract the main client app into a renderer entry that does not import Next server modules or assume `window.location` is the only runtime authority. The renderer receives:

- bootstrap payload,
- `RuntimeAPIs`,
- runtime descriptor,
- shell capabilities,
- optional native/editor bridge capabilities.

The existing Manager classes remain the state model. Subscriptions must stay narrow, especially for composer draft state, terminal output, worker streams, search text, hover/open state, and resizers.

### RuntimeAPIs Contract

Define a typed frontend contract for capabilities such as:

- auth/session/bootstrap,
- conversations/messages/queued messages,
- events/SSE replay,
- worker entries and terminal streams,
- plans and validation records,
- settings,
- files,
- git/workspace status,
- notifications,
- native shell actions,
- editor actions.

Implementations:

- Web/Next adapter: `fetch` and `EventSource`/SSE against the local HTTP API.
- Electron adapter: mostly the web adapter, plus preload-exposed native capabilities.
- VS Code adapter: `postMessage` bridge to extension host, including SSE proxying and editor/file operations.
- Test adapter: real HTTP against lifecycle harness, not canned data.

### Initial RuntimeAPIs Slice

The first implemented `RuntimeAPIs` slice must be small and real. Do not define the entire future surface before proving the contract.

```ts
export interface RuntimeAPIs {
  runtime: {
    surface: "web" | "electron" | "vscode";
    label: string;
    supportsNativeNotifications: boolean;
    supportsEditorActions: boolean;
  };
  bootstrap: {
    load(input: { selectedRunId?: string | null; draftProjectPath?: string | null; pairToken?: string | null }): Promise<HomeBootstrapPayload>;
  };
  events: {
    open(input: { snapshot: boolean; runId?: string | null; lastEventId?: string | null }, handlers: EventStreamHandlers): RuntimeSubscription;
    fetchLog(input: { since?: string; runId?: string | null }): Promise<NamedEventLogResponse>;
  };
  conversations: {
    create(input: CreateConversationRequest): Promise<CreateConversationResponse>;
    sendMessage(input: SendConversationMessageRequest): Promise<SendConversationMessageResponse>;
  };
  workers: {
    listEntries(input: { runId: string; workerId: string; afterSeq?: number }): Promise<WorkerEntriesResponse>;
  };
  settings: {
    load(): Promise<SettingsResponse>;
    save(input: SettingsSaveRequest): Promise<SettingsResponse>;
  };
  native?: {
    openExternal(input: { url: string }): Promise<{ ok: true }>;
    chooseFolder?(): Promise<{ path: string | null }>;
    notify?(input: { title: string; body?: string }): Promise<{ ok: boolean }>;
  };
  editor?: {
    openFile(input: { path: string; line?: number; column?: number }): Promise<{ ok: true }>;
    openDiff(input: { originalPath: string; modifiedPath: string; title?: string }): Promise<{ ok: true }>;
  };
}
```

Contract requirements:

- Errors use one typed shape: `{ code, message, details?, surface?, runId?, workerId?, conversationId? }`.
- SSE adapters must support cancellation and must report terminal errors through both the callback and named events where server-side.
- Auth/session failures must be explicit `401`/`403` equivalents in every adapter, including VS Code bridge responses.
- Managers consume `RuntimeAPIs` through a provider or injected module, never by importing shell-specific code.
- Data returned by adapters is raw domain data; translated UI copy is produced at render boundaries with `t()`.

### Surface Adapters

Web remains the first-class compatibility surface. Next keeps server bootstrap for the initial screen while route logic migrates behind portable handlers.

Electron is a thin shell:

- start the runtime HTTP server in the Electron main process,
- stage the renderer build as static assets,
- load `http://127.0.0.1:<port>`,
- expose native-only affordances in preload,
- gate native commands by origin and command allowlist,
- shut down runtime and agent bridge cleanly.

VS Code is a mediated shell:

- extension host starts or connects to the Omni runtime,
- webview loads the renderer bundle,
- webview `RuntimeAPIs` sends requests through `postMessage`,
- extension host proxies HTTP/SSE, exposes editor actions, and reports connection health.

CLI continues to call runtime services directly and can also gain a scriptable runtime-status command for multi-surface diagnostics.

## State And Persistence Model

Existing SQLite and JSON/file-backed settings remain authoritative. The migration must not introduce a second persistence layer for conversations, worker streams, messages, queued messages, or validation records.

Shell-specific state is separate:

- Electron: window geometry, selected host, native notification preference, update state.
- VS Code: extension global settings, selected workspace folder, panel/session editor state.
- Web/PWA: existing local browser preferences only where already appropriate.

Stored records must use stable ids and raw values. Translated UI copy, shell-rendered labels, and frontend presentation state must not be persisted as product data.

## Instrumentation And Observability

Every server-side decision introduced or moved by this work must continue to emit named events through `emitNamedEvent` from `@/server/events/named-events`.

The migration must preserve:

````

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:37:46.534Z","phase":null} -->
## Tool result: call_Z8dVEANRwTW66jtrBJK0R05I · 2026-06-14T15:37:46.534Z

````text
Chunk ID: 82a040
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 4382
Output:
# Session Provider Decoupling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make OmniHarness able to host multiple session types, starting with the existing Omni agent sessions and a real local process/script session, without tying the frontend to one backend conversation model.

**Architecture:** Introduce a canonical `SessionProvider` boundary that owns creation, input delivery, lifecycle control, persistence mapping, and capability reporting for each session type. Keep the existing unified worker stream as the transcript transport, but make the global event snapshot and UI actions derive from provider-neutral session records and advertised capabilities instead of hardcoded Omni implementation/planning/direct assumptions.

**Tech Stack:** Next.js App Router, React manager classes, Drizzle/SQLite, SSE named events, append-only worker JSONL streams, Node child processes for the first non-Omni provider, existing shadcn/ui components and i18n resources.

**North Star Product:** A conversation workbench that can display and control agents, subprocesses, scripted tools, remote services, and future ACP-backed systems through the same session UI, while each provider exposes only the actions it genuinely supports.

**Current Milestone:** Ship a provider abstraction with two production providers: `omni` for the existing behavior and `process` for local command/script sessions whose stdout, stderr, stdin prompts, exit state, cancellation, and errors render through the same transcript surface.

**Future Product Direction:** After this milestone, the same provider contract can support remote ACP sessions, notebooks, test runners, shell jobs, or task-specific tools. That direction is context only; the checklist below delivers the current `omni` plus `process` milestone end-to-end.

**Final Functionality Standard:** A user can create, view, interact with, stop, resume display history for, and delete both existing Omni conversations and local process sessions. The UI must not show unsupported Omni-specific controls for process sessions, and tests must assert provider decisions through named events and durable transcript entries.

---

## Scope Notes

- Do not create branches or worktrees.
- Do not delete files.
- Do not replace the unified worker stream. Extend and reuse it as the transcript substrate.
- Do not build a fake process provider. It must run a real configured local command, stream stdout/stderr, accept stdin when running, persist entries, and report exit status.
- Do not use ACP as the only frontend abstraction. ACP remains one possible backend/runtime protocol; `SessionProvider` is the app boundary.
- Keep Omni implementation/planning/direct behavior working throughout migration.
- Use the existing `runs`/`workers`/worker JSONL model for this milestone. Do not introduce an alternate transcript store or an ambiguous parallel `sessions` table.
- Process sessions are powerful local execution. The first implementation must be explicit and conservative about cwd validation, environment inheritance, command parsing, output limits, and stop behavior.

## User Stories

- As a user, I can start a normal Omni implementation/planning/direct conversation and it behaves as it does today.
- As a user, I can start a process session, choose a working directory and command, and see stdout/stderr appear incrementally in the conversation surface.
- As a user, I can type input to a running process session and have it delivered to stdin, with my input recorded in the transcript.
- As a user, I can stop a running process session and see whether it exited, was cancelled, or failed.
- As a user, I can reopen a process session after reload and see its persisted transcript and final state.
- As an operator/test author, I can inspect named events and persisted entries to know exactly when a provider created, started, accepted input, refused input, stopped, failed, or completed.

## File Map

### Files To Create

- `src/server/session-providers/types.ts`
  - Provider-neutral session, actor, capability, command, lifecycle, and transcript mapping types.
- `src/server/session-providers/registry.ts`
  - Registry for installed providers and provider lookup by `sessionType`.
- `src/server/session-providers/omni-provider.ts`
  - Adapter around existing `createConversation`, `sendConversationMessage`, run recovery, and stop/fork actions.
- `src/server/session-providers/process-provider.ts`
  - Real local process provider using Node child processes, stdin delivery, stdout/stderr entry mapping, stop handling, and exit persistence.
- `src/server/session-providers/process-store.ts`
  - In-memory runtime handles for live child processes plus durable DB/read helpers.
- `src/server/session-providers/session-records.ts`
  - Serialization from DB rows into provider-neutral API records.
- `src/server/session-providers/capabilities.ts`
  - Shared capability constants and helpers such as `canSendInput`, `canStop`, `canFork`, `canEditInput`, `supportsQueuedInput`.
- `src/app/home/SessionStateManager.ts`
  - Frontend manager for provider-neutral selected session metadata, capabilities, and action availability, fed from event snapshots.
- `src/components/home/SessionTypePicker.tsx`
  - Composer control for choosing Omni vs process sessions, with all visible strings in `shared/locales/*.json`.
- `src/components/home/ProcessSessionOptions.tsx`
  - Process command/cwd/options editor, owned by a manager rather than local source-of-truth arrays.
- `src/app/home/ProcessSessionDraftManager.ts`
  - Centralized manager for process session draft command, args/raw command mode, cwd, environment option toggles, and validation state.
- `tests/lifecycle/scenarios/process-session-basic.test.ts`
  - Headless lifecycle scenario for create, stream stdout/stderr, send stdin, exit, reload snapshot, and delete cleanup.
- `tests/lifecycle/scenarios/session-provider-capabilities.test.ts`
  - Headless scenario asserting unsupported actions are refused with typed events and visible errors.
- `tests/lifecycle/scenarios/process-session-restart.test.ts`
  - Headless lifecycle scenario for server restart while a process session is active.
- `docs/architecture/session-provider-model.md`
  - Canonical architecture doc for session providers, capabilities, event contracts, and transcript mapping.

### Files To Modify

- `src/server/db/schema.ts`
  - Add provider-neutral columns/tables without breaking existing rows:
    - `runs.session_type` default `"omni"`.
    - `process_sessions` table keyed by `run_id`.
    - process runtime metadata for command argv, cwd, pid, status, exit code, signal, started/exited timestamps, kill escalation state, and safe command preview.
    - a normal `workers` row for the process actor so `app-data/run-data/<runId>/<workerId>.jsonl`, `workerEntrySeqs`, and `/api/workers/:workerId/entries` continue to work unchanged.
- `src/server/db/index.ts`
  - Update `initializeSchema()` with `CREATE TABLE IF NOT EXISTS process_sessions`, `runs.session_type` handling, indexes/FKs, and existing-DB `ALTER TABLE` guards. This repo initializes schema manually here; do not plan work against a nonexistent migrations directory.
- `src/server/workers/entries-types.ts`
  - Add entry metadata needed for non-agent streams, likely `channel?: "stdout" | "stderr" | "stdin" | "system" | "agent"` and `authorRole` reuse. Keep existing entry types compatible.
- `src/server/workers/stream-writer.ts`
  - Add provider-neutral append helpers such as `appendSessionInputEntry`, `appendProcessOutputEntry`, `appendSessionLifecycleEntry`, all delegating to `appendWorkerEntry`.
- `src/runtime/http/routes/conversations.ts`
  - Route create requests through the provider registry based on `sessionType`, preserving existing request behavior as `sessionType: "omni"`.
- `src/runtime/http/routes/conversation-messages.ts`
  - Route send/input requests through provider registry and enforce provider capabilities.
- `src/runtime/http/routes/runs.ts`
  - Route stop/delete/fork/retry/edit/archive actions through provider-aware action handlers where applicable.
- `src/app/api/runs/[id]/route.ts`
  - Keep as a thin Next wrapper around runtime route handlers.
- `src/app/api/events/route.ts` and `src/server/events/persisted-snapshot.ts`
  - Include provider-neutral `sessions` or extended run metadata and capability maps in snapshots.
- `src/server/events/named-events.ts`
  - Add typed events for provider lifecycle and action decisions.
- `src/app/home/types.ts`
  - Add `SessionType`, `SessionCapability`, provider-neutral `SessionRecord`, and capability fields. Preserve existing `RunRecord` consumers during migration.
- `src/app/home/useHomeViewModel.ts`
  - Derive UI mode, primary actor, composer availability, and action visibility from session type/capabilities rather than only `run.mode`.
- `src/components/home/ConversationMain.tsx`
  - Hide or show retry/edit/fork/worktree/recovery controls based on capabilities. Render process entries through the existing `Terminal` path.
- `src/components/home/ConversationComposer.tsx` and `src/app/home/ComposerContainer.tsx`
  - Add process session creation controls and send input behavior for running process sessions.
- `src/app/home/useHomeMutations.ts`
  - Send provider-neutral create/input/action payloads. Keep optimistic updates limited to actions whose provider explicitly supports them.
- `src/app/home/LiveEventConnectionManager.ts`
  - Keep worker-entry wakeups, but generalize naming/docs to session entries where useful. Preserve wire compatibility.
- `src/runtime-api/types.ts` and `src/runtime-api/web.ts`
  - Replace `unknown` request/response shapes with typed provider-neutral create/input/action contracts where practical.
- `shared/locales/*.json`
  - Add all new UI strings for session type selection, process options, action labels, validation, and errors.
- `docs/architecture/worker-conversation-stream.md`
  - Add a short note that worker streams now serve provider-backed session actors, not only AI workers.
- `scripts/delete-conversations.sh`
  - Ensure process session metadata and artifacts are cleaned with conversations.

### Tests To Update Or Add

- Unit tests for provider registry lookup, capability checks, and request validation.
- Unit tests for `ProcessSessionDraftManager` and `SessionStateManager`.
- Unit tests for process output to `WorkerEntry` mapping, including stdout/stderr chunk splitting and seq ordering.
- Lifecycle scenarios:
  - process session create/stream/exit/reload/delete;
  - stdin delivery while running;
  - input refusal after exit;
  - stop running process;
  - server restart while process is active;
  - process spawn failure surfaces `error.surfaced`;
  - unsupported action refusal emits a named event.
- Existing lifecycle scenarios must still pass for Omni implementation/planning/direct sessions.

### Candidate Agentic User Journey Tests

These require explicit user approval before running:

- Start a process session from the UI with a small Python script, watch incremental output, send input, and confirm transcript persistence after reload.
- Start an Omni direct session and confirm the existing UI still shows the worker stream and expected controls.
- Switch between Omni and process sessions in the sidebar and confirm provider-specific controls do not bleed across sessions.

### `.gitignore` Coverage

Before implementation, verify `.gitignore` covers:

- `node_modules/`, package-manager caches, Next build output, coverage, logs, temporary files.
- process-session runtime temp dirs if introduced.
- generated process output artifacts if any are written outside `app-data/run-data`.
- no secrets or local process environment dumps are persisted.

## Chosen Persistence Model

Use the existing `runs` row as the durable user-visible session identity. Add `runs.session_type` with default `"omni"` for all existing rows. Add a `process_sessions` table keyed by `run_id`:

```ts
processSessions = {
  runId: string;              // primary key, references runs.id
  workerId: string;           // references workers.id
  cwd: string;
  commandJson: string;        // argv array, not a shell string
  commandPreview: string;     // redacted, bounded display string
  envPolicy: "minimal" | "inherit_safe";
  pid: number | null;
  status: "starting" | "running" | "exited" | "cancelled" | "failed" | "orphaned";
  exitCode: number | null;
  signal: string | null;
  startedAt: Date | null;
  exitedAt: Date | null;
  lastError: string | null;
}
```

Every process session also creates one `workers` row with `type: "process"` and the usual `runId`, `cwd`, `status`, `workerNumber`, timestamps, and text fields. This preserves the existing worker stream storage path and reader endpoint.

## Process Execution Boundaries

- Use `spawn(file, args, { cwd, shell: false })` for the first implementation. Do not accept raw shell mode in this milestone.
- Accept command input as either an argv array from the API or a UI command string parsed with a structured shell-words parser into argv. Persist the argv array as JSON.
- Validate cwd against the same project/root rules used by the app: it must be an existing directory and must be within the selected project scope or explicitly chosen folder.
- Environment policy starts as `minimal`, with only safe runtime variables required for PATH/process execution. Do not persist environment values.
- Redact command previews with a bounded display string and obvious secret-like argument redaction.
- Stream output in bounded chunks. The process provider must preserve ordering within each stdout/stderr data event and rely on `appendWorkerEntry` seq for global transcript order.
- Stop behavior sends `SIGTERM`, records `session.stopped`, and escalates to `SIGKILL` after a bounded timeout if the process remains alive.
- Stdin is accepted only when status is `running` and the child stdin is writable. Refused stdin emits `session.input.refused`; delivered stdin appends an input entry only after the write callback succeeds.
- On server restart, live child handles are gone. The startup/reconciliation path marks any `starting`/`running` process sessions without a live handle as `orphaned` or terminal failed, emits `session.status`, and surfaces a user-visible explanation.

## Provider Contract

Define a server-side provider interface in `src/server/session-providers/types.ts`:

```ts
export type SessionType = "omni" | "process";

export type SessionCapability =
  | "send_input"
  | "stop"
  | "retry_from_message"
  | "edit_message"
  | "fork_session"
  | "fork_message"
  | "queue_input"
  | "approve_permission"
  | "open_project_file"
  | "use_git_workspace";

export interface SessionProvider {
  readonly type: SessionType;
  create(input: CreateSessionInput): Promise<CreateSessionResult>;
  sendInput(input: SendSessionInput): Promise<SendSessionInputResult>;
  stop(input: StopSessionInput): Promise<StopSessionResult>;
  delete?(input: DeleteSessionInput): Promise<DeleteSessionResult>;
  getCapabilities(session: ProviderSessionRecord): SessionCapability[];
  serialize(session: ProviderSessionRecord): SessionRecord;
}
```

The exact names can change during implementation, but the boundary must preserve these ideas:

- The UI sends intent to a session provider, not directly to Omni-specific functions.
- The provider decides whether an action is supported and emits a refusal event when it is not.
- Transcript entries remain durable JSONL entries keyed by `(runId, actorId)` or the evolved equivalent.
- Capabilities are data. Components do not infer support from `run.mode` alone.

## Event Contract

Add exact typed events to `src/server/events/named-events.ts`:

- `session.created` with `{ runId, sessionType, actorIds }`
- `session.starting` with `{ runId, sessionType }`
- `session.status` with `{ runId, sessionType, prev, next, reason? }`
- `session.input.accepted` with `{ runId, targetActorId, inputId }`
- `session.input.delivered` with `{ runId, targetActorId, inputId }`
- `session.input.refused` with `{ runId, sessionType, code, reason }`
- `session.action.refused` with `{ runId, sessionType, action, code, reason }`
- `session.stopped` with `{ runId, sessionType, reason }`
- `process.spawned` with `{ runId, workerId, pid, commandPreview }`
- `process.exited` with `{ runId, workerId, exitCode, signal }`

Add exact `SurfacedErrorCode` members:

- `process.spawn.failed`
- `process.cwd.invalid`
- `process.stdin.closed`
- `process.stop.failed`
- `process.orphaned_after_restart`
- `session.provider.unknown`
- `session.action.unsupported`

Every user-relevant failure also emits `error.surfaced` with a stable `code`, `surface`, and `runId`/`workerId`. Unsupported action paths must emit both `session.action.refused` and, when the user initiated the action from the UI/API, `error.surfaced` with `session.action.unsupported`.

## Implementation Checklist

- [ ] Audit current file sizes and split any touched file that would exceed 1200 lines before adding major logic.
  - Check `src/components/home/ConversationMain.tsx`, `src/app/home/HomeApp.tsx`, `src/app/home/useHomeMutations.ts`, and `src/server/conversations/create.ts`.
  - Verification: `wc -l` confirms new provider logic lives in dedicated modules, not oversized UI/server files.


````

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:37:46.534Z","phase":null} -->
## Tool result: call_pVovqPPG4hanHZ3Wm69lnuBS · 2026-06-14T15:37:46.534Z

````text
Chunk ID: 11c8e4
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 4451
Output:
# Hosted Remote Access Control Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the optional hosted OmniHarness control plane that owns registered accounts, paid remote-installation entitlements, memorable hostnames, Cloudflare Tunnel provisioning, DNS records, tunnel-token lifecycle, health, audit, and revocation for Omni-provided managed remote access.

**Architecture:** Keep the existing Vercel landing page on `omniharness.dev` / `www.omniharness.dev`, and deploy a separate hosted API service at `panel.omniharness.dev`. Use Supabase for Auth, Postgres persistence, RLS-aware account data, and audit/event storage; use a dedicated Node/TypeScript service for Cloudflare API orchestration, provisioning workflows, retries, diagnostics, and local-app handshakes. Local OmniHarness installations never receive Cloudflare account API credentials; they receive only an installation id, public origin, and scoped tunnel token.

**Tech Stack:** Node 22, TypeScript, Fastify, Zod, Supabase Auth, Supabase Postgres, Cloudflare Tunnel API, Cloudflare DNS API, Docker, Fly.io or another always-on container host, Vitest, Playwright or API-level journey tests, existing OmniHarness local app, `cloudflared`.

**North Star Product:** OmniHarness is fully useful as an offline local app with no registration, while registered users can opt into paid hosted services. A builder who wants the managed tunnel clicks "Enable hosted remote access", registers or signs in, receives a permanent friendly hostname under `omniharness.dev`, scans a phone QR, and can supervise local agents from anywhere without configuring Cloudflare, DNS, or tunnels by hand.

**Current Milestone:** Ship a real hosted control-plane service and local-app integration path for one-account/one-installation paid managed Cloudflare Tunnel provisioning under `omniharness.dev`, including Supabase-backed registration/login, account records, managed-tunnel entitlement checks, installation records, slug reservation, Cloudflare resource creation, token issuance, local connector handshake, health checks, diagnostics, and revocation.

**Future Product Direction:** Add billing enforcement, organization/team accounts, custom domains, user-editable slugs, fleet management, read-only sharing, native mobile apps, and an Omni Relay based on Cloudflare Workers/Durable Objects after the named-tunnel control plane is working end-to-end.

**Final Functionality Standard:** The local app remains fully usable offline with no registration. A real signed-in account with an active managed-tunnel entitlement can claim an installation; the control plane provisions real Cloudflare resources and persists them in Supabase; a local OmniHarness app can start `cloudflared` with the returned scoped token; the public hostname reaches the local web app; status, errors, and audit events are inspectable; revocation disables access. Mock Cloudflare responses, canned DNS records, unscoped local Cloudflare credentials, registration requirements for offline/local use, and placeholder success states do not count as delivery.

---

## Product Commitments

### User Stories

As a builder, I want OmniHarness to create and remember my remote hostname, so I can open the same address from my phone every time.

As a builder, I want to use OmniHarness fully offline without registration, so the core local agent supervisor is not dependent on OmniHarness cloud services.

As a builder, I want to bring my own tunnel or LAN URL without creating an OmniHarness account, so I can use ngrok, Cloudflare Tunnel, Tailscale, a reverse proxy, or my own domain on my own terms.

As a builder, I want to register and log into an OmniHarness account when I want paid hosted features, so the account boundary is useful but not forced.

As a builder, I want to sign into an OmniHarness account instead of managing Cloudflare credentials, so remote access feels like product setup rather than infrastructure work.

As a builder, I want setup failures to say whether account auth, slug reservation, DNS, Cloudflare Tunnel, local connector, or app reachability failed.

As a builder, I want to revoke a lost machine's tunnel token, so an old laptop cannot keep exposing my OmniHarness instance.

As the service operator, I want every provisioning and revocation step audited, so support, abuse response, and billing reconciliation are possible.

### Product Mode Boundary

OmniHarness has three product modes:

1. **Local/offline mode:** no registration, no Supabase, no hosted control plane, no internet requirement beyond whatever model/agent providers the user chooses. Existing local conversations, workers, settings, auth, and runtime supervision continue to work.
2. **Bring-your-own tunnel mode:** no OmniHarness registration required. The user provides a LAN URL or public HTTPS origin from ngrok, Cloudflare Tunnel, Tailscale/Funnel, a reverse proxy, or their own domain. OmniHarness validates the URL, uses it for phone pairing/public-origin links, and surfaces health/errors, but does not provision DNS, tunnels, slugs, hosted accounts, or billing records.
3. **Omni managed tunnel mode:** registration/login required and gated by an active paid managed-tunnel entitlement. The hosted control plane provisions and owns the `omniharness.dev` hostname, Cloudflare Tunnel, DNS record, scoped tunnel token, health, audit, and revocation.

The hosted control plane must never become a startup dependency for local/offline mode or bring-your-own tunnel mode.

### Domain And Deployment Model

Cloudflare remains the authoritative DNS provider for `omniharness.dev`.

```text
omniharness.dev              -> Vercel landing page
www.omniharness.dev          -> Vercel landing page
panel.omniharness.dev        -> hosted control-plane API service
<slug>.omniharness.dev      -> per-installation Cloudflare Tunnel DNS record
```

For v1, create one DNS CNAME per active installation:

```text
<slug>.omniharness.dev CNAME <tunnel-id>.cfargotunnel.com
```

Do not route all `*.omniharness.dev` wildcard traffic to the local app in v1. The control plane must know exactly which hostname maps to which remote installation.

### Trust Boundary

The hosted control plane may hold Cloudflare account credentials and Supabase service-role credentials. The local OmniHarness app must not.

The local app receives:

- Supabase user/session token or an installation-scoped exchange token,
- remote installation id,
- public origin,
- scoped Cloudflare tunnel token,
- token version and status metadata.

The local app exposes only its Next.js web server through the tunnel. The ACP/runtime bridge remains loopback-only.

## PM Pass

Primary user: the individual builder running OmniHarness locally and connecting from a phone.

Secondary user: the OmniHarness service operator debugging provisioning, revocation, abuse, billing, and Cloudflare account state.

Supporting jobs:

- account sign-in and session validation,
- installation claim and recovery after reinstall,
- slug reservation and collision handling,
- Cloudflare named-tunnel creation,
- DNS record creation and cleanup,
- scoped tunnel-token issue/rotate/revoke,
- local connector heartbeat,
- external public reachability checks,
- support-readable audit trail,
- scriptable admin/status inspection,
- secure secret storage and redaction.

State model:

- Supabase is the system of record for accounts, installations, slugs, Cloudflare ids, token versions, health snapshots, and audit events.
- Cloudflare is the system of record for tunnel and DNS resources.
- Local OmniHarness stores only the minimal assigned remote-access state needed to reconnect.

Operational readiness:

- every provisioning step must be idempotent,
- failed partial provisioning must be resumable,
- Cloudflare and Supabase errors must map to stable product error codes,
- all sensitive tokens must be redacted in logs, diagnostics, tests, and UI payloads,
- service health and installation health must be separately inspectable.

Repository isolation:

- Work in the current repository.
- Do not create branches.
- Do not create worktrees.

## Product Completeness Pass

## Current Repository Audit

This plan was re-checked against the repo on 2026-05-29.

Current repo facts that affect implementation:

- `pnpm-workspace.yaml` already exists, but currently only carries pnpm config such as overrides and `allowBuilds`; it does not yet define package globs. The plan must extend this file instead of creating it from scratch.
- The local app uses Next.js App Router route files as thin adapters over the explicit runtime route registry in `src/runtime/http/routes/index.ts`. New local API behavior should follow that pattern when local integration is needed.
- The hosted service should still be a separate Fastify service under `services/remote-control-plane`; it should not be implemented as local Next file-based routes.
- Local auth/public-origin resolution currently lives in `src/server/auth/config.ts` and only checks `OMNIHARNESS_PUBLIC_ORIGIN`, forwarded headers, and request origin. The hosted remote-access origin precedence remains a real required change.
- Local encrypted settings already exist in `src/server/settings/crypto.ts`, but `shouldEncryptSetting` currently encrypts generic secret-looking suffixes only. Remote tunnel token keys must be explicitly covered if their names do not match those patterns.
- There is no dedicated local `/api/healthz` route today. The plan must add a tiny unauthenticated local health endpoint for Cloudflare reachability checks that proves "this is OmniHarness" without leaking conversations, prompts, auth state, or secrets.

Baseline v1 surfaces:

- hosted control-plane API,
- Supabase registration/login configuration for hosted features,
- Supabase schema and migrations,
- paid managed-tunnel entitlement model,
- service configuration and deployment docs,
- local-app API client and encrypted local state handoff,
- local-app mode selection that keeps offline and bring-your-own tunnel paths accountless,
- CLI/scriptable admin status tools,
- deterministic tests for provisioning logic and error mapping,
- environment-gated integration tests against real Cloudflare and Supabase.

Baseline v1 states:

- unauthenticated,
- offline/local with no account,
- bring-your-own tunnel configured,
- account registration/login available,
- account authenticated,
- no paid managed-tunnel entitlement,
- paid managed-tunnel entitlement active,
- installation unclaimed,
- slug reserved,
- provisioning tunnel,
- provisioning DNS,
- token issued,
- connector waiting,
- connector connected,
- public reachability healthy,
- degraded,
- revoked,
- provisioning failed with resumable cause.

## File Map

### Create

- `services/remote-control-plane/package.json`: package scripts, dependencies, and test entry points for the hosted service.
- `services/remote-control-plane/tsconfig.json`: TypeScript config for the service.
- `services/remote-control-plane/Dockerfile`: container image for an always-on deployment target such as Fly.io.
- `services/remote-control-plane/fly.toml.example`: deployment template for `panel.omniharness.dev`.
- `services/remote-control-plane/src/server.ts`: Fastify server bootstrap and plugin registration.
- `services/remote-control-plane/src/config.ts`: typed environment parsing and secret redaction helpers.
- `services/remote-control-plane/src/auth/supabase-auth.ts`: Supabase JWT validation and account context derivation.
- `services/remote-control-plane/src/billing/entitlements.ts`: paid managed-tunnel entitlement checks sourced from Supabase account state.
- `services/remote-control-plane/src/db/supabase.ts`: Supabase client factories for user-scoped and service-role operations.
- `services/remote-control-plane/src/db/schema.sql`: Supabase SQL migrations for accounts, installations, slugs, events, and health snapshots.
- `services/remote-control-plane/src/cloudflare/client.ts`: Cloudflare Tunnel/DNS API client.
- `services/remote-control-plane/src/cloudflare/errors.ts`: Cloudflare error normalization.
- `services/remote-control-plane/src/installations/provision.ts`: idempotent installation claim and Cloudflare provisioning workflow.
- `services/remote-control-plane/src/installations/revoke.ts`: revoke token, disable DNS/tunnel routing, and record audit events.
- `services/remote-control-plane/src/installations/health.ts`: connector heartbeat, public reachability checks, and health status shaping.
- `services/remote-control-plane/src/installations/routes.ts`: explicit Fastify routes for claim, status, heartbeat, rotate-token, revoke, and diagnostics.
- `services/remote-control-plane/src/slugs/word-lists.ts`: hosted slug word lists and banned/reserved terms.
- `services/remote-control-plane/src/slugs/generator.ts`: collision-aware slug generation.
- `services/remote-control-plane/src/audit/events.ts`: append-only audit event writer and redaction utilities.
- `services/remote-control-plane/src/admin/routes.ts`: service-operator status endpoints protected by admin auth.
- `services/remote-control-plane/scripts/check-installation.ts`: scriptable lookup for installation, DNS, tunnel, health, and audit state.
- `services/remote-control-plane/tests/*.test.ts`: deterministic unit and integration tests for config, auth, slugs, provisioning, health, revocation, and error mapping.
- `tests/remote-access/control-plane-client.test.ts`: local OmniHarness client tests for control-plane API contracts.
- `src/runtime/http/routes/healthz.ts`: unauthenticated local app health proof used by the hosted control plane through the managed tunnel.
- `src/app/api/healthz/route.ts`: thin Next adapter for the local health route, matching the existing runtime-route pattern.
- `tests/api/healthz-route.test.ts` and `tests/runtime/http-routes.test.ts` coverage for the local health route.
- `docs/remote-access-control-plane.md`: deployment, DNS, Supabase, Cloudflare, operations, and troubleshooting guide.

### Modify

- `pnpm-workspace.yaml`: add workspace package globs for the root app and `services/remote-control-plane/**` while preserving the existing overrides and `allowBuilds`.
- `package.json`: add workspace-aware scripts for testing and typechecking the hosted service without breaking existing local app scripts.
- `pnpm-lock.yaml`: update dependencies.
- `.gitignore`: ignore hosted service `.env*`, local Cloudflare credentials, generated diagnostics, logs, build output, and deployment artifacts.
- `src/server/remote-access/local-state.ts`: if created by the Cloudflared plan, persist the hosted installation id, public origin, status, and encrypted tunnel token.
- `src/server/remote-access/control-plane-client.ts`: local app API client for optional hosted claim/status/heartbeat/token-rotation calls.
- `src/server/auth/config.ts`: prefer healthy remote-access public origin before `OMNIHARNESS_PUBLIC_ORIGIN`, forwarded headers, and request origin.
- `src/runtime/http/routes/index.ts`: register the local `/api/healthz` handler if the runtime registry is the active API source for that route.
- `src/components/PairDeviceDialog.tsx`: show hosted remote-access origin and degraded-state warnings when the control plane reports stale or unhealthy access.
- `src/components/home/SettingsDialog.tsx` or the eventual remote-access panel: expose three modes without forcing account registration: offline/local, bring-your-own tunnel, and paid Omni managed tunnel.
- `docs/superpowers/plans/2026-05-07-memorable-cloudflared-subdomains.md`: link this hosted control-plane plan as the prerequisite for managed named-tunnel delivery.

### Tests

- `services/remote-control-plane/tests/config.test.ts`
- `services/remote-control-plane/tests/auth.test.ts`
- `services/remote-control-plane/tests/entitlements.test.ts`
- `services/remote-control-plane/tests/slug-generator.test.ts`
- `services/remote-control-plane/tests/cloudflare-client.test.ts`
- `services/remote-control-plane/tests/provision.test.ts`
- `services/remote-control-plane/tests/revoke.test.ts`
- `services/remote-control-plane/tests/health.test.ts`
- `services/remote-control-plane/tests/routes.test.ts`
- `tests/api/healthz-route.test.ts`
- `tests/remote-access/control-plane-client.test.ts`
- `tests/e2e/remote-access-control-plane.spec.ts` gated behind real Supabase, Cloudflare, and `cloudflared` credentials.

### Candidate Agentic Journey Tests

These require explicit user approval before running:

- **Managed setup journey:** start local OmniHarness, sign in, claim remote access through `panel.omniharness.dev`, start `cloudflared`, open the public hostname in a separate browser context, log in, and redeem a phone pairing link.
- **Revocation journey:** revoke an installation from the control plane, verify the local connector can no longer expose the app, and verify the public hostname no longer reaches OmniHarness.
- **Degraded tunnel journey:** kill `cloudflared`, verify heartbeat/reachability degradation in the control plane and local UI, then reconnect and verify recovery.

## API Contract

All hosted routes live in the Fastify service, not in Next file-based routes.

```text
POST   /v1/auth/session
POST   /v1/installations/claim
GET    /v1/installations/:id
POST   /v1/installations/:id/heartbeat
POST   /v1/installations/:id/rotate-token
POST   /v1/installations/:id/revoke
GET    /v1/installations/:id/diagnostics
GET    /v1/admin/installations/:id
```

Route guarantees:

- require Supabase auth for user routes,
- allow Supabase registration/login for hosted features without changing local offline startup,

````

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:37:46.556Z","phase":null} -->
## Tool result: call_fLbMXQHQ73LPdNRmm0OuzvOy · 2026-06-14T15:37:46.556Z

```text
Chunk ID: caff38
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 199
Output:
# Selected Server Bootstrap Must Not Be Demoted By Cache

## Context

The home app can receive an authoritative server snapshot for the selected run during bootstrap, then run the scoped frontend-cache hydration effects for that same run. If the cache wins after bootstrap, the view model treats the selected conversation as a preview and keeps the main panel in a loading state.

## Learning

Frontend cache hydration is only a preview fallback. It must not replace or demote an already server-authoritative snapshot for the same selected run.

## Guardrail

When changing event stream hydration, test the bootstrap path with `initialSnapshotSource: "server"` and a populated same-run cache. `hydrateFromCacheScope(selectedRunId)` should return false and preserve `snapshotSource: "server"`.

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:37:54.992Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:37:54.992Z

The existing “common runtime multi-surface” plan is adjacent but not the same: it makes one server reusable by many surfaces. This new plan needs the opposite axis too: one standalone interface selecting and safely multiplexing several OmniHarness server origins.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:37:54.996Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:37:54.996Z

```json
{
  "cmd": "rg --files src/runtime apps scripts tests/lifecycle | sed -n '1,260p'",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:37:54.998Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:37:54.998Z

```json
{
  "cmd": "sed -n '1,260p' src/app/home/LiveEventConnectionManager.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 26000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:37:54.998Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:37:54.998Z

```json
{
  "cmd": "sed -n '1,280p' src/app/home/EventStreamStateManager.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 26000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:37:55.052Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:37:55.052Z

```json
{
  "cmd": "sed -n '1,260p' src/app/home/EventStreamSnapshotCacheManager.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 26000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:37:55.074Z","phase":null} -->
## Tool result: call_tTVj2AeBDPZbtezwc8oMfUkq · 2026-06-14T15:37:55.074Z

```text
Chunk ID: cdc59c
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1088
Output:
src/runtime/bootstrap.ts
src/runtime/index.ts
scripts/_check-stale-runs.ts
scripts/ensure-recommended-tools.sh
scripts/migrate-output-entries-to-disk.ts
scripts/install-agent-acp.ps1
scripts/backfill-worker-entries.ts
scripts/dev-prewarm.ts
scripts/dev-web-recovery.ts
scripts/artifact-repair.ts
scripts/time-gemini-pool.ts
scripts/agent-runtime.ts
scripts/_log-timestamp.mjs
scripts/backfill-runtime-output-to-worker-stream.ts
scripts/rebuild-worker-indices.ts
scripts/backfill-append-only-artifacts.ts
scripts/free-port.sh
scripts/archive-old-run-outputs.ts
scripts/install-agent-acp.sh
scripts/time-worker-pool.ts
scripts/measure-local-dev.mjs
scripts/backfill-worker-initial-prompts.ts
scripts/start.ts
scripts/dev-compression-proxy.ts
scripts/setup-global.sh
scripts/setup-auth.mjs
scripts/install-restarter.sh
scripts/check-pnpm.mjs
scripts/remote-restart.ts
scripts/dev.ts
scripts/time-list-project-files.ts
scripts/time-worker-cold-start.ts
scripts/delete-conversations.sh
scripts/cleanup-stale-sidebar-state.ts
tests/lifecycle/scenarios/direct-mode-rerun.test.ts
tests/lifecycle/scenarios/restart-resync.test.ts
tests/lifecycle/scenarios/plan-improvement-flow.test.ts
tests/lifecycle/scenarios/sse-resume.test.ts
src/runtime/types.ts
tests/lifecycle/scenarios/artifact-backed-snapshot.test.ts
tests/lifecycle/scenarios/conversation-continuation.test.ts
tests/lifecycle/scenarios/end-to-end-events.test.ts
tests/lifecycle/scenarios/delete-conversation-fk.test.ts
tests/lifecycle/scenarios/process-session-restart.test.ts
tests/lifecycle/scenarios/session-provider-capabilities.test.ts
tests/lifecycle/scenarios/worker-reattach.test.ts
tests/lifecycle/scenarios/worker-failover/failover-transcript.test.ts
tests/lifecycle/scenarios/plan-review-blocked.test.ts
tests/lifecycle/scenarios/recovery-exhaustion.test.ts
tests/lifecycle/scenarios/chaos-reconnect-storm.test.ts
tests/lifecycle/scenarios/worker-spawn-failure.test.ts
tests/lifecycle/scenarios/process-session-basic.test.ts
tests/lifecycle/scenarios/session-types.test.ts
tests/lifecycle/scenarios/flaky-network.test.ts
tests/lifecycle/scenarios/supervisor-stopped.test.ts
tests/lifecycle/scenarios/real-restart.test.ts
apps/electron/README.md
apps/electron/main.ts
apps/electron/package.json
apps/vscode/webview/main.tsx
apps/electron/src/native-bridge.ts
apps/electron/src/runtime.ts
apps/electron/preload.ts
apps/vscode/package.json
apps/vscode/README.md
apps/vscode/src/extension.ts
apps/vscode/src/webviewHtml.ts
src/runtime/http/registry.ts
src/runtime/http/server.ts
src/runtime/http/context.ts
apps/vscode/scripts/build.mjs
src/runtime/http/adapters/next.ts
apps/vscode/resources/icon.svg
tests/lifecycle/harness/fixtures.ts
tests/lifecycle/harness/sse.ts
apps/electron/scripts/build.mjs
src/runtime/http/routes/run-answer.ts
src/runtime/http/routes/run-resume.ts
src/runtime/http/routes/conversations.ts
src/runtime/http/routes/auth-pair-redeem.ts
tests/lifecycle/harness/server.ts
tests/lifecycle/harness/chaos.ts
tests/lifecycle/harness/subprocess.ts
tests/lifecycle/harness/client.ts
tests/lifecycle/harness/subprocess-runner.ts
src/runtime/http/routes/conversation-transcript.ts
src/runtime/http/routes/agent-detail.ts
src/runtime/http/routes/runs.ts
src/runtime/http/routes/auth-pair.ts
src/runtime/http/routes/llm-models.ts
src/runtime/http/routes/messages.ts
src/runtime/http/routes/plans.ts
src/runtime/http/routes/notifications.ts
src/runtime/http/routes/settings.ts
src/runtime/http/routes/planning.ts
src/runtime/http/routes/events-log.ts
src/runtime/http/routes/cookies.ts
src/runtime/http/routes/next-request.ts
src/runtime/http/routes/git.ts
src/runtime/http/routes/index.ts
src/runtime/http/routes/accounts.ts
src/runtime/http/routes/runtime-bootstrap.ts
src/runtime/http/routes/supervisor.ts
src/runtime/http/routes/events.ts
src/runtime/http/routes/auth-logout.ts
src/runtime/http/routes/filesystem.ts
src/runtime/http/routes/conversation-messages.ts
src/runtime/http/routes/project-memory.ts
src/runtime/http/routes/prewarm-worker.ts
src/runtime/http/routes/codex-auth-status.ts
src/runtime/http/routes/auth-session.ts
src/runtime/http/routes/agents.ts
src/runtime/http/routes/attachments.ts
src/runtime/http/routes/worker-entries.ts
src/runtime/http/routes/external-sessions.ts
src/runtime/http/routes/auth-login.ts
src/runtime/http/routes/agents-catalog.ts

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:37:55.074Z","phase":null} -->
## Tool result: call_KzvIP3rpnE7IOwRVmOHo1nox · 2026-06-14T15:37:55.074Z

```text
Chunk ID: dc0f73
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2491
Output:
import {
  AppRequestError,
  type AppErrorDescriptor,
  normalizeAppError,
  parseErrorResponse,
  requestJson as defaultRequestJson,
} from "@/lib/app-errors";
import type { EventStreamState } from "./types";
import { workerEntriesManager } from "./WorkerEntriesManager";
import { sidebarWorkerActivityManager, type SidebarWorkerActivityManager } from "./SidebarWorkerActivityManager";

const SNAPSHOT_FALLBACK_INTERVAL_MS = 15_000;
const SNAPSHOT_FALLBACK_COOLDOWN_MS = 1_000;
const SNAPSHOT_VALIDATION_INTERVAL_MS = 5_000;

type JsonRequester = typeof defaultRequestJson;
type SnapshotRequester = (
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  fallback: Partial<AppErrorDescriptor>,
) => Promise<SnapshotPollResult>;

interface LiveEventConnectionManagerOptions {
  selectedRunId?: string | null;
  initialLastEventId?: string | number | null;
  EventSourceConstructor?: typeof EventSource;
  requestJson?: JsonRequester;
  requestSnapshot?: SnapshotRequester;
  getSnapshotChecksum?: () => string | null | undefined;
  workerEntries?: Pick<typeof workerEntriesManager, "onKnownSeqs" | "onStreamResync" | "onWakeUp">;
  sidebarWorkerActivity?: Pick<SidebarWorkerActivityManager, "onKnownSeqs" | "onWakeUp">;
  applyUpdate: (state: EventStreamState) => void;
  reportError: (error: AppErrorDescriptor) => void;
  fallbackIntervalMs?: number;
  fallbackCooldownMs?: number;
  snapshotValidationIntervalMs?: number | null;
}

type SnapshotPollResponse = EventStreamState | {
  notModified: true;
  snapshotChecksum?: string;
  workerEntrySeqs?: Record<string, number>;
};

interface SnapshotPollResult {
  data: SnapshotPollResponse;
  lastEventId?: string | null;
}

function encodeRunParam(selectedRunId: string | null | undefined, prefix: "?" | "&") {
  const runId = selectedRunId?.trim();
  return runId ? `${prefix}runId=${encodeURIComponent(runId)}` : "";
}

function withFallbackErrorContext(
  error: unknown,
  fallback: Pick<AppErrorDescriptor, "source" | "action">,
) {
  const normalized = normalizeAppError(error, fallback);
  return {
    ...normalized,
    source: normalized.source || fallback.source,
    action: normalized.action || fallback.action,
  };
}

function isTransientConnectivityError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  if (error.name === "AbortError" || error.name === "NetworkError") {
    return true;
  }

  if (!(error instanceof TypeError)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes("failed to fetch")
    || message.includes("network")
    || message.includes("load failed")
    || message.includes("offline")
  );
}

function encodeLastEventIdParam(lastEventId: string | number | null | undefined, prefix: "?" | "&") {
  const value = String(lastEventId ?? "").trim();
  return value ? `${prefix}lastEventId=${encodeURIComponent(value)}` : "";
}

function normalizeLastEventId(lastEventId: string | number | null | undefined) {
  const value = String(lastEventId ?? "").trim();
  return value || null;
}

export function buildEventStreamUrl(selectedRunId?: string | null, lastEventId?: string | number | null) {
  const runParam = encodeRunParam(selectedRunId, "?");
  const lastEventIdParam = encodeLastEventIdParam(lastEventId, runParam ? "&" : "?");
  return `/api/events${runParam}${lastEventIdParam}`;
}

export function buildPersistedSnapshotUrl(selectedRunId?: string | null, checksum?: string | null) {
  const checksumParam = checksum?.trim() ? `&checksum=${encodeURIComponent(checksum.trim())}` : "";
  return `/api/events?snapshot=1&persisted=1${encodeRunParam(selectedRunId, "&")}${checksumParam}`;
}

function isNotModifiedSnapshot(value: SnapshotPollResponse): value is Extract<SnapshotPollResponse, { notModified: true }> {
  return typeof value === "object" && value !== null && "notModified" in value && value.notModified === true;
}

async function defaultRequestSnapshot(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  fallback: Partial<AppErrorDescriptor>,
): Promise<SnapshotPollResult> {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new AppRequestError(await parseErrorResponse(response, fallback));
  }

  return {
    data: await response.json() as SnapshotPollResponse,
    lastEventId: response.headers.get("x-omni-last-event-id"),
  };
}

export class LiveEventConnectionManager {
  private readonly selectedRunId?: string | null;
  private readonly EventSourceConstructor: typeof EventSource;
  private readonly requestSnapshot: SnapshotRequester;
  private readonly getSnapshotChecksum?: () => string | null | undefined;
  private readonly workerEntries: Pick<typeof workerEntriesManager, "onKnownSeqs" | "onStreamResync" | "onWakeUp">;
  private readonly sidebarWorkerActivity: Pick<SidebarWorkerActivityManager, "onKnownSeqs" | "onWakeUp">;
  private readonly applyUpdate: (state: EventStreamState) => void;
  private readonly reportError: (error: AppErrorDescriptor) => void;
  private readonly fallbackIntervalMs: number;
  private readonly fallbackCooldownMs: number;
  private readonly snapshotValidationIntervalMs: number | null;
  private eventSource: EventSource | null = null;
  private fallbackTimer: ReturnType<typeof setInterval> | null = null;
  private snapshotValidationTimer: ReturnType<typeof setInterval> | null = null;
  private active = false;
  private pollingSnapshot = false;
  private snapshotPollPromise: Promise<boolean> | null = null;
  private reconnectingAfterResync = false;
  private lastSnapshotPollAt = 0;
  private lastEventId: string | null;

  constructor(options: LiveEventConnectionManagerOptions) {
    this.selectedRunId = options.selectedRunId;
    this.lastEventId = normalizeLastEventId(options.initialLastEventId);
    this.EventSourceConstructor = options.EventSourceConstructor ?? EventSource;
    const requestJson = options.requestJson;
    this.requestSnapshot = options.requestSnapshot
      ?? (requestJson
        ? async (input, init, fallback) => ({
          data: await requestJson<SnapshotPollResponse>(input, init, fallback),
          lastEventId: null,
        })
        : defaultRequestSnapshot);
    this.getSnapshotChecksum = options.getSnapshotChecksum;
    this.workerEntries = options.workerEntries ?? workerEntriesManager;
    this.sidebarWorkerActivity = options.sidebarWorkerActivity ?? sidebarWorkerActivityManager;
    this.applyUpdate = options.applyUpdate;
    this.reportError = options.reportError;
    this.fallbackIntervalMs = options.fallbackIntervalMs ?? SNAPSHOT_FALLBACK_INTERVAL_MS;
    this.fallbackCooldownMs = options.fallbackCooldownMs ?? SNAPSHOT_FALLBACK_COOLDOWN_MS;
    this.snapshotValidationIntervalMs = options.snapshotValidationIntervalMs === undefined
      ? SNAPSHOT_VALIDATION_INTERVAL_MS
      : options.snapshotValidationIntervalMs;
  }

  start() {
    if (this.active) {
      return;
    }

    this.active = true;
    this.openEventSource();

    this.startSnapshotValidation();
    void this.pollSnapshot({ force: true });
  }

  private openEventSource() {
    this.eventSource = new this.EventSourceConstructor(buildEventStreamUrl(this.selectedRunId, this.lastEventId));
    this.eventSource.addEventListener("update", (event) => {
      this.handleUpdateEvent(event);
    });
    this.eventSource.addEventListener("update_error", (event) => {
      this.handleUpdateErrorEvent(event);
    });
    // Worker conversation stream wake-ups. The frame carries only
    // { workerId, seq } — the entry payload is always refetched via
    // /api/workers/:workerId/entries?afterSeq=. See
    // docs/architecture/worker-conversation-stream.md.
    this.eventSource.addEventListener("worker.entry_appended", (event) => {
      this.handleWorkerEntryAppended(event);
    });
    this.eventSource.addEventListener("stream.resync_required", () => {
      void this.handleStreamResyncRequired();
    });
    this.eventSource.onopen = () => {
      this.stopFallbackPolling();
    };
    this.eventSource.onerror = () => {
      // Browsers emit this during sleep/offline transitions while EventSource keeps retrying.
      this.startFallbackPolling();
      void this.pollSnapshot({ force: true });
    };
  }

  stop() {
    this.active = false;
    this.stopFallbackPolling();
    this.stopSnapshotValidation();
    this.eventSource?.close();
    this.eventSource = null;
  }

  private handleUpdateEvent(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data) as EventStreamState;
      this.stopFallbackPolling();
      this.applyUpdate(data);
      this.workerEntries.onKnownSeqs(data.workerEntrySeqs);
      this.sidebarWorkerActivity.onKnownSeqs(data.workerEntrySeqs);
    } catch {
      this.reportError({
        message: "The frontend received a malformed update payload from /api/events.",
        source: "Events",
        action: "Process live updates",
        suggestion: "Inspect the events route response payload and server logs, then refresh the page after fixing the malformed data.",
      });
    }
  }

  private handleWorkerEntryAppended(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data) as { workerId?: unknown; seq?: unknown; runId?: unknown };
      const workerId = typeof data.workerId === "string" ? data.workerId : null;
      const seq = typeof data.seq === "number" ? data.seq : null;
      const runId = typeof data.runId === "string" ? data.runId : null;
      if (!workerId || seq == null) {
        return;
      }
      this.workerEntries.onWakeUp({ workerId, seq });
      this.sidebarWorkerActivity.onWakeUp({ workerId, seq, runId });
    } catch {
      // Malformed frames are ignored — the next valid frame (or the
      // periodic snapshot poll) will re-sync any missed entries.
    }
  }

  private handleUpdateErrorEvent(event: MessageEvent) {
    try {
      this.reportError(withFallbackErrorContext(JSON.parse(event.data), {

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:37:55.074Z","phase":null} -->
## Tool result: call_W4GXFCEXs50a2qPRe8na5sKK · 2026-06-14T15:37:55.074Z

```text
Chunk ID: 05d464
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2479
Output:
import type { EventStreamState, MessageRecord } from "./types";
import { EventStreamSnapshotCacheManager } from "./EventStreamSnapshotCacheManager";

type EventStreamStateListener = (state: EventStreamState) => void;
type EventStreamStateAction = EventStreamState | ((current: EventStreamState) => EventStreamState);
type EventStreamSnapshotSource = NonNullable<EventStreamState["snapshotSource"]>;

function messageTimestampMs(message: MessageRecord) {
  const value = new Date(message.createdAt).getTime();
  return Number.isFinite(value) ? value : 0;
}

function sortMessages(messages: MessageRecord[]) {
  return [...messages].sort((a, b) => {
    const timeDelta = messageTimestampMs(a) - messageTimestampMs(b);
    return timeDelta !== 0 ? timeDelta : a.id.localeCompare(b.id);
  });
}

type RunRecord = EventStreamState["runs"][number];

function mergeByKey<T>(current: T[] | undefined, incoming: T[] | undefined, getKey: (item: T) => string | null | undefined) {
  const incomingItems = incoming ?? [];
  const seen = new Set<string>();
  const merged: T[] = [];

  for (const item of incomingItems) {
    const key = getKey(item);
    if (key) {
      seen.add(key);
    }
    merged.push(item);
  }

  for (const item of current ?? []) {
    const key = getKey(item);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(item);
  }

  return merged;
}

function runUpdatedTimestampMs(run: RunRecord) {
  const value = new Date(run.updatedAt || run.createdAt).getTime();
  return Number.isFinite(value) ? value : 0;
}

function timestampMs(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function mergeReadMarkersForVisibleRuns(current: EventStreamState, incoming: EventStreamState) {
  const visibleRunIds = new Set((incoming.runs ?? []).map((run) => run.id));
  const merged: Record<string, string> = {};

  for (const [runId, readAt] of Object.entries(current.readMarkers ?? {})) {
    if (visibleRunIds.has(runId)) {
      merged[runId] = readAt;
    }
  }

  for (const [runId, readAt] of Object.entries(incoming.readMarkers ?? {})) {
    if (!visibleRunIds.has(runId)) {
      continue;
    }
    if (timestampMs(readAt) >= timestampMs(merged[runId])) {
      merged[runId] = readAt;
    }
  }

  return merged;
}

function mergeScopedCatalog(current: EventStreamState, incoming: EventStreamState) {
  const isSelectedRunScoped = Boolean(incoming.snapshotRunId?.trim());
  const catalogIsPartial = incoming.snapshotScope?.catalog?.complete === false;
  if (!isSelectedRunScoped && !catalogIsPartial) {
    return {
      ...incoming,
      readMarkers: mergeReadMarkersForVisibleRuns(current, incoming),
    };
  }

  const mergedRuns = mergeByKey(current.runs, incoming.runs, (run) => run.id);
  return {
    ...incoming,
    runs: mergedRuns,
    plans: mergeByKey(current.plans, incoming.plans, (plan) => plan.id),
    workers: mergeByKey(current.workers, incoming.workers, (worker) => worker.id),
    sessions: mergeByKey(current.sessions, incoming.sessions, (session) => session.runId),
    readMarkers: mergeReadMarkersForVisibleRuns(current, {
      ...incoming,
      runs: mergedRuns,
    }),
  };
}

function mergeScopedRuns(current: EventStreamState, incoming: EventStreamState, options: {
  serverAuthoritative: boolean;
}) {
  const catalogMergedIncoming = mergeScopedCatalog(current, incoming);
  if (options.serverAuthoritative) {
    return catalogMergedIncoming;
  }

  const incomingRuns = catalogMergedIncoming.runs ?? [];
  if (incomingRuns.length === 0 || !current.runs?.length) {
    return catalogMergedIncoming;
  }

  const currentRunsById = new Map(current.runs.map((run) => [run.id, run]));
  let changed = false;
  const mergedRuns = incomingRuns.map((incomingRun) => {
    const currentRun = currentRunsById.get(incomingRun.id);
    if (!currentRun || runUpdatedTimestampMs(currentRun) <= runUpdatedTimestampMs(incomingRun)) {
      return incomingRun;
    }

    changed = true;
    return {
      ...incomingRun,
      ...currentRun,
    };
  });

  return changed ? { ...catalogMergedIncoming, runs: mergedRuns } : catalogMergedIncoming;
}

/**
 * Supervisor-conversation messages still flow through the `messages`
 * table (worker-attributed messages moved to the unified worker
 * stream). Snapshots declare whether their message run scope is
 * complete; partial updates are additive and must not erase durable
 * conversation messages the client already knows about.
 */
function mergeScopedMessages(current: EventStreamState, incoming: EventStreamState) {
  const incomingMessages = incoming.messages ?? [];
  const incomingMessageIds = new Set(incomingMessages.map((message) => message.id));
  const completeMessageRunIds = new Set(
    incoming.messageScope?.complete ? incoming.messageScope.runIds : [],
  );
  const liveRunIds = new Set((incoming.runs ?? []).map((run) => run.id));
  const retainedCurrentMessages = (current.messages ?? []).filter((message) => (
    liveRunIds.has(message.runId)
    && !incomingMessageIds.has(message.id)
    && !completeMessageRunIds.has(message.runId)
  ));
  const mergedMessages = sortMessages([
    ...retainedCurrentMessages,
    ...incomingMessages,
  ]);

  if (
    mergedMessages.length === incomingMessages.length
    && mergedMessages.every((message, index) => message === incomingMessages[index])
  ) {
    return incoming;
  }

  return {
    ...incoming,
    messages: mergedMessages,
  };
}

function mergeScopedCachedState(current: EventStreamState, cached: EventStreamState): EventStreamState {
  // hydrateFromCacheScope swaps scopes (e.g. on session switch). The cached
  // payload for the newly-selected scope only contains data that was
  // observed while THAT scope was active — its messages/workers/agents/
  // queuedMessages/executionEvents are a strict subset of what we already
  // know across all runs. Replacing current collections with that subset
  // briefly empties any cross-run sidebar view (notably the Active tab,
  // whose filter is driven by messages+workers+agents+queuedMessages).
  //
  // Initial-mount cache hydration takes a different path (hydrateFromCaches
  // → snapshotCache.hydrateState) that already prefers current values when
  // present and falls back to cached when empty, so the only consumers of
  // this merge are scope transitions where current is server-authoritative.
  // Preserve current state and only adopt the scope-pointer metadata so
  // consumers gating on snapshotRunId still recognize the switch.
  return {
    ...current,
    snapshotRunId: cached.snapshotRunId ?? current.snapshotRunId,
    snapshotChecksum: cached.snapshotChecksum ?? current.snapshotChecksum,
    snapshotScope: cached.snapshotScope ?? current.snapshotScope,
    frontendErrors: [],
  };
}

function authoritativeCatalogExcludesScope(state: EventStreamState, scope: string | null | undefined) {
  const scopedRunId = scope?.trim();
  if (!scopedRunId || state.snapshotSource !== "server" || state.snapshotScope?.catalog?.complete !== true) {
    return false;
  }

  return !(state.runs ?? []).some((run) => run.id === scopedRunId);
}

/**
 * State manager for the global `/api/events` snapshot stream. Worker
 * conversation content (bridge entries, user/supervisor inputs,
 * lifecycle markers) is NOT managed here — it lives in
 * `WorkerEntriesManager` and is fetched per-worker via
 * `/api/workers/:workerId/entries`. This manager owns runs, plans,
 * workers metadata, supervisor messages, planning artifacts, queued
 * messages, recovery state, and review records.
 */
export class EventStreamStateManager {
  private state: EventStreamState;
  private readonly listeners = new Set<EventStreamStateListener>();
  private readonly snapshotCache: EventStreamSnapshotCacheManager;
  private snapshotCacheScope: string | null;

  constructor(initialState: EventStreamState, options: {
    snapshotCache?: EventStreamSnapshotCacheManager;
    snapshotCacheScope?: string | null;
    deferCacheHydration?: boolean;
    initialSnapshotSource?: EventStreamSnapshotSource;
  } = {}) {
    this.snapshotCache = options.snapshotCache ?? new EventStreamSnapshotCacheManager();
    this.snapshotCacheScope = options.snapshotCacheScope?.trim() || null;
    const source = options.initialSnapshotSource;
    const initialWithSource = source ? { ...initialState, snapshotSource: source } : initialState;
    if (options.deferCacheHydration) {
      this.state = initialWithSource;
    } else {
      this.state = {
        ...this.snapshotCache.hydrateState(initialWithSource, this.snapshotCacheScope),
        snapshotSource: "cache",
      };
    }
  }

  hydrateFromCaches() {
    if (authoritativeCatalogExcludesScope(this.state, this.snapshotCacheScope)) {
      return;
    }
    if (
      this.state.snapshotSource === "server"
      && (!this.snapshotCacheScope || this.state.snapshotRunId === this.snapshotCacheScope)
    ) {
      return;
    }
    const cached = this.snapshotCache.hydrateState(this.state, this.snapshotCacheScope);
    if (cached === this.state) {
      return;
    }
    this.state = { ...cached, snapshotSource: "cache" };
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  hydrateFromCacheScope(scope: string | null | undefined) {
    this.snapshotCacheScope = scope?.trim() || null;
    if (authoritativeCatalogExcludesScope(this.state, this.snapshotCacheScope)) {
      return false;
    }
    if (
      this.state.snapshotSource === "server"
      && this.snapshotCacheScope
      && this.state.snapshotRunId === this.snapshotCacheScope
    ) {
      return false;
    }
    const cached = this.snapshotCache.getCachedState(this.snapshotCacheScope);
    if (!cached || Object.is(cached, this.state)) {
      return false;
    }

    this.state = {

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:37:55.103Z","phase":null} -->
## Tool result: call_pR0Lp6W9VeBWBTN86cgJ02Rc · 2026-06-14T15:37:55.103Z

```text
Chunk ID: faaae8
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1673
Output:
import type { AgentSnapshot, EventStreamState } from "./types";

const DEFAULT_STORAGE_KEY = "omni-event-stream-snapshot-cache:v1";
const DEFAULT_MAX_SNAPSHOTS = 8;
const DEFAULT_MAX_SERIALIZED_BYTES = 4_000_000;
const GLOBAL_SCOPE_KEY = "__global__";

type SnapshotStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

interface CachedSnapshot {
  updatedAt: number;
  state: EventStreamState;
}

interface SnapshotEnvelope {
  version: 1;
  snapshots: Record<string, CachedSnapshot>;
}

interface EventStreamSnapshotCacheManagerOptions {
  storage?: SnapshotStorage | null;
  storageKey?: string;
  maxSnapshots?: number;
  maxSerializedBytes?: number;
  now?: () => number;
}

function getDefaultStorage(): SnapshotStorage | null {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return null;
  }

  return window.localStorage;
}

function scopeKey(scope: string | null | undefined) {
  return scope?.trim() || GLOBAL_SCOPE_KEY;
}

function emptyEnvelope(): SnapshotEnvelope {
  return {
    version: 1,
    snapshots: {},
  };
}

function compactAgent(agent: AgentSnapshot): AgentSnapshot {
  return {
    ...agent,
    outputEntries: agent.outputEntries?.map((entry) => ({
      ...entry,
      raw: undefined,
    })),
  };
}

function compactStateForCache(state: EventStreamState): EventStreamState {
  return {
    ...state,
    agents: (state.agents ?? []).map(compactAgent),
    frontendErrors: [],
  };
}

function preferInitialArray<T>(
  initial: T[] | undefined,
  cached: T[] | undefined,
  options: { serverAuthoritative: boolean },
) {
  if (options.serverAuthoritative && initial) {
    return initial;
  }

  return initial && initial.length > 0 ? initial : cached ?? [];
}

function isEventStreamState(value: unknown): value is EventStreamState {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Partial<EventStreamState>;
  return Array.isArray(record.runs) && Array.isArray(record.messages);
}

export class EventStreamSnapshotCacheManager {
  private readonly storage: SnapshotStorage | null;
  private readonly storageKey: string;
  private readonly maxSnapshots: number;
  private readonly maxSerializedBytes: number;
  private readonly now: () => number;

  constructor(options: EventStreamSnapshotCacheManagerOptions = {}) {
    this.storage = options.storage === undefined ? getDefaultStorage() : options.storage;
    this.storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
    this.maxSnapshots = options.maxSnapshots ?? DEFAULT_MAX_SNAPSHOTS;
    this.maxSerializedBytes = options.maxSerializedBytes ?? DEFAULT_MAX_SERIALIZED_BYTES;
    this.now = options.now ?? Date.now;
  }

  hydrateState(initialState: EventStreamState, scope: string | null | undefined = null) {
    const cachedState = this.getCachedState(scope);
    if (!cachedState) {
      return initialState;
    }
    const arrayMergeOptions = {
      serverAuthoritative: initialState.snapshotSource === "server",
    };

    return {
      ...cachedState,
      ...initialState,
      messages: preferInitialArray(initialState.messages, cachedState.messages, arrayMergeOptions),
      plans: preferInitialArray(initialState.plans, cachedState.plans, arrayMergeOptions),
      runs: preferInitialArray(initialState.runs, cachedState.runs, arrayMergeOptions),
      accounts: preferInitialArray(initialState.accounts, cachedState.accounts, arrayMergeOptions),
      agents: preferInitialArray(initialState.agents, cachedState.agents, arrayMergeOptions),
      workers: preferInitialArray(initialState.workers, cachedState.workers, arrayMergeOptions),
      planItems: preferInitialArray(initialState.planItems, cachedState.planItems, arrayMergeOptions),
      clarifications: preferInitialArray(initialState.clarifications, cachedState.clarifications, arrayMergeOptions),
      executionEvents: preferInitialArray(initialState.executionEvents, cachedState.executionEvents, arrayMergeOptions),
      supervisorInterventions: preferInitialArray(initialState.supervisorInterventions, cachedState.supervisorInterventions, arrayMergeOptions),
      queuedMessages: preferInitialArray(initialState.queuedMessages, cachedState.queuedMessages, arrayMergeOptions),
      recoveryIncidents: preferInitialArray(initialState.recoveryIncidents, cachedState.recoveryIncidents, arrayMergeOptions),
      frontendErrors: [],
    };
  }

  getCachedState(scope: string | null | undefined = null): EventStreamState | null {
    const snapshot = this.readEnvelope().snapshots[scopeKey(scope)];
    if (!snapshot || !isEventStreamState(snapshot.state)) {
      return null;
    }

    return {
      ...snapshot.state,
      frontendErrors: [],
    };
  }

  rememberState(state: EventStreamState, scope: string | null | undefined = null) {
    if (!this.storage) {
      return;
    }

    const currentEnvelope = this.readEnvelope();
    const envelope = this.pruneEnvelope({
      ...currentEnvelope,
      snapshots: {
        ...currentEnvelope.snapshots,
        [scopeKey(scope)]: {
          updatedAt: this.now(),
          state: compactStateForCache(state),
        },
      },
    });

    const serialized = JSON.stringify(envelope);
    if (serialized.length > this.maxSerializedBytes) {
      return;
    }

    try {
      this.storage.setItem(this.storageKey, serialized);
    } catch {
      // localStorage can be unavailable or full. The live stream remains the source of truth.
    }
  }

  private readEnvelope(): SnapshotEnvelope {
    if (!this.storage) {
      return emptyEnvelope();
    }

    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) {
        return emptyEnvelope();
      }

      const parsed = JSON.parse(raw) as Partial<SnapshotEnvelope>;
      if (parsed.version !== 1 || typeof parsed.snapshots !== "object" || parsed.snapshots === null) {
        return emptyEnvelope();
      }

      return {
        version: 1,
        snapshots: parsed.snapshots as Record<string, CachedSnapshot>,
      };
    } catch {
      try {
        this.storage.removeItem(this.storageKey);
      } catch {
        // Ignore cleanup failures.
      }
      return emptyEnvelope();
    }
  }

  private pruneEnvelope(envelope: SnapshotEnvelope): SnapshotEnvelope {
    const snapshots = Object.fromEntries(
      Object.entries(envelope.snapshots)
        .sort((left, right) => {
          const updatedDelta = right[1].updatedAt - left[1].updatedAt;
          return updatedDelta !== 0 ? updatedDelta : left[0].localeCompare(right[0]);
        })
        .slice(0, this.maxSnapshots),
    );

    return {
      version: 1,
      snapshots,
    };
  }
}

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:38:02.661Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:38:02.661Z

The current frontend already has the right primitives for this kind of work: manager-owned state, scoped snapshot caching, explicit `lastEventId`, and per-worker entry cursors. The plan will mostly add a server-origin axis to those existing ownership tokens.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:38:02.691Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:38:02.691Z

```json
{
  "cmd": "sed -n '1,280p' src/app/home/types.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 32000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:38:02.692Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:38:02.692Z

```json
{
  "cmd": "sed -n '1,260p' src/app/home/bootstrap.server.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 28000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:38:02.692Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:38:02.692Z

```json
{
  "cmd": "sed -n '1,260p' src/app/home/HomeApp.tsx",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:38:02.739Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:38:02.739Z

```json
{
  "cmd": "sed -n '1,220p' src/runtime/http/server.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 22000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:38:02.819Z","phase":null} -->
## Tool result: call_Qdcwicyx4FtvvmRV3OGVGfLG · 2026-06-14T15:38:02.819Z

```text
Chunk ID: 8b3378
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1958
Output:
import type { AppErrorDescriptor } from "@/lib/app-errors";
import type { ConversationModeOption } from "@/components/ConversationModePicker";
import type { ConversationWorkerRecord } from "@/lib/conversation-workers";
import type { ChatAttachment } from "@/lib/chat-attachments";
import type { AgentOutputEntry } from "@/lib/agent-output";
import type { WorkerEntry } from "@/server/workers/entries-types";
import type { BusyMessageAction } from "./busy-message-behavior";

export type { ConversationModeOption };

export type RunMode = ConversationModeOption | "commit";

export type SessionType = "omni" | "process";
export type SessionCapability =
  | "send_input"
  | "stop"
  | "retry_from_message"
  | "edit_message"
  | "fork_session"
  | "fork_message"
  | "queue_input"
  | "approve_permission"
  | "open_project_file"
  | "use_git_workspace";

export type SessionRecord = {
  id: string;
  runId: string;
  sessionType: SessionType;
  status: string;
  capabilities: SessionCapability[];
  primaryActorId: string | null;
  title: string | null;
  projectPath: string | null;
  providerMetadata?: Record<string, unknown> | null;
};

export type PlanRecord = { id: string; path: string };
export type RunRecord = {
  id: string;
  planId: string;
  sessionType?: SessionType | null;
  mode?: RunMode | null;
  status: string;
  createdAt: string;
  updatedAt?: string | null;
  failedAt?: string | null;
  lastError?: string | null;
  archivedAt?: string | null;
  parentRunId?: string | null;
  projectPath: string | null;
  title: string | null;
  preferredWorkerType?: string | null;
  preferredWorkerModel?: string | null;
  preferredWorkerEffort?: string | null;
  allowedWorkerTypes?: string | null;
  specPath?: string | null;
  artifactPlanPath?: string | null;
  plannerArtifactsJson?: string | null;
  autoCommitMilestones?: boolean | null;
  pushOnCommit?: boolean | null;
  gitBaselineJson?: string | null;
  gitWorkspaceJson?: string | null;
  completionCommitSha?: string | null;
};
export type PlanItemRecord = { id: string; planId: string; title: string; phase: string | null; status: string };
export type ClarificationRecord = {
  id: string;
  runId: string;
  question: string;
  answer: string | null;
  status: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};
export type MessageRecord = {
  id: string;
  runId: string;
  role: string;
  kind?: string | null;
  content: string;
  workerId?: string | null;
  attachments?: ChatAttachment[];
  attachmentsJson?: string | null;
  createdAt: string;
};
export type ExecutionEventRecord = {
  id: string;
  runId: string;
  workerId?: string | null;
  planItemId?: string | null;
  eventType: string;
  details?: string | null;
  createdAt: string;
};
export type SupervisorInterventionRecord = {
  id: string;
  runId: string;
  workerId?: string | null;
  interventionType: string;
  prompt: string;
  summary?: string | null;
  createdAt: string;
};
export type QueuedConversationMessageRecord = {
  id: string;
  runId: string;
  targetWorkerId?: string | null;
  action: BusyMessageAction;
  content: string;
  status: "pending" | "delivering" | "delivered" | "cancelled" | "failed";
  lastError?: string | null;
  attachments?: ChatAttachment[];
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string | null;
};
export type QueuedMessageInterruptResponse = {
  ok: true;
  message?: MessageRecord;
  queuedMessage: QueuedConversationMessageRecord;
  interruption: {
    status: "delivering" | "deferred";
    workerId: string;
    cancelDurationMs: number;
  };
};
export type RecoveryIncidentRecord = {
  id: string;
  runId: string;
  workerId?: string | null;
  queuedMessageId?: string | null;
  kind: string;
  status: string;
  autoAttemptCount: number;
  lastError?: string | null;
  details?: string | null;
  detectedAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
};
export type PlanningReviewRunRecord = {
  id: string;
  runId: string;
  status: string;
  agentSelection: string;
  resolvedWorkerType?: string | null;
  roundsRequested: number;
  roundsCompleted: number;
  startedAt: string;
  completedAt?: string | null;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
};
export type PlanningReviewRoundRecord = {
  id: string;
  reviewRunId: string;
  runId: string;
  roundNumber: number;
  status: string;
  workerId?: string | null;
  resolvedWorkerType?: string | null;
  selectionReason?: string | null;
  findingsSummary?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
};
export type PlanningReviewFindingRecord = {
  id: string;
  reviewRunId: string;
  roundId: string;
  runId: string;
  severity: string;
  category: string;
  title: string;
  details: string;
  recommendation: string;
  sourcePath?: string | null;
  createdAt: string;
};
export type RunRecoveryState = {
  kind: string;
  status: string;
  workerId?: string | null;
  queuedMessageId?: string | null;
  message?: string | null;
  recommendedAction?: string | null;
  lastError?: string | null;
  attemptCount?: number | null;
  nextAttemptAt?: string | null;
  resumeAt?: string | null;
  quotaResetSource?: string | null;
  quotaResetConfidence?: string | null;
  policyDecision?: string | null;
};
export type AgentSnapshot = {
  name: string;
  type?: string;
  cwd?: string;
  state: string;
  requestedModel?: string | null;
  effectiveModel?: string | null;
  requestedEffort?: string | null;
  effectiveEffort?: string | null;
  sessionMode?: string | null;
  sessionId?: string | null;
  protocolVersion?: string | number | null;
  lastError?: string | null;
  recentStderr?: string[];
  pendingPermissions?: Array<{
    requestId: number;
    requestedAt: string;
    sessionId?: string | null;
    toolCall?: {
      toolCallId?: string | null;
      kind?: string | null;
      title?: string | null;
      status?: string | null;
    } | null;
    options?: Array<{ optionId: string; kind: string; name: string }>;
  }>;
  createdAt?: string;
  updatedAt?: string;
  contextUsage?: {
    inputTokens?: number | null;
    outputTokens?: number | null;
    totalTokens?: number | null;
    maxTokens?: number | null;
    fullnessPercent?: number | null;
  } | null;
  outputEntries?: AgentOutputEntry[];
  lastText?: string;
  currentText?: string;
  displayText?: string;
  outputLog?: string;
  bridgeLastError?: string | null;
  runLastError?: string | null;
  stderrBuffer?: string[];
  stopReason?: string | null;
  bridgeMissing?: boolean;
};
export type ProjectFilesResponse = { root: string; files: string[] };
export type ProjectFileContentResponse = { root: string; path: string; content: string; size: number; truncated: boolean };
export type WorkerType = "codex" | "claude" | "gemini" | "opencode";
export type ComposerWorkerOption = WorkerType | "auto";
export type WorkerAuthentication = {
  status: "authenticated" | "not_authenticated" | "unknown" | "not_applicable";
  method: "api_key" | "session_file" | "status_command" | "missing" | "unknown" | "not_applicable";
  message: string;
  setupCommand: string | null;
};
export type WorkerTokenQuota = {
  status: "reported" | "usage_only" | "unavailable" | "unknown";
  source: string;
  message: string;
  remainingTokens: number | null;
  monthlyLimitTokens: number | null;
  usedTokens: number | null;
  resetAt: string | null;
};
export type WorkerAvailability = {
  type: WorkerType;
  label: string;
  installation?: {
    command: string;
    path: string | null;
    dir: string | null;
  };
  availability: {
    status: "ok" | "warning" | "error";
    binary: boolean;
    apiKey: boolean | null;
    endpoint: boolean | null;
    message?: string;
  };
  authentication?: WorkerAuthentication;

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:38:02.819Z","phase":null} -->
## Tool result: call_kg8NFaFPzGpb0fkGrscHziqj · 2026-06-14T15:38:02.819Z

```text
Chunk ID: 934d8f
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 132
Output:
import { headers } from "next/headers";
import { buildRuntimeBootstrap } from "@/runtime/bootstrap";
import type { HomeBootstrapPayload } from "@/runtime/bootstrap";

export type { HomeBootstrapPayload };

type PageSearchParams = Record<string, string | string[] | undefined>;

export async function buildHomeBootstrap(searchParams: PageSearchParams = {}): Promise<HomeBootstrapPayload> {
  const requestHeaders = await headers();
  return buildRuntimeBootstrap({ searchParams, requestHeaders, includeInitialData: false });
}

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:38:02.819Z","phase":null} -->
## Tool result: call_T7yvV9MGOlS4mq1DXT75DSAz · 2026-06-14T15:38:02.819Z

```text
Chunk ID: 97ed03
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2289
Output:
"use client";

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { BootShell } from "@/components/BootShell";
import { LoginShell } from "@/components/LoginShell";
import { AttachmentImagePreviewDialog } from "@/components/AttachmentImagePreviewDialog";
import { ConversationMain } from "@/components/home/ConversationMain";
import { ConversationSidebar } from "@/components/home/ConversationSidebar";
import { HomeHeader } from "@/components/home/HomeHeader";
import { resolveProjectScope } from "@/lib/project-scope";
import { WORKER_OPTIONS } from "./constants";
import { busyMessageQueueManager } from "./BusyMessageQueueManager";
import { conversationNotificationManager } from "./ConversationNotificationManager";
import { sideWindowManager } from "./SideWindowManager";
import { parseBusyMessageAction } from "./busy-message-behavior";
import {
  isMutationPendingForSelectedRun,
  resolveDirectControlPendingAssistantStatus,
  resolvePendingConversationWorkerId,
} from "./direct-control-activity";
import { cancelInactiveAutoResumeTimers, shouldFireAutoResumeTimer } from "./auto-resume-selection";
import { EventStreamStateManager } from "./EventStreamStateManager";
import {
  homeUiSetters,
  homeUiStateManager,
  INITIAL_EVENT_STREAM_STATE,
  type HomeUiState,
} from "./HomeUiStateManager";
import { appearancePreferencesManager, getAppearanceTextSizeStyle } from "./AppearancePreferencesManager";
import { settingsDraftManager } from "./SettingsDraftManager";
import { planningReviewPreferencesManager } from "./PlanningReviewPreferencesManager";
import { preflightConfirmationActionsManager } from "./PreflightConfirmationActionsManager";
import {
  filterOptimisticallyDeletedRuns,
  createClientRunId,
  mergePendingCreatedConversationSnapshots,
  mergePendingSentConversationMessages,
  parseBrowserConversationRoute,
  parseProjectList,
  resolveRepoName,
  resolveSelectedWorkerModel,
  shouldClearMissingSelectedRunFromAuthoritativeSnapshot,
  stripRunFailurePrefix,
  type CreatedConversationSnapshot,
} from "./utils";
import { useAppErrors } from "./useAppErrors";
import { useConversationExecutionStatus } from "./useConversationExecutionStatus";
import { useHomeLifecycle } from "./useHomeLifecycle";
import { shallowEqualRecord, useManagerSelector, useManagerSnapshot } from "@/lib/use-manager-snapshot";
import { useRunRecoveryState } from "./useRunRecoveryState";
import { useRunSelectionEffects } from "./useRunSelectionEffects";
import type { ConversationSidebarTab, EventStreamState, MessageRecord, SidebarGroup } from "./types";
import type { HomeBootstrapPayload } from "./bootstrap.server";
import { useHomeQueries } from "./useHomeQueries";
import { useHomeViewModel } from "./useHomeViewModel";
import { useFrozenRecentOrder } from "./useFrozenRecentOrder";
import { useHomeMutations } from "./useHomeMutations";
import { useConversationActions } from "./useConversationActions";
import { useHomeLayoutController } from "./useHomeLayoutController";
import { ComposerContainer } from "./ComposerContainer";
import { sessionStateManager } from "./SessionStateManager";
import { t } from "@/lib/i18n";
import { StateManager } from "@/lib/state-manager";
import { workersSidebarManager } from "@/components/component-state-managers";

const FolderPickerDialog = dynamic(
  () => import("@/components/FolderPickerDialog").then((m) => m.FolderPickerDialog),
  { ssr: false },
);
const PairDeviceDialog = dynamic(
  () => import("@/components/PairDeviceDialog").then((m) => m.PairDeviceDialog),
  { ssr: false },
);
const SettingsDialog = dynamic(
  () => import("@/components/home/SettingsDialog").then((m) => m.SettingsDialog),
  { ssr: false },
);
const OnboardingSetupDialog = dynamic(
  () => import("@/components/home/OnboardingSetupDialog").then((m) => m.OnboardingSetupDialog),
  { ssr: false },
);
const SideWindow = dynamic(
  () => import("@/components/home/SideWindow").then((m) => m.SideWindow),
  { ssr: false },
);
const ExternalSessionsPicker = dynamic(
  () => import("@/app/home/ExternalSessionsPicker").then((m) => m.ExternalSessionsPicker),
  { ssr: false },
);

const ONBOARDING_SEEN_STORAGE_KEY = "omni.onboarding.seen";
let appliedHomeBootstrapId: string | null = null;

class AutoResumeExhaustionManager extends StateManager<Set<string>> {
  constructor() {
    super(new Set());
  }

  clear(runId: string) {
    this.update((current) => {
      if (!current.has(runId)) return current;
      const next = new Set(current);
      next.delete(runId);
      return next;
    });
  }

  mark(runId: string) {
    this.update((current) => {
      if (current.has(runId)) return current;
      return new Set(current).add(runId);
    });
  }
}

const autoResumeExhaustionManager = new AutoResumeExhaustionManager();

type HomeAppState = Omit<HomeUiState, "command" | "commandCursor" | "mentionIndex" | "attachments">;

function selectHomeAppState(state: HomeUiState): HomeAppState {
  const s: Partial<HomeUiState> = { ...state };
  delete s.command;
  delete s.commandCursor;
  delete s.mentionIndex;
  delete s.attachments;
  return s as HomeAppState;
}

function timestampMs(value: string | null | undefined) {
  if (!value) {
    return 0;
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function mergeReadMarkers(
  persisted: Record<string, string> | null | undefined,
  optimistic: Record<string, string>,
) {
  const merged = { ...(persisted ?? {}) };
  for (const [runId, readAt] of Object.entries(optimistic)) {
    if (timestampMs(readAt) >= timestampMs(merged[runId])) {
      merged[runId] = readAt;
    }
  }
  return merged;
}

function applyHomeBootstrap(bootstrap: HomeBootstrapPayload | null | undefined, notify = true) {
  if (!bootstrap || appliedHomeBootstrapId === bootstrap.id) {
    return;
  }

  appliedHomeBootstrapId = bootstrap.id;
  const browserRoute = typeof window === "undefined"
    ? bootstrap.route
    : parseBrowserConversationRoute(window.location);
  const routeSelectedRunId = browserRoute.selectedRunId;

  const settingsValues = bootstrap.initialQueries.settings?.values ?? {};
  if (bootstrap.initialQueries.settings) {
    settingsDraftManager.hydrate(settingsValues, notify);
    planningReviewPreferencesManager.hydrate(settingsValues);
  }

  homeUiStateManager.patch((current) => ({
    routeReady: true,
    hasReceivedInitialEventStreamPayload: Boolean(bootstrap.initialEventState),
    selectedRunId: routeSelectedRunId,
    draftProjectPath: routeSelectedRunId ? null : browserRoute.draftProjectPath,
    pairTokenFromUrl: browserRoute.pairTokenFromUrl,
    apiKeys: { ...current.apiKeys, ...settingsValues },
    settingsDiagnostics: bootstrap.initialQueries.settings?.diagnostics ?? current.settingsDiagnostics,
  }), notify);

  if (bootstrap.initialEventState?.queuedMessages) {
    busyMessageQueueManager.setQueuedMessages(bootstrap.initialEventState.queuedMessages, notify);
  }
}

export function HomeApp({ bootstrap }: { bootstrap?: HomeBootstrapPayload | null }) {
  applyHomeBootstrap(bootstrap, false);
  const [showExternalSessionsPicker, setShowExternalSessionsPicker] = useState(false);
  const initialEventState = bootstrap?.initialEventState ?? INITIAL_EVENT_STREAM_STATE;
  const initialRoute = typeof window === "undefined"
    ? bootstrap?.route
    : parseBrowserConversationRoute(window.location);
  const initialSnapshotScope = initialRoute?.selectedRunId ?? null;

  const {
    themeMode,
    showSettings,
    showOnboarding,
    showPairDeviceDialog,
    activeSettingsTab,
    activeLlmProfileTab,
    apiKeys,
    showFolderPicker,
    selectedRunId,
    leftSidebarOpen,
    leftSidebarWidth,
    rightSidebarOpen,
    rightSidebarWidth,
    isResizingLeftSidebar,
    isResizingRightSidebar,
    mobileNavOpen,
    mobileWorkersOpen,
    searchQuery,
    draftProjectPath,
    readMarkers,
    collapsedProjectPaths,
    visibleProjectSessionCounts,
    renamingRunId,
    renameValue,
    renameSource,
    editingMessageId,
    editingMessageValue,
    expandedDirectMessageIds,
    routeReady,
    hasReceivedInitialEventStreamPayload,
    selectedConversationMode,
    selectedCliAgent,
    selectedModel,
    selectedEffort,
    hydratedRunSelectionId,
    pairTokenFromUrl,
    authError,
    pairRedeemError,
    pairRedeemAttempted,
    runtimeErrors,
    settingsDiagnostics,
    conversationSidebarTab,
  } = useManagerSelector(homeUiStateManager, selectHomeAppState, shallowEqualRecord);

  const {
    setThemeMode,
    setShowSettings,
    setShowOnboarding,
    setShowPairDeviceDialog,
    setActiveSettingsTab,
    setActiveLlmProfileTab,
    setApiKeys,
    setShowFolderPicker,
    setSelectedRunId,
    setLeftSidebarOpen,
    setLeftSidebarWidth,
    setRightSidebarOpen,
    setRightSidebarWidth,
    setIsResizingLeftSidebar,
    setIsResizingRightSidebar,
    setMobileNavOpen,
    setMobileWorkersOpen,
    setSearchQuery,
    setDraftProjectPath,
    setReadMarkers,
    setCollapsedProjectPaths,
    setProjectExpanded,

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:38:02.819Z","phase":null} -->
## Tool result: call_t2cxaWur3of3F7Y7zHw0I9g6 · 2026-06-14T15:38:02.819Z

```text
Chunk ID: b83a1e
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1576
Output:
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "http";
import { readFile, stat } from "fs/promises";
import type { AddressInfo } from "net";
import path from "path";
import type { RuntimeSurface } from "@/server/events/named-events";
import type { OmniRuntime } from "@/runtime";
import type { OmniHttpRegistry } from "./registry";

export interface StartOmniHttpServerOptions {
  host?: string;
  port?: number;
  surface?: RuntimeSurface;
  registry: OmniHttpRegistry;
  staticDir?: string | null;
}

export interface OmniHttpServerHandle {
  origin: string;
  httpServer: Server;
  getPort(): number;
  stop(): Promise<void>;
}

export interface StartOmniServerOptions extends StartOmniHttpServerOptions {
  runtime: OmniRuntime;
}

export interface OmniServerHandle extends OmniHttpServerHandle {
  runtime: OmniRuntime;
  isReady(): boolean;
}

async function readRequestBody(request: IncomingMessage): Promise<Buffer | undefined> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return undefined;
  }
  return Buffer.concat(chunks);
}

function requestUrl(request: IncomingMessage, host: string, port: number) {
  const rawUrl = request.url || "/";
  const headerHost = request.headers.host;
  const authority = typeof headerHost === "string" && headerHost.trim()
    ? headerHost.trim()
    : `${host}:${port}`;
  return `http://${authority}${rawUrl}`;
}

async function toFetchRequest(request: IncomingMessage, host: string, port: number) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else if (typeof value === "string") {
      headers.set(key, value);
    }
  }

  const method = request.method || "GET";
  const requestBody = method === "GET" || method === "HEAD"
    ? undefined
    : await readRequestBody(request);
  const body = requestBody ? new Uint8Array(requestBody) : undefined;

  return new Request(requestUrl(request, host, port), { method, headers, body });
}

async function writeFetchResponse(response: ServerResponse, fetchResponse: Response) {
  response.statusCode = fetchResponse.status;
  fetchResponse.headers.forEach((value, key) => {
    response.setHeader(key, value);
  });
  const body = Buffer.from(await fetchResponse.arrayBuffer());
  response.end(body);
}

const MIME_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

async function tryServeStatic(
  request: IncomingMessage,
  response: ServerResponse,
  staticDir: string | null | undefined,
) {
  if (!staticDir || request.method !== "GET") {
    return false;
  }

  const rawUrl = request.url || "/";
  const pathname = new URL(rawUrl, "http://runtime.local").pathname;
  if (pathname.startsWith("/api/")) {
    return false;
  }

  const decodedPath = decodeURIComponent(pathname);
  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  const root = path.resolve(staticDir);
  const candidate = path.resolve(root, relativePath);
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
    response.statusCode = 403;
    response.end("Forbidden");
    return true;
  }

  const fallback = path.join(root, "index.html");
  let filePath = candidate;
  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
  } catch {
    filePath = fallback;
  }

  try {
    const body = await readFile(filePath);
    response.statusCode = 200;
    response.setHeader("content-type", MIME_TYPES[path.extname(filePath)] ?? "application/octet-stream");
    response.end(body);
  } catch {
    response.statusCode = 404;
    response.end("Not found");
  }

  return true;
}

export async function startOmniHttpServer(options: StartOmniHttpServerOptions): Promise<OmniHttpServerHandle> {
  const host = options.host ?? "127.0.0.1";
  const requestedPort = options.port ?? 0;
  const surface = options.surface ?? "web";

  let activePort = requestedPort;
  const server = createServer((request, response) => {
    void (async () => {
      if (await tryServeStatic(request, response, options.staticDir)) {
        return;
      }
      const fetchRequest = await toFetchRequest(request, host, activePort);
      const fetchResponse = await options.registry.handle(fetchRequest, { surface });
      await writeFetchResponse(response, fetchResponse);
    })().catch((error) => {
      response.statusCode = 500;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({
        error: {
          code: "runtime.server_failed",
          message: error instanceof Error ? error.message : String(error),
          surface,
        },
      }));
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(requestedPort, host, () => {
      server.off("error", reject);
      activePort = (server.address() as AddressInfo).port;
      resolve();
    });
  });

  return {
    origin: `http://${host}:${activePort}`,
    httpServer: server,
    getPort: () => activePort,
    stop: () => new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    }),
  };
}

export async function startOmniServer(options: StartOmniServerOptions): Promise<OmniServerHandle> {
  await options.runtime.start();
  const httpHandle = await startOmniHttpServer(options);
  let ready = true;

  return {
    ...httpHandle,
    runtime: options.runtime,
    isReady: () => ready,
    async stop() {
      if (!ready && options.runtime.getStatus() !== "running") {
        return;
      }
      ready = false;
      await httpHandle.stop();
      await options.runtime.stop("shutdown");
    },
  };
}

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:38:10.898Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:38:10.898Z

This repo now has a real standalone HTTP runtime server and Electron/VS Code shells, so the plan can build on that instead of proposing a runtime extraction from scratch. The missing abstraction is a runtime-client/server-directory layer for the renderer.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:38:10.931Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:38:10.931Z

```json
{
  "cmd": "sed -n '1,260p' src/runtime/bootstrap.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:38:10.943Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:38:10.943Z

```json
{
  "cmd": "sed -n '1,260p' src/runtime/http/routes/runtime-bootstrap.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 26000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:38:10.943Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:38:10.943Z

```json
{
  "cmd": "sed -n '1,260p' src/app/home/useHomeQueries.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 26000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:38:10.992Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:38:10.992Z

```json
{
  "cmd": "sed -n '1,300p' src/app/home/useHomeMutations.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 32000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:38:11.014Z","phase":null} -->
## Tool result: call_PtiHkgzwQLHnRwFPKKFiMEXI · 2026-06-14T15:38:11.014Z

```text
Chunk ID: 24fab7
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 881
Output:
import { buildAuthSessionState } from "@/server/auth/session-state";
import { buildPersistedEventPayload } from "@/server/events/persisted-snapshot";
import { getEventCursor } from "@/server/events/named-events";
import { readSettingsState } from "@/server/settings/read";
import type { EventStreamState, SettingsResponse, AuthSessionResponse } from "@/app/home/types";

export type HomeBootstrapPayload = {
  id: string;
  route: {
    selectedRunId: string | null;
    draftProjectPath: string | null;
    pairTokenFromUrl: string | null;
  };
  initialEventState: EventStreamState | null;
  initialLastEventId: string;
  initialQueries: {
    session: AuthSessionResponse | null;
    settings: SettingsResponse | null;
  };
  features: {
    unifiedWorkerStream: boolean;
  };
};

type PageSearchParams = Record<string, string | string[] | undefined>;

export type RuntimeBootstrapOptions = {
  searchParams?: PageSearchParams;
  requestHeaders: Headers;
  includeInitialData?: boolean;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function normalizeParam(value: string | string[] | undefined) {
  return firstParam(value).trim() || null;
}

function buildRequestUrl(searchParams: PageSearchParams, requestHeaders: Headers) {
  const host = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim()
    || requestHeaders.get("host")?.trim()
    || "localhost";
  const protocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
  const url = new URL(`${protocol}://${host}/`);

  for (const [key, rawValue] of Object.entries(searchParams)) {
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const value of values) {
      if (value != null) {
        url.searchParams.append(key, value);
      }
    }
  }

  return url;
}

export async function buildRuntimeBootstrap({
  searchParams = {},
  requestHeaders,
  includeInitialData = true,
}: RuntimeBootstrapOptions): Promise<HomeBootstrapPayload> {
  const requestUrl = buildRequestUrl(searchParams, requestHeaders);
  const selectedRunId = normalizeParam(searchParams.run);
  const draftProjectPath = normalizeParam(searchParams.project);
  const pairTokenFromUrl = normalizeParam(searchParams.pair);

  const session = await buildAuthSessionState({
    url: requestUrl.toString(),
    headers: requestHeaders,
  });
  const appUnlocked = Boolean(session && (!session.enabled || session.authenticated));

  const [settings, initialEventState] = appUnlocked && includeInitialData
    ? await Promise.all([
        readSettingsState(),
        buildPersistedEventPayload({ selectedRunId }),
      ])
    : [null, null];

  return {
    id: JSON.stringify({
      builtAt: Date.now(),
      selectedRunId,
      draftProjectPath,
      pairTokenFromUrl,
      sessionAuthenticated: session?.authenticated ?? false,
      eventRunCount: initialEventState?.runs?.length ?? 0,
    }),
    route: {
      selectedRunId,
      draftProjectPath,
      pairTokenFromUrl,
    },
    initialEventState,
    initialLastEventId: String(getEventCursor()),
    initialQueries: {
      session,
      settings,
    },
    features: {
      // The unified worker stream is unconditionally enabled after the
      // Phase 5 cutover. The boolean is kept on the bootstrap shape so
      // older client/server pairs don't break during the rollout
      // window; future cleanup may drop it entirely.
      unifiedWorkerStream: true,
    },
  };
}

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:38:11.014Z","phase":null} -->
## Tool result: call_cLj7g059NNXfpXjKusWAV5Jm · 2026-06-14T15:38:11.014Z

```text
Chunk ID: b87ac6
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 177
Output:
import { buildRuntimeBootstrap } from "@/runtime/bootstrap";
import type { OmniHttpHandler } from "@/runtime/http/registry";

function readSearchParams(request: Request) {
  const url = new URL(request.url);
  const params: Record<string, string | string[]> = {};

  for (const key of url.searchParams.keys()) {
    const values = url.searchParams.getAll(key);
    params[key] = values.length > 1 ? values : values[0] ?? "";
  }

  return params;
}

export const handleRuntimeBootstrapRequest: OmniHttpHandler = async (request) => {
  const payload = await buildRuntimeBootstrap({
    searchParams: readSearchParams(request),
    requestHeaders: request.headers,
  });
  return Response.json(payload);
};

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:38:11.014Z","phase":null} -->
## Tool result: call_2ALhOeNGxZn0thTGSdjrAOoC · 2026-06-14T15:38:11.014Z

```text
Chunk ID: e507bf
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1185
Output:
"use client";

import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AppErrorDescriptor } from "@/lib/app-errors";
import { requestJson } from "@/lib/app-errors";
import { homeUiSetters } from "./HomeUiStateManager";
import { settingsDraftManager } from "./SettingsDraftManager";
import { planningReviewPreferencesManager } from "./PlanningReviewPreferencesManager";
import type { AuthSessionResponse, ProjectFilesResponse, SettingsResponse, WorkerCatalogResponse } from "./types";

export interface UseHomeQueriesParams {
  currentProjectScope: string | null;
  bootstrapId?: string | null;
  loadProjectFiles?: boolean;
  loadWorkerCatalog?: boolean;
  initialQueries?: {
    session?: AuthSessionResponse | null;
    settings?: SettingsResponse | null;
  };
}

export function shouldEnableWorkerCatalogQuery(args: {
  appUnlocked: boolean;
  loadWorkerCatalog: boolean;
}) {
  return args.appUnlocked && args.loadWorkerCatalog;
}

export function useHomeQueries({
  currentProjectScope,
  bootstrapId,
  loadProjectFiles = false,
  loadWorkerCatalog = false,
  initialQueries,
}: UseHomeQueriesParams) {
  const { setApiKeys, setSettingsDiagnostics } = homeUiSetters;
  const queryClient = useQueryClient();
  const primedBootstrapIdRef = useRef<string | null>(null);

  if (
    bootstrapId
    && primedBootstrapIdRef.current !== bootstrapId
  ) {
    if (initialQueries?.session) {
      queryClient.setQueryData(["auth-session"], initialQueries.session);
    }
    if (initialQueries?.settings) {
      queryClient.setQueryData(["settings"], initialQueries.settings);
    }
    primedBootstrapIdRef.current = bootstrapId;
  }

  const sessionQuery = useQuery<AuthSessionResponse>({
    queryKey: ["auth-session"],
    retry: false,
    refetchOnWindowFocus: true,
    initialData: initialQueries?.session ?? undefined,
    staleTime: initialQueries?.session ? 5_000 : 0,
    queryFn: async () => requestJson<AuthSessionResponse>("/api/auth/session", undefined, {
      source: "Auth",
      action: "Load session state",
    }),
  });

  const authEnabled = sessionQuery.data?.enabled ?? false;
  const authConfigurationError = sessionQuery.data?.configurationError ?? null;
  const appUnlocked = sessionQuery.data
    ? (!sessionQuery.data.enabled || sessionQuery.data.authenticated)
    : false;

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    enabled: appUnlocked,
    initialData: initialQueries?.settings ?? undefined,
    staleTime: initialQueries?.settings ? 5_000 : 0,
    queryFn: async () => {
      const data = await requestJson<SettingsResponse>("/api/settings", undefined, {
        source: "Settings",
        action: "Load saved settings",
      });
      settingsDraftManager.hydrate(data.values || {});
      planningReviewPreferencesManager.hydrate(data.values || {});
      setApiKeys((prev) => ({ ...prev, ...settingsDraftManager.getSnapshot().draft }));
      setSettingsDiagnostics(data.diagnostics ?? []);
      return data;
    },
  });

  const workerCatalogQuery = useQuery<WorkerCatalogResponse & { diagnostics?: AppErrorDescriptor[] }>({
    queryKey: ["worker-catalog"],
    staleTime: 5 * 60_000,
    enabled: shouldEnableWorkerCatalogQuery({ appUnlocked, loadWorkerCatalog }),
    refetchOnWindowFocus: false,
    refetchInterval: (query) => query.state.data?.workerModelsRefreshing ? 2_000 : false,
    queryFn: async () => requestJson<WorkerCatalogResponse & { diagnostics?: AppErrorDescriptor[] }>(
      "/api/agents/catalog",
      undefined,
      {
        source: "Agent runtime",
        action: "Load worker availability",
      },
    ),
  });

  const refreshWorkerCatalog = useMutation({
    mutationFn: async () => requestJson<WorkerCatalogResponse & { diagnostics?: AppErrorDescriptor[] }>(
      "/api/agents/catalog?refresh=1",
      undefined,
      {
        source: "Agent runtime",
        action: "Refresh worker availability",
      },
    ),
    onSuccess: (data) => {
      queryClient.setQueryData(["worker-catalog"], data);
    },
  });

  const projectFilesQuery = useQuery<ProjectFilesResponse>({
    queryKey: ["project-files", currentProjectScope],
    queryFn: async () => requestJson<ProjectFilesResponse>(
      `/api/fs/files?root=${encodeURIComponent(currentProjectScope || "")}`,
      undefined,
      {
        source: "Filesystem",
        action: "Load project files",
      },
    ),
    enabled: Boolean(loadProjectFiles && currentProjectScope),
    staleTime: 60_000,
  });

  return {
    sessionQuery,
    settingsQuery,
    workerCatalogQuery,
    refreshWorkerCatalog,
    projectFilesQuery,
    authEnabled,
    authConfigurationError,
    appUnlocked,
  };
}

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:38:11.040Z","phase":null} -->
## Tool result: call_NOT8S1omDxkO8UFBG9l8O3Hk · 2026-06-14T15:38:11.040Z

```text
Chunk ID: 9c2e18
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2536
Output:
"use client";

import type React from "react";
import { useMutation } from "@tanstack/react-query";
import type { PendingChatAttachment } from "@/lib/chat-attachments";
import { mergeAppErrors, requestJson } from "@/lib/app-errors";
import { getManualCommitPrompt, getManualProjectCommitPrompt, type ManualCommitAction } from "@/lib/commit-workflow";
import { applyRunRecoveryOptimisticUpdate, type RecoverableConversationState } from "@/lib/run-recovery-state";
import type { WorkerTerminalProcess } from "@/lib/worker-terminal-processes";
import { busyMessageQueueManager } from "./BusyMessageQueueManager";
import { useQueuedMessageMutations } from "./useQueuedMessageMutations";
import { uploadPendingChatAttachments } from "./upload-attachments";
import { shouldSelectRecoveredRunAfterSuccess } from "./auto-resume-selection";
import { homeUiSetters, homeUiStateManager } from "./HomeUiStateManager";
import { appearancePreferencesManager } from "./AppearancePreferencesManager";
import { settingsDraftManager } from "./SettingsDraftManager";
import { gitWorkspaceManager, type GitWorkspaceLaunchRequest } from "./GitWorkspaceManager";
import type { BusyMessageAction } from "./busy-message-behavior";
import type { PlanningReviewAgentSelection } from "@/server/planning/review-preferences";
import {
  appendCreatedConversationSnapshot,
  appendSentConversationMessageSnapshot,
  buildOptimisticCreatedConversationSnapshot,
  buildConversationPath,
  buildInlineError,
  removeRunFromHomeState,
  resolveSelectedWorkerModel,
  type CreatedConversationSnapshot,
} from "./utils";
import type {
  AgentSnapshot,
  ComposerWorkerOption,
  ConversationModeOption,
  EventStreamState,
  ExecutionEventRecord,
  MessageRecord,
  RunRecord,
  WorkerType,
} from "./types";

function isOptimisticallyStoppableWorkerStatus(status: string | null | undefined) {
  const normalized = (status ?? "").trim().toLowerCase().split(":")[0]?.trim() ?? "";
  return normalized === "starting" || normalized === "working" || normalized === "idle" || normalized === "stuck" || normalized === "recovering";
}

function createOptimisticExecutionEvent(args: {
  runId: string;
  workerId?: string | null;
  eventType: string;
  details: Record<string, unknown>;
}) {
  const now = new Date().toISOString();
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `optimistic-${now}-${Math.random().toString(16).slice(2)}`,
    runId: args.runId,
    workerId: args.workerId ?? null,
    planItemId: null,
    eventType: args.eventType,
    details: JSON.stringify(args.details),
    createdAt: now,
  } satisfies ExecutionEventRecord;
}

function replaceBrowserConversationPath(selectedRunId: string | null, draftProjectPath: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  const nextPath = buildConversationPath(selectedRunId, draftProjectPath);
  const currentPath = `${window.location.pathname}${window.location.search}`;
  if (currentPath !== nextPath) {
    window.history.replaceState(window.history.state, "", nextPath);
  }
}

export function ownsOptimisticRunSelection(args: {
  requestedRunId: string;
  currentSelectedRunId: string | null;
}) {
  return args.currentSelectedRunId === args.requestedRunId;
}

export function ownsSelectionFromMutationStart(args: {
  selectedRunIdAtStart: string | null;
  currentSelectedRunId: string | null;
}) {
  return args.currentSelectedRunId === args.selectedRunIdAtStart;
}

export function shouldSelectProjectMutationResult(args: {
  selectedRunIdAtStart: string | null;
  currentSelectedRunId: string | null;
  resultRunId: string | null | undefined;
}) {
  return Boolean(args.resultRunId) && ownsSelectionFromMutationStart(args);
}

export function shouldSelectSourceRunMutationResult(args: {
  sourceRunId: string;
  selectedRunIdAtStart: string | null;
  currentSelectedRunId: string | null;
  resultRunId: string | null | undefined;
}) {
  return Boolean(args.resultRunId)
    && args.selectedRunIdAtStart === args.sourceRunId
    && args.currentSelectedRunId === args.sourceRunId;
}

export function shouldRestoreSelectionAfterOptimisticRemovalError(args: {
  removedRunId: string;
  selectedRunIdAtStart: string | null;
  currentSelectedRunId: string | null;
}) {
  return args.selectedRunIdAtStart === args.removedRunId
    && args.currentSelectedRunId === null;
}

export function ownsConversationSideEffects(args: {
  runId: string;
  currentSelectedRunId: string | null;
}) {
  return args.currentSelectedRunId === args.runId;
}

export function shouldClearSubmittedComposer(args: {
  submittedContent: string;
  commandAtStart: string;
  currentCommand: string;
  attachmentsAtStart: PendingChatAttachment[];
  currentAttachments: PendingChatAttachment[];
}) {
  return args.commandAtStart === args.submittedContent
    && args.currentCommand === args.submittedContent
    && args.currentAttachments === args.attachmentsAtStart;
}

function timestampMs(value: string | undefined | null) {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function mergeOutputEntries(
  current: AgentSnapshot["outputEntries"],
  loaded: AgentSnapshot["outputEntries"],
) {
  const byId = new Map<string, NonNullable<AgentSnapshot["outputEntries"]>[number]>();
  for (const entry of loaded ?? []) {
    byId.set(entry.id, entry);
  }
  for (const entry of current ?? []) {
    byId.set(entry.id, entry);
  }
  return Array.from(byId.values()).sort((first, second) => {
    const timeDelta = timestampMs(first.timestamp) - timestampMs(second.timestamp);
    return timeDelta !== 0 ? timeDelta : first.id.localeCompare(second.id);
  });
}

export function mergeLoadedWorkerHistoryAgent(
  current: AgentSnapshot | undefined,
  loaded: AgentSnapshot,
): AgentSnapshot {
  if (!current) {
    return loaded;
  }

  const currentIsNewer = timestampMs(current.updatedAt) > timestampMs(loaded.updatedAt);
  const outputEntries = mergeOutputEntries(current.outputEntries, loaded.outputEntries);
  if (!currentIsNewer) {
    return {
      ...loaded,
      outputEntries,
    };
  }

  return {
    ...loaded,
    state: current.state,
    currentText: current.currentText,
    lastText: current.lastText,
    displayText: current.displayText,
    lastError: current.lastError,
    recentStderr: current.recentStderr,
    pendingPermissions: current.pendingPermissions,
    contextUsage: current.contextUsage,
    bridgeLastError: current.bridgeLastError,
    runLastError: current.runLastError,
    stderrBuffer: current.stderrBuffer,
    stopReason: current.stopReason,
    bridgeMissing: current.bridgeMissing,
    updatedAt: current.updatedAt,
    outputEntries,
  };
}

function applyStopWorkerOptimisticUpdate(current: EventStreamState, runId: string, workerId: string) {
  const now = new Date().toISOString();
  const run = current.runs.find((candidate) => candidate.id === runId) ?? null;
  const isImplementationRun = run?.mode === "implementation";
  const stoppedWorkerIds = new Set<string>();

  const workers = (current.workers || []).map((worker) => {
    if (worker.runId !== runId) {
      return worker;
    }
    if (worker.id === workerId || (isImplementationRun && isOptimisticallyStoppableWorkerStatus(worker.status))) {
      stoppedWorkerIds.add(worker.id);
      return { ...worker, status: "cancelled", updatedAt: now };
    }
    return worker;
  });

  const hasActiveWorker = workers.some((worker) =>
    worker.runId === runId && isOptimisticallyStoppableWorkerStatus(worker.status),
  );
  const nextRunStatus = isImplementationRun
    ? "awaiting_user"
    : hasActiveWorker
      ? run?.status
      : "cancelled";

  return {
    ...current,
    runs: (current.runs || []).map((candidate) =>
      candidate.id === runId && nextRunStatus
        ? { ...candidate, status: nextRunStatus, updatedAt: now, failedAt: null, lastError: null }
        : candidate,
    ),
    workers,
    agents: (current.agents || []).map((agent) =>
      stoppedWorkerIds.has(agent.name)
        ? { ...agent, state: "cancelled", currentText: "", updatedAt: now }
        : agent,
    ),
    executionEvents: [
      createOptimisticExecutionEvent({
        runId,
        workerId,
        eventType: isImplementationRun ? "worker_stop_requested" : "worker_cancelled",
        details: {
          summary: isImplementationRun
            ? `Paused work because ${workerId} was stopped by the user.`
            : `Stopped ${workerId}`,
          reason: isImplementationRun ? "User stopped a worker." : "User stopped this worker.",
          userInitiated: true,
          stoppedWorkerId: workerId,
          optimistic: true,
        },
      }),
      ...(current.executionEvents || []),
    ],
  };
}

function applyStopSupervisorOptimisticUpdate(current: EventStreamState, runId: string) {
  const now = new Date().toISOString();
  const stoppedWorkerIds = new Set<string>();
  const workers = (current.workers || []).map((worker) => {
    if (worker.runId !== runId || !isOptimisticallyStoppableWorkerStatus(worker.status)) {
      return worker;
    }
    stoppedWorkerIds.add(worker.id);
    return { ...worker, status: "cancelled", updatedAt: now };
  });

  return {
    ...current,
    runs: (current.runs || []).map((run) =>
      run.id === runId
        ? { ...run, status: "cancelled", updatedAt: now, failedAt: null, lastError: null }
        : run,
    ),
    workers,
    agents: (current.agents || []).map((agent) =>
      stoppedWorkerIds.has(agent.name)
        ? { ...agent, state: "cancelled", currentText: "", updatedAt: now }
        : agent,
    ),
    executionEvents: [
      createOptimisticExecutionEvent({
        runId,
        eventType: "supervisor_stopped",
        details: {
          summary: "Stopped supervisor and cancelled active workers.",
          reason: "User stopped the supervisor.",
          userInitiated: true,
          optimistic: true,
        },
      }),
      ...(current.executionEvents || []),
    ],
  };
}

export interface UseHomeMutationsParams {

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:38:19.983Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:38:19.983Z

I’ve got enough context to draft, but I’m checking file sizes and existing locale coverage so the implementation checklist can call out where refactors or i18n updates are mandatory.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:38:19.989Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:38:19.989Z

```json
{
  "cmd": "wc -l src/app/home/HomeApp.tsx src/app/home/useHomeMutations.ts src/app/home/useHomeQueries.ts src/app/home/LiveEventConnectionManager.ts src/app/home/EventStreamStateManager.ts src/app/home/EventStreamSnapshotCacheManager.ts src/app/home/WorkerEntriesManager.ts src/components/home/HomeHeader.tsx src/components/home/ConversationSidebar.tsx src/components/home/SettingsDialog.tsx src/components/settings/GeneralSettingsPanel.tsx src/runtime/bootstrap.ts src/runtime/http/server.ts src/runtime/http/routes/events.ts src/runtime/http/routes/runtime-bootstrap.ts src/lib/app-errors.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:38:19.989Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:38:19.989Z

```json
{
  "cmd": "ls shared/locales",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:38:19.990Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:38:19.990Z

```json
{
  "cmd": "sed -n '1,220p' src/lib/app-errors.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 22000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:38:20.064Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:38:20.064Z

```json
{
  "cmd": "sed -n '1,260p' src/runtime/http/registry.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 18000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:38:20.165Z","phase":null} -->
## Tool result: call_WXBCtr8vg9u3Ra3w1QvlnBJy · 2026-06-14T15:38:20.165Z

```text
Chunk ID: e10c67
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 184
Output:
    1407 src/app/home/HomeApp.tsx
    1085 src/app/home/useHomeMutations.ts
     144 src/app/home/useHomeQueries.ts
     409 src/app/home/LiveEventConnectionManager.ts
     331 src/app/home/EventStreamStateManager.ts
     215 src/app/home/EventStreamSnapshotCacheManager.ts
     809 src/app/home/WorkerEntriesManager.ts
     582 src/components/home/HomeHeader.tsx
     708 src/components/home/ConversationSidebar.tsx
       1 src/components/home/SettingsDialog.tsx
      13 src/components/settings/GeneralSettingsPanel.tsx
     111 src/runtime/bootstrap.ts
     208 src/runtime/http/server.ts
     949 src/runtime/http/routes/events.ts
      22 src/runtime/http/routes/runtime-bootstrap.ts
     157 src/lib/app-errors.ts
    7151 total

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:38:20.165Z","phase":null} -->
## Tool result: call_YumtAwxMIrgZWuc19s5iY02D · 2026-06-14T15:38:20.165Z

```text
Chunk ID: c70712
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 19
Output:
de.json
en.json
es.json
fr.json
it.json
ja.json
ko.json
pt.json
zh-CN.json

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:38:20.165Z","phase":null} -->
## Tool result: call_CkyvhQfnsKreNa19Ynk3ghGX · 2026-06-14T15:38:20.165Z

```text
Chunk ID: 1ef657
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1066
Output:
export interface AppErrorDescriptor {
  message: string;
  source?: string;
  action?: string;
  suggestion?: string;
  details?: string[];
  status?: number;
}

export class AppRequestError extends Error {
  descriptor: AppErrorDescriptor;

  constructor(descriptor: AppErrorDescriptor) {
    super(descriptor.message);
    this.name = "AppRequestError";
    this.descriptor = descriptor;
  }
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asDetails(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => asString(item)).filter(Boolean)
    : [];
}

export function normalizeAppError(
  value: unknown,
  fallback: Partial<AppErrorDescriptor> = {},
): AppErrorDescriptor {
  if (value instanceof AppRequestError) {
    return value.descriptor;
  }

  if (value instanceof Error) {
    return {
      message: value.message || fallback.message || "Unknown error",
      source: fallback.source,
      action: fallback.action,
      suggestion: fallback.suggestion,
      details: fallback.details,
      status: fallback.status,
    };
  }

  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    if (typeof record.error === "string") {
      return {
        message: record.error,
        source: asString(record.source) || fallback.source,
        action: asString(record.action) || fallback.action,
        suggestion: asString(record.suggestion) || fallback.suggestion,
        details: asDetails(record.details).length > 0 ? asDetails(record.details) : fallback.details,
        status: typeof record.status === "number" ? record.status : fallback.status,
      };
    }

    if (typeof record.error === "object" && record.error !== null) {
      return normalizeAppError(record.error, fallback);
    }

    const message = asString(record.message);
    if (message) {
      const details = asDetails(record.details);
      return {
        message,
        source: asString(record.source) || fallback.source,
        action: asString(record.action) || fallback.action,
        suggestion: asString(record.suggestion) || fallback.suggestion,
        details: details.length > 0 ? details : fallback.details,
        status: typeof record.status === "number" ? record.status : fallback.status,
      };
    }
  }

  if (typeof value === "string" && value.trim()) {
    return {
      message: value.trim(),
      source: fallback.source,
      action: fallback.action,
      suggestion: fallback.suggestion,
      details: fallback.details,
      status: fallback.status,
    };
  }

  return {
    message: fallback.message || "Unknown error",
    source: fallback.source,
    action: fallback.action,
    suggestion: fallback.suggestion,
    details: fallback.details,
    status: fallback.status,
  };
}

export async function parseErrorResponse(
  response: Response,
  fallback: Partial<AppErrorDescriptor> = {},
) {
  let payload: unknown = null;

  try {
    payload = await response.json();
  } catch {
    try {
      payload = await response.text();
    } catch {
      payload = null;
    }
  }

  return normalizeAppError(payload, {
    message: fallback.message || `Request failed with status ${response.status}`,
    source: fallback.source,
    action: fallback.action,
    suggestion: fallback.suggestion,
    details: fallback.details,
    status: response.status,
  });
}

export async function requestJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  fallback: Partial<AppErrorDescriptor> = {},
): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new AppRequestError(await parseErrorResponse(response, fallback));
  }
  return response.json() as Promise<T>;
}

export function appErrorKey(error: AppErrorDescriptor) {
  return [
    error.source || "",
    error.action || "",
    error.message,
    error.suggestion || "",
    ...(error.details ?? []),
  ].join("|");
}

export function mergeAppErrors(current: AppErrorDescriptor[], incoming: AppErrorDescriptor[]) {
  const byKey = new Map<string, AppErrorDescriptor>();

  for (const error of [...current, ...incoming]) {
    byKey.set(appErrorKey(error), error);
  }

  return [...byKey.values()];
}

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:38:20.165Z","phase":null} -->
## Tool result: call_RcN3fOtXBZyL4s23b2H7J2Z9 · 2026-06-14T15:38:20.165Z

```text
Chunk ID: 36fe02
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 894
Output:
import type { RuntimeSurface } from "@/server/events/named-events";

export type RuntimeErrorPayload = {
  code: string;
  message: string;
  details?: unknown;
  surface?: RuntimeSurface | string;
  runId?: string;
  workerId?: string;
  conversationId?: string;
};

export interface OmniRequestContext {
  surface: RuntimeSurface | string;
  runtime?: unknown;
  params?: Record<string, string>;
}

export type OmniHttpHandler = (
  request: Request,
  context: OmniRequestContext,
) => Promise<Response> | Response;

type Method = string;

function normalizeMethod(method: string): Method {
  return method.trim().toUpperCase();
}

function routeKey(method: string, pathname: string) {
  return `${normalizeMethod(method)} ${pathname}`;
}

function jsonError(status: number, error: RuntimeErrorPayload) {
  return Response.json({ error }, { status });
}

export class OmniHttpRegistry {
  private readonly routes = new Map<string, OmniHttpHandler>();
  private readonly dynamicRoutes: Array<{
    method: Method;
    pathname: string;
    parts: string[];
    handler: OmniHttpHandler;
  }> = [];

  route(method: string, pathname: string, handler: OmniHttpHandler) {
    const normalizedMethod = normalizeMethod(method);
    if (pathname.split("/").some((part) => part.startsWith(":"))) {
      this.dynamicRoutes.push({
        method: normalizedMethod,
        pathname,
        parts: pathname.split("/").filter(Boolean),
        handler,
      });
      return this;
    }

    this.routes.set(routeKey(normalizedMethod, pathname), handler);
    return this;
  }

  private matchDynamicRoute(method: Method, pathname: string) {
    const actualParts = pathname.split("/").filter(Boolean);
    for (const route of this.dynamicRoutes) {
      if (route.method !== method || route.parts.length !== actualParts.length) {
        continue;
      }
      const params: Record<string, string> = {};
      let matched = true;
      for (let index = 0; index < route.parts.length; index += 1) {
        const expected = route.parts[index] ?? "";
        const actual = actualParts[index] ?? "";
        if (expected.startsWith(":")) {
          params[expected.slice(1)] = decodeURIComponent(actual);
          continue;
        }
        if (expected !== actual) {
          matched = false;
          break;
        }
      }
      if (matched) {
        return { handler: route.handler, params };
      }
    }
    return null;
  }

  async handle(request: Request, context: OmniRequestContext): Promise<Response> {
    const url = new URL(request.url);
    const method = normalizeMethod(request.method);
    const key = routeKey(method, url.pathname);
    const exactHandler = this.routes.get(key);
    const dynamicMatch = exactHandler ? null : this.matchDynamicRoute(method, url.pathname);
    const handler = exactHandler ?? dynamicMatch?.handler;
    if (!handler) {
      return jsonError(404, {
        code: "route.not_found",
        message: `No runtime route registered for ${method} ${url.pathname}.`,
        surface: context.surface,
      });
    }

    try {
      return await handler(request, dynamicMatch ? {
        ...context,
        params: {
          ...context.params,
          ...dynamicMatch.params,
        },
      } : context);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return jsonError(500, {
        code: "route.failed",
        message,
        surface: context.surface,
      });
    }
  }
}

export function createOmniHttpRegistry() {
  return new OmniHttpRegistry();
}

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:38:28.146Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:38:28.146Z

```json
{
  "cmd": "sed -n '1,260p' /Users/masterman/.agents/skills/pm-pass.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 26000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:38:28.170Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:38:28.170Z

```json
{
  "cmd": "sed -n '1,260p' /Users/masterman/.agents/skills/story-derived-completeness.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 26000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:38:28.251Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:38:28.251Z

```json
{
  "cmd": "sed -n '1,220p' /Users/masterman/.agents/skills/v1-product-completeness.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 22000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:38:28.292Z","phase":null} -->
## Tool result: call_7CAz9q1HQgpSYywcyLqydkZo · 2026-06-14T15:38:28.292Z

```text
Chunk ID: bc96aa
Wall time: 0.0000 seconds
Process exited with code 1
Original token count: 19
Output:
sed: /Users/masterman/.agents/skills/pm-pass.md: No such file or directory

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:38:28.292Z","phase":null} -->
## Tool result: call_uDfYQhijh6sAP8s4k2AVlrrD · 2026-06-14T15:38:28.292Z

```text
Chunk ID: e69742
Wall time: 0.0000 seconds
Process exited with code 1
Original token count: 24
Output:
sed: /Users/masterman/.agents/skills/story-derived-completeness.md: No such file or directory

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:38:28.305Z","phase":null} -->
## Tool result: call_bkrNjDm4SUSfxelf9z4SDnj3 · 2026-06-14T15:38:28.305Z

```text
Chunk ID: 475160
Wall time: 0.0000 seconds
Process exited with code 1
Original token count: 23
Output:
sed: /Users/masterman/.agents/skills/v1-product-completeness.md: No such file or directory

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:38:37.698Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:38:37.698Z

One referenced brainstorming helper path was relative to the skill directory, not the skills root; I’m correcting that and then I’ll draft the plan document.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:38:37.704Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:38:37.704Z

```json
{
  "cmd": "sed -n '1,260p' /Users/masterman/.agents/skills/brainstorming/pm-pass.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 26000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:38:37.704Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:38:37.704Z

```json
{
  "cmd": "sed -n '1,280p' /Users/masterman/.agents/skills/brainstorming/story-derived-completeness.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 28000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:38:37.763Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:38:37.763Z

```json
{
  "cmd": "sed -n '1,240p' /Users/masterman/.agents/skills/brainstorming/v1-product-completeness.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 24000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:38:37.786Z","phase":null} -->
## Tool result: call_85D5uwtGkk0oWN40d9a69RNY · 2026-06-14T15:38:37.786Z

```text
Chunk ID: ee4d41
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1323
Output:
# PM Pass

Use this reference before the completeness pass for app, UI, and product-surface work. The goal is to think like a strong product manager: understand what the product wants to become, discover the supporting jobs around the core job, and preserve that larger vision even when delivery is staged.

In Ultrapowers, this is a required default move for app, UI, and product-surface planning. If that kind of work is happening, the PM pass should be visible in the design output rather than silently skipped.

## Core Assumptions

- The first user is usually the human builder unless the prompt says otherwise.
- The core job is usually already implied by the request.
- The missing work is often in the supporting jobs, state model, trust model, and operational reality.
- Agents also tend to under-specify persistence. Counteract that tendency by making storage and lifecycle decisions explicit for settings and user-managed state.
- Agents also tend to over-explain settings UI. Counteract that tendency by treating settings dialogs as control surfaces, not narrative pages.
- Agents tend to underbuild unless forced to think beyond the literal prompt. Counteract that tendency here.

## PM Pass Outputs

Produce or infer these sections when relevant:

- First User
- Core Job
- Supporting Jobs
- User Segmentation And Role Clarity
- State Model
- Persistence Model
- Operational Readiness
- Instrumentation And Observability
- Onboarding And Discoverability
- Risk And Trust Surfaces
- North Star Product
- Current Milestone
- Future Product Direction

## What Each Section Means

### First User

Who is the first person this is really being built for right now?

Default: the human builder.

### Core Job

What is the one main job the first user wants to accomplish?

Do not waste time rediscovering what is already obvious from the prompt.

### Supporting Jobs

What other jobs must the product support so the core job is actually workable in practice?

These often include:

- returning to prior work,
- recovering from failure,
- understanding current status,
- revising earlier state,
- monitoring progress,
- discovering what to do next.

### User Segmentation And Role Clarity

Only go deep here when the product actually has multiple roles. Do not invent fake role complexity for single-user tools.

### State Model

Define the meaningful product states, not just visual states.

Examples:

- draft,
- queued,
- running,
- waiting-for-user,
- failed,
- completed,
- archived,
- forked.

### Persistence Model

Define where meaningful settings, preferences, drafts, and user-managed state live and how they behave over time.

Ask explicitly:

- does this setting persist at all,
- is it device-local, browser-local, file-based, workspace-local, or account-level,
- what is the source of truth,
- how is it serialized and versioned,
- when is it loaded and saved,
- how are conflicts, resets, migrations, and deletions handled,
- what should survive refresh, restart, sign-out, reinstall, or device change.

### Operational Readiness

Ask what must work when the real world is messy:

- transient failures,
- missing config,
- degraded providers,
- long-running work,
- partial completion,
- retries and re-entry.

### Instrumentation And Observability

Ask what signals should exist so both the user and the builder can understand what is happening.

This includes:

- user-visible status,
- key logs or events,
- enough observability to debug failures and stuck states.
- durable event history for backend actions and state transitions.
- a scriptable control plane, preferably CLI-accessible, for inspection, replay, admin operations, and end-to-end testing without the UI.
- explicit propagation of real errors to user-facing and operator-facing surfaces instead of generic fallback messages.

For systems with conversations, jobs, tools, or agents, prefer event models that preserve:

- inputs and outputs,
- tool calls and tool results,
- errors and retries,
- stack traces and failure context,
- state transitions,
- timestamps and identifiers needed to reconstruct what happened later.

### Onboarding And Discoverability

Ask what a first-time or returning user sees:

- first-run guidance,
- empty states,
- obvious next action,
- terminology and labels that make sense.

### Risk And Trust Surfaces

Ask where user trust could break:

- silent failure,
- generic error abstraction that hides the real cause,
- ambiguous state,
- lost work,
- destructive actions,
- misleading completion signals.

### North Star Product

Describe what the finished product wants to become if fully realized. Be ambitious. Do not collapse this into the current milestone.

### Current Milestone

Describe the current coherent slice to build now.

This is a sequencing choice, not a reduction in imagination.

### Future Product Direction

Describe what may belong beyond the current implementation plan, so the system keeps a larger product sense without smuggling unfinished required behavior out of the final checklist.

## Important Distinction

- Be expansive in product imagination.
- Be deliberate in milestone commitment.

YAGNI applies to implementation detail inside the approved milestone. It does not mean shrinking product thinking before the design is even understood.

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:38:37.786Z","phase":null} -->
## Tool result: call_hmYF5rM0xN5AcWym8HfYXk2U · 2026-06-14T15:38:37.786Z

```text
Chunk ID: dcb945
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1332
Output:
# Story-Derived Completeness

Use this reference to expand a sparse product request into a usable v1 by reasoning from user stories and user journeys. This is the primary mechanism for completeness. Archetype references are only a secondary backstop.

The PM pass should happen first. Use its outputs, especially supporting jobs, state model, operational readiness, observability, onboarding, and trust surfaces, as inputs to the story-derived pass.

## Core Idea

Do not ask only, "What controls did the user mention?" Ask, "What does the user need to do, recover from, revisit, understand, or change?" The interface and system behaviors should be inferred from those stories.

## Story Categories To Derive

For app, UI, and product-surface work, derive stories in these categories when relevant:

- primary journey stories,
- first-run and empty-state stories,
- return/revisit stories,
- failure and recovery stories,
- status-awareness stories,
- mutation stories,
- mobile-use stories.

## What Each Category Means

### Primary Journey Stories

What is the main task the user is here to complete?

Examples:

- "As a user, I want to start a conversation with an agent so I can get work done."
- "As a user, I want to create a task and move it through a board."

These stories usually imply the core surface, main action affordances, and the path from entry to completion.

### First-Run And Empty-State Stories

What happens when nothing exists yet?

Examples:

- "As a first-time user, I want to understand how to begin."
- "As a user with no conversations yet, I want an obvious way to start one."

These stories imply onboarding affordances, empty states, and entry-point actions.

### Return/Revisit Stories

How does a user come back later and continue?

Examples:

- "As a user, I want to find a previous conversation and continue it."
- "As a user, I want to reopen a document I edited yesterday."

These stories imply lists, recents, navigation hierarchy, and persistence visibility.

### Failure And Recovery Stories

What happens when the happy path fails?

Examples:

- "As a user, I want to know when a request failed and what I can do next."
- "As a user, I want to retry after a transient failure without losing my work."

These stories imply error notices, retry flows, recovery actions, and backend/frontend coordination.

### Status-Awareness Stories

What does the user need to understand about current state?

Examples:

- "As a user, I want to know whether the agent is still running, waiting for me, or finished."
- "As a user, I want to know whether my changes were saved."

These stories imply spinners, badges, state labels, progress indicators, and completion signals.

Persistence questions often cut across these categories. When a story depends on preferences, drafts, history, or configuration, ask what must persist, where it should live, and what the user expects to survive across sessions and devices.

### Mutation Stories

How does a user revise, retry, fork, resend, undo, or continue from earlier state?

Examples:

- "As a user, I want to edit an earlier prompt and resend from there."
- "As a user, I want to fork a conversation from a prior turn."
- "As a user, I want to retry a failed generation."

These stories imply edit/resend flows, truncation behavior, forking, retry actions, and explicit state transitions.

### Mobile-Use Stories

How does the same job get done on a smaller screen?

Examples:

- "As a mobile user, I still need to navigate conversations and act on the current thread."

These stories imply drawers, sheets, responsive prioritization, and compact affordances.

## How To Infer Interface And System Behavior

For each derived story, ask:

1. What interface affordance does this require?
2. What system behavior does this require?
3. What visible state does the user need?
4. What happens when this fails?
5. What has to be preserved when the user comes back later?
6. Which settings or preferences does this touch, and should each persist?
7. Where should that persisted state live, and who owns it?
8. What happens on reset, migration, logout, or device change?

Also ask:

9. What product state does this touch?
10. What observability or status signal should exist?
11. What would make this feel untrustworthy if it went wrong?

## What Counts As Obvious Vs Debatable

### Obvious Story-Derived Additions

Include by default when they are clearly implied by the stories:

- lists or history for return/revisit stories,
- status indicators for status-awareness stories,
- error notices and retry paths for failure/recovery stories,
- empty states for first-run stories,
- edit/retry/resend actions when mutation stories are core to the product's job.

### Debatable Additions

Confirm with the user before locking them in:

- expensive or complex additions,
- opinionated product bets,
- large scope expansions,
- advanced collaboration, analytics, or automation features,
- behaviors that are plausible but not clearly implied by the approved stories.

## Role Of Archetype References

Use `v1-product-completeness.md` after the story-derived pass:

- as a sanity check,
- as a prior for familiar product types,
- as a way to catch obvious omissions.

Do not use archetype references as a replacement for deriving stories from the actual user request.

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:38:37.815Z","phase":null} -->
## Tool result: call_BfwwAY8EH9D0JkIJY5MBxodU · 2026-06-14T15:38:37.815Z

```text
Chunk ID: 8c236d
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 925
Output:
# V1 Product Completeness Reference

Use this reference during brainstorming when the request involves a familiar app or product surface. The goal is not to invent extra features. The goal is to avoid shipping a literal shell that lacks the expected surfaces and states needed for a usable v1.

This file is a sanity check and prior, not the primary source of truth. Derive completeness from user stories and journeys first. Use this reference afterward to catch obvious omissions for familiar archetypes.

## How To Use This Reference

1. Derive user stories and journeys from the request first.
2. Identify the closest product archetype.
3. Expand the design into:
   - explicitly requested capabilities,
   - baseline expected v1 surfaces and states.
4. Keep obvious, conventional additions as baseline expected v1 scope.
5. Confirm non-obvious, expensive, risky, or strongly opinionated additions with the user before locking them in.

## Questions To Ask For Any Archetype

- What is the primary user journey?
- What does first-run or empty state look like?
- What does loading, waiting, or in-progress state look like?
- What does success or completed state look like?
- What does failure or recovery look like?
- How does a user find prior work again later?
- What navigation and hierarchy are expected?
- What is different on desktop versus mobile?

## AI Chat / Agent Harness

### Baseline Expected V1

- conversation list or history,
- clear hierarchy when projects or workspaces exist,
- new conversation action,
- active conversation view,
- visible in-progress, waiting, completed, and failed status,
- input area with obvious send/submit affordance,
- empty state when no conversation exists,
- path to resume or revisit prior conversations,
- mobile-safe navigation pattern such as a drawer or sheet.

### Confirm With User Before Locking In

- advanced filtering or search,
- rich multi-pane monitoring surfaces,
- forked conversations,
- advanced model/provider configuration,
- collaborative or multi-user features.

## Kanban / Workflow Board

### Baseline Expected V1

- board navigation,
- column/group structure,
- visible card status,
- clear move/add/edit actions,
- empty state for new boards or columns,
- loading/error handling,
- mobile-safe presentation when horizontal space is limited.

### Confirm With User Before Locking In

- swimlanes,
- automation rules,
- complex permissions,
- timeline or reporting views.

## Document Editor

### Baseline Expected V1

- document list or recents,
- active editing surface,
- save state or persistence signal,
- empty state,
- loading and conflict/error messaging,
- navigation between documents,
- mobile editing fallback that still works.

### Confirm With User Before Locking In

- real-time collaboration,
- comments and suggestions,
- version history,
- advanced formatting systems.

## Admin CRUD Surface

### Baseline Expected V1

- list view,
- detail or edit view,
- create action,
- delete/archive handling,
- empty/loading/error states,
- basic status messaging,
- mobile-safe access to actions and details.

### Confirm With User Before Locking In

- bulk operations,
- role-based permissions,
- audit history,
- advanced filters and exports.

## Dashboard / Monitoring Surface

### Baseline Expected V1

- overview surface,
- clearly labeled primary metrics or status cards,
- refresh/loading behavior,
- empty or no-data states,
- visible alerts/errors,
- path from summary to underlying item or detail,
- mobile layout that preserves priority order.

### Confirm With User Before Locking In

- custom report builders,
- advanced drill-down analytics,
- notification systems,
- saved views or personalization.

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:38:47.123Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:38:47.123Z

I’m about to create a saved implementation plan under `docs/superpowers/plans/`. It will assume no branches and no worktrees, and it will treat every frontend string and new setting as i18n-backed and manager-owned.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:38:47.125Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:38:47.125Z

```json
{
  "cmd": "command -v baton || true",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:38:47.125Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:38:47.125Z

```json
{
  "cmd": "sed -n '1,260p' src/app/home/WorkerEntriesManager.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 28000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:38:47.125Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:38:47.125Z

```json
{
  "cmd": "sed -n '1,220p' src/runtime/http/routes/events.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 26000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:38:47.173Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:38:47.173Z

```json
{
  "cmd": "sed -n '1,220p' src/app/page.tsx",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:38:47.197Z","phase":null} -->
## Tool result: call_PWmS12OkX0kskyAhZf57k0HI · 2026-06-14T15:38:47.197Z

```text
Chunk ID: 095300
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 0
Output:

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:38:47.197Z","phase":null} -->
## Tool result: call_ru3WKH4f44Uq5qgpxtLMPzs4 · 2026-06-14T15:38:47.197Z

```text
Chunk ID: 374c54
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2471
Output:
/**
 * Single source of truth for the unified worker conversation stream on
 * the frontend.
 *
 * Per (workerId) we hold a contiguous *window* [lowestSeq..latestContiguousSeq]:
 *   - entries: the contiguous window in seq order, never with gaps.
 *   - lowestSeq: the lowest seq currently in `entries` (0 if empty).
 *   - latestContiguousSeq: the highest seq we have proven contiguous
 *     from lowestSeq. Used as the cursor for forward refetch.
 *   - latestKnownSeq: the highest seq the server has told us exists.
 *     Updates immediately on a wake-up frame; the fetch fills the gap.
 *   - hasOlder: true if older entries exist on the server before
 *     lowestSeq. Set by initial tail-load and `loadOlder`.
 *   - status: "idle" → "loading" → "loaded"; "error" on a fetch failure.
 *
 * Initial load fetches the last N entries via `?limit=N`. Forward
 * extension uses `?afterSeq=latestContiguousSeq`. Backward hydration
 * uses `?beforeSeq=lowestSeq&limit=N` via `loadOlder`.
 *
 * SSE frames carry only `{ workerId, seq }` — the content is fetched
 * via the HTTP endpoint. The frame is a wake-up hint; we never trust
 * it as the entry payload.
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import type { WorkerEntry } from "@/server/workers/entries-types";
import { requestJson as defaultRequestJson } from "@/lib/app-errors";

/**
 * Collapse multiple rows that share an entry `id` into a single
 * conversation item. The server's unified stream intentionally appends
 * a new row whenever an entry's text grows (so a streaming assistant
 * message can be revised in place — see the
 * `appends changed bridge message revisions so streaming prose can expand`
 * test in `tests/server/workers/output-store.test.ts`). It also
 * back-fills the same user_input id onto a newer worker's stream
 * when a run cycles through workers; the backfill timestamp is "when
 * the backfill ran", not "when the user actually sent the message".
 *
 * Coalesce policy:
 *   - Keep the entry at its FIRST appearance in the input order, so
 *     conversational position doesn't jump when text grows.
 *   - Use the LATEST revision's text / metadata (text grows; latest
 *     revision is the finished one).
 *   - Keep the EARLIEST timestamp — for streaming assistant entries
 *     all revisions share a timestamp anyway, but for back-filled
 *     user_input the earliest occurrence is the original send time
 *     and any later occurrence is a re-appended backfill we want to
 *     ignore for ordering purposes.
 *   - Entries without an id pass through unchanged.
 */
export function coalesceWorkerEntriesById(entries: ReadonlyArray<WorkerEntry>): WorkerEntry[] {
  const positionByKey = new Map<string, number>();
  const earliestTimestampByKey = new Map<string, string>();
  const result: WorkerEntry[] = [];
  for (const entry of entries) {
    const key = typeof entry.id === "string" && entry.id ? entry.id : null;
    if (!key) {
      result.push(entry);
      continue;
    }
    const existingPosition = positionByKey.get(key);
    if (existingPosition === undefined) {
      positionByKey.set(key, result.length);
      if (entry.timestamp) {
        earliestTimestampByKey.set(key, entry.timestamp);
      }
      result.push(entry);
    } else {
      const earliest = earliestTimestampByKey.get(key);
      const candidate = entry.timestamp;
      let preservedTimestamp = entry.timestamp;
      if (earliest && candidate) {
        // Smaller ISO string compares as smaller datetime for the same
        // timezone offset — all our timestamps are emitted with a `Z`
        // suffix, so string compare matches Date compare.
        preservedTimestamp = candidate < earliest ? candidate : earliest;
        if (preservedTimestamp !== earliest) {
          earliestTimestampByKey.set(key, preservedTimestamp);
        }
      } else if (earliest) {
        preservedTimestamp = earliest;
      } else if (candidate) {
        earliestTimestampByKey.set(key, candidate);
      }
      result[existingPosition] = { ...entry, timestamp: preservedTimestamp };
    }
  }
  return result;
}

type JsonRequester = typeof defaultRequestJson;
type WorkerEntryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const DEFAULT_STORAGE_KEY = "omni-worker-entries-cache:v1";
const DEFAULT_MAX_WORKERS = 16;
const DEFAULT_MAX_SERIALIZED_BYTES = 4_000_000;
const DEFAULT_TAIL_LIMIT = 100;
const DEFAULT_OLDER_LIMIT = 100;

interface CachedWorkerStream {
  updatedAt: number;
  entries: WorkerEntry[];
}

interface WorkerEntriesCacheEnvelope {
  version: 1;
  workers: Record<string, CachedWorkerStream>;
}

export type WorkerStreamStatus = "idle" | "loading" | "loaded" | "error";

export interface WorkerStreamState {
  workerId: string;
  entries: WorkerEntry[];
  lowestSeq: number;
  latestContiguousSeq: number;
  latestKnownSeq: number;
  hasOlder: boolean;
  status: WorkerStreamStatus;
  lastError: string | null;
  needsTailValidation?: boolean;
}

type Listener = (state: WorkerStreamState) => void;

interface FetchResponse {
  entries: WorkerEntry[];
  latestSeq: number;
  hasOlder?: boolean;
}

export interface WorkerEntriesManagerOptions {
  requestJson?: JsonRequester;
  fetchEndpoint?: (workerId: string, afterSeq: number) => string;
  fetchTailEndpoint?: (workerId: string, limit: number) => string;
  fetchBeforeEndpoint?: (workerId: string, beforeSeq: number, limit: number) => string;
  storage?: WorkerEntryStorage | null;
  storageKey?: string;
  maxWorkers?: number;
  maxSerializedBytes?: number;
  now?: () => number;
}

function defaultFetchEndpoint(workerId: string, afterSeq: number) {
  return `/api/workers/${encodeURIComponent(workerId)}/entries?afterSeq=${afterSeq}`;
}

function defaultFetchTailEndpoint(workerId: string, limit: number) {
  return `/api/workers/${encodeURIComponent(workerId)}/entries?limit=${limit}`;
}

function defaultFetchBeforeEndpoint(workerId: string, beforeSeq: number, limit: number) {
  return `/api/workers/${encodeURIComponent(workerId)}/entries?beforeSeq=${beforeSeq}&limit=${limit}`;
}

function latestSeq(entries: WorkerEntry[]) {
  return entries.reduce((latest, entry) => (
    typeof entry.seq === "number" && Number.isFinite(entry.seq)
      ? Math.max(latest, entry.seq)
      : latest
  ), 0);
}

function initialState(
  workerId: string,
  entries: WorkerEntry[] = [],
  options: { needsTailValidation?: boolean } = {},
): WorkerStreamState {
  const latest = latestSeq(entries);
  const lowest = entries.length > 0
    ? entries.reduce((acc, entry) => (
      typeof entry.seq === "number" && entry.seq > 0 && (acc === 0 || entry.seq < acc) ? entry.seq : acc
    ), 0)
    : 0;
  return {
    workerId,
    entries,
    lowestSeq: lowest,
    latestContiguousSeq: latest,
    latestKnownSeq: latest,
    hasOlder: lowest > 1,
    status: entries.length > 0 ? "loaded" : "idle",
    lastError: null,
    needsTailValidation: options.needsTailValidation,
  };
}

function defaultStorage(): WorkerEntryStorage | null {
  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
    return null;
  }
  return window.localStorage;
}

function emptyEnvelope(): WorkerEntriesCacheEnvelope {
  return {
    version: 1,
    workers: {},
  };
}

function isWorkerEntryArray(value: unknown): value is WorkerEntry[] {
  return Array.isArray(value) && value.every((entry) => (
    typeof entry === "object"
    && entry !== null
    && typeof (entry as Partial<WorkerEntry>).id === "string"
    && typeof (entry as Partial<WorkerEntry>).seq === "number"
  ));
}

function compactEntryForCache(entry: WorkerEntry): WorkerEntry {
  return {
    ...entry,
    raw: undefined,
  };
}

export const EMPTY_WORKER_STREAM_STATE: WorkerStreamState = initialState("__none__");

export class WorkerEntriesManager {
  private readonly stateByWorker = new Map<string, WorkerStreamState>();
  private readonly listenersByWorker = new Map<string, Set<Listener>>();
  private readonly inFlightByWorker = new Map<string, Promise<void>>();
  private readonly wakeVersionByWorker = new Map<string, number>();
  private readonly requestJson: JsonRequester;
  private readonly fetchEndpoint: (workerId: string, afterSeq: number) => string;
  private readonly fetchTailEndpoint: (workerId: string, limit: number) => string;
  private readonly fetchBeforeEndpoint: (workerId: string, beforeSeq: number, limit: number) => string;
  private readonly storage: WorkerEntryStorage | null;
  private readonly storageKey: string;
  private readonly maxWorkers: number;
  private readonly maxSerializedBytes: number;
  private readonly now: () => number;

  constructor(options: WorkerEntriesManagerOptions = {}) {
    this.requestJson = options.requestJson ?? defaultRequestJson;
    this.fetchEndpoint = options.fetchEndpoint ?? defaultFetchEndpoint;
    this.fetchTailEndpoint = options.fetchTailEndpoint ?? defaultFetchTailEndpoint;
    this.fetchBeforeEndpoint = options.fetchBeforeEndpoint ?? defaultFetchBeforeEndpoint;
    this.storage = options.storage === undefined ? defaultStorage() : options.storage;
    this.storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
    this.maxWorkers = options.maxWorkers ?? DEFAULT_MAX_WORKERS;
    this.maxSerializedBytes = options.maxSerializedBytes ?? DEFAULT_MAX_SERIALIZED_BYTES;
    this.now = options.now ?? Date.now;
  }

  getState(workerId: string, initialEntries: WorkerEntry[] = []): WorkerStreamState {
    const existing = this.stateByWorker.get(workerId);
    if (existing) {
      if (
        initialEntries.length > 0
        && existing.latestContiguousSeq === 0
        && existing.entries.length === 0
      ) {
        const hydrated = initialState(workerId, initialEntries);
        this.stateByWorker.set(workerId, hydrated);
        return hydrated;
      }
      return existing;
    }

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:38:47.198Z","phase":null} -->
## Tool result: call_5TlAKrV8LqmMjnDbksYKxILW · 2026-06-14T15:38:47.198Z

```text
Chunk ID: 0f8164
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2225
Output:
import { db } from "@/server/db";
import { messages, plans, runs, accounts, workers, planItems, clarifications, queuedConversationMessages, recoveryIncidents, planningReviewRuns, planningReviewRounds, processSessions, conversationReadMarkers } from "@/server/db/schema";
import { listExecutionEventsForSnapshot } from "@/server/events/execution-event-store";
import { listSupervisorInterventionsForSnapshot } from "@/server/supervisor/intervention-store";
import { listPlanningReviewFindingsForSnapshot } from "@/server/planning/review-artifact-store";
import { BRIDGE_URL } from "@/server/bridge-client";
import { isTerminalRunStatus } from "@/lib/run-status";
import { buildAppError, type AppErrorPayload } from "@/server/api-errors";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { requireApiSession } from "@/server/auth/guards";
import { buildLiveWorkerSnapshots } from "@/server/workers/live-snapshots";
import { readWorkerLatestSeq } from "@/server/workers/output-store";
import { getEventStreamNotificationVersion, waitForEventStreamNotification } from "@/server/events/live-updates";
import {
  getEventCursor,
  getNamedEventsSince,
  recordSnapshotMarker,
} from "@/server/events/named-events";
import { withEventPayloadChecksum } from "@/server/events/payload-checksum";
import { isTransientSupervisorError } from "@/server/supervisor/retry";
import { serializeMessageRecord } from "@/server/conversations/message-records";
import { serializeQueuedConversationMessage } from "@/server/conversations/queued-message-records";
import { buildAwaitingUserQuestionInvariantErrors } from "@/server/events/lifecycle-invariants";
import { serializeSessionRecord } from "@/server/session-providers/session-records";
import { reconcileOrphanedProcessSessions } from "@/server/session-providers/process-store";
import { reconcilePersistedReloadZombies } from "@/server/runs/persisted-zombie-reconciler";
import type { OmniHttpHandler } from "@/runtime/http/registry";
import { startSlowProbe } from "@/server/slow-probe";
import { toNextRequest } from "./next-request";

const STREAM_REFRESH_INTERVAL_MS = 15_000;
const RUNTIME_AGENT_GRACE_MS = 150;
const RUNTIME_AGENT_TIMEOUT_MS = 5000;
const EXECUTION_EVENT_LIMIT = 100;
const SUPERVISOR_INTERVENTION_LIMIT = 50;
const PLANNING_REVIEW_FINDING_LIMIT = 50;
const EVENT_PAYLOAD_CACHE_LIMIT = 50;

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      fetch(url, { signal: controller.signal }),
      new Promise<Response>((_, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error(`Agent runtime list request timed out after ${timeoutMs}ms.`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

async function readPersistedEventRecords(options: EventPayloadOptions = {}, probe?: { mark: (label: string) => void }) {
  await reconcileOrphanedProcessSessions();
  probe?.mark("reconcile");
  await reconcilePersistedReloadZombies({
    selectedRunId: options.selectedRunId,
    source: "events-snapshot",
  });
  probe?.mark("reconcile.zombies");
  const requestedSelectedRunId = options.selectedRunId?.trim() || null;
  const allPlans = await db.select().from(plans).orderBy(desc(plans.createdAt), desc(plans.id));
  probe?.mark("q.plans");
  const allRuns = await db.select().from(runs).where(isNull(runs.archivedAt)).orderBy(desc(runs.createdAt), desc(runs.id));
  probe?.mark("q.runs");
  const visibleRunIds = allRuns.map((run) => run.id);
  const selectedRun = requestedSelectedRunId ? allRuns.find((run) => run.id === requestedSelectedRunId) ?? null : null;
  const selectedRunId = selectedRun?.id ?? null;
  const selectedPlanId = selectedRun?.planId ?? null;
  const transcriptRunIds = selectedRunId
    ? [
        ...(selectedRun?.mode === "implementation" && selectedRun.parentRunId ? [selectedRun.parentRunId] : []),
        selectedRunId,
      ]
    : [];

  const [
    msgs,
    allAccounts,
    allWorkers,
    selectedAgentWorkers,
    allPlanItems,
    allClarifications,
    allExecutionEvents,
    allSupervisorInterventions,
    allQueuedMessages,
    allRecoveryIncidents,
    allReviewRuns,
    allReviewRounds,
    allReviewFindings,
    allProcessSessions,
    allReadMarkers,
  ] = await Promise.all([
    selectedRunId
      ? db.select().from(messages).where(inArray(messages.runId, transcriptRunIds)).orderBy(asc(messages.createdAt), asc(messages.id))
      : [],
    db.select().from(accounts),
    db.select({
      id: workers.id,
      runId: workers.runId,
      type: workers.type,
      status: workers.status,
      workerNumber: workers.workerNumber,
      title: workers.title,
      initialPrompt: workers.initialPrompt,
      createdAt: workers.createdAt,
      updatedAt: workers.updatedAt,
    }).from(workers).where(visibleRunIds.length > 0 ? inArray(workers.runId, visibleRunIds) : eq(workers.id, "__none__")).orderBy(asc(workers.runId), asc(workers.createdAt), asc(workers.id)),
    selectedRunId
      ? db.select({
        id: workers.id,
        runId: workers.runId,
        type: workers.type,
        status: workers.status,
        cwd: workers.cwd,
        outputLog: workers.outputLog,
        currentText: workers.currentText,
        lastText: workers.lastText,
        bridgeSessionId: workers.bridgeSessionId,
        bridgeSessionMode: workers.bridgeSessionMode,
        workerNumber: workers.workerNumber,
        title: workers.title,
        initialPrompt: workers.initialPrompt,
        activeWorkStartedAt: workers.activeWorkStartedAt,
        activeWorkDurationMs: workers.activeWorkDurationMs,
        createdAt: workers.createdAt,
        updatedAt: workers.updatedAt,
      }).from(workers).where(eq(workers.runId, selectedRunId)).orderBy(asc(workers.createdAt), asc(workers.id))
      : [],
    selectedPlanId
      ? db.select().from(planItems).where(eq(planItems.planId, selectedPlanId))
      : [],
    selectedRunId
      ? db.select().from(clarifications).where(eq(clarifications.runId, selectedRunId)).orderBy(desc(clarifications.createdAt), desc(clarifications.id))
      : [],
    selectedRunId
      ? listExecutionEventsForSnapshot(selectedRunId, EXECUTION_EVENT_LIMIT)
      : [],
    selectedRunId
      ? listSupervisorInterventionsForSnapshot(selectedRunId, SUPERVISOR_INTERVENTION_LIMIT)
      : [],
    selectedRunId
      ? db.select().from(queuedConversationMessages)
        .where(and(
          eq(queuedConversationMessages.runId, selectedRunId),
          inArray(queuedConversationMessages.status, ["pending", "delivering"]),
        ))
        .orderBy(desc(queuedConversationMessages.createdAt), desc(queuedConversationMessages.id))
      : [],
    selectedRunId
      ? db.select().from(recoveryIncidents)
        .where(eq(recoveryIncidents.runId, selectedRunId))
        .orderBy(desc(recoveryIncidents.updatedAt), desc(recoveryIncidents.id))
        .limit(20)
      : [],
    selectedRunId
      ? db.select().from(planningReviewRuns).where(eq(planningReviewRuns.runId, selectedRunId)).orderBy(desc(planningReviewRuns.createdAt), desc(planningReviewRuns.id))
      : [],
    selectedRunId
      ? db.select().from(planningReviewRounds).where(eq(planningReviewRounds.runId, selectedRunId)).orderBy(asc(planningReviewRounds.roundNumber))
      : [],
    selectedRunId
      ? listPlanningReviewFindingsForSnapshot(selectedRunId, PLANNING_REVIEW_FINDING_LIMIT)
      : [],
    db.select().from(processSessions),
    db.select().from(conversationReadMarkers).where(visibleRunIds.length > 0 ? inArray(conversationReadMarkers.runId, visibleRunIds) : eq(conversationReadMarkers.runId, "__none__")),
  ]);
  probe?.mark("q.parallel15");

  return {
    msgs,
    allPlans,
    allRuns,
    allAccounts,
    allWorkers,
    selectedAgentWorkers,
    allPlanItems,
    allClarifications,
    allExecutionEvents,
    allSupervisorInterventions,
    allQueuedMessages,
    allRecoveryIncidents,
    allReviewRuns,
    allReviewRounds,
    allReviewFindings,
    allProcessSessions,
    allReadMarkers,
  };
}


type EventPayloadOptions = {
  selectedRunId?: string | null;
};

type PersistedEventRecords = Awaited<ReturnType<typeof readPersistedEventRecords>>;
type EventPayload = ReturnType<typeof buildEventPayload>;

const WORKER_INITIAL_PROMPT_PREVIEW_LIMIT = 1_000;
const AGENT_TEXT_FIELD_LIMIT = 4_000;
const EXECUTION_EVENT_DETAIL_LIMIT = 1_000;
const SUPERVISOR_INTERVENTION_TEXT_LIMIT = 2_000;

function truncateText(value: string | null | undefined, limit: number) {
  if (!value || value.length <= limit) {
    return value ?? "";
  }

  return `${value.slice(0, limit)}

[Truncated ${value.length - limit} characters in live payload]`;
}


```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:38:47.227Z","phase":null} -->
## Tool result: call_16n9caQAlx64ujCP6NGbt1ha · 2026-06-14T15:38:47.227Z

```text
Chunk ID: bfbc2b
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 95
Output:
import { OmniApp } from "@/ui/OmniApp";
import { buildHomeBootstrap } from "./home/bootstrap.server";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: PageProps) {
  const bootstrap = await buildHomeBootstrap(await searchParams);
  return <OmniApp bootstrap={bootstrap} />;
}

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:38:54.779Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:38:54.779Z

I’m using the writing-plans skill to create the implementation plan. I’ll save a concrete plan first, then run the requested `baton` CLI review if the command is available in this environment.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:41:02.865Z","phase":null} -->
## Tool call: apply_patch · 2026-06-14T15:41:02.865Z

````json
*** Begin Patch
*** Add File: docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md
+# Multi-Server Standalone Interface Implementation Plan
+
+> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
+
+**Goal:** Turn the OmniHarness interface into a standalone client surface that can connect to, switch between, and safely operate multiple real OmniHarness servers from one running app.
+
+**Architecture:** Add a server-directory and runtime-client boundary in front of the existing runtime HTTP/SSE contracts. The current local Next/runtime server remains a valid target, but the renderer stops assuming every API request, SSE stream, worker-entry fetch, cache record, and auth query belongs to `window.location.origin`; all runtime-owned state is keyed by a stable `serverId` plus the existing run/worker/session cursors.
+
+**Tech Stack:** Next.js 15, React 19, existing Manager classes, TanStack Query, TypeScript, runtime HTTP registry, SSE named events, localStorage for device-local server directory state, shadcn/ui controls already present in the app, shared i18n JSON resources, Vitest, lifecycle HTTP/SSE scenarios, Playwright for approval-gated UI journeys.
+
+**North Star Product:** OmniHarness becomes a control room for local, LAN, tunneled, desktop-started, editor-started, and remote OmniHarness runtimes: one interface can observe and operate many servers without losing lifecycle observability, transcript authority, auth boundaries, or user trust.
+
+**Current Milestone:** Ship a complete standalone interface mode for multiple HTTP OmniHarness server origins: users can add/edit/remove servers, select an active server, authenticate per server, browse conversations from the active server, switch servers without stale data bleed, reconnect/resync SSE per server, fetch worker entries from the correct server, and see clear per-server health/auth/error state.
+
+**Future Product Direction:** Later surfaces can add hosted account sync for the server directory, richer fleet monitoring across many servers at once, native discovery through desktop/editor shells, and admin dashboards. These are context only; the checklist below delivers the current milestone completely.
+
+**Final Functionality Standard:** The interface must operate against real OmniHarness servers only. No fake server records, mock conversations, synthetic health success, duplicate transcript persistence, or UI-only routing shims count as completion.
+
+---
+
+## Scope Notes
+
+- Do not create branches.
+- Do not create worktrees.
+- Do not delete files.
+- Keep the existing single-server local app behavior working while multi-server mode is introduced.
+- Do not replace the unified worker conversation stream. Worker content remains fetched through the target server's `/api/workers/:workerId/entries` endpoint and rendered through `WorkerEntriesManager`/`Terminal`.
+- Do not add a parallel server-side persistence layer for remote conversations. Each OmniHarness server remains authoritative for its own runs, workers, messages, events, queued messages, settings, and auth.
+- Every new user-facing frontend string must be added to every file in `shared/locales/` and rendered with `t()`.
+- All new shared frontend state must be centralized in Manager classes with narrow subscriptions. Do not use independent component arrays as source-of-truth server lists.
+
+## PM Pass
+
+**First User:** The human builder who may run more than one OmniHarness instance: local default server, desktop-started server, a server exposed through a tunnel, and possibly a second machine on LAN.
+
+**Core Job:** Use one interface to choose an OmniHarness server and operate that server's conversations, workers, plans, files, settings, and lifecycle state without restarting the UI.
+
+**Supporting Jobs:**
+
+- Add a server by URL and confirm it is really an OmniHarness server.
+- Remember trusted servers across browser refreshes.
+- See whether each server is reachable, locked by auth, authenticated, degraded, or unavailable.
+- Switch the active server without cached snapshots, query data, worker entries, or optimistic mutations corrupting the newly selected server.
+- Reconnect to SSE streams per server using the server's own event ids.
+- Recover when the selected server goes offline, returns an auth challenge, emits `stream.resync_required`, or returns incompatible version/capability data.
+- Remove a remembered server from this interface without deleting data from that server.
+- Keep local/offline single-server use simple for users who never add another server.
+
+**User Segmentation And Role Clarity:** This milestone is still a single-user builder tool. Multi-user permissioning, team server directories, and shared fleet administration are not part of the milestone.
+
+**State Model:**
+
+- `noServers`: first-run standalone directory has no configured server.
+- `serverKnown`: a server record exists with an id, display name, origin, and trust metadata.
+- `checking`: the interface is probing bootstrap/session/health for a server.
+- `reachable`: the server responded with an OmniHarness runtime descriptor.
+- `authRequired`: the server has auth enabled and the current browser context is not authenticated.
+- `authenticated`: the server accepted session state and runtime data can load.
+- `selected`: a server is the active source for app-level queries and streams.
+- `degraded`: the selected server is reachable but one or more runtime surfaces fail.
+- `offline`: the server cannot be reached.
+- `incompatible`: the server responded but lacks required multi-server contract fields.
+- `removed`: the interface forgot a server locally; remote server data is untouched.
+
+**Persistence Model:**
+
+- Server directory records persist device-locally in browser `localStorage` under a versioned key such as `omni.server-directory:v1`.
+- Stored server records include stable `serverId`, normalized origin, display name, last selected marker, last known health/auth state, last seen version/capabilities, and timestamps. They do not store translated copy.
+- Server credentials are not persisted by the directory. Existing cookie/session auth remains server-owned by browser origin. If a future token-based remote adapter is introduced, it must be designed as a separate explicit secret-storage feature.
+- Runtime snapshots, worker-entry caches, TanStack Query keys, optimistic pending ids, route selection, and read markers are keyed by `serverId` so data from one server cannot satisfy authority for another.
+- Removing a server deletes only local directory/cache records for that `serverId`; it does not call delete endpoints on the target server.
+
+**Operational Readiness:**
+
+- Bootstrap, health, auth-session, settings, event stream, worker entries, and mutation requests must all use bounded timeouts or cancellation through the runtime client.
+- Switching servers cancels or ownership-invalidates in-flight requests and SSE streams from the previous server.
+- Auth errors must show the target server and action that failed.
+- Version/capability mismatch must be explicit and recoverable.
+- Hot-path active-server bootstrap must not synchronously probe every known server; background health checks are bounded and staggered.
+
+**Instrumentation And Observability:**
+
+- The local interface emits client-side diagnostics through existing frontend error surfaces with `serverId`, `origin`, `source`, and `action`.
+- Server-side decisions remain owned by each target OmniHarness server and observed through its named event stream. The interface must not infer server decisions by diffing snapshots.
+- Add client-side lifecycle events or debug records for `server.selected`, `server.probe.started`, `server.probe.failed`, `server.auth.required`, `server.connection.offline`, `server.connection.restored`, and `server.cache.cleared` if an existing frontend diagnostics surface can consume them; otherwise model them in `ServerDirectoryManager` and render them as user-visible status.
+- Keep `/api/events/log?since=<id>&runId=<id>` scoped to the selected target server through the runtime client.
+
+**Onboarding And Discoverability:**
+
+- Existing local app behavior stays the default when the UI is served by an OmniHarness server.
+- Standalone mode shows a compact server selector in the header and an empty state that lets the user add a server URL.
+- Adding a server validates the URL and shows reachability/auth/version state before selection.
+- Server settings live in a dense settings/control surface with compact rows and no redundant explanatory chrome.
+
+**Risk And Trust Surfaces:**
+
+- Cross-server data bleed is the main trust risk. Every cache and async callback must prove server ownership before mutating visible state.
+- Auth confusion is high risk: a login prompt must name the server it applies to and never imply the user is logged into all servers.
+- Destructive actions must keep acting only on the active server and clearly show the server context.
+- `localhost` is not globally meaningful across devices. Stored server origins must be displayed exactly enough for users to distinguish local, LAN, and tunneled servers.
+
+## Product Completeness Pass
+
+### Primary Stories
+
+- As a builder, I can add a real OmniHarness server by URL and select it as the active server.
+- As a builder, I can switch between remembered servers and see the correct conversations, workers, status, and settings for the selected server.
+- As a builder, I can continue using the current single-server local app without configuring a server directory.
+
+### First-Run And Empty-State Stories
+
+- As a first-time standalone user, I see that no server is connected and can add one.
+- As a user who opens the local app at `http://localhost:3035`, I land directly in the existing home surface with the current server auto-registered as the local server.
+
+### Return/Revisit Stories
+
+- As a returning user, I see remembered servers and the last selected server.
+- As a returning user, cached previews may speed up the UI but cannot satisfy loaded authority until the selected server responds.
+
+### Failure And Recovery Stories
+
+- As a user, I see when a server is offline, requires login, is incompatible, or returns a runtime error.
+- As a user, I can retry health/auth/bootstrap for a server without losing draft input for another server.
+- As a user, if SSE replay is unavailable, the interface re-bootstrapes from the target server's snapshot anchor and does not silently miss events.
+
+### Status-Awareness Stories
+
+- As a user, I know which server is active at all times.
+- As a user, I can tell whether active conversations and worker streams are live, cached preview, reconnecting, resyncing, or terminal.
+- As a user, I can see per-server status in the selector without every known server blocking initial render.
+
+### Mutation Stories
+
+- As a user, creating, sending, stopping, retrying, deleting, archiving, editing, forking, settings saves, file opens, git workspace actions, and planning review actions apply only to the selected server.
+- As a user, if I switch servers while a mutation is in flight, the mutation result cannot navigate, clear composer state, or update snapshots for the new server unless it owns the current server token.
+
+### Mobile Stories
+
+- As a mobile user, I can still see and change the active server through the existing header/mobile navigation without crowding the composer or conversation controls.
+- As a mobile user, add/edit server controls use a sheet/dialog pattern that preserves the current conversation context.
+
+## Architecture
+
+### Server Directory
+
+Create a frontend `ServerDirectoryManager` that owns remembered servers and selected server state. It is the only source of truth for:
+
+- `serverId`,
+- normalized origin,
+- display name,
+- status,
+- last selected server,
+- last health/auth/version result,
+- local validation errors,
+- add/edit/remove dialog draft state.
+
+The manager persists only directory metadata to localStorage. It also exposes a current `serverToken`/generation that increments on selection, edit, removal, and explicit reconnect. Async code must carry this token and check it before mutating Managers, query caches, route state, worker stream state, or composer state.
+
+### Runtime Client Boundary
+
+Add a typed runtime client module used by all frontend network code:
+
+```ts
+type RuntimeServerRef = {
+  serverId: string;
+  origin: string;
+  generation: number;
+};
+
+type RuntimeClient = {
+  buildUrl(path: string): string;
+  requestJson<T>(path: string, init: RequestInit | undefined, fallback: AppErrorDescriptor): Promise<T>;
+  openEvents(args: { runId?: string | null; lastEventId?: string | null }): EventSource;
+  fetchSnapshot(args: { runId?: string | null; checksum?: string | null }): Promise<SnapshotPollResult>;
+};
+```
+
+The exact shape can change during implementation, but the boundary must prevent direct calls to hardcoded `"/api/..."` from app-state code that depends on the selected server. Local-only Next shell endpoints may remain relative if they do not target an OmniHarness runtime.
+
+### Bootstrap Model
+
+Extend `HomeBootstrapPayload` with a runtime descriptor for the server that served the page:
+
+- `serverId`,
+- `origin`,
+- `displayName`,
+- `runtimeVersion`,
+- `capabilities`,
+- `standaloneInterfaceSupported`.
+
+When the page is served by an OmniHarness runtime, the interface auto-registers this origin as the local/current server and hydrates initial event/settings/session data under that `serverId`. When the page is served as a static/standalone interface, it starts without an initial runtime payload and prompts for a server.
+
+### Query And Cache Model
+
+Every TanStack Query key for runtime state must include `serverId`:
+
+- `["auth-session", serverId]`,
+- `["settings", serverId]`,
+- `["worker-catalog", serverId]`,
+- `["project-files", serverId, projectPath]`,
+- mutation side-effect ownership checked by `serverId + generation`.
+
+Every localStorage cache key or envelope scope must include `serverId`:
+
+- event snapshot cache: `serverId + runId/global`,
+- worker entries cache: `serverId + workerId`,
+- route selection/read markers where persisted locally,
+- optimistic created/sent conversation snapshots.
+
+### SSE And Worker Entries
+
+`LiveEventConnectionManager` receives a runtime client and `serverRef`. It builds `/api/events` URLs against the selected server origin, carries the selected server generation, and ignores late events from old generations. `lastEventId` is per `serverId` and per selected run scope.
+
+`WorkerEntriesManager` keys state by `{ serverId, workerId }`, not by `workerId` alone. SSE `worker.entry_appended` remains a wake-up hint; the manager fetches entry bodies from the selected server's `/api/workers/:workerId/entries` endpoint. A global ring-buffer resync on one server must not clear worker streams for another server.
+
+### Auth And Trust Boundary
+
+Auth remains server-origin-owned. The runtime client uses `credentials: "include"` for same-origin and configured remote origins, and surfaces `401`/`403` as server-specific auth state. Login/logout/session routes are issued against the selected server only.
+
+Cross-origin support must be explicit:
+
+- Detect and report CORS/network failures separately from auth failures.
+- Require `http://` or `https://` origins; normalize away trailing slashes.
+- Block obviously unsafe protocols.
+- Show the exact origin in auth and destructive-action context.
+
+### UI Surface
+
+Add a compact active-server control to `HomeHeader` using existing shadcn/ui primitives:
+
+- active server name/origin,
+- health/auth status indicator,
+- menu to switch servers,
+- add server action,
+- edit/remove action for remembered servers,
+- retry connection action.
+
+Settings gets a server directory panel or section with dense rows. It should follow the existing settings layout and avoid duplicate headings/subtitles. The add/edit server dialog validates and probes a server before saving or selecting.
+
+Desktop/mobile behavior:
+
+- Desktop: header selector plus settings panel.
+- Mobile: same selector accessible from top navigation or a sheet; no crowded inline server table in the composer.
+
+### Error Model
+
+Extend `AppErrorDescriptor` or wrap it at runtime-client boundaries with:
+
+- `serverId`,
+- `origin`,
+- `code`,
+- `status`,
+- `source`,
+- `action`,
+- `details`.
+
+Do not replace target server errors with generic "failed" text. Preserve server-provided stable codes and details when present.
+
+## Client/Server State Invariants
+
+- **Owner:** Runtime data is owned by the selected server. Directory metadata is owned by `ServerDirectoryManager`. Worker transcript content is owned by the target server's worker JSONL stream.
+- **Token:** Every async result carries `serverId + generation`; run-specific work also carries `runId`; worker content also carries `serverId + workerId + seq`.
+- **Provenance:** Cached snapshots and worker entries are preview/fallback only until the selected server returns authoritative bootstrap/snapshot or contiguous stream data.
+- **Completeness:** Event snapshots keep existing `snapshotScope`, `messageScope`, and catalog completeness rules, now scoped by `serverId`.
+- **Ordering:** SSE uses the target server's monotonic event ids. Worker content uses target server per-worker `seq`. Lists keep existing deterministic tie-breakers such as `(createdAt, id)`.
+- **State machine:** Server directory status transitions are explicit: unknown -> checking -> reachable/authRequired/authenticated/degraded/offline/incompatible.
+- **Events:** Server decisions still come from the target server's named events. Client-side server-selection decisions are manager-owned UI state, not synthetic runtime events.
+- **Loading shape:** Split active-server bootstrap, auth check, snapshot load, SSE reconnect, worker-entry fetch, background health check, and terminal error states.
+- **Fallbacks:** A cached same-server preview may render while reconnecting. A different server's cache must never render for the selected server.
+- **Tests:** Include stale-response, server-switch, query-key, SSE replay/resync, worker-entry cache, and mutation ownership tests.
+
+## File Map
+
+### Files To Create
+
+- `src/app/home/ServerDirectoryManager.ts`
+  - Manager for remembered servers, selected server, health/auth status, add/edit/remove dialog drafts, localStorage persistence, and generation tokens.
+- `src/app/home/runtime-client.ts`
+  - Selected-server-aware request, snapshot, event-stream, worker-entry URL, timeout, cancellation, and error-normalization helpers.
+- `src/app/home/server-directory-storage.ts`
+  - Versioned serialization, migration, origin normalization, pruning, and local removal helpers for server directory records.
+- `src/app/home/server-health.ts`
+  - Probe logic for runtime bootstrap/session capability checks with bounded timeouts and typed outcomes.
+- `src/components/home/ServerSelector.tsx`
+  - Header/mobile server selector, status menu, switch/retry/edit/remove entry points, all strings through i18n.
+- `src/components/settings/ServersSettingsPanel.tsx`
+  - Dense settings panel for remembered servers and add/edit/remove controls.
+- `src/components/home/ServerConnectionDialog.tsx`
+  - Add/edit server dialog with URL normalization, validation, probe result, auth/incompatible/offline messaging, and save/select actions.
+- `tests/app/home/ServerDirectoryManager.test.ts`
+  - Directory persistence, selection generation, remove semantics, migration, and status transitions.
+- `tests/app/home/runtime-client.test.ts`
+  - URL building, error normalization, auth/offline classification, timeout/cancellation, and ownership-token behavior.
+- `tests/app/home/multi-server-cache.test.ts`
+  - Snapshot/worker cache scoping by `serverId`.
+- `tests/lifecycle/scenarios/multi-server-interface.test.ts`
+  - Headless two-server scenario proving selected-server bootstrap, event logs, worker entries, auth/offline behavior, and cleanup.
+- `docs/architecture/multi-server-standalone-interface.md`
+  - Architecture doc covering server directory ownership, runtime-client contracts, cache keys, auth boundary, and test rules.
+
+### Files To Modify
+
+- `src/runtime/bootstrap.ts`
+  - Add runtime/server descriptor fields to `HomeBootstrapPayload`.
+- `src/app/home/bootstrap.server.ts`
+  - Preserve existing Next bootstrap while passing descriptor data through.
+- `src/app/home/HomeApp.tsx`
+  - Hydrate server directory from bootstrap, pass active server context to queries, lifecycle, mutations, header, settings, and stream managers. Split before adding substantial logic because this file is already over 1200 lines.
+- `src/app/home/useHomeQueries.ts`
+  - Include `serverId` in query keys and route all runtime requests through `runtime-client`.
+- `src/app/home/useHomeMutations.ts`
+  - Include selected server ownership in mutation start state, route requests through `runtime-client`, and block stale mutation side effects after server switches.
+- `src/app/home/useHomeLifecycle.ts`
+  - Recreate/cancel live event connections when `serverId`, generation, selected run, or auth state changes.
+- `src/app/home/LiveEventConnectionManager.ts`
+  - Replace relative URL builders with runtime-client URL builders, carry server generation, and report server-scoped errors.
+- `src/app/home/EventStreamStateManager.ts`
+  - Preserve merge/completeness behavior while scoping cache hydration and authoritative snapshots by `serverId`.
+- `src/app/home/EventStreamSnapshotCacheManager.ts`
+  - Version cache envelopes to include `serverId` in scope keys; migrate or ignore v1 same-origin-only cache safely.
+- `src/app/home/WorkerEntriesManager.ts`
+  - Key state, listeners, cache entries, in-flight requests, wake versions, and endpoint builders by `serverId + workerId`.
+- `src/app/home/HomeUiStateManager.ts`
+  - Add selected server route/UI state only if it belongs with existing route state; otherwise keep it in `ServerDirectoryManager`.
+- `src/components/home/HomeHeader.tsx`
+  - Render `ServerSelector` without broad subscriptions to high-churn conversation state.
+- `src/components/home/SettingsDialog.tsx`
+  - Register the servers settings section/tab if the existing settings composition supports it.
+- `src/components/settings/GeneralSettingsPanel.tsx`
+  - Link or route to server directory controls if that matches the current settings hierarchy.
+- `src/components/home/ConversationSidebar.tsx`
+  - Make active-server identity visible where needed and avoid cross-server cached counts.
+- `src/components/home/ConversationMain.tsx`
+  - Ensure destructive and mutation controls receive active server context and render server-specific failure context. Avoid growing this already-large file; extract helper components if substantial UI is needed.
+- `src/lib/app-errors.ts`
+  - Preserve runtime `code`, `serverId`, and `origin` fields in normalized app errors.
+- `shared/locales/*.json`
+  - Add keys for server selector, server statuses, add/edit/remove dialogs, validation, auth/offline/incompatible errors, retry, and settings labels.
+- `tests/lifecycle/harness/server.ts`
+  - If needed, expose helper to launch two isolated OmniHarness servers on separate ports for the multi-server scenario.
+- `tests/lifecycle/harness/client.ts`
+  - If needed, add helpers for server-specific bootstrap/events/log/worker-entry calls.
+- `.gitignore`
+  - Verify no change is needed; add ignores only if tests introduce new temp output paths.
+
+### Tests To Update Or Add
+
+- Unit tests for server origin normalization and unsafe protocol rejection.
+- Unit tests for `ServerDirectoryManager` persistence, migrations, generation ownership, last-selected behavior, and local-only removal.
+- Unit tests for runtime-client request URL building, credentials mode, timeout/cancellation, auth/offline/incompatible classification, and error details.
+- Unit tests for `useHomeQueries` query keys or extracted key builders to prove `serverId` is always present for runtime queries.
+- Unit tests for mutation ownership helpers in `useHomeMutations.ts`: start on server A, switch to B, resolve A, assert B is not mutated.
+- Unit tests for `EventStreamSnapshotCacheManager` proving server A cache cannot hydrate server B, and server-authoritative bootstrap cannot be demoted by same-server cache.
+- Unit tests for `WorkerEntriesManager` proving same `workerId` on two servers has independent entries, in-flight requests, cache, and wake-up behavior.
+- Lifecycle scenario with two real isolated servers:
+  - add/select server A and server B,
+  - verify bootstrap and `/api/events/log` source for each,
+  - create or inspect a conversation on A,
+  - switch to B and verify A data disappears or becomes clearly inactive,
+  - reconnect A with `Last-Event-ID`,
+  - simulate B offline and verify A remains usable,
+  - cleanup all test conversations/artifacts on both servers.
+- Existing lifecycle tests must keep passing: `pnpm test:lifecycle`.
+
+### Candidate Agentic User Journey Tests
+
+These require explicit user approval before running:
+
+- **Two-server switching journey:** open the UI, add two local test servers, create a conversation on each, switch repeatedly, and confirm conversations, worker streams, and composer drafts do not bleed across servers.
+- **Auth boundary journey:** connect to one unlocked server and one password-protected server, verify login state and errors are scoped to the protected server.
+- **Offline recovery journey:** connect to two servers, stop one, verify status/error/retry behavior while the other remains usable, restart the stopped server, and verify reconnect/resync.
+- **Mobile selector journey:** verify server selection and add/edit flows fit on mobile without hiding the active conversation state.
+
+### `.gitignore` Coverage
+
+Before implementation, verify `.gitignore` covers:
+
+- `node_modules/`, package-manager caches, `.next/`, coverage, logs, temp files, and lifecycle harness temp roots.
+- No server-directory secret files are introduced.
+- No generated screenshots, Playwright reports, or lifecycle run artifacts are committed unless explicitly requested.
+
+## Implementation Checklist
+
+- [ ] Audit touched file sizes and split before adding major logic.
+  - `src/app/home/HomeApp.tsx` is already over 1200 lines; extract server-directory bootstrap/lifecycle glue before adding the new surface.
+  - `src/app/home/useHomeMutations.ts` is close to 1200 lines; extract server-aware request helpers and ownership checks rather than growing inline mutation bodies.
+  - Verification: `wc -l` confirms new multi-server logic lives in dedicated modules and no touched file newly exceeds 1200 lines without a planned split.
+
+- [ ] Add the runtime server descriptor to bootstrap.
+  - Modify `src/runtime/bootstrap.ts` and `src/app/home/bootstrap.server.ts`.
+  - Include serving origin, stable local `serverId`, display name, runtime version/capability fields, and initial data ownership.
+  - Verification: unit test or route test proves `/api/runtime/bootstrap` and SSR bootstrap include the descriptor and preserve existing fields.
+
+- [ ] Implement server directory storage and manager with TDD.
+  - Create `src/app/home/server-directory-storage.ts` and `src/app/home/ServerDirectoryManager.ts`.
+  - Cover add, update, remove, select, generation increment, last selected server, migration, invalid records, and bootstrap auto-registration.
+  - Verification: `pnpm test -- tests/app/home/ServerDirectoryManager.test.ts`.
+
+- [ ] Implement the selected-server runtime client with TDD.
+  - Create `src/app/home/runtime-client.ts` and `src/app/home/server-health.ts`.
+  - Enforce URL normalization, allowed protocols, credentials, timeouts, aborts, error normalization, and ownership-token checks.
+  - Verification: `pnpm test -- tests/app/home/runtime-client.test.ts`.
+
+- [ ] Scope event snapshot cache by server.
+  - Modify `src/app/home/EventStreamSnapshotCacheManager.ts` and `src/app/home/EventStreamStateManager.ts`.
+  - Preserve server-authoritative bootstrap behavior and existing scoped completeness merges.
+  - Verification: cache tests prove no cross-server hydration and no demotion of `snapshotSource: "server"`.
+
+- [ ] Scope worker entry state and cache by server.
+  - Modify `src/app/home/WorkerEntriesManager.ts`.
+  - Keep the contiguous-prefix invariant, wake-up semantics, bounded cache, and `?afterSeq=`/tail/backfill flows.
+  - Verification: worker manager tests prove same `workerId` on two servers stays isolated and stale fetches cannot mutate the active server stream.
+
+- [ ] Route live event connections through the runtime client.
+  - Modify `src/app/home/LiveEventConnectionManager.ts` and `src/app/home/useHomeLifecycle.ts`.
+  - Carry `serverId + generation`, per-server `lastEventId`, snapshot anchor headers, fallback polling, and resync behavior.
+  - Verification: unit tests for URL construction/ownership plus lifecycle SSE scenario for reconnect/resync.
+
+- [ ] Make query keys and bootstrap hydration server-aware.
+  - Modify `src/app/home/HomeApp.tsx`, `src/app/home/useHomeQueries.ts`, and related extracted helpers.
+  - Prime TanStack Query under `serverId` keys and clear or ignore previous-server queries on selection change without globally discarding useful caches.
+  - Verification: tests or focused assertions prove `auth-session`, `settings`, `worker-catalog`, and `project-files` cannot be read across servers.
+
+- [ ] Make mutations server-aware and stale-safe.
+  - Modify `src/app/home/useHomeMutations.ts`, `src/app/home/useQueuedMessageMutations.ts` if needed, and supporting action helpers.
+  - At mutation start, capture `serverId`, generation, selected run, composer draft, and attachments identity. On success/error, mutate UI only if ownership still matches.
+  - Verification: stale mutation tests for create, send, stop, delete/archive, settings save, and queued-message actions where applicable.
+
+- [ ] Build the server selector and connection dialogs.
+  - Create `src/components/home/ServerSelector.tsx` and `src/components/home/ServerConnectionDialog.tsx`.
+  - Modify `src/components/home/HomeHeader.tsx` and mobile navigation wiring.
+  - Use existing shadcn/ui controls; use lucide icons where appropriate; keep subscriptions narrow.
+  - Verification: component tests where practical and Playwright screenshot/journey only with user approval.
+
+- [ ] Add the servers settings surface.
+  - Create `src/components/settings/ServersSettingsPanel.tsx`.
+  - Modify `src/components/home/SettingsDialog.tsx` or the active settings composition to include it.
+  - Use compact rows, explicit save/remove/retry behavior, and no repeated headings or decorative nested cards.
+  - Verification: i18n tests/static checks plus manual UI check if running browser verification is approved.
+
+- [ ] Add all i18n resources.
+  - Modify every `shared/locales/*.json` file in the same change.
+  - Add stable dotted keys for selector labels, statuses, validation, auth/offline/incompatible errors, add/edit/remove actions, retry, and settings copy.
+  - Verification: JSON parse check and existing i18n/lint checks.
+
+- [ ] Preserve error transparency with server context.
+  - Modify `src/lib/app-errors.ts` and runtime-client error handling.
+  - Preserve target server stable error codes, status, details, source/action, `serverId`, and origin.
+  - Verification: tests cover server JSON error payloads, network failures, CORS-like fetch failures, auth failures, and malformed payloads.
+
+- [ ] Add lifecycle coverage for two real servers.
+  - Create `tests/lifecycle/scenarios/multi-server-interface.test.ts`.
+  - Extend lifecycle harness helpers only as needed to launch two isolated servers and clean up conversations/artifacts on both.
+  - Assert on HTTP/SSE/event-log behavior rather than browser DOM for control-plane correctness.
+  - Verification: targeted lifecycle scenario passes and cleanup leaves no test conversations/artifacts behind.
+
+- [ ] Run deterministic verification.
+  - `pnpm test -- tests/app/home/ServerDirectoryManager.test.ts tests/app/home/runtime-client.test.ts tests/app/home/multi-server-cache.test.ts`
+  - `pnpm test:lifecycle -- tests/lifecycle/scenarios/multi-server-interface.test.ts` if the script accepts file filtering; otherwise run the full `pnpm test:lifecycle`.
+  - `pnpm lint`
+  - `pnpm build`
+
+- [ ] Run approval-gated browser/user-journey verification if approved.
+  - Proposed journeys: two-server switching, auth boundary, offline recovery, and mobile selector.
+  - Use the already-running app process when possible and the normal local URL `http://localhost:3035`.
+  - Clean up all test conversations and persisted artifacts before finishing.
+
+## Self-Review
+
+- Every runtime-owned query, mutation, cache, stream, and worker-entry fetch has a `serverId` owner token.
+- Cached data can pre-render only for the same server and cannot satisfy authoritative load gates across servers.
+- Late async responses and mutation results cannot mutate the active UI after server selection changes.
+- Worker content remains in the unified worker stream; no parallel transcript store is introduced.
+- Server-side decisions remain observable through target server named events.
+- Auth, offline, incompatible, and degraded states are visible and server-scoped.
+- The plan does not require branches, worktrees, file deletion, mocked servers, fake components, or fallback success.
+- The checklist delivers the complete current milestone; future product ideas remain context only.
*** End Patch

````

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:41:02.995Z","phase":null} -->
## Tool result: call_opP7xABQw2LKoUffG6DX0zGI · 2026-06-14T15:41:02.995Z

```text
Exit code: 0
Wall time: 0.1 seconds
Output:
Success. Updated the following files:
A docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:41:11.342Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:41:11.342Z

The draft plan is saved. I’m doing a quick structural pass now, then I’ll try the requested `baton` CLI reviewer and incorporate anything useful.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:41:11.347Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:41:11.347Z

```json
{
  "cmd": "sed -n '1,260p' docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:41:11.348Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:41:11.348Z

```json
{
  "cmd": "rg -n \"later|future|deferred|mock|placeholder|fake|worktree|branch|delete files|TODO|TBD\" docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 16000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:41:11.432Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:41:11.432Z

```json
{
  "cmd": "command -v baton || command -v baton-cli || rg --files -g '*baton*' . | sed -n '1,80p'",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 16000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:41:11.457Z","phase":null} -->
## Tool result: call_UzOOWvh0zWruRX0xqLjE1o06 · 2026-06-14T15:41:11.457Z

````text
Chunk ID: 548163
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 4132
Output:
# Multi-Server Standalone Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the OmniHarness interface into a standalone client surface that can connect to, switch between, and safely operate multiple real OmniHarness servers from one running app.

**Architecture:** Add a server-directory and runtime-client boundary in front of the existing runtime HTTP/SSE contracts. The current local Next/runtime server remains a valid target, but the renderer stops assuming every API request, SSE stream, worker-entry fetch, cache record, and auth query belongs to `window.location.origin`; all runtime-owned state is keyed by a stable `serverId` plus the existing run/worker/session cursors.

**Tech Stack:** Next.js 15, React 19, existing Manager classes, TanStack Query, TypeScript, runtime HTTP registry, SSE named events, localStorage for device-local server directory state, shadcn/ui controls already present in the app, shared i18n JSON resources, Vitest, lifecycle HTTP/SSE scenarios, Playwright for approval-gated UI journeys.

**North Star Product:** OmniHarness becomes a control room for local, LAN, tunneled, desktop-started, editor-started, and remote OmniHarness runtimes: one interface can observe and operate many servers without losing lifecycle observability, transcript authority, auth boundaries, or user trust.

**Current Milestone:** Ship a complete standalone interface mode for multiple HTTP OmniHarness server origins: users can add/edit/remove servers, select an active server, authenticate per server, browse conversations from the active server, switch servers without stale data bleed, reconnect/resync SSE per server, fetch worker entries from the correct server, and see clear per-server health/auth/error state.

**Future Product Direction:** Later surfaces can add hosted account sync for the server directory, richer fleet monitoring across many servers at once, native discovery through desktop/editor shells, and admin dashboards. These are context only; the checklist below delivers the current milestone completely.

**Final Functionality Standard:** The interface must operate against real OmniHarness servers only. No fake server records, mock conversations, synthetic health success, duplicate transcript persistence, or UI-only routing shims count as completion.

---

## Scope Notes

- Do not create branches.
- Do not create worktrees.
- Do not delete files.
- Keep the existing single-server local app behavior working while multi-server mode is introduced.
- Do not replace the unified worker conversation stream. Worker content remains fetched through the target server's `/api/workers/:workerId/entries` endpoint and rendered through `WorkerEntriesManager`/`Terminal`.
- Do not add a parallel server-side persistence layer for remote conversations. Each OmniHarness server remains authoritative for its own runs, workers, messages, events, queued messages, settings, and auth.
- Every new user-facing frontend string must be added to every file in `shared/locales/` and rendered with `t()`.
- All new shared frontend state must be centralized in Manager classes with narrow subscriptions. Do not use independent component arrays as source-of-truth server lists.

## PM Pass

**First User:** The human builder who may run more than one OmniHarness instance: local default server, desktop-started server, a server exposed through a tunnel, and possibly a second machine on LAN.

**Core Job:** Use one interface to choose an OmniHarness server and operate that server's conversations, workers, plans, files, settings, and lifecycle state without restarting the UI.

**Supporting Jobs:**

- Add a server by URL and confirm it is really an OmniHarness server.
- Remember trusted servers across browser refreshes.
- See whether each server is reachable, locked by auth, authenticated, degraded, or unavailable.
- Switch the active server without cached snapshots, query data, worker entries, or optimistic mutations corrupting the newly selected server.
- Reconnect to SSE streams per server using the server's own event ids.
- Recover when the selected server goes offline, returns an auth challenge, emits `stream.resync_required`, or returns incompatible version/capability data.
- Remove a remembered server from this interface without deleting data from that server.
- Keep local/offline single-server use simple for users who never add another server.

**User Segmentation And Role Clarity:** This milestone is still a single-user builder tool. Multi-user permissioning, team server directories, and shared fleet administration are not part of the milestone.

**State Model:**

- `noServers`: first-run standalone directory has no configured server.
- `serverKnown`: a server record exists with an id, display name, origin, and trust metadata.
- `checking`: the interface is probing bootstrap/session/health for a server.
- `reachable`: the server responded with an OmniHarness runtime descriptor.
- `authRequired`: the server has auth enabled and the current browser context is not authenticated.
- `authenticated`: the server accepted session state and runtime data can load.
- `selected`: a server is the active source for app-level queries and streams.
- `degraded`: the selected server is reachable but one or more runtime surfaces fail.
- `offline`: the server cannot be reached.
- `incompatible`: the server responded but lacks required multi-server contract fields.
- `removed`: the interface forgot a server locally; remote server data is untouched.

**Persistence Model:**

- Server directory records persist device-locally in browser `localStorage` under a versioned key such as `omni.server-directory:v1`.
- Stored server records include stable `serverId`, normalized origin, display name, last selected marker, last known health/auth state, last seen version/capabilities, and timestamps. They do not store translated copy.
- Server credentials are not persisted by the directory. Existing cookie/session auth remains server-owned by browser origin. If a future token-based remote adapter is introduced, it must be designed as a separate explicit secret-storage feature.
- Runtime snapshots, worker-entry caches, TanStack Query keys, optimistic pending ids, route selection, and read markers are keyed by `serverId` so data from one server cannot satisfy authority for another.
- Removing a server deletes only local directory/cache records for that `serverId`; it does not call delete endpoints on the target server.

**Operational Readiness:**

- Bootstrap, health, auth-session, settings, event stream, worker entries, and mutation requests must all use bounded timeouts or cancellation through the runtime client.
- Switching servers cancels or ownership-invalidates in-flight requests and SSE streams from the previous server.
- Auth errors must show the target server and action that failed.
- Version/capability mismatch must be explicit and recoverable.
- Hot-path active-server bootstrap must not synchronously probe every known server; background health checks are bounded and staggered.

**Instrumentation And Observability:**

- The local interface emits client-side diagnostics through existing frontend error surfaces with `serverId`, `origin`, `source`, and `action`.
- Server-side decisions remain owned by each target OmniHarness server and observed through its named event stream. The interface must not infer server decisions by diffing snapshots.
- Add client-side lifecycle events or debug records for `server.selected`, `server.probe.started`, `server.probe.failed`, `server.auth.required`, `server.connection.offline`, `server.connection.restored`, and `server.cache.cleared` if an existing frontend diagnostics surface can consume them; otherwise model them in `ServerDirectoryManager` and render them as user-visible status.
- Keep `/api/events/log?since=<id>&runId=<id>` scoped to the selected target server through the runtime client.

**Onboarding And Discoverability:**

- Existing local app behavior stays the default when the UI is served by an OmniHarness server.
- Standalone mode shows a compact server selector in the header and an empty state that lets the user add a server URL.
- Adding a server validates the URL and shows reachability/auth/version state before selection.
- Server settings live in a dense settings/control surface with compact rows and no redundant explanatory chrome.

**Risk And Trust Surfaces:**

- Cross-server data bleed is the main trust risk. Every cache and async callback must prove server ownership before mutating visible state.
- Auth confusion is high risk: a login prompt must name the server it applies to and never imply the user is logged into all servers.
- Destructive actions must keep acting only on the active server and clearly show the server context.
- `localhost` is not globally meaningful across devices. Stored server origins must be displayed exactly enough for users to distinguish local, LAN, and tunneled servers.

## Product Completeness Pass

### Primary Stories

- As a builder, I can add a real OmniHarness server by URL and select it as the active server.
- As a builder, I can switch between remembered servers and see the correct conversations, workers, status, and settings for the selected server.
- As a builder, I can continue using the current single-server local app without configuring a server directory.

### First-Run And Empty-State Stories

- As a first-time standalone user, I see that no server is connected and can add one.
- As a user who opens the local app at `http://localhost:3035`, I land directly in the existing home surface with the current server auto-registered as the local server.

### Return/Revisit Stories

- As a returning user, I see remembered servers and the last selected server.
- As a returning user, cached previews may speed up the UI but cannot satisfy loaded authority until the selected server responds.

### Failure And Recovery Stories

- As a user, I see when a server is offline, requires login, is incompatible, or returns a runtime error.
- As a user, I can retry health/auth/bootstrap for a server without losing draft input for another server.
- As a user, if SSE replay is unavailable, the interface re-bootstrapes from the target server's snapshot anchor and does not silently miss events.

### Status-Awareness Stories

- As a user, I know which server is active at all times.
- As a user, I can tell whether active conversations and worker streams are live, cached preview, reconnecting, resyncing, or terminal.
- As a user, I can see per-server status in the selector without every known server blocking initial render.

### Mutation Stories

- As a user, creating, sending, stopping, retrying, deleting, archiving, editing, forking, settings saves, file opens, git workspace actions, and planning review actions apply only to the selected server.
- As a user, if I switch servers while a mutation is in flight, the mutation result cannot navigate, clear composer state, or update snapshots for the new server unless it owns the current server token.

### Mobile Stories

- As a mobile user, I can still see and change the active server through the existing header/mobile navigation without crowding the composer or conversation controls.
- As a mobile user, add/edit server controls use a sheet/dialog pattern that preserves the current conversation context.

## Architecture

### Server Directory

Create a frontend `ServerDirectoryManager` that owns remembered servers and selected server state. It is the only source of truth for:

- `serverId`,
- normalized origin,
- display name,
- status,
- last selected server,
- last health/auth/version result,
- local validation errors,
- add/edit/remove dialog draft state.

The manager persists only directory metadata to localStorage. It also exposes a current `serverToken`/generation that increments on selection, edit, removal, and explicit reconnect. Async code must carry this token and check it before mutating Managers, query caches, route state, worker stream state, or composer state.

### Runtime Client Boundary

Add a typed runtime client module used by all frontend network code:

```ts
type RuntimeServerRef = {
  serverId: string;
  origin: string;
  generation: number;
};

type RuntimeClient = {
  buildUrl(path: string): string;
  requestJson<T>(path: string, init: RequestInit | undefined, fallback: AppErrorDescriptor): Promise<T>;
  openEvents(args: { runId?: string | null; lastEventId?: string | null }): EventSource;
  fetchSnapshot(args: { runId?: string | null; checksum?: string | null }): Promise<SnapshotPollResult>;
};
```

The exact shape can change during implementation, but the boundary must prevent direct calls to hardcoded `"/api/..."` from app-state code that depends on the selected server. Local-only Next shell endpoints may remain relative if they do not target an OmniHarness runtime.

### Bootstrap Model

Extend `HomeBootstrapPayload` with a runtime descriptor for the server that served the page:

- `serverId`,
- `origin`,
- `displayName`,
- `runtimeVersion`,
- `capabilities`,
- `standaloneInterfaceSupported`.

When the page is served by an OmniHarness runtime, the interface auto-registers this origin as the local/current server and hydrates initial event/settings/session data under that `serverId`. When the page is served as a static/standalone interface, it starts without an initial runtime payload and prompts for a server.

### Query And Cache Model

Every TanStack Query key for runtime state must include `serverId`:

- `["auth-session", serverId]`,
- `["settings", serverId]`,
- `["worker-catalog", serverId]`,
- `["project-files", serverId, projectPath]`,
- mutation side-effect ownership checked by `serverId + generation`.

Every localStorage cache key or envelope scope must include `serverId`:

- event snapshot cache: `serverId + runId/global`,
- worker entries cache: `serverId + workerId`,
- route selection/read markers where persisted locally,
- optimistic created/sent conversation snapshots.

### SSE And Worker Entries

`LiveEventConnectionManager` receives a runtime client and `serverRef`. It builds `/api/events` URLs against the selected server origin, carries the selected server generation, and ignores late events from old generations. `lastEventId` is per `serverId` and per selected run scope.

`WorkerEntriesManager` keys state by `{ serverId, workerId }`, not by `workerId` alone. SSE `worker.entry_appended` remains a wake-up hint; the manager fetches entry bodies from the selected server's `/api/workers/:workerId/entries` endpoint. A global ring-buffer resync on one server must not clear worker streams for another server.

### Auth And Trust Boundary

Auth remains server-origin-owned. The runtime client uses `credentials: "include"` for same-origin and configured remote origins, and surfaces `401`/`403` as server-specific auth state. Login/logout/session routes are issued against the selected server only.

Cross-origin support must be explicit:

- Detect and report CORS/network failures separately from auth failures.
- Require `http://` or `https://` origins; normalize away trailing slashes.
- Block obviously unsafe protocols.
- Show the exact origin in auth and destructive-action context.

### UI Surface

Add a compact active-server control to `HomeHeader` using existing shadcn/ui primitives:

- active server name/origin,
- health/auth status indicator,
- menu to switch servers,
- add server action,
- edit/remove action for remembered servers,
- retry connection action.

Settings gets a server directory panel or section with dense rows. It should follow the existing settings layout and avoid duplicate headings/subtitles. The add/edit server dialog validates and probes a server before saving or selecting.

Desktop/mobile behavior:

- Desktop: header selector plus settings panel.
- Mobile: same selector accessible from top navigation or a sheet; no crowded inline server table in the composer.

### Error Model

Extend `AppErrorDescriptor` or wrap it at runtime-client boundaries with:

- `serverId`,
- `origin`,
- `code`,
- `status`,
- `source`,
- `action`,
- `details`.

Do not replace target server errors with generic "failed" text. Preserve server-provided stable codes and details when present.

## Client/Server State Invariants


````

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:41:11.457Z","phase":null} -->
## Tool result: call_6dYCpA0QAHZGc8DJKg4PUOir · 2026-06-14T15:41:11.457Z

```text
Chunk ID: 9b3a03
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 204
Output:
17:**Final Functionality Standard:** The interface must operate against real OmniHarness servers only. No fake server records, mock conversations, synthetic health success, duplicate transcript persistence, or UI-only routing shims count as completion.
23:- Do not create branches.
24:- Do not create worktrees.
25:- Do not delete files.
69:- Server credentials are not persisted by the directory. Existing cookie/session auth remains server-owned by browser origin. If a future token-based remote adapter is introduced, it must be designed as a separate explicit secret-storage feature.
476:- The plan does not require branches, worktrees, file deletion, mocked servers, fake components, or fallback success.
477:- The checklist delivers the complete current milestone; future product ideas remain context only.

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:41:11.492Z","phase":null} -->
## Tool result: call_BTn6mXqirEO5rUwXBDp9vO4a · 2026-06-14T15:41:11.492Z

```text
Chunk ID: c3e543
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 0
Output:

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:41:18.957Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:41:18.957Z

The structural scan found no stale task sections or placeholder delivery language. I also checked for `baton`; it is not currently resolving on `PATH` and there are no matching repo files, so I’m going to make one explicit CLI attempt and then use the fallback only if the shell confirms it is unavailable.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:41:19.426Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:41:19.426Z

```json
{
  "cmd": "baton --help",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:41:19.502Z","phase":null} -->
## Tool result: call_F85G319pZlsq5nmMUZwX2azr · 2026-06-14T15:41:19.502Z

```text
Chunk ID: f407a6
Wall time: 0.0000 seconds
Process exited with code 127
Original token count: 8
Output:
zsh:1: command not found: baton

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:41:32.717Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:41:32.717Z

`baton` is not installed or not on `PATH` in this shell (`zsh: command not found`). I’m checking for another headless reviewer so the second-opinion gate still happens, and I’ll record clearly that it was a fallback rather than the requested CLI.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:41:32.717Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:41:32.717Z

```json
{
  "cmd": "command -v claude || true",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:41:32.718Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:41:32.718Z

```json
{
  "cmd": "command -v codex || true",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:41:32.719Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:41:32.719Z

```json
{
  "cmd": "command -v gemini || true",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:41:32.781Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:41:32.781Z

```json
{
  "cmd": "command -v opencode || true",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:41:32.796Z","phase":null} -->
## Tool result: call_liZ5HpaEOuN8BEWakQ6WOauE · 2026-06-14T15:41:32.796Z

```text
Chunk ID: 528239
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 0
Output:

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:41:32.796Z","phase":null} -->
## Tool result: call_7UHnPvMZPt0yVXF3UUQ8IXmh · 2026-06-14T15:41:32.796Z

```text
Chunk ID: a33aac
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 13
Output:
/Applications/Codex.app/Contents/Resources/codex

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:41:32.796Z","phase":null} -->
## Tool result: call_4TvhApvF03BnZgRQ8slwWWLT · 2026-06-14T15:41:32.796Z

```text
Chunk ID: 007850
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 0
Output:

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:41:32.827Z","phase":null} -->
## Tool result: call_MTBKoDF0RZlub4mQpiVF7sUl · 2026-06-14T15:41:32.827Z

```text
Chunk ID: 40644f
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 0
Output:

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:41:39.722Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:41:39.722Z

No different reviewer CLI is available; only Codex CLI is installed. I’ll use it as a separate same-harness reviewer session, which satisfies the second-opinion process when the requested/different CLI is unavailable.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:41:40.082Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:41:40.082Z

```json
{
  "cmd": "/Applications/Codex.app/Contents/Resources/codex --help",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 18000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:41:40.171Z","phase":null} -->
## Tool result: call_owibJPaf6sQieTFaKlgl0ADK · 2026-06-14T15:41:40.171Z

```text
Chunk ID: c47a1b
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1479
Output:
WARNING: proceeding, even though we could not create PATH aliases: Operation not permitted (os error 1)
Codex CLI

If no subcommand is specified, options will be forwarded to the interactive CLI.

Usage: codex [OPTIONS] [PROMPT]
       codex [OPTIONS] <COMMAND> [ARGS]

Commands:
  exec            Run Codex non-interactively [aliases: e]
  review          Run a code review non-interactively
  login           Manage login
  logout          Remove stored authentication credentials
  mcp             Manage external MCP servers for Codex
  plugin          Manage Codex plugins
  mcp-server      Start Codex as an MCP server (stdio)
  app-server      [experimental] Run the app server or related tooling
  remote-control  [experimental] Manage the app-server daemon with remote control enabled
  app             Launch the Codex desktop app (opens the app installer if missing)
  completion      Generate shell completion scripts
  update          Update Codex to the latest version
  doctor          Diagnose local Codex installation, config, auth, and runtime health
  sandbox         Run commands within a Codex-provided sandbox
  debug           Debugging tools
  apply           Apply the latest diff produced by Codex agent as a `git apply` to your local
                  working tree [aliases: a]
  resume          Resume a previous interactive session (picker by default; use --last to continue
                  the most recent)
  archive         Archive a saved session by id or session name
  unarchive       Unarchive a saved session by id or session name
  fork            Fork a previous interactive session (picker by default; use --last to fork the
                  most recent)
  cloud           [EXPERIMENTAL] Browse tasks from Codex Cloud and apply changes locally
  exec-server     [EXPERIMENTAL] Run the standalone exec-server service
  features        Inspect feature flags
  help            Print this message or the help of the given subcommand(s)

Arguments:
  [PROMPT]
          Optional user prompt to start the session

Options:
  -c, --config <key=value>
          Override a configuration value that would otherwise be loaded from `~/.codex/config.toml`.
          Use a dotted path (`foo.bar.baz`) to override nested values. The `value` portion is parsed
          as TOML. If it fails to parse as TOML, the raw string is used as a literal.
          
          Examples: - `-c model="o3"` - `-c 'sandbox_permissions=["disk-full-read-access"]'` - `-c
          shell_environment_policy.inherit=all`

      --enable <FEATURE>
          Enable a feature (repeatable). Equivalent to `-c features.<name>=true`

      --disable <FEATURE>
          Disable a feature (repeatable). Equivalent to `-c features.<name>=false`

      --remote <ADDR>
          Connect the TUI to a remote app server endpoint.
          
          Accepted forms: `ws://host:port`, `wss://host:port`, `unix://`, or `unix://PATH`.

      --remote-auth-token-env <ENV_VAR>
          Name of the environment variable containing the bearer token to send to a remote app
          server websocket

      --strict-config
          Error out when config.toml contains fields that are not recognized by this version of
          Codex

  -i, --image <FILE>...
          Optional image(s) to attach to the initial prompt

  -m, --model <MODEL>
          Model the agent should use

      --oss
          Use open-source provider

      --local-provider <OSS_PROVIDER>
          Specify which local provider to use (lmstudio or ollama). If not specified with --oss,
          will use config default or show selection

  -p, --profile <CONFIG_PROFILE_V2>
          Layer $CODEX_HOME/<name>.config.toml on top of the base user config

  -s, --sandbox <SANDBOX_MODE>
          Select the sandbox policy to use when executing model-generated shell commands
          
          [possible values: read-only, workspace-write, danger-full-access]

      --dangerously-bypass-approvals-and-sandbox
          Skip all confirmation prompts and execute commands without sandboxing. EXTREMELY
          DANGEROUS. Intended solely for running in environments that are externally sandboxed

      --dangerously-bypass-hook-trust
          Run enabled hooks without requiring persisted hook trust for this invocation. DANGEROUS.
          Intended only for automation that already vets hook sources

  -C, --cd <DIR>
          Tell the agent to use the specified directory as its working root

      --add-dir <DIR>
          Additional directories that should be writable alongside the primary workspace

  -a, --ask-for-approval <APPROVAL_POLICY>
          Configure when the model requires human approval before executing a command

          Possible values:
          - untrusted:  Only run "trusted" commands (e.g. ls, cat, sed) without asking for user
            approval. Will escalate to the user if the model proposes a command that is not in the
            "trusted" set
          - on-failure: DEPRECATED: Run all commands without asking for user approval. Only asks for
            approval if a command fails to execute, in which case it will escalate to the user to
            ask for un-sandboxed execution. Prefer `on-request` for interactive runs or `never` for
            non-interactive runs
          - on-request: The model decides when to ask the user for approval
          - never:      Never ask for user approval Execution failures are immediately returned to
            the model

      --search
          Enable live web search. When enabled, the native Responses `web_search` tool is available
          to the model (no per‑call approval)

      --no-alt-screen
          Disable alternate screen mode
          
          Runs the TUI in inline mode, preserving terminal scrollback history.

  -h, --help
          Print help (see a summary with '-h')

  -V, --version
          Print version

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:41:42.982Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:41:42.982Z

I’m checking the non-interactive Codex flags before launching the reviewer so it stays read-only and does not edit files.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:41:44.259Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:41:44.259Z

```json
{
  "cmd": "/Applications/Codex.app/Contents/Resources/codex exec --help",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 18000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:41:44.341Z","phase":null} -->
## Tool result: call_k7jzjGMb9rFBS8Y6gENMFQkt · 2026-06-14T15:41:44.341Z

```text
Chunk ID: 9035ef
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 947
Output:
WARNING: proceeding, even though we could not create PATH aliases: Operation not permitted (os error 1)
Run Codex non-interactively

Usage: codex exec [OPTIONS] [PROMPT]
       codex exec [OPTIONS] <COMMAND> [ARGS]

Commands:
  resume  Resume a previous session by id or pick the most recent with --last
  review  Run a code review against the current repository
  help    Print this message or the help of the given subcommand(s)

Arguments:
  [PROMPT]
          Initial instructions for the agent. If not provided as an argument (or if `-` is used),
          instructions are read from stdin. If stdin is piped and a prompt is also provided, stdin
          is appended as a `<stdin>` block

Options:
  -c, --config <key=value>
          Override a configuration value that would otherwise be loaded from `~/.codex/config.toml`.
          Use a dotted path (`foo.bar.baz`) to override nested values. The `value` portion is parsed
          as TOML. If it fails to parse as TOML, the raw string is used as a literal.
          
          Examples: - `-c model="o3"` - `-c 'sandbox_permissions=["disk-full-read-access"]'` - `-c
          shell_environment_policy.inherit=all`

      --enable <FEATURE>
          Enable a feature (repeatable). Equivalent to `-c features.<name>=true`

      --disable <FEATURE>
          Disable a feature (repeatable). Equivalent to `-c features.<name>=false`

      --strict-config
          Error out when config.toml contains fields that are not recognized by this version of
          Codex

  -i, --image <FILE>...
          Optional image(s) to attach to the initial prompt

  -m, --model <MODEL>
          Model the agent should use

      --oss
          Use open-source provider

      --local-provider <OSS_PROVIDER>
          Specify which local provider to use (lmstudio or ollama). If not specified with --oss,
          will use config default or show selection

  -p, --profile <CONFIG_PROFILE_V2>
          Layer $CODEX_HOME/<name>.config.toml on top of the base user config

  -s, --sandbox <SANDBOX_MODE>
          Select the sandbox policy to use when executing model-generated shell commands
          
          [possible values: read-only, workspace-write, danger-full-access]

      --dangerously-bypass-approvals-and-sandbox
          Skip all confirmation prompts and execute commands without sandboxing. EXTREMELY
          DANGEROUS. Intended solely for running in environments that are externally sandboxed

      --dangerously-bypass-hook-trust
          Run enabled hooks without requiring persisted hook trust for this invocation. DANGEROUS.
          Intended only for automation that already vets hook sources

  -C, --cd <DIR>
          Tell the agent to use the specified directory as its working root

      --add-dir <DIR>
          Additional directories that should be writable alongside the primary workspace

      --skip-git-repo-check
          Allow running Codex outside a Git repository

      --ephemeral
          Run without persisting session files to disk

      --ignore-user-config
          Do not load `$CODEX_HOME/config.toml`; auth still uses `CODEX_HOME`

      --ignore-rules
          Do not load user or project execpolicy `.rules` files

      --output-schema <FILE>
          Path to a JSON Schema file describing the model's final response shape

      --color <COLOR>
          Specifies color settings for use in the output
          
          [default: auto]
          [possible values: always, never, auto]

      --json
          Print events to stdout as JSONL

  -o, --output-last-message <FILE>
          Specifies file where the last message from the agent should be written

  -h, --help
          Print help (see a summary with '-h')

  -V, --version
          Print version

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:41:56.522Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:41:56.522Z

I’m launching the second-opinion reviewer now against the saved plan in read-only mode. The prompt tells it not to edit files and to focus on readiness, missing requirements, state ownership, sequencing, and verification gaps.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:42:01.174Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:42:01.174Z

```json
{
  "cmd": "/Applications/Codex.app/Contents/Resources/codex exec -C /Users/masterman/NLP/omniharness --sandbox read-only --ask-for-approval never \"You are my second-opinion planning reviewer. Review the artifact without editing files. Artifact: /Users/masterman/NLP/omniharness/docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md. User goal: support multiple OmniHarness servers inside the same running app by turning the interface into a standalone thing that can connect to multiple servers. Context and constraints: no branches, no worktrees, no file deletion; preserve unified worker stream; all frontend strings through shared/locales and t(); manager-owned React state; server decisions through named events; lifecycle tests via HTTP/SSE. Please judge whether this plan is ready to use. Look for missing requirements or user instructions, vague tasks, placeholders, fake components, scope creep needing confirmation, missing file map/ownership/state/persistence/instrumentation/error/verification details, sequencing problems, and test gaps. Return: 1. Verdict READY or HARDEN 2. Highest-impact findings with concrete fixes 3. Anything you would deliberately leave alone.\"",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 30000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:42:01.253Z","phase":null} -->
## Tool result: call_tXvY2aTpx6IXe4HwVIIW9Hla · 2026-06-14T15:42:01.253Z

```text
Chunk ID: 9494bf
Wall time: 0.0000 seconds
Process exited with code 2
Original token count: 89
Output:
WARNING: proceeding, even though we could not create PATH aliases: Operation not permitted (os error 1)
error: unexpected argument '--ask-for-approval' found

  tip: to pass '--ask-for-approval' as a value, use '-- --ask-for-approval'

Usage: codex exec [OPTIONS] [PROMPT]
       codex exec [OPTIONS] <COMMAND> [ARGS]

For more information, try '--help'.

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:42:04.485Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:42:04.485Z

The installed Codex CLI’s `exec` subcommand does not accept the top-level approval flag, so I’m rerunning it with the supported read-only sandbox flag only.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:42:09.656Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:42:09.656Z

```json
{
  "cmd": "/Applications/Codex.app/Contents/Resources/codex exec -C /Users/masterman/NLP/omniharness --sandbox read-only \"You are my second-opinion planning reviewer. Review the artifact without editing files. Artifact: /Users/masterman/NLP/omniharness/docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md. User goal: support multiple OmniHarness servers inside the same running app by turning the interface into a standalone thing that can connect to multiple servers. Context and constraints: no branches, no worktrees, no file deletion; preserve unified worker stream; all frontend strings through shared/locales and t(); manager-owned React state; server decisions through named events; lifecycle tests via HTTP/SSE. Please judge whether this plan is ready to use. Look for missing requirements or user instructions, vague tasks, placeholders, fake components, scope creep needing confirmation, missing file map/ownership/state/persistence/instrumentation/error/verification details, sequencing problems, and test gaps. Return: 1. Verdict READY or HARDEN 2. Highest-impact findings with concrete fixes 3. Anything you would deliberately leave alone.\"",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 30000,
  "max_output_tokens": 40000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:42:09.767Z","phase":null} -->
## Tool result: call_V9Om44InTSYwRAjLWaTUMIZo · 2026-06-14T15:42:09.767Z

```text
Chunk ID: de41a5
Wall time: 0.0000 seconds
Process exited with code 1
Original token count: 172
Output:
WARNING: proceeding, even though we could not create PATH aliases: Operation not permitted (os error 1)
2026-06-14T15:42:09.737440Z  WARN codex_state::runtime: failed to open state db at /Users/masterman/.codex/sqlite/state_5.sqlite: error returned from database: (code: 8) attempt to write a readonly database
2026-06-14T15:42:09.737473Z  WARN codex_rollout::state_db: failed to initialize state runtime: failed to initialize state runtime at /Users/masterman/.codex/sqlite: error returned from database: (code: 8) attempt to write a readonly database
Reading additional input from stdin...
Error: failed to initialize in-process app-server client: Operation not permitted (os error 1)

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:42:14.065Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:42:14.065Z

The fallback reviewer failed because the read-only sandbox prevented the Codex CLI from initializing its own state under `~/.codex`. I’m requesting escalation for that reviewer process because the second-opinion gate depends on a separate CLI session.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:42:20.081Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:42:20.081Z

```json
{
  "cmd": "/Applications/Codex.app/Contents/Resources/codex exec -C /Users/masterman/NLP/omniharness --sandbox read-only \"You are my second-opinion planning reviewer. Review the artifact without editing files. Artifact: /Users/masterman/NLP/omniharness/docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md. User goal: support multiple OmniHarness servers inside the same running app by turning the interface into a standalone thing that can connect to multiple servers. Context and constraints: no branches, no worktrees, no file deletion; preserve unified worker stream; all frontend strings through shared/locales and t(); manager-owned React state; server decisions through named events; lifecycle tests via HTTP/SSE. Please judge whether this plan is ready to use. Look for missing requirements or user instructions, vague tasks, placeholders, fake components, scope creep needing confirmation, missing file map/ownership/state/persistence/instrumentation/error/verification details, sequencing problems, and test gaps. Return: 1. Verdict READY or HARDEN 2. Highest-impact findings with concrete fixes 3. Anything you would deliberately leave alone.\"",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 30000,
  "max_output_tokens": 40000,
  "sandbox_permissions": "require_escalated",
  "justification": "Allow the fallback Codex CLI reviewer to initialize its own state under ~/.codex so it can perform the required second-opinion review without editing project files.",
  "prefix_rule": [
    "/Applications/Codex.app/Contents/Resources/codex",
    "exec"
  ]
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:43:28.847Z","phase":null} -->
## Tool result: call_zL4theajLTaiQ9X1wtDo01m3 · 2026-06-14T15:43:28.847Z

````text
Chunk ID: 539a67
Wall time: 30.0032 seconds
Process running with session ID 17286
Original token count: 18029
Output:
Total output lines: 1077

Reading additional input from stdin...
OpenAI Codex v0.140.0-alpha.2
--------
workdir: /Users/masterman/NLP/omniharness
model: gpt-5.5
provider: openai
approval: never
sandbox: read-only
reasoning effort: high
reasoning summaries: none
session id: 019ec6cc-eac4-7643-b6c2-f1c7e8b21700
--------
user
You are my second-opinion planning reviewer. Review the artifact without editing files. Artifact: /Users/masterman/NLP/omniharness/docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md. User goal: support multiple OmniHarness servers inside the same running app by turning the interface into a standalone thing that can connect to multiple servers. Context and constraints: no branches, no worktrees, no file deletion; preserve unified worker stream; all frontend strings through shared/locales and t(); manager-owned React state; server decisions through named events; lifecycle tests via HTTP/SSE. Please judge whether this plan is ready to use. Look for missing requirements or user instructions, vague tasks, placeholders, fake components, scope creep needing confirmation, missing file map/ownership/state/persistence/instrumentation/error/verification details, sequencing problems, and test gaps. Return: 1. Verdict READY or HARDEN 2. Highest-impact findings with concrete fixes 3. Anything you would deliberately leave alone.
2026-06-14T15:42:58.867126Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T15:42:58.917677Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:42:58.917697Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:42:58.918620Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:42:58.918633Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:42:58.920427Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:42:58.920437Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:42:58.921382Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:42:58.921388Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:42:58.922266Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:42:58.922271Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:42:58.924737Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:42:58.924749Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:42:59.411794Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T15:42:59.557118Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T15:42:59.565926Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T15:42:59.565947Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T15:43:00.842395Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T15:43:00.859738Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:43:00.859746Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:43:00.860102Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:43:00.860107Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:43:00.860461Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:43:00.860468Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:43:00.860813Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:43:00.860818Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:43:00.861169Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:43:00.861174Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:43:00.861899Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:43:00.861905Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:43:01.182322Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T15:43:01.189459Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T15:43:01.189480Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
codex
I’ll use `using-ultrapowers` first because the session requires skill routing, then `second-opinion` for the planning review. I’m only reading files and will not edit the workspace.
exec
/bin/zsh -lc "sed -n '1,220p' /Users/masterman/.agents/skills/using-ultrapowers/SKILL.md" in /Users/masterman/NLP/omniharness
 succeeded in 0ms:
---
name: using-ultrapowers
description: Use when starting any conversation - establishes how to find and use skills, requiring skill invocation before acting
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, skip this skill.
</SUBAGENT-STOP>

# Using Ultrapowers

Use relevant skills before acting, but keep process proportional to the task.

## Instruction Priority

1. User instructions and local repo instructions
2. Ultrapowers skills
3. Default model behavior

If the user says not to create extra repository isolation, or says to work directly in the current repository, follow that instruction.

## Core Rule

Before responding, ask:

1. Is there a process skill that governs how to approach this?
2. Is there an implementation skill that governs how to execute it?
3. Is the request substantial enough to justify that process, or is it a tiny mechanical edit?

If a skill applies and the task is substantial enough to justify it, use it before continuing. If the request is a tiny mechanical edit, make the edit directly with targeted verification.

## Proportional Skill Use

Do the smallest responsible workflow that matches the request.

For tiny, unambiguous mechanical edits, do the edit directly:

- changing a color value,
- fixing a typo,
- tweaking short copy,
- changing a prompt sentence,
- renaming a label,
- adjusting obvious spacing or formatting,
- making a one-line config or docs correction.

For these, do not run brainstorming, write a plan, or force TDD unless the change affects product behavior, data, persistence, control flow, user journeys, or non-obvious architecture.

Use the heavier process when the request is ambiguous, user-facing behavior changes, multiple files/modules are involved, the user journey can change, or the change could create regressions that are not obvious from a quick targeted check.

## Default Posture

- Work in the current repository by default.
- YOU WILL NEVER CREATE A BRANCH unless explicitly instructed.
- Ask the user whether we should work in worktrees as part of the planning.
- YOU WILL ONLY CREATE A WORKTREE if explicitly instructed.
- Keep skill use proportional. Tiny mechanical edits should stay tiny.
- Every project should have a `.gitignore`.
- Never commit or push secrets, credentials, local environment files, `node_modules`, dependency caches, build outputs, coverage output, logs, temporary files, or intermediate/generated artifacts unless the human explicitly asks to version a specific generated artifact.
- Deliver full product functionality by default. NO FAKE COMPONENTS, NO MOCKS, NO PLACEHOLDERS, NO FALLBACKS as substitutes for the requested functionality unless the human explicitly asks for a prototype or scaffold.
- For app, UI, and product-surface work, run a PM pass during planning. Treat it as mandatory default behavior, not optional polish.
- For app, UI, and product-surface work, consider `agentic-user-journey-testing` for important user stories, but do not run it without explicit user approval.
- Use `second-opinion` for substantial saved implementation plans, and for unusually hard, creative, high-risk, or architecture-heavy specs when an independent external review could improve the artifact. Prefer a different available coding harness for that review, such as Codex asking Claude Code or Claude Code asking Codex. If no different harness is available, the same harness is fine; the second opinion is still mandatory for matching artifacts.
- Refactor code when a file passes 1200 lines. Do not normalize oversized files as the default end state.
- Use user stories in specs and plans when they clarify behavior or value.
- Default UI work to `shadcn/ui` unless the user says otherwise.
- When designing UI from scratch, first inspect the available ShadCN Blocks at https://ui.shadcn.com/blocks for each screen, form, or major surface. Start from the closest matching block with `npx shadcn add <block-name>` or the block's source in https://github.com/shadcn-ui/ui, then edit it by adding, removing, or adapting controls. Do not invent a fresh layout before doing this block-selection pass.
- Before adding any individual UI control, check whether `shadcn/ui` already provides a control that does what is needed. Use the available shadcn control first, then customize it, instead of hand-building a one-off control.
- Treat desktop and mobile responsiveness as first-class from the beginning.
- Prefer explicit routing unless the framework strongly defaults to file-based routes.
- For React apps, use `building-react-apps` for state managers, explicit transitions, routing, refs, imports, package-manager defaults, and frontend configuration defaults.
- For React apps with server state, optimistic UI, caches, polling, SSE/WebSocket streams, background jobs, persistence, or client/server synchronization, use `client-server-state-invariants` during planning and verification.
- For React or Next.js slowness, root-load, compile-time, SSR/hydration, bundle, import-bloat, or UI dependency cleanup work, use `optimizing-react-next-apps`.
- Prefer strong instrumentation and auditability for backend behavior.
- When a project has backend or agent workflows, prefer a fully instrumented control plane: persist meaningful events, tool calls, actions, results, errors, and state transitions, and expose them through a CLI or other scriptable interface so the full system can be inspected and tested without the UI.
- Use `instrumenting-control-planes` when building, planning, reviewing, or debugging backend decisions, agent workflows, recovery paths, retries, deletes, long-running jobs, SSE/WebSocket streams, or user-visible failures.
- Use `learning-from-bugs` after diagnosing or fixing meaningful architecture, storage, memory, persistence, control-plane, or system-level bugs so reusable lessons become durable.
- Do not default to silent, masked, or over-abstracted errors.
- When a project has a frontend, prefer surfacing full backend error details and stack traces to the frontend so failures stay visible, debuggable, and testable end-to-end.
- Treat persistence of settings and preferences as explicit design work.
- For every meaningful UI setting, define whether it persists, where it is stored, how it is read and written, who owns it, and how reset, sync, migration, and testing are handled.

See `docs/ultrapowers-defaults.md` for the canonical fork defaults.

## Skill Priority

1. Process skills first
2. Implementation skills second

Examples:

- "Make this button blue" -> inspect the relevant file, make the small edit, do targeted verification
- "Update this prompt sentence" -> edit the prompt directly and verify the final text
- "Build a feature" -> `brainstorming` with a PM pass first, then `writing-plans`, then execution; consider approval-gated `agentic-user-journey-testing` for app workflows
- "Fix this bug" -> `systematic-debugging`, then the relevant implementation skill; if the root cause is meaningful or systemic, finish with `learning-from-bugs`
- "Review this change" -> `requesting-code-review`

## Examples Of User Override

- If a task feels risky and the user did not ask for extra repository isolation, keep working in the current repository unless the user explicitly instructs otherwise.
- If a stack supports file-based routing but the user says not to use it, choose an explicit routing approach instead.
- If a framework strongly defaults to file-based routing, such as Next.js App Router, use the framework-native routing model unless there is a good reason not to.
- If a frontend skill suggests `shadcn/ui` but the user wants another design system, follow the user.

## Red Flags

- "I need a whole workflow for this tiny edit" -> no. Use the smallest responsible process.
- "This is simple, so I need the whole process anyway" -> no. Tiny mechanical edits should stay tiny.
- "I'll create extra repository isolation just to be safe" -> forbidden unless the user clearly asked for it.
- "I already know the skill" -> read the current version before relying on it

exec
/bin/zsh -lc "sed -n '1,260p' /Users/masterman/.agents/skills/second-opinion/SKILL.md" in /Users/masterman/NLP/omniharness
 succeeded in 0ms:
---
name: second-opinion
description: Use when writing or hardening substantial specs, implementation plans, architecture plans, design plans, or unusually hard creative decisions before execution
---

# Second Opinion

Use an external headless coding harness as a persistent reviewer while shaping substantial plans and specs.

## When To Use

Use this skill for:

- any saved implementation plan produced through `writing-plans` (mandatory),
- substantial specs where ambiguity, architecture, product scope, or implementation risk remains,
- unusually hard or creative design decisions where another independent pass could improve the result.

Skip it for tiny mechanical edits, obvious one-task changes, or short plans that are not being saved as durable execution artifacts.

## Core Rule

Run the second opinion through a separate reviewer session. Prefer a different available coding harness from the one currently writing the plan or spec because cross-harness review catches more blind spots than asking the same agent family to review its own artifact.

Different harnesses are preferred, not required. The second opinion itself is required for matching artifacts. If no different harness is available, using the same harness in a separate headless/session context is fine.

Preferred pairings:

- Codex asks Claude Code when `claude` is available.
- Claude Code asks Codex CLI when `codex` is available.
- Gemini asks Codex or Claude Code when either is available.
- OpenCode asks Codex or Claude Code when either is available.
- Other harnesses ask the best available different coding harness.

If the preferred different harness is missing, use any other installed headless coding CLI (`gemini`, `opencode`, etc.) before falling back to the same harness. Same-harness review is acceptable when no different headless reviewer is available; say that explicitly and continue with the required second opinion.

Do not substitute an in-process self-review, browser chat, or a non-coding assistant unless the user explicitly asks for that. The point is a separate process with its own model, tool defaults, and context.

## Session Protocol

1. Identify the current harness.
2. Check for a different installed headless coding CLI, starting with the preferred pairing above.
3. Discover that reviewer's documented headless and resume flags with `--help` if needed.
4. Start one persistent reviewer session for the plan/spec artifact when the reviewer supports resumable sessions.
5. Run the first review in headless mode and capture the session id or thread handle when available.
6. For later passes, resume that same reviewer session instead of starting fresh when possible.
7. Give the reviewer the artifact path, relevant user goal, constraints, and a focused review prompt.
8. Ask the reviewer not to edit files.
9. Incorporate useful feedback into the plan/spec.
10. Ignore feedback that is wrong, out of scope, or inconsistent with user instructions.
11. Rerun the reviewer after material revisions.
12. Stop when the reviewer says the artifact is ready, or after five total review passes.

If five passes still leave concerns, proceed with the best available artifact. Do not keep looping.

## Harness Discovery

Use `command -v` or the platform equivalent to check for reviewer CLIs before choosing a fallback. Do not install a new harness just for a second opinion unless the user asks.

Typical checks:

```bash
command -v claude || true
command -v codex || true
command -v gemini || true
command -v opencode || true
```

Prefer read-only or plan-mode permissions for the reviewer. The reviewer should inspect and comment, not mutate files.

## Claude Code Pattern

For Claude Code, discover the current flags with `claude --help`. Common headless usage is:

```bash
claude -p "$(cat /tmp/second-opinion-prompt.txt)" > /tmp/second-opinion-pass-1.txt
```

If the installed Claude Code version exposes resume/session flags, use them for later passes. Otherwise, include the previous review summary and revised artifact path in the next headless prompt.

## Codex CLI Pattern

For Codex, prefer a non-ephemeral session so it can be resumed:

```bash
codex exec -C "$PWD" --sandbox read-only --json -o /tmp/second-opinion-pass-1.txt -
```

Capture the session id from the JSONL event stream when available. Resume the same reviewer:

```bash
codex exec resume "$SESSION_ID" -o /tmp/second-opinion-pass-N.txt -
```

If the CLI version exposes a different headless/resume shape, follow that version's `--help` output.

##…8029 tokens truncated… Add

- Unit tests for server origin normalization and unsafe protocol rejection.
- Unit tests for `ServerDirectoryManager` persistence, migrations, generation ownership, last-selected behavior, and local-only removal.
- Unit tests for runtime-client request URL building, credentials mode, timeout/cancellation, auth/offline/incompatible classification, and error details.
- Unit tests for `useHomeQueries` query keys or extracted key builders to prove `serverId` is always present for runtime queries.
- Unit tests for mutation ownership helpers in `useHomeMutations.ts`: start on server A, switch to B, resolve A, assert B is not mutated.
- Unit tests for `EventStreamSnapshotCacheManager` proving server A cache cannot hydrate server B, and server-authoritative bootstrap cannot be demoted by same-server cache.
- Unit tests for `WorkerEntriesManager` proving same `workerId` on two servers has independent entries, in-flight requests, cache, and wake-up behavior.
- Lifecycle scenario with two real isolated servers:
  - add/select server A and server B,
  - verify bootstrap and `/api/events/log` source for each,
  - create or inspect a conversation on A,
  - switch to B and verify A data disappears or becomes clearly inactive,
  - reconnect A with `Last-Event-ID`,
  - simulate B offline and verify A remains usable,
  - cleanup all test conversations/artifacts on both servers.
- Existing lifecycle tests must keep passing: `pnpm test:lifecycle`.

### Candidate Agentic User Journey Tests

These require explicit user approval before running:

- **Two-server switching journey:** open the UI, add two local test servers, create a conversation on each, switch repeatedly, and confirm conversations, worker streams, and composer drafts do not bleed across servers.
- **Auth boundary journey:** connect to one unlocked server and one password-protected server, verify login state and errors are scoped to the protected server.
- **Offline recovery journey:** connect to two servers, stop one, verify status/error/retry behavior while the other remains usable, restart the stopped server, and verify reconnect/resync.
- **Mobile selector journey:** verify server selection and add/edit flows fit on mobile without hiding the active conversation state.

### `.gitignore` Coverage

Before implementation, verify `.gitignore` covers:

- `node_modules/`, package-manager caches, `.next/`, coverage, logs, temp files, and lifecycle harness temp roots.
- No server-directory secret files are introduced.
- No generated screenshots, Playwright reports, or lifecycle run artifacts are committed unless explicitly requested.

## Implementation Checklist

- [ ] Audit touched file sizes and split before adding major logic.
  - `src/app/home/HomeApp.tsx` is already over 1200 lines; extract server-directory bootstrap/lifecycle glue before adding the new surface.
  - `src/app/home/useHomeMutations.ts` is close to 1200 lines; extract server-aware request helpers and ownership checks rather than growing inline mutation bodies.
  - Verification: `wc -l` confirms new multi-server logic lives in dedicated modules and no touched file newly exceeds 1200 lines without a planned split.

- [ ] Add the runtime server descriptor to bootstrap.
  - Modify `src/runtime/bootstrap.ts` and `src/app/home/bootstrap.server.ts`.
  - Include serving origin, stable local `serverId`, display name, runtime version/capability fields, and initial data ownership.
  - Verification: unit test or route test proves `/api/runtime/bootstrap` and SSR bootstrap include the descriptor and preserve existing fields.

- [ ] Implement server directory storage and manager with TDD.
  - Create `src/app/home/server-directory-storage.ts` and `src/app/home/ServerDirectoryManager.ts`.
  - Cover add, update, remove, select, generation increment, last selected server, migration, invalid records, and bootstrap auto-registration.
  - Verification: `pnpm test -- tests/app/home/ServerDirectoryManager.test.ts`.

- [ ] Implement the selected-server runtime client with TDD.
  - Create `src/app/home/runtime-client.ts` and `src/app/home/server-health.ts`.
  - Enforce URL normalization, allowed protocols, credentials, timeouts, aborts, error normalization, and ownership-token checks.
  - Verification: `pnpm test -- tests/app/home/runtime-client.test.ts`.

- [ ] Scope event snapshot cache by server.
  - Modify `src/app/home/EventStreamSnapshotCacheManager.ts` and `src/app/home/EventStreamStateManager.ts`.
  - Preserve server-authoritative bootstrap behavior and existing scoped completeness merges.
  - Verification: cache tests prove no cross-server hydration and no demotion of `snapshotSource: "server"`.

- [ ] Scope worker entry state and cache by server.
  - Modify `src/app/home/WorkerEntriesManager.ts`.
  - Keep the contiguous-prefix invariant, wake-up semantics, bounded cache, and `?afterSeq=`/tail/backfill flows.
  - Verification: worker manager tests prove same `workerId` on two servers stays isolated and stale fetches cannot mutate the active server stream.

- [ ] Route live event connections through the runtime client.
  - Modify `src/app/home/LiveEventConnectionManager.ts` and `src/app/home/useHomeLifecycle.ts`.
  - Carry `serverId + generation`, per-server `lastEventId`, snapshot anchor headers, fallback polling, and resync behavior.
  - Verification: unit tests for URL construction/ownership plus lifecycle SSE scenario for reconnect/resync.

- [ ] Make query keys and bootstrap hydration server-aware.
  - Modify `src/app/home/HomeApp.tsx`, `src/app/home/useHomeQueries.ts`, and related extracted helpers.
  - Prime TanStack Query under `serverId` keys and clear or ignore previous-server queries on selection change without globally discarding useful caches.
  - Verification: tests or focused assertions prove `auth-session`, `settings`, `worker-catalog`, and `project-files` cannot be read across servers.

- [ ] Make mutations server-aware and stale-safe.
  - Modify `src/app/home/useHomeMutations.ts`, `src/app/home/useQueuedMessageMutations.ts` if needed, and supporting action helpers.
  - At mutation start, capture `serverId`, generation, selected run, composer draft, and attachments identity. On success/error, mutate UI only if ownership still matches.
  - Verification: stale mutation tests for create, send, stop, delete/archive, settings save, and queued-message actions where applicable.

- [ ] Build the server selector and connection dialogs.
  - Create `src/components/home/ServerSelector.tsx` and `src/components/home/ServerConnectionDialog.tsx`.
  - Modify `src/components/home/HomeHeader.tsx` and mobile navigation wiring.
  - Use existing shadcn/ui controls; use lucide icons where appropriate; keep subscriptions narrow.
  - Verification: component tests where practical and Playwright screenshot/journey only with user approval.

- [ ] Add the servers settings surface.
  - Create `src/components/settings/ServersSettingsPanel.tsx`.
  - Modify `src/components/home/SettingsDialog.tsx` or the active settings composition to include it.
  - Use compact rows, explicit save/remove/retry behavior, and no repeated headings or decorative nested cards.
  - Verification: i18n tests/static checks plus manual UI check if running browser verification is approved.

- [ ] Add all i18n resources.
  - Modify every `shared/locales/*.json` file in the same change.
  - Add stable dotted keys for selector labels, statuses, validation, auth/offline/incompatible errors, add/edit/remove actions, retry, and settings copy.
  - Verification: JSON parse check and existing i18n/lint checks.

- [ ] Preserve error transparency with server context.
  - Modify `src/lib/app-errors.ts` and runtime-client error handling.
  - Preserve target server stable error codes, status, details, source/action, `serverId`, and origin.
  - Verification: tests cover server JSON error payloads, network failures, CORS-like fetch failures, auth failures, and malformed payloads.

- [ ] Add lifecycle coverage for two real servers.
  - Create `tests/lifecycle/scenarios/multi-server-interface.test.ts`.
  - Extend lifecycle harness helpers only as needed to launch two isolated servers and clean up conversations/artifacts on both.
  - Assert on HTTP/SSE/event-log behavior rather than browser DOM for control-plane correctness.
  - Verification: targeted lifecycle scenario passes and cleanup leaves no test conversations/artifacts behind.

- [ ] Run deterministic verification.
  - `pnpm test -- tests/app/home/ServerDirectoryManager.test.ts tests/app/home/runtime-client.test.ts tests/app/home/multi-server-cache.test.ts`
  - `pnpm test:lifecycle -- tests/lifecycle/scenarios/multi-server-interface.test.ts` if the script accepts file filtering; otherwise run the full `pnpm test:lifecycle`.
  - `pnpm lint`
  - `pnpm build`

- [ ] Run approval-gated browser/user-journey verification if approved.
  - Proposed journeys: two-server switching, auth boundary, offline recovery, and mobile selector.
  - Use the already-running app process when possible and the normal local URL `http://localhost:3035`.
  - Clean up all test conversations and persisted artifacts before finishing.

## Self-Review

- Every runtime-owned query, mutation, cache, stream, and worker-entry fetch has a `serverId` owner token.
- Cached data can pre-render only for the same server and cannot satisfy authoritative load gates across servers.
- Late async responses and mutation results cannot mutate the active UI after server selection changes.
- Worker content remains in the unified worker stream; no parallel transcript store is introduced.
- Server-side decisions remain observable through target server named events.
- Auth, offline, incompatible, and degraded states are visible and server-scoped.
- The plan does not require branches, worktrees, file deletion, mocked servers, fake components, or fallback success.
- The checklist delivers the complete current milestone; future product ideas remain context only.

exec
/bin/zsh -lc "find src -maxdepth 4 -type f | sed -n '1,200p'" in /Users/masterman/NLP/omniharness
 succeeded in 0ms:
src/ui/OmniApp.tsx
src/ui/render-web.tsx
src/runtime-api/electron.ts
src/runtime-api/vscode.ts
src/runtime-api/types.ts
src/runtime-api/web.ts
src/runtime-api/provider.tsx
src/.DS_Store
src/app/home/SessionStateManager.ts
src/app/home/ProjectMemoryPanelManager.ts
src/app/home/recovery-utils.ts
src/app/home/HomeUiStateManager.ts
src/app/home/EventStreamStateManager.ts
src/app/home/sidebar-activity.ts
src/app/home/useRunSelectionEffects.ts
src/app/home/AppearancePreferencesManager.ts
src/app/home/supervisor-activity.ts
src/app/home/ComposerContainer.tsx
src/app/home/useQueuedMessageMutations.ts
src/app/home/GitWorkspaceManager.ts
src/app/home/LiveEventConnectionManager.ts
src/app/home/busy-message-behavior.ts
src/app/home/utils.ts
src/app/home/WorkerEntriesManager.ts
src/app/home/PlanningReviewPreferencesManager.ts
src/app/home/direct-control-activity.ts
src/app/home/ConversationTranscriptManager.ts
src/app/home/useHomeMutations.ts
src/app/home/types.ts
src/app/home/useHomeQueries.ts
src/app/home/bootstrap.server.ts
src/app/home/useFrozenRecentOrder.ts
src/app/home/useHomeLifecycle.ts
src/app/home/constants.ts
src/app/home/HomeApp.tsx
src/app/home/SettingsDraftManager.ts
src/app/home/useRunRecoveryState.ts
src/app/home/ConversationNotificationManager.ts
src/app/home/composer-keyboard.ts
src/app/home/useAppErrors.ts
src/app/home/useHomeViewModel.ts
src/app/home/useHomeLayoutController.ts
src/app/home/side-window-viewport.ts
src/app/home/EventStreamSnapshotCacheManager.ts
src/app/home/SideWindowManager.ts
src/app/home/PreflightConfirmationActionsManager.ts
src/app/home/upload-attachments.ts
src/app/home/useConversationActions.ts
src/app/home/ExternalSessionsPicker.tsx
src/app/home/direct-worker-stream-loading.ts
src/app/home/useComposerController.ts
src/app/home/SidebarWorkerActivityManager.ts
src/app/home/BusyMessageQueueManager.ts
src/app/home/useConversationExecutionStatus.ts
src/app/home/auto-resume-selection.ts
src/app/favicon.ico
src/app/fx-spike/page.tsx
src/app/fx/Fx.tsx
src/app/layout.tsx
src/app/api/llm-models/route.ts
src/app/api/settings/route.ts
src/app/api/external-sessions/route.ts
src/app/api/messages/route.ts
src/app/api/plans/route.ts
src/app/api/agents/route.ts
src/app/api/accounts/route.ts
src/app/api/conversations/route.ts
src/app/api/events/route.ts
src/app/api/attachments/route.ts
src/app/api/fs/route.ts
src/app/api/notifications/route.ts
src/app/api/git/route.ts
src/app/api/supervisor/route.ts
src/app/page.tsx
src/app/globals.css
src/app/fx.css
src/app/providers.tsx
src/runtime/types.ts
src/runtime/http/context.ts
src/runtime/http/adapters/next.ts
src/runtime/http/registry.ts
src/runtime/http/server.ts
src/runtime/http/routes/run-resume.ts
src/runtime/http/routes/run-answer.ts
src/runtime/http/routes/conversations.ts
src/runtime/http/routes/auth-pair-redeem.ts
src/runtime/http/routes/llm-models.ts
src/runtime/http/routes/auth-pair.ts
src/runtime/http/routes/runs.ts
src/runtime/http/routes/agent-detail.ts
src/runtime/http/routes/conversation-transcript.ts
src/runtime/http/routes/notifications.ts
src/runtime/http/routes/plans.ts
src/runtime/http/routes/messages.ts
src/runtime/http/routes/settings.ts
src/runtime/http/routes/planning.ts
src/runtime/http/routes/agents-catalog.ts
src/runtime/http/routes/auth-login.ts
src/runtime/http/routes/external-sessions.ts
src/runtime/http/routes/worker-entries.ts
src/runtime/http/routes/attachments.ts
src/runtime/http/routes/agents.ts
src/runtime/http/routes/auth-session.ts
src/runtime/http/routes/codex-auth-status.ts
src/runtime/http/routes/prewarm-worker.ts
src/runtime/http/routes/project-memory.ts
src/runtime/http/routes/conversation-messages.ts
src/runtime/http/routes/filesystem.ts
src/runtime/http/routes/auth-logout.ts
src/runtime/http/routes/events.ts
src/runtime/http/routes/supervisor.ts
src/runtime/http/routes/runtime-bootstrap.ts
src/runtime/http/routes/accounts.ts
src/runtime/http/routes/index.ts
src/runtime/http/routes/git.ts
src/runtime/http/routes/next-request.ts
src/runtime/http/routes/cookies.ts
src/runtime/http/routes/events-log.ts
src/runtime/index.ts
src/runtime/bootstrap.ts
src/server/settings/read.ts
src/server/settings/crypto.ts
src/server/external-sessions/running.ts
src/server/external-sessions/discovery.ts
src/server/app-root.ts
src/server/artifacts/stream-types.ts
src/server/artifacts/compaction.ts
src/server/artifacts/append-only-store.ts
src/server/artifacts/stream-index.ts
src/server/artifacts/stream-metadata.ts
src/server/artifacts/cleanup.ts
src/server/artifacts/project-root.ts
src/server/slow-probe.ts
src/server/plans/readiness-llm.ts
src/server/plans/readiness.ts
src/server/plans/parser.ts
src/server/plans/readiness-pipeline.ts
src/server/plans/checklist.ts
src/server/worker-launch-mode.ts
src/server/auth/pairing.ts
src/server/auth/password.ts
src/server/auth/session-state.ts
src/server/auth/session.ts
src/server/auth/guards.ts
src/server/auth/config.ts
src/server/auth/audit.ts
src/server/auth/rate-limit.ts
src/server/handoff/parser.ts
src/server/handoff/request.ts
src/server/handoff/render.ts
src/server/session-providers/omni-provider.ts
src/server/session-providers/session-records.ts
src/server/session-providers/process-store.ts
src/server/session-providers/capabilities.ts
src/server/session-providers/process-provider.ts
src/server/session-providers/types.ts
src/server/session-providers/registry.ts
src/server/projects/canonicalize.ts
src/server/projects/config.ts
src/server/worker-models.ts
src/server/planning/status.ts
src/server/planning/review-preferences.ts
src/server/planning/review-artifact-store.ts
src/server/planning/artifacts.ts
src/server/planning/refresh.ts
src/server/planning/review-agent-selection.ts
src/server/planning/review.ts
src/server/planning/promote.ts
src/server/planning/review-prompts.ts
src/server/bridge-client/index.ts
src/server/cli/runner.ts
src/server/cli/options.ts
src/server/permissions/index.ts
src/server/api-errors.ts
src/server/restart-control.ts
src/server/accounts/dto.ts
src/server/conversations/queued-message-records.ts
src/server/conversations/direct-run-status.ts
src/server/conversations/queued-message-interrupt.ts
src/server/conversations/modes.ts
src/server/conversations/queued-messages.ts
src/server/conversations/message-records.ts
src/server/conversations/worker-turn-gate.ts
src/server/conversations/send-message.ts
src/server/conversations/create.ts
src/server/conversations/sync.ts
src/server/prompts/conversation-title.md
src/server/prompts/planner.md
src/server/prompts/index.ts
src/server/prompts/supervisor.md
src/server/db/schema.ts
src/server/db/index.ts
src/server/dev/bridge-health.ts
src/server/dev/bridge-lock.ts
src/server/dev/managed-bridge.ts
src/server/error-format.ts
src/server/workers/ids.ts
src/server/workers/live-snapshots.ts
src/server/workers/stuck-worker-reaper.ts
src/server/workers/session-metadata.ts

exec
/bin/zsh -lc "find shared/locales -maxdepth 1 -type f -name '*.json' -print" in /Users/masterman/NLP/omniharness
 succeeded in 0ms:
shared/locales/ja.json
shared/locales/de.json
shared/locales/zh-CN.json
shared/locales/pt.json
shared/locales/en.json
shared/locales/it.json
shared/locales/fr.json
shared/locales/ko.json
shared/locales/es.json

2026-06-14T15:43:28.209856Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T15:43:28.222781Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:43:28.222787Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:43:28.223122Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:43:28.223127Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:43:28.223426Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:43:28.223429Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:43:28.223725Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:43:28.223729Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:43:28.224044Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:43:28.224047Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:43:28.224727Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:43:28.224731Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:43:28.560493Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T15:43:28.573522Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T15:43:28.573554Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json

````

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:43:35.725Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:43:35.725Z

The reviewer is running in a separate Codex CLI session now. It had to use the same harness because `baton`, Claude, Gemini, and OpenCode were not available in this environment.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:43:36.457Z","phase":null} -->
## Tool call: write_stdin · 2026-06-14T15:43:36.457Z

```json
{
  "session_id": 17286,
  "chars": "",
  "yield_time_ms": 30000,
  "max_output_tokens": 40000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:44:06.462Z","phase":null} -->
## Tool result: call_d1wcOfDkE5M4qz3Fhv65KKbL · 2026-06-14T15:44:06.462Z

```text
Chunk ID: f12f31
Wall time: 30.0030 seconds
Process running with session ID 17286
Original token count: 2107
Output:
codex
The plan is substantial and already contains a lot of the right guardrails. I’m going to run the required separate reviewer pass through the available Codex CLI if it works under read-only constraints, then I’ll reconcile that with my own file-level review.
exec
/bin/zsh -lc '/Applications/Codex.app/Contents/Resources/codex exec --help' in /Users/masterman/NLP/omniharness
 succeeded in 0ms:
Run Codex non-interactively

Usage: codex exec [OPTIONS] [PROMPT]
       codex exec [OPTIONS] <COMMAND> [ARGS]

Commands:
  resume  Resume a previous session by id or pick the most recent with --last
  review  Run a code review against the current repository
  help    Print this message or the help of the given subcommand(s)

Arguments:
  [PROMPT]
          Initial instructions for the agent. If not provided as an argument (or if `-` is used),
          instructions are read from stdin. If stdin is piped and a prompt is also provided, stdin
          is appended as a `<stdin>` block

Options:
  -c, --config <key=value>
          Override a configuration value that would otherwise be loaded from `~/.codex/config.toml`.
          Use a dotted path (`foo.bar.baz`) to override nested values. The `value` portion is parsed
          as TOML. If it fails to parse as TOML, the raw string is used as a literal.
          
          Examples: - `-c model="o3"` - `-c 'sandbox_permissions=["disk-full-read-access"]'` - `-c
          shell_environment_policy.inherit=all`

      --enable <FEATURE>
          Enable a feature (repeatable). Equivalent to `-c features.<name>=true`

      --disable <FEATURE>
          Disable a feature (repeatable). Equivalent to `-c features.<name>=false`

      --strict-config
          Error out when config.toml contains fields that are not recognized by this version of
          Codex

  -i, --image <FILE>...
          Optional image(s) to attach to the initial prompt

  -m, --model <MODEL>
          Model the agent should use

      --oss
          Use open-source provider

      --local-provider <OSS_PROVIDER>
          Specify which local provider to use (lmstudio or ollama). If not specified with --oss,
          will use config default or show selection

  -p, --profile <CONFIG_PROFILE_V2>
          Layer $CODEX_HOME/<name>.config.toml on top of the base user config

  -s, --sandbox <SANDBOX_MODE>
          Select the sandbox policy to use when executing model-generated shell commands
          
          [possible values: read-only, workspace-write, danger-full-access]

      --dangerously-bypass-approvals-and-sandbox
          Skip all confirmation prompts and execute commands without sandboxing. EXTREMELY
          DANGEROUS. Intended solely for running in environments that are externally sandboxed

      --dangerously-bypass-hook-trust
          Run enabled hooks without requiring persisted hook trust for this invocation. DANGEROUS.
          Intended only for automation that already vets hook sources

  -C, --cd <DIR>
          Tell the agent to use the specified directory as its working root

      --add-dir <DIR>
          Additional directories that should be writable alongside the primary workspace

      --skip-git-repo-check
          Allow running Codex outside a Git repository

      --ephemeral
          Run without persisting session files to disk

      --ignore-user-config
          Do not load `$CODEX_HOME/config.toml`; auth still uses `CODEX_HOME`

      --ignore-rules
          Do not load user or project execpolicy `.rules` files

      --output-schema <FILE>
          Path to a JSON Schema file describing the model's final response shape

      --color <COLOR>
          Specifies color settings for use in the output
          
          [default: auto]
          [possible values: always, never, auto]

      --json
          Print events to stdout as JSONL

  -o, --output-last-message <FILE>
          Specifies file where the last message from the agent should be written

  -h, --help
          Print help (see a summary with '-h')

  -V, --version
          Print version

2026-06-14T15:43:35.916358Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T15:43:35.929679Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:43:35.929687Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:43:35.929956Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:43:35.929961Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:43:35.930230Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:43:35.930237Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:43:35.930499Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:43:35.930503Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:43:35.930820Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:43:35.930824Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:43:35.931504Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:43:35.931507Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:43:36.261560Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T15:43:36.268999Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T15:43:36.269030Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
codex
Only the same Codex CLI is available as a headless reviewer; no Claude/Gemini/OpenCode CLI was found. I’m using it as a separate ephemeral read-only session, which is the available fallback for this review gate.
exec
/bin/zsh -lc "/Applications/Codex.app/Contents/Resources/codex exec -C /Users/masterman/NLP/omniharness -s read-only --ephemeral --json - <<'PROMPT'
You are my second-opinion planning reviewer. Review the artifact below without editing files.

Artifact: /Users/masterman/NLP/omniharness/docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md
User goal: support multiple OmniHarness servers inside the same running app by turning the interface into a standalone thing that can connect to multiple servers.
Context and constraints:
- no branches, no worktrees, no file deletion
- preserve unified worker stream
- all frontend strings through shared/locales and t()
- manager-owned React state
- server decisions through named events
- lifecycle tests via HTTP/SSE

Please judge whether this plan/spec is ready to use.

Look for:
- missing requirements or user instructions,
- vague tasks, placeholders, fake components, mocks, or fallback behavior posing as final work,
- scope creep or non-obvious product decisions that need user confirmation,
- missing file map, ownership, state, persistence, instrumentation, error, or verification details,
- sequencing problems or tasks that are too large to execute safely,
- test gaps and unclear acceptance criteria.

Return:
1. Verdict: READY or HARDEN
2. Highest-impact findings, with concrete fixes
3. Anything you would deliberately leave alone
PROMPT" in /Users/masterman/NLP/omniharness

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:44:10.953Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:44:10.953Z

The fallback reviewer is overdoing its own process and has started a nested read-only review. I’m letting it finish because it should still return the readiness findings we need, but I’ll keep the final artifact clean and only apply concrete useful feedback.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:44:11.414Z","phase":null} -->
## Tool call: write_stdin · 2026-06-14T15:44:11.414Z

```json
{
  "session_id": 17286,
  "chars": "",
  "yield_time_ms": 30000,
  "max_output_tokens": 40000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:44:41.420Z","phase":null} -->
## Tool result: call_Bhzg7HsgnWU5KZxyY9OTr8rL · 2026-06-14T15:44:41.420Z

```text
Chunk ID: 04a64f
Wall time: 30.0028 seconds
Process running with session ID 17286
Original token count: 11530
Output:
Total output lines: 593

2026-06-14T15:44:21.061456Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T15:44:21.073996Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:44:21.074002Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:44:21.074313Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:44:21.074318Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:44:21.074646Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:44:21.074650Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:44:21.074921Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:44:21.074927Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:44:21.075183Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:44:21.075187Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:44:21.075864Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:44:21.075869Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:44:21.432469Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T15:44:21.448221Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T15:44:21.448253Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
codex
The separate reviewer is still running and has started reading the artifact with line numbers. While that continues, I’m checking the actual repo structure around API routes and runtime registry so findings are grounded in current files rather than just plan wording.
exec
/bin/zsh -lc "sed -n '1,220p' src/runtime/http/registry.ts" in /Users/masterman/NLP/omniharness
 succeeded in 0ms:
import type { RuntimeSurface } from "@/server/events/named-events";

export type RuntimeErrorPayload = {
  code: string;
  message: string;
  details?: unknown;
  surface?: RuntimeSurface | string;
  runId?: string;
  workerId?: string;
  conversationId?: string;
};

export interface OmniRequestContext {
  surface: RuntimeSurface | string;
  runtime?: unknown;
  params?: Record<string, string>;
}

export type OmniHttpHandler = (
  request: Request,
  context: OmniRequestContext,
) => Promise<Response> | Response;

type Method = string;

function normalizeMethod(method: string): Method {
  return method.trim().toUpperCase();
}

function routeKey(method: string, pathname: string) {
  return `${normalizeMethod(method)} ${pathname}`;
}

function jsonError(status: number, error: RuntimeErrorPayload) {
  return Response.json({ error }, { status });
}

export class OmniHttpRegistry {
  private readonly routes = new Map<string, OmniHttpHandler>();
  private readonly dynamicRoutes: Array<{
    method: Method;
    pathname: string;
    parts: string[];
    handler: OmniHttpHandler;
  }> = [];

  route(method: string, pathname: string, handler: OmniHttpHandler) {
    const normalizedMethod = normalizeMethod(method);
    if (pathname.split("/").some((part) => part.startsWith(":"))) {
      this.dynamicRoutes.push({
        method: normalizedMethod,
        pathname,
        parts: pathname.split("/").filter(Boolean),
        handler,
      });
      return this;
    }

    this.routes.set(routeKey(normalizedMethod, pathname), handler);
    return this;
  }

  private matchDynamicRoute(method: Method, pathname: string) {
    const actualParts = pathname.split("/").filter(Boolean);
    for (const route of this.dynamicRoutes) {
      if (route.method !== method || route.parts.length !== actualParts.length) {
        continue;
      }
      const params: Record<string, string> = {};
      let matched = true;
      for (let index = 0; index < route.parts.length; index += 1) {
        const expected = route.parts[index] ?? "";
        const actual = actualParts[index] ?? "";
        if (expected.startsWith(":")) {
          params[expected.slice(1)] = decodeURIComponent(actual);
          continue;
        }
        if (expected !== actual) {
          matched = false;
          break;
        }
      }
      if (matched) {
        return { handler: route.handler, params };
      }
    }
    return null;
  }

  async handle(request: Request, context: OmniRequestContext): Promise<Response> {
    const url = new URL(request.url);
    const method = normalizeMethod(request.method);
    const key = routeKey(method, url.pathname);
    const exactHandler = this.routes.get(key);
    const dynamicMatch = exactHandler ? null : this.matchDynamicRoute(method, url.pathname);
    const handler = exactHandler ?? dynamicMatch?.handler;
    if (!handler) {
      return jsonError(404, {
        code: "route.not_found",
        message: `No runtime route registered for ${method} ${url.pathname}.`,
        surface: context.surface,
      });
    }

    try {
      return await handler(request, dynamicMatch ? {
        ...context,
        params: {
          ...context.params,
          ...dynamicMatch.params,
        },
      } : context);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return jsonError(500, {
        code: "route.failed",
        message,
        surface: context.surface,
      });
    }
  }
}

export function createOmniHttpRegistry() {
  return new OmniHttpRegistry();
}

exec
/bin/zsh -lc "sed -n '1,220p' src/runtime/bootstrap.ts" in /Users/masterman/NLP/omniharness
 succeeded in 0ms:
import { buildAuthSessionState } from "@/server/auth/session-state";
import { buildPersistedEventPayload } from "@/server/events/persisted-snapshot";
import { getEventCursor } from "@/server/events/named-events";
import { readSettingsState } from "@/server/settings/read";
import type { EventStreamState, SettingsResponse, AuthSessionResponse } from "@/app/home/types";

export type HomeBootstrapPayload = {
  id: string;
  route: {
    selectedRunId: string | null;
    draftProjectPath: string | null;
    pairTokenFromUrl: string | null;
  };
  initialEventState: EventStreamState | null;
  initialLastEventId: string;
  initialQueries: {
    session: AuthSessionResponse | null;
    settings: SettingsResponse | null;
  };
  features: {
    unifiedWorkerStream: boolean;
  };
};

type PageSearchParams = Record<string, string | string[] | undefined>;

export type RuntimeBootstrapOptions = {
  searchParams?: PageSearchParams;
  requestHeaders: Headers;
  includeInitialData?: boolean;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function normalizeParam(value: string | string[] | undefined) {
  return firstParam(value).trim() || null;
}

function buildRequestUrl(searchParams: PageSearchParams, requestHeaders: Headers) {
  const host = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim()
    || requestHeaders.get("host")?.trim()
    || "localhost";
  const protocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
  const url = new URL(`${protocol}://${host}/`);

  for (const [key, rawValue] of Object.entries(searchParams)) {
    const values = Array.isArray(rawValue) ? rawValue : [rawValue];
    for (const value of values) {
      if (value != null) {
        url.searchParams.append(key, value);
      }
    }
  }

  return url;
}

export async function buildRuntimeBootstrap({
  searchParams = {},
  requestHeaders,
  includeInitialData = true,
}: RuntimeBootstrapOptions): Promise<HomeBootstrapPayload> {
  const requestUrl = buildRequestUrl(searchParams, requestHeaders);
  const selectedRunId = normalizeParam(searchParams.run);
  const draftProjectPath = normalizeParam(searchParams.project);
  const pairTokenFromUrl = normalizeParam(searchParams.pair);

  const session = await buildAuthSessionState({
    url: requestUrl.toString(),
    headers: requestHeaders,
  });
  const appUnlocked = Boolean(session && (!session.enabled || session.authenticated));

  const [settings, initialEventState] = appUnlocked && includeInitialData
    ? await Promise.all([
        readSettingsState(),
        buildPersistedEventPayload({ selectedRunId }),
      ])
    : [null, null];

  return {
    id: JSON.stringify({
      builtAt: Date.now(),
      selectedRunId,
      draftProjectPath,
      pairTokenFromUrl,
      sessionAuthenticated: session?.authenticated ?? false,
      eventRunCount: initialEventState?.runs?.length ?? 0,
    }),
    route: {
      selectedRunId,
      draftProjectPath,
      pairTokenFromUrl,
    },
    initialEventState,
    initialLastEventId: String(getEventCursor()),
    initialQueries: {
      session,
      settings,
    },
    features: {
      // The unified worker stream is unconditionally enabled after the
      // Phase 5 cutover. The boolean is kept on the bootstrap shape so
      // older client/server pairs don't break during the rollout
      // window; future cleanup may drop it entirely.
      unifiedWorkerStream: true,
    },
  };
}

exec
/bin/zsh -lc "rg -n \"fetch\\(|/api/|EventSource|localStorage|queryKey|useQuery|useMutation|WorkerEntriesManager|LiveEventConnectionManager\" src/app/home src/components/home src/components/settings src/runtime src/runtime-api shared/locales/en.json" in /Users/masterman/NLP/omniharness
 succeeded in 0ms:
src/runtime-api/web.ts:6:  EventSourceImpl?: EventSourceConstructor;
src/runtime-api/web.ts:9:type RuntimeEventSourceEvent = {
src/runtime-api/web.ts:14:type RuntimeEventSource = {
src/runtime-api/web.ts:16:  addEventListener(type: string, listener: (event: RuntimeEventSourceEvent) => void): void;
src/runtime-api/web.ts:19:type EventSourceConstructor = new (url: string) => RuntimeEventSource;
src/runtime-api/web.ts:37:function parseEventData(event: RuntimeEventSourceEvent) {
src/runtime-api/web.ts:48:function normalizeStreamEvent(event: RuntimeEventSourceEvent) {
src/runtime-api/web.ts:84:  const EventSourceCtor = options.EventSourceImpl
src/runtime-api/web.ts:85:    ?? (typeof EventSource !== "undefined" ? EventSource : null);
src/runtime-api/web.ts:113:        return request(`/api/runtime/bootstrap${buildQuery({
src/runtime-api/web.ts:122:        if (!EventSourceCtor) {
src/runtime-api/web.ts:125:            message: "Runtime event streaming requires EventSource support.",
src/runtime-api/web.ts:131:        const source = new EventSourceCtor(joinUrl(baseUrl, `/api/events${buildQuery({
src/runtime-api/web.ts:135:        const emit = (event: RuntimeEventSourceEvent) => {
src/runtime-api/web.ts:156:        return request(`/api/events/log${buildQuery({ since: input.since, runId: input.runId })}`, { method: "GET" });
src/runtime-api/web.ts:161:        return post("/api/conversations", input);
src/runtime-api/web.ts:164:        return post("/api/messages", input);
src/runtime-api/web.ts:169:        return request(`/api/workers/${encodeURIComponent(input.workerId)}/entries${buildQuery({
src/runtime-api/web.ts:177:        return request("/api/settings", { method: "GET" });
src/runtime-api/web.ts:180:        return post("/api/settings", input);
src/components/settings/ModelProfileForm.tsx:129:      fetch("/api/codex-auth/status")
src/runtime-api/vscode.ts:158:        return request("GET", `/api/runtime/bootstrap${buildQuery({
src/runtime-api/vscode.ts:205:        return request("GET", `/api/events/log${buildQuery({ since: input.since, runId: input.runId })}`);
src/runtime-api/vscode.ts:210:        return post("/api/conversations", input);
src/runtime-api/vscode.ts:213:        return post("/api/messages", input);
src/runtime-api/vscode.ts:218:        return request("GET", `/api/workers/${encodeURIComponent(input.workerId)}/entries${buildQuery({
src/runtime-api/vscode.ts:226:        return request("GET", "/api/settings");
src/runtime-api/vscode.ts:229:        return post("/api/settings", input);
src/components/home/FileViewerPanel.tsx:4:import { useQuery } from "@tanstack/react-query";
src/components/home/FileViewerPanel.tsx:40:  const fileQuery = useQuery<ProjectFileContentResponse>({
src/components/home/FileViewerPanel.tsx:41:    queryKey: ["project-file", root, relativePath],
src/components/home/FileViewerPanel.tsx:43:      `/api/fs/files?root=${encodeURIComponent(root)}&file=${encodeURIComponent(relativePath)}`,
src/components/home/FileViewerPanel.tsx:110:                  void fileQuery.refetch();
src/runtime/http/server.ts:103:  if (pathname.startsWith("/api/")) {
src/app/home/BusyMessageQueueManager.ts:11:  // UI only — server queue rows from /api/events remain authoritative.
src/components/home/ConversationMain.tsx:34:import { useWorkerStream } from "@/app/home/WorkerEntriesManager";
src/runtime/http/routes/worker-entries.ts:2: * GET /api/workers/:workerId/entries?afterSeq=N
src/runtime/http/routes/worker-entries.ts:59:  // auth surface consistent with /api/runs/[id], which gates by run visibility.
src/runtime/http/routes/worker-entries.ts:73:  const probe = startSlowProbe(`GET /api/workers/${workerId}/entries`);
src/components/home/UserInputMessage.tsx:69:      ? `/api/attachments?path=${encodeURIComponent(attachment.storagePath)}&mimeType=${encodeURIComponent(attachment.mimeType)}`
src/app/home/direct-worker-stream-loading.ts:1:import type { WorkerStreamState } from "./WorkerEntriesManager";
src/app/home/direct-worker-stream-loading.ts:2:import { coalesceWorkerEntriesById } from "./WorkerEntriesManager";
src/runtime/http/routes/agents-catalog.ts:87:    return await fetch(doctorUrl, { signal: controller.signal });
src/app/home/useHomeMutations.ts:4:import { useMutation } from "@tanstack/react-query";
src/app/home/useHomeMutations.ts:354:  const loginMutation = useMutation({
src/app/home/useHomeMutations.ts:355:    mutationFn: async (password: string) => requestJson<{ ok: true }>("/api/auth/login", {
src/app/home/useHomeMutations.ts:365:      await sessionQueryRefetch();
src/app/home/useHomeMutations.ts:372:  const logoutMutation = useMutation({
src/app/home/useHomeMutations.ts:373:    mutationFn: async () => requestJson<{ ok: true }>("/api/auth/logout", {
src/app/home/useHomeMutations.ts:389:  const redeemPairMutation = useMutation({
src/app/home/useHomeMutations.ts:390:    mutationFn: async (pairToken: string) => requestJson<{ ok: true; targetPath: string }>("/api/auth/pair/redeem", {
src/app/home/useHomeMutations.ts:407:  const saveSettings = useMutation({
src/app/home/useHomeMutations.ts:410:      await requestJson<{ ok: true }>("/api/settings", {
src/app/home/useHomeMutations.ts:428:  const commitWorkflowSettings = useMutation({
src/app/home/useHomeMutations.ts:430:      await requestJson<{ ok: true }>("/api/settings", {
src/app/home/useHomeMutations.ts:456:  const renameRun = useMutation({
src/app/home/useHomeMutations.ts:457:    mutationFn: async ({ runId, title }: { runId: string; title: string }) => requestJson(`/api/runs/${runId}`, {
src/app/home/useHomeMutations.ts:478:  const deleteRun = useMutation({
src/app/home/useHomeMutations.ts:510:    mutationFn: async ({ runId }: { runId: string }) => requestJson(`/api/runs/${runId}`, {
src/app/home/useHomeMutations.ts:539:  const archiveRun = useMutation({
src/app/home/useHomeMutations.ts:571:    mutationFn: async ({ runId }: { runId: string }) => requestJson(`/api/runs/${runId}`, {
src/app/home/useHomeMutations.ts:602:  const recoverRun = useMutation({
src/app/home/useHomeMutations.ts:609:    }) => requestJson<{ runId?: string }>(`/api/runs/${runId}`, {
src/app/home/useHomeMutations.ts:645:  const resumeRunRecovery = useMutation({
src/app/home/useHomeMutations.ts:646:    mutationFn: async ({ runId }: { runId: string }) => requestJson<{ ok: true; runId: string; recovery?: unknown }>(`/api/runs/${runId}/resume`, {
src/app/home/useHomeMutations.ts:654:  const runCommand = useMutation({
src/app/home/useHomeMutations.ts:666:      return requestJson<{ runId?: string } & CreatedConversationSnapshot>("/api/conversations", {
src/app/home/useHomeMutations.ts:773:  const sendConversationMessage = useMutation({
src/app/home/useHomeMutations.ts:794:      }>(`/api/conversations/${payload.runId}/messages`, {
src/app/home/useHomeMutations.ts:846:  const autoCommitChat = useMutation({
src/app/home/useHomeMutations.ts:847:    mutationFn: async ({ runId, action }: { runId: string; action: ManualCommitAction }) => requestJson<{ ok: true; message?: MessageRecord }>(`/api/conversations/${runId}/messages`, {
src/app/home/useHomeMutations.ts:869:  const autoCommitProject = useMutation({
src/app/home/useHomeMutations.ts:878:      return requestJson<{ runId?: string } & CreatedConversationSnapshot>("/api/conversations", {
src/app/home/useHomeMutations.ts:929:  const stopSupervisor = useMutation({
src/app/home/useHomeMutations.ts:935:    mutationFn: async ({ runId }: { runId: string }) => requestJson<{ ok: true }>(`/api/runs/${runId}`, {
src/app/home/useHomeMutations.ts:948:  const stopWorker = useMutation({
src/app/home/useHomeMutations.ts:954:    mutationFn: async ({ runId, workerId }: { runId: string; workerId: string }) => requestJson<{ ok: true }>(`/api/runs/${runId}`, {
src/app/home/useHomeMutations.ts:967:  const stopWorkerTerminalProcess = useMutation({
src/app/home/useHomeMutations.ts:972:    }) => requestJson<{ ok: true }>(`/api/runs/${runId}`, {
src/app/home/useHomeMutations.ts:987:  const promotePlanningConversation = useMutation({
src/app/home/useHomeMutations.ts:991:    mutationFn: async (payload: { runId: string; planPath: string | null }) => requestJson<{ runId?: string }>(`/api/planning/${payload.runId}/promote`, {
src/app/home/useHomeMutations.ts:1012:  const startPlanningReview = useMutation({
src/app/home/useHomeMutations.ts:1013:    mutationFn: async (payload: { runId: string; agentSelection: PlanningReviewAgentSelection; rounds: number }) => requestJson<{ ok: true; reviewRunId: string }>(`/api/planning/${payload.runId}/review`, {
src/app/home/useHomeMutations.ts:1032:        `/api/agents/${encodeURIComponent(normalizedWorkerId)}?history=full`,
src/app/home/ExternalSessionsPicker.tsx:5:import { useQuery, useMutation } from "@tanstack/react-query";
src/app/home/ExternalSessionsPicker.tsx:60:  const { data, isLoading, isError, refetch } = useQuery<ExternalSessionsResponse>({
src/app/home/ExternalSessionsPicker.tsx:61:    queryKey: ["external-sessions"],
src/app/home/ExternalSessionsPicker.tsx:62:    queryFn: () => requestJson<ExternalSessionsResponse>("/api/external-sessions", undefined, {
src/app/home/ExternalSessionsPicker.tsx:70:  const resumeMutation = useMutation({
src/app/home/ExternalSessionsPicker.tsx:72:      requestJson<{ runId: string }>("/api/conversations", {
src/app/home/ExternalSessionsPicker.tsx:138:              <Button variant="ghost" size="sm" onClick={() => refetch…1530 tokens truncated…otificationManager.ts:209:      const response = await fetch("/api/notifications", {
src/app/home/ConversationNotificationManager.ts:219:      const response = await fetch("/api/notifications", {
src/app/home/PlanningReviewPreferencesManager.ts:74:      await requestJson("/api/settings", {
src/app/home/useConversationActions.ts:94:      void fetch("/api/settings", {
src/app/home/useConversationActions.ts:106:    void fetch("/api/settings", {
src/runtime/http/routes/conversation-transcript.ts:2: * GET /api/conversations/:runId/transcript?afterToken=<base64-json>
src/runtime/http/routes/conversation-transcript.ts:7: * per-worker `/api/workers/:workerId/entries` endpoint only sees the
src/runtime/http/routes/conversation-transcript.ts:97:  const probe = startSlowProbe(`GET /api/conversations/${runId}/transcript`);
src/app/home/WorkerEntriesManager.ts:132:export interface WorkerEntriesManagerOptions {
src/app/home/WorkerEntriesManager.ts:145:  return `/api/workers/${encodeURIComponent(workerId)}/entries?afterSeq=${afterSeq}`;
src/app/home/WorkerEntriesManager.ts:149:  return `/api/workers/${encodeURIComponent(workerId)}/entries?limit=${limit}`;
src/app/home/WorkerEntriesManager.ts:153:  return `/api/workers/${encodeURIComponent(workerId)}/entries?beforeSeq=${beforeSeq}&limit=${limit}`;
src/app/home/WorkerEntriesManager.ts:189:  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
src/app/home/WorkerEntriesManager.ts:192:  return window.localStorage;
src/app/home/WorkerEntriesManager.ts:220:export class WorkerEntriesManager {
src/app/home/WorkerEntriesManager.ts:235:  constructor(options: WorkerEntriesManagerOptions = {}) {
src/app/home/WorkerEntriesManager.ts:329:    return this.fetch(workerId, state.latestContiguousSeq);
src/app/home/WorkerEntriesManager.ts:349:    return this.fetch(workerId, state.latestContiguousSeq);
src/app/home/WorkerEntriesManager.ts:368:    void this.fetch(args.workerId, state.latestContiguousSeq);
src/app/home/WorkerEntriesManager.ts:372:   * Durable cursor hints from `/api/events` snapshots. These recover
src/app/home/WorkerEntriesManager.ts:401:      void this.fetch(workerId, state.latestContiguousSeq);
src/app/home/WorkerEntriesManager.ts:414:      void this.fetch(workerId, state.latestContiguousSeq);
src/app/home/WorkerEntriesManager.ts:471:        void this.fetch(workerId, after.latestContiguousSeq);
src/app/home/WorkerEntriesManager.ts:541:  private fetch(workerId: string, afterSeq: number): Promise<void> {
src/app/home/WorkerEntriesManager.ts:578:        void this.fetch(workerId, after.latestContiguousSeq);
src/app/home/WorkerEntriesManager.ts:680:        // localStorage is a preview cache only; live server state remains authoritative.
src/app/home/WorkerEntriesManager.ts:703:      // localStorage is a preview cache only; live server state remains authoritative.
src/app/home/WorkerEntriesManager.ts:754:export const workerEntriesManager = new WorkerEntriesManager();
src/app/home/upload-attachments.ts:17:  const response = await requestJson<{ ok: true; attachments: ChatAttachment[] }>("/api/attachments", {
src/runtime/http/routes/events.ts:45:      fetch(url, { signal: controller.signal }),
src/runtime/http/routes/events.ts:396:  // on the /api/events snapshot. Clients fetch it via
src/runtime/http/routes/events.ts:397:  // /api/workers/:workerId/entries through `WorkerEntriesManager`. The
src/runtime/http/routes/events.ts:472:  // (per-worker JSONL, fetched via /api/workers/:workerId/entries). The
src/runtime/http/routes/events.ts:475:  // worker content via `WorkerEntriesManager` instead.
src/runtime/http/routes/events.ts:745:    ? startSlowProbe(`GET /api/events?snapshot=1${persistedOnly ? "&persisted=1" : ""}${url.searchParams.get("runId") ? `&runId=${url.searchParams.get("runId")}` : ""}`)
src/runtime/http/routes/events.ts:888:      // client to re-bootstrap from /api/events?snapshot=1.
src/app/home/HomeApp.tsx:530:  // POST /api/conversations race and leave the spinner up for seconds.
src/app/home/HomeApp.tsx:557:      if (window.localStorage.getItem(ONBOARDING_SEEN_STORAGE_KEY) === "1") return;
src/app/home/HomeApp.tsx:570:      window.localStorage.setItem(ONBOARDING_SEEN_STORAGE_KEY, "1");
src/app/home/HomeApp.tsx:755:    void fetch("/api/agents/prewarm-worker", {
src/app/home/HomeApp.tsx:1054:      window.localStorage.removeItem("omni-event-stream-snapshot-cache:v1");
src/app/home/HomeApp.tsx:1055:      window.localStorage.removeItem("omni-worker-entries-cache:v1");
src/runtime/http/routes/runs.ts:339:  const probe = startSlowProbe(`POST /api/runs/${context.params?.id ?? "?"}`);
src/app/home/LiveEventConnectionManager.ts:9:import { workerEntriesManager } from "./WorkerEntriesManager";
src/app/home/LiveEventConnectionManager.ts:23:interface LiveEventConnectionManagerOptions {
src/app/home/LiveEventConnectionManager.ts:26:  EventSourceConstructor?: typeof EventSource;
src/app/home/LiveEventConnectionManager.ts:102:  return `/api/events${runParam}${lastEventIdParam}`;
src/app/home/LiveEventConnectionManager.ts:107:  return `/api/events?snapshot=1&persisted=1${encodeRunParam(selectedRunId, "&")}${checksumParam}`;
src/app/home/LiveEventConnectionManager.ts:119:  const response = await fetch(input, init);
src/app/home/LiveEventConnectionManager.ts:130:export class LiveEventConnectionManager {
src/app/home/LiveEventConnectionManager.ts:132:  private readonly EventSourceConstructor: typeof EventSource;
src/app/home/LiveEventConnectionManager.ts:142:  private eventSource: EventSource | null = null;
src/app/home/LiveEventConnectionManager.ts:152:  constructor(options: LiveEventConnectionManagerOptions) {
src/app/home/LiveEventConnectionManager.ts:155:    this.EventSourceConstructor = options.EventSourceConstructor ?? EventSource;
src/app/home/LiveEventConnectionManager.ts:182:    this.openEventSource();
src/app/home/LiveEventConnectionManager.ts:188:  private openEventSource() {
src/app/home/LiveEventConnectionManager.ts:189:    this.eventSource = new this.EventSourceConstructor(buildEventStreamUrl(this.selectedRunId, this.lastEventId));
src/app/home/LiveEventConnectionManager.ts:198:    // /api/workers/:workerId/entries?afterSeq=. See
src/app/home/LiveEventConnectionManager.ts:210:      // Browsers emit this during sleep/offline transitions while EventSource keeps retrying.
src/app/home/LiveEventConnectionManager.ts:233:        message: "The frontend received a malformed update payload from /api/events.",
src/app/home/LiveEventConnectionManager.ts:292:      this.openEventSource();
src/app/home/PreflightConfirmationActionsManager.ts:14:  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
src/app/home/PreflightConfirmationActionsManager.ts:17:  return window.localStorage;
src/app/home/useHomeLifecycle.ts:19:import { LiveEventConnectionManager } from "./LiveEventConnectionManager";
src/app/home/useHomeLifecycle.ts:153:    const connectionManager = new LiveEventConnectionManager({
src/app/home/useHomeLifecycle.ts:190:    const savedMode = window.localStorage.getItem(COMPOSER_MODE_STORAGE_KEY)?.trim() || "";
src/app/home/useHomeLifecycle.ts:191:    const savedWorker = window.localStorage.getItem(COMPOSER_WORKER_STORAGE_KEY)?.trim() || "";
src/app/home/useHomeLifecycle.ts:192:    const savedModel = window.localStorage.getItem(COMPOSER_MODEL_STORAGE_KEY)?.trim() || "";
src/app/home/useHomeLifecycle.ts:193:    const savedEffort = window.localStorage.getItem(getEffortStorageKey(savedWorker, savedModel))?.trim() || "";
src/app/home/useHomeLifecycle.ts:271:      setCollapsedProjectPaths(parseCollapsedProjectPaths(window.localStorage.getItem("omni-collapsed-projects")));
src/app/home/useHomeLifecycle.ts:274:        message: "The saved project group state in localStorage is malformed.",
src/app/home/useHomeLifecycle.ts:277:        suggestion: "Clear the omni-collapsed-projects localStorage entry and reload the page if project expansion looks wrong.",
src/app/home/useHomeLifecycle.ts:289:    const saved = window.localStorage.getItem("omni-conversations-sidebar-width");
src/app/home/useHomeLifecycle.ts:299:        message: "The saved conversations sidebar width in localStorage is invalid.",
src/app/home/useHomeLifecycle.ts:302:        suggestion: "Clear the omni-conversations-sidebar-width localStorage entry and reload the page if the conversations sidebar size looks wrong.",
src/app/home/useHomeLifecycle.ts:317:    const saved = window.localStorage.getItem("omni-workers-sidebar-width");
src/app/home/useHomeLifecycle.ts:327:        message: "The saved worker sidebar width in localStorage is invalid.",
src/app/home/useHomeLifecycle.ts:330:        suggestion: "Clear the omni-workers-sidebar-width localStorage entry and reload the page if the worker sidebar size looks wrong.",
src/app/home/useHomeLifecycle.ts:351:      window.localStorage.setItem("omni-conversations-sidebar-width", String(leftSidebarWidth));
src/app/home/useHomeLifecycle.ts:354:        message: "Failed to persist conversations sidebar width to localStorage.",
src/app/home/useHomeLifecycle.ts:372:      window.localStorage.setItem("omni-workers-sidebar-width", String(rightSidebarWidth));
src/app/home/useHomeLifecycle.ts:375:        message: "Failed to persist worker sidebar width to localStorage.",
src/app/home/useHomeLifecycle.ts:393:      window.localStorage.setItem("omni-collapsed-projects", JSON.stringify(Array.from(collapsedProjectPaths)));
src/app/home/useHomeLifecycle.ts:396:        message: "Failed to persist project group state to localStorage.",
src/app/home/useHomeLifecycle.ts:470:    const savedThemeMode = window.localStorage.getItem("omni-theme-mode");
src/app/home/useHomeLifecycle.ts:487:      window.localStorage.setItem("omni-theme-mode", themeMode);
src/app/home/useHomeLifecycle.ts:490:        message: "Failed to persist theme mode to localStorage.",
src/app/home/useHomeLifecycle.ts:503:    window.localStorage.setItem(COMPOSER_MODE_STORAGE_KEY, selectedConversationMode);
src/app/home/useHomeLifecycle.ts:511:    window.localStorage.setItem(COMPOSER_WORKER_STORAGE_KEY, selectedCliAgent);
src/app/home/useHomeLifecycle.ts:519:    window.localStorage.setItem(COMPOSER_MODEL_STORAGE_KEY, selectedModel);
src/app/home/useHomeLifecycle.ts:527:    window.localStorage.setItem(getEffortStorageKey(selectedCliAgent, selectedModel), selectedEffort);
src/app/home/useHomeLifecycle.ts:540:    const saved = window.localStorage.getItem(getEffortStorageKey(selectedCliAgent, selectedModel))?.trim() || "";
src/app/home/GitWorkspaceManager.ts:122:  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
src/app/home/GitWorkspaceManager.ts:125:  return window.localStorage;
src/app/home/GitWorkspaceManager.ts:172:  const response = await fetch("/api/git", {
src/runtime/http/routes/conversation-messages.ts:40:  const probe = startSlowProbe(`POST /api/conversations/${context.params?.id ?? "?"}/messages`);
src/app/home/useQueuedMessageMutations.ts:4:import { useMutation } from "@tanstack/react-query";
src/app/home/useQueuedMessageMutations.ts:37:  const cancelQueuedMessage = useMutation({
src/app/home/useQueuedMessageMutations.ts:38:    mutationFn: async ({ runId, messageId }: { runId: string; messageId: string }) => requestJson<{ ok: true }>(`/api/conversations/${runId}/queued-messages/${messageId}`, {
src/app/home/useQueuedMessageMutations.ts:59:  const sendQueuedMessageNow = useMutation({
src/app/home/useQueuedMessageMutations.ts:60:    mutationFn: async ({ runId, messageId }: { runId: string; messageId: string }) => requestJson<QueuedMessageMutationResponse>(`/api/conversations/${runId}/queued-messages/${messageId}`, {
src/app/home/useQueuedMessageMutations.ts:102:  const interruptQueuedMessage = useMutation({
src/app/home/useQueuedMessageMutations.ts:114:        return requestJson<QueuedMessageInterruptResponse>(`/api/conversations/${variables.runId}/queued-messages/${variables.messageId}/interrupt`, {
src/app/home/useQueuedMessageMutations.ts:125:      return requestJson<QueuedMessageInterruptResponse>(`/api/conversations/${variables.runId}/queued-messages/interrupt-next`, {
src/app/home/EventStreamSnapshotCacheManager.ts:29:  if (typeof window === "undefined" || typeof window.localStorage === "undefined") {
src/app/home/EventStreamSnapshotCacheManager.ts:33:  return window.localStorage;
src/app/home/EventStreamSnapshotCacheManager.ts:166:      // localStorage can be unavailable or full. The live stream remains the source of truth.
src/app/home/ComposerContainer.tsx:5:import { useQuery } from "@tanstack/react-query";
src/app/home/ComposerContainer.tsx:123:  const projectFilesQuery = useQuery<ProjectFilesResponse>({
src/app/home/ComposerContainer.tsx:124:    queryKey: ["project-files", currentProjectScope],
src/app/home/ComposerContainer.tsx:126:      `/api/fs/files?root=${encodeURIComponent(currentProjectScope || "")}`,
src/runtime/http/routes/agents.ts:17:    const res = await fetch(`${BRIDGE_URL}/agents`);
src/app/home/useHomeQueries.ts:4:import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
src/app/home/useHomeQueries.ts:38:  const queryClient = useQueryClient();
src/app/home/useHomeQueries.ts:54:  const sessionQuery = useQuery<AuthSessionResponse>({
src/app/home/useHomeQueries.ts:55:    queryKey: ["auth-session"],
src/app/home/useHomeQueries.ts:60:    queryFn: async () => requestJson<AuthSessionResponse>("/api/auth/session", undefined, {
src/app/home/useHomeQueries.ts:72:  const settingsQuery = useQuery({
src/app/home/useHomeQueries.ts:73:    queryKey: ["settings"],
src/app/home/useHomeQueries.ts:78:      const data = await requestJson<SettingsResponse>("/api/settings", undefined, {
src/app/home/useHomeQueries.ts:90:  const workerCatalogQuery = useQuery<WorkerCatalogResponse & { diagnostics?: AppErrorDescriptor[] }>({
src/app/home/useHomeQueries.ts:91:    queryKey: ["worker-catalog"],
src/app/home/useHomeQueries.ts:97:      "/api/agents/catalog",
src/app/home/useHomeQueries.ts:106:  const refreshWorkerCatalog = useMutation({
src/app/home/useHomeQueries.ts:108:      "/api/agents/catalog?refresh=1",
src/app/home/useHomeQueries.ts:120:  const projectFilesQuery = useQuery<ProjectFilesResponse>({
src/app/home/useHomeQueries.ts:121:    queryKey: ["project-files", currentProjectScope],
src/app/home/useHomeQueries.ts:123:      `/api/fs/files?root=${encodeURIComponent(currentProjectScope || "")}`,
src/app/home/EventStreamStateManager.ts:209: * State manager for the global `/api/events` snapshot stream. Worker
src/app/home/EventStreamStateManager.ts:212: * `WorkerEntriesManager` and is fetched per-worker via
src/app/home/EventStreamStateManager.ts:213: * `/api/workers/:workerId/entries`. This manager owns runs, plans,
src/app/home/ProjectMemoryPanelManager.ts:36:  const response = await fetch(url, {
src/app/home/ProjectMemoryPanelManager.ts:107:        `/api/projects/memory?projectPath=${encodeURIComponent(projectPath)}`,
src/app/home/ProjectMemoryPanelManager.ts:160:        `/api/projects/memory?projectPath=${encodeURIComponent(projectPath)}&path=${encodeURIComponent(selectedPath)}`,
src/app/home/ProjectMemoryPanelManager.ts:205:      await fetchJson("/api/projects/memory", {
src/app/home/ProjectMemoryPanelManager.ts:230:      await fetchJson("/api/projects/memory", {
src/app/home/useRunSelectionEffects.ts:360:    void fetch(`/api/runs/${encodeURIComponent(selectedRunId)}`, {
src/app/home/AppearancePreferencesManager.ts:51:  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
src/app/home/AppearancePreferencesManager.ts:75:  window.localStorage.setItem(key, value);
src/app/home/AppearancePreferencesManager.ts:83:  window.localStorage.removeItem(key);
src/app/home/AppearancePreferencesManager.ts:204:    const uiTextSize = parseTextSize(window.localStorage.getItem(UI_TEXT_SIZE_STORAGE_KEY));
src/app/home/AppearancePreferencesManager.ts:206:      window.localStorage.getItem(CONVERSATION_TEXT_SIZE_STORAGE_KEY)
src/app/home/AppearancePreferencesManager.ts:207:        ?? window.localStorage.getItem(LEGACY_DIRECT_TEXT_SIZE_STORAGE_KEY),
src/app/home/AppearancePreferencesManager.ts:209:    const terminalTextSize = parseTextSize(window.localStorage.getItem(TERMINAL_TEXT_SIZE_STORAGE_KEY));

exec
/bin/zsh -lc "sed -n '1,220p' src/app/home/bootstrap.server.ts" in /Users/masterman/NLP/omniharness
 succeeded in 0ms:
import { headers } from "next/headers";
import { buildRuntimeBootstrap } from "@/runtime/bootstrap";
import type { HomeBootstrapPayload } from "@/runtime/bootstrap";

export type { HomeBootstrapPayload };

type PageSearchParams = Record<string, string | string[] | undefined>;

export async function buildHomeBootstrap(searchParams: PageSearchParams = {}): Promise<HomeBootstrapPayload> {
  const requestHeaders = await headers();
  return buildRuntimeBootstrap({ searchParams, requestHeaders, includeInitialData: false });
}

2026-06-14T15:44:29.028332Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T15:44:29.047022Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:44:29.047031Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:44:29.047493Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:44:29.047498Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:44:29.048065Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:44:29.048071Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:44:29.048416Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:44:29.048422Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:44:29.048893Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:44:29.048897Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:44:29.049797Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:44:29.049801Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:44:29.421195Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T15:44:29.428427Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T15:44:29.428455Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
codex
One early gap is emerging from the code scan: there are many runtime calls outside the two hooks named in the plan, including `FileViewerPanel`, `ComposerContainer`, notification/project memory/git managers, queued-message mutations, transcripts, attachments, and runtime-api adapters. I’m checking whether the plan already covers these enough or needs a stronger audit gate.

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:44:44.772Z","phase":null} -->
## Tool call: write_stdin · 2026-06-14T15:44:44.772Z

```json
{
  "session_id": 17286,
  "chars": "",
  "yield_time_ms": 30000,
  "max_output_tokens": 50000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:45:14.778Z","phase":null} -->
## Tool result: call_VHTks0CtmlkPDlY6mBaCaYy6 · 2026-06-14T15:45:14.778Z

```text
Chunk ID: 1b5051
Wall time: 30.0027 seconds
Process running with session ID 17286
Original token count: 666
Output:
2026-06-14T15:45:03.545780Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T15:45:03.565934Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:45:03.565945Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:45:03.566405Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:45:03.566413Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:45:03.566873Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:45:03.566879Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:45:03.567259Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:45:03.567266Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:45:03.567706Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:45:03.567712Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:45:03.568537Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:45:03.568542Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:45:03.956608Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T15:45:03.977280Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T15:45:03.977469Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"user","timestamp":"2026-06-14T15:45:14.798Z","phase":null} -->
## User · 2026-06-14T15:45:14.798Z

Try baton again with full permissions that you now have

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:45:21.279Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:45:21.279Z

I’ll try `baton` again with escalation. If it resolves outside the sandbox, I’ll use it as the requested reviewer and ignore the Codex fallback unless we need its partial findings.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:45:22.537Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:45:22.537Z

```json
{
  "cmd": "baton --help",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 12000,
  "sandbox_permissions": "require_escalated",
  "justification": "Check whether the requested baton CLI is available outside the sandbox for the second-opinion review.",
  "prefix_rule": [
    "baton"
  ]
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:46:05.226Z","phase":null} -->
## Tool result: call_XxrKA3whcEzfXPcT7YuAGZiq · 2026-06-14T15:46:05.226Z

```text
Chunk ID: ea3b0d
Wall time: 0.0000 seconds
Process exited with code 127
Original token count: 8
Output:
zsh:1: command not found: baton

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:46:12.806Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:46:12.806Z

Escalated shell still reports `baton: command not found`, so it is not just a sandbox issue. I’m checking the usual install locations before giving up on that CLI.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:46:12.813Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:46:12.813Z

```json
{
  "cmd": "which -a baton || true",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 12000,
  "sandbox_permissions": "require_escalated",
  "justification": "Check PATH entries for the requested baton CLI outside the sandbox."
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:46:12.864Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:46:12.864Z

```json
{
  "cmd": "ls /opt/homebrew/bin/baton /usr/local/bin/baton /usr/bin/baton /bin/baton",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 12000,
  "sandbox_permissions": "require_escalated",
  "justification": "Check common binary locations for the requested baton CLI outside the sandbox."
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:47:19.943Z","phase":null} -->
## Tool result: call_k6QpqZhYNEGTp07tsrrUZteg · 2026-06-14T15:47:19.943Z

```text
Chunk ID: bc24c9
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 4
Output:
baton not found

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:47:19.944Z","phase":null} -->
## Tool result: call_G9WGpuDVk0hclPNQtZsnHWxs · 2026-06-14T15:47:19.944Z

```text
Chunk ID: 0ccfbd
Wall time: 0.0000 seconds
Process exited with code 1
Original token count: 49
Output:
ls: /bin/baton: No such file or directory
ls: /opt/homebrew/bin/baton: No such file or directory
ls: /usr/bin/baton: No such file or directory
ls: /usr/local/bin/baton: No such file or directory

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:47:27.639Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:47:27.639Z

`baton` is not present on `PATH` or in the common Homebrew/system binary locations, even with escalation. I’m going to stop the overlong Codex fallback if it does not produce a concise verdict on the next poll, then patch the concrete gap it already surfaced.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:47:28.415Z","phase":null} -->
## Tool call: write_stdin · 2026-06-14T15:47:28.415Z

```json
{
  "session_id": 17286,
  "chars": "",
  "yield_time_ms": 5000,
  "max_output_tokens": 50000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:47:28.440Z","phase":null} -->
## Tool result: call_lZJoKdbZpkdaJ9B0Wf0sK9Mu · 2026-06-14T15:47:28.440Z

```text
Chunk ID: 711d52
Wall time: 0.0007 seconds
Process exited with code 0
Original token count: 109876
Output:
Total output lines: 1152

2026-06-14T15:45:42.056961Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T15:45:42.075942Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:45:42.075954Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:45:42.076500Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:45:42.076507Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:45:42.077006Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:45:42.077011Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:45:42.077803Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:45:42.077818Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:45:42.078513Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:45:42.078520Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:45:42.079757Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:45:42.079763Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:45:42.504847Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T15:45:42.512310Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T15:45:42.512335Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
codex
The secondary pass independently found the same broad-call-surface issue. I’m also checking auth/cookie behavior because remote cross-origin support is one place where a plan can sound complete but still miss a hard browser constraint.
exec
/bin/zsh -lc "sed -n '1,220p' src/runtime-api/web.ts" in /Users/masterman/NLP/omniharness
exec
/bin/zsh -lc "sed -n '1,160p' src/runtime/http/routes/auth-login.ts" in /Users/masterman/NLP/omniharness
exec
/bin/zsh -lc "sed -n '1,160p' src/runtime/http/routes/auth-session.ts" in /Users/masterman/NLP/omniharness
 succeeded in 0ms:
import type { RuntimeAPIs, RuntimeApiError, RuntimeSubscription } from "./types";

export interface WebRuntimeApiOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  EventSourceImpl?: EventSourceConstructor;
}

type RuntimeEventSourceEvent = {
  type: string;
  data: string;
};

type RuntimeEventSource = {
  close(): void;
  addEventListener(type: string, listener: (event: RuntimeEventSourceEvent) => void): void;
};

type EventSourceConstructor = new (url: string) => RuntimeEventSource;

function buildQuery(params: Record<string, string | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") {
      search.set(key, value);
    }
  }
  const value = search.toString();
  return value ? `?${value}` : "";
}

function joinUrl(baseUrl: string, path: string) {
  if (!baseUrl) return path;
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

function parseEventData(event: RuntimeEventSourceEvent) {
  if (!event.data) {
    return null;
  }
  try {
    return JSON.parse(event.data) as unknown;
  } catch {
    return event.data;
  }
}

function normalizeStreamEvent(event: RuntimeEventSourceEvent) {
  const data = parseEventData(event);
  if (event.type === "update") {
    return { kind: "update", payload: data };
  }
  if (event.type === "stream.resync_required") {
    return {
      kind: "stream.resync_required",
      ...(data && typeof data === "object" ? data : { payload: data }),
    };
  }
  return data;
}

async function parseJson(response: Response) {
  const text = await response.text();
  if (!text) return null;
  return JSON.parse(text) as unknown;
}

function normalizeError(response: Response, body: unknown): RuntimeApiError {
  const payload = body && typeof body === "object" && "error" in body
    ? (body as { error?: { code?: unknown; message?: unknown; details?: unknown; surface?: unknown } }).error
    : null;
  const message = typeof payload?.message === "string" ? payload.message : `Runtime request failed with HTTP ${response.status}.`;
  return {
    code: typeof payload?.code === "string" ? payload.code : `runtime.http_${response.status}`,
    message,
    details: payload?.details,
    surface: typeof payload?.surface === "string" ? payload.surface : "web",
  };
}

export function createWebRuntimeAPIs(options: WebRuntimeApiOptions = {}): RuntimeAPIs {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl ?? "";
  const EventSourceCtor = options.EventSourceImpl
    ?? (typeof EventSource !== "undefined" ? EventSource : null);

  async function request(path: string, init: RequestInit = {}) {
    const response = await fetchImpl(joinUrl(baseUrl, path), init);
    const body = await parseJson(response);
    if (!response.ok) {
      throw normalizeError(response, body);
    }
    return body;
  }

  function post(path: string, body: unknown) {
    return request(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  return {
    runtime: {
      surface: "web",
      label: "Web",
      supportsNativeNotifications: false,
      supportsEditorActions: false,
    },
    bootstrap: {
      load(input) {
        return request(`/api/runtime/bootstrap${buildQuery({
          run: input.selectedRunId ?? null,
          project: input.draftProjectPath ?? null,
          pair: input.pairToken ?? null,
        })}`, { method: "GET" });
      },
    },
    events: {
      open(input, handlers): RuntimeSubscription {
        if (!EventSourceCtor) {
          handlers.onError?.({
            code: "runtime.events_unavailable",
            message: "Runtime event streaming requires EventSource support.",
            surface: "web",
          });
          return { close() {} };
        }

        const source = new EventSourceCtor(joinUrl(baseUrl, `/api/events${buildQuery({
          runId: input.runId ?? null,
          lastEventId: input.lastEventId ?? null,
        })}`));
        const emit = (event: RuntimeEventSourceEvent) => {
          handlers.onEvent(normalizeStreamEvent(event));
        };
        source.addEventListener("message", emit);
        source.addEventListener("update", emit);
        source.addEventListener("stream.resync_required", emit);
        source.addEventListener("error", () => {
          handlers.onError?.({
            code: "runtime.events_failed",
            message: "Event stream failed.",
            surface: "web",
          });
        });

        return {
          close() {
            source.close();
          },
        };
      },
      fetchLog(input) {
        return request(`/api/events/log${buildQuery({ since: input.since, runId: input.runId })}`, { method: "GET" });
      },
    },
    conversations: {
      create(input) {
        return post("/api/conversations", input);
      },
      sendMessage(input) {
        return post("/api/messages", input);
      },
    },
    workers: {
      listEntries(input) {
        return request(`/api/workers/${encodeURIComponent(input.workerId)}/entries${buildQuery({
          runId: input.runId,
          afterSeq: input.afterSeq == null ? null : String(input.afterSeq),
        })}`, { method: "GET" });
      },
    },
    settings: {
      load() {
        return request("/api/settings", { method: "GET" });
      },
      save(input) {
        return post("/api/settings", input);
      },
    },
  };
}

 succeeded in 0ms:
import { getAuthConfigurationError, getPublicOriginFromRequest, isAuthEnabled } from "@/server/auth/config";
import { insertAuthEvent } from "@/server/auth/audit";
import { getSessionFromRequest, listActiveSessions, revokeAllSessions, revokeSession } from "@/server/auth/session";
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import type { OmniHttpHandler } from "@/runtime/http/registry";
import { toNextRequest } from "./next-request";
import { clearSessionCookie } from "./cookies";

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, init);
}

async function getAuthSession(request: Request) {
  const nextRequest = toNextRequest(request);
  const publicOrigin = getPublicOriginFromRequest(nextRequest.url, nextRequest.headers);

  if (!isAuthEnabled()) {
    return json({
      enabled: false,
      authenticated: true,
      currentSession: null,
      sessions: [],
      configurationError: null,
      publicOrigin,
    });
  }

  const configurationError = getAuthConfigurationError();
  if (configurationError) {
    return json({
      enabled: true,
      authenticated: false,
      currentSession: null,
      sessions: [],
      configurationError,
      publicOrigin,
    });
  }

  const session = await getSessionFromRequest(nextRequest);
  if (!session) {
    return json({
      enabled: true,
      authenticated: false,
      currentSession: null,
      sessions: [],
      configurationError: null,
      publicOrigin,
    });
  }

  return json({
    enabled: true,
    authenticated: true,
    currentSession: session,
    sessions: await listActiveSessions(),
    configurationError: null,
    publicOrigin,
  });
}

async function deleteAuthSession(request: Request) {
  const nextRequest = toNextRequest(request);
  const auth = await requireApiSession(nextRequest, {
    source: "Auth",
    action: "Revoke session",
    enforceSameOrigin: true,
  });
  if (auth.response) {
    return auth.response;
  }

  const body = await request.json().catch(() => ({}));
  const targetSessionId = typeof body?.sessionId === "string" && body.sessionId.trim()
    ? body.sessionId.trim()
    : null;
  const revokeAll = body?.all === true;

  if (revokeAll) {
    await revokeAllSessions();
    await insertAuthEvent({
      eventType: "auth.logout_all",
      sessionId: auth.session?.id ?? null,
    });
  } else {
    await revokeSession(targetSessionId ?? auth.session!.id);
    await insertAuthEvent({
      eventType: "auth.session_revoked",
      sessionId: targetSessionId ?? auth.session?.id ?? null,
    });
  }

  const response = json({ ok: true });
  if (revokeAll || !targetSessionId || targetSessionId === auth.session?.id) {
    clearSessionCookie(response);
  }
  return response;
}

export const handleAuthSessionRequest: OmniHttpHandler = async (request) => {
  try {
    if (request.method === "GET") {
      return getAuthSession(request);
    }
    if (request.method === "DELETE") {
      return deleteAuthSession(request);
    }
    return json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
      status: 405,
      headers: { allow: "GET, DELETE" },
    });
  } catch (error) {
    return errorResponse(error, {
      status: 500,
      source: "Auth",
      action: request.method === "DELETE" ? "Revoke session" : "Load session state",
    });
  }
};

 succeeded in 0ms:
import { getAuthConfigurationError, isAuthEnabled } from "@/server/auth/config";
import { verifyConfiguredAuthPassword } from "@/server/auth/password";
import { createAuthSession } from "@/server/auth/session";
import { insertAuthEvent } from "@/server/auth/audit";
import { errorResponse } from "@/server/api-errors";
import { isSameOriginRequest } from "@/server/auth/guards";
import { getLoginRateLimitStatus, recordFailedLoginAttempt, recordSuccessfulLoginAttempt } from "@/server/auth/rate-limit";
import type { OmniHttpHandler } from "@/runtime/http/registry";
import { toNextRequest } from "./next-request";
import { setSessionCookie } from "./cookies";

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

function getClientIp(request: Request) {
  return firstHeaderValue(request.headers.get("x-forwarded-for"))
    || firstHeaderValue(request.headers.get("x-real-ip"))
    || null;
}

export const handleAuthLoginRequest: OmniHttpHandler = async (request) => {
  try {
    if (!isAuthEnabled()) {
      return errorResponse("Authentication is not enabled for this OmniHarness instance.", {
        status: 400,
        source: "Auth",
        action: "Log in",
      });
    }

    const configurationError = getAuthConfigurationError();
    if (configurationError) {
      return errorResponse(configurationError, {
        status: 503,
        source: "Auth",
        action: "Log in",
      });
    }

    if (!isSameOriginRequest(toNextRequest(request))) {
      return errorResponse("Cross-site request rejected.", {
        status: 403,
        source: "Auth",
        action: "Log in",
      });
    }

    const body = await request.json();
    const password = typeof body?.password === "string" ? body.password : "";
    const label = typeof body?.label === "string" ? body.label : "";
    const ipAddress = getClientIp(request);
    const userAgent = request.headers.get("user-agent") ?? null;

    if (!password.trim()) {
      return errorResponse("Password is required.", {
        status: 400,
        source: "Auth",
        action: "Log in",
      });
    }

    const rateLimitStatus = getLoginRateLimitStatus(ipAddress);
    if (rateLimitStatus.locked) {
      const response = errorResponse("Too many login attempts. Try again later.", {
        status: 429,
        source: "Auth",
        action: "Log in",
      });
      response.headers.set("Retry-After", String(rateLimitStatus.retryAfterSeconds));
      await insertAuthEvent({
        eventType: "auth.login_rate_limited",
        details: {
          ipAddress,
          userAgent,
          retryAfterSeconds: rateLimitStatus.retryAfterSeconds,
        },
      });
      return response;
    }

    const valid = await verifyConfiguredAuthPassword(password);
    if (!valid) {
      recordFailedLoginAttempt(ipAddress);
      await insertAuthEvent({
        eventType: "auth.login_failed",
        details: {
          ipAddress,
          userAgent,
        },
      });
      return errorResponse("Incorrect password.", {
        status: 401,
        source: "Auth",
        action: "Log in",
      });
    }

    recordSuccessfulLoginAttempt(ipAddress);
    const session = await createAuthSession({
      label: label.trim() || "Browser session",
      userAgent,
      authMethod: "password_login",
    });

    await insertAuthEvent({
      eventType: "auth.login_succeeded",
      sessionId: session.sessionId,
      details: {
        label: label.trim() || "Browser session",
        ipAddress,
        userAgent,
      },
    });

    const response = Response.json({
      ok: true,
      sessionId: session.sessionId,
      expiresAt: session.expiresAt,
    });
    setSessionCookie(response, session.tokenValue, session.expiresAt);
    return response;
  } catch (error) {
    return errorResponse(error, {
      status: 500,
      source: "Auth",
      action: "Log in",
    });
  }
};

exec
/bin/zsh -lc 'rg -n "Access-Control|CORS|cors|credentials|SameSite|auth/session|auth/login|set-cookie|runtime-api|RuntimeApi|create.*Runtime" src docs tests -S' in /Users/masterman/NLP/omniharness
 succeeded in 0ms:
tests/supervisor/model-config-codex.test.ts:14:    it("picks codex provider when SUPERVISOR_LLM_PROVIDER=codex and credentials exist", () => {
tests/supervisor/model-config-codex.test.ts:24:    it("falls back to secondary if codex credentials are missing", () => {
tests/supervisor/worker-availability.test.ts:150:      if (command === "security" && args[0] === "find-generic-password" && args[2] === "Claude Code-credentials") {
tests/supervisor/worker-availability.test.ts:169:  it("detects claude keychain credentials even when the caller refuses CLI probes", async () => {
tests/supervisor/worker-availability.test.ts:174:      if (command === "security" && args[0] === "find-generic-password" && args[2] === "Claude Code-credentials") {
tests/supervisor/worker-availability.test.ts:198:  it("detects claude login from the legacy credentials file", async () => {
tests/supervisor/worker-availability.test.ts:211:      fileExists: (filePath) => filePath === "/Users/tester/.claude/.credentials.json",
tests/supervisor/worker-availability.test.ts:219:  it("reports claude as not authenticated when no credentials exist anywhere", async () => {
tests/supervisor/worker-availability.test.ts:242:    // script. The agent gets its credentials at spawn time, so the wizard must
tests/supervisor/worker-availability.test.ts:377:  it("detects gemini login from local oauth state without reading credentials", async () => {
tests/vscode/bridge.test.ts:7:      expect(String(url)).toBe("http://127.0.0.1:3035/api/auth/session");
tests/vscode/bridge.test.ts:21:          path: "/api/auth/session",
tests/vscode/bridge.test.ts:83:          path: "/api/auth/session",
tests/vscode/webview-bundle.test.ts:29:    expect(webviewSource).toContain("createVSCodeRuntimeAPIs");
tests/server/supervisor/codex-auth.test.ts:50:  it("parses happy path credentials correctly", () => {
tests/server/supervisor/codex-auth.test.ts:84:  it("detects expired credentials", () => {
tests/server/supervisor/codex-auth.test.ts:101:  it("detects non-expired credentials with skew", () => {
tests/server/supervisor/codex-auth-import.test.ts:21:      throw new Error("proper-lockfile should only load while refreshing credentials");
tests/electron/runtime-shell.test.ts:30:      createRuntime: () => runtime,
tests/runtime/http-routes.test.ts:7:import { createAuthSession } from "@/server/auth/session";
tests/runtime/http-routes.test.ts:24:import { createOmniRuntimeHttpRegistry } from "@/runtime/http/routes";
tests/runtime/http-routes.test.ts:68:    const response = await handleAuthSessionRequest(new Request("http://localhost/api/auth/session", {
tests/runtime/http-routes.test.ts:85:    const response = await handleAuthLoginRequest(new Request("http://localhost/api/auth/login", {
tests/runtime/http-routes.test.ts:96:    expect(response.headers.get("set-cookie")).toContain("omni_session=");
tests/runtime/http-routes.test.ts:119:    expect(response.headers.get("set-cookie")).toContain("omni_session=");
tests/runtime/http-routes.test.ts:166:    const registry = createOmniRuntimeHttpRegistry();
tests/runtime/http-routes.test.ts:168:    const authResponse = await registry.handle(new Request("http://localhost/api/auth/session", {
tests/runtime/http-routes.test.ts:184:    const registry = createOmniRuntimeHttpRegistry();
tests/runtime/http-routes.test.ts:209:    const registry = createOmniRuntimeHttpRegistry();
tests/runtime/http-routes.test.ts:373:    const registry = createOmniRuntimeHttpRegistry();
tests/runtime/http-routes.test.ts:393:    const registry = createOmniRuntimeHttpRegistry();
tests/runtime/http-routes.test.ts:418:    const regis…99876 tokens truncated… {\n   145\t        res.statusCode = 405;\n   146\t        res.end(\"Method not allowed\");\n   147\t        return;\n   148\t      }\n   149\t      const response = await handler(nextReq, { params: Promise.resolve(params) });\n   150\t      await webResponseToNodeRes(response, res);\n   151\t    } catch (error) {\n   152\t      console.error(\"[lifecycle-harness] route error\", error);\n   153\t      if (!res.headersSent) {\n   154\t        res.statusCode = 500;\n   155\t        res.end(`Internal harness error: ${(error as Error).message}`);\n   156\t      } else {\n   157\t        res.end();\n   158\t      }\n   159\t    }\n   160\t  });\n   161\t\n   162\t  await new Promise<void>((resolve) => server.listen(0, \"127.0.0.1\", () => resolve()));\n   163\t  const addr = server.address();\n   164\t  const port = addr && typeof addr === \"object\" ? addr.port : 0;\n   165\t  const baseUrl = `http://127.0.0.1:${port}`;\n   166\t\n   167\t  return {\n   168\t    baseUrl,\n   169\t    port,\n   170\t    omniRoot,\n","exit_code":0,"status":"completed"}}
{"type":"item.completed","item":{"id":"item_38","type":"command_execution","command":"/bin/zsh -lc \"sed -n '1,150p' tests/lifecycle/harness/subprocess.ts\"","aggregated_output":"/**\n * Real-restart variant of the lifecycle harness.\n *\n * Spawns `subprocess-runner.ts` as a child process. The child hosts the\n * same in-process HTTP harness, but lives in its own Node runtime, so a\n * SIGTERM truly resets module-level state (named-event ring buffer,\n * in-flight SSE connections, prepared SQL statements). The sqlite file\n * under OMNIHARNESS_ROOT persists across the kill, mirroring real\n * production restart behaviour.\n *\n * Use this for scenarios that need to verify \"after the server *really*\n * restarted, what does the client observe?\" — the in-process harness\n * can only approximate that with `simulateRestart()`.\n */\nimport { spawn, type ChildProcess } from \"node:child_process\";\nimport { mkdtempSync, rmSync } from \"node:fs\";\nimport { tmpdir } from \"node:os\";\nimport path from \"node:path\";\n\nexport interface SubprocessHandle {\n  baseUrl: string;\n  port: number;\n  omniRoot: string;\n  /** Kill the subprocess (SIGTERM by default; SIGKILL when force=true). */\n  stop(opts?: { force?: boolean }): Promise<void>;\n  /** Kill then respawn against the same OMNIHARNESS_ROOT. */\n  restart(opts?: { force?: boolean }): Promise<void>;\n}\n\nconst PROJECT_ROOT = path.resolve(__dirname, \"..\", \"..\", \"..\");\nconst RUNNER_PATH = path.resolve(PROJECT_ROOT, \"tests/lifecycle/harness/subprocess-runner.ts\");\nconst TSX_PATH = path.resolve(PROJECT_ROOT, \"node_modules/.bin/tsx\");\n\nasync function spawnRunner(omniRoot: string): Promise<{ child: ChildProcess; port: number }> {\n  const child = spawn(TSX_PATH, [RUNNER_PATH], {\n    cwd: PROJECT_ROOT,\n    env: {\n      ...process.env,\n      OMNIHARNESS_ROOT: omniRoot,\n      OMNIHARNESS_TEST_BYPASS_AUTH: \"true\",\n      OMNIHARNESS_E2E_BYPASS_AUTH: \"true\",\n      OMNIHARNESS_LIFECYCLE_SUBPROCESS: \"1\",\n      NODE_ENV: \"test\",\n      MOCK_LLM: \"true\",\n      PORT: \"0\",\n    },\n    stdio: [\"ignore\", \"pipe\", \"pipe\"],\n  });\n\n  const port = await new Promise<number>((resolve, reject) => {\n    let stderrBuf = \"\";\n    const onStdout = (chunk: Buffer) => {\n      const text = chunk.toString(\"utf8\");\n      const match = text.match(/SUBPROCESS_READY (\\d+)/);\n      if (match) {\n        child.stdout?.off(\"data\", onStdout);\n        resolve(Number(match[1]));\n      } else if (process.env.OMNI_LIFECYCLE_VERBOSE) {\n        process.stdout.write(`[subprocess] ${text}`);\n      }\n    };\n    child.stdout?.on(\"data\", onStdout);\n    child.stderr?.on(\"data\", (chunk: Buffer) => {\n      stderrBuf += chunk.toString(\"utf8\");\n      if (process.env.OMNI_LIFECYCLE_VERBOSE) {\n        process.stderr.write(`[subprocess] ${chunk}`);\n      }\n    });\n    child.once(\"exit\", (code) => {\n      reject(new Error(`subprocess exited before ready (code=${code}): ${stderrBuf}`));\n    });\n    setTimeout(() => reject(new Error(`subprocess did not signal ready in time: ${stderrBuf}`)), 30_000);\n  });\n\n  return { child, port };\n}\n\nasync function killProcess(child: ChildProcess, force: boolean): Promise<void> {\n  if (child.exitCode != null) return;\n  await new Promise<void>((resolve) => {\n    let settled = false;\n    const finish = () => {\n      if (settled) return;\n      settled = true;\n      resolve();\n    };\n    child.once(\"exit\", finish);\n    child.kill(force ? \"SIGKILL\" : \"SIGTERM\");\n    setTimeout(() => {\n      if (!settled && child.exitCode == null) {\n        try {\n          child.kill(\"SIGKILL\");\n        } catch {\n          // already gone\n        }\n      }\n    }, 3_000);\n  });\n}\n\nexport async function startSubprocessHarness(opts: { omniRoot?: string } = {}): Promise<SubprocessHandle> {\n  const omniRoot = opts.omniRoot ?? mkdtempSync(path.join(tmpdir(), \"omni-lifecycle-sub-\"));\n  let { child, port } = await spawnRunner(omniRoot);\n  let baseUrl = `http://127.0.0.1:${port}`;\n\n  return {\n    get baseUrl() {\n      return baseUrl;\n    },\n    get port() {\n      return port;\n    },\n    omniRoot,\n    async stop(stopOpts = {}) {\n      await killProcess(child, stopOpts.force === true);\n      try {\n        rmSync(omniRoot, { recursive: true, force: true });\n      } catch {\n        // best-effort\n      }\n    },\n    async restart(restartOpts = {}) {\n      await killProcess(child, restartOpts.force === true);\n      const next = await spawnRunner(omniRoot);\n      child = next.child;\n      port = next.port;\n      baseUrl = `http://127.0.0.1:${port}`;\n    },\n  };\n}\n","exit_code":0,"status":"completed"}}
{"type":"item.started","item":{"id":"item_40","type":"command_execution","command":"/bin/zsh -lc \"nl -ba src/runtime/http/routes/cookies.ts | sed -n '1,80p'\"","aggregated_output":"","exit_code":null,"status":"in_progress"}}
{"type":"item.completed","item":{"id":"item_40","type":"command_execution","command":"/bin/zsh -lc \"nl -ba src/runtime/http/routes/cookies.ts | sed -n '1,80p'\"","aggregated_output":"     1\timport { AUTH_SESSION_COOKIE } from \"@/server/auth/config\";\n     2\t\n     3\texport function setSessionCookie(response: Response, tokenValue: string, expires: Date) {\n     4\t  response.headers.append(\n     5\t    \"set-cookie\",\n     6\t    `${AUTH_SESSION_COOKIE}=${tokenValue}; Expires=${expires.toUTCString()}; HttpOnly; SameSite=Lax; Path=/`\n     7\t      + (process.env.NODE_ENV === \"production\" ? \"; Secure\" : \"\"),\n     8\t  );\n     9\t}\n    10\t\n    11\texport function clearSessionCookie(response: Response) {\n    12\t  response.headers.append(\n    13\t    \"set-cookie\",\n    14\t    `${AUTH_SESSION_COOKIE}=; Expires=${new Date(0).toUTCString()}; HttpOnly; SameSite=Lax; Path=/`\n    15\t      + (process.env.NODE_ENV === \"production\" ? \"; Secure\" : \"\"),\n    16\t  );\n    17\t}\n","exit_code":0,"status":"completed"}}
2026-06-14T15:45:47.027574Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T15:45:47.044412Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:45:47.044422Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:45:47.044769Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:45:47.044774Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:45:47.045102Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:45:47.045105Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:45:47.045523Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:45:47.045529Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:45:47.045794Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:45:47.045799Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:45:47.046433Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T15:45:47.046438Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T15:45:47.430545Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T15:45:47.438478Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T15:45:47.438501Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
{"type":"item.completed","item":{"id":"item_41","type":"agent_message","text":"1. Verdict: HARDEN\n\n2. Highest-impact findings, with concrete fixes\n\n- Cross-origin auth/CORS is under-specified. The plan says use `credentials: \"include\"` and detect CORS failures, but that does not make remote servers usable. Current auth cookies are `SameSite=Lax`, which will not work for true cross-site standalone access. Add an explicit server-side access policy section: allowed UI origins, preflight/OPTIONS handling, `Access-Control-Allow-Credentials`, SSE/EventSource `withCredentials`, cookie strategy, and auth tests against a protected server.\n\n- “Standalone interface” is not concretely defined. The plan says static/standalone mode starts without bootstrap, but the file map does not say how that mode is built, served, routed, or detected. Either narrow the milestone to “multi-server selector inside the existing app” or add concrete work for a standalone shell entrypoint, bootstrap-null path, asset hosting assumptions, and acceptance criteria for opening the UI without a local OmniHarness runtime.\n\n- The runtime call-site audit is incomplete. The plan names `useHomeQueries`, `useHomeMutations`, SSE, and worker entries, but the repo has many other direct `/api/...` callers: pairing, file pickers, attachments, notifications, project memory, git workspace, queued messages, transcript fetches, prewarm, external sessions, and settings saves. Add a checklist item that inventories every `fetch`, `requestJson`, `new EventSource`, and `/api/` reference, classifies each as runtime-targeted vs local-shell-only, and routes runtime calls through the runtime client.\n\n- The lifecycle test design is too vague. “Launch two isolated OmniHarness servers” cannot safely rely on the current in-process lifecycle harness because it mutates process-global env and named-event state. Make the plan require subprocess harness support for two independent roots, route coverage for bootstrap/events/log/worker entries/auth, and cleanup assertions for both roots.\n\n- The server identity and compatibility contract needs a real schema. `serverId`, `runtimeVersion`, `capabilities`, and `standaloneInterfaceSupported` are named, but not versioned or defined enough to implement safely. Specify descriptor fields, required capability names, stable `serverId` derivation or storage rules, incompatible-version behavior, and tests for same origin, changed origin, tunnel URL, and duplicate server entries.\n\n- The implementation sequence is still too large. Break it into phase gates: runtime descriptor/schema, runtime client and call-site audit, server-scoped caches under the default local server, SSE/worker isolation, then UI/server directory, then cross-origin/auth. Each phase should have targeted tests and leave single-server behavior passing.\n\n3. Anything I would deliberately leave alone\n\n- Keep the unified worker stream requirement exactly as written.\n- Keep localStorage for device-local server directory metadata.\n- Keep Playwright/user-journey tests approval-gated.\n- Keep future fleet/admin/account-sync ideas as non-goals for this milestone."}}
{"type":"turn.completed","usage":{"input_tokens":574803,"cached_input_tokens":454016,"output_tokens":5260,"reasoning_output_tokens":2125}}
2026-06-14T15:46:11.441089Z  WARN codex_core::shell_snapshot: Failed to delete shell snapshot at AbsolutePathBuf("/Users/masterman/.codex/shell_snapshots/019ec6cd-b6c9-7243-b0d7-1c827505203c.1781451831010926000.sh"): Os { code: 2, kind: NotFound, message: "No such file or directory" }

2026-06-14T15:46:11.914187Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T15:46:11.921473Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T15:46:11.921495Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
codex
**Verdict: HARDEN**

The plan is strong, but not ready to execute safely. Highest-impact fixes:

1. Cross-origin auth/CORS is under-specified.
   The plan says `credentials: "include"` and CORS failure detection, but current auth rejects cross-site login and cookies are `SameSite=Lax`: [auth-login.ts](/Users/masterman/NLP/omniharness/src/runtime/http/routes/auth-login.ts:27), [cookies.ts](/Users/masterman/NLP/omniharness/src/runtime/http/routes/cookies.ts:3). Add an explicit remote-server access policy: allowed UI origins, OPTIONS/preflight, `Access-Control-Allow-Credentials`, SSE `withCredentials`, cookie strategy or token alternative, and protected-server tests.

2. “Standalone interface” is not concrete enough.
   The plan says static/standalone mode starts without bootstrap, but does not define how it is built, served, routed, or detected. Add a file map and acceptance criteria for the standalone shell, or narrow the milestone to multi-server support inside the existing served app.

3. Runtime boundary ownership conflicts with existing code.
   The plan creates `src/app/home/runtime-client.ts`, but the repo already has `src/runtime-api/web.ts`, `electron.ts`, `vscode.ts`, and `provider.tsx`. Decide whether to extend `RuntimeAPIs` or introduce a lower-level selected-server client beneath it. Do not leave two competing runtime abstractions.

4. API call-site coverage is incomplete.
   Beyond `useHomeQueries`/`useHomeMutations`, current direct runtime callers include file viewer/pickers, attachments, notifications, project memory, git, queued messages, transcript fetches, prewarm, pairing, external sessions, and model auth status. Add a required `rg` audit gate that classifies every `/api`, `fetch`, `requestJson`, and `EventSource` call as runtime-targeted or local-shell-only, then updates the file map.

5. Lifecycle test isolation needs to be explicit.
   Do not rely on the in-process lifecycle harness for “two real servers”; it shares process env/module state. Use/extend `tests/lifecycle/harness/subprocess.ts` and add required route coverage in `subprocess-runner.ts` for bootstrap, auth, events/log, worker entries, settings, conversations, and cleanup.

6. Server identity/schema is too vague.
   Define the runtime descriptor schema: stable `serverId` source, duplicate-origin handling, tunnel/origin changes, required capability names, version compatibility, and incompatible-server behavior.

7. Sequence needs phase gates.
   Break implementation into: descriptor/schema, runtime boundary and call-site audit, server-scoped caches on default local server, SSE/worker isolation, UI directory, then cross-origin/auth. Each phase should keep current single-server behavior passing.

**Leave Alone**

Keep the unified worker stream requirement, localStorage for non-secret directory metadata, manager-owned React state, i18n requirements, approval-gated Playwright journeys, and future fleet/account-sync/admin ideas as non-goals.
tokens used
146.380
**Verdict: HARDEN**

The plan is strong, but not ready to execute safely. Highest-impact fixes:

1. Cross-origin auth/CORS is under-specified.
   The plan says `credentials: "include"` and CORS failure detection, but current auth rejects cross-site login and cookies are `SameSite=Lax`: [auth-login.ts](/Users/masterman/NLP/omniharness/src/runtime/http/routes/auth-login.ts:27), [cookies.ts](/Users/masterman/NLP/omniharness/src/runtime/http/routes/cookies.ts:3). Add an explicit remote-server access policy: allowed UI origins, OPTIONS/preflight, `Access-Control-Allow-Credentials`, SSE `withCredentials`, cookie strategy or token alternative, and protected-server tests.

2. “Standalone interface” is not concrete enough.
   The plan says static/standalone mode starts without bootstrap, but does not define how it is built, served, routed, or detected. Add a file map and acceptance criteria for the standalone shell, or narrow the milestone to multi-server support inside the existing served app.

3. Runtime boundary ownership conflicts with existing code.
   The plan creates `src/app/home/runtime-client.ts`, but the repo already has `src/runtime-api/web.ts`, `electron.ts`, `vscode.ts`, and `provider.tsx`. Decide whether to extend `RuntimeAPIs` or introduce a lower-level selected-server client beneath it. Do not leave two competing runtime abstractions.

4. API call-site coverage is incomplete.
   Beyond `useHomeQueries`/`useHomeMutations`, current direct runtime callers include file viewer/pickers, attachments, notifications, project memory, git, queued messages, transcript fetches, prewarm, pairing, external sessions, and model auth status. Add a required `rg` audit gate that classifies every `/api`, `fetch`, `requestJson`, and `EventSource` call as runtime-targeted or local-shell-only, then updates the file map.

5. Lifecycle test isolation needs to be explicit.
   Do not rely on the in-process lifecycle harness for “two real servers”; it shares process env/module state. Use/extend `tests/lifecycle/harness/subprocess.ts` and add required route coverage in `subprocess-runner.ts` for bootstrap, auth, events/log, worker entries, settings, conversations, and cleanup.

6. Server identity/schema is too vague.
   Define the runtime descriptor schema: stable `serverId` source, duplicate-origin handling, tunnel/origin changes, required capability names, version compatibility, and incompatible-server behavior.

7. Sequence needs phase gates.
   Break implementation into: descriptor/schema, runtime boundary and call-site audit, server-scoped caches on default local server, SSE/worker isolation, UI directory, then cross-origin/auth. Each phase should keep current single-server behavior passing.

**Leave Alone**

Keep the unified worker stream requirement, localStorage for non-secret directory metadata, manager-owned React state, i18n requirements, approval-gated Playwright journeys, and future fleet/account-sync/admin ideas as non-goals.

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:47:40.180Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:47:40.180Z

The second-opinion verdict was `HARDEN`, and the findings are valid. I’m patching the plan now around the concrete gaps: cross-origin auth/CORS, standalone shell definition, existing `RuntimeAPIs` ownership, full API call-site audit, subprocess test isolation, descriptor schema, and phase gates.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:48:23.816Z","phase":null} -->
## Tool call: apply_patch · 2026-06-14T15:48:23.816Z

````json
*** Begin Patch
*** Update File: docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md
@@
-**Architecture:** Add a server-directory and runtime-client boundary in front of the existing runtime HTTP/SSE contracts. The current local Next/runtime server remains a valid target, but the renderer stops assuming every API request, SSE stream, worker-entry fetch, cache record, and auth query belongs to `window.location.origin`; all runtime-owned state is keyed by a stable `serverId` plus the existing run/worker/session cursors.
+**Architecture:** Extend the existing `src/runtime-api/*` boundary with a selected-server adapter and server-directory state. The current local Next/runtime server remains a valid target, but the renderer stops assuming every API request, SSE stream, worker-entry fetch, cache record, and auth query belongs to `window.location.origin`; all runtime-owned state is keyed by a stable `serverId` plus the existing run/worker/session cursors.
@@
 - Do not replace the unified worker conversation stream. Worker content remains fetched through the target server's `/api/workers/:workerId/entries` endpoint and rendered through `WorkerEntriesManager`/`Terminal`.
 - Do not add a parallel server-side persistence layer for remote conversations. Each OmniHarness server remains authoritative for its own runs, workers, messages, events, queued messages, settings, and auth.
+- Do not create a second competing runtime API abstraction. Build on `src/runtime-api/types.ts`, `src/runtime-api/web.ts`, `src/runtime-api/electron.ts`, `src/runtime-api/vscode.ts`, and `src/runtime-api/provider.tsx`.
 - Every new user-facing frontend string must be added to every file in `shared/locales/` and rendered with `t()`.
 - All new shared frontend state must be centralized in Manager classes with narrow subscriptions. Do not use independent component arrays as source-of-truth server lists.
@@
 **Operational Readiness:**
 
 - Bootstrap, health, auth-session, settings, event stream, worker entries, and mutation requests must all use bounded timeouts or cancellation through the runtime client.
 - Switching servers cancels or ownership-invalidates in-flight requests and SSE streams from the previous server.
+- Cross-origin access is a product feature, not just a frontend URL change. Remote servers must explicitly allow configured standalone UI origins, credentials, preflight requests, and SSE connection rules before the standalone client can treat them as usable.
 - Auth errors must show the target server and action that failed.
 - Version/capability mismatch must be explicit and recoverable.
 - Hot-path active-server bootstrap must not synchronously probe every known server; background health checks are bounded and staggered.
@@
 ## Architecture
+
+### Standalone Interface Definition
+
+This milestone includes two entry modes:
+
+- **Served local mode:** the current app is served by an OmniHarness runtime at an origin such as `http://localhost:3035`. This mode auto-registers the serving origin as the local/default server and must remain the simplest path.
+- **Standalone client mode:** the same renderer can boot without a server-authoritative `HomeBootstrapPayload` and prompts for a server URL. The implementation may serve this static client through the existing standalone HTTP server, Electron shell, or a dedicated static export entry, but the milestone is not complete until the app can render the server-directory empty state without requiring a local OmniHarness runtime to provide initial conversation data.
+
+Standalone acceptance criteria:
+
+- The renderer has a boot path where `initialEventState`, `initialQueries.session`, and `initialQueries.settings` are absent because no server is selected yet.
+- Adding a server probes `/api/runtime/bootstrap` on that target and transitions into normal authenticated/unauthenticated runtime flow.
+- Browser routing, selected run params, and pair-token params do not crash when no server exists.
+- The local served mode still works without any visible setup for single-server users.
 
 ### Server Directory
 
 Create a frontend `ServerDirectoryManager` that owns remembered servers and selected server state. It is the only source of truth for:
@@
 - local validation errors,
 - add/edit/remove dialog draft state.
 
 The manager persists only directory metadata to localStorage. It also exposes a current `serverToken`/generation that increments on selection, edit, removal, and explicit reconnect. Async code must carry this token and check it before mutating Managers, query caches, route state, worker stream state, or composer state.
 
-### Runtime Client Boundary
+### Runtime Descriptor Schema
+
+Add a versioned runtime descriptor to `/api/runtime/bootstrap` and `HomeBootstrapPayload`:
+
+```ts
+type RuntimeServerDescriptor = {
+  descriptorVersion: 1;
+  serverId: string;
+  origin: string;
+  displayName: string;
+  runtimeVersion: string;
+  capabilities: Array<
+    | "events.sse.v1"
+    | "events.log.v1"
+    | "events.snapshot.v1"
+    | "workers.entries.v1"
+    | "auth.cookie.v1"
+    | "settings.v1"
+    | "conversations.v1"
+    | "files.v1"
+    | "git.v1"
+    | "notifications.v1"
+  >;
+  standaloneInterfaceSupported: boolean;
+};
+```
+
+Descriptor rules:
+
+- For the server that serves the UI, derive `serverId` from the normalized origin and descriptor version unless a future durable installation id exists. Remote directory entries keep their generated local `serverId` stable even if display name changes.
+- Duplicate normalized origins map to one remembered server record; adding the same origin updates/probes the existing record instead of creating a duplicate.
+- If a tunnel URL points to the same underlying runtime as another origin, this milestone treats it as a separate server record unless the runtime exposes a durable installation id. The UI may warn about matching display/version but must not merge records by guesswork.
+- Missing required capabilities produce `incompatible` status with a precise list of missing capabilities.
+- Descriptor version mismatch is recoverable: the user can keep the server record, retry after upgrade, or remove the local record.
+- Tests must cover same origin, duplicate origin, changed display name, tunnel origin, missing capability, and unsupported descriptor version.
+
+### Runtime API Boundary
 
-Add a typed runtime client module used by all frontend network code:
+Extend the existing `RuntimeAPIs` contract instead of inventing a parallel client. Add a selected-server web adapter beneath `createWebRuntimeAPIs` so all runtime-targeted calls receive a `RuntimeServerRef`:
 
 ```ts
 type RuntimeServerRef = {
   serverId: string;
   origin: string;
@@
   generation: number;
 };
 
-type RuntimeClient = {
-  buildUrl(path: string): string;
-  requestJson<T>(path: string, init: RequestInit | undefined, fallback: AppErrorDescriptor): Promise<T>;
-  openEvents(args: { runId?: string | null; lastEventId?: string | null }): EventSource;
-  fetchSnapshot(args: { runId?: string | null; checksum?: string | null }): Promise<SnapshotPollResult>;
+type SelectedRuntimeTransport = {
+  server: RuntimeServerRef;
+  buildUrl(path: string): string;
+  requestJson<T>(path: string, init: RequestInit | undefined, fallback: AppErrorDescriptor): Promise<T>;
+  openEvents(args: { runId?: string | null; lastEventId?: string | null }, handlers: EventStreamHandlers): RuntimeSubscription;
+  fetchSnapshot(args: { runId?: string | null; checksum?: string | null }): Promise<SnapshotPollResult>;
 };
 ```
 
-The exact shape can change during implementation, but the boundary must prevent direct calls to hardcoded `"/api/..."` from app-state code that depends on the selected server. Local-only Next shell endpoints may remain relative if they do not target an OmniHarness runtime.
+The exact shape can change during implementation, but the boundary must preserve these ownership rules:
+
+- `RuntimeAPIs` remains the public renderer capability contract for web, Electron, and VS Code.
+- The selected-server web adapter is the only place that joins a remembered server origin with `/api/...` runtime paths.
+- Local-only shell endpoints may remain relative only after a call-site audit classifies them as local-shell-only.
+- Direct calls to hardcoded `"/api/..."` from app-state code that depends on the selected server are forbidden after this migration.
 
 ### Bootstrap Model
 
 Extend `HomeBootstrapPayload` with a runtime descriptor for the server that served the page:
@@
 When the page is served by an OmniHarness runtime, the interface auto-registers this origin as the local/current server and hydrates initial event/settings/session data under that `serverId`. When the page is served as a static/standalone interface, it starts without an initial runtime payload and prompts for a server.
+
+### Remote Access Policy
+
+To support a standalone UI hosted on a different origin from a target server, the target OmniHarness server must expose an explicit browser access policy. Add this as a server-side runtime feature, not as an implicit permissive CORS change:
+
+- Configured allowed UI origins, with local defaults for same-origin and explicit development origins only.
+- `OPTIONS` preflight handling for runtime routes that accept cross-origin requests.
+- `Access-Control-Allow-Origin` echo for allowed origins, never `*` when credentials are used.
+- `Access-Control-Allow-Credentials: true` for allowed credentialed requests.
+- Allowed methods/headers for JSON runtime calls.
+- SSE support with credentials. Native `EventSource` does not support arbitrary headers and only supports cookies when constructed with `{ withCredentials: true }`; the runtime API adapter must account for this.
+- Cookie strategy must be explicit. Current auth cookies are `SameSite=Lax`, which is not enough for true cross-site standalone access. The implementation must either add a secure cross-site cookie mode for explicitly allowed HTTPS origins (`SameSite=None; Secure`) or design an explicit token/session bridge for standalone clients.
+- Existing same-origin CSRF checks in auth routes must be revisited so cross-origin login is accepted only from configured standalone UI origins and still rejected from arbitrary sites.
+- Tests must cover protected server login/session from an allowed origin, disallowed origin rejection, preflight, SSE credentials, and logout/session revocation.
 
 ### Query And Cache Model
@@
 ### Error Model
@@
 Do not replace target server errors with generic "failed" text. Preserve server-provided stable codes and details when present.
+
+### Runtime Call-Site Audit
+
+Before migrating behavior, run and preserve an audit of every runtime-shaped call site:
+
+```bash
+rg -n "fetch\\(|requestJson\\(|new EventSource|/api/" src/app src/components src/lib src/runtime-api
+```
+
+Classify each call as:
+
+- `runtime-targeted`: must go through `RuntimeAPIs`/selected-server transport and include `serverId` in cache/ownership.
+- `local-shell-only`: remains relative because it targets the shell hosting the renderer rather than the selected OmniHarness server.
+- `server-internal`: stays server-side and is not part of browser server selection.
+
+Known runtime-targeted areas include auth/session/login/logout, settings saves, worker catalog, project files and file viewer, attachments, notifications, project memory, git workspace, queued-message mutations, transcript/history fetches, prewarm, pairing, external sessions, model auth status, conversation create/send, run actions, planning review/promote, events/log, and worker entries. The implementation checklist must update the file map if this audit finds additional modules.
*** End Patch

````

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:48:23.980Z","phase":null} -->
## Tool result: call_57HVO2NlRxk4OIlPrSz2ITi9 · 2026-06-14T15:48:23.980Z

```text
Exit code: 0
Wall time: 0.1 seconds
Output:
Success. Updated the following files:
M docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"user","timestamp":"2026-06-14T15:48:23.985Z","phase":null} -->
## User · 2026-06-14T15:48:23.985Z

Fuck homebrew, it's installed in local bin

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:48:35.958Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:48:35.958Z

Got it. I only checked PATH and Homebrew/system paths. I’ll check your local bin paths directly and use that binary if present.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:48:35.958Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:48:35.958Z

```json
{
  "cmd": "ls /Users/masterman/.local/bin/baton /Users/masterman/bin/baton",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 12000,
  "sandbox_permissions": "require_escalated",
  "justification": "Check the user's local bin locations for the requested baton CLI."
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:48:36.021Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:48:36.021Z

```json
{
  "cmd": "find /Users/masterman/.local/bin /Users/masterman/bin -maxdepth 1 -name 'baton*' -type f",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 12000,
  "sandbox_permissions": "require_escalated",
  "justification": "Find baton in common local user bin directories."
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:48:43.849Z","phase":null} -->
## Tool result: call_VVAQogsmvrLgOQD61rUUd0p8 · 2026-06-14T15:48:43.849Z

```text
Chunk ID: 9dd96a
Wall time: 0.0000 seconds
Process exited with code 1
Original token count: 23
Output:
ls: /Users/masterman/bin/baton: No such file or directory
/Users/masterman/.local/bin/baton

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:48:43.851Z","phase":null} -->
## Tool result: call_2fYOdKaFw0mrrXHgql3vVYix · 2026-06-14T15:48:43.851Z

```text
Chunk ID: 335c2e
Wall time: 0.0000 seconds
Process exited with code 1
Original token count: 14
Output:
find: /Users/masterman/bin: No such file or directory

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:48:47.823Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:48:47.823Z

Found it at `/Users/masterman/.local/bin/baton`. I’m checking its CLI shape now, then I’ll run the requested second-opinion review through it.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:48:49.635Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:48:49.635Z

```json
{
  "cmd": "/Users/masterman/.local/bin/baton --help",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 16000,
  "sandbox_permissions": "require_escalated",
  "justification": "Inspect the requested baton CLI usage before running the second-opinion review.",
  "prefix_rule": [
    "/Users/masterman/.local/bin/baton"
  ]
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:48:49.822Z","phase":null} -->
## Tool result: call_4W0FveqEuDGPiMhSeYILiJ3L · 2026-06-14T15:48:49.822Z

```text
Chunk ID: 58c67d
Wall time: 0.0000 seconds
Process exited with code 1
Original token count: 5
Output:
spawn claude ENOENT

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:48:53.749Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:48:53.749Z

`baton` runs, but it immediately fails because it tries to spawn `claude` and `claude` is not installed or not on `PATH` (`spawn claude ENOENT`). I’m going to inspect the script/options to see whether it supports a different model backend.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:48:55.373Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:48:55.373Z

```json
{
  "cmd": "file /Users/masterman/.local/bin/baton",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 12000,
  "sandbox_permissions": "require_escalated",
  "justification": "Inspect the local baton executable type to determine how to configure it."
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:49:03.024Z","phase":null} -->
## Tool result: call_x81PuBzOfqWz2CUgdLmUKgZl · 2026-06-14T15:49:03.024Z

```text
Chunk ID: 2914ea
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 26
Output:
/Users/masterman/.local/bin/baton: a /usr/bin/env node script text executable, Unicode text, UTF-8 text

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:49:06.235Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:49:06.235Z

Since it’s a Node script, I can safely read the top-level script to identify any environment variables or flags for provider selection.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:49:07.931Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:49:07.931Z

```json
{
  "cmd": "sed -n '1,260p' /Users/masterman/.local/bin/baton",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 26000,
  "sandbox_permissions": "require_escalated",
  "justification": "Read the local baton script to find supported configuration flags or provider environment variables."
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:49:10.057Z","phase":null} -->
## Tool result: call_8rEpl07ez2XUwkRSdio3vIOH · 2026-06-14T15:49:10.057Z

```text
Chunk ID: d58eab
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2282
Output:
#!/usr/bin/env node

import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_RUNNER_BACKEND_URL = "https://api.runner.now";
const CONFIG_DIR = process.env.RUNNER_CONFIG_DIR || path.join(os.homedir(), ".runner");
const CREDENTIALS_FILE = path.join(CONFIG_DIR, "credentials.enc");
const RUNNER_CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const COST_STATE_FILE = path.join(CONFIG_DIR, "baton-cost.json");
const COST_PRICING_OVERRIDE_FILE = path.join(CONFIG_DIR, "baton-pricing.json");
const COST_SESSION_PRUNE_MS = 30 * 24 * 60 * 60 * 1000;
const CLAUDE_BIN = process.env.CLAUDE_BIN || "claude";
const CLAUDE_DANGEROUS_SKIP_PERMISSIONS_ARG = "--dangerously-skip-permissions";
const CLAUDE_THINKING_DISPLAY_ARG = "--thinking-display";
const CLAUDE_THINKING_DISPLAY_VALUE = "summarized";

// USD per 1M tokens. Verify against https://www.anthropic.com/pricing.
// Override per-machine by writing the same shape to ~/.runner/baton-pricing.json.
const COST_PRICING_USD_PER_MTOK = {
  "claude-opus-4-7":   { input: 15, output: 75, cacheRead: 1.5,  cache5m: 18.75, cache1h: 30 },
  "claude-opus-4-6":   { input: 15, output: 75, cacheRead: 1.5,  cache5m: 18.75, cache1h: 30 },
  "claude-opus-4-5":   { input: 15, output: 75, cacheRead: 1.5,  cache5m: 18.75, cache1h: 30 },
  "claude-sonnet-4-6": { input:  3, output: 15, cacheRead: 0.30, cache5m:  3.75, cache1h:  6 },
  "claude-sonnet-4-5": { input:  3, output: 15, cacheRead: 0.30, cache5m:  3.75, cache1h:  6 },
  "claude-haiku-4-5":  { input:  1, output:  5, cacheRead: 0.10, cache5m:  1.25, cache1h:  2 },
};

const MAGIC = Buffer.from("CRAFT01\0");
const HEADER_SIZE = 64;
const MAGIC_SIZE = 8;
const FLAGS_SIZE = 4;
const SALT_SIZE = 32;
const IV_SIZE = 12;
const AUTH_TAG_SIZE = 16;
const KEY_SIZE = 32;
const PBKDF2_ITERATIONS = 100000;
const REFRESH_BUFFER_MS = 7 * 24 * 60 * 60 * 1000;

function safeReadJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function decodeJwtPayload(token) {
  const parts = token.split(".");
  if (parts.length < 2) throw new Error("Runner auth token is not a JWT.");
  return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
}

function jwtExpiresAtMs(token) {
  return decodeJwtPayload(token).exp * 1000;
}

function modelLabel(model) {
  if (typeof model === "string") return model;
  return model?.id || model?.name || JSON.stringify(model);
}

function getStableMachineId() {
  if (process.platform === "darwin") {
    try {
      const output = childProcess.execFileSync(
        "ioreg",
        ["-rd1", "-c", "IOPlatformExpertDevice"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      );
      const match = output.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
      if (match) return match[1];
    } catch {}
  }

  return `${os.userInfo().username}:${os.homedir()}`;
}

function deriveKey(salt, { legacy = false } = {}) {
  const idHash = crypto.createHash("sha256");
  if (legacy) {
    idHash.update(os.hostname());
    idHash.update(os.userInfo().username);
    idHash.update(os.homedir());
    idHash.update("orchestrator-v1");
  } else {
    idHash.update(getStableMachineId());
    idHash.update("orchestrator-v2");
  }

  return crypto.pbkdf2Sync(
    idHash.digest(),
    salt,
    PBKDF2_ITERATIONS,
    KEY_SIZE,
    "sha256",
  );
}

function splitCredentialFile(buffer) {
  if (buffer.length < HEADER_SIZE + AUTH_TAG_SIZE) {
    throw new Error(`Credential file is too small: ${CREDENTIALS_FILE}`);
  }

  if (!buffer.subarray(0, MAGIC_SIZE).equals(MAGIC)) {
    throw new Error(`Unsupported Runner credential file magic: ${CREDENTIALS_FILE}`);
  }

  const saltOffset = MAGIC_SIZE + FLAGS_SIZE;
  const encryptedData = buffer.subarray(HEADER_SIZE);
  return {
    salt: buffer.subarray(saltOffset, saltOffset + SALT_SIZE),
    iv: encryptedData.subarray(0, IV_SIZE),
    authTag: encryptedData.subarray(IV_SIZE, IV_SIZE + AUTH_TAG_SIZE),
    ciphertext: encryptedData.subarray(IV_SIZE + AUTH_TAG_SIZE),
  };
}

function decryptWith(buffer, legacy) {
  const parts = splitCredentialFile(buffer);
  const decipher = crypto.createDecipheriv("aes-256-gcm", deriveKey(parts.salt, { legacy }), parts.iv);
  decipher.setAuthTag(parts.authTag);
  const plaintext = Buffer.concat([decipher.update(parts.ciphertext), decipher.final()]);
  return { store: JSON.parse(plaintext.toString("utf8")), salt: parts.salt, legacy };
}

function decryptStore() {
  const buffer = fs.readFileSync(CREDENTIALS_FILE);
  try {
    return decryptWith(buffer, false);
  } catch (error) {
    try {
      return decryptWith(buffer, true);
    } catch {
      throw error;
    }
  }
}

function encryptStore(store, salt) {
  const iv = crypto.randomBytes(IV_SIZE);
  const key = deriveKey(salt);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(store), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  const header = Buffer.alloc(HEADER_SIZE);
  MAGIC.copy(header, 0);
  header.writeUInt32LE(0, MAGIC_SIZE);
  salt.copy(header, MAGIC_SIZE + FLAGS_SIZE);
  return Buffer.concat([header, iv, authTag, ciphertext]);
}

function saveStore(store, salt) {
  const encrypted = encryptStore(store, salt);
  const backupPath = `${CREDENTIALS_FILE}.baton.bak`;
  try {
    fs.copyFileSync(CREDENTIALS_FILE, backupPath, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(backupPath, 0o600);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  fs.writeFileSync(CREDENTIALS_FILE, encrypted, { mode: 0o600 });
}

function getCredentialEntries(store) {
  if (Array.isArray(store.credentials)) return store.credentials;
  if (Array.isArray(store.entries)) return store.entries;
  throw new Error("Runner credential store has no credentials/entries array.");
}

function findRunnerAuthCredential(store) {
  if (store.credentials && typeof store.credentials === "object" && !Array.isArray(store.credentials)) {
    const authEntry = store.credentials["auth::global"];
    if (authEntry) return authEntry;
  }

  const entries = getCredentialEntries(store);
  const authEntry = entries.find((entry) => entry?.key === "auth::global");
  if (!authEntry) {
    throw new Error("Runner auth credential auth::global was not found.");
  }
  return authEntry;
}

function getExpiresAt(authEntry) {
  if (Number.isFinite(authEntry.expiresAt)) return authEntry.expiresAt;
  if (typeof authEntry.value === "string") return jwtExpiresAtMs(authEntry.value);
  return 0;
}

function getDefaultRunnerConnection() {
  const config = safeReadJson(RUNNER_CONFIG_FILE, {});
  const defaultSlug = config.defaultLlmConnection;
  const connection = Array.isArray(config.llmConnections)
    ? config.llmConnections.find((item) => item.slug === defaultSlug)
    : null;
  return { config, defaultSlug, connection };
}

function getRunnerBaseUrl() {
  if (process.env.RUNNER_BACKEND_URL) return process.env.RUNNER_BACKEND_URL;
  const { connection } = getDefaultRunnerConnection();
  return connection?.baseUrl || DEFAULT_RUNNER_BACKEND_URL;
}

async function refreshRunnerAuth(refreshToken, backendUrl) {
  const response = await fetch(`${backendUrl}/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Runner auth refresh failed (${response.status}): ${text.slice(0, 200)}`);
  }

  const data = JSON.parse(text);
  if (!data.access_token || !data.refresh_token) {
    throw new Error("Runner auth refresh response did not include access_token and refresh_token.");
  }
  return data;
}

async function getRunnerAuthToken(backendUrl) {
  const decrypted = decryptStore();
  const authEntry = findRunnerAuthCredential(decrypted.store);
  const token = [REDACTED]
  if (!token || typeof token !== "string") {
    throw new Error("Runner auth credential has no access token value.");
  }

  const expiresAt = getExpiresAt(authEntry);
  const shouldRefresh = authEntry.refreshToken && Date.now() + REFRESH_BUFFER_MS >= expiresAt;
  if (!shouldRefresh) return token;

  try {
    const refreshed = await refreshRunnerAuth(authEntry.refreshToken, backendUrl);
    authEntry.value = refreshed.access_token;
    authEntry.refreshToken = refreshed.refresh_token;
    authEntry.expiresAt = jwtExpiresAtMs(refreshed.access_token);
    decrypted.store.metadata = { ...decrypted.store.metadata, updatedAt: Date.now() };
    saveStore(decrypted.store, decrypted.salt);
    return authEntry.value;
  } catch (error) {
    if (expiresAt > Date.now()) {
      console.error(`Runner auth refresh failed, using still-valid existing token: [REDACTED]
      return token;
    }
    throw error;
  }
}

function printStatus() {
  const { config, defaultSlug, connection } = getDefaultRunnerConnection();

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:49:14.457Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:49:14.457Z

```json
{
  "cmd": "sed -n '260,620p' /Users/masterman/.local/bin/baton",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 30000,
  "sandbox_permissions": "require_escalated",
  "justification": "Continue reading baton script to identify supported commands and required CLI arguments."
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:49:16.510Z","phase":null} -->
## Tool result: call_LzybJWGbQ0T6gWGSCANFRrnk · 2026-06-14T15:49:16.510Z

```text
Chunk ID: 80097e
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2054
Output:
  const { config, defaultSlug, connection } = getDefaultRunnerConnection();
  const decrypted = decryptStore();
  const authEntry = findRunnerAuthCredential(decrypted.store);
  const expiresAt = getExpiresAt(authEntry);
  const models = connection?.models || [];

  console.log(JSON.stringify({
    route: "runner",
    claudeBinary: CLAUDE_BIN,
    runnerConfigDir: CONFIG_DIR,
    runnerBackendUrl: getRunnerBaseUrl(),
    defaultConnection: {
      slug: defaultSlug,
      name: connection?.name || null,
      providerType: connection?.providerType || null,
      authType: connection?.authType || null,
      defaultModel: connection?.defaultModel || config.defaultModel || null,
    },
    credential: {
      hasRefreshToken: Boolean(authEntry.refreshToken),
      expiresAtIso: expiresAt ? new Date(expiresAt).toISOString() : null,
    },
    runnerModels: models.map(modelLabel),
  }, null, 2));
}

function printModels() {
  const { connection } = getDefaultRunnerConnection();
  for (const model of connection?.models || []) {
    console.log(modelLabel(model));
  }
}

async function printToken() {
  const token = await getRunnerAuthToken(getRunnerBaseUrl());
  process.stdout.write(`${token}\n`);
}

async function printCredentialProfile() {
  const backendUrl = getRunnerBaseUrl();
  const token = await getRunnerAuthToken(backendUrl);
  process.stdout.write(`${JSON.stringify({
    env: {
      ANTHROPIC_BASE_URL: backendUrl,
      ANTHROPIC_AUTH_TOKEN: token,
    },
    unset: ["ANTHROPIC_API_KEY"],
    expiresAt: new Date(jwtExpiresAtMs(token)).toISOString(),
  })}\n`);
}

function readStdinSafe() {
  if (process.stdin.isTTY) return "";
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function readCostState() {
  const parsed = safeReadJson(COST_STATE_FILE, null);
  if (parsed && typeof parsed === "object") {
    return {
      lifetimeUsd: Number.isFinite(parsed.lifetimeUsd) ? parsed.lifetimeUsd : 0,
      startedAt: Number.isFinite(parsed.startedAt) ? parsed.startedAt : Date.now(),
      sessions: parsed.sessions && typeof parsed.sessions === "object" ? parsed.sessions : {},
    };
  }
  return { lifetimeUsd: 0, startedAt: Date.now(), sessions: {} };
}

function writeCostState(state) {
  const tmpPath = `${COST_STATE_FILE}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), { mode: 0o600 });
  fs.renameSync(tmpPath, COST_STATE_FILE);
}

function pruneStaleSessions(state) {
  const cutoff = Date.now() - COST_SESSION_PRUNE_MS;
  for (const [id, entry] of Object.entries(state.sessions)) {
    if (!entry?.lastSeen || entry.lastSeen < cutoff) {
      delete state.sessions[id];
    }
  }
}

function recordSessionCost(sessionId, sessionCostUsd) {
  if (!sessionId || !Number.isFinite(sessionCostUsd) || sessionCostUsd < 0) return;
  const state = readCostState();
  const prev = state.sessions[sessionId]?.lastKnownUsd;
  const delta = Number.isFinite(prev) ? Math.max(0, sessionCostUsd - prev) : sessionCostUsd;
  state.lifetimeUsd = (state.lifetimeUsd || 0) + delta;
  state.sessions[sessionId] = { lastKnownUsd: sessionCostUsd, lastSeen: Date.now() };
  pruneStaleSessions(state);
  try {
    writeCostState(state);
  } catch {
    // best-effort, do not break the caller if write fails
  }
}

function loadPricingTable() {
  const overrides = safeReadJson(COST_PRICING_OVERRIDE_FILE, null);
  if (overrides && typeof overrides === "object") {
    return { ...COST_PRICING_USD_PER_MTOK, ...overrides };
  }
  return COST_PRICING_USD_PER_MTOK;
}

function costForUsage(table, modelId, usage) {
  const p = table[modelId];
  if (!p || !usage) return 0;
  const cacheCreation = usage.cache_creation || {};
  let c5m = Number(cacheCreation.ephemeral_5m_input_tokens) || 0;
  let c1h = Number(cacheCreation.ephemeral_1h_input_tokens) || 0;
  if (!c5m && !c1h && Number(usage.cache_creation_input_tokens)) {
    c5m = Number(usage.cache_creation_input_tokens);
  }
  const perTok = (perMtok) => perMtok / 1_000_000;
  return (
    (Number(usage.input_tokens) || 0) * perTok(p.input) +
    (Number(usage.output_tokens) || 0) * perTok(p.output) +
    (Number(usage.cache_read_input_tokens) || 0) * perTok(p.cacheRead) +
    c5m * perTok(p.cache5m) +
    c1h * perTok(p.cache1h)
  );
}

function sumTranscriptCost(transcriptPath) {
  const table = loadPricingTable();
  let total = 0;
  const unknownModels = new Set();
  let raw;
  try {
    raw = fs.readFileSync(transcriptPath, "utf8");
  } catch {
    return { total: 0, unknownModels: [] };
  }
  for (const line of raw.split("\n")) {
    if (!line) continue;
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (entry?.type !== "assistant") continue;
    const msg = entry.message || {};
    const model = msg.model;
    if (!model) continue;
    if (!table[model]) { unknownModels.add(model); continue; }
    total += costForUsage(table, model, msg.usage);
  }
  return { total, unknownModels: [...unknownModels] };
}

function recordStopHook() {
  if (!process.env.ANTHROPIC_BASE_URL) return;
  let payload;
  try { payload = JSON.parse(readStdinSafe()); } catch { return; }
  const sessionId = typeof payload?.session_id === "string" ? payload.session_id : "";
  const transcriptPath = typeof payload?.transcript_path === "string" ? payload.transcript_path : "";
  if (!sessionId || !transcriptPath) return;
  const { total, unknownModels } = sumTranscriptCost(transcriptPath);
  if (unknownModels.length) {
    console.error(`baton: no pricing for models, skipped: ${unknownModels.join(", ")}. Add to ${COST_PRICING_OVERRIDE_FILE}.`);
  }
  recordSessionCost(sessionId, total);
}

function printStatusline() {
  let effort = "";
  try {
    const parsed = JSON.parse(readStdinSafe());
    if (parsed?.effort?.level) effort = String(parsed.effort.level);
  } catch {}

  const baseUrl = process.env.ANTHROPIC_BASE_URL || "";
  let route = "claude max";
  if (baseUrl) {
    try { route = new URL(baseUrl).host; } catch { route = baseUrl; }
  }

  const parts = [];
  if (effort) parts.push(effort);
  parts.push(route);
  if (baseUrl) {
    const lifetime = readCostState().lifetimeUsd || 0;
    parts.push(`$${lifetime.toFixed(2)}`);
  }
  console.log(parts.join(" · "));
}

function printCost() {
  const state = readCostState();
  console.log(JSON.stringify({
    lifetimeUsd: Number((state.lifetimeUsd || 0).toFixed(4)),
    trackingSinceIso: state.startedAt ? new Date(state.startedAt).toISOString() : null,
    activeSessionsTracked: Object.keys(state.sessions).length,
    stateFile: COST_STATE_FILE,
    note: "Estimated by summing per-assistant-message token usage from session transcripts and applying Anthropic's published model rates. Runner's actual billing may differ.",
  }, null, 2));
}

function getClaudeArgs(args) {
  const injectedArgs = [];
  if (!args.includes(CLAUDE_DANGEROUS_SKIP_PERMISSIONS_ARG)) {
    injectedArgs.push(CLAUDE_DANGEROUS_SKIP_PERMISSIONS_ARG);
  }
  if (!args.includes(CLAUDE_THINKING_DISPLAY_ARG)) {
    injectedArgs.push(CLAUDE_THINKING_DISPLAY_ARG, CLAUDE_THINKING_DISPLAY_VALUE);
  }
  return [...injectedArgs, ...args];
}

const SUBCOMMANDS = {
  status: printStatus,
  doctor: printStatus,
  models: printModels,
  token: [REDACTED]
  "credential-profile": printCredentialProfile,
  statusline: printStatusline,
  cost: printCost,
  "stop-hook": recordStopHook,
};

async function main() {
  const args = process.argv.slice(2);
  const subcommand = SUBCOMMANDS[args[0]];
  if (subcommand) { await subcommand(); return; }

  const backendUrl = getRunnerBaseUrl();
  const authToken = await getRunnerAuthToken(backendUrl);

  const env = {
    ...process.env,
    ANTHROPIC_BASE_URL: backendUrl,
    ANTHROPIC_AUTH_TOKEN: authToken,
  };
  delete env.ANTHROPIC_API_KEY;

  const child = childProcess.spawn(CLAUDE_BIN, getClaudeArgs(args), { env, stdio: "inherit" });

  child.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });

  child.on("exit", (code, signal) => {
    if (signal) { process.kill(process.pid, signal); return; }
    process.exitCode = code ?? 1;
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:49:25.232Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:49:25.232Z

`baton` is a wrapper around Claude Code; it uses `CLAUDE_BIN` or defaults to `claude`. I’m checking whether Claude is also in your local bin and, if so, I’ll run baton with `CLAUDE_BIN` set to that path.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:49:25.234Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:49:25.234Z

```json
{
  "cmd": "ls /Users/masterman/.local/bin/claude /Users/masterman/bin/claude",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 12000,
  "sandbox_permissions": "require_escalated",
  "justification": "Check local bin paths for the Claude CLI required by baton."
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:49:25.272Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:49:25.272Z

```json
{
  "cmd": "find /Users/masterman/.local/bin -maxdepth 1 -name 'claude*' -type f",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 12000,
  "sandbox_permissions": "require_escalated",
  "justification": "Find the Claude CLI required by baton in the user's local bin."
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:49:32.278Z","phase":null} -->
## Tool result: call_AbHKJooSn8Q54QuksgZ9oiXa · 2026-06-14T15:49:32.278Z

```text
Chunk ID: e617c1
Wall time: 0.0000 seconds
Process exited with code 1
Original token count: 24
Output:
ls: /Users/masterman/bin/claude: No such file or directory
/Users/masterman/.local/bin/claude

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:49:32.280Z","phase":null} -->
## Tool result: call_tZEAzH9j8VN30bDNCXsuTOrT · 2026-06-14T15:49:32.280Z

```text
Chunk ID: 19b783
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 0
Output:

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-06-14T15:49:34.642Z","phase":null} -->
## Task state: turn_aborted · 2026-06-14T15:49:34.642Z

```text
{
  "type": "turn_aborted",
  "turn_id": "019ec6c7-4e78-7b02-a7a0-08736fdb106f",
  "reason": "interrupted",
  "completed_at": 1781452174,
  "duration_ms": 763554
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-06-14T15:49:50.878Z","phase":null} -->
## Task state: task_started · 2026-06-14T15:49:50.878Z

```text
{
  "type": "task_started",
  "turn_id": "019ec6d3-3456-7de1-9274-26402700f70f",
  "started_at": 1781452190,
  "model_context_window": 258400,
  "collaboration_mode_kind": "default"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"user","timestamp":"2026-06-14T15:49:50.889Z","phase":null} -->
## User · 2026-06-14T15:49:50.889Z

Just run baton as is, no need to set anything up

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:50:04.725Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:50:04.725Z

I’ll run the local `baton` binary directly and let it use its default behavior.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:50:08.740Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:50:08.740Z

```json
{
  "cmd": "/Users/masterman/.local/bin/baton -p \"You are my second-opinion planning reviewer. Review the artifact without editing files. Artifact: /Users/masterman/NLP/omniharness/docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md. User goal: support multiple OmniHarness servers inside the same running app by turning the interface into a standalone thing that can connect to multiple servers. Context and constraints: no branches, no worktrees, no file deletion; preserve unified worker stream; all frontend strings through shared/locales and t(); manager-owned React state; server decisions through named events; lifecycle tests via HTTP/SSE. Please judge whether this plan is ready to use. Look for missing requirements, vague tasks, fake components/mocks/fallback behavior, scope creep needing confirmation, missing ownership/state/persistence/instrumentation/error/verification details, sequencing problems, and test gaps. Return: 1. Verdict READY or HARDEN 2. Highest-impact findings with concrete fixes 3. Anything you would deliberately leave alone.\"",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 30000,
  "max_output_tokens": 40000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:50:08.869Z","phase":null} -->
## Tool result: call_q5jV1eZJvIk66Z5WVFSn7Bum · 2026-06-14T15:50:08.869Z

```text
Chunk ID: 4486ae
Wall time: 0.0000 seconds
Process exited with code 1
Original token count: 5
Output:
spawn claude ENOENT

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:50:14.812Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:50:14.812Z

`baton` itself ran, but it failed immediately because its child process lookup cannot find `claude` on `PATH`. Since both binaries are in `~/.local/bin`, I’m rerunning with that directory prepended to `PATH` for this command only.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:50:19.768Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:50:19.768Z

```json
{
  "cmd": "PATH=/Users/masterman/.local/bin:$PATH /Users/masterman/.local/bin/baton -p \"You are my second-opinion planning reviewer. Review the artifact without editing files. Artifact: /Users/masterman/NLP/omniharness/docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md. User goal: support multiple OmniHarness servers inside the same running app by turning the interface into a standalone thing that can connect to multiple servers. Context and constraints: no branches, no worktrees, no file deletion; preserve unified worker stream; all frontend strings through shared/locales and t(); manager-owned React state; server decisions through named events; lifecycle tests via HTTP/SSE. Please judge whether this plan is ready to use. Look for missing requirements, vague tasks, fake components/mocks/fallback behavior, scope creep needing confirmation, missing ownership/state/persistence/instrumentation/error/verification details, sequencing problems, and test gaps. Return: 1. Verdict READY or HARDEN 2. Highest-impact findings with concrete fixes 3. Anything you would deliberately leave alone.\"",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 30000,
  "max_output_tokens": 50000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:50:49.944Z","phase":null} -->
## Tool result: call_XvMzHHBlslEjE1D4AGqeKVRf · 2026-06-14T15:50:49.944Z

```text
Chunk ID: d8cc2a
Wall time: 30.0010 seconds
Process running with session ID 27945
Original token count: 0
Output:

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:50:54.702Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:50:54.702Z

`baton` is running now with the local bin path available. I’ll wait for the review result and then fold concrete findings into the plan.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:50:55.467Z","phase":null} -->
## Tool call: write_stdin · 2026-06-14T15:50:55.467Z

```json
{
  "session_id": 27945,
  "chars": "",
  "yield_time_ms": 30000,
  "max_output_tokens": 50000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:51:25.473Z","phase":null} -->
## Tool result: call_yIfEf99kWomvcHUvVTjOHqsQ · 2026-06-14T15:51:25.473Z

```text
Chunk ID: dc7cfd
Wall time: 30.0005 seconds
Process running with session ID 27945
Original token count: 0
Output:

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:51:28.695Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:51:28.695Z

No output yet; the Baton/Claude review is still running.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:51:29.489Z","phase":null} -->
## Tool call: write_stdin · 2026-06-14T15:51:29.489Z

```json
{
  "session_id": 27945,
  "chars": "",
  "yield_time_ms": 30000,
  "max_output_tokens": 50000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:51:59.492Z","phase":null} -->
## Tool result: call_CysaBJibouGqu8US1Hug3R4e · 2026-06-14T15:51:59.492Z

```text
Chunk ID: 5c24f2
Wall time: 30.0019 seconds
Process running with session ID 27945
Original token count: 0
Output:

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:52:02.165Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:52:02.165Z

Still waiting on Baton. While it runs, I’m not changing the plan further so I can apply the review findings cleanly.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:52:02.850Z","phase":null} -->
## Tool call: write_stdin · 2026-06-14T15:52:02.850Z

```json
{
  "session_id": 27945,
  "chars": "",
  "yield_time_ms": 30000,
  "max_output_tokens": 50000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:52:32.854Z","phase":null} -->
## Tool result: call_2J6hPfNEPK6N28jzJGZXeYOL · 2026-06-14T15:52:32.854Z

```text
Chunk ID: 899c9d
Wall time: 30.0032 seconds
Process running with session ID 27945
Original token count: 0
Output:

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:52:36.558Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:52:36.558Z

Baton has been silent for about two minutes, which is normal for a larger Claude Code pass but I’m watching it so it doesn’t get left running.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:52:37.093Z","phase":null} -->
## Tool call: write_stdin · 2026-06-14T15:52:37.093Z

```json
{
  "session_id": 27945,
  "chars": "",
  "yield_time_ms": 60000,
  "max_output_tokens": 50000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:52:43.496Z","phase":null} -->
## Tool result: call_DDMwNSt2hq7Xmd4kuzoyiAW8 · 2026-06-14T15:52:43.496Z

```text
Chunk ID: d19a6d
Wall time: 6.4021 seconds
Process exited with code 0
Original token count: 1908
Output:
I've grounded the review in the actual code. Here's my assessment.

## 1. Verdict: **HARDEN**

The plan is unusually disciplined on ownership/state/persistence invariants and correctly refuses fakes. But its central architectural premise is built on a boundary the renderer **does not actually use today**, and it folds a security-sensitive backend milestone (cross-site CORS/cookies/CSRF) into what's framed as a frontend effort. Both need resolution before execution.

## 2. Highest-impact findings

**F1 — The runtime client is triple-specified, and the real injection point is misidentified. (Blocking)**
- Architecture §"Runtime API Boundary" (L212–237) says *extend `RuntimeAPIs`* under `createWebRuntimeAPIs` and calls it "the only place that joins origin with `/api/...`."
- The File Map creates a *third* thing: `src/app/home/runtime-client.ts`.
- Reality: **0 files in `src/app`/`src/components` import `RuntimeAPIs`.** The provider is mounted in `OmniApp.tsx` but the app does ~all HTTP through `requestJson()` in `src/lib/app-errors.ts` plus raw `fetch()` in managers. `RuntimeAPIs` covers ~6 endpoints; the real surface is ~40+ call sites on `requestJson`/`fetch`.

So "extend `RuntimeAPIs`, it's the only join point" is false. **Fix:** pick ONE injection point and state it. The cheapest correct one is to give `requestJson` (and the SSE URL builders) a `RuntimeServerRef`/baseUrl, thread it from a selected-server context, and declare *that* the client. Then explicitly say whether `runtime-client.ts` wraps `requestJson`, whether `RuntimeAPIs` is widened or left frozen, and delete the contradiction. Until this is resolved the migration scope is unknowable — every other task inherits the ambiguity.

**F2 — The call-site audit is a prerequisite, not a mid-stream step.**
The plan defers the `rg` audit to "before migrating behavior," but the file map, task sizing, and runtime-vs-local-shell classification all depend on it. The audit surface already shows non-obvious cases that need an ownership decision *now*: `useConversationActions.ts` fires fire-and-forget `fetch("/api/settings")` (won't carry a server ref by default), `HomeApp.tsx:755` prewarm `fetch`, `ConversationNotificationManager` polling `fetch("/api/notifications")`, `GitWorkspaceManager` raw `fetch`. **Fix:** make the audit task 0; commit the classified table into the architecture doc; make the file map a product of it, not a guess.

**F3 — Cross-origin CORS/cookie/CSRF is a separate backend milestone smuggled in as one subsection.**
§Remote Access Policy (L252–263) requires configurable allowed origins, OPTIONS preflight on runtime routes, ACAO echo, ACAC, a `SameSite=None; Secure` cookie mode *or* a token bridge, and revisiting CSRF on auth routes. That touches every API route's middleware and is security-sensitive — yet there is **no checklist task for it** (the checklist L470–554 has nothing for CORS/cookie/CSRF). Meanwhile "switch servers" cannot work cross-origin without it. **Fix:** decide explicitly — either (a) scope this milestone to same-origin + localhost/dev-CORS and defer true cross-site to a named follow-up plan, or (b) add explicit checklist tasks + tests for the backend CORS/cookie/CSRF work. As written it's both load-bearing and unscheduled. This is the scope-creep item that needs user confirmation.

**F4 — SSE credentials: contract literally can't pass the option, and there's a silent-failure trap.**
`web.ts` types `EventSourceConstructor = new (url: string)` and constructs `new EventSourceCtor(url)` — no options arg, so `{ withCredentials: true }` is impossible without a signature change. And `LiveEventConnectionManager.ts:102/107` builds raw relative `/api/events` URLs, bypassing runtime-api entirely. The plan notes the withCredentials caveat in prose but doesn't make the signature change + the manager's URL-builder swap explicit tasks with tests. Separately: cross-site cookie SSE needs `SameSite=None; Secure` → HTTPS only, so `http://` LAN/tunnel targets will silently fail authed SSE. **Fix:** make both code changes explicit tasks; document the http-target SSE-auth limitation as a known constraint up front, not a runtime surprise.

**F5 — Standalone static-boot is the hardest deliverable and the vaguest.**
§Standalone Interface Definition offers three entry mechanisms ("standalone HTTP server, Electron shell, or a dedicated static export") with no decision, while HomeApp (1407 lines) currently hard-depends on the SSR `HomeBootstrapPayload`. Booting with `initialEventState`/`session`/`settings` absent is a deep hydration change. **Fix:** pick the entry mechanism; add an explicit task + test that mounts HomeApp with a null bootstrap and renders the empty state without crashing on routing/pair-token params.

**F6 — `serverId` derivation orphans caches and forecloses future merge.**
L204 derives the served server's `serverId` from normalized origin + descriptor version. Same physical server via localhost vs LAN IP vs tunnel = three serverIds, three cache namespaces, potential duplicate optimistic state (acknowledged at L206 but only as a warning). **Fix:** add a durable `installationId` to `RuntimeServerDescriptor` now (persist a uuid server-side — cheap). It stabilizes identity across origins and leaves the door open to safe future merge; without it every reverse-proxy/port change orphans the local cache.

**F7 — Test gaps on the invariant most likely to regress.**
The lifecycle scenario covers reconnect, but nothing asserts the *negative*: a stale SSE event from generation N-1 is dropped under rapid switching. Also missing: corrupt/garbage `localStorage` record recovery (migration is covered, malformed JSON isn't); and the "mutation resolves after switch" story (L137) needs a composer/navigation assertion, not just a cache-layer unit test. **Fix:** add explicit generation-fencing and corrupt-storage tests.

**F8 — A vague "if/otherwise" task on diagnostics events.**
L87 says emit `server.selected`/`server.probe.*` "if an existing frontend diagnostics surface can consume them; otherwise model them in `ServerDirectoryManager`." That's an unresolved fork. **Fix:** name the actual surface (or confirm none exists) and commit to one path before execution.

## 3. What I'd deliberately leave alone

These are good, correct decisions — don't churn them:
- **Each server authoritative; no parallel persistence; worker stream unchanged, keyed `serverId+workerId`.** Cleanly respects the constraints and the unified-stream rule.
- **`serverId + generation` ownership token model**, with provenance/fallback rules. This is the strongest part of the plan; keep it verbatim.
- **Refusing to merge tunnel/origin "by guesswork"** and the duplicate-origin descriptor rules (L206–209) — correct, and the unit-test matrix for them is well chosen.
- **Versioned `localStorage` key, no credentials in the directory, server-owned cookie auth.** Right trust boundary.
- **Keeping server *decisions* in the target server's named events and treating selection as client UI state** (L86, L355) — correctly honors the named-events constraint; only the diagnostics-event fork (F8) needs tightening.
- **The "no fakes / no synthetic health" final standard** and approval-gated journey tests — keep as guardrails.

**Bottom line:** resolve F1 (one client, real injection point) and F3 (confirm or split the cross-origin backend scope) before anyone starts coding — those two determine whether the rest of the file map is even correct. F2 and F4–F6 are concrete hardening. The invariant model underneath is genuinely solid.

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:52:59.752Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:52:59.752Z

Baton returned `HARDEN` with sharper findings than the fallback reviewer. I’m applying those now: one real selected-server transport injection point, audit-first sequencing, explicit cross-origin backend tasks, `EventSource` credentials, null-bootstrap standalone acceptance, durable installation id, generation-fencing tests, and a concrete diagnostics path.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:52:59.752Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:52:59.752Z

```json
{
  "cmd": "sed -n '1,200p' src/ui/OmniApp.tsx",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 16000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:52:59.757Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:52:59.757Z

```json
{
  "cmd": "sed -n '1,200p' src/ui/render-web.tsx",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 16000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:52:59.762Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:52:59.762Z

```json
{
  "cmd": "sed -n '1,200p' src/runtime-api/provider.tsx",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 16000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:52:59.795Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:52:59.795Z

```json
{
  "cmd": "nl -ba docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md | sed -n '1,620p'",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 50000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:52:59.818Z","phase":null} -->
## Tool result: call_a2o9XvW2supWyo3wtzaMd6EI · 2026-06-14T15:52:59.818Z

```text
Chunk ID: 2a8af3
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 219
Output:
"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { BootShell } from "@/components/BootShell";
import type { HomeBootstrapPayload } from "@/runtime/bootstrap";
import type { RuntimeAPIs } from "@/runtime-api/types";
import { RuntimeApiProvider, createDefaultWebRuntimeAPIs } from "@/runtime-api/provider";

const HomeApp = dynamic(
  () => import("@/app/home/HomeApp").then((module) => module.HomeApp),
  {
    ssr: false,
    loading: () => <BootShell />,
  },
);

export function OmniApp({
  bootstrap,
  runtimeApis,
}: {
  bootstrap: HomeBootstrapPayload;
  runtimeApis?: RuntimeAPIs;
}) {
  const defaultRuntimeApis = useMemo(() => runtimeApis ?? createDefaultWebRuntimeAPIs(), [runtimeApis]);

  return (
    <RuntimeApiProvider apis={defaultRuntimeApis}>
      <HomeApp bootstrap={bootstrap} />
    </RuntimeApiProvider>
  );
}

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:52:59.818Z","phase":null} -->
## Tool result: call_z9j8jbwKRtF0bcytq06FB9St · 2026-06-14T15:52:59.818Z

```text
Chunk ID: 1e9804
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 305
Output:
"use client";

import React from "react";
import { createRoot } from "react-dom/client";
import { t } from "@/lib/i18n";
import { OmniApp } from "@/ui/OmniApp";
import { createElectronRuntimeAPIs } from "@/runtime-api/electron";
import { createWebRuntimeAPIs } from "@/runtime-api/web";
import type { HomeBootstrapPayload } from "@/runtime/bootstrap";

function createRuntimeApis() {
  if (typeof window !== "undefined" && window.omniElectron) {
    return createElectronRuntimeAPIs();
  }
  return createWebRuntimeAPIs();
}

async function mount() {
  const root = document.getElementById("root");
  if (!root) {
    return;
  }

  root.textContent = t("boot.loading.message");
  try {
    const runtimeApis = createRuntimeApis();
    const params = new URLSearchParams(window.location.search);
    const bootstrap = await runtimeApis.bootstrap.load({
      selectedRunId: params.get("run"),
      draftProjectPath: params.get("project"),
      pairToken: params.get("pair"),
    }) as HomeBootstrapPayload;
    createRoot(root).render(<OmniApp bootstrap={bootstrap} runtimeApis={runtimeApis} />);
  } catch (error) {
    root.textContent = error instanceof Error ? error.message : String(error);
  }
}

void mount();

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:52:59.818Z","phase":null} -->
## Tool result: call_lqdI7fiTcTqd2diWWBvZgU86 · 2026-06-14T15:52:59.818Z

```text
Chunk ID: 830a19
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 193
Output:
"use client";

import { createContext, useContext } from "react";
import type { PropsWithChildren } from "react";
import type { RuntimeAPIs } from "./types";
import { createWebRuntimeAPIs } from "./web";

const RuntimeApiContext = createContext<RuntimeAPIs | null>(null);

export function RuntimeApiProvider({
  apis,
  children,
}: PropsWithChildren<{ apis: RuntimeAPIs }>) {
  return (
    <RuntimeApiContext.Provider value={apis}>
      {children}
    </RuntimeApiContext.Provider>
  );
}

export function useRuntimeAPIs() {
  const apis = useContext(RuntimeApiContext);
  if (!apis) {
    throw new Error("Runtime APIs are not available in this renderer tree.");
  }
  return apis;
}

export function createDefaultWebRuntimeAPIs() {
  return createWebRuntimeAPIs();
}

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:52:59.838Z","phase":null} -->
## Tool result: call_7JPBrb42jFSxXfMo66WdiD4i · 2026-06-14T15:52:59.838Z

````text
Chunk ID: 6db182
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 11003
Output:
Total output lines: 565

     1	# Multi-Server Standalone Interface Implementation Plan
     2	
     3	> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
     4	
     5	**Goal:** Turn the OmniHarness interface into a standalone client surface that can connect to, switch between, and safely operate multiple real OmniHarness servers from one running app.
     6	
     7	**Architecture:** Extend the existing `src/runtime-api/*` boundary with a selected-server adapter and server-directory state. The current local Next/runtime server remains a valid target, but the renderer stops assuming every API request, SSE stream, worker-entry fetch, cache record, and auth query belongs to `window.location.origin`; all runtime-owned state is keyed by a stable `serverId` plus the existing run/worker/session cursors.
     8	
     9	**Tech Stack:** Next.js 15, React 19, existing Manager classes, TanStack Query, TypeScript, runtime HTTP registry, SSE named events, localStorage for device-local server directory state, shadcn/ui controls already present in the app, shared i18n JSON resources, Vitest, lifecycle HTTP/SSE scenarios, Playwright for approval-gated UI journeys.
    10	
    11	**North Star Product:** OmniHarness becomes a control room for local, LAN, tunneled, desktop-started, editor-started, and remote OmniHarness runtimes: one interface can observe and operate many servers without losing lifecycle observability, transcript authority, auth boundaries, or user trust.
    12	
    13	**Current Milestone:** Ship a complete standalone interface mode for multiple HTTP OmniHarness server origins: users can add/edit/remove servers, select an active server, authenticate per server, browse conversations from the active server, switch servers without stale data bleed, reconnect/resync SSE per server, fetch worker entries from the correct server, and see clear per-server health/auth/error state.
    14	
    15	**Future Product Direction:** Later surfaces can add hosted account sync for the server directory, richer fleet monitoring across many servers at once, native discovery through desktop/editor shells, and admin dashboards. These are context only; the checklist below delivers the current milestone completely.
    16	
    17	**Final Functionality Standard:** The interface must operate against real OmniHarness servers only. No fake server records, mock conversations, synthetic health success, duplicate transcript persistence, or UI-only routing shims count as completion.
    18	
    19	---
    20	
    21	## Scope Notes
    22	
    23	- Do not create branches.
    24	- Do not create worktrees.
    25	- Do not delete files.
    26	- Keep the existing single-server local app behavior working while multi-server mode is introduced.
    27	- Do not replace the unified worker conversation stream. Worker content remains fetched through the target server's `/api/workers/:workerId/entries` endpoint and rendered through `WorkerEntriesManager`/`Terminal`.
    28	- Do not add a parallel server-side persistence layer for remote conversations. Each OmniHarness server remains authoritative for its own runs, workers, messages, events, queued messages, settings, and auth.
    29	- Do not create a second competing runtime API abstraction. Build on `src/runtime-api/types.ts`, `src/runtime-api/web.ts`, `src/runtime-api/electron.ts`, `src/runtime-api/vscode.ts`, and `src/runtime-api/provider.tsx`.
    30	- Every new user-facing frontend string must be added to every file in `shared/locales/` and rendered with `t()`.
    31	- All new shared frontend state must be centralized in Manager classes with narrow subscriptions. Do not use independent component arrays as source-of-truth server lists.
    32	
    33	## PM Pass
    34	
    35	**First User:** The human builder who may run more than one OmniHarness instance: local default server, desktop-started server, a server exposed through a tunnel, and possibly a second machine on LAN.
    36	
    37	**Core Job:** Use one interface to choose an OmniHarness server and operate that server's conversations, workers, plans, files, settings, and lifecycle state without restarting the UI.
    38	
    39	**Supporting Jobs:**
    40	
    41	- Add a server by URL and confirm it is really an OmniHarness server.
    42	- Remember trusted servers across browser refreshes.
    43	- See whether each server is reachable, locked by auth, authenticated, degraded, or unavailable.
    44	- Switch the active server without cached snapshots, query data, worker entries, or optimistic mutations corrupting the newly selected server.
    45	- Reconnect to SSE streams per server using the server's own event ids.
    46	- Recover when the selected server goes offline, returns an auth challenge, emits `stream.resync_required`, or returns incompatible version/capability data.
    47	- Remove a remembered server from this interface without deleting data from that server.
    48	- Keep local/offline single-server use simple for users who never add another server.
    49	
    50	**User Segmentation And Role Clarity:** This milestone is still a single-user builder tool. Multi-user permissioning, team server directories, and shared fleet administration are not part of the milestone.
    51	
    52	**State Model:**
    53	
    54	- `noServers`: first-run standalone directory has no configured server.
    55	- `serverKnown`: a server record exists with an id, display name, origin, and trust metadata.
    56	- `checking`: the interface is probing bootstrap/session/health for a server.
    57	- `reachable`: the server responded with an OmniHarness runtime descriptor.
    58	- `authRequired`: the server has auth enabled and the current browser context is not authenticated.
    59	- `authenticated`: the server accepted session state and runtime data can load.
    60	- `selected`: a server is the active source for app-level queries and streams.
    61	- `degraded`: the selected server is reachable but one or more runtime surfaces fail.
    62	- `offline`: the server cannot be reached.
    63	- `incompatible`: the server responded but lacks required multi-server contract fields.
    64	- `removed`: the interface forgot a server locally; remote server data is untouched.
    65	
    66	**Persistence Model:**
    67	
    68	- Server directory records persist device-locally in browser `localStorage` under a versioned key such as `omni.server-directory:v1`.
    69	- Stored server records include stable `serverId`, normalized origin, display name, last selected marker, last known health/auth state, last seen version/capabilities, and timestamps. They do not store translated copy.
    70	- Server credentials are not persisted by the directory. Existing cookie/session auth remains server-owned by browser origin. If a future token-based remote adapter is introduced, it must be designed as a separate explicit secret-storage feature.
    71	- Runtime snapshots, worker-entry caches, TanStack Query keys, optimistic pending ids, route selection, and read markers are keyed by `serverId` so data from one server cannot satisfy authority for another.
    72	- Removing a server deletes only local directory/cache records for that `serverId`; it does not call delete endpoints on the target server.
    73	
    74	**Operational Readiness:**
    75	
    76	- Bootstrap, health, auth-session, settings, event stream, worker entries, and mutation requests must all use bounded timeouts or cancellation through the runtime client.
    77	- Switching servers cancels or ownership-invalidates in-flight requests and SSE streams from the previous server.
    78	- Cross-origin access is a product feature, not just a frontend URL change. Remote servers must explicitly allow configured standalone UI origins, credentials, preflight requests, and SSE connection rules before the standalone client can treat them as usable.
    79	- Auth errors must show the target server and action that failed.
    80	- Version/capability mismatch must be explicit and recoverable.
    81	- Hot-path active-server bootstrap must not synchronously probe every known server; background health checks are bounded and staggered.
    82	
    83	**Instrumentation And Observability:**
    84	
    85	- The local interface emits client-side diagnostics through existing frontend error surfaces with `serverId`, `origin`, `source`, and `action`.
    86	- Server-side decisions remain owned by each target OmniHarness server and observed through its named event stream. The interface must not infer server decisions by diffing snapshots.
    87	- Add client-side lifecycle events or debug records for `server.selected`, `server.probe.started`, `server.probe.failed`, `server.auth.required`, `server.connection.offline`, `server.connection.restored`, and `server.cache.cleared` if an existing frontend diagnostics surface can consume them; otherwise model them in `ServerDirectoryManager` and render them as user-visible status.
    88	- Keep `/api/events/log?since=<id>&runId=<id>` scoped to the selected target server through the runtime client.
    89	
    90	**Onboarding And Discoverability:**
    91	
    92	- Existing local app behavior stays the default when the UI is served by an OmniHarness server.
    93	- Standalone mode shows a compact server selector in the header and an empty state that lets the user add a server URL.
    94	- Adding a server validates the URL and shows reachability/auth/version state before selection.
    95	- Server settings live in a dense settings/control surface with compact rows and no redundant explanatory chrome.
    96	
    97	**Risk And Trust Surfaces:**
    98	
    99	- Cross-server data bleed is the main trust risk. Every cache and async callback must prove server ownership before mutating visible state.
   100	- Auth confusion is high risk: a login prompt must name the server it applies to and never imply the user is logged into all servers.
   101	- Destructive actions must keep acting only on the active server and clearly show the server context.
   102	- `localhost` is not globally meaningful across devices. Stored server origins must be displayed exactly enough for users to distinguish local, LAN, and tunneled servers.
   103	
   104	## Product Completeness Pass
   105	
   106	### Primary Stories
   107	
   108	- As a builder, I can add a real OmniHarness server by URL and select it as the active server.
   109	- As a builder, I can switch between remembered servers and see the correct conversations, workers, status, and settings for the selected server.
   110	- As a builder, I can continue using the current single-server local app without configuring a server directory.
   111	
   112	### First-Run And Empty-State Stories
   113	
   114	- As a first-time standalone user, I see that no server is connected and can add one.
   115	- As a user who opens the local app at `http://localhost:3035`, I land directly in the existing home surface with the current server auto-registered as the local server.
   116	
   117	### Return/Revisit Stories
   118	
   119	- As a returning user, I see remembered servers and the last selected server.
   120	- As a returning user, cached previews may speed up the UI but cannot satisfy loaded authority until the selected server responds.
   121	
   122	### Failure And Recovery Stories
   123	
   124	- As a user, I see when a server is offline, requires login, is incompatible, or returns a runtime error.
   125	- As a user, I can retry health/auth/bootstrap for a server without losing draft input for another server.
   126	- As a user, if SSE replay is unavailable, the interface re-bootstrapes from the target server's snapshot anchor and does not silently miss events.
   127	
   128	### Status-Awareness Stories
   129	
   130	- As a user, I know which server is active at all times.
   131	- As a user, I can tell whether active conversations and worker streams are live, cached preview, reconnecting, resyncing, or terminal.
   132	- As a user, I can see per-server status in the selector without every known server blocking initial render.
   133	
   134	### Mutation Stories
   135	
   136	- As a user, creating, sending, stopping, retrying, deleting, archiving, editing, forking, settings saves, file opens, git workspace actions, and planning review actions apply only to the selected server.
   137	- As a user, if I switch servers while a mutation is in flight, the mutation result cannot navigate, clear composer state, or update snapshots for the new server unless it owns the current server token.
   138	
   139	### Mobile Stories
   140	
   141	- As a mobile user, I can still see and change the active server through the existing header/mobile navigation without crowding the composer or conversation controls.
   142	- As a mobile user, add/edit server controls use a sheet/dialog pattern that preserves the current conversation context.
   143	
   144	## Architecture
   145	
   146	### Standalone Interface Definition
   147	
   148	This milestone includes two entry modes:
   149	
   150	- **Served local mode:** the current app is served by an OmniHarness runtime at an origin such as `http://localhost:3035`. This mode auto-registers the serving origin as the local/default server and must remain the simplest path.
   151	- **Standalone client mode:** the same renderer can boot without a server-authoritative `HomeBootstrapPayload` and prompts for a server URL. The implementation may serve this static client through the existing standalone HTTP server, Electron shell, or a dedicated static export entry, but the milestone is not complete until the app can render the server-directory empty state without requiring a local OmniHarness runtime to provide initial conversation data.
   152	
   153	Standalone acceptance criteria:
   154	
   155	- The renderer has a boot path where `initialEventState`, `initialQueries.session`, and `initialQueries.settings` are absent because no server is selected yet.
   156	- Adding a server probes `/api/runtime/bootstrap` on that target and transitions into normal authenticated/unauthenticated runtime flow.
   157	- Browser routing, selected run params, and pair-token params do not crash when no server exists.
   158	- The local served mode still works without any visible setup for single-server users.
   159	
   160	### Server Directory
   161	
   162	Create a frontend `ServerDirectoryManager` that owns remembered servers and selected server state. It is the only source of truth for:
   163	
   164	- `serverId`,
   165	- normalized origin,
   166	- display name,
   167	- status,
   168	- last selected server,
   169	- last health/auth/version result,
   170	- local validation errors,
   171	- add/edit/remove dialog draft state.
   172	
   173	The manager persists only directory metadata to localStorage. It also exposes a current `serverToken`/generation that increments on selection, edit, removal, and explicit reconnect. Async code must carry this token and check it before mutating Managers, query caches, route state, worker stream state, or composer state.
   174	
   175	### Runtime Descriptor Schema
   176	
   177	Add a versioned runtime descriptor to `/api/runtime/bootstrap` and `HomeBootstrapPayload`:
   178	
   179	```ts
   180	type RuntimeServerDescriptor = {
   181	  descriptorVersion: 1;
   182	  serverId: string;
   183	  origin: string;
   184	  displayName: string;
   185	  runtimeVersion: string;
   186	  capabilities: Array<
   187	    | "events.sse.v1"
   188	    | "events.log.v1"
   189	    | "events.snapshot.v1"
   190	    | "workers.entries.v1"
   191	    | "auth.cookie.v1"
   192	    | "settings.v1"
   193	    | "conversations.v1"
   194	    | "files.v1"
   195	    | "git.v1"
   196	    | "notifications.v1"
   197	  >;
   198	  standaloneInterfaceSupported: boolean;
   199	};
   200	```
   201	
   202	Descriptor rules:
   203	
   204	- For the server that serves the UI, derive `serverId` from the normalized origin and descriptor version unless a future durable installation id exists. Remote directory entries keep their generated local `serverId` stable even if display name changes.
   205	- Duplicate normalized origins map to one remembered server record; adding the same origin updates/probes the existing record instead of creating a duplicate.
   206	- If a tunnel URL points to the same underlying runtime as another origin, this milestone treats it as a separate server record unless the runtime exposes a durable installation id. The UI may warn about matching display/version but must not merge records by guesswork.
   207	- Missing required capabilities produce `incompatible` status with a precise list of missing capabilities.
   208	- Descriptor version mismatch is recoverable: the user can keep the server record, retry after upgrade, or remove the local record.
   209	- Tests must cover same origin, duplicate origin, changed display name, tunnel origin, missing capability, and unsupported descriptor version.
   210	
   211	### Runtime API Boundary
   212	
   213	Extend the existing `RuntimeAPIs` contract instead of inventing a parallel client. Add a selected-server web adapter beneath `createWebRuntimeAPIs` so all runtime-targeted calls receive a `RuntimeServerRef`:
   214	
   215	```ts
   216	type RuntimeServerRef = {
   217	  serverId: string;
   218	  origin: string;
   219	  generation: number;
   220	};
   221	
   222	type SelectedRuntimeTransport = {
   223	  server: RuntimeServerRef;
   224	  buildUrl(path: string): string;
   225	  requestJson<T>(path: string, init: RequestInit | undefined, fallback: AppErrorDescriptor): Promise<T>;
   226	  openEvents(args: { runId?: string | null; lastEventId?: string | null }, handlers: EventStreamHandlers): RuntimeSubscription;
   227	  fetchSnapshot(args: { runId?: string | null; checksum?: string | null }): Promise<SnapshotPollResult>;
   228	};
   229	```
   230	
   231	The exact shape can change during implementation, but the boundary must preserve these ownership rules:
   232	
   233	- `RuntimeAPIs` remains the public renderer capability contract for web, Electron, and VS Code.
   234	- The selected-server web adapter is the only place that joins a remembered server origin with `/api/...` runtime paths.
   235	- Local-only shell endpoints may remain relative only after a call-site audit classifies them as local-shell-only.
   236	- Direct calls to hardcoded `"/api/..."` from app-state code that depends on the selected server are forbidden after this migration.
   237	
   238	### Bootstrap Model
   239	
   240	Extend `HomeBootstrapPayload` with a runtime descriptor for the server that served the page:
   241	
   242	- `serverId`,
   243	- `origin`,
   244	- `displayName`,
   245	- `runtimeVersion`,
   246	- `capabilities`,
   247	- `standaloneInterfaceSupported`.
   248	
   249	When the page is served by an OmniHarness runtime, the interface auto-registers this origin as the local/current server and hydrates initial event/settings/session data under that `serverId`. When the page is served as a static/standalone interface, it starts without an initial runtime payload and prompts for a server.
   250	
   251	### Remote Access Policy
   252	
   253	To support a standalone UI hosted on a different origin from a target server, the target OmniHarness server must expose an explicit browser access policy. Add this as a server-side runtime feature, not as an implicit permissive CORS change:
   254	
   255	- Configured allowed UI origins, with local defaults for same-origin and explicit development origins only.
   256	- `OPTIONS` preflight handling for runtime routes that accept cross-origin requests.
   257	- `Access-Control-Allow-Origin` echo for allowed origins, never `*` when credentials are used.
   258	- `Access-Control-Allow-Credentials: true` …1003 tokens truncated…aries with:
   320	
   321	- `serverId`,
   322	- `origin`,
   323	- `code`,
   324	- `status`,
   325	- `source`,
   326	- `action`,
   327	- `details`.
   328	
   329	Do not replace target server errors with generic "failed" text. Preserve server-provided stable codes and details when present.
   330	
   331	### Runtime Call-Site Audit
   332	
   333	Before migrating behavior, run and preserve an audit of every runtime-shaped call site:
   334	
   335	```bash
   336	rg -n "fetch\\(|requestJson\\(|new EventSource|/api/" src/app src/components src/lib src/runtime-api
   337	```
   338	
   339	Classify each call as:
   340	
   341	- `runtime-targeted`: must go through `RuntimeAPIs`/selected-server transport and include `serverId` in cache/ownership.
   342	- `local-shell-only`: remains relative because it targets the shell hosting the renderer rather than the selected OmniHarness server.
   343	- `server-internal`: stays server-side and is not part of browser server selection.
   344	
   345	Known runtime-targeted areas include auth/session/login/logout, settings saves, worker catalog, project files and file viewer, attachments, notifications, project memory, git workspace, queued-message mutations, transcript/history fetches, prewarm, pairing, external sessions, model auth status, conversation create/send, run actions, planning review/promote, events/log, and worker entries. The implementation checklist must update the file map if this audit finds additional modules.
   346	
   347	## Client/Server State Invariants
   348	
   349	- **Owner:** Runtime data is owned by the selected server. Directory metadata is owned by `ServerDirectoryManager`. Worker transcript content is owned by the target server's worker JSONL stream.
   350	- **Token:** Every async result carries `serverId + generation`; run-specific work also carries `runId`; worker content also carries `serverId + workerId + seq`.
   351	- **Provenance:** Cached snapshots and worker entries are preview/fallback only until the selected server returns authoritative bootstrap/snapshot or contiguous stream data.
   352	- **Completeness:** Event snapshots keep existing `snapshotScope`, `messageScope`, and catalog completeness rules, now scoped by `serverId`.
   353	- **Ordering:** SSE uses the target server's monotonic event ids. Worker content uses target server per-worker `seq`. Lists keep existing deterministic tie-breakers such as `(createdAt, id)`.
   354	- **State machine:** Server directory status transitions are explicit: unknown -> checking -> reachable/authRequired/authenticated/degraded/offline/incompatible.
   355	- **Events:** Server decisions still come from the target server's named events. Client-side server-selection decisions are manager-owned UI state, not synthetic runtime events.
   356	- **Loading shape:** Split active-server bootstrap, auth check, snapshot load, SSE reconnect, worker-entry fetch, background health check, and terminal error states.
   357	- **Fallbacks:** A cached same-server preview may render while reconnecting. A different server's cache must never render for the selected server.
   358	- **Tests:** Include stale-response, server-switch, query-key, SSE replay/resync, worker-entry cache, and mutation ownership tests.
   359	
   360	## File Map
   361	
   362	### Files To Create
   363	
   364	- `src/app/home/ServerDirectoryManager.ts`
   365	  - Manager for remembered servers, selected server, health/auth status, add/edit/remove dialog drafts, localStorage persistence, and generation tokens.
   366	- `src/app/home/runtime-client.ts`
   367	  - Selected-server-aware request, snapshot, event-stream, worker-entry URL, timeout, cancellation, and error-normalization helpers.
   368	- `src/app/home/server-directory-storage.ts`
   369	  - Versioned serialization, migration, origin normalization, pruning, and local removal helpers for server directory records.
   370	- `src/app/home/server-health.ts`
   371	  - Probe logic for runtime bootstrap/session capability checks with bounded timeouts and typed outcomes.
   372	- `src/components/home/ServerSelector.tsx`
   373	  - Header/mobile server selector, status menu, switch/retry/edit/remove entry points, all strings through i18n.
   374	- `src/components/settings/ServersSettingsPanel.tsx`
   375	  - Dense settings panel for remembered servers and add/edit/remove controls.
   376	- `src/components/home/ServerConnectionDialog.tsx`
   377	  - Add/edit server dialog with URL normalization, validation, probe result, auth/incompatible/offline messaging, and save/select actions.
   378	- `tests/app/home/ServerDirectoryManager.test.ts`
   379	  - Directory persistence, selection generation, remove semantics, migration, and status transitions.
   380	- `tests/app/home/runtime-client.test.ts`
   381	  - URL building, error normalization, auth/offline classification, timeout/cancellation, and ownership-token behavior.
   382	- `tests/app/home/multi-server-cache.test.ts`
   383	  - Snapshot/worker cache scoping by `serverId`.
   384	- `tests/lifecycle/scenarios/multi-server-interface.test.ts`
   385	  - Headless two-server scenario proving selected-server bootstrap, event logs, worker entries, auth/offline behavior, and cleanup.
   386	- `docs/architecture/multi-server-standalone-interface.md`
   387	  - Architecture doc covering server directory ownership, runtime-client contracts, cache keys, auth boundary, and test rules.
   388	
   389	### Files To Modify
   390	
   391	- `src/runtime/bootstrap.ts`
   392	  - Add runtime/server descriptor fields to `HomeBootstrapPayload`.
   393	- `src/app/home/bootstrap.server.ts`
   394	  - Preserve existing Next bootstrap while passing descriptor data through.
   395	- `src/app/home/HomeApp.tsx`
   396	  - Hydrate server directory from bootstrap, pass active server context to queries, lifecycle, mutations, header, settings, and stream managers. Split before adding substantial logic because this file is already over 1200 lines.
   397	- `src/app/home/useHomeQueries.ts`
   398	  - Include `serverId` in query keys and route all runtime requests through `runtime-client`.
   399	- `src/app/home/useHomeMutations.ts`
   400	  - Include selected server ownership in mutation start state, route requests through `runtime-client`, and block stale mutation side effects after server switches.
   401	- `src/app/home/useHomeLifecycle.ts`
   402	  - Recreate/cancel live event connections when `serverId`, generation, selected run, or auth state changes.
   403	- `src/app/home/LiveEventConnectionManager.ts`
   404	  - Replace relative URL builders with runtime-client URL builders, carry server generation, and report server-scoped errors.
   405	- `src/app/home/EventStreamStateManager.ts`
   406	  - Preserve merge/completeness behavior while scoping cache hydration and authoritative snapshots by `serverId`.
   407	- `src/app/home/EventStreamSnapshotCacheManager.ts`
   408	  - Version cache envelopes to include `serverId` in scope keys; migrate or ignore v1 same-origin-only cache safely.
   409	- `src/app/home/WorkerEntriesManager.ts`
   410	  - Key state, listeners, cache entries, in-flight requests, wake versions, and endpoint builders by `serverId + workerId`.
   411	- `src/app/home/HomeUiStateManager.ts`
   412	  - Add selected server route/UI state only if it belongs with existing route state; otherwise keep it in `ServerDirectoryManager`.
   413	- `src/components/home/HomeHeader.tsx`
   414	  - Render `ServerSelector` without broad subscriptions to high-churn conversation state.
   415	- `src/components/home/SettingsDialog.tsx`
   416	  - Register the servers settings section/tab if the existing settings composition supports it.
   417	- `src/components/settings/GeneralSettingsPanel.tsx`
   418	  - Link or route to server directory controls if that matches the current settings hierarchy.
   419	- `src/components/home/ConversationSidebar.tsx`
   420	  - Make active-server identity visible where needed and avoid cross-server cached counts.
   421	- `src/components/home/ConversationMain.tsx`
   422	  - Ensure destructive and mutation controls receive active server context and render server-specific failure context. Avoid growing this already-large file; extract helper components if substantial UI is needed.
   423	- `src/lib/app-errors.ts`
   424	  - Preserve runtime `code`, `serverId`, and `origin` fields in normalized app errors.
   425	- `shared/locales/*.json`
   426	  - Add keys for server selector, server statuses, add/edit/remove dialogs, validation, auth/offline/incompatible errors, retry, and settings labels.
   427	- `tests/lifecycle/harness/server.ts`
   428	  - If needed, expose helper to launch two isolated OmniHarness servers on separate ports for the multi-server scenario.
   429	- `tests/lifecycle/harness/client.ts`
   430	  - If needed, add helpers for server-specific bootstrap/events/log/worker-entry calls.
   431	- `.gitignore`
   432	  - Verify no change is needed; add ignores only if tests introduce new temp output paths.
   433	
   434	### Tests To Update Or Add
   435	
   436	- Unit tests for server origin normalization and unsafe protocol rejection.
   437	- Unit tests for `ServerDirectoryManager` persistence, migrations, generation ownership, last-selected behavior, and local-only removal.
   438	- Unit tests for runtime-client request URL building, credentials mode, timeout/cancellation, auth/offline/incompatible classification, and error details.
   439	- Unit tests for `useHomeQueries` query keys or extracted key builders to prove `serverId` is always present for runtime queries.
   440	- Unit tests for mutation ownership helpers in `useHomeMutations.ts`: start on server A, switch to B, resolve A, assert B is not mutated.
   441	- Unit tests for `EventStreamSnapshotCacheManager` proving server A cache cannot hydrate server B, and server-authoritative bootstrap cannot be demoted by same-server cache.
   442	- Unit tests for `WorkerEntriesManager` proving same `workerId` on two servers has independent entries, in-flight requests, cache, and wake-up behavior.
   443	- Lifecycle scenario with two real isolated servers:
   444	  - add/select server A and server B,
   445	  - verify bootstrap and `/api/events/log` source for each,
   446	  - create or inspect a conversation on A,
   447	  - switch to B and verify A data disappears or becomes clearly inactive,
   448	  - reconnect A with `Last-Event-ID`,
   449	  - simulate B offline and verify A remains usable,
   450	  - cleanup all test conversations/artifacts on both servers.
   451	- Existing lifecycle tests must keep passing: `pnpm test:lifecycle`.
   452	
   453	### Candidate Agentic User Journey Tests
   454	
   455	These require explicit user approval before running:
   456	
   457	- **Two-server switching journey:** open the UI, add two local test servers, create a conversation on each, switch repeatedly, and confirm conversations, worker streams, and composer drafts do not bleed across servers.
   458	- **Auth boundary journey:** connect to one unlocked server and one password-protected server, verify login state and errors are scoped to the protected server.
   459	- **Offline recovery journey:** connect to two servers, stop one, verify status/error/retry behavior while the other remains usable, restart the stopped server, and verify reconnect/resync.
   460	- **Mobile selector journey:** verify server selection and add/edit flows fit on mobile without hiding the active conversation state.
   461	
   462	### `.gitignore` Coverage
   463	
   464	Before implementation, verify `.gitignore` covers:
   465	
   466	- `node_modules/`, package-manager caches, `.next/`, coverage, logs, temp files, and lifecycle harness temp roots.
   467	- No server-directory secret files are introduced.
   468	- No generated screenshots, Playwright reports, or lifecycle run artifacts are committed unless explicitly requested.
   469	
   470	## Implementation Checklist
   471	
   472	- [ ] Audit touched file sizes and split before adding major logic.
   473	  - `src/app/home/HomeApp.tsx` is already over 1200 lines; extract server-directory bootstrap/lifecycle glue before adding the new surface.
   474	  - `src/app/home/useHomeMutations.ts` is close to 1200 lines; extract server-aware request helpers and ownership checks rather than growing inline mutation bodies.
   475	  - Verification: `wc -l` confirms new multi-server logic lives in dedicated modules and no touched file newly exceeds 1200 lines without a planned split.
   476	
   477	- [ ] Add the runtime server descriptor to bootstrap.
   478	  - Modify `src/runtime/bootstrap.ts` and `src/app/home/bootstrap.server.ts`.
   479	  - Include serving origin, stable local `serverId`, display name, runtime version/capability fields, and initial data ownership.
   480	  - Verification: unit test or route test proves `/api/runtime/bootstrap` and SSR bootstrap include the descriptor and preserve existing fields.
   481	
   482	- [ ] Implement server directory storage and manager with TDD.
   483	  - Create `src/app/home/server-directory-storage.ts` and `src/app/home/ServerDirectoryManager.ts`.
   484	  - Cover add, update, remove, select, generation increment, last selected server, migration, invalid records, and bootstrap auto-registration.
   485	  - Verification: `pnpm test -- tests/app/home/ServerDirectoryManager.test.ts`.
   486	
   487	- [ ] Implement the selected-server runtime client with TDD.
   488	  - Create `src/app/home/runtime-client.ts` and `src/app/home/server-health.ts`.
   489	  - Enforce URL normalization, allowed protocols, credentials, timeouts, aborts, error normalization, and ownership-token checks.
   490	  - Verification: `pnpm test -- tests/app/home/runtime-client.test.ts`.
   491	
   492	- [ ] Scope event snapshot cache by server.
   493	  - Modify `src/app/home/EventStreamSnapshotCacheManager.ts` and `src/app/home/EventStreamStateManager.ts`.
   494	  - Preserve server-authoritative bootstrap behavior and existing scoped completeness merges.
   495	  - Verification: cache tests prove no cross-server hydration and no demotion of `snapshotSource: "server"`.
   496	
   497	- [ ] Scope worker entry state and cache by server.
   498	  - Modify `src/app/home/WorkerEntriesManager.ts`.
   499	  - Keep the contiguous-prefix invariant, wake-up semantics, bounded cache, and `?afterSeq=`/tail/backfill flows.
   500	  - Verification: worker manager tests prove same `workerId` on two servers stays isolated and stale fetches cannot mutate the active server stream.
   501	
   502	- [ ] Route live event connections through the runtime client.
   503	  - Modify `src/app/home/LiveEventConnectionManager.ts` and `src/app/home/useHomeLifecycle.ts`.
   504	  - Carry `serverId + generation`, per-server `lastEventId`, snapshot anchor headers, fallback polling, and resync behavior.
   505	  - Verification: unit tests for URL construction/ownership plus lifecycle SSE scenario for reconnect/resync.
   506	
   507	- [ ] Make query keys and bootstrap hydration server-aware.
   508	  - Modify `src/app/home/HomeApp.tsx`, `src/app/home/useHomeQueries.ts`, and related extracted helpers.
   509	  - Prime TanStack Query under `serverId` keys and clear or ignore previous-server queries on selection change without globally discarding useful caches.
   510	  - Verification: tests or focused assertions prove `auth-session`, `settings`, `worker-catalog`, and `project-files` cannot be read across servers.
   511	
   512	- [ ] Make mutations server-aware and stale-safe.
   513	  - Modify `src/app/home/useHomeMutations.ts`, `src/app/home/useQueuedMessageMutations.ts` if needed, and supporting action helpers.
   514	  - At mutation start, capture `serverId`, generation, selected run, composer draft, and attachments identity. On success/error, mutate UI only if ownership still matches.
   515	  - Verification: stale mutation tests for create, send, stop, delete/archive, settings save, and queued-message actions where applicable.
   516	
   517	- [ ] Build the server selector and connection dialogs.
   518	  - Create `src/components/home/ServerSelector.tsx` and `src/components/home/ServerConnectionDialog.tsx`.
   519	  - Modify `src/components/home/HomeHeader.tsx` and mobile navigation wiring.
   520	  - Use existing shadcn/ui controls; use lucide icons where appropriate; keep subscriptions narrow.
   521	  - Verification: component tests where practical and Playwright screenshot/journey only with user approval.
   522	
   523	- [ ] Add the servers settings surface.
   524	  - Create `src/components/settings/ServersSettingsPanel.tsx`.
   525	  - Modify `src/components/home/SettingsDialog.tsx` or the active settings composition to include it.
   526	  - Use compact rows, explicit save/remove/retry behavior, and no repeated headings or decorative nested cards.
   527	  - Verification: i18n tests/static checks plus manual UI check if running browser verification is approved.
   528	
   529	- [ ] Add all i18n resources.
   530	  - Modify every `shared/locales/*.json` file in the same change.
   531	  - Add stable dotted keys for selector labels, statuses, validation, auth/offline/incompatible errors, add/edit/remove actions, retry, and settings copy.
   532	  - Verification: JSON parse check and existing i18n/lint checks.
   533	
   534	- [ ] Preserve error transparency with server context.
   535	  - Modify `src/lib/app-errors.ts` and runtime-client error handling.
   536	  - Preserve target server stable error codes, status, details, source/action, `serverId`, and origin.
   537	  - Verification: tests cover server JSON error payloads, network failures, CORS-like fetch failures, auth failures, and malformed payloads.
   538	
   539	- [ ] Add lifecycle coverage for two real servers.
   540	  - Create `tests/lifecycle/scenarios/multi-server-interface.test.ts`.
   541	  - Extend lifecycle harness helpers only as needed to launch two isolated servers and clean up conversations/artifacts on both.
   542	  - Assert on HTTP/SSE/event-log behavior rather than browser DOM for control-plane correctness.
   543	  - Verification: targeted lifecycle scenario passes and cleanup leaves no test conversations/artifacts behind.
   544	
   545	- [ ] Run deterministic verification.
   546	  - `pnpm test -- tests/app/home/ServerDirectoryManager.test.ts tests/app/home/runtime-client.test.ts tests/app/home/multi-server-cache.test.ts`
   547	  - `pnpm test:lifecycle -- tests/lifecycle/scenarios/multi-server-interface.test.ts` if the script accepts file filtering; otherwise run the full `pnpm test:lifecycle`.
   548	  - `pnpm lint`
   549	  - `pnpm build`
   550	
   551	- [ ] Run approval-gated browser/user-journey verification if approved.
   552	  - Proposed journeys: two-server switching, auth boundary, offline recovery, and mobile selector.
   553	  - Use the already-running app process when possible and the normal local URL `http://localhost:3035`.
   554	  - Clean up all test conversations and persisted artifacts before finishing.
   555	
   556	## Self-Review
   557	
   558	- Every runtime-owned query, mutation, cache, stream, and worker-entry fetch has a `serverId` owner token.
   559	- Cached data can pre-render only for the same server and cannot satisfy authoritative load gates across servers.
   560	- Late async responses and mutation results cannot mutate the active UI after server selection changes.
   561	- Worker content remains in the unified worker stream; no parallel transcript store is introduced.
   562	- Server-side decisions remain observable through target server named events.
   563	- Auth, offline, incompatible, and degraded states are visible and server-scoped.
   564	- The plan does not require branches, worktrees, file deletion, mocked servers, fake components, or fallback success.
   565	- The checklist delivers the complete current milestone; future product ideas remain context only.

````

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:53:04.600Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:53:04.600Z

I checked the existing `src/ui` and `src/runtime-api` code. Baton is right: the renderer has a provider, but the home app mostly bypasses it today, so the plan needs to name the actual selected-server transport and make the call-site audit the first implementation gate.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:53:41.697Z","phase":null} -->
## Tool call: apply_patch · 2026-06-14T15:53:41.697Z

```json
*** Begin Patch
*** Update File: docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md
@@
-**Architecture:** Extend the existing `src/runtime-api/*` boundary with a selected-server adapter and server-directory state. The current local Next/runtime server remains a valid target, but the renderer stops assuming every API request, SSE stream, worker-entry fetch, cache record, and auth query belongs to `window.location.origin`; all runtime-owned state is keyed by a stable `serverId` plus the existing run/worker/session cursors.
+**Architecture:** Add one selected-server transport beneath the existing renderer: it wraps `requestJson`, raw `fetch`, and SSE URL construction with `serverId + generation` ownership, then the current `src/runtime-api/*` adapters delegate to it where they need selected-server behavior. The current local Next/runtime server remains a valid target, but the renderer stops assuming every API request, SSE stream, worker-entry fetch, cache record, and auth query belongs to `window.location.origin`; all runtime-owned state is keyed by a stable server identity plus the existing run/worker/session cursors.
@@
-- Do not create a second competing runtime API abstraction. Build on `src/runtime-api/types.ts`, `src/runtime-api/web.ts`, `src/runtime-api/electron.ts`, `src/runtime-api/vscode.ts`, and `src/runtime-api/provider.tsx`.
+- Do not create competing runtime API abstractions. The selected-server transport is the single low-level injection point for Home app HTTP/SSE work; `src/runtime-api/types.ts`, `src/runtime-api/web.ts`, `src/runtime-api/electron.ts`, `src/runtime-api/vscode.ts`, and `src/runtime-api/provider.tsx` either delegate to it or remain shell adapters.
@@
-- Add client-side lifecycle events or debug records for `server.selected`, `server.probe.started`, `server.probe.failed`, `server.auth.required`, `server.connection.offline`, `server.connection.restored`, and `server.cache.cleared` if an existing frontend diagnostics surface can consume them; otherwise model them in `ServerDirectoryManager` and render them as user-visible status.
+- Model client-side lifecycle diagnostics in `ServerDirectoryManager` as bounded recent records and render the latest relevant records through the existing frontend error/status surfaces. Required records: `server.selected`, `server.probe.started`, `server.probe.failed`, `server.auth.required`, `server.connection.offline`, `server.connection.restored`, and `server.cache.cleared`.
@@
-This milestone includes two entry modes:
+This milestone includes two entry modes:
@@
-- **Standalone client mode:** the same renderer can boot without a server-authoritative `HomeBootstrapPayload` and prompts for a server URL. The implementation may serve this static client through the existing standalone HTTP server, Electron shell, or a dedicated static export entry, but the milestone is not complete until the app can render the server-directory empty state without requiring a local OmniHarness runtime to provide initial conversation data.
+- **Standalone client mode:** `src/ui/render-web.tsx` becomes the browser/static entry that can mount `OmniApp` with `bootstrap={null}` when `/api/runtime/bootstrap` is unavailable or intentionally skipped. The milestone is not complete until that entry renders the server-directory empty state without requiring a local OmniHarness runtime to provide initial conversation data.
@@
-- The renderer has a boot path where `initialEventState`, `initialQueries.session`, and `initialQueries.settings` are absent because no server is selected yet.
+- `OmniApp` and `HomeApp` accept `HomeBootstrapPayload | null`.
+- The renderer has a boot path where `initialEventState`, `initialQueries.session`, and `initialQueries.settings` are absent because no server is selected yet.
 - Adding a server probes `/api/runtime/bootstrap` on that target and transitions into normal authenticated/unauthenticated runtime flow.
 - Browser routing, selected run params, and pair-token params do not crash when no server exists.
 - The local served mode still works without any visible setup for single-server users.
@@
 type RuntimeServerDescriptor = {
   descriptorVersion: 1;
+  installationId: string;
   serverId: string;
   origin: string;
@@
 - For the server that serves the UI, derive `serverId` from the normalized origin and descriptor version unless a future durable installation id exists. Remote directory entries keep their generated local `serverId` stable even if display name changes.
+- `installationId` is a durable server-side uuid persisted outside the browser, generated on first startup if missing, and returned by every runtime bootstrap. Use it as the preferred stable identity across localhost/LAN/tunnel origins.
+- `serverId` is the local directory key. For servers with `installationId`, derive it from `installationId`; for legacy servers without it, derive it from normalized origin and descriptor version.
 - Duplicate normalized origins map to one remembered server record; adding the same origin updates/probes the existing record instead of creating a duplicate.
-- If a tunnel URL points to the same underlying runtime as another origin, this milestone treats it as a separate server record unless the runtime exposes a durable installation id. The UI may warn about matching display/version but must not merge records by guesswork.
+- If a tunnel URL points to the same `installationId` as another remembered origin, the directory links both origins to the same server record and updates the preferred origin only through explicit user action. Without `installationId`, the UI may warn about matching display/version but must not merge records by guesswork.
@@
-- Tests must cover same origin, duplicate origin, changed display name, tunnel origin, missing capability, and unsupported descriptor version.
+- Tests must cover same origin, duplicate origin, changed display name, tunnel origin with same installation id, legacy server without installation id, missing capability, and unsupported descriptor version.
 
-### Runtime API Boundary
+### Selected-Server Transport Boundary
 
-Extend the existing `RuntimeAPIs` contract instead of inventing a parallel client. Add a selected-server web adapter beneath `createWebRuntimeAPIs` so all runtime-targeted calls receive a `RuntimeServerRef`:
+Use `src/app/home/runtime-client.ts` as the selected-server transport. It is not a second product API; it is the single low-level implementation used by Home app call sites and, where applicable, by `src/runtime-api/web.ts`:
@@
-type SelectedRuntimeTransport = {
+type SelectedRuntimeTransport = {
   server: RuntimeServerRef;
   buildUrl(path: string): string;
   requestJson<T>(path: string, init: RequestInit | undefined, fallback: AppErrorDescriptor): Promise<T>;
+  fetch(path: string, init?: RequestInit): Promise<Response>;
   openEvents(args: { runId?: string | null; lastEventId?: string | null }, handlers: EventStreamHandlers): RuntimeSubscription;
   fetchSnapshot(args: { runId?: string | null; checksum?: string | null }): Promise<SnapshotPollResult>;
 };
@@
-- `RuntimeAPIs` remains the public renderer capability contract for web, Electron, and VS Code.
-- The selected-server web adapter is the only place that joins a remembered server origin with `/api/...` runtime paths.
+- `requestJson` and raw `fetch` call sites in Home/runtime UI code migrate to the selected-server transport unless the audit classifies them as local-shell-only.
+- `LiveEventConnectionManager` receives the selected-server transport, not a bare URL builder.
+- `src/runtime-api/web.ts` gains `EventSource` credentials support and may delegate to the transport for web-selected-server calls. Electron and VS Code adapters remain shell adapters unless/until they expose multi-server selection.
 - Local-only shell endpoints may remain relative only after a call-site audit classifies them as local-shell-only.
 - Direct calls to hardcoded `"/api/..."` from app-state code that depends on the selected server are forbidden after this migration.
@@
 - Cookie strategy must be explicit. Current auth cookies are `SameSite=Lax`, which is not enough for true cross-site standalone access. The implementation must either add a secure cross-site cookie mode for explicitly allowed HTTPS origins (`SameSite=None; Secure`) or design an explicit token/session bridge for standalone clients.
 - Existing same-origin CSRF checks in auth routes must be revisited so cross-origin login is accepted only from configured standalone UI origins and still rejected from arbitrary sites.
 - Tests must cover protected server login/session from an allowed origin, disallowed origin rejection, preflight, SSE credentials, and logout/session revocation.
+
+This cross-origin backend work is part of the current milestone. Multi-server same-origin/localhost support may land behind passing tests first, but the milestone is not complete until allowed-origin standalone access works against an authenticated protected server.
@@
-Before migrating behavior, run and preserve an audit of every runtime-shaped call site:
+Before changing runtime behavior, run and preserve an audit of every runtime-shaped call site:
@@
-Known runtime-targeted areas include auth/session/login/logout, settings saves, worker catalog, project files and file viewer, attachments, notifications, project memory, git workspace, queued-message mutations, transcript/history fetches, prewarm, pairing, external sessions, model auth status, conversation create/send, run actions, planning review/promote, events/log, and worker entries. The implementation checklist must update the file map if this audit finds additional modules.
+Known runtime-targeted areas include auth/session/login/logout, settings saves, worker catalog, project files and file viewer, file pickers, attachments, notifications, project memory, git workspace, queued-message mutations, transcript/history fetches, prewarm, pairing, external sessions, model auth status, conversation create/send, run actions, planning review/promote, events/log, and worker entries. The implementation checklist must update the file map from this audit before implementation proceeds.
*** End Patch

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:53:41.725Z","phase":null} -->
## Tool result: call_q8WzFAT3L2bwcWJ2HRr99O2w · 2026-06-14T15:53:41.725Z

```text
Exit code: 0
Wall time: 0 seconds
Output:
Success. Updated the following files:
M docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:53:45.171Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:53:45.171Z

The architecture section is now aligned around one actual transport and a concrete standalone boot path. I’m updating the file map and checklist next so those decisions are executable rather than just prose.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:54:18.687Z","phase":null} -->
## Tool call: apply_patch · 2026-06-14T15:54:18.687Z

```json
*** Begin Patch
*** Update File: docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md
@@
 ### Files To Create
 
+- `docs/architecture/multi-server-runtime-callsite-audit.md`
+  - Required first artifact: classified audit table for every browser/runtime `fetch`, `requestJson`, `new EventSource`, and `"/api/"` call site.
 - `src/app/home/ServerDirectoryManager.ts`
   - Manager for remembered servers, selected server, health/auth status, add/edit/remove dialog drafts, localStorage persistence, and generation tokens.
 - `src/app/home/runtime-client.ts`
-  - Selected-server-aware request, snapshot, event-stream, worker-entry URL, timeout, cancellation, and error-normalization helpers.
+  - Selected-server-aware wrapper for `requestJson`, raw `fetch`, snapshot fetches, event-stream construction, worker-entry URL construction, timeout, cancellation, and error-normalization helpers.
 - `src/app/home/server-directory-storage.ts`
   - Versioned serialization, migration, origin normalization, pruning, and local removal helpers for server directory records.
 - `src/app/home/server-health.ts`
   - Probe logic for runtime bootstrap/session capability checks with bounded timeouts and typed outcomes.
+- `src/server/installation-id.ts`
+  - Durable runtime installation id creation/read helper used by bootstrap descriptors.
+- `src/runtime/http/cors.ts`
+  - Allowed standalone UI origin parsing, CORS/preflight response helpers, credential policy, and route wrapper utilities.
+- `tests/runtime/cors-auth.test.ts`
+  - Cross-origin protected-server auth, preflight, cookie/session, and disallowed-origin coverage.
 - `src/components/home/ServerSelector.tsx`
   - Header/mobile server selector, status menu, switch/retry/edit/remove entry points, all strings through i18n.
@@
 - `tests/app/home/multi-server-cache.test.ts`
-  - Snapshot/worker cache scoping by `serverId`.
+  - Snapshot/worker cache scoping by `serverId`, stale SSE generation fencing, stale mutation side effects, and corrupt localStorage recovery.
 - `tests/lifecycle/scenarios/multi-server-interface.test.ts`
   - Headless two-server scenario proving selected-server bootstrap, event logs, worker entries, auth/offline behavior, and cleanup.
 - `docs/architecture/multi-server-standalone-interface.md`
   - Architecture doc covering server directory ownership, runtime-client contracts, cache keys, auth boundary, and test rules.
@@
 - `src/runtime/bootstrap.ts`
-  - Add runtime/server descriptor fields to `HomeBootstrapPayload`.
+  - Add runtime/server descriptor fields to `HomeBootstrapPayload`, including durable `installationId`.
 - `src/app/home/bootstrap.server.ts`
   - Preserve existing Next bootstrap while passing descriptor data through.
+- `src/ui/OmniApp.tsx`
+  - Accept `HomeBootstrapPayload | null` and keep `RuntimeApiProvider` available for served and standalone entry modes.
+- `src/ui/render-web.tsx`
+  - Support standalone null-bootstrap mounting when no server is selected or `/api/runtime/bootstrap` is unavailable.
+- `src/runtime-api/types.ts`
+  - Add any selected-server transport, event-source option, or descriptor types that belong in the shared shell contract.
+- `src/runtime-api/web.ts`
+  - Add selected-server transport delegation where appropriate and update `EventSource` constructor typing to support `{ withCredentials: true }`.
+- `src/runtime-api/electron.ts` and `src/runtime-api/vscode.ts`
+  - Keep shell adapters compatible with the updated shared runtime API types.
+- `src/runtime-api/provider.tsx`
+  - Preserve provider behavior while allowing standalone/null-bootstrap app startup.
+- `src/runtime/http/registry.ts` and/or `src/runtime/http/server.ts`
+  - Apply CORS/preflight policy consistently to runtime routes without weakening same-origin defaults.
+- `src/runtime/http/routes/cookies.ts`
+  - Support the chosen explicit standalone cookie/session strategy for configured HTTPS standalone origins.
+- `src/runtime/http/routes/auth-login.ts` and `src/runtime/http/routes/auth-session.ts`
+  - Revisit same-origin/CSRF checks for configured standalone UI origins while still rejecting arbitrary cross-site requests.
 - `src/app/home/HomeApp.tsx`
   - Hydrate server directory from bootstrap, pass active server context to queries, lifecycle, mutations, header, settings, and stream managers. Split before adding substantial logic because this file is already over 1200 lines.
 - `src/app/home/useHomeQueries.ts`
   - Include `serverId` in query keys and route all runtime requests through `runtime-client`.
 - `src/app/home/useHomeMutations.ts`
   - Include selected server ownership in mutation start state, route requests through `runtime-client`, and block stale mutation side effects after server switches.
+- `src/app/home/useQueuedMessageMutations.ts`
+  - Route queued-message actions through selected-server transport with ownership checks.
+- `src/app/home/useConversationActions.ts`
+  - Route fire-and-forget settings/runtime calls through selected-server transport or classify as local-shell-only.
 - `src/app/home/useHomeLifecycle.ts`
   - Recreate/cancel live event connections when `serverId`, generation, selected run, or auth state changes.
@@
 - `src/components/home/ConversationMain.tsx`
   - Ensure destructive and mutation controls receive active server context and render server-specific failure context. Avoid growing this already-large file; extract helper components if substantial UI is needed.
+- `src/components/home/FileViewerPanel.tsx`, `src/components/FolderPickerDialog.tsx`, `src/components/FileAttachmentPickerDialog.tsx`, `src/app/home/ComposerContainer.tsx`, `src/app/home/ExternalSessionsPicker.tsx`, `src/app/home/ConversationNotificationManager.ts`, `src/app/home/ProjectMemoryPanelManager.ts`, `src/app/home/GitWorkspaceManager.ts`, `src/app/home/upload-attachments.ts`, and `src/components/settings/ModelProfileForm.tsx`
+  - Classify through the call-site audit and migrate runtime-targeted requests to selected-server transport.
 - `src/lib/app-errors.ts`
   - Preserve runtime `code`, `serverId`, and `origin` fields in normalized app errors.
@@
 - `tests/lifecycle/harness/server.ts`
-  - If needed, expose helper to launch two isolated OmniHarness servers on separate ports for the multi-server scenario.
+  - Keep for in-process single-server scenarios; do not use it as the authority for two-server isolation.
+- `tests/lifecycle/harness/subprocess.ts` and `tests/lifecycle/harness/subprocess-runner.ts`
+  - Add or verify support for launching two independent subprocess harnesses with separate roots and route coverage for bootstrap, auth, events/log, worker entries, settings, conversations, and cleanup.
 - `tests/lifecycle/harness/client.ts`
   - If needed, add helpers for server-specific bootstrap/events/log/worker-entry calls.
@@
 - Unit tests for server origin normalization and unsafe protocol rejection.
+- Unit tests for runtime descriptor schema, durable installation id stability, duplicate origin handling, tunnel origin with same installation id, legacy no-installation-id fallback, and incompatible capability detection.
 - Unit tests for `ServerDirectoryManager` persistence, migrations, generation ownership, last-selected behavior, and local-only removal.
 - Unit tests for runtime-client request URL building, credentials mode, timeout/cancellation, auth/offline/incompatible classification, and error details.
+- Unit tests for malformed/corrupt server-directory localStorage recovery.
 - Unit tests for `useHomeQueries` query keys or extracted key builders to prove `serverId` is always present for runtime queries.
-- Unit tests for mutation ownership helpers in `useHomeMutations.ts`: start on server A, switch to B, resolve A, assert B is not mutated.
+- Unit tests for mutation ownership helpers in `useHomeMutations.ts`: start on server A, switch to B, resolve A, assert B navigation, composer draft, attachments, query cache, and snapshots are not mutated.
 - Unit tests for `EventStreamSnapshotCacheManager` proving server A cache cannot hydrate server B, and server-authoritative bootstrap cannot be demoted by same-server cache.
 - Unit tests for `WorkerEntriesManager` proving same `workerId` on two servers has independent entries, in-flight requests, cache, and wake-up behavior.
+- Unit tests for stale SSE generation fencing: open stream for server A generation 1, switch/reconnect to generation 2 or server B, deliver generation 1 event, assert it is ignored.
+- Runtime route tests for allowed-origin CORS, denied-origin CORS, preflight, credentialed auth login/session/logout, and SSE credential compatibility.
 - Lifecycle scenario with two real isolated servers:
@@
 - Existing lifecycle tests must keep passing: `pnpm test:lifecycle`.
*** End Patch

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:54:18.701Z","phase":null} -->
## Tool result: call_ovIwhjGqhPElWNiw3YkdSNFh · 2026-06-14T15:54:18.701Z

```text
Exit code: 0
Wall time: 0 seconds
Output:
Success. Updated the following files:
M docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:54:23.244Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:54:23.244Z

The file map now includes the backend access-policy work, the existing runtime-api files, the null-bootstrap entrypoint, the broader call-site list, and subprocess isolation. I’m replacing the checklist with phase gates so execution starts with the audit and keeps single-server behavior passing at each step.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:55:14.956Z","phase":null} -->
## Tool call: apply_patch · 2026-06-14T15:55:14.956Z

```json
*** Begin Patch
*** Update File: docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md
@@
 ## Implementation Checklist
 
-- [ ] Audit touched file sizes and split before adding major logic.
+- [ ] Phase 0: audit touched file sizes and split before adding major logic.
   - `src/app/home/HomeApp.tsx` is already over 1200 lines; extract server-directory bootstrap/lifecycle glue before adding the new surface.
   - `src/app/home/useHomeMutations.ts` is close to 1200 lines; extract server-aware request helpers and ownership checks rather than growing inline mutation bodies.
   - Verification: `wc -l` confirms new multi-server logic lives in dedicated modules and no touched file newly exceeds 1200 lines without a planned split.
 
-- [ ] Add the runtime server descriptor to bootstrap.
-  - Modify `src/runtime/bootstrap.ts` and `src/app/home/bootstrap.server.ts`.
-  - Include serving origin, stable local `serverId`, display name, runtime version/capability fields, and initial data ownership.
-  - Verification: unit test or route test proves `/api/runtime/bootstrap` and SSR bootstrap include the descriptor and preserve existing fields.
-
-- [ ] Implement server directory storage and manager with TDD.
-  - Create `src/app/home/server-directory-storage.ts` and `src/app/home/ServerDirectoryManager.ts`.
-  - Cover add, update, remove, select, generation increment, last selected server, migration, invalid records, and bootstrap auto-registration.
-  - Verification: `pnpm test -- tests/app/home/ServerDirectoryManager.test.ts`.
-
-- [ ] Implement the selected-server runtime client with TDD.
-  - Create `src/app/home/runtime-client.ts` and `src/app/home/server-health.ts`.
-  - Enforce URL normalization, allowed protocols, credentials, timeouts, aborts, error normalization, and ownership-token checks.
-  - Verification: `pnpm test -- tests/app/home/runtime-client.test.ts`.
-
-- [ ] Scope event snapshot cache by server.
+- [ ] Phase 0: perform the runtime call-site audit before implementation.
+  - Run `rg -n "fetch\\(|requestJson\\(|new EventSource|/api/" src/app src/components src/lib src/runtime-api`.
+  - Create `docs/architecture/multi-server-runtime-callsite-audit.md` with a table of file, line, endpoint, owner classification, migration action, and test requirement.
+  - Update this plan's file map if the audit finds any additional runtime-targeted modules.
+  - Verification: every browser-visible call site is classified as `runtime-targeted`, `local-shell-only`, or `server-internal`; no unclassified direct runtime calls remain.
+
+- [ ] Phase 1: add the runtime descriptor schema and durable installation id.
+  - Create `src/server/installation-id.ts`.
+  - Modify `src/runtime/bootstrap.ts`, `src/app/home/bootstrap.server.ts`, and runtime bootstrap route tests.
+  - Include `descriptorVersion`, durable `installationId`, `serverId`, origin, display name, runtime version, required capabilities, standalone support, and initial data ownership.
+  - Verification: tests prove `/api/runtime/bootstrap` and SSR bootstrap include the descriptor; duplicate origin, same installation via tunnel, legacy no-installation-id fallback, missing capability, and unsupported descriptor version behave as specified.
+
+- [ ] Phase 1: keep current single-server behavior passing after descriptor changes.
+  - Run focused bootstrap/session/settings/event snapshot tests.
+  - Verification: the served local app still loads without creating or selecting any extra server record manually.
+
+- [ ] Phase 2: implement the selected-server transport with TDD.
+  - Create `src/app/home/runtime-client.ts` and `src/app/home/server-health.ts`.
+  - Update `src/runtime-api/types.ts`, `src/runtime-api/web.ts`, and `src/runtime-api/provider.tsx` only as needed to delegate to or coexist with the selected-server transport.
+  - Enforce URL normalization, allowed protocols, credentials, timeouts, aborts, error normalization, ownership-token checks, and `EventSource` option support for `{ withCredentials: true }`.
+  - Verification: `pnpm test -- tests/app/home/runtime-client.test.ts` covers request URL building, raw fetch wrapping, credentials mode, timeout/cancellation, auth/offline/incompatible classification, event-source credentials, and stale generation rejection.
+
+- [ ] Phase 2: migrate audited runtime call sites to the selected-server transport.
+  - Migrate `useHomeQueries`, `useHomeMutations`, `useQueuedMessageMutations`, `useConversationActions`, file viewer/pickers, attachments, notifications, project memory, git workspace, external sessions, model auth status, prewarm, pairing, events/log, and worker entries according to the audit table.
+  - Leave only audited `local-shell-only` relative calls behind, with comments or helper names that make their ownership clear.
+  - Verification: rerun the audit command and confirm all runtime-targeted browser calls use the selected-server transport.
+
+- [ ] Phase 3: scope event snapshot cache by server while defaulting to the local server.
   - Modify `src/app/home/EventStreamSnapshotCacheManager.ts` and `src/app/home/EventStreamStateManager.ts`.
   - Preserve server-authoritative bootstrap behavior and existing scoped completeness merges.
-  - Verification: cache tests prove no cross-server hydration and no demotion of `snapshotSource: "server"`.
+  - Verification: cache tests prove no cross-server hydration, corrupt localStorage recovery, and no demotion of `snapshotSource: "server"`.
 
-- [ ] Scope worker entry state and cache by server.
+- [ ] Phase 3: scope worker entry state and cache by server.
   - Modify `src/app/home/WorkerEntriesManager.ts`.
   - Keep the contiguous-prefix invariant, wake-up semantics, bounded cache, and `?afterSeq=`/tail/backfill flows.
   - Verification: worker manager tests prove same `workerId` on two servers stays isolated and stale fetches cannot mutate the active server stream.
 
-- [ ] Route live event connections through the runtime client.
+- [ ] Phase 3: route live event connections through the selected-server transport.
   - Modify `src/app/home/LiveEventConnectionManager.ts` and `src/app/home/useHomeLifecycle.ts`.
-  - Carry `serverId + generation`, per-server `lastEventId`, snapshot anchor headers, fallback polling, and resync behavior.
-  - Verification: unit tests for URL construction/ownership plus lifecycle SSE scenario for reconnect/resync.
+  - Carry `serverId + generation`, per-server `lastEventId`, snapshot anchor headers, fallback polling, resync behavior, and stale SSE generation fencing.
+  - Verification: unit tests for URL construction/ownership plus lifecycle SSE scenario for reconnect/resync and stale-generation event drops.
 
-- [ ] Make query keys and bootstrap hydration server-aware.
+- [ ] Phase 3: make query keys and bootstrap hydration server-aware.
   - Modify `src/app/home/HomeApp.tsx`, `src/app/home/useHomeQueries.ts`, and related extracted helpers.
   - Prime TanStack Query under `serverId` keys and clear or ignore previous-server queries on selection change without globally discarding useful caches.
   - Verification: tests or focused assertions prove `auth-session`, `settings`, `worker-catalog`, and `project-files` cannot be read across servers.
 
-- [ ] Make mutations server-aware and stale-safe.
+- [ ] Phase 3: make mutations server-aware and stale-safe.
   - Modify `src/app/home/useHomeMutations.ts`, `src/app/home/useQueuedMessageMutations.ts` if needed, and supporting action helpers.
   - At mutation start, capture `serverId`, generation, selected run, composer draft, and attachments identity. On success/error, mutate UI only if ownership still matches.
-  - Verification: stale mutation tests for create, send, stop, delete/archive, settings save, and queued-message actions where applicable.
+  - Verification: stale mutation tests for create, send, stop, delete/archive, settings save, queued-message actions, composer clearing, attachment clearing, and navigation side effects.
+
+- [ ] Phase 4: implement server directory storage and manager with TDD.
+  - Create `src/app/home/server-directory-storage.ts` and `src/app/home/ServerDirectoryManager.ts`.
+  - Cover add, update, remove, select, generation increment, last selected server, migration, malformed JSON recovery, invalid records, bootstrap auto-registration, installation-id duplicate handling, and bounded diagnostics records.
+  - Verification: `pnpm test -- tests/app/home/ServerDirectoryManager.test.ts`.
+
+- [ ] Phase 4: implement null-bootstrap standalone entry behavior.
+  - Modify `src/ui/OmniApp.tsx`, `src/ui/render-web.tsx`, and `src/app/home/HomeApp.tsx`.
+  - Let `HomeApp` render the server-directory empty state when bootstrap is null and no server is selected.
+  - Verify selected run params, project params, and pair-token params do not crash before a server exists.
+  - Verification: component/unit test mounts `OmniApp`/`HomeApp` with null bootstrap and proves the empty state renders without runtime queries firing.
 
-- [ ] Build the server selector and connection dialogs.
+- [ ] Phase 4: build the server selector and connection dialogs.
   - Create `src/components/home/ServerSelector.tsx` and `src/components/home/ServerConnectionDialog.tsx`.
   - Modify `src/components/home/HomeHeader.tsx` and mobile navigation wiring.
   - Use existing shadcn/ui controls; use lucide icons where appropriate; keep subscriptions narrow.
   - Verification: component tests where practical and Playwright screenshot/journey only with user approval.
 
-- [ ] Add the servers settings surface.
+- [ ] Phase 4: add the servers settings surface.
   - Create `src/components/settings/ServersSettingsPanel.tsx`.
   - Modify `src/components/home/SettingsDialog.tsx` or the active settings composition to include it.
   - Use compact rows, explicit save/remove/retry behavior, and no repeated headings or decorative nested cards.
   - Verification: i18n tests/static checks plus manual UI check if running browser verification is approved.
 
-- [ ] Add all i18n resources.
+- [ ] Phase 4: add all i18n resources.
   - Modify every `shared/locales/*.json` file in the same change.
   - Add stable dotted keys for selector labels, statuses, validation, auth/offline/incompatible errors, add/edit/remove actions, retry, and settings copy.
   - Verification: JSON parse check and existing i18n/lint checks.
 
-- [ ] Preserve error transparency with server context.
+- [ ] Phase 5: implement explicit cross-origin runtime access policy.
+  - Create `src/runtime/http/cors.ts`.
+  - Modify runtime registry/server and auth/cookie routes to support configured standalone UI origins, preflight, credentialed requests, SSE credentials, and secure cross-site cookie or explicit token/session bridge.
+  - Keep same-origin defaults unchanged and reject arbitrary cross-site requests.
+  - Document HTTPS-only constraints for cross-site cookie auth and authenticated SSE.
+  - Verification: `pnpm test -- tests/runtime/cors-auth.test.ts` covers allowed origin, disallowed origin, preflight, protected login/session/logout, and SSE credentials.
+
+- [ ] Phase 5: preserve error transparency with server context.
   - Modify `src/lib/app-errors.ts` and runtime-client error handling.
   - Preserve target server stable error codes, status, details, source/action, `serverId`, and origin.
   - Verification: tests cover server JSON error payloads, network failures, CORS-like fetch failures, auth failures, and malformed payloads.
 
-- [ ] Add lifecycle coverage for two real servers.
+- [ ] Phase 6: add lifecycle coverage for two real subprocess servers.
   - Create `tests/lifecycle/scenarios/multi-server-interface.test.ts`.
-  - Extend lifecycle harness helpers only as needed to launch two isolated servers and clean up conversations/artifacts on both.
+  - Use or extend `tests/lifecycle/harness/subprocess.ts` and `tests/lifecycle/harness/subprocess-runner.ts`; do not rely on the in-process harness for two-server isolation.
+  - Launch two isolated subprocess servers with separate roots and route coverage for bootstrap, auth, events/log, worker entries, settings, conversations, and cleanup.
   - Assert on HTTP/SSE/event-log behavior rather than browser DOM for control-plane correctness.
   - Verification: targeted lifecycle scenario passes and cleanup leaves no test conversations/artifacts behind.
 
-- [ ] Run deterministic verification.
+- [ ] Phase 6: run deterministic verification.
   - `pnpm test -- tests/app/home/ServerDirectoryManager.test.ts tests/app/home/runtime-client.test.ts tests/app/home/multi-server-cache.test.ts`
   - `pnpm test:lifecycle -- tests/lifecycle/scenarios/multi-server-interface.test.ts` if the script accepts file filtering; otherwise run the full `pnpm test:lifecycle`.
   - `pnpm lint`
   - `pnpm build`
 
-- [ ] Run approval-gated browser/user-journey verification if approved.
+- [ ] Phase 6: run approval-gated browser/user-journey verification if approved.
   - Proposed journeys: two-server switching, auth boundary, offline recovery, and mobile selector.
   - Use the already-running app process when possible and the normal local URL `http://localhost:3035`.
   - Clean up all test conversations and persisted artifacts before finishing.
*** End Patch

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:55:14.975Z","phase":null} -->
## Tool result: call_0i8XaiT5poi2eTZCwk1DuA2S · 2026-06-14T15:55:14.975Z

```text
Exit code: 0
Wall time: 0 seconds
Output:
Success. Updated the following files:
M docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:55:25.190Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:55:25.190Z

The checklist is now phase-gated and includes the cross-origin backend work as scheduled current-milestone scope, not hidden prose. I’m doing a consistency scan before rerunning Baton once more.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:55:25.194Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:55:25.194Z

```json
{
  "cmd": "rg -n \"runtime-client|RuntimeAPIs|selected-server|Standalone client mode|future token|future durable|if needed|if an existing|unless|defer|deferred|later|placeholder|mock|fake|fallback\" docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:55:25.194Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:55:25.194Z

```json
{
  "cmd": "sed -n '1,260p' docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:55:25.243Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:55:25.243Z

```json
{
  "cmd": "sed -n '260,620p' docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 36000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:55:25.265Z","phase":null} -->
## Tool result: call_fC7slMzQ3275dOf8VAKe0vl4 · 2026-06-14T15:55:25.265Z

```text
Chunk ID: 990942
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1799
Output:
7:**Architecture:** Add one selected-server transport beneath the existing renderer: it wraps `requestJson`, raw `fetch`, and SSE URL construction with `serverId + generation` ownership, then the current `src/runtime-api/*` adapters delegate to it where they need selected-server behavior. The current local Next/runtime server remains a valid target, but the renderer stops assuming every API request, SSE stream, worker-entry fetch, cache record, and auth query belongs to `window.location.origin`; all runtime-owned state is keyed by a stable server identity plus the existing run/worker/session cursors.
17:**Final Functionality Standard:** The interface must operate against real OmniHarness servers only. No fake server records, mock conversations, synthetic health success, duplicate transcript persistence, or UI-only routing shims count as completion.
29:- Do not create competing runtime API abstractions. The selected-server transport is the single low-level injection point for Home app HTTP/SSE work; `src/runtime-api/types.ts`, `src/runtime-api/web.ts`, `src/runtime-api/electron.ts`, `src/runtime-api/vscode.ts`, and `src/runtime-api/provider.tsx` either delegate to it or remain shell adapters.
70:- Server credentials are not persisted by the directory. Existing cookie/session auth remains server-owned by browser origin. If a future token-based remote adapter is introduced, it must be designed as a separate explicit secret-storage feature.
137:- As a user, if I switch servers while a mutation is in flight, the mutation result cannot navigate, clear composer state, or update snapshots for the new server unless it owns the current server token.
151:- **Standalone client mode:** `src/ui/render-web.tsx` becomes the browser/static entry that can mount `OmniApp` with `bootstrap={null}` when `/api/runtime/bootstrap` is unavailable or intentionally skipped. The milestone is not complete until that entry renders the server-directory empty state without requiring a local OmniHarness runtime to provide initial conversation data.
206:- For the server that serves the UI, derive `serverId` from the normalized origin and descriptor version unless a future durable installation id exists. Remote directory entries keep their generated local `serverId` stable even if display name changes.
217:Use `src/app/home/runtime-client.ts` as the selected-server transport. It is not a second product API; it is the single low-level implementation used by Home app call sites and, where applicable, by `src/runtime-api/web.ts`:
229:  requestJson<T>(path: string, init: RequestInit | undefined, fallback: AppErrorDescriptor): Promise<T>;
238:- `requestJson` and raw `fetch` call sites in Home/runtime UI code migrate to the selected-server transport unless the audit classifies them as local-shell-only.
239:- `LiveEventConnectionManager` receives the selected-server transport, not a bare URL builder.
240:- `src/runtime-api/web.ts` gains `EventSource` credentials support and may delegate to the transport for web-selected-server calls. Electron and VS Code adapters remain shell adapters unless/until they expose multi-server selection.
327:Extend `AppErrorDescriptor` or wrap it at runtime-client boundaries with:
349:- `runtime-targeted`: must go through `RuntimeAPIs`/selected-server transport and include `serverId` in cache/ownership.
359:- **Provenance:** Cached snapshots and worker entries are preview/fallback only until the selected server returns authoritative bootstrap/snapshot or contiguous stream data.
376:- `src/app/home/runtime-client.ts`
396:- `tests/app/home/runtime-client.test.ts`
401:  - Headless two-server scenario proving selected-server bootstrap, event logs, worker entries, auth/offline behavior, and cleanup.
403:  - Architecture doc covering server directory ownership, runtime-client contracts, cache keys, auth boundary, and test rules.
416:  - Add any selected-server transport, event-source option, or descriptor types that belong in the shared shell contract.
418:  - Add selected-server transport delegation where appropriate and update `EventSource` constructor typing to support `{ withCredentials: true }`.
432:  - Include `serverId` in query keys and route all runtime requests through `runtime-client`.
434:  - Include selected server ownership in mutation start state, route requests through `runtime-client`, and block stale mutation side effects after server switches.
436:  - Route queued-message actions through selected-server transport with ownership checks.
438:  - Route fire-and-forget settings/runtime calls through selected-server transport or classify as local-shell-only.
442:  - Replace relative URL builders with runtime-client URL builders, carry server generation, and report server-scoped errors.
462:  - Classify through the call-site audit and migrate runtime-targeted requests to selected-server transport.
479:- Unit tests for runtime descriptor schema, durable installation id stability, duplicate origin handling, tunnel origin with same installation id, legacy no-installation-id fallback, and incompatible capability detection.
481:- Unit tests for runtime-client request URL building, credentials mode, timeout/cancellation, auth/offline/incompatible classification, and error details.
514:- No generated screenshots, Playwright reports, or lifecycle run artifacts are committed unless explicitly requested.
533:  - Verification: tests prove `/api/runtime/bootstrap` and SSR bootstrap include the descriptor; duplicate origin, same installation via tunnel, legacy no-installation-id fallback, missing capability, and unsupported descriptor version behave as specified.
539:- [ ] Phase 2: implement the selected-server transport with TDD.
540:  - Create `src/app/home/runtime-client.ts` and `src/app/home/server-health.ts`.
541:  - Update `src/runtime-api/types.ts`, `src/runtime-api/web.ts`, and `src/runtime-api/provider.tsx` only as needed to delegate to or coexist with the selected-server transport.
543:  - Verification: `pnpm test -- tests/app/home/runtime-client.test.ts` covers request URL building, raw fetch wrapping, credentials mode, timeout/cancellation, auth/offline/incompatible classification, event-source credentials, and stale generation rejection.
545:- [ ] Phase 2: migrate audited runtime call sites to the selected-server transport.
548:  - Verification: rerun the audit command and confirm all runtime-targeted browser calls use the selected-server transport.
560:- [ ] Phase 3: route live event connections through the selected-server transport.
562:  - Carry `serverId + generation`, per-server `lastEventId`, snapshot anchor headers, fallback polling, resync behavior, and stale SSE generation fencing.
571:  - Modify `src/app/home/useHomeMutations.ts`, `src/app/home/useQueuedMessageMutations.ts` if needed, and supporting action helpers.
611:  - Modify `src/lib/app-errors.ts` and runtime-client error handling.
623:  - `pnpm test -- tests/app/home/ServerDirectoryManager.test.ts tests/app/home/runtime-client.test.ts tests/app/home/multi-server-cache.test.ts`
641:- The plan does not require branches, worktrees, file deletion, mocked servers, fake components, or fallback success.

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:55:25.266Z","phase":null} -->
## Tool result: call_r5tCewWdNhOiw6kf3Yy7lFAg · 2026-06-14T15:55:25.266Z

````text
Chunk ID: 884d94
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 4772
Output:
# Multi-Server Standalone Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the OmniHarness interface into a standalone client surface that can connect to, switch between, and safely operate multiple real OmniHarness servers from one running app.

**Architecture:** Add one selected-server transport beneath the existing renderer: it wraps `requestJson`, raw `fetch`, and SSE URL construction with `serverId + generation` ownership, then the current `src/runtime-api/*` adapters delegate to it where they need selected-server behavior. The current local Next/runtime server remains a valid target, but the renderer stops assuming every API request, SSE stream, worker-entry fetch, cache record, and auth query belongs to `window.location.origin`; all runtime-owned state is keyed by a stable server identity plus the existing run/worker/session cursors.

**Tech Stack:** Next.js 15, React 19, existing Manager classes, TanStack Query, TypeScript, runtime HTTP registry, SSE named events, localStorage for device-local server directory state, shadcn/ui controls already present in the app, shared i18n JSON resources, Vitest, lifecycle HTTP/SSE scenarios, Playwright for approval-gated UI journeys.

**North Star Product:** OmniHarness becomes a control room for local, LAN, tunneled, desktop-started, editor-started, and remote OmniHarness runtimes: one interface can observe and operate many servers without losing lifecycle observability, transcript authority, auth boundaries, or user trust.

**Current Milestone:** Ship a complete standalone interface mode for multiple HTTP OmniHarness server origins: users can add/edit/remove servers, select an active server, authenticate per server, browse conversations from the active server, switch servers without stale data bleed, reconnect/resync SSE per server, fetch worker entries from the correct server, and see clear per-server health/auth/error state.

**Future Product Direction:** Later surfaces can add hosted account sync for the server directory, richer fleet monitoring across many servers at once, native discovery through desktop/editor shells, and admin dashboards. These are context only; the checklist below delivers the current milestone completely.

**Final Functionality Standard:** The interface must operate against real OmniHarness servers only. No fake server records, mock conversations, synthetic health success, duplicate transcript persistence, or UI-only routing shims count as completion.

---

## Scope Notes

- Do not create branches.
- Do not create worktrees.
- Do not delete files.
- Keep the existing single-server local app behavior working while multi-server mode is introduced.
- Do not replace the unified worker conversation stream. Worker content remains fetched through the target server's `/api/workers/:workerId/entries` endpoint and rendered through `WorkerEntriesManager`/`Terminal`.
- Do not add a parallel server-side persistence layer for remote conversations. Each OmniHarness server remains authoritative for its own runs, workers, messages, events, queued messages, settings, and auth.
- Do not create competing runtime API abstractions. The selected-server transport is the single low-level injection point for Home app HTTP/SSE work; `src/runtime-api/types.ts`, `src/runtime-api/web.ts`, `src/runtime-api/electron.ts`, `src/runtime-api/vscode.ts`, and `src/runtime-api/provider.tsx` either delegate to it or remain shell adapters.
- Every new user-facing frontend string must be added to every file in `shared/locales/` and rendered with `t()`.
- All new shared frontend state must be centralized in Manager classes with narrow subscriptions. Do not use independent component arrays as source-of-truth server lists.

## PM Pass

**First User:** The human builder who may run more than one OmniHarness instance: local default server, desktop-started server, a server exposed through a tunnel, and possibly a second machine on LAN.

**Core Job:** Use one interface to choose an OmniHarness server and operate that server's conversations, workers, plans, files, settings, and lifecycle state without restarting the UI.

**Supporting Jobs:**

- Add a server by URL and confirm it is really an OmniHarness server.
- Remember trusted servers across browser refreshes.
- See whether each server is reachable, locked by auth, authenticated, degraded, or unavailable.
- Switch the active server without cached snapshots, query data, worker entries, or optimistic mutations corrupting the newly selected server.
- Reconnect to SSE streams per server using the server's own event ids.
- Recover when the selected server goes offline, returns an auth challenge, emits `stream.resync_required`, or returns incompatible version/capability data.
- Remove a remembered server from this interface without deleting data from that server.
- Keep local/offline single-server use simple for users who never add another server.

**User Segmentation And Role Clarity:** This milestone is still a single-user builder tool. Multi-user permissioning, team server directories, and shared fleet administration are not part of the milestone.

**State Model:**

- `noServers`: first-run standalone directory has no configured server.
- `serverKnown`: a server record exists with an id, display name, origin, and trust metadata.
- `checking`: the interface is probing bootstrap/session/health for a server.
- `reachable`: the server responded with an OmniHarness runtime descriptor.
- `authRequired`: the server has auth enabled and the current browser context is not authenticated.
- `authenticated`: the server accepted session state and runtime data can load.
- `selected`: a server is the active source for app-level queries and streams.
- `degraded`: the selected server is reachable but one or more runtime surfaces fail.
- `offline`: the server cannot be reached.
- `incompatible`: the server responded but lacks required multi-server contract fields.
- `removed`: the interface forgot a server locally; remote server data is untouched.

**Persistence Model:**

- Server directory records persist device-locally in browser `localStorage` under a versioned key such as `omni.server-directory:v1`.
- Stored server records include stable `serverId`, normalized origin, display name, last selected marker, last known health/auth state, last seen version/capabilities, and timestamps. They do not store translated copy.
- Server credentials are not persisted by the directory. Existing cookie/session auth remains server-owned by browser origin. If a future token-based remote adapter is introduced, it must be designed as a separate explicit secret-storage feature.
- Runtime snapshots, worker-entry caches, TanStack Query keys, optimistic pending ids, route selection, and read markers are keyed by `serverId` so data from one server cannot satisfy authority for another.
- Removing a server deletes only local directory/cache records for that `serverId`; it does not call delete endpoints on the target server.

**Operational Readiness:**

- Bootstrap, health, auth-session, settings, event stream, worker entries, and mutation requests must all use bounded timeouts or cancellation through the runtime client.
- Switching servers cancels or ownership-invalidates in-flight requests and SSE streams from the previous server.
- Cross-origin access is a product feature, not just a frontend URL change. Remote servers must explicitly allow configured standalone UI origins, credentials, preflight requests, and SSE connection rules before the standalone client can treat them as usable.
- Auth errors must show the target server and action that failed.
- Version/capability mismatch must be explicit and recoverable.
- Hot-path active-server bootstrap must not synchronously probe every known server; background health checks are bounded and staggered.

**Instrumentation And Observability:**

- The local interface emits client-side diagnostics through existing frontend error surfaces with `serverId`, `origin`, `source`, and `action`.
- Server-side decisions remain owned by each target OmniHarness server and observed through its named event stream. The interface must not infer server decisions by diffing snapshots.
- Model client-side lifecycle diagnostics in `ServerDirectoryManager` as bounded recent records and render the latest relevant records through the existing frontend error/status surfaces. Required records: `server.selected`, `server.probe.started`, `server.probe.failed`, `server.auth.required`, `server.connection.offline`, `server.connection.restored`, and `server.cache.cleared`.
- Keep `/api/events/log?since=<id>&runId=<id>` scoped to the selected target server through the runtime client.

**Onboarding And Discoverability:**

- Existing local app behavior stays the default when the UI is served by an OmniHarness server.
- Standalone mode shows a compact server selector in the header and an empty state that lets the user add a server URL.
- Adding a server validates the URL and shows reachability/auth/version state before selection.
- Server settings live in a dense settings/control surface with compact rows and no redundant explanatory chrome.

**Risk And Trust Surfaces:**

- Cross-server data bleed is the main trust risk. Every cache and async callback must prove server ownership before mutating visible state.
- Auth confusion is high risk: a login prompt must name the server it applies to and never imply the user is logged into all servers.
- Destructive actions must keep acting only on the active server and clearly show the server context.
- `localhost` is not globally meaningful across devices. Stored server origins must be displayed exactly enough for users to distinguish local, LAN, and tunneled servers.

## Product Completeness Pass

### Primary Stories

- As a builder, I can add a real OmniHarness server by URL and select it as the active server.
- As a builder, I can switch between remembered servers and see the correct conversations, workers, status, and settings for the selected server.
- As a builder, I can continue using the current single-server local app without configuring a server directory.

### First-Run And Empty-State Stories

- As a first-time standalone user, I see that no server is connected and can add one.
- As a user who opens the local app at `http://localhost:3035`, I land directly in the existing home surface with the current server auto-registered as the local server.

### Return/Revisit Stories

- As a returning user, I see remembered servers and the last selected server.
- As a returning user, cached previews may speed up the UI but cannot satisfy loaded authority until the selected server responds.

### Failure And Recovery Stories

- As a user, I see when a server is offline, requires login, is incompatible, or returns a runtime error.
- As a user, I can retry health/auth/bootstrap for a server without losing draft input for another server.
- As a user, if SSE replay is unavailable, the interface re-bootstrapes from the target server's snapshot anchor and does not silently miss events.

### Status-Awareness Stories

- As a user, I know which server is active at all times.
- As a user, I can tell whether active conversations and worker streams are live, cached preview, reconnecting, resyncing, or terminal.
- As a user, I can see per-server status in the selector without every known server blocking initial render.

### Mutation Stories

- As a user, creating, sending, stopping, retrying, deleting, archiving, editing, forking, settings saves, file opens, git workspace actions, and planning review actions apply only to the selected server.
- As a user, if I switch servers while a mutation is in flight, the mutation result cannot navigate, clear composer state, or update snapshots for the new server unless it owns the current server token.

### Mobile Stories

- As a mobile user, I can still see and change the active server through the existing header/mobile navigation without crowding the composer or conversation controls.
- As a mobile user, add/edit server controls use a sheet/dialog pattern that preserves the current conversation context.

## Architecture

### Standalone Interface Definition

This milestone includes two entry modes:

- **Served local mode:** the current app is served by an OmniHarness runtime at an origin such as `http://localhost:3035`. This mode auto-registers the serving origin as the local/default server and must remain the simplest path.
- **Standalone client mode:** `src/ui/render-web.tsx` becomes the browser/static entry that can mount `OmniApp` with `bootstrap={null}` when `/api/runtime/bootstrap` is unavailable or intentionally skipped. The milestone is not complete until that entry renders the server-directory empty state without requiring a local OmniHarness runtime to provide initial conversation data.

Standalone acceptance criteria:

- `OmniApp` and `HomeApp` accept `HomeBootstrapPayload | null`.
- The renderer has a boot path where `initialEventState`, `initialQueries.session`, and `initialQueries.settings` are absent because no server is selected yet.
- Adding a server probes `/api/runtime/bootstrap` on that target and transitions into normal authenticated/unauthenticated runtime flow.
- Browser routing, selected run params, and pair-token params do not crash when no server exists.
- The local served mode still works without any visible setup for single-server users.

### Server Directory

Create a frontend `ServerDirectoryManager` that owns remembered servers and selected server state. It is the only source of truth for:

- `serverId`,
- normalized origin,
- display name,
- status,
- last selected server,
- last health/auth/version result,
- local validation errors,
- add/edit/remove dialog draft state.

The manager persists only directory metadata to localStorage. It also exposes a current `serverToken`/generation that increments on selection, edit, removal, and explicit reconnect. Async code must carry this token and check it before mutating Managers, query caches, route state, worker stream state, or composer state.

### Runtime Descriptor Schema

Add a versioned runtime descriptor to `/api/runtime/bootstrap` and `HomeBootstrapPayload`:

```ts
type RuntimeServerDescriptor = {
  descriptorVersion: 1;
  installationId: string;
  serverId: string;
  origin: string;
  displayName: string;
  runtimeVersion: string;
  capabilities: Array<
    | "events.sse.v1"
    | "events.log.v1"
    | "events.snapshot.v1"
    | "workers.entries.v1"
    | "auth.cookie.v1"
    | "settings.v1"
    | "conversations.v1"
    | "files.v1"
    | "git.v1"
    | "notifications.v1"
  >;
  standaloneInterfaceSupported: boolean;
};
```

Descriptor rules:

- For the server that serves the UI, derive `serverId` from the normalized origin and descriptor version unless a future durable installation id exists. Remote directory entries keep their generated local `serverId` stable even if display name changes.
- `installationId` is a durable server-side uuid persisted outside the browser, generated on first startup if missing, and returned by every runtime bootstrap. Use it as the preferred stable identity across localhost/LAN/tunnel origins.
- `serverId` is the local directory key. For servers with `installationId`, derive it from `installationId`; for legacy servers without it, derive it from normalized origin and descriptor version.
- Duplicate normalized origins map to one remembered server record; adding the same origin updates/probes the existing record instead of creating a duplicate.
- If a tunnel URL points to the same `installationId` as another remembered origin, the directory links both origins to the same server record and updates the preferred origin only through explicit user action. Without `installationId`, the UI may warn about matching display/version but must not merge records by guesswork.
- Missing required capabilities produce `incompatible` status with a precise list of missing capabilities.
- Descriptor version mismatch is recoverable: the user can keep the server record, retry after upgrade, or remove the local record.
- Tests must cover same origin, duplicate origin, changed display name, tunnel origin with same installation id, legacy server without installation id, missing capability, and unsupported descriptor version.

### Selected-Server Transport Boundary

Use `src/app/home/runtime-client.ts` as the selected-server transport. It is not a second product API; it is the single low-level implementation used by Home app call sites and, where applicable, by `src/runtime-api/web.ts`:

```ts
type RuntimeServerRef = {
  serverId: string;
  origin: string;
  generation: number;
};

type SelectedRuntimeTransport = {
  server: RuntimeServerRef;
  buildUrl(path: string): string;
  requestJson<T>(path: string, init: RequestInit | undefined, fallback: AppErrorDescriptor): Promise<T>;
  fetch(path: string, init?: RequestInit): Promise<Response>;
  openEvents(args: { runId?: string | null; lastEventId?: string | null }, handlers: EventStreamHandlers): RuntimeSubscription;
  fetchSnapshot(args: { runId?: string | null; checksum?: string | null }): Promise<SnapshotPollResult>;
};
```

The exact shape can change during implementation, but the boundary must preserve these ownership rules:

- `requestJson` and raw `fetch` call sites in Home/runtime UI code migrate to the selected-server transport unless the audit classifies them as local-shell-only.
- `LiveEventConnectionManager` receives the selected-server transport, not a bare URL builder.
- `src/runtime-api/web.ts` gains `EventSource` credentials support and may delegate to the transport for web-selected-server calls. Electron and VS Code adapters remain shell adapters unless/until they expose multi-server selection.
- Local-only shell endpoints may remain relative only after a call-site audit classifies them as local-shell-only.
- Direct calls to hardcoded `"/api/..."` from app-state code that depends on the selected server are forbidden after this migration.

### Bootstrap Model

Extend `HomeBootstrapPayload` with a runtime descriptor for the server that served the page:

- `serverId`,
- `origin`,
- `displayName`,
- `runtimeVersion`,
- `capabilities`,
- `standaloneInterfaceSupported`.

When the page is served by an OmniHarness runtime, the interface auto-registers this origin as the local/current server and hydrates initial event/settings/session data under that `serverId`. When the page is served as a static/standalone interface, it starts without an initial runtime payload and prompts for a server.

### Remote Access Policy

To support a standalone UI hosted on a different origin from a target server, the target OmniHarness server must expose an explicit browser access policy. Add this as a server-side runtime feature, not as an implicit permissive CORS change:


````

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:55:25.284Z","phase":null} -->
## Tool result: call_fLpExhJSIzikl9K1PqpnVUQF · 2026-06-14T15:55:25.284Z

````text
Chunk ID: 0c7021
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 7251
Output:

- Configured allowed UI origins, with local defaults for same-origin and explicit development origins only.
- `OPTIONS` preflight handling for runtime routes that accept cross-origin requests.
- `Access-Control-Allow-Origin` echo for allowed origins, never `*` when credentials are used.
- `Access-Control-Allow-Credentials: true` for allowed credentialed requests.
- Allowed methods/headers for JSON runtime calls.
- SSE support with credentials. Native `EventSource` does not support arbitrary headers and only supports cookies when constructed with `{ withCredentials: true }`; the runtime API adapter must account for this.
- Cookie strategy must be explicit. Current auth cookies are `SameSite=Lax`, which is not enough for true cross-site standalone access. The implementation must either add a secure cross-site cookie mode for explicitly allowed HTTPS origins (`SameSite=None; Secure`) or design an explicit token/session bridge for standalone clients.
- Existing same-origin CSRF checks in auth routes must be revisited so cross-origin login is accepted only from configured standalone UI origins and still rejected from arbitrary sites.
- Tests must cover protected server login/session from an allowed origin, disallowed origin rejection, preflight, SSE credentials, and logout/session revocation.

This cross-origin backend work is part of the current milestone. Multi-server same-origin/localhost support may land behind passing tests first, but the milestone is not complete until allowed-origin standalone access works against an authenticated protected server.

### Query And Cache Model

Every TanStack Query key for runtime state must include `serverId`:

- `["auth-session", serverId]`,
- `["settings", serverId]`,
- `["worker-catalog", serverId]`,
- `["project-files", serverId, projectPath]`,
- mutation side-effect ownership checked by `serverId + generation`.

Every localStorage cache key or envelope scope must include `serverId`:

- event snapshot cache: `serverId + runId/global`,
- worker entries cache: `serverId + workerId`,
- route selection/read markers where persisted locally,
- optimistic created/sent conversation snapshots.

### SSE And Worker Entries

`LiveEventConnectionManager` receives a runtime client and `serverRef`. It builds `/api/events` URLs against the selected server origin, carries the selected server generation, and ignores late events from old generations. `lastEventId` is per `serverId` and per selected run scope.

`WorkerEntriesManager` keys state by `{ serverId, workerId }`, not by `workerId` alone. SSE `worker.entry_appended` remains a wake-up hint; the manager fetches entry bodies from the selected server's `/api/workers/:workerId/entries` endpoint. A global ring-buffer resync on one server must not clear worker streams for another server.

### Auth And Trust Boundary

Auth remains server-origin-owned. The runtime client uses `credentials: "include"` for same-origin and configured remote origins, and surfaces `401`/`403` as server-specific auth state. Login/logout/session routes are issued against the selected server only.

Cross-origin support must be explicit:

- Detect and report CORS/network failures separately from auth failures.
- Require `http://` or `https://` origins; normalize away trailing slashes.
- Block obviously unsafe protocols.
- Show the exact origin in auth and destructive-action context.

### UI Surface

Add a compact active-server control to `HomeHeader` using existing shadcn/ui primitives:

- active server name/origin,
- health/auth status indicator,
- menu to switch servers,
- add server action,
- edit/remove action for remembered servers,
- retry connection action.

Settings gets a server directory panel or section with dense rows. It should follow the existing settings layout and avoid duplicate headings/subtitles. The add/edit server dialog validates and probes a server before saving or selecting.

Desktop/mobile behavior:

- Desktop: header selector plus settings panel.
- Mobile: same selector accessible from top navigation or a sheet; no crowded inline server table in the composer.

### Error Model

Extend `AppErrorDescriptor` or wrap it at runtime-client boundaries with:

- `serverId`,
- `origin`,
- `code`,
- `status`,
- `source`,
- `action`,
- `details`.

Do not replace target server errors with generic "failed" text. Preserve server-provided stable codes and details when present.

### Runtime Call-Site Audit

Before changing runtime behavior, run and preserve an audit of every runtime-shaped call site:

```bash
rg -n "fetch\\(|requestJson\\(|new EventSource|/api/" src/app src/components src/lib src/runtime-api
```

Classify each call as:

- `runtime-targeted`: must go through `RuntimeAPIs`/selected-server transport and include `serverId` in cache/ownership.
- `local-shell-only`: remains relative because it targets the shell hosting the renderer rather than the selected OmniHarness server.
- `server-internal`: stays server-side and is not part of browser server selection.

Known runtime-targeted areas include auth/session/login/logout, settings saves, worker catalog, project files and file viewer, file pickers, attachments, notifications, project memory, git workspace, queued-message mutations, transcript/history fetches, prewarm, pairing, external sessions, model auth status, conversation create/send, run actions, planning review/promote, events/log, and worker entries. The implementation checklist must update the file map from this audit before implementation proceeds.

## Client/Server State Invariants

- **Owner:** Runtime data is owned by the selected server. Directory metadata is owned by `ServerDirectoryManager`. Worker transcript content is owned by the target server's worker JSONL stream.
- **Token:** Every async result carries `serverId + generation`; run-specific work also carries `runId`; worker content also carries `serverId + workerId + seq`.
- **Provenance:** Cached snapshots and worker entries are preview/fallback only until the selected server returns authoritative bootstrap/snapshot or contiguous stream data.
- **Completeness:** Event snapshots keep existing `snapshotScope`, `messageScope`, and catalog completeness rules, now scoped by `serverId`.
- **Ordering:** SSE uses the target server's monotonic event ids. Worker content uses target server per-worker `seq`. Lists keep existing deterministic tie-breakers such as `(createdAt, id)`.
- **State machine:** Server directory status transitions are explicit: unknown -> checking -> reachable/authRequired/authenticated/degraded/offline/incompatible.
- **Events:** Server decisions still come from the target server's named events. Client-side server-selection decisions are manager-owned UI state, not synthetic runtime events.
- **Loading shape:** Split active-server bootstrap, auth check, snapshot load, SSE reconnect, worker-entry fetch, background health check, and terminal error states.
- **Fallbacks:** A cached same-server preview may render while reconnecting. A different server's cache must never render for the selected server.
- **Tests:** Include stale-response, server-switch, query-key, SSE replay/resync, worker-entry cache, and mutation ownership tests.

## File Map

### Files To Create

- `docs/architecture/multi-server-runtime-callsite-audit.md`
  - Required first artifact: classified audit table for every browser/runtime `fetch`, `requestJson`, `new EventSource`, and `"/api/"` call site.
- `src/app/home/ServerDirectoryManager.ts`
  - Manager for remembered servers, selected server, health/auth status, add/edit/remove dialog drafts, localStorage persistence, and generation tokens.
- `src/app/home/runtime-client.ts`
  - Selected-server-aware wrapper for `requestJson`, raw `fetch`, snapshot fetches, event-stream construction, worker-entry URL construction, timeout, cancellation, and error-normalization helpers.
- `src/app/home/server-directory-storage.ts`
  - Versioned serialization, migration, origin normalization, pruning, and local removal helpers for server directory records.
- `src/app/home/server-health.ts`
  - Probe logic for runtime bootstrap/session capability checks with bounded timeouts and typed outcomes.
- `src/server/installation-id.ts`
  - Durable runtime installation id creation/read helper used by bootstrap descriptors.
- `src/runtime/http/cors.ts`
  - Allowed standalone UI origin parsing, CORS/preflight response helpers, credential policy, and route wrapper utilities.
- `tests/runtime/cors-auth.test.ts`
  - Cross-origin protected-server auth, preflight, cookie/session, and disallowed-origin coverage.
- `src/components/home/ServerSelector.tsx`
  - Header/mobile server selector, status menu, switch/retry/edit/remove entry points, all strings through i18n.
- `src/components/settings/ServersSettingsPanel.tsx`
  - Dense settings panel for remembered servers and add/edit/remove controls.
- `src/components/home/ServerConnectionDialog.tsx`
  - Add/edit server dialog with URL normalization, validation, probe result, auth/incompatible/offline messaging, and save/select actions.
- `tests/app/home/ServerDirectoryManager.test.ts`
  - Directory persistence, selection generation, remove semantics, migration, and status transitions.
- `tests/app/home/runtime-client.test.ts`
  - URL building, error normalization, auth/offline classification, timeout/cancellation, and ownership-token behavior.
- `tests/app/home/multi-server-cache.test.ts`
  - Snapshot/worker cache scoping by `serverId`, stale SSE generation fencing, stale mutation side effects, and corrupt localStorage recovery.
- `tests/lifecycle/scenarios/multi-server-interface.test.ts`
  - Headless two-server scenario proving selected-server bootstrap, event logs, worker entries, auth/offline behavior, and cleanup.
- `docs/architecture/multi-server-standalone-interface.md`
  - Architecture doc covering server directory ownership, runtime-client contracts, cache keys, auth boundary, and test rules.

### Files To Modify

- `src/runtime/bootstrap.ts`
  - Add runtime/server descriptor fields to `HomeBootstrapPayload`, including durable `installationId`.
- `src/app/home/bootstrap.server.ts`
  - Preserve existing Next bootstrap while passing descriptor data through.
- `src/ui/OmniApp.tsx`
  - Accept `HomeBootstrapPayload | null` and keep `RuntimeApiProvider` available for served and standalone entry modes.
- `src/ui/render-web.tsx`
  - Support standalone null-bootstrap mounting when no server is selected or `/api/runtime/bootstrap` is unavailable.
- `src/runtime-api/types.ts`
  - Add any selected-server transport, event-source option, or descriptor types that belong in the shared shell contract.
- `src/runtime-api/web.ts`
  - Add selected-server transport delegation where appropriate and update `EventSource` constructor typing to support `{ withCredentials: true }`.
- `src/runtime-api/electron.ts` and `src/runtime-api/vscode.ts`
  - Keep shell adapters compatible with the updated shared runtime API types.
- `src/runtime-api/provider.tsx`
  - Preserve provider behavior while allowing standalone/null-bootstrap app startup.
- `src/runtime/http/registry.ts` and/or `src/runtime/http/server.ts`
  - Apply CORS/preflight policy consistently to runtime routes without weakening same-origin defaults.
- `src/runtime/http/routes/cookies.ts`
  - Support the chosen explicit standalone cookie/session strategy for configured HTTPS standalone origins.
- `src/runtime/http/routes/auth-login.ts` and `src/runtime/http/routes/auth-session.ts`
  - Revisit same-origin/CSRF checks for configured standalone UI origins while still rejecting arbitrary cross-site requests.
- `src/app/home/HomeApp.tsx`
  - Hydrate server directory from bootstrap, pass active server context to queries, lifecycle, mutations, header, settings, and stream managers. Split before adding substantial logic because this file is already over 1200 lines.
- `src/app/home/useHomeQueries.ts`
  - Include `serverId` in query keys and route all runtime requests through `runtime-client`.
- `src/app/home/useHomeMutations.ts`
  - Include selected server ownership in mutation start state, route requests through `runtime-client`, and block stale mutation side effects after server switches.
- `src/app/home/useQueuedMessageMutations.ts`
  - Route queued-message actions through selected-server transport with ownership checks.
- `src/app/home/useConversationActions.ts`
  - Route fire-and-forget settings/runtime calls through selected-server transport or classify as local-shell-only.
- `src/app/home/useHomeLifecycle.ts`
  - Recreate/cancel live event connections when `serverId`, generation, selected run, or auth state changes.
- `src/app/home/LiveEventConnectionManager.ts`
  - Replace relative URL builders with runtime-client URL builders, carry server generation, and report server-scoped errors.
- `src/app/home/EventStreamStateManager.ts`
  - Preserve merge/completeness behavior while scoping cache hydration and authoritative snapshots by `serverId`.
- `src/app/home/EventStreamSnapshotCacheManager.ts`
  - Version cache envelopes to include `serverId` in scope keys; migrate or ignore v1 same-origin-only cache safely.
- `src/app/home/WorkerEntriesManager.ts`
  - Key state, listeners, cache entries, in-flight requests, wake versions, and endpoint builders by `serverId + workerId`.
- `src/app/home/HomeUiStateManager.ts`
  - Add selected server route/UI state only if it belongs with existing route state; otherwise keep it in `ServerDirectoryManager`.
- `src/components/home/HomeHeader.tsx`
  - Render `ServerSelector` without broad subscriptions to high-churn conversation state.
- `src/components/home/SettingsDialog.tsx`
  - Register the servers settings section/tab if the existing settings composition supports it.
- `src/components/settings/GeneralSettingsPanel.tsx`
  - Link or route to server directory controls if that matches the current settings hierarchy.
- `src/components/home/ConversationSidebar.tsx`
  - Make active-server identity visible where needed and avoid cross-server cached counts.
- `src/components/home/ConversationMain.tsx`
  - Ensure destructive and mutation controls receive active server context and render server-specific failure context. Avoid growing this already-large file; extract helper components if substantial UI is needed.
- `src/components/home/FileViewerPanel.tsx`, `src/components/FolderPickerDialog.tsx`, `src/components/FileAttachmentPickerDialog.tsx`, `src/app/home/ComposerContainer.tsx`, `src/app/home/ExternalSessionsPicker.tsx`, `src/app/home/ConversationNotificationManager.ts`, `src/app/home/ProjectMemoryPanelManager.ts`, `src/app/home/GitWorkspaceManager.ts`, `src/app/home/upload-attachments.ts`, and `src/components/settings/ModelProfileForm.tsx`
  - Classify through the call-site audit and migrate runtime-targeted requests to selected-server transport.
- `src/lib/app-errors.ts`
  - Preserve runtime `code`, `serverId`, and `origin` fields in normalized app errors.
- `shared/locales/*.json`
  - Add keys for server selector, server statuses, add/edit/remove dialogs, validation, auth/offline/incompatible errors, retry, and settings labels.
- `tests/lifecycle/harness/server.ts`
  - Keep for in-process single-server scenarios; do not use it as the authority for two-server isolation.
- `tests/lifecycle/harness/subprocess.ts` and `tests/lifecycle/harness/subprocess-runner.ts`
  - Add or verify support for launching two independent subprocess harnesses with separate roots and route coverage for bootstrap, auth, events/log, worker entries, settings, conversations, and cleanup.
- `tests/lifecycle/harness/client.ts`
  - If needed, add helpers for server-specific bootstrap/events/log/worker-entry calls.
- `.gitignore`
  - Verify no change is needed; add ignores only if tests introduce new temp output paths.

### Tests To Update Or Add

- Unit tests for server origin normalization and unsafe protocol rejection.
- Unit tests for runtime descriptor schema, durable installation id stability, duplicate origin handling, tunnel origin with same installation id, legacy no-installation-id fallback, and incompatible capability detection.
- Unit tests for `ServerDirectoryManager` persistence, migrations, generation ownership, last-selected behavior, and local-only removal.
- Unit tests for runtime-client request URL building, credentials mode, timeout/cancellation, auth/offline/incompatible classification, and error details.
- Unit tests for malformed/corrupt server-directory localStorage recovery.
- Unit tests for `useHomeQueries` query keys or extracted key builders to prove `serverId` is always present for runtime queries.
- Unit tests for mutation ownership helpers in `useHomeMutations.ts`: start on server A, switch to B, resolve A, assert B navigation, composer draft, attachments, query cache, and snapshots are not mutated.
- Unit tests for `EventStreamSnapshotCacheManager` proving server A cache cannot hydrate server B, and server-authoritative bootstrap cannot be demoted by same-server cache.
- Unit tests for `WorkerEntriesManager` proving same `workerId` on two servers has independent entries, in-flight requests, cache, and wake-up behavior.
- Unit tests for stale SSE generation fencing: open stream for server A generation 1, switch/reconnect to generation 2 or server B, deliver generation 1 event, assert it is ignored.
- Runtime route tests for allowed-origin CORS, denied-origin CORS, preflight, credentialed auth login/session/logout, and SSE credential compatibility.
- Lifecycle scenario with two real isolated servers:
  - add/select server A and server B,
  - verify bootstrap and `/api/events/log` source for each,
  - create or inspect a conversation on A,
  - switch to B and verify A data disappears or becomes clearly inactive,
  - reconnect A with `Last-Event-ID`,
  - simulate B offline and verify A remains usable,
  - cleanup all test conversations/artifacts on both servers.
- Existing lifecycle tests must keep passing: `pnpm test:lifecycle`.

### Candidate Agentic User Journey Tests

These require explicit user approval before running:

- **Two-server switching journey:** open the UI, add two local test servers, create a conversation on each, switch repeatedly, and confirm conversations, worker streams, and composer drafts do not bleed across servers.
- **Auth boundary journey:** connect to one unlocked server and one password-protected server, verify login state and errors are scoped to the protected server.
- **Offline recovery journey:** connect to two servers, stop one, verify status/error/retry behavior while the other remains usable, restart the stopped server, and verify reconnect/resync.
- **Mobile selector journey:** verify server selection and add/edit flows fit on mobile without hiding the active conversation state.

### `.gitignore` Coverage

Before implementation, verify `.gitignore` covers:

- `node_modules/`, package-manager caches, `.next/`, coverage, logs, temp files, and lifecycle harness temp roots.
- No server-directory secret files are introduced.
- No generated screenshots, Playwright reports, or lifecycle run artifacts are committed unless explicitly requested.

## Implementation Checklist

- [ ] Phase 0: audit touched file sizes and split before adding major logic.
  - `src/app/home/HomeApp.tsx` is already over 1200 lines; extract server-directory bootstrap/lifecycle glue before adding the new surface.
  - `src/app/home/useHomeMutations.ts` is close to 1200 lines; extract server-aware request helpers and ownership checks rather than growing inline mutation bodies.
  - Verification: `wc -l` confirms new multi-server logic lives in dedicated modules and no touched file newly exceeds 1200 lines without a planned split.

- [ ] Phase 0: perform the runtime call-site audit before implementation.
  - Run `rg -n "fetch\\(|requestJson\\(|new EventSource|/api/" src/app src/components src/lib src/runtime-api`.
  - Create `docs/architecture/multi-server-runtime-callsite-audit.md` with a table of file, line, endpoint, owner classification, migration action, and test requirement.
  - Update this plan's file map if the audit finds any additional runtime-targeted modules.
  - Verification: every browser-visible call site is classified as `runtime-targeted`, `local-shell-only`, or `server-internal`; no unclassified direct runtime calls remain.

- [ ] Phase 1: add the runtime descriptor schema and durable installation id.
  - Create `src/server/installation-id.ts`.
  - Modify `src/runtime/bootstrap.ts`, `src/app/home/bootstrap.server.ts`, and runtime bootstrap route tests.
  - Include `descriptorVersion`, durable `installationId`, `serverId`, origin, display name, runtime version, required capabilities, standalone support, and initial data ownership.
  - Verification: tests prove `/api/runtime/bootstrap` and SSR bootstrap include the descriptor; duplicate origin, same installation via tunnel, legacy no-installation-id fallback, missing capability, and unsupported descriptor version behave as specified.

- [ ] Phase 1: keep current single-server behavior passing after descriptor changes.
  - Run focused bootstrap/session/settings/event snapshot tests.
  - Verification: the served local app still loads without creating or selecting any extra server record manually.

- [ ] Phase 2: implement the selected-server transport with TDD.
  - Create `src/app/home/runtime-client.ts` and `src/app/home/server-health.ts`.
  - Update `src/runtime-api/types.ts`, `src/runtime-api/web.ts`, and `src/runtime-api/provider.tsx` only as needed to delegate to or coexist with the selected-server transport.
  - Enforce URL normalization, allowed protocols, credentials, timeouts, aborts, error normalization, ownership-token checks, and `EventSource` option support for `{ withCredentials: true }`.
  - Verification: `pnpm test -- tests/app/home/runtime-client.test.ts` covers request URL building, raw fetch wrapping, credentials mode, timeout/cancellation, auth/offline/incompatible classification, event-source credentials, and stale generation rejection.

- [ ] Phase 2: migrate audited runtime call sites to the selected-server transport.
  - Migrate `useHomeQueries`, `useHomeMutations`, `useQueuedMessageMutations`, `useConversationActions`, file viewer/pickers, attachments, notifications, project memory, git workspace, external sessions, model auth status, prewarm, pairing, events/log, and worker entries according to the audit table.
  - Leave only audited `local-shell-only` relative calls behind, with comments or helper names that make their ownership clear.
  - Verification: rerun the audit command and confirm all runtime-targeted browser calls use the selected-server transport.

- [ ] Phase 3: scope event snapshot cache by server while defaulting to the local server.
  - Modify `src/app/home/EventStreamSnapshotCacheManager.ts` and `src/app/home/EventStreamStateManager.ts`.
  - Preserve server-authoritative bootstrap behavior and existing scoped completeness merges.
  - Verification: cache tests prove no cross-server hydration, corrupt localStorage recovery, and no demotion of `snapshotSource: "server"`.

- [ ] Phase 3: scope worker entry state and cache by server.
  - Modify `src/app/home/WorkerEntriesManager.ts`.
  - Keep the contiguous-prefix invariant, wake-up semantics, bounded cache, and `?afterSeq=`/tail/backfill flows.
  - Verification: worker manager tests prove same `workerId` on two servers stays isolated and stale fetches cannot mutate the active server stream.

- [ ] Phase 3: route live event connections through the selected-server transport.
  - Modify `src/app/home/LiveEventConnectionManager.ts` and `src/app/home/useHomeLifecycle.ts`.
  - Carry `serverId + generation`, per-server `lastEventId`, snapshot anchor headers, fallback polling, resync behavior, and stale SSE generation fencing.
  - Verification: unit tests for URL construction/ownership plus lifecycle SSE scenario for reconnect/resync and stale-generation event drops.

- [ ] Phase 3: make query keys and bootstrap hydration server-aware.
  - Modify `src/app/home/HomeApp.tsx`, `src/app/home/useHomeQueries.ts`, and related extracted helpers.
  - Prime TanStack Query under `serverId` keys and clear or ignore previous-server queries on selection change without globally discarding useful caches.
  - Verification: tests or focused assertions prove `auth-session`, `settings`, `worker-catalog`, and `project-files` cannot be read across servers.

- [ ] Phase 3: make mutations server-aware and stale-safe.
  - Modify `src/app/home/useHomeMutations.ts`, `src/app/home/useQueuedMessageMutations.ts` if needed, and supporting action helpers.
  - At mutation start, capture `serverId`, generation, selected run, composer draft, and attachments identity. On success/error, mutate UI only if ownership still matches.
  - Verification: stale mutation tests for create, send, stop, delete/archive, settings save, queued-message actions, composer clearing, attachment clearing, and navigation side effects.

- [ ] Phase 4: implement server directory storage and manager with TDD.
  - Create `src/app/home/server-directory-storage.ts` and `src/app/home/ServerDirectoryManager.ts`.
  - Cover add, update, remove, select, generation increment, last selected server, migration, malformed JSON recovery, invalid records, bootstrap auto-registration, installation-id duplicate handling, and bounded diagnostics records.
  - Verification: `pnpm test -- tests/app/home/ServerDirectoryManager.test.ts`.

- [ ] Phase 4: implement null-bootstrap standalone entry behavior.
  - Modify `src/ui/OmniApp.tsx`, `src/ui/render-web.tsx`, and `src/app/home/HomeApp.tsx`.
  - Let `HomeApp` render the server-directory empty state when bootstrap is null and no server is selected.
  - Verify selected run params, project params, and pair-token params do not crash before a server exists.
  - Verification: component/unit test mounts `OmniApp`/`HomeApp` with null bootstrap and proves the empty state renders without runtime queries firing.

- [ ] Phase 4: build the server selector and connection dialogs.
  - Create `src/components/home/ServerSelector.tsx` and `src/components/home/ServerConnectionDialog.tsx`.
  - Modify `src/components/home/HomeHeader.tsx` and mobile navigation wiring.
  - Use existing shadcn/ui controls; use lucide icons where appropriate; keep subscriptions narrow.
  - Verification: component tests where practical and Playwright screenshot/journey only with user approval.

- [ ] Phase 4: add the servers settings surface.
  - Create `src/components/settings/ServersSettingsPanel.tsx`.
  - Modify `src/components/home/SettingsDialog.tsx` or the active settings composition to include it.
  - Use compact rows, explicit save/remove/retry behavior, and no repeated headings or decorative nested cards.
  - Verification: i18n tests/static checks plus manual UI check if running browser verification is approved.

- [ ] Phase 4: add all i18n resources.
  - Modify every `shared/locales/*.json` file in the same change.
  - Add stable dotted keys for selector labels, statuses, validation, auth/offline/incompatible errors, add/edit/remove actions, retry, and settings copy.
  - Verification: JSON parse check and existing i18n/lint checks.

- [ ] Phase 5: implement explicit cross-origin runtime access policy.
  - Create `src/runtime/http/cors.ts`.
  - Modify runtime registry/server and auth/cookie routes to support configured standalone UI origins, preflight, credentialed requests, SSE credentials, and secure cross-site cookie or explicit token/session bridge.
  - Keep same-origin defaults unchanged and reject arbitrary cross-site requests.
  - Document HTTPS-only constraints for cross-site cookie auth and authenticated SSE.
  - Verification: `pnpm test -- tests/runtime/cors-auth.test.ts` covers allowed origin, disallowed origin, preflight, protected login/session/logout, and SSE credentials.

- [ ] Phase 5: preserve error transparency with server context.
  - Modify `src/lib/app-errors.ts` and runtime-client error handling.
  - Preserve target server stable error codes, status, details, source/action, `serverId`, and origin.
  - Verification: tests cover server JSON error payloads, network failures, CORS-like fetch failures, auth failures, and malformed payloads.

- [ ] Phase 6: add lifecycle coverage for two real subprocess servers.
  - Create `tests/lifecycle/scenarios/multi-server-interface.test.ts`.
  - Use or extend `tests/lifecycle/harness/subprocess.ts` and `tests/lifecycle/harness/subprocess-runner.ts`; do not rely on the in-process harness for two-server isolation.
  - Launch two isolated subprocess servers with separate roots and route coverage for bootstrap, auth, events/log, worker entries, settings, conversations, and cleanup.
  - Assert on HTTP/SSE/event-log behavior rather than browser DOM for control-plane correctness.
  - Verification: targeted lifecycle scenario passes and cleanup leaves no test conversations/artifacts behind.

````

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:55:31.190Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:55:31.190Z

The consistency scan found one stale phrase about a “future” installation id after we made it current scope. I’m tightening those leftover conditionals before the final reviewer rerun.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:55:38.085Z","phase":null} -->
## Tool call: apply_patch · 2026-06-14T15:55:38.085Z

```json
*** Begin Patch
*** Update File: docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md
@@
-- For the server that serves the UI, derive `serverId` from the normalized origin and descriptor version unless a future durable installation id exists. Remote directory entries keep their generated local `serverId` stable even if display name changes.
+- For the server that serves the UI, derive `serverId` from the durable `installationId`. Remote directory entries keep their generated local `serverId` stable even if display name changes.
@@
-- `src/runtime-api/web.ts` gains `EventSource` credentials support and may delegate to the transport for web-selected-server calls. Electron and VS Code adapters remain shell adapters unless/until they expose multi-server selection.
+- `src/runtime-api/web.ts` gains `EventSource` credentials support and delegates web-selected-server calls to the transport where Home app behavior needs selected-server ownership. Electron and VS Code adapters remain shell adapters for this milestone.
@@
-- `tests/lifecycle/harness/client.ts`
-  - If needed, add helpers for server-specific bootstrap/events/log/worker-entry calls.
+- `tests/lifecycle/harness/client.ts`
+  - Add helpers for server-specific bootstrap/events/log/worker-entry calls used by the two-subprocess scenario.
@@
-- [ ] Phase 3: make mutations server-aware and stale-safe.
-  - Modify `src/app/home/useHomeMutations.ts`, `src/app/home/useQueuedMessageMutations.ts` if needed, and supporting action helpers.
+- [ ] Phase 3: make mutations server-aware and stale-safe.
+  - Modify `src/app/home/useHomeMutations.ts`, `src/app/home/useQueuedMessageMutations.ts`, and supporting action helpers.
*** End Patch

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:55:38.102Z","phase":null} -->
## Tool result: call_QmBU5kreblY4APrtW1ZwcsOI · 2026-06-14T15:55:38.102Z

```text
Exit code: 0
Wall time: 0 seconds
Output:
Success. Updated the following files:
M docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:55:41.843Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:55:41.843Z

I’m rerunning Baton on the hardened plan now. This should tell us whether the plan is ready or if there are still blocking gaps.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:55:47.219Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:55:47.219Z

```json
{
  "cmd": "PATH=/Users/masterman/.local/bin:$PATH /Users/masterman/.local/bin/baton -p \"You are my second-opinion planning reviewer. Review the revised artifact without editing files. Artifact: /Users/masterman/NLP/omniharness/docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md. User goal: support multiple OmniHarness servers inside the same running app by turning the interface into a standalone thing that can connect to multiple servers. Context and constraints: no branches, no worktrees, no file deletion; preserve unified worker stream; all frontend strings through shared/locales and t(); manager-owned React state; server decisions through named events; lifecycle tests via HTTP/SSE. A prior review found gaps around runtime-client injection point, call-site audit, cross-origin auth/CORS, EventSource credentials, standalone null bootstrap, durable installation id, generation-fencing tests, diagnostics, and phase gates; those have been revised. Please judge whether this plan is now ready to use. Return: 1. Verdict READY or HARDEN 2. Any remaining highest-impact findings with concrete fixes 3. Anything you would deliberately leave alone.\"",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 30000,
  "max_output_tokens": 50000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:56:17.384Z","phase":null} -->
## Tool result: call_GYIcIqBRIS8nZCJKu50R6Iq9 · 2026-06-14T15:56:17.384Z

```text
Chunk ID: e172e9
Wall time: 30.0030 seconds
Process running with session ID 31288
Original token count: 0
Output:

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:56:20.432Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:56:20.432Z

Baton is running the second pass.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:56:21.205Z","phase":null} -->
## Tool call: write_stdin · 2026-06-14T15:56:21.205Z

```json
{
  "session_id": 31288,
  "chars": "",
  "yield_time_ms": 30000,
  "max_output_tokens": 50000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:56:51.209Z","phase":null} -->
## Tool result: call_89VIaQqk3wJCdQ5s4pUyRMVF · 2026-06-14T15:56:51.209Z

```text
Chunk ID: bfee3e
Wall time: 30.0032 seconds
Process running with session ID 31288
Original token count: 0
Output:

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:56:53.518Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:56:53.518Z

No output yet from the second Baton pass; still running.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:56:54.445Z","phase":null} -->
## Tool call: write_stdin · 2026-06-14T15:56:54.445Z

```json
{
  "session_id": 31288,
  "chars": "",
  "yield_time_ms": 30000,
  "max_output_tokens": 50000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:57:24.448Z","phase":null} -->
## Tool result: call_kSvT7YtjjzkKILhGPPqXoy1a · 2026-06-14T15:57:24.448Z

```text
Chunk ID: 3e895a
Wall time: 30.0018 seconds
Process running with session ID 31288
Original token count: 0
Output:

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:57:27.117Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:57:27.117Z

Still waiting on Baton; I’ll keep polling until it exits so the turn doesn’t leave a reviewer process running.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:57:27.965Z","phase":null} -->
## Tool call: write_stdin · 2026-06-14T15:57:27.965Z

```json
{
  "session_id": 31288,
  "chars": "",
  "yield_time_ms": 60000,
  "max_output_tokens": 50000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:58:19.624Z","phase":null} -->
## Tool result: call_I3dyQ1oRny2KZtYvUVlH0DAR · 2026-06-14T15:58:19.624Z

```text
Chunk ID: 0f86cd
Wall time: 51.6563 seconds
Process exited with code 0
Original token count: 1426
Output:
I've grounded the review in the actual code. Key facts I verified:

- `requestJson` is a free function in `src/lib/app-errors.ts`, called directly with relative `/api/...` URLs in **~54 sites across 13 files**.
- `runtimeApis.*` (the `RuntimeAPIs` provider) is consumed **0 times** inside `src/app` and `src/components`. The provider is only touched at boot (`render-web.tsx` → `runtimeApis.bootstrap.load`). `HomeApp` never calls `useRuntimeApis`.
- SSE is one direct `new EventSource("/api/events…")` in `LiveEventConnectionManager` with a relative URL builder.

That context sharpens the findings below.

---

## 1. Verdict: **HARDEN** (close — these are clarifications/sequencing, not a redesign)

The plan is comprehensive and the prior review's gaps (CORS/auth, EventSource credentials, null bootstrap, durable installation id, generation fencing, diagnostics, phase gates) are genuinely addressed. But four issues will either misdirect implementer effort or leave an executor stuck. Fix these and it's READY.

## 2. Highest-impact remaining findings

**A. The injection-point narrative is misaligned with how Home actually issues requests.** The plan repeatedly centers `src/runtime-api/web.ts` ("delegates web-selected-server calls to the transport," and three `runtime-api/*` files in the modify list). But Home never goes through `RuntimeAPIs` — it calls `requestJson("/api/…")` directly (~54 sites) and constructs `EventSource` directly. The real injection points are exactly three: (1) the `requestJson` wrapper, (2) `LiveEventConnectionManager`'s `EventSource`/URL builder, (3) the boot-time `bootstrap.load`. 
*Fix:* State plainly that `runtime-client.ts` wraps `requestJson` from `@/lib/app-errors` and the SSE URL builder; scope `runtime-api/web.ts` changes to the bootstrap/events boot path only (and `EventSource withCredentials`). Drop the implication that 54 home call sites route through `web.ts` — they don't, and an implementer chasing that will waste a phase.

**B. The mechanism for delivering the per-server transport to call sites is unspecified — the single biggest execution risk.** "Migrate call sites to the selected-server transport" doesn't say *how* each site obtains the `serverRef`+generation. Several owners are plain classes, not React (`WorkerEntriesManager`, `LiveEventConnectionManager`, `ConversationNotificationManager`, `GitWorkspaceManager`), so a `useSelectedRuntimeClient()` hook can't reach them. 
*Fix:* Pin the wiring: `ServerDirectoryManager` owns the active `RuntimeServerRef`; non-React managers receive the transport via constructor/setter and are re-pointed on selection change; React hooks read it via a narrow selector/context. Without this the migration phase has no defined seam.

**C. Phase 2 tests generation fencing before Phase 4 creates the generation owner.** Phase 2's verification includes "stale generation rejection," but `ServerDirectoryManager` (which mints `serverToken`/generation) isn't built until Phase 4. As written, Phase 2 either blocks on Phase 4 or builds an untestable transport. 
*Fix:* Make Phase 2 define the `RuntimeServerRef`/generation contract with a trivial injected provider (local-server default, generation=1) so the transport is fully testable standalone; Phase 4 swaps in the real manager. Call out this dependency explicitly.

**D. Cross-origin authenticated access to plain-HTTP LAN servers is browser-impossible — but the First User and milestone imply it.** The PM Pass names "a second machine on LAN" and the milestone requires "allowed-origin standalone access works against an authenticated protected server." An HTTPS standalone UI cannot send credentialed requests to `http://192.168.x.x` (mixed content), and `SameSite=None` *requires* `Secure` (HTTPS). So credentialed cross-origin works only for HTTPS/tunneled targets. 
*Fix:* State explicitly that authenticated cross-origin is limited to HTTPS origins; plain-HTTP LAN servers are reachable only when unlocked or same-origin. Otherwise an implementer chases an unachievable case and the acceptance criterion in §"Remote Access Policy" reads as a promise the browser won't keep.

**E. (Lower) SSR/localStorage hydration mismatch for the server selector.** Served-local mode SSRs from the bootstrap descriptor, but the directory lives in `localStorage` (client-only). First client paint of `ServerSelector`/directory state risks a React hydration mismatch. 
*Fix:* Render server-known-from-bootstrap on first paint and reconcile `localStorage` post-mount (mounted flag), and say so in the null-bootstrap/Phase 4 task.

Minor: required diagnostics records omit an incompatible/version-mismatch record and a `server.removed` record; the worker endpoint string `/api/workers/:workerId/entries` should be reconciled with the existing `listEntries({runId, workerId, afterSeq})` shape (confirm whether `runId` is path or query) — the audit will catch it, but name it.

## 3. What I'd deliberately leave alone

- The descriptor schema + durable `installationId` + the no-guess merge rule — well-specified, don't expand.
- Deferring the token/session bridge to a future explicit feature — correct call; don't pull it forward.
- The two-subprocess lifecycle harness as the authority for isolation (over the in-process harness) — right boundary.
- Manager-owned state, named-events-only for server decisions, i18n-through-`t()` discipline, and the "real servers only, no mocks" standard — all sound; no changes.
- The serverId-keyed query/cache/worker model and mutation-ownership token design — solid as written.

Net: tighten A–D (mostly prose + one sequencing note), add the hydration guard, and this is ready to execute.

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:58:23.458Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:58:23.458Z

Baton’s second pass says the plan is close but still `HARDEN`. The remaining issues are mostly wiring/wording: how transports reach non-React managers, phase ordering for generation tests, HTTPS-only cross-origin auth limits, and first-paint hydration. I’m patching those directly.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:58:48.823Z","phase":null} -->
## Tool call: apply_patch · 2026-06-14T15:58:48.823Z

```json
*** Begin Patch
*** Update File: docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md
@@
-**Architecture:** Add one selected-server transport beneath the existing renderer: it wraps `requestJson`, raw `fetch`, and SSE URL construction with `serverId + generation` ownership, then the current `src/runtime-api/*` adapters delegate to it where they need selected-server behavior. The current local Next/runtime server remains a valid target, but the renderer stops assuming every API request, SSE stream, worker-entry fetch, cache record, and auth query belongs to `window.location.origin`; all runtime-owned state is keyed by a stable server identity plus the existing run/worker/session cursors.
+**Architecture:** Add one selected-server transport beneath the existing Home renderer: it wraps `requestJson`, raw `fetch`, and SSE URL construction with `serverId + generation` ownership. The current `src/runtime-api/*` adapters remain the boot/shell capability layer and are changed only where bootstrap or event-source construction needs the same selected-server behavior. The current local Next/runtime server remains a valid target, but the renderer stops assuming every API request, SSE stream, worker-entry fetch, cache record, and auth query belongs to `window.location.origin`; all runtime-owned state is keyed by a stable server identity plus the existing run/worker/session cursors.
@@
-- Do not create competing runtime API abstractions. The selected-server transport is the single low-level injection point for Home app HTTP/SSE work; `src/runtime-api/types.ts`, `src/runtime-api/web.ts`, `src/runtime-api/electron.ts`, `src/runtime-api/vscode.ts`, and `src/runtime-api/provider.tsx` either delegate to it or remain shell adapters.
+- Do not create competing runtime API abstractions. The selected-server transport is the single low-level injection point for Home app HTTP/SSE work; `src/runtime-api/types.ts`, `src/runtime-api/web.ts`, `src/runtime-api/electron.ts`, `src/runtime-api/vscode.ts`, and `src/runtime-api/provider.tsx` remain boot/shell adapters and delegate only where they actually issue bootstrap or event-stream requests.
@@
 - Cross-origin access is a product feature, not just a frontend URL change. Remote servers must explicitly allow configured standalone UI origins, credentials, preflight requests, and SSE connection rules before the standalone client can treat them as usable.
+- Authenticated cross-origin access is limited to HTTPS target origins. Plain-HTTP LAN servers can be used only when unlocked or same-origin because browsers block mixed content from HTTPS standalone UIs and `SameSite=None` cookies require `Secure`.
@@
-- The renderer has a boot path where `initialEventState`, `initialQueries.session`, and `initialQueries.settings` are absent because no server is selected yet.
+- The renderer has a boot path where `initialEventState`, `initialQueries.session`, and `initialQueries.settings` are absent because no server is selected yet.
+- Served-local mode renders the bootstrap descriptor for first paint, then reconciles localStorage after mount so the server selector does not create hydration mismatches.
@@
 - Required records: `server.selected`, `server.probe.started`, `server.probe.failed`, `server.auth.required`, `server.connection.offline`, `server.connection.restored`, and `server.cache.cleared`.
+- Also record `server.incompatible` for version/capability failures and `server.removed` when a local directory entry is forgotten.
@@
-Use `src/app/home/runtime-client.ts` as the selected-server transport. It is not a second product API; it is the single low-level implementation used by Home app call sites and, where applicable, by `src/runtime-api/web.ts`:
+Use `src/app/home/runtime-client.ts` as the selected-server transport. It is not a second product API; it is the single low-level implementation used by Home app call sites:
@@
 - `requestJson` and raw `fetch` call sites in Home/runtime UI code migrate to the selected-server transport unless the audit classifies them as local-shell-only.
 - `LiveEventConnectionManager` receives the selected-server transport, not a bare URL builder.
-- `src/runtime-api/web.ts` gains `EventSource` credentials support and delegates web-selected-server calls to the transport where Home app behavior needs selected-server ownership. Electron and VS Code adapters remain shell adapters for this milestone.
+- `src/runtime-api/web.ts` changes are limited to boot-time `bootstrap.load`, event-source option support, and compatibility with shared descriptor types. The Home app does not currently consume `RuntimeAPIs` for its main request surface, so implementation must not rely on `web.ts` as the migration path for Home call sites.
 - Local-only shell endpoints may remain relative only after a call-site audit classifies them as local-shell-only.
 - Direct calls to hardcoded `"/api/..."` from app-state code that depends on the selected server are forbidden after this migration.
+
+### Transport Wiring
+
+The selected-server transport reaches code through two paths:
+
+- React hooks and components read the current `RuntimeServerRef` through a narrow selector/context backed by `ServerDirectoryManager`.
+- Non-React managers receive a transport provider through constructor options or explicit setters, and are re-pointed on server selection changes. This applies to `WorkerEntriesManager`, `LiveEventConnectionManager`, `ConversationNotificationManager`, `GitWorkspaceManager`, `ProjectMemoryPanelManager`, and any other manager found by the audit.
+
+Phase 2 defines and tests the `RuntimeServerRef` contract with an injected local default (`serverId = "local"`, current origin, `generation = 1`) so the transport can be tested before the full server directory UI exists. Phase 4 replaces that default provider with `ServerDirectoryManager`.
@@
 - SSE support with credentials. Native `EventSource` does not support arbitrary headers and only supports cookies when constructed with `{ withCredentials: true }`; the runtime API adapter must account for this.
 - Cookie strategy must be explicit. Current auth cookies are `SameSite=Lax`, which is not enough for true cross-site standalone access. The implementation must either add a secure cross-site cookie mode for explicitly allowed HTTPS origins (`SameSite=None; Secure`) or design an explicit token/session bridge for standalone clients.
+- Authenticated cross-origin standalone access is supported only for HTTPS targets. Plain `http://` LAN targets may be added and probed, but protected sessions on those targets must surface a clear unsupported-auth transport state unless the UI is same-origin.
 - Existing same-origin CSRF checks in auth routes must be revisited so cross-origin login is accepted only from configured standalone UI origins and still rejected from arbitrary sites.
*** End Patch

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:58:48.850Z","phase":null} -->
## Tool result: call_Q7N23rw7MW5CF0R8jyZcHDJQ · 2026-06-14T15:58:48.850Z

```text
apply_patch verification failed: Failed to find expected lines in /Users/masterman/NLP/omniharness/docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md:
- Required records: `server.selected`, `server.probe.started`, `server.probe.failed`, `server.auth.required`, `server.connection.offline`, `server.connection.restored`, and `server.cache.cleared`.
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:58:58.408Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:58:58.408Z

One patch hunk missed the exact diagnostics wording, so I’m applying the remaining changes in smaller chunks.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:58:58.432Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:58:58.432Z

```json
{
  "cmd": "rg -n \"Architecture:|Do not create competing|Cross-origin access|The renderer has a boot path|Required records|Runtime API|Use `src/app/home/runtime-client|requestJson|Remote Access Policy|Cookie strategy|Existing same-origin\" docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:58:58.433Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:58:58.433Z

```json
{
  "cmd": "sed -n '80,95p' docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 8000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:58:58.449Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:58:58.449Z

```json
{
  "cmd": "sed -n '210,255p' docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:58:58.480Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:58:58.480Z

```json
{
  "cmd": "sed -n '255,275p' docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 8000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:58:58.562Z","phase":null} -->
## Tool result: call_1QXTvzcrqZGFZ21Z1Vf3dJZa · 2026-06-14T15:58:58.562Z

```text
Chunk ID: c06efa
Wall time: 0.0000 seconds
Process exited with code 1
Original token count: 5
Output:
zsh:1: unmatched "

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:58:58.562Z","phase":null} -->
## Tool result: call_CcyFWWDWsHwjYQkYi9OnajKe · 2026-06-14T15:58:58.562Z

```text
Chunk ID: 573cf0
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 382
Output:
- Version/capability mismatch must be explicit and recoverable.
- Hot-path active-server bootstrap must not synchronously probe every known server; background health checks are bounded and staggered.

**Instrumentation And Observability:**

- The local interface emits client-side diagnostics through existing frontend error surfaces with `serverId`, `origin`, `source`, and `action`.
- Server-side decisions remain owned by each target OmniHarness server and observed through its named event stream. The interface must not infer server decisions by diffing snapshots.
- Model client-side lifecycle diagnostics in `ServerDirectoryManager` as bounded recent records and render the latest relevant records through the existing frontend error/status surfaces. Required records: `server.selected`, `server.probe.started`, `server.probe.failed`, `server.auth.required`, `server.connection.offline`, `server.connection.restored`, and `server.cache.cleared`.
- Keep `/api/events/log?since=<id>&runId=<id>` scoped to the selected target server through the runtime client.

**Onboarding And Discoverability:**

- Existing local app behavior stays the default when the UI is served by an OmniHarness server.
- Standalone mode shows a compact server selector in the header and an empty state that lets the user add a server URL.
- Adding a server validates the URL and shows reachability/auth/version state before selection.
- Server settings live in a dense settings/control surface with compact rows and no redundant explanatory chrome.

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:58:58.562Z","phase":null} -->
## Tool result: call_nelPR1BxLvrNpNIxOE7sZ2ui · 2026-06-14T15:58:58.562Z

````text
Chunk ID: 6838a4
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 764
Output:
- If a tunnel URL points to the same `installationId` as another remembered origin, the directory links both origins to the same server record and updates the preferred origin only through explicit user action. Without `installationId`, the UI may warn about matching display/version but must not merge records by guesswork.
- Missing required capabilities produce `incompatible` status with a precise list of missing capabilities.
- Descriptor version mismatch is recoverable: the user can keep the server record, retry after upgrade, or remove the local record.
- Tests must cover same origin, duplicate origin, changed display name, tunnel origin with same installation id, legacy server without installation id, missing capability, and unsupported descriptor version.

### Selected-Server Transport Boundary

Use `src/app/home/runtime-client.ts` as the selected-server transport. It is not a second product API; it is the single low-level implementation used by Home app call sites and, where applicable, by `src/runtime-api/web.ts`:

```ts
type RuntimeServerRef = {
  serverId: string;
  origin: string;
  generation: number;
};

type SelectedRuntimeTransport = {
  server: RuntimeServerRef;
  buildUrl(path: string): string;
  requestJson<T>(path: string, init: RequestInit | undefined, fallback: AppErrorDescriptor): Promise<T>;
  fetch(path: string, init?: RequestInit): Promise<Response>;
  openEvents(args: { runId?: string | null; lastEventId?: string | null }, handlers: EventStreamHandlers): RuntimeSubscription;
  fetchSnapshot(args: { runId?: string | null; checksum?: string | null }): Promise<SnapshotPollResult>;
};
```

The exact shape can change during implementation, but the boundary must preserve these ownership rules:

- `requestJson` and raw `fetch` call sites in Home/runtime UI code migrate to the selected-server transport unless the audit classifies them as local-shell-only.
- `LiveEventConnectionManager` receives the selected-server transport, not a bare URL builder.
- `src/runtime-api/web.ts` gains `EventSource` credentials support and delegates web-selected-server calls to the transport where Home app behavior needs selected-server ownership. Electron and VS Code adapters remain shell adapters for this milestone.
- Local-only shell endpoints may remain relative only after a call-site audit classifies them as local-shell-only.
- Direct calls to hardcoded `"/api/..."` from app-state code that depends on the selected server are forbidden after this migration.

### Bootstrap Model

Extend `HomeBootstrapPayload` with a runtime descriptor for the server that served the page:

- `serverId`,
- `origin`,
- `displayName`,
- `runtimeVersion`,
- `capabilities`,
- `standaloneInterfaceSupported`.

When the page is served by an OmniHarness runtime, the interface auto-registers this origin as the local/current server and hydrates initial event/settings/session data under that `serverId`. When the page is served as a static/standalone interface, it starts without an initial runtime payload and prompts for a server.

````

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:58:58.562Z","phase":null} -->
## Tool result: call_wIwTsvm4T1CUnys9BbcXJd4K · 2026-06-14T15:58:58.562Z

```text
Chunk ID: 1750f1
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 566
Output:
When the page is served by an OmniHarness runtime, the interface auto-registers this origin as the local/current server and hydrates initial event/settings/session data under that `serverId`. When the page is served as a static/standalone interface, it starts without an initial runtime payload and prompts for a server.

### Remote Access Policy

To support a standalone UI hosted on a different origin from a target server, the target OmniHarness server must expose an explicit browser access policy. Add this as a server-side runtime feature, not as an implicit permissive CORS change:

- Configured allowed UI origins, with local defaults for same-origin and explicit development origins only.
- `OPTIONS` preflight handling for runtime routes that accept cross-origin requests.
- `Access-Control-Allow-Origin` echo for allowed origins, never `*` when credentials are used.
- `Access-Control-Allow-Credentials: true` for allowed credentialed requests.
- Allowed methods/headers for JSON runtime calls.
- SSE support with credentials. Native `EventSource` does not support arbitrary headers and only supports cookies when constructed with `{ withCredentials: true }`; the runtime API adapter must account for this.
- Cookie strategy must be explicit. Current auth cookies are `SameSite=Lax`, which is not enough for true cross-site standalone access. The implementation must either add a secure cross-site cookie mode for explicitly allowed HTTPS origins (`SameSite=None; Secure`) or design an explicit token/session bridge for standalone clients.
- Existing same-origin CSRF checks in auth routes must be revisited so cross-origin login is accepted only from configured standalone UI origins and still rejected from arbitrary sites.
- Tests must cover protected server login/session from an allowed origin, disallowed origin rejection, preflight, SSE credentials, and logout/session revocation.

This cross-origin backend work is part of the current milestone. Multi-server same-origin/localhost support may land behind passing tests first, but the milestone is not complete until allowed-origin standalone access works against an authenticated protected server.

### Query And Cache Model

Every TanStack Query key for runtime state must include `serverId`:

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:59:01.692Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:59:01.692Z

I’ve got the exact surrounding text now; applying the final hardening edits.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:59:17.306Z","phase":null} -->
## Tool call: apply_patch · 2026-06-14T15:59:17.306Z

```json
*** Begin Patch
*** Update File: docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md
@@
-**Architecture:** Add one selected-server transport beneath the existing renderer: it wraps `requestJson`, raw `fetch`, and SSE URL construction with `serverId + generation` ownership, then the current `src/runtime-api/*` adapters delegate to it where they need selected-server behavior. The current local Next/runtime server remains a valid target, but the renderer stops assuming every API request, SSE stream, worker-entry fetch, cache record, and auth query belongs to `window.location.origin`; all runtime-owned state is keyed by a stable server identity plus the existing run/worker/session cursors.
+**Architecture:** Add one selected-server transport beneath the existing Home renderer: it wraps `requestJson`, raw `fetch`, and SSE URL construction with `serverId + generation` ownership. The current `src/runtime-api/*` adapters remain the boot/shell capability layer and are changed only where bootstrap or event-source construction needs the same selected-server behavior. The current local Next/runtime server remains a valid target, but the renderer stops assuming every API request, SSE stream, worker-entry fetch, cache record, and auth query belongs to `window.location.origin`; all runtime-owned state is keyed by a stable server identity plus the existing run/worker/session cursors.
@@
-- Do not create competing runtime API abstractions. The selected-server transport is the single low-level injection point for Home app HTTP/SSE work; `src/runtime-api/types.ts`, `src/runtime-api/web.ts`, `src/runtime-api/electron.ts`, `src/runtime-api/vscode.ts`, and `src/runtime-api/provider.tsx` either delegate to it or remain shell adapters.
+- Do not create competing runtime API abstractions. The selected-server transport is the single low-level injection point for Home app HTTP/SSE work; `src/runtime-api/types.ts`, `src/runtime-api/web.ts`, `src/runtime-api/electron.ts`, `src/runtime-api/vscode.ts`, and `src/runtime-api/provider.tsx` remain boot/shell adapters and delegate only where they actually issue bootstrap or event-stream requests.
@@
 - Bootstrap, health, auth-session, settings, event stream, worker entries, and mutation requests must all use bounded timeouts or cancellation through the runtime client.
 - Switching servers cancels or ownership-invalidates in-flight requests and SSE streams from the previous server.
 - Cross-origin access is a product feature, not just a frontend URL change. Remote servers must explicitly allow configured standalone UI origins, credentials, preflight requests, and SSE connection rules before the standalone client can treat them as usable.
+- Authenticated cross-origin access is limited to HTTPS target origins. Plain-HTTP LAN servers can be used only when unlocked or same-origin because browsers block mixed content from HTTPS standalone UIs and `SameSite=None` cookies require `Secure`.
@@
-- Model client-side lifecycle diagnostics in `ServerDirectoryManager` as bounded recent records and render the latest relevant records through the existing frontend error/status surfaces. Required records: `server.selected`, `server.probe.started`, `server.probe.failed`, `server.auth.required`, `server.connection.offline`, `server.connection.restored`, and `server.cache.cleared`.
+- Model client-side lifecycle diagnostics in `ServerDirectoryManager` as bounded recent records and render the latest relevant records through the existing frontend error/status surfaces. Required records: `server.selected`, `server.probe.started`, `server.probe.failed`, `server.auth.required`, `server.connection.offline`, `server.connection.restored`, `server.cache.cleared`, `server.incompatible`, and `server.removed`.
@@
 - `OmniApp` and `HomeApp` accept `HomeBootstrapPayload | null`.
 - The renderer has a boot path where `initialEventState`, `initialQueries.session`, and `initialQueries.settings` are absent because no server is selected yet.
+- Served-local mode renders the bootstrap descriptor for first paint, then reconciles localStorage after mount so the server selector does not create hydration mismatches.
*** End Patch

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:59:17.334Z","phase":null} -->
## Tool result: call_p3BbKXGnduM1hdXBzkYeU988 · 2026-06-14T15:59:17.334Z

```text
Exit code: 0
Wall time: 0 seconds
Output:
Success. Updated the following files:
M docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:59:28.028Z","phase":null} -->
## Tool call: apply_patch · 2026-06-14T15:59:28.028Z

```json
*** Begin Patch
*** Update File: docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md
@@
-Use `src/app/home/runtime-client.ts` as the selected-server transport. It is not a second product API; it is the single low-level implementation used by Home app call sites and, where applicable, by `src/runtime-api/web.ts`:
+Use `src/app/home/runtime-client.ts` as the selected-server transport. It is not a second product API; it is the single low-level implementation used by Home app call sites:
@@
-- `src/runtime-api/web.ts` gains `EventSource` credentials support and delegates web-selected-server calls to the transport where Home app behavior needs selected-server ownership. Electron and VS Code adapters remain shell adapters for this milestone.
+- `src/runtime-api/web.ts` changes are limited to boot-time `bootstrap.load`, event-source option support, and compatibility with shared descriptor types. The Home app does not currently consume `RuntimeAPIs` for its main request surface, so implementation must not rely on `web.ts` as the migration path for Home call sites.
 - Local-only shell endpoints may remain relative only after a call-site audit classifies them as local-shell-only.
 - Direct calls to hardcoded `"/api/..."` from app-state code that depends on the selected server are forbidden after this migration.
+
+### Transport Wiring
+
+The selected-server transport reaches code through two paths:
+
+- React hooks and components read the current `RuntimeServerRef` through a narrow selector/context backed by `ServerDirectoryManager`.
+- Non-React managers receive a transport provider through constructor options or explicit setters, and are re-pointed on server selection changes. This applies to `WorkerEntriesManager`, `LiveEventConnectionManager`, `ConversationNotificationManager`, `GitWorkspaceManager`, `ProjectMemoryPanelManager`, and any other manager found by the audit.
+
+Phase 2 defines and tests the `RuntimeServerRef` contract with an injected local default (`serverId = "local"`, current origin, `generation = 1`) so the transport can be tested before the full server directory UI exists. Phase 4 replaces that default provider with `ServerDirectoryManager`.
*** End Patch

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:59:28.053Z","phase":null} -->
## Tool result: call_3sTPtd8UkuPPYejgzPOttXnr · 2026-06-14T15:59:28.053Z

```text
Exit code: 0
Wall time: 0 seconds
Output:
Success. Updated the following files:
M docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:59:35.365Z","phase":null} -->
## Tool call: apply_patch · 2026-06-14T15:59:35.365Z

```json
*** Begin Patch
*** Update File: docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md
@@
 - Allowed methods/headers for JSON runtime calls.
 - SSE support with credentials. Native `EventSource` does not support arbitrary headers and only supports cookies when constructed with `{ withCredentials: true }`; the runtime API adapter must account for this.
 - Cookie strategy must be explicit. Current auth cookies are `SameSite=Lax`, which is not enough for true cross-site standalone access. The implementation must either add a secure cross-site cookie mode for explicitly allowed HTTPS origins (`SameSite=None; Secure`) or design an explicit token/session bridge for standalone clients.
+- Authenticated cross-origin standalone access is supported only for HTTPS targets. Plain `http://` LAN targets may be added and probed, but protected sessions on those targets must surface a clear unsupported-auth transport state unless the UI is same-origin.
 - Existing same-origin CSRF checks in auth routes must be revisited so cross-origin login is accepted only from configured standalone UI origins and still rejected from arbitrary sites.
*** End Patch

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:59:35.384Z","phase":null} -->
## Tool result: call_Dys9rKCoup13eve5MFwIcJYw · 2026-06-14T15:59:35.384Z

```text
Exit code: 0
Wall time: 0 seconds
Output:
Success. Updated the following files:
M docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T15:59:39.790Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T15:59:39.790Z

The prose now covers the transport wiring and HTTPS constraint. I’m aligning the file map/checklist language so it doesn’t send implementers back through `runtime-api/web.ts` for Home call sites.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:59:52.765Z","phase":null} -->
## Tool call: apply_patch · 2026-06-14T15:59:52.765Z

```json
*** Begin Patch
*** Update File: docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md
@@
 - `src/runtime-api/web.ts`
-  - Add selected-server transport delegation where appropriate and update `EventSource` constructor typing to support `{ withCredentials: true }`.
+  - Keep as the web boot/shell adapter; update bootstrap descriptor typing and `EventSource` constructor typing to support `{ withCredentials: true }`.
@@
 - `src/app/home/WorkerEntriesManager.ts`
-  - Key state, listeners, cache entries, in-flight requests, wake versions, and endpoint builders by `serverId + workerId`.
+  - Key state, listeners, cache entries, in-flight requests, wake versions, and endpoint builders by `serverId + workerId`; preserve the existing `listEntries({ runId, workerId, afterSeq })`/query shape where required by the endpoint.
@@
 - `tests/app/home/runtime-client.test.ts`
-  - URL building, error normalization, auth/offline classification, timeout/cancellation, and ownership-token behavior.
+  - URL building, error normalization, auth/offline/unsupported-transport classification, timeout/cancellation, and ownership-token behavior.
@@
 - `src/runtime-api/types.ts`
-  - Add any selected-server transport, event-source option, or descriptor types that belong in the shared shell contract.
+  - Add event-source option and descriptor types that belong in the shared shell contract.
@@
 - [ ] Phase 2: implement the selected-server transport with TDD.
   - Create `src/app/home/runtime-client.ts` and `src/app/home/server-health.ts`.
-  - Update `src/runtime-api/types.ts`, `src/runtime-api/web.ts`, and `src/runtime-api/provider.tsx` only as needed to delegate to or coexist with the selected-server transport.
+  - Update `src/runtime-api/types.ts`, `src/runtime-api/web.ts`, and `src/runtime-api/provider.tsx` only as needed for bootstrap descriptors and event-source option compatibility; do not route Home call-site migration through `RuntimeAPIs`.
   - Enforce URL normalization, allowed protocols, credentials, timeouts, aborts, error normalization, ownership-token checks, and `EventSource` option support for `{ withCredentials: true }`.
-  - Verification: `pnpm test -- tests/app/home/runtime-client.test.ts` covers request URL building, raw fetch wrapping, credentials mode, timeout/cancellation, auth/offline/incompatible classification, event-source credentials, and stale generation rejection.
+  - Verification: `pnpm test -- tests/app/home/runtime-client.test.ts` covers request URL building, raw fetch wrapping, credentials mode, timeout/cancellation, auth/offline/incompatible/unsupported-transport classification, event-source credentials, and stale generation rejection using an injected local default `RuntimeServerRef`.
@@
 - [ ] Phase 4: implement null-bootstrap standalone entry behavior.
   - Modify `src/ui/OmniApp.tsx`, `src/ui/render-web.tsx`, and `src/app/home/HomeApp.tsx`.
   - Let `HomeApp` render the server-directory empty state when bootstrap is null and no server is selected.
+  - Render bootstrap descriptor data on first paint in served-local mode, then reconcile server-directory localStorage after mount to avoid hydration mismatch.
*** End Patch

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T15:59:52.793Z","phase":null} -->
## Tool result: call_VhmcWBvmslS3ViSnKzTHRH4g · 2026-06-14T15:59:52.793Z

```text
apply_patch verification failed: Failed to find expected lines in /Users/masterman/NLP/omniharness/docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md:
- `tests/app/home/runtime-client.test.ts`
  - URL building, error normalization, auth/offline classification, timeout/cancellation, and ownership-token behavior.
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T15:59:59.956Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T15:59:59.956Z

```json
{
  "cmd": "rg -n \"src/runtime-api/web.ts|WorkerEntriesManager|runtime-client.test|src/runtime-api/types.ts|Phase 2: implement|Phase 4: implement null\" docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 10000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:00:00.019Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:00:00.019Z

```json
{
  "cmd": "sed -n '390,430p' docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 10000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:00:00.090Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:00:00.090Z

```json
{
  "cmd": "sed -n '548,595p' docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:00:00.107Z","phase":null} -->
## Tool result: call_JtMHh1Wx4hw92aIJRzQhFnlE · 2026-06-14T16:00:00.107Z

```text
Chunk ID: 16e092
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 687
Output:
27:- Do not replace the unified worker conversation stream. Worker content remains fetched through the target server's `/api/workers/:workerId/entries` endpoint and rendered through `WorkerEntriesManager`/`Terminal`.
29:- Do not create competing runtime API abstractions. The selected-server transport is the single low-level injection point for Home app HTTP/SSE work; `src/runtime-api/types.ts`, `src/runtime-api/web.ts`, `src/runtime-api/electron.ts`, `src/runtime-api/vscode.ts`, and `src/runtime-api/provider.tsx` remain boot/shell adapters and delegate only where they actually issue bootstrap or event-stream requests.
242:- `src/runtime-api/web.ts` changes are limited to boot-time `bootstrap.load`, event-source option support, and compatibility with shared descriptor types. The Home app does not currently consume `RuntimeAPIs` for its main request surface, so implementation must not rely on `web.ts` as the migration path for Home call sites.
251:- Non-React managers receive a transport provider through constructor options or explicit setters, and are re-pointed on server selection changes. This applies to `WorkerEntriesManager`, `LiveEventConnectionManager`, `ConversationNotificationManager`, `GitWorkspaceManager`, `ProjectMemoryPanelManager`, and any other manager found by the audit.
306:`WorkerEntriesManager` keys state by `{ serverId, workerId }`, not by `workerId` alone. SSE `worker.entry_appended` remains a wake-up hint; the manager fetches entry bodies from the selected server's `/api/workers/:workerId/entries` endpoint. A global ring-buffer resync on one server must not clear worker streams for another server.
408:- `tests/app/home/runtime-client.test.ts`
427:- `src/runtime-api/types.ts`
429:- `src/runtime-api/web.ts`
459:- `src/app/home/WorkerEntriesManager.ts`
498:- Unit tests for `WorkerEntriesManager` proving same `workerId` on two servers has independent entries, in-flight requests, cache, and wake-up behavior.
551:- [ ] Phase 2: implement the selected-server transport with TDD.
553:  - Update `src/runtime-api/types.ts`, `src/runtime-api/web.ts`, and `src/runtime-api/provider.tsx` only as needed to delegate to or coexist with the selected-server transport.
555:  - Verification: `pnpm test -- tests/app/home/runtime-client.test.ts` covers request URL building, raw fetch wrapping, credentials mode, timeout/cancellation, auth/offline/incompatible classification, event-source credentials, and stale generation rejection.
568:  - Modify `src/app/home/WorkerEntriesManager.ts`.
592:- [ ] Phase 4: implement null-bootstrap standalone entry behavior.
635:  - `pnpm test -- tests/app/home/ServerDirectoryManager.test.ts tests/app/home/runtime-client.test.ts tests/app/home/multi-server-cache.test.ts`

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:00:00.107Z","phase":null} -->
## Tool result: call_wiOaVTvndgeBrQd6M7K80wZA · 2026-06-14T16:00:00.107Z

```text
Chunk ID: 46d286
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 740
Output:
- `src/app/home/server-directory-storage.ts`
  - Versioned serialization, migration, origin normalization, pruning, and local removal helpers for server directory records.
- `src/app/home/server-health.ts`
  - Probe logic for runtime bootstrap/session capability checks with bounded timeouts and typed outcomes.
- `src/server/installation-id.ts`
  - Durable runtime installation id creation/read helper used by bootstrap descriptors.
- `src/runtime/http/cors.ts`
  - Allowed standalone UI origin parsing, CORS/preflight response helpers, credential policy, and route wrapper utilities.
- `tests/runtime/cors-auth.test.ts`
  - Cross-origin protected-server auth, preflight, cookie/session, and disallowed-origin coverage.
- `src/components/home/ServerSelector.tsx`
  - Header/mobile server selector, status menu, switch/retry/edit/remove entry points, all strings through i18n.
- `src/components/settings/ServersSettingsPanel.tsx`
  - Dense settings panel for remembered servers and add/edit/remove controls.
- `src/components/home/ServerConnectionDialog.tsx`
  - Add/edit server dialog with URL normalization, validation, probe result, auth/incompatible/offline messaging, and save/select actions.
- `tests/app/home/ServerDirectoryManager.test.ts`
  - Directory persistence, selection generation, remove semantics, migration, and status transitions.
- `tests/app/home/runtime-client.test.ts`
  - URL building, error normalization, auth/offline classification, timeout/cancellation, and ownership-token behavior.
- `tests/app/home/multi-server-cache.test.ts`
  - Snapshot/worker cache scoping by `serverId`, stale SSE generation fencing, stale mutation side effects, and corrupt localStorage recovery.
- `tests/lifecycle/scenarios/multi-server-interface.test.ts`
  - Headless two-server scenario proving selected-server bootstrap, event logs, worker entries, auth/offline behavior, and cleanup.
- `docs/architecture/multi-server-standalone-interface.md`
  - Architecture doc covering server directory ownership, runtime-client contracts, cache keys, auth boundary, and test rules.

### Files To Modify

- `src/runtime/bootstrap.ts`
  - Add runtime/server descriptor fields to `HomeBootstrapPayload`, including durable `installationId`.
- `src/app/home/bootstrap.server.ts`
  - Preserve existing Next bootstrap while passing descriptor data through.
- `src/ui/OmniApp.tsx`
  - Accept `HomeBootstrapPayload | null` and keep `RuntimeApiProvider` available for served and standalone entry modes.
- `src/ui/render-web.tsx`
  - Support standalone null-bootstrap mounting when no server is selected or `/api/runtime/bootstrap` is unavailable.
- `src/runtime-api/types.ts`
  - Add any selected-server transport, event-source option, or descriptor types that belong in the shared shell contract.
- `src/runtime-api/web.ts`
  - Add selected-server transport delegation where appropriate and update `EventSource` constructor typing to support `{ withCredentials: true }`.

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:00:00.135Z","phase":null} -->
## Tool result: call_inWpZZUrdoqk28gWvC2kcWak · 2026-06-14T16:00:00.135Z

```text
Chunk ID: 88ce2f
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1191
Output:
  - Run focused bootstrap/session/settings/event snapshot tests.
  - Verification: the served local app still loads without creating or selecting any extra server record manually.

- [ ] Phase 2: implement the selected-server transport with TDD.
  - Create `src/app/home/runtime-client.ts` and `src/app/home/server-health.ts`.
  - Update `src/runtime-api/types.ts`, `src/runtime-api/web.ts`, and `src/runtime-api/provider.tsx` only as needed to delegate to or coexist with the selected-server transport.
  - Enforce URL normalization, allowed protocols, credentials, timeouts, aborts, error normalization, ownership-token checks, and `EventSource` option support for `{ withCredentials: true }`.
  - Verification: `pnpm test -- tests/app/home/runtime-client.test.ts` covers request URL building, raw fetch wrapping, credentials mode, timeout/cancellation, auth/offline/incompatible classification, event-source credentials, and stale generation rejection.

- [ ] Phase 2: migrate audited runtime call sites to the selected-server transport.
  - Migrate `useHomeQueries`, `useHomeMutations`, `useQueuedMessageMutations`, `useConversationActions`, file viewer/pickers, attachments, notifications, project memory, git workspace, external sessions, model auth status, prewarm, pairing, events/log, and worker entries according to the audit table.
  - Leave only audited `local-shell-only` relative calls behind, with comments or helper names that make their ownership clear.
  - Verification: rerun the audit command and confirm all runtime-targeted browser calls use the selected-server transport.

- [ ] Phase 3: scope event snapshot cache by server while defaulting to the local server.
  - Modify `src/app/home/EventStreamSnapshotCacheManager.ts` and `src/app/home/EventStreamStateManager.ts`.
  - Preserve server-authoritative bootstrap behavior and existing scoped completeness merges.
  - Verification: cache tests prove no cross-server hydration, corrupt localStorage recovery, and no demotion of `snapshotSource: "server"`.

- [ ] Phase 3: scope worker entry state and cache by server.
  - Modify `src/app/home/WorkerEntriesManager.ts`.
  - Keep the contiguous-prefix invariant, wake-up semantics, bounded cache, and `?afterSeq=`/tail/backfill flows.
  - Verification: worker manager tests prove same `workerId` on two servers stays isolated and stale fetches cannot mutate the active server stream.

- [ ] Phase 3: route live event connections through the selected-server transport.
  - Modify `src/app/home/LiveEventConnectionManager.ts` and `src/app/home/useHomeLifecycle.ts`.
  - Carry `serverId + generation`, per-server `lastEventId`, snapshot anchor headers, fallback polling, resync behavior, and stale SSE generation fencing.
  - Verification: unit tests for URL construction/ownership plus lifecycle SSE scenario for reconnect/resync and stale-generation event drops.

- [ ] Phase 3: make query keys and bootstrap hydration server-aware.
  - Modify `src/app/home/HomeApp.tsx`, `src/app/home/useHomeQueries.ts`, and related extracted helpers.
  - Prime TanStack Query under `serverId` keys and clear or ignore previous-server queries on selection change without globally discarding useful caches.
  - Verification: tests or focused assertions prove `auth-session`, `settings`, `worker-catalog`, and `project-files` cannot be read across servers.

- [ ] Phase 3: make mutations server-aware and stale-safe.
  - Modify `src/app/home/useHomeMutations.ts`, `src/app/home/useQueuedMessageMutations.ts`, and supporting action helpers.
  - At mutation start, capture `serverId`, generation, selected run, composer draft, and attachments identity. On success/error, mutate UI only if ownership still matches.
  - Verification: stale mutation tests for create, send, stop, delete/archive, settings save, queued-message actions, composer clearing, attachment clearing, and navigation side effects.

- [ ] Phase 4: implement server directory storage and manager with TDD.
  - Create `src/app/home/server-directory-storage.ts` and `src/app/home/ServerDirectoryManager.ts`.
  - Cover add, update, remove, select, generation increment, last selected server, migration, malformed JSON recovery, invalid records, bootstrap auto-registration, installation-id duplicate handling, and bounded diagnostics records.
  - Verification: `pnpm test -- tests/app/home/ServerDirectoryManager.test.ts`.

- [ ] Phase 4: implement null-bootstrap standalone entry behavior.
  - Modify `src/ui/OmniApp.tsx`, `src/ui/render-web.tsx`, and `src/app/home/HomeApp.tsx`.
  - Let `HomeApp` render the server-directory empty state when bootstrap is null and no server is selected.
  - Verify selected run params, project params, and pair-token params do not crash before a server exists.

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:00:02.994Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:00:02.994Z

There were a few stale file-map lines. I’m updating those exact entries now.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:00:09.113Z","phase":null} -->
## Tool call: apply_patch · 2026-06-14T16:00:09.113Z

```json
*** Begin Patch
*** Update File: docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md
@@
 - `tests/app/home/runtime-client.test.ts`
-  - URL building, error normalization, auth/offline classification, timeout/cancellation, and ownership-token behavior.
+  - URL building, error normalization, auth/offline/unsupported-transport classification, timeout/cancellation, and ownership-token behavior.
@@
 - `src/runtime-api/types.ts`
-  - Add any selected-server transport, event-source option, or descriptor types that belong in the shared shell contract.
+  - Add event-source option and descriptor types that belong in the shared shell contract.
 - `src/runtime-api/web.ts`
-  - Add selected-server transport delegation where appropriate and update `EventSource` constructor typing to support `{ withCredentials: true }`.
+  - Keep as the web boot/shell adapter; update bootstrap descriptor typing and `EventSource` constructor typing to support `{ withCredentials: true }`.
@@
 - `src/app/home/WorkerEntriesManager.ts`
-  - Key state, listeners, cache entries, in-flight requests, wake versions, and endpoint builders by `serverId + workerId`.
+  - Key state, listeners, cache entries, in-flight requests, wake versions, and endpoint builders by `serverId + workerId`; preserve the existing `listEntries({ runId, workerId, afterSeq })`/query shape where required by the endpoint.
*** End Patch

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:00:09.138Z","phase":null} -->
## Tool result: call_36nu7occWGlRo3IW3AMWrrTa · 2026-06-14T16:00:09.138Z

```text
Exit code: 0
Wall time: 0 seconds
Output:
Success. Updated the following files:
M docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:00:11.947Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:00:11.947Z

Now I’m patching the Phase 2 and null-bootstrap verification language to match the final wiring model.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:00:20.277Z","phase":null} -->
## Tool call: apply_patch · 2026-06-14T16:00:20.277Z

```json
*** Begin Patch
*** Update File: docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md
@@
 - [ ] Phase 2: implement the selected-server transport with TDD.
   - Create `src/app/home/runtime-client.ts` and `src/app/home/server-health.ts`.
-  - Update `src/runtime-api/types.ts`, `src/runtime-api/web.ts`, and `src/runtime-api/provider.tsx` only as needed to delegate to or coexist with the selected-server transport.
+  - Update `src/runtime-api/types.ts`, `src/runtime-api/web.ts`, and `src/runtime-api/provider.tsx` only as needed for bootstrap descriptors and event-source option compatibility; do not route Home call-site migration through `RuntimeAPIs`.
   - Enforce URL normalization, allowed protocols, credentials, timeouts, aborts, error normalization, ownership-token checks, and `EventSource` option support for `{ withCredentials: true }`.
-  - Verification: `pnpm test -- tests/app/home/runtime-client.test.ts` covers request URL building, raw fetch wrapping, credentials mode, timeout/cancellation, auth/offline/incompatible classification, event-source credentials, and stale generation rejection.
+  - Verification: `pnpm test -- tests/app/home/runtime-client.test.ts` covers request URL building, raw fetch wrapping, credentials mode, timeout/cancellation, auth/offline/incompatible/unsupported-transport classification, event-source credentials, and stale generation rejection using an injected local default `RuntimeServerRef`.
@@
 - [ ] Phase 4: implement null-bootstrap standalone entry behavior.
   - Modify `src/ui/OmniApp.tsx`, `src/ui/render-web.tsx`, and `src/app/home/HomeApp.tsx`.
   - Let `HomeApp` render the server-directory empty state when bootstrap is null and no server is selected.
+  - Render bootstrap descriptor data on first paint in served-local mode, then reconcile server-directory localStorage after mount to avoid hydration mismatch.
   - Verify selected run params, project params, and pair-token params do not crash before a server exists.
*** End Patch

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:00:20.304Z","phase":null} -->
## Tool result: call_sl88KnoNb6tTD6cEN7FvbUoJ · 2026-06-14T16:00:20.304Z

```text
Exit code: 0
Wall time: 0 seconds
Output:
Success. Updated the following files:
M docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:00:33.464Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:00:33.464Z

The plan now reflects Baton’s second-pass findings. I’m doing one quick text scan, then I’ll rerun Baton once more for the required post-revision check.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:00:33.492Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:00:33.492Z

```json
{
  "cmd": "rg -n \"delegate|RuntimeAPIs|if needed|future durable|future token|unsupported-transport|hydration|SameSite|withCredentials|generation=1|server.incompatible|server.removed\" docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 16000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:00:33.582Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:00:33.582Z

```json
{
  "cmd": "git diff -- docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:00:33.611Z","phase":null} -->
## Tool result: call_6BhAHF00PDGHOvCiE3jFL5U8 · 2026-06-14T16:00:33.611Z

```text
Chunk ID: c3d9c1
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1026
Output:
29:- Do not create competing runtime API abstractions. The selected-server transport is the single low-level injection point for Home app HTTP/SSE work; `src/runtime-api/types.ts`, `src/runtime-api/web.ts`, `src/runtime-api/electron.ts`, `src/runtime-api/vscode.ts`, and `src/runtime-api/provider.tsx` remain boot/shell adapters and delegate only where they actually issue bootstrap or event-stream requests.
70:- Server credentials are not persisted by the directory. Existing cookie/session auth remains server-owned by browser origin. If a future token-based remote adapter is introduced, it must be designed as a separate explicit secret-storage feature.
79:- Authenticated cross-origin access is limited to HTTPS target origins. Plain-HTTP LAN servers can be used only when unlocked or same-origin because browsers block mixed content from HTTPS standalone UIs and `SameSite=None` cookies require `Secure`.
88:- Model client-side lifecycle diagnostics in `ServerDirectoryManager` as bounded recent records and render the latest relevant records through the existing frontend error/status surfaces. Required records: `server.selected`, `server.probe.started`, `server.probe.failed`, `server.auth.required`, `server.connection.offline`, `server.connection.restored`, `server.cache.cleared`, `server.incompatible`, and `server.removed`.
158:- Served-local mode renders the bootstrap descriptor for first paint, then reconciles localStorage after mount so the server selector does not create hydration mismatches.
242:- `src/runtime-api/web.ts` changes are limited to boot-time `bootstrap.load`, event-source option support, and compatibility with shared descriptor types. The Home app does not currently consume `RuntimeAPIs` for its main request surface, so implementation must not rely on `web.ts` as the migration path for Home call sites.
277:- SSE support with credentials. Native `EventSource` does not support arbitrary headers and only supports cookies when constructed with `{ withCredentials: true }`; the runtime API adapter must account for this.
278:- Cookie strategy must be explicit. Current auth cookies are `SameSite=Lax`, which is not enough for true cross-site standalone access. The implementation must either add a secure cross-site cookie mode for explicitly allowed HTTPS origins (`SameSite=None; Secure`) or design an explicit token/session bridge for standalone clients.
361:- `runtime-targeted`: must go through `RuntimeAPIs`/selected-server transport and include `serverId` in cache/ownership.
409:  - URL building, error normalization, auth/offline/unsupported-transport classification, timeout/cancellation, and ownership-token behavior.
430:  - Keep as the web boot/shell adapter; update bootstrap descriptor typing and `EventSource` constructor typing to support `{ withCredentials: true }`.
456:  - Preserve merge/completeness behavior while scoping cache hydration and authoritative snapshots by `serverId`.
553:  - Update `src/runtime-api/types.ts`, `src/runtime-api/web.ts`, and `src/runtime-api/provider.tsx` only as needed for bootstrap descriptors and event-source option compatibility; do not route Home call-site migration through `RuntimeAPIs`.
554:  - Enforce URL normalization, allowed protocols, credentials, timeouts, aborts, error normalization, ownership-token checks, and `EventSource` option support for `{ withCredentials: true }`.
555:  - Verification: `pnpm test -- tests/app/home/runtime-client.test.ts` covers request URL building, raw fetch wrapping, credentials mode, timeout/cancellation, auth/offline/incompatible/unsupported-transport classification, event-source credentials, and stale generation rejection using an injected local default `RuntimeServerRef`.
565:  - Verification: cache tests prove no cross-server hydration, corrupt localStorage recovery, and no demotion of `snapshotSource: "server"`.
577:- [ ] Phase 3: make query keys and bootstrap hydration server-aware.
595:  - Render bootstrap descriptor data on first paint in served-local mode, then reconcile server-directory localStorage after mount to avoid hydration mismatch.

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:00:33.636Z","phase":null} -->
## Tool result: call_wc7NLfoACas5dv0WJBxNKOxo · 2026-06-14T16:00:33.636Z

```text
Chunk ID: 2caa7e
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 0
Output:

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:00:38.582Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:00:38.582Z

The scan found one remaining audit classification line that still says `RuntimeAPIs/selected-server transport`. I’m making that unambiguous: Home runtime calls go through the selected-server transport.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:00:40.197Z","phase":null} -->
## Tool call: apply_patch · 2026-06-14T16:00:40.197Z

```json
*** Begin Patch
*** Update File: docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md
@@
-- `runtime-targeted`: must go through `RuntimeAPIs`/selected-server transport and include `serverId` in cache/ownership.
+- `runtime-targeted`: must go through the selected-server transport and include `serverId` in cache/ownership.
*** End Patch

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:00:40.224Z","phase":null} -->
## Tool result: call_eln9prW50aeFKW0lRjAnjEtp · 2026-06-14T16:00:40.224Z

```text
Exit code: 0
Wall time: 0 seconds
Output:
Success. Updated the following files:
M docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:00:45.272Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:00:45.272Z

Rerunning Baton for the final readiness check.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:00:51.079Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:00:51.079Z

```json
{
  "cmd": "PATH=/Users/masterman/.local/bin:$PATH /Users/masterman/.local/bin/baton -p \"You are my second-opinion planning reviewer. Review the twice-revised artifact without editing files. Artifact: /Users/masterman/NLP/omniharness/docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md. User goal: support multiple OmniHarness servers inside the same running app by turning the interface into a standalone thing that can connect to multiple servers. Context and constraints: no branches, no worktrees, no file deletion; preserve unified worker stream; all frontend strings through shared/locales and t(); manager-owned React state; server decisions through named events; lifecycle tests via HTTP/SSE. Prior reviews found issues around RuntimeAPIs vs real Home request injection, transport wiring to non-React managers, Phase 2 generation ownership, cross-origin HTTPS limitations, hydration mismatch, diagnostics records, call-site audit, CORS/auth, EventSource credentials, standalone null bootstrap, durable installation id, and phase gates. These have been revised. Please judge whether this plan is ready to use. Return only: 1. Verdict READY or HARDEN 2. Remaining blocking findings, if any, with concrete fixes 3. Anything you would deliberately leave alone.\"",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 30000,
  "max_output_tokens": 50000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:01:21.256Z","phase":null} -->
## Tool result: call_OGCxNwvtd4buMjyZtl8VMWn8 · 2026-06-14T16:01:21.256Z

```text
Chunk ID: 3c925a
Wall time: 30.0020 seconds
Process running with session ID 68922
Original token count: 0
Output:

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:01:23.885Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:01:23.885Z

Baton is running the final pass.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:01:24.744Z","phase":null} -->
## Tool call: write_stdin · 2026-06-14T16:01:24.744Z

```json
{
  "session_id": 68922,
  "chars": "",
  "yield_time_ms": 30000,
  "max_output_tokens": 50000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:01:54.748Z","phase":null} -->
## Tool result: call_PlzEaFJ3wXUE4GsBEjXRYBQE · 2026-06-14T16:01:54.748Z

```text
Chunk ID: 0b8efc
Wall time: 30.0029 seconds
Process running with session ID 68922
Original token count: 0
Output:

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:01:57.002Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:01:57.002Z

Still waiting on Baton.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:01:57.887Z","phase":null} -->
## Tool call: write_stdin · 2026-06-14T16:01:57.887Z

```json
{
  "session_id": 68922,
  "chars": "",
  "yield_time_ms": 30000,
  "max_output_tokens": 50000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:02:27.891Z","phase":null} -->
## Tool result: call_xHzyOQb392kjtQ8DxuxDB6Hz · 2026-06-14T16:02:27.891Z

```text
Chunk ID: c3a728
Wall time: 30.0028 seconds
Process running with session ID 68922
Original token count: 0
Output:

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:02:33.749Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:02:33.749Z

No output yet; continuing to wait for the final reviewer result.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:02:34.667Z","phase":null} -->
## Tool call: write_stdin · 2026-06-14T16:02:34.667Z

```json
{
  "session_id": 68922,
  "chars": "",
  "yield_time_ms": 60000,
  "max_output_tokens": 50000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:03:34.672Z","phase":null} -->
## Tool result: call_LcwXDg6W0n69ZSPugF8gGIdT · 2026-06-14T16:03:34.672Z

```text
Chunk ID: 5fc4e7
Wall time: 60.0031 seconds
Process running with session ID 68922
Original token count: 0
Output:

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:03:37.496Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:03:37.496Z

Baton has been silent for a bit longer on this pass; I’m keeping it open until it exits so we don’t leave the process behind.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:03:38.323Z","phase":null} -->
## Tool call: write_stdin · 2026-06-14T16:03:38.323Z

```json
{
  "session_id": 68922,
  "chars": "",
  "yield_time_ms": 60000,
  "max_output_tokens": 50000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:04:38.328Z","phase":null} -->
## Tool result: call_KZ1nFFuBmVijOjigSF8gyp24 · 2026-06-14T16:04:38.328Z

```text
Chunk ID: cbf50b
Wall time: 60.0032 seconds
Process running with session ID 68922
Original token count: 0
Output:

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:04:41.986Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:04:41.986Z

Still no output from Baton. If it stays silent after the next poll, I’ll stop waiting and report that the final pass did not return in time, but I’ll first give it one more interval.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:04:42.757Z","phase":null} -->
## Tool call: write_stdin · 2026-06-14T16:04:42.757Z

```json
{
  "session_id": 68922,
  "chars": "",
  "yield_time_ms": 90000,
  "max_output_tokens": 50000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:04:55.880Z","phase":null} -->
## Tool result: call_GZ1aRhe13Y6tOLAIV7yOWBF1 · 2026-06-14T16:04:55.880Z

```text
Chunk ID: bc5d09
Wall time: 13.1203 seconds
Process exited with code 0
Original token count: 1321
Output:
I verified the plan's load-bearing claims against the actual code. The central architectural revisions hold up: Home genuinely issues requests via `requestJson` in `src/lib/app-errors.ts:127` (not `RuntimeAPIs`), so the "don't migrate through `web.ts`" decision is correct; `WorkerEntriesManager` is keyed by `workerId` alone (`stateByWorker` map); same-origin/CSRF checks really exist (`auth-login.ts:41`, `auth-session.ts:68`) with no CORS layer; `installationId` is genuinely net-new; and `OmniApp` requires non-null bootstrap while `HomeApp` already accepts nullable. The prior-review issues are substantively addressed. But verification surfaced a few cross-phase seams that will trip a literal executor.

## 1. Verdict

**HARDEN** — close, but three concrete seams should be resolved before execution.

## 2. Remaining blocking findings

**A. `serverId` identity is inconsistent across phases — pre-Phase-4 cache/query keys will orphan.**
Phase 2 injects the local default as `serverId = "local"` (line 253), but Phase 1 derives the serving server's `serverId` from the durable `installationId` (lines 208–210) and Phase 4 auto-registers the served origin *under that installationId-derived id* (line 266). Everything Phase 2/3 primes (TanStack keys, snapshot/worker localStorage envelopes) under `"local"` becomes unreachable once the real id lands.
*Fix:* The served-local `RuntimeServerRef` must take its `serverId` from the bootstrap descriptor (installationId-derived), reserving a deterministic synthetic id only for the null-bootstrap standalone case. Then key space is stable from Phase 2 onward and the "migrate or ignore v1 cache" step (line 458) has one target id, not two.

**B. Phase 3 ownership/fencing tests depend on switch machinery that doesn't exist until Phase 4.**
Phase 3 verification asserts stale-SSE-generation fencing and "start on A, switch to B, resolve A" mutation ownership (lines 499, 585–586), but generation increments and server selection are owned by `ServerDirectoryManager`, built in Phase 4. An executor following phases in order hits "I can't switch servers yet."
*Fix:* State explicitly that the `RuntimeServerRef`/generation provider injected in Phase 2 is the test seam — Phase 3 drives generation bumps and ref swaps through that injectable provider, independent of `ServerDirectoryManager`. (Alternatively move those specific ownership tests into Phase 4, but the seam is cleaner and preserves TDD ordering.)

**C. The cross-origin auth transport is left as an unresolved fork that contradicts the persistence model.**
Line 278 presents "add `SameSite=None; Secure` cookie mode **or** design a token/session bridge" as equal implementation choices, but line 70 explicitly defers any token-based remote adapter to a *future* secret-storage feature. An executor shouldn't be picking the auth architecture mid-build, and the two sections disagree.
*Fix:* Commit this milestone to the `SameSite=None; Secure` cookie mode for explicitly-allowed HTTPS origins (consistent with line 70), and mark the token/session bridge as explicitly future. This also makes the `cors.ts`/`cookies.ts`/`auth-*` modify list (lines 396, 438–440) unambiguous.

**D. SSE construction ownership is split between two stated owners (clarify the seam).**
Today the `EventSource` is constructed inside `src/runtime-api/web.ts`, while `LiveEventConnectionManager` only receives an injected `EventSourceConstructor`. The plan says both that the transport owns `openEvents` (lines 233, 304) *and* that `web.ts` gains `{ withCredentials: true }` EventSource typing (line 430) — leaving "who builds the remote stream" ambiguous.
*Fix:* Say plainly, as the SSE analog of the `requestJson` decision you already made: `runtime-client.openEvents` constructs the `EventSource` against the **selected** origin with `{ withCredentials: true }`, and the `web.ts` change is only for the local-shell boot stream — the remote/runtime-targeted SSE path does **not** route through `web.ts`. (Note: `withCredentials` as the EventSource constructor's second arg is valid per spec, so this is a wiring decision, not a feasibility question.)

Minor, non-blocking: name the durable store for `installationId` (the repo already has `src/server/db` + a schema change in flight — the DB or a config file, but say which) so `src/server/installation-id.ts` isn't underspecified.

## 3. Deliberately leave alone

- The "exact shape can change during implementation, but preserve these ownership rules" escape hatch on the transport type — correct altitude for a plan.
- HTTPS-only constraint for cross-site cookie auth + the explicit "unsupported-auth transport state" for plain-HTTP LAN targets (lines 79, 279) — this is the right, honest call about browser limits; don't soften it.
- Refusing to merge directory records by guesswork when `installationId` is absent (line 212) — good conservative trust behavior.
- Phase 0 file-size splits for `HomeApp.tsx` (verified 1407 lines) and `useHomeMutations.ts` (1085) — keep as a hard gate.
- Two-subprocess lifecycle harness with HTTP/SSE assertions over DOM, and deferring hosted sync/fleet monitoring to future — correctly scoped; leave as-is.

Once A–C are pinned down (and D clarified), this is ready to execute.

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:05:02.989Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:05:02.989Z

Final Baton pass still says `HARDEN`, but the remaining items are narrow. I’m pinning them down now: stable bootstrap-derived `serverId` from Phase 2 onward, injectable generation provider for tests before UI selection exists, cookie-only cross-origin auth for this milestone, remote SSE ownership in `runtime-client.openEvents`, and where the installation id is stored.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:05:16.649Z","phase":null} -->
## Tool call: apply_patch · 2026-06-14T16:05:16.649Z

```json
*** Begin Patch
*** Update File: docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md
@@
-- Server credentials are not persisted by the directory. Existing cookie/session auth remains server-owned by browser origin. If a future token-based remote adapter is introduced, it must be designed as a separate explicit secret-storage feature.
+- Server credentials are not persisted by the directory. Existing cookie/session auth remains server-owned by browser origin. This milestone uses secure cookie auth for explicitly allowed HTTPS standalone origins; token/session bridges are future work and require a separate explicit secret-storage design.
@@
 - `installationId` is a durable server-side uuid persisted outside the browser, generated on first startup if missing, and returned by every runtime bootstrap. Use it as the preferred stable identity across localhost/LAN/tunnel origins.
 - `serverId` is the local directory key. For servers with `installationId`, derive it from `installationId`; for legacy servers without it, derive it from normalized origin and descriptor version.
+- Store `installationId` in the local OmniHarness app data/config area through `src/server/installation-id.ts`, not in browser localStorage. The helper owns creation, read, validation, and corruption recovery for that id.
@@
-Phase 2 defines and tests the `RuntimeServerRef` contract with an injected local default (`serverId = "local"`, current origin, `generation = 1`) so the transport can be tested before the full server directory UI exists. Phase 4 replaces that default provider with `ServerDirectoryManager`.
+Phase 2 defines and tests the `RuntimeServerRef` contract with an injected provider so the transport can be tested before the full server directory UI exists. In served-local mode the provider must use the bootstrap descriptor's installation-id-derived `serverId` from the start; use a deterministic synthetic id only for null-bootstrap standalone mode before any server is selected. Phase 3 tests can drive generation bumps and server-ref swaps through this injected provider without waiting for the Phase 4 server directory UI. Phase 4 replaces the temporary provider with `ServerDirectoryManager` while preserving the same `serverId` key space.
@@
-- Cookie strategy must be explicit. Current auth cookies are `SameSite=Lax`, which is not enough for true cross-site standalone access. The implementation must either add a secure cross-site cookie mode for explicitly allowed HTTPS origins (`SameSite=None; Secure`) or design an explicit token/session bridge for standalone clients.
+- Cookie strategy is explicit for this milestone: add a secure cross-site cookie mode for explicitly allowed HTTPS origins (`SameSite=None; Secure`). Do not implement a token/session bridge in this milestone.
@@
 ### SSE And Worker Entries
 
-`LiveEventConnectionManager` receives a runtime client and `serverRef`. It builds `/api/events` URLs against the selected server origin, carries the selected server generation, and ignores late events from old generations. `lastEventId` is per `serverId` and per selected run scope.
+`LiveEventConnectionManager` receives a runtime client and `serverRef`. Remote/runtime-targeted SSE goes through `runtime-client.openEvents`, which constructs `EventSource` against the selected origin with `{ withCredentials: true }` when credentials are needed. `src/runtime-api/web.ts` may keep local-shell boot stream compatibility, but remote Home SSE does not route through `web.ts`. The connection carries the selected server generation and ignores late events from old generations. `lastEventId` is per `serverId` and per selected run scope.
*** End Patch

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:05:16.673Z","phase":null} -->
## Tool result: call_BSfbNQxncOIDReJnwroWznPB · 2026-06-14T16:05:16.673Z

```text
Exit code: 0
Wall time: 0 seconds
Output:
Success. Updated the following files:
M docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:05:21.075Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:05:21.075Z

I also need to update the Phase 2 verification sentence so it no longer mentions the synthetic `"local"` id for served mode.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:05:25.001Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:05:25.001Z

```json
{
  "cmd": "rg -n \"local default|serverId =|token/session|SameSite|openEvents|installationId\" docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 16000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:05:25.081Z","phase":null} -->
## Tool result: call_YbWK8UtPfiQ9lYqVYbe6YvEU · 2026-06-14T16:05:25.081Z

```text
Chunk ID: fad74d
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 963
Output:
35:**First User:** The human builder who may run more than one OmniHarness instance: local default server, desktop-started server, a server exposed through a tunnel, and possibly a second machine on LAN.
70:- Server credentials are not persisted by the directory. Existing cookie/session auth remains server-owned by browser origin. This milestone uses secure cookie auth for explicitly allowed HTTPS standalone origins; token/session bridges are future work and require a separate explicit secret-storage design.
79:- Authenticated cross-origin access is limited to HTTPS target origins. Plain-HTTP LAN servers can be used only when unlocked or same-origin because browsers block mixed content from HTTPS standalone UIs and `SameSite=None` cookies require `Secure`.
185:  installationId: string;
208:- For the server that serves the UI, derive `serverId` from the durable `installationId`. Remote directory entries keep their generated local `serverId` stable even if display name changes.
209:- `installationId` is a durable server-side uuid persisted outside the browser, generated on first startup if missing, and returned by every runtime bootstrap. Use it as the preferred stable identity across localhost/LAN/tunnel origins.
210:- `serverId` is the local directory key. For servers with `installationId`, derive it from `installationId`; for legacy servers without it, derive it from normalized origin and descriptor version.
211:- Store `installationId` in the local OmniHarness app data/config area through `src/server/installation-id.ts`, not in browser localStorage. The helper owns creation, read, validation, and corruption recovery for that id.
213:- If a tunnel URL points to the same `installationId` as another remembered origin, the directory links both origins to the same server record and updates the preferred origin only through explicit user action. Without `installationId`, the UI may warn about matching display/version but must not merge records by guesswork.
234:  openEvents(args: { runId?: string | null; lastEventId?: string | null }, handlers: EventStreamHandlers): RuntimeSubscription;
273:- Configured allowed UI origins, with local defaults for same-origin and explicit development origins only.
279:- Cookie strategy is explicit for this milestone: add a secure cross-site cookie mode for explicitly allowed HTTPS origins (`SameSite=None; Secure`). Do not implement a token/session bridge in this milestone.
305:`LiveEventConnectionManager` receives a runtime client and `serverRef`. Remote/runtime-targeted SSE goes through `runtime-client.openEvents`, which constructs `EventSource` against the selected origin with `{ withCredentials: true }` when credentials are needed. `src/runtime-api/web.ts` may keep local-shell boot stream compatibility, but remote Home SSE does not route through `web.ts`. The connection carries the selected server generation and ignores late events from old generations. `lastEventId` is per `serverId` and per selected run scope.
421:  - Add runtime/server descriptor fields to `HomeBootstrapPayload`, including durable `installationId`.
545:  - Include `descriptorVersion`, durable `installationId`, `serverId`, origin, display name, runtime version, required capabilities, standalone support, and initial data ownership.
556:  - Verification: `pnpm test -- tests/app/home/runtime-client.test.ts` covers request URL building, raw fetch wrapping, credentials mode, timeout/cancellation, auth/offline/incompatible/unsupported-transport classification, event-source credentials, and stale generation rejection using an injected local default `RuntimeServerRef`.
619:  - Modify runtime registry/server and auth/cookie routes to support configured standalone UI origins, preflight, credentialed requests, SSE credentials, and secure cross-site cookie or explicit token/session bridge.

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:05:28.366Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:05:28.366Z

Two stale checklist phrases remain from before the auth/identity decisions; patching those.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:05:33.085Z","phase":null} -->
## Tool call: apply_patch · 2026-06-14T16:05:33.085Z

```json
*** Begin Patch
*** Update File: docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md
@@
-  - Verification: `pnpm test -- tests/app/home/runtime-client.test.ts` covers request URL building, raw fetch wrapping, credentials mode, timeout/cancellation, auth/offline/incompatible/unsupported-transport classification, event-source credentials, and stale generation rejection using an injected local default `RuntimeServerRef`.
+  - Verification: `pnpm test -- tests/app/home/runtime-client.test.ts` covers request URL building, raw fetch wrapping, credentials mode, timeout/cancellation, auth/offline/incompatible/unsupported-transport classification, event-source credentials, and stale generation rejection using an injected `RuntimeServerRef` provider.
@@
-  - Modify runtime registry/server and auth/cookie routes to support configured standalone UI origins, preflight, credentialed requests, SSE credentials, and secure cross-site cookie or explicit token/session bridge.
+  - Modify runtime registry/server and auth/cookie routes to support configured standalone UI origins, preflight, credentialed requests, SSE credentials, and secure cross-site cookie mode for allowed HTTPS origins.
*** End Patch

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:05:33.113Z","phase":null} -->
## Tool result: call_yXucrN68UxQ4EAFCWGJyffum · 2026-06-14T16:05:33.113Z

```text
Exit code: 0
Wall time: 0 seconds
Output:
Success. Updated the following files:
M docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:05:38.149Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:05:38.149Z

I’m rerunning Baton one more time after those targeted fixes.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:05:42.544Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:05:42.544Z

```json
{
  "cmd": "PATH=/Users/masterman/.local/bin:$PATH /Users/masterman/.local/bin/baton -p \"You are my second-opinion planning reviewer. Review the final revised artifact without editing files. Artifact: /Users/masterman/NLP/omniharness/docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md. User goal: support multiple OmniHarness servers inside the same running app by turning the interface into a standalone thing that can connect to multiple servers. Context and constraints: no branches, no worktrees, no file deletion; preserve unified worker stream; all frontend strings through shared/locales and t(); manager-owned React state; server decisions through named events; lifecycle tests via HTTP/SSE. Prior remaining findings were inconsistent pre-Phase-4 serverId, generation tests before ServerDirectoryManager, token/session bridge ambiguity, and remote SSE ownership. These were revised. Please judge whether this plan is now ready to use. Return only: Verdict READY or HARDEN, remaining blocking findings if any, and anything to leave alone.\"",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 30000,
  "max_output_tokens": 50000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:06:12.717Z","phase":null} -->
## Tool result: call_M19g0fn0PFWQ76elYPga7EVm · 2026-06-14T16:06:12.717Z

```text
Chunk ID: 565b26
Wall time: 30.0013 seconds
Process running with session ID 95449
Original token count: 0
Output:

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:06:17.095Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:06:17.095Z

Baton is running the final check.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:06:17.933Z","phase":null} -->
## Tool call: write_stdin · 2026-06-14T16:06:17.933Z

```json
{
  "session_id": 95449,
  "chars": "",
  "yield_time_ms": 30000,
  "max_output_tokens": 50000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:06:47.939Z","phase":null} -->
## Tool result: call_ykuABeE4CU1LZTca3b7Z0L05 · 2026-06-14T16:06:47.939Z

```text
Chunk ID: d97038
Wall time: 30.0013 seconds
Process running with session ID 95449
Original token count: 0
Output:

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:06:50.353Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:06:50.353Z

Still waiting on Baton.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:06:51.258Z","phase":null} -->
## Tool call: write_stdin · 2026-06-14T16:06:51.258Z

```json
{
  "session_id": 95449,
  "chars": "",
  "yield_time_ms": 60000,
  "max_output_tokens": 50000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:07:22.990Z","phase":null} -->
## Tool result: call_RYf4dHvF0s9K43lwWzB9ZQio · 2026-06-14T16:07:22.990Z

```text
Chunk ID: d20296
Wall time: 31.7298 seconds
Process exited with code 0
Original token count: 1016
Output:
I've verified the plan's structural premises against the codebase. They hold:

- `HomeApp.tsx` is 1407 lines and `useHomeMutations.ts` 1085 — the Phase 0 split mandate is grounded in reality.
- The five `src/runtime-api/*` adapters, the auth/cookie/events-log routes, and all 9 `shared/locales/*.json` files exist exactly as the file map assumes.
- `requestJson` is currently imported from `@/lib/app-errors` and called with hardcoded `"/api/..."` literals in `useHomeQueries`/`LiveEventConnectionManager` — confirming the migration premise and the value of the Phase 0 call-site audit.
- The three new core modules (`installation-id.ts`, `runtime-client.ts`, `ServerDirectoryManager.ts`) do not yet exist, consistent with "Files To Create."

I also confirmed each of the four prior findings is now resolved in the text:

1. **Pre-Phase-4 serverId consistency** — line 254 pins served-local mode to the installation-id-derived `serverId` from Phase 2 onward, synthetic ids only for null-bootstrap-before-selection, and Phase 4 swaps the provider "while preserving the same `serverId` key space." Cache keys no longer churn across the manager handoff. ✓
2. **Generation tests before the manager** — Phase 2/3 drive generation bumps through an injected `RuntimeServerRef` provider (line 254), so ownership fencing is testable without `ServerDirectoryManager`. ✓
3. **Token/session bridge ambiguity** — lines 70, 279–280 commit to `SameSite=None; Secure` cookie auth for allowed HTTPS origins and explicitly defer token bridges to future work. ✓
4. **Remote SSE ownership** — lines 305–307 route remote Home SSE through `runtime-client.openEvents` with `withCredentials`, keep `web.ts` to local-shell boot only, and fence late events by generation. ✓

---

## Verdict: READY

The plan is executable as written. It satisfies every stated constraint (no branches/worktrees/deletion, unified worker stream preserved, all strings through `shared/locales` + `t()`, manager-owned state, server decisions via named events, lifecycle tests over HTTP/SSE). File map, ownership tokens, state machine, persistence model, error model, and per-phase verification are all present and the sequencing is now sound.

## Remaining blocking findings

None.

## Non-blocking notes (optional hardening, do not gate execution)

- **Descriptor `serverId` vs client-derived `serverId`.** `RuntimeServerDescriptor` carries both `serverId` and `installationId` (line 187/209), while line 210 says the directory *derives* `serverId` from `installationId`. One line stating "the client always derives the directory key locally; `descriptor.serverId` is informational/validation only" would remove the only real ambiguity an implementer could trip on. Cheap to add; safe to leave to implementation.
- **`multi-server-cache.test.ts` traceability.** It's in Files To Create and in Phase 6's run command, but no checklist step names it at creation — its content is produced implicitly by the Phase 3 cache/worker steps. Fine, just slightly loose.
- **Phase 5 back-loads the hardest unknowns** (cross-site cookie behavior, the CSRF/same-origin revisit in `auth-login.ts`/`auth-session.ts`). The plan correctly gates milestone completion on it (line 284) while letting same-origin multi-server land first — acceptable, but the executor should treat Phase 5 as the genuine risk and not assume the earlier green tests imply the milestone is near done.

## Leave alone

- The audit-first Phase 0 gate and the 1200-line split discipline — correct and grounded.
- The injected-provider strategy for Phases 2–3 — this is the right decoupling and the fix that made the rest of the ordering work; don't merge it back into `ServerDirectoryManager`.
- Keeping the unified worker stream and refusing a parallel remote-transcript store — central to the design; resist any "cache the entries server-side" temptation during implementation.
- The cookie-only auth scope with token bridges deferred — appropriately conservative for a single-user builder tool; don't expand it.

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:07:27.919Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:07:27.919Z

Baton’s final verdict is `READY`. It left two cheap non-blocking clarifications; I’m adding them because they reduce executor ambiguity without changing scope.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:07:36.304Z","phase":null} -->
## Tool call: apply_patch · 2026-06-14T16:07:36.304Z

```json
*** Begin Patch
*** Update File: docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md
@@
 - `installationId` is a durable server-side uuid persisted outside the browser, generated on first startup if missing, and returned by every runtime bootstrap. Use it as the preferred stable identity across localhost/LAN/tunnel origins.
-- `serverId` is the local directory key. For servers with `installationId`, derive it from `installationId`; for legacy servers without it, derive it from normalized origin and descriptor version.
+- `serverId` is the local directory key. For servers with `installationId`, derive it from `installationId`; for legacy servers without it, derive it from normalized origin and descriptor version. Any `descriptor.serverId` value is informational/validation data; the client computes the directory key locally from this rule.
@@
 - [ ] Phase 3: scope event snapshot cache by server while defaulting to the local server.
   - Modify `src/app/home/EventStreamSnapshotCacheManager.ts` and `src/app/home/EventStreamStateManager.ts`.
   - Preserve server-authoritative bootstrap behavior and existing scoped completeness merges.
-  - Verification: cache tests prove no cross-server hydration, corrupt localStorage recovery, and no demotion of `snapshotSource: "server"`.
+  - Create/update `tests/app/home/multi-server-cache.test.ts`.
+  - Verification: cache tests prove no cross-server hydration, corrupt localStorage recovery, and no demotion of `snapshotSource: "server"`.
@@
 - [ ] Phase 3: scope worker entry state and cache by server.
   - Modify `src/app/home/WorkerEntriesManager.ts`.
   - Keep the contiguous-prefix invariant, wake-up semantics, bounded cache, and `?afterSeq=`/tail/backfill flows.
+  - Add worker-entry isolation cases to `tests/app/home/multi-server-cache.test.ts` or a focused worker manager test.
   - Verification: worker manager tests prove same `workerId` on two servers stays isolated and stale fetches cannot mutate the active server stream.
*** End Patch

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:07:36.331Z","phase":null} -->
## Tool result: call_6y20iSYK6NVdapQ6p6dBFpjf · 2026-06-14T16:07:36.331Z

```text
Exit code: 0
Wall time: 0 seconds
Output:
Success. Updated the following files:
M docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:07:39.980Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:07:39.980Z

I’m using the verification-before-completion skill before I claim this is done; I’ll read its instructions and then run lightweight verification on the plan artifact.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:07:41.487Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:07:41.487Z

```json
{
  "cmd": "sed -n '1,220p' /Users/masterman/.agents/skills/verification-before-completion/SKILL.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 16000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:07:41.539Z","phase":null} -->
## Tool result: call_RIHErbNKNJrjohv8RoXi7GSR · 2026-06-14T16:07:41.539Z

````text
Chunk ID: c20366
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2230
Output:
---
name: verification-before-completion
description: Use when about to claim work is complete, fixed, or passing, before committing or creating PRs - requires running verification commands and confirming output before making any success claims; evidence before assertions always
---

# Verification Before Completion

## Overview

Claiming work is complete without verification is dishonesty, not efficiency.

**Core principle:** Evidence before claims, always.

**Violating the letter of this rule is violating the spirit of this rule.**

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you haven't run the verification command in this message, you cannot claim it passes.

## The Gate Function

```
BEFORE claiming any status or expressing satisfaction:

1. IDENTIFY: What command proves this claim?
2. RUN: Execute the FULL command (fresh, complete)
3. READ: Full output, check exit code, count failures
4. VERIFY: Does output confirm the claim?
   - If NO: State actual status with evidence
   - If YES: State claim WITH evidence
5. ONLY THEN: Make the claim

Skip any step = lying, not verifying
```

## Product-Surface Verification

When the work involves an app, UI, or product surface, verification must cover more than whether a single requested feature works.

Keep verification proportional. For tiny mechanical edits, targeted verification is enough: inspect the diff, confirm the changed value/text, and run only the smallest relevant check. Do not escalate to full product-surface verification unless the change can affect behavior, state, navigation, persistence, or the user journey.

Also verify:

- required functionality is real end-to-end, not a fake component, mock, placeholder, canned response, or fallback path,
- the primary user stories are actually supported,
- the primary user journey works end-to-end,
- any approved agentic user journey tests have been run, or clearly state that they were proposed but not run because approval was not given,
- return/revisit flows work when they are part of the product,
- expected empty states are present,
- expected loading, waiting, or in-progress states are visible,
- expected error and recovery states are present,
- expected completed or success states are understandable,
- expected status-awareness flows are present,
- the state model is represented correctly,
- React/server-state invariants are verified when the app uses server state, optimistic UI, caches, polling, streams, background jobs, or persisted runtime state,
- persistence behavior for settings, preferences, drafts, and other user-managed state matches the approved design,
- operational readiness expectations are met for the approved scope,
- instrumentation and observability exist where the approved scope depends on them,
- backend or agent workflow decisions emit the planned named events, and a headless/scriptable check can assert the event sequence without relying on UI snapshots,
- real errors are surfaced rather than silently swallowed or replaced with vague placeholders,
- onboarding and discoverability work for first-run or empty-state use,
- risk and trust surfaces are handled well enough to avoid silent failure, ambiguous state, or obvious loss of confidence,
- when the scope includes a frontend/backend boundary, frontend-visible failures preserve the real error details and stack traces expected by the approved design,
- baseline expected v1 surfaces and inferred behaviors from the approved story set, spec, or plan are actually present.

When the scope includes settings or preferences, also verify:

- each meaningful setting persists or does not persist exactly as designed,
- the storage location and ownership model match the approved plan,
- refresh, restart, sign-out, reset, and migration behavior work as intended for the approved scope,
- settings dialogs avoid redundant section titles, subtitles, explanatory filler, and decorative chrome that does not help the user make a decision.

Do not confuse "the requested control exists" with "the product is usable."

For app, UI, and product-surface work, consider whether an agentic user journey test is the right proof. This mode is approval-gated because it can spend significant tokens: propose it when useful, but only run it if the user explicitly approves.

## Common Failures

| Claim | Requires | Not Sufficient |
|-------|----------|----------------|
| Tests pass | Test command output: 0 failures | Previous run, "should pass" |
| Linter clean | Linter output: 0 errors | Partial check, extrapolation |
| Build succeeds | Build command: exit 0 | Linter passing, logs look good |
| Bug fixed | Test original symptom: passes | Code changed, assumed fixed |
| Meaningful system bug fixed | Learning note plus verification | Fix committed with no durable lesson |
| React/server state sync works | Stale-response, merge, event-sequence, and ownership tests relevant to the change | UI looked right once |
| Regression test works | Red-green cycle verified | Test passes once |
| Agent completed | VCS diff shows changes | Agent reports "success" |
| Requirements met | Line-by-line checklist | Tests passing |
| Feature complete | Real end-to-end behavior in the product | Mocked component, canned data, placeholder UI, fallback path |

## Red Flags - STOP

- Using "should", "probably", "seems to"
- Expressing satisfaction before verification ("Great!", "Perfect!", "Done!", etc.)
- About to commit/push/PR without verification
- Trusting agent success reports
- Accepting "validated with mocks" or "placeholder works" as completion
- Relying on partial verification
- Thinking "just this once"
- Tired and wanting work over
- **ANY wording implying success without having run verification**

## Rationalization Prevention

| Excuse | Reality |
|--------|---------|
| "Should work now" | RUN the verification |
| "I'm confident" | Confidence ≠ evidence |
| "Just this once" | No exceptions |
| "Linter passed" | Linter ≠ compiler |
| "Agent said success" | Verify independently |
| "I'm tired" | Exhaustion ≠ excuse |
| "Partial check is enough" | Partial proves nothing |
| "Different words so rule doesn't apply" | Spirit over letter |

## Key Patterns

**Tests:**
```
✅ [Run test command] [See: 34/34 pass] "All tests pass"
❌ "Should pass now" / "Looks correct"
```

**Regression tests (TDD Red-Green):**
```
✅ Write → Run (pass) → Revert fix → Run (MUST FAIL) → Restore → Run (pass)
❌ "I've written a regression test" (without red-green verification)
```

**Build:**
```
✅ [Run build] [See: exit 0] "Build passes"
❌ "Linter passed" (linter doesn't check compilation)
```

**Requirements:**
```
✅ Re-read plan → Create checklist → Verify each → Report gaps or completion
❌ "Tests pass, phase complete"
```

**Agent delegation:**
```
✅ Agent reports success → Check VCS diff → Verify changes → Report actual state
❌ Trust agent report
```

## Why This Matters

From 24 failure memories:
- your human partner said "I don't believe you" - trust broken
- Undefined functions shipped - would crash
- Missing requirements shipped - incomplete features
- Time wasted on false completion → redirect → rework
- Violates: "Honesty is a core value. If you lie, you'll be replaced."

## When To Apply

**ALWAYS before:**
- ANY variation of success/completion claims
- ANY expression of satisfaction
- ANY positive statement about work state
- Committing, PR creation, task completion
- Staging, committing, pushing, or opening a PR when the work could include secrets, local environment files, dependencies, caches, build outputs, logs, temporary files, or generated/intermediate artifacts
- Moving to next task
- Delegating to agents

When a meaningful bug involved architecture, storage, memory, persistence, control planes, background workers, recovery, data loss, security, or a repeated wrong assumption, use `ultrapowers:learning-from-bugs` before claiming the fix is complete.

When a React app has server state, optimistic UI, caches, polling, SSE/WebSocket streams, background jobs, or persisted runtime state, use `ultrapowers:client-server-state-invariants` to decide which race and synchronization tests are required before claiming completion.

Before any git publish step, verify `.gitignore` exists for the project and that `git status` does not include secrets, credentials, local environment files, `node_modules`, dependency caches, build outputs, coverage output, logs, temporary files, or intermediate/generated artifacts unless the human explicitly asked to version a specific generated artifact.

**Rule applies to:**
- Exact phrases
- Paraphrases and synonyms
- Implications of success
- ANY communication suggesting completion/correctness

## The Bottom Line

**No shortcuts for verification.**

Run the command. Read the output. THEN claim the result.

This is non-negotiable.

````

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:07:51.986Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:07:51.986Z

For this doc-only planning work, the relevant verification is artifact existence/content checks plus the external Baton review result. I’m checking the saved file, git status, and remaining ambiguity markers now.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:07:52.054Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:07:52.054Z

```json
{
  "cmd": "test -s docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 8000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:07:52.085Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:07:52.085Z

```json
{
  "cmd": "wc -l docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 8000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:07:52.131Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:07:52.131Z

```json
{
  "cmd": "rg -n \"TODO|TBD|placeholder|mock|fake|deferred|later|if needed|future durable|token/session bridge|serverId = \\\"local\\\"|RuntimeAPIs/selected\" docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:07:52.252Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:07:52.252Z

```json
{
  "cmd": "git status --short",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 1000,
  "max_output_tokens": 16000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:07:52.278Z","phase":null} -->
## Tool result: call_5tJmwwDFS6VlWNHFu8UpR2Dl · 2026-06-14T16:07:52.278Z

```text
Chunk ID: 5a94a5
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 0
Output:

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:07:52.278Z","phase":null} -->
## Tool result: call_K4PduOGlVdTGNB8vMzBULOET · 2026-06-14T16:07:52.278Z

```text
Chunk ID: 61977c
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 20
Output:
     658 docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:07:52.278Z","phase":null} -->
## Tool result: call_HrwSv5H79NAS8URh1TsenqqY · 2026-06-14T16:07:52.278Z

```text
Chunk ID: 7751a6
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 225
Output:
17:**Final Functionality Standard:** The interface must operate against real OmniHarness servers only. No fake server records, mock conversations, synthetic health success, duplicate transcript persistence, or UI-only routing shims count as completion.
70:- Server credentials are not persisted by the directory. Existing cookie/session auth remains server-owned by browser origin. This milestone uses secure cookie auth for explicitly allowed HTTPS standalone origins; token/session bridges are future work and require a separate explicit secret-storage design.
279:- Cookie strategy is explicit for this milestone: add a secure cross-site cookie mode for explicitly allowed HTTPS origins (`SameSite=None; Secure`). Do not implement a token/session bridge in this milestone.
657:- The plan does not require branches, worktrees, file deletion, mocked servers, fake components, or fallback success.

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:07:52.317Z","phase":null} -->
## Tool result: call_zj10PuxztsYDO6iDmqeNbOrR · 2026-06-14T16:07:52.317Z

```text
Chunk ID: acd372
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 648
Output:
 M eslint.config.mjs
 M package.json
 M pnpm-lock.yaml
 M pnpm-workspace.yaml
 M scripts/agent-runtime.ts
 M scripts/check-pnpm.mjs
 M shared/locales/de.json
 M shared/locales/en.json
 M shared/locales/es.json
 M shared/locales/fr.json
 M shared/locales/it.json
 M shared/locales/ja.json
 M shared/locales/ko.json
 M shared/locales/pt.json
 M shared/locales/zh-CN.json
 M src/app/home/BusyMessageQueueManager.ts
 M src/app/home/ComposerContainer.tsx
 M src/app/home/HomeApp.tsx
 M src/app/home/composer-keyboard.ts
 M src/app/home/types.ts
 M src/app/home/useComposerController.ts
 M src/app/home/useHomeMutations.ts
 M src/app/home/useRunSelectionEffects.ts
 M src/components/Terminal.tsx
 M src/components/home/ConversationComposer.tsx
 M src/components/home/QueuedMessageDrawer.tsx
 M src/components/home/WorkersSidebar.tsx
 M src/runtime/http/routes/conversation-messages.ts
 M src/runtime/http/routes/index.ts
 M src/server/agent-runtime/codex.ts
 M src/server/agent-runtime/manager.ts
 M src/server/agent-runtime/output-store.ts
 M src/server/agent-runtime/tool-env.ts
 M src/server/agent-runtime/types.ts
 M src/server/bridge-client/index.ts
 M src/server/conversations/create.ts
 M src/server/conversations/direct-run-status.ts
 M src/server/conversations/queued-messages.ts
 M src/server/conversations/worker-turn-gate.ts
 M src/server/db/index.ts
 M src/server/db/schema.ts
 M src/server/events/named-events.ts
 M src/server/git/run-auto-commit.ts
 D src/server/workers/orchestrator.ts
 M tests/api/conversation-messages-route.test.ts
 M tests/api/conversations-route.test.ts
 M tests/conversations/direct-run-status.test.ts
 M tests/server/bridge-client.test.ts
 M tests/ui/composer-shell.test.ts
 M tests/ui/sidebar-layout.test.ts
?? docs/superpowers/learnings/2026-06-14-direct-conversation-title-generation.md
?? docs/superpowers/learnings/2026-06-14-direct-runs-auto-commit.md
?? docs/superpowers/plans/2026-06-14-escape-interrupt-queued-message.md
?? docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md
?? scripts/install-restarter.sh
?? src/app/api/conversations/[id]/queued-messages/[messageId]/interrupt/
?? src/app/api/conversations/[id]/queued-messages/interrupt-next/
?? src/app/home/upload-attachments.ts
?? src/app/home/useFrozenRecentOrder.ts
?? src/app/home/useQueuedMessageMutations.ts
?? src/server/conversations/queued-message-interrupt.ts
?? tests/app/composer-interrupt-keyboard.test.ts
?? tests/server/agent-runtime/manager-permission-mode.test.ts
?? tests/server/git/run-auto-commit.test.ts
?? tests/server/queued-message-interrupt.test.ts

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-06-14T16:08:04.758Z","phase":"final_answer"} -->
## Codex final · 2026-06-14T16:08:04.758Z

Wrote and hardened the plan here:

[2026-06-14-multi-server-standalone-interface.md](/Users/masterman/NLP/omniharness/docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md)

I ran Baton via `/Users/masterman/.local/bin/baton` with `~/.local/bin` on `PATH`. It took several passes; the final Baton verdict was **READY** with no blocking findings.

Verification run:
- Plan file exists and is non-empty.
- `wc -l`: 658 lines.
- Ambiguity scan only found intentional guardrail/future-scope wording.
- `git status` shows the repo was already heavily dirty; my work added the new plan file only.

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-06-14T16:08:04.819Z","phase":null} -->
## Task state: task_complete · 2026-06-14T16:08:04.819Z

```text
{
  "type": "task_complete",
  "turn_id": "019ec6d3-3456-7de1-9274-26402700f70f",
  "last_agent_message": "Wrote and hardened the plan here:\n\n[2026-06-14-multi-server-standalone-interface.md](/Users/masterman/NLP/omniharness/docs/superpowers/plans/2026-06-14-multi-server-standalone-interface.md)\n\nI ran Baton via `/Users/masterman/.local/bin/baton` with `~/.local/bin` on `PATH`. It took several passes; the final Baton verdict was **READY** with no blocking findings.\n\nVerification run:\n- Plan file exists and is non-empty.\n- `wc -l`: 658 lines.\n- Ambiguity scan only found intentional guardrail/future-scope wording.\n- `git status` shows the repo was already heavily dirty; my work added the new plan file only.",
  "completed_at": 1781453284,
  "duration_ms": 1093937,
  "time_to_first_token_ms": 13349
}
```

<!-- /codex-event -->
