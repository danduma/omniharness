# Account Quota Blocking Must Not Remain Type-Wide

When adding multi-account CLI credentials, quota recovery cannot keep treating `codex`, `claude`, `gemini`, or `opencode` as the smallest blocking unit once account inventory exists.

The durable quota workflow still records exhausted workers as `cred-exhausted` and opens `quota_exhausted` incidents, but those incidents need an `accountId` in details whenever the worker has a `worker_credential_allocations` row. Type-level blocking should remain only as a legacy fallback when there is no usable account inventory for that worker type.

The allocator also has to avoid accounts with active quota incidents. Otherwise a healthy second account can exist while automatic allocation repeatedly selects the exhausted high-priority account.

Regression coverage:

- `tests/server/quota/type-blocking.test.ts` verifies one blocked account does not block the whole worker type while another account is usable.
- `tests/server/accounts/account-allocator.test.ts` verifies automatic allocation skips an active account quota incident.
