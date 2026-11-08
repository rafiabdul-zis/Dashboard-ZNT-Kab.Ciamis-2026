@echo off
chcp 65001 >nul
echo ========================================================
echo   UPLOAD DASHBOARD ZNT CIAMIS 2026 KE GITHUB
echo ========================================================
echo.
echo Pastikan Anda sudah membuat repository baru di GitHub:
echo (Contoh nama repo: Dashboard-ZNT-Kab.Ciamis-2026)
echo.

set /p REPO_URL="Masukkan URL Repository GitHub Anda (contoh: https://github.com/username/repo.git): "

if "%REPO_URL%"=="" (
    echo [ERROR] URL Repository tidak boleh kosong.
    pause
    exit /b
)

echo.
echo [1/4] Mengonfigurasi remote origin ke: %REPO_URL%
git remote remove origin 2>nul
git remote add origin %REPO_URL%

echo [2/4] Memeriksa perubahan terbaru...
git add .
git commit -m "Update Dashboard ZNT Kabupaten Ciamis 2026" 2>nul

echo [3/4] Mengunggah file ke branch main GitHub...
git push -u origin main

if %ERRORLEVEL% equ 0 (
    echo.
    echo ========================================================
    echo   BERHASIL DIUNGGAH KE GITHUB!
    echo ========================================================
    echo.
    echo Langkah terakhir agar website bisa diakses online:
    echo 1. Buka repo Anda di GitHub melalui browser.
    echo 2. Klik tab 'Settings' ^> 'Pages' di menu kiri.
    echo 3. Pada 'Branch', pilih 'main' dan '/ (root)', lalu klik 'Save'.
    echo 4. Dalam 1-2 menit dashboard Anda akan aktif online!
    echo.
) else (
    echo.
    echo [PERHATIAN] Upload memerlukan login atau Personal Access Token GitHub.
    echo Jika muncul jendela browser login GitHub, silakan klik 'Sign in with your browser'.
)

echo.
pause
