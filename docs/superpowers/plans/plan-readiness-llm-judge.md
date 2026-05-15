# Implementation Plan: Hybrid (regex + LLM) Plan Readiness Judge

Tracks the remaining work to ship the two-stage plan-readiness pipeline described in `docs/architecture/plan-readiness.md`. The Stage 1 factsheet, the Stage 2 LLM judge, the SQLite column, the pipeline module, and the `refresh.ts` integration already exist on `master`. What is left is to thread the verdict through the candidate type, render it in the UI, swap the locale strings, soften the implementation gate, expose the right trigger points, and add tests.

## Acceptance Criteria

- Selecting a finalized plan in a planning conversation triggers exactly one Stage-2 LLM call per `(planHash, specHash)` per run. Re-renders, navigation, or unrelated worker output flushes do **not** re-spend tokens.
- The artifacts panel shows three distinct UI states driven by the new pipeline:
  - `analyzing` — "Analyzing plan…" copy + activity indicator while the LLM call is in flight.
  - `verdict-ready` — the `headline` from `PlanReadinessVerdict` shown verbatim.
  - `fallback` — the `fallbackHeadline` derived from `PlanStructuralFacts` when the LLM call errored, timed out, or `MOCK_LLM=true`.
- `Start implementation` is disabled only when `verdict === "needs_rewrite"`. When `verdict === "needs_review"`, the button is enabled but presents a confirmation. When the verdict is missing and the fallback signals blocking gaps (`structureHasBlockingGaps`), the button stays disabled.
- The old localized prompts `planning.artifacts.readyPrompt`, `needsReviewPrompt`, `detectedPrompt` are removed from all 9 locale files and replaced by two new keys (`analyzingPrompt`, `fallbackPrompt`). All other locales fall back to English headlines (per the architecture doc's i18n note).
- `promote.ts` and `derivePlanningStatus`/`hasReadyPlannerArtifact` honour the verdict when one is present, falling back to the existing structural-readiness check otherwise. Promoting a plan whose verdict is `needs_rewrite` fails fast with a clear error.
- Tests exist for the new pipeline (caching, in-flight dedup, fallback on LLM error), the panel's three render states, and the promote/status verdict-aware paths.
- `npm run typecheck` and the test suite pass.

---

## Phase 1: Type and serialize the readiness record on every plan candidate

Right now `refresh.ts:42-94` spreads `readinessRecord: record` onto each plan candidate, but `PlannerArtifactCandidate` (`src/server/planning/artifacts.ts:114-122`) only declares the legacy `readiness?: PlanReadinessAssessment | null`. The record survives JSON serialization but is invisible to TypeScript downstream — every consumer has to cast.

1. **Extend the candidate type (`src/server/planning/artifacts.ts:114`)**:
   - Add `readinessRecord?: PlanReadinessRecord | null` to `PlannerArtifactCandidate`. Import `PlanReadinessRecord` from `@/server/plans/readiness-pipeline`.
   - Leave the legacy `readiness?: PlanReadinessAssessment | null` in place for now (per the backwards-compat note in section 5 of the architecture doc). It is still populated by `buildCandidate` and consumed by `promote.ts` / `status.ts`.
   - Verify: `tsc --noEmit` no longer reports implicit `any` on `candidate.readinessRecord`. Grep confirms zero remaining `as { readinessRecord: ... }` casts.

2. **Move the local sha256 helper out of `refresh.ts` (`src/server/planning/refresh.ts:96-102`)**:
   - The inline `require("crypto")` hack exists to avoid a circular import. Replace it with a direct call to `hashPlanMarkdown` from `@/server/plans/readiness-pipeline` (already exported at line 46).
   - Confirm no circular-import error appears (it shouldn't — refresh already imports from readiness-pipeline at the top of the file).
   - Verify: `git grep -n "require(\"crypto\")"` returns nothing in refresh.ts.

3. **Stop attaching the record only to the selected candidate (`src/server/planning/refresh.ts:62-90`)**:
   - Today only `candidate.path === args.artifacts.planPath` triggers `ensureReadinessVerdict`. Other plan candidates get `loadCachedReadinessRecord` but the result is still attached. That's correct — but make sure the attached record is the cached one if it exists, even for the selected plan, so that switching between plans doesn't drop already-computed verdicts. Concretely: always call `loadCachedReadinessRecord` first; only invoke `ensureReadinessVerdict` for the selected, non-busy case.
   - Verify: a test (added in Phase 7) confirms that flipping the user's selected plan does not re-trigger the LLM for a plan whose verdict was previously cached.

## Phase 2: Tighten the trigger conditions in `refresh.ts`

The architecture doc lists three triggers (handoff block, idle worker state, hash change). The current implementation only checks `workerBusy` — it does not require a handoff or idle transition. That's actually fine *because* the cache key on `(planHash)` makes re-triggers cheap, but two real bugs remain:

1. **`workerBusy` does not include `awaiting_user` (`src/server/planning/refresh.ts:30`)**: `WORKER_BUSY_STATES = new Set(["working", "starting"])` is correct, but worker status strings can be `"working:streaming"` or similar suffixed forms. The existing line splits on `":"` — keep that, but add a unit-test-style check that a state like `"idle"`, `"awaiting_user"`, `"awaiting_input"` flows through to the LLM trigger.
   - Verify: a refresh test (Phase 7) with a stubbed `assessPlanReadinessWithLLM` confirms triggers fire on `"idle"` and not on `"working"`.

2. **Verify the cached `analyzing` record is not returned as-is forever (`src/server/plans/readiness-pipeline.ts:198-206`)**:
   - The current code returns the cached record (including `analyzing`) unconditionally. If a previous turn crashed mid-analysis (process exited, never finalized), the run is stuck in `analyzing` forever.
   - Add: when `cached.status === "analyzing"` AND `Date.now() - cached.generatedAt > STALE_ANALYZING_MS` (say 60s), treat it as missing and re-trigger. Constant lives next to `inFlight` in `readiness-pipeline.ts`.
   - Verify: pipeline unit test asserts that a cached `analyzing` record older than 60s is overwritten and a new LLM call is issued.

3. **Surface readiness updates over the live event stream**:
   - `ensureReadinessVerdict` already calls `notifyEventStreamSubscribers()` after persisting the analyzing record and again after finalize. Confirm `refresh.ts` does the same when it persists the enriched `plannerArtifactsJson`. If `refreshPlanningArtifactsForRun`'s callers don't already trigger event-stream notifies, add an explicit call after the `db.update(runs)` block (`src/server/planning/refresh.ts:168-176`).
   - Verify: opening a planning conversation, finishing a planner CLI turn, and watching the EventSource shows the panel transition `analyzing → verdict-ready` without a page reload.

## Phase 3: Render verdict / fallback / analyzing in `PlanningArtifactsPanel`

`src/components/PlanningArtifactsPanel.tsx` currently reads `selectedCandidate.readiness.ready` / `.gaps` and picks one of three localized strings. Rewrite the prompt-rendering section without breaking the panel for runs whose `plannerArtifactsJson` predates this change.

1. **Widen the `Candidate` shape (`src/components/PlanningArtifactsPanel.tsx:15-25`)**:
   - Add a `readinessRecord?` field with the JSON-friendly shape (manually mirror `PlanReadinessRecord` here — the panel runs in the browser and must not import server-only modules).
   - Keep `readiness?` for backwards compatibility with old persisted JSON.

2. **Derive the display state**:
   - Compute `record = selectedCandidate?.readinessRecord ?? null`.
   - Compute `verdict = record?.verdict ?? null`, `headline = record?.verdict?.headline ?? record?.fallbackHeadline ?? null`, `status = record?.status ?? null`.
   - Compute `legacyReady = !selectedCandidate?.readiness || selectedCandidate.readiness.ready === true` (for old data).
   - `isAnalyzing = status === "analyzing"`.
   - `displayHeadline`:
     - If `isAnalyzing` → `t("planning.artifacts.analyzingPrompt")`.
     - Else if `headline` → `headline` (rendered as plain text, no markdown).
     - Else if `selectedCandidate?.readiness?.gaps?.[0]` → keep the legacy `needsReviewPrompt` rendering for one release.
     - Else → `t("planning.artifacts.fallbackPrompt")`.

3. **Replace the existing `<p>` block (`PlanningArtifactsPanel.tsx:182-187`)**:
   - Render `displayHeadline`.
   - When `isAnalyzing`, append a subtle activity indicator (reuse the dots in `src/components/home/ErrorNotice.tsx`'s `ProgressDots` or a `Loader2` icon already imported by `PlanningReviewControls.tsx`). Keep it inline, small, no layout shift.

4. **Replace the `ready` boolean with verdict-aware enable logic**:
   - `canStart = selectedPlanPath && !isPromoting && !isAnalyzing && verdict !== "needs_rewrite" && (verdict !== null || legacyReady)`.
   - When `verdict === "needs_review"`, attach an `onClick` confirmation: `window.confirm(t("planning.artifacts.needsReviewConfirm"))` before calling `onPromote`. (Add the new locale key in Phase 4.) If the user cancels, do not promote.
   - Update `disabled={!canStart}` on the `Start implementation` button.
   - When `verdict !== "ready"`, add a visual emphasis to `Improve plan` (e.g. `variant="default"` instead of `"outline"`). Do this without conditionally hiding the button — it must remain reachable.

5. **Tooltip / disclosure for `concerns`**:
   - When `verdict?.concerns.length > 0` and the panel is in the verdict-ready state, surface a small `<details>` that lists `kind` and `detail` for each concern. Keep it collapsed by default. Use a localized summary label `planning.artifacts.concernsSummary` (in Phase 4).

6. **Do not surface `rationale` by default** — it's long and the architecture doc explicitly says it's hidden behind a disclosure. The collapsed `<details>` in step 5 also includes it under a secondary `<details>` or below the concerns list.

7. **Edge case**: when `selectedPlanPath` exists but `selectedCandidate` is null (e.g. plan candidate filtered out by `handoffPlanCandidates`), fall back to `t("planning.artifacts.fallbackPrompt")` and leave `Start implementation` disabled.

8. **Verify**: a vitest snapshot for `PlanningArtifactsPanel` rendered with each of the four states (`no record`, `analyzing`, `verdict-ready ready`, `verdict-ready needs_rewrite`, `fallback`) matches expectations. The test must use `@testing-library/react` (already in the repo) — check `tests/ui/*.test.ts` for an existing pattern.

## Phase 4: Locale changes

The architecture doc says the LLM `headline` itself is in whatever language the request used (English-only for now), and only the loading / fallback strings need localization.

1. **`shared/locales/en.json`**:
   - Remove: `planning.artifacts.readyPrompt`, `planning.artifacts.needsReviewPrompt`, `planning.artifacts.detectedPrompt`.
   - Add: `planning.artifacts.analyzingPrompt` = `"Analyzing plan…"`.
   - Add: `planning.artifacts.fallbackPrompt` = `"Plan detected. Review the file below before starting implementation."`.
   - Add: `planning.artifacts.needsReviewConfirm` = `"This plan still has open concerns. Start implementation anyway?"`.
   - Add: `planning.artifacts.concernsSummary` = `"Show concerns"`.

2. **Other 8 locales** (`de`, `es`, `fr`, `it`, `ja`, `ko`, `pt`, `zh-CN`):
   - Same key removals.
   - Add the same four new keys with localized values. Match the tone of the surrounding `planning.*` keys in each file. (`Analyzing plan…` translates straightforwardly; the fallback prompt should not say "ready" or "needs review" because the verdict is unknown.)
   - Keep `gap` interpolation references out — the new pipeline does not surface a single gap string; it surfaces a full headline or fallback.

3. **Locale audit**:
   - `git grep -n "planning.artifacts.readyPrompt\|planning.artifacts.needsReviewPrompt\|planning.artifacts.detectedPrompt"` should return zero results in source (only the legacy doc references in `docs/architecture/plan-readiness.md` remain).
   - Verify the existing `i18n` loader does not crash on missing keys for any locale (it logs a console warning at most — confirm by skim).

## Phase 5: Verdict-aware promotion and status derivation

The current `promote.ts:60-72` first checks `matchingCandidate.readiness.ready === false` and then independently re-parses the plan via `assessPlanReadiness`. Both are still useful but should consult the verdict first.

1. **`src/server/planning/promote.ts`**:
   - After resolving `selectedPlanPath`, load the cached `PlanReadinessRecord` for this run + plan via `loadCachedReadinessRecord` (or `readinessRecordForPlanFile`). Import from `@/server/plans/readiness-pipeline`.
   - If `record?.verdict?.verdict === "needs_rewrite"`, throw `Error("The selected plan needs a rewrite before implementation.")`. Include the headline in the message so the surfaced error is useful: `` `${prefix} ${record.verdict.headline}` ``.
   - Otherwise fall through to the existing structural-readiness check (`assessPlanReadiness`). Keep this — it's the floor when the LLM is unavailable.
   - The existing `matchingCandidate.readiness.ready === false` check is now redundant when `readinessRecord` is present; leave it as a safety net but stop relying on it as the primary signal.

2. **`src/server/planning/status.ts:16-35` (`hasReadyPlannerArtifact`)**:
   - When `selectedPlan.readinessRecord?.verdict?.verdict` is `"ready"` or `"needs_review"`, return `true` (the planning conversation can move to `"ready"` status — the user can choose to start).
   - When it's `"needs_rewrite"`, return `false`.
   - When no record exists, fall back to the existing legacy `readiness.ready` check.
   - Update the `readiness:` field accessor to be optional-chain-safe with the new shape.

3. **API surface** (`src/app/api/planning/[id]/review/route.ts` and `promote` route):
   - No changes needed beyond the new error message bubbling up through the existing error handler. Confirm `formatErrorMessage` doesn't strip it.

4. **Verify**: `tests/server/planning/refresh.test.ts` and a new `tests/server/planning/promote.test.ts` (or extend if it exists) cover:
   - A plan with a `needs_rewrite` verdict cannot be promoted.
   - A plan with a `needs_review` verdict *can* be promoted (the gate is in the UI confirmation, not the server).
   - A plan with no verdict and a passing structural readiness can still be promoted.

## Phase 6: Soft cost ceiling and observability

These are listed as "open design calls" in section 5 of the architecture doc. We do the minimum here and defer the rest.

1. **Per-run rate limit**:
   - Add a simple `Map<runId, number>` (last-call timestamp) inside `readiness-pipeline.ts`. Reject (return the existing cached fallback) if a new call would fire within 5 seconds of the previous one for the same run. The cache key already prevents same-hash re-spending; this only catches the pathological case of the worker flushing many turns in a row, each producing a slightly different plan markdown.
   - Verify: a unit test that calls `ensureReadinessVerdict` ten times in a row with ten different hashes returns analyzing/fallback for the calls that exceed the rate limit, not ten LLM calls.

2. **Telemetry log**:
   - At the start of `assessPlanReadinessWithLLM`, log `console.log("[plan-readiness] start", { hash: ... })`. At the end, log `console.log("[plan-readiness] outcome", { hash, ok, verdict, ms })`. Use `console.log` for parity with existing `[planning/review]` logs.
   - Verify: a planning run shows the two log lines in the dev server's stdout.

3. **Defer to a follow-up**: a dedicated `plan_readiness_calls` table, the per-project cap, and the "pin a cheaper model" decision. Capture as a follow-up issue, do not block this plan.

## Phase 7: Tests

Lives under `tests/server/plans/` (new directory) and `tests/server/planning/`.

1. **`tests/server/plans/readiness.test.ts`** (new):
   - `assessPlanStructure` on a plan with two stub items, one missing details, no acceptance criteria — returns the expected fact arrays.
   - `structureHasBlockingGaps` returns `true` for empty-plan and stub-only cases; `false` for a well-formed plan.
   - `describeStructuralGaps` text matches snapshot for each known gap kind.

2. **`tests/server/plans/readiness-pipeline.test.ts`** (new):
   - Stub `assessPlanReadinessWithLLM` (vitest `vi.mock(...)`) to return a deterministic `ok: true` verdict on first call and assert subsequent calls with the same plan markdown read from cache (call count remains 1).
   - Stub it to return `ok: false`, assert the persisted record has `status: "fallback"` and a non-null `error`.
   - Concurrent calls with the same `(runId, planHash)` share the same in-flight promise (call count is 1 across N concurrent callers).
   - A cached `analyzing` record older than 60s is re-issued.
   - The 5s per-run rate limit (from Phase 6) blocks rapid retriggers.

3. **`tests/server/planning/refresh.test.ts`** (extend existing):
   - With `workerBusy = false` and a finalized plan, the readiness record is attached to the selected plan candidate and the run's `plannerReadinessVerdictJson` column is populated.
   - With `workerBusy = true`, the LLM is not invoked (mocked call count is zero) but the cached record (if any) is still attached.
   - The legacy `readiness` field on each candidate continues to be populated for backwards compat.

4. **`tests/server/planning/promote.test.ts`** (new or extend if exists):
   - Promoting a plan whose cached record has `verdict.verdict === "needs_rewrite"` throws and surfaces the verdict's headline.
   - Promoting one with `"needs_review"` succeeds.
   - Promoting with no record and a structurally-OK plan succeeds.

5. **`tests/ui/conversation-actions.test.ts`** (extend):
   - Add an assertion that the new locale keys exist in `en.json` (`analyzingPrompt`, `fallbackPrompt`, `needsReviewConfirm`).
   - The existing `readinessGap` rendering check needs to be replaced with a new check that the panel renders `record.verdict.headline` when present.

6. **`tests/server/planning/artifacts.test.ts`** (already has a `readiness.ready === false` test):
   - Replace the assertion to check both `readiness.ready === false` (legacy) AND `readinessRecord` being `null` or a structural-only fallback when LLM is mocked off.

## Phase 8: Verification and cleanup

1. **Static**:
   - `npm run typecheck` — clean.
   - `npm run lint` (if present in this repo) — clean.
   - `git grep -n "readiness.ready\b"` to enumerate every remaining legacy consumer — confirm each is either intentionally legacy or migrated.

2. **Manual smoke test** (dev server):
   - Start a planning conversation that produces a finalized plan.
   - Verify the panel shows "Analyzing plan…" briefly, then transitions to a verdict headline.
   - Edit the plan file by hand (change a single character), refresh; the panel re-runs the LLM (cache miss because hash changed).
   - Set `MOCK_LLM=true` in `.env.local`, restart, repeat; confirm the panel shows the fallback headline derived from the factsheet.
   - Promote a plan; confirm the implementation run starts.

3. **Delete the misplaced plan** at `docs/superpowers/plans/cli-quota-tracking.md` (it's about a different feature and was accidentally committed in this branch). Confirm `git status` shows only intentional changes.

4. **Update `docs/architecture/plan-readiness.md`**:
   - Move the "Status:" banner forward — Sections 2–5 are now shipped (not "agreed forward design").
   - Confirm the file paths in section 6 match the final implementation (one or two have already changed: `readiness-prompt.md` was never created — the prompt lives inline in `readiness-llm.ts`. Update section 6 accordingly).

## Files involved (final tally)

- `src/server/planning/artifacts.ts` — type widening on `PlannerArtifactCandidate`.
- `src/server/planning/refresh.ts` — use `hashPlanMarkdown`, attach cached record to all candidates, ensure event-stream notify.
- `src/server/planning/promote.ts` — verdict-aware promotion gate.
- `src/server/planning/status.ts` — verdict-aware ready detection.
- `src/server/plans/readiness.ts` — no changes (already split).
- `src/server/plans/readiness-llm.ts` — telemetry log lines.
- `src/server/plans/readiness-pipeline.ts` — stale-`analyzing` recovery, per-run rate limit, telemetry.
- `src/components/PlanningArtifactsPanel.tsx` — full prompt-rendering rewrite, soft gating, concerns disclosure.
- `shared/locales/{en,de,es,fr,it,ja,ko,pt,zh-CN}.json` — remove three keys, add four.
- `tests/server/plans/readiness.test.ts` (new).
- `tests/server/plans/readiness-pipeline.test.ts` (new).
- `tests/server/planning/refresh.test.ts` — extend.
- `tests/server/planning/promote.test.ts` — new or extend.
- `tests/server/planning/artifacts.test.ts` — update readiness assertion.
- `tests/ui/conversation-actions.test.ts` — locale + headline assertions.
- `docs/architecture/plan-readiness.md` — status banner and file list refresh.
- `docs/superpowers/plans/cli-quota-tracking.md` — delete (misplaced).

## Out of scope (follow-ups)

- Dedicated `plan_readiness_calls` table for analytics.
- Per-project model pinning (cheaper model for the judge).
- Localized LLM headlines.
- Removing the legacy `PlanReadinessAssessment.readiness` field from `PlannerArtifactCandidate` (one-release deprecation window per architecture doc).
