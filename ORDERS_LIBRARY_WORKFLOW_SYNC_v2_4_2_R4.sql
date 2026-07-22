-- ALIN v2.4.2 Stage 1 R4
-- مزامنة كاملة لحقول مسار طلبات المكتبة والمندوب.
-- آمن لإعادة التشغيل ولا يحذف الطلبات أو الملفات.

begin;

-- نوقف تريغر الحماية مؤقتاً أثناء ترقية المخطط فقط.
do $$
begin
  if to_regclass('public.orders') is null then
    raise exception 'جدول public.orders غير موجود';
  end if;
  drop trigger if exists alin_orders_protect_update on public.orders;
end $$;

-- الحقول العامة لمسار الطلب.
alter table public.orders add column if not exists updated_at timestamptz not null default now();
alter table public.orders add column if not exists status_history jsonb not null default '[]'::jsonb;
alter table public.orders add column if not exists payment_status text not null default 'cod_pending';
alter table public.orders add column if not exists notes text;
alter table public.orders add column if not exists library_note text;

-- حقول المكتبة والطباعة.
alter table public.orders add column if not exists processing_at timestamptz;
alter table public.orders add column if not exists ready_at timestamptz;
alter table public.orders add column if not exists completed_at timestamptz;
alter table public.orders add column if not exists delivered_at timestamptz;
alter table public.orders add column if not exists cancelled_at timestamptz;
alter table public.orders add column if not exists cancellation_reason text;
-- توافق مؤقت مع إصدارات أقدم كانت تستخدم cancel_reason.
alter table public.orders add column if not exists cancel_reason text;

-- حقول تعيين المندوب.
alter table public.orders add column if not exists assignment_status text not null default 'pending_admin';
alter table public.orders add column if not exists assigned_at timestamptz;
alter table public.orders add column if not exists accepted_at timestamptz;
alter table public.orders add column if not exists picked_up_at timestamptz;
alter table public.orders add column if not exists out_for_delivery_at timestamptz;
alter table public.orders add column if not exists rejected_at timestamptz;
alter table public.orders add column if not exists delivery_note text;
alter table public.orders add column if not exists proof_path text;
alter table public.orders add column if not exists handoff_token text;

-- إصلاح أي بيانات قديمة ناقصة.
update public.orders set status_history='[]'::jsonb where status_history is null;
update public.orders set payment_status='cod_pending' where payment_status is null or btrim(payment_status)='';
update public.orders set assignment_status=case
  when status in ('completed','delivered','تم التسليم') then 'completed'
  when status='rejected' then 'rejected'
  when status in ('cancelled','canceled') then 'cancelled'
  when status in ('accepted','picked_up','out_for_delivery','out_delivery','processing') then 'accepted'
  when coalesce(courier_id::text,'')<>'' or coalesce(delegate_id::text,'')<>'' then 'assigned'
  else 'pending_admin'
end
where assignment_status is null
   or assignment_status not in ('pending_admin','assigned','accepted','completed','rejected','cancelled');

-- توحيد سببي الإلغاء القديم والجديد.
update public.orders
set cancellation_reason=coalesce(cancellation_reason,cancel_reason),
    cancel_reason=coalesce(cancel_reason,cancellation_reason)
where cancellation_reason is null or cancel_reason is null;

alter table public.orders alter column updated_at set default now();
alter table public.orders alter column status_history set default '[]'::jsonb;
alter table public.orders alter column payment_status set default 'cod_pending';
alter table public.orders alter column assignment_status set default 'pending_admin';
alter table public.orders alter column updated_at set not null;
alter table public.orders alter column status_history set not null;
alter table public.orders alter column payment_status set not null;
alter table public.orders alter column assignment_status set not null;

-- قيود الحالات المعتمدة.
alter table public.orders drop constraint if exists orders_status_valid;
alter table public.orders add constraint orders_status_valid check (
  status is null or status in (
    'pending','new','pending_admin','assigned','accepted','picked_up',
    'out_for_delivery','out_delivery','processing','printing','ready',
    'completed','delivered','cancelled','canceled','rejected',
    'payment_pending','paid','receipt_rejected','تم التسليم'
  )
) not valid;

alter table public.orders drop constraint if exists orders_assignment_status_valid;
alter table public.orders add constraint orders_assignment_status_valid check (
  assignment_status in ('pending_admin','assigned','accepted','completed','rejected','cancelled')
) not valid;

create index if not exists orders_library_status_idx on public.orders(library_id,status);
create index if not exists orders_pickup_library_status_idx on public.orders(pickup_library_id,status);
create index if not exists orders_courier_status_idx on public.orders(courier_id,status);
create index if not exists orders_delegate_status_idx on public.orders(delegate_id,status);
create index if not exists orders_assignment_status_idx on public.orders(assignment_status);

-- حماية التحديث مع السماح فقط بحقول سير العمل الخاصة بكل دور.
create or replace function public.alin_protect_order_update()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text := public.alin_current_role();
  v_allowed text[];
  v_old_status text := lower(coalesce(old.status,'new'));
  v_new_status text := lower(coalesce(new.status,v_old_status));
begin
  if public.alin_is_admin() then
    return new;
  end if;

  if v_role='library' then
    v_allowed:=array[
      'status','status_history','updated_at','processing_at','ready_at',
      'completed_at','delivered_at','cancelled_at','cancellation_reason',
      'cancel_reason','payment_status','notes','library_note'
    ];

    if old.status is distinct from new.status then
      if not (
        (v_old_status in ('new','pending','pending_admin','accepted') and v_new_status in ('processing','cancelled'))
        or (v_old_status in ('processing','printing') and v_new_status in ('ready','cancelled'))
        or (v_old_status='ready' and v_new_status in ('completed','delivered','cancelled'))
      ) then
        raise exception 'انتقال حالة الطلب غير مسموح للمكتبة: % إلى %',old.status,new.status;
      end if;
    end if;

    -- توافق بين اسم الحقل القديم والجديد.
    if new.cancellation_reason is distinct from old.cancellation_reason and new.cancel_reason is not distinct from old.cancel_reason then
      new.cancel_reason:=new.cancellation_reason;
    elsif new.cancel_reason is distinct from old.cancel_reason and new.cancellation_reason is not distinct from old.cancellation_reason then
      new.cancellation_reason:=new.cancel_reason;
    end if;

    if v_new_status in ('completed','delivered') then
      new.payment_status:='paid';
    elsif new.payment_status is distinct from old.payment_status then
      raise exception 'لا يمكن للمكتبة تغيير حالة الدفع قبل إكمال الطلب';
    end if;

  elsif v_role='courier' then
    v_allowed:=array[
      'status','assignment_status','updated_at','accepted_at','picked_up_at',
      'out_for_delivery_at','completed_at','delivered_at','rejected_at','cancelled_at',
      'delivery_note','proof_path','handoff_token'
    ];

    if old.status is distinct from new.status then
      if not (
        (v_old_status in ('pending','new','pending_admin','assigned') and v_new_status in ('accepted','rejected'))
        or (v_old_status='accepted' and v_new_status in ('picked_up','rejected'))
        or (v_old_status='picked_up' and v_new_status in ('out_for_delivery','rejected'))
        or (v_old_status in ('out_for_delivery','out_delivery','processing') and v_new_status in ('completed','delivered'))
      ) then
        raise exception 'انتقال حالة الطلب غير مسموح للمندوب: % إلى %',old.status,new.status;
      end if;
    end if;
  else
    raise exception 'غير مسموح بتعديل الطلب';
  end if;

  if (to_jsonb(new)-v_allowed)<>(to_jsonb(old)-v_allowed) then
    raise exception 'تم منع تعديل بيانات حساسة في الطلب';
  end if;

  return new;
end
$$;

revoke all on function public.alin_protect_order_update() from public;

drop trigger if exists alin_orders_protect_update on public.orders;
create trigger alin_orders_protect_update
before update on public.orders
for each row execute function public.alin_protect_order_update();

notify pgrst,'reload schema';
commit;

-- نتيجة تحقق واحدة: يجب أن تكون القيم المنطقية كلها true وعدد النواقص 0.
with required(column_name) as (
  values
    ('updated_at'),('status_history'),('payment_status'),('notes'),('library_note'),
    ('processing_at'),('ready_at'),('completed_at'),('delivered_at'),('cancelled_at'),
    ('cancellation_reason'),('cancel_reason'),('assignment_status'),('assigned_at'),
    ('accepted_at'),('picked_up_at'),('out_for_delivery_at'),('rejected_at'),
    ('delivery_note'),('proof_path'),('handoff_token')
), missing as (
  select r.column_name
  from required r
  where not exists (
    select 1 from information_schema.columns c
    where c.table_schema='public' and c.table_name='orders' and c.column_name=r.column_name
  )
)
select
  (select count(*)=0 from missing) as all_workflow_columns_exist,
  exists(
    select 1 from pg_trigger tr
    join pg_class t on t.oid=tr.tgrelid
    join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='orders'
      and tr.tgname='alin_orders_protect_update' and not tr.tgisinternal
  ) as protection_trigger_exists,
  (select count(*) from missing) as missing_columns,
  (select count(*) from public.orders where assignment_status is null) as null_assignment_rows,
  (select count(*) from public.orders where status_history is null) as null_history_rows,
  (select count(*) from public.orders where payment_status is null) as null_payment_rows;
