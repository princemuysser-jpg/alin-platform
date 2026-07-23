-- ============================================================
-- منصة آلين v3.1.2 — إصدار موحّد مستقر للنشر
-- ملف قاعدة بيانات واحد: الحماية + التخزين الخاص + الطلبات + النظام المالي الذري.
-- يعالج تعارض ledger_status_valid من المصدر ولا يحذف الطلبات أو الحسابات.
-- ============================================================

begin;

-- ============================================================
-- تمهيد توافق مالي آمن قبل أي تحديث للطلبات
-- قاعدة المستخدم قد تحتوي قيوداً/مشغلات قديمة على ledger من إصدارات سابقة.
-- تُعطّل مشغلات ledger مؤقتاً داخل هذه المعاملة، وتُزال جميع قيود CHECK
-- التي تعتمد على status أو settlement_status مهما كان اسمها، ثم تُعاد لاحقاً.
-- عند أي خطأ تُرجع PostgreSQL كل شيء تلقائياً لأن الملف داخل transaction واحدة.
-- ============================================================
do $$
declare
  r record;
begin
  if to_regclass('public.ledger') is not null then
    execute 'alter table public.ledger disable trigger user';
    for r in
      select conname
      from pg_constraint
      where conrelid='public.ledger'::regclass
        and contype='c'
        and pg_get_constraintdef(oid) ~* '(status|settlement_status)'
    loop
      execute format('alter table public.ledger drop constraint if exists %I',r.conname);
    end loop;
  end if;
end
$$;

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.alin_schema_versions (
  version text primary key,
  applied_at timestamptz not null default now(),
  notes text
);

-- ------------------------------------------------------------
-- 1) سجل تدقيق غير قابل للتزوير من المتصفح
-- ------------------------------------------------------------
create table if not exists public.audit_events (
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

create index if not exists audit_events_created_at_idx on public.audit_events(created_at desc);
create index if not exists audit_events_actor_idx on public.audit_events(actor_account_id, created_at desc);
create index if not exists audit_events_entity_idx on public.audit_events(entity_type, entity_id, created_at desc);

create or replace function public.alin_audit_sanitize(p_data jsonb)
returns jsonb
language sql immutable
set search_path = public
as $$
  select case when p_data is null then null else p_data - array[
    'password','password_hash','pin','pin_hash','token','access_token','refresh_token',
    'service_role_key','supabase_anon_key','api_key','secret','authorization',
    'student_phone','phone','mobile','delivery_address','delivery_latitude',
    'delivery_longitude','delivery_location_url','gps','coordinates'
  ] end
$$;

create or replace function public.alin_audit_write(
  p_action text,
  p_summary text default null,
  p_meta jsonb default '{}'::jsonb,
  p_entity_type text default null,
  p_entity_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_actor text := public.alin_current_account_id();
  v_role text := public.alin_current_role();
begin
  if v_actor is null then
    raise exception 'يجب تسجيل الدخول لتسجيل العملية';
  end if;
  insert into public.audit_events(
    actor_account_id,actor_role,action,entity_type,entity_id,summary,meta
  ) values (
    v_actor,v_role,left(coalesce(nullif(trim(p_action),''),'event'),80),
    nullif(left(trim(coalesce(p_entity_type,'')),80),''),
    nullif(left(trim(coalesce(p_entity_id,'')),120),''),
    left(coalesce(p_summary,''),1000),
    public.alin_audit_sanitize(coalesce(p_meta,'{}'::jsonb))
  ) returning id into v_id;
  return v_id;
end
$$;

create or replace function public.alin_audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_entity_id text;
  v_actor text := public.alin_current_account_id();
  v_role text := public.alin_current_role();
begin
  if tg_op = 'INSERT' then
    v_new := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
  else
    v_old := to_jsonb(old);
  end if;

  v_entity_id := coalesce(
    v_new->>'id',v_old->>'id',v_new->>'key',v_old->>'key',
    v_new->>'order_id',v_old->>'order_id',''
  );

  insert into public.audit_events(
    actor_account_id,actor_role,action,entity_type,entity_id,summary,old_data,new_data,meta
  ) values (
    v_actor,coalesce(v_role,current_setting('request.jwt.claim.role',true)),lower(tg_op),
    tg_table_name,nullif(v_entity_id,''),
    tg_op || ' on ' || tg_table_name,
    public.alin_audit_sanitize(v_old),public.alin_audit_sanitize(v_new),
    jsonb_build_object('schema',tg_table_schema,'trigger',tg_name)
  );

  if tg_op='DELETE' then return old; end if;
  return new;
end
$$;

alter table public.audit_events enable row level security;
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='audit_events' loop
    execute format('drop policy if exists %I on public.audit_events',p.policyname);
  end loop;
end $$;
create policy audit_events_secure_read on public.audit_events
for select to authenticated
using (public.alin_is_finance_staff());
revoke all on public.audit_events from anon, authenticated;
grant select on public.audit_events to authenticated;
revoke all on function public.alin_audit_write(text,text,jsonb,text,text) from public;
grant execute on function public.alin_audit_write(text,text,jsonb,text,text) to authenticated;
revoke all on function public.alin_audit_row_change() from public;

-- تثبيت المشغلات على الجداول الحساسة الموجودة فقط.
do $$
declare t text;
begin
  foreach t in array array[
    'accounts','booklets','products','orders','order_items','ledger','financial_entries',
    'library_settlements','teacher_settlements','delegate_settlements','admin_settlements',
    'coupons','banners','teacher_requests','settings'
  ] loop
    if to_regclass('public.'||t) is null then continue; end if;
    execute format('drop trigger if exists alin_audit_%I on public.%I',t,t);
    execute format(
      'create trigger alin_audit_%I after insert or update or delete on public.%I for each row execute function public.alin_audit_row_change()',
      t,t
    );
  end loop;
end $$;

-- ------------------------------------------------------------
-- 2) حماية محاولات تسجيل الدخول على الخادم
-- ------------------------------------------------------------
create table if not exists public.auth_login_guard (
  identifier_hash text not null,
  device_hash text not null,
  failure_count integer not null default 0,
  window_started timestamptz not null default now(),
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key(identifier_hash,device_hash)
);
create index if not exists auth_login_guard_cleanup_idx on public.auth_login_guard(updated_at);

create or replace function public.alin_security_hash(p_value text)
returns text
language sql immutable
set search_path = public, extensions
as $$
  select encode(extensions.digest(lower(trim(coalesce(p_value,''))),'sha256'),'hex')
$$;

create or replace function public.alin_login_guard_check(p_identifier text,p_device text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_row public.auth_login_guard%rowtype;
  v_identifier text := public.alin_security_hash(p_identifier);
  v_device text := public.alin_security_hash(coalesce(nullif(p_device,''),'unknown'));
  v_retry integer := 0;
begin
  delete from public.auth_login_guard
  where identifier_hash=v_identifier and device_hash=v_device
    and updated_at < now()-interval '30 days';
  select * into v_row from public.auth_login_guard
  where identifier_hash=v_identifier and device_hash=v_device;
  if found and v_row.locked_until is not null and v_row.locked_until>now() then
    v_retry:=greatest(1,ceil(extract(epoch from (v_row.locked_until-now())))::integer);
    return jsonb_build_object('allowed',false,'retry_after_seconds',v_retry,'remaining',0);
  end if;
  return jsonb_build_object(
    'allowed',true,'retry_after_seconds',0,
    'remaining',greatest(0,5-coalesce(v_row.failure_count,0))
  );
end
$$;

create or replace function public.alin_login_guard_fail(p_identifier text,p_device text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_identifier text := public.alin_security_hash(p_identifier);
  v_device text := public.alin_security_hash(coalesce(nullif(p_device,''),'unknown'));
  v_row public.auth_login_guard%rowtype;
  v_count integer;
  v_locked timestamptz;
begin
  insert into public.auth_login_guard(identifier_hash,device_hash)
  values(v_identifier,v_device)
  on conflict do nothing;

  select * into v_row from public.auth_login_guard
  where identifier_hash=v_identifier and device_hash=v_device
  for update;

  if v_row.window_started < now()-interval '15 minutes' then
    v_count:=1;
  else
    v_count:=v_row.failure_count+1;
  end if;
  v_locked:=case when v_count>=5 then now()+interval '15 minutes' else null end;

  update public.auth_login_guard set
    failure_count=v_count,
    window_started=case when v_row.window_started<now()-interval '15 minutes' then now() else v_row.window_started end,
    locked_until=v_locked,
    updated_at=now()
  where identifier_hash=v_identifier and device_hash=v_device;

  return jsonb_build_object(
    'allowed',v_locked is null,
    'retry_after_seconds',case when v_locked is null then 0 else 900 end,
    'remaining',greatest(0,5-v_count)
  );
end
$$;

create or replace function public.alin_login_guard_success(p_identifier text,p_device text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_username text;
begin
  select username::text into v_username from public.accounts
  where auth_user_id=auth.uid() and status='active' limit 1;
  if v_username is null or lower(trim(v_username))<>lower(trim(coalesce(p_identifier,''))) then
    return false;
  end if;
  delete from public.auth_login_guard
  where identifier_hash=public.alin_security_hash(p_identifier)
    and device_hash=public.alin_security_hash(coalesce(nullif(p_device,''),'unknown'));
  return true;
end
$$;

revoke all on public.auth_login_guard from anon,authenticated;
revoke all on function public.alin_login_guard_check(text,text) from public,anon,authenticated;
revoke all on function public.alin_login_guard_fail(text,text) from public,anon,authenticated;
revoke all on function public.alin_login_guard_success(text,text) from public,anon,authenticated;
grant execute on function public.alin_login_guard_check(text,text) to service_role;
grant execute on function public.alin_login_guard_fail(text,text) to service_role;
grant execute on function public.alin_login_guard_success(text,text) to authenticated;

-- ------------------------------------------------------------
-- 3) صلاحيات الحسابات داخل قاعدة البيانات بدل Local Storage
-- ------------------------------------------------------------
alter table public.accounts add column if not exists admin_level text not null default 'operator';
alter table public.accounts add column if not exists deleted_at timestamptz;
update public.accounts set admin_level='super_admin'
where id::text=(select id::text from public.accounts where role='admin' and status='active' order by id limit 1)
  and not exists(select 1 from public.accounts where role='admin' and admin_level='super_admin');
alter table public.accounts drop constraint if exists accounts_admin_level_valid;
alter table public.accounts add constraint accounts_admin_level_valid check(admin_level in ('super_admin','operator')) not valid;
alter table public.accounts validate constraint accounts_admin_level_valid;

create or replace function public.alin_is_super_admin()
returns boolean
language sql stable security definer
set search_path=public
as $$
  select exists(select 1 from public.accounts where auth_user_id=auth.uid() and role='admin' and status='active' and deleted_at is null and admin_level='super_admin')
$$;
revoke all on function public.alin_is_super_admin() from public;
grant execute on function public.alin_is_super_admin() to authenticated;

create table if not exists public.account_permissions (
  account_id text not null,
  permission text not null,
  granted boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key(account_id,permission)
);
create index if not exists account_permissions_account_idx on public.account_permissions(account_id);

alter table public.account_permissions enable row level security;
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='account_permissions' loop
    execute format('drop policy if exists %I on public.account_permissions',p.policyname);
  end loop;
end $$;
create policy account_permissions_read on public.account_permissions
for select to authenticated
using (account_id=public.alin_current_account_id() or public.alin_is_admin());
revoke all on public.account_permissions from anon,authenticated;
grant select on public.account_permissions to authenticated;

create or replace function public.alin_admin_set_account_permissions(p_account_id text,p_permissions text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_permission text;
  v_count integer:=0;
begin
  if not public.alin_is_super_admin() then raise exception 'تحديث الصلاحيات متاح للمدير الأعلى فقط'; end if;
  if not exists(select 1 from public.accounts where id::text=p_account_id) then
    raise exception 'الحساب غير موجود';
  end if;
  delete from public.account_permissions where account_id=p_account_id;
  foreach v_permission in array coalesce(p_permissions,array[]::text[]) loop
    v_permission:=lower(trim(v_permission));
    if v_permission in ('dashboard','orders','booklets','products','accounts','finance','settlements','reports','notifications','settings') then
      insert into public.account_permissions(account_id,permission,updated_by)
      values(p_account_id,v_permission,public.alin_current_account_id())
      on conflict(account_id,permission) do update set granted=true,updated_at=now(),updated_by=excluded.updated_by;
      v_count:=v_count+1;
    end if;
  end loop;
  perform public.alin_audit_write('permissions','تحديث صلاحيات الحساب',jsonb_build_object('count',v_count),'accounts',p_account_id);
  return v_count;
end
$$;

create or replace function public.alin_get_account_permissions(p_account_id text default null)
returns table(permission text)
language sql
security definer
set search_path = public
as $$
  select ap.permission from public.account_permissions ap
  where ap.account_id=coalesce(p_account_id,public.alin_current_account_id())
    and ap.granted=true
    and (ap.account_id=public.alin_current_account_id() or public.alin_is_admin())
  order by ap.permission
$$;

revoke all on function public.alin_admin_set_account_permissions(text,text[]) from public;
revoke all on function public.alin_get_account_permissions(text) from public;
grant execute on function public.alin_admin_set_account_permissions(text,text[]) to authenticated;
grant execute on function public.alin_get_account_permissions(text) to authenticated;

-- جميع المديرين الحاليين يحتفظون بصلاحياتهم عند الترقية، ويمكن للمدير الأعلى تقليلها لاحقاً.
insert into public.account_permissions(account_id,permission,updated_by)
select a.id::text,p.permission,a.id::text
from public.accounts a
cross join (values
  ('dashboard'),('orders'),('booklets'),('products'),('accounts'),('finance'),
  ('settlements'),('reports'),('notifications'),('settings')
) as p(permission)
where a.role='admin' and a.status='active' and a.deleted_at is null
on conflict(account_id,permission) do nothing;

create or replace function public.alin_has_permission(p_permission text)
returns boolean
language sql stable security definer
set search_path=public
as $$
  select exists(
    select 1 from public.accounts a
    where a.auth_user_id=auth.uid() and a.status='active' and a.deleted_at is null
      and (
        (a.role='admin' and (
          a.admin_level='super_admin' or exists(
            select 1 from public.account_permissions ap
            where ap.account_id=a.id::text and ap.permission=lower(trim(p_permission)) and ap.granted=true
          )
        ))
        or (a.role='accountant' and lower(trim(p_permission)) in ('dashboard','finance','settlements','reports'))
      )
  )
$$;
revoke all on function public.alin_has_permission(text) from public;
grant execute on function public.alin_has_permission(text) to authenticated;

create or replace function public.alin_enforce_admin_permission()
returns trigger
language plpgsql security definer
set search_path=public
as $$
declare v_role text; v_permission text:=lower(coalesce(tg_argv[0],''));
begin
  if auth.uid() is null then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  select role into v_role from public.accounts
  where auth_user_id=auth.uid() and status='active' and deleted_at is null limit 1;
  if v_role='admin' and not public.alin_has_permission(v_permission) then
    raise exception 'لا تملك صلاحية %',v_permission;
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end
$$;
revoke all on function public.alin_enforce_admin_permission() from public;

do $$
declare r record;
begin
  for r in select * from (values
    ('accounts','accounts'),('orders','orders'),('booklets','booklets'),('products','products'),
    ('ledger','finance'),('financial_entries','finance'),('library_settlements','settlements'),
    ('teacher_settlements','settlements'),('delegate_settlements','settlements'),('admin_settlements','settlements'),
    ('coupons','products'),('banners','notifications'),('settings','settings')
  ) as x(table_name,permission)
  loop
    if to_regclass('public.'||r.table_name) is null then continue; end if;
    execute format('drop trigger if exists alin_admin_permission_guard on public.%I',r.table_name);
    execute format(
      'create trigger alin_admin_permission_guard before insert or update or delete on public.%I for each row execute function public.alin_enforce_admin_permission(%L)',
      r.table_name,r.permission
    );
  end loop;
end $$;

-- قصر قراءة سجل التدقيق على المدير الأعلى أو أصحاب صلاحية التقارير.
drop policy if exists audit_events_secure_read on public.audit_events;
create policy audit_events_secure_read on public.audit_events
for select to authenticated
using (public.alin_is_super_admin() or public.alin_has_permission('reports'));

-- ------------------------------------------------------------
-- 4) حساب الطالب الآمن: لا كلمة مرور ولا Hash في المتصفح
-- ------------------------------------------------------------
create table if not exists public.student_accounts (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  phone text not null unique,
  pin_hash text not null,
  status text not null default 'active' check(status in ('active','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.student_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  student_id uuid not null references public.student_accounts(id) on delete cascade,
  token_hash text not null unique,
  device_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists student_sessions_expiry_idx on public.student_sessions(expires_at);

alter table public.student_accounts enable row level security;
alter table public.student_sessions enable row level security;
revoke all on public.student_accounts from anon,authenticated;
revoke all on public.student_sessions from anon,authenticated;

create or replace function public.alin_normalize_phone(p_phone text)
returns text
language sql immutable
as $$
  select regexp_replace(translate(trim(coalesce(p_phone,'')),'٠١٢٣٤٥٦٧٨٩','0123456789'),'[^0-9+]','','g')
$$;

create or replace function public.alin_student_session_account(p_token text,p_device text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_id uuid;
begin
  delete from public.student_sessions
  where token_hash=public.alin_security_hash(p_token)
    and device_hash=public.alin_security_hash(coalesce(nullif(p_device,''),'unknown'))
    and expires_at<=now();
  select student_id into v_id from public.student_sessions
  where token_hash=public.alin_security_hash(p_token)
    and device_hash=public.alin_security_hash(coalesce(nullif(p_device,''),'unknown'))
    and expires_at>now()
  limit 1;
  return v_id;
end
$$;

create or replace function public.alin_student_register(p_name text,p_phone text,p_pin text,p_device text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_phone text:=public.alin_normalize_phone(p_phone);
  v_student uuid;
  v_token text:=encode(extensions.gen_random_bytes(32),'hex');
  v_guard jsonb;
begin
  v_guard:=public.alin_login_guard_check('student-register',p_device);
  if coalesce((v_guard->>'allowed')::boolean,false)=false then raise exception 'تم إيقاف إنشاء الحسابات مؤقتاً على هذا الجهاز'; end if;
  if length(trim(coalesce(p_name,'')))<2 then raise exception 'اكتب اسم الطالب'; end if;
  if v_phone !~ '^\+?[0-9]{7,15}$' then raise exception 'رقم الهاتف غير صحيح'; end if;
  if length(coalesce(p_pin,''))<6 then raise exception 'الرمز السري يجب أن يكون 6 أرقام أو أحرف على الأقل'; end if;
  if exists(select 1 from public.student_accounts where phone=v_phone) then
    perform public.alin_login_guard_fail('student-register',p_device);
    raise exception 'رقم الهاتف مسجل مسبقاً';
  end if;

  perform public.alin_login_guard_fail('student-register',p_device);
  insert into public.student_accounts(name,phone,pin_hash)
  values(left(trim(p_name),120),v_phone,extensions.crypt(p_pin,extensions.gen_salt('bf',10)))
  returning id into v_student;

  insert into public.student_sessions(student_id,token_hash,device_hash,expires_at)
  values(v_student,public.alin_security_hash(v_token),public.alin_security_hash(coalesce(nullif(p_device,''),'unknown')),now()+interval '30 days');

  return jsonb_build_object('token',v_token,'student',jsonb_build_object('id',v_student,'name',left(trim(p_name),120),'phone',v_phone));
end
$$;

create or replace function public.alin_student_login(p_phone text,p_pin text,p_device text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_phone text:=public.alin_normalize_phone(p_phone);
  v_student public.student_accounts%rowtype;
  v_token text:=encode(extensions.gen_random_bytes(32),'hex');
  v_guard jsonb;
begin
  v_guard:=public.alin_login_guard_check('student:'||v_phone,p_device);
  if coalesce((v_guard->>'allowed')::boolean,false)=false then raise exception 'تم إيقاف المحاولات مؤقتاً'; end if;

  select * into v_student from public.student_accounts where phone=v_phone and status='active';
  if not found or v_student.pin_hash<>extensions.crypt(coalesce(p_pin,''),v_student.pin_hash) then
    perform public.alin_login_guard_fail('student:'||v_phone,p_device);
    raise exception 'رقم الهاتف أو الرمز غير صحيح';
  end if;

  delete from public.auth_login_guard
  where identifier_hash=public.alin_security_hash('student:'||v_phone)
    and device_hash=public.alin_security_hash(coalesce(nullif(p_device,''),'unknown'));

  insert into public.student_sessions(student_id,token_hash,device_hash,expires_at)
  values(v_student.id,public.alin_security_hash(v_token),public.alin_security_hash(coalesce(nullif(p_device,''),'unknown')),now()+interval '30 days');

  return jsonb_build_object('token',v_token,'student',jsonb_build_object('id',v_student.id,'name',v_student.name,'phone',v_student.phone));
end
$$;

create or replace function public.alin_student_profile(p_token text,p_device text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_student public.student_accounts%rowtype; v_id uuid;
begin
  v_id:=public.alin_student_session_account(p_token,p_device);
  if v_id is null then return null; end if;
  select * into v_student from public.student_accounts where id=v_id and status='active';
  if not found then return null; end if;
  return jsonb_build_object('id',v_student.id,'name',v_student.name,'phone',v_student.phone);
end
$$;

create or replace function public.alin_student_update(p_token text,p_device text,p_name text,p_phone text,p_pin text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_id uuid; v_phone text:=public.alin_normalize_phone(p_phone); v_row public.student_accounts%rowtype;
begin
  v_id:=public.alin_student_session_account(p_token,p_device);
  if v_id is null then raise exception 'جلسة الطالب منتهية'; end if;
  if length(trim(coalesce(p_name,'')))<2 then raise exception 'اكتب اسم الطالب'; end if;
  if v_phone !~ '^\+?[0-9]{7,15}$' then raise exception 'رقم الهاتف غير صحيح'; end if;
  if p_pin is not null and p_pin<>'' and length(p_pin)<6 then raise exception 'الرمز السري قصير'; end if;

  update public.student_accounts set
    name=left(trim(p_name),120),phone=v_phone,
    pin_hash=case when coalesce(p_pin,'')='' then pin_hash else extensions.crypt(p_pin,extensions.gen_salt('bf',10)) end,
    updated_at=now()
  where id=v_id returning * into v_row;
  return jsonb_build_object('id',v_row.id,'name',v_row.name,'phone',v_row.phone);
end
$$;

create or replace function public.alin_student_logout(p_token text,p_device text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.student_sessions
  where token_hash=public.alin_security_hash(p_token)
    and device_hash=public.alin_security_hash(coalesce(nullif(p_device,''),'unknown'));
  return true;
end
$$;

create or replace function public.alin_student_orders(p_token text,p_device text)
returns setof jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid; v_phone text;
begin
  v_id:=public.alin_student_session_account(p_token,p_device);
  if v_id is null then return; end if;
  select phone into v_phone from public.student_accounts where id=v_id;
  return query
    select jsonb_build_object(
      'id',o.id,'order_number',coalesce(to_jsonb(o)->>'order_number',o.id::text),
      'kind',to_jsonb(o)->>'kind','item_name',coalesce(to_jsonb(o)->>'item_name',to_jsonb(o)->>'title','طلب'),
      'qty',coalesce(to_jsonb(o)->>'qty','1'),'total',coalesce(to_jsonb(o)->>'total',to_jsonb(o)->>'total_amount','0'),
      'status',to_jsonb(o)->>'status','created_at',to_jsonb(o)->>'created_at'
    )
    from public.orders o
    where public.alin_normalize_phone(coalesce(to_jsonb(o)->>'student_phone',''))=v_phone
    order by o.created_at desc
    limit 50;
end
$$;

revoke all on function public.alin_student_session_account(text,text) from public;
revoke all on function public.alin_student_register(text,text,text,text) from public;
revoke all on function public.alin_student_login(text,text,text) from public;
revoke all on function public.alin_student_profile(text,text) from public;
revoke all on function public.alin_student_update(text,text,text,text,text) from public;
revoke all on function public.alin_student_logout(text,text) from public;
revoke all on function public.alin_student_orders(text,text) from public;
grant execute on function public.alin_student_register(text,text,text,text) to anon,authenticated;
grant execute on function public.alin_student_login(text,text,text) to anon,authenticated;
grant execute on function public.alin_student_profile(text,text) to anon,authenticated;
grant execute on function public.alin_student_update(text,text,text,text,text) to anon,authenticated;
grant execute on function public.alin_student_logout(text,text) to anon,authenticated;
grant execute on function public.alin_student_orders(text,text) to anon,authenticated;

do $$ begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='orders' and column_name='student_phone') then
    execute 'create index if not exists orders_student_phone_idx on public.orders(student_phone)';
  end if;
end $$;

-- ------------------------------------------------------------
-- 5) عرض طلبات المدرس بدون بيانات الطالب الحساسة
-- ------------------------------------------------------------
do $$
declare v_cols text;
begin
  if to_regclass('public.orders') is null then return; end if;
  select string_agg(quote_ident(column_name),', ' order by ordinal_position)
  into v_cols
  from information_schema.columns
  where table_schema='public' and table_name='orders'
    and column_name <> all(array[
      'student_phone','customer_phone','phone','mobile','delivery_address','delivery_landmark',
      'delivery_latitude','delivery_longitude','delivery_location_url','delivery_location_accuracy',
      'gps','coordinates'
    ]);
  execute 'drop view if exists public.alin_teacher_orders';
  execute format('create view public.alin_teacher_orders with (security_invoker=true) as select %s from public.orders',v_cols);
  execute 'revoke all on public.alin_teacher_orders from public';
  execute 'grant select on public.alin_teacher_orders to authenticated';
end $$;

-- ------------------------------------------------------------
-- 6) إشعارات القراءة لكل حساب بصورة منفصلة
-- ------------------------------------------------------------
create table if not exists public.notification_reads (
  notification_id text not null,
  account_id text not null,
  read_at timestamptz not null default now(),
  primary key(notification_id,account_id)
);
alter table public.notification_reads enable row level security;
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname='public' and tablename='notification_reads' loop
    execute format('drop policy if exists %I on public.notification_reads',p.policyname);
  end loop;
end $$;
create policy notification_reads_own_select on public.notification_reads
for select to authenticated using(account_id=public.alin_current_account_id() or public.alin_is_admin());
create policy notification_reads_own_insert on public.notification_reads
for insert to authenticated with check(account_id=public.alin_current_account_id());
create policy notification_reads_own_delete on public.notification_reads
for delete to authenticated using(account_id=public.alin_current_account_id());
revoke all on public.notification_reads from anon;
grant select,insert,delete on public.notification_reads to authenticated;


-- ------------------------------------------------------------
-- 7) ثبات مخطط الطلبات: الإضافات الجديدة لا تكسر السلة
-- ------------------------------------------------------------
-- السبب الجذري للإشكالات السابقة كان إدخال سجل orders كاملاً؛ الأعمدة غير
-- المذكورة في الطلب كانت تتحول إلى NULL بدل استخدام DEFAULT. الإدخال الآتي
-- يرسل الأعمدة الموجودة في الحمولة فقط، لذلك أي عمود جديد له DEFAULT لا يكسر السلة.

-- نعطّل مشغّل حماية الطلبات مؤقتاً أثناء ترحيل القيم القديمة فقط.
-- هذا الإجراء داخل المعاملة؛ إذا فشل أي جزء تتراجع قاعدة البيانات تلقائياً
-- ويعود المشغّل إلى حالته السابقة.
do $$
begin
  if exists(
    select 1
    from pg_trigger
    where tgrelid='public.orders'::regclass
      and tgname='alin_orders_protect_update'
      and not tgisinternal
  ) then
    execute 'alter table public.orders disable trigger alin_orders_protect_update';
  end if;
end $$;

do $$
declare r record;
begin
  for r in
    select * from (values
      ('created_at','now()'),
      ('updated_at','now()'),
      ('status','''new'''),
      ('assignment_status','''pending_admin'''),
      ('status_history','''[]''::jsonb'),
      ('payment_status','''cod_pending'''),
      ('delivery_fee','0'),
      ('stock_reserved','false'),
      ('settlement_done','false'),
      ('settlement_cancelled','false'),
      ('platform_profit','0'),
      ('teacher_profit','0'),
      ('library_profit','0'),
      ('delegate_profit','0'),
      ('courier_profit','0'),
      ('library_cash_collected','0'),
      ('delegate_cash_collected','0')
    ) as v(column_name,default_sql)
  loop
    if exists(
      select 1 from information_schema.columns
      where table_schema='public' and table_name='orders' and column_name=r.column_name
    ) then
      execute format('update public.orders set %I=%s where %I is null',r.column_name,r.default_sql,r.column_name);
      execute format('alter table public.orders alter column %I set default %s',r.column_name,r.default_sql);
      execute format('alter table public.orders alter column %I set not null',r.column_name);
    end if;
  end loop;
end $$;

-- إعادة تشغيل حماية الطلبات بعد اكتمال ترحيل القيم الافتراضية.
do $$
begin
  if exists(
    select 1
    from pg_trigger
    where tgrelid='public.orders'::regclass
      and tgname='alin_orders_protect_update'
      and not tgisinternal
  ) then
    execute 'alter table public.orders enable trigger alin_orders_protect_update';
  end if;
end $$;

create or replace function public.alin_insert_order_payload(p_payload jsonb)
returns table(order_id text,order_number text)
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_columns text;
  v_select_columns text;
  v_sql text;
begin
  if p_payload is null or jsonb_typeof(p_payload)<>'object' then
    raise exception 'بيانات الطلب غير صالحة';
  end if;

  select
    string_agg(format('%I',c.column_name),', ' order by c.ordinal_position),
    string_agg(format('r.%I',c.column_name),', ' order by c.ordinal_position)
  into v_columns,v_select_columns
  from information_schema.columns c
  where c.table_schema='public'
    and c.table_name='orders'
    and coalesce(c.is_generated,'NEVER')='NEVER'
    and coalesce(c.is_identity,'NO')<>'YES'
    and p_payload ? c.column_name;

  if coalesce(v_columns,'')='' then
    raise exception 'لا توجد أعمدة طلب صالحة للإدخال';
  end if;

  v_sql:=format(
    'insert into public.orders (%s) select %s from jsonb_populate_record(null::public.orders,$1) as r returning id::text,order_number::text',
    v_columns,v_select_columns
  );
  execute v_sql using p_payload into order_id,order_number;
  return next;
end
$$;

revoke all on function public.alin_insert_order_payload(jsonb) from public,anon,authenticated;

create or replace function public.alin_create_store_orders(
  p_items jsonb,
  p_customer jsonb,
  p_fulfillment jsonb default '{}'::jsonb,
  p_coupon_code text default null
)
returns table(order_number text, order_id text)
language plpgsql
security definer
set search_path=public,extensions,pg_temp
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

    v_order_number:='AL-'||to_char(clock_timestamp(),'YYMMDDHH24MISS')||'-'||lpad(v_index::text,2,'0')||'-'||substr(replace(extensions.gen_random_uuid()::text,'-',''),1,4);
    v_order_id:=extensions.gen_random_uuid()::text;
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

    select x.order_id,x.order_number
      into v_order_id,v_order_number
    from public.alin_insert_order_payload(v_payload) x;

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


revoke all on function public.alin_create_store_orders(jsonb,jsonb,jsonb,text) from public,anon,authenticated;


delete from public.student_sessions where expires_at<=now();
delete from public.auth_login_guard where updated_at<now()-interval '30 days';

-- ============================================================
-- التخزين الخاص للملازم وطلبات المدرسين — سياسة موحدة v3.1.0
-- تعتمد مباشرة على auth.uid وربط الحساب والطلب، بدون الاعتماد على كاش الواجهة.
-- ============================================================

update storage.buckets
set public=true,
    file_size_limit=5242880,
    allowed_mime_types=array['image/jpeg','image/png','image/webp']
where id='alin-files';

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

create or replace function public.alin_private_current_account()
returns jsonb
language sql stable security definer
set search_path=public
as $$
  select to_jsonb(a)
  from public.accounts a
  where a.auth_user_id=auth.uid()
    and lower(coalesce(a.status,'active'))='active'
    and nullif(to_jsonb(a)->>'deleted_at','') is null
  limit 1
$$;

create or replace function public.alin_private_can_insert_v310(p_name text)
returns boolean
language plpgsql stable security definer
set search_path=public,storage
as $$
declare
  v_parts text[]:=storage.foldername(p_name);
  v_account jsonb:=public.alin_private_current_account();
  v_role text:=lower(coalesce(v_account->>'role',''));
  v_account_id text:=coalesce(v_account->>'id','');
  v_ext text:=lower(split_part(p_name,'.',array_length(string_to_array(p_name,'.'),1)));
begin
  if v_account is null then return false; end if;

  if v_role='admin' then
    return (
      (v_parts[1]='booklets' and array_length(v_parts,1)=2 and v_ext='pdf')
      or
      (v_parts[1]='teacher-requests' and array_length(v_parts,1)=3 and v_ext='docx')
    );
  end if;

  if v_role='teacher' then
    return v_parts[1]='teacher-requests'
       and array_length(v_parts,1)=3
       and v_parts[2]=v_account_id
       and length(coalesce(v_parts[3],''))>0
       and v_ext='docx';
  end if;

  return false;
end
$$;

create or replace function public.alin_private_library_has_order_v310(
  p_library_id text,
  p_booklet_id text
)
returns boolean
language sql stable security definer
set search_path=public
as $$
  select exists(
    select 1
    from public.orders o
    cross join lateral (select to_jsonb(o) as j) x
    where coalesce(x.j->>'item_id',x.j->>'booklet_id',x.j->'item'->>'id','')=p_booklet_id
      and p_library_id in (
        coalesce(x.j->>'library_id',''),
        coalesce(x.j->>'pickup_library_id',''),
        coalesce(x.j->>'assigned_library_id','')
      )
      and lower(coalesce(x.j->>'kind',x.j->>'item_kind',x.j->>'item_type','booklet'))
          in ('booklet','booklets','booklet_product','ملزمة','ملازم')
      and lower(coalesce(x.j->>'status',x.j->>'order_status','new')) not in (
        'cancelled','canceled','completed','delivered','rejected','ملغي','مكتمل','تم التسليم'
      )
  )
$$;

create or replace function public.alin_private_can_select_v310(p_name text)
returns boolean
language plpgsql stable security definer
set search_path=public,storage
as $$
declare
  v_parts text[]:=storage.foldername(p_name);
  v_account jsonb:=public.alin_private_current_account();
  v_role text:=lower(coalesce(v_account->>'role',''));
  v_account_id text:=coalesce(v_account->>'id','');
  v_root text:=coalesce(v_parts[1],'');
  v_entity text:=coalesce(v_parts[2],'');
begin
  if v_account is null then return false; end if;
  if v_role='admin' then return true; end if;

  if v_root='teacher-requests' then
    if array_length(v_parts,1)<>3 or v_role<>'teacher' or v_parts[2]<>v_account_id then
      return false;
    end if;
    return exists(
      select 1
      from public.teacher_requests r
      where r.id::text=v_parts[3]
        and r.teacher_id::text=v_account_id
    );
  end if;

  if v_root='booklets' then
    if array_length(v_parts,1)<>2 or v_entity='' then return false; end if;

    if v_role='teacher' then
      return exists(
        select 1
        from public.booklets b
        where b.id::text=v_entity
          and b.teacher_id::text=v_account_id
      );
    end if;

    if v_role='library' then
      return public.alin_private_library_has_order_v310(v_account_id,v_entity);
    end if;
  end if;

  return false;
end
$$;

revoke all on function public.alin_private_current_account() from public,anon;
revoke all on function public.alin_private_can_insert_v310(text) from public,anon;
revoke all on function public.alin_private_library_has_order_v310(text,text) from public,anon;
revoke all on function public.alin_private_can_select_v310(text) from public,anon;
grant execute on function public.alin_private_current_account() to authenticated;
grant execute on function public.alin_private_can_insert_v310(text) to authenticated;
grant execute on function public.alin_private_library_has_order_v310(text,text) to authenticated;
grant execute on function public.alin_private_can_select_v310(text) to authenticated;

do $$
declare p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname='storage'
      and tablename='objects'
      and policyname like 'alin_private_%'
  loop
    execute format('drop policy if exists %I on storage.objects',p.policyname);
  end loop;
end
$$;

create policy alin_private_v310_select
on storage.objects for select to authenticated
using (
  bucket_id='alin-private'
  and public.alin_private_can_select_v310(name)
);

create policy alin_private_v310_insert
on storage.objects for insert to authenticated
with check (
  bucket_id='alin-private'
  and public.alin_private_can_insert_v310(name)
);

create policy alin_private_v310_update_admin
on storage.objects for update to authenticated
using (
  bucket_id='alin-private'
  and lower(coalesce(public.alin_private_current_account()->>'role','')) ='admin'
)
with check (
  bucket_id='alin-private'
  and lower(coalesce(public.alin_private_current_account()->>'role','')) ='admin'
);

create policy alin_private_v310_delete_admin
on storage.objects for delete to authenticated
using (
  bucket_id='alin-private'
  and lower(coalesce(public.alin_private_current_account()->>'role','')) ='admin'
);



-- ============================================================
-- النظام المالي الذري الموحد
-- ============================================================
create extension if not exists pgcrypto with schema extensions;

-- ============================================================
-- 1) توحيد أعمدة الطلب والسجل المالي
-- ============================================================
alter table public.orders add column if not exists settlement_done boolean not null default false;
alter table public.orders add column if not exists settlement_cancelled boolean not null default false;
alter table public.orders add column if not exists settlement_at timestamptz;
alter table public.orders add column if not exists settlement_party text;
alter table public.orders add column if not exists platform_profit numeric not null default 0;
alter table public.orders add column if not exists teacher_profit numeric not null default 0;
alter table public.orders add column if not exists library_profit numeric not null default 0;
alter table public.orders add column if not exists delegate_profit numeric not null default 0;
alter table public.orders add column if not exists courier_profit numeric not null default 0;
alter table public.orders add column if not exists cash_collected_by text;
alter table public.orders add column if not exists cash_collected_at timestamptz;
alter table public.orders add column if not exists library_cash_collected numeric not null default 0;
alter table public.orders add column if not exists delegate_cash_collected numeric not null default 0;
alter table public.orders add column if not exists finance_version text;
alter table public.orders add column if not exists updated_at timestamptz not null default now();
alter table public.orders add column if not exists completed_at timestamptz;
alter table public.orders add column if not exists delivered_at timestamptz;
alter table public.orders add column if not exists cancelled_at timestamptz;
alter table public.orders add column if not exists cancellation_reason text;
alter table public.orders add column if not exists cancel_reason text;
alter table public.orders add column if not exists payment_status text not null default 'cod_pending';
alter table public.orders add column if not exists assignment_status text not null default 'pending_admin';
alter table public.orders add column if not exists status_history jsonb not null default '[]'::jsonb;
alter table public.orders add column if not exists assigned_at timestamptz;
alter table public.orders add column if not exists accepted_at timestamptz;
alter table public.orders add column if not exists picked_up_at timestamptz;
alter table public.orders add column if not exists out_for_delivery_at timestamptz;
alter table public.orders add column if not exists processing_at timestamptz;
alter table public.orders add column if not exists ready_at timestamptz;

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
alter table public.ledger add column if not exists merchandise_total numeric not null default 0;
alter table public.ledger add column if not exists delivery_fee numeric not null default 0;
alter table public.ledger add column if not exists collector_role text;
alter table public.ledger add column if not exists collector_id text;
alter table public.ledger add column if not exists collector_debt numeric not null default 0;
alter table public.ledger add column if not exists delivery_type text;
alter table public.ledger add column if not exists settlement_status text not null default 'pending';
alter table public.ledger add column if not exists finance_version text;
alter table public.ledger add column if not exists is_current boolean not null default true;
alter table public.ledger add column if not exists note text;
alter table public.ledger add column if not exists created_at timestamptz not null default now();
alter table public.ledger add column if not exists updated_at timestamptz not null default now();
alter table public.ledger add column if not exists settled_at timestamptz;

-- ============================================================
-- توحيد حالات السجل المالي بنظام متوافق مع جميع الإصدارات
-- الحالة الفعالة القياسية: pending. ويُقبل accrued/unsettled للبيانات القديمة.
-- ============================================================
alter table public.ledger add column if not exists status text;
alter table public.ledger add column if not exists settlement_status text;

alter table public.ledger alter column status set default 'pending';
alter table public.ledger alter column settlement_status set default 'pending';

update public.ledger
set status = case lower(btrim(coalesce(status,'')))
  when '' then 'pending'
  when 'unsettled' then 'pending'
  when 'accrued' then 'pending'
  when 'received' then 'settled'
  when 'paid' then 'settled'
  when 'canceled' then 'cancelled'
  when 'active' then 'pending'
  when 'done' then 'settled'
  else lower(btrim(status))
end;

update public.ledger
set settlement_status = case lower(btrim(coalesce(settlement_status,'')))
  when '' then case lower(coalesce(status,'pending'))
    when 'settled' then 'settled'
    when 'cancelled' then 'cancelled'
    when 'reversed' then 'reversed'
    when 'superseded' then 'superseded'
    else 'pending' end
  when 'accrued' then 'pending'
  when 'unsettled' then 'pending'
  when 'paid' then 'settled'
  when 'received' then 'settled'
  when 'canceled' then 'cancelled'
  when 'active' then 'pending'
  when 'done' then 'settled'
  else lower(btrim(settlement_status))
end;

update public.ledger
set status='pending'
where status not in ('pending','unsettled','accrued','settled','paid','received','cancelled','canceled','reversed','superseded');

update public.ledger
set settlement_status='pending'
where settlement_status not in ('pending','unsettled','accrued','settled','paid','received','cancelled','canceled','reversed','superseded');

alter table public.ledger alter column status set not null;
alter table public.ledger alter column settlement_status set not null;

-- إزالة أي قيود حالة متبقية مهما كان اسمها قبل تثبيت القيود القياسية.
do $$
declare r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid='public.ledger'::regclass
      and contype='c'
      and pg_get_constraintdef(oid) ~* '(status|settlement_status)'
  loop
    execute format('alter table public.ledger drop constraint if exists %I',r.conname);
  end loop;
end
$$;

alter table public.ledger add constraint ledger_status_valid check (
  status in ('pending','unsettled','accrued','settled','paid','received','cancelled','canceled','reversed','superseded')
) not valid;
alter table public.ledger add constraint ledger_settlement_status_valid check (
  settlement_status in ('pending','unsettled','accrued','settled','paid','received','cancelled','canceled','reversed','superseded')
) not valid;
alter table public.ledger validate constraint ledger_status_valid;
alter table public.ledger validate constraint ledger_settlement_status_valid;

create index if not exists ledger_order_id_stage5_idx on public.ledger ((order_id::text));
create index if not exists ledger_teacher_stage5_idx on public.ledger ((teacher_id::text),settlement_status);
create index if not exists ledger_library_stage5_idx on public.ledger ((library_id::text),settlement_status);
create index if not exists ledger_delegate_stage5_idx on public.ledger ((delegate_id::text),settlement_status);

-- نحتفظ بالسجلات القديمة، لكن سجل واحد فقط يبقى فعالاً لكل طلب.
with ranked as (
  select ctid,
         row_number() over(
           partition by nullif(order_id::text,'')
           order by coalesce(settled_at,updated_at,created_at) desc nulls last, ctid desc
         ) as rn
  from public.ledger
  where nullif(order_id::text,'') is not null
)
update public.ledger l
set is_current=(r.rn=1),
    status=case when r.rn=1 then coalesce(nullif(l.status,''),'pending') else 'superseded' end,
    settlement_status=case when r.rn=1 then coalesce(nullif(l.settlement_status,''),'pending') else 'superseded' end,
    updated_at=now()
from ranked r
where l.ctid=r.ctid;

create unique index if not exists ledger_one_current_order_stage5_uidx
on public.ledger ((order_id::text))
where is_current=true and nullif(order_id::text,'') is not null;

-- ============================================================
-- 2) جداول التسويات القياسية
-- ============================================================
create table if not exists public.library_settlements(
  id text primary key,
  receipt_number text,
  library_id text not null,
  amount numeric not null default 0,
  payment_method text not null default 'نقدي',
  note text,
  status text not null default 'received',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.library_settlements add column if not exists receipt_number text;
alter table public.library_settlements add column if not exists library_id text;
alter table public.library_settlements add column if not exists amount numeric not null default 0;
alter table public.library_settlements add column if not exists payment_method text not null default 'نقدي';
alter table public.library_settlements add column if not exists note text;
alter table public.library_settlements add column if not exists status text not null default 'received';
alter table public.library_settlements add column if not exists created_by text;
alter table public.library_settlements add column if not exists created_at timestamptz not null default now();
alter table public.library_settlements add column if not exists updated_at timestamptz not null default now();

create table if not exists public.delegate_settlements(
  id text primary key,
  receipt_number text,
  delegate_id text not null,
  courier_id text,
  amount numeric not null default 0,
  payment_method text not null default 'نقدي',
  note text,
  status text not null default 'received',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.delegate_settlements add column if not exists receipt_number text;
alter table public.delegate_settlements add column if not exists delegate_id text;
alter table public.delegate_settlements add column if not exists courier_id text;
alter table public.delegate_settlements add column if not exists amount numeric not null default 0;
alter table public.delegate_settlements add column if not exists payment_method text not null default 'نقدي';
alter table public.delegate_settlements add column if not exists note text;
alter table public.delegate_settlements add column if not exists status text not null default 'received';
alter table public.delegate_settlements add column if not exists created_by text;
alter table public.delegate_settlements add column if not exists created_at timestamptz not null default now();
alter table public.delegate_settlements add column if not exists updated_at timestamptz not null default now();

create table if not exists public.financial_payouts(
  id text primary key,
  voucher_number text,
  party_role text not null,
  party_id text,
  party_name text,
  amount numeric not null default 0,
  payment_method text not null default 'نقدي',
  note text,
  status text not null default 'paid',
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.financial_payouts add column if not exists voucher_number text;
alter table public.financial_payouts add column if not exists party_role text;
alter table public.financial_payouts add column if not exists party_id text;
alter table public.financial_payouts add column if not exists party_name text;
alter table public.financial_payouts add column if not exists amount numeric not null default 0;
alter table public.financial_payouts add column if not exists payment_method text not null default 'نقدي';
alter table public.financial_payouts add column if not exists note text;
alter table public.financial_payouts add column if not exists status text not null default 'paid';
alter table public.financial_payouts add column if not exists created_by text;
alter table public.financial_payouts add column if not exists created_at timestamptz not null default now();
alter table public.financial_payouts add column if not exists updated_at timestamptz not null default now();

create index if not exists library_settlements_party_stage5_idx on public.library_settlements ((library_id::text),status);
create index if not exists delegate_settlements_party_stage5_idx on public.delegate_settlements ((coalesce(delegate_id,courier_id)::text),status);
create index if not exists financial_payouts_party_stage5_idx on public.financial_payouts (party_role,(party_id::text),status);


-- توحيد توليد المعرّفات مع قواعد قديمة يكون فيها id نصاً أو UUID.
do $$
declare t text; v_udt text;
begin
  foreach t in array array['library_settlements','delegate_settlements','financial_payouts'] loop
    select c.udt_name into v_udt
    from information_schema.columns c
    where c.table_schema='public' and c.table_name=t and c.column_name='id';
    if v_udt='uuid' then
      execute format('alter table public.%I alter column id set default extensions.gen_random_uuid()',t);
    elsif v_udt in ('text','varchar','bpchar') then
      execute format('alter table public.%I alter column id set default (extensions.gen_random_uuid()::text)',t);
    end if;
  end loop;
end $$;

-- ============================================================
-- 3) أدوات قراءة الإعدادات والقيم
-- ============================================================
create or replace function public.alin_setting_numeric(p_key text,p_default numeric)
returns numeric
language plpgsql stable security definer
set search_path=public,pg_temp
as $$
declare v numeric;
begin
  if to_regclass('public.settings') is null then return p_default; end if;
  begin
    execute 'select nullif(value::text,'''')::numeric from public.settings where key::text=$1 limit 1'
      into v using p_key;
  exception when others then v:=null;
  end;
  return coalesce(v,p_default);
end
$$;
revoke all on function public.alin_setting_numeric(text,numeric) from public,anon,authenticated;

create or replace function public.alin_finance_json_num(p_row jsonb,p_keys text[],p_default numeric default 0)
returns numeric
language plpgsql immutable
as $$
declare k text; v numeric;
begin
  foreach k in array p_keys loop
    begin
      if nullif(p_row->>k,'') is not null then
        v:=(p_row->>k)::numeric;
        return coalesce(v,p_default);
      end if;
    exception when others then null;
    end;
  end loop;
  return p_default;
end
$$;
revoke all on function public.alin_finance_json_num(jsonb,text[],numeric) from public,anon,authenticated;

-- ============================================================
-- 4) احتساب وتثبيت القيد المالي لطلب مكتمل فقط
-- ============================================================
create or replace function public.alin_upsert_order_finance_atomic(p_order_id text)
returns jsonb
language plpgsql security definer
set search_path=public,extensions,pg_temp
as $$
declare
  o public.orders%rowtype;
  j jsonb;
  b jsonb:=null;
  v_kind text;
  v_fulfillment text;
  v_order_number text;
  v_booklet_id text;
  v_teacher_id text;
  v_library_id text;
  v_delegate_id text;
  v_collector_role text;
  v_collector_id text;
  v_total numeric:=0;
  v_delivery_fee numeric:=0;
  v_merchandise numeric:=0;
  v_teacher_pct numeric:=0;
  v_library_pct numeric:=0;
  v_delegate_pct numeric:=0;
  v_teacher numeric:=0;
  v_library numeric:=0;
  v_delegate numeric:=0;
  v_admin numeric:=0;
  v_debt numeric:=0;
  v_ledger_id text;
  v_payload jsonb;
begin
  select * into o from public.orders where id::text=p_order_id for update;
  if not found then raise exception 'الطلب غير موجود'; end if;
  j:=to_jsonb(o);

  if lower(coalesce(j->>'status','')) not in ('completed','delivered') then
    raise exception 'لا يمكن إنشاء حسابات قبل تسليم الطلب';
  end if;

  v_order_number:=coalesce(nullif(j->>'order_number',''),p_order_id);
  v_kind:=lower(coalesce(nullif(j->>'kind',''),nullif(j->>'item_kind',''),'product'));
  v_fulfillment:=lower(coalesce(nullif(j->>'fulfillment_type',''),nullif(j->>'delivery_type',''),nullif(j->>'delivery_method',''),''));
  v_booklet_id:=coalesce(nullif(j->>'item_id',''),nullif(j->>'booklet_id',''));
  v_teacher_id:=nullif(j->>'teacher_id','');
  v_library_id:=coalesce(nullif(j->>'library_id',''),nullif(j->>'pickup_library_id',''),nullif(j->>'assigned_library_id',''));
  v_delegate_id:=coalesce(nullif(j->>'delegate_id',''),nullif(j->>'courier_id',''));
  v_total:=greatest(public.alin_finance_json_num(j,array['total'],0),0);
  v_delivery_fee:=least(v_total,greatest(public.alin_finance_json_num(j,array['delivery_fee'],0),0));
  v_merchandise:=greatest(v_total-v_delivery_fee,0);

  if v_total<=0 then raise exception 'مبلغ الطلب غير صالح للحسابات'; end if;

  if v_booklet_id is not null and to_regclass('public.booklets') is not null then
    select to_jsonb(x) into b from public.booklets x where x.id::text=v_booklet_id limit 1;
  end if;
  if v_teacher_id is null then v_teacher_id:=nullif(b->>'teacher_id',''); end if;

  v_teacher_pct:=least(greatest(
    case when v_kind in ('booklet','booklets','booklet_product','ملزمة','ملازم')
      then coalesce(nullif(public.alin_finance_json_num(b,array['teacher_share_percent'],-1),-1),public.alin_setting_numeric('teacher_profit_percent',50))
      else 0 end,0),100);
  v_library_pct:=least(greatest(
    coalesce(nullif(public.alin_finance_json_num(b,array['library_share_percent'],-1),-1),public.alin_setting_numeric('library_profit_percent',30)),0),100);
  v_delegate_pct:=least(greatest(public.alin_setting_numeric('delegate_profit_percent',30),0),100);

  if v_delegate_id is not null or v_fulfillment ~ '(home_delivery|delivery|courier|delegate|مندوب)' then
    v_collector_role:='delegate';
    v_collector_id:=v_delegate_id;
    if v_collector_id is null then raise exception 'طلب التوصيل غير مرتبط بمندوب'; end if;
    v_teacher:=least(v_merchandise,greatest(round(v_merchandise*v_teacher_pct/100),0));
    v_delegate:=least(v_delivery_fee,greatest(round(v_delivery_fee*v_delegate_pct/100),0));
    v_library:=0;
    v_admin:=greatest(v_total-v_teacher-v_delegate,0);
  else
    v_collector_role:='library';
    v_collector_id:=v_library_id;
    if v_collector_id is null then raise exception 'طلب الاستلام غير مرتبط بمكتبة'; end if;
    v_teacher:=least(v_merchandise,greatest(round(v_merchandise*v_teacher_pct/100),0));
    v_library:=least(greatest(v_merchandise-v_teacher,0),greatest(round(v_merchandise*v_library_pct/100),0));
    v_delegate:=0;
    v_admin:=greatest(v_total-v_teacher-v_library,0);
  end if;

  -- ضمان أن مجموع الحصص يساوي مبلغ الطلب بالضبط.
  v_admin:=v_admin+(v_total-(v_admin+v_teacher+v_library+v_delegate));
  v_debt:=greatest(v_total-case when v_collector_role='library' then v_library else v_delegate end,0);

  select id::text into v_ledger_id
  from public.ledger
  where order_id::text=p_order_id and is_current=true
  order by coalesce(updated_at,created_at) desc nulls last
  limit 1 for update;

  v_payload:=jsonb_build_object(
    'order_id',p_order_id,'order_number',v_order_number,
    'title',coalesce(nullif(j->>'title',''),'طلب منصة آلين'),
    'alin',v_admin,'admin',v_admin,'teacher',v_teacher,'teacher_id',v_teacher_id,
    'library',v_library,'library_id',v_library_id,
    'delegate',v_delegate,'delegate_id',v_delegate_id,
    'total',v_total,'merchandise_total',v_merchandise,'delivery_fee',v_delivery_fee,
    'collector_role',v_collector_role,'collector_id',v_collector_id,'collector_debt',v_debt,
    'delivery_type',v_collector_role,'status','pending','settlement_status','pending',
    'finance_version','2.8.0','is_current',true,
    'settled_at',now(),'updated_at',now(),
    'note','قيد مالي ذري من الطلب المكتمل'
  );

  if v_ledger_id is null then
    v_ledger_id:=gen_random_uuid()::text;
    v_payload:=v_payload||jsonb_build_object('id',v_ledger_id,'created_at',now());
    insert into public.ledger select (jsonb_populate_record(null::public.ledger,v_payload)).*;
  else
    update public.ledger l set
      order_number=x.order_number,title=x.title,alin=x.alin,admin=x.admin,
      teacher=x.teacher,teacher_id=x.teacher_id,library=x.library,library_id=x.library_id,
      delegate=x.delegate,delegate_id=x.delegate_id,total=x.total,
      merchandise_total=x.merchandise_total,delivery_fee=x.delivery_fee,
      collector_role=x.collector_role,collector_id=x.collector_id,collector_debt=x.collector_debt,
      delivery_type=x.delivery_type,status=x.status,settlement_status=x.settlement_status,
      finance_version=x.finance_version,is_current=true,settled_at=x.settled_at,
      updated_at=x.updated_at,note=x.note
    from (select (jsonb_populate_record(null::public.ledger,v_payload)).*) x
    where l.id::text=v_ledger_id;
  end if;

  perform set_config('alin.internal_order_transition','on',true);
  update public.orders set
    settlement_done=true,settlement_cancelled=false,settlement_at=coalesce(settlement_at,now()),
    settlement_party=v_collector_role,
    platform_profit=v_admin,teacher_profit=v_teacher,library_profit=v_library,
    delegate_profit=v_delegate,courier_profit=v_delegate,
    cash_collected_by=v_collector_role,cash_collected_at=coalesce(cash_collected_at,now()),
    library_cash_collected=case when v_collector_role='library' then v_total else 0 end,
    delegate_cash_collected=case when v_collector_role='delegate' then v_total else 0 end,
    finance_version='2.8.0',updated_at=now()
  where id::text=p_order_id;
  perform set_config('alin.internal_order_transition','off',true);

  return jsonb_build_object(
    'ledger_id',v_ledger_id,'order_id',p_order_id,'total',v_total,
    'merchandise_total',v_merchandise,'delivery_fee',v_delivery_fee,
    'admin',v_admin,'teacher',v_teacher,'library',v_library,'delegate',v_delegate,
    'collector_role',v_collector_role,'collector_id',v_collector_id,'collector_debt',v_debt
  );
end
$$;
revoke all on function public.alin_upsert_order_finance_atomic(text) from public,anon,authenticated;

-- توافق مع الاسم السابق، لكنه لم يعد متاحاً مباشرة للمستخدم.
create or replace function public.alin_upsert_order_finance(p_order_id text)
returns jsonb language sql security definer
set search_path=public,extensions,pg_temp
as $$ select public.alin_upsert_order_finance_atomic(p_order_id) $$;
revoke all on function public.alin_upsert_order_finance(text) from public,anon,authenticated;

-- ============================================================
-- 5) انتقال حالة الطلب والحسابات داخل معاملة واحدة
-- ============================================================
create or replace function public.alin_order_transition_atomic(
  p_order_id text,
  p_status text,
  p_reason text default null
)
returns jsonb
language plpgsql security definer
set search_path=public,extensions,pg_temp
as $$
declare
  o public.orders%rowtype;
  j jsonb;
  v_role text:=public.alin_current_role();
  v_account text:=public.alin_current_account_id();
  v_source text;
  v_target text:=lower(btrim(coalesce(p_status,'')));
  v_library text;
  v_delegate text;
  v_history jsonb;
  v_now timestamptz:=now();
  v_finance jsonb:=null;
  v_allowed boolean:=false;
begin
  select * into o from public.orders where id::text=p_order_id for update;
  if not found then raise exception 'الطلب غير موجود'; end if;
  j:=to_jsonb(o);
  v_source:=lower(coalesce(j->>'status','new'));
  if v_source='canceled' then v_source:='cancelled'; end if;
  if v_target='canceled' then v_target:='cancelled'; end if;
  if v_target='delivered' then v_target:='completed'; end if;
  v_library:=coalesce(nullif(j->>'library_id',''),nullif(j->>'pickup_library_id',''),nullif(j->>'assigned_library_id',''));
  v_delegate:=coalesce(nullif(j->>'delegate_id',''),nullif(j->>'courier_id',''));

  if v_target not in ('new','pending_admin','assigned','accepted','picked_up','out_for_delivery','processing','ready','completed','cancelled','rejected') then
    raise exception 'حالة الطلب المطلوبة غير صحيحة';
  end if;

  if public.alin_is_finance_staff() then
    v_allowed:=true;
  elsif v_role='library' and v_account is not null and v_account=v_library then
    v_allowed:=(
      (v_source in ('new','pending','pending_admin','accepted') and v_target in ('processing','cancelled')) or
      (v_source in ('processing','printing') and v_target in ('ready','cancelled')) or
      (v_source='ready' and v_target in ('completed','cancelled')) or
      (v_source='completed' and v_target='completed')
    );
  elsif v_role in ('courier','delegate') and v_account is not null and v_account=v_delegate then
    v_allowed:=(
      (v_source in ('assigned','new','pending_admin') and v_target in ('accepted','rejected')) or
      (v_source='accepted' and v_target in ('picked_up','rejected')) or
      (v_source='picked_up' and v_target in ('out_for_delivery','rejected')) or
      (v_source in ('out_for_delivery','out_delivery','processing') and v_target in ('completed','rejected')) or
      (v_source='completed' and v_target='completed')
    );
  end if;

  if not v_allowed then raise exception 'غير مسموح بتنفيذ انتقال حالة الطلب'; end if;
  if v_source in ('completed','delivered') and v_target not in ('completed') then
    raise exception 'الطلب المكتمل لا يلغى أو يرجع لحالة سابقة. استخدم إجراء إرجاع مالي مستقل.';
  end if;
  if v_target in ('cancelled','rejected') and nullif(btrim(coalesce(p_reason,'')),'') is null then
    raise exception 'اكتب سبب الإلغاء أو الرفض';
  end if;

  -- إعادة نفس أمر الإكمال تصلح الحسابات فقط من دون تكرار.
  if v_source in ('completed','delivered') and v_target='completed' then
    v_finance:=public.alin_upsert_order_finance_atomic(p_order_id);
    select to_jsonb(x) into j from public.orders x where x.id::text=p_order_id;
    return jsonb_build_object('ok',true,'order',j,'finance',v_finance,'repaired',true);
  end if;

  v_history:=coalesce(j->'status_history','[]'::jsonb)||jsonb_build_array(jsonb_build_object(
    'status',v_target,'at',v_now,'by',coalesce(v_account,'system'),
    'role',coalesce(v_role,'system'),'reason',nullif(btrim(coalesce(p_reason,'')),'')
  ));

  perform set_config('alin.internal_order_transition','on',true);
  update public.orders set
    status=v_target,status_history=v_history,updated_at=v_now,
    assignment_status=case
      when v_target='assigned' then 'assigned'
      when v_target='accepted' then 'accepted'
      when v_target='completed' then 'completed'
      when v_target='cancelled' then 'cancelled'
      when v_target='rejected' then 'rejected'
      else assignment_status end,
    assigned_at=case when v_target='assigned' then coalesce(assigned_at,v_now) else assigned_at end,
    accepted_at=case when v_target='accepted' then coalesce(accepted_at,v_now) else accepted_at end,
    picked_up_at=case when v_target='picked_up' then coalesce(picked_up_at,v_now) else picked_up_at end,
    out_for_delivery_at=case when v_target='out_for_delivery' then coalesce(out_for_delivery_at,v_now) else out_for_delivery_at end,
    processing_at=case when v_target='processing' then coalesce(processing_at,v_now) else processing_at end,
    ready_at=case when v_target='ready' then coalesce(ready_at,v_now) else ready_at end,
    completed_at=case when v_target='completed' then coalesce(completed_at,v_now) else completed_at end,
    delivered_at=case when v_target='completed' then coalesce(delivered_at,v_now) else delivered_at end,
    cancelled_at=case when v_target in ('cancelled','rejected') then coalesce(cancelled_at,v_now) else cancelled_at end,
    cancellation_reason=case when v_target in ('cancelled','rejected') then btrim(p_reason) else cancellation_reason end,
    cancel_reason=case when v_target in ('cancelled','rejected') then btrim(p_reason) else cancel_reason end,
    payment_status=case when v_target='completed' then 'paid' when v_target in ('cancelled','rejected') then 'cancelled' else payment_status end,
    settlement_done=case when v_target='completed' then settlement_done when v_target in ('cancelled','rejected') then false else settlement_done end,
    settlement_cancelled=case when v_target in ('cancelled','rejected') then true else settlement_cancelled end,
    platform_profit=case when v_target in ('cancelled','rejected') then 0 else platform_profit end,
    teacher_profit=case when v_target in ('cancelled','rejected') then 0 else teacher_profit end,
    library_profit=case when v_target in ('cancelled','rejected') then 0 else library_profit end,
    delegate_profit=case when v_target in ('cancelled','rejected') then 0 else delegate_profit end,
    courier_profit=case when v_target in ('cancelled','rejected') then 0 else courier_profit end
  where id::text=p_order_id;
  perform set_config('alin.internal_order_transition','off',true);

  if v_target='completed' then
    v_finance:=public.alin_upsert_order_finance_atomic(p_order_id);
  elsif v_target in ('cancelled','rejected') then
    update public.ledger set status='cancelled',settlement_status='cancelled',is_current=false,updated_at=v_now,
      note=coalesce(note,'')||' | ألغي الطلب قبل التسوية'
    where order_id::text=p_order_id and is_current=true;
  end if;

  select to_jsonb(x) into j from public.orders x where x.id::text=p_order_id;
  return jsonb_build_object('ok',true,'order',j,'finance',v_finance);
end
$$;
revoke all on function public.alin_order_transition_atomic(text,text,text) from public,anon;
grant execute on function public.alin_order_transition_atomic(text,text,text) to authenticated;

-- الاسم القديم للمكتبة يبقى Wrapper آمن لنفس المعاملة.
create or replace function public.alin_library_set_order_status(p_order_id text,p_status text,p_reason text default null)
returns jsonb language sql security definer
set search_path=public,extensions,pg_temp
as $$ select public.alin_order_transition_atomic(p_order_id,p_status,p_reason) $$;
revoke all on function public.alin_library_set_order_status(text,text,text) from public,anon;
grant execute on function public.alin_library_set_order_status(text,text,text) to authenticated;

-- ============================================================
-- 6) حماية مشغل الطلب مع السماح للمعاملة الداخلية فقط
-- ============================================================
create or replace function public.alin_protect_order_update()
returns trigger
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare
  v_role text:=public.alin_current_role();
  v_allowed text[];
begin
  -- الإنهاء الداخلي الآمن للطلب بعد الشراء (مرحلة 4). لا يسمح إلا بأربعة حقول مشتقة من الخادم.
  if current_setting('alin.internal_order_update',true)='stage4_checkout_finalize' then
    v_allowed:=array['checkout_request_key','checkout_group_id','stock_reserved','stock_restored_at'];
    if (to_jsonb(new)-v_allowed)<>(to_jsonb(old)-v_allowed) then
      raise exception 'تم منع تعديل داخلي غير مصرح في الطلب';
    end if;
    return new;
  end if;
  if current_setting('alin.internal_order_transition',true)='on' then return new; end if;
  if public.alin_is_admin() then return new; end if;
  if v_role='library' then
    v_allowed:=array['notes','library_note','updated_at'];
  elsif v_role in ('courier','delegate') then
    v_allowed:=array['delivery_note','proof_path','handoff_token','updated_at'];
  else
    raise exception 'غير مسموح بتعديل الطلب';
  end if;
  if (to_jsonb(new)-v_allowed)<>(to_jsonb(old)-v_allowed) then
    raise exception 'استخدم خدمة تحديث حالة الطلب الآمنة';
  end if;
  return new;
end
$$;
revoke all on function public.alin_protect_order_update() from public,anon,authenticated;
drop trigger if exists alin_orders_protect_update on public.orders;
create trigger alin_orders_protect_update before update on public.orders
for each row execute function public.alin_protect_order_update();

-- ============================================================
-- 7) حساب الرصيد وتسجيل التسويات بواسطة الإدارة فقط
-- ============================================================
create or replace function public.alin_finance_party_balance(p_role text,p_party_id text)
returns jsonb
language plpgsql stable security definer
set search_path=public,pg_temp
as $$
declare
  r text:=lower(replace(coalesce(p_role,''),'courier','delegate'));
  earned numeric:=0;
  debt numeric:=0;
  paid numeric:=0;
begin
  if not public.alin_is_finance_staff() then
    if r='admin' then raise exception 'غير مسموح بعرض رصيد المنصة'; end if;
    if public.alin_current_account_id() is null or public.alin_current_account_id()<>p_party_id then
      raise exception 'غير مسموح بعرض رصيد حساب آخر';
    end if;
    if not (
      (r='teacher' and public.alin_current_role()='teacher') or
      (r='library' and public.alin_current_role()='library') or
      (r='delegate' and public.alin_current_role() in ('courier','delegate'))
    ) then raise exception 'نوع الحساب لا يطابق جلسة الدخول'; end if;
  end if;
  if r='library' then
    select coalesce(sum(l.library),0),coalesce(sum(l.collector_debt),0)
      into earned,debt from public.ledger l
      where l.is_current=true and l.settlement_status in ('pending','accrued','unsettled') and l.collector_role='library' and l.library_id::text=p_party_id;
    select coalesce(sum(case when lower(coalesce(status,'received')) in ('received','paid','settled') then amount else 0 end),0)
      into paid from public.library_settlements where library_id::text=p_party_id;
    return jsonb_build_object('role',r,'earned',earned,'debt_total',debt,'paid',paid,'remaining',greatest(debt-paid,0));
  elsif r='delegate' then
    select coalesce(sum(l.delegate),0),coalesce(sum(l.collector_debt),0)
      into earned,debt from public.ledger l
      where l.is_current=true and l.settlement_status in ('pending','accrued','unsettled') and l.collector_role='delegate' and l.delegate_id::text=p_party_id;
    select coalesce(sum(case when lower(coalesce(status,'received')) in ('received','paid','settled') then amount else 0 end),0)
      into paid from public.delegate_settlements where coalesce(delegate_id,courier_id)::text=p_party_id;
    return jsonb_build_object('role',r,'earned',earned,'debt_total',debt,'paid',paid,'remaining',greatest(debt-paid,0));
  elsif r='teacher' then
    select coalesce(sum(l.teacher),0) into earned from public.ledger l
      where l.is_current=true and l.settlement_status in ('pending','accrued','unsettled') and l.teacher_id::text=p_party_id;
  elsif r='admin' then
    select coalesce(sum(l.admin),0) into earned from public.ledger l
      where l.is_current=true and l.settlement_status in ('pending','accrued','unsettled');
  else
    raise exception 'نوع الحساب المالي غير صحيح';
  end if;
  select coalesce(sum(case when lower(coalesce(status,'paid')) in ('paid','received','settled') then amount else 0 end),0)
    into paid from public.financial_payouts
    where lower(replace(coalesce(party_role,''),'courier','delegate'))=r
      and (r='admin' or party_id::text=p_party_id);
  return jsonb_build_object('role',r,'earned',earned,'paid',paid,'remaining',greatest(earned-paid,0));
end
$$;
revoke all on function public.alin_finance_party_balance(text,text) from public,anon;
grant execute on function public.alin_finance_party_balance(text,text) to authenticated;

create or replace function public.alin_finance_record_settlement(
  p_role text,p_party_id text,p_amount numeric,p_method text default 'نقدي',p_note text default null
)
returns jsonb
language plpgsql security definer
set search_path=public,extensions,pg_temp
as $$
declare
  r text:=lower(replace(coalesce(p_role,''),'courier','delegate'));
  v_balance jsonb;
  v_remaining numeric;
  v_amount numeric:=round(coalesce(p_amount,0));
  v_id text;
  v_nonce text:=gen_random_uuid()::text;
  v_number text:='FS-'||to_char(now(),'YYYYMMDD-HH24MISS')||'-'||upper(substr(replace(v_nonce,'-',''),1,6));
  v_actor text:=public.alin_current_account_id();
begin
  if not public.alin_is_finance_staff() then raise exception 'هذا الإجراء متاح للإدارة أو المحاسب فقط'; end if;
  if r not in ('library','delegate','teacher','admin') then raise exception 'نوع التسوية غير صحيح'; end if;
  if nullif(btrim(coalesce(p_party_id,'')),'') is null and r<>'admin' then raise exception 'الحساب غير محدد'; end if;
  if v_amount<=0 then raise exception 'مبلغ التسوية غير صحيح'; end if;
  v_balance:=public.alin_finance_party_balance(r,case when r='admin' then 'admin' else p_party_id end);
  v_remaining:=coalesce((v_balance->>'remaining')::numeric,0);
  if v_amount>v_remaining then raise exception 'المبلغ أكبر من الرصيد المتبقي'; end if;

  if r='library' then
    insert into public.library_settlements(receipt_number,library_id,amount,payment_method,note,status,created_by)
    values(v_number,p_party_id,v_amount,coalesce(nullif(btrim(p_method),''),'نقدي'),p_note,'received',v_actor)
    returning id::text into v_id;
  elsif r='delegate' then
    insert into public.delegate_settlements(receipt_number,delegate_id,courier_id,amount,payment_method,note,status,created_by)
    values(v_number,p_party_id,p_party_id,v_amount,coalesce(nullif(btrim(p_method),''),'نقدي'),p_note,'received',v_actor)
    returning id::text into v_id;
  else
    insert into public.financial_payouts(voucher_number,party_role,party_id,party_name,amount,payment_method,note,status,created_by)
    values(v_number,r,case when r='admin' then 'admin' else p_party_id end,null,v_amount,
      coalesce(nullif(btrim(p_method),''),'نقدي'),p_note,'paid',v_actor)
    returning id::text into v_id;
  end if;

  return jsonb_build_object('ok',true,'id',v_id,'number',v_number,'role',r,'amount',v_amount,
    'balance',public.alin_finance_party_balance(r,case when r='admin' then 'admin' else p_party_id end));
end
$$;
revoke all on function public.alin_finance_record_settlement(text,text,numeric,text,text) from public,anon;
grant execute on function public.alin_finance_record_settlement(text,text,numeric,text,text) to authenticated;

create or replace function public.alin_finance_reverse_settlement(
  p_role text,p_settlement_id text,p_reason text default null
)
returns jsonb
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare r text:=lower(replace(coalesce(p_role,''),'courier','delegate')); v_count integer:=0;
begin
  if not public.alin_is_finance_staff() then raise exception 'هذا الإجراء متاح للإدارة أو المحاسب فقط'; end if;
  if nullif(btrim(coalesce(p_reason,'')),'') is null then raise exception 'اكتب سبب عكس السند'; end if;
  if r='library' then
    update public.library_settlements set status='reversed',note=concat_ws(' | ',note,'عكس: '||btrim(p_reason)),updated_at=now()
    where id::text=p_settlement_id and lower(coalesce(status,'received')) not in ('reversed','cancelled');
    get diagnostics v_count=row_count;
  elsif r='delegate' then
    update public.delegate_settlements set status='reversed',note=concat_ws(' | ',note,'عكس: '||btrim(p_reason)),updated_at=now()
    where id::text=p_settlement_id and lower(coalesce(status,'received')) not in ('reversed','cancelled');
    get diagnostics v_count=row_count;
  elsif r in ('teacher','admin') then
    update public.financial_payouts set status='reversed',note=concat_ws(' | ',note,'عكس: '||btrim(p_reason)),updated_at=now()
    where id::text=p_settlement_id and lower(coalesce(status,'paid')) not in ('reversed','cancelled');
    get diagnostics v_count=row_count;
  else raise exception 'نوع السند غير صحيح';
  end if;
  if v_count=0 then raise exception 'السند غير موجود أو معكوس مسبقاً'; end if;
  return jsonb_build_object('ok',true,'role',r,'id',p_settlement_id,'status','reversed');
end
$$;
revoke all on function public.alin_finance_reverse_settlement(text,text,text) from public,anon;
grant execute on function public.alin_finance_reverse_settlement(text,text,text) to authenticated;

-- ============================================================
-- 8) منع أي كتابة مالية مباشرة من المتصفح
-- ============================================================
do $$
declare t text; p record;
begin
  foreach t in array array['ledger','library_settlements','delegate_settlements','financial_payouts'] loop
    if to_regclass('public.'||t) is null then continue; end if;
    execute format('alter table public.%I enable row level security',t);
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy if exists %I on public.%I',p.policyname,t);
    end loop;
    execute format(
      'create policy alin_stage5_%I_read on public.%I for select to authenticated using (public.alin_is_finance_staff() or public.alin_row_owner_match(to_jsonb(%I)))',
      t,t,t
    );
    execute format('revoke insert,update,delete on public.%I from authenticated,anon',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('revoke all on public.%I from anon',t);
  end loop;
end $$;

-- ============================================================
-- 9) إعادة بناء الحسابات للطلبات المكتملة الحالية
-- ============================================================
do $$
declare r record; fixed_count integer:=0;
begin
  for r in select id::text id from public.orders where lower(coalesce(status,'')) in ('completed','delivered') loop
    begin
      perform public.alin_upsert_order_finance_atomic(r.id);
      fixed_count:=fixed_count+1;
    exception when others then
      raise notice 'Stage5 skipped order %: %',r.id,sqlerrm;
    end;
  end loop;
  raise notice 'ALIN Stage5 rebuilt % completed finance row(s).',fixed_count;
end $$;

-- إعادة مشغلات ledger بعد اكتمال توحيد البيانات وإعادة بناء الحسابات.
do $$
begin
  if to_regclass('public.ledger') is not null then
    execute 'alter table public.ledger enable trigger user';
  end if;
end
$$;

insert into public.alin_schema_versions(version,notes)
values(
  '3.1.2-release-ledger-compatible',
  'Unified release with legacy-compatible pending ledger status, private documents, sparse checkout, and atomic finance'
)
on conflict(version) do update
set applied_at=now(),notes=excluded.notes;

notify pgrst,'reload schema';
commit;

-- الفحص النهائي: القيم المنطقية يجب أن تكون true والعدادات الحرجة 0.
select
  to_regprocedure('public.alin_insert_order_payload(jsonb)') is not null as sparse_order_insert_ready,
  to_regprocedure('public.alin_create_store_orders(jsonb,jsonb,jsonb,text)') is not null as secure_checkout_ready,
  to_regprocedure('public.alin_order_transition_atomic(text,text,text)') is not null as atomic_transition_ready,
  to_regprocedure('public.alin_upsert_order_finance_atomic(text)') is not null as atomic_finance_ready,
  to_regprocedure('public.alin_finance_record_settlement(text,text,numeric,text,text)') is not null as settlement_ready,
  to_regprocedure('public.alin_private_can_select_v310(text)') is not null as private_documents_ready,
  exists(select 1 from pg_constraint where conrelid='public.ledger'::regclass and conname='ledger_status_valid') as ledger_status_constraint_ready,
  exists(select 1 from pg_constraint where conrelid='public.ledger'::regclass and conname='ledger_settlement_status_valid') as ledger_settlement_constraint_ready,
  (select count(*) from public.ledger where status is null or settlement_status is null) as null_ledger_status_rows,
  (select count(*) from public.ledger where settlement_status not in ('pending','unsettled','accrued','settled','paid','received','cancelled','canceled','reversed','superseded')) as invalid_ledger_settlement_rows,
  (select count(*) from (
     select order_id from public.ledger where is_current=true and nullif(order_id::text,'') is not null group by order_id having count(*)>1
   ) d) as duplicate_current_ledger_rows;
