# Changelog

All notable OmniHarness distribution and runtime setup changes should be tracked
here.

## Unreleased

### Added

- Added binary-first `codex-acp` installation for macOS/Linux on arm64 and x64.
- Added a GitHub Actions workflow to build and publish prebuilt `codex-acp`
  release assets.
- Added explicit Codex ACP installer modes: `binary`, `cargo`, and `docker`.
- Added Docker/Podman-backed `codex-acp` wrapper support as a fallback.

### Changed

- Changed the Codex ACP installer default from host Rust compilation to
  prebuilt binary download, with Docker and Cargo fallback paths.
- Documented the supported ACP adapter inventory: Codex uses `codex-acp`,
  Claude uses the npm `claude-agent-acp` package, Gemini uses
  `gemini --experimental-acp`, and OpenCode uses `opencode acp`.
