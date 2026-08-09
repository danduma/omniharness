---
provider: "claude"
codex_thread_id: "31bdb425-50e8-4b1c-93b9-27af07b204c5"
title: "Review macOS installation and Tailscale setup design"
started_at: "2026-08-05T20:42:35.326Z"
updated_at: "2026-08-05T20:43:36.173Z"
working_directory: "/Users/masterman/NLP/omniharness"
archive_status: "unknown"
part: 1
parts: 1
---

# Review macOS installation and Tailscale setup design

> This archive contains Claude Code conversation activity, stored thinking blocks, tools, and subagents. Raw system prompts and credentials are excluded.
<!-- codex-event:{"kind":"state","timestamp":"2026-08-05T20:42:35.326Z","phase":null} -->
## Claude state: queue-operation · 2026-08-05T20:42:35.326Z

```text
{
  "type": "queue-operation",
  "operation": "enqueue",
  "timestamp": "2026-08-05T20:42:35.326Z",
  "sessionId": "31bdb425-50e8-4b1c-93b9-27af07b204c5",
  "content": "You are a tool-free second-opinion reviewer. Scope changed: macOS is the sole release gate; Windows is explicitly out; Linux must not delay the Mac release. Judge the revised artifacts only.\n\n# Handoff-Ready Installation And Tailscale Design\n\n## Goal\n\nA new macOS OmniHarness user can clone the repository and use one command to\ninstall dependencies, configure authentication, install published ACP packages,\nbuild the production interface, and start the runner. Private remote access is\ndocumented and automated through Tailscale Serve before any public-tunnel option.\n\n## First User And Core Job\n\nThe first user is a developer or operator installing OmniHarness on a personal\nMac. Their core job is to start one durable\nOmniHarness deployment and open its web interface without learning the internal\nrunner/bridge/build layout.\n\n## Supporting Jobs\n\n- Understand what was installed and which URLs are safe to expose.\n- Start both the API and production web interface with one command.\n- Configure a password on first run without storing plaintext credentials.\n- Install maintained, published ACP packages without compiling an adapter.\n- Reach the web interface privately from another tailnet device.\n- Diagnose missing prerequisites or a failed startup from concrete messages.\n- Update the checkout and restart without rebuilding the interface unnecessarily.\n- Verify installation behavior continuously on macOS. Linux continues to share\n  the Unix launcher, but it is not a release gate in this milestone. Windows\n  installation is explicitly outside this milestone.\n\n## Approved Approach\n\n### One runner, one public application port\n\nProduction keeps the existing architecture: the runner serves both the API/SSE\nsurface and the built Vite interface on port `3050`. The managed ACP bridge stays\non loopback port `7800`. The user does not start a second UI process in\nproduction; separate runner and Vite processes remain development-only.\n\n### macOS release launcher\n\nmacOS uses `./omniharness`. The launcher validates or installs the supported Node\ntoolchain through its existing nvm path, obtains a supported pnpm when necessary,\ninstalls repository dependencies, configures password authentication, ensures\nACP adapters, builds the interface when its artifact is missing or stale, prints\nservice and private-access guidance, and starts the runner in the foreground. It\npreserves explicit runner arguments and fails with the real command error.\n\nLinux continues to use the same shell launcher where it already works, but this\nmilestone does not add platform-specific Linux packaging or make Linux CI a\nrelease blocker. No Windows launcher or Windows installation claim is included.\n\n### Published ACP packages\n\nThe normal Codex path installs the maintained\n`@agentclientprotocol/codex-acp` and `@openai/codex` npm packages. These packages\ncontain the published adapter and platform Codex binary; normal installation\ndoes not invoke Rust or Cargo. The rolling package check and the three-platform\nmodel-metadata workflow remain the update rail. Legacy binary, Cargo, and Docker\nmodes are documented only as explicit developer or recovery overrides, never as\nthe default end-user path.\n\n### Interface build freshness\n\nA small cross-platform Node helper owns the definition of a usable production\ninterface artifact. It hashes the tracked interface inputs, build configuration,\npackage manifest, and lockfile and compares that value with\n`dist/interface/.build-state.json`. A missing interface document, missing\nmarker, incomplete asset graph, or hash mismatch requires a build. The marker\nis written only after a successful build. Both launchers use that helper,\nreplacing the stale `.next` check left by the previous web stack.\n\n### Tailscale-first private access\n\n`pnpm setup:tailscale` runs a cross-platform Node setup command. It:\n\n1. discovers the Tailscale CLI, including the documented macOS application\n   location when it is not on `PATH`;\n2. verifies that the local device is connected to a tailnet and derives and\n   validates its stable `https://<device>.<tailnet>.ts.net` origin before any\n   mutation;\n3. refuses to replace a different non-empty `OMNIHARNESS_PUBLIC_ORIGIN` or\n   `OMNIHARNESS_RUNNER_HOST` unless the user explicitly passes `--force`;\n4. stages an atomic `.env` update without publishing it;\n5. configures persistent private HTTPS proxying with\n   `tailscale serve --bg http://127.0.0.1:3050`;\n6. atomically publishes the staged `OMNIHARNESS_PUBLIC_ORIGIN` and\n   `OMNIHARNESS_RUNNER_HOST=127.0.0.1` settings; and\n7. tells the user to restart OmniHarness and prints the private URL.\n\nThe command is explicit because it changes host networking and tailnet Serve\nconfiguration. It never enables Tailscale Funnel and never exposes the ACP\nbridge. If Tailscale is missing, logged out, lacks Serve/HTTPS permission, or\nrequires an administrator/operator action, it exits with the original Tailscale\nerror plus the appropriate next action. A failed Serve command leaves `.env`\nunchanged. If publishing the already-staged `.env` update fails after Serve was\ncreated, the command disables only the HTTPS Serve listener it just created and\nreports both failures. Re-running setup is safe. A tested `--reset` mode disables\nthe OmniHarness HTTPS Serve listener and removes only the two settings owned by\nthis setup command; it refuses ambiguous pre-existing Serve/config state unless\n`--force` is explicit.\n\nThe launcher recommends `pnpm setup:tailscale` first. Cloudflare Tunnel remains\ndocumented as an optional public-access path, clearly separated from private\ntailnet access.\n\n## State And Persistence\n\nInstallation has these user-visible states: prerequisite check, dependency\ninstall, authentication setup, adapter setup, interface build, starting,\nready, and failed. Commands print each transition and preserve underlying errors.\n\nTailscale itself owns VPN login, device identity, ACLs, HTTPS certificates, and\nServe state. OmniHarness owns only its `.env` origin and loopback binding. The\nignored `.env` file survives runner restarts and repository updates but is not\ncommitted or synchronized to another machine. Setup records the prior values it\nreplaces as comments when `--force` is used. Reset removes only settings marked\nas owned by this setup command and disables the matching HTTPS listener without\nresetting unrelated Tailscale Serve routes.\n\n## Operational Readiness And Trust\n\n- The web/API port may be proxied; the ACP bridge remains loopback-only.\n- Password authentication stays mandatory even inside a tailnet.\n- Tailscale ACLs provide an additional private-network boundary, not a\n  replacement for OmniHarness authentication.\n- Setup never silently invokes public Funnel access.\n- Missing tools, failed downloads, invalid Tailscale state, permission/certificate\n  prerequisites, build errors, existing processes, port conflicts, and runner\n  failures remain visible with their original details.\n- The README uses the real GitHub clone URL and does not imply that users need\n  to compile the ACP adapter or run two production web processes.\n\n## Verification\n\nDeterministic tests cover content-hashed interface-build freshness, Unix launcher\nbehavior, Windows PowerShell parsing and dry-run behavior, runner help, Tailscale\nstatus/configuration/conflict/rollback/env-file behavior, environment loading,\nand ACP default documentation. A GitHub Actions macOS installation job runs the\nreal entry point from a fresh checkout, waits on the real health endpoint,\nfetches the real interface document, and shuts the runner down. The existing\nrolling ACP workflow remains separate and unchanged.\n\nNo browser-driving journey is required for this milestone: health and actual\nHTML delivery prove the installation boundary without creating user data or\nrequiring a browser session.\n\n## Acceptance Criteria\n\n- A fresh macOS checkout starts through `./omniharness`.\n- That entry point installs/builds the API-plus-interface deployment.\n- Normal Codex ACP installation uses published npm packages and no compiler.\n- `pnpm setup:tailscale` creates private HTTPS Serve configuration and persists\n  the correct OmniHarness origin/bind settings, refuses conflicting deployments,\n  and offers tested rollback/reset behavior.\n- Tailscale is the first remote-access recommendation; public tunnels are\n  secondary and clearly labeled.\n- `pnpm runner --help` prints supported options and exits successfully.\n- Automated macOS, Linux, and Windows installation smoke checks pass.\n\n## North Star And Current Milestone\n\nThe north star is a trustworthy self-hosted agent control plane that a user can\ninstall, privately connect to, update, and recover without understanding its\ninternal process topology. This milestone completes the macOS repository\ninstallation and private Tailscale onboarding path. Linux-specific release\nhardening, Windows installation, packaged OS services, and offline bundles remain\nproduct direction, not claims made by this milestone.\n\n\n# Handoff-Ready Installation And Tailscale Implementation Plan\n\n> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.\n\n**Goal:** Make a fresh OmniHarness checkout install and start its API plus production interface through one command on macOS, with Tailscale Serve as the primary private-access path.\n\n**Architecture:** Keep the production interface and API on the existing runner port and keep ACP on loopback. Add focused Node helpers for build freshness and Tailscale setup, harden the existing shell launcher, and verify that real entry point in macOS CI.\n\n**Tech Stack:** Bash, Node.js ESM, pnpm, Vite, Vitest, GitHub Actions, Tailscale CLI.\n\n**North Star Product:** A trustworthy self-hosted agent control plane that a user can install, privately connect to, update, and recover without understanding its internal process topology.\n\n**Current Milestone:** Complete the repository installation and private Tailscale onboarding path on macOS.\n\n**Future Product Direction:** Signed OS packages, managed background services, and offline multi-architecture bundles can build on this contract but are not claimed here.\n\n**Final Functionality Standard:** The real launchers install and start the real API-plus-interface deployment, the real Tailscale CLI configures private Serve access, and CI proves the entry points on every supported desktop OS.\n\n---\n\n## File Map\n\nCreate:\n\n- `scripts/interface-build-state.mjs` — cross-platform content fingerprint and production-interface build marker.\n- `scripts/setup-tailscale.mjs` — explicit private Tailscale Serve setup and `.env` persistence.\n- `tests/scripts/interface-build-state.test.ts` — build-state behavior.\n- `tests/scripts/setup-tailscale.test.ts` — real child-process/status parsing and `.env` behavior with isolated command fixtures.\n- `.github/workflows/install-smoke.yml` — fresh-checkout macOS launcher, health, and HTML check.\n\nModify:\n\n- `omniharness` — use the shared build check and Tailscale-first guidance.\n- `package.json` — expose `setup:tailscale`.\n- `src/server/runner/config.ts` — expose stable runner help text/argument handling.\n- `scripts/runner.ts` — print help and exit successfully.\n- `tests/server/runner/config.test.ts` — runner help/option contract.\n- `tests/scripts/omniharness-launcher.test.ts` — Vite build and Tailscale guidance contracts.\n- `README.md` — real clone URL, one-command platform setup, actual ACP packaging, API/UI topology, Tailscale first, Cloudflare second.\n- `.env.example` — neutral Tailscale/private-origin examples.\n- `docs/deployment/runner-operations.md` — Tailscale Serve deployment and loopback rules.\n- `docs/security/authentication-and-tls.md` — tailnet trust boundary and password requirement.\n\nExisting large files are not expanded with implementation logic: the new setup\nlogic lives in focused scripts, and `README.md` is edited for accuracy rather\nthan duplicated with another installation guide. Secrets, `.env`, dependencies,\nbuild output, logs, databases, and `.omniharness` state already have appropriate\n`.gitignore` coverage.\n\n## Tasks\n\n- [ ] **1. Prove published ACP and environment assumptions before changing claims.**\n  - Inspect the official package manifests installed by the existing rolling\n    workflow and record only the OS/architecture support actually published by\n    upstream; make no unsupported platform or architecture claims.\n  - Trace `.env` loading into runner host/public-origin/auth behavior and add a\n    focused test proving `OMNIHARNESS_RUNNER_HOST` reaches runner configuration.\n  - Confirm the production interface does not bake `OMNIHARNESS_PUBLIC_ORIGIN`\n    at build time, so a runner restart is sufficient after Tailscale setup.\n\n- [ ] **2. Specify build freshness and runner help with failing tests.**\n  - Add tests proving a missing/incomplete interface artifact or mismatched\n    content fingerprint requires a build and a matching artifact does not.\n  - Add tests proving `--help`/`-h` prints every supported runner option and\n    exits without starting a runner.\n  - Run the focused tests and confirm they fail for the missing behavior.\n  - Implement `scripts/interface-build-state.mjs`, write its marker only after a\n    successful build, add runner help text, and integrate it with the Unix\n    launcher; rerun until green.\n  - Ensure a changed lockfile makes the launcher run `pnpm install` even when\n    `node_modules` exists, and a failed build never writes a fresh marker.\n\n- [ ] **3. Specify Tailscale setup with failing tests.**\n  - Test PATH and macOS-app CLI discovery, disconnected tailnet, valid\n    `status --json`, DNS validation, existing-setting conflicts, `--force`,\n    Serve permission/certificate failures, exact Serve command arguments,\n    atomic `.env` replacement, rollback after publish failure, and `--reset`.\n  - Confirm the focused suite fails before implementation.\n  - Implement `scripts/setup-tailscale.mjs` and the package script with real\n    child-process execution, `--dry-run`, explicit remediation, and ownership\n    markers for the two `.env` settings; rerun until green.\n  - Never call Funnel or a broad `tailscale serve reset`; disable only the HTTPS\n    listener owned by OmniHarness during rollback/reset.\n\n- [ ] **4. Make installation documentation match proven behavior.**\n  - Replace placeholder clone commands and stale Rust/default-binary text.\n  - Put the one-command macOS/Linux and Windows flows first.\n  - State plainly that production API and UI share port `3050`, while the ACP\n    bridge stays on loopback `7800`.\n  - Document `pnpm setup:tailscale`, private HTTPS, ACL/password boundaries,\n    permission/certificate remediation, `--force`, `--reset`, and Cloudflare only\n    as an optional public route.\n  - Update `.env.example`, runner operations, security guidance, troubleshooting,\n    and launcher terminal guidance consistently.\n  - Verify links, commands, ports, and absence of contradictory default-install\n    claims with targeted searches.\n\n- [ ] **5. Add a real clean-install macOS release check.**\n  - Add a macOS job that invokes `./omniharness` from a fresh checkout with an\n    environment-provided password, isolated data, browser opening disabled, and\n    a non-default port; the job never configures Tailscale.\n  - Poll `/api/healthz` with a hard deadline, fetch `/`, assert OmniHarness HTML,\n    preserve logs on failure, and stop the launched process in an unconditional\n    cleanup step.\n  - Keep the existing rolling Codex ACP/model workflow responsible for current\n    package and GPT-5.6 Sol metadata checks.\n  - Validate workflow YAML and inspect the exact platform commands.\n\n- [ ] **6. Run final verification against the real checkout.**\n  - Run focused script and runner tests.\n  - Run `pnpm typecheck`, targeted lint, `pnpm build`, and ACP compatibility.\n  - Start an isolated runner on a non-default port using the existing checkout,\n    verify `/api/healthz` and the production interface, then stop only that\n    isolated process and leave its OS-temporary data root in place unless the\n    user separately authorizes deletion.\n  - Run `pnpm setup:tailscale` only in a non-mutating check/dry-run mode locally;\n    do not alter the developer's live Serve configuration during verification.\n  - Review the final diff for unrelated files and preserve all pre-existing user\n    changes.\n\n## Product And Operational Checks\n\n- Installation states and failures remain visible in terminal output.\n- `.env` is the source of truth only for OmniHarness origin/bind settings;\n  Tailscale remains the source of truth for VPN identity, ACLs, certificates,\n  and Serve state.\n- Re-running either launcher or Tailscale setup is idempotent.\n- Existing non-empty public-origin/host settings are never overwritten without\n  `--force`, and prior values remain recoverable.\n- The UI has no new state ownership or persistence changes; no React Manager or\n  localization changes are required.\n- The final milestone contains no mock server, placeholder adapter, silent public\n  tunnel, or second production UI process.\n\n\nReturn: 1. Verdict READY or HARDEN. 2. Only remaining release-blocking findings with concrete fixes. 3. What to leave alone.\n"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-08-05T20:42:35.326Z","phase":null} -->
## Claude state: queue-operation · 2026-08-05T20:42:35.326Z

```text
{
  "type": "queue-operation",
  "operation": "dequeue",
  "timestamp": "2026-08-05T20:42:35.326Z",
  "sessionId": "31bdb425-50e8-4b1c-93b9-27af07b204c5"
}
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"state","timestamp":"2026-08-05T20:42:35.334Z","phase":null} -->
## Claude attachment · 2026-08-05T20:42:35.334Z

```text
{
  "type": "plan_mode",
  "reminderType": "full",
  "isSubAgent": false,
  "planFilePath": "/Users/masterman/.claude/plans/you-are-a-tool-free-zippy-twilight.md",
  "planExists": false
}

binary omitted from archive

uuid: 19ab406e-7c0a-41ae-8a03-e82ff4478982
parent: 2049854e-0035-4043-a654-abee800fba8a
```

<!-- /codex-event -->

<!-- codex-event:{"kind":"user","timestamp":"2026-08-05T20:42:35.335Z","phase":null} -->
## User · 2026-08-05T20:42:35.335Z

You are a tool-free second-opinion reviewer. Scope changed: macOS is the sole release gate; Windows is explicitly out; Linux must not delay the Mac release. Judge the revised artifacts only.

# Handoff-Ready Installation And Tailscale Design

## Goal

A new macOS OmniHarness user can clone the repository and use one command to
install dependencies, configure authentication, install published ACP packages,
build the production interface, and start the runner. Private remote access is
documented and automated through Tailscale Serve before any public-tunnel option.

## First User And Core Job

The first user is a developer or operator installing OmniHarness on a personal
Mac. Their core job is to start one durable
OmniHarness deployment and open its web interface without learning the internal
runner/bridge/build layout.

## Supporting Jobs

- Understand what was installed and which URLs are safe to expose.
- Start both the API and production web interface with one command.
- Configure a password on first run without storing plaintext credentials.
- Install maintained, published ACP packages without compiling an adapter.
- Reach the web interface privately from another tailnet device.
- Diagnose missing prerequisites or a failed startup from concrete messages.
- Update the checkout and restart without rebuilding the interface unnecessarily.
- Verify installation behavior continuously on macOS. Linux continues to share
  the Unix launcher, but it is not a release gate in this milestone. Windows
  installation is explicitly outside this milestone.

## Approved Approach

### One runner, one public application port

Production keeps the existing architecture: the runner serves both the API/SSE
surface and the built Vite interface on port `3050`. The managed ACP bridge stays
on loopback port `7800`. The user does not start a second UI process in
production; separate runner and Vite processes remain development-only.

### macOS release launcher

macOS uses `./omniharness`. The launcher validates or installs the supported Node
toolchain through its existing nvm path, obtains a supported pnpm when necessary,
installs repository dependencies, configures password authentication, ensures
ACP adapters, builds the interface when its artifact is missing or stale, prints
service and private-access guidance, and starts the runner in the foreground. It
preserves explicit runner arguments and fails with the real command error.

Linux continues to use the same shell launcher where it already works, but this
milestone does not add platform-specific Linux packaging or make Linux CI a
release blocker. No Windows launcher or Windows installation claim is included.

### Published ACP packages

The normal Codex path installs the maintained
`@agentclientprotocol/codex-acp` and `@openai/codex` npm packages. These packages
contain the published adapter and platform Codex binary; normal installation
does not invoke Rust or Cargo. The rolling package check and the three-platform
model-metadata workflow remain the update rail. Legacy binary, Cargo, and Docker
modes are documented only as explicit developer or recovery overrides, never as
the default end-user path.

### Interface build freshness

A small cross-platform Node helper owns the definition of a usable production
interface artifact. It hashes the tracked interface inputs, build configuration,
package manifest, and lockfile and compares that value with
`dist/interface/.build-state.json`. A missing interface document, missing
marker, incomplete asset graph, or hash mismatch requires a build. The marker
is written only after a successful build. Both launchers use that helper,
replacing the stale `.next` check left by the previous web stack.

### Tailscale-first private access

`pnpm setup:tailscale` runs a cross-platform Node setup command. It:

1. discovers the Tailscale CLI, including the documented macOS application
   location when it is not on `PATH`;
2. verifies that the local device is connected to a tailnet and derives and
   validates its stable `https://<device>.<tailnet>.ts.net` origin before any
   mutation;
3. refuses to replace a different non-empty `OMNIHARNESS_PUBLIC_ORIGIN` or
   `OMNIHARNESS_RUNNER_HOST` unless the user explicitly passes `--force`;
4. stages an atomic `.env` update without publishing it;
5. configures persistent private HTTPS proxying with
   `tailscale serve --bg http://127.0.0.1:3050`;
6. atomically publishes the staged `OMNIHARNESS_PUBLIC_ORIGIN` and
   `OMNIHARNESS_RUNNER_HOST=127.0.0.1` settings; and
7. tells the user to restart OmniHarness and prints the private URL.

The command is explicit because it changes host networking and tailnet Serve
configuration. It never enables Tailscale Funnel and never exposes the ACP
bridge. If Tailscale is missing, logged out, lacks Serve/HTTPS permission, or
requires an administrator/operator action, it exits with the original Tailscale
error plus the appropriate next action. A failed Serve command leaves `.env`
unchanged. If publishing the already-staged `.env` update fails after Serve was
created, the command disables only the HTTPS Serve listener it just created and
reports both failures. Re-running setup is safe. A tested `--reset` mode disables
the OmniHarness HTTPS Serve listener and removes only the two settings owned by
this setup command; it refuses ambiguous pre-existing Serve/config state unless
`--force` is explicit.

The launcher recommends `pnpm setup:tailscale` first. Cloudflare Tunnel remains
documented as an optional public-access path, clearly separated from private
tailnet access.

## State And Persistence

Installation has these user-visible states: prerequisite check, dependency
install, authentication setup, adapter setup, interface build, starting,
ready, and failed. Commands print each transition and preserve underlying errors.

Tailscale itself owns VPN login, device identity, ACLs, HTTPS certificates, and
Serve state. OmniHarness owns only its `.env` origin and loopback binding. The
ignored `.env` file survives runner restarts and repository updates but is not
committed or synchronized to another machine. Setup records the prior values it
replaces as comments when `--force` is used. Reset removes only settings marked
as owned by this setup command and disables the matching HTTPS listener without
resetting unrelated Tailscale Serve routes.

## Operational Readiness And Trust

- The web/API port may be proxied; the ACP bridge remains loopback-only.
- Password authentication stays mandatory even inside a tailnet.
- Tailscale ACLs provide an additional private-network boundary, not a
  replacement for OmniHarness authentication.
- Setup never silently invokes public Funnel access.
- Missing tools, failed downloads, invalid Tailscale state, permission/certificate
  prerequisites, build errors, existing processes, port conflicts, and runner
  failures remain visible with their original details.
- The README uses the real GitHub clone URL and does not imply that users need
  to compile the ACP adapter or run two production web processes.

## Verification

Deterministic tests cover content-hashed interface-build freshness, Unix launcher
behavior, Windows PowerShell parsing and dry-run behavior, runner help, Tailscale
status/configuration/conflict/rollback/env-file behavior, environment loading,
and ACP default documentation. A GitHub Actions macOS installation job runs the
real entry point from a fresh checkout, waits on the real health endpoint,
fetches the real interface document, and shuts the runner down. The existing
rolling ACP workflow remains separate and unchanged.

No browser-driving journey is required for this milestone: health and actual
HTML delivery prove the installation boundary without creating user data or
requiring a browser session.

## Acceptance Criteria

- A fresh macOS checkout starts through `./omniharness`.
- That entry point installs/builds the API-plus-interface deployment.
- Normal Codex ACP installation uses published npm packages and no compiler.
- `pnpm setup:tailscale` creates private HTTPS Serve configuration and persists
  the correct OmniHarness origin/bind settings, refuses conflicting deployments,
  and offers tested rollback/reset behavior.
- Tailscale is the first remote-access recommendation; public tunnels are
  secondary and clearly labeled.
- `pnpm runner --help` prints supported options and exits successfully.
- Automated macOS, Linux, and Windows installation smoke checks pass.

## North Star And Current Milestone

The north star is a trustworthy self-hosted agent control plane that a user can
install, privately connect to, update, and recover without understanding its
internal process topology. This milestone completes the macOS repository
installation and private Tailscale onboarding path. Linux-specific release
hardening, Windows installation, packaged OS services, and offline bundles remain
product direction, not claims made by this milestone.


# Handoff-Ready Installation And Tailscale Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use ultrapowers:subagent-driven-development (recommended) or ultrapowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a fresh OmniHarness checkout install and start its API plus production interface through one command on macOS, with Tailscale Serve as the primary private-access path.

**Architecture:** Keep the production interface and API on the existing runner port and keep ACP on loopback. Add focused Node helpers for build freshness and Tailscale setup, harden the existing shell launcher, and verify that real entry point in macOS CI.

**Tech Stack:** Bash, Node.js ESM, pnpm, Vite, Vitest, GitHub Actions, Tailscale CLI.

**North Star Product:** A trustworthy self-hosted agent control plane that a user can install, privately connect to, update, and recover without understanding its internal process topology.

**Current Milestone:** Complete the repository installation and private Tailscale onboarding path on macOS.

**Future Product Direction:** Signed OS packages, managed background services, and offline multi-architecture bundles can build on this contract but are not claimed here.

**Final Functionality Standard:** The real launchers install and start the real API-plus-interface deployment, the real Tailscale CLI configures private Serve access, and CI proves the entry points on every supported desktop OS.

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

- [ ] **1. Prove published ACP and environment assumptions before changing claims.**
  - Inspect the official package manifests installed by the existing rolling
    workflow and record only the OS/architecture support actually published by
    upstream; make no unsupported platform or architecture claims.
  - Trace `.env` loading into runner host/public-origin/auth behavior and add a
    focused test proving `OMNIHARNESS_RUNNER_HOST` reaches runner configuration.
  - Confirm the production interface does not bake `OMNIHARNESS_PUBLIC_ORIGIN`
    at build time, so a runner restart is sufficient after Tailscale setup.

- [ ] **2. Specify build freshness and runner help with failing tests.**
  - Add tests proving a missing/incomplete interface artifact or mismatched
    content fingerprint requires a build and a matching artifact does not.
  - Add tests proving `--help`/`-h` prints every supported runner option and
    exits without starting a runner.
  - Run the focused tests and confirm they fail for the missing behavior.
  - Implement `scripts/interface-build-state.mjs`, write its marker only after a
    successful build, add runner help text, and integrate it with the Unix
    launcher; rerun until green.
  - Ensure a changed lockfile makes the launcher run `pnpm install` even when
    `node_modules` exists, and a failed build never writes a fresh marker.

- [ ] **3. Specify Tailscale setup with failing tests.**
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

- [ ] **4. Make installation documentation match proven behavior.**
  - Replace placeholder clone commands and stale Rust/default-binary text.
  - Put the one-command macOS/Linux and Windows flows first.
  - State plainly that production API and UI share port `3050`, while the ACP
    bridge stays on loopback `7800`.
  - Document `pnpm setup:tailscale`, private HTTPS, ACL/password boundaries,
    permission/certificate remediation, `--force`, `--reset`, and Cloudflare only
    as an optional public route.
  - Update `.env.example`, runner operations, security guidance, troubleshooting,
    and launcher terminal guidance consistently.
  - Verify links, commands, ports, and absence of contradictory default-install
    claims with targeted searches.

- [ ] **5. Add a real clean-install macOS release check.**
  - Add a macOS job that invokes `./omniharness` from a fresh checkout with an
    environment-provided password, isolated data, browser opening disabled, and
    a non-default port; the job never configures Tailscale.
  - Poll `/api/healthz` with a hard deadline, fetch `/`, assert OmniHarness HTML,
    preserve logs on failure, and stop the launched process in an unconditional
    cleanup step.
  - Keep the existing rolling Codex ACP/model workflow responsible for current
    package and GPT-5.6 Sol metadata checks.
  - Validate workflow YAML and inspect the exact platform commands.

- [ ] **6. Run final verification against the real checkout.**
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
- Re-running either launcher or Tailscale setup is idempotent.
- Existing non-empty public-origin/host settings are never overwritten without
  `--force`, and prior values remain recoverable.
- The UI has no new state ownership or persistence changes; no React Manager or
  localization changes are required.
- The final milestone contains no mock server, placeholder adapter, silent public
  tunnel, or second production UI process.


Return: 1. Verdict READY or HARDEN. 2. Only remaining release-blocking findings with concrete fixes. 3. What to leave alone.


uuid: 2049854e-0035-4043-a654-abee800fba8a

<!-- /codex-event -->

<!-- codex-event:{"kind":"reasoning","timestamp":"2026-08-05T20:43:10.577Z","phase":null} -->
## Claude thinking · 2026-08-05T20:43:10.577Z



uuid: e2246b7c-14cb-473f-829f-4e95f38d7a98
parent: 19ab406e-7c0a-41ae-8a03-e82ff4478982

<!-- /codex-event -->

<!-- codex-event:{"kind":"final","timestamp":"2026-08-05T20:43:36.173Z","phase":null} -->
## Claude · 2026-08-05T20:43:36.173Z

## 1. Verdict

**HARDEN** — the architecture and the Tailscale contract are sound. What blocks release is that the scope change to "macOS-only gate, Windows out" was applied to the narrative sections but not to the Verification, Acceptance Criteria, or Task 4/Final-Functionality-Standard sections. As written, the artifacts commit to Windows work that has no file, no launcher, and no owner. Plus one real functional gap in the gating CI path.

## 2. Release-blocking findings

**B1. Windows is still committed to in four places, with no Windows artifact anywhere in the File Map.**
- Design → Verification: "Windows PowerShell parsing and dry-run behavior"
- Design → Acceptance Criteria: "Automated macOS, Linux, and Windows installation smoke checks pass."
- Plan → Task 4: "Put the one-command macOS/Linux and Windows flows first."
- Plan → Final Functionality Standard: "CI proves the entry points on every supported desktop OS."

Task 4 is the worst of these: it instructs the implementer to write first-class Windows install docs for a launcher the plan never creates, which is exactly the kind of unbacked install claim the Design section says it is avoiding.

Fix (all mechanical, do them together):
- Delete the Windows PowerShell clause from Verification; the remaining list (build freshness, Unix launcher, runner help, Tailscale behaviors, env loading, ACP defaults) is correct as-is.
- Rewrite the acceptance criterion to: *"The automated macOS installation smoke check passes. No Linux or Windows installation check gates this milestone."*
- Rewrite the Final Functionality Standard's last clause to: *"...and macOS CI proves the real entry point from a fresh checkout."*
- Rewrite Task 4 bullet 2 to: *"Put the one-command macOS flow first; note that the same launcher is used on Linux without a support claim; state explicitly that Windows installation is not supported in this milestone."*

**B2. The sole release gate cannot actually run non-interactively as specified.**
Design lists "configure a password on first run without storing plaintext credentials" as a launcher step, and Acceptance requires a fresh macOS checkout to start through `./omniharness`. Task 5 says the CI job supplies "an environment-provided password" — but neither artifact names that variable or states that the launcher must support non-interactive password provisioning. If the launcher only prompts on a TTY, the macOS job hangs to its deadline and the one gate you kept is untestable.

Fix: add an explicit contract to Design → macOS release launcher and to Task 2: *"The launcher accepts a non-interactive password source (e.g. `OMNIHARNESS_SETUP_PASSWORD`), hashes it through the same path as the interactive prompt, never echoes or persists the plaintext, and prompts only when that variable is unset and stdin is a TTY. Non-interactive with no variable set fails with a named remediation rather than blocking on input."* Add a test for the non-TTY-without-variable failure to `tests/scripts/omniharness-launcher.test.ts`.

**B3. Task 5's CI job has no assertion that the launcher didn't skip the build.**
The job polls `/api/healthz` and fetches `/`, but a stale-but-present `dist/interface` from a cached checkout would pass both while proving nothing about the freshness helper — which is the one piece of new logic the gate exists to protect. This is cheap to close.

Fix: in Task 5, require the job to assert the fresh checkout had no `dist/interface/.build-state.json` before launch and a valid one after, and to fetch a hashed asset referenced by the returned HTML rather than only the HTML document.

Everything else I'd raise is non-blocking: `--dry-run` appears in Tasks 3 and 6 but not in the Design's enumeration of the Tailscale command's behavior (add one clause), and `--force`-recorded prior values are recoverable only by hand after `--reset` (acceptable — say so in the docs rather than building restore).

## 3. Leave alone

- **One runner, one port.** API + built interface on `3050`, bridge loopback-only on `7800`, no second production UI process. Correct and correctly stated.
- **Published npm ACP packages as the default path**, with Cargo/binary/Docker as documented overrides only. Task 1's instruction to record *only* upstream-published platform support is the right guard; don't strengthen it into a support claim.
- **The whole Tailscale ordering contract:** validate origin before mutation → stage `.env` → Serve → publish → on publish failure disable only the listener just created. The refusal to call Funnel or a broad `serve reset`, and scoping `--reset` to the two owned settings, are the right calls. Don't add auto-configuration to the launcher; keeping `pnpm setup:tailscale` explicit is correct because it mutates host networking.
- **The content-hash build-state helper** owning freshness for both launchers, marker written only after success.
- **Linux sharing the Unix launcher with no dedicated packaging or gate.** That is the correct reading of "must not delay the Mac release" — resist adding a Linux CI job "just to be safe."
- **No browser-driving journey.** Health plus real HTML is the right boundary for this milestone.
- **Password mandatory inside the tailnet; ACLs as an additional boundary, not a replacement.**

Fixes B1–B3 are documentation and test-contract edits plus one small launcher behavior; none of them change the architecture.

uuid: b4ebc26a-59d9-4fda-9ffd-69ae1f2bac77
parent: e2246b7c-14cb-473f-829f-4e95f38d7a98

<!-- /codex-event -->
