-- ALIN v2.1.8 — فحص حماية Supabase للقراءة فقط
-- شغّله بعد RUN_ON_SUPABASE_v2_1_8_COMPLETE.sql. لا يغيّر أي بيانات.
do $$
declare
  missing text[] := '{}';
  item text;
  p record;
begin
  foreach item in array array[
    'accounts','couriers','settings','categories','booklets','products','orders','delivery_areas','coupons','banners',
    'notifications','teacher_requests','permits','ledger','financial_entries','financial_payouts',
    'library_settlements','audit'
  ] loop
    if to_regclass('public.'||item) is null then
      missing:=array_append(missing,'table:public.'||item);
    elsif not exists(
      select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=item and c.relrowsecurity=true
    ) then
      missing:=array_append(missing,'rls:public.'||item);
    end if;
  end loop;

  foreach item in array array[
    'alin_current_account_id()','alin_current_role()','alin_is_admin()','alin_is_finance_staff()',
    'alin_row_owner_match(jsonb)','alin_notification_visible(jsonb)','alin_order_visible(jsonb)',
    'alin_order_manageable(jsonb)','alin_protect_order_update()','alin_create_store_orders(jsonb,jsonb,jsonb,text)',
    'alin_validate_coupon(text)','alin_track_order(text)'
  ] loop
    if to_regprocedure('public.'||item) is null then missing:=array_append(missing,'function:'||item); end if;
  end loop;

  if not exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='couriers' and column_name='areas'
  ) then missing:=array_append(missing,'column:public.couriers.areas'); end if;

  if to_regprocedure('public.alin_protect_courier_self_update()') is null then
    missing:=array_append(missing,'function:public.alin_protect_courier_self_update()');
  end if;


  foreach item in array array[
    'updated_at','status_history','payment_status','notes','library_note','processing_at','ready_at',
    'assignment_status','assigned_at','accepted_at','picked_up_at','out_for_delivery_at',
    'completed_at','delivered_at','rejected_at','cancelled_at','cancellation_reason',
    'cancel_reason','delivery_note','proof_path','handoff_token'
  ] loop
    if not exists(
      select 1 from information_schema.columns
      where table_schema='public' and table_name='orders' and column_name=item
    ) then missing:=array_append(missing,'column:public.orders.'||item); end if;
  end loop;

  if not exists(
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='orders' and c.conname='orders_status_valid'
      and pg_get_constraintdef(c.oid) like '%assigned%'
      and pg_get_constraintdef(c.oid) like '%accepted%'
      and pg_get_constraintdef(c.oid) like '%picked_up%'
      and pg_get_constraintdef(c.oid) like '%out_for_delivery%'
  ) then missing:=array_append(missing,'constraint:public.orders.orders_status_valid(v2.1.8)'); end if;


  if not exists(
    select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='orders' and c.conname='orders_assignment_status_valid'
  ) then missing:=array_append(missing,'constraint:public.orders.orders_assignment_status_valid'); end if;

  if not exists(
    select 1
    from pg_trigger tr
    join pg_class t on t.oid=tr.tgrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='orders'
      and tr.tgname='alin_orders_protect_update' and not tr.tgisinternal
  ) then missing:=array_append(missing,'trigger:public.orders.alin_orders_protect_update'); end if;

  if to_regclass('public.alin_public_accounts') is null then missing:=array_append(missing,'view:alin_public_accounts'); end if;
  if to_regclass('public.alin_public_settings') is null then missing:=array_append(missing,'view:alin_public_settings'); end if;

  for p in select * from (values
    ('banners','banners_public_read'),
    ('categories','alin_v204_categories_read'),
    ('settings','alin_v204_settings_admin_select'),
    ('notifications','alin_v204_notifications_public_read'),
    ('notifications','alin_v204_notifications_user_read'),
    ('orders','alin_v204_orders_read'),
    ('teacher_requests','alin_v204_teacher_requests_read'),
    ('permits','alin_v204_permits_read'),
    ('ledger','alin_v204_ledger_read'),
    ('financial_entries','alin_v204_financial_entries_read'),
    ('financial_payouts','alin_v204_financial_payouts_read'),
    ('library_settlements','alin_v204_library_settlements_read'),
    ('audit','alin_v204_audit_read')
  ) as x(table_name,policy_name) loop
    if to_regclass('public.'||p.table_name) is not null and not exists(
      select 1 from pg_policies where schemaname='public' and tablename=p.table_name and policyname=p.policy_name
    ) then missing:=array_append(missing,'policy:public.'||p.table_name||'.'||p.policy_name); end if;
  end loop;


  if to_regprocedure('public.alin_repair_auth_links(text)') is null then
    missing:=array_append(missing,'function:public.alin_repair_auth_links(text)');
  end if;
  foreach item in array array[
    'alin_files_public_read','alin_files_admin_insert','alin_files_admin_update','alin_files_admin_delete','alin_files_teacher_insert'
  ] loop
    if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname=item) then
      missing:=array_append(missing,'policy:storage.objects.'||item);
    end if;
  end loop;

  if not exists(select 1 from storage.buckets where id='alin-files' and public=true) then
    missing:=array_append(missing,'storage_bucket:alin-files(public)');
  end if;


  if exists (
    select 1
    from public.accounts a
    join auth.users u
      on regexp_replace(lower(trim(coalesce(u.raw_user_meta_data->>'username',''))), '\s+', '-', 'g')
         = regexp_replace(lower(trim(coalesce(a.username::text,''))), '\s+', '-', 'g')
    where a.auth_user_id is null
      and not exists (select 1 from public.accounts x where x.auth_user_id=u.id and x.id<>a.id)
  ) then
    missing:=array_append(missing,'auth_links:repair_required');
  end if;

  if cardinality(missing)>0 then
    raise exception 'ALIN v2.1.8 readiness failed. Missing: %',array_to_string(missing,', ');
  end if;
  raise notice 'ALIN v2.1.8 readiness check passed.';
end $$;

select 'ALIN v2.1.8 readiness check passed.' as result;

-- v2.4.2 Stage 1 private document readiness
DO $$
DECLARE
  missing text[] := '{}';
BEGIN
  IF NOT EXISTS(select 1 from storage.buckets where id='alin-private' and public=false) THEN
    missing:=array_append(missing,'storage_bucket:alin-private(private)');
  END IF;
  IF to_regprocedure('public.alin_private_can_insert(text)') IS NULL THEN
    missing:=array_append(missing,'function:alin_private_can_insert(text)');
  END IF;
  IF to_regprocedure('public.alin_private_can_select(text)') IS NULL THEN
    missing:=array_append(missing,'function:alin_private_can_select(text)');
  END IF;
  IF to_regprocedure('public.alin_library_has_booklet_order(text)') IS NULL THEN
    missing:=array_append(missing,'function:alin_library_has_booklet_order(text)');
  END IF;
  IF NOT EXISTS(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='alin_private_select_exact') THEN
    missing:=array_append(missing,'policy:storage.objects.alin_private_select_exact');
  END IF;
  IF NOT EXISTS(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='alin_private_insert_exact') THEN
    missing:=array_append(missing,'policy:storage.objects.alin_private_insert_exact');
  END IF;
  IF EXISTS(select 1 from pg_policies where schemaname='storage' and tablename='objects' and roles::text like '%anon%' and coalesce(qual,'') like '%alin-private%') THEN
    missing:=array_append(missing,'policy:alin-private-anon-access');
  END IF;
  IF cardinality(missing)>0 THEN
    RAISE EXCEPTION 'ALIN v2.4.2 Stage 1 readiness failed. Missing: %',array_to_string(missing,', ');
  END IF;
  RAISE NOTICE 'ALIN v2.4.2 Stage 1 readiness check passed.';
END $$;

select 'ALIN v2.4.2 Stage 1 readiness check passed.' as result;
