# Runtime Recovery Must Handle Rejected Session Resume

- When a provider rejects a saved session id after process restart, do not leave the run `running` with every worker cancelled. The observer should recreate a fresh runtime worker when fresh spawn succeeds, and only cancel the worker when both resume and fresh spawn fail.
- Completion fallbacks must not rely on text length alone. Long planning/progress text and confirmation requests can exceed the threshold while work is still active.
- Project memory paths should canonicalize legacy `.omniharness/memory/...` prefixes and remain backward-compatible with older nested memory files.
