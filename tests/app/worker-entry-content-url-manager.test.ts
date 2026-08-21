import { describe, expect, it, vi } from "vitest";

describe("WorkerEntryContentUrlManager", () => {
  it("loads one object URL per worker entry and revokes it after the final release", async () => {
    const module = await import("@/interface/home/WorkerEntryContentUrlManager").catch(() => null);
    expect(module).not.toBeNull();
    if (!module) return;

    const createObjectUrl = vi.fn(() => "blob:generated-image");
    const revokeObjectUrl = vi.fn();
    const load = vi.fn(async () => new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }));
    const manager = new module.WorkerEntryContentUrlManager({ createObjectUrl, revokeObjectUrl });
    const reference = { workerId: "worker-1", entryId: "image-1" };

    manager.acquire(reference, load);
    manager.acquire(reference, load);
    await vi.waitFor(() => expect(manager.getContentState(reference).status).toBe("loaded"));

    expect(load).toHaveBeenCalledOnce();
    expect(manager.getContentState(reference)).toMatchObject({
      status: "loaded",
      url: "blob:generated-image",
      error: null,
    });

    manager.release(reference);
    expect(revokeObjectUrl).not.toHaveBeenCalled();
    manager.release(reference);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:generated-image");
    expect(manager.getContentState(reference).status).toBe("idle");
  });

  it("rejects a successful non-image response instead of creating a broken image URL", async () => {
    const module = await import("@/interface/home/WorkerEntryContentUrlManager").catch(() => null);
    expect(module).not.toBeNull();
    if (!module) return;

    const createObjectUrl = vi.fn(() => "blob:not-an-image");
    const manager = new module.WorkerEntryContentUrlManager({
      createObjectUrl,
      revokeObjectUrl: vi.fn(),
    });
    const reference = { workerId: "worker-1", entryId: "image-1" };

    manager.acquire(reference, async () => new Blob([JSON.stringify({ entries: [] })], {
      type: "application/json",
    }));
    await vi.waitFor(() => expect(manager.getContentState(reference).status).toBe("error"));

    expect(createObjectUrl).not.toHaveBeenCalled();
    expect(manager.getContentState(reference)).toMatchObject({
      status: "error",
      url: "",
    });
  });
});
