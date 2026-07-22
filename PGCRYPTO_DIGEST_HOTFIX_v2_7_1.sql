-- ALIN v2.7.1 — إصلاح digest() في حماية الطلبات
-- السبب: pgcrypto موجود داخل مخطط extensions في Supabase، بينما دالة الطلب كانت تستخدم search_path لا يتضمنه.
-- آمن للتنفيذ أكثر من مرة ولا يحذف أي بيانات أو طلبات.

begin;

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- اجعل دالة الطلب المحمية ترى دوال pgcrypto سواء كانت الإضافة في public أو extensions.
alter function public.alin_create_store_orders_guarded(jsonb,jsonb,jsonb,text,text,text)
  set search_path = public, extensions, pg_temp;

notify pgrst, 'reload schema';
commit;

-- فحص النتيجة: يجب أن تكون digest_available و guarded_rpc_path_fixed = true.
with pgcrypto_info as (
  select n.nspname as extension_schema
  from pg_extension e
  join pg_namespace n on n.oid=e.extnamespace
  where e.extname='pgcrypto'
), guarded as (
  select p.proconfig
  from pg_proc p
  where p.oid=to_regprocedure('public.alin_create_store_orders_guarded(jsonb,jsonb,jsonb,text,text,text)')
)
select
  (select extension_schema from pgcrypto_info) as pgcrypto_schema,
  exists(
    select 1
    from pgcrypto_info i
    where to_regprocedure(format('%I.digest(text,text)',i.extension_schema)) is not null
  ) as digest_available,
  coalesce(
    exists(
      select 1
      from guarded g,
           unnest(coalesce(g.proconfig,array[]::text[])) cfg
      where cfg like 'search_path=%extensions%'
    ),
    false
  ) as guarded_rpc_path_fixed;
