# Server Snapshots Retire Optimistic Running

**Date:** 2026-05-20
**Context:** OmniHarness direct-control conversation loading and worker stream rendering
**Symptom:** A direct session could show "Thinking..." forever even though the database run was `done`, the worker was `idle`, and the worker JSONL stream contained the assistant output. Reloading or switching sessions made the output appear.
**Root Cause:** The frontend merged run rows by timestamp, allowing a newer optimistic local `running` row to beat an authoritative server snapshot that said `done`. Separately, the terminal treated worker-stream `isLoading` as assistant activity and fabricated a pending "Thinking..." row while persisted output was merely not loaded yet.
**Fix:** Server-sourced event snapshots now bypass timestamp arbitration for run rows, so authoritative terminal states retire optimistic state. The terminal now creates the pending assistant row only from explicit active-worker facts passed through `showPendingAssistantIndicator`, not from transcript loading.
**Verification:** `pnpm vitest run tests/app/event-stream-state-manager.test.ts` and `pnpm vitest run tests/ui/terminal-unified-stream-order.test.ts tests/ui/conversation-actions.test.ts`.
**Prevention:** Never use generic `updatedAt` comparison as an ownership model between optimistic and server state. Optimistic objects need explicit reconciliation maps, and loading state must stay visually distinct from active agent state.
**Skill/Doc Updates:** Updated `docs/architecture/timing-determinism-audit.md` and `docs/architecture/direct-control-session-regressions.md`; no global skill update needed because `client-server-state-invariants` already states that cached and optimistic data cannot satisfy authoritative load gates.
