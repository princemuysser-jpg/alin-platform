# ALIN v2.1.9 — platform.js cleanup step 4

## Scope
Product, category and booklet administration was removed from `modules/core/platform.js` and implemented directly in:

- `modules/admin/products.js`
- `modules/admin/booklets.js`

## Direct implementations

- Product create, edit, hide/show and delete.
- Stock and low-stock handling.
- Product categories create, edit, hide/show and delete protection.
- Booklet create, edit, draft/review/publish/hide/archive and delete protection.
- PDF and cover upload handling.
- Linked-order checks before destructive deletion.

No legacy product/booklet admin function remains defined in `platform.js`.

## Result

- `platform.js`: 416,599 bytes → 373,605 bytes.
- Catalog extraction checks: 43 passed.
- Full release test suite: passed.
- Database migration: not required for this release.
