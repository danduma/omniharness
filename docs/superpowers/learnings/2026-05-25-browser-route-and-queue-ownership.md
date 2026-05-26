# Browser Route And Queue Ownership

**Date:** 2026-05-25
**Context:** OmniHarness frontend session routing and busy-message queue UI.
**Symptom:** The visible session could jump during Next.js dev refresh, and queued messages from one session could appear while viewing another session.
**Root Cause:** Client bootstrap selection trusted the bootstrap route before re-reading the actual browser URL, so a stale bootstrap payload could briefly own selection and rewrite the URL. Queued messages were also passed through the composer as a flat global list, relying on every caller to remember run scoping.
**Fix:** Parse the actual browser route before applying bootstrap selection or snapshot scope, and pass only selected-run queued messages into the composer/status surfaces. Added a queue-manager selected-run accessor for explicit ownership.
**Verification:** `pnpm vitest run tests/app/home-utils.test.ts tests/app/busy-message-queue-manager.test.ts tests/app/home-ui-state-manager.test.ts tests/app/live-event-connection-manager.test.ts` passed with 61 tests. Full `pnpm exec tsc --noEmit` is still blocked by existing `tests/supervisor/protocol.test.ts` `ProcessEnv` fixture typing errors unrelated to this change.
**Prevention:** For React state that can arrive from bootstrap, URL, streams, caches, or mutation callbacks, treat the browser route as the owner of visible selection and filter run-scoped UI data at the manager/render boundary.
**Skill/Doc Updates:** No shared skill update needed; this is a repo-specific ownership rule captured here and already matches the client-server state invariant skill.
