-- منصة آلين v1.1.3
-- إصلاح حفظ وإدارة الإعلانات للمستخدمين المسجلين في Supabase Auth.
-- القراءة تبقى عامة لعرض الإعلانات في واجهة المتجر.

begin;

alter table if exists public.banners enable row level security;

drop policy if exists alin_public_banners on public.banners;
drop policy if exists alin_admin_all on public.banners;
drop policy if exists banners_public_read on public.banners;
drop policy if exists banners_app_insert on public.banners;
drop policy if exists banners_app_update on public.banners;
drop policy if exists banners_app_delete on public.banners;
drop policy if exists banners_authenticated_insert on public.banners;
drop policy if exists banners_authenticated_update on public.banners;
drop policy if exists banners_authenticated_delete on public.banners;

create policy banners_public_read
on public.banners
for select
to anon, authenticated
using (
  active = true
  and (start_date is null or start_date <= now())
  and (end_date is null or end_date >= now())
);

create policy banners_authenticated_insert
on public.banners
for insert
to authenticated
with check (auth.uid() is not null);

create policy banners_authenticated_update
on public.banners
for update
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

create policy banners_authenticated_delete
on public.banners
for delete
to authenticated
using (auth.uid() is not null);

commit;
