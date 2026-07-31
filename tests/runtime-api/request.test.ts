import { describe, expect, it, vi } from "vitest";
import { createFetchRuntimeRequest } from "@/runtime-api/request";

describe("createFetchRuntimeRequest", () => {
  it("passes abort signals through to fetch", async () => {
    const controller = new AbortController();
    const fetchImpl: typeof fetch = vi.fn(async (_input, init) => {
      expect(init?.signal).toBe(controller.signal);
      return await new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(init.signal?.reason);
        }, { once: true });
      });
    });
    const request = createFetchRuntimeRequest({
      fetchImpl,
      surface: "web",
    });
    const pending = request("GET", "/api/settings", {
      signal: controller.signal,
    });
    controller.abort(new DOMException("Stopped", "AbortError"));
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });

  it("refuses redirects instead of following them", async () => {
    const request = createFetchRuntimeRequest({
      fetchImpl: async () => new Response(null, {
        status: 302,
        headers: { location: "https://unexpected.example/" },
      }),
      surface: "web",
    });

    await expect(request("GET", "/api/settings")).rejects.toMatchObject({
      code: "runtime.redirect_refused",
      surface: "web",
    });
  });

  it("preserves multipart bodies and binary responses", async () => {
    const formData = new FormData();
    formData.append("projectPath", "/tmp/project");
    const fetchImpl: typeof fetch = vi.fn(async (_input, init) => {
      expect(init?.body).toBe(formData);
      expect(new Headers(init?.headers).has("content-type")).toBe(false);
      return new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "application/octet-stream" },
      });
    });
    const request = createFetchRuntimeRequest({
      fetchImpl,
      surface: "web",
    });

    const result = await request("POST", "/api/attachments", {
      body: formData,
      responseType: "blob",
    });
    expect(result).toBeInstanceOf(Blob);
    expect(Array.from(new Uint8Array(await (result as Blob).arrayBuffer()))).toEqual([1, 2, 3]);
  });
});
