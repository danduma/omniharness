# OmniHarness Desktop

The Electron app is a remote client. It never starts or imports a runner. The
main process loads the shared packaged interface, owns runner HTTP/SSE
connections, keeps bearer sessions in `safeStorage`, and exposes only validated
IPC operations to the renderer.

Build and run the unsigned local app:

```bash
pnpm electron:build
pnpm exec electron apps/electron
```

Create a host-native unsigned package under the operating system temporary
directory:

```bash
pnpm electron:package:local
```

Set `OMNIHARNESS_PACKAGE_OUT` to choose another output directory. Production
distribution still needs the normal code-signing/notarization process for each
target OS.

`OMNI_ELECTRON_RENDERER_URL` is a development-only escape hatch for loading an
existing interface origin. The default packaged renderer uses
`app://omniharness`, blocks renderer HTTP/SSE access, and permits runner
networking only in the main process.

On first launch after upgrading from the embedded-runtime desktop app, the
versioned preference export is imported transactionally. The former local
runtime becomes an explicit `http://127.0.0.1:3050` runner profile; it is not
started by Electron. Failed imports roll back and remain available for retry.
