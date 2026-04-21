# V1 Product Completeness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add explicit usable-v1 completeness behavior to Ultrapowers so agents expand minimal app specs into expected baseline product surfaces and states instead of implementing only literal requested controls.

**Architecture:** Update the core planning skills to require a product-completeness pass for app/product surfaces, add a reusable reference file for familiar archetypes and expected baseline surfaces, and extend verification so UI/product work is checked for end-to-end usability rather than only task completion.

**Tech Stack:** Markdown skill files, Markdown reference docs, shell verification with `rg`

---

## File Structure

- Modify: `ultrapowers/skills/brainstorming/SKILL.md` - add the completeness pass, archetype thinking, edge-state matrix, and explicit distinction between requested scope and baseline expected v1 surfaces.
- Modify: `ultrapowers/skills/writing-plans/SKILL.md` - ensure plans preserve the completeness pass and check with the user before baking in non-obvious additions.
- Modify: `ultrapowers/skills/verification-before-completion/SKILL.md` - add product-level verification for usable-v1 flows and state coverage.
- Modify: `ultrapowers/docs/ultrapowers-defaults.md` - record the new product-completeness default.
- Modify: `ultrapowers/README.md` - mention usable-v1 completeness in the philosophy/defaults.
- Create: `ultrapowers/skills/brainstorming/v1-product-completeness.md` - reusable archetype and checklist reference for brainstorming.

### Task 1: Add Product Completeness To Brainstorming

**Files:**
- Modify: `ultrapowers/skills/brainstorming/SKILL.md`
- Create: `ultrapowers/skills/brainstorming/v1-product-completeness.md`

- [ ] **Step 1: Verify the current gap**

Run:

```bash
rg -n "completeness|archetype|usable v1|empty state|loading|error|recovery|baseline expected" ultrapowers/skills/brainstorming/SKILL.md ultrapowers/skills/brainstorming/v1-product-completeness.md
```

Expected: `brainstorming` has little or no explicit usable-v1 completeness guidance, and the new reference file does not exist yet.

- [ ] **Step 2: Add the brainstorming behavior**

Update `brainstorming/SKILL.md` so it explicitly requires:

```text
- a Product Completeness Pass for app, UI, and product-surface requests
- identifying the product archetype before finalizing the design
- distinguishing:
  - explicitly requested capabilities
  - baseline expected v1 surfaces and states
- covering:
  - primary journey
  - empty/loading/running/waiting/error/completed/recovery states
  - navigation and hierarchy
  - status signaling
  - desktop/mobile adaptation
- asking the user before committing non-obvious additions or opinionated product choices
- optional use of self-brainstorming or additional agents only when explicitly allowed or requested
```

Create `v1-product-completeness.md` with concise sections for familiar archetypes such as:

```text
- AI chat / agent harness
- kanban / workflow board
- document editor
- admin CRUD surface
- dashboard / monitoring surface
```

Each section should list expected baseline v1 surfaces, common states, and the kinds of additions that should still be confirmed with the user.

- [ ] **Step 3: Verify the new brainstorming guidance**

Run:

```bash
rg -n "Product Completeness Pass|baseline expected v1|archetype|empty|loading|running|waiting|error|completed|recovery|confirm with the user" ultrapowers/skills/brainstorming/SKILL.md ultrapowers/skills/brainstorming/v1-product-completeness.md
```

Expected: matches confirm the new completeness behavior and the archetype reference.

### Task 2: Add Plan-Time Guardrails For Non-Obvious Additions

**Files:**
- Modify: `ultrapowers/skills/writing-plans/SKILL.md`
- Modify: `ultrapowers/docs/ultrapowers-defaults.md`
- Modify: `ultrapowers/README.md`

- [ ] **Step 1: Verify the current planning behavior**

Run:

```bash
rg -n "non-obvious|confirm with the user|baseline expected|usable v1|product completeness" ultrapowers/skills/writing-plans/SKILL.md ultrapowers/docs/ultrapowers-defaults.md ultrapowers/README.md
```

Expected: the current files do not yet clearly enforce these rules.

- [ ] **Step 2: Update planning/docs behavior**

Update the files so they explicitly say:

```text
writing-plans:
- preserve the Product Completeness Pass from brainstorming
- include baseline expected v1 surfaces in the plan when they are obvious and conventional
- check with the user before baking in additions that are non-obvious, costly, opinionated, or materially expand scope

ultrapowers-defaults:
- agents should expand familiar product archetypes toward a usable v1
- they should not silently lock in debatable additions without user confirmation

README:
- Ultrapowers aims for usable v1 completeness, not just literal requested controls
```

- [ ] **Step 3: Verify the planning/docs changes**

Run:

```bash
rg -n "usable v1|Product Completeness Pass|baseline expected|confirm with the user|non-obvious|literal requested controls" ultrapowers/skills/writing-plans/SKILL.md ultrapowers/docs/ultrapowers-defaults.md ultrapowers/README.md
```

Expected: matches confirm the new planning and documentation stance.

### Task 3: Add Product-Level Completion Verification

**Files:**
- Modify: `ultrapowers/skills/verification-before-completion/SKILL.md`

- [ ] **Step 1: Verify the current verification gap**

Run:

```bash
rg -n "usable v1|primary journey|empty state|loading state|error state|recovery|end-to-end|product surface" ultrapowers/skills/verification-before-completion/SKILL.md
```

Expected: little or no product-level usability verification language exists.

- [ ] **Step 2: Update verification behavior**

Add a section that requires, for app/UI/product-surface work:

```text
- verifying the primary user journey end-to-end
- checking expected empty/loading/error/completed/recovery states
- confirming that baseline expected v1 surfaces from the spec/plan are present
- distinguishing "requested feature works" from "the product is usable"
```

- [ ] **Step 3: Verify the new completion gate**

Run:

```bash
rg -n "primary user journey|usable|empty state|loading state|error state|completed state|recovery state|product is usable" ultrapowers/skills/verification-before-completion/SKILL.md
```

Expected: matches confirm the new product-level gate.

- [ ] **Step 4: Review final diff**

Run:

```bash
git diff -- ultrapowers/README.md ultrapowers/docs/ultrapowers-defaults.md ultrapowers/skills/brainstorming/SKILL.md ultrapowers/skills/brainstorming/v1-product-completeness.md ultrapowers/skills/writing-plans/SKILL.md ultrapowers/skills/verification-before-completion/SKILL.md docs/superpowers/plans/2026-04-21-v1-product-completeness.md
```

Expected: the diff shows a coherent usable-v1 completeness upgrade without unrelated changes.
