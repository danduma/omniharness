# Resource Guard Margins Are Not Worker Estimates

**Date:** 2026-05-26
**Context:** OmniHarness worker spawn admission and resource pressure guard
**Symptom:** A worker recovery was refused even though `memory_pressure -Q` reported 38% system-wide free memory. The error said memory headroom after pending spawns was below the 4 GiB floor.
**Root Cause:** The admission check treated the configured stability margin as a post-spawn projected floor, subtracting the new worker estimate before comparing against the margin. On a 16 GiB machine, the former 25% default margin became an effective 34%+ threshold, and one pending reservation could push it above 40%.
**Fix:** Keep the stability floor as the admission floor. Pending spawn reservations still reduce available headroom, but the worker currently being admitted is not double-counted before admission.
**Verification:** `pnpm vitest run tests/server/agent-runtime/manager-reaper.test.ts -t "resource admission"` passes, including a regression for 38% free memory with an existing pending reservation.
**Prevention:** Resource guards should explain and test the exact threshold they enforce. Worker estimates are for concurrent-spawn dampening, not for silently raising the user's configured stability margin.
**Skill/Doc Updates:** No shared skill update needed; this is an OmniHarness resource-guard invariant captured in project learnings.
