@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
echo =============================================
echo   منصة آلين v4.0.2 - إصلاح مسار المندوب
echo =============================================
echo.
where powershell >nul 2>nul
if errorlevel 1 (
  echo لم يتم العثور على PowerShell.
  echo افتح ملف RUN_ON_SUPABASE_v4_0_2_COURIER_WORKFLOW.sql وانسخه يدوياً إلى Supabase SQL Editor.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content -LiteralPath '%~dp0RUN_ON_SUPABASE_v4_0_2_COURIER_WORKFLOW.sql' -Raw -Encoding UTF8 | Set-Clipboard"
echo تم نسخ تحديث قاعدة البيانات كاملاً.
start "" "https://supabase.com/dashboard/project/dgaikazhbtyjmswpyvrl/sql/new"
echo.
echo الصق النص داخل SQL Editor واضغط Run.
echo يجب أن تظهر: COURIER_WORKFLOW_V4_0_2_OK
echo.
echo بعد نجاح SQL ارجع إلى هذه النافذة واضغط أي مفتاح لنشر خدمة تحويل الطلب...
pause >nul
npx supabase functions deploy admin-assign-order --project-ref dgaikazhbtyjmswpyvrl
if errorlevel 1 (
  echo.
  echo فشل نشر خدمة التحويل. سجل الدخول في Supabase CLI ثم شغل الملف مرة ثانية.
  pause
  exit /b 1
)
echo.
echo UPDATE_OK_v4_0_2
echo ارفع ملفات النسخة إلى GitHub ثم افتح الموقع واضغط Ctrl+F5.
pause
