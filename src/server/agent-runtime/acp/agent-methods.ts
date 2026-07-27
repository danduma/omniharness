import * as acp from "@agentclientprotocol/sdk";

type ConnectionMethodName = keyof acp.ClientSideConnection;

export const AGENT_REQUEST_DISPATCH = {
  [acp.AGENT_METHODS.initialize]: "initialize",
  [acp.AGENT_METHODS.authenticate]: "authenticate",
  [acp.AGENT_METHODS.providers_list]: "unstable_listProviders",
  [acp.AGENT_METHODS.providers_set]: "unstable_setProvider",
  [acp.AGENT_METHODS.providers_disable]: "unstable_disableProvider",
  [acp.AGENT_METHODS.logout]: "logout",
  [acp.AGENT_METHODS.session_new]: "newSession",
  [acp.AGENT_METHODS.session_load]: "loadSession",
  [acp.AGENT_METHODS.session_list]: "listSessions",
  [acp.AGENT_METHODS.session_delete]: "deleteSession",
  [acp.AGENT_METHODS.session_fork]: "unstable_forkSession",
  [acp.AGENT_METHODS.session_resume]: "resumeSession",
  [acp.AGENT_METHODS.session_close]: "closeSession",
  [acp.AGENT_METHODS.session_set_mode]: "setSessionMode",
  [acp.AGENT_METHODS.session_set_config_option]: "setSessionConfigOption",
  [acp.AGENT_METHODS.session_prompt]: "prompt",
  [acp.AGENT_METHODS.nes_start]: "unstable_startNes",
  [acp.AGENT_METHODS.nes_suggest]: "unstable_suggestNes",
  [acp.AGENT_METHODS.nes_close]: "unstable_closeNes",
  [acp.AGENT_METHODS.mcp_message]: "extMethod",
} as const satisfies Record<string, ConnectionMethodName>;

export const AGENT_NOTIFICATION_DISPATCH = {
  [acp.AGENT_METHODS.session_cancel]: "cancel",
  [acp.AGENT_METHODS.document_did_open]: "unstable_didOpenDocument",
  [acp.AGENT_METHODS.document_did_change]: "unstable_didChangeDocument",
  [acp.AGENT_METHODS.document_did_close]: "unstable_didCloseDocument",
  [acp.AGENT_METHODS.document_did_save]: "unstable_didSaveDocument",
  [acp.AGENT_METHODS.document_did_focus]: "unstable_didFocusDocument",
  [acp.AGENT_METHODS.nes_accept]: "unstable_acceptNes",
  [acp.AGENT_METHODS.nes_reject]: "unstable_rejectNes",
} as const satisfies Record<string, ConnectionMethodName>;

export async function invokeAgentRequest(
  connection: acp.ClientSideConnection,
  method: string,
  params: Record<string, unknown>,
): Promise<unknown> {
  const dispatch = AGENT_REQUEST_DISPATCH[method as keyof typeof AGENT_REQUEST_DISPATCH];
  if (!dispatch) return connection.extMethod(method, params);
  if (dispatch === "extMethod") return connection.extMethod(method, params);
  const callable = connection[dispatch] as unknown as (value: Record<string, unknown>) => Promise<unknown>;
  return callable.call(connection, params);
}

export async function sendAgentNotification(
  connection: acp.ClientSideConnection,
  method: string,
  params: Record<string, unknown>,
): Promise<void> {
  const dispatch = AGENT_NOTIFICATION_DISPATCH[method as keyof typeof AGENT_NOTIFICATION_DISPATCH];
  if (!dispatch) return connection.extNotification(method, params);
  const callable = connection[dispatch] as unknown as (value: Record<string, unknown>) => Promise<void>;
  await callable.call(connection, params);
}
