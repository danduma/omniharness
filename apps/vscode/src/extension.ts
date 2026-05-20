import * as vscode from "vscode";
import { handleVSCodeBridgeMessage, type VSCodeBridgeRequest } from "../../../src/vscode-extension/bridge";
import { renderVSCodeWebviewHtml } from "./webviewHtml";

type RuntimeConfig = {
  serverUrl: string;
  sessionCookie: string | null;
};

function readRuntimeConfig(): RuntimeConfig {
  const config = vscode.workspace.getConfiguration("omniHarness");
  const serverUrl = (config.get<string>("serverUrl") || "http://localhost:3035").trim() || "http://localhost:3035";
  const cookieValue = (config.get<string>("sessionCookie") || "").trim();
  return {
    serverUrl,
    sessionCookie: cookieValue ? `omni_session=${cookieValue}` : null,
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

    const response = await handleVSCodeBridgeMessage(message, {
      ...readRuntimeConfig(),
      sseStreams: this.sseStreams,
      postMessage: (responseMessage) => {
        void this.view?.webview.postMessage(responseMessage);
      },
    });
    void this.view?.webview.postMessage(response);
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
    const config = readRuntimeConfig();
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview.js"),
    ).toString();

    return renderVSCodeWebviewHtml({
      scriptUri,
      cspSource: webview.cspSource,
      nonce,
      serverUrl: config.serverUrl,
      workspacePath: getWorkspacePath(),
    });
  }
}
export function activate(context: vscode.ExtensionContext) {
  const output = vscode.window.createOutputChannel("OmniHarness");
  const provider = new OmniHarnessPanelProvider(context, output);

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
    const config = readRuntimeConfig();
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
    }, config);
    if (!response.success) {
      vscode.window.showErrorMessage(response.error.message);
      return;
    }
    provider.postCommand("refresh");
    vscode.window.showInformationMessage("OmniHarness conversation started.");
  }));
}

export function deactivate() {}
