-- ALIN v2.0.1 — read-only deployment readiness check
-- Run after RUN_ON_SUPABASE_v2_0_1_COMPLETE.sql. This script changes no data.
do $$
declare
  missing text[] := '{}';
  item text;
  required_policy text;
begin
  foreach item in array array['accounts','booklets','products','orders','delivery_areas','coupons','banners'] loop
    if to_regclass('public.' || item) is null then
      missing := array_append(missing, 'table:' || item);
    end if;
  end loop;

  if to_regprocedure('public.alin_current_account_id()') is null then missing := array_append(missing,'function:alin_current_account_id'); end if;
  if to_regprocedure('public.alin_current_role()') is null then missing := array_append(missing,'function:alin_current_role'); end if;
  if to_regprocedure('public.alin_is_admin()') is null then missing := array_append(missing,'function:alin_is_admin'); end if;
  if to_regprocedure('public.alin_validate_coupon(text)') is null then missing := array_append(missing,'function:alin_validate_coupon(text)'); end if;
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='alin_create_store_orders'
  ) then missing := array_append(missing,'function:alin_create_store_orders'); end if;

  foreach item in array array['image_path','image_url','link_url','start_date','end_date','sort_order','active'] loop
    if not exists (
      select 1 from information_schema.columns
      where table_schema='public' and table_name='banners' and column_name=item
    ) then missing := array_append(missing, 'column:banners.' || item); end if;
  end loop;

  if not exists (select 1 from storage.buckets where id='alin-files') then
    missing := array_append(missing,'storage_bucket:alin-files');
  end if;

  foreach required_policy in array array[
    'coupons_admin_read','banners_public_read','banners_admin_insert','banners_admin_update','banners_admin_delete',
    'alin_files_public_read','alin_banners_admin_insert','alin_banners_admin_update','alin_banners_admin_delete'
  ] loop
    if not exists (
      select 1 from pg_policies where policyname=required_policy
    ) then missing := array_append(missing, 'policy:' || required_policy); end if;
  end loop;

  if cardinality(missing)>0 then
    raise exception 'ALIN readiness failed. Missing: %', array_to_string(missing, ', ');
  end if;

  raise notice 'ALIN v2.0.1 readiness check passed.';
end $$;
