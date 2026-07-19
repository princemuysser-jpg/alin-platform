/*
 * Alin cart order builder
 * Pure payload creation: no DOM writes and no database writes.
 */
(function () {
  'use strict';

  const features = window.AlinFeatures = window.AlinFeatures || {};
  if (features.cartOrderBuilder?.installed) return;

  function discountFor(total, coupon) {
    if (!coupon) return 0;
    if (coupon.discount_type === 'fixed') {
      return Math.min(total, Number(coupon.discount_value) || 0);
    }
    return Math.round(total * ((Number(coupon.discount_value) || 0) / 100));
  }

  function deliveryFee() {
    try {
      return typeof window.alinDeliveryFee === 'function'
        ? Number(window.alinDeliveryFee()) || 0
        : 0;
    } catch (_) {
      return 0;
    }
  }

  function nextId() {
    if (typeof window.uid === 'function') return window.uid('O');
    return `O${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  }

  function nextOrderNumber() {
    if (typeof window.alinOrderNo === 'function') return window.alinOrderNo();
    if (typeof window.alinOrderNumber === 'function') return window.alinOrderNumber();
    return `AL-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 90 + 10)}`;
  }

  function fulfillment(data, fee) {
    if (data.fulfillment === 'pickup') {
      return {
        fulfillment_type: 'pickup',
        library_id: data.pickup.libraryId,
        courier_id: null,
        delivery_area: null,
        delivery_address: null,
        delivery_landmark: null,
        delivery_fee: 0,
        payment_method: 'cash_at_library',
        payment_status: 'cod_pending'
      };
    }
    return {
      fulfillment_type: 'home_delivery',
      library_id: null,
      courier_id: data.delivery.courierId,
      delivery_area: data.delivery.area,
      delivery_address: data.delivery.address,
      delivery_landmark: data.delivery.landmark,
      delivery_fee: fee,
      payment_method: 'cash_to_courier',
      payment_status: 'cod_pending'
    };
  }

  function build(data, coupon) {
    const fee = data.fulfillment === 'home_delivery' ? deliveryFee() : 0;
    return data.snapshot.rows.map((row, index) => {
      const raw = row.price * row.quantity;
      const discount = discountFor(raw, coupon);
      const itemFee = index === 0 ? fee : 0;
      const orderNumber = nextOrderNumber();
      return {
        id: nextId(),
        order_number: orderNumber,
        kind: row.kind,
        item_id: row.id,
        title: row.title,
        student_name: data.customer.name,
        student_phone: data.customer.phone,
        qty: row.quantity,
        unit_price: row.price,
        total: raw - discount + itemFee,
        discount,
        coupon_code: coupon?.code || null,
        status: 'new',
        status_history: [{ status: 'new', at: new Date().toISOString() }],
        ...fulfillment(data, itemFee)
      };
    });
  }

  features.cartOrderBuilder = Object.freeze({
    installed: true,
    discountFor,
    build
  });
})();
