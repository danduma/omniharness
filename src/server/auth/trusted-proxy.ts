import { isIP } from "node:net";

export type RequestNetworkIdentity = {
  clientAddress: string;
  protocol: "http" | "https";
  forwarded: boolean;
  publicOrigin?: string;
};

type ResolveRequestNetworkIdentityArgs = {
  url: string;
  headers: Headers;
  socketAddress: string | null;
  socketEncrypted: boolean;
  trustedProxyRules?: readonly string[];
};

const requestNetworkIdentities = new WeakMap<Request, RequestNetworkIdentity>();

function normalizeAddress(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  if (trimmed.startsWith("::ffff:")) {
    return trimmed.slice("::ffff:".length);
  }
  return trimmed || "unknown";
}

function ipv4Number(address: string) {
  if (isIP(address) !== 4) {
    return null;
  }
  return address.split(".").reduce(
    (value, part) => ((value << 8) | Number(part)) >>> 0,
    0,
  );
}

function matchesRule(address: string, rule: string) {
  const normalizedRule = normalizeAddress(rule);
  if (!normalizedRule.includes("/")) {
    return address === normalizedRule;
  }
  const [network, rawPrefix] = normalizedRule.split("/", 2);
  const addressNumber = ipv4Number(address);
  const networkNumber = ipv4Number(network ?? "");
  const prefix = Number(rawPrefix);
  if (
    addressNumber === null
    || networkNumber === null
    || !Number.isInteger(prefix)
    || prefix < 0
    || prefix > 32
  ) {
    return false;
  }
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (addressNumber & mask) === (networkNumber & mask);
}

function firstForwardedValue(value: string | null, key: "for" | "proto") {
  const first = value?.split(",")[0] ?? "";
  const match = first.match(new RegExp(`(?:^|;)\\s*${key}=("[^"]+"|[^;\\s]+)`, "i"));
  return match?.[1]?.replace(/^"|"$/g, "") ?? null;
}

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

export function configuredTrustedProxyRules() {
  return (process.env.OMNIHARNESS_TRUSTED_PROXIES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function resolveRequestNetworkIdentity({
  url,
  headers,
  socketAddress,
  socketEncrypted,
  trustedProxyRules = configuredTrustedProxyRules(),
}: ResolveRequestNetworkIdentityArgs): RequestNetworkIdentity {
  const requestUrl = new URL(url);
  const peerAddress = normalizeAddress(socketAddress ?? requestUrl.hostname);
  const trusted = trustedProxyRules.some((rule) => matchesRule(peerAddress, rule));
  const forwarded = headers.get("forwarded");
  const forwardedAddress = firstForwardedValue(forwarded, "for")
    ?? firstHeaderValue(headers.get("x-forwarded-for"));
  const forwardedProtocol = firstForwardedValue(forwarded, "proto")
    ?? firstHeaderValue(headers.get("x-forwarded-proto"));
  const forwardedHost = firstHeaderValue(headers.get("x-forwarded-host"));
  const protocol = trusted && forwardedProtocol === "https"
    ? "https"
    : socketEncrypted
      ? "https"
      : "http";
  const host = trusted && forwardedHost
    ? forwardedHost
    : headers.get("host")?.trim() || requestUrl.host;

  return {
    clientAddress: trusted && forwardedAddress
      ? normalizeAddress(forwardedAddress.replace(/^\[|\]$/g, ""))
      : peerAddress,
    protocol,
    forwarded: trusted && Boolean(forwardedAddress || forwardedProtocol || forwardedHost),
    publicOrigin: `${protocol}://${host}`,
  };
}

export function associateRequestNetworkIdentity(
  request: Request,
  identity: RequestNetworkIdentity,
) {
  requestNetworkIdentities.set(request, identity);
}

export function getRequestNetworkIdentity(request: Request) {
  return requestNetworkIdentities.get(request) ?? resolveRequestNetworkIdentity({
    url: request.url,
    headers: request.headers,
    socketAddress: new URL(request.url).hostname,
    socketEncrypted: new URL(request.url).protocol === "https:",
  });
}

export function isLoopbackAddress(address: string) {
  const normalized = normalizeAddress(address);
  return normalized === "127.0.0.1"
    || normalized === "::1"
    || normalized === "localhost";
}

export function isSecureOrLoopbackRequest(identity: RequestNetworkIdentity) {
  return identity.protocol === "https" || isLoopbackAddress(identity.clientAddress);
}

export function hasBrowserProvenanceHeaders(request: Request) {
  if (request.headers.has("origin") || request.headers.has("referer")) {
    return true;
  }
  for (const key of request.headers.keys()) {
    if (key.toLowerCase().startsWith("sec-fetch-")) {
      return true;
    }
  }
  return false;
}
