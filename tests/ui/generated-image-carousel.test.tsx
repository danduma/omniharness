import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

vi.mock("@/interface/home/WorkerEntryContentUrlManager", () => ({
  useWorkerEntryContent: (reference: { entryId: string }) => ({
    status: "loaded",
    url: `blob:${reference.entryId}`,
    error: null,
  }),
}));

import { Terminal } from "@/components/Terminal";
import type { WorkerEntry } from "@/server/workers/entries-types";

function generatedImage(id: string, seq: number, toolCallId: string): WorkerEntry {
  return {
    id,
    seq,
    type: "agent_content",
    text: "image",
    toolCallId,
    timestamp: `2026-08-21T22:37:${String(seq).padStart(2, "0")}.000Z`,
    authorRole: "assistant",
    raw: {
      content: {
        type: "image",
        data: "iVBORw0K\n[truncated 1000000 chars]",
        mimeType: "image/png",
        uri: `/workspace/generated_images/${id}.png`,
      },
    },
  };
}

test("generated images are an always-visible numbered carousel for their turn", () => {
  Object.assign(globalThis, { React });
  const entries: WorkerEntry[] = [
    {
      id: "turn-1",
      seq: 1,
      type: "user_input",
      text: "Create three options",
      timestamp: "2026-08-21T22:37:01.000Z",
      authorRole: "user",
    },
    {
      id: "tool-1",
      seq: 2,
      type: "tool_call",
      text: "Image generation",
      toolCallId: "image-tool-1",
      timestamp: "2026-08-21T22:37:02.000Z",
      authorRole: "assistant",
    },
    generatedImage("generated-image-1", 3, "image-tool-1"),
    {
      id: "tool-2",
      seq: 4,
      type: "tool_call",
      text: "Image generation",
      toolCallId: "image-tool-2",
      timestamp: "2026-08-21T22:37:04.000Z",
      authorRole: "assistant",
    },
    generatedImage("generated-image-2", 5, "image-tool-2"),
    {
      id: "tool-3",
      seq: 6,
      type: "tool_call",
      text: "Image generation",
      toolCallId: "image-tool-3",
      timestamp: "2026-08-21T22:37:06.000Z",
      authorRole: "assistant",
    },
    generatedImage("generated-image-3", 7, "image-tool-3"),
    {
      id: "answer",
      seq: 8,
      type: "message",
      text: "Which option should I build?",
      timestamp: "2026-08-21T22:37:08.000Z",
      authorRole: "assistant",
    },
  ];

  const html = renderToStaticMarkup(React.createElement(Terminal, {
    entries,
    workerId: "run-worker-1",
    showTextSizeControl: false,
    summarizeWorkBlocks: true,
  }));

  expect(html).toContain("Generated images");
  expect(html).toContain("Image 1 of 3");
  expect(html).toContain("Image 1");
  expect(html).toContain("Image 2");
  expect(html).toContain("Image 3");
  expect(html).toContain('src="blob:generated-image-1"');
  expect(html).not.toContain("Agent content");
});

test("generated images after a new user input form a separate carousel", () => {
  Object.assign(globalThis, { React });
  const entries: WorkerEntry[] = [
    {
      id: "turn-1",
      seq: 1,
      type: "user_input",
      text: "First turn",
      timestamp: "2026-08-21T22:37:01.000Z",
      authorRole: "user",
    },
    generatedImage("generated-image-1", 2, "image-tool-1"),
    {
      id: "turn-2",
      seq: 3,
      type: "user_input",
      text: "Second turn",
      timestamp: "2026-08-21T22:37:03.000Z",
      authorRole: "user",
    },
    generatedImage("generated-image-2", 4, "image-tool-2"),
  ];

  const html = renderToStaticMarkup(React.createElement(Terminal, {
    entries,
    workerId: "run-worker-1",
    showTextSizeControl: false,
  }));

  expect(html.match(/Generated images/g)).toHaveLength(2);
  expect(html.match(/Image 1 of 1/g)).toHaveLength(2);
});
