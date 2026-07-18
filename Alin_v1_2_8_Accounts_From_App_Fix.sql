-- ALIN 1.2.8
-- Allow the legacy admin screen to create every supported account record.
-- Account validation remains in the application form and database constraints.

begin;

drop policy if exists alin_legacy_admin_accounts_insert on public.accounts;

create policy alin_legacy_admin_accounts_insert
on public.accounts
for insert
to anon, authenticated
with check (true);

grant select, insert, update, delete on public.accounts to anon, authenticated;

notify pgrst, 'reload schema';

commit;

-- Test the same database role used by the web application.
-- The temporary row is removed inside this transaction.
begin;
set local role anon;

insert into public.accounts
  (id, role, name, username, password_hash, area, landmark, status)
values
  ('ALIN_POLICY_TEST_128', 'courier', 'اختبار سياسة البرنامج', 'alin_policy_test_128',
   'temporary-test-only', 'كركوك', 'اختبار', 'active');

delete from public.accounts
where id = 'ALIN_POLICY_TEST_128';

commit;
