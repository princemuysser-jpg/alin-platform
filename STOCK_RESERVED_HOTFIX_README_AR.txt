منصة آلين v2.7.2 — إصلاح stock_reserved

سبب الخطأ:
دالة إنشاء الطلب تستخدم jsonb_populate_record. بعد إضافة عمود stock_reserved، إذا لم يكن الحقل موجوداً في JSON فإن PostgreSQL يضع NULL ولا يطبق DEFAULT، فيفشل شرط NOT NULL.

الإصلاح:
1) إضافة stock_reserved=false إلى حمولة إنشاء الطلب في ملفات التثبيت.
2) إضافة Trigger دفاعي يبدّل NULL إلى false قبل الإدخال.
3) لا تغيير على طريقة إضافة الملزمة للسلة؛ كل ضغطة تبقى تزيد الكمية.

التطبيق:
نفّذ ORDERS_STOCK_RESERVED_HOTFIX_v2_7_2.sql مرة واحدة في Supabase SQL Editor.
ثم حدّث الموقع بـ Ctrl+F5 وجرب الطلب.
