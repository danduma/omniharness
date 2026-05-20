# OmniHarness Desktop Shell

This Electron shell is intentionally thin. The main process starts the shared
Omni runtime in-process, loads the renderer URL, and exposes only gated native
commands through preload.

Development defaults to the runtime origin. Set `OMNI_ELECTRON_RENDERER_URL` to
an existing Omni web URL, usually `http://localhost:3035`, when running the
desktop shell against the Next renderer during local development.
