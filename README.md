# Alin Platform

منصة ويب/PWA لإدارة بيع الملازم والمنتجات، الطلبات، التوصيل، الحسابات، والعمليات المالية باستخدام Supabase.

## الحالة

- الإصدار: `2.0.3`
- الموقع: [https://princemuysser-jpg.github.io/alin-platform/](https://princemuysser-jpg.github.io/alin-platform/)
- الواجهة: HTML/CSS/JavaScript بدون خطوة build
- الخلفية: Supabase Database, Auth, Storage وEdge Functions
- الفحص المحلي: `npm test`
- CI: يعمل على Node.js 20 و22 و24 مع فحص تسريب الأسرار

## التشغيل المحلي

يتطلب Node.js 20 أو أحدث. بعد تنزيل المستودع:

```bash
npm test
npx serve .
```

افتح العنوان الذي يظهر في الطرفية. الصفحات الأساسية:

- `index.html`
- `store-desktop.html`
- `store-mobile.html`

## نشر Supabase

1. خذ نسخة احتياطية من قاعدة البيانات.
2. اختبر أولاً على مشروع staging.
3. شغّل `RUN_ON_SUPABASE_v2_0_3_IDEMPOTENT.sql`.
4. اضبط أسرار Edge Functions:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ALLOWED_ORIGINS=https://your-domain.example,https://www.your-domain.example
```

5. انشر الوظائف الموجودة في `supabase/functions`.
6. شغّل `CHECK_SUPABASE_READINESS_v2_0_3.sql`.
7. انشر ملفات الواجهة بعد نجاح الفحص.

لا تضع `SUPABASE_SERVICE_ROLE_KEY` داخل JavaScript أو GitHub أو ملفات الاستضافة.

## الاختبارات

```bash
npm test
npm run test:release
npm run test:security
```

فحص الإصدار يتحقق من مراجع الملفات، cache-busters، صياغة JavaScript واتساق الإصدار. فحص الأمان يتحقق من CORS، صلاحيات وظائف الإدارة، RPC الطلبات، وسياسة المخزون.

## قبل الإنتاج

- اختبر تسجيل الدخول لكل دور.
- اختبر إنشاء الطلب والكوبون ونفاد المخزون.
- تحقق من RLS بحسابات `anon` و`authenticated`.
- اضبط `ALLOWED_ORIGINS` قبل نشر Edge Functions.
- فعّل حماية إضافية للطلبات العامة مثل CAPTCHA أو rate limiting على بوابة الاستضافة.

## الأمان

راجع [SECURITY.md](SECURITY.md) للإبلاغ عن الثغرات والتعامل مع الأسرار.
