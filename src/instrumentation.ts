export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { ensureSupervisorRuntimeStarted } = await import(
    "@/server/supervisor/runtime-watchdog"
  );
  ensureSupervisorRuntimeStarted().catch((error) => {
    console.error("Failed to start supervisor runtime at boot", error);
  });
}
