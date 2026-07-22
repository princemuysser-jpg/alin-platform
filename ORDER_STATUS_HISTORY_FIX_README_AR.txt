منصة آلين v2.4.2 R7

الإصلاح:
- منع NULL في orders.status_history عند تأكيد الطلب.
- إضافة BEFORE INSERT trigger يطبق القيم الأساسية حتى لو كانت دالة قديمة ترسل NULL.
- إضافة سجل أولي للحالة new.
- إصلاح السجلات القديمة الناقصة دون حذف البيانات.

التطبيق:
1) نفذ ORDERS_STATUS_HISTORY_GUARD_v2_4_2_R7.sql في Supabase SQL Editor.
2) يجب أن تظهر true, true, true, 0.
3) ارفع ملفات النسخة ثم Ctrl+F5.
