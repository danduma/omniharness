import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type ManagedProcessIdentity = {
  pid: number;
  startedAt: number;
  executable: string;
  args: string[];
};

export function isProcessAlive(pid: number, kill: (pid: number, signal: 0) => void = process.kill) {
  try {
    kill(pid, 0);
    return true;
  } catch (error) {
    const code = error instanceof Error && "code" in error ? (error as NodeJS.ErrnoException).code : undefined;
    return code !== "ESRCH";
  }
}

function parseCommandLine(commandLine: string) {
  const result: string[] = [];
  let token = "";
  let quote: "'" | '"' | null = null;
  let tokenStarted = false;
  for (let index = 0; index < commandLine.length; index += 1) {
    const character = commandLine[index];
    if (quote) {
      if (character === quote) {
        quote = null;
      } else if (character === "\\" && commandLine[index + 1] === quote) {
        token += quote;
        index += 1;
      } else {
        token += character;
      }
      tokenStarted = true;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      tokenStarted = true;
    } else if (/\s/.test(character)) {
      if (tokenStarted) {
        result.push(token);
        token = "";
        tokenStarted = false;
      }
    } else {
      token += character;
      tokenStarted = true;
    }
  }
  if (tokenStarted) result.push(token);
  return result;
}

export function commandLineMatchesOwnedProcess(commandLine: string, identity: ManagedProcessIdentity) {
  const actual = parseCommandLine(commandLine);
  const expected = [identity.executable, ...identity.args];
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

export async function readProcessCommand(pid: number, platform = process.platform) {
  if (platform === "win32") {
    const script = `(Get-CimInstance Win32_Process -Filter \"ProcessId = ${pid}\").CommandLine`;
    const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      encoding: "utf8",
      timeout: 1_500,
      maxBuffer: 64 * 1024,
    });
    return stdout.trim();
  }
  const { stdout } = await execFileAsync("ps", ["-p", String(pid), "-o", "command="], {
    encoding: "utf8",
    timeout: 1_500,
    maxBuffer: 64 * 1024,
  });
  return stdout.trim();
}

export async function readProcessStartedAt(pid: number, platform = process.platform) {
  if (platform === "win32") {
    const script = `(Get-CimInstance Win32_Process -Filter \"ProcessId = ${pid}\").CreationDate.ToUniversalTime().ToString('o')`;
    const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
      encoding: "utf8",
      timeout: 1_500,
      maxBuffer: 64 * 1024,
    });
    const value = Date.parse(stdout.trim());
    if (!Number.isFinite(value)) throw new Error(`Could not read process ${pid} start time.`);
    return value;
  }
  const { stdout } = await execFileAsync("ps", ["-p", String(pid), "-o", "lstart="], {
    encoding: "utf8",
    timeout: 1_500,
    maxBuffer: 64 * 1024,
  });
  const value = Date.parse(stdout.trim());
  if (!Number.isFinite(value)) throw new Error(`Could not read process ${pid} start time.`);
  return value;
}

export function processStartMatchesOwnedProcess(actualStartedAt: number, identity: ManagedProcessIdentity) {
  return Number.isFinite(actualStartedAt)
    && Number.isFinite(identity.startedAt)
    && Math.abs(actualStartedAt - identity.startedAt) <= 1_000;
}

export async function verifyProcessIdentity(identity: ManagedProcessIdentity, options: {
  alive?: (pid: number) => boolean | Promise<boolean>;
  readCommand?: (pid: number) => Promise<string>;
  readStartedAt?: (pid: number) => Promise<number>;
} = {}) {
  const alive = await (options.alive ?? isProcessAlive)(identity.pid);
  if (!alive) return false;
  try {
    const [command, startedAt] = await Promise.all([
      (options.readCommand ?? readProcessCommand)(identity.pid),
      (options.readStartedAt ?? readProcessStartedAt)(identity.pid),
    ]);
    return commandLineMatchesOwnedProcess(command, identity)
      && processStartMatchesOwnedProcess(startedAt, identity);
  } catch {
    return false;
  }
}
