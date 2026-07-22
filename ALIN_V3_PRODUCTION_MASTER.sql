-- ============================================================
-- منصة آلين v3.0.0 — ترقية الإنتاج الموحدة
-- يشغّل مرة واحدة بعد v2.8.0، ويجمع حماية السجل والخصوصية
-- وتسجيل الدخول وصلاحيات الحسابات وحساب الطالب الآمن.
-- ============================================================

begin;

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

delete from public.student_sessions where expires_at<=now();
delete from public.auth_login_guard where updated_at<now()-interval '30 days';

insert into public.alin_schema_versions(version,notes)
values('3.0.0-production-unified','Audit, privacy, server login guard, account permissions, secure student auth, teacher data minimization')
on conflict(version) do update set applied_at=now(),notes=excluded.notes;

notify pgrst,'reload schema';
commit;

-- فحص نهائي: القيم يجب أن تكون true والعدادات 0.
select
  to_regclass('public.audit_events') is not null as audit_events_ready,
  to_regprocedure('public.alin_audit_write(text,text,jsonb,text,text)') is not null as audit_rpc_ready,
  to_regprocedure('public.alin_login_guard_check(text,text)') is not null as login_guard_ready,
  to_regclass('public.account_permissions') is not null as permissions_ready,
  to_regprocedure('public.alin_student_login(text,text,text)') is not null as student_auth_ready,
  to_regclass('public.alin_teacher_orders') is not null as teacher_privacy_view_ready,
  to_regclass('public.notification_reads') is not null as notification_reads_ready,
  to_regprocedure('public.alin_has_permission(text)') is not null as permission_enforcement_ready,
  to_regprocedure('public.alin_enforce_admin_permission()') is not null as permission_trigger_ready,
  (select count(*) from public.audit_events where action is null or trim(action)='') as invalid_audit_rows,
  (select count(*) from public.student_sessions where expires_at<=now()) as expired_student_sessions;
