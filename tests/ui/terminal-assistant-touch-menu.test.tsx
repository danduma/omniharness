import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

vi.mock("@/interface/attachments/AttachmentUrlManager", () => ({
  useAttachmentUrls: () => () => "",
}));

vi.mock("@/interface/home/WorkerEntryContentUrlManager", () => ({
  useWorkerEntryContent: () => ({ status: "idle", url: null, error: null }),
}));

import { Terminal } from "@/components/Terminal";
import type { WorkerEntry } from "@/server/workers/entries-types";

test("assistant messages render both the hover toolbar and the touch-only actions menu", () => {
  Object.assign(globalThis, { React });

  const entries: WorkerEntry[] = [{
    id: "agent-message",
    seq: 1,
    type: "message",
    text: "worker answer",
    timestamp: "2026-10-06T08:00:00.000Z",
  }];

  const html = renderToStaticMarkup(React.createElement(Terminal, {
    entries,
    showTextSizeControl: false,
    getAssistantMessageActions: () => [{ label: "Fork", icon: null, onClick: () => {} }],
  }));

  // Hover overlay is hidden on touch; the ⋯ menu only shows on touch.
  expect(html).toContain("touch:hidden");
  expect(html).toContain("hidden items-center text-muted-foreground/70 touch:flex");
  expect(html).toContain('aria-label="Message actions"');
});
