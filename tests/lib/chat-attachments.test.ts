import { describe, expect, it } from "vitest";
import {
  appendAttachmentContext,
  resolveImageAttachments,
  type ChatAttachment,
} from "@/lib/chat-attachments";

const resolvePath = (storagePath: string) => `/data/${storagePath}`;

const image: ChatAttachment = {
  id: "attachment-1",
  kind: "image",
  name: "screen.png",
  mimeType: "image/png",
  size: 237334,
  storagePath: "attachments/08ac7677/78d6923a-image.png",
};

const file: ChatAttachment = {
  id: "attachment-2",
  kind: "file",
  name: "notes.md",
  mimeType: "text/markdown",
  size: 512,
  storagePath: "attachments/08ac7677/notes.md",
};

describe("chat attachment prompt context", () => {
  it("gives an inlined image a disk path for file-producing work", () => {
    // Regression: Claude could see an inlined image, but without the saved
    // path it searched unrelated temp directories when asked to turn the
    // image into project assets. Keep the pixels and the usable path together.
    const context = appendAttachmentContext("what is wrong here?", [image], {
      resolvePath,
      imagesInlined: true,
    });

    expect(context).toContain("Attached images (included directly in this message):");
    expect(context).toContain("screen.png");
    expect(context).toContain("path: /data/attachments/08ac7677/78d6923a-image.png");
  });

  it("never advertises view_image, which only exists on codex workers", () => {
    const context = appendAttachmentContext("look", [image], { resolvePath, imagesInlined: true });
    expect(context).not.toContain("view_image");

    const pathBased = appendAttachmentContext("look", [image], { resolvePath });
    expect(pathBased).not.toContain("view_image");
  });

  it("still gives paths for images when they are not inlined", () => {
    const context = appendAttachmentContext("look", [image], { resolvePath });

    expect(context).toContain("Attached images, readable from disk at the paths shown:");
    expect(context).toContain("path: /data/attachments/08ac7677/78d6923a-image.png");
  });

  it("keeps paths for non-image files even when images are inlined", () => {
    const context = appendAttachmentContext("review these", [image, file], {
      resolvePath,
      imagesInlined: true,
    });

    expect(context).toContain("Attached files available to inspect:");
    expect(context).toContain("path: /data/attachments/08ac7677/notes.md");
    expect(context).toContain("path: /data/attachments/08ac7677/78d6923a-image.png");
  });

  it("returns the bare message when there is nothing attached", () => {
    expect(appendAttachmentContext("just text", [], { resolvePath })).toBe("just text");
  });

  it("resolves only images, defaulting a missing mime type", () => {
    expect(resolveImageAttachments([image, file], resolvePath)).toEqual([
      { path: "/data/attachments/08ac7677/78d6923a-image.png", mimeType: "image/png" },
    ]);

    expect(resolveImageAttachments([{ ...image, mimeType: "" }], resolvePath)).toEqual([
      { path: "/data/attachments/08ac7677/78d6923a-image.png", mimeType: "image/png" },
    ]);
  });

  it("skips attachments that were never persisted", () => {
    const { storagePath: _unused, ...unpersisted } = image;
    expect(resolveImageAttachments([unpersisted], resolvePath)).toEqual([]);
    expect(appendAttachmentContext("hi", [unpersisted], { resolvePath })).toBe("hi");
  });
});
