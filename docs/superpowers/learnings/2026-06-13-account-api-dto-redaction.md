# Account API Rows Need Redaction DTOs

**Date:** 2026-06-13
**Context:** OmniHarness account inventory and multi-account CLI credentials
**Symptom:** `/api/accounts` returned raw `accounts` rows, including `authRef`, while the multi-account design plans to add more credential and account metadata.
**Root Cause:** The route used `db.select().from(accounts)` directly as the response body, so the database row shape doubled as the public API contract.
**Fix:** Added a whitelisted account DTO mapper and routed `/api/accounts` responses through it so credential references are not serialized.
**Verification:** `pnpm vitest run tests/api/read-support-routes.test.ts tests/runtime/http-routes.test.ts`; `pnpm exec tsc --noEmit --pretty false`.
**Prevention:** Do not expose persistence rows directly from account or credential APIs. Add new public account fields only through an explicit DTO whitelist, and regression-test that secret references are absent from serialized payloads.
**Skill/Doc Updates:** No general skill update needed; the existing control-plane and verification guidance already requires explicit boundaries and no secret leakage.
