import { describe, expect, it } from "vitest";
import { parseSupervisorToolCall, parseSupervisorToolCallFromMastra, SupervisorProtocolError } from "@/server/supervisor/protocol";
import { buildSupervisorTools } from "@/server/supervisor/tools";

describe("parseSupervisorToolCall", () => {
  it("parses the first tool call with JSON arguments", () => {
    const action = parseSupervisorToolCall([
      {
        id: "call-1",
        function: {
          name: "wait_until",
          arguments: JSON.stringify({ seconds: 30, reason: "worker still progressing" }),
        },
      },
    ]);

    expect(action).toEqual({
      id: "call-1",
      name: "wait_until",
      args: { seconds: 30, reason: "worker still progressing" },
    });
  });

  it("rejects malformed JSON arguments instead of trying to parse markdown as a tool payload", () => {
    expect(() =>
      parseSupervisorToolCall([
        {
          id: "call-2",
          function: {
            name: "worker_continue",
            arguments: "# Wiki.js migration notes",
          },
        },
      ]),
    ).toThrowError(SupervisorProtocolError);
  });

  it("parses Mastra tool call chunks", () => {
    const action = parseSupervisorToolCallFromMastra([
      {
        payload: {
          toolCallId: "call-mastra",
          toolName: "inspect_repo",
          args: { command: "rg", args: ["TODO"] },
        },
      },
    ]);

    expect(action).toEqual({
      id: "call-mastra",
      name: "inspect_repo",
      args: { command: "rg", args: ["TODO"] },
    });
  });
});

describe("buildSupervisorTools", () => {
  it("uses Mastra worker supervision tools instead of the old plan checklist contract", () => {
    const toolNames = Object.keys(buildSupervisorTools());

    expect(toolNames).toContain("wait_until");
    expect(toolNames).toContain("mark_complete");
    expect(toolNames).toContain("read_file");
    expect(toolNames).not.toContain("plan_read");
    expect(toolNames).not.toContain("plan_mark_done");
  });

  it("lets permission tools specify an explicit bridge option id", () => {
    const approveTool = buildSupervisorTools().worker_approve;
    const denyTool = buildSupervisorTools().worker_deny;

    expect(approveTool?.inputSchema).toBeTruthy();
    expect(denyTool?.inputSchema).toBeTruthy();
  });

  it("describes validator workers as independent checks for fake implementations", () => {
    const spawnTool = buildSupervisorTools().worker_spawn;

    expect(spawnTool?.description).toContain("independent validator");
    expect(spawnTool?.description).toContain("mocked paths");
    expect(spawnTool?.description).toContain("fake controls");
    expect(spawnTool?.description).toContain("real user-facing path");
  });

  it("routes preflight intent confirmation through confirm_ready_to_implement", () => {
    const tools = buildSupervisorTools();
    const askUserTool = tools.ask_user;
    const confirmTool = tools.confirm_ready_to_implement;

    expect(askUserTool?.description).toContain("clarifying question");
    expect(askUserTool?.description).toContain("confirm_ready_to_implement");

    expect(confirmTool).toBeTruthy();
    expect(confirmTool?.description).toContain("preflight intent confirmation");
    expect(confirmTool?.description).toContain("Yes, implement it");
    expect(confirmTool?.description).toContain("No, let me clarify");
  });

  it("exposes an explicit supervisor-authored user message tool", () => {
    const userMessageTool = buildSupervisorTools().send_user_message;

    expect(userMessageTool?.description).toContain("user-visible");
    expect(userMessageTool?.description).toContain("supervisor-authored");
    expect(userMessageTool?.description).toContain("conversation transcript");
    expect(userMessageTool?.inputSchema).toBeTruthy();
  });

  it("lets the supervisor read referenced local files before asking the user", () => {
    const readFileTool = buildSupervisorTools().read_file;

    expect(readFileTool?.description).toContain("Read a local repository file");
    expect(readFileTool?.description).toContain("spec");
    expect(readFileTool?.description).toContain("plan");
    expect(readFileTool?.inputSchema).toBeTruthy();
  });

  it("exposes targeted read-only repository inspection commands", () => {
    const inspectTool = buildSupervisorTools().inspect_repo;

    expect(inspectTool?.description).toContain("targeted searching");
    expect(inspectTool?.description).toContain("rg");
    expect(inspectTool?.description).toContain("sed");
    expect(inspectTool?.inputSchema).toBeTruthy();
  });
});
