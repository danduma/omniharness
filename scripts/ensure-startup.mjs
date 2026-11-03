import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

function pathApiFor(platform) {
  return platform === "win32" ? path.win32 : path;
}

export function buildStartupCommands({ root = process.cwd(), platform = process.platform } = {}) {
  const pathApi = pathApiFor(platform);
  const scriptsDir = pathApi.join(root, "scripts");
  return [
    {
      command: process.execPath,
      args: [pathApi.join(scriptsDir, "ensure-interface-build.mjs"), "--prefer-existing"],
    },
  ];
}

export function runStartupChecks({
  root = process.cwd(),
  platform = process.platform,
  env = process.env,
  run = (command, args, options) => spawnSync(command, args, options),
} = {}) {
  // Startup must never depend on an agent registry, download, or update.
  // The runner checks for adapter updates in the background after listening.
  const [interfaceBuild] = buildStartupCommands({ root, platform });
  const options = { cwd: root, env, stdio: "inherit" };

  const interfaceResult = run(interfaceBuild.command, interfaceBuild.args, options);
  return interfaceResult.status ?? 1;
}

const entryPoint = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (entryPoint === import.meta.url) {
  process.exitCode = runStartupChecks();
}
