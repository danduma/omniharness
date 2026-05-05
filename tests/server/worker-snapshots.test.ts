import { describe, expect, it } from "vitest";
import { parseWorkerOutputEntries, serializeWorkerOutputEntries } from "@/server/workers/snapshots";

describe("worker output entry persistence", () => {
  it("keeps tiny output entry payloads as plain JSON", () => {
    const entries = [
      {
        id: "entry-small",
        type: "message" as const,
        text: "hello",
        timestamp: new Date(0).toISOString(),
      },
    ];

    const serialized = serializeWorkerOutputEntries(entries);

    expect(serialized.trim().startsWith("[")).toBe(true);
    expect(parseWorkerOutputEntries(serialized)).toEqual(entries);
  });

  it("compresses large non-command output entry payloads and parses them back", () => {
    const entries = [
      {
        id: "entry-large",
        type: "message" as const,
        text: "Planner update\n".repeat(2_000),
        timestamp: new Date(0).toISOString(),
      },
    ];

    const serialized = serializeWorkerOutputEntries(entries);

    expect(serialized.startsWith("br:v1:")).toBe(true);
    expect(serialized.length).toBeLessThan(JSON.stringify(entries).length / 4);
    expect(parseWorkerOutputEntries(serialized)).toEqual(entries);
  });

  it("truncates verbose raw command output before persisting history", () => {
    const fullOutput = Array.from({ length: 80 }, (_, index) => `line-${String(index + 1).padStart(2, "0")}`).join("\n");
    const entries = [
      {
        id: "entry-read-file",
        type: "tool_call_update" as const,
        text: `Tool call completed: ${fullOutput}`,
        timestamp: new Date(0).toISOString(),
        toolCallId: "call-read-file",
        status: "completed",
        raw: {
          sessionUpdate: "tool_call_update",
          title: "read file",
          rawOutput: {
            formatted_output: fullOutput,
            stdout: fullOutput,
            aggregated_output: fullOutput,
          },
          content: [
            {
              type: "content",
              content: {
                type: "text",
                text: fullOutput,
              },
            },
          ],
        },
      },
    ];

    const persistedEntry = parseWorkerOutputEntries(serializeWorkerOutputEntries(entries))[0];
    const raw = persistedEntry.raw as {
      rawOutput: { formatted_output: string; stdout: string; aggregated_output: string };
      content: Array<{ content: { text: string } }>;
    };

    expect(raw.rawOutput.formatted_output).toContain("line-01");
    expect(raw.rawOutput.formatted_output).toContain("line-80");
    expect(raw.rawOutput.formatted_output).toContain("omitted");
    expect(raw.rawOutput.formatted_output).not.toContain("line-40");
    expect(persistedEntry.text).toContain("line-01");
    expect(persistedEntry.text).toContain("line-80");
    expect(persistedEntry.text).toContain("omitted");
    expect(persistedEntry.text).not.toContain("line-40");
    expect(raw.rawOutput.stdout).toBe(raw.rawOutput.formatted_output);
    expect(raw.rawOutput.aggregated_output).toBe(raw.rawOutput.formatted_output);
    expect(raw.content[0].content.text).toBe(raw.rawOutput.formatted_output);
    expect(JSON.stringify(persistedEntry)).not.toContain(fullOutput);
  });
});
