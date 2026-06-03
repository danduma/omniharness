# Auth Hash Config Validation

**Date:** 2026-06-03
**Context:** OmniHarness web auth
**Symptom:** Login failed with a runtime `Invalid hashed password: password hash string missing field` error when `OMNIHARNESS_AUTH_PASSWORD_HASH` was malformed.
**Root Cause:** Auth configuration treated any non-empty `OMNIHARNESS_AUTH_PASSWORD_HASH` as valid and passed it directly to Argon2 verification. If dotenv expansion damaged an unescaped `$argon2id$...` hash, the low-level verifier threw during login instead of the app reporting a stable configuration error.
**Fix:** Validate the Argon2 PHC hash shape in `getAuthConfigurationError()` before password verification. Malformed hashes now produce a 503 auth configuration response with instructions to regenerate or escape dollar signs in `.env` files.
**Verification:** `pnpm test tests/api/auth-route.test.ts`; `pnpm test tests/scripts/setup-auth.test.ts tests/server/restart-control.test.ts`; `pnpm exec eslint src/server/auth/config.ts tests/api/auth-route.test.ts`.
**Prevention:** Config-derived cryptographic material should be validated at the configuration boundary before entering verifier APIs. For dotenv-stored Argon2 hashes, keep dollar-sign escaping in setup tooling and add regressions for damaged hash strings.
**Skill/Doc Updates:** No shared skill update needed; the reusable lesson is project-specific to OmniHarness auth configuration and dotenv handling.
