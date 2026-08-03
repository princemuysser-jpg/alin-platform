-- منصة آلين v4.1.0 — Clean Project Master
-- مخصص حصراً لمشروع Supabase جديد وفارغ. لا يُستخدم فوق قاعدة قديمة.
-- يبني القاعدة من الصفر: الطلبات، المالية، الحسابات، الصلاحيات، التخزين، وحساب الطالب.

begin;
select pg_advisory_xact_lock(hashtext('alin-v4-clean-project-master'));

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- حماية صريحة: هذا الملف ليس Migration ولا Patch.
do $$
begin
  if to_regclass('public.orders') is not null
     or to_regclass('public.accounts') is not null
     or to_regclass('public.ledger') is not null then
    raise exception 'ALIN v4 Clean Master يعمل على مشروع جديد فارغ فقط. أوقف التنفيذ واستخدم مشروع Supabase جديد.';
  end if;
end $$;

-- =========================================================
-- 1) الجداول الأساسية
-- =========================================================

create table public.settings (
  id text primary key default ('S' || replace(extensions.gen_random_uuid()::text,'-','')),
  key text not null unique,
  value text,
  data jsonb not null default '{}'::jsonb,
  version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.accounts (
  id text primary key,
  auth_user_id uuid unique,
  role text not null check (role in ('admin','accountant','teacher','library','courier')),
  name text not null,
  username text not null unique,
  status text not null default 'active' check (status in ('active','inactive','pending','rejected')),
  admin_level text not null default 'operator' check (admin_level in ('super_admin','operator')),
  phone text,
  area text,
  landmark text,
  specialty text,
  bio text,
  avatar_path text,
  notes text,
  is_open boolean not null default true,
  open_status text not null default 'open' check (open_status in ('open','closed')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index accounts_auth_user_idx on public.accounts(auth_user_id);
create index accounts_role_status_idx on public.accounts(role,status);

create table public.account_permissions (
  account_id text not null references public.accounts(id) on delete cascade,
  permission text not null,
  granted boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (account_id,permission)
);

create table public.delivery_areas (
  id text primary key,
  name text not null unique,
  city text not null default 'كركوك',
  delivery_fee numeric(14,2) not null default 0 check (delivery_fee >= 0),
  landmark text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  status text not null default 'active' check (status in ('active','inactive')),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.couriers (
  id text primary key references public.accounts(id) on delete cascade,
  name text not null,
  username text not null,
  phone text,
  area text,
  areas text[] not null default '{}',
  availability text not null default 'available' check (availability in ('available','busy','offline')),
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.courier_areas (
  courier_id text not null references public.couriers(id) on delete cascade,
  area_id text not null references public.delivery_areas(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(courier_id,area_id)
);

create table public.categories (
  id text primary key,
  type text not null default 'product',
  name text not null,
  status text not null default 'active' check (status in ('active','inactive')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(type,name)
);

create table public.booklets (
  id text primary key,
  title text not null,
  teacher_id text not null references public.accounts(id) on delete restrict,
  subject text,
  grade text,
  term text,
  edition text,
  year text,
  price numeric(14,2) not null default 0 check (price >= 0),
  teacher_share_percent numeric(5,2) not null default 50 check (teacher_share_percent between 0 and 100),
  library_share_percent numeric(5,2) not null default 30 check (library_share_percent between 0 and 100),
  status text not null default 'draft' check (status in ('draft','review','pending','published','hidden','archived')),
  publish_status text not null default 'draft' check (publish_status in ('draft','review','pending','published','hidden','archived')),
  published boolean not null default false,
  is_published boolean not null default false,
  teacher_approved boolean not null default false,
  teacher_approved_at timestamptz,
  published_at timestamptz,
  cover_path text,
  file_path text,
  file_name text,
  admin_note text,
  description text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index booklets_teacher_idx on public.booklets(teacher_id);
create index booklets_status_idx on public.booklets(status,publish_status);

create table public.products (
  id text primary key,
  name text not null,
  title text,
  type text not null default 'product' check (type in ('product','stationery','gift','deal')),
  category text,
  category_id text references public.categories(id) on delete set null,
  price numeric(14,2) not null default 0 check (price >= 0),
  sale_price numeric(14,2),
  stock numeric(14,2) not null default 0 check (stock >= 0),
  low_stock_limit numeric(14,2) not null default 0 check (low_stock_limit >= 0),
  description text,
  details text,
  image_path text,
  images jsonb not null default '[]'::jsonb,
  status text not null default 'published' check (status in ('published','hidden','inactive','draft')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_status_idx on public.products(status,type);

create table public.banners (
  id text primary key,
  title text,
  subtitle text,
  image_path text,
  image_url text,
  link_url text,
  button_text text,
  placement text not null default 'store',
  active boolean not null default true,
  status text not null default 'active' check (status in ('active','inactive')),
  sort_order integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.coupons (
  id text primary key,
  code text not null unique,
  discount_type text not null default 'percent' check (discount_type in ('percent','fixed')),
  discount_value numeric(14,2) not null check (discount_value > 0),
  applies_to text not null default 'all',
  status text not null default 'active' check (status in ('active','inactive')),
  starts_at timestamptz,
  expires_at timestamptz,
  max_uses integer not null default 0 check (max_uses >= 0),
  used_count integer not null default 0 check (used_count >= 0),
  usage_count integer not null default 0 check (usage_count >= 0),
  min_order numeric(14,2) not null default 0,
  max_discount numeric(14,2) not null default 0,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teacher_requests (
  id text primary key,
  teacher_id text not null references public.accounts(id) on delete cascade,
  teacher_name text,
  title text not null,
  subject text,
  grade text,
  note text,
  admin_note text,
  source_file_path text,
  source_file_name text,
  source_file_type text,
  source_mime_type text,
  status text not null default 'new' check (status in ('new','under_review','changes_requested','resubmitted','approved','ready','published','rejected')),
  version_history jsonb not null default '[]'::jsonb,
  reviewed_at timestamptz,
  reviewed_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.teacher_request_versions (
  id text primary key default ('TRV' || replace(extensions.gen_random_uuid()::text,'-','')),
  request_id text not null references public.teacher_requests(id) on delete cascade,
  teacher_id text not null references public.accounts(id) on delete cascade,
  file_path text,
  file_name text,
  note text,
  status text,
  created_at timestamptz not null default now()
);

create table public.student_profiles (
  id text primary key default ('ST' || replace(extensions.gen_random_uuid()::text,'-','')),
  phone text not null unique,
  name text not null,
  grade text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.student_accounts (
  student_id text primary key references public.student_profiles(id) on delete cascade,
  pin_hash text not null,
  status text not null default 'active' check (status in ('active','inactive')),
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create table public.student_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  student_id text not null references public.student_profiles(id) on delete cascade,
  token_hash text not null unique,
  device_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index student_sessions_lookup_idx on public.student_sessions(token_hash,device_hash,expires_at);

create table public.auth_login_guard (
  identifier_hash text not null,
  device_hash text not null,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  last_failed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key(identifier_hash,device_hash)
);

create table public.checkout_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  request_key text not null unique,
  device_hash text not null,
  phone_hash text not null,
  payload_hash text not null,
  status text not null default 'pending' check (status in ('pending','completed')),
  result jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index checkout_phone_idx on public.checkout_requests(phone_hash,created_at desc);
create index checkout_device_idx on public.checkout_requests(device_hash,created_at desc);

create table public.orders (
  id text primary key,
  order_number text not null unique,
  kind text not null check (kind in ('booklet','product','stationery','gift')),
  item_id text not null,
  title text not null,
  student_id text references public.student_profiles(id) on delete set null,
  student_name text not null,
  student_phone text not null,
  qty integer not null check (qty between 1 and 50),
  unit_price numeric(14,2) not null check (unit_price >= 0),
  discount numeric(14,2) not null default 0 check (discount >= 0),
  total numeric(14,2) not null check (total >= 0),
  coupon_code text,
  status text not null default 'new' check (status in ('new','pending_admin','assigned','accepted','picked_up','out_for_delivery','processing','printing','ready','completed','cancelled','rejected')),
  assignment_status text not null default 'pending_admin' check (assignment_status in ('pending_admin','assigned','accepted','completed','rejected','cancelled')),
  status_history jsonb not null default '[]'::jsonb,
  payment_status text not null default 'cod_pending' check (payment_status in ('cod_pending','pending','paid','cancelled','refunded')),
  payment_method text not null default 'cash_at_library',
  fulfillment_type text not null check (fulfillment_type in ('pickup','home_delivery')),
  delivery_type text not null check (delivery_type in ('library','courier')),
  library_id text references public.accounts(id) on delete set null,
  pickup_library_id text references public.accounts(id) on delete set null,
  courier_id text references public.accounts(id) on delete set null,
  delegate_id text references public.accounts(id) on delete set null,
  delivery_area_id text references public.delivery_areas(id) on delete set null,
  delivery_area text,
  delivery_landmark text,
  delivery_fee numeric(14,2) not null default 0 check (delivery_fee >= 0),
  delivery_latitude numeric(10,7),
  delivery_longitude numeric(10,7),
  delivery_location_url text,
  delivery_location_accuracy integer,
  delivery_location_source text,
  notes text,
  library_note text,
  delivery_note text,
  proof_path text,
  handoff_token text,
  checkout_request_key text,
  checkout_group_id text,
  stock_reserved boolean not null default false,
  stock_restored_at timestamptz,
  assigned_at timestamptz,
  accepted_at timestamptz,
  picked_up_at timestamptz,
  out_for_delivery_at timestamptz,
  processing_at timestamptz,
  ready_at timestamptz,
  completed_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  rejected_at timestamptz,
  cancellation_reason text,
  settlement_done boolean not null default false,
  settlement_cancelled boolean not null default false,
  settlement_at timestamptz,
  settlement_party text,
  platform_profit numeric(14,2) not null default 0 check (platform_profit >= 0),
  teacher_profit numeric(14,2) not null default 0 check (teacher_profit >= 0),
  library_profit numeric(14,2) not null default 0 check (library_profit >= 0),
  delegate_profit numeric(14,2) not null default 0 check (delegate_profit >= 0),
  courier_profit numeric(14,2) not null default 0 check (courier_profit >= 0),
  cash_collected_by text,
  cash_collected_at timestamptz,
  library_cash_collected numeric(14,2) not null default 0,
  delegate_cash_collected numeric(14,2) not null default 0,
  finance_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_status_created_idx on public.orders(status,created_at desc);
create index orders_library_idx on public.orders(library_id,status);
create index orders_courier_idx on public.orders(courier_id,status);
create index orders_item_idx on public.orders(kind,item_id);
create index orders_phone_idx on public.orders(student_phone,created_at desc);

create table public.order_timeline (
  id text primary key default ('OT' || replace(extensions.gen_random_uuid()::text,'-','')),
  order_id text not null references public.orders(id) on delete cascade,
  status text not null,
  actor_id text,
  actor_role text,
  reason text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index order_timeline_order_idx on public.order_timeline(order_id,created_at);

create table public.permits (
  id text primary key,
  order_id text references public.orders(id) on delete cascade,
  library_id text references public.accounts(id) on delete cascade,
  booklet_id text references public.booklets(id) on delete cascade,
  allowed integer not null default 1,
  used integer not null default 0,
  status text not null default 'active' check (status in ('active','used','expired','cancelled')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ledger (
  id text primary key,
  order_id text not null unique references public.orders(id) on delete restrict,
  order_number text not null,
  title text,
  total numeric(14,2) not null default 0,
  merchandise_total numeric(14,2) not null default 0,
  delivery_fee numeric(14,2) not null default 0,
  alin numeric(14,2) not null default 0,
  admin numeric(14,2) not null default 0,
  teacher numeric(14,2) not null default 0,
  teacher_id text references public.accounts(id) on delete set null,
  library numeric(14,2) not null default 0,
  library_id text references public.accounts(id) on delete set null,
  delegate numeric(14,2) not null default 0,
  courier numeric(14,2) not null default 0,
  delegate_id text references public.accounts(id) on delete set null,
  courier_id text references public.accounts(id) on delete set null,
  collector_role text not null check (collector_role in ('library','delegate')),
  collector_id text not null,
  collector_debt numeric(14,2) not null default 0,
  delivery_type text not null,
  status text not null default 'pending' check (status in ('pending','settled','cancelled','reversed')),
  settlement_status text not null default 'pending' check (settlement_status in ('pending','settled','cancelled','reversed')),
  finance_version text not null default '4.0.0',
  is_current boolean not null default true,
  note text,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ledger_teacher_idx on public.ledger(teacher_id,status);
create index ledger_library_idx on public.ledger(library_id,status);
create index ledger_delegate_idx on public.ledger(delegate_id,status);

create table public.settlements (
  id text primary key,
  receipt_number text not null unique,
  party_role text not null check (party_role in ('admin','teacher','library','delegate')),
  party_id text,
  amount numeric(14,2) not null check (amount > 0),
  payment_method text not null default 'cash',
  status text not null default 'received' check (status in ('received','paid','reversed','cancelled')),
  note text,
  reversed_from text references public.settlements(id) on delete set null,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index settlements_party_idx on public.settlements(party_role,party_id,created_at desc);

create table public.withdrawals (
  id text primary key,
  role text not null check (role in ('teacher','library','delegate')),
  account_id text not null references public.accounts(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending','approved','paid','rejected','cancelled')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id text primary key,
  title text not null,
  message text not null,
  role text not null default 'all',
  account_id text,
  type text,
  link text,
  status text not null default 'active' check (status in ('active','inactive')),
  is_read boolean not null default false,
  read_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create table public.notification_reads (
  notification_id text not null references public.notifications(id) on delete cascade,
  account_id text not null references public.accounts(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key(notification_id,account_id)
);

create table public.audit_events (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_account_id text,
  actor_role text,
  action text not null,
  entity_type text,
  entity_id text,
  summary text,
  old_data jsonb,
  new_data jsonb,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_events_created_idx on public.audit_events(created_at desc);

create table public.product_reviews (
  id text primary key default ('RV' || replace(extensions.gen_random_uuid()::text,'-','')),
  kind text not null,
  item_id text not null,
  student_contact text,
  rating integer not null check (rating between 1 and 5),
  comment text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

create table public.stock_alerts (
  id text primary key default ('SA' || replace(extensions.gen_random_uuid()::text,'-','')),
  kind text not null,
  item_id text not null,
  contact text,
  status text not null default 'pending' check (status in ('pending','notified','cancelled')),
  created_at timestamptz not null default now()
);

create table public.group_orders (
  id text primary key default ('GO' || replace(extensions.gen_random_uuid()::text,'-','')),
  code text not null unique,
  status text not null default 'open' check (status in ('open','closed','cancelled')),
  owner_contact text,
  created_at timestamptz not null default now()
);

create table public.group_order_members (
  id text primary key default ('GM' || replace(extensions.gen_random_uuid()::text,'-','')),
  group_order_id text not null references public.group_orders(id) on delete cascade,
  contact text,
  name text,
  created_at timestamptz not null default now()
);

create table public.bundles (
  id text primary key,
  title text not null,
  description text,
  price numeric(14,2) not null default 0,
  status text not null default 'active',
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bundle_items (
  id text primary key,
  bundle_id text not null references public.bundles(id) on delete cascade,
  kind text not null,
  item_id text not null,
  qty integer not null default 1,
  created_at timestamptz not null default now()
);

create table public.backup_logs (
  id text primary key,
  status text not null,
  details jsonb not null default '{}'::jsonb,
  created_by text,
  created_at timestamptz not null default now()
);

create table public.system_health_logs (
  id text primary key,
  status text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- =========================================================
-- 2) دوال الهوية والصلاحيات والتحديث
-- =========================================================

create or replace function public.alin_current_account_id()
returns text language sql stable security definer set search_path=public as $$
  select a.id from public.accounts a
  where a.auth_user_id=auth.uid() and a.status='active' and a.deleted_at is null
  limit 1
$$;

create or replace function public.alin_current_role()
returns text language sql stable security definer set search_path=public as $$
  select a.role from public.accounts a
  where a.auth_user_id=auth.uid() and a.status='active' and a.deleted_at is null
  limit 1
$$;

create or replace function public.alin_is_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(public.alin_current_role()='admin',false)
$$;

create or replace function public.alin_is_finance_staff()
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce(public.alin_current_role() in ('admin','accountant'),false)
$$;

create or replace function public.alin_has_permission(p_permission text)
returns boolean language sql stable security definer set search_path=public as $$
  select public.alin_is_admin() and (
    exists(select 1 from public.accounts a where a.id=public.alin_current_account_id() and a.admin_level='super_admin')
    or exists(select 1 from public.account_permissions p where p.account_id=public.alin_current_account_id() and p.permission=lower(btrim(p_permission)) and p.granted)
  )
$$;

create or replace function public.alin_set_updated_at()
returns trigger language plpgsql set search_path=public as $$
begin new.updated_at=now(); return new; end $$;

create trigger settings_updated before update on public.settings for each row execute function public.alin_set_updated_at();
create trigger accounts_updated before update on public.accounts for each row execute function public.alin_set_updated_at();
create trigger delivery_areas_updated before update on public.delivery_areas for each row execute function public.alin_set_updated_at();
create trigger couriers_updated before update on public.couriers for each row execute function public.alin_set_updated_at();
create trigger categories_updated before update on public.categories for each row execute function public.alin_set_updated_at();
create trigger booklets_updated before update on public.booklets for each row execute function public.alin_set_updated_at();
create trigger products_updated before update on public.products for each row execute function public.alin_set_updated_at();
create trigger banners_updated before update on public.banners for each row execute function public.alin_set_updated_at();
create trigger coupons_updated before update on public.coupons for each row execute function public.alin_set_updated_at();
create trigger teacher_requests_updated before update on public.teacher_requests for each row execute function public.alin_set_updated_at();
create trigger orders_updated before update on public.orders for each row execute function public.alin_set_updated_at();
create trigger permits_updated before update on public.permits for each row execute function public.alin_set_updated_at();
create trigger ledger_updated before update on public.ledger for each row execute function public.alin_set_updated_at();
create trigger settlements_updated before update on public.settlements for each row execute function public.alin_set_updated_at();
create trigger withdrawals_updated before update on public.withdrawals for each row execute function public.alin_set_updated_at();

create or replace function public.alin_setting_numeric(p_key text,p_default numeric)
returns numeric language sql stable security definer set search_path=public as $$
  select coalesce((select nullif(value,'')::numeric from public.settings where key=p_key),p_default)
$$;

create or replace function public.alin_setting_boolean(p_key text,p_default boolean)
returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((select lower(coalesce(value,'')) in ('true','1','yes','on') from public.settings where key=p_key),p_default)
$$;

-- =========================================================
-- 3) العرض العام والـViews المتوافقة مع الواجهة
-- =========================================================

create view public.alin_public_accounts as
select id,role,name,area,landmark,phone,specialty,bio,avatar_path,is_open,open_status
from public.accounts
where status='active' and deleted_at is null and role in ('teacher','library');

create view public.alin_public_settings as
select id,key,value,data,version from public.settings
where key not like 'secret_%';

create view public.alin_public_booklets as
select id,title,teacher_id,subject,grade,term,edition,year,price,status,publish_status,published,is_published,
       cover_path,description,created_at,updated_at
from public.booklets
where status='published' and publish_status='published' and deleted_at is null;

create view public.alin_library_booklets as
select b.id,b.title,b.teacher_id,b.subject,b.grade,b.term,b.edition,b.year,b.price,b.status,b.publish_status,
       b.published,b.is_published,b.cover_path,b.description,b.created_at,b.updated_at,
       case when exists(
         select 1 from public.orders o
         where o.kind='booklet' and o.item_id=b.id
           and public.alin_current_account_id() in (o.library_id,o.pickup_library_id)
           and o.status in ('new','pending_admin','processing','printing','ready')
       ) then b.file_path else null end as file_path,
       case when exists(
         select 1 from public.orders o
         where o.kind='booklet' and o.item_id=b.id
           and public.alin_current_account_id() in (o.library_id,o.pickup_library_id)
           and o.status in ('new','pending_admin','processing','printing','ready')
       ) then b.file_name else null end as file_name
from public.booklets b
where b.status='published' and b.publish_status='published' and b.deleted_at is null
  and public.alin_current_role()='library';

create view public.order_items with (security_invoker=true) as
select id,id as order_id,order_number,kind,item_id,title,qty,unit_price,discount,total,created_at
from public.orders;

create view public.financial_entries with (security_invoker=true) as
select * from public.ledger;

create view public.library_settlements with (security_invoker=true) as
select id,receipt_number,party_id as library_id,amount,payment_method,status,note,created_at,updated_at
from public.settlements where party_role='library';

create view public.teacher_settlements with (security_invoker=true) as
select id,receipt_number,party_id as teacher_id,amount,payment_method,status,note,created_at,updated_at
from public.settlements where party_role='teacher';

create view public.delegate_settlements with (security_invoker=true) as
select id,receipt_number,party_id as delegate_id,party_id as courier_id,amount,payment_method,status,note,created_at,updated_at
from public.settlements where party_role='delegate';

create view public.admin_settlements with (security_invoker=true) as
select id,receipt_number,party_id as admin_id,amount,payment_method,status,note,created_at,updated_at
from public.settlements where party_role='admin';

create view public.financial_payouts with (security_invoker=true) as
select id,receipt_number as voucher_number,party_role,party_id,amount,payment_method,status,note,created_at,updated_at
from public.settlements where party_role in ('admin','teacher');

create view public.alin_teacher_orders as
select o.id,o.order_number,o.kind,o.item_id,o.title,o.qty,o.unit_price,o.discount,o.total,o.status,
       o.teacher_profit,o.created_at,o.updated_at,b.teacher_id
from public.orders o
join public.booklets b on o.kind='booklet' and b.id=o.item_id
where b.teacher_id=public.alin_current_account_id();

-- =========================================================
-- 4) RLS وسياسات الوصول
-- =========================================================

alter table public.settings enable row level security;
alter table public.accounts enable row level security;
alter table public.account_permissions enable row level security;
alter table public.delivery_areas enable row level security;
alter table public.couriers enable row level security;
alter table public.courier_areas enable row level security;
alter table public.categories enable row level security;
alter table public.booklets enable row level security;
alter table public.products enable row level security;
alter table public.banners enable row level security;
alter table public.coupons enable row level security;
alter table public.teacher_requests enable row level security;
alter table public.teacher_request_versions enable row level security;
alter table public.student_profiles enable row level security;
alter table public.student_accounts enable row level security;
alter table public.student_sessions enable row level security;
alter table public.auth_login_guard enable row level security;
alter table public.checkout_requests enable row level security;
alter table public.orders enable row level security;
alter table public.order_timeline enable row level security;
alter table public.permits enable row level security;
alter table public.ledger enable row level security;
alter table public.settlements enable row level security;
alter table public.withdrawals enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_reads enable row level security;
alter table public.audit_events enable row level security;
alter table public.product_reviews enable row level security;
alter table public.stock_alerts enable row level security;
alter table public.group_orders enable row level security;
alter table public.group_order_members enable row level security;
alter table public.bundles enable row level security;
alter table public.bundle_items enable row level security;
alter table public.backup_logs enable row level security;
alter table public.system_health_logs enable row level security;

create policy settings_read on public.settings for select to authenticated using (true);
create policy settings_admin_write on public.settings for all to authenticated using (public.alin_is_admin()) with check (public.alin_is_admin());

create policy accounts_own_read on public.accounts for select to authenticated using (id=public.alin_current_account_id() or public.alin_is_admin());
create policy accounts_admin_write on public.accounts for all to authenticated using (public.alin_is_admin()) with check (public.alin_is_admin());
create policy accounts_teacher_profile_update on public.accounts for update to authenticated
using (id=public.alin_current_account_id() and role='teacher')
with check (id=public.alin_current_account_id() and role='teacher');

create policy permissions_admin on public.account_permissions for all to authenticated using (public.alin_is_admin()) with check (public.alin_is_admin());
create policy permissions_own_read on public.account_permissions for select to authenticated using (account_id=public.alin_current_account_id());

create policy delivery_areas_public_read on public.delivery_areas for select to anon,authenticated using (status='active' and active);
create policy delivery_areas_admin_write on public.delivery_areas for all to authenticated using (public.alin_is_admin()) with check (public.alin_is_admin());

create policy couriers_read on public.couriers for select to authenticated using (public.alin_is_admin() or id=public.alin_current_account_id());
create policy couriers_admin_write on public.couriers for all to authenticated using (public.alin_is_admin()) with check (public.alin_is_admin());
create policy couriers_self_update on public.couriers for update to authenticated using (id=public.alin_current_account_id()) with check (id=public.alin_current_account_id());
create policy courier_areas_read on public.courier_areas for select to authenticated using (public.alin_is_admin() or courier_id=public.alin_current_account_id());
create policy courier_areas_admin_write on public.courier_areas for all to authenticated using (public.alin_is_admin()) with check (public.alin_is_admin());

create policy categories_public_read on public.categories for select to anon,authenticated using (status='active' or public.alin_is_admin());
create policy categories_admin_write on public.categories for all to authenticated using (public.alin_is_admin()) with check (public.alin_is_admin());

create policy booklets_private_read on public.booklets for select to authenticated using (
  public.alin_is_admin() or teacher_id=public.alin_current_account_id()
);
create policy booklets_admin_write on public.booklets for all to authenticated using (public.alin_is_admin()) with check (public.alin_is_admin());

create policy products_public_read on public.products for select to anon,authenticated using ((status='published' and deleted_at is null) or public.alin_is_admin());
create policy products_admin_write on public.products for all to authenticated using (public.alin_is_admin()) with check (public.alin_is_admin());

create policy banners_public_read on public.banners for select to anon,authenticated using ((active and status='active') or public.alin_is_admin());
create policy banners_admin_write on public.banners for all to authenticated using (public.alin_is_admin()) with check (public.alin_is_admin());

create policy coupons_public_read on public.coupons for select to anon,authenticated using (status='active' or public.alin_is_admin());
create policy coupons_admin_write on public.coupons for all to authenticated using (public.alin_is_admin()) with check (public.alin_is_admin());

create policy teacher_requests_read on public.teacher_requests for select to authenticated using (public.alin_is_admin() or teacher_id=public.alin_current_account_id());
create policy teacher_requests_teacher_insert on public.teacher_requests for insert to authenticated with check (teacher_id=public.alin_current_account_id() and public.alin_current_role()='teacher');
create policy teacher_requests_teacher_update on public.teacher_requests for update to authenticated using (teacher_id=public.alin_current_account_id()) with check (teacher_id=public.alin_current_account_id());
create policy teacher_requests_admin_update on public.teacher_requests for update to authenticated using (public.alin_is_admin()) with check (public.alin_is_admin());
create policy teacher_versions_read on public.teacher_request_versions for select to authenticated using (public.alin_is_admin() or teacher_id=public.alin_current_account_id());
create policy teacher_versions_write on public.teacher_request_versions for insert to authenticated with check (public.alin_is_admin() or teacher_id=public.alin_current_account_id());

create policy orders_read on public.orders for select to authenticated using (
  public.alin_is_admin()
  or public.alin_current_role()='accountant'
  or library_id=public.alin_current_account_id()
  or pickup_library_id=public.alin_current_account_id()
  or courier_id=public.alin_current_account_id()
  or delegate_id=public.alin_current_account_id()
);
create policy orders_admin_update on public.orders for update to authenticated using (public.alin_is_admin()) with check (public.alin_is_admin());
create policy orders_party_update on public.orders for update to authenticated using (
  library_id=public.alin_current_account_id() or pickup_library_id=public.alin_current_account_id()
  or courier_id=public.alin_current_account_id() or delegate_id=public.alin_current_account_id()
) with check (
  library_id=public.alin_current_account_id() or pickup_library_id=public.alin_current_account_id()
  or courier_id=public.alin_current_account_id() or delegate_id=public.alin_current_account_id()
);
create policy orders_admin_delete on public.orders for delete to authenticated using (public.alin_is_admin());

create policy timeline_read on public.order_timeline for select to authenticated using (
  public.alin_is_admin() or exists(select 1 from public.orders o where o.id=order_timeline.order_id and (
    o.library_id=public.alin_current_account_id() or o.pickup_library_id=public.alin_current_account_id()
    or o.courier_id=public.alin_current_account_id() or o.delegate_id=public.alin_current_account_id()
  ))
);

create policy permits_read on public.permits for select to authenticated using (public.alin_is_admin() or library_id=public.alin_current_account_id());
create policy permits_update on public.permits for update to authenticated using (public.alin_is_admin() or library_id=public.alin_current_account_id()) with check (public.alin_is_admin() or library_id=public.alin_current_account_id());

create policy ledger_read on public.ledger for select to authenticated using (
  public.alin_is_finance_staff()
  or teacher_id=public.alin_current_account_id()
  or library_id=public.alin_current_account_id()
  or delegate_id=public.alin_current_account_id()
  or courier_id=public.alin_current_account_id()
);

create policy settlements_read on public.settlements for select to authenticated using (
  public.alin_is_finance_staff() or party_id=public.alin_current_account_id()
);

create policy withdrawals_read on public.withdrawals for select to authenticated using (public.alin_is_finance_staff() or account_id=public.alin_current_account_id());
create policy withdrawals_insert on public.withdrawals for insert to authenticated with check (account_id=public.alin_current_account_id() and role=case when public.alin_current_role()='courier' then 'delegate' else public.alin_current_role() end);
create policy withdrawals_admin_update on public.withdrawals for update to authenticated using (public.alin_is_finance_staff()) with check (public.alin_is_finance_staff());

create policy notifications_public_read on public.notifications for select to anon using (status='active' and role='all' and account_id is null);
create policy notifications_read on public.notifications for select to authenticated using (
  status='active' and (role='all' or role=public.alin_current_role() or account_id=public.alin_current_account_id())
  or public.alin_is_admin()
);
create policy notifications_admin_write on public.notifications for all to authenticated using (public.alin_is_admin()) with check (public.alin_is_admin());
create policy notification_reads_own on public.notification_reads for all to authenticated using (account_id=public.alin_current_account_id()) with check (account_id=public.alin_current_account_id());

create policy audit_admin_read on public.audit_events for select to authenticated using (public.alin_is_admin());
create policy reviews_public_insert on public.product_reviews for insert to anon,authenticated with check (status='pending');
create policy reviews_admin_read on public.product_reviews for select to authenticated using (public.alin_is_admin());
create policy reviews_admin_update on public.product_reviews for update to authenticated using (public.alin_is_admin()) with check (public.alin_is_admin());
create policy alerts_public_insert on public.stock_alerts for insert to anon,authenticated with check (status='pending');
create policy alerts_admin on public.stock_alerts for all to authenticated using (public.alin_is_admin()) with check (public.alin_is_admin());
create policy groups_public_read on public.group_orders for select to anon,authenticated using (true);
create policy groups_public_insert on public.group_orders for insert to anon,authenticated with check (status='open');
create policy group_members_admin_read on public.group_order_members for select to authenticated using (public.alin_is_admin());
create policy group_members_public_insert on public.group_order_members for insert to anon,authenticated with check (true);
create policy bundles_public_read on public.bundles for select to anon,authenticated using (status='active' or public.alin_is_admin());
create policy bundles_admin on public.bundles for all to authenticated using (public.alin_is_admin()) with check (public.alin_is_admin());
create policy bundle_items_public_read on public.bundle_items for select to anon,authenticated using (true);
create policy bundle_items_admin on public.bundle_items for all to authenticated using (public.alin_is_admin()) with check (public.alin_is_admin());
create policy backup_admin on public.backup_logs for all to authenticated using (public.alin_is_admin()) with check (public.alin_is_admin());
create policy health_admin on public.system_health_logs for all to authenticated using (public.alin_is_admin()) with check (public.alin_is_admin());

create or replace function public.alin_protect_teacher_request_update()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_allowed text[];
begin
  if public.alin_is_admin() then return new; end if;
  if public.alin_current_role()='teacher' and old.teacher_id=public.alin_current_account_id() then
    v_allowed:=array['source_file_path','source_file_name','source_file_type','source_mime_type','note','status','version_history','updated_at'];
    if new.status not in ('new','resubmitted') then raise exception 'المدرس لا يملك صلاحية اعتماد الطلب أو رفضه'; end if;
    if (to_jsonb(new)-v_allowed)<>(to_jsonb(old)-v_allowed) then raise exception 'تم منع تعديل حقول إدارية في طلب الملزمة'; end if;
    return new;
  end if;
  raise exception 'غير مسموح بتعديل طلب الملزمة';
end $$;
create trigger teacher_requests_protect_update before update on public.teacher_requests for each row execute function public.alin_protect_teacher_request_update();

create or replace function public.alin_protect_account_update()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_allowed text[];
begin
  if current_setting('request.jwt.claim.role',true)='service_role' or public.alin_is_admin() then return new; end if;
  if old.id=public.alin_current_account_id() and old.role='teacher' then
    v_allowed:=array['phone','area','specialty','bio','avatar_path','updated_at'];
    if (to_jsonb(new)-v_allowed)<>(to_jsonb(old)-v_allowed) then
      raise exception 'غير مسموح بتعديل بيانات الحساب المحمية';
    end if;
    return new;
  end if;
  if old.id=public.alin_current_account_id() and old.role='library' then
    v_allowed:=array['is_open','open_status','updated_at'];
    if (to_jsonb(new)-v_allowed)<>(to_jsonb(old)-v_allowed) then raise exception 'غير مسموح بتعديل بيانات المكتبة المحمية'; end if;
    return new;
  end if;
  raise exception 'غير مسموح بتعديل الحساب';
end $$;
create trigger accounts_protect_update before update on public.accounts for each row execute function public.alin_protect_account_update();

create or replace function public.alin_protect_courier_update()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_allowed text[];
begin
  if current_setting('request.jwt.claim.role',true)='service_role' or public.alin_is_admin() then return new; end if;
  if old.id=public.alin_current_account_id() and public.alin_current_role()='courier' then
    v_allowed:=array['phone','availability','updated_at'];
    if (to_jsonb(new)-v_allowed)<>(to_jsonb(old)-v_allowed) then
      raise exception 'المندوب يستطيع تعديل الهاتف وحالة العمل فقط';
    end if;
    return new;
  end if;
  raise exception 'غير مسموح بتعديل بيانات المندوب';
end $$;
create trigger couriers_protect_update before update on public.couriers for each row execute function public.alin_protect_courier_update();

-- =========================================================
-- 5) حماية التعديل المباشر للطلبات
-- =========================================================

create or replace function public.alin_protect_order_update()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_role text:=public.alin_current_role();
  v_allowed text[];
begin
  if current_setting('request.jwt.claim.role',true)='service_role' or current_setting('alin.internal_order_transition',true)='on' then return new; end if;
  if public.alin_is_admin() then return new; end if;
  if v_role='library' then
    v_allowed:=array['notes','library_note','updated_at'];
  elsif v_role='courier' then
    v_allowed:=array['delivery_note','proof_path','handoff_token','updated_at'];
  else
    raise exception 'غير مسموح بتعديل الطلب مباشرة';
  end if;
  if (to_jsonb(new)-v_allowed)<>(to_jsonb(old)-v_allowed) then
    raise exception 'استخدم خدمة تحديث حالة الطلب الآمنة';
  end if;
  return new;
end $$;
create trigger orders_protect_update before update on public.orders for each row execute function public.alin_protect_order_update();

-- =========================================================
-- 6) إنشاء الطلب الآمن ومنع التكرار
-- =========================================================

create or replace function public.alin_create_store_orders_guarded(
  p_items jsonb,
  p_customer jsonb,
  p_fulfillment jsonb default '{}'::jsonb,
  p_coupon_code text default null,
  p_request_key text default null,
  p_device_id text default null
)
returns table(order_number text,order_id text)
language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  v_request_key text:=lower(btrim(coalesce(p_request_key,'')));
  v_device text:=btrim(coalesce(p_device_id,''));
  v_name text:=btrim(coalesce(p_customer->>'name',''));
  v_phone text:=translate(btrim(coalesce(p_customer->>'phone','')),'٠١٢٣٤٥٦٧٨٩','0123456789');
  v_phone_hash text; v_device_hash text; v_payload_hash text;
  v_request_id uuid; v_existing public.checkout_requests%rowtype;
  v_count integer; v_result jsonb:='[]'::jsonb;
  v_fulfillment text; v_library_id text; v_area_id text; v_area public.delivery_areas%rowtype;
  v_delivery_fee numeric:=0; v_landmark text; v_lat numeric; v_lng numeric; v_accuracy integer;
  v_coupon public.coupons%rowtype; v_coupon_value numeric:=0; v_fixed_remaining numeric:=0; v_coupon_applied boolean:=false; v_cart_subtotal numeric:=0;
  v_item jsonb; v_kind text; v_item_id text; v_qty integer; v_title text; v_price numeric; v_stock numeric;
  v_subtotal numeric; v_discount numeric; v_total numeric; v_index integer:=0; v_id text; v_number text;
  v_student_id text;
begin
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'السلة فارغة'; end if;
  if jsonb_array_length(p_items)>30 then raise exception 'عدد عناصر السلة أكبر من الحد المسموح'; end if;
  v_phone:=regexp_replace(v_phone,'[^0-9+]','','g');
  if length(v_name)<2 or length(v_name)>120 then raise exception 'اكتب اسم الطالب بصورة صحيحة'; end if;
  if v_phone !~ '^\+?[0-9]{7,15}$' then raise exception 'اكتب رقم هاتف صحيح'; end if;
  if v_request_key !~ '^[a-z0-9-]{20,80}$' then raise exception 'رمز تأكيد الطلب غير صالح. حدّث الصفحة وحاول مجدداً'; end if;
  if length(v_device)<16 or length(v_device)>160 then raise exception 'تعذر التحقق من جهاز الطلب'; end if;

  v_phone_hash:=encode(extensions.digest('alin-phone-v4:'||v_phone,'sha256'),'hex');
  v_device_hash:=encode(extensions.digest('alin-device-v4:'||v_device,'sha256'),'hex');
  v_payload_hash:=encode(extensions.digest(jsonb_build_object('items',p_items,'customer',jsonb_build_object('name',v_name,'phone',v_phone),'fulfillment',p_fulfillment,'coupon',lower(btrim(coalesce(p_coupon_code,''))))::text,'sha256'),'hex');

  insert into public.checkout_requests(request_key,device_hash,phone_hash,payload_hash,status)
  values(v_request_key,v_device_hash,v_phone_hash,v_payload_hash,'pending')
  on conflict(request_key) do nothing returning id into v_request_id;

  if v_request_id is null then
    select * into v_existing from public.checkout_requests where request_key=v_request_key for update;
    if v_existing.payload_hash<>v_payload_hash then raise exception 'رمز الطلب مستخدم لمحتوى مختلف'; end if;
    if v_existing.status='completed' and jsonb_typeof(v_existing.result)='array' then
      return query select x.order_number,x.order_id from jsonb_to_recordset(v_existing.result) x(order_number text,order_id text);
      return;
    end if;
    if v_existing.created_at>now()-interval '2 minutes' then raise exception 'الطلب نفسه قيد المعالجة. انتظر لحظات'; end if;
    update public.checkout_requests set device_hash=v_device_hash,phone_hash=v_phone_hash,payload_hash=v_payload_hash,status='pending',result=null,created_at=now(),completed_at=null where id=v_existing.id returning id into v_request_id;
  end if;

  select count(*) into v_count from public.checkout_requests where phone_hash=v_phone_hash and created_at>now()-interval '5 minutes';
  if v_count>4 then raise exception 'تم إرسال طلبات كثيرة لهذا الرقم. انتظر خمس دقائق'; end if;
  select count(*) into v_count from public.checkout_requests where device_hash=v_device_hash and created_at>now()-interval '5 minutes';
  if v_count>8 then raise exception 'تم إرسال طلبات كثيرة من هذا الجهاز. انتظر خمس دقائق'; end if;

  v_fulfillment:=lower(btrim(coalesce(p_fulfillment->>'fulfillment_type',p_fulfillment->>'delivery_type','')));
  if v_fulfillment in ('pickup','library') then
    v_fulfillment:='pickup';
    v_library_id:=btrim(coalesce(p_fulfillment->>'library_id',p_fulfillment->>'pickup_library_id',''));
    if v_library_id='' then raise exception 'اختر مكتبة الاستلام'; end if;
    if not exists(select 1 from public.accounts a where a.id=v_library_id and a.role='library' and a.status='active' and a.deleted_at is null and a.is_open and a.open_status='open') then
      raise exception 'المكتبة المختارة غير متاحة حالياً';
    end if;
  elsif v_fulfillment in ('home_delivery','courier','delivery') then
    v_fulfillment:='home_delivery';
    if not public.alin_setting_boolean('delivery_enabled',true) then raise exception 'خدمة التوصيل متوقفة مؤقتاً'; end if;
    v_area_id:=btrim(coalesce(p_fulfillment->>'delivery_area',''));
    select * into v_area from public.delivery_areas d where d.status='active' and d.active and (d.id=v_area_id or lower(d.name)=lower(v_area_id)) limit 1;
    if not found then raise exception 'منطقة التوصيل غير معتمدة'; end if;
    v_delivery_fee:=v_area.delivery_fee;
    v_landmark:=left(btrim(coalesce(p_fulfillment->>'delivery_landmark','')),300);
    begin v_lat:=nullif(p_fulfillment->>'delivery_latitude','')::numeric; exception when others then v_lat:=null; end;
    begin v_lng:=nullif(p_fulfillment->>'delivery_longitude','')::numeric; exception when others then v_lng:=null; end;
    begin v_accuracy:=nullif(p_fulfillment->>'delivery_location_accuracy','')::integer; exception when others then v_accuracy:=null; end;
    if v_lat is null and v_landmark='' then raise exception 'حدد الموقع أو اكتب أقرب نقطة دالة'; end if;
    if v_lat is not null and (v_lng is null or v_lat not between -90 and 90 or v_lng not between -180 and 180) then raise exception 'إحداثيات الموقع غير صحيحة'; end if;
  else
    raise exception 'اختر طريقة استلام صحيحة';
  end if;

  select id into v_student_id from public.student_profiles where phone=v_phone limit 1;

  if p_coupon_code is not null and btrim(p_coupon_code)<>'' then
    select * into v_coupon from public.coupons c where lower(c.code)=lower(btrim(p_coupon_code)) for update;
    if not found or v_coupon.status<>'active' or (v_coupon.starts_at is not null and v_coupon.starts_at>now()) or (v_coupon.expires_at is not null and v_coupon.expires_at<now()) then
      raise exception 'الكوبون غير صالح أو منتهي';
    end if;
    if v_coupon.max_uses>0 and v_coupon.used_count>=v_coupon.max_uses then raise exception 'انتهى عدد استخدامات الكوبون'; end if;
    v_coupon_value:=v_coupon.discount_value;
    if v_coupon.discount_type='fixed' then v_fixed_remaining:=v_coupon_value; end if;
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_index:=v_index+1;
    v_kind:=lower(btrim(coalesce(v_item->>'kind','')));
    v_item_id:=btrim(coalesce(v_item->>'id',''));
    begin v_qty:=greatest(1,least(50,coalesce((v_item->>'qty')::integer,1))); exception when others then v_qty:=1; end;
    if v_item_id='' then raise exception 'عنصر غير صالح في السلة'; end if;

    if v_kind in ('booklet','booklets','booklet_product','ملزمة','ملازم') then
      select b.title,b.price into v_title,v_price from public.booklets b
      where b.id=v_item_id and b.status='published' and b.publish_status='published' and b.deleted_at is null;
      if not found then raise exception 'الملزمة غير متاحة حالياً'; end if;
      v_kind:='booklet';
    else
      select coalesce(p.title,p.name),coalesce(p.sale_price,p.price),p.stock into v_title,v_price,v_stock
      from public.products p where p.id=v_item_id and p.status='published' and p.deleted_at is null for update;
      if not found then raise exception 'المنتج غير متاح حالياً'; end if;
      if v_stock<v_qty then raise exception 'الكمية غير متوفرة: %',v_title; end if;
      select case p.type when 'stationery' then 'stationery' when 'gift' then 'gift' else 'product' end into v_kind from public.products p where p.id=v_item_id;
      if v_fulfillment='pickup' then raise exception 'القرطاسية والهدايا متاحة بالتوصيل إلى البيت فقط'; end if;
    end if;

    v_subtotal:=v_price*v_qty;
    v_cart_subtotal:=v_cart_subtotal+v_subtotal;
    v_discount:=0;
    if p_coupon_code is not null and btrim(p_coupon_code)<>'' and (v_coupon.applies_to in ('all','') or v_coupon.applies_to=v_kind or (v_coupon.applies_to='product' and v_kind<>'booklet')) then
      if v_coupon.discount_type='percent' then
        v_discount:=round(v_subtotal*least(v_coupon_value,100)/100);
        if v_coupon.max_discount>0 then v_discount:=least(v_discount,v_coupon.max_discount); end if;
      else
        v_discount:=least(v_subtotal,v_fixed_remaining);
        v_fixed_remaining:=greatest(v_fixed_remaining-v_discount,0);
      end if;
    end if;
    v_total:=greatest(v_subtotal-v_discount,0)+case when v_index=1 then v_delivery_fee else 0 end;
    if v_discount>0 then v_coupon_applied:=true; end if;

    v_id:='O'||replace(extensions.gen_random_uuid()::text,'-','');
    v_number:='AL-'||to_char(clock_timestamp(),'YYMMDDHH24MISS')||'-'||lpad(v_index::text,2,'0')||'-'||substr(replace(extensions.gen_random_uuid()::text,'-',''),1,4);

    insert into public.orders(
      id,order_number,kind,item_id,title,student_id,student_name,student_phone,qty,unit_price,discount,total,coupon_code,
      status,assignment_status,status_history,payment_status,payment_method,fulfillment_type,delivery_type,
      library_id,pickup_library_id,delivery_area_id,delivery_area,delivery_landmark,delivery_fee,
      delivery_latitude,delivery_longitude,delivery_location_url,delivery_location_accuracy,delivery_location_source,
      checkout_request_key,checkout_group_id,stock_reserved
    ) values (
      v_id,v_number,v_kind,v_item_id,v_title,v_student_id,v_name,v_phone,v_qty,v_price,v_discount,v_total,nullif(btrim(p_coupon_code),''),
      'new','pending_admin',jsonb_build_array(jsonb_build_object('status','new','at',now(),'by','secure_checkout')),
      'cod_pending',case when v_fulfillment='pickup' then 'cash_at_library' else 'cash_to_courier' end,v_fulfillment,
      case when v_fulfillment='pickup' then 'library' else 'courier' end,
      v_library_id,v_library_id,case when v_fulfillment='home_delivery' then v_area.id else null end,
      case when v_fulfillment='home_delivery' then v_area.name else null end,v_landmark,case when v_index=1 then v_delivery_fee else 0 end,
      v_lat,v_lng,case when v_lat is not null then 'https://www.google.com/maps?q='||v_lat::text||','||v_lng::text else null end,
      v_accuracy,case when v_lat is not null then 'student_device' else 'landmark' end,
      v_request_key,v_request_id::text,v_kind<>'booklet'
    );

    insert into public.order_timeline(order_id,status,actor_role,meta) values(v_id,'new','store',jsonb_build_object('request_key',v_request_key));

    if v_kind<>'booklet' then
      update public.products set stock=stock-v_qty where id=v_item_id and stock>=v_qty;
      if not found then raise exception 'نفدت الكمية أثناء تأكيد الطلب: %',v_title; end if;
    end if;

    v_result:=v_result||jsonb_build_array(jsonb_build_object('order_number',v_number,'order_id',v_id));
  end loop;

  if v_coupon.id is not null then
    if v_coupon.min_order>0 and v_cart_subtotal<v_coupon.min_order then raise exception 'قيمة السلة أقل من الحد المطلوب للكوبون'; end if;
    if not v_coupon_applied then raise exception 'الكوبون لا ينطبق على عناصر السلة'; end if;
    update public.coupons set used_count=used_count+1,usage_count=usage_count+1 where id=v_coupon.id;
  end if;

  update public.checkout_requests set status='completed',result=v_result,completed_at=now() where id=v_request_id;
  return query select x.order_number,x.order_id from jsonb_to_recordset(v_result) x(order_number text,order_id text);
end $$;

-- =========================================================
-- 7) انتقال حالة الطلب والحسابات الذرية
-- =========================================================

create or replace function public.alin_upsert_order_finance_atomic(p_order_id text)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare
  o public.orders%rowtype; b public.booklets%rowtype;
  v_teacher_id text; v_library_id text; v_delegate_id text; v_collector_role text; v_collector_id text;
  v_total numeric; v_delivery numeric; v_merchandise numeric; v_teacher_pct numeric; v_library_pct numeric; v_delegate_pct numeric;
  v_teacher numeric:=0; v_library numeric:=0; v_delegate numeric:=0; v_admin numeric:=0; v_debt numeric:=0;
  v_ledger_id text;
begin
  select * into o from public.orders where id=p_order_id for update;
  if not found then raise exception 'الطلب غير موجود'; end if;
  if o.status<>'completed' then raise exception 'لا يمكن إنشاء الحسابات قبل تسليم الطلب'; end if;

  if exists(select 1 from public.ledger l where l.order_id=o.id and l.status='settled') then
    select id into v_ledger_id from public.ledger where order_id=o.id;
    return jsonb_build_object('ledger_id',v_ledger_id,'order_id',o.id,'already_settled',true);
  end if;

  v_total:=o.total; v_delivery:=least(o.total,greatest(o.delivery_fee,0)); v_merchandise:=greatest(v_total-v_delivery,0);
  v_library_id:=coalesce(o.library_id,o.pickup_library_id);
  v_delegate_id:=coalesce(o.delegate_id,o.courier_id);

  if o.kind='booklet' then
    select * into b from public.booklets where id=o.item_id;
    v_teacher_id:=b.teacher_id;
    v_teacher_pct:=coalesce(b.teacher_share_percent,public.alin_setting_numeric('teacher_profit_percent',50));
    v_library_pct:=coalesce(b.library_share_percent,public.alin_setting_numeric('library_profit_percent',30));
    v_teacher:=round(v_merchandise*least(greatest(v_teacher_pct,0),100)/100);
  else
    v_teacher_pct:=0; v_library_pct:=public.alin_setting_numeric('library_profit_percent',30);
  end if;
  v_delegate_pct:=public.alin_setting_numeric('delegate_profit_percent',30);

  if o.fulfillment_type='home_delivery' then
    v_collector_role:='delegate'; v_collector_id:=v_delegate_id;
    if v_collector_id is null then raise exception 'طلب التوصيل غير مرتبط بمندوب'; end if;
    v_delegate:=round(v_delivery*least(greatest(v_delegate_pct,0),100)/100);
  else
    v_collector_role:='library'; v_collector_id:=v_library_id;
    if v_collector_id is null then raise exception 'طلب الاستلام غير مرتبط بمكتبة'; end if;
    v_library:=least(greatest(v_merchandise-v_teacher,0),round(v_merchandise*least(greatest(v_library_pct,0),100)/100));
  end if;
  v_admin:=greatest(v_total-v_teacher-v_library-v_delegate,0);
  v_debt:=greatest(v_total-case when v_collector_role='library' then v_library else v_delegate end,0);

  v_ledger_id:='LG'||replace(extensions.gen_random_uuid()::text,'-','');
  insert into public.ledger(
    id,order_id,order_number,title,total,merchandise_total,delivery_fee,alin,admin,teacher,teacher_id,library,library_id,
    delegate,courier,delegate_id,courier_id,collector_role,collector_id,collector_debt,delivery_type,status,settlement_status,
    finance_version,is_current,note
  ) values (
    v_ledger_id,o.id,o.order_number,o.title,v_total,v_merchandise,v_delivery,v_admin,v_admin,v_teacher,v_teacher_id,v_library,v_library_id,
    v_delegate,v_delegate,v_delegate_id,v_delegate_id,v_collector_role,v_collector_id,v_debt,v_collector_role,'pending','pending','4.0.0',true,
    'قيد مالي ذري من الطلب المكتمل'
  )
  on conflict(order_id) do update set
    order_number=excluded.order_number,title=excluded.title,total=excluded.total,merchandise_total=excluded.merchandise_total,
    delivery_fee=excluded.delivery_fee,alin=excluded.alin,admin=excluded.admin,teacher=excluded.teacher,teacher_id=excluded.teacher_id,
    library=excluded.library,library_id=excluded.library_id,delegate=excluded.delegate,courier=excluded.courier,
    delegate_id=excluded.delegate_id,courier_id=excluded.courier_id,collector_role=excluded.collector_role,
    collector_id=excluded.collector_id,collector_debt=excluded.collector_debt,delivery_type=excluded.delivery_type,
    status=case when public.ledger.status='settled' then public.ledger.status else 'pending' end,
    settlement_status=case when public.ledger.settlement_status='settled' then public.ledger.settlement_status else 'pending' end,
    finance_version='4.0.0',is_current=true,note=excluded.note,updated_at=now()
  returning id into v_ledger_id;

  perform set_config('alin.internal_order_transition','on',true);
  update public.orders set settlement_done=true,settlement_cancelled=false,settlement_at=coalesce(settlement_at,now()),
    settlement_party=v_collector_role,platform_profit=v_admin,teacher_profit=v_teacher,library_profit=v_library,
    delegate_profit=v_delegate,courier_profit=v_delegate,cash_collected_by=v_collector_role,
    cash_collected_at=coalesce(cash_collected_at,now()),library_cash_collected=case when v_collector_role='library' then v_total else 0 end,
    delegate_cash_collected=case when v_collector_role='delegate' then v_total else 0 end,finance_version='4.0.0'
  where id=o.id;
  perform set_config('alin.internal_order_transition','off',true);

  return jsonb_build_object('ledger_id',v_ledger_id,'order_id',o.id,'total',v_total,'admin',v_admin,'teacher',v_teacher,'library',v_library,'delegate',v_delegate,'collector_debt',v_debt);
end $$;

-- =========================================================
-- ALIN v4.1.0 — authoritative courier assignment and workflow
-- =========================================================

create or replace function public.alin_admin_assign_order(
  p_order_id text,
  p_courier_id text default null,
  p_library_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,extensions,pg_temp
as $$
declare
  o public.orders%rowtype;
  v_updated public.orders%rowtype;
  c public.couriers%rowtype;
  a public.accounts%rowtype;
  l public.accounts%rowtype;
  v_actor text:=public.alin_current_account_id();
  v_role text:=public.alin_current_role();
  v_courier_id text:=nullif(btrim(coalesce(p_courier_id,'')),'');
  v_library_id text:=nullif(btrim(coalesce(p_library_id,'')),'');
  v_now timestamptz:=now();
  v_area text;
  v_area_ok boolean:=false;
  v_same boolean:=false;
  v_next_status text;
  v_history_status text;
begin
  if not public.alin_is_finance_staff() then
    raise exception 'هذه العملية متاحة للإدارة فقط';
  end if;

  select * into o from public.orders where id=p_order_id for update;
  if not found then raise exception 'الطلب غير موجود'; end if;

  if lower(btrim(coalesce(o.status,''))) in ('completed','delivered','cancelled','canceled','rejected') then
    raise exception 'لا يمكن تغيير تعيين طلب مكتمل أو ملغي';
  end if;

  -- طلبات التوصيل المنزلي تعتمد المندوب حصراً.
  if o.fulfillment_type='home_delivery' or o.delivery_type='courier' then
    if v_courier_id is null then
      if lower(btrim(coalesce(o.status,''))) in ('picked_up','out_for_delivery','out_delivery') then
        raise exception 'لا يمكن إلغاء تعيين المندوب بعد استلام الطلب أو بدء التوصيل';
      end if;

      if o.courier_id is null and o.delegate_id is null
         and lower(btrim(coalesce(o.status,'')))='pending_admin' then
        return jsonb_build_object('ok',true,'order',to_jsonb(o),'idempotent',true);
      end if;

      perform set_config('alin.internal_order_transition','on',true);
      update public.orders set
        courier_id=null,
        delegate_id=null,
        status='pending_admin',
        assignment_status='pending_admin',
        assigned_at=null,
        accepted_at=null,
        picked_up_at=null,
        out_for_delivery_at=null,
        status_history=coalesce(status_history,'[]'::jsonb)||jsonb_build_array(jsonb_build_object(
          'status','pending_admin','at',v_now,'by',coalesce(v_actor,'system'),'role',coalesce(v_role,'system'),
          'reason','إلغاء تعيين المندوب'
        )),
        updated_at=v_now
      where id=o.id
      returning * into v_updated;
      perform set_config('alin.internal_order_transition','off',true);

      insert into public.order_timeline(order_id,status,actor_id,actor_role,reason,meta)
      values(o.id,'pending_admin',v_actor,coalesce(v_role,'admin'),'إلغاء تعيين المندوب',jsonb_build_object('courier_id',null));

      return jsonb_build_object('ok',true,'order',to_jsonb(v_updated),'unassigned',true);
    end if;

    select * into a from public.accounts
    where id=v_courier_id and role='courier' and status='active' and deleted_at is null;
    if not found then raise exception 'حساب المندوب غير موجود أو غير فعال'; end if;

    select * into c from public.couriers where id=v_courier_id and status='active';
    if not found then raise exception 'بيانات المندوب غير مهيأة أو الحساب موقوف'; end if;

    v_area:=lower(regexp_replace(
      btrim(split_part(replace(replace(coalesce(o.delivery_area,''),'–','-'),'—','-'),'-',1)),
      '\s+',' ','g'
    ));

    if v_area='' then
      v_area_ok:=true;
    else
      v_area_ok:=
        lower(regexp_replace(btrim(coalesce(c.area,'')),'\s+',' ','g'))=v_area
        or exists(
          select 1 from unnest(coalesce(c.areas,array[]::text[])) area_name
          where lower(regexp_replace(
            btrim(split_part(replace(replace(area_name,'–','-'),'—','-'),'-',1)),
            '\s+',' ','g'
          ))=v_area
        )
        or exists(
          select 1
          from public.courier_areas ca
          join public.delivery_areas da on da.id=ca.area_id
          where ca.courier_id=v_courier_id
            and (
              (o.delivery_area_id is not null and da.id=o.delivery_area_id)
              or lower(regexp_replace(
                btrim(split_part(replace(replace(da.name,'–','-'),'—','-'),'-',1)),
                '\s+',' ','g'
              ))=v_area
            )
        );
    end if;

    if not v_area_ok then raise exception 'المندوب غير مرتبط بمنطقة الطلب'; end if;

    v_same:=coalesce(o.courier_id,o.delegate_id,'')=v_courier_id;
    if not v_same and lower(btrim(coalesce(o.status,''))) in ('picked_up','out_for_delivery','out_delivery') then
      raise exception 'لا يمكن تغيير المندوب بعد استلام الطلب أو بدء التوصيل';
    end if;

    if v_same and lower(btrim(coalesce(o.status,''))) in ('assigned','accepted','picked_up','out_for_delivery')
       and o.courier_id=v_courier_id and o.delegate_id=v_courier_id then
      return jsonb_build_object('ok',true,'order',to_jsonb(o),'idempotent',true);
    end if;

    v_next_status:=case
      when v_same and lower(btrim(coalesce(o.status,''))) in ('accepted','picked_up','out_for_delivery')
        then lower(btrim(o.status))
      else 'assigned'
    end;

    perform set_config('alin.internal_order_transition','on',true);
    update public.orders set
      courier_id=v_courier_id,
      delegate_id=v_courier_id,
      status=v_next_status,
      assignment_status=case when v_next_status='accepted' then 'accepted' else 'assigned' end,
      assigned_at=case when v_same then coalesce(assigned_at,v_now) else v_now end,
      accepted_at=case when v_next_status='accepted' then accepted_at else null end,
      picked_up_at=case when v_next_status='picked_up' then picked_up_at else null end,
      out_for_delivery_at=case when v_next_status='out_for_delivery' then out_for_delivery_at else null end,
      delivery_note=case when v_same then delivery_note else null end,
      status_history=coalesce(status_history,'[]'::jsonb)||jsonb_build_array(jsonb_build_object(
        'status',v_next_status,'at',v_now,'by',coalesce(v_actor,'system'),'role',coalesce(v_role,'system'),
        'reason',case when v_same then 'تثبيت تعيين المندوب' else 'تعيين المندوب' end,
        'courier_id',v_courier_id
      )),
      updated_at=v_now
    where id=o.id
    returning * into v_updated;
    perform set_config('alin.internal_order_transition','off',true);

    insert into public.order_timeline(order_id,status,actor_id,actor_role,reason,meta)
    values(o.id,v_next_status,v_actor,coalesce(v_role,'admin'),
      case when v_same then 'تثبيت تعيين المندوب' else 'تعيين المندوب' end,
      jsonb_build_object('courier_id',v_courier_id,'courier_name',a.name));

    return jsonb_build_object('ok',true,'order',to_jsonb(v_updated),'assigned',true);
  end if;

  -- طلبات الاستلام من المكتبة تعتمد المكتبة ولا تقبل مندوباً.
  if v_courier_id is not null then
    raise exception 'طلب الاستلام من المكتبة لا يقبل تعيين مندوب';
  end if;
  if v_library_id is null then raise exception 'اختر مكتبة لاستلام الطلب'; end if;

  select * into l from public.accounts
  where id=v_library_id and role='library' and status='active' and deleted_at is null;
  if not found then raise exception 'حساب المكتبة غير موجود أو غير فعال'; end if;

  if o.library_id=v_library_id and o.pickup_library_id=v_library_id
     and o.courier_id is null and o.delegate_id is null then
    return jsonb_build_object('ok',true,'order',to_jsonb(o),'idempotent',true);
  end if;

  perform set_config('alin.internal_order_transition','on',true);
  update public.orders set
    library_id=v_library_id,
    pickup_library_id=v_library_id,
    courier_id=null,
    delegate_id=null,
    assignment_status='pending_admin',
    assigned_at=null,
    accepted_at=null,
    picked_up_at=null,
    out_for_delivery_at=null,
    status_history=coalesce(status_history,'[]'::jsonb)||jsonb_build_array(jsonb_build_object(
      'status',o.status,'at',v_now,'by',coalesce(v_actor,'system'),'role',coalesce(v_role,'system'),
      'reason','تعيين مكتبة الاستلام','library_id',v_library_id
    )),
    updated_at=v_now
  where id=o.id
  returning * into v_updated;
  perform set_config('alin.internal_order_transition','off',true);

  insert into public.order_timeline(order_id,status,actor_id,actor_role,reason,meta)
  values(o.id,v_updated.status,v_actor,coalesce(v_role,'admin'),'تعيين مكتبة الاستلام',
    jsonb_build_object('library_id',v_library_id,'library_name',l.name));

  return jsonb_build_object('ok',true,'order',to_jsonb(v_updated),'library_assigned',true);
end $$;

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
  if v_source='delivered' then v_source:='completed'; end if;
  if v_source='out_delivery' then v_source:='out_for_delivery'; end if;
  if v_source='canceled' then v_source:='cancelled'; end if;
  if v_target='delivered' then v_target:='completed'; end if;
  if v_target='out_delivery' then v_target:='out_for_delivery'; end if;
  if v_target='canceled' then v_target:='cancelled'; end if;

  if v_target not in ('new','pending_admin','assigned','accepted','picked_up','out_for_delivery','processing','printing','ready','completed','cancelled','rejected') then
    raise exception 'حالة الطلب المطلوبة غير صحيحة';
  end if;

  if v_source='completed' and v_target='completed' then
    v_finance:=public.alin_upsert_order_finance_atomic(o.id);
    select * into v_updated from public.orders where id=o.id;
    return jsonb_build_object('ok',true,'status','completed','order',to_jsonb(v_updated),'finance',v_finance,'idempotent',true);
  end if;
  if v_source='completed' then raise exception 'الطلب المكتمل لا يرجع لحالة سابقة'; end if;
  if v_source in ('cancelled','rejected') then raise exception 'الطلب الملغي أو المرفوض لا يمكن تحديثه'; end if;

  if public.alin_is_finance_staff() then
    v_allowed:=true;
  elsif v_role='library' and v_account in (o.library_id,o.pickup_library_id) then
    v_allowed:=
      (v_source in ('new','pending','pending_admin','accepted') and v_target in ('processing','cancelled'))
      or (v_source in ('processing','printing') and v_target in ('ready','cancelled'))
      or (v_source='ready' and v_target in ('completed','cancelled'));
  elsif v_role='courier' and v_account in (o.courier_id,o.delegate_id) then
    v_allowed:=
      (v_source in ('new','pending','pending_admin','assigned') and v_target in ('accepted','rejected'))
      or (v_source='accepted' and v_target='picked_up')
      or (v_source='picked_up' and v_target='out_for_delivery')
      or (v_source='out_for_delivery' and v_target='completed');
  end if;

  if not v_allowed then
    raise exception 'غير مسموح بانتقال الطلب من الحالة % إلى % لهذا الحساب',v_source,v_target;
  end if;

  if v_target in ('cancelled','rejected') and nullif(btrim(coalesce(p_reason,'')),'') is null then
    raise exception 'اكتب سبب الإلغاء أو الرفض';
  end if;

  if v_source=v_target then
    return jsonb_build_object('ok',true,'status',v_target,'order',to_jsonb(o),'idempotent',true);
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
        note=coalesce(note,'')||' | ألغي الطلب قبل التسوية',updated_at=v_now
    where order_id=o.id and status<>'settled';
  end if;

  return jsonb_build_object('ok',true,'status',v_target,'order',to_jsonb(v_updated),'finance',v_finance);
end $$;


create or replace function public.alin_library_set_order_status(p_order_id text,p_status text,p_reason text default null)
returns jsonb language sql security definer set search_path=public,extensions,pg_temp as $$
  select public.alin_order_transition_atomic(p_order_id,p_status,p_reason)
$$;

-- =========================================================
-- 8) المالية والتسويات
-- =========================================================

create or replace function public.alin_finance_record_settlement(p_role text,p_party_id text,p_amount numeric,p_method text,p_note text)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_role text:=lower(btrim(p_role)); v_id text; v_receipt text;
begin
  if not public.alin_is_finance_staff() then raise exception 'هذه العملية للإدارة المالية فقط'; end if;
  if v_role='courier' then v_role:='delegate'; end if;
  if v_role not in ('admin','teacher','library','delegate') then raise exception 'نوع الحساب المالي غير صحيح'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'المبلغ غير صحيح'; end if;
  v_id:='STL'||replace(extensions.gen_random_uuid()::text,'-','');
  v_receipt:='RC-'||to_char(clock_timestamp(),'YYMMDDHH24MISS')||'-'||substr(replace(extensions.gen_random_uuid()::text,'-',''),1,5);
  insert into public.settlements(id,receipt_number,party_role,party_id,amount,payment_method,status,note,created_by)
  values(v_id,v_receipt,v_role,nullif(p_party_id,''),p_amount,coalesce(nullif(btrim(p_method),''),'cash'),case when v_role in ('admin','teacher') then 'paid' else 'received' end,nullif(btrim(p_note),''),public.alin_current_account_id());
  return jsonb_build_object('id',v_id,'receipt_number',v_receipt,'role',v_role,'amount',p_amount);
end $$;

create or replace function public.alin_finance_reverse_settlement(p_role text,p_settlement_id text,p_reason text)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare s public.settlements%rowtype; v_id text; v_receipt text;
begin
  if not public.alin_is_finance_staff() then raise exception 'هذه العملية للإدارة المالية فقط'; end if;
  select * into s from public.settlements where id=p_settlement_id for update;
  if not found then raise exception 'السند غير موجود'; end if;
  if s.status in ('reversed','cancelled') then raise exception 'السند معكوس أو ملغي مسبقاً'; end if;
  update public.settlements set status='reversed',note=coalesce(note,'')||' | عكس: '||coalesce(p_reason,'') where id=s.id;
  v_id:='STL'||replace(extensions.gen_random_uuid()::text,'-','');
  v_receipt:='RV-'||to_char(clock_timestamp(),'YYMMDDHH24MISS')||'-'||substr(replace(extensions.gen_random_uuid()::text,'-',''),1,5);
  insert into public.settlements(id,receipt_number,party_role,party_id,amount,payment_method,status,note,reversed_from,created_by)
  values(v_id,v_receipt,s.party_role,s.party_id,s.amount,s.payment_method,'reversed','عكس السند '||s.receipt_number||': '||coalesce(p_reason,''),s.id,public.alin_current_account_id());
  return jsonb_build_object('ok',true,'reversal_id',v_id);
end $$;

create or replace function public.alin_finance_party_balance(p_role text,p_party_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_role text:=replace(lower(btrim(p_role)),'courier','delegate'); v_earned numeric:=0; v_paid numeric:=0;
begin
  if not (public.alin_is_finance_staff() or p_party_id=public.alin_current_account_id()) then raise exception 'غير مسموح بعرض هذا الرصيد'; end if;
  if v_role='admin' then select coalesce(sum(admin),0) into v_earned from public.ledger where status<>'cancelled';
  elsif v_role='teacher' then select coalesce(sum(teacher),0) into v_earned from public.ledger where teacher_id=p_party_id and status<>'cancelled';
  elsif v_role='library' then select coalesce(sum(library),0) into v_earned from public.ledger where library_id=p_party_id and status<>'cancelled';
  elsif v_role='delegate' then select coalesce(sum(delegate),0) into v_earned from public.ledger where delegate_id=p_party_id and status<>'cancelled';
  else raise exception 'نوع الحساب غير صحيح'; end if;
  select coalesce(sum(case when status in ('paid','received') then amount else 0 end),0) into v_paid from public.settlements where party_role=v_role and (v_role='admin' or party_id=p_party_id);
  return jsonb_build_object('earned',v_earned,'paid',v_paid,'remaining',greatest(v_earned-v_paid,0));
end $$;

create or replace function public.alin_login_guard_key(p_value text)
returns text language sql immutable set search_path=extensions as $$
  select encode(extensions.digest(lower(btrim(coalesce(p_value,''))),'sha256'),'hex')
$$;

create or replace function public.alin_login_guard_check(p_identifier text,p_device text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_i text:=public.alin_login_guard_key(p_identifier); v_d text:=public.alin_login_guard_key(p_device); g public.auth_login_guard%rowtype;
begin
  select * into g from public.auth_login_guard where identifier_hash=v_i and device_hash=v_d;
  if found and g.locked_until is not null and g.locked_until>now() then
    return jsonb_build_object('allowed',false,'retry_after_seconds',greatest(1,extract(epoch from (g.locked_until-now()))::integer),'remaining',0);
  end if;
  return jsonb_build_object('allowed',true,'remaining',greatest(0,5-coalesce(g.failed_attempts,0)));
end $$;

create or replace function public.alin_login_guard_fail(p_identifier text,p_device text)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_i text:=public.alin_login_guard_key(p_identifier); v_d text:=public.alin_login_guard_key(p_device); v_attempts integer; v_lock timestamptz;
begin
  insert into public.auth_login_guard(identifier_hash,device_hash,failed_attempts,last_failed_at,updated_at)
  values(v_i,v_d,1,now(),now())
  on conflict(identifier_hash,device_hash) do update set
    failed_attempts=case when public.auth_login_guard.locked_until is not null and public.auth_login_guard.locked_until<=now() then 1 else public.auth_login_guard.failed_attempts+1 end,
    last_failed_at=now(),updated_at=now(),
    locked_until=case when (case when public.auth_login_guard.locked_until is not null and public.auth_login_guard.locked_until<=now() then 1 else public.auth_login_guard.failed_attempts+1 end)>=5 then now()+interval '15 minutes' else public.auth_login_guard.locked_until end
  returning failed_attempts,locked_until into v_attempts,v_lock;
  return jsonb_build_object('allowed',not(v_lock is not null and v_lock>now()),'remaining',greatest(0,5-v_attempts),'retry_after_seconds',case when v_lock>now() then extract(epoch from (v_lock-now()))::integer else 0 end);
end $$;

create or replace function public.alin_login_guard_success(p_identifier text,p_device text)
returns boolean language plpgsql security definer set search_path=public as $$
begin
  delete from public.auth_login_guard where identifier_hash=public.alin_login_guard_key(p_identifier) and device_hash=public.alin_login_guard_key(p_device);
  return true;
end $$;

-- =========================================================
-- 9) خدمات الحسابات والطلبة والتتبع
-- =========================================================

create or replace function public.alin_set_library_open(p_open boolean)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_id text:=public.alin_current_account_id();
begin
  if public.alin_current_role()<>'library' then raise exception 'هذه الخدمة للمكتبة فقط'; end if;
  update public.accounts set is_open=p_open,open_status=case when p_open then 'open' else 'closed' end where id=v_id;
  return jsonb_build_object('ok',true,'is_open',p_open);
end $$;

create or replace function public.alin_teacher_approve_booklet(p_booklet_id text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_id text:=public.alin_current_account_id();
begin
  if public.alin_current_role()<>'teacher' then raise exception 'هذه الخدمة للمدرس فقط'; end if;
  update public.booklets set teacher_approved=true,teacher_approved_at=now() where id=p_booklet_id and teacher_id=v_id;
  if not found then raise exception 'الملزمة غير موجودة أو ليست مرتبطة بحسابك'; end if;
  return jsonb_build_object('ok',true,'booklet_id',p_booklet_id);
end $$;

create or replace function public.alin_track_order(p_order_number text)
returns table(order_number text,title text,status text,fulfillment_type text,delivery_area text,created_at timestamptz,updated_at timestamptz)
language sql security definer set search_path=public as $$
  select o.order_number,o.title,o.status,o.fulfillment_type,o.delivery_area,o.created_at,o.updated_at
  from public.orders o where o.order_number=btrim(p_order_number) limit 1
$$;

create or replace function public.alin_audit_write(p_action text,p_entity_type text default null,p_entity_id text default null,p_summary text default null,p_meta jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path=public,extensions as $$
declare v_id uuid;
begin
  insert into public.audit_events(actor_account_id,actor_role,action,entity_type,entity_id,summary,meta)
  values(public.alin_current_account_id(),public.alin_current_role(),left(coalesce(p_action,'action'),80),left(p_entity_type,80),left(p_entity_id,120),left(p_summary,500),coalesce(p_meta,'{}'::jsonb)) returning id into v_id;
  return v_id;
end $$;

create or replace function public.alin_admin_set_account_permissions(p_account_id text,p_permissions text[])
returns integer language plpgsql security definer set search_path=public as $$
declare v_count integer;
begin
  if not exists(
    select 1 from public.accounts a
    where a.id=public.alin_current_account_id() and a.role='admin' and a.admin_level='super_admin'
      and a.status='active' and a.deleted_at is null
  ) then raise exception 'هذه العملية للمدير الأعلى فقط'; end if;
  delete from public.account_permissions where account_id=p_account_id;
  insert into public.account_permissions(account_id,permission,granted)
  select p_account_id,lower(btrim(x)),true from unnest(coalesce(p_permissions,'{}'::text[])) x where btrim(x)<>'';
  get diagnostics v_count=row_count; return v_count;
end $$;

create or replace function public.alin_repair_auth_links(p_account_id text)
returns integer language plpgsql security definer set search_path=public as $$
begin
  if not public.alin_is_admin() then raise exception 'هذه العملية للمدير فقط'; end if;
  return 0;
end $$;

create or replace function public.alin_student_register(p_name text,p_phone text,p_pin text,p_device text)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_phone text; v_student public.student_profiles%rowtype; v_token text; v_token_hash text; v_device_hash text;
begin
  v_phone:=regexp_replace(translate(btrim(coalesce(p_phone,'')),'٠١٢٣٤٥٦٧٨٩','0123456789'),'[^0-9+]','','g');
  if length(btrim(coalesce(p_name,'')))<2 then raise exception 'اكتب اسم الطالب بصورة صحيحة'; end if;
  if v_phone !~ '^\+?[0-9]{7,15}$' then raise exception 'اكتب رقم هاتف صحيح'; end if;
  if length(coalesce(p_pin,''))<6 then raise exception 'الرمز السري يجب أن يكون 6 أحرف أو أرقام على الأقل'; end if;
  if exists(select 1 from public.student_profiles where phone=v_phone) then raise exception 'يوجد حساب بهذا الرقم'; end if;
  insert into public.student_profiles(phone,name) values(v_phone,left(btrim(p_name),120)) returning * into v_student;
  insert into public.student_accounts(student_id,pin_hash) values(v_student.id,extensions.crypt(p_pin,extensions.gen_salt('bf')));
  v_token:=replace(extensions.gen_random_uuid()::text,'-','')||replace(extensions.gen_random_uuid()::text,'-','');
  v_token_hash:=encode(extensions.digest(v_token,'sha256'),'hex');
  v_device_hash:=encode(extensions.digest(coalesce(p_device,''),'sha256'),'hex');
  insert into public.student_sessions(student_id,token_hash,device_hash,expires_at) values(v_student.id,v_token_hash,v_device_hash,now()+interval '30 days');
  return jsonb_build_object('student',jsonb_build_object('id',v_student.id,'name',v_student.name,'phone',v_student.phone,'grade',v_student.grade),'token',v_token);
end $$;

create or replace function public.alin_student_login(p_phone text,p_pin text,p_device text)
returns jsonb language plpgsql security definer set search_path=public,extensions,pg_temp as $$
declare v_phone text; v_student public.student_profiles%rowtype; v_account public.student_accounts%rowtype; v_token text; v_hash text; v_device_hash text;
begin
  v_phone:=regexp_replace(translate(btrim(coalesce(p_phone,'')),'٠١٢٣٤٥٦٧٨٩','0123456789'),'[^0-9+]','','g');
  select p.* into v_student from public.student_profiles p where p.phone=v_phone;
  if not found then raise exception 'بيانات الدخول غير صحيحة'; end if;
  select * into v_account from public.student_accounts where student_id=v_student.id for update;
  if v_account.locked_until is not null and v_account.locked_until>now() then raise exception 'تم إيقاف المحاولات مؤقتاً'; end if;
  if v_account.pin_hash<>extensions.crypt(p_pin,v_account.pin_hash) then
    update public.student_accounts set failed_attempts=failed_attempts+1,locked_until=case when failed_attempts+1>=5 then now()+interval '10 minutes' else null end where student_id=v_student.id;
    raise exception 'بيانات الدخول غير صحيحة';
  end if;
  update public.student_accounts set failed_attempts=0,locked_until=null where student_id=v_student.id;
  v_token:=replace(extensions.gen_random_uuid()::text,'-','')||replace(extensions.gen_random_uuid()::text,'-','');
  v_hash:=encode(extensions.digest(v_token,'sha256'),'hex');
  v_device_hash:=encode(extensions.digest(coalesce(p_device,''),'sha256'),'hex');
  insert into public.student_sessions(student_id,token_hash,device_hash,expires_at) values(v_student.id,v_hash,v_device_hash,now()+interval '30 days');
  return jsonb_build_object('student',jsonb_build_object('id',v_student.id,'name',v_student.name,'phone',v_student.phone,'grade',v_student.grade),'token',v_token);
end $$;

create or replace function public.alin_student_session_id(p_token text,p_device text)
returns text language sql stable security definer set search_path=public,extensions as $$
  select s.student_id from public.student_sessions s
  where s.token_hash=encode(extensions.digest(coalesce(p_token,''),'sha256'),'hex')
    and s.device_hash=encode(extensions.digest(coalesce(p_device,''),'sha256'),'hex')
    and s.revoked_at is null and s.expires_at>now() limit 1
$$;

create or replace function public.alin_student_profile(p_token text,p_device text)
returns jsonb language sql security definer set search_path=public as $$
  select jsonb_build_object('id',p.id,'name',p.name,'phone',p.phone,'grade',p.grade)
  from public.student_profiles p where p.id=public.alin_student_session_id(p_token,p_device)
$$;

create or replace function public.alin_student_update(p_token text,p_device text,p_name text,p_phone text,p_pin text default null)
returns jsonb language plpgsql security definer set search_path=public,extensions as $$
declare v_id text:=public.alin_student_session_id(p_token,p_device); v_phone text; v_student public.student_profiles%rowtype;
begin
  if v_id is null then raise exception 'جلسة الطالب منتهية'; end if;
  v_phone:=regexp_replace(translate(btrim(coalesce(p_phone,'')),'٠١٢٣٤٥٦٧٨٩','0123456789'),'[^0-9+]','','g');
  if length(btrim(coalesce(p_name,'')))<2 or v_phone !~ '^\+?[0-9]{7,15}$' then raise exception 'بيانات الطالب غير صحيحة'; end if;
  update public.student_profiles set name=left(btrim(p_name),120),phone=v_phone where id=v_id returning * into v_student;
  if p_pin is not null and p_pin<>'' then
    if length(p_pin)<6 then raise exception 'الرمز السري قصير'; end if;
    update public.student_accounts set pin_hash=extensions.crypt(p_pin,extensions.gen_salt('bf')) where student_id=v_id;
  end if;
  return jsonb_build_object('id',v_student.id,'name',v_student.name,'phone',v_student.phone,'grade',v_student.grade);
end $$;

create or replace function public.alin_student_logout(p_token text,p_device text)
returns boolean language plpgsql security definer set search_path=public,extensions as $$
begin
  update public.student_sessions set revoked_at=now()
  where token_hash=encode(extensions.digest(coalesce(p_token,''),'sha256'),'hex')
    and device_hash=encode(extensions.digest(coalesce(p_device,''),'sha256'),'hex');
  return true;
end $$;

create or replace function public.alin_student_orders(p_token text,p_device text)
returns table(order_number text,item_name text,total numeric,status text,created_at timestamptz)
language sql security definer set search_path=public as $$
  select o.order_number,o.title,o.total,o.status,o.created_at
  from public.orders o
  join public.student_profiles p on p.id=public.alin_student_session_id(p_token,p_device)
  where o.student_id=p.id or o.student_phone=p.phone
  order by o.created_at desc limit 100
$$;

-- =========================================================
-- 10) Storage: صور عامة ومستندات خاصة
-- =========================================================

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values
('alin-files','alin-files',true,5242880,array['image/jpeg','image/png','image/webp']),
('alin-private','alin-private',false,26214400,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy alin_public_media_read on storage.objects for select to anon,authenticated using (bucket_id='alin-files');
create policy alin_public_media_upload on storage.objects for insert to authenticated with check (
  bucket_id='alin-files' and public.alin_current_role() in ('admin','teacher')
);
create policy alin_public_media_admin_change on storage.objects for update to authenticated using (bucket_id='alin-files' and public.alin_is_admin()) with check (bucket_id='alin-files' and public.alin_is_admin());
create policy alin_public_media_admin_delete on storage.objects for delete to authenticated using (bucket_id='alin-files' and public.alin_is_admin());

create policy alin_private_upload on storage.objects for insert to authenticated with check (
  bucket_id='alin-private' and (
    public.alin_is_admin()
    or (
      public.alin_current_role()='teacher'
      and (storage.foldername(name))[1]='teacher-requests'
      and (storage.foldername(name))[2]=public.alin_current_account_id()
    )
  )
);

create policy alin_private_read on storage.objects for select to authenticated using (
  bucket_id='alin-private' and (
    public.alin_is_admin()
    or (
      public.alin_current_role()='teacher' and (
        ((storage.foldername(name))[1]='teacher-requests' and (storage.foldername(name))[2]=public.alin_current_account_id())
        or ((storage.foldername(name))[1]='booklets' and exists(select 1 from public.booklets b where b.id=(storage.foldername(name))[2] and b.teacher_id=public.alin_current_account_id()))
      )
    )
    or (
      public.alin_current_role()='library'
      and (storage.foldername(name))[1]='booklets'
      and exists(
        select 1 from public.orders o
        where o.kind='booklet' and o.item_id=(storage.foldername(name))[2]
          and public.alin_current_account_id() in (o.library_id,o.pickup_library_id)
          and o.status in ('new','pending_admin','processing','printing','ready')
      )
    )
  )
);
create policy alin_private_admin_change on storage.objects for update to authenticated using (bucket_id='alin-private' and public.alin_is_admin()) with check (bucket_id='alin-private' and public.alin_is_admin());
create policy alin_private_admin_delete on storage.objects for delete to authenticated using (bucket_id='alin-private' and public.alin_is_admin());

-- =========================================================
-- 11) الصلاحيات Grants
-- =========================================================

grant usage on schema public to anon,authenticated;
grant select on public.alin_public_accounts,public.alin_public_settings,public.alin_public_booklets to anon,authenticated;
grant select on public.alin_library_booklets,public.alin_teacher_orders to authenticated;
grant select on public.delivery_areas,public.categories,public.products,public.banners,public.coupons,public.bundles,public.bundle_items,public.notifications to anon,authenticated;
grant select on public.booklets to authenticated;
grant insert on public.product_reviews,public.stock_alerts,public.group_orders,public.group_order_members to anon,authenticated;
revoke select on public.group_orders,public.group_order_members from anon,authenticated;
grant select(id,code,status,created_at) on public.group_orders to anon,authenticated;

grant select,insert,update,delete on all tables in schema public to authenticated;
revoke select on public.group_order_members from authenticated;
revoke insert,update,delete on public.orders,public.ledger,public.settlements,public.audit_events,public.checkout_requests,public.student_accounts,public.student_sessions from anon,authenticated;
revoke select on public.student_accounts,public.student_sessions,public.auth_login_guard,public.checkout_requests from anon,authenticated;
revoke all on public.accounts,public.account_permissions,public.couriers,public.courier_areas,public.teacher_requests,public.teacher_request_versions,public.orders,public.order_timeline,public.permits,public.ledger,public.settlements,public.withdrawals,public.notifications,public.notification_reads,public.audit_events,public.backup_logs,public.system_health_logs from anon;

-- لا تبقى أي دالة جديدة قابلة للاستدعاء تلقائياً. نمنح فقط واجهات RPC المقصودة.
revoke execute on all functions in schema public from public,anon,authenticated;

grant execute on function public.alin_current_account_id() to anon,authenticated;
grant execute on function public.alin_current_role() to anon,authenticated;
grant execute on function public.alin_is_admin() to anon,authenticated;
grant execute on function public.alin_is_finance_staff() to authenticated;
grant execute on function public.alin_has_permission(text) to authenticated;

grant execute on function public.alin_login_guard_check(text,text) to service_role;
grant execute on function public.alin_login_guard_fail(text,text) to service_role;
grant execute on function public.alin_login_guard_success(text,text) to service_role;

grant execute on function public.alin_create_store_orders_guarded(jsonb,jsonb,jsonb,text,text,text) to anon,authenticated;
grant execute on function public.alin_track_order(text) to anon,authenticated;
grant execute on function public.alin_student_register(text,text,text,text) to anon,authenticated;
grant execute on function public.alin_student_login(text,text,text) to anon,authenticated;
grant execute on function public.alin_student_profile(text,text) to anon,authenticated;
grant execute on function public.alin_student_update(text,text,text,text,text) to anon,authenticated;
grant execute on function public.alin_student_logout(text,text) to anon,authenticated;
grant execute on function public.alin_student_orders(text,text) to anon,authenticated;

grant execute on function public.alin_library_set_order_status(text,text,text) to authenticated;
grant execute on function public.alin_order_transition_atomic(text,text,text) to authenticated;
grant execute on function public.alin_admin_assign_order(text,text,text) to authenticated;
grant execute on function public.alin_set_library_open(boolean) to authenticated;
grant execute on function public.alin_teacher_approve_booklet(text) to authenticated;
grant execute on function public.alin_audit_write(text,text,text,text,jsonb) to authenticated;
grant execute on function public.alin_admin_set_account_permissions(text,text[]) to authenticated;
grant execute on function public.alin_repair_auth_links(text) to authenticated;
grant execute on function public.alin_finance_record_settlement(text,text,numeric,text,text) to authenticated;
grant execute on function public.alin_finance_reverse_settlement(text,text,text) to authenticated;
grant execute on function public.alin_finance_party_balance(text,text) to authenticated;


-- =========================================================
-- 12) الإعدادات الأولية
-- =========================================================

insert into public.settings(key,value,version) values
('alin_db_version','4.1.0-clean','4.1.0'),
('courier_workflow_version','4.1.0','4.1.0'),
('platform_name','منصة آلين','4.0.0'),
('platform_phone','','4.0.0'),
('delivery_enabled','true','4.0.0'),
('delivery_fee','2000','4.0.0'),
('teacher_profit_percent','50','4.0.0'),
('library_profit_percent','30','4.0.0'),
('delegate_profit_percent','30','4.0.0'),
('admin_profit_percent','20','4.0.0'),
('storeType','booklet','4.0.0');

insert into public.categories(id,type,name,status,sort_order) values
('CAT-BOOKLETS','booklet','ملازم','active',1),
('CAT-STATIONERY','stationery','قرطاسية','active',2),
('CAT-GIFTS','gift','هدايا','active',3);


-- منطقة تجريبية أولية حتى يعمل اختبار التوصيل مباشرة. يمكن تعديلها أو حذفها من لوحة المدير.
insert into public.delivery_areas(id,name,city,delivery_fee,landmark,status,active,sort_order) values
('AREA-KIRKUK','كركوك','كركوك',2000,'تُعدّل من لوحة المدير','active',true,1);

commit;

-- فحص نهائي للإنشاء النظيف
select
  to_regclass('public.accounts') is not null as accounts_ready,
  to_regclass('public.orders') is not null as orders_ready,
  to_regclass('public.ledger') is not null as ledger_ready,
  to_regclass('public.settlements') is not null as settlements_ready,
  to_regprocedure('public.alin_create_store_orders_guarded(jsonb,jsonb,jsonb,text,text,text)') is not null as checkout_ready,
  to_regprocedure('public.alin_order_transition_atomic(text,text,text)') is not null as transition_ready,
  to_regprocedure('public.alin_upsert_order_finance_atomic(text)') is not null as finance_ready,
  (select count(*) from information_schema.columns where table_schema='public' and table_name='orders') as orders_columns,
  (select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE') as base_tables;
