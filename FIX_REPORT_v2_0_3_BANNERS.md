# ALIN v2.0.3 — Banner placement and image fix

## Fixed
- The public advertisement is rendered once only.
- The banner is placed directly below the store header on desktop and mobile.
- The legacy `#bannerBox` renderer remains as a hidden compatibility target and can no longer display a second banner in the middle of the catalog.
- Uploaded banner images now resolve from the actual upload location first: `alin-files/banners/...`.
- Older `banners` bucket paths and legacy paths remain as fallbacks.
- Broken image sources automatically try the next compatible storage URL.
- Service worker cache and asset query versions updated to 2.0.3.

## Verification
- Desktop and mobile each contain one top banner anchor.
- Legacy banner box is hidden with `display:none!important`.
- Banner script syntax passed.
- Local HTML asset references passed.
