import { describe, expect, it, vi } from "vitest";
import { createElectronRuntimeAPIs } from "@/runtime-api/electron";

describe("createElectronRuntimeAPIs", () => {
  it("wraps the web adapter with Electron runtime metadata and native commands", async () => {
    const openExternal = vi.fn(async () => ({ ok: true as const }));
    const notify = vi.fn(async () => ({ ok: true }));
    const apis = createElectronRuntimeAPIs({
      nativeBridge: {
        openExternal,
        notify,
      },
    });

    expect(apis.runtime).toMatchObject({
      surface: "electron",
      label: "Desktop",
      supportsNativeNotifications: true,
      supportsEditorActions: false,
    });

    await expect(apis.native?.openExternal({ url: "https://example.com" })).resolves.toEqual({ ok: true });
    await expect(apis.native?.notify?.({ title: "Done" })).resolves.toEqual({ ok: true });
    expect(openExternal).toHaveBeenCalledWith({ url: "https://example.com" });
    expect(notify).toHaveBeenCalledWith({ title: "Done" });
  });
});
