import type { RuntimeAPIs } from "./types";
import { createWebRuntimeAPIs, type WebRuntimeApiOptions } from "./web";

export type ElectronNativeBridge = {
  openExternal(input: { url: string }): Promise<{ ok: true }>;
  chooseFolder?(): Promise<{ path: string | null }>;
  notify?(input: { title: string; body?: string }): Promise<{ ok: boolean }>;
};

declare global {
  interface Window {
    omniElectron?: ElectronNativeBridge;
  }
}

export interface ElectronRuntimeApiOptions extends WebRuntimeApiOptions {
  nativeBridge?: ElectronNativeBridge | null;
}

function resolveNativeBridge(bridge?: ElectronNativeBridge | null) {
  if (bridge !== undefined) {
    return bridge;
  }
  return typeof window !== "undefined" ? window.omniElectron ?? null : null;
}

export function createElectronRuntimeAPIs(options: ElectronRuntimeApiOptions = {}): RuntimeAPIs {
  const web = createWebRuntimeAPIs(options);
  const nativeBridge = resolveNativeBridge(options.nativeBridge);

  return {
    ...web,
    runtime: {
      surface: "electron",
      label: "Desktop",
      supportsNativeNotifications: Boolean(nativeBridge?.notify),
      supportsEditorActions: false,
    },
    native: nativeBridge
      ? {
          openExternal(input) {
            return nativeBridge.openExternal(input);
          },
          chooseFolder: nativeBridge.chooseFolder
            ? () => nativeBridge.chooseFolder!()
            : undefined,
          notify: nativeBridge.notify
            ? (input) => nativeBridge.notify!(input)
            : undefined,
        }
      : web.native,
  };
}
