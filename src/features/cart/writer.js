/*
 * Alin cart order writer
 * Coordinates validated form data, payload building, database writes,
 * cart clearing, refresh, and the success result.
 */
(function () {
  'use strict';

  const features = window.AlinFeatures = window.AlinFeatures || {};
  if (features.cartWriter?.installed) return;

  const state = features.cartState;
  const form = features.cartForm;
  const builder = features.cartOrderBuilder;
  const repository = features.cartRepository;
  const persistence = features.cartPersistence;

  function couponFor(code) {
    try {
      return typeof window.validCoupon === 'function' ? window.validCoupon(code || '') : null;
    } catch (_) {
      return null;
    }
  }

  function successHtml(numbers, message) {
    if (typeof window.alinTrackingResultHtml === 'function') {
      return window.alinTrackingResultHtml(numbers, message);
    }
    return `<div class="alin-cart-success"><h2>تم استلام طلبك</h2><p>${message}</p><div class="alin-order-numbers">${numbers.map(number => `<b>${number}</b>`).join('')}</div><button onclick="closeCheckout()">إغلاق</button></div>`;
  }

  async function postSuccess(orders, previousRows) {
    try {
      localStorage.setItem('alin_v99_last_successful_cart', JSON.stringify({
        at: new Date().toISOString(),
        items: previousRows.map(row => ({ ...row.raw }))
      }));
    } catch (_) {}
    try {
      const student = typeof window.currentStudent === 'function' ? window.currentStudent() : null;
      if (student) await repository.recordAudit(`طلب من حساب طالب ${student.phone || ''}`);
    } catch (_) {}
    try {
      window.renderStudentHub?.();
    } catch (_) {}
    return orders;
  }

  async function submit() {
    const data = form.validate();
    const coupon = couponFor(data.couponCode);
    const orders = builder.build(data, coupon);
    for (const order of orders) await repository.createOrder(order);
    try {
      if (coupon) await repository.incrementCoupon(coupon);
    } catch (_) {}
    await repository.recordAudit(`إنشاء طلب من السلة مع كود تتبع`);

    const previousRows = data.snapshot.rows;
    state.raw().splice(0);
    persistence.save(state.raw());
    await repository.reload();

    const message = data.fulfillment === 'pickup'
      ? 'التسليم والدفع عن طريق المكتبة.'
      : 'التسليم والدفع عن طريق المندوب.';
    const box = document.getElementById('checkoutBox');
    if (box) {
      box.innerHTML = successHtml(orders.map(order => order.order_number), message);
      if (orders[0]?.id && typeof window.alinV85WhatsApp === 'function') {
        const id = String(orders[0].id).replace(/['"<>]/g, '');
        box.insertAdjacentHTML('beforeend', `<button class="alin-v85-wa" onclick="alinV85WhatsApp('${id}')">واتساب بخصوص الطلب</button>`);
      }
    }
    await postSuccess(orders, previousRows);
    return orders;
  }

  features.cartWriter = Object.freeze({
    installed: true,
    submit
  });
})();
