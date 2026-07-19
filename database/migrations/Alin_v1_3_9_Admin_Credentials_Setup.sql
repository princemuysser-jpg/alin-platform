-- Alin 1.3.9: one-time administrator credential setup.
-- Replace both CHANGE_ME values before running this file in Supabase SQL Editor.
-- The application compares the stored SHA-256 digest and never stores the new
-- administrator password itself.

create extension if not exists pgcrypto;

do $$
declare
  new_username text := 'CHANGE_ME_USERNAME';
  new_password text := 'CHANGE_ME_PASSWORD';
begin
  if new_username like 'CHANGE_ME%' or new_password like 'CHANGE_ME%' then
    raise exception 'Replace CHANGE_ME_USERNAME and CHANGE_ME_PASSWORD before running this migration';
  end if;

  if length(new_username) < 4 then
    raise exception 'Administrator username must contain at least 4 characters';
  end if;

  if length(new_password) < 12 then
    raise exception 'Administrator password must contain at least 12 characters';
  end if;

  insert into public.settings (key, value)
  values ('admin_username', new_username)
  on conflict (key) do update set value = excluded.value;

  insert into public.settings (key, value)
  values ('admin_password_hash', encode(digest(new_password, 'sha256'), 'hex'))
  on conflict (key) do update set value = excluded.value;
end
$$;
