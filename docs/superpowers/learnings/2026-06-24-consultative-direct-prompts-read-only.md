# Consultative Direct Prompts Need Explicit Non-Implementation Instructions

**Date:** 2026-06-24
**Context:** OmniHarness direct-control Claude conversations.
**Symptom:** Session `68d1442869a0` edited the CloudCaptions landing page after the user asked how Claude would tweak it and intended suggestions only.
**Root Cause:** Direct conversations sent the user's raw text to Claude. The prompt was phrased as advice-seeking but was ambiguous enough for the model to infer implementation, and direct mode's normal permission posture left that inference unchecked.
**Fix:** Direct worker prompts now include a default OmniHarness instruction: do not implement, edit files, run mutating commands, or change the workspace unless the latest user message explicitly asks for implementation/modification. Advice, suggestions, and planning requests must stay answer-only.
**Verification:** `pnpm exec vitest run tests/server/worker-launch-mode.test.ts tests/api/conversations-route.test.ts tests/api/conversation-messages-route.test.ts -t "worker launch mode|hardens consultative direct prompts|fire-and-forget follow-up"` passes.
**Prevention:** For direct-control agents, preserve power but make the default intent contract explicit on every user turn. Store the user's original message in OmniHarness, but wrap the worker-facing prompt with the non-implementation rule.
**Skill/Doc Updates:** No shared skill update needed. This is a project-specific direct-worker prompt contract.
