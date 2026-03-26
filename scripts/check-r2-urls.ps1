$base = "https://videos.xflexacademy.com/media/Courses/Trading_Course/1st_level/"

# Episode 1 (working) - from tradingCourseSeed.ts
$ep1 = $base + [Uri]::EscapeDataString("المرحلة الأولى - 1 - محتويات الكورس.mp4")

# Episode 4 (broken) - from tradingCourseSeed.ts  
$ep4 = $base + [Uri]::EscapeDataString("المرحلة الأولى - 4 - شرح أهم مصطلحات التداول.mp4")

# Episode 4 alternate - zero padded
$ep4_padded = $base + [Uri]::EscapeDataString("المرحلة الأولى - 04 - شرح أهم مصطلحات التداول.mp4")

# Episode 4 alternate - no hamza
$ep4_nohamza = $base + [Uri]::EscapeDataString("المرحلة الاولى - 4 - شرح أهم مصطلحات التداول.mp4")

# Episode 4 alternate - from populate_course_complete.ts (no hamza + zero padded + different title)
$ep4_populate = $base + [Uri]::EscapeDataString("المرحلة الاولى - 04 - الاطر الزمنية.mp4")

# Episode 4 - no hamza + zero padded + same title as seed
$ep4_nohamza_padded = $base + [Uri]::EscapeDataString("المرحلة الاولى - 04 - شرح أهم مصطلحات التداول.mp4")

$urls = @(
    @{Name="Ep1 (seed, working)"; Url=$ep1},
    @{Name="Ep4 (seed, broken)"; Url=$ep4},
    @{Name="Ep4 (zero-padded)"; Url=$ep4_padded},
    @{Name="Ep4 (no hamza)"; Url=$ep4_nohamza},
    @{Name="Ep4 (populate script)"; Url=$ep4_populate},
    @{Name="Ep4 (no hamza+padded)"; Url=$ep4_nohamza_padded}
)

foreach ($u in $urls) {
    try {
        $resp = Invoke-WebRequest -Uri $u.Url -Method Head -UseBasicParsing -ErrorAction Stop
        Write-Host "$($u.Name): $($resp.StatusCode) OK  ContentType=$($resp.Headers['Content-Type'])" -ForegroundColor Green
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        Write-Host "$($u.Name): $code" -ForegroundColor Red
    }
    Write-Host "  URL: $($u.Url)"
    Write-Host ""
}
