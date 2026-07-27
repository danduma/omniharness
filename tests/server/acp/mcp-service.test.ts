import { describe, expect, it } from "vitest";
import { McpService } from "@/server/agent-runtime/acp/mcp-service";

describe("ACP MCP service", () => {
  it("owns connection lifecycle and routes request/notification messages", async () => {
    const notifications: string[] = [];
    const service = new McpService(new Map([[
      "tools",
      {
        request: async (method: string) => ({ method }),
        notify: async (method: string) => { notifications.push(method); },
      },
    ]]));
    const connection = await service.connect({ acpId: "tools" });

    await expect(service.message({ connectionId: connection.connectionId, method: "tools/list" }))
      .resolves.toEqual({ method: "tools/list" });
    await service.notify({ connectionId: connection.connectionId, method: "notifications/initialized" });
    expect(notifications).toEqual(["notifications/initialized"]);
    await service.disconnect({ connectionId: connection.connectionId });
    expect(service.size).toBe(0);
  });
});
