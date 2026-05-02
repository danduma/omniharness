import { describe, expect, it } from "vitest";
import { omniCliUsage, parseOmniCliArgs } from "@/server/cli/options";

describe("parseOmniCliArgs", () => {
  it("parses conversation parity flags for all web modes", () => {
    const parsed = parseOmniCliArgs([
      "--mode",
      "planning",
      "--cwd",
      "/tmp/project",
      "--worker",
      "codex",
      "--model",
      "gpt-5.4",
      "--effort",
      "high",
      "--allowed-worker",
      "codex",
      "--allowed-worker",
      "opencode",
      "--no-watch",
      "help me plan the CLI ACP surface",
    ]);

    expect(parsed).toEqual({
      command: "help me plan the CLI ACP surface",
      mode: "planning",
      projectPath: "/tmp/project",
      preferredWorkerType: "codex",
      preferredWorkerModel: "gpt-5.4",
      preferredWorkerEffort: "high",
      allowedWorkerTypes: ["codex", "opencode"],
      watch: false,
      json: false,
    });
  });

  it("keeps the legacy single plan path shorthand as an implementation request", () => {
    const parsed = parseOmniCliArgs(["docs/superpowers/plans/example.md"]);

    expect(parsed.command).toBe("implement docs/superpowers/plans/example.md");
    expect(parsed.mode).toBe("implementation");
    expect(parsed.watch).toBe(true);
  });

  it("documents the ACP harness subcommand", () => {
    expect(omniCliUsage()).toContain("pnpm exec tsx omni-cli.ts acp");
    expect(omniCliUsage()).toContain("Run OmniHarness itself as an ACP agent over stdio");
  });
});
