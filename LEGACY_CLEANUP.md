# Alin 1.4.0 legacy cleanup

## Removed

- The unused compiled `renderProfessionalCart` implementation.
- Its private empty-cart and checkout-form HTML builders.
- Legacy quantity and removal fallback mutations that duplicated the separated
  cart state module.

## Active cart owner

All public cart actions remain owned by `src/features/cart/`:

- `openCart`
- `addToCart`
- `cartQty`
- `cartRemove`
- checkout validation and order writing

## Intentionally retained

Earlier historical cart functions still exist inside the compiled early bundle.
They are retained because later legacy patches capture or wrap some of those
functions during bundle initialization. The separated cart modules replace the
public actions after the bundle loads.

Deleting the remaining text safely requires rebuilding the accumulated bundles
from source or adding browser regression coverage first. This release does not
remove code whose dependency status is uncertain.
