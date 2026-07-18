# Cart internal refactor report

## Result

The live desktop and mobile cart now run through `src/features/cart/`. Public cart actions no longer depend on the legacy cart UI, add, quantity, removal, validation, or order-writing handlers.

## Modules

- `state.js`: normalized rows, totals, mutations, and events.
- `persistence.js`: the existing `ALIN_CART` storage contract.
- `catalog.js`: item lookup, kind normalization, stock checks, and adding items.
- `renderer.js`: empty and filled cart HTML.
- `form.js`: customer, pickup, delivery, and stock validation.
- `repository.js`: database calls for orders, coupons, audit, and reload.
- `order-builder.js`: payloads, discounts, order numbers, and delivery fees.
- `writer.js`: order creation, cart clearing, refresh, success, tracking, and WhatsApp.
- `checkout.js`: submission lifecycle and duplicate-submit protection.
- `cart.js`: the single public action API.
- `diagnostics.js`: runtime ownership verification.

## Compatibility preserved

- Existing `ALIN_CART` browser data.
- Existing database helpers and Supabase repository path.
- Cash at library and cash to courier modes.
- Coupon use counting.
- Student order audit and last successful cart record.
- Tracking numbers and WhatsApp follow-up.

## Verification

- JavaScript syntax check for every project JavaScript file.
- Desktop and mobile asset-reference checks.
- Empty and filled cart rendering.
- Product, booklet, duplicate item, and out-of-stock cases.
- Quantity, removal, persistence, and totals.
- Pickup and home-delivery form validation.
- Fixed and percentage discounts.
- Delivery fee applied once across a multi-item order.
- Duplicate checkout submission protection.
- Order, coupon, audit, reload, success, tracking, and WhatsApp integration.
- Runtime diagnostics confirm ownership of open, add, quantity, remove, and checkout.

## Legacy bundle note

Historical cart definitions remain physically inside the compiled early bundles because unrelated features still share those bundles. They no longer own public cart actions. Removing their dead text should happen only when the full bundles are rebuilt from separated source modules.
