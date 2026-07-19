(()=>{
  'use strict';
  const qs=(s,r=document)=>r.querySelector(s);
  const text=(el,value)=>{if(el)el.textContent=String(value??'')};
  async function validateCoupon(){
    const input=qs('#couponInput'),msg=qs('#couponMsg');
    const code=(input?.value||'').trim();
    if(!code){text(msg,'اكتب كود الخصم');return null}
    try{
      const c=window.ALINAuth?.client?.()||window.sb||window.supabaseClient;
      if(!c?.rpc)throw new Error('خدمة التحقق غير متاحة');
      const {data,error}=await c.rpc('alin_validate_coupon',{p_code:code});
      if(error)throw error;
      const row=Array.isArray(data)?data[0]:data;
      if(!row?.valid){text(msg,'الكوبون غير صالح أو منتهي');return null}
      text(msg,`تم قبول الكوبون ${row.code}`);return row;
    }catch(e){text(msg,e?.message||'تعذر التحقق من الكوبون');return null}
  }
  window.checkCoupon=validateCoupon;
  window.alinApplyCoupon=validateCoupon;
  window.addEventListener('error',e=>console.error('[ALIN v2 runtime]',e.error||e.message));
  window.addEventListener('unhandledrejection',e=>console.error('[ALIN v2 promise]',e.reason));
})();
