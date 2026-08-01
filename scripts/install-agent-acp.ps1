param(
  [ValidateSet("auto", "npm", "binary", "cargo")]
  [string]$CodexAcp = $(if ($env:OMNIHARNESS_CODEX_ACP_INSTALL) { $env:OMNIHARNESS_CODEX_ACP_INSTALL } else { "auto" }),
  [string]$ReleaseRepo = $(if ($env:OMNIHARNESS_CODEX_ACP_RELEASE_REPO) { $env:OMNIHARNESS_CODEX_ACP_RELEASE_REPO } else { "danduma/omniharness" }),
  [string]$ReleaseTag = $(if ($env:OMNIHARNESS_CODEX_ACP_RELEASE_TAG) { $env:OMNIHARNESS_CODEX_ACP_RELEASE_TAG } else { "codex-acp-latest" }),
  [string]$DownloadBaseUrl = $env:OMNIHARNESS_CODEX_ACP_DOWNLOAD_BASE_URL,
  [string]$InstallDir = $env:OMNIHARNESS_CODEX_ACP_INSTALL_DIR,
  [string]$NpmRoot = $env:OMNIHARNESS_CODEX_ACP_NPM_ROOT,
  [switch]$EnsureOnly,
  [switch]$DryRun,
  [switch]$AddToPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $DownloadBaseUrl) {
  $DownloadBaseUrl = "https://github.com/$ReleaseRepo/releases/download/$ReleaseTag"
}

if (-not $InstallDir) {
  if ($env:LOCALAPPDATA) {
    $InstallDir = Join-Path $env:LOCALAPPDATA "OmniHarness\bin"
  } else {
    $InstallDir = Join-Path $HOME ".omniharness\bin"
  }
}

if (-not $NpmRoot) {
  if ($env:LOCALAPPDATA) {
    $NpmRoot = Join-Path $env:LOCALAPPDATA "OmniHarness\codex-acp"
  } else {
    $NpmRoot = Join-Path $HOME ".omniharness\codex-acp"
  }
}

function Test-Command {
  param([string]$Name)
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-CodexAcpTarget {
  if ($env:OS -ne "Windows_NT") {
    throw "Prebuilt codex-acp PowerShell install currently supports Windows only."
  }

  switch ($env:PROCESSOR_ARCHITECTURE) {
    "AMD64" { return "windows-x64" }
    "x86_64" { return "windows-x64" }
    default {
      throw "Unsupported Windows architecture: $env:PROCESSOR_ARCHITECTURE"
    }
  }
}

function Install-CodexAcpBinary {
  $target = Get-CodexAcpTarget
  $assetName = "codex-acp-$target.exe"
  $checksumName = "$assetName.sha256"
  $downloadUrl = "$DownloadBaseUrl/$assetName"
  $checksumUrl = "$DownloadBaseUrl/$checksumName"
  $installPath = Join-Path $InstallDir "codex-acp.exe"

  if ($DryRun) {
    Write-Host "  -> would install prebuilt codex-acp from $downloadUrl to $installPath"
    return
  }

  New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
  $tmpPath = Join-Path $InstallDir "codex-acp.tmp.exe"
  $tmpChecksumPath = Join-Path $InstallDir "codex-acp.tmp.exe.sha256"

  Write-Host "  -> downloading prebuilt codex-acp for $target"
  Invoke-WebRequest -Uri $downloadUrl -OutFile $tmpPath
  Invoke-WebRequest -Uri $checksumUrl -OutFile $tmpChecksumPath

  $expectedLine = (Get-Content -Raw -Path $tmpChecksumPath).Trim()
  $expectedHash = ($expectedLine -split "\s+")[0].ToLowerInvariant()
  $actualHash = (Get-FileHash -Algorithm SHA256 -Path $tmpPath).Hash.ToLowerInvariant()

  if ($actualHash -ne $expectedHash) {
    Remove-Item -Force -ErrorAction SilentlyContinue $tmpPath, $tmpChecksumPath
    throw "Checksum mismatch for $assetName. Expected $expectedHash but got $actualHash."
  }

  Move-Item -Force -Path $tmpPath -Destination $installPath
  Remove-Item -Force -ErrorAction SilentlyContinue $tmpChecksumPath
  Write-Host "  -> installed prebuilt codex-acp at $installPath"
}

function Install-CodexAcpCargo {
  if ($DryRun) {
    Write-Host "  -> would install codex-acp with cargo install --locked --git https://github.com/danduma/codex-acp.git --branch main codex-acp"
    return
  }

  if (-not (Test-Command "cargo")) {
    throw "Cannot install codex-acp with Cargo because cargo is not on PATH."
  }

  cargo install --locked --git "https://github.com/danduma/codex-acp.git" --branch "main" "codex-acp"
  Write-Host "  -> installed codex-acp with Cargo"
}

function Get-InstalledNpmVersion {
  param([string]$PackageName)
  $packageJson = Join-Path $NpmRoot "node_modules\$PackageName\package.json"
  if (-not (Test-Path -LiteralPath $packageJson -PathType Leaf)) {
    return $null
  }
  return (Get-Content -Raw -LiteralPath $packageJson | ConvertFrom-Json).version
}

function Test-CodexAcpNpmOutdated {
  $installedAcp = Get-InstalledNpmVersion "@agentclientprotocol\codex-acp"
  $installedCodex = Get-InstalledNpmVersion "@openai\codex"
  if (-not $installedAcp -or -not $installedCodex) {
    return $true
  }
  try {
    $latestAcp = (npm view "@agentclientprotocol/codex-acp" version --silent).Trim()
    $latestCodex = (npm view "@openai/codex" version --silent).Trim()
    return $installedAcp -ne $latestAcp -or $installedCodex -ne $latestCodex
  } catch {
    return $false
  }
}

function Install-CodexAcpNpm {
  $launcherSource = Join-Path $PSScriptRoot "codex-acp-launcher.cmd"
  $launcherPath = Join-Path $InstallDir "codex-acp.cmd"
  if ($DryRun) {
    Write-Host "  -> would install the latest official Codex ACP adapter and Codex CLI at $NpmRoot"
    Write-Host "  -> would install its launcher at $launcherPath"
    return
  }
  if (-not (Test-Command "npm") -or -not (Test-Command "node")) {
    throw "The official Codex ACP install requires npm and node on PATH."
  }
  if (-not (Test-Path -LiteralPath $launcherSource -PathType Leaf)) {
    throw "Missing Codex ACP launcher: $launcherSource"
  }
  New-Item -ItemType Directory -Force -Path $NpmRoot, $InstallDir | Out-Null
  npm install --prefix $NpmRoot "@agentclientprotocol/codex-acp@latest" "@openai/codex@latest"
  Copy-Item -LiteralPath $launcherSource -Destination $launcherPath -Force
  Write-Host "  -> installed official codex-acp $(Get-InstalledNpmVersion '@agentclientprotocol\codex-acp') with Codex $(Get-InstalledNpmVersion '@openai\codex')"
}

function Add-InstallDirToUserPath {
  $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $parts = @()
  if ($currentPath) {
    $parts = $currentPath -split ";"
  }

  if ($parts -contains $InstallDir) {
    Write-Host "  -> install directory is already on the user PATH"
    return
  }

  if ($DryRun) {
    Write-Host "  -> would add $InstallDir to the user PATH"
    return
  }

  $nextPath = if ($currentPath) { "$currentPath;$InstallDir" } else { $InstallDir }
  [Environment]::SetEnvironmentVariable("Path", $nextPath, "User")
  Write-Host "  -> added $InstallDir to the user PATH; restart terminals to pick it up"
}

Write-Host "Detecting local coding agents and ACP adapters..."

if (Test-Command "codex") {
  Write-Host "codex: detected"
} else {
  Write-Host "codex: not detected"
}

if ((Test-Command "codex-acp") -or (Test-Command "codex-acp.exe")) {
  if ($EnsureOnly) {
    if (($CodexAcp -eq "auto" -or $CodexAcp -eq "npm") -and (Test-CodexAcpNpmOutdated)) {
      Write-Host "  -> managed codex-acp or Codex CLI is outdated; refreshing both"
      Install-CodexAcpNpm
    } else {
      Write-Host "  -> codex-acp already installed and current"
    }
  } else {
    Write-Host "  -> codex-acp already installed; refreshing the requested install"
    switch ($CodexAcp) {
      "cargo" { Install-CodexAcpCargo }
      "binary" { Install-CodexAcpBinary }
      default { Install-CodexAcpNpm }
    }
  }
} else {
  switch ($CodexAcp) {
    "cargo" { Install-CodexAcpCargo }
    "binary" { Install-CodexAcpBinary }
    default {
      try {
        Install-CodexAcpNpm
      } catch {
        if ($CodexAcp -eq "npm") {
          throw
        }
        Write-Warning $_
        Install-CodexAcpBinary
      }
    }
  }
}

if ($AddToPath) {
  Add-InstallDirToUserPath
}

Write-Host "Done."
