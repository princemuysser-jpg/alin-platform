/*
 * Alin cart repository
 * The only cart module allowed to call legacy database helpers.
 */
(function () {
  'use strict';

  const features = window.AlinFeatures = window.AlinFeatures || {};
  if (features.cartRepository?.installed) return;

  function helper(name) {
    const fn = window[name];
    if (typeof fn !== 'function') {
      throw new Error(`[Alin cart] Database helper unavailable: ${name}`);
    }
    return fn;
  }

  async function createOrder(payload) {
    if (!payload || typeof payload !== 'object') {
      throw new TypeError('بيانات الطلب غير صالحة');
    }
    return helper('insert')('orders', payload);
  }

  async function incrementCoupon(coupon) {
    if (!coupon?.id) return null;
    return helper('update')(
      'coupons',
      { used_count: (Number(coupon.used_count) || 0) + 1 },
      { id: coupon.id }
    );
  }

  async function recordAudit(message) {
    return helper('audit')('order', message);
  }

  async function reload() {
    return helper('load')();
  }

  features.cartRepository = Object.freeze({
    installed: true,
    createOrder,
    incrementCoupon,
    recordAudit,
    reload
  });
})();
