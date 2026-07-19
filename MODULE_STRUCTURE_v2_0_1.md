# ALIN v2.0.1 module structure

The previous two large JavaScript bundles were removed. Runtime code is now loaded in ordered modules under `modules/`.

Main groups:
- `modules/core/`: configuration, Supabase, security, shared runtime.
- `modules/store/`: discovery, cart, routing and delivery.
- `modules/admin/`: dashboard, accounts, content, finance, settings and reports.
- `modules/teacher/`: teacher dashboard, booklets, publishing, finance and profile.
- `modules/library/`: library dashboard, orders, printing and finance.
- `modules/courier/`: courier dashboard and finance.

`modules/core/platform.js` is the remaining compatibility layer. New work should not be added there; features must be added to their domain module.
