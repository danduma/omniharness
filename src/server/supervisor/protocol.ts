export interface SupervisorToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface SupervisorToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

export class SupervisorProtocolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupervisorProtocolError";
  }
}

export function parseSupervisorToolCall(toolCalls: SupervisorToolCall[] | undefined) {
  if (!toolCalls || toolCalls.length === 0) {
    throw new SupervisorProtocolError("Supervisor response did not include a tool call.");
  }

  const [toolCall] = toolCalls;
  let args: Record<string, unknown>;

  try {
    args = JSON.parse(toolCall.function.arguments);
  } catch {
    throw new SupervisorProtocolError(
      `Tool "${toolCall.function.name}" returned malformed JSON arguments.`,
    );
  }

  return {
    id: toolCall.id,
    name: toolCall.function.name,
    args,
  };
}

export function parseSupervisorToolCallFromMastra(toolCalls: unknown[] | undefined) {
  if (!toolCalls || toolCalls.length === 0) {
    throw new SupervisorProtocolError("Supervisor response did not include a tool call.");
  }

  const [toolCall] = toolCalls as Array<{ payload?: { toolCallId?: unknown; toolName?: unknown; args?: unknown } }>;
  const payload = toolCall?.payload;
  if (!payload || typeof payload.toolName !== "string") {
    throw new SupervisorProtocolError("Supervisor response included an invalid Mastra tool call.");
  }

  return {
    id: typeof payload.toolCallId === "string" ? payload.toolCallId : payload.toolName,
    name: payload.toolName,
    args: payload.args && typeof payload.args === "object" && !Array.isArray(payload.args)
      ? payload.args as Record<string, unknown>
      : {},
  };
}

export function stringifyToolResult(payload: Record<string, unknown>) {
  return JSON.stringify(payload);
}
