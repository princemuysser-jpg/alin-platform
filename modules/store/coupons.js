// === store/coupons.js ===
/* ALIN v2.1.0: single storefront coupon service. */

function alinNormalizeCouponCode(value){
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g,'');
}

function alinCouponRows(){
  return Array.isArray(window.db?.coupons) ? window.db.coupons : [];
}

async function refreshCoupons(){
  if(typeof window.query !== 'function') return alinCouponRows();
  const rows = await window.query('coupons');
  if(window.db && typeof window.db === 'object') window.db.coupons = Array.isArray(rows) ? rows : [];
  return window.db.coupons;
}

function validCoupon(code){
  const normalized = alinNormalizeCouponCode(code);
  if(!normalized) return null;
  const coupon = alinCouponRows().find(row => alinNormalizeCouponCode(row.code) === normalized);
  if(!coupon || String(coupon.status || 'active') !== 'active') return null;
  if(coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) return null;
  const limit = Number(coupon.max_uses ?? coupon.usage_limit ?? 0);
  const used = Number(coupon.used_count ?? coupon.usage_count ?? 0);
  if(limit > 0 && used >= limit) return null;
  return coupon;
}

async function checkCoupon(){
  const input = document.getElementById('couponInput');
  const message = document.getElementById('couponMsg');
  const code = alinNormalizeCouponCode(input?.value || '');
  if(input) input.value = code;
  if(!code){
    if(message) message.textContent = 'اكتب كود الخصم';
    return null;
  }
  let coupon = validCoupon(code);
  if(!coupon){
    try{
      await refreshCoupons();
      coupon = validCoupon(code);
    }catch(error){
      console.warn('[ALIN coupons] refresh failed', error);
    }
  }
  if(message) message.textContent = coupon ? `تم تطبيق كوبون ${coupon.code}` : 'الكوبون غير صالح أو منتهي';
  return coupon;
}

function calculateCouponDiscount(coupon, amount){
  const total = Math.max(0, Number(amount || 0));
  if(!coupon) return 0;
  const value = Math.max(0, Number(coupon.discount_value || 0));
  if(coupon.discount_type === 'fixed') return Math.min(total, value);
  return Math.min(total, Math.round(total * value / 100));
}

window.AlinCoupons = Object.freeze({
  normalizeCode: alinNormalizeCouponCode,
  rows: alinCouponRows,
  refresh: refreshCoupons,
  findValid: validCoupon,
  calculateDiscount: calculateCouponDiscount,
});
window.refreshCoupons = refreshCoupons;
window.validCoupon = validCoupon;
window.checkCoupon = checkCoupon;
window.calculateCouponDiscount = calculateCouponDiscount;
window.alinApplyCoupon = checkCoupon;
