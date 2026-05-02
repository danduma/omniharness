import { CONVERSATION_MODES, type ConversationMode } from "@/server/conversations/modes";

export interface OmniCliOptions {
  command: string;
  mode: ConversationMode;
  projectPath: string | null;
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

function normalizeMode(value: string): ConversationMode {
  if (CONVERSATION_MODES.includes(value as ConversationMode)) {
    return value as ConversationMode;
  }
  throw new OmniCliUsageError(`Unsupported mode "${value}". Use one of: ${CONVERSATION_MODES.join(", ")}.`);
}

function looksLikePlanPath(value: string) {
  return value.includes("/") || value.endsWith(".md") || value.endsWith(".txt");
}

export function parseOmniCliArgs(argv: string[]): OmniCliOptions {
  let mode: ConversationMode = "implementation";
  let projectPath: string | null = null;
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
      index += 1;
      continue;
    }
    if (arg === "--cwd" || arg === "--project") {
      projectPath = readOptionValue(argv, index, arg);
      index += 1;
      continue;
    }
    if (arg === "--worker" || arg === "--agent") {
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

  const command =
    commandFromFlag === null && positional.length === 1 && mode === "implementation" && looksLikePlanPath(rawCommand)
      ? `implement ${rawCommand}`
      : rawCommand;

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
    "Usage: pnpm exec tsx omni-cli.ts [options] <command>",
    "       pnpm exec tsx omni-cli.ts acp",
    "",
    "Options:",
    "  -m, --mode <mode>             implementation, planning, or direct",
    "      --cwd <path>              Project directory for spawned workers",
    "      --worker <type>           Preferred ACP worker type, e.g. codex, claude, gemini, opencode",
    "      --model <model>           Preferred worker model",
    "      --effort <effort>         Preferred worker reasoning effort",
    "      --allowed-worker <type>   Allowed worker type; repeatable",
    "      --command <text>          Command text; useful when text starts with a dash",
    "      --json                    Print the created conversation as JSON",
    "      --watch / --no-watch      Stream conversation updates after creation",
    "",
    "ACP harness mode:",
    "  acp                           Run OmniHarness itself as an ACP agent over stdio",
    "",
    "Legacy shorthand:",
    "  pnpm exec tsx omni-cli.ts docs/superpowers/plans/example.md",
  ].join("\n");
}
