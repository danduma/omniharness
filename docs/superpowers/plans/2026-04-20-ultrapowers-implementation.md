# Ultrapowers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import `obra/superpowers` into `ultrapowers/` and rewrite its defaults so the fork becomes a reusable opinionated system with lighter workflow defaults, user-story-aware planning, `shadcn/ui` + ShadCN Blocks UI guidance, responsive desktop/mobile expectations, and no file-based routing by default.

**Architecture:** Keep the imported repo structure intact for the first pass, but rewrite the highest-leverage instructions first: README and platform docs, then the core workflow skills, then execution and supporting references. Validate the rewrite with targeted text searches to ensure old worktree/branch defaults and missing UI/routing defaults do not survive in key surfaces.

**Tech Stack:** Markdown skill files, repository docs, shell validation with `rg`, git

---

## File Structure

- Modify: `ultrapowers/README.md` - rebrand to Ultrapowers and rewrite the headline workflow/defaults.
- Modify: `ultrapowers/CLAUDE.md` - replace upstream PR-contribution policy with local fork guidance.
- Modify: `ultrapowers/GEMINI.md` - keep bootstrap imports aligned if any naming or path guidance changes.
- Modify: `ultrapowers/package.json` - rename the package metadata for the fork.
- Modify: `ultrapowers/skills/using-superpowers/SKILL.md` - encode the new default philosophy and instruction priority examples.
- Modify: `ultrapowers/skills/brainstorming/SKILL.md` - add user stories and opinionated frontend/routing defaults to the design workflow.
- Modify: `ultrapowers/skills/writing-plans/SKILL.md` - remove worktree assumptions and add user-story-aware planning/front-end defaults where relevant.
- Modify: `ultrapowers/skills/executing-plans/SKILL.md` - remove hard worktree requirement and adapt completion behavior to in-place repo work.
- Modify: `ultrapowers/skills/using-git-worktrees/SKILL.md` - demote from default workflow to optional isolation tool.
- Modify: `ultrapowers/skills/finishing-a-development-branch/SKILL.md` - adapt branch/worktree completion flow so it is optional and not assumed.
- Modify: `ultrapowers/skills/subagent-driven-development/SKILL.md` - remove mandatory worktree setup and main-branch warnings that conflict with user instructions.
- Modify: `ultrapowers/skills/test-driven-development/SKILL.md` - add UI-specific test-first guidance if needed without changing the core TDD posture.
- Modify: `ultrapowers/skills/using-superpowers/references/codex-tools.md` - remove worktree-centric Codex guidance.
- Modify: `ultrapowers/docs/README.codex.md` and `ultrapowers/docs/README.opencode.md` - align install/use docs with Ultrapowers naming and defaults.
- Create: `ultrapowers/docs/ultrapowers-defaults.md` - single source of truth for the fork’s opinionated defaults.

### Task 1: Rebrand And Document The Fork

**Files:**
- Modify: `ultrapowers/README.md`
- Modify: `ultrapowers/CLAUDE.md`
- Modify: `ultrapowers/GEMINI.md`
- Modify: `ultrapowers/package.json`
- Modify: `ultrapowers/docs/README.codex.md`
- Modify: `ultrapowers/docs/README.opencode.md`
- Create: `ultrapowers/docs/ultrapowers-defaults.md`

- [ ] **Step 1: Write the failing documentation checks**

Run:

```bash
rg -n "Superpowers|using-git-worktrees|Parallel development branches|Create a branch for your work|Switch to the 'dev' branch" ultrapowers/README.md ultrapowers/CLAUDE.md ultrapowers/package.json ultrapowers/docs/README.codex.md ultrapowers/docs/README.opencode.md
```

Expected: matches show upstream naming and branch/worktree defaults still present.

- [ ] **Step 2: Rewrite the public docs and metadata**

Update the files so they reflect these concrete outcomes:

```text
- README title and narrative say "Ultrapowers"
- Basic workflow no longer requires using-git-worktrees between brainstorming and planning
- README philosophy/defaults mention user stories, shadcn/ui, ShadCN Blocks, responsive desktop/mobile design, and no file-based routing by default
- CLAUDE.md becomes local fork guidance instead of upstream PR rejection policy
- package.json name becomes "ultrapowers"
- docs/README.codex.md and docs/README.opencode.md use Ultrapowers naming
- docs/ultrapowers-defaults.md documents:
  - work in the current repo by default
  - do not create branches unless the user explicitly asks
  - use user stories in specs/plans when helpful
  - default UI stack is shadcn/ui
  - choose a ShadCN Block first for app UI
  - design for desktop and mobile from the start
  - avoid file-based routing by default
```

- [ ] **Step 3: Run checks to verify the rewrite landed**

Run:

```bash
rg -n "Ultrapowers|user stor|shadcn/ui|ShadCN Block|desktop and mobile|file-based routing" ultrapowers/README.md ultrapowers/docs/ultrapowers-defaults.md ultrapowers/docs/README.codex.md ultrapowers/docs/README.opencode.md
```

Expected: matches for all new defaults.

Run:

```bash
rg -n "Switch to the 'dev' branch|Create a branch for your work|using-git-worktrees - Activates after design approval" ultrapowers/README.md ultrapowers/CLAUDE.md ultrapowers/docs/README.codex.md ultrapowers/docs/README.opencode.md
```

Expected: no matches.

### Task 2: Rewrite Core Workflow Skills

**Files:**
- Modify: `ultrapowers/skills/using-superpowers/SKILL.md`
- Modify: `ultrapowers/skills/brainstorming/SKILL.md`
- Modify: `ultrapowers/skills/writing-plans/SKILL.md`

- [ ] **Step 1: Write the failing skill-default checks**

Run:

```bash
rg -n "worktree|branch|user stor|ShadCN|file-based routing|current repository" ultrapowers/skills/using-superpowers/SKILL.md ultrapowers/skills/brainstorming/SKILL.md ultrapowers/skills/writing-plans/SKILL.md
```

Expected: worktree/branch assumptions are present, while user stories and UI/routing defaults are missing or incomplete.

- [ ] **Step 2: Rewrite the core skill content**

Apply these concrete changes:

```text
using-superpowers:
- keep the "skills first" rule
- explicitly state that user instructions can disable branch/worktree/TDD defaults
- add examples that default work happens in the current repo
- add a short section pointing to Ultrapowers default product choices

brainstorming:
- add user stories to the design/spec workflow
- mention that app/UI brainstorming defaults to shadcn/ui and starts by choosing a ShadCN Block
- require desktop and mobile responsiveness as an early design concern
- explicitly say do not default to file-based routing

writing-plans:
- remove "dedicated worktree" context requirement
- replace worktree assumptions with current-repo-by-default language
- ensure plan guidance mentions user stories where behavior needs clarification
- mention frontend plans should preserve shadcn/ui, block-first starts, responsiveness, and explicit routing defaults unless the user overrides them
```

- [ ] **Step 3: Run checks to verify the new defaults**

Run:

```bash
rg -n "current repo|current repository|user stor|shadcn/ui|ShadCN Block|desktop and mobile|responsive|file-based routing" ultrapowers/skills/using-superpowers/SKILL.md ultrapowers/skills/brainstorming/SKILL.md ultrapowers/skills/writing-plans/SKILL.md
```

Expected: matches show all new defaults in the three core skills.

Run:

```bash
rg -n "This should be run in a dedicated worktree|created by brainstorming skill|using-git-worktrees" ultrapowers/skills/writing-plans/SKILL.md ultrapowers/skills/brainstorming/SKILL.md ultrapowers/skills/using-superpowers/SKILL.md
```

Expected: no matches.

### Task 3: Rewrite Execution Skills And References

**Files:**
- Modify: `ultrapowers/skills/executing-plans/SKILL.md`
- Modify: `ultrapowers/skills/using-git-worktrees/SKILL.md`
- Modify: `ultrapowers/skills/finishing-a-development-branch/SKILL.md`
- Modify: `ultrapowers/skills/subagent-driven-development/SKILL.md`
- Modify: `ultrapowers/skills/test-driven-development/SKILL.md`
- Modify: `ultrapowers/skills/using-superpowers/references/codex-tools.md`

- [ ] **Step 1: Write the failing execution-skill checks**

Run:

```bash
rg -n "REQUIRED: Set up isolated workspace|Never start implementation on main/master branch|using-git-worktrees|worktree|branch|file-based routing|shadcn/ui|ShadCN Block" ultrapowers/skills/executing-plans/SKILL.md ultrapowers/skills/using-git-worktrees/SKILL.md ultrapowers/skills/finishing-a-development-branch/SKILL.md ultrapowers/skills/subagent-driven-development/SKILL.md ultrapowers/skills/test-driven-development/SKILL.md ultrapowers/skills/using-superpowers/references/codex-tools.md
```

Expected: matches show hard worktree/branch assumptions and missing frontend defaults.

- [ ] **Step 2: Rewrite execution/supporting guidance**

Apply these concrete changes:

```text
executing-plans:
- execute in the current repo unless the user asked for isolation
- remove mandatory using-git-worktrees integration
- finish with generic completion guidance, not branch-only framing

using-git-worktrees:
- reposition as optional
- say never create a worktree unless the user asks or there is a clear need for isolation
- keep safety guidance for the cases where it is actually used

finishing-a-development-branch:
- make it usable only when branch-based work actually exists
- add language for finishing work done directly in the current branch/repo

subagent-driven-development:
- remove hard prohibition on working on main/master when the user explicitly wants in-place work
- remove required using-git-worktrees integration

test-driven-development:
- preserve core TDD rules
- add a small note that UI work should choose a block/system first before implementing tests around it when relevant

codex-tools reference:
- delete or rewrite worktree-centric sections so they no longer describe branch/worktree setup as standard behavior
```

- [ ] **Step 3: Run verification searches across the fork**

Run:

```bash
rg -n "user stor|shadcn/ui|ShadCN Block|desktop and mobile|responsive|file-based routing" ultrapowers/README.md ultrapowers/docs/ultrapowers-defaults.md ultrapowers/skills
```

Expected: the new opinionated defaults appear across docs and core skills.

Run:

```bash
rg -n "REQUIRED: Set up isolated workspace|This should be run in a dedicated worktree|Activates after design approval. Creates isolated workspace|Never start implementation on main/master branch without explicit user consent" ultrapowers/README.md ultrapowers/skills ultrapowers/docs
```

Expected: no matches.

- [ ] **Step 4: Review final changed files**

Run:

```bash
git diff -- ultrapowers/README.md ultrapowers/CLAUDE.md ultrapowers/GEMINI.md ultrapowers/package.json ultrapowers/docs ultrapowers/skills
```

Expected: diff shows a coherent Ultrapowers fork with consistent defaults and no accidental edits outside the fork.
