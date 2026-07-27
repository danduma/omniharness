# Cancelled Workers Must Clear Live State

**Date:** 2026-07-09
**Context:** OmniHarness direct conversation stop flow and sidebar activity classification
**Symptom:** A user-stopped direct conversation could keep looking active in the sidebar after the run and worker rows were already `cancelled`.
**Root Cause:** Stop persisted the terminal worker status, but stale live-looking signals remained: cancelled conversations still counted as recent sidebar activity, and cancelled worker rows could retain `current_text`, which later snapshots could interpret as in-progress output.
**Fix:** Ignore recent-activity signals for cancelled sidebar runs unless another authority keeps them visible, and clear `workers.current_text` when stop marks a worker `cancelled` while preserving the visible text in `last_text`.
**Verification:** `pnpm exec vitest run tests/app/home/sidebar-activity.test.ts`; `pnpm exec vitest run tests/api/run-route.test.ts -t "marks a direct worker cancelled without waiting for the bridge stop to finish"`.
**Prevention:** When a server-side terminal transition is persisted, clear or retire fields whose names mean live/in-progress state in the same write. Do not rely on every frontend surface to reinterpret stale live fields.
**Skill/Doc Updates:** No global skill update needed; the existing client/server state and control-plane skills already require terminal states and server-owned decisions to be explicit. This note records the OmniHarness-specific persistence field rule.
