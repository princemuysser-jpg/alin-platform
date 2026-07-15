/* ===== core/js/cloud-status-ui-rc5.js ===== */
(function(){
  const labels={online:'متصل بـ Supabase',offline:'غير متصل',loading:'جاري تحميل البيانات',syncing:'جاري مزامنة البيانات','offline-queued':'تم حفظ العملية للمزامنة','sync-partial':'بعض العمليات بانتظار المزامنة',error:'خطأ في الاتصال',realtime:'التحديث الفوري يعمل'};
  let el,timer;
  function show(d){
    if(!el){el=document.createElement('div');el.className='alin-cloud-status';document.body.appendChild(el)}
    const s=d?.status||'online'; el.className=`alin-cloud-status show ${s}`; el.textContent=labels[s]||s;
    clearTimeout(timer); timer=setTimeout(()=>el.classList.remove('show'),s==='error'?6000:2800);
  }
  window.addEventListener('alin:cloud-status',e=>show(e.detail));
})();

