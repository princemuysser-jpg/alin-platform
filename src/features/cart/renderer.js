/*
 * Alin cart renderer
 * Owns cart HTML only. State, actions, persistence, and checkout stay separate.
 */
(function () {
  'use strict';

  const features = window.AlinFeatures = window.AlinFeatures || {};
  if (features.cartRenderer?.installed) return;

  const state = features.cartState;
  const escapeHtml = value => typeof window.esc === 'function'
    ? window.esc(value)
    : String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  const formatMoney = value => typeof window.money === 'function'
    ? window.money(value)
    : Number(value || 0).toLocaleString('ar-IQ');

  function database() {
    try {
      return typeof db !== 'undefined' ? db : (window.db || {});
    } catch (_) {
      return window.db || {};
    }
  }

  function sourceItem(row) {
    const data = database();
    const rows = row.kind === 'booklet' ? data.booklets : data.products;
    return (rows || []).find(item => String(item.id) === String(row.id)) || null;
  }

  function imageFor(item) {
    if (!item) return '';
    const path = item.cover_path || item.image_path || item.image || item.photo
      || item.image_url || item.cover_url || item.thumbnail;
    if (!path) return '';
    try {
      return typeof window.mediaUrl === 'function' ? window.mediaUrl(path) : path;
    } catch (_) {
      return path;
    }
  }

  function kindIcon(kind) {
    return kind === 'booklet'
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5z"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8h12l1 12H5L6 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></svg>';
  }

  function activeLibraries() {
    return (database().accounts?.libraries || []).filter(row => row.status === 'active');
  }

  function libraryOpen(library) {
    try {
      return typeof window.libIsOpen === 'function'
        ? Boolean(window.libIsOpen(library))
        : library?.is_open !== false;
    } catch (_) {
      return true;
    }
  }

  function libraryOptions() {
    return activeLibraries().map(library => {
      const open = libraryOpen(library);
      const label = `${library.name || 'مكتبة'} — ${open ? 'مفتوح' : 'مغلق'}`;
      return `<option value="${escapeHtml(library.id)}" ${open ? '' : 'disabled'}>${escapeHtml(label)}</option>`;
    }).join('');
  }

  function courierOptions() {
    try {
      if (typeof window.activeCouriers !== 'function') return '';
      return window.activeCouriers().map(courier =>
        `<option value="${escapeHtml(courier.id)}">${escapeHtml(courier.name)}${courier.area ? ` — ${escapeHtml(courier.area)}` : ''}</option>`
      ).join('');
    } catch (_) {
      return '';
    }
  }

  function fulfillment(rows) {
    const containsProducts = rows.some(row => row.kind !== 'booklet');
    const deliveryFields = `<div id="deliveryFields" class="alin-delivery-fields${containsProducts ? '' : ' hidden'}"><div class="form-grid"><input id="deliveryArea" placeholder="المنطقة"><input id="deliveryAddress" placeholder="العنوان الكامل"><input id="deliveryLandmark" placeholder="أقرب نقطة دالة"><select id="courierSelect"><option value="">تحديد المندوب من الإدارة</option>${courierOptions()}</select></div></div>`;
    if (containsProducts) {
      return `<section class="alin-fulfillment"><h4>طريقة الاستلام والدفع</h4><div class="alin-delivery-options"><label class="selected"><input type="radio" name="fulfillment" value="home_delivery" checked><span><b>توصيل للبيت</b><small>الدفع للمندوب عند التسليم</small></span></label></div>${deliveryFields}</section>`;
    }
    return `<section class="alin-fulfillment"><h4>طريقة الاستلام والدفع</h4><div class="alin-delivery-options"><label class="selected"><input type="radio" name="fulfillment" value="pickup" checked onchange="toggleDeliveryFields();alinSyncDeliveryCards()"><span><b>استلام من المكتبة</b><small>الدفع عند الاستلام</small></span></label><label><input type="radio" name="fulfillment" value="home_delivery" onchange="toggleDeliveryFields();alinSyncDeliveryCards()"><span><b>توصيل للبيت</b><small>الدفع للمندوب</small></span></label></div><div id="pickupFields" class="alin-pickup-fields"><select id="libSelect" onchange="alinShowLibraryStatus()"><option value="">اختر مكتبة الاستلام</option>${libraryOptions()}</select><div id="libInfo"></div></div>${deliveryFields}</section>`;
  }

  function emptyCart() {
    return `<div class="alin-cart-shell"><div class="alin-cart-main"><div class="alin-cart-empty"><div class="alin-empty-icon">${kindIcon('product')}</div><h3>السلة فارغة حالياً</h3><p>أضف ملازمك أو قرطاسيتك المفضلة، وبعدها ارجع هنا لإتمام الطلب بسرعة.</p><button type="button" onclick="closeCheckout();document.getElementById('storeGrid')?.scrollIntoView({behavior:'smooth'})">تصفح المتجر</button></div></div><aside class="alin-cart-side"><h3>ملخص الطلب</h3><div class="alin-summary-card"><div class="alin-summary-rows"><div><span>عدد المواد</span><b>0</b></div><div><span>الإجمالي</span><b>0 د.ع</b></div></div><div class="alin-cart-note">عند إضافة أي مادة ستظهر هنا تفاصيل الطلب والكوبون وبيانات الاستلام.</div></div></aside></div>`;
  }

  function itemHtml(row) {
    const item = sourceItem(row);
    const image = imageFor(item);
    return `<article class="alin-cart-item"><div class="alin-cart-thumb" data-kind="${escapeHtml(row.kind)}">${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(row.title)}">` : kindIcon(row.kind)}</div><div class="alin-cart-info"><h3 class="alin-cart-title">${escapeHtml(row.title)}</h3><div class="alin-cart-meta"><span class="alin-cart-chip">${row.kind === 'booklet' ? 'ملزمة' : 'منتج'}</span><span class="alin-cart-chip">سعر القطعة: ${formatMoney(row.price)} د.ع</span></div><div class="alin-cart-price">${formatMoney(row.price * row.quantity)} د.ع</div></div><div class="alin-cart-controls"><div class="alin-qty-box"><button type="button" aria-label="تقليل الكمية" onclick="cartQty(${row.index},-1)">−</button><b>${row.quantity}</b><button type="button" aria-label="زيادة الكمية" onclick="cartQty(${row.index},1)">+</button></div><button type="button" class="alin-remove-btn" onclick="cartRemove(${row.index})">حذف من السلة</button></div></article>`;
  }

  function filledCart(snapshot) {
    return `<div class="alin-cart-shell"><section class="alin-cart-main"><div class="alin-cart-head"><div><h2>سلة آلين</h2><p>راجع المواد والكميات قبل تأكيد الطلب.</p></div><span class="alin-cart-badge">${snapshot.count}</span></div><div class="alin-cart-list">${snapshot.rows.map(itemHtml).join('')}</div></section><aside class="alin-cart-side"><h3>ملخص الطلب</h3><div class="alin-summary-card"><div class="alin-summary-rows"><div><span>عدد المواد</span><b>${snapshot.count}</b></div><div><span>المجموع الفرعي</span><b>${formatMoney(snapshot.subtotal)} د.ع</b></div></div><div class="alin-summary-total"><div>الإجمالي النهائي</div><b>${formatMoney(snapshot.subtotal)} د.ع</b></div><div class="coupon-box"><input id="couponInput" placeholder="أدخل كود الخصم"><button type="button" onclick="checkCoupon()">تطبيق</button></div><div id="couponMsg"></div><div class="alin-cart-form"><h4>بيانات الطالب والاستلام</h4><div class="form-grid"><input id="studentName" placeholder="اسم الطالب الكامل"><input id="studentPhone" placeholder="رقم الهاتف"></div>${fulfillment(snapshot.rows)}</div><button type="button" class="alin-cart-submit" onclick="confirmCartCheckout()">تأكيد الطلب الآن</button></div></aside></div>`;
  }

  function open() {
    const box = document.getElementById('checkoutBox');
    const modal = document.getElementById('checkoutModal');
    if (!box || !modal || !state) return;
    const snapshot = state.snapshot();
    box.innerHTML = snapshot.rows.length ? filledCart(snapshot) : emptyCart();
    modal.classList.remove('hidden');
    const close = modal.querySelector('.x');
    if (close) {
      close.textContent = 'إغلاق';
      close.setAttribute('aria-label', 'إغلاق السلة');
    }
    setTimeout(() => {
      try {
        window.alinSyncDeliveryCards?.();
        window.alinShowLibraryStatus?.();
      } catch (_) {}
    }, 0);
  }

  features.cartRenderer = Object.freeze({ installed: true, open });
})();
