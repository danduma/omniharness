# Account Snapshot DTO Redaction

**Date:** 2026-06-29
**Context:** OmniHarness account inventory and multi-account CLI credentials
**Symptom:** `/api/accounts` used a redacted account DTO, but `/api/events?snapshot=1` and runtime-portable snapshot payloads still serialized raw `accounts` rows, including `authRef`.
**Root Cause:** The account DTO boundary was added to the direct accounts API only. Snapshot builders loaded `db.select().from(accounts)` and returned those rows unchanged, so the event stream bypassed the redaction contract.
**Fix:** Event snapshot builders now map account rows through `toAccountDto`. Worker pool env fingerprints also include CLI account home namespaces so future account-specific prewarms do not share workers across credential homes. The multi-account design doc now records DTO, quota, artifact-stream, and runtime ordering requirements.
**Verification:** `pnpm vitest run tests/api/events-route.test.ts tests/runtime/http-routes.test.ts tests/server/agent-runtime/worker-pool.test.ts -t "redacts account credential references from (persisted snapshots|portable event snapshots)|separates prewarmed workers by account-specific CLI homes"`; `pnpm exec tsc --noEmit --pretty false`.
**Prevention:** Treat database account rows as private. Every public account-bearing payload, including SSE snapshots and portable runtime responses, must go through a whitelist DTO mapper and have a regression test that rejects secret refs.
**Skill/Doc Updates:** Updated `docs/superpowers/specs/2026-05-29-multi-account-cli-credentials.md`; no general skill update needed because existing control-plane and bug-learning guidance already covers redacted event boundaries.
