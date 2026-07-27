export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { dbReady } = await import("@/server/db");
  await dbReady;

  const { ensureSupervisorRuntimeStarted } = await import(
    "@/server/supervisor/runtime-watchdog"
  );
  ensureSupervisorRuntimeStarted().catch((error) => {
    console.error("Failed to start supervisor runtime at boot", error);
  });

  const { ensureClaudeModelGatewayStartedAtBoot, registerClaudeModelGatewayShutdownHandlers } = await import(
    "@/server/integrations/claude-model-gateway"
  );
  registerClaudeModelGatewayShutdownHandlers();
  ensureClaudeModelGatewayStartedAtBoot().catch((error) => {
    console.error("Failed to start Claude model gateway at boot", error);
  });
}
