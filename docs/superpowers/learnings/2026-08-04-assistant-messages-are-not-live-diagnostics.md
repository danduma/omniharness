# Assistant Messages Are Not Live Diagnostics

**Date:** 2026-08-04
**Context:** OmniHarness agent runtime and unified worker conversation stream
**Symptom:** Fable's final 7,738-character answer rendered without its beginning in run `f3987ae9caa2`, even though the provider and `workers.last_text` held the complete answer.
**Root Cause:** The runtime used the 5,000-character live diagnostic limit for assistant `message` entries. Once streaming crossed that limit, every new revision kept only the suffix. The worker stream persisted those suffix-only revisions, and the frontend correctly treated the latest revision as authoritative.
**Fix:** Preserve assistant `message` entries in full while retaining bounds for tool diagnostics and thought previews. Append a complete revision to the affected run so its existing answer is readable again.
**Verification:** `pnpm vitest run tests/server/agent-runtime/output-store.test.ts`; the restored stream's seq 750 contains all 7,738 characters and begins with `The audit is done.`
**Prevention:** Treat user-visible model messages as durable transcript content at every bridge, snapshot, persistence, and rendering boundary. Never reuse diagnostic-output limits for conversation messages.
**Skill/Doc Updates:** Updated `docs/architecture/worker-conversation-stream.md` with the completeness invariant; no general Codex skill update was needed because this rule is specific to OmniHarness's bridge-to-stream contract.
