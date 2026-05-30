# Awaiting User Clarification Rows Are Question State

**Date:** 2026-05-30
**Context:** OmniHarness event snapshots, implementation conversations, and awaiting-user UI state.
**Symptom:** A conversation could be `awaiting_user` while the snapshot surfaced "no supervisor question was included" even though the server had a pending clarification record.
**Root Cause:** The lifecycle invariant and view model treated supervisor `messages` rows as the only valid question source. Pending `clarifications` rows are also durable question state, so a missing or legacy-unsynced message row made the snapshot look invalid and left the UI without a question to render.
**Fix:** The invariant now accepts a non-empty pending clarification as valid awaiting-user question state, both live and persisted snapshots pass clarifications into that check, and the home view model synthesizes a supervisor clarification message from the pending clarification row when the message row is absent.
**Verification:** `pnpm vitest run tests/api/events-route.test.ts tests/app/home-view-model.test.ts tests/app/conversation-execution-status.test.ts`; `pnpm tsc --noEmit`.
**Prevention:** When a user-facing state can be represented by both canonical records and transcript messages, snapshot invariants and UI selectors must recognize the canonical record, then synthesize view-only transcript shape if needed. Do not make lifecycle health depend on one denormalized render surface.
**Skill/Doc Updates:** No shared skill update needed; this is a local OmniHarness ownership rule for clarification persistence and snapshot rendering.
