# ALIN v2.2.8 — Supabase Service Ownership

تم تنظيف `modules/core/supabase-ui.js` وتحويله إلى طبقة واجهة قراءة فقط.

## الملكية النهائية

- `modules/core/supabase.js`: المالك الوحيد لـ `query / insert / update / removeRow / load` والمزامنة وRealtime والـ offline queue.
- `modules/core/storage.js`: المالك الوحيد لـ `AlinStorage` ورفع الملفات وحل روابط الوسائط.
- `modules/core/config.js`: المالك الوحيد لـ `ALIN_CONFIG`.
- `modules/core/supabase-ui.js`: يعرض حالة البيانات ويتابع أحداث التحديث فقط، ولا يستبدل أي دالة.

## إصلاحات إضافية مرتبطة

- تحديث `db` محليًا مرة واحدة بعد كل عملية سحابية.
- إرسال حدث واحد `alin:cloud-mutation` لكل عملية.
- إرسال `alin:data-refreshed` من خدمة البيانات الأساسية بعد تحميل Snapshot.
- منع تكرار قيود الإشعارات والتدقيق والمالية الناتج عن التحديث المحلي المزدوج.
- الاحتفاظ بالبيانات الحالية عند تعذر قراءة جدول واحد بدل تصفيره بالكامل.
- توحيد aliases المالية القديمة والجديدة على نفس المصفوفات.

لا يوجد تحديث SQL في هذا الإصدار.
