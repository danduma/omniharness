@echo off
setlocal

if defined OMNIHARNESS_CODEX_ACP_NPM_ROOT (
  set "INSTALL_ROOT=%OMNIHARNESS_CODEX_ACP_NPM_ROOT%"
) else (
  set "INSTALL_ROOT=%LOCALAPPDATA%\OmniHarness\codex-acp"
)

set "ADAPTER=%INSTALL_ROOT%\node_modules\@agentclientprotocol\codex-acp\dist\index.js"
set "CURRENT_CODEX=%INSTALL_ROOT%\node_modules\.bin\codex.cmd"

if not exist "%ADAPTER%" (
  echo codex-acp is not installed at %INSTALL_ROOT%; run the agent setup script. 1>&2
  exit /b 127
)

if not defined CODEX_PATH if exist "%CURRENT_CODEX%" set "CODEX_PATH=%CURRENT_CODEX%"

node "%ADAPTER%" %*
