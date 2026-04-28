import { describe, expect, it } from "vitest";
import { parseSupervisorToolCall, SupervisorProtocolError } from "@/server/supervisor/protocol";
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
});

describe("buildSupervisorTools", () => {
  it("uses generic worker supervision tools instead of the old plan checklist contract", () => {
    const toolNames = buildSupervisorTools().map((tool) => tool.function.name);

    expect(toolNames).toContain("wait_until");
    expect(toolNames).toContain("mark_complete");
    expect(toolNames).toContain("read_file");
    expect(toolNames).not.toContain("plan_read");
    expect(toolNames).not.toContain("plan_mark_done");
  });

  it("lets permission tools specify an explicit bridge option id", () => {
    const approveTool = buildSupervisorTools().find((tool) => tool.function.name === "worker_approve");
    const denyTool = buildSupervisorTools().find((tool) => tool.function.name === "worker_deny");

    expect(approveTool?.function.parameters.properties).toHaveProperty("optionId");
    expect(denyTool?.function.parameters.properties).toHaveProperty("optionId");
  });

  it("describes validator workers as independent checks for fake implementations", () => {
    const spawnTool = buildSupervisorTools().find((tool) => tool.function.name === "worker_spawn");

    expect(spawnTool?.function.description).toContain("independent validator");
    expect(spawnTool?.function.description).toContain("mocked paths");
    expect(spawnTool?.function.description).toContain("fake controls");
    expect(spawnTool?.function.description).toContain("real user-facing path");
  });

  it("describes ask_user as the preflight intent confirmation path", () => {
    const askUserTool = buildSupervisorTools().find((tool) => tool.function.name === "ask_user");

    expect(askUserTool?.function.description).toContain("preflight intent confirmation");
    expect(askUserTool?.function.description).toContain("summarize the understood job");
    expect(askUserTool?.function.description).toContain("clarifying question");
    expect(askUserTool?.function.description).toContain("specific outcomes");
    expect(askUserTool?.function.description).toContain("not just the artifact title");
  });

  it("lets the supervisor read referenced local files before asking the user", () => {
    const readFileTool = buildSupervisorTools().find((tool) => tool.function.name === "read_file");

    expect(readFileTool?.function.description).toContain("Read a local repository file");
    expect(readFileTool?.function.description).toContain("spec");
    expect(readFileTool?.function.description).toContain("plan");
    expect(readFileTool?.function.parameters.required).toEqual(["path"]);
  });
});
