import type * as acp from "@agentclientprotocol/sdk";
import type { OutputEntry } from "../types";

export type NormalizedSessionUpdate =
  | { kind: "message_chunk"; role: "user" | "agent" | "thought"; text: string }
  | { kind: "entry"; entry: Omit<OutputEntry, "id" | "timestamp"> };

function contentType(content: acp.ContentBlock) {
  return content.type;
}

function contentText(content: acp.ContentBlock) {
  return content.type === "text" ? content.text : null;
}

function planText(update: Extract<acp.SessionUpdate, { sessionUpdate: "plan" }>) {
  return update.entries.map((entry) => entry.content).join("\n");
}

function planUpdateText(update: Extract<acp.SessionUpdate, { sessionUpdate: "plan_update" }>) {
  const plan = update.plan;
  if (plan.type === "items") return plan.entries.map((entry) => entry.content).join("\n");
  if (plan.type === "markdown") return plan.content;
  return plan.uri;
}

export function normalizeSessionUpdate(update: acp.SessionUpdate): NormalizedSessionUpdate {
  switch (update.sessionUpdate) {
    case "user_message_chunk": {
      const text = contentText(update.content);
      return text !== null
        ? { kind: "message_chunk", role: "user", text }
        : { kind: "entry", entry: { type: "user_content", text: contentType(update.content), raw: update } };
    }
    case "agent_message_chunk": {
      const text = contentText(update.content);
      return text !== null
        ? { kind: "message_chunk", role: "agent", text }
        : { kind: "entry", entry: { type: "agent_content", text: contentType(update.content), raw: update } };
    }
    case "agent_thought_chunk": {
      const text = contentText(update.content);
      return text !== null
        ? { kind: "message_chunk", role: "thought", text }
        : { kind: "entry", entry: { type: "agent_content", text: contentType(update.content), status: "thought", raw: update } };
    }
    case "tool_call":
      return { kind: "entry", entry: {
        type: "tool_call",
        text: update.title || update.kind || update.toolCallId,
        toolCallId: update.toolCallId,
        toolKind: update.kind ?? undefined,
        status: update.status ?? undefined,
        raw: update,
      } };
    case "tool_call_update":
      return { kind: "entry", entry: {
        type: "tool_call_update",
        text: update.title || update.status || update.toolCallId,
        toolCallId: update.toolCallId,
        toolKind: update.kind ?? undefined,
        status: update.status ?? undefined,
        raw: update,
      } };
    case "plan":
      return { kind: "entry", entry: { type: "plan", text: planText(update), raw: update } };
    case "plan_update":
      return { kind: "entry", entry: { type: "plan_update", text: planUpdateText(update), raw: update } };
    case "plan_removed":
      return { kind: "entry", entry: { type: "plan_removed", text: update.id, raw: update } };
    case "available_commands_update":
      return { kind: "entry", entry: {
        type: "available_commands",
        text: update.availableCommands.map((command) => command.name).join("\n"),
        raw: update,
      } };
    case "current_mode_update":
      return { kind: "entry", entry: { type: "current_mode", text: update.currentModeId, raw: update } };
    case "config_option_update":
      return { kind: "entry", entry: { type: "config_option", text: update.configOptions.map((option) => option.name).join("\n"), raw: update } };
    case "session_info_update":
      return { kind: "entry", entry: { type: "session_info", text: update.title ?? update.updatedAt ?? "", raw: update } };
    case "usage_update":
      return { kind: "entry", entry: { type: "usage", text: `${update.used}/${update.size}`, raw: update } };
  }
}
