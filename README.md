# 🗺️ DASHBOARD MONITORING ZONA NILAI TANAH (ZNT) KABUPATEN CIAMIS 2026

Dashboard interaktif berbasis Web GIS modern untuk monitoring dan evaluasi pencapaian titik sampel surveyor Zona Nilai Tanah (ZNT) di wilayah **Kabupaten Ciamis, Jawa Barat**.

Didesain dan dikembangkan dengan arsitektur, tampilan, dan fungsionalitas identik dengan standar [Dashboard ZNT Cilacap 2026](https://almanzra99-prog.github.io/Dashboard-ZNT-Kab.Cilacap-2026/), dan telah dimuat dengan **data riil resmi Kabupaten Ciamis**:
- **490 Poligon Zona Kajian ZNT Kabupaten Ciamis** (dari data shapefile BPN Ciamis).
- **1.340 Titik Sampel Survei Lapangan SIPENTA** lengkap dengan koordinat spasial, harga penawaran/transaksi, luasan tanah, dan nilai per $m^2$.
- **3 Surveyor Resmi Kabupaten Ciamis 2026**:
  1. 🟢 **Agung Fauzi** (Warna: Emerald Green `#10b981`)
  2. 🟡 **Zee Treaz** (Warna: Amber Orange `#f59e0b`)
  3. 🔵 **Julio Arya** (Warna: Sky Blue `#3b82f6`)

---

## 🌟 Fitur Utama Dashboard

1. **Peta Interaktif Web GIS (Leaflet.js)**:
   - Visualisasi poligon batas Zona Nilai Tanah (490 Zona) dan batas APL Kabupaten Ciamis.
   - Sistem koordinat otomatis mendukung **TM-3° Zone 49.1 (EPSG:23835)** dan **WGS84** menggunakan Proj4js.
   - Pilihan peta dasar (*Basemap Switcher*): **OpenStreetMap** dan **Citra Satelit Esri Resolusi Tinggi**.
   - Popup informatif poligon zona menampilkan: Nomor Zona (NOZN), HISTZONE, Surveyor, Luasan Zona (Ha), Target Wajib Titik, Titik Lapangan, Kualitas Data QC SIPENTA (Status QC, Rata-rata Nilai Tanah/m², dan RSD %).
   - Popup titik sampel menampilkan: Nomor Identifikasi Survei, Jenis Data (Transaksi / Penawaran), Surveyor, Alamat, Kelurahan, Kecamatan, Nilai Tanah/m², dan Tanggal Pelaksanaan.

2. **3 Mode Pewarnaan Poligon Peta**:
   - **Mode 1 (Per Surveyor)**: Warna zona mengikuti identitas warna masing-masing dari 3 surveyor (Agung Fauzi, Zee Treaz, Julio Arya) dengan intensitas opasitas berdasarkan capaian target titik.
   - **Mode 2 (Status Target)**:
     - 🟢 **Hijau**: Target titik sampel terpenuhi ($\ge$ target luasan).
     - 🟡 **Kuning**: Proses survei berjalan (1 s.d. target minus 1 titik).
     - 🔴 **Merah**: Belum ada titik sampel yang disurvei.
   - **Mode 3 (Kualitas Data QC SIPENTA)**: Menilai kepatuhan teknis sebaran nilai tanah:
     - 🟢 **Lengkap & Valid**: RSD $\le$ 30% dan kuota titik terpenuhi.
     - 🟠 **Perlu Revisi**: RSD > 30% atau 0% (variasi harga terlalu tinggi / titik perlu diverifikasi).
     - 🔵 **Kurang Lengkap**: Menunggu minimal 3 titik sampel.
     - ⚪ **Belum Disurvey**: Belum ada data survei masuk.

3. **Logika Target Luasan & Aturan Capaian Aktual (Capped Calculation)**:
   - Target luas fisik zona: **< 900 Ha (3 titik)** | **900 – 1.250 Ha (4 titik)** | **$\ge$ 1.250 Ha (5 titik)**.
   - Kelebihan sampel di zona yang sama tidak menambah capaian zona lain (menghitung titik efektif vs total fisik sampel).

4. **Panel Analitik & Grafik Visual**:
   - **Donut Chart**: Persentase pemenuhan target titik aktual se-kabupaten.
   - **Bar Chart**: Tren jumlah survei titik harian.
   - **Log Sampel Terbaru**: Riwayat data sampel masuk yang dapat diklik untuk langsung mengarahkan peta ke koordinat titik (*Fly to Location*).
   - **Filter Surveyor**: Menyaring peta, grafik, dan statistik secara *real-time*.

---

## 📁 Struktur Direktori Proyek

```
Dashboard-ZNT-Kab.Ciamis-2026/
├── index.html                   # Halaman antarmuka utama dashboard
├── style.css                    # Berkas stylesheet modern dark theme
├── config.js                    # Konfigurasi wilayah, surveyor, dan aturan target
├── app.js                       # Logika peta GIS, grafik, kalkulasi QC, & filter
├── run_server.bat               # Peluncur server lokal otomatis (klik ganda)
├── UPDATE_DATA.bat              # Script update otomatis hasil survei SIPENTA
├── README.md                    # Dokumentasi panduan penggunaan
├── data/
│   ├── ZONA_CIAMIS.geojson      # 490 poligon resmi batas zona ZNT Kabupaten Ciamis
│   ├── APL_CIAMIS.geojson       # Batas luar wilayah APL Kabupaten Ciamis
│   ├── titik_sampel_with_nozn.geojson # 1.340 titik sampel survei SIPENTA
│   ├── titik_sampel_with_nozn.csv     # Data tabel CSV titik sampel hasil spatial join
│   └── data_embedded.js         # Cadangan data offline langsung tanpa web server
└── tools/
    ├── serve.ps1                # Server HTTP lokal berbasis PowerShell
    ├── build_ciamis_dataset.py  # Pipeline pemrosesan Shapefile & Excel SIPENTA
    └── update_sipenta.ps1       # Script sinkronisasi data SIPENTA
```

---

## 🚀 Cara Menjalankan Dashboard

### Cara 1: Menggunakan Peluncur Lokal (Sangat Direkomendasikan)
Cukup klik ganda pada berkas:
👉 **`run_server.bat`**

Browser Anda (Chrome, Edge, Firefox) akan otomatis terbuka dan menampilkan dashboard di alamat:
`http://localhost:8080/`

### Cara 2: Buka Langsung Tanpa Web Server (Offline)
Anda juga dapat langsung mengklik ganda berkas **`index.html`** pada File Explorer. Dashboard telah dilengkapi *embedded fallback data* sehingga tetap berfungsi sempurna tanpa terhalang kebijakan CORS peramban.

### Cara 3: Publikasikan ke GitHub Pages (Online Gratis)
Agar rekan-rekan tim surveyor dan pimpinan kantor BPN dapat membukanya secara online dari HP atau laptop masing-masing:
1. Buat repository baru di [GitHub](https://github.com/new) (misal bernama: `Dashboard-ZNT-Kab.Ciamis-2026`).
2. Klik ganda berkas **`PUSH_TO_GITHUB.bat`**, lalu masukkan link repository GitHub Anda.
3. Buka menu **Settings** > **Pages** di repositori GitHub Anda.
4. Pada opsi *Build and deployment*, pilih Branch `main` (folder `/root`), lalu klik **Save**.
5. Dashboard Anda akan aktif di alamat:
   `https://<username-anda>.github.io/Dashboard-ZNT-Kab.Ciamis-2026/`

---

## 🔄 Cara Memperbarui Data Hasil Survei dari SIPENTA

Setiap kali Anda mengunduh file Excel terbaru dari aplikasi **SIPENTA BPN** (misal disimpan di folder `Survei\QC\excel\` atau folder `Downloads`):
1. Cukup klik ganda berkas **`UPDATE_DATA.bat`**.
2. Program akan secara otomatis:
   - Mendeteksi file Excel SIPENTA paling baru.
   - Melakukan *Spatial Join* antara titik koordinat sampel dan 490 poligon zona Ciamis.
   - Menghubungkan setiap titik ke Nomor Zona (NOZN) dan HISTZONE.
   - Memperbarui file `titik_sampel_with_nozn.geojson`, `titik_sampel_with_nozn.csv`, dan `data_embedded.js`.
3. Buka atau *refresh* browser Anda untuk melihat data dan grafik yang telah terbarui.
