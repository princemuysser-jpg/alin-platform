-- ALIN v2.4.2 R6
-- إصلاح ذري لحسابات المكتبة وتغيير حالة فتح/إغلاق المكتبة.
-- قابل لإعادة التشغيل ولا يحذف الطلبات أو التسويات أو الملفات.

begin;

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1) أعمدة حالة المكتبة
-- ------------------------------------------------------------
alter table public.accounts add column if not exists is_open boolean not null default true;
alter table public.accounts add column if not exists open_status text not null default 'open';
alter table public.accounts add column if not exists updated_at timestamptz not null default now();

update public.accounts
set
  is_open = case
    when lower(coalesce(open_status,'open'))='closed' then false
    else coalesce(is_open,true)
  end,
  open_status = case
    when coalesce(is_open,true)=false or lower(coalesce(open_status,'open'))='closed' then 'closed'
    else 'open'
  end
where role='library';

alter table public.accounts drop constraint if exists accounts_open_status_valid;
alter table public.accounts add constraint accounts_open_status_valid
check (open_status in ('open','closed')) not valid;
alter table public.accounts validate constraint accounts_open_status_valid;

-- ------------------------------------------------------------
-- 2) الأعمدة القياسية للسجل المالي والطلب
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('public.ledger') is null then
    raise exception 'جدول public.ledger غير موجود. نفّذ ملف قاعدة البيانات الكامل أولاً.';
  end if;
end $$;

alter table public.ledger add column if not exists order_id text;
alter table public.ledger add column if not exists order_number text;
alter table public.ledger add column if not exists title text;
alter table public.ledger add column if not exists alin numeric not null default 0;
alter table public.ledger add column if not exists admin numeric not null default 0;
alter table public.ledger add column if not exists teacher numeric not null default 0;
alter table public.ledger add column if not exists teacher_id text;
alter table public.ledger add column if not exists library numeric not null default 0;
alter table public.ledger add column if not exists library_id text;
alter table public.ledger add column if not exists delegate numeric not null default 0;
alter table public.ledger add column if not exists delegate_id text;
alter table public.ledger add column if not exists total numeric not null default 0;
alter table public.ledger add column if not exists delivery_type text;
alter table public.ledger add column if not exists settlement_status text not null default 'pending';
alter table public.ledger add column if not exists created_at timestamptz not null default now();
alter table public.ledger add column if not exists updated_at timestamptz not null default now();
alter table public.ledger add column if not exists settled_at timestamptz;

create index if not exists ledger_order_id_text_idx on public.ledger ((order_id::text));
create index if not exists ledger_library_id_text_idx on public.ledger ((library_id::text));

alter table public.orders add column if not exists updated_at timestamptz not null default now();
alter table public.orders add column if not exists status_history jsonb not null default '[]'::jsonb;
alter table public.orders add column if not exists payment_status text not null default 'cod_pending';
alter table public.orders add column if not exists processing_at timestamptz;
alter table public.orders add column if not exists ready_at timestamptz;
alter table public.orders add column if not exists completed_at timestamptz;
alter table public.orders add column if not exists delivered_at timestamptz;
alter table public.orders add column if not exists cancelled_at timestamptz;
alter table public.orders add column if not exists cancellation_reason text;
alter table public.orders add column if not exists cancel_reason text;

-- توافق القراءة والتحديث مع library_id وpickup_library_id وassigned_library_id.
create or replace function public.alin_order_visible(p_row jsonb)
returns boolean
language plpgsql stable security definer
set search_path=public
as $$
declare
  v_role text:=public.alin_current_role();
  v_id text:=public.alin_current_account_id();
  v_item_id text:=coalesce(p_row->>'item_id',p_row->>'booklet_id','');
begin
  if public.alin_is_finance_staff() then return true; end if;
  if v_id is null then return false; end if;
  if v_role='library' and v_id in (
    coalesce(p_row->>'library_id',''),
    coalesce(p_row->>'pickup_library_id',''),
    coalesce(p_row->>'assigned_library_id','')
  ) then return true; end if;
  if v_role='courier' and v_id in (coalesce(p_row->>'courier_id',''),coalesce(p_row->>'delegate_id','')) then return true; end if;
  if v_role='teacher' then
    if coalesce(p_row->>'teacher_id','')=v_id then return true; end if;
    if v_item_id<>'' and exists(select 1 from public.booklets b where b.id::text=v_item_id and b.teacher_id::text=v_id) then return true; end if;
  end if;
  return false;
end
$$;

create or replace function public.alin_order_manageable(p_row jsonb)
returns boolean
language plpgsql stable security definer
set search_path=public
as $$
declare
  v_role text:=public.alin_current_role();
  v_id text:=public.alin_current_account_id();
begin
  if public.alin_is_admin() then return true; end if;
  if v_id is null then return false; end if;
  if v_role='library' and v_id in (
    coalesce(p_row->>'library_id',''),
    coalesce(p_row->>'pickup_library_id',''),
    coalesce(p_row->>'assigned_library_id','')
  ) then return true; end if;
  if v_role='courier' and v_id in (coalesce(p_row->>'courier_id',''),coalesce(p_row->>'delegate_id','')) then return true; end if;
  return false;
end
$$;

revoke all on function public.alin_order_visible(jsonb) from public;
revoke all on function public.alin_order_manageable(jsonb) from public;
grant execute on function public.alin_order_visible(jsonb) to authenticated;
grant execute on function public.alin_order_manageable(jsonb) to authenticated;

-- ------------------------------------------------------------
-- 3) قراءة رقم من إعدادات المنصة بطريقة متوافقة
-- ------------------------------------------------------------
create or replace function public.alin_setting_numeric(p_key text, p_default numeric)
returns numeric
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  v_value numeric;
begin
  if to_regclass('public.settings') is null then return p_default; end if;
  begin
    execute 'select nullif(value::text,'''')::numeric from public.settings where key::text=$1 limit 1'
      into v_value using p_key;
  exception when others then
    v_value:=null;
  end;
  return coalesce(v_value,p_default);
end
$$;

revoke all on function public.alin_setting_numeric(text,numeric) from public,anon,authenticated;

-- ------------------------------------------------------------
-- 4) تثبيت القيد المالي لطلب واحد بشكل ذري وقابل للتكرار
-- ------------------------------------------------------------
create or replace function public.alin_upsert_order_finance(p_order_id text)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_order jsonb;
  v_order_number text;
  v_title text;
  v_kind text;
  v_booklet_id text;
  v_teacher_id text;
  v_library_id text;
  v_total numeric:=0;
  v_admin_percent numeric:=20;
  v_teacher_percent numeric:=50;
  v_admin numeric:=0;
  v_teacher numeric:=0;
  v_library numeric:=0;
  v_ledger_id text;
  v_payload jsonb;
begin
  select to_jsonb(o) into v_order
  from public.orders o
  where o.id::text=p_order_id
  for update;

  if v_order is null then raise exception 'الطلب غير موجود'; end if;

  v_order_number:=coalesce(nullif(v_order->>'order_number',''),p_order_id);
  v_title:=coalesce(nullif(v_order->>'title',''),'طلب منصة آلين');
  v_kind:=lower(coalesce(nullif(v_order->>'kind',''),nullif(v_order->>'item_kind',''),'product'));
  v_booklet_id:=coalesce(nullif(v_order->>'item_id',''),nullif(v_order->>'booklet_id',''));
  v_library_id:=coalesce(
    nullif(v_order->>'library_id',''),
    nullif(v_order->>'pickup_library_id',''),
    nullif(v_order->>'assigned_library_id','')
  );

  if v_library_id is null then raise exception 'الطلب غير مرتبط بمكتبة'; end if;

  begin
    v_total:=greatest(coalesce(nullif(v_order->>'total','')::numeric,0),0);
  exception when others then
    v_total:=0;
  end;
  if v_total<=0 then raise exception 'مبلغ الطلب غير صالح للحسابات'; end if;

  v_teacher_id:=nullif(v_order->>'teacher_id','');
  if v_teacher_id is null and v_booklet_id is not null and to_regclass('public.booklets') is not null then
    execute 'select nullif(to_jsonb(b)->>''teacher_id'','''') from public.booklets b where b.id::text=$1 limit 1'
      into v_teacher_id using v_booklet_id;
  end if;

  v_admin_percent:=least(greatest(public.alin_setting_numeric('admin_profit_percent',20),0),100);
  v_teacher_percent:=least(greatest(public.alin_setting_numeric('teacher_profit_percent',50),0),100);

  v_admin:=least(v_total,greatest(round(v_total*v_admin_percent/100),0));
  if v_kind in ('booklet','booklets','booklet_product','ملزمة','ملازم') then
    v_teacher:=least(greatest(v_total-v_admin,0),greatest(round(v_total*v_teacher_percent/100),0));
  else
    v_teacher:=0;
  end if;
  v_library:=greatest(v_total-v_admin-v_teacher,0);

  select l.id::text into v_ledger_id
  from public.ledger l
  where l.order_id::text=p_order_id
  order by coalesce(l.settled_at,l.updated_at,l.created_at) desc nulls last
  limit 1
  for update;

  v_payload:=jsonb_build_object(
    'order_id',p_order_id,
    'order_number',v_order_number,
    'title',v_title,
    'alin',v_admin,
    'admin',v_admin,
    'teacher',v_teacher,
    'teacher_id',v_teacher_id,
    'library',v_library,
    'library_id',v_library_id,
    'delegate',0,
    'delegate_id',null,
    'total',v_total,
    'delivery_type','library',
    'settlement_status','settled',
    'settled_at',now(),
    'updated_at',now()
  );

  if v_ledger_id is null then
    v_ledger_id:=gen_random_uuid()::text;
    v_payload:=v_payload||jsonb_build_object('id',v_ledger_id,'created_at',now());
    insert into public.ledger
    select (jsonb_populate_record(null::public.ledger,v_payload)).*;
  else
    update public.ledger l set
      order_id=x.order_id,
      order_number=x.order_number,
      title=x.title,
      alin=x.alin,
      admin=x.admin,
      teacher=x.teacher,
      teacher_id=x.teacher_id,
      library=x.library,
      library_id=x.library_id,
      delegate=x.delegate,
      delegate_id=x.delegate_id,
      total=x.total,
      delivery_type=x.delivery_type,
      settlement_status=x.settlement_status,
      settled_at=x.settled_at,
      updated_at=x.updated_at
    from (select (jsonb_populate_record(null::public.ledger,v_payload)).*) x
    where l.id::text=v_ledger_id;
  end if;

  return jsonb_build_object(
    'ledger_id',v_ledger_id,
    'order_id',p_order_id,
    'library_id',v_library_id,
    'gross',v_total,
    'admin',v_admin,
    'teacher',v_teacher,
    'library',v_library,
    'debt',greatest(v_total-v_library,0)
  );
end
$$;

revoke all on function public.alin_upsert_order_finance(text) from public,anon,authenticated;

-- ------------------------------------------------------------
-- 5) تحديث حالة طلب المكتبة + الحسابات في معاملة واحدة
-- ------------------------------------------------------------
create or replace function public.alin_library_set_order_status(
  p_order_id text,
  p_status text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_account text:=public.alin_current_account_id();
  v_role text:=public.alin_current_role();
  v_order jsonb;
  v_source text;
  v_target text:=lower(btrim(coalesce(p_status,'')));
  v_history jsonb;
  v_finance jsonb:=null;
  v_now timestamptz:=now();
begin
  if v_role<>'library' or v_account is null then
    raise exception 'هذا الإجراء متاح لحساب المكتبة فقط';
  end if;

  select to_jsonb(o) into v_order
  from public.orders o
  where o.id::text=p_order_id
  for update;

  if v_order is null then raise exception 'الطلب غير موجود'; end if;
  if v_account not in (
    coalesce(v_order->>'library_id',''),
    coalesce(v_order->>'pickup_library_id',''),
    coalesce(v_order->>'assigned_library_id','')
  ) then
    raise exception 'هذا الطلب غير مسند إلى مكتبتك';
  end if;

  v_source:=lower(coalesce(v_order->>'status','new'));
  if v_source='canceled' then v_source:='cancelled'; end if;
  if v_target='canceled' then v_target:='cancelled'; end if;
  if v_target='delivered' then v_target:='completed'; end if;

  if v_target not in ('processing','ready','completed','cancelled') then
    raise exception 'حالة الطلب المطلوبة غير صحيحة';
  end if;

  -- إعادة الطلب المكتمل تصلح القيد المالي الناقص بدون تكرار.
  if v_source in ('completed','delivered') and v_target='completed' then
    v_finance:=public.alin_upsert_order_finance(p_order_id);
    select to_jsonb(o) into v_order from public.orders o where o.id::text=p_order_id;
    return jsonb_build_object('ok',true,'order',v_order,'finance',v_finance,'repaired',true);
  end if;

  if not (
    (v_source in ('new','pending','pending_admin','accepted') and v_target in ('processing','cancelled'))
    or (v_source in ('processing','printing') and v_target in ('ready','cancelled'))
    or (v_source='ready' and v_target in ('completed','cancelled'))
  ) then
    raise exception 'لا يمكن نقل الطلب من % إلى %',v_source,v_target;
  end if;

  v_history:=coalesce(v_order->'status_history','[]'::jsonb)
    ||jsonb_build_array(jsonb_build_object(
      'status',v_target,
      'at',v_now,
      'by',v_account,
      'reason',case when v_target='cancelled' then nullif(btrim(coalesce(p_reason,'')),'') else null end
    ));

  if v_target='cancelled' and nullif(btrim(coalesce(p_reason,'')),'') is null then
    raise exception 'اكتب سبب الإلغاء';
  end if;

  update public.orders set
    status=v_target,
    status_history=v_history,
    updated_at=v_now,
    processing_at=case when v_target='processing' then coalesce(processing_at,v_now) else processing_at end,
    ready_at=case when v_target='ready' then coalesce(ready_at,v_now) else ready_at end,
    completed_at=case when v_target='completed' then coalesce(completed_at,v_now) else completed_at end,
    delivered_at=case when v_target='completed' then coalesce(delivered_at,v_now) else delivered_at end,
    cancelled_at=case when v_target='cancelled' then coalesce(cancelled_at,v_now) else cancelled_at end,
    cancellation_reason=case when v_target='cancelled' then btrim(p_reason) else cancellation_reason end,
    cancel_reason=case when v_target='cancelled' then btrim(p_reason) else cancel_reason end,
    payment_status=case when v_target='completed' then 'paid' when v_target='cancelled' then 'cancelled' else payment_status end
  where id::text=p_order_id;

  if v_target='completed' then
    v_finance:=public.alin_upsert_order_finance(p_order_id);
  end if;

  select to_jsonb(o) into v_order from public.orders o where o.id::text=p_order_id;
  return jsonb_build_object('ok',true,'order',v_order,'finance',v_finance);
end
$$;

revoke all on function public.alin_library_set_order_status(text,text,text) from public,anon;
grant execute on function public.alin_library_set_order_status(text,text,text) to authenticated;

-- ------------------------------------------------------------
-- 6) فتح/إغلاق المكتبة من حسابها فقط
-- ------------------------------------------------------------
create or replace function public.alin_set_library_open(p_open boolean)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_account text:=public.alin_current_account_id();
  v_role text:=public.alin_current_role();
  v_row jsonb;
begin
  if v_role<>'library' or v_account is null then
    raise exception 'هذا الإجراء متاح لحساب المكتبة فقط';
  end if;

  update public.accounts a set
    is_open=coalesce(p_open,false),
    open_status=case when coalesce(p_open,false) then 'open' else 'closed' end,
    updated_at=now()
  where a.id::text=v_account and a.role='library'
  returning to_jsonb(a) into v_row;

  if v_row is null then raise exception 'تعذر تحديد حساب المكتبة المرتبط بتسجيل الدخول'; end if;
  return jsonb_build_object('ok',true,'library',v_row);
end
$$;

revoke all on function public.alin_set_library_open(boolean) from public,anon;
grant execute on function public.alin_set_library_open(boolean) to authenticated;

-- ------------------------------------------------------------
-- 7) إصلاح الطلبات المكتملة سابقاً التي لم يتولد لها قيد صحيح
-- ------------------------------------------------------------
do $$
declare
  r record;
  v_expected_library text;
  v_repaired integer:=0;
begin
  for r in
    select o.id::text as id, to_jsonb(o) as j
    from public.orders o
    where lower(coalesce(o.status,'new')) in ('completed','delivered')
  loop
    v_expected_library:=coalesce(
      nullif(r.j->>'library_id',''),
      nullif(r.j->>'pickup_library_id',''),
      nullif(r.j->>'assigned_library_id','')
    );
    if v_expected_library is null then continue; end if;

    if not exists(
      select 1 from public.ledger l
      where l.order_id::text=r.id
        and coalesce(l.library_id::text,'')=v_expected_library
        and coalesce(l.total,0)>0
    ) then
      perform public.alin_upsert_order_finance(r.id);
      v_repaired:=v_repaired+1;
    end if;
  end loop;
  raise notice 'ALIN R6 repaired % completed library finance row(s).',v_repaired;
end $$;

notify pgrst,'reload schema';
commit;

-- فحص نهائي للقراءة فقط.
select
  exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='accounts' and column_name='is_open'
  ) as library_is_open_column,
  exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='accounts' and column_name='open_status'
  ) as library_open_status_column,
  to_regprocedure('public.alin_set_library_open(boolean)') is not null as library_status_rpc,
  to_regprocedure('public.alin_library_set_order_status(text,text,text)') is not null as library_order_rpc,
  to_regprocedure('public.alin_upsert_order_finance(text)') is not null as finance_upsert_function,
  (
    select count(*)
    from public.orders o
    where lower(coalesce(o.status,'new')) in ('completed','delivered')
      and coalesce(
        nullif(to_jsonb(o)->>'library_id',''),
        nullif(to_jsonb(o)->>'pickup_library_id',''),
        nullif(to_jsonb(o)->>'assigned_library_id','')
      ) is not null
      and not exists(
        select 1 from public.ledger l
        where l.order_id::text=o.id::text
          and coalesce(l.library_id::text,'')=coalesce(
            nullif(to_jsonb(o)->>'library_id',''),
            nullif(to_jsonb(o)->>'pickup_library_id',''),
            nullif(to_jsonb(o)->>'assigned_library_id','')
          )
          and coalesce(l.total,0)>0
      )
  ) as completed_orders_missing_finance;
