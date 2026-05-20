import { readCodexCredentialsSync } from "@/server/supervisor/codex-auth";
import type { OmniHttpHandler } from "@/runtime/http/registry";

export const handleCodexAuthStatusRequest: OmniHttpHandler = () => {
  const creds = readCodexCredentialsSync();

  if (!creds) {
    return Response.json({ available: false });
  }

  return Response.json({
    available: true,
    email: creds.email,
    planType: creds.planType,
    expiresAt: creds.expiresAt,
    subscriptionActiveUntil: creds.subscriptionActiveUntil,
    lastRefresh: creds.lastRefresh,
  });
};
