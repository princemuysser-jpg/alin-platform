# تنظيف platform.js — الخطوة السادسة: المكتبة

- نقل تشغيل صفحة المكتبة إلى `modules/library/dashboard.js`.
- اعتماد مسار واحد لتحديث وإلغاء طلب المكتبة داخل `modules/library/orders.js`.
- اعتماد معاينة وطباعة PDF داخل `modules/library/printing.js`.
- حذف تنفيذات المكتبة القديمة وطبقات V86/V95 من `modules/core/platform.js`.
- منع ملف المالية من استبدال `libraryOrderStatus`.
- اختبار انتقال الطلب: جديد ← قيد التجهيز ← جاهز ← مكتمل، مع تثبيت الدفع والمالية مرة واحدة.
