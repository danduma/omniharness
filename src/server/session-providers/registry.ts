import { emitNamedEvent } from "@/server/events/named-events";
import { omniSessionProvider } from "./omni-provider";
import { processSessionProvider } from "./process-provider";
import type { SessionProvider, SessionType } from "./types";

const providers = new Map<SessionType, SessionProvider>([
  [omniSessionProvider.type, omniSessionProvider],
  [processSessionProvider.type, processSessionProvider],
]);

export function getSessionProvider(sessionType: SessionType): SessionProvider {
  const provider = providers.get(sessionType);
  if (!provider) {
    emitNamedEvent({
      kind: "error.surfaced",
      code: "session.provider.unknown",
      message: `Unknown session provider: ${sessionType}`,
      surface: "toast",
    });
    throw Object.assign(new Error(`Unknown session provider: ${sessionType}`), { status: 400 });
  }
  return provider;
}

export function getRegisteredSessionProviders() {
  return Array.from(providers.values());
}
