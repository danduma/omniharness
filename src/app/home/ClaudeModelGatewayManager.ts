import {
  parseClaudeModelGatewayStatus,
  type ClaudeModelGatewayAction,
  type ClaudeModelGatewayStatus,
} from "@/lib/claude-model-gateway";
import { StateManager } from "@/lib/state-manager";

type GatewayManagerState = {
  status: ClaudeModelGatewayStatus | null;
  loading: boolean;
  pendingAction: ClaudeModelGatewayAction | null;
  error: string | null;
  oauthUrl: string | null;
  oauthState: string | null;
};

async function responsePayload(response: Response) {
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const error = payload.error && typeof payload.error === "object" ? payload.error as Record<string, unknown> : null;
    throw new Error(typeof error?.message === "string" ? error.message : `Gateway request failed with HTTP ${response.status}.`);
  }
  return payload;
}

export class ClaudeModelGatewayManager extends StateManager<GatewayManagerState> {
  private requestSequence = 0;
  private latestRequest = 0;
  private readonly fetchImpl: typeof fetch;

  constructor(fetchImpl: typeof fetch = fetch) {
    super({ status: null, loading: false, pendingAction: null, error: null, oauthUrl: null, oauthState: null });
    this.fetchImpl = fetchImpl.bind(globalThis);
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
      const payload = await responsePayload(await this.fetchImpl("/api/integrations/claude-model-gateway", {
        credentials: "include",
      }));
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
      const payload = await responsePayload(await this.fetchImpl("/api/integrations/claude-model-gateway", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      }));
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
