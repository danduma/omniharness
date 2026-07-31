import fs from "node:fs";
import { startOmniHttpServer } from "@/runtime/http/server";
import { createOmniRuntimeHttpRegistry } from "@/runtime/http/routes";
import fixture from "./fixtures/routes.v1.json";
import { discoverRuntimeRouteContract } from "./route-contract-fixture";

function createFixtureValidatedRegistry() {
  const registry = createOmniRuntimeHttpRegistry();
  const actual = discoverRuntimeRouteContract(registry);
  const expected = [...fixture.routes].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error("The runner route registry no longer matches routes.v1.json.");
  }
  return registry;
}

async function main() {
  const mode = process.env.OMNI_PARITY_ADAPTER;
  if (mode !== "fixture" && mode !== "standalone") {
    throw new Error("OMNI_PARITY_ADAPTER must be fixture or standalone.");
  }
  fs.mkdirSync(process.env.OMNIHARNESS_ROOT!, { recursive: true });
  const registry = mode === "fixture"
    ? createFixtureValidatedRegistry()
    : createOmniRuntimeHttpRegistry();
  const server = await startOmniHttpServer({
    host: "127.0.0.1",
    port: 0,
    surface: "web",
    registry,
  });
  process.stdout.write(`PARITY_READY ${server.getPort()}\n`);
  const stop = () => {
    void server.stop().then(() => process.exit(0));
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exit(1);
});
