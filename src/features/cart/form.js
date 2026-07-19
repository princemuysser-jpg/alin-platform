/*
 * Alin cart form reader and validator
 * Owns customer, fulfillment, delivery, library, and stock validation.
 */
(function () {
  'use strict';

  const features = window.AlinFeatures = window.AlinFeatures || {};
  if (features.cartForm?.installed) return;

  const state = features.cartState;
  const element = id => document.getElementById(id);
  const value = id => String(element(id)?.value || '').trim();

  function database() {
    try {
      return typeof db !== 'undefined' ? db : (window.db || {});
    } catch (_) {
      return window.db || {};
    }
  }

  function fulfillment(rows) {
    if (rows.some(row => row.kind !== 'booklet')) return 'home_delivery';
    return document.querySelector('input[name="fulfillment"]:checked')?.value || 'pickup';
  }

  function read() {
    const snapshot = state?.snapshot() || { rows: [] };
    const mode = fulfillment(snapshot.rows);
    return {
      snapshot,
      customer: {
        name: value('studentName'),
        phone: value('studentPhone')
      },
      couponCode: value('couponInput'),
      fulfillment: mode,
      pickup: {
        libraryId: value('libSelect')
      },
      delivery: {
        area: value('deliveryArea'),
        address: value('deliveryAddress'),
        landmark: value('deliveryLandmark'),
        courierId: value('courierSelect') || null
      }
    };
  }

  function validateStock(rows) {
    const products = database().products || [];
    for (const row of rows) {
      if (row.kind === 'booklet') continue;
      const product = products.find(item => String(item.id) === String(row.id));
      if (product && Number(product.stock || 0) < row.quantity) {
        throw new Error(`الكمية غير متوفرة: ${row.title}`);
      }
    }
  }

  function validate() {
    const data = read();
    if (!data.snapshot.rows.length) throw new Error('السلة فارغة');
    if (!data.customer.name || !data.customer.phone) {
      throw new Error('أكمل اسم الطالب ورقم الهاتف');
    }
    if (data.fulfillment === 'pickup' && !data.pickup.libraryId) {
      throw new Error('اختر مكتبة الاستلام');
    }
    if (data.fulfillment === 'home_delivery'
      && (!data.delivery.area || !data.delivery.address || !data.delivery.landmark)) {
      throw new Error('أكمل بيانات التوصيل');
    }
    validateStock(data.snapshot.rows);
    return data;
  }

  features.cartForm = Object.freeze({
    installed: true,
    read,
    validate
  });
})();
