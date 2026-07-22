-- ALIN v2.7.0 — Stage 4
-- منع تكرار الطلبات، تحديد المعدل، وحماية المخزون عند الإلغاء/الحذف.
-- آمن للتنفيذ أكثر من مرة. لا يحذف الطلبات أو المنتجات الحالية.

begin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- معلومات الربط بين الطلب ومحاولة الدفع/الشراء.
alter table public.orders add column if not exists checkout_request_key text;
alter table public.orders add column if not exists checkout_group_id text;
alter table public.orders add column if not exists stock_reserved boolean not null default false;
alter table public.orders add column if not exists stock_restored_at timestamptz;

-- v2.7.2: jsonb_populate_record may pass NULL instead of applying the column default.
create or replace function public.alin_fill_stock_reserved_default()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
begin
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


create index if not exists orders_checkout_request_key_idx on public.orders(checkout_request_key);
create index if not exists orders_checkout_group_id_idx on public.orders(checkout_group_id);

-- سجل داخلي لمحاولات إنشاء الطلب. لا يمكن للمتصفح قراءته أو تعديله مباشرة.
create table if not exists public.checkout_requests(
  id uuid primary key default gen_random_uuid(),
  request_key text not null unique,
  device_hash text not null,
  phone_hash text not null,
  payload_hash text not null,
  status text not null default 'pending',
  result jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint checkout_requests_status_valid check(status in ('pending','completed'))
);

create index if not exists checkout_requests_phone_created_idx
  on public.checkout_requests(phone_hash,created_at desc);
create index if not exists checkout_requests_device_created_idx
  on public.checkout_requests(device_hash,created_at desc);
create index if not exists checkout_requests_payload_created_idx
  on public.checkout_requests(payload_hash,created_at desc);

alter table public.checkout_requests enable row level security;
revoke all on public.checkout_requests from public,anon,authenticated;

-- يعيد المخزون مرة واحدة فقط عندما ينتقل طلب منتج إلى ملغي،
-- ويمنع إعادة تفعيل الطلب الملغي بعد إرجاع المخزون.
create or replace function public.alin_order_stock_guard()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_old_status text;
  v_new_status text;
  v_kind text;
  v_item_id text;
  v_qty numeric;
begin
  if tg_op='DELETE' then
    if coalesce(old.stock_reserved,false) and old.stock_restored_at is null then
      v_kind:=lower(coalesce(old.kind,''));
      if v_kind not in ('booklet','booklets','ملزمة','ملازم') then
        v_item_id:=coalesce(old.item_id::text,'');
        v_qty:=greatest(coalesce(old.qty,1),1);
        update public.products p
          set stock=coalesce(p.stock,0)+v_qty
        where p.id::text=v_item_id;
      end if;
    end if;
    return old;
  end if;

  v_old_status:=lower(coalesce(old.status,'new'));
  v_new_status:=lower(coalesce(new.status,'new'));
  if v_old_status='canceled' then v_old_status:='cancelled'; end if;
  if v_new_status='canceled' then v_new_status:='cancelled'; end if;

  if v_old_status='cancelled'
     and v_new_status<>'cancelled'
     and old.stock_restored_at is not null then
    raise exception 'لا يمكن إعادة تفعيل طلب ملغي بعد إرجاع المخزون. أنشئ طلباً جديداً';
  end if;

  if v_new_status='cancelled'
     and v_old_status<>'cancelled'
     and coalesce(old.stock_reserved,false)
     and old.stock_restored_at is null then
    v_kind:=lower(coalesce(old.kind,''));
    if v_kind not in ('booklet','booklets','ملزمة','ملازم') then
      v_item_id:=coalesce(old.item_id::text,'');
      v_qty:=greatest(coalesce(old.qty,1),1);
      update public.products p
        set stock=coalesce(p.stock,0)+v_qty
      where p.id::text=v_item_id;
    end if;
    new.stock_reserved:=false;
    new.stock_restored_at:=now();
  end if;

  return new;
end
$$;

revoke all on function public.alin_order_stock_guard() from public,anon,authenticated;

drop trigger if exists alin_orders_stock_cancel_guard on public.orders;
create trigger alin_orders_stock_cancel_guard
before update of status on public.orders
for each row execute function public.alin_order_stock_guard();

drop trigger if exists alin_orders_stock_delete_guard on public.orders;
create trigger alin_orders_stock_delete_guard
before delete on public.orders
for each row execute function public.alin_order_stock_guard();

-- واجهة إنشاء الطلب المحمية. الدالة الأساسية من المرحلة الثالثة تبقى داخلية فقط.
create or replace function public.alin_create_store_orders_guarded(
  p_items jsonb,
  p_customer jsonb,
  p_fulfillment jsonb default '{}'::jsonb,
  p_coupon_code text default null,
  p_request_key text default null,
  p_device_id text default null
)
returns table(order_number text,order_id text)
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
declare
  v_request_key text:=lower(btrim(coalesce(p_request_key,'')));
  v_device_id text:=btrim(coalesce(p_device_id,''));
  v_phone text:=translate(btrim(coalesce(p_customer->>'phone','')),'٠١٢٣٤٥٦٧٨٩','0123456789');
  v_phone_hash text;
  v_device_hash text;
  v_payload_hash text;
  v_request_id uuid;
  v_existing jsonb;
  v_result jsonb;
  v_count integer;
begin
  v_phone:=regexp_replace(v_phone,'[^0-9+]','','g');
  if v_request_key !~ '^[a-z0-9-]{20,80}$' then
    raise exception 'رمز تأكيد الطلب غير صالح. حدّث الصفحة وحاول مجدداً';
  end if;
  if length(v_device_id)<16 or length(v_device_id)>160 then
    raise exception 'تعذر التحقق من جهاز الطلب. حدّث الصفحة وحاول مجدداً';
  end if;
  if v_phone !~ '^\+?[0-9]{7,15}$' then
    raise exception 'اكتب رقم هاتف صحيح';
  end if;

  v_phone_hash:=encode(digest('alin-phone-v1:'||v_phone,'sha256'),'hex');
  v_device_hash:=encode(digest('alin-device-v1:'||v_device_id,'sha256'),'hex');
  v_payload_hash:=encode(digest(jsonb_build_object(
    'items',coalesce(p_items,'[]'::jsonb),
    'customer',jsonb_build_object('name',btrim(coalesce(p_customer->>'name','')),'phone',v_phone),
    'fulfillment',coalesce(p_fulfillment,'{}'::jsonb),
    'coupon',lower(btrim(coalesce(p_coupon_code,'')))
  )::text,'sha256'),'hex');

  -- نفس المفتاح يرجع نفس الطلب ولا يخصم المخزون مرة ثانية.
  select to_jsonb(r) into v_existing
  from public.checkout_requests r
  where r.request_key=v_request_key;

  if v_existing is not null then
    if coalesce(v_existing->>'payload_hash','')<>v_payload_hash then
      raise exception 'رمز الطلب مستخدم لمحتوى مختلف. حدّث الصفحة وحاول مجدداً';
    end if;
    if coalesce(v_existing->>'status','')='completed'
       and jsonb_typeof(v_existing->'result')='array' then
      return query
      select x.order_number,x.order_id
      from jsonb_to_recordset(v_existing->'result') as x(order_number text,order_id text);
      return;
    end if;
    raise exception 'الطلب نفسه قيد المعالجة. انتظر لحظات ولا تضغط مرة أخرى';
  end if;

  -- إذا أعاد المتصفح نفس السلة خلال دقيقتين، نرجع النتيجة السابقة.
  select r.result into v_result
  from public.checkout_requests r
  where r.phone_hash=v_phone_hash
    and r.payload_hash=v_payload_hash
    and r.status='completed'
    and r.created_at>now()-interval '2 minutes'
  order by r.created_at desc
  limit 1;

  if jsonb_typeof(v_result)='array' then
    return query
    select x.order_number,x.order_id
    from jsonb_to_recordset(v_result) as x(order_number text,order_id text);
    return;
  end if;

  select count(*) into v_count
  from public.checkout_requests r
  where r.phone_hash=v_phone_hash and r.created_at>now()-interval '5 minutes';
  if v_count>=4 then
    raise exception 'تم إرسال طلبات كثيرة لهذا الرقم. انتظر خمس دقائق ثم حاول مجدداً';
  end if;

  select count(*) into v_count
  from public.checkout_requests r
  where r.phone_hash=v_phone_hash and r.created_at>now()-interval '24 hours';
  if v_count>=20 then
    raise exception 'وصل هذا الرقم إلى الحد اليومي للطلبات';
  end if;

  select count(*) into v_count
  from public.checkout_requests r
  where r.device_hash=v_device_hash and r.created_at>now()-interval '5 minutes';
  if v_count>=8 then
    raise exception 'تم إرسال طلبات كثيرة من هذا الجهاز. انتظر خمس دقائق ثم حاول مجدداً';
  end if;

  select count(*) into v_count
  from public.checkout_requests r
  where r.device_hash=v_device_hash and r.created_at>now()-interval '24 hours';
  if v_count>=50 then
    raise exception 'وصل هذا الجهاز إلى الحد اليومي للطلبات';
  end if;

  insert into public.checkout_requests(request_key,device_hash,phone_hash,payload_hash,status)
  values(v_request_key,v_device_hash,v_phone_hash,v_payload_hash,'pending')
  on conflict(request_key) do nothing
  returning id into v_request_id;

  -- معالجة طلبين متزامنين يحملان المفتاح نفسه.
  if v_request_id is null then
    select to_jsonb(r) into v_existing
    from public.checkout_requests r
    where r.request_key=v_request_key;
    if coalesce(v_existing->>'payload_hash','')<>v_payload_hash then
      raise exception 'رمز الطلب مستخدم لمحتوى مختلف';
    end if;
    if coalesce(v_existing->>'status','')='completed'
       and jsonb_typeof(v_existing->'result')='array' then
      return query
      select x.order_number,x.order_id
      from jsonb_to_recordset(v_existing->'result') as x(order_number text,order_id text);
      return;
    end if;
    raise exception 'الطلب نفسه قيد المعالجة. انتظر لحظات';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into v_result
  from public.alin_create_store_orders(p_items,p_customer,p_fulfillment,p_coupon_code) x;

  if jsonb_array_length(v_result)=0 then
    raise exception 'لم يُنشئ الخادم أي طلب';
  end if;

  update public.orders o set
    checkout_request_key=v_request_key,
    checkout_group_id=v_request_id::text,
    stock_reserved=case
      when lower(coalesce(o.kind,'')) in ('booklet','booklets','ملزمة','ملازم') then false
      else true
    end,
    stock_restored_at=null
  where o.id::text in (
    select x.order_id
    from jsonb_to_recordset(v_result) as x(order_number text,order_id text)
  );

  update public.checkout_requests set
    status='completed',result=v_result,completed_at=now()
  where id=v_request_id;

  return query
  select x.order_number,x.order_id
  from jsonb_to_recordset(v_result) as x(order_number text,order_id text);
end
$$;

-- لا يمكن استدعاء الدالة الأساسية مباشرة من المتصفح بعد هذه المرحلة.
revoke all on function public.alin_create_store_orders(jsonb,jsonb,jsonb,text) from public,anon,authenticated;
revoke all on function public.alin_create_store_orders_guarded(jsonb,jsonb,jsonb,text,text,text) from public;
grant execute on function public.alin_create_store_orders_guarded(jsonb,jsonb,jsonb,text,text,text) to anon,authenticated;

notify pgrst,'reload schema';
commit;

-- فحص المرحلة الرابعة: يجب أن تكون القيم كلها true، والأعداد 0.
select
  to_regprocedure('public.alin_create_store_orders_guarded(jsonb,jsonb,jsonb,text,text,text)') is not null as guarded_checkout_rpc_exists,
  not has_function_privilege('anon','public.alin_create_store_orders(jsonb,jsonb,jsonb,text)','EXECUTE') as anon_core_checkout_blocked,
  has_function_privilege('anon','public.alin_create_store_orders_guarded(jsonb,jsonb,jsonb,text,text,text)','EXECUTE') as anon_guarded_checkout_allowed,
  to_regclass('public.checkout_requests') is not null as checkout_requests_table_exists,
  to_regprocedure('public.alin_order_stock_guard()') is not null as stock_guard_function_exists,
  exists(select 1 from pg_trigger where tgrelid='public.orders'::regclass and tgname='alin_orders_stock_cancel_guard' and not tgisinternal) as stock_cancel_trigger_exists,
  (select count(*) from public.orders where stock_restored_at is not null and stock_reserved=true) as invalid_restored_reservations;
