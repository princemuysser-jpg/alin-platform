إصلاح v2.7.1 — خطأ function digest(text, unknown) does not exist

1) افتح Supabase > SQL Editor.
2) نفّذ الملف PGCRYPTO_DIGEST_HOTFIX_v2_7_1.sql كاملاً.
3) يجب أن تظهر:
   digest_available = true
   guarded_rpc_path_fixed = true
4) ارجع للمتجر واضغط Ctrl + F5 ثم جرّب تأكيد الطلب.

لا يحتاج هذا الإصلاح حذف الطلبات أو إعادة تنفيذ المراحل السابقة.
