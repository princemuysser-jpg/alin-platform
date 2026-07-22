// === store/tracking.js ===
/* ALIN v2.0.6 — secure public order tracking through RPC. */
(function(){
  'use strict';
  const labels={pending:'تم استلام الطلب',new:'تم استلام الطلب',payment_pending:'بانتظار التأكيد',processing:'قيد التجهيز',ready:'جاهز بالمكتبة',out_delivery:'خرج للتوصيل',completed:'تم التسليم',delivered:'تم التسليم',cancelled:'ملغي'};
  const steps=['pending','processing','ready','out_delivery','completed'];
  const clean=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  window.trackOrder=async function(){
    const input=document.getElementById('trackOrderInput');
    const box=document.getElementById('trackOrderResult');
    if(!box)return;
    const code=String(input?.value||'').trim();
    box.className='track-result show';
    if(code.length<6){box.textContent='اكتب رقم الطلب الكامل أولاً';return}
    box.textContent='جارٍ التحقق من حالة الطلب...';
    try{
      const c=window.sb||(window.AlinCloud&&window.AlinCloud.client?.());
      if(!c?.rpc)throw new Error('خدمة التتبع غير متاحة');
      const {data,error}=await c.rpc('alin_track_order',{p_order_number:code});
      if(error)throw error;
      if(!data?.found){box.textContent='لم يتم العثور على الطلب. تأكد من رقم التتبع.';return}
      const status=String(data.status||'new');
      const normalized=status==='delivered'?'completed':status;
      const reached=steps.indexOf(normalized);
      box.innerHTML=`<b>${clean(data.order_number)} — ${clean(data.title||'طلب منصة آلين')}</b>${data.ready_eta?`<br><small>الجاهزية المتوقعة: ${clean(data.ready_eta)}</small>`:''}<div class="timeline v31">${steps.map((step,index)=>`<span class="${index<=Math.max(0,reached)?'done':''}">${labels[step]}</span>`).join('')}</div>`;
      document.dispatchEvent(new CustomEvent('alin:tracking-rendered',{detail:{code,data,status:normalized}}));
    }catch(error){
      console.error('[ALIN tracking]',error);
      box.textContent='تعذر التحقق الآن. أعد المحاولة بعد قليل.';
    }
  };
})();
