# نشر Alin v2.0.3

1. خذ نسخة احتياطية من قاعدة البيانات الحالية.
2. شغّل `RUN_ON_SUPABASE_v2_0_3_IDEMPOTENT.sql` كاملاً في SQL Editor.
3. اضبط سر `ALLOWED_ORIGINS` بقائمة نطاقات الموقع المفصولة بفواصل، مثال:
   `https://alin.example,https://www.alin.example`
4. انشر Edge Functions الموجودة داخل `supabase/functions`.
5. شغّل `CHECK_SUPABASE_READINESS_v2_0_3.sql`.
6. إذا نجح الفحص، ارفع ملفات الموقع.
7. امسح Cache الموقع أو أعد تحميله؛ الإصدار الجديد يستخدم cache-buster رقم `2.0.3`.

لا تضع `SUPABASE_SERVICE_ROLE_KEY` في ملفات الواجهة. يجب أن يبقى داخل Secrets الخاصة بـ Supabase Edge Functions.
