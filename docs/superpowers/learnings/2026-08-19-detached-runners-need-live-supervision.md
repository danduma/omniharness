# Detached Runners Need Live Supervision

**Date:** 2026-08-19
**Context:** OmniHarness restart control (`scripts/remote-restart.ts`, `src/server/restart-control.ts`)

## Symptom

The production runner disappeared twice while the launchd restart-control service stayed healthy. Port 3050, the agent bridge on port 7800, and the recorded runner process were all gone, but restart control still answered on port 3099. The first outage ended with an `ELIFECYCLE` failure after a bridge headers timeout. The second process disappearance had no shutdown, exception, crash report, or operating-system kill reason in the available logs.

In both cases the application remained offline until someone sent a manual restart request.

## Root Cause

Launchd supervised restart control, but restart control spawned the application as a detached process. It called `restorePreviousOnStartup()` only when restart control itself started. If the detached application died later while restart control remained alive, nothing checked the recorded process or managed listeners again.

The immediate persistence of the outage therefore had a definite cause even though the trigger that ended the second runner process remains unobserved: the ownership chain stopped at the controller. A healthy controller was not the same thing as a healthy application.

## Fix

Restart control now checks the managed runner every five seconds. If both the recorded process and managed listeners are gone, it restarts the previously recorded mode. Checks are serialized with manual restart work so the controller cannot launch competing replacements.

Recovery attempts are bounded at three consecutive unstable starts. The counter resets only after the replacement remains healthy for five minutes. Durable log records cover attempts, success, failure, stable reset, and giving up:

- `runner.supervision.restart_attempt`
- `runner.supervision.restart_succeeded`
- `runner.supervision.restart_failed`
- `runner.supervision.stable`
- `runner.supervision.gave_up`

These records go to `.omniharness/remote-restart.log`. During the incident the main runner, its SSE event ring, and its API are unavailable, so the external controller's durable log is the authoritative recovery surface. Emitting only into the dead runner's process-local event system would not make the decision observable.

## Verification

The focused restart-control suite passes all 18 tests, including automatic production recovery and bounded repeated failures. TypeScript and ESLint checks pass for the changed files.

The loaded controller was also tested against the real production process. Sending `SIGTERM` to the validated runner PID removed the old port-3050 listener. At 19:34:48 the controller logged `runner.supervision.restart_attempt`, spawned PID 43363, and logged `runner.supervision.restart_succeeded`. The bridge listened at 19:34:50 and the runner reported ready at 19:34:51. A fresh request to port 3050 returned HTTP 200.

## Prevention

Any service that detaches a long-running child must own one of two things for the child's full lifetime: a real service-manager job for the child, or a live reconciliation loop that compares intended state with both process and listener evidence. One startup-time restore is not supervision.

Recovery loops also need terminal outcomes. Infinite retries can turn an outage into a resource loop, while silent bounded retries hide that recovery stopped. Count attempts, define what stability means, and record both successful recovery and give-up decisions outside the process being recovered.

## Skill/Doc Updates

No general skill update is needed. The lifecycle observability specification already requires named decisions and terminal recovery outcomes. This incident exposed an ownership gap in the external restart controller; the new tests and durable controller records cover that gap directly.
