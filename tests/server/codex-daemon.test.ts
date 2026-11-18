import { describe, expect, it } from "vitest";
import { restartCodexDaemon, type CodexDaemonProcess, type CodexDaemonSystem } from "@/server/codex-daemon";

const DAEMON = "/x/releases/0.162.1/bin/codex app-server --listen unix:// --managed-daemon";
const UPDATER = "/x/releases/0.162.1/bin/codex app-server daemon pid-update-loop";

function fakeSystem(processes: CodexDaemonProcess[], pids: Record<string, number>) {
  let live = [...processes];
  const signals: string[] = [];
  const system: CodexDaemonSystem = {
    readPidFile: (file) => pids[file.split("/").pop()!] ?? null,
    listProcesses: async () => live,
    signal: (pid, signal) => {
      signals.push(`${pid}:${signal}`);
      live = live.filter((entry) => entry.pid !== pid);
    },
    sleep: async () => {},
  };
  return { system, signals };
}

const env = { HOME: "/home/u" };

describe("restartCodexDaemon", () => {
  it("stops the updater before the idle daemon", async () => {
    const { system, signals } = fakeSystem([
      { pid: 10, ppid: 1, command: UPDATER },
      { pid: 20, ppid: 10, command: DAEMON },
      { pid: 30, ppid: 20, command: "/x/bin/codex-code-mode-host" },
    ], { "daemon.pid": 20, "daemon-updater.pid": 10 });

    expect(await restartCodexDaemon({ env, system })).toEqual({ status: "stopped", pids: [10, 20], forced: [] });
    expect(signals).toEqual(["10:SIGTERM", "20:SIGTERM"]);
  });

  it("leaves a daemon that is running commands alone", async () => {
    const { system, signals } = fakeSystem([
      { pid: 20, ppid: 1, command: DAEMON },
      { pid: 31, ppid: 20, command: "/bin/zsh -c git status" },
    ], { "daemon.pid": 20 });

    expect(await restartCodexDaemon({ env, system })).toEqual({ status: "busy", daemonPid: 20, activeChildren: [31] });
    expect(signals).toEqual([]);
  });

  it("ignores pid files that point at unrelated processes", async () => {
    const { system, signals } = fakeSystem([{ pid: 20, ppid: 1, command: "/usr/bin/vim" }], { "daemon.pid": 20 });

    expect(await restartCodexDaemon({ env, system })).toEqual({ status: "not_running" });
    expect(signals).toEqual([]);
  });
});
