/** Presentation projections of provider communication; never invent delivery receipts. */
export interface AgentCommunication {
  peer: string | null;
  text: string;
  senderSessionId?: string;
  recipientSessionId?: string;
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function string(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function outgoingAgentCommunication(raw: unknown): AgentCommunication | undefined {
  const data = record(raw);
  const meta = record(data?._meta);
  const claude = record(meta?.claudeCode);
  const name = string(claude?.toolName) ?? string(data?.toolName) ?? string(data?.title);
  if (!name || !/^(?:SendMessage|(?:.*[.:/])?send_message)$/i.test(name)) return;
  let input = record(data?.rawInput);
  if (!input && typeof data?.rawInput === "string") {
    try { input = record(JSON.parse(data.rawInput)); } catch { return; }
  }
  const text = string(input?.message) ?? string(input?.content);
  if (!text) return;
  return { peer: string(input?.to) ?? string(input?.recipient) ?? string(input?.target) ?? null, text };
}

export function incomingAgentCommunication(type: string, text: string, raw: unknown): AgentCommunication | undefined {
  const data = record(raw);
  const origin = record(record(data?._meta)?.["_claude/origin"]);
  // Current Claude adapters report cross-session receipt on a completed turn's
  // usage event. Keep usage canonical and project its provider-decoded body.
  if (type === "usage" && origin?.kind === "peer" && string(origin.body)) {
    return { peer: string(origin.name) ?? string(origin.from) ?? null,
      text: origin.body as string, senderSessionId: string(origin.fromSession) };
  }
  if (type === "session_message") {
    return { peer: string(data?.senderSessionId) ?? null, text,
      senderSessionId: string(data?.senderSessionId), recipientSessionId: string(data?.recipientSessionId) };
  }
  if (type !== "user_message_chunk") return;
  // Only a complete provider envelope at the start of the entry is evidence.
  const match = text.trim().match(/^<teammate-message\b([^>]*)>([\s\S]*?)<\/teammate-message>$/);
  if (!match) return;
  const peer = match[1].match(/\bteammate_id=["']([^"']+)["']/)?.[1] ?? null;
  return { peer, text: match[2].trim() };
}
