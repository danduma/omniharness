# Agent Titles Must Not Adopt Control Prompts

**Date:** 2026-08-06
**Context:** OmniHarness direct-worker conversation titles
**Symptom:** Some direct and commit sessions used the full OmniHarness direct-control instruction plus the user request as their sidebar title.
**Root Cause:** Direct-worker control text is intentionally prepended to the effective worker prompt. Agent-generated session titles were trusted at the persistence boundary, so a provider that echoed that prompt could overwrite the normal first-line conversation title.
**Fix:** Reject agent-session titles containing the direct-control prompt marker before writing them to `runs.title`. The existing fallback title remains intact, while ordinary agent-generated titles continue to be adopted.
**Verification:** `./node_modules/.bin/vitest run tests/server/conversations/agent-session-title.test.ts tests/server/conversations/agent-transcript-title.test.ts tests/server/workers/output-store.test.ts tests/server/worker-snapshot-initial-prompt.test.ts --pool=forks --poolOptions.forks.singleFork=true`; direct `tsc` checks for shared, runner, interface, and root projects.
**Prevention:** Treat provider-generated metadata as untrusted input. Validate it at the final persistence boundary, especially when the provider sees internal control prompts as part of its effective user input.
**Skill/Doc Updates:** No shared skill update needed; this is a project-specific metadata validation boundary.
