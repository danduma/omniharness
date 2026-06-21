# Project Moves Must Not Authorize Worker Resume

**Date:** 2026-06-15
**Context:** OmniHarness session project moves and stale direct-worker recovery.
**Symptom:** Moving a session to a different project caused an old direct worker session to be auto-resumed during event snapshot hydration.
**Root Cause:** `reconcilePersistedReloadZombies` used selected run id plus stale worker status and saved session metadata as sufficient authority to resume. After a session move, `runs.projectPath` can change while the persisted worker `cwd` and saved session still belong to the old project, so project-list metadata accidentally authorized runtime recovery.
**Fix:** Gate stale-worker auto-recovery on the worker cwd being inside the run's current project path. If the run has no project path, keep the legacy recovery behavior.
**Verification:** Added a regression test for a stale worker whose cwd is outside the run project. Ran the focused reconciler tests and the move-route test.
**Prevention:** Recovery code must verify that persisted worker identity still matches the run boundary before spawning or resuming external processes. Metadata-only moves should never become runtime-start authorization.
**Skill/Doc Updates:** No general skill update needed; this is a project-specific lifecycle invariant captured here for future OmniHarness work.
