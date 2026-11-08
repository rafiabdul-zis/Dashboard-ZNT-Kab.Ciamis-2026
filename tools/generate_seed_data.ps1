# Generator script to create seed data for Ciamis ZNT Dashboard
$zones = @(
  @{ nozn = "01"; hist = "AA"; name = "Ciamis Kota (Pusat)"; surv = "Dadan Ramdani"; luas = 650; minLat = -7.332; maxLat = -7.322; minLon = 108.345; maxLon = 108.358; guna = "Perdagangan & Jasa"; qc = "Lengkap & Valid (RSD ≤ 30%)"; rata = 2150000; rsd = 12.8 },
  @{ nozn = "02"; hist = "AB"; name = "Ciamis Maleber"; surv = "Dadan Ramdani"; luas = 820; minLat = -7.338; maxLat = -7.330; minLon = 108.355; maxLon = 108.368; guna = "Permukiman Kepadatan Tinggi"; qc = "Lengkap & Valid (RSD ≤ 30%)"; rata = 1450000; rsd = 18.5 },
  @{ nozn = "03"; hist = "AC"; name = "Ciamis Kertasari"; surv = "Dadan Ramdani"; luas = 1100; minLat = -7.345; maxLat = -7.334; minLon = 108.338; maxLon = 108.352; guna = "Permukiman Campuran"; qc = "Perlu Revisi (RSD > 30%)"; rata = 980000; rsd = 34.2 },
  @{ nozn = "04"; hist = "AD"; name = "Ciamis Sindangrasa"; surv = "Dadan Ramdani"; luas = 1350; minLat = -7.325; maxLat = -7.315; minLon = 108.330; maxLon = 108.345; guna = "Permukiman & Jasa"; qc = "Kurang Lengkap (Tunggu Min 3 Titik)"; rata = 850000; rsd = 0 },

  @{ nozn = "05"; hist = "BA"; name = "Cikoneng Pusat"; surv = "Fitri Nurhaliza"; luas = 720; minLat = -7.315; maxLat = -7.302; minLon = 108.275; maxLon = 108.290; guna = "Perdagangan & Permukiman"; qc = "Lengkap & Valid (RSD ≤ 30%)"; rata = 1850000; rsd = 15.2 },
  @{ nozn = "06"; hist = "BB"; name = "Cikoneng Gegempalan"; surv = "Fitri Nurhaliza"; luas = 980; minLat = -7.302; maxLat = -7.290; minLon = 108.280; maxLon = 108.295; guna = "Permukiman Perdesaan"; qc = "Lengkap & Valid (RSD ≤ 30%)"; rata = 750000; rsd = 21.0 },
  @{ nozn = "07"; hist = "BC"; name = "Cikoneng Nasol"; surv = "Fitri Nurhaliza"; luas = 1400; minLat = -7.290; maxLat = -7.275; minLon = 108.270; maxLon = 108.288; guna = "Pertanian & Kebun"; qc = "Belum Disurvey"; rata = 0; rsd = 0 },

  @{ nozn = "08"; hist = "CA"; name = "Kawali Kota"; surv = "Yudi Pratama"; luas = 580; minLat = -7.195; maxLat = -7.182; minLon = 108.360; maxLon = 108.375; guna = "Pusat Kegiatan Lokal"; qc = "Lengkap & Valid (RSD ≤ 30%)"; rata = 1650000; rsd = 16.8 },
  @{ nozn = "09"; hist = "CB"; name = "Kawali Winduraja"; surv = "Yudi Pratama"; luas = 890; minLat = -7.185; maxLat = -7.172; minLon = 108.350; maxLon = 108.365; guna = "Permukiman"; qc = "Lengkap & Valid (RSD ≤ 30%)"; rata = 920000; rsd = 19.4 },
  @{ nozn = "10"; hist = "CC"; name = "Kawali Linggapura"; surv = "Yudi Pratama"; luas = 1280; minLat = -7.175; maxLat = -7.160; minLon = 108.360; maxLon = 108.378; guna = "Pertanian & Permukiman"; qc = "Perlu Revisi (RSD > 30%)"; rata = 650000; rsd = 36.1 },

  @{ nozn = "11"; hist = "DA"; name = "Panjalu Alun-alun"; surv = "Hendra Gunawan"; luas = 710; minLat = -7.145; maxLat = -7.132; minLon = 108.270; maxLon = 108.285; guna = "Pariwisata & Komersial"; qc = "Lengkap & Valid (RSD ≤ 30%)"; rata = 1950000; rsd = 14.1 },
  @{ nozn = "12"; hist = "DB"; name = "Panjalu Kertamandala"; surv = "Hendra Gunawan"; luas = 1050; minLat = -7.135; maxLat = -7.120; minLon = 108.260; maxLon = 108.275; guna = "Permukiman & Kebun"; qc = "Lengkap & Valid (RSD ≤ 30%)"; rata = 580000; rsd = 23.5 },
  @{ nozn = "13"; hist = "DC"; name = "Panjalu Hujungtiwu"; surv = "Hendra Gunawan"; luas = 1320; minLat = -7.125; maxLat = -7.110; minLon = 108.272; maxLon = 108.290; guna = "Pertanian Padi & Horti"; qc = "Belum Disurvey"; rata = 0; rsd = 0 },

  @{ nozn = "14"; hist = "EA"; name = "Banjarsari Kota"; surv = "Rina Agustina"; luas = 620; minLat = -7.535; maxLat = -7.522; minLon = 108.570; maxLon = 108.585; guna = "Perdagangan & Jasa"; qc = "Lengkap & Valid (RSD ≤ 30%)"; rata = 1750000; rsd = 17.5 },
  @{ nozn = "15"; hist = "EB"; name = "Banjarsari Cibadak"; surv = "Rina Agustina"; luas = 910; minLat = -7.548; maxLat = -7.535; minLon = 108.560; maxLon = 108.575; guna = "Permukiman"; qc = "Kurang Lengkap (Tunggu Min 3 Titik)"; rata = 820000; rsd = 0 },
  @{ nozn = "16"; hist = "EC"; name = "Banjarsari Cicapar"; surv = "Rina Agustina"; luas = 1450; minLat = -7.560; maxLat = -7.545; minLon = 108.570; maxLon = 108.590; guna = "Perkebunan & Pertanian"; qc = "Belum Disurvey"; rata = 0; rsd = 0 }
)

# 1. Generate ZONA_CIAMIS.geojson
$zoneFeatures = @()
foreach ($z in $zones) {
  $p1 = @($z.minLon, $z.minLat)
  $p2 = @($z.maxLon, $z.minLat)
  $p3 = @($z.maxLon, $z.maxLat)
  $p4 = @($z.minLon, $z.maxLat)
  $coords = @(@($p1, $p2, $p3, $p4, $p1))

  $feat = @{
    type = "Feature"
    properties = @{
      NOZN = $z.nozn
      HISTZONE = $z.hist
      Kecamatan = $z.name.Split(' ')[0]
      Surveyor = $z.surv
      Luas_Ha = $z.luas
      PENGGUNAAN = $z.guna
      Status_QC = $z.qc
      Rata_Nilai = $z.rata
      RSD_Persen = $z.rsd
      Zoning_Sampel = if ($z.qc -like "*Valid*") { "Terpenuhi" } else { "-" }
    }
    geometry = @{
      type = "Polygon"
      coordinates = $coords
    }
  }
  $zoneFeatures += $feat
}

$zoneGeoJson = @{
  type = "FeatureCollection"
  features = $zoneFeatures
}
$zoneJsonStr = $zoneGeoJson | ConvertTo-Json -Depth 6
[System.IO.File]::WriteAllText("C:\Users\Rafi\.gemini\antigravity\scratch\Dashboard-ZNT-Kab.Ciamis-2026\data\ZONA_CIAMIS.geojson", $zoneJsonStr, [System.Text.Encoding]::UTF8)

# 2. Generate APL_CIAMIS.geojson (Outline Batas Wilayah Ciamis)
$aplPolygon = @(
  @(108.20, -7.10), @(108.40, -7.05), @(108.48, -7.15), @(108.55, -7.30),
  @(108.62, -7.50), @(108.60, -7.62), @(108.45, -7.58), @(108.35, -7.45),
  @(108.25, -7.40), @(108.20, -7.25), @(108.20, -7.10)
)
$aplFeature = @{
  type = "FeatureCollection"
  features = @(
    @{
      type = "Feature"
      properties = @{ KABUPATEN = "CIAMIS"; PROVINSI = "JAWA BARAT" }
      geometry = @{
        type = "Polygon"
        coordinates = @($aplPolygon)
      }
    }
  )
}
$aplJsonStr = $aplFeature | ConvertTo-Json -Depth 6
[System.IO.File]::WriteAllText("C:\Users\Rafi\.gemini\antigravity\scratch\Dashboard-ZNT-Kab.Ciamis-2026\data\APL_CIAMIS.geojson", $aplJsonStr, [System.Text.Encoding]::UTF8)

# 3. Generate Sample Points (titik_sampel_with_nozn.geojson & CSV)
$samplePoints = @()
$csvRows = @()
$pointId = 1

$dates = @("2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08")
$jenisList = @("Transaksi", "Penawaran")
$objekList = @("Tanah Kosong", "Rumah Tinggal", "Ruko Komersial", "Kios Pasar")

foreach ($z in $zones) {
  # Determine number of points in this zone based on its status
  $numPoints = 0
  if ($z.qc -like "*Lengkap & Valid*") {
    $numPoints = if ($z.luas -ge 1250) { 5 } elseif ($z.luas -ge 900) { 4 } else { 3 }
    # add slight surplus to one of them
    if ($z.nozn -eq "01") { $numPoints = 4 }
  } elseif ($z.qc -like "*Perlu Revisi*") {
    $numPoints = if ($z.luas -ge 1250) { 5 } elseif ($z.luas -ge 900) { 4 } else { 3 }
  } elseif ($z.qc -like "*Kurang Lengkap*") {
    $numPoints = 1
  } else {
    $numPoints = 0
  }

  for ($i = 0; $i -lt $numPoints; $i++) {
    $rndLon = $z.minLon + (($z.maxLon - $z.minLon) * (0.15 + 0.7 * ($i + 0.5) / [Math]::Max($numPoints, 1)))
    $rndLat = $z.minLat + (($z.maxLat - $z.minLat) * (0.2 + 0.6 * (($i * 37) % 10) / 10.0))
    $tgl = $dates[($pointId + $i) % $dates.Count]
    $jenis = $jenisList[($pointId + $i) % 2]
    $objek = $objekList[($pointId + $i) % $objekList.Count]
    $luasM2 = 100 + (($pointId * 35) % 400)
    $hargaM2 = [Math]::Round($z.rata * (0.9 + 0.2 * (($i * 13) % 5) / 5.0))
    if ($hargaM2 -le 0) { $hargaM2 = 850000 }
    $hargaTotal = $luasM2 * $hargaM2
    $alamat = "Jl. Raya " + $z.name + " No. " + ($pointId * 7 % 120 + 1)

    $pProp = @{
      No = $pointId
      NOZN = $z.nozn
      HISTZONE = $z.hist
      Surveyor = $z.surv
      JenisData = $jenis
      Tgl = $tgl
      Alamat = $alamat
      Kelurahan = $z.name.Split(' ')[0]
      Kecamatan = $z.name.Split(' ')[0]
      Luas = $luasM2
      Harga = $hargaTotal
      NilaiPerM2 = $hargaM2
      GunaObjek = $objek
      Zoning = $z.guna
      X = [Math]::Round($rndLon, 6)
      Y = [Math]::Round($rndLat, 6)
    }

    $ptFeat = @{
      type = "Feature"
      properties = $pProp
      geometry = @{
        type = "Point"
        coordinates = @($pProp.X, $pProp.Y)
      }
    }
    $samplePoints += $ptFeat
    $csvRows += (New-Object PSObject -Property $pProp)

    $pointId++
  }
}

$pointsGeoJson = @{
  type = "FeatureCollection"
  features = $samplePoints
}
$ptsJsonStr = $pointsGeoJson | ConvertTo-Json -Depth 6
[System.IO.File]::WriteAllText("C:\Users\Rafi\.gemini\antigravity\scratch\Dashboard-ZNT-Kab.Ciamis-2026\data\titik_sampel_with_nozn.geojson", $ptsJsonStr, [System.Text.Encoding]::UTF8)

# Write CSV
$csvRows | Select-Object No, NOZN, HISTZONE, Surveyor, JenisData, Tgl, Alamat, Kelurahan, Kecamatan, Luas, Harga, NilaiPerM2, GunaObjek, Zoning, X, Y | Export-Csv -Path "C:\Users\Rafi\.gemini\antigravity\scratch\Dashboard-ZNT-Kab.Ciamis-2026\data\titik_sampel_with_nozn.csv" -NoTypeInformation -Encoding UTF8

# Write data_embedded.js for direct file:// browser support without web server
$embeddedJs = @"
window.CIAMIS_DATA = {
  zones: $zoneJsonStr,
  apl: $aplJsonStr,
  points: $ptsJsonStr
};
"@
[System.IO.File]::WriteAllText("C:\Users\Rafi\.gemini\antigravity\scratch\Dashboard-ZNT-Kab.Ciamis-2026\data\data_embedded.js", $embeddedJs, [System.Text.Encoding]::UTF8)

Write-Host "Created $($zoneFeatures.Count) zones and $($samplePoints.Count) sample points for Ciamis."
