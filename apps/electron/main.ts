import fs from "node:fs";
import path from "node:path";
import { createHash, X509Certificate } from "node:crypto";
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Notification,
  protocol,
  safeStorage,
  session,
  shell,
} from "electron";
import {
  ELECTRON_APP_ORIGIN,
  electronPackagedCsp,
  resolveElectronAssetPath,
  resolveElectronInterfaceDir,
  resolveElectronRendererUrl,
} from "./src/runtime";
import { handleElectronNativeCommand } from "./src/native-bridge";
import { ElectronCredentialStore } from "./src/credential-store";
import { ElectronProfileDocumentStore } from "./src/profile-store";
import { ElectronTlsPinStore } from "./src/tls-pin-store";
import { importLegacyPreferenceExport } from "./src/legacy-preferences-migration";
import {
  ElectronRuntimeHost,
  type ElectronRuntimeBridgeRequest,
} from "./src/runtime-bridge";

protocol.registerSchemesAsPrivileged([{
  scheme: "app",
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    corsEnabled: false,
  },
}]);

let mainWindow: BrowserWindow | null = null;
let runtimeHost: ElectronRuntimeHost | null = null;
let profileStore: ElectronProfileDocumentStore | null = null;
let credentialStore: ElectronCredentialStore | null = null;
let tlsPinStore: ElectronTlsPinStore | null = null;
const pendingTlsFailures = new Map<string, {
  origin: string;
  fingerprint: string;
}>();
const runnerNetworkSessions = new Map<string, Electron.Session>();

function mimeType(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  return ({
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".woff2": "font/woff2",
    ".webmanifest": "application/manifest+json",
  } as Record<string, string>)[extension] ?? "application/octet-stream";
}

async function installPackagedProtocol() {
  const interfaceDir = resolveElectronInterfaceDir(
    __dirname,
    app.isPackaged ? process.resourcesPath : undefined,
  );
  const csp = electronPackagedCsp(interfaceDir);
  await protocol.handle("app", (request) => {
    try {
      const assetPath = resolveElectronAssetPath(interfaceDir, request.url);
      const body = fs.readFileSync(assetPath);
      return new Response(body, {
        headers: {
          "content-type": mimeType(assetPath),
          "content-security-policy": csp,
          "cross-origin-resource-policy": "same-origin",
          "x-content-type-options": "nosniff",
        },
      });
    } catch {
      return new Response("Not found", { status: 404 });
    }
  });
}

function isTrustedSender(senderUrl: string) {
  const configured = process.env.OMNI_ELECTRON_RENDERER_URL?.trim();
  if (configured && senderUrl.startsWith(new URL(configured).origin)) return true;
  return senderUrl.startsWith(`${ELECTRON_APP_ORIGIN}/`);
}

async function installHostStores() {
  const userDataPath = app.getPath("userData");
  profileStore = new ElectronProfileDocumentStore(
    path.join(userDataPath, "runner-profiles.v1.json"),
  );
  credentialStore = new ElectronCredentialStore(
    path.join(userDataPath, "runner-credentials.v1.json"),
    safeStorage,
  );
  tlsPinStore = new ElectronTlsPinStore(
    path.join(userDataPath, "runner-tls-pins.v1.json"),
  );
  await importLegacyPreferenceExport({
    userDataPath,
    readCurrentProfiles: () => profileStore?.get() ?? null,
    writeProfiles: (value) => profileStore?.set(value),
    removeProfiles: () => profileStore?.remove(),
  });
  runtimeHost = new ElectronRuntimeHost({
    credentials: credentialStore,
    fetchForTarget: (target, input, init) =>
      networkSessionForTarget(target).fetch(input, init),
    postFrame: (message) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("omni:runtime:frame", message);
      }
    },
    getTlsFailure: (target) => {
      const failure = pendingTlsFailures.get(target.profileId);
      return failure?.origin === target.baseUrl
        ? failure
        : null;
    },
  });
}

function networkSessionForTarget(target: {
  profileId: string;
  baseUrl: string;
}) {
  const scope = createHash("sha256")
    .update(`${target.profileId}\0${target.baseUrl}`)
    .digest("hex")
    .slice(0, 32);
  const existing = runnerNetworkSessions.get(scope);
  if (existing) return existing;
  const networkSession = session.fromPartition(`persist:omni-runner-${scope}`);
  networkSession.setCertificateVerifyProc((request, callback) => {
    if (request.verificationResult === "net::OK") {
      callback(0);
      return;
    }
    try {
      const certificate = new X509Certificate(request.certificate.data);
      const spki = certificate.publicKey.export({ type: "spki", format: "der" });
      const fingerprint = `sha256/${createHash("sha256").update(spki).digest("base64")}`;
      const pin = tlsPinStore?.get(target.profileId);
      const accepted = pin?.origin === target.baseUrl
        && pin.spkiSha256 === fingerprint
        && new URL(target.baseUrl).hostname === request.hostname;
      if (!accepted) {
        pendingTlsFailures.set(target.profileId, {
          origin: target.baseUrl,
          fingerprint,
        });
      }
      callback(accepted ? 0 : -2);
    } catch {
      callback(-2);
    }
  });
  runnerNetworkSessions.set(scope, networkSession);
  return networkSession;
}

function installIpc() {
  ipcMain.on("omni:profile", (event, request) => {
    try {
      if (!isTrustedSender(event.senderFrame?.url ?? event.sender.getURL())) {
        throw new Error("Electron profile request refused from an untrusted origin.");
      }
      if (request?.command === "get") event.returnValue = profileStore?.get() ?? null;
      else if (request?.command === "set" && typeof request.value === "string") {
        profileStore?.set(request.value);
        event.returnValue = true;
      } else if (request?.command === "remove") {
        profileStore?.remove();
        event.returnValue = true;
      } else {
        throw new Error("Invalid Electron profile command.");
      }
    } catch (error) {
      event.returnValue = {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  ipcMain.handle("omni:credential", (event, request) => {
    if (!isTrustedSender(event.senderFrame?.url ?? event.sender.getURL())) {
      throw new Error("Electron credential request refused from an untrusted origin.");
    }
    const payload = request?.payload && typeof request.payload === "object"
      ? request.payload
      : {};
    if (request?.command === "metadata") {
      return credentialStore?.metadata(payload.handle);
    }
    if (request?.command === "rebind") {
      credentialStore?.rebind(payload.handle, payload.binding);
      return { ok: true };
    }
    if (request?.command === "clear") {
      credentialStore?.clear(payload.handle);
      return { ok: true };
    }
    if (request?.command === "clearForProfile") {
      credentialStore?.clearForProfile(payload.profileId);
      return { ok: true };
    }
    if (request?.command === "recoveryNotice") {
      return { code: credentialStore?.getRecoveryNoticeCode() ?? null };
    }
    throw new Error("Invalid Electron credential command.");
  });

  ipcMain.handle("omni:tls", (event, request) => {
    if (!isTrustedSender(event.senderFrame?.url ?? event.sender.getURL())) {
      throw new Error("Electron TLS request refused from an untrusted origin.");
    }
    const payload = request?.payload;
    if (
      request?.command !== "confirm"
      || !payload
      || typeof payload.profileId !== "string"
      || typeof payload.origin !== "string"
      || typeof payload.fingerprint !== "string"
    ) {
      throw new Error("Invalid Electron TLS command.");
    }
    const pending = pendingTlsFailures.get(payload.profileId);
    if (
      !pending
      || pending.origin !== payload.origin
      || pending.fingerprint !== payload.fingerprint
    ) {
      throw new Error("TLS fingerprint is no longer pending confirmation.");
    }
    tlsPinStore?.confirm(payload.profileId, payload.origin, payload.fingerprint);
    pendingTlsFailures.delete(payload.profileId);
    return { ok: true };
  });

  ipcMain.handle(
    "omni:runtime",
    async (event, request: ElectronRuntimeBridgeRequest) => {
      if (!isTrustedSender(event.senderFrame?.url ?? event.sender.getURL())) {
        throw new Error("Electron runtime request refused from an untrusted origin.");
      }
      if (!runtimeHost) throw new Error("Electron runtime host is unavailable.");
      return runtimeHost.handle(request);
    },
  );

  ipcMain.handle("omni:native", async (event, request) => {
    const senderUrl = event.senderFrame?.url ?? event.sender.getURL();
    return handleElectronNativeCommand(request, {
      runtimeOrigin: new URL(senderUrl).origin,
      senderUrl,
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
        if (!Notification.isSupported()) return { ok: false };
        new Notification({ title, body }).show();
        return { ok: true };
      },
    });
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedSender(url)) event.preventDefault();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  await mainWindow.loadURL(resolveElectronRendererUrl());
}

app.whenReady().then(async () => {
  await installHostStores();
  installIpc();
  await installPackagedProtocol();
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const rendererRequest = details.webContentsId === mainWindow?.webContents.id;
    const remoteNetwork = details.url.startsWith("http://") || details.url.startsWith("https://");
    callback({ cancel: Boolean(rendererRequest && remoteNetwork) });
  });
  await createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
}).catch((error) => {
  dialog.showErrorBox(
    "OmniHarness failed to start",
    error instanceof Error ? error.message : String(error),
  );
  app.quit();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  runtimeHost?.close();
  runnerNetworkSessions.clear();
});
