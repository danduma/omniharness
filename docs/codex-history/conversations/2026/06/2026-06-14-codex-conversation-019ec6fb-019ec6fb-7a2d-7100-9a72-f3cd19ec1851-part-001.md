---
provider: "codex"
codex_thread_id: "019ec6fb-7a2d-7100-9a72-f3cd19ec1851"
title: "Codex conversation 019ec6fb"
started_at: "2026-06-14T16:33:50.152Z"
updated_at: "2026-06-14T16:47:20.290Z"
working_directory: "/Users/masterman/NLP/omniharness"
archive_status: "complete"
part: 1
parts: 1
---

# Codex conversation 019ec6fb

> This archive contains visible conversation activity and tool records. Private model reasoning and system/developer instructions are not available here.
<!-- codex-event:{"kind":"state","timestamp":"2026-06-14T16:33:50.750Z","phase":null} -->
## Task state: task_started · 2026-06-14T16:33:50.750Z

```text
{
  "type": "task_started",
  "turn_id": "019ec6fb-7c83-78d2-9d07-4af6a7362fb7",
  "started_at": 1781454830,
  "model_context_window": 258400,
  "collaboration_mode_kind": "default"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"user","timestamp":"2026-06-14T16:33:51.624Z","phase":null} -->
## User · 2026-06-14T16:33:51.624Z

https://github.com/shadcn/improve - let's turn this Set of skills into a different mode, like the implement plan mode, but it will just run one agent with those skills, but we want to capture the output of the skills to display it visually. Essentially we want to extract structured results, that can be easy to review by a human. Essentially The same thing that Claude code would output upon running /improve but visually. Instead of having to go through a menu of options of which tasks we want to implement and then having to scroll up to go and read the definition of that task, we can do better, we can create cards or something and individually examine them approve them, chat more which will change them 

Let's write a plan and harden it

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:34:05.844Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:34:05.844Z

I’ll use the planning-related skills here: first the baseline skill workflow, then brainstorming to shape the product flow, writing-plans to make it actionable, and second-opinion to harden the result. I’ll also inspect the referenced `shadcn/improve` repo and the local OmniHarness architecture before drafting.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:34:05.847Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:34:05.847Z

```json
{
  "cmd": "sed -n '1,240p' /Users/masterman/.agents/skills/using-ultrapowers/SKILL.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:34:05.850Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:34:05.850Z

```json
{
  "cmd": "sed -n '1,260p' /Users/masterman/.agents/skills/brainstorming/SKILL.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:34:05.853Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:34:05.853Z

```json
{
  "cmd": "sed -n '1,260p' /Users/masterman/.agents/skills/writing-plans/SKILL.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:34:05.904Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:34:05.904Z

```json
{
  "cmd": "sed -n '1,260p' /Users/masterman/.agents/skills/second-opinion/SKILL.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:34:05.932Z","phase":null} -->
## Tool result: call_LzQxAlOQmkg3jk80MBlVrQeI · 2026-06-14T16:34:05.932Z

```text
Chunk ID: fda407
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

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:34:05.932Z","phase":null} -->
## Tool result: call_epMrHXsiGS7hWz3vym6H6Izo · 2026-06-14T16:34:05.932Z

```text
Chunk ID: 272468
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

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:34:05.932Z","phase":null} -->
## Tool result: call_kjSlHR7yMehYi3Z3UBG8No6P · 2026-06-14T16:34:05.932Z

````text
Chunk ID: 95ecec
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

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:34:05.949Z","phase":null} -->
## Tool result: call_hSgnN4P4W5GlLJR4NCtOEnE8 · 2026-06-14T16:34:05.949Z

````text
Chunk ID: 642cab
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

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:34:16.512Z","phase":null} -->
## Tool call: web_search · 2026-06-14T16:34:16.512Z

```json
{
  "type": "web_search_call",
  "status": "completed",
  "action": {
    "type": "open_page",
    "url": "https://github.com/shadcn/improve"
  }
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:34:22.158Z","phase":null} -->
## Tool call: web_search · 2026-06-14T16:34:22.158Z

```json
{
  "type": "web_search_call",
  "status": "completed",
  "action": {
    "type": "open_page",
    "url": "https://raw.githubusercontent.com/shadcn/improve/main/skills/improve/SKILL.md"
  }
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:34:25.837Z","phase":null} -->
## Tool call: web_search · 2026-06-14T16:34:25.837Z

```json
{
  "type": "web_search_call",
  "status": "completed",
  "action": {
    "type": "open_page",
    "url": "https://raw.githubusercontent.com/shadcn/improve/main/skills/improve/references/audit-playbook.md"
  }
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:34:35.161Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:34:35.161Z

The upstream `/improve` skill is intentionally plan-first and read-only: it audits, vets findings, writes self-contained markdown plans, and only later dispatches an isolated executor. For OmniHarness, the important twist is to keep that advisor behavior but make the advisor’s intermediate outputs structured, inspectable, and editable in the app instead of burying them in terminal scrollback.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:34:35.164Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:34:35.164Z

```json
{
  "cmd": "sed -n '1,280p' /Users/masterman/.agents/skills/building-react-apps/SKILL.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:34:35.164Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:34:35.164Z

```json
{
  "cmd": "sed -n '1,320p' /Users/masterman/.agents/skills/client-server-state-invariants/SKILL.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:34:35.171Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:34:35.171Z

```json
{
  "cmd": "sed -n '1,320p' /Users/masterman/.agents/skills/instrumenting-control-planes/SKILL.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:34:35.218Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:34:35.218Z

```json
{
  "cmd": "sed -n '1,260p' /Users/masterman/.agents/skills/impeccable/SKILL.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:34:35.246Z","phase":null} -->
## Tool result: call_NTvkYBauyDa9SkV1bPAb9dSo · 2026-06-14T16:34:35.246Z

```text
Chunk ID: aeec93
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

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:34:35.247Z","phase":null} -->
## Tool result: call_Kp660UweYIWEIx7xKI7qIbwk · 2026-06-14T16:34:35.247Z

```text
Chunk ID: d8fb4f
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

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:34:35.247Z","phase":null} -->
## Tool result: call_41Dxsj2OymKQLvAqaumfZj89 · 2026-06-14T16:34:35.247Z

````text
Chunk ID: d67d94
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

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:34:35.259Z","phase":null} -->
## Tool result: call_rQvQAbXwhJM9GDdaP1ZCDQZB · 2026-06-14T16:34:35.259Z

```text
Chunk ID: c3f109
Wall time: 0.0000 seconds
Process exited with code 1
Original token count: 21
Output:
sed: /Users/masterman/.agents/skills/impeccable/SKILL.md: No such file or directory

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"user","timestamp":"2026-06-14T16:34:35.261Z","phase":null} -->
## User · 2026-06-14T16:34:35.261Z

Use baton in local bin for second opinion

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:34:45.373Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:34:45.373Z

Noted. I’ll use `baton` from the local bin as the required second-opinion reviewer when the draft plan exists, and I’ll keep it review-only.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:34:45.376Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:34:45.376Z

```json
{
  "cmd": "sed -n '1,260p' /Users/masterman/NLP/omniharness/.agents/skills/impeccable/SKILL.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:34:45.377Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:34:45.377Z

```json
{
  "cmd": "sed -n '1,260p' /Users/masterman/.agents/skills/brainstorming/references/pm-pass.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:34:45.377Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:34:45.377Z

```json
{
  "cmd": "sed -n '1,280p' /Users/masterman/.agents/skills/brainstorming/references/story-derived-completeness.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:34:45.416Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:34:45.416Z

```json
{
  "cmd": "sed -n '1,220p' /Users/masterman/.agents/skills/brainstorming/references/v1-product-completeness.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:34:45.446Z","phase":null} -->
## Tool result: call_77huJM1d1oifYUIccOL9eJC1 · 2026-06-14T16:34:45.446Z

````text
Chunk ID: e9e65b
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2756
Output:
---
name: impeccable
description: Use when the user wants to design, redesign, shape, critique, audit, polish, clarify, distill, harden, optimize, adapt, animate, colorize, extract, or otherwise improve a frontend interface. Covers websites, landing pages, dashboards, product UI, app shells, components, forms, settings, onboarding, and empty states. Handles UX review, visual hierarchy, information architecture, cognitive load, accessibility, performance, responsive behavior, theming, anti-patterns, typography, fonts, spacing, layout, alignment, color, motion, micro-interactions, UX copy, error states, edge cases, i18n, and reusable design systems or tokens. Also use for bland designs that need to become bolder or more delightful, loud designs that should become quieter, live browser iteration on UI elements, or ambitious visual effects that should feel technically extraordinary. Not for backend-only or non-UI tasks.
---

Designs and iterates production-grade frontend interfaces. Real working code, committed design choices, exceptional craft.

## Setup (non-optional)

Two steps before any design work. Both are required. Skipping either produces generic output that ignores the project.

### 1. Context gathering

Two files at the project root, case-insensitive:

- **PRODUCT.md** — required. Users, brand, tone, anti-references, strategic principles.
- **DESIGN.md** — optional, strongly recommended. Colors, typography, elevation, components.

Load both in one call:

```bash
node .agents/skills/impeccable/scripts/load-context.mjs
```

Consume the full JSON output. Never pipe through `head`, `tail`, `grep`, or `jq`.

If the output is already in this session's conversation history, don't re-run. Exceptions requiring a fresh load: you just ran `$impeccable teach` or `$impeccable document` (they rewrite the files), or the user manually edited one.

`$impeccable live` already warms context via `live.mjs` — if you've run `live.mjs`, don't also run `load-context.mjs` this session.

If PRODUCT.md is missing, empty, or placeholder (`[TODO]` markers, <200 chars): run `$impeccable teach`, then resume the user's original task with the fresh context.

If DESIGN.md is missing: nudge once per session (*"Run `$impeccable document` for more on-brand output"*), then proceed.

### 2. Register

Every design task is **brand** (marketing, landing, campaign, long-form content, portfolio — design IS the product) or **product** (app UI, admin, dashboard, tool — design SERVES the product).

Identify before designing. Priority: (1) cue in the task itself ("landing page" vs "dashboard"); (2) the surface in focus (the page, file, or route being worked on); (3) `register` field in PRODUCT.md. First match wins.

If PRODUCT.md lacks the `register` field (legacy), infer it once from its "Users" and "Product Purpose" sections, then cache the inferred value for the session. Suggest the user run `$impeccable teach` to add the field explicitly.

Load the matching reference: [reference/brand.md](reference/brand.md) or [reference/product.md](reference/product.md). The shared design laws below apply to both.

## Shared design laws

Apply to every design, both registers. Match implementation complexity to the aesthetic vision — maximalism needs elaborate code, minimalism needs precision. Interpret creatively. Vary across projects; never converge on the same choices. GPT is capable of extraordinary work — don't hold back.

### Color

- Use OKLCH. Reduce chroma as lightness approaches 0 or 100 — high chroma at extremes looks garish.
- Never use `#000` or `#fff`. Tint every neutral toward the brand hue (chroma 0.005–0.01 is enough).
- Pick a **color strategy** before picking colors. Four steps on the commitment axis:
  - **Restrained** — tinted neutrals + one accent ≤10%. Product default; brand minimalism.
  - **Committed** — one saturated color carries 30–60% of the surface. Brand default for identity-driven pages.
  - **Full palette** — 3–4 named roles, each used deliberately. Brand campaigns; product data viz.
  - **Drenched** — the surface IS the color. Brand heroes, campaign pages.
- The "one accent ≤10%" rule is Restrained only. Committed / Full palette / Drenched exceed it on purpose. Don't collapse every design to Restrained by reflex.

### Theme

Dark vs. light is never a default. Not dark "because tools look cool dark." Not light "to be safe."

Before choosing, write one sentence of physical scene: who uses this, where, under what ambient light, in what mood. If the sentence doesn't force the answer, it's not concrete enough — add detail until it does.

"Observability dashboard" does not force an answer. "SRE glancing at incident severity on a 27-inch monitor at 2am in a dim room" does. Run the sentence, not the category.

### Typography

- Cap body line length at 65–75ch.
- Hierarchy through scale + weight contrast (≥1.25 ratio between steps). Avoid flat scales.

### Layout

- Vary spacing for rhythm. Same padding everywhere is monotony.
- Cards are the lazy answer. Use them only when they're truly the best affordance. Nested cards are always wrong.
- Don't wrap everything in a container. Most things don't need one.

### Motion

- Don't animate CSS layout properties.
- Ease out with exponential curves (ease-out-quart / quint / expo). No bounce, no elastic.

### Absolute bans

Match-and-refuse. If you're about to write any of these, rewrite the element with different structure.

- **Side-stripe borders.** `border-left` or `border-right` greater than 1px as a colored accent on cards, list items, callouts, or alerts. Never intentional. Rewrite with full borders, background tints, leading numbers/icons, or nothing.
- **Gradient text.** `background-clip: text` combined with a gradient background. Decorative, never meaningful. Use a single solid color. Emphasis via weight or size.
- **Glassmorphism as default.** Blurs and glass cards used decoratively. Rare and purposeful, or nothing.
- **The hero-metric template.** Big number, small label, supporting stats, gradient accent. SaaS cliché.
- **Identical card grids.** Same-sized cards with icon + heading + text, repeated endlessly.
- **Modal as first thought.** Modals are usually laziness. Exhaust inline / progressive alternatives first.

### Copy

- Every word earns its place. No restated headings, no intros that repeat the title.
- **No em dashes.** Use commas, colons, semicolons, periods, or parentheses. Also not `--`.

### The AI slop test

If someone could look at this interface and say "AI made that" without doubt, it's failed. Cross-register failures are the absolute bans above. Register-specific failures live in each reference.

**Category-reflex check.** If someone could guess the theme and palette from the category name alone — "observability → dark blue", "healthcare → white + teal", "finance → navy + gold", "crypto → neon on black" — it's the training-data reflex. Rework the scene sentence and color strategy until the answer is no longer obvious from the domain.

## Commands

| Command | Category | Description | Reference |
|---|---|---|---|
| `craft [feature]` | Build | Shape, then build a feature end-to-end | [reference/craft.md](reference/craft.md) |
| `shape [feature]` | Build | Plan UX/UI before writing code | [reference/shape.md](reference/shape.md) |
| `teach` | Build | Set up PRODUCT.md and DESIGN.md context | [reference/teach.md](reference/teach.md) |
| `document` | Build | Generate DESIGN.md from existing project code | [reference/document.md](reference/document.md) |
| `extract [target]` | Build | Pull reusable tokens and components into design system | [reference/extract.md](reference/extract.md) |
| `critique [target]` | Evaluate | UX design review with heuristic scoring | [reference/critique.md](reference/critique.md) |
| `audit [target]` | Evaluate | Technical quality checks (a11y, perf, responsive) | [reference/audit.md](reference/audit.md) |
| `polish [target]` | Refine | Final quality pass before shipping | [reference/polish.md](reference/polish.md) |
| `bolder [target]` | Refine | Amplify safe or bland designs | [reference/bolder.md](reference/bolder.md) |
| `quieter [target]` | Refine | Tone down aggressive or overstimulating designs | [reference/quieter.md](reference/quieter.md) |
| `distill [target]` | Refine | Strip to essence, remove complexity | [reference/distill.md](reference/distill.md) |
| `harden [target]` | Refine | Production-ready: errors, i18n, edge cases | [reference/harden.md](reference/harden.md) |
| `onboard [target]` | Refine | Design first-run flows, empty states, activation | [reference/onboard.md](reference/onboard.md) |
| `animate [target]` | Enhance | Add purposeful animations and motion | [reference/animate.md](reference/animate.md) |
| `colorize [target]` | Enhance | Add strategic color to monochromatic UIs | [reference/colorize.md](reference/colorize.md) |
| `typeset [target]` | Enhance | Improve typography hierarchy and fonts | [reference/typeset.md](reference/typeset.md) |
| `layout [target]` | Enhance | Fix spacing, rhythm, and visual hierarchy | [reference/layout.md](reference/layout.md) |
| `delight [target]` | Enhance | Add personality and memorable touches | [reference/delight.md](reference/delight.md) |
| `overdrive [target]` | Enhance | Push past conventional limits | [reference/overdrive.md](reference/overdrive.md) |
| `clarify [target]` | Fix | Improve UX copy, labels, and error messages | [reference/clarify.md](reference/clarify.md) |
| `adapt [target]` | Fix | Adapt for different devices and screen sizes | [reference/adapt.md](reference/adapt.md) |
| `optimize [target]` | Fix | Diagnose and fix UI performance | [reference/optimize.md](reference/optimize.md) |
| `live` | Iterate | Visual variant mode: pick elements in the browser, generate alternatives | [reference/live.md](reference/live.md) |

Plus two management commands — `pin <command>` and `unpin <command>`, detailed below.

### Routing rules

1. **No argument** — render the table above as the user-facing command menu, grouped by category. Ask what they'd like to do.
2. **First word matches a command** — load its reference file and follow its instructions. Everything after the command name is the target.
3. **First word doesn't match** — general design invocation. Apply the setup steps, shared design laws, and the loaded register reference, using the full argument as context.

Setup (context gathering, register) is already loaded by then; sub-commands don't re-invoke `$impeccable`.

## Pin / Unpin

**Pin** creates a standalone shortcut so `$<command>` invokes `$impeccable <command>` directly. **Unpin** removes it. The script writes to every harness directory present in the project.

```bash
node .agents/skills/impeccable/scripts/pin.mjs <pin|unpin> <command>
```

Valid `<command>` is any command from the table above. Report the script's result concisely — confirm the new shortcut on success, relay stderr verbatim on error.
````

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:34:45.455Z","phase":null} -->
## Tool result: call_Q5bcBITmM6V8sY8O41FMruT7 · 2026-06-14T16:34:45.455Z

```text
Chunk ID: 09557e
Wall time: 0.0000 seconds
Process exited with code 1
Original token count: 25
Output:
sed: /Users/masterman/.agents/skills/brainstorming/references/pm-pass.md: No such file or directory

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:34:45.455Z","phase":null} -->
## Tool result: call_RwOm5fhEUBqEQjPcZfxXs8Hm · 2026-06-14T16:34:45.455Z

```text
Chunk ID: d0914f
Wall time: 0.0000 seconds
Process exited with code 1
Original token count: 30
Output:
sed: /Users/masterman/.agents/skills/brainstorming/references/story-derived-completeness.md: No such file or directory

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:34:45.455Z","phase":null} -->
## Tool result: call_9uQwBSxRJVH2zOpn7daNiuxu · 2026-06-14T16:34:45.455Z

```text
Chunk ID: 2c0a3c
Wall time: 0.0000 seconds
Process exited with code 1
Original token count: 29
Output:
sed: /Users/masterman/.agents/skills/brainstorming/references/v1-product-completeness.md: No such file or directory

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:34:55.446Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:34:55.446Z

The repo-local design skill is available, but its supporting references live alongside the project skill installation rather than the global skill path. I’m correcting that and loading the product/design context before I lock the UI surface assumptions into the plan.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:34:55.449Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:34:55.449Z

```json
{
  "cmd": "rg --files /Users/masterman/.agents/skills /Users/masterman/NLP/omniharness/.agents/skills | rg 'pm-pass|story-derived-completeness|v1-product-completeness|reference/product\\.md$|load-context\\.mjs$'",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:34:55.449Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:34:55.449Z

```json
{
  "cmd": "node .agents/skills/impeccable/scripts/load-context.mjs",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:34:55.449Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:34:55.449Z

```json
{
  "cmd": "command -v baton || true; ls -l /Users/masterman/.local/bin/baton /usr/local/bin/baton /opt/homebrew/bin/baton 2>/dev/null || true",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:34:55.509Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:34:55.509Z

```json
{
  "cmd": "pwd; rg --files -g 'AGENTS.md' -g 'PRODUCT.md' -g 'DESIGN.md' -g 'package.json' -g 'docs/architecture/lifecycle-observability-and-testing.md' -g 'docs/architecture/worker-conversation-stream.md' | sort",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:34:55.548Z","phase":null} -->
## Tool result: call_2dgMSoq4nPrXYlogYB51UDEn · 2026-06-14T16:34:55.548Z

```text
Chunk ID: 2b1cfe
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 52
Output:
/Users/masterman/.agents/skills/brainstorming/v1-product-completeness.md
/Users/masterman/.agents/skills/brainstorming/pm-pass.md
/Users/masterman/.agents/skills/brainstorming/story-derived-completeness.md

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:34:55.616Z","phase":null} -->
## Tool result: call_Xlp7tDWgpIxtePoX7PFbxScC · 2026-06-14T16:34:55.616Z

```text
Chunk ID: b71795
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 38
Output:
{
  "hasProduct": false,
  "product": null,
  "productPath": null,
  "hasDesign": false,
  "design": null,
  "designPath": null,
  "migrated": false
}

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:34:55.616Z","phase":null} -->
## Tool result: call_Jfd3vpDjbpFKxxFupcfFXjw2 · 2026-06-14T16:34:55.616Z

```text
Chunk ID: 7c1409
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 30
Output:
lrwxr-xr-x@ 1 masterman  staff  32 Jun 13 19:17 /Users/masterman/.local/bin/baton -> /Users/masterman/NLP/baton/baton

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:34:55.616Z","phase":null} -->
## Tool result: call_67YGgyoSsQRlp2kH0xI3xfpV · 2026-06-14T16:34:55.616Z

```text
Chunk ID: aef446
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 54
Output:
/Users/masterman/NLP/omniharness
AGENTS.md
apps/electron/package.json
apps/vscode/package.json
docs/architecture/lifecycle-observability-and-testing.md
docs/architecture/worker-conversation-stream.md
package.json

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:35:07.034Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:35:07.034Z

`PRODUCT.md` and `DESIGN.md` are absent, so I won’t invent brand/design-system specifics for the plan. I’ll keep the UI direction anchored to the existing app conventions and require the implementation phase to inspect actual components before making visual changes.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:35:07.035Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:35:07.035Z

```json
{
  "cmd": "sed -n '1,260p' /Users/masterman/.agents/skills/brainstorming/pm-pass.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:35:07.035Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:35:07.035Z

```json
{
  "cmd": "sed -n '1,280p' /Users/masterman/.agents/skills/brainstorming/story-derived-completeness.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:35:07.035Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:35:07.035Z

```json
{
  "cmd": "sed -n '1,220p' /Users/masterman/.agents/skills/brainstorming/v1-product-completeness.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:35:07.090Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:35:07.090Z

```json
{
  "cmd": "sed -n '1,260p' AGENTS.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:35:07.121Z","phase":null} -->
## Tool result: call_iZrGTIAkpYyTL3qAWsWZLo2S · 2026-06-14T16:35:07.121Z

```text
Chunk ID: 8e809e
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

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:35:07.122Z","phase":null} -->
## Tool result: call_XMUlsFLsNLlMnljWanML0sFe · 2026-06-14T16:35:07.122Z

```text
Chunk ID: 164e95
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

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:35:07.122Z","phase":null} -->
## Tool result: call_CiqtGFuoG5tra7en2NT0g9nQ · 2026-06-14T16:35:07.122Z

```text
Chunk ID: 5966f6
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

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:35:07.133Z","phase":null} -->
## Tool result: call_GgNvQzya2o01psAmrQ1sHl5P · 2026-06-14T16:35:07.133Z

```text
Chunk ID: 64c11a
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1408
Output:
CRITICAL!!: 
- NEVER EVER EVER create a branch!!! branches are FORBIDDEN!!!
- NEVER create a worktree, UNLESS the user has specifically asked for it!
- NEVER delete files unless the user has specifically asked for it. If you think a file is misplaced, unrelated, or stale, that is an entirely separate request — ask first. "Looks unrelated to this task" is not authorization to delete.

- When the user gives a UUID and asks what is going on with it, treat it as an OmniHarness conversation/session lookup: check `sqlite.db`, starting with the `runs` row for that UUID, then inspect related `workers`, `messages`, `execution_events`, queued messages, and validation/plan records as needed.
- To delete all conversations and associated persisted artifacts, use `scripts/delete-conversations.sh`

Testing:
- When testing the app, use the already-running process if one exists instead of starting another server.
- The normal local app URL is `http://localhost:3035`; the compressed Next dev server is usually at `http://localhost:3050`.
- Clean up any test sessions/conversations and their associated persisted artifacts before finishing.
- For lifecycle / chaos-style regressions (reconnect, restart, FK-on-delete, plan-review leftover state), use `pnpm test:lifecycle`. Scenarios live under `tests/lifecycle/scenarios/` and drive the control plane via HTTP/SSE — no Chromium. To debug a specific reported bug, mirror it as a new scenario file.
- Read `docs/architecture/lifecycle-observability-and-testing.md` before adding new server-side state transitions. It is the spec all new code is held to.
- Worker conversation content (direct-control and supervisor-driven worker turns) lives in the unified worker stream — one append-only JSONL per worker at `app-data/run-data/<runId>/<workerId>.jsonl`. Persist new worker content through `appendWorkerEntry` in `src/server/workers/output-store.ts`; render it through `WorkerEntriesManager` and the `entries` prop on `Terminal`. Do NOT add a parallel persistence layer (a sibling JSONL, a new `messages.kind`, an in-memory cache that the frontend reconciles against the stream). See `docs/architecture/worker-conversation-stream.md`.

Lifecycle observability rules (full doc: `docs/architecture/lifecycle-observability-and-testing.md`):
- Every server-side decision (spawn, reattach, recreate, give up, refuse, delete, fail) emits a typed named event via `emitNamedEvent` from `@/server/events/named-events`. Silent early returns and bare `catch {}` are bugs.
- User-relevant failures additionally emit `error.surfaced` with a stable `code` (typed union in `named-events.ts`), `surface`, and at least one of `runId`/`workerId`/`conversationId`. Never funnel through a blanket wrapper in `api-errors.ts`.
- All SSE frames carry an `id:`. Clients reconnect with `Last-Event-ID`; the server replays from the ring buffer or emits `stream.resync_required`. Snapshot bootstrap is `GET /api/events?snapshot=1` (anchor id in the `x-omni-last-event-id` response header).
- Dev-only event log: `GET /api/events/log?since=<id>&runId=<id>` returns the ring buffer as JSON. Use this when triaging "X didn't happen" bug reports — if the event isn't there, the server didn't do the thing, and the next step is finding the silent branch.
- Chaos is a client-side concern. Never add fault-injection code paths to server code.

Frontend i18n:
- EVERY user-facing frontend string MUST live in `shared/locales/*.json` and be rendered with the `t()` function from `@/lib/i18n`.
- NEVER hardcode user-facing JSX text, button labels, dialog titles, aria-labels, titles, placeholders, empty states, status labels, help text, error fallback text, or visible option labels directly in components.
- For every new user-facing string, add the key to `shared/locales/en.json` and every other locale file in `shared/locales/` in the same change. Use stable dotted keys like `settings.runtime.recovery` or `conversation.sidebar.search`.
- Components that render translated strings and need to update when the language changes MUST subscribe to the i18n manager by calling `useI18nSnapshot()` from `@/lib/i18n`; then render text with the existing `t("key", params?)` function. The hook is only for re-rendering; `t()` is the translation API.
- Non-React modules that produce user-visible text must still use `t("key", params?)` at the boundary where text is produced. Protocol values, storage keys, API paths, CSS classes, model ids, and database values are not translation keys unless they are displayed as copy.
- Do not pass translated strings through transactions or persist translated UI copy. Store stable ids/values and translate at render time.

React Best Practices:
- MutableRefObject is deprecated in React; use RefObject instead.
- NEVER use require() to import modules. Use import instead.
- ALWAYS centralize all state in global single source of truth Manager classes. Components/listeners subscribe to updates from Managers and use Manager methods to update data.
- Always implement a custom data manager for any data structure. NEVER use separate state variables and arrays as the source of truth.
- NEVER send data around in transactions.
- Avoid using useEffect() to update state. Prefer useCallback() or Manager methods for explicit state transitions.
- Avoid callback hell, race conditions, and infinite loops.
- NEVER store string literals or UI settings for the frontend in the .env file. Use literals in files, inline arrays, or .json files instead.
- When debugging React: if a fix did not work, think hard about whether this is a race condition. Race conditions are common in React.

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:35:17.204Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:35:17.204Z

I’m now mapping the existing implementation surfaces: how modes are represented, how plans are currently reviewed, how worker output is persisted, and where the UI renders conversation/worker streams. This is the part that determines whether the plan is realistic instead of a product sketch detached from the codebase.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:35:17.207Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:35:17.207Z

```json
{
  "cmd": "sed -n '1,260p' package.json",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:35:17.215Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:35:17.215Z

```json
{
  "cmd": "sed -n '1,260p' docs/architecture/lifecycle-observability-and-testing.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:35:17.215Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:35:17.215Z

```json
{
  "cmd": "sed -n '1,260p' docs/architecture/worker-conversation-stream.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:35:17.262Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:35:17.262Z

```json
{
  "cmd": "rg -n \"implement plan|plan review|review-plan|PlanReview|planReview|mode|skills|agent|worker\" src shared tests docs -g '!node_modules' -g '!app-data'",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 60000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:35:17.347Z","phase":null} -->
## Tool result: call_VpBAEY0fCUFqfW0hIHjFx1aR · 2026-06-14T16:35:17.347Z

```text
Chunk ID: 5369da
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

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:35:17.347Z","phase":null} -->
## Tool result: call_KYtCJc67zrZ9I7D1jVWldAOw · 2026-06-14T16:35:17.347Z

````text
Chunk ID: b5d6d0
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

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:35:17.347Z","phase":null} -->
## Tool result: call_L0QWNRupijgOehIpURyPxQ0u · 2026-06-14T16:35:17.347Z

````text
Chunk ID: 116a09
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

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:35:17.348Z","phase":null} -->
## Tool result: call_TprF1gEYndKSNJz9FgEPo3T3 · 2026-06-14T16:35:17.348Z

```text
Chunk ID: 090d14
Wall time: 0.0001 seconds
Process exited with code 0
Original token count: 262144
Output:
Total output lines: 8907

tests/supervisor/conversation-bootstrap.test.ts:5:  it("hydrates the first model call from persisted user checkpoints", () => {
docs/superpowers/journeys/2026-05-13-branch-workspace-management.md:22:- Expected completion proof: run header shows the selected workspace badge and the worker card shows the same worktree path as its `cwd`.
docs/superpowers/journeys/2026-05-13-branch-workspace-management.md:23:- Failure conditions: selection mutates the current checkout, submit starts in the wrong directory, stale worktree selection is not explained, or worker `cwd` does not match.
docs/superpowers/journeys/2026-05-13-branch-workspace-management.md:28:- User role: builder isolating new agent work.
shared/locales/es.json:34:  "settings.tabs.models": "Modelos",
shared/locales/es.json:35:  "settings.tabs.agents": "Agentes",
shared/locales/es.json:39:  "theme.mode.switchDay": "Cambiar al modo día",
shared/locales/es.json:40:  "theme.mode.switchNight": "Cambiar al modo noche",
shared/locales/es.json:46:  "settings.appearance.terminalFontSizeDescription": "Paneles de terminal y salida del agente.",
shared/locales/es.json:52:  "settings.models.tabs.supervisorCredentials": "Credenciales del supervisor",
shared/locales/es.json:53:  "settings.models.tabs.fallbackCredentials": "Credenciales de respaldo",
shared/locales/es.json:54:  "settings.models.tabs.memoryCredentials": "Memory Summary",
shared/locales/es.json:55:  "settings.models.supervisorTitle": "LLM del supervisor",
shared/locales/es.json:56:  "settings.models.fallbackTitle": "LLM de respaldo",
shared/locales/es.json:57:  "settings.models.memoryTitle": "Memory Summary LLM",
shared/locales/es.json:58:  "settings.models.memory.useCustom": "Use custom memory summary model",
shared/locales/es.json:59:  "settings.models.memory.inheritHelp": "Off uses the same model selected for the supervisor.",
shared/locales/es.json:60:  "settings.models.creditStrategy.label": "Estrategia de créditos / conmutación por error",
shared/locales/es.json:61:  "settings.models.creditStrategy.swapAccount": "Cambiar cuenta",
shared/locales/es.json:62:  "settings.models.creditStrategy.fallbackApi": "API de respaldo",
shared/locales/es.json:63:  "settings.models.creditStrategy.waitForReset": "Esperar reinicio",
shared/locales/es.json:64:  "settings.models.creditStrategy.crossProvider": "Proveedor alternativo",
shared/locales/es.json:65:  "settings.models.creditStrategy.explanation.swapAccount": "When the active account hits its credit limit, switch to the next configured account on the same provider and keep using the same model.",
shared/locales/es.json:66:  "settings.models.creditStrategy.explanation.fallbackApi": "Once credits are exhausted, fall back to the configured fallback LLM (with its own provider, model, and key) for the remainder of the conversation.",
shared/locales/es.json:67:  "settings.models.creditStrategy.explanation.waitForReset": "Pause execution until the provider's quota window resets, then resume on the same account. Use this when continuity matters more than throughput.",
shared/locales/es.json:68:  "settings.models.creditStrategy.explanation.crossProvider": "Spill over to another provider entirely when credits run out, picking the cheapest available frontier model that satisfies the request.",
shared/locales/es.json:69:  "settings.models.advanced": "Advanced",
shared/locales/es.json:70:  "settings.models.thinkingEffort.label": "Thinking effort",
shared/locales/es.json:71:  "settings.models.thinkingEffort.off": "Off",
shared/locales/es.json:72:  "settings.models.thinkingEffort.low": "Low",
shared/locales/es.json:73:  "settings.models.thinkingEffort.medium": "Medium",
shared/locales/es.json:74:  "settings.models.thinkingEffort.high": "High",
shared/locales/es.json:75:  "settings.models.thinkingEffort.xhigh": "Extra High",
shared/locales/es.json:76:  "settings.models.thinkingEffort.max": "Max",
shared/locales/es.json:77:  "settings.models.temperature": "Temperature",
shared/locales/es.json:78:  "settings.models.temperaturePlaceholder": "Provider default",
shared/locales/es.json:79:  "settings.models.maxOutputTokens": "Max output tokens",
shared/locales/es.json:80:  "settings.models.maxOutputTokensPlaceholder": "Provider default",
shared/locales/es.json:81:  "settings.models.selectModel": "Select a model",
shared/locales/es.json:82:  "settings.models.customModelPlaceholder": "Enter model id",
shared/locales/es.json:83:  "settings.models.requiredBaseUrl": "Required custom base URL",
shared/locales/es.json:84:  "settings.models.credentialReplaceHint": "Enter a new key to replace the saved one",
shared/locales/es.json:85:  "settings.models.replaceCredential": "Replace",
shared/locales/es.json:86:  "settings.models.errorSource": "Configuración de LLM",
shared/locales/es.json:87:  "settings.models.fetchAvailableModels": "Obtener modelos disponibles",
shared/locales/es.json:88:  "settings.models.provider": "Proveedor",
shared/locales/es.json:89:  "settings.models.provider.codex": "Codex (ChatGPT subscription)",
shared/locales/es.json:90:  "settings.models.codex.title": "Codex Subscription",
shared/locales/es.json:91:  "settings.models.codex.statusAvailable": "Codex is available via your ChatGPT subscription.",
shared/locales/es.json:92:  "settings.models.codex.statusUnavailable": "Codex subscription is not available. Log in via your terminal first.",
shared/locales/es.json:93:  "settings.models.codex.useForSupervisor": "Use Codex for supervisor",
shared/locales/es.json:94:  "settings.models.codex.stopUsing": "Stop using Codex",
shared/locales/es.json:95:  "settings.models.codex.runLoginHint": "Run `codex login` in a terminal, then reload settings.",
shared/locales/es.json:96:  "settings.models.codex.runLogoutHint": "To remove your Codex login from this machine, run `codex logout` in a terminal.",
shared/locales/es.json:97:  "settings.models.codex.planTier": "Plan: {tier}",
shared/locales/es.json:98:  "settings.models.codex.expires": "Token expires: {at}",
shared/locales/es.json:99:  "settings.models.codex.lastRefresh": "Last refresh: {at}",
shared/locales/es.json:100:  "settings.models.model": "Modelo",
shared/locales/es.json:101:  "settings.models.enterApiKeyFirst": "Introduce primero la clave API",
shared/locales/es.json:102:  "settings.models.loadingModels": "Cargando modelos...",
shared/locales/es.json:103:  "settings.models.searchGeminiModels": "Buscar modelos Gemini",
shared/locales/es.json:104:  "settings.models.noGeminiModels": "No hay modelos Gemini disponibles",
shared/locales/es.json:105:  "settings.models.unableToFetchModels": "No se pudieron obtener los modelos disponibles.",
shared/locales/es.json:106:  "settings.models.geminiModelHelp": "Los ids de modelos Gemini se sirven desde el catálogo local y aparecen en un desplegable de búsqueda.",
shared/locales/es.json:107:  "settings.models.endpoint": "Endpoint",
shared/locales/es.json:108:  "settings.models.optionalBaseUrl": "URL base personalizada opcional",
shared/locales/es.json:109:  "settings.models.apiKey": "Clave API",
shared/locales/es.json:110:  "settings.models.savedCredential": "Credencial guardada",
shared/locales/es.json:111:  "settings.models.providerCredential": "Credencial del proveedor",
shared/locales/es.json:112:  "settings.models.credentialSaved": "Credencial guardada. Introduce un valor nuevo para reemplazarla.",
shared/locales/es.json:113:  "settings.agents.defaultWorker": "Agente worker predeterminado",
shared/locales/es.json:114:  "settings.agents.toggleDangerouslySkipPermissions": "Toggle YOLO / Dangerously skip permissions",
shared/locales/es.json:115:  "settings.agents.dangerouslySkipPermissions": "YOLO / Dangerously skip permissions",
shared/locales/es.json:116:  "settings.agents.workerAvailability": "Estado de disponibilidad de workers",
shared/locales/es.json:117:  "settings.agents.refreshAvailability": "Actualizar disponibilidad",
shared/locales/es.json:118:  "settings.agents.refreshingAvailability": "Actualizando...",
shared/locales/es.json:119:  "settings.agents.unavailableNow": "No disponible ahora.",
shared/locales/es.json:120:  "settings.agents.toggleWorker": "Alternar {worker}",
shared/locales/es.json:121:  "settings.agents.installedDir": "Directorio instalado",
shared/locales/es.json:122:  "settings.agents.notInstalled": "No instalado",
shared/locales/es.json:123:  "settings.agents.noModelsReported": "No se reportaron modelos.",
shared/locales/es.json:124:  "settings.agents.errorSource": "Runtime de agentes",
shared/locales/es.json:125:  "settings.agents.loadWorkerAvailability": "Cargar disponibilidad de workers",
shared/locales/es.json:139:  "settings.runtime.estimatedWorkerMemoryMb": "Memoria del worker MB",
shared/locales/es.json:140:  "settings.runtime.resourceGuardHelp": "Los workers nuevos se rechazan cuando la memoria o el disco están por debajo de estos límites.",
shared/locales/es.json:143:  "settings.runtime.workerMemoryContext": "Cada lanzamiento pendiente reserva {reservation}, aprox. {percent} de la memoria total.",
shared/locales/es.json:147:  "settings.runtime.idleCleanupHelp": "Cuando no hay agentes activos, Omni expulsa workers precalentados después de este periodo de calma.",
shared/locales/es.json:174:  "conversation.mode.direct.label": "Control directo",
shared/locales/es.json:175:  "conversation.mode.direct.description": "Úsalo para interactuar directamente con el CLI seleccionado, con capacidades completas de control remoto.",
shared/locales/es.json:176:  "conversation.mode.planning.label": "Crear plan",
shared/locales/es.json:177:  "conversation.mode.planning.description": "Usa el modo de planificación directamente en el CLI seleccionado. Cuando el plan esté listo, omni tomará el control, lo confirmará según tu intención y mantendrá a los agentes trabajando sin parar hasta implementarlo por completo.",
shared/locales/es.json:178:  "conversation.mode.implementation.label": "Implementar plan",
shared/locales/es.json:179:  "conversation.mode.implementation.description": "Implementa por completo un plan o especificación existente. Omni confirmará los detalles, coordinará el trabajo y supervisará el progreso hasta que todo el plan quede completamente implementado.",
shared/locales/es.json:181:  "conversation.composer.settings.agent": "Agent",
shared/locales/es.json:182:  "conversation.composer.settings.model": "Model",
shared/locales/es.json:207:  "conversation.toolGroup.usedAgent": "usó {count} agente",
shared/locales/es.json:208:  "conversation.toolGroup.usedAgents": "usó {count} agentes",
shared/locales/es.json:211:  "conversation.activity.startPlanningAgent": "Iniciando agente de planificación.",
shared/locales/es.json:239:  "recovery.notice.title.recovering": "Recovering worker",
shared/locales/es.json:242:  "recovery.notice.title.workerDisconnected": "Worker disconnected",
shared/locales/es.json:246:  "recovery.notice.description.recovering": "OmniHarness is restoring the worker session or restarting from the latest checkpoint.",
shared/locales/es.json:247:  "recovery.notice.description.lostWorkerResumable": "The worker is missing from the runtime, but a saved session can be resumed.",
shared/locales/es.json:248:  "recovery.notice.description.lostWorkerRerunnable": "The worker is missing from the runtime. The run can restart from the latest user checkpoint.",
shared/locales/es.json:260:  "recovery.inspector.worker": "Worker:",
shared/locales/es.json:271:  "settings.agents.onboarding.ariaLabel": "CLI setup",
shared/locales/es.json:272:  "settings.agents.onboarding.title": "Finish CLI setup",
shared/locales/es.json:273:  "settings.agents.onboarding.description": "OmniHarness can see installed CLIs, but workers need a logged-in provider before the first run.",
shared/locales/es.json:274:  "settings.agents.onboarding.openSettings": "Agent settings",
shared/locales/es.json:275:  "settings.agents.onboarding.ready": "Ready",
shared/locales/es.json:276:  "settings.agents.onboarding.install": "Install",
shared/locales/es.json:277:  "settings.agents.onboarding.signIn": "Sign in",
shared/locales/es.json:278:  "settings.agents.onboarding.check": "Check",
shared/locales/es.json:279:  "settings.agents.onboarding.command": "Run",
shared/locales/es.json:280:  "settings.agents.onboarding.statusUnknown": "Authentication could not be verified.",
shared/locales/es.json:281:  "settings.agents.auth.notAuthenticated": "{worker} is not logged in. Run `{command}`.",
shared/locales/es.json:282:  "settings.agents.auth.unknown": "{worker} authentication could not be verified. Check `{command}`.",
shared/locales/es.json:283:  "settings.agents.auth.notInstalled": "{worker} is not installed. Install `{command}` first.",
shared/locales/es.json:297:  "planning.review.expand": "Mejorar plan con agentes de revisión",
shared/locales/es.json:298:  "planning.review.expandDescription": "Otro agente critica el plan y luego el planificador lo revisa para abordar los hallazgos.",
shared/locales/es.json:299:  "planning.review.agentLabel": "Revisor",
shared/locales/es.json:300:  "planning.review.autoHelp": "Auto selecciona un revisor disponible, prefiriendo un agente diferente al planificador.",
shared/locales/es.json:313:  "planning.review.agent.auto": "Auto",
shared/locales/es.json:314:  "planning.review.agent.same": "Mismo",
shared/locales/es.json:315:  "planning.review.agent.codex": "Codex",
shared/locales/es.json:316:  "planning.review.agent.claude": "Claude",
shared/locales/es.json:317:  "planning.review.agent.gemini": "Gemini",
shared/locales/es.json:318:  "planning.review.agent.opencode": "OpenCode",
shared/locales/es.json:320:  "conversation.composer.placeholder.planning": "Responder al agente de planificación...",
shared/locales/es.json:322:  "conversation.composer.workerModelAria": "Modelo del worker",
shared/locales/es.json:324:  "planning.agent.label": "agente de planificación",
shared/locales/es.json:335:  "notifications.error.serviceWorkerUnavailable": "OmniHarness could not start the notification service worker.",
shared/locales/es.json:365:  "workers.sidebar.collapseAria": "Collapse workers sidebar",
shared/locales/es.json:366:  "workers.sidebar.activeTab": "Active ({count})",
shared/locales/es.json:367:  "workers.sidebar.finishedTab": "Finished ({count})",
shared/locales/es.json:368:  "workers.sidebar.emptyActive": "No active workers for this conversation.",
shared/locales/es.json:369:  "workers.sidebar.emptyFinished": "No finished workers for this conversation.",
shared/locales/es.json:405:  "models.picker.searchPlaceholder": "Search models",
shared/locales/es.json:407:  "settings.agents.toggleSupervisorMemory": "Toggle supervisor memory",
shared/locales/es.json:408:  "settings.agents.supervisorMemory": "Supervisor memory",
shared/locales/es.json:409:  "settings.agents.supervisorMemoryHelp": "Let Omni remember durable project context between runs. When off, no project will read or update memory.",
shared/locales/es.json:410:  "settings.agents.autoPriority": "Auto priority",
shared/locales/es.json:411:  "settings.agents.autoPriorityHelp": "Auto uses this order when choosing and falling back between enabled coding agents.",
shared/locales/es.json:412:  "settings.agents.priorityRank": "Priority {rank}",
shared/locales/es.json:413:  "settings.agents.moveWorkerUp": "Move {worker} up",
shared/locales/es.json:414:  "settings.agents.moveWorkerDown": "Move {worker} down",
shared/locales/es.json:415:  "settings.agents.monthlyTokens": "Monthly tokens",
shared/locales/es.json:416:  "settings.agents.monthlyTokensRemaining": "{remaining} remaining",
shared/locales/es.json:417:  "settings.agents.monthlyTokensRemainingOf": "{remaining} of {limit} remaining",
shared/locales/es.json:418:  "settings.agents.monthlyTokensUsageOnly": "{used} used in 31 days; remaining not reported",
shared/locales/es.json:419:  "settings.agents.monthlyTokensUnknown": "Not reported by CLI",
shared/locales/es.json:439:  "side.window.workersTabAria": "Workers de sesión",
shared/locales/es.json:496:  "settings.credentials.providerContract": "Custom provider commands must print JSON with env, unset, and optional expiresAt. Secret values are only passed to the worker process.",
shared/locales/es.json:498:  "settings.credentials.providerScriptsHelp": "Optionally run a custom credential provider before each worker starts. Leave a worker blank to use its normal login state.",
shared/locales/es.json:499:  "settings.credentials.profilesDirHelp": "Optional folder for custom file-backed credentials. Profiles named after a worker type are used automatically.",
shared/locales/es.json:500:  "events.failover.started": "Switching workers: {outgoing} hit its quota, handing off to {incoming}.",
shared/locales/es.json:503:  "events.failover.completed": "Switched workers: {outgoing} → {incoming}.",
shared/locales/es.json:505:  "conversation.chip.switchedWorkers": "Switched workers: {outgoing} → {incoming}",
shared/locales/es.json:507:  "settings.agents.failover.title": "Quota failover",
shared/locales/es.json:508:  "settings.agents.failover.help": "When the current worker exhausts its quota mid-run, Omni hands off to the next allowed worker.",
shared/locales/es.json:526:  "supervisor.activity.phase.monitoring": "Checking worker progress",
shared/locales/es.json:534:  "supervisor.activity.activeWorkers": "Active workers",
shared/locales/es.json:535:  "supervisor.activity.openWorker": "Open {worker}",
shared/locales/es.json:536:  "supervisor.activity.worker.fallbackName": "Worker {number}",
shared/locales/es.json:537:  "supervisor.activity.worker.status.starting": "Starting",
shared/locales/es.json:538:  "supervisor.activity.worker.status.working": "Working",
shared/locales/es.json:539:  "supervisor.activity.worker.status.idle": "Waiting",
shared/locales/es.json:540:  "supervisor.activity.worker.status.stuck": "Stuck",
shared/locales/es.json:541:  "supervisor.activity.worker.status.recovering": "Recovering",
shared/locales/es.json:542:  "supervisor.activity.worker.status.generic": "{status}",
shared/locales/es.json:543:  "supervisor.activity.worker.permission": "Waiting on {count} permission decision(s).",
shared/locales/es.json:544:  "supervisor.activity.worker.stuck": "No recent progress detected. Open the worker to inspect or recover it.",
shared/locales/es.json:545:  "supervisor.activity.worker.error": "Worker error: {error}",
shared/locales/es.json:546:  "supervisor.activity.worker.starting": "Starting up.",
shared/locales/es.json:550:  "conversation.status.awaitingWorkerInput": "The worker asked for input before continuing."
shared/locales/ko.json:34:  "settings.tabs.models": "모델",
shared/locales/ko.json:35:  "settings.tabs.agents": "에이전트",
shared/locales/ko.json:39:  "theme.mode.switchDay": "데이 모드로 전환",
shared/locales/ko.json:40:  "theme.mode.switchNight": "나이트 모드로 전환",
shared/locales/ko.json:52:  "settings.models.tabs.supervisorCredentials": "슈퍼바이저 자격 증명",
shared/locales/ko.json:53:  "settings.models.tabs.fallbackCredentials": "대체 자격 증명",
shared/locales/ko.json:54:  "settings.models.tabs.memoryCredentials": "Memory Summary",
shared/locales/ko.json:55:  "settings.models.supervisorTitle": "슈퍼바이저 LLM",
shared/locales/ko.json:56:  "settings.models.fallbackTitle": "대체 LLM",
shared/locales/ko.json:57:  "settings.models.memoryTitle": "Memory Summary LLM",
shared/locales/ko.json:58:  "settings.models.memory.useCustom": "Use custom memory summary model",
shared/locales/ko.json:59:  "settings.models.memory.inheritHelp": "Off uses the same model selected for the supervisor.",
shared/locales/ko.json:60:  "settings.models.creditStrategy.label": "크레딧 / 장애 조치 전략",
shared/locales/ko.json:61:  "settings.models.creditStrategy.swapAccount": "계정 전환",
shared/locales/ko.json:62:  "settings.models.creditStrategy.fallbackApi": "대체 API",
shared/locales/ko.json:63:  "settings.models.creditStrategy.waitForReset": "초기화 …252144 tokens truncated…1:  - The bridge is working but persisted worker entries are stale.
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:192:  - Persisted worker entries exist but `WorkerEntriesManager` has not loaded
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:202:  - `workers`
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:206:  - bridge `/agents`
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:207:  - worker stream under `getAppDataPath("run-data")`
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:209:- The worker stream is the transcript source of truth. Bridge runtime output is
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:217:- Direct worker stream loading fetches entries by `afterSeq` and reaches the
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:223:### 6. Stale worker streams can hide real user messages
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:228:- The `messages` table contained the user message, but the worker JSONL started
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:229:  with lifecycle/agent entries and had no matching opening `user_input`.
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:235:- The unified worker stream is the transcript authority, but legacy/historical
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:245:- The worker stream remains the authority for worker-backed transcripts.
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:248:  the selected worker stream is loaded. Before that, the stream may still be
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:261:  chronological order relative to agent/tool entries.
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:269:- One or two seconds later, the agent/tool entries that belonged between those
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:276:- The UI allowed durable DB user rows to render before the worker stream had
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:284:- Never render future `messages` rows ahead of an unloaded worker stream.
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:286:  from a mirror table and later splice worker content into the middle.
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:288:  WorkerEntriesManager.isLoaded(workerId)`, not merely "we have messages".
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:295:  multi-turn worker conversation.
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:297:  user rows ahead of unknown worker output.
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:378:1. Query `runs` for the id and record `mode`, `status`, `created_at`,
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:380:2. Query `workers` for the run and record `status`, bridge session id,
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:387:6. Compare persisted worker stream entries with bridge runtime output.
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:390:Do not infer duplication from visible worker text alone. The proof of duplicate
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:392:worker stream. If those are absent, say that clearly.
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:422:- Persist worker content through the unified worker stream.
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:423:- Render worker content through `WorkerEntriesManager` and `Terminal` entries.
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:425:- If bridge output exists but the worker stream does not, fix persistence or
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:427:- Use `messages` fallback rows only after the relevant worker stream is loaded.
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:431:  never appear ahead of unknown worker content.
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:456:- A run may be `awaiting_user` only when the latest visible worker response is
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:493:- Rendering worker text from both bridge output and persisted stream in the
docs/architecture/state-staleness-and-session-lifecycle-lessons.md:495:- Rendering fallback DB user rows before the worker stream is loaded.
src/server/agent-runtime/manager.ts:9:import * as acp from "@agentclientprotocol/sdk";
src/server/agent-runtime/manager.ts:41:} from "./worker-pool";
src/server/agent-runtime/manager.ts:62:// model fetch, etc.). The previous default caused recovery attempts
src/server/agent-runtime/manager.ts:82:function defaultCommandFor(type: string, model: string | null): { command: string; args: string[] } | null {
src/server/agent-runtime/manager.ts:85:      return { command: "gemini", args: ["--experimental-acp", ...(model ? ["--model", model] : [])] };
src/server/agent-runtime/manager.ts:87:      return { command: "claude-agent-acp", args: [] };
src/server/agent-runtime/manager.ts:91:      return { command: "opencode", args: ["acp", ...(model ? ["--model", model] : [])] };
src/server/agent-runtime/manager.ts:142:  // worker process does not see the user's global ~/.claude state and the
src/server/agent-runtime/manager.ts:221:function buildSessionMeta(agentType: string | undefined, skillRoots: string[]) {
src/server/agent-runtime/manager.ts:226:  if (agentType === "claude") {
src/server/agent-runtime/manager.ts:471:function materializeSkillRoots(cwd: string, workerName: string, skillRoots: string[], env: EnvLike): string[] {
src/server/agent-runtime/manager.ts:476:  const skillsDir = join(cwd, ".agents", "skills");
src/server/agent-runtime/manager.ts:477:  mkdirSync(skillsDir, { recursive: true });
src/server/agent-runtime/manager.ts:486:        const linkBase = `omniharness-${sanitizePathPart(workerName)}-${sanitizePathPart(basename(skillDir))}`;
src/server/agent-runtime/manager.ts:487:        let linkPath = join(skillsDir, linkBase);
src/server/agent-runtime/manager.ts:490:          linkPath = join(skillsDir, `${linkBase}-${suffix}`);
src/server/agent-runtime/manager.ts:511:      // Best-effort cleanup for worker-scoped temporary skill links.
src/server/agent-runtime/manager.ts:624:        : "Configure an ACP-compatible command for this worker.";
src/server/agent-runtime/manager.ts:634:    `failed to start ${input.type} agent via ${input.command}: ${describeUnknownError(input.error)}`,
src/server/agent-runtime/manager.ts:763:    // Mode switches (e.g. exiting plan mode via "Ready to code?") change how the
src/server/agent-runtime/manager.ts:764:    // agent operates and are always the user's call — never auto-approve them, even
src/server/agent-runtime/manager.ts:765:    // in full-access/YOLO mode where every other permission is bypassed.
src/server/agent-runtime/manager.ts:785:  // generic ext-method escape hatch. This is how the claude-agent-acp adapter
src/server/agent-runtime/manager.ts:800:    // URL-mode elicitations need a browser surface we don't advertise; only form
src/server/agent-runtime/manager.ts:801:    // mode (AskUserQuestion) is supported. Decline anything else so the turn
src/server/agent-runtime/manager.ts:803:    if (params.mode && params.mode !== "form") {
src/server/agent-runtime/manager.ts:815:    // Full-access (supervisor-managed) modes run without an interactive UI to
src/server/agent-runtime/manager.ts:817:    // and the agent keeps going — rather than blocking on input no one will send.
src/server/agent-runtime/manager.ts:862:    if (update.sessionUpdate === "agent_message_chunk") {
src/server/agent-runtime/manager.ts:874:    if (update.sessionUpdate === "agent_thought_chunk") {
src/server/agent-runtime/manager.ts:915:// JSON-RPC method the claude-agent-acp adapter calls to present a form
src/server/agent-runtime/manager.ts:916:// elicitation (the built-in AskUserQuestion tool). Not modeled by the pinned
src/server/agent-runtime/manager.ts:970:function isFullAccessPermissionMode(mode: string | null) {
src/server/agent-runtime/manager.ts:971:  return mode === "full-access" || mode === "danger-full-access";
src/server/agent-runtime/manager.ts:974:// A `switch_mode` permission asks to change the agent's operating mode (the
src/server/agent-runtime/manager.ts:975:// plan-mode → code-mode "Ready to code?" handoff). This is a deliberate user
src/server/agent-runtime/manager.ts:976:// gate and must never be auto-approved, regardless of session permission mode.
src/server/agent-runtime/manager.ts:979:  return asNonEmptyString(toolCall?.kind) === "switch_mode";
src/server/agent-runtime/manager.ts:982:function findPermissionOptionId(params: acp.RequestPermissionRequest, mode: "approve" | "deny", explicitOptionId?: string) {
src/server/agent-runtime/manager.ts:986:  const preferred = mode === "approve"
src/server/agent-runtime/manager.ts:1043:  readonly agents = new Map<string, AgentRecord>();
src/server/agent-runtime/manager.ts:1045:  private readonly workerPool = new WorkerPool();
src/server/agent-runtime/manager.ts:1056:  private readonly agentIdleTimeoutMs: number;
src/server/agent-runtime/manager.ts:1057:  private readonly agentExitGraceMs: number;
src/server/agent-runtime/manager.ts:1070:      this.workerPool.setMaxPerKey(parsed);
src/server/agent-runtime/manager.ts:1072:      this.workerPool.setMaxPerKey(1);
src/server/agent-runtime/manager.ts:1074:    this.workerPool.setMaxTotal(
src/server/agent-runtime/manager.ts:1081:    this.agentIdleTimeoutMs = readPositiveInteger(
src/server/agent-runtime/manager.ts:1085:    this.agentExitGraceMs = readPositiveInteger(
src/server/agent-runtime/manager.ts:1108:        agents: this.agents.size,
src/server/agent-runtime/manager.ts:1109:        poolMembers: this.workerPool.countAll(),
src/server/agent-runtime/manager.ts:1159:      const poolMembersBefore = this.workerPool.countAll();
src/server/agent-runtime/manager.ts:1161:        ? this.workerPool.evictAll()
src/server/agent-runtime/manager.ts:1173:        activeAgents: this.agents.size,
src/server/agent-runtime/manager.ts:1182:          ? `System resources are critically low. OmniHarness evicted ${evictedPoolMembers} prewarmed worker${evictedPoolMembers === 1 ? "" : "s"} and will refuse new workers until resources recover.`
src/server/agent-runtime/manager.ts:1183:          : "System resources are low. OmniHarness will refuse new workers until resources recover.",
src/server/agent-runtime/manager.ts:1195:      this.workerPool.sweepExpired(this.poolMemberMaxAgeMs);
src/server/agent-runtime/manager.ts:1200:    for (const [name, record] of this.agents) {
src/server/agent-runtime/manager.ts:1204:      if (now - updatedAt < this.agentIdleTimeoutMs) continue;
src/server/agent-runtime/manager.ts:1207:          `[runtime-sweep] failed to reap idle agent ${name}: ${describeUnknownError(error)}\n`,
src/server/agent-runtime/manager.ts:1218:    const activeAgents = Array.from(this.agents.values())
src/server/agent-runtime/manager.ts:1223:    const poolMembers = this.workerPool.countAll();
src/server/agent-runtime/manager.ts:1230:    const evictedPoolMembers = this.workerPool.evictAll();
src/server/agent-runtime/manager.ts:1247:      const record = this.agents.get(name);
src/server/agent-runtime/manager.ts:1249:      // Only reap if the record is still in a terminal state. If the agent was
src/server/agent-runtime/manager.ts:1252:      this.agents.delete(name);
src/server/agent-runtime/manager.ts:1253:    }, this.agentExitGraceMs);
src/server/agent-runtime/manager.ts:1318:    return Array.from(this.agents.values()).map((agent) => this.toStatus(agent));
src/server/agent-runtime/manager.ts:1322:    const record = this.agents.get(name);
src/server/agent-runtime/manager.ts:1327:    const record = this.agents.get(name);
src/server/agent-runtime/manager.ts:1372:    const existing = this.agents.get(name);
src/server/agent-runtime/manager.ts:1385:    const requestedModel = input.model?.trim() || null;
src/server/agent-runtime/manager.ts:1388:    const configuredAgent = this.options.config?.agents?.[type];
src/server/agent-runtime/manager.ts:1391:      ...asStringArray(configuredAgent?.skillRoots, `agents.${type}.skillRoots`),
src/server/agent-runtime/manager.ts:1395:      ...normalizeMcpServers(configuredAgent?.mcpServers, `agents.${type}.mcpServers`),
src/server/agent-runtime/manager.ts:1403:        defaultArgs.push("--model", requestedModel);
src/server/agent-runtime/manager.ts:1407:        model: requestedModel,
src/server/agent-runtime/manager.ts:1436:    const requestedMode = input.mode || configuredAgent?.mode;
src/server/agent-runtime/manager.ts:1452:          model: requestedModel,
src/server/agent-runtime/manager.ts:1453:          mode: requestedMode ?? null,
src/server/agent-runtime/manager.ts:1459:    const pooledMember = poolKey ? this.workerPool.checkout(poolKey) : null;
src/server/agent-runtime/manager.ts:1482:      client = new RuntimeClient(() => recordRef.current, (agentName, chunk) => this.publishChunk(agentName, chunk));
src/server/agent-runtime/manager.ts:1486:          ? [{ command: "claude-agent-acp", args: [] as string[] }]
src/server/agent-runtime/manager.ts:1488:            ? [{ command: "gemini", args: ["--experimental-acp", ...(requestedModel ? ["--model", requestedModel] : [])] as string[] }]
src/server/agent-runtime/manager.ts:1499:        throw new RuntimeHttpError(400, `No runnable command is available for worker type "${type}".`);
src/server/agent-runtime/manager.ts:1526:            agentType: type,
src/server/agent-runtime/manager.ts:1541:        throw normalizeAgentStartupError({ type, command: defaultCommand, error: lastError ?? new Error("failed to start agent"), stderrBuffer });
src/server/agent-runtime/manager.ts:1551:    const modesRecord = asRecord(sessionRecord?.modes);
src/server/agent-runtime/manager.ts:1552:    const currentModeId = asNonEmptyString(modesRecord?.currentModeId);
src/server/agent-runtime/manager.ts:1553:    if (connection && shouldSetRequestedMode(requestedMode, currentModeId, modesRecord?.availableModes)) {
src/server/agent-runtime/manager.ts:1557:          modeId: requestedMode,
src/server/agent-runtime/manager.ts:1560:      } catch (modeError: unknown) {
src/server/agent-runtime/manager.ts:1561:        process.stderr.write(`[${name}] setSessionMode("${requestedMode}") failed: ${describeUnknownError(modeError)}\n`);
src/server/agent-runtime/manager.ts:1606:    this.agents.set(name, record);
src/server/agent-runtime/manager.ts:1609:      const target = this.agents.get(name);
src/server/agent-runtime/manager.ts:1621:      // the record stays in this.agents forever, retaining its output buffer,
src/server/agent-runtime/manager.ts:1630:        model: requestedModel,
src/server/agent-runtime/manager.ts:1631:        mode: requestedMode ?? null,
src/server/agent-runtime/manager.ts:1641:    const record = this.agents.get(name);
src/server/agent-runtime/manager.ts:1667:      this.agents.delete(name);
src/server/agent-runtime/manager.ts:1673:    const record = this.agents.get(name);
src/server/agent-runtime/manager.ts:1725:    const record = this.agents.get(name);
src/server/agent-runtime/manager.ts:1742:    const record = this.agents.get(name);
src/server/agent-runtime/manager.ts:1790:  async setMode(name: string, mode: string) {
src/server/agent-runtime/manager.ts:1791:    const record = this.agents.get(name);
src/server/agent-runtime/manager.ts:1796:    const setModeParams = { sessionId: record.sessionId, modeId: mode } as Parameters<acp.ClientSideConnection["setSessionMode"]>[0];
src/server/agent-runtime/manager.ts:1798:    record.sessionMode = mode;
src/server/agent-runtime/manager.ts:1800:    // Switching into a full-access mode means every *new* permission request is
src/server/agent-runtime/manager.ts:1802:    // while the session was in an interactive mode would otherwise linger in
src/server/agent-runtime/manager.ts:1803:    // pendingPermissions forever: the agent's tool call stays blocked on a
src/server/agent-runtime/manager.ts:1805:    // warning even though the mode now grants everything automatically. Drain
src/server/agent-runtime/manager.ts:1807:    const autoApprovedPending = isFullAccessPermissionMode(mode)
src/server/agent-runtime/manager.ts:1810:    return { ok: true, name: record.name, mode, autoApprovedPending };
src/server/agent-runtime/manager.ts:1822:    const record = this.agents.get(name);
src/server/agent-runtime/manager.ts:1854:    model?: string | null;
src/server/agent-runtime/manager.ts:1855:    mode?: string | null;
src/server/agent-runtime/manager.ts:1862:    const requestedModel = input.model?.trim() || null;
src/server/agent-runtime/manager.ts:1863:    const configuredAgent = this.options.config?.agents?.[type];
src/server/agent-runtime/manager.ts:1866:      ...normalizeMcpServers(configuredAgent?.mcpServers, `agents.${type}.mcpServers`),
src/server/agent-runtime/manager.ts:1894:    const requestedMode = input.mode || configuredAgent?.mode || null;
src/server/agent-runtime/manager.ts:1898:      model: requestedModel,
src/server/agent-runtime/manager.ts:1899:      mode: requestedMode,
src/server/agent-runtime/manager.ts:1917:    if (!this.workerPool.tryBeginWarm(poolKey)) {
src/server/agent-runtime/manager.ts:1918:      return { ok: true, key: poolKey, size: this.workerPool.countMembers(poolKey), warmed: false };
src/server/agent-runtime/manager.ts:1923:      const client = new RuntimeClient(() => recordRef.current, (agentName, chunk) => this.publishChunk(agentName, chunk));
src/server/agent-runtime/manager.ts:1940:        agentType: type,
src/server/agent-runtime/manager.ts:1955:      this.workerPool.add({
src/server/agent-runtime/manager.ts:1971:      return { ok: true, key: poolKey, size: this.workerPool.countMembers(poolKey), warmed: true };
src/server/agent-runtime/manager.ts:1973:      this.workerPool.endInFlight(poolKey);
src/server/agent-runtime/manager.ts:1980:    model: string | null;
src/server/agent-runtime/manager.ts:1981:    mode: string | null;
src/server/agent-runtime/manager.ts:1987:        process.stderr.write(`[worker-pool] refill failed (${input.type}): ${describeUnknownError(error)}\n`);
src/server/agent-runtime/manager.ts:1993:    this.workerPool.shutdown();
src/server/agent-runtime/manager.ts:2018:    agentType?: string;
src/server/agent-runtime/manager.ts:2036:        throw new RuntimeHttpError(400, `failed to spawn agent process: ${describeUnknownError(error)}`);
src/server/agent-runtime/manager.ts:2038:      this.memoryTracer.onSpawn(child, input.agentType ?? "unknown", {
src/server/agent-runtime/manager.ts:2047:          reject(new RuntimeHttpError(400, `failed to spawn agent process: ${error.message}`));
src/server/agent-runtime/manager.ts:2050:          reject(new RuntimeHttpError(400, `agent process exited before ACP startup completed (code=${code}, signal=${signal})`));
src/server/agent-runtime/manager.ts:2078:            // Advertise form elicitation so the claude-agent-acp adapter
src/server/agent-runtime/manager.ts:2091:        const sessionMeta = buildSessionMeta(input.agentType, input.skillRoots);
src/server/agent-runtime/manager.ts:2127:    // Newer ACP adapter builds (e.g. @agentclientprotocol/claude-agent-acp)
src/server/agent-runtime/manager.ts:2231:    const record = this.agents.get(name);
src/server/agent-runtime/manager.ts:2274:          ? "claude-agent-acp"
src/server/agent-runtime/memory-trace.ts:10: *   - "spawn"    : when a child agent process is registered for tracking
src/server/agent-runtime/memory-trace.ts:26:  agents: number;
src/server/agent-runtime/memory-trace.ts:140:        agents: counts.agents,
docs/architecture/routing-decision.md:13:- `src/app/api/agents/catalog/route.ts`

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:35:26.616Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:35:26.616Z

The repository already has the exact lifecycle constraints this feature needs: named events, SSE replay, worker stream authority, and existing planning-review concepts. I’m narrowing from the broad search into the mode, review, manager, and route files so the plan can name concrete files and invariants.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:35:26.617Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:35:26.617Z

```json
{
  "cmd": "rg -n \"conversation\\.mode|planning\\.review|PlanReview|reviewRun|review run|reviewFindings|reviewFindings|planItems|mode: \\\"planning\\\"|mode: \\\"implementation\\\"|implementation\" src/app src/server shared tests/lifecycle -g '!**/*.json'",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 50000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:35:26.617Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:35:26.617Z

```json
{
  "cmd": "rg --files src/app src/server shared tests/lifecycle | rg '(planning|review|plan|conversation|worker|named-events|events|mode|i18n|locale)'",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:35:26.617Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:35:26.617Z

```json
{
  "cmd": "find src/app/home src/app/api src/server -maxdepth 3 -type f | sort | sed -n '1,240p'",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:35:26.694Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:35:26.694Z

```json
{
  "cmd": "git status --short; git rev-parse --short HEAD",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:35:26.716Z","phase":null} -->
## Tool result: call_C3LwibcYahIHKyJAL4oUcAPB · 2026-06-14T16:35:26.716Z

```text
Chunk ID: 11c901
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 7139
Output:
tests/lifecycle/scenarios/plan-improvement-flow.test.ts:107:    mode: "planning",
tests/lifecycle/scenarios/plan-improvement-flow.test.ts:147:  it("starts a review run, emits plan.review.started + worker.spawned, survives a restart", { timeout: 30_000 }, async () => {
tests/lifecycle/scenarios/plan-improvement-flow.test.ts:184:    // The DB still holds the review run row — restart preserves persisted state.
src/server/planning/review-prompts.ts:19:Your goal is to evaluate the proposed implementation plan and specification against the original user intent.
src/server/planning/review-prompts.ts:23:- DO NOT run any implementation steps or commands (other than reading if needed).
src/server/planning/review-prompts.ts:25:- DO NOT promote the plan to implementation.
src/server/planning/review-prompts.ts:82:Please revise the specification and implementation plan to address these findings.
tests/lifecycle/scenarios/worker-spawn-failure.test.ts:78:      body: JSON.stringify({ mode: "planning", command: "this will fail to spawn" }),
src/server/supervisor/observer.ts:136:  if (args.run.mode !== "implementation") {
src/server/supervisor/observer.ts:893:        summary: `Skipping ${worker.id} because newer implementation worker ${supersedingWorker.id} superseded it.`,
tests/lifecycle/scenarios/session-types.test.ts:3: * called out: direct, planning, implementation.
tests/lifecycle/scenarios/session-types.test.ts:121:async function createConversation(mode: "direct" | "planning" | "implementation", command: string) {
tests/lifecycle/scenarios/session-types.test.ts:179:  it("implementation: creates a run and hands off to the supervisor (no immediate worker.spawned)", async () => {
tests/lifecycle/scenarios/session-types.test.ts:183:    const { runId } = await createConversation("implementation", "implement Y");
tests/lifecycle/scenarios/session-types.test.ts:185:    // We deliberately do NOT assert worker.spawned here — implementation
tests/lifecycle/scenarios/session-types.test.ts:190:    expect(runRow?.mode).toBe("implementation");
src/server/planning/promote.ts:62:    throw new Error("The selected plan is not ready for implementation");
src/server/planning/promote.ts:75:    throw new Error(`The selected plan needs a rewrite before implementation: ${record.verdict.headline}`);
src/server/planning/promote.ts:83:    throw new Error("The selected plan is not ready for implementation");
src/server/planning/promote.ts:109:    mode: "implementation",
src/server/supervisor/resume.ts:15:    run?.mode === "implementation"
src/server/planning/review.ts:73:    console.warn("[planning/review] reconciling orphaned review run", {
src/server/planning/review.ts:201:    throw new Error("A review run is already active.");
src/server/planning/review.ts:210:  const reviewRunId = randomUUID();
src/server/planning/review.ts:213:    id: reviewRunId,
src/server/planning/review.ts:225:    reviewRunId,
src/server/planning/review.ts:229:  orchestratePlanningReview(reviewRunId).catch((err) => {
src/server/planning/review.ts:230:    console.error(`Review orchestration failed for ${reviewRunId}:`, err);
src/server/planning/review.ts:233:  return { reviewRunId, status: "running" };
src/server/planning/review.ts:236:async function orchestratePlanningReview(reviewRunId: string) {
src/server/planning/review.ts:237:  const reviewRun = await db.select().from(planningReviewRuns).where(eq(planningReviewRuns.id, reviewRunId)).get();
src/server/planning/review.ts:238:  if (!reviewRun) return;
src/server/planning/review.ts:240:  const run = await db.select().from(runs).where(eq(runs.id, reviewRun.runId)).get();
src/server/planning/review.ts:244:    for (let i = 0; i < reviewRun.roundsRequested; i++) {
src/server/planning/review.ts:254:        agentSelection: reviewRun.agentSelection as PlanningReviewAgentSelection,
src/server/planning/review.ts:262:        reviewRunId,
src/server/planning/review.ts:363:            reviewRunId,
src/server/planning/review.ts:480:      }).where(eq(planningReviewRuns.id, reviewRunId));
src/server/planning/review.ts:491:    }).where(eq(planningReviewRuns.id, reviewRunId));
src/server/planning/review.ts:495:      reviewRunId,
src/server/planning/review.ts:504:    console.error("[planning/review] orchestration failed", { reviewRunId, runId: run.id, error: message });
src/server/planning/review.ts:509:    }).where(eq(planningReviewRuns.id, reviewRunId));
src/server/planning/review.ts:519:      reviewRunId,
tests/lifecycle/scenarios/artifact-backed-snapshot.test.ts:21:  planItems,
tests/lifecycle/scenarios/artifact-backed-snapshot.test.ts:54:    await db.delete(planItems);
tests/lifecycle/scenarios/artifact-backed-snapshot.test.ts:61:    await db.delete(planItems);
src/server/supervisor/index.ts:59:type WorkerRole = "implementation" | "validation";
src/server/supervisor/index.ts:338:    "Before I start implementation, please confirm this is the intended job:",
src/server/supervisor/index.ts:349:  messageKind: "clarification" | "implementation_confirmation";
src/server/supervisor/index.ts:350:  eventType: "clarification_requested" | "implementation_confirmation_requested" | "preflight_confirmation_required";
src/server/supervisor/index.ts:417:    messageKind: "implementation_confirmation",
src/server/supervisor/index.ts:740:  const role: WorkerRole = describesValidationIntent(...values) ? "validation" : "implementation";
src/server/supervisor/index.ts:750:    role: worker.workerRole === "validation" || worker.workerRole === "implementation"
src/server/supervisor/index.ts:789:    summary: `Parked completed-looking implementation worker ${args.worker.id} before validator spawn.`,
src/server/supervisor/index.ts:811:    return workerAllocation.role === "implementation" && requestedAllocation.role === "validation";
src/server/supervisor/index.ts:1057:    return run?.mode === "implementation" && normalizeRunStatus(run.status) === "awaiting_user"
src/server/supervisor/index.ts:1256:              && blockingAllocation.role === "implementation"
src/server/supervisor/index.ts:1688:          const messageKind = isImplementationConfirmation ? "implementation_confirmation" : "clarification";
src/server/supervisor/index.ts:1693:            eventType: isImplementationConfirmation ? "implementation_confirmation_requested" : "clarification_requested",
src/server/supervisor/index.ts:1739:                `I need clarification before implementation can continue:\n\n${readiness.questions.map((question) => `- ${question}`).join("\n")}`,
tests/lifecycle/scenarios/worker-reattach.test.ts:78:    // Mark the run as running implementation so the observer treats it
tests/lifecycle/scenarios/worker-reattach.test.ts:80:    await db.update(runs).set({ mode: "implementation", status: "working" }).where(
src/server/planning/artifacts.ts:161:    parsed.name.replace(/-implementation$/, "-design"),
tests/lifecycle/scenarios/supervisor-stopped.test.ts:59:    await db.update(runs).set({ mode: "implementation", status: "working" }).where(
src/server/planning/review-artifact-store.ts:35:  reviewRunId: string;
src/server/planning/review-artifact-store.ts:50:  reviewRunId: string;
src/server/planning/review-artifact-store.ts:117:    reviewRunId: input.reviewRunId,
src/server/planning/review-artifact-store.ts:164:export async function listPlanningReviewFindingsForReviewRun(reviewRunId: string): Promise<PlanningReviewFindingRow[]> {
src/server/planning/review-artifact-store.ts:168:    .where(eq(planningReviewFindings.reviewRunId, reviewRunId))
src/server/supervisor/tools.ts:91:        `Use independent validator workers to check mocked paths, fake controls, placeholder implementations, and whether the real user-facing path works. ` +
src/server/supervisor/tools.ts:92:        `If a validator finds gaps, use worker_continue on the original implementation worker with interventionType "completion_gap" when possible instead of spawning a fresh implementer. ` +
src/server/supervisor/tools.ts:160:        "Ask the user a clarifying question that is NOT a checkpoint asking whether to begin or continue implementation. For preflight intent confirmation or any 'is the plan ready, shall I start implementing?' checkpoint, use confirm_ready_to_implement instead so the UI can render quick confirm/clarify buttons. Never use this to ask the user to fill in the preflight five-field checklist; extract those fields from the plan/spec yourself and ask only for truly missing facts.",
src/server/supervisor/tools.ts:169:        "Pause the run and ask the user whether implementation should begin. Use this for preflight intent confirmation, after presenting a plan summary, and any other 'shall I proceed to implement this?' checkpoint. The UI renders 'Yes, implement it' / 'No, let me clarify' buttons under this question, so the question text should be self-contained: summarize the understood outcomes and success conditions and explicitly invite the user to confirm or correct before implementation starts. Do not use ask_user for this case.",
src/server/plans/checklist.ts:3:import { planItems } from "../db/schema";
src/server/plans/checklist.ts:22:    const existing = await db.select().from(planItems).where(eq(planItems.id, id)).get();
src/server/plans/checklist.ts:25:      await db.insert(planItems).values({
src/server/plans/checklist.ts:40:      .update(planItems)
src/server/plans/checklist.ts:48:      .where(eq(planItems.id, id));
src/server/plans/checklist.ts:53:  return db.select().from(planItems).where(eq(planItems.planId, planId));
src/server/plans/readiness-pipeline.ts:105:    return "Plan detected — review the file below before starting implementation.";
src/server/plans/readiness-pipeline.ts:112:  return `Plan detected — ${concerns.join("; ")}. Review before implementation.`;
src/server/supervisor/runtime-watchdog.ts:19:  return run.mode === "implementation"
src/server/supervisor/runtime-watchdog.ts:82:    eq(runs.mode, "implementation"),
src/server/plans/readiness-llm.ts:46:const READINESS_SYSTEM_PROMPT = `You judge whether a software implementation plan is concrete enough to start coding from.
src/server/plans/readiness-llm.ts:65:- "ready": developer can confidently start implementation. Minor wishes allowed in concerns; the plan does not block.
tests/lifecycle/harness/fixtures.ts:53:    mode: "planning",
src/server/db/index.ts:48:  mode text NOT NULL DEFAULT 'implementation',
src/server/db/index.ts:472:  await client.execute("ALTER TABLE runs ADD COLUMN mode text NOT NULL DEFAULT 'implementation';");
src/server/cli/options.ts:66:      mode = "implementation";
src/server/cli/options.ts:133:    && (mode === "implementation" || !modeWasSpecified);
src/server/cli/options.ts:136:    mode = "implementation";
src/server/db/schema.ts:15:  mode: text('mode').notNull().default('implementation'),
src/server/db/schema.ts:234:export const planItems = sqliteTable('plan_items', {
src/server/db/schema.ts:260:  planItemId: text('plan_item_id').references(() => planItems.id).notNull(),
src/server/db/schema.ts:270:  planItemId: text('plan_item_id').references(() => planItems.id),
src/server/db/schema.ts:320:  reviewRunId: text('review_run_id').notNull().references(() => planningReviewRuns.id),
src/server/db/schema.ts:337:  reviewRunId: text('review_run_id').notNull().references(() => planningReviewRuns.id),
src/server/prompts/supervisor.md:22:- Treat the original user intent as the highest-level objective for the run. The plan, checklist, and worker reports are evidence and implementation guidance, not the definition of done by themselves.
src/server/prompts/supervisor.md:26:- You may ask as many clarification turns as needed to understand the task and carry it out fully. This applies while supervising planning work and implementation work. It does not apply to direct control conversations where the supervisor is not engaged.
src/server/prompts/supervisor.md:33:- You must extract the user's intent from the plan before starting implementation.
src/server/prompts/supervisor.md:34:- You must summarize what you understand the job to be before asking the user to confirm implementation.
src/server/prompts/supervisor.md:43:- Audit the plan against the extracted intent before kickoff. If the plan, executed exactly, would not deliver the five fields above, either steer the planner to extend it or raise the gap with the user. Do not start implementation against a plan you already know is short of intent.
src/server/prompts/supervisor.md:44:- Use confirm_ready_to_implement (NOT ask_user) for the implementation-start checkpoint. Present the five fields as structured fields, not a single prose paragraph — the user reads structure faster and corrects faster. The UI uses confirm_ready_to_implement to offer 'Yes, implement it' / 'No, let me clarify' quick actions. Reserve ask_user for clarifying questions that are not implementation-start checkpoints.
src/server/prompts/supervisor.md:52:- When an implementation worker emits stopReason "end_turn" or otherwise claims completion ("I have successfully completed…", "All tasks done", "Implementation complete", etc.), your ONLY allowed first response is `worker_spawn` for a fresh validator worker. You MUST NOT call `worker_continue` on the implementer, `mark_complete`, or `end_turn` until a validator has independently confirmed or refuted the claim. Sending a "Please continue" nudge in this state is a bug — the worker said it's done, and you have no evidence to the contrary; spawn the validator and let it produce the evidence.
src/server/prompts/supervisor.md:53:- Before calling mark_complete on anything beyond a tiny mechanical edit, spawn a separate validator CLI worker to independently verify that the plan and original user intent were really implemented. This is the default expectation, not an optional extra. The implementation worker's own claim of completion does not count as validation.
src/server/prompts/supervisor.md:57:- Tell validator workers to look specifically for mocked path substitutions, fake control surfaces, placeholder implementations, hardcoded happy paths, disabled validation, skipped error states, and UI controls that appear wired but do not perform the promised action.
src/server/prompts/supervisor.md:58:- Do not accept tests that only prove a mock, fixture, or canned response works when the user's intent requires real functionality. If a validator finds a mocked path, fake control, or unmet acceptance criterion, continue the main worker until the real implementation exists and is reverified.
src/server/prompts/supervisor.md:59:- When a validator finds incomplete work, route the validator's concrete findings back to the original implementation worker with worker_continue and interventionType "completion_gap" when that worker is still available. Start a fresh implementation worker only if the original worker cannot be resumed or is clearly unusable.
src/server/prompts/supervisor.md:66:- Use `/goal` whenever the worker has a concrete, multi-step objective with clear completion criteria — full plan implementation, bug fixes that require investigation + fix + verification, validator passes that must confirm or refute completion.
src/server/prompts/supervisor.md:73:- Prefer multiple implementation workers when the work has independent, non-overlapping slices that can run in parallel without blocking each other, such as backend/API plus separate UI, tests/verification plus implementation, or separate packages with clear ownership boundaries.
src/server/prompts/supervisor.md:76:- Treat validator/checker workers as a separate role from implementation workers. A validator should check completed-looking work and report gaps; it should not become the new default implementer.
src/server/prompts/supervisor.md:77:- When spawning multiple implementation workers, give each one explicit ownership, explain that other workers may be active, and tell it not to revert or overwrite others' work.
src/server/prompts/planner.md:3:Your job is to help the user inspect the repository, ask clarifying questions when needed, and write a spec and implementation plan from scratch.
src/server/prompts/planner.md:9:- Skip questions only when the request is already concrete enough to produce a safe spec and implementation plan.
src/server/prompts/planner.md:10:- Write a spec file and an implementation plan file.
src/server/prompts/planner.md:11:- Capture the high-level objective in the spec or plan so implementation supervision can judge completion against the user's intent, not only against checklist wording.
src/server/prompts/planner.md:13:- Always write spec and plan files using absolute paths under that project root. Do not write planning artifacts into your own sandbox, temp directory, or any path outside the project root — implementation will not be able to find them there.
src/server/prompts/planner.md:18:- Do not start implementation.
src/server/conversations/sync.ts:187:  return run.mode === "implementation"
src/server/conversations/sync.ts:195:  return run.mode === "implementation"
src/server/conversations/sync.ts:432:    if (run.mode === "implementation") {
src/server/conversations/sync.ts:433:      const implementationWorkers = allWorkers.filter((candidate) => candidate.runId === run.id);
src/server/conversations/sync.ts:436:      for (const implementationWorker of implementationWorkers) {
src/server/conversations/sync.ts:437:        const implementationAgent = agents.find((candidate) => candidate.name === implementationWorker.id);
src/server/conversations/sync.ts:439:          implementationAgent
src/server/conversations/sync.ts:440:          && implementationWorker.bridgeSessionId
src/server/conversations/sync.ts:441:          && implementationWorker.bridgeSessionMode
src/server/conversations/sync.ts:442:          && implementationAgent.sessionId === implementationWorker.bridgeSessionId
src/server/conversations/sync.ts:443:          && implementationAgent.sessionMode === implementationWorker.bridgeSessionMode,
src/server/conversations/sync.ts:445:        if (isCancelledWorkerStatus(implementationWorker.status)
src/server/conversations/sync.ts:449:        if (!implementationAgent || !isCleanLiveAgent(implementationAgent) || !isActiveLiveAgent(implementationAgent)) {
src/server/conversations/sync.ts:453:        await writeWorkerOutputEntries(run.id, implementationWorker.id, implementationAgent.outputEntries);
src/server/conversations/sync.ts:455:          status: implementationAgent.state,
src/server/conversations/sync.ts:456:          cwd: implementationAgent.cwd || implementationWorker.cwd,
src/server/conversations/sync.ts:457:          currentText: implementationAgent.currentText,
src/server/conversations/sync.ts:458:          lastText: implementationAgent.lastText,
src/server/conversations/sync.ts:459:          bridgeSessionId: implementationAgent.sessionId ?? implementationWorker.bridgeSessionId,
src/server/conversations/sync.ts:460:          bridgeSessionMode: implementationAgent.sessionMode ?? implementationWorker.bridgeSessionMode,
src/server/conversations/sync.ts:462:        }).where(eq(workers.id, implementationWorker.id));
src/server/conversations/sync.ts:484:      const implementationWorker = implementationWorkers[0];
src/server/conversations/sync.ts:485:      const implementationAgent = implementationWorker
src/server/conversations/sync.ts:486:        ? agents.find((candidate) => candidate.name === implementationWorker.id)
src/server/conversations/sync.ts:488:      if (!implementationWorker || !implementationAgent || !isCleanLiveAgent(implementationAgent)) {
src/server/conversations/sync.ts:490:          const resumableWorker = implementationWorkers.find((worker) => worker.bridgeSessionId?.trim());
src/server/conversations/sync.ts:505:      await writeWorkerOutputEntries(run.id, implementationWorker.id, implementationAgent.outputEntries);
src/server/conversations/sync.ts:507:        status: implementationAgent.state,
src/server/conversations/sync.ts:508:        cwd: implementationAgent.cwd || implementationWorker.cwd,
src/server/conversations/sync.ts:509:        currentText: implementationAgent.currentText,
src/server/conversations/sync.ts:510:        lastText: implementationAgent.lastText,
src/server/conversations/sync.ts:512:      }).where(eq(workers.id, implementationWorker.id));
src/server/conversations/sync.ts:628:    if (run.mode === "implementation" || (isTerminalRunStatus(run.status) && !staleBusyFailure)) {
src/server/conversations/queued-messages.ts:549:  if (run.mode === "implementation") {
src/server/conversations/queued-messages.ts:564:      summary: "Accepted queued message for implementation worker steering.",
src/server/conversations/queued-messages.ts:731:          summary: "No active implementation worker is available; queued steering will be retried.",
src/server/conversations/queued-messages.ts:794:            run: { id: runId, mode: "implementation" },
src/server/events/named-events.ts:226:  | { kind: "plan.review.started"; runId: string; reviewRunId: string }
src/server/events/named-events.ts:227:  | { kind: "plan.review.finished"; runId: string; reviewRunId: string; status: string }
src/server/events/persisted-snapshot.ts:7:  planItems,
src/server/events/persisted-snapshot.ts:242:        ...(selectedRun?.mode === "implementation" && selectedRun.parentRunId ? [selectedRun.parentRunId] : []),
src/server/events/persisted-snapshot.ts:270:      ? db.select().from(planItems).where(eq(planItems.planId, selectedPlanId))
src/server/events/persisted-snapshot.ts:346:    planItems: allPlanItems,
src/server/conversations/create.ts:163:  return mode === "implementation" || mode === "direct";
src/server/conversations/create.ts:637:    if (mode === "implementation") {
src/server/conversations/modes.ts:1:export const CONVERSATION_MODES = ["implementation", "planning", "direct", "commit"] as const;
src/server/conversations/modes.ts:8:    : "implementation";
src/server/events/lifecycle-invariants.ts:23:const AWAITING_USER_MESSAGE_KINDS = new Set(["clarification", "implementation_confirmation"]);
src/server/conversations/send-message.ts:673:  if (run.mode === "implementation") {
src/server/conversations/send-message.ts:839:  if (run.mode === "implementation" && (busyAction === "queue" || busyAction === "steer")) {
src/server/conversations/send-message.ts:869:  if (run.mode === "implementation") {
src/server/runs/recovery-reconciler.ts:195:    if (!isCorruptResumeFileError(reason) || args.run.mode !== "implementation") {
src/server/runs/recovery-reconciler.ts:292:    summary: "Restarting implementation run from latest user checkpoint.",
src/server/runs/recovery-reconciler.ts:310:    summary: "Restarted implementation run from latest user checkpoint.",
src/server/runs/recovery-reconciler.ts:339:  if (run.mode === "implementation" && normalizeRunStatus(run.status) === "awaiting_user") {
src/server/runs/recovery-reconciler.ts:449:      && run.mode === "implementation"
src/server/runs/recovery-state.ts:224:    if (run.mode === "implementation" && latestUserCheckpoint(messages)) {
src/server/runs/recovery-state.ts:247:  if (blockedMessage && run.mode !== "implementation") {
src/server/runs/recovery-state.ts:259:  if (blockedMessage && run.mode === "implementation" && latestUserCheckpoint(messages)) {
src/server/runs/persisted-zombie-reconciler.ts:168:  const orphanedActiveWorker = args.bridgeAgentNames && run.mode !== "implementation"
src/server/runs/recovery-policy.ts:166:  const implementationRun = args.runMode === "implementation";
src/server/runs/recovery-policy.ts:168:    if (implementationRun && !policy.autoRecoverImplementationRuns) {
src/server/runs/recovery-policy.ts:169:      return { action: "needs_user", reason: "Automatic recovery is disabled for implementation runs." };
src/server/runs/recovery-policy.ts:171:    if (!implementationRun && !policy.autoRecoverDirectRuns) {
src/server/runs/recovery-policy.ts:176:  if (recoveryState.kind === "lost_worker_rerunnable" && implementationRun && policy.restartFromCheckpointWhenSessionMissing) {
src/server/runs/recovery-policy.ts:181:    return implementationRun
src/server/runs/recovery.ts:10:  planItems,
src/server/runs/recovery.ts:139:  await db.delete(planItems).where(eq(planItems.planId, planId));
src/server/runs/recovery.ts:817:  if (run.mode === "implementation") {
src/server/git/run-auto-commit.ts:15:  const title = normalized || "completed implementation run";
src/server/git/run-auto-commit.ts:55:  if (!run || (run.mode !== "implementation" && run.mode !== "direct") || !run.projectPath) {
src/server/quota/worker-resume.ts:51:    "Review where you left off, continue implementation or verification, and report clearly if anything is still blocked.",
src/server/omni-acp/agent.ts:14:    id: "implementation",
src/server/omni-acp/agent.ts:16:    description: "Start a supervisor-managed OmniHarness implementation run.",
src/server/omni-acp/agent.ts:64:  return isConversationMode(value) ? value : "implementation";
src/server/omni-acp/agent.ts:195:    if (snapshot.run.mode !== "implementation" && !snapshot.workerRecords.some((worker) => activeWorkerStatus(worker.status))) {
src/server/omni-acp/agent.ts:245:      mode: "implementation",
src/server/omni-acp/agent.ts:255:      modes: modeState("implementation"),
src/server/cli/runner.ts:125:  if (options.mode === "implementation") {
src/server/workers/stuck-worker-reaper.ts:9: * watchdog checks for this because it only inspects implementation
src/server/runs/recovery-actions.ts:98:  if (run.mode !== "implementation") {
src/server/runs/recovery-actions.ts:99:    throw new Error("Checkpoint restart is only available for implementation runs");
src/server/workers/entries-types.ts:4: * implementation plan at
src/app/home/HomeUiStateManager.ts:19:  planItems: [],
src/app/home/types.ts:158:  reviewRunId: string;
src/app/home/types.ts:174:  reviewRunId: string;
src/app/home/types.ts:331:  planItems: PlanItemRecord[];
src/app/home/types.ts:338:  reviewRuns?: PlanningReviewRunRecord[];
src/app/home/types.ts:340:  reviewFindings?: PlanningReviewFindingRecord[];
src/app/home/ComposerContainer.tsx:156:    forceSteer: selectedConversationMode === "implementation",
src/app/home/utils.ts:76:    planItems: runToDelete
src/app/home/utils.ts:77:      ? (current.planItems || []).filter((item: PlanItemRecord) => item.planId !== runToDelete.planId)
src/app/home/utils.ts:78:      : current.planItems,
src/app/home/utils.ts:96:  if (selectedRun?.mode === "implementation" && selectedRun.parentRunId?.trim()) {
src/app/home/utils.ts:111:  if (!selectedRun || !parentRunId || selectedRun.mode !== "implementation") {
src/server/workers/output-store.ts:1570:  // implementation read 64KB chunks and re-parsed the accumulated tail
src/app/home/useHomeMutations.ts:204:  const isImplementationRun = run?.mode === "implementation";
src/app/home/useHomeMutations.ts:1013:    mutationFn: async (payload: { runId: string; agentSelection: PlanningReviewAgentSelection; rounds: number }) => requestJson<{ ok: true; reviewRunId: string }>(`/api/planning/${payload.runId}/review`, {
src/app/home/HomeApp.tsx:1270:          reviewRuns={state.reviewRuns}
src/app/home/HomeApp.tsx:1272:          reviewFindings={state.reviewFindings}
src/app/home/useHomeLifecycle.ts:200:      if (savedMode === "planning" || savedMode === "implementation" || savedMode === "direct") {
src/app/home/useHomeViewModel.ts:63:  const isSupervisorRunning = Boolean(selectedRun && selectedRun.mode === "implementation" && selectedRun.status === "running");
src/app/home/useHomeViewModel.ts:64:  const selectedRunMode: RunMode = selectedRun?.mode || "implementation";
src/app/home/useHomeViewModel.ts:65:  const isImplementationConversation = selectedRunMode === "implementation";
src/app/home/useHomeViewModel.ts:95:    const configured = selectedRun && selectedRunMode !== "implementation"
src/app/home/useHomeViewModel.ts:369:    // only auto-resumes direct/implementation runs; planning runs surface the
src/app/home/useHomeViewModel.ts:371:    const autoResumes = selectedRun.mode === "direct" || selectedRun.mode === "commit" || selectedRun.mode === "implementation";
src/app/home/useHomeViewModel.ts:415:        && (m.kind === "clarification" || m.kind === "implementation_confirmation")
src/app/home/PlanningReviewPreferencesManager.ts:80:        action: t("planning.review.savePreferenceAction"),
src/app/home/EventStreamSnapshotCacheManager.ts:119:      planItems: preferInitialArray(initialState.planItems, cachedState.planItems, arrayMergeOptions),

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:35:26.717Z","phase":null} -->
## Tool result: call_j6Y6ffBxdppUQP1811Ly8C6w · 2026-06-14T16:35:26.717Z

```text
Chunk ID: 64a761
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 877
Output:
shared/locales/es.json
shared/locales/ko.json
shared/locales/fr.json
shared/locales/it.json
shared/locales/en.json
shared/locales/pt.json
shared/locales/zh-CN.json
shared/locales/de.json
shared/locales/ja.json
tests/lifecycle/scenarios/direct-mode-rerun.test.ts
tests/lifecycle/scenarios/plan-improvement-flow.test.ts
tests/lifecycle/scenarios/worker-failover/failover-transcript.test.ts
tests/lifecycle/scenarios/plan-review-blocked.test.ts
tests/lifecycle/scenarios/worker-spawn-failure.test.ts
tests/lifecycle/scenarios/end-to-end-events.test.ts
tests/lifecycle/scenarios/delete-conversation-fk.test.ts
tests/lifecycle/scenarios/conversation-continuation.test.ts
tests/lifecycle/scenarios/worker-reattach.test.ts
src/server/conversation-title.ts
src/server/supervisor/model-config.ts
src/server/supervisor/worker-failover.ts
src/server/supervisor/worker-types.ts
src/server/supervisor/conversation-bootstrap.ts
src/server/supervisor/worker-completion.ts
src/server/supervisor/worker-availability.ts
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
src/server/worker-launch-mode.ts
src/server/plans/checklist.ts
src/server/plans/readiness-pipeline.ts
src/server/plans/parser.ts
src/server/plans/readiness.ts
src/server/plans/readiness-llm.ts
src/server/runs/ad-hoc-plan.ts
src/server/runs/recovery-control-plane.ts
src/server/prompts/planner.md
src/server/prompts/conversation-title.md
src/server/conversations/sync.ts
src/server/conversations/create.ts
src/server/conversations/send-message.ts
src/server/conversations/worker-turn-gate.ts
src/server/agent-runtime/worker-pool.ts
src/server/conversations/message-records.ts
src/server/conversations/queued-messages.ts
src/server/conversations/modes.ts
src/server/conversations/queued-message-interrupt.ts
src/server/conversations/direct-run-status.ts
src/server/conversations/queued-message-records.ts
src/server/events/live-updates.ts
src/server/events/named-events.ts
src/server/events/lifecycle-invariants.ts
src/server/events/execution-event-store.ts
src/server/events/payload-checksum.ts
src/server/events/persisted-snapshot.ts
src/server/quota/worker-resume.ts
src/app/api/plans/route.ts
src/app/api/events/log/route.ts
src/app/api/events/route.ts
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
src/app/api/workers/[workerId]/entries/route.ts
src/app/api/conversations/route.ts
src/app/home/direct-worker-stream-loading.ts
src/app/api/conversations/[id]/transcript/route.ts
src/app/api/conversations/[id]/messages/route.ts
src/app/api/llm-models/route.ts
src/app/api/conversations/[id]/queued-messages/[messageId]/route.ts
src/app/api/agents/prewarm-worker/route.ts
src/app/api/conversations/[id]/queued-messages/[messageId]/interrupt/route.ts
src/app/api/conversations/[id]/queued-messages/interrupt-next/route.ts
src/app/api/planning/[id]/promote/route.ts
src/app/api/planning/[id]/review/route.ts

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:35:26.717Z","phase":null} -->
## Tool result: call_u8eLybYcKXdigRQIODYjYvTq · 2026-06-14T16:35:26.717Z

```text
Chunk ID: 8c8f3a
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2108
Output:
src/app/api/accounts/route.ts
src/app/api/agents/[name]/route.ts
src/app/api/agents/catalog/route.ts
src/app/api/agents/prewarm-worker/route.ts
src/app/api/agents/route.ts
src/app/api/attachments/route.ts
src/app/api/auth/login/route.ts
src/app/api/auth/logout/route.ts
src/app/api/auth/pair/route.ts
src/app/api/auth/session/route.ts
src/app/api/codex-auth/status/route.ts
src/app/api/conversations/route.ts
src/app/api/events/log/route.ts
src/app/api/events/route.ts
src/app/api/external-sessions/route.ts
src/app/api/fs/files/route.ts
src/app/api/fs/route.ts
src/app/api/git/route.ts
src/app/api/llm-models/route.ts
src/app/api/messages/route.ts
src/app/api/notifications/route.ts
src/app/api/plans/route.ts
src/app/api/projects/memory/route.ts
src/app/api/runs/[id]/route.ts
src/app/api/runtime/bootstrap/route.ts
src/app/api/settings/route.ts
src/app/api/supervisor/route.ts
src/app/home/AppearancePreferencesManager.ts
src/app/home/BusyMessageQueueManager.ts
src/app/home/ComposerContainer.tsx
src/app/home/ConversationNotificationManager.ts
src/app/home/ConversationTranscriptManager.ts
src/app/home/EventStreamSnapshotCacheManager.ts
src/app/home/EventStreamStateManager.ts
src/app/home/ExternalSessionsPicker.tsx
src/app/home/GitWorkspaceManager.ts
src/app/home/HomeApp.tsx
src/app/home/HomeUiStateManager.ts
src/app/home/LiveEventConnectionManager.ts
src/app/home/PlanningReviewPreferencesManager.ts
src/app/home/PreflightConfirmationActionsManager.ts
src/app/home/ProjectMemoryPanelManager.ts
src/app/home/SessionStateManager.ts
src/app/home/SettingsDraftManager.ts
src/app/home/SideWindowManager.ts
src/app/home/SidebarWorkerActivityManager.ts
src/app/home/WorkerEntriesManager.ts
src/app/home/auto-resume-selection.ts
src/app/home/bootstrap.server.ts
src/app/home/busy-message-behavior.ts
src/app/home/composer-keyboard.ts
src/app/home/constants.ts
src/app/home/direct-control-activity.ts
src/app/home/direct-worker-stream-loading.ts
src/app/home/recovery-utils.ts
src/app/home/side-window-viewport.ts
src/app/home/sidebar-activity.ts
src/app/home/supervisor-activity.ts
src/app/home/types.ts
src/app/home/upload-attachments.ts
src/app/home/useAppErrors.ts
src/app/home/useComposerController.ts
src/app/home/useConversationActions.ts
src/app/home/useConversationExecutionStatus.ts
src/app/home/useFrozenRecentOrder.ts
src/app/home/useHomeLayoutController.ts
src/app/home/useHomeLifecycle.ts
src/app/home/useHomeMutations.ts
src/app/home/useHomeQueries.ts
src/app/home/useHomeViewModel.ts
src/app/home/useQueuedMessageMutations.ts
src/app/home/useRunRecoveryState.ts
src/app/home/useRunSelectionEffects.ts
src/app/home/utils.ts
src/server/accounts/dto.ts
src/server/agent-runtime/acp-stream-sanitizer.ts
src/server/agent-runtime/codex.ts
src/server/agent-runtime/external-credentials.ts
src/server/agent-runtime/http.ts
src/server/agent-runtime/manager.ts
src/server/agent-runtime/memory-trace.ts
src/server/agent-runtime/output-store.ts
src/server/agent-runtime/resource-admission.ts
src/server/agent-runtime/tool-env.ts
src/server/agent-runtime/types.ts
src/server/agent-runtime/worker-pool.ts
src/server/api-errors.ts
src/server/app-root.ts
src/server/artifacts/append-only-store.ts
src/server/artifacts/cleanup.ts
src/server/artifacts/compaction.ts
src/server/artifacts/project-root.ts
src/server/artifacts/stream-index.ts
src/server/artifacts/stream-metadata.ts
src/server/artifacts/stream-types.ts
src/server/auth/audit.ts
src/server/auth/config.ts
src/server/auth/guards.ts
src/server/auth/pairing.ts
src/server/auth/password.ts
src/server/auth/rate-limit.ts
src/server/auth/session-state.ts
src/server/auth/session.ts
src/server/bridge-client/index.ts
src/server/clarifications/loop.ts
src/server/clarifications/store.ts
src/server/cli/options.ts
src/server/cli/runner.ts
src/server/conversation-title.ts
src/server/conversations/create.ts
src/server/conversations/direct-run-status.ts
src/server/conversations/message-records.ts
src/server/conversations/modes.ts
src/server/conversations/queued-message-interrupt.ts
src/server/conversations/queued-message-records.ts
src/server/conversations/queued-messages.ts
src/server/conversations/send-message.ts
src/server/conversations/sync.ts
src/server/conversations/worker-turn-gate.ts
src/server/credits/index.ts
src/server/db/index.ts
src/server/db/schema.ts
src/server/dev/bridge-health.ts
src/server/dev/bridge-lock.ts
src/server/dev/managed-bridge.ts
src/server/error-format.ts
src/server/events/execution-event-store.ts
src/server/events/lifecycle-invariants.ts
src/server/events/live-updates.ts
src/server/events/named-events.ts
src/server/events/payload-checksum.ts
src/server/events/persisted-snapshot.ts
src/server/external-sessions/discovery.ts
src/server/external-sessions/running.ts
src/server/fs/files.ts
src/server/git/auto-commit.ts
src/server/git/command.ts
src/server/git/orphan-recovery.ts
src/server/git/run-auto-commit.ts
src/server/git/status.ts
src/server/git/workspaces.ts
src/server/handoff/parser.ts
src/server/handoff/render.ts
src/server/handoff/request.ts
src/server/notifications/deliver.ts
src/server/notifications/preferences.ts
src/server/notifications/triggers.ts
src/server/notifications/web-push.ts
src/server/omni-acp/agent.ts
src/server/omni-acp/stdio.ts
src/server/permissions/index.ts
src/server/planning/artifacts.ts
src/server/planning/promote.ts
src/server/planning/refresh.ts
src/server/planning/review-agent-selection.ts
src/server/planning/review-artifact-store.ts
src/server/planning/review-preferences.ts
src/server/planning/review-prompts.ts
src/server/planning/review.ts
src/server/planning/status.ts
src/server/plans/checklist.ts
src/server/plans/parser.ts
src/server/plans/readiness-llm.ts
src/server/plans/readiness-pipeline.ts
src/server/plans/readiness.ts
src/server/projects/canonicalize.ts
src/server/projects/config.ts
src/server/prompts/conversation-title.md
src/server/prompts/index.ts
src/server/prompts/planner.md
src/server/prompts/supervisor.md
src/server/quota/recovery.ts
src/server/quota/reset-parser.ts
src/server/quota/type-blocking.ts
src/server/quota/worker-resume.ts
src/server/restart-control.ts
src/server/runs/ad-hoc-plan.ts
src/server/runs/failures.ts
src/server/runs/ids.ts
src/server/runs/persisted-zombie-reconciler.ts
src/server/runs/recovery-actions.ts
src/server/runs/recovery-control-plane.ts
src/server/runs/recovery-incidents.ts
src/server/runs/recovery-policy.ts
src/server/runs/recovery-reconciler.ts
src/server/runs/recovery-state.ts
src/server/runs/recovery.ts
src/server/runs/status.ts
src/server/session-providers/capabilities.ts
src/server/session-providers/omni-provider.ts
src/server/session-providers/process-provider.ts
src/server/session-providers/process-store.ts
src/server/session-providers/registry.ts
src/server/session-providers/session-records.ts
src/server/session-providers/types.ts
src/server/settings/crypto.ts
src/server/settings/read.ts
src/server/slow-probe.ts
src/server/supervisor/codex-auth.ts
src/server/supervisor/context-window.ts
src/server/supervisor/context.ts
src/server/supervisor/conversation-bootstrap.ts
src/server/supervisor/index.ts
src/server/supervisor/intervention-store.ts
src/server/supervisor/interventions.ts
src/server/supervisor/lease.ts
src/server/supervisor/memory-consolidation.ts
src/server/supervisor/memory-paths.ts
src/server/supervisor/memory-tools.ts
src/server/supervisor/model-config.ts
src/server/supervisor/observer.ts
src/server/supervisor/prompt.ts
src/server/supervisor/protocol.ts
src/server/supervisor/resume.ts
src/server/supervisor/retry.ts
src/server/supervisor/runtime-settings.ts
src/server/supervisor/runtime-watchdog.ts
src/server/supervisor/runtime.ts
src/server/supervisor/start.ts
src/server/supervisor/tools.ts
src/server/supervisor/wake-schedule.ts
src/server/supervisor/wake.ts
src/server/supervisor/worker-availability.ts
src/server/supervisor/worker-completion.ts
src/server/supervisor/worker-failover.ts
src/server/supervisor/worker-types.ts
src/server/worker-launch-mode.ts
src/server/worker-models.ts
src/server/workers/entries-types.ts
src/server/workers/ids.ts
src/server/workers/live-snapshots.ts
src/server/workers/monitor.ts
src/server/workers/output-store.ts
src/server/workers/response-fallback.ts
src/server/workers/session-metadata.ts
src/server/workers/session-recovery.ts
src/server/workers/snapshots.ts
src/server/workers/stream-writer.ts
src/server/workers/stuck-worker-reaper.ts

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:35:26.766Z","phase":null} -->
## Tool result: call_AvlWfhhZIkOyL08jHxZN7AOA · 2026-06-14T16:35:26.766Z

```text
Chunk ID: 8b5180
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 670
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
 M src/server/agent-runtime/http.ts
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
 M tests/server/agent-runtime/http.test.ts
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
3d2ee26

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:35:41.429Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:35:41.429Z

The worktree is already heavily dirty, so I’ll only add the planning artifact and avoid touching implementation files. I’m reading the existing planning/review path and UI entry points now; the plan will explicitly require future implementers to work with the current dirty state rather than assuming a clean checkout.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:35:41.434Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:35:41.434Z

```json
{
  "cmd": "sed -n '1,240p' src/server/conversations/modes.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:35:41.435Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:35:41.435Z

```json
{
  "cmd": "sed -n '1,420p' src/server/db/schema.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 40000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:35:41.437Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:35:41.437Z

```json
{
  "cmd": "sed -n '1,280p' src/server/events/named-events.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:35:41.791Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:35:41.791Z

```json
{
  "cmd": "sed -n '1,280p' src/server/planning/review.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 40000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:35:41.815Z","phase":null} -->
## Tool result: call_Le3vtgr5CHXsnoIoJdXuJcGd · 2026-06-14T16:35:41.815Z

```text
Chunk ID: 18326a
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 135
Output:
export const CONVERSATION_MODES = ["implementation", "planning", "direct", "commit"] as const;

export type ConversationMode = (typeof CONVERSATION_MODES)[number];

export function normalizeConversationMode(value: unknown): ConversationMode {
  return typeof value === "string" && CONVERSATION_MODES.includes(value as ConversationMode)
    ? (value as ConversationMode)
    : "implementation";
}

export function isDirectConversationMode(mode: ConversationMode) {
  return mode === "planning" || mode === "direct" || mode === "commit";
}

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:35:41.816Z","phase":null} -->
## Tool result: call_r6TWjF0bUemQOx0fWj5MYsXy · 2026-06-14T16:35:41.816Z

```text
Chunk ID: 5404f5
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 4436
Output:
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const plans = sqliteTable('plans', {
  id: text('id').primaryKey(),
  path: text('path').notNull(),
  status: text('status').notNull(), // 'pending', 'running', 'done', 'failed'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const runs = sqliteTable('runs', {
  id: text('id').primaryKey(),
  planId: text('plan_id').references(() => plans.id).notNull(),
  sessionType: text('session_type').notNull().default('omni'),
  mode: text('mode').notNull().default('implementation'),
  projectPath: text('project_path'),
  title: text('title'),
  preferredWorkerType: text('preferred_worker_type'),
  preferredWorkerModel: text('preferred_worker_model'),
  preferredWorkerEffort: text('preferred_worker_effort'),
  allowedWorkerTypes: text('allowed_worker_types'),
  specPath: text('spec_path'),
  artifactPlanPath: text('artifact_plan_path'),
  plannerArtifactsJson: text('planner_artifacts_json'),
  plannerReadinessVerdictJson: text('planner_readiness_verdict_json'),
  parentRunId: text('parent_run_id'),
  forkedFromMessageId: text('forked_from_message_id'),
  autoCommitMilestones: integer('auto_commit_milestones', { mode: 'boolean' }).notNull().default(false),
  pushOnCommit: integer('push_on_commit', { mode: 'boolean' }).notNull().default(false),
  gitBaselineJson: text('git_baseline_json'),
  gitWorkspaceJson: text('git_workspace_json'),
  completionCommitSha: text('completion_commit_sha'),
  status: text('status').notNull(), // 'running', 'done', 'failed'
  failedAt: integer('failed_at', { mode: 'timestamp' }),
  lastError: text('last_error'),
  archivedAt: integer('archived_at', { mode: 'timestamp' }),
  memoryMetadataRevision: integer('memory_metadata_revision').notNull().default(0),
  lastMemoryConsolidationAt: integer('last_memory_consolidation_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const workers = sqliteTable('workers', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id).notNull(),
  type: text('type').notNull(),
  status: text('status').notNull(), // 'idle', 'working', 'stuck', 'cred-exhausted'
  cwd: text('cwd').notNull(),
  workerNumber: integer('worker_number'),
  workerRole: text('worker_role'),
  allocationKey: text('allocation_key'),
  title: text('title').notNull().default(''),
  initialPrompt: text('initial_prompt').notNull().default(''),
  outputLog: text('output_log').notNull().default(''),
  outputEntriesJson: text('output_entries_json').notNull().default(''),
  currentText: text('current_text').notNull().default(''),
  lastText: text('last_text').notNull().default(''),
  bridgeSessionId: text('bridge_session_id'),
  bridgeSessionMode: text('bridge_session_mode'),
  // Monotonic fence advanced every time a turn is interrupted. A delivery
  // captures the generation it started under; stale completions from an
  // interrupted (older) turn compare their captured value and refuse to
  // persist terminal status/queue/response updates when it no longer matches.
  turnGeneration: integer('turn_generation').notNull().default(0),
  activeWorkStartedAt: integer('active_work_started_at', { mode: 'timestamp' }),
  activeWorkDurationMs: integer('active_work_duration_ms').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const processSessions = sqliteTable('process_sessions', {
  runId: text('run_id').primaryKey().references(() => runs.id),
  workerId: text('worker_id').references(() => workers.id).notNull(),
  cwd: text('cwd').notNull(),
  commandJson: text('command_json').notNull(),
  commandPreview: text('command_preview').notNull(),
  envPolicy: text('env_policy').notNull().default('minimal'),
  pid: integer('pid'),
  status: text('status').notNull(),
  exitCode: integer('exit_code'),
  signal: text('signal'),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  exitedAt: integer('exited_at', { mode: 'timestamp' }),
  killEscalatedAt: integer('kill_escalated_at', { mode: 'timestamp' }),
  lastError: text('last_error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const workerCounters = sqliteTable('worker_counters', {
  runId: text('run_id').primaryKey().references(() => runs.id),
  nextNumber: integer('next_number').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id).notNull(),
  role: text('role').notNull(), // 'user', 'supervisor', 'worker'
  kind: text('kind'),
  content: text('content').notNull(),
  attachmentsJson: text('attachments_json'),
  workerId: text('worker_id').references(() => workers.id),
  supersededAt: integer('superseded_at', { mode: 'timestamp' }),
  editedFromMessageId: text('edited_from_message_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const conversationReadMarkers = sqliteTable('conversation_read_markers', {
  runId: text('run_id').primaryKey().references(() => runs.id),
  lastReadAt: integer('last_read_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const queuedConversationMessages = sqliteTable('queued_conversation_messages', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id).notNull(),
  targetWorkerId: text('target_worker_id').references(() => workers.id),
  action: text('action').notNull(),
  content: text('content').notNull(),
  attachmentsJson: text('attachments_json'),
  status: text('status').notNull(),
  lastError: text('last_error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  deliveredAt: integer('delivered_at', { mode: 'timestamp' }),
});

export const recoveryIncidents = sqliteTable('recovery_incidents', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id).notNull(),
  workerId: text('worker_id').references(() => workers.id),
  queuedMessageId: text('queued_message_id').references(() => queuedConversationMessages.id),
  kind: text('kind').notNull(),
  status: text('status').notNull(),
  autoAttemptCount: integer('auto_attempt_count').notNull().default(0),
  lastError: text('last_error'),
  details: text('details'),
  detectedAt: integer('detected_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  resolvedAt: integer('resolved_at', { mode: 'timestamp' }),
});

export const supervisorScheduledWakes = sqliteTable('supervisor_scheduled_wakes', {
  runId: text('run_id').primaryKey().references(() => runs.id),
  wakeAt: integer('wake_at', { mode: 'timestamp' }).notNull(),
  reason: text('reason').notNull(),
  source: text('source'),
  incidentId: text('incident_id').references(() => recoveryIncidents.id),
  details: text('details'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  type: text('type').notNull(), // 'subscription' | 'api'
  authRef: text('auth_ref').notNull(),
  capacity: integer('capacity'),
  resetSchedule: text('reset_schedule'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const creditEvents = sqliteTable('credit_events', {
  id: text('id').primaryKey(),
  accountId: text('account_id').references(() => accounts.id).notNull(),
  workerId: text('worker_id').references(() => workers.id).notNull(),
  eventType: text('event_type').notNull(), // 'exhausted' | 'switched' | 'wait'
  details: text('details'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const authSessions = sqliteTable('auth_sessions', {
  id: text('id').primaryKey(),
  tokenHash: text('token_hash').notNull(),
  label: text('label'),
  userAgent: text('user_agent'),
  authMethod: text('auth_method').notNull(),
  createdBySessionId: text('created_by_session_id'),
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  absoluteExpiresAt: integer('absolute_expires_at', { mode: 'timestamp' }).notNull(),
  revokedAt: integer('revoked_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const notificationSubscriptions = sqliteTable('notification_subscriptions', {
  id: text('id').primaryKey(),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  sessionId: text('session_id').references(() => authSessions.id),
  userAgent: text('user_agent'),
  failureCount: integer('failure_count').notNull().default(0),
  lastError: text('last_error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp' }).notNull(),
  revokedAt: integer('revoked_at', { mode: 'timestamp' }),
});

export const authPairTokens = sqliteTable('auth_pair_tokens', {
  id: text('id').primaryKey(),
  tokenHash: text('token_hash').notNull(),
  creatorSessionId: text('creator_session_id').notNull(),
  targetRunId: text('target_run_id'),
  deviceLabel: text('device_label'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  redeemedAt: integer('redeemed_at', { mode: 'timestamp' }),
  redeemedSessionId: text('redeemed_session_id'),
  revokedAt: integer('revoked_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const authEvents = sqliteTable('auth_events', {
  id: text('id').primaryKey(),
  sessionId: text('session_id'),
  pairTokenId: text('pair_token_id'),
  eventType: text('event_type').notNull(),
  details: text('details'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const planItems = sqliteTable('plan_items', {
  id: text('id').primaryKey(),
  planId: text('plan_id').references(() => plans.id).notNull(),
  phase: text('phase'),
  title: text('title').notNull(),
  status: text('status').notNull(), // 'pending', 'in_progress', 'blocked', 'done', 'failed'
  sourceLine: integer('source_line'),
  dependsOn: text('depends_on'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const clarifications = sqliteTable('clarifications', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id).notNull(),
  question: text('question').notNull(),
  answer: text('answer'),
  status: text('status').notNull(), // 'pending', 'answered', 'dismissed'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const workerAssignments = sqliteTable('worker_assignments', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id).notNull(),
  workerId: text('worker_id').references(() => workers.id),
  planItemId: text('plan_item_id').references(() => planItems.id).notNull(),
  status: text('status').notNull(), // 'assigned', 'running', 'completed', 'failed', 'cancelled'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const executionEvents = sqliteTable('execution_events', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id).notNull(),
  workerId: text('worker_id').references(() => workers.id),
  planItemId: text('plan_item_id').references(() => planItems.id),
  eventType: text('event_type').notNull(),
  // Legacy full-body column. After artifact migration, new writes
  // leave this null and large `details` live in the run-level
  // execution-events artifact stream addressed by artifact_seq.
  details: text('details'),
  // Append cursor pointing into the artifact stream. NULL = legacy row
  // whose body still lives in `details`.
  artifactSeq: integer('artifact_seq'),
  // SHA-256 hex of the canonical-serialized payload, for stable
  // dedupe/diagnostics without re-reading the artifact body.
  detailsHash: text('details_hash'),
  // Short preview (≤256 chars) safe to inline in hot snapshot lists.
  detailsPreview: text('details_preview'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const supervisorInterventions = sqliteTable('supervisor_interventions', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id).notNull(),
  workerId: text('worker_id').references(() => workers.id),
  interventionType: text('intervention_type').notNull(),
  // Legacy body columns. After artifact migration, new writes leave
  // these null and bodies live in the supervisor-interventions
  // artifact stream addressed by artifact_seq.
  prompt: text('prompt'),
  summary: text('summary'),
  artifactSeq: integer('artifact_seq'),
  promptHash: text('prompt_hash'),
  summaryPreview: text('summary_preview'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const planningReviewRuns = sqliteTable('planning_review_runs', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull().references(() => runs.id),
  status: text('status').notNull(),
  agentSelection: text('agent_selection').notNull(),
  resolvedWorkerType: text('resolved_worker_type'),
  roundsRequested: integer('rounds_requested').notNull(),
  roundsCompleted: integer('rounds_completed').notNull().default(0),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  lastError: text('last_error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const planningReviewRounds = sqliteTable('planning_review_rounds', {
  id: text('id').primaryKey(),
  reviewRunId: text('review_run_id').notNull().references(() => planningReviewRuns.id),
  runId: text('run_id').notNull().references(() => runs.id),
  roundNumber: integer('round_number').notNull(),
  status: text('status').notNull(),
  workerId: text('worker_id'),
  resolvedWorkerType: text('resolved_worker_type'),
  selectionReason: text('selection_reason'),
  findingsSummary: text('findings_summary'),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  lastError: text('last_error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const planningReviewFindings = sqliteTable('planning_review_findings', {
  id: text('id').primaryKey(),
  reviewRunId: text('review_run_id').notNull().references(() => planningReviewRuns.id),
  roundId: text('round_id').notNull().references(() => planningReviewRounds.id),
  runId: text('run_id').notNull().references(() => runs.id),
  severity: text('severity').notNull(),
  category: text('category').notNull(),
  title: text('title').notNull(),
  // Legacy body columns. After artifact migration, new writes leave
  // these null and bodies live in the planning-review-findings
  // artifact stream addressed by artifact_seq.
  details: text('details'),
  recommendation: text('recommendation'),
  artifactSeq: integer('artifact_seq'),
  detailsHash: text('details_hash'),
  recommendationPreview: text('recommendation_preview'),
  sourcePath: text('source_path'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

/**
 * One row per (run_id, kind, owner_id) artifact stream. Records where
 * the file lives on disk, the append cursor, last verified state, and
 * error/compaction telemetry. owner_id is normalized via
 * ARTIFACT_STREAM_OWNER_NONE so SQLite UNIQUE actually catches dupes.
 */
export const artifactStreams = sqliteTable('artifact_streams', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull().references(() => runs.id),
  projectPath: text('project_path'),
  kind: text('kind').notNull(),
  ownerId: text('owner_id').notNull(),
  relativePath: text('relative_path').notNull(),
  latestSeq: integer('latest_seq').notNull().default(0),
  latestRecordId: text('latest_record_id'),
  status: text('status').notNull().default('active'),
  lastError: text('last_error'),
  lastVerifiedAt: integer('last_verified_at', { mode: 'timestamp' }),
  compactedAt: integer('compacted_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:35:41.816Z","phase":null} -->
## Tool result: call_4J3SSnCZdyxhxnBtXJMUwIRC · 2026-06-14T16:35:41.816Z

```text
Chunk ID: a5a8f7
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2205
Output:
/**
 * Named lifecycle events emitted alongside the snapshot stream.
 *
 * See docs/architecture/lifecycle-observability-and-testing.md for the
 * design rationale. The short version:
 *
 *   - Every server-side decision that the user, the UI, or a test client
 *     might want to observe is published here as a typed event.
 *   - Events share a single monotonic id namespace with the `update`
 *     snapshot frames emitted by /api/events. That keeps SSE
 *     `Last-Event-ID` resume unambiguous.
 *   - A bounded ring buffer remembers recent emissions so reconnecting
 *     clients can replay events they missed during disconnect.
 *
 * This module is intentionally synchronous and in-process. The ring
 * resets when the server restarts; clients then bootstrap via
 * `/api/events?snapshot=1` and resume from the new cursor.
 */
import { notifyEventStreamSubscribers } from "./live-updates";

// ---------------------------------------------------------------------------
// Event union
// ---------------------------------------------------------------------------

export type SurfacedErrorCode =
  | "plan.review.leftover_state"
  | "plan.review.failed"
  | "conversation.delete.foreign_key"
  | "conversation.delete.failed"
  | "conversation.continue.failed"
  | "process.spawn.failed"
  | "process.cwd.invalid"
  | "process.stdin.closed"
  | "process.stop.failed"
  | "process.orphaned_after_restart"
  | "recovery.gave_up"
  | "recovery.needs_user"
  | "recovery.run_failed"
  | "runtime.resource_pressure"
  | "runtime.settings_apply_failed"
  | "runtime.start_failed"
  | "session.provider.unknown"
  | "session.action.unsupported"
  | "queue.interrupt.refused"
  | "queue.interrupt.cancel_failed"
  | "queue.interrupt.delivery_failed"
  | "supervisor.gave_up"
  | "supervisor.wake.failed"
  | "surface.bridge_failed"
  | "worker.spawn.failed"
  | "worker.spawn.resource_exhausted"
  | "worker.failover.failed"
  | "worker.bridge.fatal_stderr"
  | "worker.environment_mismatch"
  | "worker.idle.empty_output"
  | "worker.idle.missing_output"
  | "worker.initial.empty_output"
  | "worker.initial.turn_failed"
  | "worker.observer.failed"
  | "worker.poll.failed"
  | "worker.resume.failed"
  | "worker.snapshot.invalid"
  | "codex_auth_missing"
  | "codex_auth_refresh_failed"
  | "codex_auth_unavailable"
  | "internal";

export type FailoverStage = "selection" | "handoff" | "spawn";
export type HandoffSource = "worker" | "synthetic";

export type ErrorSurface = "toast" | "banner" | "log";

export type RuntimeSurface = "web" | "electron" | "vscode" | "cli" | "test";

export type RuntimeStopReason =
  | "shutdown"
  | "test_complete"
  | "restart"
  | "surface_closed"
  | "error";

export type RuntimeEvent =
  | {
      kind: "runtime.started";
      surface: RuntimeSurface;
      label: string;
      startedAt: string;
    }
  | {
      kind: "runtime.start_failed";
      surface: RuntimeSurface;
      label: string;
      reason: string;
    }
  | {
      kind: "runtime.stopped";
      surface: RuntimeSurface;
      reason: RuntimeStopReason;
    }
  | {
      kind: "runtime.resource_pressure";
      level: "warning" | "critical";
      memoryFreePercent: number | null;
      diskFreeMb: number | null;
      activeAgents: number;
      poolMembers: number;
      evictedPoolMembers: number;
      reasons: string[];
    }
  | {
      kind: "runtime.settings_updated";
      keys: string[];
    }
  | {
      kind: "runtime.settings_apply_failed";
      keys: string[];
      reason: string;
    }
  | {
      kind: "runtime.idle_cleanup";
      idleMs: number;
      activeAgents: number;
      evictedPoolMembers: number;
    }
  | {
      kind: "surface.connected";
      surface: RuntimeSurface;
      label: string;
    }
  | {
      kind: "surface.disconnected";
      surface: RuntimeSurface;
      reason: string;
    }
  | {
      kind: "surface.bridge_failed";
      surface: RuntimeSurface;
      reason: string;
    };

export type WorkerEvent =
  | { kind: "worker.spawned"; runId: string; workerId: string; workerType: string }
  | { kind: "worker.status"; runId: string; workerId: string; prev: string; next: string }
  | { kind: "worker.terminal"; runId: string; workerId: string; status: string }
  | { kind: "worker.reattached"; runId: string; workerId: string }
  | { kind: "worker.recreated"; runId: string; workerId: string }
  | { kind: "worker.session_metadata_repaired"; runId: string; workerId: string }
  // Wake-up frame for the unified worker conversation stream. Carries
  // only (workerId, seq); clients fetch the entry via
  // GET /api/workers/:workerId/entries?afterSeq=. See
  // docs/architecture/worker-conversation-stream.md.
  | { kind: "worker.entry_appended"; runId: string; workerId: string; seq: number }
  | {
      kind: "worker.failover_started";
      runId: string;
      outgoingWorkerId: string;
      outgoingType: string;
      reason: string;
    }
  | {
      kind: "worker.handoff_emitted";
      runId: string;
      outgoingWorkerId: string;
      source: HandoffSource;
    }
  | {
      kind: "worker.failover_completed";
      runId: string;
      outgoingWorkerId: string;
      newWorkerId: string;
      newType: string;
    }
  | {
      kind: "worker.failover_failed";
      runId: string;
      outgoingWorkerId: string;
      stage: FailoverStage;
      reason: string;
    };

export type SupervisorStopReason =
  | "run_terminated"
  | "run_failed"
  | "cwd_mismatch"
  | "snapshot_invalid"
  | "quota_exhausted"
  | "fatal_bridge_error"
  | "explicit";

export type SupervisorEvent =
  | { kind: "supervisor.stopped"; runId: string; reason: SupervisorStopReason }
  | {
      kind: "supervisor.wake_lease_acquired";
      runId: string;
      source: "insert" | "replace_expired" | "replace_malformed";
    }
  | {
      kind: "supervisor.wake_lease_blocked";
      runId: string;
      reason: "active_lease" | "insert_conflict" | "claim_race";
    }
  | { kind: "supervisor.wake_lease_released"; runId: string }
  | {
      kind: "supervisor.wake_lease_release_skipped";
      runId: string;
      reason: "missing" | "malformed" | "not_owner";
    }
  | { kind: "supervisor.wake_lease_recovered"; runId: string; reason: "orphaned_completion" }
  | {
      kind: "supervisor.wake_skipped";
      runId: string;
      reason: "in_flight" | "lease_blocked" | "quota_wait_future_wake" | "run_not_runnable";
    }
  | { kind: "supervisor.wake_scheduled"; runId: string; delayMs: number; source: "volatile" | "lease_retry" }
  | {
      kind: "supervisor.durable_wake_schedule_failed";
      runId: string;
      reason: string;
      source: string | null;
      error: string;
    }
  | { kind: "supervisor.durable_wake_claimed"; runId: string; reason: string; source: string | null };

export type PlanEvent =
  | { kind: "plan.ready"; runId: string; planId: string | null }
  | { kind: "plan.review.started"; runId: string; reviewRunId: string }
  | { kind: "plan.review.finished"; runId: string; reviewRunId: string; status: string }
  | { kind: "plan.review.blocked"; runId: string; reason: string };

export type RecoveryEvent =
  | { kind: "recovery.opened"; runId: string; incidentId: string; recoveryKind: string }
  | { kind: "recovery.attempt"; runId: string; incidentId: string; attempt: number }
  | { kind: "recovery.gave_up"; runId: string; incidentId: string; attempts: number }
  | { kind: "recovery.resolved"; runId: string; incidentId: string };

export type ConversationEvent =
  | { kind: "conversation.awaiting_user"; runId: string; workerId?: string; reason: "worker_requested_input" }
  | { kind: "conversation.read"; runId: string; lastReadAt: string }
  | { kind: "conversation.deleted"; runId: string }
  | { kind: "conversation.delete_failed"; runId: string; blockingTable: string | null }
  | {
      kind: "queue.drain_decision";
      runId: string;
      workerId: string;
      source: string;
      workerStatus: string;
      pendingCount: number;
      decision: "drain" | "skip";
      reason: string;
    }
  | {
      kind: "queue.drain_finished";
      runId: string;
      workerId: string;
      source: string;
      pendingCount: number;
      deliveredCount: number;
    }
  // Escape / force-send interruption control plane. See
  // docs/architecture/lifecycle-observability-and-testing.md.
  | {
      kind: "queue.interrupt_requested";
      runId: string;
      workerId: string | null;
      queuedMessageId: string | null;
      source: string;
    }
  | {
      kind: "queue.interrupt_refused";
      runId: string;
      workerId: string | null;
      queuedMessageId: string | null;
      reason: string;
      source: string;
    }
  | {
      kind: "queue.interrupt_cancelled_turn";
      runId: string;
      workerId: string;
      queuedMessageId: string;

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:35:41.841Z","phase":null} -->
## Tool result: call_H3P512JQ7CkS5dsGoV0OMTaO · 2026-06-14T16:35:41.841Z

```text
Chunk ID: ae2350
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2580
Output:
import { db } from "@/server/db";
import {
  runs,
  workers,
  messages,
  planningReviewRuns,
  planningReviewRounds,
  planningReviewFindings,
} from "@/server/db/schema";
import { recordExecutionEvent } from "@/server/events/execution-event-store";
import { recordPlanningReviewFinding } from "@/server/planning/review-artifact-store";
import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "crypto";
import fs from "fs";
import {
  spawnAgent,
  askAgent,
  getAgent,
  cancelAgent,
} from "@/server/bridge-client";
import { resolvePlanningReviewWorkerType } from "./review-agent-selection";
import {
  buildReviewerPrompt,
  buildPlannerRevisionPrompt,
  type ReviewerFinding,
} from "./review-prompts";
import { refreshPlanningArtifactsForRun } from "./refresh";
import { type PlanningReviewAgentSelection } from "./review-preferences";
import { parseAllowedWorkerTypes } from "@/server/supervisor/worker-types";
import { allocateWorkerIdentity } from "@/server/workers/ids";
import { persistWorkerSnapshot } from "@/server/workers/snapshots";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { emitNamedEvent } from "@/server/events/named-events";
import { readRuntimeEnvFromSettings } from "@/server/supervisor/runtime-settings";

const processBootTime = new Date();

const ORPHAN_STALE_MS = 10 * 60 * 1000;

function isRecoverablePlannerAgentMissingError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /\b(agent not found|not_found|session not found|invalid session identifier|failed to load resumed session data from file|404)\b/i.test(message);
}

async function insertPlannerSessionEvent(args: {
  runId: string;
  workerId: string;
  eventType: "worker_session_resumed" | "worker_session_recreated";
  details: Record<string, unknown>;
}) {
  await recordExecutionEvent({
    runId: args.runId,
    workerId: args.workerId,
    planItemId: null,
    eventType: args.eventType,
    details: args.details,
  });
}

async function reconcileOrphanedReviewsForRun(runId: string) {
  const orphans = await db
    .select()
    .from(planningReviewRuns)
    .where(and(eq(planningReviewRuns.runId, runId), eq(planningReviewRuns.status, "running")));
  const now = new Date();
  let reconciledAny = false;
  for (const orphan of orphans) {
    const acrossRestart = !orphan.startedAt || orphan.startedAt < processBootTime;
    const staleInProcess = orphan.updatedAt && now.getTime() - orphan.updatedAt.getTime() > ORPHAN_STALE_MS;
    if (!acrossRestart && !staleInProcess) {
      continue;
    }
    console.warn("[planning/review] reconciling orphaned review run", {
      id: orphan.id,
      runId,
      reason: acrossRestart ? "process_restart" : "stale_in_process",
    });
    await db
      .update(planningReviewRuns)
      .set({
        status: "failed",
        lastError: acrossRestart
          ? "Orphaned by process restart before completion."
          : "Review orchestration stalled; reconciled as failed.",
        updatedAt: now,
      })
      .where(eq(planningReviewRuns.id, orphan.id));
    reconciledAny = true;
  }
  const current = await db.select().from(runs).where(eq(runs.id, runId)).get();
  if (!current) return;
  const hasRunningReview = await db
    .select()
    .from(planningReviewRuns)
    .where(and(eq(planningReviewRuns.runId, runId), eq(planningReviewRuns.status, "running")))
    .get();
  if (
    !hasRunningReview &&
    (current.status === "reviewing_plan" || current.status === "revising_plan" || reconciledAny)
  ) {
    if (current.status === "reviewing_plan" || current.status === "revising_plan") {
      await db
        .update(runs)
        .set({ status: "ready", updatedAt: now })
        .where(eq(runs.id, runId));
    }
  }
}

function parseReviewerFindings(text: string): ReviewerFinding[] {
  const jsonBlock = text.match(/\`\`\`json\s*([\s\S]*?)\s*\`\`\`/);
  if (!jsonBlock) return [];
  try {
    const parsed = JSON.parse(jsonBlock[1]);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function startPlanningReview(args: {
  runId: string;
  agentSelection: PlanningReviewAgentSelection;
  rounds: number;
}) {
  console.log("[planning/review] start", { runId: args.runId, agentSelection: args.agentSelection, rounds: args.rounds });
  const initialRun = await db.select().from(runs).where(eq(runs.id, args.runId)).get();
  console.log("[planning/review] initialRun", { found: Boolean(initialRun), mode: initialRun?.mode, status: initialRun?.status });
  if (!initialRun || initialRun.mode !== "planning") {
    throw new Error("Invalid run for planning review.");
  }

  await reconcileOrphanedReviewsForRun(args.runId);

  await refreshPlanningArtifactsForRun({ run: initialRun });
  const run = await db.select().from(runs).where(eq(runs.id, args.runId)).get();
  console.log("[planning/review] post-refresh", { status: run?.status, specPath: run?.specPath, artifactPlanPath: run?.artifactPlanPath });
  if (!run) {
    throw new Error("Invalid run for planning review.");
  }

  const artifacts = run.plannerArtifactsJson ? JSON.parse(run.plannerArtifactsJson) : null;
  console.log("[planning/review] artifacts", {
    hasArtifacts: Boolean(artifacts),
    specPath: artifacts?.specPath,
    planPath: artifacts?.planPath,
    candidateCount: artifacts?.candidates?.length,
    candidates: artifacts?.candidates,
  });
  if (!artifacts) {
    throw new Error("No plan artifacts found for review.");
  }
  const candidates: Array<{ kind?: string; path?: string; exists?: boolean }> = artifacts.candidates ?? [];
  if (!artifacts.planPath) {
    const firstPlanCandidate = candidates.find(
      (c) => c.kind === "plan" && c.path && c.exists !== false,
    );
    if (firstPlanCandidate?.path) {
      artifacts.planPath = firstPlanCandidate.path;
      console.log("[planning/review] fallback planPath", firstPlanCandidate.path);
    }
  }
  if (!artifacts.specPath) {
    const firstSpecCandidate = candidates.find(
      (c) => c.kind === "spec" && c.path && c.exists !== false,
    );
    if (firstSpecCandidate?.path) {
      artifacts.specPath = firstSpecCandidate.path;
      console.log("[planning/review] fallback specPath", firstSpecCandidate.path);
    }
  }
  if (!artifacts.planPath) {
    throw new Error("No plan artifacts found for review.");
  }
  await db
    .update(runs)
    .set({ plannerArtifactsJson: JSON.stringify(artifacts) })
    .where(eq(runs.id, run.id));
  run.plannerArtifactsJson = JSON.stringify(artifacts);

  console.log("[planning/review] resolved", { status: run.status, specPath: artifacts.specPath, planPath: artifacts.planPath });

  const existingReview = await db.select()
    .from(planningReviewRuns)
    .where(and(eq(planningReviewRuns.runId, run.id), eq(planningReviewRuns.status, "running")))
    .get();
  console.log("[planning/review] existingReview", { found: Boolean(existingReview), id: existingReview?.id });
  if (existingReview) {
    emitNamedEvent({
      kind: "plan.review.blocked",
      runId: run.id,
      reason: "leftover_state",
    });
    emitNamedEvent({
      kind: "error.surfaced",
      code: "plan.review.leftover_state",
      message: "A previous plan review is still active and is blocking a new one. Resolve or cancel the existing review before retrying.",
      surface: "banner",
      runId: run.id,
    });
    throw new Error("A review run is already active.");
  }

  if (run.status === "reviewing_plan" || run.status === "revising_plan") {
    console.warn("[planning/review] resetting stale run status with no active review", { runId: run.id, status: run.status });
    await db.update(runs).set({ status: "ready", updatedAt: new Date() }).where(eq(runs.id, run.id));
    run.status = "ready";
  }

  const reviewRunId = randomUUID();
  const now = new Date();
  await db.insert(planningReviewRuns).values({
    id: reviewRunId,
    runId: run.id,
    status: "running",
    agentSelection: args.agentSelection,
    roundsRequested: args.rounds,
    startedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  emitNamedEvent({
    kind: "plan.review.started",
    runId: run.id,
    reviewRunId,
  });

  // Orchestrate review
  orchestratePlanningReview(reviewRunId).catch((err) => {
    console.error(`Review orchestration failed for ${reviewRunId}:`, err);
  });

  return { reviewRunId, status: "running" };
}

async function orchestratePlanningReview(reviewRunId: string) {
  const reviewRun = await db.select().from(planningReviewRuns).where(eq(planningReviewRuns.id, reviewRunId)).get();
  if (!reviewRun) return;

  const run = await db.select().from(runs).where(eq(runs.id, reviewRun.runId)).get();
  if (!run) return;

  try {
    for (let i = 0; i < reviewRun.roundsRequested; i++) {
      const roundNumber = i + 1;
      
      // Update status to reviewing_plan
      await db.update(runs).set({ status: "reviewing_plan" }).where(eq(runs.id, run.id));
      
      const allowedWorkerTypes = parseAllowedWorkerTypes(run.allowedWorkerTypes);
      const plannerWorker = await db.select().from(workers).where(eq(workers.runId, run.id)).get();
      
      const { workerType, reason } = await resolvePlanningReviewWorkerType({
        agentSelection: reviewRun.agentSelection as PlanningReviewAgentSelection,
        allowedWorkerTypes,
        plannerWorkerType: plannerWorker?.type,
      });

      const roundId = randomUUID();
      await db.insert(planningReviewRounds).values({
        id: roundId,
        reviewRunId,
        runId: run.id,
        roundNumber,
        status: "reviewing",
        resolvedWorkerType: workerType,
        selectionReason: reason,
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const artifacts = JSON.parse(run.plannerArtifactsJson!);
      const specContent = artifacts.specPath ? fs.readFileSync(artifacts.specPath, "utf8") : "";
      const planContent = fs.readFileSync(artifacts.planPath, "utf8");

      const userMessages = await db.select().from(messages)
        .where(and(eq(messages.runId, run.id), eq(messages.role, "user")))
        .orderBy(desc(messages.createdAt), desc(messages.id));
      const userIntent = userMessages.map(m => m.content).join("\n\n");

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:35:51.325Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:35:51.325Z

```json
{
  "cmd": "sed -n '280,620p' src/server/planning/review.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 50000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:35:51.327Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:35:51.327Z

```json
{
  "cmd": "sed -n '1,240p' src/server/planning/review-prompts.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 24000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:35:51.328Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:35:51.328Z

```json
{
  "cmd": "sed -n '1,220p' src/server/planning/artifacts.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 26000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:35:51.658Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:35:51.658Z

```json
{
  "cmd": "sed -n '1,180p' src/app/api/planning/[id]/review/route.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:35:51.693Z","phase":null} -->
## Tool result: call_3DZ8nlu8Ljo422Gbxr7xhPeX · 2026-06-14T16:35:51.693Z

```text
Chunk ID: 70590f
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2322
Output:
      const userIntent = userMessages.map(m => m.content).join("\n\n");

      const prompt = buildReviewerPrompt({
        userIntent,
        specPath: artifacts.specPath ?? "(no spec available)",
        specContent,
        planPath: artifacts.planPath!,
        planContent,
      });

      const reviewerCwd = run.projectPath || process.cwd();
      const { workerId: reviewerName, workerNumber: reviewerWorkerNumber } =
        await allocateWorkerIdentity(run.id);
      const reviewerCreatedAt = new Date();
      await db.insert(workers).values({
        id: reviewerName,
        runId: run.id,
        type: workerType,
        status: "starting",
        cwd: reviewerCwd,
        workerNumber: reviewerWorkerNumber,
        title: `Plan reviewer · round ${roundNumber}`,
        initialPrompt: prompt,
        outputLog: "",
        outputEntriesJson: "",
        currentText: "",
        lastText: "",
        createdAt: reviewerCreatedAt,
        updatedAt: reviewerCreatedAt,
      });
      emitNamedEvent({ kind: "worker.spawned", runId: run.id, workerId: reviewerName, workerType });
      notifyEventStreamSubscribers();

      const { env: envParams } = await readRuntimeEnvFromSettings();
      const reviewerAgent = await spawnAgent({
        type: workerType,
        cwd: reviewerCwd,
        name: reviewerName,
        mode: "slim",
        env: envParams,
      });

      await db.update(workers).set({
        status: "working",
        type: reviewerAgent.type || workerType,
        cwd: reviewerAgent.cwd || reviewerCwd,
        bridgeSessionId: reviewerAgent.sessionId ?? null,
        bridgeSessionMode: reviewerAgent.sessionMode ?? null,
        updatedAt: new Date(),
      }).where(eq(workers.id, reviewerName));
      notifyEventStreamSubscribers();

      const response = await askAgent(reviewerName, prompt);

      let reviewerSnapshot: Awaited<ReturnType<typeof getAgent>> | null = null;
      try {
        reviewerSnapshot = await getAgent(reviewerName);
        await persistWorkerSnapshot(reviewerName, reviewerSnapshot);
      } catch {
        // Bridge may have already dropped the agent; the response still drives findings.
      }

      await db.update(workers).set({
        status: response.state || "idle",
        outputLog: response.response.trim() ? response.response : "",
        bridgeSessionId: reviewerSnapshot?.sessionId ?? reviewerAgent.sessionId ?? null,
        bridgeSessionMode: reviewerSnapshot?.sessionMode ?? reviewerAgent.sessionMode ?? null,
        updatedAt: new Date(),
      }).where(eq(workers.id, reviewerName));
      notifyEventStreamSubscribers();

      const findings = parseReviewerFindings(response.response);

      await db.update(planningReviewRounds).set({
        status: findings.length > 0 ? "revising" : "completed",
        findingsSummary: findings.length > 0 ? `Found ${findings.length} issues.` : "No findings.",
        completedAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(planningReviewRounds.id, roundId));

      if (findings.length > 0) {
        for (const f of findings) {
          await recordPlanningReviewFinding({
            reviewRunId,
            roundId,
            runId: run.id,
            severity: f.severity,
            category: f.category,
            title: f.title,
            details: f.details,
            recommendation: f.recommendation,
            sourcePath: f.sourcePath,
          });
        }

        await db.update(runs).set({ status: "revising_plan" }).where(eq(runs.id, run.id));

        if (!plannerWorker) throw new Error("Planner worker not found.");
        
        const plannerName = plannerWorker.id;
        try {
          await getAgent(plannerName);
        } catch (error) {
          if (!isRecoverablePlannerAgentMissingError(error)) {
            throw error;
          }
          const spawnParams = {
            type: plannerWorker.type,
            cwd: plannerWorker.cwd,
            name: plannerName,
            env: envParams,
          };
          const savedSessionId = plannerWorker.bridgeSessionId?.trim() || null;
          let resumed = false;
          if (savedSessionId) {
            try {
              const agent = await spawnAgent({ ...spawnParams, resumeSessionId: savedSessionId });
              await db.update(workers).set({
                bridgeSessionId: agent.sessionId ?? savedSessionId,
                bridgeSessionMode: agent.sessionMode ?? plannerWorker.bridgeSessionMode ?? null,
                updatedAt: new Date(),
              }).where(eq(workers.id, plannerName));
              await insertPlannerSessionEvent({
                runId: run.id,
                workerId: plannerName,
                eventType: "worker_session_resumed",
                details: {
                  summary: `Resumed ${plannerName} from saved session before planning revision.`,
                  sessionId: savedSessionId,
                  reason: "planning_review_revision",
                },
              });
              resumed = true;
            } catch (error) {
              if (!isRecoverablePlannerAgentMissingError(error)) {
                throw error;
              }
              const message = error instanceof Error ? error.message : String(error);
              console.warn("[planning/review] planner session no longer resumable; starting a fresh session", {
                plannerName,
                savedSessionId,
                error: message,
              });
              await db.update(workers).set({
                bridgeSessionId: null,
                updatedAt: new Date(),
              }).where(eq(workers.id, plannerName));
            }
          }
          if (!resumed) {
            const agent = await spawnAgent(spawnParams);
            await db.update(workers).set({
              bridgeSessionId: agent.sessionId ?? null,
              bridgeSessionMode: agent.sessionMode ?? null,
              updatedAt: new Date(),
            }).where(eq(workers.id, plannerName));
            await insertPlannerSessionEvent({
              runId: run.id,
              workerId: plannerName,
              eventType: "worker_session_recreated",
              details: {
                summary: `Started a fresh runtime worker for ${plannerName} during planning revision.`,
                rejectedSessionId: savedSessionId,
                newSessionId: agent.sessionId ?? null,
                reason: "planning_review_revision",
              },
            });
            emitNamedEvent({
              kind: "worker.recreated",
              runId: run.id,
              workerId: plannerName,
            });
          } else {
            emitNamedEvent({
              kind: "worker.reattached",
              runId: run.id,
              workerId: plannerName,
            });
          }
        }

        const revisionPrompt = buildPlannerRevisionPrompt({ findings, roundNumber });
        await askAgent(plannerName, revisionPrompt);

        // Update run status back to revising_plan because askAgent might have changed it to working?
        // Actually, askAgent doesn't update the DB. refreshPlanningArtifacts will update it.
        const latestRun = await db.select().from(runs).where(eq(runs.id, run.id)).get();
        await refreshPlanningArtifactsForRun({ run: latestRun || run, status: "revising_plan" });
      }

      await cancelAgent(reviewerName);
      await db.update(workers).set({
        status: "cancelled",
        updatedAt: new Date(),
      }).where(eq(workers.id, reviewerName));
      notifyEventStreamSubscribers();

      await db.update(planningReviewRuns).set({
        roundsCompleted: roundNumber,
        updatedAt: new Date(),
      }).where(eq(planningReviewRuns.id, reviewRunId));

      if (findings.length === 0) {
        break;
      }
    }

    await db.update(planningReviewRuns).set({
      status: "completed",
      completedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(planningReviewRuns.id, reviewRunId));
    emitNamedEvent({
      kind: "plan.review.finished",
      runId: run.id,
      reviewRunId,
      status: "completed",
    });

    // Final refresh to return to 'ready'
    const finalRun = await db.select().from(runs).where(eq(runs.id, run.id)).get();
    await refreshPlanningArtifactsForRun({ run: finalRun || run });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[planning/review] orchestration failed", { reviewRunId, runId: run.id, error: message });
    await db.update(planningReviewRuns).set({
      status: "failed",
      lastError: message || "Review failed with no error message.",
      updatedAt: new Date(),
    }).where(eq(planningReviewRuns.id, reviewRunId));

    await db.update(runs).set({
      status: "ready",
      updatedAt: new Date(),
    }).where(eq(runs.id, run.id));
    notifyEventStreamSubscribers();
    emitNamedEvent({
      kind: "plan.review.finished",
      runId: run.id,
      reviewRunId,
      status: "failed",
    });
    emitNamedEvent({
      kind: "error.surfaced",
      code: "plan.review.failed",
      message: message || "Plan review failed.",
      surface: "banner",
      runId: run.id,
    });
  }
}

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:35:51.693Z","phase":null} -->
## Tool result: call_6LX4F7SRrz1XKuNIraDJ1waZ · 2026-06-14T16:35:51.693Z

```text
Chunk ID: 99f541
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 748
Output:
export type ReviewerFinding = {
  severity: "critical" | "major" | "minor" | "note";
  category: "scope" | "architecture" | "sequencing" | "testing" | "ux" | "risk" | "observability" | "i18n" | "other";
  title: string;
  details: string;
  recommendation: string;
  sourcePath?: string;
};

export function buildReviewerPrompt(args: {
  userIntent: string;
  specPath: string;
  specContent: string;
  planPath: string;
  planContent: string;
}): string {
  return `You are acting as a READ-ONLY planning reviewer. 

Your goal is to evaluate the proposed implementation plan and specification against the original user intent.

CONSTRAINTS:
- DO NOT edit any files.
- DO NOT run any implementation steps or commands (other than reading if needed).
- DO NOT commit any changes.
- DO NOT promote the plan to implementation.
- You must provide your findings in a structured JSON format.

USER INTENT:
${args.userIntent}

SPECIFICATION (${args.specPath}):
${args.specContent}

PLAN (${args.planPath}):
${args.planContent}

EVALUATION CRITERIA:
1. Scope: Does the plan cover all requirements? Is there scope creep?
2. Architecture: Is the proposed design sound and idiomatic for the project?
3. Sequencing: Is the task order logical? Are dependencies handled correctly?
4. Testing: Is there a clear verification strategy for each step?
5. UX/UI: Does it align with project design standards?
6. Risk: Are there potential security, performance, or stability risks?
7. Observability: Is there sufficient logging/instrumentation?
8. i18n: Are user-facing strings handled via locale resources?

OUTPUT FORMAT:
Provide your findings in a JSON block fenced with \`\`\`json.
If the plan is good and requires no changes, provide an empty array: [].

Example finding:
\`\`\`json
[
  {
    "severity": "major",
    "category": "testing",
    "title": "Missing verification for database migration",
    "details": "Step 3 adds a new column but does not include a command to verify the schema change.",
    "recommendation": "Add 'pnpm drizzle-kit check' or a custom script to verify the migration.",
    "sourcePath": "docs/plans/my-plan.md"
  }
]
\`\`\`

Analyze the plan and provide your findings now.`;
}

export function buildPlannerRevisionPrompt(args: {
  findings: ReviewerFinding[];
  roundNumber: number;
}): string {
  const findingsList = args.findings
    .map((f, i) => `${i + 1}. [${f.severity.toUpperCase()}] ${f.title} (${f.category})
   Detail: ${f.details}
   Recommendation: ${f.recommendation}`)
    .join("\n\n");

  return `Reviewer findings (Round ${args.roundNumber}):

${findingsList}

Please revise the specification and implementation plan to address these findings.
- Edit the spec and plan files directly.
- Preserve all existing user constraints and project conventions.
- When finished, you MUST emit a READY planning handoff block (the same format you used originally) so the user can review the updated plan.

Address the findings and provide the updated artifacts now.`;
}

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:35:51.693Z","phase":null} -->
## Tool result: call_ff9V0i3pmYWMme07Ehyh6yDG · 2026-06-14T16:35:51.693Z

```text
Chunk ID: 81b134
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1754
Output:
import fs from "fs";
import os from "os";
import path from "path";
import { assessPlanReadiness, type PlanReadinessAssessment } from "@/server/plans/readiness";
import { parsePlan } from "@/server/plans/parser";
import type { PlanReadinessRecord } from "@/server/plans/readiness-pipeline";

const SCRATCH_SEARCH_MAX_DEPTH = 6;

function getAgentScratchRoots(): string[] {
  const override = process.env.OMNIHARNESS_AGENT_SCRATCH_ROOTS?.trim();
  if (override) {
    return override.split(path.delimiter).map((root) => path.resolve(root)).filter(Boolean);
  }
  return [path.resolve(path.join(os.homedir(), ".gemini", "tmp"))];
}

function isInsideScratchRoot(candidate: string): boolean {
  const resolved = path.resolve(candidate);
  return getAgentScratchRoots().some((root) => {
    const rel = path.relative(root, resolved);
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  });
}

function extractScratchAbsolutePaths(outputText: string): string[] {
  const roots = getAgentScratchRoots();
  if (roots.length === 0) return [];
  const absMarkdownPattern = /\/[\w./-]+\.md\b/g;
  const seen = new Set<string>();
  for (const match of outputText.matchAll(absMarkdownPattern)) {
    const candidate = match[0];
    if (roots.some((root) => candidate === root || candidate.startsWith(root + path.sep))) {
      seen.add(candidate);
    }
  }
  return [...seen];
}

function copyIntoProjectStandardDir(args: {
  cwd: string;
  kind: "spec" | "plan" | "unknown";
  sourcePath: string;
}): string | null {
  const subdir = args.kind === "spec" ? "specs" : "plans";
  const targetDir = path.join(args.cwd, "docs", "superpowers", subdir);
  try {
    fs.mkdirSync(targetDir, { recursive: true });
  } catch {
    return null;
  }
  const target = path.join(targetDir, path.basename(args.sourcePath));
  try {
    if (!fs.existsSync(target)) {
      fs.copyFileSync(args.sourcePath, target);
    }
  } catch {
    return null;
  }
  return target;
}

function searchScratchByBasename(dir: string, basename: string, depth: number): string | null {
  if (depth < 0) return null;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isFile() && entry.name === basename) {
      return full;
    }
    if (entry.isDirectory()) {
      const found = searchScratchByBasename(full, basename, depth - 1);
      if (found) return found;
    }
  }
  return null;
}

function findScratchArtifact(basename: string): string | null {
  for (const root of getAgentScratchRoots()) {
    if (!fs.existsSync(root)) continue;
    const found = searchScratchByBasename(root, basename, SCRATCH_SEARCH_MAX_DEPTH);
    if (found) return found;
  }
  return null;
}

function relocateByBasenameFromScratch(args: {
  cwd: string;
  kind: "spec" | "plan" | "unknown";
  rawPath: string;
}): { path: string; relocatedFrom: string } | null {
  const basename = path.basename(args.rawPath.trim().replace(/^["'`]|["'`]$/g, ""));
  if (!basename || !basename.toLowerCase().endsWith(".md")) {
    return null;
  }
  const found = findScratchArtifact(basename);
  if (!found) return null;
  const target = copyIntoProjectStandardDir({ cwd: args.cwd, kind: args.kind, sourcePath: found });
  return target ? { path: target, relocatedFrom: found } : null;
}

export interface PlannerHandoff {
  specPath: string | null;
  planPath: string | null;
  ready: boolean;
  summary: string | null;
}

export interface PlannerArtifactCandidate {
  path: string;
  kind: "spec" | "plan" | "unknown";
  source: "handoff" | "output_text" | "inferred";
  confidence: number;
  evidence: string;
  exists: boolean;
  readiness?: PlanReadinessAssessment | null;
  readinessRecord?: PlanReadinessRecord | null;
}

export interface PlannerArtifacts {
  specPath: string | null;
  planPath: string | null;
  candidates: PlannerArtifactCandidate[];
}

function normalizeCandidatePath(cwd: string, candidate: string) {
  const trimmed = candidate.trim().replace(/^["'`]|["'`]$/g, "");
  if (!trimmed) {
    return null;
  }

  return path.isAbsolute(trimmed) ? path.normalize(trimmed) : path.resolve(cwd, trimmed);
}

function inferKind(candidatePath: string): PlannerArtifactCandidate["kind"] {
  const lower = candidatePath.toLowerCase();
  if (lower.includes("/specs/") || lower.includes("-design.md")) return "spec";
  if (lower.includes("/plans/") || lower.includes("plan")) return "plan";
  return "unknown";
}

function inferSiblingSpecPaths(planPath: string) {
  const normalizedPlanPath = path.normalize(planPath);
  const segments = normalizedPlanPath.split(path.sep);
  const plansIndex = segments.lastIndexOf("plans");
  if (plansIndex < 0) {
    return [];
  }

  const parsed = path.parse(normalizedPlanPath);
  const specsSegments = [...segments.slice(0, -1)];
  specsSegments[plansIndex] = "specs";
  const specsDir = specsSegments.join(path.sep) || path.sep;
  const baseNames = [
    parsed.name.replace(/-implementation$/, "-design"),
    parsed.name.replace(/-plan$/, "-design"),
    `${parsed.name}-design`,
    parsed.name,
  ];

  return Array.from(new Set(baseNames))
    .map((baseName) => path.join(specsDir, `${baseName}${parsed.ext || ".md"}`));
}

function extractMarkdownPaths(outputText: string) {
  const artifactReferencePattern = /\b(?:created|drafted|finalized|generated|handoff|prepared|saved|updated|wrote|spec_path|plan_path)\b/i;
  const markdownPathPattern = /(?:\/[\w./-]+|(?:docs|vibes)[\w./-]*|\.?\.?\/[\w./-]+)\.md\b/g;
  const matches: string[] = [];
  let artifactReferenceContextLines = 0;

  for (const line of outputText.split(/\r?\n/)) {
    const hasArtifactReference = artifactReferencePattern.test(line);
    if (hasArtifactReference) {
      artifactReferenceContextLines = 3;
    }

    if (!hasArtifactReference && artifactReferenceContextLines === 0) {
      continue;
    }

    matches.push(...line.matchAll(markdownPathPattern).map((match) => match[0]));

    if (!hasArtifactReference && artifactReferenceContextLines > 0) {
      artifactReferenceContextLines -= 1;
    }
  }

  return Array.from(new Set(matches));
}

export function extractPlannerHandoffBlock(outputText: string): PlannerHandoff | null {
  const matches = Array.from(outputText.matchAll(/<omniharness-plan-handoff>([\s\S]*?)<\/omniharness-plan-handoff>/gi));
  const match = matches.at(-1);
  if (!match) {
    return null;
  }

  const lines = match[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const byKey = new Map<string, string>();
  for (const line of lines) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) continue;
    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    byKey.set(key, value);
  }

  return {
    specPath: byKey.get("spec_path") || null,
    planPath: byKey.get("plan_path") || null,

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:35:51.722Z","phase":null} -->
## Tool result: call_SoAUsdhsRh5RovKN7LkjYnRx · 2026-06-14T16:35:51.722Z

```text
Chunk ID: 5e31c4
Wall time: 0.0000 seconds
Process exited with code 1
Original token count: 17
Output:
zsh:1: no matches found: src/app/api/planning/[id]/review/route.ts

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:36:05.574Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:36:05.574Z

The current planning-review code already captures structured review findings in SQLite and artifact streams, which is a useful precedent. The new mode should not parse terminal prose after the fact as the primary source; it should make the advisor emit durable structured records as first-class output, with the transcript as supporting evidence.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:36:05.586Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:36:05.586Z

```json
{
  "cmd": "sed -n '120,260p' src/server/conversations/create.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 24000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:36:05.586Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:36:05.586Z

```json
{
  "cmd": "sed -n '600,720p' src/server/conversations/create.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 24000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:36:05.586Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:36:05.586Z

```json
{
  "cmd": "sed -n '1,220p' 'src/app/api/planning/[id]/review/route.ts'",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 16000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:36:05.675Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:36:05.675Z

```json
{
  "cmd": "sed -n '130,230p' src/app/home/types.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 16000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:36:05.754Z","phase":null} -->
## Tool result: call_oNX09EkamFXUGlJ5aZosvPw2 · 2026-06-14T16:36:05.754Z

```text
Chunk ID: 058681
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1206
Output:
    text: `Worker spawn failed: ${failureMessage}`,
    timestamp: now,
    raw: { eventType: "worker.spawn_failed", mode: args.mode, reason: failureMessage },
  });
  emitNamedEvent({
    kind: "worker.status",
    runId: args.runId,
    workerId: args.workerId,
    prev: "starting",
    next: "error",
  });
  emitNamedEvent({
    kind: "error.surfaced",
    code: isResourceAdmissionError(args.error)
      ? "worker.spawn.resource_exhausted"
      : "worker.spawn.failed",
    message: `Failed to spawn worker for ${args.mode} conversation: ${cause.message}`,
    surface: "toast",
    runId: args.runId,
    workerId: args.workerId,
    cause,
  });
  notifyEventStreamSubscribers();
}

function getDefaultConversationTitle(mode: ConversationMode, command: string) {
  if (mode === "commit") {
    return "Commit";
  }

  return buildInitialConversationTitle(command);
}

function shouldGenerateConversationTitle(mode: ConversationMode, command: string) {
  // Commit conversations have a stable product label; other modes can replace
  // the first-line fallback with a generated sidebar title.
  if (mode === "commit") {
    return false;
  }
  return Boolean(command.trim());
}

function shouldCaptureCommitWorkflowForMode(mode: ConversationMode) {
  return mode === "implementation" || mode === "direct";
}

async function readCommitWorkflowSettings() {
  const rows = await db.select().from(settings);
  const values = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return {
    autoCommitMilestones: parseBooleanSetting(values[GIT_AUTO_COMMIT_MILESTONES_SETTING], false),
    pushOnCommit: parseBooleanSetting(values[GIT_PUSH_ON_COMMIT_SETTING], false),
  };
}

type GitWorkspaceLaunchRequest = {
  mode: "new_worktree";
  projectPath: string;
  newBranchName: string;
  checkoutPath: string;
  startPoint?: string;
  worktreeParent?: string;
  expectedHeadSha: string | null;
  expectedStatusFingerprint: string;
};

type ResolvedConversationWorkspace = {
  projectPath: string;
  runSnapshot: GitWorkspaceRunSnapshot | null;
  createdWorktree?: { projectPath: string; target: GitWorkspaceTarget };
};

function buildRunWorkspaceSnapshot(args: {
  target: GitWorkspaceTarget;
  snapshot: GitWorkspaceSnapshot;
  warnings?: GitWorkspaceWarning[];
}): GitWorkspaceRunSnapshot {
  const matchingWorktree = args.snapshot.worktrees.find((worktree) => worktree.checkoutPath === args.target.checkoutPath);
  const selectedAt = new Date().toISOString();
  return {
    target: args.target,
    headSha: matchingWorktree?.headSha ?? args.snapshot.headSha,
    branchName: matchingWorktree?.branchName ?? args.target.branchName ?? args.snapshot.branchName,
    detachedLabel: matchingWorktree?.detachedLabel ?? args.snapshot.detachedLabel,
    dirtyFileCount: matchingWorktree?.dirtyFileCount ?? args.snapshot.dirtyFileCount,
    conflictedFileCount: matchingWorktree?.conflictedFileCount ?? args.snapshot.conflictedFileCount,
    aheadCount: args.snapshot.aheadCount,
    behindCount: args.snapshot.behindCount,
    warnings: args.warnings ?? args.snapshot.warnings,
    selectedAt,
  };
}

async function resolveConversationWorkspace(args: {
  projectPath: string;
  gitWorkspaceTarget?: GitWorkspaceTarget | null;
  gitWorkspaceLaunch?: GitWorkspaceLaunchRequest | null;
}): Promise<ResolvedConversationWorkspace> {
  if (args.gitWorkspaceLaunch) {
    const result = await createBranchWorktree({
      projectPath: args.gitWorkspaceLaunch.projectPath,
      newBranchName: args.gitWorkspaceLaunch.newBranchName,
      checkoutPath: args.gitWorkspaceLaunch.checkoutPath,
      startPoint: args.gitWorkspaceLaunch.startPoint,
      worktreeParent: args.gitWorkspaceLaunch.worktreeParent,
      expectedHeadSha: args.gitWorkspaceLaunch.expectedHeadSha,
      expectedStatusFingerprint: args.gitWorkspaceLaunch.expectedStatusFingerprint,
    });
    persistWorkspaceDefaultTarget(args.gitWorkspaceLaunch.projectPath, result.target);
    return {
      projectPath: result.target.checkoutPath,
      runSnapshot: buildRunWorkspaceSnapshot({
        target: result.target,
        snapshot: result.snapshot,
      }),
      createdWorktree: {
        projectPath: args.gitWorkspaceLaunch.projectPath,
        target: result.target,
      },
    };
  }

  if (args.gitWorkspaceTarget) {
    const snapshot = await validateWorkspaceTarget(args.gitWorkspaceTarget);
    persistWorkspaceDefaultTarget(args.projectPath, args.gitWorkspaceTarget);
    return {
      projectPath: args.gitWorkspaceTarget.checkoutPath,
      runSnapshot: buildRunWorkspaceSnapshot({
        target: args.gitWorkspaceTarget,
        snapshot,
      }),
    };
  }

  return {
    projectPath: args.projectPath,
    runSnapshot: null,
  };
}

function persistWorkspaceDefaultTarget(projectPath: string, target: GitWorkspaceTarget) {

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:36:05.754Z","phase":null} -->
## Tool result: call_OnLdXn7gWHfFTFb5zYunUu1B · 2026-06-14T16:36:05.754Z

```text
Chunk ID: ac8f07
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1167
Output:
      completionCommitSha: null,
      status: mode === "planning" ? "starting" : "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    runCreated = true;

    if (resolvedWorkspace.runSnapshot) {
      await recordExecutionEvent({
        runId,
        eventType: "git_workspace_selected",
        details: {
          target: resolvedWorkspace.runSnapshot.target,
          headSha: resolvedWorkspace.runSnapshot.headSha,
          branchName: resolvedWorkspace.runSnapshot.branchName,
          detachedLabel: resolvedWorkspace.runSnapshot.detachedLabel,
          dirtyFileCount: resolvedWorkspace.runSnapshot.dirtyFileCount,
          conflictedFileCount: resolvedWorkspace.runSnapshot.conflictedFileCount,
          aheadCount: resolvedWorkspace.runSnapshot.aheadCount,
          behindCount: resolvedWorkspace.runSnapshot.behindCount,
          warnings: resolvedWorkspace.runSnapshot.warnings,
        },
      });
    }

    const initialMessageId = randomUUID();
    const initialMessageCreatedAt = new Date();
    const initialMessage = {
      id: initialMessageId,
      runId,
      role: "user",
      kind: "checkpoint",
      content: command,
      attachmentsJson,
      createdAt: initialMessageCreatedAt,
    };

    if (mode === "implementation") {
      await db.insert(dbMessages).values(initialMessage);
      notifyEventStreamSubscribers();
      startSupervisorRun(runId);
    } else {
      const { workerId, workerNumber } = await allocateWorkerIdentity(runId);
      const cwd = projectPath || process.cwd();
      const workerType = preferredWorkerType || allowedWorkerTypes[0] || "codex";
      const yoloModeEnabled = await readWorkerYoloModeEnabled();
      const workerMode = resolveWorkerLaunchMode(undefined, yoloModeEnabled);

      await db.insert(workers).values({
        id: workerId,
        runId,
        type: workerType,
        status: "starting",
        cwd,
        workerNumber,
        outputLog: "",
        outputEntriesJson: "[]",
        currentText: "",
        lastText: "",
        // Durable copy of the user's opening prompt so the terminal can still
        // render it if the messages row is ever lost (recovery, retry, manual
        // edit). The messages table was being treated as the single source of
        // truth, leaving direct conversations with no recoverable transcript.
        initialPrompt: command,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      if (!args.externalClaudeSessionId || command) {
        await appendUserInputOnDelivery({
          id: initialMessageId,
          runId,
          workerId,
          text: command,
          deliveredAt: initialMessageCreatedAt,
          attachments: attachments.map((attachment) => ({
            id: attachment.id,
            filename: attachment.name,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.size,
          })),
        });
        await db.insert(dbMessages).values(initialMessage);
      }
      notifyEventStreamSubscribers();
      emitNamedEvent({ kind: "worker.spawned", runId, workerId, workerType });
      await appendLifecycleEntry({
        runId,
        workerId,
        text: `Worker spawned (${workerType})`,
        raw: { eventType: "worker.spawned", workerType },
      });

      const response = await buildCreatedConversationResponse({ planId, runId, messageId: initialMessageId, mode });

      if (mode === "direct" || mode === "commit") {
        const initialDirectTurn = startDirectWorkerConversation({
          runId,
          workerId,
          workerType,
          cwd,
          mode: workerMode,
          preferredWorkerModel: args.preferredWorkerModel,
          preferredWorkerEffort: args.preferredWorkerEffort,
          command: workerPrompt,
          externalClaudeSessionId: args.externalClaudeSessionId,
        });
        trackConversationBackgroundTask(initialDirectTurn).catch((error) => {
          console.error("Initial direct conversation worker failed:", error);
        });
      } else {
        // Planning mode: spawn the agent off the critical path so the
        // response returns instantly, mirroring direct mode. Spawn
        // failures surface via `error.surfaced` instead of the HTTP
        // response — the worker row already exists in `starting` and
        // `worker.spawned` has already fired, so observers can render.
        const initialPlanningTurn = (async () => {
          let agent;
          try {
            const { env: envParams } = await readRuntimeEnvFromSettings();
            agent = await spawnAgent({
              type: workerType,

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:36:05.754Z","phase":null} -->
## Tool result: call_0mugJcywX5zzimmusS3rD4eY · 2026-06-14T16:36:05.754Z

```text
Chunk ID: 8267b7
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 85
Output:
import { NextRequest } from "next/server";
import { handlePlanningReviewRequest } from "@/runtime/http/routes/planning";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return handlePlanningReviewRequest(req, { surface: "web", params: { id } });
}

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:36:05.754Z","phase":null} -->
## Tool result: call_XYA5lVwHwcPoXzsglW2HpWLX · 2026-06-14T16:36:05.754Z

```text
Chunk ID: ba4037
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 645
Output:
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

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:36:13.659Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:36:13.659Z

The mode creation path treats `planning`, `direct`, and `commit` as direct-worker-backed modes, while `implementation` is supervisor-backed. That means the cleanest shape for this feature is a new direct-worker-backed advisor mode with its own prompt, structured artifact extraction, events, and review UI, rather than trying to overload implementation mode.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:36:13.662Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:36:13.662Z

```json
{
  "cmd": "sed -n '690,790p' src/server/conversations/create.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:36:13.669Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:36:13.669Z

```json
{
  "cmd": "sed -n '1,240p' src/runtime/http/routes/planning.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 26000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:36:13.671Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:36:13.671Z

```json
{
  "cmd": "sed -n '980,1060p' src/app/home/useHomeMutations.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 16000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:36:15.849Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:36:15.849Z

```json
{
  "cmd": "sed -n '1210,1305p' src/app/home/HomeApp.tsx",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 22000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:36:15.875Z","phase":null} -->
## Tool result: call_PFcEoRDvhWMt4FEqpk7TmYpz · 2026-06-14T16:36:15.875Z

```text
Chunk ID: bb5c59
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 830
Output:
      });

      const response = await buildCreatedConversationResponse({ planId, runId, messageId: initialMessageId, mode });

      if (mode === "direct" || mode === "commit") {
        const initialDirectTurn = startDirectWorkerConversation({
          runId,
          workerId,
          workerType,
          cwd,
          mode: workerMode,
          preferredWorkerModel: args.preferredWorkerModel,
          preferredWorkerEffort: args.preferredWorkerEffort,
          command: workerPrompt,
          externalClaudeSessionId: args.externalClaudeSessionId,
        });
        trackConversationBackgroundTask(initialDirectTurn).catch((error) => {
          console.error("Initial direct conversation worker failed:", error);
        });
      } else {
        // Planning mode: spawn the agent off the critical path so the
        // response returns instantly, mirroring direct mode. Spawn
        // failures surface via `error.surfaced` instead of the HTTP
        // response — the worker row already exists in `starting` and
        // `worker.spawned` has already fired, so observers can render.
        const initialPlanningTurn = (async () => {
          let agent;
          try {
            const { env: envParams } = await readRuntimeEnvFromSettings();
            agent = await spawnAgent({
              type: workerType,
              cwd,
              name: workerId,
              ...(workerMode ? { mode: workerMode } : {}),
              env: envParams,
              model: args.preferredWorkerModel?.trim() || undefined,
              effort: args.preferredWorkerEffort?.trim().toLowerCase() || undefined,
            });
          } catch (error) {
            await persistInitialWorkerSpawnFailure({
              runId,
              workerId,
              mode,
              error,
            });
            console.error(`Spawn for ${mode} conversation failed:`, error);
            return;
          }

          try {
            await runWorkerTurn(workerId, () => runInitialWorkerTurn({
              runId,
              workerId,
              workerType,
              cwd,
              agent,
              mode,
              command: workerPrompt,
            }));
          } catch (error) {
            if (isAgentBusyError(error)) {
              return;
            }
            console.error(`Initial ${mode} conversation turn failed:`, error);
          }
        })();
        void trackConversationBackgroundTask(initialPlanningTurn);
      }

      if (generateTitle) {
        queueConversationTitleGeneration({ runId, command }).catch((error) => {
          console.error("Conversation title generation failed:", error);
        });
      }
      return response;
    }

    if (generateTitle) {
      queueConversationTitleGeneration({ runId, command }).catch((error) => {
        console.error("Conversation title generation failed:", error);
      });
    }

    return buildCreatedConversationResponse({ planId, runId, messageId: initialMessageId, mode });
  } catch (error) {
    if (createdWorktree && !runCreated) {
      throw pendingOrphanWorktreeError({
        projectPath: createdWorktree.projectPath,
        operation: "conversation_launch",
        target: createdWorktree.target,
        error,
      });
    }
    throw error;
  }
}

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:36:15.875Z","phase":null} -->
## Tool result: call_0qOcCCeO6yxxmGkKRIdNE52t · 2026-06-14T16:36:15.875Z

```text
Chunk ID: 6a1834
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 851
Output:
import { errorResponse } from "@/server/api-errors";
import { requireApiSession } from "@/server/auth/guards";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import { promotePlanningRun } from "@/server/planning/promote";
import { startPlanningReview } from "@/server/planning/review";
import { parsePlanningReviewPreferences } from "@/server/planning/review-preferences";
import type { OmniHttpHandler, OmniRequestContext } from "@/runtime/http/registry";
import { toNextRequest } from "./next-request";

function requirePlanningRunId(context: OmniRequestContext) {
  const runId = context.params?.id?.trim();
  if (!runId) {
    throw new Error("Planning run id is required.");
  }
  return runId;
}

export const handlePlanningReviewRequest: OmniHttpHandler = async (request, context) => {
  try {
    if (request.method !== "POST") {
      return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
        status: 405,
        headers: { allow: "POST" },
      });
    }

    const auth = await requireApiSession(toNextRequest(request), {
      source: "Planning",
      action: "Review planning conversation",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const body = await request.json().catch(() => ({}));
    const prefs = parsePlanningReviewPreferences(body);
    const result = await startPlanningReview({
      runId: requirePlanningRunId(context),
      agentSelection: prefs.agentSelection,
      rounds: prefs.rounds,
    });

    notifyEventStreamSubscribers();

    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[planning/review] failed:", error);
    const status = /not ready|no ready plan/i.test(message)
      ? 400
      : /not found/i.test(message)
        ? 404
        : /already in progress|already active/i.test(message)
          ? 409
          : 500;

    return errorResponse(error, {
      status,
      source: "Planning",
      action: "Review planning conversation",
    });
  }
};

export const handlePlanningPromoteRequest: OmniHttpHandler = async (request, context) => {
  try {
    if (request.method !== "POST") {
      return Response.json({ error: { code: "method_not_allowed", message: "Method not allowed." } }, {
        status: 405,
        headers: { allow: "POST" },
      });
    }

    const auth = await requireApiSession(toNextRequest(request), {
      source: "Planning",
      action: "Promote planning conversation",
      enforceSameOrigin: true,
    });
    if (auth.response) {
      return auth.response;
    }

    const body = await request.json().catch(() => ({}));
    const result = await promotePlanningRun({
      runId: requirePlanningRunId(context),
      planPath: typeof body?.planPath === "string" ? body.planPath : null,
    });
    notifyEventStreamSubscribers();

    return Response.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /not ready|no verified plan/i.test(message)
      ? 400
      : /not found/i.test(message)
        ? 404
        : 500;

    return errorResponse(error, {
      status,
      source: "Planning",
      action: "Promote planning conversation",
    });
  }
};

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:36:15.875Z","phase":null} -->
## Tool result: call_swQkuuJRWJ1zXw0ueSujzJ0i · 2026-06-14T16:36:15.875Z

```text
Chunk ID: c1d96e
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 767
Output:
      }),
    }, {
      source: "Runs",
      action: "Stop worker terminal",
    }),
  });

  const promotePlanningConversation = useMutation({
    onMutate: (_payload: { runId: string; planPath: string | null }) => ({
      selectedRunIdAtStart: homeUiStateManager.getSnapshot().selectedRunId,
    }),
    mutationFn: async (payload: { runId: string; planPath: string | null }) => requestJson<{ runId?: string }>(`/api/planning/${payload.runId}/promote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planPath: payload.planPath }),
    }, {
      source: "Planning",
      action: "Promote planning conversation",
    }),
    onSuccess: (data, variables, context) => {
      if (data.runId && shouldSelectSourceRunMutationResult({
        sourceRunId: variables.runId,
        selectedRunIdAtStart: context?.selectedRunIdAtStart ?? null,
        currentSelectedRunId: homeUiStateManager.getSnapshot().selectedRunId,
        resultRunId: data.runId,
      })) {
        setSelectedRunId(data.runId);
        replaceBrowserConversationPath(data.runId, null);
      }
    },
  });

  const startPlanningReview = useMutation({
    mutationFn: async (payload: { runId: string; agentSelection: PlanningReviewAgentSelection; rounds: number }) => requestJson<{ ok: true; reviewRunId: string }>(`/api/planning/${payload.runId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentSelection: payload.agentSelection, rounds: payload.rounds }),
    }, {
      source: "Planning",
      action: "Start planning review",
    }),
  });

  const handleLoadWorkerHistory = async (workerId: string) => {
    const normalizedWorkerId = workerId.trim();
    if (!normalizedWorkerId || loadingWorkerHistoryIdsRef.current.has(normalizedWorkerId)) {
      return;
    }

    loadingWorkerHistoryIdsRef.current.add(normalizedWorkerId);
    try {
      const agent = await requestJson<AgentSnapshot>(
        `/api/agents/${encodeURIComponent(normalizedWorkerId)}?history=full`,
        undefined,
        {
          source: "Agent runtime",
          action: "Load worker history",
        },
      );

      setState((current: typeof state) => {
        const agentsByName = new Map(
          (current.agents || []).map((candidate: AgentSnapshot) => [candidate.name, candidate]),
        );
        agentsByName.set(agent.name, mergeLoadedWorkerHistoryAgent(agentsByName.get(agent.name), agent));
        return { ...current, agents: Array.from(agentsByName.values()) };
      });
    } catch (error) {
      setRuntimeErrors((current) => mergeAppErrors(current, [
        buildInlineError(error, {
          source: "Agent runtime",
          action: "Load worker history",
          suggestion: "The live stream can continue, but older worker output could not be hydrated. Try again after the agent runtime responds.",
        }),
      ]));
    } finally {
      loadingWorkerHistoryIdsRef.current.delete(normalizedWorkerId);
    }
  };

  return {

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:36:15.916Z","phase":null} -->
## Tool result: call_Nrumx4QuwOmNB4smiv8pvfBm · 2026-06-14T16:36:15.916Z

```text
Chunk ID: 03588d
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1389
Output:
          setRightSidebarOpen={setRightSidebarOpen}
          mobileWorkersOpen={mobileWorkersOpen}
          setMobileWorkersOpen={setMobileWorkersOpen}
          selectedRunWorkers={selectedRunWorkersForDisplay}
          conversationAgents={conversationAgents}
          supervisorInterventions={selectedRunSupervisorInterventions}
          onCommitNow={() => actions.handleManualCommitChat("commit")}
          onCommitAndPushNow={() => actions.handleManualCommitChat("commit-push")}
          onPrimaryCommit={() => actions.handleManualCommitChat()}
          autoCommitMilestonesEnabled={actions.autoCommitMilestonesEnabled}
          pushOnCommitEnabled={actions.pushOnCommitEnabled}
          onAutoCommitMilestonesChange={(checked) => actions.updateCommitWorkflowSetting("GIT_AUTO_COMMIT_MILESTONES", checked)}
          onPushOnCommitChange={(checked) => actions.updateCommitWorkflowSetting("GIT_PUSH_ON_COMMIT", checked)}
          isAutoCommitChatPending={autoCommitChat.isPending}
          onStopWorker={(workerId) => {
            if (selectedRunId) stopWorker.mutate({ runId: selectedRunId, workerId });
          }}
          onStopTerminalProcess={(workerId, terminalProcess) => {
            if (selectedRunId && terminalProcess.processId) {
              stopWorkerTerminalProcess.mutate({ runId: selectedRunId, workerId, terminalProcess });
            }
          }}
          onLoadWorkerHistory={handleLoadWorkerHistory}
          stoppingWorkerId={stopWorker.variables?.workerId ?? null}
          stoppingTerminalProcess={stopWorkerTerminalProcess.variables ? {
            workerId: stopWorkerTerminalProcess.variables.workerId,
            terminalProcessId: stopWorkerTerminalProcess.variables.terminalProcess.id,
          } : null}
          onForkSession={actions.handleForkSession}
          onForkSessionIntoWorktree={actions.handleForkSessionIntoWorktree}
          canForkSession={Boolean(selectedRunId && latestUserCheckpoint)}
          onReload={handleReload}
        />

        <ConversationMain
          scrollRef={scrollRef}
          selectedRunId={selectedRunId}
          selectedRun={selectedRun}
          welcomeRepoName={welcomeRepoName}
          isDirectConversation={isDirectConversation}
          isPlanningConversation={isPlanningConversation}
          isImplementationConversation={isImplementationConversation}
          appErrors={appErrors}
          conversationFailure={conversationFailure}
          directConversationMessages={directConversationMessages}
          expandedDirectMessageIds={expandedDirectMessageIds}
          toggleDirectMessageExpansion={actions.toggleDirectMessageExpansion}
          primaryConversationAgent={vm.primaryConversationAgent}
          primaryConversationWorkerId={vm.primaryConversationAgent?.name ?? null}
          initialWorkerEntries={state.workerEntries}
          unifiedWorkerStreamEnabled={bootstrap?.features?.unifiedWorkerStream ?? false}
          isHydratingConversations={isHydratingConversations}
          isSelectedConversationPreviewAvailable={isSelectedConversationPreviewAvailable}
          isSelectedConversationLoaded={isSelectedConversationLoaded}
          promotePlanningConversation={promotePlanningConversation}
          onStartReview={(prefs) => {
            if (selectedRunId) {
              startPlanningReview.mutate({ runId: selectedRunId, ...prefs });
            }
          }}
          reviewRuns={state.reviewRuns}
          reviewRounds={state.reviewRounds}
          reviewFindings={state.reviewFindings}
          conversationTimelineItems={conversationTimelineItems}
          recoverRun={recoverRun}
          recoveryState={selectedRecoveryState}
          recoveryIncidents={selectedRecoveryIncidents}
          resumeRunRecovery={{ isPending: isResumeRunRecoveryPendingForSelectedRun }}
          showRecoverableRunningState={showRecoverableRunningState}
          hasStuckWorker={hasStuckWorker}
          latestUserCheckpoint={latestUserCheckpoint}
          handleRetryMessage={actions.handleRetryMessage}
          handleResumeRunRecovery={actions.handleResumeRunRecovery}
          handleStartEditingMessage={actions.handleStartEditingMessage}
          handleForkMessage={actions.handleForkMessage}
          handleForkMessageIntoWorktree={actions.handleForkMessageIntoWorktree}
          handleConfirmForkMessageIntoWorktree={actions.handleConfirmForkMessageIntoWorktree}
          editingMessageId={editingMessageId}
          editingMessageValue={editingMessageValue}
          setEditingMessageValue={setEditingMessageValue}
          handleCancelEditingMessage={actions.handleCancelEditingMessage}
          handleSaveEditedMessage={(messageId) => actions.handleSaveEditedMessage(messageId, editingMessageValue)}
          handlePreflightConfirmationAnswer={(content) => {
            if (selectedRunId) {
              sendConversationMessage.mutate({ runId: selectedRunId, content, attachments: [] });
            }
          }}
          isPreflightConfirmationAnswering={isSendingSelectedConversationMessage}
          conversationAgents={conversationAgents}
          showDirectControlWorkingIndicator={showDirectControlWorkingIndicator}
          directControlPendingAssistantStatus={directControlPendingAssistantStatus}
          showConversationExecution={showConversationExecution}
          liveExecutionStatus={liveExecutionStatus}
          liveThoughts={liveThoughts}
          executionEvents={selectedRunExecutionEvents}
          activeWorkers={conversationWorkerGroups.active}

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:36:25.405Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:36:25.405Z

The UI already sends planning-review records into `ConversationMain`. I’m checking that component boundary next because the new structured output should likely sit next to the planning review/promote panel, not inside the terminal transcript.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:36:25.409Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:36:25.409Z

```json
{
  "cmd": "rg -n \"function ConversationMain|const ConversationMain|PlanningReview|reviewFindings|promotePlanningConversation|onStartReview|isPlanningConversation\" src/components src/app/home",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 40000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:36:25.410Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:36:25.410Z

```json
{
  "cmd": "rg -n \"CONVERSATION_MODES|conversationModes|modeOptions|conversation\\.mode|ConversationMode|selectedConversationMode\" src/app src/components shared -g '!shared/locales/*.json'",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 40000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:36:25.411Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:36:25.411Z

```json
{
  "cmd": "sed -n '1,260p' src/server/prompts/planner.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 16000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:36:25.460Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:36:25.460Z

```json
{
  "cmd": "sed -n '1,260p' src/server/plans/readiness-pipeline.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 28000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:36:25.491Z","phase":null} -->
## Tool result: call_DkGOHrvH3KvH0EvBwIEnE0FK · 2026-06-14T16:36:25.491Z

```text
Chunk ID: bd1869
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2273
Output:
src/components/PlanningArtifactsPanel.tsx:1:// Wired up PlanningReviewControls
src/components/PlanningArtifactsPanel.tsx:11:import { PlanningReviewControls } from "./PlanningReviewControls";
src/components/PlanningArtifactsPanel.tsx:12:import { planningReviewPreferencesManager } from "@/app/home/PlanningReviewPreferencesManager";
src/components/PlanningArtifactsPanel.tsx:13:import { type PlanningReviewRunRecord, type PlanningReviewRoundRecord, type PlanningReviewFindingRecord } from "@/app/home/types";
src/components/PlanningArtifactsPanel.tsx:14:import { type PlanningReviewAgentSelection } from "@/server/planning/review-preferences";
src/components/PlanningArtifactsPanel.tsx:154:  reviewFindings,
src/components/PlanningArtifactsPanel.tsx:155:  onStartReview,
src/components/PlanningArtifactsPanel.tsx:166:  latestReviewRun?: PlanningReviewRunRecord | null;
src/components/PlanningArtifactsPanel.tsx:167:  latestReviewRound?: PlanningReviewRoundRecord | null;
src/components/PlanningArtifactsPanel.tsx:168:  reviewFindings?: PlanningReviewFindingRecord[];
src/components/PlanningArtifactsPanel.tsx:169:  onStartReview?: (prefs: { agentSelection: PlanningReviewAgentSelection; rounds: number }) => void;
src/components/PlanningArtifactsPanel.tsx:317:      {runId && onStartReview && isReviewPanelExpanded && (
src/components/PlanningArtifactsPanel.tsx:318:        <PlanningReviewControls
src/components/PlanningArtifactsPanel.tsx:322:          findings={reviewFindings}
src/components/PlanningArtifactsPanel.tsx:323:          onStartReview={onStartReview}
src/app/home/useHomeViewModel.ts:66:  const isPlanningConversation = selectedRunMode === "planning";
src/app/home/useHomeViewModel.ts:558:    isPlanningConversation,
src/components/PlanningReviewControls.tsx:8:import { planningReviewPreferencesManager, planningReviewPreferencesSetters } from "@/app/home/PlanningReviewPreferencesManager";
src/components/PlanningReviewControls.tsx:10:import { type PlanningReviewRunRecord, type PlanningReviewRoundRecord, type PlanningReviewFindingRecord } from "@/app/home/types";
src/components/PlanningReviewControls.tsx:12:import { type PlanningReviewAgentSelection } from "@/server/planning/review-preferences";
src/components/PlanningReviewControls.tsx:14:interface PlanningReviewControlsProps {
src/components/PlanningReviewControls.tsx:16:  latestReviewRun?: PlanningReviewRunRecord | null;
src/components/PlanningReviewControls.tsx:17:  latestReviewRound?: PlanningReviewRoundRecord | null;
src/components/PlanningReviewControls.tsx:18:  findings?: PlanningReviewFindingRecord[];
src/components/PlanningReviewControls.tsx:19:  onStartReview: (prefs: { agentSelection: PlanningReviewAgentSelection; rounds: number }) => void;
src/components/PlanningReviewControls.tsx:22:export function PlanningReviewControls({
src/components/PlanningReviewControls.tsx:27:  onStartReview,
src/components/PlanningReviewControls.tsx:28:}: PlanningReviewControlsProps) {
src/components/PlanningReviewControls.tsx:32:  const agents: PlanningReviewAgentSelection[] = ["auto", "same", "codex", "claude", "gemini", "opencode"];
src/components/PlanningReviewControls.tsx:43:      onStartReview({ agentSelection, rounds });
src/app/home/HomeApp.tsx:33:import { planningReviewPreferencesManager } from "./PlanningReviewPreferencesManager";
src/app/home/HomeApp.tsx:474:    isPlanningConversation,
src/app/home/HomeApp.tsx:617:    promotePlanningConversation,
src/app/home/HomeApp.tsx:618:    startPlanningReview,
src/app/home/HomeApp.tsx:1015:    isPending: promotePlanningConversation.isPending,
src/app/home/HomeApp.tsx:1016:    mutationRunId: promotePlanningConversation.variables?.runId,
src/app/home/HomeApp.tsx:1250:          isPlanningConversation={isPlanningConversation}
src/app/home/HomeApp.tsx:1264:          promotePlanningConversation={promotePlanningConversation}
src/app/home/HomeApp.tsx:1265:          onStartReview={(prefs) => {
src/app/home/HomeApp.tsx:1267:              startPlanningReview.mutate({ runId: selectedRunId, ...prefs });
src/app/home/HomeApp.tsx:1272:          reviewFindings={state.reviewFindings}
src/app/home/useHomeQueries.ts:9:import { planningReviewPreferencesManager } from "./PlanningReviewPreferencesManager";
src/app/home/types.ts:142:export type PlanningReviewRunRecord = {
src/app/home/types.ts:156:export type PlanningReviewRoundRecord = {
src/app/home/types.ts:172:export type PlanningReviewFindingRecord = {
src/app/home/types.ts:338:  reviewRuns?: PlanningReviewRunRecord[];
src/app/home/types.ts:339:  reviewRounds?: PlanningReviewRoundRecord[];
src/app/home/types.ts:340:  reviewFindings?: PlanningReviewFindingRecord[];
src/app/home/useHomeMutations.ts:19:import type { PlanningReviewAgentSelection } from "@/server/planning/review-preferences";
src/app/home/useHomeMutations.ts:987:  const promotePlanningConversation = useMutation({
src/app/home/useHomeMutations.ts:1012:  const startPlanningReview = useMutation({
src/app/home/useHomeMutations.ts:1013:    mutationFn: async (payload: { runId: string; agentSelection: PlanningReviewAgentSelection; rounds: number }) => requestJson<{ ok: true; reviewRunId: string }>(`/api/planning/${payload.runId}/review`, {
src/app/home/useHomeMutations.ts:1081:    promotePlanningConversation,
src/app/home/useHomeMutations.ts:1082:    startPlanningReview,
src/app/home/PlanningReviewPreferencesManager.ts:8:  normalizePlanningReviewAgentSelection,
src/app/home/PlanningReviewPreferencesManager.ts:9:  normalizePlanningReviewRounds,
src/app/home/PlanningReviewPreferencesManager.ts:10:  type PlanningReviewAgentSelection,
src/app/home/PlanningReviewPreferencesManager.ts:13:export type PlanningReviewPreferencesState = {
src/app/home/PlanningReviewPreferencesManager.ts:14:  agentSelection: PlanningReviewAgentSelection;
src/app/home/PlanningReviewPreferencesManager.ts:21:const initialState: PlanningReviewPreferencesState = {
src/app/home/PlanningReviewPreferencesManager.ts:29:export class PlanningReviewPreferencesManager extends StateManager<PlanningReviewPreferencesState> {
src/app/home/PlanningReviewPreferencesManager.ts:35:    const agentSelection = normalizePlanningReviewAgentSelection(settings[PLANNING_REVIEW_AGENT_SELECTION_SETTING]);
src/app/home/PlanningReviewPreferencesManager.ts:36:    const rounds = normalizePlanningReviewRounds(settings[PLANNING_REVIEW_ROUNDS_SETTING]);
src/app/home/PlanningReviewPreferencesManager.ts:48:  async setAgentSelection(value: PlanningReviewAgentSelection) {
src/app/home/PlanningReviewPreferencesManager.ts:61:    const normalized = normalizePlanningReviewRounds(value);
src/app/home/PlanningReviewPreferencesManager.ts:88:export const planningReviewPreferencesManager = new PlanningReviewPreferencesManager();
src/app/home/PlanningReviewPreferencesManager.ts:91:  setAgentSelection: (value: PlanningReviewAgentSelection) => planningReviewPreferencesManager.setAgentSelection(value),
src/components/home/ConversationMain.tsx:24:import type { AgentSnapshot, ExecutionEventRecord, MessageRecord, NoticeDescriptor, RunRecord, PlanningReviewRunRecord, PlanningReviewRoundRecord, PlanningReviewFindingRecord } from "@/app/home/types";
src/components/home/ConversationMain.tsx:38:import { type PlanningReviewAgentSelection } from "@/server/planning/review-preferences";
src/components/home/ConversationMain.tsx:574:  isPlanningConversation: boolean;
src/components/home/ConversationMain.tsx:588:  promotePlanningConversation: {
src/components/home/ConversationMain.tsx:592:  onStartReview?: (prefs: { agentSelection: PlanningReviewAgentSelection; rounds: number }) => void;
src/components/home/ConversationMain.tsx:593:  reviewRuns?: PlanningReviewRunRecord[];
src/components/home/ConversationMain.tsx:594:  reviewRounds?: PlanningReviewRoundRecord[];
src/components/home/ConversationMain.tsx:595:  reviewFindings?: PlanningReviewFindingRecord[];
src/components/home/ConversationMain.tsx:718:export function ConversationMain({
src/components/home/ConversationMain.tsx:724:  isPlanningConversation,
src/components/home/ConversationMain.tsx:738:  promotePlanningConversation,
src/components/home/ConversationMain.tsx:739:  onStartReview,
src/components/home/ConversationMain.tsx:742:  reviewFindings = [],
src/components/home/ConversationMain.tsx:1091:              const speakerLabel = (isPlanningConversation && msg.role === "worker") || isPlanningWorkerMessage
src/components/home/ConversationMain.tsx:1145:                ) : (isPlanningConversation && msg.role === "worker") || isPlanningWorkerMessage ? (
src/components/home/ConversationMain.tsx:1219:          {isPlanningConversation ? (
src/components/home/ConversationMain.tsx:1224:              isPromoting={promotePlanningConversation.isPending}
src/components/home/ConversationMain.tsx:1231:              reviewFindings={reviewFindings.filter(f => f.reviewRunId === reviewRuns[0]?.id)}
src/components/home/ConversationMain.tsx:1232:              onStartReview={onStartReview}
src/components/home/ConversationMain.tsx:1238:                promotePlanningConversation.mutate({ runId: selectedRunId, planPath });

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:36:25.491Z","phase":null} -->
## Tool result: call_F3IJhAhPm36br6x1zX8Js2vS · 2026-06-14T16:36:25.491Z

```text
Chunk ID: 0b4b1d
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1724
Output:
src/components/ConversationModePicker.tsx:6:export type ConversationModeOption = "implementation" | "planning" | "direct";
src/components/ConversationModePicker.tsx:8:const MODE_COPY_KEYS: Record<ConversationModeOption, { label: string; description: string }> = {
src/components/ConversationModePicker.tsx:10:    label: "conversation.mode.planning.label",
src/components/ConversationModePicker.tsx:11:    description: "conversation.mode.planning.description",
src/components/ConversationModePicker.tsx:14:    label: "conversation.mode.implementation.label",
src/components/ConversationModePicker.tsx:15:    description: "conversation.mode.implementation.description",
src/components/ConversationModePicker.tsx:18:    label: "conversation.mode.direct.label",
src/components/ConversationModePicker.tsx:19:    description: "conversation.mode.direct.description",
src/components/ConversationModePicker.tsx:23:const MODE_ORDER: ConversationModeOption[] = ["direct", "planning", "implementation"];
src/components/ConversationModePicker.tsx:25:export function getConversationModeCopy(mode: ConversationModeOption) {
src/components/ConversationModePicker.tsx:34:export function ConversationModePicker({
src/components/ConversationModePicker.tsx:39:  value: ConversationModeOption;
src/components/ConversationModePicker.tsx:40:  onChange: (mode: ConversationModeOption) => void;
src/components/ConversationModePicker.tsx:44:  const activeCopy = getConversationModeCopy(value);
src/components/ConversationModePicker.tsx:51:            const config = getConversationModeCopy(mode);
src/components/home/ConversationComposer.tsx:8:import { ConversationModePicker, type ConversationModeOption } from "@/components/ConversationModePicker";
src/components/home/ConversationComposer.tsx:30:  selectedConversationMode: ConversationModeOption;
src/components/home/ConversationComposer.tsx:31:  setSelectedConversationMode: (value: ConversationModeOption) => void;
src/components/home/ConversationComposer.tsx:89:  selectedConversationMode,
src/components/home/ConversationComposer.tsx:90:  setSelectedConversationMode,
src/components/home/ConversationComposer.tsx:156:    ? selectedConversationMode === "planning"
src/components/home/ConversationComposer.tsx:158:      : selectedConversationMode === "direct"
src/components/home/ConversationComposer.tsx:181:        <ConversationModePicker
src/components/home/ConversationComposer.tsx:182:          value={selectedConversationMode}
src/components/home/ConversationComposer.tsx:183:          onChange={setSelectedConversationMode}
src/app/home/types.ts:2:import type { ConversationModeOption } from "@/components/ConversationModePicker";
src/app/home/types.ts:9:export type { ConversationModeOption };
src/app/home/types.ts:11:export type RunMode = ConversationModeOption | "commit";
src/app/home/ComposerContainer.tsx:21:  ConversationModeOption,
src/app/home/ComposerContainer.tsx:42:  selectedConversationMode: ConversationModeOption;
src/app/home/ComposerContainer.tsx:43:  setSelectedConversationMode: (value: ConversationModeOption) => void;
src/app/home/ComposerContainer.tsx:81:  selectedConversationMode,
src/app/home/ComposerContainer.tsx:82:  setSelectedConversationMode,
src/app/home/ComposerContainer.tsx:156:    forceSteer: selectedConversationMode === "implementation",
src/app/home/ComposerContainer.tsx:200:      selectedConversationMode={selectedConversationMode}
src/app/home/ComposerContainer.tsx:201:      setSelectedConversationMode={setSelectedConversationMode}
src/app/home/useHomeMutations.ts:33:  ConversationModeOption,
src/app/home/useHomeMutations.ts:305:  selectedConversationMode: ConversationModeOption;
src/app/home/useHomeMutations.ts:324:  selectedConversationMode,
src/app/home/useHomeMutations.ts:670:          mode: selectedConversationMode,
src/app/home/useHomeMutations.ts:699:        mode: selectedConversationMode,
src/app/home/useConversationActions.ts:74:    setSelectedConversationMode,
src/app/home/useConversationActions.ts:85:    setSelectedConversationMode("direct");
src/app/home/useConversationActions.ts:131:    setSelectedConversationMode("direct");
src/app/home/useRunSelectionEffects.ts:5:import type { ConversationModeOption } from "@/components/ConversationModePicker";
src/app/home/useRunSelectionEffects.ts:108:  activeComposerMode: ConversationModeOption;
src/app/home/useHomeLifecycle.ts:5:import type { ConversationModeOption } from "@/components/ConversationModePicker";
src/app/home/useHomeLifecycle.ts:46:  setSelectedConversationMode: React.Dispatch<React.SetStateAction<ConversationModeOption>>;
src/app/home/useHomeLifecycle.ts:60:  selectedConversationMode: ConversationModeOption;
src/app/home/useHomeLifecycle.ts:99:  setSelectedConversationMode,
src/app/home/useHomeLifecycle.ts:113:  selectedConversationMode,
src/app/home/useHomeLifecycle.ts:201:        setSelectedConversationMode(savedMode);
src/app/home/useHomeLifecycle.ts:208:      setSelectedConversationMode("direct");
src/app/home/useHomeLifecycle.ts:225:    setSelectedConversationMode,
src/app/home/useHomeLifecycle.ts:503:    window.localStorage.setItem(COMPOSER_MODE_STORAGE_KEY, selectedConversationMode);
src/app/home/useHomeLifecycle.ts:504:  }, [selectedConversationMode]);
src/app/home/HomeUiStateManager.ts:5:import type { ComposerWorkerOption, ConversationModeOption, ConversationSidebarTab, EventStreamState, LlmProfileTab, MessageRecord, SettingsTab } from "./types";
src/app/home/HomeUiStateManager.ts:79:  selectedConversationMode: ConversationModeOption;
src/app/home/HomeUiStateManager.ts:129:  selectedConversationMode: "direct",
src/app/home/HomeUiStateManager.ts:332:  setSelectedConversationMode: homeUiStateManager.createSetter("selectedConversationMode"),
src/app/home/HomeApp.tsx:224:    selectedConversationMode,
src/app/home/HomeApp.tsx:266:    setSelectedConversationMode,
src/app/home/HomeApp.tsx:450:    selectedConversationMode,
src/app/home/HomeApp.tsx:582:    selectedConversationMode,
src/app/home/HomeApp.tsx:669:    setSelectedConversationMode,
src/app/home/HomeApp.tsx:683:    selectedConversationMode,
src/app/home/HomeApp.tsx:1067:      selectedConversationMode={activeComposerMode}
src/app/home/HomeApp.tsx:1068:      setSelectedConversationMode={setSelectedConversationMode}
src/app/home/useHomeViewModel.ts:20:import type { AgentSnapshot, ClarificationRecord, ComposerWorkerOption, ConversationModeOption, EventStreamState, ExecutionEventRecord, MessageRecord, NoticeDescriptor, PlanRecord, RunMode, RunRecord, SidebarGroup, SupervisorInterventionRecord } from "./types";
src/app/home/useHomeViewModel.ts:28:  selectedConversationMode: ConversationModeOption;
src/app/home/useHomeViewModel.ts:42:  selectedConversationMode,
src/app/home/useHomeViewModel.ts:68:  const activeComposerMode: ConversationModeOption = selectedRun
src/app/home/useHomeViewModel.ts:70:    : selectedConversationMode;

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:36:25.491Z","phase":null} -->
## Tool result: call_h2PdF8qiSCyBKgicQ2pGaayx · 2026-06-14T16:36:25.491Z

```text
Chunk ID: 5568b9
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 496
Output:
You are the OmniHarness planning agent.

Your job is to help the user inspect the repository, ask clarifying questions when needed, and write a spec and implementation plan from scratch.

Requirements:
- Inspect the current repository before proposing architecture.
- Ask clarifying questions before writing final artifacts whenever the request is underspecified. Treat missing user outcome, scope boundaries, success criteria, risky workflow details, UX decisions, testing expectations, or preferred technical direction as reasons to ask.
- Keep clarification turns focused. Ask a small set of high-leverage questions, not a long questionnaire.
- Skip questions only when the request is already concrete enough to produce a safe spec and implementation plan.
- Write a spec file and an implementation plan file.
- Capture the high-level objective in the spec or plan so implementation supervision can judge completion against the user's intent, not only against checklist wording.
- The project root for this conversation is: {{project_root}}
- Always write spec and plan files using absolute paths under that project root. Do not write planning artifacts into your own sandbox, temp directory, or any path outside the project root — implementation will not be able to find them there.
- Prefer standard locations when possible:
  - specs in {{project_root}}/docs/superpowers/specs/
  - plans in {{project_root}}/docs/superpowers/plans/
- Report where the files were saved using their absolute paths.
- Do not start implementation.

When you believe planning is ready, emit this exact handoff block in plain text, using the same absolute paths under the project root:

<omniharness-plan-handoff>
spec_path: /absolute/path/under/project_root/to/spec.md
plan_path: /absolute/path/under/project_root/to/plan.md
ready: yes
summary: one short sentence
</omniharness-plan-handoff>

If planning is not ready yet, continue the planning conversation instead of emitting the handoff block.

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:36:25.521Z","phase":null} -->
## Tool result: call_7FasGqxba5E8m6nNAIjkU1CX · 2026-06-14T16:36:25.521Z

```text
Chunk ID: 1b3ee0
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2107
Output:
import { createHash } from "crypto";
import fs from "fs";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { runs } from "@/server/db/schema";
import { parsePlan } from "@/server/plans/parser";
import {
  assessPlanStructure,
  describeStructuralGaps,
  structureHasBlockingGaps,
  type PlanStructuralFacts,
} from "@/server/plans/readiness";
import {
  assessPlanReadinessWithLLM,
  type PlanReadinessVerdict,
} from "@/server/plans/readiness-llm";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";

export type PlanReadinessAnalysisStatus =
  | "analyzing"
  | "ready"
  | "fallback";

export interface PlanReadinessRecord {
  status: PlanReadinessAnalysisStatus;
  planPath: string;
  planHash: string;
  specHash: string | null;
  structure: PlanStructuralFacts;
  verdict: PlanReadinessVerdict | null;
  fallbackHeadline: string | null;
  error: string | null;
  generatedAt: number;
}

interface VerdictMap {
  [planHash: string]: PlanReadinessRecord;
}

const inFlight = new Map<string, Promise<PlanReadinessRecord>>();

// Cached "analyzing" records older than this are treated as crashed and the
// pipeline re-issues the call.
const STALE_ANALYZING_MS = 60_000;
// Minimum interval between LLM calls per run, regardless of plan hash, to
// protect against runaway flushes producing many distinct hashes in a burst.
const RUN_RATE_LIMIT_MS = 5_000;

const lastCallByRun = new Map<string, number>();

function hashString(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function hashPlanMarkdown(markdown: string) {
  return hashString(markdown);
}

function inflightKey(runId: string, planHash: string) {
  return `${runId}:${planHash}`;
}

function readFileSafely(filePath: string | null | undefined): string | null {
  if (!filePath) return null;
  try {
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function parseVerdictMap(value: string | null | undefined): VerdictMap {
  if (!value?.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object") {
      return parsed as VerdictMap;
    }
  } catch {
    // fall through to empty
  }
  return {};
}

export function deriveFallbackHeadline(structure: PlanStructuralFacts, gaps: string[]): string {
  if (structure.itemCount === 0) {
    return "Plan file has no checklist items — open it, add concrete tasks, and try again.";
  }

  const concerns: string[] = [];
  if (structure.itemsWithStubTitle.length > 0) {
    concerns.push(`${structure.itemsWithStubTitle.length} item(s) are stubs`);
  }
  if (structure.itemsMissingVerify.length === structure.itemCount && !structure.hasAcceptanceCriteria) {
    concerns.push("no Verify lines and no acceptance criteria");
  } else if (structure.itemsMissingVerify.length > 0 && !structure.hasAcceptanceCriteria) {
    concerns.push(`${structure.itemsMissingVerify.length} item(s) have no Verify line`);
  }
  if (structure.itemsWithVagueTitle.length > 0) {
    concerns.push(`${structure.itemsWithVagueTitle.length} item(s) have vague titles`);
  }

  if (concerns.length === 0 && gaps.length === 0) {
    return "Plan detected — review the file below before starting implementation.";
  }

  if (concerns.length === 0) {
    return `Plan detected — ${gaps[0]}`;
  }

  return `Plan detected — ${concerns.join("; ")}. Review before implementation.`;
}

export function readinessRecordIsReady(record: PlanReadinessRecord | null | undefined): boolean {
  if (!record) return false;
  if (record.status === "analyzing") return false;
  if (record.verdict) {
    return record.verdict.verdict === "ready";
  }
  return !structureHasBlockingGaps(record.structure);
}

export function readinessRecordHeadline(record: PlanReadinessRecord | null | undefined): string | null {
  if (!record) return null;
  if (record.verdict) return record.verdict.headline;
  return record.fallbackHeadline;
}

export async function loadCachedReadinessRecord(args: {
  runId: string;
  planPath: string;
  planHash: string;
}): Promise<PlanReadinessRecord | null> {
  const row = await db.select({ json: runs.plannerReadinessVerdictJson }).from(runs).where(eq(runs.id, args.runId)).get();
  const map = parseVerdictMap(row?.json ?? null);
  const cached = map[args.planHash];
  if (cached && cached.planPath === args.planPath) {
    return cached;
  }
  return null;
}

async function persistReadinessRecord(args: { runId: string; record: PlanReadinessRecord }) {
  const row = await db
    .select({
      verdictJson: runs.plannerReadinessVerdictJson,
      artifactsJson: runs.plannerArtifactsJson,
    })
    .from(runs)
    .where(eq(runs.id, args.runId))
    .get();
  const map = parseVerdictMap(row?.verdictJson ?? null);

  // Keep map bounded — only retain entries that are not the newest one for each plan path.
  const trimmed: VerdictMap = {};
  const entries = Object.entries(map);
  // Sort newest first so we keep recency.
  entries.sort((a, b) => b[1].generatedAt - a[1].generatedAt);
  let kept = 0;
  for (const [hash, record] of entries) {
    if (kept >= 16) break;
    trimmed[hash] = record;
    kept += 1;
  }
  trimmed[args.record.planHash] = args.record;

  // Also patch the candidate's readinessRecord inside plannerArtifactsJson so
  // the artifacts panel sees the latest verdict without waiting for a fresh
  // refreshPlanningArtifactsForRun pass.
  const artifactsJson = patchArtifactsJsonWithRecord(row?.artifactsJson ?? null, args.record);

  await db.update(runs).set({
    plannerReadinessVerdictJson: JSON.stringify(trimmed),
    ...(artifactsJson !== null ? { plannerArtifactsJson: artifactsJson } : {}),
    updatedAt: new Date(),
  }).where(eq(runs.id, args.runId));
}

function patchArtifactsJsonWithRecord(
  artifactsJson: string | null | undefined,
  record: PlanReadinessRecord,
): string | null {
  if (!artifactsJson?.trim()) return null;
  let parsed: { candidates?: Array<{ path?: string; readinessRecord?: unknown }> };
  try {
    parsed = JSON.parse(artifactsJson);
  } catch {
    return null;
  }
  const candidates = Array.isArray(parsed.candidates) ? parsed.candidates : null;
  if (!candidates) return null;
  let mutated = false;
  for (const candidate of candidates) {
    if (candidate?.path === record.planPath) {
      candidate.readinessRecord = record;
      mutated = true;
    }
  }
  return mutated ? JSON.stringify(parsed) : null;
}

export interface BuildReadinessArgs {
  runId: string;
  planPath: string;
  planMarkdown: string;
  specPath: string | null;
  specMarkdown: string | null;
}

function buildBaseRecord(args: BuildReadinessArgs): Omit<PlanReadinessRecord, "status" | "verdict" | "fallbackHeadline" | "error"> & {
  fallbackHeadline: string;
} {
  const parsed = parsePlan(args.planMarkdown);
  const structure = assessPlanStructure(parsed);
  const gaps = describeStructuralGaps(parsed, structure);
  return {
    planPath: args.planPath,
    planHash: hashString(args.planMarkdown),
    specHash: args.specMarkdown ? hashString(args.specMarkdown) : null,
    structure,
    fallbackHeadline: deriveFallbackHeadline(structure, gaps),
    generatedAt: Date.now(),
  };
}

export function buildStructuralReadinessRecord(args: BuildReadinessArgs): PlanReadinessRecord {
  const base = buildBaseRecord(args);
  return {
    ...base,
    status: "fallback",
    verdict: null,
    error: null,
  };
}

export async function ensureReadinessVerdict(args: BuildReadinessArgs): Promise<PlanReadinessRecord> {
  const base = buildBaseRecord(args);

  const cached = await loadCachedReadinessRecord({
    runId: args.runId,
    planPath: args.planPath,
    planHash: base.planHash,
  });
  if (cached) {
    // "ready" verdicts are final, "fallback" entries are returned as-is to
    // avoid hammering the LLM when it is unavailable, and "analyzing" usually
    // means another caller has a request in flight. The exception: an
    // "analyzing" record older than STALE_ANALYZING_MS means a previous
    // process exited mid-call and never finalized — re-trigger.
    if (cached.status !== "analyzing" || Date.now() - cached.generatedAt <= STALE_ANALYZING_MS) {
      return cached;
    }
  }

  const key = inflightKey(args.runId, base.planHash);
  const existing = inFlight.get(key);
  if (existing) {
    return existing;
  }

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:36:33.482Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:36:33.482Z

Existing planning artifacts already have an expandable panel with readiness, review controls, findings, and promote actions. I’m treating that as the UI pattern to extend: an advisor-results panel can reuse that mental model with result cards, approval state, and a chat/refine action per card.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:36:33.485Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:36:33.485Z

```json
{
  "cmd": "sed -n '1,380p' src/components/PlanningArtifactsPanel.tsx",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 50000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:36:33.486Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:36:33.486Z

```json
{
  "cmd": "sed -n '1,260p' src/components/PlanningReviewControls.tsx",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 28000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:36:33.494Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:36:33.494Z

```json
{
  "cmd": "sed -n '1180,1260p' src/components/home/ConversationMain.tsx",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 22000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:36:33.543Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:36:33.543Z

```json
{
  "cmd": "sed -n '1,120p' src/components/ConversationModePicker.tsx",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:36:33.563Z","phase":null} -->
## Tool result: call_wH8i1GKQpkE51RoVW3fL8HU4 · 2026-06-14T16:36:33.563Z

```text
Chunk ID: fec58c
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2962
Output:
// Wired up PlanningReviewControls
"use client";

import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { planningArtifactsManager } from "@/components/component-state-managers";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
import type { ProjectFileReference } from "@/lib/project-file-links";
import { PlanningReviewControls } from "./PlanningReviewControls";
import { planningReviewPreferencesManager } from "@/app/home/PlanningReviewPreferencesManager";
import { type PlanningReviewRunRecord, type PlanningReviewRoundRecord, type PlanningReviewFindingRecord } from "@/app/home/types";
import { type PlanningReviewAgentSelection } from "@/server/planning/review-preferences";

type ReadinessConcern = {
  kind?: string;
  itemIndex?: number | null;
  detail?: string;
};

type ReadinessVerdict = {
  verdict?: "ready" | "needs_review" | "needs_rewrite";
  headline?: string;
  topConcern?: string | null;
  concerns?: ReadinessConcern[];
  rationale?: string;
  confidence?: number;
};

type ReadinessRecord = {
  status?: "analyzing" | "ready" | "fallback";
  verdict?: ReadinessVerdict | null;
  fallbackHeadline?: string | null;
  error?: string | null;
};

type Candidate = {
  path: string;
  kind: "spec" | "plan" | "unknown";
  source?: string;
  confidence?: number;
  exists?: boolean;
  readiness?: {
    ready?: boolean;
    gaps?: string[];
  } | null;
  readinessRecord?: ReadinessRecord | null;
};

type ArtifactsPayload = {
  specPath?: string | null;
  planPath?: string | null;
  candidates?: Candidate[];
};

function normalizeArtifacts(value: string | null | undefined): ArtifactsPayload {
  if (!value?.trim()) {
    return {};
  }

  try {
    return JSON.parse(value) as ArtifactsPayload;
  } catch {
    return {};
  }
}

function normalizePath(value: string) {
  return value.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
}

function resolveProjectFileReference(pathValue: string | null, projectRoot?: string | null): ProjectFileReference | null {
  const normalizedRoot = normalizePath(projectRoot ?? "");
  const normalizedPath = normalizePath(pathValue ?? "");
  if (!normalizedRoot || !normalizedPath) {
    return null;
  }

  if (normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`)) {
    const relativePath = normalizedPath.slice(normalizedRoot.length).replace(/^\/+/, "");
    return relativePath ? { root: normalizedRoot, relativePath } : null;
  }

  if (!normalizedPath.startsWith("/")) {
    return { root: normalizedRoot, relativePath: normalizedPath };
  }

  return null;
}

function displayProjectPath(pathValue: string | null, projectRoot?: string | null) {
  if (!pathValue) {
    return "";
  }

  const reference = resolveProjectFileReference(pathValue, projectRoot);
  return reference ? reference.relativePath : pathValue;
}

function PlanningArtifactFileLink({
  label,
  pathValue,
  projectRoot,
  onOpenProjectFile,
}: {
  label: string;
  pathValue: string | null;
  projectRoot?: string | null;
  onOpenProjectFile?: (file: ProjectFileReference) => void;
}) {
  const reference = resolveProjectFileReference(pathValue, projectRoot);
  const displayPath = displayProjectPath(pathValue, projectRoot);
  const content = (
    <>
      <span className="shrink-0 font-medium text-muted-foreground">{label}</span>
      <span className="min-w-0 break-all font-mono text-[12px] text-foreground">{displayPath}</span>
    </>
  );

  if (!reference || !onOpenProjectFile) {
    return (
      <span className="flex min-w-0 max-w-full items-baseline gap-2">
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      className="flex min-w-0 max-w-full items-baseline gap-2 text-left underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
      onClick={() => onOpenProjectFile(reference)}
      title={t("planning.artifacts.openFileTitle", { path: displayPath })}
      aria-label={t("planning.artifacts.openFile", { label })}
    >
      {content}
    </button>
  );
}

export function PlanningArtifactsPanel({
  specPath,
  planPath,
  plannerArtifactsJson,
  onPromote,
  isPromoting,
  projectRoot,
  onOpenProjectFile,
  runId,
  isReviewing,
  latestReviewRun,
  latestReviewRound,
  reviewFindings,
  onStartReview,
}: {
  specPath?: string | null;
  planPath?: string | null;
  plannerArtifactsJson?: string | null;
  onPromote: (planPath: string | null) => void;
  isPromoting?: boolean;
  projectRoot?: string | null;
  onOpenProjectFile?: (file: ProjectFileReference) => void;
  runId?: string;
  isReviewing?: boolean;
  latestReviewRun?: PlanningReviewRunRecord | null;
  latestReviewRound?: PlanningReviewRoundRecord | null;
  reviewFindings?: PlanningReviewFindingRecord[];
  onStartReview?: (prefs: { agentSelection: PlanningReviewAgentSelection; rounds: number }) => void;
}) {
  useI18nSnapshot();
  const { isExpanded: isReviewPanelExpanded } = useManagerSnapshot(planningReviewPreferencesManager);
  const artifacts = useMemo(() => normalizeArtifacts(plannerArtifactsJson), [plannerArtifactsJson]);
  const allCandidates = artifacts.candidates ?? [];
  const allPlanCandidates = (artifacts.candidates ?? []).filter((candidate) => candidate.kind === "plan");
  const handoffPlanCandidates = allPlanCandidates.filter((candidate) => candidate.source === "handoff");
  const planCandidates = handoffPlanCandidates.length > 0 ? handoffPlanCandidates : allPlanCandidates;
  const { selectedPlanPath: managerSelectedPlanPath } = useManagerSnapshot(planningArtifactsManager);
  const hasArtifactSignal = Boolean(specPath || planPath || artifacts.specPath || artifacts.planPath || allCandidates.length > 0);
  const candidatePaths = new Set(planCandidates.map((candidate) => candidate.path));
  const currentManagerSelectedPlanPath = managerSelectedPlanPath && candidatePaths.has(managerSelectedPlanPath)
    ? managerSelectedPlanPath
    : null;
  const selectedPlanPath = currentManagerSelectedPlanPath || planPath || artifacts.planPath || planCandidates[0]?.path || null;

  const selectedCandidate = planCandidates.find((candidate) => candidate.path === selectedPlanPath) ?? null;
  const record = selectedCandidate?.readinessRecord ?? null;
  const recordStatus = record?.status ?? null;
  const verdict = record?.verdict?.verdict ?? null;
  const headlineText = record?.verdict?.headline?.trim() || record?.fallbackHeadline?.trim() || null;
  const concerns = record?.verdict?.concerns ?? [];
  const rationale = record?.verdict?.rationale?.trim() || null;

  const legacyReady = !selectedCandidate?.readiness || selectedCandidate.readiness.ready !== false;
  const isAnalyzing = recordStatus === "analyzing";
  const canStartByVerdict = verdict
    ? verdict !== "needs_rewrite"
    : legacyReady;
  const needsConfirmation = verdict === "needs_review";
  const canStart = Boolean(selectedPlanPath) && !isAnalyzing && !isPromoting && canStartByVerdict;

  const displayHeadline = isAnalyzing
    ? t("planning.artifacts.analyzingPrompt")
    : headlineText || t("planning.artifacts.fallbackPrompt");

  const resolvedSpecPath = specPath || artifacts.specPath || null;
  const otherPlanCandidates = planCandidates.filter((candidate) => candidate.path !== selectedPlanPath);

  if (!hasArtifactSignal) {
    return null;
  }

  const handleStartImplementation = () => {
    if (needsConfirmation) {
      const ok = typeof window !== "undefined"
        ? window.confirm(t("planning.artifacts.needsReviewConfirm"))
        : true;
      if (!ok) return;
    }
    planningReviewPreferencesManager.setExpanded(false);
    onPromote(selectedPlanPath);
  };

  return (
    <div className="space-y-3 px-1 text-sm leading-relaxed text-foreground" role="note" aria-label={t("planning.artifacts.ariaLabel")}>
      <div className="space-y-2">
        <p className="flex items-start gap-2">
          {isAnalyzing ? (
            <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
          ) : null}
          <span>{displayHeadline}</span>
        </p>
        {!isAnalyzing && concerns.length > 0 ? (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none hover:text-foreground">
              {t("planning.artifacts.concernsSummary", { count: String(concerns.length) })}
            </summary>
            <ul className="mt-1 space-y-1 pl-4">
              {concerns.map((concern, index) => (
                <li key={index} className="list-disc">
                  {concern.detail || concern.kind || ""}
                </li>
              ))}
            </ul>
            {rationale ? (
              <p className="mt-2 whitespace-pre-wrap text-[11px] leading-snug">{rationale}</p>
            ) : null}
          </details>
        ) : null}
        <div className="space-y-1.5">
          {resolvedSpecPath ? (
            <PlanningArtifactFileLink
              label={t("planning.artifacts.spec")}
              pathValue={resolvedSpecPath}
              projectRoot={projectRoot}
              onOpenProjectFile={onOpenProjectFile}
            />
          ) : null}
          {selectedPlanPath ? (
            <PlanningArtifactFileLink
              label={t("planning.artifacts.plan")}
              pathValue={selectedPlanPath}
              projectRoot={projectRoot}
              onOpenProjectFile={onOpenProjectFile}
            />
          ) : null}
        </div>
        {otherPlanCandidates.length > 0 ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{t("planning.artifacts.otherPlans")}</span>
            {otherPlanCandidates.map((candidate) => (
              <button
                key={candidate.path}
                type="button"
                onClick={() => planningArtifactsManager.setSelectedPlanPath(candidate.path)}
                className="max-w-full truncate font-mono text-[11px] text-foreground/85 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
              >
                {displayProjectPath(candidate.path, projectRoot)}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            planningReviewPreferencesManager.setExpanded(false);
            document.querySelector<HTMLTextAreaElement>("[data-composer-input='true']")?.focus();
          }}
        >
          {t("planning.artifacts.continueRevising")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={verdict && verdict !== "ready" ? "default" : "outline"}
          aria-expanded={isReviewPanelExpanded}
          onClick={() => planningReviewPreferencesManager.setExpanded(!isReviewPanelExpanded)}
        >
          {t("planning.artifacts.improvePlan")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canStart}
          onClick={handleStartImplementation}
        >
          {t("planning.artifacts.startImplementation")}
        </Button>
      </div>

      {runId && onStartReview && isReviewPanelExpanded && (
        <PlanningReviewControls
          isReviewing={Boolean(isReviewing)}
          latestReviewRun={latestReviewRun}
          latestReviewRound={latestReviewRound}
          findings={reviewFindings}
          onStartReview={onStartReview}
        />
      )}
    </div>
  );
}

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:36:33.563Z","phase":null} -->
## Tool result: call_NBDikTfSbF34lZPWwMkrS2bj · 2026-06-14T16:36:33.563Z

```text
Chunk ID: bb65ea
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2121
Output:
// Implemented Planning Review UI
"use client";

import React from "react";
import { t, useI18nSnapshot } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useManagerSnapshot } from "@/lib/use-manager-snapshot";
import { planningReviewPreferencesManager, planningReviewPreferencesSetters } from "@/app/home/PlanningReviewPreferencesManager";
import { Button } from "./ui/button";
import { type PlanningReviewRunRecord, type PlanningReviewRoundRecord, type PlanningReviewFindingRecord } from "@/app/home/types";
import { ChevronDown, ChevronUp, Play, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { type PlanningReviewAgentSelection } from "@/server/planning/review-preferences";

interface PlanningReviewControlsProps {
  isReviewing: boolean;
  latestReviewRun?: PlanningReviewRunRecord | null;
  latestReviewRound?: PlanningReviewRoundRecord | null;
  findings?: PlanningReviewFindingRecord[];
  onStartReview: (prefs: { agentSelection: PlanningReviewAgentSelection; rounds: number }) => void;
}

export function PlanningReviewControls({
  isReviewing,
  latestReviewRun,
  latestReviewRound,
  findings = [],
  onStartReview,
}: PlanningReviewControlsProps) {
  useI18nSnapshot();
  const { agentSelection, rounds, isExpanded, isSaving, isStarting } = useManagerSnapshot(planningReviewPreferencesManager);

  const agents: PlanningReviewAgentSelection[] = ["auto", "same", "codex", "claude", "gemini", "opencode"];

  React.useEffect(() => {
    if (isReviewing && isStarting) {
      planningReviewPreferencesManager.setStarting(false);
    }
  }, [isReviewing, isStarting]);

  const handleStart = () => {
    planningReviewPreferencesManager.setStarting(true);
    try {
      onStartReview({ agentSelection, rounds });
    } catch (error) {
      planningReviewPreferencesManager.setStarting(false);
      throw error;
    }
  };

  const showSpinner = isReviewing || isStarting;

  const statusText = React.useMemo(() => {
    if (!latestReviewRun) return null;

    const totalRounds = latestReviewRun.roundsRequested;
    const currentRoundNumber = latestReviewRound?.roundNumber ?? (latestReviewRun.status === "completed" ? totalRounds : Math.min(latestReviewRun.roundsCompleted + 1, totalRounds));
    const progress = totalRounds > 1 ? ` (${currentRoundNumber}/${totalRounds})` : "";

    if (latestReviewRun.status === "running") {
      if (latestReviewRound?.status === "reviewing") return t("planning.review.reviewing") + progress;
      if (latestReviewRound?.status === "revising") return t("planning.review.revising") + progress;
      return t("planning.review.starting") + progress;
    }
    if (latestReviewRun.status === "completed") return t("planning.review.completed");
    if (latestReviewRun.status === "failed") return t("planning.review.failed") + progress;
    return null;
  }, [latestReviewRun, latestReviewRound]);

  const roundsLabel = rounds === 1 ? t("planning.review.roundsValue.one") : t("planning.review.roundsValue.other", { count: rounds });
  const findingsSummary = findings.length === 1 ? t("planning.review.findingsSummary.one") : t("planning.review.findingsSummary.other", { count: findings.length });

  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
      <button
        type="button"
        onClick={() => planningReviewPreferencesManager.setExpanded(!isExpanded)}
        className="flex w-full items-center justify-between gap-2 text-left text-foreground hover:text-primary transition-colors"
      >
        <span className="flex flex-col gap-0.5">
          <span className="flex items-center gap-2 text-sm font-medium">
            {t("planning.review.expand")}
            {!isExpanded && (
              <span className="text-xs font-normal text-muted-foreground">
                {t(`planning.review.agent.${agentSelection}`)} · {roundsLabel}
              </span>
            )}
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {t("planning.review.expandDescription")}
          </span>
        </span>
        {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("planning.review.agentLabel")}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {agents.map((agent) => (
                <button
                  key={agent}
                  type="button"
                  onClick={() => planningReviewPreferencesSetters.setAgentSelection(agent)}
                  disabled={showSpinner || isSaving}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium border transition-all",
                    agentSelection === agent
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary/50"
                  )}
                >
                  {t(`planning.review.agent.${agent}`)}
                </button>
              ))}
            </div>
            {agentSelection === "auto" && (
              <p className="text-xs text-muted-foreground italic">
                {t("planning.review.autoHelp")}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("planning.review.roundsLabel")}
            </label>
            <div className="flex items-center gap-3">
              {[1, 2, 3, 5].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => planningReviewPreferencesSetters.setRounds(val)}
                  disabled={showSpinner || isSaving}
                  className={cn(
                    "w-8 h-8 rounded-full border flex items-center justify-center text-xs font-medium transition-all",
                    rounds === val
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary/50"
                  )}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <Button
              onClick={handleStart}
              disabled={showSpinner}
              size="sm"
            >
              {showSpinner ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {statusText ?? t("planning.review.starting")}
                </>
              ) : (
                <>
                  <Play className="mr-2 h-3.5 w-3.5" />
                  {t("planning.review.start")}
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {latestReviewRun && !isExpanded && (
        <div className="mt-2 space-y-1">
          <div className="flex items-center gap-2 text-xs">
            {latestReviewRun.status === "running" ? (
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
            ) : latestReviewRun.status === "completed" ? (
              <CheckCircle2 className="h-3 w-3 text-green-500" />
            ) : (
              <AlertCircle className="h-3 w-3 text-destructive" />
            )}
            <span className={cn(
              "font-medium",
              latestReviewRun.status === "completed" ? "text-green-600 dark:text-green-400" :
              latestReviewRun.status === "failed" ? "text-destructive" : "text-primary"
            )}>
              {statusText}
            </span>
            {findings.length > 0 && (
              <span className="text-muted-foreground">
                ({findingsSummary})
              </span>
            )}
          </div>
          {latestReviewRun.status === "failed" && (latestReviewRun.lastError || latestReviewRound?.lastError) && (
            <p className="text-xs text-destructive break-words pl-5">
              {latestReviewRun.lastError || latestReviewRound?.lastError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:36:33.563Z","phase":null} -->
## Tool result: call_I6XUJ2huLZLfNKPT3aSyGsoT · 2026-06-14T16:36:33.563Z

```text
Chunk ID: f4722b
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 914
Output:
                              type="button"
                              size="sm"
                              disabled={isPreflightConfirmationAnswering}
                              onClick={() => {
                                preflightConfirmationActionsManager.rememberMessage(msg.id);
                                handlePreflightConfirmationAnswer(PREFLIGHT_CONFIRMATION_APPROVED_RESPONSE);
                              }}
                            >
                              <Check aria-hidden="true" />
                              {t("conversation.preflightConfirmation.yes")}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isPreflightConfirmationAnswering}
                              onClick={() => preflightConfirmationActionsManager.rememberMessage(msg.id)}
                            >
                              <Pencil aria-hidden="true" />
                              {t("conversation.preflightConfirmation.no")}
                            </Button>
                          </div>
                        ) : null}
                      </>
                    ) : msg.content}
                  </div>
                )}
              </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 pt-24 text-sm text-muted-foreground sm:pt-32">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                <Blocks className="h-6 w-6 opacity-50" />
              </div>
              <p>No output recorded yet for this run.</p>
            </div>
          )}

          {isPlanningConversation ? (
            <PlanningArtifactsPanel
              specPath={selectedRun?.specPath}
              planPath={selectedRun?.artifactPlanPath}
              plannerArtifactsJson={selectedRun?.plannerArtifactsJson}
              isPromoting={promotePlanningConversation.isPending}
              projectRoot={projectRoot}
              onOpenProjectFile={onOpenProjectFile}
              runId={selectedRunId ?? undefined}
              isReviewing={selectedRun?.status === "reviewing_plan" || selectedRun?.status === "revising_plan"}
              latestReviewRun={reviewRuns[0]}
              latestReviewRound={reviewRounds.filter(r => r.reviewRunId === reviewRuns[0]?.id).pop()}
              reviewFindings={reviewFindings.filter(f => f.reviewRunId === reviewRuns[0]?.id)}
              onStartReview={onStartReview}
              onPromote={(planPath) => {
                if (!selectedRunId) {
                  return;
                }

                promotePlanningConversation.mutate({ runId: selectedRunId, planPath });
              }}
            />
          ) : null}

          {isImplementationConversation && showConversationExecution ? (
            <ConversationExecutionPanel
              runId={selectedRunId}
              selectedRun={selectedRun}
              liveExecutionStatus={liveExecutionStatus}
              liveThoughts={liveThoughts}
              executionEvents={executionEvents}
              activeWorkers={activeWorkers}
              conversationAgents={conversationAgents}
              onOpenWorkerActivity={onOpenWorkerActivity}
            />
          ) : null}

          {isImplementationConversation ? (
            <RecoveryIncidentInspector
              runId={selectedRunId}
              incidents={recoveryIncidents}
            />

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:36:33.587Z","phase":null} -->
## Tool result: call_EMLnJmFkL5zLENikex5WFPwZ · 2026-06-14T16:36:33.587Z

```text
Chunk ID: f4f2fd
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 698
Output:
"use client";

import { t, useI18nSnapshot } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type ConversationModeOption = "implementation" | "planning" | "direct";

const MODE_COPY_KEYS: Record<ConversationModeOption, { label: string; description: string }> = {
  planning: {
    label: "conversation.mode.planning.label",
    description: "conversation.mode.planning.description",
  },
  implementation: {
    label: "conversation.mode.implementation.label",
    description: "conversation.mode.implementation.description",
  },
  direct: {
    label: "conversation.mode.direct.label",
    description: "conversation.mode.direct.description",
  },
};

const MODE_ORDER: ConversationModeOption[] = ["direct", "planning", "implementation"];

export function getConversationModeCopy(mode: ConversationModeOption) {
  const copy = MODE_COPY_KEYS[mode];

  return {
    label: t(copy.label),
    description: t(copy.description),
  };
}

export function ConversationModePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: ConversationModeOption;
  onChange: (mode: ConversationModeOption) => void;
  disabled?: boolean;
}) {
  useI18nSnapshot();
  const activeCopy = getConversationModeCopy(value);

  return (
    <div className="mb-9 space-y-4">
      <div className="flex w-full justify-center">
        <div className="mx-auto flex w-fit max-w-full rounded-2xl border border-border/70 bg-muted/40 p-1.5 dark:border-white/[0.12] dark:bg-black/[0.12]">
          {MODE_ORDER.map((mode) => {
            const config = getConversationModeCopy(mode);

            return (
              <button
                key={mode}
                type="button"
                className={cn(
                  "min-w-0 shrink rounded-xl border px-3.5 py-2 text-center text-sm font-semibold leading-[1.15] break-words hyphens-auto transition-colors",
                  value === mode
                    ? "border-primary/[0.22] bg-primary/[0.055] text-primary"
                    : "border-transparent text-muted-foreground hover:bg-background/40 hover:text-foreground",
                  disabled && "cursor-not-allowed opacity-60 hover:bg-transparent hover:text-muted-foreground",
                )}
                aria-pressed={value === mode}
                disabled={disabled}
                onClick={() => {
                  if (disabled) {
                    return;
                  }

                  onChange(mode);
                }}
              >
                {config.label}
              </button>
            );
          })}
        </div>
      </div>
      <p className="mx-auto flex h-[10.5rem] max-w-[68ch] items-start justify-center text-[15px] leading-7 text-muted-foreground/90 sm:h-[5.25rem]">{activeCopy.description}</p>
    </div>
  );
}

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:36:41.032Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:36:41.032Z

```json
{
  "cmd": "sed -n '220,370p' src/server/events/persisted-snapshot.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 26000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:36:41.041Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:36:41.041Z

```json
{
  "cmd": "sed -n '1,220p' tests/lifecycle/scenarios/plan-improvement-flow.test.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:36:41.041Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:36:41.041Z

```json
{
  "cmd": "sed -n '1,220p' tests/lifecycle/scenarios/session-types.test.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:36:41.103Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:36:41.103Z

```json
{
  "cmd": "rg -n \"planningReviewRuns|planningReviewRounds|planningReviewFindings|reviewFindings\" src/server/events src/app/home tests -g '!**/*.json'",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 26000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:36:41.120Z","phase":null} -->
## Tool result: call_rGTcsxCTr9SJhxWdtnsKRoot · 2026-06-14T16:36:41.120Z

```text
Chunk ID: 2a21f4
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1575
Output:
    lastError: record.lastError,
    attachments: normalizeChatAttachments(record.attachmentsJson ? JSON.parse(record.attachmentsJson) : []),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    deliveredAt: record.deliveredAt?.toISOString() ?? null,
  };
}

export async function buildPersistedEventPayload(options: EventPayloadOptions = {}): Promise<EventStreamState> {
  await reconcileOrphanedProcessSessions();
  await reconcilePersistedReloadZombies({
    selectedRunId: options.selectedRunId,
    source: "persisted-event-payload",
  });
  const requestedSelectedRunId = options.selectedRunId?.trim() || null;
  const allPlans = await db.select().from(plans).orderBy(desc(plans.createdAt), desc(plans.id));
  const allRuns = await db.select().from(runs).where(isNull(runs.archivedAt)).orderBy(desc(runs.createdAt), desc(runs.id));
  const selectedRun = requestedSelectedRunId ? allRuns.find((run) => run.id === requestedSelectedRunId) ?? null : null;
  const selectedRunId = selectedRun?.id ?? null;
  const selectedPlanId = selectedRun?.planId ?? null;
  const transcriptRunIds = selectedRunId
    ? [
        ...(selectedRun?.mode === "implementation" && selectedRun.parentRunId ? [selectedRun.parentRunId] : []),
        selectedRunId,
      ]
    : [];

  const runIds = selectedRunId ? new Set([selectedRunId]) : null;

  const [
    msgs,
    allAccounts,
    allWorkers,
    allPlanItems,
    allClarifications,
    allExecutionEvents,
    allSupervisorInterventions,
    allQueuedMessages,
    allRecoveryIncidents,
    allProcessSessions,
    allReadMarkers,
  ] = await Promise.all([
    selectedRunId
      ? db.select().from(messages).where(inArray(messages.runId, transcriptRunIds)).orderBy(asc(messages.createdAt), asc(messages.id))
      : [],
    db.select().from(accounts),
    selectedRunId
      ? db.select(WORKER_SNAPSHOT_COLUMNS).from(workers).where(eq(workers.runId, selectedRunId)).orderBy(asc(workers.createdAt), asc(workers.id))
      : db.select(WORKER_SNAPSHOT_COLUMNS).from(workers).orderBy(asc(workers.createdAt), asc(workers.id)),
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
    db.select().from(processSessions),
    db.select().from(conversationReadMarkers).where(allRuns.length > 0 ? inArray(conversationReadMarkers.runId, allRuns.map((run) => run.id)) : eq(conversationReadMarkers.runId, "__none__")),
  ]);
  const processSessionsByRunId = new Map<string, typeof allProcessSessions[number]>(
    allProcessSessions.map((session) => [session.runId, session]),
  );
  const workersByRunId = new Map<string, typeof allWorkers[number]>();
  for (const worker of allWorkers) {
    if (!workersByRunId.has(worker.runId)) {
      workersByRunId.set(worker.runId, worker);
    }
  }
  const sessions = allRuns.map((run) => serializeSessionRecord({
    run,
    primaryWorker: workersByRunId.get(run.id) ?? null,
    processSession: processSessionsByRunId.get(run.id) ?? null,
  }));
  const selectedWorkerEntryResults = selectedRunId
    ? await Promise.all(
      allWorkers
        .filter((worker) => worker.runId === selectedRunId)
        .map(async (worker) => {
          const latestSeq = await readWorkerLatestSeq(selectedRunId, worker.id);
          return { workerId: worker.id, latestSeq };
        }),
    )
    : [];
  const selectedWorkerEntrySeqs = Object.fromEntries(
    selectedWorkerEntryResults
      .filter((result) => result.latestSeq > 0)
      .map((result) => [result.workerId, result.latestSeq] as const),
  );
  const lifecycleErrors = buildAwaitingUserQuestionInvariantErrors({
    runs: allRuns,
    messages: msgs,
    clarifications: allClarifications,
    selectedRunId,
  });
  const readMarkers = Object.fromEntries(
    allReadMarkers.map((marker) => [marker.runId, marker.lastReadAt.toISOString()]),
  );

  return withEventPayloadChecksum({
    messages: msgs.map(serializeMessageRecord).filter((message): message is NonNullable<typeof message> => Boolean(message)),
    readMarkers,
    plans: allPlans,
    runs: allRuns.map(serializeRunRecord),
    sessions,
    accounts: allAccounts,
    agents: [],
    workers: allWorkers.map(compactWorkerRecord),
    planItems: allPlanItems,
    clarifications: allClarifications,
    executionEvents: allExecutionEvents.slice(0, EXECUTION_EVENT_LIMIT).map(compactExecutionEvent),
    supervisorInterventions: allSupervisorInterventions.map(compactSupervisorIntervention),
    queuedMessages: allQueuedMessages
      .filter((message) => message.status === "pending" || message.status === "delivering")
      .map(serializeQueuedConversationMessage),
    recoveryIncidents: allRecoveryIncidents.map(compactRecoveryIncident),
    recoveryState: runIds && !isTerminalRunStatus(selectedRun?.status)
      ? deriveRecoveryState(allRecoveryIncidents)
      : null,
    frontendErrors: lifecycleErrors,
    snapshotRunId: selectedRunId,
    messageScope: {
      runIds: transcriptRunIds,
      complete: true,
    },
    snapshotScope: {
      catalog: {
        complete: true,
      },
      executionEvents: {
        limit: EXECUTION_EVENT_LIMIT,
        complete: allExecutionEvents.length < EXECUTION_EVENT_LIMIT,
        oldestCreatedAt: allExecutionEvents.length > 0

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:36:41.120Z","phase":null} -->
## Tool result: call_OdMrYCQgbXYcVlHYZVjqs3Sl · 2026-06-14T16:36:41.120Z

```text
Chunk ID: 4395ca
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1553
Output:
/**
 * Plan improvement end-to-end:
 *   1. Set up a planning run with a ready plan.
 *   2. POST /api/planning/:id/review → review starts.
 *   3. Assert `plan.review.started` + `worker.spawned` (for the reviewer).
 *   4. Drop the SSE, simulate restart (ring reset), reconnect.
 *   5. Verify resync flow surfaces correctly.
 *
 * Closes one of the user-cited workflows: "plan is ready, user
 * requests plan improvement, agents run, server restarts, we
 * reconnect."
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import {
  executionEvents,
  messages,
  planningReviewFindings,
  planningReviewRounds,
  planningReviewRuns,
  plans,
  runs,
  workerCounters,
  workers,
} from "@/server/db/schema";

import * as eventsRoute from "@/app/api/events/route";
import * as reviewRoute from "@/app/api/planning/[id]/review/route";

import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { Chaos, NO_CHAOS } from "../harness/chaos";
import { __resetNamedEventsForTests } from "@/server/events/named-events";

vi.mock("@/server/plans/readiness-pipeline", () => ({
  ensureReadinessVerdict: vi.fn().mockResolvedValue({ verdict: "ready", planHash: "h" }),
  loadCachedReadinessRecord: vi.fn().mockResolvedValue(null),
  hashPlanMarkdown: () => "h",
}));

vi.mock("@/server/planning/refresh", () => ({
  refreshPlanningArtifactsForRun: vi.fn().mockResolvedValue({ status: "ready" }),
}));

vi.mock("@/server/bridge-client", () => ({
  spawnAgent: vi.fn().mockResolvedValue({
    name: "reviewer",
    type: "codex",
    state: "working",
    sessionId: "review-session",
    sessionMode: null,
    cwd: "/tmp",
  }),
  // `askAgent` is what reviewer orchestration awaits. Returning a slow
  // promise lets us observe plan.review.started before the run
  // completes.
  askAgent: vi.fn().mockImplementation(() => new Promise(() => {})),
  getAgent: vi.fn().mockResolvedValue({
    state: "working",
    sessionId: "review-session",
    sessionMode: null,
  }),
  cancelAgent: vi.fn().mockResolvedValue(undefined),
  BRIDGE_URL: "http://localhost:0",
}));

vi.mock("@/server/workers/snapshots", () => ({
  persistWorkerSnapshot: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/workers/ids", async () => {
  const actual = await vi.importActual<typeof import("@/server/workers/ids")>(
    "@/server/workers/ids",
  );
  return actual;
});

let server: LifecycleServer;
let client: LifecycleClient;

const PLAN_ID = "plan-improvement";
const RUN_ID = "run-improvement";

beforeEach(async () => {
  __resetNamedEventsForTests();
  await db.delete(executionEvents);
  await db.delete(messages);
  await db.delete(planningReviewFindings);
  await db.delete(planningReviewRounds);
  await db.delete(planningReviewRuns);
  await db.delete(workers);
  await db.delete(workerCounters);
  await db.delete(runs);
  await db.delete(plans);

  const now = new Date();
  await db.insert(plans).values({
    id: PLAN_ID,
    path: "/tmp/improvement.md",
    status: "pending",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(runs).values({
    id: RUN_ID,
    planId: PLAN_ID,
    mode: "planning",
    projectPath: "/tmp",
    title: "Plan improvement",
    preferredWorkerType: "codex",
    allowedWorkerTypes: JSON.stringify(["codex"]),
    status: "ready",
    plannerArtifactsJson: JSON.stringify({
      planPath: "/tmp/improvement.md",
      specPath: null,
      candidates: [{ kind: "plan", path: "/tmp/improvement.md", exists: true }],
    }),
    artifactPlanPath: "/tmp/improvement.md",
    createdAt: now,
    updatedAt: now,
  });
  // The reviewer reads spec/plan from disk; provide minimal stubs.
  const fs = await import("node:fs");
  if (!fs.existsSync("/tmp/improvement.md")) {
    fs.writeFileSync("/tmp/improvement.md", "## Phase 1\n- [ ] Task\n");
  }

  server = await startLifecycleHarness({
    routes: [
      { pattern: "/api/events", module: eventsRoute },
      { pattern: "/api/planning/:id/review", module: reviewRoute },
    ],
  });
  client = new LifecycleClient({
    baseUrl: server.baseUrl,
    chaos: new Chaos(9, NO_CHAOS),
  });
});

afterEach(async () => {
  await client.close();
  await server.stop();
  vi.clearAllMocks();
});

describe("lifecycle harness — plan improvement", () => {
  it("starts a review run, emits plan.review.started + worker.spawned, survives a restart", { timeout: 30_000 }, async () => {
    await client.bootstrapSnapshot(RUN_ID);
    await client.subscribe({ runId: RUN_ID });

    const res = await client.fetch(`/api/planning/${RUN_ID}/review`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentSelection: "auto", rounds: 1 }),
    });
    expect(res.status).toBe(200);

    const started = await client.waitFor("plan.review.started", { timeoutMs: 10_000 });
    expect(started.payload).toMatchObject({
      kind: "plan.review.started",
      runId: RUN_ID,
    });

    // Reviewer worker should be spawned.
    const spawned = await client.waitFor("worker.spawned", {
      predicate: (frame) => (frame.payload as { runId?: string } | null)?.runId === RUN_ID,
      timeoutMs: 10_000,
    });
    expect(spawned.payload).toMatchObject({
      kind: "worker.spawned",
      runId: RUN_ID,
    });
    const resumeId = client.resumeIdNow();

    // Simulate server restart mid-review. The ring is wiped; reconnect
    // with a stale Last-Event-ID must trigger stream.resync_required
    // rather than silently lose state.
    client.dropSse();
    server.simulateRestart();
    await client.subscribe({ runId: RUN_ID, resumeFrom: resumeId });
    const resync = await client.waitFor("stream.resync_required", { timeoutMs: 10_000 });
    expect(resync.payload).toMatchObject({ reason: "id_out_of_buffer" });

    // The DB still holds the review run row — restart preserves persisted state.
    const reviewRows = (await db.select().from(planningReviewRuns)).filter(
      (r) => r.runId === RUN_ID,
    );
    expect(reviewRows).toHaveLength(1);
    expect(reviewRows[0]!.status).toBe("running");
  });
});

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:36:41.120Z","phase":null} -->
## Tool result: call_928BH3TxfS7MF7uJYCvUckIP · 2026-06-14T16:36:41.120Z

```text
Chunk ID: 05650a
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1638
Output:
/**
 * End-to-end scenarios for the three session types the user explicitly
 * called out: direct, planning, implementation.
 *
 * Each scenario POSTs to /api/conversations, asserts the run/plan is
 * created with the right shape, and observes `worker.spawned` (and any
 * downstream lifecycle events) on the SSE stream.
 *
 * The bridge-client and supervisor are mocked: the goal here is the
 * control-plane wiring + named-event emissions, not the actual agent
 * runtime. The day we want real agent runtime coverage, swap the
 * mocks for a fake bridge subprocess.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import {
  executionEvents,
  messages,
  plans,
  processSessions,
  runs,
  workerCounters,
  workers,
} from "@/server/db/schema";

import * as eventsRoute from "@/app/api/events/route";
import * as conversationsRoute from "@/app/api/conversations/route";

import { startLifecycleHarness, type LifecycleServer } from "../harness/server";
import { LifecycleClient } from "../harness/client";
import { Chaos, NO_CHAOS } from "../harness/chaos";
import { __resetNamedEventsForTests } from "@/server/events/named-events";

vi.mock("@/server/bridge-client", () => ({
  spawnAgent: vi.fn().mockResolvedValue({
    name: "test-agent",
    type: "codex",
    state: "idle",
    currentText: "",
    lastText: "",
    sessionId: "test-session",
    sessionMode: null,
    pendingPermissions: [],
    outputEntries: [],
    stderrBuffer: [],
    stopReason: null,
    cwd: "/tmp",
  }),
  askAgent: vi.fn().mockResolvedValue({
    response: "ok",
    state: "idle",
  }),
  getAgent: vi.fn().mockResolvedValue({
    name: "test-agent",
    type: "codex",
    state: "idle",
    currentText: "",
    lastText: "",
    sessionId: "test-session",
    sessionMode: null,
    pendingPermissions: [],
    outputEntries: [],
    stderrBuffer: [],
    stopReason: null,
    cwd: "/tmp",
  }),
  cancelAgent: vi.fn().mockResolvedValue(undefined),
  cancelAgentTerminalProcess: vi.fn().mockResolvedValue(undefined),
  BRIDGE_URL: "http://localhost:0",
}));

vi.mock("@/server/git/workspaces", async () => {
  const actual = await vi.importActual<typeof import("@/server/git/workspaces")>(
    "@/server/git/workspaces",
  );
  return { ...actual, createBranchWorktree: vi.fn() };
});

vi.mock("@/server/git/auto-commit", () => ({
  captureGitBaseline: vi.fn(() => null),
}));

vi.mock("@/server/supervisor/start", () => ({
  startSupervisorRun: vi.fn(),
}));

vi.mock("@/server/workers/snapshots", () => ({
  persistWorkerSnapshot: vi.fn().mockResolvedValue(undefined),
}));

let server: LifecycleServer;
let client: LifecycleClient;

beforeEach(async () => {
  __resetNamedEventsForTests();
  await db.delete(executionEvents);
  await db.delete(messages);
  await db.delete(processSessions);
  await db.delete(workers);
  await db.delete(workerCounters);
  await db.delete(runs);
  await db.delete(plans);
  server = await startLifecycleHarness({
    routes: [
      { pattern: "/api/events", module: eventsRoute },
      { pattern: "/api/conversations", module: conversationsRoute },
    ],
  });
  client = new LifecycleClient({
    baseUrl: server.baseUrl,
    chaos: new Chaos(7, NO_CHAOS),
  });
});

afterEach(async () => {
  await client.close();
  await server.stop();
  vi.clearAllMocks();
});

async function createConversation(mode: "direct" | "planning" | "implementation", command: string) {
  const res = await client.fetch("/api/conversations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode, command }),
  });
  expect(res.status).toBe(200);
  return (await res.json()) as { ok: true; runId: string; planId: string; messageId: string };
}

describe("lifecycle harness — session types", () => {
  it("direct: creates a run+worker, emits worker.spawned", async () => {
    // No specific runId yet; subscribe unscoped so we catch the create.
    await client.bootstrapSnapshot();
    await client.subscribe({});

    const { runId } = await createConversation("direct", "hello world");

    const spawned = await client.waitFor("worker.spawned", {
      predicate: (frame) => (frame.payload as { runId?: string } | null)?.runId === runId,
      timeoutMs: 10_000,
    });
    expect(spawned.payload).toMatchObject({
      kind: "worker.spawned",
      runId,
      workerType: expect.any(String),
    });

    // Persistence check: the run row exists in "direct" mode and a
    // worker row was created in "starting".
    const runRow = (await db.select().from(runs)).find((r) => r.id === runId);
    expect(runRow?.mode).toBe("direct");
    const workerRows = (await db.select().from(workers)).filter((w) => w.runId === runId);
    expect(workerRows).toHaveLength(1);
    // Status may have advanced past "starting" by the time we read it
    // (direct mode kicks off askAgent asynchronously). The important
    // thing is the row exists and `worker.spawned` was emitted above.
  });

  it("planning: creates a run in planning mode and emits worker.spawned for the planner", async () => {
    await client.bootstrapSnapshot();
    await client.subscribe({});

    const { runId } = await createConversation("planning", "draft a plan for X");

    const spawned = await client.waitFor("worker.spawned", {
      predicate: (frame) => (frame.payload as { runId?: string } | null)?.runId === runId,
      timeoutMs: 10_000,
    });
    expect(spawned.payload).toMatchObject({
      kind: "worker.spawned",
      runId,
    });

    const runRow = (await db.select().from(runs)).find((r) => r.id === runId);
    expect(runRow?.mode).toBe("planning");
  });

  it("implementation: creates a run and hands off to the supervisor (no immediate worker.spawned)", async () => {
    await client.bootstrapSnapshot();
    await client.subscribe({});

    const { runId } = await createConversation("implementation", "implement Y");

    // We deliberately do NOT assert worker.spawned here — implementation
    // mode delegates to startSupervisorRun (mocked), which is what
    // would actually create workers later. The visible synchronous
    // assertion is the run row landing in "running".
    const runRow = (await db.select().from(runs)).find((r) => r.id === runId);
    expect(runRow?.mode).toBe("implementation");
    expect(runRow?.status).toBe("running");

    const { startSupervisorRun } = await import("@/server/supervisor/start");
    expect(startSupervisorRun).toHaveBeenCalledWith(runId);
  });
});

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:36:41.153Z","phase":null} -->
## Tool result: call_zqek7cayZl9sVUUCPSXHzzbx · 2026-06-14T16:36:41.153Z

```text
Chunk ID: 4900dd
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2058
Output:
tests/supervisor/wake-schedule.test.ts:12:  planningReviewFindings,
tests/supervisor/wake-schedule.test.ts:13:  planningReviewRounds,
tests/supervisor/wake-schedule.test.ts:14:  planningReviewRuns,
tests/supervisor/wake-schedule.test.ts:63:    await db.delete(planningReviewFindings);
tests/supervisor/wake-schedule.test.ts:64:    await db.delete(planningReviewRounds);
tests/supervisor/wake-schedule.test.ts:65:    await db.delete(planningReviewRuns);
tests/supervisor/worker-failover-spawn-retry.test.ts:45:    await db.delete(schema.planningReviewFindings);
tests/supervisor/worker-failover-spawn-retry.test.ts:46:    await db.delete(schema.planningReviewRounds);
tests/supervisor/worker-failover-spawn-retry.test.ts:47:    await db.delete(schema.planningReviewRuns);
tests/supervisor/wake.test.ts:12:  planningReviewFindings,
tests/supervisor/wake.test.ts:13:  planningReviewRounds,
tests/supervisor/wake.test.ts:14:  planningReviewRuns,
tests/supervisor/wake.test.ts:69:    await db.delete(planningReviewFindings);
tests/supervisor/wake.test.ts:70:    await db.delete(planningReviewRounds);
tests/supervisor/wake.test.ts:71:    await db.delete(planningReviewRuns);
tests/supervisor/worker-failover-no-replacement.test.ts:38:    await db.delete(schema.planningReviewFindings);
tests/supervisor/worker-failover-no-replacement.test.ts:39:    await db.delete(schema.planningReviewRounds);
tests/supervisor/worker-failover-no-replacement.test.ts:40:    await db.delete(schema.planningReviewRuns);
src/app/home/HomeApp.tsx:1272:          reviewFindings={state.reviewFindings}
src/app/home/types.ts:340:  reviewFindings?: PlanningReviewFindingRecord[];
tests/supervisor/index.test.ts:8:import { clarifications, conversationReadMarkers, creditEvents, executionEvents, messages, planItems, planningReviewFindings, planningReviewRounds, planningReviewRuns, plans, processSessions, queuedConversationMessages, recoveryIncidents, runs, settings, supervisorInterventions, supervisorScheduledWakes, workerAssignments, workerCounters, workers } from "@/server/db/schema";
tests/supervisor/index.test.ts:125:    await db.delete(planningReviewFindings);
tests/supervisor/index.test.ts:126:    await db.delete(planningReviewRounds);
tests/supervisor/index.test.ts:127:    await db.delete(planningReviewRuns);
tests/api/events-route.test.ts:9:import { clarifications, conversationReadMarkers, creditEvents, executionEvents, messages, planItems, planningReviewFindings, planningReviewRounds, planningReviewRuns, plans, processSessions, queuedConversationMessages, recoveryIncidents, runs, supervisorInterventions, supervisorScheduledWakes, workerAssignments, workerCounters, workers } from "@/server/db/schema";
tests/api/events-route.test.ts:128:    await db.delete(planningReviewFindings);
tests/api/events-route.test.ts:129:    await db.delete(planningReviewRounds);
tests/api/events-route.test.ts:130:    await db.delete(planningReviewRuns);
tests/api/events-route.test.ts:2504:    await db.insert(planningReviewRuns).values({
tests/api/events-route.test.ts:2517:    await db.insert(planningReviewRounds).values({
tests/api/events-route.test.ts:2527:    await db.insert(planningReviewFindings).values({
tests/api/events-route.test.ts:2547:    expect(payload.reviewFindings).toHaveLength(1);
tests/api/events-route.test.ts:2548:    expect(payload.reviewFindings[0].id).toBe(findingId);
tests/api/events-route.test.ts:2549:    expect(payload.reviewFindings[0].title).toBe("Missing unit tests");
tests/db/schema.test.ts:53:    expect(schema).toHaveProperty("planningReviewRuns");
tests/db/schema.test.ts:54:    expect(schema).toHaveProperty("planningReviewRounds");
tests/db/schema.test.ts:55:    expect(schema).toHaveProperty("planningReviewFindings");
tests/server/conversations-sync.test.ts:5:import { clarifications, conversationReadMarkers, creditEvents, executionEvents, messages, planItems, planningReviewFindings, planningReviewRounds, planningReviewRuns, plans, processSessions, queuedConversationMessages, recoveryIncidents, runs, settings, supervisorInterventions, supervisorScheduledWakes, workerAssignments, workerCounters, workers } from "@/server/db/schema";
tests/server/conversations-sync.test.ts:39:    await db.delete(planningReviewFindings);
tests/server/conversations-sync.test.ts:40:    await db.delete(planningReviewRounds);
tests/server/conversations-sync.test.ts:41:    await db.delete(planningReviewRuns);
tests/server/dual-write-stream.test.ts:12:  planningReviewFindings,
tests/server/dual-write-stream.test.ts:13:  planningReviewRounds,
tests/server/dual-write-stream.test.ts:14:  planningReviewRuns,
tests/server/dual-write-stream.test.ts:120:    await db.delete(planningReviewFindings);
tests/server/dual-write-stream.test.ts:121:    await db.delete(planningReviewRounds);
tests/server/dual-write-stream.test.ts:122:    await db.delete(planningReviewRuns);
tests/server/planning/review.test.ts:87:    // when checking for an existing planningReviewRuns row.
tests/server/planning/review.test.ts:93:    //   5. existing-planningReviewRuns check → null
tests/server/planning/refresh.test.ts:8:import { messages, planningReviewRuns, plans, runs, workerCounters, workers } from "@/server/db/schema";
tests/server/planning/refresh.test.ts:14:    await db.delete(planningReviewRuns);
tests/server/planning/refresh.test.ts:265:    await db.insert(planningReviewRuns).values({
tests/server/planning/refresh.test.ts:297:    await db.update(planningReviewRuns)
tests/server/planning/refresh.test.ts:299:      .where(eq(planningReviewRuns.id, "review-active"));
tests/server/worker-snapshot-initial-prompt.test.ts:11:  planningReviewFindings,
tests/server/worker-snapshot-initial-prompt.test.ts:12:  planningReviewRounds,
tests/server/worker-snapshot-initial-prompt.test.ts:13:  planningReviewRuns,
tests/server/worker-snapshot-initial-prompt.test.ts:32:    await db.delete(planningReviewFindings);
tests/server/worker-snapshot-initial-prompt.test.ts:33:    await db.delete(planningReviewRounds);
tests/server/worker-snapshot-initial-prompt.test.ts:34:    await db.delete(planningReviewRuns);
tests/server/events/plan-review-blocked-event.test.ts:2: * Reproduces the bug: a leftover planningReviewRuns row blocks a new
tests/server/events/plan-review-blocked-event.test.ts:14:  planningReviewFindings,
tests/server/events/plan-review-blocked-event.test.ts:15:  planningReviewRounds,
tests/server/events/plan-review-blocked-event.test.ts:16:  planningReviewRuns,
tests/server/events/plan-review-blocked-event.test.ts:45:    await db.delete(planningReviewFindings);
tests/server/events/plan-review-blocked-event.test.ts:46:    await db.delete(planningReviewRounds);
tests/server/events/plan-review-blocked-event.test.ts:47:    await db.delete(planningReviewRuns);
tests/server/events/plan-review-blocked-event.test.ts:86:    await db.insert(planningReviewRuns).values({
tests/lifecycle/scenarios/plan-improvement-flow.test.ts:18:  planningReviewFindings,
tests/lifecycle/scenarios/plan-improvement-flow.test.ts:19:  planningReviewRounds,
tests/lifecycle/scenarios/plan-improvement-flow.test.ts:20:  planningReviewRuns,
tests/lifecycle/scenarios/plan-improvement-flow.test.ts:88:  await db.delete(planningReviewFindings);
tests/lifecycle/scenarios/plan-improvement-flow.test.ts:89:  await db.delete(planningReviewRounds);
tests/lifecycle/scenarios/plan-improvement-flow.test.ts:90:  await db.delete(planningReviewRuns);
tests/lifecycle/scenarios/plan-improvement-flow.test.ts:185:    const reviewRows = (await db.select().from(planningReviewRuns)).filter(
tests/lifecycle/scenarios/plan-review-blocked.test.ts:4: * Setup: a `runs` row in planning mode + a leftover `planningReviewRuns`
tests/lifecycle/scenarios/plan-review-blocked.test.ts:14:import { executionEvents, planningReviewRuns } from "@/server/db/schema";
tests/lifecycle/scenarios/plan-review-blocked.test.ts:46:  await db.delete(planningReviewRuns);
tests/lifecycle/harness/fixtures.ts:7:import { plans, processSessions, runs, workers, planningReviewRuns } from "@/server/db/schema";
tests/lifecycle/harness/fixtures.ts:65:  await db.insert(planningReviewRuns).values({
tests/lifecycle/harness/fixtures.ts:83:  tables.push(() => db.delete(planningReviewRuns));

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:36:56.787Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:36:56.787Z

```json
{
  "cmd": "sed -n '450,530p' src/server/agent-runtime/manager.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 14000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:36:56.787Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:36:56.787Z

```json
{
  "cmd": "sed -n '1380,1465p' src/server/agent-runtime/manager.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:36:56.787Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:36:56.787Z

```json
{
  "cmd": "sed -n '1,180p' src/server/worker-launch-mode.ts",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 14000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:36:56.871Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:36:56.871Z

```json
{
  "cmd": "rg -n \"skillRoots|mcpServers|agents\\.|configuredAgent\" src/server src/app shared -g '!**/*.json'",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 26000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:36:56.897Z","phase":null} -->
## Tool result: call_a8RmYoUpXIkTy3wgqvJlHeOP · 2026-06-14T16:36:56.897Z

```text
Chunk ID: 3f7df7
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 636
Output:
  const sanitized = input.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return sanitized || "skill";
}

function discoverSkillDirs(skillRoot: string, env: EnvLike): string[] {
  const expanded = expandHomePath(skillRoot, env);
  if (!existsSync(expanded)) {
    throw new RuntimeHttpError(400, `skill root not found: ${skillRoot}`);
  }
  if (!statSync(expanded).isDirectory()) {
    throw new RuntimeHttpError(400, `skill root is not a directory: ${skillRoot}`);
  }
  if (existsSync(join(expanded, "SKILL.md"))) {
    return [expanded];
  }
  return readdirSync(expanded, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() || entry.isSymbolicLink())
    .map((entry) => join(expanded, entry.name))
    .filter((candidate) => existsSync(join(candidate, "SKILL.md")));
}

function materializeSkillRoots(cwd: string, workerName: string, skillRoots: string[], env: EnvLike): string[] {
  if (skillRoots.length === 0) {
    return [];
  }

  const skillsDir = join(cwd, ".agents", "skills");
  mkdirSync(skillsDir, { recursive: true });
  const createdLinks: string[] = [];
  try {
    for (const skillRoot of skillRoots) {
      const skillDirs = discoverSkillDirs(skillRoot, env);
      if (skillDirs.length === 0) {
        throw new RuntimeHttpError(400, `skill root contains no skill directories: ${skillRoot}`);
      }
      for (const skillDir of skillDirs) {
        const linkBase = `omniharness-${sanitizePathPart(workerName)}-${sanitizePathPart(basename(skillDir))}`;
        let linkPath = join(skillsDir, linkBase);
        let suffix = 2;
        while (existsSync(linkPath)) {
          linkPath = join(skillsDir, `${linkBase}-${suffix}`);
          suffix += 1;
        }
        symlinkSync(skillDir, linkPath, "dir");
        createdLinks.push(linkPath);
      }
    }
    return createdLinks;
  } catch (error) {
    cleanupSkillLinks(createdLinks);
    throw error;
  }
}

function cleanupSkillLinks(linkPaths: string[]) {
  for (const linkPath of linkPaths) {
    try {
      if (lstatSync(linkPath).isSymbolicLink()) {
        rmSync(linkPath, { force: true, recursive: true });
      }
    } catch {
      // Best-effort cleanup for worker-scoped temporary skill links.
    }
  }
}

function describeUnknownError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

let closedPipeConsoleSuppressionDepth = 0;

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:36:56.897Z","phase":null} -->
## Tool result: call_pcZt0f69jpgqQ4RId1rmbHYL · 2026-06-14T16:36:56.897Z

```text
Chunk ID: ef6158
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 903
Output:
        return this.toStatus(existing);
      }
      throw new RuntimeHttpError(400, `Agent already exists: ${name}`);
    }

    const requestedModel = input.model?.trim() || null;
    const requestedEffort = input.effort?.trim().toLowerCase() || null;
    const resumeSessionId = input.resumeSessionId?.trim() || null;
    const configuredAgent = this.options.config?.agents?.[type];
    const baseEnv = this.getRuntimeEnv();
    const skillRoots = [
      ...asStringArray(configuredAgent?.skillRoots, `agents.${type}.skillRoots`),
      ...asStringArray(input.skillRoots, "skillRoots"),
    ];
    const mcpServers = [
      ...normalizeMcpServers(configuredAgent?.mcpServers, `agents.${type}.mcpServers`),
      ...normalizeMcpServers(input.mcpServers, "mcpServers"),
    ];

    let defaultArgs: string[] = [];
    if (type === "opencode") {
      defaultArgs = ["acp"];
      if (requestedModel) {
        defaultArgs.push("--model", requestedModel);
      }
    } else if (type === "codex") {
      defaultArgs = buildCodexConfigArgs({
        model: requestedModel,
        effort: requestedEffort,
      });
    }
    const configuredArgs = configuredAgent?.args && configuredAgent.args.length > 0 ? configuredAgent.args : undefined;
    const requestedArgs = input.args && input.args.length > 0 ? input.args : undefined;
    const finalEnv = withManagedPath({
      ...baseEnv,
      ...(configuredAgent?.env || {}),
      ...(input.env || {}),
    }, cwd);
    applyProjectScopedCliStorage(type, cwd, finalEnv);
    const credentialProfile = await resolveCredentialProfile({
      type,
      cwd,
      env: finalEnv,
      requestedProfile: input.credentialProfile,
      configuredProfile: configuredAgent?.credentialProfile,
    });
    applyCredentialProfileEnv(finalEnv, credentialProfile);

    if (type === "codex") {
      Object.assign(finalEnv, withCodexStandardTooling(finalEnv));
      Object.assign(finalEnv, applyCodexBridgeEnv(finalEnv, null));
    }
    if (type === "claude") {
      applyClaudeKeychainOAuthToken(finalEnv);
    }

    const requestedMode = input.mode || configuredAgent?.mode;
    const defaultCommand = input.command || configuredAgent?.command || type;
    const defaultArgsList = requestedArgs || configuredArgs || defaultArgs;
    const useCodexFallback = type === "codex" && !input.command && !configuredAgent?.command && !requestedArgs && !configuredArgs;
    const useClaudeDefault = type === "claude" && !input.command && !configuredAgent?.command && !requestedArgs && !configuredArgs;
    const useGeminiDefault = type === "gemini" && !input.command && !configuredAgent?.command && !requestedArgs && !configuredArgs;
    const useOpencodeDefault = type === "opencode" && !input.command && !configuredAgent?.command && !requestedArgs && !configuredArgs;

    const eligibleForPool =
      (useGeminiDefault || useClaudeDefault || useCodexFallback || useOpencodeDefault)
      && !resumeSessionId
      && skillRoots.length === 0;
    const poolKey = eligibleForPool
      ? computeWorkerPoolKey({
          type,
          cwd,
          model: requestedModel,
          mode: requestedMode ?? null,
          mcpServers,
          skillRoots,
          envFingerprint: computeEnvFingerprint(finalEnv as NodeJS.ProcessEnv),
        })
      : null;
    const pooledMember = poolKey ? this.workerPool.checkout(poolKey) : null;

    let recordRef: { current?: AgentRecord };
    let stderrBuffer: string[];
    let client: RuntimeClient;
    let child: ChildProcessWithoutNullStreams | undefined;
    let connection: acp.ClientSideConnection | undefined;

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:36:56.897Z","phase":null} -->
## Tool result: call_AeNnT4qY03D0vyjO0PvXxGwV · 2026-06-14T16:36:56.897Z

```text
Chunk ID: 7450bc
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 264
Output:
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import { parseBooleanSetting } from "@/lib/commit-workflow";

const WORKER_YOLO_MODE_SETTING = "WORKER_YOLO_MODE";

function normalizeRequestedMode(requestedMode: unknown) {
  if (typeof requestedMode !== "string") {
    return undefined;
  }

  const normalized = requestedMode.trim();
  if (!normalized || normalized === "auto" || normalized === "direct") {
    return undefined;
  }

  return normalized;
}

export function resolveWorkerLaunchMode(requestedMode: unknown, yoloModeEnabled: boolean) {
  return normalizeRequestedMode(requestedMode) ?? (yoloModeEnabled ? "full-access" : undefined);
}

export async function readWorkerYoloModeEnabled(defaultValue = true) {
  const allSettings = await db.select().from(settings);
  const settingValues = new Map(allSettings.map((setting) => [setting.key, setting.value]));
  const stored = settingValues.get(WORKER_YOLO_MODE_SETTING);
  return parseBooleanSetting(typeof stored === "string" ? stored : null, defaultValue);
}

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:36:56.930Z","phase":null} -->
## Tool result: call_RTmQaAbteLYDYNqJ0rvw4gL9 · 2026-06-14T16:36:56.930Z

```text
Chunk ID: 97558f
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2317
Output:
src/server/supervisor/index.ts:1248:          const skillRoots = asOptionalStringArray(action.args.skillRoots, "skillRoots");
src/server/supervisor/index.ts:1249:          const mcpServers = asOptionalMcpServers(action.args.mcpServers, "mcpServers");
src/server/supervisor/index.ts:1305:              ...(skillRoots?.length ? { skillRoots } : {}),
src/server/supervisor/index.ts:1306:              ...(mcpServers?.length ? { mcpServers } : {}),
src/server/supervisor/tools.ts:101:        skillRoots: z.array(z.string()).optional().describe("Absolute skill root directories to expose to this worker."),
src/server/supervisor/tools.ts:102:        mcpServers: z.array(mcpServerSchema).optional().describe("MCP servers to expose to this worker session."),
src/app/home/sidebar-activity.ts:123:  const activeAgents = agents.filter((a) => runWorkerIds.has(a.name) && isWorkerActiveStatus(a.state));
src/app/home/sidebar-activity.ts:151:  if (agents.some((a) => runWorkerIds.has(a.name) && isWorkerActiveStatus(a.state))) return true;
src/app/home/supervisor-activity.ts:199:  const hasPendingPermission = args.agents.some((agent) => (agent.pendingPermissions?.length ?? 0) > 0);
src/app/home/supervisor-activity.ts:222:  const agentsByName = new Map(agents.map((agent) => [agent.name, agent]));
src/server/bridge-client/index.ts:509:  mcpServers?: BridgeMcpServer[];
src/server/bridge-client/index.ts:532:  skillRoots?: string[];
src/server/bridge-client/index.ts:533:  mcpServers?: BridgeMcpServer[];
src/server/conversations/sync.ts:437:        const implementationAgent = agents.find((candidate) => candidate.name === implementationWorker.id);
src/server/conversations/sync.ts:486:        ? agents.find((candidate) => candidate.name === implementationWorker.id)
src/server/conversations/sync.ts:533:    const agent = agents.find((candidate) => candidate.name === worker.id);
src/server/conversations/sync.ts:633:    if (!worker || agents.some((agent) => agent.name === worker.id)) {
src/server/agent-runtime/worker-pool.ts:38:  mcpServers: acp.McpServer[];
src/server/agent-runtime/worker-pool.ts:39:  skillRoots: string[];
src/server/agent-runtime/worker-pool.ts:75:    mcp: input.mcpServers,
src/server/agent-runtime/worker-pool.ts:76:    skills: input.skillRoots,
src/server/agent-runtime/types.ts:130:    skillRoots?: string[];
src/server/agent-runtime/types.ts:131:    mcpServers?: acp.McpServer[];
src/server/agent-runtime/types.ts:146:  skillRoots?: string[];
src/server/agent-runtime/types.ts:147:  mcpServers?: acp.McpServer[];
src/server/agent-runtime/manager.ts:221:function buildSessionMeta(agentType: string | undefined, skillRoots: string[]) {
src/server/agent-runtime/manager.ts:223:  if (skillRoots.length > 0) {
src/server/agent-runtime/manager.ts:224:    meta["omniharness/skillRoots"] = skillRoots;
src/server/agent-runtime/manager.ts:471:function materializeSkillRoots(cwd: string, workerName: string, skillRoots: string[], env: EnvLike): string[] {
src/server/agent-runtime/manager.ts:472:  if (skillRoots.length === 0) {
src/server/agent-runtime/manager.ts:480:    for (const skillRoot of skillRoots) {
src/server/agent-runtime/manager.ts:1108:        agents: this.agents.size,
src/server/agent-runtime/manager.ts:1173:        activeAgents: this.agents.size,
src/server/agent-runtime/manager.ts:1218:    const activeAgents = Array.from(this.agents.values())
src/server/agent-runtime/manager.ts:1247:      const record = this.agents.get(name);
src/server/agent-runtime/manager.ts:1252:      this.agents.delete(name);
src/server/agent-runtime/manager.ts:1318:    return Array.from(this.agents.values()).map((agent) => this.toStatus(agent));
src/server/agent-runtime/manager.ts:1322:    const record = this.agents.get(name);
src/server/agent-runtime/manager.ts:1327:    const record = this.agents.get(name);
src/server/agent-runtime/manager.ts:1372:    const existing = this.agents.get(name);
src/server/agent-runtime/manager.ts:1388:    const configuredAgent = this.options.config?.agents?.[type];
src/server/agent-runtime/manager.ts:1390:    const skillRoots = [
src/server/agent-runtime/manager.ts:1391:      ...asStringArray(configuredAgent?.skillRoots, `agents.${type}.skillRoots`),
src/server/agent-runtime/manager.ts:1392:      ...asStringArray(input.skillRoots, "skillRoots"),
src/server/agent-runtime/manager.ts:1394:    const mcpServers = [
src/server/agent-runtime/manager.ts:1395:      ...normalizeMcpServers(configuredAgent?.mcpServers, `agents.${type}.mcpServers`),
src/server/agent-runtime/manager.ts:1396:      ...normalizeMcpServers(input.mcpServers, "mcpServers"),
src/server/agent-runtime/manager.ts:1411:    const configuredArgs = configuredAgent?.args && configuredAgent.args.length > 0 ? configuredAgent.args : undefined;
src/server/agent-runtime/manager.ts:1415:      ...(configuredAgent?.env || {}),
src/server/agent-runtime/manager.ts:1424:      configuredProfile: configuredAgent?.credentialProfile,
src/server/agent-runtime/manager.ts:1436:    const requestedMode = input.mode || configuredAgent?.mode;
src/server/agent-runtime/manager.ts:1437:    const defaultCommand = input.command || configuredAgent?.command || type;
src/server/agent-runtime/manager.ts:1439:    const useCodexFallback = type === "codex" && !input.command && !configuredAgent?.command && !requestedArgs && !configuredArgs;
src/server/agent-runtime/manager.ts:1440:    const useClaudeDefault = type === "claude" && !input.command && !configuredAgent?.command && !requestedArgs && !configuredArgs;
src/server/agent-runtime/manager.ts:1441:    const useGeminiDefault = type === "gemini" && !input.command && !configuredAgent?.command && !requestedArgs && !configuredArgs;
src/server/agent-runtime/manager.ts:1442:    const useOpencodeDefault = type === "opencode" && !input.command && !configuredAgent?.command && !requestedArgs && !configuredArgs;
src/server/agent-runtime/manager.ts:1447:      && skillRoots.length === 0;
src/server/agent-runtime/manager.ts:1454:          mcpServers,
src/server/agent-runtime/manager.ts:1455:          skillRoots,
src/server/agent-runtime/manager.ts:1493:        if (type === "codex" && !input.command && !configuredAgent?.command) {
src/server/agent-runtime/manager.ts:1502:      managedSkillLinks = materializeSkillRoots(cwd, name, skillRoots, finalEnv);
src/server/agent-runtime/manager.ts:1516:            mcpServers,
src/server/agent-runtime/manager.ts:1517:            skillRoots,
src/server/agent-runtime/manager.ts:1606:    this.agents.set(name, record);
src/server/agent-runtime/manager.ts:1609:      const target = this.agents.get(name);
src/server/agent-runtime/manager.ts:1633:        mcpServers: input.mcpServers ?? [],
src/server/agent-runtime/manager.ts:1641:    const record = this.agents.get(name);
src/server/agent-runtime/manager.ts:1667:      this.agents.delete(name);
src/server/agent-runtime/manager.ts:1673:    const record = this.agents.get(name);
src/server/agent-runtime/manager.ts:1725:    const record = this.agents.get(name);
src/server/agent-runtime/manager.ts:1742:    const record = this.agents.get(name);
src/server/agent-runtime/manager.ts:1791:    const record = this.agents.get(name);
src/server/agent-runtime/manager.ts:1822:    const record = this.agents.get(name);
src/server/agent-runtime/manager.ts:1857:    mcpServers?: acp.McpServer[];
src/server/agent-runtime/manager.ts:1863:    const configuredAgent = this.options.config?.agents?.[type];
src/server/agent-runtime/manager.ts:1865:    const mcpServers = [
src/server/agent-runtime/manager.ts:1866:      ...normalizeMcpServers(configuredAgent?.mcpServers, `agents.${type}.mcpServers`),
src/server/agent-runtime/manager.ts:1867:      ...normalizeMcpServers(input.mcpServers, "mcpServers"),
src/server/agent-runtime/manager.ts:1869:    const skillRoots: string[] = [];
src/server/agent-runtime/manager.ts:1873:      ...(configuredAgent?.env || {}),
src/server/agent-runtime/manager.ts:1882:      configuredProfile: configuredAgent?.credentialProfile,
src/server/agent-runtime/manager.ts:1894:    const requestedMode = input.mode || configuredAgent?.mode || null;
src/server/agent-runtime/manager.ts:1900:      mcpServers,
src/server/agent-runtime/manager.ts:1901:      skillRoots,
src/server/agent-runtime/manager.ts:1934:        mcpServers,
src/server/agent-runtime/manager.ts:1935:        skillRoots,
src/server/agent-runtime/manager.ts:1983:    mcpServers: acp.McpServer[];
src/server/agent-runtime/manager.ts:2013:    mcpServers: acp.McpServer[];
src/server/agent-runtime/manager.ts:2014:    skillRoots: string[];
src/server/agent-runtime/manager.ts:2091:        const sessionMeta = buildSessionMeta(input.agentType, input.skillRoots);
src/server/agent-runtime/manager.ts:2094:          mcpServers: input.mcpServers,
src/server/agent-runtime/manager.ts:2231:    const record = this.agents.get(name);
src/server/agent-runtime/http.ts:77:        writeJson(res, 200, { ok: true, agents: manager.agents.size });
src/server/agent-runtime/http.ts:102:          mcpServers?: unknown;
src/server/agent-runtime/http.ts:112:        const mcpServers = Array.isArray(body.mcpServers) ? body.mcpServers as Parameters<typeof manager.prewarmWorker>[0]["mcpServers"] : undefined;
src/server/agent-runtime/http.ts:119:          mcpServers,

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:37:03.012Z","phase":null} -->
## Tool call: web_search · 2026-06-14T16:37:03.012Z

```json
{
  "type": "web_search_call",
  "status": "completed",
  "action": {
    "type": "open_page",
    "url": "https://ui.shadcn.com/blocks"
  }
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:37:07.090Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:37:07.090Z

I have enough context to draft the durable plan. I’m going to add one new markdown file under `docs/superpowers/plans/`; no source code, branches, worktrees, or deletions.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:38:42.551Z","phase":null} -->
## Tool call: apply_patch · 2026-06-14T16:38:42.551Z

````json
*** Begin Patch
*** Add File: docs/superpowers/plans/2026-06-14-visual-improve-mode.md
+# Visual Improve Mode Implementation Plan
+
+> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
+
+**Goal:** Add an OmniHarness `improve` conversation mode that runs one advisor agent with the improve skill bundle and turns its audit/planning output into structured, reviewable cards.
+
+**Architecture:** Model `improve` as a direct-worker-backed advisor mode, not as an implementation supervisor mode. The advisor worker owns the prose transcript through the existing unified worker stream, while the server extracts and persists structured improve results into typed database rows/artifact streams and surfaces them through the existing SSE snapshot/event path. The UI renders those records in an improve-results panel where each card can be inspected, approved for planning/implementation, rejected, or refined through the same worker conversation.
+
+**Tech Stack:** Next.js 15, React 19, TypeScript, Drizzle/SQLite, existing OmniHarness ACP bridge, unified worker stream, named SSE events, shadcn/ui primitives already in the app, Vitest lifecycle tests.
+
+**North Star Product:** OmniHarness becomes an agent-work review cockpit: expensive advisor runs produce durable, structured recommendations; humans can compare, approve, refine, promote, execute, and reconcile agent work without reading terminal scrollback as the primary UI.
+
+**Current Milestone:** Deliver the first usable visual `/improve` equivalent: one advisor agent, improve-skill prompt, structured findings/direction/plan candidates, card review UI, per-card refine/approve/reject actions, and lifecycle coverage for start, completion, reconnect, and failure.
+
+**Future Product Direction:** Later milestones can add multi-category parallel advisor workers, GitHub issue publishing, backlog reconciliation, execution dispatch, and historical cross-run trend views. Those are context only; this plan does not implement them.
+
+**Final Functionality Standard:** A user can choose `Improve`, start an advisor run, watch status, review structured result cards without scrolling through the transcript, approve or reject individual cards, ask the advisor to refine a card, and promote approved output into the existing planning/implementation path. No source-code edits, branches, worktrees, or file deletions are performed by improve mode itself.
+
+---
+
+## Product Design
+
+### PM Pass
+
+- **First User:** The human builder using OmniHarness to decide what a codebase needs next.
+- **Core Job:** Run a high-quality codebase improvement advisor and review its output as structured decisions.
+- **Supporting Jobs:** See progress, understand evidence, recover from failures, revisit prior improve runs, refine one recommendation without losing the rest, approve selected work, and send approved work into the existing planning/implementation pipeline.
+- **User Segmentation:** Single-user local tool for this milestone. No collaboration or permissions model changes.
+- **State Model:** `starting`, `running`, `awaiting_refinement`, `completed`, `failed`, plus per-result `proposed`, `approved`, `rejected`, `superseded`, `promoted`.
+- **Persistence Model:** Runs remain in `runs`; transcript content remains in the worker JSONL stream; structured improve output lives in new typed DB rows plus artifact-stream-backed long fields. Per-card approval/rejection/refinement state is workspace-local and survives reload/restart. No translated UI copy is persisted.
+- **Operational Readiness:** Spawn failures, malformed advisor output, partial output, restart, SSE reconnect, and stale refine requests must all surface as named events and visible UI state.
+- **Instrumentation And Observability:** Emit named events for improve start, parsed result, parse failure, card state changes, refinement requested/completed, promote requested/completed/failed, and advisor failure. User-visible failures emit `error.surfaced` with stable codes.
+- **Onboarding And Discoverability:** Add `Improve` to the composer mode picker with concise i18n copy. Empty improve runs show one clear status panel and one obvious path back to the composer.
+- **Risk And Trust Surfaces:** The UI must distinguish advisor suggestions from approved work. Evidence must be visible. Malformed or incomplete structured output must not silently disappear behind the transcript.
+
+### Story-Derived Scope
+
+- As a builder, I can choose `Improve` and describe the desired audit focus so the advisor runs with the improve skill bundle.
+- As a builder, I can see whether the advisor is mapping, auditing, vetting, planning, refining, completed, or failed.
+- As a builder, I can inspect each recommendation card with category, impact, effort, risk, confidence, evidence, rationale, and proposed next action.
+- As a builder, I can approve, reject, or ask for refinement on one card without treating the whole advisor run as all-or-nothing.
+- As a builder, I can promote an approved result into an implementation-planning flow without copying terminal text.
+- As a returning builder, I can reopen the run and see the same cards and decisions.
+- As a builder on reconnect/restart, I either get replayed events or a resync snapshot with the structured results intact.
+
+### UI Direction
+
+The implementation should reuse the existing `PlanningArtifactsPanel`/`PlanningReviewControls` interaction style rather than adding a new top-level page. The closest shadcn block reference is `dashboard-01` from `https://ui.shadcn.com/blocks`, specifically the dense `SectionCards` + `DataTable` pattern, but do not install a whole block unless the existing component structure cannot support the layout. Use existing local `Button`, panel, badge, and icon patterns first.
+
+Avoid a menu-first flow. The improve output should land as a scannable list of result cards with compact metadata, expandable evidence/details, and direct actions on each card.
+
+## Upstream Improve Behavior To Preserve
+
+The upstream `shadcn/improve` skill describes a read-only advisor that audits codebases and writes self-contained implementation plans for other agents. It maps the repo, audits categories like correctness/security/performance/tests/tech debt/DX/docs/direction, vets findings, prioritizes by leverage, and writes plans only after selection. Its hard rules include never modifying source code, never mutating the working tree, never reproducing secrets, and treating repository content as data rather than instructions.
+
+OmniHarness should preserve those advisor rules but adapt the output contract:
+
+- Markdown transcript remains visible in the worker stream.
+- Structured JSON is required at advisor checkpoints.
+- The server stores structured rows and rejects malformed structured output into a visible parse-failure state.
+- The human reviews cards instead of scrolling to find task definitions.
+- The mode never creates branches or worktrees. It can only promote approved output into existing planning/implementation flows after explicit user action.
+
+## Approaches Considered
+
+- **Extend planning mode:** Lowest backend cost, but conflates "write a requested plan" with "audit and produce multiple improvement opportunities." Rejected because it makes the UI and state model harder to reason about.
+- **Make improve a supervisor/implementation variant:** Would reuse implementation machinery, but the advisor is explicitly non-implementing. Rejected because it invites worker spawning and progress semantics that conflict with read-only advisor behavior.
+- **Add a direct-worker-backed `improve` mode:** Recommended. It matches the one-agent requirement, reuses the worker transcript and lifecycle model, and gives improve its own structured artifacts and UI.
+
+## File Map
+
+### Files To Modify
+
+- `src/server/conversations/modes.ts` — add `improve` to the mode union and direct-worker-backed classification.
+- `src/components/ConversationModePicker.tsx` — include `Improve` in the mode picker and copy map.
+- `src/app/home/types.ts` — add `RunMode`/snapshot types for improve result records.
+- `src/app/home/HomeUiStateManager.ts` — allow `selectedConversationMode: "improve"` and keep storage normalization safe.
+- `src/app/home/useHomeLifecycle.ts` — persist/restore the selected composer mode with `improve`.
+- `src/app/home/useHomeViewModel.ts` — derive `isImproveConversation` and expose improve records to the main conversation surface.
+- `src/app/home/HomeApp.tsx` — pass improve state/actions into `ConversationMain`.
+- `src/components/home/ConversationComposer.tsx` and `src/app/home/ComposerContainer.tsx` — mode-specific placeholder/steering behavior, without forcing implementation steering.
+- `src/components/home/ConversationMain.tsx` — render the improve-results panel for improve runs.
+- `src/server/conversations/create.ts` — launch improve as a direct-worker-backed advisor, using a dedicated prompt and skill roots.
+- `src/server/prompts/improve.md` — new advisor prompt based on upstream improve semantics plus OmniHarness structured-output contract.
+- `src/server/db/schema.ts` and `src/server/db/index.ts` — add improve result tables and migrations.
+- `src/server/events/named-events.ts` — add improve event kinds and surfaced error codes.
+- `src/server/events/persisted-snapshot.ts` — include improve rows in selected-run snapshots with scoped completeness metadata.
+- `src/server/workers/entries-types.ts` and `src/server/workers/output-store.ts` only if a new worker entry type is truly required. Prefer not to add one; transcript content should remain ordinary worker output and structured rows should be separate artifacts.
+- `src/server/improve/*` — create focused server modules for prompt building, structured parsing, row persistence, card state mutations, and promotion.
+- `src/app/api/improve/[id]/results/route.ts` or `src/runtime/http/routes/improve.ts` — card mutation/promote/refine endpoints, following existing runtime route patterns.
+- `src/components/ImproveResultsPanel.tsx` and `src/components/ImproveResultCard.tsx` — new UI surface for cards and actions.
+- `shared/locales/*.json` — all user-facing labels, statuses, actions, aria labels, placeholders, errors, and empty states.
+
+### Tests To Add Or Update
+
+- `tests/db/schema.test.ts` — assert new improve tables export correctly.
+- `tests/api/events-route.test.ts` — snapshot includes improve results and scoped completeness for selected improve run.
+- `tests/lifecycle/scenarios/session-types.test.ts` — add `improve` mode creation, run row, worker row, and `worker.spawned`.
+- `tests/lifecycle/scenarios/improve-mode-flow.test.ts` — start improve, receive structured result events, reconnect/resync, mutate card state.
+- `tests/server/improve/parser.test.ts` — structured extraction accepts valid output, rejects malformed output, preserves evidence, and redacts/omits secret-like values.
+- `tests/server/improve/promote.test.ts` — approved result promotion creates/reuses planning artifacts without creating branches/worktrees.
+- `tests/ui/improve-results-panel.test.tsx` — cards render metadata/actions from manager state and all visible copy comes through i18n.
+
+### Candidate Agentic Journey Test
+
+Requires explicit user approval before running in a browser:
+
+- Mission: Start an `Improve` run, wait for a mocked structured finding, approve it, refine another card, and promote the approved one.
+- Entry point: `http://localhost:3035`.
+- Expected visible proof: mode picker shows `Improve`; result cards appear below the transcript; approved/rejected/refining statuses persist across reload; promoted card opens or creates the planning/implementation handoff.
+
+## Data Model
+
+Add tables rather than overloading `planningReview*`:
+
+- `improve_runs`
+  - `id`, `runId`, `status`, `focus`, `skillRootsJson`, `startedAt`, `completedAt`, `lastError`, timestamps.
+- `improve_results`
+  - `id`, `improveRunId`, `runId`, `kind`, `category`, `title`, `status`, `impact`, `effort`, `risk`, `confidence`, `priority`, `sourcePath`, `artifactSeq`, `detailsHash`, `detailsPreview`, `recommendationPreview`, timestamps.
+- `improve_result_artifacts`
+  - Prefer the existing `artifactStreams` engine for long `details`, `evidence`, `fixSketch`, `planMarkdown`, `rejectionReason`, and `refinementPrompt` bodies rather than storing large text directly in snapshot rows.
+
+Statuses:
+
+- Improve run: `starting`, `running`, `completed`, `failed`.
+- Improve result: `proposed`, `approved`, `rejected`, `refining`, `superseded`, `promoted`.
+
+Do not persist translated labels. Persist only stable ids/statuses and translate in React.
+
+## Structured Output Contract
+
+The advisor prompt must require fenced JSON blocks for machine-readable checkpoints:
+
+```json
+{
+  "schema": "omniharness.improve.results.v1",
+  "status": "partial|final",
+  "phase": "recon|audit|vet|prioritize|plan",
+  "results": [
+    {
+      "clientId": "CORRECTNESS-01",
+      "kind": "finding|direction|plan_candidate|rejected",
+      "category": "correctness|security|performance|tests|tech_debt|dependencies|dx|docs|direction",
+      "title": "Short human label",
+      "impact": "Concrete cost or user value",
+      "effort": "S|M|L",
+      "risk": "LOW|MED|HIGH",
+      "confidence": "LOW|MED|HIGH",
+      "priority": 1,
+      "evidence": [{ "path": "src/example.ts", "line": 42, "summary": "What exists there" }],
+      "details": "Short explanation",
+      "recommendation": "What to do next",
+      "planMarkdown": null
+    }
+  ]
+}
+```
+
+Parser rules:
+
+- Accept the latest valid `omniharness.improve.results.v1` block.
+- Validate with `zod`.
+- Never require the UI to parse freeform markdown.
+- Treat malformed JSON as `improve.parse_failed` plus `error.surfaced`, but keep the transcript visible.
+- Store secret-like evidence as location/type only. Do not store secret values if they appear in advisor output.
+- Deduplicate by `(runId, clientId)` and preserve existing user decisions when a later partial update refines the same result.
+
+## Client/Server State Invariants
+
+- **Owner:** Server owns improve run/result rows. `ImproveResultsManager` owns the client snapshot projection and local UI expansion state only.
+- **Token:** Every result mutation carries `runId`, `improveRunId`, and `resultId`; stale mutation responses must confirm the selected run still matches before changing visible selection.
+- **Provenance:** Transcript is worker-produced evidence; structured result rows are server-validated projection; user decisions are server-authoritative after mutation success.
+- **Completeness:** Snapshot payload must declare `improveResults.complete` for the selected run. Partial SSE events may add/update rows but cannot erase existing cards unless scoped complete.
+- **Ordering:** Sort by `priority`, then `createdAt`, then `id`. Do not rely on timestamp-only ordering.
+- **State Machine:** Result transitions are constrained: `proposed -> approved|rejected|refining`; `refining -> proposed|superseded|failed`; `approved -> promoted`; no mutation from `promoted` back to proposed without a new result row.
+- **Events:** Server decisions emit named events. The UI must not infer decisions by diffing snapshots.
+- **Reconnect:** Use existing SSE `id:`/`Last-Event-ID`; if `stream.resync_required` fires, snapshot reload must restore improve rows.
+- **Hot Path:** Snapshot rows carry previews and artifact cursors, not large plan/details bodies.
+
+## Named Events
+
+Add these to `src/server/events/named-events.ts`:
+
+- `improve.started` `{ runId, improveRunId }`
+- `improve.phase` `{ runId, improveRunId, phase }`
+- `improve.result_upserted` `{ runId, improveRunId, resultId, status }`
+- `improve.result_status_changed` `{ runId, improveRunId, resultId, prev, next }`
+- `improve.refine_requested` `{ runId, improveRunId, resultId }`
+- `improve.refine_finished` `{ runId, improveRunId, resultId, status }`
+- `improve.promote_requested` `{ runId, improveRunId, resultId }`
+- `improve.promote_finished` `{ runId, improveRunId, resultId, targetRunId, status }`
+- `improve.parse_failed` `{ runId, improveRunId, reason }`
+- `improve.finished` `{ runId, improveRunId, status }`
+
+Add surfaced error codes:
+
+- `improve.start_failed`
+- `improve.parse_failed`
+- `improve.refine_failed`
+- `improve.promote_failed`
+- `improve.mutation_stale`
+
+## Implementation Tasks
+
+- [ ] Add failing schema and parser tests.
+  - Files: `tests/db/schema.test.ts`, `tests/server/improve/parser.test.ts`.
+  - Verify: `pnpm test tests/db/schema.test.ts tests/server/improve/parser.test.ts` fails for missing improve schema/parser.
+
+- [ ] Add improve DB tables and migration.
+  - Files: `src/server/db/schema.ts`, `src/server/db/index.ts`.
+  - Include cleanup behavior in existing delete-conversation paths if foreign-key cleanup is manual there.
+  - Verify: `pnpm test tests/db/schema.test.ts`.
+
+- [ ] Implement structured parser and artifact-backed persistence.
+  - Files: `src/server/improve/parser.ts`, `src/server/improve/store.ts`, `src/server/improve/types.ts`.
+  - Use `zod`; keep large bodies in artifact streams or bounded previews.
+  - Verify: `pnpm test tests/server/improve/parser.test.ts`.
+
+- [ ] Add improve prompt and launch wiring.
+  - Files: `src/server/prompts/improve.md`, `src/server/conversations/modes.ts`, `src/server/conversations/create.ts`, `src/server/bridge-client/index.ts` only if current `spawnAgent` request typing does not expose `skillRoots`.
+  - Use existing `skillRoots` support to expose the configured improve skill bundle to the one advisor worker.
+  - Do not create a branch or worktree.
+  - Verify: `pnpm test tests/lifecycle/scenarios/session-types.test.ts`.
+
+- [ ] Add improve lifecycle events and surfaced errors.
+  - Files: `src/server/events/named-events.ts`, improve server modules, tests.
+  - Verify event transcript for start, result upsert, parse failure, finish, and surfaced errors.
+  - Verify: `pnpm test tests/lifecycle/scenarios/improve-mode-flow.test.ts tests/server/events/*.test.ts`.
+
+- [ ] Include improve records in snapshots.
+  - Files: `src/server/events/persisted-snapshot.ts`, `src/app/home/types.ts`, `src/app/home/EventStreamSnapshotCacheManager.ts`.
+  - Add scoped completeness metadata and deterministic merge behavior.
+  - Verify: `pnpm test tests/api/events-route.test.ts`.
+
+- [ ] Add card mutation and promotion routes.
+  - Files: `src/runtime/http/routes/improve.ts`, `src/app/api/improve/[id]/results/route.ts` or equivalent Next route wrappers.
+  - Actions: approve, reject, refine, promote.
+  - Refine sends a targeted prompt to the same advisor worker when available, otherwise fails visibly with a recovery message.
+  - Promote creates or updates a planning artifact/run using existing planning/promotion helpers; it must not implement directly.
+  - Verify: `pnpm test tests/server/improve/promote.test.ts tests/api/events-route.test.ts`.
+
+- [ ] Add `ImproveResultsManager`.
+  - Files: `src/app/home/ImproveResultsManager.ts`, `src/app/home/types.ts`, `src/app/home/HomeUiStateManager.ts`.
+  - Keep server rows authoritative; local manager tracks expansion, selection, and pending mutation ids.
+  - Verify stale mutation responses cannot update the wrong selected run.
+  - Verify: add focused manager tests or include in UI tests.
+
+- [ ] Add `Improve` to the composer and mode state.
+  - Files: `src/components/ConversationModePicker.tsx`, `src/components/home/ConversationComposer.tsx`, `src/app/home/ComposerContainer.tsx`, `src/app/home/useHomeLifecycle.ts`, `shared/locales/*.json`.
+  - All visible strings must use `t()` and exist in every locale file.
+  - Verify: `pnpm test tests/ui/composer-shell.test.ts`.
+
+- [ ] Build the improve results UI.
+  - Files: `src/components/ImproveResultsPanel.tsx`, `src/components/ImproveResultCard.tsx`, `src/components/home/ConversationMain.tsx`, `shared/locales/*.json`.
+  - Cards show title, category, impact, effort, risk, confidence, evidence count, status, and actions.
+  - Expanded card shows evidence, details, recommendation, generated plan preview/link if present, and parse/failure context.
+  - Avoid nested cards. Keep card radius at or below the project default. Use lucide icons for actions.
+  - Verify: `pnpm test tests/ui/improve-results-panel.test.tsx`.
+
+- [ ] Add lifecycle flow coverage.
+  - Files: `tests/lifecycle/scenarios/improve-mode-flow.test.ts`.
+  - Test: start improve, emit `improve.started`, parse one result, receive `improve.result_upserted`, drop SSE, resync, approve/reject/refine card, assert persisted row state.
+  - Verify: `pnpm test:lifecycle -- tests/lifecycle/scenarios/improve-mode-flow.test.ts` if supported by the runner, otherwise `pnpm test tests/lifecycle/scenarios/improve-mode-flow.test.ts`.
+
+- [ ] Run full targeted verification.
+  - Commands:
+    - `pnpm test tests/server/improve/parser.test.ts tests/server/improve/promote.test.ts`
+    - `pnpm test tests/api/events-route.test.ts tests/ui/improve-results-panel.test.tsx tests/ui/composer-shell.test.ts`
+    - `pnpm test:lifecycle`
+    - `pnpm lint`
+  - Expected: all commands exit 0. If lifecycle creates conversations/sessions, clean them up before finishing.
+
+## STOP Conditions
+
+Stop and report instead of improvising if:
+
+- The improve skill bundle cannot be exposed through existing `skillRoots` support without changing CLI storage or installing dependencies.
+- Implementing promotion requires branch or worktree creation. Branches are forbidden; worktrees require explicit user approval and are out of scope for this milestone.
+- The advisor output can only be captured by brittle terminal scraping with no structured checkpoint. In that case, revise the prompt/contract first.
+- Snapshot hot paths require loading full markdown bodies for all cards.
+- Existing dirty worktree changes conflict with a file in scope and it is unclear which behavior is current user intent.
+
+## Acceptance Criteria
+
+- `Improve` appears as a mode and launches exactly one advisor worker.
+- The advisor run can expose the improve skill bundle through `skillRoots`.
+- Improve mode never edits source code, creates branches, creates worktrees, deletes files, commits, or pushes.
+- Structured findings/direction/plan candidates persist independently of the transcript.
+- Cards render after reload/reconnect from server-authoritative state.
+- Per-card approve/reject/refine/promote actions persist and emit named events.
+- Parse failure and advisor failure are visible through `error.surfaced`.
+- All user-facing strings live in every `shared/locales/*.json` file and render through `t()`.
+- Lifecycle tests assert named events rather than deriving server decisions from DOM or snapshot diffs.
+- No large advisor markdown bodies are shipped in the hot snapshot path.
+
+## Human Review Notes
+
+- Product choice to confirm before implementation: exact mode label. This plan uses `Improve` because it mirrors the upstream command and is shorter than `Audit`.
+- Product choice to confirm before implementation: whether approving a card should create a planning run immediately or only mark it approved until the user clicks `Promote`. This plan uses explicit `Promote` to avoid surprising state changes.
+- Product choice to confirm before implementation: whether to preinstall/reference `shadcn/improve` locally or require the user to configure the skill root. This plan assumes existing `skillRoots` support and a configured local skill path.
*** End Patch

````

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:38:42.562Z","phase":null} -->
## Tool result: call_mw5kow1AvOuj12if1ANU2WML · 2026-06-14T16:38:42.562Z

```text
Exit code: 0
Wall time: 0 seconds
Output:
Success. Updated the following files:
A docs/superpowers/plans/2026-06-14-visual-improve-mode.md

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:38:52.853Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:38:52.853Z

The draft plan is saved. I’m doing the hardening pass now: first a quick self-check against the repo constraints, then `baton` as the separate second-opinion reviewer you requested.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:38:52.854Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:38:52.854Z

```json
{
  "cmd": "sed -n '1,260p' docs/superpowers/plans/2026-06-14-visual-improve-mode.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 40000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:38:52.859Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:38:52.859Z

```json
{
  "cmd": "/Users/masterman/.local/bin/baton --help",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:38:52.860Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:38:52.860Z

```json
{
  "cmd": "wc -l docs/superpowers/plans/2026-06-14-visual-improve-mode.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:38:53.047Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:38:53.047Z

```json
{
  "cmd": "rg -n \"branch|worktree|delete|i18n|error\\.surfaced|emitNamedEvent|skillRoots|worker stream|STOP|placeholder|mock|fallback\" docs/superpowers/plans/2026-06-14-visual-improve-mode.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:38:53.077Z","phase":null} -->
## Tool result: call_QtQV1BnkGkKyQBv7pJFXWKoo · 2026-06-14T16:38:53.077Z

````text
Chunk ID: 4c4095
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 5091
Output:
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
- **State Model:** `starting`, `running`, `awaiting_refinement`, `completed`, `failed`, plus per-result `proposed`, `approved`, `rejected`, `superseded`, `promoted`.
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
- `src/server/prompts/improve.md` — new advisor prompt based on upstream improve semantics plus OmniHarness structured-output contract.
- `src/server/db/schema.ts` and `src/server/db/index.ts` — add improve result tables and migrations.
- `src/server/events/named-events.ts` — add improve event kinds and surfaced error codes.
- `src/server/events/persisted-snapshot.ts` — include improve rows in selected-run snapshots with scoped completeness metadata.
- `src/server/workers/entries-types.ts` and `src/server/workers/output-store.ts` only if a new worker entry type is truly required. Prefer not to add one; transcript content should remain ordinary worker output and structured rows should be separate artifacts.
- `src/server/improve/*` — create focused server modules for prompt building, structured parsing, row persistence, card state mutations, and promotion.
- `src/app/api/improve/[id]/results/route.ts` or `src/runtime/http/routes/improve.ts` — card mutation/promote/refine endpoints, following existing runtime route patterns.
- `src/components/ImproveResultsPanel.tsx` and `src/components/ImproveResultCard.tsx` — new UI surface for cards and actions.
- `shared/locales/*.json` — all user-facing labels, statuses, actions, aria labels, placeholders, errors, and empty states.

### Tests To Add Or Update

- `tests/db/schema.test.ts` — assert new improve tables export correctly.
- `tests/api/events-route.test.ts` — snapshot includes improve results and scoped completeness for selected improve run.
- `tests/lifecycle/scenarios/session-types.test.ts` — add `improve` mode creation, run row, worker row, and `worker.spawned`.
- `tests/lifecycle/scenarios/improve-mode-flow.test.ts` — start improve, receive structured result events, reconnect/resync, mutate card state.
- `tests/server/improve/parser.test.ts` — structured extraction accepts valid output, rejects malformed output, preserves evidence, and redacts/omits secret-like values.
- `tests/server/improve/promote.test.ts` — approved result promotion creates/reuses planning artifacts without creating branches/worktrees.
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
  - `id`, `improveRunId`, `runId`, `kind`, `category`, `title`, `status`, `impact`, `effort`, `risk`, `confidence`, `priority`, `sourcePath`, `artifactSeq`, `detailsHash`, `detailsPreview`, `recommendationPreview`, timestamps.
- `improve_result_artifacts`
  - Prefer the existing `artifactStreams` engine for long `details`, `evidence`, `fixSketch`, `planMarkdown`, `rejectionReason`, and `refinementPrompt` bodies rather than storing large text directly in snapshot rows.

Statuses:

- Improve run: `starting`, `running`, `completed`, `failed`.
- Improve result: `proposed`, `approved`, `rejected`, `refining`, `superseded`, `promoted`.

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
- Treat malformed JSON as `improve.parse_failed` plus `error.surfaced`, but keep the transcript visible.
- Store secret-like evidence as location/type only. Do not store secret values if they appear in advisor output.
- Deduplicate by `(runId, clientId)` and preserve existing user decisions when a later partial update refines the same result.

## Client/Server State Invariants

- **Owner:** Server owns improve run/result rows. `ImproveResultsManager` owns the client snapshot projection and local UI expansion state only.
- **Token:** Every result mutation carries `runId`, `improveRunId`, and `resultId`; stale mutation responses must confirm the selected run still matches before changing visible selection.
- **Provenance:** Transcript is worker-produced evidence; structured result rows are server-validated projection; user decisions are server-authoritative after mutation success.
- **Completeness:** Snapshot payload must declare `improveResults.complete` for the selected run. Partial SSE events may add/update rows but cannot erase existing cards unless scoped complete.
- **Ordering:** Sort by `priority`, then `createdAt`, then `id`. Do not rely on timestamp-only ordering.
- **State Machine:** Result transitions are constrained: `proposed -> approved|rejected|refining`; `refining -> proposed|superseded|failed`; `approved -> promoted`; no mutation from `promoted` back to proposed without a new result row.
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
- `improve.parse_failed` `{ runId, improveRunId, reason }`
- `improve.finished` `{ runId, improveRunId, status }`

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
  - Files: `src/server/improve/parser.ts`, `src/server/improve/store.ts`, `src/server/improve/types.ts`.
  - Use `zod`; keep large bodies in artifact streams or bounded previews.
  - Verify: `pnpm test tests/server/improve/parser.test.ts`.

- [ ] Add improve prompt and launch wiring.
  - Files: `src/server/prompts/improve.md`, `src/server/conversations/modes.ts`, `src/server/conversations/create.ts`, `src/server/bridge-client/index.ts` only if current `spawnAgent` request typing does not expose `skillRoots`.
  - Use existing `skillRoots` support to expose the configured improve skill bundle to the one advisor worker.
  - Do not create a branch or worktree.
  - Verify: `pnpm test tests/lifecycle/scenarios/session-types.test.ts`.

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
  - Refine sends a targeted prompt to the same advisor worker when available, otherwise fails visibly with a recovery message.
  - Promote creates or updates a planning artifact/run using existing planning/promotion helpers; it must not implement directly.
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

````

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:38:53.077Z","phase":null} -->
## Tool result: call_HaF0TP7lUDRL1KOwJH9RTi9i · 2026-06-14T16:38:53.077Z

```text
Chunk ID: 72f35f
Wall time: 0.0000 seconds
Process exited with code 1
Original token count: 5
Output:
spawn claude ENOENT

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:38:53.077Z","phase":null} -->
## Tool result: call_s7AmAO9vfEW7lIsJrHoEUg9g · 2026-06-14T16:38:53.077Z

```text
Chunk ID: 7a5672
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 17
Output:
     300 docs/superpowers/plans/2026-06-14-visual-improve-mode.md

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:38:53.090Z","phase":null} -->
## Tool result: call_W4LKrf0TXTdwM8P2k1B8BesA · 2026-06-14T16:38:53.090Z

```text
Chunk ID: f32001
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1086
Output:
7:**Architecture:** Model `improve` as a direct-worker-backed advisor mode, not as an implementation supervisor mode. The advisor worker owns the prose transcript through the existing unified worker stream, while the server extracts and persists structured improve results into typed database rows/artifact streams and surfaces them through the existing SSE snapshot/event path. The UI renders those records in an improve-results panel where each card can be inspected, approved for planning/implementation, rejected, or refined through the same worker conversation.
9:**Tech Stack:** Next.js 15, React 19, TypeScript, Drizzle/SQLite, existing OmniHarness ACP bridge, unified worker stream, named SSE events, shadcn/ui primitives already in the app, Vitest lifecycle tests.
17:**Final Functionality Standard:** A user can choose `Improve`, start an advisor run, watch status, review structured result cards without scrolling through the transcript, approve or reject individual cards, ask the advisor to refine a card, and promote approved output into the existing planning/implementation path. No source-code edits, branches, worktrees, or file deletions are performed by improve mode itself.
32:- **Instrumentation And Observability:** Emit named events for improve start, parsed result, parse failure, card state changes, refinement requested/completed, promote requested/completed/failed, and advisor failure. User-visible failures emit `error.surfaced` with stable codes.
33:- **Onboarding And Discoverability:** Add `Improve` to the composer mode picker with concise i18n copy. Empty improve runs show one clear status panel and one obvious path back to the composer.
58:- Markdown transcript remains visible in the worker stream.
62:- The mode never creates branches or worktrees. It can only promote approved output into existing planning/implementation flows after explicit user action.
81:- `src/components/home/ConversationComposer.tsx` and `src/app/home/ComposerContainer.tsx` — mode-specific placeholder/steering behavior, without forcing implementation steering.
92:- `shared/locales/*.json` — all user-facing labels, statuses, actions, aria labels, placeholders, errors, and empty states.
101:- `tests/server/improve/promote.test.ts` — approved result promotion creates/reuses planning artifacts without creating branches/worktrees.
102:- `tests/ui/improve-results-panel.test.tsx` — cards render metadata/actions from manager state and all visible copy comes through i18n.
108:- Mission: Start an `Improve` run, wait for a mocked structured finding, approve it, refine another card, and promote the approved one.
117:  - `id`, `runId`, `status`, `focus`, `skillRootsJson`, `startedAt`, `completedAt`, `lastError`, timestamps.
164:- Treat malformed JSON as `improve.parse_failed` plus `error.surfaced`, but keep the transcript visible.
211:  - Include cleanup behavior in existing delete-conversation paths if foreign-key cleanup is manual there.
220:  - Files: `src/server/prompts/improve.md`, `src/server/conversations/modes.ts`, `src/server/conversations/create.ts`, `src/server/bridge-client/index.ts` only if current `spawnAgent` request typing does not expose `skillRoots`.
221:  - Use existing `skillRoots` support to expose the configured improve skill bundle to the one advisor worker.
222:  - Do not create a branch or worktree.
273:## STOP Conditions
277:- The improve skill bundle cannot be exposed through existing `skillRoots` support without changing CLI storage or installing dependencies.
278:- Implementing promotion requires branch or worktree creation. Branches are forbidden; worktrees require explicit user approval and are out of scope for this milestone.
281:- Existing dirty worktree changes conflict with a file in scope and it is unclear which behavior is current user intent.
286:- The advisor run can expose the improve skill bundle through `skillRoots`.
287:- Improve mode never edits source code, creates branches, creates worktrees, deletes files, commits, or pushes.
291:- Parse failure and advisor failure are visible through `error.surfaced`.
300:- Product choice to confirm before implementation: whether to preinstall/reference `shadcn/improve` locally or require the user to configure the skill root. This plan assumes existing `skillRoots` support and a configured local skill path.

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:39:03.979Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:39:03.979Z

`baton --help` failed because this local `baton` wrapper tried to spawn `claude` and `claude` is not installed in the current PATH. I’m inspecting the local baton script/config directly so I can use the correct review path or report a real blocker rather than guessing.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:39:03.983Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:39:03.983Z

```json
{
  "cmd": "file /Users/masterman/NLP/baton/baton; ls -la /Users/masterman/NLP/baton | sed -n '1,200p'",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 16000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:39:03.983Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:39:03.983Z

```json
{
  "cmd": "sed -n '260,340p' docs/superpowers/plans/2026-06-14-visual-improve-mode.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 14000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:39:03.991Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:39:03.991Z

```json
{
  "cmd": "find /Users/masterman/NLP/baton -maxdepth 2 -type f | sort | sed -n '1,120p'",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:39:04.186Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:39:04.186Z

```json
{
  "cmd": "command -v claude || true; command -v codex || true; command -v gemini || true; command -v opencode || true",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:39:04.216Z","phase":null} -->
## Tool result: call_lNPxYMQgSqxgQRudyRaPRFp6 · 2026-06-14T16:39:04.216Z

```text
Chunk ID: 09e103
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 148
Output:
/Users/masterman/NLP/baton/baton: a /usr/bin/env node script text executable, Unicode text, UTF-8 text
total 80
drwxr-xr-x@  8 masterman  staff    256 May 16 09:26 .
drwxr-xr-x  36 masterman  staff   1152 Jun 14 18:01 ..
drwxr-xr-x@ 12 masterman  staff    384 May 25 05:26 .git
-rw-r--r--@  1 masterman  staff     35 May 16 09:26 .gitattributes
-rw-r--r--@  1 masterman  staff    198 May 16 09:26 .gitignore
-rw-r--r--@  1 masterman  staff   4587 May 25 05:26 README.md
-rwxr-xr-x   1 masterman  staff  17265 May 25 05:26 baton
-rwxr-xr-x   1 masterman  staff    295 May 16 09:26 install.sh

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:39:04.217Z","phase":null} -->
## Tool result: call_KZsjrAw8umksp93QTO5At3JX · 2026-06-14T16:39:04.217Z

```text
Chunk ID: 6e16b6
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 788
Output:
- [ ] Add lifecycle flow coverage.
  - Files: `tests/lifecycle/scenarios/improve-mode-flow.test.ts`.
  - Test: start improve, emit `improve.started`, parse one result, receive `improve.result_upserted`, drop SSE, resync, approve/reject/refine card, assert persisted row state.
  - Verify: `pnpm test:lifecycle -- tests/lifecycle/scenarios/improve-mode-flow.test.ts` if supported by the runner, otherwise `pnpm test tests/lifecycle/scenarios/improve-mode-flow.test.ts`.

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
- Snapshot hot paths require loading full markdown bodies for all cards.
- Existing dirty worktree changes conflict with a file in scope and it is unclear which behavior is current user intent.

## Acceptance Criteria

- `Improve` appears as a mode and launches exactly one advisor worker.
- The advisor run can expose the improve skill bundle through `skillRoots`.
- Improve mode never edits source code, creates branches, creates worktrees, deletes files, commits, or pushes.
- Structured findings/direction/plan candidates persist independently of the transcript.
- Cards render after reload/reconnect from server-authoritative state.
- Per-card approve/reject/refine/promote actions persist and emit named events.
- Parse failure and advisor failure are visible through `error.surfaced`.
- All user-facing strings live in every `shared/locales/*.json` file and render through `t()`.
- Lifecycle tests assert named events rather than deriving server decisions from DOM or snapshot diffs.
- No large advisor markdown bodies are shipped in the hot snapshot path.

## Human Review Notes

- Product choice to confirm before implementation: exact mode label. This plan uses `Improve` because it mirrors the upstream command and is shorter than `Audit`.
- Product choice to confirm before implementation: whether approving a card should create a planning run immediately or only mark it approved until the user clicks `Promote`. This plan uses explicit `Promote` to avoid surprising state changes.
- Product choice to confirm before implementation: whether to preinstall/reference `shadcn/improve` locally or require the user to configure the skill root. This plan assumes existing `skillRoots` support and a configured local skill path.

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:39:04.217Z","phase":null} -->
## Tool result: call_nwLTg5vDabf8CClW8mz6zEne · 2026-06-14T16:39:04.217Z

```text
Chunk ID: e47c78
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 98
Output:
/Users/masterman/NLP/baton/.git/HEAD
/Users/masterman/NLP/baton/.git/config
/Users/masterman/NLP/baton/.git/description
/Users/masterman/NLP/baton/.git/index
/Users/masterman/NLP/baton/.git/packed-refs
/Users/masterman/NLP/baton/.gitattributes
/Users/masterman/NLP/baton/.gitignore
/Users/masterman/NLP/baton/README.md
/Users/masterman/NLP/baton/baton
/Users/masterman/NLP/baton/install.sh

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:39:04.237Z","phase":null} -->
## Tool result: call_uRtZrwWrx8n0BDv5FbGE6JIw · 2026-06-14T16:39:04.237Z

```text
Chunk ID: f1b4a3
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 13
Output:
/Applications/Codex.app/Contents/Resources/codex

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:39:10.300Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:39:10.300Z

```json
{
  "cmd": "sed -n '1,260p' /Users/masterman/NLP/baton/README.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 24000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:39:10.433Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:39:10.433Z

```json
{
  "cmd": "sed -n '1,260p' /Users/masterman/NLP/baton/baton",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:39:10.473Z","phase":null} -->
## Tool result: call_3xKneOE4p4LeyGB3IuxuVP4K · 2026-06-14T16:39:10.473Z

````text
Chunk ID: 269671
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1147
Output:
# Baton

*Pass the baton to the Runner.*

`baton` is a drop-in replacement for `claude` that routes inference through
Runner's managed Claude connection. Same `~/.claude` config, same `CLAUDE.md`,
same slash commands and agents — only the route changes.

## What It Does

- decrypts your Runner credential store at `~/.runner/credentials.enc`
- refreshes the Runner token when it is near expiry
- launches `claude` with `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`,
  `--dangerously-skip-permissions`, and `--thinking-display summarized`, then
  passes every other argument straight through

No plaintext Runner token is written into this repo.

## Requirements

- macOS
- Runner installed and logged in
- Claude Code installed as `claude`
- Node.js 18+

## Install

```sh
git clone https://github.com/davisonio/baton.git
cd baton
./install.sh
baton status
```

## Usage

Use `baton` exactly the way you use `claude`:

```sh
baton                              # interactive session
baton 'fix this test'              # interactive with an initial prompt
baton -p 'reply OK only'           # one-shot print mode
baton --model claude-opus-4-7      # pick a model
baton --resume                     # resume a session
baton mcp list                     # any other claude subcommand
```

Every Claude session launched through `baton` includes
`--dangerously-skip-permissions` and `--thinking-display summarized`
automatically.

Switch models inside a session with `/model <id>`. Use Anthropic's standard ids
— they route through Runner because the base URL is set.

Subcommands of `baton` itself:

```sh
baton status     # show route/auth/model status (no secrets printed)
baton models     # list Runner-managed model ids
baton token      # print a current Runner JWT to stdout
baton credential-profile # print OmniHarness-compatible env profile JSON
baton statusline # Claude Code statusLine: route + cost
baton cost       # cumulative lifetime spend on Runner (estimated)
baton stop-hook  # Claude Code Stop hook for cost tracking
```

## OmniHarness Credential Profile

To let OmniHarness inject Runner credentials into Claude ACP workers at spawn
time, create a command-backed profile:

```json
{
  "command": "/Users/masterman/.local/bin/baton",
  "args": ["credential-profile"],
  "timeoutMs": 5000
}
```

Save it as `.omniharness/credential-profiles/claude/profile.json` in the
OmniHarness root, or point `OMNIHARNESS_CREDENTIAL_PROFILES_DIR` at another
profiles directory. OmniHarness receives only the generic env profile contract;
Baton remains responsible for extracting and refreshing Runner credentials.

## Status Line

Routing is per-terminal: a session launched via `baton` uses Runner; one
launched via plain `claude` uses your Max subscription. To see which route a
session is on, wire `baton statusline` into `~/.claude/settings.json`:

```json
{
  "statusLine": {
    "type": "command",
    "command": "baton statusline"
  }
}
```

Output is `xhigh · claude max` on plain claude or
`xhigh · api.runner.now · $123.45` on Runner — the dollar figure is your
lifetime spend (Max is flat-rate, so it is only shown on Runner).

## Cost Tracking

Spend is collected by a `Stop` hook that fires once per assistant turn.
Register it in `~/.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      { "matcher": "*", "hooks": [{ "type": "command", "command": "baton stop-hook" }] }
    ]
  }
}
```

`baton stop-hook` sums per-message token usage from the session transcript,
multiplies by Anthropic's published rates, and writes the running total to
`~/.runner/baton-cost.json`. It only records when `ANTHROPIC_BASE_URL` is set,
so plain `claude` sessions are ignored.

This is an estimate, not what Runner actually bills. Override the built-in
pricing table at `~/.runner/baton-pricing.json` (same shape as the built-in)
if Anthropic publishes new prices.

## Re-attach Mid-Session

The Agent View (left-arrow from a session) re-attaches in a context where the
injected env vars are gone, dropping you back to Max. There is no clean way to
flip routes mid-session — exit and reattach:

```sh
baton --resume
```

## Verify You Are On Runner

Outside Claude Code, run `baton status` and look for `"route": "runner"`.
Inside a session, watch the status line, run `/status`, or
`echo $ANTHROPIC_BASE_URL`.

## Privacy

Treat Runner as able to see prompts, tool inputs, tool outputs, repo snippets,
and command output sent through Baton. For genuinely confidential work, use
plain `claude` or a local model setup.

## Uninstall

```sh
rm -f ~/.local/bin/baton
```

````

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:39:10.486Z","phase":null} -->
## Tool result: call_op3XsDYUo80L9M9j9lWZiUMK · 2026-06-14T16:39:10.486Z

```text
Chunk ID: f44847
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

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:39:15.238Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:39:15.238Z

```json
{
  "cmd": "sed -n '260,620p' /Users/masterman/NLP/baton/baton",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 40000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:39:15.309Z","phase":null} -->
## Tool result: call_344Rw0GyNbyp6aUdiyWelGAH · 2026-06-14T16:39:15.309Z

```text
Chunk ID: 5d39d7
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

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:39:28.964Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:39:28.964Z

```json
{
  "cmd": "mdfind 'kMDItemFSName == \"claude\"' 2>/dev/null | sed -n '1,40p'; find /Users/masterman -maxdepth 4 -type f -perm -111 -name claude 2>/dev/null | sed -n '1,40p'",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 30000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:39:29.595Z","phase":null} -->
## Tool result: call_BpMmFSUFaZrxvklIPcm8nnM4 · 2026-06-14T16:39:29.595Z

```text
Chunk ID: 6150e8
Wall time: 0.4597 seconds
Process exited with code 0
Original token count: 0
Output:

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:39:34.388Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:39:34.388Z

There is no `claude` binary anywhere obvious on this machine, and Baton’s README confirms it is a Claude Code wrapper. I can’t complete a Baton-backed second opinion until Claude Code is installed or `CLAUDE_BIN` points at a compatible Claude Code executable; I’ll still harden the plan with a local self-review now, and I can rerun Baton once that dependency exists.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:39:35.573Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:39:35.573Z

```json
{
  "cmd": "/Users/masterman/.local/bin/baton status",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:39:35.731Z","phase":null} -->
## Tool result: call_El0B1lGzjFZBXIedWR0OVPUu · 2026-06-14T16:39:35.731Z

```text
Chunk ID: 9f3609
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 145
Output:
{
  "route": "runner",
  "claudeBinary": "claude",
  "runnerConfigDir": "/Users/masterman/.runner",
  "runnerBackendUrl": "https://api.runner.now",
  "defaultConnection": {
    "slug": "managed-claude",
    "name": "Claude (Managed by Runner)",
    "providerType": "anthropic",
    "authType": "managed",
    "defaultModel": "runner-morph-router"
  },
  "credential": {
    "hasRefreshToken": true,
    "expiresAtIso": "2026-07-13T17:15:34.000Z"
  },
  "runnerModels": [
    "claude-opus-4-7",
    "claude-opus-4-8",
    "claude-sonnet-4-6",
    "claude-haiku-4-5-20251001"
  ]
}

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:39:47.199Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:39:47.199Z

Baton itself is authenticated and points at Runner, but it cannot start a review process because its configured `claudeBinary` is `claude` and that binary is missing. I’m going to run the available Codex CLI as a separate read-only fallback reviewer so the plan still gets an independent pass; the Baton blocker will stay called out.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:39:47.202Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:39:47.202Z

```json
{
  "cmd": "/Applications/Codex.app/Contents/Resources/codex exec --help",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:39:47.315Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:39:47.315Z

```json
{
  "cmd": "sed -n '1,220p' /Applications/Codex.app/Contents/Resources/codex 2>/dev/null || true",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 8000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:39:47.397Z","phase":null} -->
## Tool result: call_rvXO6CEY8hHraeqBWTBE0jaT · 2026-06-14T16:39:47.397Z

```text
Chunk ID: f3bbc7
Wall time: 0.0264 seconds
Process exited with code 0
Original token count: 921
Output:
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

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:39:47.486Z","phase":null} -->
## Tool result: call_qXLg6BE8j8MoRnBLivTzAPvg · 2026-06-14T16:39:47.486Z

```text
Chunk ID: 1565f2
Wall time: 0.0105 seconds
Process exited with code 0
Original token count: 13162
Output:
Total output lines: 220

����         -     ���        H   __PAGEZERO                                                        H  __TEXT                  @�             @�                 __text          __TEXT           @     ̵	     @               �            __text_startup  __TEXT          ��	   P      ��	             �            __lcxx_override __TEXT          �	   �       �	             �            __stubs         __TEXT          ��	   �G      ��	            �           __stub_helper   __TEXT          �?	   �%      �?	             �            __objc_stubs    __TEXT          `e	           `e	             �            __objc_methlist __TEXT          �e	   DI      �e	                           __cstring       __TEXT          Ȯ	   �0     Ȯ	                          __const         __TEXT           �/	   H9S     �/	                           __gcc_except_tab__TEXT          H�
   ��n     H�
                           __ustring       __TEXT          @��
   �      @��
                           __objc_methname __TEXT          :��
   ��      :��
                           __objc_classname__TEXT          ��
         ��
                           __objc_methtype __TEXT          ��
   o�      ��
                           __unwind_info   __TEXT          ���
   i     ���
                           __eh_frame      __TEXT          ��   �#�     ��             h               �  __DATA_CONST     @�    @F      @�     @F                 __got           __DATA_CONST     @�   ��       @�              �          __mod_init_func __DATA_CONST    �ү   P      �ү           	               __const         __DATA_CONST    �߯   pE     �߯                           __cfstring      __DATA_CONST    P_�   �      P_�                           __objc_classlist__DATA_CONST    �z�   X      �z�                          __objc_catlist  __DATA_CONST    H~�          H~�                          __objc_protolist__DATA_CONST    X~�   �       X~�                           __objc_imageinfo__DATA_CONST    H�          H�                              H  __DATA           ��    �      ��                        __objc_const    __DATA           ��   ��       ��                           __la_symbol_ptr __DATA          �"�         �"�              O          __objc_selrefs  __DATA          �;�   x'      �;�                         __objc_protorefs__DATA          c�          c�                         __objc_classrefs__DATA           c�           c�                          __objc_superrefs__DATA           g�   �       g�                          __objc_ivar     __DATA          �i�   4      �i�                           __objc_data     __DATA          �o�   p!      �o�                           __data          __DATA           ��   ��      ��                           _CTR0GR_ISIZE_FN__DATA          �m�          �m�                            __thread_vars   __DATA          �m�   �      �m�                          _CTOR0_ISIZE_FN __DATA          Xv�           Xv�                            __thread_data   __DATA          Xv�   x      Xv�                          __thread_bss    __DATA          �w�   �                                    __common        __DATA          ��   }	                                   __bss           __DATA           �   �
                                      H   __LINKEDIT       @    @�      ��    �-�                   "  �0    ��x� xA��"  (d��� �bpX  `���/       �B�  �P�O    P              �  !�  �                          ЫOq                            /usr/lib/dyld             �un��3y��]���[�2                      �*              (  �   \��               X         <
  - /System/Library/Frameworks/AppKit.framework/Versions/C/AppKit      h         a  @ /System/Library/Frameworks/CoreGraphics.framework/Versions/A/CoreGraphics          X              /System/Library/Frameworks/IOKit.framework/Versions/A/IOKit        `               /System/Library/Frameworks/AudioUnit.framework/Versions/A/AudioUnit        `               /System/Library/Frameworks/CoreAudio.framework/Versions/A/CoreAudio        `         ��  ,/System/Library/Frameworks/Foundation.framework/Versions/C/Foundation      h               /System/Library/Frameworks/AVFoundation.framework/Versions/A/AVFoundation          h           �   /System/Library/Frameworks/AudioToolbox.framework/Versions/A/AudioToolbox          `         �   /System/Library/Frameworks/CoreMedia.framework/Versions/A/CoreMedia        h         �   /System/Library/Frameworks/VideoToolbox.framework/Versions/A/VideoToolbox          `             /System/Library/Frameworks/CoreVideo.framework/Versions/A/CoreVideo        X               /System/Library/Frameworks/OpenGL.framework/Versions/A/OpenGL      X          p   /System/Library/Frameworks/Metal.framework/Versions/A/Metal        `          �    /System/Library/Frameworks/MetalKit.framework/Versions/A/MetalKit          `             /System/Library/Frameworks/QuartzCore.framework/Versions/A/QuartzCore      `               /System/Library/Frameworks/IOSurface.framework/Versions/A/IOSurface       �p               /System/Library/Frameworks/ScreenCaptureKit.framework/Versions/A/ScreenCaptureKit          0          �l   /usr/lib/libc++.1.dylib    h         ��  � /System/Library/Frameworks/CoreFoundation.framework/Versions/A/CoreFoundation      h           �   /System/Library/Frameworks/CoreServices.framework/Versions/A/CoreServices          p         xG   /System/Library/Frameworks/SystemConfiguration.framework/Versions/A/SystemConfiguration    8              /usr/lib/liblzma.5.dylib           8              /usr/lib/libbz2.1.0.dylib          8           G   /usr/lib/libSystem.B.dylib         8           �    /usr/lib/libobjc.A.dylib           0             /usr/lib/libz.1.dylib      `         x��   /System/Library/Frameworks/Security.framework/Versions/A/Security          8               /usr/lib/libiconv.2.dylib          `              /System/Library/Frameworks/CoreImage.framework/Versions/A/CoreImage     &      H�;8� )      �B          �)� �                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         …5162 tokens truncated…ʮ�<���}��!N�	�"���N�����!O�	�"���O���ʮ�=���~��!N�	�"���N�����!O�	�"���O���ʮ�>�����!N�	�"���N�����!O�	�"���O���ʮ�?�k�����T�K�= X n�K�=�'� ��< X n�'� �<�� ��< X n ��<�[�=�k�= X n!X n�[�=�k�= ��< X n ��<�@� �= X n �=�{�=��= X n!X n�{�=ዀ= �= X n �= !�= X n !�=���=��= X n!X n���=ᫀ= 1�= X n 1�= A�= X n A�=��=���= X n!X nເ=�ˀ= Q�= X n Q�= a�= X n a�=���=���= X n!X n�ۀ=��= q�= X n q�=���= X n���= ��= X n ��=���@�h�R�������{E��OD��WC��_B��gA��oƨ�_��g���_��W��O��{������ ���� �բ���h�R���� ���������� ����B ��B ��B ��B �� � ���R�R� ��R�������� �D � #�= X n #�= ��< X n ��<�jx�d��j8��" �� ��R���R��R������� T� ��R������ �, � 3�= X n 3�= ��< X n ��<�" �� ��R���R��R����#�������������������
��� �)}l��R� �����t��!N�	�"���N�����!O�	�"���O���ʮ�4���u��!N�	�"���N�����!O�	�"���O���ʮ�5���v��!N�	�"���N�����!O�	�"���O���ʮ�6���w��!N�	�"���N�����!O�	�"���O���ʮ�7���x��!N��"���!O��"�ʮ�8���y��!N��"���!O��"�ʮ�9���z��!N��"���!O��"�ʮ�:���{��!N��"���!O��"�ʮ�;���|��!N�
�"���N�����!O�
�"���O���ʮ�<���}��!N�
�"���N�����!O�
�"���O���ʮ�=���~��!N�
�"���N�����!O�
�"���O���ʮ�>�����!N�
�"���N�����!O�
�"���O���ʮ�?�k�����T�A��A��A��!Lʭ	��!��ʍLʭ��������A��!Lʭ	��!��ʍLʭ��������A��!Lʭ	��!��ʍLʭ���������A��A��A��!N��	��!����N�����������= X n��=���< X n���<���< X n���<�#�=�3�= X n!X n�#�=�3�=���< X n���<��= X n��=�C�=�S�= X n!X n�C�=�S�=��= X n��=�"�= X n�"�=n!K��	��c�=�s�=�!��� X n!X n�c�=�s�=nK����2�= X n�2�=O!J��	��B�= X n�B�=�!��
�OJ����!M�	�"�ʰM�����=��= X n!X n���=ᓀ=�R�= X n�R�=�!L�)	��b�= X n�b�=��=��= X n!X nࣀ=᳀=)!	�)�,Iʈ��r�= X n�r�=���= X n�À=�����= X n���=�+������*���
�J-����)������= X n��=���= X n���=� ���x�R�����{D��OC��WB��_A��gŨ�_�(@9) @9(A�)@9�	�)@9�	�) @9!	�)$@9a	�)(@9�	�),@9�	�)@9*@9IA	�*@9)�
�*@9)�
�*0@9)!
�*4@9)a
�*8@9)�
�*<@9)�
�J@9K @9jA
�K@9J��K@9J��K @9J!�K$@9Ja�K(@9J��K,@9J��K@9L@9�A�L@9k��L@9k��L0@9k!�L4@9ka�L8@9k��L<@9k��l@9m @9�A�m@9���m@9���m @9�!�m$@9�a�m(@9���m,@9���m@9n@9�A�n@9���n@9���n0@9�!�n4@9�a�n8@9���n<@9����@9� @9�A��@9΁��@9���� @9�!��$@9�a��(@9Ρ��,@9����@9�@9B��@9���@9����0@9�!��4@9�a��8@9���<@9���PH�� �

���L�� �ʌ�pI�� ��)��M�� �ʭʐ	H�� ��	��	J�� ��J	ʰ	I�� ��)	��	K�� ��k	�0H�� �qJ�1� ��L�!� �J��( ��N�� �����
0�		�*�+ �	(�� ��_��o���g��_��W��O�@�(A�B�I �C�� �	ʊ
�N�����Gʪ �� 
�s
�tʱ ʃ ��ʏ ��	��ʖ ���v���c �b �X �����y ʚ�����Eʥ �a �3 ���s�s�s�7 ʺ�� �� �� �g�� �� �� ʻ�x���� �Z�[�G�� �� �� �� �� �� �� �� �� ��ʥ ʧ �� �� �� �� �� �� �� ��ʭ�b��� �� ���� 	�� ���� 
�)
�#�b �l ʃʬ�h��ʍ ʭʭʮ�O ����) 	�-�)�	4 �)
ʈ� �(�� �����OD��WC��_B��gA��oŨ�_�	(@�Kʪ�Ҫ�����*
��l}
�k}ʛl�+4@�n��}
��}ʛ��/@A����}
��}ʛ���}	��}ɛ ��K..Κ�� ~
�1~ʛ1 �� ~
�1~ʛ1 � ~	�!~ɛ   ��K,њ���}
��}ʛ� ʭʯ}
��}ʛ�ʯ}	��}ɛ ��K�-͚ʏ}
��}ʛ��k�l}
�j}ʛJ�K}	�I}ɛ)��
KE �)-ʚ%��_�����W��O��{������3X@��@����!`	�����R�?��  6  �R�{F��OE��WD�����_ֈJ@987��!�4���" �R�?�� �  �RH�7���!8
���B �R��t�`�7  ��!�4���B �R�?�� �  �Rh�7�� 9�� �� �� ��
@��# ����)a�� ��+����!8
�� �B �R��t�@��5��!�4��# �B �R_�t���7��!�6���" �R�?�������O��{��� ���� �  �� �  @�@����!�	�"�R ?�� ��c 9�g 9���!�	��������C �b�R�� �t����!�	����� ��C ��# �"�R��t��g@9�c@9 *? q! T 7�@�	I@9� 87 !@�@���!�:�B �R   !@�@���!�6�" �R ?�   �{C��OB����_�����o��{��C������)���' �
 � � ��'�
 � � � ��'�  �$ �( �, ��'�0 �4 �8 � < ��'��'��'��'��'��'	��'
��'��'��'��'��'����!
�� ���B�R�R��t��{Q��oP�����_��� ��{��C �(@�� �7H�7�{A��� �e�t �� @��# ���J.�l}Sk@�-�Kik8� 9 ���,��5   �� @��# �J��J�/�l}Sk@�-�Kik8� 9 ���,��5�# �)���B��B|/�$! ���! �RC �R@�t��{A��� ��_��� ��{��C �(@�H�7�7
 @9��)�>�_) qC T(�RH}}S��Rh�@�(yhx��x( �Rj 5+   �� @9� ���J.�l}Sk@�-�Kik8� 9 ���,��5� �   �� @9� �*��J�/�l}Sk@�-�Kik8� 9 ���,��5� �)���"��B|/�$	 ���! �RC �R  h �R�
�J  4�  4 �j�)
�)@9� �Ii(8i �R%˩ �$���! �R" �R ����t��{A��� ��_��� ��{��� �(@�(�7��7	 @����>�?��� T�3 �LM �j��m)�����ͺ�����Ro��R��R�ϒR�r�	���k}͛k�K�b�C<Sc|c|Sb�Ycx��xB<@�ybx��xJ �� � ���T�
�% �( T4   ��	 @��3 ���k.�,@�)�D�M�lil8�= 9 �I���   ��	 @��3 �+��k�/�,@�)�D�M�lil8�= 9 �I����3 �)���"��B|/�$A ���! �RC �R!  ��R�	�?% � TJ	 �l=Sm��R�}�}S��R��k=@�ykx�3 ��i*x��I  ��  �J �i�	�@9�3 �(i*8��R
��3 �
���! �R" �R ��z�t��{B��� ��_���	 @9�  6!��!�7���� �R�t!��!�7���� �R�t	@�?�I T���!�)
�	 �
$@�A�*
�
�)%��	  �� T	@�(�	 �	 ����_�	 �( �(@�l	�K��1��  ��  T@�	� � �� ����_� �����_����O��{��� ���� �  @�@����!���R ?�� ��c 9�g 9���!@
���Є@��C ��# �� �Rk�t��g@9�c@9 *? q! T 7�@�	I@9� 87 !@�@���!�:�B �R   !@�@���!�6�" �R ?�   �{C��OB����_����O��{��� ���� �  @�@����!���R ?�� ��c 9�g 9���!@
���Є���C ��# �� �R:�t��g@9�c@9 *? q! T 7�@�	I@9� 87 !@�@���!�:�B �R   !@�@���!�6�" �R ?�   �{C��OB����_����O��{��� ���� �  @�@����!���R ?�� ��c 9�g 9���!@
���Є@��C ��# �� �R	�t��g@9�c@9 *? q! T 7�@�	I@9� 87 !@�@���!�:�B �R   !@�@���!�6�" �R ?�   �{C��OB����_����O��{��� ���� �  @�@����!���R ?�� ��c 9�g 9���!@
���Є���C ��# �� �R��t��g@9�c@9 *? q! T 7�@�	I@9� 87 !@�@���!�:�B �R   !@�@���!�6�" �R ?�   �{C��OB����_��{��� �� �c T� �( T� �) T @9) �* ��= �� T�	��@��  To@9�k` Tk �� �a��T� ѿ � Tk �m�_8�k  Tm�_8�k@ Tm�_8�k  Tm@9�k  Tm �k ��
�!��TN  �N!�=�!n!�+ f�k��� Tj��J��+	J�i	�)�
@9)
��3��?�)���	 �I �R;  .@��Rl�+��� T� ь��� TL�k �k�k� �����<b@�f	�=�!n�"n�%n�&ne�NF�N��N��%n� f�N �k��������TkA �LA ��H Ta�=�!n!�- f����� TkA ��	��T
�b TA�< �!n � f�k��  Tk��k��K	K����	 ��	 ��{���_ր�
 f�J��� TJ��J��j	J�KA ѱ��k ѯ�����
  k	 ѫ��k ѩ��`�
 f�J��  TJ��J��k	J����@�
 f�J���  TJ��J��j	J�KA ���� �
 f�J��J��J��j	J�K� �������A�������`���{��� �� �� T� � T� �� T D9D9) ��= �h T* �N@9�k�Mz` TJ �� �A��T	 ��  `N�N"�=�"n"�"nb�NB�J f�J��` TJ��J��*	J�I	�)�?�" T*hi8
hj8)
��3��?�)���	 �I �R	 ��{���_�* �-@��Rn�+��� �c T�� ������ TL� �k �k�k� �����<c�=�"n�#n"�"n&�#n��N��ND�N��$n� f�N �k� ��� ���	��TkA �LA �� Tb�=�"n"�"nb�NB�M f����a TkA �����T
�B��TB�< �"n!�"n �N � f�k��@��Tk��k��J	K����`�
 f�J��  TJ��J��j	J�JA Ѭ�����  @�
 f�J��J��J��j	J���������������������	���������{��� �� �� T� � T� � T @9) �* ��= � T�	��@��  To@9�k� Tk �� �a��T� ѿ � Tk �m�_8�k� Tm�_8�k� Tm�_8�k� Tm@9�k  T ��n �k ��
���TJ  �N!�=�!n!�+ f�k��  Tj��J��+	J�i	�)�	 �M �R;  .@��Rl�+��� T� ь��� TL�k �k�k� �����<b@�f	�=�!n�"n�%n�&ne�NF�N��N��%n� f�N �k��������TkA �LA ��H Ta�=�!n!�- f����� TkA ��	��T
�b TA�< �!n � f�k��  Tk��k��K	K���� �� ��{���_ր�
 f�J��� TJ��J��j	J�KA Ѷ��k Ѵ�����
  k	 Ѱ��k Ѯ��`�
 f�J��  TJ��J��k	J����@�
 f�J���  TJ��J��j	J�KA ���� �
 f�J��J��J��j	J�K� �������a�������*���{��� �� �� T� � T� �� T @9@9) ��= �h T�	�N@9�k�Mz` TJ �� �A��T	 ��  `N�N"�=�"n"�"nb�NB�J f�J��` TJ��J��*	J�I	�)�	 �I �R	 ��{���_�* �-@��Rn�+��� �c T�� ������ TL� �k �k�k� �����<c�=�"n�#n"�"n&�#n��N��ND�N��$n� f�N �k� ��� ���	��TkA �LA �� Tb�=�"n"�"nb�NB�M f����a TkA �����T
�B��TB�< �"n!�"n �N � f�k��@��Tk��k��J	K����`�
 f�J��  TJ��J��j	J�JA Ѵ�����  @�
 f�J��J��J��j	J�������������������{��� �� �� T� � T� �	 T D9D9) �D9= � T* �O@9�k�Lz�Mz� TJ �k �!��T	 ��  �N�N�N#�=�#n%�#nC�#n��Nc�Nc�j f�J��` TJ��J��*	J�I	�)�?�b T*hi8
hj8)
��3��?�)���	 �I �R	 ��{���_�* �-@��R��,�� �� T�� �����l TL� �k �k�k� �����<d�=�#n�$n'�#n0�$nC�#nQ�$n��Nd�N��N#�Ne�N��%n� f�� �k� ��� �����TlA �KA џ�� T��=�#n%�#nC�#n��Nc�Nc�m f���� T�A �����T�
�"��TC�< �#n!�#nB�#n �N@�N � f�k�����Tk��k��J	K������
 f�J��@ TJ��J��j	J�JA Ѥ�����J�ڊ	J����`�

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:39:54.244Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:39:54.244Z

I’m running the fallback reviewer read-only against the saved plan. The review prompt explicitly tells it not to edit files and focuses on missing requirements, state, instrumentation, UI, and test gaps.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:40:02.827Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:40:02.827Z

```json
{
  "cmd": "/Applications/Codex.app/Contents/Resources/codex exec -C /Users/masterman/NLP/omniharness --sandbox read-only -o /tmp/visual-improve-mode-second-opinion.txt - <<'EOF'\nYou are my second-opinion planning reviewer. Review the artifact below without editing files.\n\nArtifact: /Users/masterman/NLP/omniharness/docs/superpowers/plans/2026-06-14-visual-improve-mode.md\nUser goal: Turn the shadcn/improve skill set into an OmniHarness mode that runs one advisor agent, captures structured skill output, and displays it visually as reviewable cards that can be approved, rejected, refined by chat, and promoted.\nContext and constraints:\n- Repository: OmniHarness, Next.js/React/SQLite/ACP agent harness.\n- User explicitly forbids creating branches, creating worktrees unless explicitly requested, and deleting files.\n- All frontend user-facing strings must go through shared/locales/*.json and t().\n- Server decisions must emit named events via emitNamedEvent and user-visible failures emit error.surfaced.\n- Worker conversation content must use the unified worker stream; no parallel worker transcript persistence.\n- Baton was requested for second opinion, but Baton cannot spawn because local claude binary is missing. This is a fallback read-only Codex reviewer pass.\n\nPlease judge whether this plan is ready to use.\n\nLook for:\n- missing requirements or user instructions,\n- vague tasks, placeholders, fake components, mocks, or fallback behavior posing as final work,\n- scope creep or non-obvious product decisions that need user confirmation,\n- missing file map, ownership, state, persistence, instrumentation, error, or verification details,\n- sequencing problems or tasks that are too large to execute safely,\n- test gaps and unclear acceptance criteria.\n\nReturn:\n1. Verdict: READY or HARDEN\n2. Highest-impact findings, with concrete fixes\n3. Anything you would deliberately leave alone\nEOF",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 30000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:40:21.089Z","phase":null} -->
## Tool result: call_Jpi2JIAL3MoHE6fHmq5IOSTO · 2026-06-14T16:40:21.089Z

```text
aborted by user after 18.3s
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-06-14T16:40:21.103Z","phase":null} -->
## Task state: turn_aborted · 2026-06-14T16:40:21.103Z

```text
{
  "type": "turn_aborted",
  "turn_id": "019ec6fb-7c83-78d2-9d07-4af6a7362fb7",
  "reason": "interrupted",
  "completed_at": 1781455221,
  "duration_ms": 390375
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-06-14T16:40:31.357Z","phase":null} -->
## Task state: task_started · 2026-06-14T16:40:31.357Z

```text
{
  "type": "task_started",
  "turn_id": "019ec701-997b-7ee2-ab4a-60b8e1a473fd",
  "started_at": 1781455231,
  "model_context_window": 258400,
  "collaboration_mode_kind": "default"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"user","timestamp":"2026-06-14T16:40:31.368Z","phase":null} -->
## User · 2026-06-14T16:40:31.368Z

Try again now

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:40:37.047Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:40:37.047Z

Retrying the read-only reviewer pass now. I’ll keep it scoped to the plan artifact and won’t run implementation commands.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:40:44.468Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:40:44.468Z

```json
{
  "cmd": "/Applications/Codex.app/Contents/Resources/codex exec -C /Users/masterman/NLP/omniharness --sandbox read-only -o /tmp/visual-improve-mode-second-opinion.txt - <<'EOF'\nYou are my second-opinion planning reviewer. Review the artifact below without editing files.\n\nArtifact: /Users/masterman/NLP/omniharness/docs/superpowers/plans/2026-06-14-visual-improve-mode.md\nUser goal: Turn the shadcn/improve skill set into an OmniHarness mode that runs one advisor agent, captures structured skill output, and displays it visually as reviewable cards that can be approved, rejected, refined by chat, and promoted.\nContext and constraints:\n- Repository: OmniHarness, Next.js/React/SQLite/ACP agent harness.\n- User explicitly forbids creating branches, creating worktrees unless explicitly requested, and deleting files.\n- All frontend user-facing strings must go through shared/locales/*.json and t().\n- Server decisions must emit named events via emitNamedEvent and user-visible failures emit error.surfaced.\n- Worker conversation content must use the unified worker stream; no parallel worker transcript persistence.\n- Baton was requested for second opinion, but Baton cannot spawn because local claude binary is missing. This is a fallback read-only Codex reviewer pass.\n\nPlease judge whether this plan is ready to use.\n\nLook for:\n- missing requirements or user instructions,\n- vague tasks, placeholders, fake components, mocks, or fallback behavior posing as final work,\n- scope creep or non-obvious product decisions that need user confirmation,\n- missing file map, ownership, state, persistence, instrumentation, error, or verification details,\n- sequencing problems or tasks that are too large to execute safely,\n- test gaps and unclear acceptance criteria.\n\nReturn:\n1. Verdict: READY or HARDEN\n2. Highest-impact findings, with concrete fixes\n3. Anything you would deliberately leave alone\nEOF",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 30000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:41:14.642Z","phase":null} -->
## Tool result: call_8DaYqJpelIogUT6X5kmFh7OZ · 2026-06-14T16:41:14.642Z

````text
Chunk ID: 9b3c24
Wall time: 30.0037 seconds
Process running with session ID 45127
Original token count: 13071
Output:
Total output lines: 678

OpenAI Codex v0.140.0-alpha.2
--------
workdir: /Users/masterman/NLP/omniharness
model: gpt-5.5
provider: openai
approval: never
sandbox: read-only
reasoning effort: high
reasoning summaries: none
session id: 019ec701-cd12-74e1-b1bc-5500e64d0904
--------
user
You are my second-opinion planning reviewer. Review the artifact below without editing files.

Artifact: /Users/masterman/NLP/omniharness/docs/superpowers/plans/2026-06-14-visual-improve-mode.md
User goal: Turn the shadcn/improve skill set into an OmniHarness mode that runs one advisor agent, captures structured skill output, and displays it visually as reviewable cards that can be approved, rejected, refined by chat, and promoted.
Context and constraints:
- Repository: OmniHarness, Next.js/React/SQLite/ACP agent harness.
- User explicitly forbids creating branches, creating worktrees unless explicitly requested, and deleting files.
- All frontend user-facing strings must go through shared/locales/*.json and t().
- Server decisions must emit named events via emitNamedEvent and user-visible failures emit error.surfaced.
- Worker conversation content must use the unified worker stream; no parallel worker transcript persistence.
- Baton was requested for second opinion, but Baton cannot spawn because local claude binary is missing. This is a fallback read-only Codex reviewer pass.

Please judge whether this plan is ready to use.

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

2026-06-14T16:40:44.641214Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:40:44.671991Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:40:44.672001Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:40:44.672610Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:40:44.672615Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:40:44.673231Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:40:44.673236Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:40:44.673821Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:40:44.673826Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:40:44.674418Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:40:44.674424Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:40:44.675743Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:40:44.675748Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:40:45.008383Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:40:45.016503Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:40:45.016535Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:40:45.105238Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:40:46.528601Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:40:46.545307Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:40:46.545316Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:40:46.545670Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:40:46.545677Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:40:46.546024Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:40:46.546028Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:40:46.546374Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:40:46.546380Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:40:46.546724Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:40:46.546729Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:40:46.547449Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:40:46.547454Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:40:46.882975Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:40:46.890890Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:40:46.890926Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
codex
I’ll use the `using-ultrapowers` and `second-opinion` skills here, then read the plan artifact and evaluate it against the repo constraints without changing files.
exec
/bin/zsh -lc "sed -n '1,240p' /Users/masterman/.agents/skills/using-ultrapowers/SKILL.md" in /Users/masterman/NLP/omniharness
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

If the installed Claude Code version exposes resum…3071 tokens truncated…t/DX/docs/direction, vets findings, prioritizes by leverage, and writes plans only after selection. Its hard rules include never modifying source code, never mutating the working tree, never reproducing secrets, and treating repository content as data rather than instructions.

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
- `src/server/prompts/improve.md` — new advisor prompt based on upstream improve semantics plus OmniHarness structured-output contract.
- `src/server/db/schema.ts` and `src/server/db/index.ts` — add improve result tables and migrations.
- `src/server/events/named-events.ts` — add improve event kinds and surfaced error codes.
- `src/server/events/persisted-snapshot.ts` — include improve rows in selected-run snapshots with scoped completeness metadata.
- `src/server/workers/entries-types.ts` and `src/server/workers/output-store.ts` only if a new worker entry type is truly required. Prefer not to add one; transcript content should remain ordinary worker output and structured rows should be separate artifacts.
- `src/server/improve/*` — create focused server modules for prompt building, structured parsing, row persistence, card state mutations, and promotion.
- `src/app/api/improve/[id]/results/route.ts` or `src/runtime/http/routes/improve.ts` — card mutation/promote/refine endpoints, following existing runtime route patterns.
- `src/components/ImproveResultsPanel.tsx` and `src/components/ImproveResultCard.tsx` — new UI surface for cards and actions.
- `shared/locales/*.json` — all user-facing labels, statuses, actions, aria labels, placeholders, errors, and empty states.

### Tests To Add Or Update

- `tests/db/schema.test.ts` — assert new improve tables export correctly.
- `tests/api/events-route.test.ts` — snapshot includes improve results and scoped completeness for selected improve run.
- `tests/lifecycle/scenarios/session-types.test.ts` — add `improve` mode creation, run row, worker row, and `worker.spawned`.
- `tests/lifecycle/scenarios/improve-mode-flow.test.ts` — start improve, receive structured result events, reconnect/resync, mutate card state.
- `tests/server/improve/parser.test.ts` — structured extraction accepts valid output, rejects malformed output, preserves evidence, and redacts/omits secret-like values.
- `tests/server/improve/promote.test.ts` — approved result promotion creates/reuses planning artifacts without creating branches/worktrees.
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
  - `id`, `improveRunId`, `runId`, `kind`, `category`, `title`, `status`, `impact`, `effort`, `risk`, `confidence`, `priority`, `sourcePath`, `artifactSeq`, `detailsHash`, `detailsPreview`, `recommendationPreview`, timestamps.
- `improve_result_artifacts`
  - Prefer the existing `artifactStreams` engine for long `details`, `evidence`, `fixSketch`, `planMarkdown`, `rejectionReason`, and `refinementPrompt` bodies rather than storing large text directly in snapshot rows.

Statuses:

- Improve run: `starting`, `running`, `completed`, `failed`.
- Improve result: `proposed`, `approved`, `rejected`, `refining`, `superseded`, `promoted`.

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
- Treat malformed JSON as `improve.parse_failed` plus `error.surfaced`, but keep the transcript visible.
- Store secret-like evidence as location/type only. Do not store secret values if they appear in advisor output.
- Deduplicate by `(runId, clientId)` and preserve existing user decisions when a later partial update refines the same result.

## Client/Server State Invariants

- **Owner:** Server owns improve run/result rows. `ImproveResultsManager` owns the client snapshot projection and local UI expansion state only.
- **Token:** Every result mutation carries `runId`, `improveRunId`, and `resultId`; stale mutation responses must confirm the selected run still matches before changing visible selection.
- **Provenance:** Transcript is worker-produced evidence; structured result rows are server-validated projection; user decisions are server-authoritative after mutation success.
- **Completeness:** Snapshot payload must declare `improveResults.complete` for the selected run. Partial SSE events may add/update rows but cannot erase existing cards unless scoped complete.
- **Ordering:** Sort by `priority`, then `createdAt`, then `id`. Do not rely on timestamp-only ordering.
- **State Machine:** Result transitions are constrained: `proposed -> approved|rejected|refining`; `refining -> proposed|superseded|failed`; `approved -> promoted`; no mutation from `promoted` back to proposed without a new result row.
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
- `improve.parse_failed` `{ runId, improveRunId, reason }`
- `improve.finished` `{ runId, improveRunId, status }`

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
  - Files: `src/server/improve/parser.ts`, `src/server/improve/store.ts`, `src/server/improve/types.ts`.
  - Use `zod`; keep large bodies in artifact streams or bounded previews.
  - Verify: `pnpm test tests/server/improve/parser.test.ts`.

- [ ] Add improve prompt and launch wiring.
  - Files: `src/server/prompts/improve.md`, `src/server/conversations/modes.ts`, `src/server/conversations/create.ts`, `src/server/bridge-client/index.ts` only if current `spawnAgent` request typing does not expose `skillRoots`.
  - Use existing `skillRoots` support to expose the configured improve skill bundle to the one advisor worker.
  - Do not create a branch or worktree.
  - Verify: `pnpm test tests/lifecycle/scenarios/session-types.test.ts`.

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
  - Refine sends a targeted prompt to the same advisor worker when available, otherwise fails visibly with a recovery message.
  - Promote creates or updates a planning artifact/run using existing planning/promotion helpers; it must not implement directly.
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

exec
/bin/zsh -lc "sed -n '261,520p' docs/superpowers/plans/2026-06-14-visual-improve-mode.md" in /Users/masterman/NLP/omniharness
 succeeded in 0ms:
  - Files: `tests/lifecycle/scenarios/improve-mode-flow.test.ts`.
  - Test: start improve, emit `improve.started`, parse one result, receive `improve.result_upserted`, drop SSE, resync, approve/reject/refine card, assert persisted row state.
  - Verify: `pnpm test:lifecycle -- tests/lifecycle/scenarios/improve-mode-flow.test.ts` if supported by the runner, otherwise `pnpm test tests/lifecycle/scenarios/improve-mode-flow.test.ts`.

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
- Snapshot hot paths require loading full markdown bodies for all cards.
- Existing dirty worktree changes conflict with a file in scope and it is unclear which behavior is current user intent.

## Acceptance Criteria

- `Improve` appears as a mode and launches exactly one advisor worker.
- The advisor run can expose the improve skill bundle through `skillRoots`.
- Improve mode never edits source code, creates branches, creates worktrees, deletes files, commits, or pushes.
- Structured findings/direction/plan candidates persist independently of the transcript.
- Cards render after reload/reconnect from server-authoritative state.
- Per-card approve/reject/refine/promote actions persist and emit named events.
- Parse failure and advisor failure are visible through `error.surfaced`.
- All user-facing strings live in every `shared/locales/*.json` file and render through `t()`.
- Lifecycle tests assert named events rather than deriving server decisions from DOM or snapshot diffs.
- No large advisor markdown bodies are shipped in the hot snapshot path.

## Human Review Notes

- Product choice to confirm before implementation: exact mode label. This plan uses `Improve` because it mirrors the upstream command and is shorter than `Audit`.
- Product choice to confirm before implementation: whether approving a card should create a planning run immediately or only mark it approved until the user clicks `Promote`. This plan uses explicit `Promote` to avoid surprising state changes.
- Product choice to confirm before implementation: whether to preinstall/reference `shadcn/improve` locally or require the user to configure the skill root. This plan assumes existing `skillRoots` support and a configured local skill path.

2026-06-14T16:41:03.635968Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:41:03.649637Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:41:03.649645Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:41:03.649960Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:41:03.649964Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:41:03.650258Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:41:03.650264Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:41:03.650566Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:41:03.650571Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:41:03.650894Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:41:03.650899Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:41:03.651525Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:41:03.651530Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:41:03.987488Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:41:03.994284Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:41:03.994304Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json

````

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:41:19.451Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:41:19.451Z

The fallback reviewer is still running in read-only mode. I have its session id and will wait for the verdict before applying any useful hardening edits.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:41:20.338Z","phase":null} -->
## Tool call: write_stdin · 2026-06-14T16:41:20.338Z

```json
{
  "session_id": 45127,
  "chars": "",
  "yield_time_ms": 30000,
  "max_output_tokens": 24000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:41:50.346Z","phase":null} -->
## Tool result: call_o30kVCnSdtLC3IESKW57RM89 · 2026-06-14T16:41:50.346Z

````text
Chunk ID: e6751d
Wall time: 30.0034 seconds
Process running with session ID 45127
Original token count: 26555
Output:
Total output lines: 2557

codex
I’ve read the plan once. Before writing the verdict, I’m checking the current repo shape around routing, snapshots, planning artifacts, and events so findings are grounded in actual files rather than just prose.
exec
/bin/zsh -lc "sed -n '1,240p' /Users/masterman/.agents/skills/instrumenting-control-planes/SKILL.md" in /Users/masterman/NLP/omniharness
 succeeded in 0ms:
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

exec
/bin/zsh -lc "sed -n '1,260p' /Users/masterman/.agents/skills/client-server-state-invariants/SKILL.md" in /Users/masterman/NLP/omniharness
 succeeded in 0ms:
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

exec
/bin/zsh -lc "rg --files src tests docs shared | rg 'planning|Planning|events|conversations|runtime/http|app/api|artifact|schema|delete-conversations|ConversationModePicker|ConversationComposer|HomeUiStateManager|EventStreamSnapshotCacheManager|WorkerEntriesManager|Terminal'" in /Users/masterman/NLP/omniharness
 succeeded in 0ms:
docs/superpowers/plans/2026-05-20-append-only-artifact-storage.md
docs/superpowers/plans/2026-05-14-planning-review-agents.md
docs/superpowers/learnings/2026-05-20-supervisor-wake-lease-events.md
docs/superpowers/learnings/2026-05-20-saved-session-recovery-branch-events.md
docs/superpowers/learnings/2026-05-20-http-stop-paths-must-emit-named-events.md
docs/superpowers/learnings/2026-05-20-snapshot-marker-must-not-leapfrog-worker-events.md
docs/superpowers/learnings/2026-05-21-artifact-lock-owner-races.md
docs/superpowers/specs/2026-05-11-organic-planning-interface-design.md
docs/superpowers/specs/2026-04-28-interactive-planning-handoff-design.md
src/lib/worker-stuck-events.ts
src/lib/planning-output.ts
src/lib/conversations.ts
tests/api/planning-promote-route.test.ts
tests/api/conversations-route.test.ts
tests/api/events-route.test.ts
tests/api/planning-review-route.test.ts
tests/api/events-auth.test.ts
tests/db/schema.test.ts
tests/lib/conversations.test.ts
tests/lib/planning-output.test.ts
tests/scripts/delete-conversations.test.ts
src/app/api/supervisor/route.ts
src/app/api/git/route.ts
src/components/PlanningArtifactsPanel.tsx
src/components/Terminal.tsx
tests/conversations/direct-run-status.test.ts
src/app/home/EventStreamSnapshotCacheManager.ts
src/app/home/PlanningReviewPreferencesManager.ts
src/app/home/WorkerEntriesManager.ts
src/app/home/HomeUiStateManager.ts
src/app/api/notifications/route.ts
src/app/api/runs/[id]/route.ts
src/app/api/runs/[id]/resume/route.ts
src/components/PlanningReviewControls.tsx
src/components/ConversationModePicker.tsx
src/app/api/auth/session/route.ts
src/app/api/runs/[id]/answer/route.ts
src/app/api/auth/pair/route.ts
src/components/home/ConversationComposer.tsx
src/app/api/auth/pair/redeem/route.ts
src/app/api/fs/files/route.ts
src/app/api/fs/route.ts
tests/server/conversations-sync.test.ts
src/app/api/auth/login/route.ts
src/app/api/attachments/route.ts
src/app/api/auth/logout/route.ts
src/app/api/events/log/route.ts
src/app/api/events/route.ts
src/app/api/codex-auth/status/route.ts
tests/server/agent-runtime/http.test.ts
src/app/api/plans/route.ts
src/app/api/workers/[workerId]/entries/route.ts
src/app/api/messages/route.ts
tests/server/events/sse-resume.test.ts
tests/server/events/recovery-incident-events.test.ts
tests/server/events/plan-review-blocked-event.test.ts
tests/server/events/plan-ready-event.test.ts
tests/server/events/conversation-delete-events.test.ts
tests/server/events/log-endpoint.test.ts
tests/server/events/named-events.test.ts
tests/server/events/execution-event-store.test.ts
src/app/api/external-sessions/route.ts
src/app/api/settings/route.ts
src/app/api/conversations/[id]/transcript/route.ts
src/app/api/llm-models/route.ts
src/app/api/agents/route.ts
src/app/api/conversations/[id]/queued-messages/[messageId]/route.ts
src/app/api/agents/prewarm-worker/route.ts
src/app/api/conversations/[id]/queued-messages/[messageId]/interrupt/route.ts
src/app/api/agents/catalog/route.ts
src/app/api/conversations/route.ts
src/app/api/conversations/[id]/queued-messages/interrupt-next/route.ts
src/app/api/agents/[name]/route.ts
src/app/api/accounts/route.ts
tests/server/conversations/workspace-orphan-recovery.test.ts
tests/server/conversations/reconcile-user-messages.test.ts
tests/server/conversations/worker-turn-gate.test.ts
src/app/api/conversations/[id]/messages/route.ts
tests/server/planning/review.test.ts
tests/server/planning/review-preferences.test.ts
tests/server/planning/review-prompts.test.ts
tests/server/planning/refresh.test.ts
tests/server/planning/review-agent-selection.test.ts
tests/server/planning/artifacts.test.ts
tests/server/planning/review-resume-source.test.ts
tests/server/artifacts/gitignore-behavior.test.ts
tests/server/artifacts/append-only-store.test.ts
tests/server/artifacts/query-plans.test.ts
src/app/api/planning/[id]/review/route.ts
src/server/events/live-updates.ts
src/server/events/named-events.ts
src/server/events/lifecycle-invariants.ts
src/server/events/execution-event-store.ts
src/server/events/payload-checksum.ts
src/server/events/persisted-snapshot.ts
src/app/api/planning/[id]/promote/route.ts
src/server/db/schema.ts
src/app/api/runtime/bootstrap/route.ts
src/server/artifacts/project-root.ts
src/server/artifacts/cleanup.ts
src/server/artifacts/stream-metadata.ts
src/server/artifacts/stream-index.ts
src/server/artifacts/append-only-store.ts
src/server/artifacts/compaction.ts
src/server/artifacts/stream-types.ts
src/app/api/projects/memory/route.ts
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
src/server/planning/review-prompts.ts
src/server/planning/promote.ts
src/server/planning/review.ts
src/server/planning/review-agent-selection.ts
src/server/planning/refresh.ts
src/server/planning/artifacts.ts
src/server/planning/review-artifact-store.ts
src/server/planning/review-preferences.ts
src/server/planning/status.ts
src/server/agent-runtime/http.ts
tests/lifecycle/scenarios/artifact-backed-snapshot.test.ts
tests/lifecycle/scenarios/end-to-end-events.test.ts
tests/app/planning-review-controls.test.tsx
src/runtime/http/registry.ts
src/runtime/http/server.ts
src/runtime/http/context.ts
tests/runtime/http-routes.test.ts
tests/runtime/http-registry.test.ts
tests/runtime/http-server.test.ts
tests/runtime/http-adapters.test.ts
src/runtime/http/adapters/next.ts
tests/ui/planning-review-controls.test.ts
src/runtime/http/routes/llm-models.ts
src/runtime/http/routes/auth-pair-redeem.ts
src/runtime/http/routes/conversations.ts
src/runtime/http/routes/run-answer.ts
src/runtime/http/routes/run-resume.ts
src/runtime/http/routes/agent-detail.ts
src/runtime/http/routes/runs.ts
src/runtime/http/routes/auth-pair.ts
src/runtime/http/routes/conversation-transcript.ts
src/runtime/http/routes/notifications.ts
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
src/runtime/http/routes/planning.ts
src/runtime/http/routes/settings.ts
src/runtime/http/routes/messages.ts
src/runtime/http/routes/plans.ts

2026-06-14T16:41:16.999807Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:41:17.013498Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:41:17.013507Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:41:17.013856Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:41:17.013860Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:…16555 tokens truncated…| null;
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

 succeeded in 0ms:
        : typeof args.allowedWorkerTypes === "string"
          ? args.allowedWorkerTypes
          : null,
    );

    const planPath = createAdHocPlan(command, attachments);
    const commitWorkflowSettings = shouldCaptureCommitWorkflowForMode(mode)
      ? await readCommitWorkflowSettings()
      : { autoCommitMilestones: false, pushOnCommit: false };
    const gitBaseline = shouldCaptureCommitWorkflowForMode(mode) && commitWorkflowSettings.autoCommitMilestones
      ? captureGitBaseline(projectPath)
      : null;
    const planId = randomUUID();
    const requestedRunId = args.requestedRunId?.trim() || null;
    if (requestedRunId && !RUN_ID_PATTERN.test(requestedRunId)) {
      throw Object.assign(new Error("Invalid requested run id."), { status: 400 });
    }
    await db.insert(plans).values({
      id: planId,
      path: planPath,
      status: mode === "planning" ? "starting" : "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const runId = requestedRunId || createRunId();
    await db.insert(runs).values({
      id: runId,
      planId,
      mode,
      projectPath,
      title: defaultTitle,
      preferredWorkerType,
      preferredWorkerModel: args.preferredWorkerModel?.trim() || null,
      preferredWorkerEffort: args.preferredWorkerEffort?.trim().toLowerCase() || null,
      allowedWorkerTypes: JSON.stringify(allowedWorkerTypes),
      autoCommitMilestones: commitWorkflowSettings.autoCommitMilestones,
      pushOnCommit: commitWorkflowSettings.pushOnCommit,
      gitBaselineJson: gitBaseline ? JSON.stringify(gitBaseline) : null,
      gitWorkspaceJson: resolvedWorkspace.runSnapshot ? JSON.stringify(resolvedWorkspace.runSnapshot) : null,
      completionCommitSha: null,
      status: mode === "planning" ? "starting" : "running",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    runCreated = true;

    if (resolvedWorkspace.runSnapshot) {
      await recordExecutionEvent({
        runId,
        eventType: "git_workspace_selected",
        details: {
          target: resolvedWorkspace.runSnapshot.target,
          headSha: resolvedWorkspace.runSnapshot.headSha,
          branchName: resolvedWorkspace.runSnapshot.branchName,
          detachedLabel: resolvedWorkspace.runSnapshot.detachedLabel,
          dirtyFileCount: resolvedWorkspace.runSnapshot.dirtyFileCount,
          conflictedFileCount: resolvedWorkspace.runSnapshot.conflictedFileCount,
          aheadCount: resolvedWorkspace.runSnapshot.aheadCount,
          behindCount: resolvedWorkspace.runSnapshot.behindCount,
          warnings: resolvedWorkspace.runSnapshot.warnings,
        },
      });
    }

    const initialMessageId = randomUUID();
    const initialMessageCreatedAt = new Date();
    const initialMessage = {
      id: initialMessageId,
      runId,
      role: "user",
      kind: "checkpoint",
      content: command,
      attachmentsJson,
      createdAt: initialMessageCreatedAt,
    };

    if (mode === "implementation") {
      await db.insert(dbMessages).values(initialMessage);
      notifyEventStreamSubscribers();
      startSupervisorRun(runId);
    } else {
      const { workerId, workerNumber } = await allocateWorkerIdentity(runId);
      const cwd = projectPath || process.cwd();
      const workerType = preferredWorkerType || allowedWorkerTypes[0] || "codex";
      const yoloModeEnabled = await readWorkerYoloModeEnabled();
      const workerMode = resolveWorkerLaunchMode(undefined, yoloModeEnabled);

      await db.insert(workers).values({
        id: workerId,
        runId,
        type: workerType,
        status: "starting",
        cwd,
        workerNumber,
        outputLog: "",
        outputEntriesJson: "[]",
        currentText: "",
        lastText: "",
        // Durable copy of the user's opening prompt so the terminal can still
        // render it if the messages row is ever lost (recovery, retry, manual
        // edit). The messages table was being treated as the single source of
        // truth, leaving direct conversations with no recoverable transcript.
        initialPrompt: command,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      if (!args.externalClaudeSessionId || command) {
        await appendUserInputOnDelivery({
          id: initialMessageId,
          runId,
          workerId,
          text: command,
          deliveredAt: initialMessageCreatedAt,
          attachments: attachments.map((attachment) => ({
            id: attachment.id,
            filename: attachment.name,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.size,
          })),
        });
        await db.insert(dbMessages).values(initialMessage);
      }
      notifyEventStreamSubscribers();
      emitNamedEvent({ kind: "worker.spawned", runId, workerId, workerType });
      await appendLifecycleEntry({
        runId,
        workerId,
        text: `Worker spawned (${workerType})`,
        raw: { eventType: "worker.spawned", workerType },
      });

      const response = await buildCreatedConversationResponse({ planId, runId, messageId: initialMessageId, mode });

      if (mode === "direct" || mode === "commit") {
        const initialDirectTurn = startDirectWorkerConversation({
          runId,
          workerId,
          workerType,
          cwd,
          mode: workerMode,
          preferredWorkerModel: args.preferredWorkerModel,
          preferredWorkerEffort: args.preferredWorkerEffort,
          command: workerPrompt,
          externalClaudeSessionId: args.externalClaudeSessionId,
        });
        trackConversationBackgroundTask(initialDirectTurn).catch((error) => {
          console.error("Initial direct conversation worker failed:", error);
        });
      } else {
        // Planning mode: spawn the agent off the critical path so the
        // response returns instantly, mirroring direct mode. Spawn
        // failures surface via `error.surfaced` instead of the HTTP
        // response — the worker row already exists in `starting` and
        // `worker.spawned` has already fired, so observers can render.
        const initialPlanningTurn = (async () => {
          let agent;
          try {
            const { env: envParams } = await readRuntimeEnvFromSettings();
            agent = await spawnAgent({
              type: workerType,
              cwd,
              name: workerId,
              ...(workerMode ? { mode: workerMode } : {}),
              env: envParams,
              model: args.preferredWorkerModel?.trim() || undefined,
              effort: args.preferredWorkerEffort?.trim().toLowerCase() || undefined,
            });
          } catch (error) {
            await persistInitialWorkerSpawnFailure({
              runId,
              workerId,
              mode,
              error,
            });
            console.error(`Spawn for ${mode} conversation failed:`, error);
            return;
          }

          try {
            await runWorkerTurn(workerId, () => runInitialWorkerTurn({
              runId,
              workerId,
              workerType,
              cwd,
              agent,
              mode,
              command: workerPrompt,
            }));
          } catch (error) {
            if (isAgentBusyError(error)) {
              return;
            }
            console.error(`Initial ${mode} conversation turn failed:`, error);
          }
        })();
        void trackConversationBackgroundTask(initialPlanningTurn);
      }

      if (generateTitle) {
        queueConversationTitleGeneration({ runId, command }).catch((error) => {
          console.error("Conversation title generation failed:", error);
        });
      }
      return response;
    }

    if (generateTitle) {
      queueConversationTitleGeneration({ runId, command }).catch((error) => {
        console.error("Conversation title generation failed:", error);
      });
    }

    return buildCreatedConversationResponse({ planId, runId, messageId: initialMessageId, mode });
  } catch (error) {
    if (createdWorktree && !runCreated) {
      throw pendingOrphanWorktreeError({
        projectPath: createdWorktree.projectPath,
        operation: "conversation_launch",
        target: createdWorktree.target,
        error,
      });
    }
    throw error;
  }
}

exec
/bin/zsh -lc "sed -n '1,260p' src/app/home/EventStreamSnapshotCacheManager.ts" in /Users/masterman/NLP/omniharness
 succeeded in 0ms:
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

2026-06-14T16:41:44.603715Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:41:44.617154Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:41:44.617159Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:41:44.617441Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:41:44.617447Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:41:44.617742Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:41:44.617747Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:41:44.618057Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:41:44.618062Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:41:44.618352Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:41:44.618356Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:41:44.618983Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:41:44.618987Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:41:44.950810Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:41:44.958468Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:41:44.958487Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json

````

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:41:53.945Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:41:53.945Z

The reviewer is grounding its findings against the actual routing, snapshot cache, and conversation creation code, which is useful. Still waiting for its final verdict.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:41:54.606Z","phase":null} -->
## Tool call: write_stdin · 2026-06-14T16:41:54.606Z

```json
{
  "session_id": 45127,
  "chars": "",
  "yield_time_ms": 30000,
  "max_output_tokens": 24000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:42:24.612Z","phase":null} -->
## Tool result: call_I7n0ryEApyI3q6GUGyWLn68v · 2026-06-14T16:42:24.612Z

```text
Chunk ID: 6759f6
Wall time: 30.0023 seconds
Process running with session ID 45127
Original token count: 39256
Output:
Total output lines: 2666

codex
The current create flow only treats `planning` specially; direct/commit share one path, and promotion currently assumes a planning run with a verified plan file. That makes the plan’s “promote approved output” step the main hardening point.
exec
/bin/zsh -lc "sed -n '1,260p' src/server/bridge-client/index.ts" in /Users/masterman/NLP/omniharness
exec
/bin/zsh -lc "sed -n '1,260p' src/server/db/schema.ts" in /Users/masterman/NLP/omniharness
 succeeded in 0ms:
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const plans = sqliteTable('plans', {
  id: text('id').primaryKey(),
  path: text('path').notNull(),
  status: text('status').notNull(), // 'pending', 'running', 'done', 'failed'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const runs = sqliteTable('runs', {
  id: text('id').primaryKey(),
  planId: text('plan_id').references(() => plans.id).notNull(),
  sessionType: text('session_type').notNull().default('omni'),
  mode: text('mode').notNull().default('implementation'),
  projectPath: text('project_path'),
  title: text('title'),
  preferredWorkerType: text('preferred_worker_type'),
  preferredWorkerModel: text('preferred_worker_model'),
  preferredWorkerEffort: text('preferred_worker_effort'),
  allowedWorkerTypes: text('allowed_worker_types'),
  specPath: text('spec_path'),
  artifactPlanPath: text('artifact_plan_path'),
  plannerArtifactsJson: text('planner_artifacts_json'),
  plannerReadinessVerdictJson: text('planner_readiness_verdict_json'),
  parentRunId: text('parent_run_id'),
  forkedFromMessageId: text('forked_from_message_id'),
  autoCommitMilestones: integer('auto_commit_milestones', { mode: 'boolean' }).notNull().default(false),
  pushOnCommit: integer('push_on_commit', { mode: 'boolean' }).notNull().default(false),
  gitBaselineJson: text('git_baseline_json'),
  gitWorkspaceJson: text('git_workspace_json'),
  completionCommitSha: text('completion_commit_sha'),
  status: text('status').notNull(), // 'running', 'done', 'failed'
  failedAt: integer('failed_at', { mode: 'timestamp' }),
  lastError: text('last_error'),
  archivedAt: integer('archived_at', { mode: 'timestamp' }),
  memoryMetadataRevision: integer('memory_metadata_revision').notNull().default(0),
  lastMemoryConsolidationAt: integer('last_memory_consolidation_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const workers = sqliteTable('workers', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id).notNull(),
  type: text('type').notNull(),
  status: text('status').notNull(), // 'idle', 'working', 'stuck', 'cred-exhausted'
  cwd: text('cwd').notNull(),
  workerNumber: integer('worker_number'),
  workerRole: text('worker_role'),
  allocationKey: text('allocation_key'),
  title: text('title').notNull().default(''),
  initialPrompt: text('initial_prompt').notNull().default(''),
  outputLog: text('output_log').notNull().default(''),
  outputEntriesJson: text('output_entries_json').notNull().default(''),
  currentText: text('current_text').notNull().default(''),
  lastText: text('last_text').notNull().default(''),
  bridgeSessionId: text('bridge_session_id'),
  bridgeSessionMode: text('bridge_session_mode'),
  // Monotonic fence advanced every time a turn is interrupted. A delivery
  // captures the generation it started under; stale completions from an
  // interrupted (older) turn compare their captured value and refuse to
  // persist terminal status/queue/response updates when it no longer matches.
  turnGeneration: integer('turn_generation').notNull().default(0),
  activeWorkStartedAt: integer('active_work_started_at', { mode: 'timestamp' }),
  activeWorkDurationMs: integer('active_work_duration_ms').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const processSessions = sqliteTable('process_sessions', {
  runId: text('run_id').primaryKey().references(() => runs.id),
  workerId: text('worker_id').references(() => workers.id).notNull(),
  cwd: text('cwd').notNull(),
  commandJson: text('command_json').notNull(),
  commandPreview: text('command_preview').notNull(),
  envPolicy: text('env_policy').notNull().default('minimal'),
  pid: integer('pid'),
  status: text('status').notNull(),
  exitCode: integer('exit_code'),
  signal: text('signal'),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  exitedAt: integer('exited_at', { mode: 'timestamp' }),
  killEscalatedAt: integer('kill_escalated_at', { mode: 'timestamp' }),
  lastError: text('last_error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const workerCounters = sqliteTable('worker_counters', {
  runId: text('run_id').primaryKey().references(() => runs.id),
  nextNumber: integer('next_number').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id).notNull(),
  role: text('role').notNull(), // 'user', 'supervisor', 'worker'
  kind: text('kind'),
  content: text('content').notNull(),
  attachmentsJson: text('attachments_json'),
  workerId: text('worker_id').references(() => workers.id),
  supersededAt: integer('superseded_at', { mode: 'timestamp' }),
  editedFromMessageId: text('edited_from_message_id'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const conversationReadMarkers = sqliteTable('conversation_read_markers', {
  runId: text('run_id').primaryKey().references(() => runs.id),
  lastReadAt: integer('last_read_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const queuedConversationMessages = sqliteTable('queued_conversation_messages', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id).notNull(),
  targetWorkerId: text('target_worker_id').references(() => workers.id),
  action: text('action').notNull(),
  content: text('content').notNull(),
  attachmentsJson: text('attachments_json'),
  status: text('status').notNull(),
  lastError: text('last_error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  deliveredAt: integer('delivered_at', { mode: 'timestamp' }),
});

export const recoveryIncidents = sqliteTable('recovery_incidents', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id).notNull(),
  workerId: text('worker_id').references(() => workers.id),
  queuedMessageId: text('queued_message_id').references(() => queuedConversationMessages.id),
  kind: text('kind').notNull(),
  status: text('status').notNull(),
  autoAttemptCount: integer('auto_attempt_count').notNull().default(0),
  lastError: text('last_error'),
  details: text('details'),
  detectedAt: integer('detected_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  resolvedAt: integer('resolved_at', { mode: 'timestamp' }),
});

export const supervisorScheduledWakes = sqliteTable('supervisor_scheduled_wakes', {
  runId: text('run_id').primaryKey().references(() => runs.id),
  wakeAt: integer('wake_at', { mode: 'timestamp' }).notNull(),
  reason: text('reason').notNull(),
  source: text('source'),
  incidentId: text('incident_id').references(() => recoveryIncidents.id),
  details: text('details'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  type: text('type').notNull(), // 'subscription' | 'api'
  authRef: text('auth_ref').notNull(),
  capacity: integer('capacity'),
  resetSchedule: text('reset_schedule'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const creditEvents = sqliteTable('credit_events', {
  id: text('id').primaryKey(),
  accountId: text('account_id').references(() => accounts.id).notNull(),
  workerId: text('worker_id').references(() => workers.id).notNull(),
  eventType: text('event_type').notNull(), // 'exhausted' | 'switched' | 'wait'
  details: text('details'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const authSessions = sqliteTable('auth_sessions', {
  id: text('id').primaryKey(),
  tokenHash: text('token_hash').notNull(),
  label: text('label'),
  userAgent: text('user_agent'),
  authMethod: text('auth_method').notNull(),
  createdBySessionId: text('created_by_session_id'),
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  absoluteExpiresAt: integer('absolute_expires_at', { mode: 'timestamp' }).notNull(),
  revokedAt: integer('revoked_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const notificationSubscriptions = sqliteTable('notification_subscriptions', {
  id: text('id').primaryKey(),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  sessionId: text('session_id').references(() => authSessions.id),
  userAgent: text('user_agent'),
  failureCount: integer('failure_count').notNull().default(0),
  lastError: text('last_error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp' }).notNull(),
  revokedAt: integer('revoked_at', { mode: 'timestamp' }),
});

export const authPairTokens = sqliteTable('auth_pair_tokens', {
  id: text('id').primaryKey(),
  tokenHash: text('token_hash').notNull(),
  creatorSessionId: text('creator_session_id').notNull(),
  targetRunId: text('target_run_id'),
  deviceLabel: text('device_label'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  redeemedAt: integer('redeemed_at', { mode: 'timestamp' }),
  redeemedSessionId: text('redeemed_session_id'),
  revokedAt: integer('revoked_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const authEvents = sqliteTable('auth_events', {
  id: text('id').primaryKey(),
  sessionId: text('session_id'),
  pairTokenId: text('pair_token_id'),
  eventType: text('event_type').notNull(),
  details: text('details'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const planItems = sqliteTable('plan_items', {
  id: text('id').primaryKey(),
  planId: text('plan_id').references(() => plans.id).notNull(),
  phase: text('phase'),
  title: text('title').notNull(),
  status: text('status').notNull(), // 'pending', 'in_progress', 'blocked', 'done', 'failed'
  sourceLine: integer('source_line'),
  dependsOn: text('depends_on'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const clarifications = sqliteTable('clarifications', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id).notNull(),
  question: text('question').notNull(),
  answer: text('answer'),
  status: text('status').notNull(), // 'pending', 'answered', 'dismissed'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export const workerAssignments = sqliteTable('worker_assignments', {
  id: text('id').primaryKey(),
  runId: text('run_id').references(() => runs.id).notNull(),
  workerId: text('worker_id').references(() => workers.id),
  planItemId: text('plan_item_id').references(() => planItems.id).notNull(),

 succeeded in 0ms:
import { isRecoverableConnectionSupervisorError, isTransientSupervisorError, retrySupervisorRequest } from "@/server/supervisor/retry";
import { notifyEventStreamSubscribers } from "@/server/events/live-updates";
import type { AgentOutputEntry } from "@/lib/agent-output";

export const BRIDGE_URL = process.env.OMNIHARNESS_BRIDGE_URL?.trim() || "http://127.0.0.1:7800";
const BRIDGE_CONNECTION_RESET_MAX_BACKOFF_MS = 15 * 60_000;

export interface AgentRecord {
  [key: string]: unknown;
  name: string;
  type: string;
  cwd: string;
  state: string; // 'idle' | 'working' | 'stopped' | 'error'
  sessionId?: string | null;
  requestedModel?: string | null;
  effectiveModel?: string | null;
  requestedEffort?: string | null;
  effectiveEffort?: string | null;
  credentialProfile?: {
    name: string;
    status: "loaded";
    source: "file" | "command";
    envKeys: string[];
    unsetKeys: string[];
    expiresAt: string | null;
  } | null;
  sessionMode?: string | null;
  lastError?: string | null;
  contextUsage?: {
    inputTokens?: number | null;
    outputTokens?: number | null;
    totalTokens?: number | null;
    maxTokens?: number | null;
    fullnessPercent?: number | null;
  } | null;
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
  pendingElicitations?: Array<{
    requestId: number;
    requestedAt: string;
    sessionId?: string | null;
    toolCallId?: string | null;
    message?: string | null;
    requestedSchema?: {
      type?: string;
      properties?: Record<string, unknown>;
      required?: string[];
    } | null;
  }>;
  outputEntries?: AgentOutputEntry[];
  outputArchive?: {
    totalEntries: number;
    byteSize: number;
    logPath: string;
    liveEntries: number;
    omittedLiveEntries: number;
  } | null;
  renderedOutput?: string | null;
  lastText: string;
  currentText: string;
  stderrBuffer: string[];
  stopReason: string | null;
}

export interface AgentOutputPage {
  name: string;
  cursor: number;
  nextCursor: number | null;
  totalEntries: number;
  entries: NonNullable<AgentRecord["outputEntries"]>;
}

export type BridgeMcpServer =
  | {
      type: "stdio";
      name: string;
      command: string;
      args?: string[];
      env?: Array<{ name: string; value: string; _meta?: Record<string, unknown> | null }>;
      _meta?: Record<string, unknown> | null;
    }
  | {
      type: "http" | "sse";
      name: string;
      url: string;
      headers?: Array<{ name: string; value: string; _meta?: Record<string, unknown> | null }>;
      _meta?: Record<string, unknown> | null;
    };

function describeError(error: unknown, seen = new Set<unknown>()): string {
  if (error == null) {
    return "Unknown error";
  }

  if (seen.has(error)) {
    return "[circular cause]";
  }

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    seen.add(error);
    const cause = "cause" in error ? describeError((error as Error & { cause?: unknown }).cause, seen) : "";
    return cause && cause !== error.message ? `${error.message} (caused by: ${cause})` : error.message;
  }

  return String(error);
}

function isBridgeConnectionRefused(error: unknown) {
  const details = describeError(error).toUpperCase();
  return details.includes("ECONNREFUSED") && (details.includes("127.0.0.1:7800") || details.includes("LOCALHOST:7800"));
}

function stripRepeatedActionPrefix(detail: string, action: string) {
  const prefixPattern = new RegExp(`^(?:${action}\\s+failed:\\s*)+`, "i");
  return detail.replace(prefixPattern, "").trimStart();
}

function isNonRetryableBridgeFailureDetail(detail: string) {
  return /\bAgent session did not include a session id\b/i.test(detail);
}

function isAgentBusyError(error: unknown) {
  return /\bagent is busy\b/i.test(describeError(error));
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asPermissionOptions(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is { optionId?: unknown; kind?: unknown; name?: unknown } => typeof item === "object" && item !== null)
    .map((item) => ({
      optionId: asString(item.optionId),
      kind: asString(item.kind),
      name: asString(item.name),
    }))
    .filter((item) => item.optionId && item.kind && item.name);
}

function asPermissionToolCall(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const item = value as Record<string, unknown>;
  return {
    toolCallId: asNullableString(item.toolCallId),
    kind: asNullableString(item.kind),
    title: asNullableString(item.title),
    status: asNullableString(item.status),
  };
}

function asPendingPermissions(value: unknown): AgentRecord["pendingPermissions"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is {
      requestId?: unknown;
      requestedAt?: unknown;
      sessionId?: unknown;
      toolCall?: unknown;
      options?: unknown;
    } => typeof item === "object" && item !== null)
    .map((item) => ({
      requestId: typeof item.requestId === "number" ? item.requestId : -1,
      requestedAt: asString(item.requestedAt),
      sessionId: typeof item.sessionId === "string" ? item.sessionId : null,
      toolCall: asPermissionToolCall(item.toolCall),
      options: asPermissionOptions(item.options),
    }))
    .filter((item) => item.requestId >= 0 && item.requestedAt);
}

function asPendingElicitations(value: unknown): AgentRecord["pendingElicitations"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      requestId: typeof item.requestId === "number" ? item.requestId : -1,
      requestedAt: asString(item.requestedAt),
      sessionId: typeof item.sessionId === "string" ? item.sessionId : null,
      toolCallId: typeof item.toolCallId === "string" ? item.toolCallId : null,
      message: typeof item.message === "string" ? item.message : null,
      requestedSchema:
        typeof item.requestedSchema === "object" && item.requestedSchema !== null
          ? (item.requestedSchema as NonNullable<AgentRecord["pendingElicitations"]>[number]["requestedSchema"])
          : null,
    }))
    .filter((item) => item.requestId >= 0 && item.requestedAt);
}

function asOutputEntries(value: unknown): NonNullable<AgentRecord["outputEntries"]> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      id: asString(item.id),
      type: asString(item.type) as NonNullable<AgentRecord["outputEntr…29256 tokens truncated…mpt: string) {
  try {
    return await retrySupervisorRequest(async () => {
      const path = `/agents/${name}/ask?stream=true`;
      const res = await fetch(`${BRIDGE_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) {
        let detail = `${res.status} ${res.statusText}`;
        try {
          const payload = await res.json() as { error?: unknown };
          if (typeof payload.error === "string" && payload.error.trim()) {
            detail = payload.error.trim();
          }
        } catch {

 succeeded in 0ms:
/**
 * Planning review finding artifact adapter.
 *
 * Replaces direct `db.insert(planningReviewFindings).values({...})`
 * writes. Large `details` and `recommendation` bodies live in the
 * per-run `planning-review-findings.jsonl` artifact stream. SQLite
 * keeps id + severity + category + title + source_path + created_at
 * + artifact_seq + details_hash + recommendation_preview, all small
 * fields list views need.
 *
 * Dual-writes the legacy body columns during the migration window so
 * unmigrated readers keep working.
 */
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { planningReviewFindings } from "@/server/db/schema";
import { emitNamedEvent } from "@/server/events/named-events";
import {
  appendArtifactLine,
  readAllArtifactEntries,
  resolveArtifactStreamLocation,
} from "@/server/artifacts/append-only-store";
import {
  buildArtifactPreview,
  commitArtifactAppend,
  ensureArtifactStreamRow,
  hashArtifactPayload,
  readArtifactStreamMetadata,
  reserveNextArtifactSeq,
} from "@/server/artifacts/stream-metadata";
import type { ArtifactRecordEnvelope } from "@/server/artifacts/stream-types";

export interface PlanningReviewFindingInput {
  reviewRunId: string;
  roundId: string;
  runId: string;
  severity: string;
  category: string;
  title: string;
  details: string;
  recommendation: string;
  sourcePath?: string | null;
  id?: string;
  createdAt?: Date;
}

export interface PlanningReviewFindingRow {
  id: string;
  reviewRunId: string;
  roundId: string;
  runId: string;
  severity: string;
  category: string;
  title: string;
  details: string | null;
  recommendation: string | null;
  artifactSeq: number | null;
  detailsHash: string | null;
  recommendationPreview: string | null;
  sourcePath: string | null;
  createdAt: Date;
}

interface FindingPayload {
  details: string;
  recommendation: string;
}

export async function recordPlanningReviewFinding(
  input: PlanningReviewFindingInput,
): Promise<{ id: string; artifactSeq: number }> {
  const id = input.id ?? randomUUID();
  const createdAt = input.createdAt ?? new Date();
  const payload: FindingPayload = {
    details: input.details,
    recommendation: input.recommendation,
  };
  const detailsHash = hashArtifactPayload(payload);
  const recommendationPreview = buildArtifactPreview(input.recommendation);

  const { location } = await ensureArtifactStreamRow({
    runId: input.runId,
    kind: "planning_review_findings",
    ownerId: null,
  });
  const seq = await reserveNextArtifactSeq({
    runId: input.runId,
    kind: "planning_review_findings",
    ownerId: null,
  });

  const envelope: ArtifactRecordEnvelope<FindingPayload> = {
    id,
    seq,
    runId: input.runId,
    kind: "planning_review_findings",
    createdAt: createdAt.toISOString(),
    payload,
  };
  try {
    await appendArtifactLine(location, JSON.stringify(envelope), { seq });
  } catch (error) {
    emitNamedEvent({
      kind: "artifact.append_failed",
      runId: input.runId,
      streamKind: "planning_review_findings",
      ownerId: null,
      seq,
      reason: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  await db.insert(planningReviewFindings).values({
    id,
    reviewRunId: input.reviewRunId,
    roundId: input.roundId,
    runId: input.runId,
    severity: input.severity,
    category: input.category,
    title: input.title,
    details: input.details,
    recommendation: input.recommendation,
    artifactSeq: seq,
    detailsHash,
    recommendationPreview,
    sourcePath: input.sourcePath ?? null,
    createdAt,
  });

  await commitArtifactAppend({
    streamId: { runId: input.runId, kind: "planning_review_findings", ownerId: null },
    seq,
    recordId: id,
  });
  return { id, artifactSeq: seq };
}

// --- Read paths ----------------------------------------------------

export async function listPlanningReviewFindingsForRun(runId: string): Promise<PlanningReviewFindingRow[]> {
  const rows = await db
    .select()
    .from(planningReviewFindings)
    .where(eq(planningReviewFindings.runId, runId))
    .orderBy(asc(planningReviewFindings.createdAt), asc(planningReviewFindings.id));
  return hydratePlanningFindings(rows);
}

export async function listPlanningReviewFindingsForSnapshot(
  runId: string,
  limit: number,
): Promise<PlanningReviewFindingRow[]> {
  const rows = await db
    .select()
    .from(planningReviewFindings)
    .where(eq(planningReviewFindings.runId, runId))
    .orderBy(desc(planningReviewFindings.createdAt), desc(planningReviewFindings.id))
    .limit(limit);
  return hydratePlanningFindings(rows);
}

export async function listPlanningReviewFindingsForReviewRun(reviewRunId: string): Promise<PlanningReviewFindingRow[]> {
  const rows = await db
    .select()
    .from(planningReviewFindings)
    .where(eq(planningReviewFindings.reviewRunId, reviewRunId))
    .orderBy(asc(planningReviewFindings.createdAt), asc(planningReviewFindings.id));
  return hydratePlanningFindings(rows);
}

async function hydratePlanningFindings(rows: PlanningReviewFindingRow[]): Promise<PlanningReviewFindingRow[]> {
  const needs: Map<string, PlanningReviewFindingRow[]> = new Map();
  for (const row of rows) {
    if (row.artifactSeq != null && (row.details === null || row.recommendation === null)) {
      const bucket = needs.get(row.runId) ?? [];
      bucket.push(row);
      needs.set(row.runId, bucket);
    }
  }
  if (needs.size === 0) return rows;

  const overrides = new Map<string, { details: string; recommendation: string }>();
  for (const [runId, bucket] of needs) {
    const meta = await readArtifactStreamMetadata({
      runId,
      kind: "planning_review_findings",
      ownerId: null,
    });
    if (!meta) continue;
    const location = await resolveArtifactStreamLocation(
      { runId, kind: "planning_review_findings", ownerId: null, projectPath: meta.projectPath },
      "read",
    );
    const envelopes = await readAllArtifactEntries<ArtifactRecordEnvelope<FindingPayload>>(location);
    const byId = new Map(envelopes.map((env) => [env.id, env] as const));
    for (const row of bucket) {
      const env = byId.get(row.id);
      if (env) {
        overrides.set(row.id, {
          details: env.payload.details,
          recommendation: env.payload.recommendation,
        });
      } else {
        emitNamedEvent({
          kind: "artifact.payload_missing",
          runId,
          streamKind: "planning_review_findings",
          ownerId: null,
          seq: row.artifactSeq,
          recordId: row.id,
        });
      }
    }
  }
  return rows.map((row) => (
    overrides.has(row.id)
      ? {
        ...row,
        details: row.details ?? overrides.get(row.id)!.details,
        recommendation: row.recommendation ?? overrides.get(row.id)!.recommendation,
      }
      : row
  ));
}

export async function countLegacyPlanningReviewFindings(): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)` })
    .from(planningReviewFindings)
    .where(isNull(planningReviewFindings.artifactSeq));
  return Number(rows[0]?.count ?? 0);
}

exec
/bin/zsh -lc "sed -n '1,140p' scripts/delete-conversations.sh" in /Users/masterman/NLP/omniharness
 succeeded in 0ms:
#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="${OMNIHARNESS_ROOT:-$(pwd)}"
DB_PATH="${OMNIHARNESS_DB_PATH:-$ROOT_DIR/sqlite.db}"
RUNTIME_URL="${OMNIHARNESS_BRIDGE_URL:-http://127.0.0.1:7800}"

ROOT_DIR="$ROOT_DIR" DB_PATH="$DB_PATH" RUNTIME_URL="$RUNTIME_URL" node --input-type=module <<'NODE'
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(process.env.ROOT_DIR);
const dbPath = path.resolve(process.env.DB_PATH);
const runtimeUrl = process.env.RUNTIME_URL;

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

const tables = new Set(
  db.prepare("select name from sqlite_master where type = 'table'")
    .all()
    .map((row) => row.name),
);

const workerIds = db.prepare("select id from workers").all().map((row) => row.id);
const adHocPlanPaths = db
  .prepare("select path from plans where path like 'vibes/ad-hoc/%'")
  .all()
  .map((row) => row.path);
const runRowsForCleanup = db
  .prepare("select id, project_path from runs")
  .all();

async function cancelWorkers() {
  for (const id of workerIds) {
    try {
      await fetch(`${runtimeUrl}/agents/${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch {
      // best effort: keep cleanup going if the runtime is offline
    }
  }
}

function deleteConversationRows() {
  const tx = db.transaction(() => {
    db.prepare("delete from credit_events where worker_id in (select id from workers)").run();
    db.prepare("delete from messages where run_id in (select id from runs)").run();
    db.prepare("delete from clarifications where run_id in (select id from runs)").run();
    if (tables.has("validation_runs")) {
      db.prepare("delete from validation_runs where run_id in (select id from runs)").run();
    }
    db.prepare("delete from execution_events where run_id in (select id from runs)").run();
    if (tables.has("supervisor_interventions")) {
      db.prepare("delete from supervisor_interventions where run_id in (select id from runs)").run();
    }
    if (tables.has("supervisor_scheduled_wakes")) {
      db.prepare("delete from supervisor_scheduled_wakes where run_id in (select id from runs)").run();
    }
    if (tables.has("recovery_incidents")) {
      db.prepare("delete from recovery_incidents where run_id in (select id from runs)").run();
    }
    if (tables.has("queued_conversation_messages")) {
      db.prepare("delete from queued_conversation_messages where run_id in (select id from runs)").run();
    }
    if (tables.has("conversation_read_markers")) {
      db.prepare("delete from conversation_read_markers where run_id in (select id from runs)").run();
    }
    if (tables.has("worker_assignments")) {
      db.prepare("delete from worker_assignments where run_id in (select id from runs)").run();
    }
    if (tables.has("process_sessions")) {
      db.prepare("delete from process_sessions where run_id in (select id from runs)").run();
    }
    db.prepare("delete from workers where run_id in (select id from runs)").run();
    if (tables.has("worker_counters")) {
      db.prepare("delete from worker_counters where run_id in (select id from runs)").run();
    }
    db.prepare("delete from runs").run();

    if (tables.has("validation_runs")) {
      db.prepare("delete from validation_runs where plan_item_id in (select id from plan_items)").run();
    }
    db.prepare("delete from execution_events where plan_item_id in (select id from plan_items)").run();
    db.prepare("delete from plan_items").run();
    db.prepare("delete from plans").run();
  });

  tx();
}

function deleteAdHocPlanFiles() {
  for (const relPath of adHocPlanPaths) {
    const absPath = path.resolve(rootDir, relPath);
    if (fs.existsSync(absPath)) {
      fs.rmSync(absPath, { force: true });
    }
  }
}

function deleteArtifactFiles() {
  // Each run owns artifacts in two possible locations:
  //   - <projectPath>/.omniharness/run-data/<runId>/   (new, project-local)
  //   - <appData>/run-data/<runId>/                    (legacy global)
  // We attempt both and ignore ENOENT. The companion .zip is a legacy
  // archive format that may also be sitting next to the global root.
  const appDataRoot = process.env.OMNIHARNESS_APPDATA_DIR
    || path.join(process.env.HOME || "", "Library", "Application Support", "omniharness");
  const legacyGlobalRoot = path.join(appDataRoot, "run-data");

  for (const row of runRowsForCleanup) {
    const runId = row.id;
    const projectPath = row.project_path;
    const candidates = [];
    if (projectPath) {
      candidates.push(path.join(projectPath, ".omniharness", "run-data", runId));
    }
    candidates.push(path.join(legacyGlobalRoot, runId));
    for (const dir of candidates) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch (error) {
        if (error?.code !== "ENOENT") {
          console.warn(`[delete-conversations] failed to remove ${dir}: ${error.message}`);
        }
      }
    }
    const zip = path.join(legacyGlobalRoot, `${runId}.zip`);
    try {
      fs.unlinkSync(zip);
    } catch (error) {
      if (error?.code !== "ENOENT") {
        console.warn(`[delete-conversations] failed to remove ${zip}: ${error.message}`);
      }
    }
  }

  // Remove the agent runtime's per-worker output archive (a separate
  // store from the worker conversation stream). Files are named

2026-06-14T16:42:11.028274Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:42:11.042056Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:11.042061Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:11.042351Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:11.042356Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:11.042651Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:11.042655Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:11.042967Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:11.042971Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:11.043281Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:11.043287Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:11.043948Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:11.043952Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:11.375763Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:42:11.383248Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:42:11.383270Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
exec
/bin/zsh -lc "sed -n '140,280p' scripts/delete-conversations.sh" in /Users/masterman/NLP/omniharness
 succeeded in 0ms:
  // store from the worker conversation stream). Files are named
  // `<runId>-worker-*.jsonl` under `.omniharness/agent-runtime-output/`.
  const runtimeOutputDir = path.join(rootDir, ".omniharness", "agent-runtime-output");
  let entries = [];
  try {
    entries = fs.readdirSync(runtimeOutputDir);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.warn(`[delete-conversations] failed to read ${runtimeOutputDir}: ${error.message}`);
    }
  }
  for (const row of runRowsForCleanup) {
    const prefix = `${row.id}-`;
    for (const entry of entries) {
      if (!entry.startsWith(prefix) || !entry.endsWith(".jsonl")) continue;
      const filePath = path.join(runtimeOutputDir, entry);
      try {
        fs.unlinkSync(filePath);
      } catch (error) {
        if (error?.code !== "ENOENT") {
          console.warn(`[delete-conversations] failed to remove ${filePath}: ${error.message}`);
        }
      }
    }
  }
}

async function main() {
  await cancelWorkers();
  deleteConversationRows();
  deleteAdHocPlanFiles();
  deleteArtifactFiles();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
NODE

2026-06-14T16:42:14.450929Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:42:14.464917Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:14.464926Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:14.465271Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:14.465275Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:14.465568Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:14.465573Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:14.465916Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:14.465923Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:14.466246Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:14.466250Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:14.466965Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:14.466970Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:14.799909Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:42:14.807384Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:42:14.807410Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:42:29.800Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:42:29.800Z

The reviewer has identified promotion semantics and cleanup/data ownership as likely hardening areas. I’m waiting for its final list before editing the plan, so I don’t overfit to partial output.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:42:30.705Z","phase":null} -->
## Tool call: write_stdin · 2026-06-14T16:42:30.705Z

```json
{
  "session_id": 45127,
  "chars": "",
  "yield_time_ms": 30000,
  "max_output_tokens": 24000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:43:00.708Z","phase":null} -->
## Tool result: call_TkpSpwJvbpueImhVHdfW8DU0 · 2026-06-14T16:43:00.708Z

```text
Chunk ID: 23b2c3
Wall time: 30.0017 seconds
Process running with session ID 45127
Original token count: 27195
Output:
Total output lines: 2024

codex
I’m checking the frontend mode types and picker now because this plan touches a lot of type unions. A ready execution plan should name every source-of-truth union, not just the obvious UI component.
exec
/bin/zsh -lc "sed -n '1,220p' src/components/ConversationModePicker.tsx" in /Users/masterman/NLP/omniharness
exec
/bin/zsh -lc "sed -n '1,260p' src/app/home/HomeUiStateManager.ts" in /Users/masterman/NLP/omniharness
 succeeded in 0ms:
"use client";

import { t, useI18nSnapshot } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type ConversationModeOption = "implementation" | "planning" | "direct";

const MODE_COPY_KEYS: Record<ConversationModeOption, { label: string; description: string }> = {
  planning: {
    label: "conversation.mode.planning.label",
    description: "conversation.mode.planning.description",
  },
  implementation: {
    label: "conversation.mode.implementation.label",
    description: "conversation.mode.implementation.description",
  },
  direct: {
    label: "conversation.mode.direct.label",
    description: "conversation.mode.direct.description",
  },
};

const MODE_ORDER: ConversationModeOption[] = ["direct", "planning", "implementation"];

export function getConversationModeCopy(mode: ConversationModeOption) {
  const copy = MODE_COPY_KEYS[mode];

  return {
    label: t(copy.label),
    description: t(copy.description),
  };
}

export function ConversationModePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: ConversationModeOption;
  onChange: (mode: ConversationModeOption) => void;
  disabled?: boolean;
}) {
  useI18nSnapshot();
  const activeCopy = getConversationModeCopy(value);

  return (
    <div className="mb-9 space-y-4">
      <div className="flex w-full justify-center">
        <div className="mx-auto flex w-fit max-w-full rounded-2xl border border-border/70 bg-muted/40 p-1.5 dark:border-white/[0.12] dark:bg-black/[0.12]">
          {MODE_ORDER.map((mode) => {
            const config = getConversationModeCopy(mode);

            return (
              <button
                key={mode}
                type="button"
                className={cn(
                  "min-w-0 shrink rounded-xl border px-3.5 py-2 text-center text-sm font-semibold leading-[1.15] break-words hyphens-auto transition-colors",
                  value === mode
                    ? "border-primary/[0.22] bg-primary/[0.055] text-primary"
                    : "border-transparent text-muted-foreground hover:bg-background/40 hover:text-foreground",
                  disabled && "cursor-not-allowed opacity-60 hover:bg-transparent hover:text-muted-foreground",
                )}
                aria-pressed={value === mode}
                disabled={disabled}
                onClick={() => {
                  if (disabled) {
                    return;
                  }

                  onChange(mode);
                }}
              >
                {config.label}
              </button>
            );
          })}
        </div>
      </div>
      <p className="mx-auto flex h-[10.5rem] max-w-[68ch] items-start justify-center text-[15px] leading-7 text-muted-foreground/90 sm:h-[5.25rem]">{activeCopy.description}</p>
    </div>
  );
}

 succeeded in 0ms:
import { chatAttachmentKindFromMimeType, type PendingChatAttachment } from "@/lib/chat-attachments";
import type { AppErrorDescriptor } from "@/lib/app-errors";
import { StateManager, type StateUpdate } from "@/lib/state-manager";
import { DEFAULT_CONVERSATION_SIDEBAR_WIDTH, DEFAULT_SERVER_SETTINGS, DEFAULT_WORKERS_SIDEBAR_WIDTH, PROJECT_SESSION_DISPLAY_BATCH_SIZE } from "./constants";
import type { ComposerWorkerOption, ConversationModeOption, ConversationSidebarTab, EventStreamState, LlmProfileTab, MessageRecord, SettingsTab } from "./types";
import type { CreatedConversationSnapshot } from "./utils";

export type ThemeMode = "day" | "night";
export type RenameSource = "sidebar" | "topbar";

export const INITIAL_EVENT_STREAM_STATE: EventStreamState = {
  messages: [],
  readMarkers: {},
  plans: [],
  runs: [],
  accounts: [],
  agents: [],
  workers: [],
  planItems: [],
  clarifications: [],
  executionEvents: [],
  supervisorInterventions: [],
  queuedMessages: [],
  recoveryIncidents: [],
  recoveryState: null,
  frontendErrors: [],
};

export type ComposerDraft = {
  command: string;
  commandCursor: number;
  mentionIndex: number;
  attachments: PendingChatAttachment[];
};

export const NEW_CONVERSATION_DRAFT_KEY = "__new__";

const EMPTY_COMPOSER_DRAFT: ComposerDraft = {
  command: "",
  commandCursor: 0,
  mentionIndex: 0,
  attachments: [],
};

export type HomeUiState = {
  command: string;
  themeMode: ThemeMode;
  showSettings: boolean;
  showOnboarding: boolean;
  showPairDeviceDialog: boolean;
  activeSettingsTab: SettingsTab;
  activeLlmProfileTab: LlmProfileTab;
  apiKeys: Record<string, string>;
  showFolderPicker: boolean;
  selectedRunId: string | null;
  leftSidebarOpen: boolean;
  leftSidebarWidth: number;
  rightSidebarOpen: boolean;
  rightSidebarWidth: number;
  isResizingLeftSidebar: boolean;
  isResizingRightSidebar: boolean;
  mobileNavOpen: boolean;
  mobileWorkersOpen: boolean;
  searchQuery: string;
  draftProjectPath: string | null;
  commandCursor: number;
  mentionIndex: number;
  readMarkers: Record<string, string>;
  collapsedProjectPaths: Set<string>;
  visibleProjectSessionCounts: Record<string, number>;
  renamingRunId: string | null;
  renameValue: string;
  renameSource: RenameSource | null;
  editingMessageId: string | null;
  editingMessageValue: string;
  expandedDirectMessageIds: Set<string>;
  routeReady: boolean;
  hasReceivedInitialEventStreamPayload: boolean;
  selectedConversationMode: ConversationModeOption;
  selectedCliAgent: ComposerWorkerOption;
  selectedModel: string;
  selectedEffort: string;
  hydratedRunSelectionId: string | null;
  attachments: PendingChatAttachment[];
  pairTokenFromUrl: string | null;
  authError: string | null;
  pairRedeemError: string | null;
  pairRedeemAttempted: boolean;
  runtimeErrors: AppErrorDescriptor[];
  settingsDiagnostics: AppErrorDescriptor[];
  composerDraftsByRun: Record<string, ComposerDraft>;
  conversationSidebarTab: ConversationSidebarTab;
};

const initialHomeUiState: HomeUiState = {
  command: "",
  themeMode: "day",
  showSettings: false,
  showOnboarding: false,
  showPairDeviceDialog: false,
  activeSettingsTab: "general",
  activeLlmProfileTab: "supervisor",
  apiKeys: { ...DEFAULT_SERVER_SETTINGS },
  showFolderPicker: false,
  selectedRunId: null,
  leftSidebarOpen: true,
  leftSidebarWidth: DEFAULT_CONVERSATION_SIDEBAR_WIDTH,
  rightSidebarOpen: false,
  rightSidebarWidth: DEFAULT_WORKERS_SIDEBAR_WIDTH,
  isResizingLeftSidebar: false,
  isResizingRightSidebar: false,
  mobileNavOpen: false,
  mobileWorkersOpen: false,
  searchQuery: "",
  draftProjectPath: null,
  commandCursor: 0,
  mentionIndex: 0,
  readMarkers: {},
  collapsedProjectPaths: new Set(),
  visibleProjectSessionCounts: {},
  renamingRunId: null,
  renameValue: "",
  renameSource: null,
  editingMessageId: null,
  editingMessageValue: "",
  expandedDirectMessageIds: new Set(),
  routeReady: false,
  hasReceivedInitialEventStreamPayload: false,
  selectedConversationMode: "direct",
  selectedCliAgent: "auto",
  selectedModel: "gpt-5.4",
  selectedEffort: "High",
  hydratedRunSelectionId: null,
  attachments: [],
  pairTokenFromUrl: null,
  authError: null,
  pairRedeemError: null,
  pairRedeemAttempted: false,
  runtimeErrors: [],
  settingsDiagnostics: [],
  composerDraftsByRun: {},
  conversationSidebarTab: "projects",
};

export class HomeUiStateManager extends StateManager<HomeUiState> {
  constructor() {
    super(initialHomeUiState);
  }

  private revokeAttachmentPreview(attachment: PendingChatAttachment) {
    if (attachment.previewUrl && typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(attachment.previewUrl);
    }
  }

  addAttachmentFiles(files: File[]) {
    if (files.length === 0) {
      return;
    }

    this.setKey("attachments", (current) => [
      ...current,
      ...files.map((file) => {
        const mimeType = file.type || "application/octet-stream";
        const kind = chatAttachmentKindFromMimeType(mimeType);
        const previewUrl = kind === "image" && typeof URL !== "undefined" && typeof URL.createObjectURL === "function"
          ? URL.createObjectURL(file)
          : undefined;

        const randomId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2);

        return {
          id: `${Date.now()}-${randomId}`,
          kind,
          name: file.name || "attachment",
          mimeType,
          size: file.size,
          file,
          ...(previewUrl ? { previewUrl } : {}),
        };
      }),
    ]);
  }

  addPastedImages(files: File[]) {
    this.addAttachmentFiles(files.map((file, index) => {
      if (file.name) {
        return file;
      }

      const extension = file.type.split("/")[1]?.split(";")[0] || "png";
      return new File([file], `pasted-image-${Date.now()}-${index}.${extension}`, {
        type: file.type || "image/png",
        lastModified: file.lastModified || Date.now(),
      });
    }));
  }

  removeAttachment(id: string) {
    this.setKey("attachments", (current) => {
      const removed = current.find((attachment) => attachment.id === id);
      if (removed) {
        this.revokeAttachmentPreview(removed);
      }
      return current.filter((attachment) => attachment.id !== id);
    });
  }

  clearAttachments() {
    const current = this.getSnapshot().attachments;
    current.forEach((attachment) => this.revokeAttachmentPreview(attachment));
    this.setKey("attachments", []);
  }

  selectRun(nextRunId: string | null) {
    this.update((current) => {
      if (current.selectedRunId === nextRunId) return current;
      const prevKey = current.selectedRunId ?? NEW_CONVERSATION_DRAFT_KEY;
      const nextKey = nextRunId ?? NEW_CONVERSATION_DRAFT_KEY;
      const nextDraft = current.composerDraftsByRun[nextKey] ?? EMPTY_COMPOSER_DRAFT;
      const drafts: Record<string, ComposerDraft> = { ...current.composerDraftsByRun };
      const hasContent = current.command.length > 0
        || current.commandCursor !== 0
        || current.mentionIndex !== 0
        || current.attachments.length > 0;
      if (hasContent) {
        drafts[prevKey] = {
          command: current.command,
          commandCursor: current.commandCursor,
          mentionIndex: current.mentionIndex,
          attachments: current.attachments,
        };
      } else {
        delete drafts[prevKey];
      }
      if (nextDraft === EMPTY_COMPOSER_DRAFT) {
        delete drafts[nextKey];
      }
      return {
        ...current,
        selectedRunId: nextRunId,
        composerDraftsByRun: drafts,
        command: nextDraft.command,
        commandCursor: nextDraft.commandCursor,
        mentionIndex: nextDraft.mentionIndex,
        attachments: nextDraft.attachments,
      };
    });
  }

  revealMoreProjectSessions(projectPath: string) {
    this.setKey("visibleProjectSessionCounts", (current) => ({
      ...current,
      [projectPath]: (current[projectPath] ?? PROJECT_SESSION_DISPLAY_BATCH_SIZE) + PROJECT_SESSION_DISPLAY_BATCH_SIZE,
    }));
  }

  resetProjectSessionDisplayLimit(projectPath: string) {

exec
/bin/zsh -lc 'rg -n "ConversationModeOption|selectedConversationMode|implementation|planning|direct|commit" src/app/home src/components src/lib tests/app tests/ui | head -n 220' in /Users/masterman/NLP/omniharness
 succeeded in 0ms:
src/app/home/useConversationExecutionStatus.ts:81:        (selectedRun.mode === "direct" || selectedRun.mode === "commit")
src/app/home/useConversationExecutionStatus.ts:82:        && latestExecutionEvent?.eventType === "direct_worker_awaiting_user"
tests/ui/conversation-actions.test.ts:18:  "src/lib/commit-workflow.ts",
tests/ui/conversation-actions.test.ts:52:test("conversation rows expose archive in the overflow menu and commit rows expose an inline archive icon", () => {
tests/ui/conversation-actions.test.ts:90:test("top bar exposes an auto commit action for the selected chat", () => {
tests/ui/conversation-actions.test.ts:93:  expect(pageSource).toContain('"Group the modified files from this conversation into logical git commits. Do not run tests. Do not modify files or do anything else. Only inspect the modified files as needed, create commits, and stop."');
tests/ui/conversation-actions.test.ts:94:  expect(pageSource).toContain('"Group the modified files from this conversation into logical git commits, then push the current branch. Do not run tests. Do not modify files or do anything else. Only inspect the modified files as needed, create commits, push, and stop."');
tests/ui/conversation-actions.test.ts:98:  expect(pageSource).toContain("commit.menu.label");
tests/ui/conversation-actions.test.ts:99:  expect(pageSource).toContain("commit.menu.commitAndPushNow");
tests/ui/conversation-actions.test.ts:136:test("project menus expose an auto commit action that starts a commit conversation", () => {
tests/ui/conversation-actions.test.ts:139:  expect(pageSource).toContain("mode: \"commit\"");
tests/ui/conversation-actions.test.ts:142:  expect(pageSource).toContain('autoCommitProject(group.path, "commit-push")');
tests/ui/conversation-actions.test.ts:143:  expect(pageSource).toContain("commit.menu.commitProjectNow");
tests/ui/conversation-actions.test.ts:144:  expect(pageSource).toContain("commit.menu.commitAndPushProject");
tests/ui/conversation-actions.test.ts:178:test("direct control user messages expose retry, edit, and fork recovery controls", () => {
tests/ui/conversation-actions.test.ts:188:test("implementation failures expose retry without direct-control edit and fork actions", () => {
tests/ui/conversation-actions.test.ts:200:test("user input messages share the direct-control bubble renderer", () => {
tests/ui/conversation-actions.test.ts:243:test("direct-control terminal user messages render attachment metadata", () => {
tests/ui/conversation-actions.test.ts:269:test("direct conversations keep the terminal mounted during worker stream refreshes", () => {
tests/ui/conversation-actions.test.ts:281:  expect(loadingGate).not.toContain("directWorkerStream.isLoaded");
tests/ui/conversation-actions.test.ts:283:  expect(conversationMainSource).toContain("shouldShowDirectConversationLoading(directConversationLoadState)");
tests/ui/conversation-actions.test.ts:316:test("direct-control terminal user messages can render the inline edit form", () => {
tests/ui/conversation-actions.test.ts:352:test("preflight implementation confirmations expose remembered quick actions", () => {
tests/ui/conversation-actions.test.ts:399:test("send queued now hides accepted direct messages from the queued drawer", () => {
tests/ui/conversation-actions.test.ts:422:test("direct control conversations show a tiny animated working indicator while stoppable", () => {
tests/ui/conversation-actions.test.ts:432:  expect(pageSource).toContain("directControlPendingAssistantStatus={directControlPendingAssistantStatus}");
tests/ui/conversation-actions.test.ts:434:  expect(pageSource).toContain("pendingAssistantStatus={directControlPendingAssistantStatus ?? undefined}");
tests/ui/conversation-actions.test.ts:436:  expect(pageSource).toContain("const directControlPendingAssistantStatus = resolveDirectControlPendingAssistantStatus({");
tests/ui/conversation-actions.test.ts:437:  expect(pageSource).toContain("const showDirectControlWorkingIndicator = directControlPendingAssistantStatus !== null;");
tests/ui/conversation-actions.test.ts:462:test("direct control pending state does not reserve blank scrollable transcript height", () => {
tests/ui/conversation-actions.test.ts:510:test("active direct conversations with no activity show a loading state", () => {
tests/ui/conversation-actions.test.ts:513:  expect(conversationMainSource).toContain("directConversationMessages.length === 0");
tests/ui/conversation-actions.test.ts:514:  expect(conversationMainSource).toContain("!directWorkerStream.entries || directWorkerStream.entries.length === 0");
src/components/FolderPickerDialog.tsx:34:        directories: Array<{ name: string; path: string }>;
src/components/FolderPickerDialog.tsx:37:        action: "Browse directories",
src/components/FolderPickerDialog.tsx:44:  const directories = useMemo(() => {
src/components/FolderPickerDialog.tsx:45:    const items = data?.directories ?? [];
src/components/FolderPickerDialog.tsx:49:  }, [data?.directories, search]);
src/components/FolderPickerDialog.tsx:73:              directories.length === 1 ? "folder.picker.count.one" : "folder.picker.count.other",
src/components/FolderPickerDialog.tsx:74:              { count: directories.length },
src/components/FolderPickerDialog.tsx:98:              {directories.map((dir: any) => (
src/lib/run-status.ts:17:  return Boolean(run && run.mode === "implementation" && !isTerminalRunStatus(run.status));
tests/app/event-stream-state-manager.test.ts:25:      mode: "direct",
tests/app/event-stream-state-manager.test.ts:48:    mode: "direct",
tests/app/event-stream-state-manager.test.ts:68:      mode: "implementation",
tests/app/event-stream-state-manager.test.ts:147:      content: "Before I start implementation, please confirm this is the intended job.",
tests/app/event-stream-state-manager.test.ts:149:      kind: "implementation_confirmation",
tests/app/event-stream-state-manager.test.ts:186:      content: "Before I start implementation, please confirm this is the intended job.",
tests/app/event-stream-state-manager.test.ts:188:      kind: "implementation_confirmation",
tests/ui/composer-shell.test.ts:93:test("direct mode requires an explicit cli agent and tightens dropdown alignment", () => {
tests/ui/composer-shell.test.ts:94:  expect(pageSource).toContain('const shouldOfferAutoWorkerOption = activeComposerMode !== "direct"');
tests/ui/composer-shell.test.ts:96:  expect(pageSource).toContain('if (activeComposerMode === "direct") {');
tests/ui/composer-shell.test.ts:164:  expect(pageSource).toContain("const isSupervisorRunning = Boolean(selectedRun && selectedRun.mode === \"implementation\" && selectedRun.status === \"running\")");
tests/ui/composer-shell.test.ts:170:  expect(pageSource).toContain("const directRunningConversationWorkerId = isDirectConversation");
tests/ui/composer-shell.test.ts:171:  expect(pageSource).toContain("const stoppableConversationWorkerId = busyConversationWorkerId ?? pendingConversationWorkerId ?? directRunningConversationWorkerId");
tests/ui/composer-shell.test.ts:178:  expect(pageSource).toContain('forceSteer: selectedConversationMode === "implementation"');
src/lib/worker-terminal-processes.ts:56:  const direct = asNonEmptyString(value);
src/lib/worker-terminal-processes.ts:57:  if (direct) {
src/lib/worker-terminal-processes.ts:58:    return direct;
tests/app/conversation-execution-status.test.ts:19:    mode: "implementation",
tests/app/conversation-execution-status.test.ts:62:  it("shows cancelled implementation runs as user-stopped instead of thinking", () => {
tests/app/conversation-execution-status.test.ts:224:  it("shows direct-control awaiting input without requiring a supervisor question", () => {
tests/app/conversation-execution-status.test.ts:226:      selectedRun: buildRun({ mode: "direct", status: "awaiting_user" }),
tests/app/conversation-execution-status.test.ts:228:        eventType: "direct_worker_awaiting_user",
src/app/home/direct-worker-stream-loading.ts:69:  directWorkerEntries: T[];
src/app/home/direct-worker-stream-loading.ts:72:    return args.directWorkerEntries;
src/app/home/direct-worker-stream-loading.ts:77:    ...args.directWorkerEntries,
tests/ui/planning-review-controls.test.ts:5:describe("planning review UI implementation", () =…17195 tokens truncated…_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:41.713767Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:41.713772Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:41.714103Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:41.714111Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:41.714427Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:41.714431Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:41.714761Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:41.714765Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:41.715456Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:41.715461Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:42.058401Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:42:42.065925Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:42:42.065953Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
codex
The existing follow-up path is fairly involved: normal sends, queued sends, interrupts, recovery replay, and direct status updates can all call `askAgent`. The plan needs to decide whether improve parsing is centralized in a shared post-turn helper or only supported for the dedicated refine endpoint.
exec
/bin/zsh -lc "sed -n '930,1060p' src/server/conversations/send-message.ts" in /Users/masterman/NLP/omniharness
exec
/bin/zsh -lc "sed -n '320,470p' src/server/conversations/send-message.ts" in /Users/masterman/NLP/omniharness
 succeeded in 0ms:
    return { ok: true, queuedMessage };
  }

  const userMessageCreatedAt = new Date();
  const userMessage = {
    id: randomUUID(),
    runId,
    role: "user",
    kind: "checkpoint",
    content: trimmedContent,
    attachmentsJson,
    createdAt: userMessageCreatedAt,
  };

  // Stream-first: append the user_input entry BEFORE the DB insert so that
  // a crash between the two writes leaves at most a harmless orphan stream
  // entry rather than a DB row the worker can never see. The stream entry
  // is keyed by message id so the write is idempotent — if a retry lands on
  // a row that already exists in the stream, appendUserInputOnDelivery
  // dedups instead of double-appending.
  if (isDirectRunMode(run.mode)) {
    await appendUserInputOnDelivery({
      id: userMessage.id,
      runId: run.id,
      workerId: worker.id,
      text: trimmedContent,
      deliveredAt: userMessageCreatedAt,
      attachments: normalizedAttachments.map((attachment) => ({
        id: attachment.id,
        filename: attachment.name,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.size,
      })),
    });
  }

  await db.insert(messages).values(userMessage);
  await db.update(runs).set({
    status: run.mode === "planning" ? "working" : "running",
    failedAt: null,
    lastError: null,
    updatedAt: userMessageCreatedAt,
  }).where(eq(runs.id, runId));
  notifyEventStreamSubscribers();

  if (isDirectRunMode(run.mode)) {
    notifyEventStreamSubscribers();

    if (busyAction === "steer") {
      try {
        await runWorkerTurn(worker.id, () => continueWorkerConversation({
          run,
          worker,
          content: workerContent,
          userInputText: trimmedContent,
          userInputId: userMessage.id,
          attachments: normalizedAttachments,
          // Already appended above.
          appendUserInputBeforeAsk: false,
        }));
      } catch (error) {
        if (isAgentBusyError(error)) {
          await db.delete(messages).where(eq(messages.id, userMessage.id));
          const queuedMessage = await createQueuedConversationMessage({
            runId,
            targetWorkerId: worker.id,
            action: "steer",
            content: trimmedContent,
            attachments: normalizedAttachments,
          });
          return {
            ok: true,
            message: serializeMessageRecord({ ...userMessage, attachmentsJson }),
            queuedMessage,
          };
        }

        throw error;
      }

      return {
        ok: true,
        message: serializeMessageRecord({ ...userMessage, attachmentsJson }),
      };
    }

    // Direct follow-up follows the same "append-immediately" path. The
    // turn runs in the background.
    const turn = trackConversationBackgroundTask(runWorkerTurn(worker.id, () => continueWorkerConversation({
      run,
      worker,
      content: workerContent,
      userInputText: trimmedContent,
      userInputId: userMessage.id,
      attachments: normalizedAttachments,
      // Already appended above.
      appendUserInputBeforeAsk: false,
    })));
    turn.catch((error) => {
      if (isAgentBusyError(error)) {
        return;
      }

      console.error("Direct conversation follow-up failed:", error);
    });

    return {
      ok: true,
      message: serializeMessageRecord({ ...userMessage, attachmentsJson }),
    };
  }

  try {
    await runWorkerTurn(worker.id, () => continueWorkerConversation({
      run,
      worker,
      content: workerContent,
      userInputText: trimmedContent,
      userInputId: userMessage.id,
      attachments: normalizedAttachments,
    }));
  } catch (error) {
    if (busyAction === "steer" && isAgentBusyError(error)) {
      await db.delete(messages).where(eq(messages.id, userMessage.id));
      const queuedMessage = await createQueuedConversationMessage({
        runId,
        targetWorkerId: worker.id,
        action: "steer",
        content: trimmedContent,
        attachments: normalizedAttachments,
      });

 succeeded in 0ms:
      sessionId: recreatedFromRejectedEmptySession || transcriptReplayRequired ? resumedWorker.sessionId ?? null : sessionId,
      transcriptReplay: transcriptReplayRequired,
    },
  });
  emitNamedEvent({
    kind: recreatedFromRejectedEmptySession || transcriptReplayRequired ? "worker.recreated" : "worker.reattached",
    runId: run.id,
    workerId: worker.id,
  });

  await db.update(workers).set({
    status: resumedWorker.state,
    bridgeSessionId: resumedWorker.sessionId ?? (recreatedFromRejectedEmptySession ? null : sessionId),
    bridgeSessionMode: resumedWorker.sessionMode ?? sessionMode ?? null,
    updatedAt: new Date(),
  }).where(eq(workers.id, worker.id));
  await appendWorkerSessionMetadata({
    runId: run.id,
    workerId: worker.id,
    sessionId: resumedWorker.sessionId ?? (recreatedFromRejectedEmptySession ? null : sessionId),
    sessionMode: resumedWorker.sessionMode ?? sessionMode ?? null,
    source: "direct-follow-up",
  });

  await persistWorkerSnapshot(worker.id, resumedWorker);
  notifyEventStreamSubscribers();
  return { ...resumedWorker, transcriptReplayRequired };
}

async function askDirectWorkerWithResume(run: RunRecord, worker: WorkerRecord, content: string) {
  try {
    return await askAgent(worker.id, content);
  } catch (error) {
    if (!isAgentNotFoundError(error)) {
      throw error;
    }

    const currentWorker = await db.select().from(workers).where(eq(workers.id, worker.id)).get();
    if (isWorkerCancelled(currentWorker)) {
      throw error;
    }

    const resumedWorker = await resumeMissingDirectWorker(run, currentWorker ?? worker);
    if (!resumedWorker) {
      throw error;
    }

    // resumeMissingDirectWorker just wrote the resumed runtime agent's
    // state ("idle" or "starting") into the DB. The askAgent call on the
    // next line drives the runtime to "working", but no other code path
    // touches the workers row until askAgent resolves — which for a long
    // Claude turn is many minutes. Without re-arming the DB row here the
    // frontend sees the worker as idle for the entire turn and never
    // shows the "Thinking…" indicator.
    await db.update(workers).set({
      status: "working",
      updatedAt: new Date(),
    }).where(eq(workers.id, worker.id));
    await db.update(runs).set({
      status: "running",
      failedAt: null,
      lastError: null,
      updatedAt: new Date(),
    }).where(eq(runs.id, run.id));
    notifyEventStreamSubscribers();

    const replayPrompt = resumedWorker.transcriptReplayRequired
      ? await buildTranscriptReplayPrompt({
        runId: run.id,
        workerId: worker.id,
        nextUserPrompt: content,
      })
      : null;
    return askAgent(worker.id, replayPrompt ?? content);
  }
}

async function continueWorkerConversation({
  run,
  worker,
  content,
  userInputText,
  userInputId,
  attachments,
  appendUserInputBeforeAsk = false,
  onUserInputAppended,
}: {
  run: RunRecord;
  worker: WorkerRecord;
  content: string;
  userInputText: string;
  userInputId?: string;
  attachments: ChatAttachment[];
  appendUserInputBeforeAsk?: boolean;
  onUserInputAppended?: () => void;
}) {
  try {
    const currentWorker = await db.select().from(workers).where(eq(workers.id, worker.id)).get();
    if (isWorkerCancelled(currentWorker)) {
      onUserInputAppended?.();
      return;
    }

    await db.update(workers).set({
      status: "working",
      updatedAt: new Date(),
    }).where(eq(workers.id, worker.id));
    notifyEventStreamSubscribers();

    let userInputAppended = false;
    const appendDeliveredUserInput = async (deliveredAt: Date) => {
      await appendUserInputOnDelivery({
        id: userInputId,
        runId: run.id,
        workerId: worker.id,
        text: userInputText,
        deliveredAt,
        attachments: attachments.map((attachment) => ({
          id: attachment.id,
          filename: attachment.name,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.size,
        })),
      });
      userInputAppended = true;
      onUserInputAppended?.();
    };

    if (appendUserInputBeforeAsk) {
      await appendDeliveredUserInput(new Date());
      notifyEventStreamSubscribers();
    }

    const response = await askDirectWorkerWithResume(run, worker, content);
    if (!userInputAppended) {
      // Append user_input on delivery — `askDirectWorkerWithResume` has
      // resolved successfully, so the prompt definitely reached the
      // worker. Direct fire-and-forget follow-ups opt into pre-ask
      // appending above because the HTTP response returns immediately
      // while the bridge turn is still in flight.
      await appendDeliveredUserInput(new Date());
    }
    const workerAfterResponse = await db.select().from(workers).where(eq(workers.id, worker.id)).get();
    if (isWorkerCancelled(workerAfterResponse)) {
      notifyEventStreamSubscribers();
      return;
    }

    const snapshot = await Promise.resolve(getAgent(worker.id)).catch(() => null);
    if (snapshot) {
      await persistWorkerSnapshot(worker.id, snapshot);

exec
/bin/zsh -lc "sed -n '340,430p' src/server/conversations/queued-messages.ts" in /Users/masterman/NLP/omniharness
 succeeded in 0ms:
    status: "cancelled",
    updatedAt: now,
  }).where(eq(queuedConversationMessages.id, messageId));
  await insertQueueExecutionEvent(runId, "queued_message_cancelled", {
    summary: "Cancelled queued message.",
    queuedMessageId: messageId,
  }, record.targetWorkerId);
  notifyEventStreamSubscribers();

  return serializeQueuedConversationMessage({
    ...record,
    status: "cancelled",
    updatedAt: now,
  });
}

async function deliverQueuedWorkerSteering(args: {
  run: typeof runs.$inferSelect;
  worker: typeof workers.$inferSelect;
  messageId: string;
  userMessageId?: string | null;
  content: string;
  userText: string;
  attachments: ChatAttachment[];
}) {
  await runWorkerTurn(args.worker.id, async () => {
    let userInputAppended = false;
    const appendQueuedUserInput = async (deliveredAt: Date) => {
      await appendUserInputOnDelivery({
        id: args.userMessageId ?? args.messageId,
        runId: args.run.id,
        workerId: args.worker.id,
        text: args.userText,
        deliveredAt,
        attachments: args.attachments.map((attachment) => ({
          id: attachment.id,
          filename: attachment.name,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.size,
        })),
      });
      userInputAppended = true;
    };

    if (await queuedMessageStatus(args.messageId) !== "delivering") {
      notifyEventStreamSubscribers();
      return;
    }

    await appendQueuedUserInput(new Date());
    notifyEventStreamSubscribers();

    if (await queuedMessageStatus(args.messageId) !== "delivering") {
      notifyEventStreamSubscribers();
      return;
    }

    const response = await askAgent(args.worker.id, args.content);
    const deliveredAt = new Date();
    if (await queuedMessageStatus(args.messageId) !== "delivering") {
      notifyEventStreamSubscribers();
      return;
    }
    if (!userInputAppended) {
      // Kept as a defensive fallback for future call paths that might
      // choose not to pre-anchor the prompt before bridge output streams.
      await appendQueuedUserInput(deliveredAt);
    }
    await persistDeliveredWorkerResponse({
      run: args.run,
      workerId: args.worker.id,
      response,
      deliveredAt,
      userInputEntryId: args.userMessageId ?? args.messageId,
    });
    // Worker response now lives in the unified worker stream; the
    // legacy role:"worker" messages row is no longer written.
    await db.update(queuedConversationMessages).set({
      status: "delivered",
      lastError: null,
      updatedAt: deliveredAt,
      deliveredAt,
    }).where(eq(queuedConversationMessages.id, args.messageId));
    await insertQueueExecutionEvent(args.run.id, "queued_message_delivered", {
      summary: `Delivered immediate queued steering to ${args.worker.id}.`,
      queuedMessageId: args.messageId,
      action: "steer",
    }, args.worker.id);
    notifyEventStreamSubscribers();
  });
}

exec
/bin/zsh -lc "sed -n '740,790p' src/server/conversations/queued-messages.ts" in /Users/masterman/NLP/omniharness
 succeeded in 0ms:
      const workerContent = appendAttachmentContext(record.content, normalizedAttachments, {
        resolvePath: (storagePath) => getAppDataPath(storagePath),
      });
      let interventionId: string | null = null;

      try {
        await runWorkerTurn(worker.id, async () => {
          await db.update(workers).set({
            status: "working",
            updatedAt: now,
          }).where(eq(workers.id, worker.id));
          const intervention = await recordSupervisorIntervention({
            runId,
            workerId: worker.id,
            prompt: workerContent,
            summary: `Sent user steering to ${worker.id}`,
            interventionType: "continue",
          });
          interventionId = intervention.id;
          const response = await askAgent(worker.id, workerContent);
          const deliveredAt = new Date();
          const userMessage = {
            id: randomUUID(),
            runId,
            role: "user" as const,
            kind: "checkpoint" as const,
            content: record.content,
            attachmentsJson: record.attachmentsJson,
            createdAt: record.createdAt,
          };
          await appendUserInputOnDelivery({
            id: userMessage.id,
            runId,
            workerId: worker.id,
            text: record.content,
            deliveredAt,
            attachments: normalizedAttachments.map((attachment) => ({
              id: attachment.id,
              filename: attachment.name,
              mimeType: attachment.mimeType,
              sizeBytes: attachment.size,
            })),
          });
          await db.insert(messages).values(userMessage);
          await db.insert(messages).values({
            id: randomUUID(),
            runId,
            role: "supervisor",
            kind: "update",
            content: `Got it. I sent that to ${formatWorkerLabel(worker)} and will keep watching the run.`,
            attachmentsJson: null,

2026-06-14T16:42:50.275312Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:42:50.289375Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:50.289380Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:50.289679Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:50.289684Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:50.289977Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:50.289982Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:50.290271Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:50.290275Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:50.290577Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:50.290581Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:50.291233Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:50.291239Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:42:50.722576Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:42:50.730130Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:42:50.730153Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
codex
I have enough context now. I’m going to return a hardening review rather than more code archaeology; the plan is directionally strong but has execution-risk gaps around promotion, parsing call sites, artifact stream plumbing, and refine state.

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:43:04.016Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:43:04.016Z

The fallback reviewer is done with investigation and is now composing the verdict. The likely changes are concrete: make promotion a first-class plan step, centralize post-turn parsing, specify artifact stream integration, and tighten refine state handling.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:43:04.840Z","phase":null} -->
## Tool call: write_stdin · 2026-06-14T16:43:04.840Z

```json
{
  "session_id": 45127,
  "chars": "",
  "yield_time_ms": 30000,
  "max_output_tokens": 24000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:43:33.924Z","phase":null} -->
## Tool result: call_LlnuolCMAZrJy8lXjMbmYf6G · 2026-06-14T16:43:33.924Z

````text
Chunk ID: 3e7ec2
Wall time: 29.0821 seconds
Process exited with code 0
Original token count: 11516
Output:
Total output lines: 775

exec
/bin/zsh -lc "nl -ba src/server/conversations/send-message.ts | sed -n '340,420p;970,1035p'" in /Users/masterman/NLP/omniharness
exec
/bin/zsh -lc "nl -ba docs/superpowers/plans/2026-06-14-visual-improve-mode.md | sed -n '84,180p'" in /Users/masterman/NLP/omniharness
 succeeded in 0ms:
    84	- `src/server/prompts/improve.md` — new advisor prompt based on upstream improve semantics plus OmniHarness structured-output contract.
    85	- `src/server/db/schema.ts` and `src/server/db/index.ts` — add improve result tables and migrations.
    86	- `src/server/events/named-events.ts` — add improve event kinds and surfaced error codes.
    87	- `src/server/events/persisted-snapshot.ts` — include improve rows in selected-run snapshots with scoped completeness metadata.
    88	- `src/server/workers/entries-types.ts` and `src/server/workers/output-store.ts` only if a new worker entry type is truly required. Prefer not to add one; transcript content should remain ordinary worker output and structured rows should be separate artifacts.
    89	- `src/server/improve/*` — create focused server modules for prompt building, structured parsing, row persistence, card state mutations, and promotion.
    90	- `src/app/api/improve/[id]/results/route.ts` or `src/runtime/http/routes/improve.ts` — card mutation/promote/refine endpoints, following existing runtime route patterns.
    91	- `src/components/ImproveResultsPanel.tsx` and `src/components/ImproveResultCard.tsx` — new UI surface for cards and actions.
    92	- `shared/locales/*.json` — all user-facing labels, statuses, actions, aria labels, placeholders, errors, and empty states.
    93	
    94	### Tests To Add Or Update
    95	
    96	- `tests/db/schema.test.ts` — assert new improve tables export correctly.
    97	- `tests/api/events-route.test.ts` — snapshot includes improve results and scoped completeness for selected improve run.
    98	- `tests/lifecycle/scenarios/session-types.test.ts` — add `improve` mode creation, run row, worker row, and `worker.spawned`.
    99	- `tests/lifecycle/scenarios/improve-mode-flow.test.ts` — start improve, receive structured result events, reconnect/resync, mutate card state.
   100	- `tests/server/improve/parser.test.ts` — structured extraction accepts valid output, rejects malformed output, preserves evidence, and redacts/omits secret-like values.
   101	- `tests/server/improve/promote.test.ts` — approved result promotion creates/reuses planning artifacts without creating branches/worktrees.
   102	- `tests/ui/improve-results-panel.test.tsx` — cards render metadata/actions from manager state and all visible copy comes through i18n.
   103	
   104	### Candidate Agentic Journey Test
   105	
   106	Requires explicit user approval before running in a browser:
   107	
   108	- Mission: Start an `Improve` run, wait for a mocked structured finding, approve it, refine another card, and promote the approved one.
   109	- Entry point: `http://localhost:3035`.
   110	- Expected visible proof: mode picker shows `Improve`; result cards appear below the transcript; approved/rejected/refining statuses persist across reload; promoted card opens or creates the planning/implementation handoff.
   111	
   112	## Data Model
   113	
   114	Add tables rather than overloading `planningReview*`:
   115	
   116	- `improve_runs`
   117	  - `id`, `runId`, `status`, `focus`, `skillRootsJson`, `startedAt`, `completedAt`, `lastError`, timestamps.
   118	- `improve_results`
   119	  - `id`, `improveRunId`, `runId`, `kind`, `category`, `title`, `status`, `impact`, `effort`, `risk`, `confidence`, `priority`, `sourcePath`, `artifactSeq`, `detailsHash`, `detailsPreview`, `recommendationPreview`, timestamps.
   120	- `improve_result_artifacts`
   121	  - Prefer the existing `artifactStreams` engine for long `details`, `evidence`, `fixSketch`, `planMarkdown`, `rejectionReason`, and `refinementPrompt` bodies rather than storing large text directly in snapshot rows.
   122	
   123	Statuses:
   124	
   125	- Improve run: `starting`, `running`, `completed`, `failed`.
   126	- Improve result: `proposed`, `approved`, `rejected`, `refining`, `superseded`, `promoted`.
   127	
   128	Do not persist translated labels. Persist only stable ids/statuses and translate in React.
   129	
   130	## Structured Output Contract
   131	
   132	The advisor prompt must require fenced JSON blocks for machine-readable checkpoints:
   133	
   134	```json
   135	{
   136	  "schema": "omniharness.improve.results.v1",
   137	  "status": "partial|final",
   138	  "phase": "recon|audit|vet|prioritize|plan",
   139	  "results": [
   140	    {
   141	      "clientId": "CORRECTNESS-01",
   142	      "kind": "finding|direction|plan_candidate|rejected",
   143	      "category": "correctness|security|performance|tests|tech_debt|dependencies|dx|docs|direction",
   144	      "title": "Short human label",
   145	      "impact": "Concrete cost or user value",
   146	      "effort": "S|M|L",
   147	      "risk": "LOW|MED|HIGH",
   148	      "confidence": "LOW|MED|HIGH",
   149	      "priority": 1,
   150	      "evidence": [{ "path": "src/example.ts", "line": 42, "summary": "What exists there" }],
   151	      "details": "Short explanation",
   152	      "recommendation": "What to do next",
   153	      "planMarkdown": null
   154	    }
   155	  ]
   156	}
   157	```
   158	
   159	Parser rules:
   160	
   161	- Accept the latest valid `omniharness.improve.results.v1` block.
   162	- Validate with `zod`.
   163	- Never require the UI to parse freeform markdown.
   164	- Treat malformed JSON as `improve.parse_failed` plus `error.surfaced`, but keep the transcript visible.
   165	- Store secret-like evidence as location/type only. Do not store secret values if they appear in advisor output.
   166	- Deduplicate by `(runId, clientId)` and preserve existing user decisions when a later partial update refines the same result.
   167	
   168	## Client/Server State Invariants
   169	
   170	- **Owner:** Server owns improve run/result rows. `ImproveResultsManager` owns the client snapshot projection and local UI expansion state only.
   171	- **Token:** Every result mutation carries `runId`, `improveRunId`, and `resultId`; stale mutation responses must confirm the selected run still matches before changing visible selection.
   172	- **Provenance:** Transcript is worker-produced evidence; structured result rows are server-validated projection; user decisions are server-authoritative after mutation success.
   173	- **Completeness:** Snapshot payload must declare `improveResults.complete` for the selected run. Partial SSE events may add/update rows but cannot erase existing cards unless scoped complete.
   174	- **Ordering:** Sort by `priority`, then `createdAt`, then `id`. Do not rely on timestamp-only ordering.
   175	- **State Machine:** Result transitions are constrained: `proposed -> approved|rejected|refining`; `refining -> proposed|superseded|failed`; `approved -> promoted`; no mutation from `promoted` back to proposed without a new result row.
   176	- **Events:** Server decisions emit named events. The UI must not infer decisions by diffing snapshots.
   177	- **Reconnect:** Use existing SSE `id:`/`Last-Event-ID`; if `stream.resync_required` fires, snapshot reload must restore improve rows.
   178	- **Hot Path:** Snapshot rows carry previews and artifact cursors, not large plan/details bodies.
   179	
   180	## Named Events

 succeeded in 0ms:
   340	    sessionMode: resumedWorker.sessionMode ?? sessionMode ?? null,
   341	    source: "direct-follow-up",
   342	  });
   343	
   344	  await persistWorkerSnapshot(worker.id, resumedWorker);
   345	  notifyEventStreamSubscribers();
   346	  return { ...resumedWorker, transcriptReplayRequired };
   347	}
   348	
   349	async function askDirectWorkerWithResume(run: RunRecord, worker: WorkerRecord, content: string) {
   350	  try {
   351	    return await askAgent(worker.id, content);
   352	  } catch (error) {
   353	    if (!isAgentNotFoundError(error)) {
   354	      throw error;
   355	    }
   356	
   357	    const currentWorker = await db.select().from(workers).where(eq(workers.id, worker.id)).get();
   358	    if (isWorkerCancelled(currentWorker)) {
   359	      throw error;
   360	    }
   361	
   362	    const resumedWorker = await resumeMissingDirectWorker(run, currentWorker ?? worker);
   363	    if (!resumedWorker) {
   364	      throw error;
   365	    }
   366	
   367	    // resumeMissingDirectWorker just wrote the resumed runtime agent's
   368	    // state ("idle" or "starting") into the DB. The askAgent call on the
   369	    // next line drives the runtime to "working", but no other code path
   370	    // touches the workers row until askAgent resolves — which for a long
   371	    // Claude turn is many minutes. Without re-arming the DB row here the
   372	    // frontend sees the worker as idle for the entire turn and never
   373	    // shows the "Thinking…" indicator.
   374	    await db.update(workers).set({
   375	      status: "working",
   376	      updatedAt: new Date(),
   377	    }).where(eq(workers.id, worker.id));
   378	    await db.update(runs).set({
   379	      status: "running",
   380	      failedAt: null,
   381	      lastError: null,
   382	      updatedAt: new Date(),
   383	    }).where(eq(runs.id, run.id));
   384	    notifyEventStreamSubscribers();
   385	
   386	    const replayPrompt = resumedWorker.transcriptReplayRequired
   387	      ? await buildTranscriptReplayPrompt({
   388	        runId: run.id,
   389	        workerId: worker.id,
   390	        nextUserPrompt: content,
   391	      })
   392	      : null;
   393	    return askAgent(worker.id, replayPrompt ?? content);
   394	  }
   395	}
   396	
   397	async function continueWorkerConversation({
   398	  run,
   399	  worker,
   400	  content,
   401	  userInputText,
   402	  userInputId,
   403	  attachments,
   404	  appendUserInputBeforeAsk = false,
   405	  onUserInputAppended,
   406	}: {
   407	  run: RunRecord;
   408	  worker: WorkerRecord;
   409	  content: string;
   410	  userInputText: string;
   411	  userInputId?: string;
   412	  attachments: ChatAttachment[];
   413	  appendUserInputBeforeAsk?: boolean;
   414	  onUserInputAppended?: () => void;
   415	}) {
   416	  try {
   417	    const currentWorker = await db.select().from(workers).where(eq(workers.id, worker.id)).get();
   418	    if (isWorkerCancelled(currentWorker)) {
   419	      onUserInputAppended?.();
   420	      return;
   970	    lastError: null,
   971	    updatedAt: userMessageCreatedAt,
   972	  }).where(eq(runs.id, runId));
   973	  notifyEventStreamSubscribers();
   974	
   975	  if (isDirectRunMode(run.mode)) {
   976	    notifyEventStreamSubscribers();
   977	
   978	    if (busyAction === "steer") {
   979	      try {
   980	        await runWorkerTurn(worker.id, () => continueWorkerConversation({
   981	          run,
   982	          worker,
   983	          content: workerContent,
   984	          userInputText: trimmedContent,
   985	          userInputId: userMessage.id,
   986	          attachments: normalizedAttachments,
   987	          // Already appended above.
   988	          appendUserInputBeforeAsk: false,
   989	        }));
   990	      } catch (error) {
   991	        if (isAgentBusyError(error)) {
   992	          await db.delete(messages).where(eq(messages.id, userMessage.id));
   993	          const queuedMessage = await createQueuedConversationMessage({
   994	            runId,
   995	            targetWorkerId: worker.id,
   996	            action: "steer",
   997	            content: trimmedContent,
   998	            attachments: normalizedAttachments,
   999	          });
  1000	          return {
  1001	            ok: true,
  1002	            message: serializeMessageRecord({ ...userMessage, attachmentsJson }),
  1003	            queuedMessage,
  1004	          };
  1005	        }
  1006	
  1007	        throw error;
  1008	      }
  1009	
  1010	      return {
  1011	        ok: true,
  1012	        message: serializeMessageRecord({ ...userMessage, attachmentsJson }),
  1013	      };
  1014	    }
  1015	
  1016	    // Direct follow-up follows the same "append-immediately" path. The
  1017	    // turn runs in the background.
  1018	    const turn = trackConversationBackgroundTask(runWorkerTurn(worker.id, () => continueWorkerConversation({
  1019	      run,
  1020	      worker,
  1021	      content: workerContent,
  1022	      userInputText: trimmedContent,
  1023	      userInputId: userMessage.id,
  1024	      attachments: normalizedAttachments,
  1025	      // Already appended above.
  1026	      appendUserInputBeforeAsk: false,
  1027	    })));
  1028	    turn.catch((error) => {
  1029	      if (isAgentBusyError(error)) {
  1030	        return;
  1031	      }
  1032	
  1033	      console.error("Direct conversation follow-up failed:", error);
  1034	    });
  1035	

exec
/bin/zsh -lc "nl -ba docs/superpowers/plans/2026-06-14-visual-improve-mode.md | sed -n '181,300p'" in /Users/masterman/NLP/omniharness
 succeeded in 0ms:
   181	
   182	Add these to `src/server/events/named-events.ts`:
   183	
   184	- `improve.started` `{ runId, improveRunId }`
   185	- `improve.phase` `{ runId, improveRunId, phase }`
   186	- `improve.result_upserted` `{ runId, improveRunId, resultId, status }`
   187	- `improve.result_status_changed` `{ runId, improveRunId, resultId, prev, next }`
   188	- `improve.refine_requested` `{ runId, improveRunId, resultId }`
   189	- `improve.refine_finished` `{ runId, improveRunId, resultId, status }`
   190	- `improve.promote_requested` `{ runId, improveRunId, resultId }`
   191	- `improve.promote_finished` `{ runId, improveRunId, resultId, targetRunId, status }`
   192	- `improve.parse_failed` `{ runId, improveRunId, reason }`
   193	- `improve.finished` `{ runId, improveRunId, status }`
   194	
   195	Add surfaced error codes:
   196	
   197	- `improve.start_failed`
   198	- `improve.parse_failed`
   199	- `improve.refine_failed`
   200	- `improve.promote_failed`
   201	- `improve.mutation_stale`
   202	
   203	## Implementation Tasks
   204	
   205	- [ ] Add failing schema and parser tests.
   206	  - Files: `tests/db/schema.test.ts`, `tests/server/improve/parser.test.ts`.
   207	  - Verify: `pnpm test tests/db/schema.test.ts tests/server/improve/parser.test.ts` fails for missing improve schema/parser.
   208	
   209	- [ ] Add improve DB tables and migration.
   210	  - Files: `src/server/db/schema.ts`, `src/server/db/index.ts`.
   211	  - Include cleanup behavior in existing delete-conversation paths if foreign-key cleanup is manual there.
   212	  - Verify: `pnpm test tests/db/schema.test.ts`.
   213	
   214	- [ ] Implement structured parser and artifact-backed persistence.
   215	  - Files: `src/server/improve/parser.ts`, `src/server/improve/store.ts`, `src/server/improve/types.ts`.
   216	  - Use `zod`; keep large bodies in artifact streams or bounded previews.
   217	  - Verify: `pnpm test tests/server/improve/parser.test.ts`.
   218	
   219	- [ ] Add improve prompt and launch wiring.
   220	  - Files: `src/server/prompts/improve.md`, `src/server/conversations/modes.ts`, `src/server/conversations/create.ts`, `src/server/bridge-client/index.ts` only if current `spawnAgent` request typing does not expose `skillRoots`.
   221	  - Use existing `skillRoots` support to expose the configured improve skill bundle to the one advisor worker.
   222	  - Do not create a branch or worktree.
   223	  - Verify: `pnpm test tests/lifecycle/scenarios/session-types.test.ts`.
   224	
   225	- [ ] Add improve lifecycle events and surfaced errors.
   226	  - Files: `src/server/events/named-events.ts`, improve server modules, tests.
   227	  - Verify event transcript for start, result upsert, parse failure, finish, and surfaced errors.
   228	  - Verify: `pnpm test tests/lifecycle/scenarios/improve-mode-flow.test.ts tests/server/events/*.test.ts`.
   229	
   230	- [ ] Include improve records in snapshots.
   231	  - Files: `src/server/events/persisted-snapshot.ts`, `src/app/home/types.ts`, `src/app/home/EventStreamSnapshotCacheManager.ts`.
   232	  - Add scoped completeness metadata and deterministic merge behavior.
   233	  - Verify: `pnpm test tests/api/events-route.test.ts`.
   234	
   235	- [ ] Add card mutation and promotion routes.
   236	  - Files: `src/runtime/http/routes/improve.ts`, `src/app/api/improve/[id]/results/route.ts` or equivalent Next route wrappers.
   237	  - Actions: approve, reject, refine, promote.
   238	  - Refine sends a targeted prompt to the same advisor worker when available, otherwise fails visibly with a recovery message.
   239	  - Promote creates or updates a planning artifact/run using existing planning/promotion helpers; it must not implement directly.
   240	  - Verify: `pnpm test tests/server/improve/promote.test.ts tests/api/events-route.test.ts`.
   241	
   242	- [ ] Add `ImproveResultsManager`.
   243	  - Files: `src/app/home/ImproveResultsManager.ts`, `src/app/home/types.ts`, `src/app/home/HomeUiStateManager.ts`.
   244	  - Keep server rows authoritative; local manager tracks expansion, selection, and pending mutation ids.
   245	  - Verify stale mutation responses cannot update the wrong selected run.
   246	  - Verify: add focused manager tests or include in UI tests.
   247	
   248	- [ ] Add `Improve` to the composer and mode state.
   249	  - Files: `src/components/ConversationModePicker.tsx`, `src/components/home/ConversationComposer.tsx`, `src/app/home/ComposerContainer.tsx`, `src/app/home/useHomeLifecycle.ts`, `shared/locales/*.json`.
   250	  - All visible strings must use `t()` and exist in every locale file.
   251	  - Verify: `pnpm test tests/ui/composer-shell.test.ts`.
   252	
   253	- [ ] Build the improve results UI.
   254	  - Files: `src/components/ImproveResultsPanel.tsx`, `src/components/ImproveResultCard.tsx`, `src/components/home/ConversationMain.tsx`, `shared/locales/*.json`.
   255	  - Cards show title, category, impact, effort, risk, confidence, evidence count, status, and actions.
   256	  - Expanded card shows evidence, details, recommendation, generated plan preview/link if present, and parse/failure context.
   257	  - Avoid nested cards. Keep card radius at or below the project default. Use lucide icons for actions.
   258	  - Verify: `pnpm test tests/ui/improve-results-panel.test.tsx`.
   259	
   260	- [ ] Add lifecycle flow coverage.
   261	  - Files: `tests/lifecycle/scenarios/improve-mode-flow.test.ts`.
   262	  - Test: start improve, emit `improve.started`, parse one result, receive `improve.result_upserted`, drop SSE, resync, approve/reject/refine card, assert persisted row state.
   263	  - Verify: `pnpm test:lifecycle -- tests/lifecycle/scenarios/improve-mode-flow.test.ts` if supported by the runner, otherwise `pnpm test tests/lifecycle/scenarios/improve-mode-flow.test.ts`.
   264	
   265	- [ ] Run full targeted verification.
   266	  - Commands:
   267	    - `pnpm test tests/server/improve/parser.test.ts tests/server/improve/promote.test.ts`
   268	    - `pnpm test tests/api/events-route.test.ts tests/ui/improve-results-panel.test.tsx tests/ui/composer-shell.test.ts`
   269	    - `pnpm test:lifecycle`
   270	    - `pnpm lint`
   271	  - Expected: all commands exit 0. If lifecycle creates conversations/sessions, clean them up before finishing.
   272	
   273	## STOP Conditions
   274	
   275	Stop and report instead of improvising if:
   276	
   277	- The improve skill bundle cannot be exposed through existing `skillRoots` support without changing CLI storage or installing dependencies.
   278	- Implementing promotion requires branch or worktree creation. Branches are forbidden; worktrees require explicit user approval and are out of scope for this milestone.
   279	- The advisor output can only be captured by brittle terminal scraping with no st…1516 tokens truncated…rkerId,
   494	      workerType: args.workerType,
   495	      cwd: args.cwd,
   496	      agent,
   497	      mode: "direct",
   498	      command: args.command,
   499	    }));
   500	  } catch (error) {
   501	    if (isAgentBusyError(error)) {
   502	      return;
   503	    }
   504	
   505	    const failureMessage = formatErrorMessage(error);
   705	        });
   706	        trackConversationBackgroundTask(initialDirectTurn).catch((error) => {
   707	          console.error("Initial direct conversation worker failed:", error);
   708	        });
   709	      } else {
   710	        // Planning mode: spawn the agent off the critical path so the
   711	        // response returns instantly, mirroring direct mode. Spawn
   712	        // failures surface via `error.surfaced` instead of the HTTP
   713	        // response — the worker row already exists in `starting` and
   714	        // `worker.spawned` has already fired, so observers can render.
   715	        const initialPlanningTurn = (async () => {
   716	          let agent;
   717	          try {
   718	            const { env: envParams } = await readRuntimeEnvFromSettings();
   719	            agent = await spawnAgent({
   720	              type: workerType,
   721	              cwd,
   722	              name: workerId,
   723	              ...(workerMode ? { mode: workerMode } : {}),
   724	              env: envParams,
   725	              model: args.preferredWorkerModel?.trim() || undefined,
   726	              effort: args.preferredWorkerEffort?.trim().toLowerCase() || undefined,
   727	            });
   728	          } catch (error) {
   729	            await persistInitialWorkerSpawnFailure({
   730	              runId,
   731	              workerId,
   732	              mode,
   733	              error,
   734	            });
   735	            console.error(`Spawn for ${mode} conversation failed:`, error);
   736	            return;
   737	          }
   738	
   739	          try {
   740	            await runWorkerTurn(workerId, () => runInitialWorkerTurn({
   741	              runId,
   742	              workerId,
   743	              workerType,
   744	              cwd,
   745	              agent,
   746	              mode,
   747	              command: workerPrompt,
   748	            }));
   749	          } catch (error) {
   750	            if (isAgentBusyError(error)) {

exec
/bin/zsh -lc "nl -ba src/server/artifacts/stream-types.ts | sed -n '1,60p'; nl -ba src/server/artifacts/append-only-store.ts | sed -n '90,125p'; nl -ba src/server/planning/promote.ts | sed -n '45,115p'" in /Users/masterman/NLP/omniharness
 succeeded in 0ms:
     1	/**
     2	 * Shared types for the append-only artifact storage layer.
     3	 *
     4	 * The artifact store is byte-level: it knows about JSONL lines and
     5	 * gzipped JSONL, file locks, and append cursors. Domain semantics
     6	 * (entry dedup, history truncation, legacy DB fallback, etc.) live in
     7	 * per-domain adapters.
     8	 */
     9	
    10	export type ArtifactStreamKind =
    11	  | "worker_entries"
    12	  | "execution_events"
    13	  | "supervisor_interventions"
    14	  | "planning_review_findings";
    15	
    16	/**
    17	 * The envelope every non-worker artifact record uses on disk. The
    18	 * worker stream pre-dates this contract and uses its own shape — the
    19	 * worker adapter maps between them.
    20	 */
    21	export interface ArtifactRecordEnvelope<TPayload = unknown> {
    22	  /** Stable domain id (e.g. an execution_events.id). */
    23	  id: string;
    24	  /** Monotonically-increasing append cursor. */
    25	  seq: number;
    26	  /** Run that owns the stream. */
    27	  runId: string;
    28	  kind: ArtifactStreamKind;
    29	  /** ISO timestamp the record was created. */
    30	  createdAt: string;
    31	  /** Domain payload (full body, large details, etc.). */
    32	  payload: TPayload;
    33	}
    34	
    35	/**
    36	 * Stream identity. `ownerId` is `null` for run-level streams (one stream
    37	 * per run) and the worker id for per-worker streams.
    38	 */
    39	export interface ArtifactStreamId {
    40	  runId: string;
    41	  kind: ArtifactStreamKind;
    42	  ownerId: string | null;
    43	}
    44	
    45	/**
    46	 * Normalized SQLite-safe owner key. SQLite UNIQUE treats NULLs as
    47	 * distinct, so the schema uses this sentinel to make
    48	 * `(run_id, kind, normalized_owner_id)` enforce one row per stream.
    49	 */
    50	export const ARTIFACT_STREAM_OWNER_NONE = "__none__";
    51	
    52	export function normalizeArtifactOwnerId(ownerId: string | null): string {
    53	  return ownerId?.trim() ? ownerId.trim() : ARTIFACT_STREAM_OWNER_NONE;
    54	}
    90	// --- Path / identity helpers ----------------------------------------
    91	
    92	export function streamRelativePath(id: ArtifactStreamId): string {
    93	  switch (id.kind) {
    94	    case "worker_entries": {
    95	      const ownerId = id.ownerId?.trim();
    96	      if (!ownerId) {
    97	        throw new Error(`Worker artifact stream requires an ownerId (workerId).`);
    98	      }
    99	      return `workers/${ownerId}.jsonl`;
   100	    }
   101	    case "execution_events":
   102	      return "execution-events.jsonl";
   103	    case "supervisor_interventions":
   104	      return "supervisor-interventions.jsonl";
   105	    case "planning_review_findings":
   106	      return "planning-review-findings.jsonl";
   107	    default: {
   108	      // Exhaustiveness guard.
   109	      const _exhaustive: never = id.kind;
   110	      throw new Error(`Unknown artifact stream kind: ${_exhaustive}`);
   111	    }
   112	  }
   113	}
   114	
   115	export async function resolveArtifactStreamLocation(
   116	  args: {
   117	    runId: string;
   118	    kind: ArtifactStreamId["kind"];
   119	    ownerId: string | null;
   120	    projectPath: string | null | undefined;
   121	  },
   122	  mode: "read" | "write",
   123	): Promise<ArtifactStreamLocation> {
   124	  const id: ArtifactStreamId = {
   125	    runId: args.runId,
    45	  const planningRun = await db.select().from(runs).where(eq(runs.id, args.runId)).get();
    46	  if (!planningRun) {
    47	    throw new Error(`Planning run ${args.runId} not found`);
    48	  }
    49	
    50	  if (planningRun.mode !== "planning") {
    51	    throw new Error("Only planning conversations can be promoted");
    52	  }
    53	
    54	  const artifacts = parseArtifactsJson(planningRun.plannerArtifactsJson);
    55	  const selectedPlanPath = args.planPath?.trim() || planningRun.artifactPlanPath || artifacts.planPath || null;
    56	  if (!selectedPlanPath) {
    57	    throw new Error("No verified plan is available to promote");
    58	  }
    59	
    60	  const selectedArtifact = artifacts.candidates?.find((candidate) => candidate.path === selectedPlanPath) ?? null;
    61	  if (selectedArtifact?.readiness && selectedArtifact.readiness.ready === false) {
    62	    throw new Error("The selected plan is not ready for implementation");
    63	  }
    64	  const artifactAlreadyReady = selectedArtifact?.readiness?.ready === true;
    65	
    66	  if (!fs.existsSync(selectedPlanPath)) {
    67	    throw new Error(`Plan file not found: ${selectedPlanPath}`);
    68	  }
    69	
    70	  const record = await readinessRecordForPlanFile({
    71	    runId: args.runId,
    72	    planPath: selectedPlanPath,
    73	  });
    74	  if (record?.verdict?.verdict === "needs_rewrite") {
    75	    throw new Error(`The selected plan needs a rewrite before implementation: ${record.verdict.headline}`);
    76	  }
    77	
    78	  // Even when a verdict is present, run the structural floor — it catches
    79	  // edge cases like a plan file emptied between the verdict and the promote.
    80	  const planMarkdown = fs.readFileSync(selectedPlanPath, "utf8");
    81	  const readiness = await assessPlanReadiness(parsePlan(planMarkdown));
    82	  if (!record?.verdict && !artifactAlreadyReady && !readiness.ready) {
    83	    throw new Error("The selected plan is not ready for implementation");
    84	  }
    85	
    86	  const sourceMessages = await db.select().from(messages)
    87	    .where(eq(messages.runId, args.runId))
    88	    .orderBy(asc(messages.createdAt), asc(messages.id));
    89	
    90	  const previousPlanningStatus = planningRun.status;
    91	  await db.update(runs).set({
    92	    status: "promoting",
    93	    updatedAt: new Date(),
    94	  }).where(eq(runs.id, planningRun.id));
    95	
    96	  const newPlanId = randomUUID();
    97	  await db.insert(plans).values({
    98	    id: newPlanId,
    99	    path: selectedPlanPath,
   100	    status: "running",
   101	    createdAt: new Date(),
   102	    updatedAt: new Date(),
   103	  });
   104	
   105	  const newRunId = createRunId();
   106	  await db.insert(runs).values({
   107	    id: newRunId,
   108	    planId: newPlanId,
   109	    mode: "implementation",
   110	    projectPath: planningRun.projectPath,
   111	    title: planningRun.title,
   112	    preferredWorkerType: planningRun.preferredWorkerType,
   113	    preferredWorkerModel: planningRun.preferredWorkerModel,
   114	    preferredWorkerEffort: planningRun.preferredWorkerEffort,
   115	    allowedWorkerTypes: planningRun.allowedWorkerTypes,

2026-06-14T16:43:03.427815Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:43:03.443161Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:43:03.443170Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:43:03.443715Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:43:03.443720Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:43:03.444043Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:43:03.444047Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:43:03.444412Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:43:03.444417Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:43:03.444732Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:43:03.444736Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:43:03.445474Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:43:03.445479Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:43:03.794791Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:43:03.802042Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:43:03.802064Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
codex
1. **Verdict: HARDEN**

The plan is directionally strong, but not ready as an execution artifact yet.

2. **Highest-Impact Findings**

- **Parsing call sites are underspecified.** The plan adds parser/store modules, but does not say exactly where advisor output is parsed. Initial output flows through [create.ts](/Users/masterman/NLP/omniharness/src/server/conversations/create.ts:331), while follow-ups/refinements flow through [send-message.ts](/Users/masterman/NLP/omniharness/src/server/conversations/send-message.ts:349) and queued-message paths.  
  **Fix:** Add a shared post-turn helper, e.g. `processImproveWorkerOutput({ runId, workerId, responseText, snapshot, source })`, and list every call site that invokes it. Tests should cover initial run output, refine output, malformed output, and a busy/queued refinement.

- **Promotion is not concrete enough.** Existing promotion only accepts `mode === "planning"` and requires a verified plan file in [promote.ts](/Users/masterman/NLP/omniharness/src/server/planning/promote.ts:50). The improve plan says “creates or updates a planning artifact/run,” but does not define the actual target object or handoff sequence.  
  **Fix:** Define `promoteImproveResult` precisely: whether it creates a planning run, writes a plan artifact file from `planMarkdown`, runs readiness, then optionally starts implementation; or whether promotion only creates a planning handoff. Include persisted fields like `promotedRunId`, `promotedPlanId`, `promotedAt`.

- **Artifact stream plumbing is missing from the file map.** The plan says to use `artifactStreams`, but current stream kinds are closed in [stream-types.ts](/Users/masterman/NLP/omniharness/src/server/artifacts/stream-types.ts:10) and path routing is exhaustive in [append-only-store.ts](/Users/masterman/NLP/omniharness/src/server/artifacts/append-only-store.ts:92).  
  **Fix:** Add `src/server/artifacts/stream-types.ts`, `append-only-store.ts`, and probably stream metadata adapter tests to the file map, or explicitly choose bounded DB text instead. If using streams, add an `improve_results` or `improve_result_artifacts` stream kind and a domain adapter like planning review has.

- **Refinement state is internally inconsistent.** The status list omits `failed`, but the state machine says `refining -> ... | failed` in the plan at line 175. It also does not model refinement history, supersession links, or stale refine responses clearly.  
  **Fix:** Add explicit columns/fields: `clientId`, `version`, `parentResultId` or `supersedesResultId`, `supersededByResultId`, `refinementRequestId`, `lastMutationId`, `promotedRunId`. Decide whether failed refinement returns the original card to `proposed` or creates a failed refinement record.

- **Direct improve launch needs explicit `skillRoots` wiring.** `spawnAgent` supports `skillRoots`, but the direct conversation launch path currently does not pass them. The plan’s “only if typing does not expose skillRoots” understates the actual work.  
  **Fix:** Add `skillRoots` through `createConversation -> startDirectWorkerConversation -> spawnAgent`, and cover it in `session-types` or a focused create-conversation test.

- **Cleanup and deletion need stronger acceptance criteria.** The plan mentions delete cleanup, but new improve tables and artifact streams must be included in `scripts/delete-conversations.sh`, tests, and any run deletion path.  
  **Fix:** Add explicit files/tests for conversation deletion cleanup, FK behavior, and artifact file cleanup.

3. **Deliberately Leave Alone**

- Keep `improve` as a direct-worker-backed advisor mode. That matches the user goal and avoids supervisor semantics.
- Keep structured rows separate from the unified worker stream. The transcript should stay in the worker JSONL stream; cards should be a validated projection.
- Keep explicit `Promote` separate from `Approve`. That is the safer product default and already called out for human confirmation.
tokens used
155.865
1. **Verdict: HARDEN**

The plan is directionally strong, but not ready as an execution artifact yet.

2. **Highest-Impact Findings**

- **Parsing call sites are underspecified.** The plan adds parser/store modules, but does not say exactly where advisor output is parsed. Initial output flows through [create.ts](/Users/masterman/NLP/omniharness/src/server/conversations/create.ts:331), while follow-ups/refinements flow through [send-message.ts](/Users/masterman/NLP/omniharness/src/server/conversations/send-message.ts:349) and queued-message paths.  
  **Fix:** Add a shared post-turn helper, e.g. `processImproveWorkerOutput({ runId, workerId, responseText, snapshot, source })`, and list every call site that invokes it. Tests should cover initial run output, refine output, malformed output, and a busy/queued refinement.

- **Promotion is not concrete enough.** Existing promotion only accepts `mode === "planning"` and requires a verified plan file in [promote.ts](/Users/masterman/NLP/omniharness/src/server/planning/promote.ts:50). The improve plan says “creates or updates a planning artifact/run,” but does not define the actual target object or handoff sequence.  
  **Fix:** Define `promoteImproveResult` precisely: whether it creates a planning run, writes a plan artifact file from `planMarkdown`, runs readiness, then optionally starts implementation; or whether promotion only creates a planning handoff. Include persisted fields like `promotedRunId`, `promotedPlanId`, `promotedAt`.

- **Artifact stream plumbing is missing from the file map.** The plan says to use `artifactStreams`, but current stream kinds are closed in [stream-types.ts](/Users/masterman/NLP/omniharness/src/server/artifacts/stream-types.ts:10) and path routing is exhaustive in [append-only-store.ts](/Users/masterman/NLP/omniharness/src/server/artifacts/append-only-store.ts:92).  
  **Fix:** Add `src/server/artifacts/stream-types.ts`, `append-only-store.ts`, and probably stream metadata adapter tests to the file map, or explicitly choose bounded DB text instead. If using streams, add an `improve_results` or `improve_result_artifacts` stream kind and a domain adapter like planning review has.

- **Refinement state is internally inconsistent.** The status list omits `failed`, but the state machine says `refining -> ... | failed` in the plan at line 175. It also does not model refinement history, supersession links, or stale refine responses clearly.  
  **Fix:** Add explicit columns/fields: `clientId`, `version`, `parentResultId` or `supersedesResultId`, `supersededByResultId`, `refinementRequestId`, `lastMutationId`, `promotedRunId`. Decide whether failed refinement returns the original card to `proposed` or creates a failed refinement record.

- **Direct improve launch needs explicit `skillRoots` wiring.** `spawnAgent` supports `skillRoots`, but the direct conversation launch path currently does not pass them. The plan’s “only if typing does not expose skillRoots” understates the actual work.  
  **Fix:** Add `skillRoots` through `createConversation -> startDirectWorkerConversation -> spawnAgent`, and cover it in `session-types` or a focused create-conversation test.

- **Cleanup and deletion need stronger acceptance criteria.** The plan mentions delete cleanup, but new improve tables and artifact streams must be included in `scripts/delete-conversations.sh`, tests, and any run deletion path.  
  **Fix:** Add explicit files/tests for conversation deletion cleanup, FK behavior, and artifact file cleanup.

3. **Deliberately Leave Alone**

- Keep `improve` as a direct-worker-backed advisor mode. That matches the user goal and avoids supervisor semantics.
- Keep structured rows separate from the unified worker stream. The transcript should stay in the worker JSONL stream; cards should be a validated projection.
- Keep explicit `Promote` separate from `Approve`. That is the safer product default and already called out for human confirmation.

````

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:43:38.263Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:43:38.263Z

The second-opinion verdict is `HARDEN`, and the findings are actionable. I’m updating the plan now to make parsing call sites, promotion semantics, artifact stream plumbing, refinement state, skill root launch wiring, and cleanup requirements explicit.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:44:39.694Z","phase":null} -->
## Tool call: apply_patch · 2026-06-14T16:44:39.694Z

````json
*** Begin Patch
*** Update File: docs/superpowers/plans/2026-06-14-visual-improve-mode.md
@@
 - `src/server/conversations/create.ts` — launch improve as a direct-worker-backed advisor, using a dedicated prompt and skill roots.
+- `src/server/conversations/send-message.ts` — run improve output processing after improve follow-up/refinement turns.
+- `src/server/conversations/queued-messages.ts` — run improve output processing for queued improve refinements that later deliver.
 - `src/server/prompts/improve.md` — new advisor prompt based on upstream improve semantics plus OmniHarness structured-output contract.
 - `src/server/db/schema.ts` and `src/server/db/index.ts` — add improve result tables and migrations.
 - `src/server/events/named-events.ts` — add improve event kinds and surfaced error codes.
 - `src/server/events/persisted-snapshot.ts` — include improve rows in selected-run snapshots with scoped completeness metadata.
+- `src/server/artifacts/stream-types.ts` and `src/server/artifacts/append-only-store.ts` — add an improve artifact stream kind and deterministic relative path.
+- `src/server/improve/artifact-store.ts` — domain adapter for appending/hydrating long improve result bodies, modeled after `src/server/planning/review-artifact-store.ts`.
 - `src/server/workers/entries-types.ts` and `src/server/workers/output-store.ts` only if a new worker entry type is truly required. Prefer not to add one; transcript content should remain ordinary worker output and structured rows should be separate artifacts.
-- `src/server/improve/*` — create focused server modules for prompt building, structured parsing, row persistence, card state mutations, and promotion.
+- `src/server/improve/*` — create focused server modules for prompt building, post-turn processing, structured parsing, row persistence, card state mutations, promotion, and cleanup helpers.
 - `src/app/api/improve/[id]/results/route.ts` or `src/runtime/http/routes/improve.ts` — card mutation/promote/refine endpoints, following existing runtime route patterns.
+- `src/runtime/http/routes/index.ts` — register improve routes for non-Next surfaces.
 - `src/components/ImproveResultsPanel.tsx` and `src/components/ImproveResultCard.tsx` — new UI surface for cards and actions.
 - `shared/locales/*.json` — all user-facing labels, statuses, actions, aria labels, placeholders, errors, and empty states.
+- `scripts/delete-conversations.sh` — delete improve rows and improve artifact files when clearing conversations.
@@
 - `tests/server/improve/promote.test.ts` — approved result promotion creates/reuses planning artifacts without creating branches/worktrees.
+- `tests/server/improve/post-turn-processing.test.ts` — initial, follow-up, queued, malformed, and stale refine output call the parser/store correctly.
+- `tests/server/artifacts/append-only-store.test.ts` — improve stream kind resolves to the intended path and appends/hydrates deterministically.
+- `tests/scripts/delete-conversations.test.ts` and `tests/api/conversations-route.test.ts` — improve rows/artifacts do not block deletion and are cleaned up.
 - `tests/ui/improve-results-panel.test.tsx` — cards render metadata/actions from manager state and all visible copy comes through i18n.
@@
 - `improve_runs`
   - `id`, `runId`, `status`, `focus`, `skillRootsJson`, `startedAt`, `completedAt`, `lastError`, timestamps.
 - `improve_results`
-  - `id`, `improveRunId`, `runId`, `kind`, `category`, `title`, `status`, `impact`, `effort`, `risk`, `confidence`, `priority`, `sourcePath`, `artifactSeq`, `detailsHash`, `detailsPreview`, `recommendationPreview`, timestamps.
-- `improve_result_artifacts`
-  - Prefer the existing `artifactStreams` engine for long `details`, `evidence`, `fixSketch`, `planMarkdown`, `rejectionReason`, and `refinementPrompt` bodies rather than storing large text directly in snapshot rows.
+  - `id`, `improveRunId`, `runId`, `clientId`, `version`, `kind`, `category`, `title`, `status`, `impact`, `effort`, `risk`, `confidence`, `priority`, `sourcePath`, `artifactSeq`, `detailsHash`, `detailsPreview`, `recommendationPreview`, `parentResultId`, `supersedesResultId`, `supersededByResultId`, `refinementRequestId`, `lastMutationId`, `promotedPlanId`, `promotedRunId`, `promotedAt`, timestamps.
+- Artifact stream kind: `improve_results`
+  - Extend `ArtifactStreamKind` and `streamRelativePath()` so long `details`, `evidence`, `fixSketch`, `planMarkdown`, `rejectionReason`, and `refinementPrompt` bodies live in `improve-results.jsonl`.
+  - Use a domain adapter like `planning/review-artifact-store.ts`: reserve seq, append envelope, write DB row with previews/hashes, commit seq, hydrate bodies only on detail reads.
 
 Statuses:
 
 - Improve run: `starting`, `running`, `completed`, `failed`.
-- Improve result: `proposed`, `approved`, `rejected`, `refining`, `superseded`, `promoted`.
+- Improve result: `proposed`, `approved`, `rejected`, `refining`, `refine_failed`, `superseded`, `promoted`.
@@
 - Deduplicate by `(runId, clientId)` and preserve existing user decisions when a later partial update refines the same result.
+
+## Output Processing Call Sites
+
+Add one shared server helper:
+
+```ts
+processImproveWorkerOutput({
+  runId,
+  workerId,
+  responseText,
+  source,
+  mutationId,
+}: {
+  runId: string;
+  workerId: string;
+  responseText: string;
+  source: "initial" | "follow_up" | "queued_refine" | "refine";
+  mutationId?: string;
+})
+```
+
+It should:
+
+- no-op unless the run mode is `improve`;
+- parse and persist valid `omniharness.improve.results.v1` blocks;
+- emit `improve.result_upserted` for every inserted/updated result;
+- emit `improve.parse_failed` and `error.surfaced` for malformed structured output;
+- preserve prior user decisions when a partial update changes result content;
+- reject stale refinement responses whose `mutationId` no longer matches the card's `lastMutationId`.
+
+Call it from every improve worker turn path:
+
+- initial improve launch in `src/server/conversations/create.ts` after `runInitialWorkerTurn` returns;
+- normal improve follow-up in `src/server/conversations/send-message.ts` after `continueWorkerConversation` receives a response;
+- busy/steer path in `send-message.ts` when an improve turn is run synchronously;
+- queued improve delivery in `src/server/conversations/queued-messages.ts` after `askAgent` resolves.
+
+If a call path cannot access the response text without invasive changes, stop and refactor the worker-turn helper first. Do not add an independent transcript parser that tails JSONL.
@@
-- **State Machine:** Result transitions are constrained: `proposed -> approved|rejected|refining`; `refining -> proposed|superseded|failed`; `approved -> promoted`; no mutation from `promoted` back to proposed without a new result row.
+- **State Machine:** Result transitions are constrained: `proposed -> approved|rejected|refining`; `refining -> proposed|superseded|refine_failed`; `refine_failed -> proposed|rejected|refining`; `approved -> promoted`; no mutation from `promoted` back to proposed without a new result row.
@@
 - `improve.promote_requested` `{ runId, improveRunId, resultId }`
 - `improve.promote_finished` `{ runId, improveRunId, resultId, targetRunId, status }`
+- `improve.promote_failed` `{ runId, improveRunId, resultId, reason }`
 - `improve.parse_failed` `{ runId, improveRunId, reason }`
 - `improve.finished` `{ runId, improveRunId, status }`
+
+## Promotion Semantics
+
+`Approve` only changes the improve card status. `Promote` creates a planning handoff; it does not start implementation directly.
+
+Implement `promoteImproveResult({ runId, improveRunId, resultId })`:
+
+- Require result status `approved`.
+- Require a usable `planMarkdown` body in the result artifact. If the card is only a finding/direction with no plan body, create a planning conversation/run seeded with the result's recommendation and mark the card `promoted` only after that planning run is created.
+- If `planMarkdown` exists, write it to `docs/superpowers/plans/YYYY-MM-DD-improve-<slug>.md` under the project root, create/update a `plans` row, create a `planning` run with `artifactPlanPath` and `plannerArtifactsJson` pointing at that file, and run the existing readiness pipeline against the file.
+- Persist `promotedPlanId`, `promotedRunId`, and `promotedAt` on the improve result.
+- Emit `improve.promote_requested` before mutation and `improve.promote_finished` or `improve.promote_failed` after.
+- Never call `promotePlanningRun` directly on the improve run, because `src/server/planning/promote.ts` only accepts planning runs and verified plan files.
+- Never create a branch, worktree, commit, or implementation run as part of promotion.
@@
 - [ ] Implement structured parser and artifact-backed persistence.
-  - Files: `src/server/improve/parser.ts`, `src/server/improve/store.ts`, `src/server/improve/types.ts`.
-  - Use `zod`; keep large bodies in artifact streams or bounded previews.
-  - Verify: `pnpm test tests/server/improve/parser.test.ts`.
+  - Files: `src/server/improve/parser.ts`, `src/server/improve/store.ts`, `src/server/improve/artifact-store.ts`, `src/server/improve/types.ts`, `src/server/artifacts/stream-types.ts`, `src/server/artifacts/append-only-store.ts`.
+  - Use `zod`; keep large bodies in the `improve_results` artifact stream and bounded previews in SQLite/snapshots.
+  - Verify: `pnpm test tests/server/improve/parser.test.ts tests/server/artifacts/append-only-store.test.ts`.
 
 - [ ] Add improve prompt and launch wiring.
-  - Files: `src/server/prompts/improve.md`, `src/server/conversations/modes.ts`, `src/server/conversations/create.ts`, `src/server/bridge-client/index.ts` only if current `spawnAgent` request typing does not expose `skillRoots`.
-  - Use existing `skillRoots` support to expose the configured improve skill bundle to the one advisor worker.
+  - Files: `src/server/prompts/improve.md`, `src/server/conversations/modes.ts`, `src/server/conversations/create.ts`, `src/server/bridge-client/index.ts`, `src/server/agent-runtime/types.ts` only if request typing is incomplete.
+  - Thread improve `skillRoots` explicitly through conversation creation into the direct-worker launch path. The current `spawnAgent` supports `skillRoots`, but normal direct conversation creation does not pass a mode-specific skill root.
+  - Test that an improve conversation spawn request contains the configured improve skill root.
   - Do not create a branch or worktree.
   - Verify: `pnpm test tests/lifecycle/scenarios/session-types.test.ts`.
+
+- [ ] Add shared improve post-turn output processing.
+  - Files: `src/server/improve/process-output.ts`, `src/server/conversations/create.ts`, `src/server/conversations/send-message.ts`, `src/server/conversations/queued-messages.ts`.
+  - Invoke `processImproveWorkerOutput` after initial, follow-up, synchronous steer, refine, and queued-refine improve turns.
+  - Verify malformed output, valid partial output, valid final output, and stale mutation ids.
+  - Verify: `pnpm test tests/server/improve/post-turn-processing.test.ts`.
@@
 - [ ] Add card mutation and promotion routes.
   - Files: `src/runtime/http/routes/improve.ts`, `src/app/api/improve/[id]/results/route.ts` or equivalent Next route wrappers.
   - Actions: approve, reject, refine, promote.
-  - Refine sends a targeted prompt to the same advisor worker when available, otherwise fails visibly with a recovery message.
-  - Promote creates or updates a planning artifact/run using existing planning/promotion helpers; it must not implement directly.
+  - Refine creates a `mutationId`, writes `lastMutationId`, transitions the card to `refining`, and sends a targeted prompt to the same advisor worker when available. If the worker is unavailable, transition to `refine_failed`, emit `improve.refine_finished` with failure status, and surface the error.
+  - A successful refinement either updates the same card version or creates a new result row with `parentResultId`/`supersedesResultId`; stale responses must not overwrite a newer card state.
+  - Promote uses `promoteImproveResult` exactly as defined in this plan. It creates a planning handoff, not implementation.
   - Verify: `pnpm test tests/server/improve/promote.test.ts tests/api/events-route.test.ts`.
@@
 - [ ] Add lifecycle flow coverage.
   - Files: `tests/lifecycle/scenarios/improve-mode-flow.test.ts`.
   - Test: start improve, emit `improve.started`, parse one result, receive `improve.result_upserted`, drop SSE, resync, approve/reject/refine card, assert persisted row state.
   - Verify: `pnpm test:lifecycle -- tests/lifecycle/scenarios/improve-mode-flow.test.ts` if supported by the runner, otherwise `pnpm test tests/lifecycle/scenarios/improve-mode-flow.test.ts`.
+
+- [ ] Add cleanup and deletion coverage.
+  - Files: `scripts/delete-conversations.sh`, any API route/helper that deletes conversations, `tests/scripts/delete-conversations.test.ts`, `tests/api/conversations-route.test.ts`.
+  - Delete improve result rows before deleting runs/plans where foreign keys require it.
+  - Remove improve artifact files under both project-local and legacy run-data roots.
+  - Verify no improve row or artifact can block conversation deletion.
@@
 - Implementing promotion requires branch or worktree creation. Branches are forbidden; worktrees require explicit user approval and are out of scope for this milestone.
 - The advisor output can only be captured by brittle terminal scraping with no structured checkpoint. In that case, revise the prompt/contract first.
+- Initial/follow-up improve output cannot be processed from explicit response objects without tailing worker JSONL.
 - Snapshot hot paths require loading full markdown bodies for all cards.
 - Existing dirty worktree changes conflict with a file in scope and it is unclear which behavior is current user intent.
@@
 - Structured findings/direction/plan candidates persist independently of the transcript.
+- Initial output, follow-up output, queued refinement output, and malformed output all pass through the same improve post-turn processing helper.
 - Cards render after reload/reconnect from server-authoritative state.
 - Per-card approve/reject/refine/promote actions persist and emit named events.
+- Promotion creates a planning handoff with persisted `promotedPlanId`, `promotedRunId`, and `promotedAt`; it does not call planning promotion on an improve run and does not start implementation.
 - Parse failure and advisor failure are visible through `error.surfaced`.
+- Conversation deletion and `scripts/delete-conversations.sh` remove improve rows and artifacts without FK failures.
*** End Patch

````

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:44:39.713Z","phase":null} -->
## Tool result: call_mw3ZaFzd3Z9QFISiCRFXvWBf · 2026-06-14T16:44:39.713Z

```text
Exit code: 0
Wall time: 0 seconds
Output:
Success. Updated the following files:
M docs/superpowers/plans/2026-06-14-visual-improve-mode.md

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:44:46.867Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:44:46.867Z

I applied the reviewer’s hardening points into the plan. I’m rerunning the same fallback reviewer session against the revised artifact to check whether the plan now clears the execution-readiness bar.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:44:51.867Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:44:51.867Z

```json
{
  "cmd": "/Applications/Codex.app/Contents/Resources/codex exec resume 019ec701-cd12-74e1-b1bc-5500e64d0904 -o /tmp/visual-improve-mode-second-opinion-pass-2.txt - <<'EOF'\nI revised /Users/masterman/NLP/omniharness/docs/superpowers/plans/2026-06-14-visual-improve-mode.md to address your HARDEN findings.\n\nPlease review only the revised plan artifact. Do not edit files.\n\nFocus specifically on whether the previous concerns are now addressed:\n- explicit parsing call sites and shared post-turn helper,\n- concrete promotion semantics compatible with existing planning promotion constraints,\n- artifact stream plumbing file map and adapter requirements,\n- refinement state/history/stale mutation model,\n- explicit skillRoots launch wiring,\n- cleanup/deletion coverage.\n\nReturn:\n1. Verdict: READY or HARDEN\n2. Remaining highest-impact fixes, if any\n3. Anything you would leave alone\nEOF",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 30000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:45:22.038Z","phase":null} -->
## Tool result: call_7SHO4dmhYBMrrh1m1grCgGfc · 2026-06-14T16:45:22.038Z

````text
Chunk ID: 4be481
Wall time: 30.0029 seconds
Process running with session ID 50700
Original token count: 14525
Output:
Total output lines: 749

OpenAI Codex v0.140.0-alpha.2
--------
workdir: /Users/masterman/NLP/omniharness
model: gpt-5.5
provider: openai
approval: never
sandbox: danger-full-access
reasoning effort: high
reasoning summaries: none
session id: 019ec701-cd12-74e1-b1bc-5500e64d0904
--------
user
I revised /Users/masterman/NLP/omniharness/docs/superpowers/plans/2026-06-14-visual-improve-mode.md to address your HARDEN findings.

Please review only the revised plan artifact. Do not edit files.

Focus specifically on whether the previous concerns are now addressed:
- explicit parsing call sites and shared post-turn helper,
- concrete promotion semantics compatible with existing planning promotion constraints,
- artifact stream plumbing file map and adapter requirements,
- refinement state/history/stale mutation model,
- explicit skillRoots launch wiring,
- cleanup/deletion coverage.

Return:
1. Verdict: READY or HARDEN
2. Remaining highest-impact fixes, if any
3. Anything you would leave alone

2026-06-14T16:44:52.033843Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:44:52.070639Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:44:52.070650Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:44:52.071367Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:44:52.071375Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:44:52.072036Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:44:52.072042Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:44:52.072639Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:44:52.072645Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:44:52.073273Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:44:52.073285Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:44:52.074673Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:44:52.074679Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:44:52.615445Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:44:52.801454Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:44:52.811307Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:44:52.811343Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:44:54.175364Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:44:54.189019Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:44:54.189028Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:44:54.189349Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:44:54.189354Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:44:54.189683Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:44:54.189688Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:44:54.190032Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:44:54.190035Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:44:54.190383Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:44:54.190387Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:44:54.191075Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:44:54.191079Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:44:54.523872Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:44:54.531385Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:44:54.531410Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
codex
I’ll do a focused read-only second-opinion pass on the revised plan only, checking the six previous hardening points against the artifact text.
exec
/bin/zsh -lc "sed -n '1,240p' /Users/masterman/.agents/skills/using-ultrapowers/SKILL.md" in /Users/masterman/NLP/omniharness
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

## Gemini CLI Pattern

For Gemini, prefer non-interactive prompt mode with plan/read-only approval when available:

```bash
gemini --prompt "$(cat /tmp/second-opinion-prompt.txt)" --approval-mode plan --output-format text > /tmp/second-opinion-pass-1.txt
```

Resume the same session with `--resume` if that is available and useful for later passes.

## Review Prompt Template

```text
You are my second-opinion p…4525 tokens truncated… `runId`, `status`, `focus`, `skillRootsJson`, `startedAt`, `completedAt`, `lastError`, timestamps.
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
- Treat malformed JSON as `improve.parse_failed` plus `error.surfaced`, but keep the transcript visible.
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

exec
/bin/zsh -lc "sed -n '261,560p' docs/superpowers/plans/2026-06-14-visual-improve-mode.md" in /Users/masterman/NLP/omniharness
 succeeded in 0ms:
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

2026-06-14T16:45:14.567795Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:45:14.583382Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:45:14.583391Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:45:14.583725Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:45:14.583731Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:45:14.584065Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:45:14.584071Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:45:14.584401Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:45:14.584405Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:45:14.584732Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:45:14.584738Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:45:14.585479Z  WARN codex_core_skills::loader: ignoring interface.icon_small: icon path with '..' must resolve under plugin assets/
2026-06-14T16:45:14.585483Z  WARN codex_core_skills::loader: ignoring interface.icon_large: icon path with '..' must resolve under plugin assets/
2026-06-14T16:45:14.922529Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:45:14.930242Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json
2026-06-14T16:45:14.930265Z  WARN codex_core_plugins::manifest: ignoring interface.defaultPrompt[0]: prompt must be at most 128 characters path=/Users/masterman/.codex/.tmp/plugins/plugins/ngs-analysis/.codex-plugin/plugin.json

````

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-06-14T16:46:16.103Z","phase":null} -->
## Task state: context_compacted · 2026-06-14T16:46:16.103Z

```text
{
  "type": "context_compacted"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:46:22.431Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:46:22.431Z

I’m picking up from the hardened plan and the second review pass. Baton itself is still blocked by the missing `claude` executable, so I’m checking the fallback review result now and will only adjust the plan if it finds a concrete gap.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:46:23.068Z","phase":null} -->
## Tool call: write_stdin · 2026-06-14T16:46:23.068Z

```json
{
  "session_id": 50700,
  "chars": "",
  "yield_time_ms": 30000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:46:23.085Z","phase":null} -->
## Tool result: call_3qCLD5IgfiU6uquYdZhNqtbO · 2026-06-14T16:46:23.085Z

```text
Chunk ID: 27af51
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 614
Output:
codex
1. **Verdict: READY**

The revised plan addresses the previous HARDEN findings well enough to use. The six targeted gaps now have explicit plan text: post-turn processing call sites, promotion semantics that avoid calling `promotePlanningRun` on an improve run, artifact stream type/path/adapter work, refinement mutation/history fields, direct-launch `skillRoots` wiring, and cleanup/deletion coverage.

2. **Remaining Highest-Impact Fixes**

No blocking fixes remain.

Two small polish items before execution would help:

- Align the early PM state model with the later data model: it lists result states without `refine_failed`, while the detailed status section includes it.
- In `processImproveWorkerOutput`, distinguish “no structured block yet” from “malformed structured block” so normal prose before a checkpoint does not surface a parse failure too early.

3. **Leave Alone**

- Keep `Promote` explicit and separate from `Approve`.
- Keep promotion as a planning handoff, not implementation.
- Keep structured improve rows separate from the unified worker transcript.
- Keep the STOP condition forbidding JSONL tail parsing; requiring explicit response-object processing is the right constraint.
tokens used
170.871
1. **Verdict: READY**

The revised plan addresses the previous HARDEN findings well enough to use. The six targeted gaps now have explicit plan text: post-turn processing call sites, promotion semantics that avoid calling `promotePlanningRun` on an improve run, artifact stream type/path/adapter work, refinement mutation/history fields, direct-launch `skillRoots` wiring, and cleanup/deletion coverage.

2. **Remaining Highest-Impact Fixes**

No blocking fixes remain.

Two small polish items before execution would help:

- Align the early PM state model with the later data model: it lists result states without `refine_failed`, while the detailed status section includes it.
- In `processImproveWorkerOutput`, distinguish “no structured block yet” from “malformed structured block” so normal prose before a checkpoint does not surface a parse failure too early.

3. **Leave Alone**

- Keep `Promote` explicit and separate from `Approve`.
- Keep promotion as a planning handoff, not implementation.
- Keep structured improve rows separate from the unified worker transcript.
- Keep the STOP condition forbidding JSONL tail parsing; requiring explicit response-object processing is the right constraint.

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:46:29.181Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:46:29.181Z

The second pass is `READY` with two small polish notes. I’m applying those directly: one state-list alignment and one parser-behavior clarification so ordinary prose is not treated as a malformed result.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:46:29.185Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:46:29.185Z

```json
{
  "cmd": "rg -n \"state|refine_failed|processImproveWorkerOutput|malformed|structured block|PM\" docs/superpowers/plans/2026-06-14-visual-improve-mode.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:46:29.248Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:46:29.248Z

```json
{
  "cmd": "sed -n '1,260p' docs/superpowers/plans/2026-06-14-visual-improve-mode.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:46:29.271Z","phase":null} -->
## Tool result: call_y0dDsWQJsvM96Xp1JWaKXyDt · 2026-06-14T16:46:29.271Z

```text
Chunk ID: fe272b
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 1115
Output:
23:### PM Pass
30:- **Persistence Model:** Runs remain in `runs`; transcript content remains in the worker JSONL stream; structured improve output lives in new typed DB rows plus artifact-stream-backed long fields. Per-card approval/rejection/refinement state is workspace-local and survives reload/restart. No translated UI copy is persisted.
31:- **Operational Readiness:** Spawn failures, malformed advisor output, partial output, restart, SSE reconnect, and stale refine requests must all surface as named events and visible UI state.
32:- **Instrumentation And Observability:** Emit named events for improve start, parsed result, parse failure, card state changes, refinement requested/completed, promote requested/completed/failed, and advisor failure. User-visible failures emit `error.surfaced` with stable codes.
60:- The server stores structured rows and rejects malformed structured output into a visible parse-failure state.
66:- **Extend planning mode:** Lowest backend cost, but conflates "write a requested plan" with "audit and produce multiple improvement opportunities." Rejected because it makes the UI and state model harder to reason about.
80:- `src/app/home/HomeApp.tsx` — pass improve state/actions into `ConversationMain`.
93:- `src/server/improve/*` — create focused server modules for prompt building, post-turn processing, structured parsing, row persistence, card state mutations, promotion, and cleanup helpers.
97:- `shared/locales/*.json` — all user-facing labels, statuses, actions, aria labels, placeholders, errors, and empty states.
105:- `tests/lifecycle/scenarios/improve-mode-flow.test.ts` — start improve, receive structured result events, reconnect/resync, mutate card state.
106:- `tests/server/improve/parser.test.ts` — structured extraction accepts valid output, rejects malformed output, preserves evidence, and redacts/omits secret-like values.
108:- `tests/server/improve/post-turn-processing.test.ts` — initial, follow-up, queued, malformed, and stale refine output call the parser/store correctly.
111:- `tests/ui/improve-results-panel.test.tsx` — cards render metadata/actions from manager state and all visible copy comes through i18n.
136:- Improve result: `proposed`, `approved`, `rejected`, `refining`, `refine_failed`, `superseded`, `promoted`.
174:- Treat malformed JSON as `improve.parse_failed` plus `error.surfaced`, but keep the transcript visible.
183:processImproveWorkerOutput({
203:- emit `improve.parse_failed` and `error.surfaced` for malformed structured output;
218:- **Owner:** Server owns improve run/result rows. `ImproveResultsManager` owns the client snapshot projection and local UI expansion state only.
223:- **State Machine:** Result transitions are constrained: `proposed -> approved|rejected|refining`; `refining -> proposed|superseded|refine_failed`; `refine_failed -> proposed|rejected|refining`; `approved -> promoted`; no mutation from `promoted` back to proposed without a new result row.
262:- `improve.refine_failed`
291:  - Invoke `processImproveWorkerOutput` after initial, follow-up, synchronous steer, refine, and queued-refine improve turns.
292:  - Verify malformed output, valid partial output, valid final output, and stale mutation ids.
308:  - Refine creates a `mutationId`, writes `lastMutationId`, transitions the card to `refining`, and sends a targeted prompt to the same advisor worker when available. If the worker is unavailable, transition to `refine_failed`, emit `improve.refine_finished` with failure status, and surface the error.
309:  - A successful refinement either updates the same card version or creates a new result row with `parentResultId`/`supersedesResultId`; stale responses must not overwrite a newer card state.
319:- [ ] Add `Improve` to the composer and mode state.
333:  - Test: start improve, emit `improve.started`, parse one result, receive `improve.result_upserted`, drop SSE, resync, approve/reject/refine card, assert persisted row state.
367:- Initial output, follow-up output, queued refinement output, and malformed output all pass through the same improve post-turn processing helper.
368:- Cards render after reload/reconnect from server-authoritative state.
380:- Product choice to confirm before implementation: whether approving a card should create a planning run immediately or only mark it approved until the user clicks `Promote`. This plan uses explicit `Promote` to avoid surprising state changes.

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:46:29.295Z","phase":null} -->
## Tool result: call_CGpVxiOK2PIGUWq8Qasz9CWA · 2026-06-14T16:46:29.295Z

````text
Chunk ID: d21f93
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 5196
Output:
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
- **State Model:** `starting`, `running`, `awaiting_refinement`, `completed`, `failed`, plus per-result `proposed`, `approved`, `rejected`, `superseded`, `promoted`.
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
- Treat malformed JSON as `improve.parse_failed` plus `error.surfaced`, but keep the transcript visible.
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

````

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:46:33.291Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:46:33.291Z

```json
{
  "cmd": "sed -n '260,430p' docs/superpowers/plans/2026-06-14-visual-improve-mode.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:46:33.362Z","phase":null} -->
## Tool result: call_9bfY5uvtsY5EnREBGeCB3W8L · 2026-06-14T16:46:33.362Z

```text
Chunk ID: c37d61
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 2398
Output:
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

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:46:39.859Z","phase":null} -->
## Tool call: apply_patch · 2026-06-14T16:46:39.859Z

```json
*** Begin Patch
*** Update File: docs/superpowers/plans/2026-06-14-visual-improve-mode.md
@@
-- **State Model:** `starting`, `running`, `awaiting_refinement`, `completed`, `failed`, plus per-result `proposed`, `approved`, `rejected`, `superseded`, `promoted`.
+- **State Model:** `starting`, `running`, `awaiting_refinement`, `completed`, `failed`, plus per-result `proposed`, `approved`, `rejected`, `refining`, `refine_failed`, `superseded`, `promoted`.
@@
-- Treat malformed JSON as `improve.parse_failed` plus `error.surfaced`, but keep the transcript visible.
+- Treat a malformed `omniharness.improve.results.v1` fenced block as `improve.parse_failed` plus `error.surfaced`, but keep the transcript visible.
+- Distinguish "no structured block yet" from "malformed structured block"; normal prose before a checkpoint is not a parse failure.
*** End Patch

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:46:39.892Z","phase":null} -->
## Tool result: call_pvjM5T1H7nI7AloKQftUawKW · 2026-06-14T16:46:39.892Z

```text
Exit code: 0
Wall time: 0 seconds
Output:
Success. Updated the following files:
M docs/superpowers/plans/2026-06-14-visual-improve-mode.md

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:46:46.887Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:46:46.887Z

The two polish changes are in. I’m doing a quick document-level check now: whitespace/diff sanity and spot-checking the exact tightened sections.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:46:46.889Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:46:46.889Z

```json
{
  "cmd": "git diff --check -- docs/superpowers/plans/2026-06-14-visual-improve-mode.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:46:46.889Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:46:46.889Z

```json
{
  "cmd": "git diff -- docs/superpowers/plans/2026-06-14-visual-improve-mode.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 30000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:46:46.936Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:46:46.936Z

```json
{
  "cmd": "rg -n \"refine_failed|no structured block yet|processImproveWorkerOutput|Promotion Semantics|Output Processing Call Sites|STOP Conditions\" docs/superpowers/plans/2026-06-14-visual-improve-mode.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:46:46.964Z","phase":null} -->
## Tool result: call_UTmizpiXIdBggJ10vWKRbFoT · 2026-06-14T16:46:46.964Z

```text
Chunk ID: c3b058
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 0
Output:

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:46:46.964Z","phase":null} -->
## Tool result: call_zTgZ6Op8Lx8vk5qrViE7aDXp · 2026-06-14T16:46:46.964Z

```text
Chunk ID: 5ffcf4
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 0
Output:

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:46:46.980Z","phase":null} -->
## Tool result: call_fS30mxOkRVPczi7ILKMAsaHq · 2026-06-14T16:46:46.980Z

```text
Chunk ID: 6dbb3f
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 332
Output:
29:- **State Model:** `starting`, `running`, `awaiting_refinement`, `completed`, `failed`, plus per-result `proposed`, `approved`, `rejected`, `refining`, `refine_failed`, `superseded`, `promoted`.
136:- Improve result: `proposed`, `approved`, `rejected`, `refining`, `refine_failed`, `superseded`, `promoted`.
175:- Distinguish "no structured block yet" from "malformed structured block"; normal prose before a checkpoint is not a parse failure.
179:## Output Processing Call Sites
184:processImproveWorkerOutput({
224:- **State Machine:** Result transitions are constrained: `proposed -> approved|rejected|refining`; `refining -> proposed|superseded|refine_failed`; `refine_failed -> proposed|rejected|refining`; `approved -> promoted`; no mutation from `promoted` back to proposed without a new result row.
245:## Promotion Semantics
263:- `improve.refine_failed`
292:  - Invoke `processImproveWorkerOutput` after initial, follow-up, synchronous steer, refine, and queued-refine improve turns.
309:  - Refine creates a `mutationId`, writes `lastMutationId`, transitions the card to `refining`, and sends a targeted prompt to the same advisor worker when available. If the worker is unavailable, transition to `refine_failed`, emit `improve.refine_finished` with failure status, and surface the error.
351:## STOP Conditions

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:46:56.404Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:46:56.404Z

`git diff --check` is clean. The plan file may be currently untracked or outside the tracked diff set, so I’m checking status for that path before I close this out.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:46:56.407Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:46:56.407Z

```json
{
  "cmd": "git status --short -- docs/superpowers/plans/2026-06-14-visual-improve-mode.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:46:56.407Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:46:56.407Z

```json
{
  "cmd": "git ls-files -- docs/superpowers/plans/2026-06-14-visual-improve-mode.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:46:56.465Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:46:56.465Z

```json
{
  "cmd": "wc -l docs/superpowers/plans/2026-06-14-visual-improve-mode.md",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:46:56.485Z","phase":null} -->
## Tool result: call_Bum5bXX3aRTCtPG031tl7Gni · 2026-06-14T16:46:56.485Z

```text
Chunk ID: 2f99a7
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 15
Output:
?? docs/superpowers/plans/2026-06-14-visual-improve-mode.md

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:46:56.485Z","phase":null} -->
## Tool result: call_cFW92Juxrbq30hJVczHkcVwD · 2026-06-14T16:46:56.485Z

```text
Chunk ID: c823b9
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 0
Output:

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:46:56.509Z","phase":null} -->
## Tool result: call_Ey1mIJJGfGADlF5DqCnIfD7a · 2026-06-14T16:46:56.509Z

```text
Chunk ID: 3e1a21
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 17
Output:
     382 docs/superpowers/plans/2026-06-14-visual-improve-mode.md

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:47:02.872Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:47:02.872Z

Since you asked to try again now, I’m also retrying Baton itself rather than relying only on the fallback review. If the local `claude` dependency is available now, I’ll use Baton’s verdict; otherwise I’ll report the blocker precisely.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:47:03.581Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:47:03.581Z

```json
{
  "cmd": "/Users/masterman/.local/bin/baton --help",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 20000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:47:03.716Z","phase":null} -->
## Tool result: call_Kal0u7TwGzfpeAcbuitdSCeo · 2026-06-14T16:47:03.716Z

```text
Chunk ID: 9c72d4
Wall time: 0.0000 seconds
Process exited with code 1
Original token count: 5
Output:
spawn claude ENOENT

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"progress","timestamp":"2026-06-14T16:47:08.552Z","phase":"commentary"} -->
## Codex progress · 2026-06-14T16:47:08.552Z

Baton is still failing before it can run a review: `spawn claude ENOENT`. I’m confirming the missing executable so the final status is unambiguous.

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:47:08.555Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:47:08.555Z

```json
{
  "cmd": "command -v claude",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-call","timestamp":"2026-06-14T16:47:08.610Z","phase":null} -->
## Tool call: exec_command · 2026-06-14T16:47:08.610Z

```json
{
  "cmd": "/Users/masterman/.local/bin/baton status",
  "workdir": "/Users/masterman/NLP/omniharness",
  "yield_time_ms": 10000,
  "max_output_tokens": 12000
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:47:08.633Z","phase":null} -->
## Tool result: call_UIHi7yNtxHhvhNIyNRJDHB21 · 2026-06-14T16:47:08.633Z

```text
Chunk ID: e64143
Wall time: 0.0000 seconds
Process exited with code 1
Original token count: 0
Output:

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"tool-result","timestamp":"2026-06-14T16:47:08.728Z","phase":null} -->
## Tool result: call_qdY8NX1mfyWghYYCCHUFAczi · 2026-06-14T16:47:08.728Z

```text
Chunk ID: ca689a
Wall time: 0.0000 seconds
Process exited with code 0
Original token count: 145
Output:
{
  "route": "runner",
  "claudeBinary": "claude",
  "runnerConfigDir": "/Users/masterman/.runner",
  "runnerBackendUrl": "https://api.runner.now",
  "defaultConnection": {
    "slug": "managed-claude",
    "name": "Claude (Managed by Runner)",
    "providerType": "anthropic",
    "authType": "managed",
    "defaultModel": "runner-morph-router"
  },
  "credential": {
    "hasRefreshToken": true,
    "expiresAtIso": "2026-07-13T17:15:34.000Z"
  },
  "runnerModels": [
    "claude-opus-4-7",
    "claude-opus-4-8",
    "claude-sonnet-4-6",
    "claude-haiku-4-5-20251001"
  ]
}

```

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-06-14T16:47:20.253Z","phase":"final_answer"} -->
## Codex final · 2026-06-14T16:47:20.253Z

Done. I wrote and hardened the plan here:

[docs/superpowers/plans/2026-06-14-visual-improve-mode.md](/Users/masterman/NLP/omniharness/docs/superpowers/plans/2026-06-14-visual-improve-mode.md:1)

It covers the `improve` mode architecture, structured result extraction, card review UI, refinement/promote flows, artifact persistence, SSE/snapshot behavior, lifecycle events, cleanup requirements, tests, and STOP conditions. It preserves the upstream `shadcn/improve` read-only advisor behavior from https://github.com/shadcn/improve.

I retried Baton. It is still blocked because `/Users/masterman/.local/bin/baton --help` fails with `spawn claude ENOENT`; `baton status` works and shows Runner credentials, but `claude` is not on PATH. I used the Codex fallback second-opinion pass, got `READY`, and applied its two polish notes.

Verification: `git diff --check -- docs/superpowers/plans/2026-06-14-visual-improve-mode.md` is clean. The plan file is currently untracked. No branches, worktrees, deletions, commits, or source implementation changes were made.

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-06-14T16:47:20.290Z","phase":null} -->
## Task state: task_complete · 2026-06-14T16:47:20.290Z

```text
{
  "type": "task_complete",
  "turn_id": "019ec701-997b-7ee2-ab4a-60b8e1a473fd",
  "last_agent_message": "Done. I wrote and hardened the plan here:\n\n[docs/superpowers/plans/2026-06-14-visual-improve-mode.md](/Users/masterman/NLP/omniharness/docs/superpowers/plans/2026-06-14-visual-improve-mode.md:1)\n\nIt covers the `improve` mode architecture, structured result extraction, card review UI, refinement/promote flows, artifact persistence, SSE/snapshot behavior, lifecycle events, cleanup requirements, tests, and STOP conditions. It preserves the upstream `shadcn/improve` read-only advisor behavior from https://github.com/shadcn/improve.\n\nI retried Baton. It is still blocked because `/Users/masterman/.local/bin/baton --help` fails with `spawn claude ENOENT`; `baton status` works and shows Runner credentials, but `claude` is not on PATH. I used the Codex fallback second-opinion pass, got `READY`, and applied its two polish notes.\n\nVerification: `git diff --check -- docs/superpowers/plans/2026-06-14-visual-improve-mode.md` is clean. The plan file is currently untracked. No branches, worktrees, deletions, commits, or source implementation changes were made.",
  "completed_at": 1781455640,
  "duration_ms": 408878,
  "time_to_first_token_ms": 3885
}
```

<!-- /codex-event -->
