# منصة آلين

نسخة منصة آلين للنشر على الويب.

## الملفات
- `index.html`
- `style.css`
- `app.js`
- `supabase_v15.sql`

## التشغيل
افتح `index.html` بالمتصفح، ثم أدخل:
- SUPABASE_URL
- anon public key

مهم: لا تضع `service_role key` داخل الواجهة.

## قبل التشغيل
1. افتح Supabase SQL Editor.
2. نفّذ `supabase_v15.sql`.
3. افتح Storage وتأكد من وجود bucket باسم `alin-files`.
4. للتجربة السريعة اجعل bucket public أو عدّل سياسات Storage بما يناسبك.

## ملاحظات أمان
هذه نسخة Direct للتجربة والتشغيل المجاني.
سياسات RLS داخل SQL مفتوحة حتى يشتغل الموقع مباشرة.
للاستخدام التجاري النهائي يجب تحويل الحسابات إلى Supabase Auth وسياسات أدق.
