# Model Selection Must Never Cross Families

**Date:** 2026-07-27
**Context:** OmniHarness Claude worker launches, `resolveClaudeSessionModel`, ACP `session/set_config_option`.
**Symptom:** Run `594224099b56` was launched as `claude-fable-5`, and both `runs.preferred_worker_model` and `workers.effective_launch_model` recorded it as such. Its transcript shows **301 assistant turns on `claude-opus-4-8`** — a different model family, for the entire session, with no warning anywhere.

**Follow-up (2026-08-02):** Run `2b774b6d0d32` showed the reverse failure: it requested `claude-opus-5`, but Claude's session config reported `claude-fable-5[1m]`. The Fable option described itself as “Uses your limits ~2× faster than Opus,” and the resolver searched the entire description for family names. That comparison sentence made Fable look like both Fable and Opus; its version 5 then beat the real Opus 4.8 option.

**Root Cause:** The resolver's last resort was `bestStandardContextOption(options)` — "anything that runs without usage credits" — with no family constraint. The adapter offered Fable only as `claude-fable-5[1m]`; the 1M filter emptied the Fable candidate pool, and the fallback landed on `default`, which was Opus 4.8. Three defects compounded:

- **Context size outranked model identity.** Avoiding `[1m]` was allowed to change *which model ran*. The user asked for a model, not a context size.
- **The 1M test read the wrong field.** `isOneMillionContextModel` inspected only `option.value`; the adapter's own recommendation is `{ value: "default", description: "Opus 4.8 with 1M context" }`, so the single largest 1M option in the list was classified as standard-context and became the "safe" fallback.
- **`keep` was silent, and then the row lied.** `unavailable` threw and `pin` emitted `worker.model_pinned`, but `keep` emitted nothing and left `pinnedModel` null — so `effectiveModel: pinnedModel ?? requestedModel` wrote the *requested* model into the worker row as though it had run.

**Fix:** One rule dominates: never leave the requested family — Opus, Sonnet, Haiku and Fable are different products, not fallbacks for one another. The first repair constrained menu resolution to a family and made durable records reflect the adapter's confirmed model.

The 2026-08-02 repair removed menu resolution from explicit model selection entirely. OmniHarness passes the exact requested id, such as `claude-opus-5`, to the Claude process as `ANTHROPIC_MODEL` before startup. Claude's reported current model must then equal that exact string. A missing report or any mismatch stops the launch visibly; no family fallback, lower-version substitution, alias translation, or menu ranking is allowed. The menu resolver remains only for sessions with no explicit model, and its defensive path now also refuses unavailable versions and ignores comparative marketing copy when identifying options.

**Verification:** `./node_modules/.bin/vitest run` (316 files, 2054 passed). `tests/lib/claude-session-model.test.ts` pins the real option list run `594224099b56` was offered and asserts it now resolves to `claude-fable-5[1m]`; `tests/server/agent-runtime/claude-model-pin.test.ts` covers the same through a live ACP handshake against a fake adapter. `tsc --noEmit` and `eslint` clean.

The 2026-08-02 follow-up added red/green coverage for run `2b774b6d0d32`, exact startup propagation, exact runtime verification, missing model status, an adapter ignoring `ANTHROPIC_MODEL`, omitted menu entries, lower-version refusal, and comparison-copy poisoning. The focused verification passed 36 tests; TypeScript and ESLint passed. The full suite passed 2,383 tests and hit one unrelated temporary-directory scan race in `tests/architecture/port-cutover.test.ts`; that test passed when immediately rerun alone.

**Prevention:** Explicit model selection is an exact-value contract, not a recommendation. Pass the provider's model id directly, verify the provider reports the same id, and fail closed otherwise. Never derive identity from unbounded prose: descriptions often compare products and therefore contain other family names. Whatever starts must be recorded from confirmed runtime state, never from requested intent alone.

**Skill/Doc Updates:** None needed; this is the model-selection case of the existing control-plane invariant that persisted state must reflect confirmed reality rather than requested intent.
