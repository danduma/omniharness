# Project Memory Save Ownership Includes Content

**Date:** 2026-05-20
**Context:** OmniHarness project memory settings panel.
**Symptom:** A save request could finish after the draft changed and mark the newer draft as saved.
**Root Cause:** `ProjectMemoryPanelManager.save()` proved only request id, project path, and selected file path before applying save success. The submitted content was not part of the owner token, so the old completion could set `originalContent` and `saveStatus: "saved"` for a newer draft.
**Fix:** Save success now checks that the current draft content still equals the submitted content before marking the file saved. If the draft changed, it only clears `saving` and leaves the draft dirty.
**Verification:** Added `ProjectMemoryPanelManager` regressions for stale save completion plus toggle ownership and ran `pnpm vitest run tests/app/project-memory-panel-manager.test.ts`.
**Prevention:** For editor-like async saves, owner identity is not just file path. Include the submitted content or a draft generation before applying completion UI.
**Skill/Doc Updates:** Updated `docs/architecture/timing-determinism-audit.md`; no general skill change needed because `client-server-state-invariants` already requires owner tokens for async results.
