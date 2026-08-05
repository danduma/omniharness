import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("runner help", () => {
  it("prints runner-specific options through pnpm without starting the server", () => {
    const result = spawnSync("pnpm", ["runner", "--", "--help"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage: pnpm runner -- [options]");
    expect(result.stdout).toContain("--static-dir <directory>");
    expect(result.stdout).toContain("--no-static");
    expect(result.stdout).toContain("--interface-dev-url <url>");
    expect(result.stdout).not.toContain("runner.ready");
  });

  it("honors help even when another option is present", () => {
    const result = spawnSync("pnpm", ["runner", "--", "--help", "--definitely-invalid"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage: pnpm runner -- [options]");
    expect(result.stderr).not.toContain("Unknown option");
  });
});
