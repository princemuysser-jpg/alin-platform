# Alin editing guide

## Start here

Edit source files inside `src/`. Do not edit `dist/` unless you are deliberately rebuilding or maintaining the historical compiled application.

## Common changes

- Desktop appearance: `src/styles/alin-desktop.css`
- Mobile appearance: `src/styles/alin-mobile.css`
- Shared appearance: `src/styles/alin-shared.css`
- Colors and tokens: `src/styles/alin-tokens.css`
- Cart: `src/features/cart/`
- Options: `src/features/options/`
- Notifications: `src/features/notifications/`
- Mobile navigation: `src/features/navigation/`
- Store banners: `src/features/banners/`
- Database migrations: `database/migrations/`

## Entry pages

- Desktop: `store-desktop.html`
- Mobile: `store-mobile.html`
- Device redirect: `index.html`

## Folder rules

- Put editable feature code in `src/features/<feature>/`.
- Put editable shared helpers in `src/core/`.
- Put editable CSS in `src/styles/`.
- Put images and icons in `assets/`.
- Keep generated or historical bundles in `dist/`.
- Keep SQL changes in `database/migrations/` with a versioned filename.

## Cart load order

The cart modules are loaded in dependency order. If a new cart module is added, place it before `cart.js` and keep `diagnostics.js` last.
