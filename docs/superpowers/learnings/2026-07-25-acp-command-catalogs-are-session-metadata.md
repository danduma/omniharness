# ACP Command Catalogs Are Session Metadata

**Date:** 2026-07-25
**Context:** Starting a direct Claude Code session through the ACP worker stream
**Symptom:** A new conversation displayed every installed slash command as a large “Available commands” panel and also exposed the same update as terminal protocol activity.
**Root Cause:** OmniHarness correctly stored ACP `available_commands_update` messages, but two presentation paths treated the command catalog as conversation output: the direct conversation rendered an `AgentCommandMenu`, and the generic activity projector converted `available_commands` into a visible protocol event.
**Fix:** Kept command updates in the worker stream for session capabilities and future command completion, while removing the automatic command menu and excluding command catalogs from visible activity projection.
**Verification:** Focused tests confirm command catalogs are omitted from both conversation and protocol activity while plans, modes, and media remain visible.
**Prevention:** Classify protocol messages by audience before projecting them into a transcript. Capability catalogs and configuration metadata should remain internal unless the user explicitly opens a command picker or requests the information.
**Skill/Doc Updates:** No general skill update was needed. The existing debugging workflow already calls for tracing one protocol update through storage and every presentation path.
