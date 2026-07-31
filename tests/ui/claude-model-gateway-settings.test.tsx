import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("Claude model gateway settings", () => {
  test("renders managed setup controls and secure draft fields at narrow widths", () => {
    const source = fs.readFileSync(path.resolve("src/components/settings/ClaudeModelGatewaySettings.tsx"), "utf8");
    expect(source).toContain('t("settings.claudeGateway.installAndStart")');
    expect(source).toContain('claudeModelGatewayManager.installAndStart()');
    expect(source).toContain('claudeModelGatewayManager.runAction("connect")');
    expect(source).toContain('claudeModelGatewayManager.runAction("refresh_models")');
    expect(source.match(/type="password"/g)).toHaveLength(2);
    expect(source).toContain("sm:grid-cols-2");
    expect(source).toContain('rel="noopener noreferrer"');
    expect(source).toContain('t("settings.claudeGateway.saveBeforeActions")');
    expect(source).toContain("status?.operation?.error?.message");
    expect(source).toContain("gatewaySettingsDirty");
    expect(source).not.toContain("api-secret");
  });

  test("feeds canonical live event status into the gateway manager", () => {
    const source = fs.readFileSync(path.resolve("src/interface/home/useHomeLifecycle.ts"), "utf8");
    expect(source).toContain("claudeModelGatewayManager.applyLiveStatus(nextState.claudeModelGateway)");
    expect(source).toContain("claudeModelGatewayManager.resetRevisionAuthority()");
  });
});
