# Queued Delivery Must Not Hold The Conversation Lock

**Date:** 2026-08-28
**Context:** OmniHarness conversation queue delivery and direct worker follow-ups.
**Symptom:** Sending a conversation message could fail with HTTP 524 while a previous queued direct-control message was being delivered.
**Root Cause:** `drainQueuedWorkerMessages` held the per-conversation mutation mutex while awaiting `askAgent`. A long or blocked provider turn kept later sends waiting behind that mutex until the proxy timed out, even though queue row ownership and provider I/O were already protected by narrower locks.
**Fix:** Removed the conversation-wide lock from queued worker delivery. Queue rows are still claimed atomically with `pending -> delivering`, and the provider call still runs behind the per-worker turn gate.
**Verification:** `pnpm vitest run tests/server/queued-messages.test.ts` passed, including a regression where a later queue mutation completes while a prior queued worker delivery is still waiting on the bridge. `pnpm build:interface:web` passed.
**Prevention:** Do not hold conversation-wide locks across provider calls, SSE drains, deployments, or other long-running I/O. Use atomic durable claims for shared rows and per-worker gates for provider turns.
**Skill/Doc Updates:** No global skill update needed; this project already documents lifecycle and control-plane event expectations, and the concrete locking rule is now captured in this project learning.
