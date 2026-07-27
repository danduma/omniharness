import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { RuntimeClient } from "@/server/agent-runtime/acp/runtime-client";

describe("ACP runtime client", () => {
  it("implements the native ACP 0.25 elicitation request", async () => {
    const client = new RuntimeClient(() => undefined, () => undefined);

    expect(typeof client.unstable_createElicitation).toBe("function");
    await expect(client.unstable_createElicitation({
      mode: "form",
      sessionId: "session-1",
      message: "Choose",
      requestedSchema: { type: "object", properties: {} },
    })).resolves.toEqual({ action: "cancel" });
  });

  it("limits filesystem requests to the workspace and explicit additional roots", async () => {
    const root = mkdtempSync(join(tmpdir(), "acp-root-"));
    const additional = mkdtempSync(join(tmpdir(), "acp-additional-"));
    const outside = mkdtempSync(join(tmpdir(), "acp-outside-"));
    writeFileSync(join(additional, "allowed.txt"), "allowed");
    writeFileSync(join(outside, "blocked.txt"), "blocked");
    const client = new RuntimeClient(() => undefined, () => undefined, [root, additional]);

    await expect(client.readTextFile({ sessionId: "s", path: join(additional, "allowed.txt") })).resolves.toEqual({ content: "allowed" });
    await expect(client.readTextFile({ sessionId: "s", path: join(outside, "blocked.txt") })).rejects.toThrow("outside the workspace");
    rmSync(root, { recursive: true, force: true });
    rmSync(additional, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  });
});
