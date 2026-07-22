إصلاح خطأ assignment_status في الطلبات — v2.4.2 R3

السبب:
دالة alin_create_store_orders كانت تستخدم jsonb_populate_record، ولذلك ترسل NULL للحقل غير الموجود في payload بدل تطبيق default الخاص بالجدول.

التنفيذ الآن:
1) نفّذ ORDERS_ASSIGNMENT_STATUS_HOTFIX_v2_4_2_R3.sql داخل Supabase SQL Editor.
2) يجب أن تكون نتيجة الفحص: default_exists=true و rpc_sets_assignment_status=true و null_assignment_rows=0.
3) ارفع ملفات النسخة الجديدة للاستضافة، ثم Ctrl+F5.
4) أنشئ طلباً تجريبياً للمكتبة.

لا يحذف الملف أي طلب أو ملزمة أو حساب.
