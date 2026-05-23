# Pair Device Polls Need Same-Pairing Generations

**Date:** 2026-05-20
**Context:** OmniHarness phone pairing dialog and frontend state manager ownership
**Symptom:** Pairing status polling was protected against a different QR code becoming current, but two overlapping polls for the same pairing could resolve out of order. A late older poll could replace a newer `redeemed` status with stale `pending`, or surface a stale error after a newer success.
**Root Cause:** `patchIfCurrentPairing(pairingId, ...)` proved only pairing ownership. It did not prove request ownership within the same pairing. The interval callback could start another status request before the previous one settled.
**Fix:** Added per-poll request ids to `PairDeviceStateManager`. `PairDeviceDialog` now calls `beginStatusPoll(pairingId)` before each request and applies responses/errors through `patchIfCurrentStatusPoll(pairingId, requestId, ...)`.
**Verification:** Added a red regression in `tests/app/pair-device-manager.test.ts`, then passed `pnpm vitest run tests/app/pair-device-manager.test.ts tests/ui/pair-device-dialog.test.ts` with 4 tests passing.
**Prevention:** When polling the same owner repeatedly, guard both the owner id and the request generation. "Still the same object" is not enough if older and newer reads for that object can overlap.
**Skill/Doc Updates:** Updated `docs/architecture/timing-determinism-audit.md` with the resolved pair-device poll generation invariant. No global skill change was needed because the existing client/server state invariant already calls for request tokens on async responses.
