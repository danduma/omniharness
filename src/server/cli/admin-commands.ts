import path from "node:path";
import { resolveRemoteRunnerToken } from "@/server/cli/credentials";

function readFlagValue(argv: string[], index: number, flag: string) {
  const value = argv[index + 1]?.trim();
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

export function parseRunnerAdminArgs(argv: string[]) {
  let runnerUrl: string | null = null;
  let tokenFile: string | null = null;
  let tokenStdin = false;
  let legacyToken: string | null = null;
  let confirmRunnerInstanceId: string | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--runner") {
      runnerUrl = readFlagValue(argv, index, arg);
      index += 1;
    } else if (arg === "--token-file") {
      tokenFile = path.resolve(readFlagValue(argv, index, arg));
      index += 1;
    } else if (arg === "--token-stdin") {
      tokenStdin = true;
    } else if (arg === "--token") {
      legacyToken = readFlagValue(argv, index, arg);
      index += 1;
    } else if (arg === "--confirm-identity") {
      confirmRunnerInstanceId = readFlagValue(argv, index, arg);
      index += 1;
    } else {
      throw new Error(`Unknown server administration option: ${arg}`);
    }
  }
  if (!runnerUrl) {
    throw new Error("omni runner rekey requires --runner <url>.");
  }
  return {
    runnerUrl,
    tokenFile,
    tokenStdin,
    legacyToken,
    confirmRunnerInstanceId,
  };
}

export async function runRunnerRekeyCommand(
  argv: string[],
  options: {
    env?: NodeJS.ProcessEnv;
    fetchImpl?: typeof fetch;
    readStdin?: () => Promise<string>;
  } = {},
) {
  const parsed = parseRunnerAdminArgs(argv);
  const credential = await resolveRemoteRunnerToken({
    env: options.env ?? process.env,
    tokenFile: parsed.tokenFile,
    tokenStdin: parsed.tokenStdin,
    legacyToken: parsed.legacyToken,
    readStdin: options.readStdin,
  });
  const url = new URL("/api/runner/rekey", parsed.runnerUrl);
  const response = await (options.fetchImpl ?? fetch)(url, {
    method: "POST",
    redirect: "manual",
    headers: {
      authorization: `Bearer ${credential.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      confirmRunnerInstanceId: parsed.confirmRunnerInstanceId,
    }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (body as { error?: { message?: string } } | null)?.error?.message;
    throw new Error(message || `Server rekey failed with HTTP ${response.status}.`);
  }
  return { body, warning: credential.warning };
}
