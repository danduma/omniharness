import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { deriveArtifactsFromTitle, validatePlanItem } from "@/server/validation/checks";

describe("validatePlanItem", () => {
  it("fails when a claimed file artifact does not exist", async () => {
    const result = await validatePlanItem({
      cwd: process.cwd(),
      title: "Create hello.txt",
      expectedArtifacts: [{ type: "file", path: "missing-hello.txt" }],
    });

    expect(result.ok).toBe(false);
    expect(result.failures[0]).toContain("missing-hello.txt");
  });

  it("passes when the expected file artifact exists", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "omni-validation-"));
    fs.writeFileSync(path.join(tempDir, "hello.txt"), "Hello World");

    const result = await validatePlanItem({
      cwd: tempDir,
      title: "Create hello.txt",
      expectedArtifacts: [{ type: "file", path: "hello.txt" }],
    });

    expect(result.ok).toBe(true);
    expect(result.failures).toHaveLength(0);
  });
});


describe("deriveArtifactsFromTitle", () => {
  it("does not treat natural language task nouns as file paths", () => {
    expect(deriveArtifactsFromTitle("Add authenticated attachment upload support")).toEqual([]);
    expect(deriveArtifactsFromTitle("Update the composer UI and keyboard/paste behavior")).toEqual([]);
    expect(deriveArtifactsFromTitle("Update submit and upload sequencing")).toEqual([]);
  });

  it("still derives explicit file artifacts", () => {
    expect(deriveArtifactsFromTitle("Create hello.txt")).toEqual([{ type: "file", path: "hello.txt" }]);
    expect(deriveArtifactsFromTitle("Update src/app/page.tsx"))
      .toEqual([{ type: "file", path: "src/app/page.tsx" }]);
    expect(deriveArtifactsFromTitle("Update `src/app/page.tsx`"))
      .toEqual([{ type: "file", path: "src/app/page.tsx" }]);
  });
});
