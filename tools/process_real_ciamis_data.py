import os
import sys
import json
import arcpy
import pandas as pd

arcpy.env.overwriteOutput = True

base_dir = r"C:\Users\Rafi\.gemini\antigravity\scratch\Dashboard-ZNT-Kab.Ciamis-2026"
data_dir = os.path.join(base_dir, "data")
raw_qc_shp = os.path.join(data_dir, "raw", "qc", "QC_SURVEI071126.shp")
excel_path = r"C:\Users\Rafi\Documents\Proyek ZNT BPN\CIAMIS\Survei\QC\excel\Data-Survey_Kabupaten CIAMIS_01_2026_0054_20261108_014907.xlsx"

temp_dir = os.path.join(data_dir, "temp")
if not os.path.exists(temp_dir):
    os.makedirs(temp_dir)

def to_float(v, default=0.0):
    try:
        if v is None: return default
        s = str(v).strip()
        if not s: return default
        return float(s)
    except:
        return default

def to_int(v, default=0):
    try:
        if v is None: return default
        s = str(v).strip()
        if not s: return default
        return int(float(s))
    except:
        return default

print("1. Reprojecting QC_SURVEI071126.shp to WGS84...")
wgs84 = arcpy.SpatialReference(4326)
qc_wgs84_shp = os.path.join(temp_dir, "qc_wgs84.shp")
if not arcpy.Exists(qc_wgs84_shp):
    arcpy.management.Project(raw_qc_shp, qc_wgs84_shp, wgs84)

print("2. Creating dissolved APL boundary...")
apl_temp_shp = os.path.join(temp_dir, "apl_dissolve.shp")
if not arcpy.Exists(apl_temp_shp):
    arcpy.management.Dissolve(qc_wgs84_shp, apl_temp_shp)

print("3. Exporting ZONA_CIAMIS.geojson...")
fields = [f.name for f in arcpy.ListFields(qc_wgs84_shp) if f.type not in ('Geometry', 'OID')]

features = []
with arcpy.da.SearchCursor(qc_wgs84_shp, fields + ['SHAPE@JSON']) as cursor:
    for row in cursor:
        props = {}
        for i, f in enumerate(fields):
            val = row[i]
            if f in ('Luas_M2', 'Shape_Area', 'Shape_Leng'):
                props[f] = round(to_float(val), 2)
            elif f in ('Rata_Nilai', 'NILAIZN', 'NILBULAT', 'NILMIN', 'NILMAKS'):
                props[f] = to_int(val)
            elif f in ('RSD_Persen', 'SMPBKREL'):
                props[f] = round(to_float(val), 2)
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
        props['Luas_Ha'] = round(to_float(luas_m2) / 10000.0, 2)

        # Parse geometry
        geom_json = json.loads(row[-1])
        rings = geom_json.get("rings", [])
        
        def round_coords(c):
            if isinstance(c[0], (int, float)):
                return [round(c[0], 6), round(c[1], 6)]
            return [round_coords(sub) for sub in c]

        features.append({
            "type": "Feature",
            "properties": props,
            "geometry": {
                "type": "Polygon",
                "coordinates": round_coords(rings)
            }
        })

zona_geojson = {
    "type": "FeatureCollection",
    "features": features
}

zona_path = os.path.join(data_dir, "ZONA_CIAMIS.geojson")
with open(zona_path, "w", encoding="utf-8") as f:
    json.dump(zona_geojson, f)
print(f"   Exported {len(features)} zones to {zona_path}")

print("4. Exporting APL_CIAMIS.geojson...")
apl_features = []
with arcpy.da.SearchCursor(apl_temp_shp, ['SHAPE@JSON']) as cursor:
    for row in cursor:
        geom_json = json.loads(row[0])
        rings = geom_json.get("rings", [])
        def round_coords(c):
            if isinstance(c[0], (int, float)):
                return [round(c[0], 6), round(c[1], 6)]
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
apl_path = os.path.join(data_dir, "APL_CIAMIS.geojson")
with open(apl_path, "w", encoding="utf-8") as f:
    json.dump(apl_geojson, f)
print(f"   Exported APL to {apl_path}")

print("5. Processing SIPENTA Excel points (1340 rows)...")
df_excel = pd.read_excel(excel_path)

points_shp = os.path.join(temp_dir, "points_wgs84.shp")
if arcpy.Exists(points_shp):
    arcpy.management.Delete(points_shp)
arcpy.management.CreateFeatureclass(temp_dir, "points_wgs84.shp", "POINT", spatial_reference=wgs84)

arcpy.management.AddField(points_shp, "No", "LONG", field_is_nullable="NULLABLE")
arcpy.management.AddField(points_shp, "NoSampel", "TEXT", field_length=50, field_is_nullable="NULLABLE")
arcpy.management.AddField(points_shp, "Surveyor", "TEXT", field_length=100, field_is_nullable="NULLABLE")
arcpy.management.AddField(points_shp, "Tgl", "TEXT", field_length=20, field_is_nullable="NULLABLE")
arcpy.management.AddField(points_shp, "JenisData", "TEXT", field_length=30, field_is_nullable="NULLABLE")
arcpy.management.AddField(points_shp, "GunaObjek", "TEXT", field_length=50, field_is_nullable="NULLABLE")
arcpy.management.AddField(points_shp, "Alamat", "TEXT", field_length=254, field_is_nullable="NULLABLE")
arcpy.management.AddField(points_shp, "Kelurahan", "TEXT", field_length=100, field_is_nullable="NULLABLE")
arcpy.management.AddField(points_shp, "Kecamatan", "TEXT", field_length=100, field_is_nullable="NULLABLE")
arcpy.management.AddField(points_shp, "Luas", "DOUBLE", field_is_nullable="NULLABLE")
arcpy.management.AddField(points_shp, "Harga", "DOUBLE", field_is_nullable="NULLABLE")
arcpy.management.AddField(points_shp, "NilaiPerM2", "DOUBLE", field_is_nullable="NULLABLE")
arcpy.management.AddField(points_shp, "Zoning", "TEXT", field_length=100, field_is_nullable="NULLABLE")

insert_fields = ["SHAPE@XY", "No", "NoSampel", "Surveyor", "Tgl", "JenisData", "GunaObjek", "Alamat", "Kelurahan", "Kecamatan", "Luas", "Harga", "NilaiPerM2", "Zoning"]

with arcpy.da.InsertCursor(points_shp, insert_fields) as cursor:
    for idx, row in df_excel.iterrows():
        try:
            x_val = float(row['X']) if pd.notnull(row['X']) else None
            y_val = float(row['Y']) if pd.notnull(row['Y']) else None
        except:
            continue
        if not x_val or not y_val or abs(x_val) > 180 or abs(y_val) > 90:
            continue
        
        no = to_int(row.get('Nomor Sampel'), idx + 1)
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
        
        luas = to_float(row.get('Luas tanah (m2)'))
        harga_cols = [c for c in df_excel.columns if 'Harga Penawaran' in c]
        harga = to_float(row[harga_cols[0]]) if harga_cols else 0.0
        
        nilai_m2 = to_float(row.get('Nilai Tanah/m2'))
        if nilai_m2 == 0.0 and luas > 0:
            nilai_m2 = round(harga / luas, 2)
        zoning = str(row.get('Zoning/ Peruntukan', '')).strip()
        
        cursor.insertRow([(x_val, y_val), no, no_sampel, surv, tgl, jenis, guna, alamat, kel, kec, float(luas), float(harga), float(nilai_m2), zoning])

print("6. Spatial Joining points with zones...")
joined_points_shp = os.path.join(temp_dir, "points_joined.shp")
if arcpy.Exists(joined_points_shp):
    arcpy.management.Delete(joined_points_shp)
arcpy.analysis.SpatialJoin(points_shp, qc_wgs84_shp, joined_points_shp, "JOIN_ONE_TO_ONE", "KEEP_ALL", match_option="INTERSECT")

print("7. Exporting titik_sampel_with_nozn.geojson and CSV...")
point_features = []
csv_rows = []

with arcpy.da.SearchCursor(joined_points_shp, ['SHAPE@XY', 'No', 'NoSampel', 'Surveyor', 'Tgl', 'JenisData', 'GunaObjek', 'Alamat', 'Kelurahan', 'Kecamatan', 'Luas', 'Harga', 'NilaiPerM2', 'Zoning', 'NOZN', 'HISTZONE']) as cursor:
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
            "X": round(pt_xy[0], 6),
            "Y": round(pt_xy[1], 6)
        }
        
        point_features.append({
            "type": "Feature",
            "properties": prop_item,
            "geometry": {
                "type": "Point",
                "coordinates": [round(pt_xy[0], 6), round(pt_xy[1], 6)]
            }
        })
        csv_rows.append(prop_item)

points_geojson = {
    "type": "FeatureCollection",
    "features": point_features
}

points_path = os.path.join(data_dir, "titik_sampel_with_nozn.geojson")
with open(points_path, "w", encoding="utf-8") as f:
    json.dump(points_geojson, f)

csv_path = os.path.join(data_dir, "titik_sampel_with_nozn.csv")
df_out = pd.DataFrame(csv_rows)
df_out.to_csv(csv_path, index=False, encoding="utf-8")

print(f"   Exported {len(point_features)} points to GeoJSON and CSV.")

print("8. Generating data_embedded.js...")
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

print("All real data processing completed successfully!")
