import os
import sys
import math
import json
import arcpy
import pandas as pd

arcpy.env.overwriteOutput = True

base_dir = r"C:\Users\Rafi\.gemini\antigravity\scratch\Dashboard-ZNT-Kab.Ciamis-2026"
data_dir = os.path.join(base_dir, "data")
raw_qc_shp = os.path.join(data_dir, "raw", "qc", "QC_SURVEI071126.shp")
excel_dir = r"C:\Users\Rafi\Documents\Proyek ZNT BPN\CIAMIS\Survei\QC\excel"
excel_path = None
if os.path.exists(excel_dir):
    excels = [os.path.join(excel_dir, f) for f in os.listdir(excel_dir) if f.lower().endswith('.xlsx') and not f.startswith('~$')]
    if excels:
        excels.sort(key=os.path.getmtime, reverse=True)
        excel_path = excels[0]

if not excel_path or not os.path.exists(excel_path):
    downloads = os.path.join(os.environ.get("USERPROFILE", ""), "Downloads")
    dl_excels = [os.path.join(downloads, f) for f in os.listdir(downloads) if f.lower().endswith('.xlsx') and 'survey' in f.lower() and not f.startswith('~$')]
    if dl_excels:
        dl_excels.sort(key=os.path.getmtime, reverse=True)
        excel_path = dl_excels[0]

if not excel_path:
    excel_path = r"C:\Users\Rafi\Documents\Proyek ZNT BPN\CIAMIS\Survei\QC\excel\Data-Survey_Kabupaten CIAMIS_01_2026_0054_20261108_014907.xlsx"

print(f"Menggunakan file Excel SIPENTA: {os.path.basename(excel_path)}")

scratch_gdb = arcpy.env.scratchGDB
wgs84 = arcpy.SpatialReference(4326)

def clean_float(v, default=0.0):
    if v is None or pd.isna(v):
        return default
    try:
        f = float(str(v).strip())
        if math.isnan(f) or math.isinf(f):
            return default
        return f
    except:
        return default

def clean_int(v, default=0):
    if v is None or pd.isna(v):
        return default
    try:
        f = float(str(v).strip())
        if math.isnan(f) or math.isinf(f):
            return default
        return int(f)
    except:
        return default

print("1. Reprojecting QC_SURVEI071126 to WGS84...")
qc_fc = os.path.join(scratch_gdb, "qc_ciamis_wgs84")
if arcpy.Exists(qc_fc):
    arcpy.management.Delete(qc_fc)
arcpy.management.Project(raw_qc_shp, qc_fc, wgs84)

print("2. Simplifying zone polygons (5m tolerance) for optimal web performance...")
qc_simp = os.path.join(scratch_gdb, "qc_ciamis_simp")
if arcpy.Exists(qc_simp):
    arcpy.management.Delete(qc_simp)
arcpy.cartography.SimplifyPolygon(qc_fc, qc_simp, "POINT_REMOVE", "5 Meters")

print("3. Dissolving outer boundary for APL_CIAMIS...")
apl_fc = os.path.join(scratch_gdb, "apl_dissolve")
if arcpy.Exists(apl_fc):
    arcpy.management.Delete(apl_fc)
try:
    arcpy.management.RepairGeometry(qc_fc)
    arcpy.management.Dissolve(qc_fc, apl_fc)
except Exception as e:
    print(f"   Dissolve warning: {e}")

print("4. Exporting ZONA_CIAMIS.geojson...")
zone_features = []
qc_fields = [f.name for f in arcpy.ListFields(qc_simp) if f.type not in ('Geometry', 'OID', 'GlobalID', 'Raster', 'Blob')]

with arcpy.da.SearchCursor(qc_simp, qc_fields + ['SHAPE@JSON']) as cursor:
    for row in cursor:
        props = {}
        for i, f in enumerate(qc_fields):
            val = row[i]
            if f in ('Luas_M2', 'Shape_Area', 'Shape_Leng'):
                props[f] = round(clean_float(val), 2)
            elif f in ('Rata_Nilai', 'NILAIZN', 'NILBULAT', 'NILMIN', 'NILMAKS'):
                props[f] = clean_int(val)
            elif f in ('RSD_Persen', 'SMPBKREL'):
                props[f] = round(clean_float(val), 2)
            elif f in ('NOZN', 'cluster', 'Jml_Titik'):
                props[f] = str(val).strip() if val is not None else ""
            else:
                props[f] = str(val).strip() if val is not None else ""

        # Normalize Surveyor name
        surv = props.get('Surveyor') or props.get('SURVEYOR') or props.get('N_SURVEYOR') or ''
        if 'ze' in surv.lower():
            props['Surveyor'] = 'Zee Treaz'
        elif 'agung' in surv.lower():
            props['Surveyor'] = 'Agung Fauzi'
        elif 'julio' in surv.lower():
            props['Surveyor'] = 'Julio Arya'
        else:
            props['Surveyor'] = surv

        # Luas Ha
        luas_m2 = props.get('Luas_M2', 0) or props.get('Shape_Area', 0)
        props['Luas_Ha'] = round(clean_float(luas_m2) / 10000.0, 2)

        # Parse geometry
        geom_json = json.loads(row[-1])
        rings = geom_json.get("rings", [])
        
        def round_coords(c):
            if isinstance(c[0], (int, float)):
                return [round(c[0], 5), round(c[1], 5)]
            return [round_coords(sub) for sub in c]

        zone_features.append({
            "type": "Feature",
            "properties": props,
            "geometry": {
                "type": "Polygon",
                "coordinates": round_coords(rings)
            }
        })

zona_geojson = {
    "type": "FeatureCollection",
    "features": zone_features
}

zona_path = os.path.join(data_dir, "ZONA_CIAMIS.geojson")
with open(zona_path, "w", encoding="utf-8") as f:
    json.dump(zona_geojson, f, separators=(',', ':'))
print(f"   Exported {len(zone_features)} zones to {zona_path}")

print("5. Exporting APL_CIAMIS.geojson...")
apl_path = os.path.join(data_dir, "APL_CIAMIS.geojson")
if arcpy.Exists(apl_fc):
    apl_features = []
    with arcpy.da.SearchCursor(apl_fc, ['SHAPE@JSON']) as cursor:
        for row in cursor:
            geom_json = json.loads(row[0])
            rings = geom_json.get("rings", [])
            def round_coords(c):
                if isinstance(c[0], (int, float)):
                    return [round(c[0], 5), round(c[1], 5)]
                return [round_coords(sub) for sub in c]
            apl_features.append({
                "type": "Feature",
                "properties": {"KABUPATEN": "CIAMIS", "PROVINSI": "JAWA BARAT"},
                "geometry": {
                    "type": "Polygon",
                    "coordinates": round_coords(rings)
                }
            })

    apl_geojson = {
        "type": "FeatureCollection",
        "features": apl_features
    }
    with open(apl_path, "w", encoding="utf-8") as f:
        json.dump(apl_geojson, f, separators=(',', ':'))
    print(f"   Exported APL to {apl_path}")
else:
    print(f"   Using existing {apl_path}")

print("6. Loading SIPENTA Excel and creating Points FC in Scratch GDB...")
df_excel = pd.read_excel(excel_path)
print(f"   Read {len(df_excel)} rows from {os.path.basename(excel_path)}")

points_fc = os.path.join(scratch_gdb, "points_ciamis_wgs84")
if arcpy.Exists(points_fc):
    arcpy.management.Delete(points_fc)
arcpy.management.CreateFeatureclass(scratch_gdb, "points_ciamis_wgs84", "POINT", spatial_reference=wgs84)

fields_to_add = [
    ("No", "LONG"),
    ("NoSampel", "TEXT"),
    ("Surveyor", "TEXT"),
    ("Tgl", "TEXT"),
    ("JenisData", "TEXT"),
    ("GunaObjek", "TEXT"),
    ("Alamat", "TEXT"),
    ("Kelurahan", "TEXT"),
    ("Kecamatan", "TEXT"),
    ("Luas", "DOUBLE"),
    ("Harga", "DOUBLE"),
    ("NilaiPerM2", "DOUBLE"),
    ("Zoning", "TEXT")
]
for fname, ftype in fields_to_add:
    arcpy.management.AddField(points_fc, fname, ftype)

insert_cols = ["SHAPE@XY"] + [f[0] for f in fields_to_add]

valid_points_count = 0
with arcpy.da.InsertCursor(points_fc, insert_cols) as cursor:
    for idx, row in df_excel.iterrows():
        x = clean_float(row.get('X'))
        y = clean_float(row.get('Y'))
        if not x or not y or abs(x) > 180 or abs(y) > 90:
            continue
        
        no = clean_int(row.get('Nomor Sampel'), idx + 1)
        no_sampel = str(row.get('Nomor Identifikasi', f"#{no}")).strip()
        
        surv_raw = str(row.get('Nama Surveyor', '')).strip()
        if 'ze' in surv_raw.lower():
            surv = 'Zee Treaz'
        elif 'agung' in surv_raw.lower():
            surv = 'Agung Fauzi'
        elif 'julio' in surv_raw.lower():
            surv = 'Julio Arya'
        else:
            surv = surv_raw
            
        tgl_raw = str(row.get('Tanggal Pelaksanaan', ''))
        tgl = tgl_raw[:10] if len(tgl_raw) >= 10 else ""
        jenis = str(row.get('Jenis Data', 'Penawaran')).strip()
        guna = str(row.get('Bangunan (B)/Ruko(R)/ Tanah Kosong (TK)', '')).strip()
        alamat = str(row.get('Alamat', ''))[:250].strip()
        kel = str(row.get('Kelurahan', '')).strip()
        kec = str(row.get('Kecamatan', '')).strip()
        
        luas = clean_float(row.get('Luas tanah (m2)'))
        harga_cols = [c for c in df_excel.columns if 'Harga Penawaran' in c]
        harga = clean_float(row[harga_cols[0]]) if harga_cols else 0.0
        
        nilai_m2 = clean_float(row.get('Nilai Tanah/m2'))
        if nilai_m2 == 0.0 and luas > 0:
            nilai_m2 = round(harga / luas, 2)
        zoning = str(row.get('Zoning/ Peruntukan', '')).strip()
        
        cursor.insertRow([(x, y), no, no_sampel, surv, tgl, jenis, guna, alamat, kel, kec, luas, harga, nilai_m2, zoning])
        valid_points_count += 1

print(f"   Inserted {valid_points_count} valid point geometries.")

print("7. Performing Spatial Join between Points and Zones...")
joined_fc = os.path.join(scratch_gdb, "points_joined")
if arcpy.Exists(joined_fc):
    arcpy.management.Delete(joined_fc)
arcpy.analysis.SpatialJoin(points_fc, qc_simp, joined_fc, "JOIN_ONE_TO_ONE", "KEEP_ALL", match_option="INTERSECT")

print("8. Exporting titik_sampel_with_nozn.geojson and CSV...")
point_features = []
csv_rows = []

search_cols = ['SHAPE@XY', 'No', 'NoSampel', 'Surveyor', 'Tgl', 'JenisData', 'GunaObjek', 'Alamat', 'Kelurahan', 'Kecamatan', 'Luas', 'Harga', 'NilaiPerM2', 'Zoning', 'NOZN', 'HISTZONE']

with arcpy.da.SearchCursor(joined_fc, search_cols) as cursor:
    for row in cursor:
        pt_xy = row[0]
        no = row[1]
        no_sampel = row[2]
        surv = row[3]
        tgl = row[4]
        jenis = row[5]
        guna = row[6]
        alamat = row[7]
        kel = row[8]
        kec = row[9]
        luas = row[10]
        harga = row[11]
        nilai_m2 = row[12]
        zoning = row[13]
        nozn = str(row[14]).strip() if row[14] is not None else ""
        histzone = str(row[15]).strip() if row[15] is not None else ""
        
        prop_item = {
            "No": no,
            "NoSampel": no_sampel,
            "NOZN": nozn,
            "HISTZONE": histzone,
            "Surveyor": surv,
            "Tgl": tgl,
            "JenisData": jenis,
            "GunaObjek": guna,
            "Alamat": alamat,
            "Kelurahan": kel,
            "Kecamatan": kec,
            "Luas": luas,
            "Harga": harga,
            "NilaiPerM2": nilai_m2,
            "Zoning": zoning,
            "X": round(pt_xy[0], 5),
            "Y": round(pt_xy[1], 5)
        }
        
        point_features.append({
            "type": "Feature",
            "properties": prop_item,
            "geometry": {
                "type": "Point",
                "coordinates": [round(pt_xy[0], 5), round(pt_xy[1], 5)]
            }
        })
        csv_rows.append(prop_item)

points_geojson = {
    "type": "FeatureCollection",
    "features": point_features
}

points_path = os.path.join(data_dir, "titik_sampel_with_nozn.geojson")
with open(points_path, "w", encoding="utf-8") as f:
    json.dump(points_geojson, f, separators=(',', ':'))

csv_path = os.path.join(data_dir, "titik_sampel_with_nozn.csv")
df_out = pd.DataFrame(csv_rows)
df_out.to_csv(csv_path, index=False, encoding="utf-8")

print(f"   Exported {len(point_features)} points to GeoJSON and CSV.")

print("9. Generating data_embedded.js...")
with open(zona_path, "r", encoding="utf-8") as fz:
    z_str = fz.read()
with open(apl_path, "r", encoding="utf-8") as fa:
    a_str = fa.read()
with open(points_path, "r", encoding="utf-8") as fp:
    p_str = fp.read()

embedded_js_path = os.path.join(data_dir, "data_embedded.js")
with open(embedded_js_path, "w", encoding="utf-8") as fe:
    fe.write("window.CIAMIS_DATA = {\n")
    fe.write("  zones: " + z_str + ",\n")
    fe.write("  apl: " + a_str + ",\n")
    fe.write("  points: " + p_str + "\n")
    fe.write("};\n")

print("All real Ciamis data successfully processed!")
