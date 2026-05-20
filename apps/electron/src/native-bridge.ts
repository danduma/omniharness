import { emitNamedEvent } from "../../../src/server/events/named-events";

export type ElectronNativeCommand =
  | "openExternal"
  | "chooseFolder"
  | "notify";

export interface ElectronNativeCommandRequest {
  command?: unknown;
  payload?: unknown;
}

export interface ElectronNativeBridgeDeps {
  runtimeOrigin: string;
  senderUrl: string;
  openExternal(input: { url: string }): Promise<{ ok: true }>;
  chooseFolder?(): Promise<{ path: string | null }>;
  notify?(input: { title: string; body?: string }): Promise<{ ok: boolean }>;
}

function senderOrigin(senderUrl: string) {
  try {
    return new URL(senderUrl).origin;
  } catch {
    return "";
  }
}

export function isAllowedElectronSender(senderUrl: string, runtimeOrigin: string) {
  return senderOrigin(senderUrl) === runtimeOrigin;
}

function refuse(reason: string): never {
  emitNamedEvent({ kind: "surface.bridge_failed", surface: "electron", reason });
  throw new Error(reason);
}

function readCommand(value: unknown): ElectronNativeCommand {
  if (value === "openExternal" || value === "chooseFolder" || value === "notify") {
    return value;
  }
  return refuse(`Unknown Electron native command: ${String(value)}.`);
}

function readExternalUrl(value: unknown) {
  const rawUrl = typeof value === "string" ? value.trim() : "";
  if (!rawUrl) {
    return refuse("URL is required for openExternal.");
  }
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return refuse("openExternal URL must be a valid absolute URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return refuse("openExternal only supports http and https URLs.");
  }
  return rawUrl;
}

export async function handleElectronNativeCommand(
  request: ElectronNativeCommandRequest,
  deps: ElectronNativeBridgeDeps,
) {
  if (!isAllowedElectronSender(deps.senderUrl, deps.runtimeOrigin)) {
    return refuse("Electron native command refused from an untrusted origin.");
  }

  const command = readCommand(request.command);
  const payload = request.payload && typeof request.payload === "object"
    ? request.payload as Record<string, unknown>
    : {};

  if (command === "openExternal") {
    const url = readExternalUrl(payload.url);
    return deps.openExternal({ url });
  }

  if (command === "chooseFolder") {
    if (!deps.chooseFolder) {
      return { path: null };
    }
    return deps.chooseFolder();
  }

  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  if (!title) {
    return refuse("Title is required for notify.");
  }
  if (!deps.notify) {
    return { ok: false };
  }
  const body = typeof payload.body === "string" ? payload.body : undefined;
  return deps.notify({ title, body });
}
