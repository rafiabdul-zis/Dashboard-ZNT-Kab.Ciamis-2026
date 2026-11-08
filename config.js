/**
 * =============================================================================
 * KONFIGURASI DASHBOARD ZNT KABUPATEN CIAMIS 2026
 * =============================================================================
 */

const CONFIG = {
  // 1. Informasi Proyek
  projectTitle: "DASHBOARD ZNT CIAMIS 2026",
  projectSubtitle: "Monitoring Pencapaian Titik Sampel Surveyor - Kab. Ciamis",
  defaultMapCenter: [-7.3095, 108.4447], // Pusat Wilayah Kabupaten Ciamis, Jawa Barat
  defaultZoom: 10,

  // 2. Link File Data Survei (Lokal & Online)
  samplePointsGeoJson: "data/titik_sampel_with_nozn.geojson",
  samplePointsCsv: "data/titik_sampel_with_nozn.csv",
  googleSheetsCsvUrl: "",
  autoRefreshIntervalSeconds: 30,

  // 3. Aturan Target Titik Sampel Berdasarkan Luas (dalam Hektar)
  areaTargetRules: {
    bracket1: { maxHa: 900, target: 3 },               // < 900 Ha -> 3 sampel
    bracket2: { minHa: 900, maxHa: 1250, target: 4 },   // 900 - 1250 Ha -> 4 sampel
    bracket3: { minHa: 1250, target: 5 },              // >= 1250 Ha -> 5 sampel
  },

  // 4. File GeoJSON Utama Proyek Ciamis
  geojsonSearchPaths: [
    "data/APL_CIAMIS.geojson",
    "data/ZONA_CIAMIS.geojson",
    "datazona_znt.geojson/APL_CIAMIS.geojson",
    "datazona_znt.geojson/ZONA_CIAMIS.geojson",
    "APL_CIAMIS.geojson",
    "ZONA_CIAMIS.geojson"
  ],

  // 5. Daftar 3 Surveyor Resmi Ciamis 2026
  surveyors: [
    {
      id: "agung",
      name: "Agung Fauzi",
      aliases: ["agung fauzi", "agung", "fauzi", "zona_agung_f"],
      color: "#10b981",     // Emerald Green
      accent: "#34d399"
    },
    {
      id: "zee",
      name: "Zee Treaz",
      aliases: ["zee treaz", "ze treaz", "zee", "treaz", "traz", "geranzo", "zona_zee_traz"],
      color: "#f59e0b",     // Amber Orange
      accent: "#fbbf24"
    },
    {
      id: "julio",
      name: "Julio Arya",
      aliases: ["julio arya", "julio", "arya", "anjar lesmana", "anjar", "zona_julio_arya"],
      color: "#3b82f6",     // Sky Blue
      accent: "#60a5fa"
    }
  ]
};
