import { describe, expect, it } from "vitest";
import {
  IMAGE_CONTENT_DATA_CHARS,
  elideInlineImageContentData,
  inlineImageContentData,
  preserveInlineImageContentData,
} from "@/shared/worker-entries";
import { buildGeneratedImagesActivity } from "@/components/terminal/generated-image-activity";
import type { WorkerEntry } from "@/shared/worker-entries";

const TRUNCATED = "iVBORw0K\n[truncated 141592 chars]";

function imageRaw(data: string) {
  return { content: { type: "image", data, mimeType: "image/png" } };
}

describe("inlineImageContentData", () => {
  it("finds the payload on content entries only", () => {
    expect(inlineImageContentData("agent_content", imageRaw("abc"))).toBe("abc");
    expect(inlineImageContentData("user_content", imageRaw("abc"))).toBe("abc");
    expect(inlineImageContentData("tool_call", imageRaw("abc"))).toBeNull();
    expect(inlineImageContentData("agent_content", { content: { type: "text", text: "hi" } })).toBeNull();
    expect(inlineImageContentData("agent_content", undefined)).toBeNull();
    // Tool results nest content as an array; that is not an inline image.
    expect(inlineImageContentData("agent_content", { content: [imageRaw("abc")] })).toBeNull();
  });
});

describe("preserveInlineImageContentData", () => {
  it("restores the payload the generic compactor truncated", () => {
    const original = imageRaw("A".repeat(10_000));
    const compacted = imageRaw(TRUNCATED);

    const result = preserveInlineImageContentData("agent_content", original, compacted) as {
      content: { data: string; mimeType: string };
    };

    expect(result.content.data).toBe("A".repeat(10_000));
    // Everything the compactor did to the rest of the notification stands.
    expect(result.content.mimeType).toBe("image/png");
  });

  it("leaves non-image and oversized payloads to the compactor", () => {
    const compacted = imageRaw(TRUNCATED);
    expect(preserveInlineImageContentData("tool_call", imageRaw("A".repeat(10_000)), compacted))
      .toBe(compacted);
    expect(preserveInlineImageContentData(
      "agent_content",
      imageRaw("A".repeat(IMAGE_CONTENT_DATA_CHARS + 1)),
      compacted,
    )).toBe(compacted);
  });
});

describe("elideInlineImageContentData", () => {
  it("swaps the payload for a pointer without disturbing other fields", () => {
    const entry = {
      id: "image-1",
      type: "agent_content",
      raw: { sessionUpdate: "agent_message_chunk", ...imageRaw("A".repeat(10_000)) },
    };

    const result = elideInlineImageContentData(entry, "worker-1") as typeof entry & {
      raw: { sessionUpdate: string; content: Record<string, unknown> };
    };

    expect(result.raw.content.data).toBeUndefined();
    expect(result.raw.content.mimeType).toBe("image/png");
    expect(result.raw.content.omniWorkerContent).toEqual({ workerId: "worker-1", entryId: "image-1" });
    expect(result.raw.sessionUpdate).toBe("agent_message_chunk");
    expect(entry.raw.content.data).toBe("A".repeat(10_000));
  });

  it("passes through entries that carry no inline image", () => {
    const entry = { id: "t1", type: "tool_call", raw: { content: { type: "text" } } };
    expect(elideInlineImageContentData(entry, "worker-1")).toBe(entry);
  });
});

describe("buildGeneratedImagesActivity", () => {
  it("resolves images through the server's content pointer", () => {
    const entries = [
      {
        id: "image-1",
        seq: 1,
        type: "agent_content",
        text: "image",
        timestamp: "2026-08-24T15:12:11.870Z",
        raw: {
          content: {
            type: "image",
            mimeType: "image/png",
            omniWorkerContent: { workerId: "worker-7", entryId: "image-1" },
          },
        },
      },
    ] as unknown as WorkerEntry[];

    const [gallery] = buildGeneratedImagesActivity(entries, "fallback-worker");

    expect(gallery.images).toHaveLength(1);
    expect(gallery.images[0].data).toBeUndefined();
    expect(gallery.images[0].reference).toEqual({ workerId: "worker-7", entryId: "image-1" });
  });
});
