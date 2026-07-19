-- Alin v2.0.3: safe public catalog for active teachers and libraries.
-- Safe to rerun.

begin;

create or replace view public.alin_public_accounts
with (security_barrier = true)
as
select id, role, name, status, area, landmark
from public.accounts
where role in ('teacher','library') and status = 'active';

revoke all on public.alin_public_accounts from public;
grant select on public.alin_public_accounts to anon, authenticated;

notify pgrst, 'reload schema';
commit;
