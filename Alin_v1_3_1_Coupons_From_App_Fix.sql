-- ALIN 1.3.1
-- Fix coupon creation and management from the published web application.

begin;

-- Compatibility columns used by the current admin interface.
alter table public.coupons
  add column if not exists usage_limit integer not null default 0,
  add column if not exists usage_count integer not null default 0,
  add column if not exists applies_to text not null default 'all';

alter table public.coupons enable row level security;

drop policy if exists alin_app_coupons_select on public.coupons;
drop policy if exists alin_app_coupons_insert on public.coupons;
drop policy if exists alin_app_coupons_update on public.coupons;
drop policy if exists alin_app_coupons_delete on public.coupons;

create policy alin_app_coupons_select
on public.coupons
for select
to anon, authenticated
using (true);

create policy alin_app_coupons_insert
on public.coupons
for insert
to anon, authenticated
with check (true);

create policy alin_app_coupons_update
on public.coupons
for update
to anon, authenticated
using (true)
with check (true);

create policy alin_app_coupons_delete
on public.coupons
for delete
to anon, authenticated
using (true);

grant select, insert, update, delete
on public.coupons
to anon, authenticated;

notify pgrst, 'reload schema';

commit;
