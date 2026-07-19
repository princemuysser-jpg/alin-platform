-- ALIN 1.2.7
-- Fix admin account creation, booklet/product delete, and booklet hiding.
-- The current application uses the public anon client for its legacy admin UI,
-- so these tables need explicit write policies for anon/authenticated.

begin;

alter table public.booklets
  add column if not exists is_hidden boolean not null default false;

alter table public.products
  add column if not exists is_hidden boolean not null default false;

-- Keep the old `hidden` field and the newer `is_hidden` field synchronized.
update public.booklets
set is_hidden = coalesce(hidden, false)
where is_hidden is distinct from coalesce(hidden, false);

update public.products
set is_hidden = coalesce(hidden, false)
where is_hidden is distinct from coalesce(hidden, false);

alter table public.accounts enable row level security;
alter table public.booklets enable row level security;
alter table public.products enable row level security;

drop policy if exists alin_legacy_admin_accounts_insert on public.accounts;
drop policy if exists alin_legacy_admin_accounts_update on public.accounts;
drop policy if exists alin_legacy_admin_accounts_delete on public.accounts;
drop policy if exists alin_legacy_admin_booklets_insert on public.booklets;
drop policy if exists alin_legacy_admin_booklets_update on public.booklets;
drop policy if exists alin_legacy_admin_booklets_delete on public.booklets;
drop policy if exists alin_legacy_admin_products_insert on public.products;
drop policy if exists alin_legacy_admin_products_update on public.products;
drop policy if exists alin_legacy_admin_products_delete on public.products;

create policy alin_legacy_admin_accounts_insert
on public.accounts for insert to anon, authenticated
with check (role in ('teacher','library','courier','accountant','admin'));

create policy alin_legacy_admin_accounts_update
on public.accounts for update to anon, authenticated
using (true) with check (role in ('teacher','library','courier','accountant','admin'));

create policy alin_legacy_admin_accounts_delete
on public.accounts for delete to anon, authenticated
using (true);

create policy alin_legacy_admin_booklets_insert
on public.booklets for insert to anon, authenticated
with check (true);

create policy alin_legacy_admin_booklets_update
on public.booklets for update to anon, authenticated
using (true) with check (true);

create policy alin_legacy_admin_booklets_delete
on public.booklets for delete to anon, authenticated
using (true);

create policy alin_legacy_admin_products_insert
on public.products for insert to anon, authenticated
with check (true);

create policy alin_legacy_admin_products_update
on public.products for update to anon, authenticated
using (true) with check (true);

create policy alin_legacy_admin_products_delete
on public.products for delete to anon, authenticated
using (true);

grant select, insert, update, delete on public.accounts to anon, authenticated;
grant select, insert, update, delete on public.booklets to anon, authenticated;
grant select, insert, update, delete on public.products to anon, authenticated;

notify pgrst, 'reload schema';

commit;
