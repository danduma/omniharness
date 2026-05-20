# OmniHarness VS Code Extension

This proof extension connects to a running OmniHarness runtime and opens an
activity-bar webview for conversation control.

## Build

```sh
pnpm run vscode:build
```

## Run Locally

1. Start OmniHarness normally, usually at `http://localhost:3035`.
2. Build the extension.
3. Open `apps/vscode` in VS Code.
4. Run the extension host from VS Code's extension development workflow.
5. Configure `omniHarness.serverUrl` if the runtime is not on the default URL.

The extension can list current conversations, start a new implementation
conversation for the active workspace folder, proxy runtime HTTP requests, proxy
SSE frames for shared renderer adapters, and open files/diffs through VS Code.
