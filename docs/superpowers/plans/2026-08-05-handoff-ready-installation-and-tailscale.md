# Handoff-Ready Installation And Tailscale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a fresh OmniHarness checkout install and start its API plus production interface through one command on macOS, with Tailscale Serve as the primary private-access path.

**Architecture:** Keep the production interface and API on the existing runner port and keep ACP on loopback. Add focused Node helpers for build freshness and Tailscale setup, harden the existing shell launcher, and verify that real entry point in macOS CI.

**Tech Stack:** Bash, Node.js ESM, pnpm, Vite, Vitest, GitHub Actions, Tailscale CLI.

**North Star Product:** A trustworthy self-hosted agent control plane that a user can install, privately connect to, update, and recover without understanding its internal process topology.

**Current Milestone:** Complete the repository installation and private Tailscale onboarding path on macOS.

**Future Product Direction:** Signed OS packages, managed background services, and offline multi-architecture bundles can build on this contract but are not claimed here.

**Final Functionality Standard:** The real macOS launcher installs and starts the real API-plus-interface deployment, the real Tailscale CLI configures private Serve access, and macOS CI proves the entry point from a fresh checkout.

---

## File Map

Create:

- `scripts/interface-build-state.mjs` — cross-platform content fingerprint and production-interface build marker.
- `scripts/setup-tailscale.mjs` — explicit private Tailscale Serve setup and `.env` persistence.
- `tests/scripts/interface-build-state.test.ts` — build-state behavior.
- `tests/scripts/setup-tailscale.test.ts` — real child-process/status parsing and `.env` behavior with isolated command fixtures.
- `.github/workflows/install-smoke.yml` — fresh-checkout macOS launcher, health, and HTML check.

Modify:

- `omniharness` — use the shared build check and Tailscale-first guidance.
- `package.json` — expose `setup:tailscale`.
- `src/server/runner/config.ts` — expose stable runner help text/argument handling.
- `scripts/runner.ts` — print help and exit successfully.
- `tests/server/runner/config.test.ts` — runner help/option contract.
- `tests/scripts/omniharness-launcher.test.ts` — Vite build and Tailscale guidance contracts.
- `README.md` — real clone URL, one-command platform setup, actual ACP packaging, API/UI topology, Tailscale first, Cloudflare second.
- `.env.example` — neutral Tailscale/private-origin examples.
- `docs/deployment/runner-operations.md` — Tailscale Serve deployment and loopback rules.
- `docs/security/authentication-and-tls.md` — tailnet trust boundary and password requirement.

Existing large files are not expanded with implementation logic: the new setup
logic lives in focused scripts, and `README.md` is edited for accuracy rather
than duplicated with another installation guide. Secrets, `.env`, dependencies,
build output, logs, databases, and `.omniharness` state already have appropriate
`.gitignore` coverage.

## Tasks

- [x] **1. Prove published ACP and environment assumptions before changing claims.**
  - Inspect the official package manifests installed by the existing rolling
    workflow and record only the OS/architecture support actually published by
    upstream; make no unsupported platform or architecture claims.
  - Trace `.env` loading into runner host/public-origin/auth behavior and add a
    focused test proving `OMNIHARNESS_RUNNER_HOST` reaches runner configuration.
  - Confirm the production interface does not bake `OMNIHARNESS_PUBLIC_ORIGIN`
    at build time, so a runner restart is sufficient after Tailscale setup.
  - Confirm `/api/healthz`, the runner's real default `dist/interface` directory,
    and the Vite HTML asset-reference shape before encoding them in release CI.

- [x] **2. Specify build freshness and runner help with failing tests.**
  - Add tests proving a missing/incomplete interface artifact or mismatched
    content fingerprint requires a build and a matching artifact does not.
  - Add tests proving `--help`/`-h` prints every supported runner option and
    exits without starting a runner; verify through `pnpm runner -- --help` and
    assert runner-specific option text so pnpm help cannot satisfy the test.
  - Run the focused tests and confirm they fail for the missing behavior.
  - Implement `scripts/interface-build-state.mjs`, write its marker only after a
    successful build, add runner help text, and integrate it with the Unix
    launcher; rerun until green.
  - Preserve the existing non-interactive `OMNIHARNESS_AUTH_PASSWORD` path and
    add a launcher contract test proving CI can bypass interactive password setup
    without persisting or printing the plaintext.
  - Ensure a changed lockfile makes the launcher run `pnpm install` even when
    `node_modules` exists, and a failed build never writes a fresh marker.

- [x] **3. Specify Tailscale setup with failing tests.**
  - Test PATH and macOS-app CLI discovery, disconnected tailnet, valid
    `status --json`, DNS validation, existing-setting conflicts, `--force`,
    Serve permission/certificate failures, exact Serve command arguments,
    atomic `.env` replacement, rollback after publish failure, and `--reset`.
  - Confirm the focused suite fails before implementation.
  - Implement `scripts/setup-tailscale.mjs` and the package script with real
    child-process execution, `--dry-run`, explicit remediation, and ownership
    markers for the two `.env` settings; rerun until green.
  - Never call Funnel or a broad `tailscale serve reset`; disable only the HTTPS
    listener owned by OmniHarness during rollback/reset.

- [x] **4. Make installation documentation match proven behavior.**
  - Replace placeholder clone commands and stale Rust/default-binary text.
  - Put the one-command macOS flow first; note that Linux shares the shell
    launcher without becoming a release gate; state that Windows installation is
    not supported in this milestone.
  - State plainly that production API and UI share port `3050`, while the ACP
    bridge stays on loopback `7800`.
  - Document `pnpm setup:tailscale`, private HTTPS, ACL/password boundaries,
    permission/certificate remediation, `--force`, `--reset`, and Cloudflare only
    as an optional public route.
  - Include a release-operator check on a real tailnet: run setup, verify
    `tailscale serve status`, open the printed private URL, then verify `--reset`.
    Keep this manual because release automation must not mutate a CI tailnet.
  - Update `.env.example`, runner operations, security guidance, troubleshooting,
    and launcher terminal guidance consistently.
  - Verify links, commands, ports, and absence of contradictory default-install
    claims with targeted searches.

- [x] **5. Add a real clean-install macOS release check.**
  - Add a macOS job that invokes `./omniharness` from a fresh checkout with an
    environment-provided password, isolated data, browser opening disabled, and
    a non-default port; the job never configures Tailscale.
  - Poll `/api/healthz` with a hard deadline, fetch `/`, assert OmniHarness HTML,
    fetch a hashed asset referenced by that HTML, preserve logs on failure, and
    stop the launched process in an unconditional cleanup step.
  - Assert `dist/interface/.build-state.json` is absent before the fresh launch
    and valid afterward so the job proves the launcher built the interface.
  - Keep the existing rolling Codex ACP/model workflow responsible for current
    package and GPT-5.6 Sol metadata checks.
  - Validate workflow YAML and inspect the exact platform commands.

- [x] **6. Run final verification against the real checkout.**
  - Run focused script and runner tests.
  - Run `pnpm typecheck`, targeted lint, `pnpm build`, and ACP compatibility.
  - Start an isolated runner on a non-default port using the existing checkout,
    verify `/api/healthz` and the production interface, then stop only that
    isolated process and leave its OS-temporary data root in place unless the
    user separately authorizes deletion.
  - Run `pnpm setup:tailscale` only in a non-mutating check/dry-run mode locally;
    do not alter the developer's live Serve configuration during verification.
  - Review the final diff for unrelated files and preserve all pre-existing user
    changes.

## Product And Operational Checks

- Installation states and failures remain visible in terminal output.
- `.env` is the source of truth only for OmniHarness origin/bind settings;
  Tailscale remains the source of truth for VPN identity, ACLs, certificates,
  and Serve state.
- Re-running the launcher or Tailscale setup is idempotent.
- Existing non-empty public-origin/host settings are never overwritten without
  `--force`, and prior values remain recoverable.
- The UI has no new state ownership or persistence changes; no React Manager or
  localization changes are required.
- The final milestone contains no mock server, placeholder adapter, silent public
  tunnel, or second production UI process.
