/**
 * =============================================================================
 * DASHBOARD ZNT CIAMIS 2026 - MONITORING PENCAPAIAN TITIK SAMPEL SURVEYOR
 * =============================================================================
 * - Web GIS: Leaflet.js
 * - Charts: Chart.js
 * - Proyeksi: Proj4js (EPSG:23834 TM-3 Zone 48.2 & EPSG:23835 TM-3 Zone 49.1 -> WGS84)
 * - Peta Spasial: APL_CIAMIS & ZONA_CIAMIS
 * - Titik Sampel: titik_sampel_with_nozn.geojson & CSV
 * - Logika Target Luas: <900 Ha (3 pt) | 900-1250 Ha (4 pt) | >=1250 Ha (5 pt)
 * - Logika Capaian Aktual: Dibatasi maksimal target per zona (min(sampel, target))
 * - Evaluasi Kualitas Data: QC SIPENTA (RSD <= 30% & Min. 3 titik sampel)
 */

// =============================================================================
// 1. PROJ4JS DEFINISI TM-3 INDONESIA (BPN)
// =============================================================================
if (typeof proj4 !== 'undefined') {
  // TM-3 Zone 48.2 (Jawa Barat bagian timur / Ciamis, Meridian Sentral 108.5° BT)
  proj4.defs(
    "EPSG:23834",
    "+proj=tmerc +lat_0=0 +lon_0=108.5 +k=0.9999 +x_0=200000 +y_0=1500000 +ellps=WGS84 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs"
  );
  // TM-3 Zone 49.1 (Jawa Tengah bagian barat / Cilacap, Meridian Sentral 109.5° BT)
  proj4.defs(
    "EPSG:23835",
    "+proj=tmerc +lat_0=0 +lon_0=109.5 +k=0.9999 +x_0=200000 +y_0=1500000 +ellps=WGS84 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs"
  );
}

function reprojectCoords(coords) {
  if (!Array.isArray(coords)) return coords;
  if (typeof coords[0] === 'number') {
    if (Math.abs(coords[0]) > 180 || Math.abs(coords[1]) > 90) {
      if (typeof proj4 !== 'undefined') {
        try {
          // Coba proyeksi TM-3 Zone 48.2 (Ciamis) terlebih dahulu
          const p482 = proj4("EPSG:23834", "WGS84", [coords[0], coords[1]]);
          if (p482[0] >= 107.0 && p482[0] <= 110.0 && p482[1] >= -8.5 && p482[1] <= -6.0) {
            return [p482[0], p482[1]];
          }
          // Fallback ke Zone 49.1 jika berada di perbatasan timur
          const p491 = proj4("EPSG:23835", "WGS84", [coords[0], coords[1]]);
          return [p491[0], p491[1]];
        } catch (e) {
          console.warn("Gagal mentransformasikan koordinat:", coords, e);
        }
      }
    }
    return [coords[0], coords[1]];
  }
  return coords.map(reprojectCoords);
}

function normalizeToGeoJson(raw) {
  if (!raw) return null;
  if (raw.features && Array.isArray(raw.features) && raw.features.length > 0) {
    const first = raw.features[0];
    if (first.attributes || (first.geometry && (first.geometry.rings || first.geometry.paths || first.geometry.x !== undefined))) {
      const geoFeatures = [];
      raw.features.forEach(f => {
        const props = f.attributes || f.properties || {};
        let geom = null;
        if (f.geometry) {
          if (f.geometry.rings) {
            geom = { type: "Polygon", coordinates: reprojectCoords(f.geometry.rings) };
          } else if (f.geometry.paths) {
            geom = { type: "MultiLineString", coordinates: reprojectCoords(f.geometry.paths) };
          } else if (f.geometry.x !== undefined && f.geometry.y !== undefined) {
            geom = { type: "Point", coordinates: reprojectCoords([f.geometry.x, f.geometry.y]) };
          } else if (f.geometry.coordinates) {
            geom = { type: f.geometry.type || "Polygon", coordinates: reprojectCoords(f.geometry.coordinates) };
          }
        }
        if (geom) {
          geoFeatures.push({ type: "Feature", properties: props, attributes: props, geometry: geom });
        }
      });
      return { type: "FeatureCollection", features: geoFeatures };
    }
  }

  if (raw.features && Array.isArray(raw.features)) {
    raw.features.forEach(feature => {
      const p = feature.properties || feature.attributes || {};
      feature.properties = p;
      feature.attributes = p;
      if (feature.geometry && feature.geometry.coordinates) {
        feature.geometry.coordinates = reprojectCoords(feature.geometry.coordinates);
      }
    });
  }
  return raw;
}

// =============================================================================
// 2. STATE DATA GLOBAL & NORMALISASI NAMA SURVEYOR
// =============================================================================
let allZoneFeatures = [];         // Poligon Zona ZNT
let allSamplePoints = [];         // Titik Sampel
let zonePointsCountMap = {};      // { "01": 3, "02": 4, ... }
let polygonLayerGroup = null;
let pointsLayerGroup = null;
let aplLayerGroup = null;
let activeFilterSurveyor = 'default';
let colorMode = 'surveyor';       // 'surveyor' (Warna Surveyor), 'status' (Hijau/Kuning/Merah), 'qc' (Status QC SIPENTA)

function getCanonicalSurveyorName(rawName) {
  if (!rawName) return "";
  const lower = rawName.toLowerCase().trim();
  if (CONFIG && CONFIG.surveyors) {
    for (const s of CONFIG.surveyors) {
      if (s.name.toLowerCase() === lower || (s.aliases && s.aliases.some(a => lower === a || lower.includes(a) || a.includes(lower)))) {
        return s.name;
      }
    }
  }
  return rawName.trim();
}

function matchSurveyor(name1, name2) {
  if (!name1 || !name2) return false;
  return getCanonicalSurveyorName(name1) === getCanonicalSurveyorName(name2);
}

function getSurveyorColor(name) {
  if (!name) return "#64748b"; // Warna abu netral untuk area tanpa surveyor
  const canon = getCanonicalSurveyorName(name);
  if (CONFIG && CONFIG.surveyors) {
    const s = CONFIG.surveyors.find(item => item.name === canon);
    if (s && s.color) return s.color;
  }
  return "#64748b";
}

// =============================================================================
// 3. LOGIKA TARGET LUASAN ZNT
// =============================================================================
function getTargetForFeature(feature) {
  const p = (feature && feature.properties) ? feature.properties : {};
  let luasHa = null;

  if (p.Luas_Ha !== undefined && !isNaN(parseFloat(p.Luas_Ha))) {
    luasHa = parseFloat(p.Luas_Ha);
  } else if (p.LUAS_HA !== undefined && !isNaN(parseFloat(p.LUAS_HA))) {
    luasHa = parseFloat(p.LUAS_HA);
  } else if (p.Luas_M2 !== undefined && !isNaN(parseFloat(p.Luas_M2))) {
    luasHa = parseFloat(p.Luas_M2) / 10000;
  } else if (p.Shape_Area !== undefined && !isNaN(parseFloat(p.Shape_Area))) {
    luasHa = parseFloat(p.Shape_Area) / 10000;
  }

  if (luasHa === null || isNaN(luasHa)) {
    return { target: 3, luasHa: 0, bracket: '< 900 Ha (Default)' };
  }

  if (luasHa >= 1250) {
    return { target: 5, luasHa: luasHa, bracket: '≥ 1.250 Ha' };
  } else if (luasHa >= 900) {
    return { target: 4, luasHa: luasHa, bracket: '900 - 1.250 Ha' };
  } else {
    return { target: 3, luasHa: luasHa, bracket: '< 900 Ha' };
  }
}

function calculateTargetForFeatures(features) {
  if (!features || features.length === 0) return 0;
  let total = 0;
  features.forEach(f => {
    total += getTargetForFeature(f).target;
  });
  return total;
}

// =============================================================================
// 4. INISIALISASI GRAFIK (CHART.JS)
// =============================================================================
let donutChart = null;
let barChart = null;

function initCharts() {
  const ctxDonut = document.getElementById('donutSampleChart');
  if (ctxDonut) {
    donutChart = new Chart(ctxDonut.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Capaian Aktual (Maks)', 'Sisa Target'],
        datasets: [{
          data: [0, 100],
          backgroundColor: ['#10b981', '#1e293b'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '74%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => ` ${context.label}: ${context.parsed.toLocaleString('id-ID')} Titik`
            }
          }
        }
      }
    });
  }

  const ctxBar = document.getElementById('barDailyChart');
  if (ctxBar) {
    barChart = new Chart(ctxBar.getContext('2d'), {
      type: 'bar',
      data: {
        labels: [],
        datasets: [{
          label: 'Titik Sampel',
          data: [],
          backgroundColor: '#38bdf8',
          borderRadius: 4,
          maxBarThickness: 28,
          barPercentage: 0.6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0f172a',
            titleColor: '#f8fafc',
            bodyColor: '#38bdf8',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            displayColors: false,
            callbacks: {
              label: (context) => ` ${context.parsed.y} Titik Sampel`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#94a3b8', font: { size: 9, weight: '600' } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#94a3b8', font: { size: 9 }, precision: 0 },
            beginAtZero: true
          }
        }
      }
    });
  }
}

// =============================================================================
// 5. INISIALISASI PETA LEAFLET
// =============================================================================
let map = null;
let currentBasemap = null;
let basemaps = {};

function initLeafletMap() {
  const center = (CONFIG && CONFIG.defaultMapCenter) ? CONFIG.defaultMapCenter : [-7.3275, 108.3533];
  const zoom = (CONFIG && CONFIG.defaultZoom) ? CONFIG.defaultZoom : 11;

  map = L.map('leaflet-map', {
    center: center,
    zoom: zoom,
    zoomControl: false
  });

  L.control.zoom({ position: 'bottomleft' }).addTo(map);

  basemaps = {
    osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }),
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri'
    })
  };

  currentBasemap = basemaps.osm;
  currentBasemap.addTo(map);

  aplLayerGroup = L.layerGroup().addTo(map);
  polygonLayerGroup = L.layerGroup().addTo(map);
  pointsLayerGroup = L.layerGroup().addTo(map);
}

// =============================================================================
// 6. PEMUATAN DATA SPASIAL & TITIK SAMPEL
// =============================================================================
async function loadAllData() {
  console.log("📡 Memuat file GeoJSON poligon & titik sampel Ciamis...");

  // 1. Muat Titik Sampel terlebih dahulu agar count per NOZN terisi
  await loadSamplePoints();

  // 2. Muat APL dan Poligon Zona ZNT Ciamis
  await loadZonesGeoJson();

  populateSurveyorDropdown();
  refreshDashboard(true);
}

async function loadSamplePoints() {
  const candidatePaths = [
    (CONFIG && CONFIG.samplePointsGeoJson) ? CONFIG.samplePointsGeoJson : "data/titik_sampel_with_nozn.geojson",
    "data/titik_sampel_with_nozn.geojson",
    "titik_sampel_with_nozn.geojson"
  ];

  for (const pointsPath of candidatePaths) {
    try {
      const resp = await fetch(pointsPath, { cache: "no-cache" });
      if (resp.ok) {
        const geojson = await resp.json();
        allSamplePoints = geojson.features || [];
        console.log(`✅ Berhasil memuat ${allSamplePoints.length} titik sampel dari: ${pointsPath}`);

        zonePointsCountMap = {};
        allSamplePoints.forEach(pt => {
          const p = pt.properties || pt.attributes || {};
          const nozn = `${p.NOZN}`.trim();
          if (nozn && nozn !== '') {
            zonePointsCountMap[nozn] = (zonePointsCountMap[nozn] || 0) + 1;
          }
        });
        console.log(`📍 Pemetaan titik ke zona selesai: ${Object.keys(zonePointsCountMap).length} zona terisi sampel.`);
        return; // Berhasil muat dari candidate pertama
      }
    } catch (err) {
      console.warn(`Gagal memuat titik dari ${pointsPath}:`, err);
    }
  }

  // Coba muat dari CSV jika GeoJSON tidak ditemukan
  const csvCandidate = (CONFIG && CONFIG.samplePointsCsv) ? CONFIG.samplePointsCsv : "data/titik_sampel_with_nozn.csv";
  try {
    const csvResp = await fetch(csvCandidate, { cache: "no-cache" });
    if (csvResp.ok && typeof Papa !== 'undefined') {
      const csvText = await csvResp.text();
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
      if (parsed.data && parsed.data.length > 0) {
        allSamplePoints = parsed.data.map(row => {
          const x = parseFloat(row.X || row.Longitude || row.Long || row.POINT_X || 0);
          const y = parseFloat(row.Y || row.Latitude || row.Lat || row.POINT_Y || 0);
          const reprojected = reprojectCoords([x, y]);
          return {
            type: "Feature",
            geometry: { type: "Point", coordinates: reprojected },
            properties: row
          };
        }).filter(f => f.geometry.coordinates[0] !== 0 && f.geometry.coordinates[1] !== 0);

        zonePointsCountMap = {};
        allSamplePoints.forEach(pt => {
          const p = pt.properties || {};
          const nozn = `${p.NOZN}`.trim();
          if (nozn && nozn !== '') {
            zonePointsCountMap[nozn] = (zonePointsCountMap[nozn] || 0) + 1;
          }
        });
        console.log(`✅ Berhasil memuat ${allSamplePoints.length} titik sampel dari CSV: ${csvCandidate}`);
        return;
      }
    }
  } catch (e) {
    console.warn("Gagal memuat titik dari CSV fallback:", e);
  }

  // Fallback data embedded (jika dibuka langsung via file:// atau offline)
  if (allSamplePoints.length === 0 && window.CIAMIS_DATA && window.CIAMIS_DATA.points) {
    allSamplePoints = window.CIAMIS_DATA.points.features || [];
    zonePointsCountMap = {};
    allSamplePoints.forEach(pt => {
      const p = pt.properties || pt.attributes || {};
      const nozn = `${p.NOZN}`.trim();
      if (nozn && nozn !== '') {
        zonePointsCountMap[nozn] = (zonePointsCountMap[nozn] || 0) + 1;
      }
    });
    console.log(`✅ Berhasil memuat ${allSamplePoints.length} titik sampel dari Embedded Data.`);
    return;
  }

  console.warn("⚠️ Gagal memuat titik sampel dari semua lokasi candidate.");
}

async function loadZonesGeoJson() {
  polygonLayerGroup.clearLayers();
  aplLayerGroup.clearLayers();
  allZoneFeatures = [];

  let loadedAPL = false;
  let loadedZones = false;

  const paths = (CONFIG && CONFIG.geojsonSearchPaths) ? CONFIG.geojsonSearchPaths : [];

  for (const path of paths) {
    const isAPL = path.toLowerCase().includes('apl');
    if (isAPL && loadedAPL) continue;
    if (!isAPL && loadedZones) continue;

    try {
      const resp = await fetch(path, { cache: "no-cache" });
      if (resp.ok) {
        let rawData = await resp.json();
        let geojson = normalizeToGeoJson(rawData);
        if (geojson && geojson.features && geojson.features.length > 0) {
          addGeoJsonToMap(geojson, path);
          if (isAPL) {
            loadedAPL = true;
            console.log(`✅ Berhasil memuat APL: ${path} (${geojson.features.length} fitur)`);
          } else {
            loadedZones = true;
            console.log(`✅ Berhasil memuat ZONA: ${path} (${geojson.features.length} fitur)`);
          }
        }
      }
    } catch (e) {
      console.warn(`Gagal memuat: ${path}`, e);
    }
  }

  // Fallback data embedded (jika dibuka langsung via file:// atau offline)
  if (allZoneFeatures.length === 0 && window.CIAMIS_DATA) {
    if (window.CIAMIS_DATA.apl) {
      addGeoJsonToMap(normalizeToGeoJson(window.CIAMIS_DATA.apl), 'apl');
      console.log(`✅ Berhasil memuat APL dari Embedded Data.`);
    }
    if (window.CIAMIS_DATA.zones) {
      addGeoJsonToMap(normalizeToGeoJson(window.CIAMIS_DATA.zones), 'zona');
      console.log(`✅ Berhasil memuat ${allZoneFeatures.length} zona dari Embedded Data.`);
    }
  }
}

function addGeoJsonToMap(geojsonData, filename = '') {
  const isAPL = filename.toLowerCase().includes('apl');
  const features = geojsonData.features || [];

  if (isAPL) {
    const layer = L.geoJSON(geojsonData, {
      style: { color: '#ffffff', weight: 1.5, opacity: 0.85, fill: false }
    });
    aplLayerGroup.addLayer(layer);
  } else {
    allZoneFeatures.push(...features);
  }
}

// =============================================================================
// 7. RENDER POLIGON ZONA PADA PETA
// =============================================================================
function renderZonesOnMap(zonesToRender, shouldFitBounds = true) {
  polygonLayerGroup.clearLayers();

  const layer = L.geoJSON({ type: "FeatureCollection", features: zonesToRender }, {
    style: function (feature) {
      const props = feature.properties || {};
      const nozn = `${props.NOZN}`.trim();
      const pointsInZone = zonePointsCountMap[nozn] || 0;
      const targetInfo = getTargetForFeature(feature);
      const rawSurv = props.Surveyor || props.Nama || props.SURV || '';
      const survColor = getSurveyorColor(rawSurv);

      if (colorMode === 'surveyor') {
        // MODE 1: PEWARNAAN PER SURVEYOR
        let fillOpacity = 0.16;
        let weight = 1.1;
        let strokeColor = '#0f172a';
        let dashArray = '3, 3';

        if (pointsInZone >= targetInfo.target) {
          fillOpacity = 0.65;
          weight = 1.6;
          dashArray = null;
          strokeColor = '#090d16';
        } else if (pointsInZone > 0) {
          fillOpacity = 0.38;
          weight = 1.3;
          dashArray = '4, 3';
          strokeColor = '#090d16';
        }

        return {
          color: strokeColor,
          weight: weight,
          opacity: 0.95,
          fillColor: survColor,
          fillOpacity: fillOpacity,
          dashArray: dashArray
        };
      } else if (colorMode === 'qc') {
        // MODE 3: STATUS QUALITY CONTROL (QC SIPENTA)
        const rawQc = (props.Status_QC || '').trim();
        let fillColor = '#475569'; // Abu-abu gelap (Belum Disurvey / default)
        let fillOpacity = 0.35;
        let weight = 1.1;

        if (rawQc.includes('Lengkap & Valid')) {
          fillColor = '#10b981'; // Hijau: Valid & memenuhi kriteria
          fillOpacity = 0.65;
          weight = 1.4;
        } else if (rawQc.includes('Perlu Revisi')) {
          fillColor = '#f59e0b'; // Oranye/Amber: RSD > 30% atau RSD 0%
          fillOpacity = 0.70;
          weight = 1.5;
        } else if (rawQc.includes('Kurang Lengkap')) {
          fillColor = '#06b6d4'; // Cyan: Kurang titik (tunggu min 3)
          fillOpacity = 0.50;
        }

        return {
          color: '#0f172a',
          weight: weight,
          opacity: 0.9,
          fillColor: fillColor,
          fillOpacity: fillOpacity,
          dashArray: null
        };
      } else {
        // MODE 2: STATUS PEMENUHAN TARGET (HIJAU / KUNING / MERAH)
        let fillColor = '#ef4444'; // Merah (0 titik)
        if (pointsInZone >= targetInfo.target) {
          fillColor = '#10b981'; // Hijau (Target Terpenuhi)
        } else if (pointsInZone > 0) {
          fillColor = '#eab308'; // Kuning (Proses / Belum Penuh)
        }

        return {
          color: '#0f172a',
          weight: 1.2,
          opacity: 0.9,
          fillColor: fillColor,
          fillOpacity: pointsInZone > 0 ? 0.6 : 0.35,
          dashArray: null
        };
      }
    },
    onEachFeature: function (feature, l) {
      const p = feature.properties || {};
      const nozn = `${p.NOZN}`.trim();
      const histZone = p.HISTZONE ? ` (${p.HISTZONE})` : '';
      const zoneId = p.NOZN ? `Zona ${p.NOZN}` : (p.HISTZONE ? `Zona ${p.HISTZONE}` : 'Zona ZNT');
      const targetInfo = getTargetForFeature(feature);
      const pointsInZone = zonePointsCountMap[nozn] || 0;
      const rawSurv = p.Surveyor || p.Nama || p.SURV || '';
      const survName = getCanonicalSurveyorName(rawSurv) || 'Belum Ditentukan';
      const survColor = getSurveyorColor(rawSurv);
      const luasFormatted = targetInfo.luasHa > 0 ? `${targetInfo.luasHa.toFixed(2)} Ha` : '-';

      const effectiveInThisZone = Math.min(pointsInZone, targetInfo.target);

      let statusBadge = `<span class="znt-badge" style="background:#ef4444; color:#fff;">Belum Ada Sampel</span>`;
      if (pointsInZone >= targetInfo.target) {
        const surplusText = pointsInZone > targetInfo.target ? ` (+${pointsInZone - targetInfo.target} surplus)` : '';
        statusBadge = `<span class="znt-badge" style="background:#10b981; color:#fff;">Target Selesai (${targetInfo.target}/${targetInfo.target})${surplusText}</span>`;
      } else if (pointsInZone > 0) {
        statusBadge = `<span class="znt-badge" style="background:#eab308; color:#000;">Kurang ${targetInfo.target - pointsInZone} Sampel</span>`;
      }

      // Format Atribut QC SIPENTA
      const rawQc = (p.Status_QC || '').trim();
      let qcBadge = `<span class="znt-badge" style="background:#64748b; color:#fff;">Belum Terdata QC</span>`;
      if (rawQc) {
        if (rawQc.includes('Lengkap & Valid')) {
          qcBadge = `<span class="znt-badge" style="background:#10b981; color:#fff;"><i class="fa-solid fa-circle-check"></i> ${rawQc}</span>`;
        } else if (rawQc.includes('Perlu Revisi')) {
          qcBadge = `<span class="znt-badge" style="background:#f59e0b; color:#000; font-weight:700;"><i class="fa-solid fa-triangle-exclamation"></i> ${rawQc}</span>`;
        } else if (rawQc.includes('Kurang Lengkap')) {
          qcBadge = `<span class="znt-badge" style="background:#06b6d4; color:#fff;"><i class="fa-solid fa-clock-rotate-left"></i> ${rawQc}</span>`;
        } else if (rawQc.includes('Belum Disurvey')) {
          qcBadge = `<span class="znt-badge" style="background:#475569; color:#cbd5e1;"><i class="fa-solid fa-hourglass-start"></i> ${rawQc}</span>`;
        } else {
          qcBadge = `<span class="znt-badge" style="background:#64748b; color:#fff;">${rawQc}</span>`;
        }
      }

      const rataNilaiNum = (p.Rata_Nilai !== undefined && p.Rata_Nilai !== null) ? Number(p.Rata_Nilai) : 0;
      const rataNilaiFormatted = (rataNilaiNum > 0)
        ? `Rp ${Math.round(rataNilaiNum).toLocaleString('id-ID')} / m²`
        : (rataNilaiNum < 0 ? `Rp ${Math.round(rataNilaiNum).toLocaleString('id-ID')} / m² (Perlu Cek)` : '-');

      const rsdNum = (p.RSD_Persen !== undefined && p.RSD_Persen !== null) ? Number(p.RSD_Persen) : null;
      let rsdFormatted = '-';
      if (rsdNum !== null && rsdNum > 0) {
        const rsdColor = rsdNum > 30 ? '#f59e0b' : '#10b981';
        rsdFormatted = `<strong style="color:${rsdColor};">${rsdNum.toFixed(2)}%</strong>`;
      } else if (rsdNum === 0 && rawQc && !rawQc.includes('Belum')) {
        rsdFormatted = `<strong style="color:#f59e0b;">0.00% (Revisi)</strong>`;
      }

      l.bindPopup(`
        <div class="znt-popup">
          <div class="znt-popup-header" style="border-left: 4px solid ${survColor};">
            <span class="znt-popup-title">${zoneId}${histZone}</span>
            ${statusBadge}
          </div>
          <div style="margin-top:6px;">
            <div class="znt-popup-row"><span>Surveyor Wilayah:</span> <strong style="color:${survColor}; font-weight:700;">${survName}</strong></div>
            <div class="znt-popup-row"><span>Luasan Zona:</span> <strong>${luasFormatted}</strong></div>
            <div class="znt-popup-row"><span>Kategori Target:</span> <strong>${targetInfo.bracket}</strong></div>
            <div class="znt-popup-row"><span>Target Wajib:</span> <strong style="color:#38bdf8;">${targetInfo.target} Titik Sampel</strong></div>
            <div class="znt-popup-row"><span>Titik di Lapangan:</span> <strong>${pointsInZone} Titik</strong></div>
            <div class="znt-popup-row"><span>Dihitung untuk Target:</span> <strong style="color:${effectiveInThisZone >= targetInfo.target ? '#10b981' : '#eab308'}; font-weight:800;">${effectiveInThisZone} / ${targetInfo.target} Titik</strong></div>
            <div class="znt-popup-row"><span>Kecamatan:</span> <strong>${p.Kecamatan || p.KECAMATAN || 'Ciamis'}</strong></div>
            <div class="znt-popup-row"><span>Penggunaan Tanah:</span> <strong>${p.PENGGUNAAN || p.Penggunaan || 'Umum'}</strong></div>
            <div class="znt-popup-row"><span>Zoning Titik Sampel:</span> <strong style="color:#38bdf8;">${p.Zoning_Sampel && p.Zoning_Sampel !== '-' ? p.Zoning_Sampel : (pointsInZone > 0 ? 'Tercatat' : '-')}</strong></div>

            <!-- HASIL QUALITY CONTROL (SIPENTA) -->
            <div style="margin-top:8px; padding-top:6px; border-top:1px dashed rgba(255,255,255,0.18);">
              <div style="font-size:0.68rem; font-weight:800; color:#38bdf8; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">
                <i class="fa-solid fa-clipboard-check"></i> Quality Control (SIPENTA)
              </div>
              <div class="znt-popup-row" style="align-items:center;">
                <span>Status QC:</span>
                <div>${qcBadge}</div>
              </div>
              <div class="znt-popup-row"><span>Rata-rata Nilai:</span> <strong style="color:#38bdf8; font-weight:700;">${rataNilaiFormatted}</strong></div>
              <div class="znt-popup-row"><span>RSD / Variasi:</span> <span>${rsdFormatted}</span></div>
            </div>
          </div>
        </div>
      `, { maxWidth: 320 });

      l.on('mouseover', function () {
        this.setStyle({ weight: 2.8, color: '#ffffff', fillOpacity: 0.88 });
      });
      l.on('mouseout', function () {
        if (colorMode === 'surveyor') {
          const fOp = (pointsInZone >= targetInfo.target) ? 0.65 : (pointsInZone > 0 ? 0.38 : 0.16);
          const w = (pointsInZone >= targetInfo.target) ? 1.6 : (pointsInZone > 0 ? 1.3 : 1.1);
          const dash = (pointsInZone >= targetInfo.target) ? null : (pointsInZone > 0 ? '4, 3' : '3, 3');
          this.setStyle({ weight: w, color: '#090d16', fillOpacity: fOp, dashArray: dash });
        } else if (colorMode === 'qc') {
          const rawQc = (p.Status_QC || '').trim();
          let fOp = 0.35;
          let w = 1.1;
          if (rawQc.includes('Lengkap & Valid')) { fOp = 0.65; w = 1.4; }
          else if (rawQc.includes('Perlu Revisi')) { fOp = 0.70; w = 1.5; }
          else if (rawQc.includes('Kurang Lengkap')) { fOp = 0.50; }
          this.setStyle({ weight: w, color: '#0f172a', fillOpacity: fOp, dashArray: null });
        } else {
          this.setStyle({ weight: 1.2, color: '#0f172a', fillOpacity: pointsInZone > 0 ? 0.6 : 0.35, dashArray: null });
        }
      });
    }
  });

  polygonLayerGroup.addLayer(layer);

  if (shouldFitBounds && zonesToRender.length > 0) {
    try {
      map.fitBounds(layer.getBounds(), { padding: [30, 30] });
    } catch (err) { }
  }
}

// =============================================================================
// 8. RENDER TITIK SAMPEL PADA PETA
// =============================================================================
function renderSamplePointsOnMap(pointsToRender) {
  pointsLayerGroup.clearLayers();

  pointsToRender.forEach(pt => {
    const coords = (pt.geometry && pt.geometry.coordinates) ? pt.geometry.coordinates : null;
    if (!coords || coords.length < 2) return;

    const lon = coords[0];
    const lat = coords[1];
    const p = pt.properties || {};
    const survColor = getSurveyorColor(p.Surveyor);

    const hargaFormatted = p.Harga && !isNaN(p.Harga) ? `Rp ${Number(p.Harga).toLocaleString('id-ID')}` : '-';
    const nilaiM2Formatted = p.NilaiPerM2 && !isNaN(p.NilaiPerM2) ? `Rp ${Math.round(p.NilaiPerM2).toLocaleString('id-ID')} / m²` : '-';
    const luasFormatted = p.Luas ? `${p.Luas} m²` : '-';

    const marker = L.circleMarker([lat, lon], {
      radius: 4.5,
      fillColor: survColor,
      color: '#ffffff',
      weight: 1.2,
      opacity: 0.95,
      fillOpacity: 0.85
    });

    marker.bindPopup(`
      <div class="znt-popup">
        <div class="znt-popup-header" style="border-left: 4px solid ${survColor};">
          <span class="znt-popup-title">${p.NoSampel ? p.NoSampel : `Sampel #${p.No || ''}`}</span>
          <span class="znt-badge" style="background:${survColor}25; color:${survColor}; border:1px solid ${survColor}60;">${p.JenisData || 'Survei'}</span>
        </div>
        <div style="margin-top:6px;">
          <div class="znt-popup-row"><span>Zona ZNT Terkait:</span> <strong style="color:#38bdf8;">Zona ${p.NOZN || '-'} (${p.HISTZONE || '-'})</strong></div>
          <div class="znt-popup-row"><span>Zoning / Peruntukan:</span> <strong style="color:#38bdf8;">${p.Zoning || p.ZoningKode || '-'}</strong></div>
          <div class="znt-popup-row"><span>Objek Fisik:</span> <strong>${p.GunaObjek || '-'}</strong></div>
          <div class="znt-popup-row"><span>Surveyor:</span> <strong>${getCanonicalSurveyorName(p.Surveyor)}</strong></div>
          <div class="znt-popup-row"><span>Tgl Survei:</span> <strong>${p.Tgl || '-'}</strong></div>
          <div class="znt-popup-row"><span>Alamat:</span> <strong>${p.Alamat || '-'}</strong></div>
          <div class="znt-popup-row"><span>Kel / Kec:</span> <strong>${p.Kelurahan || ''}, ${p.Kecamatan || ''}</strong></div>
          <div class="znt-popup-row"><span>Harga Objek:</span> <strong>${hargaFormatted}</strong></div>
          <div class="znt-popup-row"><span>Luas Tanah:</span> <strong>${luasFormatted}</strong></div>
          <div class="znt-popup-row"><span>Nilai Tanah/m²:</span> <strong style="color:#fcd34d;">${nilaiM2Formatted}</strong></div>
        </div>
      </div>
    `);

    pointsLayerGroup.addLayer(marker);
  });
}

// =============================================================================
// 9. LOGIKA FILTER & UPDATE DASHBOARD (LOGIKA CAPPED AKTUAL)
// =============================================================================
function populateSurveyorDropdown() {
  const select = document.getElementById('sort-surveyor');
  if (!select) return;
  const currVal = select.value;

  select.innerHTML = '<option value="default">Semua Surveyor</option>';
  if (CONFIG && CONFIG.surveyors) {
    CONFIG.surveyors.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.name;
      opt.textContent = s.name;
      select.appendChild(opt);
    });
  }

  // Cek apakah ada zona tanpa surveyor
  const hasUnassigned = allZoneFeatures.some(f => {
    const surv = f.properties ? (f.properties.Surveyor || f.properties.Nama || f.properties.SURV || '') : '';
    return !CONFIG.surveyors.some(s => matchSurveyor(surv, s.name));
  });
  if (hasUnassigned) {
    const optUn = document.createElement('option');
    optUn.value = '__unassigned__';
    optUn.textContent = 'Belum Ditugaskan / Cadangan';
    select.appendChild(optUn);
  }

  if (currVal) {
    select.value = getCanonicalSurveyorName(currVal) || currVal;
  }
}

function refreshDashboard(shouldFitBounds = false) {
  const select = document.getElementById('sort-surveyor');
  const selectedSurveyor = select ? select.value : 'default';
  activeFilterSurveyor = selectedSurveyor;

  let activeZones = allZoneFeatures;
  let activePoints = allSamplePoints;

  if (selectedSurveyor === '__unassigned__') {
    activeZones = allZoneFeatures.filter(f => {
      const surv = f.properties ? (f.properties.Surveyor || f.properties.Nama || f.properties.SURV || '') : '';
      return !CONFIG.surveyors.some(s => matchSurveyor(surv, s.name));
    });
    activePoints = allSamplePoints.filter(pt => {
      const p = pt.properties || {};
      return !CONFIG.surveyors.some(s => matchSurveyor(p.Surveyor, s.name));
    });
  } else if (selectedSurveyor !== 'default') {
    activePoints = allSamplePoints.filter(pt => {
      const p = pt.properties || {};
      return matchSurveyor(p.Surveyor, selectedSurveyor);
    });

    activeZones = allZoneFeatures.filter(f => {
      const p = f.properties || {};
      const surv = p.Surveyor || p.Nama || p.SURV || '';
      return matchSurveyor(surv, selectedSurveyor);
    });
  }

  // 1. Render Poligon Zona & Titik Sampel Terfilter
  renderZonesOnMap(activeZones, shouldFitBounds);
  renderSamplePointsOnMap(activePoints);

  // 2. Hitung Status Pemenuhan Zona & Capaian Aktual (Capped per Zona)
  let countDone = 0;
  let countProg = 0;
  let countZero = 0;
  let totalTarget = 0;
  let totalCappedAchieved = 0;

  activeZones.forEach(f => {
    const props = f.properties || {};
    const nozn = `${props.NOZN}`.trim();
    const ptsInZone = zonePointsCountMap[nozn] || 0;
    const tgt = getTargetForFeature(f).target;
    const cappedInThisZone = Math.min(ptsInZone, tgt);

    totalTarget += tgt;
    totalCappedAchieved += cappedInThisZone;

    if (ptsInZone >= tgt) {
      countDone++;
    } else if (ptsInZone > 0) {
      countProg++;
    } else {
      countZero++;
    }
  });

  const totalZones = activeZones.length;
  const totalGrossPoints = activePoints.length;
  const remainingTarget = Math.max(0, totalTarget - totalCappedAchieved);
  const completionPct = totalTarget > 0 ? ((totalCappedAchieved / totalTarget) * 100).toFixed(1) : '0.0';
  const surplusPoints = Math.max(0, totalGrossPoints - totalCappedAchieved);

  // 3. Update Elemen Statistik UI
  updateElementText('stat-total-zona', totalZones.toLocaleString('id-ID'));
  updateElementText('stat-zona-selesai', countDone.toLocaleString('id-ID'));
  updateElementText('stat-chip-selesai', countDone.toLocaleString('id-ID'));
  updateElementText('stat-chip-proses', countProg.toLocaleString('id-ID'));
  updateElementText('stat-chip-belum', countZero.toLocaleString('id-ID'));

  updateElementText('zone-completion-pct', `${completionPct}%`);
  updateElementText('sample-completion-pct', `${completionPct}%`);

  // 3b. Hitung Kualitas Data & Quality Control (QC SIPENTA)
  let qcValid = 0;
  let qcRevisi = 0;
  let qcKurang = 0;
  let qcBelum = 0;

  activeZones.forEach(f => {
    const props = f.properties || f.attributes || {};
    const sqc = (props.Status_QC || props.status_qc || '').trim();
    if (sqc.includes('Lengkap & Valid')) {
      qcValid++;
    } else if (sqc.includes('Perlu Revisi')) {
      qcRevisi++;
    } else if (sqc.includes('Kurang Lengkap')) {
      qcKurang++;
    } else if (sqc.includes('Belum Disurvey') || !sqc) {
      qcBelum++;
    } else {
      qcRevisi++;
    }
  });

  const qcValidPct = totalZones > 0 ? ((qcValid / totalZones) * 100).toFixed(1) : '0.0';

  updateElementText('stat-qc-valid', qcValid.toLocaleString('id-ID'));
  updateElementText('stat-qc-revisi', qcRevisi.toLocaleString('id-ID'));
  updateElementText('stat-chip-qc-valid', qcValid.toLocaleString('id-ID'));
  updateElementText('stat-chip-qc-revisi', qcRevisi.toLocaleString('id-ID'));
  updateElementText('stat-chip-qc-kurang', qcKurang.toLocaleString('id-ID'));
  updateElementText('stat-chip-qc-belum', qcBelum.toLocaleString('id-ID'));
  updateElementText('qc-valid-pct', `${qcValidPct}% Valid`);

  const progDone = document.getElementById('prog-seg-done');
  if (progDone) progDone.style.width = `${Math.min(100, Math.max(0, completionPct))}%`;

  // Capaian aktual (dibatasi maks per target zona)
  updateElementText('achieved-points', totalCappedAchieved.toLocaleString('id-ID'));
  updateElementText('remaining-points', remainingTarget.toLocaleString('id-ID'));
  updateElementText('target-points', totalTarget.toLocaleString('id-ID'));
  updateElementText('donut-center-number', totalCappedAchieved.toLocaleString('id-ID'));
  updateElementText('donut-center-sub', `/ ${totalTarget.toLocaleString('id-ID')}`);

  // Total fisik diambil & kelebihan
  const surplusText = surplusPoints > 0 ? ` (+${surplusPoints} surplus)` : '';
  updateElementText('gross-points', `${totalGrossPoints.toLocaleString('id-ID')}${surplusText}`);

  const sortStatus = document.getElementById('sort-status-text');
  if (sortStatus) {
    if (selectedSurveyor === 'default') {
      sortStatus.innerHTML = `<i class="fa-solid fa-map" style="color:var(--accent-sky)"></i> Seluruh Ciamis &bull; <strong>${countDone}/${totalZones}</strong> zona selesai (${((countDone/Math.max(totalZones, 1))*100).toFixed(1)}%) &bull; <strong>${totalCappedAchieved.toLocaleString('id-ID')} / ${totalTarget.toLocaleString('id-ID')}</strong> titik aktual`;
    } else if (selectedSurveyor === '__unassigned__') {
      sortStatus.innerHTML = `<i class="fa-solid fa-map" style="color:#94a3b8"></i> Belum Ditugaskan &bull; <strong>${countDone}/${totalZones}</strong> zona selesai &bull; <strong>${totalCappedAchieved} / ${totalTarget}</strong> titik`;
    } else {
      const sCol = getSurveyorColor(selectedSurveyor);
      sortStatus.innerHTML = `<i class="fa-solid fa-user-check" style="color:${sCol}"></i> Surveyor: <strong>${selectedSurveyor}</strong> &bull; <strong>${countDone}/${totalZones}</strong> zona selesai (${((countDone/Math.max(totalZones, 1))*100).toFixed(1)}%) &bull; <strong>${totalCappedAchieved} / ${totalTarget}</strong> titik`;
    }
  }

  // 4. Update Donut Chart
  if (donutChart) {
    donutChart.data.datasets[0].data = [totalCappedAchieved, remainingTarget];
    donutChart.update();
  }

  // 5. Update Bar Chart (Tren Harian)
  if (barChart) {
    const dailyMap = {};
    activePoints.forEach(pt => {
      const tgl = pt.properties ? pt.properties.Tgl : null;
      if (tgl) {
        dailyMap[tgl] = (dailyMap[tgl] || 0) + 1;
      }
    });

    const dates = Object.keys(dailyMap).sort().slice(-8);
    const namaBulanIndo = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const formattedLabels = dates.map(d => {
      const parts = d.split('-');
      if (parts.length === 3) {
        return `${parts[2]} ${namaBulanIndo[parseInt(parts[1], 10) - 1]}`;
      }
      return d;
    });

    barChart.data.labels = formattedLabels;
    barChart.data.datasets[0].data = dates.map(d => dailyMap[d]);
    barChart.update();
  }

  // 6. Update Log Sampel Terbaru
  renderRecentSamples(activePoints.slice(-12).reverse());

  // 7. Update Legenda Peta
  updateFloatingLegend(selectedSurveyor, totalCappedAchieved, totalTarget, completionPct, countDone, totalZones);
}

function updateElementText(id, text) {
  const el = document.getElementById(id);
  if (el) el.innerText = text;
}

function renderRecentSamples(sampleList) {
  const container = document.getElementById('recent-samples-list');
  const countBadge = document.getElementById('samples-count');
  if (!container) return;

  if (countBadge) countBadge.innerText = allSamplePoints.length;
  container.innerHTML = '';

  if (sampleList.length === 0) {
    container.innerHTML = '<div class="empty-state">Belum ada titik sampel tercatat.</div>';
    return;
  }

  sampleList.forEach(pt => {
    const p = pt.properties || {};
    const coords = (pt.geometry && pt.geometry.coordinates) ? pt.geometry.coordinates : null;
    const card = document.createElement('div');
    card.className = 'sample-log-item';
    const isTransaksi = (p.JenisData || '').toLowerCase().includes('transaksi');
    const tagClass = isTransaksi ? 'transaksi' : 'penawaran';
    const sCol = getSurveyorColor(p.Surveyor);
    card.style.borderLeftColor = sCol;

    const nilaiFormatted = p.NilaiPerM2 && !isNaN(p.NilaiPerM2) ? `Rp ${Math.round(p.NilaiPerM2).toLocaleString('id-ID')}/m²` : '';

    card.innerHTML = `
      <div class="sample-log-header">
        <span><i class="fa-solid fa-location-dot" style="color:${sCol}"></i> ${p.NoSampel || `#${p.No || ''}`} &bull; Zona ${p.NOZN || '-'}</span>
        <span class="sample-type-tag ${tagClass}">${p.JenisData || 'Penawaran'}</span>
      </div>
      <div class="sample-log-meta">
        <span><i class="fa-regular fa-user"></i> ${getCanonicalSurveyorName(p.Surveyor)}</span>
        <span>&bull;</span>
        <span><i class="fa-regular fa-calendar"></i> ${p.Tgl || '-'}</span>
        ${p.Zoning ? `<span>&bull;</span> <span style="color:#38bdf8; font-weight:600;">${p.Zoning}</span>` : ''}
      </div>
      <div style="font-size:0.7rem; color:var(--text-muted);">${p.Alamat || ''}, ${p.Kelurahan || ''}</div>
      ${nilaiFormatted ? `<div class="sample-log-price">${nilaiFormatted}</div>` : ''}
    `;

    if (coords) {
      card.addEventListener('click', () => {
        map.setView([coords[1], coords[0]], 16);
      });
    }

    container.appendChild(card);
  });
}

function updateFloatingLegend(selectedSurveyor, achieved, target, pct, countDone = 0, totalZones = 0) {
  const zonePct = totalZones > 0 ? ((countDone / totalZones) * 100).toFixed(1) : '0.0';
  updateElementText('legend-total-pct', `${zonePct}%`);
  updateElementText('legend-footer-zones', countDone.toLocaleString('id-ID'));
  updateElementText('legend-footer-total-zones', totalZones.toLocaleString('id-ID'));
  updateElementText('legend-footer-zone-pct', `${zonePct}%`);
  updateElementText('legend-footer-achieved', achieved.toLocaleString('id-ID'));
  updateElementText('legend-footer-target', target.toLocaleString('id-ID'));
  updateElementText('legend-footer-pct', `${pct}%`);

  const pointer = document.getElementById('legend-progress-pointer');
  if (pointer) pointer.style.left = `${Math.min(100, Math.max(0, pct))}%`;

  const modeLabel = document.getElementById('legend-mode-label');
  const modeBtn = document.getElementById('legend-mode-toggle');
  const gradBox = document.getElementById('legend-gradient-box');
  const opGuide = document.getElementById('legend-opacity-guide');
  const qcGuide = document.getElementById('legend-qc-guide');
  const statusTitle = document.getElementById('legend-status-title');

  if (colorMode === 'surveyor') {
    if (modeLabel) modeLabel.textContent = 'Per Surveyor';
    if (modeBtn) {
      modeBtn.className = 'legend-mode-btn';
      modeBtn.title = 'Mode aktif: Warna per Surveyor. Klik untuk ganti ke Status Target.';
    }
    if (gradBox) gradBox.style.display = 'none';
    if (opGuide) opGuide.style.display = 'flex';
    if (qcGuide) qcGuide.style.display = 'none';
    if (statusTitle) statusTitle.textContent = 'Intensitas Capaian Zona';
  } else if (colorMode === 'qc') {
    if (modeLabel) modeLabel.textContent = 'Status QC SIPENTA';
    if (modeBtn) {
      modeBtn.className = 'legend-mode-btn qc-mode';
      modeBtn.title = 'Mode aktif: Status QC SIPENTA. Klik untuk ganti ke Warna per Surveyor.';
    }
    if (gradBox) gradBox.style.display = 'none';
    if (opGuide) opGuide.style.display = 'none';
    if (qcGuide) qcGuide.style.display = 'flex';
    if (statusTitle) statusTitle.textContent = 'Kualitas Data Zona (QC)';
  } else {
    if (modeLabel) modeLabel.textContent = 'Status Target';
    if (modeBtn) {
      modeBtn.className = 'legend-mode-btn status-mode';
      modeBtn.title = 'Mode aktif: Status Target (Hijau/Kuning/Merah). Klik untuk ganti ke Status QC SIPENTA.';
    }
    if (gradBox) gradBox.style.display = 'flex';
    if (opGuide) opGuide.style.display = 'none';
    if (qcGuide) qcGuide.style.display = 'none';
    if (statusTitle) statusTitle.textContent = 'Status Pemenuhan Zona';
  }

  const survContainer = document.getElementById('legend-surveyor-list');
  if (!survContainer) return;
  survContainer.innerHTML = '';

  const surveyorList = (CONFIG && CONFIG.surveyors) ? CONFIG.surveyors : [];

  surveyorList.forEach(s => {
    const sPoints = allSamplePoints.filter(pt => matchSurveyor(pt.properties ? pt.properties.Surveyor : '', s.name));
    const sZones = allZoneFeatures.filter(f => matchSurveyor(f.properties ? (f.properties.Surveyor || f.properties.Nama || f.properties.SURV) : '', s.name));

    let sTarget = 0;
    let sCapped = 0;
    let sDoneZones = 0;

    sZones.forEach(f => {
      const p = f.properties || {};
      const nozn = `${p.NOZN}`.trim();
      const pts = zonePointsCountMap[nozn] || 0;
      const tgt = getTargetForFeature(f).target;
      sTarget += tgt;
      sCapped += Math.min(pts, tgt);
      if (pts >= tgt) {
        sDoneZones++;
      }
    });

    const sTotalZones = sZones.length;
    const sZonePct = sTotalZones > 0 ? (sDoneZones / sTotalZones) * 100 : 0;
    const sPointPct = sTarget > 0 ? (sCapped / sTarget) * 100 : 0;
    const sCol = s.color || "#38bdf8";

    const isSelected = selectedSurveyor !== 'default' && matchSurveyor(selectedSurveyor, s.name);

    const row = document.createElement('div');
    row.className = `legend-surveyor-row ${isSelected ? 'active' : ''}`;
    row.innerHTML = `
      <div class="legend-surv-top">
        <div class="legend-surv-name-group">
          <span class="swatch-dot" style="background:${sCol}; box-shadow:0 0 6px ${sCol};"></span>
          <span>${s.name}</span>
        </div>
        <span class="legend-surv-badge" style="background:${sCol}25; color:${sCol}; border:1px solid ${sCol}60;">
          ${sDoneZones} / ${sTotalZones} Zona
        </span>
      </div>
      <div class="legend-surv-bar-track">
        <div class="legend-surv-bar-fill" style="width: ${Math.max(4, Math.min(100, sZonePct))}%; background:${sCol};"></div>
      </div>
      <div class="legend-surv-details">
        <span>Zona Selesai: <strong>${sZonePct.toFixed(1)}%</strong></span>
        <span style="color:var(--text-dim); font-size:0.67rem;">Titik: ${sCapped}/${sTarget} pt (${sPoints.length} fisik)</span>
      </div>
    `;

    row.addEventListener('click', () => {
      const select = document.getElementById('sort-surveyor');
      if (select) {
        if (select.value === s.name) {
          select.value = 'default';
        } else {
          select.value = s.name;
        }
        refreshDashboard(true);
      }
    });

    survContainer.appendChild(row);
  });

  // Tambahkan baris Belum Ditugaskan / Cadangan jika ada zona tanpa surveyor
  const unassignedZones = allZoneFeatures.filter(f => {
    const raw = f.properties ? (f.properties.Surveyor || f.properties.Nama || f.properties.SURV || '') : '';
    return !surveyorList.some(s => matchSurveyor(raw, s.name));
  });

  if (unassignedZones.length > 0) {
    let unDone = 0;
    let unTarget = 0;
    let unCapped = 0;
    unassignedZones.forEach(f => {
      const p = f.properties || {};
      const nozn = `${p.NOZN}`.trim();
      const pts = zonePointsCountMap[nozn] || 0;
      const tgt = getTargetForFeature(f).target;
      unTarget += tgt;
      unCapped += Math.min(pts, tgt);
      if (pts >= tgt) unDone++;
    });
    const unTotal = unassignedZones.length;
    const unPct = unTotal > 0 ? (unDone / unTotal) * 100 : 0;
    const unCol = "#64748b";
    const isSelected = selectedSurveyor === '__unassigned__';

    const rowUn = document.createElement('div');
    rowUn.className = `legend-surveyor-row ${isSelected ? 'active' : ''}`;
    rowUn.innerHTML = `
      <div class="legend-surv-top">
        <div class="legend-surv-name-group">
          <span class="swatch-dot" style="background:${unCol};"></span>
          <span style="color:var(--text-muted);">Belum Ditugaskan</span>
        </div>
        <span class="legend-surv-badge" style="background:${unCol}20; color:${unCol}; border:1px solid ${unCol}40;">
          ${unDone} / ${unTotal} Zona
        </span>
      </div>
      <div class="legend-surv-bar-track">
        <div class="legend-surv-bar-fill" style="width: ${Math.max(2, Math.min(100, unPct))}%; background:${unCol};"></div>
      </div>
      <div class="legend-surv-details">
        <span>Zona Selesai: <strong>${unPct.toFixed(1)}%</strong></span>
        <span style="color:var(--text-dim); font-size:0.67rem;">Cadangan BPN (${unTotal} Zona)</span>
      </div>
    `;
    rowUn.addEventListener('click', () => {
      const select = document.getElementById('sort-surveyor');
      if (select) {
        select.value = select.value === '__unassigned__' ? 'default' : '__unassigned__';
        refreshDashboard(true);
      }
    });
    survContainer.appendChild(rowUn);
  }
}

// =============================================================================
// 10. DRAG & DROP DAN FILE INPUT HANDLER
// =============================================================================
function handleFileImport(files) {
  if (!files || files.length === 0) return;

  Array.from(files).forEach(file => {
    const ext = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();

    if (ext === 'geojson' || ext === 'json') {
      reader.onload = function(e) {
        try {
          const json = JSON.parse(e.target.result);
          const normalized = normalizeToGeoJson(json);
          if (normalized && normalized.features) {
            const first = normalized.features[0];
            const geomType = first && first.geometry ? first.geometry.type : '';
            if (geomType.includes('Point')) {
              allSamplePoints = normalized.features;
              zonePointsCountMap = {};
              allSamplePoints.forEach(pt => {
                const nozn = `${pt.properties?.NOZN}`.trim();
                if (nozn) zonePointsCountMap[nozn] = (zonePointsCountMap[nozn] || 0) + 1;
              });
              alert(`✅ Berhasil mengimpor ${allSamplePoints.length} titik sampel dari file: ${file.name}`);
            } else {
              allZoneFeatures = normalized.features;
              alert(`✅ Berhasil mengimpor ${allZoneFeatures.length} zona dari file: ${file.name}`);
            }
            refreshDashboard(true);
          }
        } catch (err) {
          alert(`❌ Gagal membaca file GeoJSON: ${err.message}`);
        }
      };
      reader.readAsText(file);
    } else if (ext === 'csv') {
      reader.onload = function(e) {
        if (typeof Papa !== 'undefined') {
          const parsed = Papa.parse(e.target.result, { header: true, skipEmptyLines: true });
          if (parsed.data && parsed.data.length > 0) {
            allSamplePoints = parsed.data.map(row => {
              const x = parseFloat(row.X || row.Longitude || row.Long || row.POINT_X || 0);
              const y = parseFloat(row.Y || row.Latitude || row.Lat || row.POINT_Y || 0);
              const reprojected = reprojectCoords([x, y]);
              return {
                type: "Feature",
                geometry: { type: "Point", coordinates: reprojected },
                properties: row
              };
            }).filter(f => f.geometry.coordinates[0] !== 0 && f.geometry.coordinates[1] !== 0);

            zonePointsCountMap = {};
            allSamplePoints.forEach(pt => {
              const nozn = `${pt.properties?.NOZN}`.trim();
              if (nozn) zonePointsCountMap[nozn] = (zonePointsCountMap[nozn] || 0) + 1;
            });

            alert(`✅ Berhasil memproses ${allSamplePoints.length} titik sampel dari CSV: ${file.name}`);
            refreshDashboard(true);
          }
        }
      };
      reader.readAsText(file);
    }
  });
}

// =============================================================================
// 11. EVENT LISTENERS
// =============================================================================
function setupEventListeners() {
  const select = document.getElementById('sort-surveyor');
  if (select) select.addEventListener('change', () => refreshDashboard(true));

  const btnReset = document.getElementById('btn-reset-filters');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (select) select.value = 'default';
      refreshDashboard(true);
    });
  }

  // Toggle Mode Pewarnaan (Warna Surveyor -> Status Target -> Status QC)
  function toggleColorMode() {
    if (colorMode === 'surveyor') {
      colorMode = 'status';
    } else if (colorMode === 'status') {
      colorMode = 'qc';
    } else {
      colorMode = 'surveyor';
    }

    const btnToggleColorMode = document.getElementById('btn-toggle-color-mode');
    if (btnToggleColorMode) {
      if (colorMode === 'surveyor') {
        btnToggleColorMode.className = 'btn-map-icon active';
        btnToggleColorMode.setAttribute('title', 'Mode Pewarnaan: Warna per Surveyor (Klik untuk ganti ke Status Target)');
      } else if (colorMode === 'qc') {
        btnToggleColorMode.className = 'btn-map-icon active qc-active';
        btnToggleColorMode.setAttribute('title', 'Mode Pewarnaan: Status QC SIPENTA (Klik untuk ganti ke Warna per Surveyor)');
      } else {
        btnToggleColorMode.className = 'btn-map-icon';
        btnToggleColorMode.setAttribute('title', 'Mode Pewarnaan: Status Target (Klik untuk ganti ke Status QC SIPENTA)');
      }
    }
    refreshDashboard(false);
  }

  const btnToggleColorMode = document.getElementById('btn-toggle-color-mode');
  if (btnToggleColorMode) {
    btnToggleColorMode.addEventListener('click', toggleColorMode);
  }

  const legendModeToggle = document.getElementById('legend-mode-toggle');
  if (legendModeToggle) {
    legendModeToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleColorMode();
    });
  }

  // Basemap Dropdown
  const btnBasemap = document.getElementById('btn-basemap-toggle');
  const basemapMenu = document.getElementById('basemap-menu');
  if (btnBasemap && basemapMenu) {
    btnBasemap.addEventListener('click', (e) => {
      e.stopPropagation();
      basemapMenu.classList.toggle('show');
    });

    document.querySelectorAll('.basemap-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const key = opt.getAttribute('data-layer');
        if (basemaps[key]) {
          map.removeLayer(currentBasemap);
          currentBasemap = basemaps[key];
          currentBasemap.addTo(map);
          aplLayerGroup.bringToFront();
          polygonLayerGroup.bringToFront();
          pointsLayerGroup.bringToFront();

          document.querySelectorAll('.basemap-option').forEach(o => o.classList.remove('active'));
          opt.classList.add('active');
          basemapMenu.classList.remove('show');
        }
      });
    });

    document.addEventListener('click', () => basemapMenu.classList.remove('show'));
  }

  // Reset Zoom
  const btnResetZoom = document.getElementById('btn-reset-zoom');
  if (btnResetZoom) {
    btnResetZoom.addEventListener('click', () => {
      if (polygonLayerGroup && polygonLayerGroup.getLayers().length > 0) {
        try {
          const group = L.featureGroup(polygonLayerGroup.getLayers());
          map.fitBounds(group.getBounds(), { padding: [30, 30] });
        } catch (e) { }
      }
    });
  }

  // Tombol Sinkronisasi SIPENTA
  const btnSyncSipenta = document.getElementById('btn-sync-sipenta');
  if (btnSyncSipenta) {
    btnSyncSipenta.addEventListener('click', async () => {
      btnSyncSipenta.classList.add('syncing');
      const origText = btnSyncSipenta.innerHTML;
      btnSyncSipenta.innerHTML = '<i class="fa-solid fa-rotate"></i> Menyinkronkan...';

      try {
        await loadSamplePoints();
        await loadZonesGeoJson();
        refreshDashboard(false);
        updateElementText('last-update-time', `Sinkron: ${new Date().toLocaleTimeString('id-ID')}`);
        alert("✅ Sinkronisasi Selesai! Data titik sampel dan zona berhasil dimuat ulang.");
      } catch (err) {
        alert("Gagal memperbarui data otomatis. Pastikan file data tersedia di folder data/.");
      } finally {
        btnSyncSipenta.classList.remove('syncing');
        btnSyncSipenta.innerHTML = origText;
      }
    });
  }

  // File Upload Input
  const fileInput = document.getElementById('input-geojson-file');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      handleFileImport(e.target.files);
    });
  }

  // Drag and Drop pada Peta
  const dropOverlay = document.getElementById('drop-zone-overlay');
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (dropOverlay) dropOverlay.classList.add('drag-active');
  });
  window.addEventListener('dragleave', (e) => {
    if (e.relatedTarget === null && dropOverlay) {
      dropOverlay.classList.remove('drag-active');
    }
  });
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    if (dropOverlay) dropOverlay.classList.remove('drag-active');
    if (e.dataTransfer && e.dataTransfer.files) {
      handleFileImport(e.dataTransfer.files);
    }
  });

  // Toggle Polygons
  const togglePolygonsBtn = document.getElementById('toggle-polygons');
  let polyVisible = true;
  if (togglePolygonsBtn) {
    togglePolygonsBtn.addEventListener('click', () => {
      polyVisible = !polyVisible;
      if (polyVisible) {
        map.addLayer(polygonLayerGroup);
        togglePolygonsBtn.classList.add('active');
      } else {
        map.removeLayer(polygonLayerGroup);
        togglePolygonsBtn.classList.remove('active');
      }
    });
  }

  // Toggle Points
  const togglePointsBtn = document.getElementById('toggle-points');
  let pointsVisible = true;
  if (togglePointsBtn) {
    togglePointsBtn.addEventListener('click', () => {
      pointsVisible = !pointsVisible;
      if (pointsVisible) {
        map.addLayer(pointsLayerGroup);
        togglePointsBtn.classList.add('active');
      } else {
        map.removeLayer(pointsLayerGroup);
        togglePointsBtn.classList.remove('active');
      }
    });
  }

  // Toggle Sidebar
  const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
  const appContainer = document.querySelector('.app-container');
  if (btnToggleSidebar && appContainer) {
    btnToggleSidebar.addEventListener('click', () => {
      appContainer.classList.toggle('sidebar-collapsed');
      setTimeout(() => map.invalidateSize(), 300);
    });
  }

  // Legenda Collapse
  const legendToggleBtn = document.getElementById('legend-toggle-btn');
  const mapLegend = document.getElementById('map-legend');
  if (legendToggleBtn && mapLegend) {
    legendToggleBtn.addEventListener('click', () => {
      mapLegend.classList.toggle('collapsed');
    });
  }

  // Mobile Segments
  const mobileButtons = document.querySelectorAll('.m-seg-btn');
  mobileButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.getAttribute('data-view');
      if (appContainer) appContainer.setAttribute('data-mobile-view', view);
      mobileButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      setTimeout(() => map.invalidateSize(), 200);
    });
  });
}

// =============================================================================
// 12. ENTRY POINT / INISIALISASI
// =============================================================================
window.addEventListener('DOMContentLoaded', () => {
  if (CONFIG) {
    if (CONFIG.projectTitle) {
      updateElementText('header-title', CONFIG.projectTitle);
      updateElementText('m-header-title', CONFIG.projectTitle);
    }
    if (CONFIG.projectSubtitle) {
      updateElementText('header-sub', CONFIG.projectSubtitle);
      updateElementText('m-header-sub', CONFIG.projectSubtitle);
    }
  }

  initLeafletMap();
  initCharts();
  setupEventListeners();
  loadAllData();
});
