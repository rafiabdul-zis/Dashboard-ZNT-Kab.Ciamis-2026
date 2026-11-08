@echo off
title Sinkronisasi Data SIPENTA - ZNT Ciamis 2026
echo ========================================================
echo   SINKRONISASI DATA SIPENTA ZNT KABUPATEN CIAMIS 2026
echo ========================================================
echo Memproses data survei terbaru dari folder SIPENTA...
"C:\Program Files\ArcGIS\Pro\bin\Python\envs\arcgispro-py3\python.exe" "%~dp0tools\build_ciamis_dataset.py"
echo.
echo Selesai. Silakan refresh dashboard Anda di browser.
pause
