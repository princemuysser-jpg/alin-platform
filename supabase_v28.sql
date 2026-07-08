-- Alin V28 Brand Manager
-- لا يحتاج إنشاء جداول جديدة إذا كان جدول settings موجود من الإصدارات السابقة.
-- هذه الأوامر تضيف مفاتيح الهوية الافتراضية فقط بدون حذف أي بيانات.
insert into settings (key, value) values
('platform_logo_path',''),
('platform_icon_path',''),
('platform_short_name','آلين')
on conflict (key) do nothing;
