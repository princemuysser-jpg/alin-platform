-- ALIN v2.6.0 — Stage 3
-- تأمين إنشاء الطلب والأسعار وأجور التوصيل من الخادم.
-- آمن للتنفيذ أكثر من مرة، ولا يحذف الطلبات أو المنتجات أو الملازم.

begin;
create extension if not exists pgcrypto;

-- أعمدة الطلب التي تحتاجها النسخة الحالية. الإضافة فقط عند غياب العمود.
alter table public.orders add column if not exists payment_method text;
alter table public.orders add column if not exists fulfillment_type text;
alter table public.orders add column if not exists delivery_type text;
alter table public.orders add column if not exists pickup_library_id text;
alter table public.orders add column if not exists delivery_area text;
alter table public.orders add column if not exists delivery_address text;
alter table public.orders add column if not exists delivery_landmark text;
alter table public.orders add column if not exists delivery_fee numeric not null default 0;
alter table public.orders add column if not exists delivery_latitude numeric;
alter table public.orders add column if not exists delivery_longitude numeric;
alter table public.orders add column if not exists delivery_location_url text;
alter table public.orders add column if not exists delivery_location_accuracy integer;
alter table public.orders add column if not exists delivery_location_source text;

-- قراءة إعداد نصي سواء كان مخزناً كـ key/value أو داخل سجل main.data.
create or replace function public.alin_setting_text(p_key text, p_default text default null)
returns text
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  v_value text;
begin
  if to_regclass('public.settings') is null then return p_default; end if;

  begin
    execute $q$
      select nullif(btrim(to_jsonb(s)->>'value'),'')
      from public.settings s
      where coalesce(to_jsonb(s)->>'key','')=$1
      limit 1
    $q$ into v_value using p_key;
  exception when others then
    v_value:=null;
  end;

  if v_value is null then
    begin
      execute $q$
        select nullif(btrim((to_jsonb(s)->'data')->>$1),'')
        from public.settings s
        where coalesce(to_jsonb(s)->>'id','')='main'
           or coalesce(to_jsonb(s)->>'key','')='__main__'
        limit 1
      $q$ into v_value using p_key;
    exception when others then
      v_value:=null;
    end;
  end if;

  return coalesce(v_value,p_default);
end
$$;

create or replace function public.alin_setting_numeric(p_key text, p_default numeric)
returns numeric
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  v_text text;
  v_value numeric;
begin
  v_text:=public.alin_setting_text(p_key,null);
  begin
    v_value:=nullif(v_text,'')::numeric;
  exception when others then
    v_value:=null;
  end;
  return coalesce(v_value,p_default);
end
$$;

create or replace function public.alin_setting_boolean(p_key text, p_default boolean)
returns boolean
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  v text:=lower(coalesce(public.alin_setting_text(p_key,null),''));
begin
  if v in ('true','1','yes','on','active','enabled','مفتوح','نعم') then return true; end if;
  if v in ('false','0','no','off','inactive','disabled','مغلق','لا') then return false; end if;
  return p_default;
end
$$;

-- قراءة أول رقم صالح من عدة مفاتيح داخل صف JSON.
create or replace function public.alin_jsonb_numeric(p_row jsonb, p_keys text[], p_default numeric)
returns numeric
language plpgsql
immutable
as $$
declare
  v_key text;
  v_value numeric;
begin
  if p_row is null then return p_default; end if;
  foreach v_key in array p_keys loop
    begin
      v_value:=nullif(btrim(p_row->>v_key),'')::numeric;
      if v_value is not null then return v_value; end if;
    exception when others then
      null;
    end;
  end loop;
  return p_default;
end
$$;

revoke all on function public.alin_setting_text(text,text) from public,anon,authenticated;
revoke all on function public.alin_setting_numeric(text,numeric) from public,anon,authenticated;
revoke all on function public.alin_setting_boolean(text,boolean) from public,anon,authenticated;
revoke all on function public.alin_jsonb_numeric(jsonb,text[],numeric) from public,anon,authenticated;

create or replace function public.alin_create_store_orders(
  p_items jsonb,
  p_customer jsonb,
  p_fulfillment jsonb default '{}'::jsonb,
  p_coupon_code text default null
)
returns table(order_number text, order_id text)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_item jsonb;
  v_line jsonb;
  v_source jsonb;
  v_kind text;
  v_item_id text;
  v_qty integer;
  v_total_units integer:=0;
  v_title text;
  v_price numeric;
  v_stock numeric;
  v_line_subtotal numeric;
  v_subtotal numeric:=0;
  v_discount numeric:=0;
  v_total numeric;
  v_payload jsonb;
  v_order_number text;
  v_order_id text;
  v_index integer:=0;
  v_normalized_items jsonb:='[]'::jsonb;
  v_has_non_booklet boolean:=false;

  v_customer_name text:=btrim(coalesce(p_customer->>'name',''));
  v_customer_phone text:=translate(btrim(coalesce(p_customer->>'phone','')),'٠١٢٣٤٥٦٧٨٩','0123456789');

  v_fulfillment text;
  v_library_id text;
  v_library jsonb;
  v_delivery_area_input text;
  v_delivery_area text;
  v_delivery_area_row jsonb;
  v_active_area_count integer:=0;
  v_delivery_fee numeric:=0;
  v_delivery_landmark text;
  v_latitude numeric;
  v_longitude numeric;
  v_accuracy integer;
  v_location_url text;
  v_location_source text;
  v_payment_method text;

  v_coupon jsonb;
  v_coupon_id text;
  v_coupon_type text;
  v_coupon_value numeric:=0;
  v_coupon_limit numeric:=0;
  v_coupon_used numeric:=0;
  v_coupon_applies text:='all';
  v_coupon_expiry timestamptz;
  v_fixed_remaining numeric:=0;
  v_coupon_applied boolean:=false;
  v_eligible boolean;
begin
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then
    raise exception 'السلة فارغة';
  end if;
  if jsonb_array_length(p_items)>30 then
    raise exception 'عدد عناصر السلة أكبر من الحد المسموح';
  end if;

  v_customer_phone:=regexp_replace(v_customer_phone,'[^0-9+]','','g');
  if length(v_customer_name)<2 or length(v_customer_name)>120 then
    raise exception 'اكتب اسم الطالب بصورة صحيحة';
  end if;
  if v_customer_phone !~ '^\+?[0-9]{7,15}$' then
    raise exception 'اكتب رقم هاتف صحيح';
  end if;

  -- 1) تثبيت كل عنصر وسعره ومخزونه من قاعدة البيانات فقط.
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_kind:=lower(btrim(coalesce(v_item->>'kind','')));
    v_item_id:=btrim(coalesce(v_item->>'id',''));
    begin
      v_qty:=coalesce((v_item->>'qty')::integer,1);
    exception when others then
      v_qty:=1;
    end;
    v_qty:=least(greatest(v_qty,1),50);
    v_total_units:=v_total_units+v_qty;
    if v_total_units>200 then raise exception 'إجمالي الكميات أكبر من الحد المسموح'; end if;
    if v_item_id='' then raise exception 'عنصر غير صالح في السلة'; end if;

    v_source:=null;
    if v_kind in ('booklet','booklets','booklet_product','ملزمة','ملازم') then
      execute 'select to_jsonb(x) from public.booklets x where x.id::text=$1 limit 1'
        into v_source using v_item_id;
      if v_source is not null then v_kind:='booklet'; end if;
    end if;

    if v_source is null then
      execute 'select to_jsonb(x) from public.products x where x.id::text=$1 limit 1 for update'
        into v_source using v_item_id;
      if v_source is not null then
        v_kind:=case lower(coalesce(v_source->>'type',''))
          when 'gift' then 'gift'
          when 'gifts' then 'gift'
          when 'stationery' then 'stationery'
          when 'stationary' then 'stationery'
          else 'product'
        end;
      end if;
    end if;

    if v_source is null then
      execute 'select to_jsonb(x) from public.booklets x where x.id::text=$1 limit 1'
        into v_source using v_item_id;
      if v_source is not null then v_kind:='booklet'; end if;
    end if;

    if v_source is null then raise exception 'العنصر المطلوب غير موجود أو حُذف من المتجر'; end if;
    if lower(coalesce(v_source->>'is_hidden','false')) in ('true','1')
       or nullif(v_source->>'deleted_at','') is not null then
      raise exception 'العنصر غير متاح حالياً';
    end if;

    if v_kind='booklet' then
      if lower(coalesce(v_source->>'status','')) not in ('published','active','available')
         and lower(coalesce(v_source->>'publish_status','')) not in ('published','approved','active') then
        raise exception 'الملزمة غير منشورة حالياً';
      end if;
    elsif lower(coalesce(v_source->>'status','active')) in ('inactive','disabled','deleted','hidden') then
      raise exception 'المنتج غير متاح حالياً';
    end if;

    v_title:=coalesce(nullif(v_source->>'title',''),nullif(v_source->>'name',''),'منتج');
    v_price:=public.alin_jsonb_numeric(v_source,array['sale_price','price'],0);
    if v_price<0 or v_price>50000000 then raise exception 'سعر العنصر غير صحيح'; end if;

    if v_kind<>'booklet' and v_source ? 'stock' then
      v_stock:=public.alin_jsonb_numeric(v_source,array['stock'],0);
      if v_stock<v_qty then raise exception 'الكمية غير متوفرة: %',v_title; end if;
      v_has_non_booklet:=true;
    elsif v_kind<>'booklet' then
      v_has_non_booklet:=true;
    end if;

    v_line_subtotal:=v_price*v_qty;
    v_subtotal:=v_subtotal+v_line_subtotal;
    if v_subtotal>100000000 then raise exception 'قيمة السلة أكبر من الحد المسموح'; end if;

    v_normalized_items:=v_normalized_items||jsonb_build_array(jsonb_build_object(
      'kind',v_kind,'id',v_item_id,'qty',v_qty,'title',v_title,
      'price',v_price,'subtotal',v_line_subtotal
    ));
  end loop;

  -- 2) تثبيت طريقة الاستلام. لا نثق برسوم أو حالة دفع مرسلة من المتصفح.
  v_fulfillment:=lower(btrim(coalesce(
    p_fulfillment->>'fulfillment_type',
    p_fulfillment->>'delivery_type',''
  )));
  if v_fulfillment in ('pickup','library','cash_at_library') then
    v_fulfillment:='pickup';
  elsif v_fulfillment in ('home_delivery','courier','delivery','cash_to_courier') then
    v_fulfillment:='home_delivery';
  else
    raise exception 'اختر طريقة استلام صحيحة';
  end if;

  if v_fulfillment='pickup' then
    if v_has_non_booklet then
      raise exception 'القرطاسية والهدايا متاحة بالتوصيل إلى البيت فقط';
    end if;
    v_library_id:=btrim(coalesce(p_fulfillment->>'library_id',p_fulfillment->>'pickup_library_id',''));
    if v_library_id='' then raise exception 'اختر مكتبة الاستلام'; end if;

    select to_jsonb(a) into v_library
    from public.accounts a
    where a.id::text=v_library_id
      and lower(coalesce(to_jsonb(a)->>'role',''))='library'
    limit 1;

    if v_library is null
       or nullif(v_library->>'deleted_at','') is not null
       or lower(coalesce(v_library->>'status','active')) in ('inactive','disabled','deleted','rejected')
       or lower(coalesce(v_library->>'is_open','true')) in ('false','0','no')
       or lower(coalesce(v_library->>'open_status','open')) in ('closed','مغلق') then
      raise exception 'المكتبة المختارة غير متاحة حالياً';
    end if;

    v_delivery_fee:=0;
    v_payment_method:='cash_at_library';
    v_delivery_area:=null;
    v_delivery_landmark:=null;
    v_latitude:=null;v_longitude:=null;v_accuracy:=null;v_location_url:=null;v_location_source:=null;
  else
    if not public.alin_setting_boolean('delivery_enabled',true) then
      raise exception 'خدمة التوصيل متوقفة مؤقتاً';
    end if;

    v_delivery_area_input:=btrim(coalesce(p_fulfillment->>'delivery_area',''));
    v_delivery_landmark:=left(btrim(coalesce(p_fulfillment->>'delivery_landmark','')),300);
    if v_delivery_area_input='' then raise exception 'اختر منطقة التوصيل'; end if;

    select count(*) into v_active_area_count
    from public.delivery_areas d
    where lower(coalesce(to_jsonb(d)->>'status','active')) not in ('inactive','disabled','deleted')
      and lower(coalesce(to_jsonb(d)->>'active','true')) not in ('false','0','no');

    select to_jsonb(d) into v_delivery_area_row
    from public.delivery_areas d
    where lower(coalesce(to_jsonb(d)->>'status','active')) not in ('inactive','disabled','deleted')
      and lower(coalesce(to_jsonb(d)->>'active','true')) not in ('false','0','no')
      and (
        lower(btrim(coalesce(to_jsonb(d)->>'name','')))=lower(v_delivery_area_input)
        or coalesce(to_jsonb(d)->>'id','')=v_delivery_area_input
      )
    order by case when coalesce(to_jsonb(d)->>'id','')=v_delivery_area_input then 0 else 1 end
    limit 1;

    if v_active_area_count>0 and v_delivery_area_row is null then
      raise exception 'منطقة التوصيل غير معتمدة';
    end if;

    v_delivery_area:=coalesce(nullif(v_delivery_area_row->>'name',''),v_delivery_area_input);
    v_delivery_fee:=public.alin_jsonb_numeric(
      v_delivery_area_row,
      array['delivery_fee','fee','price','cost'],
      public.alin_setting_numeric('delivery_fee',0)
    );
    v_delivery_fee:=least(greatest(v_delivery_fee,0),100000);

    begin v_latitude:=nullif(p_fulfillment->>'delivery_latitude','')::numeric; exception when others then v_latitude:=null; end;
    begin v_longitude:=nullif(p_fulfillment->>'delivery_longitude','')::numeric; exception when others then v_longitude:=null; end;
    begin v_accuracy:=round(nullif(p_fulfillment->>'delivery_location_accuracy','')::numeric)::integer; exception when others then v_accuracy:=null; end;

    if (v_latitude is null)<>(v_longitude is null) then
      raise exception 'إحداثيات الموقع غير مكتملة';
    end if;
    if v_latitude is not null and (v_latitude<-90 or v_latitude>90 or v_longitude<-180 or v_longitude>180) then
      raise exception 'إحداثيات الموقع غير صحيحة';
    end if;
    if v_latitude is null and v_delivery_landmark='' then
      raise exception 'حدد الموقع أو اكتب أقرب نقطة دالة';
    end if;

    if v_latitude is not null then
      v_location_url:='https://www.google.com/maps?q='||v_latitude::text||','||v_longitude::text;
      v_location_source:='student_device';
      v_accuracy:=least(greatest(coalesce(v_accuracy,0),0),100000);
    else
      v_location_url:=null;v_location_source:='landmark';v_accuracy:=null;
    end if;
    v_library_id:=null;
    v_payment_method:='cash_to_courier';
  end if;

  -- 3) تثبيت الكوبون من قاعدة البيانات وقفل سجلّه أثناء العملية.
  if p_coupon_code is not null and btrim(p_coupon_code)<>'' then
    if to_regclass('public.coupons') is null then raise exception 'الكوبون غير صالح أو منتهي'; end if;
    select to_jsonb(c) into v_coupon
    from public.coupons c
    where lower(c.code::text)=lower(btrim(p_coupon_code))
    limit 1 for update;

    if v_coupon is null or lower(coalesce(v_coupon->>'status','active'))<>'active' then
      raise exception 'الكوبون غير صالح أو متوقف';
    end if;
    begin v_coupon_expiry:=nullif(v_coupon->>'expires_at','')::timestamptz; exception when others then v_coupon_expiry:=null; end;
    if v_coupon_expiry is not null and v_coupon_expiry<now() then raise exception 'الكوبون منتهي'; end if;

    v_coupon_limit:=greatest(public.alin_jsonb_numeric(v_coupon,array['max_uses','usage_limit'],0),0);
    v_coupon_used:=greatest(public.alin_jsonb_numeric(v_coupon,array['used_count','usage_count'],0),0);
    if v_coupon_limit>0 and v_coupon_used>=v_coupon_limit then raise exception 'انتهى عدد استخدامات الكوبون'; end if;

    v_coupon_id:=v_coupon->>'id';
    v_coupon_type:=lower(coalesce(v_coupon->>'discount_type','percent'));
    v_coupon_value:=greatest(public.alin_jsonb_numeric(v_coupon,array['discount_value'],0),0);
    v_coupon_applies:=lower(coalesce(v_coupon->>'applies_to','all'));
    if v_coupon_value<=0 then raise exception 'قيمة الكوبون غير صحيحة'; end if;
    if v_coupon_type='percent' then v_coupon_value:=least(v_coupon_value,100); end if;
    if v_coupon_type='fixed' then v_fixed_remaining:=least(v_coupon_value,v_subtotal); end if;
  end if;

  -- 4) إنشاء الطلبات. السعر والحالة والدفع والتوصيل كلها قيم خادم.
  for v_line in select value from jsonb_array_elements(v_normalized_items)
  loop
    v_index:=v_index+1;
    v_kind:=v_line->>'kind';
    v_item_id:=v_line->>'id';
    v_qty:=(v_line->>'qty')::integer;
    v_title:=v_line->>'title';
    v_price:=(v_line->>'price')::numeric;
    v_line_subtotal:=(v_line->>'subtotal')::numeric;
    v_discount:=0;

    v_eligible:=v_coupon_id is not null and (
      v_coupon_applies in ('all','كل المتجر','')
      or v_coupon_applies=v_kind
      or (v_coupon_applies='product' and v_kind<>'booklet')
    );
    if v_eligible then
      if v_coupon_type='fixed' and v_fixed_remaining>0 then
        v_discount:=least(v_line_subtotal,v_fixed_remaining);
        v_fixed_remaining:=v_fixed_remaining-v_discount;
      elsif v_coupon_type<>'fixed' then
        v_discount:=round(v_line_subtotal*v_coupon_value/100);
      end if;
      if v_discount>0 then v_coupon_applied:=true; end if;
    end if;

    v_order_number:='AL-'||to_char(clock_timestamp(),'YYMMDDHH24MISS')||'-'||lpad(v_index::text,2,'0')||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,4);
    v_order_id:=gen_random_uuid()::text;
    v_total:=greatest(v_line_subtotal-v_discount,0)+case when v_index=1 then v_delivery_fee else 0 end;

    v_payload:=jsonb_build_object(
      'id',v_order_id,'order_number',v_order_number,'kind',v_kind,'item_id',v_item_id,'title',v_title,
      'student_name',v_customer_name,'student_phone',v_customer_phone,'qty',v_qty,'unit_price',v_price,
      'total',v_total,'discount',v_discount,'coupon_code',case when v_coupon_applied or v_eligible then nullif(btrim(p_coupon_code),'') else null end,
      'status','new','assignment_status','pending_admin',
      'status_history',jsonb_build_array(jsonb_build_object('status','new','at',now(),'by','secure_checkout')),
      'payment_status','cod_pending','payment_method',v_payment_method,
      'fulfillment_type',v_fulfillment,
      'delivery_type',case when v_fulfillment='pickup' then 'library' else 'courier' end,
      'library_id',v_library_id,'pickup_library_id',v_library_id,
      'courier_id',null,'delegate_id',null,
      'delivery_area',v_delivery_area,'delivery_address',null,'delivery_landmark',nullif(v_delivery_landmark,''),
      'delivery_fee',case when v_index=1 then v_delivery_fee else 0 end,
      'delivery_latitude',v_latitude,'delivery_longitude',v_longitude,
      'delivery_location_url',v_location_url,'delivery_location_accuracy',v_accuracy,
      'delivery_location_source',v_location_source,
      'stock_reserved',false,'stock_restored_at',null,
      'created_at',now(),'updated_at',now()
    );

    execute 'insert into public.orders select (jsonb_populate_record(null::public.orders,$1)).* returning id::text,order_number::text'
      using v_payload into v_order_id,v_order_number;

    if v_kind<>'booklet' then
      execute 'update public.products set stock=coalesce(stock,0)-$1 where id::text=$2 and coalesce(stock,0)>=$1 returning stock'
        using v_qty,v_item_id into v_stock;
      if v_stock is null then raise exception 'نفدت الكمية أثناء تأكيد الطلب: %',v_title; end if;
    end if;

    order_number:=v_order_number;order_id:=v_order_id;return next;
  end loop;

  if v_coupon_id is not null then
    if not v_coupon_applied then raise exception 'الكوبون لا ينطبق على عناصر السلة'; end if;
    if exists(select 1 from information_schema.columns where table_schema='public' and table_name='coupons' and column_name='used_count') then
      execute 'update public.coupons set used_count=coalesce(used_count,0)+1 where id::text=$1' using v_coupon_id;
    end if;
    if exists(select 1 from information_schema.columns where table_schema='public' and table_name='coupons' and column_name='usage_count') then
      execute 'update public.coupons set usage_count=coalesce(usage_count,0)+1 where id::text=$1' using v_coupon_id;
    end if;
  end if;
end
$$;

revoke all on function public.alin_create_store_orders(jsonb,jsonb,jsonb,text) from public;
grant execute on function public.alin_create_store_orders(jsonb,jsonb,jsonb,text) to anon,authenticated;

-- يمنع أي طلب مباشر من المتصفح يتجاوز خدمة التسعير الآمنة.
alter table public.orders enable row level security;
revoke insert on public.orders from public,anon,authenticated;

notify pgrst,'reload schema';
commit;

-- فحص النتيجة: يجب أن تكون القيم المنطقية true.
select
  to_regprocedure('public.alin_create_store_orders(jsonb,jsonb,jsonb,text)') is not null as secure_checkout_rpc_exists,
  coalesce((select p.prosrc ~ 'alin_setting_numeric[\s\S]*delivery_fee' from pg_proc p where p.oid=to_regprocedure('public.alin_create_store_orders(jsonb,jsonb,jsonb,text)')),false) as delivery_fee_from_server,
  coalesce((select p.prosrc ~ '''payment_status''[[:space:]]*,[[:space:]]*''cod_pending''' from pg_proc p where p.oid=to_regprocedure('public.alin_create_store_orders(jsonb,jsonb,jsonb,text)')),false) as payment_status_forced,
  coalesce((select p.prosrc ~ '''assignment_status''[[:space:]]*,[[:space:]]*''pending_admin''' from pg_proc p where p.oid=to_regprocedure('public.alin_create_store_orders(jsonb,jsonb,jsonb,text)')),false) as assignment_status_forced,
  not has_table_privilege('anon','public.orders','INSERT') as anon_direct_insert_blocked,
  not has_table_privilege('authenticated','public.orders','INSERT') as authenticated_direct_insert_blocked;
