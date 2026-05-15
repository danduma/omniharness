# Implementation Plan: CLI Quota Tracking

## Phase 1: Database and Core Parsing

1.  **Schema Update (`src/server/db/schema.ts`)**:
    *   Add the `worker_quota_snapshots` table as defined in the spec.
    *   Run drizzle-kit generate/migrate to apply the schema.
2.  **Parser Enhancements (`src/server/supervisor/worker-availability.ts`)**:
    *   Update `WorkerTokenQuotaInfo` type to include `costUsd: number | null`.
    *   Update `parseWorkerTokenQuotaOutput` to look for monetary amounts (e.g., regex `/\$[\d,]+\.\d{2}/`).
    *   Add tests in `tests/api/workers-availability.test.ts` to verify parsing of both tokens and costs.

## Phase 2: Background Polling

1.  **Service Logic (`src/server/supervisor/quota-tracker.ts`)**:
    *   Create a new file to house the polling logic.
    *   Implement `pollAllWorkerQuotas()`: Iterate supported types, fetch info, and insert into `worker_quota_snapshots`.
2.  **Watchdog Integration (`src/server/supervisor/runtime-watchdog.ts`)**:
    *   Add a timer (e.g., every 6 hours) to trigger `pollAllWorkerQuotas()`.
    *   Ensure it handles failures gracefully without crashing the main watchdog.

## Phase 3: API & CLI implementation

1.  **API Endpoints (`src/app/api/stats/quotas/route.ts`)**:
    *   Implement GET endpoint to return the latest snapshots and historical data grouped by worker type.
2.  **CLI Command (`src/server/cli/options.ts`, `src/server/cli/runner.ts`)**:
    *   Add `stats` to the CLI parser.
    *   Implement the handler in `runner.ts` (or a dedicated `stats.ts` file) to query the database and format the output into a readable table.

## Phase 4: Web UI Integration

1.  **API Client (`src/lib/api-client.ts` or similar)**: Add functions to fetch the quota stats.
2.  **UI Component (`src/app/components/settings/UsagePanel.tsx`)**:
    *   Create a new component to display the data.
    *   Design a table for current status.
    *   Add a simple visualization for historical trends (e.g., a bar chart showing token usage over the last 30 days).
3.  **Route Integration**: Add the new component to the settings dialog or a dedicated page.
