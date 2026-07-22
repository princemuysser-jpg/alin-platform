-- ALIN v2.4.2 Stage 1 R7
-- إصلاح نهائي لقيمة orders.status_history عند تأكيد الطلب.
-- السبب: jsonb_populate_record يملأ الحقول غير المرسلة بقيمة NULL، لذلك لا يعمل DEFAULT تلقائياً.
-- هذا الملف يضيف حارساً على مستوى قاعدة البيانات ويصلح الدالة داخل النسخة الجديدة.
-- آمن للتنفيذ أكثر من مرة ولا يحذف أي طلب.

begin;

alter table public.orders add column if not exists status text;
alter table public.orders add column if not exists assignment_status text;
alter table public.orders add column if not exists status_history jsonb;
alter table public.orders add column if not exists payment_status text;
alter table public.orders add column if not exists created_at timestamptz;
alter table public.orders add column if not exists updated_at timestamptz;

update public.orders
set status=coalesce(nullif(btrim(status),''),'new')
where status is null or btrim(status)='';

update public.orders
set assignment_status=case
  when status in ('completed','delivered','تم التسليم') then 'completed'
  when status in ('cancelled','canceled','ملغي') then 'cancelled'
  when status='rejected' then 'rejected'
  when status in ('accepted','picked_up','out_for_delivery','out_delivery','processing','printing','ready') then 'accepted'
  when coalesce(courier_id::text,'')<>'' or coalesce(delegate_id::text,'')<>'' then 'assigned'
  else 'pending_admin'
end
where assignment_status is null or btrim(assignment_status)='';

update public.orders
set payment_status=case
  when status in ('completed','delivered','تم التسليم') then 'paid'
  when status in ('cancelled','canceled','ملغي') then 'cancelled'
  else 'cod_pending'
end
where payment_status is null or btrim(payment_status)='';

update public.orders
set created_at=now()
where created_at is null;

update public.orders
set updated_at=coalesce(created_at,now())
where updated_at is null;

update public.orders
set status_history=jsonb_build_array(jsonb_build_object(
  'status',coalesce(nullif(btrim(status),''),'new'),
  'at',coalesce(created_at,updated_at,now()),
  'by','database_repair'
))
where status_history is null
   or jsonb_typeof(status_history)<>'array';

alter table public.orders alter column status set default 'new';
alter table public.orders alter column assignment_status set default 'pending_admin';
alter table public.orders alter column status_history set default '[]'::jsonb;
alter table public.orders alter column payment_status set default 'cod_pending';
alter table public.orders alter column created_at set default now();
alter table public.orders alter column updated_at set default now();

alter table public.orders alter column status set not null;
alter table public.orders alter column assignment_status set not null;
alter table public.orders alter column status_history set not null;
alter table public.orders alter column payment_status set not null;
alter table public.orders alter column created_at set not null;
alter table public.orders alter column updated_at set not null;

create or replace function public.alin_orders_apply_insert_defaults()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
begin
  new.status:=coalesce(nullif(btrim(new.status),''),'new');
  new.assignment_status:=coalesce(nullif(btrim(new.assignment_status),''),'pending_admin');
  new.payment_status:=coalesce(nullif(btrim(new.payment_status),''),'cod_pending');
  new.created_at:=coalesce(new.created_at,now());
  new.updated_at:=coalesce(new.updated_at,new.created_at,now());

  if new.status_history is null or jsonb_typeof(new.status_history)<>'array' then
    new.status_history:=jsonb_build_array(jsonb_build_object(
      'status',new.status,
      'at',new.created_at,
      'by','store'
    ));
  elsif jsonb_array_length(new.status_history)=0 then
    new.status_history:=jsonb_build_array(jsonb_build_object(
      'status',new.status,
      'at',new.created_at,
      'by','store'
    ));
  end if;

  return new;
end
$$;

revoke all on function public.alin_orders_apply_insert_defaults() from public,anon,authenticated;

drop trigger if exists alin_orders_apply_insert_defaults on public.orders;
create trigger alin_orders_apply_insert_defaults
before insert on public.orders
for each row execute function public.alin_orders_apply_insert_defaults();

notify pgrst, 'reload schema';
commit;

-- النتيجة الصحيحة: القيم الثلاث true والعدد 0.
select
  coalesce((
    select column_default is not null
    from information_schema.columns
    where table_schema='public' and table_name='orders' and column_name='status_history'
  ),false) as status_history_default_exists,
  exists(
    select 1
    from pg_trigger t
    join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public'
      and c.relname='orders'
      and t.tgname='alin_orders_apply_insert_defaults'
      and not t.tgisinternal
      and t.tgenabled<>'D'
  ) as insert_guard_trigger_exists,
  to_regprocedure('public.alin_orders_apply_insert_defaults()') is not null as insert_guard_function_exists,
  (select count(*) from public.orders where status_history is null) as null_status_history_rows;
