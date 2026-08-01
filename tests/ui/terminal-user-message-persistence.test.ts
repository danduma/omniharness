import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { Terminal } from "@/components/Terminal";
import type { WorkerEntry } from "@/server/workers/entries-types";

// Regression tests for the send-time bubble flicker: a message the user just
// sent must stay visible while the unified stream catches up, even though the
// fallback gate (`allowUserMessageFallback`) closes during catch-up fetches.

const entries: WorkerEntry[] = [
  {
    id: "worker-output",
    seq: 1,
    type: "message",
    text: "Worker output",
    timestamp: "2026-08-01T10:00:00.000Z",
  },
];

const justSent = {
  id: "m-just-sent",
  content: "just sent hello",
  createdAt: "2026-08-01T10:00:05.000Z",
};

test("fallback user message is hidden while the stream gate is closed (baseline)", () => {
  Object.assign(globalThis, { React });

  const html = renderToStaticMarkup(React.createElement(Terminal, {
    entries,
    userMessages: [justSent],
    allowUserMessageFallback: false,
    showTextSizeControl: false,
  }));

  expect(html).not.toContain("just sent hello");
});

test("locally sent message stays visible while the stream gate is closed", () => {
  Object.assign(globalThis, { React });

  const html = renderToStaticMarkup(React.createElement(Terminal, {
    entries,
    userMessages: [justSent],
    allowUserMessageFallback: false,
    ungatedUserMessageIds: new Set([justSent.id]),
    showTextSizeControl: false,
  }));

  expect(html).toContain("just sent hello");
});

test("locally sent message does not double-render once its stream entry arrives", () => {
  Object.assign(globalThis, { React });

  const withStreamEntry: WorkerEntry[] = [
    ...entries,
    {
      id: justSent.id,
      seq: 2,
      type: "user_input",
      text: justSent.content,
      timestamp: justSent.createdAt,
      authorRole: "user",
      attachments: [],
    } as WorkerEntry,
  ];

  const html = renderToStaticMarkup(React.createElement(Terminal, {
    entries: withStreamEntry,
    userMessages: [justSent],
    allowUserMessageFallback: false,
    ungatedUserMessageIds: new Set([justSent.id]),
    showTextSizeControl: false,
  }));

  expect(html.split("just sent hello").length - 1).toBe(1);
});

test("sending user message renders with a sending marker", () => {
  Object.assign(globalThis, { React });

  const html = renderToStaticMarkup(React.createElement(Terminal, {
    entries,
    userMessages: [justSent],
    allowUserMessageFallback: false,
    ungatedUserMessageIds: new Set([justSent.id]),
    sendingUserMessageIds: new Set([justSent.id]),
    showTextSizeControl: false,
  }));

  expect(html).toContain('data-sending="true"');
});
