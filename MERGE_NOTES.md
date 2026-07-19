# Alin 1.3.8 merged safe

This version combines the preserved storefront from `Alin_v1_3_7_Organized_Clean_Final` with the separated cart implementation from `Alin_v1_3_7_One_Top_Ad_No_Stage_Box`.

## Preserved

- Desktop and mobile storefront entry points.
- Personalized storefront section (`v99Personalized`).
- Existing `ALIN_CART` browser storage format.
- Store categories, curated rails, student hub, tracking, banners, options, notifications, and mobile navigation.
- Existing database integration and migrations.

## Updated

- Cart public actions are owned by `src/features/cart/`.
- Cart state, persistence, catalog lookup, rendering, validation, checkout, repository access, order building, and writing are separated.
- The legacy compiled cart renderer no longer replaces the separated renderer.
- Version advanced to `1.3.8`.

## Important

- Historical cart code remains physically inside the compiled early bundles because unrelated legacy features share those bundles. Its public ownership is disabled to prevent conflicts.
- Database permissions and legacy authentication still require a separate security migration before production deployment.
