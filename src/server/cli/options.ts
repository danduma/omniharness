import { CONVERSATION_MODES, type ConversationMode } from "@/server/conversations/modes";

export interface OmniCliOptions {
  command: string;
  mode: ConversationMode;
  projectPath: string;
  preferredWorkerType: string | null;
  preferredWorkerModel: string | null;
  preferredWorkerEffort: string | null;
  allowedWorkerTypes: string[];
  watch: boolean;
  json: boolean;
  runnerUrl: string | null;
  tokenFile: string | null;
  tokenStdin: boolean;
  legacyToken: string | null;
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

function normalizeMode(value: string): ConversationMode {
  if (CONVERSATION_MODES.includes(value as ConversationMode)) {
    return value as ConversationMode;
  }
  throw new OmniCliUsageError(`Unsupported mode "${value}". Use one of: ${CONVERSATION_MODES.join(", ")}.`);
}

export function parseOmniCliArgs(argv: string[]): OmniCliOptions {
  let mode: ConversationMode = "direct";
  let projectPath: string = process.cwd();
  let preferredWorkerType: string | null = null;
  let preferredWorkerModel: string | null = null;
  let preferredWorkerEffort: string | null = null;
  const allowedWorkerTypes: string[] = [];
  let commandFromFlag: string | null = null;
  let watch = true;
  let json = false;
  let runnerUrl: string | null = null;
  let tokenFile: string | null = null;
  let tokenStdin = false;
  let legacyToken: string | null = null;
  const positional: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      throw new OmniCliUsageError("");
    }
    if (arg === "--mode" || arg === "-m") {
      mode = normalizeMode(readOptionValue(argv, index, arg));
      index += 1;
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
    if (arg === "--runner") {
      runnerUrl = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--token-file") {
      tokenFile = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--token-stdin") {
      tokenStdin = true;
      continue;
    }
    if (arg === "--token") {
      legacyToken = readOptionValue(argv, index, arg);
      index += 1;
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
  if ([Boolean(tokenFile), tokenStdin, Boolean(legacyToken)].filter(Boolean).length > 1) {
    throw new OmniCliUsageError("Choose exactly one of --token-file, --token-stdin, or legacy --token.");
  }

  return {
    command: rawCommand,
    mode,
    projectPath,
    preferredWorkerType,
    preferredWorkerModel,
    preferredWorkerEffort,
    allowedWorkerTypes,
    watch,
    json,
    runnerUrl,
    tokenFile,
    tokenStdin,
    legacyToken,
  };
}

export function omniCliUsage() {
  return [
    "Usage: omni [options] <command>",
    "       omni acp",
    "       omni auth init [--password-file <0600-file>]",
    "       omni runner rekey --runner <url> [token source] --confirm-identity <id>",
    "",
    "Options:",
    "  -m, --mode <direct|commit>    Conversation mode (default: direct)",
    "      --cwd <path>              Project directory for spawned workers",
    "  -w, --worker, --agent <type>  Preferred worker type, e.g. codex, claude, gemini, opencode",
    "      --model <model>           Preferred worker model",
    "      --effort <effort>         Preferred worker reasoning effort",
    "      --allowed-worker <type>   Allowed worker type; repeatable",
    "      --command <text>          Command text; useful when text starts with a dash",
    "      --json                    Print the created conversation as JSON",
    "      --watch / --no-watch      Stream conversation updates after creation",
    "      --runner <url>             Use a running OmniHarness server",
    "      --token-file <path>        Read the remote token from a protected file",
    "      --token-stdin              Read the remote token from stdin",
    "                                  OMNI_TOKEN is used when no token flag is supplied",
    "",
    "ACP harness mode:",
    "  acp                           Run OmniHarness itself as an ACP agent over stdio",
  ].join("\n");
}
