import { describe, expect, it, vi } from "vitest";
import type { DbClient } from "@/server/db";
import { selectActiveGoalWorker } from "@/server/runs/goal-worker-lease";

function clientWithRows(rows: Array<Record<string, unknown>>) {
  return {
    execute: vi.fn(async () => ({ rows, rowsAffected: 0, lastInsertRowid: undefined })),
  } as unknown as Pick<DbClient, "execute">;
}

describe("goal active-worker lease selection", () => {
  it("keeps the current active lease instead of transferring to a newer worker", async () => {
    const client = clientWithRows([
      { id: "worker-1", status: "idle", bridge_session_id: "session-1", worker_number: 1, created_at: 1 },
      { id: "worker-2", status: "working", bridge_session_id: "session-2", worker_number: 2, created_at: 2 },
    ]);

    await expect(selectActiveGoalWorker(client, "run-1", "worker-1", "session-1")).resolves.toMatchObject({
      id: "worker-1",
      sessionId: "session-1",
    });
  });

  it("selects the newest active session while excluding terminal and sessionless workers", async () => {
    const client = clientWithRows([
      { id: "worker-old", status: "cancelled", bridge_session_id: "old-session", worker_number: 9, created_at: 9 },
      { id: "worker-sessionless", status: "working", bridge_session_id: null, worker_number: 8, created_at: 8 },
      { id: "worker-1", status: "idle", bridge_session_id: "session-1", worker_number: 1, created_at: 1 },
      { id: "worker-2", status: "recovering: bridge", bridge_session_id: "session-2", worker_number: 2, created_at: 2 },
    ]);

    await expect(selectActiveGoalWorker(client, "run-1", "worker-old", "old-session")).resolves.toMatchObject({
      id: "worker-2",
      sessionId: "session-2",
    });
  });
});
