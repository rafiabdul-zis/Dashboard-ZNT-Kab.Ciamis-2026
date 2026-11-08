# =============================================================================
# SCRIPT SINKRONISASI & PEMBARUAN DATA SURVEI SIPENTA KE DASHBOARD ZNT CIAMIS
# =============================================================================
param(
    [string]$InputPath = ""
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$projectDir = Split-Path -Parent $scriptDir
$dataDir = Join-Path $projectDir "data"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   SINKRONISASI DATA SIPENTA - DASHBOARD ZNT CIAMIS 2026  " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Cari file CSV / input terbaru jika tidak ditentukan
if ([string]::IsNullOrWhiteSpace($InputPath)) {
    $downloads = Join-Path $env:USERPROFILE "Downloads"
    $candidates = Get-ChildItem -Path $downloads -Filter "*sipenta*.csv" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
    if (!$candidates -or $candidates.Count -eq 0) {
        $candidates = Get-ChildItem -Path $downloads -Filter "*titik*.csv" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending
    }

    if ($candidates -and $candidates.Count -gt 0) {
        $InputPath = $candidates[0].FullName
        Write-Host "Ditemukan file survei terbaru di Downloads: $($candidates[0].Name)" -ForegroundColor Yellow
    } else {
        $InputPath = Join-Path $dataDir "titik_sampel_with_nozn.csv"
        Write-Host "Menggunakan file data default: $InputPath" -ForegroundColor Gray
    }
}

if (!(Test-Path $InputPath)) {
    Write-Host "❌ File input tidak ditemukan: $InputPath" -ForegroundColor Red
    exit 1
}

Write-Host "Memproses data dari: $InputPath..." -ForegroundColor Cyan
$csvData = Import-Csv -Path $InputPath

# Memuat zona GeoJSON eksisting untuk peremajaan atribut QC SIPENTA
$zonePath = Join-Path $dataDir "ZONA_CIAMIS.geojson"
$zoneJson = Get-Content $zonePath -Raw -Encoding UTF8 | ConvertFrom-Json

# Hitung statistik per zona (Rata-rata, Standar Deviasi, RSD)
$zonePointsMap = @{}
$sampleFeatures = @()

foreach ($row in $csvData) {
    $nozn = "$($row.NOZN)".Trim()
    if (![string]::IsNullOrEmpty($nozn)) {
        if (!$zonePointsMap.ContainsKey($nozn)) {
            $zonePointsMap[$nozn] = @()
        }
        $val = [double]0
        if ([double]::TryParse($row.NilaiPerM2, [ref]$val)) {
            $zonePointsMap[$nozn] += $val
        }
    }

    $x = [double]0; [double]::TryParse($row.X, [ref]$x) | Out-Null
    $y = [double]0; [double]::TryParse($row.Y, [ref]$y) | Out-Null

    $feat = @{
        type = "Feature"
        properties = $row
        geometry = @{
            type = "Point"
            coordinates = @($x, $y)
        }
    }
    $sampleFeatures += $feat
}

# Update Kualitas Data (QC SIPENTA) pada Poligon Zona
foreach ($f in $zoneJson.features) {
    $nozn = "$($f.properties.NOZN)".Trim()
    $luasHa = [double]($f.properties.Luas_Ha)
    $target = if ($luasHa -ge 1250) { 5 } elseif ($luasHa -ge 900) { 4 } else { 3 }

    if ($zonePointsMap.ContainsKey($nozn) -and $zonePointsMap[$nozn].Count -gt 0) {
        $vals = $zonePointsMap[$nozn]
        $n = $vals.Count
        $mean = ($vals | Measure-Object -Average).Average
        
        $variance = 0
        if ($n -gt 1) {
            foreach ($v in $vals) { $variance += [Math]::Pow($v - $mean, 2) }
            $variance = $variance / ($n - 1)
        }
        $sd = [Math]::Sqrt($variance)
        $rsd = if ($mean -gt 0) { ($sd / $mean) * 100 } else { 0 }

        $f.properties.Rata_Nilai = [Math]::Round($mean)
        $f.properties.RSD_Persen = [Math]::Round($rsd, 2)

        if ($n -ge $target) {
            if ($rsd -le 30 -and $rsd -gt 0) {
                $f.properties.Status_QC = "Lengkap & Valid (RSD ≤ 30%)"
                $f.properties.Zoning_Sampel = "Terpenuhi"
            } else {
                $f.properties.Status_QC = "Perlu Revisi (RSD > 30%)"
                $f.properties.Zoning_Sampel = "Revisi Titik"
            }
        } else {
            $f.properties.Status_QC = "Kurang Lengkap (Tunggu Min 3 Titik)"
            $f.properties.Zoning_Sampel = "Belum Cukup"
        }
    } else {
        $f.properties.Rata_Nilai = 0
        $f.properties.RSD_Persen = 0
        $f.properties.Status_QC = "Belum Disurvey"
        $f.properties.Zoning_Sampel = "-"
    }
}

# Simpan pembaruan ke ZONA_CIAMIS.geojson
$zoneUpdatedJsonStr = $zoneJson | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText($zonePath, $zoneUpdatedJsonStr, [System.Text.Encoding]::UTF8)

# Simpan pembaruan ke titik_sampel_with_nozn.geojson
$ptsGeoJson = @{
    type = "FeatureCollection"
    features = $sampleFeatures
}
$ptsUpdatedJsonStr = $ptsGeoJson | ConvertTo-Json -Depth 6
$ptsGeoJsonPath = Join-Path $dataDir "titik_sampel_with_nozn.geojson"
[System.IO.File]::WriteAllText($ptsGeoJsonPath, $ptsUpdatedJsonStr, [System.Text.Encoding]::UTF8)

# Simpan ke data_embedded.js
$aplPath = Join-Path $dataDir "APL_CIAMIS.geojson"
$aplJsonStr = if (Test-Path $aplPath) { Get-Content $aplPath -Raw -Encoding UTF8 } else { '{"type":"FeatureCollection","features":[]}' }
$embeddedJs = @"
window.CIAMIS_DATA = {
  zones: $zoneUpdatedJsonStr,
  apl: $aplJsonStr,
  points: $ptsUpdatedJsonStr
};
"@
$embeddedPath = Join-Path $dataDir "data_embedded.js"
[System.IO.File]::WriteAllText($embeddedPath, $embeddedJs, [System.Text.Encoding]::UTF8)

Write-Host "✅ Pembaruan berhasil disimpan!" -ForegroundColor Green
Write-Host "Total Titik: $($sampleFeatures.Count)" -ForegroundColor Yellow
Write-Host "Total Zona Terdata: $($zoneJson.features.Count)" -ForegroundColor Yellow
Write-Host "Silakan muat ulang (refresh) browser dashboard Anda." -ForegroundColor Cyan
