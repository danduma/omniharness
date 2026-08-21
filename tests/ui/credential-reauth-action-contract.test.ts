import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("verified-dead credential recovery action", () => {
  it("opens the in-app Claude account operation instead of retrying the failed worker", () => {
    const home = readFileSync("src/interface/home/HomeApp.tsx", "utf8");
    const conversation = readFileSync("src/components/home/ConversationMain.tsx", "utf8");

    expect(home).toContain("readVerifiedDeadCredentialAccountId");
    expect(home).toContain("claudeAccountAuthManager.resume(credentialReauthAccountId)");
    expect(home).toContain('setActiveSettingsTab("agents")');
    expect(conversation).toContain("onCredentialReauthenticate");
  });
});
