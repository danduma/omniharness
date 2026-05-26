# Scoped Snapshots Must Not Own The Sidebar Catalog

**Date:** 2026-05-25
**Context:** OmniHarness event stream state manager and session sidebar.
**Symptom:** Clicking a session could make the whole left sidebar session list disappear and show loading until the selected conversation snapshot arrived.
**Root Cause:** A selected-run snapshot was treated as authoritative for global catalog arrays such as `runs` and `plans`. When a scoped cache or selected snapshot contained only the clicked run, the frontend erased the sidebar catalog even though that snapshot only owned selected-run detail. A later refinement found the inverse risk too: treating every scoped server snapshot as incomplete can preserve rows that a complete server catalog is intentionally deleting, such as archived conversations.
**Fix:** `EventStreamStateManager` merges selected-run snapshots into sidebar-owned catalog collections by stable keys only when `snapshotScope.catalog.complete === false`. Server-built snapshots declare `snapshotScope.catalog.complete: true`, so complete catalog payloads can still remove absent runs, plans, workers, sessions, or read markers.
**Verification:** Added `EventStreamStateManager > does not let selected-run snapshots erase the sidebar run catalog` and `EventStreamStateManager > lets complete server catalog snapshots remove absent runs`; targeted manager and API snapshot tests passed.
**Prevention:** Treat `snapshotRunId` as a scope hint, not a completeness proof. Snapshot payloads that can erase global UI catalogs must explicitly declare whether that catalog scope is complete.
**Skill/Doc Updates:** No general skill update needed; the repo learning captures the OmniHarness-specific ownership boundary and aligns with the existing client-server state invariant skill.
