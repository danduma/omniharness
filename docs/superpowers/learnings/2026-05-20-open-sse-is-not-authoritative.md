# Open SSE Is Not Authoritative

**Date:** 2026-05-20
**Context:** OmniHarness direct-control conversations and worker streams.
**Symptom:** A selected session could show stale "Thinking..." or no worker output until a reload/session switch, even though durable run state or worker JSONL output already existed.
**Root Cause:** The frontend treated an open EventSource connection and a stale `running` run row as stronger evidence than durable snapshot/worker-stream authority. If the decisive SSE update or worker-entry wake-up was missed, the client had no steady authoritative validation path while the socket looked healthy.
**Fix:** Added periodic persisted-snapshot validation in `LiveEventConnectionManager`, kept selected direct worker stream refreshes, and split the terminal pending assistant indicator from generic stop availability. The pending bubble now requires actual direct worker activity or a pending send.
**Verification:** `pnpm vitest run tests/app/direct-control-activity.test.ts tests/app/live-event-connection-manager.test.ts tests/ui/conversation-actions.test.ts`
**Prevention:** Treat EventSource `open` as transport state only. UI truth must come from server snapshots, named events with replay, or worker-stream cursors; stale run rows may enable recovery controls but must not invent active output.
**Skill/Doc Updates:** Updated `docs/architecture/timing-determinism-audit.md` and `docs/architecture/direct-control-session-regressions.md`; no global skill update was needed because the existing client/server invariants skill already says cached/stream state needs freshness, completeness, and owner proof.
