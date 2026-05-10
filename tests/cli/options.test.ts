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

  it("parses compact implementation mode and worker flags", () => {
    const parsed = parseOmniCliArgs(["-i", "-w", "codex", "implement plan.md"]);

    expect(parsed.command).toBe("implement plan.md");
    expect(parsed.mode).toBe("implementation");
    expect(parsed.preferredWorkerType).toBe("codex");
  });

  it("parses compact planning mode and worker flags", () => {
    const parsed = parseOmniCliArgs(["-p", "-w", "gemini", "write a plan"]);

    expect(parsed.command).toBe("write a plan");
    expect(parsed.mode).toBe("planning");
    expect(parsed.preferredWorkerType).toBe("gemini");
  });

  it("defaults normal commands to direct mode", () => {
    const parsed = parseOmniCliArgs(["-w", "codex", "inspect repo state"]);

    expect(parsed.command).toBe("inspect repo state");
    expect(parsed.mode).toBe("direct");
    expect(parsed.preferredWorkerType).toBe("codex");
  });

  it("documents the ACP harness subcommand", () => {
    expect(omniCliUsage()).toContain("omni acp");
    expect(omniCliUsage()).toContain("Run OmniHarness itself as an ACP agent over stdio");
  });
});
