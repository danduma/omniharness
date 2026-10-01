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

  it("never falls through to generic plan ingestion when the worker lookup disappears", async () => {
    const record = {
      name: `missing-plan-worker-${Date.now()}`,
      updatedAt: "2026-01-01T00:00:00.000Z",
      outputEntries: [],
    };
    const client = new RuntimeClient(() => record as never, () => undefined);

    await client.sessionUpdate({
      sessionId: "session-1",
      update: {
        sessionUpdate: "plan",
        entries: [{ content: "Do not duplicate", priority: "high", status: "pending" }],
      },
    });

    expect(record.outputEntries).toEqual([]);
  });

  describe("turns the provider starts on its own", () => {
    function threadStatus(type: "active" | "idle") {
      return {
        sessionId: "session-1",
        update: {
          sessionUpdate: "session_info_update",
          _meta: { codex: { threadStatus: type === "active" ? { type, activeFlags: [] } : { type } } },
        },
      } as never;
    }

    function liveRecord(state: string, extra: Record<string, unknown> = {}) {
      let nextId = 0;
      return {
        name: `goal-worker-${Date.now()}`,
        state,
        updatedAt: "2026-01-01T00:00:00.000Z",
        currentText: "",
        lastText: "",
        stopReason: null as string | null,
        activeOutputEntryId: null,
        outputEntries: [] as unknown[],
        outputArchive: {
          append: (input: Record<string, unknown>) => ({ ...input, id: `entry-${(nextId += 1)}`, timestamp: "2026-01-01T00:00:00.000Z" }),
          stats: () => ({ totalEntries: nextId, omittedLiveEntries: 0 }),
        },
        ...extra,
      };
    }

    it("reports a Codex /goal continuation turn as working, then idle when it ends", async () => {
      const record = liveRecord("idle", { lastText: "Committed the checkpoint." });
      const client = new RuntimeClient(() => record as never, () => undefined);

      await client.sessionUpdate(threadStatus("active"));
      expect(record.state).toBe("working");
      expect(record.stopReason).toBeNull();
      expect(record.providerTurnActive).toBe(true);

      record.currentText = "Next checkpoint done.";
      await client.sessionUpdate(threadStatus("idle"));
      expect(record.state).toBe("idle");
      expect(record.stopReason).toBe("end_turn");
      expect(record.lastText).toBe("Next checkpoint done.");
      expect(record.currentText).toBe("");
    });

    it("leaves the state of a prompted turn to askAgent", async () => {
      const record = liveRecord("working", { promptInFlight: true, currentText: "streaming" });
      const client = new RuntimeClient(() => record as never, () => undefined);

      await client.sessionUpdate(threadStatus("idle"));
      expect(record.state).toBe("working");
      expect(record.currentText).toBe("streaming");
      expect(record.providerTurnActive).toBe(false);

      await client.sessionUpdate(threadStatus("active"));
      expect(record.providerTurnActive).toBe(true);
    });
  });
});
