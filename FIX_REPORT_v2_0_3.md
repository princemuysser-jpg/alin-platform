# Alin v2.0.3 — Stabilization Update

## Implemented fixes

- Fixed the release test path on Windows by using `fileURLToPath`.
- Added classic-script syntax parsing for every JavaScript file in the release.
- Added version and cache-buster consistency checks.
- Unified the runtime, package, PWA cache, pages, and readiness check on version 2.0.3.
- Routed both cart checkout and direct checkout through `alin_create_store_orders`.
- Removed the second stock deduction when an order moves to `processing`.
- Added a maximum of 50 distinct cart rows and 100 units per row.
- Stopped trusting delivery fees supplied by the browser.
- Delivery fees are now resolved from `delivery_areas` for home-delivery orders.
- Renamed the deployment and readiness SQL files for v2.0.3.
- Regenerated SHA-256 checksums after all release changes.

## Validation performed

- 52 JavaScript files parsed successfully.
- 41 modular JavaScript files detected.
- HTML local asset references checked.
- Version consistency checked.
- Release test result: zero failures.

## Deployment order

1. Back up the current Supabase database.
2. Run `RUN_ON_SUPABASE_v2_0_3_IDEMPOTENT.sql` in Supabase SQL Editor.
3. Deploy the four functions under `supabase/functions`.
4. Run `CHECK_SUPABASE_READINESS_v2_0_3.sql`.
5. Deploy the web files only after the readiness check passes.

## Important

The SQL is designed to be rerunnable, but it must still be tested on a staging Supabase project before production. CAPTCHA and edge-level rate limiting require deployment-specific infrastructure and are not silently enabled by this package.
