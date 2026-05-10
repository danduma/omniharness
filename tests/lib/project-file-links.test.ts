import { describe, expect, it } from "vitest";
import { parseProjectFileReference } from "@/lib/project-file-links";

describe("parseProjectFileReference", () => {
  const root = "/Users/masterman/NLP/omniharness";

  it("parses localhost absolute file URLs with line numbers", () => {
    expect(parseProjectFileReference(
      "http://localhost:3050/Users/masterman/NLP/omniharness/src/lib/worker-terminal-messages.ts:101",
      root,
    )).toEqual({
      root,
      relativePath: "src/lib/worker-terminal-messages.ts",
      line: 101,
    });
  });

  it("parses absolute project paths with optional columns", () => {
    expect(parseProjectFileReference(
      "/Users/masterman/NLP/omniharness/src/lib/worker-terminal-messages.ts:101:7",
      root,
    )).toEqual({
      root,
      relativePath: "src/lib/worker-terminal-messages.ts",
      line: 101,
      column: 7,
    });
  });

  it("rejects links outside the current project root", () => {
    expect(parseProjectFileReference(
      "http://localhost:3050/Users/masterman/NLP/other/src/index.ts:1",
      root,
    )).toBeNull();
  });

  it("rejects non-localhost URLs", () => {
    expect(parseProjectFileReference(
      "https://example.com/Users/masterman/NLP/omniharness/src/index.ts:1",
      root,
    )).toBeNull();
  });
});
