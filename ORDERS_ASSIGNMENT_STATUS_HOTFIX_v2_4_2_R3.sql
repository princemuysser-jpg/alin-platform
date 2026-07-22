-- ALIN v2.4.2 Stage 1 R3
-- إصلاح إنشاء الطلب: منع NULL في orders.assignment_status.
-- آمن للتنفيذ أكثر من مرة، ولا يحذف أي بيانات.

begin;

alter table public.orders
  alter column assignment_status set default 'pending_admin';

update public.orders
set assignment_status = case
  when status in ('completed','delivered','تم التسليم') then 'completed'
  when status='rejected' then 'rejected'
  when status='cancelled' then 'cancelled'
  when status in ('accepted','picked_up','out_for_delivery','out_delivery','processing') then 'accepted'
  when coalesce(courier_id::text,'')<>'' or coalesce(delegate_id::text,'')<>'' then 'assigned'
  else 'pending_admin'
end
where assignment_status is null;

create or replace function public.alin_create_store_orders(
  p_items jsonb,
  p_customer jsonb,
  p_fulfillment jsonb default '{}'::jsonb,
  p_coupon_code text default null
)
returns table(order_number text, order_id text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_item jsonb;
  v_source jsonb;
  v_kind text;
  v_item_id text;
  v_qty integer;
  v_title text;
  v_price numeric;
  v_stock numeric;
  v_discount numeric := 0;
  v_total numeric;
  v_delivery_fee numeric := 0;
  v_payload jsonb;
  v_order_number text;
  v_order_id text;
  v_index integer := 0;
  v_customer_name text := btrim(coalesce(p_customer->>'name',''));
  v_customer_phone text := btrim(coalesce(p_customer->>'phone',''));
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then
    raise exception 'السلة فارغة';
  end if;
  if v_customer_name='' or v_customer_phone='' then
    raise exception 'أكمل اسم الطالب ورقم الهاتف';
  end if;
  if length(v_customer_name)>120 or length(v_customer_phone)>30 then
    raise exception 'بيانات الزبون غير صحيحة';
  end if;

  -- لا نثق برسوم مرسلة من المتصفح. نسمح بقيمة موجبة محدودة فقط لحين ربط جدول المناطق.
  v_delivery_fee := least(greatest(coalesce((p_fulfillment->>'delivery_fee')::numeric,0),0),100000);

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_index := v_index + 1;
    v_kind := lower(btrim(coalesce(v_item->>'kind','')));
    v_item_id := btrim(coalesce(v_item->>'id',''));
    v_qty := least(greatest(coalesce((v_item->>'qty')::integer,1),1),100);
    if v_item_id='' then
      raise exception 'عنصر غير صالح في السلة';
    end if;

    -- بعض الإصدارات القديمة خزنت نوع الهدية باسم gifts أو خزنت نوع المنتج داخل السلة.
    -- المصدر الحقيقي يُحسم من معرّف العنصر في قاعدة البيانات، ولا نعتمد على نوع مرسل من المتصفح.
    v_source := null;
    if v_kind in ('booklet','booklets','booklet_product','ملزمة','ملازم') then
      execute 'select to_jsonb(x) from public.booklets x where x.id::text=$1 limit 1'
        into v_source using v_item_id;
      if v_source is not null then v_kind := 'booklet'; end if;
    end if;

    if v_source is null then
      execute 'select to_jsonb(x) from public.products x where x.id::text=$1 limit 1 for update'
        into v_source using v_item_id;
      if v_source is not null then
        v_kind := case lower(coalesce(v_source->>'type',''))
          when 'gift' then 'gift'
          when 'gifts' then 'gift'
          when 'stationery' then 'stationery'
          when 'stationary' then 'stationery'
          else 'product'
        end;
      end if;
    end if;

    -- معالجة سلة قديمة انعكس فيها نوع العنصر ومعرّفه.
    if v_source is null and v_kind not in ('booklet','booklets','ملزمة','ملازم') then
      execute 'select to_jsonb(x) from public.booklets x where x.id::text=$1 limit 1'
        into v_source using v_item_id;
      if v_source is not null then v_kind := 'booklet'; end if;
    end if;

    if v_source is null then raise exception 'العنصر المطلوب غير موجود أو حُذف من المتجر'; end if;

    if coalesce(v_source->>'is_hidden','false')='true' or coalesce(v_source->>'status','published') not in ('published','active','available') then
      raise exception 'العنصر غير متاح حالياً';
    end if;

    v_title := coalesce(v_source->>'title',v_source->>'name','منتج');
    v_price := coalesce(nullif(v_source->>'sale_price','')::numeric,nullif(v_source->>'price','')::numeric,0);
    if v_price < 0 then raise exception 'سعر العنصر غير صحيح'; end if;

    if v_kind<>'booklet' and v_source ? 'stock' then
      v_stock := coalesce(nullif(v_source->>'stock','')::numeric,0);
      if v_stock < v_qty then raise exception 'الكمية غير متوفرة: %',v_title; end if;
    end if;

    -- الكوبون يُحسب من الخادم فقط عند وجود جدول وحقول متوافقة.
    v_discount := 0;
    if p_coupon_code is not null and btrim(p_coupon_code)<>'' and to_regclass('public.coupons') is not null then
      declare v_coupon jsonb;
      begin
        execute 'select to_jsonb(c) from public.coupons c where lower(c.code::text)=lower($1) limit 1'
          into v_coupon using btrim(p_coupon_code);
        if v_coupon is not null
           and coalesce(v_coupon->>'status','active')='active'
           and (not (v_coupon ? 'expires_at') or nullif(v_coupon->>'expires_at','') is null or (v_coupon->>'expires_at')::timestamptz >= now()) then
          if coalesce(v_coupon->>'discount_type','percent')='fixed' then
            v_discount := least(v_price*v_qty,coalesce(nullif(v_coupon->>'discount_value','')::numeric,0));
          else
            v_discount := round(v_price*v_qty*least(greatest(coalesce(nullif(v_coupon->>'discount_value','')::numeric,0),0),100)/100);
          end if;
        end if;
      end;
    end if;

    v_order_number := 'AL-'||to_char(clock_timestamp(),'YYMMDDHH24MISS')||'-'||lpad(v_index::text,2,'0')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,4);
    v_order_id := gen_random_uuid()::text;
    v_total := greatest(v_price*v_qty-v_discount,0) + case when v_index=1 then v_delivery_fee else 0 end;

    v_payload := jsonb_build_object(
      'id',v_order_id,'order_number',v_order_number,'kind',v_kind,'item_id',v_item_id,'title',v_title,
      'student_name',v_customer_name,'student_phone',v_customer_phone,'qty',v_qty,'unit_price',v_price,
      'total',v_total,'discount',v_discount,'coupon_code',nullif(btrim(p_coupon_code),''),
      'status','new','assignment_status','pending_admin',
      'status_history',jsonb_build_array(jsonb_build_object('status','new','at',now(),'by','store')),
      'payment_status',coalesce(p_fulfillment->>'payment_status','cod_pending'),
      'fulfillment_type',p_fulfillment->>'fulfillment_type','delivery_type',p_fulfillment->>'delivery_type',
      'library_id',p_fulfillment->>'library_id','pickup_library_id',p_fulfillment->>'pickup_library_id',
      'delivery_area',p_fulfillment->>'delivery_area','delivery_address',p_fulfillment->>'delivery_address',
      'delivery_landmark',p_fulfillment->>'delivery_landmark','delivery_fee',case when v_index=1 then v_delivery_fee else 0 end,
      'created_at',now(),'updated_at',now()
    );

    execute 'insert into public.orders select (jsonb_populate_record(null::public.orders,$1)).* returning id::text,order_number::text'
      using v_payload into v_order_id,v_order_number;

    if v_kind<>'booklet' and v_source ? 'stock' then
      execute 'update public.products set stock=coalesce(stock,0)-$1 where id::text=$2 and coalesce(stock,0)>=$1 returning stock'
        using v_qty,v_item_id into v_stock;
      if v_stock is null then raise exception 'نفدت الكمية أثناء تأكيد الطلب: %',v_title; end if;
    end if;

    order_number := v_order_number; order_id := v_order_id; return next;
  end loop;
end
$$;

revoke all on function public.alin_create_store_orders(jsonb,jsonb,jsonb,text) from public;
grant execute on function public.alin_create_store_orders(jsonb,jsonb,jsonb,text) to anon, authenticated;

notify pgrst, 'reload schema';
commit;

-- فحص النتيجة: يجب أن تكون القيمتان true والعدد 0.
select
  (select column_default is not null
   from information_schema.columns
   where table_schema='public' and table_name='orders' and column_name='assignment_status') as default_exists,
  (position('''assignment_status'', ''pending_admin''' in pg_get_functiondef(
      'public.alin_create_store_orders(jsonb,jsonb,jsonb,text)'::regprocedure
   )) > 0) as rpc_sets_assignment_status,
  (select count(*) from public.orders where assignment_status is null) as null_assignment_rows;
