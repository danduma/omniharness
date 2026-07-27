# Tail Windows Must Not Split Streamed Messages

**Date:** 2026-07-09
**Context:** OmniHarness unified worker stream and terminal transcript rendering
**Symptom:** Long agent answers appeared to start mid-sentence in the terminal because the initial worker stream load returned only the last 100 persisted rows.
**Root Cause:** Some providers persist a single assistant answer as many token-sized `message` entries with distinct ids. The frontend coalesces those fragments after loading them, but the server tail reader could cut the persisted row window in the middle of the fragment run, so the renderer never received the beginning of the answer.
**Fix:** `readWorkerEntriesTail` now detects when the tail begins with a fragmented assistant message and expands backward to the start of that fragment run. Read-only legacy worker stream paths also avoid top-level database imports so the hot path stays light.
**Verification:** `pnpm typecheck`; `pnpm test tests/server/workers/output-store.test.ts`; `pnpm test tests/api/worker-entries-hot-path.test.ts`; `pnpm test tests/lib/agent-output.test.ts tests/app/worker-entries-manager.test.ts`.
**Prevention:** When adding tail windows or pagination around append-only streams, preserve semantic item boundaries before handing data to renderers. A row limit is not a safe proxy for a complete user-visible message.
**Skill/Doc Updates:** No general skill update was needed; this is a project-specific unified-stream invariant now captured in the repo learnings.
