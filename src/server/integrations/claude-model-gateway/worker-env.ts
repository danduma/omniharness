import { CLAUDE_GATEWAY_REQUIRED_ENV, decodeClaudeGatewayModel, normalizeClaudeGatewayBaseUrl } from "@/lib/claude-model-gateway";
import { emitNamedEvent } from "@/server/events/named-events";
import type { ClaudeModelGatewaySettings } from "./settings";

export type ClaudeGatewayCredentialSource = "gateway";

export function parseClaudeCodeVersion(value: string | null | undefined): [number, number, number] | null {
  const match = /(?:^|\s|v)(\d+)\.(\d+)\.(\d+)(?:\D|$)/.exec(value?.trim() ?? "");
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function supportsGatewayDiscovery(version: string | null | undefined) {
  const parsed = parseClaudeCodeVersion(version);
  if (!parsed) return false;
  const [major, minor, patch] = parsed;
  return major > 2 || (major === 2 && (minor > 1 || (minor === 1 && patch >= 129)));
}

let detectedClaudeCodeVersion: Promise<string | null> | null = null;

async function detectClaudeCodeVersion() {
  if (!detectedClaudeCodeVersion) {
    detectedClaudeCodeVersion = new Promise<string | null>((resolve) => {
      void import("node:child_process").then(({ execFile }) => {
        execFile("claude", ["--version"], {
          encoding: "utf8",
          timeout: 2_000,
          maxBuffer: 64 * 1024,
        }, (error, stdout) => resolve(error ? null : stdout.trim() || null));
      }).catch(() => resolve(null));
    });
  }
  return detectedClaudeCodeVersion;
}

export function buildClaudeGatewayEnvironment(input: {
  type: string;
  model?: string | null;
  accountId?: string | null;
  baseUrl: string;
  apiToken: string;
  claudeCodeVersion?: string | null;
}) {
  const rawModel = decodeClaudeGatewayModel(input.model);
  if (!rawModel) return null;
  if (input.type.trim().toLowerCase() !== "claude") {
    throw new Error("Gateway-routed models can only be used with Claude Code workers.");
  }
  if (input.accountId != null && input.accountId.trim() !== "") {
    throw new Error("Gateway-routed Claude models require the gateway provider connection, not a Claude account.");
  }
  const apiToken = input.apiToken.trim();
  if (!apiToken) throw new Error("Claude model gateway API token is not configured.");
  const environment: Record<string, string> = {
    ANTHROPIC_BASE_URL: normalizeClaudeGatewayBaseUrl(input.baseUrl),
    ANTHROPIC_AUTH_TOKEN: apiToken,
    ANTHROPIC_MODEL: rawModel,
    CLAUDE_CODE_SUBAGENT_MODEL: rawModel,
    ...CLAUDE_GATEWAY_REQUIRED_ENV,
  };
  if (supportsGatewayDiscovery(input.claudeCodeVersion)) {
    environment.ANTHROPIC_CUSTOM_MODEL_OPTION = rawModel;
    environment.CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY = "1";
  }
  return { rawModel, environment };
}

let readinessInFlight: Promise<ClaudeModelGatewaySettings> | null = null;

function sharedReadinessCheck(check: () => Promise<ClaudeModelGatewaySettings>) {
  if (!readinessInFlight) {
    readinessInFlight = check().finally(() => { readinessInFlight = null; });
  }
  return readinessInFlight;
}

export async function prepareClaudeGatewayLaunch(input: {
  type: string;
  model?: string | null;
  accountId?: string | null;
  claudeCodeVersion?: string | null;
  runId?: string;
  workerId?: string;
  ensureReady?: () => Promise<ClaudeModelGatewaySettings>;
  detectVersion?: () => Promise<string | null>;
}) {
  const rawModel = decodeClaudeGatewayModel(input.model);
  if (!rawModel) return null;
  try {
    const settings = await sharedReadinessCheck(input.ensureReady ?? (async () => {
      const { getClaudeModelGatewayService } = await import(".");
      return getClaudeModelGatewayService().ensureReady();
    }));
    const claudeCodeVersion = input.claudeCodeVersion
      ?? await (input.detectVersion ?? detectClaudeCodeVersion)();
    const built = buildClaudeGatewayEnvironment({
      ...input,
      claudeCodeVersion,
      baseUrl: settings.baseUrl,
      apiToken: settings.apiToken,
    });
    if (!built) throw new Error("Gateway model route is invalid.");
    return {
      encodedModel: input.model!.trim(),
      rawModel: built.rawModel,
      credentialSource: "gateway" as const,
      environment: built.environment,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emitNamedEvent({
      kind: "claude_gateway.spawn_refused",
      ...(input.runId ? { runId: input.runId } : {}),
      ...(input.workerId ? { workerId: input.workerId } : {}),
      reason: message,
    });
    emitNamedEvent({
      kind: "error.surfaced",
      code: "claude_gateway.not_ready",
      message,
      surface: "toast",
      ...(input.runId ? { runId: input.runId } : {}),
      ...(input.workerId ? { workerId: input.workerId } : {}),
    });
    throw error;
  }
}
