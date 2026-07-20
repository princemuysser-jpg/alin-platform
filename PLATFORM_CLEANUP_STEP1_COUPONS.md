# ALIN v2.1.0 — Platform cleanup step 1

- Moved storefront coupon validation out of `modules/core/platform.js` to `modules/store/coupons.js`.
- Moved coupon administration out of `platform.js` and `admin/marketing.js` to `modules/admin/coupons.js`.
- Removed `v19Coupons` and all legacy coupon CRUD functions.
- Added coupons and notifications to the central data load.
- Coupon functions now have one implementation each.
