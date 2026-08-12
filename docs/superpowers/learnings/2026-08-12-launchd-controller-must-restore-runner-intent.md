# Launchd Controller Startup Must Restore Runner Intent

**Date:** 2026-08-12
**Context:** OmniHarness macOS boot-time restart controller and production runner
**Symptom:** After a Mac reboot, the launchd job and restart-control page returned, but no OmniHarness API/UI process listened on port 3050.
**Root Cause:** The installed LaunchDaemon owned only the restart controller on port 3099. The controller persisted the last runner mode but never consumed that record during its own startup, so a reboot removed the detached runner and restored only the button panel.
**Fix:** The launchd installer now explicitly enables startup restoration. On startup, the controller restores the recorded `dev` or `prod` mode only when the recorded process and all managed listeners are absent. The existing Stop path removes the record, preserving intentional shutdown.
**Verification:** `pnpm exec vitest run tests/server/restart-control.test.ts tests/scripts/install-restarter.test.ts tests/scripts/remote-restart.test.ts --reporter=dot`; reinstall the LaunchDaemon; verify listeners and health on ports 3050, 3099, and 7800.
**Prevention:** A boot-time control service is not equivalent to boot-time restoration of the service it controls. Installation tests must assert both launchd ownership and the explicit saved-intent restoration setting.
**Skill/Doc Updates:** The project README and runner operations guide now state the restoration contract. No general skill update was needed because the existing debugging and control-plane skills already require tracing every process boundary and making recovery decisions observable.
