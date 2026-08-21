import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const localeFiles = ["de", "en", "es", "fr", "it", "ja", "ko", "pt", "zh-CN"];

describe("Claude account connect UI", () => {
  it("uses the auth manager and the attach-only managed terminal", () => {
    const source = readFileSync("src/components/settings/ClaudeAccountSettings.tsx", "utf8");
    expect(source).toContain("ClaudeAccountAuthManager");
    expect(source).toContain("ManagedTerminalViewport");
    expect(source).toContain("manager.begin()");
    expect(source).toContain("manager.cancel()");
    expect(source).toContain("manager.confirmPurge()");
  });

  it.each(localeFiles)("defines the Claude sign-in copy in %s", (locale) => {
    const messages = JSON.parse(readFileSync(`shared/locales/${locale}.json`, "utf8")) as Record<string, string>;
    for (const key of [
      "settings.agents.claudeAuth.title",
      "settings.agents.claudeAuth.connect",
      "settings.agents.claudeAuth.accountLabel",
      "settings.agents.claudeAuth.cancelSignIn",
      "settings.agents.claudeAuth.purgeTitle",
      "settings.agents.claudeAuth.terminalExited",
    ]) {
      expect(messages[key], key).toBeTruthy();
    }
  });
});
