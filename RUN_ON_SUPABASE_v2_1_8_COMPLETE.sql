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
    v_allowed:=array['status','status_history','updated_at','processing_at','ready_at','completed_at','delivered_at','cancelled_at','cancellation_reason','cancel_reason','payment_status','notes','library_note'];
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
alter table public.orders add column if not exists updated_at timestamptz not null default now();
alter table public.orders add column if not exists status_history jsonb not null default '[]'::jsonb;
alter table public.orders add column if not exists payment_status text not null default 'cod_pending';
alter table public.orders add column if not exists notes text;
alter table public.orders add column if not exists library_note text;
alter table public.orders add column if not exists processing_at timestamptz;
alter table public.orders add column if not exists ready_at timestamptz;
alter table public.orders add column if not exists cancellation_reason text;
alter table public.orders add column if not exists cancel_reason text;
alter table public.orders add column if not exists proof_path text;
alter table public.orders add column if not exists handoff_token text;
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
    v_allowed:=array['status','status_history','updated_at','processing_at','ready_at','completed_at','delivered_at','cancelled_at','cancellation_reason','cancel_reason','payment_status','notes','library_note'];
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

-- ============================================================
-- v2.4.2 R6: حسابات المكتبة الذرية وحالة فتح/إغلاق المكتبة
-- ============================================================
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


-- ============================================================
-- v2.4.2 R7: Order status_history insert guard
-- ============================================================
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
-- ALIN v2.5.0 Stage 2 — حماية صلاحيات المدرس على الملازم
begin;

create or replace function public.alin_guard_teacher_booklet_changes()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text:=coalesce(public.alin_current_role(),'');
  v_account text:=coalesce(public.alin_current_account_id(),'');
  v_old jsonb;
  v_new jsonb;
  v_key text;
  v_protected text[]:=array[
    'teacher_id','price','sale_price','deal_price','discount_percent','stock','is_hidden',
    'status','publish_status','published_at','approved_by','approved_at','reviewed_by','reviewed_at',
    'teacher_share_percent','library_share_percent','platform_share_percent','admin_note',
    'rejected_reason','rejection_reason','deleted_at','created_at','id'
  ];
begin
  if public.alin_is_admin() then return new; end if;
  if v_role<>'teacher' then
    raise exception 'ليس لديك صلاحية تعديل الملازم';
  end if;

  if tg_op='INSERT' then
    if coalesce(to_jsonb(new)->>'teacher_id','')<>v_account then
      raise exception 'لا يمكنك إنشاء ملزمة لحساب مدرس آخر';
    end if;
    v_new:=to_jsonb(new);
    if coalesce(v_new->>'status','draft') not in ('draft','pending','new','review')
       or coalesce(v_new->>'publish_status','pending') not in ('','pending','new','review')
       or coalesce((v_new->>'is_hidden')::boolean,true)=false
       or nullif(v_new->>'published_at','') is not null
       or nullif(v_new->>'approved_by','') is not null
       or nullif(v_new->>'approved_at','') is not null then
      raise exception 'حالة النشر والسعر والموافقة من صلاحية الإدارة فقط';
    end if;
    return new;
  end if;

  if coalesce(to_jsonb(old)->>'teacher_id','')<>v_account then
    raise exception 'يمكنك تعديل ملازمك فقط';
  end if;

  v_old:=to_jsonb(old); v_new:=to_jsonb(new);
  foreach v_key in array v_protected loop
    if (v_old->v_key) is distinct from (v_new->v_key) then
      raise exception 'الحقل % من صلاحية الإدارة فقط',v_key;
    end if;
  end loop;
  return new;
end;
$$;

revoke all on function public.alin_guard_teacher_booklet_changes() from public;

drop trigger if exists alin_guard_teacher_booklet_changes on public.booklets;
create trigger alin_guard_teacher_booklet_changes
before insert or update on public.booklets
for each row execute function public.alin_guard_teacher_booklet_changes();

-- موافقة المدرس على النسخة: لا تنشر ولا تغيّر السعر أو الحالة.
create or replace function public.alin_teacher_approve_booklet(p_booklet_id text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id text:=coalesce(public.alin_current_account_id(),'');
  v_role text:=coalesce(public.alin_current_role(),'');
  v_row public.booklets%rowtype;
begin
  if v_role<>'teacher' or v_id='' then raise exception 'يجب تسجيل الدخول بحساب مدرس'; end if;
  select * into v_row from public.booklets where id::text=p_booklet_id for update;
  if not found then raise exception 'الملزمة غير موجودة'; end if;
  if v_row.teacher_id::text<>v_id then raise exception 'يمكنك الموافقة على ملازمك فقط'; end if;
  if coalesce(v_row.status,'') in ('published','active') then raise exception 'الملزمة منشورة بالفعل'; end if;

  -- تجاوز trigger مضبوط ومحدود داخل دالة الخادم فقط.
  update public.booklets
     set teacher_approved=true,
         teacher_approved_at=now(),
         updated_at=now()
   where id::text=p_booklet_id;

  return jsonb_build_object('ok',true,'id',p_booklet_id,'teacher_approved',true);
end;
$$;
revoke all on function public.alin_teacher_approve_booklet(text) from public, anon;
grant execute on function public.alin_teacher_approve_booklet(text) to authenticated;

-- trigger يسمح للدالة الموثوقة فقط بتغيير حقلي موافقة المدرس.
create or replace function public.alin_guard_teacher_booklet_changes()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  v_role text:=coalesce(public.alin_current_role(),'');
  v_account text:=coalesce(public.alin_current_account_id(),'');
  v_old jsonb; v_new jsonb; v_key text;
  v_protected text[]:=array['teacher_id','price','sale_price','deal_price','discount_percent','stock','is_hidden','status','publish_status','published_at','approved_by','approved_at','reviewed_by','reviewed_at','teacher_share_percent','library_share_percent','platform_share_percent','admin_note','rejected_reason','rejection_reason','deleted_at','created_at','id'];
begin
  if public.alin_is_admin() then return new; end if;
  if v_role<>'teacher' then raise exception 'ليس لديك صلاحية تعديل الملازم'; end if;
  if coalesce(to_jsonb(coalesce(old,new))->>'teacher_id','')<>v_account then raise exception 'يمكنك تعديل ملازمك فقط'; end if;
  if tg_op='INSERT' then
    v_new:=to_jsonb(new);
    if coalesce(v_new->>'status','draft') not in ('draft','pending','new','review') or coalesce(v_new->>'publish_status','pending') not in ('','pending','new','review') then
      raise exception 'حالة النشر من صلاحية الإدارة فقط';
    end if;
    return new;
  end if;
  v_old:=to_jsonb(old); v_new:=to_jsonb(new);
  foreach v_key in array v_protected loop
    if (v_old->v_key) is distinct from (v_new->v_key) then raise exception 'الحقل % من صلاحية الإدارة فقط',v_key; end if;
  end loop;
  return new;
end;
$$;

commit;
notify pgrst,'reload schema';

select
  to_regprocedure('public.alin_teacher_approve_booklet(text)') is not null as approval_rpc_exists,
  exists(select 1 from pg_trigger where tgname='alin_guard_teacher_booklet_changes' and not tgisinternal) as protection_trigger_exists,
  has_function_privilege('authenticated','public.alin_teacher_approve_booklet(text)','EXECUTE') as teacher_can_call_approval,
  not has_function_privilege('anon','public.alin_teacher_approve_booklet(text)','EXECUTE') as anon_cannot_call_approval;


-- ============================================================
-- v2.6.0 Stage 3: Secure checkout pricing and delivery
-- ============================================================
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
