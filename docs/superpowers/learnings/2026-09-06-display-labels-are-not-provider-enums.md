# Display Labels Are Not Provider Enums

**Date:** 2026-09-06
**Context:** OmniHarness composer effort selection and ACP worker launch
**Symptom:** Selecting `Extra High` launched Codex with `reasoning.effort: "extra high"`, which the provider rejected because the protocol enum is `xhigh`.
**Root Cause:** The composer stored a human-readable label and three submission paths serialized it with `toLowerCase()`. Runtime launch and recovery paths also lowercased persisted values without translating the legacy `extra high` and `extra-high` aliases.
**Fix:** Added one shared effort normalizer, used it for composer request serialization and at the agent-runtime boundary, and taught run-selection restoration to display canonical `xhigh` as `Extra High`.
**Verification:** A failing regression was added first. The focused composer/runtime tests then passed, followed by 166 adjacent agent-runtime, conversation, commit-settings, and run-selection tests.
**Prevention:** Keep human-facing labels separate from provider wire values. Canonicalize again at the final runtime boundary so old database rows, CLI input, handoffs, and recovery paths cannot bypass UI normalization.
**Skill/Doc Updates:** No general skill update was needed; this is a project protocol invariant now encoded in a shared helper and exercised at both the UI serialization and ACP launch boundaries.
