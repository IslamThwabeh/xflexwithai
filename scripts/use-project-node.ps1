param([switch]$Install)

# Dot-source to activate in the caller's shell. Nothing changes the Windows/user PATH.
function Enable-XFlexProjectNode {
    param([switch]$InstallRuntime, [string]$ScriptsDirectory)

    $ErrorActionPreference = 'Stop'
    $runtimeProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $ScriptsDirectory '..'))
    $runtimeVersion = (Get-Content -LiteralPath (Join-Path $runtimeProjectRoot '.node-version') -Raw).Trim()
    if ($runtimeVersion -ne '24.22.1') {
        throw 'This installer only verifies Node 24.22.1. Update its reviewed checksums before selecting a different release.'
    }
    if ($env:PROCESSOR_ARCHITECTURE -ne 'AMD64') {
        throw 'This installer supports Windows x64 only. Use an approved version manager for another architecture.'
    }

    $runtimeArchiveName = "node-v$runtimeVersion-win-x64.zip"
    $runtimeArchiveSha256 = 'd2046d28c2c3dcd211ac5145c0bf30e2047ef9dfb306693c8c6e2eccd8b95fa5'
    $runtimeBinarySha256 = 'd702daa815eabbff763c7d3808e235cf031cf2ca70211b56847bc72f51e240e5'
    $runtimeCacheRoot = Join-Path $runtimeProjectRoot '.tools\node'
    $runtimeDirectory = Join-Path $runtimeCacheRoot "node-v$runtimeVersion-win-x64"
    $runtimeExecutable = Join-Path $runtimeDirectory 'node.exe'

    if (!(Test-Path -LiteralPath $runtimeExecutable)) {
        if (!$InstallRuntime) {
            throw 'Project Node is not installed. Run: . .\scripts\use-project-node.ps1 -Install'
        }
        if (Test-Path -LiteralPath $runtimeDirectory) {
            throw 'The runtime directory already exists but is incomplete. Inspect it before retrying; this installer will not overwrite it.'
        }
        [System.IO.Directory]::CreateDirectory($runtimeCacheRoot) | Out-Null
        $runtimeDownloadPath = Join-Path $runtimeCacheRoot (([guid]::NewGuid().ToString('N')) + '.zip')
        Write-Host "Downloading official Node $runtimeVersion (Windows x64)..."
        Invoke-WebRequest -Uri "https://nodejs.org/dist/v$runtimeVersion/$runtimeArchiveName" -OutFile $runtimeDownloadPath -UseBasicParsing -TimeoutSec 60
        if ((Get-FileHash -LiteralPath $runtimeDownloadPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $runtimeArchiveSha256) {
            throw 'Official Node archive checksum mismatch. Nothing was extracted or activated.'
        }
        Expand-Archive -LiteralPath $runtimeDownloadPath -DestinationPath $runtimeCacheRoot
    }

    # Verify cached binaries too, before running or selecting the runtime.
    if ((Get-FileHash -LiteralPath $runtimeExecutable -Algorithm SHA256).Hash.ToLowerInvariant() -ne $runtimeBinarySha256) {
        throw 'Project Node executable checksum mismatch. Nothing was activated.'
    }
    $runtimeReportedVersion = (& $runtimeExecutable --version)
    if ($LASTEXITCODE -ne 0 -or $runtimeReportedVersion.Trim() -ne "v$runtimeVersion") {
        throw 'Project Node version verification failed.'
    }
    $env:PATH = $runtimeDirectory + [System.IO.Path]::PathSeparator + $env:PATH
    Write-Host "Project shell now uses Node $runtimeVersion. System-wide Node and persistent PATH settings are unchanged."
}

Enable-XFlexProjectNode -InstallRuntime:$Install -ScriptsDirectory $PSScriptRoot
if ($MyInvocation.InvocationName -ne '.') {
    Write-Host 'For subsequent commands in this terminal, activate with: . .\scripts\use-project-node.ps1'
}
