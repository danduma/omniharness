import path from "path";

const SECRET_PATTERNS: RegExp[] = [
  /(authorization\s*:\s*(?:bearer|basic)\s+)[^\s]+/gi,
  /\b([A-Z][A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|COOKIE|CREDENTIALS?)\s*=\s*)[^\s]+/gi,
  /\b(DATABASE_URL|REDIS_URL|MONGODB_URI|AMQP_URL)\s*=\s*[^\s]+/gi,
  /\b((?:cookie|set-cookie|x-api-key|api-key)\s*:\s*)[^\r\n]+/gi,
  /\b(sk-(?:proj|ant|live|test|or)-[A-Za-z0-9_-]{8,})\b/g,
  /\b(gh[opusr]_[A-Za-z0-9]{20,})\b/g,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
];

const MACHINE_PATH_PATTERNS: RegExp[] = [
  /(?:\/Users|\/home|\/root|\/private\/var|\/var\/folders)\/[A-Za-z0-9._@+~-]+(?:\/[A-Za-z0-9._@+~ -]+)+/g,
  /\b[A-Za-z]:\\Users\\[^\s"'`]+/g,
];

export function redactHandoffText(value: string | null | undefined, maxCharacters = 4_000): string {
  let result = String(value ?? "").normalize("NFC").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, (_match, prefix?: string) => `${prefix ?? ""}[REDACTED]`);
  }
  for (const pattern of MACHINE_PATH_PATTERNS) result = result.replace(pattern, "[REDACTED_PATH]");
  return result.slice(0, Math.max(0, maxCharacters));
}

export function sanitizeProjectRelativePath(value: string | null | undefined): string | null {
  const candidate = String(value ?? "").trim().replaceAll("\\", "/");
  if (!candidate || path.posix.isAbsolute(candidate) || /^[A-Za-z]:\//.test(candidate)) return null;
  const normalized = path.posix.normalize(candidate.replace(/^\.\//, ""));
  if (!normalized || normalized === "." || normalized === ".." || normalized.startsWith("../")) return null;
  return normalized;
}

export function redactHandoffList(values: readonly string[] | null | undefined, maxItems = 40, maxCharacters = 1_000): string[] {
  return [...new Set((values ?? []).map((value) => redactHandoffText(value, maxCharacters)).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right))
    .slice(0, maxItems);
}
