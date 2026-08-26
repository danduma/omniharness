import { describe, expect, it, vi } from "vitest";
import {
  createFetchRuntimeRequest,
  isRuntimeTransportFailure,
  normalizeRuntimeHttpError,
  runtimeErrorMessage,
} from "@/runtime-api/request";

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

  it("reads a failed binary request's error body as JSON", async () => {
    // Honouring responseType on a failure would hand back an opaque Blob and
    // strip the only description of what went wrong.
    const fetchImpl: typeof fetch = vi.fn(async () => new Response(
      JSON.stringify({ error: { message: "Generated image data is unavailable." } }),
      { status: 404, headers: { "content-type": "application/json" } },
    ));
    const request = createFetchRuntimeRequest({ fetchImpl, surface: "web" });

    await expect(request("GET", "/api/workers/w1/entries?contentEntryId=e1", {
      responseType: "blob",
    })).rejects.toMatchObject({
      code: "runtime.http_404",
      message: "Generated image data is unavailable.",
    });
  });
});

describe("runtimeErrorMessage", () => {
  it("describes a RuntimeApiError instead of stringifying it to [object Object]", () => {
    const error = normalizeRuntimeHttpError({
      status: 404,
      body: { error: { message: "Generated image data is unavailable." } },
      surface: "web",
    });

    expect(runtimeErrorMessage(error)).toBe("Generated image data is unavailable.");
    expect(runtimeErrorMessage(error)).not.toContain("[object Object]");
  });

  it("falls back for Errors and values carrying no message", () => {
    expect(runtimeErrorMessage(new Error("boom"))).toBe("boom");
    expect(runtimeErrorMessage("plain")).toBe("plain");
    expect(runtimeErrorMessage({ message: "" })).toBe("[object Object]");
  });
});

describe("isRuntimeTransportFailure", () => {
  it("separates a server that answered from one that never replied", async () => {
    // Anything the server answered carries a code, whatever the status.
    const fetchImpl: typeof fetch = vi.fn(async () => new Response(
      JSON.stringify({ error: { code: "runner.restart.control_unavailable" } }),
      { status: 503 },
    ));
    const answered = await createFetchRuntimeRequest({ fetchImpl, surface: "web" })("POST", "/api/runner/restart")
      .then(() => null, (error: unknown) => error);
    expect(isRuntimeTransportFailure(answered)).toBe(false);

    // A status with no error body still gets a synthesised code.
    const bare: typeof fetch = vi.fn(async () => new Response("", { status: 502 }));
    const bareError = await createFetchRuntimeRequest({ fetchImpl: bare, surface: "web" })("POST", "/api/runner/restart")
      .then(() => null, (error: unknown) => error);
    expect(isRuntimeTransportFailure(bareError)).toBe(false);

    // The connection dying mid-request is what a restart actually looks like.
    const dropped: typeof fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const droppedError = await createFetchRuntimeRequest({ fetchImpl: dropped, surface: "web" })("POST", "/api/runner/restart")
      .then(() => null, (error: unknown) => error);
    expect(isRuntimeTransportFailure(droppedError)).toBe(true);
  });

  it("treats missing and malformed rejections as transport failures", () => {
    expect(isRuntimeTransportFailure(undefined)).toBe(true);
    expect(isRuntimeTransportFailure(null)).toBe(true);
    expect(isRuntimeTransportFailure(new Error("boom"))).toBe(true);
    expect(isRuntimeTransportFailure({ code: 500 })).toBe(true);
  });
});

describe("normalizeRuntimeHttpError", () => {
  it("describes a bare 502 response as a disconnected server that is reconnecting", () => {
    const error = normalizeRuntimeHttpError({
      status: 502,
      body: "<html><body>502 Bad Gateway</body></html>",
      surface: "web",
    });

    expect(error).toMatchObject({
      code: "runtime.http_502",
      message: "Cannot connect to server. Reconnecting…",
      surface: "web",
    });
    expect(error.message).not.toContain("502");
  });

  it("preserves a structured 502 error returned by the server", () => {
    const error = normalizeRuntimeHttpError({
      status: 502,
      body: { error: { code: "runner.upstream_failed", message: "The runner failed." } },
      surface: "web",
    });

    expect(error).toMatchObject({
      code: "runner.upstream_failed",
      message: "The runner failed.",
      surface: "web",
    });
  });
});
