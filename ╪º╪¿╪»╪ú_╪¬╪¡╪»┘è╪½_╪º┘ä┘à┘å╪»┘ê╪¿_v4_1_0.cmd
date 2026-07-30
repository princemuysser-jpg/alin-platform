@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
set "SQL_FILE=%~dp0database\COURIER_REBUILD_V4_1_0.sql"
if not exist "%SQL_FILE%" (
  echo لم يتم العثور على ملف التحديث الصحيح:
  echo %SQL_FILE%
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content -LiteralPath '%SQL_FILE%' -Raw -Encoding UTF8 ^| Set-Clipboard"
if errorlevel 1 (
  echo تعذر نسخ SQL إلى الحافظة. افتح الملف يدوياً من مجلد database.
  pause
  exit /b 1
)
echo تم نسخ ملف التحديث الموحد v4.1.0 إلى الحافظة.
echo سيفتح الآن موقع Supabase. اختر مشروع آلين الحالي ثم SQL Editor، الصق واضغط Run مرة واحدة.
echo لا تنفذ ALIN_V4_CLEAN_PROJECT_MASTER.sql على مشروعك الحالي.
start "" "https://supabase.com/dashboard/projects"
pause
