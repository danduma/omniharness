import fs from "node:fs/promises";

type TokenEnvironment = Record<string, string | undefined>;

function normalizeToken(value: string | null | undefined) {
  const token = value?.trim() ?? "";
  if (!token) {
    throw new Error("A remote runner token is required. Set OMNI_TOKEN, use --token-file, or use --token-stdin.");
  }
  return token;
}

async function readAllStdin() {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function resolveRemoteRunnerToken(input: {
  env: TokenEnvironment;
  tokenFile: string | null;
  tokenStdin: boolean;
  legacyToken: string | null;
  readStdin?: () => Promise<string>;
}) {
  const configuredSources = [
    Boolean(input.env.OMNI_TOKEN?.trim()),
    Boolean(input.tokenFile),
    input.tokenStdin,
    Boolean(input.legacyToken),
  ].filter(Boolean).length;
  if (configuredSources > 1) {
    throw new Error("Choose exactly one remote runner token source.");
  }

  if (input.legacyToken) {
    return {
      token: normalizeToken(input.legacyToken),
      warning: "Warning: --token exposes the token in the process list. Use OMNI_TOKEN, --token-file, or --token-stdin instead.",
    };
  }
  if (input.tokenFile) {
    const stat = await fs.stat(input.tokenFile);
    if ((stat.mode & 0o077) !== 0) {
      throw new Error("Token files must not be readable or writable by group or other users.");
    }
    return {
      token: normalizeToken(await fs.readFile(input.tokenFile, "utf8")),
      warning: null,
    };
  }
  if (input.tokenStdin) {
    return {
      token: normalizeToken(await (input.readStdin ?? readAllStdin)()),
      warning: null,
    };
  }
  return {
    token: normalizeToken(input.env.OMNI_TOKEN),
    warning: null,
  };
}
