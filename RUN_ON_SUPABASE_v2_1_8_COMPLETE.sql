-- منصة آلين v2.1.8 — تحديث Supabase الكامل لمسار تحويل واستلام طلبات المندوب
-- شغّل هذا الملف من Supabase > SQL Editor بعد التأكد أن حساب المدير مربوط في accounts.auth_user_id. الملف قابل لإعادة التشغيل بأمان.

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

-- الإعلانات: ملف واحد وصلاحيات واحدة للعرض والإدارة.
alter table public.banners add column if not exists image_path text;
alter table public.banners add column if not exists image_url text;
alter table public.banners add column if not exists link_url text;
alter table public.banners add column if not exists start_date date;
alter table public.banners add column if not exists end_date date;
alter table public.banners add column if not exists sort_order integer not null default 0;
alter table public.banners add column if not exists active boolean not null default true;
alter table public.banners add column if not exists created_at timestamptz not null default now();
alter table public.banners add column if not exists updated_at timestamptz not null default now();
alter table public.banners enable row level security;
drop policy if exists banners_authenticated_insert on public.banners;
drop policy if exists banners_authenticated_update on public.banners;
drop policy if exists banners_authenticated_delete on public.banners;
drop policy if exists banners_public_read on public.banners;
drop policy if exists banners_admin_insert on public.banners;
drop policy if exists banners_admin_update on public.banners;
drop policy if exists banners_admin_delete on public.banners;
create policy banners_public_read on public.banners for select to anon, authenticated using (true);
create policy banners_admin_insert on public.banners for insert to authenticated with check (public.alin_is_admin());
create policy banners_admin_update on public.banners for update to authenticated using (public.alin_is_admin()) with check (public.alin_is_admin());
create policy banners_admin_delete on public.banners for delete to authenticated using (public.alin_is_admin());
revoke insert, update, delete on public.banners from anon;
grant select on public.banners to anon;
grant select, insert, update, delete on public.banners to authenticated;

-- التخزين المعتمد: bucket واحد باسم alin-files، وصور البنرات داخل banners/.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'alin-files','alin-files',true,5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists alin_files_public_read on storage.objects;
drop policy if exists alin_banners_admin_insert on storage.objects;
drop policy if exists alin_banners_admin_update on storage.objects;
drop policy if exists alin_banners_admin_delete on storage.objects;

create policy alin_files_public_read on storage.objects
for select to anon, authenticated
using (bucket_id='alin-files');

create policy alin_banners_admin_insert on storage.objects
for insert to authenticated
with check (
  bucket_id='alin-files' and
  (storage.foldername(name))[1]='banners' and
  public.alin_is_admin()
);

create policy alin_banners_admin_update on storage.objects
for update to authenticated
using (
  bucket_id='alin-files' and
  (storage.foldername(name))[1]='banners' and
  public.alin_is_admin()
)
with check (
  bucket_id='alin-files' and
  (storage.foldername(name))[1]='banners' and
  public.alin_is_admin()
);

create policy alin_banners_admin_delete on storage.objects
for delete to authenticated
using (
  bucket_id='alin-files' and
  (storage.foldername(name))[1]='banners' and
  public.alin_is_admin()
);



notify pgrst, 'reload schema';
commit;

-- ملاحظة: الأوامر التالية مضافة في v2.1.0 لتنظيف كلمات المرور القديمة وتأمين المندوبين.
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
-- v2.1.0: إنشاء الطلبات من الخادم بدلاً من الكتابة المباشرة
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

-- ============================================================
-- v2.1.0: حماية الجداول الحساسة وسياسات RLS الموحدة
-- ============================================================
begin;

create or replace function public.alin_is_finance_staff()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(public.alin_current_role() in ('admin','accountant'), false)
$$;

create or replace function public.alin_row_owner_match(p_row jsonb)
returns boolean
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_id text := public.alin_current_account_id();
  v_role text := public.alin_current_role();
  v_party_role text := lower(coalesce(p_row->>'party_role',p_row->>'role',p_row->>'type',''));
begin
  if v_id is null then return false; end if;
  if coalesce(p_row->>'account_id','')=v_id
     or coalesce(p_row->>'user_id','')=v_id
     or coalesce(p_row->>'owner_id','')=v_id
     or coalesce(p_row->>'teacher_id','')=v_id
     or coalesce(p_row->>'library_id','')=v_id
     or coalesce(p_row->>'courier_id','')=v_id
     or coalesce(p_row->>'delegate_id','')=v_id
     or coalesce(p_row->>'party_id','')=v_id then
    if v_party_role='' then return true; end if;
    if v_party_role=v_role then return true; end if;
    if v_role='courier' and v_party_role in ('courier','delegate') then return true; end if;
    if v_role='library' and v_party_role='library' then return true; end if;
    if v_role='teacher' and v_party_role='teacher' then return true; end if;
  end if;
  return false;
end
$$;

create or replace function public.alin_notification_visible(p_row jsonb)
returns boolean
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_role text := public.alin_current_role();
  v_id text := public.alin_current_account_id();
  v_target_role text := lower(coalesce(p_row->>'target_role',p_row->>'audience','all'));
  v_target_id text := coalesce(p_row->>'target_id','');
begin
  if public.alin_is_admin() then return true; end if;
  if v_role is null then return false; end if;
  if v_target_role not in ('all',v_role,case when v_role='courier' then 'delegate' else v_role end) then return false; end if;
  return v_target_id='' or v_target_id=v_id;
end
$$;

create or replace function public.alin_order_visible(p_row jsonb)
returns boolean
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_role text := public.alin_current_role();
  v_id text := public.alin_current_account_id();
  v_item_id text := coalesce(p_row->>'item_id',p_row->>'booklet_id','');
begin
  if public.alin_is_finance_staff() then return true; end if;
  if v_id is null then return false; end if;
  if v_role='library' and v_id in (coalesce(p_row->>'library_id',''),coalesce(p_row->>'pickup_library_id','')) then return true; end if;
  if v_role='courier' and v_id in (coalesce(p_row->>'courier_id',''),coalesce(p_row->>'delegate_id','')) then return true; end if;
  if v_role='teacher' then
    if coalesce(p_row->>'teacher_id','')=v_id then return true; end if;
    if v_item_id<>'' and exists(
      select 1 from public.booklets b
      where b.id::text=v_item_id and b.teacher_id::text=v_id
    ) then return true; end if;
  end if;
  return false;
end
$$;

create or replace function public.alin_order_manageable(p_row jsonb)
returns boolean
language plpgsql stable security definer
set search_path = public
as $$
declare
  v_role text := public.alin_current_role();
  v_id text := public.alin_current_account_id();
begin
  if public.alin_is_admin() then return true; end if;
  if v_id is null then return false; end if;
  if v_role='library' and v_id in (coalesce(p_row->>'library_id',''),coalesce(p_row->>'pickup_library_id','')) then return true; end if;
  if v_role='courier' and v_id in (coalesce(p_row->>'courier_id',''),coalesce(p_row->>'delegate_id','')) then return true; end if;
  return false;
end
$$;

revoke all on function public.alin_is_finance_staff() from public;
revoke all on function public.alin_row_owner_match(jsonb) from public;
revoke all on function public.alin_notification_visible(jsonb) from public;
revoke all on function public.alin_order_visible(jsonb) from public;
revoke all on function public.alin_order_manageable(jsonb) from public;
grant execute on function public.alin_is_finance_staff() to authenticated;
grant execute on function public.alin_row_owner_match(jsonb) to authenticated;
grant execute on function public.alin_notification_visible(jsonb) to authenticated;
grant execute on function public.alin_order_visible(jsonb) to authenticated;
grant execute on function public.alin_order_manageable(jsonb) to authenticated;

-- عرض عام آمن لأسماء المدرسين والمكتبات فقط.
do $$
declare
  v_cols text;
begin
  select string_agg(quote_ident(column_name),', ' order by ordinal_position)
  into v_cols
  from information_schema.columns
  where table_schema='public' and table_name='accounts'
    and column_name = any(array['id','role','name','status','area','landmark','avatar_path','image_path','profile_image','created_at']);
  if coalesce(v_cols,'')<>'' then
    execute 'drop view if exists public.alin_public_accounts';
    execute format(
      'create view public.alin_public_accounts as select %s from public.accounts where status=''active'' and role in (''teacher'',''library'')',
      v_cols
    );
    execute 'revoke all on public.alin_public_accounts from public';
    execute 'grant select on public.alin_public_accounts to anon, authenticated';
  end if;
end $$;

-- الإعدادات العامة فقط، بدون مفاتيح الربط وكلمات المرور.
do $$
declare
  has_id boolean;
  has_key boolean;
  has_value boolean;
  has_data boolean;
  has_updated boolean;
  v_select text := '';
  v_where text := 'true';
begin
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='settings' and column_name='id') into has_id;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='settings' and column_name='key') into has_key;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='settings' and column_name='value') into has_value;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='settings' and column_name='data') into has_data;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='settings' and column_name='updated_at') into has_updated;
  if has_id then v_select := v_select || 'id'; end if;
  if has_key then v_select := v_select || case when v_select<>'' then ', ' else '' end || 'key'; end if;
  if has_value then v_select := v_select || case when v_select<>'' then ', ' else '' end || 'value'; end if;
  if has_data then
    v_select := v_select || case when v_select<>'' then ', ' else '' end ||
      '(coalesce(data,''{}''::jsonb) - array[''admin_password_hash'',''admin_password'',''password'',''supabase_url'',''supabase_anon_key'',''service_role_key'',''api_key'',''secret'',''token'']) as data';
  end if;
  if has_updated then v_select := v_select || case when v_select<>'' then ', ' else '' end || 'updated_at'; end if;
  if has_key then
    v_where := 'lower(coalesce(key::text,'''')) !~ ''(password|secret|token|service_role|anon_key|api_key|supabase_key)''';
  end if;
  if v_select<>'' then
    execute 'drop view if exists public.alin_public_settings';
    execute format('create view public.alin_public_settings as select %s from public.settings where %s',v_select,v_where);
    execute 'revoke all on public.alin_public_settings from public';
    execute 'grant select on public.alin_public_settings to anon, authenticated';
  end if;
end $$;

-- الأقسام والإعدادات.
do $$
declare p record;
begin
  if to_regclass('public.categories') is not null then
    alter table public.categories enable row level security;
    for p in select policyname from pg_policies where schemaname='public' and tablename='categories' loop
      execute format('drop policy if exists %I on public.categories',p.policyname);
    end loop;
    create policy alin_v204_categories_read on public.categories for select to anon, authenticated using (true);
    create policy alin_v204_categories_insert on public.categories for insert to authenticated with check (public.alin_is_admin());
    create policy alin_v204_categories_update on public.categories for update to authenticated using (public.alin_is_admin()) with check (public.alin_is_admin());
    create policy alin_v204_categories_delete on public.categories for delete to authenticated using (public.alin_is_admin());
    revoke insert,update,delete on public.categories from anon;
    grant select on public.categories to anon;
    grant select,insert,update,delete on public.categories to authenticated;
  end if;
  if to_regclass('public.settings') is not null then
    alter table public.settings enable row level security;
    for p in select policyname from pg_policies where schemaname='public' and tablename='settings' loop
      execute format('drop policy if exists %I on public.settings',p.policyname);
    end loop;
    create policy alin_v204_settings_admin_select on public.settings for select to authenticated using (public.alin_is_admin());
    create policy alin_v204_settings_admin_insert on public.settings for insert to authenticated with check (public.alin_is_admin());
    create policy alin_v204_settings_admin_update on public.settings for update to authenticated using (public.alin_is_admin()) with check (public.alin_is_admin());
    create policy alin_v204_settings_admin_delete on public.settings for delete to authenticated using (public.alin_is_admin());
    revoke all on public.settings from anon;
    grant select,insert,update,delete on public.settings to authenticated;
  end if;
end $$;

-- الإشعارات.
do $$
declare p record;
begin
  if to_regclass('public.notifications') is not null then
    alter table public.notifications add column if not exists target_role text default 'all';
    alter table public.notifications add column if not exists target_id text;
    alter table public.notifications add column if not exists read_at timestamptz;
    alter table public.notifications add column if not exists updated_at timestamptz;
    alter table public.notifications enable row level security;
    for p in select policyname from pg_policies where schemaname='public' and tablename='notifications' loop
      execute format('drop policy if exists %I on public.notifications',p.policyname);
    end loop;
    create policy alin_v204_notifications_public_read on public.notifications for select to anon
      using (lower(coalesce(target_role,'all')) in ('all','store','student') and coalesce(target_id,'')='');
    create policy alin_v204_notifications_user_read on public.notifications for select to authenticated
      using (public.alin_notification_visible(to_jsonb(notifications)));
    create policy alin_v204_notifications_admin_insert on public.notifications for insert to authenticated
      with check (public.alin_is_admin());
    create policy alin_v204_notifications_user_update on public.notifications for update to authenticated
      using (public.alin_notification_visible(to_jsonb(notifications)))
      with check (public.alin_notification_visible(to_jsonb(notifications)));
    create policy alin_v204_notifications_admin_delete on public.notifications for delete to authenticated
      using (public.alin_is_admin());
    revoke insert,update,delete on public.notifications from anon;
    grant select on public.notifications to anon;
    grant select,insert,update,delete on public.notifications to authenticated;
  end if;
end $$;

create or replace function public.alin_protect_notification_update()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if public.alin_is_admin() then return new; end if;
  if (to_jsonb(new) - array['read_at','updated_at']) <> (to_jsonb(old) - array['read_at','updated_at']) then
    raise exception 'مسموح فقط بتحديد الإشعار كمقروء';
  end if;
  new.updated_at := now();
  return new;
end
$$;
revoke all on function public.alin_protect_notification_update() from public;
do $$ begin
  if to_regclass('public.notifications') is not null then
    drop trigger if exists alin_notifications_protect_update on public.notifications;
    create trigger alin_notifications_protect_update before update on public.notifications
    for each row execute function public.alin_protect_notification_update();
  end if;
end $$;

-- الطلبات والتتبع الآمن.
do $$
declare p record;
begin
  if to_regclass('public.orders') is not null then
    alter table public.orders enable row level security;
    for p in select policyname from pg_policies where schemaname='public' and tablename='orders' loop
      execute format('drop policy if exists %I on public.orders',p.policyname);
    end loop;
    create policy alin_v204_orders_read on public.orders for select to authenticated
      using (public.alin_order_visible(to_jsonb(orders)));
    create policy alin_v204_orders_update on public.orders for update to authenticated
      using (public.alin_order_manageable(to_jsonb(orders)))
      with check (public.alin_order_manageable(to_jsonb(orders)));
    create policy alin_v204_orders_delete on public.orders for delete to authenticated
      using (public.alin_is_admin());
    revoke all on public.orders from anon;
    revoke insert on public.orders from authenticated;
    grant select,update,delete on public.orders to authenticated;
  end if;
end $$;


create or replace function public.alin_protect_order_update()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_role text := public.alin_current_role();
  v_allowed text[];
begin
  if public.alin_is_admin() then return new; end if;
  if v_role='library' then
    v_allowed:=array['status','updated_at','processing_at','ready_at','completed_at','delivered_at','cancelled_at','cancellation_reason','notes','library_note'];
  elsif v_role='courier' then
    v_allowed:=array['status','updated_at','out_for_delivery_at','delivered_at','delivery_note','proof_path','handoff_token'];
  else
    raise exception 'غير مسموح بتعديل الطلب';
  end if;
  if (to_jsonb(new) - v_allowed) <> (to_jsonb(old) - v_allowed) then
    raise exception 'تم منع تعديل بيانات حساسة في الطلب';
  end if;
  return new;
end
$$;
revoke all on function public.alin_protect_order_update() from public;
do $$ begin
  if to_regclass('public.orders') is not null then
    drop trigger if exists alin_orders_protect_update on public.orders;
    create trigger alin_orders_protect_update before update on public.orders
    for each row execute function public.alin_protect_order_update();
  end if;
end $$;

create or replace function public.alin_track_order(p_order_number text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code text := lower(btrim(coalesce(p_order_number,'')));
  v_row jsonb;
begin
  if length(v_code)<6 or length(v_code)>100 then return jsonb_build_object('found',false); end if;
  select to_jsonb(o) into v_row
  from public.orders o
  where lower(coalesce(to_jsonb(o)->>'order_number',to_jsonb(o)->>'tracking_code',to_jsonb(o)->>'id',''))=v_code
  limit 1;
  if v_row is null then return jsonb_build_object('found',false); end if;
  return jsonb_build_object(
    'found',true,
    'order_number',coalesce(v_row->>'order_number',v_row->>'tracking_code',v_row->>'id'),
    'title',coalesce(v_row->>'title','طلب منصة آلين'),
    'status',coalesce(v_row->>'status','new'),
    'ready_eta',v_row->>'ready_eta',
    'updated_at',coalesce(v_row->>'updated_at',v_row->>'created_at')
  );
end
$$;
revoke all on function public.alin_track_order(text) from public;
grant execute on function public.alin_track_order(text) to anon, authenticated;

-- طلبات المدرسين وأذونات الطباعة.
do $$
declare
  t text;
  p record;
  rowref text;
begin
  foreach t in array array['teacher_requests','permits'] loop
    if to_regclass('public.'||t) is null then continue; end if;
    execute format('alter table public.%I enable row level security',t);
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy if exists %I on public.%I',p.policyname,t);
    end loop;
    rowref:=format('to_jsonb(%I)',t);
    execute format('create policy alin_v204_%I_read on public.%I for select to authenticated using (public.alin_is_admin() or public.alin_row_owner_match(%s))',t,t,rowref);
    execute format('create policy alin_v204_%I_insert on public.%I for insert to authenticated with check (public.alin_is_admin() or public.alin_row_owner_match(%s))',t,t,rowref);
    execute format('create policy alin_v204_%I_update on public.%I for update to authenticated using (public.alin_is_admin() or public.alin_row_owner_match(%s)) with check (public.alin_is_admin() or public.alin_row_owner_match(%s))',t,t,rowref,rowref);
    execute format('create policy alin_v204_%I_delete on public.%I for delete to authenticated using (public.alin_is_admin())',t,t);
    execute format('revoke all on public.%I from anon',t);
    execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  end loop;
end $$;

-- السجلات المالية والتسويات.
do $$
declare
  t text;
  p record;
  rowref text;
  self_insert boolean;
  operational_insert boolean;
begin
  foreach t in array array[
    'ledger','financial_entries','financial_payouts','financial_returns','withdrawals',
    'library_settlements','teacher_settlements','delegate_settlements','courier_settlements','admin_settlements'
  ] loop
    if to_regclass('public.'||t) is null then continue; end if;
    execute format('alter table public.%I enable row level security',t);
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy if exists %I on public.%I',p.policyname,t);
    end loop;
    rowref:=format('to_jsonb(%I)',t);
    execute format('create policy alin_v204_%I_read on public.%I for select to authenticated using (public.alin_is_finance_staff() or public.alin_row_owner_match(%s))',t,t,rowref);
    self_insert := t in ('withdrawals','library_settlements','teacher_settlements','delegate_settlements','courier_settlements');
    operational_insert := t in ('ledger','financial_entries');
    if self_insert then
      execute format('create policy alin_v204_%I_insert on public.%I for insert to authenticated with check (public.alin_is_finance_staff() or (public.alin_row_owner_match(%s) and lower(coalesce(%I.status::text,''pending''))=''pending''))',t,t,rowref,t);
    elsif operational_insert then
      execute format('create policy alin_v204_%I_insert on public.%I for insert to authenticated with check (public.alin_is_finance_staff() or (public.alin_current_role() in (''library'',''courier'') and public.alin_row_owner_match(%s)))',t,t,rowref);
    else
      execute format('create policy alin_v204_%I_insert on public.%I for insert to authenticated with check (public.alin_is_finance_staff())',t,t);
    end if;
    execute format('create policy alin_v204_%I_update on public.%I for update to authenticated using (public.alin_is_finance_staff()) with check (public.alin_is_finance_staff())',t,t);
    execute format('create policy alin_v204_%I_delete on public.%I for delete to authenticated using (public.alin_is_admin())',t,t);
    execute format('revoke all on public.%I from anon',t);
    execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  end loop;
end $$;

-- سجل التدقيق والنسخ الاحتياطية.
do $$
declare t text; p record;
begin
  foreach t in array array['audit','audit_logs','backup_logs','system_health_logs'] loop
    if to_regclass('public.'||t) is null then continue; end if;
    execute format('alter table public.%I enable row level security',t);
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy if exists %I on public.%I',p.policyname,t);
    end loop;
    execute format('create policy alin_v204_%I_read on public.%I for select to authenticated using (public.alin_is_finance_staff())',t,t);
    if t in ('audit','audit_logs') then
      execute format('create policy alin_v204_%I_insert on public.%I for insert to authenticated with check (public.alin_current_account_id() is not null)',t,t);
    else
      execute format('create policy alin_v204_%I_insert on public.%I for insert to authenticated with check (public.alin_is_admin())',t,t);
    end if;
    execute format('create policy alin_v204_%I_update on public.%I for update to authenticated using (public.alin_is_admin()) with check (public.alin_is_admin())',t,t);
    execute format('create policy alin_v204_%I_delete on public.%I for delete to authenticated using (public.alin_is_admin())',t,t);
    execute format('revoke all on public.%I from anon',t);
    execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  end loop;
end $$;

-- التخزين.
do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname='storage' and tablename='objects' and lower(policyname) like 'alin%' loop
    execute format('drop policy if exists %I on storage.objects',p.policyname);
  end loop;
end $$;
create policy alin_files_public_read on storage.objects for select to anon,authenticated
using (bucket_id='alin-files');
create policy alin_files_admin_insert on storage.objects for insert to authenticated
with check (bucket_id='alin-files' and public.alin_is_admin());
create policy alin_files_admin_update on storage.objects for update to authenticated
using (bucket_id='alin-files' and public.alin_is_admin())
with check (bucket_id='alin-files' and public.alin_is_admin());
create policy alin_files_admin_delete on storage.objects for delete to authenticated
using (bucket_id='alin-files' and public.alin_is_admin());
create policy alin_files_teacher_insert on storage.objects for insert to authenticated
with check (
  bucket_id='alin-files' and public.alin_current_role()='teacher' and
  (storage.foldername(name))[1]='teachers' and
  lower(split_part(name,'.',array_length(string_to_array(name,'.'),1))) in ('jpg','jpeg','png','webp')
);



notify pgrst, 'reload schema';
commit;

-- ============================================================
-- v2.1.0: إصلاح نهائي لربط accounts مع Supabase Auth
-- السبب: مشغل حماية الحساب كان يعيد auth_user_id إلى قيمته القديمة
-- عند التحديث من SQL Editor أو Service Role.
-- ============================================================
begin;

create or replace function public.alin_protect_account_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jwt_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
begin
  -- يسمح للمدير الحقيقي، SQL Editor، وعمليات الخادم الموثوقة.
  if public.alin_is_admin()
     or current_user in ('postgres','supabase_admin','service_role')
     or v_jwt_role = 'service_role' then
    return new;
  end if;

  new.id := old.id;
  new.role := old.role;
  new.username := old.username;
  new.auth_user_id := old.auth_user_id;
  new.status := old.status;
  new.password_hash := old.password_hash;
  return new;
end
$$;

create or replace function public.alin_repair_auth_links(p_account_id text default null)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  r record;
  v_auth_user_id uuid;
  v_repaired integer := 0;
  v_jwt_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
begin
  if not (
    public.alin_is_admin()
    or current_user in ('postgres','supabase_admin','service_role')
    or v_jwt_role = 'service_role'
  ) then
    raise exception 'هذه العملية مسموحة للمدير فقط';
  end if;

  for r in
    select a.id::text as id, a.username::text as username, a.role::text as role
    from public.accounts a
    where a.auth_user_id is null
      and (p_account_id is null or a.id::text = p_account_id)
  loop
    v_auth_user_id := null;

    select u.id
      into v_auth_user_id
    from auth.users u
    where (
      regexp_replace(lower(trim(coalesce(u.raw_user_meta_data->>'username',''))), '\s+', '-', 'g')
        = regexp_replace(lower(trim(coalesce(r.username,''))), '\s+', '-', 'g')
      or (
        position('@' in coalesce(r.username,'')) > 0
        and lower(trim(coalesce(u.email,''))) = lower(trim(r.username))
      )
    )
      and (
        coalesce(trim(u.raw_user_meta_data->>'role'),'') = ''
        or lower(trim(u.raw_user_meta_data->>'role')) = lower(trim(coalesce(r.role,'')))
      )
      and not exists (
        select 1 from public.accounts linked
        where linked.auth_user_id = u.id and linked.id::text <> r.id
      )
    order by
      case when regexp_replace(lower(trim(coalesce(u.raw_user_meta_data->>'username',''))), '\s+', '-', 'g')
              = regexp_replace(lower(trim(coalesce(r.username,''))), '\s+', '-', 'g') then 0 else 1 end,
      u.created_at desc
    limit 1;

    if v_auth_user_id is not null then
      update public.accounts
      set auth_user_id = v_auth_user_id,
          updated_at = now()
      where id::text = r.id and auth_user_id is null;
      if found then v_repaired := v_repaired + 1; end if;
    end if;
  end loop;

  return v_repaired;
end
$$;

revoke all on function public.alin_repair_auth_links(text) from public;
grant execute on function public.alin_repair_auth_links(text) to authenticated;

do $$
declare
  v_repaired integer;
begin
  v_repaired := public.alin_repair_auth_links(null);
  raise notice 'ALIN v2.1.1 repaired auth links: %', v_repaired;
end
$$;

notify pgrst, 'reload schema';
commit;

-- ============================================================
-- v2.1.3: مناطق عمل المندوبين المتعددة
-- ============================================================
begin;

do $$
declare
  v_udt text;
begin
  if to_regclass('public.couriers') is null then
    raise exception 'جدول public.couriers غير موجود';
  end if;

  select udt_name into v_udt
  from information_schema.columns
  where table_schema='public' and table_name='couriers' and column_name='areas';

  if v_udt is null then
    alter table public.couriers add column areas text[] not null default '{}'::text[];
    v_udt := '_text';
  end if;

  if v_udt = '_text' then
    update public.couriers
       set areas = array[trim(area)]
     where coalesce(cardinality(areas),0)=0
       and nullif(trim(coalesce(area,'')),'') is not null;
  elsif v_udt = 'jsonb' then
    execute $q$
      update public.couriers
         set areas = to_jsonb(array[trim(area)])
       where (areas is null or areas='[]'::jsonb or areas='{}'::jsonb)
         and nullif(trim(coalesce(area,'')),'') is not null
    $q$;
  elsif v_udt in ('text','varchar') then
    execute $q$
      update public.couriers
         set areas = area
       where nullif(trim(coalesce(areas::text,'')),'') is null
         and nullif(trim(coalesce(area,'')),'') is not null
    $q$;
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
  v_jwt_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
begin
  -- SQL Editor وEdge Functions والـService Role تحتاج تعديل مناطق المندوب كاملة.
  if public.alin_is_admin()
     or current_user in ('postgres','supabase_admin','service_role')
     or v_jwt_role='service_role' then
    return new;
  end if;

  if public.alin_current_role() <> 'courier' or old.id::text <> public.alin_current_account_id() then
    raise exception 'غير مسموح بتعديل بيانات هذا المندوب';
  end if;

  -- المندوب يغيّر حالة توفره فقط، ولا يغيّر مناطقه بنفسه.
  if incoming ? 'availability' then allowed := allowed || jsonb_build_object('availability', incoming->'availability'); end if;
  if incoming ? 'work_status' then allowed := allowed || jsonb_build_object('work_status', incoming->'work_status'); end if;
  if incoming ? 'updated_at' then allowed := allowed || jsonb_build_object('updated_at', incoming->'updated_at'); end if;
  return jsonb_populate_record(old, allowed);
end
$$;
revoke all on function public.alin_protect_courier_self_update() from public;

-- توحيد المنطقة الرئيسية في accounts مع أول منطقة للمندوب.
do $$
declare
  v_udt text;
begin
  select udt_name into v_udt
  from information_schema.columns
  where table_schema='public' and table_name='couriers' and column_name='areas';

  if v_udt='_text' then
    update public.accounts a
       set area=c.areas[1]
      from public.couriers c
     where a.id::text=c.id::text and a.role='courier'
       and coalesce(cardinality(c.areas),0)>0
       and coalesce(a.area,'') is distinct from coalesce(c.areas[1],'');
  elsif v_udt='jsonb' then
    execute $q$
      update public.accounts a
         set area=c.areas->>0
        from public.couriers c
       where a.id::text=c.id::text and a.role='courier'
         and jsonb_typeof(c.areas)='array'
         and jsonb_array_length(c.areas)>0
         and coalesce(a.area,'') is distinct from coalesce(c.areas->>0,'')
    $q$;
  end if;
end $$;


-- v2.1.8: ترقية آمنة لجدول الطلبات.
-- نوقف تريغر الحماية داخل معاملة الترقية فقط حتى لا يمنع تحديث البيانات القديمة.
-- عند نجاح الترقية يُعاد إنشاء التريغر في نهاية الملف، وعند فشلها يتراجع PostgreSQL تلقائيًا.
do $$
begin
  if to_regclass('public.orders') is not null then
    drop trigger if exists alin_orders_protect_update on public.orders;
  end if;
end $$;

-- v2.1.8: مسار طلبات المندوب الحقيقي.
-- يضيف حقول التعيين والاستلام ويعتمد حالات التوصيل التي يستخدمها التطبيق.
alter table public.orders add column if not exists assignment_status text not null default 'pending_admin';
alter table public.orders add column if not exists assigned_at timestamptz;
alter table public.orders add column if not exists accepted_at timestamptz;
alter table public.orders add column if not exists picked_up_at timestamptz;
alter table public.orders add column if not exists out_for_delivery_at timestamptz;
alter table public.orders add column if not exists completed_at timestamptz;
alter table public.orders add column if not exists delivered_at timestamptz;
alter table public.orders add column if not exists rejected_at timestamptz;
alter table public.orders add column if not exists cancelled_at timestamptz;
alter table public.orders add column if not exists delivery_note text;

-- إزالة القيد القديم الذي كان يرفض assigned / accepted / picked_up / out_for_delivery.
alter table public.orders drop constraint if exists orders_status_valid;
alter table public.orders add constraint orders_status_valid check (
  status is null or status in (
    'pending','new','pending_admin','assigned','accepted','picked_up',
    'out_for_delivery','out_delivery','processing','ready',
    'completed','delivered','cancelled','rejected',
    'payment_pending','paid','receipt_rejected','تم التسليم'
  )
) not valid;

alter table public.orders drop constraint if exists orders_assignment_status_valid;
alter table public.orders add constraint orders_assignment_status_valid check (
  assignment_status in ('pending_admin','assigned','accepted','completed','rejected','cancelled')
) not valid;

-- توحيد حالة التعيين للطلبات الموجودة بدون تغيير حالة الطلب الأصلية.
update public.orders
   set assignment_status = case
     when status in ('completed','delivered','تم التسليم') then 'completed'
     when status='rejected' then 'rejected'
     when status='cancelled' then 'cancelled'
     when status in ('accepted','picked_up','out_for_delivery','out_delivery','processing') then 'accepted'
     when coalesce(courier_id::text,'')<>'' or coalesce(delegate_id::text,'')<>'' then 'assigned'
     else 'pending_admin'
   end
 where assignment_status is null
    or assignment_status not in ('pending_admin','assigned','accepted','completed','rejected','cancelled');

update public.orders
   set assigned_at=coalesce(assigned_at,updated_at,created_at,now())
 where assigned_at is null
   and (coalesce(courier_id::text,'')<>'' or coalesce(delegate_id::text,'')<>'');

create index if not exists orders_courier_status_idx on public.orders(courier_id,status);
create index if not exists orders_delegate_status_idx on public.orders(delegate_id,status);
create index if not exists orders_assignment_status_idx on public.orders(assignment_status);

-- المندوب يحدّث فقط حقول مسار التوصيل، والمدير يبقى كامل الصلاحية.
create or replace function public.alin_protect_order_update()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_role text := public.alin_current_role();
  v_allowed text[];
begin
  if public.alin_is_admin() then return new; end if;
  if v_role='library' then
    v_allowed:=array['status','updated_at','processing_at','ready_at','completed_at','delivered_at','cancelled_at','cancellation_reason','notes','library_note'];
  elsif v_role='courier' then
    v_allowed:=array[
      'status','assignment_status','updated_at','accepted_at','picked_up_at',
      'out_for_delivery_at','completed_at','delivered_at','rejected_at','cancelled_at',
      'delivery_note','proof_path','handoff_token'
    ];
  else
    raise exception 'غير مسموح بتعديل الطلب';
  end if;
  if (to_jsonb(new) - v_allowed) <> (to_jsonb(old) - v_allowed) then
    raise exception 'تم منع تعديل بيانات حساسة في الطلب';
  end if;
  if v_role='courier' and old.status is distinct from new.status then
    if not (
      (coalesce(old.status,'new') in ('pending','new','pending_admin','assigned') and new.status in ('accepted','rejected'))
      or (old.status='accepted' and new.status in ('picked_up','rejected'))
      or (old.status='picked_up' and new.status in ('out_for_delivery','rejected'))
      or (old.status in ('out_for_delivery','out_delivery','processing') and new.status in ('completed','delivered'))
    ) then
      raise exception 'انتقال حالة الطلب غير مسموح للمندوب: % إلى %',old.status,new.status;
    end if;
  end if;
  return new;
end
$$;
revoke all on function public.alin_protect_order_update() from public;

do $$ begin
  if to_regclass('public.orders') is not null then
    drop trigger if exists alin_orders_protect_update on public.orders;
    create trigger alin_orders_protect_update before update on public.orders
    for each row execute function public.alin_protect_order_update();
  end if;
end $$;

notify pgrst, 'reload schema';
commit;

-- ============================================================
-- v2.4.2 Stage 1 — private PDF/DOCX hardening
-- This block mirrors STAGE1_PRIVATE_DOCUMENTS_v2_4_2.sql for fresh installs.
-- ============================================================
-- ============================================================
-- ALIN v2.4.2 — المرحلة الأولى المعاد بناؤها بدقة
-- حماية PDF/DOCX وربط كل ملف بصاحبه أو بطلب المكتبة المخصص.
-- قابل لإعادة التشغيل بأمان بعد RUN_ON_SUPABASE_v2_1_8_COMPLETE.sql
-- ============================================================

begin;

-- 1) التخزين العام يبقى للصور فقط. منع أي PDF/DOCX جديد من الدخول إليه.
update storage.buckets
set public=true,
    file_size_limit=5242880,
    allowed_mime_types=array[
      'image/jpeg','image/png','image/webp'
    ]
where id='alin-files';

-- المدرس يرفع صورته الشخصية في teachers/ فقط؛ لا يسمح له برفع مستندات إلى التخزين العام.
drop policy if exists alin_files_teacher_insert on storage.objects;
create policy alin_files_teacher_insert on storage.objects for insert to authenticated
with check (
  bucket_id='alin-files'
  and public.alin_current_role()='teacher'
  and (storage.foldername(name))[1]='teachers'
  and lower(split_part(name,'.',array_length(string_to_array(name,'.'),1))) in ('jpg','jpeg','png','webp')
);

-- 2) مستودع خاص للمستندات فقط، وغير قابل للعرض العام.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'alin-private','alin-private',false,26214400,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict(id) do update
set public=false,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

-- المسارات الجديدة الإلزامية:
-- PDF  : booklets/<booklet_id>/<random>.pdf
-- DOCX : teacher-requests/<teacher_account_id>/<request_id>/<random>.docx

create or replace function public.alin_private_can_insert(p_name text)
returns boolean
language plpgsql stable security definer
set search_path=public,storage
as $$
declare
  v_parts text[]:=storage.foldername(p_name);
  v_role text:=public.alin_current_role();
  v_account text:=public.alin_current_account_id();
  v_ext text:=lower(split_part(p_name,'.',array_length(string_to_array(p_name,'.'),1)));
begin
  if public.alin_is_admin() then
    return (
      (v_parts[1]='booklets' and array_length(v_parts,1)=2 and v_ext='pdf')
      or
      (v_parts[1]='teacher-requests' and array_length(v_parts,1)=3 and v_ext='docx')
    );
  end if;

  if v_role='teacher' and v_account is not null then
    return v_parts[1]='teacher-requests'
       and array_length(v_parts,1)=3
       and v_parts[2]=v_account
       and length(coalesce(v_parts[3],''))>0
       and v_ext='docx';
  end if;

  return false;
end
$$;

create or replace function public.alin_library_has_booklet_order(p_booklet_id text)
returns boolean
language sql stable security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.orders o
    cross join lateral (select to_jsonb(o) as j) x
    where public.alin_current_role()='library'
      and public.alin_current_account_id() is not null
      and coalesce(x.j->>'item_id',x.j->>'booklet_id',x.j->'item'->>'id','')=p_booklet_id
      and public.alin_current_account_id() in (
        coalesce(x.j->>'library_id',''),
        coalesce(x.j->>'pickup_library_id',''),
        coalesce(x.j->>'assigned_library_id','')
      )
      and lower(coalesce(x.j->>'kind',x.j->>'item_kind',x.j->>'item_type','booklet'))
          in ('booklet','booklets','booklet_product','ملزمة','ملازم')
      and lower(coalesce(x.j->>'status',x.j->>'order_status','new'))
          in ('new','pending','pending_admin','assigned','accepted','processing','printing','ready','جديد','قيد الطباعة','جاهز')
  )
$$;

create or replace function public.alin_private_can_select(p_name text)
returns boolean
language plpgsql stable security definer
set search_path=public,storage
as $$
declare
  v_parts text[]:=storage.foldername(p_name);
  v_role text:=public.alin_current_role();
  v_account text:=public.alin_current_account_id();
  v_root text:=coalesce(v_parts[1],'');
  v_entity text:='';
begin
  if public.alin_is_admin() then return true; end if;
  if v_account is null then return false; end if;

  if v_root='teacher-requests' then
    if array_length(v_parts,1)<>3 then return false; end if;
    if v_role<>'teacher' or v_parts[2]<>v_account then return false; end if;
    v_entity:=v_parts[3];
    return exists(
      select 1 from public.teacher_requests r
      where r.id::text=v_entity and r.teacher_id::text=v_account
    );
  end if;

  if v_root='booklets' then
    if array_length(v_parts,1)<>2 then return false; end if;
    v_entity:=v_parts[2];
    if v_role='teacher' then
      return exists(
        select 1 from public.booklets b
        where b.id::text=v_entity and b.teacher_id::text=v_account
      );
    end if;
    if v_role='library' then
      return public.alin_library_has_booklet_order(v_entity);
    end if;
  end if;

  return false;
end
$$;

revoke all on function public.alin_private_can_insert(text) from public;
revoke all on function public.alin_private_can_select(text) from public;
revoke all on function public.alin_library_has_booklet_order(text) from public;
grant execute on function public.alin_private_can_insert(text) to authenticated;
grant execute on function public.alin_private_can_select(text) to authenticated;
grant execute on function public.alin_library_has_booklet_order(text) to authenticated;

-- إزالة كل سياسات المرحلة الأولى السابقة قبل إنشاء السياسات الدقيقة.
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname like 'alin_private_%'
  loop
    execute format('drop policy if exists %I on storage.objects',p.policyname);
  end loop;
end
$$;

-- لا توجد أي سياسة للزائر anon على alin-private.
create policy alin_private_select_exact
on storage.objects for select to authenticated
using (
  bucket_id='alin-private'
  and public.alin_private_can_select(name)
);

create policy alin_private_insert_exact
on storage.objects for insert to authenticated
with check (
  bucket_id='alin-private'
  and public.alin_private_can_insert(name)
);

-- تعديل أو حذف المستندات من التخزين محصور بالإدارة.
create policy alin_private_update_admin
on storage.objects for update to authenticated
using (bucket_id='alin-private' and public.alin_is_admin())
with check (bucket_id='alin-private' and public.alin_is_admin());

create policy alin_private_delete_admin
on storage.objects for delete to authenticated
using (bucket_id='alin-private' and public.alin_is_admin());

notify pgrst,'reload schema';
commit;

-- ============================================================
-- فحص بعد التنفيذ: يجب أن يرجع صفاً واحداً بقيمة true في كل عمود.
-- ============================================================
select
  exists(select 1 from storage.buckets where id='alin-private' and public=false) as private_bucket_ok,
  exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='alin_private_select_exact') as select_policy_ok,
  exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='alin_private_insert_exact') as insert_policy_ok,
  not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and roles::text like '%anon%' and qual like '%alin-private%') as no_anon_policy_ok;

-- تدقيق فقط، لا يحذف شيئاً: هذه ملفات قديمة بقيت عامة ويجب إعادة رفعها ثم حذفها يدوياً.
select name,metadata->>'mimetype' as mime_type,created_at
from storage.objects
where bucket_id='alin-files'
  and (
    name like 'booklets/%'
    or name like 'teacher-requests/%'
    or lower(split_part(name,'.',array_length(string_to_array(name,'.'),1))) in ('pdf','docx')
  )
order by created_at desc;
