# Alin storefront style ownership

Load order is deliberate: the compiled application bundle remains the immutable base, followed by `alin-tokens.css`, `alin-shared.css`, and exactly one platform file.

- `alin-tokens.css`: brand variables and light/dark token values only.
- `alin-shared.css`: options/contact dialogs, shared dark-theme surfaces, banners, notifications, and shared accessibility behavior.
- `alin-desktop.css`: desktop header controls, the authoritative desktop SVG cart/account icons, and desktop-only navy category cards.
- `alin-mobile.css`: the proven mobile header, notification button, bottom sheet, banner spacing, and mobile notification panel sizing.

`src/features/options/options.css` is retained only as a compatibility stub and is no longer loaded. New component rules must go into the owning file; do not append cross-platform emergency overrides.

The remaining `!important` declarations exist only where the cleaned layer must defeat immutable declarations in the compiled bundles or inline legacy presentation. They are grouped beside comments explaining that boundary.
