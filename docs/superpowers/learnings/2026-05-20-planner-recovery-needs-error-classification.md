# Planner Recovery Needs Error Classification

**Date:** 2026-05-20
**Context:** OmniHarness planning review revision flow.
**Symptom:** Reviewer findings could cause the planning-review flow to check the original planner worker, and any `getAgent()` failure was treated as if the planner runtime session was missing.
**Root Cause:** A broad catch around planner liveness collapsed transient bridge/runtime failures and real missing-session failures into the same recovery branch. That made fresh planner spawn timing-dependent and could duplicate runtime state instead of surfacing a review failure.
**Fix:** Added an explicit missing-agent/session classifier before planner resume/recreate. Non-missing errors now propagate to the existing `plan.review.failed` and `error.surfaced` path. Planner resume/recreate also writes durable execution events and emits `worker.reattached` or `worker.recreated`.
**Verification:** `pnpm vitest run tests/server/planning/review-resume-source.test.ts`
**Prevention:** Recovery branches must classify the error that authorizes recovery. A broad catch is not a recovery policy.
**Skill/Doc Updates:** Updated `docs/architecture/timing-determinism-audit.md`; no general skill update needed because `instrumenting-control-planes` already calls out swallowed catches and requires observable recover/fail decisions.
