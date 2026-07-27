import { randomUUID } from "node:crypto";
import * as acp from "@agentclientprotocol/sdk";

const MCP_MESSAGE_TIMEOUT_MS = 30_000;

export type AcpMcpHandler = {
  request(method: string, params?: Record<string, unknown> | null): Promise<unknown>;
  notify(method: string, params?: Record<string, unknown> | null): Promise<void>;
  close?(): Promise<void> | void;
};

const registeredAcpMcpHandlers = new Map<string, AcpMcpHandler>();

export function registerAcpMcpHandler(acpId: string, handler: AcpMcpHandler) {
  registeredAcpMcpHandlers.set(acpId, handler);
  return () => registeredAcpMcpHandlers.delete(acpId);
}

export function registeredAcpMcpHandlersSnapshot(): ReadonlyMap<string, AcpMcpHandler> {
  return new Map(registeredAcpMcpHandlers);
}

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), MCP_MESSAGE_TIMEOUT_MS);
    timer.unref?.();
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

export class McpService {
  private readonly connections = new Map<string, AcpMcpHandler>();

  constructor(
    private readonly handlers: ReadonlyMap<string, AcpMcpHandler> = registeredAcpMcpHandlersSnapshot(),
    private readonly onLifecycle?: (action: "created" | "released", connectionId: string) => void,
  ) {}

  get size() {
    return this.connections.size;
  }

  private get(connectionId: string) {
    const handler = this.connections.get(connectionId);
    if (!handler) throw acp.RequestError.invalidParams({ connectionId }, "Unknown MCP connection");
    return handler;
  }

  async connect(params: acp.ConnectMcpRequest): Promise<acp.ConnectMcpResponse> {
    const handler = this.handlers.get(params.acpId);
    if (!handler) throw acp.RequestError.invalidParams({ acpId: params.acpId }, "Unknown ACP MCP server");
    const connectionId = randomUUID();
    this.connections.set(connectionId, handler);
    this.onLifecycle?.("created", connectionId);
    return { connectionId };
  }

  async message(params: acp.MessageMcpRequest): Promise<acp.MessageMcpResponse> {
    return withTimeout(
      this.get(params.connectionId).request(params.method, params.params),
      `MCP request ${params.method}`,
    );
  }

  async notify(params: acp.MessageMcpNotification): Promise<void> {
    await withTimeout(
      this.get(params.connectionId).notify(params.method, params.params),
      `MCP notification ${params.method}`,
    );
  }

  async disconnect(params: acp.DisconnectMcpRequest): Promise<acp.DisconnectMcpResponse> {
    const handler = this.get(params.connectionId);
    this.connections.delete(params.connectionId);
    this.onLifecycle?.("released", params.connectionId);
    await handler.close?.();
    return {};
  }

  async dispose() {
    const connections = [...this.connections.entries()];
    this.connections.clear();
    for (const [connectionId] of connections) this.onLifecycle?.("released", connectionId);
    await Promise.allSettled(connections.map(([, handler]) => handler.close?.()));
  }
}
