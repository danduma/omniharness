# PM Pass And North Star Planning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an explicit PM pass to Ultrapowers that aggressively discovers supporting jobs, state model, operational readiness, observability, onboarding, and trust surfaces, then preserve that full product vision through north-star and milestone planning.

**Architecture:** Update brainstorming so PM thinking happens before the completeness pass, add a reusable PM reference doc, update story-derived reasoning to incorporate PM outputs, change writing-plans so it preserves north-star product vision alongside the current milestone, and extend verification to cover state/ops/observability/onboarding/trust checks.

**Tech Stack:** Markdown skill files, Markdown reference docs, shell verification with `rg`

---

## File Structure

- Modify: `ultrapowers/skills/brainstorming/SKILL.md`
- Create: `ultrapowers/skills/brainstorming/pm-pass.md`
- Modify: `ultrapowers/skills/brainstorming/story-derived-completeness.md`
- Modify: `ultrapowers/skills/writing-plans/SKILL.md`
- Modify: `ultrapowers/skills/verification-before-completion/SKILL.md`
- Modify: `ultrapowers/docs/ultrapowers-defaults.md`
- Modify: `ultrapowers/README.md`

### Task 1: Add PM Pass To Brainstorming

**Files:**
- Modify: `ultrapowers/skills/brainstorming/SKILL.md`
- Create: `ultrapowers/skills/brainstorming/pm-pass.md`
- Modify: `ultrapowers/skills/brainstorming/story-derived-completeness.md`

- [ ] **Step 1: Verify the current gap**

Run:

```bash
rg -n "PM pass|supporting jobs|state model|operational readiness|observability|onboarding|trust|north star|milestone" ultrapowers/skills/brainstorming/SKILL.md ultrapowers/skills/brainstorming/story-derived-completeness.md ultrapowers/skills/brainstorming/pm-pass.md
```

Expected: the current skill set does not yet have a dedicated PM pass or north-star framing.

- [ ] **Step 2: Add the PM pass**

Update `brainstorming/SKILL.md` so it explicitly requires:

```text
- a PM Pass before the Product Completeness Pass for app/product-surface requests
- defaulting the first user to the human builder unless the prompt says otherwise
- assuming the core job is usually already implied by the prompt
- aggressively discovering supporting jobs
- defining:
  - state model
  - operational readiness expectations
  - instrumentation and observability expectations
  - onboarding and discoverability expectations
  - risk and trust surfaces
- defining the north-star product separately from the current milestone
- treating milestone slicing as sequencing, not product amnesia
```

Create `pm-pass.md` with a concrete PM checklist and output format.

Update `story-derived-completeness.md` so it says story derivation should use the PM pass outputs as inputs rather than starting from nowhere.

- [ ] **Step 3: Verify the PM pass landed**

Run:

```bash
rg -n "PM Pass|supporting jobs|state model|operational readiness|instrumentation|observability|onboarding|trust|north-star|current milestone|product amnesia" ultrapowers/skills/brainstorming/SKILL.md ultrapowers/skills/brainstorming/pm-pass.md ultrapowers/skills/brainstorming/story-derived-completeness.md
```

Expected: matches confirm the PM pass is now a first-class part of brainstorming.

### Task 2: Preserve North Star And Milestone In Planning

**Files:**
- Modify: `ultrapowers/skills/writing-plans/SKILL.md`
- Modify: `ultrapowers/docs/ultrapowers-defaults.md`
- Modify: `ultrapowers/README.md`

- [ ] **Step 1: Verify the current planning/docs wording**

Run:

```bash
rg -n "North Star|current milestone|later milestones|supporting jobs|state model|observability|trust" ultrapowers/skills/writing-plans/SKILL.md ultrapowers/docs/ultrapowers-defaults.md ultrapowers/README.md
```

Expected: these concepts are not yet clearly preserved in planning/docs.

- [ ] **Step 2: Update planning/docs behavior**

Update the files so they explicitly say:

```text
writing-plans:
- preserve the approved north-star product vision
- preserve the current milestone as one slice of that vision
- preserve explicit deferred-but-intentional work
- require plan sections or equivalent treatment for:
  - North Star Product
  - Current Milestone
  - Later Milestones or deferred work
  - required supporting jobs in this milestone
  - state/trust/ops/observability requirements when relevant

ultrapowers-defaults:
- agents should expand product thinking aggressively
- milestone slicing is for delivery sequencing, not limiting imagination

README:
- Ultrapowers aims for ambitious product thinking, then stages delivery without forgetting the larger product
```

- [ ] **Step 3: Verify the planning/docs rewrite**

Run:

```bash
rg -n "North Star Product|Current Milestone|Later Milestones|deferred|supporting jobs|state model|operational readiness|observability|trust" ultrapowers/skills/writing-plans/SKILL.md ultrapowers/docs/ultrapowers-defaults.md ultrapowers/README.md
```

Expected: matches confirm the north-star-versus-milestone model is now explicit.

### Task 3: Add PM-Level Verification

**Files:**
- Modify: `ultrapowers/skills/verification-before-completion/SKILL.md`

- [ ] **Step 1: Verify the current verification gap**

Run:

```bash
rg -n "state model|operational readiness|instrumentation|observability|onboarding|discoverability|trust|risk surfaces" ultrapowers/skills/verification-before-completion/SKILL.md
```

Expected: the current verification skill does not yet cover all PM-level must-haves.

- [ ] **Step 2: Update verification**

Add wording that requires, when relevant:

```text
- checking that the state model is represented correctly
- checking operational readiness and recovery behavior
- checking instrumentation or observable signals for key flows/failures
- checking onboarding/discoverability for first-time or empty-state use
- checking risk/trust surfaces such as silent failure, ambiguous state, destructive behavior, or loss of user confidence
```

- [ ] **Step 3: Verify the PM-level completion gate**

Run:

```bash
rg -n "state model|operational readiness|instrumentation|observability|onboarding|discoverability|trust|silent failure|ambiguous state" ultrapowers/skills/verification-before-completion/SKILL.md
```

Expected: matches confirm the new PM-level completion gate.

- [ ] **Step 4: Review the final diff**

Run:

```bash
git diff -- ultrapowers/README.md ultrapowers/docs/ultrapowers-defaults.md ultrapowers/skills/brainstorming/SKILL.md ultrapowers/skills/brainstorming/pm-pass.md ultrapowers/skills/brainstorming/story-derived-completeness.md ultrapowers/skills/writing-plans/SKILL.md ultrapowers/skills/verification-before-completion/SKILL.md docs/superpowers/plans/2026-04-21-pm-pass-north-star.md
```

Expected: diff shows a coherent PM-style upgrade, not just isolated wording tweaks.
