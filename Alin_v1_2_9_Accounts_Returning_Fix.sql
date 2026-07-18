-- ALIN 1.2.9
-- Supabase INSERT ... RETURNING requires a SELECT policy as well as INSERT.

begin;

drop policy if exists alin_legacy_admin_accounts_select on public.accounts;
drop policy if exists alin_legacy_admin_accounts_insert on public.accounts;

create policy alin_legacy_admin_accounts_select
on public.accounts
for select
to anon, authenticated
using (true);

create policy alin_legacy_admin_accounts_insert
on public.accounts
for insert
to anon, authenticated
with check (true);

grant select, insert, update, delete on public.accounts to anon, authenticated;

notify pgrst, 'reload schema';

commit;
