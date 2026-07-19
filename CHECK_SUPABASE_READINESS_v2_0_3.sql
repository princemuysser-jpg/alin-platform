-- ALIN v2.0.3 — corrected read-only readiness check
-- Safe to run in Supabase SQL Editor. It does not modify any data.

create temporary table if not exists alin_readiness_result (
  item text,
  status text,
  details text
) on commit drop;

truncate alin_readiness_result;

insert into alin_readiness_result(item, status, details)
select 'table:accounts', case when to_regclass('public.accounts') is not null then 'OK' else 'MISSING' end, 'Required accounts table'
union all select 'table:booklets', case when to_regclass('public.booklets') is not null then 'OK' else 'MISSING' end, 'Required booklets table'
union all select 'table:products', case when to_regclass('public.products') is not null then 'OK' else 'MISSING' end, 'Required products table'
union all select 'table:orders', case when to_regclass('public.orders') is not null then 'OK' else 'MISSING' end, 'Required orders table'
union all select 'table:delivery_areas', case when to_regclass('public.delivery_areas') is not null then 'OK' else 'MISSING' end, 'Required delivery areas table'
union all select 'table:coupons', case when to_regclass('public.coupons') is not null then 'OK' else 'MISSING' end, 'Required coupons table'
union all select 'table:banners', case when to_regclass('public.banners') is not null then 'OK' else 'MISSING' end, 'Required banners table'
union all select 'function:alin_current_account_id()', case when to_regprocedure('public.alin_current_account_id()') is not null then 'OK' else 'MISSING' end, 'Current account helper'
union all select 'function:alin_current_role()', case when to_regprocedure('public.alin_current_role()') is not null then 'OK' else 'MISSING' end, 'Current role helper'
union all select 'function:alin_is_admin()', case when to_regprocedure('public.alin_is_admin()') is not null then 'OK' else 'MISSING' end, 'Admin permission helper'
union all select 'function:alin_create_store_orders',
  case when exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'alin_create_store_orders'
  ) then 'OK' else 'MISSING' end,
  'Secure order creation RPC'
union all select 'function:alin_validate_coupon(text)',
  case when to_regprocedure('public.alin_validate_coupon(text)') is not null then 'OK' else 'MISSING' end,
  'Secure coupon validation RPC';

insert into alin_readiness_result(item, status, details)
select 'rls:' || c.relname,
  case when c.relrowsecurity then 'OK' else 'MISSING' end,
  'Row level security must be enabled'
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('accounts','booklets','products','orders','delivery_areas','coupons','banners');

insert into alin_readiness_result(item, status, details)
select 'privilege:anon_direct_order_insert',
  case when has_table_privilege('anon','public.orders','INSERT') then 'MISSING' else 'OK' end,
  'anon must create orders through RPC, not direct INSERT'
where to_regclass('public.orders') is not null
union all
select 'privilege:anon_coupon_table_read',
  case when has_table_privilege('anon','public.coupons','SELECT') then 'MISSING' else 'OK' end,
  'anon must validate coupons through RPC, not read the table'
where to_regclass('public.coupons') is not null;

-- Detailed results
select item, status, details
from alin_readiness_result
order by case status when 'MISSING' then 0 else 1 end, item;

-- Final summary
select
  case
    when count(*) filter (where status = 'MISSING') = 0
      then 'ALIN v2.0.3 readiness check passed'
    else 'ALIN readiness failed — missing items: ' ||
      string_agg(item, ', ' order by item) filter (where status = 'MISSING')
  end as result
from alin_readiness_result;
