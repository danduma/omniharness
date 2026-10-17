import { describe, expect, it, vi } from "vitest";
import { resolveAccountCredentials } from "@/server/accounts/account-resolver";
import { verifyAccountCredentialLiveness, resetCredentialVerificationCacheForTests } from "@/server/accounts/credential-verification";

vi.mock("@/server/accounts/account-resolver", () => ({
  resolveAccountCredentials: vi.fn(),
  applyAccountCredentialEnv: vi.fn(),
}));

describe("credential verification", () => {
  it("does not claim the provider rejected credentials when local account resolution fails", async () => {
    resetCredentialVerificationCacheForTests();
    vi.mocked(resolveAccountCredentials).mockRejectedValue(new Error('Account "claude-sub-1" is disabled.'));
    const result = await verifyAccountCredentialLiveness({ workerType: "claude", accountId: "claude-sub-1", cwd: "/tmp" });
    expect(result.liveness).toBe("unknown");
    expect(result.detail).toContain("Credential could not be resolved");
  });
});
