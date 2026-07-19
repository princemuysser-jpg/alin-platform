# Alin 1.3.9 security update

## Applied without removing storefront features

- Removed the hard-coded `admin / 1234` fallback from desktop and mobile.
- Disabled automatic creation of demo teacher and library accounts.
- New teacher and library passwords are stored as SHA-256 digests.
- Existing plaintext teacher and library passwords remain compatible for one
  successful login, then the application attempts to replace them with a digest.
- Preserved the personalized storefront section and separated cart modules.

## Required administrator setup

Edit and run:

`database/migrations/Alin_v1_3_9_Admin_Credentials_Setup.sql`

Replace both `CHANGE_ME` values first. Until this is done, administrator login is
intentionally unavailable because the insecure default password was removed.

## Supabase RLS warning

The legacy migrations grant broad access to the anonymous role. Tightening those
policies immediately would break the current legacy administrator, teacher,
library, courier, product, and order flows because they do not yet use Supabase
Auth sessions consistently.

Do not deploy the old permissive migrations to a new production database. The
next security stage must migrate every staff role to Supabase Auth and then
replace anonymous write policies with authenticated role policies. Storefront
reads and carefully validated order creation can remain public.

SHA-256 compatibility in this release is transition protection, not a substitute
for server-side password hashing and Supabase Auth.
