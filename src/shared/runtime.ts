export type RuntimeSurface = "web" | "electron" | "vscode" | "capacitor" | "cli" | "test";

export type RuntimeStopReason =
  | "shutdown"
  | "test_complete"
  | "restart"
  | "surface_closed"
  | "error";

export type EventStreamId = `${string}:${number}`;

export type ParsedEventStreamId = {
  epoch: string;
  sequence: number;
};

const STREAM_EPOCH_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const STREAM_ID_PATTERN = /^([A-Za-z0-9_-]{1,128}):(0|[1-9]\d*)$/;

export function formatEventStreamId(epoch: string, sequence: number): EventStreamId {
  if (!STREAM_EPOCH_PATTERN.test(epoch)) {
    throw new TypeError("Event stream epoch must be a base64url-safe identifier.");
  }
  if (!Number.isSafeInteger(sequence) || sequence < 0) {
    throw new TypeError("Event stream sequence must be a non-negative safe integer.");
  }
  return `${epoch}:${sequence}`;
}

export function parseEventStreamId(value: string | null | undefined): ParsedEventStreamId | null {
  const match = value?.trim().match(STREAM_ID_PATTERN);
  if (!match) {
    return null;
  }
  const sequence = Number(match[2]);
  if (!Number.isSafeInteger(sequence) || sequence < 0) {
    return null;
  }
  return {
    epoch: match[1]!,
    sequence,
  };
}

export function compareEventStreamIds(left: string, right: string): -1 | 0 | 1 | null {
  const parsedLeft = parseEventStreamId(left);
  const parsedRight = parseEventStreamId(right);
  if (!parsedLeft || !parsedRight || parsedLeft.epoch !== parsedRight.epoch) {
    return null;
  }
  if (parsedLeft.sequence === parsedRight.sequence) {
    return 0;
  }
  return parsedLeft.sequence > parsedRight.sequence ? 1 : -1;
}
