import { mkdirSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { afterEach, describe, expect, it } from "vitest";
import {
  appendOutputEntry,
  appendBoundedText,
  appendBoundedThoughts,
  appendMessageChunk,
  openAgentOutputArchive,
  reassembleArchivedEntries,
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

  describe("appendBoundedThoughts", () => {
    it("does not trim thoughts within limit", () => {
      const result = appendBoundedThoughts("First thought.\n\nSecond thought.", "\n\nThird thought.", 100);
      expect(result).toBe("First thought.\n\nSecond thought.\n\nThird thought.");
    });

    it("trims thoughts to start cleanly after a double newline", () => {
      // Limit 40. "My prefix text that gets sliced out\n\nKeep block 1\n\nKeep block 2"
      // Slicing last 40 characters: "ced out\n\nKeep block 1\n\nKeep block 2"
      // First \n\n in slice is at index 7. We want it to trim cleanly to "Keep block 1\n\nKeep block 2"
      const result = appendBoundedThoughts(
        "My prefix text that gets sliced out",
        "\n\nKeep block 1\n\nKeep block 2",
        40
      );
      expect(result).toBe("Keep block 1\n\nKeep block 2");
      expect(result).not.toContain("Earlier runtime output omitted");
    });

    it("trims thoughts to start cleanly after a single newline if no double newline is found", () => {
      // Limit 30. "Sliced prefix\nKeep part 1\nKeep part 2"
      // Slicing last 30 characters: "ced prefix\nKeep part 1\nKeep part 2"
      // First \n is at index 10. We trim cleanly to "Keep part 1\nKeep part 2"
      const result = appendBoundedThoughts(
        "Sliced prefix",
        "\nKeep part 1\nKeep part 2",
        30
      );
      expect(result).toBe("Keep part 1\nKeep part 2");
    });

    it("falls back to strict slice when no newline exists in candidate", () => {
      const result = appendBoundedThoughts("ABCDEFGHIJKLMNOPQRSTUVWXYZ", "1234567890", 15);
      expect(result).toBe("VWXYZ1234567890");
    });
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

    it("uses appendBoundedThoughts for type 'thought'", () => {
      const dataDir = makeTempRoot();
      const outputArchive = openAgentOutputArchive({ dataDir, name: "thought-worker" });
      const record = {
        outputArchive,
        outputEntries: [],
        activeOutputEntryId: null,
      } as unknown as AgentRecord;

      // First chunk
      appendMessageChunk(record, "Old thoughts\n\nKeep block", "thought");
      // Appending to the active entry
      appendMessageChunk(record, "\n\nAdditional thoughts", "thought");

      expect(record.outputEntries[0].text).toBe("Old thoughts\n\nKeep block\n\nAdditional thoughts");
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
