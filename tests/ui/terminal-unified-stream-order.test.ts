import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { shouldTerminalScrollToLatest, Terminal } from "@/components/Terminal";
import type { WorkerEntry } from "@/server/workers/entries-types";

test("unified stream renders entries in seq order when timestamps arrive out of order", () => {
  Object.assign(globalThis, { React });

  const entries: WorkerEntry[] = [
    {
      id: "initial-user-message",
      seq: 1,
      type: "user_input",
      text: "Initial request",
      timestamp: "2026-05-16T23:57:55.797Z",
      authorRole: "user",
      attachments: [],
    },
    {
      id: "worker-message",
      seq: 2,
      type: "message",
      text: "Worker activity",
      timestamp: "2026-05-16T23:56:39.106Z",
    },
  ];

  const html = renderToStaticMarkup(React.createElement(Terminal, {
    entries,
    showTextSizeControl: false,
  }));

  expect(html.indexOf("Initial request")).toBeLessThan(html.indexOf("Worker activity"));
});

test("unified stream displays the initial user message before lifecycle and thinking indicators", () => {
  Object.assign(globalThis, { React });

  const entries: WorkerEntry[] = [
    {
      id: "initial-user-message",
      seq: 1,
      type: "user_input",
      text: "Convert the crowded mobile bottom bar into a menu",
      timestamp: "2026-05-17T01:14:27.000Z",
      authorRole: "user",
      attachments: [],
    },
    {
      id: "agent-activity",
      seq: 2,
      type: "message",
      text: "Agent activity started",
      timestamp: "2026-05-17T01:14:27.792Z",
    },
  ];

  const html = renderToStaticMarkup(React.createElement(Terminal, {
    entries,
    showPendingAssistantIndicator: true,
    showTextSizeControl: false,
  }));
  const text = html.replace(/<[^>]+>/g, "");

  expect(text.indexOf("Convert the crowded mobile bottom bar into a menu")).toBe(0);
  expect(text.indexOf("Convert the crowded mobile bottom bar into a menu")).toBeLessThan(text.indexOf("Agent activity started"));
  expect(text.indexOf("Convert the crowded mobile bottom bar into a menu")).toBeLessThan(text.indexOf("Thinking"));
});

test("native conversation terminal starts at meaningful output without chasing pending space", () => {
  expect(shouldTerminalScrollToLatest({
    variant: "native",
    isFirstRenderedActivity: true,
    latestActivityKind: "pending_assistant",
  })).toBe(false);

  expect(shouldTerminalScrollToLatest({
    variant: "native",
    isFirstRenderedActivity: false,
    latestActivityKind: "pending_assistant",
  })).toBe(false);

  expect(shouldTerminalScrollToLatest({
    variant: "native",
    isFirstRenderedActivity: true,
    latestActivityKind: "user_message",
  })).toBe(false);

  expect(shouldTerminalScrollToLatest({
    variant: "native",
    isFirstRenderedActivity: true,
    latestActivityKind: "message",
  })).toBe(true);

  expect(shouldTerminalScrollToLatest({
    variant: "native",
    isFirstRenderedActivity: false,
    latestActivityKind: "message",
  })).toBe(true);

  expect(shouldTerminalScrollToLatest({
    variant: "terminal",
    isFirstRenderedActivity: true,
    latestActivityKind: "pending_assistant",
  })).toBe(true);
});

test("unified stream falls back to direct user messages when stale entries lack user_input", () => {
  Object.assign(globalThis, { React });

  const entries: WorkerEntry[] = [
    {
      id: "worker-spawned",
      seq: 1,
      type: "lifecycle",
      text: "Worker spawned (gemini)",
      timestamp: "2026-05-17T00:44:20.200Z",
      authorRole: "system",
    },
    {
      id: "agent-activity",
      seq: 2,
      type: "message",
      text: "Looking for the top bar branch label.",
      timestamp: "2026-05-17T00:45:03.708Z",
    },
  ];

  const html = renderToStaticMarkup(React.createElement(Terminal, {
    entries,
    allowUserMessageFallback: true,
    userMessages: [{
      id: "opening-message",
      content: "stop showing the branch in the top bar!!",
      createdAt: "2026-05-17T00:44:20.000Z",
      attachments: [],
    }],
    showTextSizeControl: false,
  }));
  const text = html.replace(/<[^>]+>/g, "");

  expect(text.indexOf("stop showing the branch in the top bar!!")).toBe(0);
  expect(text.indexOf("stop showing the branch in the top bar!!")).toBeLessThan(text.indexOf("Looking for the top bar branch label."));
});

test("unified stream hides worker status lifecycle noise from the terminal", () => {
  Object.assign(globalThis, { React });

  const entries: WorkerEntry[] = [
    {
      id: "status-1",
      seq: 1,
      type: "lifecycle",
      text: "Worker status: idle → working",
      timestamp: "2026-05-17T00:44:20.200Z",
      authorRole: "system",
      raw: { eventType: "worker.status", prev: "idle", next: "working" },
    },
    {
      id: "status-2",
      seq: 2,
      type: "lifecycle",
      text: "Worker reached terminal status: cancelled",
      timestamp: "2026-05-17T00:44:21.200Z",
      authorRole: "system",
      raw: { eventType: "worker.terminal", status: "cancelled" },
    },
    {
      id: "worker-message",
      seq: 3,
      type: "message",
      text: "Actual worker output",
      timestamp: "2026-05-17T00:45:03.708Z",
    },
  ];

  const html = renderToStaticMarkup(React.createElement(Terminal, {
    entries,
    showTextSizeControl: false,
  }));
  const text = html.replace(/<[^>]+>/g, "");

  expect(text).toContain("Actual worker output");
  expect(text).not.toContain("Worker status:");
  expect(text).not.toContain("Worker reached terminal status:");
});

test("unified stream hides worker spawned lifecycle noise from direct output", () => {
  Object.assign(globalThis, { React });

  const entries: WorkerEntry[] = [
    {
      id: "initial-user-message",
      seq: 1,
      type: "user_input",
      text: "Explain supervisor tools.",
      timestamp: "2026-05-19T14:32:31.654Z",
      authorRole: "user",
      attachments: [],
    },
    {
      id: "worker-spawned",
      seq: 2,
      type: "lifecycle",
      text: "Worker spawned (gemini)",
      timestamp: "2026-05-19T14:32:31.728Z",
      authorRole: "system",
      raw: { eventType: "worker.spawned", workerType: "gemini" },
    },
    {
      id: "worker-message",
      seq: 3,
      type: "message",
      text: "Supervisor tools spawn and coordinate workers.",
      timestamp: "2026-05-19T14:32:34.000Z",
    },
  ];

  const html = renderToStaticMarkup(React.createElement(Terminal, {
    entries,
    showTextSizeControl: false,
  }));
  const text = html.replace(/<[^>]+>/g, "");

  expect(text).toContain("Explain supervisor tools.");
  expect(text).toContain("Supervisor tools spawn and coordinate workers.");
  expect(text).not.toContain("Worker spawned");
});

test("unified stream hides arbitrary lifecycle entries from direct output", () => {
  Object.assign(globalThis, { React });

  const entries: WorkerEntry[] = [
    {
      id: "initial-user-message",
      seq: 1,
      type: "user_input",
      text: "Explain supervisor tools.",
      timestamp: "2026-05-19T14:32:31.654Z",
      authorRole: "user",
      attachments: [],
    },
    {
      id: "reattach-lifecycle",
      seq: 2,
      type: "lifecycle",
      text: "Worker reattached after restart",
      timestamp: "2026-05-19T14:32:32.000Z",
      authorRole: "system",
      raw: { eventType: "worker.reattached" },
    },
    {
      id: "worker-message",
      seq: 3,
      type: "message",
      text: "Supervisor tools spawn and coordinate workers.",
      timestamp: "2026-05-19T14:32:34.000Z",
    },
  ];

  const html = renderToStaticMarkup(React.createElement(Terminal, {
    entries,
    showTextSizeControl: false,
  }));
  const text = html.replace(/<[^>]+>/g, "");

  expect(text).toContain("Explain supervisor tools.");
  expect(text).toContain("Supervisor tools spawn and coordinate workers.");
  expect(text).not.toContain("Worker reattached after restart");
});

test("unified stream loading shows fallback user messages without inventing assistant activity", () => {
  Object.assign(globalThis, { React });

  const html = renderToStaticMarkup(React.createElement(Terminal, {
    entries: [],
    allowUserMessageFallback: true,
    userMessages: [
      {
        id: "first-user-message",
        content: "first prompt",
        createdAt: "2026-05-17T00:43:48.044Z",
        attachments: [],
      },
      {
        id: "second-user-message",
        content: "second prompt",
        createdAt: "2026-05-17T01:08:20.000Z",
        attachments: [],
      },
    ],
    isLoading: true,
    showTextSizeControl: false,
  }));
  const text = html.replace(/<[^>]+>/g, "");

  expect(text).toContain("first prompt");
  expect(text).toContain("second prompt");
  expect(text).not.toContain("Thinking...");
});

test("unified stream dedupes fallback user messages already present in entries", () => {
  Object.assign(globalThis, { React });

  const entries: WorkerEntry[] = [
    {
      id: "first-user-message",
      seq: 1,
      type: "user_input",
      text: "first prompt",
      timestamp: "2026-05-17T00:43:48.044Z",
      authorRole: "user",
      attachments: [],
    },
    {
      id: "middle-agent-message",
      seq: 2,
      type: "message",
      text: "middle agent work",
      timestamp: "2026-05-17T00:43:50.000Z",
    },
  ];

  const html = renderToStaticMarkup(React.createElement(Terminal, {
    entries,
    allowUserMessageFallback: true,
    userMessages: [
      {
        id: "first-user-message",
        content: "first prompt",
        createdAt: "2026-05-17T00:43:48.044Z",
        attachments: [],
      },
      {
        id: "second-user-message",
        content: "second prompt",
        createdAt: "2026-05-17T01:08:20.000Z",
        attachments: [],
      },
    ],
    isLoading: true,
    showTextSizeControl: false,
  }));
  const text = html.replace(/<[^>]+>/g, "");

  expect(text).toContain("first prompt");
  expect(text).toContain("middle agent work");
  expect(text).toContain("second prompt");
  expect(text.match(/first prompt/g)).toHaveLength(1);
});

test("unified stream dedupes fallback user messages when stream ids differ", () => {
  Object.assign(globalThis, { React });

  const entries: WorkerEntry[] = [
    {
      id: "stream-generated-user-input-id",
      seq: 1,
      type: "user_input",
      text: "same prompt",
      timestamp: "2026-05-17T00:43:48.044Z",
      authorRole: "user",
      attachments: [],
    },
    {
      id: "agent-message",
      seq: 2,
      type: "message",
      text: "worker answer",
      timestamp: "2026-05-17T00:43:50.000Z",
    },
  ];

  const html = renderToStaticMarkup(React.createElement(Terminal, {
    entries,
    allowUserMessageFallback: true,
    userMessages: [
      {
        id: "database-message-id",
        content: "same prompt",
        createdAt: "2026-05-17T00:43:48.500Z",
        attachments: [],
      },
    ],
    showTextSizeControl: false,
  }));
  const text = html.replace(/<[^>]+>/g, "");

  expect(text).toContain("same prompt");
  expect(text).toContain("worker answer");
  expect(text.match(/same prompt/g)).toHaveLength(1);
});
