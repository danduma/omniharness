import { describe, expect, it } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { validatePlanItem } from "@/server/validation/checks";

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
