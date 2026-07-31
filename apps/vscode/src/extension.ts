import * as vscode from "vscode";
import { handleVSCodeBridgeMessage, type VSCodeBridgeRequest } from "../../../src/vscode-extension/bridge";
import { t } from "../../../src/lib/i18n";
import { renderVSCodeWebviewHtml } from "./webviewHtml";
import { VSCodeRunnerProfileStore } from "./runner-profiles";

type LegacyRuntimeConfig = {
  serverUrl: string;
  plainCredential: string;
};

function readLegacyRuntimeConfig(): LegacyRuntimeConfig {
  const config = vscode.workspace.getConfiguration("omniHarness");
  const serverUrl = (config.get<string>("serverUrl") || "http://localhost:3050").trim() || "http://localhost:3050";
  return {
    serverUrl,
    plainCredential: (config.get<string>("sessionCookie") || "").trim(),
  };
}

function getWorkspacePath() {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
}

class OmniHarnessPanelProvider implements vscode.WebviewViewProvider {
  static readonly viewType = "omniHarness.panel";
  private view: vscode.WebviewView | null = null;
  private readonly sseStreams = new Map<string, AbortController>();

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly output: vscode.OutputChannel,
    private readonly profiles: VSCodeRunnerProfileStore,
  ) {}

  resolveWebviewView(view: vscode.WebviewView) {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
    };
    view.webview.html = this.renderHtml(view.webview);

    view.webview.onDidReceiveMessage((message: VSCodeBridgeRequest) => {
      void this.handleMessage(message);
    }, undefined, this.context.subscriptions);

    view.onDidDispose(() => {
      if (this.view === view) {
        this.view = null;
      }
    });
  }

  postCommand(command: string, payload?: unknown) {
    void this.view?.webview.postMessage({ type: "command", command, payload });
  }

  private async handleMessage(message: VSCodeBridgeRequest) {
    if (!message || typeof message.id !== "string" || typeof message.type !== "string") {
      return;
    }

    if (message.type === "vscode:openFile") {
      await this.handleOpenFile(message);
      return;
    }
    if (message.type === "vscode:openDiff") {
      await this.handleOpenDiff(message);
      return;
    }
    if (message.type === "vscode:openExternal") {
      await this.handleOpenExternal(message);
      return;
    }
    if (message.type === "vscode:notify") {
      await this.handleNotification(message);
      return;
    }
    if (message.type === "vscode:profiles") {
      void this.view?.webview.postMessage({
        id: message.id,
        type: message.type,
        success: true,
        data: this.profiles.list(),
      });
      return;
    }
    if (message.type === "vscode:login") {
      await this.handleRunnerLogin(message);
      return;
    }
    if (message.type === "vscode:identity") {
      await this.handleRunnerIdentity(message);
      return;
    }

    const response = await handleVSCodeBridgeMessage(message, {
      resolveProfile: (profileId) => this.profiles.resolve(profileId),
      sseStreams: this.sseStreams,
      postMessage: (responseMessage) => {
        void this.view?.webview.postMessage(responseMessage);
      },
    });
    void this.view?.webview.postMessage(response);
  }

  private async handleRunnerIdentity(message: VSCodeBridgeRequest) {
    try {
      const payload = (message.payload ?? {}) as {
        profileId?: unknown;
        runnerInstanceId?: unknown;
        confirmChange?: unknown;
      };
      if (
        typeof payload.profileId !== "string"
        || typeof payload.runnerInstanceId !== "string"
      ) {
        throw new Error("Runner identity request is invalid.");
      }
      const profiles = await this.profiles.learnIdentity({
        profileId: payload.profileId,
        runnerInstanceId: payload.runnerInstanceId,
        confirmChange: payload.confirmChange === true,
      });
      void this.view?.webview.postMessage({
        id: message.id,
        type: message.type,
        success: true,
        data: profiles,
      });
    } catch (error) {
      void this.view?.webview.postMessage({
        id: message.id,
        type: message.type,
        success: false,
        error: {
          code: "vscode.runner_identity_failed",
          message: error instanceof Error ? error.message : String(error),
          surface: "vscode",
        },
      });
    }
  }

  private async handleRunnerLogin(message: VSCodeBridgeRequest) {
    try {
      const payload = (message.payload ?? {}) as {
        profileId?: unknown;
        label?: unknown;
        baseUrl?: unknown;
        password?: unknown;
      };
      if (typeof payload.baseUrl !== "string" || typeof payload.password !== "string") {
        throw new Error("Runner URL and password are required.");
      }
      const profile = await this.profiles.login({
        profileId: typeof payload.profileId === "string" ? payload.profileId : null,
        label: typeof payload.label === "string" ? payload.label : "",
        baseUrl: payload.baseUrl,
        password: payload.password,
      });
      void this.view?.webview.postMessage({
        id: message.id,
        type: message.type,
        success: true,
        data: {
          profile,
          profiles: this.profiles.list(),
        },
      });
    } catch (error) {
      void this.view?.webview.postMessage({
        id: message.id,
        type: message.type,
        success: false,
        error: {
          code: "vscode.runner_login_failed",
          message: error instanceof Error ? error.message : String(error),
          surface: "vscode",
        },
      });
    }
  }

  private async handleOpenFile(message: VSCodeBridgeRequest) {
    try {
      const payload = (message.payload ?? {}) as { path?: unknown; line?: unknown; column?: unknown };
      if (typeof payload.path !== "string" || !payload.path.trim()) {
        throw new Error("File path is required.");
      }
      const document = await vscode.workspace.openTextDocument(vscode.Uri.file(payload.path));
      const editor = await vscode.window.showTextDocument(document);
      const line = typeof payload.line === "number" && Number.isFinite(payload.line)
        ? Math.max(0, payload.line - 1)
        : 0;
      const column = typeof payload.column === "number" && Number.isFinite(payload.column)
        ? Math.max(0, payload.column - 1)
        : 0;
      const position = new vscode.Position(line, column);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenterIfOutsideViewport);
      void this.view?.webview.postMessage({ id: message.id, type: message.type, success: true, data: { ok: true } });
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      this.output.appendLine(`[openFile] ${text}`);
      void this.view?.webview.postMessage({
        id: message.id,
        type: message.type,
        success: false,
        error: {
          code: "vscode.open_file_failed",
          message: text,
          surface: "vscode",
        },
      });
    }
  }

  private async handleOpenExternal(message: VSCodeBridgeRequest) {
    try {
      const payload = (message.payload ?? {}) as { url?: unknown };
      if (typeof payload.url !== "string" || !payload.url.trim()) {
        throw new Error("URL is required.");
      }
      await vscode.env.openExternal(vscode.Uri.parse(payload.url));
      void this.view?.webview.postMessage({ id: message.id, type: message.type, success: true, data: { ok: true } });
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      void this.view?.webview.postMessage({
        id: message.id,
        type: message.type,
        success: false,
        error: {
          code: "vscode.open_external_failed",
          message: text,
          surface: "vscode",
        },
      });
    }
  }

  private async handleNotification(message: VSCodeBridgeRequest) {
    const payload = (message.payload ?? {}) as {
      title?: unknown;
      body?: unknown;
    };
    if (typeof payload.title !== "string" || !payload.title.trim()) {
      void this.view?.webview.postMessage({
        id: message.id,
        type: message.type,
        success: false,
        error: {
          code: "vscode.notification_invalid",
          message: t("runner.error.generic"),
          surface: "vscode",
        },
      });
      return;
    }
    const text = typeof payload.body === "string" && payload.body.trim()
      ? `${payload.title}: ${payload.body}`
      : payload.title;
    await vscode.window.showInformationMessage(text);
    void this.view?.webview.postMessage({
      id: message.id,
      type: message.type,
      success: true,
      data: { ok: true },
    });
  }

  private async handleOpenDiff(message: VSCodeBridgeRequest) {
    try {
      const payload = (message.payload ?? {}) as {
        originalPath?: unknown;
        modifiedPath?: unknown;
        title?: unknown;
      };
      if (typeof payload.originalPath !== "string" || !payload.originalPath.trim()) {
        throw new Error("Original file path is required.");
      }
      if (typeof payload.modifiedPath !== "string" || !payload.modifiedPath.trim()) {
        throw new Error("Modified file path is required.");
      }
      await vscode.commands.executeCommand(
        "vscode.diff",
        vscode.Uri.file(payload.originalPath),
        vscode.Uri.file(payload.modifiedPath),
        typeof payload.title === "string" && payload.title.trim() ? payload.title.trim() : "OmniHarness Diff",
      );
      void this.view?.webview.postMessage({ id: message.id, type: message.type, success: true, data: { ok: true } });
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      this.output.appendLine(`[openDiff] ${text}`);
      void this.view?.webview.postMessage({
        id: message.id,
        type: message.type,
        success: false,
        error: {
          code: "vscode.open_diff_failed",
          message: text,
          surface: "vscode",
        },
      });
    }
  }

  private renderHtml(webview: vscode.Webview) {
    const nonce = `${Date.now()}${Math.random().toString(16).slice(2)}`;
    const config = readLegacyRuntimeConfig();
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview.js"),
    ).toString();

    return renderVSCodeWebviewHtml({
      scriptUri,
      cspSource: webview.cspSource,
      nonce,
      serverUrl: config.serverUrl,
      workspacePath: getWorkspacePath(),
      profiles: this.profiles.list(),
    });
  }
}
export async function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel("OmniHarness");
  const legacyConfig = readLegacyRuntimeConfig();
  const profiles = new VSCodeRunnerProfileStore(
    context.globalState,
    context.secrets,
  );
  await profiles.initialize({
    defaultUrl: legacyConfig.serverUrl,
    legacyPlainCredential: legacyConfig.plainCredential,
    clearLegacyPlainCredential: () => vscode.workspace
      .getConfiguration("omniHarness")
      .update("sessionCookie", undefined, vscode.ConfigurationTarget.Global),
  });
  const provider = new OmniHarnessPanelProvider(context, output, profiles);

  context.subscriptions.push(output);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(OmniHarnessPanelProvider.viewType, provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );
  context.subscriptions.push(vscode.commands.registerCommand("omniHarness.openPanel", async () => {
    await vscode.commands.executeCommand("workbench.view.extension.omniHarness");
    await vscode.commands.executeCommand("omniHarness.panel.focus");
  }));
  context.subscriptions.push(vscode.commands.registerCommand("omniHarness.refresh", () => {
    provider.postCommand("refresh");
  }));
  context.subscriptions.push(vscode.commands.registerCommand("omniHarness.startConversation", async () => {
    const command = await vscode.window.showInputBox({
      prompt: "Ask OmniHarness to work on this workspace",
      ignoreFocusOut: true,
    });
    if (!command?.trim()) {
      return;
    }
    const active = await profiles.resolve(null);
    const response = await handleVSCodeBridgeMessage({
      id: "command-start",
      type: "api:proxy",
      payload: {
        method: "POST",
        path: "/api/conversations",
        headers: { "content-type": "application/json" },
        bodyText: JSON.stringify({
          mode: "implementation",
          command: command.trim(),
          projectPath: getWorkspacePath(),
        }),
      },
    }, active
      ? {
          serverUrl: active.serverUrl,
          bearerToken: active.bearerToken,
        }
      : {});
    if (!response.success) {
      vscode.window.showErrorMessage(response.error.message);
      return;
    }
    provider.postCommand("refresh");
    vscode.window.showInformationMessage("OmniHarness conversation started.");
  }));
}

export function deactivate() {}
