import { describe, expect, it } from "vitest";
import { omniCliUsage, parseOmniCliArgs } from "@/server/cli/options";

describe("parseOmniCliArgs", () => {
  it("parses conversation parity flags for all web modes", () => {
    const parsed = parseOmniCliArgs([
      "--mode",
      "commit",
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
      "--runner",
      "https://runner.example.test",
      "--token-file",
      "/tmp/omni-token",
      "commit the CLI ACP surface",
    ]);

    expect(parsed).toEqual({
      command: "commit the CLI ACP surface",
      mode: "commit",
      projectPath: "/tmp/project",
      preferredWorkerType: "codex",
      preferredWorkerModel: "gpt-5.4",
      preferredWorkerEffort: "high",
      allowedWorkerTypes: ["codex", "opencode"],
      watch: false,
      json: false,
      runnerUrl: "https://runner.example.test",
      tokenFile: "/tmp/omni-token",
      tokenStdin: false,
      legacyToken: null,
    });
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

  it("supports safe remote token sources and marks argv tokens as legacy", () => {
    expect(parseOmniCliArgs([
      "--runner", "http://127.0.0.1:3050",
      "--token-stdin",
      "inspect remote runner",
    ])).toEqual(expect.objectContaining({
      runnerUrl: "http://127.0.0.1:3050",
      tokenStdin: true,
      tokenFile: null,
      legacyToken: null,
    }));

    expect(parseOmniCliArgs([
      "--runner", "https://runner.example.test",
      "--token", "visible-in-argv",
      "inspect remote runner",
    ])).toEqual(expect.objectContaining({
      legacyToken: "visible-in-argv",
    }));
  });

  it("rejects conflicting token sources", () => {
    expect(() => parseOmniCliArgs([
      "--token-file", "/tmp/token",
      "--token-stdin",
      "inspect remote runner",
    ])).toThrow("Choose exactly one");
  });
});
