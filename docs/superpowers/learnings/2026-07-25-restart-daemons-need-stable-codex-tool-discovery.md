# Restart Daemons Need Stable Codex Tool Discovery

**Date:** 2026-07-25
**Context:** OmniHarness development startup through the macOS restart controller and Cloudflare Tunnel
**Symptom:** The restart controller accepted a development start, but the agent runtime timed out after 90 seconds, the web ports never opened, and the saved public hostname returned Cloudflare 502.
**Root Cause:** The LaunchDaemon environment could not find the temporary Codex tool directory inherited by interactive shells. OmniHarness knew about the native binary in Codex.app but not the binary bundled with ChatGPT.app, so it could not create the required `apply_patch` and `applypatch` shims and rejected its own runtime as unready. Separately, `.env` still pointed at an old tunnel hostname rather than the hostname served by the installed connector.
**Fix:** Added the ChatGPT.app native Codex binary to stable application discovery, kept the strict tool readiness check, and updated `OMNIHARNESS_PUBLIC_ORIGIN` to the active tunnel hostname.
**Verification:** `pnpm exec vitest run tests/server/agent-runtime/tool-env.test.ts tests/server/dev/bridge-health.test.ts --reporter=dot` passed 8 tests. Starting development through `POST /restart?mode=dev` produced listeners on ports 7800, 3050, and 3035; the runtime doctor reported `tools.ok=true`; and the configured public origin returned HTTP 200.
**Prevention:** Background startup must discover required binaries from stable install locations rather than temporary interactive-shell paths. When diagnosing a tunnel 502, verify both the local listeners and that the saved public hostname matches the active connector configuration.
**Skill/Doc Updates:** No general skill update was needed because the debugging and completion skills already require tracing each component boundary and verifying the real public endpoint. This note records the OmniHarness-specific stable binary and hostname checks.
