import { normalizeClaudeGatewayBaseUrl, validateClaudeGatewayModel, type ClaudeGatewayModelInput } from "@/lib/claude-model-gateway";

export class ClaudeModelGatewayClientError extends Error {
  readonly status: number | null;
  readonly cause: unknown;

  constructor(message: string, options: { status?: number | null; cause?: unknown } = {}) {
    super(message);
    this.name = "ClaudeModelGatewayClientError";
    this.status = options.status ?? null;
    this.cause = options.cause;
  }
}

type ClientOptions = {
  baseUrl: string;
  apiToken: string;
  managementToken: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function safeOAuthUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ClaudeModelGatewayClientError("Gateway OAuth response contains an invalid URL.");
  }
  const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "::1";
  if (url.username || url.password || (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))) {
    throw new ClaudeModelGatewayClientError("Gateway OAuth response contains an unsafe URL.");
  }
  return url.toString();
}

export function createClaudeModelGatewayClient(options: ClientOptions) {
  const baseUrl = normalizeClaudeGatewayBaseUrl(options.baseUrl);
  const timeoutMs = Math.max(10, Math.min(options.timeoutMs ?? 5_000, 30_000));
  const fetchImpl = options.fetchImpl ?? fetch;

  const request = async (path: string, token: string) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    timer.unref?.();
    try {
      const response = await fetchImpl(`${baseUrl}${path}`, {
        signal: controller.signal,
        headers: { authorization: `Bearer ${token}`, accept: "application/json" },
      });
      if (!response.ok) {
        throw new ClaudeModelGatewayClientError(`Gateway request ${path} failed with HTTP ${response.status}.`, { status: response.status });
      }
      try {
        return await response.json() as unknown;
      } catch (cause) {
        throw new ClaudeModelGatewayClientError(`Gateway request ${path} returned invalid JSON.`, { status: response.status, cause });
      }
    } catch (error) {
      if (error instanceof ClaudeModelGatewayClientError) throw error;
      if (controller.signal.aborted) throw new ClaudeModelGatewayClientError(`Gateway request ${path} timed out.`, { cause: error });
      throw new ClaudeModelGatewayClientError(`Gateway request ${path} failed.`, { cause: error });
    } finally {
      clearTimeout(timer);
    }
  };

  return {
    async listModels(): Promise<ClaudeGatewayModelInput[]> {
      if (!options.apiToken.trim()) throw new ClaudeModelGatewayClientError("Gateway API token is not configured.");
      const payload = asRecord(await request("/v1/models", options.apiToken));
      if (!payload || !Array.isArray(payload.data)) throw new ClaudeModelGatewayClientError("Gateway model response is malformed.");
      const models = payload.data.map((entry) => {
        const model = asRecord(entry);
        if (!model || typeof model.id !== "string") throw new ClaudeModelGatewayClientError("Gateway model response contains an invalid model.");
        try {
          return validateClaudeGatewayModel({
            id: model.id,
            ...(typeof model.display_name === "string" ? { label: model.display_name } : {}),
          });
        } catch (cause) {
          throw new ClaudeModelGatewayClientError("Gateway model response contains an invalid model.", { cause });
        }
      });
      const unique = new Map<string, ClaudeGatewayModelInput>();
      for (const model of models) {
        if (!unique.has(model.id)) unique.set(model.id, model);
      }
      return [...unique.values()];
    },

    async checkReady() {
      await this.listModels();
      return true;
    },

    async createCodexOAuthUrl() {
      if (!options.managementToken.trim()) throw new ClaudeModelGatewayClientError("Gateway management token is not configured.");
      const payload = asRecord(await request("/v0/management/codex-auth-url?is_webui=true", options.managementToken));
      if (!payload || typeof payload.url !== "string" || typeof payload.state !== "string") {
        throw new ClaudeModelGatewayClientError("Gateway OAuth response is malformed.");
      }
      return { url: safeOAuthUrl(payload.url), state: payload.state };
    },

    async isCodexOAuthConnected() {
      if (!options.managementToken.trim()) throw new ClaudeModelGatewayClientError("Gateway management token is not configured.");
      const payload = await request("/v0/management/auth-files", options.managementToken);
      const record = asRecord(payload);
      const files = Array.isArray(payload) ? payload : Array.isArray(record?.files) ? record.files : null;
      if (!files) throw new ClaudeModelGatewayClientError("Gateway auth-files response is malformed.");
      return files.some((entry) => {
        const file = asRecord(entry);
        const channel = typeof file?.type === "string" ? file.type : typeof file?.provider === "string" ? file.provider : "";
        return channel.toLowerCase() === "codex" && file?.disabled !== true;
      });
    },
  };
}

export type ClaudeModelGatewayClient = ReturnType<typeof createClaudeModelGatewayClient>;
