// === store/coupons.js ===
/* ALIN v2.1.2: single storefront coupon service with live cart totals. */
(function(){
  'use strict';

  const STORAGE_KEY='ALIN_ACTIVE_COUPON';
  let activeCode='';

  function normalizeCode(value){
    return String(value ?? '').trim().toUpperCase().replace(/\s+/g,'');
  }

  function rows(){
    return Array.isArray(window.db?.coupons) ? window.db.coupons : [];
  }

  async function refresh(){
    if(typeof window.query !== 'function') return rows();
    const result=await window.query('coupons');
    if(window.db && typeof window.db === 'object') window.db.coupons=Array.isArray(result)?result:[];
    return window.db.coupons;
  }

  function validCoupon(code){
    const normalized=normalizeCode(code);
    if(!normalized)return null;
    const coupon=rows().find(row=>normalizeCode(row.code)===normalized);
    if(!coupon||String(coupon.status||'active')!=='active')return null;
    if(coupon.expires_at&&new Date(coupon.expires_at).getTime()<Date.now())return null;
    const limit=Number(coupon.max_uses??coupon.usage_limit??0);
    const used=Number(coupon.used_count??coupon.usage_count??0);
    if(limit>0&&used>=limit)return null;
    return coupon;
  }

  function lineDiscount(coupon,amount){
    const total=Math.max(0,Number(amount||0));
    if(!coupon)return 0;
    const value=Math.max(0,Number(coupon.discount_value||0));
    if(String(coupon.discount_type||'percent')==='fixed')return Math.min(total,value);
    return Math.min(total,Math.round(total*Math.min(value,100)/100));
  }

  function cartDiscount(coupon,lines=window.cart){
    if(!coupon||!Array.isArray(lines))return 0;
    return lines.reduce((sum,line)=>sum+lineDiscount(coupon,Number(line?.price||0)*Math.max(1,Number(line?.qty||1))),0);
  }

  function persist(code){
    activeCode=normalizeCode(code);
    try{
      if(activeCode)sessionStorage.setItem(STORAGE_KEY,activeCode);
      else sessionStorage.removeItem(STORAGE_KEY);
    }catch(_){}
  }

  function restoreCode(){
    if(activeCode)return activeCode;
    try{activeCode=normalizeCode(sessionStorage.getItem(STORAGE_KEY)||'')}catch(_){}
    return activeCode;
  }

  function getApplied(){
    const coupon=validCoupon(restoreCode());
    if(!coupon&&activeCode)persist('');
    return coupon;
  }

  function emit(coupon){
    const subtotal=Array.isArray(window.cart)?window.cart.reduce((sum,line)=>sum+Number(line?.price||0)*Math.max(1,Number(line?.qty||1)),0):0;
    const discount=cartDiscount(coupon,window.cart);
    if(typeof document?.dispatchEvent==='function'&&typeof CustomEvent==='function'){
      document.dispatchEvent(new CustomEvent('alin:coupon-changed',{detail:{coupon,code:coupon?.code||'',subtotal,discount,total:Math.max(0,subtotal-discount)}}));
    }
  }

  function apply(coupon){
    persist(coupon?.code||'');
    emit(coupon||null);
    if(typeof window.renderCartPricing==='function')window.renderCartPricing();
    return coupon||null;
  }

  function clear(){
    return apply(null);
  }

  async function checkCoupon(){
    const input=document.getElementById('couponInput');
    const message=document.getElementById('couponMsg');
    const code=normalizeCode(input?.value||'');
    if(input)input.value=code;
    if(!code){
      clear();
      if(message)message.textContent='اكتب كود الخصم';
      return null;
    }

    let coupon=validCoupon(code);
    if(!coupon){
      try{
        await refresh();
        coupon=validCoupon(code);
      }catch(error){
        console.warn('[ALIN coupons] refresh failed',error);
      }
    }

    if(!coupon){
      clear();
      if(message)message.textContent='الكوبون غير صالح أو منتهي';
      return null;
    }

    apply(coupon);
    const discount=cartDiscount(coupon,window.cart);
    if(message)message.textContent=discount>0
      ? `تم تطبيق كوبون ${coupon.code} — الخصم ${typeof window.money==='function'?window.money(discount):discount.toLocaleString('ar-IQ')} د.ع`
      : `تم تطبيق كوبون ${coupon.code}`;
    return coupon;
  }

  const api=Object.freeze({
    normalizeCode,
    rows,
    refresh,
    findValid:validCoupon,
    calculateDiscount:lineDiscount,
    calculateCartDiscount:cartDiscount,
    getApplied,
    getAppliedCode:restoreCode,
    apply,
    clear,
  });

  window.AlinCoupons=api;
  window.refreshCoupons=refresh;
  window.validCoupon=validCoupon;
  window.checkCoupon=checkCoupon;
  window.calculateCouponDiscount=lineDiscount;
  window.calculateCartCouponDiscount=cartDiscount;
  window.alinApplyCoupon=checkCoupon;
  window.clearAppliedCoupon=clear;
})();
