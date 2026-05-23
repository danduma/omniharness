import path from "node:path";
import { app, BrowserWindow, dialog, ipcMain, Notification, shell } from "electron";
import { startElectronOmniRuntime, resolveElectronRendererUrl } from "./src/runtime";
import { handleElectronNativeCommand } from "./src/native-bridge";

let mainWindow: BrowserWindow | null = null;
let runtimeHandle: Awaited<ReturnType<typeof startElectronOmniRuntime>> | null = null;

async function createWindow() {
  const rendererAssetsDir = path.join(__dirname, "renderer");
  runtimeHandle = await startElectronOmniRuntime({
    staticDir: rendererAssetsDir,
  });
  const rendererUrl = resolveElectronRendererUrl({
    runtimeOrigin: runtimeHandle.origin,
  });

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  await mainWindow.loadURL(rendererUrl);
}

function installNativeBridge() {
  ipcMain.handle("omni:native", async (event, request) => {
    if (!runtimeHandle) {
      throw new Error("OmniHarness runtime is not ready.");
    }
    return handleElectronNativeCommand(request, {
      runtimeOrigin: runtimeHandle.origin,
      senderUrl: event.senderFrame?.url ?? event.sender.getURL(),
      openExternal: async ({ url }) => {
        await shell.openExternal(url);
        return { ok: true };
      },
      chooseFolder: async () => {
        const options = {
          properties: ["openDirectory", "createDirectory"],
        } satisfies Electron.OpenDialogOptions;
        const result = mainWindow
          ? await dialog.showOpenDialog(mainWindow, options)
          : await dialog.showOpenDialog(options);
        return { path: result.canceled ? null : result.filePaths[0] ?? null };
      },
      notify: async ({ title, body }) => {
        if (!Notification.isSupported()) {
          return { ok: false };
        }
        new Notification({ title, body }).show();
        return { ok: true };
      },
    });
  });
}

app.whenReady().then(async () => {
  installNativeBridge();
  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
}).catch((error) => {
  dialog.showErrorBox("OmniHarness failed to start", error instanceof Error ? error.message : String(error));
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", (event) => {
  if (!runtimeHandle) {
    return;
  }
  event.preventDefault();
  const handle = runtimeHandle;
  runtimeHandle = null;
  void handle.stop().finally(() => app.exit(0));
});
