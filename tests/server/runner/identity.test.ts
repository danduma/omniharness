import { describe, expect, it } from "vitest";
import {
  ensureRunnerIdentity,
  rekeyRunnerIdentity,
  renameRunner,
  type RunnerIdentityStore,
} from "@/server/runner/identity";

class MemoryIdentityStore implements RunnerIdentityStore {
  value: string | null = null;
  writes = 0;

  async read() {
    return this.value;
  }

  async writeIfAbsent(value: string) {
    if (this.value === null) {
      this.value = value;
      this.writes += 1;
    }
  }

  async write(value: string) {
    this.value = value;
  }
}

describe("runner identity", () => {
  it("creates one durable identity and reuses it on later starts", async () => {
    const store = new MemoryIdentityStore();

    const first = await ensureRunnerIdentity(store);
    const second = await ensureRunnerIdentity(store);

    expect(first.runnerInstanceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(second).toEqual(first);
    expect(first.name).toBe("OmniHarness Runner");
    expect(store.writes).toBe(1);
  });

  it("converges concurrent first starts on the stored identity", async () => {
    const store = new MemoryIdentityStore();
    const identities = await Promise.all([
      ensureRunnerIdentity(store),
      ensureRunnerIdentity(store),
      ensureRunnerIdentity(store),
    ]);

    expect(new Set(identities.map((identity) => identity.runnerInstanceId))).toHaveLength(1);
    expect(store.writes).toBe(1);
  });

  it("renames a runner without changing its durable identity", async () => {
    const store = new MemoryIdentityStore();
    const original = await ensureRunnerIdentity(store);

    const renamed = await renameRunner("Studio runner", store);

    expect(renamed).toEqual({
      runnerInstanceId: original.runnerInstanceId,
      name: "Studio runner",
    });
  });

  it("rekeys a runner while preserving its display name", async () => {
    const store = new MemoryIdentityStore();
    const original = await renameRunner("Studio runner", store);

    const rekeyed = await rekeyRunnerIdentity(store);

    expect(rekeyed.name).toBe("Studio runner");
    expect(rekeyed.runnerInstanceId).not.toBe(original.runnerInstanceId);
  });

  it("rejects invalid runner names", async () => {
    const store = new MemoryIdentityStore();
    await expect(renameRunner("   ", store)).rejects.toThrow("name");
    await expect(renameRunner("x".repeat(81), store)).rejects.toThrow("80");
  });
});
