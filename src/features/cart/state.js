/*
 * Alin cart state adapter
 * Reads the existing cart array without owning persistence yet.
 * All new cart modules should use this adapter instead of reading globals.
 */
(function () {
  'use strict';

  const features = window.AlinFeatures = window.AlinFeatures || {};
  if (features.cartState?.installed) return;

  function source() {
    try {
      return typeof cart !== 'undefined' && Array.isArray(cart) ? cart : [];
    } catch (_) {
      return [];
    }
  }

  function normalizedRows() {
    return source().map((row, index) => ({
      index,
      id: row?.id ?? row?.item_id ?? '',
      kind: row?.kind || 'product',
      title: row?.title || row?.name || '',
      price: Number(row?.price) || 0,
      quantity: Math.max(1, Number(row?.qty) || 1),
      raw: row
    }));
  }

  function snapshot() {
    const rows = normalizedRows();
    return Object.freeze({
      rows: Object.freeze(rows),
      count: rows.reduce((total, row) => total + row.quantity, 0),
      subtotal: rows.reduce((total, row) => total + row.price * row.quantity, 0)
    });
  }

  function notify(reason) {
    const detail = { reason: reason || 'update', ...snapshot() };
    document.dispatchEvent(new CustomEvent('alin:cart-change', { detail }));
    return detail;
  }

  function changeQuantity(index, delta) {
    const rows = source();
    if (!rows[index]) return false;
    rows[index].qty = Math.max(1, (Number(rows[index].qty) || 1) + Number(delta || 0));
    return true;
  }

  function remove(index) {
    const rows = source();
    if (!rows[index]) return false;
    rows.splice(index, 1);
    return true;
  }

  features.cartState = Object.freeze({
    installed: true,
    rows: normalizedRows,
    snapshot,
    notify,
    changeQuantity,
    remove,
    raw: source
  });
})();
