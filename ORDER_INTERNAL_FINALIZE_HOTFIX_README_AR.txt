منصة آلين v2.7.3 — إصلاح رفض تأكيد الطلب

المشكلة:
كانت حماية جدول orders تمنع التحديث الداخلي الذي تنفذه دالة الطلب بعد الإنشاء، فتظهر رسالة: غير مسموح بتعديل الطلب.

الإصلاح:
- الإبقاء على trigger حماية الطلب.
- السماح فقط لدالة checkout المحمية بتحديث checkout_request_key وcheckout_group_id وstock_reserved وstock_restored_at.
- منع أي تغيير آخر حتى أثناء هذا المسار الداخلي.

التطبيق:
نفّذ ORDER_INTERNAL_FINALIZE_HOTFIX_v2_7_3.sql مرة واحدة في Supabase SQL Editor.
ثم حدّث الموقع Ctrl+F5 وجرب الطلب.
