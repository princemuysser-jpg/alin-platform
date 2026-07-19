/*
 * Alin cart runtime diagnostics
 * Confirms that every public cart action is owned by the separated feature.
 */
(function () {
  'use strict';

  const features = window.AlinFeatures || {};
  const required = [
    'cartState',
    'cartPersistence',
    'cartCatalog',
    'cartRenderer',
    'cartForm',
    'cartRepository',
    'cartOrderBuilder',
    'cartWriter',
    'cartCheckout',
    'cart'
  ];
  const missing = required.filter(name => !features[name]?.installed);
  const ownership = {
    open: window.openCart === features.cart?.open,
    add: window.addToCart === features.cart?.add,
    quantity: window.cartQty === features.cart?.changeQuantity,
    remove: window.cartRemove === features.cart?.remove,
    checkout: window.confirmCartCheckout === features.cart?.checkout
  };
  const ready = !missing.length && Object.values(ownership).every(Boolean);

  window.AlinCartDiagnostics = Object.freeze({
    ready,
    missing: Object.freeze(missing),
    ownership: Object.freeze(ownership)
  });
  document.documentElement.dataset.alinCartReady = String(ready);
  document.dispatchEvent(new CustomEvent('alin:cart-ready', {
    detail: window.AlinCartDiagnostics
  }));
  if (!ready) console.error('[Alin cart] Feature initialization failed', window.AlinCartDiagnostics);
})();
