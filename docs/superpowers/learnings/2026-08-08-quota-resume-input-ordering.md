# Anchor Recovery Prompts Before Resumed Worker Output

**Date:** 2026-08-08  
**Context:** OmniHarness direct-control quota recovery and unified worker conversation streams  
**Symptom:** After a five-hour provider quota wait, the automatic continuation prompt appeared at the bottom of the session, after the resumed worker's final answer, making the session look as if nothing happened after the prompt.  
**Root Cause:** The quota-resume path awaited `askAgent()` and persisted the `supervisor_input` afterward. Bridge output could be observed and appended while that ask was in flight. The worker stream's per-worker `seq` is the authoritative order for a single-worker transcript, so the prompt's earlier timestamp could not move it before the already-appended output.  
**Fix:** Anchor the accepted quota-resume `supervisor_input` immediately after the saved session reattaches and before invoking `askAgent()`. Added a regression test that inspects the durable stream when the resumed ask starts.  
**Verification:** `pnpm exec vitest run tests/server/quota/worker-resume.test.ts` (5 passed); focused supervisor/transcript suite (98 passed); `pnpm typecheck` (passed). The regression test failed before the production change and passed afterward.  
**Prevention:** Treat every accepted server-driven worker turn—including quota-resume continuations—as `supervisor_input -> streamed worker activity -> response`. Do not rely on timestamps to repair a late append in an append-only stream. Keep ordinary follow-ups delivery-aware so failed or busy requests are not speculatively persisted.  
**Skill/Doc Updates:** Extended `docs/architecture/supervisor-worker-switching-incident.md` to include quota-resume continuations in the prompt-ordering invariant. No generic skill update was needed because the existing control-plane and worker-stream guidance already requires observable, monotonic, append-only ordering.
