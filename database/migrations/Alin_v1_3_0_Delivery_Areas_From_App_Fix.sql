-- ALIN 1.3.0
-- Allow the application to read, add, rename, and deactivate delivery areas.
-- Supabase INSERT ... RETURNING also requires a SELECT policy.

begin;

-- Compatibility with already-published builds that still send `active`.
alter table public.delivery_areas
  add column if not exists active boolean not null default true;

alter table public.delivery_areas enable row level security;

drop policy if exists alin_legacy_admin_delivery_areas_select on public.delivery_areas;
drop policy if exists alin_legacy_admin_delivery_areas_insert on public.delivery_areas;
drop policy if exists alin_legacy_admin_delivery_areas_update on public.delivery_areas;
drop policy if exists alin_legacy_admin_delivery_areas_delete on public.delivery_areas;

create policy alin_legacy_admin_delivery_areas_select
on public.delivery_areas
for select
to anon, authenticated
using (true);

create policy alin_legacy_admin_delivery_areas_insert
on public.delivery_areas
for insert
to anon, authenticated
with check (true);

create policy alin_legacy_admin_delivery_areas_update
on public.delivery_areas
for update
to anon, authenticated
using (true)
with check (true);

create policy alin_legacy_admin_delivery_areas_delete
on public.delivery_areas
for delete
to anon, authenticated
using (true);

grant select, insert, update, delete
on public.delivery_areas
to anon, authenticated;

notify pgrst, 'reload schema';

commit;
