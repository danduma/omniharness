# Pending Elicitations Are Input-Ready

**Date:** 2026-06-15
**Context:** OmniHarness direct worker conversations, queued messages, and CLI elicitation rendering
**Symptom:** A Claude `AskUserQuestion` prompt rendered as a Bash command, the conversation still displayed as working, and the user's answer stayed queued behind the worker's `working` status.
**Root Cause:** The UI inferred tool kind from prompt/title text, so an input request mentioning terminal work became `bash`. The queue drain also treated worker `working` as always non-drainable and ignored the bridge's authoritative `pendingElicitations`, so answers were not delivered through `respondElicitation`.
**Fix:** Preserve `AskUserQuestion` as a generic tool activity, route main-composer answers for direct `awaiting_user` runs through `respondElicitation`, and let queue draining proceed when the live snapshot has a pending elicitation even if the worker state is still `working`.
**Verification:** `node_modules/.bin/vitest run tests/lib/agent-output.test.ts tests/server/conversations-sync.test.ts tests/api/conversation-messages-route.test.ts`; `node_modules/.bin/tsc --noEmit --pretty false`.
**Prevention:** For interactive bridge requests, prefer structured runtime state such as `pendingElicitations` and tool metadata over text heuristics or generic busy-state gates.
**Skill/Doc Updates:** No shared skill update needed; this is a project-specific control-plane invariant now captured in a regression note and tests.
