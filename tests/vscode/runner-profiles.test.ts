import { describe, expect, it, vi } from "vitest";
import { VSCodeRunnerProfileStore } from "../../apps/vscode/src/runner-profiles";

function stores() {
  const state = new Map<string, unknown>();
  const secrets = new Map<string, string>();
  return {
    state,
    secrets,
    profiles: new VSCodeRunnerProfileStore({
      get: (key) => state.get(key) as never,
      update: async (key, value) => {
        state.set(key, value);
      },
    }, {
      get: async (key) => secrets.get(key),
      store: async (key, value) => {
        secrets.set(key, value);
      },
      delete: async (key) => {
        secrets.delete(key);
      },
    }),
  };
}

describe("VS Code runner profiles", () => {
  it("moves the legacy plain setting to SecretStorage and requires reauthorization", async () => {
    const harness = stores();
    const clear = vi.fn(async () => {});
    const document = await harness.profiles.initialize({
      defaultUrl: "http://127.0.0.1:3050",
      legacyPlainCredential: "legacy-secret",
      clearLegacyPlainCredential: clear,
    });

    expect(clear).toHaveBeenCalledOnce();
    expect(harness.secrets.get("omniHarness.legacySessionCookie")).toBe(
      "legacy-secret",
    );
    expect(document.profiles[0]).toEqual(expect.objectContaining({
      credentialRef: "omniHarness.legacySessionCookie",
      requiresReauth: true,
    }));
    await expect(harness.profiles.resolve("default")).resolves.toEqual({
      serverUrl: "http://127.0.0.1:3050",
      bearerToken: null,
    });
  });

  it("stores native bearer sessions only in SecretStorage and resolves every profile independently", async () => {
    const harness = stores();
    await harness.profiles.initialize({
      defaultUrl: "http://127.0.0.1:3050",
      legacyPlainCredential: "",
      clearLegacyPlainCredential: async () => {},
    });
    const fetchImpl: typeof fetch = vi.fn(async () => Response.json({
      token: "vscode-bearer-secret",
    }));
    const profile = await harness.profiles.login({
      label: "Remote",
      baseUrl: "https://runner.example",
      password: "shared-password",
      fetchImpl,
    });

    expect(JSON.stringify(harness.state)).not.toContain("vscode-bearer-secret");
    await expect(harness.profiles.resolve(profile.id)).resolves.toEqual({
      serverUrl: "https://runner.example",
      bearerToken: "vscode-bearer-secret",
    });
  });

  it("learns the first runner identity and requires confirmation before replacing it", async () => {
    const harness = stores();
    await harness.profiles.initialize({
      defaultUrl: "http://127.0.0.1:3050",
      legacyPlainCredential: "",
      clearLegacyPlainCredential: async () => {},
    });

    await harness.profiles.learnIdentity({
      profileId: "default",
      runnerInstanceId: "runner-one",
      confirmChange: false,
    });
    await expect(harness.profiles.learnIdentity({
      profileId: "default",
      runnerInstanceId: "runner-two",
      confirmChange: false,
    })).rejects.toThrow("confirmation");
    await harness.profiles.learnIdentity({
      profileId: "default",
      runnerInstanceId: "runner-two",
      confirmChange: true,
    });

    expect(harness.profiles.list().profiles[0]?.runnerInstanceId).toBe(
      "runner-two",
    );
  });
});
