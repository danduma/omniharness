import { describe, expect, it } from "vitest";
import {
  IMAGE_ATTACHMENT_MAX_EDGE_PX,
  compressImageAttachment,
  scaledImageDimensions,
} from "@/interface/attachments/compress-image-attachment";
import { uploadPendingChatAttachments } from "@/interface/home/upload-attachments";

describe("scaledImageDimensions", () => {
  it("keeps images that already fit the edge limit", () => {
    expect(scaledImageDimensions(1200, 800)).toEqual({ width: 1200, height: 800 });
  });

  it("scales a phone screenshot down to the edge limit, preserving aspect ratio", () => {
    expect(scaledImageDimensions(1179, 2556)).toEqual({ width: 945, height: IMAGE_ATTACHMENT_MAX_EDGE_PX });
  });
});

describe("compressImageAttachment", () => {
  it("returns the original file when the image cannot be decoded here", async () => {
    const file = new File([new Uint8Array(1024)], "shot.png", { type: "image/png" });
    await expect(compressImageAttachment(file)).resolves.toBe(file);
  });

  it("never re-encodes GIFs or SVGs", async () => {
    const gif = new File([new Uint8Array(1024)], "anim.gif", { type: "image/gif" });
    await expect(compressImageAttachment(gif)).resolves.toBe(gif);
  });
});

describe("uploadPendingChatAttachments", () => {
  it("uploads files under their attachment names when no compression applies", async () => {
    const image = new File([new Uint8Array(8)], "original.png", { type: "image/png" });
    const doc = new File(["hello"], "notes.txt", { type: "text/plain" });
    let uploaded: FormData | null = null;
    await uploadPendingChatAttachments([
      { id: "a", kind: "image", name: "screen.png", mimeType: "image/png", size: 8, file: image },
      { id: "b", kind: "file", name: "notes.txt", mimeType: "text/plain", size: 5, file: doc },
    ], {
      upload: async (formData: FormData) => {
        uploaded = formData;
        return { ok: true, attachments: [] };
      },
    } as never);

    const files = (uploaded as FormData | null)?.getAll("files") as File[];
    expect(files.map((file) => file.name)).toEqual(["screen.png", "notes.txt"]);
  });
});
