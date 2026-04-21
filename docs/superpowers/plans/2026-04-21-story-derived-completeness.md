# Story-Derived Completeness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Ultrapowers derive usable-v1 completeness primarily from user stories and user journeys, using hard-coded archetype references only as a sanity check instead of the main mechanism.

**Architecture:** Rewrite brainstorming so the completeness pass starts from story generation and journey analysis, add a reusable reference for story-derived interface inference, demote archetype references to a fallback/checklist role, and update planning/verification/docs so the same logic survives into implementation and completion.

**Tech Stack:** Markdown skill files, Markdown reference docs, shell verification with `rg`

---

## File Structure

- Modify: `ultrapowers/skills/brainstorming/SKILL.md` - make story-derived completeness the primary mechanism.
- Modify: `ultrapowers/skills/brainstorming/v1-product-completeness.md` - reposition archetypes as sanity checks and examples rather than the main driver.
- Create: `ultrapowers/skills/brainstorming/story-derived-completeness.md` - document the story-to-interface workflow.
- Modify: `ultrapowers/skills/writing-plans/SKILL.md` - preserve story-derived baseline behaviors and confirm debatable additions with the user.
- Modify: `ultrapowers/skills/verification-before-completion/SKILL.md` - verify user-story coverage and journey/state completeness.
- Modify: `ultrapowers/docs/ultrapowers-defaults.md` - document the new default explicitly.
- Modify: `ultrapowers/README.md` - describe the philosophy in user-story terms.

### Task 1: Make Brainstorming Story-First

**Files:**
- Modify: `ultrapowers/skills/brainstorming/SKILL.md`
- Create: `ultrapowers/skills/brainstorming/story-derived-completeness.md`
- Modify: `ultrapowers/skills/brainstorming/v1-product-completeness.md`

- [ ] **Step 1: Verify the current wording still leans on archetypes**

Run:

```bash
rg -n "archetype|baseline expected v1|reference|story|journey|derive" ultrapowers/skills/brainstorming/SKILL.md ultrapowers/skills/brainstorming/v1-product-completeness.md
```

Expected: archetype language is present, but story-derived completeness is not yet the clear primary mechanism.

- [ ] **Step 2: Rewrite brainstorming and add the new reference**

Update `brainstorming/SKILL.md` so it explicitly requires:

```text
- derive primary, return/revisit, failure/recovery, status-awareness, and mutation stories
- infer missing interface surfaces and system behaviors from those stories
- treat archetype references as a fallback sanity check, not the primary source of truth
- keep obvious inferred additions as baseline expected v1 scope
- confirm debatable or expensive additions with the user before locking them into the spec
- allow self-brainstorming by default, but use additional agents only when the user allows or requests delegated brainstorming
```

Create `story-derived-completeness.md` with:

```text
- how to generate useful user stories from a sparse prompt
- categories of stories to derive
- how to map stories to interface affordances and system behaviors
- how to separate obvious additions from debatable ones
- how to use archetype references only as a completeness backstop
```

Update `v1-product-completeness.md` so its framing clearly says it is:

```text
- a sanity check and prior
- not a replacement for story-derived reasoning
```

- [ ] **Step 3: Verify the new story-first behavior**

Run:

```bash
rg -n "story-derived|primary story|failure/recovery|status-awareness|mutation|infer|sanity check|not the primary source of truth" ultrapowers/skills/brainstorming/SKILL.md ultrapowers/skills/brainstorming/story-derived-completeness.md ultrapowers/skills/brainstorming/v1-product-completeness.md
```

Expected: matches confirm that story-derived completeness is now primary and archetypes are secondary.

### Task 2: Carry Story-Derived Completeness Into Planning

**Files:**
- Modify: `ultrapowers/skills/writing-plans/SKILL.md`
- Modify: `ultrapowers/docs/ultrapowers-defaults.md`
- Modify: `ultrapowers/README.md`

- [ ] **Step 1: Verify the current plan/docs wording**

Run:

```bash
rg -n "story|journey|derive|infer|baseline expected|sanity check|literal" ultrapowers/skills/writing-plans/SKILL.md ultrapowers/docs/ultrapowers-defaults.md ultrapowers/README.md
```

Expected: some completeness language exists, but not yet clearly story-first.

- [ ] **Step 2: Update the planning/docs behavior**

Update the files so they explicitly say:

```text
writing-plans:
- preserve story-derived baseline behaviors from brainstorming
- ensure tasks exist for the primary journey, return/revisit path, failure/recovery path, and status visibility when relevant
- check with the user before baking in additions that are not obvious from the derived stories

ultrapowers-defaults:
- usable-v1 completeness comes primarily from user stories and journeys
- archetype references are a secondary backstop

README:
- Ultrapowers infers expected product surfaces from what users need to do, not just from literal prompts
```

- [ ] **Step 3: Verify the planning/docs rewrite**

Run:

```bash
rg -n "user stories and journeys|derive|infer|return/revisit|failure/recovery|status visibility|secondary backstop|literal prompts" ultrapowers/skills/writing-plans/SKILL.md ultrapowers/docs/ultrapowers-defaults.md ultrapowers/README.md
```

Expected: matches confirm the new story-first stance.

### Task 3: Add Story Coverage To Completion Verification

**Files:**
- Modify: `ultrapowers/skills/verification-before-completion/SKILL.md`

- [ ] **Step 1: Verify the current verification wording**

Run:

```bash
rg -n "story|journey|revisit|failure/recovery|status visibility|derived" ultrapowers/skills/verification-before-completion/SKILL.md
```

Expected: product-level verification exists, but story-coverage language is still thin.

- [ ] **Step 2: Update verification**

Add wording that requires, when relevant:

```text
- checking that the primary user stories are actually supported
- verifying return/revisit flows
- verifying failure/recovery flows
- verifying status-awareness flows
- checking that inferred baseline behaviors from the approved story set are present
```

- [ ] **Step 3: Verify the new completion gate**

Run:

```bash
rg -n "primary user stories|return/revisit|failure/recovery|status-awareness|inferred baseline behaviors|approved story set" ultrapowers/skills/verification-before-completion/SKILL.md
```

Expected: matches confirm the new story-coverage completion gate.

- [ ] **Step 4: Review the final diff**

Run:

```bash
git diff -- ultrapowers/README.md ultrapowers/docs/ultrapowers-defaults.md ultrapowers/skills/brainstorming/SKILL.md ultrapowers/skills/brainstorming/story-derived-completeness.md ultrapowers/skills/brainstorming/v1-product-completeness.md ultrapowers/skills/writing-plans/SKILL.md ultrapowers/skills/verification-before-completion/SKILL.md docs/superpowers/plans/2026-04-21-story-derived-completeness.md
```

Expected: diff shows a coherent shift from archetype-first completeness to story-derived completeness.
