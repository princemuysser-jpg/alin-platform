@echo off
setlocal
cd /d "%~dp0"
echo Deploying secure courier assignment fix...
npx supabase functions deploy admin-assign-order --project-ref dgaikazhbtyjmswpyvrl
if errorlevel 1 (
  echo.
  echo DEPLOY_FAILED
  echo Make sure Supabase CLI is logged in, then run this file again.
) else (
  echo.
  echo DEPLOY_OK
)
pause
