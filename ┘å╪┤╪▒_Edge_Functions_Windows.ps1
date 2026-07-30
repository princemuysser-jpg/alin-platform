param(
  [Parameter(Mandatory=$true)][string]$ProjectRef,
  [Parameter(Mandatory=$true)][string]$BootstrapKey,
  [Parameter(Mandatory=$true)][string]$AllowedOrigins
)
$ErrorActionPreference = 'Stop'
Write-Host '1/3 ربط المشروع...'
npx supabase link --project-ref $ProjectRef
Write-Host '2/3 حفظ الأسرار...'
npx supabase secrets set "ALIN_BOOTSTRAP_KEY=$BootstrapKey" "ALIN_ALLOWED_ORIGINS=$AllowedOrigins" --project-ref $ProjectRef
Write-Host '3/3 نشر الوظائف...'
npx supabase functions deploy bootstrap-first-admin --project-ref $ProjectRef --no-verify-jwt
npx supabase functions deploy secure-login --project-ref $ProjectRef --no-verify-jwt
npx supabase functions deploy admin-create-account --project-ref $ProjectRef
npx supabase functions deploy admin-update-account --project-ref $ProjectRef
npx supabase functions deploy admin-delete-account --project-ref $ProjectRef
npx supabase functions deploy admin-reset-password --project-ref $ProjectRef
Write-Host 'تم نشر وظائف منصة آلين.' -ForegroundColor Green
Write-Host 'بعد إنشاء أول مدير غيّر أو احذف ALIN_BOOTSTRAP_KEY واحذف setup-new-project.html من الموقع العام.' -ForegroundColor Yellow
