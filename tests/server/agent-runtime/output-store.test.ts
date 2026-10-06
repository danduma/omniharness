import { mkdirSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { afterEach, describe, expect, it } from "vitest";
import {
  appendOutputEntry,
  appendBoundedText,
  appendMessageChunk,
  openAgentOutputArchive,
  reassembleArchivedEntries,
  resolveAgentRuntimeDataDir,
  summarizeToolCallUpdate,
} from "@/server/agent-runtime/output-store";
import type { AgentRecord } from "@/server/agent-runtime/types";

describe("agent runtime output store", () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      rmSync(root, { recursive: true, force: true });
    }
  });

  function makeTempRoot() {
    const root = join(tmpdir(), `omniharness-output-store-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    mkdirSync(root, { recursive: true });
    tempRoots.push(root);
    return root;
  }

  it("keeps raw archives inside the configured runtime or app-data root", () => {
    expect(resolveAgentRuntimeDataDir({ dataDir: "/tmp/omni-runtime-data" }))
      .toBe("/tmp/omni-runtime-data");
    expect(resolveAgentRuntimeDataDir({ rootDir: "/tmp/omni-app-root" }))
      .toBe("/tmp/omni-app-root/.omniharness");
  });

  describe("appendBoundedText", () => {
    it("keeps recent text without adding an omitted-output placeholder", () => {
      const result = appendBoundedText("first line\n", "second line\nthird line", 27);

      expect(result.length).toBeLessThanOrEqual(27);
      expect(result).toBe("line\nsecond line\nthird line");
      expect(result).not.toContain("Earlier runtime output omitted");
    });
  });

  it("keeps giant tool update summaries compact for display and archive storage", () => {
    const verboseOutput = [
      "```sh",
      ...Array.from({ length: 20_000 }, (_, index) => `./src/file-${index}.ts:${index}: ${"x".repeat(80)}`),
      "```",
    ].join("\n");
    const summary = summarizeToolCallUpdate({
      sessionUpdate: "tool_call_update",
      toolCallId: "call_verbose",
      status: "updated",
      content: [
        {
          type: "content",
          content: {
            type: "text",
            text: verboseOutput,
          },
        },
      ],
      rawOutput: {
        formatted_output: verboseOutput,
      },
    });

    expect(summary.length).toBeLessThanOrEqual(2_100);
    expect(summary).toContain("truncated");

    const dataDir = makeTempRoot();
    const outputArchive = openAgentOutputArchive({ dataDir, name: "verbose-worker" });
    const record = {
      outputArchive,
      outputEntries: [],
      activeOutputEntryId: null,
    } as unknown as AgentRecord;

    appendOutputEntry(record, {
      type: "tool_call_update",
      text: summary,
      toolCallId: "call_verbose",
      status: "updated",
      raw: {
        sessionUpdate: "tool_call_update",
        toolCallId: "call_verbose",
        status: "updated",
        content: [
          {
            type: "content",
            content: {
              type: "text",
              text: verboseOutput,
            },
          },
        ],
        rawOutput: {
          formatted_output: verboseOutput,
        },
      },
    });

    const archiveLine = readFileSync(outputArchive.filePath, "utf8").trim();
    expect(Buffer.byteLength(archiveLine)).toBeLessThan(35_000);
    expect(record.outputEntries[0]?.text.length).toBeLessThanOrEqual(2_100);
    expect(JSON.stringify(record.outputEntries[0]?.raw).length).toBeLessThan(20_000);
  });

  describe("appendMessageChunk", () => {
    it("keeps the beginning of a long assistant message", () => {
      const dataDir = makeTempRoot();
      const outputArchive = openAgentOutputArchive({ dataDir, name: "long-message-worker" });
      const record = {
        outputArchive,
        outputEntries: [],
        activeOutputEntryId: null,
      } as unknown as AgentRecord;
      const completeMessage = [
        "The audit is done. Here's the full picture.\n\n",
        "middle".repeat(1_250),
        "\n\nOne coordination note: preserve the entire answer.",
      ].join("");

      for (let offset = 0; offset < completeMessage.length; offset += 127) {
        appendMessageChunk(record, completeMessage.slice(offset, offset + 127), "message");
      }

      expect(completeMessage.length).toBeGreaterThan(5_000);
      expect(record.outputEntries[0]?.text).toBe(completeMessage);
    });

    it("keeps every paragraph of a long thought", () => {
      const dataDir = makeTempRoot();
      const outputArchive = openAgentOutputArchive({ dataDir, name: "thought-worker" });
      const record = {
        outputArchive,
        outputEntries: [],
        activeOutputEntryId: null,
      } as unknown as AgentRecord;
      const completeThought = Array.from(
        { length: 60 },
        (_, index) => `Thinking step ${index}: ${"reasoning ".repeat(20)}`,
      ).join("\n\n");

      for (let offset = 0; offset < completeThought.length; offset += 97) {
        appendMessageChunk(record, completeThought.slice(offset, offset + 97), "thought");
      }

      expect(completeThought.length).toBeGreaterThan(5_000);
      expect(record.outputEntries).toHaveLength(1);
      expect(record.outputEntries[0]?.text).toBe(completeThought);
    });

    it("keeps writing one message while a background terminal streams updates", () => {
      const dataDir = makeTempRoot();
      const outputArchive = openAgentOutputArchive({ dataDir, name: "interleaved-worker" });
      const record = {
        outputArchive,
        outputEntries: [],
        activeOutputEntryId: null,
      } as unknown as AgentRecord;
      const terminalUpdate = () => appendOutputEntry(record, {
        type: "tool_call_update",
        text: "exec-4ad3410f",
        toolCallId: "exec-4ad3410f",
        status: "in_progress",
      });

      terminalUpdate();
      appendMessageChunk(record, "Caption performance", "message");
      terminalUpdate();
      appendMessageChunk(record, " is green", "message");
      terminalUpdate();
      terminalUpdate();
      appendMessageChunk(record, " through its 491-test manifest.", "message");

      const messages = record.outputEntries.filter((entry) => entry.type === "message");
      expect(messages).toHaveLength(1);
      expect(messages[0]?.text).toBe("Caption performance is green through its 491-test manifest.");
    });

    it("starts a new message after a real turn boundary", () => {
      const dataDir = makeTempRoot();
      const outputArchive = openAgentOutputArchive({ dataDir, name: "boundary-worker" });
      const record = {
        outputArchive,
        outputEntries: [],
        activeOutputEntryId: null,
      } as unknown as AgentRecord;

      appendMessageChunk(record, "Running the verifier now.", "message");
      appendOutputEntry(record, { type: "tool_call", text: "Terminal", toolCallId: "exec-1" });
      appendMessageChunk(record, "The verifier is green.", "message");

      const messages = record.outputEntries.filter((entry) => entry.type === "message");
      expect(messages.map((entry) => entry.text)).toEqual([
        "Running the verifier now.",
        "The verifier is green.",
      ]);
    });
  });

  describe("reassembleArchivedEntries", () => {
    it("rejoins chunks separated by background terminal records", () => {
      const reassembled = reassembleArchivedEntries([
        { type: "message", text: "Caption performance" },
        { type: "tool_call_update", text: "exec-4ad3410f" },
        { type: "usage", text: "" },
        { type: "message", text: " is green." },
        { type: "tool_call", text: "Terminal" },
        { type: "message", text: "Next step." },
      ]);

      expect(reassembled).toEqual([
        { type: "message", text: "Caption performance is green." },
        { type: "tool_call_update", text: "exec-4ad3410f" },
        { type: "usage", text: "" },
        { type: "tool_call", text: "Terminal" },
        { type: "message", text: "Next step." },
      ]);
    });
  });
});
