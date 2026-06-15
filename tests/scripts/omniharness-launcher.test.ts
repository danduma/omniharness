import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const launcherSource = readFileSync(path.resolve(process.cwd(), "omniharness"), "utf8");

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
  });
});
