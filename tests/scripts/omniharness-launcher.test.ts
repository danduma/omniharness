import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const launcherSource = readFileSync(path.resolve(process.cwd(), "omniharness"), "utf8");
const packageJson = JSON.parse(readFileSync(path.resolve(process.cwd(), "package.json"), "utf8")) as {
  scripts: Record<string, string>;
};

describe("omniharness launcher", () => {
  it("passes pnpm's package-manager mismatch policy through nested git dependency installs", () => {
    expect(launcherSource).toContain("pnpm_config_pm_on_fail=warn");
  });

  it("allows git dependency prepare installs to run nested build dependencies", () => {
    expect(launcherSource).toContain('pnpm_config_dangerously_allow_all_builds=true "${PNPM_CMD[@]}" install');
  });

  it("defers generated auth password notices until the end of launcher setup", () => {
    expect(launcherSource).toContain("AUTH_PASSWORD_NOTICE_FILE=");
    expect(launcherSource).toContain("OMNIHARNESS_AUTH_PASSWORD_NOTICE_FILE=\"$AUTH_PASSWORD_NOTICE_FILE\" node ./scripts/setup-auth.mjs");
    expect(launcherSource).toContain("trap 'print_auth_password_notice; cleanup_auth_password_notice' EXIT");
    expect(launcherSource).toContain("print_start_guidance\nprint_auth_password_notice\nopen_browser_when_ready");
    expect(launcherSource).not.toMatch(/AUTH_PASSWORD_NOTICE_FILE="\$\(mktemp[^\n]+\nrm -f/);
  });

  it("loads the ignored local env file before resolving runner configuration", () => {
    expect(packageJson.scripts.runner).toContain("--env-file-if-exists=.env");
    expect(packageJson.scripts.start).toContain("--env-file-if-exists=.env");
    expect(launcherSource).toContain('--env-file-if-exists="$ROOT_DIR/.env"');
  });

  it("reinstalls dependencies when the repository lockfile changed", () => {
    expect(launcherSource).toContain(".omniharness-dependencies.sha256");
    expect(launcherSource).toContain("process.versions.modules");
    expect(launcherSource).toContain("process.platform");
    expect(launcherSource).toContain("process.arch");
    expect(launcherSource).not.toContain('cmp -s "$ROOT_DIR/pnpm-lock.yaml" "$ROOT_DIR/node_modules/.pnpm/lock.yaml"');
  });

  it("uses the Vite interface build marker instead of the removed Next build", () => {
    expect(launcherSource).toContain("scripts/interface-build-state.mjs --check");
    expect(launcherSource).toContain("scripts/interface-build-state.mjs --write");
    expect(launcherSource).not.toContain(".next/BUILD_ID");
    expect(launcherSource).not.toContain(".next/routes-manifest.json");
  });

  it("recommends private Tailscale access before public tunnels", () => {
    const tailscaleIndex = launcherSource.indexOf("pnpm setup:tailscale");
    const publicTunnelIndex = launcherSource.indexOf("Public internet access");
    expect(tailscaleIndex).toBeGreaterThan(-1);
    expect(publicTunnelIndex).toBeGreaterThan(tailscaleIndex);
  });

  it("uses the same configured web port for readiness, browser, and runner startup", () => {
    expect(launcherSource).toContain('WEB_PORT="$(node --env-file-if-exists="$ROOT_DIR/.env"');
  });

  it("rebuilds when build-state inspection fails instead of aborting installation", () => {
    expect(launcherSource).toContain("Interface build inspection failed; rebuilding to recover");
    expect(launcherSource).toContain("Could not record interface build state; future launches may rebuild it");
  });
});
