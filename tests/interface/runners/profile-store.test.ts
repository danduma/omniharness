import { describe, expect, it } from "vitest";
import {
  RunnerProfileStore,
  SAME_ORIGIN_PROFILE_ID,
} from "@/interface/runners/RunnerProfileStore";
import type { RunnerCredentialStore } from "@/interface/runners/RunnerCredentialStore";
import {
  isInsecureServerFromSecurePage,
  isMixedContentBlocked,
} from "@/interface/runners/RunnerProfile";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  failWrites = false;
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error("quota exceeded");
    this.values.set(key, value);
  }
}

function createCredentialStore() {
  const cleared: string[] = [];
  const store: RunnerCredentialStore = {
    async save() { return "credential"; },
    async metadata() { return null; },
    async rebind() {},
    async useCredential() { throw new Error("unused"); },
    async clear(handle) { cleared.push(handle); },
    async clearForProfile() {},
    getRecoveryNoticeCode() { return null; },
  };
  return { store, cleared };
}

function createStore(storage = new MemoryStorage()) {
  let id = 0;
  const credentials = createCredentialStore();
  const store = new RunnerProfileStore({
    storage,
    credentialStore: credentials.store,
    locationOrigin: "https://app.example.test",
    randomUUID: () => `profile-${++id}`,
    now: () => "2026-07-31T00:00:00.000Z",
  });
  return { storage, store, credentials };
}

describe("RunnerProfileStore", () => {
  it("recovers corrupt storage to a visible same-origin default", async () => {
    const storage = new MemoryStorage();
    storage.setItem("omniharness.runnerProfiles", "{broken");
    const { store } = createStore(storage);

    await store.hydrate();

    expect(store.getSnapshot()).toEqual(expect.objectContaining({
      activeRunnerId: SAME_ORIGIN_PROFILE_ID,
      recoveryNoticeCode: "runner.profiles.corruptReset",
      profiles: [
        expect.objectContaining({
          id: SAME_ORIGIN_PROFILE_ID,
          baseUrl: "https://app.example.test",
          isSameOrigin: true,
        }),
      ],
    }));
  });

  it("migrates a version-zero profile document and preserves the same-origin profile", async () => {
    const storage = new MemoryStorage();
    storage.setItem("omniharness.runnerProfiles", JSON.stringify({
      profiles: [{
        id: "legacy",
        label: "Legacy",
        url: "https://runner.example.test/",
      }],
      selectedProfileId: "legacy",
    }));
    const { store } = createStore(storage);

    await store.hydrate();

    expect(store.getSnapshot()).toEqual(expect.objectContaining({
      activeRunnerId: "legacy",
      profiles: expect.arrayContaining([
        expect.objectContaining({ id: SAME_ORIGIN_PROFILE_ID }),
        expect.objectContaining({
          id: "legacy",
          baseUrl: "https://runner.example.test",
          schemaVersion: 1,
        }),
      ]),
    }));
  });

  it("uses the profile UUID before login and rekeys state to runner identity after login", async () => {
    const { store } = createStore();
    await store.hydrate();
    const profile = await store.addProfile({
      label: "Remote",
      baseUrl: "https://runner.example.test",
    });
    await store.updateScopedState(profile.id, {
      preferences: { density: "compact" },
      drafts: { conversation: "hello" },
      cursors: { events: "epoch:12" },
    });

    expect(store.scopeKey(profile.id)).toBe(profile.id);
    await expect(store.learnIdentity(profile.id, "runner-1")).resolves.toEqual({
      status: "accepted",
      profileId: profile.id,
    });
    expect(store.scopeKey(profile.id)).toBe("runner-1");
    expect(store.getScopedState(profile.id)).toEqual({
      preferences: { density: "compact" },
      drafts: { conversation: "hello" },
      cursors: { events: "epoch:12" },
    });
  });

  it("merges duplicate identities and their scoped state", async () => {
    const { store } = createStore();
    await store.hydrate();
    const first = await store.addProfile({ label: "A", baseUrl: "https://a.example" });
    const second = await store.addProfile({ label: "B", baseUrl: "https://b.example" });
    await store.updateScopedState(first.id, { drafts: { a: "one" } });
    await store.updateScopedState(second.id, { preferences: { theme: "dark" } });
    await store.learnIdentity(first.id, "runner-shared");

    await expect(store.learnIdentity(second.id, "runner-shared")).resolves.toEqual({
      status: "merged",
      profileId: first.id,
    });
    expect(store.getSnapshot().profiles.some((profile) => profile.id === second.id)).toBe(false);
    expect(store.getScopedState(first.id)).toEqual(expect.objectContaining({
      drafts: { a: "one" },
      preferences: { theme: "dark" },
    }));
  });

  it("clears credentials on URL edits and forget, but never deletes same-origin", async () => {
    const { store, credentials } = createStore();
    await store.hydrate();
    const profile = await store.addProfile({ label: "Remote", baseUrl: "https://a.example" });
    await store.attachCredential(profile.id, "credential-a");

    await store.editProfile(profile.id, { baseUrl: "https://b.example" });
    expect(credentials.cleared).toEqual(["credential-a"]);
    expect(store.getProfile(profile.id)?.runnerInstanceId).toBeNull();

    await store.attachCredential(profile.id, "credential-b");
    await expect(store.forgetProfile(profile.id)).resolves.toBe(true);
    expect(credentials.cleared).toEqual(["credential-a", "credential-b"]);
    await expect(store.forgetProfile(SAME_ORIGIN_PROFILE_ID)).resolves.toBe(false);
  });

  it("blocks identity replacement unless same-origin or explicitly confirmed", async () => {
    const { store } = createStore();
    await store.hydrate();
    const remote = await store.addProfile({ label: "Remote", baseUrl: "https://runner.example" });
    await store.learnIdentity(remote.id, "runner-old");

    await expect(store.learnIdentity(remote.id, "runner-new")).resolves.toEqual({
      status: "identity_mismatch",
      profileId: remote.id,
      expectedRunnerInstanceId: "runner-old",
      observedRunnerInstanceId: "runner-new",
    });
    expect(store.getProfile(remote.id)?.runnerInstanceId).toBe("runner-old");
    await expect(store.learnIdentity(remote.id, "runner-new", {
      confirmIdentityChange: true,
    })).resolves.toEqual({
      status: "accepted",
      profileId: remote.id,
    });
    await store.updateScopedState(remote.id, {
      cursors: { events: "old-epoch:3" },
    });
    await store.learnIdentity(remote.id, "runner-newer", {
      confirmIdentityChange: true,
    });
    expect(store.getScopedState(remote.id).cursors).toEqual({});

    await store.learnIdentity(SAME_ORIGIN_PROFILE_ID, "same-origin-old");
    await expect(store.learnIdentity(SAME_ORIGIN_PROFILE_ID, "same-origin-new", {
      validSameOriginSession: true,
    })).resolves.toEqual({
      status: "accepted",
      profileId: SAME_ORIGIN_PROFILE_ID,
    });
  });

  it("rolls back in-memory changes when persistence fails", async () => {
    const { storage, store } = createStore();
    await store.hydrate();
    storage.failWrites = true;

    await expect(store.addProfile({
      label: "Not saved",
      baseUrl: "https://runner.example",
    })).rejects.toThrow("quota");
    expect(store.getSnapshot().profiles).toHaveLength(1);
  });

  it("restores per-runner state after reload and ignores malformed partial profiles", async () => {
    const created = createStore();
    await created.store.hydrate();
    const profile = await created.store.addProfile({
      label: "Remote",
      baseUrl: "https://runner.example",
    });
    await created.store.learnIdentity(profile.id, "runner-persisted");
    await created.store.updateScopedState(profile.id, {
      drafts: { composer: "saved draft" },
      cursors: { events: "epoch:99" },
    });
    const stored = JSON.parse(created.storage.getItem("omniharness.runnerProfiles")!);
    stored.profiles.push({ id: 42, label: null });
    created.storage.setItem("omniharness.runnerProfiles", JSON.stringify(stored));

    const restored = new RunnerProfileStore({
      storage: created.storage,
      credentialStore: created.credentials.store,
      locationOrigin: "https://app.example.test",
    });
    await restored.hydrate();

    expect(restored.getSnapshot().profiles).toHaveLength(2);
    expect(restored.getScopedState(profile.id)).toEqual(expect.objectContaining({
      drafts: { composer: "saved draft" },
      cursors: { events: "epoch:99" },
    }));
  });

  it("persists a server password until it is cleared or the server is forgotten", async () => {
    const created = createStore();
    await created.store.hydrate();
    const profile = await created.store.addProfile({
      label: "Remote",
      baseUrl: "https://server.example",
      password: "saved-password",
    });

    expect(created.store.getProfile(profile.id)?.savedPassword).toBe("saved-password");

    const restored = new RunnerProfileStore({
      storage: created.storage,
      credentialStore: created.credentials.store,
      locationOrigin: "https://app.example.test",
    });
    await restored.hydrate();
    expect(restored.getProfile(profile.id)?.savedPassword).toBe("saved-password");

    await restored.editProfile(profile.id, { password: "replacement-password" });
    expect(restored.getProfile(profile.id)?.savedPassword).toBe("replacement-password");

    await restored.editProfile(profile.id, { password: "" });
    expect(restored.getProfile(profile.id)?.savedPassword).toBeNull();

    await restored.editProfile(profile.id, { password: "saved-again" });
    await restored.forgetProfile(profile.id);
    expect(created.storage.getItem("omniharness.runnerProfiles")).not.toContain("saved-again");
  });

  it("refuses a plain-HTTP server the browser will never let an HTTPS page reach", async () => {
    const { store, storage } = createStore();
    await store.hydrate();

    await expect(store.addProfile({
      label: "Lan runner",
      baseUrl: "http://192.168.1.20:3050",
    })).rejects.toMatchObject({ code: "runner.error.insecureServer" });
    expect(store.getSnapshot().profiles).toHaveLength(1);
    expect(storage.getItem("omniharness.runnerProfiles")).not.toContain("192.168.1.20");
  });

  it("keeps an existing server unchanged when it is edited to a blocked HTTP address", async () => {
    const { store } = createStore();
    await store.hydrate();
    const profile = await store.addProfile({
      label: "Remote",
      baseUrl: "https://runner.example",
    });

    await expect(store.editProfile(profile.id, {
      baseUrl: "http://runner.example:3050",
    })).rejects.toMatchObject({ code: "runner.error.insecureServer" });
    expect(store.getProfile(profile.id)?.baseUrl).toBe("https://runner.example");
  });

  it("allows plain HTTP for loopback servers and for surfaces that are not HTTPS pages", async () => {
    const { store } = createStore();
    await store.hydrate();
    await expect(store.addProfile({
      label: "Local",
      baseUrl: "http://127.0.0.1:3050",
    })).resolves.toEqual(expect.objectContaining({ baseUrl: "http://127.0.0.1:3050" }));

    const native = new RunnerProfileStore({
      storage: new MemoryStorage(),
      credentialStore: createCredentialStore().store,
      locationOrigin: "http://127.0.0.1:3050",
    });
    await native.hydrate();

    await expect(native.addProfile({
      label: "Lan runner",
      baseUrl: "http://192.168.1.20:3050",
    })).resolves.toEqual(expect.objectContaining({ baseUrl: "http://192.168.1.20:3050" }));
  });

  it("still loads a blocked HTTP server that was saved before the rule existed", async () => {
    const storage = new MemoryStorage();
    storage.setItem("omniharness.runnerProfiles", JSON.stringify({
      schemaVersion: 1,
      activeRunnerId: "legacy",
      profiles: [{
        id: "legacy",
        runnerInstanceId: null,
        label: "Lan runner",
        baseUrl: "http://192.168.1.20:3050",
        savedPassword: null,
        authTransport: "bearer",
        credentialRef: null,
        schemaVersion: 1,
        createdAt: "2026-07-31T00:00:00.000Z",
        lastConnectedAt: null,
        isSameOrigin: false,
      }],
      scopedState: {},
    }));
    const { store } = createStore(storage);

    await store.hydrate();

    expect(store.getProfile("legacy")?.baseUrl).toBe("http://192.168.1.20:3050");
    expect(store.getSnapshot().recoveryNoticeCode).toBeNull();
  });
});

describe("mixed-content detection", () => {
  it("blocks only plain-HTTP servers requested from an HTTPS page", () => {
    expect(isMixedContentBlocked("https://app.example.test", "http://192.168.1.20:3050")).toBe(true);
    expect(isMixedContentBlocked("https://app.example.test", "http://runner.example")).toBe(true);
    expect(isMixedContentBlocked("https://app.example.test", "https://runner.example")).toBe(false);
    expect(isMixedContentBlocked("http://127.0.0.1:3050", "http://192.168.1.20:3050")).toBe(false);
  });

  it("exempts loopback addresses, which browsers treat as trustworthy origins", () => {
    for (const loopback of [
      "http://localhost:3050",
      "http://runner.localhost:3050",
      "http://127.0.0.1:3050",
      "http://127.9.9.9:3050",
      "http://[::1]:3050",
    ]) {
      expect(isMixedContentBlocked("https://app.example.test", loopback)).toBe(false);
      expect(isInsecureServerFromSecurePage("https://app.example.test", loopback)).toBe(true);
    }
  });

  it("reports no verdict for an address it cannot parse", () => {
    expect(isMixedContentBlocked("https://app.example.test", "not a url")).toBe(false);
    expect(isInsecureServerFromSecurePage("not a url", "http://runner.example")).toBe(false);
  });
});
