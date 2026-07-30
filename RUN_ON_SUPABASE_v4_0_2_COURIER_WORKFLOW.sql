-- منصة آلين v4.0.2 — تحديث موحد لمسار المندوب
-- ينفذ مرة واحدة على مشروع Supabase الحالي. آمن لإعادة التنفيذ.

begin;

-- الأعمدة المطلوبة لمسار المندوب (لا تغيّر البيانات الموجودة).
alter table public.orders add column if not exists assignment_status text default 'pending_admin';
alter table public.orders add column if not exists status_history jsonb not null default '[]'::jsonb;
alter table public.orders add column if not exists assigned_at timestamptz;
alter table public.orders add column if not exists accepted_at timestamptz;
alter table public.orders add column if not exists picked_up_at timestamptz;
alter table public.orders add column if not exists out_for_delivery_at timestamptz;
alter table public.orders add column if not exists processing_at timestamptz;
alter table public.orders add column if not exists ready_at timestamptz;
alter table public.orders add column if not exists completed_at timestamptz;
alter table public.orders add column if not exists delivered_at timestamptz;
alter table public.orders add column if not exists rejected_at timestamptz;
alter table public.orders add column if not exists cancelled_at timestamptz;
alter table public.orders add column if not exists cancellation_reason text;
alter table public.orders add column if not exists payment_status text default 'cod_pending';
alter table public.orders add column if not exists updated_at timestamptz not null default now();
alter table public.orders add column if not exists stock_reserved boolean not null default false;
alter table public.orders add column if not exists stock_restored_at timestamptz;
alter table public.orders add column if not exists settlement_done boolean not null default false;
alter table public.orders add column if not exists settlement_cancelled boolean not null default false;
alter table public.orders add column if not exists platform_profit numeric not null default 0;
alter table public.orders add column if not exists teacher_profit numeric not null default 0;
alter table public.orders add column if not exists library_profit numeric not null default 0;
alter table public.orders add column if not exists delegate_profit numeric not null default 0;
alter table public.orders add column if not exists courier_profit numeric not null default 0;

-- الطلبات القديمة التي لديها مندوب تبقى قابلة للقبول حتى لو كانت حالتها new/pending_admin.
select set_config('alin.internal_order_transition','on',true);
update public.orders
set status='assigned',
    assignment_status='assigned',
    assigned_at=coalesce(assigned_at,updated_at,created_at,now()),
    updated_at=now()
where coalesce(courier_id,delegate_id) is not null
  and status in ('new','pending','pending_admin');
select set_config('alin.internal_order_transition','off',true);

create or replace function public.alin_order_transition_atomic(
  p_order_id text,
  p_status text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
declare
  o public.orders%rowtype;
  v_updated public.orders%rowtype;
  v_role text:=public.alin_current_role();
  v_account text:=public.alin_current_account_id();
  v_target text:=lower(btrim(coalesce(p_status,'')));
  v_source text;
  v_allowed boolean:=false;
  v_now timestamptz:=now();
  v_finance jsonb;
begin
  select * into o from public.orders where id=p_order_id for update;
  if not found then raise exception 'الطلب غير موجود'; end if;

  v_source:=lower(btrim(coalesce(o.status,'new')));
  if v_target='delivered' then v_target:='completed'; end if;
  if v_target='out_delivery' then v_target:='out_for_delivery'; end if;
  if v_target='canceled' then v_target:='cancelled'; end if;

  if v_target not in ('new','pending_admin','assigned','accepted','picked_up','out_for_delivery','processing','printing','ready','completed','cancelled','rejected') then
    raise exception 'حالة الطلب المطلوبة غير صحيحة';
  end if;

  if public.alin_is_finance_staff() then
    v_allowed:=true;
  elsif v_role='library' and v_account in (o.library_id,o.pickup_library_id) then
    v_allowed:=(v_source in ('new','pending_admin','processing','printing','ready','completed')
      and v_target in ('processing','printing','ready','completed','cancelled'));
  elsif v_role in ('courier','delegate') and v_account in (o.courier_id,o.delegate_id) then
    -- دعم الطلبات القديمة التي بقيت new/pending_admin/processing بعد تعيين المندوب.
    v_allowed:=(v_source in ('new','pending','pending_admin','assigned','accepted','picked_up','out_for_delivery','processing','completed')
      and v_target in ('accepted','picked_up','out_for_delivery','completed','rejected'));
  end if;

  if not v_allowed then
    raise exception 'غير مسموح بتنفيذ انتقال حالة الطلب (الدور: %، الحالة الحالية: %، الحالة المطلوبة: %)',coalesce(v_role,'بدون'),v_source,v_target;
  end if;
  if v_source='completed' and v_target<>'completed' then raise exception 'الطلب المكتمل لا يرجع لحالة سابقة'; end if;
  if v_target in ('cancelled','rejected') and nullif(btrim(coalesce(p_reason,'')),'') is null then
    raise exception 'اكتب سبب الإلغاء أو الرفض';
  end if;

  if v_source='completed' and v_target='completed' then
    v_finance:=public.alin_upsert_order_finance_atomic(o.id);
    select * into v_updated from public.orders where id=o.id;
    return jsonb_build_object('ok',true,'status','completed','order',to_jsonb(v_updated),'finance',v_finance,'repaired',true);
  end if;

  if v_target in ('cancelled','rejected') and o.stock_reserved and o.stock_restored_at is null and o.kind<>'booklet' then
    update public.products set stock=stock+o.qty where id=o.item_id;
  end if;

  perform set_config('alin.internal_order_transition','on',true);
  update public.orders set
    status=v_target,
    assignment_status=case
      when v_target='assigned' then 'assigned'
      when v_target='accepted' then 'accepted'
      when v_target='completed' then 'completed'
      when v_target='cancelled' then 'cancelled'
      when v_target='rejected' then 'rejected'
      else assignment_status
    end,
    status_history=coalesce(status_history,'[]'::jsonb)||jsonb_build_array(jsonb_build_object(
      'status',v_target,'at',v_now,'by',coalesce(v_account,'system'),'role',coalesce(v_role,'system'),
      'reason',nullif(btrim(coalesce(p_reason,'')),'')
    )),
    assigned_at=case when v_target='assigned' then coalesce(assigned_at,v_now) else assigned_at end,
    accepted_at=case when v_target='accepted' then coalesce(accepted_at,v_now) else accepted_at end,
    picked_up_at=case when v_target='picked_up' then coalesce(picked_up_at,v_now) else picked_up_at end,
    out_for_delivery_at=case when v_target='out_for_delivery' then coalesce(out_for_delivery_at,v_now) else out_for_delivery_at end,
    processing_at=case when v_target in ('processing','printing') then coalesce(processing_at,v_now) else processing_at end,
    ready_at=case when v_target='ready' then coalesce(ready_at,v_now) else ready_at end,
    completed_at=case when v_target='completed' then coalesce(completed_at,v_now) else completed_at end,
    delivered_at=case when v_target='completed' then coalesce(delivered_at,v_now) else delivered_at end,
    rejected_at=case when v_target='rejected' then coalesce(rejected_at,v_now) else rejected_at end,
    cancelled_at=case when v_target in ('cancelled','rejected') then coalesce(cancelled_at,v_now) else cancelled_at end,
    cancellation_reason=case when v_target in ('cancelled','rejected') then btrim(p_reason) else cancellation_reason end,
    payment_status=case when v_target='completed' then 'paid' when v_target in ('cancelled','rejected') then 'cancelled' else payment_status end,
    stock_reserved=case when v_target in ('cancelled','rejected') then false else stock_reserved end,
    stock_restored_at=case when v_target in ('cancelled','rejected') and stock_reserved and stock_restored_at is null and kind<>'booklet' then v_now else stock_restored_at end,
    settlement_done=case when v_target in ('cancelled','rejected') then false else settlement_done end,
    settlement_cancelled=case when v_target in ('cancelled','rejected') then true else settlement_cancelled end,
    platform_profit=case when v_target in ('cancelled','rejected') then 0 else platform_profit end,
    teacher_profit=case when v_target in ('cancelled','rejected') then 0 else teacher_profit end,
    library_profit=case when v_target in ('cancelled','rejected') then 0 else library_profit end,
    delegate_profit=case when v_target in ('cancelled','rejected') then 0 else delegate_profit end,
    courier_profit=case when v_target in ('cancelled','rejected') then 0 else courier_profit end,
    updated_at=v_now
  where id=o.id
  returning * into v_updated;
  perform set_config('alin.internal_order_transition','off',true);

  insert into public.order_timeline(order_id,status,actor_id,actor_role,reason)
  values(o.id,v_target,v_account,coalesce(v_role,'system'),nullif(btrim(coalesce(p_reason,'')),''));

  if v_target='completed' then
    v_finance:=public.alin_upsert_order_finance_atomic(o.id);
    select * into v_updated from public.orders where id=o.id;
  elsif v_target in ('cancelled','rejected') then
    update public.ledger
    set status='cancelled',settlement_status='cancelled',is_current=false,
        note=coalesce(note,'')||' | ألغي الطلب قبل التسوية'
    where order_id=o.id and status<>'settled';
  end if;

  return jsonb_build_object('ok',true,'status',v_target,'order',to_jsonb(v_updated),'finance',v_finance);
end $$;

revoke execute on function public.alin_order_transition_atomic(text,text,text) from public,anon;
grant execute on function public.alin_order_transition_atomic(text,text,text) to authenticated;

insert into public.settings(key,value,version)
values('courier_workflow_version','4.0.2','4.0.2')
on conflict(key) do update set value=excluded.value,version=excluded.version,updated_at=now();

notify pgrst,'reload schema';
commit;

select
  'COURIER_WORKFLOW_V4_0_2_OK' as result,
  to_regprocedure('public.alin_order_transition_atomic(text,text,text)') is not null as transition_ready,
  count(*) filter (where coalesce(courier_id,delegate_id) is not null and status='assigned') as assigned_orders
from public.orders;
