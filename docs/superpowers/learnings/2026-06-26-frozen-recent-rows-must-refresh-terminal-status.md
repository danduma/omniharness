# Frozen Recent Rows Must Refresh Terminal Status

**Date:** 2026-06-26
**Context:** OmniHarness conversation sidebar Recent tab.
**Symptom:** Session `559094b145ff` was persisted as `done`, its worker and live agent were `idle`, but the Recent sidebar could keep showing a working spinner forever.
**Root Cause:** `useFrozenRecentOrder` intentionally froze Recent-tab membership and order while the tab stayed open. When a row was snapshotted as `running` and then completed, it could drop out of `activeProjects`; the freeze layer then fell back to the old snapshotted row, preserving the stale `running` status.
**Fix:** Keep frozen membership/order, but refresh frozen rows from the full live sidebar catalog before falling back to the snapshot.
**Verification:** Added a regression where a frozen `running` row leaves Recent after completing and must render as `done`; verified with `pnpm vitest run tests/app/use-frozen-recent-order.test.ts tests/app/home/sidebar-activity.test.ts tests/app/event-stream-state-manager.test.ts`.
**Prevention:** Any UI cache or frozen ordering layer may preserve membership/order only. Canonical row fields such as status, title, unread state, and terminal state must be refreshed from the current authoritative catalog whenever available.
**Skill/Doc Updates:** No skill update needed; `client-server-state-invariants` already covers stale cached data and terminal-state ownership.
