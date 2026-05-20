import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("omniElectron", {
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
