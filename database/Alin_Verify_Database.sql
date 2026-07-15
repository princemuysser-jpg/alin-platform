-- منصة آلين: فحص القاعدة بعد التثبيت أو الترقية

-- ===== Alin_RC5_1_Migration_Check.sql =====
-- فحص بنية قاعدة البيانات قبل/بعد الترقية
select table_name from information_schema.tables where table_schema='public' order by table_name;

select table_name,column_name,data_type
from information_schema.columns
where table_schema='public' and table_name in ('settings','accounts','orders','booklets','products','couriers')
order by table_name,ordinal_position;

select key,value,id,version from public.settings where key in ('__main__','alin_db_version') or id='main';

-- ===== Alin_RC5_2_Compatibility_Check.sql =====
-- نفّذ هذا الملف بعد نجاح Alin_RC5_2_Final_Compatibility.sql

select * from public.alin_database_health_summary;

select component,item,status,details
from public.alin_database_compatibility_report()
order by
  case status when 'MISSING' then 1 when 'TYPE_MISMATCH' then 2 else 3 end,
  component,item;

select key,value,id,version
from public.settings
where key='alin_db_version' or id='main'
order by id nulls first,key;

select migration_name,status,created_at
from public.alin_migration_log
where migration_name in ('RC5.1_DATABASE_COMPATIBILITY','RC5.2_FINAL_COMPATIBILITY')
order by created_at desc;

-- ===== Alin_RC5_3_UI_Binding_Check.sql =====
-- منصة آلين RC5.3 - فحص جاهزية ربط الواجهة
-- هذا الملف للقراءة فقط ولا يغيّر البيانات.
select * from public.alin_database_health_summary;

select table_name,
       case when table_name in (
         select table_name from information_schema.tables where table_schema='public'
       ) then 'OK' else 'MISSING' end as status
from (values
 ('settings'),('accounts'),('orders'),('order_items'),('booklets'),('products'),
 ('couriers'),('delivery_areas'),('notifications'),('financial_entries'),('audit')
) as required(table_name)
order by table_name;

select key,value,id,version
from public.settings
where key in ('alin_db_version','__main__') or id='main';

-- ===== Alin_RC5_Integration_Check.sql =====
-- منصة آلين RC5 - فحص جاهزية الربط النهائي
-- نفّذ Alin_Final_Database.sql أولاً، ثم نفّذ هذا الملف للتحقق فقط.
select table_name
from information_schema.tables
where table_schema='public'
  and table_name in ('settings','accounts','booklets','products','orders','notifications','audit','couriers','delivery_areas')
order by table_name;

select id,name,public
from storage.buckets
where id in ('alin-files','teacher-word','final-pdf','product-images','banners','logos','profile-images','backups')
order by id;

notify pgrst, 'reload schema';
