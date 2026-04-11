[CmdletBinding()]
param(
  [string]$ManifestPath,
  [string]$SourceDir,
  [string]$OutputDir,
  [string]$BucketName = "xflexwithai-videos",
  [switch]$UploadToR2
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptRoot = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($scriptRoot) -and -not [string]::IsNullOrWhiteSpace($PSCommandPath)) {
  $scriptRoot = Split-Path -Parent $PSCommandPath
}
if ([string]::IsNullOrWhiteSpace($scriptRoot)) {
  $scriptRoot = (Get-Location).Path
}

if (-not $ManifestPath) {
  $ManifestPath = Join-Path $scriptRoot "free-library.manifest.json"
}

if (-not $OutputDir) {
  $OutputDir = Join-Path $scriptRoot "generated\free-library"
}

function Ensure-Directory {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
}

function Invoke-ExternalCommand {
  param(
    [string]$FilePath,
    [string[]]$Arguments,
    [string]$FailureMessage
  )

  & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw $FailureMessage
  }
}

function Convert-DocxToPdf {
  param(
    [string]$SourcePath,
    [string]$TargetPath,
    $WordApp
  )

  $document = $null
  try {
    try {
      $document = $WordApp.Documents.Open($SourcePath, $false, $true)
    }
    catch {
      Write-Host "Word reported an issue while opening '$SourcePath'. Retrying with repair mode..."
      $document = $WordApp.Documents.Open($SourcePath, $false, $true, $false, '', '', $false, '', '', 0, 0, $false, $true)
    }

    $document.ExportAsFixedFormat($TargetPath, 17)
  }
  finally {
    if ($document) {
      $document.Close($false)
      [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($document)
    }
  }
}

$manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json -Depth 8

if (-not $SourceDir) {
  $SourceDir = $manifest.sourceDir
}

if ([string]::IsNullOrWhiteSpace($SourceDir)) {
  throw "SourceDir is required. Pass -SourceDir or set sourceDir locally in scripts/free-library.manifest.json."
}

if (-not (Test-Path -LiteralPath $SourceDir)) {
  throw "Source documents folder not found: $SourceDir"
}

if (Test-Path -LiteralPath $OutputDir) {
  Remove-Item -LiteralPath $OutputDir -Recurse -Force
}

Ensure-Directory $OutputDir

$preparedFiles = @()

if ($manifest.document) {
  $documentSourcePath = Join-Path $SourceDir $manifest.document.sourceFile
  if (-not (Test-Path -LiteralPath $documentSourcePath)) {
    throw "Source free-library DOCX not found: $documentSourcePath"
  }

  $pdfOutputPath = Join-Path $OutputDir $manifest.document.outputFileName

  $word = $null
  try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    Convert-DocxToPdf -SourcePath $documentSourcePath -TargetPath $pdfOutputPath -WordApp $word
  }
  finally {
    if ($word) {
      $word.Quit()
      [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($word)
    }
  }

  if (-not (Test-Path -LiteralPath $pdfOutputPath)) {
    throw "PDF conversion failed for: $documentSourcePath"
  }

  $preparedFiles += [PSCustomObject]@{
    localPath = $pdfOutputPath
    objectKey = [string]$manifest.document.objectKey
    contentType = "application/pdf"
  }
}

foreach ($video in $manifest.videos) {
  $videoSourcePath = Join-Path $SourceDir $video.sourceFile
  if (-not (Test-Path -LiteralPath $videoSourcePath)) {
    throw "Source free-library video not found: $videoSourcePath"
  }

  $preparedFiles += [PSCustomObject]@{
    localPath = $videoSourcePath
    objectKey = [string]$video.objectKey
    contentType = [string]$video.contentType
  }
}

Write-Host "Prepared free-library assets:"
foreach ($file in $preparedFiles) {
  $item = Get-Item -LiteralPath $file.localPath
  Write-Host "- $($file.objectKey) [$([Math]::Round($item.Length / 1MB, 2)) MB]"
}

if ($UploadToR2) {
  foreach ($file in $preparedFiles) {
    Write-Host "Uploading $($file.localPath) -> $($file.objectKey)"
    Invoke-ExternalCommand -FilePath "npx" -Arguments @(
      "wrangler",
      "r2",
      "object",
      "put",
      "$BucketName/$($file.objectKey)",
      "--file",
      $file.localPath,
      "--content-type",
      $file.contentType,
      "--remote",
      "--config",
      "wrangler-worker.toml",
      "--env",
      "production"
    ) -FailureMessage "Failed to upload $($file.objectKey) to R2."
  }
}

if ($manifest.document) {
  Write-Host "PDF output: $pdfOutputPath"
}

if (-not $UploadToR2) {
  Write-Host "R2 upload was skipped. Re-run with -UploadToR2 to push the prepared files."
}