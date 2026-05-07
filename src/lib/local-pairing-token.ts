import { AUTH_PAIR_TOKEN_TTL_MS } from "@/lib/auth-constants";

export type LocalPairingDraft = {
  pairingId: string;
  pairToken: string;
  pairUrl: string;
  expiresAt: string;
};

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function createPairSecret() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
}

function buildPairUrl(args: {
  origin: string;
  targetRunId?: string | null;
  pairToken: string;
}) {
  const targetPath = args.targetRunId ? `/session/${args.targetRunId}` : "/";
  return `${args.origin.replace(/\/+$/, "")}${targetPath}${targetPath.includes("?") ? "&" : "?"}pair=${encodeURIComponent(args.pairToken)}`;
}

export function createLocalPairingDraft(args: {
  origin: string;
  targetRunId?: string | null;
  nowMs?: number;
}): LocalPairingDraft {
  const pairingId = crypto.randomUUID();
  const pairToken = `${pairingId}.${createPairSecret()}`;

  return {
    pairingId,
    pairToken,
    pairUrl: buildPairUrl({
      origin: args.origin,
      targetRunId: args.targetRunId,
      pairToken,
    }),
    expiresAt: new Date((args.nowMs ?? Date.now()) + AUTH_PAIR_TOKEN_TTL_MS).toISOString(),
  };
}
