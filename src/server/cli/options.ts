import {
  REQUESTED_CONVERSATION_MODES,
  type RequestedConversationMode,
} from "@/server/conversations/modes";
import { looksLikePlanPath } from "@/lib/plan-path";

export interface OmniCliOptions {
  command: string;
  mode: RequestedConversationMode;
  projectPath: string;
  preferredWorkerType: string | null;
  preferredWorkerModel: string | null;
  preferredWorkerEffort: string | null;
  allowedWorkerTypes: string[];
  watch: boolean;
  json: boolean;
}

export class OmniCliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OmniCliUsageError";
  }
}

function readOptionValue(args: string[], index: number, flag: string) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new OmniCliUsageError(`${flag} requires a value.`);
  }
  return value;
}

function normalizeMode(value: string): RequestedConversationMode {
  if (REQUESTED_CONVERSATION_MODES.includes(value as RequestedConversationMode)) {
    return value as RequestedConversationMode;
  }
  throw new OmniCliUsageError(`Unsupported mode "${value}". Use one of: ${REQUESTED_CONVERSATION_MODES.join(", ")}.`);
}

export function parseOmniCliArgs(argv: string[]): OmniCliOptions {
  let mode: RequestedConversationMode = "direct";
  let modeWasSpecified = false;
  let projectPath: string = process.cwd();
  let preferredWorkerType: string | null = null;
  let preferredWorkerModel: string | null = null;
  let preferredWorkerEffort: string | null = null;
  const allowedWorkerTypes: string[] = [];
  let commandFromFlag: string | null = null;
  let watch = true;
  let json = false;
  const positional: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      throw new OmniCliUsageError("");
    }
    if (arg === "--mode" || arg === "-m") {
      mode = normalizeMode(readOptionValue(argv, index, arg));
      modeWasSpecified = true;
      index += 1;
      continue;
    }
    if (arg === "-o" || arg === "--omni") {
      mode = "omni";
      modeWasSpecified = true;
      continue;
    }
    if (arg === "-i") {
      mode = "implementation";
      modeWasSpecified = true;
      continue;
    }
    if (arg === "-p") {
      mode = "planning";
      modeWasSpecified = true;
      continue;
    }
    if (arg === "--cwd" || arg === "--project") {
      projectPath = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--worker" || arg === "--agent" || arg === "-w") {
      preferredWorkerType = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--model") {
      preferredWorkerModel = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--effort") {
      preferredWorkerEffort = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--allowed-worker") {
      allowedWorkerTypes.push(readOptionValue(argv, index, arg));
      index += 1;
      continue;
    }
    if (arg === "--command" || arg === "--prompt") {
      commandFromFlag = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--watch") {
      watch = true;
      continue;
    }
    if (arg === "--no-watch") {
      watch = false;
      continue;
    }
    if (arg === "--json") {
      json = true;
      continue;
    }
    if (arg.startsWith("--")) {
      throw new OmniCliUsageError(`Unknown option: ${arg}`);
    }
    positional.push(arg);
  }

  const rawCommand = commandFromFlag ?? positional.join(" ").trim();
  if (!rawCommand) {
    throw new OmniCliUsageError("Command cannot be empty.");
  }

  const shouldExpandPlanPath =
    commandFromFlag === null
    && positional.length === 1
    && looksLikePlanPath(rawCommand)
    && !rawCommand.toLowerCase().startsWith("implement ")
    && (mode === "implementation" || mode === "omni" || !modeWasSpecified);
  const command = shouldExpandPlanPath ? `implement ${rawCommand}` : rawCommand;
  if (shouldExpandPlanPath && !modeWasSpecified) {
    mode = "implementation";
  }

  return {
    command,
    mode,
    projectPath,
    preferredWorkerType,
    preferredWorkerModel,
    preferredWorkerEffort,
    allowedWorkerTypes,
    watch,
    json,
  };
}

export function omniCliUsage() {
  return [
    "Usage: omni [options] <command>",
    "       omni acp",
    "",
    "Options:",
    "  -o, --omni                    Omni: plan interactively when needed, then supervise implementation",
    "  -i                            Implementation mode (supervise an existing plan)",
    "  -p                            Planning mode (legacy: create a plan to promote later)",
    "      --cwd <path>              Project directory for spawned workers",
    "  -w, --worker, --agent <type>  Preferred worker type, e.g. codex, claude, gemini, opencode",
    "      --model <model>           Preferred worker model",
    "      --effort <effort>         Preferred worker reasoning effort",
    "      --allowed-worker <type>   Allowed worker type; repeatable",
    "      --command <text>          Command text; useful when text starts with a dash",
    "      --json                    Print the created conversation as JSON",
    "      --watch / --no-watch      Stream conversation updates after creation",
    "",
    "Direct mode is the default when no mode flag is supplied.",
    "",
    "ACP harness mode:",
    "  acp                           Run OmniHarness itself as an ACP agent over stdio",
    "",
    "Legacy shorthand:",
    "  omni docs/superpowers/plans/example.md",
  ].join("\n");
}
