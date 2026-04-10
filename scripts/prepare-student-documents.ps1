[CmdletBinding()]
param(
  [string]$ManifestPath,
  [string]$SourceDir,
  [string]$OutputDir,
  [string]$BucketName = "xflexwithai-videos",
  [switch]$UploadToR2,
  [switch]$ApplyD1
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
  $ManifestPath = Join-Path $scriptRoot "student-documents.manifest.json"
}

if (-not $OutputDir) {
  $OutputDir = Join-Path $scriptRoot "generated\student-documents"
}

function Ensure-Directory {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
}

function Escape-SqlLiteral {
  param([AllowNull()][string]$Value)

  if ($null -eq $Value) {
    return "NULL"
  }

  return "'" + $Value.Replace("'", "''") + "'"
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
  throw "SourceDir is required. Pass -SourceDir or set sourceDir locally in scripts/student-documents.manifest.json."
}

if (-not (Test-Path -LiteralPath $SourceDir)) {
  throw "Source documents folder not found: $SourceDir"
}

if (-not $manifest.documents -or $manifest.documents.Count -eq 0) {
  throw "The manifest does not contain any documents."
}

$objectPrefix = $manifest.objectPrefix
$pdfDir = Join-Path $OutputDir "pdf"
$sqlOutputPath = Join-Path $OutputDir "student-documents.seed.sql"
$zipInfo = $manifest.bulkArchive
$zipPath = Join-Path $OutputDir $zipInfo.fileName

if (Test-Path -LiteralPath $OutputDir) {
  Remove-Item -LiteralPath $OutputDir -Recurse -Force
}

Ensure-Directory $OutputDir
Ensure-Directory $pdfDir

$word = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
}
catch {
  throw "Microsoft Word COM automation is not available. Convert the DOCX files to PDF manually or run this script on a machine with Microsoft Word installed."
}

$preparedDocuments = @()

try {
  foreach ($entry in $manifest.documents) {
    $sourcePath = Join-Path $SourceDir $entry.sourceFile
    if (-not (Test-Path -LiteralPath $sourcePath)) {
      throw "Source file not found: $sourcePath"
    }

    $pdfPath = Join-Path $pdfDir ("{0}.pdf" -f $entry.slug)
    Convert-DocxToPdf -SourcePath $sourcePath -TargetPath $pdfPath -WordApp $word

    if (-not (Test-Path -LiteralPath $pdfPath)) {
      throw "PDF conversion failed for: $sourcePath"
    }

    $pdfFile = Get-Item -LiteralPath $pdfPath
    $preparedDocuments += [PSCustomObject]@{
      slug = [string]$entry.slug
      titleEn = [string]$entry.titleEn
      titleAr = [string]$entry.titleAr
      descriptionEn = [string]$entry.descriptionEn
      descriptionAr = [string]$entry.descriptionAr
      sortOrder = [int]$entry.sortOrder
      objectKey = "$objectPrefix/$($entry.slug).pdf"
      originalFileName = "{0}.pdf" -f $entry.slug
      mimeType = "application/pdf"
      fileSizeBytes = [int64]$pdfFile.Length
      localPath = $pdfPath
      isBulkArchive = 0
    }
  }
}
finally {
  if ($word) {
    $word.Quit()
    [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($word)
  }
}

Compress-Archive -LiteralPath ($preparedDocuments.localPath) -DestinationPath $zipPath -Force

$zipFile = Get-Item -LiteralPath $zipPath
$bulkDocument = [PSCustomObject]@{
  slug = [string]$zipInfo.slug
  titleEn = [string]$zipInfo.titleEn
  titleAr = [string]$zipInfo.titleAr
  descriptionEn = [string]$zipInfo.descriptionEn
  descriptionAr = [string]$zipInfo.descriptionAr
  sortOrder = [int]$zipInfo.sortOrder
  objectKey = "$objectPrefix/$($zipInfo.fileName)"
  originalFileName = [string]$zipInfo.fileName
  mimeType = "application/zip"
  fileSizeBytes = [int64]$zipFile.Length
  localPath = $zipPath
  isBulkArchive = 1
}

$sqlLines = New-Object System.Collections.Generic.List[string]

foreach ($document in ($preparedDocuments + $bulkDocument)) {
  $sqlLines.Add(@"
INSERT INTO studentDocuments (
  titleEn,
  titleAr,
  descriptionEn,
  descriptionAr,
  objectKey,
  originalFileName,
  mimeType,
  fileSizeBytes,
  sortOrder,
  isPublished,
  isBulkArchive,
  updatedAt
) VALUES (
  $(Escape-SqlLiteral $document.titleEn),
  $(Escape-SqlLiteral $document.titleAr),
  $(Escape-SqlLiteral $document.descriptionEn),
  $(Escape-SqlLiteral $document.descriptionAr),
  $(Escape-SqlLiteral $document.objectKey),
  $(Escape-SqlLiteral $document.originalFileName),
  $(Escape-SqlLiteral $document.mimeType),
  $($document.fileSizeBytes),
  $($document.sortOrder),
  1,
  $($document.isBulkArchive),
  CURRENT_TIMESTAMP
) ON CONFLICT(objectKey) DO UPDATE SET
  titleEn = excluded.titleEn,
  titleAr = excluded.titleAr,
  descriptionEn = excluded.descriptionEn,
  descriptionAr = excluded.descriptionAr,
  originalFileName = excluded.originalFileName,
  mimeType = excluded.mimeType,
  fileSizeBytes = excluded.fileSizeBytes,
  sortOrder = excluded.sortOrder,
  isPublished = 1,
  isBulkArchive = excluded.isBulkArchive,
  updatedAt = CURRENT_TIMESTAMP;
"@.Trim())
}
Set-Content -LiteralPath $sqlOutputPath -Value ($sqlLines -join [Environment]::NewLine + [Environment]::NewLine) -Encoding UTF8

if ($UploadToR2) {
  foreach ($document in ($preparedDocuments + $bulkDocument)) {
    Write-Host "Uploading $($document.localPath) -> $($document.objectKey)"
    Invoke-ExternalCommand -FilePath "npx" -Arguments @(
      "wrangler",
      "r2",
      "object",
      "put",
      "$BucketName/$($document.objectKey)",
      "--file",
      $document.localPath,
      "--content-type",
      $document.mimeType,
      "--remote",
      "--config",
      "wrangler-worker.toml",
      "--env",
      "production"
    ) -FailureMessage "Failed to upload $($document.objectKey) to R2."
  }
}

if ($ApplyD1) {
  Write-Host "Applying D1 seed SQL: $sqlOutputPath"
  Invoke-ExternalCommand -FilePath "npx" -Arguments @(
    "wrangler",
    "d1",
    "execute",
    "xflexwithai-db",
    "--remote",
    "--config",
    "wrangler-worker.toml",
    "--env",
    "production",
    "--file",
    $sqlOutputPath
  ) -FailureMessage "Failed to apply the student documents SQL to D1."
}

Write-Host "Prepared $($preparedDocuments.Count) PDF documents."
Write-Host "PDF output: $pdfDir"
Write-Host "ZIP output: $zipPath"
Write-Host "SQL output: $sqlOutputPath"

if (-not $UploadToR2) {
  Write-Host "R2 upload was skipped. Re-run with -UploadToR2 to push the prepared files."
}

if (-not $ApplyD1) {
  Write-Host "D1 apply was skipped. Re-run with -ApplyD1 after the files are uploaded."
}