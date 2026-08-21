# Credential Verdicts Must Survive Reconciliation

**Date:** 2026-08-21
**Context:** Claude OAuth revocation recovery, session `04424fc6ed97`

## Symptom

Claude rejected a prompt with `401 OAuth access token has been revoked`. OmniHarness independently probed the allocated account and proved the credential dead, but after a server restart the conversation again showed generic advice to send another message and respawn the worker. Repeating that action could only allocate the same revoked account and fail again.

## Root Cause

The verified-dead result was encoded as a marker in `runs.last_error`. Live bridge reconciliation later preferred `agent.lastError`, which contains only the provider's raw text, and overwrote the richer persisted value. That removed the account ID the UI needed to open the in-app sign-in operation.

The account inventory row also remained enabled with no `login_required` status. A proven-dead credential therefore remained eligible for later allocation even though the run-level event history knew it was unusable.

The original regression test asserted state immediately after the failed prompt. It never exercised the destructive sequence: verified failure, restart, raw bridge snapshot, reconciliation, and user recovery action.

## Fix

- Reconciliation preserves verified live/dead credential verdicts when the bridge repeats an auth-shaped raw error.
- Older already-corrupted runs self-heal from the append-only `worker_credential_verified` execution event on their next sync.
- Account inventory also repairs the newest dead verdict independently of run status, so a run that later moves back to `running` cannot make the revoked account allocatable again. A newer successful status check or a newly recreated account fences old evidence.
- A dead verdict disables the account and records `login_required`, so the allocator cannot select it again before reauthentication.
- Recovery emits `account.credential_verdict_recovered`, `account.status_checked`, and `account.login_required` decisions.
- The conversation action opens the managed Claude sign-in dialog inside OmniHarness, and its copy no longer instructs the user to leave the app for a terminal.

## Verification

The lifecycle scenario now recreates the legacy corrupted state, resets the event epoch, feeds a raw post-restart bridge snapshot, and asserts that both the run marker and account status are repaired. The full lifecycle harness passes 51/51 tests.

An isolated Playwright journey seeds a synthetic revoked session in a temporary OmniHarness data root, verifies that no reconnect/respawn advice is shown, clicks **Sign in again**, and confirms the in-app Claude authentication operation opens. Typecheck, targeted lint, and the production interface build also pass.

## Prevention

Provider snapshots are observations, not authoritative replacements for control-plane decisions derived from stronger evidence. Reconciliation must merge observations with durable verdicts and must never downgrade verified state to raw text.

Every recovery regression test must cross the lifecycle boundary that previously erased the decision. For restart-sensitive failures, an immediate post-error assertion is insufficient: reset process-local state, replay the weaker external snapshot, then assert the final user action and allocator eligibility.
