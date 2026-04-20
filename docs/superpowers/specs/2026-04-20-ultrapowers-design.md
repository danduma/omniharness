# Ultrapowers Design

## Summary

`ultrapowers` will be a reusable, opinionated fork of `obra/superpowers` vendored directly into this repository as a plain editable folder. We will clone the upstream repository once into `ultrapowers/`, then treat that directory as our own product and reorganize it freely.

The fork will shift the default posture of the skill system in four major ways:

1. It will favor lightweight local iteration over workflow-heavy defaults such as worktrees and branch creation.
2. It will incorporate user stories into planning and specification habits where they clarify behavior, outcomes, and acceptance criteria.
3. It will make frontend implementation opinionated by default, preferring `shadcn/ui`, starting UI work from ShadCN Blocks, and treating desktop and mobile responsiveness as first-class from the beginning.
4. It will explicitly avoid file-based routing by default unless the user requests it or the chosen framework genuinely requires it.

## Goals

- Create a general-purpose fork that can be reused outside this repository later.
- Preserve enough of upstream's useful process structure to accelerate adoption.
- Rewrite defaults so the system feels lighter, more product-oriented, and more opinionated.
- Make UI and app-building guidance consistent across skills.
- Keep the fork easy to edit directly without carrying long-term upstream synchronization machinery.

## Non-Goals

- Maintaining a clean patch series against upstream.
- Preserving upstream directory structure or wording where it gets in the way.
- Building a minimal curated subset before understanding the full upstream system.
- Enforcing a single frontend framework across every project.

## Proposed Structure

We will create a top-level `ultrapowers/` directory by cloning `https://github.com/obra/superpowers` into the current repository. After the initial import, that directory becomes the source of truth for our customized skill system.

The structure may be reorganized after import to better match our defaults. At a minimum, the fork should clearly separate:

- core process skills,
- implementation skills,
- references and conventions,
- reusable templates and examples,
- product-facing docs that explain the opinionated defaults.

We should not preserve a parallel `upstream/` mirror inside this repository. If we need to reference upstream later, we can use git history or re-check the remote repository independently.

## Default Product Principles

### Workflow Defaults

The system should not push worktrees or branch creation as the default answer to ordinary implementation tasks. Those techniques remain available, but only as opt-in tools for isolation, coordination, or risk management.

The default assumption should be:

- work in the current repository unless the user asks otherwise,
- avoid creating branches unless the user explicitly requests it,
- prefer the smallest workflow that safely accomplishes the task.

### User Stories

Planning-oriented skills should encourage the use of user stories when they clarify intent. The preferred pattern is concise and practical:

- user story,
- outcome or value,
- acceptance criteria when needed.

This should be strongest in brainstorming, spec writing, and planning flows. User stories should support implementation clarity, not become ceremony for trivial tasks.

### UI Defaults

Unless the user says otherwise, UI work should assume `shadcn/ui` as the starting design system. The first step for app UI should be choosing an appropriate ShadCN Block or starting pattern before inventing a layout from scratch.

The default frontend guidance should also state that:

- desktop and mobile both matter from the beginning,
- responsiveness is part of the initial implementation, not a polish pass,
- design choices should be opinionated and intentional rather than generic.

### Routing Defaults

The system should explicitly avoid file-based routing by default. Skills that discuss app architecture should prefer explicit routing approaches unless:

- the user asks for file-based routing,
- the stack has unavoidable framework constraints,
- the current codebase already depends on that pattern and consistency matters more than default preference.

## Skill System Changes

### Process Skills

Process skills should be rewritten to reduce unnecessary ceremony while keeping strong thinking discipline. In particular:

- `using-superpowers` should reflect the new defaults and point to `ultrapowers` conventions.
- brainstorming and planning skills should include user stories as a normal part of defining work.
- worktree and branch guidance should be reframed as optional escalation paths rather than baseline setup.

### Implementation Skills

Implementation-oriented skills should adopt shared frontend defaults and shared architecture preferences. This includes:

- `shadcn/ui` as the default component system when building UI,
- choosing a ShadCN Block first for app UIs,
- responsive desktop/mobile support as a requirement from the start,
- no file-based routing by default.

### Reference Material

We should add or rewrite supporting documentation that explains:

- what makes `ultrapowers` different from upstream,
- the standard default stack assumptions,
- when to override defaults,
- examples of user-story-driven specs and plans,
- examples of frontend starts using ShadCN Blocks.

## Migration Strategy

Implementation should happen in phases:

1. Import upstream into `ultrapowers/`.
2. Audit the imported skill set and identify files that define global defaults, workflow posture, planning behavior, and frontend behavior.
3. Rewrite the core process skills first so the system's default behavior changes early.
4. Rewrite implementation and frontend-related skills next so product-building guidance becomes consistent.
5. Add new docs, examples, and templates for user stories, ShadCN Block starts, responsiveness, and explicit routing.
6. Do a final pass for naming, cross-links, and contradictory instructions.

## Testing And Validation

Validation should focus on instruction quality rather than application runtime. We should verify:

- the rewritten skills no longer recommend worktrees or branches by default,
- planning skills visibly incorporate user stories,
- frontend skills clearly default to `shadcn/ui` and ShadCN Blocks,
- responsiveness is called out as an up-front requirement,
- routing guidance no longer defaults to file-based routing,
- cross-references between skills remain accurate after reorganization.

Practical validation can include targeted text searches, sample prompt walkthroughs, and a small set of example tasks to confirm the desired behavior appears in the generated guidance.

## Risks

- Upstream assumptions may be spread across many files, making the first rewrite pass broader than expected.
- Reorganizing too early without an inventory could make it harder to find inherited behaviors.
- Strong opinionated defaults may conflict with some downstream projects, so override rules must be clear.
- If frontend defaults are repeated inconsistently across many skills, drift will appear quickly.

## Recommendation

Proceed with a plain in-repo clone into `ultrapowers/`, then perform a focused rewrite of the most central skills and references first. Treat `ultrapowers` as its own opinionated system immediately after import, with special emphasis on:

- lighter workflow defaults,
- user-story-aware planning,
- `shadcn/ui` plus ShadCN Blocks for UI starts,
- responsive desktop/mobile design from the beginning,
- no file-based routing by default.
