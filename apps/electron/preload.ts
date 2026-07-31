import { contextBridge, ipcRenderer } from "electron";
import type {
  ElectronBridgeRequest,
  ElectronBridgeResponse,
} from "../../src/runtime-api/electron";

contextBridge.exposeInMainWorld("omniElectron", {
  invokeRuntime(request: ElectronBridgeRequest) {
    return ipcRenderer.invoke("omni:runtime", request);
  },
  addRuntimeListener(listener: (message: ElectronBridgeResponse) => void) {
    const wrapped = (_event: Electron.IpcRendererEvent, message: ElectronBridgeResponse) => {
      listener(message);
    };
    ipcRenderer.on("omni:runtime:frame", wrapped);
    return () => ipcRenderer.off("omni:runtime:frame", wrapped);
  },
  profileGet() {
    return ipcRenderer.sendSync("omni:profile", { command: "get" });
  },
  profileSet(value: string) {
    ipcRenderer.sendSync("omni:profile", { command: "set", value });
  },
  profileRemove() {
    ipcRenderer.sendSync("omni:profile", { command: "remove" });
  },
  credential(command: string, payload: unknown) {
    return ipcRenderer.invoke("omni:credential", { command, payload });
  },
  tls(command: string, payload: unknown) {
    return ipcRenderer.invoke("omni:tls", { command, payload });
  },
  openExternal(input: { url: string }) {
    return ipcRenderer.invoke("omni:native", {
      command: "openExternal",
      payload: input,
    });
  },
  chooseFolder() {
    return ipcRenderer.invoke("omni:native", {
      command: "chooseFolder",
    });
  },
  notify(input: { title: string; body?: string }) {
    return ipcRenderer.invoke("omni:native", {
      command: "notify",
      payload: input,
    });
  },
});
