import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import yaml from "js-yaml";

describe("macOS clean installation release check", () => {
  it("runs the real launcher and verifies health, HTML, an asset, and the build marker", () => {
    const workflowPath = path.resolve(process.cwd(), ".github/workflows/install-smoke.yml");
    const source = fs.readFileSync(workflowPath, "utf8");
    const workflow = yaml.load(source) as {
      jobs?: Record<string, { "runs-on"?: string; env?: Record<string, string> }>;
    };

    expect(workflow.jobs?.["macos-install"]?.["runs-on"]).toBe("macos-15");
    expect(Object.values(workflow.jobs?.["macos-install"]?.env ?? {})).not.toContain(
      "${{ runner.temp }}/omniharness-install-smoke",
    );
    expect(source).toContain("Configure isolated install paths");
    expect(source).toContain("$GITHUB_ENV");
    expect(source).toContain("./omniharness");
    expect(source).toContain("OMNIHARNESS_AUTH_PASSWORD");
    expect(source).toContain("OMNIHARNESS_RUNNER_PORT: 3059");
    expect(source).toContain("OMNIHARNESS_CODEX_ACP_INSTALL: npm");
    expect(source).toContain("OMNIHARNESS_CODEX_ACP_NPM_ROOT");
    expect(source).toContain("OMNIHARNESS_CODEX_ACP_INSTALL_DIR");
    expect(source).toContain("/api/healthz");
    expect(source).toContain("dist/interface/.build-state.json");
    expect(source).toContain("assetPath");
    expect(source).toContain("Verify the published Codex ACP installation");
    expect(source).toContain("codex-acp --version");
    expect(source).toContain("@agentclientprotocol/codex-acp/package.json");
    expect(source).toContain("Verify warm Mac restart");
    expect(source).toContain("Production interface is current");
    expect(source).toContain("Building production interface");
    expect(source).toContain("if: always()");
  });
});
