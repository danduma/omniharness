# Catalog Discovery Must Not Block Conversation Load

**Date:** 2026-05-20
**Context:** OmniHarness conversation load, home bootstrap, worker catalog discovery
**Symptom:** Reloading an existing session could sit on "Loading session" or "Loading conversation" for many seconds to minutes. Server logs showed `/api/agents/catalog` taking 65s and 122s, followed by `/` and `/session/8ad0c5c3f219` taking about 130s.
**Root Cause:** The frontend treated worker catalog discovery as general app/bootstrap state. That made conversation rendering wait behind optional metadata. The catalog route could also perform blocking local CLI availability probes, so a slow or stuck probe serialized unrelated page and session requests.
**Fix:** Move catalog loading out of the conversation-load path. Fetch it only for onboarding, Agents settings, or explicit refresh; let existing conversations render from persisted run/worker metadata and cached/static runtime definitions. Keep live CLI checks bounded and return degraded catalog data when availability is slow.
**Verification:** Targeted app/API tests covered catalog cadence and non-blocking catalog behavior. Authenticated browser checks loaded recent conversations in under one second with zero catalog requests on the conversation-load path.
**Prevention:** Before adding a bootstrap query, ask whether the selected conversation can render without it. Catalogs, model lists, CLI health, and project file indexes are optional metadata unless the user is actively using a chooser, settings page, onboarding flow, file mention, or manual refresh.
**Skill/Doc Updates:** Updated `docs/architecture/hot-path-responsiveness-and-resource-leaks.md` because this is a control-plane hot-path rule, not just a local regression note. No generic skill update was needed beyond this project-specific architecture rule.
