# OmniHarness VS Code Extension

The extension is a remote client for one or more running OmniHarness runners.
The extension host owns HTTP/SSE connections and injects bearer sessions from
VS Code `SecretStorage`; the webview receives profile metadata and normalized
events, never tokens.

## Build and package

```sh
pnpm vscode:build
pnpm vscode:package
```

The `.vsix` is written under the operating system temporary directory unless
`OMNIHARNESS_PACKAGE_OUT` is set.

## Run locally

1. Start at least one runner, usually at `http://localhost:3050`.
2. Build the extension.
3. Open `apps/vscode` in VS Code.
4. Run the extension host from VS Code's extension development workflow.
5. Add runner URLs and use the shared runner password from the activity-bar
   view.

Profiles persist in extension `globalState`; sessions persist only in
`SecretStorage`. Upgrading migrates the old plain `omniHarness.sessionCookie`
setting into the secret store, clears the setting, and requires a fresh login
because a cookie is not accepted as a bearer token.

The extension keeps one event stream per authenticated profile while its host
is active. Reloading VS Code restores profiles/cursors and reconnects. OS and
editor notifications are best effort while the extension host is alive.
