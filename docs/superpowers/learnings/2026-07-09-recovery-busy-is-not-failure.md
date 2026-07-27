# Recovery Busy Is Not Failure

**Date:** 2026-07-09
**Context:** OmniHarness direct conversation recovery and worker resume.
**Symptom:** A direct conversation showed "Recover conversation: Agent is busy" and "Run failed: Agent not found" even though a later worker completed the turn and the run was `done`.
**Root Cause:** Direct recovery reattached to an existing worker session and then sent a duplicate prompt. If the worker was already active, the bridge returned "Agent is busy"; the app surfaced that as a failed recovery. The frontend also allowed older failed-run signals to outlive newer success events such as `worker_session_resumed` and `auto_commit_created`.
**Fix:** Treat an already-active recovered worker as a successful recovery and skip the duplicate prompt. If a race still returns "Agent is busy", keep the run running and record `direct_retry_worker_already_active` instead of surfacing a failure. On the client, suppress stale failed-run and recover-mutation errors when newer recovery success events exist.
**Verification:** `pnpm test tests/api/run-route.test.ts -- --runInBand`, `pnpm test tests/app/home-view-model.test.ts`, `pnpm test tests/supervisor/wake.test.ts -- --runInBand`, and `pnpm typecheck`.
**Prevention:** Recovery code must treat "busy" as evidence of a live worker, not as terminal failure. UI failure banners must be ordered against newer server success events before rendering.
**Skill/Doc Updates:** No skill update needed; `instrumenting-control-planes` and `client-server-state-invariants` already require named events, ordering, freshness, and terminal-state precedence. This note records the concrete OmniHarness case.
