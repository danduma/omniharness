# Direct Conversation Title Generation

**Date:** 2026-06-14
**Context:** OmniHarness conversation creation and sidebar titles
**Symptom:** Direct Claude conversations kept the raw first-line prompt as the sidebar title, for example truncating "session ef25debddace keeps showing a spinner..." instead of replacing it with an auto-generated title.
**Root Cause:** `shouldGenerateConversationTitle` treated `direct` mode like `commit` mode and skipped the title-generation queue entirely. The fallback title was persisted at run creation and no later title update was scheduled.
**Fix:** Only commit conversations skip generated titles; direct conversations now queue the same background title generation as other user request modes.
**Verification:** `PATH=/Users/masterman/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH ./node_modules/.bin/vitest run tests/api/conversations-route.test.ts`
**Prevention:** Do not conflate direct-control worker ownership with disabled background metadata. If a mode persists a temporary fallback title, add behavioral coverage for whether the replacement title is queued.
**Skill/Doc Updates:** No shared skill update needed; this is a project-specific ownership boundary between conversation control and sidebar metadata.
