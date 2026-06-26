# Explicit Worker Selection Must Constrain Allowed Types

**Date:** 2026-06-26
**Context:** OmniHarness composer worker selection, implementation-run supervisor wake
**Symptom:** A user selected Claude in the composer while answering an implementation clarification, but the resumed run spawned Codex workers.
**Root Cause:** Follow-up messages stored the selected worker as `preferredWorkerType` while still sending the full active worker pool as `allowedWorkerTypes`. The supervisor tool treats allowed workers as the hard contract and the preferred worker as guidance, so Codex remained legal and could be selected.
**Fix:** Explicit composer or natural-language worker switches now persist `allowedWorkerTypes` as only the selected worker. Auto selection still sends the active worker pool.
**Verification:** `pnpm vitest run tests/api/conversation-messages-route.test.ts -t "applies the selected composer worker|understands natural language worker switch"` passed. `codex-acp --help` also exits cleanly after removing the invalid `service_tier` config line.
**Prevention:** When a user explicitly picks or switches worker type, treat that as a constraint at the server boundary, not merely a prompt preference.
**Skill/Doc Updates:** No general skill update needed; the existing control-plane guidance already requires server decisions to preserve explicit user intent.
