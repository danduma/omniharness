import { describe, expect, it } from "vitest";
import { WebRunnerCredentialStore } from "@/interface/runners/RunnerCredentialStore";

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe("WebRunnerCredentialStore", () => {
  it("exposes an opaque handle and only uses the token for an exact origin and identity", async () => {
    const storage = new MemoryStorage();
    const store = new WebRunnerCredentialStore({
      storage,
      randomUUID: () => "credential-1",
    });
    const handle = await store.save({
      profileId: "profile-1",
      origin: "https://runner.example",
      runnerInstanceId: "runner-1",
      token: "private-token",
    });

    expect(handle).toBe("credential-1");
    expect(await store.metadata(handle)).toEqual({
      handle,
      profileId: "profile-1",
      origin: "https://runner.example",
      runnerInstanceId: "runner-1",
    });
    expect(JSON.stringify(await store.metadata(handle))).not.toContain("private-token");
    await expect(store.useCredential(
      handle,
      { origin: "https://runner.example", runnerInstanceId: "runner-1" },
      (token) => token,
    )).resolves.toBe("private-token");
    await expect(store.useCredential(
      handle,
      { origin: "https://other.example", runnerInstanceId: "runner-1" },
      (token) => token,
    )).rejects.toThrow("binding");
    await expect(store.useCredential(
      handle,
      { origin: "https://runner.example", runnerInstanceId: "runner-2" },
      (token) => token,
    )).rejects.toThrow("identity");

    await store.rebind(handle, {
      origin: "https://runner.example",
      runnerInstanceId: "runner-2",
    });
    await expect(store.useCredential(
      handle,
      { origin: "https://runner.example", runnerInstanceId: "runner-2" },
      (token) => token,
    )).resolves.toBe("private-token");
  });

  it("clears credentials on revocation/forget and isolates corrupt credential storage", async () => {
    const storage = new MemoryStorage();
    storage.setItem("omniharness.runnerCredentials", "{broken");
    const store = new WebRunnerCredentialStore({ storage });
    expect(store.getRecoveryNoticeCode()).toBe("runner.credentials.corruptReset");

    const one = await store.save({
      profileId: "profile-1",
      origin: "https://one.example",
      runnerInstanceId: null,
      token: "one",
    });
    await store.save({
      profileId: "profile-2",
      origin: "https://two.example",
      runnerInstanceId: "runner-2",
      token: "two",
    });
    await store.clear(one);
    expect(await store.metadata(one)).toBeNull();
    await store.clearForProfile("profile-2");
    expect(JSON.stringify([...storage.values.values()])).not.toContain("\"two\"");
  });
});
