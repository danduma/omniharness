# Spec: CLI Quota and Token Tracking

## Objective
Track per-worker quota state (subscription remaining + reset, or API spend), surface it on conversation cards, and show a "waiting for quota reset" indicator with live ETA on any worker blocked on quota.

## Background & Motivation
Current CLIs like Claude Code and Codex either do not provide robust usage subcommands or only report basic login status. OmniHarness needs to accurately track token usage (input/output/cache) to project available quota, manage API spend, and enforce rate limits for its internal supervisor without relying solely on CLI stdout.

## Scope & Impact
- **Database Schema**: New `worker_quota_snapshots` and `worker_token_usage` tables.
- **Quota Policy**: Defined policies for `claude`, `codex`, `gemini`, and `opencode`.
- **Local Rollups**: Calculate remaining tokens by tracking token usage per turn, supplementing CLI outputs.
- **UI Updates**: Settings panel, sidebar wait badges, and per-worker quota chips.

## Core Architecture
1. **Schema Additions**:
   - `worker_token_usage`: persists per-turn token usage.
   - `worker_quota_snapshots`: caches aggregated states.
2. **Quota Tracker Service**: Event-driven polling and metric capture via `worker_turn_completed` events.
3. **Plan Tier Auto-Detection**: Extract plan tiers (e.g., Pro, ProLite) securely from local `.codex/auth.json` or macOS Keychain. **Includes a 'Default' tier fallback with conservative limits for CI/headless environments.**
4. **Supervisor Enforcement**: Integrate quota status into the supervisor's availability checks to block or delay worker spawning when quota is exhausted.
5. **UI Integration**: Live countdowns and token progress bars integrated into existing React components via SSE (`worker_quota_changed`).

## Security
- Live OAuth tokens or JWTs read for plan detection MUST NOT be logged or persisted in the DB.
- Extract only the required fields (like `chatgpt_plan_type`) and discard the rest immediately.
