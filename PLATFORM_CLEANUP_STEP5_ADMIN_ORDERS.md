# PLATFORM CLEANUP — STEP 5: ADMIN ORDERS

Version: 2.2.0

## Actual extraction

- Removed all legacy `renderOrdersAdmin` implementations from `modules/core/platform.js`.
- Removed all legacy `orderStatus` implementations and status wrappers from `modules/core/platform.js`.
- Removed development payment and old manual-payment order UI functions from `platform.js`.
- Removed the V71 order-list enhancement wrapper from `platform.js`.
- Rebuilt `modules/admin/orders.js` as the single direct implementation.
- `modules/admin/orders.js` does not wrap or replace `adminTab`; the existing central route calls `renderOrdersAdmin` directly.

## Admin order workflow

- Search and filter by status, date, item type, library and courier.
- Order details, student data, delivery area, landmark, discount and delivery fee.
- Library assignment for pickup orders.
- Courier assignment by matching work area for delivery orders.
- Writes `assignment_status`, `assigned_at`, `courier_id` and `delegate_id` on assignment.
- Status history and audit entries.
- Product stock deduction only on the first transition to processing.
- Existing financial creation and final settlement functions remain connected.
- Receipt printing, WhatsApp and CSV export.
- Arabic errors for database status/schema/permission failures.

## Result

- `platform.js` reduced from 373,605 bytes to 361,589 bytes.
- One implementation for admin order rendering and updates.
- No SQL change required; database baseline remains v2.1.8.
