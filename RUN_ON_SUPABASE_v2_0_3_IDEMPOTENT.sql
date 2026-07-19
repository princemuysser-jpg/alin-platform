-- منصة آلين v2.0.3 — إغلاق صلاحيات anon الخطرة وتقوية إنشاء الطلبات
-- شغّل هذا الملف مرة واحدة من Supabase > SQL Editor بعد التأكد أن حساب المدير مربوط في accounts.auth_user_id.

begin;

alter table public.accounts add column if not exists auth_user_id uuid;
create index if not exists accounts_auth_user_id_idx on public.accounts(auth_user_id);

create or replace function public.alin_current_account_id()
returns text
language sql stable security definer
set search_path = public
as $$
  select id::text from public.accounts
  where auth_user_id = auth.uid() and status = 'active'
  limit 1
$$;

create or replace function public.alin_current_role()
returns text
language sql stable security definer
set search_path = public
as $$
  select role::text from public.accounts
  where auth_user_id = auth.uid() and status = 'active'
  limit 1
$$;

create or replace function public.alin_is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(public.alin_current_role() = 'admin', false)
$$;

revoke all on function public.alin_current_account_id() from public;
revoke all on function public.alin_current_role() from public;
revoke all on function public.alin_is_admin() from public;
grant execute on function public.alin_current_account_id() to authenticated;
grant execute on function public.alin_current_role() to authenticated;
grant execute on function public.alin_is_admin() to authenticated;

-- الحسابات: لا قراءة ولا كتابة للمستخدم المجهول.
alter table public.accounts enable row level security;
drop policy if exists alin_legacy_admin_accounts_select on public.accounts;
drop policy if exists alin_legacy_admin_accounts_insert on public.accounts;
drop policy if exists alin_legacy_admin_accounts_update on public.accounts;
drop policy if exists alin_legacy_admin_accounts_delete on public.accounts;
drop policy if exists accounts_secure_select on public.accounts;
drop policy if exists accounts_admin_insert on public.accounts;
drop policy if exists accounts_admin_update on public.accounts;
drop policy if exists accounts_admin_delete on public.accounts;
create policy accounts_secure_select on public.accounts for select to authenticated
using (auth_user_id = auth.uid() or public.alin_is_admin());
create policy accounts_admin_insert on public.accounts for insert to authenticated
with check (public.alin_is_admin());
create policy accounts_admin_update on public.accounts for update to authenticated
using (auth_user_id = auth.uid() or public.alin_is_admin())
with check (auth_user_id = auth.uid() or public.alin_is_admin());
create policy accounts_admin_delete on public.accounts for delete to authenticated
using (public.alin_is_admin());
create or replace function public.alin_protect_account_identity()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.alin_is_admin() then
    new.id := old.id;
    new.role := old.role;
    new.username := old.username;
    new.auth_user_id := old.auth_user_id;
    new.status := old.status;
    new.password_hash := old.password_hash;
  end if;
  return new;
end
$$;
drop trigger if exists alin_accounts_protect_identity on public.accounts;
create trigger alin_accounts_protect_identity
before update on public.accounts
for each row execute function public.alin_protect_account_identity();
revoke all on function public.alin_protect_account_identity() from public;

revoke all on public.accounts from anon;
grant select, insert, update, delete on public.accounts to authenticated;

-- دليل عام آمن للمدرسين والمكتبات الفعالة فقط.
-- لا يكشف اسم الدخول أو auth_user_id أو أي بيانات مصادقة.
create or replace view public.alin_public_accounts
with (security_barrier = true)
as
select id, role, name, status, area, landmark
from public.accounts
where role in ('teacher','library') and status = 'active';
revoke all on public.alin_public_accounts from public;
grant select on public.alin_public_accounts to anon, authenticated;

-- الملازم: العرض العام للمنشور فقط، والإدارة أو المدرس صاحب الملزمة يكتب.
alter table public.booklets enable row level security;
drop policy if exists alin_legacy_admin_booklets_insert on public.booklets;
drop policy if exists alin_legacy_admin_booklets_update on public.booklets;
drop policy if exists alin_legacy_admin_booklets_delete on public.booklets;
drop policy if exists booklets_public_read on public.booklets;
drop policy if exists booklets_authenticated_read on public.booklets;
drop policy if exists booklets_secure_insert on public.booklets;
drop policy if exists booklets_secure_update on public.booklets;
drop policy if exists booklets_secure_delete on public.booklets;
create policy booklets_public_read on public.booklets for select to anon
using (status = 'published' and coalesce(is_hidden,false) = false);
create policy booklets_authenticated_read on public.booklets for select to authenticated
using (status = 'published' or public.alin_is_admin() or teacher_id::text = public.alin_current_account_id());
create policy booklets_secure_insert on public.booklets for insert to authenticated
with check (public.alin_is_admin() or (public.alin_current_role()='teacher' and teacher_id::text=public.alin_current_account_id()));
create policy booklets_secure_update on public.booklets for update to authenticated
using (public.alin_is_admin() or teacher_id::text=public.alin_current_account_id())
with check (public.alin_is_admin() or teacher_id::text=public.alin_current_account_id());
create policy booklets_secure_delete on public.booklets for delete to authenticated
using (public.alin_is_admin() or teacher_id::text=public.alin_current_account_id());
revoke insert, update, delete on public.booklets from anon;
grant select on public.booklets to anon;
grant select, insert, update, delete on public.booklets to authenticated;

-- المنتجات: قراءة عامة، والكتابة للإدارة فقط.
alter table public.products enable row level security;
drop policy if exists alin_legacy_admin_products_insert on public.products;
drop policy if exists alin_legacy_admin_products_update on public.products;
drop policy if exists alin_legacy_admin_products_delete on public.products;
drop policy if exists products_public_read on public.products;
drop policy if exists products_authenticated_read on public.products;
drop policy if exists products_admin_insert on public.products;
drop policy if exists products_admin_update on public.products;
drop policy if exists products_admin_delete on public.products;
create policy products_public_read on public.products for select to anon
using (status = 'published' and coalesce(is_hidden,false) = false);
create policy products_authenticated_read on public.products for select to authenticated
using (status = 'published' or public.alin_is_admin());
create policy products_admin_insert on public.products for insert to authenticated with check (public.alin_is_admin());
create policy products_admin_update on public.products for update to authenticated using (public.alin_is_admin()) with check (public.alin_is_admin());
create policy products_admin_delete on public.products for delete to authenticated using (public.alin_is_admin());
revoke insert, update, delete on public.products from anon;
grant select on public.products to anon;
grant select, insert, update, delete on public.products to authenticated;

-- مناطق التوصيل: عرض عام، إدارة فقط للكتابة.
alter table public.delivery_areas enable row level security;
drop policy if exists alin_legacy_admin_delivery_areas_select on public.delivery_areas;
drop policy if exists alin_legacy_admin_delivery_areas_insert on public.delivery_areas;
drop policy if exists alin_legacy_admin_delivery_areas_update on public.delivery_areas;
drop policy if exists alin_legacy_admin_delivery_areas_delete on public.delivery_areas;
drop policy if exists delivery_areas_public_read on public.delivery_areas;
drop policy if exists delivery_areas_admin_insert on public.delivery_areas;
drop policy if exists delivery_areas_admin_update on public.delivery_areas;
drop policy if exists delivery_areas_admin_delete on public.delivery_areas;
create policy delivery_areas_public_read on public.delivery_areas for select to anon, authenticated using (true);
create policy delivery_areas_admin_insert on public.delivery_areas for insert to authenticated with check (public.alin_is_admin());
create policy delivery_areas_admin_update on public.delivery_areas for update to authenticated using (public.alin_is_admin()) with check (public.alin_is_admin());
create policy delivery_areas_admin_delete on public.delivery_areas for delete to authenticated using (public.alin_is_admin());
revoke insert, update, delete on public.delivery_areas from anon;
grant select on public.delivery_areas to anon;
grant select, insert, update, delete on public.delivery_areas to authenticated;

-- الكوبونات: القراءة مطلوبة للمتجر، والكتابة للإدارة فقط.
alter table public.coupons enable row level security;
drop policy if exists alin_app_coupons_select on public.coupons;
drop policy if exists alin_app_coupons_insert on public.coupons;
drop policy if exists alin_app_coupons_update on public.coupons;
drop policy if exists alin_app_coupons_delete on public.coupons;
drop policy if exists coupons_public_read on public.coupons;
drop policy if exists coupons_admin_read on public.coupons;
drop policy if exists coupons_admin_insert on public.coupons;
drop policy if exists coupons_admin_update on public.coupons;
drop policy if exists coupons_admin_delete on public.coupons;
create policy coupons_admin_read on public.coupons for select to authenticated using (public.alin_is_admin());
create policy coupons_admin_insert on public.coupons for insert to authenticated with check (public.alin_is_admin());
create policy coupons_admin_update on public.coupons for update to authenticated using (public.alin_is_admin()) with check (public.alin_is_admin());
create policy coupons_admin_delete on public.coupons for delete to authenticated using (public.alin_is_admin());
revoke insert, update, delete on public.coupons from anon;
revoke select on public.coupons from anon;
grant select, insert, update, delete on public.coupons to authenticated;

-- الإعلانات: العرض العام للفعال، والكتابة للإدارة فقط.
alter table public.banners enable row level security;
drop policy if exists banners_authenticated_insert on public.banners;
drop policy if exists banners_authenticated_update on public.banners;
drop policy if exists banners_authenticated_delete on public.banners;
drop policy if exists banners_admin_insert on public.banners;
drop policy if exists banners_admin_update on public.banners;
drop policy if exists banners_admin_delete on public.banners;
create policy banners_admin_insert on public.banners for insert to authenticated with check (public.alin_is_admin());
create policy banners_admin_update on public.banners for update to authenticated using (public.alin_is_admin()) with check (public.alin_is_admin());
create policy banners_admin_delete on public.banners for delete to authenticated using (public.alin_is_admin());
revoke insert, update, delete on public.banners from anon;
grant select on public.banners to anon;
grant select, insert, update, delete on public.banners to authenticated;

notify pgrst, 'reload schema';
commit;

-- ملاحظة: الأوامر التالية مضافة في v2.0.1 لتنظيف كلمات المرور القديمة وتأمين المندوبين.
-- إذا شُغّل الملف سابقاً، هذه الأوامر قابلة لإعادة التشغيل.

-- يفضل وضعها قبل COMMIT، لذلك ننفذها في معاملة مستقلة آمنة.
begin;

-- لا نحتفظ بأي كلمة مرور داخل جداول التطبيق بعد الترحيل إلى Supabase Auth.
do $$
begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='accounts' and column_name='password_hash') then
    execute 'alter table public.accounts alter column password_hash drop not null';
    execute 'update public.accounts set password_hash = null where password_hash is not null';
  end if;
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='couriers' and column_name='password_hash') then
    execute 'alter table public.couriers alter column password_hash drop not null';
    execute 'update public.couriers set password_hash = null where password_hash is not null';
  end if;
end $$;

-- المندوبون: المدير يرى ويدير الجميع، والمندوب يرى صفه ويحدث حالة توفره فقط.
do $$
begin
  if to_regclass('public.couriers') is not null then
    execute 'alter table public.couriers enable row level security';
    execute 'drop policy if exists couriers_secure_select on public.couriers';
    execute 'drop policy if exists couriers_admin_insert on public.couriers';
    execute 'drop policy if exists couriers_secure_update on public.couriers';
    execute 'drop policy if exists couriers_admin_delete on public.couriers';
    execute $p$create policy couriers_secure_select on public.couriers for select to authenticated
      using (public.alin_is_admin() or id::text = public.alin_current_account_id())$p$;
    execute $p$create policy couriers_admin_insert on public.couriers for insert to authenticated
      with check (public.alin_is_admin())$p$;
    execute $p$create policy couriers_secure_update on public.couriers for update to authenticated
      using (public.alin_is_admin() or id::text = public.alin_current_account_id())
      with check (public.alin_is_admin() or id::text = public.alin_current_account_id())$p$;
    execute $p$create policy couriers_admin_delete on public.couriers for delete to authenticated
      using (public.alin_is_admin())$p$;
    execute 'revoke all on public.couriers from anon';
    execute 'grant select, insert, update, delete on public.couriers to authenticated';
  end if;
end $$;

create or replace function public.alin_protect_courier_self_update()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  allowed jsonb := '{}'::jsonb;
  incoming jsonb := to_jsonb(new);
begin
  if public.alin_is_admin() then return new; end if;
  if public.alin_current_role() <> 'courier' or old.id::text <> public.alin_current_account_id() then
    raise exception 'غير مسموح بتعديل بيانات هذا المندوب';
  end if;
  if incoming ? 'availability' then allowed := allowed || jsonb_build_object('availability', incoming->'availability'); end if;
  if incoming ? 'work_status' then allowed := allowed || jsonb_build_object('work_status', incoming->'work_status'); end if;
  if incoming ? 'updated_at' then allowed := allowed || jsonb_build_object('updated_at', incoming->'updated_at'); end if;
  return jsonb_populate_record(old, allowed);
end
$$;
revoke all on function public.alin_protect_courier_self_update() from public;

do $$
begin
  if to_regclass('public.couriers') is not null then
    execute 'drop trigger if exists alin_couriers_protect_self_update on public.couriers';
    execute 'create trigger alin_couriers_protect_self_update before update on public.couriers for each row execute function public.alin_protect_courier_self_update()';
  end if;
end $$;

notify pgrst, 'reload schema';
commit;


-- ============================================================
-- v2.0.1: إنشاء الطلبات من الخادم بدلاً من الكتابة المباشرة
-- ============================================================
begin;
create extension if not exists pgcrypto;

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
  v_area jsonb;
  v_requested_area text := btrim(coalesce(p_fulfillment->>'delivery_area',''));
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then
    raise exception 'السلة فارغة';
  end if;
  if jsonb_array_length(p_items)>50 then
    raise exception 'عدد عناصر السلة أكبر من الحد المسموح';
  end if;
  if v_customer_name='' or v_customer_phone='' then
    raise exception 'أكمل اسم الطالب ورقم الهاتف';
  end if;
  if length(v_customer_name)>120 or length(v_customer_phone)>30 then
    raise exception 'بيانات الزبون غير صحيحة';
  end if;

  -- لا نثق بأي رسوم يرسلها المتصفح. الرسوم تؤخذ من جدول المناطق حصراً.
  v_delivery_fee := 0;
  if coalesce(p_fulfillment->>'fulfillment_type','')='home_delivery' then
    if v_requested_area='' then
      raise exception 'اختر منطقة التوصيل';
    end if;
    execute $q$
      select to_jsonb(a)
      from public.delivery_areas a
      where a.id::text=$1
         or lower(coalesce(to_jsonb(a)->>'name',to_jsonb(a)->>'area',''))=lower($1)
      limit 1
    $q$ into v_area using v_requested_area;
    if v_area is null then
      raise exception 'منطقة التوصيل غير معتمدة';
    end if;
    if coalesce(v_area->>'status','active') not in ('active','available','published') then
      raise exception 'منطقة التوصيل غير متاحة حالياً';
    end if;
    v_delivery_fee := least(greatest(coalesce(
      nullif(v_area->>'delivery_fee','')::numeric,
      nullif(v_area->>'fee','')::numeric,
      nullif(v_area->>'price','')::numeric,
      0
    ),0),100000);
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_index := v_index + 1;
    v_kind := lower(coalesce(v_item->>'kind',''));
    v_item_id := btrim(coalesce(v_item->>'id',''));
    v_qty := least(greatest(coalesce((v_item->>'qty')::integer,1),1),100);
    if v_item_id='' or v_kind not in ('booklet','product','stationery','gift') then
      raise exception 'عنصر غير صالح في السلة';
    end if;

    if v_kind='booklet' then
      execute 'select to_jsonb(x) from public.booklets x where x.id::text=$1 limit 1'
        into v_source using v_item_id;
    else
      execute 'select to_jsonb(x) from public.products x where x.id::text=$1 limit 1 for update'
        into v_source using v_item_id;
    end if;
    if v_source is null then raise exception 'العنصر المطلوب غير موجود'; end if;

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
      'status','new','payment_status',coalesce(p_fulfillment->>'payment_status','cod_pending'),
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

-- يمنع المتجر من الكتابة المباشرة إلى جدول الطلبات؛ الإنشاء يتم عبر RPC فقط.
do $$
begin
  if to_regclass('public.orders') is not null then
    execute 'alter table public.orders enable row level security';
    execute 'revoke insert on public.orders from anon, authenticated';
  end if;
end $$;


-- Public coupon validation without exposing the coupons table
drop function if exists public.alin_validate_coupon(text);
create function public.alin_validate_coupon(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare c jsonb;
begin
  if p_code is null or btrim(p_code)='' then return jsonb_build_object('valid',false); end if;
  select to_jsonb(x) into c from public.coupons x
   where lower(x.code::text)=lower(btrim(p_code))
     and coalesce(x.status,'active')='active'
     and (x.expires_at is null or x.expires_at >= now())
     and (coalesce(x.max_uses,x.usage_limit,0)=0 or coalesce(x.used_count,x.usage_count,0) < coalesce(x.max_uses,x.usage_limit,0))
   limit 1;
  if c is null then return jsonb_build_object('valid',false); end if;
  return jsonb_build_object('valid',true,'code',c->>'code','discount_type',coalesce(c->>'discount_type','percent'),'discount_value',coalesce((c->>'discount_value')::numeric,0),'applies_to',coalesce(c->>'applies_to','all'));
end $$;
revoke all on function public.alin_validate_coupon(text) from public;
grant execute on function public.alin_validate_coupon(text) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
