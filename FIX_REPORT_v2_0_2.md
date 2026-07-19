# Alin v2.0.2

- إصلاح خطأ `coupons_admin_read already exists`.
- إضافة `DROP POLICY IF EXISTS coupons_admin_read` قبل إنشاء السياسة.
- تحويل ملف SQL الرئيسي إلى ملف قابل لإعادة التشغيل.
- تحديث ملف الفحص إلى v2.0.2 بدون الاعتماد على `alin_raise`.
