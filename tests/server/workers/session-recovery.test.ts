import { randomUUID } from "crypto";
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { appendWorkerEntryWithResult } from "@/server/workers/output-store";
import { isRejectedSavedSessionErrorMessage, materializeProviderSessionFromWorkerStream } from "@/server/workers/session-recovery";

async function seedWorkerStream(runId: string, workerId: string) {
  await appendWorkerEntryWithResult(runId, workerId, {
    id: `${workerId}-user`,
    type: "user_input",
    text: "continue the recovery",
    timestamp: "2026-05-25T01:02:03.000Z",
    authorRole: "user",
    channel: "stdin",
  });
  await appendWorkerEntryWithResult(runId, workerId, {
    id: `${workerId}-assistant`,
    type: "message",
    text: "I already inspected the failing worker.",
    timestamp: "2026-05-25T01:02:04.000Z",
    authorRole: "assistant",
    channel: "agent",
  });
}

describe("provider session materialization", () => {
  it("classifies Gemini's empty project session store as a rejected saved session", () => {
    expect(isRejectedSavedSessionErrorMessage(
      'Spawn failed: failed to start gemini agent via gemini: {"code":-32603,"message":"Internal error","data":{"details":"No previous sessions found for this project."}}',
    )).toBe(true);
  });

  it("reconstructs Gemini project sessions from GEMINI_CLI_HOME when the error omits the searched directory", async () => {
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const sessionId = randomUUID();
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "omni-gemini-home-recover-"));
    const geminiHome = path.join(root, "gemini-home");
    const configRoot = path.join(geminiHome, ".gemini");
    const cwd = "/workspace/app";
    await seedWorkerStream(runId, workerId);
    fs.mkdirSync(configRoot, { recursive: true });
    fs.writeFileSync(path.join(configRoot, "projects.json"), JSON.stringify({
      projects: { [cwd]: "workspace-app" },
    }));

    const materialized = await materializeProviderSessionFromWorkerStream({
      type: "gemini",
      runId,
      workerId,
      sessionId,
      cwd,
      env: { GEMINI_CLI_HOME: geminiHome },
      errorMessage: "No previous sessions found for this project.",
    });

    expect(materialized).toMatchObject({ provider: "gemini", messageCount: 2 });
    expect(materialized?.filePath.startsWith(path.join(configRoot, "tmp", "workspace-app", "chats"))).toBe(true);
    const sessionFile = fs.readFileSync(materialized!.filePath, "utf8");
    expect(sessionFile).toContain(sessionId);
    expect(sessionFile).toContain("continue the recovery");
    expect(sessionFile).toContain("I already inspected the failing worker.");
  });

  it("reconstructs Codex rollout JSONL and thread metadata", async () => {
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const sessionId = randomUUID();
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "omni-codex-recover-"));
    const codexHome = path.join(root, "codex-home");
    const sqliteHome = path.join(root, "codex-sqlite");
    await seedWorkerStream(runId, workerId);

    const materialized = await materializeProviderSessionFromWorkerStream({
      type: "codex",
      runId,
      workerId,
      sessionId,
      cwd: "/workspace/app",
      env: { CODEX_HOME: codexHome, CODEX_SQLITE_HOME: sqliteHome },
    });

    expect(materialized).toMatchObject({ provider: "codex", messageCount: 2 });
    expect(materialized?.filePath.startsWith(path.join(codexHome, "sessions"))).toBe(true);
    const rollout = fs.readFileSync(materialized!.filePath, "utf8");
    expect(rollout).toContain('"type":"session_meta"');
    expect(rollout).toContain("continue the recovery");
    expect(rollout).toContain("I already inspected the failing worker.");

    const row = execFileSync("sqlite3", [
      path.join(sqliteHome, "state_5.sqlite"),
      `select id || '|' || rollout_path || '|' || cwd from threads where id = '${sessionId.replaceAll("'", "''")}'`,
    ], { encoding: "utf8" }).trim();
    expect(row).toBe(`${sessionId}|${materialized?.filePath}|/workspace/app`);
  });

  it("reconstructs Claude project JSONL", async () => {
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const sessionId = randomUUID();
    const claudeConfig = fs.mkdtempSync(path.join(os.tmpdir(), "omni-claude-recover-"));
    await seedWorkerStream(runId, workerId);

    const materialized = await materializeProviderSessionFromWorkerStream({
      type: "claude",
      runId,
      workerId,
      sessionId,
      cwd: "/workspace/app",
      env: { CLAUDE_CONFIG_DIR: claudeConfig },
    });

    expect(materialized).toMatchObject({ provider: "claude", messageCount: 2 });
    expect(materialized?.filePath).toBe(path.join(claudeConfig, "projects", "-workspace-app", `${sessionId}.jsonl`));
    const lines = fs.readFileSync(materialized!.filePath, "utf8").trim().split("\n").map((line) => JSON.parse(line));
    expect(lines[0]).toMatchObject({ type: "queue-operation", operation: "enqueue", sessionId });
    expect(lines.some((line) => line.type === "user" && JSON.stringify(line).includes("continue the recovery"))).toBe(true);
    expect(lines.some((line) => line.type === "assistant" && JSON.stringify(line).includes("I already inspected"))).toBe(true);
  });

  it("reconstructs OpenCode session, message, part, and diff storage", async () => {
    const runId = randomUUID();
    const workerId = `${runId}-worker-1`;
    const sessionId = `ses_${randomUUID().replaceAll("-", "")}`;
    const xdgDataHome = fs.mkdtempSync(path.join(os.tmpdir(), "omni-opencode-recover-"));
    await seedWorkerStream(runId, workerId);

    const materialized = await materializeProviderSessionFromWorkerStream({
      type: "opencode",
      runId,
      workerId,
      sessionId,
      cwd: "/workspace/app",
      env: { XDG_DATA_HOME: xdgDataHome },
    });

    expect(materialized).toMatchObject({ provider: "opencode", messageCount: 2 });
    const session = JSON.parse(fs.readFileSync(materialized!.filePath, "utf8")) as { id: string; directory: string };
    expect(session).toMatchObject({ id: sessionId, directory: "/workspace/app" });
    const storageRoot = path.join(xdgDataHome, "opencode", "storage");
    expect(fs.existsSync(path.join(storageRoot, "message", sessionId))).toBe(true);
    expect(fs.existsSync(path.join(storageRoot, "session_diff", `${sessionId}.json`))).toBe(true);
  });
});
