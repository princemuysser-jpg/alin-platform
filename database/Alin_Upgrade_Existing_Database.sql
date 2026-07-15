-- منصة آلين: ترقية قاعدة موجودة بدون حذف البيانات
BEGIN;

-- ===== Alin_RC5_1_Database_Migration.sql =====
-- ============================================================
-- منصة آلين RC5.1 - أداة ترقية قاعدة البيانات القديمة
-- الغرض: ترقية قاعدة موجودة بدون حذف البيانات
-- قابل لإعادة التنفيذ قدر الإمكان
-- مهم: خذ نسخة احتياطية قبل التنفيذ
-- ============================================================

begin;
create extension if not exists pgcrypto;

create or replace function public.alin_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create or replace function public.alin_safe_numeric(v text, fallback numeric default 0)
returns numeric language plpgsql immutable as $$
begin
  if v is null or btrim(v)='' then return fallback; end if;
  return v::numeric;
exception when others then return fallback;
end $$;

-- توثيق بداية الترقية
create table if not exists public.alin_migration_log(
  id bigserial primary key,
  migration_name text not null,
  status text not null,
  details jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
insert into public.alin_migration_log(migration_name,status,details)
values('RC5.1_DATABASE_COMPATIBILITY','started',jsonb_build_object('started_at',now()));

-- ============================================================
-- معالجة جدول settings القديم والجديد بدون كسر نظام key/value القديم
-- ============================================================
create table if not exists public.settings (
  key text primary key,
  value text
);

alter table public.settings add column if not exists key text;
alter table public.settings add column if not exists value text;
alter table public.settings add column if not exists id text;
alter table public.settings add column if not exists platform_name text default 'منصة آلين';
alter table public.settings add column if not exists version text default 'RC5.1';
alter table public.settings add column if not exists data jsonb default '{}'::jsonb;
alter table public.settings add column if not exists primary_color text;
alter table public.settings add column if not exists secondary_color text;
alter table public.settings add column if not exists background_color text;
alter table public.settings add column if not exists card_color text;
alter table public.settings add column if not exists logo_path text;
alter table public.settings add column if not exists dark_logo_path text;
alter table public.settings add column if not exists app_icon_path text;
alter table public.settings add column if not exists font_family text;
alter table public.settings add column if not exists orders_enabled boolean default true;
alter table public.settings add column if not exists orders_disabled_reason text;
alter table public.settings add column if not exists platform_percent numeric default 25;
alter table public.settings add column if not exists teacher_percent numeric default 40;
alter table public.settings add column if not exists library_percent numeric default 35;
alter table public.settings add column if not exists courier_fee numeric default 0;
alter table public.settings add column if not exists debt_alert_limit numeric default 0;
alter table public.settings add column if not exists whatsapp text;
alter table public.settings add column if not exists contact_text text;
alter table public.settings add column if not exists created_at timestamptz default now();
alter table public.settings add column if not exists updated_at timestamptz default now();
create unique index if not exists settings_singleton_id_idx on public.settings(id) where id is not null;
create unique index if not exists settings_key_unique_idx on public.settings(key) where key is not null;

-- إنشاء صف main مع الحفاظ على عمودي key/value إذا كانا مستخدمين
update public.settings set id='main' where key='__main__' and id is null;
insert into public.settings(key,value,id,platform_name,version,data)
select '__main__','{}','main','منصة آلين','RC5.1','{}'::jsonb
where not exists(select 1 from public.settings where id='main' or key='__main__');

-- نسخ إعدادات key/value القديمة إلى JSON داخل صف main
update public.settings s
set data = coalesce(s.data,'{}'::jsonb) || coalesce((
  select jsonb_object_agg(x.key, x.value)
  from public.settings x
  where x.key is not null and x.key <> '__main__'
),'{}'::jsonb)
where s.id='main';

-- مزامنة أهم المفاتيح القديمة مع الأعمدة الجديدة
update public.settings s set
 platform_name=coalesce((select value from public.settings where key='platform_name' limit 1),s.platform_name),
 whatsapp=coalesce((select value from public.settings where key='whatsapp' limit 1),(select value from public.settings where key='platform_phone' limit 1),s.whatsapp),
 platform_percent=public.alin_safe_numeric((select value from public.settings where key in ('platform_percent','admin_profit_percent') order by key desc limit 1),s.platform_percent),
 teacher_percent=public.alin_safe_numeric((select value from public.settings where key in ('teacher_percent','teacher_profit_percent') order by key desc limit 1),s.teacher_percent),
 library_percent=public.alin_safe_numeric((select value from public.settings where key in ('library_percent','library_profit_percent') order by key desc limit 1),s.library_percent),
 courier_fee=public.alin_safe_numeric((select value from public.settings where key in ('courier_fee','delegate_profit_percent') order by key desc limit 1),s.courier_fee)
where s.id='main';


-- جدول accounts
create table if not exists public.accounts (

  id text primary key,
  role text not null,
  name text not null,
  username text unique,
  password_hash text,
  email text,
  phone text,
  area text,
  landmark text,
  address text,
  gps_lat numeric,
  gps_lng numeric,
  image_path text,
  specialty text,
  bio text,
  status text default 'active',
  permissions jsonb default '{}'::jsonb,
  auth_user_id uuid unique,
  created_by text,
  updated_by text,
  last_login_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

-- جدول delivery_areas
create table if not exists public.delivery_areas (

  id text primary key,
  name text not null unique,
  city text default 'كركوك',
  status text default 'active',
  delivery_fee numeric default 0,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- جدول couriers
create table if not exists public.couriers (

  id text primary key,
  account_id text,
  name text not null,
  username text unique,
  password_hash text,
  phone text,
  status text default 'available',
  areas text[] default '{}',
  current_orders integer default 0,
  cash_collected numeric default 0,
  earnings numeric default 0,
  debt numeric default 0,
  auth_user_id uuid unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

-- جدول courier_areas
create table if not exists public.courier_areas (

  courier_id text not null,
  area_id text not null,
  created_at timestamptz default now(),
  primary key(courier_id,area_id)
);

-- جدول categories
create table if not exists public.categories (

  id text primary key,
  type text not null,
  name text not null,
  status text default 'active',
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- جدول booklets
create table if not exists public.booklets (

  id text primary key,
  title text not null,
  teacher_id text,
  subject text,
  grade text,
  semester text,
  edition text,
  price numeric default 0,
  teacher_percent numeric,
  cover_path text,
  teacher_image_path text,
  teacher_phone text,
  file_path text,
  file_name text,
  source_word_path text,
  source_word_name text,
  preview_pdf_path text,
  status text default 'draft',
  publish_status text default 'draft',
  published boolean default false,
  is_published boolean default false,
  hidden boolean default false,
  teacher_approved boolean default false,
  store_pdf_visible boolean default false,
  library_pdf_print boolean default true,
  admin_notes text,
  revision integer default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

-- جدول teacher_requests
create table if not exists public.teacher_requests (

  id text primary key,
  teacher_id text,
  title text,
  subject text,
  grade text,
  semester text,
  edition text,
  proposed_price numeric default 0,
  source_file_path text,
  source_file_name text,
  source_file_type text default 'docx',
  cover_path text,
  notes text,
  admin_notes text,
  status text default 'submitted',
  review_status text default 'submitted',
  final_booklet_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- جدول teacher_request_versions
create table if not exists public.teacher_request_versions (

  id text primary key,
  request_id text not null,
  teacher_id text,
  version_no integer default 1,
  file_path text,
  file_name text,
  note text,
  created_at timestamptz default now()
);

-- جدول products
create table if not exists public.products (

  id text primary key,
  name text not null,
  details text,
  description text,
  price numeric default 0,
  sale_price numeric,
  stock numeric default 0,
  low_stock_limit numeric default 5,
  category text default 'stationery',
  category_id text,
  type text default 'stationery',
  image_path text,
  image_url text,
  images jsonb default '[]'::jsonb,
  file_path text,
  status text default 'published',
  published boolean default true,
  hidden boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

-- جدول orders
create table if not exists public.orders (

  id text primary key,
  order_number text unique,
  tracking_code text unique,
  kind text,
  item_id text,
  title text,
  student_id text,
  student_name text,
  student_phone text,
  qty numeric default 1,
  unit_price numeric default 0,
  total numeric default 0,
  discount numeric default 0,
  coupon_code text,
  payment_method text,
  payment_status text default 'payment_pending',
  fulfillment_type text default 'library',
  library_id text,
  pickup_library_id text,
  courier_id text,
  delegate_id text,
  delivery_area_id text,
  delivery_area text,
  delivery_address text,
  delivery_landmark text,
  delivery_lat numeric,
  delivery_lng numeric,
  delivery_accuracy numeric,
  delivery_map_url text,
  courier_assignment_status text,
  courier_assigned_at timestamptz,
  courier_accept_deadline timestamptz,
  courier_accepted_at timestamptz,
  courier_rejected_at timestamptz,
  courier_reject_reason text,
  status text default 'new',
  status_history jsonb default '[]'::jsonb,
  admin_notes text,
  cancellation_reason text,
  cash_received boolean default false,
  cash_received_at timestamptz,
  settlement_done boolean default false,
  settlement_at timestamptz,
  platform_profit numeric default 0,
  teacher_profit numeric default 0,
  library_profit numeric default 0,
  delegate_profit numeric default 0,
  courier_profit numeric default 0,
  settlement_party text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  completed_at timestamptz,
  cancelled_at timestamptz
);

-- جدول order_items
create table if not exists public.order_items (

  id text primary key,
  order_id text not null,
  kind text,
  item_id text,
  title text,
  qty numeric default 1,
  unit_price numeric default 0,
  total numeric default 0,
  created_at timestamptz default now()
);

-- جدول order_timeline
create table if not exists public.order_timeline (

  id text primary key,
  order_id text not null,
  event_type text,
  status text,
  title text,
  details text,
  actor_id text,
  actor_role text,
  actor_name text,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- جدول permits
create table if not exists public.permits (

  id text primary key,
  order_id text,
  booklet_id text,
  library_id text,
  qty numeric default 1,
  used numeric default 0,
  status text default 'active',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- جدول ledger
create table if not exists public.ledger (

  id text primary key,
  order_id text,
  order_number text,
  alin numeric default 0,
  admin numeric default 0,
  teacher numeric default 0,
  teacher_id text,
  library numeric default 0,
  library_id text,
  delegate numeric default 0,
  courier numeric default 0,
  courier_id text,
  settlement_status text default 'unsettled',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- جدول financial_entries
create table if not exists public.financial_entries (

  id text primary key,
  order_id text,
  order_number text,
  entry_type text,
  kind text,
  item_id text,
  title text,
  qty numeric default 1,
  gross numeric default 0,
  platform_amount numeric default 0,
  teacher_amount numeric default 0,
  library_amount numeric default 0,
  courier_amount numeric default 0,
  teacher_id text,
  library_id text,
  courier_id text,
  distribution_mode text,
  distribution_snapshot jsonb default '{}'::jsonb,
  note text,
  reversed boolean default false,
  reversed_at timestamptz,
  created_at timestamptz default now()
);

-- جدول financial_payouts
create table if not exists public.financial_payouts (

  id text primary key,
  voucher_number text unique,
  party_role text,
  party_id text,
  party_name text,
  amount numeric default 0,
  payment_method text,
  status text default 'paid',
  note text,
  created_by text,
  created_at timestamptz default now(),
  reversed_at timestamptz
);

-- جدول withdrawals
create table if not exists public.withdrawals (

  id text primary key,
  role text,
  account_id text,
  amount numeric default 0,
  status text default 'pending',
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- جدول library_settlements
create table if not exists public.library_settlements (

  id text primary key,
  order_id text,
  order_number text,
  receipt_number text,
  library_id text,
  amount numeric default 0,
  profit numeric default 0,
  type text,
  status text default 'received',
  payment_method text,
  note text,
  created_by text,
  created_at timestamptz default now()
);

-- جدول teacher_settlements
create table if not exists public.teacher_settlements (

  id text primary key,
  order_id text,
  order_number text,
  teacher_id text,
  amount numeric default 0,
  profit numeric default 0,
  type text,
  status text default 'paid',
  note text,
  created_at timestamptz default now()
);

-- جدول delegate_settlements
create table if not exists public.delegate_settlements (

  id text primary key,
  order_id text,
  order_number text,
  delegate_id text,
  courier_id text,
  amount numeric default 0,
  profit numeric default 0,
  type text,
  status text default 'paid',
  note text,
  created_at timestamptz default now()
);

-- جدول admin_settlements
create table if not exists public.admin_settlements (

  id text primary key,
  order_id text,
  order_number text,
  amount numeric default 0,
  profit numeric default 0,
  type text,
  party text default 'admin',
  note text,
  created_at timestamptz default now()
);

-- جدول notifications
create table if not exists public.notifications (

  id text primary key,
  target_role text default 'all',
  target_id text default '',
  title text,
  message text,
  priority text default 'normal',
  status text default 'active',
  read_at timestamptz,
  from_user text,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- جدول banners
create table if not exists public.banners (

  id text primary key,
  title text,
  text text,
  image_path text,
  link_url text,
  target text,
  active boolean default true,
  start_date timestamptz,
  end_date timestamptz,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- جدول coupons
create table if not exists public.coupons (

  id text primary key,
  code text unique not null,
  discount_type text default 'percent',
  discount_value numeric default 0,
  max_uses integer default 0,
  used_count integer default 0,
  applies_to text default 'all',
  status text default 'active',
  starts_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- جدول student_profiles
create table if not exists public.student_profiles (

  id text primary key,
  name text,
  phone text,
  address text,
  points numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- جدول product_reviews
create table if not exists public.product_reviews (

  id text primary key,
  kind text,
  item_id text,
  student_id text,
  rating numeric,
  comment text,
  status text default 'published',
  created_at timestamptz default now()
);

-- جدول stock_alerts
create table if not exists public.stock_alerts (

  id text primary key,
  kind text,
  item_id text,
  student_name text,
  student_phone text,
  status text default 'waiting',
  created_at timestamptz default now()
);

-- جدول bundles
create table if not exists public.bundles (

  id text primary key,
  name text,
  description text,
  price numeric default 0,
  image_path text,
  status text default 'active',
  created_at timestamptz default now()
);

-- جدول bundle_items
create table if not exists public.bundle_items (

  id text primary key,
  bundle_id text,
  kind text,
  item_id text,
  quantity numeric default 1,
  created_at timestamptz default now()
);

-- جدول audit
create table if not exists public.audit (

  id text primary key,
  kind text,
  text text,
  user_id text,
  user_role text,
  user_name text,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- جدول security_audit_logs
create table if not exists public.security_audit_logs (

  id uuid primary key default gen_random_uuid(),
  event_type text,
  user_id uuid,
  account_id text,
  role text,
  success boolean default true,
  ip_hint text,
  user_agent text,
  details jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- جدول security_operation_log
create table if not exists public.security_operation_log (

  id uuid primary key default gen_random_uuid(),
  operation text,
  actor_id text,
  actor_role text,
  target_type text,
  target_id text,
  success boolean default true,
  details jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- جدول backup_logs
create table if not exists public.backup_logs (

  id text primary key,
  file_name text,
  storage_path text,
  size_bytes bigint default 0,
  scope jsonb default '{}'::jsonb,
  status text default 'completed',
  created_by text,
  created_at timestamptz default now()
);

-- جدول system_health_logs
create table if not exists public.system_health_logs (

  id text primary key,
  service text,
  status text,
  message text,
  details jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- ============================================================
-- إضافة الأعمدة الناقصة للجداول الموجودة
-- ============================================================
alter table public.accounts add column if not exists id text;
alter table public.accounts add column if not exists role text;
alter table public.accounts add column if not exists name text;
alter table public.accounts add column if not exists username text;
alter table public.accounts add column if not exists password_hash text;
alter table public.accounts add column if not exists email text;
alter table public.accounts add column if not exists phone text;
alter table public.accounts add column if not exists area text;
alter table public.accounts add column if not exists landmark text;
alter table public.accounts add column if not exists address text;
alter table public.accounts add column if not exists gps_lat numeric;
alter table public.accounts add column if not exists gps_lng numeric;
alter table public.accounts add column if not exists image_path text;
alter table public.accounts add column if not exists specialty text;
alter table public.accounts add column if not exists bio text;
alter table public.accounts add column if not exists status text default 'active';
alter table public.accounts add column if not exists permissions jsonb default '{}'::jsonb;
alter table public.accounts add column if not exists auth_user_id uuid;
alter table public.accounts add column if not exists created_by text;
alter table public.accounts add column if not exists updated_by text;
alter table public.accounts add column if not exists last_login_at timestamptz;
alter table public.accounts add column if not exists created_at timestamptz default now();
alter table public.accounts add column if not exists updated_at timestamptz default now();
alter table public.accounts add column if not exists deleted_at timestamptz;
alter table public.delivery_areas add column if not exists id text;
alter table public.delivery_areas add column if not exists name text;
alter table public.delivery_areas add column if not exists city text default 'كركوك';
alter table public.delivery_areas add column if not exists status text default 'active';
alter table public.delivery_areas add column if not exists delivery_fee numeric default 0;
alter table public.delivery_areas add column if not exists sort_order integer default 0;
alter table public.delivery_areas add column if not exists created_at timestamptz default now();
alter table public.delivery_areas add column if not exists updated_at timestamptz default now();
alter table public.couriers add column if not exists id text;
alter table public.couriers add column if not exists account_id text;
alter table public.couriers add column if not exists name text;
alter table public.couriers add column if not exists username text;
alter table public.couriers add column if not exists password_hash text;
alter table public.couriers add column if not exists phone text;
alter table public.couriers add column if not exists status text default 'available';
alter table public.couriers add column if not exists areas text[] default '{}';
alter table public.couriers add column if not exists current_orders integer default 0;
alter table public.couriers add column if not exists cash_collected numeric default 0;
alter table public.couriers add column if not exists earnings numeric default 0;
alter table public.couriers add column if not exists debt numeric default 0;
alter table public.couriers add column if not exists auth_user_id uuid;
alter table public.couriers add column if not exists created_at timestamptz default now();
alter table public.couriers add column if not exists updated_at timestamptz default now();
alter table public.couriers add column if not exists deleted_at timestamptz;
alter table public.courier_areas add column if not exists courier_id text;
alter table public.courier_areas add column if not exists area_id text;
alter table public.courier_areas add column if not exists created_at timestamptz default now();
alter table public.categories add column if not exists id text;
alter table public.categories add column if not exists type text;
alter table public.categories add column if not exists name text;
alter table public.categories add column if not exists status text default 'active';
alter table public.categories add column if not exists sort_order integer default 0;
alter table public.categories add column if not exists created_at timestamptz default now();
alter table public.categories add column if not exists updated_at timestamptz default now();
alter table public.booklets add column if not exists id text;
alter table public.booklets add column if not exists title text;
alter table public.booklets add column if not exists teacher_id text;
alter table public.booklets add column if not exists subject text;
alter table public.booklets add column if not exists grade text;
alter table public.booklets add column if not exists semester text;
alter table public.booklets add column if not exists edition text;
alter table public.booklets add column if not exists price numeric default 0;
alter table public.booklets add column if not exists teacher_percent numeric;
alter table public.booklets add column if not exists cover_path text;
alter table public.booklets add column if not exists teacher_image_path text;
alter table public.booklets add column if not exists teacher_phone text;
alter table public.booklets add column if not exists file_path text;
alter table public.booklets add column if not exists file_name text;
alter table public.booklets add column if not exists source_word_path text;
alter table public.booklets add column if not exists source_word_name text;
alter table public.booklets add column if not exists preview_pdf_path text;
alter table public.booklets add column if not exists status text default 'draft';
alter table public.booklets add column if not exists publish_status text default 'draft';
alter table public.booklets add column if not exists published boolean default false;
alter table public.booklets add column if not exists is_published boolean default false;
alter table public.booklets add column if not exists hidden boolean default false;
alter table public.booklets add column if not exists teacher_approved boolean default false;
alter table public.booklets add column if not exists store_pdf_visible boolean default false;
alter table public.booklets add column if not exists library_pdf_print boolean default true;
alter table public.booklets add column if not exists admin_notes text;
alter table public.booklets add column if not exists revision integer default 1;
alter table public.booklets add column if not exists created_at timestamptz default now();
alter table public.booklets add column if not exists updated_at timestamptz default now();
alter table public.booklets add column if not exists deleted_at timestamptz;
alter table public.teacher_requests add column if not exists id text;
alter table public.teacher_requests add column if not exists teacher_id text;
alter table public.teacher_requests add column if not exists title text;
alter table public.teacher_requests add column if not exists subject text;
alter table public.teacher_requests add column if not exists grade text;
alter table public.teacher_requests add column if not exists semester text;
alter table public.teacher_requests add column if not exists edition text;
alter table public.teacher_requests add column if not exists proposed_price numeric default 0;
alter table public.teacher_requests add column if not exists source_file_path text;
alter table public.teacher_requests add column if not exists source_file_name text;
alter table public.teacher_requests add column if not exists source_file_type text default 'docx';
alter table public.teacher_requests add column if not exists cover_path text;
alter table public.teacher_requests add column if not exists notes text;
alter table public.teacher_requests add column if not exists admin_notes text;
alter table public.teacher_requests add column if not exists status text default 'submitted';
alter table public.teacher_requests add column if not exists review_status text default 'submitted';
alter table public.teacher_requests add column if not exists final_booklet_id text;
alter table public.teacher_requests add column if not exists created_at timestamptz default now();
alter table public.teacher_requests add column if not exists updated_at timestamptz default now();
alter table public.teacher_request_versions add column if not exists id text;
alter table public.teacher_request_versions add column if not exists request_id text;
alter table public.teacher_request_versions add column if not exists teacher_id text;
alter table public.teacher_request_versions add column if not exists version_no integer default 1;
alter table public.teacher_request_versions add column if not exists file_path text;
alter table public.teacher_request_versions add column if not exists file_name text;
alter table public.teacher_request_versions add column if not exists note text;
alter table public.teacher_request_versions add column if not exists created_at timestamptz default now();
alter table public.products add column if not exists id text;
alter table public.products add column if not exists name text;
alter table public.products add column if not exists details text;
alter table public.products add column if not exists description text;
alter table public.products add column if not exists price numeric default 0;
alter table public.products add column if not exists sale_price numeric;
alter table public.products add column if not exists stock numeric default 0;
alter table public.products add column if not exists low_stock_limit numeric default 5;
alter table public.products add column if not exists category text default 'stationery';
alter table public.products add column if not exists category_id text;
alter table public.products add column if not exists type text default 'stationery';
alter table public.products add column if not exists image_path text;
alter table public.products add column if not exists image_url text;
alter table public.products add column if not exists images jsonb default '[]'::jsonb;
alter table public.products add column if not exists file_path text;
alter table public.products add column if not exists status text default 'published';
alter table public.products add column if not exists published boolean default true;
alter table public.products add column if not exists hidden boolean default false;
alter table public.products add column if not exists created_at timestamptz default now();
alter table public.products add column if not exists updated_at timestamptz default now();
alter table public.products add column if not exists deleted_at timestamptz;
alter table public.orders add column if not exists id text;
alter table public.orders add column if not exists order_number text;
alter table public.orders add column if not exists tracking_code text;
alter table public.orders add column if not exists kind text;
alter table public.orders add column if not exists item_id text;
alter table public.orders add column if not exists title text;
alter table public.orders add column if not exists student_id text;
alter table public.orders add column if not exists student_name text;
alter table public.orders add column if not exists student_phone text;
alter table public.orders add column if not exists qty numeric default 1;
alter table public.orders add column if not exists unit_price numeric default 0;
alter table public.orders add column if not exists total numeric default 0;
alter table public.orders add column if not exists discount numeric default 0;
alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists payment_method text;
alter table public.orders add column if not exists payment_status text default 'payment_pending';
alter table public.orders add column if not exists fulfillment_type text default 'library';
alter table public.orders add column if not exists library_id text;
alter table public.orders add column if not exists pickup_library_id text;
alter table public.orders add column if not exists courier_id text;
alter table public.orders add column if not exists delegate_id text;
alter table public.orders add column if not exists delivery_area_id text;
alter table public.orders add column if not exists delivery_area text;
alter table public.orders add column if not exists delivery_address text;
alter table public.orders add column if not exists delivery_landmark text;
alter table public.orders add column if not exists delivery_lat numeric;
alter table public.orders add column if not exists delivery_lng numeric;
alter table public.orders add column if not exists delivery_accuracy numeric;
alter table public.orders add column if not exists delivery_map_url text;
alter table public.orders add column if not exists courier_assignment_status text;
alter table public.orders add column if not exists courier_assigned_at timestamptz;
alter table public.orders add column if not exists courier_accept_deadline timestamptz;
alter table public.orders add column if not exists courier_accepted_at timestamptz;
alter table public.orders add column if not exists courier_rejected_at timestamptz;
alter table public.orders add column if not exists courier_reject_reason text;
alter table public.orders add column if not exists status text default 'new';
alter table public.orders add column if not exists status_history jsonb default '[]'::jsonb;
alter table public.orders add column if not exists admin_notes text;
alter table public.orders add column if not exists cancellation_reason text;
alter table public.orders add column if not exists cash_received boolean default false;
alter table public.orders add column if not exists cash_received_at timestamptz;
alter table public.orders add column if not exists settlement_done boolean default false;
alter table public.orders add column if not exists settlement_at timestamptz;
alter table public.orders add column if not exists platform_profit numeric default 0;
alter table public.orders add column if not exists teacher_profit numeric default 0;
alter table public.orders add column if not exists library_profit numeric default 0;
alter table public.orders add column if not exists delegate_profit numeric default 0;
alter table public.orders add column if not exists courier_profit numeric default 0;
alter table public.orders add column if not exists settlement_party text;
alter table public.orders add column if not exists created_at timestamptz default now();
alter table public.orders add column if not exists updated_at timestamptz default now();
alter table public.orders add column if not exists completed_at timestamptz;
alter table public.orders add column if not exists cancelled_at timestamptz;
alter table public.order_items add column if not exists id text;
alter table public.order_items add column if not exists order_id text;
alter table public.order_items add column if not exists kind text;
alter table public.order_items add column if not exists item_id text;
alter table public.order_items add column if not exists title text;
alter table public.order_items add column if not exists qty numeric default 1;
alter table public.order_items add column if not exists unit_price numeric default 0;
alter table public.order_items add column if not exists total numeric default 0;
alter table public.order_items add column if not exists created_at timestamptz default now();
alter table public.order_timeline add column if not exists id text;
alter table public.order_timeline add column if not exists order_id text;
alter table public.order_timeline add column if not exists event_type text;
alter table public.order_timeline add column if not exists status text;
alter table public.order_timeline add column if not exists title text;
alter table public.order_timeline add column if not exists details text;
alter table public.order_timeline add column if not exists actor_id text;
alter table public.order_timeline add column if not exists actor_role text;
alter table public.order_timeline add column if not exists actor_name text;
alter table public.order_timeline add column if not exists meta jsonb default '{}'::jsonb;
alter table public.order_timeline add column if not exists created_at timestamptz default now();
alter table public.permits add column if not exists id text;
alter table public.permits add column if not exists order_id text;
alter table public.permits add column if not exists booklet_id text;
alter table public.permits add column if not exists library_id text;
alter table public.permits add column if not exists qty numeric default 1;
alter table public.permits add column if not exists used numeric default 0;
alter table public.permits add column if not exists status text default 'active';
alter table public.permits add column if not exists created_at timestamptz default now();
alter table public.permits add column if not exists updated_at timestamptz default now();
alter table public.ledger add column if not exists id text;
alter table public.ledger add column if not exists order_id text;
alter table public.ledger add column if not exists order_number text;
alter table public.ledger add column if not exists alin numeric default 0;
alter table public.ledger add column if not exists admin numeric default 0;
alter table public.ledger add column if not exists teacher numeric default 0;
alter table public.ledger add column if not exists teacher_id text;
alter table public.ledger add column if not exists library numeric default 0;
alter table public.ledger add column if not exists library_id text;
alter table public.ledger add column if not exists delegate numeric default 0;
alter table public.ledger add column if not exists courier numeric default 0;
alter table public.ledger add column if not exists courier_id text;
alter table public.ledger add column if not exists settlement_status text default 'unsettled';
alter table public.ledger add column if not exists created_at timestamptz default now();
alter table public.ledger add column if not exists updated_at timestamptz default now();
alter table public.financial_entries add column if not exists id text;
alter table public.financial_entries add column if not exists order_id text;
alter table public.financial_entries add column if not exists order_number text;
alter table public.financial_entries add column if not exists entry_type text;
alter table public.financial_entries add column if not exists kind text;
alter table public.financial_entries add column if not exists item_id text;
alter table public.financial_entries add column if not exists title text;
alter table public.financial_entries add column if not exists qty numeric default 1;
alter table public.financial_entries add column if not exists gross numeric default 0;
alter table public.financial_entries add column if not exists platform_amount numeric default 0;
alter table public.financial_entries add column if not exists teacher_amount numeric default 0;
alter table public.financial_entries add column if not exists library_amount numeric default 0;
alter table public.financial_entries add column if not exists courier_amount numeric default 0;
alter table public.financial_entries add column if not exists teacher_id text;
alter table public.financial_entries add column if not exists library_id text;
alter table public.financial_entries add column if not exists courier_id text;
alter table public.financial_entries add column if not exists distribution_mode text;
alter table public.financial_entries add column if not exists distribution_snapshot jsonb default '{}'::jsonb;
alter table public.financial_entries add column if not exists note text;
alter table public.financial_entries add column if not exists reversed boolean default false;
alter table public.financial_entries add column if not exists reversed_at timestamptz;
alter table public.financial_entries add column if not exists created_at timestamptz default now();
alter table public.financial_payouts add column if not exists id text;
alter table public.financial_payouts add column if not exists voucher_number text;
alter table public.financial_payouts add column if not exists party_role text;
alter table public.financial_payouts add column if not exists party_id text;
alter table public.financial_payouts add column if not exists party_name text;
alter table public.financial_payouts add column if not exists amount numeric default 0;
alter table public.financial_payouts add column if not exists payment_method text;
alter table public.financial_payouts add column if not exists status text default 'paid';
alter table public.financial_payouts add column if not exists note text;
alter table public.financial_payouts add column if not exists created_by text;
alter table public.financial_payouts add column if not exists created_at timestamptz default now();
alter table public.financial_payouts add column if not exists reversed_at timestamptz;
alter table public.withdrawals add column if not exists id text;
alter table public.withdrawals add column if not exists role text;
alter table public.withdrawals add column if not exists account_id text;
alter table public.withdrawals add column if not exists amount numeric default 0;
alter table public.withdrawals add column if not exists status text default 'pending';
alter table public.withdrawals add column if not exists note text;
alter table public.withdrawals add column if not exists created_at timestamptz default now();
alter table public.withdrawals add column if not exists updated_at timestamptz default now();
alter table public.library_settlements add column if not exists id text;
alter table public.library_settlements add column if not exists order_id text;
alter table public.library_settlements add column if not exists order_number text;
alter table public.library_settlements add column if not exists receipt_number text;
alter table public.library_settlements add column if not exists library_id text;
alter table public.library_settlements add column if not exists amount numeric default 0;
alter table public.library_settlements add column if not exists profit numeric default 0;
alter table public.library_settlements add column if not exists type text;
alter table public.library_settlements add column if not exists status text default 'received';
alter table public.library_settlements add column if not exists payment_method text;
alter table public.library_settlements add column if not exists note text;
alter table public.library_settlements add column if not exists created_by text;
alter table public.library_settlements add column if not exists created_at timestamptz default now();
alter table public.teacher_settlements add column if not exists id text;
alter table public.teacher_settlements add column if not exists order_id text;
alter table public.teacher_settlements add column if not exists order_number text;
alter table public.teacher_settlements add column if not exists teacher_id text;
alter table public.teacher_settlements add column if not exists amount numeric default 0;
alter table public.teacher_settlements add column if not exists profit numeric default 0;
alter table public.teacher_settlements add column if not exists type text;
alter table public.teacher_settlements add column if not exists status text default 'paid';
alter table public.teacher_settlements add column if not exists note text;
alter table public.teacher_settlements add column if not exists created_at timestamptz default now();
alter table public.delegate_settlements add column if not exists id text;
alter table public.delegate_settlements add column if not exists order_id text;
alter table public.delegate_settlements add column if not exists order_number text;
alter table public.delegate_settlements add column if not exists delegate_id text;
alter table public.delegate_settlements add column if not exists courier_id text;
alter table public.delegate_settlements add column if not exists amount numeric default 0;
alter table public.delegate_settlements add column if not exists profit numeric default 0;
alter table public.delegate_settlements add column if not exists type text;
alter table public.delegate_settlements add column if not exists status text default 'paid';
alter table public.delegate_settlements add column if not exists note text;
alter table public.delegate_settlements add column if not exists created_at timestamptz default now();
alter table public.admin_settlements add column if not exists id text;
alter table public.admin_settlements add column if not exists order_id text;
alter table public.admin_settlements add column if not exists order_number text;
alter table public.admin_settlements add column if not exists amount numeric default 0;
alter table public.admin_settlements add column if not exists profit numeric default 0;
alter table public.admin_settlements add column if not exists type text;
alter table public.admin_settlements add column if not exists party text default 'admin';
alter table public.admin_settlements add column if not exists note text;
alter table public.admin_settlements add column if not exists created_at timestamptz default now();
alter table public.notifications add column if not exists id text;
alter table public.notifications add column if not exists target_role text default 'all';
alter table public.notifications add column if not exists target_id text default '';
alter table public.notifications add column if not exists title text;
alter table public.notifications add column if not exists message text;
alter table public.notifications add column if not exists priority text default 'normal';
alter table public.notifications add column if not exists status text default 'active';
alter table public.notifications add column if not exists read_at timestamptz;
alter table public.notifications add column if not exists from_user text;
alter table public.notifications add column if not exists meta jsonb default '{}'::jsonb;
alter table public.notifications add column if not exists created_at timestamptz default now();
alter table public.banners add column if not exists id text;
alter table public.banners add column if not exists title text;
alter table public.banners add column if not exists text text;
alter table public.banners add column if not exists image_path text;
alter table public.banners add column if not exists link_url text;
alter table public.banners add column if not exists target text;
alter table public.banners add column if not exists active boolean default true;
alter table public.banners add column if not exists start_date timestamptz;
alter table public.banners add column if not exists end_date timestamptz;
alter table public.banners add column if not exists sort_order integer default 0;
alter table public.banners add column if not exists created_at timestamptz default now();
alter table public.banners add column if not exists updated_at timestamptz default now();
alter table public.coupons add column if not exists id text;
alter table public.coupons add column if not exists code text;
alter table public.coupons add column if not exists discount_type text default 'percent';
alter table public.coupons add column if not exists discount_value numeric default 0;
alter table public.coupons add column if not exists max_uses integer default 0;
alter table public.coupons add column if not exists used_count integer default 0;
alter table public.coupons add column if not exists applies_to text default 'all';
alter table public.coupons add column if not exists status text default 'active';
alter table public.coupons add column if not exists starts_at timestamptz;
alter table public.coupons add column if not exists expires_at timestamptz;
alter table public.coupons add column if not exists created_at timestamptz default now();
alter table public.coupons add column if not exists updated_at timestamptz default now();
alter table public.student_profiles add column if not exists id text;
alter table public.student_profiles add column if not exists name text;
alter table public.student_profiles add column if not exists phone text;
alter table public.student_profiles add column if not exists address text;
alter table public.student_profiles add column if not exists points numeric default 0;
alter table public.student_profiles add column if not exists created_at timestamptz default now();
alter table public.student_profiles add column if not exists updated_at timestamptz default now();
alter table public.product_reviews add column if not exists id text;
alter table public.product_reviews add column if not exists kind text;
alter table public.product_reviews add column if not exists item_id text;
alter table public.product_reviews add column if not exists student_id text;
alter table public.product_reviews add column if not exists rating numeric;
alter table public.product_reviews add column if not exists comment text;
alter table public.product_reviews add column if not exists status text default 'published';
alter table public.product_reviews add column if not exists created_at timestamptz default now();
alter table public.stock_alerts add column if not exists id text;
alter table public.stock_alerts add column if not exists kind text;
alter table public.stock_alerts add column if not exists item_id text;
alter table public.stock_alerts add column if not exists student_name text;
alter table public.stock_alerts add column if not exists student_phone text;
alter table public.stock_alerts add column if not exists status text default 'waiting';
alter table public.stock_alerts add column if not exists created_at timestamptz default now();
alter table public.bundles add column if not exists id text;
alter table public.bundles add column if not exists name text;
alter table public.bundles add column if not exists description text;
alter table public.bundles add column if not exists price numeric default 0;
alter table public.bundles add column if not exists image_path text;
alter table public.bundles add column if not exists status text default 'active';
alter table public.bundles add column if not exists created_at timestamptz default now();
alter table public.bundle_items add column if not exists id text;
alter table public.bundle_items add column if not exists bundle_id text;
alter table public.bundle_items add column if not exists kind text;
alter table public.bundle_items add column if not exists item_id text;
alter table public.bundle_items add column if not exists quantity numeric default 1;
alter table public.bundle_items add column if not exists created_at timestamptz default now();
alter table public.audit add column if not exists id text;
alter table public.audit add column if not exists kind text;
alter table public.audit add column if not exists text text;
alter table public.audit add column if not exists user_id text;
alter table public.audit add column if not exists user_role text;
alter table public.audit add column if not exists user_name text;
alter table public.audit add column if not exists meta jsonb default '{}'::jsonb;
alter table public.audit add column if not exists created_at timestamptz default now();
alter table public.security_audit_logs add column if not exists id uuid default gen_random_uuid();
alter table public.security_audit_logs add column if not exists event_type text;
alter table public.security_audit_logs add column if not exists user_id uuid;
alter table public.security_audit_logs add column if not exists account_id text;
alter table public.security_audit_logs add column if not exists role text;
alter table public.security_audit_logs add column if not exists success boolean default true;
alter table public.security_audit_logs add column if not exists ip_hint text;
alter table public.security_audit_logs add column if not exists user_agent text;
alter table public.security_audit_logs add column if not exists details jsonb default '{}'::jsonb;
alter table public.security_audit_logs add column if not exists created_at timestamptz default now();
alter table public.security_operation_log add column if not exists id uuid default gen_random_uuid();
alter table public.security_operation_log add column if not exists operation text;
alter table public.security_operation_log add column if not exists actor_id text;
alter table public.security_operation_log add column if not exists actor_role text;
alter table public.security_operation_log add column if not exists target_type text;
alter table public.security_operation_log add column if not exists target_id text;
alter table public.security_operation_log add column if not exists success boolean default true;
alter table public.security_operation_log add column if not exists details jsonb default '{}'::jsonb;
alter table public.security_operation_log add column if not exists created_at timestamptz default now();
alter table public.backup_logs add column if not exists id text;
alter table public.backup_logs add column if not exists file_name text;
alter table public.backup_logs add column if not exists storage_path text;
alter table public.backup_logs add column if not exists size_bytes bigint default 0;
alter table public.backup_logs add column if not exists scope jsonb default '{}'::jsonb;
alter table public.backup_logs add column if not exists status text default 'completed';
alter table public.backup_logs add column if not exists created_by text;
alter table public.backup_logs add column if not exists created_at timestamptz default now();
alter table public.system_health_logs add column if not exists id text;
alter table public.system_health_logs add column if not exists service text;
alter table public.system_health_logs add column if not exists status text;
alter table public.system_health_logs add column if not exists message text;
alter table public.system_health_logs add column if not exists details jsonb default '{}'::jsonb;
alter table public.system_health_logs add column if not exists created_at timestamptz default now();

-- الفهارس
create index if not exists accounts_role_idx on public.accounts(role);
create index if not exists accounts_status_idx on public.accounts(status);
create index if not exists accounts_username_idx on public.accounts(username);
create index if not exists couriers_status_idx on public.couriers(status);
create index if not exists booklets_teacher_idx on public.booklets(teacher_id);
create index if not exists booklets_status_idx on public.booklets(status);
create index if not exists booklets_subject_idx on public.booklets(subject);
create index if not exists teacher_requests_teacher_idx on public.teacher_requests(teacher_id);
create index if not exists teacher_requests_status_idx on public.teacher_requests(status);
create index if not exists products_status_idx on public.products(status);
create index if not exists products_category_idx on public.products(category);
create index if not exists products_stock_idx on public.products(stock);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_library_idx on public.orders(library_id);
create index if not exists orders_courier_idx on public.orders(courier_id);
create index if not exists orders_created_idx on public.orders(created_at desc);
create index if not exists orders_tracking_idx on public.orders(tracking_code);
create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists order_timeline_order_idx on public.order_timeline(order_id,created_at);
create index if not exists ledger_order_idx on public.ledger(order_id);
create index if not exists ledger_library_idx on public.ledger(library_id);
create index if not exists ledger_teacher_idx on public.ledger(teacher_id);
create index if not exists financial_entries_order_idx on public.financial_entries(order_id);
create index if not exists notifications_target_idx on public.notifications(target_role,target_id);
create index if not exists notifications_created_idx on public.notifications(created_at desc);

-- Triggers updated_at
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['settings','accounts','delivery_areas','couriers','categories','booklets','teacher_requests','products','orders','permits','ledger','withdrawals','banners','coupons','student_profiles']
  LOOP
    EXECUTE format('drop trigger if exists trg_%I_updated_at on public.%I',t,t);
    EXECUTE format('create trigger trg_%I_updated_at before update on public.%I for each row execute function public.alin_set_updated_at()',t,t);
  END LOOP;
END $$;

-- انتهاء مهلة المندوب
create or replace function public.expire_unaccepted_courier_orders()
returns integer language plpgsql security definer set search_path=public as $$
declare affected integer;
begin
  update public.orders
  set courier_id=null,
      delegate_id=null,
      courier_assignment_status='expired',
      courier_reject_reason='انتهت مهلة قبول المندوب',
      courier_assigned_at=null,
      courier_accept_deadline=null,
      updated_at=now()
  where courier_assignment_status='assigned'
    and courier_accepted_at is null
    and courier_accept_deadline is not null
    and courier_accept_deadline < now();
  get diagnostics affected = row_count;
  return affected;
end $$;

-- Buckets (سياسة الخصوصية النهائية تضاف في RC5)
insert into storage.buckets(id,name,public) values
 ('alin-files','alin-files',true),
 ('products','products',true),
 ('teacher-word','teacher-word',false),
 ('final-pdf','final-pdf',false),
 ('product-images','product-images',true),
 ('banners','banners',true),
 ('logos','logos',true),
 ('profile-images','profile-images',true),
 ('backups','backups',false)
on conflict(id) do nothing;

-- مناطق كركوك الافتراضية
insert into public.delivery_areas(id,name,city,sort_order) select 'KA-QADISIYA','القادسية','كركوك',10 where not exists(select 1 from public.delivery_areas where id='KA-QADISIYA' or name='القادسية');
insert into public.delivery_areas(id,name,city,sort_order) select 'KA-HURIYA','الحرية','كركوك',20 where not exists(select 1 from public.delivery_areas where id='KA-HURIYA' or name='الحرية');
insert into public.delivery_areas(id,name,city,sort_order) select 'KA-ISKAN','الإسكان','كركوك',30 where not exists(select 1 from public.delivery_areas where id='KA-ISKAN' or name='الإسكان');
insert into public.delivery_areas(id,name,city,sort_order) select 'KA-ARAFA','عرفة','كركوك',40 where not exists(select 1 from public.delivery_areas where id='KA-ARAFA' or name='عرفة');
insert into public.delivery_areas(id,name,city,sort_order) select 'KA-RAHIMAWA','رحيم آوه','كركوك',50 where not exists(select 1 from public.delivery_areas where id='KA-RAHIMAWA' or name='رحيم آوه');
insert into public.delivery_areas(id,name,city,sort_order) select 'KA-SHORAW','شوراو','كركوك',60 where not exists(select 1 from public.delivery_areas where id='KA-SHORAW' or name='شوراو');
insert into public.delivery_areas(id,name,city,sort_order) select 'KA-BAGHDAD-ROAD','طريق بغداد','كركوك',70 where not exists(select 1 from public.delivery_areas where id='KA-BAGHDAD-ROAD' or name='طريق بغداد');
insert into public.delivery_areas(id,name,city,sort_order) select 'KA-WASITI','الواسطي','كركوك',80 where not exists(select 1 from public.delivery_areas where id='KA-WASITI' or name='الواسطي');
insert into public.delivery_areas(id,name,city,sort_order) select 'KA-DOMIZ','دوميز','كركوك',90 where not exists(select 1 from public.delivery_areas where id='KA-DOMIZ' or name='دوميز');
insert into public.delivery_areas(id,name,city,sort_order) select 'KA-BANJA-ALI','بنجا علي','كركوك',100 where not exists(select 1 from public.delivery_areas where id='KA-BANJA-ALI' or name='بنجا علي');
insert into public.delivery_areas(id,name,city,sort_order) select 'KA-TISAEEN','تسعين','كركوك',110 where not exists(select 1 from public.delivery_areas where id='KA-TISAEEN' or name='تسعين');
insert into public.delivery_areas(id,name,city,sort_order) select 'KA-NASR','حي النصر','كركوك',120 where not exists(select 1 from public.delivery_areas where id='KA-NASR' or name='حي النصر');
insert into public.delivery_areas(id,name,city,sort_order) select 'KA-NIDAA','حي النداء','كركوك',130 where not exists(select 1 from public.delivery_areas where id='KA-NIDAA' or name='حي النداء');
insert into public.delivery_areas(id,name,city,sort_order) select 'KA-KHADRAA','الخضراء','كركوك',140 where not exists(select 1 from public.delivery_areas where id='KA-KHADRAA' or name='الخضراء');
insert into public.delivery_areas(id,name,city,sort_order) select 'KA-MUSALLA','المصلى','كركوك',150 where not exists(select 1 from public.delivery_areas where id='KA-MUSALLA' or name='المصلى');
insert into public.delivery_areas(id,name,city,sort_order) select 'KA-QORIA','القورية','كركوك',160 where not exists(select 1 from public.delivery_areas where id='KA-QORIA' or name='القورية');
insert into public.delivery_areas(id,name,city,sort_order) select 'KA-SHORJA','الشورجة','كركوك',170 where not exists(select 1 from public.delivery_areas where id='KA-SHORJA' or name='الشورجة');
insert into public.delivery_areas(id,name,city,sort_order) select 'KA-JUNE1','واحد حزيران','كركوك',180 where not exists(select 1 from public.delivery_areas where id='KA-JUNE1' or name='واحد حزيران');
insert into public.delivery_areas(id,name,city,sort_order) select 'KA-ASKARI','الحي العسكري','كركوك',190 where not exists(select 1 from public.delivery_areas where id='KA-ASKARI' or name='الحي العسكري');
insert into public.delivery_areas(id,name,city,sort_order) select 'KA-MUALIMEEN','حي المعلمين','كركوك',200 where not exists(select 1 from public.delivery_areas where id='KA-MUALIMEEN' or name='حي المعلمين');
insert into public.delivery_areas(id,name,city,sort_order) select 'KA-JAMIAA','حي الجامعة','كركوك',210 where not exists(select 1 from public.delivery_areas where id='KA-JAMIAA' or name='حي الجامعة');
insert into public.delivery_areas(id,name,city,sort_order) select 'KA-ADEN','حي عدن','كركوك',220 where not exists(select 1 from public.delivery_areas where id='KA-ADEN' or name='حي عدن');
insert into public.delivery_areas(id,name,city,sort_order) select 'KA-ZAWRAA','حي الزوراء','كركوك',230 where not exists(select 1 from public.delivery_areas where id='KA-ZAWRAA' or name='حي الزوراء');

notify pgrst, 'reload schema';

-- ============================================================
-- نهاية RC4
-- لا تنفّذ سياسات RLS الصارمة قبل RC5 وربط Supabase Auth النهائي.
-- ============================================================


-- تحديث إصدار القاعدة مع الحفاظ على key/value
update public.settings set value='RC5.1_MIGRATED', updated_at=now() where key='alin_db_version';
insert into public.settings(key,value) select 'alin_db_version','RC5.1_MIGRATED'
where not exists(select 1 from public.settings where key='alin_db_version');
update public.settings set version='RC5.1', updated_at=now() where id='main';

insert into public.alin_migration_log(migration_name,status,details)
values('RC5.1_DATABASE_COMPATIBILITY','completed',jsonb_build_object('completed_at',now()));

notify pgrst, 'reload schema';
commit;

-- ===== Alin_RC5_2_Final_Compatibility.sql =====
-- ============================================================
-- منصة آلين RC5.2 - فحص وإكمال التوافق النهائي لقاعدة البيانات
-- ينفذ بعد Alin_RC5_1_Database_Migration.sql
-- آمن لإعادة التنفيذ، ولا يحذف أي بيانات.
-- ============================================================

begin;
create extension if not exists pgcrypto;

create table if not exists public.alin_migration_log(
  id bigserial primary key,
  migration_name text not null,
  status text not null,
  details jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

insert into public.alin_migration_log(migration_name,status,details)
values('RC5.2_FINAL_COMPATIBILITY','started',jsonb_build_object('started_at',now()));

-- جدول مرجعي يصف البنية التي تحتاجها المنصة النهائية.
create table if not exists public.alin_schema_requirements(
  table_name text not null,
  column_name text not null,
  expected_type text,
  required boolean default true,
  primary key(table_name,column_name)
);

truncate table public.alin_schema_requirements;
insert into public.alin_schema_requirements(table_name,column_name,expected_type,required) values
('settings','id','text',true),('settings','key','text',true),('settings','value','text',true),('settings','version','text',true),('settings','data','jsonb',true),
('accounts','id','text',true),('accounts','role','text',true),('accounts','name','text',true),('accounts','username','text',true),('accounts','status','text',true),('accounts','permissions','jsonb',true),
('orders','id','text',true),('orders','tracking_code','text',true),('orders','student_name','text',true),('orders','student_phone','text',true),('orders','status','text',true),('orders','total','numeric',true),('orders','library_id','text',true),('orders','courier_id','text',true),('orders','delivery_area','text',true),('orders','delivery_lat','numeric',true),('orders','delivery_lng','numeric',true),('orders','courier_accept_deadline','timestamp with time zone',true),
('order_items','id','text',true),('order_items','order_id','text',true),('order_items','item_id','text',true),('order_items','qty','numeric',true),
('order_timeline','id','text',true),('order_timeline','order_id','text',true),('order_timeline','event_type','text',true),('order_timeline','created_at','timestamp with time zone',true),
('booklets','id','text',true),('booklets','title','text',true),('booklets','teacher_id','text',true),('booklets','file_path','text',true),('booklets','source_word_path','text',true),('booklets','status','text',true),
('teacher_requests','id','text',true),('teacher_requests','teacher_id','text',true),('teacher_requests','source_file_path','text',true),('teacher_requests','review_status','text',true),
('products','id','text',true),('products','name','text',true),('products','price','numeric',true),('products','stock','numeric',true),('products','images','jsonb',true),('products','status','text',true),
('couriers','id','text',true),('couriers','name','text',true),('couriers','status','text',true),('couriers','areas','ARRAY',true),('couriers','current_orders','integer',true),('couriers','debt','numeric',true),
('delivery_areas','id','text',true),('delivery_areas','name','text',true),('delivery_areas','city','text',true),('delivery_areas','status','text',true),
('courier_areas','courier_id','text',true),('courier_areas','area_id','text',true),
('notifications','id','text',true),('notifications','target_role','text',true),('notifications','target_id','text',true),('notifications','message','text',true),('notifications','read_at','timestamp with time zone',true),
('financial_entries','id','text',true),('financial_entries','order_id','text',true),('financial_entries','gross','numeric',true),('financial_entries','platform_amount','numeric',true),('financial_entries','teacher_amount','numeric',true),('financial_entries','library_amount','numeric',true),('financial_entries','courier_amount','numeric',true),
('financial_payouts','id','text',true),('financial_payouts','party_role','text',true),('financial_payouts','party_id','text',true),('financial_payouts','amount','numeric',true),
('library_settlements','id','text',true),('library_settlements','library_id','text',true),('library_settlements','amount','numeric',true),
('teacher_settlements','id','text',true),('teacher_settlements','teacher_id','text',true),('teacher_settlements','amount','numeric',true),
('delegate_settlements','id','text',true),('delegate_settlements','courier_id','text',true),('delegate_settlements','amount','numeric',true),
('backup_logs','id','text',true),('backup_logs','file_name','text',true),('backup_logs','status','text',true),
('system_health_logs','id','text',true),('system_health_logs','service','text',true),('system_health_logs','status','text',true),
('audit','id','text',true),('audit','kind','text',true),('audit','created_at','timestamp with time zone',true);

-- أعمدة توافق إضافية شائعة لم تكن موجودة في بعض النسخ القديمة.
alter table public.orders add column if not exists assigned_by text;
alter table public.orders add column if not exists assignment_note text;
alter table public.orders add column if not exists last_status_by text;
alter table public.orders add column if not exists last_status_role text;
alter table public.orders add column if not exists last_status_at timestamptz;
alter table public.orders add column if not exists library_cash_received numeric default 0;
alter table public.orders add column if not exists library_debt_amount numeric default 0;
alter table public.orders add column if not exists courier_cash_received numeric default 0;
alter table public.orders add column if not exists courier_debt_amount numeric default 0;
alter table public.orders add column if not exists metadata jsonb default '{}'::jsonb;

alter table public.accounts add column if not exists login_enabled boolean default true;
alter table public.accounts add column if not exists profile_data jsonb default '{}'::jsonb;
alter table public.accounts add column if not exists last_activity_at timestamptz;

alter table public.couriers add column if not exists availability_note text;
alter table public.couriers add column if not exists last_seen_at timestamptz;
alter table public.couriers add column if not exists accepted_orders integer default 0;
alter table public.couriers add column if not exists completed_orders integer default 0;

alter table public.notifications add column if not exists recipient_role text;
alter table public.notifications add column if not exists recipient_id text;
alter table public.notifications add column if not exists is_read boolean default false;
alter table public.notifications add column if not exists sent_at timestamptz default now();

-- مزامنة أسماء الأعمدة البديلة من دون حذف الأعمدة القديمة.
update public.notifications
set recipient_role = coalesce(recipient_role,target_role),
    recipient_id = coalesce(recipient_id,target_id),
    is_read = coalesce(is_read, read_at is not null),
    sent_at = coalesce(sent_at,created_at)
where recipient_role is null or recipient_id is null or sent_at is null;

-- فهارس تشغيلية؛ تنشأ فقط إذا كانت الأعمدة موجودة.
create index if not exists orders_fulfillment_status_idx on public.orders(fulfillment_type,status);
create index if not exists orders_area_status_idx on public.orders(delivery_area,status);
create index if not exists orders_courier_deadline_idx on public.orders(courier_accept_deadline) where courier_assignment_status='assigned';
create index if not exists orders_student_phone_idx on public.orders(student_phone);
create index if not exists teacher_requests_review_idx on public.teacher_requests(review_status,created_at desc);
create index if not exists products_category_status_idx on public.products(category,status);
create index if not exists couriers_area_gin_idx on public.couriers using gin(areas);
create index if not exists notifications_recipient_idx on public.notifications(recipient_role,recipient_id,is_read,sent_at desc);
create index if not exists financial_entries_party_idx on public.financial_entries(library_id,teacher_id,courier_id);
create index if not exists backup_logs_created_idx on public.backup_logs(created_at desc);
create index if not exists system_health_service_idx on public.system_health_logs(service,created_at desc);

-- تعبئة أرقام التتبع للطلبات القديمة التي لا تحتوي رقماً.
create sequence if not exists public.alin_tracking_seq start 1;
update public.orders
set tracking_code = 'ALN-' || to_char(coalesce(created_at,now()),'YYYY') || '-' || lpad(nextval('public.alin_tracking_seq')::text,6,'0')
where tracking_code is null or btrim(tracking_code)='';

-- التأكد من وجود صف الإعدادات الرئيسي وتحديث الإصدار.
insert into public.settings(key,value,id,platform_name,version,data)
select '__main__','{}','main','منصة آلين','RC5.2','{}'::jsonb
where not exists(select 1 from public.settings where id='main' or key='__main__');
update public.settings set version='RC5.2',updated_at=now() where id='main';
update public.settings set value='RC5.2_COMPATIBLE',updated_at=now() where key='alin_db_version';
insert into public.settings(key,value)
select 'alin_db_version','RC5.2_COMPATIBLE'
where not exists(select 1 from public.settings where key='alin_db_version');

-- دالة تقرير يمكن تشغيلها في أي وقت من SQL Editor.
create or replace function public.alin_database_compatibility_report()
returns table(
  component text,
  item text,
  status text,
  details text
)
language sql
security definer
set search_path=public
as $$
  with table_report as (
    select 'TABLE'::text component,
           r.table_name item,
           case when t.table_name is not null then 'OK' else 'MISSING' end status,
           case when t.table_name is not null then 'الجدول موجود' else 'الجدول غير موجود' end details
    from (select distinct table_name from public.alin_schema_requirements) r
    left join information_schema.tables t
      on t.table_schema='public' and t.table_name=r.table_name
  ), column_report as (
    select 'COLUMN'::text component,
           r.table_name||'.'||r.column_name item,
           case when c.column_name is null then 'MISSING'
                when r.expected_type is null then 'OK'
                when r.expected_type='ARRAY' and c.data_type='ARRAY' then 'OK'
                when c.data_type=r.expected_type then 'OK'
                else 'TYPE_MISMATCH' end status,
           case when c.column_name is null then 'العمود غير موجود'
                else 'النوع الحالي: '||c.data_type||coalesce('، المتوقع: '||r.expected_type,'') end details
    from public.alin_schema_requirements r
    left join information_schema.columns c
      on c.table_schema='public' and c.table_name=r.table_name and c.column_name=r.column_name
  ), bucket_report as (
    select 'BUCKET'::text component,
           b.id item,
           case when sb.id is not null then 'OK' else 'MISSING' end status,
           case when sb.id is not null then 'Bucket موجود' else 'Bucket غير موجود' end details
    from (values ('alin-files'),('products'),('teacher-word'),('final-pdf'),('product-images'),('banners'),('logos'),('profile-images'),('backups')) b(id)
    left join storage.buckets sb on sb.id=b.id
  )
  select * from table_report
  union all select * from column_report
  union all select * from bucket_report
  order by status desc,component,item;
$$;

-- View مختصر لصحة البنية.
create or replace view public.alin_database_health_summary as
select
  count(*) filter(where status='OK') as ok_items,
  count(*) filter(where status='MISSING') as missing_items,
  count(*) filter(where status='TYPE_MISMATCH') as type_mismatch_items,
  count(*) as checked_items,
  now() as checked_at
from public.alin_database_compatibility_report();

insert into public.alin_migration_log(migration_name,status,details)
values('RC5.2_FINAL_COMPATIBILITY','completed',jsonb_build_object('completed_at',now()));

notify pgrst, 'reload schema';
commit;

COMMIT;
