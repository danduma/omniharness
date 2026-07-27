# Real Gateway Smokes Must Exercise Upstream Contracts

**Date:** 2026-07-13
**Context:** OmniHarness managed CLIProxyAPI integration for Claude Code
**Symptom:** The isolated real-network smoke initially failed before it could prove installation and readiness: release metadata was requested with a binary-oriented `Accept` header, and a later readiness retry used an unreferenced timer that allowed the short-lived smoke process to exit while `start()` was still awaiting the gateway.
**Root Cause:** Unit fixtures modeled successful fetches and kept Vitest's process alive, so they did not reproduce GitHub's real content-negotiation contract or Node's event-loop behavior in a standalone script.
**Fix:** Release metadata now explicitly requests GitHub JSON, while binary/checksum downloads keep their appropriate media types. The awaited readiness retry timer remains referenced until it resolves; only genuinely background work may use `unref()`.
**Verification:** `pnpm smoke:claude-model-gateway -- --require-network` downloaded CLIProxyAPI 7.2.71 for darwin/arm64, verified the official SHA-256 checksum, started the process, reached `/v1/models`, initiated OAuth, and stopped only the recorded owned process. Installer and process-manager unit suites also pass.
**Prevention:** For managed third-party binaries, keep a network-required smoke that exercises metadata negotiation, archive/checksum handling, process lifetime, readiness, management endpoints, and ownership-checked shutdown in a fresh temporary home. Do not `unref()` a timer that an awaited operation needs in order to complete.
**Skill/Doc Updates:** No general skill change was needed: the existing verification skill already requires real end-to-end proof. This note captures the Node process-lifetime and upstream content-negotiation details that are specific to managed gateway integrations.
