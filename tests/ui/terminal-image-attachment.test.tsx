import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

vi.mock("@/interface/attachments/AttachmentUrlManager", () => ({
  useAttachmentUrls: () => (attachment: { storagePath?: string }) => (
    attachment.storagePath ? `/api/attachments?path=${encodeURIComponent(attachment.storagePath)}` : ""
  ),
}));

vi.mock("@/interface/home/WorkerEntryContentUrlManager", () => ({
  useWorkerEntryContent: () => ({
    status: "loaded",
    url: "blob:generated-image",
    error: null,
  }),
}));

import { Terminal } from "@/components/Terminal";
import type { WorkerEntry } from "@/server/workers/entries-types";

test("stream-backed image attachments render a thumbnail in the user message", () => {
  Object.assign(globalThis, { React });

  const entries: WorkerEntry[] = [{
    id: "message-with-image",
    seq: 1,
    type: "user_input",
    text: "Use this image",
    timestamp: "2026-08-10T12:00:00.000Z",
    authorRole: "user",
    attachments: [{
      id: "image-1",
      filename: "screenshot.png",
      mimeType: "image/png",
      sizeBytes: 1024,
      storagePath: "attachments/upload-1/image-1-screenshot.png",
    }],
  }];

  const html = renderToStaticMarkup(React.createElement(Terminal, {
    entries,
    showTextSizeControl: false,
  }));

  expect(html).toContain("<img");
  expect(html).toContain("screenshot.png");
  expect(html).toContain("attachments%2Fupload-1%2Fimage-1-screenshot.png");
});

test("legacy stream image attachments recover their thumbnail source from the message mirror", () => {
  Object.assign(globalThis, { React });

  const entries: WorkerEntry[] = [{
    id: "legacy-message-with-image",
    seq: 1,
    type: "user_input",
    text: "An older image message",
    timestamp: "2026-08-09T12:00:00.000Z",
    authorRole: "user",
    attachments: [{
      id: "legacy-image-1",
      filename: "legacy-screenshot.png",
      mimeType: "image/png",
      sizeBytes: 2048,
    }],
  }];

  const html = renderToStaticMarkup(React.createElement(Terminal, {
    entries,
    userMessages: [{
      id: "legacy-message-with-image",
      content: "An older image message",
      createdAt: "2026-08-09T12:00:00.000Z",
      attachments: [{
        id: "legacy-image-1",
        kind: "image",
        name: "legacy-screenshot.png",
        mimeType: "image/png",
        size: 2048,
        storagePath: "attachments/legacy/legacy-image-1-screenshot.png",
      }],
    }],
    showTextSizeControl: false,
  }));

  expect(html).toContain("<img");
  expect(html).toContain("attachments%2Flegacy%2Flegacy-image-1-screenshot.png");
});

test("generated image content from the unified worker stream renders inline", () => {
  Object.assign(globalThis, { React });

  const entries: WorkerEntry[] = [{
    id: "generated-image",
    seq: 1,
    type: "agent_content",
    text: "image",
    timestamp: "2026-08-21T22:37:24.903Z",
    authorRole: "assistant",
    raw: {
      content: {
        type: "image",
        data: "aW1hZ2U=",
        mimeType: "image/png",
      },
    },
  }];

  const html = renderToStaticMarkup(React.createElement(Terminal, {
    entries,
    showTextSizeControl: false,
  }));

  expect(html).toContain("<img");
  expect(html).toContain("data:image/png;base64,aW1hZ2U=");
});

test("historical generated images use their worker entry as the binary content source", () => {
  Object.assign(globalThis, { React });

  const entries = [{
    id: "historical-generated-image",
    seq: 1,
    type: "agent_content" as const,
    text: "image",
    timestamp: "2026-08-21T22:37:24.903Z",
    authorRole: "assistant" as const,
    raw: {
      content: {
        type: "image",
        data: "iVBORw0K\n[truncated 1000000 chars]",
        mimeType: "image/png",
        uri: "/workspace/.omniharness/cli-home/codex/home/generated_images/session/image.png",
      },
    },
  }];

  const html = renderToStaticMarkup(React.createElement(Terminal, {
    entries,
    workerId: "run-worker-1",
    showTextSizeControl: false,
  }));

  expect(html).toContain("<img");
  expect(html).toContain('src="blob:generated-image"');
  expect(html).not.toContain("[truncated");
});
