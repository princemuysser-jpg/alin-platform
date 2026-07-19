# تشغيل تحديث Supabase — منصة آلين v2.0.1

## 1) قاعدة البيانات

من Supabase افتح **SQL Editor** وشغّل الملف كاملاً:

`RUN_ON_SUPABASE_v1_4_3_COMPLETE.sql`

الملف يغلق صلاحيات `anon` الخطرة، ينظف كلمات المرور القديمة، يؤمّن الحسابات والمندوبين، وينشئ دالة الطلبات الآمنة `alin_create_store_orders`.

بعده شغّل:

`CHECK_SUPABASE_READINESS_v1_4_3.sql`

ويجب أن تظهر رسالة نجاح الإصدار 2.0.1.

## 2) Edge Functions

انشر الوظائف الأربع الموجودة داخل `supabase/functions`:

```bash
supabase functions deploy admin-create-account
supabase functions deploy admin-update-account
supabase functions deploy admin-reset-password
supabase functions deploy admin-delete-account
```

يجب أن تكون `SUPABASE_URL` و`SUPABASE_SERVICE_ROLE_KEY` متاحة داخل بيئة Edge Functions. لا تضع مفتاح `service_role` داخل ملفات الواجهة أو GitHub العام.

## 3) الحسابات القديمة

من لوحة المدير ضع كلمة مرور جديدة من 8 أحرف على الأقل لأي حساب قديم غير مربوط. النظام ينشئ مستخدم Supabase Auth ويربطه بالحساب نفسه، ثم يمسح أي كلمة مرور قديمة من جدول التطبيق.

## 4) رفع الواجهة

ارفع محتويات هذه الحزمة كاملة إلى GitHub ولا تخلطها مع ملفات إصدار أقدم. بعد النشر امسح كاش المتصفح أو افتح الموقع مرة واحدة مع تحديث إجباري.
