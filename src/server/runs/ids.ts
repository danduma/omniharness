import { randomUUID } from "crypto";

export const SHORT_RUN_ID_LENGTH = 12;
export const RUN_ID_PATTERN = /^[0-9a-fA-F]{12}$|^[0-9a-fA-F-]{36}$/;

export function createShortUuid() {
  return randomUUID().replace(/-/g, "").slice(0, SHORT_RUN_ID_LENGTH);
}

export function createRunId() {
  return createShortUuid();
}
