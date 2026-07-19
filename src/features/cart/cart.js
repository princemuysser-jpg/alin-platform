/*
 * Alin cart feature boundary
 * This module is the single public entry point for cart actions.
 * Legacy bundle implementations remain internal until their dependencies
 * are extracted safely in later refactoring stages.
 */
(function () {
  'use strict';

  const feature = window.AlinFeatures = window.AlinFeatures || {};
  if (feature.cart?.installed) return;
  const state = feature.cartState;
  const renderer = feature.cartRenderer;
  const persistence = feature.cartPersistence;
  const catalog = feature.cartCatalog;
  const checkout = feature.cartCheckout;

  const implementation = {
    open: renderer?.open || (typeof window.openCart === 'function' ? window.openCart.bind(window) : null),
    add: catalog?.add || (typeof window.addToCart === 'function' ? window.addToCart.bind(window) : null),
    quantity: typeof window.cartQty === 'function' ? window.cartQty.bind(window) : null,
    remove: typeof window.cartRemove === 'function' ? window.cartRemove.bind(window) : null,
    checkout: checkout?.submit || (typeof window.confirmCartCheckout === 'function'
      ? window.confirmCartCheckout.bind(window)
      : null)
  };

  function requireAction(name) {
    const action = implementation[name];
    if (typeof action !== 'function') {
      console.error(`[Alin cart] Missing internal action: ${name}`);
      return null;
    }
    return action;
  }

  const cart = {
    installed: true,
    open(...args) {
      const action = requireAction('open');
      return action ? action(...args) : undefined;
    },
    add(...args) {
      const action = requireAction('add');
      const result = action ? action(...args) : undefined;
      state?.notify('add');
      return result;
    },
    changeQuantity(...args) {
      const result = state?.changeQuantity(args[0], args[1]) || false;
      if (result) {
        persistence?.save(state.raw());
        renderer?.open();
      }
      state?.notify('quantity');
      return result;
    },
    remove(...args) {
      const result = state?.remove(args[0]) || false;
      if (result) {
        persistence?.save(state.raw());
        renderer?.open();
      }
      state?.notify('remove');
      return result;
    },
    checkout(...args) {
      const action = requireAction('checkout');
      return action ? action(...args) : undefined;
    },
    count() {
      return state?.snapshot().count || 0;
    },
    snapshot() {
      return state?.snapshot() || { rows: [], count: 0, subtotal: 0 };
    }
  };

  feature.cart = cart;

  // Existing inline handlers keep working, but now pass through one owner.
  window.openCart = cart.open;
  window.addToCart = cart.add;
  window.cartQty = cart.changeQuantity;
  window.cartRemove = cart.remove;
  if (implementation.checkout) window.confirmCartCheckout = cart.checkout;

  document.documentElement.dataset.alinCartOwner = 'features/cart';
})();
