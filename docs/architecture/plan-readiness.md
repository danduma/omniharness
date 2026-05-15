# Plan Readiness Assessment

How OmniHarness decides whether a freshly produced plan is concrete enough to start implementation from, what signal that decision surfaces in the UI, and the hybrid regex + LLM pipeline that produces it.

> **Status:** Sections 2–5 are now shipped. Section 1 ("Today") is retained as historical context — the legacy `assessPlanReadiness` regex still runs as the Stage-1 floor when the LLM judge is unavailable, but the live readiness signal is produced by the two-stage pipeline described below.

---

## 1. How it works today

### Trigger

`refreshPlanningArtifactsForRun` (`src/server/planning/refresh.ts:23`) runs every time the planning conversation's worker output changes — on every event flush from the planner CLI, not only on the final turn. It:

1. Concatenates the worker's full output (DB messages + persisted entries + live snapshot + last response).
2. Calls `collectPlannerArtifacts` (`src/server/planning/artifacts.ts:280`) to extract candidate spec/plan file paths from the handoff block.
3. For each plan candidate that exists on disk, parses the markdown and calls `assessPlanReadiness` (`src/server/plans/readiness.ts:70`).
4. Persists the resulting `PlannerArtifacts` (including each candidate's `readiness` field) to `runs.plannerArtifactsJson`.
5. Derives the conversation's `PlanningConversationStatus` from the artifacts.

### Readiness assessment (current)

`assessPlanReadiness` is purely regex / structural. Output schema:

```ts
interface PlanReadinessAssessment {
  ready: boolean;       // questions.length === 0
  questions: string[];  // human-facing prompts to fix the plan
  gaps: string[];       // short labels for what's missing
}
```

Two rules:

1. **Empty checklist** — if the parsed plan has zero items, push gap *"No checklist items were found in the plan."*
2. **Vague item titles** — for each item, fail if **all three** are true:
   - Title starts with one of `improve|fix|update|make|enhance|optimize|refactor|support ` and is ≤3 words (`looksVague`).
   - No concrete checklist support: no `Verify:` line, not a small single-file config edit, no "concrete nested implementation details" (a bullet containing a verb like `add|render|pass|wire|...` AND a code-ish token).
   - No global `## Acceptance Criteria` section with bullets.

   Pushes gap *`Item "<title>" is too vague.`*

That's the entire judgment. `ready` is just `questions.length === 0`.

### How readiness surfaces in the UI

`PlanningArtifactsPanel.tsx:163-186` derives one of three display states from the selected plan candidate's `readiness`:

| State          | Condition                                                                 | Current copy (`shared/locales/en.json`)             |
|----------------|---------------------------------------------------------------------------|-----------------------------------------------------|
| `ready`        | `selectedPlanPath` exists AND (`!readiness` OR `readiness.ready === true`) | `planning.artifacts.readyPrompt`                    |
| `needsReview`  | not ready AND `readiness.gaps[0]` exists                                  | `planning.artifacts.needsReviewPrompt` (with `{gap}`)|
| `detected`     | not ready AND no gap (no readiness was computed)                          | `planning.artifacts.detectedPrompt`                 |

Below the prompt, the panel renders three action buttons: **Continue revising**, **Improve plan** (expands the inline review controls), **Start implementation** (disabled when `!ready`).

### Failure modes of the current heuristics

- **False negatives** — any plan whose vague-titled items happen to include any bullet containing the word "test" / "state" / "behavior" passes the "concrete nested" regex. A plan that's substantively empty but lexically busy is judged ready.
- **False positives** — a one-line plan with the title `Add Stripe webhook handler for invoice.payment_failed` (concrete, but no details) passes because `looksVague` only fires on the vague-prefix list, not on "missing details entirely."
- **No semantic check** — sequencing problems, items that can't be verified, contradictions with the spec, missing acceptance criteria coverage are invisible.
- **Binary gate** — `Start implementation` is disabled whenever `!ready`. The underlying signal isn't reliable enough for a hard gate.
- **No location info** — `Item "X" is too vague.` doesn't tell the panel which line in the plan to deep-link to.

---

## 2. Forward design: hybrid regex + LLM judge

The goal is a **two-stage pipeline** where deterministic structural checks run first and feed a focused LLM judge that produces the human-facing analysis. Same model stack as the supervisor (`@mastra/core/agent` + `buildMastraModelConfig`), so no new infra.

### Stage 1 — Structural factsheet (deterministic)

Rename and re-tier `assessPlanReadiness`. It produces a **factsheet**, not a verdict:

```ts
interface PlanStructuralFacts {
  itemCount: number;
  hasAcceptanceCriteria: boolean;
  hasSpecLink: boolean;
  itemsMissingDetails: number[];     // indices into plan.items
  itemsMissingVerify: number[];
  itemsWithEmptyVerify: number[];
  itemsWithVagueTitle: number[];     // existing looksVague rule
  itemsWithStubTitle: number[];      // TODO / WIP / ??? / empty
  itemsReferencingMissingPaths: number[];  // soft signal
}
```

Cheap structural checks the existing regex misses, all worth adding here:

- Item has no `details` block at all.
- Title is a bare stub (`TODO`, `WIP`, `???`, single-word non-verb).
- `Verify:` line present but empty.
- Plan has no spec link AND no `## Goal` AND no `## Acceptance Criteria` AND no per-item Verify lines (today, an empty plan with one good-looking title slips through).
- Item bullets reference paths that don't exist in the repo (warning tier, not blocking).

Critically: **no `ready` boolean from Stage 1.** It's a pile of facts the next stage can use.

Drop the brittle regex parts: `hasConcreteNestedImplementationDetails`'s verb-keyword match is theatre — replace with a much weaker structural signal ("details has ≥N non-empty bullets"). The LLM does the semantic judgment.

### Stage 2 — LLM judge

A new agent at `src/server/plans/readiness-llm.ts` that takes:

- the parsed plan markdown,
- the spec markdown if present,
- the Stage 1 factsheet,

and returns a tight JSON schema (enforced via the Mastra agent's structured output):

```ts
interface PlanReadinessVerdict {
  verdict: "ready" | "needs_review" | "needs_rewrite";
  confidence: number;            // 0..1
  headline: string;              // one sentence shown directly in the UI
  topConcern: string | null;     // the single biggest issue, if any
  concerns: Array<{
    kind: "vague_item" | "missing_verify" | "sequencing" | "scope" |
          "spec_mismatch" | "unverifiable_ac" | "other";
    itemIndex: number | null;
    line: number | null;         // for deep-linking into the plan file
    detail: string;
  }>;
  rationale: string;             // longer text, not shown by default
}
```

**Prompt shape** (sketch — actual prompt lives in `src/server/plans/readiness-prompt.md`):

> You are judging whether this implementation plan is concrete enough to start coding from. The regex layer has already extracted these structural facts: `<factsheet JSON>`. Don't re-derive what's already known. Focus on semantic issues regex can't see: vague acceptance criteria, missing or wrong sequencing, items that can't be verified by observation, scope creep beyond the spec, contradictions with the spec.
>
> Plan: `<plan markdown>`
> Spec: `<spec markdown or "none provided">`
>
> Output JSON matching `PlanReadinessVerdict`. Be concise. The `headline` will be shown directly to the user, in place of "Here are the plan files." — write it as a useful one-liner about plan readiness, not a greeting.

Forcing Stage 2 to consume the factsheet means it doesn't hallucinate gaps the regex already proved present/absent, and saves tokens on rediscovery.

### Composition rules

- **`verdict: "ready"`** ⇒ `Start implementation` enabled. The headline still surfaces any minor concerns ("Plan looks ready — one acceptance criterion could be tightened").
- **`verdict: "needs_review"`** ⇒ implementation allowed but the panel emphasizes the **Improve plan** review pass.
- **`verdict: "needs_rewrite"`** ⇒ implementation disabled, planner revision suggested.
- If Stage 2 fails (LLM error, timeout, quota), fall back to a derived verdict from Stage 1 alone: `ready` if zero structural gaps, `needs_review` otherwise. UI is degraded but never broken.

The legacy `ready: boolean` field stays on `PlannerArtifactCandidate` for one release as a derived `verdict === "ready"`, then is removed.

---

## 3. When does the LLM judge run?

**Eagerly, when the planning CLI run reaches a terminal output.**

This is *not* on every output flush. `refreshPlanningArtifactsForRun` runs whenever the worker emits output, which can be many times per turn. Running a model call on every flush would be wasteful and would produce flickering verdicts. The LLM judge runs only when one of these is true:

1. The planner worker has just emitted a `handoff` block (final plan delivered).
2. The planner worker's run status transitions to an idle / awaiting-user state with at least one plan candidate present.
3. The plan file's content hash has changed since the last verdict was cached.

Implementation point: the gate lives inside `refreshPlanningArtifactsForRun`, immediately after `collectPlannerArtifacts` on line 55. If the gate trips, an LLM verdict is requested for each plan candidate (in practice, almost always one).

### Caching

Verdict cache key: `sha256(planMarkdown + "\n---\n" + (specMarkdown ?? ""))`. Stored alongside the run (column `plannerReadinessVerdictJson` on `runs`) plus an in-memory LRU keyed by hash. Re-rendering the artifacts panel never re-spends tokens. Editing the plan invalidates the cache automatically because the hash changes.

### UI loading state

While Stage 2 is in flight, the artifacts panel shows the prompt copy `planning.artifacts.analyzingPrompt` — *"Analyzing plan…"* — with a subtle activity indicator. The three action buttons remain visible: **Continue revising** and **Improve plan** stay enabled (they don't depend on the verdict); **Start implementation** is disabled until a verdict resolves.

The analyzing state must clear within a reasonable window. If Stage 2 hasn't returned in N seconds (default: 20s), we render the Stage 1 fallback copy and let the verdict update silently when it does arrive.

### State machine (per plan candidate)

```
[no plan]
   │ plan file detected by collectPlannerArtifacts
   ▼
[awaiting-verdict] ─── trigger fires? ──no──▶ [stale-fallback]  (Stage 1 only)
   │ yes
   ▼
[analyzing] ── LLM call ──┬── ok ──▶ [verdict-ready]
                          └── error/timeout ──▶ [stale-fallback]

[verdict-ready] ── plan markdown changes (hash mismatch) ──▶ [awaiting-verdict]
```

---

## 4. UI changes

### Replace the three prompt strings with one analysis-driven prompt

Current keys `planning.artifacts.readyPrompt`, `needsReviewPrompt`, `detectedPrompt` are collapsed into:

- `planning.artifacts.analyzingPrompt` — *"Analyzing plan…"* (loading state)
- The verdict's `headline` field — shown verbatim (it's already user-facing copy from the LLM, e.g. *"Plan is ready — every item has a Verify line and acceptance criteria align with the spec."* or *"Plan needs work: items 3 and 5 can't be verified by observation, and step 4 should come before step 2."*).
- `planning.artifacts.fallbackPrompt` — Stage 1 fallback copy if the LLM is unavailable, derived from the factsheet (*"Plan detected. Spec link missing and 2 items have no Verify line — review before implementation."*).

This means most of the time the prompt the user sees is not a localized string at all — it's the LLM's `headline`. The localized strings are loading / fallback only.

> **i18n note:** The LLM headline is generated in whatever language is appropriate to the request. For now it's English-only. When we add multilingual planner outputs, the prompt to Stage 2 will include the user's locale and ask for the `headline` in that locale; `rationale` and `concerns[*].detail` follow the same rule.

### Action buttons

Unchanged in label. Enable/disable logic changes:

| Button                | Today                              | After                                     |
|-----------------------|------------------------------------|-------------------------------------------|
| Continue revising     | Always enabled                     | Always enabled                            |
| Improve plan          | Always enabled                     | Always enabled, visually emphasized when `verdict !== "ready"` |
| Start implementation  | Disabled when `!readiness.ready`   | Disabled when `verdict === "needs_rewrite"` only; enabled otherwise, with confirmation when `verdict === "needs_review"` |

The softer gating on `Start implementation` reflects that the verdict is a guidance signal, not infallible.

---

## 5. Open design calls

- **Cost ceiling.** Stage 2 fires every time a plan is finalized. On a heavy planning day that's tens of calls per user. Worth a per-project rate limit (e.g. ≤1 call per 30s for the same plan hash variant)?
- **Model choice.** Reuse the supervisor model config wholesale, or pin a cheaper/faster model for the judge specifically? Plan analysis is short-context and doesn't need a frontier model.
- **Surfacing `concerns[]`.** The panel headline shows only `headline`. Should hovering or expanding the prompt show the full `concerns[]` list inline, or stay a click away in the existing review controls?
- **Backwards compatibility.** The `readiness: { ready, questions, gaps }` shape is referenced by `promote.ts`, `status.ts`, the artifacts panel, and tests. Migrating to `verdict` is a breaking schema change for `plannerArtifactsJson`. Cleanest path: keep `readiness` populated from the verdict (`ready = verdict === "ready"`, `gaps = concerns[*].detail`) so downstream code keeps working while it migrates.

---

## 6. Files involved

- `src/server/plans/readiness.ts` — structural factsheet (`assessPlanStructure`, `structureHasBlockingGaps`, `describeStructuralGaps`) plus legacy `assessPlanReadiness` retained for the structural floor.
- `src/server/plans/readiness-llm.ts` — Stage 2 Mastra agent. Prompt lives inline in this file (no separate `.md` template).
- `src/server/plans/readiness-pipeline.ts` — orchestrates Stage 1 + Stage 2, caches verdicts by plan hash, dedupes in-flight calls, enforces the per-run rate limit, patches `plannerArtifactsJson` when verdicts finalize.
- `src/server/planning/refresh.ts` — attaches readiness records to plan candidates; triggers Stage 2 on the selected plan when the worker is idle.
- `src/server/planning/artifacts.ts` — declares `readinessRecord?` on `PlannerArtifactCandidate`.
- `src/server/planning/promote.ts` — refuses to promote when the cached verdict is `needs_rewrite`; otherwise runs the structural floor.
- `src/server/planning/status.ts` — `hasReadyPlannerArtifact` prefers the verdict and falls back to legacy structural readiness.
- `src/server/db/schema.ts` — `runs.plannerReadinessVerdictJson` column for the verdict cache (per-run, keyed by plan hash).
- `src/components/PlanningArtifactsPanel.tsx` — renders `headline` / `fallbackHeadline` / "Analyzing plan…"; soft gate on `Start implementation` (only `needs_rewrite` disables); concerns disclosure.
- `shared/locales/*.json` — `analyzingPrompt`, `fallbackPrompt`, `needsReviewConfirm`, `concernsSummary` keys; old `readyPrompt`/`needsReviewPrompt`/`detectedPrompt` removed.
