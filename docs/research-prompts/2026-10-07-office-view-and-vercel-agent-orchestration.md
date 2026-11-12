# Research prompt: Agent Office view + Vercel agent / Codex↔Claude cross-review

Paste everything below the line into a fresh agent session (Claude Code or Codex) working in the OmniHarness repo.

---

## Role and goal

You are a senior product engineer and researcher working in the OmniHarness repository (`D:\Codex\omniharness-git`). Read `agents.md` first and obey it (no branches, no worktrees unless asked, no deleting files, run `pnpm build:interface:web` after UI changes, persist worker content only via `appendWorkerEntry`).

Produce a **research report + recommended implementation plan** for two features. Do **not** implement anything yet. Save the report to `docs/superpowers/plans/2026-10-07-office-view-and-vercel-orchestration-research.md` and link it in your final reply.

## Feature A: "Agent Office" 2D view

A 2D top-down or isometric office where each running agent/worker is an avatar at a desk, plus **one main avatar** (the supervisor) the user talks to. Animations must make agent state legible without reading logs: researching, writing code, running tests, waiting on user input, blocked or stuck, handing off to another agent, reviewing another agent's work, done, errored.

Research questions:
1. **Prior art.** How do current agent UIs present multi-agent activity (OpenAI, xAI/Grok, Meta/Muse-style assistants, Claude Code agent teams, Cursor/Devin-style dashboards, "AI town"/Smallville-style sims, Herdr's status board)? Extract the interaction patterns that work: ambient status, speech bubbles, hand-off animations, notification model, click-to-focus. Cite sources and date them; flag anything unverified.
2. **State mapping.** Inspect how OmniHarness already models run/worker state (`runs`, `workers`, `messages`, `execution_events`, the worker JSONL stream, SSE endpoints, `docs/architecture/lifecycle-observability-and-testing.md`, `docs/architecture/worker-conversation-stream.md`). Produce a table mapping each existing event/state to an avatar animation. Identify gaps where there is no event to drive an animation, and propose new events that follow the lifecycle-observability rules.
3. **Rendering tech.** Compare PixiJS, Phaser, Konva, Canvas2D, SVG/CSS+Lottie/Rive, and a plain React + CSS sprite approach against: bundle size, fit with the existing Vite/React interface (`apps/interface`), mobile/Capacitor performance (`apps/mobile`), Electron (`apps/electron`), accessibility (reduced-motion, screen-reader text equivalent), and testability with Playwright.
4. **Art pipeline.** Options for avatars and office tiles: free/CC0 packs, generated sprite sheets, procedural pixel avatars with deterministic seed per agent. Include licensing risks.
5. **Interaction design.** The main avatar as chat entry point: how does the existing composer, attachments and plan-review flow attach to it? How are many agents (5, 20, 50) displayed without clutter? Define a fallback to the current list/terminal view.
6. **Performance and cost.** Event-rate throttling, offscreen pausing, idle-animation budget, battery on mobile.

Deliverable for A: recommended stack, state→animation table, component/module boundaries (paths in this repo), event schema additions, risks, and a phased MVP (smallest shippable slice first).

## Feature B: Vercel-hosted agent as a fast "decision layer" + Codex↔Claude cross-review

Intent: the user will generate an agent/API key in their **Vercel account** and wire it into OmniHarness so a cheap, fast model can handle categorization, triage, routing, summarization and decision-taking, which speeds up the whole pipeline. Separately, **Codex and Claude are both connected and each reviews the other's work**.

Note on ambiguity: the user wrote "jev agent". Treat it as a Vercel-hosted agent reachable by API key (most likely Vercel AI Gateway, the AI SDK, or a Vercel-deployed agent endpoint). Confirm what exists in Vercel's current docs and state your interpretation explicitly. If it is still unclear, list the candidate interpretations and ask the user one concise question at the end of the report rather than guessing.

Research questions:
1. **What Vercel offers today** for keyed agent/model access (AI Gateway, AI SDK, Workflow/agents, Sandbox, etc.): auth model, key scoping and rotation, rate limits, pricing, model routing/fallbacks, observability, data retention. Use current official docs only.
2. **Where a cheap decision model pays off in OmniHarness.** Audit the codebase for decisions currently made by a heavy model or by hand: run/worker routing, message classification, plan triage, stuck-prompt detection (see recent commit "recover stuck agent prompts"), summarizing worker streams, naming/tagging conversations, validation pass/fail. For each, estimate frequency, latency sensitivity, and risk if the cheap model is wrong. Rank by value and propose guardrails (confidence threshold, escalate to a stronger model, never auto-approve destructive actions).
3. **Secure key handling.** Where the key lives (env, OS keychain, Electron safeStorage, never in `sqlite.db`, never in worker JSONL/logs, never sent to mobile clients), redaction in the event stream, per-provider settings UI, and failure behavior when the key is missing or rate-limited.
4. **Cross-review loop (Codex ↔ Claude).** Design a protocol: who implements, who reviews, how the diff and context are handed over, structured verdicts (approve / request-changes / blockers with file:line), loop limits and tie-breaking, how disagreements surface to the user, and how to avoid both models rubber-stamping each other. Reuse what OmniHarness already has for workers/plan-review; identify what is missing.
5. **Model-role routing and usage balancing.** Ideas from the setup below: planning model, orchestration model, cheap subagent model, automatic fallback to whichever provider has unused quota, local model for compacting old sessions once the provider cache is cold, remote compaction only while the cache is warm.
6. **Evaluation.** How to measure that the decision layer actually accelerates work: latency, tokens/cost, escalation rate, wrong-decision rate. Propose a small offline eval set built from real past runs in `sqlite.db`.

Deliverable for B: architecture diagram (text/mermaid), provider-adapter interface, settings and secrets design, decision-point catalogue with guardrails, cross-review protocol, rollout plan with a kill-switch, and a cost estimate.

## Workflow ideas to evaluate (from a practitioner's setup)

Assess each for fit with OmniHarness, and say adopt / adapt / skip with reasons:
- **OMP (omp.sh)**: multi-provider CLI harness; model roles (planning vs orchestration vs subagents), usage balancing across providers, local conversation compaction, parallel skills chained as one workflow, local memory extraction and "time travel" rollback with a summary of what went wrong.
- **Herdr (herdr.dev)**: agent-centric terminal multiplexer; remote agent workboxes; one pane showing agents across servers as working / stuck / done / waiting for input. Strong inspiration for Feature A's status vocabulary.
- **OpenSpec (openspec.dev)**: explore, then strict spec first, then implement; combine with a "grill me" style skill to surface wrong assumptions and ambiguities before coding. Slower and token-heavy but valuable for large work.
- **GitHub stacked PRs (gh.io/stacks)**: split big agent output into small, intent-based, individually reviewed PRs merged as a stack. Note: `agents.md` forbids creating branches, so evaluate how this could work within that rule or whether it needs an explicit user exception.
- **Plannotator (plannotator.ai)**: guided code/spec review where a small model analyzes the diff first and builds an interactive review path (where to look, what deserves attention, what looks risky). Candidate for the cross-review UI.

Verify each tool's claims against its own site/docs before relying on them; the source is a social post summarized from screenshots, not documentation.

## Method and constraints

- Start by reading the repo: `agents.md`, `PRODUCT.md`, `README.md`, `docs/architecture/*`, `apps/interface`, `src/server`, and the SSE/event code. Cite files as `path:line`.
- Prefer primary sources (official docs, repos, changelogs). Date every external claim. Mark anything you could not verify as **unverified**. Do not invent pricing, API names or model names.
- Separate **facts** (cited), **inferences** (reasoned), and **recommendations**.
- Keep the report scannable: summary of recommendations first (max 15 lines), then detail sections for A and B, then a combined phased roadmap showing dependencies (the event schema work in A and the decision layer in B likely share infrastructure, so call that out).
- Respect security rules: never print or store real keys; use placeholders.
- End with: top 5 risks, open questions for the user (max 5), and the single smallest first step for each feature.
