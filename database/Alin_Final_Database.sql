-- ============================================================
-- منصة آلين - قاعدة البيانات النهائية RC4
-- الإصدار: RC4 / 2026
-- ملاحظة: هذا الملف قابل لإعادة التنفيذ قدر الإمكان (idempotent).
-- لا يفعّل RLS الصارم حالياً لأن تسجيل الدخول النهائي عبر Supabase Auth
-- مؤجل للمرحلة RC5. سياسات الحماية النهائية تضاف بعد اختبار الربط.
-- ============================================================

create extension if not exists pgcrypto;

-- تحديث updated_at
create or replace function public.alin_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- الإعدادات العامة
create table if not exists public.settings (
  id text primary key default 'main',
  platform_name text default 'منصة آلين',
  version text default 'RC4',
  data jsonb default '{}'::jsonb,
  primary_color text,
  secondary_color text,
  background_color text,
  card_color text,
  logo_path text,
  dark_logo_path text,
  app_icon_path text,
  font_family text,
  orders_enabled boolean default true,
  orders_disabled_reason text,
  platform_percent numeric default 25,
  teacher_percent numeric default 40,
  library_percent numeric default 35,
  courier_fee numeric default 0,
  debt_alert_limit numeric default 0,
  whatsapp text,
  contact_text text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
insert into public.settings(id) values('main') on conflict(id) do nothing;

-- الحسابات
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
create index if not exists accounts_role_idx on public.accounts(role);
create index if not exists accounts_status_idx on public.accounts(status);
create index if not exists accounts_username_idx on public.accounts(username);

-- مناطق التوصيل
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

-- المندوبون وربط المناطق
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
create table if not exists public.courier_areas (
  courier_id text not null,
  area_id text not null,
  created_at timestamptz default now(),
  primary key(courier_id,area_id)
);
create index if not exists couriers_status_idx on public.couriers(status);

-- الأقسام
create table if not exists public.categories (
  id text primary key,
  type text not null,
  name text not null,
  status text default 'active',
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- الملازم
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
create index if not exists booklets_teacher_idx on public.booklets(teacher_id);
create index if not exists booklets_status_idx on public.booklets(status);
create index if not exists booklets_subject_idx on public.booklets(subject);

-- طلبات المدرسين ومراجعات النسخ
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
create index if not exists teacher_requests_teacher_idx on public.teacher_requests(teacher_id);
create index if not exists teacher_requests_status_idx on public.teacher_requests(status);

-- المنتجات وصورها
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
create index if not exists products_status_idx on public.products(status);
create index if not exists products_category_idx on public.products(category);
create index if not exists products_stock_idx on public.products(stock);

-- الطلبات
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
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_library_idx on public.orders(library_id);
create index if not exists orders_courier_idx on public.orders(courier_id);
create index if not exists orders_created_idx on public.orders(created_at desc);
create index if not exists orders_tracking_idx on public.orders(tracking_code);

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
create index if not exists order_items_order_idx on public.order_items(order_id);

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
create index if not exists order_timeline_order_idx on public.order_timeline(order_id,created_at);

-- أذونات الطباعة
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

-- المالية
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
create index if not exists ledger_order_idx on public.ledger(order_id);
create index if not exists ledger_library_idx on public.ledger(library_id);
create index if not exists ledger_teacher_idx on public.ledger(teacher_id);

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
create index if not exists financial_entries_order_idx on public.financial_entries(order_id);

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

-- الإشعارات
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
create index if not exists notifications_target_idx on public.notifications(target_role,target_id);
create index if not exists notifications_created_idx on public.notifications(created_at desc);

-- البنرات والكوبونات
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

-- مراجعات ومزايا المتجر
create table if not exists public.student_profiles (
  id text primary key,
  name text,
  phone text,
  address text,
  points numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
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
create table if not exists public.stock_alerts (
  id text primary key,
  kind text,
  item_id text,
  student_name text,
  student_phone text,
  status text default 'waiting',
  created_at timestamptz default now()
);
create table if not exists public.bundles (
  id text primary key,
  name text,
  description text,
  price numeric default 0,
  image_path text,
  status text default 'active',
  created_at timestamptz default now()
);
create table if not exists public.bundle_items (
  id text primary key,
  bundle_id text,
  kind text,
  item_id text,
  quantity numeric default 1,
  created_at timestamptz default now()
);

-- سجل النشاط والأمان
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

-- النسخ الاحتياطي وصحة النظام
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
create table if not exists public.system_health_logs (
  id text primary key,
  service text,
  status text,
  message text,
  details jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

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
insert into public.delivery_areas(id,name,city,sort_order) values
 ('KA-QADISIYA','القادسية','كركوك',10),
 ('KA-HURIYA','الحرية','كركوك',20),
 ('KA-ISKAN','الإسكان','كركوك',30),
 ('KA-ARAFA','عرفة','كركوك',40),
 ('KA-RAHIMAWA','رحيم آوه','كركوك',50),
 ('KA-SHORAW','شوراو','كركوك',60),
 ('KA-BAGHDAD-ROAD','طريق بغداد','كركوك',70),
 ('KA-WASITI','الواسطي','كركوك',80),
 ('KA-DOMIZ','دوميز','كركوك',90),
 ('KA-BANJA-ALI','بنجا علي','كركوك',100),
 ('KA-TISAEEN','تسعين','كركوك',110),
 ('KA-NASR','حي النصر','كركوك',120),
 ('KA-NIDAA','حي النداء','كركوك',130),
 ('KA-KHADRAA','الخضراء','كركوك',140),
 ('KA-MUSALLA','المصلى','كركوك',150),
 ('KA-QORIA','القورية','كركوك',160),
 ('KA-SHORJA','الشورجة','كركوك',170),
 ('KA-JUNE1','واحد حزيران','كركوك',180),
 ('KA-ASKARI','الحي العسكري','كركوك',190),
 ('KA-MUALIMEEN','حي المعلمين','كركوك',200),
 ('KA-JAMIAA','حي الجامعة','كركوك',210),
 ('KA-ADEN','حي عدن','كركوك',220),
 ('KA-ZAWRAA','حي الزوراء','كركوك',230)
on conflict(name) do nothing;

notify pgrst, 'reload schema';

-- ============================================================
-- نهاية RC4
-- لا تنفّذ سياسات RLS الصارمة قبل RC5 وربط Supabase Auth النهائي.
-- ============================================================
