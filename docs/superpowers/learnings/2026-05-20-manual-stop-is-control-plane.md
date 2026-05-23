# Manual Stop Is Control Plane

**Date:** 2026-05-20
**Context:** OmniHarness conversation composer during active direct/supervisor work
**Symptom:** Exact `stop` text could be stored as an ordinary user message even though the user intended to stop the active run.
**Root Cause:** Busy-with-text composer mode displayed a separate stop button but left the submit path as queue/steer. Exact manual stop text had no command interpretation, so it entered transcript persistence. A second edge remained: if the run became terminal before the server handled the exact stop, the "not stoppable" branch fell through into ordinary message persistence.
**Fix:** Exact `stop` and `/stop` submissions with no attachments are always control-plane commands, not transcript. The client clears the draft and invokes stop for the selected conversation regardless of whether local state still thinks it is stoppable. The server recognizes exact stop before transcript persistence and before worker-preference changes; if active work exists it cancels it, and if the run already ended it returns a no-op control response without writing a `messages` row. Non-exact text remains an ordinary message.
**Verification:** `pnpm vitest run tests/api/conversation-messages-route.test.ts --testNamePattern "manual stop"` and the focused app/UI suite covering composer behavior.
**Prevention:** Control-plane commands must be parsed before transcript persistence and before any preference-changing side effect on active conversations on both the client and server. Tests should cover both command aliases, preference payloads, and near-miss ordinary messages.
**Skill/Doc Updates:** Updated `docs/architecture/direct-control-session-regressions.md` and `docs/architecture/timing-determinism-audit.md`; no global skill update needed because the project docs now carry the concrete composer contract.
