# Security Policy

## Supported version

يتم دعم أحدث إصدار موجود على الفرع `main`.

## Reporting a vulnerability

لا تنشر الثغرات أو المفاتيح في Issue عام. استخدم GitHub Private Vulnerability Reporting إن كان مفعلاً، أو تواصل بصورة خاصة مع مالك المستودع.

ضمّن وصف المشكلة، خطوات إعادة الإنتاج، التأثير المتوقع، والإصدار المتأثر. لا تضمّن كلمات مرور أو مفاتيح Supabase حقيقية.

## Secrets

- `SUPABASE_SERVICE_ROLE_KEY` مسموح داخل Supabase Edge Function secrets فقط.
- مفتاح `anon` عام بطبيعته، لكن RLS يجب أن يحمي كل البيانات.
- يجب تدوير أي مفتاح سري يظهر في commit أو log فوراً.
- اضبط `ALLOWED_ORIGINS` بقائمة نطاقات مفصولة بفواصل قبل نشر وظائف الإدارة.

## Production checklist

- نجاح GitHub Actions.
- نجاح `CHECK_SUPABASE_READINESS_v2_0_3.sql`.
- اختبار RLS لجميع الأدوار.
- نسخ احتياطي حديث ومختبر.
- تفعيل rate limiting أو CAPTCHA لمسار إنشاء الطلبات العامة.
