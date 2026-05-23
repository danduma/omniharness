# Memory Consolidation Model Ownership

**Date:** 2026-05-21
**Context:** OmniHarness supervisor memory consolidation
**Symptom:** Memory consolidation failed at run completion with a fallback OpenAI key error even though the supervisor itself had a configured model.
**Root Cause:** The consolidation helper explicitly requested the supervisor fallback profile instead of resolving the active supervisor model. That made an opportunistic background summarizer depend on `SUPERVISOR_FALLBACK_LLM_*` even when the supervisor was successfully using another profile.
**Fix:** Add an explicit memory-summary model source that inherits the active supervisor profile by default and only uses `SUPERVISOR_MEMORY_LLM_*` when the custom memory model toggle is enabled.
**Verification:** `pnpm vitest run tests/supervisor/model-config.test.ts tests/supervisor/model-config-codex.test.ts tests/ui/settings-dialog.test.ts` passed. Full `pnpm exec tsc --noEmit --pretty false` was blocked by an unrelated existing `scripts/rebuild-worker-indices.ts` type error.
**Prevention:** Background LLM helpers should declare whether they inherit the owning workflow's model or use a separate explicit profile. Do not point them at fallback profiles unless the feature is specifically failover behavior.
**Skill/Doc Updates:** No shared skill update needed; this is an OmniHarness-specific model ownership convention captured here.
