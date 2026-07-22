منصة آلين v2.4.2 — Stage 1 R4

هذا التحديث يعالج خطأ:
Could not find the 'processing_at' column of 'orders' in the schema cache

ويمنع ظهور أخطاء متتابعة في مسار المكتبة بإضافة ومزامنة:
processing_at, ready_at, status_history, payment_status,
cancellation_reason, cancel_reason, proof_path, handoff_token
وبقية حقول مسار الطلب.

طريقة التنفيذ:
1) افتح Supabase > SQL Editor.
2) نفذ الملف ORDERS_LIBRARY_WORKFLOW_SYNC_v2_4_2_R4.sql كاملاً.
3) يجب أن تكون النتائج:
   all_workflow_columns_exist = true
   protection_trigger_exists = true
   missing_columns = 0
   null_assignment_rows = 0
   null_history_rows = 0
   null_payment_rows = 0
4) ارجع للموقع واضغط Ctrl + F5.
5) أعد تجربة تحويل الطلب إلى قيد التجهيز ثم جاهز ثم مكتمل.

لا يحذف الملف أي طلب أو ملزمة أو ملف.
