# Implementation Plan: CLI Quota Tracking

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Phase 1: Data model and parsing

- [ ] **Step 1:** Modify `src/server/db/schema.ts` to add `worker_quota_snapshots` and `worker_token_usage` tables.
- [ ] **Step 2:** Generate and apply database migrations using `pnpm drizzle-kit generate` and `pnpm drizzle-kit push`.
- [ ] **Step 3:** Update `src/server/supervisor/worker-availability.ts` to extend `WorkerTokenQuotaInfo` with `mode`, `costUsd`, `currency`, and `windows[]`.

## Phase 2: Plan-tier auto-detection

- [ ] **Step 1:** Create `src/server/quota/plan-detection.ts` to read local credentials securely (Keychain for Claude, `.codex/auth.json` for Codex). Define 'Default' tier fallback for non-macOS/CI environments.
- [ ] **Step 2:** Create `src/server/quota/plan-limits.ts` to map detected tiers to limits (e.g., 5-hour, weekly).

## Phase 3: Token-usage persistence & Event-driven polling

- [ ] **Step 1:** Create `src/server/quota/policy.ts` to define per-CLI polling policy.
- [ ] **Step 2:** Create `src/server/quota/model-rates.ts` with hardcoded costs for popular models.
- [ ] **Step 3:** Update CLI log parsers to extract token metrics (input/output/cache) from stdout/stderr.
- [ ] **Step 4:** Hook into `worker_turn_completed` in `src/server/supervisor/observer.ts` to write parsed metrics to `worker_token_usage`.
- [ ] **Step 5:** Create `src/server/quota/tracker.ts` and `src/server/quota/status.ts` for local token usage rollups and snapshot updates.
- [ ] **Step 6:** Integrate `getWorkerQuotaStatus` into `isSpawnableWorkerType` in `src/server/supervisor/worker-availability.ts` to enforce quota blocks.

## Phase 4: API & UI

- [ ] **Step 1:** Add `GET /api/quota/status` endpoint and extend the run detail endpoint to include quota info.
- [ ] **Step 2:** Define and add new i18n keys to all supported locale files in `shared/locales/` for quota-related labels and countdowns.
- [ ] **Step 3:** Create `WorkerQuotaWaitBadge` component for countdown display.
- [ ] **Step 4:** Implement worker quota chip in `ConversationSidebar.tsx` and `ConversationMain.tsx`.
- [ ] **Step 5:** Update `src/components/settings/UsagePanel.tsx` with a 30-day token usage bar chart and current status table.

## Phase 5: Testing

- [ ] **Step 1:** Write unit tests for schema changes, token rollups (`tests/server/quota/usage-rollup.test.ts`), and tracker scheduling.
- [ ] **Step 2:** Write security tests (`tests/server/quota/plan-detection-leak.test.ts`) ensuring token values don't leak into logs or telemetry.
- [ ] **Step 3:** Write UI and API integration tests reflecting the new `QuotaStatus` schema and SSE event stream (`worker_quota_changed`).
