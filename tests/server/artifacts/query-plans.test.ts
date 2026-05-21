/**
 * Guards against silent regressions in the SQLite query plans that the
 * snapshot/hot-path queries rely on. We assert via `EXPLAIN QUERY PLAN`
 * that the relevant indexes are picked — if a future migration drops or
 * renames an index, these tests will fail with the exact plan SQLite
 * chose, making the regression obvious.
 */
import { describe, expect, it } from "vitest";
import { db } from "@/server/db";

interface ExplainRow {
  id: number;
  parent: number;
  notused: number;
  detail: string;
}

async function explain(sql: string, args: unknown[] = []): Promise<ExplainRow[]> {
  // libsql exposes `execute` on the underlying client.
  const client = (db as unknown as { $client: { execute: (args: { sql: string; args: unknown[] }) => Promise<{ rows: unknown[] }> } }).$client;
  const result = await client.execute({ sql: `EXPLAIN QUERY PLAN ${sql}`, args });
  return result.rows as unknown as ExplainRow[];
}

describe("query plans — hot snapshot paths", () => {
  it("execution_events snapshot uses execution_events_run_created_id_desc_idx", async () => {
    const rows = await explain(
      `SELECT * FROM execution_events WHERE run_id = ? ORDER BY created_at DESC, id DESC LIMIT 100`,
      ["sample-run"],
    );
    const detail = rows.map((r) => r.detail).join(" | ");
    expect(detail).toMatch(/USING INDEX execution_events_run_created/);
    // Must NOT be a table scan.
    expect(detail).not.toMatch(/SCAN execution_events\b(?!.*USING)/);
  });

  it("artifact_streams identity lookup uses artifact_streams_identity_idx", async () => {
    const rows = await explain(
      `SELECT * FROM artifact_streams WHERE run_id = ? AND kind = ? AND owner_id = ?`,
      ["sample-run", "execution_events", "__none__"],
    );
    const detail = rows.map((r) => r.detail).join(" | ");
    // The unique index is the only way to make this O(1).
    expect(detail).toMatch(/USING INDEX|USING COVERING INDEX/);
    expect(detail).not.toMatch(/SCAN artifact_streams\b(?!.*USING)/);
  });
});
