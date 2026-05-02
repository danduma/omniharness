import { mkdtemp, rm } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { CHAT_ATTACHMENT_MAX_FILE_SIZE_BYTES } from "@/lib/chat-attachments";
import { POST } from "@/app/api/attachments/route";

let tempRoot: string | null = null;

async function useTempRoot() {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "omniharness-attachments-"));
  process.env.OMNIHARNESS_ROOT = tempRoot;
}

describe("POST /api/attachments", () => {
  afterEach(async () => {
    delete process.env.OMNIHARNESS_ROOT;
    if (tempRoot) {
      await rm(tempRoot, { recursive: true, force: true });
      tempRoot = null;
    }
  });

  it("uploads multiple files and returns durable descriptors", async () => {
    await useTempRoot();
    const formData = new FormData();
    formData.append("files", new File(["hello"], "hello.txt", { type: "text/plain" }));
    formData.append("files", new File([new Uint8Array([1, 2, 3])], "screen.png", { type: "image/png" }));

    const response = await POST(new NextRequest("http://localhost/api/attachments", {
      method: "POST",
      body: formData,
    }));

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.attachments).toHaveLength(2);
    expect(payload.attachments[0]).toMatchObject({
      kind: "file",
      name: "hello.txt",
      mimeType: "text/plain",
      size: 5,
    });
    expect(payload.attachments[1]).toMatchObject({
      kind: "image",
      name: "screen.png",
      mimeType: "image/png",
      size: 3,
    });
    expect(payload.attachments[0].storagePath).toMatch(/^attachments\//);
  });

  it("rejects empty uploads", async () => {
    await useTempRoot();
    const response = await POST(new NextRequest("http://localhost/api/attachments", {
      method: "POST",
      body: new FormData(),
    }));

    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error.message).toContain("At least one attachment");
  });

  it("rejects oversized files", async () => {
    await useTempRoot();
    const formData = new FormData();
    formData.append("files", new File([
      new Uint8Array(CHAT_ATTACHMENT_MAX_FILE_SIZE_BYTES + 1),
    ], "large.bin", { type: "application/octet-stream" }));

    const response = await POST(new NextRequest("http://localhost/api/attachments", {
      method: "POST",
      body: formData,
    }));

    expect(response.status).toBe(413);
    const payload = await response.json();
    expect(payload.error.message).toContain("exceeds the maximum upload size");
  });
});
