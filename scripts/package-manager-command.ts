import process from "node:process";

export function resolvePnpmCommand(platform: NodeJS.Platform = process.platform) {
  return platform === "win32" ? "cmd.exe" : "pnpm";
}

export function resolvePnpmArgs(args: readonly string[], platform: NodeJS.Platform = process.platform) {
  return platform === "win32" ? ["/d", "/s", "/c", "pnpm", ...args] : [...args];
}
