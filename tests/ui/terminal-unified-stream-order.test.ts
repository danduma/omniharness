import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { Terminal } from "@/components/Terminal";
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
