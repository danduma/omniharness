import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveArtifactRoot } from "@/server/artifacts/project-root";

let projectPath: string;

beforeEach(() => {
  projectPath = fs.mkdtempSync(path.join(os.tmpdir(), "omniharness-artifact-root-"));
});

afterEach(() => {
  fs.rmSync(projectPath, { recursive: true, force: true });
});

describe("resolveArtifactRoot", () => {
  it("gitignores .omniharness/ when artifact writes first create it", async () => {
    await resolveArtifactRoot({ runId: "run-test", projectPath }, "write");

    expect(fs.readFileSync(path.join(projectPath, ".gitignore"), "utf8")).toBe(".omniharness/\n");
  });
});
