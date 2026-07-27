import * as acp from "@agentclientprotocol/sdk";

export type AcpCapabilityStatus = "operational" | "disabled";
export type AcpMethodCapability = {
  status: AcpCapabilityStatus;
  transport: "request" | "notification" | "both";
  owner: string;
};

function methodRegistry<T extends string>(
  entries: ReadonlyArray<readonly [T, AcpMethodCapability]>,
) {
  return new Map<T, AcpMethodCapability>(entries);
}

export const AGENT_TO_CLIENT_METHODS = methodRegistry([
  [acp.CLIENT_METHODS.fs_read_text_file, { status: "operational", transport: "request", owner: "filesystem" }],
  [acp.CLIENT_METHODS.fs_write_text_file, { status: "operational", transport: "request", owner: "filesystem" }],
  [acp.CLIENT_METHODS.session_request_permission, { status: "operational", transport: "request", owner: "interactions" }],
  [acp.CLIENT_METHODS.session_update, { status: "operational", transport: "notification", owner: "session-updates" }],
  [acp.CLIENT_METHODS.elicitation_create, { status: "operational", transport: "request", owner: "interactions" }],
  [acp.CLIENT_METHODS.elicitation_complete, { status: "operational", transport: "notification", owner: "interactions" }],
  [acp.CLIENT_METHODS.terminal_create, { status: "operational", transport: "request", owner: "terminal" }],
  [acp.CLIENT_METHODS.terminal_output, { status: "operational", transport: "request", owner: "terminal" }],
  [acp.CLIENT_METHODS.terminal_release, { status: "operational", transport: "request", owner: "terminal" }],
  [acp.CLIENT_METHODS.terminal_wait_for_exit, { status: "operational", transport: "request", owner: "terminal" }],
  [acp.CLIENT_METHODS.terminal_kill, { status: "operational", transport: "request", owner: "terminal" }],
  [acp.CLIENT_METHODS.mcp_connect, { status: "operational", transport: "request", owner: "mcp" }],
  [acp.CLIENT_METHODS.mcp_message, { status: "operational", transport: "both", owner: "mcp" }],
  [acp.CLIENT_METHODS.mcp_disconnect, { status: "operational", transport: "request", owner: "mcp" }],
] as const);

export const CLIENT_TO_AGENT_METHODS = methodRegistry([
  [acp.AGENT_METHODS.initialize, { status: "operational", transport: "request", owner: "connection" }],
  [acp.AGENT_METHODS.authenticate, { status: "operational", transport: "request", owner: "authentication" }],
  [acp.AGENT_METHODS.providers_list, { status: "operational", transport: "request", owner: "providers" }],
  [acp.AGENT_METHODS.providers_set, { status: "operational", transport: "request", owner: "providers" }],
  [acp.AGENT_METHODS.providers_disable, { status: "operational", transport: "request", owner: "providers" }],
  [acp.AGENT_METHODS.logout, { status: "operational", transport: "request", owner: "authentication" }],
  [acp.AGENT_METHODS.session_new, { status: "operational", transport: "request", owner: "sessions" }],
  [acp.AGENT_METHODS.session_load, { status: "operational", transport: "request", owner: "sessions" }],
  [acp.AGENT_METHODS.session_list, { status: "operational", transport: "request", owner: "sessions" }],
  [acp.AGENT_METHODS.session_delete, { status: "operational", transport: "request", owner: "sessions" }],
  [acp.AGENT_METHODS.session_fork, { status: "operational", transport: "request", owner: "sessions" }],
  [acp.AGENT_METHODS.session_resume, { status: "operational", transport: "request", owner: "sessions" }],
  [acp.AGENT_METHODS.session_close, { status: "operational", transport: "request", owner: "sessions" }],
  [acp.AGENT_METHODS.session_set_mode, { status: "operational", transport: "request", owner: "session-settings" }],
  [acp.AGENT_METHODS.session_set_config_option, { status: "operational", transport: "request", owner: "session-settings" }],
  [acp.AGENT_METHODS.session_prompt, { status: "operational", transport: "request", owner: "turns" }],
  [acp.AGENT_METHODS.session_cancel, { status: "operational", transport: "notification", owner: "turns" }],
  [acp.AGENT_METHODS.nes_start, { status: "operational", transport: "request", owner: "nes" }],
  [acp.AGENT_METHODS.nes_suggest, { status: "operational", transport: "request", owner: "nes" }],
  [acp.AGENT_METHODS.nes_close, { status: "operational", transport: "request", owner: "nes" }],
  [acp.AGENT_METHODS.nes_accept, { status: "operational", transport: "notification", owner: "nes" }],
  [acp.AGENT_METHODS.nes_reject, { status: "operational", transport: "notification", owner: "nes" }],
  [acp.AGENT_METHODS.document_did_open, { status: "operational", transport: "notification", owner: "documents" }],
  [acp.AGENT_METHODS.document_did_change, { status: "operational", transport: "notification", owner: "documents" }],
  [acp.AGENT_METHODS.document_did_close, { status: "operational", transport: "notification", owner: "documents" }],
  [acp.AGENT_METHODS.document_did_save, { status: "operational", transport: "notification", owner: "documents" }],
  [acp.AGENT_METHODS.document_did_focus, { status: "operational", transport: "notification", owner: "documents" }],
  [acp.AGENT_METHODS.mcp_message, { status: "operational", transport: "both", owner: "mcp" }],
] as const);

export const ACP_SESSION_UPDATES = [
  "user_message_chunk",
  "agent_message_chunk",
  "agent_thought_chunk",
  "tool_call",
  "tool_call_update",
  "plan",
  "plan_update",
  "plan_removed",
  "available_commands_update",
  "current_mode_update",
  "config_option_update",
  "session_info_update",
  "usage_update",
] as const satisfies readonly acp.SessionUpdate["sessionUpdate"][];

export const ACP_CONTENT_BLOCKS = ["text", "image", "audio", "resource_link", "resource"] as const;
export const ACP_TOOL_CALL_CONTENT = ["content", "diff", "terminal"] as const satisfies readonly acp.ToolCallContent["type"][];

export function operationalClientCapabilities(): acp.ClientCapabilities {
  return {
    fs: { readTextFile: true, writeTextFile: true },
    elicitation: { form: {}, url: {} },
    plan: {},
    terminal: true,
  };
}
