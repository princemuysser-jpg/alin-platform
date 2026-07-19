/*
 * Alin cart persistence
 * Owns the stable ALIN_CART browser-storage contract.
 */
(function () {
  'use strict';

  const features = window.AlinFeatures = window.AlinFeatures || {};
  if (features.cartPersistence?.installed) return;

  function save(rows) {
    const value = Array.isArray(rows) ? rows : [];
    localStorage.setItem('ALIN_CART', JSON.stringify(value));
    try {
      if (typeof window.renderCartBadge === 'function') window.renderCartBadge();
    } catch (_) {}
    return value;
  }

  features.cartPersistence = Object.freeze({
    installed: true,
    key: 'ALIN_CART',
    save
  });
})();
