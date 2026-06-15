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
});
