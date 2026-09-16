import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { Terminal } from "@/components/Terminal";
import {
  buildMessageModelAttribution,
  formatMessageModelAttribution,
} from "@/components/terminal/model-attribution";
import type { WorkerEntry } from "@/server/workers/entries-types";

function configOptionEntry(args: {
  id: string;
  seq: number;
  model?: string;
  effort?: string;
  workerId?: string;
}) {
  return {
    id: args.id,
    seq: args.seq,
    type: "config_option" as const,
    text: "Model\nEffort",
    timestamp: "2026-09-12T10:00:00.000Z",
    ...(args.workerId ? { workerId: args.workerId } : {}),
    raw: {
      sessionUpdate: "config_option_update",
      configOptions: [
        { id: "mode", name: "Mode", currentValue: "default" },
        ...(args.model ? [{ id: "model", name: "Model", currentValue: args.model }] : []),
        ...(args.effort ? [{ id: "effort", name: "Effort", currentValue: args.effort }] : []),
      ],
    },
  };
}

function messageEntry(args: { id: string; seq: number; text: string; workerId?: string }) {
  return {
    id: args.id,
    seq: args.seq,
    type: "message" as const,
    text: args.text,
    timestamp: "2026-09-12T10:00:01.000Z",
    ...(args.workerId ? { workerId: args.workerId } : {}),
  };
}

describe("buildMessageModelAttribution", () => {
  test("attributes a message to the session config that preceded it", () => {
    const attribution = buildMessageModelAttribution([
      configOptionEntry({ id: "config-1", seq: 1, model: "claude-opus-5", effort: "low" }),
      messageEntry({ id: "message-1", seq: 2, text: "First answer" }),
      configOptionEntry({ id: "config-2", seq: 3, model: "claude-opus-5", effort: "high" }),
      messageEntry({ id: "message-2", seq: 4, text: "Second answer" }),
    ]);

    expect(attribution.get("message-1")).toEqual({ model: "claude-opus-5", effort: "low" });
    expect(attribution.get("message-2")).toEqual({ model: "claude-opus-5", effort: "high" });
  });

  test("keeps the previous selection when an update reports only the option that changed", () => {
    const attribution = buildMessageModelAttribution([
      configOptionEntry({ id: "config-1", seq: 1, model: "claude-opus-5", effort: "low" }),
      configOptionEntry({ id: "config-2", seq: 2, effort: "high" }),
      messageEntry({ id: "message-1", seq: 3, text: "Answer" }),
    ]);

    expect(attribution.get("message-1")).toEqual({ model: "claude-opus-5", effort: "high" });
  });

  test("falls back to the live selection only when the window shows no config at all", () => {
    const fallback = { workerId: "run-worker-1", model: "claude-opus-5", effort: "high" };

    const withoutConfig = buildMessageModelAttribution(
      [messageEntry({ id: "message-1", seq: 40, text: "Answer", workerId: "run-worker-1" })],
      fallback,
    );
    expect(withoutConfig.get("message-1")).toEqual({ model: "claude-opus-5", effort: "high" });

    // A config row in the window means the settings changed inside it, so the
    // live values say nothing about the messages written before that point.
    const withConfig = buildMessageModelAttribution(
      [
        messageEntry({ id: "message-1", seq: 40, text: "Answer", workerId: "run-worker-1" }),
        configOptionEntry({ id: "config-1", seq: 41, model: "claude-opus-5", effort: "high", workerId: "run-worker-1" }),
        messageEntry({ id: "message-2", seq: 42, text: "Later answer", workerId: "run-worker-1" }),
      ],
      fallback,
    );
    expect(withConfig.get("message-1")).toBeUndefined();
    expect(withConfig.get("message-2")).toEqual({ model: "claude-opus-5", effort: "high" });
  });

  test("never lends one worker's selection to another worker's messages", () => {
    const attribution = buildMessageModelAttribution(
      [
        configOptionEntry({ id: "config-1", seq: 1, model: "claude-opus-5", effort: "low", workerId: "run-worker-1" }),
        messageEntry({ id: "message-1", seq: 2, text: "From worker one", workerId: "run-worker-1" }),
        messageEntry({ id: "message-2", seq: 1, text: "From worker two", workerId: "run-worker-2" }),
      ],
      { workerId: "run-worker-1", model: "claude-opus-5", effort: "low" },
    );

    expect(attribution.get("message-1")).toEqual({ model: "claude-opus-5", effort: "low" });
    expect(attribution.get("message-2")).toBeUndefined();
  });
});

describe("formatMessageModelAttribution", () => {
  test("names the model and effort, not the harness", () => {
    expect(formatMessageModelAttribution("claude-opus-5", "high")).toBe("Opus 5 (High)");
    expect(formatMessageModelAttribution("claude-opus-5[1m]", "xhigh")).toBe("Opus 5 (Extra High)");
    expect(formatMessageModelAttribution("gpt-5.6-sol", "medium")).toBe("GPT-5.6 Sol (Medium)");
  });

  test("drops the effort when the session reports one we cannot name", () => {
    expect(formatMessageModelAttribution("claude-opus-5", "default")).toBe("Opus 5");
    expect(formatMessageModelAttribution("claude-opus-5", null)).toBe("Opus 5");
  });

  test("renders nothing without a model", () => {
    expect(formatMessageModelAttribution(null, "high")).toBeNull();
    expect(formatMessageModelAttribution("  ", "high")).toBeNull();
  });
});

test("the transcript labels an agent message with the model that produced it", () => {
  Object.assign(globalThis, { React });

  const entries = [
    configOptionEntry({ id: "config-1", seq: 1, model: "claude-opus-5", effort: "high" }),
    messageEntry({ id: "message-1", seq: 2, text: "Worker answer" }),
  ] as unknown as WorkerEntry[];

  const html = renderToStaticMarkup(React.createElement(Terminal, {
    entries,
    showTextSizeControl: false,
  }));

  expect(html).toContain("Opus 5 (High)");
});

test("the agent message copy control sits bottom-left on mobile and bottom-right from sm up", () => {
  Object.assign(globalThis, { React });

  const entries = [
    messageEntry({ id: "message-1", seq: 1, text: "Worker answer" }),
  ] as unknown as WorkerEntry[];

  const html = renderToStaticMarkup(React.createElement(Terminal, {
    entries,
    showTextSizeControl: false,
  }));

  const overlayClasses = html.match(/class="([^"]*absolute bottom-0[^"]*)"/)?.[1] ?? "";
  expect(overlayClasses).toContain("left-0");
  expect(overlayClasses).toContain("sm:left-auto");
  expect(overlayClasses).toContain("sm:right-0");
});
