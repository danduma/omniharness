import { createHash } from "node:crypto";

export function calculateEventPayloadChecksum(payload: Record<string, unknown>): string {
  const { snapshotChecksum: _snapshotChecksum, ...checksumPayload } = payload;
  return `sha256:${createHash("sha256")
    .update(JSON.stringify(checksumPayload))
    .digest("base64url")}`;
}

export function withEventPayloadChecksum<T extends Record<string, unknown>>(payload: T): T & { snapshotChecksum: string } {
  return {
    ...payload,
    snapshotChecksum: calculateEventPayloadChecksum(payload),
  };
}
