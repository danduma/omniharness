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

For automation, the existing `OMNIHARNESS_AUTH_PASSWORD` environment variable
provides the password to the running process without writing or echoing the
plaintext. Interactive first-run setup continues to hash a chosen or generated
password into `.env`. A non-interactive launch with no password configured uses
the existing generated-password path and prints that password once after setup;
CI always supplies `OMNIHARNESS_AUTH_PASSWORD` and therefore never prompts or
prints a generated credential.

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
interface artifact. It hashes the selected interface inputs, build configuration,
package manifest, and lockfile and compares that value with
`dist/interface/.build-state.json`. A missing interface document, missing
marker, incomplete asset graph, or hash mismatch requires a build. The marker
is written only after a successful build. The shell launcher uses that helper,
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
configuration. It refuses unrelated existing Serve configuration even with
`--force`; that option applies only to conflicting OmniHarness `.env` values.
It never enables Tailscale Funnel and never exposes the ACP
bridge. If Tailscale is missing, logged out, lacks Serve/HTTPS permission, or
requires an administrator/operator action, it exits with the original Tailscale
error plus the appropriate next action. A failed Serve command leaves `.env`
unchanged. If publishing the already-staged `.env` update fails after Serve was
created, the command disables only the HTTPS Serve listener it just created and
reports both failures. Re-running setup is safe. A tested `--reset` mode disables
the OmniHarness HTTPS Serve listener and removes only the two settings owned by
this setup command; it always refuses ambiguous or unrelated Serve state.

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
behavior, runner help, Tailscale status/configuration/conflict/rollback/env-file
behavior, environment loading, and ACP default documentation. A GitHub Actions
macOS installation job runs the real entry point from a fresh checkout, waits on
the real health endpoint, fetches the real interface document and one referenced
asset, verifies the build-state marker, and shuts the runner down. The existing
rolling ACP workflow remains separate and unchanged.

No browser-driving journey is required for this milestone: health and actual
HTML delivery prove the installation boundary without creating user data or
requiring a browser session.

## Acceptance Criteria

- A fresh macOS checkout starts through `./omniharness`.
- That entry point installs/builds the API-plus-interface deployment.
- Normal Codex ACP installation uses published npm packages and no compiler.
- `pnpm setup:tailscale` validates tailnet state, invokes the documented private
  HTTPS Serve command, persists the correct OmniHarness origin/bind settings,
  refuses conflicting deployments, and offers tested rollback/reset behavior.
  Automated release tests prove command construction and configuration behavior
  without mutating a CI or developer tailnet; the README includes an explicit
  real-tailnet success/status/reset check for the release operator.
- Tailscale is the first remote-access recommendation; public tunnels are
  secondary and clearly labeled.
- `pnpm runner -- --help` prints supported runner options and exits successfully.
- The automated macOS installation smoke check passes. No Linux or Windows
  installation check gates this milestone.

## North Star And Current Milestone

The north star is a trustworthy self-hosted agent control plane that a user can
install, privately connect to, update, and recover without understanding its
internal process topology. This milestone completes the macOS repository
installation and private Tailscale onboarding path. Linux-specific release
hardening, Windows installation, packaged OS services, and offline bundles remain
product direction, not claims made by this milestone.
