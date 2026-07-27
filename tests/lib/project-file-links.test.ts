import { describe, expect, it } from "vitest";
import * as projectFileLinks from "@/lib/project-file-links";

const { parseProjectFileReference } = projectFileLinks;

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

  it("parses relative project paths with optional line numbers", () => {
    expect(parseProjectFileReference(
      "docs/plans/launch-conversion-readiness.md:12",
      root,
    )).toEqual({
      root,
      relativePath: "docs/plans/launch-conversion-readiness.md",
      line: 12,
    });
  });

  it("rejects relative paths that escape the project", () => {
    expect(parseProjectFileReference("../outside.md", root)).toBeNull();
    expect(parseProjectFileReference("docs/../../outside.md", root)).toBeNull();
    expect(parseProjectFileReference("docs/..", root)).toBeNull();
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

  it("does not throw when a possible path contains a literal percent sign", () => {
    expect(parseProjectFileReference("Progress is 100%", root)).toBeNull();
    expect(parseProjectFileReference("docs/100%-complete.md", root)).toEqual({
      root,
      relativePath: "docs/100%-complete.md",
    });
  });
});

describe("buildProjectFileFullPath", () => {
  it("builds the absolute path copied from a project file reference", () => {
    const buildProjectFileFullPath = (projectFileLinks as Record<string, unknown>).buildProjectFileFullPath;

    expect(buildProjectFileFullPath).toBeTypeOf("function");
    expect((buildProjectFileFullPath as (reference: {
      root: string;
      relativePath: string;
    }) => string)({
      root: "/Users/masterman/NLP/omniharness/",
      relativePath: "/src/components/Terminal.tsx",
    })).toBe("/Users/masterman/NLP/omniharness/src/components/Terminal.tsx");
  });
});
