/**
 * Entrypoint executed in a child process by the real-restart harness.
 *
 * Boots the same in-process HTTP host that the in-process lifecycle
 * harness uses, but in a fresh Node process. Killing this process
 * truly:
 *   - resets the named-event ring buffer (it's module-level state),
 *   - drops any in-flight SSE connections (TCP RST),
 *   - clears all module-level caches,
 * which is exactly what a production restart does. The sqlite file
 * (under OMNIHARNESS_ROOT) persists across restarts, mirroring prod.
 *
 * It uses the same portable registry and Node streaming host as the runner.
 */
import { startOmniHttpServer } from "@/runtime/http/server";
import { createOmniRuntimeHttpRegistry } from "@/runtime/http/routes";

async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? 0);
  const server = await startOmniHttpServer({
    host: "127.0.0.1",
    port,
    surface: "test",
    registry: createOmniRuntimeHttpRegistry(),
  });
  // Stdout signal that the parent waits on.
  process.stdout.write(`SUBPROCESS_READY ${server.getPort()}\n`);

  const stop = () => {
    void server.stop().then(() => process.exit(0));
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}

void main().catch((error) => {
  console.error("[subprocess-runner] fatal:", error);
  process.exit(1);
});
