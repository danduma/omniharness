import { describe, expect, it } from "vitest";
import {
  RunnerProfileStore,
  SAME_ORIGIN_PROFILE_ID,
} from "@/interface/runners/RunnerProfileStore";
import type { RunnerCredentialStore } from "@/interface/runners/RunnerCredentialStore";

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
});
