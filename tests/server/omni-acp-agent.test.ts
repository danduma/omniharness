import { beforeEach, describe, expect, it, vi } from "vitest";
import * as acp from "@agentclientprotocol/sdk";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { OmniHarnessAcpAgent } from "@/server/omni-acp/agent";
import { db } from "@/server/db";
import { messages, plans, runs, workers } from "@/server/db/schema";

describe("OmniHarnessAcpAgent", () => {
  beforeEach(async () => {
    await db.delete(messages);
    await db.delete(workers);
    await db.delete(runs);
    await db.delete(plans);
  });

  async function insertRun(overrides: Partial<typeof runs.$inferInsert> = {}) {
    const planId = overrides.planId ?? randomUUID();
    const runId = overrides.id ?? randomUUID();
    const now = new Date();
    await db.insert(plans).values({
      id: planId,
      path: `vibes/ad-hoc/${planId}.md`,
      status: "running",
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(runs).values({
      id: runId,
      planId,
      mode: "direct",
      status: "running",
      projectPath: "/workspace/app",
      title: "Existing ACP run",
      createdAt: now,
      updatedAt: now,
      ...overrides,
    });
    return runId;
  }

  it("advertises OmniHarness modes as ACP session modes", async () => {
    const agent = new OmniHarnessAcpAgent({
      sessionUpdate: vi.fn(),
    } as any);

    const initialized = await agent.initialize({
      protocolVersion: acp.PROTOCOL_VERSION,
      clientCapabilities: {},
    });
    const session = await agent.newSession({
      cwd: "/workspace/app",
      mcpServers: [],
    });

    expect(initialized.agentInfo?.name).toBe("OmniHarness");
    expect(initialized.agentCapabilities?.loadSession).toBe(true);
    expect(initialized.agentCapabilities?.sessionCapabilities?.list).toEqual({});
    expect(initialized.agentCapabilities?.sessionCapabilities?.resume).toEqual({});
    expect(initialized.agentCapabilities?.sessionCapabilities?.fork).toEqual({});
    expect(session.modes?.currentModeId).toBe("implementation");
    expect(session.modes?.availableModes.map((mode) => mode.id)).toEqual([
      "implementation",
      "planning",
      "direct",
    ]);
  });

  it("starts a same-backed Omni conversation from an ACP prompt", async () => {
    const createConversation = vi.fn().mockResolvedValue({
      planId: "plan-1",
      runId: "run-1",
      mode: "planning",
    });
    const waitForTurn = vi.fn(async ({ emit }: { emit: (text: string) => Promise<void> }) => {
      await emit("worker update");
      return { stopReason: "end_turn" as const };
    });
    const sessionUpdate = vi.fn();
    const agent = new OmniHarnessAcpAgent({ sessionUpdate } as any, {
      createConversation,
      sendConversationMessage: vi.fn(),
      waitForTurn,
    });
    const session = await agent.newSession({ cwd: "/workspace/app", mcpServers: [] });
    await agent.setSessionMode({ sessionId: session.sessionId, modeId: "planning" });

    const response = await agent.prompt({
      sessionId: session.sessionId,
      prompt: [{ type: "text", text: "make a plan for ACP control" }],
    } as any);

    expect(response.stopReason).toBe("end_turn");
    expect(createConversation).toHaveBeenCalledWith(expect.objectContaining({
      mode: "planning",
      command: "make a plan for ACP control",
      projectPath: "/workspace/app",
    }));
    expect(waitForTurn).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: session.sessionId,
      runId: "run-1",
    }));
    expect(sessionUpdate).toHaveBeenCalledWith({
      sessionId: session.sessionId,
      update: {
        sessionUpdate: "agent_message_chunk",
        content: { type: "text", text: "worker update" },
      },
    });
  });

  it("routes later ACP prompts into the existing Omni conversation", async () => {
    const createConversation = vi.fn().mockResolvedValue({
      planId: "plan-1",
      runId: "run-1",
      mode: "direct",
    });
    const sendConversationMessage = vi.fn().mockResolvedValue({ ok: true });
    const agent = new OmniHarnessAcpAgent({ sessionUpdate: vi.fn() } as any, {
      createConversation,
      sendConversationMessage,
      waitForTurn: vi.fn().mockResolvedValue({ stopReason: "end_turn" }),
    });
    const session = await agent.newSession({ cwd: "/workspace/app", mcpServers: [] });
    await agent.setSessionMode({ sessionId: session.sessionId, modeId: "direct" });

    await agent.prompt({
      sessionId: session.sessionId,
      prompt: [{ type: "text", text: "open a direct worker" }],
    } as any);
    await agent.prompt({
      sessionId: session.sessionId,
      prompt: [{ type: "text", text: "now inspect package.json" }],
    } as any);

    expect(createConversation).toHaveBeenCalledTimes(1);
    expect(sendConversationMessage).toHaveBeenCalledWith({
      runId: "run-1",
      content: "now inspect package.json",
    });
  });

  it("lists persisted Omni runs as ACP sessions", async () => {
    const runId = await insertRun();
    await insertRun({
      id: randomUUID(),
      projectPath: "/other/project",
      title: "Hidden by cwd filter",
    });
    const agent = new OmniHarnessAcpAgent({ sessionUpdate: vi.fn() } as any);

    const response = await agent.unstable_listSessions?.({ cwd: "/workspace/app" });

    expect(response?.sessions).toEqual([
      expect.objectContaining({
        sessionId: runId,
        cwd: "/workspace/app",
        title: "Existing ACP run",
      }),
    ]);
  });

  it("loads a persisted Omni run and replays message history", async () => {
    const runId = await insertRun({ mode: "planning" });
    await db.insert(messages).values([
      {
        id: randomUUID(),
        runId,
        role: "user",
        kind: "checkpoint",
        content: "original request",
        createdAt: new Date(Date.now() - 1_000),
      },
      {
        id: randomUUID(),
        runId,
        role: "worker",
        kind: "planning",
        content: "draft plan",
        createdAt: new Date(),
      },
    ]);
    const sessionUpdate = vi.fn();
    const agent = new OmniHarnessAcpAgent({ sessionUpdate } as any);

    const response = await agent.loadSession?.({
      sessionId: runId,
      cwd: "/workspace/app",
      mcpServers: [],
    });

    expect(response?.modes?.currentModeId).toBe("planning");
    expect(sessionUpdate).toHaveBeenCalledWith({
      sessionId: runId,
      update: {
        sessionUpdate: "user_message_chunk",
        content: { type: "text", text: "original request" },
      },
    });
    expect(sessionUpdate).toHaveBeenCalledWith({
      sessionId: runId,
      update: {
        sessionUpdate: "agent_message_chunk",
        content: { type: "text", text: "draft plan" },
      },
    });
  });

  it("resumes a persisted Omni run and sends later prompts into it", async () => {
    const runId = await insertRun({ mode: "direct" });
    const sendConversationMessage = vi.fn().mockResolvedValue({ ok: true });
    const agent = new OmniHarnessAcpAgent({ sessionUpdate: vi.fn() } as any, {
      sendConversationMessage,
      waitForTurn: vi.fn().mockResolvedValue({ stopReason: "end_turn" }),
    });

    const response = await agent.unstable_resumeSession?.({
      sessionId: runId,
      cwd: "/workspace/app",
      mcpServers: [],
    });
    await agent.prompt({
      sessionId: runId,
      prompt: [{ type: "text", text: "continue this run" }],
    } as any);

    expect(response?.modes?.currentModeId).toBe("direct");
    expect(sendConversationMessage).toHaveBeenCalledWith({
      runId,
      content: "continue this run",
    });
  });

  it("forks an ACP session without sharing the source run", async () => {
    const runId = await insertRun({ mode: "planning" });
    const createConversation = vi.fn().mockResolvedValue({
      planId: "fork-plan",
      runId: "fork-run",
      mode: "planning",
    });
    const agent = new OmniHarnessAcpAgent({ sessionUpdate: vi.fn() } as any, {
      createConversation,
      waitForTurn: vi.fn().mockResolvedValue({ stopReason: "end_turn" }),
    });

    const fork = await agent.unstable_forkSession?.({
      sessionId: runId,
      cwd: "/workspace/app",
      mcpServers: [],
    });
    await agent.prompt({
      sessionId: fork!.sessionId,
      prompt: [{ type: "text", text: "forked prompt" }],
    } as any);

    expect(fork?.sessionId).not.toBe(runId);
    expect(fork?.modes?.currentModeId).toBe("planning");
    expect(createConversation).toHaveBeenCalledWith(expect.objectContaining({
      mode: "planning",
      command: "forked prompt",
      projectPath: "/workspace/app",
    }));
    expect(await db.select().from(runs).where(eq(runs.id, runId)).get()).toBeTruthy();
  });
});
