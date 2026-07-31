import {
  parseClaudeModelGatewayStatus,
  type ClaudeModelGatewayAction,
  type ClaudeModelGatewayStatus,
} from "@/lib/claude-model-gateway";
import { StateManager } from "@/lib/state-manager";
import type { RuntimeAPIs } from "@/runtime-api/types";

type GatewayManagerState = {
  status: ClaudeModelGatewayStatus | null;
  loading: boolean;
  pendingAction: ClaudeModelGatewayAction | null;
  error: string | null;
  oauthUrl: string | null;
  oauthState: string | null;
};

type GatewayApi = RuntimeAPIs["settings"]["claudeGateway"];

export class ClaudeModelGatewayManager extends StateManager<GatewayManagerState> {
  private requestSequence = 0;
  private latestRequest = 0;
  private api: GatewayApi | null;

  constructor(api: GatewayApi | null = null) {
    super({ status: null, loading: false, pendingAction: null, error: null, oauthUrl: null, oauthState: null });
    this.api = api;
  }

  configure(api: GatewayApi) {
    this.api = api;
  }

  private getApi() {
    if (!this.api) {
      throw new Error("The Claude model gateway is not connected to the runtime.");
    }
    return this.api;
  }

  applyLiveStatus(value: unknown) {
    const next = parseClaudeModelGatewayStatus(value);
    const currentRevision = this.getSnapshot().status?.revision ?? -1;
    if (next.revision < currentRevision) return false;
    this.patch({
      status: next,
      error: next.operation?.state === "failed" ? next.operation.error?.message ?? null : null,
      ...(next.oauth === "connected" || next.oauth === "error" || next.service === "stopped"
        ? { oauthUrl: null, oauthState: null }
        : {}),
    });
    return true;
  }

  resetRevisionAuthority() {
    this.patch({ status: null, oauthUrl: null, oauthState: null });
  }

  async refresh() {
    const requestId = ++this.requestSequence;
    this.latestRequest = requestId;
    this.patch({ loading: true, error: null });
    try {
      const payload = await this.getApi().load() as Record<string, unknown>;
      if (this.latestRequest !== requestId) return;
      this.applyLiveStatus(payload.status);
    } catch (error) {
      if (this.latestRequest !== requestId) return;
      this.patch({ error: error instanceof Error ? error.message : String(error) });
    } finally {
      if (this.latestRequest === requestId) this.patch({ loading: false });
    }
  }

  async runAction(action: ClaudeModelGatewayAction) {
    const requestId = ++this.requestSequence;
    this.latestRequest = requestId;
    this.patch({ pendingAction: action, error: null });
    try {
      const payload = await this.getApi().execute({ action }) as Record<string, unknown>;
      if (this.latestRequest !== requestId) return;
      if (payload.status) this.applyLiveStatus(payload.status);
      if (action === "connect") {
        this.patch({
          oauthUrl: typeof payload.url === "string" ? payload.url : null,
          oauthState: typeof payload.state === "string" ? payload.state : null,
        });
      }
    } catch (error) {
      if (this.latestRequest !== requestId) return;
      this.patch({ error: error instanceof Error ? error.message : String(error) });
    } finally {
      if (this.latestRequest === requestId) this.patch({ pendingAction: null });
    }
  }

  async installAndStart() {
    await this.runAction("install");
    if (!this.getSnapshot().error) await this.runAction("start");
  }
}

export const claudeModelGatewayManager = new ClaudeModelGatewayManager();
