# Redaction Must Cover Thrown Control-Plane Errors

**Date:** 2026-07-13
**Context:** OmniHarness Claude model gateway control plane
**Symptom:** Gateway failure events and status snapshots were redacted, but action methods rethrew the original exception. The HTTP route used that exception message, so an upstream error containing a configured token could still reach the browser.
**Root Cause:** Redaction was treated as a serialization concern for events and snapshots instead of a boundary invariant for every public result, including rejected promises.
**Fix:** Gateway operations now throw a new error containing the same redacted public message used by status/events while retaining the original exception as the internal `cause`. Tests inject a token-shaped value and assert it is absent from the rejected error and emitted records.
**Verification:** `pnpm vitest run tests/server/integrations/claude-model-gateway/service.test.ts tests/runtime/claude-model-gateway-route.test.ts` passes, including the redaction regression.
**Prevention:** For secret-bearing control planes, test all outward channels independently: success payloads, status snapshots, named events, logs, and thrown/HTTP errors. Redacting one serializer is not sufficient.
**Skill/Doc Updates:** No general skill change was needed. The project's lifecycle rules already require safe surfaced errors; this note records that rejected operations are part of the same public boundary.
