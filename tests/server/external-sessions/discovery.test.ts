import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  discoverExternalClaudeSessions,
  loadExternalClaudeSession,
} from "@/server/external-sessions/discovery";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("discoverExternalClaudeSessions", () => {
  it("uses macOS Claude Desktop metadata while keeping the resumable CLI session id", async () => {
    const configDir = await mkdtemp(join(tmpdir(), "omni-external-sessions-cli-"));
    const desktopSessionsDir = await mkdtemp(join(tmpdir(), "omni-external-sessions-desktop-"));
    tempRoots.push(configDir, desktopSessionsDir);

    const cliSessionId = "065549d0-1f18-46aa-b5a0-9d8900b1302e";
    const desktopSessionId = "local_6b6e7613-5c84-40b8-8527-152cc7dbfa45";
    const cliProjectDir = join(configDir, "projects", "-Users-masterman-NLP-omniharness");
    const cliSessionPath = join(cliProjectDir, `${cliSessionId}.jsonl`);
    const desktopWorkspaceDir = join(desktopSessionsDir, "account-id", "workspace-id");
    const desktopSessionPath = join(desktopWorkspaceDir, `${desktopSessionId}.json`);

    await Promise.all([
      mkdir(cliProjectDir, { recursive: true }),
      mkdir(desktopWorkspaceDir, { recursive: true }),
    ]);
    await Promise.all([
      writeFile(cliSessionPath, `${JSON.stringify({
        cwd: "/Users/masterman/NLP/omniharness",
        sessionId: cliSessionId,
        message: { role: "user", content: "A long first prompt that is not the Desktop title" },
      })}\n`),
      writeFile(desktopSessionPath, JSON.stringify({
        sessionId: desktopSessionId,
        cliSessionId,
        cwd: "/Users/masterman/NLP/omniharness",
        originCwd: "/Users/masterman/NLP/omniharness",
        title: "Omniharness code session",
        lastActivityAt: Date.parse("2026-07-30T22:04:48.026Z"),
        isArchived: false,
      })),
    ]);
    await utimes(
      cliSessionPath,
      new Date("2026-07-30T21:00:00.000Z"),
      new Date("2026-07-30T21:00:00.000Z"),
    );

    const sessions = await discoverExternalClaudeSessions(configDir, desktopSessionsDir);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      sessionId: cliSessionId,
      projectPath: "/Users/masterman/NLP/omniharness",
      sessionFilePath: cliSessionPath,
      title: "Omniharness code session",
      lastModified: new Date("2026-07-30T22:04:48.026Z"),
    });
    expect(sessions[0]?.sessionId).not.toBe(desktopSessionId);
  });

  it("returns only the newest file when a session UUID appears in multiple project directories", async () => {
    const configDir = await mkdtemp(join(tmpdir(), "omni-external-sessions-"));
    tempRoots.push(configDir);

    const sessionId = "f44c3247-ee38-4777-88ff-c5c01ce47fa9";
    const olderProjectDir = join(configDir, "projects", "-Volumes-Lexar-NLP-dis3");
    const newerProjectDir = join(configDir, "projects", "-Users-masterman-NLP-dis3");
    const olderSessionPath = join(olderProjectDir, `${sessionId}.jsonl`);
    const newerSessionPath = join(newerProjectDir, `${sessionId}.jsonl`);

    await Promise.all([
      mkdir(olderProjectDir, { recursive: true }),
      mkdir(newerProjectDir, { recursive: true }),
    ]);
    await Promise.all([
      writeFile(olderSessionPath, `${JSON.stringify({
        cwd: "/Volumes/Lexar/NLP/dis3",
        message: { role: "user", content: "Older copy" },
      })}\n`),
      writeFile(newerSessionPath, `${JSON.stringify({
        cwd: "/Users/masterman/NLP/dis3",
        message: { role: "user", content: "Newer copy" },
      })}\n`),
    ]);
    await Promise.all([
      utimes(olderSessionPath, new Date("2026-07-11T12:00:00.000Z"), new Date("2026-07-11T12:00:00.000Z")),
      utimes(newerSessionPath, new Date("2026-07-11T12:05:00.000Z"), new Date("2026-07-11T12:05:00.000Z")),
    ]);

    const sessions = await discoverExternalClaudeSessions(configDir);

    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      sessionId,
      projectPath: "/Users/masterman/NLP/dis3",
      sessionFilePath: newerSessionPath,
      title: "Newer copy",
    });
  });

  it("loads visible user and assistant turns for a resumed Claude session", async () => {
    const configDir = await mkdtemp(join(tmpdir(), "omni-external-session-transcript-"));
    tempRoots.push(configDir);

    const sessionId = "735c1ee1-3bbd-4f36-a850-6d21fe061d4f";
    const projectDir = join(configDir, "projects", "-workspace-app");
    const sessionPath = join(projectDir, `${sessionId}.jsonl`);
    await mkdir(projectDir, { recursive: true });
    await writeFile(sessionPath, [
      JSON.stringify({
        type: "user",
        uuid: "user-entry",
        timestamp: "2026-07-30T22:00:00.000Z",
        cwd: "/workspace/app",
        message: { role: "user", content: "Why is resume broken?" },
      }),
      JSON.stringify({
        type: "assistant",
        uuid: "assistant-thinking",
        timestamp: "2026-07-30T22:00:00.500Z",
        message: { role: "assistant", content: [{ type: "thinking", thinking: "private" }] },
      }),
      JSON.stringify({
        type: "assistant",
        uuid: "assistant-tool",
        timestamp: "2026-07-30T22:00:01.000Z",
        message: {
          role: "assistant",
          content: [{
            type: "tool_use",
            id: "tool-1",
            name: "Read",
            input: { file_path: "/workspace/app/package.json" },
          }],
        },
      }),
      JSON.stringify({
        type: "user",
        uuid: "tool-result",
        timestamp: "2026-07-30T22:00:02.000Z",
        message: {
          role: "user",
          content: [{ type: "tool_result", tool_use_id: "tool-1", content: "package contents" }],
        },
      }),
      JSON.stringify({
        type: "assistant",
        uuid: "assistant-entry",
        timestamp: "2026-07-30T22:01:00.000Z",
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "I found" },
            { type: "text", text: "the cause." },
          ],
        },
      }),
    ].join("\n") + "\n");

    const session = await loadExternalClaudeSession(sessionId, configDir);

    expect(session).toMatchObject({
      sessionId,
      title: "Why is resume broken?",
      entries: [
        {
          id: `external-claude:${sessionId}:user-entry`,
          type: "user_input",
          text: "Why is resume broken?",
          timestamp: "2026-07-30T22:00:00.000Z",
          authorRole: "user",
        },
        {
          id: `external-claude:${sessionId}:assistant-tool:0`,
          type: "tool_call",
          text: "Read",
          timestamp: "2026-07-30T22:00:01.000Z",
          toolCallId: "tool-1",
          toolKind: "Read",
          status: "pending",
        },
        {
          id: `external-claude:${sessionId}:tool-result:0`,
          type: "tool_call_update",
          text: "Read completed",
          timestamp: "2026-07-30T22:00:02.000Z",
          toolCallId: "tool-1",
          toolKind: "Read",
          status: "completed",
        },
        {
          id: `external-claude:${sessionId}:assistant-entry`,
          type: "message",
          text: "I found\n\nthe cause.",
          timestamp: "2026-07-30T22:01:00.000Z",
          authorRole: "assistant",
        },
      ],
    });
  });
});
