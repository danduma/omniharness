# Windows pnpm Launch and Install Failures

**Date:** 2026-06-21
**Context:** OmniHarness Windows installation and startup
**Symptom:** A fresh Windows install failed during dependency installation with `'cp' is not recognized`, later required pnpm build approval for `node-pty`, and `pnpm start` could fail when Node tried to spawn `pnpm` or `pnpm.cmd` from the TypeScript start scripts.
**Root Cause:** The pinned `@danduma/i18n` commit used a Unix-only `cp` command in its package build script, pnpm 11 requires explicit build approval for native dependencies, and Windows command shims are batch files that are not reliable direct targets for Node `spawn`/`execFile`.
**Fix:** Pin `@danduma/i18n` to a commit whose build uses only `tsc`, keep `node-pty` approved in `pnpm-workspace.yaml`, and route package-manager subprocesses through `cmd.exe /d /s /c pnpm ...` on Windows.
**Verification:** Ran `pnpm test tests/scripts/package-manager-command.test.ts`, `pnpm install --lockfile-only`, and `pnpm build`. The focused test covered Windows and non-Windows command resolution, the lockfile was already up to date, and the production build exited successfully with pre-existing warnings.
**Prevention:** When diagnosing Windows process launch bugs from Node, test both the bare command and the `.cmd` shim assumption. If a command is resolved through a Windows shell shim, model that shell boundary in a small helper and cover it with a platform-specific unit test.
**Skill/Doc Updates:** Updated `README.md` with Windows setup and troubleshooting instructions. No general skill update was needed because the reusable project-specific rule is captured here and in the launcher helper test.
