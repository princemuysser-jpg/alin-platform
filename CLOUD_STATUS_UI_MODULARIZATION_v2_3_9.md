# ALIN v2.3.9 — تنظيف cloud-status-ui.js

تم تقسيم `modules/core/cloud-status-ui.js` إلى خدمات مستقلة فعلية:

- `modules/core/cloud-status.js`: مؤشر حالة الاتصال والمزامنة فقط.
- `modules/core/auth-service.js`: تسجيل الدخول، حماية المحاولات، استعادة الجلسة وتسجيل الخروج.
- `modules/core/account-admin-service.js`: إنشاء الحسابات وتعديلها وحذفها وإصلاح ربط Auth وتغيير كلمة المرور.
- `modules/core/checkout-service.js`: توحيد عناصر السلة وإنشاء الطلب الآمن وعرض أرقام التتبع.
- `modules/core/backend-check.js`: فحص جاهزية Supabase والـRPC.
- `modules/store/tracking.js`: تتبع الطلب العام عبر RPC.
- `modules/core/cloud-status-ui.js`: فحص تحميل الخدمات فقط.

انخفض حجم `cloud-status-ui.js` من 26,522 بايت إلى 599 بايت، بدون إبقاء تنفيذ مكرر أو تغليف للدوال القديمة.

لا تحتاج النسخة إلى تحديث SQL.
