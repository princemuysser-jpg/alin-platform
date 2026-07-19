/*
 * Alin cart catalog adapter
 * Owns item lookup, kind normalization, stock validation, and adding rows.
 */
(function () {
  'use strict';

  const features = window.AlinFeatures = window.AlinFeatures || {};
  if (features.cartCatalog?.installed) return;

  const state = features.cartState;
  const persistence = features.cartPersistence;

  function database() {
    try {
      return typeof db !== 'undefined' ? db : (window.db || {});
    } catch (_) {
      return window.db || {};
    }
  }

  function normalizeKind(kind) {
    return kind === 'booklet_product' ? 'stationery' : kind;
  }

  function find(kind, id) {
    const normalizedKind = normalizeKind(kind);
    const data = database();
    const rows = normalizedKind === 'booklet' ? data.booklets : data.products;
    const item = (rows || []).find(row => String(row.id) === String(id)) || null;
    return { kind: normalizedKind, item };
  }

  function add(kind, id) {
    const found = find(kind, id);
    if (!found.item) return false;
    if (found.kind !== 'booklet' && Number(found.item.stock) <= 0) {
      window.alert?.('المنتج نافد');
      return false;
    }

    const rows = state?.raw() || [];
    const existing = rows.find(row =>
      row.kind === found.kind && String(row.id) === String(id)
    );
    if (existing) {
      existing.qty = Math.max(1, Number(existing.qty) || 1) + 1;
    } else {
      rows.push({
        kind: found.kind,
        id,
        title: found.item.title || found.item.name || 'المادة',
        price: Number(found.item.price) || 0,
        qty: 1
      });
    }

    persistence?.save(rows);
    window.toast?.('تمت الإضافة إلى السلة');
    return true;
  }

  features.cartCatalog = Object.freeze({
    installed: true,
    normalizeKind,
    find,
    add
  });
})();
