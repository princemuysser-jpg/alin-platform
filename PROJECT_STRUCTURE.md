# Alin project structure

This copy separates entry pages, production bundles, shared styling, feature modules, assets, and database migrations. The original project copy remains unchanged.

## Entry points

- `index.html` selects the correct storefront.
- `store-desktop.html` is the desktop storefront.
- `store-mobile.html` is the mobile storefront.

## Production bundles

- `dist/css/` contains compiled desktop, mobile, and landing styles.
- `dist/js/` contains compiled desktop, mobile, and landing application code.

These bundles still contain the accumulated legacy application logic. They should be cleaned feature by feature in a later development pass, not moved blindly.

## Feature modules

- `src/features/banners/` owns storefront banner behavior and styling.
- `src/features/cart/state.js` owns normalized cart reads, totals, and change events.
- `src/features/cart/persistence.js` owns the `ALIN_CART` storage contract.
- `src/features/cart/catalog.js` owns item lookup, stock checks, and adding products.
- `src/features/cart/renderer.js` owns the empty and filled cart interface.
- `src/features/cart/checkout.js` owns submission state and duplicate-submit protection.
- `src/features/cart/form.js` owns customer, fulfillment, delivery, library, and stock validation.
- `src/features/cart/repository.js` is the cart database boundary for orders, coupons, audit, and reload.
- `src/features/cart/order-builder.js` creates order payloads, discounts, and one delivery fee.
- `src/features/cart/writer.js` coordinates database writes and the successful result.
- `src/features/cart/diagnostics.js` verifies module loading and public-action ownership.
- `src/features/cart/cart.js` is the single public boundary for cart actions.
- `src/features/navigation/` owns mobile navigation behavior and styling.
- `src/features/notifications/` owns the notification center.
- `src/features/options/` owns the options interface.

## Shared resources

- `src/styles/` contains tokens plus shared, desktop, and mobile overrides.
- `assets/` contains icons and storefront images.
- `src/core/` contains shared boot helpers.

## Database

- `database/migrations/` contains the SQL migrations in version order.

## Next development order

1. The cart public API now lives in `src/features/cart/`.
2. Cart state, rendering, and actions are now separated.
3. The bundled desktop and mobile cart renderers no longer replace the feature renderer.
4. Quantity changes, removal, and browser persistence no longer depend on legacy cart handlers.
5. Item lookup, stock validation, and adding rows no longer depend on legacy cart handlers.
6. Checkout now passes through one guarded boundary; database order writing remains the next extraction stage.
7. Checkout form reading and validation no longer depend on the legacy order writer.
8. Cart database calls now have one repository boundary ready for writer migration.
9. The live checkout now uses the separated order builder and writer instead of the legacy writer.
10. Runtime diagnostics confirm that all public cart actions belong to `src/features/cart/`.
3. Extract authentication and storefront rendering in separate passes.
4. Rebuild the production bundles after each extraction.
