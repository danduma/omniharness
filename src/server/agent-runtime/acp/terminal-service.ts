import { randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import * as acp from "@agentclientprotocol/sdk";

const DEFAULT_OUTPUT_BYTE_LIMIT = 50 * 1024;
const MAX_OUTPUT_BYTE_LIMIT = 50 * 1024;
const MAX_OUTPUT_LINES = 1_000;

type TerminalRecord = {
  sessionId: string;
  child: ChildProcessWithoutNullStreams;
  output: string;
  truncated: boolean;
  outputByteLimit: number;
  exitStatus: acp.TerminalExitStatus | null;
  exited: Promise<acp.TerminalExitStatus>;
};

function boundedOutput(existing: string, chunk: string, byteLimit: number) {
  const lines = (existing + chunk).split(/(?<=\n)/);
  let next = lines.length > MAX_OUTPUT_LINES ? lines.slice(-MAX_OUTPUT_LINES).join("") : lines.join("");
  let truncated = lines.length > MAX_OUTPUT_LINES;
  const bytes = Buffer.from(next, "utf8");
  if (bytes.length > byteLimit) {
    let start = bytes.length - byteLimit;
    while (start < bytes.length && (bytes[start]! & 0xc0) === 0x80) start += 1;
    next = bytes.subarray(start).toString("utf8");
    truncated = true;
  }
  return { output: next, truncated };
}

export class TerminalService {
  private readonly terminals = new Map<string, TerminalRecord>();

  constructor(
    private readonly onSnapshot?: (terminalId: string, snapshot: acp.TerminalOutputResponse) => void,
    private readonly onLifecycle?: (action: "created" | "released", terminalId: string) => void,
  ) {}

  get size() {
    return this.terminals.size;
  }

  private get(sessionId: string, terminalId: string) {
    const terminal = this.terminals.get(terminalId);
    if (!terminal || terminal.sessionId !== sessionId) {
      throw acp.RequestError.invalidParams({ terminalId }, "Unknown terminal");
    }
    return terminal;
  }

  async create(params: acp.CreateTerminalRequest): Promise<acp.CreateTerminalResponse> {
    const terminalId = randomUUID();
    const outputByteLimit = Math.max(1, Math.min(
      MAX_OUTPUT_BYTE_LIMIT,
      params.outputByteLimit ?? DEFAULT_OUTPUT_BYTE_LIMIT,
    ));
    const env = params.env?.reduce<NodeJS.ProcessEnv>((result, item) => {
      result[item.name] = item.value;
      return result;
    }, { ...process.env });
    const child = spawn(params.command, params.args ?? [], {
      cwd: params.cwd ?? undefined,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    }) as ChildProcessWithoutNullStreams;
    let resolveExit!: (status: acp.TerminalExitStatus) => void;
    const exited = new Promise<acp.TerminalExitStatus>((resolve) => {
      resolveExit = resolve;
    });
    const record: TerminalRecord = {
      sessionId: params.sessionId,
      child,
      output: "",
      truncated: false,
      outputByteLimit,
      exitStatus: null,
      exited,
    };
    const append = (chunk: Buffer) => {
      const bounded = boundedOutput(record.output, chunk.toString("utf8"), record.outputByteLimit);
      record.output = bounded.output;
      record.truncated ||= bounded.truncated;
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.once("close", (exitCode, signal) => {
      record.exitStatus = { exitCode, signal };
      resolveExit(record.exitStatus);
      this.onSnapshot?.(terminalId, { output: record.output, truncated: record.truncated, exitStatus: record.exitStatus });
    });
    child.once("error", () => {
      if (!record.exitStatus) {
        record.exitStatus = { exitCode: null, signal: null };
        resolveExit(record.exitStatus);
      }
    });
    this.terminals.set(terminalId, record);
    this.onLifecycle?.("created", terminalId);
    return { terminalId };
  }

  async output(params: acp.TerminalOutputRequest): Promise<acp.TerminalOutputResponse> {
    const terminal = this.get(params.sessionId, params.terminalId);
    const response = {
      output: terminal.output,
      truncated: terminal.truncated,
      ...(terminal.exitStatus ? { exitStatus: terminal.exitStatus } : {}),
    };
    this.onSnapshot?.(params.terminalId, response);
    return response;
  }

  async wait(params: acp.WaitForTerminalExitRequest): Promise<acp.WaitForTerminalExitResponse> {
    return this.get(params.sessionId, params.terminalId).exited;
  }

  async kill(params: acp.KillTerminalRequest): Promise<acp.KillTerminalResponse> {
    const terminal = this.get(params.sessionId, params.terminalId);
    if (!terminal.exitStatus) terminal.child.kill("SIGTERM");
    return {};
  }

  async release(params: acp.ReleaseTerminalRequest): Promise<acp.ReleaseTerminalResponse> {
    const terminal = this.get(params.sessionId, params.terminalId);
    if (!terminal.exitStatus) terminal.child.kill("SIGTERM");
    this.terminals.delete(params.terminalId);
    this.onLifecycle?.("released", params.terminalId);
    return {};
  }

  dispose() {
    for (const [terminalId, terminal] of this.terminals) {
      if (!terminal.exitStatus) terminal.child.kill("SIGTERM");
      this.onLifecycle?.("released", terminalId);
    }
    this.terminals.clear();
  }
}
