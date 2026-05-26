import { mkdirSync, readFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { afterEach, describe, expect, it } from "vitest";
import {
  appendOutputEntry,
  appendBoundedThoughts,
  appendMessageChunk,
  openAgentOutputArchive,
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
  });
});
