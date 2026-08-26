import { beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, writeFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import Database from "better-sqlite3";
import {
  __resetCodexThreadTitleCacheForTests,
  readCodexThreadTitle,
} from "@/server/conversations/agent-thread-title";

/**
 * Codex keeps one row per session in `state_<n>.sqlite` under its state home.
 * Only the columns the reader touches are recreated here.
 */
function writeThreadIndex(args: {
  dir: string;
  fileName?: string;
  rows: { id: string; title: string; firstUserMessage?: string }[];
}) {
  mkdirSync(args.dir, { recursive: true });
  const database = new Database(join(args.dir, args.fileName ?? "state_5.sqlite"));
  database.exec(`CREATE TABLE threads (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    first_user_message TEXT NOT NULL DEFAULT ''
  );`);
  const insert = database.prepare("INSERT INTO threads (id, title, first_user_message) VALUES (?, ?, ?)");
  for (const row of args.rows) {
    insert.run(row.id, row.title, row.firstUserMessage ?? "");
  }
  database.close();
}

describe("readCodexThreadTitle", () => {
  let cwd: string;

  beforeEach(() => {
    __resetCodexThreadTitleCacheForTests();
    cwd = mkdtempSync(join(tmpdir(), "omni-codex-worker-"));
  });

  function projectStateDir() {
    return join(cwd, ".omniharness", "cli-home", "codex", "sqlite");
  }

  it("reads the thread index in the worker's project-scoped state home", async () => {
    writeThreadIndex({
      dir: projectStateDir(),
      rows: [{ id: "thread-a", title: "Sync and push everything", firstUserMessage: "commit, push, pull" }],
    });

    expect(await readCodexThreadTitle({ sessionId: "thread-a", worker: { id: "worker-1", cwd } })).toEqual({
      title: "Sync and push everything",
      firstUserMessage: "commit, push, pull",
    });
  });

  it("prefers the newest index when Codex leaves an older schema behind", async () => {
    writeThreadIndex({
      dir: projectStateDir(),
      fileName: "state_4.sqlite",
      rows: [{ id: "thread-b", title: "Stale title" }],
    });
    writeThreadIndex({
      dir: projectStateDir(),
      fileName: "state_5.sqlite",
      rows: [{ id: "thread-b", title: "Current title" }],
    });

    const result = await readCodexThreadTitle({ sessionId: "thread-b", worker: { id: "worker-1", cwd } });
    expect(result?.title).toBe("Current title");
  });

  it("returns null when the session has no row", async () => {
    writeThreadIndex({ dir: projectStateDir(), rows: [{ id: "someone-else", title: "Not ours" }] });

    expect(await readCodexThreadTitle({ sessionId: "thread-c", worker: { id: "worker-1", cwd } })).toBeNull();
  });

  it("returns null when there is no index at all", async () => {
    expect(await readCodexThreadTitle({ sessionId: "thread-d", worker: { id: "worker-1", cwd } })).toBeNull();
  });

  it("survives a file that is not a database", async () => {
    mkdirSync(projectStateDir(), { recursive: true });
    writeFileSync(join(projectStateDir(), "state_5.sqlite"), "not sqlite at all");

    expect(await readCodexThreadTitle({ sessionId: "thread-e", worker: { id: "worker-1", cwd } })).toBeNull();
  });

  it("sees a rename that lands after the first read", async () => {
    // The row is read again on every call: a thread named later in the session
    // has to reach the sidebar without a restart.
    writeThreadIndex({ dir: projectStateDir(), rows: [{ id: "thread-f", title: "First name" }] });
    await readCodexThreadTitle({ sessionId: "thread-f", worker: { id: "worker-1", cwd } });

    const database = new Database(join(projectStateDir(), "state_5.sqlite"));
    database.prepare("UPDATE threads SET title = ? WHERE id = ?").run("Renamed by the user", "thread-f");
    database.close();

    const result = await readCodexThreadTitle({ sessionId: "thread-f", worker: { id: "worker-1", cwd } });
    expect(result?.title).toBe("Renamed by the user");
  });
});
