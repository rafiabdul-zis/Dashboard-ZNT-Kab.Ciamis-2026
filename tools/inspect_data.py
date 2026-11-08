import arcpy
import pandas as pd
import json

zona_shp = r"C:\Users\Rafi\.gemini\antigravity\scratch\Dashboard-ZNT-Kab.Ciamis-2026\data\raw\zona\Zona_Ciamis_0711.shp"
qc_shp = r"C:\Users\Rafi\.gemini\antigravity\scratch\Dashboard-ZNT-Kab.Ciamis-2026\data\raw\qc\QC_SURVEI071126.shp"
excel_path = r"C:\Users\Rafi\Documents\Proyek ZNT BPN\CIAMIS\Survei\QC\excel\Data-Survey_Kabupaten CIAMIS_01_2026_0054_20261108_014907.xlsx"

print("--- ZONA SHP FIELDS ---")
fields_zona = [f.name for f in arcpy.ListFields(zona_shp)]
print(fields_zona)

print("\n--- SAMPLE ROW ZONA ---")
with arcpy.da.SearchCursor(zona_shp, fields_zona[:12]) as cursor:
    for i, row in enumerate(cursor):
        print(row)
        if i >= 3:
            break

print("\n--- SURVEYOR IN ZONA ---")
surveyor_field = None
for f in fields_zona:
    if "surv" in f.lower() or "nama" in f.lower():
        surveyor_field = f
        break
print(f"Surveyor field found: {surveyor_field}")

if surveyor_field:
    surveyors = set()
    with arcpy.da.SearchCursor(zona_shp, [surveyor_field]) as cursor:
        for row in cursor:
            if row[0]:
                surveyors.add(row[0])
    print(f"Unique surveyors in zona: {surveyors}")

print("\n--- QC SHP FIELDS ---")
fields_qc = [f.name for f in arcpy.ListFields(qc_shp)]
print(fields_qc)

with arcpy.da.SearchCursor(qc_shp, fields_qc[:15]) as cursor:
    for i, row in enumerate(cursor):
        print(row)
        if i >= 3:
            break

print("\n--- EXCEL SIPENTA ---")
df_excel = pd.read_excel(excel_path)
print(f"Excel shape: {df_excel.shape}")
print(f"Columns: {list(df_excel.columns[:15])}")
if "Nama Surveyor" in df_excel.columns:
    print(f"Surveyors in Excel: {df_excel['Nama Surveyor'].dropna().unique()}")
