import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

function pathApiFor(platform) {
  return platform === "win32" ? path.win32 : path;
}

export function buildStartupCommands({ root = process.cwd(), platform = process.platform } = {}) {
  const pathApi = pathApiFor(platform);
  const scriptsDir = pathApi.join(root, "scripts");
  const agentInstaller = platform === "win32"
    ? {
      command: "powershell.exe",
      args: [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        pathApi.join(scriptsDir, "install-agent-acp.ps1"),
        "-EnsureOnly",
      ],
    }
    : {
      command: "/bin/bash",
      args: [pathApi.join(scriptsDir, "install-agent-acp.sh"), "--ensure-only"],
    };

  return [
    agentInstaller,
    {
      command: process.execPath,
      args: [pathApi.join(scriptsDir, "ensure-interface-build.mjs")],
    },
  ];
}

export function runStartupChecks({
  root = process.cwd(),
  platform = process.platform,
  env = process.env,
  run = (command, args, options) => spawnSync(command, args, options),
} = {}) {
  const commands = buildStartupCommands({ root, platform });
  const [agentSetup, interfaceBuild] = commands;
  const options = { cwd: root, env, stdio: "inherit" };

  if (env.OMNIHARNESS_AGENT_ACP_SETUP_COMPLETE !== "1") {
    const agentResult = run(agentSetup.command, agentSetup.args, options);
    if (agentResult.status !== 0) {
      return agentResult.status ?? 1;
    }
  }

  const interfaceResult = run(interfaceBuild.command, interfaceBuild.args, options);
  return interfaceResult.status ?? 1;
}

const entryPoint = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : null;
if (entryPoint === import.meta.url) {
  process.exitCode = runStartupChecks();
}
