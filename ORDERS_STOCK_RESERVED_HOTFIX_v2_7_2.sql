-- ALIN v2.7.2
-- إصلاح قيمة stock_reserved الفارغة عند إنشاء الطلب.
-- آمن لإعادة التنفيذ ولا يحذف أي طلب أو مخزون.

begin;

alter table public.orders
  add column if not exists stock_reserved boolean default false;

alter table public.orders
  alter column stock_reserved set default false;

update public.orders
set stock_reserved=false
where stock_reserved is null;

alter table public.orders
  alter column stock_reserved set not null;

create or replace function public.alin_fill_stock_reserved_default()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
begin
  -- jsonb_populate_record يضع NULL للأعمدة غير الموجودة في JSON؛
  -- لذلك نثبت القيمة قبل فحص NOT NULL.
  if new.stock_reserved is null then
    new.stock_reserved:=false;
  end if;
  return new;
end
$$;

drop trigger if exists alin_orders_stock_reserved_default on public.orders;
create trigger alin_orders_stock_reserved_default
before insert or update of stock_reserved on public.orders
for each row execute function public.alin_fill_stock_reserved_default();

notify pgrst,'reload schema';
commit;

-- يجب أن تكون القيم المنطقية true والعدد 0.
select
  coalesce((
    select column_default is not null
    from information_schema.columns
    where table_schema='public'
      and table_name='orders'
      and column_name='stock_reserved'
  ),false) as stock_reserved_default_exists,
  coalesce((
    select is_nullable='NO'
    from information_schema.columns
    where table_schema='public'
      and table_name='orders'
      and column_name='stock_reserved'
  ),false) as stock_reserved_not_null,
  to_regprocedure('public.alin_fill_stock_reserved_default()') is not null as guard_function_exists,
  exists(
    select 1
    from pg_trigger
    where tgrelid='public.orders'::regclass
      and tgname='alin_orders_stock_reserved_default'
      and not tgisinternal
  ) as guard_trigger_exists,
  (select count(*) from public.orders where stock_reserved is null) as null_stock_reserved_rows;
