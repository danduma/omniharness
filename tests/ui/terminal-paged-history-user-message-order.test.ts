import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { Terminal } from "@/components/Terminal";
import type { WorkerEntry } from "@/server/workers/entries-types";

// Regression: session 73fe3ee52059.
//
// The transcript loads a bounded tail page (the last ~100 entries). Every
// earlier `user_input` entry lives in a page that has not been fetched, so the
// "does this message already exist in the stream?" test cannot see it and the
// `messages`-table row was re-injected as a fallback bubble. A fallback row
// carries no `seq`, so it was given one by anchoring it to the first loaded
// entry that is not older than it — which, for a window that postdates every
// message, is the same entry for all of them. Every user message in the
// conversation collapsed onto one fractional seq and rendered as a single
// block above the agent output instead of interleaved with it.

const tailWindow: WorkerEntry[] = [
  {
    id: "e-1215",
    seq: 1215,
    type: "message",
    text: "Late agent output A",
    timestamp: "2026-08-03T06:47:00.000Z",
  },
  {
    id: "e-1216",
    seq: 1216,
    type: "message",
    text: "Late agent output B",
    timestamp: "2026-08-03T06:47:10.000Z",
  },
];

const messagesFromEarlierPages = [
  { id: "m-1", content: "first user turn", createdAt: "2026-08-03T06:32:15.992Z" },
  { id: "m-2", content: "second user turn", createdAt: "2026-08-03T06:38:56.202Z" },
  { id: "m-3", content: "third user turn", createdAt: "2026-08-03T06:39:20.707Z" },
  { id: "m-4", content: "fourth user turn", createdAt: "2026-08-03T06:43:28.497Z" },
  { id: "m-5", content: "fifth user turn", createdAt: "2026-08-03T06:45:22.617Z" },
];

test("messages whose stream entries live in unloaded pages are not stacked onto the tail window", () => {
  Object.assign(globalThis, { React });

  const html = renderToStaticMarkup(React.createElement(Terminal, {
    entries: tailWindow,
    userMessages: messagesFromEarlierPages,
    allowUserMessageFallback: true,
    hasMoreHistory: true,
    showTextSizeControl: false,
  }));

  for (const message of messagesFromEarlierPages) {
    expect(html).not.toContain(message.content);
  }
  expect(html).toContain("Late agent output A");
});

test("a message newer than the loaded window still renders while older pages are missing", () => {
  Object.assign(globalThis, { React });

  const justSent = {
    id: "m-new",
    content: "sent after the window",
    createdAt: "2026-08-03T06:48:00.000Z",
  };

  const html = renderToStaticMarkup(React.createElement(Terminal, {
    entries: tailWindow,
    userMessages: [...messagesFromEarlierPages, justSent],
    allowUserMessageFallback: true,
    hasMoreHistory: true,
    showTextSizeControl: false,
  }));

  const text = html.replace(/<[^>]+>/g, "");
  expect(text).toContain("sent after the window");
  expect(text.indexOf("Late agent output B")).toBeLessThan(text.indexOf("sent after the window"));
});

test("several fallback messages sharing an anchor keep their own order instead of collapsing", () => {
  Object.assign(globalThis, { React });

  // Whole history loaded (`hasMoreHistory` false), so absence from the window
  // is real absence and the rows are genuinely ours to place. They all anchor
  // to the same entry; each must still get a distinct position, in send order.
  const entries: WorkerEntry[] = [
    {
      id: "e-1",
      seq: 1,
      type: "message",
      text: "only agent output",
      timestamp: "2026-08-03T09:00:00.000Z",
    },
  ];

  const html = renderToStaticMarkup(React.createElement(Terminal, {
    entries,
    userMessages: [
      { id: "m-b", content: "second question", createdAt: "2026-08-03T08:00:02.000Z" },
      { id: "m-a", content: "first question", createdAt: "2026-08-03T08:00:01.000Z" },
    ],
    allowUserMessageFallback: true,
    hasMoreHistory: false,
    showTextSizeControl: false,
  }));

  const text = html.replace(/<[^>]+>/g, "");
  expect(text.indexOf("first question")).toBeGreaterThanOrEqual(0);
  expect(text.indexOf("first question")).toBeLessThan(text.indexOf("second question"));
  expect(text.indexOf("second question")).toBeLessThan(text.indexOf("only agent output"));
});

test("ordering does not depend on the order items are handed to the sort", () => {
  Object.assign(globalThis, { React });

  // The old comparator picked seq or timestamp per pair, so a mix of items
  // that do and don't carry a seq could form a cycle and sort differently
  // depending on input order. Same set, two input orders, one result.
  const streamEntries: WorkerEntry[] = [
    { id: "s-1", seq: 1, type: "message", text: "alpha output", timestamp: "2026-08-03T10:00:30.000Z" },
    { id: "s-2", seq: 2, type: "user_input", text: "beta question", timestamp: "2026-08-03T10:00:10.000Z", authorRole: "user", attachments: [] },
    { id: "s-3", seq: 3, type: "message", text: "gamma output", timestamp: "2026-08-03T10:00:20.000Z" },
  ];

  const render = (entries: WorkerEntry[]) => renderToStaticMarkup(React.createElement(Terminal, {
    entries,
    userMessages: [{ id: "m-loose", content: "delta question", createdAt: "2026-08-03T10:00:15.000Z" }],
    allowUserMessageFallback: true,
    hasMoreHistory: false,
    showTextSizeControl: false,
  })).replace(/<[^>]+>/g, "");

  const forward = render(streamEntries);
  const reversed = render([...streamEntries].reverse());

  const positions = (text: string) => ["alpha output", "beta question", "gamma output", "delta question"]
    .map((needle) => [needle, text.indexOf(needle)] as const)
    .sort((left, right) => left[1] - right[1])
    .map(([needle]) => needle);

  expect(positions(forward)).toEqual(positions(reversed));
  // seq is the authority, so the out-of-order timestamps must not reorder the
  // three stream entries: alpha(1) → beta(2) → gamma(3).
  expect(forward.indexOf("alpha output")).toBeLessThan(forward.indexOf("beta question"));
  expect(forward.indexOf("beta question")).toBeLessThan(forward.indexOf("gamma output"));
});
