[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$SourceDir,
  [string]$OutputDir = 'output/client-guides',
  [switch]$UploadToR2
)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'client-guides.manifest.json') -Raw | ConvertFrom-Json
$preparedRoot = [IO.Path]::GetFullPath((Join-Path $projectRoot $OutputDir))
if (!$preparedRoot.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Output must be inside the project workspace.' }
$posterRoot = Join-Path $projectRoot 'frontend/public/images/client-guides'
New-Item -ItemType Directory -Force $preparedRoot,$posterRoot | Out-Null
$prepared = @()
foreach ($video in $manifest.videos) {
  $source = Join-Path $SourceDir $video.sourceFile
  if (!(Test-Path -LiteralPath $source -PathType Leaf)) { throw "Missing guide source: $($video.slug)" }
  $destination = Join-Path $preparedRoot "$($video.slug).mp4"
  $arguments = @('-hide_banner','-loglevel','error','-i',$source)
  if ($video.privacyWindows.Count -gt 0) {
    $enabled = ($video.privacyWindows | ForEach-Object { 'between(t,' + $_[0].ToString([Globalization.CultureInfo]::InvariantCulture) + ',' + $_[1].ToString([Globalization.CultureInfo]::InvariantCulture) + ')' }) -join '+'
    $filter = "[0:v]split[base][copy];[copy]crop=iw:ih-220:0:220,boxblur=30:3[blur];[base][blur]overlay=0:220:enable='$enabled'[out]"
    $arguments += @('-filter_complex',$filter,'-map','[out]','-map','0:a:0','-c:v','libx264','-crf','18','-preset','fast','-pix_fmt','yuv420p','-c:a','copy')
  } else { $arguments += @('-map','0:v:0','-map','0:a:0','-c','copy') }
  $arguments += @('-movflags','+faststart','-y',$destination)
  & ffmpeg @arguments
  if ($LASTEXITCODE -ne 0) { throw "Video preparation failed: $($video.slug)" }
  $poster = Join-Path $posterRoot "$($video.slug).jpg"
  & ffmpeg -hide_banner -loglevel error -ss $video.posterAt -i $destination -frames:v 1 -vf 'crop=iw:ih-40:0:40,scale=320:-2' -q:v 3 -y $poster
  if ($LASTEXITCODE -ne 0) { throw "Poster extraction failed: $($video.slug)" }
  $probe = (& ffprobe -v error -show_entries 'format=duration:stream=codec_type,codec_name,width,height' -of json $destination | ConvertFrom-Json)
  $prepared += [pscustomobject]@{ slug=$video.slug; objectKey="client-guides/v1/$($video.slug).mp4"; fileSizeBytes=(Get-Item -LiteralPath $destination).Length; durationSeconds=[double]$probe.format.duration; sha256=(Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant(); privacyWindows=$video.privacyWindows; streams=$probe.streams }
  Write-Host "Prepared $($video.slug)"
  if ($UploadToR2) {
    & wrangler r2 object put "$($manifest.bucket)/client-guides/v1/$($video.slug).mp4" --file $destination --content-type video/mp4 --remote --config (Join-Path $projectRoot 'wrangler-worker.toml') --env production
    if ($LASTEXITCODE -ne 0) { throw "Upload failed: $($video.slug)" }
  }
}
$prepared | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $preparedRoot 'prepared-manifest.json') -Encoding utf8
