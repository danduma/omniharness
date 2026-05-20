export type VSCodeWebviewHtmlOptions = {
  scriptUri: string;
  cspSource: string;
  nonce: string;
  serverUrl: string;
  workspacePath: string | null;
};

function safeJson(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function renderVSCodeWebviewHtml({
  scriptUri,
  cspSource,
  nonce,
  serverUrl,
  workspacePath,
}: VSCodeWebviewHtmlOptions) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https:; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <style>
    html, body, #root { min-height: 100%; }
    body {
      margin: 0;
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-sideBar-background);
    }
    button, textarea { font: inherit; }
    button {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      border: 0;
      padding: 7px 10px;
      cursor: pointer;
    }
    button.secondary {
      color: var(--vscode-button-secondaryForeground);
      background: var(--vscode-button-secondaryBackground);
    }
    button:disabled { opacity: .55; cursor: default; }
    textarea {
      width: 100%;
      min-height: 86px;
      box-sizing: border-box;
      resize: vertical;
      color: var(--vscode-input-foreground);
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      padding: 7px;
    }
    .omni-panel { padding: 14px; display: flex; flex-direction: column; gap: 12px; }
    .omni-row { display: flex; gap: 8px; align-items: center; }
    .omni-muted { color: var(--vscode-descriptionForeground); font-size: 12px; }
    .omni-error { color: var(--vscode-errorForeground); white-space: pre-wrap; }
    .omni-run { border: 1px solid var(--vscode-sideBarSectionHeader-border); padding: 8px; }
    .omni-run-title { font-weight: 600; }
  </style>
  <script nonce="${nonce}">
    window.__OMNI_VSCODE_BOOTSTRAP__ = ${safeJson({ serverUrl, workspacePath })};
  </script>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}
